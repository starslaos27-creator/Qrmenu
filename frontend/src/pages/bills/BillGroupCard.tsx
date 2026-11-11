import type { BillOrder, BillTable, BillZone } from "./types";

export default function BillGroupCard({ table, zone, orders, serviceChargePct, vatPct, currencyCode, busy, canAct, onPay, onTransfer }: {
  table: BillTable;
  zone: BillZone | undefined;
  orders: BillOrder[];
  serviceChargePct: number;
  vatPct: number;
  currencyCode: "LAK" | "THB" | "USD";
  busy: boolean;
  canAct: boolean;
  onPay: () => void;
  onTransfer: () => void;
}) {
  const subtotal = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const service = round(subtotal * serviceChargePct / 100);
  const vat = round((subtotal + service) * vatPct / 100);
  const total = subtotal + service + vat;
  const format = (value: number | string) => money(value, currencyCode);
  return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="flex items-start justify-between border-b border-slate-100 bg-slate-50 p-4"><div><p className="text-xs text-slate-500">{zone?.name ?? "ไม่ระบุโซน"}</p><h2 className="text-lg font-bold">โต๊ะ {table.table_number}</h2><p className="text-xs text-slate-500">{orders.length} ออเดอร์</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">รอชำระ</span></header><div className="divide-y divide-slate-100 px-4">{orders.map((order) => <div key={order.id} className="py-3"><div className="flex justify-between gap-2"><span className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString(undefined, { calendar: "gregory" })}</span><span className="font-semibold tabular-nums">{format(order.total)}</span></div><ul className="mt-1 space-y-0.5 text-xs text-slate-600">{order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.name ?? "รายการอาหาร"} × {item.qty ?? 1}</li>)}</ul></div>)}</div><div className="space-y-1 border-t border-slate-100 p-4 text-sm"><Row label="รวมอาหาร" value={format(subtotal)} />{serviceChargePct > 0 && <Row label={`ค่าบริการ ${serviceChargePct}%`} value={format(service)} />}{vatPct > 0 && <Row label={`VAT ${vatPct}%`} value={format(vat)} />}<Row label="ยอดชำระ" value={format(total)} strong /></div><footer className="flex gap-2 border-t border-slate-100 p-4">{canAct && <button disabled={busy} onClick={onPay} className="flex-1 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">รับชำระ</button>}{canAct && <button disabled={busy} onClick={onTransfer} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">ย้ายโต๊ะ</button>}</footer></article>;
}
function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between ${strong ? "border-t border-slate-200 pt-2 text-base font-bold" : "text-slate-600"}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>; }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function money(value: number | string, currencyCode: "LAK" | "THB" | "USD" = "LAK") { return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(Number(value)); }
