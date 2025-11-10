import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SessionMetrics } from '../types';

type Props = {
  metrics: SessionMetrics;
  onViewDetails: () => void;
  onStop: () => void;
};

export default function RealTimeMetrics({ metrics, onViewDetails, onStop }: Props) {
  return (
    <View style={{ padding: 16, backgroundColor: '#F2F2F7' }}>
      <Text style={{ fontWeight: '600', marginBottom: 8 }}>Sessão ativa</Text>
      <Text>{metrics.energyKwh.toFixed(2)} kWh • {metrics.powerKw} kW • {metrics.durationMinutes} min</Text>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
        <Pressable onPress={onViewDetails} accessibilityRole="button" accessibilityLabel="Ver detalhes">
          <Text style={{ color: '#0A84FF' }}>Ver detalhes</Text>
        </Pressable>
        <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Parar sessão">
          <Text style={{ color: '#FF3B30' }}>Parar sessão</Text>
        </Pressable>
      </View>
    </View>
  );
}