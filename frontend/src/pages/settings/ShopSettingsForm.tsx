import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import WeeklyHoursEditor from "./WeeklyHoursEditor";

export interface ShopSettings {
  id: string;
  name: string;
  accepting_orders: boolean;
  open_time: string | null;
  close_time: string | null;
  service_charge_pct: number | string | null;
  vat_pct: number | string | null;
  payment_qr_url: string | null;
}

export default function ShopSettingsForm({ restaurant, canManage, onUpdated }: {
  restaurant: ShopSettings;
  canManage: boolean;
  onUpdated: (restaurant: ShopSettings) => void;
}) {
  const [name, setName] = useState(restaurant.name);
  const [acceptingOrders, setAcceptingOrders] = useState(restaurant.accepting_orders);
  const [serviceCharge, setServiceCharge] = useState(String(restaurant.service_charge_pct ?? 0));
  const [vat, setVat] = useState(String(restaurant.vat_pct ?? 0));
  const [saving, setSaving] = useState(false);
  const [nameSaveState, setNameSaveState] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const nameSaveTimer = useRef<number | null>(null);
  const nameSaveSequence = useRef(0);
  const nameSaveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => () => {
    if (nameSaveTimer.current !== null) window.clearTimeout(nameSaveTimer.current);
  }, []);

  function emitNameUpdated(nextRestaurant: ShopSettings) {
    onUpdated(nextRestaurant);
    window.dispatchEvent(new CustomEvent("shopqr:restaurant-name-updated", {
      detail: { restaurantId: restaurant.id, name: nextRestaurant.name },
    }));
  }

  function scheduleNameSave(nextName: string, delay = 450) {
    if (nameSaveTimer.current !== null) window.clearTimeout(nameSaveTimer.current);
    const cleanName = nextName.trim();
    if (!cleanName) {
      setNameSaveState("");
      return;
    }
    const sequence = ++nameSaveSequence.current;
    nameSaveTimer.current = window.setTimeout(() => {
      setNameSaveState("กำลังบันทึกชื่อร้าน…");
      nameSaveQueue.current = nameSaveQueue.current.catch(() => {}).then(async () => {
        if (sequence !== nameSaveSequence.current) return;
        const result = await apiRequest<{ restaurant: ShopSettings }>(`/api/restaurants/${restaurant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanName }),
        });
        if (sequence !== nameSaveSequence.current) return;
        emitNameUpdated(result.restaurant);
        setNameSaveState("บันทึกชื่อร้านแล้ว");
      }).catch(() => {
        if (sequence === nameSaveSequence.current) setNameSaveState("บันทึกชื่อร้านไม่สำเร็จ");
      });
    }, delay);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;
    const serviceChargePct = Number(serviceCharge);
    const vatPct = Number(vat);
    if (!name.trim()) return setError("กรุณากรอกชื่อร้าน");
    if (!Number.isFinite(serviceChargePct) || serviceChargePct < 0 || serviceChargePct > 100) return setError("ค่าบริการต้องอยู่ระหว่าง 0–100%");
    if (!Number.isFinite(vatPct) || vatPct < 0 || vatPct > 100) return setError("VAT ต้องอยู่ระหว่าง 0–100%");

    setSaving(true);
    setError("");
    setNotice("");
    if (nameSaveTimer.current !== null) window.clearTimeout(nameSaveTimer.current);
    nameSaveTimer.current = null;
    ++nameSaveSequence.current;
    try {
      await nameSaveQueue.current.catch(() => {});
      const result = await apiRequest<{ restaurant: ShopSettings }>(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          accepting_orders: acceptingOrders,
          service_charge_pct: serviceChargePct,
          vat_pct: vatPct,
        }),
      });
      emitNameUpdated(result.restaurant);
      setNotice("บันทึกการตั้งค่าร้านแล้ว");
    } catch (cause) {
      setError(cause instanceof ApiError ? `บันทึกไม่สำเร็จ (${cause.code})` : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header><h2 className="text-lg font-semibold">ข้อมูลร้าน</h2><p className="mt-1 text-sm text-slate-500">ตั้งชื่อร้าน เวลาเปิด–ปิด และอัตราค่าบริการ</p></header>
    {!canManage && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">แก้ไขการตั้งค่านี้ได้เฉพาะเจ้าของร้าน</p>}
    <label className="grid gap-1.5 text-sm font-medium">ชื่อร้าน<input value={name} onChange={(event) => { setName(event.target.value); scheduleNameSave(event.target.value); }} onBlur={() => scheduleNameSave(name, 0)} disabled={!canManage} required maxLength={100} className={inputClass} /></label>
    {nameSaveState && <p role="status" className="text-xs text-slate-500">{nameSaveState}</p>}
    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><span><strong className="block text-sm font-medium">รับออเดอร์</strong><small className="text-xs text-slate-500">ปิดแล้วลูกค้าจะสั่งอาหารไม่ได้</small></span><input type="checkbox" checked={acceptingOrders} onChange={(event) => setAcceptingOrders(event.target.checked)} disabled={!canManage} className="h-5 w-5 accent-emerald-700" /></label>
    <WeeklyHoursEditor restaurantId={restaurant.id} />
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><div><h3 className="m-0 text-sm font-medium">ค่าบริการและภาษี</h3><p className="mt-1 text-xs text-slate-500">คิดเป็นเปอร์เซ็นต์จากยอดอาหาร</p></div><div className="grid gap-3 sm:grid-cols-2"><PercentField label="ค่าบริการ" value={serviceCharge} disabled={!canManage} onChange={setServiceCharge} /><PercentField label="VAT" value={vat} disabled={!canManage} onChange={setVat} /></div></section>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
    {canManage && <button disabled={saving} className="w-full rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button>}
  </form>;
}

function PercentField({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}<span className="relative"><input type="number" min="0" max="100" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`${inputClass} pr-8`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span></span></label>;
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
