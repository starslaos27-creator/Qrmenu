import { useState, type FormEvent } from "react";

interface ReceiptHeader {
  logo?: string;
  village?: string;
  district?: string;
  province?: string;
  phone?: string;
  numberPrefix?: string;
  tagline?: string;
  calendar?: "buddhist" | "gregory";
  showName?: boolean;
  showNumber?: boolean;
  showDate?: boolean;
  showTime?: boolean;
}

export function readReceiptHeader(restaurantId: string): ReceiptHeader {
  try {
    return JSON.parse(localStorage.getItem(`shopqr.receipt-header.${restaurantId}`) || "{}") as ReceiptHeader;
  } catch {
    return {};
  }
}

export default function ReceiptHeaderSettings({ restaurantId }: { restaurantId: string }) {
  const [value, setValue] = useState<ReceiptHeader>(() => ({ calendar: "buddhist", ...readReceiptHeader(restaurantId) }));
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  function update<K extends keyof ReceiptHeader>(field: K, next: ReceiptHeader[K]) {
    setValue((current) => ({ ...current, [field]: next }));
    setMessage("");
  }

  async function saveLogo(file?: File) {
    if (!file || uploading) return;
    setUploading(true);
    setMessage("");
    try {
      const logo = await encodeLogoForBrowserStorage(file);
      const next = { ...value, logo };
      localStorage.setItem(`shopqr.receipt-header.${restaurantId}`, JSON.stringify(next));
      setValue(next);
      window.dispatchEvent(new CustomEvent("shopqr:restaurant-logo-updated", { detail: { restaurantId, logo } }));
      setMessage("à¸šà¸±à¸™à¸—à¸¶à¸à¹‚à¸¥à¹‚à¸à¹‰à¹à¸¥à¹‰à¸§");
    } catch {
      setMessage("à¸šà¸±à¸™à¸—à¸¶à¸à¹‚à¸¥à¹‚à¸à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹€à¸¥à¸·à¸­à¸à¸£à¸¹à¸›à¸—à¸µà¹ˆà¹€à¸¥à¹‡à¸à¸¥à¸‡");
    } finally {
      setUploading(false);
    }
  }

  function removeLogo() {
    try {
      const next = { ...value, logo: "" };
      localStorage.setItem(`shopqr.receipt-header.${restaurantId}`, JSON.stringify(next));
      setValue(next);
      window.dispatchEvent(new CustomEvent("shopqr:restaurant-logo-updated", { detail: { restaurantId, logo: "" } }));
      setMessage("à¸¥à¸šà¹‚à¸¥à¹‚à¸à¹‰à¹à¸¥à¹‰à¸§");
    } catch {
      setMessage("à¸¥à¸šà¹‚à¸¥à¹‚à¸à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œ PNG, JPG à¸«à¸£à¸·à¸­ WebP à¸‚à¸™à¸²à¸”à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 5 MB");
      return;
    }
    void saveLogo(file);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = { ...value, tagline: value.tagline ?? "à¸­à¸£à¹ˆà¸­à¸¢ à¸ªà¸°à¸­à¸²à¸” à¸ªà¸”à¹ƒà¸«à¸¡à¹ˆ à¸—à¸¸à¸à¸ˆà¸²à¸™" };
      localStorage.setItem(`shopqr.receipt-header.${restaurantId}`, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent("shopqr:restaurant-logo-updated", { detail: { restaurantId, logo: value.logo || "" } }));
      setMessage("à¸šà¸±à¸™à¸—à¸¶à¸à¸«à¸±à¸§à¹ƒà¸šà¹€à¸ªà¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§");
    } catch {
      setMessage("à¸šà¸±à¸™à¸—à¸¶à¸à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸à¸£à¸¸à¸“à¸²à¸¥à¸”à¸‚à¸™à¸²à¸”à¸£à¸¹à¸›à¹à¸¥à¹‰à¸§à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ");
    }
  }

  return <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header><h2 className="text-lg font-semibold">à¸«à¸±à¸§à¹ƒà¸šà¹€à¸ªà¸£à¹‡à¸ˆ</h2><p className="mt-1 text-sm text-slate-500">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸µà¹‰à¹€à¸à¹‡à¸šà¹ƒà¸™ browser à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸™à¸µà¹‰à¹à¸¥à¸°à¹ƒà¸Šà¹‰à¹à¸ªà¸”à¸‡à¸šà¸™à¹ƒà¸šà¹€à¸ªà¸£à¹‡à¸ˆ</p></header>
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {validReceiptLogo(value.logo) ? <img src={value.logo} alt="à¹‚à¸¥à¹‚à¸à¹‰à¸£à¹‰à¸²à¸™" width={72} height={72} className="h-16 w-16 rounded-lg bg-white object-contain" /> : <span aria-hidden className="grid h-16 w-16 place-items-center rounded-lg bg-white text-2xl text-slate-400">â–§</span>}
      <div className="min-w-0 flex-1"><strong className="block text-sm">à¹‚à¸¥à¹‚à¸à¹‰à¸£à¹‰à¸²à¸™</strong><small className="text-xs text-slate-500">PNG, JPG, WebP Â· à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 5 MB</small></div>
      <label className={`cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium ${uploading ? "pointer-events-none opacity-50" : ""}`}>{uploading ? "à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸à¹‚à¸¥à¹‚à¸à¹‰â€¦" : value.logo ? "à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸¹à¸›" : "à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¹‚à¸¥à¹‚à¸à¹‰"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} className="sr-only" onChange={(event) => { void uploadLogo(event.target.files?.[0]); event.target.value = ""; }} /></label>
      {value.logo && <button type="button" disabled={uploading} className="rounded-lg px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50" onClick={() => void removeLogo()}>à¸¥à¸šà¸£à¸¹à¸›</button>}
    </section>
    <h3 className="m-0 border-t border-slate-100 pt-4 text-sm font-semibold">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸•à¸´à¸”à¸•à¹ˆà¸­à¸£à¹‰à¸²à¸™</h3>
    <div className="grid gap-3 sm:grid-cols-2"><TextField label="à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ / à¸šà¹‰à¸²à¸™" value={value.village ?? ""} maxLength={160} onChange={(next) => update("village", next)} /><TextField label="à¹€à¸¡à¸·à¸­à¸‡" value={value.district ?? ""} maxLength={160} onChange={(next) => update("district", next)} /><TextField label="à¹à¸‚à¸§à¸‡" value={value.province ?? ""} maxLength={160} onChange={(next) => update("province", next)} /><TextField label="à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£" value={value.phone ?? ""} maxLength={40} type="tel" onChange={(next) => update("phone", next)} /></div>
    <h3 className="m-0 border-t border-slate-100 pt-4 text-sm font-semibold">à¸£à¸¹à¸›à¹à¸šà¸šà¹ƒà¸šà¹€à¸ªà¸£à¹‡à¸ˆ</h3>
    <div className="grid gap-3 sm:grid-cols-2"><TextField label="à¸„à¸³à¸™à¸³à¸«à¸™à¹‰à¸²à¹€à¸¥à¸‚à¸—à¸µà¹ˆà¸šà¸´à¸¥" value={value.numberPrefix ?? ""} maxLength={30} placeholder="BILL-" onChange={(next) => update("numberPrefix", next)} /><TextField label="à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¹‚à¸†à¸©à¸“à¸²à¸šà¸™à¸«à¸±à¸§à¸šà¸´à¸¥" value={value.tagline ?? "à¸­à¸£à¹ˆà¸­à¸¢ à¸ªà¸°à¸­à¸²à¸” à¸ªà¸”à¹ƒà¸«à¸¡à¹ˆ à¸—à¸¸à¸à¸ˆà¸²à¸™"} maxLength={160} onChange={(next) => update("tagline", next)} /><label className="grid gap-1.5 text-sm font-medium">à¸›à¸µà¸—à¸µà¹ˆà¹à¸ªà¸”à¸‡<select className={inputClass} value={value.calendar || "buddhist"} onChange={(event) => update("calendar", event.target.value as ReceiptHeader["calendar"])}><option value="buddhist">à¸ž.à¸¨.</option><option value="gregory">à¸„.à¸¨.</option></select></label></div>
    <div className="grid gap-2 sm:grid-cols-2">{([["showName", "à¸Šà¸·à¹ˆà¸­à¸£à¹‰à¸²à¸™"], ["showNumber", "à¹€à¸¥à¸‚à¸—à¸µà¹ˆà¸šà¸´à¸¥"], ["showDate", "à¸§à¸±à¸™à¸—à¸µà¹ˆ / à¹€à¸”à¸·à¸­à¸™ / à¸›à¸µ"], ["showTime", "à¹€à¸§à¸¥à¸²"]] as const).map(([field, label]) => <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value[field] !== false} onChange={(event) => update(field, event.target.checked)} className="h-4 w-4 accent-emerald-700" />{label}</label>)}</div>
    {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
    <button className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">à¸šà¸±à¸™à¸—à¸¶à¸à¸«à¸±à¸§à¹ƒà¸šà¹€à¸ªà¸£à¹‡à¸ˆ</button>
  </form>;
}

function TextField({ label, value, maxLength, onChange, type = "text", placeholder }: { label: string; value: string; maxLength: number; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}<input type={type} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>;
}

function validReceiptLogo(value?: string) {
  return typeof value === "string" && (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || /^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/[\w./?&=%+-]+$/.test(value));
}

async function encodeLogoForBrowserStorage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const maxDimension of [2000, 1600, 1280]) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("CANVAS_UNAVAILABLE");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.94, 0.9, 0.86, 0.82, 0.78]) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error("IMAGE_ENCODING_FAILED")), "image/webp", quality);
        });
        if (blob.size <= 1250 * 1024) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
            reader.readAsDataURL(blob);
          });
        }
      }
    }
    throw new Error("IMAGE_STORAGE_LIMIT");
  } finally {
    bitmap.close();
  }
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

