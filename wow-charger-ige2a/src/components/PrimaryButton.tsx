import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

type Props = { label: string; onPress: () => void };

export default function PrimaryButton({ label, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.92 }]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.darkGrayBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});