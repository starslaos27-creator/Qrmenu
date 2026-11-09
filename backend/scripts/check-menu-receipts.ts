// Integration checks use connection-local temporary tables, never restaurant data.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {Client} from 'pg';
import {loadEnv} from '../src/config/env.js';
import {signAccessToken} from '../src/security/auth.js';
import {registerManagementRoutes} from '../src/routes/management.js';

async function main() {
 const env=loadEnv(), db=new Client({connectionString:env.databaseUrl});
 await db.connect();
 const app=Fastify();
 app.decorate('db',{query:db.query.bind(db),connect:async()=>({query:db.query.bind(db),release(){}})});
 try {
  await db.query(`create temp table app_users(id uuid primary key, email text, display_name text, disabled_at timestamptz);
   create temp table restaurants(id uuid primary key, suspended_at timestamptz);
   create temp table restaurant_members(restaurant_id uuid,user_id uuid,role text);
   create temp table menus(id uuid primary key, restaurant_id uuid, name text, stock_barcode text, unit text, stock_quantity numeric(14,3), track_stock boolean);
   create temp table audit_logs(id uuid primary key default gen_random_uuid(),restaurant_id uuid,actor_user_id uuid,action text,target_id uuid,details jsonb,created_at timestamptz default now());`);
  const user={id:randomUUID(),email:'receipt-test@example.invalid'}, restaurant=randomUUID(), other=randomUUID(), menu=randomUUID();
  await db.query('insert into app_users values($1,$2,$3,null)',[user.id,user.email,'Original receiver']);
  await db.query('insert into restaurants(id) values($1),($2)',[restaurant,other]);
  await db.query("insert into restaurant_members values($1,$2,'owner')",[restaurant,user.id]);
  await db.query('insert into menus values($1,$2,$3,$4,$5,10,true)',[menu,restaurant,'Original product','TEST-001','bottle']);
  await registerManagementRoutes(app,env);
  const headers={authorization:`Bearer ${await signAccessToken(env,user)}`};
  const base=`/api/restaurants/${restaurant}`;
  const call=async(method:string,url:string,payload?:object)=>app.inject({method:method as any,url,headers,payload});
  const body={request_id:randomUUID(),quantity:2.5,note:'Invoice 001'};
  let res=await call('POST',`${base}/menus/${menu}/receive`,body);
  assert.equal(res.statusCode,200,res.body);assert.equal(Number(res.json().menu.stock_quantity),12.5);
  res=await call('POST',`${base}/menus/${menu}/receive`,body);
  assert.equal(res.statusCode,200);assert.equal(Number(res.json().menu.stock_quantity),12.5);
  assert.equal((await call('POST',`${base}/menus/${menu}/receive`,{...body,quantity:3})).statusCode,409);
  assert.equal((await call('POST',`${base}/menus/${menu}/receive`,{...body,quantity:0})).statusCode,400);
  assert.equal((await call('POST',`${base}/menus/${menu}/receive`,{...body,quantity:0.0001})).statusCode,400);
  assert.equal((await call('GET',`/api/restaurants/${other}/menu-receipts`)).statusCode,403);
  assert.equal((await app.inject({method:'GET',url:`${base}/menu-receipts`})).statusCode,401);
  await db.query("update restaurant_members set role='staff'");
  assert.equal((await call('GET',`${base}/menu-receipts`)).statusCode,403);
  await db.query("update restaurant_members set role='owner'");
  res=await call('POST',`${base}/menus/${menu}/stock-adjustments`,{request_id:randomUUID(),quantity:1,movement_type:'purchase'});
  assert.equal(res.statusCode,200,res.body);
  await db.query("update menus set name='Renamed',unit='case',stock_barcode='CHANGED'; update app_users set display_name='Renamed receiver'");
  let list=(await call('GET',`${base}/menu-receipts`)).json();
  assert.equal(list.total,2);assert.equal(list.products,1);
  assert.ok(list.receipts.every(r=>r.menu_name==='Original product'&&r.actor_name==='Original receiver'&&r.unit==='bottle'&&r.barcode==='TEST-001'&&!r.legacy));
  assert.equal((await call('GET',`${base}/menu-receipts?search=Invoice`)).json().total,1);
  assert.equal((await call('GET',`${base}/menu-receipts?search=%25`)).json().total,0);
  assert.equal((await call('GET',`${base}/menu-receipts?from=2026-02-30`)).statusCode,400);
  assert.equal((await call('GET',`${base}/menu-receipts?from=2026-10-05&to=2026-10-04`)).statusCode,400);
  // UTC+7 day boundaries: include midnight and last second, exclude next midnight.
  await db.query("update audit_logs set created_at='2026-10-03T17:00:00Z' where details->>'note'='Invoice 001'");
  await db.query("update audit_logs set created_at='2026-10-04T17:00:00Z' where details->>'note' is null");
  assert.equal((await call('GET',`${base}/menu-receipts?from=2026-10-04&to=2026-10-04`)).json().total,1);
  await db.query("update audit_logs set created_at='2026-10-04T16:59:59Z' where details->>'note' is null");
  assert.equal((await call('GET',`${base}/menu-receipts?from=2026-10-04&to=2026-10-04`)).json().total,2);
  // Audit failure must roll back the stock increment.
  await db.query("alter table audit_logs add constraint test_audit_failure check(details->>'note' is distinct from 'FAIL')");
  assert.equal((await call('POST',`${base}/menus/${menu}/receive`,{quantity:1,note:'FAIL',request_id:randomUUID()})).statusCode,500);
  assert.equal(Number((await db.query('select stock_quantity from menus')).rows[0].stock_quantity),13.5);
  await db.query(`insert into audit_logs(restaurant_id,actor_user_id,action,target_id,details)
   select $1,$2,'menu.stock_adjustment',$3,'{"movement_type":"purchase","quantity":1,"before":0,"after":1}'::jsonb from generate_series(1,51)`,[restaurant,user.id,menu]);
  // A different restaurant's receipt must not enter totals or search results.
  await db.query(`insert into audit_logs(restaurant_id,action,details) values($1,'menu.stock_adjustment','{"movement_type":"purchase"}')`,[other]);
  list=(await call('GET',`${base}/menu-receipts`)).json();
  const second=(await call('GET',`${base}/menu-receipts?offset=50`)).json();
  assert.equal(list.total,53);assert.equal(list.receipts.length,50);assert.equal(second.receipts.length,3);
  assert.equal(new Set([...list.receipts,...second.receipts].map(r=>r.id)).size,53);
  assert.ok(list.receipts.some(r=>r.legacy));
  await db.query('delete from menus');
  list=(await call('GET',`${base}/menu-receipts?search=Invoice`)).json();
  assert.equal(list.receipts[0].menu_name,'Original product');
  console.log('PASS: receiving, retry deduplication, validation, authorization, tenant isolation, immutable snapshots, search, UTC+7 dates, rollback, legacy entries, pagination and deleted products.');
 } finally {await app.close();await db.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
