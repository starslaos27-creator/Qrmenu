export default function KioskPrintingSettings() {
  const publicOrigin = (window as Window & { SHOPQR_PUBLIC_URL?: string }).SHOPQR_PUBLIC_URL || window.location.origin;
  const kitchenUrl = `${publicOrigin.replace(/\/$/, "")}/dashboard/kitchen`;
  return <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-800"><span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>ตั้งค่าการพิมพ์อัตโนมัติสำหรับเครื่องครัว</summary>
    <div className="space-y-3 border-t border-slate-100 px-4 py-4 text-xs text-slate-600">
      <p>เปิดหน้าครัวด้วย Chrome ในโหมด kiosk printing เพื่อพิมพ์ใบงานอัตโนมัติ</p>
      <div><p className="mb-1 font-medium text-slate-800">Windows</p><pre className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white">{`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing ${kitchenUrl}`}</pre></div>
      <div><p className="mb-1 font-medium text-slate-800">macOS</p><pre className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white">{`open -a "Google Chrome" --args --kiosk-printing ${kitchenUrl}`}</pre></div>
      <p className="m-0 italic">กำหนดเครื่องพิมพ์เริ่มต้นในระบบปฏิบัติการก่อนเปิดใช้งาน</p>
    </div>
  </details>;
}
