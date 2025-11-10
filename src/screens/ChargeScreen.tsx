import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, LayoutChangeEvent } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI_TOKENS } from '../constants';
import { LOGGER, Telemetry } from '../utils/logger';
import { getSnapshot, getChargerMeta, getActiveDetail, getProgress, getSessionById, streamEvents, type SessionDetail, type Snapshot } from '../services/chargeService';
import { startChargingFlow } from '../features/charging/startFlow';
import { stopChargingFlow } from '../features/charging/stopFlow';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUserStore } from '../stores/useUserStore';

type ScreenState = 'idle' | 'starting' | 'charging' | 'stopping' | 'stopped' | 'error';

export default function ChargeScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [cpId, setCpId] = useState<string | undefined>(route?.params?.chargeBoxId);
  const [cpName, setCpName] = useState<string | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<Snapshot | undefined>(undefined);
  const [detail, setDetail] = useState<SessionDetail | undefined>(undefined);
  const [state, setState] = useState<ScreenState>('idle');
  const [loading, setLoading] = useState(false);
  const [cmdError, setCmdError] = useState<string | undefined>(undefined);
  const [stopStatus, setStopStatus] = useState<string | undefined>(undefined);
  const [commandId, setCommandId] = useState<string | number | undefined>(undefined);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const progressPollRef = useRef<NodeJS.Timeout | null>(null);
  const [expanded, setExpanded] = useState(false);
  const tabHeight = UI_TOKENS.sizes.tabH + insets.bottom;
  const user = useUserStore((s) => s.user);

  // Guards
  const canStart = useMemo(() => {
    const st = snapshot?.status;
    const startable = st ? ['Available','Preparing','SuspendedEV','Finishing'].includes(st) : false;
    return !!cpId && startable && !detail?.session?.transaction_id;
  }, [cpId, snapshot, detail]);
  const canStop = useMemo(() => !!detail?.session?.transaction_id && !!cpId, [detail, cpId]);

  const loadInitial = useCallback(async (id: string) => {
    try {
      LOGGER.API.info('snapshot', { chargeBoxId: id });
      const [snap, meta, active] = await Promise.all([
        getSnapshot(id),
        getChargerMeta(id).catch(() => undefined),
        getActiveDetail(id).catch(() => undefined),
      ]);
      setSnapshot(snap);
      setCpName((meta as any)?.name || id);
      if (active) setDetail(active);
      setState(active?.session?.transaction_id ? 'charging' : 'idle');
    } catch (e: any) {
      // keep minimal handling
    }
  }, []);

  const attachSse = useCallback((id: string) => {
    try {
      if (typeof EventSource === 'undefined') return; // on native, we fallback to polling
      const es = streamEvents();
      if (!es) return;
      sseRef.current = es;
      es.onmessage = async (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          Telemetry.track('charge.sse_event', msg);
          if (msg?.charge_box_id !== id) return;
          if (msg?.event_type === 'MeterValues' || msg?.event_type === 'StatusNotification' || msg?.event_type === 'StartTransaction' || msg?.event_type === 'StopTransaction') {
            const active = await getActiveDetail(id).catch(() => undefined);
            if (active) setDetail(active);
            if (active?.session?.transaction_id) setState('charging');
            else setState('idle');
            if (active?.session?.transaction_id) {
              LOGGER.API.info('detail_active', { chargeBoxId: id });
            }
          }
        } catch {}
      };
    } catch {}
  }, []);

  const attachPoll = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const active = await getActiveDetail(id).catch(() => undefined);
      if (active) setDetail(active);
      if (active?.session?.transaction_id) setState('charging');
      else setState('idle');
    }, 5000);
  }, []);

  useEffect(() => {
    const id = cpId;
    if (!id) return;
    loadInitial(id);
    attachSse(id);
    attachPoll(id);
    return () => {
      if (sseRef.current) { try { sseRef.current.close(); } catch {} sseRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [cpId, loadInitial, attachSse, attachPoll]);

  const onStart = useCallback(async () => {
    if (!cpId) return;
    Telemetry.track('charge.start_click', { chargeBoxId: cpId });
    setLoading(true); setState('starting'); setCmdError(undefined); setStopStatus('Confirmando início…'); setCommandId(undefined);
    try {
      // Usa idTag do usuário quando disponível; caso contrário, fallback padrão
      const idTag = user?.publicId ?? 'DEMO-123456';
      LOGGER.API.info('remoteStart.flow', { chargeBoxId: cpId });
      const res = await startChargingFlow({ chargeBoxId: cpId, idTag, connectorId: 1 });
      if (res.commandId) setCommandId(res.commandId);
      if (res.status !== 'accepted' && res.status !== 'completed') {
        throw new Error(`Start não aceito: ${res.status}`);
      }
      setStopStatus('Sessão iniciada');
      // Aguarda confirmação da sessão ativa (StartTransaction) antes de marcar como "charging"
      let active = await getActiveDetail(cpId).catch(() => undefined);
      const startWait = Date.now();
      while (!(active?.session?.transaction_id) && Date.now() - startWait < 30000) {
        await new Promise((r) => setTimeout(r, 1500));
        active = await getActiveDetail(cpId).catch(() => undefined);
      }
      if (active) setDetail(active);
      if (active?.session?.transaction_id) setState('charging');
      else setState('starting');
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) setCmdError('Não autorizado: verifique sua chave de API.');
      else if (status === 409) setCmdError('Carregador offline ou indisponível. Tente novamente quando online.');
      else setCmdError('Falha ao iniciar: ' + (e?.message ?? 'erro desconhecido'));
      setState('error');
    }
    setLoading(false);
  }, [cpId, user]);

  // Auto-start quando navegado com { autoStart: true }
  useEffect(() => {
    const auto = (route as any)?.params?.autoStart;
    if (!auto) return;
    if (state !== 'idle') return;
    if (canStart && !loading) {
      onStart();
    }
  }, [route, state, canStart, loading, onStart]);

  const onStop = useCallback(async () => {
    if (!cpId || !detail?.session?.transaction_id) return;
    Telemetry.track('charge.stop_click', { chargeBoxId: cpId });
    setLoading(true); setState('stopping'); setCmdError(undefined); setStopStatus('Aguardando confirmação…'); setCommandId(undefined);
    try {
      const txId = detail.session.transaction_id as number;
      LOGGER.API.info('remoteStop.flow', { chargeBoxId: cpId, txId });
      const res = await stopChargingFlow({ chargeBoxId: cpId });
      const cmdId = res?.commandId ?? (res as any)?.id;
      if (cmdId) setCommandId(cmdId);
      setStopStatus(`Comando ${res.status}${res.idempotentDuplicate ? ' (idempotentDuplicate)' : ''}`);
      if (res.status !== 'accepted' && res.status !== 'completed') {
        throw new Error(`Stop não aceito: ${res.status}`);
      }
      // Confirmar sessão encerrada
      const sess = await getSessionById(txId).catch(() => undefined);
      if (sess?.session) {
        setDetail((prev) => ({ ...(prev || {}), session: sess.session, progress: sess.progress, telemetry: sess.telemetry }));
      }
      setState('idle');
      setStopStatus('Sessão encerrada');
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) setCmdError('Não autorizado: verifique sua chave de API.');
      else setCmdError('Falha ao parar: ' + (e?.message ?? 'erro desconhecido'));
    }
    setLoading(false);
  }, [cpId, detail]);

  // Poll de progresso por transactionId
  useEffect(() => {
    const txId = detail?.session?.transaction_id;
    if (txId) {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
      progressPollRef.current = setInterval(async () => {
        const prog = await getProgress(txId).catch(() => undefined);
        if (prog) {
          setDetail((prev) => ({ ...(prev || {}), progress: prog }));
        }
      }, 5000);
    } else {
      if (progressPollRef.current) { clearInterval(progressPollRef.current); progressPollRef.current = null; }
    }
    return () => {
      if (progressPollRef.current) { clearInterval(progressPollRef.current); progressPollRef.current = null; }
    };
  }, [detail?.session?.transaction_id]);

  // Empty state CTA quando não há cpId
  if (!cpId) {
    return (
      <View style={{ flex: 1, backgroundColor: UI_TOKENS.colors.tabBg }}>
        <View style={{ paddingTop: insets.top + 12, paddingBottom: 12, backgroundColor: UI_TOKENS.colors.headerBg, alignItems: 'center' }}>
          <Text style={{ color: UI_TOKENS.colors.white, fontSize: 18, fontWeight: '600' }}>Sem carregador selecionado</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text style={{ marginBottom: 16, fontSize: 16 }}>Escaneie um QR para iniciar</Text>
          <Pressable onPress={() => nav.navigate('QRScanner')} accessibilityRole="button" style={{ height: 46, minWidth: 200, backgroundColor: UI_TOKENS.colors.brand, borderRadius: UI_TOKENS.radius.search, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: UI_TOKENS.colors.brandText, fontWeight: '600' }}>Escanear QR</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const statusPill = (() => {
    const s = snapshot?.status || 'Unknown';
    let label = 'Erro'; let bg = '#F3F4F6'; let txt = '#111827';
    if (['Available','Preparing','SuspendedEV','Finishing'].includes(s)) { label = 'Pronto'; bg = '#E9F8F6'; txt = UI_TOKENS.colors.brand; }
    if (state === 'charging') { label = 'Carregando'; bg = '#E9F8F6'; txt = UI_TOKENS.colors.brand; }
    if (state === 'starting') { label = 'Confirmando início…'; bg = '#FFF7ED'; txt = '#C2410C'; }
    if (s === 'Faulted' || s === 'Unavailable') { label = 'Erro'; bg = '#FDE8E8'; txt = '#B91C1C'; }
    if (state === 'stopping') { label = 'Encerrando…'; bg = '#FFF7ED'; txt = '#C2410C'; }
    if (state === 'stopped') { label = 'Sessão encerrada'; bg = '#E5E7EB'; txt = '#111827'; }
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

  const progress = detail?.progress;
  const tele = detail?.telemetry;
  const startedAt = detail?.session?.started_at;

  return (
    <View style={{ flex: 1, backgroundColor: UI_TOKENS.colors.tabBg }}>
      {/* Header simples */}
      <View style={{ backgroundColor: UI_TOKENS.colors.headerBg, paddingTop: insets.top + 8, paddingBottom: 12, alignItems: 'center' }}>
        <Text style={{ color: UI_TOKENS.colors.white, fontSize: 18, fontWeight: '600' }}>{cpName || cpId}</Text>
      </View>
      <ScrollView contentInset={{ bottom: tabHeight }} contentContainerStyle={{ paddingBottom: tabHeight }}>
        {!!cmdError && (
          <View style={{ marginTop: 12, marginHorizontal: 16, backgroundColor: '#FDE8E8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: '#B91C1C' }}>{cmdError}</Text>
          </View>
        )}
        {/* Status Pill */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: UI_TOKENS.radius.pill, backgroundColor: statusPill.bg }}>
            <Text style={{ color: statusPill.txt, fontWeight: '600' }}>{statusPill.label}</Text>
          </View>
        </View>
        {/* Card + Gauge */}
        <View style={{ marginTop: 16, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center' }}>
          <View style={{ height: 260, width: 260, borderRadius: 130, borderWidth: 16, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ height: 200, width: 200, borderRadius: 100, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: UI_TOKENS.colors.brand, fontSize: 18, fontWeight: '700' }}>{`${(progress?.energy_kwh ?? 0).toFixed(0)}%`}</Text>
            </View>
          </View>
          <Text style={{ marginTop: 12, color: '#6B7280' }}>{snapshot?.connector || 'Connector 1'}</Text>
        </View>

        {/* Primary Button */}
        <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
          <Pressable
            onPress={state === 'charging' ? onStop : onStart}
            disabled={loading || (state === 'charging' ? !canStop : !canStart)}
            accessibilityRole="button"
            style={({ pressed }) => ([
              { height: 48, borderRadius: 24, backgroundColor: state === 'charging' ? '#9CA3AF' : UI_TOKENS.colors.brand, alignItems: 'center', justifyContent: 'center' },
              pressed && { opacity: 0.9 },
              (loading || (state === 'charging' ? !canStop : !canStart)) && { opacity: 0.6 },
            ])}
          >
            <Text style={{ color: state === 'charging' ? '#FFFFFF' : UI_TOKENS.colors.brandText, fontSize: 18, fontWeight: '600' }}>
              {state === 'charging' ? 'Parar Carregamento' : 'Iniciar Carregamento'}
            </Text>
          </Pressable>
          {state === 'starting' && (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <LoadingSpinner size={18} />
              <Text style={{ color: '#6B7280' }}>{stopStatus || 'Confirmando início…'}</Text>
            </View>
          )}
          {state === 'stopping' && (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <LoadingSpinner size={18} />
              <Text style={{ color: '#6B7280' }}>{stopStatus || 'Aguardando confirmação…'}</Text>
            </View>
          )}
          {typeof commandId !== 'undefined' && (state === 'starting' || state === 'stopping') && (
            <View style={{ marginTop: 8, alignItems: 'center' }}>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>commandId: {String(commandId)}</Text>
            </View>
          )}
        </View>

        {/* Metrics Grid */}
        <View style={{ marginTop: 16, paddingHorizontal: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MetricsItem title="Potência" value={`${tele?.power_kw ?? 0} kW`} subtitle="Power" />
            <MetricsItem title="Tensão" value={`${tele?.voltage_v ?? 0} V`} subtitle="Voltage" />
            <MetricsItem title="Corrente" value={`${tele?.current_a ?? 0} A`} subtitle="Current" />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MetricsItem title="Duração" value={`${progress?.duration_min ?? 0} min`} subtitle="Duration" />
            <MetricsItem title="Valor Total" value={`${progress?.price_total ?? 0}`} subtitle="Total Amount" />
            <MetricsItem title="Energia" value={`${progress?.energy_kwh ?? 0} kWh`} subtitle="Energy" />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MetricsItem title="Preço Unit." value={`${progress?.price_unit ?? 0}`} subtitle="Unit Price" />
            <MetricsItem title="Temperatura" value={`${tele?.temperature_c ?? 0} °C`} subtitle="Temperature" />
            <MetricsItem title="Início" value={`${startedAt ? startedAt.slice(11,16) : '--:--'}`} subtitle="Start Time" />
          </View>
        </View>

        {/* Accordion */}
        <View style={{ marginTop: 16, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 12 }}>
          <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600' }}>Sessão & Conector</Text>
            <Text style={{ color: '#6B7280' }}>{expanded ? '▲' : '▼'}</Text>
          </Pressable>
          {expanded && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
              <Text>Charge Box ID: {cpId}</Text>
              <Text>Transaction ID: {detail?.session?.transaction_id ?? '-'}</Text>
              <Text>Connector ID: 1</Text>
              <Text>Status: {snapshot?.status ?? '-'}</Text>
              <Text>Atualizado: {snapshot?.updated_at ?? '-'}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}