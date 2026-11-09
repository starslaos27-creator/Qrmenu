export function menuExample(menu) {
  return {
    image: menu.image_url || null, description: menu.description || '',
    sampleDetails: false, sampleStock: false, tracked: !!menu.track_stock,
    quantity: Number(menu.stock_quantity) || 0, limit: Number(menu.low_alert_limit) || 0
  };
}
export function menuListFacts(jsx, menu, formatMoney) {
  const data = menuExample(menu);
  const low = data.tracked && data.quantity > 0 && data.quantity <= data.limit;
  const empty = data.tracked && data.quantity <= 0;
  const fields = [
    ['cost', 'ราคาต้นทุน', menu.cost_price == null ? '—' : formatMoney(Number(menu.cost_price)), ''],
    ['sale', 'ราคาขาย', formatMoney(Number(menu.price)), ''],
    ['remaining', 'สินค้าคงเหลือ', data.tracked ? `${data.quantity.toLocaleString('th-TH')} ${menu.unit || 'หน่วย'}` : 'ไม่ติดตามสต็อก', ''],
    ['low', 'สินค้าใกล้หมด', data.tracked ? (low ? 'ใกล้หมด' : '—') : '—', low ? 'is-low' : ''],
    ['empty', 'สินค้าหมด', data.tracked ? (empty ? 'หมดสต็อก' : '—') : '—', empty ? 'is-empty' : '']
  ];
  return jsx.jsx('dl', {className: 'menu-list-facts', children: fields.map(([key, label, value, state]) =>
    jsx.jsxs('div', {className: `menu-list-fact ${state}`, 'data-fact': key,
      title: key === 'low' && data.tracked ? `แจ้งเตือนเมื่อเหลือไม่เกิน ${data.limit} ${menu.unit || 'หน่วย'}` : undefined,
      children: [jsx.jsx('dt', {children: label}), jsx.jsx('dd', {children: value})]
    }, key))});
}
export function menuStockBadges(jsx, menu) {
  const data = menuExample(menu);
  if (!data.tracked) return jsx.jsx('span', {className: 'menu-stock-statuses', children: 'ยังไม่ติดตามสต็อก'});
  return jsx.jsxs('span', {className: 'menu-stock-statuses', children: [
    data.sampleStock ? jsx.jsx('small', {className: 'menu-example-label', children: 'ตัวอย่างสต็อก'}) : null,
    jsx.jsx('span', {className: 'menu-stock-badge', children: `คงเหลือ ${data.quantity}`}),
    jsx.jsx('span', {className: 'menu-stock-near-alert', title: `แจ้งเตือนเมื่อเหลือไม่เกิน ${data.limit}`, children: `ใกล้หมด ${data.quantity > 0 && data.quantity <= data.limit ? data.quantity : 0}`}),
    jsx.jsx('span', {className: 'menu-stock-alert', children: `หมด ${data.quantity === 0 ? 1 : 0} รายการ`})
  ]});
}

export function menuStockSummary(jsx, menus) {
  const items = menus.map(menuExample).filter(item => item.tracked);
  
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const low = items.filter(item => item.quantity > 0 && item.quantity <= item.limit).length;
  const empty = items.filter(item => item.quantity === 0).length;
  return jsx.jsxs('section', {className: 'menu-stock-summary', 'aria-label': 'สรุปสต็อกสินค้า', children: [
    ...[
      ['remaining', 'จำนวนสินค้าคงเหลือ', quantity.toLocaleString('th-TH'), 'หน่วย'],
      ['low', 'จำนวนสินค้าใกล้หมด', low, 'รายการ'],
      ['empty', 'จำนวนสินค้าหมด', empty, 'รายการ']
    ].map(([status, title, value, unit]) => jsx.jsxs('div', {className: `menu-stock-summary-card ${status}`, children: [
      jsx.jsx('span', {children: title}),
      jsx.jsxs('div', {children: [jsx.jsx('strong', {children: value}), jsx.jsx('small', {children: unit})]})
    ]}, status))
  ]});
}
