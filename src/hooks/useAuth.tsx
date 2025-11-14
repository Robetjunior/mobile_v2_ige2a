import React from 'react';
import { Linking, Platform } from 'react-native';
import { getSupabase, AuthSession } from '../services/supabaseClient';
import { clearSession, loadSession, saveSession, getRememberEmail, setRememberEmail } from '../services/sessionStorage';

type AuthState = {
  session?: AuthSession;
  loading: boolean;
  error?: string;
  email?: string;
  remember: boolean;
};

type AuthApi = {
  init: () => Promise<void>;
  signInWithPassword: (email: string, password: string, remember?: boolean) => Promise<boolean>;
  register: (email: string, password: string, username?: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signInWithApple: () => Promise<boolean>;
  signOut: () => Promise<void>;
  setRemember: (remember: boolean, email?: string) => Promise<void>;
};

const AuthContext = React.createContext<(AuthState & AuthApi) | undefined>(undefined);

// Normaliza email removendo aspas e espaços extras, e aplicando lower-case
function normalizeEmail(raw: string): string {
  return (raw || '')
    // remove espaços comuns
    .trim()
    // remove aspas simples/dobras no início/fim
    .replace(/^['"]+|['"]+$/g, '')
    // remove caracteres invisíveis comuns (zero-width, BOM)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ loading: true, remember: false });

  const supabase = React.useMemo(() => getSupabase(), []);

  const init = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const persisted = await loadSession<AuthSession>();
      const { remember, email } = await getRememberEmail();
      if (persisted?.access_token) {
        setState({ session: persisted, loading: false, error: undefined, email, remember });
      } else {
        setState({ loading: false, error: undefined, email, remember });
      }
    } catch (e: any) {
      setState({ loading: false, error: e?.message || 'Falha ao carregar sessão', remember: false });
    }
  }, []);

  // Listener de deep links para OAuth (google/apple)
  React.useEffect(() => {
    const sub = Linking.addEventListener('url', async (evt) => {
      const url = evt?.url || '';
      if (!url) return;
      try {
        const { data } = await supabase.auth.exchangeCodeForSession(url);
        if (data?.session?.access_token) {
          const sess: AuthSession = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token!,
            token_type: data.session.token_type!,
            expires_in: data.session.expires_in!,
            expires_at: data.session.expires_at!,
            user: { id: data.session.user.id, email: data.session.user.email },
          };
          await saveSession(sess);
          setState((s) => ({ ...s, session: sess }));
        }
      } catch {}
    });
    return () => { try { (sub as any)?.remove?.(); } catch {} };
  }, [supabase]);

  // Suporte ao fluxo web: ao recarregar após OAuth, processar fragmento/código
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const href = typeof window !== 'undefined' ? window.location.href : '';
      if (!href) return;
      (async () => {
        try {
          const { data } = await supabase.auth.exchangeCodeForSession(href);
          if (data?.session?.access_token) {
            const sess: AuthSession = {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token!,
              token_type: data.session.token_type!,
              expires_in: data.session.expires_in!,
              expires_at: data.session.expires_at!,
              user: { id: data.session.user.id, email: data.session.user.email },
            };
            await saveSession(sess);
            setState((s) => ({ ...s, session: sess }));
            // Limpa hash/params para evitar reprocessamento
            try { window.history.replaceState(null, '', window.location.pathname); } catch {}
          }
        } catch {}
      })();
    } catch {}
  }, [supabase]);

  const signInWithPassword = React.useCallback(async (email: string, password: string, remember?: boolean) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const e = normalizeEmail(email);
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) throw error;
      const sess: AuthSession | undefined = data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token!,
        token_type: data.session.token_type!,
        expires_in: data.session.expires_in!,
        expires_at: data.session.expires_at!,
        user: { id: data.session.user.id, email: data.session.user.email },
      } : undefined;
      if (sess) {
        await saveSession(sess);
        await setRememberEmail(remember ? e : undefined);
        setState({ session: sess, loading: false, error: undefined, email: remember ? e : undefined, remember: !!remember });
        return true;
      }
      setState((s) => ({ ...s, loading: false }));
      return false;
    } catch (e: any) {
      const n = normalizeEmail(email);
      setState({ loading: false, error: e?.message || 'Falha no login', remember: !!remember, email: n });
      return false;
    }
  }, [supabase]);

  const register = React.useCallback(async (email: string, password: string, username?: string) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const e = normalizeEmail(email);
      const { data, error } = await supabase.auth.signUp({ email: e, password, options: { data: username ? { username } : undefined } });
      if (error) throw error;
      // Supabase pode exigir verificação de email; se session vier, salvar
      const sess = data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token!,
        token_type: data.session.token_type!,
        expires_in: data.session.expires_in!,
        expires_at: data.session.expires_at!,
        user: { id: data.session.user.id, email: data.session.user.email },
      } as AuthSession : undefined;
      if (sess) {
        await saveSession(sess);
        setState({ session: sess, loading: false, error: undefined, email: e, remember: true });
        return true;
      }
      // Caso exija verificação de e-mail, considerar retorno true e redirecionar para Home após confirmação
      setState({ loading: false, error: undefined, email: e, remember: true });
      return true;
    } catch (e: any) {
      setState({ loading: false, error: e?.message || 'Falha no cadastro', remember: false });
      return false;
    }
  }, [supabase]);

  const signInWithGoogle = React.useCallback(async () => {
    try {
      const redirectTo = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? `${window.location.origin}/auth-callback` : 'http://localhost:8086/auth-callback')
        : 'ev://auth-callback';
      const skip = Platform.OS === 'web';
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: skip } });
      if (error) throw error;
      // Em web, forçamos o redirect manual para evitar bloqueios do ambiente
      if (Platform.OS === 'web') {
        const url = data?.url;
        if (url) {
          try { window.location.href = url; return true; } catch {}
        }
        throw new Error('URL de redirect do Google não recebida');
      }
      // Em web, supabase trata redireção; em mobile, callback via deep link será processado pelo listener
      return !!data?.url || true;
    } catch (e) {
      setState((s) => ({ ...s, error: (e as any)?.message || 'Falha no Google Login' }));
      return false;
    }
  }, [supabase]);

  const signInWithApple = React.useCallback(async () => {
    try {
      const redirectTo = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? `${window.location.origin}/auth-callback` : 'http://localhost:8086/auth-callback')
        : 'ev://auth-callback';
      const skip = Platform.OS === 'web';
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo, skipBrowserRedirect: skip } });
      if (error) throw error;
      if (Platform.OS === 'web') {
        const url = data?.url;
        if (url) {
          try { window.location.href = url; return true; } catch {}
        }
        throw new Error('URL de redirect do Apple não recebida');
      }
      return !!data?.url || true;
    } catch (e) {
      setState((s) => ({ ...s, error: (e as any)?.message || 'Falha no Apple Login' }));
      return false;
    }
  }, [supabase]);

  const signOut = React.useCallback(async () => {
    try { await supabase.auth.signOut(); } catch {}
    await clearSession();
    setState({ session: undefined, loading: false, error: undefined, remember: false });
  }, [supabase]);

  const setRemember = React.useCallback(async (remember: boolean, email?: string) => {
    await setRememberEmail(remember ? email : undefined);
    setState((s) => ({ ...s, remember, email: remember ? email : undefined }));
  }, []);

  const value: AuthState & AuthApi = {
    ...state,
    init,
    signInWithPassword,
    register,
    signInWithGoogle,
    signInWithApple,
    signOut,
    setRemember,
  };

  React.useEffect(() => { void init(); }, [init]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}