import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type DuoTileProps = {
  left: { label: string; icon: 'star' | 'wallet'; color?: string; onPress: () => void };
  right: { label: string; icon: 'star' | 'wallet'; color?: string; onPress: () => void };
};

export default function DuoTile({ left, right }: DuoTileProps) {
  const renderIcon = (name: 'star' | 'wallet', color?: string) => {
    switch (name) {
      case 'star':
        return <Ionicons name="star" size={28} color={color || Colors.yellow} />;
      case 'wallet':
        return <MaterialCommunityIcons name="wallet" size={28} color={color || Colors.pink} />;
    }
  };

  const Tile = ({ item }: { item: DuoTileProps['left'] }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
      onPress={item.onPress}
    >
      {renderIcon(item.icon, item.color)}
      <Text style={[Typography.itemLabel, styles.tileLabel]}>{item.label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <Tile item={left} />
      <View style={styles.divisor} />
      <Tile item={right} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
  },
  tile: {
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    color: Colors.textBody,
    marginTop: 8,
  },
  divisor: {
    width: 1,
    height: 48,
    backgroundColor: Colors.divider,
  },
});