import { useState, type FormEvent } from "react";
import { ApiError, apiRequest, saveAccessToken } from "../../shared/api/client";
import { useLanguage } from "../../shared/i18n/LanguageProvider";

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
      if (cause instanceof ApiError && cause.code === "INVALID_CREDENTIALS") {
        setError(t("auth.login.invalid"));
      } else if (cause instanceof ApiError && cause.status >= 500) {
        setError(t("common.error"));
      } else {
        setError(t("common.error"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#efe7d8] px-4 py-8 text-[#174a34] sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center sm:min-h-[calc(100vh-6rem)]">
        <div className="relative mb-5 flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-[#174a34]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#174a34] text-xs font-bold text-[#fff8e8]">Q</span>
            QR Menu
          </a>
        </div>
        <section className="rounded-2xl border border-[#d5c4aa] bg-[#fff8e8] p-5 shadow-[0_1px_2px_rgba(92,68,35,0.14),0_8px_20px_rgba(92,68,35,0.08)]">
          <h1 className="text-xl font-semibold tracking-tight">{t("auth.login.title")}</h1>
          <p className="mt-1 text-sm text-[#766b5b]">{t("auth.login.subtitle")}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block space-y-1.5 text-sm font-semibold text-[#174a34]/70">
              {t("auth.field.email")}
              <input required autoComplete="email" type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={input} />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-[#174a34]/70">
              {t("auth.field.password")}
              <span className="relative block">
                <input required autoComplete="current-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`${input} pr-11`} />
                <button type="button" aria-label={showPassword ? t("password.hide") : t("password.show")} onClick={() => setShowPassword((shown) => !shown)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#766b5b]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                </button>
              </span>
            </label>
            <div className="flex justify-end">
              <a className="text-sm text-[#174a34] underline-offset-2 hover:underline" href="/forgot-password">{t("auth.login.forgot_password")}</a>
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#174a34] px-4 py-2.5 text-sm font-medium text-[#fff8e8] shadow-[0_2px_6px_rgba(23,74,52,0.2)] transition hover:bg-[#1f5a40] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">{busy ? t("auth.login.submitting") : t("auth.login.submit")}</button>
          </form>
        </section>
        <p className="mt-6 text-center text-sm text-[#766b5b]">{t("auth.login.no_account")} <a className="font-medium text-[#174a34] hover:underline" href="/signup">{t("auth.signup.title")}</a></p>
      </div>
    </main>
  );
}

const input = "w-full rounded-xl border border-[#d5c4aa] bg-[#fffdf6] px-3.5 py-2.5 text-sm text-[#174a34] placeholder:text-[#766b5b]/70 shadow-sm transition focus:border-[#56806f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174a34]/10";
