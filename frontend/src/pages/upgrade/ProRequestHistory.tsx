export interface ProRequest {
  id: string; paid_months: number; free_months: number; total_usd: string;
  status: "pending" | "approved" | "rejected"; created_at: string;
  reviewed_at: string | null; reviewer_email: string | null; review_note: string;
}
export const requestStatus = { pending: "รอแอดมินอนุมัติ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" };
const date = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
export default function ProRequestHistory({ requests }: { requests: ProRequest[] }) {
  return <section className="mt-6 rounded-2xl border border-[#dfcfb2] bg-[#fffaf1] p-6">
    <h2 className="text-xl font-bold">ประวัติคำขอแพ็กเกจ</h2>
    {!requests.length ? <p className="mt-4 text-sm text-[#756247]">ยังไม่มีประวัติคำขอ</p> : <ul className="mt-4 space-y-4">{requests.map(row => <li key={row.id} className="rounded-xl border border-[#dfcfb2] p-4 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><strong>{row.paid_months} เดือน{row.free_months > 0 ? ` แถม ${row.free_months} เดือน` : ""}</strong><span className={row.status === "approved" ? "font-bold text-emerald-700" : row.status === "rejected" ? "font-bold text-red-700" : "font-bold text-amber-800"}>{requestStatus[row.status]}</span></div>
      <p className="mt-2">ยอดบันทึก ${Number(row.total_usd).toFixed(2)} USD</p><p className="mt-2 text-xs text-[#756247]">วันที่ส่ง: {date(row.created_at)}</p>
      <p className="mt-1 break-all text-xs text-[#756247]">เลขคำขอ: {row.id}</p>
      {row.reviewed_at && <p className="mt-2 text-xs text-[#756247]">ตรวจสอบเมื่อ {date(row.reviewed_at)} · {row.reviewer_email || "แอดมิน"}</p>}
      {row.review_note && <p className="mt-2 whitespace-pre-wrap">หมายเหตุ: {row.review_note}</p>}
    </li>)}</ul>}
  </section>;
}
