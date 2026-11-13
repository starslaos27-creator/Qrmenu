const ACCESS_TOKEN_KEY = "shopqr_access_token";
const AUTH_CHANGED_EVENT = "shopqr:auth-changed";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken = readAccessToken();
let refreshRequest: Promise<boolean> | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== ACCESS_TOKEN_KEY) return;
    accessToken = event.newValue;
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  });
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> {
  const auth = options.auth !== false;
  const tokenUsed = accessToken;
  let response = await send(path, init, auth);

  if (response.status === 401 && auth && await refreshAccessToken(tokenUsed)) {
    response = await send(path, init, true);
  }

  return parseResponse<T>(response);
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function saveAccessToken(token: string) {
  setAccessToken(token);
}

async function send(path: string, init: RequestInit, auth: boolean) {
  const headers = new Headers(init.headers);
  if (auth && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const isLocalHost = typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const apiUrl = isLocalHost ? "" : import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ?? "";
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

async function refreshAccessToken(rejectedToken: string | null): Promise<boolean> {
  if (refreshRequest) return refreshRequest;

  refreshRequest = (async () => {
    const refresh = async () => {
      const latestToken = readAccessToken();
      if (latestToken && latestToken !== rejectedToken) {
        accessToken = latestToken;
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
        return true;
      }

      try {
        const response = await send("/api/auth/refresh", { method: "POST" }, false);
        if (!response.ok) {
          setAccessToken(null);
          return false;
        }

        const result = await response.json() as { accessToken?: string };
        if (!result.accessToken) {
          setAccessToken(null);
          return false;
        }

        setAccessToken(result.accessToken);
        return true;
      } catch {
        return false;
      }
    };

    let refreshStarted = false;
    const runRefresh = () => { refreshStarted = true; return refresh(); };
    try {
      if (typeof navigator !== "undefined" && navigator.locks?.request) {
        try {
          return await navigator.locks.request("shopqr-auth-refresh", runRefresh);
        } catch (error) {
          if (refreshStarted) throw error;
          return await runRefresh();
        }
      }
      return await runRefresh();
    } finally {
      refreshRequest = null;
    }
  })();

  return refreshRequest;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = response.status === 204
    ? null
    : await response.json().catch(() => null) as Record<string, unknown> | null;

  if (!response.ok) {
    const code = typeof body?.error === "string" ? body.error : `HTTP_${response.status}`;
    throw new ApiError(response.status, code);
  }

  return body as T;
}

function readAccessToken() {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setAccessToken(token: string | null) {
  accessToken = token;
  try {
    if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Authentication can still use the refresh cookie when storage is unavailable.
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
