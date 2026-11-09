import { r as React } from "/assets/vendor-react-DCUvmuBu.js";

const h = React.createElement;
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #dfceb0",
  borderRadius: 10,
  background: "#fffdf7",
  color: "#073f38",
  padding: "10px 12px",
  font: "inherit",
};
const buttonStyle = {
  border: 0,
  borderRadius: 10,
  background: "#075447",
  color: "#fff8e8",
  padding: "10px 14px",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};
const statusLabels = {
  pending: "รอรับ",
  expired: "หมดกำหนด",
  picked_up: "รับแล้ว",
};

export default function StockDepositsPage({ restaurantId = "" }) {
  const [deposits, setDeposits] = React.useState([]);
  const [filter, setFilter] = React.useState("pending");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState(() => emptyForm());
  const endpoint = `/api/restaurants/${encodeURIComponent(restaurantId)}/stock-deposits`;

  async function loadDeposits() {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await request(endpoint);
      setDeposits(Array.isArray(result?.deposits) ? result.deposits : []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    if (!restaurantId) {
      setLoading(false);
      return () => { current = false; };
    }
    request(`/api/restaurants/${encodeURIComponent(restaurantId)}/stock-deposits`)
      .then(result => { if (current) setDeposits(Array.isArray(result?.deposits) ? result.deposits : []); })
      .catch(requestError => { if (current) setError(errorMessage(requestError)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [restaurantId]);

  async function createDeposit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const printFrame = createPrintFrame();
    try {
      const result = await request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          customer_contact: form.customer_contact.trim() || null,
          product_name: form.product_name.trim(),
          quantity: Number(form.quantity),
          meal_count: Number(form.meal_count),
          unit: form.unit.trim(),
          due_date: form.due_date,
          note: form.note.trim() || null,
        }),
      });
      setForm(emptyForm());
      await loadDeposits();
      if (result?.deposit) printDeposit(result.deposit, printFrame);
      else printFrame.remove();
    } catch (requestError) {
      printFrame.remove();
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function markPickedUp(depositId) {
    setError("");
    try {
      await request(`${endpoint}/${encodeURIComponent(depositId)}/pickup`, { method: "POST" });
      await loadDeposits();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  const pending = deposits.filter(item => item.status === "pending").length;
  const expired = deposits.filter(item => item.status === "expired").length;
  const visible = filter === "all" ? deposits : deposits.filter(item => item.status === filter);

  return h("main", { style: { minHeight: "100%", padding: "28px 24px 40px", color: "#073f38", background: "#f1e8d7", fontFamily: "inherit" } },
    h("header", { style: { marginBottom: 20, borderLeft: "4px solid #c79b48", paddingLeft: 14 } },
      h("div", { style: { color: "#aa5b16", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" } }, "สต็อกฝาก"),
      h("h1", { style: { margin: "3px 0", fontSize: 28, color: "#06483e" } }, "สต็อกฝาก"),
      h("p", { style: { margin: 0, color: "#68756c" } }, "บันทึกสินค้าที่ลูกค้าฝากไว้ และติดตามกำหนดรับคืน")
    ),
    error ? h("div", { role: "alert", style: { marginBottom: 16, padding: 12, borderRadius: 10, border: "1px solid #e8b8a9", background: "#fff4ee", color: "#8c3425" } }, error) : null,
    h("section", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 } },
      statCard("รอรับ", pending), statCard("หมดกำหนด", expired), statCard("ทั้งหมด", deposits.length)
    ),
    h("div", { style: { display: "grid", gridTemplateColumns: "minmax(280px,360px) minmax(0,1fr)", alignItems: "start", gap: 18 } },
      h("form", { onSubmit: createDeposit, style: { padding: 18, borderRadius: 16, border: "1px solid #dfceb0", background: "#fffaf0", boxShadow: "0 8px 20px #4a321015" } },
        h("h2", { style: { margin: "0 0 14px", fontSize: 18 } }, "บันทึกสินค้าฝาก"),
        field("ชื่อลูกค้า", "customer_name", form, setForm, { required: true, maxLength: 160 }),
        field("เบอร์ติดต่อ (ถ้ามี)", "customer_contact", form, setForm, { maxLength: 100 }),
        field("ชื่อสินค้า", "product_name", form, setForm, { required: true, maxLength: 200 }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
          field("จำนวน", "quantity", form, setForm, { required: true, type: "number", min: "0.001", step: "any" }),
          field("หน่วย", "unit", form, setForm, { required: true, maxLength: 40 })
        ),
        field("จำนวนมื้อ (เริ่มนับวันนี้)", "meal_count", form, setForm, { required: true, type: "number", min: "1", step: "1" }),
        field("วันที่มื้อสุดท้าย / กำหนดรับ", "due_date", form, setForm, { required: true, type: "date", min: localDate(), readOnly: true }),
        field("หมายเหตุ (ถ้ามี)", "note", form, setForm, { maxLength: 1000 }),
        h("button", { type: "submit", disabled: saving || !restaurantId, style: { ...buttonStyle, width: "100%", marginTop: 6, opacity: saving || !restaurantId ? .65 : 1 } }, saving ? "กำลังบันทึก…" : "บันทึกสินค้าฝาก")
      ),
      h("section", { style: { minWidth: 0, padding: 18, borderRadius: 16, border: "1px solid #dfceb0", background: "#fffaf0", boxShadow: "0 8px 20px #4a321015" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 } },
          h("h2", { style: { margin: 0, fontSize: 18 } }, "รายการสินค้าฝาก"),
          h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
            [["pending", "รอรับ"], ["expired", "หมดกำหนด"], ["picked_up", "รับแล้ว"], ["all", "ทั้งหมด"]].map(([value, label]) =>
              h("button", { key: value, type: "button", onClick: () => setFilter(value), style: { ...buttonStyle, padding: "7px 10px", fontSize: 13, background: filter === value ? "#075447" : "#eee2c9", color: filter === value ? "#fff8e8" : "#174a34" } }, label)
            )
          )
        ),
        loading ? h("p", { style: { padding: 22, textAlign: "center", color: "#68756c" } }, "กำลังโหลดรายการ…") : visible.length === 0
          ? h("p", { style: { padding: 22, textAlign: "center", color: "#68756c" } }, "ไม่มีรายการในสถานะนี้")
          : h("div", { style: { display: "grid", gap: 10 } }, visible.map(deposit => depositCard(deposit, markPickedUp)))
      )
    )
  );
}

function statCard(label, value) {
  return h("article", { key: label, style: { padding: "15px 18px", borderRadius: 14, border: "1px solid #ded6c7", background: "#fffaf0" } },
    h("div", { style: { color: "#68756c", fontSize: 13 } }, label),
    h("strong", { style: { display: "block", marginTop: 4, fontSize: 26 } }, String(value))
  );
}

function field(label, name, form, setForm, options = {}) {
  const type = options.type || "text";
  return h("label", { key: name, style: { display: "block", marginBottom: 11, color: "#315c52", fontSize: 13, fontWeight: 600 } },
    h("span", { style: { display: "block", marginBottom: 5 } }, label),
    h("input", {
      ...options,
      type,
      value: form[name],
      onChange: event => setForm(previous => {
        const value = event.target.value;
        const next = { ...previous, [name]: value };
        if (name === "meal_count") next.due_date = mealEndDate(value);
        return next;
      }),
      style: inputStyle,
    })
  );
}

function depositCard(deposit, markPickedUp) {
  const status = statusLabels[deposit.status] || deposit.status || "ไม่ทราบสถานะ";
  return h("article", { key: deposit.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 14, border: "1px solid #e4d7c0", borderRadius: 12, background: "#fffdf7" } },
    h("div", null,
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
        h("strong", { style: { fontSize: 16 } }, deposit.product_name),
        h("span", { style: { borderRadius: 999, padding: "3px 8px", background: deposit.status === "pending" ? "#e0f1e6" : "#eee7da", color: "#315c52", fontSize: 12 } }, status)
      ),
      h("div", { style: { marginTop: 5, color: "#52665e", fontSize: 14 } }, `${deposit.customer_name || "ไม่ระบุลูกค้า"}${deposit.customer_contact ? ` · ${deposit.customer_contact}` : ""}`),
      h("div", { style: { marginTop: 4, color: "#68756c", fontSize: 13 } }, `จำนวน ${formatQuantity(deposit.quantity)} ${deposit.unit}${deposit.meal_count ? ` · ${deposit.meal_count} มื้อ` : ""} · กำหนดรับ ${dateLabel(deposit.due_date)}`),
      deposit.note ? h("div", { style: { marginTop: 4, color: "#68756c", fontSize: 13 } }, deposit.note) : null
    ),
    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
      h("button", { type: "button", onClick: () => printDeposit(deposit), style: { ...buttonStyle, background: "#a66b1f" } }, "พิมพ์ใบรับฝาก"),
      deposit.status === "pending" ? h("button", { type: "button", onClick: () => markPickedUp(deposit.id), style: buttonStyle }, "บันทึกรับสินค้าแล้ว") : null
    )
  );
}

function createPrintFrame() {
  const frame = document.createElement("iframe");
  frame.title = "ใบรับฝากสินค้า สำหรับพิมพ์";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:860px;height:900px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(frame);
  return frame;
}

function printDeposit(deposit, targetFrame) {
  const frame = targetFrame || createPrintFrame();
  const printWindow = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!printWindow || !doc) { frame.remove(); return; }
  const escape = value => String(value ?? "—").replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
  const printWidth = depositPrintWidth();
  const createdAt = deposit.created_at ? new Date(deposit.created_at) : new Date();
  const ticketNumber = deposit.id ? deposit.id.slice(0, 8).toUpperCase() : "—";
  const cleanup = () => frame.remove();
  printWindow.addEventListener("afterprint", cleanup, { once: true });
  frame.onload = () => {
    printWindow.focus();
    window.setTimeout(() => {
      try { printWindow.print(); }
      catch { cleanup(); }
    }, 80);
  };
  doc.open();
  doc.write(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ใบรับฝากสินค้า ${escape(ticketNumber)}</title><style>
    @page{size:auto;margin:0}*{box-sizing:border-box}body{font:${printWidth===48?11:14}px/1.45 Arial,"Noto Sans Thai",Tahoma,sans-serif;color:#000;font-weight:600;width:${printWidth}mm;max-width:${printWidth}mm;margin:0 auto;padding:0;border:0;text-rendering:optimizeLegibility}h1,h2,p{margin:0}header{text-align:center;border-bottom:1px dashed #333;padding-bottom:8px;margin-bottom:8px}h1{font-size:${printWidth===48?17:22}px;font-weight:800;letter-spacing:.01em;color:#000}h2{font-size:${printWidth===48?14:18}px;font-weight:800;margin-top:3px;color:#000}.sub{font-size:${printWidth===48?9:12}px;font-weight:700;color:#111;margin-top:4px}.meta{display:flex;justify-content:space-between;gap:6px;font-size:${printWidth===48?9:11}px;font-weight:700;color:#000;margin:6px 0 10px}.row{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed #777;color:#000}.label{color:#111;font-size:${printWidth===48?10:12}px;font-weight:700}.value{text-align:right;color:#000;font-size:${printWidth===48?10:12}px;font-weight:800;overflow-wrap:anywhere}.product{font-size:${printWidth===48?12:15}px;font-weight:800}.note{margin-top:8px;padding:6px;background:#f4f7f4;border-radius:6px;font-size:${printWidth===48?9:11}px;font-weight:700;color:#000;white-space:pre-wrap}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px;text-align:center;font-size:${printWidth===48?9:11}px;font-weight:700;color:#000}.line{border-top:1px solid #333;padding-top:4px}.foot{text-align:center;color:#000;font-size:${printWidth===48?9:11}px;font-weight:700;margin-top:12px}@media print{body{margin:0 auto;width:${printWidth}mm;max-width:${printWidth}mm;padding:0}}</style><body><header><h1>ใบรับฝากสินค้า</h1><h2>Customer Deposit Receipt</h2><p class="sub">โปรดเก็บใบรับฝากนี้ไว้เป็นหลักฐาน</p></header><div class="meta"><span>เลขที่: ${escape(ticketNumber)}</span><span>${escape(createdAt.toLocaleString("th-TH"))}</span></div><div class="row"><span class="label">ชื่อลูกค้า</span><span class="value">${escape(deposit.customer_name)}</span></div><div class="row"><span class="label">เบอร์ติดต่อ</span><span class="value">${escape(deposit.customer_contact || "—")}</span></div><div class="row"><span class="label">สินค้า</span><span class="value product">${escape(deposit.product_name)}</span></div><div class="row"><span class="label">จำนวน</span><span class="value">${escape(formatQuantity(deposit.quantity))} ${escape(deposit.unit)}</span></div>${deposit.meal_count ? `<div class="row"><span class="label">จำนวนมื้อ</span><span class="value">${escape(deposit.meal_count)} มื้อ</span></div>` : ""}<div class="row"><span class="label">กำหนดรับคืน</span><span class="value">${escape(dateLabel(deposit.due_date))}</span></div>${deposit.note ? `<div class="note"><b>หมายเหตุ</b><br>${escape(deposit.note)}</div>` : ""}<div class="signatures"><div class="line">ผู้ฝาก</div><div class="line">ผู้รับฝาก</div></div><p class="foot">สถานะ: ${escape(statusLabels[deposit.status] || "รอรับ")}</p></body></html>`);
  doc.close();
}
function depositPrintWidth() {
  try {
    const settings = JSON.parse(localStorage.getItem("shopqr.bill-printer.v2") || "{}");
    return settings.width === 58 ? 48 : 72;
  } catch {
    return 72;
  }
}
function emptyForm() {
  return { customer_name: "", customer_contact: "", product_name: "", quantity: "1", unit: "ชิ้น", meal_count: "1", due_date: mealEndDate("1"), note: "" };
}

function mealEndDate(value) {
  const count = Number(value);
  const start = localDate();
  if (!Number.isInteger(count) || count < 1 || count > 10000) return start;
  const date = new Date(`${start}T12:00:00`);
  date.setDate(date.getDate() + count - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "medium" }).format(date);
}

function formatQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("th-TH", { maximumFractionDigits: 3 }) : value;
}

function errorMessage(error) {
  const messages = {
    INVALID_BODY: "กรุณาตรวจสอบข้อมูลที่กรอก",
    INVALID_INVENTORY_REFERENCE: "ไม่พบรายการวัตถุดิบที่เลือก",
    DEPOSIT_EXPIRED: "รายการนี้หมดกำหนดแล้ว",
    DEPOSIT_ALREADY_CLOSED: "รายการนี้ปิดแล้ว",
  };
  return messages[error?.code] || error?.message || "โหลดหรือบันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง";
}

async function request(path, init = {}) {
  const send = (token) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(path, { ...init, headers, credentials: "include" });
  };
  let token = null;
  try { token = window.localStorage.getItem("shopqr_access_token"); } catch { /* cookie auth remains available */ }
  let response = await send(token);
  if (response.status === 401) {
    try {
      const refresh = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      const result = refresh.ok ? await refresh.json() : null;
      if (result?.accessToken) {
        token = result.accessToken;
        try { window.localStorage.setItem("shopqr_access_token", token); } catch { /* use the in-memory token */ }
        window.dispatchEvent(new Event("shopqr:auth-changed"));
        response = await send(token);
      }
    } catch { /* report the original request below */ }
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `HTTP_${response.status}`);
    error.code = body?.error || `HTTP_${response.status}`;
    throw error;
  }
  return body;
}
