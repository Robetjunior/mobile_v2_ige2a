import { http, API_BASE, ensureApiKey } from './http';
import { LOGGER } from '../utils/logger';

export type Snapshot = { status: string; connector?: string; updated_at?: string };
export type SessionDetail = {
  session?: { transaction_id?: number; started_at?: string };
  telemetry?: { kwh?: number; power_kw?: number; voltage_v?: number; current_a?: number; soc_percent_at?: number; temperature_c?: number; transaction_id?: number; at?: string };
  progress?: { duration_seconds?: number; price_total?: number; energy_kwh?: number; price_unit?: number };
};

export type CommandStatus = {
  id?: string | number;
  status: 'pending' | 'accepted' | 'rejected' | 'error' | 'completed' | string;
  idempotentDuplicate?: boolean;
};

export async function getSnapshot(cpId: string): Promise<Snapshot> {
  // Try OCPP snapshot; fallback to alternate charge status route if available
  try {
    return await http(`/v1/ocpp/${cpId}/snapshot`, { timeoutMs: 15000 });
  } catch (e: any) {
    if (e?.status === 404 || e?.status === 400) {
      try {
        return await http(`/charge/${cpId}/status`, { timeoutMs: 12000 });
      } catch {}
    }
    throw e;
  }
}

export async function getChargerMeta(cpId: string): Promise<{ id: string; name?: string }>
{
  return http(`/v1/chargers/${cpId}`, { timeoutMs: 15000 });
}

export async function getActiveDetail(cpId: string): Promise<SessionDetail> {
  // Tenta primeiro o endpoint com telemetria detalhada; se falhar, cai para o básico
  try {
    const res = await http(`/v1/sessions/active/${cpId}/detail`, { timeoutMs: 10000 });
    const num = (v: any, kind: 'float'|'int'): number | undefined => {
      if (typeof v === 'number') return v;
      if (v === null || typeof v === 'undefined') return undefined;
      const s = String(v);
      const n = kind === 'float' ? parseFloat(s) : parseInt(s);
      return Number.isFinite(n) ? n : undefined;
    };
    const tel = (res as any)?.telemetry || {};
    if (tel && Object.keys(tel).length > 0) {
      (res as any).telemetry = {
        kwh: num(tel?.kwh ?? tel?.meter_kwh, 'float'),
        power_kw: num(tel?.power_kw, 'float'),
        voltage_v: num(tel?.voltage_v, 'int'),
        current_a: num(tel?.current_a, 'float'),
        soc_percent_at: num(tel?.soc_percent_at ?? tel?.soc_pct, 'int'),
        temperature_c: num(tel?.temperature_c, 'float'),
        transaction_id: typeof tel?.transaction_id === 'number' ? tel.transaction_id : undefined,
        at: tel?.at ?? tel?.created_at,
      };
    }
    return res;
  } catch (e: any) {
    if (e?.status === 404 || e?.status === 400) {
      const res = await http(`/v1/sessions/active/${cpId}`, { timeoutMs: 10000 });
      const num = (v: any, kind: 'float'|'int'): number | undefined => {
        if (typeof v === 'number') return v;
        if (v === null || typeof v === 'undefined') return undefined;
        const s = String(v);
        const n = kind === 'float' ? parseFloat(s) : parseInt(s);
        return Number.isFinite(n) ? n : undefined;
      };
      const tel = (res as any)?.telemetry || {};
      if (tel && Object.keys(tel).length > 0) {
        (res as any).telemetry = {
          kwh: num(tel?.kwh ?? tel?.meter_kwh, 'float'),
          power_kw: num(tel?.power_kw, 'float'),
          voltage_v: num(tel?.voltage_v, 'int'),
          current_a: num(tel?.current_a, 'float'),
          soc_percent_at: num(tel?.soc_percent_at ?? tel?.soc_pct, 'int'),
          temperature_c: num(tel?.temperature_c, 'float'),
          transaction_id: typeof tel?.transaction_id === 'number' ? tel.transaction_id : undefined,
          at: tel?.at ?? tel?.created_at,
        };
      }
      return res;
    }
    throw e;
  }
}

export async function getProgress(txId: number): Promise<SessionDetail['progress']> {
  return http(`/v1/sessions/${txId}/progress`, { timeoutMs: 15000 });
}

// Telemetria canônica por transação (usa tabela telemetry_latest quando disponível)
export async function getTelemetry(txId: number): Promise<{ kwh?: number; duration_seconds?: number; started_at?: string; power_kw?: number; voltage_v?: number; current_a?: number; temperature_c?: number; soc_percent_at?: number; at?: string }> {
  const raw = await http(`/v1/sessions/${txId}/telemetry`, { timeoutMs: 12000 });
  const num = (v: any, kind: 'float'|'int'): number | undefined => {
    if (typeof v === 'number') return v;
    if (v === null || typeof v === 'undefined') return undefined;
    const s = String(v);
    const n = kind === 'float' ? parseFloat(s) : parseInt(s);
    return Number.isFinite(n) ? n : undefined;
  };
  const t = raw as any;
  return {
    kwh: num(t?.kwh ?? t?.meter_kwh, 'float'),
    duration_seconds: num(t?.duration_seconds, 'int'),
    started_at: typeof t?.started_at === 'string' ? t.started_at : undefined,
    power_kw: num(t?.power_kw, 'float'),
    voltage_v: num(t?.voltage_v, 'int'),
    current_a: num(t?.current_a, 'float'),
    temperature_c: num(t?.temperature_c, 'float'),
    soc_percent_at: num(t?.soc_percent_at ?? t?.soc_pct, 'int'),
    at: t?.at ?? t?.created_at,
  };
}

export async function remoteStart(body: { chargeBoxId: string; connectorId: number; idTag: string }): Promise<{ commandId?: string | number; status?: string }>
{
  LOGGER.API.info('remoteStart.request', { chargeBoxId: body.chargeBoxId, connectorId: body.connectorId, idTag: body.idTag });
  const res = await http(`/v1/commands/remoteStart`, { method: 'POST', body: JSON.stringify(body), timeoutMs: 15000 });
  LOGGER.API.info('remoteStart.response', { chargeBoxId: body.chargeBoxId, result: res });
  return res as any;
}

export async function remoteStop(body: { chargeBoxId?: string; transactionId: number }): Promise<{ commandId?: string | number; status?: string; idempotentDuplicate?: boolean }>
{
  // Alguns backends exigem chargeBoxId junto do transactionId
  LOGGER.API.info('remoteStop.request', { chargeBoxId: body.chargeBoxId, transactionId: body.transactionId });
  const payload = { transactionId: body.transactionId, ...(body.chargeBoxId ? { chargeBoxId: body.chargeBoxId } : {}) };
  const res = await http(`/v1/commands/remoteStop`, { method: 'POST', body: JSON.stringify(payload), timeoutMs: 15000 });
  LOGGER.API.info('remoteStop.response', { chargeBoxId: body.chargeBoxId, result: res });
  return res as any;
}

export async function getCommand(commandId: string | number): Promise<CommandStatus>
{
  return http(`/v1/commands/${commandId}`, { timeoutMs: 10000 });
}

export async function pollCommand(commandId: string | number, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<CommandStatus>
{
  // Poll até 180s por padrão, checando a cada 1.5s
  const timeoutMs = opts.timeoutMs ?? 180000;
  const intervalMs = opts.intervalMs ?? 1500;
  const start = Date.now();
  let last: CommandStatus = await getCommand(commandId).catch(() => ({ status: 'pending' }));
  while (!['accepted','rejected','error','completed'].includes(last.status)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timeout aguardando confirmação do CP');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await getCommand(commandId);
  }
  return last;
}

export async function getSessionById(transactionId: number): Promise<SessionDetail & { session: SessionDetail['session'] & { is_active?: boolean; stopped_at?: string; stop_reason?: string } }>
{
  return http(`/v1/sessions/${transactionId}`, { timeoutMs: 10000 });
}

export async function getStopEvents(transactionId: number): Promise<any>
{
  return http(`/v1/events?event_type=StopTransaction&transaction_pk=${transactionId}&limit=3`, { timeoutMs: 15000 });
}

export function streamEvents(): EventSource | null {
  if (typeof EventSource === 'undefined') return null;
  const url = `${API_BASE}/v1/stream`;
  try { return new EventSource(url); } catch { return null; }
}

/**
 * Abre um EventSource filtrado para um ChargeBox específico e autentica via query param.
 * Tipos padrão: telemetry-updated, status-change, heartbeat
 */
export async function streamTelemetryForChargeBox(chargeBoxId: string, opts: { types?: string[]; pingMs?: number } = {}): Promise<EventSource | null> {
  if (typeof EventSource === 'undefined') return null;
  const apiKey = await ensureApiKey().catch(() => undefined);
  const params = new URLSearchParams();
  params.set('cbid', chargeBoxId);
  params.set('types', (opts.types ?? ['telemetry-updated','status-change','heartbeat']).join(','));
  if (typeof opts.pingMs === 'number') params.set('pingMs', String(opts.pingMs));
  if (apiKey) params.set('apiKey', apiKey);
  const url = `${API_BASE}/v1/stream?${params.toString()}`;
  try {
    return new EventSource(url);
  } catch {
    return null;
  }
}