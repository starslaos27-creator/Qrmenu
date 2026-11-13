import {r as React,j as h} from './vendor-react-DCUvmuBu.js';
import {e as api} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';
import {p as menuName} from './localized-xOm72Hzm.js';
export const stageOf = order => order.status === 'ready' ? 'ready' : order.accepted_at ? 'cooking' : 'new';
const stages = [['new','รอรับออเดอร์'],['cooking','กำลังทำ'],['ready','พร้อมเสิร์ฟ'],['history','ประวัติ']];
function Details({children,onClose}) {
  const ref=React.useRef(null);
  React.useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close()},[]);
  return h.jsxs('dialog',{ref,className:'kb-dialog',onCancel:onClose,onClick:event=>{if(event.target===event.currentTarget)onClose()},children:[h.jsxs('header',{children:[h.jsx('strong',{children:'รายละเอียดออเดอร์'}),h.jsx('button',{onClick:onClose,'aria-label':'ปิดรายละเอียด',children:'✕'})]}),children]});
}
export function KitchenBoard({stage:filterStage="all",orders,history=[],renderHistory,tableMap,zoneMap,menuMap,locale,canAct,onChanged,renderDetails}) {
  const [collapsed,setCollapsed]=React.useState({});
  const [selected,setSelected]=React.useState(null),[busy,setBusy]=React.useState(null),[error,setError]=React.useState(''),[now,setNow]=React.useState(Date.now());
  React.useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
  React.useEffect(()=>{const board=document.querySelector('.kb-columns');if(!board)return;const resize=()=>board.style.setProperty('--kb-height',Math.max(300,window.innerHeight-board.getBoundingClientRect().top-20)+'px');resize();window.addEventListener('resize',resize);const observer=new ResizeObserver(resize);observer.observe(document.querySelector('.kitchen-reference-header')||board);return()=>{window.removeEventListener('resize',resize);observer.disconnect()}},[]);
  const detail=[...orders,...history].find(order=>order.id===selected);
  async function advance(order) {
    if(busy)return;setBusy(order.id);setError('');
    const current=stageOf(order);
    try {const result=await api(`/api/restaurants/${order.restaurant_id}/orders/${order.id}/${current==='new'?'accept':'status'}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(current==='new'?{}:{status:current==='cooking'?'ready':'served'})});onChanged(result.order)}
    catch {setError('เปลี่ยนสถานะไม่สำเร็จ กรุณาลองอีกครั้ง')}
    finally {setBusy(null)}
  }
  return h.jsxs('section',{className:'kb-board',children:[
    error?h.jsx('p',{className:'kb-error',role:'alert',children:error}):null,
    h.jsx('div',{className:'kb-columns',style:{gridTemplateColumns:filterStage==='all'?undefined:'minmax(0,1fr)'},children:stages.filter(([key])=>filterStage==='all'||key===filterStage).map(([stage,label])=>{
      const visible=stage==='history'?history:orders.filter(order=>stageOf(order)===stage);
      return h.jsxs('section',{className:'kb-column','aria-label':label,children:[
        h.jsxs('div',{className:'kb-column-heading kb-'+stage,children:[h.jsxs('h2',{className:'kb-tab kb-'+stage,children:[label,h.jsx('span',{children:visible.length})]}),h.jsx('button',{type:'button',className:'kb-collapse','aria-expanded':!collapsed[stage],'aria-controls':'kb-list-'+stage,'aria-label':(collapsed[stage]?'แสดงรายการ':'ซ่อนรายการ')+' '+label,onClick:()=>setCollapsed(previous=>({...previous,[stage]:!previous[stage]})),children:collapsed[stage]?'แสดงรายการ ▾':'ซ่อนรายการ ▴'})]}),
        h.jsx('div',{id:'kb-list-'+stage,hidden:!!collapsed[stage],className:'kb-column-body',children:visible.length?h.jsx('ul',{className:'kb-grid',children:visible.map(order=>{
      const table=tableMap.get(order.table_id),zone=zoneMap.get(table?.zone_id),elapsed=Math.max(0,Math.floor(((order.completed_at?new Date(order.completed_at).getTime():now)-new Date(order.created_at).getTime())/1000));
      return h.jsxs('li',{className:'kb-card',children:[
        h.jsxs('header',{className:'kb-card-heading',children:[h.jsx('span',{className:'kb-location',children:'โต๊ะ: '+(table?.table_number??'—')}),h.jsx('span',{className:'kb-location',children:'โซน: '+(zone?.name??'ไม่ระบุโซน')}),h.jsx('time',{dateTime:order.created_at,className:'kb-location',children:'? '+new Intl.DateTimeFormat('th-TH-u-ca-gregory-nu-latn',{timeZone:'Asia/Vientiane',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(order.created_at))}),h.jsx('span',{className:'kb-elapsed',title:'เวลาที่รอ',children:Math.floor(elapsed/60)+':'+String(elapsed%60).padStart(2,'0')})]}),
        h.jsx('ul',{className:'kb-items',children:order.items.map((item,index)=>h.jsxs('li',{children:[h.jsx('span',{'aria-hidden':true,className:'kb-dot',children:'⊙'}),h.jsxs('div',{children:[h.jsxs('span',{children:[menuMap.has(item.menu_id)?menuName(menuMap.get(item.menu_id),locale):'รายการอาหาร',' ×',item.qty]}),item.note?h.jsx('small',{children:item.note}):null]})]},index))}),
        h.jsxs('footer',{className:'kb-actions',children:[stage!=='history'&&canAct?h.jsx('button',{className:`kb-action kb-action-${stage}`,disabled:busy!==null,onClick:()=>advance(order),children:busy===order.id?'กำลังบันทึก…':stage==='new'?'รับออเดอร์':stage==='cooking'?'ทำเสร็จแล้ว':'เสิร์ฟแล้ว'}):h.jsx('span',{className:`kb-status kb-${stage}`,children:stage==='history'?(order.status==='cancelled'?'ยกเลิกแล้ว':'เสิร์ฟแล้ว'):stages.find(([key])=>key===stage)[1]}),h.jsx('button',{className:'kb-details',onClick:()=>setSelected(order.id),children:'รายละเอียด'})]})
      ]},order.id)
    })}):h.jsxs('div',{className:'kb-empty',children:[h.jsx('span',{'aria-hidden':true,children:'♧'}),h.jsx('strong',{children:'ไม่มีออเดอร์'+stages.find(([key])=>key===stage)[1]}),h.jsx('p',{children:'ออเดอร์ใหม่จะปรากฏที่นี่ทันที'})]})})
      ]},stage)
    })}),
    detail?h.jsx(Details,{onClose:()=>setSelected(null),children:['served','cancelled'].includes(detail.status)?renderHistory(detail):renderDetails(detail,()=>setSelected(null))}):null
  ]});
}
