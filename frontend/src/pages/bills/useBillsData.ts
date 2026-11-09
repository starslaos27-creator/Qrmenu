import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";
import type { BillOrder, BillRestaurant, BillTable, BillZone, StaffCall } from "./types";

export function useBillsData(restaurantId: string | null) {
  const [restaurant, setRestaurant] = useState<BillRestaurant | null>(null);
  const [unpaidOrders, setUnpaidOrders] = useState<BillOrder[]>([]);
  const [settledOrders, setSettledOrders] = useState<BillOrder[]>([]);
  const [tables, setTables] = useState<BillTable[]>([]);
  const [zones, setZones] = useState<BillZone[]>([]);
  const [calls, setCalls] = useState<StaffCall[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const root = `/api/restaurants/${restaurantId}`;
      const [restaurantResult, unpaidResult, settledResult, tableResult, zoneResult, callResult] = await Promise.all([
        apiRequest<{ restaurant: BillRestaurant }>(root),
        fetchAllOrders(`${root}/orders?paid=false&limit=500`),
        fetchAllOrders(`${root}/orders?paid=true&since=${encodeURIComponent(since)}&limit=500`),
        apiRequest<{ tables: BillTable[] }>(`${root}/tables`),
        apiRequest<{ zones: BillZone[] }>(`${root}/zones`),
        apiRequest<{ requests: StaffCall[] }>(`${root}/call-staff`),
      ]);
      setRestaurant(restaurantResult.restaurant);
      setUnpaidOrders(unpaidResult.orders.filter((order) => order.status !== "cancelled"));
      setSettledOrders(settledResult.orders); setTables(tableResult.tables); setZones(zoneResult.zones); setCalls(callResult.requests);
      setError("");
    } catch { setError("โหลดบิลไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setLoading(false); }
  }, [restaurantId]);
  useEffect(() => {
    void refresh(); const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return { restaurant, unpaidOrders, settledOrders, tables, zones, calls, error, loading, refresh };
}

async function fetchAllOrders(url: string) {
  type OrderCursor = { created_at: string; id: string };
  const orders: BillOrder[] = [];
  let next: OrderCursor | null = null;
  do {
    const pageUrl = new URL(url, window.location.origin);
    if (next) {
      pageUrl.searchParams.set("before", next.created_at);
      pageUrl.searchParams.set("before_id", next.id);
    }
    const page = await apiRequest<{ orders: BillOrder[]; next_cursor: OrderCursor | null }>(pageUrl.pathname + pageUrl.search);
    orders.push(...page.orders);
    next = page.next_cursor;
  } while (next);
  return { orders };
}
