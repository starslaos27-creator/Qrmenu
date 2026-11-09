require('dotenv').config({ quiet: true, path: require('node:path').resolve(__dirname, '../../.env') });
const { Client } = require('pg');
const restaurantId = '03e89b51-06ef-4c8d-b256-206e5008c3d1';
const categoryId = 'b66c9b6d-c561-42da-ae6d-4432b6e7a2bf';
const menus = [
  ['สปริงโรลรวม', 'ສະປຣິງລວມ', 129000],
  ['แซลมอนซาชิมิ 250 g', 'ແຊວມອນຊາຊິມິ 250 g', 230000],
  ['ลวกปลาน้ำโขง 250 g', 'ລວກປານ້ຳຂອງ 250 g', 165000],
  ['ลวกทะเลรวม 250 g', 'ລວກທະເລລວມ 250 g', 140000],
  ['กุ้งแช่น้ำปลา', 'ກຸ້ງແຊ່ນ້ຳປາ', 120000],
  ['หอยนางรม (L)', 'ຫອຍນາງລົມ (L)', 75000],
  ['ถั่วลิสง', 'ຖົ່ວດິນ', 55000],
  ['ไข่ลวก 10 ฟอง', 'ລວກໄຂ່ 10 ໜ່ວຍ', 95000],
];
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    const category = await client.query('select name from categories where id = $1 and restaurant_id = $2 for update', [categoryId, restaurantId]);
    if (category.rowCount !== 1) throw new Error('Target category not found');
    let added = 0;
    for (const [name, nameLo, price] of menus) {
      const existing = await client.query('select id from menus where restaurant_id = $1 and (name = $2 or name_lo = $3)', [restaurantId, name, nameLo]);
      if (existing.rowCount) throw new Error(`Menu already exists; review before changing: ${name}`);
      await client.query('insert into menus (restaurant_id, category_id, name, name_lo, price) values ($1, $2, $3, $4, $5)', [restaurantId, categoryId, name, nameLo, price]);
      added++;
    }
    const saved = await client.query('select name, name_lo, price from menus where restaurant_id = $1 and category_id = $2 order by created_at, name', [restaurantId, categoryId]);
    for (const [name, nameLo, price] of menus) {
      if (!saved.rows.some(row => row.name === name && row.name_lo === nameLo && Number(row.price) === price)) throw new Error('Saved menu verification failed');
    }
    await client.query('commit');
    console.log(JSON.stringify({ category: category.rows[0].name, added, menus: saved.rows }, null, 2));
  } catch (error) { await client.query('rollback'); throw error; }
  finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
