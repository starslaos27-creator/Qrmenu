import { useState, type FormEvent } from "react";
import { AdminApiError, changeAdminPassword, saveAccessToken, type AdminUser } from "../../shared/adminApi";

type SettingsTab = "account" | "password";

export default function AdminSettingsPage({ user, adminRole, onRequireLogin, onSignOut }: {
  user: AdminUser;
  adminRole: string;
  onRequireLogin: () => void;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changed, setChanged] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    if (newPassword.length < 6) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setBusy(true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      saveAccessToken(null);
      setChanged(true);
    } catch (cause) {
      setError(cause instanceof AdminApiError && cause.status === 401
        ? "รหัสผ่านปัจจุบันไม่ถูกต้อง หรือเซสชันหมดอายุแล้ว"
        : cause instanceof AdminApiError && cause.code === "PASSWORD_TOO_SHORT"
          ? "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร"
          : "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { setBusy(false); }
  }

  if (changed) return <section className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-800" aria-hidden="true">✓</div>
    <h1 className="mt-4 text-2xl font-semibold">เปลี่ยนรหัสผ่านแล้ว</h1>
    <p className="mt-2 text-slate-600">เซสชันเดิมถูกยกเลิกเพื่อความปลอดภัย กรุณาเข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่</p>
    <button className="mt-6 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white" type="button" onClick={onRequireLogin}>ไปหน้าเข้าสู่ระบบ</button>
  </section>;

  return <div className="mx-auto max-w-4xl">
    <header className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">ACCOUNT SETTINGS</p>
      <h1 className="mt-2 text-2xl font-semibold">ตั้งค่า</h1>
      <p className="mt-1 text-sm text-slate-500">จัดการบัญชีและความปลอดภัยของผู้ดูแลแพลตฟอร์ม</p>
    </header>

    <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="flex gap-2 overflow-x-auto md:grid md:content-start" aria-label="เมนูตั้งค่า">
        <button className={tabClass(tab === "account")} type="button" onClick={() => { setTab("account"); setError(""); }}>บัญชีผู้ดูแล</button>
        <button className={tabClass(tab === "password")} type="button" onClick={() => { setTab("password"); setError(""); }}>เปลี่ยนรหัสผ่าน</button>
        <button className="shrink-0 rounded-xl border border-rose-200 px-4 py-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 md:mt-3" type="button" onClick={() => { if (window.confirm("ต้องการออกจากระบบหรือไม่?")) onSignOut(); }}>ออกจากระบบ</button>
      </nav>

      {tab === "account" ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">บัญชีผู้ดูแล</h2>
        <p className="mt-1 text-sm text-slate-500">ข้อมูลบัญชีที่กำลังใช้เข้าสู่ระบบ</p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-slate-500">อีเมล</dt><dd className="mt-1 break-all font-medium">{user.email}</dd></div>
          <div><dt className="text-sm text-slate-500">สิทธิ์</dt><dd className="mt-1 font-medium">{roleName(adminRole)}</dd></div>
        </dl>
      </section> : <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">เปลี่ยนรหัสผ่าน</h2>
          <p className="mt-1 text-sm text-slate-500">เมื่อเปลี่ยนรหัสผ่าน ระบบจะออกจากระบบทุกเซสชันเดิม</p>
        </div>
        <form className="mt-5 grid max-w-xl gap-4" onSubmit={(event) => void submit(event)}>
          <label className="grid gap-1.5 text-sm font-medium">รหัสผ่านปัจจุบัน
            <input className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-800" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">รหัสผ่านใหม่
            <input className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-800" type="password" autoComplete="new-password" minLength={6} maxLength={200} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">ยืนยันรหัสผ่านใหม่
            <input className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-800" type="password" autoComplete="new-password" minLength={6} maxLength={200} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          {error && <p className="m-0 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
          <button className="w-fit rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
        </form>
      </section>}
    </div>
  </div>;
}

function tabClass(active: boolean) {
  return `shrink-0 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${active ? "border-emerald-900 bg-emerald-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
}

function roleName(role: string) {
  if (role === "super_admin") return "ผู้ดูแลสูงสุด";
  if (role === "support") return "ฝ่ายสนับสนุน";
  if (role === "viewer") return "ผู้ดูแลแบบอ่านอย่างเดียว";
  return role;
}
