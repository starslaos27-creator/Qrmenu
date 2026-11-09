export const financeMethods = ["cash", "transfer", "qr", "card", "other"] as const;
export const methodNames: Record<string, string> = { cash: "เงินสด", transfer: "โอน / ธนาคาร", qr: "QR Payment", promptpay: "QR Payment", card: "บัตร", other: "อื่น ๆ" };
let financeCurrency: "LAK" | "THB" | "USD" = "LAK";
export function setFinanceCurrency(currency: "LAK" | "THB" | "USD") { financeCurrency = currency; }
export function localDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function formatMoney(value: number | string | null | undefined) { return value == null ? "—" : new Intl.NumberFormat("th-TH", { style: "currency", currency: financeCurrency, maximumFractionDigits: financeCurrency === "LAK" ? 0 : 2 }).format(Number(value)); }
export function formatDateTime(value: string | null | undefined) { return value ? new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Vientiane" }) : "—"; }
