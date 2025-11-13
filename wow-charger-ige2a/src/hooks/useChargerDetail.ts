import { useQuery } from '@tanstack/react-query';
import { client } from '../api/client';
import { ChargerSchema, type Charger } from '../api/schemas';

export function useChargerDetail(chargeBoxId?: string) {
  return useQuery<Charger, any>({
    queryKey: ['chargerDetail', chargeBoxId],
    enabled: !!chargeBoxId,
    queryFn: async () => {
      const raw = await client.get<any>(`/v1/chargers/${chargeBoxId}`);
      try {
        return ChargerSchema.parse(raw);
      } catch (e: any) {
        const err: any = new Error('Formato inválido de Charger');
        err.status = 422;
        throw err;
      }
    },
    staleTime: 5_000,
    gcTime: 60_000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 404 || error?.status === 409 || error?.status === 422) return false;
      return failureCount < 2;
    },
  });
}