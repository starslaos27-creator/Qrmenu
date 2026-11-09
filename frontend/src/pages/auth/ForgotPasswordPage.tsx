import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import AuthFrame from "./AuthFrame";

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    try { await apiRequest("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.replace(/\D/g, "") }) }, { auth: false }); setMessage("หากข้อมูลตรงกับบัญชี จะได้รับคำแนะนำสำหรับตั้งรหัสผ่านใหม่"); }
    catch (cause) { setError(cause instanceof ApiError && cause.code === "PASSWORD_RESET_NOT_CONFIGURED" ? "ระบบรีเซ็ตรหัสผ่านยังไม่ได้เชื่อมต่อผู้ให้บริการอีเมลหรือ OTP กรุณาติดต่อผู้ดูแลระบบ" : "ส่งคำขอไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="ลืมรหัสผ่าน" subtitle="กรอกเบอร์โทรศัพท์ที่ลงทะเบียนไว้"><form onSubmit={submit} className="space-y-4"><label className="block space-y-1.5 text-sm font-semibold">เบอร์โทร<input required minLength={8} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" className={input} /></label>{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}<button disabled={busy} className={primary}>{busy ? "กำลังส่ง…" : "ขอตั้งรหัสผ่านใหม่"}</button><a className="block text-center text-sm text-emerald-800 underline" href="/login">กลับเข้าสู่ระบบ</a></form></AuthFrame>;
}
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm";
const primary = "w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
