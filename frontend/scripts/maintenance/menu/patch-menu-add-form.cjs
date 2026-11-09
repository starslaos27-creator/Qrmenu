// Compatibility patch for the compiled manager menu page.
// Source files are not included in this delivery, so keep edits anchored and repeatable.
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '../../../dist/assets/MenuPage-N38LKJ6t.js');
let text = fs.readFileSync(file, 'utf8');
const replace = (from, to) => {
  if (!text.includes(from)) throw new Error(`Missing bundle anchor: ${from.slice(0, 100)}`);
  text = text.replace(from, to);
};

replace(
  '[be,ve]=l.useState(""),[ce,me]=l.useState(!1)',
  '[be,ve]=l.useState(""),[ce,me]=l.useState(!1),[menuCost,setMenuCost]=l.useState(""),[menuDescription,setMenuDescription]=l.useState(""),[menuImageUrl,setMenuImageUrl]=l.useState(""),[trackMenuStock,setTrackMenuStock]=l.useState(!1),[stockQuantity,setStockQuantity]=l.useState(""),[stockBarcode,setStockBarcode]=l.useState(""),[stockLimit,setStockLimit]=l.useState(""),[menuAvailable,setMenuAvailable]=l.useState(!0)'
);
replace(
  'let j=null;if(A){const a=await Le({bucket:"menu-images",ownerId:o,file:A});',
  'let j=menuImageUrl.trim()||null;if(A){const a=await Le({bucket:"menu-images",ownerId:o,file:A});'
);
replace(
  'price:Number(q),image_url:j,available:!0})',
  'price:Number(q),cost_price:Number(menuCost)||0,description:menuDescription.trim()||null,track_stock:trackMenuStock,low_alert_limit:Number(stockLimit)||0,image_url:j,available:menuAvailable,stock_quantity:Number(stockQuantity)||0,stock_barcode:stockBarcode.trim()||null})'
);
replace(
  'F(""),E(""),P(""),K(""),G(null),Z(null),x(!1)',
  'F(""),E(""),P(""),K(""),G(null),Z(null),setMenuCost(""),setMenuDescription(""),setMenuImageUrl(""),setTrackMenuStock(!1),setStockQuantity(""),setStockBarcode(""),setStockLimit(""),setMenuAvailable(!0),x(!1)'
);

const extraFields = 'e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsx($,{label:"ราคาต้นทุน",children:e.jsx("input",{type:"number",min:"0",step:"0.01",value:menuCost,onChange:n=>setMenuCost(n.target.value),className:L,placeholder:"0.00"})}),e.jsx($,{label:"ราคาขาย",hint:"ราคาที่แสดงให้ลูกค้า",children:e.jsx("input",{type:"number",min:"0",step:"0.01",value:q,onChange:n=>K(n.target.value),required:!0,className:L,placeholder:"0.00"})})]}),e.jsx($,{label:"หมวดหมู่",hint:"เลือกหมวดหมู่เดิม หรือพิมพ์เพิ่มหมวดหมู่ใหม่",children:e.jsxs("button",{type:"button",onClick:()=>se(!0),className:`${L} flex items-center justify-between text-left`,children:[e.jsx("span",{className:B?"text-ink":"text-muted",children:B?(()=>{const n=de.get(B);return n?T(n,f):t("combobox.none")})():"เลือกหมวดหมู่ หรือพิมพ์เพื่อสร้างใหม่"}),e.jsx("span",{children:"⌄"})]})}),e.jsx($,{label:"ลิงก์รูปภาพ (URL)",hint:"วาง URL รูปภาพ หรืออัปโหลดไฟล์ด้านล่าง",children:e.jsx("input",{type:"url",value:menuImageUrl,onChange:n=>setMenuImageUrl(n.target.value),className:L,placeholder:"https://example.com/menu.jpg"})}),e.jsx($,{label:"รายละเอียดเมนู",children:e.jsx("textarea",{value:menuDescription,onChange:n=>setMenuDescription(n.target.value),className:`${L} min-h-24 resize-y`,placeholder:"อธิบายส่วนประกอบ รสชาติ หรือข้อมูลเพิ่มเติม"})}),e.jsxs("div",{className:"rounded-xl border border-line bg-canvas/35 p-3 space-y-3",children:[e.jsxs("label",{className:"flex cursor-pointer items-center gap-3",children:[e.jsx("input",{type:"checkbox",checked:trackMenuStock,onChange:n=>setTrackMenuStock(n.target.checked),className:"h-4 w-4 rounded border-line text-emerald-600 focus:ring-emerald-500"}),e.jsxs("span",{children:[e.jsx("span",{className:"block text-sm font-semibold text-ink",children:"ติดตามสต็อกสินค้า (Track Stock Inventory)"}),e.jsx("span",{className:"block text-xs text-muted",children:"เปิดใช้เพื่อบันทึกจำนวนสินค้าและจุดแจ้งเตือน"})]})]}),trackMenuStock?e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-3",children:[e.jsx($,{label:"จำนวนสินค้า",children:e.jsx("input",{type:"number",min:"0",step:"1",value:stockQuantity,onChange:n=>setStockQuantity(n.target.value),className:L,placeholder:"0"})}),e.jsx($,{label:"บาร์โค้ด / Serial",children:e.jsx("input",{type:"text",value:stockBarcode,onChange:n=>setStockBarcode(n.target.value),className:L,placeholder:"สแกนหรือพิมพ์รหัส"})}),e.jsx($,{label:"แจ้งสินค้าใกล้หมด",children:e.jsx("input",{type:"number",min:"0",step:"1",value:stockLimit,onChange:n=>setStockLimit(n.target.value),className:L,placeholder:"0"})})]}):null]}),e.jsxs("label",{className:"flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface px-3 py-3",children:[e.jsxs("span",{children:[e.jsx("span",{className:"block text-sm font-semibold text-ink",children:"พร้อมขาย (Available for ordering)"}),e.jsx("span",{className:"block text-xs text-muted",children:"ลูกค้าจะเห็นและสั่งเมนูนี้ได้"})]}),e.jsx("input",{type:"checkbox",checked:menuAvailable,onChange:n=>setMenuAvailable(n.target.checked),className:"h-5 w-5 rounded border-line text-emerald-600 focus:ring-emerald-500"})]})';

const priceStart = text.indexOf('e.jsx($,{label:t("mgr.menu.price")');
const imageStart = text.indexOf('e.jsxs($,{label:t("mgr.menu.image")', priceStart);
if (priceStart < 0 || imageStart < 0) throw new Error('Menu price/image anchors not found');
text = text.slice(0, priceStart) + extraFields + ',' + text.slice(imageStart);
fs.writeFileSync(file, text);
console.log('Menu add form patched.');
