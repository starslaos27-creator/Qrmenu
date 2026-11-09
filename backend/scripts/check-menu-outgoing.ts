// All writes are isolated to PostgreSQL connection-local temporary tables.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {Client} from 'pg';
import {loadEnv} from '../src/config/env.js';
import {signAccessToken} from '../src/security/auth.js';
import {registerManagementRoutes} from '../src/routes/management.js';
import {registerOrderRoutes} from '../src/routes/orders.js';
import {outgoingCsv} from '../src/routes/menu-stock-export.js';
async function main(){
 const env=loadEnv(),db=new Client({connectionString:env.databaseUrl});await db.connect();
 const app=Fastify();app.decorate('db',{query:db.query.bind(db),connect:async()=>({query:db.query.bind(db),release(){}})});
 try{
  await db.query(`create temp table app_users(id uuid primary key,email text,display_name text,disabled_at timestamptz);
   create temp table restaurants(id uuid primary key,suspended_at timestamptz,service_charge_pct numeric default 0,vat_pct numeric default 0);
   create temp table restaurant_members(restaurant_id uuid,user_id uuid,role text);
   create temp table tables(id uuid primary key,restaurant_id uuid,table_number text,is_open boolean default true);
   create temp table menus(id uuid primary key,restaurant_id uuid,name text,stock_barcode text,unit text,stock_quantity numeric(14,3),track_stock boolean);
   create temp table orders(like public.orders including defaults including constraints);
   alter table orders add primary key(id);
   create temp table menu_inventory_components(menu_id uuid,inventory_item_id uuid,quantity numeric);
   create temp table stock_movements(like public.stock_movements including defaults);
   create temp table audit_logs(id uuid primary key default gen_random_uuid(),restaurant_id uuid,actor_user_id uuid,action text,target_id uuid,details jsonb,created_at timestamptz default now());
   create temp sequence receipt_number_seq;`);
  const user={id:randomUUID(),email:'outgoing-test@example.invalid'},rid=randomUUID(),other=randomUUID(),menu=randomUUID(),untracked=randomUUID(),table=randomUUID();
  await db.query('insert into app_users values($1,$2,$3,null)',[user.id,user.email,'Original operator']);
  await db.query('insert into restaurants(id) values($1),($2)',[rid,other]);
  await db.query("insert into restaurant_members values($1,$2,'owner')",[rid,user.id]);
  await db.query("insert into tables(id,restaurant_id,table_number) values($1,$2,'VIP1')",[table,rid]);
  await db.query("insert into menus values($1,$2,'Product','CODE','bottle',100,true),($3,$2,'Untracked',null,'plate',0,false)",[menu,rid,untracked]);
  await registerManagementRoutes(app,env);await registerOrderRoutes(app,env);
  const headers={authorization:`Bearer ${await signAccessToken(env,user)}`},base=`/api/restaurants/${rid}`;
  const call=(method:string,url:string,payload?:object)=>app.inject({method:method as any,url,headers,payload});
  const history=async query=>{const r=await call('GET',`${base}/menu-outgoing${query||''}`);assert.equal(r.statusCode,200,r.body);return r.json();};
  const order=async(items,receipt='TEST-BILL')=>{const id=randomUUID();await db.query('insert into orders(id,restaurant_id,table_id,items,total,receipt_number) values($1,$2,$3,$4,100,$5)',[id,rid,table,JSON.stringify(items),receipt]);return id;};
  const change=async(id,status)=>{const r=await call('PATCH',`${base}/orders/${id}/status`,{status});assert.equal(r.statusCode,200,r.body);};
  const stock=async()=>Number((await db.query('select stock_quantity from menus where id=$1',[menu])).rows[0].stock_quantity);
  const id=await order([{menu_id:menu,name:'Product',qty:2},{menu_id:menu,name:'Product',qty:3},{menu_id:untracked,name:'Untracked',qty:1}]);
  await change(id,'served');assert.equal(await stock(),95);
  await change(id,'served');assert.equal(await stock(),95);
  let list=await history('');assert.equal(list.total,1);let row=list.receipts[0];
  assert.equal(row.type,'sale');assert.equal(Number(row.quantity),5);assert.equal(Number(row.before),100);assert.equal(Number(row.after),95);assert.equal(row.order_id,id);assert.equal(row.table_name,'VIP1');assert.equal(row.paid,false);
  // Settlement after serving must neither deduct nor record the sale twice.
  let response=await call('POST',`${base}/tables/${table}/settle`,{payment_method:'cash'});assert.equal(response.statusCode,200,response.body);
  assert.equal(await stock(),95);assert.equal((await history('')).total,1);assert.equal((await history('')).receipts[0].paid,true);
  // Payment first, followed by serving, also consumes exactly once.
  const paidFirst=await order([{menu_id:menu,name:'Product',qty:2}],null);
  response=await call('POST',`${base}/tables/${table}/settle`,{payment_method:'cash'});assert.equal(response.statusCode,200,response.body);
  await change(paidFirst,'served');assert.equal(await stock(),93);assert.equal((await history('?type=sale')).total,2);
  assert.ok((await history('?type=sale')).receipts.find(r=>r.order_id===paidFirst).receipt_number.startsWith('BILL-'));
  // Simulate an imported ready order with stock already applied; cancellation restores only recorded products.
  const reversible=await order([{menu_id:menu,name:'Product',qty:1},{menu_id:untracked,name:'Untracked',qty:1}]);await change(reversible,'served');
  await db.query("update orders set status='ready' where id=$1",[reversible]);
  await change(reversible,'cancelled');await change(reversible,'cancelled');assert.equal(await stock(),93);
  assert.equal(Number((await db.query('select stock_quantity from menus where id=$1',[untracked])).rows[0].stock_quantity),0);
  assert.equal((await history('?type=sale_return')).total,1);
  assert.ok((await history('?type=sale')).receipts.find(r=>r.order_id===reversible).reversed);
  // No-tracked-product orders must not fall back to legacy or create stock on cancellation.
  const noStock=await order([{menu_id:untracked,name:'Untracked',qty:1}]);await change(noStock,'served');
  await db.query("update orders set status='ready' where id=$1",[noStock]);await change(noStock,'cancelled');assert.equal((await history('?type=legacy')).total,0);
  const issue=async(type,quantity,extra={})=>{const r=await call('POST',`${base}/menus/${menu}/stock-adjustments`,{request_id:randomUUID(),movement_type:type,quantity,note:'Manual test',...extra});assert.equal(r.statusCode,200,r.body);};
  await issue('issue',2);await issue('waste',1);await issue('return_out',1);await issue('adjustment',80,{expected_quantity:89});
  await issue('purchase',1);await issue('return_in',1);await issue('adjustment',85,{expected_quantity:82});
  assert.equal((await history('?type=issue')).total,1);assert.equal((await history('?type=adjustment')).receipts[0].quantity,'9');
  assert.equal((await history('')).total,8);
  await db.query("update menus set name='Renamed',unit='case',stock_barcode='CHANGED';update app_users set display_name='Renamed'");
  assert.ok((await history('')).receipts.every(r=>r.menu_name==='Product'&&r.unit==='bottle'&&r.actor_name==='Original operator'));
  assert.equal((await history('?search=TEST-BILL')).total,3);
  assert.equal((await history('?search=%25')).total,0);
  assert.equal((await call('GET',`${base}/menu-outgoing?from=2026-02-30`)).statusCode,400);
  assert.equal((await call('GET',`${base}/menu-outgoing?type=invalid`)).statusCode,400);
  assert.equal((await app.inject({method:'GET',url:`${base}/menu-outgoing`})).statusCode,401);
  assert.equal((await call('GET',`/api/restaurants/${other}/menu-outgoing`)).statusCode,403);
  await db.query("update restaurant_members set role='staff'");assert.equal((await call('GET',`${base}/menu-outgoing`)).statusCode,403);await db.query("update restaurant_members set role='owner'");
  // An audit insert failure rolls back order state and stock together.
  await db.query("alter table audit_logs add constraint test_failure check(action<>'menu.stock_sale') not valid");
  const failing=await order([{menu_id:menu,name:'Renamed',qty:1}]);response=await call('PATCH',`${base}/orders/${failing}/status`,{status:'served'});assert.equal(response.statusCode,500);
  assert.equal(await stock(),85);assert.equal((await db.query('select stock_applied_at from orders where id=$1',[failing])).rows[0].stock_applied_at,null);
  await db.query('alter table audit_logs drop constraint test_failure');
  await db.query("update audit_logs set created_at='2026-10-03T17:00:00Z' where action='menu.stock_sale'");
  assert.equal((await history('?type=sale&from=2026-10-04&to=2026-10-04')).total,3);
  assert.equal((await history('?type=sale&from=2026-10-03&to=2026-10-03')).total,0);
  const legacy=await order([{menu_id:menu,name:'Historic product',qty:4}]);await db.query('update orders set stock_applied_at=now() where id=$1',[legacy]);
  row=(await history('?type=legacy')).receipts[0];assert.equal(row.menu_name,'Historic product');assert.equal(row.before,null);assert.equal(row.actor_name,'ไม่ได้บันทึกผู้ตัดสต็อก');
  await db.query(`insert into audit_logs(restaurant_id,action,target_id,details) select $1,'menu.stock_adjustment',$2,'{"movement_type":"issue","quantity":1,"before":2,"after":1}'::jsonb from generate_series(1,51)`,[rid,menu]);
  await db.query(`insert into audit_logs(restaurant_id,action,target_id,details) values($1,'menu.stock_adjustment',$2,'{"movement_type":"issue","quantity":1}')`,[other,menu]);
  list=await history('');const second=await history('?offset=50');assert.equal(list.total,60);assert.equal(new Set([...list.receipts,...second.receipts].map(r=>r.id)).size,60);
  const exported=await history('?format=csv&offset=50');assert.equal(exported.total,60);assert.ok(exported.csv.startsWith('\ufeff'));assert.equal(exported.csv.split('\r\n').length,61);
  const filteredExport=await history('?format=csv&type=sale&from=2026-10-04&to=2026-10-04');assert.equal(filteredExport.total,3);assert.equal(filteredExport.csv.split('\r\n').length,4);assert.ok(filteredExport.csv.includes('2026-10-04 00:00:00'));
  const zeroExport=await history('?format=csv&search=does-not-exist');assert.equal(zeroExport.total,0);assert.equal(zeroExport.csv.split('\r\n').length,1);
  assert.equal((await call('GET',`${base}/menu-outgoing?format=xlsx`)).statusCode,400);
  assert.equal((await app.inject({method:'GET',url:`${base}/menu-outgoing?format=csv`})).statusCode,401);
  assert.equal((await call('GET',`/api/restaurants/${other}/menu-outgoing?format=csv`)).statusCode,403);
  const escaped=outgoingCsv([{id:'x',created_at:'2026-10-04T00:00:00Z',menu_name:' =1+1',note:'line,"quoted"\nnext',quantity:1,before:null,after:null,type:'legacy'}]);
  assert.ok(escaped.includes('"\' =1+1"'));assert.ok(escaped.includes('"line,""quoted""\nnext"'));assert.ok(escaped.includes('ออเดอร์เก่า (ข้อมูลจำกัด)'));
  assert.equal(exported.csv.split('\r\n')[0],'\ufeff"วันเวลา (UTC+7)","ประเภท","สินค้า","จำนวน","หน่วย","คงเหลือก่อน","คงเหลือหลัง","ผู้ทำรายการ","เลขบิล","โต๊ะ","สถานะชำระเงิน","สถานะออเดอร์","คืนสต็อกแล้ว","หมายเหตุ","เหตุผลยกเลิก"');
  await db.query('delete from menus');assert.equal((await history('?type=sale')).receipts[0].menu_name,'Product');
  console.log('PASS: sale on serving/payment, duplicate prevention, grouped quantities, cancellations, untracked products, manual reductions, snapshots, authorization, tenant isolation, rollback, UTC+7, legacy orders, pagination, full filtered CSV export and spreadsheet escaping.');
 }finally{await app.close();await db.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
