import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import InventoryItemForm from "./InventoryItemForm";
import InventoryRecipes from "./InventoryRecipes";
import StockMovementForm from "./StockMovementForm";
import { inputClass, primaryButton, secondaryButton } from "./styles";
import { useInventoryData } from "./useInventoryData";
import type { InventoryItem, InventoryTab } from "./types";

const tabs: Array<{ id: InventoryTab; label: string }> = [
  { id: "items", label: "วัตถุดิบทั้งหมด" },
  { id: "low", label: "สต็อกต่ำ" },
  { id: "movements", label: "ประวัติสต็อก" },
  { id: "recipes", label: "สูตรตัดสต็อก" },
];

export default function InventoryPage({ onLogin }: { onLogin: () => void }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [tab, setTab] = useState<InventoryTab>(readTab);
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<InventoryItem | null | "new">(null);
  const [movingItem, setMovingItem] = useState<InventoryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const data = useInventoryData(restaurantId);
  const isOwner = role === "owner";

  useEffect(() => {
    let cancelled = false;
    loadRestaurantSession().then((session) => {
      if (cancelled) return;
      if (!session.membership) {
        setSessionError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร");
        return;
      }
      setRestaurantId(session.membership.restaurant_id);
      setRole(session.membership.role);
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) onLogin();
      else setSessionError("โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
    });
    return () => { cancelled = true; };
  }, [onLogin]);

  useEffect(() => {
    const onPopState = () => setTab(readTab());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (role && role !== "owner" && tab === "recipes") changeTab("low");
  }, [role, tab]);

  function changeTab(next: InventoryTab) {
    if (next === "recipes" && !isOwner) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", next === "items" ? "all" : next === "movements" ? "history" : next);
    window.history.pushState({}, "", url);
    setTab(next);
  }

  const visibleItems = useMemo(() => data.items.filter((item) => {
    const matchesSearch = `${item.name} ${item.sku ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
    const isLow = item.active && item.track_stock && Number(item.quantity) <= Number(item.minimum_stock);
    return matchesSearch && (tab !== "low" || isLow);
  }), [data.items, search, tab]);

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restaurantId || editingItem === null || busy) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      sku: String(form.get("sku") ?? "").trim() || null,
      barcode: String(form.get("barcode") ?? "").trim() || null,
      unit: String(form.get("unit") ?? "").trim() || "ชิ้น",
      minimum_stock: Number(form.get("minimum_stock") ?? 0),
      image_url: String(form.get("image_url") ?? "").trim() || null,
    };
    setBusy(true); setActionError("");
    try {
      const root = `/api/restaurants/${restaurantId}/stock/items`;
      if (editingItem === "new") await apiRequest(root, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) });
      else await apiRequest(`${root}/${editingItem.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(payload) });
      setEditingItem(null);
      await data.refresh();
    } catch (cause) { setActionError(messageFor(cause)); }
    finally { setBusy(false); }
  }

  async function toggleItem(item: InventoryItem) {
    if (!restaurantId || busy) return;
    setBusy(true); setActionError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/stock/items/${item.id}`, {
        method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ active: !item.active }),
      });
      await data.refresh();
    } catch (cause) { setActionError(messageFor(cause)); }
    finally { setBusy(false); }
  }

  async function createDefaultLocation() {
    if (!restaurantId || busy) return;
    setBusy(true); setActionError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/stock/locations`, {
        method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "คลังสินค้าหลัก", is_default: true }),
      });
      await data.refresh();
    } catch (cause) { setActionError(messageFor(cause)); }
    finally { setBusy(false); }
  }

  if (sessionError) return <main className="mx-auto max-w-3xl p-6"><Notice>{sessionError}</Notice></main>;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-emerald-700">จัดการร้านอาหาร</p><h1 className="mt-1 text-2xl font-bold text-slate-900">คลังวัตถุดิบและสต็อก</h1><p className="mt-1 text-sm text-slate-500">จัดการจำนวนคงเหลือ รับเข้า เบิกออก และกำหนดสูตรตัดสต็อกตามเมนู</p></div>
        {isOwner && tab !== "recipes" && <button onClick={() => setEditingItem("new")} className={primaryButton}>+ เพิ่มวัตถุดิบ</button>}
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="วัตถุดิบที่ใช้งาน" value={data.items.filter((item) => item.active).length} />
        <Summary label="สต็อกต่ำ" value={data.items.filter(isLowStock).length} tone="amber" />
        <Summary label="หมดสต็อก" value={data.items.filter((item) => item.active && item.track_stock && Number(item.quantity) <= 0).length} tone="rose" />
        <Summary label="รายการเคลื่อนไหว" value={data.movements.length} />
      </section>
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200" aria-label="หมวดคลังสินค้า">
        {tabs.filter((item) => item.id !== "recipes" || isOwner).map((item) => <button key={item.id} onClick={() => changeTab(item.id)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${tab === item.id ? "border-emerald-600 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{item.label}</button>)}
      </nav>
      {actionError && <Notice tone="error">{actionError}</Notice>}
      {data.error && <Notice tone="error">{data.error} <button onClick={() => void data.refresh()} className="ml-2 underline">ลองอีกครั้ง</button></Notice>}
      {data.loading ? <div className="rounded-xl bg-white p-8 text-center text-slate-500">กำลังโหลดคลังสินค้า…</div> : tab === "recipes" ? <InventoryRecipes restaurantId={restaurantId} isOwner={isOwner} menus={data.menus} items={data.items} recipes={data.recipes} refresh={data.refresh} /> : tab === "movements" ? <MovementHistory movements={data.movements} /> : <>
        {data.locations.length === 0 && <Notice tone="warning">ยังไม่มีคลังสินค้า <button disabled={!isOwner || busy} onClick={() => void createDefaultLocation()} className="ml-2 font-semibold underline disabled:opacity-50">{isOwner ? "สร้างคลังสินค้าหลัก" : "ให้เจ้าของร้านสร้างคลังสินค้า"}</button></Notice>}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><h2 className="font-bold text-slate-900">{tab === "low" ? "รายการที่ถึงจุดเตือนสต็อก" : "รายการวัตถุดิบ"}</h2><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="ค้นหาชื่อหรือ SKU" className={inputClass + " w-full sm:w-72"} /></div>
          {visibleItems.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{tab === "low" ? "ไม่มีวัตถุดิบที่สต็อกต่ำ" : "ยังไม่มีรายการวัตถุดิบ"}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">วัตถุดิบ</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">คงเหลือ</th><th className="px-4 py-3">จุดเตือน</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3 text-right">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleItems.map((item) => <tr key={item.id} className={!item.active ? "opacity-50" : ""}><td className="px-4 py-3"><div className="flex items-center gap-3">{item.image_url ? <img src={item.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100">📦</span>}<div><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.unit}</p></div></div></td><td className="px-4 py-3 text-slate-600">{item.sku || "—"}</td><td className={`px-4 py-3 font-bold tabular-nums ${isLowStock(item) ? "text-amber-700" : "text-slate-800"}`}>{formatNumber(item.quantity)} {item.unit}</td><td className="px-4 py-3 text-slate-600">{formatNumber(item.minimum_stock)} {item.unit}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.active ? isLowStock(item) ? "สต็อกต่ำ" : "ใช้งาน" : "ปิดใช้งาน"}</span></td><td className="space-x-2 px-4 py-3 text-right">{item.active && <button onClick={() => setMovingItem(item)} className={secondaryButton}>ปรับสต็อก</button>}{isOwner && <button onClick={() => setEditingItem(item)} className={secondaryButton}>แก้ไข</button>}{isOwner && <button disabled={busy} onClick={() => void toggleItem(item)} className="rounded-lg px-2 py-2 text-xs text-rose-700 hover:bg-rose-50">{item.active ? "ปิด" : "เปิด"}</button>}</td></tr>)}</tbody></table></div>}
        </section>
      </>}
      {editingItem !== null && <InventoryItemForm item={editingItem === "new" ? null : editingItem} busy={busy} error={actionError} onClose={() => { setEditingItem(null); setActionError(""); }} onSubmit={saveItem} />}
      {movingItem && <StockMovementForm item={movingItem} restaurantId={restaurantId} locations={data.locations} onClose={() => { setMovingItem(null); setActionError(""); }} onSaved={async () => { setMovingItem(null); await data.refresh(); }} onError={setActionError} />}
    </main>
  );
}

function MovementHistory({ movements }: { movements: ReturnType<typeof useInventoryData>["movements"] }) {
  const labels: Record<string, string> = { opening: "ยอดตั้งต้น", purchase: "รับเข้า", waste: "ของเสีย", adjustment: "ปรับยอด", return_in: "รับคืน", return_out: "ส่งคืน", sale: "ขาย" };
  return <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">วัตถุดิบ</th><th className="px-4 py-3">ประเภท</th><th className="px-4 py-3">จำนวน</th><th className="px-4 py-3">คลัง / ผู้บันทึก</th><th className="px-4 py-3">หมายเหตุ</th></tr></thead><tbody className="divide-y divide-slate-100">{movements.map((movement) => <tr key={movement.id}><td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(movement.occurred_at).toLocaleString(undefined, { calendar: "gregory" })}</td><td className="px-4 py-3 font-semibold">{movement.item_name}</td><td className="px-4 py-3">{labels[movement.movement_type] ?? movement.movement_type}</td><td className={`px-4 py-3 font-bold tabular-nums ${Number(movement.quantity_delta) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(movement.quantity_delta) > 0 ? "+" : ""}{formatNumber(movement.quantity_delta)} {movement.unit}</td><td className="px-4 py-3 text-slate-500">{movement.location_name}{movement.actor_name ? ` · ${movement.actor_name}` : ""}</td><td className="px-4 py-3 text-slate-500">{movement.note || "—"}</td></tr>)}</tbody></table>{movements.length === 0 && <p className="p-8 text-center text-slate-500">ยังไม่มีประวัติการเคลื่อนไหว</p>}</section>;
}

function Summary({ label, value, tone = "green" }: { label: string; value: number; tone?: "green" | "amber" | "rose" }) { const colors = { green: "text-emerald-700", amber: "text-amber-700", rose: "text-rose-700" }; return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${colors[tone]}`}>{value}</p></div>; }
function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" }) { const colors = { info: "bg-slate-100 text-slate-700", warning: "bg-amber-50 text-amber-900", error: "bg-rose-50 text-rose-800" }; return <div className={`rounded-lg p-3 text-sm ${colors[tone]}`}>{children}</div>; }
function isLowStock(item: InventoryItem) { return item.active && item.track_stock && Number(item.quantity) <= Number(item.minimum_stock); }
function readTab(): InventoryTab { const view = new URLSearchParams(window.location.search).get("view"); return view === "recipes" || view === "low" || view === "history" || view === "movements" ? view === "history" ? "movements" : view : "items"; }
function formatNumber(value: string | number) { return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 }); }
function messageFor(cause: unknown) { return cause instanceof ApiError && cause.code === "SKU_OR_BARCODE_EXISTS" ? "SKU หรือบาร์โค้ดนี้ถูกใช้งานแล้ว" : "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่"; }
const jsonHeaders = { "Content-Type": "application/json" };
