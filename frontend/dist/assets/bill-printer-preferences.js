import {r as React,j as h} from './vendor-react-DCUvmuBu.js';
const key='shopqr.bill-printer.v2';
export function readBillPrinter(){try{let raw=localStorage.getItem(key);if(!raw){const previous=JSON.parse(localStorage.getItem('shopqr.bill-printer.v1')||'{}');const migrated={...previous,width:80};raw=JSON.stringify(migrated);localStorage.setItem(key,raw)}const value=JSON.parse(raw||'{}');return {width:value.width===58?58:80,compact:value.compact===true,unitPrice:value.unitPrice!==false}}catch{return {width:80,compact:false,unitPrice:true}}}
export function billPrinterCss(base){
  const settings=readBillPrinter();
  // Thermal receipts must not inherit the A4 layout in a wide preview frame.
  let css=base,start;
  while((start=css.indexOf('@media (min-width:100mm)'))!==-1){let end=css.indexOf('{',start)+1,depth=1;while(depth&&end<css.length){if(css[end]==='{')depth++;if(css[end]==='}')depth--;end++}css=css.slice(0,start)+css.slice(end)}
  return css+`\n@page{size:auto;margin:0}
    body{width:${settings.width===80?72:48}mm;max-width:100%;margin:0 auto;color:#111;font-size:${settings.compact?10:11}px;line-height:1.45}
    h1{font-size:${settings.width===80?20:17}px;line-height:1.35;margin-bottom:5px}
    .receipt-meta-grid{gap:6px;font-size:9px;line-height:1.45;margin-top:8px}
    .receipt-issued .receipt-label{font-size:12px;margin-bottom:4px}
    hr{margin:8px 0;border-color:#888}
    th,td{padding:${settings.compact?3:6}px 2px}
    .receipt-items th{font-size:9px;line-height:1.3;vertical-align:middle;white-space:nowrap;border-color:#555}
    .receipt-items td:first-child{font-weight:500;line-height:1.5}
    .receipt-items .unit-price{width:25%;font-size:10px;white-space:nowrap;${settings.unitPrice?'':'display:none;'}}
    .receipt-items .qty{width:12%;font-size:10px;white-space:nowrap;text-align:center;font-weight:400}
    .receipt-items .total{width:28%;font-size:10px;white-space:nowrap;font-weight:400}
    .summary{margin:7px 0;font-size:10px}
    .totals td{padding:5px 2px;font-size:11px}
    .totals .total{width:40%;white-space:nowrap}
    .totals .grand{font-size:14px;padding:7px 2px;border-color:#333!important}
    .footer{margin-top:12px;padding-top:8px;font-size:9px}
    .receipt-location,.receipt-issued>div:not(.receipt-label),.receipt-tagline,.receipt-items td:first-child,.receipt-items td.unit-price,.receipt-items td.qty,.receipt-items td.total,.summary{font-family:inherit;font-size:${settings.compact?10:11}px;font-weight:400;line-height:1.45;color:#182620}
    body,body *{font-size:11px!important}
    hr{margin:4px 0}
    .receipt-items th,.receipt-items td{padding:2px 2px;line-height:1.2;color:#173b2c}
    .receipt-items td:first-child,.receipt-items td.unit-price,.receipt-items td.qty,.receipt-items td.total{font-weight:650;color:#173b2c}
    .summary{margin:3px 0;line-height:1.2;font-weight:650;color:#173b2c}
    .totals td{padding:2px 2px}
    .totals .grand{padding:3px 2px!important}
    body{color:#173b2c;background:#fff}
    .receipt-header{position:relative;margin-bottom:8px;padding:10px 6px 12px;border:1px solid #dbe7dc;border-radius:12px;background:linear-gradient(145deg,#fff 0%,#f4f7f0 100%);box-shadow:0 2px 8px #173b2c12}
    .receipt-header:before{display:none!important;content:none!important}
    .receipt-monogram{width:42px;height:42px;margin:0 auto 6px;border:2px solid #1b5a41;background:#edf4e9;color:#15533b}
    .receipt-header h1{color:#124a36;font-weight:800;letter-spacing:.01em}
    .receipt-address{color:#425d4d;line-height:1.45}
    .receipt-meta-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;margin-top:9px}
    .receipt-location,.receipt-issued{min-width:0;padding:7px;border:1px solid #e0e8dc;border-radius:9px;background:#f4f6ef;text-align:left;overflow-wrap:anywhere}
    .receipt-issued .receipt-label{display:block;margin:-7px -7px 5px;padding:5px 7px;border-radius:8px;background:#e4ebdf;color:#174d38;text-align:left}
    .receipt-items th{border:0;background:#08704e;color:#fff!important;font-weight:700}
    .receipt-items th:first-child{border-radius:7px 0 0 7px}
    .receipt-items th:last-child{border-radius:0 7px 7px 0}
    .receipt-items td{color:#173b2c}
    .receipt-item-index{display:inline-block;min-width:1.4em;margin-right:2px;font-weight:900}
    .summary{width:max-content;max-width:100%;margin:7px 0 8px auto;padding:5px 8px;border-radius:9px;background:#edf3e8;color:#174d38}
    .totals .grand{border:0!important;background:#15583e;color:#fff!important;border-radius:7px}
    .footer{color:#15583e;font-weight:700;border-color:#729580}
    .receipt-tagline{display:none!important}
    .receipt-date-label{line-height:1.45}.receipt-date-value{text-align:right;overflow-wrap:anywhere;line-height:1.45}.receipt-inline-time{white-space:nowrap}
    .receipt-location,.receipt-issued{display:grid;grid-template-rows:repeat(4,minmax(1.45em,auto));align-content:start;gap:0}
    .receipt-number-label,.receipt-number-value{grid-row:3}
    .receipt-date-label,.receipt-date-value{grid-row:4}
    .receipt-number-value{margin-top:0;text-align:right;overflow-wrap:anywhere;font-weight:700}
    .receipt-issued{position:relative}
    .receipt-issued .receipt-label{position:absolute;top:0;left:0;right:0;margin:0;padding:2px 3px;line-height:1.45}
    .receipt-meta-grid{gap:0;padding:7px;border:1px solid #e0e8dc;border-radius:9px;background:#f4f6ef}
    .receipt-location,.receipt-issued{padding:0;border:0;border-radius:0;background:transparent}
    body,body *{color:#000!important;font-size:12px!important;font-weight:800!important;opacity:1!important;text-shadow:none!important}
    h1{font-size:18px!important;font-weight:800!important}
    .receipt-issued .receipt-label{font-size:14px!important;font-weight:800!important}
    .receipt-monogram{font-size:20px!important;font-weight:800!important}
    .receipt-items th,.receipt-items td,.summary,.totals td,.footer{color:#000!important;font-weight:900!important;opacity:1!important;text-shadow:0 0 .25px #000;-webkit-text-stroke:.1px #000}
    body table.totals tr,body table.totals tr td,body table.totals tr td *{color:#000!important;font-size:13px!important;font-weight:900!important;opacity:1!important;filter:none!important;text-shadow:0 0 .35px #000!important;-webkit-text-stroke:.2px #000}

  `;
}
export function BillPrinterPreferences({onClose}){
  const ref=React.useRef(null),[value,setValue]=React.useState(readBillPrinter),[error,setError]=React.useState('');
  React.useEffect(()=>{ref.current.showModal();const dialog=ref.current;return()=>dialog.close()},[]);
  function save(event){event.preventDefault();try{localStorage.setItem(key,JSON.stringify(value));onClose()}catch{setError('บันทึกไม่สำเร็จ กรุณาตรวจสอบการอนุญาตจัดเก็บข้อมูลของเบราว์เซอร์')}}
  return h.jsx('dialog',{ref,className:'bill-print-step',onCancel:onClose,children:h.jsxs('form',{onSubmit:save,children:[
    h.jsxs('header',{children:[h.jsx('h2',{children:'ตั้งค่าปริ้นเตอร์ / รูปแบบใบเสร็จ'}),h.jsx('button',{type:'button',onClick:onClose,'aria-label':'ปิด',children:'×'})]}),
    h.jsxs('div',{className:'bill-printer-settings-body',children:[
      h.jsxs('label',{children:['ขนาดกระดาษ ',h.jsx('select',{value:value.width,onChange:e=>setValue({...value,width:Number(e.target.value)}),children:[58,80].map(width=>h.jsx('option',{value:width,children:width+' มม.'},width))})]}),
      h.jsxs('label',{children:[h.jsx('input',{type:'checkbox',checked:value.compact,onChange:e=>setValue({...value,compact:e.target.checked})}),' รูปแบบกระชับ (ลดระยะห่างรายการ)']}),
      h.jsxs('label',{children:[h.jsx('input',{type:'checkbox',checked:value.unitPrice,onChange:e=>setValue({...value,unitPrice:e.target.checked})}),' แสดงราคาต่อหน่วย']}),
      h.jsx('p',{children:'บันทึกสำหรับเบราว์เซอร์นี้ ใช้กับใบเสร็จและการพิมพ์ Bluetooth / USB ครั้งถัดไป หากพิมพ์ผ่านเบราว์เซอร์ ให้เลือกขนาดกระดาษในหน้าต่างพิมพ์ให้ตรงกัน'}),
      error?h.jsx('p',{role:'alert',children:error}):null
    ]}),
    h.jsxs('footer',{children:[h.jsx('button',{type:'button',onClick:onClose,children:'ยกเลิก'}),h.jsx('button',{type:'submit',className:'bill-print-primary',children:'บันทึก'})]})
  ]})});
}
