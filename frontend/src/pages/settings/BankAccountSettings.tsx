import { useState, type FormEvent } from "react";

interface BankDetails { bank?: string; name?: string; number?: string }

export default function BankAccountSettings({ restaurantId }: { restaurantId: string }) {
  const storageKey = `shopqr.bank-details.${restaurantId}`;
  const [draft, setDraft] = useState<BankDetails>(() => readBankDetails(storageKey));
  const [message, setMessage] = useState("");

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (![draft.bank, draft.name, draft.number].every((value) => value?.trim())) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ bank: draft.bank?.trim(), name: draft.name?.trim(), number: draft.number?.trim() }));
      setMessage("บันทึกข้อมูลบัญชีแล้ว");
    } catch {
      setMessage("บันทึกไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บของ browser");
    }
  }

  return <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div><h3 className="m-0 text-sm font-semibold">บัญชีรับเงินโอน</h3><p className="mt-1 text-xs text-slate-500">บันทึกแยกตามร้านใน browser เครื่องนี้ ใช้แสดงในหน้าเช็กบิล</p></div>
    <TextField label="ธนาคาร" value={draft.bank ?? ""} onChange={(bank) => setDraft((current) => ({ ...current, bank }))} />
    <TextField label="ชื่อบัญชี" value={draft.name ?? ""} onChange={(name) => setDraft((current) => ({ ...current, name }))} />
    <TextField label="เลขบัญชี" value={draft.number ?? ""} onChange={(number) => setDraft((current) => ({ ...current, number }))} />
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{message}</p>}
    <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-100">บันทึกบัญชีรับเงิน</button>
  </form>;
}

function readBankDetails(key: string): BankDetails {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); }
  catch { return {}; }
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-medium text-slate-600">{label}<input required value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-700" /></label>;
}
