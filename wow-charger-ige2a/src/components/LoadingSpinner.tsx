import React from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function LoadingSpinner() {
  return (
    <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="small" color="#0A84FF" />
    </View>
  );
}