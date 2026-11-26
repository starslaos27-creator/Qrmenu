import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./app/AdminLayout";
import { ADMIN_SECTIONS, navigateToAdminSection, readAdminSection, type AdminSection } from "./app/adminSections";
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
  const allowedSections = useMemo(() => {
    if (auth.status !== "ready") return [];
    return ADMIN_SECTIONS.filter((item) => {
      const permission = auth.session.adminPermissions?.[item];
      if (item === "users" && ["super_admin", "support"].includes(auth.session.adminRole)) return true;
      return auth.session.adminPermissions
        ? permission === "view" || permission === "edit"
        : auth.session.adminRole === "viewer" || auth.session.adminRole === "super_admin" || auth.session.adminRole === "support";
    });
  }, [auth]);

  useEffect(() => {
    if (auth.status !== "ready") return;
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
  }, [auth.status, allowedSections]);

  useEffect(() => {
    if (auth.status === "ready" && !allowedSections.includes(section) && allowedSections.length) navigate(allowedSections[0]);
  }, [auth.status, section, allowedSections]);

  function navigate(next: AdminSection) {
    setSection(next);
    navigateToAdminSection(next);
  }

  if (auth.status === "loading") return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">กำลังโหลดข้อมูลผู้ดูแลระบบ…</div>;
  if (auth.status === "bootstrap") return <AdminBootstrapPage requiresToken={auth.requiresToken} onComplete={completeBootstrap} />;
  if (auth.status === "login") return <AdminLoginPage onAuthenticated={(role) => void completeLogin(role)} />;

  const canEdit = (target: AdminSection) => auth.session.adminPermissions
    ? auth.session.adminPermissions[target] === "edit"
    : auth.session.adminRole === "super_admin" || auth.session.adminRole === "support";
  const canManageAdminAccess = auth.session.adminRole === "super_admin" || auth.session.adminRole === "support";
  const activeSection = allowedSections.includes(section) ? section : allowedSections[0] || section;
  return <AdminLayout activeSection={activeSection} allowedSections={allowedSections} adminRole={auth.session.adminRole} onNavigate={navigate}>
    {activeSection === "overview" && <PlatformOverviewPage onOpen={navigate} />}
    {activeSection === "shops" && <ShopManagementPage canManage={canEdit("shops")} />}
    {activeSection === "users" && <UserManagementPage canManage={canEdit("users")} canManageAdminAccess={canManageAdminAccess} canDeleteUsers={auth.session.adminRole === "super_admin"} currentAdminId={auth.session.user.id} />}
    {activeSection === "audit" && <PlatformAuditPage />}
    {activeSection === "monitor" && <SystemMonitorPage />}
    {activeSection === "contact-messages" && <ContactMessagesPage canManage={canEdit("contact-messages")} canView={allowedSections.includes("contact-messages")} />}
    {activeSection === "pro-pricing" && <ProPricingPage canManage={canEdit("pro-pricing")} />}
    {activeSection === "finance-income" && <PlatformFinancePage kind="income" canManage={canEdit("finance-income")} />}
    {activeSection === "finance-expense" && <PlatformFinancePage kind="expense" canManage={canEdit("finance-expense")} />}
    {activeSection === "settings" && <AdminSettingsPage user={auth.session.user} adminRole={auth.session.adminRole} canManage={canEdit("settings")} onRequireLogin={requireLogin} onSignOut={() => void signOut()} />}
  </AdminLayout>;
}
