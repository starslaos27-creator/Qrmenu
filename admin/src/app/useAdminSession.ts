import { useCallback, useEffect, useState } from "react";
import { adminLogout, adminRequest, saveAccessToken, type AdminUser } from "../shared/adminApi";

export type AdminSession = { user: AdminUser; adminRole: string };
export type AdminAuthState =
  | { status: "loading" }
  | { status: "login" }
  | { status: "bootstrap"; requiresToken: boolean }
  | { status: "ready"; session: AdminSession };

export function useAdminSession() {
  const [auth, setAuth] = useState<AdminAuthState>({ status: "loading" });

  const resolveSession = useCallback(async () => {
    try {
      const session = await adminRequest<AdminSession>("/api/admin/me");
      setAuth({ status: "ready", session });
    } catch {
      saveAccessToken(null);
      try {
        const result = await adminRequest<{ canBootstrap: boolean; requiresBootstrapToken?: boolean }>("/api/admin/bootstrap-status", {}, false);
        setAuth(result.canBootstrap ? { status: "bootstrap", requiresToken: result.requiresBootstrapToken === true } : { status: "login" });
      } catch {
        setAuth({ status: "login" });
      }
    }
  }, []);

  useEffect(() => { void resolveSession(); }, [resolveSession]);

  const completeLogin = useCallback(async (adminRole: string) => {
    try {
      const { user } = await adminRequest<{ user: AdminUser }>("/api/admin/me");
      setAuth({ status: "ready", session: { user, adminRole } });
    } catch {
      setAuth({ status: "login" });
    }
  }, []);

  const signOut = useCallback(async () => {
    await adminLogout();
    setAuth({ status: "login" });
  }, []);

  return { auth, completeLogin, completeBootstrap: () => setAuth({ status: "login" }), signOut };
}
