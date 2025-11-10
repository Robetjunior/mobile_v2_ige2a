import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import * as Victory from 'victory-native';
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

  return (
    <View style={{ alignItems: 'center' }}>
      {!Victory || !Victory.VictoryChart ? (
        <Text style={{ color: '#6B7280' }}>Módulo de gráfico indisponível nesta plataforma</Text>
      ) : (
      <Victory.VictoryChart
        width={chartW}
        height={chartH}
        domainPadding={{ x: 30, y: 20 }}
        animate={{ duration: 500, easing: 'quadInOut' }}
      >
        <Victory.VictoryAxis style={{ grid: { stroke: 'rgba(0,0,0,0.08)' } }} />
        <Victory.VictoryAxis dependentAxis style={{ grid: { stroke: 'rgba(0,0,0,0.08)' } }} tickFormat={() => ''} />
        <Victory.VictoryBar
          data={chartData}
          labels={({ datum }: { datum: any }) => {
            const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(datum.p?.totalMoney || 0);
            const kwh = new Intl.NumberFormat('pt-BR').format(datum.p?.kwh || 0);
            const min = new Intl.NumberFormat('pt-BR').format(datum.p?.minutes || 0);
            return `${datum.x}\nTotal: ${money}\nEnergia: ${kwh} kWh\nDuração: ${min} min`;
          }}
          labelComponent={<Victory.VictoryTooltip constrainToVisibleArea />}
          style={{ data: { fill: '#2BD3C6' } }}
          barRatio={0.7}
        />
      </Victory.VictoryChart>
      )}
    </View>
  );
}