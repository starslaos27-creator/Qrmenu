import {r as React} from './vendor-react-DCUvmuBu.js';
import {e as api} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';

const h = React.createElement;
const number = value => value == null ? '—' : Number(value).toLocaleString('th-TH', {maximumFractionDigits:3});
const date = value => new Date(value).toLocaleString('th-TH', {timeZone:'Asia/Vientiane', dateStyle:'medium', timeStyle:'short'});
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Vientiane', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());

function ReceiptDetails({receipt, onClose}) {
  const dialog = React.useRef(null);
  React.useEffect(() => {const el=dialog.current; el.showModal(); return () => el.close();}, []);
  const facts = [
    ['เลขอ้างอิง',receipt.id], ['วันเวลารับเข้า',date(receipt.created_at)],
    ['สินค้า',receipt.menu_name], ['บาร์โค้ด',receipt.barcode || '—'],
    ['ผู้รับสินค้า',receipt.actor_name], ['หน่วย',receipt.unit || 'ไม่ระบุ'],
    ['คงเหลือก่อนรับ',number(receipt.before)], ['จำนวนรับเข้า','+ '+number(receipt.quantity)],
    ['คงเหลือหลังรับ',number(receipt.after)], ['หมายเหตุ',receipt.note || 'ไม่มีหมายเหตุ']
  ];
  return h('dialog', {ref:dialog, className:'stock-history-dialog', 'aria-labelledby':'receipt-detail-title', onCancel:onClose, onClick:e=>{if(e.target===dialog.current)onClose();}},
    h('div',{className:'stock-history-detail'},
      h('header',null,h('div',null,h('span',{className:'stock-history-eyebrow'},'ใบรับสินค้าเข้าสต็อก'),h('h2',{id:'receipt-detail-title'},'รายละเอียดการรับเข้า')),h('button',{type:'button',onClick:onClose,'aria-label':'ปิดรายละเอียด',autoFocus:true},'ปิด ✕')),
      h('div',{className:'stock-history-received'},'รับเข้าสำเร็จ · + ',number(receipt.quantity),' ',receipt.unit || 'หน่วย'),
      h('dl',null,...facts.map(([label,value])=>h('div',{key:label},h('dt',null,label),h('dd',null,value)))),
      receipt.legacy ? h('p',{className:'stock-history-notice'},'รายการเก่า: ชื่อสินค้า บาร์โค้ด หน่วย และชื่อผู้รับอ้างอิงข้อมูลปัจจุบัน เพราะยังไม่ได้เก็บรายละเอียดเหล่านี้ ณ วันรับเข้า') : null,
      h('p',{className:'stock-history-help'},'ยอดก่อนและหลังเป็นยอด ณ เวลารับเข้า ไม่ใช่ยอดคงเหลือปัจจุบัน')
    )
  );
}

export function MenuStockHistory({restaurantId}) {
  const [draft,setDraft]=React.useState({search:'',from:'',to:''});
  const [filter,setFilter]=React.useState({search:'',from:'',to:''});
  const [offset,setOffset]=React.useState(0), [reload,setReload]=React.useState(0);
  const [data,setData]=React.useState(null), [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState(''), [validation,setValidation]=React.useState('');
  const [selected,setSelected]=React.useState(null);
  React.useEffect(()=>{
    let stopped=false;
    setLoading(true);setError('');setData(null);setSelected(null);
    const query=new URLSearchParams({...filter,offset:String(offset)});
    api(`/api/restaurants/${restaurantId}/menu-receipts?${query}`).then(result=>{if(!stopped)setData(result);})
      .catch(()=>{if(!stopped)setError('โหลดประวัติไม่สำเร็จ กรุณาลองใหม่');})
      .finally(()=>{if(!stopped)setLoading(false);});
    return()=>{stopped=true;};
  },[restaurantId,filter,offset,reload]);
  const apply = value => {
    if(value.from && value.to && value.from>value.to){setValidation('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');return;}
    setValidation('');setDraft(value);setFilter({...value});setOffset(0);
  };
  const input = (label,key,type='text') => h('label',null,h('span',null,label),h('input',{
    type,value:draft[key],maxLength:key==='search'?200:undefined,
    placeholder:key==='search'?'ชื่อสินค้า / บาร์โค้ด / ผู้รับ / หมายเหตุ':undefined,
    onChange:e=>setDraft(v=>({...v,[key]:e.target.value}))
  }));
  const detailButton = receipt => h('button',{type:'button',className:'stock-history-view',onClick:()=>setSelected(receipt),'aria-label':`ดูรายละเอียด ${receipt.menu_name} ${date(receipt.created_at)}`},'ดูรายละเอียด ↗');
  return h('section',{className:'stock-history','aria-labelledby':'stock-history-title'},
    h('header',{className:'stock-history-header'},
      h('div',null,h('span',{className:'stock-history-eyebrow'},'สต็อก / การรับสินค้า'),h('h1',{id:'stock-history-title'},'ประวัติรับเข้าสินค้า'),h('p',null,'ตรวจสอบรายการรับเข้า ผู้รับสินค้า และยอดสต็อกย้อนหลัง')),
      h('a',{href:'/dashboard/menu?view=receive',className:'stock-history-primary'},'+ รับเข้าสินค้า')
    ),
    h('div',{className:'stock-history-stats'},
      h('article',null,h('span',null,'รายการรับเข้า'),h('strong',null,data?number(data.total):'—'),h('small',null,'ตามเงื่อนไขที่เลือก')),
      h('article',null,h('span',null,'สินค้าที่รับเข้า'),h('strong',null,data?number(data.products):'—'),h('small',null,'ชนิดสินค้า')),
      h('article',null,h('span',null,'ช่วงวันที่'),h('strong',{className:'stock-history-period'},filter.from||filter.to?`${filter.from||'เริ่มต้น'} → ${filter.to||'ปัจจุบัน'}`:'ทั้งหมด'),h('small',null,'เวลาร้าน UTC+7'))
    ),
    h('form',{className:'stock-history-filters',onSubmit:e=>{e.preventDefault();apply(draft);}},
      input('ค้นหาประวัติ','search'),input('ตั้งแต่วันที่','from','date'),input('ถึงวันที่','to','date'),
      h('button',{type:'submit',className:'stock-history-primary'},'ค้นหา'),
      h('button',{type:'button',onClick:()=>apply({...draft,from:today(),to:today()})},'วันนี้'),
      h('button',{type:'button',onClick:()=>apply({search:'',from:'',to:''})},'ล้างตัวกรอง')
    ),
    validation?h('p',{role:'alert',className:'stock-history-error'},validation):null,
    h('div',{className:'stock-history-list'},
      h('div',{className:'stock-history-list-heading'},h('h2',null,'รายการรับเข้าล่าสุด'),h('button',{type:'button',disabled:loading,onClick:()=>setReload(v=>v+1)},'↻ รีเฟรช')),
      loading?h('p',{role:'status',className:'stock-history-empty'},'กำลังโหลดประวัติ...'):
      error?h('div',{role:'alert',className:'stock-history-empty'},h('p',null,error),h('button',{type:'button',onClick:()=>setReload(v=>v+1)},'ลองใหม่')):
      !data?.receipts.length?h('div',{className:'stock-history-empty'},h('strong',null,'ไม่พบรายการรับเข้า'),h('p',null,'ลองเปลี่ยนช่วงวันที่หรือคำค้น หรือบันทึกรับเข้าสินค้าใหม่')):
      h(React.Fragment,null,
        h('div',{className:'stock-history-table-wrap'},h('table',null,
          h('thead',null,h('tr',null,...['วันเวลา / เลขอ้างอิง','สินค้า','จำนวนรับเข้า','คงเหลือก่อน → หลัง','ผู้รับสินค้า',''].map((v,i)=>h('th',{key:i,scope:'col'},v)))),
          h('tbody',null,...data.receipts.map(r=>h('tr',{key:r.id},
            h('td',null,date(r.created_at),h('small',null,'#',r.id.slice(0,8))),
            h('td',null,h('strong',null,r.menu_name),h('small',null,r.barcode||'ไม่มีบาร์โค้ด'),r.legacy?h('small',null,'ข้อมูลสินค้าอ้างอิงปัจจุบัน'):null),
            h('td',{className:'stock-history-quantity'},'+',number(r.quantity),h('small',null,r.unit||'หน่วย')),
            h('td',null,number(r.before),' → ',number(r.after)),h('td',null,r.actor_name),h('td',null,detailButton(r))
          )))
        )),
        h('div',{className:'stock-history-mobile'},...data.receipts.map(r=>h('article',{key:r.id},
          h('div',null,h('strong',null,r.menu_name),h('strong',{className:'stock-history-quantity'},'+',number(r.quantity),' ',r.unit||'หน่วย')),
          h('p',null,date(r.created_at),' · #',r.id.slice(0,8)),h('p',null,'คงเหลือ ',number(r.before),' → ',number(r.after)),h('p',null,'ผู้รับ: ',r.actor_name),detailButton(r)
        )))
      ),
      data&&data.total>0?h('footer',null,h('span',{'aria-live':'polite'},`${offset+1}–${Math.min(offset+50,data.total)} จาก ${number(data.total)} รายการ`),
        h('div',null,h('button',{type:'button',disabled:loading||offset===0,onClick:()=>setOffset(v=>Math.max(0,v-50))},'← ก่อนหน้า'),h('button',{type:'button',disabled:loading||offset+50>=data.total,onClick:()=>setOffset(v=>v+50)},'ถัดไป →'))):null
    ),
    h('p',{className:'stock-history-help'},'รวมรายการจาก “รับเข้าสินค้า” และ “รับสินค้าเข้าสต็อก” ในหน้าปรับสต็อก · การรับเข้าผ่านฟอร์มเดิมก่อนเพิ่มระบบประวัติไม่ได้ถูกบันทึกไว้'),
    selected?h(ReceiptDetails,{receipt:selected,onClose:()=>setSelected(null)}):null
  );
}
