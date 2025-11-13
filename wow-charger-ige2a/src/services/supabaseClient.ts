import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Usa variáveis públicas do Expo (.env) para configurar o Supabase
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = SUPABASE_URL || 'http://localhost';
    const key = SUPABASE_ANON_KEY || 'anon-key';
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      // Aviso amigável em desenvolvimento; UI continuará funcional sem Supabase configurado
      try { console.warn('Supabase não configurado: usando placeholders. Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.'); } catch {}
    }
    client = createClient(url, key, {
      auth: {
        persistSession: false, // vamos persistir manualmente usando SecureStore/AsyncStorage
        autoRefreshToken: true,
        detectSessionInUrl: false, // controlaremos via deep link listener
      },
    });
  }
  return client!;
}

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  user?: { id: string; email?: string | null };
};