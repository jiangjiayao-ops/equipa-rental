const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('equipa_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem('equipa_token', token);
  else {
    window.localStorage.removeItem('equipa_token');
    window.localStorage.removeItem('equipa_role');
  }
}

export function setUserRole(role: string | null) {
  if (typeof window === 'undefined') return;
  if (role) window.localStorage.setItem('equipa_role', role);
  else window.localStorage.removeItem('equipa_role');
}

export function getUserRole(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem('equipa_role');
  if (stored) return stored;
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { role?: string };
    if (payload.role) {
      window.localStorage.setItem('equipa_role', payload.role);
      return payload.role;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function formatBrl(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(value: string | Date, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pt-BR').format(
    new Date(value),
  );
}
