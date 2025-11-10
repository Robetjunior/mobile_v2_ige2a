import React from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, Callout, Region } from 'react-native-maps';
import { View, Text, Platform, Linking, Dimensions, Pressable, Animated, PanResponder, Vibration, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UI_TOKENS } from '../constants';
import { ChargerStation } from '../types';
import { useFavoritesStore } from '../stores/favoritesStore';

type Props = {
  stations: ChargerStation[];
  userLat?: number;
  userLon?: number;
  lastStatusCode?: number;
  onSelectStation: (id: string) => void; // iniciar carga
  onOpenDetails?: (id: string) => void;
  onRecenter?: () => void;
  onOpenQr?: () => void;
  overlayBottomBase?: number; // TAB_H + insets.bottom
  recenterPlacement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  recenterSize?: number;
  recenterIconColor?: string;
  recenterBgColor?: string;
};

export default function HomeMap({ stations, userLat, userLon, lastStatusCode, onSelectStation, onOpenDetails, onRecenter, onOpenQr, overlayBottomBase = UI_TOKENS.sizes.tabH, recenterPlacement = 'bottom-right', recenterSize = 56, recenterIconColor = UI_TOKENS.colors.brand, recenterBgColor = 'rgba(255,255,255,0.92)' }: Props) {
  const mapRef = React.useRef<MapView>(null);
  const [selected, setSelected] = React.useState<ChargerStation | null>(null);
  const [cardH, setCardH] = React.useState(0);
  const [recenterLoading, setRecenterLoading] = React.useState(false);
  const toggleFav = useFavoritesStore((s) => s.toggle);
  const isFavFn = useFavoritesStore((s) => s.isFav);
  const region = userLat && userLon ? {
    latitude: userLat,
    longitude: userLon,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  } : undefined;

  const pinColorFor = (status?: string) => {
    switch (status) {
      case 'available':
        return '#34C759'; // green
      case 'busy':
        return '#FF9500'; // orange
      case 'offline':
        return '#FF3B30'; // red
      default:
        return '#8E8E93'; // gray
    }
  };

  const statusLabel = (status?: string) => {
    const s = String(status || '').toLowerCase();
    if (['available','preparing','suspendedev','finishing','ready'].includes(s)) return 'Disponível';
    if (['busy','charging','occupied'].includes(s)) return 'Ocupado';
    if (['offline','faulted','unavailable'].includes(s)) return 'Offline';
    return 'Desconhecido';
  };

  const statusColors = (status?: string) => {
    const s = String(status || '').toLowerCase();
    if (['available','preparing','suspendedev','finishing','ready'].includes(s)) {
      return { bg: 'rgba(52, 199, 89, 0.15)', text: '#34C759' };
    }
    if (['busy','charging','occupied'].includes(s)) {
      return { bg: 'rgba(255, 149, 0, 0.15)', text: '#FF9500' };
    }
    if (['offline','faulted','unavailable'].includes(s)) {
      return { bg: 'rgba(255, 59, 48, 0.15)', text: '#FF3B30' };
    }
    return { bg: 'rgba(142, 142, 147, 0.15)', text: '#6B7280' };
  };

  const statusIcon = (status?: string) => {
    const s = String(status || '').toLowerCase();
    if (['available','preparing','suspendedev','finishing','ready'].includes(s)) return '✅';
    if (['busy','charging','occupied'].includes(s)) return '⚡';
    if (['offline','faulted','unavailable'].includes(s)) return '⛔';
    return '❓';
  };

  const openExternalMap = (lat: number, lon: number) => {
    const ios = `maps:0,0?q=${lat},${lon}`;
    const android = `geo:0,0?q=${lat},${lon}`;
    const url = Platform.OS === 'ios' ? ios : android;
    try {
      Linking.openURL(url);
    } catch {}
  };

  // Feedback tátil/sonoro
  const feedbackClick = React.useCallback(() => {
    try { Vibration.vibrate(10); } catch {}
    if (Platform.OS === 'web') {
      try { new Audio('https://actions.google.com/sounds/v1/buttons/button_click.ogg').play(); } catch {}
    }
  }, []);

  // Gesture: swipe-down para fechar card
  const translateY = React.useRef(new Animated.Value(0)).current;
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6,
      onPanResponderMove: Animated.event([null, { dy: translateY }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 80) {
          feedbackClick();
          Animated.timing(translateY, { toValue: 200, duration: 160, useNativeDriver: true }).start(() => {
            setSelected(null);
            translateY.setValue(0);
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const fabLeft = Math.round(Dimensions.get('window').width / 2 - UI_TOKENS.sizes.fab / 2);
  const recenterBottom = overlayBottomBase + 16 + (selected ? (cardH + 24) : 0);
  const isUserPosAvailable = typeof userLat === 'number' && typeof userLon === 'number';
  const recenterPosStyle: any = { position: 'absolute' };
  if (recenterPlacement === 'bottom-right') { recenterPosStyle.right = 16; recenterPosStyle.bottom = recenterBottom; }
  if (recenterPlacement === 'bottom-left') { recenterPosStyle.left = 16; recenterPosStyle.bottom = recenterBottom; }
  if (recenterPlacement === 'top-right') { recenterPosStyle.right = 16; recenterPosStyle.top = 16; }
  if (recenterPlacement === 'top-left') { recenterPosStyle.left = 16; recenterPosStyle.top = 16; }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
      >
        {stations.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.latitude, longitude: s.longitude }}
            pinColor={isFavFn(s.id) ? '#FF2D55' : pinColorFor(s.status)}
            onPress={() => setSelected(s)}
          >
            <Callout tooltip={false} onPress={() => setSelected(s)}>
              <View style={{ width: 280 }}>
                {/* Header do callout: título e favorito */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>{s.name}</Text>
                  <View style={{ marginLeft: 8, backgroundColor: isFavFn(s.id) ? 'rgba(255,45,85,0.15)' : 'rgba(142,142,147,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: isFavFn(s.id) ? '#FF2D55' : '#6B7280', fontWeight: '600' }}>{isFavFn(s.id) ? 'Favorito' : 'Favorito'}</Text>
                  </View>
                </View>
                {/* Meta: distância e potência */}
                <Text style={{ color: '#8E8E93', marginTop: 2 }}>
                  {typeof s.distanceKm === 'number' ? `${s.distanceKm.toFixed(1)} km` : ''}
                  {typeof s.distanceKm === 'number' && s.powerKw ? ' • ' : ''}
                  {s.powerKw ? `${s.powerKw} kW` : ''}
                </Text>
                {/* Endereço */}
                {!!s.address && (
                  <Text style={{ color: '#6B7280', marginTop: 4 }} numberOfLines={2}>Endereço: {s.address}</Text>
                )}
                {/* Preço por kWh */}
                {typeof s.pricePerKwh === 'number' && (
                  <Text style={{ color: '#6B7280', marginTop: 2 }}>Preço: R$ {s.pricePerKwh.toFixed(2)}/kWh</Text>
                )}
                {/* Rating */}
                {typeof s.rating === 'number' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Ionicons name="star" size={16} color="#FFD60A" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#6B7280', fontWeight: '600' }}>{s.rating.toFixed(1)}</Text>
                  </View>
                )}
                {/* Horários de funcionamento */}
                {!!s.openingHours && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="time-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#6B7280' }} numberOfLines={2}>{s.openingHours}</Text>
                  </View>
                )}
                {/* Preços por plano (até 2 itens) */}
                {!!s.pricePlans && Object.keys(s.pricePlans).length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="pricetag-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#6B7280', fontWeight: '600' }}>Planos:</Text>
                    </View>
                    {Object.entries(s.pricePlans).slice(0, 2).map(([plan, price]) => (
                      <Text key={plan} style={{ color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{plan}: R$ {Number(price).toFixed(2)}/kWh</Text>
                    ))}
                  </View>
                )}
                {/* Status pill */}
                {(() => { const c = statusColors(s.status); return (
                  <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {(() => {
                        const sName = String(s.status || '').toLowerCase();
                        const iconName = ['available','preparing','suspendedev','finishing','ready'].includes(sName)
                          ? 'checkmark-circle-outline'
                          : ['busy','charging','occupied'].includes(sName)
                          ? 'flash-outline'
                          : ['offline','faulted','unavailable'].includes(sName)
                          ? 'close-circle-outline'
                          : 'help-circle-outline';
                        return <Ionicons name={iconName as any} size={16} color={c.text} style={{ marginRight: 6 }} />;
                      })()}
                      <Text style={{ color: c.text, fontWeight: '600' }}>{statusLabel(s.status)}</Text>
                    </View>
                  </View>
                ); })()}
                {/* Coord e HTTP para depuração/feedback */}
                <Text style={{ marginTop: 6, color: '#6B7280' }}>Usuário: {typeof userLat === 'number' && typeof userLon === 'number' ? `${userLat.toFixed(6)}, ${userLon.toFixed(6)}` : 'posição desconhecida'}</Text>
                <Text style={{ marginTop: 2, color: '#6B7280' }}>HTTP: {lastStatusCode === 0 ? 'carregando' : String(typeof lastStatusCode === 'number' ? lastStatusCode : 0)}</Text>
                {/* Ações */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <View style={{ backgroundColor: '#0A84FF', borderRadius: UI_TOKENS.radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 10 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Ver detalhes</Text>
                  </View>
                  <View style={{ borderColor: '#0A84FF', borderWidth: 1, borderRadius: UI_TOKENS.radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 10 }}>
                    <Text style={{ color: '#0A84FF', fontWeight: '600' }}>Iniciar carga</Text>
                  </View>
                  <View>
                    <Text style={{ color: '#0A84FF' }}>Navegar</Text>
                  </View>
                </View>
                <Text style={{ color: '#6B7280', marginTop: 6 }}>Toque no balão para abrir detalhes</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      {/* Card de seleção fixo (Android-friendly) */}
      {selected && (
        <Animated.View
          {...panResponder.panHandlers}
          onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
          style={{ position: 'absolute', left: 16, right: 16, bottom: overlayBottomBase + 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, transform: [{ translateY }] }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{selected.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar card" onPress={() => setSelected(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>
          {!!selected.address && (
            <Text style={{ color: '#6B7280', marginTop: 2 }} numberOfLines={2}>{selected.address}</Text>
          )}
          <Text style={{ color: '#8E8E93', marginTop: 4 }}>
            {typeof selected.distanceKm === 'number' ? `${selected.distanceKm.toFixed(1)} km` : ''}
            {typeof selected.distanceKm === 'number' && selected.powerKw ? ' • ' : ''}
            {selected.powerKw ? `${selected.powerKw} kW` : ''}
          </Text>
          {/* Preço por kWh */}
          {typeof selected.pricePerKwh === 'number' && (
            <Text style={{ color: '#6B7280', marginTop: 4 }}>Preço: R$ {selected.pricePerKwh.toFixed(2)}/kWh</Text>
          )}
          {/* Horários de funcionamento */}
          {!!selected.openingHours && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="time-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
              <Text style={{ color: '#6B7280' }} numberOfLines={2}>{selected.openingHours}</Text>
            </View>
          )}
          {/* Preços por plano (até 2 itens) */}
          {!!selected.pricePlans && Object.keys(selected.pricePlans).length > 0 && (
            <View style={{ marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="pricetag-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                <Text style={{ color: '#6B7280', fontWeight: '600' }}>Planos:</Text>
              </View>
              {Object.entries(selected.pricePlans).slice(0, 2).map(([plan, price]) => (
                <Text key={plan} style={{ color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{plan}: R$ {Number(price).toFixed(2)}/kWh</Text>
              ))}
            </View>
          )}
          {(() => { const c = statusColors(selected.status); return (
            <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {(() => {
                  const sName = String(selected.status || '').toLowerCase();
                  const iconName = ['available','preparing','suspendedev','finishing','ready'].includes(sName)
                    ? 'checkmark-circle-outline'
                    : ['busy','charging','occupied'].includes(sName)
                    ? 'flash-outline'
                    : ['offline','faulted','unavailable'].includes(sName)
                    ? 'close-circle-outline'
                    : 'help-circle-outline';
                  return <Ionicons name={iconName as any} size={16} color={c.text} style={{ marginRight: 6 }} />;
                })()}
                <Text style={{ color: c.text, fontWeight: '600' }}>{statusLabel(selected.status)}</Text>
              </View>
            </View>
          ); })()}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            {!!onOpenDetails && (
              <Pressable onPress={() => { feedbackClick(); onOpenDetails?.(selected.id); }} accessibilityRole="button" accessibilityLabel="Ver detalhes" style={{ backgroundColor: '#0A84FF', borderRadius: UI_TOKENS.radius.pill, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Ver detalhes</Text>
              </Pressable>
            )}
            <Pressable onPress={() => { feedbackClick(); onSelectStation(selected.id); }} accessibilityRole="button" accessibilityLabel="Iniciar carga" style={{ borderColor: '#0A84FF', borderWidth: 1, borderRadius: UI_TOKENS.radius.pill, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10 }}>
              <Text style={{ color: '#0A84FF', fontWeight: '600' }}>Iniciar carga</Text>
            </Pressable>
            <Pressable onPress={() => { feedbackClick(); openExternalMap(selected.latitude, selected.longitude); }} accessibilityRole="button" accessibilityLabel="Navegar para o posto">
              <Text style={{ color: '#0A84FF' }}>Navegar</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
      {!!onRecenter && (
        <Pressable
          onPress={() => {
            feedbackClick();
            if (isUserPosAvailable) {
              setRecenterLoading(true);
              const next: Region = {
                latitude: userLat,
                longitude: userLon,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              };
              mapRef.current?.animateToRegion(next, 500);
              setTimeout(() => setRecenterLoading(false), 600);
            }
            onRecenter?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Recentralizar mapa"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={!isUserPosAvailable || recenterLoading}
          style={{ ...recenterPosStyle, width: recenterSize, height: recenterSize, borderRadius: recenterSize / 2, backgroundColor: isUserPosAvailable ? recenterBgColor : '#F3F4F6', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, zIndex: 50, opacity: isUserPosAvailable ? 1 : 0.85 }}
        >
          {recenterLoading ? (
            <ActivityIndicator size="small" color={recenterIconColor} />
          ) : (
            <Ionicons name="locate-outline" size={Math.round(recenterSize * 0.45)} color={isUserPosAvailable ? recenterIconColor : '#9CA3AF'} />
          )}
        </Pressable>
      )}
      {/* QR agora faz parte da Tab; sem FAB flutuante no mapa. */}
    </View>
  );
}