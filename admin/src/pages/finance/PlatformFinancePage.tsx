import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";

type FinanceKind = "income" | "expense";
type Currency = "LAK" | "THB" | "USD";
type PaymentMethod = "cash" | "transfer" | "qr" | "card" | "other";
interface FinanceEntry {
  id: string;
  kind: FinanceKind;
  entry_date: string;
  category: string;
  description: string;
  amount: string;
  currency_code: Currency;
  payment_method: PaymentMethod;
  reference: string;
  source: "manual" | "pro_package";
  restaurant_name: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  created_by_email: string | null;
  voided_by_email: string | null;
}
interface FinanceSummary { currency_code: Currency; amount: string; entry_count: number; pro_package_count: number }
interface FinanceCategory { currency_code: Currency; category: string; amount: string; entry_count: number }
interface FinanceResponse { entries: FinanceEntry[]; summary: FinanceSummary[]; categories: FinanceCategory[]; page: number; pageSize: number }
interface NewFinanceEntry {
  requestKey: string; kind: FinanceKind; entryDate: string; category: string; description: string;
  amount: string; currencyCode: Currency; paymentMethod: PaymentMethod; reference: string;
}

const currencies: Currency[] = ["LAK", "THB", "USD"];
const paymentMethods: Array<[PaymentMethod, string]> = [["cash", "เงินสด"], ["transfer", "โอน / ธนาคาร"], ["qr", "QR Payment"], ["card", "บัตร"], ["other", "อื่น ๆ"]];
const paymentMethodNames = Object.fromEntries(paymentMethods) as Record<PaymentMethod, string>;
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700";

export default function PlatformFinancePage({ kind, canManage }: { kind: FinanceKind; canManage: boolean }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [currency, setCurrency] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [otherSummary, setOtherSummary] = useState<FinanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showEntry, setShowEntry] = useState(false);
  const [voiding, setVoiding] = useState<FinanceEntry | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ kind, from, to, currency, page: String(page) });
    const otherKind: FinanceKind = kind === "income" ? "expense" : "income";
    const otherQuery = new URLSearchParams({ kind: otherKind, from, to, currency, page: "1" });
    try {
      const [current, other] = await Promise.all([
        adminRequest<FinanceResponse>(`/api/admin/finance?${query}`),
        adminRequest<FinanceResponse>(`/api/admin/finance?${otherQuery}`),
      ]);
      setData(current);
      setOtherSummary(other.summary);
    } catch (cause) {
      setError(cause instanceof AdminApiError ? `โหลดข้อมูลการเงินไม่สำเร็จ (${cause.code})` : "โหลดข้อมูลการเงินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [kind, from, to, currency, page]);

  useEffect(() => { void load(); }, [load]);

  function setRange(start: string, end = today()) {
    setFrom(start);
    setTo(end);
    setPage(1);
  }

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      const entries: FinanceEntry[] = [];
      for (let exportPage = 1; ; exportPage++) {
        const query = new URLSearchParams({ kind, from, to, currency, page: String(exportPage) });
        const result = await adminRequest<FinanceResponse>(`/api/admin/finance?${query}`);
        entries.push(...result.entries);
        if (result.entries.length < result.pageSize) break;
      }

      const headers = ["ประเภทรายการ", "วันที่", "หมวดหมู่", "รายละเอียด", "ร้านค้า", "ช่องทาง", "เลขอ้างอิง", "ยอดเงิน", "สกุลเงิน", "แหล่งที่มา", "สถานะ", "เหตุผลยกเลิก", "ผู้บันทึก", "ผู้ยกเลิก"];
      const rows = entries.map((entry) => [
        kind === "income" ? "รายรับ" : "รายจ่าย",
        entry.entry_date,
        entry.category,
        entry.description,
        entry.restaurant_name ?? "",
        paymentMethodNames[entry.payment_method] ?? entry.payment_method,
        entry.reference,
        entry.amount,
        entry.currency_code,
        entry.source === "pro_package" ? "แพ็กเกจ Pro" : "บันทึกเอง",
        entry.voided_at ? "ยกเลิกแล้ว" : "ปกติ",
        entry.void_reason ?? "",
        entry.created_by_email ?? "",
        entry.voided_by_email ?? "",
      ]);
      const content = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `platform-${kind}-${from}-${to}${currency === "all" ? "" : `-${currency}`}.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`ส่งออก CSV แล้ว ${entries.length.toLocaleString("th-TH")} รายการ`);
    } catch (cause) {
      setError(cause instanceof AdminApiError ? `ส่งออก CSV ไม่สำเร็จ (${cause.code})` : "ส่งออก CSV ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  async function createEntry(entry: NewFinanceEntry) {
    setBusy(true);
    setError("");
    try {
      await adminRequest("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      setShowEntry(false);
      setNotice(kind === "income" ? "บันทึกรายรับแล้ว" : "บันทึกรายจ่ายแล้ว");
      setPage(1);
      await load();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? `บันทึกรายการไม่สำเร็จ (${cause.code})` : "บันทึกรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function voidEntry() {
    if (!voiding || !voidReason.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/api/admin/finance/${voiding.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      setVoiding(null);
      setVoidReason("");
      setNotice("ยกเลิกรายการแล้ว พร้อมเก็บประวัติเดิมไว้");
      await load();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? `ยกเลิกรายการไม่สำเร็จ (${cause.code})` : "ยกเลิกรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const title = kind === "income" ? "รายรับแพลตฟอร์ม" : "รายจ่ายแพลตฟอร์ม";
  const totalCount = (data?.summary ?? []).reduce((sum, row) => sum + row.entry_count, 0);
  const proCount = (data?.summary ?? []).reduce((sum, row) => sum + row.pro_package_count, 0);

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-800">PLATFORM FINANCE</p><h1 className="mt-1 text-3xl font-semibold">{title}</h1><p className="mt-1 text-base text-slate-500">บันทึกและตรวจสอบการเงินของแพลตฟอร์ม แยกจากบัญชีของแต่ละร้าน</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void exportCsv()} disabled={exporting} className="rounded-lg border border-emerald-800 px-4 py-2.5 text-base font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">{exporting ? "กำลังส่งออก…" : "ส่งออก CSV"}</button>{canManage && <button type="button" onClick={() => { setError(""); setShowEntry(true); }} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-900">{kind === "income" ? "+ เพิ่มรายรับ" : "+ บันทึกรายจ่าย"}</button>}</div></header>
    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="grid gap-1 text-sm text-slate-500">ตั้งแต่<input className={inputClass} type="date" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
      <label className="grid gap-1 text-sm text-slate-500">ถึง<input className={inputClass} type="date" value={to} min={from} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
      <label className="grid gap-1 text-sm text-slate-500">สกุลเงิน<select className={inputClass} value={currency} onChange={(event) => { setCurrency(event.target.value); setPage(1); }}><option value="all">ทุกสกุล</option>{currencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="flex flex-wrap gap-2">{[
        ["วันนี้", today()], ["7 วัน", daysAgo(6)], ["30 วัน", daysAgo(29)], ["เดือนนี้", monthStart()], ["ปีนี้", yearStart()],
      ].map(([label, start]) => <button key={label} type="button" onClick={() => setRange(start)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">{label}</button>)}</div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40">↻ รีเฟรช</button>
    </section>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-base text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-base text-red-800">{error}</p>}
    {data && <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="mb-3"><h2 className="text-lg font-semibold">กำไรสุทธิแพลตฟอร์ม</h2><p className="text-sm text-slate-500">{from} ถึง {to} · รายรับแพลตฟอร์ม − รายจ่ายแพลตฟอร์ม</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {currencies.filter((code) => currency === "all" || currency === code).map((code) => {
          const incomeRows = kind === "income" ? data.summary : otherSummary;
          const expenseRows = kind === "expense" ? data.summary : otherSummary;
          const income = Number(incomeRows.find((row) => row.currency_code === code)?.amount ?? 0);
          const expense = Number(expenseRows.find((row) => row.currency_code === code)?.amount ?? 0);
          const net = income - expense;
          return <article key={code} className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">คงเหลือสุทธิ · {code}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${net < 0 ? "text-rose-700" : "text-emerald-800"}`}>{formatMoney(net, code)}</p>
            <div className="mt-3 flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm"><span>รายรับ</span><strong className="tabular-nums">{formatMoney(income, code)}</strong></div>
            <div className="mt-1 flex justify-between gap-3 text-sm"><span>รายจ่าย</span><strong className="tabular-nums">{formatMoney(expense, code)}</strong></div>
          </article>;
        })}
      </div>
    </section>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {currencies.filter((code) => currency === "all" || currency === code).map((code, index) => {
        const summary = data?.summary.find((row) => row.currency_code === code);
        const tones = ["border-emerald-200 bg-emerald-50 text-emerald-800", "border-sky-200 bg-sky-50 text-sky-800", "border-amber-200 bg-amber-50 text-amber-800"];
        return <article key={code} className={`rounded-2xl border p-4 ${tones[index]}`}><p className="text-base">{kind === "income" ? "รายรับสุทธิ" : "รายจ่ายสุทธิ"} · {code}</p><p className="mt-2 text-3xl font-bold tabular-nums">{formatMoney(summary?.amount ?? "0", code)}</p><p className="mt-1 text-sm">{summary?.entry_count ?? 0} รายการ{kind === "income" && ` · แพ็กเกจ Pro ${summary?.pro_package_count ?? 0} รายการ`}</p></article>;
      })}
      <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-base text-slate-500">รายการในช่วงที่เลือก</p><p className="mt-2 text-3xl font-bold text-slate-800">{totalCount.toLocaleString("th-TH")}</p><p className="mt-1 text-sm text-slate-500">ไม่นับรายการที่ยกเลิก</p></article>
    </section>
    {!!data?.categories.length && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">สรุปตามหมวดหมู่</h2><div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{currencies.filter((code) => currency === "all" || currency === code).map((code) => <div key={code}><h3 className="mb-2 text-sm font-semibold text-slate-500">{code}</h3><div className="space-y-2">{data.categories.filter((row) => row.currency_code === code).map((row) => <div key={`${code}:${row.category}`} className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-base"><span>{row.category} <small className="text-slate-400">({row.entry_count})</small></span><strong className="whitespace-nowrap tabular-nums">{formatMoney(row.amount, code)}</strong></div>)}</div></div>)}</div></section>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><div><h2 className="font-semibold">รายการ{kind === "income" ? "รายรับ" : "รายจ่าย"}</h2><p className="mt-1 text-sm text-slate-500">{from} ถึง {to} · แสดงสูงสุด 50 รายการต่อหน้า</p></div><span className="text-sm text-slate-500">{kind === "income" ? `รายรับ Pro ที่ยืนยันรับเงินแล้ว ${proCount} รายการ` : "ยอดรวมไม่รวมรายการที่ยกเลิก"}</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-base"><thead className="bg-slate-50 text-sm text-slate-500"><tr>{["วันที่", "หมวดหมู่", "รายละเอียด", "ช่องทาง", "ผู้บันทึก", "ยอดเงิน", "แหล่งที่มา", "จัดการ"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(data?.entries ?? []).map((entry) => <tr key={entry.id} className={entry.voided_at ? "bg-slate-50 opacity-60" : ""}>
        <td className="whitespace-nowrap px-3 py-3 text-sm">{entry.entry_date}</td><td className="px-3 py-3">{entry.category}</td><td className="max-w-sm px-3 py-3"><p className="truncate font-medium" title={entry.description}>{entry.description}</p>{entry.restaurant_name && <p className="mt-1 text-sm text-slate-500">ร้าน {entry.restaurant_name}</p>}{entry.reference && <p className="mt-1 text-sm text-slate-500">อ้างอิง {entry.reference}</p>}{entry.void_reason && <p className="mt-1 text-sm text-rose-700">เหตุผลยกเลิก: {entry.void_reason}</p>}</td><td className="px-3 py-3">{paymentMethodNames[entry.payment_method]}</td><td className="px-3 py-3 text-sm">{entry.voided_at ? entry.voided_by_email || "—" : entry.created_by_email || "—"}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(entry.amount, entry.currency_code)}</td><td className="px-3 py-3">{entry.voided_at ? <span className="rounded-full bg-slate-200 px-2 py-1 text-sm text-slate-700">ยกเลิกแล้ว</span> : entry.source === "pro_package" ? <span className="rounded-full bg-indigo-50 px-2 py-1 text-sm font-medium text-indigo-700">แพ็กเกจ Pro</span> : <span className="text-sm text-slate-500">บันทึกเอง</span>}</td><td className="px-3 py-3 text-right">{canManage && entry.source === "manual" && !entry.voided_at && <button type="button" onClick={() => { setVoiding(entry); setVoidReason(""); }} className="whitespace-nowrap text-sm text-rose-700 underline">ยกเลิกรายการ</button>}</td>
      </tr>)}</tbody></table>{!loading && !data?.entries.length && <p className="p-10 text-center text-base text-slate-500">ไม่มีรายการในช่วงวันที่เลือก</p>}{loading && <p role="status" className="p-3 text-center text-sm text-slate-500">กำลังโหลด…</p>}</div>
      <div className="flex items-center justify-between border-t border-slate-100 p-3"><span className="text-sm text-slate-500">หน้า {page}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">ก่อนหน้า</button><button type="button" disabled={loading || (data?.entries.length ?? 0) < 50} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">ถัดไป</button></div></div>
    </section>
    {showEntry && <FinanceEntryDialog kind={kind} busy={busy} error={error} onClose={() => { if (!busy) setShowEntry(false); }} onSubmit={createEntry} />}
    {voiding && <VoidEntryDialog entry={voiding} reason={voidReason} busy={busy} onReason={setVoidReason} onClose={() => { if (!busy) setVoiding(null); }} onConfirm={() => void voidEntry()} />}
  </div>;
}

function FinanceEntryDialog({ kind, busy, error, onClose, onSubmit }: { kind: FinanceKind; busy: boolean; error: string; onClose: () => void; onSubmit: (entry: NewFinanceEntry) => void }) {
  const [requestKey] = useState(() => crypto.randomUUID());
  const [entryDate, setEntryDate] = useState(today());
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState<Currency>("LAK");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [reference, setReference] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ requestKey, kind, entryDate, category: category.trim(), description: description.trim(), amount: amount.trim(), currencyCode, paymentMethod, reference: reference.trim() });
  }

  return <Modal title={kind === "income" ? "เพิ่มรายรับ" : "บันทึกรายจ่าย"} onClose={onClose}>
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><Field label="วันที่"><input required type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className={inputClass} /></Field><Field label="หมวดหมู่"><input required maxLength={100} value={category} onChange={(event) => setCategory(event.target.value)} placeholder={kind === "income" ? "เช่น รายรับอื่น ๆ" : "เช่น เซิร์ฟเวอร์"} className={inputClass} /></Field></div>
      <Field label="รายละเอียด"><input required maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="จำนวนเงิน"><input required type="number" min="0.01" max="999999999999.99" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} /></Field><Field label="สกุลเงิน"><select value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value as Currency)} className={inputClass}>{currencies.map((item) => <option key={item}>{item}</option>)}</select></Field></div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="ช่องทาง"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className={inputClass}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="เลขอ้างอิง (ถ้ามี)"><input maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} className={inputClass} /></Field></div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-800">{error}</p>}
      <div className="flex justify-end gap-2 pt-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-base">ยกเลิก</button><button disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2 text-base font-semibold text-white disabled:opacity-40">{busy ? "กำลังบันทึก…" : "บันทึกรายการ"}</button></div>
    </form>
  </Modal>;
}

function VoidEntryDialog({ entry, reason, busy, onReason, onClose, onConfirm }: { entry: FinanceEntry; reason: string; busy: boolean; onReason: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  return <Modal title="ยกเลิกรายการการเงิน" onClose={onClose}>
    <div className="space-y-3"><p className="text-base text-slate-600">{entry.description} · {formatMoney(entry.amount, entry.currency_code)}</p><Field label="เหตุผลที่ยกเลิก"><textarea required minLength={1} maxLength={1000} rows={3} value={reason} onChange={(event) => onReason(event.target.value)} className={inputClass} /></Field><p className="text-sm text-slate-500">รายการเดิมจะยังอยู่ในประวัติและถูกตัดออกจากยอดรวม</p><div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-base">กลับ</button><button type="button" disabled={busy || !reason.trim()} onClick={onConfirm} className="rounded-lg bg-rose-700 px-4 py-2 text-base font-semibold text-white disabled:opacity-40">{busy ? "กำลังบันทึก…" : "ยืนยันยกเลิก"}</button></div></div>
  </Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3" onClick={onClose}><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header className="mb-4 flex items-start justify-between gap-3"><h2 className="text-2xl font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-base">ปิด</button></header>{children}</section></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1 text-sm font-medium text-slate-600">{label}{children}</label>; }
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function formatMoney(value: number | string, currency: Currency) { return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: currency === "LAK" ? 0 : 2 }).format(Number(value) || 0); }
function today() { return dateInBangkok(new Date()); }
function monthStart() { return `${today().slice(0, 8)}01`; }
function yearStart() { return `${today().slice(0, 4)}-01-01`; }
function daysAgo(days: number) { const date = new Date(`${today()}T00:00:00+07:00`); date.setDate(date.getDate() - days); return dateInBangkok(date); }
function dateInBangkok(date: Date) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; }
