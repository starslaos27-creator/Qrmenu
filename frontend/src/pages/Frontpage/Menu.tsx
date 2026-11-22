import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "../../shared/api/client";
import { useLanguage, type Locale } from "../../shared/i18n/LanguageProvider";
import { numberLocales } from "../../shared/i18n/numberLocales";
import type { CustomerMenuData, PublicCategory, PublicMenuItem } from "../customer-menu/types";

export default function Menu() {
  const { locale, t } = useLanguage();
  const initialTableCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("tableCode") || params.get("table") || import.meta.env.VITE_PUBLIC_TABLE_CODE || "").trim().toUpperCase();
  }, []);
  const [tableCode, setTableCode] = useState(initialTableCode);
  const [tableCodeInput, setTableCodeInput] = useState(initialTableCode);
  const [data, setData] = useState<CustomerMenuData | null>(null);
  const [categoryId, setCategoryId] = useState("all");
  const [loading, setLoading] = useState(Boolean(tableCode));
  const [error, setError] = useState(false);

  const loadMenu = useCallback(async () => {
    if (!tableCode) return;
    setLoading(true);
    setError(false);
    try {
      const result = await apiRequest<CustomerMenuData>(`/api/public/menu/${encodeURIComponent(tableCode)}`, {}, { auth: false });
      setData(result);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tableCode]);

  useEffect(() => { void loadMenu(); }, [loadMenu]);

  const visibleMenus = data?.menus.filter((menu) => categoryId === "all" || menu.category_id === categoryId) ?? [];
  const categories = data?.categories ?? [];

  return <section id="menu" className="scroll-mt-24 bg-[#fffaf0] px-5 py-16 sm:px-8 lg:py-20">
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-[#b27625]">{t("frontpage.menu.label")}</span>
          <h2 className="mt-2 text-3xl font-black text-[#14543b] sm:text-4xl">{data?.restaurant.name ?? t("frontpage.menu.title")}</h2>
          <p className="mt-2 text-sm text-[#70776f]">{t("frontpage.menu.description")}</p>
        </div>
        {data && <span className="rounded-full bg-[#e7f0e7] px-4 py-2 text-xs font-bold text-[#14543b]">{visibleMenus.length} {t("frontpage.menu.count")}</span>}
      </div>

      {data && <div className="mb-6 flex gap-2 overflow-x-auto pb-2" aria-label={t("frontpage.menu.title")}>
        <CategoryButton label={t("frontpage.menu.all")} active={categoryId === "all"} onClick={() => setCategoryId("all")} />
        {categories.map((category) => <CategoryButton key={category.id} label={localizedName(category, locale)} active={categoryId === category.id} onClick={() => setCategoryId(category.id)} />)}
      </div>}

      {loading && <Status>{t("frontpage.menu.loading")}</Status>}
      {!loading && !tableCode && <form onSubmit={(event) => { event.preventDefault(); setData(null); setCategoryId("all"); setTableCode(tableCodeInput.trim().toUpperCase()); }} className="rounded-2xl border border-[#e8dfcf] bg-white p-5 text-center shadow-sm sm:p-7">
        <p className="text-base font-bold text-[#193a2f]">{t("frontpage.menu.notConfigured")}</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[#68766d]">{t("frontpage.menu.enterCode")}</p>
        <div className="mx-auto mt-4 flex max-w-lg flex-col gap-2 sm:flex-row">
          <input value={tableCodeInput} onChange={(event) => setTableCodeInput(event.target.value)} aria-label={t("frontpage.menu.codeLabel")} placeholder={t("frontpage.menu.codePlaceholder")} className="min-w-0 flex-1 rounded-xl border border-[#ddd3c1] px-4 py-3 text-sm outline-none focus:border-[#14543b] focus:ring-2 focus:ring-[#14543b]/10" />
          <button type="submit" disabled={!tableCodeInput.trim()} className="rounded-xl bg-[#14543b] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#103e2d] disabled:cursor-not-allowed disabled:opacity-50">{t("frontpage.menu.load")}</button>
        </div>
      </form>}
      {!loading && tableCode && error && <Status>{t("frontpage.menu.notFound")}<button type="button" onClick={() => void loadMenu()} className="ml-3 font-bold text-[#14543b] underline">{t("frontpage.menu.retry")}</button><button type="button" onClick={() => { setData(null); setTableCode(""); setTableCodeInput(""); }} className="ml-3 font-bold text-[#14543b] underline">{t("frontpage.menu.changeCode")}</button></Status>}
      {!loading && data && visibleMenus.length === 0 && <Status>{t("frontpage.menu.empty")}</Status>}
      {!loading && data && visibleMenus.length > 0 && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleMenus.map((menu) => <MenuCard key={menu.id} menu={menu} currencyCode={data.restaurant.currency_code} locale={locale} />)}
      </div>}
    </div>
  </section>;
}

function CategoryButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${active ? "border-[#14543b] bg-[#14543b] text-white shadow-sm" : "border-[#e4dac8] bg-white text-[#43584b] hover:border-[#14543b] hover:text-[#14543b]"}`}>{label}</button>;
}

function MenuCard({ menu, currencyCode, locale }: { menu: PublicMenuItem; currencyCode: CustomerMenuData["restaurant"]["currency_code"]; locale: Locale }) {
  const name = localizedMenuName(menu, locale);
  const price = new Intl.NumberFormat(numberLocales[locale], {
    style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "LAK" ? 0 : 2,
  }).format(Number(menu.price));
  return <article className="group overflow-hidden rounded-[24px] border border-[#e8dfcf] bg-white shadow-[0_12px_30px_rgba(32,53,36,.07)] transition hover:-translate-y-1 hover:shadow-xl">
    {menu.image_url ? <img src={menu.image_url} alt={name} loading="lazy" className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.02]" /> : <div className="grid h-56 place-items-center bg-[#f3eee3] text-5xl" aria-hidden="true">🍽️</div>}
    <div className="p-5"><h3 className="text-lg font-extrabold text-[#193a2f]">{name}</h3>{menu.description && <p className="mt-1 line-clamp-2 text-sm text-[#778078]">{menu.description}</p>}<p className="mt-4 text-base font-black text-[#14543b]">{price}</p></div>
  </article>;
}

function Status({ children }: { children: ReactNode }) {
  return <div role="status" className="rounded-2xl border border-[#e8dfcf] bg-white px-5 py-8 text-center text-sm text-[#68766d]">{children}</div>;
}

function localizedName(category: PublicCategory, locale: string) {
  if (locale === "lo") return category.name_lo || category.name;
  if (locale === "en" || locale === "ko" || locale === "vi" || locale === "zh") return category.name_en || category.name;
  return category.name;
}

function localizedMenuName(menu: PublicMenuItem, locale: string) {
  if (locale === "lo") return menu.name_lo || menu.name;
  if (locale === "en" || locale === "ko" || locale === "vi" || locale === "zh") return menu.name_en || menu.name;
  return menu.name;
}
