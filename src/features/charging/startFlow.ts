import { client } from '../../api/client';
import { startCharging, pollCommand, getActiveSession, getLastTxByCbid } from './api';
import { setJson } from '../../utils/storage';

export type StartResult = {
  commandId?: string | number;
  status: string;
  transactionId?: number;
  idempotentDuplicate?: boolean;
};

export async function validateOnlineAndSnapshot(chargeBoxId: string): Promise<void> {
  // Verifica lista online e snapshot específico
  try {
    const online = await client.get<any>('/v1/ocpp/online');
    const found = Array.isArray(online) ? online.find((x: any) => x?.charge_box_id === chargeBoxId) : undefined;
    const snap = await client.get<any>(`/v1/ocpp/${chargeBoxId}/snapshot`);
    const wsOnline = !!(found?.wsOnline ?? snap?.wsOnline);
    const available = ['Available', 'Preparing', 'SuspendedEV', 'Finishing'].includes(snap?.status);
    if (!wsOnline || !available) {
      const reason = !wsOnline ? 'CP offline' : 'Conector indisponível';
      throw new Error(`Pré-condição não satisfeita: ${reason}`);
    }
  } catch (e: any) {
    throw e;
  }
}

export async function startChargingFlow({ chargeBoxId, idTag, connectorId }: { chargeBoxId: string; idTag: string; connectorId?: number }): Promise<StartResult> {
  await validateOnlineAndSnapshot(chargeBoxId);
  // Envia remoteStart
  const body = { chargeBoxId, idTag, connectorId: typeof connectorId === 'number' ? connectorId : 1 };
  const start = await startCharging(body);
  const commandId = (start as any)?.commandId ?? (start as any)?.id;
  let status = (start as any)?.status ?? 'pending';
  // Poll até accepted | rejected | error | completed (backoff progressivo até ~180s)
  const final = await pollCommand(commandId || '', { timeoutMs: 180000, intervalMs: 1500 });
  status = final.status;
  // Tratar tanto 'accepted' quanto 'completed' como sucesso (idempotente)
  if (status !== 'accepted' && status !== 'completed') {
    return { commandId, status, idempotentDuplicate: final.idempotentDuplicate };
  }
  // Busca sessão ativa para obter transactionId
  let txId: number | undefined;
  const startAt = Date.now();
  while (!txId && Date.now() - startAt < 30000) {
    const active = await getActiveSession(chargeBoxId);
    txId = active?.session?.transaction_id;
    const idTagActive = active?.session?.id_tag;
    if (txId && idTagActive) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  // Fallback adicional: /v1/debug/ocpp/last-tx/:chargeBoxId
  if (!txId) {
    const last = await getLastTxByCbid(chargeBoxId).catch(() => undefined);
    txId = (last?.transaction_id ?? last?.txId ?? last?.tx_id) as number | undefined;
  }
  // Persistir para tela de sessão ativa
  if (txId) {
    await setJson(`ACTIVE_TX_${chargeBoxId}`, { transaction_id: txId, at: new Date().toISOString() });
  }
  return { commandId, status, transactionId: txId, idempotentDuplicate: final.idempotentDuplicate };
}