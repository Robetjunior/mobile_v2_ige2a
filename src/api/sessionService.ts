import { client } from './client';

export type UserSession = {
  id?: number | string;
  chargeBoxId?: string;
  chargerName?: string;
  started_at?: string;
  stopped_at?: string;
  duration_minutes?: number;
  energy_kwh?: number;
  price_total?: number;
  status?: string;
};

export async function getMySessions(): Promise<UserSession[]> {
  const res: any = await client.get('/v1/sessions/me', { timeoutMs: 15000 }).catch(async () => {
    return client.get('/me/sessions', { timeoutMs: 15000 });
  });
  const items: any[] = Array.isArray((res as any)?.items) ? (res as any).items : (Array.isArray(res) ? res : []);
  return items.map((it) => ({
    id: it?.id ?? it?.session_id ?? it?.transaction_id,
    chargeBoxId: it?.chargeBoxId ?? it?.cp_id ?? it?.charge_box_id,
    chargerName: it?.chargerName ?? it?.name ?? it?.station_name,
    started_at: it?.started_at ?? it?.startedAt,
    stopped_at: it?.stopped_at ?? it?.stoppedAt,
    duration_minutes: it?.duration_minutes ?? (typeof it?.duration_seconds === 'number' ? Math.round((it?.duration_seconds || 0) / 60) : undefined),
    energy_kwh: it?.energy_kwh ?? it?.kwh ?? it?.energyKwh,
    price_total: it?.price_total ?? it?.total_money ?? it?.totalMoney,
    status: it?.status ?? it?.state,
  }));
}