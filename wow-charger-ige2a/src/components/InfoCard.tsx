import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  totalMoney: number;
  kwh: number;
  minutes: number;
};

export default function InfoCard({ totalMoney, kwh, minutes }: Props) {
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMoney || 0);
  const kwhFmt = new Intl.NumberFormat('pt-BR').format(kwh || 0);
  const minFmt = new Intl.NumberFormat('pt-BR').format(minutes || 0);

  const Item = ({ icon, title, value }: { icon: any; title: string; value: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <Ionicons name={icon} size={20} color="#374151" />
      <View>
        <Text style={{ color: '#374151', fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: '#6B7280' }}>{value}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, elevation: 2 }}>
      <Item icon="cash-outline" title="Valor total" value={currency} />
      <Item icon="battery-charging-outline" title="Capacidade de carga" value={`${kwhFmt} kWh`} />
      <Item icon="time-outline" title="Duração da carga" value={`${minFmt} min`} />
    </View>
  );
}