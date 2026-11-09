import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";

export default function KitchenPaperSettings({ restaurantId, width, canManage, onSaved }: {
  restaurantId: string;
  width: 58 | 76 | 80;
  canManage: boolean;
  onSaved: (width: 58 | 76 | 80) => void;
}) {
  const [selected, setSelected] = useState(String(width));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setSelected(String(width)), [width]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;
    const value = Number(selected);
    if (![58, 76, 80].includes(value)) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchen_print_width: value }),
      });
      onSaved(value as 58 | 76 | 80);
    } catch (cause) {
      setError(cause instanceof ApiError ? `บันทึกไม่สำเร็จ (${cause.code})` : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <summary className="cursor-pointer text-sm font-medium">ตั้งค่ากระดาษเครื่องพิมพ์ครัว</summary>
    <form onSubmit={(event) => void save(event)} className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
      <label className="grid gap-1 text-xs text-slate-500">ความกว้างกระดาษ<select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={!canManage || saving} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:bg-slate-100"><option value="58">58 mm — กระดาษเล็ก</option><option value="76">76 mm — กระดาษกลาง</option><option value="80">80 mm — กระดาษใหญ่</option></select></label>
      {!canManage && <span className="text-xs text-slate-500">แก้ไขได้เฉพาะเจ้าของร้าน</span>}
      {canManage && <button disabled={saving || selected === String(width)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{saving ? "กำลังบันทึก…" : "บันทึก"}</button>}
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </form>
  </details>;
}
