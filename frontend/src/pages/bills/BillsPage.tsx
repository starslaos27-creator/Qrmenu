import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import BillGroupCard, { money } from "./BillGroupCard";
import { useBillsData } from "./useBillsData";
import type { BillOrder, BillTable } from "./types";
import { useLanguage, type Locale } from "../../shared/i18n/LanguageProvider";

type Tab = "unpaid" | "settled";
export default function BillsPage({ onLogin }: { onLogin: () => void }) {
  const { locale } = useLanguage();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("unpaid");
  const [busyTableId, setBusyTableId] = useState("");
  const [paymentTableId, setPaymentTableId] = useState("");
  const [transferTableId, setTransferTableId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const data = useBillsData(restaurantId);
  const canAct = ["owner", "waiter", "staff"].includes(role);

  useEffect(() => {
    let cancelled = false;
    loadRestaurantSession().then((session) => {
      if (cancelled) return;
      if (!session.membership) { setSessionError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร"); return; }
      setRestaurantId(session.membership.restaurant_id); setRole(session.membership.role);
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) onLogin();
      else setSessionError("โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
    });
    return () => { cancelled = true; };
  }, [onLogin]);

  const groups = useMemo(() => {
    const tableById = new Map(data.tables.map((table) => [table.id, table]));
    const ordersByTable = new Map<string, BillOrder[]>();
    for (const order of data.unpaidOrders) ordersByTable.set(order.table_id, [...(ordersByTable.get(order.table_id) ?? []), order]);
    return [...ordersByTable].map(([tableId, orders]) => ({
      table: tableById.get(tableId) ?? { id: tableId, table_number: "—", is_open: false, zone_id: null },
      orders,
    }));
  }, [data.tables, data.unpaidOrders]);
  const settledGroups = useMemo(() => {
    const tableById = new Map(data.tables.map((table) => [table.id, table]));
    const grouped = new Map<string, BillOrder[]>();
    for (const order of data.settledOrders) {
      const key = `${order.table_id}:${order.receipt_number ?? order.id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), order]);
    }
    return [...grouped].map(([key, orders]) => ({ key, table: tableById.get(orders[0].table_id), orders })).sort((a, b) => (b.orders[0]?.paid_at ?? "").localeCompare(a.orders[0]?.paid_at ?? ""));
  }, [data.tables, data.settledOrders]);

  async function settle(tableId: string) {
    if (!restaurantId || busyTableId) return;
    setBusyTableId(tableId); setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/tables/${tableId}/settle`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ payment_method: paymentMethod, ...(paymentMethod === "cash" ? { cash_received: Number(cashReceived) } : {}) }) });
      setPaymentTableId(""); setTab("settled"); await data.refresh();
    } catch (cause) { setError(cause instanceof ApiError && cause.code === "INSUFFICIENT_STOCK" ? "ตัดสต็อกไม่สำเร็จ เพราะวัตถุดิบคงเหลือไม่พอ" : cause instanceof ApiError && cause.code === "CASH_RECEIVED_TOO_LOW" ? "จำนวนเงินสดที่รับมายังไม่ครบยอดบิล" : "รับชำระไม่สำเร็จ กรุณาโหลดข้อมูลแล้วลองใหม่"); }
    finally { setBusyTableId(""); }
  }

  async function transfer() {
    if (!restaurantId || !transferTableId || !destinationId || busyTableId) return;
    setBusyTableId(transferTableId); setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/tables/${transferTableId}/transfer`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ to_table_id: destinationId }) });
      setTransferTableId(""); setDestinationId(""); await data.refresh();
    } catch { setError("ย้ายออเดอร์ไม่สำเร็จ กรุณาตรวจสอบโต๊ะปลายทาง"); }
    finally { setBusyTableId(""); }
  }

  async function acknowledge(id: string) {
    if (!restaurantId) return;
    setError("");
    try { await apiRequest(`/api/restaurants/${restaurantId}/call-staff/${id}/ack`, { method: "PATCH" }); await data.refresh(); }
    catch { setError("รับทราบการเรียกพนักงานไม่สำเร็จ"); }
  }

  if (sessionError) return <main className="w-full p-6"><Alert>{sessionError}</Alert></main>;
  const serviceChargePct = Number(data.restaurant?.service_charge_pct) || 0;
  const vatPct = Number(data.restaurant?.vat_pct) || 0;
  const currencyCode = data.restaurant?.currency_code ?? "LAK";
  const paymentGroup = groups.find((group) => group.table.id === paymentTableId);
  const paymentTotal = paymentGroup ? billTotal(paymentGroup.orders, serviceChargePct, vatPct) : 0;
  const cashValue = Number(cashReceived);
  const cashChange = Number.isFinite(cashValue) ? Math.max(0, cashValue - paymentTotal) : 0;
  return <main className="w-full space-y-6 p-4 sm:p-6">
    <header><p className="text-sm font-semibold text-emerald-700">{data.restaurant?.name ?? "จัดการร้านอาหาร"}</p><h1 className="mt-1 text-2xl font-bold">บิลและการชำระเงิน</h1><p className="mt-1 text-sm text-slate-500">อัปเดตข้อมูลอัตโนมัติทุก 5 วินาที</p></header>
    {error && <Alert>{error}</Alert>}{data.error && <Alert>{data.error} <button className="underline" onClick={() => void data.refresh()}>ลองอีกครั้ง</button></Alert>}
    {data.calls.length > 0 && <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-bold text-amber-950">เรียกพนักงาน ({data.calls.length})</h2>{data.calls.map((call) => <div key={call.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 p-3 text-sm"><span><b>โต๊ะ {call.table_number}</b>{call.zone_name ? ` · ${call.zone_name}` : ""} · {new Date(call.created_at).toLocaleTimeString()}{call.reason === "ขอเช็กบิล" ? <b className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-amber-900">กำลังเช็กบิล</b> : call.reason ? <span className="ml-2 text-slate-600">· {call.reason}</span> : null}</span>{canAct && (call.acknowledged ? <span className="text-xs font-semibold text-emerald-800">รับเรื่องแล้ว</span> : <button onClick={() => void acknowledge(call.id)} className={secondary}>{call.reason === "ขอเช็กบิล" ? "รับเช็กบิล" : "รับทราบ"}</button>)}</div>)}</section>}
    <nav className="flex gap-2 rounded-xl bg-slate-100 p-1"><button onClick={() => setTab("unpaid")} className={tab === "unpaid" ? activeTab : tabClass}>บิลค้าง ({groups.length})</button><button onClick={() => setTab("settled")} className={tab === "settled" ? activeTab : tabClass}>ชำระแล้ว 30 วัน</button></nav>
    {data.loading ? <div className="rounded-xl bg-white p-8 text-center text-slate-500">กำลังโหลดบิล…</div> : tab === "unpaid" ? groups.length === 0 ? <Empty title="ไม่มีบิลค้าง" /> : <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{groups.map(({ table, orders }) => <BillGroupCard key={table.id} table={table} zone={data.zones.find((zone) => zone.id === table.zone_id)} orders={orders} serviceChargePct={serviceChargePct} vatPct={vatPct} currencyCode={currencyCode} busy={!!busyTableId} canAct={canAct} onPay={() => { const due = billTotal(orders, serviceChargePct, vatPct); setPaymentMethod("cash"); setCashReceived(due.toFixed(2)); setPaymentTableId(table.id); }} onTransfer={() => { setDestinationId(""); setTransferTableId(table.id); }} />)}</section> : settledGroups.length === 0 ? <Empty title="ยังไม่มีประวัติการชำระในช่วง 30 วัน" /> : <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">วันเวลา</th><th className="px-4 py-3">โต๊ะ</th><th className="px-4 py-3">เลขที่ใบเสร็จ</th><th className="px-4 py-3">วิธีชำระ / เงินทอน</th><th className="px-4 py-3">ออเดอร์</th><th className="px-4 py-3 text-right">ยอดรวม</th><th className="px-4 py-3">จัดการใบเสร็จ</th></tr></thead><tbody className="divide-y divide-slate-100">{settledGroups.map((group) => { const order = group.orders[0]; const total = Number(order.bill_total ?? group.orders.reduce((sum, item) => sum + Number(item.settled_total ?? item.total), 0)); return <tr key={group.key}><td className="px-4 py-3 text-slate-500">{new Date(order.paid_at ?? order.created_at).toLocaleString()}</td><td className="px-4 py-3 font-semibold">{group.table?.table_number ?? "โต๊ะถูกลบ"}</td><td className="px-4 py-3">{order.receipt_number ?? "—"}</td><td className="px-4 py-3">{methodLabel(order.payment_method)}{order.payment_method === "cash" && order.change_due != null && <div className="mt-1 text-xs text-slate-500">รับ {money(order.cash_received ?? total, currencyCode)} · ทอน {money(order.change_due, currencyCode)}</div>}</td><td className="px-4 py-3">{group.orders.reduce((sum, item) => sum + item.items.length, 0)} รายการ</td><td className="px-4 py-3 text-right font-bold">{money(total, currencyCode)}</td><td className="px-4 py-3"><button onClick={() => printReceipt(group, data.restaurant?.name ?? "ร้านอาหาร", locale, currencyCode)} className="text-xs font-semibold text-emerald-800 underline">พิมพ์ใบเสร็จ</button></td></tr>; })}</tbody></table></section>}
    {paymentTableId && <Modal title="รับชำระเงิน" onClose={() => setPaymentTableId("")}><p className="text-sm text-slate-600">รับชำระบิลทั้งหมดของโต๊ะ {data.tables.find((table) => table.id === paymentTableId)?.table_number}</p><p className="rounded-lg bg-slate-50 p-3 font-semibold">ยอดที่ต้องชำระ <span className="float-right">{money(paymentTotal, currencyCode)}</span></p><label className="block text-sm font-semibold">วิธีชำระ<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={input}><option value="cash">เงินสด</option><option value="transfer">โอนเงิน</option><option value="promptpay">PromptPay / QR</option><option value="card">บัตร</option><option value="other">อื่น ๆ</option></select></label>{paymentMethod === "cash" && <div className="space-y-2 rounded-lg border border-slate-200 p-3"><label className="block text-sm font-semibold">จำนวนเงินที่รับ (เงินสด)<input type="number" min={paymentTotal} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className={input + " mt-1"} /></label><p className="flex justify-between text-sm"><span>เงินทอน</span><b>{money(cashChange, currencyCode)}</b></p></div>}{data.restaurant?.payment_qr_url && paymentMethod === "promptpay" && <img src={data.restaurant.payment_qr_url} alt="QR รับชำระ" className="mx-auto max-h-56 rounded-lg" />}<div className="flex justify-end gap-2"><button onClick={() => setPaymentTableId("")} className={secondary}>ยกเลิก</button><button disabled={!!busyTableId || (paymentMethod === "cash" && (!Number.isFinite(cashValue) || cashValue < paymentTotal))} onClick={() => void settle(paymentTableId)} className={primary}>{busyTableId ? "กำลังรับชำระ…" : "ยืนยันชำระ"}</button></div></Modal>}
    {transferTableId && <Modal title="ย้ายออเดอร์ไปอีกโต๊ะ" onClose={() => setTransferTableId("")}><p className="text-sm text-slate-600">เลือกโต๊ะปลายทาง ออเดอร์ที่ยังไม่ชำระจะย้ายไปพร้อมกัน</p><select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className={input}><option value="">เลือกโต๊ะปลายทาง</option>{data.tables.filter((table) => table.id !== transferTableId).map((table) => <option key={table.id} value={table.id}>โต๊ะ {table.table_number}</option>)}</select><div className="flex justify-end gap-2"><button onClick={() => setTransferTableId("")} className={secondary}>ยกเลิก</button><button disabled={!destinationId || !!busyTableId} onClick={() => void transfer()} className={primary}>ยืนยันย้ายโต๊ะ</button></div></Modal>}
  </main>;
}

function billTotal(orders: BillOrder[], serviceChargePct: number, vatPct: number) { const subtotal = orders.reduce((sum, order) => sum + Number(order.total), 0); const service = Math.round((subtotal * serviceChargePct / 100 + Number.EPSILON) * 100) / 100; const vat = Math.round(((subtotal + service) * vatPct / 100 + Number.EPSILON) * 100) / 100; return Math.round((subtotal + service + vat + Number.EPSILON) * 100) / 100; }
function printReceipt(group: { table?: BillTable; orders: BillOrder[] }, restaurantName: string, locale: Locale, currencyCode: "LAK" | "THB" | "USD") {
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return;
  const order = group.orders[0];
  const total = Number(order.bill_total ?? group.orders.reduce((sum, item) => sum + Number(item.settled_total ?? item.total), 0));
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
  const labels = locale === "en"
    ? { title: "Receipt", receipt: "Receipt", number: "No.", table: "Table", date: "Date", method: "Payment method", cash: "Cash received", change: "Change", total: "Total", item: "Food item" }
    : locale === "lo"
      ? { title: "ໃບຮັບເງິນ", receipt: "ໃບຮັບເງິນ", number: "ເລກທີ", table: "ໂຕະ", date: "ວັນທີ", method: "ວິທີຊຳລະ", cash: "ຮັບເງິນສົດ", change: "ເງິນທອນ", total: "ຍອດລວມ", item: "ລາຍການອາຫານ" }
      : locale === "ko"
        ? { title: "영수증", receipt: "영수증", number: "번호", table: "테이블", date: "날짜", method: "결제 방법", cash: "받은 현금", change: "거스름돈", total: "합계", item: "음식" }
        : locale === "vi"
          ? { title: "Biên lai", receipt: "Biên lai", number: "Số", table: "Bàn", date: "Ngày", method: "Phương thức thanh toán", cash: "Tiền mặt nhận", change: "Tiền thừa", total: "Tổng cộng", item: "Món ăn" }
          : locale === "zh"
            ? { title: "收据", receipt: "收据", number: "编号", table: "桌号", date: "日期", method: "付款方式", cash: "实收现金", change: "找零", total: "合计", item: "菜品" }
            : { title: "ใบเสร็จ", receipt: "ใบเสร็จรับเงิน", number: "เลขที่", table: "โต๊ะ", date: "วันที่", method: "วิธีชำระ", cash: "รับเงินสด", change: "เงินทอน", total: "ยอดรวม", item: "รายการอาหาร" };
  const itemRows = group.orders.flatMap((item) => item.items.map((line) => `<tr><td>${escape(line.name ?? labels.item)}</td><td>${Number(line.qty ?? 1)}</td><td>${money(Number(line.price ?? 0) * Number(line.qty ?? 1), currencyCode)}</td></tr>`)).join("");
  const cashRows = order.payment_method === "cash" && order.cash_received != null ? `<p>${labels.cash}: ${money(order.cash_received, currencyCode)}</p><p>${labels.change}: ${money(order.change_due ?? 0, currencyCode)}</p>` : "";
  popup.document.open();
  const dateLocales: Record<Locale, string> = { th: "th-TH", lo: "lo-LA", en: "en-US", ko: "ko-KR", vi: "vi-VN", zh: "zh-CN" };
  const formattedPaidAt = new Date(order.paid_at ?? order.created_at).toLocaleString(dateLocales[locale], { timeZone: "Asia/Vientiane" });
  popup.document.write(`<!doctype html><html lang="${locale}"><meta charset="utf-8"><title>${labels.title} ${escape(order.receipt_number)}</title><style>body{font:14px system-ui,sans-serif;max-width:360px;margin:24px auto;color:#111}h1,h2,p{text-align:center;margin:5px}table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:6px 2px;border-bottom:1px dashed #aaa}td:nth-child(2),td:nth-child(3){text-align:right}footer{border-top:1px solid #111;margin-top:12px;padding-top:8px}.total{font-size:18px;font-weight:700;text-align:right}.meta{text-align:left;font-size:12px;margin-top:16px}@media print{body{margin:0 auto}}</style><body><h1>${escape(restaurantName)}</h1><h2>${labels.receipt}</h2><div class="meta"><p>${labels.number}: ${escape(order.receipt_number ?? "—")}</p><p>${labels.table}: ${escape(group.table?.table_number ?? "—")}</p><p>${labels.date}: ${escape(formattedPaidAt)}</p><p>${labels.method}: ${escape(methodLabel(order.payment_method, locale))}</p></div><table><tbody>${itemRows}</tbody></table><footer>${cashRows}<p class="total">${labels.total} ${money(total, currencyCode)}</p></footer><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
  popup.document.close();
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}><section onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-bold">{title}</h2>{children}</section></div>; }
function Empty({ title }: { title: string }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">{title}</div>; }
function Alert({ children }: { children: ReactNode }) { return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{children}</p>; }
function methodLabel(method: string | null, locale: Locale = "th") {
  const labels: Record<string, Record<Locale, string>> = {
    cash: { th: "เงินสด", lo: "ເງິນສົດ", en: "Cash", ko: "현금", vi: "Tiền mặt", zh: "现金" },
    transfer: { th: "โอนเงิน", lo: "ໂອນເງິນ", en: "Bank transfer", ko: "계좌 이체", vi: "Chuyển khoản", zh: "银行转账" },
    promptpay: { th: "PromptPay", lo: "PromptPay", en: "PromptPay", ko: "PromptPay", vi: "PromptPay", zh: "PromptPay" },
    card: { th: "บัตร", lo: "ບັດ", en: "Card", ko: "카드", vi: "Thẻ", zh: "银行卡" },
    other: { th: "อื่น ๆ", lo: "ອື່ນໆ", en: "Other", ko: "기타", vi: "Khác", zh: "其他" },
  };
  return labels[method ?? ""]?.[locale] ?? "—";
}
const jsonHeaders = { "Content-Type": "application/json" };
const tabClass = "flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500";
const activeTab = "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm";
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const primary = "rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold";
