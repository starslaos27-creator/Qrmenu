import { useLanguage } from "../../shared/i18n/LanguageProvider";
import foodImage from "../../assets/star-restaurant/photomenu.jpg";
import papayaImage from "../../assets/star-restaurant/papaya-salad.jpg";
import chefImage from "../../assets/star-restaurant/photochef1.jpg";
import foodGrid from "../../assets/star-restaurant/food-showcase-grid.png";
import pizzaDrinksGrid from "../../assets/star-restaurant/pizza-drinks-grid.png";

export default function FoodShowcase() {
  const { t } = useLanguage();
  return <section id="menu" className="scroll-mt-28 bg-[#fffaf0] px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-6xl">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[#123f2e] text-white shadow-xl">
        <img src={foodImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b281b]/65 via-[#0b281b]/25 to-transparent" />
        <div className="max-w-2xl px-6 py-14 drop-shadow-[0_2px_6px_rgba(0,0,0,.65)] sm:px-10 sm:py-20 lg:px-14">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ffd16a]">Starsmenu</p>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">{t("frontpage.food_showcase.title")}</h1>
          <p className="mt-4 max-w-lg text-base leading-8 text-white/90">{t("frontpage.food_showcase.intro")}</p>
          <a href="#food-highlights" onClick={(event) => { event.preventDefault(); document.getElementById("food-highlights")?.scrollIntoView({ behavior: "smooth" }); }} className="mt-7 inline-flex rounded-full bg-[#f6bd45] px-6 py-3 text-sm font-black text-[#173e2d] transition hover:bg-[#ffd875]">{t("frontpage.food_showcase.explore")}</a>
        </div>
      </div>
      <div id="food-highlights" className="scroll-mt-28 mt-12">
        <h2 className="text-center text-2xl font-black text-[#14543b] sm:text-3xl">{t("frontpage.food_showcase.highlights")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-7 text-[#68766d]">{t("frontpage.food_showcase.description")}</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[{ image: papayaImage, title: "papaya", alt: "papaya_alt" }, { image: foodImage, title: "variety", alt: "variety_alt" }, { image: chefImage, title: "care", alt: "care_alt" }].map((card) => <article key={card.title} className="overflow-hidden rounded-2xl border border-[#e8dfcf] bg-white shadow-sm">
            <img src={card.image} alt={t(`frontpage.food_showcase.${card.alt}`)} className="aspect-[4/3] w-full object-cover" loading="lazy" />
            <div className="p-6"><h3 className="text-xl font-black text-[#14543b]">{t(`frontpage.food_showcase.${card.title}_title`)}</h3><p className="mt-2 text-sm leading-7 text-[#68766d]">{t(`frontpage.food_showcase.${card.title}_text`)}</p></div>
          </article>)}
        </div>
        <div className="mt-12">
          <h2 className="text-center text-2xl font-black text-[#14543b] sm:text-3xl">{t("frontpage.food_showcase.more_title")}</h2>
          <p className="mt-3 text-center text-sm leading-7 text-[#68766d]">{t("frontpage.food_showcase.more_note")}</p>
          <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {["pad_thai", "green_curry", "fried_rice", "mango_rice"].map((key, index) => <article key={key} className="overflow-hidden rounded-2xl border border-[#e8dfcf] bg-white shadow-sm">
              <div role="img" aria-label={t(`frontpage.food_showcase.${key}`)} className="aspect-square w-full bg-no-repeat" style={{ backgroundImage: `url(${foodGrid})`, backgroundSize: "200% 200%", backgroundPosition: `${index % 2 === 0 ? "left" : "right"} ${index < 2 ? "top" : "bottom"}` }} />
              <h3 className="px-5 py-4 text-lg font-black text-[#14543b]">{t(`frontpage.food_showcase.${key}`)}</h3>
            </article>)}
          </div>
        </div>
        <div className="mt-12">
          <h2 className="text-center text-2xl font-black text-[#14543b] sm:text-3xl">{t("frontpage.food_showcase.pizza_drinks_title")}</h2>
          <p className="mt-3 text-center text-sm leading-7 text-[#68766d]">{t("frontpage.food_showcase.more_note")}</p>
          <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {["margherita", "pepperoni", "beer", "spirits"].map((key, index) => <article key={key} className="overflow-hidden rounded-2xl border border-[#e8dfcf] bg-white shadow-sm">
              <div role="img" aria-label={t(`frontpage.food_showcase.${key}`)} className="aspect-square w-full bg-no-repeat" style={{ backgroundImage: `url(${pizzaDrinksGrid})`, backgroundSize: "200% 200%", backgroundPosition: `${index % 2 === 0 ? "left" : "right"} ${index < 2 ? "top" : "bottom"}` }} />
              <h3 className="px-5 py-4 text-lg font-black text-[#14543b]">{t(`frontpage.food_showcase.${key}`)}</h3>
            </article>)}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
