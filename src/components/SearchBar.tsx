import React, { useCallback, useState } from 'react';
import { View, TextInput, StyleProp, TextStyle, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UI_TOKENS } from '../constants';

type Props = {
  placeholder?: string;
  onChangeText: (text: string) => void;
  debounceMs?: number;
  inputStyle?: StyleProp<TextStyle>;
  onOpenMenu?: () => void;
};

export default function SearchBar({ placeholder = 'Digite termos de busca', onChangeText, debounceMs = 300, inputStyle, onOpenMenu }: Props) {
  const [value, setValue] = useState('');
  const debounced = useCallback(
    (text: string) => {
      const handler = setTimeout(() => onChangeText(text), debounceMs);
      return () => clearTimeout(handler);
    },
    [onChangeText, debounceMs]
  );

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: UI_TOKENS.colors.searchBg,
        borderRadius: UI_TOKENS.radius.search,
        height: UI_TOKENS.sizes.searchH,
        paddingHorizontal: 14,
      }}>
        <Ionicons name="search" size={18} color={UI_TOKENS.colors.textLight} style={{ marginRight: 8 }} />
        <TextInput
          value={value}
          onChangeText={(t) => {
            setValue(t);
            debounced(t);
          }}
          placeholder={placeholder}
          accessibilityRole="search"
          accessibilityLabel="Barra de busca"
          style={[{ flex: 1, color: UI_TOKENS.colors.white, paddingVertical: 10 }, inputStyle]}
          placeholderTextColor={UI_TOKENS.colors.textLight}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={onOpenMenu} style={{ height: 24, width: 24, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
          <Ionicons name="menu" size={20} color={UI_TOKENS.colors.white} />
        </Pressable>
      </View>
    </View>
  );
}