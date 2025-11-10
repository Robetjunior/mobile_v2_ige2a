import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { UI_TOKENS } from '../constants';
import { client } from '../api/client';
import { startChargingFlow } from '../features/charging/startFlow';
import { stopChargingFlow } from '../features/charging/stopFlow';
import { startTelemetryPolling, type TelemetrySample } from '../features/charging/telemetry';
import { useActiveSessionDetail } from '../hooks/useActiveSessionDetail';
import { useSessionById } from '../hooks/useSessionById';

type ScreenState = 'idle' | 'starting' | 'charging' | 'stopping' | 'stopped' | 'error';

const DEFAULT_CBID = 'DRBAKANA-TEST-01';
const DEFAULT_IDTAG = 'DEMO-123456';

export default function ChargingSession() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const initialCbid = route?.params?.chargeBoxId || DEFAULT_CBID;
  const [cpId, setCpId] = useState<string>(initialCbid);
  const [state, setState] = useState<ScreenState>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('Pronto');
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
  const [commandId, setCommandId] = useState<string | number | undefined>(undefined);
  const [telemetry, setTelemetry] = useState<TelemetrySample | undefined>(undefined);
  const [txId, setTxId] = useState<number | undefined>(undefined);
  const stopTelemetryRef = useRef<(() => void) | null>(null);
  const { data: activeDetail } = useActiveSessionDetail(cpId, { polling: true });
  const { data: finalSession } = useSessionById(txId, { polling: state === 'stopping' });

  // Pré-check simples ao montar
  useEffect(() => {
    (async () => {
      try {
        const online = await client.get<any>('/v1/ocpp/online').catch(() => []);
        const found = Array.isArray(online) ? online.find((x: any) => x?.charge_box_id === cpId) : undefined;
        const snap = await client.get<any>(`/v1/ocpp/${cpId}/snapshot`).catch(() => undefined);
        const wsOnline = !!(found?.wsOnline ?? snap?.wsOnline);
        const available = ['Available','Preparing','SuspendedEV','Finishing'].includes(snap?.status);
        setStatusMsg(wsOnline && available ? 'Pronto' : 'Indisponível');
        setState(wsOnline && available ? 'idle' : 'error');
      } catch {}
    })();
  }, [cpId]);

  const canStart = useMemo(() => state === 'idle' || state === 'error', [state]);
  const canStop = useMemo(() => state === 'charging' && !!txId, [state, txId]);

  // Alinha txId com hook de sessão ativa quando disponível
  useEffect(() => {
    const tid = activeDetail?.session?.transaction_id;
    if (tid && tid !== txId) setTxId(tid);
  }, [activeDetail?.session?.transaction_id]);

  async function onStart() {
    try {
      setErrorMsg(undefined); setState('starting'); setStatusMsg('Comando enviado');
      const res = await startChargingFlow({ chargeBoxId: cpId, idTag: DEFAULT_IDTAG, connectorId: 1 });
      if (res.commandId) setCommandId(res.commandId);
      if (res.status !== 'accepted') {
        throw Object.assign(new Error(`Start não aceito: ${res.status}`), { status: 409 });
      }
      setStatusMsg('Aguardando aceitação');
      // Espera sessão ativa
      const active = await client.get<any>(`/v1/sessions/active/${cpId}`).catch(() => undefined);
      const tx = active?.session?.transaction_id;
      const idTagActive = active?.session?.id_tag;
      if (tx && idTagActive) {
        setTxId(tx);
        setState('charging');
        setStatusMsg('Sessão ativa');
        // Inicia loop de telemetria
        stopTelemetryRef.current?.();
        stopTelemetryRef.current = startTelemetryPolling(cpId, (s) => setTelemetry(s), {
          intervalMs: 5000,
          onStatus: (s) => {
            if (s === 'completed') setStatusMsg('Sessão concluída');
          },
        });
      } else {
        setState('starting');
      }
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) setErrorMsg('401 unauthorized: verifique X-API-Key');
      else if (status === 404 || status === 409) setErrorMsg('CP offline/indisponível');
      else setErrorMsg(e?.message || 'Falha ao iniciar');
      setState('error');
    }
  }

  async function onStop() {
    try {
      setErrorMsg(undefined); setState('stopping'); setStatusMsg('Parando sessão');
      const res = await stopChargingFlow({ chargeBoxId: cpId });
      if (res.commandId) setCommandId(res.commandId);
      if (res.status !== 'accepted' && res.status !== 'completed') {
        throw Object.assign(new Error(`Stop não aceito: ${res.status}`), { status: 409 });
      }
      setStatusMsg('Aguardando StopTransaction');
      // Confirma status completed e encerra telemetria
      if (stopTelemetryRef.current) { stopTelemetryRef.current(); stopTelemetryRef.current = null; }
      // Aguarda o hook confirmar completed
      const startWait = Date.now();
      while (Date.now() - startWait < 20000) {
        const completed = finalSession?.status === 'completed' || !!finalSession?.stopped_at;
        if (completed) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      setState('stopped');
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) setErrorMsg('401 unauthorized: verifique X-API-Key');
      else setErrorMsg(e?.message || 'Falha ao parar');
    }
  }

  const statusPill = (() => {
    let label = 'Pronto'; let bg = '#E9F8F6'; let txt = UI_TOKENS.colors.brand;
    if (state === 'starting') { label = 'Aguardando aceitação'; bg = '#FFF7ED'; txt = '#C2410C'; }
    if (state === 'charging') { label = 'Sessão ativa'; bg = '#E9F8F6'; txt = UI_TOKENS.colors.brand; }
    if (state === 'stopping') { label = 'Parando sessão'; bg = '#FFF7ED'; txt = '#C2410C'; }
    if (state === 'stopped') { label = 'Sessão concluída'; bg = '#E5E7EB'; txt = '#111827'; }
    if (state === 'error') { label = 'Erro'; bg = '#FDE8E8'; txt = '#B91C1C'; }
    return { label, bg, txt };
  })();

  const MetricsItem = ({ title, value, subtitle }: { title: string; value: string; subtitle: string }) => (
    <View style={{ flex: 1, minWidth: 96, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: '#6B7280' }}>{title}</Text>
      <Text style={{ color: '#6B7280', fontSize: 12 }}>{subtitle}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: UI_TOKENS.colors.tabBg }}>
      <View style={{ backgroundColor: UI_TOKENS.colors.headerBg, paddingTop: insets.top + 8, paddingBottom: 12, alignItems: 'center' }}>
        <Text style={{ color: UI_TOKENS.colors.white, fontSize: 18, fontWeight: '600' }}>{cpId}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: UI_TOKENS.sizes.tabH + insets.bottom }}>
        {!!errorMsg && (
          <View style={{ marginTop: 12, marginHorizontal: 16, backgroundColor: '#FDE8E8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: '#B91C1C' }}>{errorMsg}</Text>
          </View>
        )}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: UI_TOKENS.radius.pill, backgroundColor: statusPill.bg }}>
            <Text style={{ color: statusPill.txt, fontWeight: '600' }}>{statusPill.label}</Text>
          </View>
        </View>
        <View style={{ marginTop: 16, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Telemetria</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MetricsItem title="kWh" value={telemetry?.kwh?.toFixed?.(3) ?? '--'} subtitle="Energia" />
            <MetricsItem title="Potência" value={telemetry?.power_kw?.toFixed?.(2) ?? '--'} subtitle="kW" />
            <MetricsItem title="Corrente" value={telemetry?.current_a?.toFixed?.(0) ?? '--'} subtitle="A" />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <MetricsItem title="Tensão" value={telemetry?.voltage_v?.toFixed?.(0) ?? '--'} subtitle="V" />
            <MetricsItem title="SoC" value={telemetry?.soc_percent_at?.toFixed?.(0) ?? '--'} subtitle="%" />
            <MetricsItem title="Tx" value={String(txId ?? telemetry?.transaction_id ?? '--')} subtitle="ID" />
          </View>
        </View>
        <View style={{ marginTop: 24, marginHorizontal: 16, flexDirection: 'row', gap: 12 }}>
          <Pressable disabled={!canStart || state === 'starting'} onPress={onStart} style={{ height: 46, flex: 1, backgroundColor: canStart ? UI_TOKENS.colors.brand : '#9CA3AF', borderRadius: UI_TOKENS.radius.search, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: UI_TOKENS.colors.brandText, fontWeight: '600' }}>Start</Text>
          </Pressable>
          <Pressable disabled={!canStop || state === 'stopping'} onPress={onStop} style={{ height: 46, flex: 1, backgroundColor: canStop ? '#EF4444' : '#9CA3AF', borderRadius: UI_TOKENS.radius.search, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Stop</Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 12, marginHorizontal: 16 }}>
          <Text style={{ color: '#6B7280' }}>{statusMsg}</Text>
          {!!commandId && <Text style={{ color: '#9CA3AF' }}>commandId: {String(commandId)}</Text>}
          {state === 'stopped' && finalSession && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: '#111827' }}>Duração: {String(finalSession.duration_seconds ?? '--')}s</Text>
              <Text style={{ color: '#111827' }}>Motivo: {String(finalSession.stop_reason ?? '--')}</Text>
              <Text style={{ color: '#6B7280' }}>stopped_at: {String(finalSession.stopped_at ?? '--')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

