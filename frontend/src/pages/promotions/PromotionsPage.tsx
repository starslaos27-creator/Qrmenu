import { useEffect, useMemo, useState, type FormEvent } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import { uploadRestaurantImage } from "../../shared/api/uploadImage";

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  start_at: string | null;
  end_at: string | null;
  created_at?: string;
}

interface FormValues {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
}

const emptyForm: FormValues = { title: "", description: "", startAt: "", endAt: "" };

export default function PromotionsPage({ onLogin }: { onLogin: () => void }) {
  const [restaurantId, setRestaurantId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const imagePreview = useMemo(() => image ? URL.createObjectURL(image) : "", [image]);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const session = await loadRestaurantSession();
        if (cancelled) return;
        const membership = session.membership;
        if (!membership) {
          setError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร");
          return;
        }
        setRestaurantId(membership.restaurant_id);
        setCanManage(membership.role === "owner");
        const result = await apiRequest<{ promotions: Promotion[] }>(`/api/restaurants/${membership.restaurant_id}/promotions`);
        if (!cancelled) setPromotions(result.promotions);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) onLogin();
        else setError(cause instanceof ApiError ? `โหลดโปรโมชั่นไม่สำเร็จ (${cause.code})` : "โหลดโปรโมชั่นไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [onLogin]);

  async function createPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;
    const title = form.title.trim();
    if (!title) return;
    if (form.startAt && form.endAt && new Date(form.endAt) <= new Date(form.startAt)) {
      setError("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น");
      return;
    }
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const imageUrl = image ? await uploadRestaurantImage({ restaurantId, bucket: "promotion-images", file: image }) : null;
      const result = await apiRequest<{ promotion: Promotion }>(`/api/restaurants/${restaurantId}/promotions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: form.description.trim() || null,
          image_url: imageUrl,
          active: true,
          sort_order: promotions.length,
          start_at: form.startAt ? new Date(form.startAt).toISOString() : null,
          end_at: form.endAt ? new Date(form.endAt).toISOString() : null,
        }),
      });
      setPromotions((current) => [...current, result.promotion]);
      setForm(emptyForm);
      setImage(null);
      setNotice("เพิ่มโปรโมชั่นแล้ว");
    } catch (cause) {
      setError(cause instanceof ApiError ? `บันทึกโปรโมชั่นไม่สำเร็จ (${cause.code})` : cause instanceof Error && cause.message === "IMAGE_TOO_LARGE" ? "รูปภาพต้องมีขนาดไม่เกิน 5 MB" : cause instanceof Error && cause.message === "UNSUPPORTED_IMAGE_TYPE" ? "รองรับรูปแบบ JPEG, PNG, WebP, GIF และ SVG" : "บันทึกโปรโมชั่นไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function togglePromotion(promotion: Promotion) {
    const active = !promotion.active;
    setError("");
    setPromotions((current) => current.map((item) => item.id === promotion.id ? { ...item, active } : item));
    try {
      const result = await apiRequest<{ promotion: Promotion }>(`/api/restaurants/${restaurantId}/promotions/${promotion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      setPromotions((current) => current.map((item) => item.id === promotion.id ? result.promotion : item));
    } catch (cause) {
      setPromotions((current) => current.map((item) => item.id === promotion.id ? promotion : item));
      setError(cause instanceof ApiError ? `เปลี่ยนสถานะไม่สำเร็จ (${cause.code})` : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  }

  async function deletePromotion(promotion: Promotion) {
    if (!window.confirm(`ต้องการลบโปรโมชั่น “${promotion.title}” หรือไม่?`)) return;
    setError("");
    try {
      await apiRequest(`/api/restaurants/${restaurantId}/promotions/${promotion.id}`, { method: "DELETE" });
      setPromotions((current) => current.filter((item) => item.id !== promotion.id));
      setNotice("ลบโปรโมชั่นแล้ว");
    } catch (cause) {
      setError(cause instanceof ApiError ? `ลบโปรโมชั่นไม่สำเร็จ (${cause.code})` : "ลบโปรโมชั่นไม่สำเร็จ");
    }
  }

  if (loading) return <main className="grid min-h-64 place-items-center p-6 text-sm text-slate-500">กำลังโหลดโปรโมชั่น…</main>;
  if (error && !restaurantId) return <main className="p-6"><MessagePanel error={error} /></main>;

  const activeCount = promotions.filter((item) => item.active).length;
  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">PROMOTIONS</p>
          <h1 className="mt-1 text-2xl font-semibold">โปรโมชั่น</h1>
          <p className="mt-1 text-sm text-slate-500">สร้างและจัดการโปรโมชั่นที่แสดงให้ลูกค้าเห็น</p>
        </header>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p>}
        {!canManage && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">บัญชีของคุณดูโปรโมชั่นได้ แต่แก้ไขได้เฉพาะเจ้าของร้าน</p>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
          {canManage && <form onSubmit={(event) => void createPromotion(event)} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold">เพิ่มโปรโมชั่น</h2>
            <label className="grid gap-1.5 text-sm font-medium">ชื่อโปรโมชั่น
              <input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} required maxLength={80} className={inputClass} placeholder="เช่น ลด 10% ทุกเมนู" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">รายละเอียด <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
              <textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} maxLength={200} rows={3} className={`${inputClass} resize-none`} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="grid gap-1.5 text-xs text-slate-500">เริ่มเวลา
                <input type="datetime-local" value={form.startAt} onChange={(event) => setForm((value) => ({ ...value, startAt: event.target.value }))} className={inputClass} />
              </label>
              <label className="grid gap-1.5 text-xs text-slate-500">สิ้นสุดเวลา
                <input type="datetime-local" value={form.endAt} onChange={(event) => setForm((value) => ({ ...value, endAt: event.target.value }))} className={inputClass} />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">รูปภาพ <span className="font-normal text-slate-400">(ไม่บังคับ, สูงสุด 5 MB)</span>
              {imagePreview && <img src={imagePreview} alt="ตัวอย่างรูปโปรโมชั่น" className="h-24 w-24 rounded-xl border border-slate-200 object-contain" />}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={(event) => setImage(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
            </label>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-50">{saving ? "กำลังบันทึก…" : "เพิ่มโปรโมชั่น"}</button>
          </form>}

          <section className="space-y-3" aria-label="รายการโปรโมชั่น">
            {promotions.length === 0
              ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-semibold">ยังไม่มีโปรโมชั่น</h2><p className="mt-1 text-sm text-slate-500">เพิ่มโปรโมชั่นแรกของร้านได้จากแบบฟอร์มนี้</p></div>
              : <>
                <div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">รายการโปรโมชั่น</h2><p className="text-sm text-slate-500">ใช้งานอยู่ {activeCount} จาก {promotions.length} รายการ</p></div></div>
                <ul className="space-y-2">
                  {promotions.map((promotion) => <li key={promotion.id} className={`flex gap-3 rounded-2xl border bg-white p-3 shadow-sm ${promotion.active ? "border-slate-200" : "border-slate-200 opacity-70"}`}>
                    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-xl text-slate-400">{promotion.image_url ? <img src={promotion.image_url} alt={promotion.title} className="h-full w-full object-contain" /> : "✦"}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="m-0 text-sm font-semibold">{promotion.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${promotion.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{promotion.active ? "ใช้งาน" : "ปิดใช้งาน"}</span></div>
                      {promotion.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{promotion.description}</p>}
                      {(promotion.start_at || promotion.end_at) && <p className="mt-1 text-xs text-slate-400">{formatDate(promotion.start_at)}{promotion.start_at && promotion.end_at ? " – " : ""}{formatDate(promotion.end_at)}</p>}
                    </div>
                    {canManage && <div className="flex shrink-0 flex-col items-end gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500"><span className="sr-only">เปลี่ยนสถานะ {promotion.title}</span><input type="checkbox" checked={promotion.active} onChange={() => void togglePromotion(promotion)} className="peer sr-only" /><span className="relative h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" /></label>
                      <button type="button" onClick={() => void deletePromotion(promotion)} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-700">ลบ</button>
                    </div>}
                  </li>)}
                </ul>
              </>}
          </section>
        </div>
      </div>
    </main>
  );
}

function MessagePanel({ error }: { error: string }) {
  return <section className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center"><p className="m-0 text-sm text-red-800" role="alert">{error}</p></section>;
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
