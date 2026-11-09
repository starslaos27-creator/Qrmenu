import { useEffect, useMemo, useState } from "react";
import { loadRestaurantSession, type AuthUser, type RestaurantMembership } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import { DashboardSummary, RecentOrder, useDashboardHomeData } from "./useDashboardHomeData";
import ProUpgradeButton from "../upgrade/ProUpgradeButton";

interface DashboardHomePageProps {
  onLogin: () => void;
}

interface ProfileUser extends AuthUser {
  display_name?: string | null;
}

interface SessionPayload {
  user: ProfileUser;
  membership: RestaurantMembership | null;
}

let dashboardCurrency: "LAK" | "THB" | "USD" = "LAK";

export default function DashboardHomePage({ onLogin }: DashboardHomePageProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [presenceAt, setPresenceAt] = useState(() => Date.now());
  const [presenceNow, setPresenceNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    loadRestaurantSession()
      .then((result) => { if (active) setSession(result as SessionPayload); })
      .catch((cause: unknown) => {
        if (!active) return;
        setSessionError(cause instanceof ApiError && cause.status === 401 ? "unauthorized" : "load-error");
      })
      .finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, []);

  const user = session?.user;
  const membership = session?.membership;
  dashboardCurrency = membership?.currency_code ?? "LAK";
  const restaurantId = membership?.restaurant_id;
  const role = membership?.role ?? "staff";
  const { data, error, refresh } = useDashboardHomeData(restaurantId, role);
  const profileKey = user?.id || restaurantId || "session";

  useEffect(() => {
    const key = `shopqr.profile-presence.${profileKey}`;
    const touch = () => {
      const at = Date.now();
      try { localStorage.setItem(key, JSON.stringify({ at })); } catch { /* Storage is optional. */ }
      setPresenceAt(at);
      setPresenceNow(at);
    };
    const read = () => {
      let at = Date.now();
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "null") as { at?: number } | null;
        if (Number(saved?.at) > 0) at = Number(saved?.at);
      } catch { /* Ignore unavailable or invalid local storage. */ }
      setPresenceAt(at);
      setPresenceNow(Date.now());
    };
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 15_000) return;
      last = now;
      touch();
    };
    touch();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll", "click"];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    const timer = window.setInterval(() => { setPresenceNow(Date.now()); read(); }, 15_000);
    const onStorage = (event: StorageEvent) => { if (event.key === key) read(); };
    window.addEventListener("storage", onStorage);
    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, [profileKey]);

  useEffect(() => {
    if (!user?.id) return;
    try { setProfilePhoto(localStorage.getItem(`shopqr.profile-photo.${user.id}`) || ""); }
    catch { setProfilePhoto(""); }
  }, [user?.id]);

  const owner = role === "owner";
  const canStock = ["owner", "cook", "staff"].includes(role);
  const profileName = user?.display_name?.trim() || user?.email || membership?.restaurant_name || "R";
  const profileInitial = Array.from(profileName.trim())[0]?.toUpperCase() || "R";
  const isOnline = presenceNow - presenceAt < 5 * 60_000;
  const lastOnlineLabel = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(new Date(presenceAt));

  function changeProfilePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1024 * 1024) {
      setProfilePhotoError("เลือกรูป PNG, JPG หรือ WebP ขนาดไม่เกิน 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const photo = String(reader.result || "");
        localStorage.setItem(`shopqr.profile-photo.${user?.id || restaurantId}`, photo);
        setProfilePhoto(photo);
        setProfilePhotoError("");
      } catch { setProfilePhotoError("บันทึกรูปไม่สำเร็จ กรุณาเลือกรูปที่มีขนาดเล็กลง"); }
    };
    reader.onerror = () => setProfilePhotoError("อ่านรูปไม่สำเร็จ กรุณาลองอีกครั้ง");
    reader.readAsDataURL(file);
  }

  async function signOut() {
    setProfileOpen(false);
    try { await apiRequest("/api/auth/logout", { method: "POST" }); }
    finally { window.location.assign("/login"); }
  }

  if (sessionLoading) return <LoadingState />;
  if (sessionError === "unauthorized") {
    return <main className="min-h-full p-6"><section className="mx-auto mt-16 max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold">ภาพรวมร้านอาหาร</h1><p className="text-sm text-slate-600">กรุณาเข้าสู่ระบบเพื่อดูข้อมูลร้าน</p><button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-medium text-white" type="button" onClick={onLogin}>ไปหน้าเข้าสู่ระบบ</button></section></main>;
  }
  if (sessionError || !membership) {
    return <main className="min-h-full p-6"><section className="mx-auto mt-16 max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold">ภาพรวมร้านอาหาร</h1><p className="text-sm text-slate-600">{sessionError ? "โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาลองใหม่" : "บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร"}</p><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm" type="button" onClick={() => window.location.reload()}>ลองอีกครั้ง</button></section></main>;
  }
  if (!data) {
    return <main className="grid min-h-full place-items-center p-6"><section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">{error ? "โหลดข้อมูลไม่สำเร็จ" : "กำลังโหลดภาพรวมร้านอาหาร…"}{error && <button className="block rounded-xl bg-emerald-800 px-4 py-2 text-white" type="button" onClick={refresh}>ลองอีกครั้ง</button>}</section></main>;
  }

  const { summary } = data;
  const orders = data.orders || [];
  const tables = data.tables || [];
  const activeTables = new Set(orders.filter((order) => !order.paid && order.status !== "cancelled").map((order) => order.table_id));
  const tableGroups = [
    { label: "มีออเดอร์ค้างชำระ", value: tables.filter((table) => activeTables.has(table.id)).length, color: "#f4b53f" },
    { label: "เปิดรับออเดอร์", value: tables.filter((table) => !activeTables.has(table.id) && table.is_open).length, color: "#159d88" },
    { label: "ปิดรับออเดอร์", value: tables.filter((table) => !activeTables.has(table.id) && !table.is_open).length, color: "#7893ef" },
  ];
  const categories = new Map((data.categories || []).map((category) => [category.id, { name: category.name, total: 0 }]));
  const menus = new Map((data.menus || []).map((menu) => [menu.id, menu]));
  for (const order of orders.filter((item) => item.paid && sameDay(item.created_at, new Date()))) {
    for (const item of (order as typeof order & { items?: Array<{ menu_id: string; qty: number }> }).items || []) {
      const menu = menus.get(item.menu_id);
      const category = menu?.category_id ? categories.get(menu.category_id) : undefined;
      if (menu && category) category.total += Number(menu.price) * item.qty;
    }
  }
  const sales = [...categories.values()].filter((category) => category.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);

  return (
    <main className="min-h-full space-y-4 bg-slate-50 p-4 text-slate-800 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><div className="text-[11px] font-bold uppercase tracking-[.18em] text-slate-500">RESTAURANT OVERVIEW</div><h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">ภาพรวมร้านอาหาร <span aria-hidden="true">👋</span></h1><p className="mt-1 text-sm text-slate-600">ยินดีต้อนรับกลับมา! มาดูความเคลื่อนไหวของ{membership.restaurant_name || "ร้าน"}วันนี้กัน</p></div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <ProUpgradeButton restaurantId={restaurantId} />
          <time>{new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })}</time>
          {owner && <button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100" type="button" onClick={() => exportSummary(summary)}>↥ ส่งออกรายงาน</button>}
          <div className="relative">
            <button type="button" className={`grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 border-white bg-emerald-800 text-lg font-semibold text-white shadow ${isOnline ? "ring-2 ring-emerald-500" : "ring-2 ring-slate-300"}`} title={isOnline ? "Online" : `Offline · Last seen ${lastOnlineLabel}`} aria-label={`${profileName} · ${isOnline ? "Online" : `Offline, last seen ${lastOnlineLabel}`} · เปิดเมนูโปรไฟล์`} aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
              {profilePhoto ? <img className="h-full w-full object-cover" src={profilePhoto} alt="" /> : <span aria-hidden="true">{profileInitial}</span>}
            </button>
            {profileOpen && <div className="absolute right-0 z-20 mt-2 w-64 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl" role="menu">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <label className="relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-emerald-800 text-white">{profilePhoto ? <img className="h-full w-full object-cover" src={profilePhoto} alt="" /> : <span>{profileInitial}</span>}<input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="image/png,image/jpeg,image/webp" aria-label="เลือกภาพโปรไฟล์" onChange={changeProfilePhoto} /></label>
                <div className="grid min-w-0 gap-1"><strong className="truncate text-sm">{profileName}</strong>{user?.email && user.display_name && <small className="truncate text-xs text-slate-500">{user.email}</small>}<small className="text-xs text-slate-500">{isOnline ? "Online" : `Offline · Last seen ${lastOnlineLabel}`}</small></div>
              </div>
              {profilePhotoError && <p className="text-xs text-red-700" role="alert">{profilePhotoError}</p>}
              <a className="block rounded-lg px-2 py-2 text-sm hover:bg-slate-100" href="/dashboard/settings" role="menuitem">⚙ ตั้งค่าระบบ</a><a className="block rounded-lg px-2 py-2 text-sm hover:bg-slate-100" href="/dashboard/upgrade" role="menuitem">⭐ อัปเกรดโปร</a><button className="block w-full rounded-lg px-2 py-2 text-left text-sm text-red-700 hover:bg-red-50" type="button" role="menuitem" onClick={() => void signOut()}>↪ ออกจากระบบ</button>
            </div>}
          </div>
        </div>
      </header>
      {error && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">อัปเดตข้อมูลไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่โหลดได้</div>}
      <KpiCards summary={summary} />
      <div className="grid gap-4 xl:grid-cols-3">
        {owner && <Panel title="ยอดขายรายวัน" action={<span className="text-xs text-slate-500">7 วัน</span>}>{data.orders ? <RevenueChart orders={orders} /> : <Empty>โหลดข้อมูลยอดขายไม่สำเร็จ</Empty>}</Panel>}
        {owner && <Panel title="ยอดขายตามหมวดหมู่" action={<span className="text-xs text-slate-500">วันนี้</span>}>{!data.orders || !data.menus || !data.categories ? <Empty>โหลดข้อมูลหมวดหมู่ไม่สำเร็จ</Empty> : sales.length ? <div className="grid h-48 grid-cols-3 items-end gap-3">{sales.map((category, index) => <div className="flex h-full flex-col items-center justify-end gap-2 text-center text-xs" key={category.name}><span className="text-slate-600">{number(category.total)}</span><div className="flex h-32 w-full items-end overflow-hidden rounded-t-lg bg-slate-100"><div className="w-full rounded-t-lg" style={{ height: `${category.total / sales[0].total * 100}%`, background: ["#2b64dc", "#278ca1", "#8250cc"][index] }} /></div><span className="line-clamp-2 text-slate-600">{category.name}</span></div>)}</div> : <Empty>ยังไม่มียอดขายในวันนี้</Empty>}<p className="mt-2 text-[11px] text-slate-500">มูลค่าเมนูตามราคาปัจจุบัน ก่อนส่วนลดและภาษี</p></Panel>}
        <Panel title="สถานะโต๊ะ">{!data.tables || !data.orders ? <Empty>โหลดสถานะโต๊ะไม่สำเร็จ</Empty> : <TableDonut groups={tableGroups} total={tables.length} />}</Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="ภาพรวมโต๊ะ" action={<a href="/dashboard/tables">จัดการ ↗</a>}><p className="mb-3 text-xs text-slate-500">สถานะการเปิดรับออเดอร์และยอดค้างชำระ</p>{!data.tables || !data.orders ? <Empty>โหลดข้อมูลโต๊ะไม่สำเร็จ</Empty> : tables.length ? <div className="grid grid-cols-2 gap-2">{tables.slice(0, 8).map((table) => <a href="/dashboard/tables?view=status" key={table.id} className={`grid rounded-xl border p-3 text-sm ${activeTables.has(table.id) ? "border-amber-200 bg-amber-50 text-amber-900" : table.is_open ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-600"}`}><strong>โต๊ะ {table.table_number}</strong><small className="mt-1 text-xs">{activeTables.has(table.id) ? "ค้างชำระ" : table.is_open ? "เปิดรับ" : "ปิดรับ"}</small></a>)}</div> : <Empty>ยังไม่มีโต๊ะ</Empty>}{tables.length > 8 && <a className="mt-3 block text-sm font-medium text-emerald-800" href="/dashboard/tables">ดูทั้งหมด {tables.length} โต๊ะ →</a>}</Panel>
        <Panel title="ออเดอร์ล่าสุด" action={<a href="/dashboard/bills">ดูทั้งหมด</a>}><RecentOrders orders={summary.recentOrders || []} /></Panel>
        {canStock ? <Panel title="สินค้าคงเหลือใกล้หมด" action={<a href="/dashboard/inventory?view=low">ดูทั้งหมด</a>}>{data.items ? <DataTable headers={["วัตถุดิบ", "คงเหลือ", "ขั้นต่ำ", "สถานะ"]} rows={data.items.filter((item) => item.active && item.track_stock).slice(0, 5).map((item) => [item.name, `${number(item.quantity)} ${item.unit}`, number(item.minimum_stock), <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800" key={item.id}>● ใกล้หมด</span>])} /> : <Empty>โหลดข้อมูลสต็อกไม่สำเร็จ</Empty>}</Panel> : <Panel title="สถานะออเดอร์วันนี้"><DataTable headers={["สถานะ", "จำนวน"]} rows={[["รอทำ", summary.pendingCount], ["พร้อมเสิร์ฟ", summary.readyCount], ["เสิร์ฟแล้ว", summary.servedCount], ["ยกเลิก", summary.cancelledCount]]} /></Panel>}
      </div>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500"><span>© {new Date().getFullYear()} ShopQR</span><span>ระบบจัดการร้านอาหาร</span></footer>
    </main>
  );
}

function KpiCards({ summary }: { summary: DashboardSummary }) {
  const cards = [
    ["ยอดขายวันนี้", money(summary.todayRevenue), `${number(summary.todayPaidCount)} ออเดอร์ชำระแล้ว`, "green", "↙", "/dashboard/stats?view=today"],
    ["ออเดอร์รอทำ", number(summary.pendingCount), "ออเดอร์วันนี้ที่ครัวต้องทำ", "red", "↗", "/dashboard/kitchen?view=new"],
    ["ยอดค้างชำระ", money(summary.unpaidTotal), `${number(summary.unpaidTableCount)} โต๊ะค้างชำระวันนี้`, "blue", "▣", "/dashboard/bills"],
    ["เรียกพนักงาน", number(summary.callCount), "คำขอที่รอการตอบรับ", "purple", "♧", "/dashboard/bills"],
  ];
  const colors: Record<string, string> = { green: "border-emerald-200", red: "border-rose-200", blue: "border-sky-200", purple: "border-violet-200" };
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([title, value, caption, color, icon, to]) => <a key={title} href={to} className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${colors[color]}`}><div className="flex items-center justify-between gap-2 text-sm font-medium text-slate-600"><span className="text-lg">{icon}</span>{title}<span className="text-xs text-slate-400" aria-hidden="true">ⓘ</span></div><strong className="mt-2 block text-2xl font-semibold tabular-nums text-slate-900">{value}</strong><div className="mt-2 text-xs text-slate-600"><span className="mr-1 rounded-full bg-slate-100 px-2 py-1">สรุป</span>{caption}</div><small className="mt-3 block text-[11px] text-slate-400">อัปเดตอัตโนมัติทุก 30 วินาที</small></a>)}</div>;
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-800">{title}</h2><div className="text-sm text-emerald-800">{action}</div></div>{children}</section>;
}

function Empty({ children = "ยังไม่มีข้อมูล" }: { children?: React.ReactNode }) { return <div className="py-8 text-center text-sm text-slate-500">{children}</div>; }

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <Empty />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[34rem] border-collapse text-left text-sm"><thead><tr>{headers.map((label) => <th className="border-b border-slate-200 px-2 py-2 text-xs font-medium text-slate-500" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((cells, index) => <tr className="border-b border-slate-100 last:border-0" key={index}>{cells.map((cell, cellIndex) => <td className="px-2 py-2.5 text-slate-700" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  const rows = orders.map((order) => [<span title={order.id} key="id">#{order.id.slice(0, 6)}</span>, order.tableNumber ?? "—", <span className={`rounded-full px-2 py-1 text-xs ${order.paid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`} key="status">{orderStatus(order)}</span>, money(order.total), new Date(order.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })]);
  return <DataTable headers={["ออเดอร์", "โต๊ะ", "สถานะ", "ยอดรวม", "เวลา"]} rows={rows} />;
}

function TableDonut({ groups, total }: { groups: Array<{ label: string; value: number; color: string }>; total: number }) {
  let angle = 0;
  const stops = groups.map((group) => { const start = angle; angle += total ? group.value / total * 360 : 0; return `${group.color} ${start}deg ${angle}deg`; });
  return <div className="flex flex-col items-center gap-4 sm:flex-row"><div className="grid h-40 w-40 shrink-0 place-items-center rounded-full" style={{ background: total ? `conic-gradient(${stops.join(",")})` : "#e8eef2" }}><div className="grid h-24 w-24 place-content-center rounded-full bg-white text-center"><small className="text-xs text-slate-500">ทั้งหมด</small><strong className="text-lg">{total} โต๊ะ</strong></div></div><div className="w-full space-y-2">{groups.map((group) => <div className="flex justify-between gap-3 text-sm text-slate-600" key={group.label}><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />{group.label}</span><span className="font-semibold tabular-nums text-slate-800">{group.value}</span></div>)}</div></div>;
}

function RevenueChart({ orders }: { orders: NonNullable<ReturnType<typeof useDashboardHomeData>["data"]>["orders"] }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - 6 + index); return { date, total: 0 }; }), []);
  for (const order of orders || []) {
    if (!order.paid) continue;
    const day = days.find((item) => sameDay(item.date, new Date(order.created_at)));
    if (day) day.total += Number(order.total);
  }
  const max = Math.max(1, ...days.map((item) => item.total)) * 1.15;
  const points = days.map((item, index) => `${58 + index * 88},${210 - item.total / max * 165}`).join(" ");
  return <div><p className="mb-2 text-xs text-slate-600"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />รายรับจากออเดอร์ที่ชำระแล้ว</p><div className="overflow-x-auto"><svg className="h-auto min-w-[32rem] w-full" viewBox="0 0 620 250" role="img" aria-label="ยอดขายจากออเดอร์ใน 7 วันล่าสุด แยกตามวันที่สั่ง"><defs><linearGradient id="ro-revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".16" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>{[0, 1, 2, 3, 4].map((index) => <g key={index}><line x1="58" x2="590" y1={210 - index * 42} y2={210 - index * 42} stroke="#e5edf3" strokeDasharray="4 4" /><text className="fill-slate-500 text-[10px]" x="48" y={214 - index * 42} textAnchor="end">{number(Math.round(max * index / 4))}</text></g>)}<polygon points={`58,210 ${points} 586,210`} fill="url(#ro-revenue-fill)" /><polyline points={points} fill="none" stroke="#10b981" strokeWidth="2.5" />{days.map((item, index) => <g key={item.date.toISOString()}><circle cx={58 + index * 88} cy={210 - item.total / max * 165} r="3" fill="white" stroke="#10b981" strokeWidth="2"><title>{`${shortDate(item.date)}: ${money(item.total)}`}</title></circle><text className="fill-slate-500 text-[10px]" x={58 + index * 88} y="238" textAnchor="middle">{shortDate(item.date)}</text></g>)}</svg></div><p className="mt-2 text-[11px] text-slate-500">ตามวันที่สั่ง · สูงสุด 500 ออเดอร์ล่าสุด · สกุลเงินกีบ</p></div>;
}

function LoadingState() { return <main className="grid min-h-full place-items-center p-6"><section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600" role="status" aria-busy="true">กำลังโหลดภาพรวมร้านอาหาร…</section></main>; }
function sameDay(first: Date | string, second: Date) { return new Date(first).toLocaleDateString("en-CA") === second.toLocaleDateString("en-CA"); }
function shortDate(value: Date) { return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(value); }
function number(value: number) { return Number(value || 0).toLocaleString("th-TH"); }
function money(value: number) { return new Intl.NumberFormat("th-TH", { style: "currency", currency: dashboardCurrency, maximumFractionDigits: dashboardCurrency === "LAK" ? 0 : 2 }).format(value); }
function orderStatus(order: RecentOrder) { return order.paid ? "ชำระเงินแล้ว" : ({ pending: "รอทำ", ready: "พร้อมเสิร์ฟ", served: "เสิร์ฟแล้ว", cancelled: "ยกเลิก" }[order.status] || order.status); }

function exportSummary(summary: DashboardSummary) {
  const rows = [["รายการ", "จำนวน"], ["ยอดขายวันนี้", summary.todayRevenue], ["ออเดอร์ชำระแล้ว", summary.todayPaidCount], ["ออเดอร์รอทำ", summary.pendingCount], ["โต๊ะค้างชำระ", summary.unpaidTableCount], ["ยอดค้างชำระ", summary.unpaidTotal], ["เรียกพนักงาน", summary.callCount]];
  const blob = new Blob(["\ufeff" + rows.map((row) => row.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `shopqr-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
