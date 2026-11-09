import {r as React,j as h} from './vendor-react-DCUvmuBu.js';
export function BankAccountSettings({restaurantId}){
  const key='shopqr.bank-details.'+restaurantId;
  const [draft,setDraft]=React.useState(()=>{try{return JSON.parse(localStorage.getItem(key))||{}}catch{return {}}}),[message,setMessage]=React.useState('');
  function save(event){event.preventDefault();if(!['bank','name','number'].every(field=>draft[field]?.trim()))return;try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(['bank','name','number'].map(field=>[field,draft[field].trim()]))));setMessage('บันทึกข้อมูลบัญชีแล้ว')}catch{setMessage('บันทึกไม่สำเร็จ กรุณาตรวจสอบการจัดเก็บข้อมูลของเบราว์เซอร์')}}
  return h.jsxs('form',{className:'bank-account-settings',onSubmit:save,children:[h.jsx('h3',{children:'บัญชีรับเงินโอน'}),...['bank','name','number'].map((field,index)=>h.jsxs('label',{children:[['ธนาคาร','ชื่อบัญชี','เลขบัญชี'][index],h.jsx('input',{type:'text',required:true,value:draft[field]||'',onChange:e=>{setDraft({...draft,[field]:e.target.value});setMessage('')}})]},field)),h.jsx('small',{children:'บันทึกแยกตามร้านในเบราว์เซอร์นี้ ใช้แสดงในหน้าเช็คบิล'}),h.jsx('button',{type:'submit',children:'บันทึกบัญชีรับเงิน'}),message?h.jsx('p',{role:'status',children:message}):null]});
}
