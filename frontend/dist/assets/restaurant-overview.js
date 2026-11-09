import {r as React} from './vendor-react-DCUvmuBu.js';
import {e as api, j as navigate, n as logout} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';
import {f as money} from './format-Bw_5pJ49.js';

const h=React.createElement;
const number=value=>Number(value||0).toLocaleString('th-TH');
const day=value=>new Date(value).toLocaleDateString('en-CA');
const shortDate=value=>new Date(value).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
const status=order=>order.paid?'ชำระเงินแล้ว':({pending:'รอทำ',ready:'พร้อมเสิร์ฟ',served:'เสิร์ฟแล้ว',cancelled:'ยกเลิก'}[order.status]||order.status);
function Link({to,children,...props}){return h('a',{...props,href:to,onClick:event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();navigate(to);}}},children);}
function Panel({title,action,children,className=''}){return h('section',{className:`ro-panel ${className}`},h('div',{className:'ro-panel-heading'},h('h2',null,title),action),children);}
function Empty({children='ยังไม่มีข้อมูล'}){return h('div',{className:'ro-empty'},children);}
function DataTable({headers,rows}){return rows.length?h('div',{className:'ro-table-scroll'},h('table',null,h('thead',null,h('tr',null,...headers.map(label=>h('th',{key:label},label)))),h('tbody',null,...rows.map((cells,index)=>h('tr',{key:index},...cells.map((cell,i)=>h('td',{key:i},cell))))))):h(Empty,null);}
function RevenueChart({orders}){
  const days=Array.from({length:7},(_,i)=>{const date=new Date();date.setDate(date.getDate()-6+i);return {date,total:0};});
  for(const order of orders){if(!order.paid)continue;const point=days.find(item=>day(item.date)===day(order.created_at));if(point)point.total+=Number(order.total);}
  const max=Math.max(1,...days.map(item=>item.total))*1.15;
  const points=days.map((item,i)=>`${58+i*88},${210-item.total/max*165}`).join(' ');
  return h('div',{className:'ro-chart'},h('div',{className:'ro-legend'},h('span',null,h('i',{style:{background:'#10b981'}}),'รายรับจากออเดอร์ที่ชำระแล้ว')),
    h('svg',{viewBox:'0 0 620 250',role:'img','aria-label':'ยอดขายจากออเดอร์ใน 7 วันล่าสุด แยกตามวันที่สั่ง'},
      h('defs',null,h('linearGradient',{id:'ro-revenue-fill',x1:'0',y1:'0',x2:'0',y2:'1'},h('stop',{offset:'0%',stopColor:'#10b981',stopOpacity:'.16'}),h('stop',{offset:'100%',stopColor:'#10b981',stopOpacity:'0'}))),
      ...[0,1,2,3,4].map(i=>h('g',{key:i},h('line',{x1:58,x2:590,y1:210-i*42,y2:210-i*42,stroke:'#e5edf3',strokeDasharray:'4 4'}),h('text',{x:48,y:214-i*42,textAnchor:'end'},number(Math.round(max*i/4))))),
      h('polygon',{points:`58,210 ${points} 586,210`,fill:'url(#ro-revenue-fill)'}),h('polyline',{points,fill:'none',stroke:'#10b981',strokeWidth:2.5}),
      ...days.map((item,i)=>h('g',{key:i},h('circle',{cx:58+i*88,cy:210-item.total/max*165,r:3,fill:'white',stroke:'#10b981',strokeWidth:2},h('title',null,`${shortDate(item.date)}: ${money(item.total)}`)),h('text',{x:58+i*88,y:238,textAnchor:'middle'},shortDate(item.date))))),
    h('p',{className:'ro-note'},'ตามวันที่สั่ง · สูงสุด 500 ออเดอร์ล่าสุด · สกุลเงินกีบ'));
}
function exportSummary(summary){
  const rows=[['รายการ','จำนวน'],['ยอดขายวันนี้',summary.todayRevenue],['ออเดอร์ชำระแล้ว',summary.todayPaidCount],['ออเดอร์รอทำ',summary.pendingCount],['โต๊ะค้างชำระ',summary.unpaidTableCount],['ยอดค้างชำระ',summary.unpaidTotal],['เรียกพนักงาน',summary.callCount]];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`shopqr-summary-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function DashboardHome({restaurant,role}){
  const [data,setData]=React.useState(null),[error,setError]=React.useState(false),[retry,setRetry]=React.useState(0);
  const [profileOpen,setProfileOpen]=React.useState(false);
  const [profile,setProfile]=React.useState(null),[profilePhoto,setProfilePhoto]=React.useState(''),[profilePhotoError,setProfilePhotoError]=React.useState('');
  const [activityAt,setActivityAt]=React.useState(()=>Date.now());
  const [presenceAt,setPresenceAt]=React.useState(()=>Date.now());
  const [presenceNow,setPresenceNow]=React.useState(()=>Date.now());
  const inactiveAfter=5*60*1000;
  React.useEffect(()=>{
    const key='shopqr.profile-presence.'+(profile?.id||restaurant?.id||'session');
    const read=()=>{let at=Date.now();try{const value=JSON.parse(localStorage.getItem(key)||'null');if(Number(value?.at)>0)at=Number(value.at)}catch{};setPresenceAt(at);setActivityAt(at);setPresenceNow(Date.now())};
    const touch=()=>{const at=Date.now();try{localStorage.setItem(key,JSON.stringify({at}))}catch{};setPresenceAt(at);setActivityAt(at);setPresenceNow(at)};
    let last=0;const onActivity=()=>{const at=Date.now();if(at-last<15000)return;last=at;touch()};
    touch();const events=['pointerdown','pointermove','keydown','touchstart','scroll','click'];events.forEach(name=>window.addEventListener(name,onActivity,{passive:true}));
    const timer=setInterval(()=>{setPresenceNow(Date.now());read()},15000);const onStorage=event=>{if(event.key===key)read()};window.addEventListener('storage',onStorage);
    return()=>{events.forEach(name=>window.removeEventListener(name,onActivity));clearInterval(timer);window.removeEventListener('storage',onStorage)}
  },[profile?.id,restaurant?.id]);

  const owner=role==='owner',canStock=['owner','cook','staff'].includes(role);
  async function signOut(){setProfileOpen(false);try{await logout()}finally{navigate('/login')}}
  React.useEffect(()=>{let active=true;api('/api/auth/me').then(result=>{if(!active)return;const user=result?.user??null;setProfile(user);try{setProfilePhoto(localStorage.getItem('shopqr.profile-photo.'+(user?.id||restaurant?.id))||'')}catch{setProfilePhoto('')}}).catch(()=>{});return()=>{active=false}},[restaurant?.id]);
  const profileName=profile?.display_name?.trim()||profile?.email||restaurant?.name||'R';
  const profileInitial=Array.from(profileName.trim())[0]?.toUpperCase()||'R';
  const isOnline=presenceNow-activityAt<inactiveAfter;
  const lastOnlineLabel=new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit'}).format(new Date(presenceAt));
  function changeProfilePhoto(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024){setProfilePhotoError('เลือกรูป PNG, JPG หรือ WebP ขนาดไม่เกิน 1 MB');return}const reader=new FileReader();reader.onload=()=>{try{const photo=String(reader.result||'');localStorage.setItem('shopqr.profile-photo.'+(profile?.id||restaurant?.id),photo);setProfilePhoto(photo);setProfilePhotoError('')}catch{setProfilePhotoError('บันทึกรูปไม่สำเร็จ กรุณาเลือกรูปที่มีขนาดเล็กลง')}};reader.onerror=()=>setProfilePhotoError('อ่านรูปไม่สำเร็จ กรุณาลองอีกครั้ง');reader.readAsDataURL(file)}
  React.useEffect(()=>{
    if(!restaurant?.id)return;
    let disposed=false;setData(null);setError(false);
    const root=`/api/restaurants/${restaurant.id}`;
    const requests=[['summary','/dashboard-summary'],['tables','/tables'],['orders','/orders?limit=500'],...(owner?[['menus','/menus'],['categories','/categories']]:[]),...(canStock?[['items','/stock/items?lowStock=true']]:[])];
    async function refresh(){
      const results=await Promise.allSettled(requests.map(async([key,path])=>[key,(await api(root+path))[key]]));
      if(disposed)return;
      if(results[0].status==='rejected'){setError(true);return;}
      const next={};for(let i=0;i<results.length;i++){const result=results[i];if(result.status==='fulfilled')next[result.value[0]]=result.value[1];else next[requests[i][0]]=null;}
      setData(next);setError(false);
    }
    refresh();const timer=setInterval(refresh,30000);return()=>{disposed=true;clearInterval(timer);};
  },[restaurant?.id,role,retry]);
  if(!restaurant)return null;
  if(!data)return h('div',{className:'restaurant-overview'},h(Empty,null,error?h(React.Fragment,null,'โหลดข้อมูลไม่สำเร็จ ',h('button',{onClick:()=>setRetry(v=>v+1)},'ลองอีกครั้ง')):'กำลังโหลดภาพรวมร้านอาหาร…'));
  const s=data.summary,orders=data.orders||[],tables=data.tables||[];
  const paidOrders=orders.filter(order=>order.paid);
  const recent=s.recentOrders||[];
  const active=new Set(orders.filter(order=>!order.paid&&order.status!=='cancelled').map(order=>order.table_id));
  const tableGroups=[{label:'มีออเดอร์ค้างชำระ',value:tables.filter(table=>active.has(table.id)).length,color:'#f4b53f'},{label:'เปิดรับออเดอร์',value:tables.filter(table=>!active.has(table.id)&&table.is_open).length,color:'#159d88'},{label:'ปิดรับออเดอร์',value:tables.filter(table=>!active.has(table.id)&&!table.is_open).length,color:'#7893ef'}];
  let angle=0;const stops=tableGroups.map(group=>{const start=angle;angle+=tables.length?group.value/tables.length*360:0;return `${group.color} ${start}deg ${angle}deg`;});
  const categories=new Map((data.categories||[]).map(category=>[category.id,{name:category.name,total:0}]));
  const menus=new Map((data.menus||[]).map(menu=>[menu.id,menu]));
  for(const order of paidOrders.filter(order=>day(order.created_at)===day(new Date())))for(const item of order.items||[]){const menu=menus.get(item.menu_id),category=categories.get(menu?.category_id);if(category)category.total+=Number(menu.price)*item.qty;}
  const sales=[...categories.values()].filter(category=>category.total>0).sort((a,b)=>b.total-a.total).slice(0,3);
  const cards=[
    ['ยอดขายวันนี้',money(s.todayRevenue),`${number(s.todayPaidCount)} ออเดอร์ชำระแล้ว`,'green','↙','/dashboard/stats?view=today'],
    ['ออเดอร์รอทำ',number(s.pendingCount),'ออเดอร์วันนี้ที่ครัวต้องทำ','red','↗','/dashboard/kitchen?view=new'],
    ['ยอดค้างชำระ',money(s.unpaidTotal),`${number(s.unpaidTableCount)} โต๊ะค้างชำระวันนี้`,'blue','▣','/dashboard/bills'],
    ['เรียกพนักงาน',number(s.callCount),'คำขอที่รอการตอบรับ','purple','♧','/dashboard/bills']
  ];
  return h('div',{className:'restaurant-overview'},
    h('header',{className:'ro-header'},h('div',null,h('div',{className:'ro-eyebrow'},'RESTAURANT OVERVIEW'),h('h1',null,'ภาพรวมร้านอาหาร ',h('span',null,'👋')),h('p',null,`ยินดีต้อนรับกลับมา! มาดูความเคลื่อนไหวของ${restaurant.name||'ร้าน'}วันนี้กัน`)),h('div',{className:'ro-actions'},h('time',null,new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'})),owner?h('button',{onClick:()=>exportSummary(s)},'↥ ส่งออกรายงาน'):null,h('div',{className:'ro-profile-wrap'},h('button',{type:'button',className:`ro-profile ${isOnline?'is-online':'is-idle'}`,title:isOnline?'Online':`Offline \u00b7 Last seen ${lastOnlineLabel}`,'aria-label':`${profileName} \u00b7 ${isOnline?'Online':`Offline, last seen ${lastOnlineLabel}`} \u00b7 Open profile menu`,'aria-haspopup':'menu','aria-expanded':profileOpen,onClick:()=>setProfileOpen(open=>!open)},profilePhoto?h('img',{className:'ro-profile-avatar-image',src:profilePhoto,alt:''}):h('span',{className:'ro-profile-avatar','aria-hidden':true},profileInitial)),profileOpen?h('div',{className:'ro-profile-menu',role:'menu'},h('div',{className:'ro-profile-card'},h('label',{className:'ro-profile-photo-picker',title:'เปลี่ยนรูปโปรไฟล์'},profilePhoto?h('img',{src:profilePhoto,alt:''}):h('span',null,profileInitial),h('span',{className:'ro-profile-camera','aria-hidden':true},'📷'),h('input',{type:'file',accept:'image/png,image/jpeg,image/webp','aria-label':'เลือกภาพโปรไฟล์',onChange:changeProfilePhoto})),h('div',{className:'ro-profile-identity'},h('strong',null,profileName),profile?.email&&profile.display_name?h('small',null,profile.email):h('small',null,role==='owner'?'Owner':'Staff'),h('small',{className:`ro-profile-presence ${isOnline?'online':'idle'}`},h('i',null),isOnline?'Online':`Offline \u00b7 Last seen ${lastOnlineLabel}`))),profilePhotoError?h('p',{className:'ro-profile-error',role:'alert'},profilePhotoError):null,h(Link,{to:'/dashboard/settings',role:'menuitem',onClick:()=>setProfileOpen(false)},h('span',{'aria-hidden':true},'⚙'),'ตั้งค่าระบบ'),h(Link,{to:'/dashboard/settings',role:'menuitem',className:'ro-profile-upgrade',onClick:()=>setProfileOpen(false)},h('span',{'aria-hidden':true},'⭐'),'อัปเกรดโปร'),h('button',{type:'button',role:'menuitem',onClick:signOut},h('span',{'aria-hidden':true},'↪'),'ออกจากระบบ')):null))),
    error?h('div',{className:'ro-warning',role:'status'},'อัปเดตข้อมูลไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่โหลดได้'):null,
    h('div',{className:'ro-kpis',style:{gridTemplateColumns:`repeat(${cards.length},minmax(0,1fr))`}},...cards.map(([title,value,caption,color,icon,to])=>h(Link,{key:title,to,className:`ro-kpi ${color}`},h('div',{className:'ro-kpi-title'},h('span',{className:'ro-icon'},icon),title,h('span',{className:'ro-info','aria-hidden':true},'ⓘ')),h('strong',null,value),h('div',null,h('span',{className:'ro-chip'},'สรุป'),' ',caption),h('small',null,'อัปเดตอัตโนมัติทุก 30 วินาที')))),
    h('div',{className:`ro-middle ${owner?'':'ro-staff'}`},owner?h(Panel,{title:'ยอดขายรายวัน',action:h('span',{className:'ro-period'},'7 วัน')},data.orders?h(RevenueChart,{orders}):h(Empty,null,'โหลดข้อมูลยอดขายไม่สำเร็จ')):null,
      owner?h(Panel,{title:'ยอดขายตามหมวดหมู่',action:h('span',{className:'ro-period'},'วันนี้')},!data.orders||!data.menus||!data.categories?h(Empty,null,'โหลดข้อมูลหมวดหมู่ไม่สำเร็จ'):sales.length?h('div',{className:'ro-bars'},...sales.map((category,i)=>h('div',{className:'ro-bar-column',key:category.name},h('span',null,number(category.total)),h('div',{className:'ro-bar-track'},h('div',{style:{height:`${category.total/sales[0].total*100}%`,background:['#2b64dc','#278ca1','#8250cc'][i]}})),h('small',null,category.name)))):h(Empty,null,'ยังไม่มียอดขายในวันนี้'),h('p',{className:'ro-note'},'มูลค่าเมนูตามราคาปัจจุบัน ก่อนส่วนลดและภาษี')):null,
      h(Panel,{title:'สถานะโต๊ะ'},!data.tables||!data.orders?h(Empty,null,'โหลดสถานะโต๊ะไม่สำเร็จ'):h(React.Fragment,null,h('div',{className:'ro-donut',style:{background:tables.length?`conic-gradient(${stops.join(',')})`:'#e8eef2'}},h('div',null,h('small',null,'ทั้งหมด'),h('strong',null,`${tables.length} โต๊ะ`))),h('div',{className:'ro-table-legend'},...tableGroups.map(group=>h('div',{key:group.label},h('span',null,h('i',{style:{background:group.color}}),group.label),h('span',null,group.value))))))),
    h('div',{className:'ro-bottom'},h(Panel,{title:'ภาพรวมโต๊ะ',action:h(Link,{to:'/dashboard/tables'},'จัดการ ↗')},h('p',{className:'ro-subtitle'},'สถานะการเปิดรับออเดอร์และยอดค้างชำระ'),!data.tables||!data.orders?h(Empty,null,'โหลดข้อมูลโต๊ะไม่สำเร็จ'):tables.length?h('div',{className:'ro-tables'},...tables.slice(0,8).map(table=>h(Link,{to:'/dashboard/tables?view=status',key:table.id,className:`ro-table-tile ${active.has(table.id)?'busy':table.is_open?'open':'closed'}`},h('strong',null,`โต๊ะ ${table.table_number}`),h('small',null,active.has(table.id)?'ค้างชำระ':table.is_open?'เปิดรับ':'ปิดรับ')))):h(Empty,null,'ยังไม่มีโต๊ะ'),tables.length>8?h(Link,{className:'ro-more',to:'/dashboard/tables'},`ดูทั้งหมด ${tables.length} โต๊ะ →`):null),
      h(Panel,{title:'ออเดอร์ล่าสุด',action:h(Link,{to:'/dashboard/bills'},'ดูทั้งหมด')},h(DataTable,{headers:['ออเดอร์','โต๊ะ','สถานะ','ยอดรวม','เวลา'],rows:recent.map(order=>[h('span',{title:order.id},`#${order.id.slice(0,6)}`),order.tableNumber??'—',h('span',{className:`ro-badge ${order.paid?'paid':order.status}`},status(order)),money(order.total),new Date(order.createdAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})])})),
      canStock?h(Panel,{title:'สินค้าคงเหลือใกล้หมด',action:h(Link,{to:'/dashboard/inventory?view=low'},'ดูทั้งหมด')},data.items?h(DataTable,{headers:['วัตถุดิบ','คงเหลือ','ขั้นต่ำ','สถานะ'],rows:data.items.filter(item=>item.active&&item.track_stock).slice(0,5).map(item=>[item.name,`${number(item.quantity)} ${item.unit}`,number(item.minimum_stock),h('span',{className:'ro-badge low'},'● ใกล้หมด')])}):h(Empty,null,'โหลดข้อมูลสต็อกไม่สำเร็จ')):h(Panel,{title:'สถานะออเดอร์วันนี้'},h(DataTable,{headers:['สถานะ','จำนวน'],rows:[['รอทำ',s.pendingCount],['พร้อมเสิร์ฟ',s.readyCount],['เสิร์ฟแล้ว',s.servedCount],['ยกเลิก',s.cancelledCount]]}))),
    h('footer',{className:'ro-footer'},h('span',null,`\u00A9 ${new Date().getFullYear()} ShopQR`),h('span',null,'\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E23\u0E49\u0E32\u0E19\u0E2D\u0E32\u0E2B\u0E32\u0E23')));
}
