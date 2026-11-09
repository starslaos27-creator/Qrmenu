import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import { useTablesData } from "./useTablesData";
import type { DiningTable, DiningZone } from "./types";

export default function TablesPage({ onLogin }: { onLogin: () => void }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeZone, setActiveZone] = useState("all");
  const [modal, setModal] = useState<"table" | "zone" | "bulk" | null>(null);
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useTablesData(restaurantId);
  const owner = role === "owner";
  const canToggle = owner || role === "waiter" || role === "staff";

  useEffect(() => {
    let cancelled = false;
    loadRestaurantSession().then((session) => {
      if (cancelled) return;
      if (!session.membership) { setError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร"); return; }
      setRestaurantId(session.membership.restaurant_id); setRole(session.membership.role);
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ApiError && cause.status === 401) onLogin();
      else setError("โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
    });
    return () => { cancelled = true; };
  }, [onLogin]);

  const shownTables = useMemo(() => data.tables.filter((table) => activeZone === "all" || table.zone_id === activeZone), [data.tables, activeZone]);

  async function saveTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!restaurantId || busy) return;
    const form = new FormData(event.currentTarget);
    const body = { table_number: String(form.get("table_number") ?? "").trim(), zone_id: String(form.get("zone_id") ?? ""), qr_url: String(form.get("qr_url") ?? "").trim() || null };
    setBusy(true); setError(""); setNotice("");
    try {
      if (editing) await apiRequest(`/api/restaurants/${restaurantId}/tables/${editing.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(body) });
      else await apiRequest(`/api/restaurants/${restaurantId}/tables`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
      setModal(null); setEditing(null); setNotice(editing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มโต๊ะแล้ว"); await data.refresh();
    } catch (cause) { setError(cause instanceof ApiError && cause.code === "TABLE_ALREADY_EXISTS" ? "มีหมายเลขโต๊ะนี้ในโซนแล้ว" : "บันทึกโต๊ะไม่สำเร็จ ตรวจสอบหมายเลขและโซน"); }
    finally { setBusy(false); }
  }

  async function addZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!restaurantId || busy) return;
    const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/zones`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: String(form.get("name") ?? "").trim(), sort_order: Number(form.get("sort_order") ?? 0) }) });
      setModal(null); setNotice("เพิ่มโซนแล้ว"); await data.refresh();
    } catch { setError("เพิ่มโซนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function createBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!restaurantId || busy) return;
    const form = new FormData(event.currentTarget); const zoneId = String(form.get("zone_id") ?? "");
    const from = Number(form.get("from")); const to = Number(form.get("to")); const prefix = String(form.get("prefix") ?? "").trim();
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from || to - from > 499) { setError("ช่วงหมายเลขไม่ถูกต้อง (สร้างได้ไม่เกิน 500 โต๊ะต่อครั้ง)"); return; }
    const rows = Array.from({ length: to - from + 1 }, (_, index) => ({ zone_id: zoneId, table_number: `${prefix}${from + index}` }));
    setBusy(true); setError("");
    try {
      const result = await apiRequest<{ tables: DiningTable[] }>(`/api/restaurants/${restaurantId}/tables/bulk`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ tables: rows }) });
      setModal(null); setNotice(`สร้างโต๊ะสำเร็จ ${result.tables.length} โต๊ะ`); await data.refresh();
    } catch { setError("สร้างโต๊ะไม่สำเร็จ ตรวจสอบโซนและหมายเลข"); }
    finally { setBusy(false); }
  }

  async function toggleOpen(table: DiningTable) {
    if (!restaurantId || busy || !canToggle) return;
    setBusy(true); setError("");
    try { await apiRequest(`/api/restaurants/${restaurantId}/tables/${table.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ is_open: !table.is_open }) }); await data.refresh(); }
    catch { setError("เปลี่ยนสถานะโต๊ะไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function removeTable(table: DiningTable) {
    if (!restaurantId || busy || !window.confirm(`ลบโต๊ะ ${table.table_number} ใช่ไหม?`)) return;
    setBusy(true); setError("");
    try { await apiRequest(`/api/restaurants/${restaurantId}/tables/${table.id}`, { method: "DELETE" }); setNotice("ลบโต๊ะแล้ว"); await data.refresh(); }
    catch { setError("ลบโต๊ะไม่สำเร็จ อาจมีประวัติออเดอร์ผูกอยู่"); }
    finally { setBusy(false); }
  }

  async function removeZone(zone: DiningZone) {
    if (!restaurantId || busy || !window.confirm(`ลบโซน ${zone.name} ใช่ไหม?`)) return;
    setBusy(true); setError("");
    try { await apiRequest(`/api/restaurants/${restaurantId}/zones/${zone.id}`, { method: "DELETE" }); setNotice("ลบโซนแล้ว"); await data.refresh(); }
    catch (cause) { setError(cause instanceof ApiError && cause.code === "ZONE_HAS_TABLES" ? "ย้ายหรือลบโต๊ะทั้งหมดในโซนนี้ก่อน" : "ลบโซนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  if (error && !restaurantId) return <main className="mx-auto max-w-4xl p-6"><Alert>{error}</Alert></main>;
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">จัดการร้านอาหาร</p><h1 className="mt-1 text-2xl font-bold">โต๊ะและโซน</h1><p className="mt-1 text-sm text-slate-500">จัดกลุ่มโต๊ะ ติดตามสถานะ และเปิดลิงก์ QR ของแต่ละโต๊ะ</p></div>{owner && <div className="flex flex-wrap gap-2"><button onClick={() => setModal("zone")} className={secondary}>+ เพิ่มโซน</button><button onClick={() => setModal("bulk")} className={secondary}>สร้างหลายโต๊ะ</button><button onClick={() => { setEditing(null); setModal("table"); }} className={primary}>+ เพิ่มโต๊ะ</button></div>}</header>
    {error && <Alert>{error}</Alert>}{data.error && <Alert>{data.error} <button className="underline" onClick={() => void data.refresh()}>ลองอีกครั้ง</button></Alert>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setActiveZone("all")} className={zoneClass(activeZone === "all")}>ทั้งหมด ({data.tables.length})</button>{data.zones.map((zone) => <div key={zone.id} className="flex shrink-0 items-center rounded-full border border-slate-200 bg-white"><button onClick={() => setActiveZone(zone.id)} className={zoneClass(activeZone === zone.id)}>{zone.name} ({data.tables.filter((table) => table.zone_id === zone.id).length})</button>{owner && <button title={`ลบโซน ${zone.name}`} onClick={() => void removeZone(zone)} className="mr-2 text-xs text-rose-600">×</button>}</div>)}</section>
    {data.loading ? <div className="rounded-xl bg-white p-10 text-center text-slate-500">กำลังโหลดโต๊ะ…</div> : shownTables.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-semibold">{data.zones.length ? "ยังไม่มีโต๊ะในโซนนี้" : "เริ่มต้นด้วยการสร้างโซน"}</p><p className="mt-1 text-sm text-slate-500">{owner ? "เพิ่มโซนและโต๊ะเพื่อออก QR สำหรับลูกค้า" : "ให้เจ้าของร้านตั้งค่าโซนและโต๊ะ"}</p></div> : <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{shownTables.map((table) => <TableCard key={table.id} table={table} zone={data.zones.find((item) => item.id === table.zone_id)?.name ?? "ไม่ระบุโซน"} owner={owner} canToggle={canToggle} busy={busy} onEdit={() => { setEditing(table); setModal("table"); }} onToggle={() => void toggleOpen(table)} onDelete={() => void removeTable(table)} />)}</section>}
    {modal && <Modal title={modal === "zone" ? "เพิ่มโซน" : modal === "bulk" ? "สร้างโต๊ะหลายรายการ" : editing ? "แก้ไขโต๊ะ" : "เพิ่มโต๊ะ"} onClose={() => { setModal(null); setError(""); }}>
      {modal === "zone" && <form onSubmit={addZone} className="space-y-4"><Field label="ชื่อโซน *"><input autoFocus required maxLength={200} name="name" placeholder="เช่น ชั้น 1, ระเบียง" className={input} /></Field><Field label="ลำดับแสดง"><input type="number" name="sort_order" defaultValue={data.zones.length} className={input} /></Field><SubmitRow busy={busy} onCancel={() => setModal(null)} /></form>}
      {modal === "table" && <form onSubmit={saveTable} className="space-y-4"><Field label="หมายเลขโต๊ะ *"><input autoFocus required maxLength={40} name="table_number" defaultValue={editing?.table_number ?? ""} placeholder="เช่น A1" className={input} /></Field><Field label="โซน *"><select required name="zone_id" defaultValue={editing?.zone_id ?? data.zones[0]?.id} className={input}>{data.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></Field><Field label="ลิงก์ QR (ไม่บังคับ)"><input type="url" name="qr_url" defaultValue={editing?.qr_url ?? ""} placeholder="https://..." className={input} /></Field>{error && <Alert>{error}</Alert>}<SubmitRow busy={busy} onCancel={() => setModal(null)} /></form>}
      {modal === "bulk" && <form onSubmit={createBulk} className="space-y-4"><Field label="โซน *"><select required name="zone_id" defaultValue={data.zones[0]?.id} className={input}>{data.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="เริ่มเลข"><input required type="number" min="0" name="from" defaultValue="1" className={input} /></Field><Field label="ถึงเลข"><input required type="number" min="0" name="to" defaultValue="10" className={input} /></Field></div><Field label="คำนำหน้า"><input maxLength={20} name="prefix" placeholder="เช่น A-" className={input} /></Field>{error && <Alert>{error}</Alert>}<SubmitRow busy={busy} onCancel={() => setModal(null)} /></form>}
    </Modal>}
  </main>;
}

function TableCard({ table, zone, owner, canToggle, busy, onEdit, onToggle, onDelete }: { table: DiningTable; zone: string; owner: boolean; canToggle: boolean; busy: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const menuUrl = table.qr_url || `${window.location.origin}/t/${table.short_code}`;
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-slate-500">{zone}</p><h2 className="mt-1 text-xl font-bold text-slate-900">โต๊ะ {table.table_number}</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${table.is_open ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{table.is_open ? "กำลังใช้งาน" : "ว่าง"}</span></div><dl className="mt-4 space-y-2 text-xs text-slate-500"><div className="flex justify-between"><dt>ออเดอร์ล่าสุด</dt><dd>{table.last_order_at ? new Date(table.last_order_at).toLocaleString() : "ยังไม่มี"}</dd></div><div className="flex justify-between"><dt>บิลค้างล่าสุด</dt><dd>{table.last_unpaid_order_at ? new Date(table.last_unpaid_order_at).toLocaleString() : "ไม่มี"}</dd></div></dl><a href={menuUrl} target="_blank" rel="noreferrer" className="mt-4 block truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-emerald-800 hover:bg-emerald-50">เปิดหน้า QR · {table.short_code}</a><div className="mt-3 flex flex-wrap gap-2">{canToggle && <button disabled={busy} onClick={onToggle} className={secondary}>{table.is_open ? "ทำเครื่องหมายว่าว่าง" : "เปิดโต๊ะ"}</button>}{owner && <button onClick={onEdit} className={secondary}>แก้ไข</button>}{owner && <button disabled={busy} onClick={onDelete} className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">ลบ</button>}</div></article>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}><section onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"><header className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="ปิด" className="text-xl text-slate-500">×</button></header>{children}</section></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-semibold text-slate-700">{label}{children}</label>; }
function SubmitRow({ busy, onCancel }: { busy: boolean; onCancel: () => void }) { return <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onCancel} className={secondary}>ยกเลิก</button><button disabled={busy} className={primary}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button></div>; }
function Alert({ children }: { children: ReactNode }) { return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{children}</p>; }
function zoneClass(active: boolean) { return `rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"}`; }
const jsonHeaders = { "Content-Type": "application/json" };
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const primary = "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
