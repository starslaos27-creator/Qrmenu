import { useState, type FormEvent } from "react";
import { ApiError, apiRequest, saveAccessToken } from "../../shared/api/client";
import LanguageControl from "../../shared/i18n/LanguageControl";
import { useLanguage } from "../../shared/i18n/LanguageProvider";
import diningBanner from "../../assets/star-restaurant/qr-dining-banner.png";

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ accessToken: string }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      }, { auth: false });
      saveAccessToken(result.accessToken);
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "INVALID_CREDENTIALS") setError(t("auth.login.invalid"));
      else setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return <main className="relative isolate min-h-screen overflow-hidden bg-[#10291f] px-4 py-8 text-[#173b2d] sm:px-8 sm:py-12">
    <img src={diningBanner} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#092116]/85 via-[#123825]/65 to-[#f5ecdc]/75" />
    <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-6"><LanguageControl inline /></div>
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 sm:min-h-[calc(100vh-6rem)] lg:grid-cols-[1fr_470px] lg:gap-14">
      <section className="hidden max-w-2xl text-white drop-shadow-lg sm:block">
        <a href="/" className="inline-flex items-center gap-3" aria-label="STARS Restaurant home">
          <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-[#ffd16a] bg-[#14543b] text-3xl text-[#ffd16a]">★</span>
          <span className="leading-[0.95]"><strong className="block text-3xl font-black tracking-tight">STARS</strong><small className="mt-1 block font-serif text-base font-bold italic text-[#ffd16a]">Restaurant</small></span>
        </a>
        <p className="mt-10 text-sm font-black uppercase tracking-[0.2em] text-[#ffd16a]">Restaurant management</p>
        <h1 className="mt-3 text-4xl font-black leading-tight lg:text-5xl">จัดการร้านของคุณ<br/><span className="text-[#ffd16a]">ได้ง่ายในที่เดียว</span></h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-white/85">สำหรับเจ้าของร้าน พนักงาน และผู้ดูแลระบบ STARS Restaurant</p>
      </section>

      <section className="mx-auto w-full max-w-[470px] rounded-[28px] border border-white/75 bg-[#fffdf8]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-8">
        <a href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#14543b] sm:hidden"><span className="text-lg text-[#c88b29]">★</span> STARS Restaurant</a>
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[#eaf2ec] text-3xl font-black text-[#14543b] shadow-inner">★</span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-[#14543b]">{t("auth.login.title")}</h2>
          <p className="mt-1 text-sm font-medium text-[#6e786f]">{t("auth.login.subtitle")}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5 text-sm font-bold text-[#315842]">
            {t("auth.field.email")}
            <input required autoComplete="email" type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={input} />
          </label>
          <label className="block space-y-1.5 text-sm font-bold text-[#315842]">
            {t("auth.field.password")}
            <span className="relative block">
              <input required autoComplete="current-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`${input} pr-11`} />
              <button type="button" aria-label={showPassword ? t("password.hide") : t("password.show")} onClick={() => setShowPassword((shown) => !shown)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#68766d]">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
              </button>
            </span>
          </label>
          <div className="flex justify-end"><a className="text-sm font-semibold text-[#14543b] underline-offset-2 hover:underline" href="/forgot-password">{t("auth.login.forgot_password")}</a></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-[#14633f] to-[#0d5035] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(20,99,63,0.24)] transition hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50">{busy ? t("auth.login.submitting") : t("auth.login.submit")}</button>
        </form>
        <p className="mt-6 text-center text-sm text-[#6e786f]">{t("auth.login.no_account")} <a className="font-bold text-[#14543b] hover:underline" href="/signup">{t("auth.signup.title")}</a></p>
      </section>
    </div>
  </main>;
}

const input = "w-full rounded-xl border border-[#d5c4aa] bg-[#edf2fc] px-3.5 py-3 text-sm text-[#18362a] placeholder:text-[#766b5b]/70 shadow-sm transition focus:border-[#56806f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174a34]/10";
