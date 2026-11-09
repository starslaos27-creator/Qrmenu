import { useState, type FormEvent } from "react";
import { bootstrapAdmin } from "../../features/auth/adminAuth";
import { AdminApiError } from "../../shared/adminApi";

export default function AdminBootstrapPage({ onComplete }: { onComplete: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await bootstrapAdmin(email.trim(), password);
      onComplete();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? `สร้างบัญชีไม่สำเร็จ (${cause.code})` : "สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่");
    } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#102f23] p-5 text-slate-900">
      <form className="grid w-full max-w-md gap-5 rounded-3xl bg-white p-7 shadow-2xl sm:p-9" onSubmit={submit}>
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">SHOPQR · FIRST RUN</p><h1 className="mt-3 text-2xl font-semibold">สร้างผู้ดูแลระบบคนแรก</h1><p className="mt-1 text-sm text-slate-500">เปิดได้เฉพาะเครื่อง local และเมื่อยังไม่มีผู้ดูแล</p></div>
        <label className="grid gap-1.5 text-sm font-medium">อีเมล<input className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-800" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm font-medium">รหัสผ่าน<input className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-800" type="password" minLength={4} maxLength={200} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="m-0 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        <button className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={busy}>{busy ? "กำลังสร้างบัญชี…" : "สร้างบัญชีผู้ดูแล"}</button>
      </form>
    </main>
  );
}
