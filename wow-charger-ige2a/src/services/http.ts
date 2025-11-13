import { LOGGER } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_KEY } from '../constants/env';

// Normalize base URL to avoid trailing slashes and stray backticks/spaces
// Support both EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_API_BASE
function sanitize(input?: string): string {
  return String(input || '')
    .replace(/`/g, '')
    .trim();
}

const RAW_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE ||
  'http://35.231.137.231:3000';
export const API_BASE = sanitize(RAW_BASE_URL).replace(/\/+$/, '');

// Garante um fallback consistente para X-API-Key quando a env não está presente
let API_KEY: string | undefined = sanitize(process.env.EXPO_PUBLIC_API_KEY || DEFAULT_API_KEY || undefined);

export function setApiKey(k?: string) {
  API_KEY = sanitize(k);
}

export async function ensureApiKey(): Promise<string> {
  if (API_KEY) return API_KEY;
  // Try persisted storage (mobile) or localStorage (web)
  try {
    const stored = (await AsyncStorage.getItem('API_KEY')) || undefined;
    if (sanitize(stored)) {
      API_KEY = sanitize(stored);
      return API_KEY as string;
    }
  } catch {}
  try {
    const ls = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('API_KEY') || undefined
      : undefined;
    if (sanitize(ls)) {
      API_KEY = sanitize(ls);
      return API_KEY as string;
    }
  } catch {}
  // Se nada for encontrado, usar DEFAULT_API_KEY como último recurso
  if (DEFAULT_API_KEY) {
    API_KEY = sanitize(DEFAULT_API_KEY);
    return API_KEY as string;
  }
  throw new Error('API key ausente: configure EXPO_PUBLIC_API_KEY nas envs ou nas configurações do app');
}

type RequestOptions = RequestInit & { timeoutMs?: number };

export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  try {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${API_BASE}${normalizedPath}`;
    // Rotas protegidas do Orchestrator: exigem X-API-Key
    if (normalizedPath.startsWith('/v1/') && !API_KEY) {
      // Tenta resolver antes de falhar
      try { await ensureApiKey(); } catch {}
      if (!API_KEY) {
        const err: any = new Error('API key ausente: configure EXPO_PUBLIC_API_KEY');
        err.status = 401;
        LOGGER.API.info('http.missingApiKey', { url, path: normalizedPath });
        throw err;
      }
    }
    const baseHeaders: Record<string, string> = {
      Accept: 'application/json',
    };
    // Injeta X-API-Key e Content-Type apenas para rotas /v1/**
    if (normalizedPath.startsWith('/v1/')) {
      if (API_KEY) baseHeaders['X-API-Key'] = API_KEY;
      if (options.body && !('Content-Type' in (options.headers || {}))) {
        baseHeaders['Content-Type'] = 'application/json';
      }
    }
    const startMs = Date.now();
    LOGGER.API.info('http.request', {
      url,
      method: (options.method || 'GET'),
      hasApiKey: !!API_KEY,
      timeoutMs: options.timeoutMs ?? 10000,
    });
    const res = await fetch(url, {
      ...options,
      headers: {
        ...baseHeaders,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err: any = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      err.status = res.status;
      LOGGER.API.info('http.error', {
        url,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - startMs,
        message: text || res.statusText,
      });
      throw err;
    }
    // 204
    if (res.status === 204) return undefined as unknown as T;
    const json = (await res.json()) as T;
    LOGGER.API.info('http.response', {
      url,
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - startMs,
    });
    return json;
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === 'AbortError') {
      const err: any = new Error('Timeout atingido na requisição');
      err.code = 'TIMEOUT';
      err.status = 408; // Request Timeout
      LOGGER.API.info('http.timeout', { url: `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, timeoutMs: options.timeoutMs ?? 30000 });
      throw err;
    }
    const err: any = e instanceof Error ? e : new Error(String(e));
    if (typeof err.status !== 'number') {
      // Falha de rede ou erro não mapeado: usar 0 como sentinel "sem resposta"
      err.status = 0;
    }
    LOGGER.API.info('http.catch', { message: err?.message, status: err?.status });
    throw err;
  }
}