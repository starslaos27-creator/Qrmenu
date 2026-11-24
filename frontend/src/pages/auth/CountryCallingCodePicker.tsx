import { useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useLanguage } from "../../shared/i18n/LanguageProvider";
import { countryCallingCodes } from "./countryCallingCodes";

export default function CountryCallingCodePicker({ value, onChange }: { value: string; onChange: (iso2: string) => void }) {
  const { locale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const regionNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const selected = countryCallingCodes.find((country) => country.iso2 === value) ?? countryCallingCodes.find((country) => country.iso2 === "LA")!;
  const query = search.trim().toLocaleLowerCase();
  const filtered = useMemo(() => countryCallingCodes.filter(({ iso2, name, code }) => {
    const localizedName = getCountryName(iso2, name, regionNames);
    return !query || `${iso2} ${name} ${localizedName} ${code}`.toLocaleLowerCase().includes(query);
  }), [query, regionNames]);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return <div className="relative w-[46%] min-w-0" onBlur={handleBlur} onKeyDown={handleKeyDown}>
    <button ref={triggerRef} type="button" aria-label={t("phone.country_select_aria")} aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((current) => !current); setSearch(""); }} className={`${pickerControl} flex items-center justify-between gap-2 text-left`}>
      <span className="flex min-w-0 items-center truncate"><CountryFlag iso2={selected.iso2} /><span className="truncate">{selected.code} · {getCountryName(selected.iso2, selected.name, regionNames)}</span></span>
      <span aria-hidden="true" className="shrink-0 text-xs">⌄</span>
    </button>
    {open && <div className="absolute left-0 top-full z-50 mt-1 w-[min(22rem,85vw)] overflow-hidden rounded-xl border border-[#d5c4aa] bg-white shadow-xl">
      <div className="border-b border-[#e5ded1] p-2">
        <input autoFocus type="search" autoComplete="off" aria-label={t("phone.country_search_aria")} placeholder={t("phone.country_search_placeholder")} value={search} onChange={(event) => setSearch(event.target.value)} className={`${pickerControl} py-2.5`} />
      </div>
      <div role="listbox" aria-label={t("phone.country_list_aria")} className="max-h-56 overflow-y-auto p-1">
        {filtered.length === 0 ? <p className="px-3 py-4 text-center text-sm text-[#6e786f]">{t("phone.country_none")}</p> : filtered.map(({ iso2, name, code }) => <button key={iso2} type="button" role="option" aria-selected={iso2 === selected.iso2} onClick={() => { onChange(iso2); setOpen(false); setSearch(""); triggerRef.current?.focus(); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[#edf4ef] ${iso2 === selected.iso2 ? "bg-[#eaf2ec] font-bold text-[#14543b]" : "text-[#294536]"}`}>
          <CountryFlag iso2={iso2} />{code} · {getCountryName(iso2, name, regionNames)}
        </button>)}
      </div>
    </div>}
  </div>;
}

function getCountryName(iso2: string, fallback: string, regionNames: Intl.DisplayNames) {
  const localized = regionNames.of(iso2);
  return localized && localized !== iso2 ? localized : fallback;
}

function countryFlag(iso2: string) {
  return [...iso2.toUpperCase()].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("");
}

function CountryFlag({ iso2 }: { iso2: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [iso2]);
  return failed ? <span aria-hidden="true" className="mr-2 inline-block w-5 shrink-0 text-center">{countryFlag(iso2)}</span> : <img aria-hidden="true" src={`https://flagcdn.com/w40/${iso2.toLowerCase()}.png`} alt="" loading="lazy" onError={() => setFailed(true)} className="mr-2 inline-block h-[14px] w-5 shrink-0 rounded-[2px] border border-black/10 object-cover" />;
}

const pickerControl = "w-full rounded-xl border border-[#d5c4aa] bg-[#edf2fc] px-3.5 py-3 text-sm text-[#18362a] shadow-sm transition focus:border-[#56806f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174a34]/10";
