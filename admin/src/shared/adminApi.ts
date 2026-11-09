const ACCESS_TOKEN_KEY = "shopqr_access_token";
let accessToken = readAccessToken();
let refreshRequest: Promise<boolean> | null = null;

export class AdminApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "AdminApiError";
  }
}

export async function adminRequest<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  let response = await send(path, init, authenticated);
  if (response.status === 401 && authenticated && await refreshAccessToken()) {
    response = await send(path, init, true);
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new AdminApiError(response.status, typeof body?.error === "string" ? body.error : `HTTP_${response.status}`);
  return body as T;
}

export function saveAccessToken(token: string | null) {
  accessToken = token;
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch { /* The refresh cookie remains available when storage is blocked. */ }
}

export async function adminLogin(email: string, password: string) {
  const result = await adminRequest<{ accessToken: string; user: AdminUser; adminRole: string }>("/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, false);
  saveAccessToken(result.accessToken);
  return result;
}

export async function adminLogout() {
  try { await adminRequest("/api/auth/logout", { method: "POST" }); }
  finally { saveAccessToken(null); }
}

async function send(path: string, init: RequestInit, authenticated: boolean) {
  const headers = new Headers(init.headers);
  if (authenticated && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(path, { ...init, headers, credentials: "include" });
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshRequest) return refreshRequest;
  refreshRequest = (async () => {
    try {
      const response = await send("/api/auth/refresh", { method: "POST" }, false);
      if (!response.ok) { saveAccessToken(null); return false; }
      const body = await response.json() as { accessToken?: string };
      if (!body.accessToken) { saveAccessToken(null); return false; }
      saveAccessToken(body.accessToken);
      return true;
    } catch { return false; }
    finally { refreshRequest = null; }
  })();
  return refreshRequest;
}

function readAccessToken() {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY); }
  catch { return null; }
}

export interface AdminUser {
  id: string;
  email: string;
  display_name?: string | null;
  phone?: string | null;
  disabled_at?: string | null;
  disabled_reason?: string | null;
  password_migrated_at?: string | null;
  last_login_at?: string | null;
  failed_login_attempts?: number;
  unmatched_login_attempts?: number;
  restaurant_id?: string | null;
  restaurant_name?: string | null;
  restaurant_role?: string | null;
  is_admin?: boolean;
  created_at?: string;
}
