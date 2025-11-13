import { useQuery } from '@tanstack/react-query';
import { client } from '../api/client';
import { ActiveDetailSchema, type ActiveDetail } from '../api/schemas';

export function useActiveSessionDetail(chargeBoxId?: string, opts: { polling?: boolean } = {}) {
  const polling = !!opts.polling;
  return useQuery<ActiveDetail, any>({
    queryKey: ['activeSessionDetail', chargeBoxId],
    enabled: !!chargeBoxId,
    staleTime: 1000,
    queryFn: async () => {
      const raw = await client.get<any>(`/v1/sessions/active/${chargeBoxId}/detail`).catch(async () => {
        return client.get<any>(`/v1/sessions/active/${chargeBoxId}`);
      });
      try {
        return ActiveDetailSchema.parse(raw);
      } catch (e: any) {
        const err: any = new Error('Formato inválido de sessão ativa');
        err.status = 422;
        throw err;
      }
    },
    refetchInterval: (data) => {
      if (!polling) return false;
      const tx = data?.session?.transaction_id;
      // polling mais responsivo quando há sessão ativa
      return tx ? 3_000 : 5_000;
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 404 || error?.status === 409 || error?.status === 422) return false;
      return failureCount < 2;
    },
  });
}