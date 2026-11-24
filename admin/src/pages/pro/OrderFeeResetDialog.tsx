import { useEffect, useState } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";

type Approval = {id:string;month_start:string;period_end:string;is_test:boolean;bill_count:number;amount_usd:string};

export default function OrderFeeResetDialog({restaurant,onClose,onReset}:{restaurant:{id:string;name:string};onClose:()=>void;onReset:()=>void}) {
  const [rows,setRows]=useState<Approval[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  const [reasons,setReasons]=useState<Record<string,string>>({});
  async function load(){setLoading(true);setError("");try{const query=new URLSearchParams({status:"approved",restaurantId:restaurant.id});const data=await adminRequest<{requests:Approval[]}>(`/api/admin/order-fee-requests?${query}`);setRows(data.requests);}catch{setError("โหลดรายการที่อนุมัติไม่สำเร็จ");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[restaurant.id]);
  async function reverse(row:Approval){
    const reason=(reasons[row.id]||"").trim();if(!reason){setError("กรุณาระบุเหตุผลก่อนคืนยอด");return;}
    if(!window.confirm(`ยืนยันย้อนการอนุมัติ${row.is_test?"รายการทดลอง":""}ของ ${restaurant.name} ช่วง ${row.month_start} ถึง ${row.period_end} ยอด $${Number(row.amount_usd).toFixed(2)}? บิลจะกลับไปเป็นยอดค้าง และระบบไม่ได้คืนเงินอัตโนมัติ`))return;
    setBusy(row.id);setError("");setMessage("");try{await adminRequest(`/api/admin/order-fee-requests/${row.id}/reverse`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason})});onReset();await load();setMessage("คืนยอดเรียบร้อย บิลกลับไปอยู่ในยอดค้างแล้ว");}catch(cause){setError(cause instanceof AdminApiError && cause.code==="NOT_APPROVED" ? "รายการนี้ไม่ได้อยู่ในสถานะอนุมัติแล้ว กรุณารีเฟรช" : "คืนยอดไม่สำเร็จ กรุณาลองใหม่");}finally{setBusy("");}
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3"><section role="dialog" aria-modal="true" aria-labelledby="reset-order-fee-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><header className="flex justify-between gap-3"><div><h2 id="reset-order-fee-title" className="text-lg font-bold">คืนยอดค่าบริการออเดอร์</h2><p className="mt-1 text-sm text-slate-500">ร้าน {restaurant.name}</p></div><button type="button" disabled={!!busy} onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm">ปิด</button></header><p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">เลือกคำขอที่อนุมัติผิด บิลจะกลับไปอยู่ในยอดค้าง ระบบเก็บประวัติและไม่ได้คืนเงินอัตโนมัติ</p>{message&&<p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{loading?<p className="mt-4 text-sm">กำลังโหลด…</p>:!rows.length?<p className="mt-4 text-sm text-slate-500">ไม่มีคำขอค่าบริการออเดอร์ที่อนุมัติแล้ว</p>:<div className="mt-4 space-y-3">{rows.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">{row.is_test ? "รายการทดลอง · " : ""}{row.month_start} ถึง {row.period_end}</p><p className="mt-1 text-sm">{row.bill_count} บิล · ${Number(row.amount_usd).toFixed(2)} USD</p><label className="mt-3 block text-sm">เหตุผลในการคืนยอด<textarea maxLength={1000} value={reasons[row.id]||""} onChange={e=>setReasons(previous=>({...previous,[row.id]:e.target.value}))} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" /></label><button type="button" disabled={!!busy} onClick={()=>void reverse(row)} className="mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">{busy===row.id ? "กำลังคืนยอด…" : "คืนยอดรายการนี้"}</button></article>)}</div>}</section></div>;
}
