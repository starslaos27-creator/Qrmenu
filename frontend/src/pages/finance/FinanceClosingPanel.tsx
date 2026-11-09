import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import type { FinanceAccount, FinanceMethod, FinanceTotals, FinanceWorkspace } from "./types";
import { financeMethods, formatDateTime, formatMoney, localDate, methodNames } from "./utils";

interface ClosingPreview { accounts: FinanceAccount[]; summary: FinanceTotals }

export default function FinanceClosingPanel({ restaurantId, workspace, refresh, canEdit }: { restaurantId: string; workspace: FinanceWorkspace; refresh: () => void; canEdit: boolean }) {
  const [date, setDate] = useState(localDate());
  const [preview, setPreview] = useState<ClosingPreview | null>(null);
  const [actual, setActual] = useState<Record<FinanceMethod, string>>(() => Object.fromEntries(financeMethods.map((method) => [method, ""])) as Record<FinanceMethod, string>);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let cancelled = false; setPreview(null); setError("");
    apiRequest<ClosingPreview>(`/api/restaurants/${restaurantId}/finance/closing-preview?date=${date}`).then((result) => { if (!cancelled) setPreview(result); }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof ApiError && cause.code === "FORBIDDEN" ? "บัญชีนี้ไม่มีสิทธิ์ปิดยอด" : "โหลดภาพรวมก่อนปิดยอดไม่สำเร็จ");
    });
    return () => { cancelled = true; };
  }, [restaurantId, date, workspace]);

  function changeDate(value: string) { setDate(value); setRequestId(crypto.randomUUID()); setActual(Object.fromEntries(financeMethods.map((method) => [method, ""])) as Record<FinanceMethod, string>); setMessage(""); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!preview || busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/finance/closings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, actual, note, requestId }) });
      setRequestId(crypto.randomUUID()); setMessage("บันทึกผลตรวจยอดแล้ว"); refresh();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : "";
      setError(code === "ACCOUNT_OPENING_REQUIRED" ? "ตั้งยอดยกมาของทุกช่องทางในแท็บบัญชีก่อนปิดยอด" : "บันทึกปิดยอดไม่สำเร็จ ตรวจสอบยอดจริงและลองใหม่");
    } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"><div><h2 className="font-bold">ตรวจยอดก่อนปิดวัน</h2><p className="mt-1 text-sm text-slate-500">เปรียบเทียบยอดสะสมในระบบกับยอดจริง ณ สิ้นวัน รายการย้อนหลังที่เพิ่มภายหลังต้องตรวจยอดใหม่</p></div>
      <form onSubmit={save} className="space-y-4"><fieldset disabled={busy || !canEdit} className="space-y-4"><label className="block max-w-xs space-y-1 text-sm font-semibold">วันที่ปิดยอด<input required type="date" max={localDate()} value={date} onChange={(event) => changeDate(event.target.value)} className={input} /></label>
        {preview && <><div className="grid gap-3 sm:grid-cols-3"><Summary label="รายรับวันนั้น" value={preview.summary.income} /><Summary label="รายจ่ายวันนั้น" value={preview.summary.expense} /><Summary label="กำไรสุทธิ" value={preview.summary.net} /></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs text-slate-500"><tr>{["บัญชี", "ยอดระบบ", "ยอดจริง", "ส่วนต่าง"].map((heading) => <th key={heading} className="border-b px-2 py-1">{heading}</th>)}</tr></thead><tbody>{preview.accounts.map((account) => <tr key={account.method}><td className="border-b px-2 py-1 font-semibold">{account.name || methodNames[account.method]}</td><td className="border-b px-2 py-1">{account.configured ? formatMoney(account.balance) : "ยังไม่ตั้งยอดยกมา"}</td><td className="border-b px-2 py-1"><input aria-label={`ยอดจริง ${methodNames[account.method]}`} required type="number" step="0.01" value={actual[account.method]} onChange={(event) => setActual({ ...actual, [account.method]: event.target.value })} className="mt-0 h-8 w-40 rounded-md border border-slate-300 px-2 py-1 text-sm" /></td><td className="border-b px-2 py-1">{actual[account.method] !== "" && account.configured ? formatMoney(Number(actual[account.method]) - Number(account.balance)) : "—"}</td></tr>)}</tbody></table></div>
          <label className="block space-y-1 text-sm font-semibold">หมายเหตุ / เหตุผลส่วนต่าง<textarea maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} rows={2} className={input} /></label></>}
        {error && <Notice tone="error">{error}</Notice>}{message && <Notice>{message}</Notice>}
        <button disabled={!preview || preview.accounts.some((account) => !account.configured)} className={primary}>{busy ? "กำลังบันทึก…" : "บันทึกปิดยอด"}</button>
      </fieldset></form>
    </section>
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-bold">ประวัติปิดยอด (60 รายการล่าสุด)</h2><table className="w-full min-w-[800px] text-left text-sm"><thead className="text-xs text-slate-500"><tr>{["วันที่", "บันทึกเมื่อ", "ผู้บันทึก", "รายรับ", "กำไรสุทธิ", "ผลต่าง", "หมายเหตุ"].map((heading) => <th key={heading} className="border-b px-2 py-2">{heading}</th>)}</tr></thead><tbody>{workspace.closings.map((closing) => <tr key={closing.id}><td className="border-b px-2 py-2">{closing.close_date}</td><td className="border-b px-2 py-2">{formatDateTime(closing.created_at)}</td><td className="border-b px-2 py-2">{closing.operator ?? "—"}</td><td className="border-b px-2 py-2">{formatMoney(closing.snapshot.summary.income)}</td><td className="border-b px-2 py-2">{formatMoney(closing.snapshot.summary.net)}</td><td className="border-b px-2 py-2">{closing.snapshot.accounts.map((account) => `${methodNames[account.method]}: ${formatMoney(Number(closing.actual[account.method]) - Number(account.balance))}`).join(" / ")}</td><td className="border-b px-2 py-2">{closing.note || "—"}</td></tr>)}</tbody></table>{workspace.closings.length === 0 && <p className="py-5 text-sm text-slate-500">ยังไม่มีประวัติปิดยอด</p>}</section>
  </div>;
}

function Summary({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold">{formatMoney(value)}</p></div>; }
function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" }) { return <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${tone === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{children}</p>; }
const input = "mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm";
const primary = "rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
