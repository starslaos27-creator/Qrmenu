import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import type { FinanceConfig, FinanceCurrency, FinanceEntry, FinanceKind, FinanceMethod } from "./types";
import { financeMethods, methodNames } from "./utils";

export default function FinanceEntryForm({ restaurantId, kind, config, previous, onClose, onSaved }: {
  restaurantId: string; kind: FinanceKind; config: FinanceConfig; previous?: FinanceEntry;
  onClose: () => void; onSaved: () => void;
}) {
  const [date, setDate] = useState(previous?.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [amount, setAmount] = useState(previous?.currency_amount ?? previous?.amount ?? "");
  const [currencyCode, setCurrencyCode] = useState<FinanceCurrency>(previous?.currency_code ?? config.currency);
  const [exchangeRate, setExchangeRate] = useState(previous?.exchange_rate ?? "1");
  const [category, setCategory] = useState(previous?.category ?? (kind === "income" ? config.incomeCategories[0] : config.expenseCategories[0]) ?? "");
  const [description, setDescription] = useState(previous?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState<FinanceMethod>((previous?.payment_method as FinanceMethod) ?? config.paymentMethods[0] ?? "cash");
  const [reference, setReference] = useState(previous?.reference ?? "");
  const [treatment, setTreatment] = useState<"operating" | "inventory">(previous?.treatment ?? (kind === "expense" && category === "ซื้อวัตถุดิบ" ? "inventory" : "operating"));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const payload = useRef("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      let receiptId: string | null = previous?.receipt_id ?? null;
      if (file) {
        const body = new FormData(); body.append("file", file);
        const uploaded = await apiRequest<{ id: string }>(`/api/restaurants/${restaurantId}/finance/receipts`, { method: "POST", body });
        receiptId = uploaded.id;
      }
      const body = {
        kind, date, amount: amount.trim(), currencyCode, exchangeRate: exchangeRate.trim(), category: category.trim(), description: description.trim(),
        paymentMethod, reference: reference.trim(), treatment: kind === "expense" ? treatment : "operating",
        receiptId, replacesId: previous?.entryId ?? null, requestId: requestId.current,
      };
      const serialized = JSON.stringify(body);
      if (payload.current && payload.current !== serialized) throw new Error("FINANCE_REQUEST_CONFLICT");
      payload.current = serialized;
      await apiRequest(`/api/restaurants/${restaurantId}/finance/entries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: serialized });
      onSaved();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : cause instanceof Error ? cause.message : "";
      setError(code === "RECEIPT_TOO_LARGE" ? "รูปใบเสร็จต้องไม่เกิน 5 MB" : code === "FINANCE_REQUEST_CONFLICT" ? "คำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาปิดแล้วเปิดฟอร์มใหม่" : "บันทึกรายการไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
    } finally { setBusy(false); }
  }

  const categories = kind === "income" ? config.incomeCategories : config.expenseCategories;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={() => !busy && onClose()}><form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
    <header><h2 className="text-lg font-bold">{previous ? "บันทึกรายการทดแทน" : kind === "income" ? "เพิ่มรายรับอื่น ๆ" : "บันทึกรายจ่าย"}</h2><p className="mt-1 text-sm text-slate-500">ยอดรับจากบิลบันทึกอัตโนมัติแล้ว รายจ่ายซื้อสต็อกจะไม่ถูกหักซ้ำกับต้นทุนขาย</p></header>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="วันที่"><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className={input} /></Field><Field label="จำนวนเงิน"><input required type="number" min="0.01" max="999999999999.99" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={input} /></Field>
      <Field label={"\u0e2a\u0e01\u0e38\u0e25\u0e40\u0e07\u0e34\u0e19"}><select value={currencyCode} onChange={(event) => { const next = event.target.value as FinanceCurrency; setCurrencyCode(next); setExchangeRate(next === config.currency ? "1" : ""); }} className={input}><option value="LAK">LAK - \u0e01\u0e35\u0e1a</option><option value="THB">THB - \u0e1a\u0e32\u0e17\u0e44\u0e17\u0e22</option><option value="USD">USD - \u0e14\u0e2d\u0e25\u0e25\u0e32\u0e23\u0e2a\u0e2b\u0e23\u0e31\u0e10</option></select></Field>
      {currencyCode !== config.currency && <Field label={`\u0e2d\u0e31\u0e15\u0e23\u0e32\u0e41\u0e25\u0e01\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19 (${config.currency} \u0e15\u0e48\u0e2d 1 ${currencyCode})`}><input required type="number" min="0.00000001" max="999999999999.99999999" step="0.00000001" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} className={input} /></Field>}
      <Field label="หมวดหมู่"><select required value={category} onChange={(event) => { setCategory(event.target.value); if (kind === "expense") setTreatment(event.target.value === "ซื้อวัตถุดิบ" ? "inventory" : "operating"); }} className={input}>{[...new Set([category, ...categories].filter(Boolean))].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="วิธีชำระเงิน"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as FinanceMethod)} className={input}>{[...new Set([paymentMethod, ...config.paymentMethods])].map((value) => <option key={value} value={value}>{methodNames[value]}</option>)}</select></Field>
      {kind === "expense" && <Field label="การคิดกำไร"><select value={treatment} onChange={(event) => setTreatment(event.target.value as "operating" | "inventory")} className={input}><option value="operating">ค่าใช้จ่ายดำเนินงาน — หักกำไร</option><option value="inventory">ซื้อสต็อก — ไม่หักต้นทุนซ้ำ</option></select></Field>}
      <Field label="เลขอ้างอิง"><input maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} className={input} /></Field>
    </div>
    <Field label="รายละเอียด"><textarea required maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={input} /></Field>
    <Field label="รูปใบเสร็จ JPG / PNG / WebP ไม่เกิน 5 MB">{previous?.receipt_id && !file && <p className="mb-1 text-xs text-emerald-800">ใช้รูปใบเสร็จเดิม · เลือกรูปใหม่เพื่อแทนที่</p>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && next.size > 5 * 1024 * 1024) { setError("รูปใบเสร็จต้องไม่เกิน 5 MB"); event.target.value = ""; } else { setFile(next); setError(""); } }} className={input} /></Field>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={busy} onClick={onClose} className={secondary}>ยกเลิก</button><button disabled={busy} className={primary}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button></div>
  </form></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-semibold text-slate-700">{label}{children}</label>; }
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600";
const primary = "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50";
