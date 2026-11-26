import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminRequest, AdminApiError, type AdminUser } from "../../shared/adminApi";
import { PageState } from "../dashboard/PlatformOverviewPage";
import { ADMIN_SECTIONS, type AdminSection } from "../../app/adminSections";

const sectionLabels: Record<AdminSection, string> = {
  overview: "ภาพรวม", shops: "จัดการร้านค้า", users: "จัดการผู้ใช้", audit: "Audit Log", monitor: "ติดตามระบบ",
  "contact-messages": "ข้อความติดต่อ", "pro-pricing": "ตั้งราคาแพ็กเกจ", "finance-income": "รายรับ", "finance-expense": "รายจ่าย", settings: "ตั้งค่า",
};

interface UserDetail {
  user: AdminUser;
  metrics: Record<string, number>;
  memberships: Array<{ id: string; restaurant_id: string; restaurant_name: string; role: string; suspended_at: string | null }>;
  sessions: Array<{ id: string; created_at: string; last_used_at: string | null; ip_address: string; active: boolean }>;
  passwordResets: Array<{ id: string; created_at: string; expires_at: string; active: boolean }>;
  recentActivity: Array<{ id: string; action: string; actor_email: string | null; restaurant_name: string | null; created_at: string }>;
}

export default function UserManagementPage({ canManage, canManageAdminAccess, canDeleteUsers, currentAdminId }: { canManage: boolean; canManageAdminAccess: boolean; canDeleteUsers: boolean; currentAdminId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [migration, setMigration] = useState("all");
  const [restaurantId, setRestaurantId] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [accessUser, setAccessUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

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

  async function saveProfile(userId: string, profile: { email: string; displayName: string; phone: string; reason: string }) {
    await adminRequest(`/api/admin/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    setNotice("บันทึกข้อมูลผู้ใช้แล้ว");
    await load();
    if (selected?.user.id === userId) setSelected(await adminRequest<UserDetail>(`/api/admin/users/${userId}`));
  }

  async function saveMembership(userId: string, membershipId: string, role: string, reason: string) {
    await adminRequest(`/api/admin/users/${userId}/memberships/${membershipId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, reason }) });
    setNotice("บันทึกบทบาทผู้ใช้ในร้านแล้ว");
    await load();
    setSelected(await adminRequest<UserDetail>(`/api/admin/users/${userId}`));
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

  async function saveAdminAccess(user: AdminUser, active: boolean, permissions: Partial<Record<AdminSection, "view" | "edit">>, reason: string) {
    await adminRequest(`/api/admin/users/${user.id}/admin-access`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active, permissions, reason }) });
    setNotice(active ? `กำหนดสิทธิ์แอดมินให้ ${user.email} แล้ว` : `ปิดสิทธิ์แอดมินของ ${user.email} แล้ว`);
    setAccessUser(null);
    await load();
  }

  async function deleteAccount(user: AdminUser, reason: string) {
    await adminRequest(`/api/admin/users/${user.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    setDeleteUser(null);
    setNotice(`ลบบัญชี ${user.email} ออกจากระบบแล้ว`);
    if (selected?.user.id === user.id) setSelected(null);
    await load();
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
      {loading ? <PageState /> : users.length === 0 ? <PageState error="ไม่พบบัญชีที่ตรงกับเงื่อนไข" /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["บัญชี", "ร้าน / บทบาท", "ย้ายรหัสผ่าน", "เข้าสู่ระบบผิด", "สถานะ", "จัดการ"].map((heading) => <th className={`px-3 py-3 font-medium ${heading === "จัดการ" ? "text-center" : ""}`} key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{users.map((user) => <tr key={user.id}>
        <td className="px-3 py-3"><button className="font-medium text-emerald-900 hover:underline" type="button" onClick={() => void openDetail(user.id)}>{user.display_name || user.email}</button><span className="mt-1 block text-xs text-slate-500">{user.email}{user.phone ? ` · ${user.phone}` : ""}</span></td>
        <td className="px-3 py-3">{user.restaurant_name || (user.is_admin ? "Platform admin" : "—")}<span className="block text-xs text-slate-500">{user.restaurant_role || ""}</span></td>
        <td className="px-3 py-3">{user.password_migrated_at ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">ย้ายแล้ว</span> : <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">รอดำเนินการ</span>}</td>
        <td className="px-3 py-3 text-center tabular-nums text-amber-800">{Number(user.failed_login_attempts || 0).toLocaleString("th-TH")}</td>
        <td className="px-3 py-3">{user.disabled_at ? <span className="text-red-700">ปิดใช้งาน</span> : <span className="text-emerald-800">ใช้งาน</span>}</td>
        <td className="space-x-1 whitespace-nowrap px-3 py-3 text-right">{canManage && <><button className="rounded-lg border border-emerald-700 px-2 py-1 text-xs text-emerald-800" type="button" onClick={() => setEditingUser(user)}>แก้ข้อมูล</button>{!user.is_admin && <><button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" onClick={() => void createResetLink(user)}>ลิงก์รีเซ็ต</button><button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" onClick={() => void setPassword(user)}>ตั้งรหัสผ่าน</button><button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" disabled={user.disabled_at != null && user.id === currentAdminId} onClick={() => void toggleStatus(user)}>{user.disabled_at ? "เปิดบัญชี" : "ระงับ"}</button></>}</>}{canManageAdminAccess && user.id !== currentAdminId && user.admin_role !== "super_admin" && <button className="rounded-lg border border-emerald-700 px-2 py-1 text-xs font-medium text-emerald-800" type="button" onClick={() => setAccessUser(user)}>{user.is_admin ? "สิทธิ์เมนู" : "เพิ่มเป็นแอดมิน"}</button>}{canDeleteUsers && user.id !== currentAdminId && user.admin_role !== "super_admin" && <button className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50" type="button" onClick={() => setDeleteUser(user)}>ลบ</button>}</td>
      </tr>)}</tbody></table></div><div className="flex justify-end gap-2 border-t border-slate-100 p-3"><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={!offset} onClick={() => setOffset((value) => Math.max(0, value - 100))}>ก่อนหน้า</button><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={users.length < 100} onClick={() => setOffset((value) => value + 100)}>ถัดไป</button></div></section>}
      {selected && <UserDetailDialog detail={selected} canManage={canManage} onClose={() => setSelected(null)} onSaveProfile={saveProfile} onSaveMembership={saveMembership} />}
      {editingUser && <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} onSave={saveProfile} />}
      {accessUser && <AdminAccessDialog user={accessUser} onClose={() => setAccessUser(null)} onSave={saveAdminAccess} />}
      {deleteUser && <DeleteUserDialog user={deleteUser} onClose={() => setDeleteUser(null)} onDelete={deleteAccount} />}
    </div>
  );
}

function DeleteUserDialog({ user, onClose, onDelete }: {
  user: AdminUser;
  onClose: () => void;
  onDelete: (user: AdminUser, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await onDelete(user, reason.trim()); }
    catch (cause) {
      setError(cause instanceof AdminApiError
        ? cause.code === "CANNOT_DELETE_SUPER_ADMIN" ? "ไม่สามารถลบบัญชีผู้ดูแลสูงสุดได้" : `ลบบัญชีไม่สำเร็จ (${cause.code})`
        : "ลบบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-3" onClick={onClose}>
    <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="delete-user-title" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-3"><div><h2 id="delete-user-title" className="text-xl font-semibold text-red-800">ลบบัญชีผู้ใช้</h2><p className="mt-1 text-sm text-slate-600">{user.display_name || user.email} · {user.email}</p></div><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" type="button" disabled={busy} onClick={onClose}>ปิด</button></header>
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900">
        <p className="m-0 font-semibold">บัญชีนี้จะเข้าสู่ระบบไม่ได้และจะถูกซ่อนจากรายการผู้ใช้</p>
        <p className="mb-0 mt-1">ระบบจะยกเลิก session และสิทธิ์แอดมินของบัญชีนี้ ข้อมูลร้านและประวัติเดิมจะยังคงอยู่</p>
      </div>
      <form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1 text-sm font-medium">เหตุผลในการลบบัญชี<textarea required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="ระบุเหตุผลเพื่อเก็บไว้ในประวัติแอดมิน" /></label>
        {error && <p className="m-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        <div className="flex justify-end gap-2"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" type="button" disabled={busy} onClick={onClose}>ยกเลิก</button><button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={busy}>{busy ? "กำลังลบ…" : "ยืนยันลบบัญชี"}</button></div>
      </form>
    </section>
  </div>;
}

function AdminAccessDialog({ user, onClose, onSave }: {
  user: AdminUser;
  onClose: () => void;
  onSave: (user: AdminUser, active: boolean, permissions: Partial<Record<AdminSection, "view" | "edit">>, reason: string) => Promise<void>;
}) {
  const [active, setActive] = useState(user.admin_active === true);
  const [permissions, setPermissions] = useState<Partial<Record<AdminSection, "view" | "edit">>>(() => {
    if (user.admin_section_permissions) return { ...user.admin_section_permissions };
    if (!user.is_admin) return {};
    return Object.fromEntries(ADMIN_SECTIONS.map((section) => [section, user.admin_role === "viewer" ? "view" : "edit"])) as Partial<Record<AdminSection, "view" | "edit">>;
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active && !Object.keys(permissions).length) { setError("เลือกอย่างน้อยหนึ่งเมนูให้ผู้ใช้นี้"); return; }
    setSaving(true); setError("");
    try { await onSave(user, active, permissions, reason); }
    catch (cause) { setError(cause instanceof AdminApiError ? `บันทึกสิทธิ์ไม่สำเร็จ (${cause.code})` : "บันทึกสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-3" onClick={onClose}>
    <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="admin-access-title" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-3"><div><h2 id="admin-access-title" className="text-xl font-semibold">กำหนดสิทธิ์ผู้ดูแล</h2><p className="mt-1 text-sm text-slate-500">{user.display_name || user.email} · {user.email}</p></div><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" type="button" onClick={onClose}>ปิด</button></header>
      <form className="mt-4 grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />เปิดสิทธิ์ให้เข้าสู่ระบบผู้ดูแลแพลตฟอร์ม</label>
        <div className="grid gap-2 sm:grid-cols-2">{ADMIN_SECTIONS.map((section) => <label key={section} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"><span>{sectionLabels[section]}</span><select aria-label={`สิทธิ์เมนู ${sectionLabels[section]}`} value={permissions[section] || "none"} disabled={!active} onChange={(event) => setPermissions((current) => {
          const next = { ...current };
          if (event.target.value === "none") delete next[section];
          else next[section] = event.target.value as "view" | "edit";
          return next;
        })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"><option value="none">ไม่มีสิทธิ์</option><option value="view">ดูได้</option><option value="edit">แก้ไขได้</option></select></label>)}</div>
        <p className="m-0 text-xs leading-5 text-slate-500">เพิ่มสิทธิ์ได้เฉพาะบัญชีที่ลงทะเบียนในระบบแล้ว ผู้ใช้จะเข้าสู่ระบบด้วยอีเมลและรหัสผ่านของบัญชีนั้น</p>
        <label className="grid gap-1 text-sm">เหตุผลที่เปลี่ยนสิทธิ์<textarea required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
        {error && <p className="m-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        <div className="flex justify-end gap-2"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" type="button" onClick={onClose}>ยกเลิก</button><button className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกสิทธิ์"}</button></div>
      </form>
    </section>
  </div>;
}

type ProfileInput = { email: string; displayName: string; phone: string; reason: string };
type SaveProfile = (userId: string, profile: ProfileInput) => Promise<void>;
type SaveMembership = (userId: string, membershipId: string, role: string, reason: string) => Promise<void>;

function UserDetailDialog({ detail, canManage, onClose, onSaveProfile, onSaveMembership }: {
  detail: UserDetail;
  canManage: boolean;
  onClose: () => void;
  onSaveProfile: SaveProfile;
  onSaveMembership: SaveMembership;
}) {
  const [editing, setEditing] = useState(false);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onClick={onClose}>
    <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
      <header className="flex justify-between gap-4">
        <div><h2 className="text-xl font-semibold">{detail.user.display_name || detail.user.email}</h2><p className="mt-1 text-sm text-slate-500">{detail.user.email} · {detail.user.phone || "ไม่มีเบอร์โทร"}</p></div>
        <div className="flex gap-2">{canManage && <button className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-800" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "ปิดการแก้ไข" : "แก้ข้อมูล"}</button>}<button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" type="button" onClick={onClose}>ปิด</button></div>
      </header>
      {editing && <ProfileEditor user={detail.user} onCancel={() => setEditing(false)} onSave={async (profile) => { await onSaveProfile(detail.user.id, profile); setEditing(false); }} />}
      <dl className="mt-4 grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm sm:grid-cols-2">
        <Info label="สถานะอีเมล" value={detail.user.email_verified_at ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"} />
        <Info label="สถานะบัญชี" value={detail.user.disabled_at ? "ระงับใช้งาน" : "ใช้งาน"} />
        <Info label="สมัครเมื่อ" value={detail.user.created_at ? dateTime(detail.user.created_at) : "—"} />
        <Info label="เข้าสู่ระบบล่าสุด" value={detail.user.last_login_at ? dateTime(detail.user.last_login_at) : "ยังไม่เคยเข้าสู่ระบบ"} />
        <Info label="กิจกรรมล่าสุด" value={detail.user.last_activity_at ? dateTime(detail.user.last_activity_at) : "ไม่มีข้อมูล"} />
        {detail.user.disabled_reason && <Info label="เหตุผลที่ระงับ" value={detail.user.disabled_reason} />}
        {detail.user.admin_role && <Info label="สิทธิ์แอดมิน (อ่านอย่างเดียว)" value={detail.user.admin_role + (detail.user.admin_active ? " · เปิดใช้งาน" : " · ปิดใช้งาน")} />}
      </dl>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(detail.metrics).map(([key, value]) => <div className="rounded-xl bg-slate-50 p-3" key={key}><dt className="text-xs text-slate-500">{metricLabel(key)}</dt><dd className="m-0 mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl>
      <section className="mt-5"><h3 className="font-semibold">ร้านที่เป็นสมาชิก</h3><ul className="mt-2 grid gap-2">{detail.memberships.map((item) => <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2 text-sm" key={item.id}><span>{item.restaurant_name}{item.suspended_at ? <small className="ml-2 text-red-600">ร้านถูกระงับ</small> : null}</span><MembershipRoleEditor userId={detail.user.id} membership={item} canManage={canManage} onSave={onSaveMembership} /></li>)}</ul>{detail.memberships.length === 0 && <p className="mt-2 text-sm text-slate-500">ไม่มีร้านที่เป็นสมาชิก</p>}</section>
      <section className="mt-5"><h3 className="font-semibold">Session ล่าสุด</h3><ul className="mt-2 grid gap-2">{detail.sessions.slice(0, 8).map((session) => <li className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-100 p-2 text-xs" key={session.id}><span>{session.ip_address || "unknown"} · {dateTime(session.created_at)}</span><span className={session.active ? "text-emerald-800" : "text-slate-500"}>{session.active ? "ใช้งาน" : "หมดอายุ/ยกเลิก"}</span></li>)}</ul></section>
      <section className="mt-5"><h3 className="font-semibold">ประวัติรีเซ็ตรหัสผ่าน</h3><ul className="mt-2 grid gap-2">{detail.passwordResets.slice(0, 8).map((reset) => <li className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-100 p-2 text-xs" key={reset.id}><span>{dateTime(reset.created_at)}</span><span className={reset.active ? "text-amber-700" : "text-slate-500"}>{reset.active ? "ลิงก์ยังใช้ได้" : "ใช้แล้วหรือหมดอายุ"}</span></li>)}</ul>{detail.passwordResets.length === 0 && <p className="mt-2 text-sm text-slate-500">ไม่มีประวัติ</p>}</section>
      <section className="mt-5"><h3 className="font-semibold">กิจกรรมล่าสุด</h3><ul className="mt-2 grid gap-2">{detail.recentActivity.slice(0, 12).map((activity) => <li className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-100 p-2 text-xs" key={activity.id}><span>{activity.action}{activity.restaurant_name ? " · " + activity.restaurant_name : ""}</span><span className="text-slate-500">{dateTime(activity.created_at)}</span></li>)}</ul>{detail.recentActivity.length === 0 && <p className="mt-2 text-sm text-slate-500">ไม่มีประวัติกิจกรรม</p>}</section>
    </section>
  </div>;
}

function EditUserDialog({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: SaveProfile }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-3" onClick={onClose}>
    <section className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
      <header className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">แก้ไขข้อมูลผู้ใช้</h2><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" type="button" onClick={onClose}>ปิด</button></header>
      <ProfileEditor user={user} onCancel={onClose} onSave={async (profile) => { await onSave(user.id, profile); onClose(); }} />
    </section>
  </div>;
}

function ProfileEditor({ user, onCancel, onSave }: { user: AdminUser; onCancel: () => void; onSave: (profile: ProfileInput) => Promise<void> }) {
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try { await onSave({ email, displayName, phone, reason }); }
    catch (cause) { setError(cause instanceof AdminApiError ? profileError(cause.code) : "บันทึกข้อมูลไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 sm:grid-cols-2">
    <label className="grid gap-1 text-xs text-slate-600">ชื่อที่แสดง<input required maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
    <label className="grid gap-1 text-xs text-slate-600">อีเมลเข้าสู่ระบบ<input required type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
    <label className="grid gap-1 text-xs text-slate-600">เบอร์โทรศัพท์<input type="tel" maxLength={50} value={phone} onChange={(event) => setPhone(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
    <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">เหตุผลในการแก้ไข<input required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="ระบุเหตุผลเพื่อบันทึกประวัติแอดมิน" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
    <p className="text-xs leading-5 text-slate-500 sm:col-span-2">หากเปลี่ยนอีเมล ระบบจะยกเลิก session เดิมและต้องยืนยันอีเมลใหม่ สิทธิ์แอดมินและรหัสผ่านแก้แยกต่างหาก</p>
    <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">ยกเลิก</button><button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button></div>
  </form>;
}

function MembershipRoleEditor({ userId, membership, canManage, onSave }: { userId: string; membership: UserDetail["memberships"][number]; canManage: boolean; onSave: SaveMembership }) {
  const [role, setRole] = useState(membership.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (membership.role === "owner") return <span className="text-slate-500">เจ้าของร้าน</span>;
  if (!canManage) return <span className="text-slate-500">{membership.role}</span>;
  async function save() {
    if (role === membership.role) return;
    const reason = window.prompt("เหตุผลในการเปลี่ยนบทบาท (อย่างน้อย 3 ตัวอักษร)")?.trim();
    if (!reason || reason.length < 3) return;
    setSaving(true);
    setError("");
    try { await onSave(userId, membership.id, role, reason); }
    catch (cause) { setError(cause instanceof AdminApiError ? "บันทึกไม่สำเร็จ (" + cause.code + ")" : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  return <span className="flex items-center gap-2"><select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"><option value="staff">พนักงาน</option><option value="cook">พ่อครัว</option><option value="waiter">พนักงานเสิร์ฟ</option></select><button type="button" disabled={saving || role === membership.role} onClick={() => void save()} className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">{saving ? "กำลังบันทึก…" : "บันทึก"}</button>{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</span>;
}

function profileError(code: string) {
  if (code === "EMAIL_ALREADY_IN_USE") return "อีเมลนี้ถูกใช้งานแล้ว";
  if (code === "PHONE_ALREADY_IN_USE") return "เบอร์โทรนี้ถูกใช้งานแล้ว";
  if (code === "INVALID_USER_PROFILE") return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีเมล เบอร์โทร และเหตุผล";
  return "บันทึกข้อมูลไม่สำเร็จ (" + code + ")";
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="m-0 mt-0.5 font-medium text-slate-800">{value}</dd></div>; }
function metricLabel(key: string) { return ({ membership_count: "จำนวนร้านที่เข้าร่วม", active_session_count: "Session ที่ใช้งาน", password_reset_count: "จำนวนรีเซ็ตรหัสผ่าน", restaurant_activity_count: "กิจกรรมร้าน", platform_activity_count: "กิจกรรมแพลตฟอร์ม" } as Record<string, string>)[key] || key; }
function dateTime(value: string) { return new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
