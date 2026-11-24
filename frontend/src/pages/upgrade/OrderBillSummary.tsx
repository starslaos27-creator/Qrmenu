import { useEffect, useRef, useState, type FormEvent } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import { proPaymentAccount } from "./proPaymentAccount";

type Summary = { bills: { receipt_number: string; paid_at: string; bill_total: string; fee: number }[]; count: number; total: string; totalFee: string };
type BillingCycle = { startAt: string; endAt: string; cutoffAt: string; payBy: string };
type BillingState = { firstBillAt: string | null; currentCycle: BillingCycle | null; payableCycle: BillingCycle | null; payableBillCount: number; payableFeeLak: string; outstandingBillCount: number; outstandingFeeLak: string; hasPendingRequest: boolean; overdue: boolean; restricted: boolean };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (value: string, currency: string) => `${currency === "LAK" ? "₭" : `${currency} `}${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const usd = (value: string, rate: number) => (Number(value) / rate).toLocaleString("en-US", { style: "currency", currency: "USD" });
const laosDate = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
async function loadOrderFeeOwner() {
  const session=await loadRestaurantSession();
  if(!session.membership || session.membership.role!=="owner") throw new Error("OWNER_REQUIRED");
  const target=new URLSearchParams(window.location.search).get("restaurantId");
  if(target && session.membership.restaurant_id!==target) throw new Error("RESTAURANT_MISMATCH");
  return session;
}

export default function OrderBillSummary() {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState(() => ({ from: `${today().slice(0, 7)}-01`, to: today() }));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<Summary | null>(null);
  const [currency, setCurrency] = useState("LAK");
  const [exchange, setExchange] = useState<{rate:number; date:string; fetchedAt:string} | null>(null);
  const [exchangeError, setExchangeError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const paymentDialog=useRef<HTMLDialogElement>(null);
  const autoOpened=useRef(false);
  const [paymentQr,setPaymentQr]=useState<string|null>(null);
  const [qrError,setQrError]=useState("");
  const [slip,setSlip]=useState<File|null>(null);
  const [slipError,setSlipError]=useState("");
  const [sending,setSending]=useState(false);
  const [paymentMessage,setPaymentMessage]=useState("");
  const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
  const [requests,setRequests]=useState<{id:string;month_start:string;cycle_start_at:string;cycle_cutoff_at:string;status:string;review_note:string;is_test:boolean;amount_usd:string}[]>([]);
  const [testMode,setTestMode]=useState(false);
  const [billing,setBilling]=useState<BillingState|null>(null);
  const [requestsReady,setRequestsReady]=useState(false);
  const [clockNow,setClockNow]=useState(Date.now);
  const cycleInitialized=useRef(false);

  async function loadRequests() {
    const session=await loadOrderFeeOwner();
    if (!session.membership || session.membership.role!=="owner") throw new Error("OWNER_REQUIRED");
    const result=await apiRequest<{requests:{id:string;month_start:string;cycle_start_at:string;cycle_cutoff_at:string;status:string;review_note:string;is_test:boolean;amount_usd:string}[];testMode:boolean;billing:BillingState}>(`/api/restaurants/${session.membership.restaurant_id}/order-fee-requests`);
    setRequests(result.requests);setTestMode(result.testMode);setBilling(result.billing);setRequestsReady(true);
    const displayCycle=result.billing.payableCycle||result.billing.currentCycle;
    if(!cycleInitialized.current&&!result.testMode&&displayCycle){const next={from:laosDate(displayCycle.startAt),to:laosDate(displayCycle.cutoffAt)};setFrom(next.from);setTo(next.to);setRange(next);cycleInitialized.current=true;}
  }
  useEffect(()=>{void loadRequests().catch(()=>{});const timer=window.setInterval(()=>setClockNow(Date.now()),60000);return()=>window.clearInterval(timer);},[]);
  const monthEnd=(month:string)=>{ const [y,m]=month.split("-").map(Number); return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10); };
  const [monthYear,monthNumber]=range.from.split("-").map(Number);
  const fullClosedMonth=range.from.endsWith("-01") && range.to===monthEnd(range.from) && Date.now()>=Date.UTC(monthYear,monthNumber,1)-60*60*1000;
  const validTestRange=range.from.endsWith("-01") && range.to>=range.from && range.to<=today() && range.to.slice(0,7)===range.from.slice(0,7);
  const allowedRange=testMode ? validTestRange : Boolean(billing?.payableCycle && clockNow >= Date.parse(billing.payableCycle.cutoffAt));
  const currentRequest=requests.find(item=>item.is_test===testMode && item.status==="pending");
  const paymentBlockers=[
    !requestsReady ? "ยังตรวจสอบสถานะคำขอไม่ได้ กรุณาเปิดหน้าใหม่" : "",
    !slip ? "กรุณาแนบสลิป JPG, PNG หรือ WebP ไม่เกิน 5 MB" : "",
    !testMode && !paymentQr ? "ยังไม่พบ QR สำหรับรับชำระ" : "",
    !exchange ? "ยังโหลดอัตราแลกเปลี่ยนไม่ได้" : "",
    !allowedRange ? (testMode ? "กรุณาเลือกช่วงตั้งแต่วันที่ 1 ถึงวันที่เลือกภายในเดือนเดียวกันและไม่เกินวันนี้" : "กรุณาเลือกเดือนที่สิ้นสุดแล้ว หลัง 06:00 น. ของวันที่ 1 เดือนถัดไป") : "",
    currentRequest ? "เดือนนี้มีคำขอรอแอดมินตรวจสอบอยู่แล้ว" : "",
    exchange && Number(summary?.totalFee || 0)/(exchange.rate+287)<0.005 ? "ยอดค่าบริการคงเหลือเป็น $0.00 จึงไม่มีรายการให้ส่งชำระ" : "",
  ].filter(Boolean);
  async function sendPayment() {
    const billSummary=paymentSummary||summary; if(!billSummary || !slip || !exchange || !allowedRange || currentRequest || sending)return;
    setSending(true);setPaymentMessage("");setSlipError("");
    try {
      const session=await loadOrderFeeOwner();if(!session.membership || session.membership.role!=="owner")throw new Error("OWNER_REQUIRED");
      const form=new FormData();const cycle=testMode ? {startAt:new Date(`${range.from}T00:00:00+07:00`).toISOString(),cutoffAt:new Date(new Date(`${range.to}T00:00:00+07:00`).getTime()+30*60*60*1000).toISOString()} : billing?.payableCycle;if(!cycle)return;form.set("requestKey",requestKey);form.set("month",laosDate(cycle.startAt));form.set("end",laosDate(cycle.cutoffAt));form.set("cycleStartAt",cycle.startAt);form.set("cycleCutoffAt",cycle.cutoffAt);form.set("test",String(testMode));form.set("feeLak",billSummary.totalFee);form.set("rateLak",String(exchange.rate+287));form.set("file",slip);
      await apiRequest(`/api/restaurants/${session.membership.restaurant_id}/order-fee-requests`,{method:"POST",body:form});
      setSlip(null);setRequestKey(crypto.randomUUID());setPaymentMessage("ส่งหลักฐานแล้ว รอแอดมินตรวจสอบและอนุมัติ");await loadRequests().catch(()=>{setRequestsReady(false);setPaymentMessage("ส่งหลักฐานแล้ว แต่โหลดสถานะไม่สำเร็จ กรุณาเปิดหน้าใหม่เพื่อตรวจสอบ");});
    } catch(cause) {setSlipError(cause instanceof ApiError && cause.code==="SUMMARY_CHANGED" ? "ยอดบิลหรืออัตราแลกเปลี่ยนเปลี่ยนไป กรุณาติดต่อแอดมินก่อนส่งสลิป" : cause instanceof ApiError && cause.code==="MONTH_ALREADY_SUBMITTED" ? "เดือนนี้มีคำขอรอตรวจสอบหรืออนุมัติแล้ว" : "ส่งหลักฐานไม่สำเร็จ กรุณาลองใหม่หรือติดต่อแอดมิน");}
    finally {setSending(false);}
  }

  async function openPayment() {
    if (paymentDialog.current && !paymentDialog.current.open) paymentDialog.current.showModal();
    setQrError("");
    try {
      const session=await loadOrderFeeOwner(); if(!session.membership) throw new Error("OWNER_REQUIRED");
      const state=await apiRequest<{requests:{id:string;month_start:string;cycle_start_at:string;cycle_cutoff_at:string;status:string;review_note:string;is_test:boolean;amount_usd:string}[];testMode:boolean;billing:BillingState}>(`/api/restaurants/${session.membership.restaurant_id}/order-fee-requests`);
      setRequests(state.requests);setTestMode(state.testMode);setBilling(state.billing);setRequestsReady(true);
      if(state.testMode) setPaymentSummary(summary);
      else if(state.billing.payableCycle){const query=new URLSearchParams({cycleStartAt:state.billing.payableCycle.startAt,cycleCutoffAt:state.billing.payableCycle.cutoffAt});setPaymentSummary(await apiRequest<Summary>(`/api/restaurants/${session.membership.restaurant_id}/pro-order-bills?${query}`));}
      else setPaymentSummary(null);
      const result=await apiRequest<{qrUrl:string|null}>("/api/pro-payment-qr"); setPaymentQr(result.qrUrl);
    } catch { setPaymentQr(null); setQrError("โหลดข้อมูลรอบชำระหรือ QR ไม่สำเร็จ กรุณาลองใหม่"); }
  }
  useEffect(() => {
    let active=true;
    async function refreshRate() {
      try {
        const session=await loadOrderFeeOwner();
        if (!session.membership || session.membership.role !== "owner") throw new Error("OWNER_REQUIRED");
        const result=await apiRequest<{rate:number;date:string;fetchedAt:string}>(`/api/restaurants/${session.membership.restaurant_id}/pro-exchange-rate`);
        if (!Number.isFinite(result.rate) || result.rate <= 0) throw new Error("INVALID_RATE");
        if (active) { setExchange(result); setExchangeError(""); }
      } catch { if (active) { setExchange(null); setExchangeError("ไม่สามารถโหลดอัตรา BCEL ได้ กรุณาลองใหม่ภายหลัง"); } }
    }
    void refreshRate();
    const timer=window.setInterval(()=>void refreshRate(),10*60*1000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setSummary(null);
    loadOrderFeeOwner().then(session => {
      if (!session.membership || session.membership.role !== "owner") throw new Error("OWNER_REQUIRED");
      const query = new URLSearchParams(range);
      const cycle=billing?.payableCycle||billing?.currentCycle;
      if(!testMode && cycle && range.from===laosDate(cycle.startAt) && range.to===laosDate(cycle.cutoffAt)){
        query.set("cycleStartAt",cycle.startAt);query.set("cycleCutoffAt",cycle.cutoffAt);
      }
      const root=`/api/restaurants/${session.membership.restaurant_id}`;
      return Promise.all([apiRequest<Summary>(`${root}/pro-order-bills?${query}`),apiRequest<{restaurant:{currency_code:string}}>(root)]);
    }).then(([result,restaurant]) => { if (active) { setSummary(result); setCurrency(restaurant.restaurant.currency_code || "LAK"); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error && cause.message === "RESTAURANT_MISMATCH" ? "บัญชีที่เข้าสู่ระบบเป็นเจ้าของร้านอื่น กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของร้านที่เลือกจากหน้าแอดมิน" : cause instanceof ApiError && cause.code === "LAK_REQUIRED" ? "การคำนวณค่าบริการนี้รองรับเฉพาะร้านที่ใช้สกุลเงินกีบ (LAK)" : "โหลดสรุปบิลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์เจ้าของร้านและลองใหม่"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range,billing?.payableCycle?.startAt,billing?.payableCycle?.cutoffAt,billing?.currentCycle?.startAt,billing?.currentCycle?.cutoffAt,testMode]);

  useEffect(()=>{
    if (!loading && summary && !autoOpened.current && paymentDialog.current && new URLSearchParams(window.location.search).get("checkout")==="1") {
      autoOpened.current=true;
      void openPayment();
    }
  },[loading,summary]);

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      if(document.visibilityState!=="visible" || paymentDialog.current?.open || exporting || sending) return;
      void loadRequests().then(()=>setRange(previous=>({...previous}))).catch(()=>{});
    },30000);
    return ()=>window.clearInterval(timer);
  },[exporting,sending]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!from || !to || from > to || Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 366 * 86400000) {
      setError("กรุณาเลือกช่วงวันที่ไม่เกิน 367 วัน และวันเริ่มต้นต้องไม่เกินวันสิ้นสุด"); return;
    }
    setRange({ from, to });
  }

  async function downloadCsv() {
    if (!summary || exporting) return;
    setExporting(true); setError("");
    try {
      const session=await loadOrderFeeOwner();
      if (!session.membership || session.membership.role !== "owner") throw new Error("OWNER_REQUIRED");
      const bills: Summary["bills"] = [];
      for (let offset=0; offset<summary.count; offset+=1000) {
        const query=new URLSearchParams({ ...range, offset:String(offset) });
        const cycle=billing?.payableCycle||billing?.currentCycle;
        if(!testMode && cycle && range.from===laosDate(cycle.startAt) && range.to===laosDate(cycle.cutoffAt)){
          query.set("cycleStartAt",cycle.startAt);query.set("cycleCutoffAt",cycle.cutoffAt);
        }
        const page=await apiRequest<Summary>(`/api/restaurants/${session.membership.restaurant_id}/pro-order-bills?${query}`);
        if (page.count!==summary.count || page.total!==summary.total || page.totalFee!==summary.totalFee || !page.bills.length) throw new Error("SUMMARY_CHANGED");
        bills.push(...page.bills);
      }
      if (bills.length!==summary.count || new Set(bills.map(bill=>bill.receipt_number)).size!==bills.length) throw new Error("SUMMARY_CHANGED");
      const cell=(value:string) => `"${(/^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? "'"+value : value).replace(/"/g,'""')}"`;
      const dateFormat=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Vientiane",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
      const rows=[ ["เลขบิล","วันที่ชำระ (เวลาลาว UTC+7)","ยอดซื้อ (LAK)","ค่าบริการ (LAK)"], ...bills.map(bill=>[bill.receipt_number,dateFormat.format(new Date(bill.paid_at)),bill.bill_total,String(bill.fee)]), ["รวม", "",summary.total,summary.totalFee] ];
      const csv="\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n");
      const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
      const link=document.createElement("a"); link.href=url; link.download=`order-bills-${range.from}-${range.to}.csv`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch (cause) { setError(cause instanceof Error && cause.message==="SUMMARY_CHANGED" ? "ข้อมูลบิลเปลี่ยนระหว่างดาวน์โหลด กรุณากดดูสรุปอีกครั้ง" : "ดาวน์โหลด CSV ไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setExporting(false); }
  }

  return <section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[#dfcfb2] bg-[#fffaf1] p-6 shadow-sm" aria-labelledby="bill-summary-title">
    <h2 id="bill-summary-title" className="text-xl font-bold">สรุปยอดออเดอร์ตามบิล</h2>
    <p className="mt-1 text-sm text-[#756247]">เริ่มนับรอบ 30 วันจากบิลออเดอร์แรก ตัดรอบเวลา 06:00 น. โซนลาว และชำระภายใน 48 ชั่วโมง</p>
    <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{billing?.firstBillAt ? <>เริ่มนับจากบิลแรก {new Intl.DateTimeFormat("th-TH-u-ca-gregory",{timeZone:"Asia/Vientiane",dateStyle:"medium",timeStyle:"short"}).format(new Date(billing.firstBillAt))} · รอบถัดไปตัดยอด {billing.currentCycle ? new Intl.DateTimeFormat("th-TH-u-ca-gregory",{timeZone:"Asia/Vientiane",dateStyle:"medium",timeStyle:"short"}).format(new Date(billing.currentCycle.cutoffAt)) : "—"} · ชำระภายใน 48 ชั่วโมงหลังตัดรอบ{billing.payableCycle && !billing.hasPendingRequest && !billing.restricted && <strong className="ml-1 text-amber-800">กรุณาชำระภายใน {new Intl.DateTimeFormat("th-TH-u-ca-gregory",{timeZone:"Asia/Vientiane",dateStyle:"medium",timeStyle:"short"}).format(new Date(billing.payableCycle.payBy))} (ลาว)</strong>}</> : "เริ่มนับรอบเมื่อมีบิลออเดอร์ที่ชำระสำเร็จบิลแรก"}{billing?.restricted && <strong className="ml-1 text-red-700">เกินกำหนดชำระแล้ว เมนูสต็อก โต๊ะ/QR ออเดอร์ ครัว และเช็คบิลถูกจำกัด</strong>}</p>
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm font-semibold">ตั้งแต่<input type="date" required value={from} onChange={e=>setFrom(e.target.value)} className="rounded-lg border border-[#dfcfb2] bg-white px-3 py-2 font-normal" /></label>
      <label className="grid gap-1 text-sm font-semibold">ถึง<input type="date" required value={to} onChange={e=>setTo(e.target.value)} className="rounded-lg border border-[#dfcfb2] bg-white px-3 py-2 font-normal" /></label>
      <button className="rounded-lg bg-[#174a34] px-4 py-2 text-sm font-bold text-white">ดูสรุป</button>
      <button type="button" onClick={()=>void downloadCsv()} disabled={loading || exporting || !summary || from!==range.from || to!==range.to} className="rounded-lg border border-[#174a34] bg-white px-4 py-2 text-sm font-bold text-[#174a34] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40">{exporting ? "กำลังดาวน์โหลด…" : "ดาวน์โหลด CSV"}</button>
    </form>
    <p className="mt-4 text-xs text-[#756247]">ค่าบริการคำนวณจากบิลที่ชำระแล้วตามช่วงวันที่เลือก ยอดสรุปนี้ยังไม่ใช่ใบแจ้งหนี้</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="mt-4 text-sm">กำลังโหลดบิล…</p> : summary && <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{summary.count.toLocaleString("en-US")} บิล · ยอดซื้อรวม <strong>{money(summary.total,currency)}</strong> · ค่าบริการรวม <strong>{money(summary.totalFee,"LAK")}</strong></p><button type="button" disabled={!testMode&&(!billing?.payableCycle||clockNow<Date.parse(billing.payableCycle.cutoffAt)||billing.hasPendingRequest)} onClick={()=>void openPayment()} className="rounded-lg bg-[#174a34] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40">{testMode ? "ชำระค่าบริการ" : `ชำระยอด ${exchange&&billing?.payableFeeLak?usd(billing.payableFeeLak,exchange.rate+287):""}`}</button></div>
      {exchange ? <><p className="mt-2 text-sm">ยอดซื้อรวมประมาณ <strong>{usd(summary.total,exchange.rate+287)}</strong> · ค่าบริการรวม <strong>{usd(summary.totalFee,exchange.rate+287)}</strong></p>
      <p className="mt-1 text-xs text-[#756247]">อัตราขาย USD ของ <a href="https://www.bcel.com.la/bcel/exchange-rate.html?lang=en" target="_blank" rel="noreferrer" className="underline">BCEL</a> วันที่ {exchange.date}: ₭{exchange.rate.toLocaleString("en-US")} + ₭287 = ₭{(exchange.rate+287).toLocaleString("en-US")} ต่อ $1 · ตรวจสอบล่าสุด {new Intl.DateTimeFormat("th-TH-u-ca-gregory",{timeZone:"Asia/Vientiane",dateStyle:"short",timeStyle:"short"}).format(new Date(exchange.fetchedAt))} · ยอดดอลลาร์เป็นยอดประมาณการ</p></> : <p role="status" className="mt-2 text-xs text-[#756247]">{exchangeError || "กำลังโหลดอัตราแลกเปลี่ยน BCEL…"}</p>}
      {summary.count > summary.bills.length && <p className="mt-2 text-xs text-[#756247]">แสดง 1,000 บิลล่าสุด ยอดรวมครอบคลุมทุกบิลในช่วงที่เลือก</p>}
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f2e8d8]"><tr><th className="px-3 py-2">เลขบิล</th><th className="px-3 py-2">วันที่ชำระ</th><th className="px-3 py-2 text-right">ยอดซื้อ</th><th className="px-3 py-2 text-right">ค่าบริการ</th></tr></thead><tbody className="divide-y divide-[#eadfcf]">{summary.bills.map(bill=><tr key={bill.receipt_number}><td className="px-3 py-2">{bill.receipt_number}</td><td className="whitespace-nowrap px-3 py-2">{new Intl.DateTimeFormat("th-TH-u-ca-gregory",{timeZone:"Asia/Vientiane",dateStyle:"short",timeStyle:"short"}).format(new Date(bill.paid_at))}</td><td className="px-3 py-2 text-right tabular-nums">{money(bill.bill_total,currency)}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{money(String(bill.fee),"LAK")}</td></tr>)}</tbody></table>{summary.count === 0 && <p className="py-4 text-sm text-[#756247]">ไม่มีบิลที่ชำระในช่วงนี้</p>}</div>
      <dialog ref={paymentDialog} aria-labelledby="order-payment-title" className="max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-[#dfcfb2] bg-[#fffaf1] p-6 text-[#174a34] shadow-xl backdrop:bg-black/50">
        <h2 id="order-payment-title" className="text-2xl font-bold">ชำระค่าบริการออเดอร์</h2>
        <p className="mt-2 text-sm text-[#756247]">ตรวจสอบรายการและยอดค่าบริการของคุณ</p>
        <section className="mt-5 rounded-xl border border-[#dfcfb2] bg-white/60 p-5">
          <h3 className="text-lg font-bold">สรุปรายการ</h3>
          <dl className="mt-4 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt>ช่วงวันที่</dt><dd className="text-right font-semibold">{range.from} ถึง {range.to}</dd></div><div className="flex justify-between gap-4"><dt>จำนวนบิล</dt><dd>{(paymentSummary||summary).count.toLocaleString("en-US")} บิล</dd></div><div className="flex justify-between gap-4 border-t border-[#dfcfb2] pt-4 text-lg"><dt className="font-bold">ค่าบริการรวม</dt><dd className="font-bold">{exchange ? usd((paymentSummary||summary).totalFee,exchange.rate+287) : "ไม่สามารถคำนวณได้"}</dd></div></dl>
          {!exchange && <p className="mt-2 text-sm text-red-700">{exchangeError || "กำลังโหลดอัตราแลกเปลี่ยน…"}</p>}
        </section>
        <p role="status" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{!requestsReady ? "ยังตรวจสอบสถานะคำขอไม่ได้ กรุณาอย่าเพิ่งโอนเงิน และลองเปิดหน้าใหม่" : testMode ? "โหมดทดลอง: ส่งหลักฐานทดสอบได้ตั้งแต่วันที่ 1 ถึงวันที่เลือกภายในเดือนเดียวกัน ห้ามโอนเงินจริง รายการนี้ไม่ถือเป็นการชำระเงิน" : "เลือกสรุปครบเดือนที่สิ้นสุดแล้ว หลังเวลา 06:00 น. วันที่ 1 ของเดือนถัดไป ตรวจสอบยอดและอัตราก่อนโอน จากนั้นแนบสลิปเพื่อให้แอดมินตรวจสอบ"}</p>
        {testMode && !allowedRange && <p className="mt-2 text-sm text-amber-800">กรุณาเลือกตั้งแต่วันที่ 1 ถึงวันที่เลือกภายในเดือนเดียวกัน และไม่เกินวันนี้</p>}
        <section aria-label="บัญชีรับเงิน" className="mt-5 rounded-xl border border-[#dfcfb2] bg-white/60 p-5"><h3 className="font-bold">บัญชีรับเงินค่าแพ็กเกจโปร</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#756247]">ธนาคาร</dt><dd className="font-semibold">{proPaymentAccount.bank || "รอระบุธนาคาร"}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#756247]">เลขบัญชี</dt><dd className="break-all font-bold">{proPaymentAccount.accountNumber || "รอระบุเลขบัญชี"}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#756247]">ชื่อบัญชี</dt><dd className="font-semibold">{proPaymentAccount.accountName || "รอระบุชื่อบัญชี"}</dd></div></dl></section>
        <section className="mt-5 rounded-xl border border-[#dfcfb2] bg-white/60 p-5"><h3 className="font-bold">QR สำหรับชำระแพ็กเกจ</h3>{paymentQr ? <img src={paymentQr} alt="QR บัญชีรับเงินแพ็กเกจโปร" className="mx-auto mt-4 max-h-72 max-w-full rounded-lg object-contain" /> : <p className="mt-3 text-sm text-[#756247]">{qrError || "ยังไม่มี QR ชำระเงิน หรือกำลังโหลด"}</p>}<label className="mt-4 block text-sm font-semibold text-[#756247]">แนบสลิปการโอน (JPG, PNG หรือ WebP ไม่เกิน 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm" onChange={event=>{const file=event.target.files?.[0];setSlip(null);setSlipError("");if (!file) return;if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5*1024*1024) {setSlipError("กรุณาเลือกไฟล์ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB");event.target.value="";return;}setSlip(file);}} /></label>{slipError && <p role="alert" className="mt-2 text-sm text-red-700">{slipError}</p>}{paymentMessage && <p role="status" className="mt-2 text-sm text-emerald-800">{paymentMessage}</p>}{currentRequest && <p className="mt-2 text-sm text-emerald-800">{currentRequest.status === "approved" ? "เดือนนี้อนุมัติการชำระแล้ว" : "เดือนนี้มีคำขอรอแอดมินตรวจสอบ"}</p>}</section>
        {paymentBlockers.length>0 && <div role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">ยังส่งหลักฐานไม่ได้</p><ul className="mt-1 list-disc space-y-1 pl-5">{paymentBlockers.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}
        <div className="mt-5 flex justify-end gap-2"><form method="dialog"><button className="rounded-lg border border-[#174a34] px-4 py-2 text-sm font-bold">ปิด</button></form><button type="button" onClick={()=>void sendPayment()} disabled={paymentBlockers.length>0 || sending} className="rounded-lg bg-[#174a34] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{sending ? "กำลังส่ง…" : testMode ? "ส่งหลักฐานทดสอบ" : "ส่งหลักฐานการชำระ"}</button></div>
      </dialog>
    </>}
    {requestsReady && requests.length>0 && <section className="mt-6 border-t border-[#dfcfb2] pt-4"><h3 className="font-bold">ประวัติคำขอชำระค่าบริการ</h3><ul className="mt-3 space-y-2 text-sm">{requests.map(item=><li key={item.id} className="rounded-lg bg-white/60 p-3"><span>{item.is_test ? "รายการทดลอง · " : ""}เดือน {item.month_start.slice(0,7)} · </span><strong>{item.status==="reversed" ? "ย้อนการอนุมัติแล้ว" : item.status==="approved" ? "อนุมัติแล้ว" : item.status==="rejected" ? "ไม่อนุมัติ" : "รอตรวจสอบ"}</strong><span> · ยอดคำขอ <strong>{Number(item.amount_usd).toLocaleString("en-US",{style:"currency",currency:"USD"})}</strong></span>{item.review_note && <p className="mt-1 text-xs text-[#756247]">หมายเหตุ: {item.review_note}</p>}</li>)}</ul></section>}
  </section>;
}
