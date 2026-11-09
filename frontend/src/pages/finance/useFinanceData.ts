import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../shared/api/client";
import type { FinanceAccess, FinanceLedger, FinanceWorkspace } from "./types";
import { setFinanceCurrency } from "./utils";

export function useFinanceData(restaurantId: string | null, from: string, to: string, kind: string, page: number, refreshKey: number) {
  const [access, setAccess] = useState<FinanceAccess | null>(null);
  const [workspace, setWorkspace] = useState<FinanceWorkspace | null>(null);
  const [ledger, setLedger] = useState<FinanceLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!restaurantId || !from || !to) return;
    setLoading(true); setError("");
    const base = `/api/restaurants/${restaurantId}/finance`;
    try {
      const [accessResult, workspaceResult, ledgerResult] = await Promise.all([
        apiRequest<FinanceAccess>(`${base}/access`),
        apiRequest<FinanceWorkspace>(`${base}/workspace?from=${from}&to=${to}`),
        apiRequest<FinanceLedger>(`${base}?from=${from}&to=${to}&kind=${kind}&page=${page}`),
      ]);
      setAccess(accessResult); setWorkspace(workspaceResult); setFinanceCurrency(workspaceResult.config.currency); setLedger({ ...ledgerResult, entries: ledgerResult.entries.map((entry) => ({ ...entry, entryId: entry.id })) });
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "FORBIDDEN" ? "บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลการเงิน" : "โหลดข้อมูลการเงินไม่สำเร็จ กรุณาลองใหม่");
    } finally { setLoading(false); }
  }, [restaurantId, from, to, kind, page, refreshKey]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { access, workspace, ledger, loading, error, refresh };
}
