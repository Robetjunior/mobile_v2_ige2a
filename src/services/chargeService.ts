import { client } from '../api/client';
import { API_BASE, ensureApiKey } from '../api/http';

export type Snapshot = { status: string; connector?: string; updated_at?: string; wsOnline?: boolean };
export type SessionDetail = {
  session?: { transaction_id?: number; transaction_pk?: number; started_at?: string; stopped_at?: string; is_active?: boolean; id_tag?: string };
  telemetry?: { kwh?: number; power_kw?: number; voltage_v?: number; current_a?: number; soc_percent_at?: number; temperature_c?: number; transaction_id?: number; at?: string };
  progress?: { duration_seconds?: number; price_total?: number; energy_kwh?: number; price_unit?: number };
};

export async function getSnapshot(chargeBoxId: string): Promise<Snapshot> {
  try { return await client.get(`/v1/ocpp/${chargeBoxId}/snapshot`, { timeoutMs: 10000 }); } catch {
    return client.get(`/v1/chargers/${chargeBoxId}/snapshot`, { timeoutMs: 10000 });
  }
}

export async function getChargerMeta(chargeBoxId: string): Promise<any> {
  return client.get(`/v1/chargers/${chargeBoxId}`, { timeoutMs: 10000 });
}

export async function getActiveDetail(chargeBoxId: string): Promise<SessionDetail | undefined> {
  try { return await client.get(`/v1/sessions/active/${chargeBoxId}/detail`, { timeoutMs: 10000 }); } catch {
    return client.get(`/v1/sessions/active/${chargeBoxId}`, { timeoutMs: 10000 });
  }
}

export async function getProgress(transactionId: number): Promise<{ duration_seconds?: number; energy_kwh?: number; price_total?: number; price_unit?: number } | undefined> {
  return client.get(`/v1/sessions/${transactionId}/progress`, { timeoutMs: 10000 });
}

export async function getTelemetry(transactionId: number): Promise<any> {
  return client.get(`/v1/sessions/${transactionId}/telemetry`, { timeoutMs: 10000 });
}

export async function getSessionById(transactionId: number): Promise<SessionDetail | undefined> {
  return client.get(`/v1/sessions/${transactionId}`, { timeoutMs: 10000 });
}

export async function streamTelemetryForChargeBox(chargeBoxId: string): Promise<EventSource | null> {
  try {
    const apiKey = await ensureApiKey().catch(() => undefined);
    const params = new URLSearchParams();
    params.set('types', 'telemetry');
    params.set('chargeBoxId', String(chargeBoxId));
    params.set('pingMs', '20000');
    if (apiKey) params.set('apiKey', apiKey as string);
    const url = `${API_BASE}/v1/stream?${params.toString()}`;
    return new EventSource(url);
  } catch {
    return null;
  }
}

export async function pollCommand(id: string | number): Promise<any> {
  return client.get(`/v1/commands/${id}`, { timeoutMs: 10000 });
}

export { listChargers, getOnlineChargers, getOcppOnlineIds, updateChargerLocation } from '../api/chargeService';