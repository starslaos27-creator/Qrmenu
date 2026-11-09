import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import type { PublicCategory, PublicMenuItem } from "../customer-menu/types";

interface Zone { id: string; name: string }
interface Table { id: string; zone_id: string; table_number: string; short_code: string; is_open: boolean }
interface CartLine { menu: PublicMenuItem; qty: number; note: string }
type ServiceMode = "eat" | "take";

export default function StaffOrderPage({ onLogin }: { onLogin: () => void }) {
  const [restaurantId, setRestaurantId] = useState("");
  const [currencyCode, setCurrencyCode] = useState<"LAK" | "THB" | "USD">("LAK");
  const [role, setRole] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menus, setMenus] = useState<PublicMenuItem[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [mode, setMode] = useState<ServiceMode>("eat");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadRestaurantSession().then((session) => {
      if (cancelled) return;
      if (!session.membership) { setError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร"); setLoading(false); return; }
      setRestaurantId(session.membership.restaurant_id); setRole(session.membership.role); setRestaurantName(session.membership.restaurant_name); setCurrencyCode(session.membership.currency_code ?? "LAK");
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) onLogin();
      else { setError("โหลดข้อมูลบัญชีไม่สำเร็จ"); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [onLogin]);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    async function refresh() {
      try {
        const root = `/api/restaurants/${restaurantId}`;
        const [shop, menuResult, categoryResult, zoneResult, tableResult] = await Promise.all([
          apiRequest<{ restaurant: { name: string; accepting_orders: boolean } }>(root),
          apiRequest<{ menus: PublicMenuItem[] }>(`${root}/menus`),
          apiRequest<{ categories: PublicCategory[] }>(`${root}/categories`),
          apiRequest<{ zones: Zone[] }>(`${root}/zones`),
          apiRequest<{ tables: Table[] }>(`${root}/tables`),
        ]);
        if (cancelled) return;
        setRestaurantName(shop.restaurant.name); setMenus(menuResult.menus.filter((menu) => menu.available)); setCategories(categoryResult.categories); setZones(zoneResult.zones); setTables(tableResult.tables); setZoneId((value) => value || zoneResult.zones[0]?.id || ""); setError("");
      } catch { if (!cancelled) setError("โหลดเมนู โต๊ะ หรือโซนไม่สำเร็จ"); }
      finally { if (!cancelled) setLoading(false); }
    }
    void refresh(); const timer = window.setInterval(() => void refresh(), 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [restaurantId]);

  const shownMenus = useMemo(() => menus.filter((menu) => {
    const query = search.trim().toLowerCase();
    const found = !query || [menu.name, menu.name_lo, menu.name_en, menu.description].some((value) => value?.toLowerCase().includes(query));
    return found && (categoryId === "all" || menu.category_id === categoryId);
  }), [menus, search, categoryId]);
  const totalQty = cart.reduce((total, item) => total + item.qty, 0);
  const totalPrice = cart.reduce((total, item) => total + Number(item.menu.price) * item.qty, 0);

  function add(menu: PublicMenuItem) { setCart((current) => { const existing = current.find((item) => item.menu.id === menu.id); return existing ? current.map((item) => item.menu.id === menu.id ? { ...item, qty: Math.min(99, item.qty + 1) } : item) : [...current, { menu, qty: 1, note: "" }]; }); setMessage(""); }
  function remove(menuId: string) { setCart((current) => current.flatMap((item) => item.menu.id !== menuId ? [item] : item.qty <= 1 ? [] : [{ ...item, qty: item.qty - 1 }])); }
  function updateQty(menuId: string, quantity: number) { setCart((current) => current.flatMap((item) => item.menu.id !== menuId ? [item] : quantity <= 0 ? [] : [{ ...item, qty: Math.min(99, quantity) }])); }
  function updateNote(menuId: string, note: string) { setCart((current) => current.map((item) => item.menu.id === menuId ? { ...item, note } : item)); }

  async function submit(event: FormEvent<HTMLFormElement>, checkout: boolean) {
    event.preventDefault(); if (busy || !totalQty) return;
    const label = tableNumber.trim();
    if (!zoneId || !label) { setError(!zoneId ? "กรุณาเลือกโซนร้าน" : "กรุณาระบุหมายเลขโต๊ะ"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      let table = tables.find((item) => item.zone_id === zoneId && String(item.table_number) === label);
      if (!table) {
        if (role !== "owner") throw new Error("TABLE_CREATE_OWNER_ONLY");
        const created = await apiRequest<{ table: Table }>(`/api/restaurants/${restaurantId}/tables`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ zone_id: zoneId, table_number: label }) });
        table = created.table; setTables((current) => [...current, created.table]);
      }
      if (!table.is_open) {
        await apiRequest(`/api/restaurants/${restaurantId}/tables/${table.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ is_open: true }) });
        table = { ...table, is_open: true }; setTables((current) => current.map((item) => item.id === table!.id ? { ...item, is_open: true } : item));
      }
      await apiRequest("/api/public/orders", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ tableCode: table.short_code, clientRequestId: crypto.randomUUID(), items: cart.map((item) => ({ menu_id: item.menu.id, qty: item.qty, note: [mode === "take" ? "สั่งกลับบ้าน" : "", item.note.trim()].filter(Boolean).join(" · ") || null })) }) }, { auth: false });
      setCart([]); setMessage("บันทึกออเดอร์สำเร็จ");
      if (checkout) window.location.assign("/dashboard/bills");
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "TABLE_CREATE_OWNER_ONLY" ? "ไม่พบโต๊ะนี้ ให้เจ้าของร้านสร้างโต๊ะก่อน" : cause instanceof ApiError && cause.code === "ORDERING_CLOSED" ? "ร้านปิดรับออเดอร์อยู่" : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally { setBusy(false); }
  }

  if (loading) return <main className="p-8 text-center text-slate-500">กำลังโหลดเมนูอาหาร…</main>;
  return <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
    <section className="min-w-0 space-y-4"><header className="rounded-2xl bg-emerald-950 p-5 text-white"><p className="text-sm text-emerald-200">หน้าสั่งอาหารสำหรับพนักงาน</p><h1 className="mt-1 text-2xl font-bold">{restaurantName}</h1></header>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-3"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาเมนู" className={input + " min-w-52 flex-1"} /><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={input}><option value="all">ทุกหมวดหมู่</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <div className="grid gap-3 sm:grid-cols-2">{shownMenus.map((menu) => <article key={menu.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">{menu.image_url ? <img src={menu.image_url} alt="" className="h-20 w-20 rounded-lg object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-lg bg-emerald-50 text-2xl">🍽️</span>}<div className="flex min-w-0 flex-1 flex-col"><b>{menu.name}</b><p className="line-clamp-2 text-xs text-slate-500">{menu.description}</p><div className="mt-auto flex items-center justify-between gap-2 pt-2"><span className="font-bold">{formatMoney(menu.price, currencyCode)}</span><button onClick={() => add(menu)} className={primary}>+ เพิ่ม</button></div></div></article>)}</div>
      {shownMenus.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-slate-500">ไม่พบเมนู</p>}
    </section>
    <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4"><header className="flex items-center justify-between"><h2 className="font-bold">รายการสั่งอาหาร</h2><button type="button" disabled={busy || !totalQty} onClick={() => setCart([])} className="text-xs text-rose-700 disabled:opacity-50">ล้างบิล</button></header>
      <div className="grid grid-cols-2 gap-2">{([ ["eat", "ทานที่ร้าน"], ["take", "สั่งกลับบ้าน"] ] as const).map(([value, label]) => <button key={value} type="button" disabled={busy} aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === value ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>)}</div>
      <label className="block space-y-1 text-xs font-semibold">โซน<select value={zoneId} disabled={busy} onChange={(event) => { setZoneId(event.target.value); setTableNumber(""); }} className={input}><option value="">เลือกโซน</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
      <label className="block space-y-1 text-xs font-semibold">หมายเลขโต๊ะ / ชื่อ<input list="staff-tables" value={tableNumber} disabled={busy} onChange={(event) => setTableNumber(event.target.value)} placeholder="โต๊ะ 1 / VIP1" className={input} /><datalist id="staff-tables">{tables.filter((table) => table.zone_id === zoneId).map((table) => <option key={table.id} value={table.table_number} />)}</datalist></label>
      <div className="max-h-[45vh] space-y-3 overflow-y-auto">{cart.map((item) => <article key={item.menu.id} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between gap-2"><b className="text-sm">{item.menu.name}</b><span className="text-sm font-semibold">{formatMoney(Number(item.menu.price) * item.qty, currencyCode)}</span></div><input maxLength={300} value={item.note} disabled={busy} onChange={(event) => updateNote(item.menu.id, event.target.value)} placeholder="หมายเหตุ เช่น ไม่เผ็ด" className={input + " mt-2"} /><div className="mt-2 flex items-center justify-end gap-2"><button onClick={() => remove(item.menu.id)} disabled={busy} className={qtyButton}>−</button><input type="number" min="1" max="99" step="1" value={item.qty} disabled={busy} onChange={(event) => updateQty(item.menu.id, Math.floor(Number(event.target.value) || 1))} className="w-14 rounded border border-slate-300 p-1 text-center text-sm" /><button onClick={() => add(item.menu)} disabled={busy} className={qtyButton}>+</button></div></article>)}</div>
      {!cart.length && <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีรายการอาหาร</p>}
      <div className="space-y-1 border-t border-slate-100 pt-3 text-sm"><div className="flex justify-between"><span>จำนวนรายการ</span><b>{totalQty}</b></div><div className="flex justify-between text-base"><span>ราคารวม</span><b>{formatMoney(totalPrice, currencyCode)}</b></div></div>
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{message}</p>}
      <form onSubmit={(event) => void submit(event, false)}><button disabled={busy || !totalQty} className={primary + " w-full"}>{busy ? "กำลังบันทึก…" : "บันทึกบิล (จ่ายทีหลัง)"}</button></form><form onSubmit={(event) => void submit(event, true)}><button disabled={busy || !totalQty} className={secondary + " w-full"}>เช็กบิล / ชำระเงิน →</button></form>
    </aside>
  </main>;
}

function Notice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) { return <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${tone === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{children}</p>; }
function formatMoney(value: number | string, currencyCode: "LAK" | "THB" | "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(Number(value)); }
const jsonHeaders = { "Content-Type": "application/json" };
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const primary = "rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";
const qtyButton = "grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-lg disabled:opacity-50";
