require('dotenv').config({ quiet: true, path: require('node:path').resolve(__dirname, '../../.env') });
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const restaurantId = '03e89b51-06ef-4c8d-b256-206e5008c3d1';
const categoryId = 'b66c9b6d-c561-42da-ae6d-4432b6e7a2bf';
const images = [
  ['สปริงโรลรวม', 'spring-rolls'],
  ['แซลมอนซาชิมิ 250 g', 'salmon-sashimi'],
  ['ลวกปลาน้ำโขง 250 g', 'mekong-fish'],
  ['ลวกทะเลรวม 250 g', 'mixed-seafood'],
  ['กุ้งแช่น้ำปลา', 'shrimp-fish-sauce'],
  ['หอยนางรม (L)', 'oysters'],
  ['ถั่วลิสง', 'peanuts'],
  ['ไข่ลวก 10 ฟอง', 'soft-boiled-eggs'],
];
async function main() {
  for (const [, slug] of images) {
    const file = path.resolve(__dirname, '../../../frontend/dist/images/menu-samples', `${slug}.png`);
    if (!fs.existsSync(file)) throw new Error(`Missing sample image: ${slug}`);
    const response = await fetch(`http://localhost:5173/images/menu-samples/${slug}.png`, { method: 'HEAD' });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Image not served: ${slug}`);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    for (const [name, slug] of images) {
      const url = `/images/menu-samples/${slug}.png`;
      const result = await client.query('update menus set image_url = $1, updated_at = now() where restaurant_id = $2 and category_id = $3 and name = $4 and (image_url is null or image_url = $1) returning id', [url, restaurantId, categoryId, name]);
      if (result.rowCount !== 1) throw new Error(`Menu missing or already has a different image: ${name}`);
    }
    await client.query('commit');
    console.log('Updated all 8 menu images; all image URLs respond with HTTP 200 and an image content type.');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
