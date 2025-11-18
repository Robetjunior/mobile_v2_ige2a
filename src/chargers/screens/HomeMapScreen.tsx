import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SearchBar from '../../components/SearchBar';
import RadiusChips from '../../components/RadiusChips';
import HomeMap from '../../components/HomeMap';
import StationCard from '../../components/StationCard';
import RealTimeMetrics from '../../components/RealTimeMetrics';
import FilterModal from '../../components/FilterModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import RecentDrawer from '../../components/RecentDrawer';
import HomeMenuSheet from '../../components/HomeMenuSheet';
import Skeleton from '../../components/Skeleton';
import { useLocationStore } from '../../stores/locationStore';
import { useStationStore } from '../../stores/stationStore';
import { useSessionStore } from '../../stores/sessionStore';
import { ChargerStation } from '../../types';
import { useNavigation } from '@react-navigation/native';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { getOnlineChargers } from '../../api/chargeService';
import { getJson, setJson } from '../../utils/storage';
import { DISTANCE_FILTERS, FALLBACK_LOCATION, UI_TOKENS } from '../../constants';

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { permission, requestPermission, getCurrent, lat, lon, error: locError } = useLocationStore();
  const { items, loading, error, lastStatusCode, radiusKm, search, status, minPowerKw, fetchNearby, setRadius, setSearch, setFilters, setItems, subscribeStatusChanges, unsubscribeStatusChanges } = useStationStore();
  const { current, start, stop } = useSessionStore();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<ChargerStation | undefined>(undefined);
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [quickFilters, setQuickFilters] = useState<{ freeParking?: boolean; idle?: boolean; minPowerKw?: number }>({ idle: false });
  const lastQueryRef = React.useRef<{ lat: number; lon: number } | undefined>(undefined);
  const [fetchToastMsg, setFetchToastMsg] = useState<string | undefined>(undefined);
  const fetchToastTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const isFav = useFavoritesStore((s) => s.isFav);

  const trackAndFetch = useCallback(async (coords: { lat: number; lon: number }, opts: { radiusKm?: number; search?: string; status?: ('available'|'busy'|'offline')[]; minPowerKw?: number } = {}) => {
    lastQueryRef.current = { lat: coords.lat, lon: coords.lon };
    await fetchNearby({ lat: coords.lat, lon: coords.lon, radiusKm: opts.radiusKm ?? radiusKm, search: opts.search ?? search, status: opts.status ?? status, minPowerKw: opts.minPowerKw ?? minPowerKw });
  }, [fetchNearby, radiusKm, search, status, minPowerKw]);

  const onInit = useCallback(async () => {
    // restore persisted radius and favorites toggle
    const [persistedRadius, favToggle, persistedFilters] = await Promise.all([
      getJson<number>('home.radiusKm'),
      getJson<boolean>('home.onlyFavorites'),
      getJson<{ freeParking?: boolean; idle?: boolean; minPowerKw?: number; status?: ('available'|'busy'|'offline')[] }>('home.filters'),
    ]);
    if (typeof persistedRadius === 'number' && DISTANCE_FILTERS.includes(persistedRadius)) {
      setRadius(persistedRadius);
    }
    if (typeof favToggle === 'boolean') setOnlyFavorites(favToggle);
    if (persistedFilters) {
      setQuickFilters({ freeParking: persistedFilters.freeParking, idle: persistedFilters.idle, minPowerKw: persistedFilters.minPowerKw });
      setFilters({ status: persistedFilters.status, minPowerKw: persistedFilters.minPowerKw });
    }

    const perm = await requestPermission();
    if (perm === 'granted') {
      const pos = await getCurrent();
      if (pos) {
        await trackAndFetch({ lat: pos.lat, lon: pos.lon }, { radiusKm: persistedRadius ?? radiusKm });
      } else {
        // sem posição válida: usar fallback Lapa-SP
        await trackAndFetch({ lat: FALLBACK_LOCATION.lat, lon: FALLBACK_LOCATION.lon }, { radiusKm: persistedRadius ?? radiusKm });
      }
    } else {
      // sem permissão: lista online como fallback
      try {
        const online = await getOnlineChargers({ sinceMinutes: 30, limit: 200 });
        setItems(online);
      } catch {
        await trackAndFetch({ lat: FALLBACK_LOCATION.lat, lon: FALLBACK_LOCATION.lon }, { radiusKm: persistedRadius ?? radiusKm });
      }
    }
  }, [requestPermission, getCurrent, fetchNearby, radiusKm, search, status, minPowerKw, setRadius]);

  useEffect(() => {
    onInit();
  }, [onInit]);

  useEffect(() => {
    void subscribeStatusChanges();
    return () => { unsubscribeStatusChanges(); };
  }, []);

  // Mostrar log por 5s após concluir uma busca
  useEffect(() => {
    if (!loading && lastQueryRef.current) {
      const { lat: qLat, lon: qLon } = lastQueryRef.current;
      const count = items.length;
      const msg = count > 0
        ? `Encontrados ${count} postos próximos em (${qLat.toFixed(6)}, ${qLon.toFixed(6)})`
        : `Nenhum posto nos arredores de (${qLat.toFixed(6)}, ${qLon.toFixed(6)})`;
      setFetchToastMsg(msg);
      if (fetchToastTimerRef.current) clearTimeout(fetchToastTimerRef.current);
      fetchToastTimerRef.current = setTimeout(() => setFetchToastMsg(undefined), 5000);
    }
  }, [loading, items]);

  const onRefresh = useCallback(async () => {
    if (lat && lon) await trackAndFetch({ lat, lon });
  }, [lat, lon, trackAndFetch]);

  const onSearch = useCallback((q: string) => {
    setSearch(q);
    if (lat && lon) trackAndFetch({ lat, lon }, { search: q });
  }, [setSearch, lat, lon, trackAndFetch]);

  const onChangeRadius = useCallback((r: number) => {
    setRadius(r);
    setJson('home.radiusKm', r);
    if (lat && lon) trackAndFetch({ lat, lon }, { radiusKm: r });
  }, [setRadius, lat, lon, trackAndFetch]);

  const onApplyFilters = useCallback((f: { freeParking?: boolean; idle?: boolean; status?: ('available' | 'busy' | 'offline')[]; minPowerKw?: number }) => {
    // persist quick filters
    setJson('home.filters', f);
    setQuickFilters({ freeParking: f.freeParking, idle: f.idle, minPowerKw: f.minPowerKw });
    setFilters({ status: f.status, minPowerKw: f.minPowerKw });
    setFiltersOpen(false);
    if (lat && lon) trackAndFetch({ lat, lon }, { status: f.status, minPowerKw: f.minPowerKw });
  }, [setFilters, setFiltersOpen, lat, lon, trackAndFetch, radiusKm, search]);

  const openStation = useCallback((id: string) => {
    // Navega para a tela de carga já solicitando autoStart
    nav.navigate('Charge', { chargeBoxId: id, autoStart: true });
  }, [nav]);

  const openDetails = useCallback((id: string) => {
    // Direciona diretamente para a tela de carregamento (segundo layout)
    nav.navigate('Charge', { chargeBoxId: id });
  }, [nav]);

  const headerContent = useMemo(() => (
    <View style={{ backgroundColor: UI_TOKENS.colors.headerBg, paddingTop: insets.top + 8, paddingBottom: 10 }}>
      <View>
        <SearchBar
          placeholder="Digite termos de busca"
          onChangeText={onSearch}
          onOpenMenu={() => setMenuOpen(true)}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 10 }}>
        <Pressable onPress={() => setFiltersOpen(true)} accessibilityRole="button" accessibilityLabel="Abrir filtros" style={{ minWidth: 120, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: UI_TOKENS.colors.white, fontSize: 18, fontWeight: '600' }}>Filtros</Text>
        </Pressable>
        <View style={{ width: 1, height: 22, opacity: 0.5, backgroundColor: 'rgba(255,255,255,0.6)' }} />
        <Pressable
          onPress={() => {
            const next = !onlyFavorites;
            setOnlyFavorites(next);
            setJson('home.onlyFavorites', next);
          }}
          accessibilityRole="button"
          accessibilityLabel="Alternar favoritos"
          style={{ minWidth: 120, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: UI_TOKENS.colors.white, fontSize: 18, fontWeight: '600' }}>Favoritos</Text>
        </Pressable>
      </View>
      <View style={{ alignSelf: 'center', flexDirection: 'row', gap: 16, paddingTop: 6 }}>
        <RadiusChips value={radiusKm} onChange={onChangeRadius} options={DISTANCE_FILTERS} />
      </View>
    </View>
  ), [onSearch, radiusKm, onChangeRadius, onlyFavorites, insets.top]);

  const filteredItems = useMemo(() => {
    return items
      .filter((it) => (onlyFavorites ? isFav(it.id) : true))
      .filter((it) => (quickFilters.idle ? it.status === 'available' : true))
      .filter((it) => (typeof quickFilters.minPowerKw === 'number' ? (it.powerKw ?? 0) >= (quickFilters.minPowerKw ?? 0) : true));
  }, [items, onlyFavorites, quickFilters, isFav]);

  const mapOverlayBottom = UI_TOKENS.sizes.tabH + insets.bottom;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: UI_TOKENS.colors.tabBg }}>
      {/* Header fixo */}
      <View style={{ zIndex: 5, backgroundColor: UI_TOKENS.colors.headerBg }}>
        {headerContent}
      </View>
      {/* Banner de permissão quando negada */}
      {permission === 'denied' && (
        <View style={{ backgroundColor: '#FFF4E5', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: '#8E5C00' }}>Permissão de localização não concedida. Algumas funções ficam limitadas.</Text>
          <Pressable accessibilityRole="button" onPress={requestPermission} style={{ marginTop: 8 }}>
            <Text style={{ color: '#0A84FF' }}>Permitir</Text>
          </Pressable>
        </View>
      )}

      {/* Mapa ocupa o restante */}
      <View style={{ flex: 1 }}>
          <HomeMap
          stations={items}
          userLat={lat}
          userLon={lon}
          lastStatusCode={lastStatusCode}
          onSelectStation={(id: string) => openDetails(id)}
          onOpenDetails={(id: string) => openDetails(id)}
          onRecenter={async () => {
            const pos = await getCurrent();
            const coords = pos ?? FALLBACK_LOCATION;
            await trackAndFetch({ lat: coords.lat, lon: coords.lon });
          }}
          onOpenQr={() => nav.navigate('QRScanner')}
          overlayBottomBase={mapOverlayBottom}
        />
        {/* Toast de resultado de busca por 5s */}
        {!!fetchToastMsg && (
          <View style={{ position: 'absolute', top: insets.top + 60, left: 16, right: 16, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: '#111827' }}>{fetchToastMsg}</Text>
          </View>
        )}
        {/* Estado vazio: skeleton quando HTTP é desconhecido; mostra apenas quando não há nenhum posto retornado */}
        {!loading && items.length === 0 && (lastStatusCode === 0 || typeof lastStatusCode !== 'number') && (
          <View style={{ position: 'absolute', left: 16, right: 16, top: '50%', transform: [{ translateY: -60 }], backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}>
            <Skeleton rows={4} />
          </View>
        )}
        {!loading && items.length === 0 && (typeof lastStatusCode === 'number' && lastStatusCode !== 0) && (
          <View style={{ position: 'absolute', left: 16, right: 16, top: '50%', transform: [{ translateY: -60 }], backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}>
            <Text style={{ color: '#374151', fontWeight: '600', marginBottom: 6 }}>Nenhum posto nos arredores</Text>
            <Text style={{ color: '#6B7280' }}>Usuário: {typeof lat === 'number' && typeof lon === 'number' ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : 'posição desconhecida'}</Text>
            <Text style={{ color: '#6B7280', marginTop: 4 }}>Ajuste filtros ou aumente o raio para encontrar estações próximas.</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Pressable accessibilityRole="button" onPress={() => onChangeRadius(Math.max(300, radiusKm))}>
                <Text style={{ color: '#0A84FF' }}>Aumentar raio para 300 km</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={async () => {
                const coords = FALLBACK_LOCATION;
                await trackAndFetch({ lat: coords.lat, lon: coords.lon }, { radiusKm: Math.max(radiusKm, 100) });
              }}>
                <Text style={{ color: '#0A84FF' }}>Usar área padrão</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Sessão ativa */}
      {current && (
        <RealTimeMetrics metrics={current} onViewDetails={() => nav.navigate('Charge', { chargeBoxId: current.stationId })} onStop={stop} />
      )}

      {/* Toast 401 no topo do mapa */}
      {typeof error === 'string' && /HTTP\s*401/i.test(error) && (
        <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, backgroundColor: UI_TOKENS.colors.danger, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ color: UI_TOKENS.colors.white }}>Não autorizado. Verifique suas credenciais.</Text>
        </View>
      )}
      {/* Outros erros ainda aparecem abaixo */}
      {typeof error === 'string' && !/HTTP\s*401/i.test(error) && <ErrorMessage message={error} />}
      {loading && <LoadingSpinner />}

      <FilterModal visible={filtersOpen} onClose={() => setFiltersOpen(false)} onApply={onApplyFilters} />

      {/* Drawer de recentes mantém-se disponível via menu, não abre pelo marcador */}

      <HomeMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={(route) => nav.navigate(route)}
      />
    </SafeAreaView>
  );
}
