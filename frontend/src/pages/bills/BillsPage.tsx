import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import { useLanguage, type Locale } from "../../shared/i18n/LanguageProvider";
import BillGroupCard, { money } from "./BillGroupCard";
import { billLabels, numberLocale } from "./labels";
import { useBillsData } from "./useBillsData";
import type { BillOrder, BillTable } from "./types";
import billHeroPhoto from "../../assets/star-restaurant/papaya-salad.jpg";

type Tab = "unpaid" | "settled";
export default function BillsPage({ onLogin }: { onLogin: () => void }) {
  const { locale } = useLanguage();
  const labels = billLabels[locale];
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
  const data = useBillsData(restaurantId, labels.loadFailed);
  const canAct = ["owner", "waiter", "staff"].includes(role);
  const fmt = (value: number | string) => money(value, data.restaurant?.currency_code ?? "LAK", locale);
  const dateFmt = new Intl.DateTimeFormat(numberLocale[locale], { calendar: "gregory", dateStyle: "medium", timeStyle: "short" });

  useEffect(() => {
    let cancelled = false;
    loadRestaurantSession().then((session) => {
      if (cancelled) return;
      if (!session.membership) { setSessionError(labels.noRestaurant); return; }
      setRestaurantId(session.membership.restaurant_id); setRole(session.membership.role);
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) onLogin();
      else setSessionError(labels.accountLoadFailed);
    });
    return () => { cancelled = true; };
  }, [onLogin, labels.noRestaurant, labels.accountLoadFailed]);

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
    } catch (cause) {
      setError(cause instanceof ApiError && cause.code === "INSUFFICIENT_STOCK" ? labels.insufficientStock : cause instanceof ApiError && cause.code === "CASH_RECEIVED_TOO_LOW" ? labels.cashTooLow : labels.paymentFailed);
    } finally { setBusyTableId(""); }
  }

  async function transfer() {
    if (!restaurantId || !transferTableId || !destinationId || busyTableId) return;
    setBusyTableId(transferTableId); setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/tables/${transferTableId}/transfer`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ to_table_id: destinationId }) });
      setTransferTableId(""); setDestinationId(""); await data.refresh();
    } catch { setError(labels.transferFailed); }
    finally { setBusyTableId(""); }
  }

  async function acknowledge(id: string) {
    if (!restaurantId) return;
    setError("");
    try { await apiRequest(`/api/restaurants/${restaurantId}/call-staff/${id}/ack`, { method: "PATCH" }); await data.refresh(); }
    catch { setError(labels.acknowledgeFailed); }
  }

  if (sessionError) return <main className="min-h-full bg-slate-50 p-5 sm:p-8"><Alert>{sessionError}<button className="ml-2 font-semibold underline" onClick={onLogin}>{labels.loginRequired}</button></Alert></main>;
  const serviceChargePct = Number(data.restaurant?.service_charge_pct) || 0;
  const vatPct = Number(data.restaurant?.vat_pct) || 0;
  const currencyCode = data.restaurant?.currency_code ?? "LAK";
  const paymentGroup = groups.find((group) => group.table.id === paymentTableId);
  const paymentTotal = paymentGroup ? billTotal(paymentGroup.orders, serviceChargePct, vatPct) : 0;
  const cashValue = Number(cashReceived);
  const cashChange = Number.isFinite(cashValue) ? Math.max(0, cashValue - paymentTotal) : 0;
  const outstandingTotal = groups.reduce((sum, group) => sum + billTotal(group.orders, serviceChargePct, vatPct), 0);

  return <main className="min-h-full bg-[#f5f6f2] p-4 text-slate-800 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="relative isolate overflow-hidden rounded-[28px] border border-[#e3e8df] bg-white shadow-[0_12px_35px_rgba(25,53,39,.06)]">
        <div className="absolute inset-y-0 right-0 hidden w-[48%] sm:block"><img src={billHeroPhoto} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" /><div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/5" /></div>
        <div className="relative flex min-h-52 flex-wrap items-end justify-between gap-5 p-6 sm:min-h-60 sm:p-8 lg:p-10">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.19em] text-emerald-800">{data.restaurant?.name ?? "ShopQR"}</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#173b2d] sm:text-4xl">{labels.title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{labels.subtitle}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/90 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" /></span>{labels.live}<span className="text-slate-300">·</span><span className="font-medium text-slate-500">{labels.autoRefresh}</span></div>
          </div>
          <div className="hidden h-28 w-32 items-end justify-end sm:flex lg:h-36 lg:w-48"><span className="rounded-2xl border border-white/75 bg-white/85 px-3 py-2 text-xs font-bold text-emerald-950 shadow-md backdrop-blur">{labels.staffCalls}: {data.calls.length.toLocaleString(numberLocale[locale])}</span></div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label={labels.openBills} value={groups.length.toLocaleString(numberLocale[locale])} icon="bill" />
        <SummaryCard label={labels.outstanding} value={fmt(outstandingTotal)} icon="coin" accent />
        <SummaryCard label={labels.staffCalls} value={data.calls.length.toLocaleString(numberLocale[locale])} icon="bell" warning={data.calls.length > 0} />
      </section>

      {error && <Alert>{error}</Alert>}
      {data.error && <Alert>{data.error}<button className="ml-2 font-semibold underline" onClick={() => void data.refresh()}>{labels.tryAgain}</button></Alert>}

      {role !== "cook" && data.calls.length > 0 && <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4"><div><h2 className="font-bold text-amber-950">{labels.calls}</h2><p className="mt-0.5 text-xs text-amber-800/70">{data.calls.length} {labels.items}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{labels.staffCalls}</span></header>
        <div className="divide-y divide-slate-100">{data.calls.map((call) => <div key={call.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div><p className="font-semibold text-slate-800">{labels.table} {call.table_number}{call.zone_name ? ` · ${call.zone_name}` : ""}</p><p className="mt-1 text-xs text-slate-500">{dateFmt.format(new Date(call.created_at))}{call.reason && call.reason !== "ขอเช็กบิล" ? ` · ${call.reason}` : ""}</p></div>
          {call.reason === "ขอเช็กบิล" && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{labels.checkingBill}</span>}
          {canAct && (call.acknowledged ? <span className="text-xs font-semibold text-emerald-700">{labels.acknowledged}</span> : <button onClick={() => void acknowledge(call.id)} className={secondary}>{call.reason === "ขอเช็กบิล" ? labels.takeCall : labels.acknowledge}</button>)}
        </div>)}</div>
      </section>}

      <nav className="flex max-w-xl gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1.5" aria-label={labels.title}>
        <button onClick={() => setTab("unpaid")} className={`${tab === "unpaid" ? activeTab : tabClass}`}><span>{labels.unpaidTab}</span><span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs">{groups.length}</span></button>
        <button onClick={() => setTab("settled")} className={`${tab === "settled" ? activeTab : tabClass}`}>{labels.settledTab}</button>
      </nav>

      {data.loading ? <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500"><span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-emerald-800/20 border-t-emerald-800" />{labels.loading}</div>
        : tab === "unpaid" ? groups.length === 0 ? <Empty title={labels.noUnpaid} /> : <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">{groups.map(({ table, orders }) => <BillGroupCard key={table.id} table={table} zone={data.zones.find((zone) => zone.id === table.zone_id)} orders={orders} serviceChargePct={serviceChargePct} vatPct={vatPct} currencyCode={currencyCode} locale={locale} labels={labels} busy={!!busyTableId} canAct={canAct} onPay={() => { const due = billTotal(orders, serviceChargePct, vatPct); setPaymentMethod("cash"); setCashReceived(due.toFixed(2)); setPaymentTableId(table.id); }} onTransfer={() => { setDestinationId(""); setTransferTableId(table.id); }} />)}</section>
          : settledGroups.length === 0 ? <Empty title={labels.noHistory} /> : <SettledTable groups={settledGroups} labels={labels} locale={locale} currencyCode={currencyCode} onPrint={(group) => printReceipt(group, data.restaurant?.name ?? "ShopQR", locale, currencyCode)} />}

      {paymentTableId && <Modal title={labels.paymentTitle} onClose={() => setPaymentTableId("")}><p className="text-sm text-slate-600">{labels.collectAll} {labels.table.toLowerCase()} {data.tables.find((table) => table.id === paymentTableId)?.table_number}</p><p className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-950">{labels.dueNow}<span className="float-right text-lg">{fmt(paymentTotal)}</span></p><label className="block text-sm font-semibold">{labels.paymentMethod}<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={input}><option value="cash">{labels.cash}</option><option value="transfer">{labels.transfer}</option><option value="promptpay">{labels.promptpay}</option><option value="card">{labels.card}</option><option value="other">{labels.other}</option></select></label>{paymentMethod === "cash" && <div className="space-y-2 rounded-2xl border border-slate-200 p-4"><label className="block text-sm font-semibold">{labels.cashReceived}<input type="number" min={paymentTotal} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className={input + " mt-1"} /></label><p className="flex justify-between text-sm"><span>{labels.change}</span><b>{fmt(cashChange)}</b></p></div>}{data.restaurant?.payment_qr_url && paymentMethod === "promptpay" && <img src={data.restaurant.payment_qr_url} alt={labels.qrAlt} className="mx-auto max-h-56 rounded-xl border border-slate-200 p-2" />}<div className="flex justify-end gap-2"><button onClick={() => setPaymentTableId("")} className={secondary}>{labels.cancel}</button><button disabled={!!busyTableId || (paymentMethod === "cash" && (!Number.isFinite(cashValue) || cashValue < paymentTotal))} onClick={() => void settle(paymentTableId)} className={primary}>{busyTableId ? labels.processing : labels.confirmPayment}</button></div></Modal>}

      {transferTableId && <Modal title={labels.moveTitle} onClose={() => setTransferTableId("")}><p className="text-sm text-slate-600">{labels.moveDescription}</p><label className="block text-sm font-semibold">{labels.destination}<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className={input + " mt-1"}><option value="">{labels.chooseDestination}</option>{data.tables.filter((table) => table.id !== transferTableId).map((table) => <option key={table.id} value={table.id}>{labels.table} {table.table_number}</option>)}</select></label><div className="flex justify-end gap-2"><button onClick={() => setTransferTableId("")} className={secondary}>{labels.cancel}</button><button disabled={!destinationId || !!busyTableId} onClick={() => void transfer()} className={primary}>{busyTableId ? labels.processing : labels.confirmMove}</button></div></Modal>}
    </div>
  </main>;
}

function SummaryCard({ label, value, icon, accent = false, warning = false }: { label: string; value: string; icon: "bill" | "coin" | "bell"; accent?: boolean; warning?: boolean }) {
  return <article className={`flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-[0_4px_16px_rgba(22,42,32,.035)] ${warning ? "border-amber-200" : "border-[#e5e9e3]"}`}><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${warning ? "bg-amber-50 text-amber-700" : "bg-[#eff5ee] text-emerald-800"}`}><SummaryIcon name={icon} /></span><div className="min-w-0"><p className="text-sm font-medium text-slate-500">{label}</p><p className={`mt-1 truncate text-2xl font-extrabold tabular-nums ${accent ? "text-emerald-900" : "text-slate-900"}`}>{value}</p></div></article>;
}

function SummaryIcon({ name }: { name: "bill" | "coin" | "bell" }) {
  const common = { width: 23, height: 23, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "bill") return <svg {...common}><path d="M6 3.75h12a1.5 1.5 0 0 1 1.5 1.5v15l-2.5-1.5-3 1.5-3-1.5-3 1.5-3-1.5V5.25A1.5 1.5 0 0 1 6 3.75Z"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/></svg>;
  if (name === "coin") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.1c-.5-.7-1.4-1.1-2.8-1.1-1.5 0-2.5.7-2.5 1.8 0 2.9 5.5 1.2 5.5 4.2 0 1.1-1 2-2.7 2-1.4 0-2.5-.5-3.1-1.4M12 6.5v11"/></svg>;
  return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7-2.5 8.5h17C20.5 16 18 16 18 9ZM10 21h4"/></svg>;
}

function SettledTable({ groups, labels, locale, currencyCode, onPrint }: { groups: Array<{ key: string; table?: BillTable; orders: BillOrder[] }>; labels: typeof billLabels[Locale]; locale: Locale; currencyCode: "LAK" | "THB" | "USD"; onPrint: (group: { table?: BillTable; orders: BillOrder[] }) => void }) {
  const dateFmt = new Intl.DateTimeFormat(numberLocale[locale], { calendar: "gregory", dateStyle: "medium", timeStyle: "short" });
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{[labels.date, labels.table, labels.receiptNumber, labels.paymentAndChange, labels.orders, labels.total, labels.actions].map((heading) => <th className="px-4 py-4" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{groups.map((group) => { const order = group.orders[0]; const total = Number(order.bill_total ?? group.orders.reduce((sum, item) => sum + Number(item.settled_total ?? item.total), 0)); const itemCount = group.orders.reduce((sum, item) => sum + item.items.length, 0); return <tr key={group.key} className="transition hover:bg-slate-50/80"><td className="whitespace-nowrap px-4 py-4 text-slate-500">{dateFmt.format(new Date(order.paid_at ?? order.created_at))}</td><td className="px-4 py-4 font-bold">{group.table?.table_number ?? labels.tableDeleted}</td><td className="px-4 py-4 font-mono text-xs text-slate-600">{order.receipt_number ?? "—"}</td><td className="px-4 py-4">{methodLabel(order.payment_method, locale)}{order.payment_method === "cash" && order.change_due != null && <div className="mt-1 text-xs text-slate-500">{labels.cash}: {money(order.cash_received ?? total, currencyCode, locale)} · {labels.change}: {money(order.change_due, currencyCode, locale)}</div>}</td><td className="px-4 py-4">{itemCount} {labels.items}</td><td className="whitespace-nowrap px-4 py-4 text-right font-black text-slate-900">{money(total, currencyCode, locale)}</td><td className="px-4 py-4"><button onClick={() => onPrint(group)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-50">{labels.printReceipt}</button></td></tr>; })}</tbody></table></div></section>;
}

function billTotal(orders: BillOrder[], serviceChargePct: number, vatPct: number) { const subtotal = orders.reduce((sum, order) => sum + Number(order.total), 0); const service = round(subtotal * serviceChargePct / 100); const vat = round((subtotal + service) * vatPct / 100); return round(subtotal + service + vat); }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

function printReceipt(group: { table?: BillTable; orders: BillOrder[] }, restaurantName: string, locale: Locale, currencyCode: "LAK" | "THB" | "USD") {
  const popup = window.open("", "_blank", "width=440,height=760");
  if (!popup) return;
  const order = group.orders[0];
  const total = Number(order.bill_total ?? group.orders.reduce((sum, item) => sum + Number(item.settled_total ?? item.total), 0));
  const labels = billLabels[locale];
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
  const itemRows = group.orders.flatMap((item) => item.items.map((line) => `<tr><td>${escape(line.name ?? labels.item)}</td><td>× ${Number(line.qty ?? 1)}</td><td>${money(Number(line.price ?? 0) * Number(line.qty ?? 1), currencyCode, locale)}</td></tr>`)).join("");
  const cashRows = order.payment_method === "cash" && order.cash_received != null ? `<div class="line"><span>${labels.cashLabel}</span><span>${money(order.cash_received, currencyCode, locale)}</span></div><div class="line"><span>${labels.changeLabel}</span><span>${money(order.change_due ?? 0, currencyCode, locale)}</span></div>` : "";
  const paidAt = new Date(order.paid_at ?? order.created_at).toLocaleString(numberLocale[locale], { calendar: "gregory", timeZone: "Asia/Vientiane" });
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/lao-font.css?v=20261120-v1"><title>${labels.receipt} ${escape(order.receipt_number)}</title><style>*{box-sizing:border-box}body{font:14px system-ui,-apple-system,sans-serif;max-width:390px;margin:24px auto;padding:24px;color:#15392b;background:#fff}header{text-align:center;padding:12px 0 20px;border-bottom:1px dashed #cbd5d0}h1{margin:0;font-size:21px}h2{margin:5px 0;color:#527062;font-size:13px;font-weight:600}.meta{padding:14px 0;border-bottom:1px solid #e5ece8}.line{display:flex;justify-content:space-between;gap:12px;margin:6px 0;font-size:12px;color:#586c62}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:9px 2px;border-bottom:1px solid #edf1ef}td:nth-child(2),td:nth-child(3){text-align:right;white-space:nowrap}.summary{border-top:1px dashed #b9c8c0;padding-top:12px}.grand{display:flex;justify-content:space-between;margin-top:10px;font-size:17px;font-weight:800;color:#14543b}.foot{text-align:center;margin-top:22px;color:#788981;font-size:11px}@media print{body{margin:0 auto;padding:12px}}</style></head><body><header><h1>${escape(restaurantName)}</h1><h2>${labels.receipt}</h2></header><section class="meta"><div class="line"><span>${labels.number}</span><b>${escape(order.receipt_number ?? "—")}</b></div><div class="line"><span>${labels.table}</span><b>${escape(group.table?.table_number ?? "—")}</b></div><div class="line"><span>${labels.date}</span><b>${escape(paidAt)}</b></div><div class="line"><span>${labels.method}</span><b>${escape(methodLabel(order.payment_method, locale))}</b></div></section><table><tbody>${itemRows}</tbody></table><section class="summary">${cashRows}<div class="grand"><span>${labels.totalLabel}</span><span>${money(total, currencyCode, locale)}</span></div></section><p class="foot">${escape(restaurantName)}</p><script>window.onload=()=>{(document.fonts?.ready||Promise.resolve()).then(()=>window.print());window.onafterprint=()=>window.close()}</script></body></html>`);
  popup.document.close();
}

function methodLabel(method: string | null, locale: Locale) {
  const labels: Record<string, Record<Locale, string>> = {
    cash: { th: "เงินสด", lo: "ເງິນສົດ", en: "Cash", ko: "현금", vi: "Tiền mặt", zh: "现金" },
    transfer: { th: "โอนเงิน", lo: "ໂອນເງິນ", en: "Bank transfer", ko: "계좌 이체", vi: "Chuyển khoản", zh: "银行转账" },
    promptpay: { th: "PromptPay / QR", lo: "PromptPay / QR", en: "PromptPay / QR", ko: "PromptPay / QR", vi: "PromptPay / QR", zh: "PromptPay / QR" },
    card: { th: "บัตร", lo: "ບັດ", en: "Card", ko: "카드", vi: "Thẻ", zh: "银行卡" },
    other: { th: "อื่น ๆ", lo: "ອື່ນໆ", en: "Other", ko: "기타", vi: "Khác", zh: "其他" },
  };
  return labels[method ?? ""]?.[locale] ?? "—";
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><header className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold text-slate-900">{title}</h2><button type="button" aria-label="close" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">×</button></header>{children}</section></div>; }
function Empty({ title }: { title: string }) { return <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#d8ded7] bg-white px-6 py-12 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eff5ee] text-emerald-800"><SummaryIcon name="bill" /></span><p className="mt-4 font-semibold text-slate-700">{title}</p></div></div>; }
function Alert({ children }: { children: ReactNode }) { return <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{children}</p>; }
const jsonHeaders = { "Content-Type": "application/json" };
const tabClass = "flex flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900";
const activeTab = "flex flex-1 items-center justify-center rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-emerald-950 shadow-sm";
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const primary = "rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
