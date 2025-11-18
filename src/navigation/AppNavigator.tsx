import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import { View, Text } from 'react-native';
import ChargeScreen from '../screens/ChargeScreen';
import ChargerDetailScreen from '../chargers/screens/ChargerDetailScreen';
import MeScreen from '../screens/Me/MeScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import CardsScreen from '../screens/Cards/CardsScreen';
import RecentlyUsedScreen from '../screens/RecentlyUsed/RecentlyUsedScreen';
import AboutScreen from '../screens/About/AboutScreen';
import ChargingSession from '../sessions/screens/SessionScreen';

export type RootStackParamList = {
  Tabs: undefined;
  ChargerDetail: { chargeBoxId: string };
  QRScanner: undefined;
  Charge: { chargeBoxId?: string };
  ChargingSession: { chargeBoxId?: string };
  Cards: undefined;
  Settings: undefined;
  Support: undefined;
  About: undefined;
  RecentlyUsed: undefined;
  // Rota técnica para callback OAuth (não possui tela)
  AuthCallback: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Header actions removed; header controlled by Home screen per design.

function QRScannerScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>QR Scanner (placeholder)</Text>
    </View>
  );
}

// Charger detail is a full screen component

// Charge passa a ser a mesma tela usada na Tab, para suportar deep links de fallback se necessário.

function SimpleScreen({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{title}</Text>
    </View>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Tabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ChargerDetail" component={ChargerDetailScreen} options={{ title: 'Carregador' }} />
      <Stack.Screen name="Charge" component={ChargeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChargingSession" component={ChargingSession} options={{ title: 'Charging Session' }} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{ title: 'Scanner' }} />
      <Stack.Screen name="Cards" component={CardsScreen} options={{ title: 'Cards' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Support" children={() => <SimpleScreen title="Support" />} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
      <Stack.Screen name="RecentlyUsed" component={RecentlyUsedScreen} options={{ title: 'Recently Used' }} />
    </Stack.Navigator>
  );
}