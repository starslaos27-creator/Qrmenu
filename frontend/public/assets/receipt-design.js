const dishArt = `<svg viewBox="0 0 76 45" width="76" height="45" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="38" cy="22" r="18"/><circle cx="38" cy="22" r="13"/><path d="M29 25c4-7 10-9 17-5-3 6-10 9-17 5ZM33 24l9-4M8 4v37M5 4v11c0 3 6 3 6 0V4M67 4v37M63 4c-3 7-3 13 4 15"/></svg>`;
const chefArt = `<svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 20c-5 0-6-7-1-9 1-5 7-6 9-2 4-3 9 0 8 4 4 3 2 7-2 7v6H9v-6ZM10 22h12M12 17v3M16 17v3M20 17v3"/></svg>`;
const printWords = {
  th: ["ใบเสร็จรับเงิน", "ใบแจ้งยอด", "เลขที่บิล", "วันที่", "โต๊ะ", "รายการ", "จำนวน", "ราคา", "รวม", "รวมรายการ", "ยอดสุทธิ", "ชำระโดย", "สแกนเพื่อชำระเงิน", "ขอบคุณที่ใช้บริการ"],
  lo: ["ໃບຮັບເງິນ", "ໃບແຈ້ງຍອດ", "ເລກທີບິນ", "ວັນທີ", "ໂຕະ", "ລາຍການ", "ຈຳນວນ", "ລາຄາ", "ລວມ", "ລວມລາຍການ", "ຍອດສຸດທິ", "ຊຳລະໂດຍ", "ສະແກນເພື່ອຊຳລະ", "ຂອບໃຈທີ່ໃຊ້ບໍລິການ"],
  en: ["Receipt", "Bill", "Receipt no.", "Date", "Table", "Item", "Qty", "Price", "Total", "Subtotal", "Total due", "Paid by", "Scan to pay", "Thank you for your visit"],
  ko: ["영수증", "계산서", "영수증 번호", "날짜", "테이블", "항목", "수량", "가격", "합계", "소계", "총액", "결제 방법", "QR 결제", "방문해 주셔서 감사합니다"],
  vi: ["Biên lai", "Hóa đơn", "Số biên lai", "Ngày", "Bàn", "Món", "Số lượng", "Đơn giá", "Thành tiền", "Tạm tính", "Tổng cộng", "Thanh toán bằng", "Quét mã để thanh toán", "Cảm ơn quý khách"],
  zh: ["收据", "账单", "收据编号", "日期", "桌号", "项目", "数量", "单价", "金额", "小计", "总计", "付款方式", "扫码付款", "感谢您的光临"],
};
const paymentWords = {
  th: ["เงินสด", "โอนเงิน", "บัตร", "อื่น ๆ", "รอชำระ", "เงินสด + โอน"],
  lo: ["ເງິນສົດ", "ໂອນເງິນ", "ບັດ", "ອື່ນໆ", "ລໍຖ້າຊຳລະ", "ເງິນສົດ + ໂອນ"],
  en: ["Cash", "Bank transfer", "Card", "Other", "Awaiting payment", "Cash + transfer"],
  ko: ["현금", "계좌 이체", "카드", "기타", "결제 대기", "현금 + 이체"],
  vi: ["Tiền mặt", "Chuyển khoản", "Thẻ", "Khác", "Chờ thanh toán", "Tiền mặt + chuyển khoản"],
  zh: ["现金", "银行转账", "银行卡", "其他", "待付款", "现金 + 转账"],
};
const addressWords = {
  th: ["บ้าน", "เมือง", "แขวง", "โทร"], lo: ["ບ້ານ", "ເມືອງ", "ແຂວງ", "ໂທ"], en: ["Village", "District", "Province", "Tel."],
  ko: ["마을", "구", "도", "전화"], vi: ["Thôn", "Huyện", "Tỉnh", "Điện thoại"], zh: ["村", "区", "省", "电话"],
};

export function getPrintLocale(fallback) {
  try {
    const selected = localStorage.getItem("qrmenu.locale") || localStorage.getItem("shopqr-language");
    if (["th", "lo", "en", "ko", "vi", "zh"].includes(selected)) return selected;
  } catch { /* Use the page locale when storage is unavailable. */ }
  return ["th", "lo", "en", "ko", "vi", "zh"].includes(fallback) ? fallback : "th";
}

// The legacy dashboard creates print HTML separately from its React views.
// Reorganize the existing nodes so receipt data and configured QR stay intact.
export function applyPrintDesign(html, kind) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const language = (doc.documentElement.lang || "th").split("-")[0];
  const words = printWords[language] || printWords.th;
  if (kind === "receipt") {
    const header = doc.querySelector(".receipt-header");
    const location = header?.querySelector(".receipt-location");
    const issued = header?.querySelector(".receipt-issued");
    const grid = header?.querySelector(".receipt-meta-grid");
    const label = issued?.querySelector(".receipt-label");
    const address = header?.querySelector(".receipt-address");
    if (address) {
      const target = addressWords[language] || addressWords.th;
      const lines = address.querySelectorAll("div");
      if (lines[0]) {
        const parts = lines[0].textContent.split(" · ");
        lines[0].textContent = parts.map((part, index) => index < 3 ? target[index] + " " + part.replace(/^(บ้าน|เมือง|แขวง|ບ້ານ|ເມືອງ|ແຂວງ|Village|District|Province)\s*/i, "") : part).join(" · ");
      }
      if (lines[1]) lines[1].textContent = target[3] + " " + lines[1].textContent.replace(/^(โทร|ໂທ|Tel\.)\s*/i, "");
    }
    if (header && grid && label) {
      const isPending = /แจ้งยอด|CHECK BILL|ແຈ້ງຍອດ/i.test(label.textContent || "");
      label.textContent = words[isPending ? 1 : 0];
      header.insertBefore(label, grid);
    }
    if (location && issued) {
      const fields = doc.createElement("div");
      fields.className = "print-meta";
      const numberLabel = location.querySelector(".receipt-number-label");
      const numberValue = issued.querySelector(".receipt-number-value");
      const dateLabel = location.querySelector(".receipt-date-label");
      const dateValue = issued.querySelector(".receipt-date-value");
      if (numberLabel) numberLabel.textContent = words[2];
      if (dateLabel) dateLabel.textContent = words[3];
      const tableLabel = [...location.children].find(node => node.querySelector("strong") && /โต๊ะ|ໂຕະ|Table/i.test(node.textContent || ""));
      if (tableLabel && tableLabel.firstChild?.nodeType === Node.TEXT_NODE) tableLabel.firstChild.nodeValue = words[4] + " ";
      for (const [left, right] of [[numberLabel, numberValue], [dateLabel, dateValue]]) {
        if (left && right) { const row = doc.createElement("div"); row.className = "print-meta-row"; row.append(left, right); fields.append(row); }
      }
      const tableRows = [...location.children].filter(node => !node.matches(".receipt-tagline"));
      for (const row of tableRows) { row.className = "print-meta-row print-location"; fields.append(row); }
      grid?.replaceWith(fields);
    }
    const headings = doc.querySelectorAll(".receipt-items thead th");
    [5, 6, 7, 8].forEach((key, index) => { if (headings[index]) headings[index].textContent = words[key]; });
    const rows = doc.querySelectorAll(".totals tr");
    if (rows[0]?.cells[0]) rows[0].cells[0].textContent = words[9];
    const grand = doc.querySelector(".totals td.grand");
    if (grand) grand.textContent = words[10];
    const grandRow = grand?.closest("tr");
    if (grandRow?.nextElementSibling?.cells[0]) {
      const paymentRow = grandRow.nextElementSibling;
      paymentRow.cells[0].textContent = words[11];
      const value = paymentRow.cells[1];
      if (value) {
        const original = value.textContent.trim().toLowerCase();
        const index = Object.values(paymentWords).findIndex(list => list.some(item => item.toLowerCase() === original));
        if (index >= 0) {
          const variants = Object.values(paymentWords)[index];
          const position = variants.findIndex(item => item.toLowerCase() === original);
          value.textContent = (paymentWords[language] || paymentWords.th)[position];
        }
      }
    }
    const qrLabel = doc.querySelector(".qr-label");
    if (qrLabel) qrLabel.textContent = words[12];
    const footer = doc.querySelector(".footer");
    if (footer) { footer.textContent = words[13]; const art = doc.createElement("div"); art.className = "print-dish-art"; art.innerHTML = dishArt; footer.append(art); }
  } else if (kind === "kitchen") {
    const header = doc.querySelector(".header");
    const location = header?.querySelector(".location");
    const brand = header?.querySelector(".shop-brand");
    const issued = header?.querySelector(".issued");
    if (header && location && brand && issued) {
      const top = doc.createElement("div"); top.className = "print-kitchen-top";
      const icon = doc.createElement("span"); icon.className = "print-chef-art"; icon.innerHTML = chefArt;
      const label = doc.createElement("strong");
      const names = { th: "รายการส่งครัว", lo: "ລາຍການສົ່ງຄົວ", en: "Kitchen order", ko: "주방 주문", vi: "Phiếu bếp", zh: "厨房订单" };
      label.textContent = names[doc.documentElement.lang] || names.th;
      const text = doc.createElement("div"); text.append(label, brand); top.append(icon, text);
      location.classList.add("print-kitchen-table"); issued.classList.add("print-kitchen-meta");
      header.replaceChildren(top, location, issued);
    }
  }
  const style = doc.createElement("style");
  style.textContent = kind === "receipt" ? `
    .receipt-header{border:0!important;padding:0!important;text-align:center!important}.receipt-header h1{text-align:center!important;margin:0 0 4px!important}.receipt-address{text-align:center!important}.receipt-header>.receipt-label{display:block!important;font-size:15px!important;font-weight:800!important;letter-spacing:0!important;margin:14px 0 8px!important}.print-meta{border-top:1px dashed #555;border-bottom:1px dashed #555;padding:8px 0;margin:8px 0;font-size:11px}.print-meta-row{display:flex;justify-content:space-between;gap:8px;text-align:left;line-height:1.5}.print-location{display:block}.receipt-items th{background:none!important;border-top:0!important;border-bottom:1px solid #333!important}.receipt-items td{border-bottom:1px solid #ddd!important}.totals{width:100%!important;margin:0!important}.grand{border-top:1px solid #222!important;border-bottom:0!important}.qr-section{break-inside:avoid;text-align:center!important}.qr-section img{width:32mm!important;height:auto!important;max-width:100%!important}.footer{border-top:1px dashed #777!important;text-align:center!important}.print-dish-art{width:90px;height:53px;border:1px solid #999;display:flex;align-items:center;justify-content:center;margin:8px auto 0;color:#222}.print-dish-art svg{display:block}
    @media print { .receipt-header { padding-top: 8mm !important; } }
  ` : `
    .header{display:block!important}.print-kitchen-top{display:flex;align-items:center;gap:10px;border-bottom:2px solid #222;padding-bottom:9px}.print-chef-art{display:flex;align-items:center;justify-content:center;border:1px solid #888;width:42px;height:42px;flex:none}.print-kitchen-top strong{font-size:15px}.shop-brand{display:block!important;text-align:left!important}.shop-brand img{display:none!important}.shop-brand .shop-name{text-align:left!important;font-size:11px!important}.print-kitchen-table{text-align:center!important;padding:12px 0}.print-kitchen-table h1{font-size:24px!important;font-weight:800!important;margin:0!important}.print-kitchen-meta{text-align:left!important;display:flex;justify-content:space-between;flex-wrap:wrap;gap:3px 10px}.item-row{font-size:16px!important;font-weight:700!important}.item-qty{font-size:20px!important;font-weight:800!important}.item-note{font-size:11px!important}.summary{font-weight:700!important}
  `;
  doc.head.append(style);
  const fontStyle = doc.createElement("style");
  const fontBase = new URL("/fonts/", window.location.origin).href;
  fontStyle.textContent = `@font-face{font-family:'ShopQR Noto Lao';src:url('${fontBase}noto-sans-lao-regular.ttf') format('truetype');font-style:normal;font-weight:100 500;unicode-range:U+0E80-0EFF}@font-face{font-family:'ShopQR Noto Lao';src:url('${fontBase}noto-sans-lao-bold.ttf') format('truetype');font-style:normal;font-weight:600 900;unicode-range:U+0E80-0EFF}html,body,body *{font-family:'ShopQR Noto Lao','Noto Sans Thai',system-ui,sans-serif!important}`;
  doc.head.append(fontStyle);
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}
