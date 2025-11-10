import React, { useState } from 'react';
import { Modal, View, Text, Pressable, Switch } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: { freeParking?: boolean; idle?: boolean; status?: ('available' | 'busy' | 'offline')[]; minPowerKw?: number }) => void;
};

export default function FilterModal({ visible, onClose, onApply }: Props) {
  const [freeParking, setFreeParking] = useState(false);
  const [idle, setIdle] = useState(true);
  const [minPowerKw, setMinPowerKw] = useState<number | undefined>(undefined);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Filtros rápidos</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text>Estacionamento grátis</Text>
          <Switch value={freeParking} onValueChange={setFreeParking} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text>Idle (conector disponível)</Text>
          <Switch value={idle} onValueChange={setIdle} />
        </View>
        <View style={{ marginVertical: 12 }}>
          <Text>Potência mínima (kW)</Text>
          {/* placeholder simples: alterna entre 7 e 50 */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Pressable onPress={() => setMinPowerKw(7)} style={{ padding: 8, backgroundColor: '#F2F2F7', borderRadius: 8 }}><Text>7</Text></Pressable>
            <Pressable onPress={() => setMinPowerKw(50)} style={{ padding: 8, backgroundColor: '#F2F2F7', borderRadius: 8 }}><Text>50</Text></Pressable>
            <Pressable onPress={() => setMinPowerKw(undefined)} style={{ padding: 8, backgroundColor: '#F2F2F7', borderRadius: 8 }}><Text>Any</Text></Pressable>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={onClose}><Text style={{ color: '#8E8E93' }}>Cancelar</Text></Pressable>
          <Pressable
            onPress={() => onApply({
              freeParking,
              idle,
              status: [idle && 'available'].filter(Boolean) as any,
              minPowerKw,
            })}
          >
            <Text style={{ color: '#0A84FF' }}>Aplicar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}