import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  noTopBorder?: boolean;
};

export default function ListItem({ icon, label, onPress, noTopBorder }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.row, !noTopBorder && styles.topBorder, pressed && { opacity: 0.92 }]}>
      <Ionicons name={icon} size={22} color={Colors.textBody} style={{ marginRight: 12 }} />
      <Text style={[Typography.body, { color: Colors.textBody }]}>{label}</Text>
    </Pressable>
  );
}

export const ListCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.card}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});