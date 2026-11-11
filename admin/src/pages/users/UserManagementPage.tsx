import { useCallback, useEffect, useState } from "react";
import { adminRequest, AdminApiError, type AdminUser } from "../../shared/adminApi";
import { PageState } from "../dashboard/PlatformOverviewPage";

interface UserDetail {
  user: AdminUser;
  metrics: Record<string, number>;
  memberships: Array<{ restaurant_name: string; role: string; suspended_at: string | null }>;
  sessions: Array<{ id: string; created_at: string; last_used_at: string | null; ip_address: string; active: boolean }>;
  passwordResets: Array<{ id: string; created_at: string; expires_at: string; active: boolean }>;
  recentActivity: Array<{ id: string; action: string; actor_email: string | null; restaurant_name: string | null; created_at: string }>;
}

export default function UserManagementPage({ canManage, currentAdminId }: { canManage: boolean; currentAdminId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [migration, setMigration] = useState("all");
  const [restaurantId, setRestaurantId] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<UserDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ search, migration, limit: "100", offset: String(offset) });
    if (restaurantId.trim()) query.set("restaurantId", restaurantId.trim());
    try {
      const result = await adminRequest<{ users: AdminUser[] }>(`/api/admin/users?${query}`);
      setUsers(result.users);
    } catch (cause) { setError(cause instanceof AdminApiError ? `โหลดบัญชีไม่สำเร็จ (${cause.code})` : "โหลดบัญชีไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [search, migration, restaurantId, offset]);

  useEffect(() => { void load(); }, [load]);

  async function openDetail(userId: string) {
    try { setSelected(await adminRequest<UserDetail>(`/api/admin/users/${userId}`)); }
    catch (cause) { setError(cause instanceof AdminApiError ? `โหลดรายละเอียดไม่สำเร็จ (${cause.code})` : "โหลดรายละเอียดไม่สำเร็จ"); }
  }

  async function toggleStatus(user: AdminUser) {
    if (!canManage) return;
    const disabled = !user.disabled_at;
    const reason = disabled ? window.prompt(`เหตุผลที่ปิดบัญชี ${user.email}`)?.trim() : "";
    if (disabled && !reason) return;
    if (!window.confirm(disabled ? `ยืนยันปิดบัญชี ${user.email}?` : `ยืนยันเปิดบัญชี ${user.email}?`)) return;
    try {
      await adminRequest(`/api/admin/users/${user.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disabled, reason }) });
      setNotice(disabled ? "ปิดบัญชีและยกเลิก session แล้ว" : "เปิดบัญชีแล้ว");
      await load();
    } catch (cause) { setError(cause instanceof AdminApiError ? `เปลี่ยนสถานะไม่สำเร็จ (${cause.code})` : "เปลี่ยนสถานะไม่สำเร็จ"); }
  }

  async function createResetLink(user: AdminUser) {
    const reason = window.prompt(`เหตุผลที่ออกลิงก์ตั้งรหัสผ่านใหม่ให้ ${user.email}`)?.trim();
    if (!reason) return;
    try {
      const result = await adminRequest<{ resetToken: string; expiresAt: string; email: string }>(`/api/admin/users/${user.id}/password-reset-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const link = new URL("/reset-password", window.location.origin);
      link.searchParams.set("token", result.resetToken);
      setNotice(`ลิงก์ตั้งรหัสผ่านสำหรับ ${result.email} (ใช้ได้ถึง ${dateTime(result.expiresAt)}): ${link.toString()}`);
    } catch (cause) { setError(cause instanceof AdminApiError ? `สร้างลิงก์ไม่สำเร็จ (${cause.code})` : "สร้างลิงก์ไม่สำเร็จ"); }
  }

  async function setPassword(user: AdminUser) {
    const newPassword = window.prompt(`ตั้งรหัสผ่านใหม่ให้ ${user.email} (อย่างน้อย 6 ตัวอักษร)`);
    if (!newPassword) return;
    const reason = window.prompt("เหตุผลในการตั้งรหัสผ่าน")?.trim() || "Admin direct password update";
    try {
      await adminRequest(`/api/admin/users/${user.id}/set-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword, reason }) });
      setNotice(`ตั้งรหัสผ่านใหม่ให้ ${user.email} แล้ว และยกเลิก session เดิม`);
      await load();
    } catch (cause) { setError(cause instanceof AdminApiError ? `ตั้งรหัสผ่านไม่สำเร็จ (${cause.code})` : "ตั้งรหัสผ่านไม่สำเร็จ"); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">USER ACCOUNTS</p><h1 className="mt-1 text-2xl font-semibold">ควบคุมผู้ใช้งาน</h1><p className="mt-1 text-sm text-slate-500">ตรวจสอบสถานะบัญชี การย้ายรหัสผ่าน และประวัติ session</p></header>
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="grid gap-1 text-xs text-slate-500">ค้นหาอีเมลหรือเบอร์โทร<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={search} onChange={(event) => { setOffset(0); setSearch(event.target.value); }} /></label>
        <label className="grid gap-1 text-xs text-slate-500">สถานะการย้ายรหัสผ่าน<select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={migration} onChange={(event) => { setOffset(0); setMigration(event.target.value); }}><option value="all">ทั้งหมด</option><option value="complete">ย้ายแล้ว</option><option value="pending">รอย้าย</option></select></label>
        <label className="grid gap-1 text-xs text-slate-500">รหัสร้าน (ไม่บังคับ)<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={restaurantId} onChange={(event) => { setOffset(0); setRestaurantId(event.target.value); }} /></label>
      </section>
      {notice && <p className="break-all rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {loading ? <PageState /> : users.length === 0 ? <PageState error="ไม่พบบัญชีที่ตรงกับเงื่อนไข" /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["บัญชี", "ร้าน / บทบาท", "ย้ายรหัสผ่าน", "เข้าสู่ระบบผิด", "สถานะ", "จัดการ"].map((heading) => <th className={`px-3 py-3 font-medium ${heading === "จัดการ" ? "text-center" : ""}`} key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{users.map((user) => <tr key={`${user.id}:${user.restaurant_id || "none"}`}>
        <td className="px-3 py-3"><button className="font-medium text-emerald-900 hover:underline" type="button" onClick={() => void openDetail(user.id)}>{user.display_name || user.email}</button><span className="mt-1 block text-xs text-slate-500">{user.email}{user.phone ? ` · ${user.phone}` : ""}</span></td>
        <td className="px-3 py-3">{user.restaurant_name || (user.is_admin ? "Platform admin" : "—")}<span className="block text-xs text-slate-500">{user.restaurant_role || ""}</span></td>
        <td className="px-3 py-3">{user.password_migrated_at ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">ย้ายแล้ว</span> : <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">รอดำเนินการ</span>}</td>
        <td className="px-3 py-3 text-center tabular-nums text-amber-800">{Number(user.failed_login_attempts || 0).toLocaleString("th-TH")}</td>
        <td className="px-3 py-3">{user.disabled_at ? <span className="text-red-700">ปิดใช้งาน</span> : <span className="text-emerald-800">ใช้งาน</span>}</td>
        <td className="space-x-1 whitespace-nowrap px-3 py-3 text-right">{canManage && !user.is_admin && <><button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" onClick={() => void createResetLink(user)}>ลิงก์รีเซ็ต</button><button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" onClick={() => void setPassword(user)}>ตั้งรหัสผ่าน</button><button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" disabled={user.disabled_at != null && user.id === currentAdminId} onClick={() => void toggleStatus(user)}>{user.disabled_at ? "เปิดบัญชี" : "ระงับ"}</button></>}</td>
      </tr>)}</tbody></table></div><div className="flex justify-end gap-2 border-t border-slate-100 p-3"><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={!offset} onClick={() => setOffset((value) => Math.max(0, value - 100))}>ก่อนหน้า</button><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={users.length < 100} onClick={() => setOffset((value) => value + 100)}>ถัดไป</button></div></section>}
      {selected && <UserDetailDialog detail={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserDetailDialog({ detail, onClose }: { detail: UserDetail; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onClick={onClose}><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header className="flex justify-between gap-4"><div><h2 className="text-xl font-semibold">{detail.user.display_name || detail.user.email}</h2><p className="mt-1 text-sm text-slate-500">{detail.user.email} · {detail.user.phone || "ไม่มีเบอร์โทร"}</p></div><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" type="button" onClick={onClose}>ปิด</button></header><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(detail.metrics).map(([key, value]) => <div className="rounded-xl bg-slate-50 p-3" key={key}><dt className="text-xs text-slate-500">{metricLabel(key)}</dt><dd className="m-0 mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl><section className="mt-5"><h3 className="font-semibold">ร้านที่เป็นสมาชิก</h3><ul className="mt-2 grid gap-2">{detail.memberships.map((item) => <li className="flex justify-between rounded-lg border border-slate-100 p-2 text-sm" key={item.restaurant_name}>{item.restaurant_name}<span className="text-slate-500">{item.role}</span></li>)}</ul></section><section className="mt-5"><h3 className="font-semibold">Session ล่าสุด</h3><ul className="mt-2 grid gap-2">{detail.sessions.slice(0, 8).map((session) => <li className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-100 p-2 text-xs" key={session.id}><span>{session.ip_address || "unknown"} · {dateTime(session.created_at)}</span><span className={session.active ? "text-emerald-800" : "text-slate-500"}>{session.active ? "ใช้งาน" : "หมดอายุ/ยกเลิก"}</span></li>)}</ul></section></section></div>;
}

function metricLabel(key: string) { return ({ membership_count: "จำนวนร้านที่เข้าร่วม", active_session_count: "Session ที่ใช้งาน", password_reset_count: "จำนวนรีเซ็ตรหัสผ่าน", restaurant_activity_count: "กิจกรรมร้าน", platform_activity_count: "กิจกรรมแพลตฟอร์ม" } as Record<string, string>)[key] || key; }
function dateTime(value: string) { return new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
