import { useCallback, useEffect, useState } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";
import { PageState } from "../dashboard/PlatformOverviewPage";

interface Restaurant {
  id: string;
  name: string;
  owner_email: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  currency_code: "LAK" | "THB" | "USD";
  today_revenue: number | string;
  member_count: number;
  migrated_member_count: number;
  menu_count: number;
  table_count: number;
  order_count: number;
  last_order_at: string | null;
  pro_expires_at?: string | null;
  server_now?: string;
  trial_active?: boolean;
  pro_request_pending?: boolean;
  clockOffsetMs?: number;
}

interface ProPricing { monthly_usd: string | null; version: number }
const proPackages = [
  { paid: 1, free: 0 },
  { paid: 3, free: 0 },
  { paid: 6, free: 1 },
  { paid: 9, free: 1 },
  { paid: 12, free: 2 },
];

interface RestaurantDetail {
  restaurant: Restaurant & { owner_phone?: string | null; accepting_orders?: boolean };
  metrics: Record<string, number>;
  recentOrders: Array<{ id: string; table_number: string | number; status: string; total: number; paid: boolean; created_at: string }>;
  members: Array<{ id: string; email: string; role: string; disabled_at: string | null }>;
  recentAudit: Array<{ id: string; action: string; actor_email: string | null; created_at: string }>;
}

export default function ShopManagementPage({ canManage }: { canManage: boolean }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RestaurantDetail | null>(null);
  const [notice, setNotice] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [purchaseTarget, setPurchaseTarget] = useState<Restaurant | null>(null);
  const [purchasePricing, setPurchasePricing] = useState<ProPricing | null>(null);
  const [purchaseMonths, setPurchaseMonths] = useState(1);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [purchaseRequestKey, setPurchaseRequestKey] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ search, status, limit: "50", offset: String(offset) });
    try {
      const result = await adminRequest<{ restaurants: Restaurant[] }>(`/api/admin/restaurants?${query}`);
      const receivedAt = Date.now();
      setRestaurants(result.restaurants.map((restaurant) => ({
        ...restaurant,
        clockOffsetMs: Date.parse(restaurant.server_now || "") - receivedAt,
      })));
    } catch (cause) { setError(cause instanceof AdminApiError ? `โหลดร้านค้าไม่สำเร็จ (${cause.code})` : "โหลดร้านค้าไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [search, status, offset]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function openDetail(restaurantId: string) {
    setSelected(null);
    try { setSelected(await adminRequest<RestaurantDetail>(`/api/admin/restaurants/${restaurantId}`)); }
    catch (cause) { setError(cause instanceof AdminApiError ? `โหลดรายละเอียดไม่สำเร็จ (${cause.code})` : "โหลดรายละเอียดไม่สำเร็จ"); }
  }

  async function changeStatus(restaurant: Restaurant) {
    if (!canManage) return;
    const suspended = !restaurant.suspended_at;
    const reason = suspended ? window.prompt(`ระบุเหตุผลที่ระงับร้าน “${restaurant.name}”`)?.trim() : "";
    if (suspended && !reason) return;
    if (!window.confirm(suspended ? `ยืนยันระงับร้าน ${restaurant.name}?` : `ยืนยันคืนสถานะร้าน ${restaurant.name}?`)) return;
    try {
      await adminRequest(`/api/admin/restaurants/${restaurant.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended, reason }),
      });
      setNotice(suspended ? "ระงับร้านค้าแล้ว" : "คืนสถานะร้านค้าแล้ว");
      await load();
    } catch (cause) { setError(cause instanceof AdminApiError ? `เปลี่ยนสถานะไม่สำเร็จ (${cause.code})` : "เปลี่ยนสถานะไม่สำเร็จ"); }
  }

  async function openProPurchase(restaurant: Restaurant) {
    setPurchaseTarget(restaurant);
    setPurchasePricing(null);
    setPurchaseMonths(1);
    setPaymentReceived(false);
    setPurchaseRequestKey(crypto.randomUUID());
    setPurchaseError("");
    setPurchaseLoading(true);
    try {
      setPurchasePricing(await adminRequest<ProPricing>("/api/admin/pro-pricing"));
    } catch (cause) {
      setPurchaseError(cause instanceof AdminApiError ? `โหลดราคาไม่สำเร็จ (${cause.code})` : "โหลดราคาไม่สำเร็จ");
    } finally {
      setPurchaseLoading(false);
    }
  }

  function selectPurchaseMonths(months: number) {
    setPurchaseMonths(months);
    setPaymentReceived(false);
  }

  async function activateProPurchase() {
    if (!purchaseTarget || !purchasePricing || !paymentReceived || purchaseBusy) return;
    setPurchaseBusy(true);
    setPurchaseError("");
    try {
      await adminRequest(`/api/admin/restaurants/${purchaseTarget.id}/pro-purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: purchaseRequestKey,
          paidMonths: purchaseMonths,
          pricingVersion: purchasePricing.version,
          paymentReceived: true,
        }),
      });
      setNotice(`เปิดแพ็กเกจโปรให้ร้าน ${purchaseTarget.name} แล้ว`);
      setPurchaseTarget(null);
      await load();
    } catch (cause) {
      const code = cause instanceof AdminApiError ? cause.code : "";
      setPurchaseError(code === "PRO_ACTIVE"
        ? "ร้านนี้มีแพ็กเกจที่ยังใช้งานอยู่ กรุณารีเฟรชข้อมูลก่อนทำรายการ"
        : code === "REQUEST_PENDING"
          ? "ร้านนี้มีคำขอรออนุมัติอยู่แล้ว ระบบยังไม่เปิดแพ็กเกจซ้ำ"
          : code === "PRICE_CHANGED"
            ? "ราคาแพ็กเกจเปลี่ยนแล้ว กรุณาปิดหน้าต่างและเปิดใหม่เพื่อตรวจสอบราคา"
            : code === "PRICE_NOT_CONFIGURED"
              ? "ยังไม่ได้กำหนดราคาแพ็กเกจโปร"
              : `เปิดแพ็กเกจไม่สำเร็จ${code ? ` (${code})` : " กรุณาลองใหม่"}`);
    } finally {
      setPurchaseBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">RESTAURANTS</p><h1 className="mt-1 text-2xl font-semibold">จัดการร้านค้า</h1><p className="mt-1 text-sm text-slate-500">ค้นหาร้าน ตรวจสอบการใช้งาน และจัดการสถานะบัญชีร้าน</p></header>
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid min-w-56 flex-1 gap-1 text-xs text-slate-500">ค้นหาร้านหรืออีเมลเจ้าของ<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={search} onChange={(event) => { setOffset(0); setSearch(event.target.value); }} /></label>
        <label className="grid gap-1 text-xs text-slate-500">สถานะ<select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={status} onChange={(event) => { setOffset(0); setStatus(event.target.value); }}><option value="all">ทั้งหมด</option><option value="active">ใช้งาน</option><option value="suspended">ถูกระงับ</option><option value="migration_pending">รอย้ายบัญชี</option></select></label>
      </section>
      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {loading ? <PageState /> : restaurants.length === 0 ? <PageState error="ไม่พบร้านค้าที่ตรงกับเงื่อนไข" /> : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
              <colgroup><col className="w-[23%]" /><col className="w-[13%]" /><col className="w-[7%]" /><col className="w-[8%]" /><col className="w-[6%]" /><col className="w-[10%]" /><col className="w-[8%]" /><col className="w-[18%]" /><col className="w-[7%]" /></colgroup>
              <thead className="bg-slate-50 text-xs text-slate-500"><tr>
                <th className="px-3 py-3 font-medium">ร้านค้า</th><th className="px-3 py-3 font-medium">วันที่สมัคร</th><th className="px-3 py-3 text-center font-medium">สมาชิก</th><th className="px-3 py-3 text-center font-medium">เมนู / โต๊ะ</th><th className="px-3 py-3 text-center font-medium">ออเดอร์</th><th className="px-3 py-3 text-right font-medium">ยอดขายวันนี้</th><th className="px-3 py-3 text-center font-medium">สถานะ</th><th className="px-3 py-3 font-medium">เวลาคงเหลือ</th><th className="px-3 py-3 text-right font-medium">จัดการ</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{restaurants.map((restaurant) => {
                const remaining = proRemainingMs(restaurant, clockNow);
                return <tr className="align-middle" key={restaurant.id}>
                  <td className="px-3 py-2.5"><button className="max-w-full truncate text-left font-semibold text-emerald-900 hover:underline" type="button" title={restaurant.name} onClick={() => void openDetail(restaurant.id)}>{restaurant.name}</button><span className="block truncate text-xs text-slate-500" title={restaurant.owner_email || "ไม่ระบุเจ้าของ"}>{restaurant.owner_email || "ไม่ระบุเจ้าของ"}</span><span className="block truncate font-mono text-[10px] text-slate-400" title={restaurant.id}>{restaurant.id}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{formatSignupDate(restaurant.created_at)}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{restaurant.migrated_member_count}/{restaurant.member_count}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{restaurant.menu_count} / {restaurant.table_count}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{restaurant.order_count.toLocaleString("th-TH")}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-900">{formatCurrency(Number(restaurant.today_revenue), restaurant.currency_code)}</td>
                  <td className="px-3 py-2.5 text-center"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs ${restaurant.suspended_at ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{restaurant.suspended_at ? "ถูกระงับ" : "ใช้งาน"}</span></td>
                  <td className="px-3 py-2.5 text-xs" title={restaurant.pro_expires_at ? formatSignupDate(restaurant.pro_expires_at) : undefined}>{restaurant.pro_request_pending ? <span className="font-medium text-amber-700">รออนุมัติคำขอ</span> : remaining !== null && remaining > 0 ? <span className={`${proCountdownClass(restaurant, clockNow)} whitespace-nowrap`}>{formatProCountdown(restaurant, clockNow)}</span> : <div className="flex flex-col items-start gap-1"><span className="whitespace-nowrap font-semibold text-red-700">หมดอายุแล้ว</span>{canManage && <button className="whitespace-nowrap rounded-lg bg-emerald-800 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-900" type="button" onClick={() => void openProPurchase(restaurant)}>เลือกแพ็กเกจโปร</button>}</div>}</td>
                  <td className="px-3 py-2.5 text-right">{canManage && <button className="whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-50" type="button" onClick={() => void changeStatus(restaurant)}>{restaurant.suspended_at ? "คืนสถานะ" : "ระงับ"}</button>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 p-3"><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 50))}>ก่อนหน้า</button><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={restaurants.length < 50} onClick={() => setOffset((value) => value + 50)}>ถัดไป</button></div>
        </section>
      )}
      {selected && <RestaurantDetailDialog detail={selected} onClose={() => setSelected(null)} />}
      {purchaseTarget && <ProPurchaseDialog
        restaurant={purchaseTarget}
        pricing={purchasePricing}
        selectedMonths={purchaseMonths}
        paymentReceived={paymentReceived}
        loading={purchaseLoading}
        busy={purchaseBusy}
        error={purchaseError}
        onSelectMonths={selectPurchaseMonths}
        onPaymentReceived={setPaymentReceived}
        onConfirm={() => void activateProPurchase()}
        onClose={() => { if (!purchaseBusy) setPurchaseTarget(null); }}
      />}
    </div>
  );
}

function ProPurchaseDialog({
  restaurant, pricing, selectedMonths, paymentReceived, loading, busy, error,
  onSelectMonths, onPaymentReceived, onConfirm, onClose,
}: {
  restaurant: Restaurant;
  pricing: ProPricing | null;
  selectedMonths: number;
  paymentReceived: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  onSelectMonths: (months: number) => void;
  onPaymentReceived: (received: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const monthly = Number(pricing?.monthly_usd || "");
  const validPrice = Number.isFinite(monthly) && monthly > 0;
  const chosen = proPackages.find((item) => item.paid === selectedMonths) ?? proPackages[0];
  const usd = (amount: number) => amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3" onClick={onClose}>
    <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="pro-purchase-title" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">ADMIN PRO PURCHASE</p><h2 id="pro-purchase-title" className="mt-1 text-xl font-semibold">เลือกแพ็กเกจโปรให้ร้าน</h2><p className="mt-1 text-sm text-slate-500">{restaurant.name} · {restaurant.owner_email || "ไม่ระบุอีเมล"}</p></div>
        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40" type="button" disabled={busy} onClick={onClose}>ปิด</button>
      </header>
      {loading ? <p role="status" className="mt-5 text-sm text-slate-500">กำลังโหลดราคาแพ็กเกจ…</p> : <>
        {!validPrice && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">ยังไม่ได้กำหนดราคาแพ็กเกจโปร</p>}
        {validPrice && <fieldset className="mt-5 space-y-2">
          <legend className="mb-2 text-sm font-semibold text-slate-700">เลือกแพ็กเกจ (ราคาต่อเดือน {usd(monthly)})</legend>
          {proPackages.map((item) => <label key={item.paid} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition ${selectedMonths === item.paid ? "border-emerald-700 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}>
            <span className="flex items-center gap-3"><input type="radio" name="pro-package" value={item.paid} checked={selectedMonths === item.paid} onChange={() => onSelectMonths(item.paid)} disabled={busy} /><span><span className="block font-semibold text-slate-800">{item.paid} เดือน{item.free > 0 ? ` แถม ${item.free} เดือน` : ""}</span><span className="text-xs text-slate-500">ใช้งานรวม {item.paid + item.free} เดือน</span></span></span>
            <span className="whitespace-nowrap text-right"><span className="block font-bold tabular-nums text-emerald-900">{usd(monthly * item.paid)}</span><span className="text-xs text-slate-500">USD</span></span>
          </label>)}
        </fieldset>}
        {validPrice && <>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><div className="flex justify-between gap-3"><span>ยอดที่ยืนยันว่าได้รับ</span><strong>{usd(monthly * chosen.paid)} USD</strong></div><div className="mt-1 flex justify-between gap-3 text-slate-600"><span>สิทธิ์ใช้งาน</span><span>{chosen.paid + chosen.free} เดือน (เดือนละ 30 วัน)</span></div><p className="mt-2 text-xs leading-5 text-slate-500">เริ่มนับสิทธิ์ตั้งแต่เวลาที่แอดมินยืนยัน และบันทึกชื่อแอดมินกับรายละเอียดแพ็กเกจไว้ในประวัติระบบ</p></div>
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input className="mt-0.5" type="checkbox" checked={paymentReceived} onChange={(event) => onPaymentReceived(event.target.checked)} disabled={busy} /><span>ยืนยันว่าได้รับเงิน <strong>{usd(monthly * chosen.paid)} USD</strong> จากร้านนี้แล้ว และต้องการเปิดแพ็กเกจทันที</span></label>
        </>}
      </>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" type="button" disabled={busy} onClick={onClose}>ยกเลิก</button><button className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={loading || busy || !validPrice || !paymentReceived} onClick={onConfirm}>{busy ? "กำลังเปิดแพ็กเกจ…" : "ยืนยันรับเงินและเปิดแพ็กเกจ"}</button></div>
    </section>
  </div>;
}

function RestaurantDetailDialog({ detail, onClose }: { detail: RestaurantDetail; onClose: () => void }) {
  const { restaurant, metrics } = detail;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onClick={onClose}><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
    <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">SHOP DETAILS</p><h2 className="mt-1 text-xl font-semibold">{restaurant.name}</h2><p className="mt-1 text-sm text-slate-500">{restaurant.owner_email} · {restaurant.owner_phone || "ไม่มีเบอร์โทร"}</p></div><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" type="button" onClick={onClose}>ปิด</button></header>
    <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["ออเดอร์วันนี้", metrics.today_order_count], ["ยอดขายวันนี้", money(metrics.today_revenue)], ["ออเดอร์ 30 วัน", metrics.last_30_order_count], ["ยอดขาย 30 วัน", money(metrics.last_30_revenue)]].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-3" key={String(label)}><dt className="text-xs text-slate-500">{label}</dt><dd className="m-0 mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl>
    <div className="mt-5 grid gap-5 md:grid-cols-2"><section><h3 className="font-semibold">สมาชิก</h3><ul className="mt-2 grid gap-2">{detail.members.map((member) => <li className="flex justify-between gap-3 rounded-lg border border-slate-100 p-2 text-sm" key={member.id}><span>{member.email}</span><span className="text-slate-500">{member.role}</span></li>)}</ul></section><section><h3 className="font-semibold">ออเดอร์ล่าสุด</h3><ul className="mt-2 grid gap-2">{detail.recentOrders.slice(0, 8).map((order) => <li className="flex justify-between gap-3 rounded-lg border border-slate-100 p-2 text-xs" key={order.id}><span>#{order.id.slice(0, 7)} · โต๊ะ {order.table_number}</span><span>{money(order.total)}</span></li>)}</ul></section></div>
  </section></div>;
}

function proRemainingMs(restaurant: Restaurant, now: number) {
  if (!restaurant.pro_expires_at) return null;
  const expiresAt = Date.parse(restaurant.pro_expires_at);
  if (!Number.isFinite(expiresAt)) return null;
  const offset = Number.isFinite(restaurant.clockOffsetMs) ? restaurant.clockOffsetMs! : 0;
  return expiresAt - (now + offset);
}

function formatProCountdown(restaurant: Restaurant, now: number) {
  const remaining = proRemainingMs(restaurant, now);
  if (remaining === null) return "ไม่มีแพ็กเกจ";
  if (remaining <= 0) return "หมดอายุแล้ว";
  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const prefix = restaurant.trial_active ? "ทดลองใช้ฟรี" : "Pro";
  return prefix + " · เหลือ " + days + " วัน " + hours + " ชม. " + minutes + " นาที";
}

function proCountdownClass(restaurant: Restaurant, now: number) {
  const remaining = proRemainingMs(restaurant, now);
  if (remaining === null) return "text-slate-400";
  return remaining <= 0 ? "font-semibold text-red-700" : "font-medium text-emerald-800";
}

function formatCurrency(value: number, currency: "LAK" | "THB" | "USD") {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "LAK" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatSignupDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString("th-TH", { calendar: "gregory", dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })
    : "—";
}

function money(value: number) { return `${Number(value || 0).toLocaleString("th-TH")} ₭`; }
