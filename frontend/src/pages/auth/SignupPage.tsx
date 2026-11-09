import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiRequest, saveAccessToken } from "../../shared/api/client";
import AuthFrame from "./AuthFrame";

type CurrencyCode = "LAK" | "THB" | "USD";

export default function SignupPage() {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("inviteToken") ?? "";
  const [restaurantName, setRestaurantName] = useState("");
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>("LAK");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ accessToken: string }>("/api/auth/signup", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          email: email.trim(), password, phone: phone.trim() || null,
          restaurantName: inviteToken ? undefined : restaurantName.trim(),
          currencyCode: inviteToken ? undefined : currencyCode,
          inviteToken: inviteToken || undefined,
        }),
      }, { auth: false });
      saveAccessToken(result.accessToken);
      window.location.assign("/dashboard");
    } catch (cause) {
      setError(cause instanceof ApiError && cause.code === "ACCOUNT_EXISTS"
        ? "อีเมลนี้มีบัญชีอยู่แล้ว"
        : cause instanceof ApiError && cause.code === "PASSWORD_TOO_SHORT"
          ? "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
          : "สมัครสมาชิกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return <AuthFrame title={inviteToken ? "สร้างบัญชีเพื่อเข้าร่วมร้าน" : "เปิดร้านใหม่"} subtitle={inviteToken ? "สร้างบัญชีเพื่อรับคำเชิญเข้าร่วมทีม" : "สมัครสมาชิกและเริ่มจัดการร้านอาหาร"}>
    <form onSubmit={submit} className="space-y-4">
      {!inviteToken && <>
        <Field label="ชื่อร้าน"><input required maxLength={200} value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} className={input} /></Field>
        <Field label="สกุลเงินหลักของร้าน"><select value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value as CurrencyCode)} className={input}>
          <option value="LAK">LAK — ກີບ</option>
          <option value="THB">THB — บาทไทย</option>
          <option value="USD">USD — ดอลลาร์สหรัฐ</option>
        </select><span className="block text-xs font-normal text-slate-500">เลือกสกุลเงินหลักสำหรับร้านใหม่นี้</span></Field>
      </>}
      <Field label="อีเมล"><input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={input} /></Field>
      <Field label="เบอร์โทร (ไม่บังคับ)"><input autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={input} /></Field>
      <Field label="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"><input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={input} /></Field>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <button disabled={busy} className={primary}>{busy ? "กำลังสมัคร…" : "สมัครสมาชิก"}</button>
      <p className="text-center text-sm">มีบัญชีแล้ว? <a className="text-emerald-800 underline" href={inviteToken ? `/login?next=${encodeURIComponent(`/join/${inviteToken}`)}` : "/login"}>เข้าสู่ระบบ</a></p>
    </form>
  </AuthFrame>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-semibold text-slate-700">{label}{children}</label>; }
const jsonHeaders = { "Content-Type": "application/json" };
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm";
const primary = "w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
