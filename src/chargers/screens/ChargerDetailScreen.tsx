import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI_TOKENS } from '../../constants';
import { http } from '../../api/http';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getActiveDetail } from '../../services/chargeService';
import { startChargingFlow } from '../../features/charging/startFlow';
import { stopChargingFlow } from '../../features/charging/stopFlow';
import { useUserStore } from '../../stores/useUserStore';
import { useChargerDetail } from '../../hooks/useChargerDetail';
import { setJson } from '../../utils/storage';

type Connector = { id?: number; type?: string; powerKw?: number; status?: string };
type ChargerDetail = {
  chargeBoxId: string;
  name?: string;
  address?: string;
  coords?: { lat: number; lon: number };
  overallStatus?: string;
  connectors?: Connector[];
};

export default function ChargerDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const chargeBoxId: string | undefined = route?.params?.chargeBoxId || route?.params?.id;
  const [detail, setDetail] = useState<ChargerDetail | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const user = useUserStore((s) => s.user);
  const [screenState, setScreenState] = useState<'idle'|'starting'|'charging'|'stopping'|'stopped'|'error'>('idle');
  const [cmdError, setCmdError] = useState<string | undefined>(undefined);
  const [stopStatus, setStopStatus] = useState<string | undefined>(undefined);
  const [commandId, setCommandId] = useState<string | number | undefined>(undefined);
  const [txId, setTxId] = useState<number | undefined>(undefined);

  const hook = useChargerDetail(chargeBoxId);
  useEffect(() => {
    setLoading(hook.isLoading);
    setError(hook.error?.message);
    setDetail(hook.data as any);
  }, [hook.isLoading, hook.error, hook.data]);

  useEffect(() => {
    if (chargeBoxId) {
      getActiveDetail(chargeBoxId).then((active) => {
        const tid = active?.session?.transaction_id;
        setTxId(tid);
        setScreenState(tid ? 'charging' : 'idle');
      }).catch(() => {});
    }
  }, [chargeBoxId]);

  const canStart = useMemo(() => {
    if (!chargeBoxId) return false;
    const wsOnline = (detail as any)?.wsOnline !== false;
    const status = String((detail as any)?.lastStatus || '').toLowerCase();
    const okStatus = ['available','preparing','suspendedev','finishing','ready'].includes(status);
    const hasAvailableConnector = Array.isArray(detail?.connectors) ? !!detail?.connectors?.find((c) => String(c?.status || '').toLowerCase() === 'available') : true;
    return wsOnline && okStatus && hasAvailableConnector;
  }, [chargeBoxId, detail]);
  const canStop = useMemo(() => !!chargeBoxId && typeof txId === 'number', [chargeBoxId, txId]);

  const onStart = useCallback(async () => {
    if (!chargeBoxId) return;
    setLoading(true); setScreenState('starting'); setCmdError(undefined); setStopStatus('Confirmando início…'); setCommandId(undefined);
    try {
      const idTag = user?.publicId ?? 'DEMO-123456';
      const res = await startChargingFlow({ chargeBoxId, idTag, connectorId: 1 });
      if (res.commandId) setCommandId(res.commandId);
      if (res.status !== 'accepted' && res.status !== 'completed') { throw new Error(`Start não aceito: ${res.status}`); }
      setStopStatus('Sessão iniciada');
      // Aguarda confirmação de StartTransaction antes de marcar como "charging"
      let active = await getActiveDetail(chargeBoxId).catch(() => undefined);
      const startWait = Date.now();
      while (!(active?.session?.transaction_id) && Date.now() - startWait < 30000) {
        await new Promise((r) => setTimeout(r, 1500));
        active = await getActiveDetail(chargeBoxId).catch(() => undefined);
      }
      let tid = active?.session?.transaction_id as number | undefined;
      if (typeof tid !== 'number') {
        // fallback: persistir último tx e usar navegação para sessão ativa
        try {
          const last = await http<any>(`/v1/debug/ocpp/last-tx/${chargeBoxId}`, { timeoutMs: 10000 });
          tid = (last?.transaction_id ?? last?.txId ?? last?.tx_id) as number | undefined;
        } catch {}
      }
      if (typeof tid === 'number') { await setJson(`ACTIVE_TX_${chargeBoxId}`, { transaction_id: tid, at: new Date().toISOString() }); }
      if (typeof tid === 'number') { setTxId(tid); setScreenState('charging'); }
      else setScreenState('starting');
      // Navega para a tela de sessão ativa
      try { nav.navigate('ChargingSession', { chargeBoxId }); } catch {}
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) setCmdError('Não autorizado: verifique sua chave de API.');
      else if (status === 409) setCmdError('Carregador offline ou indisponível. Tente novamente quando online.');
      else setCmdError('Falha ao iniciar: ' + (e?.message ?? 'erro desconhecido'));
      setScreenState('error');
    }
    setLoading(false);
  }, [chargeBoxId, user]);

  const onStop = useCallback(async () => {
    if (!chargeBoxId) return;
    setLoading(true); setScreenState('stopping'); setCmdError(undefined); setStopStatus('Aguardando confirmação…'); setCommandId(undefined);
    try {
      const res = await stopChargingFlow({ chargeBoxId });
      const cmdId = res?.commandId ?? (res as any)?.id; if (cmdId) setCommandId(cmdId);
      // Aceitar 'pending' como transitório; confirmar via detalhe ativo
      if (!['accepted','completed','pending'].includes(res.status)) { throw new Error(`Stop não aceito: ${res.status}`); }
      const active = await getActiveDetail(chargeBoxId).catch(() => undefined);
      const tid = active?.session?.transaction_id; setTxId(tid);
      setScreenState(tid ? 'charging' : 'stopped');
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) setCmdError('Não autorizado: verifique sua chave de API.');
      else if (status === 409) setCmdError('Carregador offline ou indisponível.');
      else setCmdError('Falha ao encerrar: ' + (e?.message ?? 'erro desconhecido'));
      setScreenState('error');
    }
    setLoading(false);
  }, [chargeBoxId]);

  const statusLabel = useMemo(() => {
    const s = String(detail?.overallStatus || '').toLowerCase();
    if (!s) return 'Desconhecido';
    if (['available','preparing','suspendedev','finishing','ready'].includes(s)) return 'Disponível';
    if (['charging','busy','occupied'].includes(s)) return 'Ocupado';
    if (['faulted','unavailable','offline'].includes(s)) return 'Offline';
    return 'Desconhecido';
  }, [detail?.overallStatus]);

  const openInGoogleMaps = useCallback(() => {
    const lat = detail?.coords?.lat; const lon = detail?.coords?.lon;
    if (typeof lat === 'number' && typeof lon === 'number') {
      const url = `https://www.google.com/maps?q=${lat},${lon}`;
      try { Linking.openURL(url); } catch {}
    }
  }, [detail?.coords]);

  return (
    <View style={{ flex: 1, backgroundColor: UI_TOKENS.colors.tabBg }}>
      {/* Header */}
      <View style={{ backgroundColor: UI_TOKENS.colors.headerBg, paddingTop: insets.top + 8, paddingBottom: 12, alignItems: 'center' }}>
        <Text style={{ color: UI_TOKENS.colors.white, fontSize: 18, fontWeight: '600' }}>{detail?.name || chargeBoxId || 'Carregador'}</Text>
      </View>
      <ScrollView contentInset={{ bottom: UI_TOKENS.sizes.tabH + insets.bottom }} contentContainerStyle={{ paddingBottom: UI_TOKENS.sizes.tabH + insets.bottom }}>
        {/* Loading & Error */}
        {loading && (
          <View style={{ padding: 16 }}>
            <Text>Carregando...</Text>
          </View>
        )}
        {error && (
          <View style={{ padding: 16, backgroundColor: '#FDE8E8', margin: 16, borderRadius: 12 }}>
            <Text style={{ color: '#B91C1C' }}>{error}</Text>
          </View>
        )}

        {/* Detail Card */}
        {!!detail && (
          <View style={{ margin: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>{detail.name || chargeBoxId}</Text>
            {!!detail.address && <Text style={{ color: '#6B7280' }}>{detail.address}</Text>}
            <View style={{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6' }}>
              <Text style={{ fontWeight: '600' }}>Status: {statusLabel}</Text>
            </View>
            {/* Connectors */}
            {!!detail.connectors && detail.connectors.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: '600' }}>Conectores</Text>
                {detail.connectors.map((c, idx) => (
                  <View key={`${c.id || idx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text>{`#${c.id ?? idx + 1} • ${c.type ?? 'Tipo'}${typeof c.powerKw === 'number' ? ` • ${c.powerKw} kW` : ''}`}</Text>
                    {!!c.status && <Text style={{ color: '#6B7280' }}>{c.status}</Text>}
                  </View>
                ))}
              </View>
            )}
            {/* Actions */}
            <View style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
              <Pressable accessibilityRole="button" onPress={openInGoogleMaps} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: UI_TOKENS.colors.recenterBg }}>
                <Text style={{ color: UI_TOKENS.colors.tabActive, fontWeight: '600' }}>Abrir no Google Maps</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={screenState === 'charging' ? onStop : onStart} disabled={loading || (screenState === 'charging' ? !canStop : !canStart)} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: UI_TOKENS.colors.brand, opacity: (loading || (screenState === 'charging' ? !canStop : !canStart)) ? 0.6 : 1 }}>
                <Text style={{ color: UI_TOKENS.colors.brandText, fontWeight: '600' }}>{screenState === 'charging' ? 'Parar Carregamento' : 'Iniciar Carregamento'}</Text>
              </Pressable>
            </View>
            {(screenState === 'starting' || screenState === 'stopping') && (
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LoadingSpinner size={18} />
                <Text style={{ color: '#6B7280' }}>{stopStatus || (screenState === 'starting' ? 'Confirmando início…' : 'Aguardando confirmação…')}</Text>
              </View>
            )}
            {!!cmdError && (
              <View style={{ marginTop: 12, backgroundColor: '#FDE8E8', padding: 8, borderRadius: 8 }}>
                <Text style={{ color: '#B91C1C' }}>{cmdError}</Text>
              </View>
            )}
            {typeof commandId !== 'undefined' && (screenState === 'starting' || screenState === 'stopping') && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: '#9CA3AF', fontSize: 12 }}>commandId: {String(commandId)}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}