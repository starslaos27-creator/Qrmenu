export const ADMIN_SECTIONS = [
  "overview",
  "shops",
  "users",
  "audit",
  "monitor",
  "contact-messages",
  "pro-pricing",
  "finance-income",
  "finance-expense",
  "settings",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function readAdminSection(search = window.location.search): AdminSection {
  const value = new URLSearchParams(search).get("section");
  if (value === "pro") return "shops";
  return ADMIN_SECTIONS.includes(value as AdminSection) ? value as AdminSection : "overview";
}

export function navigateToAdminSection(section: AdminSection) {
  const url = new URL(window.location.href);
  url.searchParams.set("section", section);
  window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
