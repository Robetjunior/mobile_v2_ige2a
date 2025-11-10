import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onStart: () => void;
};

export default function RecentDrawer({ visible, title, onClose, onStart }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <View style={{ padding: 16, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Text style={{ fontWeight: '600', fontSize: 16, marginBottom: 8 }}>{title}</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={onStart}><Text style={{ color: '#0A84FF' }}>Iniciar carregamento</Text></Pressable>
            <Pressable onPress={onClose}><Text style={{ color: '#8E8E93' }}>Fechar</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}