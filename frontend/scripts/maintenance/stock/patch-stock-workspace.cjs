const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../../..');
function edit(file, transform) {
  const target = path.resolve(root, file);
  const source = fs.readFileSync(target, 'utf8');
  const result = transform(source);
  if (result === source) throw Error('No change: ' + file);
  const backup = path.resolve(root, '../.local/stock-workspace-before', file.replaceAll('../', ''));
  fs.mkdirSync(path.dirname(backup), {recursive:true});
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, source);
  fs.writeFileSync(target, result);
}
function replace(source, from, to) {
  if (!source.includes(from)) throw Error('Missing anchor: ' + from);
  return source.replace(from, to);
}
edit('src/components/Sidebar/manager-navigation.js', s => {
  s = replace(s, "items:[link('รายการเมนู','menu'),link('สูตรอาหาร'", "items:[link('สูตรอาหาร'");
  s = replace(s, "{label:'📦 สต็อก', items:[", "{label:'📦 สต็อก', items:[link('รายการสินค้า / ตรวจสต็อก','menu'),link('รับเข้าสินค้า','menu','receive'),");
  s = replace(s, "link('รับเข้าสินค้า','inventory','receive',stock)", "link('รับเข้าวัตถุดิบ','inventory','receive',stock)");
  s = replace(s, "if(location.pathname==='/dashboard/finance'", "if(location.pathname==='/dashboard/menu'||location.pathname==='/dashboard/finance'");
  return s;
});
edit('dist/assets/MenuPage-visible-20260913.js', s => {
  s = 'import {MenuStockReceive} from "./menu-stock-receive.js";\n' + s;
  s = replace(s, 'menuStockSummary(e,b)', 'e.jsx(MenuStockReceive,{restaurantId:o,menus:b,onReceived:menu=>w(items=>items.map(item=>item.id===menu.id?menu:item))}),menuStockSummary(e,b)');
  s = replace(s, 'title:d("page.menu.title"),description:d("page.menu.desc")', 'title:"สต็อกสินค้า",description:"เพิ่มสินค้า รับเข้าสินค้า และตรวจสอบยอดคงเหลือ"');
  s = replace(s, '[trackMenuStock,setTrackMenuStock]=l.useState(!1)', '[trackMenuStock,setTrackMenuStock]=l.useState(!0)');
  s = replace(s, 'setTrackMenuStock(!1)', 'setTrackMenuStock(!0)');
  return s;
});
edit('dist/assets/menu-list-cards.js', s => s
  .replace('🍔 MENU MANAGEMENT', '📦 STOCK MANAGEMENT')
  .replace('จัดการเมนูอาหาร &amp; ทำบิลเวลา', 'สต็อกสินค้า')
  .replace('เพิ่ม, แก้ไข, ลบ และปิดสถานะเมนูได้ในหน้าเดียว', 'เพิ่มสินค้า รับเข้า และตรวจยอดสต็อกได้ในหน้าเดียว')
  .replaceAll('เพิ่มเมนูใหม่', 'เพิ่มสินค้าใหม่')
  .replaceAll('ค้นหาเมนู', 'ค้นหาสินค้า'));
edit('dist/assets/menu-card-examples.js', s => {
  const start = s.indexOf('  const sample =');
  const end = s.indexOf('\n}\nexport function menuStockBadges', start);
  if (start < 0 || end < 0) throw Error('Missing example boundaries');
  s = s.slice(s.indexOf('export function menuExample'), start) + `  return {
    image: menu.image_url || null, description: menu.description || '',
    sampleDetails: false, sampleStock: false, tracked: !!menu.track_stock,
    quantity: Number(menu.stock_quantity) || 0, limit: Number(menu.low_alert_limit) || 0
  };` + s.slice(end);
  s = s.replace('if (!items.length) return null;', '');
  s = s.replaceAll("'เมนู'", "'รายการ'");
  return s;
});
edit('../backend/dist/src/routes/management.js', s => replace(s,
  'function registerMenuRoutes(app, env) {',
  `function registerMenuRoutes(app, env) {
    app.post("/api/restaurants/:restaurantId/menus/:resourceId/receive", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId))
            return access ? invalidId(reply) : undefined;
        const quantity = request.body?.quantity;
        if (!Number.isFinite(quantity) || quantity < 0.001 || quantity > 1000000000 ||
            Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.00001)
            return invalidBody(reply);
        const result = await app.db.query(\`update menus
            set stock_quantity = coalesce(stock_quantity, 0) + $3, track_stock = true
            where id = $1 and restaurant_id = $2 returning *\`,
            [request.params.resourceId, access.restaurantId, quantity]);
        if (!result.rows[0]) return reply.status(404).send({ok:false, error:"NOT_FOUND"});
        return reply.send({ok:true, menu:result.rows[0]});
    });`));
console.log('Stock workspace updated. Backups: .local/stock-workspace-before');
