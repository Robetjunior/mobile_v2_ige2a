import React from 'react';
import { View } from 'react-native';
import { Colors } from '../theme/colors';

export default function Divider({ height = 1 }: { height?: number }) {
  return <View style={{ height, backgroundColor: Colors.divider, width: '100%' }} />;
}