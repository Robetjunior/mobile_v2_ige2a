import { create } from 'zustand';
import { SessionMetrics } from '../types';
import { startChargingFlow } from '../features/charging/startFlow';
import { stopChargingFlow } from '../features/charging/stopFlow';
import { getActiveDetail, getProgress, getSessionById } from '../services/chargeService';
import { LOGGER } from '../utils/logger';

type SessionState = {
  current?: SessionMetrics;
  loading: boolean;
  error?: string;
  start: (stationId: string) => Promise<void>;
  stop: () => Promise<void>;
};

let pollTimer: NodeJS.Timeout | null = null;

export const useSessionStore = create<SessionState>((set, get) => ({
  current: undefined,
  loading: false,
  error: undefined,
  start: async (stationId: string) => {
    set({ loading: true, error: undefined });
    try {
      // Inicia via RemoteStart; idTag padrão para MVP
      const res = await startChargingFlow({ chargeBoxId: stationId, idTag: 'DEMO-123456', connectorId: 1 });
      if (!['accepted','completed','sent'].includes(res.status)) {
        throw new Error(`Start não aceito: ${res.status}`);
      }
      // Espera sessão ativa
      let active = await getActiveDetail(stationId).catch(() => undefined);
      const startWait = Date.now();
      while (!(active?.session?.transaction_id) && Date.now() - startWait < 30000) {
        await new Promise((r) => setTimeout(r, 1500));
        active = await getActiveDetail(stationId).catch(() => undefined);
      }
      const tx = active?.session?.transaction_id as number | undefined;
      if (!tx) throw new Error('Sessão não foi ativada');
      const prog = await getProgress(tx).catch(() => undefined);
      const sess = await getSessionById(tx).catch(() => undefined);
      const metrics: SessionMetrics = {
        sessionId: String(tx),
        stationId,
        energyKwh: Number(prog?.energy_kwh ?? 0),
        powerKw: Number(sess?.telemetry?.power_kw ?? 0),
        durationMinutes: typeof prog?.duration_min === 'number' ? prog!.duration_min! : Math.round((Number(prog?.duration_seconds ?? 0) / 60) * 100) / 100,
        startedAt: String(active?.session?.started_at ?? new Date().toISOString()),
      };
      set({ current: metrics, loading: false });
      // Inicia polling leve de progresso/telemetria
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      pollTimer = setInterval(async () => {
        try {
          const txId = Number(get().current?.sessionId);
          if (!txId) return;
          const p = await getProgress(txId).catch(() => undefined);
          const s2 = await getSessionById(txId).catch(() => undefined);
          const updated: SessionMetrics = {
            sessionId: String(txId),
            stationId,
            energyKwh: Number(p?.energy_kwh ?? get().current?.energyKwh ?? 0),
            powerKw: Number(s2?.telemetry?.power_kw ?? get().current?.powerKw ?? 0),
            durationMinutes: typeof p?.duration_min === 'number' ? p!.duration_min! : Math.round((Number(p?.duration_seconds ?? 0) / 60) * 100) / 100,
            startedAt: String(active?.session?.started_at ?? get().current?.startedAt ?? new Date().toISOString()),
          };
          set({ current: updated });
          const completed = !!s2?.session?.stopped_at || s2?.session?.is_active === false || s2?.status === 'completed';
          if (completed && pollTimer) {
            clearInterval(pollTimer); pollTimer = null;
            set({ current: undefined });
          }
        } catch (e: any) {
          // silencioso no polling
        }
      }, 3000);
    } catch (e: any) {
      set({ error: e?.message || 'Erro ao iniciar sessão', loading: false });
    }
  },
  stop: async () => {
    const cur = get().current;
    if (!cur) return;
    set({ loading: true, error: undefined });
    try {
      const txId = Number(cur.sessionId);
      LOGGER.API.info('remoteStop.home.flow', { txId, chargeBoxId: cur.stationId });
      const res = await stopChargingFlow({ chargeBoxId: cur.stationId, transactionId: txId });
      // Aceitar 'pending' como estado transitório e confirmar via sessão
      if (!['accepted','completed','pending'].includes(res.status)) throw new Error(`Stop não aceito: ${res.status}`);
      // Confirma encerramento
      let sess = await getSessionById(txId).catch(() => undefined);
      const startWait = Date.now();
      while (!(sess?.session?.stopped_at) && sess?.session?.is_active !== false && Date.now() - startWait < 30000) {
        await new Promise((r) => setTimeout(r, 1500));
        sess = await getSessionById(txId).catch(() => undefined);
      }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      set({ current: undefined, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Erro ao parar sessão', loading: false });
    }
  },
}));