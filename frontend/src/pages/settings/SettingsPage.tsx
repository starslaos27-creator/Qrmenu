import { useEffect, useState } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import BankAccountSettings from "./BankAccountSettings";
import ChangePasswordForm from "./ChangePasswordForm";
import KioskPrintingSettings from "./KioskPrintingSettings";
import PaymentSettings from "./PaymentSettings";
import ReceiptHeaderSettings from "./ReceiptHeaderSettings";
import ShopSettingsForm, { type ShopSettings } from "./ShopSettingsForm";
import TeamManagementPanel from "./TeamManagementPanel";

interface Member {
  id: string;
  user_id: string;
  role: string;
  invited_email: string | null;
  email?: string;
  phone: string | null;
  created_at: string;
}

export default function SettingsPage({ onLogin }: { onLogin: () => void }) {
  const [restaurant, setRestaurant] = useState<ShopSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const session = await loadRestaurantSession();
        const membership = session.membership;
        if (!membership) {
          if (!cancelled) setError("บัญชีนี้ยังไม่ได้เข้าร่วมร้านอาหาร");
          return;
        }
        const [restaurantResult, membersResult] = await Promise.all([
          apiRequest<{ restaurant: ShopSettings }>(`/api/restaurants/${membership.restaurant_id}`),
          apiRequest<{ members: Member[] }>(`/api/restaurants/${membership.restaurant_id}/members`),
        ]);
        if (cancelled) return;
        setRestaurant(restaurantResult.restaurant);
        setMembers(membersResult.members);
        setCurrentUserId(session.user.id);
        setUserEmail(session.user.email);
        setCanManage(membership.role === "owner");
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) onLogin();
        else setError(cause instanceof ApiError ? `โหลดการตั้งค่าไม่สำเร็จ (${cause.code})` : "โหลดการตั้งค่าไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [onLogin]);

  if (loading) return <main className="grid min-h-64 place-items-center p-6 text-sm text-slate-500">กำลังโหลดการตั้งค่า…</main>;
  if (!restaurant) return <main className="p-4 sm:p-6"><section className="mx-auto mt-12 max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center"><p role="alert" className="m-0 text-sm text-red-800">{error || "ไม่พบข้อมูลร้าน"}</p></section></main>;

  return <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
    <div className="mx-auto max-w-5xl space-y-5">
      <header><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">SETTINGS</p><h1 className="mt-1 text-2xl font-semibold">ตั้งค่าร้าน</h1><p className="mt-1 text-sm text-slate-500">จัดการข้อมูลร้าน การชำระเงิน ทีมงาน และบัญชีของคุณ</p></header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <ShopSettingsForm restaurant={restaurant} canManage={canManage} onUpdated={setRestaurant} />
      <ReceiptHeaderSettings restaurantId={restaurant.id} />
      <PaymentSettings restaurant={restaurant} canManage={canManage} onUpdated={setRestaurant} />
      <BankAccountSettings restaurantId={restaurant.id} />
      <KioskPrintingSettings />
      <TeamManagementPanel restaurantId={restaurant.id} currentUserId={currentUserId} initialMembers={members} canManage={canManage} />
      <ChangePasswordForm email={userEmail} onLogin={onLogin} />
    </div>
  </main>;
}
