import { client } from '../../api/client';
import { stopCharging, pollCommand, getFinalSession, getEvents } from './api';

export type StopResult = {
  commandId?: string | number;
  status: string;
  idempotentDuplicate?: boolean;
  session?: any;
  events?: any;
};

export async function stopChargingFlow({ chargeBoxId }: { chargeBoxId: string }): Promise<StopResult> {
  // Busca sessão ativa para obter transactionId; fallback: chargers/{cbid}.lastTransactionId
  const active = await client.get<any>(`/v1/sessions/active/${chargeBoxId}`).catch(() => undefined);
  let txId: number | undefined = active?.session?.transaction_id ?? active?.session?.transaction_pk;
  if (!txId) {
    const charger = await client.get<any>(`/v1/chargers/${chargeBoxId}`).catch(() => undefined);
    txId = charger?.lastTransactionId ?? charger?.last_transaction_id;
  }
  if (!txId) throw new Error('Nenhuma sessão ativa para parar');

  // Envia remoteStop preferindo incluir chargeBoxId (alguns backends validam ambos)
  let stop = await stopCharging({ transactionId: txId, chargeBoxId }).catch(async (e: any) => {
    // Fallback: se já estiver encerrada, tratar como sucesso idempotente
    const sess = await getFinalSession(txId).catch(() => undefined);
    const completed = !!sess?.session?.stopped_at || (sess?.session?.is_active === false);
    if (completed) {
      return { status: 'completed', id: undefined, idempotentDuplicate: true } as any;
    }
    throw e;
  });
  const commandId = stop?.commandId ?? (stop as any)?.id;

  // Poll do comando
  const final = await pollCommand(commandId || '', { timeoutMs: 180000, intervalMs: 1500 });
  // Tratar tanto 'accepted' quanto 'completed' como sucesso
  if (final.status !== 'accepted' && final.status !== 'completed') {
    return { commandId, status: final.status, idempotentDuplicate: final.idempotentDuplicate };
  }

  // Confirma sessão encerrada
  const session = await getFinalSession(txId);
  // Opcional: eventos StopTransaction
  const events = await getEvents(txId).catch(() => undefined);

  return { commandId, status: final.status, idempotentDuplicate: final.idempotentDuplicate, session, events };
}