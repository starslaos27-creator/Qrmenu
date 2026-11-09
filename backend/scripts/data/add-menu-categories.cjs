require('dotenv').config({ quiet: true, path: require('node:path').resolve(__dirname, '../../.env') });
const { Client } = require('pg');
const restaurantId = '03e89b51-06ef-4c8d-b256-206e5008c3d1';
const categories = [
  ['ประเภทกับแกล้ม', 'ປະເພດກັບແກ້ມ', 'Appetizers'],
  ['ประเภทยำ', 'ປະເພດຍຳ', 'Spicy salads'],
  ['ประเภทสลัด', 'ປະເພດສະລັດ', 'Salads'],
  ['ประเภทตำ', 'ປະເພດຕຳ', 'Pounded salads'],
  ['ประเภทลาบและก้อย', 'ປະເພດລາບ ແລະ ກ້ອຍ', 'Larb and koi'],
  ['ประเภทปิ้งย่าง', 'ປະເພດປີ້ງ', 'Grilled dishes'],
  ['ประเภททอด', 'ປະເພດທອດ', 'Fried dishes'],
  ['ประเภทผัด', 'ປະເພດຜັດ', 'Stir-fried dishes'],
  ['ประเภทเอาะและอ่อม', 'ປະເພດເອາະ ແລະ ອ່ອມ', 'Lao stews'],
  ['ประเภทแกงและต้ม', 'ປະເພດແກງ ແລະ ຕົ້ມ', 'Curries and soups'],
  ['ประเภทนึ่ง', 'ປະເພດໜຶ້ງ', 'Steamed dishes'],
  ['ประเภทข้าว', 'ປະເພດເຂົ້າ', 'Rice'],
  ['น้ำดื่ม เบียร์ และอื่น ๆ', 'ນ້ຳດື່ມ ເບຍ ແລະ ອື່ນໆ', 'Water, beer and other drinks'],
  ['ชาและกาแฟ', 'ຊາ ແລະ ກາເຟ', 'Tea and coffee'],
  ['เบียร์', 'ເບຍ', 'Beer'],
  ['เหล้าและไวน์', 'ເຫຼົ້າ ແລະ ວາຍ', 'Spirits and wine'],
  ['ไอศกรีม', 'ກະແລມ', 'Ice cream'],
  ['ขนม', 'ເຂົ້າໜົມ', 'Desserts'],
  ['พิซซ่า', 'ພິຊຊ່າ', 'Pizza'],
  ['บริการด้านอาหารและเครื่องดื่ม', 'ບໍລິການດ້ານອາຫານ ແລະ ເຄື່ອງດື່ມ', 'Food and beverage services'],
  ['Bungalow & bar', 'Bungalow & bar', 'Bungalow & bar'],
];
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    const restaurant = await client.query('select name from restaurants where id = $1 for update', [restaurantId]);
    if (restaurant.rowCount !== 1) throw new Error('Target restaurant not found');
    const existing = await client.query('select name, name_lo, sort_order from categories where restaurant_id = $1', [restaurantId]);
    let sortOrder = Math.max(-1, ...existing.rows.map(row => row.sort_order)) + 1;
    let added = 0;
    for (const [name, nameLo, nameEn] of categories) {
      if (existing.rows.some(row => row.name === name || row.name_lo === nameLo || row.name === nameLo)) continue;
      await client.query('insert into categories (restaurant_id, name, name_lo, name_en, sort_order) values ($1, $2, $3, $4, $5)', [restaurantId, name, nameLo, nameEn, sortOrder++]);
      added++;
    }
    const result = await client.query('select name, name_lo, sort_order from categories where restaurant_id = $1 order by sort_order', [restaurantId]);
    for (const [name, nameLo] of categories) {
      if (!result.rows.some(row => row.name === name || row.name_lo === nameLo)) throw new Error('Category verification failed');
    }
    await client.query('commit');
    console.log(JSON.stringify({ restaurant: restaurant.rows[0].name, added, total: result.rowCount, categories: result.rows }, null, 2));
  } catch (error) { await client.query('rollback'); throw error; }
  finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
