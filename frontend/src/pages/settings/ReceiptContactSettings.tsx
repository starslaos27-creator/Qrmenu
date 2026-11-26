import { useState } from "react";

interface ReceiptContact {
  village?: string;
  district?: string;
  province?: string;
  phone?: string;
}

export default function ReceiptContactSettings({ restaurantId }: { restaurantId: string }) {
  const storageKey = `shopqr.receipt-header.${restaurantId}`;
  const [contact, setContact] = useState<ReceiptContact>(() => readContact(storageKey));
  const [message, setMessage] = useState("");

  function update<K extends keyof ReceiptContact>(field: K, value: ReceiptContact[K]) {
    setContact((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function save() {
    try {
      const current = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, unknown>;
      const saved = { ...current, ...contact };
      localStorage.setItem(storageKey, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent("shopqr:receipt-header-updated", {
        detail: { restaurantId, value: saved },
      }));
      setMessage("บันทึกข้อมูลติดต่อแล้ว");
    } catch {
      setMessage("บันทึกข้อมูลติดต่อไม่สำเร็จ");
    }
  }

  return <section className="space-y-3 border-t border-slate-200 pt-4">
    <h3 className="m-0 text-sm font-semibold">ข้อมูลติดต่อร้าน</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="ที่อยู่ / บ้าน" value={contact.village ?? ""} onChange={(value) => update("village", value)} />
      <TextField label="เมือง" value={contact.district ?? ""} onChange={(value) => update("district", value)} />
      <TextField label="แขวง" value={contact.province ?? ""} onChange={(value) => update("province", value)} />
      <TextField label="เบอร์โทร" value={contact.phone ?? ""} type="tel" onChange={(value) => update("phone", value)} />
    </div>
    {message && <p role="status" className="rounded-lg bg-slate-100 p-2 text-xs text-slate-700">{message}</p>}
    <button type="button" onClick={save} className="settings-save-button ml-auto block rounded-lg px-3 py-2 text-xs font-semibold">บันทึกข้อมูลติดต่อ</button>
  </section>;
}

function readContact(key: string): ReceiptContact {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") as ReceiptContact;
  } catch {
    return {};
  }
}

function TextField({ label, value, type = "text", onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}<input type={type} value={value} maxLength={160} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" /></label>;
}
