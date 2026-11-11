import type { ReactNode } from "react";
import type { AdminSection } from "./adminSections";

const navigation = [
  { id: "pro-pricing", label: "ตั้งราคาแพ็กเกจโปร", icon: "★" },
  { id: "pro", label: "คำขอแพ็กเกจโปร", icon: "★" },
  { id: "overview", label: "ภาพรวม", icon: "⌂" },
  { id: "shops", label: "จัดการร้านค้า", icon: "▦" },
  { id: "users", label: "ควบคุมผู้ใช้งาน", icon: "♙" },
  { id: "audit", label: "Audit Log", icon: "▤" },
  { id: "monitor", label: "ติดตามระบบ", icon: "⌁" },
];

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
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <aside className="bg-[#102f23] p-3 text-[#f8f4e9] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <a className="mb-3 flex items-center gap-3 px-2 py-2 text-inherit no-underline" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-xl font-extrabold">S</span>
          <span className="grid"><strong className="text-sm tracking-[.15em]">SHOPQR</strong><small className="text-[9px] tracking-[.14em] text-emerald-100/70">PLATFORM CONTROL</small></span>
        </a>
        <p className="border-t border-white/10 px-3 pb-1.5 pt-3 text-sm font-bold tracking-[.08em] text-emerald-100/65">จัดการแพลตฟอร์ม</p>
        <nav className="flex gap-0 overflow-x-auto lg:flex-col lg:overflow-y-auto" aria-label="เมนูผู้ดูแล">
          {navigation.map((item) => <button className={`flex h-6 shrink-0 items-center gap-2 rounded-md border px-3 py-0 text-left text-base leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-200 ${activeSection === item.id ? "border-white/10 bg-white/15 font-semibold text-white shadow-sm" : "border-transparent text-emerald-50/75 hover:bg-white/5 hover:text-white"}`} key={item.id} type="button" aria-current={activeSection === item.id ? "page" : undefined} onClick={() => onNavigate(item.id as AdminSection)}><span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center text-base ${activeSection === item.id ? "text-amber-200" : "text-emerald-200/70"}`}>{item.icon}</span><span className="whitespace-nowrap">{item.label}</span></button>)}
          <p className="mt-0 border-t border-white/10 px-3 pb-0 pt-1 text-sm font-bold tracking-[.08em] text-emerald-100/65">การเงิน</p>
          {[
            { id: "finance-income", label: "รายรับ", icon: "↙" },
            { id: "finance-expense", label: "รายจ่าย", icon: "↗" },
          ].map((item) => <button className={`flex h-6 shrink-0 items-center gap-2 rounded-md border px-3 py-0 text-left text-base leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-200 ${activeSection === item.id ? "border-white/10 bg-white/15 font-semibold text-white shadow-sm" : "border-transparent text-emerald-50/75 hover:bg-white/5 hover:text-white"}`} key={item.id} type="button" aria-current={activeSection === item.id ? "page" : undefined} onClick={() => onNavigate(item.id as AdminSection)}><span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center text-base ${activeSection === item.id ? "text-amber-200" : "text-emerald-200/70"}`}>{item.icon}</span><span className="whitespace-nowrap">{item.label}</span></button>)}
          <p className="mt-1 border-t border-white/10 px-3 pb-0 pt-1 text-sm font-bold tracking-[.08em] text-emerald-100/65">ตั้งค่า</p>
          <button className={`flex h-7 shrink-0 items-center gap-2 rounded-md border px-3 py-0 text-left text-base leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-200 ${activeSection === "settings" ? "border-white/10 bg-white/15 font-semibold text-white shadow-sm" : "border-transparent text-emerald-50/75 hover:bg-white/5 hover:text-white"}`} type="button" aria-current={activeSection === "settings" ? "page" : undefined} onClick={() => onNavigate("settings")}><span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center text-base text-emerald-200/70">⚙</span><span className="whitespace-nowrap">ตั้งค่า</span></button>
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
