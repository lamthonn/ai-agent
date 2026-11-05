// Calls to the backend. The token lives in localStorage; a 401 signs the user out.
// In development Vite proxies /api to the backend (vite.config.ts); set VITE_API_URL to point elsewhere.
import { useSyncExternalStore } from 'react';

const KEY = 'codesloop.token';
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

let token: string | null = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const hasToken = () => token !== null;
/** Re-renders when the user signs in or out. */
export const useSignedIn = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, hasToken, hasToken);

export function setToken(t: string | null) {
  token = t;
  try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* keep for this session */ }
  emit();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: { ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được tới backend (http://localhost:5099). Backend đã chạy chưa?');
  }
  if (res.status === 401 && path !== '/auth/login') { setToken(null); throw new ApiError(401, 'Phiên đăng nhập đã hết hạn.'); }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? (data?.errors ? data.errors.join('; ') : `Lỗi ${res.status}`));
  return data as T;
}

/** The server stores UTC without a zone marker on some columns; read them as UTC. */
export const utc = (s: string | null | undefined) => (s ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z') : null);
