import { useEffect, useState, type FormEvent } from "react";
import { loadRestaurantSession, type AuthUser, type RestaurantMembership } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";

type FeedbackCategory = "bug" | "feature" | "question" | "general";

interface FeedbackRecord {
  id: string;
  category: FeedbackCategory;
  message: string;
  email: string | null;
  resolved: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

interface FeedbackPageProps {
  onLogin: () => void;
}

const categories: { value: FeedbackCategory; label: string; icon: string }[] = [
  { value: "bug", label: "แจ้งปัญหา", icon: "🐞" },
  { value: "feature", label: "เสนอฟีเจอร์", icon: "✨" },
  { value: "question", label: "สอบถาม", icon: "❓" },
  { value: "general", label: "ความคิดเห็นทั่วไป", icon: "💬" },
];

export default function FeedbackPage({ onLogin }: FeedbackPageProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [membership, setMembership] = useState<RestaurantMembership | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await loadRestaurantSession();
        if (!cancelled) setUser(session.user);
        if (!session.membership) {
          if (!cancelled) setError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร");
          return;
        }

        const result = await apiRequest<{ feedback: FeedbackRecord[] }>(
          `/api/restaurants/${session.membership.restaurant_id}/feedback`,
        );
        if (cancelled) return;

        setMembership(session.membership);
        setEmail(session.user.email ?? "");
        setFeedback(result.feedback);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError && cause.status === 401
            ? "กรุณาเข้าสู่ระบบก่อนส่งความคิดเห็น"
            : "โหลดความคิดเห็นไม่สำเร็จ กรุณาลองใหม่");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership) return;

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 5) {
      setError("กรุณาเขียนความคิดเห็นอย่างน้อย 5 ตัวอักษร");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const result = await apiRequest<{ feedback: FeedbackRecord }>(
        `/api/restaurants/${membership.restaurant_id}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim() || null,
            category,
            message: trimmedMessage,
          }),
        },
      );
      setFeedback((current) => [result.feedback, ...current]);
      setMessage("");
      setCategory("general");
    } catch (cause) {
      setError(cause instanceof ApiError
        ? `ส่งความคิดเห็นไม่สำเร็จ (${cause.code})`
        : "ส่งความคิดเห็นไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="grid min-h-full place-items-center p-6 text-sm text-slate-500">กำลังโหลดความคิดเห็น…</main>;

  if (!user) {
    return (
      <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
        <section className="mx-auto mt-16 grid max-w-lg justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">ข้อเสนอแนะ</h1>
          <p className="text-sm text-slate-600">{error || "กรุณาเข้าสู่ระบบก่อน"}</p>
          <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white" type="button" onClick={onLogin}>ไปหน้าเข้าสู่ระบบ</button>
        </section>
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
        <section className="mx-auto mt-16 grid max-w-lg justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">ข้อเสนอแนะ</h1>
          <p className="text-sm text-slate-600">{error || "บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร"}</p>
          <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm" type="button" onClick={() => window.history.back()}>กลับ</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full space-y-4 bg-slate-50 p-4 text-slate-800 sm:p-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">ข้อเสนอแนะ</h1>
          <p className="mt-1 text-sm text-slate-500">{membership.restaurant_name || "ส่งความคิดเห็นถึงทีม ShopQR"}</p>
        </div>
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100" type="button" onClick={() => window.history.back()}>กลับ</button>
      </header>

      <div className="mx-auto grid max-w-6xl items-start gap-4 xl:grid-cols-[minmax(17rem,26rem)_minmax(0,1fr)]">
        <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold">ประเภทความคิดเห็น</legend>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${category === item.value ? "border-emerald-800 bg-emerald-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                  aria-pressed={category === item.value}
                  onClick={() => setCategory(item.value)}
                >
                  <span aria-hidden="true">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2 text-sm font-semibold">
            <span>รายละเอียด</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              maxLength={2000}
              minLength={5}
              required
              className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-700"
              placeholder="เล่ารายละเอียดที่ต้องการแจ้งหรือเสนอแนะ"
            />
            <small className="text-right text-xs font-normal text-slate-500">{message.length} / 2,000</small>
          </label>

          <label className="grid gap-2 text-sm font-semibold">
            <span>อีเมลสำหรับติดต่อกลับ</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-700" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          {error && <p className="m-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
          <button className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submitting}>
            {submitting ? "กำลังส่ง…" : "ส่งความคิดเห็น"}
          </button>
        </form>

        <section className="grid min-h-48 content-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="feedback-history-title">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold" id="feedback-history-title">ประวัติความคิดเห็น</h2>
              <p className="mt-1 text-xs text-slate-500">{feedback.length} รายการ</p>
            </div>
          </div>
          {feedback.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">ยังไม่มีความคิดเห็น</p>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {feedback.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <strong className="text-sm">{categories.find((entry) => entry.value === item.category)?.label ?? item.category}</strong>
                    <span className={`rounded-full px-2 py-1 ${item.resolved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {item.resolved ? "ตอบแล้ว" : "รอตรวจสอบ"}
                    </span>
                    <time className="ml-auto text-slate-500" dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{item.message}</p>
                  {item.admin_reply && (
                    <div className="mt-3 rounded-lg border-l-4 border-emerald-400 bg-emerald-50 p-3 text-sm">
                      <strong className="text-emerald-800">คำตอบจากทีมงาน</strong>
                      {item.replied_at && <time className="float-right text-xs text-slate-500" dateTime={item.replied_at}>{formatDate(item.replied_at)}</time>}
                      <p className="mt-2 whitespace-pre-wrap">{item.admin_reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
