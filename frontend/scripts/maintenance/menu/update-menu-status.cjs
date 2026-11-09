const fs = require('fs');
const path = require('path');
const root = path.join(__dirname,'../../../dist');
const files = ['assets/MenuPage-N38LKJ6t.js','assets/menu-list-cards.js','assets/menu-list-cards.css','index.html'];
const backup = path.join(__dirname,'../../../../.local/menu-status-before-'+Date.now());
fs.mkdirSync(backup,{recursive:true});
for(const file of files) fs.copyFileSync(path.join(root,file),path.join(backup,path.basename(file)));
const bundlePath = path.join(root,files[0]);
let bundle = fs.readFileSync(bundlePath,'utf8');
const start = bundle.indexOf('r.track_stock?e.jsxs("span",{className:`menu-stock-badge');
const end = bundle.indexOf(':null,e.jsx("span",{className:"text-line-vertical',start);
if(start<0 || end<0) throw Error('Stock markup not found');
bundle = bundle.slice(0,start) + 'r.track_stock?e.jsxs("span",{className:"menu-stock-statuses",children:[e.jsx("span",{className:"menu-stock-badge",children:"คงเหลือ "+(Number(r.stock_quantity)||0)}),Number(r.stock_quantity)>0&&Number(r.stock_quantity)<=Number(r.low_alert_limit)?e.jsx("span",{className:"menu-stock-near-alert",children:"สินค้าใกล้หมด"}):null,Number(r.stock_quantity)<=0?e.jsx("span",{className:"menu-stock-alert",children:"สินค้าหมด"}):null]})' + bundle.slice(end);
fs.writeFileSync(bundlePath,bundle);
const scriptPath = path.join(root,files[1]);
let script = fs.readFileSync(scriptPath,'utf8');
const a=script.indexOf('      // The compiled card');
const b=script.indexOf('\n    });',a);
if(a<0 || b<0) throw Error('Old stock decorator not found');
script=script.slice(0,a)+script.slice(b);
fs.writeFileSync(scriptPath,script);
fs.appendFileSync(path.join(root,files[2]),`\n/* Stock statuses are rendered by React and stacked on the right. */
.menu-card-list-content .menu-stock-statuses {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
#root .menu-card-list-content .menu-stock-statuses > span {
  position: static;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 25px;
  margin: 0;
  padding: 3px 8px;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  font-size: 11px !important;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
.menu-stock-near-alert { color: #9a6700; background: #fff8e8; border-color: #f0c46e; }
#root .menu-card-list-content > div:nth-child(2):has(.menu-stock-statuses) { padding-right: 108px; }
.menu-card-list-item { container-type: inline-size; }
@container (max-width: 370px) {
  #root .menu-card-list-content > div:nth-child(2):has(.menu-stock-statuses) { padding-right: 0; }
  .menu-card-list-content .menu-stock-statuses { top: 112px; }
  #root .menu-card-list-item > .menu-card-list-content:has(.menu-stock-statuses) { min-height: 242px; padding-bottom: 126px !important; }
}
`);
const htmlPath = path.join(root,'index.html');
let html=fs.readFileSync(htmlPath,'utf8').replace(/menu-list-cards\.(css|js)\?v=[^"\s]+/g,'menu-list-cards.$1?v=20260913-right-status');
fs.writeFileSync(htmlPath,html);
console.log('Updated stock layout; backup: '+backup);
