import type { FormEvent, ReactNode } from "react";
import type { InventoryItem } from "./types";
import { inputClass, primaryButton, secondaryButton } from "./styles";

export default function InventoryItemForm({ item, busy, error, onClose, onSubmit }: {
  item: InventoryItem | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}>
    <form onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
      <div><h2 className="text-lg font-bold text-slate-900">{item ? "แก้ไขวัตถุดิบ" : "เพิ่มวัตถุดิบ"}</h2><p className="text-sm text-slate-500">ระบุหน่วยและจุดเตือนเพื่อช่วยติดตามสต็อก</p></div>
      <Field label="ชื่อวัตถุดิบ *"><input autoFocus required maxLength={200} name="name" defaultValue={item?.name ?? ""} className={inputClass + " w-full"} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="SKU"><input maxLength={100} name="sku" defaultValue={item?.sku ?? ""} className={inputClass + " w-full"} /></Field><Field label="บาร์โค้ด"><input maxLength={100} name="barcode" defaultValue={item?.barcode ?? ""} className={inputClass + " w-full"} /></Field></div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="หน่วย *"><input required maxLength={50} name="unit" defaultValue={item?.unit ?? "ชิ้น"} className={inputClass + " w-full"} /></Field><Field label="จุดเตือนสต็อกต่ำ"><input min="0" step="any" type="number" name="minimum_stock" defaultValue={item?.minimum_stock ?? 0} className={inputClass + " w-full"} /></Field></div>
      <Field label="URL รูปภาพ"><input type="url" name="image_url" defaultValue={item?.image_url ?? ""} className={inputClass + " w-full"} /></Field>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className={secondaryButton}>ยกเลิก</button><button disabled={busy} className={primaryButton}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button></div>
    </form>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-semibold text-slate-700"><span>{label}</span>{children}</label>; }
