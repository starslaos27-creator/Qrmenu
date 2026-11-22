import { useState } from "react";
import { useLanguage } from "../../shared/i18n/LanguageProvider";
import visionImage from "../../assets/Photostarsmenu1.jpg";
import menuImage from "../../assets/star-restaurant/photomenu.jpg";
import chefImage from "../../assets/star-restaurant/photochef1.jpg";
import orderingImage from "../../assets/star-restaurant/Photoseat2pax.jpg";

export function AboutMenu() {
  const { t } = useLanguage();
  const [aboutOpen, setAboutOpen] = useState(false);
  return <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAboutOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { setAboutOpen(false); event.currentTarget.querySelector("button")?.focus(); } }}>
    <button type="button" aria-expanded={aboutOpen} aria-controls="about-menu" onClick={() => setAboutOpen((open) => !open)} className="whitespace-nowrap hover:text-[#ffd16a]">◈ &nbsp;{t("frontpage.nav.about")} <span aria-hidden="true">⌄</span></button>
    {aboutOpen && <div id="about-menu" className="absolute left-0 top-full z-40 mt-2 min-w-52 rounded-xl border border-[#e7dcc7] bg-[#fffdf8] p-2 text-[#43584b] shadow-lg">
      <a href="#vision" onClick={() => setAboutOpen(false)} className="block whitespace-nowrap rounded-lg px-3 py-2.5 hover:bg-[#f2ebdf] hover:text-[#14543b]">{t("frontpage.about.vision")}</a>
      <a href="#management" onClick={() => setAboutOpen(false)} className="block whitespace-nowrap rounded-lg px-3 py-2.5 hover:bg-[#f2ebdf] hover:text-[#14543b]">{t("frontpage.about.development_team")}</a>
    </div>}
  </div>;
}

export default function AboutUs({ isVision, isManagement }: { isVision: boolean; isManagement: boolean }) {
  const { t } = useLanguage();
  return <section id="about" className="scroll-mt-24 bg-white px-5 py-14 sm:px-8 lg:py-16">
    <div className="mx-auto max-w-5xl">
      {!isManagement && <div id="vision" className="scroll-mt-36">
        <h2 className="mb-6 text-center text-3xl font-black text-[#14543b]">{t("frontpage.about.page_heading")}</h2>
        <article className="overflow-hidden rounded-2xl shadow-lg">
          <div className="relative isolate overflow-hidden bg-[#173e2d] text-white" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,25,13,.96), rgba(8,35,20,.85) 55%, rgba(8,35,20,.50)), url(${visionImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <svg aria-hidden="true" viewBox="0 0 110 160" className="pointer-events-none absolute -left-6 bottom-0 h-36 w-28 text-[#8ab33a]/70 sm:h-48"><path fill="currentColor" d="M11 158C18 105 40 51 96 9 68 74 50 119 11 158Z"/><path fill="none" stroke="#d0db68" strokeWidth="2" d="M13 156C32 101 59 52 96 9"/></svg>
            <div className="relative grid gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:gap-10">
              <div>
                <p className="font-serif text-2xl italic text-[#ffd16a] sm:text-3xl">Welcome to</p>
                <p className="mt-1 text-5xl font-black tracking-tight sm:text-7xl">Stars<span className="text-[#ffc84c]">menu</span></p>
                <p className="mt-4 text-xl font-black leading-snug sm:text-2xl">{t("frontpage.about.vision_tagline")}</p>
                <p className="mt-3 max-w-xl text-sm leading-7 text-white/90 sm:text-base">{t("frontpage.about.vision_description")}</p>
                <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(["flavor", "safety", "service", "qr"] as const).map((key, index) => <div key={key} className="text-center">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-[#f6bd45] bg-[#14543b] text-[#ffd16a]" aria-hidden="true"><FeatureIcon index={index} /></span>
                    <p className="mt-2 text-xs font-bold leading-5 sm:text-sm">{t(`frontpage.about.feature_${key}`)}</p>
                  </div>)}
                </div>
                <a href="#menu" className="mt-7 inline-flex rounded-full bg-[#f6bd45] px-6 py-3 text-sm font-black text-[#193c2c] shadow-lg transition hover:bg-[#ffd36b]">{t("frontpage.about.view_menu")} <span className="ml-3" aria-hidden="true">→</span></a>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[#ffd16a]/50 bg-[#102a20]/90 shadow-xl">
                <img src={menuImage} alt={t("frontpage.about.feature_flavor")} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <div className="flex items-center gap-4 p-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#f6bd45] text-[#ffd16a]" aria-hidden="true"><FeatureIcon index={3} /></span><p className="text-sm font-bold leading-6 text-white">{t("frontpage.about.feature_qr")}</p></div>
              </div>
            </div>
            <div className="grid gap-4 border-t border-[#f6bd45]/60 bg-[#082c19]/95 px-6 py-6 text-center sm:grid-cols-3 sm:divide-x sm:divide-[#f6bd45]/40 sm:px-10">
              {(["flavor", "safety", "service"] as const).map((key) => <p key={key} className="px-3 text-sm font-bold text-[#fff8e7]">{t(`frontpage.about.feature_${key}`)}</p>)}
            </div>
          </div>
        </article>
        <section className="mt-10 grid items-center gap-7 rounded-2xl border border-[#e8dfcf] bg-[#fffaf0] p-6 sm:p-10 md:grid-cols-2">
          <div>
            <h3 className="text-2xl font-black text-[#14543b]">{t("frontpage.about.history_title")}</h3>
            <p className="mt-4 text-base leading-8 text-[#43584b]">{t("frontpage.about.history_text")}</p>
          </div>
          <img src={chefImage} alt="" className="aspect-[3/2] w-full rounded-xl object-cover" loading="lazy" />
        </section>
        <section className="mt-6 grid items-center gap-7 rounded-2xl border border-[#e8dfcf] bg-[#fffaf0] p-6 sm:p-10 md:grid-cols-2">
          <div>
            <h3 className="text-2xl font-black text-[#14543b]">{t("frontpage.about.vision_section_title")}</h3>
            <p className="mt-4 text-base leading-8 text-[#43584b]">{t("frontpage.about.vision_section_text")}</p>
          </div>
          <img src={menuImage} alt="" className="aspect-[3/2] w-full rounded-xl object-cover" loading="lazy" />
        </section>
        <section className="mt-6 rounded-2xl border border-[#e8dfcf] bg-[#fffaf0] p-6 sm:p-10">
          <h3 className="text-2xl font-black text-[#14543b]">{t("frontpage.about.why_title")}</h3>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4, 5].map((item) => <li key={item} className="flex items-start gap-3 text-base leading-7 text-[#43584b]"><span className="font-bold text-[#b27625]" aria-hidden="true">✓</span><span>{t(`frontpage.about.why_${item}`)}</span></li>)}
          </ul>
        </section>
        <section className="mt-6 grid items-center gap-7 rounded-2xl border border-[#e8dfcf] bg-[#fffaf0] p-6 sm:p-10 md:grid-cols-2">
          <div>
            <h3 className="text-2xl font-black text-[#14543b]">{t("frontpage.about.ordering_title")}</h3>
            <p className="mt-4 text-base leading-8 text-[#43584b]">{t("frontpage.about.ordering_text")}</p>
          </div>
          <img src={orderingImage} alt="" className="aspect-[3/2] w-full rounded-xl object-cover" loading="lazy" />
        </section>
      </div>}
      {!isVision && <div id="management" className="scroll-mt-36 mt-10 text-center"><h2 className="text-xl font-bold text-[#14543b]">{t("frontpage.about.management")}</h2></div>}
    </div>
  </section>;
}

function FeatureIcon({ index }: { index: number }) {
  const paths = [
    <><path d="M5 3v7M8 3v7M5 7h3M6.5 10v11M15 3c-2 2-3 6-2 9h3v9M16 3v9" /></>,
    <><path d="M12 3 4.5 6v5c0 5 3 8 7.5 10 4.5-2 7.5-5 7.5-10V6L12 3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    <path d="M20 8.5c0 4-4.5 7.5-8 10C8.5 16 4 12.5 4 8.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8Z" />,
    <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM6 6h1M17 6h1M6 17h1M14 14h2v2h-2zM18 14h3M18 17v4M14 20h2" /></>,
  ];
  return <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[index]}</svg>;
}
