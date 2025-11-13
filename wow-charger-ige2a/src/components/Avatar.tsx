import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  uri?: string;
  size?: number;
};

export default function Avatar({ uri, size = 112 }: Props) {
  const radius = size / 2;
  return (
    <View style={[styles.container, { height: size, width: size, borderRadius: radius }]}
      accessibilityRole="image" accessibilityLabel="Avatar do usuário">
      {uri ? (
        <Image source={{ uri }} style={{ height: size, width: size, borderRadius: radius }} />
      ) : (
        <Ionicons name="person" size={size * 0.45} color={Colors.white} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});