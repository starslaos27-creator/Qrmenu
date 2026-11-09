import { useMemo, useState, type ReactNode } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import { useCustomerMenu } from "./useCustomerMenu";
import type { CartLine, PublicMenuItem } from "./types";

const statuses: Record<string, string> = { pending: "รอร้านยืนยัน", cooking: "กำลังทำ", ready: "พร้อมเสิร์ฟ", served: "เสิร์ฟแล้ว", cancelled: "ยกเลิก" };
export default function CustomerMenuPage({ tableCode }: { tableCode: string }) {
  const { data, orders, billCheckRequested, error, loading, refresh } = useCustomerMenu(tableCode);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callBusy, setCallBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const open = !!data?.restaurant.accepting_orders && !!data.table.is_open;
  const visibleMenus = useMemo(() => data?.menus.filter((menu) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [menu.name, menu.name_lo, menu.name_en, menu.description].some((value) => value?.toLowerCase().includes(term));
    return matches && (categoryId === "all" || menu.category_id === categoryId);
  }) ?? [], [data, search, categoryId]);
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = cart.reduce((sum, line) => sum + Number(line.menu.price) * line.qty, 0);

  function add(menu: PublicMenuItem) {
    setCart((current) => {
      const existing = current.find((line) => line.menu.id === menu.id);
      if (existing) return current.map((line) => line.menu.id === menu.id ? { ...line, qty: Math.min(99, line.qty + 1) } : line);
      return [...current, { menu, qty: 1, note: "" }];
    });
    setMessage("");
  }
  function changeQty(id: string, delta: number) { setCart((current) => current.flatMap((line) => line.menu.id !== id ? [line] : line.qty + delta <= 0 ? [] : [{ ...line, qty: Math.min(99, line.qty + delta) }])); }
  function updateNote(id: string, note: string) { setCart((current) => current.map((line) => line.menu.id === id ? { ...line, note } : line)); }

  async function submitOrder() {
    if (!data || !open || !cart.length || submitBusy) return;
    setSubmitBusy(true); setMessage("");
    try {
      await apiRequest("/api/public/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableCode: data.table.short_code, clientRequestId: crypto.randomUUID(), items: cart.map((line) => ({ menu_id: line.menu.id, qty: line.qty, note: line.note.trim() || null })) }) }, { auth: false });
      setCart([]); setCartOpen(false); setMessage("ส่งรายการอาหารให้ร้านแล้ว"); await refresh();
    } catch (cause) {
      setMessage(cause instanceof ApiError && cause.code === "ORDERING_CLOSED" ? "ขณะนี้ร้านปิดรับออเดอร์" : "ส่งออเดอร์ไม่สำเร็จ กรุณาตรวจสอบสัญญาณแล้วลองใหม่");
    } finally { setSubmitBusy(false); }
  }

  async function callStaff() {
    if (!data || callBusy) return;
    setCallBusy(true); setMessage("");
    try {
      await apiRequest("/api/public/call-staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableCode: data.table.short_code, reason: reason.trim() || null }) }, { auth: false });
      setReason(""); setMessage("เรียกพนักงานแล้ว กรุณารอสักครู่");
    } catch (cause) { setMessage(cause instanceof ApiError && cause.code === "PLEASE_WAIT" ? "กรุณารอสักครู่ก่อนเรียกพนักงานอีกครั้ง" : "เรียกพนักงานไม่สำเร็จ"); }
    finally { setCallBusy(false); }
  }

  async function requestBillCheck() {
    if (!data || callBusy || billCheckRequested) return;
    setCallBusy(true); setMessage("");
    try {
      await apiRequest("/api/public/call-staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableCode: data.table.short_code, reason: "ขอเช็กบิล" }) }, { auth: false });
      await refresh();
      setMessage("ส่งคำขอแล้ว พนักงานกำลังเช็กบิล");
    } catch (cause) {
      setMessage(cause instanceof ApiError && cause.code === "PLEASE_WAIT" ? "ส่งคำขอไปแล้ว กรุณารอสักครู่ พนักงานกำลังเช็กบิล" : "ส่งคำขอเช็กบิลไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { setCallBusy(false); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-stone-50 text-slate-500">กำลังโหลดเมนู…</main>;
  if (!data) return <main className="grid min-h-screen place-items-center bg-stone-50 p-6"><section className="text-center"><h1 className="text-xl font-bold">ไม่พบเมนู</h1><p className="mt-2 text-sm text-slate-500">{error}</p><button onClick={() => void refresh()} className={primary + " mt-4"}>โหลดใหม่</button></section></main>;
  const service = subtotal * Number(data.restaurant.service_charge_pct || 0) / 100;
  const vat = (subtotal + service) * Number(data.restaurant.vat_pct || 0) / 100;

  return <main className="min-h-screen bg-stone-50 pb-28 text-slate-800">
    <header className="relative overflow-hidden bg-emerald-950 px-5 py-8 text-white"><div className="mx-auto max-w-5xl"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">{data.zone?.name ?? "ยินดีต้อนรับ"} · โต๊ะ {data.table.table_number}</p><h1 className="mt-2 text-3xl font-bold">{data.restaurant.name}</h1><p className="mt-2 text-sm text-emerald-100">{open ? "เปิดรับรายการอาหาร" : "ขณะนี้ปิดรับรายการอาหาร"}</p>{data.restaurant.open_time && data.restaurant.close_time && <p className="mt-1 text-xs text-emerald-200">เวลา {data.restaurant.open_time}–{data.restaurant.close_time}</p>}</div></header>
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5"><div className="flex flex-wrap gap-2"><button onClick={() => setOrdersOpen(true)} className={secondary}>ออเดอร์ของโต๊ะ ({orders.filter((order) => !order.paid).length})</button><button onClick={() => setCartOpen(true)} className={secondary}>ตะกร้า ({cartCount})</button><button disabled={callBusy || billCheckRequested || !orders.some((order) => !order.paid)} onClick={() => void requestBillCheck()} className={secondary + " disabled:opacity-60"}>{billCheckRequested ? "กำลังเช็กบิล" : callBusy ? "กำลังส่งคำขอ…" : "ขอเช็กบิล"}</button><button onClick={() => setCallOpen((value) => !value)} className={secondary}>เรียกพนักงาน</button></div>
      {billCheckRequested && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">กำลังเช็กบิล กรุณารอสักครู่</p>}
      {callOpen && <div className="flex flex-wrap gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3"><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="ระบุเหตุผล (ถ้ามี)" className={input + " min-w-52 flex-1"} /><button disabled={callBusy} onClick={() => void callStaff()} className={primary}>{callBusy ? "กำลังส่ง…" : "ส่งคำขอ"}</button></div>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {data.promotions.length > 0 && <section className="grid gap-3 sm:grid-cols-2">{data.promotions.map((promotion) => <article key={promotion.id} className="flex overflow-hidden rounded-xl border border-amber-200 bg-amber-50">{promotion.image_url && <img src={promotion.image_url} alt="" className="w-24 object-cover" />}<div className="p-3"><h2 className="font-bold">{promotion.title}</h2>{promotion.description && <p className="mt-1 text-sm text-slate-600">{promotion.description}</p>}</div></article>)}</section>}
      <div className="flex flex-wrap gap-3"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาเมนู" className={input + " min-w-56 flex-1"} /><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={input}><option value="all">ทุกหมวดหมู่</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <section className="grid gap-3 sm:grid-cols-2">{visibleMenus.map((menu) => <MenuCard key={menu.id} menu={menu} currencyCode={data.restaurant.currency_code} disabled={!open} quantity={cart.find((line) => line.menu.id === menu.id)?.qty ?? 0} onAdd={() => add(menu)} />)}</section>
      {visibleMenus.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-slate-500">ไม่พบเมนู</p>}
    </div>
    {cartCount > 0 && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><div className="mx-auto flex max-w-5xl items-center gap-3"><button onClick={() => setCartOpen(true)} className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold">ตะกร้า {cartCount}</button><button disabled={!open} onClick={() => void submitOrder()} className={primary + " flex flex-1 justify-between px-4 py-3"}><span>{open ? "ส่งรายการอาหาร" : "ร้านปิดรับออเดอร์"}</span><span>{money(subtotal + service + vat, data.restaurant.currency_code)}</span></button></div></div>}
    {cartOpen && <Modal title="รายการในตะกร้า" onClose={() => setCartOpen(false)}><div className="max-h-[55vh] space-y-3 overflow-y-auto">{cart.map((line) => <div key={line.menu.id} className="rounded-lg border border-slate-100 p-3"><div className="flex justify-between gap-3"><div><p className="font-semibold">{line.menu.name}</p><p className="text-xs text-slate-500">{money(Number(line.menu.price), data.restaurant.currency_code)}</p></div><div className="flex items-center gap-2"><button onClick={() => changeQty(line.menu.id, -1)} className={qtyButton}>−</button><span>{line.qty}</span><button onClick={() => changeQty(line.menu.id, 1)} className={qtyButton}>+</button></div></div><input maxLength={300} value={line.note} onChange={(event) => updateNote(line.menu.id, event.target.value)} placeholder="หมายเหตุ เช่น ไม่เผ็ด" className={input + " mt-2 w-full"} /></div>)}</div>{message && <p className="text-sm text-rose-700">{message}</p>}<div className="flex justify-end gap-2"><button onClick={() => setCartOpen(false)} className={secondary}>กลับไปเลือก</button><button disabled={!open || submitBusy || !cart.length} onClick={() => void submitOrder()} className={primary}>{submitBusy ? "กำลังส่ง…" : "ยืนยันสั่งอาหาร"}</button></div></Modal>}
    {ordersOpen && <Modal title={`ออเดอร์โต๊ะ ${data.table.table_number}`} onClose={() => setOrdersOpen(false)}><div className="max-h-[65vh] space-y-3 overflow-y-auto">{orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between gap-2"><span className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{order.paid ? "ชำระแล้ว" : statuses[order.status] ?? order.status}</span></div><ul className="mt-2 space-y-1 text-sm">{order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.name} × {item.qty}{item.note ? ` — ${item.note}` : ""}</li>)}</ul><p className="mt-2 text-right font-bold">{money(order.total, data.restaurant.currency_code)}</p></article>)}{orders.length === 0 && <p className="p-8 text-center text-sm text-slate-500">ยังไม่มีออเดอร์</p>}</div>{data.restaurant.payment_qr_url && <div className="border-t border-slate-100 pt-3 text-center"><p className="mb-2 text-sm font-semibold">QR สำหรับชำระเงิน</p><img src={data.restaurant.payment_qr_url} alt="QR ชำระเงิน" className="mx-auto max-h-48 rounded-lg" /></div>}</Modal>}
  </main>;
}

function MenuCard({ menu, currencyCode, disabled, quantity, onAdd }: { menu: PublicMenuItem; currencyCode: "LAK" | "THB" | "USD"; disabled: boolean; quantity: number; onAdd: () => void }) { return <article className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">{menu.image_url ? <img src={menu.image_url} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" /> : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-emerald-50 text-3xl">🍽️</div>}<div className="flex min-w-0 flex-1 flex-col"><h2 className="font-bold">{menu.name}</h2>{(menu.name_lo || menu.name_en) && <p className="text-xs text-slate-500">{menu.name_lo || menu.name_en}</p>}{menu.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{menu.description}</p>}<div className="mt-auto flex items-center justify-between gap-2 pt-2"><span className="font-bold text-emerald-800">{money(menu.price, currencyCode)}</span><button disabled={disabled} onClick={onAdd} className={primary + " px-3 py-1.5"}>{quantity ? `เพิ่มอีก · ${quantity}` : "เพิ่ม"}</button></div></div></article>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}><section onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl"><header className="flex justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="ปิด">×</button></header>{children}</section></div>; }
function money(value: number | string, currencyCode: "LAK" | "THB" | "USD") { return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(Number(value)); }
const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600";
const primary = "rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold";
const qtyButton = "grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-lg";
