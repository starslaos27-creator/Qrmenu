import { useState, type FormEvent } from "react";
import { ApiError, apiRequest, clearAccessToken } from "../../shared/api/client";

export default function ChangePasswordForm({ email, onLogin }: { email: string; onLogin: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 6) return setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
    if (newPassword !== confirmation) return setError("รหัสผ่านใหม่ไม่ตรงกัน");
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      clearAccessToken();
      onLogin();
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401 ? "รหัสผ่านปัจจุบันไม่ถูกต้อง" : cause instanceof ApiError ? `เปลี่ยนรหัสผ่านไม่สำเร็จ (${cause.code})` : "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} className="w-full max-w-xs space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <header><h2 className="text-lg font-semibold">เปลี่ยนรหัสผ่าน</h2><p className="mt-1 text-sm text-slate-500">บัญชี {email} · เมื่อบันทึกแล้ว ระบบจะให้ออกจากระบบเพื่อเข้าสู่ระบบอีกครั้ง</p></header>
    <label className="grid gap-1.5 text-sm font-medium">รหัสผ่านปัจจุบัน<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} /></label>
    <div className="grid gap-3"><label className="grid gap-1.5 text-sm font-medium">รหัสผ่านใหม่<input type="password" autoComplete="new-password" minLength={6} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} /></label><label className="grid gap-1.5 text-sm font-medium">ยืนยันรหัสผ่านใหม่<input type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} /></label></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button disabled={saving} className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{saving ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}</button>
  </form>;
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
