import { useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";

interface Member {
  id: string;
  user_id: string;
  role: string;
  invited_email: string | null;
  email?: string;
  phone: string | null;
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

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header><h2 className="text-lg font-semibold">ทีมงานร้าน</h2><p className="mt-1 text-sm text-slate-500">จัดการสมาชิกและสร้างลิงก์สำหรับเชิญพนักงาน</p></header>
    {canManage && <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void createInvite("cook")} disabled={creating !== null} className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{creating === "cook" ? "กำลังสร้าง…" : "เชิญพนักงานครัว"}</button><button type="button" onClick={() => void createInvite("waiter")} disabled={creating !== null} className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{creating === "waiter" ? "กำลังสร้าง…" : "เชิญพนักงานเสิร์ฟ"}</button></div>}
    {activeInvites.length > 0 && <div className="space-y-2 border-t border-slate-100 pt-4"><h3 className="m-0 text-sm font-semibold">ลิงก์เชิญที่ยังใช้ได้ ({activeInvites.length})</h3><ul className="space-y-2">{activeInvites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${invite.role === "cook" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>{invite.role === "cook" ? "ครัว" : "เสิร์ฟ"}</span><code className="min-w-0 flex-1 truncate text-xs text-slate-500">{`${window.location.origin}/join/${invite.token}`}</code><button type="button" onClick={() => void copyLink(invite.token)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">{copied === invite.token ? "คัดลอกแล้ว" : "คัดลอก"}</button>{canManage && <button type="button" onClick={() => void revokeInvite(invite)} className="rounded-lg px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50">ยกเลิก</button>}</li>)}</ul></div>}
    <div className="border-t border-slate-100 pt-4"><h3 className="m-0 text-sm font-semibold">สมาชิก ({members.length})</h3>{members.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีสมาชิก</p> : <ul className="mt-2 space-y-2">{members.map((member) => <li key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{member.invited_email || member.email || member.user_id}</span><RoleBadge role={member.role} /></div>{member.phone && <a className="mt-0.5 block text-xs text-slate-500" href={`tel:${member.phone}`}>{member.phone}</a>}</div>{canManage && member.role !== "owner" && member.user_id !== currentUserId && <button type="button" onClick={() => void removeMember(member)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700">นำออก</button>}</li>)}</ul>}</div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="break-all rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  </section>;
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = { owner: "bg-slate-800 text-white", staff: "bg-emerald-100 text-emerald-800", cook: "bg-amber-100 text-amber-800", waiter: "bg-sky-100 text-sky-800" };
  const labels: Record<string, string> = { owner: "เจ้าของร้าน", staff: "พนักงาน", cook: "ครัว", waiter: "เสิร์ฟ" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${styles[role] || "bg-slate-100 text-slate-600"}`}>{labels[role] || role}</span>;
}
