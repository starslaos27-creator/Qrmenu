import { useState, type RefObject } from "react";
import { toLegacyLocation } from "../app/useLegacyRouteSync";

interface LegacyApplicationPageProps {
  frame: RefObject<HTMLIFrameElement>;
}

export default function LegacyApplicationPage({ frame }: LegacyApplicationPageProps) {
  // Keep the iframe document mounted while its inner SPA changes routes.
  // Recomputing this from window.location on every parent render reloads the
  // entire legacy app and causes a visible flash on each navigation.
  const [src] = useState(() => {
    const target = new URL(toLegacyLocation(new URL(window.location.href)), window.location.origin);
    target.searchParams.set("__shell", "remove-stock-deposits-menu-20261104-v5");
    return `${target.pathname}${target.search}${target.hash}`;
  });

  return (
    <iframe
      key="legacy-app-remove-stock-deposits-menu-v14"
      ref={frame}
      className="block h-screen w-full border-0 bg-stone-50"
      title="ShopQR restaurant and customer application"
      src={src}
    />
  );
}
