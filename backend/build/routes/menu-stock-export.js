const translations = {
    th: {
        headers: ["วันเวลา (UTC+7)", "ประเภท", "สินค้า", "จำนวน", "หน่วย", "คงเหลือก่อน", "คงเหลือหลัง", "ผู้ทำรายการ", "เลขบิล", "โต๊ะ", "สถานะชำระเงิน", "สถานะออเดอร์", "คืนสต็อกแล้ว", "หมายเหตุ", "เหตุผลยกเลิก"],
        types: { sale: "ขายจากออเดอร์", issue: "ตัดออกด้วยมือ", waste: "ของเสีย / หมดอายุ", return_out: "ส่งคืนผู้จัดส่ง", adjustment: "ปรับยอดลดลง", transfer_out: "โอนออก", sale_return: "คืนจากยกเลิกออเดอร์", legacy: "ออเดอร์เก่า (ข้อมูลจำกัด)" },
        paid: "ชำระเงินแล้ว", unpaid: "ยังไม่ชำระเงิน", statuses: { pending: "รอดำเนินการ", ready: "พร้อมเสิร์ฟ", served: "เสิร์ฟแล้ว", cancelled: "ยกเลิก" }, yes: "ใช่", no: "ไม่",
    },
    lo: {
        headers: ["ວັນເວລາ (UTC+7)", "ປະເພດ", "ສິນຄ້າ", "ຈຳນວນ", "ໜ່ວຍ", "ຄົງເຫຼືອກ່ອນ", "ຄົງເຫຼືອຫຼັງ", "ຜູ້ດຳເນີນການ", "ເລກບິນ", "ໂຕະ", "ສະຖານະຊຳລະເງິນ", "ສະຖານະອໍເດີ", "ຄືນສະຕັອກແລ້ວ", "ໝາຍເຫດ", "ເຫດຜົນຍົກເລີກ"],
        types: { sale: "ຂາຍຈາກອໍເດີ", issue: "ເບີກອອກດ້ວຍມື", waste: "ເສຍ / ໝົດອາຍຸ", return_out: "ສົ່ງຄືນຜູ້ຈັດສົ່ງ", adjustment: "ປັບຍອດຫຼຸດລົງ", transfer_out: "ໂອນອອກ", sale_return: "ຄືນຈາກອໍເດີທີ່ຍົກເລີກ", legacy: "ອໍເດີເກົ່າ (ຂໍ້ມູນຈຳກັດ)" },
        paid: "ຊຳລະແລ້ວ", unpaid: "ຍັງບໍ່ຊຳລະ", statuses: { pending: "ລໍຖ້າດຳເນີນການ", ready: "ພ້ອມເສີບ", served: "ເສີບແລ້ວ", cancelled: "ຍົກເລີກ" }, yes: "ແມ່ນ", no: "ບໍ່",
    },
    en: {
        headers: ["Date and time (UTC+7)", "Type", "Item", "Quantity", "Unit", "Stock before", "Stock after", "Recorded by", "Bill number", "Table", "Payment status", "Order status", "Stock restored", "Note", "Cancellation reason"],
        types: { sale: "Sold with order", issue: "Manual issue", waste: "Waste / expired", return_out: "Returned to supplier", adjustment: "Stock reduction", transfer_out: "Transfer out", sale_return: "Returned from canceled order", legacy: "Legacy order (limited data)" },
        paid: "Paid", unpaid: "Unpaid", statuses: { pending: "Pending", ready: "Ready", served: "Served", cancelled: "Canceled" }, yes: "Yes", no: "No",
    },
};
const cell = (value) => {
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    let text = String(value ?? "");
    // Treat user-entered spreadsheet formulas as literal text, including leading whitespace.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
        text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
};
const numeric = (value) => value == null ? "" : Number(value);
export function outgoingCsv(rows, locale = "th") {
    const labels = translations[locale] ?? translations.th;
    const data = rows.map((row) => [
        new Date(new Date(row.created_at).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "),
        labels.types[row.type] ?? row.type,
        row.menu_name,
        numeric(row.quantity),
        row.unit,
        numeric(row.before),
        numeric(row.after),
        row.actor_name,
        row.receipt_number,
        row.table_name,
        row.order_id ? (row.paid ? labels.paid : labels.unpaid) : "",
        labels.statuses[row.order_status] ?? "",
        row.order_id ? (row.reversed ? labels.yes : labels.no) : "",
        row.note,
        row.cancel_reason,
    ]);
    return "\ufeff" + [labels.headers, ...data].map((row) => row.map(cell).join(",")).join("\r\n");
}
