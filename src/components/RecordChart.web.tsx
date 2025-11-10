import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { RecordPoint } from '../types';

type Props = {
  data: RecordPoint[];
  empty?: boolean;
};

export default function RecordChart({ data, empty }: Props) {
  const { width } = useWindowDimensions();
  const chartW = Math.round(width * 0.8);
  const chartH = 240;

  const chartData = (data || []).map((d) => ({ x: d.label, y: empty ? 0 : Math.max(0, d.totalMoney), p: d }));
  const maxY = useMemo(() => Math.max(1, ...chartData.map((d) => d.y || 0)), [chartData]);
  const barWidth = Math.max(24, Math.floor(chartW / 7));
  const gap = Math.floor((chartW - barWidth * chartData.length) / (chartData.length + 1));
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <View style={{ width: chartW, height: chartH, alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <View key={String(f)} style={{ position: 'absolute', top: chartH * f, left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: chartH - 40, width: chartW }}>
        {chartData.map((d, i) => {
          const h = Math.round(((d.y || 0) / maxY) * (chartH - 60));
          const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.p?.totalMoney || 0);
          const kwh = new Intl.NumberFormat('pt-BR').format(d.p?.kwh || 0);
          const min = new Intl.NumberFormat('pt-BR').format(d.p?.minutes || 0);
          return (
            <View key={d.x} style={{ marginHorizontal: gap / 2, alignItems: 'center' }}>
              <Pressable accessibilityRole="button" onPress={() => setSelected(i)} style={{ width: barWidth, height: h, backgroundColor: '#2BD3C6', borderRadius: 6 }} />
              <Text style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>{d.x}</Text>
              {selected === i && (
                <View style={{ position: 'absolute', bottom: h + 28, backgroundColor: '#111827', padding: 8, borderRadius: 8 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 12 }}>{d.x}</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 12 }}>Total: {money}</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 12 }}>Energia: {kwh} kWh</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 12 }}>Duração: {min} min</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}