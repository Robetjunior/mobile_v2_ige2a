import { client } from '../../api/client';
import { startCharging, getActiveSession, getLastTxByCbid } from './api';
import { setJson } from '../../utils/storage';

export type StartResult = {
  commandId?: string | number;
  status: string;
  transactionId?: number;
  idempotentDuplicate?: boolean;
};

export async function validateOnlineAndSnapshot(chargeBoxId: string): Promise<{ wsOnline?: boolean; status?: string } | undefined> {
  // Verifica lista online e snapshot específico de forma NÃO BLOQUEANTE.
  // Mesmo que o snapshot reporte indisponível, tentamos o RemoteStart (como nos testes via PowerShell).
  try {
    const online = await client.get<any>('/v1/ocpp/online').catch(() => undefined);
    const found = Array.isArray(online) ? online.find((x: any) => x?.charge_box_id === chargeBoxId) : undefined;
    const snap = await client.get<any>(`/v1/ocpp/${chargeBoxId}/snapshot`).catch(() => undefined);
    const wsOnline = !!(found?.wsOnline ?? snap?.wsOnline);
    const status = snap?.status as string | undefined;
    return { wsOnline, status };
  } catch {
    return undefined;
  }
}

export async function startChargingFlow({ chargeBoxId, idTag, connectorId }: { chargeBoxId: string; idTag: string; connectorId?: number }): Promise<StartResult> {
  // Pré-checagem suave: não bloqueia se indisponível
  await validateOnlineAndSnapshot(chargeBoxId).catch(() => undefined);
  // Envia remoteStart
  const body = { chargeBoxId, idTag, connectorId: typeof connectorId === 'number' ? connectorId : 1, force: true };
  const start = await startCharging(body);
  const commandId = (start as any)?.commandId ?? (start as any)?.id;
  const idempotentDuplicate = (start as any)?.idempotentDuplicate;
  let status = (start as any)?.status ?? 'pending';
  // Evita poll de comando: trata 'sent', 'accepted' e 'completed' como avanço válido.
  // Se rejeitado/erro, retorna imediatamente.
  if (['rejected','error'].includes(status)) {
    return { commandId, status, idempotentDuplicate };
  }
  // Busca sessão ativa para obter transactionId
  let txId: number | undefined;
  const startAt = Date.now();
  while (!txId && Date.now() - startAt < 90000) {
    const active = await getActiveSession(chargeBoxId);
    txId = active?.session?.transaction_id;
    // Não exigir id_tag para confirmar a sessão ativa: alguns backends não retornam id_tag nesta rota.
    if (txId) break;
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
  return { commandId, status, transactionId: txId, idempotentDuplicate };
}