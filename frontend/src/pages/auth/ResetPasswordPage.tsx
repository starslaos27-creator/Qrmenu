import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import AuthFrame from "./AuthFrame";

export default function ResetPasswordPage({ token }: { token: string }) {
  const [email, setEmail] = useState(""); const [valid, setValid] = useState(false); const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiRequest<{ email: string }>(`/api/auth/password-reset/${encodeURIComponent(token)}`, {}, { auth: false }).then((result) => { if (!cancelled) { setEmail(result.email); setValid(true); } }).catch(() => { if (!cancelled) setError("ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว"); }).finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !valid) return; setBusy(true); setError("");
    try { await apiRequest("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword: password }) }, { auth: false }); setSuccess(true); window.setTimeout(() => window.location.assign("/login"), 1200); }
    catch (cause) { setError(cause instanceof ApiError && cause.code === "PASSWORD_TOO_SHORT" ? "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" : "ตั้งรหัสผ่านไม่สำเร็จ ลิงก์อาจหมดอายุแล้ว"); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="ตั้งรหัสผ่านใหม่" subtitle={checking ? "กำลังตรวจสอบลิงก์…" : valid ? `บัญชี ${email}` : "ตรวจสอบลิงก์สำหรับตั้งรหัสผ่าน"}><form onSubmit={submit} className="space-y-4">{valid && <label className="block space-y-1.5 text-sm font-semibold">รหัสผ่านใหม่<input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={input} /></label>}{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">ตั้งรหัสผ่านแล้ว กำลังไปหน้าเข้าสู่ระบบ…</p>}{valid && <button disabled={busy || success} className={primary}>{busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>}{!valid && !checking && <a href="/forgot-password" className="block text-center text-sm text-emerald-800 underline">ขอลิงก์ใหม่</a>}</form></AuthFrame>;
}
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm";
const primary = "w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
