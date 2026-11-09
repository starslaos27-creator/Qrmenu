import { useEffect, useState } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";

interface Summary {
  restaurant_count: number;
  suspended_restaurant_count: number;
  user_count: number;
  migrated_user_count: number;
  pending_migration_count: number;
  disabled_user_count: number;
  today_order_count: number;
  today_revenue: number;
  last_order_at: string | null;
}

export default function PlatformOverviewPage({ onOpen }: { onOpen: (section: "shops" | "users" | "audit") => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminRequest<{ summary: Summary }>("/api/admin/summary")
      .then((result) => { if (active) setSummary(result.summary); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof AdminApiError ? `โหลดภาพรวมไม่สำเร็จ (${cause.code})` : "โหลดภาพรวมไม่สำเร็จ"); });
    return () => { active = false; };
  }, []);

  if (!summary) return <PageState error={error} />;
  const cards = [
    ["ร้านค้าทั้งหมด", summary.restaurant_count, `${summary.suspended_restaurant_count.toLocaleString()} ร้านถูกระงับ`, "shops"],
    ["บัญชีผู้ใช้", summary.user_count, `${summary.disabled_user_count.toLocaleString()} บัญชีถูกปิดใช้งาน`, "users"],
    ["บัญชีที่ย้ายระบบแล้ว", summary.migrated_user_count, `${summary.pending_migration_count.toLocaleString()} บัญชียังรอดำเนินการ`, "users"],
    ["ออเดอร์วันนี้", summary.today_order_count, `รายรับ ${money(summary.today_revenue)}`, "shops"],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">PLATFORM OVERVIEW</p><h1 className="mt-1 text-2xl font-semibold">ศูนย์ควบคุมระบบ</h1><p className="mt-1 text-sm text-slate-500">สรุปสถานะร้านค้าและบัญชีผู้ใช้</p></header>
      {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">{error}</p>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="ตัวชี้วัดระบบ">
        {cards.map(([label, value, caption, section]) => <button className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={label} type="button" onClick={() => onOpen(section)}><span className="text-xs text-slate-500">{label}</span><strong className="mt-2 block text-2xl font-semibold tabular-nums">{value.toLocaleString("th-TH")}</strong><small className="mt-2 block text-xs text-slate-500">{caption}</small></button>)}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">สถานะการย้ายบัญชี</h2><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${summary.user_count ? summary.migrated_user_count / summary.user_count * 100 : 0}%` }} /></div><p className="mt-3 text-sm text-slate-600">ดำเนินการแล้ว {percentage(summary.migrated_user_count, summary.user_count)} · รอ {summary.pending_migration_count.toLocaleString("th-TH")} บัญชี</p><button className="mt-3 text-sm font-medium text-emerald-800 hover:underline" type="button" onClick={() => onOpen("users")}>ดูบัญชีผู้ใช้ →</button></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">การทำงานล่าสุด</h2><dl className="mt-4 grid grid-cols-[1fr_auto] gap-3 text-sm"><dt className="text-slate-500">ออเดอร์ล่าสุด</dt><dd className="m-0 text-right">{summary.last_order_at ? dateTime(summary.last_order_at) : "ยังไม่มี"}</dd><dt className="text-slate-500">ร้านที่ใช้งานอยู่</dt><dd className="m-0 text-right">{(summary.restaurant_count - summary.suspended_restaurant_count).toLocaleString("th-TH")}</dd></dl><button className="mt-3 text-sm font-medium text-emerald-800 hover:underline" type="button" onClick={() => onOpen("audit")}>เปิด Audit Log →</button></article>
      </section>
    </div>
  );
}

export function PageState({ error }: { error?: string }) {
  return <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{error || "กำลังโหลดข้อมูล…"}</div>;
}

function money(value: number) { return `${Number(value || 0).toLocaleString("th-TH")} ₭`; }
function percentage(part: number, total: number) { return `${total ? Math.round(part / total * 100) : 0}%`; }
function dateTime(value: string) { return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
