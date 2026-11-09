import { useState, type FormEvent, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { uploadRestaurantImage } from "../../shared/api/uploadImage";
import type { MenuCategory, RestaurantMenu } from "./types";

export interface MenuFormValue {
  category_id: string | null; name: string; name_lo: string | null; name_en: string | null;
  price: number; unit: string; cost_price: number; description: string | null;
  track_stock: boolean; stock_quantity: number; stock_barcode: string | null;
  low_alert_limit: number; image_url: string | null; available: boolean;
}

export interface MenuImportRow { name: string; category: string; price: number; cost_price: number; stock_quantity: number; unit: string | null; available: boolean; image_url: string | null; description: string | null; }

export default function MenuForm({ restaurantId, categories, menu, busy, error, onClose, onSave, onImport }: {
  restaurantId: string;
  categories: MenuCategory[];
  menu: RestaurantMenu | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (value: MenuFormValue) => Promise<void>;
  onImport: (rows: MenuImportRow[]) => Promise<void>;
}) {
  const [imageUrl, setImageUrl] = useState(menu?.image_url ?? "");
  const [available, setAvailable] = useState(menu?.available ?? true);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [importRows, setImportRows] = useState<MenuImportRow[]>([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

  async function readCsv(file?: File) {
    setImportError(""); setImportRows([]);
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("ไม่พบข้อมูลในไฟล์");
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const headerMap = new Map<string, string>();
      for (const key of Object.keys(records[0] ?? {})) headerMap.set(normalizeHeader(key), key);
      if (!headerMap.has("name")) throw new Error("Required column: name");
      const get = (record: Record<string, unknown>, key: string) => {
        const actual = headerMap.get(normalizeHeader(key));
        return actual ? String(record[actual] ?? "").trim() : "";
      };
      const nonEmptyRecords = records.filter((record) => Object.values(record).some((value) => String(value ?? "").trim()));
      if (nonEmptyRecords.some((record) => !get(record, "name"))) throw new Error("Every data row must include name");
      const rows = nonEmptyRecords.map((record) => {
        const priceText = get(record, "price"), costText = get(record, "cost_price"), stockText = get(record, "stock_quantity");
        return {
          name: get(record, "name"), category: get(record, "category"),
          price: priceText ? Number(priceText.replace(/,/g, "")) : 0,
          cost_price: costText ? Number(costText.replace(/,/g, "")) : 0,
          stock_quantity: stockText ? Number(stockText.replace(/,/g, "")) : 0,
          unit: get(record, "unit") || null,
          available: !["false", "0", "no", "off", "\u0e1b\u0e34\u0e14"].includes(get(record, "available").toLowerCase()),
          image_url: get(record, "image_url") || null, description: get(record, "description") || null,
        } satisfies MenuImportRow;
      });
      if (!rows.length) throw new Error("No menu rows found in file");
      const invalid = rows.find((row) => !Number.isFinite(row.price) || row.price < 0 || !Number.isFinite(row.cost_price) || row.cost_price < 0 || !Number.isFinite(row.stock_quantity) || row.stock_quantity < 0);
      if (invalid) throw new Error("Invalid numeric value in CSV");
      setImportRows(rows);
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : "อ่านไฟล์ CSV ไม่สำเร็จ"); }
  }

  async function importMenus() {
    if (!importRows.length || importing) return;
    setImporting(true); setImportError("");
    try { await onImport(importRows); }
    catch (cause) { setImportError(cause instanceof Error ? cause.message : "นำเข้าเมนูไม่สำเร็จ"); }
    finally { setImporting(false); }
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true); setImageError("");
    try { setImageUrl(await uploadRestaurantImage({ restaurantId, bucket: "menu-images", file })); }
    catch (cause) { setImageError(cause instanceof Error && cause.message === "IMAGE_TOO_LARGE" ? "ไฟล์รูปต้องมีขนาดไม่เกิน 5 MB" : "อัปโหลดรูปไม่สำเร็จ ตรวจสอบชนิดไฟล์แล้วลองใหม่"); }
    finally { setUploading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const name = text(form, "name").trim() || text(form, "name_lo").trim() || text(form, "name_en").trim();
    if (!name) { setImageError("กรุณากรอกชื่อเมนูอย่างน้อยหนึ่งภาษา"); return; }
    await onSave({
      category_id: text(form, "category_id") || null,
      name,
      name_lo: text(form, "name_lo").trim() || null,
      name_en: text(form, "name_en").trim() || null,
      price: Number(form.get("price")), unit: text(form, "unit").trim() || "จาน",
      cost_price: Number(form.get("cost_price") || 0), description: text(form, "description").trim() || null,
      track_stock: form.get("track_stock") === "on", stock_quantity: wholeCount(form.get("stock_quantity")),
      stock_barcode: text(form, "stock_barcode").trim() || null,
      low_alert_limit: wholeCount(form.get("low_alert_limit")), image_url: imageUrl.trim() || null,
      available,
    });
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}><form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
    {!menu && <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div><h3 className="font-bold text-emerald-900">นำเข้าเมนูจาก CSV</h3><p className="mt-1 text-xs text-slate-600">เลือกไฟล์เพื่อเพิ่มหลายเมนูพร้อมกัน ตรวจสอบชื่อและหมวดหมู่ก่อนนำเข้าได้</p></div>
      <label className="block text-sm font-semibold text-slate-700">ไฟล์ CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void readCsv(event.target.files?.[0])} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" /></label>
      <p className="text-xs text-slate-500">Supported columns: name, category, price, cost_price, stock_quantity, unit, available, image_url, description</p>
      {importRows.length > 0 && <>
        <p className="text-sm font-semibold text-slate-700">Preview: {importRows.length} rows</p>
        <div className="max-h-48 overflow-auto rounded-lg border border-emerald-100 bg-white">{importRows.slice(0, 50).map((row, index) => <div key={index} className="flex justify-between gap-3 border-b border-slate-100 p-2 text-xs"><span className="min-w-0 truncate font-medium">{row.name}{row.category ? " | " + row.category : ""}{row.unit ? " | " + row.unit : ""}</span><span className="shrink-0">{row.price} | {row.cost_price} | {row.stock_quantity}</span></div>)}{importRows.length > 50 && <p className="p-2 text-xs text-slate-500">Showing first 50 rows</p>}</div>
        <button type="button" disabled={importing || busy} onClick={() => void importMenus()} className={primary}>{importing ? "Importing..." : `Import ${importRows.length} menus`}</button>
      </>}{importError && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{importError}</p>}
    </section>}
    <div><h2 className="text-lg font-bold">{menu ? "แก้ไขเมนู" : "เพิ่มเมนู"}</h2><p className="text-sm text-slate-500">ชื่อหลักใช้เป็นชื่อสำรองเมื่อลูกค้าเลือกภาษาอื่น</p></div>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="ชื่อเมนู (ไทย)"><input name="name" defaultValue={menu?.name ?? ""} className={input} /></Field><Field label="ຊື່ເມນູ (ລາວ)"><input name="name_lo" defaultValue={menu?.name_lo ?? ""} className={input} /></Field><Field label="Menu name (English)"><input name="name_en" defaultValue={menu?.name_en ?? ""} className={input} /></Field></div>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="หมวดหมู่"><select name="category_id" defaultValue={menu?.category_id ?? ""} className={input}><option value="">ไม่ระบุ</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="ราคา *"><input required min="0" step="any" type="number" name="price" defaultValue={menu?.price ?? 0} className={input} /></Field><Field label="หน่วย"><input maxLength={40} name="unit" defaultValue={menu?.unit ?? "จาน"} className={input} /></Field></div>
    <Field label="รายละเอียด"><textarea rows={3} name="description" defaultValue={menu?.description ?? ""} className={input} /></Field>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="ต้นทุน"><input min="0" step="any" type="number" name="cost_price" defaultValue={menu?.cost_price ?? 0} className={input} /></Field><Field label="บาร์โค้ดสต็อก"><input name="stock_barcode" defaultValue={menu?.stock_barcode ?? ""} className={input} /></Field><Field label="เตือนเมื่อสต็อกเหลือ"><input min="0" step="1" type="number" name="low_alert_limit" defaultValue={wholeCount(menu?.low_alert_limit)} className={input} /></Field></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="จำนวนสต็อกเมนู"><input min="0" step="1" type="number" name="stock_quantity" defaultValue={wholeCount(menu?.stock_quantity)} className={input} /></Field><label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 p-3 text-sm font-semibold"><input type="checkbox" name="track_stock" defaultChecked={menu?.track_stock ?? false} />ติดตามสต็อกเมนูนี้</label></div>
    <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-semibold"><span>พร้อมขาย (Available for ordering)</span><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /></label>
    <div className="space-y-2"><label className="block text-sm font-semibold">รูปเมนู</label><div className="flex flex-wrap items-center gap-3">{imageUrl && <img src={imageUrl} alt="ตัวอย่างรูปเมนู" className="h-16 w-16 rounded-lg object-cover" />}<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="URL รูปภาพ" className={input + " min-w-52 flex-1"} /><label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">{uploading ? "กำลังอัปโหลด…" : "เลือกรูป"}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={(event) => void upload(event.target.files?.[0])} /></label></div></div>
    {(error || imageError) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error || imageError}</p>}
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className={secondary}>ยกเลิก</button><button disabled={busy || uploading} className={primary}>{busy ? "กำลังบันทึก…" : "บันทึกเมนู"}</button></div>
  </form></div>;
}

function normalizeHeader(value: string) { return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_"); }
function wholeCount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-sm font-semibold text-slate-700">{label}{children}</label>; }
function text(form: FormData, key: string) { return String(form.get(key) ?? ""); }
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const primary = "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
