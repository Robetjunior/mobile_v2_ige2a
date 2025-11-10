import { create } from 'zustand';
import { ChargerStation, NearbyQuery } from '../types';
import { listChargers } from '../services/chargerService';
import { LOGGER } from '../utils/logger';

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
};

export const useStationStore = create<StationState>((set) => ({
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
}));