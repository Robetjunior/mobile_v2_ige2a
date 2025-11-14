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
  const intervalMs = Math.max(3000, options.intervalMs ?? 3000);
  let stopped = false;
  let timer: any;
  const num = (v: any, kind: 'float' | 'int'): number | undefined => {
    if (typeof v === 'number') return v;
    if (v === null || typeof v === 'undefined') return undefined;
    const s = String(v);
    return kind === 'float' ? parseFloat(s) : parseInt(s);
  };

  async function tick() {
    if (stopped) return;
    try {
      const detail = await client.get<any>(`/v1/sessions/active/${chargeBoxId}/detail`);
      const tx = detail?.session?.transaction_id as number | undefined;
      const tel = detail?.telemetry || undefined;
      if (tel && Object.keys(tel).length > 0) {
        options.onStatus?.('charging');
        const sampleFromDetail: TelemetrySample = {
          transaction_id: tx,
          kwh: num(tel?.kwh, 'float'),
          power_kw: num(tel?.power_kw, 'float'),
          voltage_v: num(tel?.voltage_v, 'int'),
          current_a: num(tel?.current_a, 'float'),
          soc_percent_at: num(tel?.soc_percent_at, 'int'),
          at: tel?.at,
          source: 'detail',
        };
        // Se campos críticos estiverem ausentes (ex.: SoC), tentar complementar via eventos
        const needsComplement = sampleFromDetail.soc_percent_at === undefined || sampleFromDetail.kwh === undefined || sampleFromDetail.power_kw === undefined;
        if (!needsComplement || !tx) {
          onSample(sampleFromDetail);
        } else {
          try {
            const ev = await client.get<any>(`/v1/events?event_type=MeterValues&transaction_pk=${tx}&context=Sample.Periodic&limit=50&sort=desc`).catch(async () => {
              return client.get<any>(`/v1/events?event_type=MeterValues&transaction_pk=${tx}&limit=50&sort=desc`);
            });
            const events = Array.isArray(ev) ? ev : [ev];
            const svArrays: any[] = [];
            const pushSvFromEvent = (e: any) => {
              if (Array.isArray(e?.sampledValue)) svArrays.push(e.sampledValue);
              const mv = e?.meterValue;
              if (Array.isArray(mv)) {
                for (const m of mv) {
                  if (Array.isArray(m?.sampledValue)) svArrays.push(m.sampledValue);
                }
              } else if (Array.isArray(mv?.sampledValue)) {
                svArrays.push(mv.sampledValue);
              }
              const td = e?.payload?.transactionData;
              if (Array.isArray(td)) {
                for (const tdi of td) {
                  if (Array.isArray(tdi?.sampledValue)) svArrays.push(tdi.sampledValue);
                }
              }
              const psv = e?.payload?.sampledValue;
              if (Array.isArray(psv)) svArrays.push(psv);
            };
            for (const e of events) pushSvFromEvent(e);
            const allSV = svArrays.flat();
            const pick = (meas: string, opts?: { preferContext?: string; location?: string; phase?: string }) => {
              const prefer = (opts?.preferContext || 'Sample.Periodic');
              const primary = allSV.find((s: any) => String(s?.measurand) === meas && String(s?.context || '') === prefer && (!opts?.location || String(s?.location || '') === opts.location) && (!opts?.phase || String(s?.phase || '') === opts.phase));
              if (primary) return primary;
              return allSV.find((s: any) => String(s?.measurand) === meas);
            };
            const svEnergy = pick('Energy.Active.Import.Register', { preferContext: 'Sample.Periodic', location: 'Outlet' });
            const svPower = pick('Power.Active.Import', { preferContext: 'Sample.Periodic', location: 'Outlet' });
            const svSoc = pick('SoC', { preferContext: 'Sample.Periodic' }) || pick('StateOfCharge', { preferContext: 'Sample.Periodic' }) || pick('Battery.SoC', { preferContext: 'Sample.Periodic' });
            const parseNum = (v: any, kind: 'float'|'int'): number | undefined => {
              if (typeof v === 'number') return v;
              if (v === null || typeof v === 'undefined') return undefined;
              const n = kind === 'float' ? parseFloat(String(v)) : parseInt(String(v));
              return Number.isFinite(n) ? n : undefined;
            };
            const merged: TelemetrySample = {
              ...sampleFromDetail,
              kwh: sampleFromDetail.kwh ?? parseNum(svEnergy?.value, 'float'),
              power_kw: sampleFromDetail.power_kw ?? parseNum(svPower?.value, 'float'),
              soc_percent_at: sampleFromDetail.soc_percent_at ?? parseNum(svSoc?.value, 'int'),
            };
            onSample(merged);
          } catch {
            onSample(sampleFromDetail);
          }
        }
      } else if (tx) {
        // Fallback: ler últimos MeterValues e extrair sampledValue conforme OCPP
        // Preferir context "Sample.Periodic"; se não houver, usar último disponível
        const ev = await client.get<any>(`/v1/events?event_type=MeterValues&transaction_pk=${tx}&context=Sample.Periodic&limit=50&sort=desc`).catch(async () => {
          return client.get<any>(`/v1/events?event_type=MeterValues&transaction_pk=${tx}&limit=50&sort=desc`);
        });
        const events = Array.isArray(ev) ? ev : [ev];

        // Coleciona possíveis arrays de sampledValue em diferentes estruturas, em ordem desc
        const svArrays: any[] = [];
        const pushSvFromEvent = (e: any) => {
          if (Array.isArray(e?.sampledValue)) svArrays.push(e.sampledValue);
          const mv = e?.meterValue;
          if (Array.isArray(mv)) {
            for (const m of mv) {
              if (Array.isArray(m?.sampledValue)) svArrays.push(m.sampledValue);
            }
          } else if (Array.isArray(mv?.sampledValue)) {
            svArrays.push(mv.sampledValue);
          }
          const td = e?.payload?.transactionData;
          if (Array.isArray(td)) {
            for (const tdi of td) {
              if (Array.isArray(tdi?.sampledValue)) svArrays.push(tdi.sampledValue);
            }
          }
          const psv = e?.payload?.sampledValue;
          if (Array.isArray(psv)) svArrays.push(psv);
        };
        for (const e of events) pushSvFromEvent(e);

        const allSV = svArrays.flat();
        const pick = (meas: string, opts?: { preferContext?: string; location?: string; phase?: string }) => {
          const prefer = (opts?.preferContext || 'Sample.Periodic');
          const primary = allSV.find((s: any) => String(s?.measurand) === meas && String(s?.context || '') === prefer && (!opts?.location || String(s?.location || '') === opts.location) && (!opts?.phase || String(s?.phase || '') === opts.phase));
          if (primary) return primary;
          return allSV.find((s: any) => String(s?.measurand) === meas);
        };

        const svEnergy = pick('Energy.Active.Import.Register', { preferContext: 'Sample.Periodic', location: 'Outlet' });
        const svPower = pick('Power.Active.Import', { preferContext: 'Sample.Periodic', location: 'Outlet' });
        const svVoltage = pick('Voltage', { preferContext: 'Sample.Periodic', location: 'Outlet', phase: 'L1-N' }) || pick('Voltage', { preferContext: 'Sample.Periodic' });
        const svCurrent = pick('Current.Import', { preferContext: 'Sample.Periodic', location: 'Outlet', phase: 'L1' }) || pick('Current.Import', { preferContext: 'Sample.Periodic' });
        const svTemp = pick('Temperature', { preferContext: 'Sample.Periodic' });
        const svSoc = pick('SoC', { preferContext: 'Sample.Periodic' }) || pick('StateOfCharge', { preferContext: 'Sample.Periodic' }) || pick('Battery.SoC', { preferContext: 'Sample.Periodic' });

        const parseNum = (v: any, kind: 'float'|'int'): number | undefined => {
          if (typeof v === 'number') return v;
          if (v === null || typeof v === 'undefined') return undefined;
          const n = kind === 'float' ? parseFloat(String(v)) : parseInt(String(v));
          return Number.isFinite(n) ? n : undefined;
        };
        const timestamp = latest?.timestamp || latest?.meterValue?.timestamp || latest?.meterValue?.[0]?.timestamp || latest?.created_at || latest?.at;
        const sample: TelemetrySample = {
          transaction_id: tx,
          kwh: parseNum(svEnergy?.value, 'float'),
          power_kw: parseNum(svPower?.value, 'float'),
          voltage_v: parseNum(svVoltage?.value, 'int'),
          current_a: parseNum(svCurrent?.value, 'float'),
          soc_percent_at: parseNum(svSoc?.value, 'int'),
          at: timestamp,
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

