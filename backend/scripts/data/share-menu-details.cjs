const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({ quiet: true, path: require('node:path').resolve(__dirname, '../../.env') });
(async () => {
  const { menuExample } = await import('../../../frontend/dist/assets/menu-card-examples.js');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('begin');
    const { rows } = await db.query('select * from menus where restaurant_id=$1 for update', ['03e89b51-06ef-4c8d-b256-206e5008c3d1']);
    const backup = path.resolve(__dirname, '../../../.local/shared-menu-details');
    fs.mkdirSync(backup, { recursive: true });
    fs.writeFileSync(path.join(backup, `before-${Date.now()}.json`), JSON.stringify(rows, null, 2));
    let count = 0;
    for (const menu of rows) {
      const data = menuExample(menu);
      if ((!menu.description && data.description) || (!menu.image_url && data.image)) {
        await db.query('update menus set description=$1, image_url=$2, updated_at=now() where id=$3 and restaurant_id=$4', [menu.description || data.description || null, menu.image_url || data.image || null, menu.id, menu.restaurant_id]);
        count++;
      }
    }
    await db.query('commit');
    console.log(`Saved shared images/descriptions for ${count} menus. Existing details, prices and stock preserved.`);
  } catch (error) { await db.query('rollback'); throw error; }
  finally { await db.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
