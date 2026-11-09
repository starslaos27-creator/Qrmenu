import { useEffect, useState } from "react";
import { proPackages } from "./UpgradePage";
import { proPaymentAccount } from "./proPaymentAccount";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import ProRequestHistory, { type ProRequest } from "./ProRequestHistory";
import useProPricing from "./useProPricing";
import useProPurchaseStatus from "./useProPurchaseStatus";

export default function UpgradeCheckoutPage() {
  const months = new URLSearchParams(window.location.search).get("months");
  const chosen = proPackages.find(p => String(p.paid) === months);
  const {monthly,loading:pricingLoading,error:pricingError} = useProPricing();
  const purchase = useProPurchaseStatus();
  const validPrice = Number.isFinite(monthly) && monthly > 0;
  const [restaurantId, setRestaurantId] = useState("");
  const [requests, setRequests] = useState<ProRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [requestKey, setRequestKey] = useState(() => {
    const key = `shopqr.pro.request.${months}.${monthly}`;
    try { const saved = sessionStorage.getItem(key); if (saved) return saved; const id = crypto.randomUUID(); sessionStorage.setItem(key, id); return id; }
    catch { return crypto.randomUUID(); }
  });
  useEffect(()=>{
    try { setRequestKey(sessionStorage.getItem(`shopqr.pro.request.${months}.${monthly}`)||crypto.randomUUID()); }
    catch { setRequestKey(crypto.randomUUID()); }
  },[months,monthly]);
  async function loadHistory(id: string, page = offset) {
    const data = await apiRequest<{requests: ProRequest[]}>(`/api/restaurants/${id}/pro-requests?offset=${page}`);
    setRequests(data.requests);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    loadRestaurantSession().then(async session => {
      if (!session.membership || session.membership.role !== "owner") throw new Error("OWNER_REQUIRED");
      const id = session.membership.restaurant_id;
      const data = await apiRequest<{requests: ProRequest[]}>(`/api/restaurants/${id}/pro-requests?offset=${offset}`);
      if (active) { setRestaurantId(id); setRequests(data.requests); setError(""); }
    }).catch(cause => { if (active) setError(cause instanceof ApiError && cause.status === 401 ? "กรุณาเข้าสู่ระบบก่อนส่งคำขอ" : "โหลดประวัติไม่สำเร็จ กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของร้านแล้วลองอีกครั้ง"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [offset]);
  async function pay() {
    if (busy || !restaurantId || !chosen || purchase.blocked) return;
    setBusy(true); setError(""); setMessage("");
    try {
      try { sessionStorage.setItem(`shopqr.pro.request.${months}.${monthly}`, requestKey); } catch { /* The request remains retryable in this page. */ }
      const result = await apiRequest<{request: ProRequest}>(`/api/restaurants/${restaurantId}/pro-requests`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestKey,paidMonths:chosen.paid,monthlyUsd:monthly.toFixed(2)})});
      try { sessionStorage.removeItem(`shopqr.pro.request.${months}.${monthly}`); } catch { /* The server still deduplicates this key. */ }
      setRequestKey(crypto.randomUUID());
      setRequests(previous => [result.request, ...previous.filter(row => row.id !== result.request.id)]);
      setMessage("ส่งคำขอสำเร็จ รอแอดมินอนุมัติ บันทึกประวัติแล้วโดยไม่มีการเรียกเก็บเงิน");
      setOffset(0);
      void purchase.refresh();
      await loadHistory(restaurantId, 0).catch(() => setError("ส่งคำขอแล้ว แต่โหลดประวัติล่าสุดไม่สำเร็จ กรุณารีเฟรชสถานะ"));
    } catch (cause) {
      if(cause instanceof ApiError && (cause.code === "PRO_ACTIVE" || cause.code === "REQUEST_PENDING")) void purchase.refresh();
      setError(cause instanceof ApiError && cause.code === "PRO_ACTIVE" ? "ท่านได้ชำระแล้ว แพ็กเกจยังไม่หมดอายุ จึงไม่สามารถซื้อซ้ำได้" : cause instanceof ApiError && cause.code === "PRICE_CHANGED" ? "แอดมินเปลี่ยนราคาแล้ว กรุณาโหลดหน้าใหม่เพื่อตรวจสอบยอดล่าสุดก่อนส่งคำขอ" : cause instanceof ApiError && cause.code === "REQUEST_PENDING" ? "ร้านนี้มีคำขอรออนุมัติอยู่แล้ว กรุณารอแอดมินตรวจสอบ" : "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { setBusy(false); }
  }
  const usd = (amount: number) => `${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} USD`;

  return <main className="min-h-screen bg-[#f2e8d8] px-4 py-10 text-[#174a34] sm:px-8">
    <div className="mx-auto max-w-xl">
      <a href="/dashboard/upgrade" className="text-sm font-semibold underline underline-offset-4">← เปลี่ยนแพ็กเกจ</a>
      <header className="mb-8 mt-8"><p className="text-xs font-bold tracking-widest">QR MENU PRO</p><h1 className="mt-3 text-3xl font-bold">ชำระเงินแพ็กเกจโปร</h1><p className="mt-3 text-[#756247]">ตรวจสอบแพ็กเกจและยอดชำระของคุณ</p></header>
      {purchase.message && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{purchase.message}</p>}
      {purchase.error && <p role="alert" className="mb-5 text-sm text-red-800">{purchase.error} <button onClick={()=>void purchase.refresh()} className="underline">ลองใหม่</button></p>}
      {!chosen ? <section role="alert" className="rounded-2xl border border-[#dfcfb2] bg-[#fffaf1] p-6"><h2 className="font-bold">ไม่พบแพ็กเกจที่เลือก</h2><a href="/dashboard/upgrade" className="mt-4 inline-block underline">กลับไปเลือกแพ็กเกจ</a></section> :
        <section className="rounded-2xl border border-[#dfcfb2] bg-[#fffaf1] p-6">
          <h2 className="text-xl font-bold">สรุปรายการ</h2>
          <p className="mb-6 mt-5 text-2xl font-bold">{chosen.paid} เดือน{chosen.free > 0 && <span className="mt-2 block text-base text-emerald-700">แถม {chosen.free} เดือน</span>}</p>
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between gap-4"><dt>ระยะเวลาใช้งานรวม</dt><dd className="font-bold">{chosen.total} เดือน</dd></div>
            <div className="flex justify-between gap-4"><dt>ราคาต่อเดือน</dt><dd>{validPrice ? usd(monthly) : "ยังไม่ระบุราคา"}</dd></div>
            <div className="flex justify-between gap-4"><dt>เฉลี่ยต่อเดือนที่ใช้งาน</dt><dd>{validPrice ? usd(monthly * chosen.paid / chosen.total) : "—"}</dd></div>
            <div className="flex justify-between gap-4 border-t border-[#dfcfb2] pt-5 text-lg"><dt className="font-bold">ยอดรวม</dt><dd className="font-bold">{validPrice ? usd(monthly * chosen.paid) : "—"}</dd></div>
          </dl>
          <p className="mt-5 text-xs leading-6 text-[#756247]">ราคากำหนดโดยแอดมิน กดชำระเงินเพื่อส่งคำขออนุมัติและเก็บประวัติ ไม่ต้องแนบสลิปและไม่มีการเรียกเก็บเงินจริง</p>
          <section aria-label="บัญชีรับเงินค่าแพ็กเกจโปร" className="mt-5 rounded-xl border border-[#dfcfb2] bg-white/60 p-4 sm:p-5">
            <h3 className="font-bold">บัญชีรับเงินค่าแพ็กเกจโปร</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#756247]">ธนาคาร</dt><dd className="font-semibold">{proPaymentAccount.bank || "รอระบุธนาคาร"}</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#756247]">เลขบัญชี</dt><dd className="break-all font-bold tracking-wide">{proPaymentAccount.accountNumber || "รอระบุเลขบัญชี"}</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#756247]">ชื่อบัญชี</dt><dd className="break-words font-semibold">{proPaymentAccount.accountName || "รอระบุชื่อบัญชีผู้รับเงิน"}</dd></div>
            </dl>
          </section>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => void pay()} disabled={purchase.blocked || !validPrice || pricingLoading || !restaurantId || busy || loading || requests.some(row => row.status === "pending")} className="rounded-xl bg-[#174a34] px-7 py-3 text-sm font-bold text-white transition hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{purchase.active ? "ชำระแล้ว" : purchase.pending ? "รออนุมัติ" : busy ? "กำลังส่งคำขอ…" : requests.some(row => row.status === "pending") ? "รอแอดมินอนุมัติ" : "ชำระเงิน"}</button>
        </div>
        {message && <p role="status" className="mt-3 text-sm leading-6 text-emerald-800">{message}</p>}
          {pricingLoading ? <p role="status" className="mt-4 text-sm">กำลังโหลดราคา…</p> : pricingError && <p role="alert" className="mt-4 text-sm text-red-700">{pricingError}</p>}
        </section>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} <button type="button" className="underline" onClick={() => window.location.reload()}>โหลดใหม่</button></p>}
      {loading ? <p role="status" className="mt-5 text-sm">กำลังโหลดประวัติ…</p> : restaurantId && <>
        <div className="mt-6 flex justify-end"><button type="button" onClick={() => void loadHistory(restaurantId).catch(() => setError("โหลดประวัติไม่สำเร็จ"))} className="text-sm underline">รีเฟรชสถานะ</button></div>
        <ProRequestHistory requests={requests} />
        <div className="mt-4 flex justify-between text-sm"><button disabled={!offset} onClick={() => setOffset(Math.max(0,offset-50))} className="underline disabled:opacity-40">ก่อนหน้า</button><button disabled={requests.length < 50} onClick={() => setOffset(offset+50)} className="underline disabled:opacity-40">ถัดไป</button></div>
      </>}
    </div>
  </main>;
}
