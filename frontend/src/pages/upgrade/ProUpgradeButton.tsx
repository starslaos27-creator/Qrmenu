import { useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";

export default function ProUpgradeButton({restaurantId}: {restaurantId?: string}) {
  const [remaining,setRemaining] = useState(0);
  const [trialActive,setTrialActive] = useState(false);
  useEffect(() => {
    if (!restaurantId) { setRemaining(0); setTrialActive(false); return; }
    let active = true, deadline = 0, serverTime = 0, synchronizedAt = 0;
    function tick() { if (active) setRemaining(Math.max(0, deadline - (serverTime + performance.now() - synchronizedAt))); }
    async function sync() {
      try {
        const data = await apiRequest<{expires_at:string|null;server_now:string;trial_active?:boolean}>(`/api/restaurants/${restaurantId}/pro-countdown`);
        if (!active) return;
        deadline = Date.parse(data.expires_at || "") || 0; serverTime = Date.parse(data.server_now); synchronizedAt = performance.now(); setTrialActive(data.trial_active === true); tick();
      } catch { /* Preserve the confirmed countdown during a connection interruption. */ }
    }
    void sync(); const second = window.setInterval(tick,1000), poll = window.setInterval(()=>void sync(),15000);
    window.addEventListener("focus",sync);
    return () => {active=false;clearInterval(second);clearInterval(poll);window.removeEventListener("focus",sync);};
  },[restaurantId]);
  const seconds = Math.floor(remaining/1000), days = Math.floor(seconds/86400);
  const clock = [Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60].map(value=>String(value).padStart(2,"0")).join(":");
  return <a href="/dashboard/upgrade" className="whitespace-nowrap rounded-xl bg-[#174a34] px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-900">{remaining>0?`⭐ ${trialActive?"ทดลองใช้ฟรี":"โปรเหลือ"} ${days} วัน ${clock}`:"⭐ อัปเกรดโปร"}</a>;
}
