// Run with npx tsx scripts/check-pro-cancellation.mjs. All fixtures and schema changes roll back.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createApp} from '../src/app.ts';
import {loadEnv} from '../src/config/env.ts';
import {signAccessToken} from '../src/security/auth.ts';
const env=loadEnv();const pool=new pg.Pool({connectionString:env.databaseUrl,ssl:env.databaseSsl?{rejectUnauthorized:env.databaseSslRejectUnauthorized}:undefined});const db=await pool.connect();const app=await createApp({...env,databaseUrl:null});app.log.level='silent';
app.db={query:(...args)=>db.query(...args),connect:async()=>({query:(sql,params)=>db.query(sql==='begin'?'savepoint cancel_test':sql==='commit'?'release savepoint cancel_test':sql==='rollback'?'rollback to savepoint cancel_test':sql,params),release(){}})};
await db.query('begin');
try {
  const present=(await db.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='pro_requests' and column_name='cancelled_at') as present")).rows[0].present;
  if(!present)await db.query(await readFile('migrations/0053_pro_package_cancellation.sql','utf8'));
  async function user(role){const row=(await db.query('insert into app_users(email) values($1) returning id,email',[`cancel-test-${randomUUID()}@example.invalid`])).rows[0];if(role)await db.query('insert into app_admins(user_id,role,active) values($1,$2,true)',[row.id,role]);return {...row,token:await signAccessToken(env,row)};}
  const owner=await user(),admin=await user('support'),viewer=await user('viewer');
  const restaurant=(await db.query("insert into restaurants(user_id,name) values($1,'Cancel fixture') returning id",[owner.id])).rows[0].id;
  await db.query("insert into restaurant_members(restaurant_id,user_id,role) values($1,$2,'owner')",[restaurant,owner.id]);
  await db.query("insert into restaurant_pro_trials(restaurant_id,starts_at,expires_at) values($1,clock_timestamp(),clock_timestamp()+interval '5 days')",[restaurant]);
  const request=(await db.query("insert into pro_requests(request_key,restaurant_id,requested_by,paid_months,free_months,monthly_usd,total_usd,status,reviewed_by,reviewed_at) values($1,$2,$3,1,0,10,10,'approved',$4,clock_timestamp()) returning id",[randomUUID(),restaurant,owner.id,admin.id])).rows[0].id;
  const call=(actor,method,url,payload)=>app.inject({method,url,headers:{authorization:`Bearer ${actor.token}`},payload});
  const url=`/api/admin/pro-requests/${request}/cancel`;
  assert.equal((await call(viewer,'POST',url,{reason:'mistake'})).statusCode,403);
  assert.equal((await call(admin,'POST',url,{reason:''})).statusCode,400);
  const before=await call(owner,'GET',`/api/restaurants/${restaurant}/pro-countdown`);assert.equal(before.statusCode,200,before.body);assert.equal(before.json().trial_active,false);
  assert.equal((await call(admin,'POST',url,{reason:'approved in error'})).statusCode,200);
  assert.equal((await call(admin,'POST',url,{reason:'again'})).statusCode,409);
  const after=await call(owner,'GET',`/api/restaurants/${restaurant}/pro-countdown`);assert.equal(after.json().trial_active,true);
  const row=(await db.query('select status,total_usd,cancelled_by from pro_requests where id=$1',[request])).rows[0];assert.equal(row.status,'approved');assert.equal(Number(row.total_usd),10);assert.equal(row.cancelled_by,admin.id);
  assert.equal((await db.query("select count(*)::int as n from platform_admin_audit_logs where target_id=$1 and action='pro_package.cancelled'",[request])).rows[0].n,1);
  process.stdout.write('Cancellation permissions, expiry, trial restoration and audit passed.\n');
}finally{await db.query('rollback');await app.close();db.release();await pool.end();}
