import { useState, type FormEvent, type ReactNode } from "react";
import { apiRequest } from "../../shared/api/client";
import type { FinanceConfig, FinanceWorkspace } from "./types";
import { financeMethods, methodNames } from "./utils";

const roles = [{ id: "staff", label: "พนักงาน" }, { id: "waiter", label: "พนักงานเสิร์ฟ" }, { id: "cook", label: "ครัว" }];
export default function FinanceSettingsPanel({ restaurantId, workspace, refresh }: { restaurantId: string; workspace: FinanceWorkspace; refresh: () => void }) {
  const [config, setConfig] = useState<FinanceConfig>(() => structuredClone(workspace.config));
  const [vat, setVat] = useState(workspace.restaurant.vat_pct);
  const [service, setService] = useState(workspace.restaurant.service_charge_pct);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function toggle(key: "paymentMethods" | "viewRoles" | "editRoles", value: string) {
    setConfig((current) => ({ ...current, [key]: current[key].includes(value as never) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = { ...config, incomeCategories: config.incomeCategories.map((value) => value.trim()).filter(Boolean), expenseCategories: config.expenseCategories.map((value) => value.trim()).filter(Boolean), vatPct: Number(vat), serviceChargePct: Number(service) };
      await apiRequest(`/api/restaurants/${restaurantId}/finance/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage("บันทึกการตั้งค่าแล้ว"); refresh();
    } catch { setError("บันทึกการตั้งค่าไม่สำเร็จ ตรวจสอบหมวดหมู่ สิทธิ์ และเปอร์เซ็นต์"); }
    finally { setBusy(false); }
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4"><h2 className="text-lg font-bold">ตั้งค่าการเงิน</h2><p className="mt-1 text-sm text-slate-500">เจ้าของร้านดูและแก้ไขได้เสมอ การตั้งค่าและยอดยกมาจำกัดเฉพาะเจ้าของ</p></div><form onSubmit={save} className="space-y-5"><fieldset disabled={busy || !workspace.isOwner} className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2"><Field label="สกุลเงินหลักของร้าน"><select disabled={!workspace.currencyEditable} value={config.currency} onChange={(event) => setConfig({ ...config, currency: event.target.value as FinanceConfig["currency"] })} className={input}><option value="LAK">LAK — ກີບ</option><option value="THB">THB — บาทไทย</option><option value="USD">USD — ดอลลาร์สหรัฐ</option></select><span className="text-xs font-normal text-slate-500">{workspace.currencyEditable ? "เลือกสกุลเงินหลักของร้านก่อนเริ่มบันทึกข้อมูล" : "ร้านนี้เริ่มบันทึกรายการแล้ว จึงล็อกสกุลเงินเพื่อรักษายอดเดิม"}</span></Field><div className="grid grid-cols-2 gap-3"><Field label="VAT (%)"><input type="number" min="0" max="100" step="0.01" value={vat} onChange={(event) => setVat(event.target.value)} className={input} /></Field><Field label="ค่าบริการ (%)"><input type="number" min="0" max="100" step="0.01" value={service} onChange={(event) => setService(event.target.value)} className={input} /></Field></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="หมวดรายรับ (หนึ่งหมวดต่อบรรทัด)"><textarea rows={7} value={config.incomeCategories.join("\n")} onChange={(event) => setConfig({ ...config, incomeCategories: event.target.value.split("\n") })} className={input} /></Field><Field label="หมวดรายจ่าย (หนึ่งหมวดต่อบรรทัด)"><textarea rows={7} value={config.expenseCategories.join("\n")} onChange={(event) => setConfig({ ...config, expenseCategories: event.target.value.split("\n") })} className={input} /></Field></div>
    <div><h3 className="font-semibold">วิธีชำระเงินสำหรับรายการบันทึกเอง</h3><CheckList values={financeMethods.map((value) => [value, methodNames[value]] as const)} selected={config.paymentMethods} onToggle={(value) => toggle("paymentMethods", value)} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><RoleChecks title="ดูข้อมูลการเงิน" selected={config.viewRoles} onToggle={(value) => toggle("viewRoles", value)} /><RoleChecks title="แก้ไขข้อมูลการเงิน" selected={config.editRoles} onToggle={(value) => toggle("editRoles", value)} /></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <button disabled={busy || !workspace.isOwner} className={primary}>{busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button>
  </fieldset></form><p className="mt-4 text-xs text-slate-500">ภาษีและค่าบริการใช้กับการตั้งค่าร้าน · ส่วนลดจัดการในโปรโมชั่น · รายงานอ่านยอดบิลที่ชำระจริง · <a className="text-emerald-800 underline" href="/dashboard/promotions">จัดการโปรโมชั่น</a></p></section>;
}

function RoleChecks({ title, selected, onToggle }: { title: string; selected: string[]; onToggle: (value: string) => void }) { return <div><h3 className="font-semibold">{title}</h3><CheckList values={roles.map((role) => [role.id, role.label] as const)} selected={selected} onToggle={onToggle} /></div>; }
function CheckList({ values, selected, onToggle }: { values: readonly (readonly [string, string])[]; selected: string[]; onToggle: (value: string) => void }) { return <div className="mt-2 flex flex-wrap gap-2">{values.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} />{label}</label>)}</div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-semibold">{label}{children}</label>; }
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal";
const primary = "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
