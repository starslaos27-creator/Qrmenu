import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";
import type { MenuCategory, RestaurantMenu } from "./types";

export function useMenuData(restaurantId: string | null) {
  const [menus, setMenus] = useState<RestaurantMenu[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true); setError("");
    try {
      const root = `/api/restaurants/${restaurantId}`;
      const [menuResult, categoryResult] = await Promise.all([
        apiRequest<{ menus: RestaurantMenu[] }>(`${root}/menus`),
        apiRequest<{ categories: MenuCategory[] }>(`${root}/categories`),
      ]);
      setMenus(menuResult.menus); setCategories(categoryResult.categories);
    } catch { setError("โหลดรายการเมนูไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setLoading(false); }
  }, [restaurantId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { menus, categories, loading, error, refresh };
}
