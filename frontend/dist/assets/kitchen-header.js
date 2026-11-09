import {r as React,j as jsx} from './vendor-react-DCUvmuBu.js';
import {useKitchenSound,j as navigate,e as request} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';

const PrinterSettingsContext=React.createContext(null);
export function KitchenPrinterProvider({children}) {
  const [open,setOpen]=React.useState(()=>new URLSearchParams(location.search).get('printer')==='1');
  return jsx.jsx(PrinterSettingsContext.Provider,{value:{open,setOpen},children});
}
export function KitchenOrderContent({children}) {
  const {open}=React.useContext(PrinterSettingsContext);
  return jsx.jsx('div',{hidden:open,className:'kitchen-order-content space-y-4',children});
}
export function KitchenPrinterPanel({children}) {
  const {open,setOpen}=React.useContext(PrinterSettingsContext);
  const close=()=>{
    setOpen(false);
    document.getElementById('kitchen-printer-toggle')?.focus();
  };
  return jsx.jsxs('section',{id:'kitchen-printer-settings',hidden:!open,'aria-label':'ตั้งค่าเครื่องพิมพ์ครัว',onKeyDown:event=>{if(event.key==='Escape'){event.stopPropagation();close()}},children:[
    jsx.jsx('div',{className:'kitchen-printer-close',children:jsx.jsx('button',{type:'button',onClick:close,children:'ปิดการตั้งค่า ×'})}),
    children
  ]});
}

export function KitchenHeader({role,restaurantId}) {
  const printerSettings=React.useContext(PrinterSettingsContext);
  const [pending,setPending]=React.useState(null);
  const {soundOn,toggle}=useKitchenSound();
  React.useEffect(()=>{
    let stopped=false,busy=false;
    setPending(null);
    async function refresh(){
      if(!restaurantId||busy)return;
      busy=true;
      try{
        const {summary}=await request(`/api/restaurants/${restaurantId}/dashboard-summary`);
        if(!stopped)setPending(Math.max(0,Number(summary.pendingCount)||0));
      }catch{if(!stopped)setPending(null)}finally{busy=false}
    }
    refresh();
    const timer=setInterval(refresh,5000);
    return()=>{stopped=true;clearInterval(timer)};
  },[restaurantId]);
  const showPrinter=()=>{
    printerSettings.setOpen(open=>!open);
  };
  return jsx.jsxs('header',{className:'kitchen-reference-header',children:[
    jsx.jsxs('div',{className:'kitchen-heading',children:[
      jsx.jsx('span',{className:'kitchen-chef','aria-hidden':true,children:'💁‍♀️'}),
      jsx.jsxs('div',{children:[jsx.jsx('h1',{children:'จัดการออเดอร์'}),jsx.jsx('p',{children:'จัดการออเดอร์จากลูกค้า แบบเรียลไทม์'})]})
    ]}),
    jsx.jsxs('div',{className:'kitchen-header-right',children:[
      jsx.jsx('div',{className:'kitchen-header-meta',children:[]}),
      jsx.jsxs('div',{className:'kitchen-header-actions',children:[
        
        ['owner','cook'].includes(role)?jsx.jsx('button',{id:'kitchen-printer-toggle',type:'button',onClick:showPrinter,'aria-expanded':printerSettings.open,'aria-controls':'kitchen-printer-settings',children:'🖨 ตั้งค่าเครื่องพิมพ์'}):null,
        
      ]})
    ]})
  ]});
}
