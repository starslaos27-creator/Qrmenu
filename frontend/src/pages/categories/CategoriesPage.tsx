import { useEffect, useMemo, useState, type FormEvent } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";

interface Category {
  id: string;
  name: string;
  name_lo: string | null;
  name_en: string | null;
  sort_order: number;
}

interface MenuItem {
  id: string;
  name: string;
  name_lo: string | null;
  name_en: string | null;
  category_id: string | null;
}

interface CategoriesPageProps {
  onLogin: () => void;
}

export default function CategoriesPage({ onLogin }: CategoriesPageProps) {
  const [restaurantId, setRestaurantId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [name, setName] = useState("");
  const [nameLo, setNameLo] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await loadRestaurantSession();
        const id = session.membership?.restaurant_id;
        if (!id) {
          if (!cancelled) setError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร");
          return;
        }
        const [categoryResult, menuResult] = await Promise.all([
          apiRequest<{ categories: Category[] }>(`/api/restaurants/${id}/categories`),
          apiRequest<{ menus: MenuItem[] }>(`/api/restaurants/${id}/menus`),
        ]);
        if (cancelled) return;
        setRestaurantId(id);
        setCategories(categoryResult.categories);
        setMenus(menuResult.menus);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof ApiError && cause.status === 401
          ? "กรุณาเข้าสู่ระบบเพื่อจัดการหมวดหมู่"
          : "โหลดหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const menuCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const menu of menus) {
      if (menu.category_id) counts.set(menu.category_id, (counts.get(menu.category_id) ?? 0) + 1);
    }
    return counts;
  }, [menus]);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restaurantId || saving) return;
    const primaryName = name.trim() || nameLo.trim() || nameEn.trim();
    if (!primaryName) {
      setError("กรุณากรอกชื่อหมวดหมู่อย่างน้อยหนึ่งภาษา");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const result = await apiRequest<{ category: Category }>(`/api/restaurants/${restaurantId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: primaryName,
          name_lo: nameLo.trim() || null,
          name_en: nameEn.trim() || null,
          sort_order: categories.length,
        }),
      });
      setCategories((current) => [...current, result.category]);
      setName("");
      setNameLo("");
      setNameEn("");
    } catch (cause) {
      setError(cause instanceof ApiError ? `เพิ่มหมวดหมู่ไม่สำเร็จ (${cause.code})` : "เพิ่มหมวดหมู่ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function renameCategory(category: Category, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === category.name) return;
    const update: Partial<Category> = { name: trimmed };
    if (category.name_lo === category.name) update.name_lo = trimmed;
    if (category.name_en === category.name) update.name_en = trimmed;

    const previous = categories;
    setCategories((current) => current.map((item) => item.id === category.id ? { ...item, ...update } : item));
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
    } catch (cause) {
      setCategories(previous);
      throw cause;
    }
  }

  async function deleteCategory(category: Category) {
    const count = menuCounts.get(category.id) ?? 0;
    const warning = count
      ? `หมวดหมู่ “${category.name}” มีเมนู ${count} รายการ การลบจะลบเมนูเหล่านั้นด้วย ต้องการดำเนินการต่อหรือไม่?`
      : `ต้องการลบหมวดหมู่ “${category.name}” หรือไม่?`;
    if (!window.confirm(warning)) return;

    await apiRequest(`/api/restaurants/${restaurantId}/categories/${category.id}?deleteMenus=true`, { method: "DELETE" });
    setCategories((current) => current.filter((item) => item.id !== category.id));
    setMenus((current) => current.filter((menu) => menu.category_id !== category.id));
  }

  async function moveCategory(category: Category, offset: -1 | 1) {
    const index = categories.findIndex((item) => item.id === category.id);
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= categories.length) return;

    const reordered = [...categories];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setCategories(reordered);
    try {
      await Promise.all(reordered.map((item, sortOrder) => apiRequest(
        `/api/restaurants/${restaurantId}/categories/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: sortOrder }),
        },
      )));
    } catch (cause) {
      setCategories(categories);
      setError(cause instanceof ApiError ? `จัดลำดับไม่สำเร็จ (${cause.code})` : "จัดลำดับไม่สำเร็จ");
    }
  }

  if (loading) return <main className="grid min-h-full place-items-center p-6 text-sm text-slate-500">กำลังโหลดหมวดหมู่…</main>;

  if (error && !restaurantId) {
    return (
      <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
        <section className="mx-auto mt-16 grid max-w-lg justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">หมวดหมู่เมนู</h1>
          <p className="text-sm text-slate-600">{error}</p>
          {error.includes("เข้าสู่ระบบ") && <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white" type="button" onClick={onLogin}>ไปหน้าเข้าสู่ระบบ</button>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
      <header className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">หมวดหมู่เมนู</h1>
          <p className="mt-1 text-sm text-slate-500">จัดกลุ่มเมนูและเรียงลำดับที่แสดงให้ลูกค้า</p>
        </div>
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100" type="button" onClick={() => window.history.back()}>กลับ</button>
      </header>

      <div className="mx-auto grid max-w-6xl items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={addCategory}>
          <h2 className="font-semibold">เพิ่มหมวดหมู่</h2>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">ชื่อภาษาไทย<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">ຊື່ພາສາລາວ<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" value={nameLo} onChange={(event) => setNameLo(event.target.value)} maxLength={100} /></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">English name<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" value={nameEn} onChange={(event) => setNameEn(event.target.value)} maxLength={100} /></label>
          {error && <p className="m-0 text-sm text-red-700" role="alert">{error}</p>}
          <button className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={saving}>
            {saving ? "กำลังเพิ่ม…" : "เพิ่มหมวดหมู่"}
          </button>
        </form>

        <section className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="font-semibold">หมวดหมู่ทั้งหมด</h2><p className="mt-1 text-xs text-slate-500">{categories.length} หมวดหมู่</p></div>
          </div>
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีหมวดหมู่ เพิ่มหมวดหมู่แรกจากแบบฟอร์ม</p>
          ) : (
            <ol className="m-0 grid list-none gap-2 p-0">
              {categories.map((category, index) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  menus={menus.filter((menu) => menu.category_id === category.id)}
                  index={index}
                  total={categories.length}
                  onRename={renameCategory}
                  onDelete={deleteCategory}
                  onMove={moveCategory}
                />
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

function CategoryCard({
  category,
  menus,
  index,
  total,
  onRename,
  onDelete,
  onMove,
}: {
  category: Category;
  menus: MenuItem[];
  index: number;
  total: number;
  onRename: (category: Category, name: string) => Promise<void>;
  onDelete: (category: Category) => Promise<void>;
  onMove: (category: Category, direction: -1 | 1) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onRename(category, name);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? `บันทึกไม่สำเร็จ (${cause.code})` : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await onDelete(category);
    } catch (cause) {
      setError(cause instanceof ApiError ? `ลบไม่สำเร็จ (${cause.code})` : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="grid">
          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-40" type="button" aria-label={`เลื่อน ${category.name} ขึ้น`} disabled={busy || index === 0} onClick={() => void onMove(category, -1)}>↑</button>
          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-40" type="button" aria-label={`เลื่อน ${category.name} ลง`} disabled={busy || index === total - 1} onClick={() => void onMove(category, 1)}>↓</button>
        </div>
        <div className="grid min-w-0 flex-1 gap-1">
          {editing ? (
            <input
              autoFocus
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); void save(); }
                if (event.key === "Escape") setEditing(false);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              aria-label={`แก้ชื่อ ${category.name}`}
            />
          ) : <strong className="truncate">{category.name}</strong>}
          <span className="text-xs text-slate-500">{menus.length} เมนู</span>
        </div>
        {editing ? (
          <div className="ml-auto flex gap-1">
            <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-40" type="button" disabled={busy} onClick={() => { setEditing(false); setName(category.name); }}>ยกเลิก</button>
            <button className="rounded-lg bg-emerald-800 px-2 py-1 text-xs text-white disabled:opacity-40" type="button" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
          </div>
        ) : (
          <div className="ml-auto flex gap-1">
            <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-40" type="button" disabled={busy} onClick={() => { setName(category.name); setEditing(true); }}>แก้ไข</button>
            <button className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-40" type="button" disabled={busy} onClick={() => void remove()}>ลบ</button>
          </div>
        )}
        <button className="rounded-lg px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "ซ่อน" : "ดูเมนู"}
        </button>
      </div>

      {error && <p className="m-0 px-3 pb-2 text-sm text-red-700" role="alert">{error}</p>}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          {menus.length === 0 ? <p className="m-0 text-slate-500">ยังไม่มีเมนูในหมวดหมู่นี้</p> : (
            <ul className="m-0 grid gap-1 pl-5">{menus.map((menu) => <li key={menu.id}>{menu.name}</li>)}</ul>
          )}
        </div>
      )}
    </li>
  );
}
