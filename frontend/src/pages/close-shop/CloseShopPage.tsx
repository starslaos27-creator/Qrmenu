import { useEffect, useMemo, useState } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";

interface MenuItem {
  id: string;
  name: string;
  name_lo?: string | null;
  name_en?: string | null;
  price: number;
  available: boolean;
}

interface OrderItem {
  menu_id: string;
  qty: number;
}

interface PaidOrder {
  id: string;
  table_id: string;
  created_at: string;
  paid_at?: string | null;
  payment_method?: string | null;
  total: number;
  items: OrderItem[];
}

type DatePreset = "today" | "yesterday" | "7d" | "30d" | "custom";

interface CloseShopPageProps {
  onLogin: () => void;
}

const presets: { value: DatePreset; label: string }[] = [
  { value: "today", label: "วันนี้" },
  { value: "yesterday", label: "เมื่อวาน" },
  { value: "7d", label: "7 วัน" },
  { value: "30d", label: "30 วัน" },
  { value: "custom", label: "กำหนดเอง" },
];

export default function CloseShopPage({ onLogin }: CloseShopPageProps) {
  const [currencyCode, setCurrencyCode] = useState<"LAK" | "THB" | "USD">("LAK");
  const [orders, setOrders] = useState<PaidOrder[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [fromDate, setFromDate] = useState(() => dateInput(new Date()));
  const [toDate, setToDate] = useState(() => dateInput(new Date()));
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
        since.setDate(since.getDate() - 90);
        const [orderResult, menuResult] = await Promise.all([
          apiRequest<{ orders: PaidOrder[] }>(
            `/api/restaurants/${restaurantId}/orders?paid=true&since=${encodeURIComponent(since.toISOString())}&limit=500`,
          ),
          apiRequest<{ menus: MenuItem[] }>(`/api/restaurants/${restaurantId}/menus`),
        ]);
        if (cancelled) return;
        setOrders(orderResult.orders);
        setMenus(menuResult.menus);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError && cause.status === 401
            ? "กรุณาเข้าสู่ระบบเพื่อดูรายงานปิดร้าน"
            : "โหลดรายงานไม่สำเร็จ กรุณาลองใหม่");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const range = useMemo(() => getRange(preset, fromDate, toDate), [preset, fromDate, toDate]);
  const menuById = useMemo(() => new Map(menus.map((menu) => [menu.id, menu])), [menus]);
  const report = useMemo(() => buildReport(orders, menus, menuById, range), [orders, menus, menuById, range]);

  if (loading) return <main className="grid min-h-full place-items-center p-6 text-sm text-slate-500">กำลังโหลดรายงาน…</main>;

  if (error && orders.length === 0) {
    return (
      <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
        <section className="mx-auto mt-16 grid max-w-lg justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">สรุปยอดปิดร้าน</h1>
          <p className="text-sm text-slate-600">{error}</p>
          {error.includes("เข้าสู่ระบบ") && <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white" type="button" onClick={onLogin}>ไปหน้าเข้าสู่ระบบ</button>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full space-y-4 bg-slate-50 p-4 text-slate-800 sm:p-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">สรุปยอดปิดร้าน</h1>
          <p className="mt-1 text-sm text-slate-500">สรุปยอดจากรายการที่ชำระเงินแล้ว</p>
        </div>
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100" type="button" onClick={() => window.history.back()}>กลับ</button>
      </header>

      <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-3" aria-label="ช่วงวันที่รายงาน">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-200 p-1">
          {presets.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`rounded-lg px-3 py-2 text-xs font-medium transition ${preset === item.value ? "bg-emerald-900 text-white" : "text-slate-600 hover:bg-white"}`}
              aria-pressed={preset === item.value}
              onClick={() => setPreset(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <label className="flex items-center gap-2">ตั้งแต่<input className="rounded-lg border border-slate-300 bg-white p-2" type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label className="flex items-center gap-2">ถึง<input className="rounded-lg border border-slate-300 bg-white p-2" type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label>
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs disabled:opacity-50" type="button" disabled={report.orders.length === 0} onClick={() => exportOrders(report.orders)}>ส่งออกบิล CSV</button>
          <button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs disabled:opacity-50" type="button" disabled={report.items.length === 0} onClick={() => exportItems(report.items)}>ส่งออกเมนู CSV</button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 xl:grid-cols-4" aria-label="ยอดรวม">
        <Kpi label="ยอดขาย" value={money(report.revenue, currencyCode)} />
        <Kpi label="จำนวนบิล" value={String(report.orders.length)} />
        <Kpi label="จำนวนโต๊ะ" value={String(report.tableCount)} />
        <Kpi label="ยอดเฉลี่ยต่อบิล" value={money(report.average, currencyCode)} />
      </section>

      <section className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">ช่องทางชำระเงิน</h2>
        {report.payments.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">ไม่มีรายการในช่วงวันที่นี้</p> : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {report.payments.map((payment) => {
              const share = report.revenue > 0 ? payment.total / report.revenue * 100 : 0;
              return (
                <li key={payment.method}>
                  <div className="flex flex-wrap items-baseline gap-2 text-sm"><strong>{paymentLabel(payment.method)}</strong><span className="text-slate-500">{payment.count} บิล</span><b className="ml-auto tabular-nums font-medium">{money(payment.total, currencyCode)} ({share.toFixed(1)}%)</b></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-800" style={{ width: `${share}%` }} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
        <MenuRanking title="ขายดี" items={report.bestItems} menus={menuById} currencyCode={currencyCode} />
        <MenuRanking title="ขายน้อย" items={report.lowItems} menus={menuById} currencyCode={currencyCode} muted />
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block text-xl font-semibold tabular-nums">{value}</strong></article>;
}

function MenuRanking({
  title,
  items,
  menus,
  currencyCode,
  muted = false,
}: {
  title: string;
  items: MenuSummary[];
  menus: Map<string, MenuItem>;
  currencyCode: "LAK" | "THB" | "USD";
  muted?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${muted ? "opacity-90" : ""}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {items.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">ไม่มีรายการในช่วงวันที่นี้</p> : (
        <ol className="m-0 grid list-none gap-2 p-0">
          {items.map((item, index) => (
            <li key={item.menuId}>
              <span className="w-6 text-right text-xs text-slate-500">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-sm">{menuName(menus.get(item.menuId))}</span>
              <span className="shrink-0 text-sm tabular-nums">×{item.qty}{item.revenue > 0 && <small className="ml-2 text-xs text-slate-500">{money(item.revenue, currencyCode)}</small>}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface MenuSummary {
  menuId: string;
  name: string;
  qty: number;
  revenue: number;
  orderCount: number;
}

function buildReport(
  orders: PaidOrder[],
  menus: MenuItem[],
  menuById: Map<string, MenuItem>,
  range: { from: Date; to: Date },
) {
  const matchingOrders = orders.filter((order) => {
    const paidAt = new Date(order.paid_at ?? order.created_at);
    return paidAt >= range.from && paidAt <= range.to;
  });
  const revenue = matchingOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const tableCount = new Set(matchingOrders.map((order) => order.table_id)).size;
  const payments = new Map<string, { count: number; total: number }>();
  const itemMap = new Map<string, MenuSummary>();

  for (const order of matchingOrders) {
    const method = order.payment_method ?? "other";
    const payment = payments.get(method) ?? { count: 0, total: 0 };
    payment.count += 1;
    payment.total += Number(order.total);
    payments.set(method, payment);

    for (const item of order.items ?? []) {
      const menu = menuById.get(item.menu_id);
      if (!menu) continue;
      const summary = itemMap.get(item.menu_id) ?? {
        menuId: item.menu_id,
        name: menuName(menu),
        qty: 0,
        revenue: 0,
        orderCount: 0,
      };
      summary.qty += Number(item.qty);
      summary.revenue += Number(menu.price) * Number(item.qty);
      summary.orderCount += 1;
      itemMap.set(item.menu_id, summary);
    }
  }

  const items = [...itemMap.values()].sort((left, right) => right.qty - left.qty);
  const bestItems = items.slice(0, 10);
  const soldIds = new Set(items.map((item) => item.menuId));
  const unsoldItems = menus.filter((menu) => menu.available && !soldIds.has(menu.id)).map((menu) => ({
    menuId: menu.id,
    name: menuName(menu),
    qty: 0,
    revenue: 0,
    orderCount: 0,
  }));
  const lowItems = [...items].reverse().concat(unsoldItems).slice(0, 10);

  return {
    orders: matchingOrders,
    items,
    revenue,
    tableCount,
    average: matchingOrders.length ? revenue / matchingOrders.length : 0,
    payments: [...payments.entries()].map(([method, values]) => ({ method, ...values })).sort((a, b) => b.total - a.total),
    bestItems,
    lowItems,
  };
}

function getRange(preset: DatePreset, fromDate: string, toDate: string) {
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "custom":
      return { from: startOfDay(new Date(`${fromDate}T00:00:00`)), to: endOfDay(new Date(`${toDate}T00:00:00`)) };
  }
}

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function menuName(menu?: MenuItem) {
  return menu?.name ?? "ไม่ระบุเมนู";
}

function money(value: number, currencyCode: "LAK" | "THB" | "USD") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(value);
}

function paymentLabel(method: string) {
  const labels: Record<string, string> = { cash: "เงินสด", transfer: "โอนเงิน", qr: "QR", promptpay: "QR", card: "บัตร", other: "อื่น ๆ" };
  return labels[method] ?? method;
}

function exportOrders(orders: PaidOrder[]) {
  downloadCsv(`orders_${dateInput(new Date())}.csv`, ["order_id", "table_id", "paid_at", "payment_method", "total", "item_count"], orders.map((order) => [
    order.id,
    order.table_id,
    order.paid_at ?? order.created_at,
    order.payment_method ?? "",
    order.total,
    order.items?.length ?? 0,
  ]));
}

function exportItems(items: MenuSummary[]) {
  downloadCsv(`items_${dateInput(new Date())}.csv`, ["menu_id", "name", "qty_sold", "revenue", "appeared_in_orders"], items.map((item) => [
    item.menuId,
    item.name,
    item.qty,
    item.revenue,
    item.orderCount,
  ]));
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
