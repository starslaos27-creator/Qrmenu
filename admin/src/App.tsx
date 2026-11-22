import { useEffect, useState } from "react";
import AdminLayout from "./app/AdminLayout";
import { navigateToAdminSection, readAdminSection, type AdminSection } from "./app/adminSections";
import { useAdminSession } from "./app/useAdminSession";
import AdminBootstrapPage from "./pages/auth/AdminBootstrapPage";
import AdminLoginPage from "./pages/auth/AdminLoginPage";
import AdminSettingsPage from "./pages/settings/AdminSettingsPage";
import PlatformAuditPage from "./pages/audit/PlatformAuditPage";
import PlatformOverviewPage from "./pages/dashboard/PlatformOverviewPage";
import SystemMonitorPage from "./pages/monitor/SystemMonitorPage";
import ProPricingPage from "./pages/pro/ProPricingPage";
import PlatformFinancePage from "./pages/finance/PlatformFinancePage";
import ShopManagementPage from "./pages/shops/ShopManagementPage";
import UserManagementPage from "./pages/users/UserManagementPage";
import ContactMessagesPage from "./pages/contact/ContactMessagesPage";

export default function App() {
  const { auth, completeLogin, completeBootstrap, signOut, requireLogin } = useAdminSession();
  const [section, setSection] = useState<AdminSection>(() => readAdminSection());

  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("section") === "pro") {
        url.searchParams.set("section", "shops"); url.searchParams.set("view", "requests");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
      setSection(readAdminSection());
    };
    handlePopState();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(next: AdminSection) {
    setSection(next);
    navigateToAdminSection(next);
  }

  if (auth.status === "loading") return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">กำลังโหลดข้อมูลผู้ดูแลระบบ…</div>;
  if (auth.status === "bootstrap") return <AdminBootstrapPage requiresToken={auth.requiresToken} onComplete={completeBootstrap} />;
  if (auth.status === "login") return <AdminLoginPage onAuthenticated={(role) => void completeLogin(role)} />;

  const canManage = auth.session.adminRole === "super_admin" || auth.session.adminRole === "support";
  return <AdminLayout activeSection={section} adminRole={auth.session.adminRole} onNavigate={navigate}>
    {section === "overview" && <PlatformOverviewPage onOpen={navigate} />}
    {section === "shops" && <ShopManagementPage canManage={canManage} />}
    {section === "users" && <UserManagementPage canManage={canManage} currentAdminId={auth.session.user.id} />}
    {section === "audit" && <PlatformAuditPage />}
    {section === "monitor" && <SystemMonitorPage />}
    {section === "contact-messages" && <ContactMessagesPage canManage={canManage} />}
    {section === "pro-pricing" && <ProPricingPage canManage={canManage} />}
    {section === "finance-income" && <PlatformFinancePage kind="income" canManage={canManage} />}
    {section === "finance-expense" && <PlatformFinancePage kind="expense" canManage={canManage} />}
    {section === "settings" && <AdminSettingsPage user={auth.session.user} adminRole={auth.session.adminRole} onRequireLogin={requireLogin} onSignOut={() => void signOut()} />}
  </AdminLayout>;
}
