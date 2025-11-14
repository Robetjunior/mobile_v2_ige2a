import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  session: 'AUTH_SESSION',
  email: 'AUTH_EMAIL',
  remember: 'AUTH_REMEMBER',
} as const;

function isWeb(): boolean {
  // Expo web: window existe e plataforma é web
  try { return typeof window !== 'undefined' && !!(window as any).document; } catch { return false; }
}

export async function saveSession(session: any) {
  const data = JSON.stringify(session ?? {});
  if (isWeb()) {
    try { window.localStorage.setItem(KEYS.session, data); } catch {}
    return;
  }
  try {
    // Tokens são sensíveis: preferir SecureStore em mobile
    await SecureStore.setItemAsync(KEYS.session, data);
  } catch {
    await AsyncStorage.setItem(KEYS.session, data);
  }
}

export async function loadSession<T = any>(): Promise<T | undefined> {
  if (isWeb()) {
    try { const s = window.localStorage.getItem(KEYS.session); return s ? JSON.parse(s) as T : undefined; } catch { return undefined; }
  }
  try {
    const s = await SecureStore.getItemAsync(KEYS.session);
    return s ? JSON.parse(s) as T : undefined;
  } catch {
    const s = await AsyncStorage.getItem(KEYS.session);
    return s ? JSON.parse(s) as T : undefined;
  }
}

export async function clearSession() {
  if (isWeb()) {
    try { window.localStorage.removeItem(KEYS.session); } catch {}
    return;
  }
  try { await SecureStore.deleteItemAsync(KEYS.session); } catch {}
  try { await AsyncStorage.removeItem(KEYS.session); } catch {}
}

export async function setRememberEmail(email?: string) {
  const remember = !!email;
  try {
    await AsyncStorage.setItem(KEYS.remember, JSON.stringify(remember));
    if (remember) await AsyncStorage.setItem(KEYS.email, email || ''); else await AsyncStorage.removeItem(KEYS.email);
  } catch {}
}

export async function getRememberEmail(): Promise<{ remember: boolean; email?: string }> {
  try {
    const r = await AsyncStorage.getItem(KEYS.remember);
    const remember = r ? JSON.parse(r) as boolean : false;
    const email = remember ? (await AsyncStorage.getItem(KEYS.email) || undefined) : undefined;
    return { remember, email };
  } catch { return { remember: false, email: undefined }; }
}