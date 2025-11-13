import React from 'react';
import { View } from 'react-native';

type Props = {
  rows?: number;
  gap?: number;
  height?: number;
  widthPattern?: number[]; // percentages
  style?: any;
};

export default function Skeleton({ rows = 3, gap = 8, height = 12, widthPattern = [90, 70, 80, 60], style }: Props) {
  const blocks = Array.from({ length: rows });
  return (
    <View style={[{ gap }, style]}> 
      {blocks.map((_, i) => (
        <View
          key={i}
          style={{
            height,
            borderRadius: 8,
            backgroundColor: '#E5E7EB',
            width: `${widthPattern[i % widthPattern.length]}%`,
          }}
        />
      ))}
    </View>
  );
}