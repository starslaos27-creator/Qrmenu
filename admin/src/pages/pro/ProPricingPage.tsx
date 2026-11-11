import { useEffect, useState, type FormEvent } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";

interface Pricing {monthly_usd:string|null;version:number;updated_at:string}
const packages=[{paid:1,free:0},{paid:3,free:0},{paid:6,free:1},{paid:9,free:1},{paid:12,free:2}];
const trialLabels={month:"\u0e40\u0e14\u0e37\u0e2d\u0e19",free:"\u0e1f\u0e23\u0e35",trial:"\u0e17\u0e14\u0e25\u0e2d\u0e07\u0e43\u0e0a\u0e49\u0e1f\u0e23\u0e35"};
export default function ProPricingPage({canManage}:{canManage:boolean}) {
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
    <section className="overflow-x-auto border-t border-slate-200" aria-label="เปรียบเทียบราคาแพ็กเกจ"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 sm:px-5">แพ็กเกจ</th><th className="px-4 py-3 text-center">ใช้งานรวม</th><th className="px-4 py-3 text-right">ยอดรวม USD</th><th className="px-4 py-3 text-right sm:px-5">เฉลี่ย/เดือน</th><th className="px-4 py-3 text-center">เลือกแพ็กเกจโปร</th></tr></thead><tbody className="divide-y divide-slate-100"><tr className="bg-emerald-50/70"><td className="px-4 py-2.5 sm:px-5"><span className="font-semibold text-slate-800">3 {trialLabels.month}</span><span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{trialLabels.trial}</span></td><td className="px-4 py-2.5 text-center text-slate-600">3 {trialLabels.month}</td><td className="px-4 py-2.5 text-right font-bold text-emerald-800">{trialLabels.free}</td><td className="px-4 py-2.5 text-right text-emerald-800 sm:px-5">{trialLabels.free}</td><td className="px-4 py-2.5 text-center"><a href={restaurantAppUrl("/signup")} className="inline-flex rounded-lg border border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50">สมัครร้านใหม่</a></td></tr>{packages.map(p=><tr key={p.paid} className={`transition hover:bg-emerald-50/60 ${p.paid===12?"bg-emerald-50/40":""}`}><td className="px-4 py-2.5 sm:px-5"><span className="font-semibold text-slate-800">{p.paid} เดือน</span>{p.free>0&&<span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">แถม {p.free} เดือน</span>}</td><td className="px-4 py-2.5 text-center text-slate-600">{p.paid+p.free} เดือน</td><td className="px-4 py-2.5 text-right font-bold tabular-nums text-emerald-900">{valid?usd(monthly*p.paid):"—"}</td><td className="px-4 py-2.5 text-right tabular-nums text-slate-600 sm:px-5">{valid?usd(monthly*p.paid/(p.paid+p.free)):"—"}</td><td className="px-4 py-2.5 text-center"><a aria-disabled={!valid} className={`inline-flex rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-900 ${valid?"":"pointer-events-none opacity-40"}`} href={valid?restaurantAppUrl(`/dashboard/upgrade/checkout?months=${p.paid}`):undefined}>เลือกแพ็กเกจ</a></td></tr>)}</tbody></table></section>
    </div>
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
