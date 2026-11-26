import { useEffect, useState, type FormEvent } from "react";
import { adminRequest } from "../../shared/adminApi";

type BankDetails = { bank: string; accountNumber: string; accountName: string };
const emptyDetails: BankDetails = { bank: "", accountNumber: "", accountName: "" };

export default function AdminPaymentBankSettings({ canManage }: { canManage: boolean }) {
  const [details, setDetails] = useState<BankDetails>(emptyDetails);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void adminRequest<{ bankDetails: BankDetails | null }>("/api/pro-payment-bank-details", {}, false)
      .then((data) => { if (active && data.bankDetails) setDetails(data.bankDetails); })
      .catch(() => { if (active) { setMessageType("error"); setMessage("โหลดข้อมูลบัญชีไม่สำเร็จ"); } });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || busy) return;
    setBusy(true); setMessage("");
    try {
      const data = await adminRequest<{ bankDetails: BankDetails }>("/api/admin/pro-payment-bank-details", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      setDetails(data.bankDetails);
      setMessageType("success");
      setMessage("บันทึกบัญชีรับเงินแล้ว");
    } catch {
      setMessageType("error");
      setMessage("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { setBusy(false); }
  }

  return <form onSubmit={(event) => void save(event)} className="space-y-3 rounded-xl border border-[#dfcfb2] bg-white/60 p-5">
    <h3 className="m-0 text-base font-bold">บัญชีรับเงิน</h3>
    <Field label="ธนาคาร" value={details.bank} disabled={!canManage || busy} maxLength={120} onChange={(bank) => setDetails((current) => ({ ...current, bank }))} />
    <Field label="เลขบัญชี" value={details.accountNumber} disabled={!canManage || busy} maxLength={80} onChange={(accountNumber) => setDetails((current) => ({ ...current, accountNumber }))} />
    <Field label="ชื่อบัญชี" value={details.accountName} disabled={!canManage || busy} maxLength={160} onChange={(accountName) => setDetails((current) => ({ ...current, accountName }))} />
    {message && <p role={messageType === "error" ? "alert" : "status"} className={`m-0 text-sm ${messageType === "error" ? "font-semibold text-red-700" : "text-emerald-800"}`}>{message}</p>}
    {canManage && <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#174a34] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "กำลังบันทึก…" : "บันทึกบัญชีรับเงิน"}</button>}
  </form>;
}

function Field({ label, value, disabled, maxLength, onChange }: { label: string; value: string; disabled: boolean; maxLength: number; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-medium text-[#174a34]">{label}<input required maxLength={maxLength} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-[#dfcfb2] bg-[#fffaf1] px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-emerald-800 disabled:opacity-60" /></label>;
}
