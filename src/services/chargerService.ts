import { http, API_BASE } from './http';
import { ChargerStation, NearbyQuery, SessionMetrics } from '../types';
import { LOGGER } from '../utils/logger';

export async function getNearby(q: NearbyQuery): Promise<ChargerStation[]> {
  // Orchestrator: /v1/charge-points/near?lat&lon&maxKm&limit
  const params = new URLSearchParams({
    lat: String(q.lat),
    lon: String(q.lon),
    maxKm: String(q.radiusKm),
    limit: String(q.limit ?? 50),
  });
  if (typeof q.offset === 'number') params.set('offset', String(q.offset));
  if (typeof q.page === 'number') params.set('page', String(q.page));
  LOGGER.API.info('getNearby.params', { lat: q.lat, lon: q.lon, maxKm: q.radiusKm, limit: q.limit ?? 50, offset: q.offset, page: q.page });
  const res = await http<{ items: any[] }>(`/v1/charge-points/near?${params.toString()}`, { timeoutMs: 15000 });
  const items = Array.isArray((res as any)?.items) ? (res as any).items : Array.isArray(res as any) ? (res as any) : [];
  return items.map((it: any) => ({
    id: String(it.id ?? it.charge_box_id ?? it.cp_id ?? Math.random().toString(36).slice(2)),
    name: String(it.nome ?? it.name ?? it.station_name ?? `CP ${it.id}`),
    address: it.endereco ?? it.address ?? undefined,
    latitude: Number(it.latitude),
    longitude: Number(it.longitude),
    distanceKm: typeof it.distance_km === 'number' ? it.distance_km : (typeof it.distanceKm === 'number' ? it.distanceKm : undefined),
    status: (it.status as any) || 'unknown',
    powerKw: typeof it.power_kw === 'number' ? it.power_kw : (typeof it.powerKw === 'number' ? it.powerKw : undefined),
    pricePerKwh: typeof it.price_per_kwh === 'number' ? it.price_per_kwh : (typeof it.pricePerKwh === 'number' ? it.pricePerKwh : undefined),
  }));
}

export async function getInBounds(b: { latMin: number; latMax: number; lonMin: number; lonMax: number; limit?: number }): Promise<ChargerStation[]> {
  const params = new URLSearchParams({
    latMin: String(b.latMin),
    latMax: String(b.latMax),
    lonMin: String(b.lonMin),
    lonMax: String(b.lonMax),
    ...(b.limit ? { limit: String(b.limit) } : {}),
  } as any);
  const res = await http<{ items: any[] }>(`/v1/charge-points/in-bounds?${params.toString()}`, { timeoutMs: 15000 });
  const items = Array.isArray((res as any)?.items) ? (res as any).items : Array.isArray(res as any) ? (res as any) : [];
  return items.map((it: any) => ({
    id: String(it.id ?? it.charge_box_id ?? it.cp_id ?? Math.random().toString(36).slice(2)),
    name: String(it.nome ?? it.name ?? it.station_name ?? `CP ${it.id}`),
    address: it.endereco ?? it.address ?? undefined,
    latitude: Number(it.latitude),
    longitude: Number(it.longitude),
    distanceKm: typeof it.distance_km === 'number' ? it.distance_km : (typeof it.distanceKm === 'number' ? it.distanceKm : undefined),
    status: (it.status as any) || 'unknown',
    powerKw: typeof it.power_kw === 'number' ? it.power_kw : (typeof it.powerKw === 'number' ? it.powerKw : undefined),
    pricePerKwh: typeof it.price_per_kwh === 'number' ? it.price_per_kwh : (typeof it.pricePerKwh === 'number' ? it.pricePerKwh : undefined),
  }));
}

export async function getCharger(id: string): Promise<ChargerStation> {
  return http(`/v1/chargers/${id}`, { timeoutMs: 15000 });
}

export async function getOnlineChargers(params: { sinceMinutes?: number; limit?: number } = {}): Promise<ChargerStation[]> {
  const query = new URLSearchParams();
  if (params.sinceMinutes) query.set('sinceminutes', String(params.sinceMinutes));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return http(`/v1/chargers/online${suffix}`, { timeoutMs: 15000 });
}

export async function getOcppOnlineIds(): Promise<string[]> {
  return http(`/v1/ocpp/online`, { timeoutMs: 15000 });
}

export async function startSession(stationId: string): Promise<SessionMetrics> {
  return http(`/sessions/start`, {
    method: 'POST',
    body: JSON.stringify({ stationId }),
    timeoutMs: 15000,
  });
}

export async function stopSession(sessionId: string): Promise<void> {
  return http(`/sessions/${sessionId}/stop`, { method: 'POST', timeoutMs: 15000 });
}

export async function updateChargerLocation(chargeBoxId: string, loc: { lat: number; lon: number }): Promise<{ ok: boolean }>
{
  return http(`/v1/chargers/${chargeBoxId}/location`, {
    method: 'PATCH',
    body: JSON.stringify(loc),
    timeoutMs: 10000,
  });
}

// Lista chargers com coordenadas e status geral (overallStatus)
export async function listChargers(params: { lat: number; lon: number; radiusKm: number; limit?: number }): Promise<ChargerStation[]> {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lon: String(params.lon),
    radiusKm: String(params.radiusKm),
    limit: String(params.limit ?? 500),
  });
  LOGGER.API.info('listChargers.params', { lat: params.lat, lon: params.lon, radiusKm: params.radiusKm, limit: params.limit ?? 500 });
  const res = await http<any[]>(`/v1/chargers?${query.toString()}`, { timeoutMs: 15000 });
  const items = Array.isArray(res) ? res : (Array.isArray((res as any)?.items) ? (res as any).items : []);
  const toStatus = (overall?: string): 'available' | 'busy' | 'offline' | 'unknown' => {
    const s = String(overall || '').toLowerCase();
    if (['available','preparing','suspendedev','finishing','ready'].includes(s)) return 'available';
    if (['charging','busy','occupied'].includes(s)) return 'busy';
    if (['faulted','unavailable','offline'].includes(s)) return 'offline';
    return 'unknown';
  };
  return items.map((it: any) => ({
    id: String(it.chargeBoxId ?? it.id ?? Math.random().toString(36).slice(2)),
    name: String(it.name ?? it.station_name ?? it.chargeBoxId ?? 'Charger'),
    address: it.address ?? it.endereco ?? undefined,
    latitude: Number(it.coords?.lat ?? it.latitude),
    longitude: Number(it.coords?.lon ?? it.longitude),
    status: toStatus(it.overallStatus ?? it.status),
    powerKw: typeof it.powerKw === 'number' ? it.powerKw : (typeof it.power_kw === 'number' ? it.power_kw : undefined),
    pricePerKwh: typeof it.pricePerKwh === 'number' ? it.pricePerKwh : (typeof it.price_per_kwh === 'number' ? it.price_per_kwh : undefined),
    distanceKm: typeof it.distanceKm === 'number' ? it.distanceKm : (typeof it.distance_km === 'number' ? it.distance_km : undefined),
  }));
}

export function createEventSource(path: string): EventSource | null {
  if (typeof EventSource === 'undefined') return null;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;
  try { return new EventSource(url); } catch { return null; }
}