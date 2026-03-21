const rawBase = import.meta.env.VITE_API_URL;
const API_BASE = rawBase 
  ? (rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/$/, '')}/api`)
  : '/api';

export type ApiError = { error: string };

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const { token, ...init } = options;
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : `${API_BASE}${cleanPath}`;
  
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, { ...init, headers });

    if (res.status === 401) {
      window.dispatchEvent(new Event('pilot:unauthorized'));
    }

    const data = await parseResponse<T | ApiError>(res);
    const errorBody = data && typeof data === 'object' ? ((data as any).error || (data as any).Error) : undefined;
    
    return {
      data: res.ok ? (data as T) : undefined,
      error: !res.ok ? (errorBody ?? (res.statusText || `Error ${res.status}`)) : undefined,
      status: res.status,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Network error",
      status: 0,
    };
  }
}

export function apiGet<T>(path: string, token: string | null) {
  return apiRequest<T>(path, { method: 'GET', token });
}

export function apiPost<T>(path: string, body: unknown, token: string | null) {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body), token });
}

export function apiPatch<T>(path: string, body: unknown, token: string | null) {
  return apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body), token });
}

export function apiDelete(path: string, token: string | null) {
  return apiRequest<unknown>(path, { method: 'DELETE', token });
}
