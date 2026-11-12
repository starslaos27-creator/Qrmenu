import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import FinanceAccountsPanel from "./FinanceAccountsPanel";
import FinanceClosingPanel from "./FinanceClosingPanel";
import FinanceEntryForm from "./FinanceEntryForm";
import FinanceOverview from "./FinanceOverview";
import FinanceReports from "./FinanceReports";
import FinanceSettingsPanel from "./FinanceSettingsPanel";
import { useFinanceData } from "./useFinanceData";
import type { FinanceEntry, FinanceKind } from "./types";
import { formatMoney, localDate } from "./utils";
import { useLanguage } from "../../shared/i18n/LanguageProvider";

const tabs = [
  ["dashboard", "ภาพรวม"], ["income", "รายรับ"], ["expense", "รายจ่าย"], ["cost", "ต้นทุนสินค้า"],
  ["profit", "กำไรสุทธิ"], ["transactions", "บัญชีรายการ"], ["accounts", "เงินสดและธนาคาร"],
  ["reports", "รายงาน"], ["closing", "ปิดยอดประจำวัน"], ["settings", "ตั้งค่าการเงิน"],
] as const;
type Tab = typeof tabs[number][0];

export default function FinancePage({ onLogin }: { onLogin: () => void }) {
  const { locale } = useLanguage();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [tab, setTab] = useState<Tab>(() => readTab());
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set([readTab()]));
  const [from, setFrom] = useState(() => new URLSearchParams(location.search).get("from") || `${localDate().slice(0, 7)}-01`);
  const [to, setTo] = useState(() => new URLSearchParams(location.search).get("to") || localDate());
  const [range, setRange] = useState(() => new URLSearchParams(location.search).get("range") || "month");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState<{ kind: FinanceKind; previous?: FinanceEntry } | null>(null);
  const [voiding, setVoiding] = useState<FinanceEntry | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kind = tab === "income" || tab === "expense" || tab === "cost" ? tab : "all";
  const validRange = !!from && !!to && from <= to && Date.parse(to) - Date.parse(from) <= 366 * 86400000;
  const data = useFinanceData(restaurantId, from, to, kind, page, refreshKey);

  useEffect(() => {
    let cancelled = false;
    loadRestaurantSession().then((session) => {
      if (cancelled) return;
      if (!session.membership) { setSessionError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร"); return; }
      setRestaurantId(session.membership.restaurant_id); setRole(session.membership.role);
    }).catch((cause: unknown) => {
      if (!cancelled && cause instanceof ApiError && cause.status === 401) onLogin();
      else if (!cancelled) setSessionError("โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
    });
    return () => { cancelled = true; };
  }, [onLogin]);

  useEffect(() => {
    const syncUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTab = params.get("view");
      if (tabs.some(([key]) => key === nextTab)) {
        const next = nextTab as Tab;
        setTab(next);
        setVisitedTabs((visited) => new Set(visited).add(next));
      }
      if (params.has("from")) setFrom(params.get("from") ?? "");
      if (params.has("to")) setTo(params.get("to") ?? "");
      if (params.has("range")) setRange(params.get("range") ?? "custom");
    };
    window.addEventListener("popstate", syncUrl);
    return () => window.removeEventListener("popstate", syncUrl);
  }, []);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  function selectTab(next: Tab) {
    setTab(next); setPage(1);
    setVisitedTabs((visited) => new Set(visited).add(next));
    const url = new URL(window.location.href); url.searchParams.set("view", next); url.searchParams.set("from", from); url.searchParams.set("to", to); url.searchParams.set("range", range);
    window.history.pushState({}, "", url);
  }
  function chooseRange(next: string) {
    const today = localDate(); let start = from; let end = to;
    if (next === "today") start = end = today;
    else if (next === "7" || next === "30") { const date = new Date(`${today}T12:00:00+07:00`); date.setDate(date.getDate() - Number(next) + 1); start = date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); end = today; }
    else if (next === "month") { start = `${today.slice(0, 7)}-01`; end = today; }
    else if (next === "year") { start = `${today.slice(0, 4)}-01-01`; end = today; }
    setFrom(start); setTo(end); setRange(next); setPage(1);
  }

  async function exportLedger() {
    if (!restaurantId || !validRange || busy) return;
    setBusy(true); setError("");
    try {
      const result = await apiRequest<{ csv: string }>(`/api/restaurants/${restaurantId}/finance/export?from=${from}&to=${to}&format=json&locale=${locale}`);
      downloadCsv(`shopqr-finance-${from}-${to}.csv`, result.csv);
    } catch { setError("ส่งออกสมุดรายวันไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function cancelEntry(entry: FinanceEntry, reason: string) {
    if (!restaurantId || busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/finance/entries/${entry.entryId}/void`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ reason }) });
      setVoiding(null); refresh();
    } catch { setError("ยกเลิกรายการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function showReceipt(receiptId: string) {
    if (!restaurantId) return;
    try { const result = await apiRequest<{ dataUrl: string }>(`/api/restaurants/${restaurantId}/finance/receipts/${receiptId}`); setReceipt(result.dataUrl); }
    catch { setError("เปิดรูปใบเสร็จไม่สำเร็จ"); }
  }

  if (sessionError) return <main className="mx-auto max-w-4xl p-6"><Notice>{sessionError}</Notice></main>;
  const accessDenied = data.error && data.error.includes("ไม่มีสิทธิ์");
  const workspace = data.workspace;
  const ledger = data.ledger;
  const maxPage = Math.max(1, Math.ceil((ledger?.count ?? 0) / (ledger?.pageSize ?? 50)));

  return <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header><p className="text-sm font-semibold text-emerald-700">การเงินร้านอาหาร</p><h1 className="mt-1 text-2xl font-bold">ระบบการเงิน</h1><p className="text-sm text-slate-500">ข้อมูลตามเวลาร้าน (UTC+7) · สกุลเงิน {workspace?.config.currency ?? "LAK"}</p></header>
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" aria-label="เมนูการเงิน">{tabs.map(([key, label]) => <button key={key} onClick={() => selectTab(key)} aria-current={tab === key ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}</nav>
    {tab !== "settings" && tab !== "closing" && <section className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3"><DateField label="ตั้งแต่วันที่" value={from} max={to} onChange={(value) => { setFrom(value); setRange("custom"); setPage(1); }} /><DateField label="ถึงวันที่" value={to} min={from} onChange={(value) => { setTo(value); setRange("custom"); setPage(1); }} /><div className="flex flex-wrap gap-1">{[["today", "วันนี้"], ["7", "7 วัน"], ["30", "30 วัน"], ["month", "เดือนนี้"], ["year", "ปีนี้"], ["custom", "กำหนดเอง"]].map(([key, label]) => <button key={key} aria-pressed={range === key} onClick={() => chooseRange(key)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${range === key ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>)}</div><button disabled={data.loading} onClick={refresh} className={secondary}>↻ อัปเดต</button><button disabled={!validRange || busy} onClick={() => void exportLedger()} className={secondary}>{busy ? "กำลังส่งออก…" : "ส่งออก CSV"}</button></section>}
    {!validRange && <Notice tone="error">เลือกช่วงวันที่ไม่เกิน 366 วัน</Notice>}
    {(data.error || error) && <Notice tone="error">{error || data.error} {data.error && <button onClick={refresh} className="ml-2 underline">ลองอีกครั้ง</button>}</Notice>}
    {accessDenied && <Notice tone="error">เจ้าของร้านสามารถกำหนดสิทธิ์การเงินในแท็บตั้งค่าได้</Notice>}
    {workspace && ledger && <>{ledger.summary.incompleteCostOrders > 0 && <Notice tone="warning">{ledger.summary.incompleteCostOrders} ออเดอร์มีต้นทุนไม่ครบ กำไรหักเฉพาะต้นทุนที่ทราบ</Notice>}{ledger.summary.possibleDuplicateCostExpenses > 0 && <Notice tone="warning">พบรายจ่ายวัตถุดิบที่อาจซ้ำกับต้นทุนขาย กรุณาตรวจสอบประเภทค่าใช้จ่าย</Notice>}
      {visitedTabs.has("dashboard") && <div hidden={tab !== "dashboard"}><FinanceOverview workspace={workspace} ledger={ledger} /></div>}
      {(["income", "expense", "cost", "profit", "transactions"] as const).map((ledgerTab) => visitedTabs.has(ledgerTab) && <div key={ledgerTab} hidden={tab !== ledgerTab}><FinanceLedgerView tab={ledgerTab} workspace={workspace} ledger={ledger} canEdit={data.access?.edit ?? false} loading={data.loading} onAdd={(kind) => setForm({ kind })} onReplace={(entry) => setForm({ kind: entry.kind === "expense" ? "expense" : "income", previous: entry })} onVoid={setVoiding} onReceipt={showReceipt} page={page} maxPage={maxPage} count={ledgerTab === "cost" ? workspace.costs.length : ledger.count} setPage={setPage} /></div>)}
      {visitedTabs.has("reports") && <div hidden={tab !== "reports"}><FinanceReports workspace={workspace} ledger={ledger} /></div>}
      {visitedTabs.has("accounts") && <div hidden={tab !== "accounts"}><FinanceAccountsPanel restaurantId={restaurantId!} workspace={workspace} refresh={refresh} canEdit={data.access?.edit ?? false} isOwner={data.access?.owner ?? role === "owner"} /></div>}
      {visitedTabs.has("closing") && <div hidden={tab !== "closing"}><FinanceClosingPanel restaurantId={restaurantId!} workspace={workspace} refresh={refresh} canEdit={data.access?.edit ?? false} /></div>}
      {visitedTabs.has("settings") && <div hidden={tab !== "settings"}><FinanceSettingsPanel restaurantId={restaurantId!} workspace={workspace} refresh={refresh} /></div>}
    </>}
    {data.loading && !workspace && <p role="status" className="rounded-xl bg-white p-8 text-center text-slate-500">กำลังโหลดข้อมูลการเงิน…</p>}
    {form && restaurantId && workspace && <FinanceEntryForm key={form.previous?.entryId ?? form.kind} restaurantId={restaurantId} kind={form.kind} previous={form.previous} config={workspace.config} onClose={() => { setForm(null); setError(""); }} onSaved={() => { setForm(null); refresh(); }} />}
    {voiding && <VoidEntryDialog entry={voiding} busy={busy} error={error} onClose={() => { setVoiding(null); setError(""); }} onSubmit={(reason) => void cancelEntry(voiding, reason)} />}
    {receipt && <Modal title="รูปใบเสร็จ" onClose={() => setReceipt(null)}><img src={receipt} alt="ใบเสร็จที่แนบมากับรายการ" className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain" /></Modal>}
  </main>;
}

function FinanceLedgerView({ tab, workspace, ledger, canEdit, loading, onAdd, onReplace, onVoid, onReceipt, page, maxPage, count, setPage }: { tab: string; workspace: NonNullable<ReturnType<typeof useFinanceData>["workspace"]>; ledger: NonNullable<ReturnType<typeof useFinanceData>["ledger"]>; canEdit: boolean; loading: boolean; onAdd: (kind: FinanceKind) => void; onReplace: (entry: FinanceEntry) => void; onVoid: (entry: FinanceEntry) => void; onReceipt: (id: string) => void; page: number; maxPage: number; count: number; setPage: (value: number | ((page: number) => number)) => void }) {
  const rows: FinanceEntry[] = tab === "cost" ? workspace.costs.map((cost) => ({ id: cost.id, entryId: cost.id, date: "—", kind: "cost", category: "ต้นทุนเมนู", description: cost.name, amount: cost.recipe_cost, currency_code: "LAK", currency_amount: cost.recipe_cost, exchange_rate: "1", payment_method: "other", source: "cost", reference: "", treatment: "operating", voided_at: null, void_reason: null, cost_incomplete: cost.missing > 0, bill_number: null, table_name: null, operator: null, receipt_id: null, replaces_id: null, created_at: "" })) : ledger.entries;
  const title = ({ income: "รายรับ", expense: "รายจ่าย", cost: "ต้นทุนสินค้า", profit: "กำไรสุทธิ", transactions: "สมุดบัญชีรายการ" } as Record<string, string>)[tab];
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-slate-500">{count} รายการ · {formatMoney(ledger.summary.income)} รับ · {formatMoney(Number(ledger.summary.expense) + Number(ledger.summary.cost))} จ่ายและต้นทุน</p></div>{canEdit && tab === "income" && <button onClick={() => onAdd("income")} className={primary}>+ เพิ่มรายรับ</button>}{canEdit && tab === "expense" && <button onClick={() => onAdd("expense")} className={primary}>+ บันทึกรายจ่าย</button>}</div>
    {tab === "profit" && <div className="grid gap-3 sm:grid-cols-3"><Summary label="รายรับ" value={ledger.summary.income} /><Summary label="ต้นทุนอาหาร" value={ledger.summary.cost} /><Summary label="กำไรสุทธิ" value={ledger.summary.net} /></div>}
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[940px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">วันที่</th><th className="px-3 py-3">ประเภท</th><th className="px-3 py-3">หมวดหมู่</th><th className="px-3 py-3">รายละเอียด</th><th className="px-3 py-3">ช่องทาง</th><th className="px-3 py-3">ผู้บันทึก</th><th className="px-3 py-3 text-right">จำนวน ({workspace.config.currency})</th><th className="px-3 py-3">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((entry) => <tr key={entry.id} className={entry.voided_at ? "opacity-50" : ""}><td className="whitespace-nowrap px-3 py-3">{entry.date}</td><td className="px-3 py-3">{entry.kind === "income" ? "รายรับ" : entry.kind === "cost" ? "ต้นทุน" : "รายจ่าย"}{entry.voided_at ? " · ยกเลิก" : ""}</td><td className="px-3 py-3">{entry.category}</td><td className="max-w-xs px-3 py-3"><p className="truncate">{entry.description}</p>{entry.bill_number && <p className="text-xs text-slate-500">บิล {entry.bill_number}{entry.table_name ? ` · โต๊ะ ${entry.table_name}` : ""}</p>}</td><td className="px-3 py-3">{methodLabel(entry.payment_method)}</td><td className="px-3 py-3">{entry.operator ?? "—"}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(entry.amount)}{entry.currency_code !== workspace.config.currency && <p className="mt-1 text-xs font-normal text-slate-500">{Number(entry.currency_amount).toLocaleString("th-TH")} {entry.currency_code} @ {entry.exchange_rate}</p>}</td><td className="space-x-2 px-3 py-3">{entry.receipt_id && <button onClick={() => onReceipt(entry.receipt_id!)} className="text-xs text-emerald-800 underline">ดูใบเสร็จ</button>}{canEdit && entry.source === "manual" && (entry.voided_at ? <button onClick={() => onReplace(entry)} className="text-xs text-emerald-800 underline">บันทึกทดแทน</button> : <button onClick={() => onVoid(entry)} className="text-xs text-rose-700 underline">ยกเลิก / แก้ไข</button>)}{entry.cost_incomplete && <span title="ต้นทุนเมนูยังไม่ครบ" className="text-amber-700">⚠</span>}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">ไม่มีรายการในช่วงวันที่เลือก</p>}{loading && <p className="p-2 text-center text-xs text-slate-500">กำลังอัปเดต…</p>}</section>
    <footer className="flex items-center justify-between text-sm text-slate-500"><span>{count} รายการ · หน้า {page} / {maxPage}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className={secondary}>ก่อนหน้า</button><button disabled={page >= maxPage} onClick={() => setPage((value) => value + 1)} className={secondary}>ถัดไป</button></div></footer>
  </section>;
}

function VoidEntryDialog({ entry, busy, error, onClose, onSubmit }: { entry: FinanceEntry; busy: boolean; error: string; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (reason.trim()) onSubmit(reason.trim()); }
  return <Modal title="ยกเลิกรายการการเงิน" onClose={onClose}><form onSubmit={submit} className="space-y-3"><p className="text-sm text-slate-600">ยกเลิก {entry.description} จำนวน {formatMoney(entry.amount)} รายการเดิมจะคงอยู่ในประวัติ</p><label className="block text-sm font-semibold">เหตุผล<input autoFocus required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={input} /></label>{error && <Notice tone="error">{error}</Notice>}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={secondary}>กลับ</button><button disabled={busy} className={danger}>{busy ? "กำลังบันทึก…" : "ยืนยันยกเลิก"}</button></div></form></Modal>;
}
function DateField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) { return <label className="grid gap-1 text-xs font-semibold text-slate-600">{label}<input type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className={input} /></label>; }
function Summary({ label, value }: { label: string; value: string | number }) { return <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{formatMoney(value)}</p></article>; }
function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "warning" }) { const styles = { info: "bg-slate-100 text-slate-700", error: "bg-rose-50 text-rose-800", warning: "bg-amber-50 text-amber-900" }; return <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${styles[tone]}`}>{children}</p>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}><section onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><header className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="ปิด" className="text-xl">×</button></header>{children}</section></div>; }
function readTab(): Tab { const tab = new URLSearchParams(window.location.search).get("view"); return tabs.some(([key]) => key === tab) ? tab as Tab : "dashboard"; }
function methodLabel(value: string) { return ({ cash: "เงินสด", transfer: "โอน / ธนาคาร", qr: "QR Payment", promptpay: "QR Payment", card: "บัตร", other: "อื่น ๆ" } as Record<string, string>)[value] ?? value; }
function downloadCsv(name: string, csv: string) { const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const jsonHeaders = { "Content-Type": "application/json" };
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600";
const primary = "rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";
const danger = "rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
