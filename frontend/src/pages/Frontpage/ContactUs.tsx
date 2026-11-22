import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { useLanguage } from "../../shared/i18n/LanguageProvider";
import { apiRequest } from "../../shared/api/client";

const whatsappUrl = "https://wa.me/8562029900579";

export default function ContactUs() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [whatsappQr, setWhatsappQr] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(whatsappUrl, { width: 160, margin: 2, errorCorrectionLevel: "M" }).then((url) => { if (active) setWhatsappQr(url); }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const data = Object.fromEntries(["name", "email", "subject", "message"].map((key) => [key, String(form.get(key) || "").trim()]));
    if (Object.values(data).some((value) => !value)) { setStatus("error"); return; }
    setBusy(true); setStatus(null);
    try {
      await apiRequest("/api/public/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }, { auth: false });
      element.reset(); setStatus("success");
    } catch { setStatus("error"); }
    finally { setBusy(false); }
  }
  const inputClass = "w-full rounded-xl border border-[#d8dfd6] bg-white px-4 py-3 text-[#173b2d] outline-none focus:border-[#14543b] focus:ring-2 focus:ring-[#14543b]/20";
  return <section id="contact" className="scroll-mt-28 bg-[#fffaf0] px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-2xl">
      <h1 className="text-center text-3xl font-black text-[#14543b] sm:text-4xl">{t("frontpage.contact.form_title")}</h1>
      <p className="mt-3 text-center text-sm leading-7 text-[#68766d]">{t("frontpage.contact.form_intro")}</p>
      <form onSubmit={submitMessage} className="mt-8 grid gap-5 rounded-2xl border border-[#e8dfcf] bg-white p-6 shadow-sm sm:p-8">
        <label className="grid gap-2 text-sm font-bold text-[#254737]">{t("frontpage.contact.name")}<input name="name" autoComplete="name" maxLength={100} required className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-[#254737]">{t("frontpage.contact.email")}<input name="email" type="email" autoComplete="email" maxLength={254} required className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-[#254737]">{t("frontpage.contact.subject")}<input name="subject" maxLength={150} required className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-[#254737]">{t("frontpage.contact.message")}<textarea name="message" rows={6} maxLength={5000} required className={inputClass} /></label>
        {status && <p role={status === "error" ? "alert" : "status"} className={status === "error" ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{t(`frontpage.contact.${status}`)}</p>}
        <button type="submit" disabled={busy} className="rounded-xl bg-[#14543b] px-6 py-3 font-bold text-white transition hover:bg-[#103e2d] disabled:opacity-50">{t(busy ? "frontpage.contact.sending" : "frontpage.contact.send")}</button>
      </form>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-[#cbe7d4] bg-white px-6 py-4 text-[#14543b] shadow-sm transition hover:border-[#25d366] hover:bg-[#f3fcf6]">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#25d366] text-white" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M20.52 3.48A11.88 11.88 0 0 0 12.03 0C5.42 0 .04 5.37.04 11.98c0 2.11.55 4.16 1.6 5.97L0 24l6.2-1.63a11.95 11.95 0 0 0 5.83 1.48h.01c6.61 0 11.99-5.37 11.99-11.98 0-3.2-1.25-6.21-3.51-8.39ZM12.04 21.83a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.68.97.98-3.58-.23-.37a9.91 9.91 0 0 1-1.53-5.28c0-5.45 4.43-9.89 9.88-9.89a9.82 9.82 0 0 1 6.99 2.9 9.83 9.83 0 0 1 2.9 6.99c0 5.46-4.44 9.9-9.9 9.9Zm5.42-7.41c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.29-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.29-.02-.45.13-.6.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.66-1.6-.9-2.19-.24-.58-.49-.5-.66-.51h-.56c-.2 0-.52.08-.79.37-.27.3-1.03 1.01-1.03 2.46s1.06 2.84 1.21 3.04c.15.2 2.09 3.2 5.06 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.88.12.57-.09 1.75-.72 2-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.19-.56-.34Z" /></svg>
        </span>
        <span><strong className="block text-base">WhatsApp</strong><span className="mt-1 block text-sm">+856(20)29900579</span></span>
        {whatsappQr && <span className="ml-auto flex items-center gap-3"><span className="max-w-28 text-right text-xs font-bold leading-5">{t("frontpage.contact.scan_whatsapp")}</span><img src={whatsappQr} alt={t("frontpage.contact.whatsapp_qr_alt")} className="h-20 w-20 rounded-md" /></span>}
      </a>
    </div>
  </section>;
}
