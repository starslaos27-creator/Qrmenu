import { useCallback, useEffect, useState } from "react";
import { adminRequest, AdminApiError } from "../../shared/adminApi";
import { PageState } from "../dashboard/PlatformOverviewPage";

interface AuditEntry {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  restaurant_name: string | null;
  admin_email: string | null;
  reason: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export default function PlatformAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ search, action, actor, limit: "100", offset: String(offset) });
    if (from) query.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) query.set("until", new Date(`${to}T23:59:59.999`).toISOString());
    try {
      const result = await adminRequest<{ logs: AuditEntry[]; total: number }>(`/api/admin/audit-logs?${query}`);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (cause) { setError(cause instanceof AdminApiError ? `โหลด Audit Log ไม่สำเร็จ (${cause.code})` : "โหลด Audit Log ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [search, action, actor, from, to, offset]);

  useEffect(() => { void load(); }, [load]);

  function exportCsv() {
    const rows = [["เวลา", "แอดมิน", "การกระทำ", "ร้าน/เป้าหมาย", "เหตุผล", "รายละเอียด", "IP"], ...logs.map((row) => [row.created_at, row.admin_email || "system", row.action, row.restaurant_name || `${row.target_type || ""} ${row.target_id || ""}`, row.reason || "", JSON.stringify(row.details || {}), row.ip_address || ""])];
    const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `platform-audit-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="mx-auto max-w-7xl space-y-5"><header><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">PLATFORM AUDIT</p><h1 className="mt-1 text-2xl font-semibold">Audit Log</h1><p className="mt-1 text-sm text-slate-500">ตรวจสอบการดำเนินการของผู้ดูแลแพลตฟอร์ม</p></header>
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5"><label className="grid gap-1 text-xs text-slate-500 xl:col-span-2">ค้นหา<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={search} onChange={(event) => { setOffset(0); setSearch(event.target.value); }} placeholder="การกระทำ ร้าน เป้าหมาย เหตุผล" /></label><label className="grid gap-1 text-xs text-slate-500">Action<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={action} onChange={(event) => { setOffset(0); setAction(event.target.value); }} /></label><label className="grid gap-1 text-xs text-slate-500">อีเมลแอดมิน<input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={actor} onChange={(event) => { setOffset(0); setActor(event.target.value); }} /></label><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-slate-500">ตั้งแต่<input className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm" type="date" value={from} onChange={(event) => { setOffset(0); setFrom(event.target.value); }} /></label><label className="grid gap-1 text-xs text-slate-500">ถึง<input className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm" type="date" value={to} onChange={(event) => { setOffset(0); setTo(event.target.value); }} /></label></div></section>
    <div className="flex items-center justify-between gap-3"><p className="m-0 text-sm text-slate-500">{total.toLocaleString("th-TH")} รายการ</p><button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs disabled:opacity-40" type="button" disabled={!logs.length} onClick={exportCsv}>ส่งออก CSV หน้านี้</button></div>
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    {loading ? <PageState /> : logs.length === 0 ? <PageState error="ไม่พบรายการ Audit Log" /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["เวลา", "แอดมิน", "การกระทำ", "ร้าน / เป้าหมาย", "เหตุผล", "รายละเอียด"].map((heading) => <th className="px-3 py-3 font-medium" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{logs.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{dateTime(log.created_at)}</td><td className="px-3 py-3">{log.admin_email || "system"}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{log.action}</span></td><td className="px-3 py-3">{log.restaurant_name || `${log.target_type || ""} ${log.target_id || ""}`}</td><td className="max-w-56 px-3 py-3 text-slate-600">{log.reason || "—"}</td><td className="max-w-72 break-all px-3 py-3 text-xs text-slate-500">{log.details ? JSON.stringify(log.details) : "—"}{log.ip_address ? <span className="block mt-1">IP: {log.ip_address}</span> : null}</td></tr>)}</tbody></table></div><div className="flex justify-end gap-2 border-t border-slate-100 p-3"><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 100))}>ก่อนหน้า</button><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40" type="button" disabled={offset + logs.length >= total} onClick={() => setOffset((value) => value + 100)}>ถัดไป</button></div></section>}
  </div>;
}

function dateTime(value: string) { return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function csvCell(value: unknown) { let text = String(value ?? ""); if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }
