import { useMemo } from 'react';
import { STRINGS, Keys } from './strings';
import { useUserStore } from '../stores/useUserStore';

export function useI18n() {
  const { prefs } = useUserStore();
  const t = useMemo(() => {
    return (key: Keys): string => {
      const dict = STRINGS[prefs.language || 'pt-BR'];
      return dict[key] || key;
    };
  }, [prefs.language]);

  return { t, lang: prefs.language };
}