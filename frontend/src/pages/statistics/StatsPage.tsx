import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";

interface MenuItem {
  id: string;
  name: string;
  name_lo?: string | null;
  name_en?: string | null;
  category_id: string | null;
  price: number;
}

interface Category {
  id: string;
  name: string;
  name_lo?: string | null;
  name_en?: string | null;
}

interface Table {
  id: string;
  zone_id: string | null;
}

interface Zone {
  id: string;
  name: string;
}

interface OrderItem {
  menu_id: string;
  qty: number;
  note?: string | null;
}

interface PaidOrder {
  id: string;
  table_id: string;
  created_at: string;
  total: number;
  items: OrderItem[];
}

interface StatsPageProps {
  onLogin: () => void;
}

type DetailRange = "today" | "week" | "month";

export default function StatsPage({ onLogin }: StatsPageProps) {
  const [currencyCode, setCurrencyCode] = useState<"LAK" | "THB" | "USD">("LAK");
  const [orders, setOrders] = useState<PaidOrder[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [detailRange, setDetailRange] = useState<DetailRange | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await loadRestaurantSession();
        const restaurantId = session.membership?.restaurant_id;
        if (session.membership) setCurrencyCode(session.membership.currency_code ?? "LAK");
        if (!restaurantId) {
          if (!cancelled) setError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร");
          return;
        }
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const [orderResult, menuResult, categoryResult, tableResult, zoneResult] = await Promise.all([
          apiRequest<{ orders: PaidOrder[] }>(
            `/api/restaurants/${restaurantId}/orders?paid=true&since=${encodeURIComponent(since.toISOString())}&limit=500`,
          ),
          apiRequest<{ menus: MenuItem[] }>(`/api/restaurants/${restaurantId}/menus`),
          apiRequest<{ categories: Category[] }>(`/api/restaurants/${restaurantId}/categories`),
          apiRequest<{ tables: Table[] }>(`/api/restaurants/${restaurantId}/tables`),
          apiRequest<{ zones: Zone[] }>(`/api/restaurants/${restaurantId}/zones`),
        ]);
        if (cancelled) return;
        setOrders(orderResult.orders);
        setMenus(menuResult.menus);
        setCategories(categoryResult.categories);
        setTables(tableResult.tables);
        setZones(zoneResult.zones);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof ApiError && cause.status === 401
          ? "กรุณาเข้าสู่ระบบเพื่อดูสถิติ"
          : "โหลดสถิติไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const metrics = useMemo(() => calculateMetrics(orders, menus, tables, zones), [orders, menus, tables, zones]);
  const detail = useMemo(() => detailRange
    ? createDetail(orders, menus, categories, detailRange, categoryFilter)
    : null, [orders, menus, categories, detailRange, categoryFilter]);

  if (loading) return <main className="grid min-h-full place-items-center p-6 text-sm text-slate-500">กำลังโหลดสถิติ…</main>;

  if (error && orders.length === 0) {
    return (
      <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
        <section className="mx-auto mt-16 grid max-w-lg justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">สถิติการขาย</h1>
          <p className="text-sm text-slate-600">{error}</p>
          {error.includes("เข้าสู่ระบบ") && <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white" type="button" onClick={onLogin}>ไปหน้าเข้าสู่ระบบ</button>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full space-y-4 bg-slate-50 p-4 text-slate-800 sm:p-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div><h1 className="text-xl font-semibold">สถิติการขาย</h1><p className="mt-1 text-sm text-slate-500">สรุปรายการที่ชำระแล้วจาก 30 วันล่าสุด</p></div>
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100" type="button" onClick={() => window.history.back()}>กลับ</button>
      </header>

      <section className="mx-auto grid max-w-6xl gap-3 md:grid-cols-3">
        <PeriodCard label="วันนี้" value={metrics.todayRevenue} orders={metrics.todayOrders} currencyCode={currencyCode} active={detailRange === "today"} onClick={() => toggleRange("today", setDetailRange, setCategoryFilter)} />
        <PeriodCard label="7 วันล่าสุด" value={metrics.weekRevenue} orders={metrics.weekOrders} currencyCode={currencyCode} active={detailRange === "week"} onClick={() => toggleRange("week", setDetailRange, setCategoryFilter)} />
        <PeriodCard label="เดือนนี้" value={metrics.monthRevenue} orders={metrics.monthOrders} currencyCode={currencyCode} active={detailRange === "month"} onClick={() => toggleRange("month", setDetailRange, setCategoryFilter)} />
      </section>

      {detail && (
        <section className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="mb-3 flex items-start justify-between gap-4">
            <div><h2 className="font-semibold">รายละเอียด{rangeLabel(detailRange!)}</h2><p className="mt-1 text-xs text-slate-500">{detail.orders.length} บิล · {detail.itemCount} รายการ · {money(detail.revenue, currencyCode)}</p></div>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs" type="button" onClick={() => { setDetailRange(null); setCategoryFilter(null); }}>ปิด</button>
          </header>
          {detail.categories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              <FilterChip label="ทั้งหมด" active={!categoryFilter} onClick={() => setCategoryFilter(null)} />
              {detail.categories.map((category) => (
                <FilterChip key={category.id} label={category.name} active={categoryFilter === category.id} onClick={() => setCategoryFilter(category.id)} />
              ))}
            </div>
          )}
          {detail.orders.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">ไม่มีรายการในช่วงนี้</p> : (
            <ol className="m-0 grid list-none gap-2 p-0">
              {detail.orders.map((item) => (
                <li className="border-t border-slate-100 py-3" key={item.order.id}>
                  <div className="flex justify-between gap-3 text-xs text-slate-500"><time dateTime={item.order.created_at}>{formatDate(item.order.created_at)}</time><strong className="text-sm text-slate-800">{money(item.total, currencyCode)}</strong></div>
                  <ul className="mt-2 grid list-none gap-1 p-0">{item.items.map((line, index) => (
                    <li className="flex justify-between gap-3 text-sm" key={`${item.order.id}-${line.menuId}-${index}`}>
                      <span>{line.name} <small className="text-slate-500">×{line.qty}</small>{line.note && <small className="text-slate-500"> · {line.note}</small>}</span>
                      <span className="shrink-0 text-slate-600">{money(line.total, currencyCode)}</span>
                    </li>
                  ))}</ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <header className="mb-3"><div><h2 className="font-semibold">ยอดขายรายวัน</h2><p className="mt-1 text-xs text-slate-500">7 วันล่าสุด</p></div></header>
        <div className="flex h-52 items-stretch justify-between gap-2" role="img" aria-label="กราฟยอดขายรายวัน">
          {metrics.last7Days.map((day) => (
            <div className="grid min-w-0 flex-1 grid-rows-[auto_1fr_auto] gap-1 text-center" key={day.isoDate}>
              <span className="text-[10px] tabular-nums text-slate-500">{day.revenue ? compactMoney(day.revenue) : "—"}</span>
              <div className="flex h-full items-end"><div className={`w-full rounded-t-md ${day.isToday ? "bg-emerald-800" : "bg-slate-300"}`} style={{ height: `${day.height}%` }} /></div>
              <time className="text-[10px] text-slate-500" dateTime={day.isoDate}>{day.label}</time>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="mb-3"><div><h2 className="font-semibold">เมนูขายดี</h2><p className="mt-1 text-xs text-slate-500">เรียงตามจำนวนที่ขาย</p></div></header>
          {metrics.topMenus.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีข้อมูลการขาย</p> : (
            <ol className="m-0 grid list-none gap-3 p-0">
              {metrics.topMenus.map((item, index) => (
                <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1" key={item.id}>
                  <span className="row-span-2 grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-xs text-slate-600">{index + 1}</span>
                  <span className="flex min-w-0 justify-between gap-2 text-sm"><span className="truncate">{item.name}</span><small className="shrink-0 text-xs text-slate-500">{item.qty} รายการ · {money(item.revenue, currencyCode)}</small></span>
                  <span className="col-start-2 h-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-800" style={{ width: `${item.share}%` }} /></span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="mb-3"><div><h2 className="font-semibold">ยอดขายตามโซน</h2><p className="mt-1 text-xs text-slate-500">จากบิล 30 วันล่าสุด</p></div></header>
          {metrics.zoneSales.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีข้อมูลการขาย</p> : (
            <ol className="m-0 grid list-none gap-3 p-0">
              {metrics.zoneSales.map((item, index) => (
                <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1" key={item.id}>
                  <span className="row-span-2 grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-xs text-slate-600">{index + 1}</span>
                  <span className="flex min-w-0 justify-between gap-2 text-sm"><span className="truncate">{item.name}</span><small className="shrink-0 text-xs text-slate-500">{item.orders} บิล · {item.tables} โต๊ะ · {money(item.revenue, currencyCode)}</small></span>
                  <span className="col-start-2 h-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-800" style={{ width: `${item.share}%` }} /></span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

function PeriodCard({
  label,
  value,
  orders,
  currencyCode,
  active,
  onClick,
}: {
  label: string;
  value: number;
  orders: number;
  currencyCode: "LAK" | "THB" | "USD";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`grid grid-cols-[1fr_auto] gap-1 rounded-2xl border p-4 text-left shadow-sm transition ${active ? "border-emerald-700 ring-2 ring-emerald-800/10" : "border-slate-200 bg-white hover:border-slate-300"}`} type="button" onClick={onClick} aria-pressed={active}>
      <span className="text-xs font-medium text-slate-500">{label}</span><small className="text-[11px] text-slate-500">{active ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}</small>
      <strong className="col-span-2 text-xl font-semibold tabular-nums">{money(value, currencyCode)}</strong><small className="col-span-2 text-xs text-slate-500">{orders} บิล</small>
    </button>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button className={`rounded-full border px-3 py-1.5 text-xs ${active ? "border-emerald-900 bg-emerald-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`} type="button" onClick={onClick} aria-pressed={active}>{label}</button>;
}

function calculateMetrics(orders: PaidOrder[], menus: MenuItem[], tables: Table[], zones: Zone[]) {
  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  const weekStart = startOfDay(addDays(now, -6)).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let todayRevenue = 0;
  let todayOrders = 0;
  let weekRevenue = 0;
  let weekOrders = 0;
  let monthRevenue = 0;
  let monthOrders = 0;
  const byMenu = new Map<string, { qty: number; revenue: number }>();
  const byZone = new Map<string, { revenue: number; orders: number; tables: Set<string> }>();
  const daily = new Map<string, number>();
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

  for (const order of orders) {
    const time = new Date(order.created_at).getTime();
    const total = Number(order.total);
    const table = tableById.get(order.table_id);
    const zoneId = table?.zone_id ?? "unknown";
    const zone = byZone.get(zoneId) ?? { revenue: 0, orders: 0, tables: new Set<string>() };
    zone.revenue += total;
    zone.orders += 1;
    zone.tables.add(order.table_id);
    byZone.set(zoneId, zone);

    if (time >= todayStart) { todayRevenue += total; todayOrders += 1; }
    if (time >= weekStart) { weekRevenue += total; weekOrders += 1; }
    if (time >= monthStart) { monthRevenue += total; monthOrders += 1; }

    const key = dateInput(new Date(order.created_at));
    daily.set(key, (daily.get(key) ?? 0) + total);
    for (const item of order.items ?? []) {
      const menu = menuById.get(item.menu_id);
      if (!menu) continue;
      const summary = byMenu.get(item.menu_id) ?? { qty: 0, revenue: 0 };
      summary.qty += Number(item.qty);
      summary.revenue += Number(item.qty) * Number(menu.price);
      byMenu.set(item.menu_id, summary);
    }
  }

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startOfDay(now), index - 6);
    const isoDate = dateInput(date);
    return { date, isoDate, label: new Intl.DateTimeFormat("th-TH", { month: "short", day: "numeric" }).format(date), revenue: daily.get(isoDate) ?? 0, isToday: index === 6 };
  });
  const maxRevenue = Math.max(1, ...last7Days.map((day) => day.revenue));
  const topMenus = [...byMenu.entries()].map(([id, data]) => ({ id, name: menuName(menuById.get(id)), ...data }))
    .sort((a, b) => b.qty - a.qty).slice(0, 10);
  const maxMenuQty = Math.max(1, ...topMenus.map((item) => item.qty));
  const zoneSales = [...byZone.entries()].map(([id, data]) => ({
    id,
    name: zoneById.get(id)?.name ?? "ไม่ระบุโซน",
    revenue: data.revenue,
    orders: data.orders,
    tables: data.tables.size,
  })).sort((a, b) => b.revenue - a.revenue);
  const maxZoneRevenue = Math.max(1, ...zoneSales.map((item) => item.revenue));

  return {
    todayRevenue, todayOrders, weekRevenue, weekOrders, monthRevenue, monthOrders,
    last7Days: last7Days.map((day) => ({ ...day, height: day.revenue ? Math.max(4, day.revenue / maxRevenue * 100) : 0 })),
    topMenus: topMenus.map((item) => ({ ...item, share: item.qty / maxMenuQty * 100 })),
    zoneSales: zoneSales.map((item) => ({ ...item, share: item.revenue / maxZoneRevenue * 100 })),
  };
}

function createDetail(orders: PaidOrder[], menus: MenuItem[], categories: Category[], range: DetailRange, categoryId: string | null) {
  const start = rangeStart(range).getTime();
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const filtered = orders.filter((order) => new Date(order.created_at).getTime() >= start).map((order) => {
    const lines = (order.items ?? []).flatMap((item) => {
      const menu = menuById.get(item.menu_id);
      if (!menu || (categoryId && menu.category_id !== categoryId)) return [];
      return [{ menuId: menu.id, name: menuName(menu), qty: Number(item.qty), note: item.note, total: Number(menu.price) * Number(item.qty), categoryId: menu.category_id }];
    });
    return {
      order,
      items: lines,
      total: categoryId ? lines.reduce((sum, item) => sum + item.total, 0) : Number(order.total),
    };
  }).filter((item) => item.items.length > 0);

  const presentCategoryIds = new Set(orders.filter((order) => new Date(order.created_at).getTime() >= start)
    .flatMap((order) => order.items.map((item) => menuById.get(item.menu_id)?.category_id).filter((id): id is string => Boolean(id))));

  return {
    orders: filtered,
    itemCount: filtered.reduce((sum, order) => sum + order.items.reduce((n, item) => n + item.qty, 0), 0),
    revenue: filtered.reduce((sum, order) => sum + order.total, 0),
    categories: categories.filter((category) => presentCategoryIds.has(category.id)).map((category) => ({ id: category.id, name: categoryName(category) })),
  };
}

function rangeStart(range: DetailRange) {
  const now = new Date();
  if (range === "today") return startOfDay(now);
  if (range === "week") return startOfDay(addDays(now, -6));
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toggleRange(range: DetailRange, setRange: Dispatch<SetStateAction<DetailRange | null>>, setCategory: (category: string | null) => void) {
  setRange((current) => current === range ? null : range);
  setCategory(null);
}

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function dateInput(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function menuName(menu?: MenuItem) { return menu?.name ?? "ไม่ระบุเมนู"; }
function categoryName(category: Category) { return category.name; }
function rangeLabel(range: DetailRange) { return range === "today" ? "วันนี้" : range === "week" ? "7 วันล่าสุด" : "เดือนนี้"; }
function money(value: number, currencyCode: "LAK" | "THB" | "USD") { return new Intl.NumberFormat("th-TH", { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(value); }
function compactMoney(value: number) { return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
