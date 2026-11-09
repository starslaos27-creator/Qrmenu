import {r as React,j as h} from './vendor-react-DCUvmuBu.js';
import {receiptBusinessInfo} from './receipt-business-info.js';
export function readReceiptHeader(id){try{return JSON.parse(localStorage.getItem('shopqr.receipt-header.'+id))||{}}catch{return {}}}
async function encodeLogo(file){const bitmap=await createImageBitmap(file);try{for(const maxDimension of [2000,1600,1280]){const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('CANVAS_UNAVAILABLE');context.drawImage(bitmap,0,0,canvas.width,canvas.height);for(const quality of [.94,.9,.86,.82,.78]){const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('IMAGE_ENCODING_FAILED')),'image/webp',quality));if(blob.size<=1250*1024)return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('IMAGE_READ_FAILED'));reader.readAsDataURL(blob)})}}throw new Error('IMAGE_STORAGE_LIMIT')}finally{bitmap.close()}}
export const validReceiptLogo=value=>typeof value==='string'&&(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)||/^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/[\w./?&=%+-]+$/.test(value));
export function ReceiptHeaderSettings({restaurantId}){
  const [value,setValue]=React.useState(()=>({...receiptBusinessInfo[restaurantId],calendar:'buddhist',...readReceiptHeader(restaurantId)})),[message,setMessage]=React.useState('');
  const update=(field,next)=>{setValue(previous=>({...previous,[field]:next}));setMessage('')};
  function persistLogo(logo){const next={...value,logo};try{localStorage.setItem("shopqr.receipt-header."+restaurantId,JSON.stringify(next));setValue(next);setMessage("บันทึกโลโก้แล้ว");window.dispatchEvent(new CustomEvent("shopqr:restaurant-logo-updated",{detail:{restaurantId,logo}}))}catch{setMessage("บันทึกไม่สำเร็จ กรุณาลดขนาดรูปแล้วลองใหม่")}}
  async function upload(file){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){setMessage('Choose PNG, JPG or WebP up to 5 MB');return}try{persistLogo(await encodeLogo(file))}catch{setMessage('Could not save logo. Choose a smaller image.')}}
  function removeLogo(){persistLogo('')}

  return h.jsxs('section',{className:'receipt-header-settings',children:[

    h.jsxs('div',{className:'receipt-header-fields',children:[
      h.jsxs('div',{className:'receipt-field-logo',children:[validReceiptLogo(value.logo)?h.jsx('img',{src:value.logo,alt:'โลโก้ใบเสร็จ',width:72,height:72}):h.jsx('span',{className:'receipt-logo-placeholder','aria-hidden':true,children:'▧'}),h.jsxs('div',{className:'receipt-logo-copy',children:[h.jsx('strong',{children:'โลโก้ร้าน'}),h.jsx('small',{children:'PNG, JPG, WebP - up to 5 MB'})]}),h.jsxs('label',{className:'receipt-logo-upload',children:[value.logo?'เปลี่ยนรูป':'อัปโหลดโลโก้',h.jsx('input',{type:'file',accept:'image/png,image/jpeg,image/webp',onChange:e=>{upload(e.target.files?.[0]);e.target.value=''}})]}),value.logo?h.jsx('button',{type:'button',onClick:()=>removeLogo(),children:'ลบรูป'}):null]}),
      h.jsx('h4',{className:'receipt-group-contact',children:'ข้อมูลติดต่อร้าน'}),
      ...[['village','ที่อยู่ / บ้าน'],['district','เมือง'],['province','แขวง'],['phone','เบอร์โทร']].map(([field,label])=>h.jsxs('label',{className:'receipt-field-'+field,children:[label,h.jsx('input',{type:field==='phone'?'tel':'text',maxLength:field==='phone'?40:160,value:value[field]??'',onChange:e=>update(field,e.target.value)})]},field)),
      h.jsx('h4',{className:'receipt-group-format',children:'รูปแบบใบเสร็จ'}),
      h.jsxs('label',{className:'receipt-field-prefix',children:['คำนำหน้าเลขที่บิล',h.jsx('input',{type:'text',maxLength:30,placeholder:'BILL-',value:value.numberPrefix??'',onChange:e=>update('numberPrefix',e.target.value)}),h.jsx('small',{children:'เว้นว่างเพื่อใช้เลขเดิม'})]}),
      h.jsxs('label',{className:'receipt-field-tagline',children:['ข้อความโฆษณาบนหัวบิล',h.jsx('input',{type:'text',maxLength:160,value:value.tagline??'อร่อย สะอาด สดใหม่ ทุกจาน',onChange:e=>update('tagline',e.target.value)})]}),
      h.jsxs('label',{className:'receipt-field-calendar',children:['ปีที่แสดง',h.jsx('select',{value:value.calendar||'buddhist',onChange:e=>update('calendar',e.target.value),children:[h.jsx('option',{value:'buddhist',children:'พ.ศ.'}),h.jsx('option',{value:'gregory',children:'ค.ศ.'})]})]})
    ]}),
    h.jsx('div',{className:'receipt-header-toggles',children:[['showName','ชื่อร้าน'],['showNumber','เลขที่บิล'],['showDate','วันที่ / เดือน / ปี'],['showTime','เวลา']].map(([field,label])=>h.jsxs('label',{children:[h.jsx('input',{type:'checkbox',checked:value[field]!==false,onChange:e=>update(field,e.target.checked)}),label]},field))}),
    h.jsx('small',{children:'ใช้ชื่อร้านจากด้านบน · บันทึกเฉพาะเบราว์เซอร์นี้'}),
    h.jsx('button',{type:'button',onClick:()=>{try{localStorage.setItem('shopqr.receipt-header.'+restaurantId,JSON.stringify({...value,tagline:value.tagline??'อร่อย สะอาด สดใหม่ ทุกจาน'}));window.dispatchEvent(new CustomEvent('shopqr:restaurant-logo-updated',{detail:{restaurantId,logo:value.logo||''}}));setMessage('บันทึกหัวใบเสร็จแล้ว')}catch{setMessage('บันทึกไม่สำเร็จ กรุณาลดขนาดรูปและลองใหม่')}},children:'บันทึกหัวใบเสร็จ'}),
    message?h.jsx('p',{role:'status',children:message}):null
  ]});
}
