import type { ReactNode } from "react";

export default function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><a href="/" className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">ShopQR</a><h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p><div className="mt-6">{children}</div></section></main>;
}
