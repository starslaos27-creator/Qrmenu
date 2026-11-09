import {BillPrinterPreferences} from "./bill-printer-preferences.js";
import {r as React,j as h} from './vendor-react-DCUvmuBu.js';
import {j as navigate} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';
function PrinterDialog({controls,onClose,labels}){
  const ref=React.useRef(null);
  React.useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close()},[]);
  return h.jsxs('dialog',{ref,className:'bill-print-step bill-printer-settings',onCancel:onClose,children:[
    h.jsxs('header',{children:[h.jsx('h2',{children:labels[0]}),h.jsx('button',{type:'button',onClick:onClose,'aria-label':labels[2],children:'×'})]}),
    h.jsxs('div',{className:'bill-printer-settings-body',children:[h.jsx('p',{children:labels[3]}),controls,h.jsx('p',{children:labels[4]})]}),
    h.jsx('footer',{children:h.jsx('button',{type:'button',onClick:onClose,children:labels[2]})})
  ]});
}
export function BillSettingsActions({locale,canManage,printerControls}){
  const [open,setOpen]=React.useState(false),[preferences,setPreferences]=React.useState(false);
  const labels=locale==='lo'?['ຕັ້ງຄ່າເຄື່ອງພິມ','ຕັ້ງຄ່າ','ປິດ','ເຊື່ອມຕໍ່ ຫຼື ຕັດການເຊື່ອມຕໍ່ເຄື່ອງພິມໃບບິນ Bluetooth / USB','ສຳລັບການພິມຜ່ານເບຣົາເຊີ ໃຫ້ເລືອກເຄື່ອງພິມ ແລະ ຂະໜາດເຈ້ຍໃນໜ້າພິມໃບບິນ.']:locale==='en'?['Printer settings','Settings','Close','Connect or disconnect your Bluetooth / USB receipt printer.','For browser printing, select your printer and paper size in the receipt print dialog.']:['ตั้งค่าเครื่องพิมพ์','ตั้งค่า','ปิด','เชื่อมต่อหรือยกเลิกการเชื่อมต่อเครื่องพิมพ์ใบเสร็จ Bluetooth / USB','สำหรับการพิมพ์ผ่านเบราว์เซอร์ เลือกเครื่องพิมพ์และขนาดกระดาษในหน้าต่างพิมพ์ใบเสร็จ'];
  return h.jsxs(h.Fragment,{children:[
    h.jsx('button',{type:'button',onClick:()=>setOpen(true),'aria-haspopup':'dialog',children:'🖨 '+labels[0]}),
    h.jsx('button',{type:'button',onClick:()=>setPreferences(true),'aria-haspopup':'dialog',children:'ตั้งค่าปริ้นเตอร์'}),
    preferences?h.jsx(BillPrinterPreferences,{onClose:()=>setPreferences(false)}):null,
    canManage?h.jsx('button',{type:'button',onClick:()=>navigate('/dashboard/settings'),children:'⚙ '+labels[1]}):null,
    open?h.jsx(PrinterDialog,{controls:printerControls,onClose:()=>setOpen(false),labels}):null
  ]});
}
