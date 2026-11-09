// Integration checks against the configured PostgreSQL; all fixtures roll back.
// Run from backend after npm run build and npm run db:migrate.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../build/app.js';
import { loadEnv } from '../build/config/env.js';
import { signAccessToken } from '../build/security/auth.js';

const env = loadEnv();
const pool = new pg.Pool({connectionString:env.databaseUrl,ssl:env.databaseSsl?{rejectUnauthorized:env.databaseSslRejectUnauthorized}:undefined});
const db = await pool.connect();
const app = await createApp({...env,databaseUrl:null});
app.log.level = 'silent';
app.db = {
  query: (...args) => db.query(...args),
  connect: async () => ({
    query: (sql,params) => db.query(sql === 'begin' ? 'savepoint pro_test' : sql === 'commit' ? 'release savepoint pro_test' : sql === 'rollback' ? 'rollback to savepoint pro_test' : sql,params),
    release() {},
  }),
};
await db.query('begin');
try {
  async function user(role) {
    const email=`pro-test-${randomUUID()}@example.invalid`;
    const row=(await db.query('insert into app_users(email) values($1) returning id,email',[email])).rows[0];
    if(role) await db.query('insert into app_admins(user_id,role,active) values($1,$2,true)',[row.id,role]);
    return {...row,token:await signAccessToken(env,row)};
  }
  const owner=await user(), stranger=await user(), admin=await user('support'), viewer=await user('viewer'), staff=await user();
  const restaurant=(await db.query("insert into restaurants(user_id,name) values($1,'Pro integration fixture') returning id",[owner.id])).rows[0].id;
  await db.query("insert into restaurant_members(restaurant_id,user_id,role) values($1,$2,'owner'),($1,$3,'staff')",[restaurant,owner.id,staff.id]);
  const url=`/api/restaurants/${restaurant}/pro-requests`;
  const countdownUrl=`/api/restaurants/${restaurant}/pro-countdown`;
  async function call(actor,method,url,payload) {
    return app.inject({method,url,headers:actor?{authorization:`Bearer ${actor.token}`}:{},payload});
  }
  const pricingUrl='/api/admin/pro-pricing';
  const hoursUrl=`/api/restaurants/${restaurant}/weekly-hours`;
  const hours={enabled:true,days:Array.from({length:7},(_,day)=>({day,enabled:false,slots:Array.from({length:4},()=>({enabled:false,start:'08:00',end:'12:00'}))}))};
  const originalHours=(await call(owner,'GET',hoursUrl)).json();assert.equal(originalHours.version,0);
  assert.equal((await call(staff,'PUT',hoursUrl,{schedule:hours,version:0})).statusCode,403);
  assert.equal((await call(stranger,'GET',hoursUrl)).statusCode,403);
  assert.equal((await call(owner,'PUT',hoursUrl,{schedule:{enabled:true,days:[]},version:0})).statusCode,400);
  const savedHours=await call(owner,'PUT',hoursUrl,{schedule:hours,version:0});assert.equal(savedHours.statusCode,200,savedHours.body);
  assert.deepEqual((await call(owner,'GET',hoursUrl)).json().schedule,hours);
  assert.equal((await call(owner,'PUT',hoursUrl,{schedule:hours,version:0})).statusCode,409);
  assert.equal((await call(owner,'PUT',hoursUrl,{schedule:{...hours,enabled:false},version:1})).statusCode,200);
  const initial=(await call(admin,'GET',pricingUrl)).json();
  for(const actor of [owner,viewer]) assert.equal((await call(actor,'PUT',pricingUrl,{monthlyUsd:'10.00',version:initial.version})).statusCode,403);
  assert.equal((await call(admin,'PUT',pricingUrl,{monthlyUsd:'0',version:initial.version})).statusCode,400);
  const configured=await call(admin,'PUT',pricingUrl,{monthlyUsd:'10.00',version:initial.version});assert.equal(configured.statusCode,200,configured.body);
  assert.equal((await call(admin,'PUT',pricingUrl,{monthlyUsd:'12.00',version:initial.version})).statusCode,409);
  assert.equal((await call(null,'GET','/api/pro-pricing')).json().monthly_usd,'10.00');
  assert.equal((await call(null,'GET',url)).statusCode,401);
  for(const actor of [stranger,staff]) assert.equal((await call(actor,'GET',url)).statusCode,403);
  assert.equal((await call(stranger,'GET',countdownUrl)).statusCode,403);
  assert.equal((await call(owner,'GET',countdownUrl)).json().expires_at,null);
  const payload={requestKey:randomUUID(),paidMonths:6,monthlyUsd:'10.00'};
  assert.equal((await call(owner,'POST',url,{...payload,monthlyUsd:'1.00'})).json().error,'PRICE_CHANGED');
  assert.equal((await call(owner,'POST',url,{...payload,paidMonths:2})).statusCode,400);
  assert.equal((await call(owner,'POST',url,{...payload,monthlyUsd:'-1'})).statusCode,400);
  assert.equal((await call(owner,'POST',url,{...payload,monthlyUsd:'10.001'})).statusCode,400);
  const sent=await call(owner,'POST',url,payload);
  assert.equal(sent.statusCode,201,sent.body);
  const row=sent.json().request;
  const changed=await call(admin,'PUT',pricingUrl,{monthlyUsd:'12.00',version:configured.json().version});assert.equal(changed.statusCode,200,changed.body);
  assert.equal((await call(owner,'GET',url)).json().requests[0].total_usd,'60.00');
  assert.equal(row.status,'pending');assert.equal(row.free_months,1);assert.equal(row.total_usd,'60.00');
  assert.equal((await call(owner,'GET',countdownUrl)).json().expires_at,null);
  const replay=await call(owner,'POST',url,payload);assert.equal(replay.statusCode,200);assert.equal(replay.json().request.id,row.id);
  assert.equal((await call(owner,'POST',url,{...payload,monthlyUsd:'12.00'})).statusCode,409);
  assert.equal((await call(owner,'POST',url,{...payload,requestKey:randomUUID()})).statusCode,409);
  assert.equal((await call(owner,'GET','/api/admin/pro-requests')).statusCode,403);
  const review=`/api/admin/pro-requests/${row.id}/review`;
  assert.equal((await call(viewer,'POST',review,{status:'approved'})).statusCode,403);
  assert.equal((await call(owner,'POST',review,{status:'approved'})).statusCode,403);
  const approved=await call(admin,'POST',review,{status:'approved',note:'History only'});
  assert.equal(approved.statusCode,200,approved.body);assert.equal(approved.json().request.reviewed_by,admin.id);
  const countdown=(await call(staff,'GET',countdownUrl)).json();
  assert.equal(Date.parse(countdown.expires_at)-Date.parse(countdown.approved_at),30*86400000);
  assert.ok(Date.parse(countdown.expires_at)>Date.parse(countdown.server_now));
  assert.equal((await call(admin,'POST',review,{status:'approved'})).statusCode,200);
  assert.equal((await call(admin,'POST',review,{status:'rejected'})).statusCode,409);
  const audit=await db.query('select * from platform_admin_audit_logs where target_id=$1',[row.id]);assert.equal(audit.rowCount,1);assert.equal(audit.rows[0].action,'pro_request.approved');
  const history=(await call(owner,'GET',url)).json().requests;assert.equal(history[0].status,'approved');assert.equal(history[0].reviewer_email,admin.email);
  assert.equal((await call(admin,'GET','/api/admin/pro-requests?status=invalid')).statusCode,400);
  assert.equal((await call(admin,'GET','/api/admin/pro-requests?status=pending')).statusCode,200);
  const blocked=await call(owner,'POST',url,{...payload,requestKey:randomUUID(),paidMonths:12,monthlyUsd:'12.00'});
  assert.equal(blocked.statusCode,409);assert.equal(blocked.json().error,'PRO_ACTIVE');
  assert.equal((await call(owner,'GET',url)).json().requests.length,1);
  await db.query("update pro_requests set reviewed_at=now()-interval '31 days' where id=$1",[row.id]);
  const previousDeadline=(await call(owner,'GET',countdownUrl)).json().expires_at;
  assert.equal((await call(owner,'POST',url,{...payload,requestKey:randomUUID(),paidMonths:12})).json().error,'PRICE_CHANGED');
  const next=await call(owner,'POST',url,{...payload,requestKey:randomUUID(),paidMonths:12,monthlyUsd:'12.00'});assert.equal(next.statusCode,201,next.body);
  const second=next.json().request;assert.equal(second.free_months,2);assert.equal(second.total_usd,'144.00');
  assert.equal((await call(admin,'POST',`/api/admin/pro-requests/${second.id}/review`,{status:'rejected',note:'Review fixture'})).statusCode,200);
  assert.equal((await call(owner,'GET',countdownUrl)).json().expires_at,previousDeadline);
  await db.query("update pro_requests set reviewed_at=now()-interval '31 days' where id=$1",[row.id]);
  const expired=(await call(owner,'GET',countdownUrl)).json();assert.ok(Date.parse(expired.expires_at)<Date.parse(expired.server_now));
  const final=(await call(owner,'GET',url)).json().requests;assert.equal(final.length,2);
  console.log('PASS: ownership, admin permissions, pending deduplication, retry idempotency, USD snapshots, approval/rejection, immutable reviews, audit and customer history. Fixtures rolled back.');
} finally {
  await db.query('rollback');
  await app.close();
  db.release();await pool.end();
}
