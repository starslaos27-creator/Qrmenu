import { useEffect, useState, type FormEvent } from "react";
import { adminRequest } from "../../shared/adminApi";

type ContactMessage = { id: string; name: string; email: string; subject: string; message: string; created_at: string };

export default function ContactMessagesPage({ canManage, canView = canManage }: { canManage: boolean; canView?: boolean }) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  function prepareReply(event: FormEvent<HTMLFormElement>, item: ContactMessage) {
    event.preventDefault();
    const message = replyText.trim();
    if (!message) return;
    const subject = `Re: ${item.subject.replace(/[\r\n]+/g, " ")}`;
    window.location.href = `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }
  useEffect(() => {
    if (!canView) return;
    let active = true;
    void adminRequest<{ messages: ContactMessage[] }>("/api/admin/contact-messages").then((data) => { if (active) setMessages(data.messages); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canView]);
  return <section className="mx-auto max-w-5xl"><h1 className="text-2xl font-bold text-slate-900">ข้อความติดต่อ</h1><p className="mt-2 text-sm text-slate-500">ข้อความจากแบบฟอร์มติดต่อ Starsmenu (แสดงล่าสุด 200 รายการ)</p>
    {!canView ? <p className="mt-6 text-sm text-slate-600">ไม่มีสิทธิ์ดูข้อความติดต่อ</p> : loading ? <p className="mt-6 text-sm text-slate-500">กำลังโหลด…</p> : error ? <p role="alert" className="mt-6 text-sm text-red-700">โหลดข้อความไม่สำเร็จ กรุณาลองใหม่</p> : messages.length === 0 ? <p className="mt-6 text-sm text-slate-500">ยังไม่มีข้อความ</p> : <div className="mt-6 grid gap-4">{messages.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-bold">{item.subject}</h2><time className="text-xs text-slate-500" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("th-TH")}</time></div><p className="mt-2 text-sm text-slate-600">{item.name} · <a className="text-emerald-800 underline" href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a></p><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{item.message}</p>
      {canManage && (replyId === item.id ? <form onSubmit={(event) => prepareReply(event, item)} className="mt-5 grid gap-3 border-t border-slate-200 pt-5">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">ข้อความตอบกลับถึง {item.email}<textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} required maxLength={5000} rows={5} className="w-full rounded-lg border border-slate-300 p-3 text-base font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" /></label>
        <p className="text-sm text-slate-500">ระบบจะเปิดร่างในแอปอีเมล กรุณาตรวจสอบและกดส่งในแอปอีเมล</p>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={!replyText.trim()} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50">เปิดอีเมลเพื่อตอบกลับ</button><button type="button" onClick={() => { setReplyId(null); setReplyText(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button></div>
      </form> : <button type="button" onClick={() => { setReplyId(item.id); setReplyText(""); }} className="mt-4 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50">ตอบกลับลูกค้า</button>)}
    </article>)}</div>}
  </section>;
}
