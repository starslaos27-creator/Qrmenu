const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../dist');
function patch(file, replacements) {
  const target = path.join(root, file);
  let source = fs.readFileSync(target, 'utf8');
  const backup = path.resolve(__dirname, '../../../../.local/staff-order-before', file);
  fs.mkdirSync(path.dirname(backup), {recursive:true});
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, source);
  for (const [from,to] of replacements) {
    if (!source.includes(from)) throw Error('Missing anchor: '+from);
    source = source.replace(from,to);
  }
  fs.writeFileSync(target, source);
}
patch('assets/index-BjXGGWCT.js', [
  ['import {RestaurantBackoffice}', 'import {StaffOrderPage} from "./staff-order-page.js";\nimport {RestaurantBackoffice}'],
  ['["home","backend","menu"', '["home","backend","order-menu","menu"'],
  ['n==="backend"?e.jsx(RestaurantBackoffice', 'n==="order-menu"?e.jsx(StaffOrderPage,{key:r.restaurant.id,restaurantId:r.restaurant.id}):n==="backend"?e.jsx(RestaurantBackoffice']
]);
patch('assets/restaurant-backoffice.js', [["'ราคา รูปภาพ หมวดหมู่ และสูตรอาหาร','menu'", "'เลือกโต๊ะ และสั่งอาหารให้ลูกค้า','order-menu'"]]);
patch('index.html', [['</head>', '  <link rel="stylesheet" href="/assets/staff-order-page.css?v=20260924">\n  </head>']]);
console.log('Backoffice food menu now opens staff ordering.');
