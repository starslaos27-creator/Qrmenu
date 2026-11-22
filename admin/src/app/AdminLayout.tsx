import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { adminRequest } from "../shared/adminApi";
import type { AdminSection } from "./adminSections";

const navigation = [
  { id: "pro-pricing", label: "ตั้งราคาแพ็กเกจโปร" },
  { id: "overview", label: "ภาพรวม" },
  { id: "shops", label: "จัดการร้านค้า" },
  { id: "users", label: "จัดการผู้ใช้ทั้งหมด" },
  { id: "audit", label: "Audit Log" },
  { id: "monitor", label: "ติดตามระบบ" },
  { id: "contact-messages", label: "ข้อความติดต่อ" },
];

const iconPaths: Record<string, string> = {
  "pro-pricing": "M12 3v18M16 7H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7",
  overview: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-7h6v7",
  shops: "M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M9 20v-6h6v6",
  users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m15 0v-2a4 4 0 0 0-3-3.87M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7a4 4 0 0 1 0 7",
  audit: "M5 4h14v17H5zM8 8h8M8 12h8M8 16h5",
  monitor: "M3 5h18v12H3zM8 21h8m-4-4v4M6 11h3l2-3 2 6 2-3h3",
  "contact-messages": "M3 5h18v14H3zM3 6l9 7 9-7",
  "finance-income": "M12 3v14m-5-5 5 5 5-5M4 21h16",
  "finance-expense": "M12 19V5m-5 5 5-5 5 5M4 21h16",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4",
};
function NavIcon({ name }: { name: string }) { return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>; }

export default function AdminLayout({
  children,
  activeSection,
  adminRole,
  onNavigate,
}: {
  children: ReactNode;
  activeSection: AdminSection;
  adminRole: string;
  onNavigate: (section: AdminSection) => void;
}) {
  const [pending, setPending] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  useEffect(() => {
    const load = () => { void adminRequest<{count:number}>("/api/admin/pro-requests/count").then(data=>setPending(data.count)).catch(()=>{}); };
    load(); const timer=window.setInterval(load,30000); window.addEventListener("pro-requests-changed",load); window.addEventListener("focus",load);
    return () => { window.clearInterval(timer); window.removeEventListener("pro-requests-changed",load); window.removeEventListener("focus",load); };
  }, []);
  useEffect(() => {
    if (adminRole !== "super_admin" && adminRole !== "support") return;
    const load = () => { void adminRequest<{ count: number }>("/api/admin/contact-messages/count").then((data) => setContactCount(data.count)).catch(() => {}); };
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [adminRole]);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <aside className="bg-[#102f23] p-3 text-[#f8f4e9] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <a className="mb-3 flex items-center gap-3 px-2 py-2 text-inherit no-underline" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-xl font-extrabold">S</span>
          <span className="grid"><strong className="text-sm tracking-[.15em]">SHOPQR</strong><small className="text-[9px] tracking-[.14em] text-emerald-100/70">PLATFORM CONTROL</small></span>
        </a>
        <p className="border-t border-white/10 px-3 pb-1.5 pt-3 text-sm font-bold tracking-[.08em] text-emerald-100/65">จัดการแพลตฟอร์ม</p>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-y-auto" aria-label="เมนูผู้ดูแล">
          {navigation.map((item) => <button className={`flex min-h-10 shrink-0 items-center gap-3 rounded-lg border px-3 py-2 text-left text-base leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-200 ${activeSection === item.id ? "border-white/10 bg-white/15 font-semibold text-white shadow-sm" : "border-transparent text-emerald-50/75 hover:bg-white/5 hover:text-white"}`} key={item.id} type="button" aria-current={activeSection === item.id ? "page" : undefined} onClick={() => onNavigate(item.id as AdminSection)}><span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center text-base ${activeSection === item.id ? "text-amber-200" : "text-emerald-200/70"}`}><NavIcon name={item.id} /></span><span className="whitespace-nowrap">{item.label}</span>{item.id === "shops" && pending > 0 && <span aria-label={`${pending} คำขอรอตรวจสอบ`} className="ml-auto rounded-full bg-red-600 px-2 text-xs font-bold text-white">{pending}</span>}{item.id === "contact-messages" && contactCount > 0 && <span aria-label={`${contactCount} ข้อความทั้งหมด`} className="ml-auto rounded-full bg-red-600 px-2 text-xs font-bold text-white">{contactCount}</span>}</button>)}
          <p className="mt-0 border-t border-white/10 px-3 pb-0 pt-1 text-sm font-bold tracking-[.08em] text-emerald-100/65">การเงิน</p>
          {[
            { id: "finance-income", label: "รายรับ", icon: "finance-income" },
            { id: "finance-expense", label: "รายจ่าย", icon: "finance-expense" },
          ].map((item) => <button className={`flex min-h-10 shrink-0 items-center gap-3 rounded-lg border px-3 py-2 text-left text-base leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-200 ${activeSection === item.id ? "border-white/10 bg-white/15 font-semibold text-white shadow-sm" : "border-transparent text-emerald-50/75 hover:bg-white/5 hover:text-white"}`} key={item.id} type="button" aria-current={activeSection === item.id ? "page" : undefined} onClick={() => onNavigate(item.id as AdminSection)}><span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center text-base ${activeSection === item.id ? "text-amber-200" : "text-emerald-200/70"}`}><NavIcon name={item.id} /></span><span className="whitespace-nowrap">{item.label}</span></button>)}
          <p className="mt-1 border-t border-white/10 px-3 pb-0 pt-1 text-sm font-bold tracking-[.08em] text-emerald-100/65">ตั้งค่า</p>
          <button className={`flex min-h-10 shrink-0 items-center gap-3 rounded-lg border px-3 py-2 text-left text-base leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-200 ${activeSection === "settings" ? "border-white/10 bg-white/15 font-semibold text-white shadow-sm" : "border-transparent text-emerald-50/75 hover:bg-white/5 hover:text-white"}`} type="button" aria-current={activeSection === "settings" ? "page" : undefined} onClick={() => onNavigate("settings")}><span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center text-base text-emerald-200/70"><NavIcon name="settings" /></span><span className="whitespace-nowrap">ตั้งค่า</span></button>
        </nav>
        <div className="mt-4 flex shrink-0 items-center border-t border-white/10 px-2 pt-3 lg:mt-auto">
          <span className="grid"><strong className="text-sm">{roleLabel(adminRole)}</strong><small className="mt-1 text-xs text-emerald-100/70">เชื่อมต่อระบบแล้ว</small></span>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "super_admin") return "ผู้ดูแลสูงสุด";
  if (role === "support") return "ฝ่ายสนับสนุน";
  return "ผู้ดูแลระบบ";
}
