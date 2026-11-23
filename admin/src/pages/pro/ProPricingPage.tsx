import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";

interface Pricing {monthly_usd:string|null;version:number;updated_at:string}
const packages=[{paid:1,free:0},{paid:3,free:0},{paid:6,free:1},{paid:9,free:1},{paid:12,free:2}];
const trialLabels={month:"\u0e40\u0e14\u0e37\u0e2d\u0e19",free:"\u0e1f\u0e23\u0e35",trial:"\u0e17\u0e14\u0e25\u0e2d\u0e07\u0e43\u0e0a\u0e49\u0e1f\u0e23\u0e35"};
export default function ProPricingPage({canManage}:{canManage:boolean}) {
  const [months,setMonths]=useState<Record<string,number>>(() => {
    try {
      const combined=JSON.parse(localStorage.getItem("admin.pro-pricing.display") || "null");
      const saved: unknown = combined?.months ?? JSON.parse(localStorage.getItem("admin.pro-pricing.months") || "{}");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 120));
    } catch { return {}; }
  });
  const [editing,setEditing]=useState<string|null>(null);
  const [monthInput,setMonthInput]=useState("");
  const [labels,setLabels]=useState<Record<string,string>>(() => {
    try {
      const combined=JSON.parse(localStorage.getItem("admin.pro-pricing.display") || "null");
      const saved: unknown=combined?.labels ?? {};
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([,value])=>typeof value === "string" && value.length <= 50));
    } catch { return {}; }
  });
  const [labelInput,setLabelInput]=useState("");
  const [disabledPackages,setDisabledPackages]=useState<string[]>(() => {
    try {
      const saved=JSON.parse(localStorage.getItem("admin.pro-pricing.display") || "null")?.disabled;
      return Array.isArray(saved) ? saved.filter((key):key is string=>typeof key === "string") : [];
    } catch { return []; }
  });
  function togglePackage(key:string) {
    const next=disabledPackages.includes(key) ? disabledPackages.filter(item=>item!==key) : [...disabledPackages,key];
    try { localStorage.setItem("admin.pro-pricing.display",JSON.stringify({months,labels,disabled:next})); }
    catch { setMessage(""); setError("บันทึกสถานะแพ็กเกจในเบราว์เซอร์ไม่สำเร็จ"); return; }
    setDisabledPackages(next); setError("");
  }
  function toggleCell(key:string, name:string) {
    const enabled=!disabledPackages.includes(key);
    return <td className="px-4 py-2.5 text-center"><button type="button" role="switch" aria-checked={enabled} aria-label={`เปิดหรือปิด ${name}`} disabled={!canManage} onClick={()=>togglePackage(key)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${enabled ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-100 text-red-800"}`}>{enabled ? "เปิด" : "ปิด"}</button></td>;
  }
  function displayBonus(p:{paid:number;free:number}) {
    const label=labels[String(p.paid)];
    if (label === undefined) return p.free;
    if (!label.trim()) return 0;
    if (/^\d+$/.test(label.trim())) return Number(label.trim());
    const match=label.match(/แถม\s*(\d+)\s*เดือน/);
    return match ? Number(match[1]) : 0;
  }
  const [monthError,setMonthError]=useState("");
  const dialogRef=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=dialogRef.current;
    if (!dialog) return;
    if (editing !== null && !dialog.open) dialog.showModal();
    else if (editing === null && dialog.open) dialog.close();
  },[editing]);
  function saveMonth(event:FormEvent) {
    event.preventDefault();
    if (editing===null) return;
    const value=Number(monthInput);
    if (!Number.isInteger(value) || value < 1 || value > 120) { setMonthError("กรุณาระบุจำนวนเต็ม 1–120 เดือน"); return; }
    const bonus=labelInput.trim() === "" ? 0 : Number(labelInput);
    if (editing !== "trial" && (!Number.isInteger(bonus) || bonus < 0 || bonus > 120)) { setMonthError("กรุณาระบุจำนวนเดือนแถมเป็นจำนวนเต็ม 0–120 เดือน"); return; }
    const next={...months,[editing]:value};
    const nextLabels={...labels,[editing]:editing === "trial" ? labelInput.trim() : bonus ? `แถม ${bonus} เดือน` : ""};
    try { localStorage.setItem("admin.pro-pricing.display",JSON.stringify({months:next,labels:nextLabels,disabled:disabledPackages})); }
    catch { setMonthError("บันทึกในเบราว์เซอร์ไม่สำเร็จ"); return; }
    setMonths(next); setLabels(nextLabels); setEditing(null); setMonthError("");
  }
  function editCell(key:string, original:number, defaultLabel:string) {
    return <td className="px-4 py-2.5 text-center"><button type="button" disabled={!canManage} aria-label={`แก้ไขแพ็กเกจ ${original} เดือน${key==="trial"?" ทดลองใช้ฟรี":""}`} onClick={()=>{setEditing(key);setMonthInput(String(months[key]??original));setLabelInput(key === "trial" ? (labels[key]??defaultLabel) : String(displayBonus(packages.find(p=>p.paid===original)!)));setMonthError("");}} className="rounded-lg border border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40">แก้ไข</button></td>;
  }
  const [price,setPrice]=useState("");
  const [config,setConfig]=useState<Pricing|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  async function load() {
    setBusy(true);setError("");
    try {const data=await adminRequest<Pricing>("/api/admin/pro-pricing");setConfig(data);setPrice(data.monthly_usd||"");}
    catch {setError("โหลดราคาไม่สำเร็จ กรุณาลองใหม่");}finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[]);
  async function save(event:FormEvent) {
    event.preventDefault();if(!config||busy)return;
    setBusy(true);setError("");setMessage("");
    try {
      const data=await adminRequest<Pricing>("/api/admin/pro-pricing",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({monthlyUsd:price,version:config.version})});
      setConfig(data);setPrice(data.monthly_usd||"");setMessage("บันทึกราคาแล้ว หน้าร้านจะใช้ราคานี้เมื่อเปิดหรือโหลดหน้าใหม่");
    }catch(cause){setError(cause instanceof AdminApiError&&cause.code==="PRICE_CHANGED"?"ราคาเปลี่ยนโดยแอดมินคนอื่น กรุณาโหลดราคาล่าสุดก่อนแก้ไขอีกครั้ง":"บันทึกไม่สำเร็จ กรุณาตรวจสอบราคาแล้วลองใหม่");}finally{setBusy(false);}
  }
  const monthly=Number(price),valid=Number.isFinite(monthly)&&monthly>0&&monthly<=1000000;
  const usd=(value:number)=>value.toLocaleString("en-US",{style:"currency",currency:"USD"});
  return <div className="mx-auto max-w-4xl">
    <div className="mb-5 flex items-start gap-3"><span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-xl text-emerald-800">★</span><div><h1 className="text-xl font-bold text-emerald-950 sm:text-2xl">ตั้งราคาแพ็กเกจโปร</h1><p className="mt-1 text-sm text-slate-500">กำหนดราคาต่อเดือน แล้วเปรียบเทียบทั้ง 6 แพ็กเกจได้ทันที</p></div></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <form onSubmit={event=>void save(event)} className="p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 text-xs font-semibold text-slate-600 sm:max-w-xs">ราคาต่อเดือน<div className="mt-1.5 flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700"><input required type="number" min="0.01" max="1000000" step="0.01" value={price} disabled={!canManage||busy} onChange={e=>setPrice(e.target.value)} className="min-w-0 w-full rounded-lg bg-transparent px-3 py-2.5 text-sm font-bold text-slate-900 outline-none" /><span className="pr-3 text-xs font-bold text-slate-400">USD</span></div></label>
        <button disabled={!canManage||busy||!config||!valid} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-40">{busy?"กำลังดำเนินการ…":"บันทึกราคา"}</button><button type="button" disabled={busy} onClick={()=>void load()} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">โหลดราคาล่าสุด</button>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs leading-5 text-slate-500"><p>ราคาใหม่มีผลกับคำขอใหม่เท่านั้น ประวัติเดิมยังคงราคาเดิม</p>{config&&<p>อัปเดต {new Date(config.updated_at).toLocaleString("th-TH-u-ca-gregory",{timeZone:"Asia/Bangkok"})}</p>}</div>
      {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
    </form>
    <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">จำนวนเดือนที่แก้ไขแสดงเฉพาะในเบราว์เซอร์นี้ ไม่เปลี่ยนแพ็กเกจจริง ราคา หรือสิทธิ์ใช้งาน</p><section className="overflow-x-auto border-t border-slate-200" aria-label="เปรียบเทียบราคาแพ็กเกจ"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 sm:px-5">แพ็กเกจ</th><th className="px-4 py-3 text-center">ใช้งานรวม</th><th className="px-4 py-3 text-right">ยอดรวม USD</th><th className="px-4 py-3 text-right sm:px-5">เฉลี่ย/เดือน</th><th className="px-4 py-3 text-center">เลือกแพ็กเกจโปร</th><th className="px-4 py-3 text-center">แก้ไข</th><th className="px-4 py-3 text-center">เปิด / ปิด</th></tr></thead><tbody className="divide-y divide-slate-100"><tr className={disabledPackages.includes("trial") ? "bg-red-50" : "bg-emerald-50/70"}><td className="px-4 py-2.5 sm:px-5"><span className="font-semibold text-slate-800">{months.trial ?? 3} {trialLabels.month}</span>{(labels.trial ?? trialLabels.trial) && <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{labels.trial ?? trialLabels.trial}</span>}</td><td className="px-4 py-2.5 text-center text-slate-600">{months.trial ?? 3} {trialLabels.month}</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">{trialLabels.free}</td><td className="px-4 py-2.5 text-right text-emerald-800 sm:px-5">{trialLabels.free}</td><td className="px-4 py-2.5 text-center"><a href={restaurantAppUrl("/signup")} className="inline-flex rounded-lg border border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50">สมัครร้านใหม่</a></td>{editCell("trial",3,trialLabels.trial)}{toggleCell("trial","แพ็กเกจทดลองใช้ฟรี")}</tr>{packages.map(p=><tr key={p.paid} className={`transition ${disabledPackages.includes(String(p.paid)) ? "bg-red-50 hover:bg-red-100/70" : p.paid===12 ? "bg-emerald-50/40 hover:bg-emerald-50/60" : "hover:bg-emerald-50/60"}`}><td className="px-4 py-2.5 sm:px-5"><span className="font-semibold text-slate-800">{months[String(p.paid)] ?? p.paid} เดือน</span>{displayBonus(p)>0 && <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">แถม {displayBonus(p)} เดือน</span>}</td><td className="px-4 py-2.5 text-center text-slate-600">{(months[String(p.paid)] ?? p.paid)+displayBonus(p)} เดือน</td><td className="px-4 py-2.5 text-right font-bold tabular-nums text-emerald-900">{valid?usd(monthly*p.paid):"—"}</td><td className="px-4 py-2.5 text-right tabular-nums text-slate-600 sm:px-5">{valid?usd(monthly*p.paid/(p.paid+p.free)):"—"}</td><td className="px-4 py-2.5 text-center"><a aria-disabled={!valid} className={`inline-flex rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-900 ${valid?"":"pointer-events-none opacity-40"}`} href={valid?restaurantAppUrl(`/dashboard/upgrade/checkout?months=${p.paid}`):undefined}>เลือกแพ็กเกจ</a></td>{editCell(String(p.paid),p.paid,p.free>0 ? `แถม ${p.free} เดือน` : "")}{toggleCell(String(p.paid),`แพ็กเกจ ${p.paid} เดือน`)}</tr>)}</tbody></table></section>
    </div>
    <dialog ref={dialogRef} onClose={()=>{setEditing(null);setMonthError("");}} aria-labelledby="edit-months-title" className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
      {editing !== null && <form onSubmit={saveMonth} className="p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 id="edit-months-title" className="text-lg font-bold text-emerald-950">แก้ไขจำนวนเดือน</h2><p className="mt-1 text-sm text-slate-500">{editing === "trial" ? "แพ็กเกจทดลองใช้ฟรี" : `แพ็กเกจ ${editing} เดือน`}</p></div><button type="button" onClick={()=>setEditing(null)} aria-label="ปิด" className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100">×</button></div>
        <label className="mt-5 block text-sm font-semibold text-slate-700">จำนวนเดือน<input autoFocus required type="number" min="1" max="120" step="1" value={monthInput} onChange={e=>setMonthInput(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700" /></label>
        {editing === "trial" ? <label className="mt-4 block text-sm font-semibold text-slate-700">ข้อความป้ายทดลองฟรี<input type="text" maxLength={50} value={labelInput} onChange={e=>setLabelInput(e.target.value)} placeholder="เช่น สมัครใหม่ใช้ฟรี" className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700" /></label> : <><label className="mt-4 block text-sm font-semibold text-slate-700">จำนวนเดือนที่แถม<input type="number" min="0" max="120" step="1" value={labelInput} onChange={e=>setLabelInput(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700" /></label><p className="mt-1 text-xs text-slate-500">ระบุ 0 หรือเว้นว่างหากไม่มีเดือนแถม</p></>}
        <p className="mt-2 text-xs leading-5 text-slate-500">แสดงเฉพาะในเบราว์เซอร์นี้ ไม่เปลี่ยนแพ็กเกจจริง ราคา หรือสิทธิ์ใช้งาน</p>
        {monthError && <p role="alert" className="mt-3 text-sm text-red-700">{monthError}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">ยกเลิก</button><button type="submit" className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900">บันทึก</button></div>
      </form>}
    </dialog>
  </div>;
}

function restaurantAppUrl(path: string) {
  const origin = new URL(window.location.origin);
  if (origin.hostname === "localhost" || origin.hostname === "127.0.0.1") {
    origin.port = import.meta.env.VITE_RESTAURANT_APP_PORT || "5173";
  } else {
    origin.hostname = origin.hostname.replace(/^admin\./, "");
  }
  return new URL(path, origin).toString();
}
