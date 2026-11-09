import { useEffect, useState } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";
import { PageState } from "../dashboard/PlatformOverviewPage";

interface PlatformSummary {
  restaurant_count: number;
  user_count: number;
  today_order_count: number;
  last_order_at: string | null;
}

export default function SystemMonitorPage() {
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const result = await adminRequest<{ summary: PlatformSummary }>("/api/admin/summary");
        if (active) { setSummary(result.summary); setCheckedAt(new Date().toISOString()); setError(""); }
      } catch (cause) { if (active) setError(cause instanceof AdminApiError ? `ตรวจสอบ API/ฐานข้อมูลไม่สำเร็จ (${cause.code})` : "ตรวจสอบ API/ฐานข้อมูลไม่สำเร็จ"); }
    }
    void check();
    const timer = window.setInterval(() => void check(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [attempt]);

  return <div className="mx-auto max-w-5xl space-y-5"><header><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">SYSTEM MONITOR</p><h1 className="mt-1 text-2xl font-semibold">ติดตามระบบ</h1><p className="mt-1 text-sm text-slate-500">ตรวจการตอบสนองของ Admin API และการอ่านข้อมูลจากฐานข้อมูล</p></header>
    {summary ? <><section className="grid gap-3 sm:grid-cols-3">{[["API และฐานข้อมูล", "พร้อมใช้งาน"], ["ร้านค้า", summary.restaurant_count.toLocaleString("th-TH")], ["บัญชีผู้ใช้", summary.user_count.toLocaleString("th-TH")]].map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={label}><span className="text-xs text-slate-500">{label}</span><strong className="mt-2 block text-xl font-semibold">{value}</strong></article>)}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">การตรวจสอบล่าสุด</h2><dl className="mt-4 grid grid-cols-[1fr_auto] gap-3 text-sm"><dt className="text-slate-500">ผลตรวจ</dt><dd className="m-0 font-medium text-emerald-800">เชื่อมต่อ API และฐานข้อมูลได้</dd><dt className="text-slate-500">เวลาตรวจล่าสุด</dt><dd className="m-0 text-right">{dateTime(checkedAt)}</dd><dt className="text-slate-500">ออเดอร์วันนี้</dt><dd className="m-0">{summary.today_order_count.toLocaleString("th-TH")}</dd><dt className="text-slate-500">อัปเดตอัตโนมัติ</dt><dd className="m-0">ทุก 30 วินาที</dd></dl></section></> : error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-5"><p className="text-sm text-red-800" role="alert">{error}</p><button className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm" type="button" onClick={() => setAttempt((value) => value + 1)}>ลองอีกครั้ง</button></section> : <PageState />}
  </div>;
}

function dateTime(value: string) { return value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
