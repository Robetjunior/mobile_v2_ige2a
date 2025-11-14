import { client } from '../../api/client';
import { stopCharging, getFinalSession, getEvents } from './api';

export type StopResult = {
  commandId?: string | number;
  status: string;
  idempotentDuplicate?: boolean;
  session?: any;
  events?: any;
};

export async function stopChargingFlow({ chargeBoxId, transactionId }: { chargeBoxId: string; transactionId?: number }): Promise<StopResult> {
  // Usa transactionId fornecido quando disponível; caso contrário, busca sessão ativa e fallback para último tx
  let txId: number | undefined = typeof transactionId === 'number' ? transactionId : undefined;
  if (!txId) {
    const active = await client.get<any>(`/v1/sessions/active/${chargeBoxId}`).catch(() => undefined);
    txId = active?.session?.transaction_id ?? active?.session?.transaction_pk;
  }
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
  const stopStatus = (stop as any)?.status ?? 'pending';
  // Se rejeitado/erro, retorna imediatamente
  if (['rejected','error'].includes(stopStatus)) {
    return { commandId, status: stopStatus };
  }
  // Confirma sessão encerrada via /v1/sessions/:tx com polling leve
  let session = await getFinalSession(txId).catch(() => undefined);
  const startedAt = Date.now();
  while (!((session?.session?.stopped_at) || (session?.session?.is_active === false)) && Date.now() - startedAt < 90000) {
    await new Promise((r) => setTimeout(r, 2000));
    session = await getFinalSession(txId).catch(() => undefined);
  }
  // Opcional: eventos StopTransaction
  const events = await getEvents(txId).catch(() => undefined);
  const finalStatus = ((session?.session?.stopped_at) || (session?.session?.is_active === false)) ? 'completed' : stopStatus;
  return { commandId, status: finalStatus, session, events };
}