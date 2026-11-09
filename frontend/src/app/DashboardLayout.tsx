import type { ReactNode } from "react";

const navigation = [
  { path: "/dashboard", label: "ภาพรวม" },
  { path: "/dashboard/backend", label: "จัดการร้าน" },
  { path: "/dashboard/menu", label: "เมนู" },
  { path: "/dashboard/categories", label: "หมวดหมู่" },
  { path: "/dashboard/inventory", label: "คลังสินค้า" },
  { path: "/dashboard/stock-deposits", label: "ฝากสินค้า" },
  { path: "/dashboard/tables", label: "โต๊ะ" },
  { path: "/dashboard/kitchen", label: "ครัว" },
  { path: "/dashboard/bills", label: "บิล" },
  { path: "/dashboard/finance", label: "การเงิน" },
  { path: "/dashboard/promotions", label: "โปรโมชั่น" },
  { path: "/dashboard/stats", label: "สถิติ" },
  { path: "/dashboard/close-shop", label: "สรุปยอดปิดร้าน" },
  { path: "/dashboard/audit", label: "ประวัติการใช้งาน" },
  { path: "/dashboard/feedback", label: "ข้อเสนอแนะ" },
  { path: "/dashboard/settings", label: "ตั้งค่า" },
];

export default function DashboardLayout({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 lg:flex">
      <aside className="border-b border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <a className="mb-4 block px-3 py-2 text-lg font-bold tracking-tight text-emerald-900" href="/dashboard">ShopQR</a>
        <nav className="flex gap-1 overflow-x-auto lg:grid lg:gap-1" aria-label="เมนูจัดการร้าน">
          {navigation.map((item) => (
            <a
              key={item.path}
              href={item.path}
              aria-current={currentPath === item.path ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition hover:bg-slate-100 ${currentPath === item.path ? "bg-emerald-50 font-semibold text-emerald-900" : "text-slate-600"}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
