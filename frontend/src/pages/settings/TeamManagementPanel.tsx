import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";

interface Member {
  id: string;
  user_id: string;
  role: string;
  invited_email: string | null;
  email?: string;
  phone: string | null;
  account_phone?: string | null;
  display_name?: string | null;
  page_permissions?: (Record<string, boolean | "view" | "admin"> & { __schema?: string }) | null;
  created_at: string;
}

interface Invite {
  id: string;
  token: string;
  role: "cook" | "waiter";
  created_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

const pageOptions = [
  ["home", "ภาพรวมร้าน"], ["backend", "จัดการร้าน"], ["menu", "เมนู"], ["categories", "หมวดหมู่"],
  ["inventory", "คลังสินค้า"], ["stock-deposits", "ฝากสินค้า"], ["tables", "โต๊ะและ QR"], ["orders", "ออเดอร์"], ["kitchen", "ห้องครัว"],
  ["bills", "บิล"], ["finance", "การเงิน"], ["promotions", "โปรโมชั่น"], ["stats", "สถิติ"],
  ["close-shop", "สรุปยอดปิดร้าน"], ["audit", "ประวัติการใช้งาน"], ["feedback", "ข้อเสนอแนะ"],
] as const;

export default function TeamManagementPanel({ restaurantId, currentUserId, initialMembers, canManage }: {
  restaurantId: string;
  currentUserId: string;
  initialMembers: Member[];
  canManage: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [creating, setCreating] = useState<"cook" | "waiter" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const activeInvites = useMemo(() => invites.filter((invite) => !invite.used_at && !invite.revoked_at), [invites]);

  useEffect(() => {
    let cancelled = false;
    if (!canManage) return () => { cancelled = true; };
    apiRequest<{ invites: Invite[] }>(`/api/restaurants/${restaurantId}/invites`)
      .then((result) => { if (!cancelled) setInvites(result.invites); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof ApiError ? `โหลดลิงก์เชิญไม่สำเร็จ (${cause.code})` : "โหลดลิงก์เชิญไม่สำเร็จ"); });
    return () => { cancelled = true; };
  }, [restaurantId, canManage]);

  async function copyLink(token: string) {
    const link = `${window.location.origin}/join/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(token);
      setNotice("คัดลอกลิงก์เชิญแล้ว");
      window.setTimeout(() => setCopied((current) => current === token ? "" : current), 1500);
    } catch {
      setNotice(`คัดลอกลิงก์นี้ด้วยตนเอง: ${link}`);
    }
  }

  async function createInvite(role: "cook" | "waiter") {
    if (!canManage || creating) return;
    setCreating(role);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ invite: Invite }>(`/api/restaurants/${restaurantId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      setInvites((current) => [result.invite, ...current]);
      await copyLink(result.invite.token);
    } catch (cause) {
      setError(cause instanceof ApiError ? `สร้างลิงก์เชิญไม่สำเร็จ (${cause.code})` : "สร้างลิงก์เชิญไม่สำเร็จ");
    } finally {
      setCreating(null);
    }
  }

  async function revokeInvite(invite: Invite) {
    if (!canManage || !window.confirm("ยกเลิกลิงก์เชิญนี้หรือไม่?")) return;
    setError("");
    try {
      const result = await apiRequest<{ invite: Invite }>(`/api/restaurants/${restaurantId}/invites/${invite.id}/revoke`, { method: "PATCH" });
      setInvites((current) => current.map((item) => item.id === invite.id ? result.invite : item));
      setNotice("ยกเลิกลิงก์เชิญแล้ว");
    } catch (cause) {
      setError(cause instanceof ApiError ? `ยกเลิกไม่สำเร็จ (${cause.code})` : "ยกเลิกไม่สำเร็จ");
    }
  }

  async function removeMember(member: Member) {
    if (!canManage || member.role === "owner" || member.user_id === currentUserId) return;
    const label = member.invited_email || member.email || member.user_id;
    if (!window.confirm(`นำ ${label} ออกจากร้านหรือไม่?`)) return;
    setError("");
    const previous = members;
    setMembers((current) => current.filter((item) => item.id !== member.id));
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/members/${member.id}`, { method: "DELETE" });
      setNotice("นำสมาชิกออกจากร้านแล้ว");
    } catch (cause) {
      setMembers(previous);
      setError(cause instanceof ApiError ? `นำสมาชิกออกไม่สำเร็จ (${cause.code})` : "นำสมาชิกออกไม่สำเร็จ");
    }
  }

  async function saveMember(member: Member, input: { displayName: string; role: string; phone: string; pagePermissions: Record<string, "view" | "admin" | string>; reason: string }) {
    setError("");
    try {
      const result = await apiRequest<{ member: Member }>(`/api/restaurants/${restaurantId}/members/${member.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, ...result.member } : item));
      setEditing(null);
      setNotice("บันทึกข้อมูลและสิทธิ์สมาชิกแล้ว");
    } catch (cause) {
      setError(cause instanceof ApiError ? `บันทึกสมาชิกไม่สำเร็จ (${cause.code})` : "บันทึกสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง");
      throw cause;
    }
  }

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header><h2 className="text-lg font-semibold">ทีมงานร้าน</h2><p className="mt-1 text-sm text-slate-500">จัดการสมาชิกและสร้างลิงก์สำหรับเชิญพนักงาน</p></header>
    {canManage && <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void createInvite("cook")} disabled={creating !== null} className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{creating === "cook" ? "กำลังสร้าง…" : "เชิญพนักงานครัว"}</button><button type="button" onClick={() => void createInvite("waiter")} disabled={creating !== null} className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{creating === "waiter" ? "กำลังสร้าง…" : "เชิญพนักงานเสิร์ฟ"}</button></div>}
    {activeInvites.length > 0 && <div className="space-y-2 border-t border-slate-100 pt-4"><h3 className="m-0 text-sm font-semibold">ลิงก์เชิญที่ยังใช้ได้ ({activeInvites.length})</h3><ul className="space-y-2">{activeInvites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${invite.role === "cook" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>{invite.role === "cook" ? "ครัว" : "เสิร์ฟ"}</span><code className="min-w-0 flex-1 truncate text-xs text-slate-500">{`${window.location.origin}/join/${invite.token}`}</code><button type="button" onClick={() => void copyLink(invite.token)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">{copied === invite.token ? "คัดลอกแล้ว" : "คัดลอก"}</button>{canManage && <button type="button" onClick={() => void revokeInvite(invite)} className="rounded-lg px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50">ยกเลิก</button>}</li>)}</ul></div>}
    <div className="border-t border-slate-100 pt-4"><h3 className="m-0 text-sm font-semibold">สมาชิก ({members.length})</h3>{members.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีสมาชิก</p> : <ul className="mt-2 space-y-2">{members.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{member.display_name || member.invited_email || member.email || member.user_id}</span><RoleBadge role={member.role} /></div><span className="mt-0.5 block truncate text-xs text-slate-500">{member.email || member.invited_email || "รอสมาชิกยืนยันบัญชี"}</span>{(member.phone || member.account_phone) && <a className="mt-0.5 block text-xs text-slate-500" href={`tel:${member.phone || member.account_phone}`}>{member.phone || member.account_phone}</a>}</div>{canManage && member.role !== "owner" && member.user_id !== currentUserId && <div className="flex shrink-0 gap-2"><button type="button" onClick={() => setEditing(member)} className="rounded-lg border border-emerald-700 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50">แก้ไข</button><button type="button" onClick={() => void removeMember(member)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700">นำออก</button></div>}</li>)}</ul>}</div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="break-all rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {editing && <EditMemberDialog member={editing} onClose={() => setEditing(null)} onSave={saveMember} />}
  </section>;
}

function EditMemberDialog({ member, onClose, onSave }: {
  member: Member;
  onClose: () => void;
  onSave: (member: Member, input: { displayName: string; role: string; phone: string; pagePermissions: Record<string, "view" | "admin" | string>; reason: string }) => Promise<void>;
}) {
  const [role, setRole] = useState(member.role);
  const [displayName, setDisplayName] = useState(member.display_name || "");
  const [phone, setPhone] = useState(member.phone || member.account_phone || "");
  const [permissions, setPermissions] = useState<Record<string, "view" | "admin">>(() => {
    if (!member.page_permissions) return defaultPagesForRole(member.role);
    const saved: Record<string, "view" | "admin"> = {};
    for (const [key, value] of Object.entries(member.page_permissions)) {
      if (value === true || value === "admin") saved[key] = "admin";
      else if (value === "view") saved[key] = "view";
    }
    if (saved.kitchen && !saved.orders && member.page_permissions.__schema !== "kitchen-orders-v1") saved.orders = saved.kitchen;
    return saved;
  });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pagePermissions = Object.entries(permissions).reduce<Record<string, "view" | "admin" | string>>((result, [key, level]) => {
      if (level) result[key] = level;
      return result;
    }, { __schema: "kitchen-orders-v1" });
    if (!Object.keys(pagePermissions).some((key) => key !== "__schema")) { setError("เลือกอย่างน้อยหนึ่งหน้าที่ให้สมาชิก"); return; }
    setBusy(true); setError("");
    try { await onSave(member, { displayName: displayName.trim(), role, phone, pagePermissions, reason: reason.trim() }); }
    catch { onClose(); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3" style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2, 6, 23, 0.5)", padding: 12, overscrollBehavior: "contain" }} onClick={busy ? undefined : onClose}>
    <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" style={{ width: "min(92vw, 42rem)", maxHeight: "90vh" }} role="dialog" aria-modal="true" aria-labelledby="edit-member-title" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-3"><div><h3 id="edit-member-title" className="text-lg font-semibold">แก้ไขข้อมูลสมาชิก</h3><p className="mt-1 text-sm text-slate-500">{member.display_name || member.email || member.invited_email}</p></div><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">ปิด</button></header>
      <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">ชื่อที่แสดง<input required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" /></label><label className="grid gap-1 text-sm">อีเมลเข้าสู่ระบบ<input value={member.email || member.invited_email || ""} readOnly className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500" /></label><label className="grid gap-1 text-sm">หน้าที่หลัก<select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option value="cook">ครัว</option><option value="waiter">เสิร์ฟ</option><option value="staff">พนักงาน</option></select></label><label className="grid gap-1 text-sm">เบอร์โทร<input type="tel" maxLength={50} value={phone} onChange={(event) => setPhone(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" /></label></div>
        <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold">กำหนดสิทธิ์รายเมนู</legend><p className="mb-3 mt-0 text-xs leading-5 text-slate-500">เลือก “ดู” เพื่อเปิดดูข้อมูล หรือ “Admin” เพื่อดูและจัดการข้อมูลในเมนูนั้น</p><div className="grid gap-2 sm:grid-cols-2">{pageOptions.map(([key, label]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2" style={{ gridTemplateColumns: "minmax(0, 1fr) auto auto auto" }} role="group" aria-label={`สิทธิ์เมนู${label}`}><span className="min-w-0 text-sm font-medium">{label}</span><label className="flex items-center gap-1.5 text-xs"><input type="radio" name={`permission-${key}`} checked={permissions[key] === "view"} onChange={() => setPermissions((current) => ({ ...current, [key]: "view" }))} />ดู</label><label className="flex items-center gap-1.5 text-xs"><input type="radio" name={`permission-${key}`} checked={permissions[key] === "admin"} onChange={() => setPermissions((current) => ({ ...current, [key]: "admin" }))} />Admin</label><label className="flex items-center gap-1.5 text-xs"><input type="radio" name={`permission-${key}`} checked={!permissions[key]} onChange={() => setPermissions((current) => { const next = { ...current }; delete next[key]; return next; })} />ปิด</label></div>)}</div></fieldset>
        <label className="grid gap-1 text-sm">เหตุผลที่แก้ไข<textarea required minLength={3} maxLength={500} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" placeholder="ระบุเหตุผลในการเปลี่ยนข้อมูลหรือสิทธิ์" /></label>
        {error && <p role="alert" className="m-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">ยกเลิก</button><button type="submit" disabled={busy} className="settings-save-button rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "กำลังบันทึก…" : "บันทึกข้อมูลสมาชิก"}</button></div>
      </form>
    </section>
  </div>;
}

function defaultPagesForRole(role: string) {
  if (role === "cook") return Object.fromEntries(["home", "kitchen", "orders", "bills", "tables", "inventory", "stock-deposits"].map((key) => [key, "admin" as const]));
  if (role === "waiter" || role === "staff") return Object.fromEntries(["home", "bills", "tables", "orders", "kitchen", "inventory", "stock-deposits"].map((key) => [key, "admin" as const]));
  return { home: "admin" as const };
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = { owner: "bg-slate-800 text-white", staff: "bg-emerald-100 text-emerald-800", cook: "bg-amber-100 text-amber-800", waiter: "bg-sky-100 text-sky-800" };
  const labels: Record<string, string> = { owner: "เจ้าของร้าน", staff: "พนักงาน", cook: "ครัว", waiter: "เสิร์ฟ" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${styles[role] || "bg-slate-100 text-slate-600"}`}>{labels[role] || role}</span>;
}
