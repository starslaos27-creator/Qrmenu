import { receiptBusinessInfo } from './receipt-business-info.js';
import {readReceiptHeader,validReceiptLogo} from './receipt-header-settings.js?v=20261102-logo-persistent-v2';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function receiptHeading(receipt) {
  const locale = receipt.locale === 'lo' ? 'lo-LA' : receipt.locale === 'en' ? 'en-GB' : 'th-TH';
  const labels = receipt.locale === 'lo'
    ? ['ໃບບິນເກັບເງິນ','ໂຊນ','ໂຕະ','ເລກທີໃບບິນ','ວັນທີ','ເວລາ','ແຊບ ສະອາດ ສົດໃໝ່ທຸກຈານ']
    : receipt.locale === 'en'
    ? ['RECEIPT','Zone','Table','Receipt no.','Date','Time','Freshly prepared, served with care']
    : ['ใบเสร็จรับเงิน','โซน','โต๊ะ','เลขที่บิล','วันที่','เวลา','อร่อย สะอาด สดใหม่ ทุกจาน'];
  if (receipt.method === 'pending') {
    labels[0] = receipt.locale === 'en' ? 'CHECK BILL' : '\u0e43\u0e1a\u0e41\u0e08\u0e49\u0e07\u0e22\u0e2d\u0e14';
  }
  const date = new Date(receipt.paidAt);
  const valid = Number.isFinite(date.getTime());
  const numbers = [...new Set(receipt.orders.map(order => order.receipt_number).filter(Boolean))];
  const restaurantId = receipt.restaurantId || receipt.orders[0]?.restaurant_id;
  const settings=readReceiptHeader(restaurantId);
  const prefix=typeof settings.numberPrefix==='string'?settings.numberPrefix.trim():'';
  const number=numbers.map(number=>prefix?prefix+String(number).replace(/^BILL-/,''):number).join(', ')||'?';
  const calendar=['buddhist','gregory'].includes(settings.calendar)?settings.calendar:undefined;
  const contact = {...receiptBusinessInfo[restaurantId],...settings};
  const rawZone = String(receipt.zoneName || '—').trim();
  const zoneParts = rawZone.split(/\s+/).filter(Boolean);
  while (zoneParts.length > 1 && zoneParts[1].toLocaleLowerCase(locale) === zoneParts[0].toLocaleLowerCase(locale)) zoneParts.splice(1, 1);
  const zoneName = zoneParts.join(' ') || '—';  const addressLabels = receipt.locale === 'lo'
    ? ['ທີ່ຕັ້ງຮ້ານ','ບ້ານ','ເມືອງ','ແຂວງ','ໂທ']
    : receipt.locale === 'en'
    ? ['Address','Village','District','Province','Tel.']
    : ['ที่ตั้งร้าน','บ้าน','เมือง','แขวง','โทร'];
  const address = `<div class="receipt-address"><div>${['village','district','province'].map((field, index) => `${addressLabels[index + 1]} ${escape(contact[field] || '—')}`).join(' · ')}</div><div>${addressLabels[4]} ${escape(contact.phone || '—')}</div></div>`;
  return `<header class="receipt-header">
    ${validReceiptLogo(settings.logo)?`<img src="${escape(settings.logo)}" alt="${escape(receipt.restaurantName)}" style="display:block;width:16mm;height:16mm;object-fit:contain;margin:0 auto 6px">`:`<div class="receipt-monogram" aria-label="${escape(receipt.restaurantName)}">${escape(Array.from(receipt.restaurantName || 'R')[0])}</div>`}
    ${settings.showName===false?'':`<h1>${escape(receipt.restaurantName)}</h1>`}
    ${address}
    <div class="receipt-meta-grid">
      <div class="receipt-location"><div><strong>${escape(zoneName)}</strong></div><div>${labels[2]} <strong>${escape(receipt.tableNumber)}</strong></div>${settings.showNumber===false?'':`<div class="receipt-number-label">${labels[3]}</div>`}${settings.showDate===false?'':`<div class="receipt-date-label">${labels[4]}</div>`}<p class="receipt-tagline">${escape(settings.tagline??labels[6])}</p></div>
      <div class="receipt-issued"><div class="receipt-label">${labels[0]}</div>${settings.showNumber===false?'':`<div class="receipt-number-value"><strong>${escape(number)}</strong></div>`}${settings.showDate===false?'':`<div class="receipt-date-value">${valid ? escape(date.toLocaleDateString(locale,{timeZone:'Asia/Vientiane',calendar,year:'numeric',month:'2-digit',day:'2-digit'})) : '—'}${settings.showTime===false?'':` <span class="receipt-inline-time">${valid ? escape(date.toLocaleTimeString(locale,{timeZone:'Asia/Vientiane',hour:'2-digit',minute:'2-digit',hour12:false})) : '—'}</span>`}</div>`}</div>
    </div>
  </header>`;
}
