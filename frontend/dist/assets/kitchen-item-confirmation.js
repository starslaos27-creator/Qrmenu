import {r as React,j as jsx} from './vendor-react-DCUvmuBu.js';
import {e as request,u as useLocale} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';

export function ItemConfirmation({order,index,canConfirm,editing=false,disabled=false}) {
  const {locale}=useLocale();
  const text=locale==='lo'
    ? {confirm:'ຢືນຢັນແລ້ວ',done:'ສຳເລັດ',saving:'ກຳລັງບັນທຶກ...',edit:'ບັນທຶກການແກ້ໄຂກ່ອນ',stock:'ສະຕັອກບໍ່ພໍ ກະລຸນາກວດສອບສະຕັອກ',changed:'ລາຍການປ່ຽນແລ້ວ ກະລຸນາໂຫຼດໃໝ່',error:'ຢືນຢັນບໍ່ສຳເລັດ ລອງໃໝ່'}
    : locale==='en'
    ? {confirm:'Confirm done',done:'Done',saving:'Saving...',edit:'Save edits first',stock:'Insufficient stock. Please check inventory.',changed:'Items changed. Please refresh.',error:'Could not confirm. Please retry.'}
    : {confirm:'ยืนยันเสร็จ',done:'ยืนยันแล้ว',saving:'กำลังบันทึก...',edit:'บันทึกการแก้ไขก่อน',stock:'สต็อกไม่พอ กรุณาตรวจสอบสต็อก',changed:'รายการเปลี่ยนแล้ว กรุณาโหลดใหม่',error:'ยืนยันไม่สำเร็จ กรุณาลองใหม่'};
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const [fixing,setFixing]=React.useState(false),[qty,setQty]=React.useState(order.items[index]?.qty||1),[note,setNote]=React.useState(order.items[index]?.note||'');
  const confirmation=order.item_confirmations?.[String(index)];
  async function resolve(action){
    if(busy)return;
    if(action!=='edit'&&!window.confirm(action==='cancel'?'ยกเลิกทั้งออเดอร์นี้?':'ลบเฉพาะรายการนี้? หากเป็นรายการสุดท้ายจะยกเลิกออเดอร์'))return;
    setBusy(true);
    try{const result=await request(`/api/restaurants/${order.restaurant_id}/orders/${order.id}/items/${index}/resolve`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,qty:Number(qty),note,expected_items:order.items})});setError('');setFixing(false);window.dispatchEvent(new CustomEvent('shopqr:order-confirmed',{detail:result.order}));}
    catch(e){setError(e.code==='ORDER_ITEMS_CHANGED'?text.changed:'แก้ไขไม่สำเร็จ กรุณาโหลดออเดอร์ใหม่หรือตรวจสอบสิทธิ์')}
    finally{setBusy(false)}
  }
  async function confirm(){
    if(busy||confirmation||editing||disabled)return;
    setBusy(true);setError('');
    try {
      const result=await request(`/api/restaurants/${order.restaurant_id}/orders/${order.id}/items/${index}/confirm`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_items:order.items})
      });
      window.dispatchEvent(new CustomEvent('shopqr:order-confirmed',{detail:result.order}));
    } catch(error){setError(error.code==='INSUFFICIENT_STOCK'?text.stock:error.code==='ORDER_ITEMS_CHANGED'?text.changed:text.error)}
    finally{setBusy(false)}
  }
  if(!canConfirm&&!confirmation)return null;
  return jsx.jsxs('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,maxWidth:150},children:[
    confirmation?jsx.jsxs('span',{style:{fontSize:11,color:'#047857',textAlign:'right',overflowWrap:'anywhere'},children:[`✓ ${text.done}`,jsx.jsx('br',{}),confirmation.user_name]}):
      jsx.jsx('button',{type:'button',onClick:confirm,disabled:busy||editing||disabled,title:editing?text.edit:undefined,
        className:'rounded-lg border border-line px-2 py-1.5 text-xs font-medium disabled:opacity-50',
        style:{background:'#ecfdf5',color:'#065f46',whiteSpace:'nowrap'},children:busy?text.saving:text.confirm}),
    error&&canConfirm&&!confirmation&&!order.paid?jsx.jsxs('div',{style:{display:'flex',flexWrap:'wrap',gap:4,justifyContent:'flex-end'},children:[
      jsx.jsx('button',{type:'button',disabled:busy,onClick:()=>setFixing(!fixing),className:'rounded border px-2 py-1 text-xs',children:'แก้ไขรายการ'}),
      jsx.jsx('button',{type:'button',disabled:busy,onClick:()=>resolve('remove'),className:'rounded border px-2 py-1 text-xs',style:{color:'#b91c1c'},children:'ลบรายการนี้'}),
      jsx.jsx('button',{type:'button',disabled:busy,onClick:()=>resolve('cancel'),className:'rounded border px-2 py-1 text-xs',style:{color:'#b91c1c'},children:'ยกเลิกทั้งหมด'}),
      fixing?jsx.jsxs('div',{children:[jsx.jsx('input',{type:'number',min:1,max:999,value:qty,'aria-label':'จำนวน',onChange:e=>setQty(e.target.value),style:{width:65}}),jsx.jsx('input',{value:note,maxLength:500,'aria-label':'หมายเหตุ',placeholder:'หมายเหตุ',onChange:e=>setNote(e.target.value),style:{width:'100%'}}),jsx.jsx('button',{type:'button',disabled:busy||!Number.isInteger(Number(qty))||Number(qty)<1,onClick:()=>resolve('edit'),children:'บันทึก'})]}):null
    ]}):null,
    error?jsx.jsx('span',{role:'alert',style:{fontSize:11,color:'#b91c1c',textAlign:'right'},children:error}):null
  ]});
}
