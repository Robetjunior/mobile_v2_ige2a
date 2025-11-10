import { http, API_BASE } from './http';
import { LOGGER } from '../utils/logger';

export type Snapshot = { status: string; connector?: string; updated_at?: string };
export type SessionDetail = {
  session?: { transaction_id?: number; started_at?: string };
  telemetry?: { power_kw?: number; voltage_v?: number; current_a?: number; temperature_c?: number };
  progress?: { duration_min?: number; price_total?: number; energy_kwh?: number; price_unit?: number };
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
  // Align with backend: GET /v1/sessions/active/:chargeBoxId
  return http(`/v1/sessions/active/${cpId}`, { timeoutMs: 10000 });
}

export async function getProgress(txId: number): Promise<SessionDetail['progress']> {
  return http(`/v1/sessions/${txId}/progress`, { timeoutMs: 15000 });
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