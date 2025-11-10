import dayjs from 'dayjs';
import { http } from './http';
import { RecordResponse, PeriodType } from '../types';


export async function fetchRecord(periodType: PeriodType, anchorDate: Date): Promise<RecordResponse> {
  const anchor = dayjs(anchorDate).format('YYYY-MM-DD');
  try {
    const res = await http<RecordResponse>(`/v1/records?type=${periodType}&anchor=${anchor}`, { timeoutMs: 15000 });
    if (res && Array.isArray(res.series)) return res;
    return mockRecord(periodType, anchorDate);
  } catch {
    return mockRecord(periodType, anchorDate);
  }
}

function mockRecord(periodType: PeriodType, anchorDate: Date): RecordResponse {
  // Gera 5 períodos até o anchor; direita = mais recente
  const points = [] as { label: string; totalMoney: number; kwh: number; minutes: number }[];
  const anchor = dayjs(anchorDate);
  const monthsPtBr = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  for (let i = 4; i >= 0; i--) {
    const d = periodType === 'month' ? anchor.subtract(i, 'month') : anchor.subtract(i, 'year');
    const label = periodType === 'month'
      ? `${monthsPtBr[d.month()]}/${d.format('YYYY')}`
      : d.format('YYYY');
    // Mock com alguns zeros para cobrir casos vazios
    const base = (5 - i);
    const totalMoney = i === 3 ? 0 : Math.round((base * 120.57 + (i % 2 === 0 ? 80.21 : 34.93)) * 100) / 100;
    const kwh = i === 3 ? 0 : Math.round((base * 42.5 + (i % 2 === 0 ? 10.2 : 5.7)) * 10) / 10;
    const minutes = base * 60 + (i % 2 === 0 ? 18 : 33);
    points.push({ label, totalMoney, kwh, minutes });
  }
  const summary = points.reduce(
    (acc, p) => ({
      totalMoney: Math.round((acc.totalMoney + p.totalMoney) * 100) / 100,
      kwh: Math.round((acc.kwh + p.kwh) * 10) / 10,
      minutes: acc.minutes + p.minutes,
    }),
    { totalMoney: 0, kwh: 0, minutes: 0 }
  );
  return { series: points, summary };
}