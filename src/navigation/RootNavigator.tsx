import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { Platform } from 'react-native';
import { linking } from './linking';
import { AuthProvider, useAuth } from '../auth/context/AuthContext';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';

function Root() {
  const { session, loading } = useAuth();
  const bypassAuth = (__DEV__ === true) || process.env.EXPO_PUBLIC_BYPASS_AUTH === 'true' || Platform.OS === 'web';
  return (
    <NavigationContainer linking={linking} theme={{
      ...DefaultTheme,
      colors: { ...DefaultTheme.colors, background: '#fff' },
    }}>
      {loading ? null : (bypassAuth ? <AppNavigator /> : (session ? <AppNavigator /> : <AuthNavigator />))}
    </NavigationContainer>
  );
}

export default function RootNavigator() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}