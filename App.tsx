import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ensureApiKey } from './src/services/http';
import { DEFAULT_API_KEY } from './src/constants/env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3_000,
      gcTime: 60_000,
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 404 || error?.status === 409 || error?.status === 422) return false;
        return failureCount < 2;
      },
    },
  },
});

export default function App() {
  useEffect(() => {
    // Tenta garantir a API_KEY no boot (env, AsyncStorage, localStorage)
    ensureApiKey().catch(async () => {
      // Fallback de desenvolvimento: usar valor padrão e persistir
      try {
        const devKey = (DEFAULT_API_KEY || '').trim();
        if (devKey) {
          await AsyncStorage.setItem('API_KEY', devKey);
          try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('API_KEY', devKey); } catch {}
        }
      } catch {}
    });
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <QueryClientProvider client={queryClient}>
          <AppNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// estilos herdados pelos componentes existentes; App não define estilos próprios
