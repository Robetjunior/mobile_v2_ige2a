import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, LayoutChangeEvent, RefreshControl, Platform, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI_TOKENS } from '../constants';
import { LOGGER, Telemetry } from '../utils/logger';
import { client } from '../api/client';
import { getSnapshot, getChargerMeta, getActiveDetail, getProgress, getTelemetry, getSessionById, streamTelemetryForChargeBox, type SessionDetail, type Snapshot } from '../services/chargeService';
import { buildRemoteStartPS, buildRemoteStopPS } from '../utils/powershell';
import { startCharging } from '../features/charging/api';
import { stopChargingFlow } from '../features/charging/stopFlow';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUserStore } from '../stores/useUserStore';
import TelemetryCard from '../components/TelemetryCard';
import ProgressRing from '../components/ProgressRing';

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
  // SSE/poll desativados para evitar duplicidade de requisições; usamos um único loop de progresso
  const progressPollRef = useRef<NodeJS.Timeout | null>(null);
  const [expanded, setExpanded] = useState(false);
  const tabHeight = UI_TOKENS.sizes.tabH + insets.bottom;
  const user = useUserStore((s) => s.user);
  const { width, height } = useWindowDimensions();
  const [lastHbAt, setLastHbAt] = useState<string | undefined>(undefined);

  // Helpers/guards
  const hasTx = useMemo(() => {
    const s: any = (detail as any)?.session;
    return !!(s?.transaction_id && (s?.is_active === true || s?.isActive === true) && !s?.stopped_at);
  }, [detail]);
  const isDetailActive = useMemo(() => ((detail as any)?.session?.is_active === true) || ((detail as any)?.session?.isActive === true), [detail]);
  const isDetailStopped = useMemo(() => ((detail as any)?.session?.is_active === false) || ((detail as any)?.session?.isActive === false) || !!((detail as any)?.session?.stopped_at), [detail]);
  const isSnapshotAvailable = useMemo(() => (snapshot?.status === 'Available') || (snapshot?.status === 'AVAILABLE'), [snapshot?.status]);
  const isDesync = useMemo(() => isSnapshotAvailable && hasTx && isDetailActive, [isSnapshotAvailable, hasTx, isDetailActive]);
  const canStop = useMemo(() => hasTx && isDetailActive, [hasTx, isDetailActive]);
  const canStart = useMemo(() => (!hasTx) && isSnapshotAvailable, [hasTx, isSnapshotAvailable]);

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
      const s: any = active?.session;
      const activeNow = !!(s?.transaction_id && (s?.is_active !== false && s?.isActive !== false) && !s?.stopped_at);
      setState(activeNow ? 'charging' : 'idle');
    } catch (e: any) {
      // keep minimal handling
    }
  }, []);

  // Removido attachSse/attachPoll: a sincronização de estado é feita ao iniciar/parar e pelo loop de progresso
  const sseRef = useRef<EventSource | null>(null);
  const sseReconnectRef = useRef<NodeJS.Timeout | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const refreshingRef = useRef(false);
  const autoStartHandledRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const id = cpId;
    if (!id) return;
    loadInitial(id);
    return () => {};
  }, [cpId, loadInitial]);

  // Anexa SSE para atualizações de telemetria em tempo real
  useEffect(() => {
    const id = cpId;
    if (!id) return;
    let stopped = false;
    const attach = async () => {
      try {
        const es = await streamTelemetryForChargeBox(id);
        if (!es) return;
        sseRef.current = es;
        es.addEventListener('telemetry-updated', (evt: MessageEvent) => {
          try {
            const data = JSON.parse(evt.data || '{}');
            const tel = data?.telemetry || {};
            Telemetry.track('charge.sse_event', { chargeBoxId: id, type: 'telemetry-updated' });
            const tid = typeof data?.transactionId === 'number' ? data.transactionId : undefined;
            if (typeof tid === 'number' && tid > 0) {
              setState('charging');
            }
            setDetail((prev) => {
              const p = prev || {} as SessionDetail;
              const updatedTelemetry = {
                kwh: typeof tel.energyKWh === 'number' ? tel.energyKWh : p.telemetry?.kwh,
                power_kw: typeof tel.powerKW === 'number' ? tel.powerKW : p.telemetry?.power_kw,
                voltage_v: typeof tel.voltageV === 'number' ? tel.voltageV : p.telemetry?.voltage_v,
                current_a: typeof tel.currentA === 'number' ? tel.currentA : p.telemetry?.current_a,
                temperature_c: typeof tel.temperatureC === 'number' ? tel.temperatureC : p.telemetry?.temperature_c,
                soc_percent_at: typeof tel.batteryPercent === 'number' ? tel.batteryPercent : p.telemetry?.soc_percent_at,
                transaction_id: typeof data?.transactionId === 'number' ? data.transactionId : p.telemetry?.transaction_id,
                at: tel?.timestampUtc || data?.updatedAt || p.telemetry?.at,
              } as any;
              const updatedProgress = {
                ...(p.progress || {}),
                energy_kwh: typeof tel.energyKWh === 'number' ? tel.energyKWh : p.progress?.energy_kwh,
                price_unit: typeof tel.pricePerKWh === 'number' ? tel.pricePerKWh : p.progress?.price_unit,
                price_total: typeof tel.totalCost === 'number' ? tel.totalCost : p.progress?.price_total,
              } as any;
              const updatedSession = {
                ...(p.session || {}),
                transaction_id: typeof tid === 'number' ? tid : p.session?.transaction_id,
              } as any;
              return { ...p, telemetry: updatedTelemetry, progress: updatedProgress, session: updatedSession } as SessionDetail;
            });
          } catch {}
        });
        es.addEventListener('status-change', async (evt: MessageEvent) => {
          try {
            const data = JSON.parse(evt.data || '{}');
            const status = data?.status || data?.payload?.status;
            Telemetry.track('charge.sse_event', { chargeBoxId: id, type: 'status-change' });
            if (status) {
              setSnapshot((prev) => ({ ...(prev || {}), status }));
              const lower = String(status).toLowerCase();
              const readyStates = ['available','preparing','suspendedev','finishing'];
              if (readyStates.includes(lower)) {
                // Confirma sessão ativa com backend; se não houver TX, liberar para novo início
                try {
                  const ad = await getActiveDetail(id).catch(() => undefined);
                  const activeTx = ad?.session?.transaction_id;
                  const isActive = ad?.session?.is_active !== false && !!activeTx;
                  if (!isActive) {
                    setDetail((prev) => ({ ...(prev || {}), session: { ...(prev?.session || {}), transaction_id: undefined, is_active: false } } as any));
                    setState('idle');
                    setStopStatus('Pronto para iniciar um novo carregamento');
                    if (progressPollRef.current) { clearInterval(progressPollRef.current); progressPollRef.current = null; }
                  }
                } catch {}
              }
            }
          } catch {}
        });
        es.addEventListener('heartbeat', (evt: MessageEvent) => {
          try {
            const data = JSON.parse(evt.data || '{}');
            const cbid = data?.chargeBoxId;
            const at = data?.at;
            if (cbid === id && typeof at === 'string') setLastHbAt(at);
          } catch {}
        });
        es.addEventListener('error', () => {
          if (stopped) return;
          try { sseRef.current?.close?.(); } catch {}
          sseRef.current = null;
          if (sseReconnectRef.current) clearTimeout(sseReconnectRef.current);
          sseReconnectRef.current = setTimeout(() => { void attach(); }, 5000);
        });
      } catch {}
    };
    void attach();
    return () => {
      stopped = true;
      try { sseRef.current?.close?.(); } catch {}
      sseRef.current = null;
      if (sseReconnectRef.current) clearTimeout(sseReconnectRef.current);
    };
  }, [cpId]);

  const onStart = useCallback(async () => {
    if (!cpId) return;
    try { LOGGER.API.info('charge.onStart_called', { routeParams: (route as any)?.params, chargeBoxId: cpId, autoStart: !!((route as any)?.params?.autoStart), state, canStart, canStop, isDesync, hasTx }); } catch {}
    Telemetry.track('charge.start_click', { chargeBoxId: cpId });
    setLoading(true); setState('starting'); setCmdError(undefined); setStopStatus('Confirmando início…'); setCommandId(undefined);
    try {
      // Usa idTag do usuário quando disponível; caso contrário, fallback padrão
      const idTag = user?.publicId ?? 'DEMO-123456';
      LOGGER.API.info('remoteStart.direct', { chargeBoxId: cpId });
      const apiRes = await startCharging({ chargeBoxId: cpId, idTag, connectorId: 1, force: true });
      const cmdId = (apiRes as any)?.commandId ?? (apiRes as any)?.id;
      const status = (apiRes as any)?.status ?? 'pending';
      if (cmdId) setCommandId(cmdId);
      // Aceitar 'sent', 'accepted' e 'completed' como avanço válido
      if (!['accepted','completed','sent'].includes(status)) {
        throw new Error(`Start não aceito: ${status}`);
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
      // Fallback: alguns backends podem retornar 5xx mas ainda iniciar a sessão.
      // Tentar detectar sessão ativa mesmo após erro de start.
      try {
        let active = await getActiveDetail(cpId).catch(() => undefined);
        const startWait = Date.now();
        while (!(active?.session?.transaction_id) && Date.now() - startWait < 15000) {
          await new Promise((r) => setTimeout(r, 1500));
          active = await getActiveDetail(cpId).catch(() => undefined);
        }
        if (active?.session?.transaction_id) {
          setDetail(active);
          setState('charging');
          setCmdError(undefined);
          setStopStatus('Sessão ativa (fallback)');
          setLoading(false);
          return;
        }
      } catch {}

      // Soft recovery: se CP estiver Faulted/Unavailable ou status 409, executar Reset e tentar novamente
      const chargerStatus = snapshot?.status;
      if (status === 409 || chargerStatus === 'Faulted' || chargerStatus === 'Unavailable') {
        try {
          setStopStatus('Tentando recuperar CP (reset suave)…');
          await client.post('/v1/commands/reset', { chargeBoxId: cpId, type: 'Soft' });
          await new Promise((r) => setTimeout(r, 8000));
          const idTag = user?.publicId ?? 'DEMO-123456';
          const retry = await startCharging({ chargeBoxId: cpId, idTag, connectorId: 1, force: true });
          const retryStatus = (retry as any)?.status ?? 'pending';
          if (!['accepted','completed','sent','pending'].includes(retryStatus)) {
            throw new Error(`Start não aceito: ${retryStatus}`);
          }
          setStopStatus('Sessão iniciada após reset');
          let active2 = await getActiveDetail(cpId).catch(() => undefined);
          const startWait2 = Date.now();
          while (!(active2?.session?.transaction_id) && Date.now() - startWait2 < 30000) {
            await new Promise((r) => setTimeout(r, 1500));
            active2 = await getActiveDetail(cpId).catch(() => undefined);
          }
          if (active2?.session?.transaction_id) {
            setDetail(active2);
            setState('charging');
            setCmdError(undefined);
            setLoading(false);
            return;
          }
        } catch {}
      }
      if (status === 401) setCmdError('Não autorizado: verifique sua chave de API.');
      else if (status === 409) setCmdError('Carregador offline ou indisponível. Tente novamente quando online.');
      else setCmdError('Falha ao iniciar: ' + (e?.message ?? 'erro desconhecido'));
      setState('error');
    }
    setLoading(false);
  }, [cpId, user]);

  

  const refreshNow = useCallback(async () => {
    if (!cpId) return;
    Telemetry.track('charge.sse_event', { chargeBoxId: cpId, type: 'manual-refresh' });
    setRefreshing(true);
    try {
      // Atualiza snapshot e detalhe
      const [snap, active] = await Promise.all([
        getSnapshot(cpId).catch(() => undefined),
        getActiveDetail(cpId).catch(() => undefined),
      ]);
      if (snap) setSnapshot(snap);
      if (active) setDetail(active);
      const tx = active?.session?.transaction_id ?? detail?.session?.transaction_id;
      if (tx) {
        const [prog, tele] = await Promise.all([
          getProgress(tx).catch(() => undefined),
          getTelemetry(tx).catch(() => undefined),
        ]);
        if (prog) setDetail((prev) => ({ ...(prev || {}), progress: prog }));
        if (tele && Object.keys(tele).length > 0) {
          setDetail((prev) => ({ ...(prev || {}), telemetry: { ...(prev?.telemetry || {}), ...tele } }));
        }
        // Complementa SoC via eventos se necessário
        const needSoc = !(tele && typeof tele.soc_percent_at === 'number');
        if (needSoc) {
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
            const pick = (meas: string, opts?: { preferContext?: string }) => {
              const prefer = (opts?.preferContext || 'Sample.Periodic');
              const primary = allSV.find((s: any) => String(s?.measurand) === meas && String(s?.context || '') === prefer);
              return primary || allSV.find((s: any) => String(s?.measurand) === meas);
            };
            const svSoc = pick('SoC', { preferContext: 'Sample.Periodic' }) || pick('StateOfCharge', { preferContext: 'Sample.Periodic' }) || pick('Battery.SoC', { preferContext: 'Sample.Periodic' });
            const val = typeof svSoc?.value === 'number' ? svSoc.value : parseInt(String(svSoc?.value || 'NaN'));
            if (Number.isFinite(val)) {
              setDetail((prev) => ({ ...(prev || {}), telemetry: { ...(prev?.telemetry || {}), soc_percent_at: val } }));
            }
          } catch {}
        }
      }
      // Atualiza estado de UI (charging/idle) com base no detalhe
      const s: any = active?.session ?? detail?.session;
      const activeNow = !!(s?.transaction_id && (s?.is_active !== false && s?.isActive !== false) && !s?.stopped_at);
      setState(activeNow ? 'charging' : 'idle');
    } finally {
      setRefreshing(false);
    }
  }, [cpId, detail?.session?.transaction_id]);

  // Auto-refresh a cada 2s quando a tela estiver em foco
  useFocusEffect(
    useCallback(() => {
      if (!cpId) return;
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      autoRefreshRef.current = setInterval(() => {
        if (!refreshingRef.current) {
          refreshNow();
        }
      }, 2000);
      return () => {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
          autoRefreshRef.current = null;
        }
      };
    }, [cpId, refreshNow])
  );

  const onStop = useCallback(async () => {
    if (!cpId || !detail?.session?.transaction_id) return;
    Telemetry.track('charge.stop_click', { chargeBoxId: cpId });
    setLoading(true); setState('stopping'); setCmdError(undefined); setStopStatus('Aguardando StopTransaction…'); setCommandId(undefined);
    try {
      const txId = detail.session.transaction_id as number;
      LOGGER.API.info('remoteStop.flow', { chargeBoxId: cpId, txId });
      const res = await stopChargingFlow({ chargeBoxId: cpId, transactionId: txId });
      const cmdId = res?.commandId ?? (res as any)?.id;
      if (cmdId) setCommandId(cmdId);
      setStopStatus(`Comando ${res.status}${res.idempotentDuplicate ? ' (idempotentDuplicate)' : ''}`);
      // Aceitar também 'pending' e 'sent' como estados transitórios e confirmar via sessão
      if (!['accepted','completed','pending','sent'].includes(res.status)) {
        throw new Error(`Stop não aceito: ${res.status}`);
      }
      // Confirmar sessão encerrada: aguarda até 30s por completed/stopped_at
      let sess = await getSessionById(txId).catch(() => undefined);
      const startWait = Date.now();
      while (!(sess?.session?.stopped_at) && ((sess?.session?.is_active ?? sess?.session?.isActive) !== false) && Date.now() - startWait < 30000) {
        await new Promise((r) => setTimeout(r, 1500));
        sess = await getSessionById(txId).catch(() => undefined);
      }
      if (sess?.session) {
        const sanitized = { ...sess.session, transaction_id: undefined, is_active: false };
        setDetail(undefined);
        setLowPowerSince(undefined);
        setState('idle');
        autoStartHandledRef.current = false;
      }
      // Se não houver confirmação explícita, realizar fallback por snapshot/status pronto ou detail ativo
      if (!(sess?.session?.stopped_at) && (sess?.session?.is_active !== false)) {
        const readyStates = ['available','preparing','suspendedev','finishing'];
        let ready = false;
        try {
          const snap2 = await getSnapshot(cpId);
          setSnapshot(snap2);
          const lower = String(snap2?.status || '').toLowerCase();
          if (readyStates.includes(lower)) ready = true;
        } catch {}
        if (!ready) {
          try {
            const ad = await getActiveDetail(cpId).catch(() => undefined);
            const sLower = String((ad as any)?.snapshot?.status || (ad as any)?.session?.status || '').toLowerCase();
            if (readyStates.includes(sLower) || (ad?.session?.is_active === false) || (ad?.session?.isActive === false) || !!ad?.session?.stopped_at) ready = true;
          } catch {}
        }
        if (ready) {
          setDetail(undefined);
          setLowPowerSince(undefined);
          setState('idle');
          autoStartHandledRef.current = false;
        }
      }
      setStopStatus('Sessão encerrada');
      // Atualiza snapshot para refletir status pós-stop e evitar "Erro" por estado desatualizado
      try { const snap = await getSnapshot(cpId); setSnapshot(snap); } catch {}
      try { await refreshNow(); } catch {}
      // Reload forçado para preparar novo início
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          setTimeout(() => { window.location.reload(); }, 150);
        } else {
          const keepAuto = (route as any)?.params?.autoStart === true;
          nav.reset({ index: 0, routes: [{ name: 'Charge', params: { chargeBoxId: cpId, ...(keepAuto ? { autoStart: true } : {}) } }] });
        }
      } catch {}
    } catch (e: any) {
      const status = e?.status;
      // Fallback: mesmo com erro no comando, a sessão pode ter sido encerrada
      try {
        const txId = detail!.session!.transaction_id as number;
        let sess = await getSessionById(txId).catch(() => undefined);
        const wait = Date.now();
        while (!(sess?.session?.stopped_at) && ((sess?.session?.is_active ?? sess?.session?.isActive) !== false) && Date.now() - wait < 30000) {
          await new Promise((r) => setTimeout(r, 1500));
          sess = await getSessionById(txId).catch(() => undefined);
        }
        if (sess?.session) {
          const sanitized = { ...sess.session, transaction_id: undefined, is_active: false };
          setDetail(undefined);
          setState('idle');
          setStopStatus('Sessão encerrada (confirmada)');
          setCmdError(undefined);
          setLoading(false);
          try { const snap2 = await getSnapshot(cpId); setSnapshot(snap2); } catch {}
          try { await refreshNow(); } catch {}
          autoStartHandledRef.current = false;
          // Reload forçado para preparar novo início
          try {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              setTimeout(() => { window.location.reload(); }, 150);
            } else {
              const keepAuto = (route as any)?.params?.autoStart === true;
              nav.reset({ index: 0, routes: [{ name: 'Charge', params: { chargeBoxId: cpId, ...(keepAuto ? { autoStart: true } : {}) } }] });
            }
          } catch {}
          return;
        }
      } catch {}
      if (status === 401) setCmdError('Não autorizado: verifique sua chave de API.');
      else setCmdError('Falha ao parar: ' + (e?.message ?? 'erro desconhecido'));
    }
    setLoading(false);
  }, [cpId, detail]);

  useEffect(() => {
    const auto = (route as any)?.params?.autoStart;
    try { LOGGER.API.info('charge.autostart_effect', { params: (route as any)?.params, cpId, autoStart: !!auto, state, canStart, canStop, isDesync, hasTx }); } catch {}
    if (!auto) return;
    if (autoStartHandledRef.current) return;
    if (isDesync && canStop && !loading) {
      autoStartHandledRef.current = true;
      onStop();
      return;
    }
    if (!hasTx && !loading) {
      autoStartHandledRef.current = true;
      onStart();
    }
  }, [route, hasTx, isDesync, canStop, loading, onStart, onStop, state, canStart]);

  // Poll de progresso por transactionId
  useEffect(() => {
    const txId = detail?.session?.transaction_id;
    if (txId) {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
      let tick = 0;
      progressPollRef.current = setInterval(async () => {
        tick++;
        const [prog, tele] = await Promise.all([
          getProgress(txId).catch(() => undefined),
          getTelemetry(txId).catch(() => undefined),
        ]);
        if (prog) {
          setDetail((prev) => ({ ...(prev || {}), progress: prog }));
        }
        if (tele && Object.keys(tele).length > 0) {
          setDetail((prev) => ({ ...(prev || {}), telemetry: { ...(prev?.telemetry || {}), ...tele } }));
        }
        // A cada ~9s verifica se sessão foi encerrada
        if (tick % 3 === 0) {
          const sess = await getSessionById(txId).catch(() => undefined);
          const completed = !!sess?.session?.stopped_at || (sess?.session?.is_active === false) || (sess?.session?.isActive === false) || sess?.status === 'completed';
          if (completed) {
            setDetail((prev) => ({ ...(prev || {}), session: sess?.session, progress: sess?.progress, telemetry: sess?.telemetry }));
            setState('idle');
            setStopStatus('Sessão encerrada');
            if (progressPollRef.current) { clearInterval(progressPollRef.current); progressPollRef.current = null; }
          }
        }
      }, 3000);
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
          <View style={{ marginTop: 8, flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                const cmd = await buildRemoteStartPS({ chargeBoxId: String(cpId ?? ''), idTag: 'DEMO-123456', connectorId: 1 });
                try { await (navigator as any)?.clipboard?.writeText(cmd); setStopStatus('Comando PS Start copiado'); } catch { setStopStatus('Comando PS Start pronto (copie manualmente do console)'); console.log(cmd); }
              }}
              style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#E5E7EB', borderRadius: 8 }}
            >
              <Text style={{ color: '#111827' }}>Copiar PS Start</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!detail?.session?.transaction_id}
              onPress={async () => {
                const tx = Number(detail?.session?.transaction_id);
                const cmd = await buildRemoteStopPS({ chargeBoxId: String(cpId ?? ''), transactionId: tx });
                try { await (navigator as any)?.clipboard?.writeText(cmd); setStopStatus('Comando PS Stop copiado'); } catch { setStopStatus('Comando PS Stop pronto (copie manualmente do console)'); console.log(cmd); }
              }}
              style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#E5E7EB', borderRadius: 8, opacity: detail?.session?.transaction_id ? 1 : 0.6 }}
            >
              <Text style={{ color: '#111827' }}>Copiar PS Stop</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const statusPill = (() => {
    const s = snapshot?.status || 'Unknown';
    let label = 'Erro'; let bg = '#F3F4F6'; let txt = '#111827';
    const hbAge = lastHbAt ? (Date.now() - new Date(lastHbAt).getTime()) : Infinity;
    const online = hbAge <= 90000;
    if (!online) { label = 'Desconectado'; bg = '#FDE8E8'; txt = '#B91C1C'; return { label, bg, txt }; }
    // Quando a tela está ociosa e o snapshot não indica falha clara, priorizamos "Pronto"
    if (state === 'idle' && !['Faulted','Unavailable'].includes(s)) { label = 'Pronto'; bg = '#E9F8F6'; txt = UI_TOKENS.colors.brand; }
    if (['Available','Preparing','SuspendedEV','Finishing'].includes(s)) { label = 'Pronto'; bg = '#E9F8F6'; txt = UI_TOKENS.colors.brand; }
    if (state === 'charging') {
      // Se SoC >= 99%, destaque conclusão
      const pct = typeof tele?.soc_percent_at === 'number' ? tele.soc_percent_at : undefined;
      if (typeof pct === 'number' && pct >= 99) { label = 'Carregamento 100%'; bg = '#DCFCE7'; txt = '#166534'; }
      else { label = 'Carregando'; bg = '#E9F8F6'; txt = UI_TOKENS.colors.brand; }
    }
    if (state === 'starting') { label = 'Confirmando início…'; bg = '#FFF7ED'; txt = '#C2410C'; }
    if (s === 'Faulted' || s === 'Unavailable') { label = 'Erro'; bg = '#FDE8E8'; txt = '#B91C1C'; }
    if (state === 'stopping') { label = 'Encerrando…'; bg = '#FFF7ED'; txt = '#C2410C'; }
    if (state === 'stopped') { label = 'Sessão encerrada'; bg = '#E5E7EB'; txt = '#111827'; }
    if (state === 'error') { label = 'Erro'; bg = '#FDE8E8'; txt = '#B91C1C'; }
    return { label, bg, txt };
  })();

  const MetricsItem = ({ title, value, subtitle }: { title: string; value: string; subtitle: string }) => (
    <View style={{ width: 120, paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: '#6B7280' }}>{title}</Text>
      <Text style={{ color: '#6B7280', fontSize: 12 }}>{subtitle}</Text>
    </View>
  );

  const progress = detail?.progress;
  const tele = detail?.telemetry;
  const startedAt = detail?.session?.started_at;
  const [tick, setTick] = useState(0);
  const [lowPowerSince, setLowPowerSince] = useState<number | undefined>(undefined);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const lastUpdateAt: string | undefined = tele?.at || snapshot?.updated_at;
  const lastUpdateLabel = useMemo(() => {
    if (!lastUpdateAt) return '—';
    const t = new Date(lastUpdateAt).getTime();
    if (!Number.isFinite(t)) return '—';
    const diff = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (diff < 2) return 'agora';
    if (diff < 60) return `há ${diff}s`;
    const min = Math.floor(diff / 60);
    return `há ${min}min`;
  }, [lastUpdateAt, tick]);

  // Duração em HH:MM:SS
  const durationSeconds = useMemo(() => {
    if (typeof progress?.duration_seconds === 'number' && Number.isFinite(progress.duration_seconds)) {
      return Math.max(0, Math.floor(progress.duration_seconds));
    }
    if (typeof progress?.duration_min === 'number' && Number.isFinite(progress.duration_min)) {
      return Math.max(0, Math.floor(progress.duration_min * 60));
    }
    if (startedAt) {
      const start = new Date(startedAt).getTime();
      if (Number.isFinite(start)) {
        return Math.max(0, Math.floor((Date.now() - start) / 1000));
      }
    }
    return undefined;
  }, [progress?.duration_seconds, progress?.duration_min, startedAt, tick]);

  const formatHMS = (total?: number) => {
    if (typeof total !== 'number' || !Number.isFinite(total)) return '--:--:--';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  // Animação suave do SoC para um feedback mais fluido
  const socPct = useMemo(() => {
    const s = String(snapshot?.status || '');
    const idleReady = state === 'idle' && ['Available','Preparing','SuspendedEV','Finishing'].includes(s);
    if (idleReady) return 0;
    if (typeof tele?.soc_percent_at === 'number' && Number.isFinite(tele.soc_percent_at)) {
      return Math.min(100, Math.max(0, tele.soc_percent_at));
    }
    return undefined;
  }, [tele?.soc_percent_at, snapshot?.status, state]);

  const [pctAnim, setPctAnim] = useState<number>(socPct ?? 0);
  const animRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof socPct !== 'number') return;
    const start = pctAnim;
    const target = socPct;
    const duration = 600; // ms
    const startTime = Date.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    function tick() {
      const t = Math.min(1, (Date.now() - startTime) / duration);
      setPctAnim(start + (target - start) * easeOutCubic(t));
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
      }
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
  }, [socPct]);

  useEffect(() => {
    const thresholdKw = 0.1;
    const kw = typeof tele?.power_kw === 'number' ? tele.power_kw : undefined;
    const lowKw = typeof kw === 'number' ? kw < thresholdKw : false;
    setLowPowerSince((prev) => {
      if (lowKw) return typeof prev === 'number' ? prev : Date.now();
      return undefined;
    });
  }, [tele?.power_kw]);

  const statusHeaderText = useMemo(() => {
    const custom = (route as any)?.params?.statusText;
    if (typeof custom === 'string' && custom.trim()) return custom.trim();
    if (state === 'stopping') return 'Encerrando sessão anterior…';
    if (isDesync) return 'Sincronizando sessão…';
    if (canStop) return 'Carregamento em progresso';
    if (canStart) return 'Pronto para iniciar';
    return 'Verificando estado do carregador…';
  }, [route, state, isDesync, canStop, canStart]);

  return (
    <View style={{ flex: 1, backgroundColor: UI_TOKENS.colors.tabBg }}>
      <View style={{ backgroundColor: UI_TOKENS.colors.headerBg, paddingTop: insets.top + 12, paddingBottom: 12, alignItems: 'center' }}>
        <Text style={{ color: UI_TOKENS.colors.white, fontSize: 18, fontWeight: '600' }}>{statusHeaderText}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ backgroundColor: UI_TOKENS.colors.headerBg, alignItems: 'center', paddingTop: 12, paddingBottom: 12 }}>
          <ProgressRing percent={typeof pctAnim === 'number' ? Math.min(100, Math.max(0, pctAnim)) : undefined} size={Math.max(150, Math.min(200, Math.floor(height * 0.26)))} vibrant={state === 'charging'} />
          <Text style={{ marginTop: 8, color: '#D1D5DB', fontSize: 12 }}>{snapshot?.connector || 'Conector 1'}</Text>
          <Pressable
            onPress={(isDesync || canStop) ? onStop : onStart}
            disabled={loading || (!(isDesync || canStop || canStart))}
            accessibilityRole="button"
            style={({ pressed }) => ([
              { marginTop: 12, height: 52, minWidth: Math.min(360, Math.floor(width * 0.9)), borderRadius: 26, backgroundColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center' },
              pressed && { opacity: 0.95 },
              (loading || (!(isDesync || canStop || canStart))) && { opacity: 0.6 },
            ])}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>{state === 'stopping' ? 'Encerrando…' : ((isDesync || canStop) ? 'Parar Carregamento' : 'Iniciar Carregamento')}</Text>
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
          {!!cmdError && (
            <View style={{ marginTop: 12, marginHorizontal: 16, backgroundColor: '#FDE8E8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: '#B91C1C' }}>{cmdError}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }}>
          {(() => {
            const s = String(snapshot?.status || '');
            const idleReadyBase = state === 'idle' && ['Available','Preparing','SuspendedEV','Finishing'].includes(s);
            const noTx = !detail?.session?.transaction_id || detail?.session?.is_active === false || !!detail?.session?.stopped_at;
            const thresholdKw = 0.1;
            const lowKw = typeof tele?.power_kw === 'number' ? tele.power_kw < thresholdKw : true;
            const lowFor = lowPowerSince ? (Date.now() - lowPowerSince) : 0;
            const uiSuspended = state === 'charging' && lowKw && lowFor >= 5000;
            const idleReady = idleReadyBase || uiSuspended || noTx;
            const basis = 32;
            const gap = 8;
            return (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: gap as any, rowGap: gap as any }}>
                <TelemetryCard value={idleReady ? '0.000' : (typeof tele?.power_kw === 'number' ? tele.power_kw.toFixed(3) : '--')} label="Potência" unit="kW" basisPercent={basis} compact />
                <TelemetryCard value={idleReady ? '0.0' : (typeof tele?.voltage_v === 'number' ? tele.voltage_v.toFixed(1) : '--')} label="Tensão" unit="V" basisPercent={basis} compact />
                <TelemetryCard value={idleReady ? '0.00' : (typeof tele?.current_a === 'number' ? tele.current_a.toFixed(2) : '--')} label="Corrente" unit="A" basisPercent={basis} compact />
                <TelemetryCard value={idleReady ? '00:00:00' : formatHMS(durationSeconds)} label="Duração" basisPercent={basis} compact />
                <TelemetryCard value={idleReady ? 'R$ 0,00' : ((Number(progress?.price_total ?? NaN)).toFixed(2) !== 'NaN' ? `R$ ${(Number(progress?.price_total ?? 0)).toFixed(2)}` : '--')} label="Valor Total" basisPercent={basis} compact />
                <TelemetryCard value={idleReady ? '0.000' : (typeof progress?.energy_kwh === 'number' ? progress.energy_kwh.toFixed(3) : '--')} label="Energia" unit="kWh" basisPercent={basis} compact />
                <TelemetryCard value={idleReady ? '--:--' : (startedAt ? startedAt.slice(11,16) : '--:--')} label="Início" basisPercent={basis} compact />
                <TelemetryCard value={idleReady ? 'R$ 0,00' : ((Number(progress?.price_unit ?? NaN)).toFixed(2) !== 'NaN' ? `R$ ${(Number(progress?.price_unit ?? 0)).toFixed(2)}` : '--')} label="Preço Unitário" unit="R$/kWh" basisPercent={basis} compact />
                <TelemetryCard value={idleReady ? '0' : (typeof tele?.temperature_c === 'number' ? tele.temperature_c : '--')} label="Temperatura" unit="°C" basisPercent={basis} compact />
              </View>
            );
          })()}
        </View>
      </View>
    </View>
  );
}
