// Run with: npx tsx scripts/check-order-fees.mjs. All fixtures and schema changes roll back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { signAccessToken } from '../src/security/auth.ts';

const env=loadEnv();
const pool=new pg.Pool({connectionString:env.databaseUrl,ssl:env.databaseSsl?{rejectUnauthorized:env.databaseSslRejectUnauthorized}:undefined});
const db=await pool.connect();
process.env.ORDER_FEE_TEST_MODE='true';
const app=await createApp({...env,nodeEnv:'development'});
app.log.level='silent';
app.db={query:(...args)=>db.query(...args),connect:async()=>({query:(sql,params)=>db.query(sql==='begin'?'savepoint order_fee_test':sql==='commit'?'release savepoint order_fee_test':sql==='rollback'?'rollback to savepoint order_fee_test':sql,params),release(){}})};
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response('<strong>Date: 2025-01-01</strong><tr><td>USD 1-20 </td><td data-title="Sell Rates">22,663</td></tr>',{status:200});
await db.query('begin');
try {
  const present=(await db.query("select to_regclass('public.order_fee_requests') is not null as present")).rows[0].present;
  if(!present)await db.query(await readFile('migrations/0049_order_fee_requests.sql','utf8'));
  const testColumn=(await db.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='order_fee_requests' and column_name='is_test') as present")).rows[0].present;
  if(!testColumn)await db.query(await readFile('migrations/0050_order_fee_test_mode.sql','utf8'));
  const billLinks=(await db.query("select to_regclass('public.order_fee_request_bills') is not null as present")).rows[0].present;
  if(!billLinks)await db.query(await readFile('migrations/0051_order_fee_request_bills.sql','utf8'));
  const reverseStatus=(await db.query("select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='order_fee_requests'::regclass and conname='order_fee_requests_status_check'")).rows[0];
  if(!reverseStatus.definition.includes('reversed'))await db.query(await readFile('migrations/0052_order_fee_reversal.sql','utf8'));
  async function user(role){const row=(await db.query('insert into app_users(email) values($1) returning id,email',[`fee-test-${randomUUID()}@example.invalid`])).rows[0];if(role)await db.query('insert into app_admins(user_id,role,active) values($1,$2,true)',[row.id,role]);return {...row,token:await signAccessToken(env,row)};}
  const owner=await user(),other=await user(),admin=await user('support');
  const restaurant=(await db.query("insert into restaurants(user_id,name,currency_code) values($1,'Fee fixture','LAK') returning id",[owner.id])).rows[0].id;
  await db.query("insert into restaurant_members(restaurant_id,user_id,role) values($1,$2,'owner')",[restaurant,owner.id]);
  const zone=(await db.query("insert into table_zones(restaurant_id,name) values($1,'Test') returning id",[restaurant])).rows[0].id;
  const table=(await db.query('insert into tables(restaurant_id,zone_id,table_number) values($1,$2,1) returning id',[restaurant,zone])).rows[0].id;
  await db.query("insert into bill_payment_details(restaurant_id,table_id,receipt_number,payment_method,bill_total,cash_received,change_due,paid_at) values($1,$2,'FEE-TEST','cash',50000,50000,0,'2025-01-15T00:00:00Z')",[restaurant,table]);
  const call=(actor,method,url,payload,extra={})=>app.inject({method,url,headers:{authorization:`Bearer ${actor.token}`,...extra},payload});
  const base=`/api/restaurants/${restaurant}`;
  const summary=await call(owner,'GET',`${base}/pro-order-bills?from=2025-01-01&to=2025-01-31`);assert.equal(summary.statusCode,200,summary.body);assert.equal(summary.json().totalFee,'200');
  const adminSummaryUrl=`/api/admin/restaurants/${restaurant}/order-bills-summary?from=2025-01-01&to=2025-01-31`;
  assert.equal((await call(other,'GET',adminSummaryUrl)).statusCode,403);
  const adminSummary=await call(admin,'GET',adminSummaryUrl);assert.equal(adminSummary.statusCode,200,adminSummary.body);assert.equal(adminSummary.json().totalFee,'200');
  assert.equal((await call(admin,'GET','/api/admin/pro-exchange-rate')).json().rate,22663);
  assert.equal((await call(other,'GET',`${base}/order-fee-requests`)).statusCode,403);
  async function send(key,test=false) {const form=new FormData();form.set('requestKey',key);form.set('month','2025-01-01');form.set('end',test?'2025-01-15':'2025-01-31');form.set('test',String(test));form.set('feeLak','200');form.set('rateLak','22950');form.set('file',new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}),'slip.png');const req=new Request('http://local',{method:'POST',body:form});return call(owner,'POST',`${base}/order-fee-requests`,Buffer.from(await req.arrayBuffer()),{'content-type':req.headers.get('content-type')});}
  const key=randomUUID();const sent=await send(key);assert.equal(sent.statusCode,201,sent.body);const id=sent.json().request.id;
  assert.equal((await send(key)).statusCode,200);
  assert.equal((await send(randomUUID())).statusCode,409);
  const slip=await call(admin,'GET',`/api/admin/order-fee-requests/${id}/slip`);assert.equal(slip.statusCode,200);
  await db.query("update bill_payment_details set bill_total=60000,cash_received=60000 where receipt_number='FEE-TEST' and restaurant_id=$1",[restaurant]);
  const review=(status)=>call(admin,'POST',`/api/admin/order-fee-requests/${id}/review`,{status});
  const changed=await review('approved');assert.equal(changed.statusCode,409,changed.body);assert.equal(changed.json().error,'BILLS_CHANGED');
  assert.equal((await review('rejected')).statusCode,200);
  const again=await send(randomUUID());assert.equal(again.statusCode,201,again.body);
  assert.equal((await call(admin,'POST',`/api/admin/order-fee-requests/${again.json().request.id}/review`,{status:'approved'})).statusCode,200);
  const test=await send(randomUUID(),true);assert.equal(test.statusCode,201,test.body);
  await db.query("update order_fee_requests set created_at=clock_timestamp()+interval '1 second' where id=$1",[test.json().request.id]);
  const shops=await call(admin,'GET','/api/admin/restaurants?search=Fee%20fixture');assert.equal(shops.statusCode,200,shops.body);const shop=shops.json().restaurants.find(row=>row.id===restaurant);assert.equal(shop.order_fee_status,'pending');assert.equal(shop.order_fee_is_test,true);
  const testList=await call(owner,'GET',`${base}/order-fee-requests`);assert.equal(testList.json().testMode,true);assert.equal(testList.json().requests.find(row=>row.id===test.json().request.id).is_test,true);
  await db.query("insert into bill_payment_details(restaurant_id,table_id,receipt_number,payment_method,bill_total,cash_received,change_due,paid_at) values($1,$2,'FEE-NEW','cash',100000,100000,0,'2025-01-15T01:00:00Z')",[restaurant,table]);
  assert.equal((await call(admin,'POST',`/api/admin/order-fee-requests/${test.json().request.id}/review`,{status:'approved'})).statusCode,200);
  const newBills=await call(owner,'GET',`${base}/pro-order-bills?from=2025-01-01&to=2025-01-31`);assert.equal(newBills.json().count,1);assert.equal(newBills.json().totalFee,'300');
  const reverseUrl=`/api/admin/order-fee-requests/${test.json().request.id}/reverse`;
  assert.equal((await call(owner,'POST',reverseUrl,{reason:'mistake'})).statusCode,403);
  assert.equal((await call(admin,'POST',reverseUrl,{reason:''})).statusCode,400);
  assert.equal((await call(admin,'POST',reverseUrl,{reason:'mistake'})).statusCode,200);
  assert.equal((await call(admin,'POST',reverseUrl,{reason:'mistake'})).statusCode,409);
  const restored=await call(owner,'GET',`${base}/pro-order-bills?from=2025-01-01&to=2025-01-31`);assert.equal(restored.json().count,2);assert.equal(restored.json().totalFee,'500');
  assert.equal((await db.query("select count(*)::int as n from platform_admin_audit_logs where target_id=$1 and action='order_fee.reversed' and reason='mistake'",[test.json().request.id])).rows[0].n,1);
  async function sendAsAdmin(actor,key) {const form=new FormData();form.set('requestKey',key);form.set('month','2025-01-01');form.set('end','2025-01-15');form.set('test','true');form.set('feeLak','500');form.set('rateLak','22950');form.set('file',new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}),'slip.png');const req=new Request('http://local',{method:'POST',body:form});return call(actor,'POST',`/api/admin/restaurants/${restaurant}/order-fee-requests`,Buffer.from(await req.arrayBuffer()),{'content-type':req.headers.get('content-type')});}
  assert.equal((await sendAsAdmin(owner,randomUUID())).statusCode,403);
  const adminKey=randomUUID(),adminSent=await sendAsAdmin(admin,adminKey);assert.equal(adminSent.statusCode,201,adminSent.body);
  assert.equal((await sendAsAdmin(admin,adminKey)).statusCode,200);
  assert.equal((await sendAsAdmin(admin,randomUUID())).statusCode,409);
  assert.equal((await db.query("select count(*)::int as n from platform_admin_audit_logs where target_id=$1 and admin_user_id=$2 and action='order_fee.submitted_by_admin'",[adminSent.json().request.id,admin.id])).rows[0].n,1);
  process.stdout.write('Order-fee submission, permissions, duplicate prevention, changed-bill check and approval passed.\n');
} finally {globalThis.fetch=originalFetch;await db.query('rollback');await app.close();db.release();await pool.end();}
