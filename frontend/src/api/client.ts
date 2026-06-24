import Constants from 'expo-constants';
import { PlayerState } from '@/src/game/types';

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || (Constants?.expoConfig?.extra as any)?.backendUrl || '').replace(/\/$/, '');
const API = `${BASE_URL}/api`;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  createPlayer: (params: { name: string; aptitude: string; recommended_aptitude?: string; learning_goal?: string; codex_depth?: string }) =>
    http<PlayerState>('/player', { method: 'POST', body: JSON.stringify(params) }),
  getPlayer: (id: string) => http<PlayerState>(`/player/${id}`),
  updatePlayer: (id: string, patch: Partial<PlayerState>) =>
    http<PlayerState>(`/player/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
};
