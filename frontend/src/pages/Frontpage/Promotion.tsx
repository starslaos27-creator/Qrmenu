import { useLanguage } from "../../shared/i18n/LanguageProvider";

const icons = ["M3 4h2l2 11h10l3-8H6M9 20h.01M17 20h.01", "M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10", "M4 7h16v12H4zM4 10h16M8 15h3", "M4 20V11h4v9M10 20V6h4v14M16 20V3h4v17", "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7a4 4 0 0 1 0 7m2 10v-2a4 4 0 0 0-3-3.8"];

function Icon({ index }: { index: number }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[index]} /></svg>;
}

export default function Promotion() {
  const { t } = useLanguage();
  return <section id="promotions" className="scroll-mt-28 bg-[#fffaf0] px-4 py-8 sm:px-6 sm:py-12">
    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-gradient-to-br from-[#102a20] via-[#14543b] to-[#267755] text-white shadow-2xl">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#d4b84e]/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#7dc79a]/20 blur-3xl" />
      <div className="relative grid gap-10 px-6 pb-8 pt-10 sm:px-10 lg:grid-cols-[1fr_.9fr] lg:items-center lg:px-14 lg:pt-14">
        <div>
          <p className="inline-block -rotate-2 rounded-lg bg-[#f6bd45] px-5 py-2 text-lg font-black text-[#173e2d] shadow-lg sm:text-2xl"><span className="promotion-color-flash inline-block">{t("frontpage.promo.headline")}</span></p>
          <h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{t("frontpage.promo.new_shop")} <span className="inline-block whitespace-nowrap text-[#ffd34f]">{t("frontpage.promo.new_shop_accent")}</span></h1>
          <div className="mt-6 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[#ffd16a]/45 bg-[#103e2d] px-5 py-3 font-black shadow-[0_8px_24px_rgba(0,0,0,.25)]"><span className="text-xl sm:text-2xl">{t("frontpage.promo.free_trial")}</span><span className="text-4xl text-[#ffe06a] sm:text-5xl">{t("frontpage.promo.duration")}</span></div>
          <p className="mt-3 text-sm text-emerald-100">{t("frontpage.promo.trial_terms")}</p>
          <ul className="mt-7 grid gap-3">{[1, 2, 3].map((item) => <li key={item} className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/95 px-4 py-3 text-[#14543b] shadow-lg"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d9f9e8] font-black text-[#087d50]" aria-hidden="true">✓</span><span className="text-base font-bold">{t(`frontpage.promo.benefit_${item}`)}</span></li>)}</ul>
          <a href="/signup" className="mt-7 inline-flex rounded-xl bg-[#ffd34f] px-6 py-3.5 text-base font-black text-[#173e2d] shadow-lg transition hover:bg-[#ffe17d]">{t("frontpage.promo.signup")}</a>
        </div>
        <div className="relative mx-auto w-full max-w-[480px] rounded-3xl border border-white/25 bg-[#102a20]/75 p-4 shadow-2xl sm:p-6" aria-label={t("frontpage.promo.preview_label")}>
          <div className="flex items-center gap-2 border-b border-white/15 pb-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#ffd34f] font-black text-[#173e2d]">S</span><strong>Starsmenu</strong></div>
          <div className="mt-5 grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((item) => <div key={item} className="rounded-xl border border-white/15 bg-white/10 p-4"><span className="text-[#ffd34f]"><Icon index={item} /></span><p className="mt-3 text-sm font-bold sm:text-base">{t(`frontpage.promo.feature_${item}`)}</p></div>)}</div>
          <div className="mt-4 flex items-end gap-2 rounded-xl bg-white/10 p-4" aria-hidden="true">{[35, 50, 43, 67, 58, 78, 93].map((height, index) => <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-[#5ebf82] to-[#d6f5ba]" style={{ height }} />)}</div>
        </div>
      </div>
      <div className="relative mx-6 mb-8 mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#fffdf8] p-4 text-[#14543b] shadow-lg sm:mx-10 sm:grid-cols-5 lg:mx-14">{icons.map((_, index) => <div key={index} className="flex flex-col items-center gap-2 px-2 py-3 text-center"><Icon index={index} /><span className="text-sm font-bold">{t(`frontpage.promo.feature_${index}`)}</span></div>)}</div>
      <p className="relative px-6 pb-10 text-center text-xl font-black leading-snug sm:px-10 sm:text-2xl">{t("frontpage.promo.closing")}</p>
    </div>
  </section>;
}
