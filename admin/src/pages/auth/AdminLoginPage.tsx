import { useEffect, useState, type FormEvent } from "react";
import {
  adminLogin,
  AdminApiError,
  getAdminPasswordResetInfo,
  requestAdminPasswordReset,
  resetAdminPassword,
} from "../../shared/adminApi";

type View = "login" | "request-reset" | "reset";

export default function AdminLoginPage({ onAuthenticated }: { onAuthenticated: (role: string) => void }) {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset");
    if (!token) return;
    setResetToken(token);
    setView("reset");
    setBusy(true);
    void getAdminPasswordResetInfo(token)
      .then((info) => setEmail(info.email))
      .catch(() => setError("ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่"))
      .finally(() => setBusy(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (view === "login") {
        const session = await adminLogin(email.trim(), password);
        onAuthenticated(session.adminRole);
      } else if (view === "request-reset") {
        await requestAdminPasswordReset(email.trim());
        setNotice("หากอีเมลนี้เป็นบัญชีผู้ดูแล ระบบจะส่งลิงก์กู้รหัสผ่านให้ ลิงก์มีอายุ 30 นาที");
      } else {
        await resetAdminPassword(resetToken, newPassword);
        window.history.replaceState({}, "", window.location.pathname);
        setView("login");
        setPassword("");
        setNewPassword("");
        setNotice("ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่");
      }
    } catch (cause) {
      if (view === "login") {
        setError(cause instanceof AdminApiError && cause.status === 401
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองอีกครั้ง");
      } else if (view === "request-reset" && cause instanceof AdminApiError && cause.status === 503) {
        setError("ระบบส่งอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ");
      } else if (view === "reset" && cause instanceof AdminApiError && cause.code === "PASSWORD_TOO_SHORT") {
        setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      } else {
        setError(view === "reset" ? "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่" : "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    } finally { setBusy(false); }
  }

  const title = view === "login" ? "เข้าสู่ระบบผู้ดูแล" : view === "request-reset" ? "กู้คืนรหัสผ่าน" : "ตั้งรหัสผ่านใหม่";
  return (
    <main className="grid min-h-screen place-items-center bg-[#102f23] p-5 text-slate-900">
      <form className="grid w-full max-w-md gap-5 rounded-3xl bg-white p-7 shadow-2xl sm:p-9" onSubmit={submit}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">SHOPQR · PLATFORM CONTROL</p>
          <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{view === "login" ? "ใช้บัญชีผู้ดูแลแพลตฟอร์ม" : view === "request-reset" ? "กรอกอีเมลบัญชีผู้ดูแลเพื่อรับลิงก์กู้รหัสผ่าน" : "บัญชีผู้ดูแล: " + email}</p>
        </div>

        <label className="grid gap-1.5 text-sm font-medium">อีเมล
          <input className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-800" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={view === "reset"} />
        </label>

        {view === "login" && <label className="grid gap-1.5 text-sm font-medium">รหัสผ่าน
          <input className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-800" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>}

        {view === "reset" && <label className="grid gap-1.5 text-sm font-medium">รหัสผ่านใหม่
          <input className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-800" type="password" autoComplete="new-password" minLength={6} maxLength={200} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>}

        {view === "login" && <button type="button" className="-mt-3 justify-self-end text-sm font-medium text-emerald-800 hover:underline" onClick={() => { setView("request-reset"); setError(""); setNotice(""); }}>ลืมรหัสผ่าน?</button>}
        {error && <p className="m-0 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        {notice && <p className="m-0 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{notice}</p>}
        <button className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={busy || (view === "reset" && !resetToken)}>
          {busy ? "กำลังดำเนินการ…" : view === "login" ? "เข้าสู่ระบบ" : view === "request-reset" ? "ส่งลิงก์กู้รหัสผ่าน" : "บันทึกรหัสผ่านใหม่"}
        </button>
        {view !== "login" && <button type="button" className="text-sm text-slate-600 hover:underline" onClick={() => { setView("login"); setError(""); setNotice(""); if (view === "reset") window.history.replaceState({}, "", window.location.pathname); }}>กลับไปเข้าสู่ระบบ</button>}
      </form>
    </main>
  );
}
