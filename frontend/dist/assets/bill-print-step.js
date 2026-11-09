import {r as React,j as h} from './vendor-react-DCUvmuBu.js';
export function receiptPreviewHtml(html){
  return html.replace('</head>',`<style>
    @media screen {
      html { background:#fff; }
      body { zoom:1.65; padding-top:10px; padding-bottom:16px; }
      body,body * { color:#000 !important; font-weight:900 !important; opacity:1 !important; }
      .receipt-items th,.receipt-items td,.totals td,.summary { color:#000 !important; font-size:13px !important; font-weight:900 !important; opacity:1 !important; -webkit-text-stroke:.15px #000; }
      body table.totals tr,body table.totals tr td,body table.totals tr td * { color:#000 !important; font-size:13px !important; font-weight:900 !important; opacity:1 !important; filter:none !important; text-shadow:0 0 .35px #000 !important; -webkit-text-stroke:.2px #000; }
      body table.totals tr:nth-child(2) td,body table.totals tr:nth-child(2) td * { color:#000 !important; font-size:14px !important; font-weight:900 !important; opacity:1 !important; filter:none !important; text-shadow:0 0 .45px #000 !important; -webkit-text-stroke:.25px #000; }
    }
    @media screen and (max-width:480px) { body { zoom:1.4; } }
    @media screen and (max-width:420px) { body { zoom:1.2; } }
    @media screen and (max-width:360px) { body { zoom:1; } }
  </style></head>`);
}
export function BillPrintStep({html,locale,onClose,onPrint,printerControls}){
  const subtitle=locale==='en'?'Thank you for visiting':'ขอบคุณที่ใช้บริการ';
  const ref=React.useRef(null);
  const preview=React.useMemo(()=>receiptPreviewHtml(html),[html]);
  const labels=locale==='lo'?['ຊຳລະສຳເລັດ · ພິມໃບບິນ','ພິມໃບບິນ','ສຳເລັດ','ຕົວຢ່າງໃບບິນ']:locale==='en'?['Payment complete · Print receipt','Print receipt','Done','Receipt preview']:['ชำระสำเร็จ · พิมพ์ใบเสร็จ','พิมพ์ใบเสร็จ','เสร็จสิ้น','ตัวอย่างใบเสร็จ'];
  React.useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close()},[]);
  return h.jsxs('dialog',{ref,className:'bill-print-step',onCancel:onClose,children:[
    h.jsxs('header',{children:[h.jsxs('div',{className:'bill-print-heading',children:[h.jsx('h2',{children:labels[0]}),h.jsx('p',{children:subtitle})]}),h.jsx('button',{type:'button',onClick:onClose,'aria-label':labels[2],children:'×'})]}),
    h.jsx('iframe',{title:labels[3],srcDoc:preview,sandbox:'',className:'bill-print-preview'}),
    h.jsxs('footer',{children:[printerControls,h.jsx('button',{type:'button',className:'bill-print-primary',onClick:onPrint,children:labels[1]}),h.jsx('button',{type:'button',onClick:onClose,children:labels[2]})]})
  ]});
}
