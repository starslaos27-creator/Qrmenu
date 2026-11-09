import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";
import type { DiningTable, DiningZone } from "./types";

export function useTablesData(restaurantId: string | null) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [zones, setZones] = useState<DiningZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true); setError("");
    try {
      const root = `/api/restaurants/${restaurantId}`;
      const [tableResult, zoneResult] = await Promise.all([
        apiRequest<{ tables: DiningTable[] }>(`${root}/tables`),
        apiRequest<{ zones: DiningZone[] }>(`${root}/zones`),
      ]);
      setTables(tableResult.tables); setZones(zoneResult.zones);
    } catch { setError("โหลดข้อมูลโต๊ะไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setLoading(false); }
  }, [restaurantId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { tables, zones, loading, error, refresh };
}
