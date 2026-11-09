const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const local = path.resolve(__dirname, '../../../.local');
const envFile = path.join(__dirname, '../../.env');
async function main() {
  if (fs.existsSync(envFile)) throw new Error('Existing .env found; refusing to overwrite');
  const password = crypto.randomBytes(32).toString('hex');
  const secret = crypto.randomBytes(48).toString('hex');
  const adminPassword = fs.readFileSync(path.join(local, 'postgres-password'), 'utf8').trim();
  const client = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: adminPassword, database: 'postgres' });
  await client.connect();
  try {
    await client.query(`CREATE ROLE shopqr_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    await client.query('CREATE DATABASE shopqr OWNER shopqr_app');
    fs.writeFileSync(envFile, [
      'NODE_ENV=development', 'HOST=127.0.0.1', 'PORT=4000',
      'CORS_ORIGIN=http://localhost:5173,http://localhost:5174',
      `DATABASE_URL=postgresql://shopqr_app:${password}@127.0.0.1:5432/shopqr`,
      'DATABASE_SSL=false', `AUTH_JWT_SECRET=${secret}`, 'AUTH_ISSUER=shopqr',
      'AUTH_COOKIE_SECURE=false', 'IMAGE_STORAGE_DRIVER=r2', ''
    ].join('\n'), { flag: 'wx' });
    console.log('Created shopqr database, application role, and backend/.env');
  } finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
