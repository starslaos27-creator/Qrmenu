import { useState } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";
import { uploadRestaurantImage } from "../../shared/api/uploadImage";
import type { ShopSettings } from "./ShopSettingsForm";

export default function PaymentSettings({ restaurant, canManage, onUpdated }: {
  restaurant: ShopSettings;
  canManage: boolean;
  onUpdated: (restaurant: ShopSettings) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function chooseFile(file?: File) {
    if (!file || !canManage || uploading) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const paymentQrUrl = await uploadRestaurantImage({ restaurantId: restaurant.id, bucket: "payment-qr", file });
      const result = await apiRequest<{ restaurant: ShopSettings }>(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_qr_url: paymentQrUrl }),
      });
      onUpdated(result.restaurant);
      setNotice("บันทึกรูป QR รับชำระเงินแล้ว");
    } catch (cause) {
      setError(cause instanceof ApiError ? `อัปโหลดไม่สำเร็จ (${cause.code})` : cause instanceof Error && cause.message === "IMAGE_TOO_LARGE" ? "รูปภาพต้องมีขนาดไม่เกิน 5 MB" : cause instanceof Error && cause.message === "UNSUPPORTED_IMAGE_TYPE" ? "รองรับไฟล์ JPEG, PNG, WebP, GIF และ SVG" : "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    if (!canManage || uploading || !window.confirm("ต้องการลบรูป QR รับชำระเงินหรือไม่?")) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ restaurant: ShopSettings }>(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_qr_url: null }),
      });
      onUpdated(result.restaurant);
      setNotice("ลบรูป QR แล้ว");
    } catch (cause) {
      setError(cause instanceof ApiError ? `ลบรูปไม่สำเร็จ (${cause.code})` : "ลบรูปไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setUploading(false);
    }
  }

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <header><h2 className="text-lg font-semibold">QR รับชำระเงิน</h2><p className="mt-1 text-sm text-slate-500">รูปนี้จะแสดงให้ลูกค้าตรวจสอบตอนชำระเงิน</p></header>
    {!canManage && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">แก้ไขได้เฉพาะเจ้าของร้าน</p>}
    <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
      {restaurant.payment_qr_url ? <img src={restaurant.payment_qr_url} alt="QR รับชำระเงิน" className="h-48 w-48 rounded-xl border border-slate-200 bg-white object-contain p-2" /> : <div className="grid h-40 w-40 place-items-center rounded-xl bg-white text-center text-sm text-slate-400">ยังไม่มีรูป QR</div>}
      {canManage && <div className="flex flex-wrap justify-center gap-2">
        <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">{restaurant.payment_qr_url ? "เปลี่ยนรูป" : "อัปโหลดรูป"}<input type="file" accept="image/*" disabled={uploading} onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} className="sr-only" /></label>
        {restaurant.payment_qr_url && <button type="button" onClick={() => void remove()} disabled={uploading} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">ลบรูป</button>}
      </div>}
      {uploading && <p className="m-0 text-xs text-slate-500" role="status">กำลังอัปโหลด…</p>}
    </div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
  </section>;
}
