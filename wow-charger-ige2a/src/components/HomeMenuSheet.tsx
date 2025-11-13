import React from 'react';
import { View, Text, Pressable } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: 'Cards' | 'Settings' | 'Support' | 'About') => void;
};

export default function HomeMenuSheet({ visible, onClose, onNavigate }: Props) {
  if (!visible) return null;
  const labelsPtBr: Record<Props['onNavigate'] extends (route: infer R) => any ? R : never, string> = {
    Cards: 'Meu Cartão',
    Settings: 'Configurações',
    Support: 'Suporte',
    About: 'Sobre',
  };
  return (
    <View accessibilityViewIsModal={false} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <View style={{ width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2 }} />
      </View>
      {(['Cards', 'Settings', 'Support', 'About'] as const).map((route) => (
        <Pressable key={route} onPress={() => { onNavigate(route); onClose(); }} accessibilityRole="button" style={{ paddingVertical: 12 }}>
          <Text style={{ fontSize: 16 }}>{labelsPtBr[route]}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onClose} accessibilityRole="button" style={{ paddingVertical: 12 }}>
        <Text style={{ color: '#8E8E93' }}>Fechar</Text>
      </Pressable>
    </View>
  );
}