import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import KitchenOrderCard, { KitchenHistoryCard } from "./KitchenOrderCard";
import KitchenPaperSettings from "./KitchenPaperSettings";
import { downloadKitchenCsv, kitchenOrderStage, type KitchenStage } from "./exportKitchenCsv";
import { useKitchenData } from "./useKitchenData";
import type { KitchenOrder, OrderItem } from "./types";

type View = "active" | "history";
type StatusFilter = "all" | "new" | "cooking" | "ready";

export default function KitchenPage({ onLogin }: { onLogin: () => void }) {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [from, setFrom] = useState(todayDate());
  const [to, setTo] = useState(todayDate());
  const [filterError, setFilterError] = useState("");
  const { data, setData, loading, error, setError, updatedAt, refresh } = useKitchenData(onLogin, range);
  const [view, setView] = useState<View>(() => new URLSearchParams(window.location.search).get("view") === "served" ? "history" : "active");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [busyOrderId, setBusyOrderId] = useState("");
  const [cancelOrder, setCancelOrder] = useState<KitchenOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);

  const tableMap = useMemo(() => new Map((data?.tables ?? []).map((table) => [table.id, table])), [data?.tables]);
  const zoneMap = useMemo(() => new Map((data?.zones ?? []).map((zone) => [zone.id, zone])), [data?.zones]);
  const menuMap = useMemo(() => new Map((data?.menus ?? []).map((menu) => [menu.id, menu])), [data?.menus]);
  const activeOrders = useMemo(() => {
    if (!data) return [];
    const earliestByTable = new Map<string, string>();
    for (const order of data.orders) {
      const previous = earliestByTable.get(order.table_id);
      if (!previous || order.created_at < previous) earliestByTable.set(order.table_id, order.created_at);
    }
    return data.orders.filter((order) => statusFilter === "all" || kitchenOrderStage(order) === statusFilter)
      .filter((order) => zoneFilter === "all" || tableMap.get(order.table_id)?.zone_id === zoneFilter)
      .sort((a, b) => (earliestByTable.get(a.table_id) ?? a.created_at).localeCompare(earliestByTable.get(b.table_id) ?? b.created_at) || a.created_at.localeCompare(b.created_at));
  }, [data?.orders, statusFilter, zoneFilter, tableMap]);
  const history = useMemo(() => (data?.history ?? []).filter((order) => zoneFilter === "all" || tableMap.get(order.table_id)?.zone_id === zoneFilter), [data?.history, zoneFilter, tableMap]);

  async function changeStatus(order: KitchenOrder, status: "accepted" | "ready" | "served") {
    if (!data || busyOrderId) return;
    setBusyOrderId(order.id);
    setError("");
    const previousOrders = data.orders;
    const previousHistory = data.history;
    if (status === "served") {
      const optimistic = { ...order, status, completed_at: new Date().toISOString(), completed_by: null } satisfies KitchenOrder;
      setData((current) => current ? { ...current, orders: current.orders.filter((item) => item.id !== order.id), history: [optimistic, ...current.history.filter((item) => item.id !== order.id)] } : current);
    }
    try {
      const endpoint = status === "accepted" ? "accept" : "status";
      const result = await apiRequest<{ order: KitchenOrder }>(`/api/restaurants/${data.restaurantId}/orders/${order.id}/${endpoint}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "accepted" ? {} : { status }),
      });
      const updated = result.order;
      setData((current) => current ? updated.status === "served" || updated.status === "cancelled"
        ? { ...current, orders: current.orders.filter((item) => item.id !== updated.id), history: [updated, ...current.history.filter((item) => item.id !== updated.id)] }
        : { ...current, orders: current.orders.map((item) => item.id === updated.id ? updated : item) } : current);
    } catch (cause) {
      if (status === "served") setData((current) => current ? { ...current, orders: previousOrders, history: previousHistory } : current);
      setError(cause instanceof ApiError ? `เปลี่ยนสถานะไม่สำเร็จ (${cause.code})` : "เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusyOrderId("");
    }
  }

  async function cancelCurrentOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !cancelOrder || !cancelReason.trim()) return;
    setDialogBusy(true);
    setError("");
    const order = cancelOrder;
    const reason = cancelReason.trim();
    try {
      const result = await apiRequest<{ order: KitchenOrder }>(`/api/restaurants/${data.restaurantId}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", cancel_reason: reason }),
      });
      setData((current) => current ? { ...current, orders: current.orders.filter((item) => item.id !== order.id), history: [result.order, ...current.history.filter((item) => item.id !== order.id)] } : current);
      setCancelOrder(null);
      setCancelReason("");
    } catch (cause) {
      setError(cause instanceof ApiError ? `ยกเลิกออเดอร์ไม่สำเร็จ (${cause.code})` : "ยกเลิกออเดอร์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDialogBusy(false);
    }
  }

  async function saveItems(order: KitchenOrder, items: OrderItem[]) {
    if (!data) return false;
    setError("");
    try {
      const result = await apiRequest<{ order: KitchenOrder }>(`/api/restaurants/${data.restaurantId}/orders/${order.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((item) => ({ menu_id: item.menu_id, qty: item.qty, note: item.note?.trim() || null })) }),
      });
      setData((current) => current ? { ...current, orders: current.orders.map((item) => item.id === order.id ? result.order : item) } : current);
      return true;
    } catch (cause) {
      const message = cause instanceof ApiError ? `บันทึกรายการไม่สำเร็จ (${cause.code})` : "บันทึกรายการไม่สำเร็จ";
      setError(message);
      return false;
    }
  }

  async function resolveItem(order: KitchenOrder, index: number, action: "remove", expectedItems: OrderItem[]) {
    if (!data) throw new Error("ไม่พบข้อมูลร้าน");
    try {
      const result = await apiRequest<{ order: KitchenOrder }>(`/api/restaurants/${data.restaurantId}/orders/${order.id}/items/${index}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expected_items: expectedItems }),
      });
      const updated = result.order;
      setData((current) => current ? updated.status === "cancelled"
        ? { ...current, orders: current.orders.filter((item) => item.id !== order.id), history: [updated, ...current.history.filter((item) => item.id !== order.id)] }
        : { ...current, orders: current.orders.map((item) => item.id === order.id ? updated : item) } : current);
      window.dispatchEvent(new CustomEvent("shopqr:order-confirmed", { detail: updated }));
    } catch (cause) {
      throw new Error(cause instanceof ApiError ? `ลบรายการไม่สำเร็จ (${cause.code})` : "ลบรายการไม่สำเร็จ");
    }
  }

  async function confirmItem(order: KitchenOrder, index: number) {
    if (!data || busyOrderId) return;
    setBusyOrderId(order.id);
    setError("");
    try {
      const result = await apiRequest<{ order: KitchenOrder }>(`/api/restaurants/${data.restaurantId}/orders/${order.id}/items/${index}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_items: order.items }),
      });
      const updated = result.order;
      setData((current) => current ? updated.status === "served"
        ? { ...current, orders: current.orders.filter((item) => item.id !== order.id), history: [updated, ...current.history.filter((item) => item.id !== order.id)] }
        : { ...current, orders: current.orders.map((item) => item.id === order.id ? updated : item) } : current);
      window.dispatchEvent(new CustomEvent("shopqr:order-confirmed", { detail: updated }));
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : "REQUEST_FAILED";
      const message = code === "INSUFFICIENT_STOCK" ? "สต็อกไม่พอ กรุณาตรวจสอบคลังสินค้า" : code === "ORDER_ITEMS_CHANGED" ? "รายการออเดอร์เปลี่ยนแล้ว กำลังโหลดข้อมูลใหม่" : `ยืนยันรายการไม่สำเร็จ (${code})`;
      setError(message);
      if (code === "ORDER_ITEMS_CHANGED") void refresh();
    } finally {
      setBusyOrderId("");
    }
  }

  if (loading) return <main className="grid min-h-64 place-items-center p-6 text-sm text-slate-500">กำลังโหลดรายการครัว…</main>;
  if (!data) return <main className="p-6"><div className="mx-auto mt-12 max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-red-800" role="alert">{error || "ไม่สามารถโหลดข้อมูลร้าน"}</div></main>;

  const canManage = data.role === "owner" || data.role === "cook";
  return <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">KITCHEN</p><h1 className="mt-1 text-2xl font-semibold">รายการครัว</h1><p className="mt-1 text-sm text-slate-500">{data.restaurantName} · อัปเดตอัตโนมัติทุก 5 วินาที</p></div><p className="m-0 text-xs text-slate-400">{updatedAt ? `อัปเดตล่าสุด ${new Intl.DateTimeFormat("th-TH-u-ca-gregory", { timeStyle: "short" }).format(new Date(updatedAt))}` : ""}</p></header>
      {error && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium">โหลดใหม่</button></div>}
      <KitchenPaperSettings restaurantId={data.restaurantId} width={data.kitchenPrintWidth} canManage={data.role === "owner"} onSaved={(width) => setData((current) => current ? { ...current, kitchenPrintWidth: width } : current)} />
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 rounded-xl bg-slate-100 p-1"><ViewButton active={view === "active"} onClick={() => setView("active")}>ออเดอร์ปัจจุบัน <Count>{data.orders.length}</Count></ViewButton><ViewButton active={view === "history"} onClick={() => setView("history")}>ประวัติ</ViewButton></div>
          {view === "active" && <div className="flex flex-wrap gap-1">{(["all", "new", "cooking", "ready"] as const).map((filter) => <button key={filter} type="button" onClick={() => setStatusFilter(filter)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${statusFilter === filter ? "bg-emerald-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{filter === "all" ? "ทั้งหมด" : filter === "new" ? "รอรับออเดอร์" : filter === "cooking" ? "กำลังทำ" : "พร้อมเสิร์ฟ"}</button>)}</div>}
        </div>
        <form className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3" onSubmit={(event) => { event.preventDefault(); if (!from || !to || from > to) { setFilterError("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด"); return; } setFilterError(""); setRange({ from, to }); }}>
          <label className="grid gap-1 text-xs text-slate-500">จากวันที่<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800" /></label>
          <label className="grid gap-1 text-xs text-slate-500">ถึงวันที่<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800" /></label>
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">ค้นหาช่วงวันที่</button>
          <button type="button" onClick={() => { const day = todayDate(); setFrom(day); setTo(day); setRange({ from: day, to: day }); setFilterError(""); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">วันนี้</button>
          <button type="button" onClick={() => { setRange(null); setFilterError(""); setZoneFilter("all"); setStatusFilter("all"); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">กลับไปดูสด</button>
          <button type="button" onClick={() => data && downloadKitchenCsv({ orders: data.orders, history: data.history, stage: (view === "history" ? "history" : statusFilter) as KitchenStage, tables: data.tables, zones: data.zones, menus: data.menus }, range)} disabled={!!filterError} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50">Export CSV</button>
          <span className="text-xs text-slate-500" role="status">{filterError || (range ? `แสดง ${range.from} ถึง ${range.to}` : "ดูรายการสดและประวัติ 7 วัน")}</span>
        </form>
      </section>
      {data.zones.length > 0 && <div className="flex flex-wrap gap-1.5"><ZoneButton active={zoneFilter === "all"} onClick={() => setZoneFilter("all")}>ทุกโซน</ZoneButton>{data.zones.map((zone) => <ZoneButton key={zone.id} active={zoneFilter === zone.id} onClick={() => setZoneFilter(zone.id)}>{zone.name}</ZoneButton>)}</div>}
      {view === "active" ? activeOrders.length === 0 ? <EmptyState title="ไม่มีออเดอร์ในสถานะนี้" detail="ออเดอร์ใหม่จะแสดงที่นี่โดยอัตโนมัติ" /> : <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="ออเดอร์ปัจจุบัน">{activeOrders.map((order) => <KitchenOrderCard key={order.id} order={order} tableNumber={tableMap.get(order.table_id)?.table_number ?? "?"} zoneName={zoneMap.get(tableMap.get(order.table_id)?.zone_id ?? "")?.name ?? ""} menuMap={menuMap} memberEmails={data.memberEmails} role={data.role} currencyCode={data.currencyCode} busy={busyOrderId === order.id} canConfirmItems={["owner", "cook", "waiter", "staff"].includes(data.role)} onAccept={(item) => void changeStatus(item, "accepted")} onReady={(item) => void changeStatus(item, "ready")} onServe={(item) => void changeStatus(item, "served")} onCancel={(item) => { setCancelOrder(item); setCancelReason(""); }} onPrint={(item) => printOrder(item, tableMap.get(item.table_id)?.table_number ?? "?", zoneMap.get(tableMap.get(item.table_id)?.zone_id ?? "")?.name ?? "", menuMap, data.kitchenPrintWidth)} onSaveItems={saveItems} onResolveItem={resolveItem} onConfirmItem={confirmItem} />)}</section>
        : history.length === 0 ? <EmptyState title="ยังไม่มีประวัติออเดอร์" detail="รายการที่เสร็จหรือยกเลิกใน 7 วันที่ผ่านมาจะแสดงที่นี่" /> : <section className="space-y-2" aria-label="ประวัติออเดอร์">{history.map((order) => <KitchenHistoryCard key={order.id} order={order} tableNumber={tableMap.get(order.table_id)?.table_number ?? "?"} zoneName={zoneMap.get(tableMap.get(order.table_id)?.zone_id ?? "")?.name ?? ""} menuMap={menuMap} memberEmails={data.memberEmails} currencyCode={data.currencyCode} />)}</section>}
    </div>
    {cancelOrder && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" onClick={() => !dialogBusy && setCancelOrder(null)}><form onSubmit={(event) => void cancelCurrentOrder(event)} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"><header><h2 className="m-0 text-lg font-semibold">ยกเลิกออเดอร์ · โต๊ะ {tableMap.get(cancelOrder.table_id)?.table_number ?? "?"}</h2><p className="mt-1 text-sm text-slate-500">ระบุเหตุผลเพื่อบันทึกไว้ในประวัติ</p></header><div className="grid grid-cols-2 gap-2">{["ลูกค้าเปลี่ยนใจ", "สั่งซ้ำ", "วัตถุดิบหมด", "ปัญหาอุปกรณ์"].map((reason) => <button key={reason} type="button" disabled={dialogBusy} onClick={() => setCancelReason(reason)} className={`rounded-xl border px-3 py-2 text-sm ${cancelReason === reason ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 hover:bg-slate-50"}`}>{reason}</button>)}</div><textarea autoFocus required maxLength={200} rows={2} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="หรือพิมพ์เหตุผล" disabled={dialogBusy} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-red-500" /><footer className="flex gap-2"><button type="button" onClick={() => setCancelOrder(null)} disabled={dialogBusy} className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm">เก็บออเดอร์ไว้</button><button disabled={dialogBusy || !cancelReason.trim()} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{dialogBusy ? "กำลังบันทึก…" : "ยกเลิกออเดอร์"}</button></footer></form></div>}
  </main>;
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{children}</button>;
}
function Count({ children }: { children: ReactNode }) { return <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-emerald-900 px-1.5 text-[10px] font-semibold tabular-nums text-white">{children}</span>; }
function ZoneButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-medium ${active ? "bg-slate-800 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{children}</button>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="m-0 text-base font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{detail}</p></div>; }

function todayDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

function printOrder(order: KitchenOrder, tableNumber: string | number, zoneName: string, menuMap: Map<string, { name: string; name_lo: string | null }>, width: 58 | 76 | 80) {
  const printWindow = window.open("", "shopqr-kitchen-ticket", "width=420,height=640");
  if (!printWindow) return;
  const document = printWindow.document;
  document.title = "ใบงานครัว";
  const style = document.createElement("style");
  style.textContent = `@page{size:${width}mm auto;margin:4mm}body{font:14px/1.4 sans-serif;color:#111;max-width:${width - 8}mm}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0}ul{padding:0;list-style:none}li{border-bottom:1px dashed #aaa;padding:7px 0}.qty{float:right;font-weight:bold}.note{font-size:12px;color:#555}.meta{font-size:12px;color:#555}.rule{border-top:1px dashed #222;margin:10px 0}`;
  document.head.append(style);
  const heading = document.createElement("h1"); heading.textContent = `ออเดอร์โต๊ะ ${tableNumber}`; document.body.append(heading);
  const meta = document.createElement("p"); meta.className = "meta"; meta.textContent = `${zoneName} · ${new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))} · ${order.receipt_number || order.id.slice(0, 8)}`; document.body.append(meta);
  document.body.append(Object.assign(document.createElement("div"), { className: "rule" }));
  const list = document.createElement("ul");
  for (const item of order.items) { const row = document.createElement("li"); const name = document.createElement("span"); const menu = menuMap.get(item.menu_id); name.textContent = menu?.name_lo || menu?.name || "ไม่พบเมนู"; const quantity = document.createElement("span"); quantity.className = "qty"; quantity.textContent = `× ${item.qty}`; row.append(name, quantity); if (item.note) { const note = document.createElement("p"); note.className = "note"; note.textContent = item.note; row.append(note); } list.append(row); }
  document.body.append(list);
  document.close();
  printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
  window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 250);
}
