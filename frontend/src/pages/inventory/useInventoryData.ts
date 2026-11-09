import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";
import type { InventoryItem, MenuItem, RecipeComponent, StockLocation, StockMovement } from "./types";

export function useInventoryData(restaurantId: string | null) {
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError("");
    try {
      const root = `/api/restaurants/${restaurantId}`;
      const [locationResult, itemResult, movementResult, menuResult, recipeResult] = await Promise.all([
        apiRequest<{ locations: StockLocation[] }>(`${root}/stock/locations`),
        apiRequest<{ items: InventoryItem[] }>(`${root}/stock/items`),
        apiRequest<{ movements: StockMovement[] }>(`${root}/stock/movements?limit=500`),
        apiRequest<{ menus: MenuItem[] }>(`${root}/menus`),
        apiRequest<{ components: RecipeComponent[] }>(`${root}/menu-inventory-components`),
      ]);
      setLocations(locationResult.locations);
      setItems(itemResult.items);
      setMovements(movementResult.movements);
      setMenus(menuResult.menus);
      setRecipes(recipeResult.components);
    } catch {
      setError("โหลดข้อมูลคลังสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { locations, items, movements, menus, recipes, loading, error, refresh };
}
