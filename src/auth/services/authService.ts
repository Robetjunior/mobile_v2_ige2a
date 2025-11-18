import { client } from '../../api/client';

export async function login(email: string, password: string): Promise<{ token?: string; userId?: string } | undefined> {
  try { return await client.post('/auth/login', { email, password }, { timeoutMs: 10000 }); } catch { return undefined; }
}

export async function register(payload: { email: string; password: string; username?: string }): Promise<{ userId?: string } | undefined> {
  try { return await client.post('/auth/register', payload, { timeoutMs: 10000 }); } catch { return undefined; }
}

export async function me(): Promise<any> {
  return client.get('/me', { timeoutMs: 10000 });
}