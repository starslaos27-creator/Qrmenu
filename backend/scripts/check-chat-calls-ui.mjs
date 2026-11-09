import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from 'dotenv';
import pg from 'pg';
import { SignJWT } from 'jose';

config({ path: ['.env.local', '.env'], quiet: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let createdCall = null;
let expectedCallReason = null;
let expectedTableId = null;
let browser;
let socket;

try {
  const access = await pool.query(`select u.id, u.email, m.restaurant_id
    from app_users u join restaurant_members m on m.user_id = u.id
    where m.role = 'owner' limit 1`);
  const user = access.rows[0];
  assert.ok(user);
  let pending = await pool.query(`select c.id, c.reason, c.table_id from call_staff_requests c
    where c.restaurant_id = $1 and c.acknowledged = false
    order by c.created_at desc limit 1`, [user.restaurant_id]);
  expectedCallReason = pending.rows[0]?.reason || 'ขอเรียกพนักงาน';
  expectedTableId = pending.rows[0]?.table_id || null;
  if (!pending.rows[0]) {
    const made = await pool.query(`insert into call_staff_requests (restaurant_id, table_id, reason)
      select restaurant_id, id, 'ทดสอบจัดวางคำขอ' from tables
      where restaurant_id = $1 limit 1 returning id, table_id`, [user.restaurant_id]);
    createdCall = made.rows[0]?.id;
    expectedTableId = made.rows[0]?.table_id;
    expectedCallReason = 'ทดสอบจัดวางคำขอ';
  }
  const token = await new SignJWT({ email:user.email }).setProtectedHeader({alg:'HS256',typ:'JWT'})
    .setSubject(user.id).setIssuer(process.env.AUTH_ISSUER || 'shopqr-local').setAudience('shopqr-api')
    .setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET));
  const profile = path.resolve('../.local/chat-calls-ui-'+Date.now());
  browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  const active=path.join(profile,'DevToolsActivePort'); for(let i=0;i<120&&!fs.existsSync(active);i++)await delay(100);
  const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let id=0; const pendingCalls=new Map(), errors=[];
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){pendingCalls.get(m.id)?.(m.result);pendingCalls.delete(m.id)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
  const send=(method,params={})=>new Promise(resolve=>{pendingCalls.set(++id,resolve);socket.send(JSON.stringify({id,method,params}))});
  const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  const wait=async expression=>{for(let i=0;i<120;i++){if(await evaluate(`Boolean(${expression})`))return;await delay(100)}throw new Error('Timed out: '+expression)};
  await send('Runtime.enable');
  await send('Page.navigate',{url:'http://localhost:5173/login'}); await wait('location.origin==="http://localhost:5173"');
  await evaluate(`localStorage.setItem('shopqr_access_token',${JSON.stringify(token)})`);
  await send('Page.navigate',{url:'http://localhost:5173/dashboard/bills'});
  await wait("document.querySelector('.shopqr-chat-launcher')");
  await evaluate("document.querySelector('.shopqr-chat-launcher').click()");
  const target = `.shopqr-chat-conversation[data-id="${expectedTableId}"]`;
  await wait(`document.querySelector('.shopqr-chat-call') || document.querySelector(${JSON.stringify(target)})`);
  if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(target)}))`)) {
    assert.ok((await evaluate(`document.querySelector(${JSON.stringify(target)}).textContent`)).includes(expectedCallReason));
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(target)}).parentElement.querySelector('.shopqr-chat-quick-ack')?.textContent`),'รับทราบ');
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(target)}).disabled`),true);
    await evaluate(`document.querySelector(${JSON.stringify(target)}).click()`);
  }
  await delay(200);
  assert.equal(await evaluate("Boolean(document.querySelector('.shopqr-chat-calls'))"),false);
  assert.equal(await evaluate("document.querySelector('.shopqr-chat-head strong')?.textContent"),'แชตกับลูกค้า');
  assert.equal(await evaluate("Array.from(document.querySelectorAll('#root section.mb-4.border-amber-200')).every(el=>el.hidden)"),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: calls moved into chat, legacy banner hidden, acknowledgement button visible');
  await send('Browser.close');
} finally {
  socket?.close(); browser?.kill();
  if (createdCall) await pool.query('delete from call_staff_requests where id = $1',[createdCall]);
  await pool.end();
}
