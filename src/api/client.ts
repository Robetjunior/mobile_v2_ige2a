import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://35.231.137.231:3000').replace(/\/+$/, '');
const DEFAULT_API_KEY = (process.env.EXPO_PUBLIC_API_KEY || 'minha_chave_super_secreta').trim();

const instance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
  },
});

let cachedApiKey: string | undefined = DEFAULT_API_KEY;
export async function setApiKey(key: string): Promise<void> {
  cachedApiKey = key;
  try { await SecureStore.setItemAsync('apiKey', key); } catch {}
}
async function getApiKey(): Promise<string | undefined> {
  if (cachedApiKey) return cachedApiKey;
  try { cachedApiKey = await SecureStore.getItemAsync('apiKey') || undefined; } catch {}
  return cachedApiKey;
}

async function getAuthToken(): Promise<string | undefined> {
  try {
    const raw = await SecureStore.getItemAsync('AUTH_SESSION');
    if (raw) {
      const parsed = JSON.parse(raw || '{}');
      const token = parsed?.access_token as string | undefined;
      if (token) return token;
    }
  } catch {}
  try {
    const token = await SecureStore.getItemAsync('authToken');
    if (token) return token || undefined;
  } catch {}
  return undefined;
}

instance.interceptors.request.use(async (cfg) => {
  // Aplica X-API-Key e Content-Type apenas em rotas /v1/**
  const url = cfg.url || '';
  const isV1 = url.startsWith('/v1/');
  if (isV1) {
    cfg.headers = {
      ...(cfg.headers || {}),
      'X-API-Key': (await getApiKey()) || DEFAULT_API_KEY,
    } as any;
    if (cfg.data && !('Content-Type' in (cfg.headers || {}))) {
      (cfg.headers as any)['Content-Type'] = 'application/json';
    }
  }
  const authToken = await getAuthToken();
  if (authToken) {
    cfg.headers = {
      ...(cfg.headers || {}),
      Authorization: `Bearer ${authToken}`,
    } as any;
  }
  return cfg;
});

instance.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    // Normaliza erros: 401, 404/409, 422 e timeouts/5xx
    const status = (error.response?.status ?? undefined) as number | undefined;
    const code = (error.code ?? undefined) as string | undefined;
    const message = (
      (error.response?.data as any)?.message ||
      error.message ||
      'Erro inesperado no cliente HTTP'
    );

    // Timeout / abort
    if (code === 'ECONNABORTED') {
      const err: any = new Error('Timeout ao comunicar com servidor');
      err.status = 408;
      err.code = code;
      throw err;
    }
    // Unauthorized
    if (status === 401) {
      const err: any = new Error('401 unauthorized: verifique X-API-Key');
      err.status = status;
      err.code = code;
      throw err;
    }
    // Offline/indisponível
    if (status === 404 || status === 409) {
      const err: any = new Error(message || 'CP offline/indisponível');
      err.status = status;
      err.code = code;
      throw err;
    }
    // Unprocessable Entity / validação
    if (status === 422) {
      const err: any = new Error(message || 'Entrada inválida');
      err.status = status;
      err.code = code;
      throw err;
    }
    // 5xx
    if (status && status >= 500) {
      const detail = (error.response?.data as any)?.detail || (error.response?.data as any)?.error;
      const err: any = new Error('Falha no servidor' + (detail ? `: ${detail}` : ''));
      err.status = status;
      err.code = code;
      throw err;
    }
    const err: any = new Error(message);
    err.status = status;
    err.code = code;
    throw err;
  }
);

async function requestWithRetry<T>(doRequest: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await doRequest();
    } catch (e: any) {
      lastErr = e;
      const status = e?.status;
      const isTransient = e?.code === 'ECONNABORTED' || !status || (status >= 500);
      if (!isTransient || i === attempts - 1) throw e;
      const wait = Math.min(2000 * Math.pow(2, i), 8000) + Math.floor(Math.random() * 300);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function get<T>(path: string, opts: { timeoutMs?: number } = {}): Promise<T> {
  // GET críticos devem usar 10s por padrão (podem ser sobrescritos pelo caller)
  const cfg: AxiosRequestConfig = { timeout: opts.timeoutMs ?? 10000 };
  return requestWithRetry(async () => {
    const res = await instance.get<T>(path, cfg);
    return res.data as T;
  });
}

async function post<T>(path: string, body?: any, opts: { timeoutMs?: number } = {}): Promise<T> {
  // POST devem usar 15s por padrão (podem ser sobrescritos pelo caller)
  const cfg: AxiosRequestConfig = { timeout: opts.timeoutMs ?? 15000 };
  return requestWithRetry(async () => {
    const res = await instance.post<T>(path, body ?? undefined, cfg);
    return res.data as T;
  });
}

export const client = { get, post };