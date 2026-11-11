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
  activity: {
    trackingReady: boolean;
    onlineCount: number;
    onlineAccounts: AccountActivity[];
    recentlyAwayCount: number;
    pausedCount: number;
    pausedAccounts: AccountActivity[];
    inactiveCount: number;
    inactiveAccounts: AccountActivity[];
    suspendedInactiveCount: number;
    suspendedInactiveAccounts: AccountActivity[];
  };
}

interface AccountActivity {
  id: string;
  name: string;
  email: string;
  restaurants: string;
  lastActivityAt: string;
}

export default function PlatformOverviewPage({ onOpen }: { onOpen: (section: "shops" | "users" | "audit") => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () => adminRequest<{ summary: Summary }>("/api/admin/summary")
      .then((result) => { if (active) { setSummary(result.summary); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof AdminApiError ? `โหลดภาพรวมไม่สำเร็จ (${cause.code})` : "โหลดภาพรวมไม่สำเร็จ"); });
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, []);

  if (!summary) return <PageState error={error} />;
  const cards = [
    ["ร้านค้าทั้งหมด", summary.restaurant_count, `${summary.suspended_restaurant_count.toLocaleString()} ร้านถูกระงับ`, "shops"],
    ["บัญชีผู้ใช้", summary.user_count, `${summary.disabled_user_count.toLocaleString()} บัญชีถูกปิดใช้งาน`, "users"],
    ["บัญชีที่ย้ายระบบแล้ว", summary.migrated_user_count, `${summary.pending_migration_count.toLocaleString()} บัญชียังรอดำเนินการ`, "users"],
    ["ออเดอร์วันนี้", summary.today_order_count, `รายรับ ${money(summary.today_revenue)}`, "shops"],
  ] as const;
  const activityCards = [
    { label: "ออนไลน์", count: summary.activity.onlineCount, accounts: summary.activity.onlineAccounts, tone: "emerald", marker: "●", note: `สัญญาณล่าสุด ≤ 5 นาที · เพิ่งออฟไลน์ 5 นาที–1 ชม.: ${summary.activity.recentlyAwayCount.toLocaleString("th-TH")} บัญชี` },
    { label: "พักชั่วคราว", count: summary.activity.pausedCount, accounts: summary.activity.pausedAccounts, tone: "amber", marker: "◷", note: "ไม่มีการเคลื่อนไหวเกิน 1 ชั่วโมง ถึง 3 วัน" },
    { label: "ไม่มีการเคลื่อนไหว", count: summary.activity.inactiveCount, accounts: summary.activity.inactiveAccounts, tone: "rose", marker: "○", note: "ไม่มีการเคลื่อนไหวเกิน 3 วัน · เกิน 365 วันระบบระงับอัตโนมัติ" },
    { label: "ระงับอัตโนมัติ", count: summary.activity.suspendedInactiveCount, accounts: summary.activity.suspendedInactiveAccounts, tone: "slate", marker: "⊘", note: "เกิน 365 วัน · เก็บข้อมูลไว้ ไม่ลบ" },
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
      {summary.activity.trackingReady ? <section aria-label="สถานะกิจกรรมบัญชีผู้ใช้" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {activityCards.map((card) => <article className={`rounded-2xl border bg-white p-4 shadow-sm ${activityTone(card.tone)}`} key={card.label}>
          <header className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden="true">{card.marker}</span>{card.label}</h2>
            <strong className="text-2xl tabular-nums">{card.count.toLocaleString("th-TH")}</strong>
          </header>
          <p className="mt-1 text-xs text-slate-500">{card.note}</p>
          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {card.accounts.length ? card.accounts.slice(0, 4).map((account) => <li className="min-w-0" key={account.id}>
              <button className="block max-w-full truncate text-left text-xs font-medium text-slate-800 hover:underline" type="button" onClick={() => onOpen("users")} title={account.email}>{account.name}</button>
              <p className="truncate text-[11px] text-slate-500" title={account.email}>{account.email}</p>
              {account.restaurants && <p className="truncate text-[11px] text-slate-500" title={account.restaurants}>ร้าน: {account.restaurants}</p>}
              <p className="text-[11px] text-slate-400">ล่าสุด {activityAge(account.lastActivityAt)}</p>
            </li>) : <li className="text-xs text-slate-400">ไม่มีบัญชีในกลุ่มนี้</li>}
          </ul>
          {card.count > Math.min(card.accounts.length, 4) && <button className="mt-3 text-xs font-medium text-emerald-800 hover:underline" type="button" onClick={() => onOpen("users")}>ดูบัญชีทั้งหมด →</button>}
        </article>)}
      </section> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">การติดตามกิจกรรมยังไม่พร้อม กรุณารัน migration <code>0042_account_activity.sql</code> ใน backend แล้ว restart ระบบ</p>}
    </div>
  );
}

export function PageState({ error }: { error?: string }) {
  return <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{error || "กำลังโหลดข้อมูล…"}</div>;
}

function money(value: number) { return `${Number(value || 0).toLocaleString("th-TH")} ₭`; }
function percentage(part: number, total: number) { return `${total ? Math.round(part / total * 100) : 0}%`; }
function dateTime(value: string) { return new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function activityAge(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "เมื่อครู่นี้";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}
function activityTone(tone: "emerald" | "amber" | "rose" | "slate") {
  return {
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
    amber: "border-amber-200 bg-amber-50/70 text-amber-950",
    rose: "border-rose-200 bg-rose-50/70 text-rose-950",
    slate: "border-slate-300 bg-slate-100/80 text-slate-900",
  }[tone];
}
