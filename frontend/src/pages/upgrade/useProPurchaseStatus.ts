import { useCallback, useEffect, useState } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { apiRequest } from "../../shared/api/client";

export default function useProPurchaseStatus() {
  const [state,setState]=useState({expiresAt:0,serverTime:0,syncedAt:0,pending:false,trialActive:false});
  const [now,setNow]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    try {
      const session=await loadRestaurantSession();
      if(!session.membership)throw new Error("NO_RESTAURANT");
      const data=await apiRequest<{expires_at:string|null;server_now:string;pending:boolean;trial_active?:boolean}>(`/api/restaurants/${session.membership.restaurant_id}/pro-countdown`);
      setState({expiresAt:Date.parse(data.expires_at||"")||0,serverTime:Date.parse(data.server_now),syncedAt:performance.now(),pending:data.pending,trialActive:data.trial_active===true});
      setNow(performance.now());setError("");
    } catch {setError("ตรวจสอบสถานะแพ็กเกจไม่สำเร็จ กรุณาเข้าสู่ระบบแล้วโหลดใหม่");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    void refresh();const poll=window.setInterval(()=>void refresh(),15000),tick=window.setInterval(()=>setNow(performance.now()),1000);
    window.addEventListener("focus",refresh);
    return()=>{clearInterval(poll);clearInterval(tick);window.removeEventListener("focus",refresh);};
  },[refresh]);
  const active=state.expiresAt>state.serverTime+now-state.syncedAt;
  const message=active?(state.trialActive?`สิทธิ์ทดลองโปรฟรีใช้งานได้ถึง ${new Date(state.expiresAt).toLocaleString("th-TH-u-ca-gregory",{timeZone:"Asia/Bangkok"})}`:`แพ็กเกจโปรยังใช้งานได้ถึง ${new Date(state.expiresAt).toLocaleString("th-TH-u-ca-gregory",{timeZone:"Asia/Bangkok"})}`):state.pending?"ท่านได้ส่งคำขอชำระแล้ว กำลังรอแอดมินอนุมัติ กรุณาอย่าส่งคำขอซ้ำ":"";
  return {active,trialActive:state.trialActive,pending:state.pending,loading,error,message,refresh,blocked:active||state.pending||loading||!!error};
}
