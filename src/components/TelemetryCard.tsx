import React from 'react';
import { View, Text } from 'react-native';
import { UI_TOKENS } from '../constants';

type Props = {
  value?: string | number;
  label: string;
  unit?: string;
  basisPercent?: number;
  compact?: boolean;
};

export default function TelemetryCard({ value, label, unit, basisPercent, compact }: Props) {
  const valueText = typeof value === 'number' ? String(value) : (value ?? '--');
  const basis = typeof basisPercent === 'number' ? `${basisPercent}%` : '30%';
  const vFont = compact ? 16 : 18;
  const uFont = compact ? 12 : 14;
  const padV = compact ? 10 : 12;
  return (
    <View
      style={{
        minWidth: 100,
        flexGrow: 0,
        flexBasis: basis,
        paddingVertical: padV,
        paddingHorizontal: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: vFont, fontWeight: '700', color: UI_TOKENS.colors.brand }}>
        {valueText}
        {unit ? <Text style={{ fontSize: uFont, fontWeight: '600', color: '#6B7280' }}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={{ marginTop: 2, color: '#6B7280', fontSize: uFont }}>{label}</Text>
    </View>
  );
}
