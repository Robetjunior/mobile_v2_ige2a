import { useQuery } from '@tanstack/react-query';
import { client } from '../api/client';
import { FinalSessionSchema, type FinalSession } from '../api/schemas';

export function useSessionById(transactionId?: number, opts: { polling?: boolean } = {}) {
  const polling = !!opts.polling;
  return useQuery<FinalSession, any>({
    queryKey: ['sessionById', transactionId],
    enabled: typeof transactionId === 'number' && transactionId > 0,
    staleTime: 1000,
    queryFn: async () => {
      const raw = await client.get<any>(`/v1/sessions/${transactionId}`);
      try {
        return FinalSessionSchema.parse(raw);
      } catch (e: any) {
        const err: any = new Error('Formato inválido de sessão');
        err.status = 422;
        throw err;
      }
    },
    refetchInterval: (data) => {
      if (!polling) return false;
      const completed = data?.status === 'completed' || !!data?.stopped_at;
      return completed ? false : 3_000;
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 404 || error?.status === 409 || error?.status === 422) return false;
      return failureCount < 2;
    },
  });
}