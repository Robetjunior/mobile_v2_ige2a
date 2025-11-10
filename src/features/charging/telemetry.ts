import { client } from '../../api/client';

export type TelemetrySample = {
  transaction_id?: number;
  kwh?: number;
  power_kw?: number;
  voltage_v?: number;
  current_a?: number;
  soc_percent_at?: number;
  at?: string;
  source: 'detail' | 'events';
};

export type TelemetryOptions = {
  intervalMs?: number; // 5–10s
  onStatus?: (s: 'charging' | 'completed' | 'idle') => void;
};

// Inicia um loop de telemetria que consulta /v1/sessions/active/:cbid/detail
// e cai para /v1/events?event_type=MeterValues quando o detail vier vazio.
// Retorna uma função para parar o loop.
export function startTelemetryPolling(
  chargeBoxId: string,
  onSample: (sample: TelemetrySample) => void,
  options: TelemetryOptions = {}
): () => void {
  const intervalMs = Math.max(3000, options.intervalMs ?? 5000);
  let stopped = false;
  let timer: any;

  async function tick() {
    if (stopped) return;
    try {
      const detail = await client.get<any>(`/v1/sessions/active/${chargeBoxId}/detail`);
      const tx = detail?.session?.transaction_id as number | undefined;
      const tel = detail?.telemetry || undefined;
      if (tel && Object.keys(tel).length > 0) {
        options.onStatus?.('charging');
        onSample({
          transaction_id: tx,
          kwh: tel?.kwh,
          power_kw: tel?.power_kw,
          voltage_v: tel?.voltage_v,
          current_a: tel?.current_a,
          soc_percent_at: tel?.soc_percent_at,
          at: tel?.at,
          source: 'detail',
        });
      } else if (tx) {
        // Fallback: ler últimos MeterValues
        const ev = await client.get<any>(`/v1/events?event_type=MeterValues&transaction_pk=${tx}&limit=50&sort=desc`);
        const latest = Array.isArray(ev) ? ev[0] : undefined;
        const sample: TelemetrySample = {
          transaction_id: tx,
          kwh: latest?.kwh ?? latest?.meter_kwh,
          power_kw: latest?.power_kw,
          voltage_v: latest?.voltage_v,
          current_a: latest?.current_a,
          soc_percent_at: latest?.soc_percent_at,
          at: latest?.created_at || latest?.at,
          source: 'events',
        };
        onSample(sample);
      }
      // Encerrar se sessão tiver sido completada
      if (tx) {
        const sess = await client.get<any>(`/v1/sessions/${tx}`);
        if (sess?.status === 'completed') {
          options.onStatus?.('completed');
          stop();
          return;
        }
      } else {
        options.onStatus?.('idle');
      }
    } catch (e) {
      // Erros de rede/timeouts não derrubam o loop; será tentado no próximo tick
    }
    timer = setTimeout(tick, intervalMs);
  }

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
  }

  // dispara o primeiro tick imediatamente
  void tick();
  return stop;
}

