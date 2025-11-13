// Configurações padrão de ambiente utilizadas no app
// Evite hardcode de segredos em produção; estes valores são apenas para desenvolvimento.

export const BACKEND_URL = 'http://35.231.137.231:3000';
export const DEFAULT_API_KEY = 'minha_chave_super_secreta';
export const GOOGLE_MAPS_API_KEY = 'SUA_GOOGLE_API_KEY_AQUI';

// Utilitário simples para sanitizar entradas vindas de env/usuário
export function sanitize(input?: string): string {
  return String(input || '').replace(/`/g, '').trim();
}