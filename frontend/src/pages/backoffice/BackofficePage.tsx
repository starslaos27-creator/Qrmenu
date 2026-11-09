import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import { useDashboardHomeData } from "../dashboard/useDashboardHomeData";

interface FinanceSummary { sales: string; income: string; expense: string; cost: string; net: string; incompleteCostOrders: number }
interface FinanceDay { date: string; income: string; expense: string; cost: string }
interface FinanceRange { summary: FinanceSummary; daily: FinanceDay[] }

const modules = [
  ["สั่งอาหารให้ลูกค้า", "เลือกโต๊ะและส่งรายการเข้าครัว", "/dashboard/order-menu", "🛒"],
  ["โต๊ะและ QR", "จัดการโซน โต๊ะ และ QR Code", "/dashboard/tables", "▦"],
  ["ครัว", "ติดตามออเดอร์และการเตรียมอาหาร", "/dashboard/kitchen", "♨"],
  ["บิล", "รับชำระและดูรายการค้าง", "/dashboard/bills", "▤"],
  ["เมนูอาหาร", "แก้ไขรายการและราคาอาหาร", "/dashboard/menu", "🍽️"],
  ["คลังสินค้า", "วัตถุดิบและสูตรตัดสต็อก", "/dashboard/inventory", "▣"],
  ["การเงิน", "รายรับ รายจ่าย และต้นทุน", "/dashboard/finance", "฿"],
  ["พนักงานและตั้งค่า", "ทีมงาน สิทธิ์ และข้อมูลร้าน", "/dashboard/settings", "⚙"],
  ["ประวัติการใช้งาน", "ตรวจสอบกิจกรรมย้อนหลัง", "/dashboard/audit", "◷"],
] as const;

export default function BackofficePage({ onLogin }: { onLogin: () => void }) {
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [currencyCode, setCurrencyCode] = useState<"LAK" | "THB" | "USD">("LAK");
  const [role, setRole] = useState("");
  const [period, setPeriod] = useState<"today" | "month">("today");
  const [finance, setFinance] = useState<FinanceRange | null>(null);
  const [financeError, setFinanceError] = useState(false);
  const [retry, setRetry] = useState(0);
  const home = useDashboardHomeData(restaurantId || undefined, role);

  useEffect(() => {
    let cancelled = false;
    loadRestaurantSession().then((session) => {
      if (cancelled) return;
      if (!session.membership) return;
      setRestaurantId(session.membership.restaurant_id);
      setRestaurantName(session.membership.restaurant_name);
      setCurrencyCode(session.membership.currency_code ?? "LAK");
      setRole(session.membership.role);
    }).catch((cause: unknown) => { if (!cancelled && cause instanceof ApiError && cause.status === 401) onLogin(); });
    return () => { cancelled = true; };
  }, [onLogin]);

  useEffect(() => {
    if (!restaurantId || role !== "owner") return;
    let cancelled = false;
    const end = localDate();
    const start = period === "month" ? `${end.slice(0, 7)}-01` : end;
    async function load() {
      try {
        const result = await apiRequest<FinanceRange>(`/api/restaurants/${restaurantId}/finance?from=${start}&to=${end}`);
        if (!cancelled) { setFinance(result); setFinanceError(false); }
      } catch { if (!cancelled) setFinanceError(true); }
    }
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [restaurantId, role, period, retry]);

  const daily = useMemo(() => finance?.daily ?? [], [finance]);
  const maxAmount = Math.max(1, ...daily.flatMap((day) => [Number(day.income), Number(day.expense) + Number(day.cost)]));

  if (role && role !== "owner") return <main className="mx-auto max-w-3xl p-6"><section className="rounded-xl border border-slate-200 bg-white p-6"><h1 className="text-xl font-bold">สำหรับเจ้าของร้าน</h1><p className="mt-2 text-slate-600">บัญชีนี้ไม่มีสิทธิ์เข้าถึงภาพรวมการจัดการร้าน</p><a href="/dashboard" className="mt-4 inline-block text-emerald-800 underline">กลับหน้าภาพรวม</a></section></main>;

  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="rounded-2xl bg-gradient-to-br from-emerald-950 to-teal-800 p-6 text-white sm:p-8"><p className="text-sm font-semibold text-emerald-200">{restaurantName || "ShopQR"}</p><h1 className="mt-2 text-3xl font-bold">ยินดีต้อนรับ</h1><p className="mt-2 max-w-2xl text-sm text-emerald-100">จัดการร้านได้ง่ายขึ้น ครบทุกฟังก์ชันในที่เดียว</p></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      ["ยอดขาย", finance?.summary.sales, "ยอดจากบิลที่ชำระแล้ว"], ["รายรับทั้งหมด", finance?.summary.income, "ยอดขายและรายรับอื่น"], ["ค่าใช้จ่าย", finance?.summary.expense, "รายจ่ายดำเนินงาน"], ["ต้นทุนอาหาร", finance?.summary.cost, "ต้นทุน ณ วันที่ชำระ"], ["กำไรสุทธิ", finance?.summary.net, "รายรับหักค่าใช้จ่ายและต้นทุน"],
    ].map(([label, value, description]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value == null ? "—" : money(value, currencyCode)}</p><p className="mt-1 text-xs text-slate-500">{description}</p></article>)}</section>
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">ภาพรวมการเงิน</h2><p className="text-sm text-slate-500">{period === "today" ? "วันนี้ · ตามเวลาร้าน" : "เดือนนี้ · ตั้งแต่วันที่ 1 ถึงวันนี้"}</p></div><div className="flex rounded-lg bg-slate-100 p-1"><button onClick={() => setPeriod("today")} className={period === "today" ? activePeriod : periodButton}>วันนี้</button><button onClick={() => setPeriod("month")} className={period === "month" ? activePeriod : periodButton}>เดือนนี้</button></div></div>
      {financeError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">โหลดข้อมูลการเงินไม่สำเร็จ <button onClick={() => setRetry((value) => value + 1)} className="underline">รีเฟรช</button></p>}
      {(finance?.summary.incompleteCostOrders ?? 0) > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">มี {finance?.summary.incompleteCostOrders} ออเดอร์ที่ต้นทุนไม่ครบ กำไรหักเฉพาะต้นทุนที่ทราบ</p>}
      {daily.length ? <div className="space-y-2">{daily.map((day) => <div key={day.date} className="grid grid-cols-[52px_1fr_110px] items-center gap-3 text-xs"><span className="text-slate-500">{day.date.slice(5)}</span><div className="space-y-1"><div className="h-2 rounded bg-slate-100"><div title={`รายรับ ${money(day.income, currencyCode)}`} className="h-2 rounded bg-emerald-600" style={{ width: `${Math.max(Number(day.income) ? 1 : 0, Number(day.income) / maxAmount * 100)}%` }} /></div><div className="h-2 rounded bg-slate-100"><div title={`ค่าใช้จ่ายและต้นทุน ${money(Number(day.expense) + Number(day.cost), currencyCode)}`} className="h-2 rounded bg-amber-500" style={{ width: `${Math.max(Number(day.expense) + Number(day.cost) ? 1 : 0, (Number(day.expense) + Number(day.cost)) / maxAmount * 100)}%` }} /></div></div><span className="text-right font-semibold">{money(day.income, currencyCode)}</span></div>)}</div> : <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">{finance ? "ยังไม่มีรายการในช่วงนี้" : "กำลังโหลดภาพรวมการเงิน…"}</p>}
    </section>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">จัดการร้าน</h2><span className="text-xs text-slate-500">ทุกส่วนใช้ข้อมูลร้านเดียวกัน</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{modules.map(([title, description, href, icon]) => <a key={href} href={href} className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-lg text-emerald-800">{icon}</span><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p><span aria-hidden="true" className="mt-3 inline-block text-emerald-800 group-hover:translate-x-1">เปิด →</span></a>)}</div></section>
    <section className="grid gap-4 xl:grid-cols-2"><Panel title="งานที่ต้องดูแล"><div className="grid grid-cols-2 gap-2">{[[home.data?.summary.pendingCount, "ออเดอร์รอทำ", "/dashboard/kitchen"], [home.data?.summary.readyCount, "พร้อมเสิร์ฟ", "/dashboard/kitchen"], [home.data?.summary.unpaidTableCount, "โต๊ะค้างชำระ", "/dashboard/bills"], [home.data?.summary.callCount, "เรียกพนักงาน", "/dashboard/bills"]].map(([value, label, path]) => <a key={String(label)} href={String(path)} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm hover:bg-emerald-50"><span>{label}</span><b className="text-lg">{value ?? "—"}</b></a>)}</div>{home.error && <p className="mt-3 text-sm text-rose-700">โหลดสถานะงานไม่สำเร็จ</p>}</Panel>
      <Panel title="ออเดอร์ล่าสุดวันนี้">{home.data?.summary.recentOrders.length ? <div className="divide-y divide-slate-100">{home.data.summary.recentOrders.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm"><div><b>โต๊ะ {order.tableNumber ?? "—"}</b><p className="text-xs text-slate-500">{statusLabel(order.status)} · {new Date(order.createdAt).toLocaleTimeString()}</p></div><strong>{money(order.total, currencyCode)}</strong></div>)}</div> : <p className="text-sm text-slate-500">{home.data ? "ยังไม่มีออเดอร์วันนี้" : "กำลังโหลดออเดอร์…"}</p>}</Panel>
      <Panel title="วัตถุดิบใกล้หมด"><a href="/dashboard/inventory?view=low" className="mb-2 block text-xs font-semibold text-emerald-800">จัดการสต็อก →</a>{home.data?.items?.length ? <ul className="divide-y divide-slate-100">{home.data.items.slice(0, 8).map((item) => <li key={item.id} className="flex justify-between py-2 text-sm"><span>{item.name}</span><b>{item.quantity} {item.unit}</b></li>)}</ul> : <p className="text-sm text-slate-500">{home.data?.items ? "ไม่มีวัตถุดิบใกล้หมด" : "ข้อมูลสต็อกยังไม่พร้อม"}</p>}</Panel>
    </section>
  </main>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-bold">{title}</h2>{children}</section>; }
function localDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function money(value: number | string, currencyCode: "LAK" | "THB" | "USD") { return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2 }).format(Number(value)); }
function statusLabel(status: string) { return ({ pending: "รอทำ", cooking: "กำลังทำ", ready: "พร้อมเสิร์ฟ", served: "เสิร์ฟแล้ว", cancelled: "ยกเลิก" } as Record<string, string>)[status] ?? status; }
const periodButton = "rounded-md px-3 py-1.5 text-xs font-semibold text-slate-500";
const activePeriod = "rounded-md bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm";
