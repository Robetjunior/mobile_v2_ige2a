import React from 'react';
import { View, TextInput, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  icon: 'person' | 'lock' | 'mail';
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
};

export default function AuthInput({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType }: Props) {
  const iconName = icon === 'person' ? 'person' : icon === 'lock' ? 'lock-closed' : 'mail';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderColor: '#2C2C2E', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 }}>
      <Ionicons name={iconName as any} size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={{ color: '#F9FAFB', flex: 1 }}
      />
    </View>
  );
}