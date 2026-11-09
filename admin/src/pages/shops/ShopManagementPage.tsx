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
  member_count: number;
  migrated_member_count: number;
  menu_count: number;
  table_count: number;
  order_count: number;
  last_order_at: string | null;
}

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ search, status, limit: "50", offset: String(offset) });
    try {
      const result = await adminRequest<{ restaurants: Restaurant[] }>(`/api/admin/restaurants?${query}`);
      setRestaurants(result.restaurants);
    } catch (cause) { setError(cause instanceof AdminApiError ? `โหลดร้านค้าไม่สำเร็จ (${cause.code})` : "โหลดร้านค้าไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [search, status, offset]);

  useEffect(() => { void load(); }, [load]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">RESTAURANTS</p><h1 className="mt-1 text-2xl font-semibold">จัดการร้านค้า</h1><p className="mt-1 text-sm text-slate-500">ค้นหาร้าน ตรวจสอบการใช้งาน และจัดการสถานะบัญชีร้าน</p></header>
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid min-w-56 flex-1 gap-1 text-xs text-slate-500">ค้นหาร้านหรืออีเมลเจ้าของ<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={search} onChange={(event) => { setOffset(0); setSearch(event.target.value); }} /></label>
        <label className="grid gap-1 text-xs text-slate-500">สถานะ<select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={status} onChange={(event) => { setOffset(0); setStatus(event.target.value); }}><option value="all">ทั้งหมด</option><option value="active">ใช้งาน</option><option value="suspended">ถูกระงับ</option><option value="migration_pending">รอย้ายบัญชี</option></select></label>
      </section>
      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {loading ? <PageState /> : restaurants.length === 0 ? <PageState error="ไม่พบร้านค้าที่ตรงกับเงื่อนไข" /> : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["ร้านค้า", "สมาชิก", "เมนู / โต๊ะ", "ออเดอร์", "สถานะ", ""].map((title) => <th className="px-4 py-3 font-medium" key={title}>{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{restaurants.map((restaurant) => <tr key={restaurant.id}>
            <td className="px-4 py-3"><button className="font-semibold text-emerald-900 hover:underline" type="button" onClick={() => void openDetail(restaurant.id)}>{restaurant.name}</button><span className="mt-1 block text-xs text-slate-500">{restaurant.owner_email || "ไม่ระบุเจ้าของ"}</span><span className="mt-1 block font-mono text-[10px] text-slate-400">{restaurant.id}</span></td>
            <td className="px-4 py-3 tabular-nums">{restaurant.migrated_member_count}/{restaurant.member_count}</td><td className="px-4 py-3 tabular-nums">{restaurant.menu_count} / {restaurant.table_count}</td><td className="px-4 py-3 tabular-nums">{restaurant.order_count.toLocaleString("th-TH")}</td>
            <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${restaurant.suspended_at ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{restaurant.suspended_at ? "ถูกระงับ" : "ใช้งาน"}</span></td>
            <td className="px-4 py-3 text-right">{canManage && <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" type="button" onClick={() => void changeStatus(restaurant)}>{restaurant.suspended_at ? "คืนสถานะ" : "ระงับ"}</button>}</td>
          </tr>)}</tbody></table></div>
          <div className="flex justify-end gap-2 border-t border-slate-100 p-3"><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 50))}>ก่อนหน้า</button><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={restaurants.length < 50} onClick={() => setOffset((value) => value + 50)}>ถัดไป</button></div>
        </section>
      )}
      {selected && <RestaurantDetailDialog detail={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function RestaurantDetailDialog({ detail, onClose }: { detail: RestaurantDetail; onClose: () => void }) {
  const { restaurant, metrics } = detail;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onClick={onClose}><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
    <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">SHOP DETAILS</p><h2 className="mt-1 text-xl font-semibold">{restaurant.name}</h2><p className="mt-1 text-sm text-slate-500">{restaurant.owner_email} · {restaurant.owner_phone || "ไม่มีเบอร์โทร"}</p></div><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" type="button" onClick={onClose}>ปิด</button></header>
    <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["ออเดอร์วันนี้", metrics.today_order_count], ["ยอดขายวันนี้", money(metrics.today_revenue)], ["ออเดอร์ 30 วัน", metrics.last_30_order_count], ["ยอดขาย 30 วัน", money(metrics.last_30_revenue)]].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-3" key={String(label)}><dt className="text-xs text-slate-500">{label}</dt><dd className="m-0 mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl>
    <div className="mt-5 grid gap-5 md:grid-cols-2"><section><h3 className="font-semibold">สมาชิก</h3><ul className="mt-2 grid gap-2">{detail.members.map((member) => <li className="flex justify-between gap-3 rounded-lg border border-slate-100 p-2 text-sm" key={member.id}><span>{member.email}</span><span className="text-slate-500">{member.role}</span></li>)}</ul></section><section><h3 className="font-semibold">ออเดอร์ล่าสุด</h3><ul className="mt-2 grid gap-2">{detail.recentOrders.slice(0, 8).map((order) => <li className="flex justify-between gap-3 rounded-lg border border-slate-100 p-2 text-xs" key={order.id}><span>#{order.id.slice(0, 7)} · โต๊ะ {order.table_number}</span><span>{money(order.total)}</span></li>)}</ul></section></div>
  </section></div>;
}

function money(value: number) { return `${Number(value || 0).toLocaleString("th-TH")} ₭`; }
