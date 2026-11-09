import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";
import type { CreateDepositInput, StockDeposit } from "./types";

export function useStockDepositsData(restaurantId: string | null) {
  const [deposits, setDeposits] = useState<StockDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true); setError("");
    try { const result = await apiRequest<{ deposits: StockDeposit[] }>(`/api/restaurants/${restaurantId}/stock-deposits`); setDeposits(result.deposits); }
    catch { setError("โหลดรายการสินค้าฝากไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"); }
    finally { setLoading(false); }
  }, [restaurantId]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function create(input: CreateDepositInput) { if (!restaurantId) return; await apiRequest(`/api/restaurants/${restaurantId}/stock-deposits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); await refresh(); }
  async function pickup(depositId: string) { if (!restaurantId) return; await apiRequest(`/api/restaurants/${restaurantId}/stock-deposits/${depositId}/pickup`, { method: "POST" }); await refresh(); }
  return { deposits, loading, error, refresh, create, pickup };
}
