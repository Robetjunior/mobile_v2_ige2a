export const LOGGER = {
  API: {
    info: (label: string, data?: any) => {
      // lightweight logger for validation
      try { console.log(`[API] ${label}`, data ?? {}); } catch {}
    },
  },
};

export const Telemetry = {
  track: (event: 'charge.start_click'|'charge.stop_click'|'charge.sse_event', data?: any) => {
    try { console.log(`[Telemetry] ${event}`, data ?? {}); } catch {}
  },
};