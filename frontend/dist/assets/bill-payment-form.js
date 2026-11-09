import { j as h } from './vendor-react-DCUvmuBu.js';
export function paymentSplitState(transferValue,cashValue,total){
 const transfer=Number(transferValue),cash=Number(cashValue),due=Math.max(0,Number(total)-transfer);
 const valid=String(transferValue).trim()!==''&&String(cashValue).trim()!==''&&Number.isFinite(transfer)&&Number.isFinite(cash)&&transfer>=0&&transfer<=Number(total)&&cash>=due;
 return {valid,transfer,cash,due,change:valid?Math.round((cash-due+Number.EPSILON)*100)/100:0};
}
function formatAmount(value){
 const parts=String(value??'').split('.'),whole=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return parts.length>1?`${whole}.${parts.slice(1).join('')}`:whole;
}
function parseAmount(value){
 const clean=String(value).replace(/,/g,'').replace(/[^\d.]/g,'');
 const point=clean.indexOf('.');
 return point<0?clean:`${clean.slice(0,point+1)}${clean.slice(point+1).replace(/\./g,'')}`;
}
export function BillPaymentForm({transferAmount,onTransferAmount,cashReceived,onCashReceived,total,disabled,locale}){
 const labels=locale==='lo'?['ຈຳນວນເງິນໂອນ','ເງິນສົດທີ່ຮັບມາ','ເງິນສົດທີ່ຕ້ອງຈ່າຍ','ເງິນທອນ','ເງິນໂອນຕ້ອງບໍ່ເກີນຍອດບິນ ແລະ ຍອດເງິນສົດຕ້ອງຄົບ']:locale==='en'?['Transfer amount','Cash received','Cash amount due','Change','Transfer must not exceed the bill and cash must cover the remainder']:['ยอดเงินโอน','เงินสดที่รับมา','ยอดเงินสดที่ต้องจ่าย','เงินทอน','ยอดโอนต้องไม่เกินยอดบิล และเงินสดต้องครบยอดที่เหลือ'];
 const state=paymentSplitState(transferAmount,cashReceived,total),money=value=>Number(value||0).toLocaleString('en-US',{maximumFractionDigits:2});
 const field=(id,label,value,onChange)=>h.jsxs('label',{className:'block text-sm font-semibold text-ink',htmlFor:id,children:[label,h.jsx('div',{className:'mt-1 flex items-center overflow-hidden rounded-xl border border-line bg-surface',children:[h.jsx('span',{className:'px-3 text-xs text-muted',children:'LAK'}),h.jsx('input',{id,type:'text',inputMode:'decimal',value:formatAmount(value),disabled,onChange:e=>{const input=e.currentTarget,position=input.selectionStart??input.value.length,before=parseAmount(input.value.slice(0,position)),next=parseAmount(input.value);onChange(next);requestAnimationFrame(()=>{if(input.isConnected){const caret=formatAmount(before).length;input.setSelectionRange(caret,caret)}})},className:'min-w-0 flex-1 bg-transparent px-3 py-3 text-right text-base font-semibold tabular-nums outline-none'})]})]});
 return h.jsxs('div',{className:'bill-payment-form space-y-3',children:[field('bill-transfer-amount',labels[0],transferAmount,onTransferAmount),field('bill-cash-received',labels[1],cashReceived,onCashReceived),h.jsxs('div',{className:'rounded-xl border border-line bg-canvas p-3 text-sm',children:[h.jsxs('div',{className:'flex justify-between',children:[h.jsx('span',{children:labels[2]}),h.jsx('b',{children:money(state.due)})]}),h.jsxs('div',{className:'mt-2 flex justify-between',children:[h.jsx('span',{children:labels[3]}),h.jsx('b',{className:'text-emerald-800',children:money(state.change)})]})]}),!state.valid?h.jsx('p',{role:'alert',className:'text-xs text-rose-700',children:labels[4]}):null]});
}
