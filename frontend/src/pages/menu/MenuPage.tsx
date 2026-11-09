import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import MenuForm, { type MenuFormValue, type MenuImportRow } from "./MenuForm";
import { useMenuData } from "./useMenuData";
import type { RestaurantMenu } from "./types";

export default function MenuPage({ onLogin }: { onLogin: () => void }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState<"LAK" | "THB" | "USD">("LAK");
  const [sessionError, setSessionError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [editing, setEditing] = useState<RestaurantMenu | null | "new">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const data = useMenuData(restaurantId);

  useEffect(() => {
    let cancelled = false;
    loadRestaurantSession().then((session) => {
      if (cancelled) return;
      if (!session.membership) { setSessionError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร"); return; }
      if (session.membership.role !== "owner") { setSessionError("เฉพาะเจ้าของร้านเท่านั้นที่จัดการเมนูได้"); return; }
      setRestaurantId(session.membership.restaurant_id);
      setCurrencyCode(session.membership.currency_code ?? "LAK");
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) onLogin();
      else setSessionError("โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
    });
    return () => { cancelled = true; };
  }, [onLogin]);

  const visibleMenus = useMemo(() => data.menus.filter((menu) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [menu.name, menu.name_lo, menu.name_en, menu.stock_barcode].some((value) => value?.toLowerCase().includes(term));
    return matchesSearch && (categoryFilter === "all" || menu.category_id === categoryFilter) && (availability === "all" || (availability === "available" ? menu.available : !menu.available));
  }), [data.menus, search, categoryFilter, availability]);

  async function saveMenu(value: MenuFormValue) {
    if (!restaurantId || busy || editing === null) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const path = `/api/restaurants/${restaurantId}/menus`;
      if (editing === "new") await apiRequest(path, { method: "POST", headers: jsonHeaders, body: JSON.stringify(value) });
      else await apiRequest(`${path}/${editing.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(value) });
      setEditing(null); setNotice(editing === "new" ? "เพิ่มเมนูแล้ว" : "บันทึกการแก้ไขแล้ว"); await data.refresh();
    } catch (cause) { setError(messageFor(cause)); }
    finally { setBusy(false); }
  }

  async function importMenus(rows: MenuImportRow[]) {
    if (!restaurantId || busy) return;
    setBusy(true); setError(""); setNotice("");
    let imported = 0;
    const failed: string[] = [];
    try {
      const path = `/api/restaurants/${restaurantId}/menus`;
      const categoryIds = new Map(data.categories.map((category) => [category.name.trim().toLowerCase(), category.id]));
      let nextCategoryOrder = data.categories.length;
      for (const row of rows) {
        try {
          const categoryName = row.category.trim();
          let categoryId = categoryName ? categoryIds.get(categoryName.toLowerCase()) ?? null : null;
          if (categoryName && !categoryId) {
            const result = await apiRequest<{ category: { id: string } }>(`/api/restaurants/${restaurantId}/categories`, {
              method: "POST", headers: jsonHeaders,
              body: JSON.stringify({ name: categoryName, sort_order: nextCategoryOrder++ }),
            });
            categoryId = result.category.id;
            categoryIds.set(categoryName.toLowerCase(), categoryId);
          }
          await apiRequest(path, { method: "POST", headers: jsonHeaders, body: JSON.stringify({
            name: row.name, name_lo: null, name_en: null, category_id: categoryId,
            price: row.price, cost_price: row.cost_price, stock_quantity: row.stock_quantity, unit: row.unit,
            description: row.description, image_url: row.image_url, available: row.available,
            track_stock: row.stock_quantity > 0, low_alert_limit: 0, stock_barcode: null, bundles: [],
          }) });
          imported += 1;
        } catch { failed.push(row.name); }
      }
      setEditing(null);
      setNotice(failed.length ? `นำเข้าสำเร็จ ${imported} รายการ, ไม่สำเร็จ ${failed.length} รายการ${failed.length <= 3 ? `: ${failed.join(", ")}` : " กรุณาตรวจสอบรายการที่เหลือ"}` : `นำเข้าสำเร็จ ${imported} รายการ`);
      await data.refresh();
    } finally { setBusy(false); }
  }

  async function toggleAvailable(menu: RestaurantMenu) {
    if (!restaurantId || busy) return;
    setBusy(true); setError("");
    try { await apiRequest(`/api/restaurants/${restaurantId}/menus/${menu.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ available: !menu.available }) }); await data.refresh(); }
    catch { setError("เปลี่ยนสถานะเมนูไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function deleteMenu(menu: RestaurantMenu) {
    if (!restaurantId || busy || !window.confirm(`ลบเมนู “${menu.name}” ใช่ไหม?`)) return;
    setBusy(true); setError("");
    try { await apiRequest(`/api/restaurants/${restaurantId}/menus/${menu.id}`, { method: "DELETE" }); setNotice("ลบเมนูแล้ว"); await data.refresh(); }
    catch { setError("ลบเมนูไม่สำเร็จ อาจมีรายการขายอ้างอิงเมนูนี้อยู่"); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    const headers = ["Name", "Name Lao", "Name English", "Category", "Price", "Unit", "Cost", "Available", "Description"];
    const rows = visibleMenus.map((menu) => [menu.name, menu.name_lo, menu.name_en, data.categories.find((category) => category.id === menu.category_id)?.name, menu.price, menu.unit, menu.cost_price, menu.available, menu.description]);
    const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "shopqr-menu.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  if (sessionError) return <main className="mx-auto max-w-4xl p-6"><Alert>{sessionError}</Alert></main>;
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">จัดการร้านอาหาร</p><h1 className="mt-1 text-2xl font-bold">เมนูอาหาร</h1><p className="mt-1 text-sm text-slate-500">จัดการชื่อ ราคา รายละเอียด รูปภาพ และสถานะการขาย</p></div><div className="flex gap-2"><a href="/dashboard/categories" className={secondary}>จัดการหมวดหมู่</a><button onClick={exportCsv} className={secondary}>ส่งออก CSV</button><button onClick={() => setEditing("new")} className={primary}>+ เพิ่มเมนู</button></div></header>
    {(error || data.error) && <Alert>{error || data.error} {data.error && <button className="ml-2 underline" onClick={() => void data.refresh()}>ลองอีกครั้ง</button>}</Alert>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section className="grid gap-3 sm:grid-cols-3"><Summary label="เมนูทั้งหมด" value={data.menus.length} /><Summary label="เปิดขาย" value={data.menus.filter((menu) => menu.available).length} /><Summary label="ติดตามสต็อก" value={data.menus.filter((menu) => menu.track_stock).length} /></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap gap-3 border-b border-slate-100 p-4"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรือบาร์โค้ด" className={input + " min-w-56 flex-1"} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={input + " sm:w-52"}><option value="all">ทุกหมวดหมู่</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={availability} onChange={(event) => setAvailability(event.target.value)} className={input + " sm:w-40"}><option value="all">ทุกสถานะ</option><option value="available">เปิดขาย</option><option value="hidden">ปิดขาย</option></select></div>
      {data.loading ? <p className="p-8 text-center text-slate-500">กำลังโหลดเมนู…</p> : visibleMenus.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">ไม่พบเมนูตามเงื่อนไข</p> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">เมนู</th><th className="px-4 py-3">หมวดหมู่</th><th className="px-4 py-3">ราคา ({currencyCode})</th><th className="px-4 py-3">สต็อก</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3 text-right">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleMenus.map((menu) => <tr key={menu.id}><td className="px-4 py-3"><div className="flex items-center gap-3">{menu.image_url ? <img src={menu.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-slate-100">🍽️</span>}<div><p className="font-semibold text-slate-900">{menu.name}</p><p className="max-w-xs truncate text-xs text-slate-500">{menu.description || menu.name_en || menu.name_lo || "—"}</p></div></div></td><td className="px-4 py-3 text-slate-600">{data.categories.find((category) => category.id === menu.category_id)?.name ?? "ไม่ระบุ"}</td><td className="px-4 py-3 font-semibold tabular-nums">{new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(Number(menu.price))}</td><td className="px-4 py-3 text-slate-600">{menu.track_stock ? `${menu.stock_quantity} ${menu.unit ?? ""}` : "ไม่ติดตาม"}</td><td className="px-4 py-3"><button disabled={busy} onClick={() => void toggleAvailable(menu)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${menu.available ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{menu.available ? "เปิดขาย" : "ปิดขาย"}</button></td><td className="space-x-2 px-4 py-3 text-right"><button onClick={() => setEditing(menu)} className={secondary}>แก้ไข</button><button disabled={busy} onClick={() => void deleteMenu(menu)} className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">ลบ</button></td></tr>)}</tbody></table></div>}
    </section>
    {editing !== null && restaurantId && <MenuForm key={editing === "new" ? "new" : editing.id} restaurantId={restaurantId} categories={data.categories} menu={editing === "new" ? null : editing} busy={busy} error={error} onClose={() => { setEditing(null); setError(""); }} onSave={saveMenu} onImport={importMenus} />}
  </main>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>; }
function Alert({ children }: { children: ReactNode }) { return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{children}</p>; }
function messageFor(cause: unknown) { return cause instanceof ApiError && cause.code === "INVALID_CATEGORY" ? "หมวดหมู่ที่เลือกไม่ถูกต้อง กรุณาเลือกใหม่" : "บันทึกเมนูไม่สำเร็จ กรุณาตรวจสอบข้อมูล"; }
const jsonHeaders = { "Content-Type": "application/json" };
const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const primary = "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800";
const secondary = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
