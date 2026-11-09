const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '../../../dist');
const backup = path.join(__dirname, '../../../../.local/show-menu-status-' + Date.now());
fs.mkdirSync(backup, { recursive: true });
function save(name, content) {
  const file = path.join(root, name);
  fs.copyFileSync(file, path.join(backup, path.basename(name)));
  fs.writeFileSync(file, content);
}
const menu = 'assets/MenuPage-N38LKJ6t.js';
let source = fs.readFileSync(path.join(root, menu), 'utf8');
const anchor = 'className:"flex items-center gap-4 p-3.5",children:[e.jsx("div",{className:`relative h-16';
if (!source.includes(anchor)) throw Error('Card anchor not found');
source = source.replace(anchor, 'className:"menu-card-list-content flex items-center gap-4 p-3.5",children:[e.jsx("div",{className:`relative h-16');
const a = source.indexOf('e.jsxs("span",{className:"menu-stock-statuses"');
const b = source.indexOf(',e.jsx("span",{className:"text-line-vertical', a);
const e = { jsx: (tag, props) => props, jsxs: (tag, props) => props };
for (const r of [{track_stock:false,stock_quantity:0,low_alert_limit:5},{track_stock:true,stock_quantity:3,low_alert_limit:5}]) {
  const status = vm.runInNewContext(source.slice(a,b), {e,r});
  if (status.children[0].children !== 'คงเหลือ ' + r.stock_quantity || status.children[1].children !== 'สินค้าใกล้หมด 5') throw Error('Missing stock labels');
  if ((status.children[2] !== null) !== (r.stock_quantity === 0)) throw Error('Incorrect empty status');
}
save(menu, source);
// Give the lazy-loaded menu a new URL so an already cached bundle cannot hide the update.
const entry = 'assets/index-BjXGGWCT.js';
let main = fs.readFileSync(path.join(root, entry), 'utf8');
if (!main.includes('MenuPage-N38LKJ6t.js')) throw Error('Menu import not found');
main = main.replaceAll('MenuPage-N38LKJ6t.js', 'MenuPage-visible-20260913.js');
fs.writeFileSync(path.join(root,'assets/MenuPage-visible-20260913.js'),source);
save(entry, main);
const html = fs.readFileSync(path.join(root,'index.html'),'utf8')
  .replace('/assets/index-BjXGGWCT.js"','/assets/index-BjXGGWCT.js?v=visible-stock-2"')
  .replaceAll('v=20260913-right-status','v=visible-stock-2');
save('index.html',html);
console.log('Verified labels with stock tracking on/off and quantities 0/3. Updated menu import and page cache versions.');
