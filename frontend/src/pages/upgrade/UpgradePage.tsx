import { useState } from "react";
import useProPricing from "./useProPricing";
import useProPurchaseStatus from "./useProPurchaseStatus";

export const proPackages = [
  { paid: 1, free: 0 },
  { paid: 3, free: 0 },
  { paid: 6, free: 1 },
  { paid: 9, free: 1 },
  { paid: 12, free: 2 },
].map(p => ({ ...p, total: p.paid + p.free, discount: p.free / (p.paid + p.free) * 100 }));

export default function UpgradePage() {
  const {price,loading,error} = useProPricing();
  const purchase = useProPurchaseStatus();
  const [selected, setSelected] = useState(4);
  const monthly = Number(price);
  const hasPrice = price.trim() !== "" && Number.isFinite(monthly) && monthly > 0;
  const format = (value: number) => value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
  const money = (multiplier: number) => hasPrice ? `${(monthly * multiplier).toLocaleString("en-US", { style: "currency", currency: "USD" })} USD` : "—";
  const current = proPackages[selected];
  function checkout(index: number) {
    if(purchase.blocked)return;
    setSelected(index);
    window.location.assign(`/dashboard/upgrade/checkout?months=${proPackages[index].paid}`);
  }

  return <main className="min-h-screen bg-[#f2e8d8] px-4 py-8 text-[#174a34] sm:px-8 lg:py-12">
    <div className="mx-auto max-w-screen-2xl">
      <a href="/dashboard" className="text-sm font-semibold underline underline-offset-4">← กลับหน้าภาพรวม</a>
      <a href="/dashboard/upgrade/checkout?months=1" className="float-right text-sm font-semibold underline underline-offset-4">ประวัติคำขอ</a>
      <header className="mb-8 mt-8 text-center">
        <span className="rounded-full bg-[#174a34] px-4 py-1.5 text-xs font-bold tracking-widest text-white">QR MENU PRO</span>
        <h1 className="mb-3 mt-5 text-3xl font-bold sm:text-4xl">เลือกแพ็กเกจที่เหมาะกับร้านคุณ</h1>
        <p className="text-[#756247]">ร้านใหม่ทดลองโปรฟรี 3 เดือนทันทีหลังสมัคร · เลือกดูแพ็กเกจอื่นเพื่อเปรียบเทียบราคา</p>
      </header>
      <section className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dfcfb2] bg-[#fffaf1] p-5" aria-label="คำนวณราคาแพ็กเกจ">
        <div><h2 className="font-bold">ราคาปกติรายเดือน</h2><p className="mt-1 text-sm text-[#756247]">ราคาที่กำหนดโดยแอดมิน · ดอลลาร์สหรัฐ (USD)</p></div>
        <strong>{loading ? "กำลังโหลดราคา…" : hasPrice ? money(1) : "ยังไม่กำหนดราคา"}</strong>
      </section>
      {error && <p role="alert" className="mb-5 text-sm text-red-800">{error} <button onClick={()=>window.location.reload()} className="underline">โหลดใหม่</button></p>}
      {purchase.message && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{purchase.message}</p>}
      {purchase.error && <p role="alert" className="mb-5 text-sm text-red-800">{purchase.error} <button onClick={()=>void purchase.refresh()} className="underline">ลองใหม่</button></p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <article className={`relative flex flex-col rounded-2xl border bg-[#fffaf1] p-5 ${purchase.trialActive ? "border-emerald-700 ring-2 ring-emerald-700" : "border-[#dfcfb2]"}`}>
          <span className="mb-3 self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">ฟรีสำหรับร้านใหม่</span>
          <h2 className="text-xl font-bold">3 เดือน</h2>
          <p className="mb-5 mt-2 min-h-6 text-sm font-semibold text-emerald-700">ทดลองใช้โปรฟรี</p>
          <p className="break-words text-2xl font-bold">ฟรี</p><p className="mt-1 text-xs text-[#756247]">ไม่เรียกเก็บเงิน</p>
          <dl className="my-5 space-y-3 border-y border-[#dfcfb2] py-4 text-sm">
            <div className="flex justify-between gap-2"><dt>จ่ายสำหรับ</dt><dd className="font-semibold">ฟรี</dd></div>
            <div className="flex justify-between gap-2"><dt>ใช้งานทั้งหมด</dt><dd className="font-bold">3 เดือน</dd></div>
            <div><dt className="text-[#756247]">เฉลี่ยต่อเดือนที่ใช้งาน</dt><dd className="mt-1 font-semibold">ฟรี</dd></div>
          </dl>
          <p className="mb-5 text-sm font-bold">เริ่มนับทันทีเมื่อเปิดร้านใหม่</p>
          <button type="button" disabled className="mt-auto w-full rounded-xl border border-[#174a34] px-3 py-3 text-sm font-bold text-[#174a34] disabled:opacity-60">{purchase.trialActive ? "กำลังทดลองใช้ฟรี" : purchase.loading ? "ตรวจสอบสิทธิ์…" : "สิทธิ์สำหรับร้านใหม่เท่านั้น"}</button>
        </article>
        {proPackages.map((p, index) => <article key={p.paid} className={`relative flex flex-col rounded-2xl border bg-[#fffaf1] p-5 ${selected === index ? "border-[#174a34] ring-2 ring-[#174a34]" : "border-[#dfcfb2]"}`}>
          {index === 4 && <span className="mb-3 self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">คุ้มค่าที่สุด</span>}
          <h2 className="text-xl font-bold">{p.paid} เดือน</h2>
          <p className="mb-5 mt-2 min-h-6 text-sm font-semibold text-emerald-700">{p.free ? `แถม ${p.free} เดือน` : "แพ็กเกจปกติ"}</p>
          <p className="break-words text-2xl font-bold">{money(p.paid)}</p><p className="mt-1 text-xs text-[#756247]">ยอดรวมแพ็กเกจ</p>
          <dl className="my-5 space-y-3 border-y border-[#dfcfb2] py-4 text-sm">
            <div className="flex justify-between gap-2"><dt>จ่ายสำหรับ</dt><dd className="font-semibold">{p.paid} เดือน</dd></div>
            <div className="flex justify-between gap-2"><dt>ใช้งานทั้งหมด</dt><dd className="font-bold">{p.total} เดือน</dd></div>
            <div><dt className="text-[#756247]">เฉลี่ยต่อเดือนที่ใช้งาน</dt><dd className="mt-1 font-semibold">{money(p.paid / p.total)}</dd></div>
          </dl>
          <p className="mb-5 text-sm font-bold">{p.free ? `ประหยัด ${format(p.discount)}%` : "ราคาปกติ · ไม่มีเดือนแถม"}</p>
          <button type="button" disabled={!hasPrice||loading||purchase.blocked} onClick={() => checkout(index)} className={`mt-auto w-full rounded-xl border border-[#174a34] px-3 py-3 text-sm font-bold transition hover:bg-emerald-100 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 ${selected === index ? "bg-[#174a34] text-white hover:bg-emerald-900" : "text-[#174a34]"}`}>{purchase.active ? purchase.trialActive ? "กำลังทดลองใช้ฟรี" : "แพ็กเกจโปรยังไม่หมดอายุ" : purchase.pending ? "รออนุมัติ" : purchase.loading ? "ตรวจสอบสถานะ…" : "เลือกแพ็กเกจ"}</button>
        </article>)}
      </div>
      <section aria-live="polite" className="mt-7 rounded-2xl bg-[#174a34] p-6 text-white">
        <h2 className="text-lg font-bold">แพ็กเกจที่เลือก: {current.paid} เดือน{current.free ? ` แถม ${current.free} เดือน` : ""}</h2>
        <p className="mt-2">รับสิทธิ์ใช้งานรวม {current.total} เดือน · ยอดรวม {money(current.paid)} · เฉลี่ย {money(current.paid / current.total)}/เดือน</p>
        <p className="mt-3 text-sm text-emerald-100">กดเลือกแพ็กเกจเพื่อไปหน้าชำระเงินและตรวจสอบรายละเอียดก่อนชำระ</p>
      </section>
      <p className="mt-5 text-center text-xs leading-6 text-[#756247]">ส่วนลด = เดือนแถม ÷ เดือนที่ได้รับทั้งหมด × 100 · ราคาเฉลี่ย = ยอดรวม ÷ เดือนที่ได้รับทั้งหมด<br />ราคาทุกแพ็กเกจคำนวณจากราคาปกติรายเดือนที่แอดมินกำหนด</p>
    </div>
  </main>;
}
