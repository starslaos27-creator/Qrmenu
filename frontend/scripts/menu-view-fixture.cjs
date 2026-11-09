const names=['กุ้งแช่น้ำปลา','หอยนางรม (L)','ถั่วลิสง','ไข่ลวก 10 ฟอง','ลวกปลาในโขง 250 g','แซลมอนซาชิมิ 250 g'];
module.exports=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${['index-WsLlKfKj','menu-list-cards','menu-card-spacing','menu-view-switch','menu-category-ribbon'].map(n=>`<link rel="stylesheet" href="/assets/${n}.css">`).join('')}
<script type="module">
import {menuListFacts} from '/assets/menu-card-examples.js';
function element(tag, props) {
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(props)) {
    if(key==='children') { for(const child of [value].flat()) if(child!=null) node.append(child); }
    else if(value!=null) node.setAttribute(key==='className'?'class':key,value);
  }
  return node;
}
document.querySelectorAll('.menu-card-list-content > div:nth-child(2)').forEach((detail,i)=>{
  const menu={price:120000,cost_price:i===5?null:i===4?0:45000,track_stock:i!==3,stock_quantity:[20,2,0,0,1.5,8][i],low_alert_limit:3,unit:'จาน'};
  detail.insertBefore(menuListFacts({jsx:element,jsxs:element},menu,n=>'₭'+n.toLocaleString('en-US')),detail.lastElementChild);
});
</script>
<style>body{padding:24px;background:#efe7d8;color:#174a34}#fixture-editor{display:none}#fixture-root{display:block}.fixture-image{object-fit:cover;width:100%;height:100%}li{list-style:none}#root{max-width:1600px;margin:auto}</style>
<div id="root"><div class="grid" id="fixture-root"><div id="fixture-editor"><form id="menu-add-form"><input></form></div><div class="space-y-4">
<header>รายการสินค้า</header><div class="grid"><input type="text" aria-label="original search"><select aria-label="original category"><option value="all">ทั้งหมด</option><option value="food">อาหาร</option></select></div>
<section><div class="flex items-baseline justify-between border-b border-line/60 pb-1.5"><h3>อาหาร</h3><span>6 items</span></div><ul>${names.map((name,i)=>`<li><div class="menu-card-list-content"><div><img class="fixture-image" src="/images/menu-samples/${i%2?'oysters':'shrimp-fish-sauce'}.png" alt="${name}"></div><div class="min-w-0 flex-1 space-y-1"><button class="group/name flex" onclick="window.editCount=(window.editCount||0)+1">${name}</button><span class="menu-shared-description"><span class="menu-description-preview">อาหารสดใหม่พร้อมเครื่องเคียงและน้ำจิ้มรสเด็ด</span><button class="menu-description-open">ดูรายละเอียด</button></span><div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs"><span class="font-bold">₭120,000</span><span class="menu-stock-statuses"><span class="menu-stock-badge">คงเหลือ 20</span><span class="menu-stock-near-alert">ใกล้หมด 0</span></span><span class="text-line-vertical"></span><button>อาหาร ▾</button></div></div><div><label><input type="checkbox" checked aria-label="พร้อมขาย"></label><button aria-label="ลบสินค้า">ลบ</button></div></div></li>`).join('')}</ul></section>
</div></div></div><script>window.addEventListener('shopqr:adjust-menu-stock',()=>window.adjustOpened=true);document.querySelector('input[type=text]').addEventListener('input',e=>window.searchValue=e.target.value);</script><script defer src="/assets/menu-list-cards.js"></script>`;
