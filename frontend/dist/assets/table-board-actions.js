import {r as React, j as jsx} from './vendor-react-DCUvmuBu.js';

export function TableBoardActions({restaurantId, tables, zones, canAct, request, onTransferred, makeQR, tableURL, onDownload}) {
  const dialog = React.useRef(null);
  const [mode, setMode] = React.useState('qr');
  const [source, setSource] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [qr, setQR] = React.useState('');
  const [sources, setSources] = React.useState([]);
  const titles = {move: 'ย้ายโต๊ะ', merge: 'รวมโต๊ะ', qr: 'QR Code'};
  const selected = tables.find(table => table.id === source);
  const name = table => `${zones.find(zone => zone.id === table.zone_id)?.name ?? '—'} · โต๊ะ ${table.table_number}`;
  React.useEffect(() => {
    let cancelled = false;
    setQR('');
    if (mode === 'qr' && selected) makeQR({url: tableURL(selected), label: String(selected.table_number), size: 600})
      .then(url => { if (!cancelled) setQR(url); })
      .catch(() => { if (!cancelled) setError('สร้าง QR Code ไม่สำเร็จ กรุณาลองใหม่'); });
    return () => { cancelled = true; };
  }, [mode, source, selected?.short_code]);
  function open(next) {
    setMode(next); setError(''); setSource(tables[0]?.id ?? ''); setTarget(''); setSources([]);
    dialog.current.showModal();
  }
  async function submit(event) {
    event.preventDefault();
    const fromIds = mode === 'merge' ? sources.filter(id => id !== target) : [source];
    if (busy || !fromIds.length || !fromIds.every(Boolean) || !target || fromIds.includes(target)) return;
    setBusy(true); setError('');
    try {
      await request(`/api/restaurants/${restaurantId}/tables/${fromIds[0]}/transfer`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({to_table_id: target, ...(mode === 'merge' ? {from_table_ids: fromIds} : {})})
      });
      fromIds.forEach(id => onTransferred(id, target));
      dialog.current.close();
    } catch (failure) {
      setError(failure.code === 'NO_UNPAID_ORDERS' ? 'โต๊ะต้นทางไม่มีออเดอร์ที่ค้างชำระ' : 'ดำเนินการไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่');
    } finally { setBusy(false); }
  }
  const select = (value, change, exclude = '') => jsx.jsxs('select', {
    required: true, value, disabled: busy, onChange: event => {change(event.target.value);setError('');},
    children: [jsx.jsx('option', {value: '', children: 'เลือกโต๊ะ'}), ...tables.filter(table => table.id !== exclude).map(table => jsx.jsx('option', {value: table.id, children: name(table)}, table.id))]
  });
  return jsx.jsxs(React.Fragment, {children: [
    jsx.jsxs('div', {className: 'table-board-actions', children: [
      canAct && jsx.jsx('button', {type: 'button', className: 'table-action-move', disabled: tables.length < 2, onClick: () => open('move'), children: titles.move}),
      canAct && jsx.jsx('button', {type: 'button', className: 'table-action-merge', disabled: tables.length < 2, onClick: () => open('merge'), children: titles.merge}),
      jsx.jsx('button', {type: 'button', className: 'table-action-qr', disabled: !tables.length, onClick: () => open('qr'), children: '▦ QR Code'})
    ]}),
    jsx.jsxs('dialog', {ref: dialog, className: 'table-detail-dialog table-action-dialog', 'aria-label': titles[mode], onCancel: event => {if (busy) event.preventDefault();}, children: [
      jsx.jsxs('div', {className: 'table-dialog-heading', children: [jsx.jsx('strong', {children: titles[mode]}), jsx.jsx('button', {type: 'button', disabled: busy, onClick: () => dialog.current.close(), children: 'ปิด ×'})]}),
      jsx.jsxs('form', {onSubmit: submit, children: [
        mode !== 'merge' && jsx.jsxs('label', {children: [mode === 'qr' ? 'เลือกโต๊ะสำหรับ QR Code' : 'โต๊ะต้นทาง', select(source, value => {setSource(value);if(value === target)setTarget('');})]}),
        mode !== 'qr' && jsx.jsxs('label', {children: ['โต๊ะปลายทาง', select(target, value => {setTarget(value);setSources(current => current.filter(id => id !== value));}, mode === 'merge' ? '' : source)]}),
        mode === 'merge' && jsx.jsxs('fieldset', {className: 'table-merge-sources', disabled: busy, children: [
          jsx.jsx('legend', {children: `เลือกโต๊ะที่จะนำมารวม (${sources.length} โต๊ะ)`}),
          jsx.jsx('button', {type: 'button', onClick: () => setSources(tables.filter(table => table.id !== target).map(table => table.id)), children: 'เลือกทั้งหมด'}),
          jsx.jsx('button', {type: 'button', onClick: () => setSources([]), children: 'ล้างการเลือก'}),
          jsx.jsx('div', {className: 'table-merge-options', children: tables.filter(table => table.id !== target).map(table => jsx.jsxs('label', {children: [
            jsx.jsx('input', {type: 'checkbox', checked: sources.includes(table.id), onChange: event => {setSources(current => event.target.checked ? [...current, table.id] : current.filter(id => id !== table.id));setError('');}}), name(table)
          ]}, table.id))})
        ]}),
        mode !== 'qr' && jsx.jsx('p', {className: 'table-action-note', children: mode === 'merge' ? `นำออเดอร์ค้างชำระจาก ${sources.length} โต๊ะที่เลือก ไปรวมที่ ${tables.find(table => table.id === target) ? name(tables.find(table => table.id === target)) : 'โต๊ะปลายทาง'} แล้วปิดโต๊ะต้นทางทั้งหมด` : 'ย้ายออเดอร์ค้างชำระทั้งหมดไปโต๊ะปลายทาง แล้วปิดโต๊ะต้นทาง หากปลายทางมีออเดอร์อยู่ จะรวมยอดเข้าด้วยกัน'}),
        error && jsx.jsx('p', {role: 'alert', className: 'table-action-error', children: error}),
        mode === 'qr' && selected && jsx.jsxs('div', {className: 'table-action-qr-preview', children: [qr ? jsx.jsx('img', {src: qr, alt: `QR Code ${name(selected)}`, width: 260, height: 260}) : jsx.jsx('p', {children: 'กำลังสร้าง QR Code…'}), jsx.jsx('button', {type: 'button', disabled: !qr, onClick: () => onDownload(selected), children: 'ดาวน์โหลด PNG'})]}),
        mode !== 'qr' && jsx.jsx('button', {type: 'submit', className: mode === 'merge' ? 'table-action-merge' : 'table-action-move', disabled: busy || !target || (mode === 'merge' ? !sources.length : !source || source === target), children: busy ? 'กำลังดำเนินการ…' : mode === 'merge' ? `ยืนยันรวม ${sources.length} โต๊ะ` : `ยืนยัน${titles[mode]}`})
      ]})
    ]})
  ]});
}
