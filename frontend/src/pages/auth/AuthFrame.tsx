import type { ReactNode } from "react";
import diningBanner from "../../assets/star-restaurant/qr-dining-banner.png";
import { useLanguage } from "../../shared/i18n/LanguageProvider";
import LanguageControl from "../../shared/i18n/LanguageControl";

export default function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useLanguage();
  return <main className="relative isolate flex h-dvh items-center justify-center overflow-hidden bg-[#10291f] px-3 py-3 text-[#173b2d] sm:px-8 sm:py-4">
    <img src={diningBanner} alt="" className="fixed inset-0 -z-20 h-full w-full object-cover object-center" />
    <div className="fixed inset-0 -z-10 bg-gradient-to-r from-[#092116]/85 via-[#123825]/65 to-[#f5ecdc]/75" />
    <section className="max-h-full w-full max-w-lg overflow-x-hidden overflow-y-auto overscroll-contain rounded-[28px] border border-white/75 bg-[#fffdf8]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-8">
      <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-5 flex items-center justify-between border-b border-[#e8e1d5] bg-[#fffdf8]/95 px-6 py-3 backdrop-blur-xl sm:-mx-8 sm:-mt-8 sm:px-8">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#14543b]"><span className="text-lg text-[#c88b29]">★</span> Starsmenu</a>
        <div className="flex items-center gap-2">
          <LanguageControl inline />
          <a href="/" aria-label={t("auth.close_back_home")} title={t("auth.close_back_home")} className="grid h-9 w-9 place-items-center rounded-xl border border-[#e5d8c4] bg-white text-xl font-bold leading-none text-[#8c342b] shadow-sm transition hover:bg-[#fff2ef]">×</a>
        </div>
      </div>
      <div className="mb-6 mt-5 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[#eaf2ec] text-2xl font-black text-[#14543b] shadow-inner">★</span><h1 className="mt-3 text-2xl font-black tracking-tight text-[#14543b]">{title}</h1><p className="mt-1 text-sm font-medium text-[#6e786f]">{subtitle}</p></div>
      {children}
    </section>
  </main>;
}
