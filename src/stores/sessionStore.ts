import { create } from 'zustand';
import { SessionMetrics } from '../types';
import { startSession, stopSession } from '../services/chargerService';

type SessionState = {
  current?: SessionMetrics;
  loading: boolean;
  error?: string;
  start: (stationId: string) => Promise<void>;
  stop: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  current: undefined,
  loading: false,
  error: undefined,
  start: async (stationId: string) => {
    set({ loading: true, error: undefined });
    try {
      const s = await startSession(stationId);
      set({ current: s, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Erro ao iniciar sessão', loading: false });
    }
  },
  stop: async () => {
    const cur = get().current;
    if (!cur) return;
    set({ loading: true, error: undefined });
    try {
      await stopSession(cur.sessionId);
      set({ current: undefined, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Erro ao parar sessão', loading: false });
    }
  },
}));