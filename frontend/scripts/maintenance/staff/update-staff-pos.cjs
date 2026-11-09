const fs=require('fs');
const path=require('node:path');
const root=path.resolve(__dirname, '../../../dist/assets')+path.sep;
let customer=fs.readFileSync(root+'CustomerMenuPage-B97eVEYj.js','utf8');
customer=customer.replace('function Ce({cartScope="customer",onChooseTable,','function Ce({cartScope="customer",renderCart,onChooseTable,');
customer=customer.replace('children:[g.length>0&&e.jsx(we,','children:[renderCart&&renderCart({cart:j,add:p,remove:h,setNote:w,clear:M,totalQty:T,totalPrice:re,menus:f}),g.length>0&&e.jsx(we,');
fs.writeFileSync(root+'CustomerMenuPage-B97eVEYj.js',customer);
let old=fs.readFileSync(root+'staff-order-page.js','utf8');
let preview=old.slice(old.indexOf('function MenuPreview(')).replace('function MenuPreview({restaurantId,onChoose})','function MenuPreview({restaurantId,onChoose,renderCart})').replace("h(OrderMenuContent,{cartScope:","h(OrderMenuContent,{renderCart,cartScope:");
const page=`import {r as React} from './vendor-react-DCUvmuBu.js';
import {e as api,j as navigate} from './index-BjXGGWCT.js';
import {OrderMenuHeader,OrderMenuContent} from './CustomerMenuPage-B97eVEYj.js';
const h=React.createElement;
export function StaffOrderPage({restaurantId}) {
 return h('div',{className:'staff-order-page staff-pos'},h(MenuPreview,{restaurantId,onChoose:()=>{},renderCart:cart=>h(OrderPanel,{...cart,restaurantId})}));
}
function OrderPanel({restaurantId,cart,add,remove,setNote,clear,totalQty,totalPrice,menus}) {
 const [zones,Z]=React.useState([]),[tables,T]=React.useState([]),[zone,SZ]=React.useState(''),[label,SL]=React.useState(''),[mode,SM]=React.useState('eat'),[busy,SB]=React.useState(false),[message,SS]=React.useState('');
 const request=async(path,method,body)=>api('/api/restaurants/'+restaurantId+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 React.useEffect(()=>{let active=true;Promise.all([api('/api/restaurants/'+restaurantId+'/zones'),api('/api/restaurants/'+restaurantId+'/tables')]).then(([z,t])=>{if(active){Z(z.zones);T(t.tables);SZ(z.zones[0]?.id||'')}}).catch(()=>{if(active)SS('ໂຫຼດໂຊນ ແລະ ໂຕະບໍ່ສຳເລັດ')});return()=>{active=false}},[restaurantId]);
 async function submit(checkout){
  if(busy||!totalQty)return;
  if(!zone||!label.trim()){SS('ກະລຸນາເລືອກໂຊນ ແລະ ລະບຸເລກໂຕະ / ຊື່');return}
  SB(true);SS('');
  try{
   const name=label.trim();let table=tables.find(t=>t.zone_id===zone&&String(t.table_number)===name);
   if(!table){const result=await request('/tables','POST',{zone_id:zone,table_number:name});table=result.table;T(t=>[...t,table])}
   if(!table.is_open){await request('/tables/'+table.id,'PATCH',{is_open:true});T(all=>all.map(t=>t.id===table.id?{...t,is_open:true}:t))}
   await api('/api/public/orders',{method:'POST',auth:false,headers:{'Content-Type':'application/json'},body:JSON.stringify({tableCode:table.short_code,clientRequestId:crypto.randomUUID(),items:Object.values(cart).map(item=>({menu_id:item.menuId,qty:item.qty,note:[mode==='take'?'ຫໍ່ກັບບ້ານ (Takeaway)':'',item.note].filter(Boolean).join(' · ')}))})});
   clear();SS('ບັນທຶກບິນສຳເລັດ');if(checkout)navigate('/dashboard/bills');
  }catch{SS('ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່')}finally{SB(false)}
 }
 const money=value=>Number(value).toLocaleString('en-US')+' ກີບ';
 return h('aside',{className:'staff-pos-panel','aria-label':'ລາຍການສັ່ງ (Order)'},
  h('header',null,h('h2',null,'🛒 ລາຍການສັ່ງ (Order)'),h('button',{type:'button',onClick:clear,disabled:busy||!totalQty,className:'pos-clear'},'ລ້າງບິນ')),
  h('div',{className:'pos-modes'},...[['eat','🍽 ທານຢູ່ຮ້ານ (Eat-in)'],['take','🛍 ໃສ່ຖົງ (Takeaway)']].map(([id,text])=>h('button',{key:id,type:'button','aria-pressed':mode===id,onClick:()=>SM(id),disabled:busy},text))),
  h('div',{className:'pos-location'},h('label',null,'ໂຊນຮ້ານ',h('select',{value:zone,disabled:busy,onChange:e=>{SZ(e.target.value);SL('')}},h('option',{value:''},'ເລືອກໂຊນ'),...zones.map(z=>h('option',{key:z.id,value:z.id},z.name)))),
   h('label',null,'✏️ ເລກໂຕະ / ຊື່ (ລະບຸເພື່ອຈື່):',h('input',{value:label,disabled:busy,placeholder:'ໂຕະ 1 / VIP1',onChange:e=>SL(e.target.value)})),
   h('div',{className:'pos-tables'},...tables.filter(t=>t.zone_id===zone).map(t=>h('button',{type:'button',key:t.id,disabled:busy,'aria-pressed':label===String(t.table_number),onClick:()=>SL(String(t.table_number))},'ໂຕະ '+t.table_number)))),
  h('div',{className:'pos-items'},totalQty?Object.values(cart).map(item=>{const menu=menus.find(m=>m.id===item.menuId);if(!menu)return null;return h('article',{key:item.menuId},h('div',{className:'pos-item-title'},h('strong',null,menu.name),h('span',null,money(Number(menu.price)*item.qty))),h('div',{className:'pos-item-tools'},h('input',{'aria-label':'ໝາຍເຫດ '+menu.name,placeholder:'ໝາຍເຫດ (ເຊັ່ນ: ບໍ່ເຜັດ)',value:item.note||'',disabled:busy,onChange:e=>setNote(item.menuId,e.target.value)}),h('button',{type:'button',disabled:busy,onClick:()=>remove(item.menuId),'aria-label':'ຫຼຸດ '+menu.name},'−'),h('span',null,item.qty),h('button',{type:'button',disabled:busy,onClick:()=>add(item.menuId),'aria-label':'ເພີ່ມ '+menu.name},'+')))}):h('p',{className:'pos-empty'},'ຍັງບໍ່ມີລາຍການອາຫານ')),
  h('footer',null,h('div',null,h('span',null,'ຈຳນວນລາຍການ:'),h('span',null,totalQty+' ລາຍການ')),h('div',{className:'pos-total'},h('strong',null,'ລາຄາລວມ:'),h('strong',null,money(totalPrice))),message?h('p',{role:'status'},message):null,h('button',{type:'button',className:'pos-save',disabled:busy||!totalQty,onClick:()=>submit(false)},busy?'ກຳລັງບັນທຶກ…':'💾 ບັນທຶກບິນ (ຈ່າຍທີຫຼັງ)'),h('button',{type:'button',className:'pos-checkout',disabled:busy||!totalQty,onClick:()=>submit(true)},'✓ ເຊັກບິນ / ຊຳລະເງິນ →')));
}
`;
fs.writeFileSync(root+'staff-order-page.js',page+preview);
fs.appendFileSync(root+'staff-order-page.css',`\n/* Admin ordering panel */
.staff-pos .staff-order-catalog{position:relative;min-height:850px}.staff-pos .menu-sections{padding-right:calc(340px + 3rem)}.staff-pos .menu-order-bar{display:none!important}.staff-pos-panel{position:absolute;right:18px;top:230px;width:340px;background:#fcf7e9;border:1px solid #ddceb1;border-radius:18px;padding:16px;color:#174a34;box-shadow:0 5px 18px #174a340c}.staff-pos-panel header,.pos-item-title,.pos-item-tools,.staff-pos-panel footer>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.staff-pos-panel h2{font-weight:700;font-size:16px}.staff-pos-panel button{cursor:pointer;border-radius:9px;padding:8px}.staff-pos-panel button:disabled{opacity:.5;cursor:default}.staff-pos-panel input,.staff-pos-panel select{width:100%;min-width:0;border:1px solid #d9c7a6;background:#fffdf5;border-radius:9px;padding:9px;color:#174a34}.pos-clear{font-size:12px;color:#b63c32}.pos-modes{display:flex;gap:5px;margin:16px 0;background:#ede5d4;border-radius:12px;padding:4px}.pos-modes button{flex:1;font-size:12px}.pos-modes button[aria-pressed=true],.pos-tables button[aria-pressed=true]{background:#174a34;color:#fff}.pos-location{padding:12px;background:#f4ecdc;border-radius:12px}.pos-location label{display:grid;gap:6px;font-size:12px;margin-bottom:10px}.pos-tables{display:flex;flex-wrap:wrap;gap:5px;max-height:110px;overflow:auto}.pos-tables button{background:#e6dcc8;font-size:11px;padding:5px 8px}.pos-items{max-height:360px;overflow:auto;margin:16px 0}.pos-items article{border:1px solid #e4d7be;border-radius:12px;background:#fffaf1;padding:12px;margin-bottom:9px}.pos-item-title{font-size:13px;margin-bottom:10px}.pos-item-title span{color:#a76913;white-space:nowrap}.pos-item-tools input{font-size:11px;flex:1}.pos-item-tools button{background:#e9e0cc;padding:3px 8px}.pos-empty{text-align:center;padding:30px 8px;color:#897b64;font-size:13px}.staff-pos-panel footer{border-top:1px solid #decfb3;padding-top:14px;font-size:12px}.pos-total{margin:12px 0;font-size:18px}.pos-total strong:last-child{color:#ad7116}.staff-pos-panel footer>button{display:block;width:100%;margin-top:8px;font-weight:700;padding:12px}.pos-save{background:#078f73;color:white}.pos-checkout{background:#efb64d;color:#173c2f}.staff-pos-panel [role=status]{padding:8px 0}.staff-pos-panel :focus-visible{outline:2px solid #078f73;outline-offset:2px}@media(max-width:1100px){.staff-pos .menu-sections{padding-right:320px}.staff-pos-panel{width:290px;right:12px}}@media(max-width:760px){.staff-pos-panel{position:static;width:auto;margin:12px}.staff-pos .menu-sections{padding-right:20px}.staff-pos .staff-order-catalog{min-height:0}.pos-items{max-height:260px}}\n`);