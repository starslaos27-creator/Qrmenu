import { useEffect, useMemo, useState } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";

interface AuditLog {
  id: string;
  action: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_user_id: string | null;
}

interface Member {
  user_id: string;
  email: string;
}

interface AuditPageProps {
  onLogin: () => void;
}

const actionTone: Record<string, string> = {
  "order.cancel": "bg-red-50 text-red-700",
  "order.served": "bg-emerald-50 text-emerald-800",
  "bill.settle": "bg-emerald-50 text-emerald-800",
  "call.ready": "bg-slate-100 text-slate-700",
};

export default function AuditPage({ onLogin }: AuditPageProps) {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [actorEmails, setActorEmails] = useState<Record<string, string>>({});
  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await loadRestaurantSession();
        const restaurantId = session.membership?.restaurant_id;
        if (!restaurantId) {
          if (!cancelled) setError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร");
          return;
        }

        const [audit, team] = await Promise.all([
          apiRequest<{ logs: AuditLog[] }>(`/api/restaurants/${restaurantId}/audit-logs?limit=300`),
          apiRequest<{ members: Member[] }>(`/api/restaurants/${restaurantId}/members`),
        ]);
        if (cancelled) return;

        setRows(audit.logs);
        setActorEmails(Object.fromEntries(team.members.map((member) => [member.user_id, member.email])));
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError && cause.status === 401
            ? "กรุณาเข้าสู่ระบบเพื่อดูประวัติการใช้งาน"
            : "โหลดประวัติการใช้งานไม่สำเร็จ กรุณาลองใหม่");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const actions = useMemo(() => [...new Set(rows.map((row) => row.action))].sort(), [rows]);
  const actors = useMemo(() => [...new Set(rows.flatMap((row) => row.actor_user_id ? [row.actor_user_id] : []))], [rows]);
  const filteredRows = useMemo(() => rows.filter((row) =>
    (actionFilter === "all" || row.action === actionFilter)
    && (actorFilter === "all" || row.actor_user_id === actorFilter)), [rows, actionFilter, actorFilter]);

  if (loading) return <main className="grid min-h-full place-items-center p-6 text-sm text-slate-500">กำลังโหลดประวัติการใช้งาน…</main>;

  if (error && rows.length === 0) {
    return (
      <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
        <section className="mx-auto mt-16 grid max-w-lg justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">ประวัติการใช้งาน</h1>
          <p className="text-sm text-slate-600">{error}</p>
          {error.includes("เข้าสู่ระบบ") && <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white" type="button" onClick={onLogin}>ไปหน้าเข้าสู่ระบบ</button>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
      <header className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">ประวัติการใช้งาน</h1>
          <p className="mt-1 text-sm text-slate-500">แสดงรายการล่าสุดไม่เกิน 300 รายการ</p>
        </div>
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100" type="button" onClick={() => window.history.back()}>กลับ</button>
      </header>

      <section className="mx-auto mb-4 flex max-w-6xl flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="ตัวกรองประวัติการใช้งาน">
        <label className="grid gap-1 text-xs text-slate-500">
          <span>การกระทำ</span>
          <select className="min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="all">ทุกประเภท</option>
            {actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-500">
          <span>ผู้ใช้งาน</span>
          <select className="min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800" value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}>
            <option value="all">ทุกคน</option>
            {actors.map((actor) => <option key={actor} value={actor}>{actorEmails[actor] ?? actor.slice(0, 8)}</option>)}
          </select>
        </label>
        <span className="mr-auto text-sm text-slate-500">{filteredRows.length} รายการ</span>
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={filteredRows.length === 0} onClick={() => exportCsv(filteredRows, actorEmails)}>
          ดาวน์โหลด CSV
        </button>
      </section>

      {error && <p className="mx-auto mb-3 max-w-6xl text-sm text-red-700" role="alert">{error}</p>}
      {filteredRows.length === 0 ? (
        <p className="mx-auto max-w-6xl rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">ไม่พบประวัติการใช้งาน</p>
      ) : (
        <ol className="mx-auto max-w-6xl divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
          {filteredRows.map((row) => (
            <li className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start" key={row.id}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${actionTone[row.action] ?? "bg-slate-100 text-slate-700"}`}>{row.action}</span>
                  <span className="text-xs text-slate-500">
                    {row.actor_user_id ? actorEmails[row.actor_user_id] ?? row.actor_user_id.slice(0, 8) : "ระบบ"}
                  </span>
                </div>
                {row.details && <AuditDetails details={row.details} />}
              </div>
              <time className="shrink-0 text-xs text-slate-500" dateTime={row.created_at}>{formatDate(row.created_at)}</time>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function AuditDetails({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details).filter(([, value]) => value != null && value !== "");
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 break-all text-xs text-slate-600">
      {entries.map(([key, value]) => (
        <span key={key}><strong className="font-medium text-slate-500">{key}:</strong> {displayValue(value)}</span>
      ))}
    </div>
  );
}

function displayValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : JSON.stringify(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function exportCsv(rows: AuditLog[], actorEmails: Record<string, string>) {
  const headers = ["timestamp", "actor", "action", "target_id", "details"];
  const lines = rows.map((row) => [
    row.created_at,
    row.actor_user_id ? actorEmails[row.actor_user_id] ?? row.actor_user_id : "system",
    row.action,
    row.target_id ?? "",
    JSON.stringify(row.details ?? {}),
  ]);
  const content = "\uFEFF" + [headers, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
