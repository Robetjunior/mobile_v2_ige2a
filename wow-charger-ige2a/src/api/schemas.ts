import { z } from 'zod';

// Charger detail schema
export const ConnectorSchema = z.object({
  id: z.number().optional(),
  type: z.string().optional(),
  powerKw: z.number().optional(),
  status: z.string().optional(),
}).passthrough();

export const ChargerSchema = z.object({
  chargeBoxId: z.string(),
  wsOnline: z.boolean().optional(),
  lastStatus: z.string().optional(),
  connectors: z.array(ConnectorSchema).optional(),
}).passthrough();

// Active session detail
export const SessionSchema = z.object({
  transaction_id: z.number().optional(),
  id_tag: z.string().optional(),
  started_at: z.string().optional(),
  is_active: z.boolean().optional(),
}).passthrough();

export const TelemetrySchema = z.object({
  kwh: z.number().optional(),
  power_kw: z.number().optional(),
  voltage_v: z.number().optional(),
  current_a: z.number().optional(),
  soc_percent_at: z.number().optional(),
  at: z.string().optional(),
}).passthrough();

export const ProgressSchema = z.object({
  duration_seconds: z.number().optional(),
  energy_kwh: z.number().optional(),
  price_total: z.number().optional(),
}).passthrough();

export const ActiveDetailSchema = z.object({
  session: SessionSchema.optional(),
  telemetry: TelemetrySchema.optional(),
  progress: ProgressSchema.optional(),
}).passthrough();

// Final session
export const FinalSessionSchema = z.object({
  status: z.string(),
  duration_seconds: z.number().optional(),
  stopped_at: z.string().optional(),
  stop_reason: z.string().optional(),
  session: SessionSchema.optional(),
}).passthrough();

export type Charger = z.infer<typeof ChargerSchema>;
export type ActiveDetail = z.infer<typeof ActiveDetailSchema>;
export type FinalSession = z.infer<typeof FinalSessionSchema>;