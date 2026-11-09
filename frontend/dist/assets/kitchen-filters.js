import {r as React,j as h} from './vendor-react-DCUvmuBu.js';
import {e as api} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';
import {downloadKitchenCsv} from './kitchen-csv.js';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Vientiane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function useKitchenFilters({restaurantId,setOrders,setHistory,onNewOrder}) {
  const [range,setRange]=React.useState(null),[revision,refresh]=React.useReducer(n=>n+1,0);
  const [loading,setLoading]=React.useState(false),[error,setError]=React.useState(''),[updated,setUpdated]=React.useState(null);
  const notify=React.useRef(onNewOrder);notify.current=onNewOrder;
  React.useEffect(()=>{
    let stopped=false,busy=false,seen=null;
    async function load(status,since,until) {
      let cursor=null,result=[];
      do {
        const query=new URLSearchParams({status,limit:'500'});
        if(since)query.set('since',since);
        if(until)query.set('until',until);
        if(cursor){query.set('before',cursor.created_at);query.set('before_id',cursor.id)}
        const page=await api(`/api/restaurants/${restaurantId}/orders?${query}`);
        if(stopped)return [];
        result.push(...page.orders);cursor=page.next_cursor;
      } while(cursor);
      return result;
    }
    async function run(){
      if(busy)return;busy=true;setLoading(true);setError('');
      try {
        const since=range?new Date(range.from+'T00:00:00+07:00').toISOString():null;
        const until=range?new Date(new Date(range.to+'T00:00:00+07:00').getTime()+86400000).toISOString():null;
        const [active,history]=await Promise.all([load('pending,ready',since,until),load('served,cancelled',since||new Date(Date.now()-7*86400000).toISOString(),until)]);
        if(stopped)return;
        active.sort((a,b)=>a.created_at.localeCompare(b.created_at));
        if(!range&&seen)for(const order of active)if(!seen.has(order.id))Promise.resolve(notify.current?.(order)).catch(()=>{});
        seen=new Set(active.map(order=>order.id));setOrders(active);setHistory(history);setUpdated(new Date());
      }catch{if(!stopped)setError('ดึงข้อมูลไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ')}
      finally{busy=false;if(!stopped)setLoading(false)}
    }
    setOrders([]);setHistory([]);run();const timer=setInterval(run,4000);
    return()=>{stopped=true;clearInterval(timer)};
  },[restaurantId,range,revision,setOrders,setHistory]);
  return {range,setRange,refresh,loading,error,updated};
}
export function KitchenFilters({filter,zones,zone,onZone,stage,onStage,csvData}) {
  const [from,setFrom]=React.useState(today),[to,setTo]=React.useState(today),[validation,setValidation]=React.useState('');
  function changeDates(nextFrom,nextTo){setFrom(nextFrom);setTo(nextTo);if(!nextFrom||!nextTo||nextFrom>nextTo){setValidation('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');return}setValidation('');filter.setRange({from:nextFrom,to:nextTo})}
  const field=(label,props)=>h.jsxs('label',{children:[h.jsx('span',{children:label}),h.jsx('input',{type:'date',required:true,...props})]});
  return h.jsxs('form',{className:'kf-form',onSubmit:event=>{event.preventDefault();if(!from||!to||from>to){setValidation('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');return}setValidation('');filter.setRange({from,to});filter.refresh()},children:[
    field('จากวันที่',{value:from,onChange:e=>changeDates(e.target.value,to)}),field('ถึงวันที่',{value:to,onChange:e=>changeDates(from,e.target.value)}),
    h.jsxs('label',{children:[h.jsx('span',{children:'สถานะ'}),h.jsx('select',{value:stage,onChange:e=>onStage(e.target.value),children:[['all','ทุกสถานะ'],['new','รอรับออเดอร์'],['cooking','กำลังทำ'],['ready','พร้อมเสิร์ฟ'],['history','ประวัติ']].map(([value,label])=>h.jsx('option',{value,children:label},value))})]}),
    h.jsxs('label',{children:[h.jsx('span',{children:'โซน'}),h.jsx('select',{value:zone,onChange:e=>onZone(e.target.value),children:[h.jsx('option',{value:'all',children:'ทุกโซน'}),...zones.map(z=>h.jsx('option',{value:z.id,children:z.name},z.id))]})]}),
    h.jsx('button',{type:'button',onClick:()=>{const day=today();setFrom(day);setTo(day);filter.setRange({from:day,to:day});setValidation('')},children:'วันนี้'}),
    h.jsx('button',{type:'button',onClick:()=>{filter.setRange(null);filter.refresh();onStage('all');onZone('all');setValidation('')},children:'กลับดูสด'}),
    h.jsx('button',{type:'button',className:'kf-export',disabled:filter.loading||!!filter.error||!!validation||!filter.updated,onClick:()=>downloadKitchenCsv({...csvData,stage},filter.range),children:'Export CSV'}),
    h.jsx('small',{className:'kf-summary',role:'status',children:validation||filter.error||(filter.range?`วันที่สั่ง ${filter.range.from} ถึง ${filter.range.to}`:'ดูสด: ออเดอร์ค้างทั้งหมด / ประวัติ 7 วัน')+(filter.updated?' · อัปเดต '+filter.updated.toLocaleTimeString('th-TH'):'')})
  ]});
}
