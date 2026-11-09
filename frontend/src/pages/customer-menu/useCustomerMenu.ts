import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";
import type { CustomerMenuData, CustomerOrder } from "./types";

export function useCustomerMenu(tableCode: string) {
  const [data, setData] = useState<CustomerMenuData | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [billCheckRequested, setBillCheckRequested] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!tableCode) return;
    try {
      const code = encodeURIComponent(tableCode.toUpperCase());
      const [menu, orderResult] = await Promise.all([
        apiRequest<CustomerMenuData>(`/api/public/menu/${code}`, {}, { auth: false }),
        apiRequest<{ orders: CustomerOrder[]; billCheckRequested?: boolean }>(`/api/public/tables/${code}/orders`, {}, { auth: false }),
      ]);
      setData(menu); setOrders(orderResult.orders); setBillCheckRequested(!!orderResult.billCheckRequested); setError("");
    } catch { setError("ไม่พบ QR โต๊ะนี้ หรือโหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [tableCode]);
  useEffect(() => {
    void refresh(); const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return { data, orders, billCheckRequested, error, loading, refresh };
}
