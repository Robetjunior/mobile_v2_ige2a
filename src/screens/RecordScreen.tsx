import React, { useEffect, useMemo, useState } from 'react';
import { Appearance, SafeAreaView, View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { PeriodType, RecordPoint, RecordResponse } from '../types';
import PeriodTabs from '../components/PeriodTabs';
import PeriodPicker from '../components/PeriodPicker';
import RecordChart from '../components/RecordChart';
import InfoCard from '../components/InfoCard';
import { fetchRecord } from '../services/recordService';

// Locale handled manually in components to avoid bundler issues on web

export default function RecordScreen() {
  const colorScheme = Appearance.getColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecordResponse | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchRecord(periodType, anchorDate)
      .then((res) => { if (!active) return; setData(res); })
      .catch(() => { if (!active) return; setError('Falha ao carregar dados'); })
      .finally(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, [periodType, anchorDate]);

  const series5: RecordPoint[] = useMemo(() => {
    const raw = data?.series || [];
    // já deve vir em ordem; garantir 5 itens
    if (raw.length >= 5) return raw.slice(-5);
    const pad = Array.from({ length: Math.max(0, 5 - raw.length) }, () => ({ label: '', totalMoney: 0, kwh: 0, minutes: 0 }));
    return [...pad, ...raw].slice(-5);
  }, [data]);

  const summary = data?.summary || { totalMoney: 0, kwh: 0, minutes: 0 };
  const empty = series5.every((s) => (s.totalMoney || 0) === 0);

  const headerBg = isDark ? '#0F172A' : '#FFFFFF';
  const headerText = isDark ? '#E5E7EB' : '#111827';
  const topPad = Platform.OS === 'android' ? insets.top + 32 : insets.top + 20;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: topPad, paddingBottom: 12, backgroundColor: headerBg, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ color: headerText, fontSize: 18, fontWeight: '700', textAlign: 'center', flex: 1 }}>Registro de Pedidos</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={() => { /* vazio por ora */ }}>
          <Text style={{ color: headerText, fontSize: 20 }}>≡</Text>
        </Pressable>
      </View>

      {/* Tabs + Picker */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <PeriodTabs value={periodType} onChange={setPeriodType} />
        <View style={{ height: 12 }} />
        <PeriodPicker periodType={periodType} anchorDate={anchorDate} onChange={setAnchorDate} />
      </View>

      {/* Amount statistics */}
      <View style={{ marginHorizontal: 16, backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderRadius: 14, padding: 14, elevation: 2 }}>
        <Text style={{ color: isDark ? '#E5E7EB' : '#111827', fontWeight: '700', marginBottom: 8 }}>Estatísticas de valores</Text>

        {loading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', height: 240 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <RecordChart data={series5} empty={empty} />
        )}

        {empty && !loading && (
          <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 8 }}>Sem dados para este período</Text>
        )}
      </View>

      <View style={{ height: 12 }} />

      {/* Information */}
      <View style={{ marginHorizontal: 16 }}>
        <InfoCard totalMoney={summary.totalMoney} kwh={summary.kwh} minutes={summary.minutes} />
      </View>

      {/* Erro */}
      {error && (
        <View style={{ marginTop: 12, marginHorizontal: 16, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12 }}>
          <Text style={{ color: '#991B1B' }}>Erro ao carregar dados</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Tentar novamente" onPress={() => { setError(null); setLoading(true); fetchRecord(periodType, anchorDate).then(setData).catch(() => setError('Falha ao carregar dados')).finally(() => setLoading(false)); }}>
            <Text style={{ color: '#0A84FF', marginTop: 8 }}>Tentar novamente</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}