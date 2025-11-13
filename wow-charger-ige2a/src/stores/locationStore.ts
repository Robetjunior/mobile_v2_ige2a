import { create } from 'zustand';
import * as Location from 'expo-location';

type LocationPermission = 'granted' | 'denied' | 'undetermined';

type LocationState = {
  lat?: number;
  lon?: number;
  accuracy?: number;
  permission: LocationPermission;
  error?: string;
  requestPermission: () => Promise<LocationPermission>;
  getCurrent: () => Promise<{ lat: number; lon: number } | undefined>;
};

export const useLocationStore = create<LocationState>((set) => ({
  lat: undefined,
  lon: undefined,
  accuracy: undefined,
  permission: 'undetermined',
  error: undefined,
  requestPermission: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const perm: LocationPermission = status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
      set({ permission: perm });
      return perm;
    } catch (e: any) {
      set({ permission: 'denied', error: e?.message || 'Falha ao solicitar permissão' });
      return 'denied';
    }
  },
  getCurrent: async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      set({ lat, lon, accuracy: loc.coords.accuracy ?? undefined });
      return { lat, lon };
    } catch (e: any) {
      set({ error: e?.message || 'Falha ao obter localização' });
      return undefined;
    }
  },
}));