import { useEffect, useState } from "react";
import LanguageControl from "../../shared/i18n/LanguageControl";
import { useLanguage } from "../../shared/i18n/LanguageProvider";
import diningBanner from "../../assets/star-restaurant/qr-dining-banner.png";
import papayaSalad from "../../assets/star-restaurant/papaya-salad.jpg";
import AboutUs, { AboutMenu } from "./AboutUs";
import Teammanage from "./Teammanage";
import ContactUs from "./ContactUs";
import Promotion from "./Promotion";
import FoodShowcase from "./FoodShowcase";

export default function Home() {
  const { t } = useLanguage();
  const [currentHash, setCurrentHash] = useState(() => window.location.hash);
  const isVision = currentHash === "#vision";

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    if (!currentHash) return;
    const frame = requestAnimationFrame(() => document.getElementById(currentHash.slice(1))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [currentHash]);
  const text = {
    homeAria: t("frontpage.brand.home_aria"), navAria: t("frontpage.nav.aria"), tagline: t("frontpage.tagline"),
    home: t("frontpage.nav.home"), menu: t("frontpage.nav.menu"), promotions: t("frontpage.nav.promotions"),
    contact: t("frontpage.nav.contact"), login: t("frontpage.nav.login"), openRestaurant: t("frontpage.nav.open_restaurant"),
    badge: t("frontpage.hero.badge"), headline: t("frontpage.hero.headline"), headlineAccent: t("frontpage.hero.headline_accent"),
    intro: t("frontpage.hero.intro"), explore: t("frontpage.hero.explore"), qualityFresh: t("frontpage.hero.quality_fresh"),
    qualityIngredients: t("frontpage.hero.quality_ingredients"), qualityQr: t("frontpage.hero.quality_qr"),
    offerTag: t("frontpage.offer.tag"), offerTitle: t("frontpage.offer.title"), offerDescription: t("frontpage.offer.description"), offerButton: t("frontpage.offer.button"),
    menuTitle: t("frontpage.menu.title"), menuDescription: t("frontpage.menu.description"),
    dishes: [t("frontpage.menu.dish.0"), t("frontpage.menu.dish.1"), t("frontpage.menu.dish.2")], menuLabel: t("frontpage.menu.label"),
    recommendationLabel: t("frontpage.recommendation.label"), papayaAlt: t("frontpage.image.papaya_alt"),
    stepsTitle: t("frontpage.steps.title"), steps: [t("frontpage.steps.step.0"), t("frontpage.steps.step.1"), t("frontpage.steps.step.2")],
    contactText: t("frontpage.contact.text"),
  };

  return <main className="min-h-screen scroll-smooth bg-[#fffaf0] text-[#173b2d]">
    <header className="sticky top-0 z-30 border-b border-[#194b36] bg-[#0b3023]/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3 sm:px-8">
        <a href="#home" className="flex shrink-0 items-center gap-3" aria-label={text.homeAria}>
          <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#e3b84f] bg-[#14543b] text-2xl text-[#ffd15d] shadow-md">★</span>
          <strong className="text-[23px] font-black tracking-tight text-white">Starsmenu</strong>
        </a>
        <nav className="order-3 flex w-full flex-wrap items-center gap-5 text-xs font-bold text-white sm:order-none sm:w-auto sm:flex-1 sm:justify-center sm:gap-5 lg:gap-8 lg:text-sm" aria-label={text.navAria}>
          <a className="whitespace-nowrap hover:text-[#ffd16a]" href="#home">⌂ &nbsp;{text.home}</a>
          <a className="whitespace-nowrap hover:text-[#ffd16a]" href="#menu">♜ &nbsp;{text.menu}</a>
          <a className="whitespace-nowrap hover:text-[#ffd16a]" href="#promotions">✦ &nbsp;{text.promotions}</a>
          <AboutMenu />
          <a className="whitespace-nowrap hover:text-[#ffd16a]" href="#contact">☎ &nbsp;{text.contact}</a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageControl inline />
          <a href="/login" className="whitespace-nowrap rounded-full border border-white/50 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-white/10">{text.login}</a>
          <a href="/signup" className="whitespace-nowrap rounded-xl bg-[#ffd16a] px-4 py-2.5 text-sm font-extrabold text-[#173e2d] shadow-sm transition hover:bg-[#ffe39d] sm:px-5">{text.openRestaurant}</a>
        </div>
      </div>
    </header>

    {!isVision && currentHash !== "#management" && currentHash !== "#contact" && currentHash !== "#promotions" && currentHash !== "#menu" && <section id="home" className="relative isolate flex min-h-[690px] items-center overflow-hidden bg-[#18372a] px-5 py-14 text-white sm:px-8 lg:min-h-[calc(100svh-76px)] lg:py-16">
      <img src={diningBanner} alt={t("frontpage.image.dining_alt")} className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#071d14]/90 via-[#102a1e]/65 to-[#102a1e]/15" />
      <div className="mx-auto grid w-full max-w-[1440px] items-center gap-10 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
        <div className="max-w-[650px] py-7 lg:pl-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#ffd66b]/40 bg-[#133c2c]/75 px-4 py-2 text-xs font-extrabold text-[#ffdb7b] shadow-lg backdrop-blur"><span className="h-2 w-2 rounded-full bg-[#f8bd42]" />{text.badge}</p>
          <h1 className="mt-6 text-[clamp(3.1rem,6.1vw,5.8rem)] font-black leading-[1.02] tracking-[-0.045em] drop-shadow-[0_4px_16px_rgba(0,0,0,.4)]"><span className="block">{text.headline}</span><span className="mt-2 block text-[#ffc84c]">{text.headlineAccent}</span></h1>
          <p className="mt-6 max-w-xl text-base font-medium leading-8 text-white/90 drop-shadow sm:text-lg">{text.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#menu" className="rounded-full bg-[#f6bd45] px-6 py-3.5 text-sm font-black text-[#193c2c] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#ffd36b]">{text.explore} <span aria-hidden="true">→</span></a>
            <a href="#promotions" className="rounded-full border border-white/60 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">{text.promotions}</a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-white/85 sm:text-sm"><span>✓ {text.qualityFresh}</span><span>✓ {text.qualityIngredients}</span><span>✓ {text.qualityQr}</span></div>
        </div>
        <div className="relative mx-auto w-full max-w-[470px] lg:mr-8">
          <div className="absolute -right-4 -top-5 z-10 rounded-2xl bg-[#e3432e] px-4 py-2 text-sm font-black text-white shadow-xl shadow-black/20 sm:-right-7 sm:-top-6 sm:px-5 sm:py-3">{text.offerTag}<span className="ml-2 text-[#ffe18b]">★</span></div>
          <div className="overflow-hidden rounded-[30px] border border-white/70 bg-[#fffaf0] p-3 shadow-[0_28px_80px_rgba(0,0,0,.4)] sm:p-4">
            <img src={papayaSalad} alt={text.papayaAlt} className="h-[280px] w-full rounded-[22px] object-cover sm:h-[330px]" />
            <div className="flex items-end justify-between gap-4 px-2 pb-2 pt-4 text-[#173b2d]">
              <div><span className="text-xs font-extrabold uppercase tracking-widest text-[#ad7223]">{text.recommendationLabel}</span><h2 className="mt-1 text-xl font-black sm:text-2xl">{text.dishes[0]}</h2><p className="mt-1 text-xs text-[#68766d]">{text.offerDescription}</p></div>
              <a href="#promotions" aria-label={text.offerButton} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#14543b] text-xl font-black text-white shadow-lg transition hover:scale-105">→</a>
            </div>
          </div>
          <span className="absolute -bottom-5 -left-5 rounded-2xl bg-[#f6bd45] px-4 py-2 text-xs font-black text-[#193c2c] shadow-xl">{text.tagline}</span>
        </div>
      </div>
    </section>}

    {!isVision && currentHash !== "#management" && currentHash !== "#contact" && currentHash !== "#promotions" && currentHash !== "#menu" && <>
    <section className="bg-[#f2ebdf] px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl"><h2 className="text-center text-3xl font-black text-[#14543b] sm:text-4xl">{text.stepsTitle}</h2><div className="mt-9 grid gap-4 md:grid-cols-3">{text.steps.map((step, i) => <article key={step} className="rounded-2xl border border-[#e4dac8] bg-white p-6 text-center shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#14543b] text-lg font-black text-[#ffd16a]">{i + 1}</span><p className="mt-4 text-sm font-bold text-[#254737]">{step}</p></article>)}</div></div>
    </section>

    </>}
    {currentHash === "#management" ? <Teammanage /> : isVision && <AboutUs isVision isManagement={false} />}
    {currentHash === "#menu" && <FoodShowcase />}
    {currentHash === "#promotions" && <Promotion />}
    {currentHash === "#contact" && <ContactUs />}
    <footer className="bg-[#102a20] px-5 py-8 text-white sm:px-8"><div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-lg font-black">Starsmenu</strong><p className="mt-1 text-sm text-white/70">{text.contactText}</p></div><a href="/login" className="inline-flex w-fit rounded-full border border-[#ffd16a]/60 px-5 py-2.5 text-sm font-bold text-[#ffd16a] transition hover:bg-[#ffd16a] hover:text-[#173e2d]">{text.login} →</a></div></footer>
  </main>;
}
