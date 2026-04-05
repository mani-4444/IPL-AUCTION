// Persist session across page refreshes so reconnect works.

const KEY = 'ipl_session';

export interface SessionData {
  roomId: string;
  userId: string;
  roomStatus: 'waiting' | 'auction' | 'team-setup' | 'results';
}

export function saveSession(data: SessionData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function loadSession(): SessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
