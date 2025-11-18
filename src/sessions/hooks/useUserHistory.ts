import { useQuery } from '@tanstack/react-query';
import { getMySessions } from '../../api/sessionService';
import { useAuth } from '../../auth/context/AuthContext';

export function useUserHistory() {
  const { session, loading } = useAuth();
  const enabled = !!session && !loading;
  const q = useQuery({
    queryKey: ['userHistory'],
    enabled,
    queryFn: async () => getMySessions(),
    staleTime: 5000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401) return false;
      return failureCount < 2;
    },
  });
  return { data: q.data, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch } as const;
}