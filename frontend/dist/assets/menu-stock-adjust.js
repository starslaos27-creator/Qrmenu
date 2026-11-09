import {r as React, j as jsx} from './vendor-react-DCUvmuBu.js';
import {e as api} from './index-BjXGGWCT.js?v=20261104-remove-stock-deposits-menu-v9';
const movementTypes = [
  ['purchase', '📥 รับสินค้าเข้าสต็อก'],
  ['issue', '📦 ตัดสต็อก'],
  ['waste', '🗑️ ตัดของเสีย / หมดอายุ'],
  ['adjustment', '⚖️ ปรับยอดนับจริง (Stock Count)'],
  ['return_in', '🔄 รับคืนเข้าสต็อก'],
  ['return_out', '📤 ส่งคืนผู้จัดส่ง'],
  ['transfer', '🔁 โอนสินค้า']
];

export function MenuStockAdjust({restaurantId, menus, onAdjusted}) {
  const [open, setOpen] = React.useState(false);
  const [barcode, setBarcode] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [type, setType] = React.useState('purchase');
  const [note, setNote] = React.useState('');
  const [destinations, setDestinations] = React.useState([]);
  const [destinationId, setDestinationId] = React.useState('');
  const [destinationMenus, setDestinationMenus] = React.useState([]);
  const [destinationMenuId, setDestinationMenuId] = React.useState('');
  const [loadingDestinations, setLoadingDestinations] = React.useState(false);
  const [loadingMenus, setLoadingMenus] = React.useState(false);
  const [destinationError, setDestinationError] = React.useState('');
  const [loadRetry, setLoadRetry] = React.useState(0);
  const dialog = React.useRef(null), pending = React.useRef(false);
  const submission = React.useRef(null);
  const code = barcode.trim();
  const matches = code ? menus.filter(item=>typeof item.stock_barcode==='string'&&item.stock_barcode.trim()===code) : [];
  const menu = matches.length === 1 ? matches[0] : undefined;
  const selected = menu?.id || '';
  const barcodeError = code && !menu ? (matches.length>1?'รหัสนี้ซ้ำกันหลายสินค้า กรุณาแก้ไขรหัสสินค้าให้ไม่ซ้ำก่อน':'ไม่พบสินค้าที่ตรงกับบาร์โค้ด / Serial นี้') : '';
  const isCount = type === 'adjustment';
  const isTransfer = type === 'transfer';
  const unit = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  const compatibleMenus = destinationMenus.filter(item=>menu&&unit(menu.unit)&&unit(item.unit)===unit(menu.unit));
  const destinationMenu = compatibleMenus.find(item=>item.id===destinationMenuId);
  const transferReady = !!destinationMenu && destinations.some(item=>item.id===destinationId) && !loadingDestinations && !loadingMenus && !destinationError;
  const current = Number(menu?.stock_quantity) || 0;
  const amount = Number(quantity);
  const validAmount = quantity.trim() !== '' && Number.isFinite(amount) && amount >= (isCount ? 0 : 0.001) && amount <= 1000000000 && Math.abs(amount * 1000 - Math.round(amount * 1000)) < 0.00001;
  const after = Math.round((isCount ? amount : current + (['issue','waste','return_out','transfer'].includes(type) ? -amount : amount)) * 1000) / 1000;
  React.useEffect(() => {
    const show = () => { if(pending.current)return;setBarcode('');setQuantity('');setError('');setType('purchase');setNote('');setDestinations([]);setDestinationId('');setDestinationMenus([]);setDestinationMenuId('');setDestinationError('');submission.current=null;setOpen(true); };
    window.addEventListener('shopqr:adjust-menu-stock', show);
    return () => window.removeEventListener('shopqr:adjust-menu-stock', show);
  }, []);
  React.useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element.showModal();
    element.querySelector('[name="stock_barcode"]')?.focus();
    return () => element.close();
  }, [open]);
  React.useEffect(()=>{
    if(!open||!isTransfer)return;
    let stopped=false;setLoadingDestinations(true);setDestinationError('');
    api(`/api/restaurants/${restaurantId}/menu-transfer-destinations`).then(result=>{if(!stopped)setDestinations(result.restaurants);}).catch(()=>{if(!stopped)setDestinationError('โหลดสาขาปลายทางไม่สำเร็จ');}).finally(()=>{if(!stopped)setLoadingDestinations(false);});
    return()=>{stopped=true;};
  },[open,isTransfer,restaurantId,loadRetry]);
  React.useEffect(()=>{
    if(!open||!isTransfer||!destinationId)return;
    let stopped=false;setLoadingMenus(true);setDestinationError('');setDestinationMenuId('');
    api(`/api/restaurants/${destinationId}/menus`).then(result=>{if(stopped)return;const list=result.menus;setDestinationMenus(list);const sameUnit=list.filter(item=>menu&&unit(menu.unit)&&unit(item.unit)===unit(menu.unit));const barcodeMatches=menu?.stock_barcode?.trim()?sameUnit.filter(item=>item.stock_barcode?.trim()===menu.stock_barcode.trim()):[];const name=menu?.name?.trim().toLocaleLowerCase();const nameMatches=name?sameUnit.filter(item=>item.name?.trim().toLocaleLowerCase()===name):[];const match=barcodeMatches.length===1?barcodeMatches[0]:nameMatches.length===1?nameMatches[0]:null;if(match)setDestinationMenuId(match.id);}).catch(()=>{if(!stopped)setDestinationError('โหลดสินค้าปลายทางไม่สำเร็จ');}).finally(()=>{if(!stopped)setLoadingMenus(false);});
    return()=>{stopped=true;};
  },[open,isTransfer,destinationId,loadRetry,menu?.id]);
  function close() { if (!pending.current) setOpen(false); }
  async function save(event) {
    event.preventDefault();
    if (pending.current) return;
    if (isTransfer && !transferReady) { setError('กรุณาเลือกสาขาและสินค้าปลายทางที่ใช้หน่วยเดียวกัน'); return; }
    if (!menu || !validAmount || !movementTypes.some(([value])=>value===type)) {
      setError(barcodeError || (isCount ? 'กรุณาระบุรหัสสินค้าและยอดนับจริงตั้งแต่ 0 ขึ้นไป (ทศนิยมไม่เกิน 3 ตำแหน่ง)' : 'กรุณาระบุรหัสสินค้าและจำนวนมากกว่า 0 (ทศนิยมไม่เกิน 3 ตำแหน่ง)'));
      return;
    }
    if (after < 0) { setError('จำนวนที่ตัดออกมากกว่ายอดคงเหลือ'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const body = {movement_type:type,quantity:amount,note:note.trim()||null,...(isCount?{expected_quantity:current}:{}),...(isTransfer?{destination_restaurant_id:destinationId,destination_menu_id:destinationMenuId}:{})};
      const signature = JSON.stringify([restaurantId,menu.id,body]);
      if(submission.current?.signature!==signature)submission.current={signature,id:crypto.randomUUID()};
      const result = await api(`/api/restaurants/${restaurantId}/menus/${menu.id}/${isTransfer?'stock-transfers':'stock-adjustments'}`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...body,request_id:submission.current.id})
      });
      onAdjusted(result.menu);
      submission.current = null;
      setOpen(false);
    } catch (error) {
      setError(({INSUFFICIENT_STOCK:'จำนวนที่ตัดออกมากกว่ายอดคงเหลือล่าสุด',STOCK_CHANGED:'ยอดสต็อกเปลี่ยนไปแล้ว กรุณาตรวจยอดล่าสุดและบันทึกอีกครั้ง',STOCK_LIMIT:'ยอดคงเหลือเกินจำนวนสูงสุดที่รองรับ',UNIT_MISMATCH:'สินค้าต้นทางและปลายทางต้องระบุหน่วยเดียวกัน',FORBIDDEN:'บัญชีนี้ไม่มีสิทธิ์โอนระหว่างร้านที่เลือก',NOT_FOUND:'ไม่พบสินค้าต้นทางหรือปลายทาง กรุณาเลือกรายการใหม่'})[error?.code] || 'บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
      if(['INSUFFICIENT_STOCK','STOCK_CHANGED'].includes(error?.code)) {
        try { const latest=await api(`/api/restaurants/${restaurantId}/menus`);const item=latest.menus.find(item=>item.id===selected);if(item)onAdjusted(item); } catch {}
      }
    } finally { pending.current = false; setBusy(false); }
  }
  if (!open) return null;
  return jsx.jsx('dialog', {ref: dialog, className: 'menu-stock-adjust-dialog', 'aria-labelledby': 'menu-stock-adjust-title', onCancel: event => {event.preventDefault();close();}, children:
    jsx.jsxs('form', {onSubmit: save, children: [
      jsx.jsxs('header', {children: [jsx.jsx('div', {className:'menu-stock-adjust-icon','aria-hidden':true,children:'📦'}),jsx.jsxs('div', {children:[jsx.jsx('h2', {id:'menu-stock-adjust-title', children:'ปรับเปลี่ยนสต็อก'}),jsx.jsx('p',{children:menu?`${menu.name} (คงเหลือปัจจุบัน: ${current} ${menu.unit||'หน่วย'})`:'สแกนหรือพิมพ์รหัสสินค้าที่ต้องการปรับสต็อก'})]})]}),
      jsx.jsxs('div', {className:'menu-stock-adjust-fields',children:[
      jsx.jsxs('div', {className:'menu-stock-code-row',children:[
        jsx.jsxs('label',{children:['บาร์โค้ด / Serial',jsx.jsx('input',{type:'text',name:'stock_barcode',value:barcode,required:true,disabled:busy,autoComplete:'off',spellCheck:false,placeholder:'สแกนหรือพิมพ์รหัส',list:'menu-stock-barcode-options','aria-invalid':!!barcodeError,'aria-describedby':'menu-stock-barcode-result',onChange:event=>{const value=event.target.value;const found=menus.filter(item=>item.stock_barcode?.trim()===value.trim()&&value.trim());setBarcode(value);setQuantity(isCount&&found.length===1?String(Number(found[0].stock_quantity)||0):'');setDestinationMenuId('');setError('');},onKeyDown:event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(menu){const input=dialog.current?.querySelector('[name="quantity"]');input?.focus();input?.select();}}}})]}),
        jsx.jsxs('label',{children:['ชื่อสินค้า',jsx.jsx('input',{type:'text',name:'stock_menu_name',value:menu?.name||'',readOnly:true,disabled:busy,placeholder:'แสดงเมื่อสแกนรหัสสินค้า'})]}),
        jsx.jsxs('label', {children: [isCount?'ยอดนับจริง':'จำนวน', jsx.jsx('input', {name:'quantity',type:'number', min:isCount?0:0.001, max:1000000000, step:0.001, required:true, value:quantity, disabled:busy, onChange:event=>setQuantity(event.target.value)})]})
      ]}),
      jsx.jsx('datalist',{id:'menu-stock-barcode-options',children:menus.filter(item=>item.stock_barcode?.trim()).map(item=>jsx.jsx('option',{value:item.stock_barcode.trim(),label:item.name},item.id))}),
      jsx.jsx('p',{id:'menu-stock-barcode-result',role:'status',className:barcodeError?'menu-stock-adjust-warning':'menu-stock-matched-name',children:barcodeError||(!menu?'ชื่อสินค้าจะแสดงเมื่อรหัสตรงกับสินค้า':'')}),
      jsx.jsxs('label', {children:['ประเภทการรับ/เบิกสต็อก',jsx.jsx('select',{value:type,disabled:busy,onChange:event=>{setType(event.target.value);setQuantity(event.target.value==='adjustment'&&menu?String(current):'');setError('');},children:movementTypes.map(([value,label])=>jsx.jsx('option',{value,children:label},value))})]}),
      isTransfer ? jsx.jsxs(React.Fragment, {children:[
        jsx.jsx('p',{children:'โอนระหว่างร้านที่คุณมีสิทธิ์เจ้าของร้านทั้งสองฝั่ง สินค้าต้นทางและปลายทางต้องใช้หน่วยเดียวกัน'}),
        jsx.jsxs('label',{children:['สาขา / ร้านปลายทาง',jsx.jsxs('select',{value:destinationId,required:true,disabled:busy||loadingDestinations,onChange:event=>{setDestinationId(event.target.value);setDestinationMenuId('');setDestinationMenus([]);setDestinationError('');setError('');},children:[jsx.jsx('option',{value:'',children:loadingDestinations?'กำลังโหลดสาขา...':'เลือกสาขา / ร้านปลายทาง'}),...destinations.map(item=>jsx.jsx('option',{value:item.id,children:item.name},item.id))]})]}),
        !loadingDestinations&&!destinationError&&!destinations.length?jsx.jsx('p',{role:'status',children:'ยังไม่มีร้านปลายทางที่บัญชีนี้มีสิทธิ์เจ้าของร้าน'}):null,
        jsx.jsxs('label',{children:['สินค้าปลายทาง',jsx.jsxs('select',{value:destinationMenu?.id||'',required:true,disabled:busy||!destinationId||!menu||loadingMenus,onChange:event=>{setDestinationMenuId(event.target.value);setError('');},children:[jsx.jsx('option',{value:'',children:loadingMenus?'กำลังโหลดสินค้า...':'เลือกสินค้าปลายทาง'}),...compatibleMenus.map(item=>jsx.jsx('option',{value:item.id,children:`${item.name}${item.stock_barcode?' · '+item.stock_barcode:''} (${Number(item.stock_quantity)||0} ${item.unit})`},item.id))]})]}),
        menu&&!unit(menu.unit)?jsx.jsx('p',{role:'status',children:'กรุณาระบุหน่วยของสินค้าต้นทางก่อนโอน'}):null,
        destinationId&&menu&&!loadingMenus&&!destinationError&&!compatibleMenus.length?jsx.jsx('p',{role:'status',children:'ไม่มีสินค้าปลายทางที่ใช้หน่วยเดียวกัน กรุณาเพิ่มสินค้าหรือแก้ไขหน่วยที่ร้านปลายทางก่อน'}):null,
        destinationError?jsx.jsxs('div',{children:[jsx.jsx('p',{role:'alert',children:destinationError}),jsx.jsx('button',{type:'button',disabled:busy,onClick:()=>setLoadRetry(value=>value+1),children:'ลองโหลดอีกครั้ง'})]}):null
      ]}):null,
      isCount?jsx.jsx('p',{children:'ยอดนับจริงจะใช้แทนยอดคงเหลือเดิม'}):null,
      menu&&validAmount?jsx.jsx('p',{className:after<0?'menu-stock-adjust-warning':'',children:`ยอดคงเหลือหลังปรับ: ${after.toLocaleString('th-TH',{maximumFractionDigits:3})} ${menu.unit||'หน่วย'}`}):null,
      isTransfer&&destinationMenu&&validAmount?jsx.jsx('p',{children:`ยอดปลายทางหลังโอน: ${(Number(destinationMenu.stock_quantity)+amount).toLocaleString('th-TH',{maximumFractionDigits:3})} ${destinationMenu.unit}`}):null,
      jsx.jsxs('label',{children:['หมายเหตุ / เหตุผล',jsx.jsx('textarea',{value:note,maxLength:500,rows:2,disabled:busy,placeholder:'ระบุหมายเหตุ (ถ้ามี)',onChange:event=>setNote(event.target.value)})]}),
      menu && !menu.track_stock ? jsx.jsx('p', {children:'เมื่อบันทึก ระบบจะเปิดติดตามสต็อกสำหรับสินค้านี้'}) : null,
      error ? jsx.jsx('p', {role:'alert', children:error}) : null,
      ]}),
      jsx.jsxs('footer', {children:[jsx.jsx('button', {type:'button', disabled:busy, onClick:close, children:'ยกเลิก'}), jsx.jsx('button', {type:'submit', className:'menu-stock-adjust-save', disabled:busy||!menu||(isTransfer&&!transferReady), children:busy?'กำลังบันทึก...':'บันทึกรายการ'})]})
    ]})
  });
}
