import { useEffect, useState, type FormEvent } from "react";

interface ReceiptHeader {
  logo?: string;
  village?: string;
  district?: string;
  province?: string;
  phone?: string;
  numberPrefix?: string;
  tagline?: string;
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

export default function ReceiptHeaderSettings({ restaurantId, embedded = false }: { restaurantId: string; embedded?: boolean }) {
  const [value, setValue] = useState<ReceiptHeader>(() => readReceiptHeader(restaurantId));
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const syncContact = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId: string; value: ReceiptHeader }>).detail;
      if (detail?.restaurantId === restaurantId) setValue(detail.value);
    };
    window.addEventListener("shopqr:receipt-header-updated", syncContact);
    return () => window.removeEventListener("shopqr:receipt-header-updated", syncContact);
  }, [restaurantId]);

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
      setMessage("บันทึกโลโก้แล้ว");
    } catch {
      setMessage("บันทึกโลโก้ไม่สำเร็จ กรุณาลองเลือกรูปที่เล็กลง");
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
      setMessage("ลบโลโก้แล้ว");
    } catch {
      setMessage("ลบโลโก้ไม่สำเร็จ");
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("เลือกไฟล์ PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB");
      return;
    }
    void saveLogo(file);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = { ...value, tagline: value.tagline ?? "อร่อย สะอาด สดใหม่ ทุกจาน" };
      localStorage.setItem(`shopqr.receipt-header.${restaurantId}`, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent("shopqr:restaurant-logo-updated", { detail: { restaurantId, logo: value.logo || "" } }));
      setMessage("บันทึกหัวใบเสร็จแล้ว");
    } catch {
      setMessage("บันทึกไม่สำเร็จ กรุณาลดขนาดรูปแล้วลองใหม่");
    }
  }

  return <form onSubmit={save} className={embedded ? "space-y-4" : "space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"}>
    <header><h2 className="text-lg font-semibold">หัวใบเสร็จ</h2><p className="mt-1 text-sm text-slate-500">ข้อมูลนี้เก็บใน browser เครื่องนี้และใช้แสดงบนใบเสร็จ</p></header>
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {validReceiptLogo(value.logo) ? <img src={value.logo} alt="โลโก้ร้าน" width={72} height={72} className="h-16 w-16 rounded-lg bg-white object-contain" /> : <span aria-hidden className="grid h-16 w-16 place-items-center rounded-lg bg-white text-2xl text-slate-400">▧</span>}
      <div className="min-w-0 flex-1"><strong className="block text-sm">โลโก้ร้าน</strong><small className="text-xs text-slate-500">PNG, JPG, WebP · ไม่เกิน 5 MB</small></div>
      <label className={`cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium ${uploading ? "pointer-events-none opacity-50" : ""}`}>{uploading ? "กำลังบันทึกโลโก้…" : value.logo ? "เปลี่ยนรูป" : "อัปโหลดโลโก้"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} className="sr-only" onChange={(event) => { void uploadLogo(event.target.files?.[0]); event.target.value = ""; }} /></label>
      {value.logo && <button type="button" disabled={uploading} className="rounded-lg px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50" onClick={() => void removeLogo()}>ลบรูป</button>}
    </section>
    <h3 className="m-0 border-t border-slate-100 pt-4 text-sm font-semibold">รูปแบบใบเสร็จ</h3>
    <div className="grid gap-3 sm:grid-cols-2"><TextField label="คำนำหน้าเลขที่บิล" value={value.numberPrefix ?? ""} maxLength={30} placeholder="BILL-" onChange={(next) => update("numberPrefix", next)} /><TextField label="ข้อความโฆษณาบนหัวบิล" value={value.tagline ?? "อร่อย สะอาด สดใหม่ ทุกจาน"} maxLength={160} onChange={(next) => update("tagline", next)} /></div>
    <div className="grid gap-2 sm:grid-cols-2">{([["showName", "ชื่อร้าน"], ["showNumber", "เลขที่บิล"], ["showDate", "วันที่ / เดือน / ปี"], ["showTime", "เวลา"]] as const).map(([field, label]) => <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value[field] !== false} onChange={(event) => update(field, event.target.checked)} className="h-4 w-4 accent-emerald-700" />{label}</label>)}</div>
    {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
    <button className="settings-save-button ml-auto block rounded-xl px-4 py-2.5 text-sm font-semibold">บันทึกหัวใบเสร็จ</button>
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

