import { useCallback, useEffect, useState } from "react";
import { loadRestaurantSession } from "../../features/auth/session";
import { ApiError, apiRequest } from "../../shared/api/client";
import type { KitchenData, KitchenOrder } from "./types";

export function useKitchenData(onLogin: () => void, range: { from: string; to: string } | null) {
  const [data, setData] = useState<KitchenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const refreshOrders = useCallback(async (restaurantId: string, initial = false) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 7);
    const since = range ? new Date(`${range.from}T00:00:00+07:00`).toISOString() : sinceDate.toISOString();
    const until = range ? new Date(new Date(`${range.to}T00:00:00+07:00`).getTime() + 86_400_000).toISOString() : undefined;
    async function load(status: string, from: string | undefined, before: string | undefined) {
      const orders: KitchenOrder[] = [];
      type Cursor = { created_at: string; id: string };
      let cursor: Cursor | null = null;
      do {
        const query = new URLSearchParams({ status, limit: "500" });
        if (from) query.set("since", from);
        if (before) query.set("until", before);
        if (cursor) { query.set("before", cursor.created_at); query.set("before_id", cursor.id); }
        const page: { orders: KitchenOrder[]; next_cursor: Cursor | null } = await apiRequest(`/api/restaurants/${restaurantId}/orders?${query}`);
        orders.push(...page.orders);
        cursor = page.next_cursor;
      } while (cursor);
      return orders;
    }
    try {
      const [active, history] = await Promise.all([load("pending,ready", range ? since : undefined, until), load("served,cancelled", since, until)]);
      setData((current) => current ? {
        ...current,
        orders: active.sort((a, b) => a.created_at.localeCompare(b.created_at)),
        history,
      } : current);
      setUpdatedAt(new Date().toISOString());
      setError("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onLogin();
      else if (initial) setError(cause instanceof ApiError ? `โหลดรายการครัวไม่สำเร็จ (${cause.code})` : "โหลดรายการครัวไม่สำเร็จ กรุณาลองใหม่");
    }
  }, [onLogin, range]);

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
        const restaurantId = membership.restaurant_id;
        const [menus, tables, zones, members, restaurant] = await Promise.all([
          apiRequest<{ menus: KitchenData["menus"] }>(`/api/restaurants/${restaurantId}/menus`),
          apiRequest<{ tables: KitchenData["tables"] }>(`/api/restaurants/${restaurantId}/tables`),
          apiRequest<{ zones: KitchenData["zones"] }>(`/api/restaurants/${restaurantId}/zones`),
          apiRequest<{ members: Array<{ user_id: string; email: string }> }>(`/api/restaurants/${restaurantId}/members`),
          apiRequest<{ restaurant: { name: string; currency_code: "LAK" | "THB" | "USD"; kitchen_print_width?: number } }>(`/api/restaurants/${restaurantId}`),
        ]);
        if (cancelled) return;
        const memberEmails = Object.fromEntries(members.members.map((member) => [member.user_id, member.email]));
        const printWidth = [58, 76, 80].includes(restaurant.restaurant.kitchen_print_width ?? 58) ? restaurant.restaurant.kitchen_print_width ?? 58 : 58;
        setData({ restaurantId, restaurantName: restaurant.restaurant.name, currencyCode: restaurant.restaurant.currency_code ?? "LAK", role: membership.role, kitchenPrintWidth: printWidth as KitchenData["kitchenPrintWidth"], menus: menus.menus, tables: tables.tables, zones: zones.zones, memberEmails, orders: [], history: [] });
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) onLogin();
        else setError(cause instanceof ApiError ? `โหลดข้อมูลครัวไม่สำเร็จ (${cause.code})` : "โหลดข้อมูลครัวไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [onLogin]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let loadingRequest = false;
    const refresh = async (initial = false) => {
      if (loadingRequest || cancelled) return;
      loadingRequest = true;
      await refreshOrders(data.restaurantId, initial);
      loadingRequest = false;
    };
    void refresh(true);
    const timer = window.setInterval(() => void refresh(), 5000);
    const handleOrder = (event: Event) => {
      const order = (event as CustomEvent<KitchenOrder>).detail;
      if (!order || order.restaurant_id !== data.restaurantId) return;
      setData((current) => {
        if (!current) return current;
        const terminal = order.status === "served" || order.status === "cancelled";
        return {
          ...current,
          orders: terminal ? current.orders.filter((item) => item.id !== order.id) : upsert(current.orders, order),
          history: terminal ? upsert(current.history, order) : current.history.filter((item) => item.id !== order.id),
        };
      });
    };
    window.addEventListener("shopqr:order-confirmed", handleOrder);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("shopqr:order-confirmed", handleOrder);
    };
  }, [data?.restaurantId, refreshOrders]);

  return { data, setData, loading, error, setError, updatedAt, refresh: () => data && refreshOrders(data.restaurantId) };
}

function upsert(rows: KitchenOrder[], order: KitchenOrder) {
  return [order, ...rows.filter((item) => item.id !== order.id)];
}
