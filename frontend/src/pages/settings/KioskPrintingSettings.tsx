import { useState } from "react";

export default function KioskPrintingSettings() {
  const [copied, setCopied] = useState<"windows" | "macos" | null>(null);
  const publicOrigin = (window as Window & { SHOPQR_PUBLIC_URL?: string }).SHOPQR_PUBLIC_URL || window.location.origin;
  const kitchenUrl = `${publicOrigin.replace(/\/$/, "")}/dashboard/kitchen`;
  const commands = {
    windows: `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing ${kitchenUrl}`,
    macos: `open -a "Google Chrome" --args --kiosk-printing ${kitchenUrl}`,
  };

  async function copyCommand(command: string, platform: "windows" | "macos") {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = command;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) return;
    }
    setCopied(platform);
    window.setTimeout(() => setCopied((current) => current === platform ? null : current), 1600);
  }

  return <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-800"><span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>ตั้งค่าการพิมพ์อัตโนมัติสำหรับเครื่องครัว</summary>
    <div className="space-y-3 border-t border-slate-100 px-4 py-4 text-xs text-slate-600">
      <p>เปิดหน้าครัวด้วย Chrome ในโหมด kiosk printing เพื่อพิมพ์ใบงานอัตโนมัติ</p>
      <div><p className="mb-1 font-medium text-slate-800">Windows / Linux</p><div className="flex min-w-0 items-stretch gap-2"><pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white">{commands.windows}</pre><span className="shrink-0 rounded-lg border-2 border-red-600 bg-canvas/50 p-1"><button type="button" onClick={() => void copyCommand(commands.windows, "windows")} className="h-full rounded-md border border-red-700 bg-red-600 px-4 text-sm font-extrabold tracking-wide text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{copied === "windows" ? "คัดลอกแล้ว" : "คัดลอก"}</button></span></div></div>
      <div><p className="mb-1 font-medium text-slate-800">macOS</p><div className="flex min-w-0 items-stretch gap-2"><pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white">{commands.macos}</pre><span className="shrink-0 rounded-lg border-2 border-red-600 bg-canvas/50 p-1"><button type="button" onClick={() => void copyCommand(commands.macos, "macos")} className="h-full rounded-md border border-red-700 bg-red-600 px-4 text-sm font-extrabold tracking-wide text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{copied === "macos" ? "คัดลอกแล้ว" : "คัดลอก"}</button></span></div></div>
      <p className="m-0 italic">กำหนดเครื่องพิมพ์เริ่มต้นในระบบปฏิบัติการก่อนเปิดใช้งาน</p>
    </div>
  </details>;
}
