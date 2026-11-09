import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import type { FinanceAccount, FinanceMethod, FinanceWorkspace } from "./types";
import { financeMethods, formatDateTime, formatMoney, localDate, methodNames } from "./utils";

export default function FinanceAccountsPanel({ restaurantId, workspace, refresh, canEdit, isOwner }: { restaurantId: string; workspace: FinanceWorkspace; refresh: () => void; canEdit: boolean; isOwner: boolean }) {
  const [account, setAccount] = useState<FinanceAccount | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [transfer, setTransfer] = useState({ from: "cash" as FinanceMethod, to: "transfer" as FinanceMethod, amount: "", date: localDate(), note: "" });

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!account || busy) return;
    const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/finance/accounts/${account.method}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ name: String(form.get("name") ?? "").trim(), date: String(form.get("date") ?? ""), balance: String(form.get("balance") ?? "") }) });
      setAccount(null); setMessage("บันทึกยอดยกมาแล้ว"); refresh();
    } catch { setError("บันทึกบัญชีไม่สำเร็จ ตรวจสอบชื่อ วันที่ และยอดยกมา"); }
    finally { setBusy(false); }
  }

  async function saveTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/finance/transfers`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ ...transfer, amount: transfer.amount.trim(), note: transfer.note.trim(), requestId: crypto.randomUUID() }) });
      setTransferOpen(false); setTransfer((value) => ({ ...value, amount: "", note: "" })); setMessage("บันทึกการโอนภายในแล้ว"); refresh();
    } catch (cause) { setError(cause instanceof ApiError && cause.code === "FORBIDDEN" ? "บัญชีนี้ไม่มีสิทธิ์โอนเงิน" : "บันทึกการโอนไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองใหม่"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3"><h2 className="font-bold">เงินสดและบัญชีธนาคาร ณ {workspace.day}</h2><p className="mt-1 text-xs text-slate-500">ยอดคงเหลือ = ยอดยกมาก่อนวันเริ่ม + เงินเข้า − เงินออก ยอดนี้เป็นบัญชีภายในร้าน</p></div><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs text-slate-500"><tr>{["บัญชี", "ยอดยกมา", "วันที่เริ่ม", "เงินเข้า", "เงินออก", "คงเหลือ", ""].map((header) => <th key={header} className="border-b border-slate-100 px-2 py-2">{header}</th>)}</tr></thead><tbody>{workspace.accounts.map((row) => <tr key={row.method}><td className="border-b border-slate-100 px-2 py-3"><b>{row.name || methodNames[row.method]}</b><p className="text-xs text-slate-500">{methodNames[row.method]}</p></td><td className="border-b border-slate-100 px-2 py-3">{row.configured ? formatMoney(row.opening_balance) : "ยังไม่ตั้งยอดยกมา"}</td><td className="border-b border-slate-100 px-2 py-3">{row.opening_date ?? "—"}</td><td className="border-b border-slate-100 px-2 py-3">{formatMoney(row.income)}</td><td className="border-b border-slate-100 px-2 py-3">{formatMoney(row.expense)}</td><td className="border-b border-slate-100 px-2 py-3 font-bold">{row.configured ? formatMoney(row.balance) : "รอตั้งยอดยกมา"}</td><td className="border-b border-slate-100 px-2 py-3">{isOwner && <button onClick={() => setAccount(row)} className="text-xs font-semibold text-emerald-800 underline">ตั้งค่าบัญชี</button>}</td></tr>)}</tbody></table>{canEdit && <button onClick={() => setTransferOpen(true)} className={primary + " mt-4"}>โอนระหว่างบัญชี</button>}</section>
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-bold">ประวัติโอนภายใน</h2><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs text-slate-500"><tr>{["เวลา", "จาก", "ไป", "จำนวน", "รายละเอียด", "ผู้บันทึก"].map((header) => <th key={header} className="border-b border-slate-100 px-2 py-2">{header}</th>)}</tr></thead><tbody>{workspace.transfers.map((row) => <tr key={row.id}>{[formatDateTime(row.created_at), methodNames[row.from_method], methodNames[row.to_method], formatMoney(row.amount), row.note, row.operator ?? "—"].map((value, index) => <td key={index} className="border-b border-slate-100 px-2 py-2">{value}</td>)}</tr>)}</tbody></table>{!workspace.transfers.length && <p className="py-5 text-sm text-slate-500">ไม่มีรายการโอนในช่วงวันที่เลือก</p>}</section>
    {message && <Notice>{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}
    {account && <Modal title="ตั้งค่ายอดยกมาก่อนเริ่มวัน" onClose={() => setAccount(null)}><form onSubmit={saveAccount} className="space-y-3"><p className="text-sm text-slate-600">{methodNames[account.method]} · ตั้งยอดเริ่มต้นก่อนลงรายการให้ถูกต้อง</p><Field label="ชื่อบัญชี / ธนาคาร"><input required maxLength={100} name="name" defaultValue={account.name || methodNames[account.method]} className={input} /></Field><Field label="วันที่เริ่มนับ"><input required type="date" name="date" defaultValue={account.opening_date ?? localDate()} className={input} /></Field><Field label="ยอดยกมา (LAK)"><input required type="number" step="0.01" name="balance" defaultValue={account.opening_balance ?? "0"} className={input} /></Field><Actions busy={busy} onCancel={() => setAccount(null)} /></form></Modal>}
    {transferOpen && <Modal title="โอนระหว่างบัญชี" onClose={() => setTransferOpen(false)}><form onSubmit={saveTransfer} className="space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="จากบัญชี"><select value={transfer.from} onChange={(event) => setTransfer({ ...transfer, from: event.target.value as FinanceMethod })} className={input}>{financeMethods.map((method) => <option key={method} value={method}>{methodNames[method]}</option>)}</select></Field><Field label="ไปบัญชี"><select value={transfer.to} onChange={(event) => setTransfer({ ...transfer, to: event.target.value as FinanceMethod })}>{financeMethods.map((method) => <option key={method} value={method}>{methodNames[method]}</option>)}</select></Field></div><Field label="จำนวนเงิน"><input required type="number" min="0.01" step="0.01" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} className={input} /></Field><Field label="วันที่"><input required type="date" value={transfer.date} onChange={(event) => setTransfer({ ...transfer, date: event.target.value })} className={input} /></Field><Field label="รายละเอียด"><input required maxLength={500} value={transfer.note} onChange={(event) => setTransfer({ ...transfer, note: event.target.value })} className={input} /></Field>{error && <Notice tone="error">{error}</Notice>}<Actions busy={busy} onCancel={() => setTransferOpen(false)} /></form></Modal>}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}><section onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-bold">{title}</h3>{children}</section></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-semibold">{label}{children}</label>; }
function Actions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) { return <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onCancel} className={secondary}>ยกเลิก</button><button disabled={busy} className={primary}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button></div>; }
function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" }) { return <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${tone === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{children}</p>; }
const jsonHeaders = { "Content-Type": "application/json" };
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const primary = "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold";
