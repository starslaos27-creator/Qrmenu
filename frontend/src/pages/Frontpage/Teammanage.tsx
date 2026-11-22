import { useLanguage } from "../../shared/i18n/LanguageProvider";
import ceoImage from "../../assets/star-restaurant/SONE.png";

export default function Teammanage() {
  const { t } = useLanguage();
  return <section id="management" className="scroll-mt-28 bg-[#fffaf0] px-5 pb-14 pt-6 sm:px-8 lg:pb-16 lg:pt-8">
    <div className="mx-auto max-w-5xl">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-2xl font-black text-[#14543b]">{t("frontpage.management.team_title")}</h1>
        <p className="mt-4 text-left text-base leading-8 text-[#43584b]">{t("frontpage.management.intro")}</p>
      </div>
      <section className="mt-8 rounded-2xl border border-[#e8dfcf] bg-white p-6 shadow-sm sm:p-8">
        <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="mx-auto w-full max-w-[364px]">
            <img src={ceoImage} alt="" className="w-full rounded-xl object-cover" />
            <h2 className="mt-4 text-center text-2xl font-black text-[#14543b]">Resno CHANG</h2>
          </div>
          <div>
            <p className="text-lg font-bold text-[#14543b]">{t("frontpage.management.ceo_title")}</p>
            <h3 className="mt-6 text-2xl font-black text-[#14543b]">{t("frontpage.management.responsibilities")}</h3>
            <ul className="mt-5 space-y-4 text-base leading-8 text-[#43584b]">
              {[1, 2, 3, 4].map((item) => <li key={item} className="flex gap-3"><span className="font-bold text-[#b27625]" aria-hidden="true">•</span><span>{t(`frontpage.management.duty_${item}`)}</span></li>)}
            </ul>
          </div>
        </div>
      </section>
    </div>
  </section>;
}
