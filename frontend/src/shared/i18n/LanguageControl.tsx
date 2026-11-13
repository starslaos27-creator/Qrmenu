import { useLanguage, type Locale } from "./LanguageProvider";

const options: { value: Locale; label: string }[] = [
  { value: "th", label: "ไทย" },
  { value: "lo", label: "ລາວ" },
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "zh", label: "中文" },
];

export default function LanguageControl({ inline = false }: { inline?: boolean }) {
  const { locale, setLocale } = useLanguage();
  return (
    <label data-language-ui className={`${inline ? "relative z-10" : "fixed right-28 top-3 z-[10000]"} flex items-center gap-2 rounded-xl border border-emerald-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-emerald-950 shadow-md backdrop-blur`}>
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="cursor-pointer border-0 bg-transparent pr-1 text-inherit outline-none"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
