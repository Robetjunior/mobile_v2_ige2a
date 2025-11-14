import { client } from '../../api/client';
import { pollCommand } from '../../services/chargeService';

export type StartChargingBody = { chargeBoxId: string; idTag: string; connectorId?: number; force?: boolean };
export type StopChargingBody = { transactionId: number; chargeBoxId?: string };

export async function startCharging(body: StartChargingBody): Promise<{ commandId?: string | number; status?: string }>
{
  const payload = { chargeBoxId: body.chargeBoxId, idTag: body.idTag, ...(typeof body.connectorId === 'number' ? { connectorId: body.connectorId } : {}) };
  const path = body.force ? '/v1/commands/remoteStart?force=1' : '/v1/commands/remoteStart';
  return client.post(path, payload, { timeoutMs: 15000 });
}

export { pollCommand };

export async function getActiveSession(chargeBoxId: string): Promise<any> {
  return client.get(`/v1/sessions/active/${chargeBoxId}`, { timeoutMs: 10000 });
}

export async function getDetail(chargeBoxId: string): Promise<any> {
  // Algumas impls retornam telemetria em /active; outras em /active/:id/detail
  try { return await client.get(`/v1/sessions/active/${chargeBoxId}/detail`, { timeoutMs: 10000 }); } catch { return client.get(`/v1/sessions/active/${chargeBoxId}`, { timeoutMs: 10000 }); }
}

export async function stopCharging(body: StopChargingBody): Promise<{ commandId?: string | number; status?: string }>
{
  const payload = { transactionId: body.transactionId, ...(body.chargeBoxId ? { chargeBoxId: body.chargeBoxId } : {}) };
  return client.post('/v1/commands/remoteStop', payload, { timeoutMs: 15000 });
}

export async function getFinalSession(transactionId: number): Promise<any> {
  return client.get(`/v1/sessions/${transactionId}`, { timeoutMs: 10000 });
}

export async function getEvents(transactionId: number): Promise<any> {
  return client.get(`/v1/events?event_type=StopTransaction&transaction_pk=${transactionId}&limit=3&sort=desc`, { timeoutMs: 15000 });
}

export async function getLastTxByCbid(chargeBoxId: string): Promise<any> {
  return client.get(`/v1/debug/ocpp/last-tx/${chargeBoxId}`, { timeoutMs: 10000 });
}

