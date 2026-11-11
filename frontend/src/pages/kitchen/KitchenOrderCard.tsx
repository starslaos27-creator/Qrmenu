import { useState } from "react";
import type { KitchenMenu, KitchenOrder, OrderItem } from "./types";

export default function KitchenOrderCard({ order, tableNumber, zoneName, menuMap, memberEmails, role, currencyCode, busy, canConfirmItems, onAccept, onReady, onServe, onCancel, onPrint, onSaveItems, onResolveItem, onConfirmItem }: {
  order: KitchenOrder;
  tableNumber: string | number;
  zoneName: string;
  menuMap: Map<string, KitchenMenu>;
  memberEmails: Record<string, string>;
  role: string;
  currencyCode: "LAK" | "THB" | "USD";
  busy: boolean;
  canConfirmItems: boolean;
  onAccept: (order: KitchenOrder) => void;
  onReady: (order: KitchenOrder) => void;
  onServe: (order: KitchenOrder) => void;
  onCancel: (order: KitchenOrder) => void;
  onPrint: (order: KitchenOrder) => void;
  onSaveItems: (order: KitchenOrder, items: OrderItem[]) => Promise<boolean>;
  onResolveItem: (order: KitchenOrder, index: number, action: "remove", expectedItems: OrderItem[]) => Promise<void>;
  onConfirmItem: (order: KitchenOrder, index: number) => void;
}) {
  const canManage = role === "owner" || role === "cook";
  const canEdit = canManage && !order.paid && !Object.keys(order.item_confirmations || {}).length;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<OrderItem[]>(order.items.map((item) => ({ ...item })));
  const [saving, setSaving] = useState(false);
  const [itemError, setItemError] = useState("");
  const displayedItems = editing ? draft : order.items;
  const total = editing ? draft.reduce((sum, item) => sum + Number(menuMap.get(item.menu_id)?.price ?? item.unit_price ?? 0) * item.qty, 0) : Number(order.total);

  async function saveItems() {
    if (saving || draft.length === 0) return;
    setSaving(true);
    setItemError("");
    const saved = await onSaveItems(order, draft);
    if (saved) setEditing(false);
    setSaving(false);
  }

  async function removeItem(index: number) {
    if (!window.confirm(displayedItems.length === 1 ? "ลบรายการสุดท้ายจะยกเลิกออเดอร์ ต้องการดำเนินการต่อหรือไม่?" : "ลบรายการนี้ออกจากออเดอร์หรือไม่?")) return;
    setSaving(true);
    setItemError("");
    try {
      await onResolveItem(order, index, "remove", order.items);
      if (displayedItems.length > 1) setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
      else setEditing(false);
    } catch (cause) {
      setItemError(cause instanceof Error ? cause.message : "ลบรายการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${order.status === "ready" ? "border-emerald-300" : "border-slate-200"}`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-emerald-900 px-2.5 py-1 text-sm font-bold tabular-nums text-white">โต๊ะ {tableNumber}</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{zoneName || "ไม่ระบุโซน"}</span><span className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500">#{order.receipt_number || order.id.slice(-6)}</span><span className="text-xs text-slate-500">{formatTime(order.created_at)}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${order.status === "ready" ? "bg-emerald-100 text-emerald-800" : order.accepted_at ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{order.status === "ready" ? "พร้อมเสิร์ฟ" : order.accepted_at ? "กำลังทำ" : "รอรับออเดอร์"}</span><span className="text-xs tabular-nums text-slate-500">{elapsedTime(order.created_at)}</span></div>
      <div className="flex items-center gap-2"><strong className="text-sm tabular-nums">{money(total, currencyCode)}</strong>{canEdit && !editing && <button type="button" onClick={() => { setDraft(order.items.map((item) => ({ ...item }))); setItemError(""); setEditing(true); }} className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">แก้ไขรายการ</button>}</div>
    </header>
    <ul className="space-y-2 px-4 py-3">
      {displayedItems.map((item, index) => {
        const menu = menuMap.get(item.menu_id);
        const confirmation = order.item_confirmations?.[String(index)];
        return <li key={`${item.menu_id}-${index}`} className="flex flex-wrap items-start gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
          <span className="min-w-6 pt-0.5 text-sm font-bold tabular-nums text-slate-400">{index + 1}.</span>
          <div className="min-w-0 flex-1"><strong className="text-sm">{menu ? menuName(menu) : "ไม่พบเมนู"}</strong>{menu?.description && <p className="mt-0.5 text-xs text-slate-500">{menu.description}</p>}{!editing && item.note && <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">📝 {item.note}</p>}{confirmation && <p className="mt-1 text-xs text-emerald-700">✓ เสร็จแล้ว · {memberEmails[confirmation.user_id] || confirmation.user_name}</p>}</div>
          {editing ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto"><label className="sr-only" htmlFor={`qty-${order.id}-${index}`}>จำนวน</label><input id={`qty-${order.id}-${index}`} type="number" min="1" max="99" value={item.qty} onChange={(event) => setDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, qty: Number(event.target.value) } : row))} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm" /><input aria-label="หมายเหตุ" maxLength={300} value={item.note ?? ""} onChange={(event) => setDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, note: event.target.value } : row))} placeholder="หมายเหตุ" className="min-w-32 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs sm:flex-none" /><button type="button" onClick={() => void removeItem(index)} disabled={saving} className="rounded-lg px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">ลบรายการ</button></div> : <><span className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums">× {item.qty}</span>{canConfirmItems && !confirmation && order.status !== "cancelled" && <button type="button" onClick={() => onConfirmItem(order, index)} disabled={busy} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">ยืนยันเสร็จ</button>}</>}
        </li>;
      })}
    </ul>
    {itemError && <p className="mx-4 mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-800" role="alert">{itemError}</p>}
    <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
      {editing ? <><button type="button" onClick={() => { setEditing(false); setDraft(order.items.map((item) => ({ ...item }))); }} disabled={saving} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium">ยกเลิก</button><button type="button" onClick={() => void saveItems()} disabled={saving || draft.length === 0 || draft.some((item) => !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99)} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "กำลังบันทึก…" : "บันทึกรายการ"}</button></> : <>
        {canManage && order.status === "pending" && !order.accepted_at && <button type="button" onClick={() => onAccept(order)} disabled={busy} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">{busy ? "กำลังบันทึก…" : "รับออเดอร์"}</button>}
        {canManage && order.status === "pending" && order.accepted_at && <button type="button" onClick={() => onReady(order)} disabled={busy} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">ทำเสร็จแล้ว</button>}
        <button type="button" onClick={() => onPrint(order)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-100">พิมพ์ใบครัว</button>
        {canManage && !order.paid && <button type="button" onClick={() => onCancel(order)} disabled={busy} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">ยกเลิกออเดอร์</button>}
        {canManage && <button type="button" onClick={() => onServe(order)} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? "กำลังบันทึก…" : "เสร็จทั้งใบ"}</button>}
      </>}
    </footer>
  </article>;
}

export function KitchenHistoryCard({ order, tableNumber, zoneName, menuMap, memberEmails, currencyCode }: { order: KitchenOrder; tableNumber: string | number; zoneName: string; menuMap: Map<string, KitchenMenu>; memberEmails: Record<string, string>; currencyCode: "LAK" | "THB" | "USD" }) {
  const cancelled = order.status === "cancelled";
  return <article className={`overflow-hidden rounded-2xl border bg-white ${cancelled ? "border-red-200" : "border-slate-200"}`}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-800 px-2 py-1 text-sm font-semibold text-white">โต๊ะ {tableNumber}</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs">{zoneName || "ไม่ระบุโซน"}</span><span className="text-xs text-slate-500">{formatTime(order.completed_at || order.created_at)}</span><span className={`rounded-full px-2 py-1 text-xs font-medium ${cancelled ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{cancelled ? "ยกเลิก" : "เสร็จแล้ว"}</span></div><strong className="text-sm tabular-nums">{money(order.total, currencyCode)}</strong></header>
    <ul className="space-y-1 px-4 py-3">{order.items.map((item, index) => { const menu = menuMap.get(item.menu_id); return <li key={`${item.menu_id}-${index}`} className="flex justify-between gap-3 text-sm"><span className={cancelled ? "text-slate-400 line-through" : ""}>{menu ? menuName(menu) : "ไม่พบเมนู"}{item.note && <small className="ml-2 text-slate-500">{item.note}</small>}</span><span className="shrink-0 text-xs text-slate-500">× {item.qty}</span></li>; })}</ul>
    <div className="space-y-1 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">{order.completed_by && <p className="m-0">ผู้ดำเนินการ: {memberEmails[order.completed_by] || order.completed_by.slice(0, 8)}</p>}{cancelled && order.cancel_reason && <p className="m-0">เหตุผล: {order.cancel_reason}</p>}</div>
  </article>;
}

function menuName(menu: KitchenMenu) { return menu.name_lo || menu.name; }
function money(value: number | string, currencyCode: "LAK" | "THB" | "USD") { return new Intl.NumberFormat("th-TH", { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(Number(value || 0)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function elapsedTime(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
