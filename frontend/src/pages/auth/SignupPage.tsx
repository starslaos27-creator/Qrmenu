import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiRequest, saveAccessToken } from "../../shared/api/client";
import { useLanguage } from "../../shared/i18n/LanguageProvider";
import AuthFrame from "./AuthFrame";
import RestaurantLocationPicker from "./RestaurantLocationPicker";
import CountryCallingCodePicker from "./CountryCallingCodePicker";
import { countryCallingCodes } from "./countryCallingCodes";

const currencyText = {
  th: {label:"สกุลเงินหลักของร้าน",lak:"กีบลาว",thb:"บาทไทย",usd:"ดอลลาร์สหรัฐ",help:"ราคาสินค้า บิล และยอดขายของร้านจะใช้สกุลเงินนี้"},
  lo: {label:"ສະກຸນເງິນຫຼັກຂອງຮ້ານ",lak:"ກີບລາວ",thb:"ບາດໄທ",usd:"ໂດລາສະຫະລັດ",help:"ລາຄາສິນຄ້າ ບິນ ແລະຍອດຂາຍຂອງຮ້ານຈະໃຊ້ສະກຸນເງິນນີ້"},
  en: {label:"Restaurant currency",lak:"Lao kip",thb:"Thai baht",usd:"US dollar",help:"Menu prices, bills and sales use this currency."},
  ko: {label:"매장 기본 통화",lak:"라오스 킵",thb:"태국 바트",usd:"미국 달러",help:"메뉴 가격, 영수증 및 매출에 이 통화를 사용합니다."},
  vi: {label:"Tiền tệ của nhà hàng",lak:"Kip Lào",thb:"Baht Thái",usd:"Đô la Mỹ",help:"Giá món, hóa đơn và doanh thu sử dụng tiền tệ này."},
  zh: {label:"餐厅使用的货币",lak:"老挝基普",thb:"泰铢",usd:"美元",help:"菜单价格、账单和销售额均使用此货币。"},
};

export default function SignupPage() {
  const { t, locale } = useLanguage();
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("inviteToken") ?? "";
  const [restaurantName, setRestaurantName] = useState("");
  const [currencyCode, setCurrencyCode] = useState<"LAK" | "THB" | "USD">("LAK");
  const [street, setStreet] = useState("");
  const [village, setVillage] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [restaurantType, setRestaurantType] = useState("");
  const [restaurantDescription, setRestaurantDescription] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("LA");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    // Read from the form itself so browser password-manager autofill is included,
    // even when it did not dispatch React's onChange event.
    const formData = new FormData(event.currentTarget);
    const submittedPassword = String(formData.get("password") ?? "");
    const submittedConfirmation = String(formData.get("confirmPassword") ?? "");
    if (submittedPassword !== submittedConfirmation) {
      setError(t("auth.signup.password_mismatch"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ accessToken: string }>("/api/auth/signup", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          email: email.trim(), password: submittedPassword, phone: formatInternationalPhone(phone, phoneCountry),
          restaurantName: inviteToken ? undefined : restaurantName.trim(),
          currencyCode: inviteToken ? undefined : currencyCode,
          street: inviteToken ? undefined : street.trim(),
          village: inviteToken ? undefined : village.trim(),
          city: inviteToken ? undefined : city.trim(),
          province: inviteToken ? undefined : province.trim(),
          latitude: inviteToken ? undefined : location?.lat,
          longitude: inviteToken ? undefined : location?.lon,
          restaurantType: inviteToken ? undefined : restaurantType,
          restaurantDescription: inviteToken ? undefined : restaurantDescription.trim(),
          inviteToken: inviteToken || undefined,
        }),
      }, { auth: false });
      saveAccessToken(result.accessToken);
      window.location.assign("/dashboard");
    } catch (cause) {
      setError(cause instanceof ApiError && cause.code === "ACCOUNT_EXISTS"
        ? t("auth.signup.account_exists")
        : cause instanceof ApiError && cause.code === "PASSWORD_TOO_SHORT"
          ? t("auth.signup.password_short")
          : t("auth.signup.failed"));
    } finally {
      setBusy(false);
    }
  }

  return <AuthFrame title={inviteToken ? t("auth.signup.invite_title") : t("auth.signup.title")} subtitle={inviteToken ? t("auth.signup.invite_subtitle") : t("auth.signup.form_subtitle")}>
    <form onSubmit={submit} className="space-y-4">
      {!inviteToken && <>
        <Field label={t("auth.field.shop_name")}><input required maxLength={200} value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} className={input} /></Field>
        <Field label={currencyText[locale].label}><select value={currencyCode} onChange={event => setCurrencyCode(event.target.value as "LAK" | "THB" | "USD")} className={input}><option value="LAK">LAK — {currencyText[locale].lak}</option><option value="THB">THB — {currencyText[locale].thb}</option><option value="USD">USD — {currencyText[locale].usd}</option></select><span className="block text-xs font-normal text-[#6e786f]">{currencyText[locale].help}</span></Field>
        <Field label={t("auth.signup.street")}><input maxLength={200} autoComplete="address-line1" value={street} onChange={(event) => setStreet(event.target.value)} className={input} /></Field>
        <Field label={t("auth.signup.village")}><input maxLength={200} autoComplete="address-line2" value={village} onChange={(event) => setVillage(event.target.value)} className={input} /></Field>
        <Field label={t("auth.signup.city")}><input maxLength={200} autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} className={input} /></Field>
        <Field label={t("auth.signup.province")}><input maxLength={200} autoComplete="address-level1" value={province} onChange={(event) => setProvince(event.target.value)} className={input} /></Field>
        <Field label={t("auth.signup.location_label")}><RestaurantLocationPicker value={location} onChange={setLocation} /></Field>
        <Field label={t("auth.signup.restaurant_type")}>
          <select required value={restaurantType} onChange={(event) => setRestaurantType(event.target.value)} className={input}>
            <option value="">{t("auth.signup.restaurant_type.select")}</option>
            <option value="thai">{t("auth.signup.restaurant_type.thai")}</option>
            <option value="lao">{t("auth.signup.restaurant_type.lao")}</option>
            <option value="cafe">{t("auth.signup.restaurant_type.cafe")}</option>
            <option value="made_to_order">{t("auth.signup.restaurant_type.made_to_order")}</option>
            <option value="seafood">{t("auth.signup.restaurant_type.seafood")}</option>
            <option value="buffet">{t("auth.signup.restaurant_type.buffet")}</option>
            <option value="other">{t("auth.signup.restaurant_type.other")}</option>
          </select>
        </Field>
        <Field label={t("auth.signup.description")}>
          <textarea maxLength={1000} rows={4} value={restaurantDescription} onChange={(event) => setRestaurantDescription(event.target.value)} placeholder={t("auth.signup.description.placeholder")} className={`${input} resize-y`} />
        </Field>
      </>}
      <Field label={t("auth.field.email")}><input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={input} /></Field>
      <Field label={t("auth.signup.phone_optional")}>
        <span className="flex gap-2">
          <CountryCallingCodePicker value={phoneCountry} onChange={setPhoneCountry} />
          <input aria-label={t("auth.field.phone")} autoComplete="tel-national" maxLength={25} type="tel" inputMode="tel" placeholder={t("auth.signup.phone_placeholder")} value={phone} onChange={(event) => setPhone(event.target.value)} className={`${input} min-w-0 flex-1`} />
        </span>
        <span className="block text-xs font-normal text-[#6e786f]">{t("auth.signup.phone_help")}</span>
      </Field>
      <Field label={t("auth.field.password")}>
        <span className="relative block">
          <input required minLength={8} name="password" autoComplete="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`${input} pr-11`} />
          <button type="button" aria-label={showPassword ? t("password.hide") : t("password.show")} onClick={() => setShowPassword((shown) => !shown)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#68766d]">
            <EyeIcon visible={showPassword} />
          </button>
        </span>
        <span className="block text-xs font-normal text-[#6e786f]">{t("auth.signup.password_hint")}</span>
      </Field>
      <Field label={t("auth.signup.confirm_password")}>
        <span className="relative block">
          <input required minLength={8} name="confirmPassword" autoComplete="new-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={`${input} pr-11`} />
          <button type="button" aria-label={showConfirmPassword ? t("password.hide") : t("password.show")} onClick={() => setShowConfirmPassword((shown) => !shown)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#68766d]">
            <EyeIcon visible={showConfirmPassword} />
          </button>
        </span>
        <span className="block text-xs font-normal text-[#6e786f]">{t("auth.signup.password_hint")}</span>
      </Field>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</p>}
      <button disabled={busy} className={primary}>{busy ? t("auth.signup.submitting") : t("auth.signup.submit")}</button>
      <p className="text-center text-sm text-[#6e786f]">{t("auth.signup.has_account")} <a className="font-bold text-[#14543b] hover:underline" href={inviteToken ? `/login?next=${encodeURIComponent(`/join/${inviteToken}`)}` : "/login"}>{t("auth.signup.login_link")}</a></p>
    </form>
  </AuthFrame>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-bold text-[#315842]">{label}{children}</label>; }
function formatInternationalPhone(phone: string, countryIso2: string) {
  const digits = phone.replace(/\D/g, "");
  const localNumber = ["IT", "VA"].includes(countryIso2) ? digits : digits.replace(/^0+/, "");
  if (!localNumber) return null;
  const country = countryCallingCodes.find(({ iso2 }) => iso2 === countryIso2);
  return `${country?.code ?? "+856"}${localNumber}`;
}
function EyeIcon({ visible }: { visible: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7">
    {visible ? <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.1 0 9.5 7 9.5 7a16 16 0 0 1-3.1 3.8M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.4 7 9.5 7c1.3 0 2.5-.3 3.5-.8"/></> : <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>}
  </svg>;
}
const jsonHeaders = { "Content-Type": "application/json" };
const input = "mt-1 w-full rounded-xl border border-[#d5c4aa] bg-[#edf2fc] px-3.5 py-3 text-sm text-[#18362a] shadow-sm transition focus:border-[#56806f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174a34]/10";
const primary = "w-full rounded-xl bg-gradient-to-r from-[#14633f] to-[#0d5035] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(20,99,63,0.24)] transition hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50";
