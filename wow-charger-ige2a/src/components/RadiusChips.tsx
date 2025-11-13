import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { DISTANCE_FILTERS, UI_TOKENS } from '../constants';

type Props = {
  value: number;
  onChange: (r: number) => void;
  options?: number[];
};

const DEFAULTS = DISTANCE_FILTERS;

export default function RadiusChips({ value, onChange, options = DEFAULTS }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 16 }}>
      {options.map((r) => {
        const active = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            accessibilityRole="button"
            accessibilityLabel={`Filtro raio ${r} KM`}
            style={{
              paddingHorizontal: 18,
              height: UI_TOKENS.sizes.chipH,
              borderRadius: UI_TOKENS.radius.chip,
              minWidth: 96,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? UI_TOKENS.colors.brand : UI_TOKENS.colors.chipBg,
              borderWidth: 1,
              borderColor: active ? UI_TOKENS.colors.brand : UI_TOKENS.colors.chipBorder,
            }}
          >
            <Text style={{ color: active ? UI_TOKENS.colors.brandText : UI_TOKENS.colors.chipText, fontWeight: active ? '700' : '600' }}>{r} KM</Text>
          </Pressable>
        );
      })}
    </View>
  );
}