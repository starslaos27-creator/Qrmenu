import type { KitchenMenu, KitchenOrder, KitchenTable, KitchenZone } from "./types";

export type KitchenStage = "all" | "new" | "cooking" | "ready" | "history";

export function kitchenOrderStage(order: KitchenOrder): KitchenStage {
  if (order.status === "served" || order.status === "cancelled") return "history";
  if (order.status === "ready") return "ready";
  return order.accepted_at ? "cooking" : "new";
}

export function downloadKitchenCsv({ orders, history, stage, tables, zones, menus }: {
  orders: KitchenOrder[];
  history: KitchenOrder[];
  stage: KitchenStage;
  tables: KitchenTable[];
  zones: KitchenZone[];
  menus: KitchenMenu[];
}, range: { from: string; to: string } | null) {
  const tableMap = new Map(tables.map((table) => [table.id, table]));
  const zoneMap = new Map(zones.map((zone) => [zone.id, zone]));
  const menuMap = new Map(menus.map((menu) => [menu.id, menu]));
  const labels: Record<string, string> = { new: "รอรับออเดอร์", cooking: "กำลังทำ", ready: "พร้อมเสิร์ฟ", served: "เสิร์ฟแล้ว", cancelled: "ยกเลิกแล้ว" };
  const rows: unknown[][] = [["เลขที่ออเดอร์", "วันที่สั่ง", "โต๊ะ", "โซน", "สถานะ", "รายการอาหาร", "จำนวน", "หมายเหตุ"]];
  for (const order of [...orders, ...history].filter((item) => stage === "all" || kitchenOrderStage(item) === stage)) {
    const table = tableMap.get(order.table_id);
    const zone = zoneMap.get(table?.zone_id ?? "");
    for (const item of order.items) {
      const menu = menuMap.get(item.menu_id);
      rows.push([
        order.receipt_number || order.id,
        new Date(order.created_at).toLocaleString("th-TH", { timeZone: "Asia/Vientiane" }),
        table?.table_number ?? "",
        zone?.name ?? "",
        labels[order.status === "served" || order.status === "cancelled" ? order.status : kitchenOrderStage(order)] ?? order.status,
        menu?.name_lo || menu?.name || item.menu_id,
        item.qty,
        item.note ?? "",
      ]);
    }
  }
  const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `kitchen-${range ? `${range.from}_${range.to}` : "live"}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
