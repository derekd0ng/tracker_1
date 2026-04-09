// ── API client ─────────────────────────────────────────────────────────────
// Access token lives in memory (never localStorage) for security.
// Refresh token lives in an httpOnly cookie — the browser sends it automatically.

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void { accessToken = token; }
export function getAccessToken(): string | null { return accessToken; }

const BASE = import.meta.env.VITE_API_URL ?? '';

// Fired when a refresh attempt fails so App can redirect to login
export const AUTH_LOGOUT_EVENT = 'auth:logout';

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && !retried) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, options, true);
    setAccessToken(null);
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    throw new Error('Session expired — please log in again');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get:    <T = any>(path: string)              => request<T>(path),
  post:   <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'POST',   body: body !== undefined ? JSON.stringify(body) : undefined }),
  put:    <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',    body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string)              => request<T>(path, { method: 'DELETE' }),
};

export { tryRefresh };
