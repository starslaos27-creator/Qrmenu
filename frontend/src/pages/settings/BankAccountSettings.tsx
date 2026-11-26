import { useState } from "react";

interface BankDetails { bank?: string; name?: string; number?: string }

export default function BankAccountSettings({ restaurantId, embedded = false }: { restaurantId: string; embedded?: boolean }) {
  const storageKey = `shopqr.bank-details.${restaurantId}`;
  const [draft, setDraft] = useState<BankDetails>(() => readBankDetails(storageKey));
  const [message, setMessage] = useState("");

  function save() {
    if (![draft.bank, draft.name, draft.number].every((value) => value?.trim())) {
      setMessage("กรุณากรอกข้อมูลบัญชีให้ครบ");
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({ bank: draft.bank?.trim(), name: draft.name?.trim(), number: draft.number?.trim() }));
      setMessage("บันทึกข้อมูลบัญชีแล้ว");
    } catch {
      setMessage("บันทึกไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บของ browser");
    }
  }

  return <section className={embedded ? "space-y-3 border-t border-slate-200 bg-white pt-4 text-slate-900" : "space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900"}>
    <div><h3 className="m-0 text-sm font-semibold text-slate-900">บัญชีรับเงินโอน</h3><p className="mt-1 text-xs text-slate-600">บันทึกแยกตามร้านใน browser เครื่องนี้ ใช้แสดงในหน้าเช็กบิล</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <TextField label="ธนาคาร" value={draft.bank ?? ""} onChange={(bank) => setDraft((current) => ({ ...current, bank }))} />
      <TextField label="ชื่อบัญชี" value={draft.name ?? ""} onChange={(name) => setDraft((current) => ({ ...current, name }))} />
      <TextField label="เลขบัญชี" value={draft.number ?? ""} onChange={(number) => setDraft((current) => ({ ...current, number }))} />
    </div>
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{message}</p>}
    <button type="button" onClick={save} className="settings-save-button ml-auto block rounded-lg px-3 py-2 text-xs font-semibold">บันทึกบัญชีรับเงิน</button>
  </section>;
}

function readBankDetails(key: string): BankDetails {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); }
  catch { return {}; }
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-800">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none placeholder:text-slate-500 focus:border-emerald-700" /></label>;
}
