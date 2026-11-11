import {r as React, j as jsx} from './vendor-react-DCUvmuBu.js';
import {e as api, j as navigate, n as logout} from './index-BjXGGWCT.js?v=20261111-account-activity-v1';

const owner = ['owner'];
const team = ['owner', 'cook', 'waiter', 'staff'];
const link = (label, page, view, roles = owner) => ({label, href: `/dashboard/${page}${view ? `?view=${view}` : ''}`, roles});
export const groups = [
  {label:'▦ หลังบ้านร้าน', href:'/dashboard/backend', roles:owner},
  {label:'📦 สต็อก', items:[{label:'ฝากสินค้า', href:'/dashboard/stock-deposits', roles:team},link('จัดการเมนู และ สต็อก','menu'),link('ประวัติขายออก และ ตัดสต็อก','menu','outgoing-history'),link('สต็อกวัตถุดิบ และ สูตรอาหาร','inventory','recipes'),{...link('\u0e42\u0e1b\u0e23\u0e42\u0e21\u0e0a\u0e31\u0e19','promotions'),key:'promotions'},link('วิเคราะห์สินค้า','close-shop')]},
  
  {label:'🪑 โต๊ะ', href:'/dashboard/tables', roles:team},{label:'🧾 ออเดอร์', href:'/dashboard/kitchen?view=new', roles:team, badge:'kitchen'},
  {label:'👨‍🍳 ห้องครัว', href:'/dashboard/kitchen', roles:team, badge:'kitchen'},
  {label:'💰 การเงิน', href:'/dashboard/finance', roles:owner},
];
export function ManagerNavigation({role, restaurantId, navigate, current, existing, translate, badges}) {
  const [financeAccess,setFinanceAccess]=React.useState(false);
  React.useEffect(()=>{let stopped=false;setFinanceAccess(false);if(role!=='owner'&&restaurantId)api(`/api/restaurants/${restaurantId}/finance/access`).then(v=>{if(!stopped)setFinanceAccess(v.view);}).catch(()=>{});return()=>{stopped=true;};},[role,restaurantId]);
  const [stockExpanded,setStockExpanded]=React.useState(true);
  const currentRoute = new URL(current, window.location.origin);
  currentRoute.searchParams.delete('ui');
  const normalizedCurrent = `${currentRoute.pathname}${currentRoute.search}`;
  const active = href => normalizedCurrent === href || (href === '/dashboard/finance' && normalizedCurrent.split('?')[0] === href) || (href === '/dashboard/menu' && normalizedCurrent === '/dashboard/menu?view=add');
  const button = (item, child=false) => jsx.jsx('button', {type:'button', onClick:event=>{if(child)event.stopPropagation();if(item.action==='staff-chat')window.dispatchEvent(new Event('shopqr:open-staff-chat'));else{window.dispatchEvent(new Event('shopqr:before-dashboard-navigation'));navigateDashboard(item.href,navigate);}}, 'aria-current':active(item.href)?'page':undefined,
    style:{display:'flex',alignItems:'center',gap:6,width:'100%',textAlign:'left',padding:child?'2px 10px 2px 42px':'7px 10px',lineHeight:child?'18px':'20px',borderRadius:8,fontSize:14,color:active(item.href)?'#174a34':'#f7ead2',background:active(item.href)?'#f4e4bd':'transparent'},
    children:[item.icon?jsx.jsx('span',{className:'manager-navigation-icon','aria-hidden':true,children:item.icon},'icon'):null,jsx.jsx('span',{style:{flex:1},children:item.label},'label'),item.badge && badges[item.badge]>0?jsx.jsx('span',{className:'manager-nav-badge',children:badges[item.badge]},'badge'):null]
  },item.key||item.href);
  const managedRoutes = new Set(['finance','menu','categories','inventory','tables','kitchen','stats','close-shop','promotions','bills','settings','stock-deposits']);
  const routeName = href => String(href || '').split(/[?#]/,1)[0].replace(/\/+$/,'').split('/').pop();
  const preserved = existing.filter(item=>!managedRoutes.has(routeName(item.href)));
  return jsx.jsxs('div',{className:'manager-navigation','data-restaurant-id':restaurantId,children:[
    ...preserved.filter(item=>item.href==='/dashboard').map(item=>button({...item,label:translate(item.labelKey),icon:'🏠'})),
    ...groups.map(group=>{
      if(!group.items) { if(group.href==='/dashboard/finance') { const billsItem=existing.find(item=>item.href.split('?')[0]==='/dashboard/bills'); return jsx.jsxs(React.Fragment,{children:[billsItem?button({...billsItem,label:translate(billsItem.labelKey),icon:'🧾'}):null,(group.roles.includes(role)||financeAccess)?button(group):null]},'bills-finance'); } return group.roles.includes(role)?button(group):null; }
      const items=group.items.filter(item=>item.roles.includes(role));
      return items.length?jsx.jsxs('div',{className:'manager-navigation-group',style:{marginBottom:0},children:[jsx.jsx('button',{type:'button','aria-expanded':stockExpanded,onClick:()=>setStockExpanded(value=>!value),style:{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',padding:'3px 10px',lineHeight:'18px',fontWeight:600,fontSize:14,color:'#fff8e8',background:'transparent',border:0,cursor:'pointer'},children:[jsx.jsx('span',{children:group.label}),jsx.jsx('span',{className:'manager-navigation-arrow','aria-hidden':true,style:{transform:stockExpanded?'rotate(90deg)':'rotate(0deg)'},children:'\u203a'})]}),stockExpanded?items.map(item=>button(item,true)):null ]},group.label):null;
    }),
    ...preserved.filter(item=>item.href!=='/dashboard').map(item=>button({...item,label:translate(item.labelKey),icon:({bills:'🧾',audit:'📝',feedback:'💬',settings:'⚙️'})[item.href.split('?')[0].split('/').pop()]}))
  ]});
}

function unifiedDashboardHref(href) {
  const target = new URL(href, window.location.origin);
  target.searchParams.delete('ui');
  return `${target.pathname}${target.search}${target.hash}`;
}

function navigateDashboard(href, navigatePage = navigate) {
  navigatePage(unifiedDashboardHref(href));
}

function GlobalProfile(){
  const [open,setOpen]=React.useState(false);
  const [user,setUser]=React.useState(null);
  const [photo,setPhoto]=React.useState('');
  const [photoError,setPhotoError]=React.useState('');
  const [lastActive,setLastActive]=React.useState(()=>Date.now());
  const [now,setNow]=React.useState(()=>Date.now());
  React.useEffect(()=>{let live=true,cleanup=()=>{};api('/api/auth/me').then(result=>{if(!live)return;const value=result?.user??null;setUser(value);let imageKey='shopqr.profile-photo.'+(value?.id||'session');try{setPhoto(localStorage.getItem(imageKey)||'')}catch{};const key='shopqr.profile-presence.'+(value?.id||'session');const read=()=>{try{const data=JSON.parse(localStorage.getItem(key)||'null');if(Number(data?.at)>0)setLastActive(Number(data.at))}catch{}};const touch=()=>{const at=Date.now();try{localStorage.setItem(key,JSON.stringify({at}))}catch{};setLastActive(at);setNow(at)};let lastEvent=0;const activity=()=>{const at=Date.now();if(at-lastEvent<15000)return;lastEvent=at;touch()};read();touch();const events=['pointerdown','pointermove','keydown','touchstart','scroll','click'];events.forEach(name=>window.addEventListener(name,activity,{passive:true}));const interval=setInterval(()=>{setNow(Date.now());read()},15000);const storage=event=>{if(event.key===key)read()};window.addEventListener('storage',storage);cleanup=()=>{events.forEach(name=>window.removeEventListener(name,activity));clearInterval(interval);window.removeEventListener('storage',storage)}}).catch(()=>{});return()=>{live=false;cleanup()}},[]);
  const name=user?.display_name?.trim()||user?.email||'Profile';
  const initial=Array.from(name)[0]?.toUpperCase()||'P';
  const online=now-lastActive<5*60*1000;
  const seen=new Intl.DateTimeFormat('th-TH-u-ca-gregory',{hour:'2-digit',minute:'2-digit'}).format(new Date(lastActive));
  function upload(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024){setPhotoError('Choose PNG, JPG or WebP under 1 MB');return}const reader=new FileReader();reader.onload=()=>{try{const value=String(reader.result||'');localStorage.setItem('shopqr.profile-photo.'+(user?.id||'session'),value);setPhoto(value);setPhotoError('')}catch{setPhotoError('Could not save image; choose a smaller file')}};reader.onerror=()=>setPhotoError('Could not read image');reader.readAsDataURL(file)}
  async function signout(){setOpen(false);try{await logout()}finally{navigate('/login')}}
  return jsx.jsxs('div',{className:'global-profile',children:[jsx.jsx('button',{type:'button',className:'global-profile-trigger '+(online?'online':'idle'),title:online?'Online':'Offline - Last seen '+seen,'aria-label':name+' profile','aria-haspopup':'menu','aria-expanded':open,onClick:()=>setOpen(value=>!value),children:photo?jsx.jsx('img',{src:photo,alt:''}):jsx.jsx('span',{children:initial})}),open?jsx.jsxs('div',{className:'global-profile-menu',role:'menu',children:[jsx.jsxs('div',{className:'global-profile-user',children:[jsx.jsx('label',{className:'global-profile-photo',title:'Change profile photo',children:[photo?jsx.jsx('img',{src:photo,alt:''}):initial,jsx.jsx('input',{type:'file',accept:'image/png,image/jpeg,image/webp','aria-label':'Choose profile photo',onChange:upload})]}),jsx.jsxs('div',{className:'global-profile-info',children:[jsx.jsx('strong',{children:name}),jsx.jsx('small',{children:user?.email||user?.role||'Signed in'}),jsx.jsxs('small',{className:'global-profile-status '+(online?'online':'idle'),children:[jsx.jsx('i',{}),online?'Online':'Offline - Last seen '+seen]})]})]}),photoError?jsx.jsx('p',{className:'global-profile-error',role:'alert',children:photoError}):null,jsx.jsx('button',{role:'menuitem',onClick:()=>{setOpen(false);navigateDashboard('/dashboard/settings')},children:'ตั้งค่าระบบ'}),jsx.jsx('button',{role:'menuitem',className:'global-profile-upgrade',onClick:()=>{setOpen(false);navigateDashboard('/dashboard/settings')},children:'อัปเกรดโปร'}),jsx.jsx('button',{role:'menuitem',onClick:signout,children:'ออกจากระบบ'})]}):null]});
}
export function NavigationView() {
  const view=new URLSearchParams(location.search).get('view');
  const currentRoute=new URL(location.href);currentRoute.searchParams.delete('ui');
  const item=groups.flatMap(group=>group.items||[]).find(item=>item.href===currentRoute.pathname+currentRoute.search);
  React.useEffect(()=>{
    if(view!=='add' || location.pathname!=='/dashboard/menu')return;
    const observer=new MutationObserver(focusForm);
    function focusForm(){const form=document.getElementById('menu-add-form');if(form){form.scrollIntoView({block:'start'});form.querySelector('input')?.focus({preventScroll:true});observer.disconnect();}}
    observer.observe(document.getElementById('root'),{childList:true,subtree:true});focusForm();return()=>observer.disconnect();
  },[view]);
  React.useEffect(()=>{
    let lastPing=0;
    const ping=()=>{
      if(document.visibilityState==='hidden')return;
      const now=Date.now();
      if(now-lastPing<60_000)return;
      lastPing=now;
      api('/api/auth/activity',{method:'POST'}).catch(()=>{});
    };
    const onVisibility=()=>{if(document.visibilityState==='visible')ping()};
    const events=['pointerdown','pointermove','keydown','touchstart','scroll','click'];
    events.forEach(name=>window.addEventListener(name,ping,{passive:true}));
    document.addEventListener('visibilitychange',onVisibility);
    ping();
    return()=>{
      events.forEach(name=>window.removeEventListener(name,ping));
      document.removeEventListener('visibilitychange',onVisibility);
    };
  },[]);
  // These pages already supply their own heading.
  const showGlobalProfile=!['/dashboard','/dashboard/home'].includes(location.pathname);
  if(location.pathname==='/dashboard/menu'||location.pathname==='/dashboard/finance'||(location.pathname==='/dashboard/inventory'&&view==='recipes')||(location.pathname==='/dashboard/kitchen'&&view==='new')||location.pathname==='/dashboard/stock-deposits')return showGlobalProfile?jsx.jsx(GlobalProfile,{}):null;
  const hint={receive:'เลือกวัตถุดิบ แล้วกด + รับเข้า เพื่อบันทึกจำนวนที่รับ',issue:'เลือกวัตถุดิบ แล้วกด - เบิกออก เพื่อบันทึกการตัดสต็อก',cooking:'ระบบปัจจุบันใช้สถานะรอดำเนินการร่วมกับออเดอร์ใหม่ ยังไม่มีสถานะกำลังทำแยกต่างหาก',status:'ดูสถานะเปิด–ปิดของแต่ละโต๊ะด้านล่าง',qr:'ดูและดาวน์โหลด QR Code ของแต่ละโต๊ะด้านล่าง',daily:'ยอดขายแยกรายวันใน 7 วันล่าสุด',month:'รายละเอียดรายการขายในเดือนปัจจุบัน'}[view];
  return jsx.jsxs(React.Fragment,{children:[showGlobalProfile?jsx.jsx(GlobalProfile,{}):null,view&&item?jsx.jsxs('section',{style:{marginBottom:20,padding:16,borderRadius:12,background:'#fff',border:'1px solid #e0e5df'},children:[jsx.jsx('h2',{style:{fontWeight:600,fontSize:20},children:item.label}),hint?jsx.jsx('p',{style:{marginTop:4,fontSize:14,color:'#65736a'},children:hint}):null]}):null]});
}
