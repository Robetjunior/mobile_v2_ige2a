import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { UI_TOKENS } from '../constants';
import { ChargerStation } from '../types';
import { GOOGLE_MAPS_API_KEY } from '../constants/env';

declare global {
  interface Window {
    google?: any;
  }
}

type Props = {
  stations: ChargerStation[];
  userLat?: number;
  userLon?: number;
  onSelectStation: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onRecenter?: () => void;
  onOpenQr?: () => void;
  overlayBottomBase?: number; // TAB_H + insets.bottom
};

function loadGoogleMaps(apiKey?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    if (!apiKey) {
      reject(new Error('Missing Google Maps API key'));
      return;
    }
    const existing = document.querySelector('script[data-google-maps]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-google-maps', 'true');
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

export default function HomeMap({ stations, userLat, userLon, onSelectStation, onOpenDetails, onRecenter, overlayBottomBase = UI_TOKENS.sizes.tabH }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapsReady, setMapsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const apiKey = useMemo(() => {
    const envKey = (process?.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string) || '';
    return envKey || GOOGLE_MAPS_API_KEY || '';
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        setMapsReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError('Mapa web requer Google Maps API key. Configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.');
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current) return;
    if (!mapRef.current) {
      const center = userLat && userLon ? { lat: userLat, lng: userLon } : stations?.[0]
        ? { lat: stations[0].latitude, lng: stations[0].longitude }
        : { lat: -23.55052, lng: -46.633308 }; // SP centro como fallback
      mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center,
        zoom: 13,
        disableDefaultUI: false,
      });
    }
  }, [mapsReady, userLat, userLon, stations]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    // Limpar marcadores anteriores
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    setSelectedId(undefined);

    if (!stations || stations.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    stations.forEach((s) => {
      const pos = { lat: s.latitude, lng: s.longitude };
      bounds.extend(pos);
      const marker = new window.google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: s.name,
      });
      marker.addListener('click', () => {
        setSelectedId(s.id);
        if (onOpenDetails) onOpenDetails(s.id);
      });
      markersRef.current.push(marker);
    });

    if (stations.length > 1) {
      mapRef.current.fitBounds(bounds);
    } else {
      mapRef.current.setCenter({ lat: stations[0].latitude, lng: stations[0].longitude });
      mapRef.current.setZoom(15);
    }
  }, [mapsReady, stations, onOpenDetails]);

  const handleRecenter = () => {
    if (onRecenter) {
      onRecenter();
    }
    if (mapRef.current) {
      const center = userLat && userLon ? { lat: userLat, lng: userLon } : undefined;
      if (center) mapRef.current.setCenter(center);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {error && (
        <View style={{ position: 'absolute', left: 16, right: 16, top: 16, backgroundColor: '#FFF8E1', borderRadius: 8, padding: 10 }}>
          <Text style={{ color: '#92400E' }}>{error}</Text>
        </View>
      )}
      {!!selectedId && (
        <Pressable
          onPress={() => onSelectStation(selectedId)}
          accessibilityRole="button"
          accessibilityLabel="Iniciar carga"
          style={{ position: 'absolute', left: 16, bottom: overlayBottomBase + 12, backgroundColor: UI_TOKENS.colors.brand, borderRadius: UI_TOKENS.radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <Text style={{ color: UI_TOKENS.colors.brandText, fontWeight: '600' }}>Iniciar carga</Text>
        </Pressable>
      )}
      <Pressable
        onPress={handleRecenter}
        accessibilityRole="button"
        accessibilityLabel="Recentralizar mapa"
        style={{ position: 'absolute', right: 16, bottom: overlayBottomBase + 12, backgroundColor: UI_TOKENS.colors.recenterBg, borderRadius: UI_TOKENS.radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}
      >
        <Text style={{ color: UI_TOKENS.colors.tabActive, fontWeight: '600' }}>Recentralizar</Text>
      </Pressable>
    </View>
  );
}