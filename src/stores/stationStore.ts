import { create } from 'zustand';
import { ChargerStation, NearbyQuery } from '../types';
import { listChargers } from '../services/chargerService';
import { LOGGER } from '../utils/logger';
import { API_BASE, ensureApiKey } from '../services/http';

type StationState = {
  items: ChargerStation[];
  loading: boolean;
  error?: string;
  lastStatusCode?: number;
  radiusKm: number;
  search: string;
  status?: ('available' | 'busy' | 'offline')[];
  minPowerKw?: number;
  fetchNearby: (q: NearbyQuery) => Promise<void>;
  setRadius: (r: number) => void;
  setSearch: (s: string) => void;
  setFilters: (f: { status?: StationState['status']; minPowerKw?: number }) => void;
  setItems: (items: ChargerStation[]) => void;
  subscribeStatusChanges: () => Promise<void>;
  unsubscribeStatusChanges: () => void;
};

let statusSse: EventSource | null = null;
let statusSseReconnect: NodeJS.Timeout | null = null;

export const useStationStore = create<StationState>((set, get) => ({
  items: [],
  loading: false,
  error: undefined,
  lastStatusCode: undefined,
  radiusKm: 100,
  search: '',
  status: undefined,
  minPowerKw: undefined,
  fetchNearby: async (q) => {
    // Sempre iniciar com um código conhecido (0 = sem resposta ainda)
    set({ loading: true, error: undefined, lastStatusCode: 0 });
    const startMs = Date.now();
    LOGGER.API.info('fetchNearby.start', { lat: q.lat, lon: q.lon, radiusKm: q.radiusKm, limit: q.limit ?? 500, search: q.search, status: q.status, minPowerKw: q.minPowerKw });
    try {
      const mappedLimit = q.limit ?? 500;
      const result = await listChargers({ lat: q.lat, lon: q.lon, radiusKm: q.radiusKm, limit: mappedLimit });
      set({ items: result, loading: false, lastStatusCode: 200 });
      LOGGER.API.info('fetchNearby.success', { count: result.length, status: 200, durationMs: Date.now() - startMs, lat: q.lat, lon: q.lon, radiusKm: q.radiusKm });
    } catch (e: any) {
      set({ error: e?.message || 'Erro ao carregar estações', loading: false, lastStatusCode: typeof e?.status === 'number' ? e.status : 0 });
      LOGGER.API.info('fetchNearby.error', { message: e?.message, status: e?.status, durationMs: Date.now() - startMs, lat: q.lat, lon: q.lon, radiusKm: q.radiusKm });
    }
  },
  setRadius: (r) => set({ radiusKm: r }),
  setSearch: (s) => set({ search: s }),
  setFilters: (f) => set({ status: f.status, minPowerKw: f.minPowerKw }),
  setItems: (items) => set({ items }),
  subscribeStatusChanges: async () => {
    if (statusSse) return;
    const apiKey = await ensureApiKey().catch(() => undefined);
    const params = new URLSearchParams();
    params.set('types', 'status-change');
    params.set('pingMs', '20000');
    if (apiKey) params.set('apiKey', apiKey as string);
    const url = `${API_BASE}/v1/stream?${params.toString()}`;
    try {
      const es = new EventSource(url);
      statusSse = es;
      const toStatus = (overall?: string): 'available' | 'busy' | 'offline' | 'unknown' => {
        const s = String(overall || '').toLowerCase();
        if (['available','preparing','suspendedev','finishing','ready'].includes(s)) return 'available';
        if (['charging','busy','occupied'].includes(s)) return 'busy';
        if (['faulted','unavailable','offline'].includes(s)) return 'offline';
        return 'unknown';
      };
      es.addEventListener('status-change', (evt: MessageEvent) => {
        try {
          const data = JSON.parse((evt as any).data || '{}');
          const id = String(data?.chargeBoxId || data?.id || '');
          const next = toStatus(data?.status);
          if (!id) return;
          const items = get().items;
          if (!items || items.length === 0) return;
          const updated = items.map((it) => (it.id === id ? { ...it, status: next } : it));
          set({ items: updated });
        } catch {}
      });
      es.addEventListener('error', () => {
        try { statusSse?.close?.(); } catch {}
        statusSse = null;
        if (statusSseReconnect) clearTimeout(statusSseReconnect);
        statusSseReconnect = setTimeout(() => { void get().subscribeStatusChanges(); }, 5000);
      });
    } catch {}
  },
  unsubscribeStatusChanges: () => {
    try { statusSse?.close?.(); } catch {}
    statusSse = null;
    if (statusSseReconnect) clearTimeout(statusSseReconnect);
    statusSseReconnect = null;
  },
}));
