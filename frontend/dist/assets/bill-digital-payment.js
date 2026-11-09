import {r as React,j as h} from './vendor-react-DCUvmuBu.js';
export function BillDigitalPayment({method,total,qrUrl,restaurantId,canManage,locale}){
  const key='shopqr.bank-details.'+restaurantId;
  const [bank,setBank]=React.useState(()=>{try{return JSON.parse(localStorage.getItem(key))||{}}catch{return {}}});
  const [message,setMessage]=React.useState(''),[failed,setFailed]=React.useState(false);
  React.useEffect(()=>setFailed(false),[qrUrl]);
  const t=locale==='lo'?['ທະນາຄານ','ຊື່ບັນຊີ','ເລກບັນຊີ','ຄັດລອກເລກບັນຊີ','ຄັດລອກແລ້ວ','ກະລຸນາເລືອກ ແລະ ຄັດລອກເລກບັນຊີເອງ','ຕັ້ງຄ່າບັນຊີ','ບັນທຶກ','ຍົກເລີກ','ຍັງບໍ່ໄດ້ຕັ້ງຄ່າບັນຊີຮັບເງິນ','ສະແກນ QR ຂອງຮ້ານເພື່ອຊຳລະ','ຍອດທີ່ຕ້ອງຊຳລະ','ບໍ່ມີ QR ຫຼື ໂຫຼດບໍ່ສຳເລັດ ກະລຸນາກວດສອບໃນຕັ້ງຄ່າຮ້ານ','ກວດສອບຍອດເງິນເຂົ້າກ່ອນຢືນຢັນຮັບຊຳລະ','ຂໍ້ມູນບັນຊີບັນທຶກໃນເບຣົາເຊີນີ້ ແຍກຕາມຮ້ານ','ບັນທຶກບໍ່ສຳເລັດ']:locale==='en'?['Bank','Account name','Account number','Copy account number','Copied','Select and copy the account number manually','Account settings','Save','Cancel','No receiving account configured','Scan the shop QR to pay','Amount due','QR unavailable. Check the shop QR in Settings.','Verify the payment before confirming receipt','Account details are saved per shop in this browser','Could not save']:['ธนาคาร','ชื่อบัญชี','เลขบัญชี','คัดลอกเลขบัญชี','คัดลอกแล้ว','กรุณาเลือกและคัดลอกเลขบัญชีด้วยตนเอง','ตั้งค่าบัญชี','บันทึก','ยกเลิก','ยังไม่ได้ตั้งค่าบัญชีรับเงิน','สแกน QR ของร้านเพื่อชำระเงิน','ยอดที่ต้องชำระ','ไม่มี QR หรือโหลดไม่สำเร็จ กรุณาตรวจสอบในตั้งค่าร้าน','ตรวจสอบยอดเงินเข้าก่อนยืนยันรับชำระ','ข้อมูลบัญชีบันทึกในเบราว์เซอร์นี้ แยกตามร้าน','บันทึกไม่สำเร็จ'];
  async function copy(){try{await navigator.clipboard.writeText(bank.number);setMessage(t[4])}catch{setMessage(t[5])}}
  const amount=h.jsx('div',{className:'bill-digital-amount',children:t[11]+': '+Number(total).toLocaleString('en-US',{maximumFractionDigits:2})+' LAK'});
  return h.jsxs('section',{className:'bill-digital-panel',children:[
    method==='promptpay'?h.jsxs('div',{className:'bill-qr-payment',children:[qrUrl&&!failed?h.jsx('img',{src:qrUrl,alt:'QR '+t[10],onError:()=>setFailed(true)}):h.jsx('div',{className:'bill-qr-missing',role:'status',children:t[12]}),h.jsx('strong',{children:t[10]}),amount]}):h.jsxs(h.Fragment,{children:[
      bank.number?h.jsx('dl',{children:['bank','name','number'].map((field,index)=>h.jsxs('div',{className:'bill-bank-row',children:[h.jsx('dt',{children:t[index]}),h.jsx('dd',{className:field==='number'?'bill-bank-number':'',children:field==='number'?h.jsxs('span',{className:'bill-bank-number-actions',children:[h.jsx('span',{children:bank[field]}),h.jsx('button',{type:'button',onClick:copy,children:t[3]})]}):bank[field]||'—'})]},field))}):h.jsx('p',{children:t[9]}),
      amount
    ]}),
    message?h.jsx('p',{role:'status',children:message}):null,h.jsx('small',{className:'bill-payment-reminder',children:t[13]})
  ]});
}
