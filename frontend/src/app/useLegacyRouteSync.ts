import { useEffect, type RefObject } from "react";

export function toLegacyLocation(url: URL): string {
  const target = new URL(url.href);
  target.searchParams.delete("ui");
  const route = `${target.pathname}${target.search}${target.hash}`;
  const query = new URLSearchParams({ __legacy: "1", __path: route });
  return `/legacy-app.html?${query.toString()}`;
}

export function useLegacyRouteSync(
  frame: RefObject<HTMLIFrameElement>,
  onLocationChange: (location: string) => void,
) {
  useEffect(() => {
    const readLocation = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const lastLocation = { current: readLocation() };

    // Dashboard routes all render the same persistent legacy iframe. Updating
    // the outer React route state for every menu click needlessly rerenders the
    // shell around that iframe and can briefly restore its fallback branding.
    // Only rerender the outer app when navigation crosses to a different app.
    const appSurface = (path: string) => {
      const pathname = path.split(/[?#]/, 1)[0];
      if (pathname === "/login") return "login";
      if (pathname === "/dashboard/upgrade") return "upgrade";
      if (pathname === "/dashboard/upgrade/checkout") return "upgrade-checkout";
      if (pathname === "/dashboard" || pathname === "/dashboard/") return "dashboard-home-redirect";
      return "legacy-dashboard";
    };

    const syncRoute = (next: string) => {
      const previous = lastLocation.current;
      lastLocation.current = next;
      if (appSurface(previous) !== appSurface(next)) onLocationChange(next);
      frame.current?.contentWindow?.postMessage({ type: "shopqr-sync-route", path: next }, window.location.origin);
    };

    const onRoute = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "shopqr-route") return;

      const target = new URL(event.data.path, window.location.origin);
      target.searchParams.delete("__legacy");
      target.searchParams.delete("ui");
      const next = `${target.pathname}${target.search}${target.hash}`;
      const method = event.data.method === "replaceState" ? "replaceState" : "pushState";
      if (`${location.pathname}${location.search}${location.hash}` !== next) {
        window.history[method]({}, "", next);
      }
      syncRoute(next);
    };

    const onPopState = () => {
      const target = new URL(readLocation(), window.location.origin);
      target.searchParams.delete("ui");
      const next = `${target.pathname}${target.search}${target.hash}`;
      if (next !== readLocation()) window.history.replaceState({}, "", next);
      syncRoute(next);
    };

    window.addEventListener("message", onRoute);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("message", onRoute);
      window.removeEventListener("popstate", onPopState);
    };
  }, [frame, onLocationChange]);
}
