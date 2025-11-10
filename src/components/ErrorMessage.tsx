import React from 'react';
import { View, Text } from 'react-native';

export default function ErrorMessage({ message }: { message: string }) {
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: '#FF3B30' }}>{message}</Text>
    </View>
  );
}