import { useEffect, useState } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import { loadRestaurantSession } from "../../features/auth/session";
import AuthFrame from "./AuthFrame";

interface InviteInfo { restaurant_name: string; role: string; used_at: string | null; revoked_at: string | null }
const roles: Record<string, string> = { owner: "เจ้าของร้าน", staff: "พนักงาน", waiter: "พนักงานเสิร์ฟ", cook: "ครัว" };

export default function InvitePage({ token }: { token: string }) {
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest<{ invite: InviteInfo }>(`/api/auth/invites/${encodeURIComponent(token)}`, {}, { auth: false }),
      loadRestaurantSession().then((session) => session).catch(() => null),
    ]).then(([inviteResult, session]) => {
      if (cancelled) return;
      setInvite(inviteResult.invite);
      setAuthenticated(!!session);
      setAlreadyMember(session?.membership?.restaurant_id === (inviteResult.invite as InviteInfo & { restaurant_id?: string }).restaurant_id);
    }).catch(() => { if (!cancelled) setError("ลิงก์คำเชิญไม่ถูกต้องหรือหมดอายุแล้ว"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function accept() {
    if (busy) return; setBusy(true); setError("");
    try { await apiRequest("/api/auth/accept-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); window.location.assign("/dashboard"); }
    catch (cause) { setError(cause instanceof ApiError ? inviteError(cause.code) : "เข้าร่วมร้านไม่สำเร็จ"); setBusy(false); }
  }

  return <AuthFrame title="คำเชิญเข้าร่วมร้าน" subtitle="ตรวจสอบรายละเอียดก่อนเข้าร่วมทีม"><div className="space-y-4">{loading ? <p className="text-sm text-slate-500">กำลังตรวจสอบคำเชิญ…</p> : invite && <><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">ร้านอาหาร</p><p className="font-bold">{invite.restaurant_name}</p><p className="mt-3 text-xs text-slate-500">สิทธิ์</p><p className="font-semibold">{roles[invite.role] ?? invite.role}</p></div>{(invite.used_at || invite.revoked_at) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">คำเชิญนี้ถูกใช้หรือถูกยกเลิกแล้ว</p>}{alreadyMember && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">บัญชีนี้เป็นสมาชิกของร้านอยู่แล้ว</p>}{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{!authenticated ? <div className="space-y-3"><a href={`/login?next=${encodeURIComponent(`/join/${token}`)}`} className={primary + " block text-center"}>เข้าสู่ระบบเพื่อรับคำเชิญ</a><a href={`/signup?inviteToken=${encodeURIComponent(token)}`} className={secondary + " block text-center"}>สร้างบัญชีใหม่</a></div> : <button disabled={busy || !!invite.used_at || !!invite.revoked_at || alreadyMember} onClick={() => void accept()} className={primary}>{busy ? "กำลังเข้าร่วม…" : "ยืนยันเข้าร่วมร้าน"}</button>}</>}{error && !invite && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}</div></AuthFrame>;
}

function inviteError(code: string) { return ({ INVALID_INVITE: "ลิงก์คำเชิญไม่ถูกต้อง", INVITE_EXPIRED: "คำเชิญหมดอายุแล้ว", INVITE_REVOKED: "คำเชิญนี้ถูกยกเลิกแล้ว", ALREADY_A_MEMBER: "บัญชีนี้เป็นสมาชิกของร้านอยู่แล้ว", UNAUTHENTICATED: "เข้าสู่ระบบก่อนรับคำเชิญ" } as Record<string, string>)[code] ?? "เข้าร่วมร้านไม่สำเร็จ กรุณาลองใหม่"; }
const primary = "w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700";
