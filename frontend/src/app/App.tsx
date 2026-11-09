import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from "react";
import { useLegacyRouteSync } from "./useLegacyRouteSync";
import LanguageControl from "../shared/i18n/LanguageControl";
import LanguageTranslation from "../shared/i18n/LanguageTranslation";

const LoginPage = lazy(() => import("../pages/auth/LoginPage"));
const LegacyApplicationPage = lazy(() => import("../pages/LegacyApplicationPage"));
const UpgradePage = lazy(() => import("../pages/upgrade/UpgradePage"));
const UpgradeCheckoutPage = lazy(() => import("../pages/upgrade/UpgradeCheckoutPage"));

export default function App() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [location, setLocation] = useState(() => currentLocation());
  useLegacyRouteSync(frame, setLocation);

  const path = location.split(/[?#]/, 1)[0];
  useEffect(() => {
    if (path === "/dashboard" || path === "/dashboard/") {
      const next = "/dashboard/close-shop";
      window.history.replaceState({}, "", next);
      setLocation(next);
      return;
    }
  }, [path]);

  return <>
    <LanguageTranslation frameRef={frame} />
    <LanguageControl />
    <Suspense fallback={<PageLoading />}>
      {renderPage({ path, frame })}
    </Suspense>
  </>;
}

function renderPage({ path, frame }: {
  path: string;
  frame: RefObject<HTMLIFrameElement>;
}) {
  if (path === "/dashboard" || path === "/dashboard/") return <PageLoading />;
  // Keep the original restaurant UI, including authentication and navigation.
  if (path === "/dashboard/upgrade") return <UpgradePage />;
  if (path === "/dashboard/upgrade/checkout") return <UpgradeCheckoutPage />;
  // Render login directly so authentication does not depend on the legacy iframe.
  if (path === "/login") return <LoginPage />;
  // Keep a single dashboard UI for every menu destination. In particular,
  // do not switch to the unfinished source layout when a navigation link drops
  // the optional `ui=source` query parameter.
  return <LegacyApplicationPage frame={frame} />;
}

function PageLoading() {
  return <main className="grid min-h-screen place-items-center bg-stone-50" aria-label="กำลังโหลด">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-800/20 border-t-emerald-800" />
  </main>;
}

function currentLocation() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

