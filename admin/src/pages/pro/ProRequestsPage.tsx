import { useCallback, useEffect, useState } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";
import OrderFeeRequests from "./OrderFeeRequests";

interface ProRequest {
  id: string; restaurant_name: string; requester_email: string; paid_months: number; free_months: number;
  monthly_usd: string; total_usd: string; status: "pending" | "approved" | "rejected";
  created_at: string; reviewed_at: string | null; reviewer_email: string | null; review_note: string; admin_purchase?: boolean; has_slip?: boolean;
  cancelled_at?: string | null;
}
const labels = {pending:"รออนุมัติ",approved:"อนุมัติแล้ว",rejected:"ไม่อนุมัติ"};
const date = (value: string) => new Date(value).toLocaleString("th-TH-u-ca-gregory",{timeZone:"Asia/Bangkok"});
export default function ProRequestsPage({canManage, restaurantId, restaurantName, onClearRestaurant, orderFeeStatus}: {canManage: boolean; restaurantId?: string; restaurantName?: string; onClearRestaurant?: () => void; orderFeeStatus?: string}) {
  const [rows,setRows] = useState<ProRequest[]>([]);
  const [filter,setFilter] = useState("pending");
  const [offset,setOffset] = useState(0);
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState("");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [slip,setSlip] = useState<{id:string;src:string}|null>(null);
  async function viewSlip(id:string) {
    setError("");
    try { const data=await adminRequest<{contentType:string;data:string}>(`/api/admin/pro-requests/${id}/slip`); setSlip({id,src:`data:${data.contentType};base64,${data.data}`}); }
    catch { setError("ไม่พบสลิปหรือไม่สามารถโหลดสลิปได้"); }
  }
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const params = new URLSearchParams({status:filter,offset:String(offset)}); if (restaurantId) params.set("restaurantId",restaurantId); const data=await adminRequest<{requests:ProRequest[]}>(`/api/admin/pro-requests?${params}`);setRows(data.requests); window.dispatchEvent(new Event("pro-requests-changed")); }
    catch { setError("โหลดประวัติคำขอไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setLoading(false); }
  },[filter,offset,restaurantId]);
  useEffect(()=>{void load();},[load]);
  async function review(row:ProRequest,status:"approved"|"rejected") {
    if (!window.confirm(status === "approved" ? `ยืนยันว่าตรวจสอบสลิปและได้รับเงินจาก ${row.restaurant_name} แล้ว และต้องการเปิดแพ็กเกจ?` : `ยืนยันปฏิเสธคำขอแพ็กเกจของร้าน ${row.restaurant_name}?`)) return;
    if(busy)return;setBusy(row.id);setError("");setMessage("");
    try {
      await adminRequest(`/api/admin/pro-requests/${row.id}/review`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status,note:notes[row.id]||""})});
      setMessage(`${labels[status]} และบันทึกประวัติแล้ว`);window.dispatchEvent(new Event("pro-requests-changed"));await load();
    } catch(cause) {setError(cause instanceof AdminApiError && cause.code==="ALREADY_REVIEWED"?"คำขอนี้ได้รับการตรวจสอบแล้ว กรุณารีเฟรชรายการ":"บันทึกผลไม่สำเร็จ กรุณาลองใหม่");}
    finally {setBusy("");}
  }
  return <div>
    <header><h2 className="text-xl font-bold">ตรวจสอบการชำระแพ็กเกจ</h2><p className="mt-2 text-sm text-slate-600">ตรวจสอบสลิปและยอดเงินก่อนอนุมัติหรือปฏิเสธคำขอ</p></header>
    {restaurantId && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm">คำขอของร้าน <strong>{restaurantName || restaurantId}</strong> <button type="button" onClick={onClearRestaurant} className="ml-2 font-semibold underline">ดูคำขอทุกร้าน</button></p>}
    <div className="my-6 flex flex-wrap items-center gap-3"><label className="text-sm">สถานะ <select value={filter} onChange={e=>{setFilter(e.target.value);setOffset(0);}} className="ml-2 rounded-lg border border-slate-300 bg-white p-2"><option value="all">ทั้งหมด</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button disabled={loading||!!busy} onClick={()=>void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40">รีเฟรช</button></div>
    {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message&&<p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {loading?<p role="status">กำลังโหลด…</p>:!rows.length?<p className="rounded-xl border bg-white p-8 text-center text-slate-500">ไม่มีคำขอในสถานะนี้</p>:<div className="space-y-4">{rows.map(row=><article key={row.id} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{row.restaurant_name}</h3><p className="mt-1 text-sm text-slate-500">{row.requester_email}</p>{row.admin_purchase&&<span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">ซื้อและเปิดสิทธิ์โดยแอดมิน</span>}</div><strong className={`h-fit rounded-full px-3 py-1 text-xs ${row.cancelled_at?"bg-red-50 text-red-700":row.status==="approved"?"bg-emerald-50 text-emerald-700":row.status==="rejected"?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>{row.cancelled_at ? "ยกเลิกแพ็กเกจแล้ว" : labels[row.status]}</strong></div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><p>{row.paid_months} เดือน{row.free_months?` แถม ${row.free_months} เดือน`:""}<br />รวม {row.paid_months+row.free_months} เดือน</p><p>ราคาต่อเดือน ${Number(row.monthly_usd).toFixed(2)} USD<br /><strong>ยอดบันทึก ${Number(row.total_usd).toFixed(2)} USD</strong></p><p>ส่งเมื่อ {date(row.created_at)}</p></div>
      <p className="mt-3 break-all text-xs text-slate-500">เลขคำขอ: {row.id} · {row.admin_purchase ? "แอดมินยืนยันรับเงินจริงและเปิดแพ็กเกจให้ร้านแล้ว" : "ยอดที่บันทึกขณะส่งคำขอ ไม่ใช่หลักฐานรับเงินจริง"}</p>
      {!row.admin_purchase && <div className="mt-4">{row.has_slip ? <button type="button" onClick={()=>void viewSlip(row.id)} className="rounded-lg border border-emerald-600 px-3 py-2 text-sm text-emerald-800">ดูสลิปการโอน</button> : <span className="text-sm text-amber-800">คำขอเดิมไม่มีสลิป กรุณาตรวจสอบการชำระกับร้านก่อนอนุมัติ</span>}{slip?.id===row.id && <img src={slip.src} alt="สลิปการโอน" className="mt-3 max-h-96 max-w-full rounded-lg border object-contain" />}</div>}
      {row.reviewed_at&&<p className="mt-3 text-sm">ตรวจสอบโดย {row.reviewer_email} · {date(row.reviewed_at)}</p>}
      {row.review_note&&<p className="mt-2 whitespace-pre-wrap text-sm">หมายเหตุ: {row.review_note}</p>}
      {row.status==="pending"&&canManage&&<div className="mt-4 border-t pt-4"><label className="block text-sm">หมายเหตุ (ถ้ามี)<textarea maxLength={1000} value={notes[row.id]||""} onChange={e=>setNotes(previous=>({...previous,[row.id]:e.target.value}))} className="mt-2 w-full rounded-lg border border-slate-300 p-3" /></label><div className="mt-3 flex gap-3"><button disabled={!!busy} onClick={()=>void review(row,"approved")} className="rounded-lg bg-emerald-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy===row.id?"กำลังบันทึก…":"อนุมัติ"}</button><button disabled={!!busy} onClick={()=>void review(row,"rejected")} className="rounded-lg border border-red-300 px-5 py-2 text-sm text-red-700 disabled:opacity-40">ไม่อนุมัติ</button></div></div>}
    </article>)}</div>}
    <div className="mt-5 flex justify-between text-sm"><button disabled={loading||!!busy||!offset} onClick={()=>setOffset(Math.max(0,offset-50))} className="underline disabled:opacity-40">ก่อนหน้า</button><button disabled={loading||!!busy||rows.length<50} onClick={()=>setOffset(offset+50)} className="underline disabled:opacity-40">ถัดไป</button></div>
    <OrderFeeRequests canManage={canManage} restaurantId={restaurantId} initialStatus={orderFeeStatus || "pending"} focus={!!orderFeeStatus} />
  </div>;
}
