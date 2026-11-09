import type { ReactNode } from "react";
import type { FinanceLedger, FinanceWorkspace } from "./types";
import { formatMoney } from "./utils";

export default function FinanceReports({ workspace, ledger }: { workspace: FinanceWorkspace; ledger: FinanceLedger }) {
  return <div className="grid gap-4 xl:grid-cols-2">
    <Panel title="รายงานหมวดรายรับและรายจ่าย"><Table headers={["หมวดหมู่", "ประเภท", "จำนวนเงิน"]} rows={ledger.categories.map((row) => [row.category, row.kind === "income" ? "รายรับ" : "รายจ่าย", formatMoney(row.amount)])} /></Panel>
    <Panel title="ยอดขายตามเมนู"><Table headers={["เมนู", "จำนวนขาย", "ยอดขาย"]} rows={workspace.menus.map((row) => [row.name, Number(row.quantity).toLocaleString(), formatMoney(row.sales)])} /></Panel>
    <Panel title="ยอดขายตามผู้รับชำระ"><Table headers={["พนักงาน", "จำนวนบิล", "ยอดขาย"]} rows={workspace.staff.map((row) => [row.name, row.bills.toLocaleString(), formatMoney(row.sales)])} /></Panel>
    <Panel title="ต้นทุนสูตรอาหารโดยประมาณ"><Table headers={["เมนู", "ต้นทุนต่อรายการ", "วัตถุดิบขาดต้นทุน"]} rows={workspace.costs.map((row) => [<div key={row.id}><b>{row.name}</b><p className="text-xs text-slate-500">{row.components.map((part) => `${part.name} ${part.quantity} ${part.unit}`).join(" · ") || "ใช้ต้นทุนคงที่จากเมนู"}</p></div>, formatMoney(row.recipe_cost), row.missing ? `ขาด ${row.missing} รายการ` : "ครบ"])} /></Panel>
    <Panel title="วัตถุดิบที่ถูกใช้ในช่วงนี้"><Table headers={["วัตถุดิบ", "ใช้ไป", "คงเหลือ", "ต้นทุนล่าสุด"]} rows={workspace.ingredients.map((row) => [row.name, `${row.used} ${row.unit}`, `${row.balance} ${row.unit}`, row.unit_cost ? formatMoney(row.unit_cost) : "ยังไม่บันทึก"])}/></Panel>
    <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-bold">สรุปช่วงวันที่เลือก</h2><div className="space-y-2 text-sm">{[["ยอดขาย", ledger.summary.sales], ["รายรับอื่น", ledger.summary.otherIncome], ["รายรับรวม", ledger.summary.income], ["ค่าใช้จ่ายดำเนินงาน", ledger.summary.expense], ["ซื้อสต็อก", ledger.summary.inventoryPurchases], ["ต้นทุนขาย", ledger.summary.cost], ["กำไรสุทธิ", ledger.summary.net]].map(([label, value]) => <div key={String(label)} className="flex justify-between border-b border-slate-100 py-2"><span>{label}</span><strong>{formatMoney(value)}</strong></div>)}</div></section>
  </div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-bold">{title}</h2>{children}</section>; }
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead className="text-left text-xs text-slate-500"><tr>{headers.map((header) => <th key={header} className="border-b border-slate-100 px-2 py-2">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-slate-100 px-2 py-2">{cell}</td>)}</tr>)}</tbody></table></div> : <p className="py-6 text-center text-sm text-slate-500">ไม่มีข้อมูลในช่วงที่เลือก</p>; }
