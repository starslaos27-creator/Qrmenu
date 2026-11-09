import { useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";
export default function useProPricing() {
  const [price,setPrice]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    apiRequest<{monthly_usd:string|null}>("/api/pro-pricing",{}, {auth:false})
      .then(data=>{if(active){setPrice(data.monthly_usd||"");if(!data.monthly_usd)setError("แอดมินยังไม่ได้ตั้งราคาแพ็กเกจ");}})
      .catch(()=>{if(active)setError("โหลดราคาไม่สำเร็จ กรุณาลองใหม่");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);
  return {price,monthly:Number(price),loading,error};
}
