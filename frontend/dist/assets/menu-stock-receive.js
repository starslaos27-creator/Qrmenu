import {r as React, j as jsx} from './vendor-react-DCUvmuBu.js';
import {e as api} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';

export function MenuStockReceive({restaurantId, menus, onReceived}) {
  const [selected, setSelected] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [note, setNote] = React.useState('');
  const pending = React.useRef(false);
  const submission = React.useRef(null);
  const menu = menus.find(item => item.id === selected);
  async function receive(event) {
    event.preventDefault();
    if (pending.current) return;
    setMessage(''); setError('');
    const amount = Number(quantity);
    if (!menu || !Number.isFinite(amount) || amount < 0.001 || amount > 1000000000 || Math.abs(amount*1000-Math.round(amount*1000)) > 0.00001) {
      setError('กรุณาเลือกสินค้าและป้อนจำนวน 0.001–1,000,000,000 (ทศนิยมไม่เกิน 3 ตำแหน่ง)'); return;
    }
    pending.current = true; setBusy(true);
    try {
      const body = {quantity:amount,note:note.trim()||null};
      const signature = JSON.stringify([restaurantId,menu.id,body]);
      if(submission.current?.signature !== signature)submission.current={signature,id:crypto.randomUUID()};
      const result = await api(`/api/restaurants/${restaurantId}/menus/${menu.id}/receive`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...body,request_id:submission.current.id})
      });
      onReceived(result.menu);
      submission.current=null;setQuantity('');setNote('');
      setMessage(`รับเข้า ${menu.name} จำนวน ${amount} ${menu.unit || 'หน่วย'} สำเร็จ · คงเหลือ ${result.menu.stock_quantity}`);
    } catch {
      setError('รับเข้าสินค้าไม่สำเร็จ กรุณาตรวจยอดคงเหลือก่อนลองอีกครั้ง');
    } finally { pending.current = false; setBusy(false); }
  }
  return jsx.jsxs('section', {id:'menu-stock-receive', className:'rounded-2xl border border-line bg-surface p-4 space-y-3', children:[
    jsx.jsxs('div', {className:'flex flex-wrap items-center justify-between gap-3', children:[
      jsx.jsx('h2', {className:'text-lg font-semibold', children:'รับเข้าสินค้า'}),
      jsx.jsx('a', {href:'/dashboard/menu?view=receive-history',className:'text-sm underline',children:'ดูประวัติรับเข้าสินค้า →'})
    ]}),
    jsx.jsx('p', {className:'text-sm text-muted', children:'เลือกสินค้าและป้อนจำนวนรับเข้า ระบบจะเพิ่มยอดคงเหลือและเปิดติดตามสต็อกให้ทันที'}),
    jsx.jsxs('form', {onSubmit:receive, className:'flex flex-wrap items-end gap-3', children:[
      jsx.jsxs('label', {className:'grid gap-1 flex-1 min-w-0', children:['สินค้า', jsx.jsxs('select', {
        'aria-label':'สินค้าที่รับเข้า', value:selected, required:true, disabled:busy,
        className:'w-full rounded-xl border border-line bg-surface px-3 py-2',
        onChange:event=>{setSelected(event.target.value);setMessage('');setError('');},
        children:[jsx.jsx('option',{value:'',children:'เลือกสินค้า'}), ...menus.map(item=>jsx.jsx('option', {value:item.id, children:`${item.name}${item.stock_barcode ? ' · '+item.stock_barcode : ''}`}, item.id))]
      })]}),
      jsx.jsxs('label', {className:'grid gap-1', children:['จำนวนรับเข้า', jsx.jsx('input', {
        type:'number', min:'0.001', max:'1000000000', step:'0.001', required:true, value:quantity, disabled:busy,
        'aria-label':'จำนวนรับเข้า', className:'w-36 rounded-xl border border-line bg-surface px-3 py-2',
        onChange:event=>setQuantity(event.target.value)
      })]}),
      jsx.jsxs('label', {className:'grid gap-1 flex-1',children:['หมายเหตุ / เลขที่เอกสาร',jsx.jsx('input',{
        value:note,maxLength:500,disabled:busy,placeholder:'ระบุได้ถ้ามี',className:'rounded-xl border border-line bg-surface px-3 py-2',onChange:event=>setNote(event.target.value)
      })]}),
      jsx.jsx('button', {type:'submit', disabled:busy || !menu, className:'rounded-xl bg-ink text-surface px-4 py-2 disabled:opacity-50', children:busy?'กำลังบันทึก...':'+ บันทึกรับเข้า'})
    ]}),
    menu ? jsx.jsx('p', {className:'text-sm', children:menu.track_stock ? `คงเหลือปัจจุบัน ${Number(menu.stock_quantity) || 0} ${menu.unit || 'หน่วย'}` : 'สินค้านี้ยังไม่ติดตามสต็อก การรับเข้าจะเริ่มติดตามสต็อก'}) : null,
    message ? jsx.jsx('p', {role:'status', className:'text-sm text-green-700', children:message}) : null,
    error ? jsx.jsx('p', {role:'alert', className:'text-sm text-red-600', children:error}) : null
  ]});
}
