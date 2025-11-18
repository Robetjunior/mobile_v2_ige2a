import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { UI_TOKENS } from '../../constants';
import { client } from '../../api/client';
import { startCharging } from '../../features/charging/api';
import { stopChargingFlow } from '../../features/charging/stopFlow';
import { getActiveDetail, getProgress, getSessionById } from '../../services/chargeService';
import { buildRemoteStartPS, buildRemoteStopPS } from '../../utils/powershell';
import type { SessionDetail } from '../../services/chargeService';
import { Ionicons } from '@expo/vector-icons';

type ScreenState = 'idle' | 'starting' | 'charging' | 'stopping' | 'stopped' | 'error';

const DEFAULT_CBID = 'DRBAKANA-TEST-03';
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
  const [telemetry, setTelemetry] = useState<SessionDetail['telemetry'] | undefined>(undefined);
  const [txId, setTxId] = useState<number | undefined>(undefined);
  const [sessionStartAt, setSessionStartAt] = useState<string | undefined>(undefined);
  const progressPollRef = useRef<NodeJS.Timeout | null>(null);
  const [finalSession, setFinalSession] = useState<any | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const lastUpdateAt: string | undefined = telemetry?.at;
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

  const formatLocalTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch {
      return iso.slice(11,16);
    }
  };

  const elapsedLabel = useMemo(() => {
    if (!sessionStartAt || !lastUpdateAt) return '—';
    const start = new Date(sessionStartAt).getTime();
    const last = new Date(lastUpdateAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(last)) return '—';
    const diff = Math.max(0, Math.floor((last - start) / 1000));
    const min = Math.floor(diff / 60);
    const sec = diff % 60;
    return `${min}m ${sec}s`;
  }, [sessionStartAt, lastUpdateAt, tick]);

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

  // Quando tivermos um txId, iniciar polling de progresso e checagem periódica da sessão
  useEffect(() => {
    if (!txId) return;
    if (progressPollRef.current) { clearInterval(progressPollRef.current); progressPollRef.current = null; }
    let tick = 0;
    progressPollRef.current = setInterval(async () => {
      tick++;
      const prog = await getProgress(txId).catch(() => undefined);
      if (prog) {
        // Atualiza apenas progress (esta tela exibe métricas customizadas via telemetry abaixo)
      }
      if (tick % 3 === 0) {
        const sess = await getSessionById(txId).catch(() => undefined);
        if (sess?.telemetry) setTelemetry(sess.telemetry);
        if (sess?.session?.started_at) setSessionStartAt(sess.session.started_at);
        const completed = !!sess?.session?.stopped_at || sess?.session?.is_active === false || sess?.status === 'completed';
        if (completed) {
          setFinalSession(sess);
          setTxId(undefined);
          setState('idle');
          setStatusMsg('Sessão encerrada');
          if (progressPollRef.current) { clearInterval(progressPollRef.current); progressPollRef.current = null; }
        }
      }
    }, 3000);
    return () => {
      if (progressPollRef.current) { clearInterval(progressPollRef.current); progressPollRef.current = null; }
    };
  }, [txId]);

  async function onStart() {
    try {
      setErrorMsg(undefined); setState('starting'); setStatusMsg('Comando enviado');
      const apiRes = await startCharging({ chargeBoxId: cpId, idTag: DEFAULT_IDTAG, connectorId: 1, force: true });
      const cmdId = (apiRes as any)?.commandId ?? (apiRes as any)?.id;
      const status = (apiRes as any)?.status ?? 'pending';
      if (cmdId) setCommandId(cmdId);
      // Aceitar também 'sent' e 'completed', aguardando StartTransaction
      if (!['accepted','completed','sent'].includes(status)) {
        throw Object.assign(new Error(`Start não aceito: ${status}`), { status: 409 });
      }
      setStatusMsg('Aguardando aceitação');
      // Espera sessão ativa
      let active = await getActiveDetail(cpId).catch(() => undefined);
      const startWait = Date.now();
      while (!(active?.session?.transaction_id) && Date.now() - startWait < 30000) {
        await new Promise((r) => setTimeout(r, 1500));
        active = await getActiveDetail(cpId).catch(() => undefined);
      }
      const tx = active?.session?.transaction_id;
      const idTagActive = active?.session?.id_tag;
      if (tx && idTagActive) {
        if (active?.session?.started_at) setSessionStartAt(active.session.started_at);
        setTxId(tx);
        setState('charging');
        setStatusMsg('Sessão ativa');
      } else {
        setState('starting');
      }
    } catch (e: any) {
      const status = e?.status;
      // Fallback: mesmo com 5xx do backend, a sessão pode ter sido iniciada.
      try {
        let active = await getActiveDetail(cpId).catch(() => undefined);
        const startWait = Date.now();
        while (!(active?.session?.transaction_id) && Date.now() - startWait < 15000) {
          await new Promise((r) => setTimeout(r, 1500));
          active = await getActiveDetail(cpId).catch(() => undefined);
        }
        const tx = active?.session?.transaction_id;
        if (tx) {
          if (active?.session?.started_at) setSessionStartAt(active.session.started_at);
          setTxId(tx);
          setState('charging');
          setStatusMsg('Sessão ativa (fallback)');
          return;
        }
      } catch {}
      // Soft recovery: se o CP estiver indisponível ou falhado, executar Reset e tentar novamente
      if (status === 409) {
        try {
          setStatusMsg('Recuperando CP (reset suave)…');
          await client.post('/v1/commands/reset', { chargeBoxId: cpId, type: 'Soft' });
          await new Promise((r) => setTimeout(r, 8000));
          const retry = await startCharging({ chargeBoxId: cpId, idTag: DEFAULT_IDTAG, connectorId: 1, force: true });
          const retryStatus = (retry as any)?.status ?? 'pending';
          if (!['accepted','completed','sent','pending'].includes(retryStatus)) {
            throw Object.assign(new Error(`Start não aceito: ${retryStatus}`), { status: 409 });
          }
          setStatusMsg('Aguardando aceitação');
          let active2 = await getActiveDetail(cpId).catch(() => undefined);
          const startWait2 = Date.now();
          while (!(active2?.session?.transaction_id) && Date.now() - startWait2 < 30000) {
            await new Promise((r) => setTimeout(r, 1500));
            active2 = await getActiveDetail(cpId).catch(() => undefined);
          }
          const tx2 = active2?.session?.transaction_id;
          if (tx2) {
            if (active2?.session?.started_at) setSessionStartAt(active2.session.started_at);
            setTxId(tx2);
            setState('charging');
            setStatusMsg('Sessão ativa');
            return;
          }
        } catch {}
      }
      if (status === 401) setErrorMsg('401 unauthorized: verifique X-API-Key');
      else if (status === 404 || status === 409) setErrorMsg('CP offline/indisponível');
      else setErrorMsg(e?.message || 'Falha ao iniciar');
      setState('error');
    }
  }

  async function onStop() {
    try {
      setErrorMsg(undefined); setState('stopping'); setStatusMsg('Parando sessão');
      const res = await stopChargingFlow({ chargeBoxId: cpId, transactionId: txId });
      if (res.commandId) setCommandId(res.commandId);
      // Aceitar 'pending' e 'sent' como estados transitórios e confirmar via sessão
      if (!['accepted','completed','pending','sent'].includes(res.status)) {
        throw Object.assign(new Error(`Stop não aceito: ${res.status}`), { status: 409 });
      }
      setStatusMsg('Aguardando StopTransaction');
      // Confirma status completed e obtém sessão final
      if (progressPollRef.current) { clearInterval(progressPollRef.current); progressPollRef.current = null; }
      const tx = txId as number;
      let sess = await getSessionById(tx).catch(() => undefined);
      const startWait = Date.now();
      while (!(sess?.session?.stopped_at) && sess?.session?.is_active !== false && Date.now() - startWait < 30000) {
        await new Promise((r) => setTimeout(r, 1500));
        sess = await getSessionById(tx).catch(() => undefined);
      }
      if (sess) {
        // Limpa transaction_id para liberar novo início
        const sanitized = sess.session ? { ...sess.session, transaction_id: undefined, is_active: false } : undefined;
        setFinalSession(sanitized ? { ...sess, session: sanitized } : sess);
        setTelemetry(sess.telemetry);
      }
      setTxId(undefined);
      setState('idle');
    } catch (e: any) {
      const status = e?.status;
      // Fallback: mesmo com erro no comando, verificar se a sessão foi encerrada
      try {
        const tx = txId as number;
        let sess = await getSessionById(tx).catch(() => undefined);
        const wait = Date.now();
        while (!(sess?.session?.stopped_at) && sess?.session?.is_active !== false && Date.now() - wait < 30000) {
          await new Promise((r) => setTimeout(r, 1500));
          sess = await getSessionById(tx).catch(() => undefined);
        }
        if (sess?.session) {
          const sanitized = { ...sess.session, transaction_id: undefined, is_active: false };
          setFinalSession({ ...sess, session: sanitized });
          setTelemetry(sess.telemetry);
          setTxId(undefined);
          setState('idle');
          setStatusMsg('Sessão encerrada (confirmada)');
          setErrorMsg(undefined);
          return;
        }
      } catch {}
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
      <View style={{ paddingTop: 10, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759', opacity: (tick % 2) ? 1 : 0.6 }} />
          <Text style={{ color: '#374151', fontWeight: '600' }}>Em tempo real</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={{ color: '#6B7280' }}>Atualizado {lastUpdateLabel}</Text>
          </View>
        </View>
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
            <MetricsItem title="Potência" value={telemetry?.power_kw?.toFixed?.(3) ?? '--'} subtitle="kW" />
            <MetricsItem title="Corrente" value={telemetry?.current_a?.toFixed?.(2) ?? '--'} subtitle="A" />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <MetricsItem title="Tensão" value={telemetry?.voltage_v?.toFixed?.(1) ?? '--'} subtitle="V" />
            <MetricsItem title="SoC" value={telemetry?.soc_percent_at?.toFixed?.(0) ?? '--'} subtitle="%" />
            <MetricsItem title="Tx" value={String(txId ?? telemetry?.transaction_id ?? '--')} subtitle="ID" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ color: '#6B7280' }}>Início: {formatLocalTime(sessionStartAt)}</Text>
            <Text style={{ color: '#6B7280' }}>Duração: {elapsedLabel}</Text>
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
        <View style={{ marginTop: 8, marginHorizontal: 16, flexDirection: 'row', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              const cmd = await buildRemoteStartPS({ chargeBoxId: cpId, idTag: DEFAULT_IDTAG, connectorId: 1 });
              try { await (navigator as any)?.clipboard?.writeText(cmd); setStatusMsg('Comando PS Start copiado'); } catch { setStatusMsg('Comando PS Start pronto (copie manualmente do console)'); console.log(cmd); }
            }}
            style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#E5E7EB', borderRadius: 8 }}
          >
            <Text style={{ color: '#111827' }}>Copiar PS Start</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!txId}
            onPress={async () => {
              const cmd = await buildRemoteStopPS({ chargeBoxId: cpId, transactionId: Number(txId) });
              try { await (navigator as any)?.clipboard?.writeText(cmd); setStatusMsg('Comando PS Stop copiado'); } catch { setStatusMsg('Comando PS Stop pronto (copie manualmente do console)'); console.log(cmd); }
            }}
            style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#E5E7EB', borderRadius: 8, opacity: txId ? 1 : 0.6 }}
          >
            <Text style={{ color: '#111827' }}>Copiar PS Stop</Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 12, marginHorizontal: 16 }}>
          <Text style={{ color: '#6B7280' }}>{statusMsg}</Text>
          {!!commandId && <Text style={{ color: '#9CA3AF' }}>commandId: {String(commandId)}</Text>}
          {state === 'stopped' && finalSession && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: '#111827' }}>Duração: {String(finalSession.duration_seconds ?? '--')}s</Text>
              <Text style={{ color: '#111827' }}>Motivo: {String(finalSession.stop_reason ?? '--')}</Text>
              <Text style={{ color: '#6B7280' }}>stopped_at: {formatLocalTime(finalSession.stopped_at)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

