import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import type { InventoryItem, StockLocation } from "./types";
import { inputClass, primaryButton, secondaryButton } from "./styles";

const movementTypes = [
  { value: "purchase", label: "รับซื้อ / รับเข้า", sign: 1 },
  { value: "waste", label: "ของเสีย / หมดอายุ", sign: -1 },
  { value: "adjustment", label: "ปรับยอดนับจริง", sign: 0 },
  { value: "return_in", label: "รับคืนเข้าสต็อก", sign: 1 },
  { value: "return_out", label: "ส่งคืนผู้จัดส่ง", sign: -1 },
];

export default function StockMovementForm({ item, restaurantId, locations, onClose, onSaved, onError }: {
  item: InventoryItem;
  restaurantId: string | null;
  locations: StockLocation[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [type, setType] = useState("purchase");
  const [busy, setBusy] = useState(false);
  const defaultLocation = locations.find((location) => location.is_default) ?? locations[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restaurantId || busy || !defaultLocation) return;
    const form = new FormData(event.currentTarget);
    const magnitude = Math.abs(Number(form.get("quantity")));
    const selectedType = movementTypes.find((option) => option.value === type)!;
    const quantity = selectedType.sign === 0 ? Number(form.get("quantity")) : magnitude * selectedType.sign;
    if (!Number.isFinite(quantity) || quantity === 0) { onError("กรุณาระบุจำนวนที่ไม่เป็นศูนย์"); return; }
    setBusy(true); onError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/stock/movements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_item_id: item.id, location_id: String(form.get("location_id") || defaultLocation.id), movement_type: type, quantity, note: String(form.get("note") ?? "").trim() || null }),
      });
      await onSaved();
    } catch (cause) {
      onError(cause instanceof ApiError && cause.code === "INSUFFICIENT_STOCK" ? "จำนวนคงเหลือไม่พอสำหรับการเบิกออก" : "บันทึกการเคลื่อนไหวไม่สำเร็จ กรุณาลองใหม่");
    } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}>
    <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
      <div><h2 className="text-lg font-bold">ปรับสต็อก: {item.name}</h2><p className="text-sm text-slate-500">คงเหลือ {Number(item.quantity).toLocaleString()} {item.unit}</p></div>
      <label className="block space-y-1.5 text-sm font-semibold">ประเภท<select value={type} onChange={(event) => setType(event.target.value)} className={inputClass + " w-full"}>{movementTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="block space-y-1.5 text-sm font-semibold">คลัง<select name="location_id" defaultValue={defaultLocation?.id} required className={inputClass + " w-full"}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.is_default ? " (หลัก)" : ""}</option>)}</select></label>
      <label className="block space-y-1.5 text-sm font-semibold">จำนวน ({item.unit}) *<input required autoFocus type="number" step="any" name="quantity" placeholder="0" className={inputClass + " w-full"} /></label>
      {type === "adjustment" && <p className="text-xs text-slate-500">ใส่จำนวนบวกเพื่อเพิ่ม หรือจำนวนลบเพื่อลดยอด</p>}
      <label className="block space-y-1.5 text-sm font-semibold">หมายเหตุ<input maxLength={500} name="note" placeholder="เหตุผลหรือรายละเอียด" className={inputClass + " w-full"} /></label>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className={secondaryButton}>ยกเลิก</button><button disabled={busy || !defaultLocation} className={primaryButton}>{busy ? "กำลังบันทึก…" : "บันทึกรายการ"}</button></div>
    </form>
  </div>;
}
