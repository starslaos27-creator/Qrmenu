import './jsbarcode-3.12.1.min.js';

export function barcodeHint(jsx, quantity) {
  return jsx.jsx('small', {className:'menu-barcode-hint', children:`เว้นว่างเพื่อสร้างบาร์โค้ดอัตโนมัติหลังบันทึก • สินค้าชนิดเดียวกันใช้รหัสเดียวกัน${Number(quantity) > 0 ? ` • พิมพ์ได้ ${Math.floor(Number(quantity))} ดวง` : ''}`});
}

export function menuBarcodeButton(jsx, menu) {
  if (!menu.track_stock || !menu.stock_barcode) return null;
  return jsx.jsx('button', {type:'button', className:'menu-barcode-print', onClick:event => {
    event.stopPropagation(); openBarcodeLabels(menu);
  }, children:`พิมพ์บาร์โค้ด · ${menu.stock_barcode}`});
}

export function openBarcodeLabels(menu) {
  const previous = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'menu-label-dialog';
  dialog.setAttribute('aria-label', 'พิมพ์ฉลากบาร์โค้ด');
  dialog.innerHTML = `<form method="dialog"><h2>พิมพ์ฉลากบาร์โค้ด</h2><button aria-label="ปิด" class="label-close">×</button></form>
    <p class="label-product"></p><p class="label-code"></p>
    <div class="label-options"><label>จำนวนฉลาก<input name="count" type="number" min="1" max="1000" step="1" required></label>
    <label>กระดาษ<select name="paper"><option value="a4">A4 (4 คอลัมน์ · 46 × 28 มม.)</option><option value="roll">ม้วนฉลาก 50 × 30 มม.</option></select></label></div>
    <p>สินค้าแบบเดียวกันใช้บาร์โค้ดเดียวกันทุกดวง • พิมพ์ขนาดจริง 100% และปิดหัว/ท้ายกระดาษ</p>
    <p class="label-error" role="alert"></p><div class="label-preview"></div>
    <button type="button" class="label-print-action">พิมพ์ / บันทึก PDF</button>`;
  dialog.querySelector('.label-product').textContent = menu.name;
  dialog.querySelector('.label-code').textContent = menu.stock_barcode;
  const count = dialog.querySelector('[name=count]');
  const quantity = Number(menu.stock_quantity);
  count.value = Number.isInteger(quantity) && quantity > 0 ? String(quantity) : '1';
  const error = dialog.querySelector('.label-error');
  let barcode;
  try {
    barcode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    window.JsBarcode(barcode, menu.stock_barcode, {format:'CODE128', width:2, height:65, fontSize:20, margin:20});
    dialog.querySelector('.label-preview').append(barcode);
  } catch {
    error.textContent = 'รหัสนี้ไม่รองรับการพิมพ์บาร์โค้ด กรุณาใช้ตัวเลขหรือตัวอักษรอังกฤษ';
    dialog.querySelector('.label-print-action').disabled = true;
  }
  dialog.querySelector('.label-print-action').onclick = () => {
    if (!count.reportValidity()) return;
    const copies = Number(count.value);
    const roll = dialog.querySelector('[name=paper]').value === 'roll';
    const frame = document.createElement('iframe');
    frame.title = 'ฉลากสำหรับพิมพ์';
    frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
    document.body.append(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Barcode labels</title><style>
      @page{size:${roll ? '50mm 30mm' : 'A4'};margin:${roll ? '0' : '10mm'}}
      *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000;background:#fff}
      main{display:${roll ? 'block' : 'grid'};grid-template-columns:repeat(4,46mm);gap:0 2mm;align-content:start}
      .label{width:${roll ? '50mm' : '46mm'};height:${roll ? '30mm' : '28mm'};padding:1mm;overflow:hidden;break-inside:avoid;${roll ? 'break-after:page;' : ''}text-align:center}
      .label:last-child{break-after:auto}.name{font-size:11px;line-height:4mm;height:4mm;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;margin:0}
      svg{display:block;width:44mm;height:21mm;margin:auto}
      </style></head><body><main></main></body></html>`);
    doc.close();
    for (let i=0; i<copies; i++) {
      const label = doc.createElement('section'); label.className = 'label';
      const name = doc.createElement('p'); name.className = 'name'; name.textContent = menu.name;
      label.append(name, doc.importNode(barcode, true));
      doc.querySelector('main').append(label);
    }
    const cleanup = () => frame.remove();
    frame.contentWindow.addEventListener('afterprint', cleanup, {once:true});
    setTimeout(() => {frame.contentWindow.focus(); frame.contentWindow.print();}, 150);
    setTimeout(cleanup, 300000);
  };
  dialog.addEventListener('close', () => {dialog.remove(); previous?.focus();}, {once:true});
  document.body.append(dialog);
  dialog.showModal();
}
