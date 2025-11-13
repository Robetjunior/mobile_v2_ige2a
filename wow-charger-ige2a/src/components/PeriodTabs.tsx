import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { UI_TOKENS } from '../constants';
import { PeriodType } from '../types';

type Props = { value: PeriodType; onChange: (v: PeriodType) => void };

export default function PeriodTabs({ value, onChange }: Props) {
  const isMonth = value === 'month';
  const isYear = value === 'year';
  const baseStyle = { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 } as const;

  return (
    <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alternar para modo Mês"
        onPress={() => onChange('month')}
        style={[baseStyle, { backgroundColor: isMonth ? UI_TOKENS.colors.brand : '#F3F4F6' }]}
      >
        <Text style={{ color: isMonth ? UI_TOKENS.colors.brandText : '#374151', fontWeight: '600' }}>Mês</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alternar para modo Ano"
        onPress={() => onChange('year')}
        style={[baseStyle, { backgroundColor: isYear ? UI_TOKENS.colors.brand : '#F3F4F6' }]}
      >
        <Text style={{ color: isYear ? UI_TOKENS.colors.brandText : '#374151', fontWeight: '600' }}>Ano</Text>
      </Pressable>
    </View>
  );
}