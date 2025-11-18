import React from 'react';
import { View, Text, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { useUserHistory } from '../hooks/useUserHistory';
import { useAuth } from '../../auth/context/AuthContext';
import { UI_TOKENS } from '../../constants';

export default function HistoryScreen() {
  const { session } = useAuth();
  const { data, isLoading, isError, refetch } = useUserHistory();

  if (!session) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6B7280' }}>Faça login para ver seu histórico</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <Text style={{ color: '#991B1B', marginBottom: 10 }}>Falha ao carregar histórico</Text>
        <Pressable accessibilityRole="button" onPress={() => refetch()} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E5E7EB' }}>
          <Text style={{ color: '#0A84FF' }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  const items = (data || []);
  return (
    <View style={{ flex: 1, backgroundColor: UI_TOKENS.colors.tabBg }}>
      <FlatList
        data={items}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={{ marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ fontWeight: '700', color: '#111827' }}>{item.chargerName || item.chargeBoxId || '—'}</Text>
            <View style={{ height: 6 }} />
            <Text style={{ color: '#6B7280' }}>Início: {formatDate(item.started_at)}</Text>
            <Text style={{ color: '#6B7280' }}>Duração: {formatDuration(item.duration_minutes)}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Chip label={`${formatKwh(item.energy_kwh)} kWh`} color="#F3F4F6" />
              <Chip label={`${formatMoney(item.price_total)}`} color="#F3F4F6" />
              {!!item.status && <Chip label={item.status} color="#E5E7EB" />}
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <Text style={{ color: '#6B7280' }}>Nenhuma sessão encontrada</Text>
          </View>
        )}
      />
    </View>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  } catch { return '—'; }
}

function formatDuration(min?: number) {
  if (!min || !Number.isFinite(min)) return '—';
  const m = Math.floor(min);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}min` : `${mm}min`;
}

function formatKwh(kwh?: number) {
  try { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(kwh || 0); } catch { return String(kwh ?? 0); }
}

function formatMoney(v?: number) {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); } catch { return String(v ?? 0); }
}

function Chip({ label, color = '#F3F4F6' }: { label: string; color?: string }) {
  return (
    <View style={{ backgroundColor: color, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color: '#374151', fontWeight: '600' }}>{label}</Text>
    </View>
  );
}