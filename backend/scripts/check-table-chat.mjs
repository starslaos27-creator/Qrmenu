import assert from 'node:assert/strict';
import { config } from 'dotenv';
import pg from 'pg';
import { SignJWT } from 'jose';

config({ path: ['.env.local', '.env'], quiet: true });
const base = 'http://127.0.0.1:4000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const created = [];

async function json(url, options = {}) {
  const response = await fetch(base + url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${body.error || ''}`);
  return body;
}

try {
  const tableResult = await pool.query(`select t.id, t.restaurant_id, t.short_code
    from tables t where t.is_open = true and t.short_code is not null limit 1`);
  const table = tableResult.rows[0];
  assert.ok(table, 'An open table is required');
  const userResult = await pool.query(`select u.id, u.email from app_users u
    join restaurant_members m on m.user_id = u.id
    where m.restaurant_id = $1 and m.role in ('owner','waiter','staff') limit 1`, [table.restaurant_id]);
  const user = userResult.rows[0];
  assert.ok(user, 'A staff member is required');
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id).setIssuer(process.env.AUTH_ISSUER || 'shopqr-local')
    .setAudience('shopqr-api').setIssuedAt().setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET));
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const marker = `ทดสอบแชต ${Date.now()}`;
  const customer = await json(`/api/public/chat/${table.short_code}`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({message: marker})
  });
  created.push(customer.message.id);
  const list = await json(`/api/restaurants/${table.restaurant_id}/chat`, {headers: auth});
  assert.equal(list.conversations.find(item => item.table_id === table.id)?.last_message, marker);
  const replyText = `ตอบกลับ ${Date.now()}`;
  const staff = await json(`/api/restaurants/${table.restaurant_id}/chat/${table.id}`, {
    method: 'POST', headers: auth, body: JSON.stringify({message: replyText})
  });
  created.push(staff.message.id);
  const publicThread = await json(`/api/public/chat/${table.short_code}?read=true`);
  assert.ok(publicThread.messages.some(item => item.message === replyText && item.sender === 'staff'));
  console.log('PASS: customer message, staff inbox, staff reply, customer receipt');
} finally {
  if (created.length) await pool.query('delete from table_chat_messages where id = any($1::uuid[])', [created]);
  await pool.end();
}
