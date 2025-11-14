import React from 'react';
import { Pressable, Text, ViewStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'google' | 'apple';
  style?: ViewStyle;
  disabled?: boolean;
};

export default function AuthButton({ title, onPress, variant = 'primary', style, disabled }: Props) {
  const base: ViewStyle = {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const variants: Record<string, ViewStyle> = {
    primary: { backgroundColor: '#00D1CC' },
    secondary: { backgroundColor: '#FFFFFF' },
    google: { backgroundColor: '#FFFFFF' },
    apple: { backgroundColor: '#000000' },
  };
  const textColor: Record<string, string> = {
    primary: '#003332',
    secondary: '#111827',
    google: '#111827',
    apple: '#FFFFFF',
  };
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ([base, variants[variant], style, pressed && { opacity: 0.9 }])}>
      {variant === 'google' || variant === 'apple' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={variant === 'google' ? 'logo-google' : 'logo-apple'} size={18} color={textColor[variant]} style={{ marginRight: 8 }} />
          <Text style={{ color: textColor[variant], fontWeight: '600' }}>{title}</Text>
        </View>
      ) : (
        <Text style={{ color: textColor[variant], fontWeight: '600' }}>{title}</Text>
      )}
    </Pressable>
  );
}