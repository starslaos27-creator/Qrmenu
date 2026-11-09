import {r as React} from './vendor-react-DCUvmuBu.js';
import {e as api,j as navigate} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';
import {OrderMenuHeader,OrderMenuContent} from './CustomerMenuPage-B97eVEYj.js';
const h=React.createElement;
export function StaffOrderPage({restaurantId}) {
 return h('div',{className:'staff-order-page staff-pos'},h(MenuPreview,{restaurantId,onChoose:()=>{},renderCart:cart=>h(OrderPanel,{...cart,restaurantId})}));
}
function OrderPanel({restaurantId,cart,add,remove,setNote,clear,totalQty,totalPrice,menus}) {
 const [zones,Z]=React.useState([]),[tables,T]=React.useState([]),[zone,SZ]=React.useState(''),[label,SL]=React.useState(''),[mode,SM]=React.useState('eat'),[busy,SB]=React.useState(false),[message,SS]=React.useState('');
 const [validation,setValidation]=React.useState(null),validationDialog=React.useRef(null),zoneInput=React.useRef(null),tableInput=React.useRef(null);
 const panelRef=React.useRef(null);
 React.useEffect(()=>{
  const catalog=panelRef.current?.closest('.staff-order-catalog'),toolbar=catalog?.querySelector('.menu-browse-tools');
  if(!catalog||!toolbar)return;
  const update=()=>catalog.style.setProperty('--pos-sticky-top',`${Math.ceil(toolbar.getBoundingClientRect().height)+(parseFloat(getComputedStyle(toolbar).top)||0)+12}px`);
  const observer=new ResizeObserver(update);observer.observe(toolbar);update();
  return()=>{observer.disconnect();catalog.style.removeProperty('--pos-sticky-top');};
 },[]);
 React.useEffect(()=>{if(validation)validationDialog.current?.showModal();},[validation]);
 function closeValidation(){const field=validation?.field;validationDialog.current?.close();setValidation(null);(field==='zone'?zoneInput:tableInput).current?.focus();}
 const request=async(path,method,body)=>api('/api/restaurants/'+restaurantId+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 React.useEffect(()=>{let active=true;Promise.all([api('/api/restaurants/'+restaurantId+'/zones'),api('/api/restaurants/'+restaurantId+'/tables')]).then(([z,t])=>{if(active){Z(z.zones);T(t.tables);SZ(z.zones[0]?.id||'')}}).catch(()=>{if(active)SS('โหลดโซนและโต๊ะไม่สำเร็จ')});return()=>{active=false}},[restaurantId]);
 async function submit(checkout){
  if(busy||!totalQty)return;
  if(!zone||!label.trim()){SS('');setValidation({field:!zone?'zone':'table',text:!zone&&!label.trim()?'กรุณาเลือกโซนและระบุเลขโต๊ะ / ชื่อ':!zone?'กรุณาเลือกโซนร้าน':'กรุณาระบุเลขโต๊ะ / ชื่อ'});return}
  SB(true);SS('');
  try{
   const name=label.trim();let table=tables.find(t=>t.zone_id===zone&&String(t.table_number)===name);
   if(!table){const result=await request('/tables','POST',{zone_id:zone,table_number:name});table=result.table;T(t=>[...t,table])}
   if(!table.is_open){await request('/tables/'+table.id,'PATCH',{is_open:true});T(all=>all.map(t=>t.id===table.id?{...t,is_open:true}:t))}
   await api('/api/public/orders',{method:'POST',auth:false,headers:{'Content-Type':'application/json'},body:JSON.stringify({tableCode:table.short_code,clientRequestId:crypto.randomUUID(),items:Object.values(cart).map(item=>({menu_id:item.menuId,qty:item.qty,note:[mode==='take'?'สั่งกลับบ้าน':'',item.note].filter(Boolean).join(' · ')}))})});
   clear();SS('บันทึกบิลสำเร็จ');if(checkout)navigate('/dashboard/bills');
  }catch{SS('บันทึกไม่สำเร็จ กรุณาลองใหม่')}finally{SB(false)}
 }
 const money=value=>Number(value).toLocaleString('en-US')+' กีบ';
 return h('aside',{ref:panelRef,className:'staff-pos-panel','aria-label':'รายการสั่งอาหาร'},
  h('dialog',{ref:validationDialog,className:'pos-validation-dialog',role:'alertdialog','aria-labelledby':'pos-validation-title','aria-describedby':'pos-validation-description',onCancel:e=>{e.preventDefault();closeValidation();}},
   h('button',{type:'button',className:'pos-validation-close','aria-label':'ปิด',onClick:closeValidation},'✕'),
   h('div',{className:'pos-validation-icon','aria-hidden':true},'!'),
   h('h2',{id:'pos-validation-title'},'ข้อมูลยังไม่ครบ'),
   h('p',{id:'pos-validation-description'},validation?.text||''),
   h('button',{type:'button',className:'pos-validation-confirm',onClick:closeValidation},'ตกลง')),
  h('header',null,h('h2',null,'🛒 รายการสั่งอาหาร'),h('button',{type:'button',onClick:clear,disabled:busy||!totalQty,className:'pos-clear'},'ล้างบิล')),
  h('div',{className:'pos-modes'},...[['eat','🍽 ทานที่ร้าน'],['take','🛍 สั่งกลับบ้าน']].map(([id,text])=>h('button',{key:id,type:'button','aria-pressed':mode===id,onClick:()=>SM(id),disabled:busy},text))),
  h('div',{className:'pos-location'},h('label',null,'โซนร้าน',h('select',{ref:zoneInput,value:zone,disabled:busy,onChange:e=>{SZ(e.target.value);SL('')}},h('option',{value:''},'เลือกโซน'),...zones.map(z=>h('option',{key:z.id,value:z.id},z.name)))),
   h('label',null,'✏️ เลขโต๊ะ / ชื่อ (ระบุเพื่อจดจำ):',h('input',{ref:tableInput,value:label,disabled:busy,placeholder:'โต๊ะ 1 / VIP1',onChange:e=>SL(e.target.value)})),
   h('div',{className:'pos-tables'},...tables.filter(t=>t.zone_id===zone).map(t=>h('button',{type:'button',key:t.id,disabled:busy,'aria-pressed':label===String(t.table_number),onClick:()=>SL(String(t.table_number))},'โต๊ะ '+t.table_number)))),
  h('div',{className:'pos-items'},totalQty?Object.values(cart).map((item,index)=>{const menu=menus.find(m=>m.id===item.menuId);if(!menu)return null;return h('article',{key:item.menuId},h('div',{className:'pos-item-title'},h('strong',null,h('span',{className:'pos-item-index'},(index+1)+'. '),menu.name),h('span',null,money(Number(menu.price)*item.qty))),h('div',{className:'pos-item-tools'},h('input',{'aria-label':'หมายเหตุ '+menu.name,placeholder:'หมายเหตุ (เช่น ไม่เผ็ด)',value:item.note||'',disabled:busy,onChange:e=>setNote(item.menuId,e.target.value)}),h('button',{type:'button',disabled:busy,onClick:()=>remove(item.menuId),'aria-label':'ลด '+menu.name},'−'),h('input',{type:'number',min:1,step:1,className:'pos-qty-input','aria-label':'Quantity '+menu.name,value:item.qty,disabled:busy,onChange:e=>{const next=Math.max(1,Math.floor(Number(e.target.value)||1));for(let i=item.qty;i<next;i++)add(item.menuId);for(let i=item.qty;i>next;i--)remove(item.menuId)}}),h('button',{type:'button',disabled:busy,onClick:()=>add(item.menuId),'aria-label':'เพิ่ม '+menu.name},'+')))}):h('p',{className:'pos-empty'},'ยังไม่มีรายการอาหาร')),
  h('footer',null,h('div',null,h('span',null,'จำนวนรายการ:'),h('span',null,totalQty+' รายการ')),h('div',{className:'pos-total'},h('strong',null,'ราคารวม:'),h('strong',null,money(totalPrice))),message?h('p',{role:'status'},message):null,h('button',{type:'button',className:'pos-save',disabled:busy||!totalQty,onClick:()=>submit(false)},busy?'กำลังบันทึก…':'💾 บันทึกบิล (จ่ายทีหลัง)'),h('button',{type:'button',className:'pos-checkout',disabled:busy||!totalQty,onClick:()=>submit(true)},'✓ เช็กบิล / ชำระเงิน →')));
}
function MenuPreview({restaurantId,onChoose,renderCart}) {
 const [data,setData]=React.useState(null),[error,setError]=React.useState(false),[retry,setRetry]=React.useState(0);
 React.useEffect(()=>{let stopped=false;setData(null);setError(false);async function refresh(){try{const [shop,menus,categories]=await Promise.all([api(`/api/restaurants/${restaurantId}`),api(`/api/restaurants/${restaurantId}/menus`),api(`/api/restaurants/${restaurantId}/categories`)]);if(!stopped){setData({restaurant:shop.restaurant,menus:menus.menus.filter(menu=>menu.available),categories:categories.categories});setError(false)}}catch{if(!stopped)setError(true)}}refresh();const timer=setInterval(refresh,10000);return()=>{stopped=true;clearInterval(timer)}},[restaurantId,retry]);
 if(!data)return h('section',{className:'staff-order-empty'},error?h('button',{type:'button',onClick:()=>setRetry(v=>v+1)},'โหลดเมนูไม่สำเร็จ · ลองใหม่'):'กำลังโหลดเมนูอาหาร…');
 return h('section',{className:'customer-menu-page staff-order-catalog'},
  h(OrderMenuHeader,{restaurantName:data.restaurant.name,menuCount:data.menus.length,tableNumber:'—',shopIsOpen:data.restaurant.accepting_orders!==false,tableIsOpen:true,openTime:data.restaurant.open_time,closeTime:data.restaurant.close_time}),
  error?h('p',{role:'status'},'อัปเดตเมนูไม่สำเร็จ กำลังแสดงข้อมูลล่าสุด'):null,
  h(OrderMenuContent,{renderCart,cartScope:'staff',restaurantId,tableId:'preview',tableCode:'',tableNumber:'—',menus:data.menus,categories:data.categories,promotions:[],shopOpen:data.restaurant.accepting_orders!==false,onChooseTable:onChoose}));
}
