import type { Locale } from "../../shared/i18n/LanguageProvider";
import type { BillLabels } from "./labels";
import type { BillOrder, BillTable, BillZone } from "./types";

export default function BillGroupCard({ table, zone, orders, serviceChargePct, vatPct, currencyCode, locale, labels, busy, canAct, onPay, onTransfer }: {
  table: BillTable;
  zone: BillZone | undefined;
  orders: BillOrder[];
  serviceChargePct: number;
  vatPct: number;
  currencyCode: "LAK" | "THB" | "USD";
  locale: Locale;
  labels: BillLabels;
  busy: boolean;
  canAct: boolean;
  onPay: () => void;
  onTransfer: () => void;
}) {
  const subtotal = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const service = round(subtotal * serviceChargePct / 100);
  const vat = round((subtotal + service) * vatPct / 100);
  const total = round(subtotal + service + vat);
  const format = (value: number | string) => money(value, currencyCode, locale);
  const dateFormat = new Intl.DateTimeFormat(dateLocale(locale), { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

  return <article className="overflow-hidden rounded-2xl border border-[#e2e7e1] bg-white shadow-[0_5px_20px_rgba(20,43,31,.045)] transition-shadow hover:shadow-[0_10px_28px_rgba(20,43,31,.08)]">
    <header className="flex items-start justify-between gap-4 border-b border-[#edf0eb] bg-[#fbfcfa] px-5 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{zone?.name ?? labels.unknownZone}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#173b2d]">{labels.table} {table.table_number}</h2>
        <p className="mt-1 text-xs text-slate-500">{orders.length} {labels.orderCount}</p>
      </div>
      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">{labels.waitingPayment}</span>
    </header>

    <div className="space-y-3 p-4 sm:p-5">
      {orders.map((order) => <section key={order.id} className="rounded-2xl bg-slate-50 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-500">{dateFormat.format(new Date(order.created_at))}</span>
          <span className="font-bold tabular-nums text-slate-900">{format(order.total)}</span>
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          {order.items.map((item, index) => <li key={`${order.id}-${index}`} className="flex items-start justify-between gap-3"><span className="min-w-0">{item.name ?? labels.fallbackItem} <span className="text-slate-400">× {item.qty ?? 1}</span></span>{item.price != null && <span className="shrink-0 text-xs tabular-nums text-slate-500">{format(Number(item.price) * Number(item.qty ?? 1))}</span>}</li>)}
        </ul>
      </section>)}
    </div>

    <div className="mx-4 space-y-2 border-t border-dashed border-slate-200 py-4 text-sm sm:mx-5">
      <Row label={labels.subtotal} value={format(subtotal)} />
      {serviceChargePct > 0 && <Row label={`${labels.serviceCharge} ${serviceChargePct}%`} value={format(service)} />}
      {vatPct > 0 && <Row label={`${labels.vat} ${vatPct}%`} value={format(vat)} />}
      <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-3"><span className="font-bold text-slate-800">{labels.amountDue}</span><span className="text-xl font-black tabular-nums text-emerald-900">{format(total)}</span></div>
    </div>

    {canAct && <footer className="flex gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5">
      <button disabled={busy} onClick={onPay} className="flex-1 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-50">{labels.collectPayment}</button>
      <button disabled={busy} onClick={onTransfer} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-900 disabled:opacity-50">{labels.moveTable}</button>
    </footer>}
  </article>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 text-slate-500"><span>{label}</span><span className="tabular-nums text-slate-700">{value}</span></div>;
}

function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

export function money(value: number | string, currencyCode: "LAK" | "THB" | "USD" = "LAK", locale: Locale = "th") {
  const locales: Record<Locale, string> = { th: "th-TH", lo: "lo-LA", en: "en-US", ko: "ko-KR", vi: "vi-VN", zh: "zh-CN" };
  return new Intl.NumberFormat(locales[locale], { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(Number(value));
}

function dateLocale(locale: Locale) {
  return ({ th: "th-TH-u-ca-gregory", lo: "lo-LA", en: "en-US", ko: "ko-KR", vi: "vi-VN", zh: "zh-CN" })[locale];
}
