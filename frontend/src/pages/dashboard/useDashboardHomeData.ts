import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "../../shared/api/client";

export interface DashboardSummary {
  todayRevenue: number;
  todayPaidCount: number;
  pendingCount: number;
  readyCount: number;
  servedCount: number;
  cancelledCount: number;
  unpaidTableCount: number;
  unpaidTotal: number;
  callCount: number;
  recentOrders: RecentOrder[];
}

export interface RecentOrder {
  id: string;
  tableNumber: string | number | null;
  status: string;
  total: number;
  paid: boolean;
  createdAt: string;
}

export interface DashboardTable {
  id: string;
  table_number: string | number;
  is_open: boolean;
}

export interface DashboardMenu {
  id: string;
  category_id: string | null;
  price: number;
}

export interface DashboardCategory {
  id: string;
  name: string;
}

export interface LowStockItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minimum_stock: number;
  active: boolean;
  track_stock: boolean;
}

export interface DashboardHomeData {
  summary: DashboardSummary;
  tables: DashboardTable[] | null;
  orders: Array<{ id: string; table_id: string; paid: boolean; status: string; total: number; created_at: string }> | null;
  menus: DashboardMenu[] | null;
  categories: DashboardCategory[] | null;
  items: LowStockItem[] | null;
}

export function useDashboardHomeData(restaurantId: string | undefined, role: string) {
  const [data, setData] = useState<DashboardHomeData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  const refresh = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!restaurantId) return;
    let disposed = false;
    setData(null);
    setError(false);
    const root = `/api/restaurants/${restaurantId}`;
    const owner = role === "owner";
    const canStock = ["owner", "cook", "staff"].includes(role);
    const requests: Array<[keyof Omit<DashboardHomeData, "summary"> | "summary", string]> = [
      ["summary", "/dashboard-summary"],
      ["tables", "/tables"],
      ["orders", "/orders?limit=500"],
      ...(owner ? [["menus", "/menus"], ["categories", "/categories"]] as Array<["menus" | "categories", string]> : []),
      ...(canStock ? [["items", "/stock/items?lowStock=true"]] as Array<["items", string]> : []),
    ];

    async function load() {
      const results = await Promise.allSettled(requests.map(async ([key, path]) => {
        const payload = await apiRequest<Record<string, unknown>>(root + path);
        return [key, payload[key]] as const;
      }));
      if (disposed) return;
      const summaryResult = results[0];
      if (summaryResult.status === "rejected") {
        setError(true);
        return;
      }
      const next: Partial<DashboardHomeData> = {};
      results.forEach((result, index) => {
        const key = requests[index][0];
        if (result.status === "fulfilled") {
          const [, value] = result.value;
          if (key === "summary") next.summary = (value as { summary: DashboardSummary }).summary;
          else if (key === "tables") next.tables = (value as { tables: DashboardTable[] }).tables;
          else if (key === "orders") next.orders = (value as { orders: DashboardHomeData["orders"] }).orders;
          else if (key === "menus") next.menus = (value as { menus: DashboardMenu[] }).menus;
          else if (key === "categories") next.categories = (value as { categories: DashboardCategory[] }).categories;
          else if (key === "items") next.items = (value as { items: LowStockItem[] }).items;
        } else if (key !== "summary") {
          if (key === "tables") next.tables = null;
          if (key === "orders") next.orders = null;
          if (key === "menus") next.menus = null;
          if (key === "categories") next.categories = null;
          if (key === "items") next.items = null;
        }
      });
      if (!next.summary) {
        setError(true);
        return;
      }
      setData(next as DashboardHomeData);
      setError(false);
    }

    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [restaurantId, role, retry]);

  return { data, error, refresh };
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
