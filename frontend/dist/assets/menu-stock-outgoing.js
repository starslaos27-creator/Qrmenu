import {r as React} from './vendor-react-DCUvmuBu.js';
import {e as api} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';
const h=React.createElement;
const types={sale:'ขายจากออเดอร์',issue:'ตัดออกด้วยมือ',waste:'ของเสีย / หมดอายุ',return_out:'ส่งคืนผู้จัดส่ง',adjustment:'ปรับยอดลดลง',transfer_out:'โอนออก',sale_return:'คืนจากยกเลิกออเดอร์',legacy:'ออเดอร์เก่า (ข้อมูลจำกัด)'};
const number=v=>v==null?'—':Number(v).toLocaleString('th-TH',{maximumFractionDigits:3});
const date=v=>new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Vientiane',dateStyle:'medium',timeStyle:'short'});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Vientiane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const signed=r=>(r.type==='sale_return'?'+':r.type==='legacy'?'':'−')+number(r.quantity);
const status=r=>!r.order_id?'รายการสต็อก':r.order_status==='cancelled'?(r.reversed?'ยกเลิก / คืนสต็อกแล้ว':'ยกเลิก'):r.paid?'ชำระเงินแล้ว':'ยังไม่ชำระเงิน';
const empty={search:'',from:'',to:'',type:''};

function Details({row:r,onClose}){
 const dialog=React.useRef(null);
 React.useEffect(()=>{const el=dialog.current;el.showModal();return()=>el.close();},[]);
 const facts=[['เลขอ้างอิงรายการ',r.id],['วันที่ทำรายการ',date(r.created_at)],['ประเภท',types[r.type]],
  ['สินค้า',r.menu_name],['บาร์โค้ด',r.barcode||'—'],['จำนวน',`${signed(r)} ${r.unit||'หน่วย'}`],
  ['คงเหลือก่อน',number(r.before)],['คงเหลือหลัง',number(r.after)],['ผู้ทำรายการ',r.actor_name],
  ...(r.order_id?[['เลขออเดอร์',r.order_id],['เลขบิล',r.receipt_number||'ยังไม่มีเลขบิล'],['โต๊ะ',r.table_name||'—'],['สถานะปัจจุบัน',status(r)],...(r.cancel_reason?[['เหตุผลยกเลิก',r.cancel_reason]]:[])]:[]),
  ['หมายเหตุ',r.note||'ไม่มีหมายเหตุ']];
 return h('dialog',{ref:dialog,className:'stock-history-dialog','aria-labelledby':'outgoing-details-title',onCancel:onClose,onClick:e=>{if(e.target===dialog.current)onClose();}},
  h('div',{className:'stock-history-detail'},
   h('header',null,h('h2',{id:'outgoing-details-title'},'รายละเอียดขายออก / ตัดสต็อก'),h('button',{type:'button',onClick:onClose,autoFocus:true,'aria-label':'ปิดรายละเอียด'},'ปิด ✕')),
   h('div',{className:'stock-outgoing-banner'},types[r.type],' · ',signed(r),' ',r.unit||'หน่วย'),
   h('dl',null,...facts.map(([label,value])=>h('div',{key:label},h('dt',null,label),h('dd',null,value)))),
   r.legacy?h('p',{className:'stock-history-notice'},r.type==='legacy'?'ข้อมูลจากออเดอร์เก่า: จำนวนคือจำนวนในออเดอร์ ไม่สามารถยืนยันได้ว่าสินค้านี้เปิดติดตามสต็อกในขณะนั้น และไม่มีบันทึกยอดก่อน–หลังหรือผู้ตัดสต็อก':'รายการเก่า: ชื่อสินค้า หน่วย และผู้ทำรายการอาจอ้างอิงข้อมูลปัจจุบัน'):null,
   h('p',{className:'stock-history-help'},'ยอดก่อน–หลังเป็นยอด ณ เวลาทำรายการ สถานะออเดอร์เป็นสถานะปัจจุบัน การตัดสต็อกไม่ได้หมายความว่าชำระเงินแล้ว')
  ));
}

function StockAlerts({restaurantId,revision}){
 const [counts,setCounts]=React.useState(null),[failed,setFailed]=React.useState(false),[retry,setRetry]=React.useState(0);
 React.useEffect(()=>{
  let stopped=false;setCounts(null);setFailed(false);
  api(`/api/restaurants/${restaurantId}/menus`).then(result=>{
   if(stopped)return;
   const tracked=result.menus.filter(item=>item.track_stock===true);
   setCounts({low:tracked.filter(item=>Number(item.stock_quantity)>0&&Number(item.stock_quantity)<=Number(item.low_alert_limit)).length,
    out:tracked.filter(item=>Number(item.stock_quantity)<=0).length});
  }).catch(()=>{if(!stopped)setFailed(true);});
  return()=>{stopped=true;};
 },[restaurantId,revision,retry]);
 return h('section',{'aria-label':'สถานะสต็อกสินค้าปัจจุบัน',className:'stock-outgoing-alerts'},
  h('article',{className:'stock-outgoing-alert stock-outgoing-alert-low'},
   h('div',{className:'stock-outgoing-alert-icon','aria-hidden':true},'⚠'),
   h('div',null,h('h2',null,'เตือนสต็อกต่ำ'),h('div',{className:'stock-outgoing-alert-count'},h('strong',null,counts?number(counts.low):'—'),h('span',null,'รายการ')),
    h('small',null,'คงเหลือถึงจุดแจ้งเตือน'))),
  h('article',{className:'stock-outgoing-alert stock-outgoing-alert-out'},
   h('div',{className:'stock-outgoing-alert-icon','aria-hidden':true},'⊘'),
   h('div',null,h('h2',null,'สินค้าหมดสต็อก'),h('div',{className:'stock-outgoing-alert-count'},h('strong',null,counts?number(counts.out):'—'),h('span',null,'รายการ')),
    h('small',null,'คงเหลือ 0 · ต้องเติมสินค้า'))),
  failed?h('div',{className:'stock-outgoing-alert-error',role:'alert'},'โหลดสถานะสต็อกไม่สำเร็จ ',h('button',{type:'button',onClick:()=>setRetry(v=>v+1)},'ลองโหลดสต็อกอีกครั้ง')):null);
}

export function MenuStockOutgoing({restaurantId}){
 const [draft,setDraft]=React.useState({...empty}),[filter,setFilter]=React.useState({...empty});
 const [offset,setOffset]=React.useState(0),[reload,setReload]=React.useState(0);
 const [data,setData]=React.useState(null),[loading,setLoading]=React.useState(true),[error,setError]=React.useState('');
 const [validation,setValidation]=React.useState(''),[selected,setSelected]=React.useState(null);
 const [exporting,setExporting]=React.useState(false),[exportError,setExportError]=React.useState('');
 const exportPending=React.useRef(false),exportVersion=React.useRef(0);
 React.useEffect(()=>{exportPending.current=false;setExporting(false);setExportError('');return()=>{exportVersion.current++;};},[restaurantId]);
 async function exportCsv(){
  if(exportPending.current)return;
  exportPending.current=true;setExporting(true);setExportError('');
  const version=exportVersion.current;
  try{
   const result=await api(`/api/restaurants/${restaurantId}/menu-outgoing?${new URLSearchParams({...filter,format:'csv'})}`);
   if(version!==exportVersion.current)return;
   const url=URL.createObjectURL(new Blob([result.csv],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download=`stock-outgoing-${filter.from||'all'}-${filter.to||today()}.csv`;
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{if(version===exportVersion.current)setExportError('ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง');}
  finally{if(version===exportVersion.current){exportPending.current=false;setExporting(false);}}
 }
 React.useEffect(()=>{
  let stopped=false;setData(null);setLoading(true);setError('');setSelected(null);
  api(`/api/restaurants/${restaurantId}/menu-outgoing?${new URLSearchParams({...filter,offset:String(offset)})}`)
   .then(result=>{if(!stopped)setData(result);}).catch(()=>{if(!stopped)setError('โหลดประวัติไม่สำเร็จ กรุณาลองใหม่');})
   .finally(()=>{if(!stopped)setLoading(false);});
  return()=>{stopped=true;};
 },[restaurantId,filter,offset,reload]);
 const apply=value=>{if(value.from&&value.to&&value.from>value.to){setValidation('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');return;}setValidation('');setDraft({...value});setFilter({...value});setOffset(0);};
 const input=(label,key,type='text')=>h('label',null,h('span',null,label),h('input',{type,value:draft[key],maxLength:key==='search'?200:undefined,
  placeholder:key==='search'?'สินค้า / บาร์โค้ด / เลขบิล / ผู้ทำรายการ':undefined,onChange:e=>setDraft(v=>({...v,[key]:e.target.value}))}));
 const detail=r=>h('button',{type:'button',className:'stock-history-view',onClick:()=>setSelected(r),'aria-label':`ดูรายละเอียด ${r.menu_name} ${date(r.created_at)}`},'ดูรายละเอียด ↗');
 const badge=r=>h('span',{className:`stock-outgoing-badge ${r.type==='sale_return'?'is-return':r.type==='legacy'?'is-legacy':''}`},types[r.type]);
 return h('section',{className:'stock-history stock-outgoing','aria-labelledby':'stock-outgoing-title'},
  h('header',{className:'stock-history-header'},h('h1',{id:'stock-outgoing-title'},'ประวัติขายออก / ตัดสต็อก'),
   h('div',{className:'stock-outgoing-actions'},
    h('button',{type:'button',className:'stock-outgoing-download',disabled:exporting||loading||!data,onClick:exportCsv,title:'ดาวน์โหลดทุกรายการตามตัวกรองที่ใช้ค้นหาล่าสุด'},exporting?'กำลังดาวน์โหลด…':'ดาวน์โหลด CSV'),
    h('a',{href:'/dashboard/menu',className:'stock-history-primary'},'กลับรายการสินค้า'))),
  exportError?h('p',{role:'alert',className:'stock-history-error'},exportError):null,
  h('div',{className:'stock-outgoing-summary'},
   h('div',{className:'stock-history-stats'},
   h('article',null,h('span',null,'รายการที่พบ'),h('strong',null,data?number(data.total):'—'),h('small',null,'ตามตัวกรองที่เลือก')),
   h('article',null,h('span',null,'สินค้าที่เกี่ยวข้อง'),h('strong',null,data?number(data.products):'—'),h('small',null,'ชนิดสินค้า')),
   h('article',null,h('span',null,'ประเภทที่เลือก'),h('strong',{className:'stock-history-period'},types[filter.type]||'ทั้งหมด'),h('small',null,'เวลาร้าน UTC+7'))),
   h(StockAlerts,{restaurantId,revision:reload})),
  h('form',{className:'stock-history-filters',onSubmit:e=>{e.preventDefault();apply(draft);}},
   input('ค้นหาประวัติ','search'),input('ตั้งแต่วันที่','from','date'),input('ถึงวันที่','to','date'),
   h('label',null,h('span',null,'ประเภทรายการ'),h('select',{value:draft.type,onChange:e=>setDraft(v=>({...v,type:e.target.value}))},h('option',{value:''},'ทั้งหมด'),...Object.entries(types).map(([value,label])=>h('option',{key:value,value},label)))),
   h('button',{type:'submit',className:'stock-history-primary'},'ค้นหา'),h('button',{type:'button',onClick:()=>apply({...draft,from:today(),to:today()})},'วันนี้'),h('button',{type:'button',onClick:()=>apply(empty)},'ล้างตัวกรอง')),
  validation?h('p',{role:'alert',className:'stock-history-error'},validation):null,
  h('div',{className:'stock-history-list'},h('div',{className:'stock-history-list-heading'},h('h2',null,'รายการล่าสุด'),h('button',{type:'button',disabled:loading,onClick:()=>setReload(v=>v+1)},'↻ รีเฟรช')),
   loading?h('p',{role:'status',className:'stock-history-empty'},'กำลังโหลดประวัติ...'):
   error?h('div',{role:'alert',className:'stock-history-empty'},h('p',null,error),h('button',{type:'button',onClick:()=>setReload(v=>v+1)},'ลองใหม่')):
   !data?.receipts.length?h('div',{className:'stock-history-empty'},h('strong',null,'ไม่พบรายการขายออก / ตัดสต็อก'),h('p',null,'ลองเปลี่ยนคำค้น ประเภท หรือช่วงวันที่')):
   h(React.Fragment,null,
    h('div',{className:'stock-history-table-wrap'},h('table',null,
     h('thead',null,h('tr',null,...['วันเวลา / ประเภท','สินค้า','จำนวน','ก่อน → หลัง','ออเดอร์ / ผู้ทำรายการ',''].map((label,i)=>h('th',{key:i,scope:'col'},label)))),
     h('tbody',null,...data.receipts.map(r=>h('tr',{key:r.id},
      h('td',null,date(r.created_at),h('div',null,badge(r))),
      h('td',null,h('strong',null,r.menu_name),h('small',null,r.barcode||'ไม่มีบาร์โค้ด')),
      h('td',{className:r.type==='sale_return'?'stock-history-quantity':'stock-outgoing-quantity'},signed(r),h('small',null,r.unit||'หน่วย')),
      h('td',null,number(r.before),' → ',number(r.after)),
      h('td',null,r.order_id?(r.receipt_number||'#'+r.order_id.slice(0,8)):r.actor_name,h('small',null,status(r)),r.order_id?h('small',null,r.actor_name):null),h('td',null,detail(r))))))),
    h('div',{className:'stock-history-mobile'},...data.receipts.map(r=>h('article',{key:r.id},h('div',null,h('strong',null,r.menu_name),h('strong',{className:r.type==='sale_return'?'stock-history-quantity':'stock-outgoing-quantity'},signed(r),' ',r.unit||'หน่วย')),badge(r),h('p',null,date(r.created_at)),h('p',null,'คงเหลือ ',number(r.before),' → ',number(r.after)),h('p',null,r.receipt_number||r.actor_name,' · ',status(r)),detail(r))))),
   data&&data.total>0?h('footer',null,h('span',{'aria-live':'polite'},`${offset+1}–${Math.min(offset+50,data.total)} จาก ${number(data.total)} รายการ`),h('div',null,h('button',{type:'button',disabled:loading||offset===0,onClick:()=>setOffset(v=>Math.max(0,v-50))},'← ก่อนหน้า'),h('button',{type:'button',disabled:loading||offset+50>=data.total,onClick:()=>setOffset(v=>v+50)},'ถัดไป →'))):null),
  h('p',{className:'stock-history-help'},'ขายจากออเดอร์: ตัดสต็อกเมื่อเสิร์ฟหรือชำระเงินครั้งแรก · การตัดด้วยมือแสดงแยกประเภท · ออเดอร์เก่ามีข้อมูลจำกัดและไม่มีหลักฐานยอดก่อน–หลัง'),
  selected?h(Details,{row:selected,onClose:()=>setSelected(null)}):null);
}
