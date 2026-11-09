import { useMemo, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import type { InventoryItem, MenuItem, RecipeComponent } from "./types";
import { inputClass, primaryButton, secondaryButton } from "./styles";

export default function InventoryRecipes({ restaurantId, isOwner, menus, items, recipes, refresh }: {
  restaurantId: string | null;
  isOwner: boolean;
  menus: MenuItem[];
  items: InventoryItem[];
  recipes: RecipeComponent[];
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visibleMenus = useMemo(() => menus.filter((menu) => menu.name.toLowerCase().includes(search.trim().toLowerCase())), [menus, search]);
  function openMenu(menu: MenuItem) {
    const current = recipes.filter((recipe) => recipe.menu_id === menu.id);
    const quantityMap: Record<string, string> = {};
    const unitMap: Record<string, string> = {};
    current.forEach((component) => { quantityMap[component.inventory_item_id] = String(component.quantity); unitMap[component.inventory_item_id] = component.unit; });
    setQuantities(quantityMap); setUnits(unitMap); setSelected(menu); setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !restaurantId || busy) return;
    const components = Object.entries(quantities).map(([inventory_item_id, value]) => ({ inventory_item_id, quantity: Number(value) })).filter((component) => Number.isFinite(component.quantity) && component.quantity > 0);
    setBusy(true); setError("");
    try {
      for (const [id, value] of Object.entries(units)) {
        const item = items.find((candidate) => candidate.id === id);
        const unit = value.trim();
        if (item && unit && unit !== item.unit) await apiRequest(`/api/restaurants/${restaurantId}/stock/items/${id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ unit }) });
      }
      await apiRequest(`/api/restaurants/${restaurantId}/menus/${selected.id}/inventory-components`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ components }) });
      setSelected(null); await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError && cause.code === "INVALID_INVENTORY_ITEM" ? "มีวัตถุดิบที่ไม่ถูกต้อง กรุณาโหลดหน้าใหม่" : "บันทึกสูตรไม่สำเร็จ กรุณาลองใหม่");
    } finally { setBusy(false); }
  }

  function downloadCsv() {
    const rows = [["Menu", "Ingredient", "Quantity", "Unit"], ...recipes.map((recipe) => [recipe.menu_name, recipe.inventory_item_name, recipe.quantity, recipe.unit])];
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "shopqr-menu-recipes.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">สูตรตัดสต็อกตามเมนู</h2><p className="mt-1 text-sm text-slate-500">กำหนดปริมาณวัตถุดิบต่อเมนูหนึ่งรายการ ระบบจะนำไปใช้กับการตัดสต็อกจากการขาย</p></div><button type="button" onClick={downloadCsv} className={secondaryButton}>ดาวน์โหลดสูตร CSV</button></div>
    {!isOwner && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขสูตรได้</p>}
    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาเมนู" className={inputClass + " w-full sm:max-w-sm"} />
    {visibleMenus.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">ไม่พบเมนู กรุณาเพิ่มเมนูในหน้าจัดการเมนูก่อน</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleMenus.map((menu) => {
      const components = recipes.filter((recipe) => recipe.menu_id === menu.id);
      return <article key={menu.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{menu.name}</h3><p className="mt-1 text-xs text-slate-500">{components.length ? `${components.length} วัตถุดิบ` : "ยังไม่ได้ตั้งค่าสูตร"}</p></div>{isOwner && <button type="button" onClick={() => openMenu(menu)} className={secondaryButton}>{components.length ? "แก้ไขสูตร" : "ตั้งค่าสูตร"}</button>}</div>{components.length > 0 && <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">{components.slice(0, 3).map((component) => <li key={component.inventory_item_id} className="flex justify-between gap-2"><span className="truncate">{component.inventory_item_name}</span><span className="shrink-0">{component.quantity} {component.unit}</span></li>)}{components.length > 3 && <li className="text-xs text-slate-400">และอีก {components.length - 3} รายการ</li>}</ul>}</article>;
    })}</div>}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={() => setSelected(null)}><form onSubmit={save} onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
      <header className="border-b border-slate-100 p-5"><h3 className="text-lg font-bold">สูตรตัดสต็อก: {selected.name}</h3><p className="mt-1 text-sm text-slate-500">ใส่ปริมาณต่อเมนู เว้นว่างหรือใส่ 0 หากไม่ใช้วัตถุดิบนั้น</p><input autoFocus type="search" value={ingredientSearch} onChange={(event) => setIngredientSearch(event.target.value)} placeholder="ค้นหาวัตถุดิบ" className={inputClass + " mt-3 w-full"} /></header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">{items.filter((item) => item.active && item.name.toLowerCase().includes(ingredientSearch.trim().toLowerCase())).map((item) => <div key={item.id} className="grid grid-cols-[1fr_100px_100px] items-center gap-2 rounded-lg border border-slate-100 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-slate-500">คงเหลือ {item.quantity} {item.unit}</p></div><label className="text-center text-[10px] text-slate-500">จำนวน<input min="0" step="any" type="number" value={quantities[item.id] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} className={inputClass + " mt-1 w-full text-center"} /></label><label className="text-center text-[10px] text-slate-500">หน่วย<input maxLength={50} value={units[item.id] ?? item.unit} onChange={(event) => setUnits((current) => ({ ...current, [item.id]: event.target.value }))} className={inputClass + " mt-1 w-full text-center"} /></label></div>)}{items.filter((item) => item.active).length === 0 && <p className="p-8 text-center text-sm text-slate-500">เพิ่มวัตถุดิบก่อนตั้งค่าสูตร</p>}</div>
      {error && <p role="alert" className="mx-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4"><button type="button" onClick={() => setSelected(null)} className={secondaryButton}>ยกเลิก</button><button disabled={busy} className={primaryButton}>{busy ? "กำลังบันทึก…" : "บันทึกสูตร"}</button></footer>
    </form></div>}
  </section>;
}

const jsonHeaders = { "Content-Type": "application/json" };
