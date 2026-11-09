import { useEffect, useState } from "react";
import AdminLayout from "./app/AdminLayout";
import { navigateToAdminSection, readAdminSection, type AdminSection } from "./app/adminSections";
import { useAdminSession } from "./app/useAdminSession";
import AdminBootstrapPage from "./pages/auth/AdminBootstrapPage";
import AdminLoginPage from "./pages/auth/AdminLoginPage";
import PlatformAuditPage from "./pages/audit/PlatformAuditPage";
import PlatformOverviewPage from "./pages/dashboard/PlatformOverviewPage";
import SystemMonitorPage from "./pages/monitor/SystemMonitorPage";
import ProPricingPage from "./pages/pro/ProPricingPage";
import ProRequestsPage from "./pages/pro/ProRequestsPage";
import ShopManagementPage from "./pages/shops/ShopManagementPage";
import UserManagementPage from "./pages/users/UserManagementPage";

export default function App() {
  const { auth, completeLogin, completeBootstrap, signOut } = useAdminSession();
  const [section, setSection] = useState<AdminSection>(() => readAdminSection());

  useEffect(() => {
    const handlePopState = () => setSection(readAdminSection());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(next: AdminSection) {
    setSection(next);
    navigateToAdminSection(next);
  }

  if (auth.status === "loading") return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">กำลังโหลดข้อมูลผู้ดูแลระบบ…</div>;
  if (auth.status === "bootstrap") return <AdminBootstrapPage onComplete={completeBootstrap} />;
  if (auth.status === "login") return <AdminLoginPage onAuthenticated={(role) => void completeLogin(role)} />;

  const canManage = auth.session.adminRole === "super_admin" || auth.session.adminRole === "support";
  return <AdminLayout activeSection={section} adminRole={auth.session.adminRole} onNavigate={navigate} onSignOut={() => void signOut()}>
    {section === "overview" && <PlatformOverviewPage onOpen={navigate} />}
    {section === "shops" && <ShopManagementPage canManage={canManage} />}
    {section === "users" && <UserManagementPage canManage={canManage} currentAdminId={auth.session.user.id} />}
    {section === "audit" && <PlatformAuditPage />}
    {section === "monitor" && <SystemMonitorPage />}
    {section === "pro" && <ProRequestsPage canManage={canManage} />}
    {section === "pro-pricing" && <ProPricingPage canManage={canManage} />}
  </AdminLayout>;
}
