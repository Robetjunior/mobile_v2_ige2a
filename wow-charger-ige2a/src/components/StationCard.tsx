import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChargerStation } from '../types';
import { useFavoritesStore } from '../stores/favoritesStore';

type Props = {
  station: ChargerStation;
  onPress: (id: string) => void;
  onStart?: (id: string) => void;
};

function Card({ station, onPress, onStart }: Props) {
  const toggle = useFavoritesStore((s) => s.toggle);
  const isFav = useFavoritesStore((s) => s.isFav(station.id));
  return (
    <Pressable onPress={() => onPress(station.id)} accessibilityRole="button" style={{ padding: 16, borderBottomColor: '#E5E5EA', borderBottomWidth: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontWeight: '600' }}>{station.name}</Text>
          {!!station.distanceKm && <Text style={{ color: '#8E8E93' }}>{station.distanceKm.toFixed(1)} km • {station.status}</Text>}
          {!!station.powerKw && <Text style={{ color: '#8E8E93' }}>{station.powerKw} kW</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Favoritar" onPress={() => toggle(station.id)}>
            <Text style={{ color: isFav ? '#FF2D55' : '#8E8E93' }}>{isFav ? '♥' : '♡'}</Text>
          </Pressable>
          {onStart && (
            <Pressable accessibilityRole="button" accessibilityLabel="Iniciar carregamento" onPress={() => onStart(station.id)}>
              <Text style={{ color: '#0A84FF' }}>Iniciar</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(Card);