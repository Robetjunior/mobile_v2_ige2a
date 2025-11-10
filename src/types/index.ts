export type LatLng = { lat: number; lon: number };

export type StationStatus = 'available' | 'busy' | 'offline' | 'unknown';

export type ChargerStation = {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  status: StationStatus;
  powerKw?: number;
  pricePerKwh?: number;
  favorite?: boolean;
  rating?: number; // média de avaliação, 0-5
  openingHours?: string; // texto livre com horários
  pricePlans?: Record<string, number>; // plano -> preço/kWh
};

export type NearbyQuery = {
  lat: number;
  lon: number;
  radiusKm: number;
  limit?: number;
  offset?: number;
  page?: number;
  search?: string;
  status?: StationStatus[];
  minPowerKw?: number;
};

export type SessionMetrics = {
  sessionId: string;
  stationId: string;
  energyKwh: number;
  powerKw: number;
  durationMinutes: number;
  startedAt: string;
};

export type PeriodType = 'month' | 'year';

export type RecordPoint = { label: string; totalMoney: number; kwh: number; minutes: number };
export type RecordSummary = { totalMoney: number; kwh: number; minutes: number };
export type RecordResponse = { series: RecordPoint[]; summary: RecordSummary };