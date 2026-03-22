// ─── WebSocket protocol types (mirrors server/src/protocol.ts) ───────────────

export interface SubscribeMsg {
  type: 'subscribe';
  id: string;
  dps: string[];
}

export interface UnsubscribeMsg {
  type: 'unsubscribe';
  id: string;
}

export interface DpSearchMsg {
  type: 'dpSearch';
  id: string;
  query: string;
}

export type ClientMessage = SubscribeMsg | UnsubscribeMsg | DpSearchMsg;

export interface SubscribedMsg {
  type: 'subscribed';
  id: string;
  status: 'ok';
}

export interface UpdateMsg {
  type: 'update';
  id: string;
  dp: string;
  value: number | boolean | string | null;
  ts: number;
  quality: 'good' | 'bad' | 'uncertain';
}

/** A single DP entry from dpSearch results. */
export interface DpSearchEntry {
  name: string;
  type: DpType;
}

export interface DpSearchResultMsg {
  type: 'dpSearchResult';
  id: string;
  dps: DpSearchEntry[];
}

export interface ErrorMsg {
  type: 'error';
  id: string;
  message: string;
}

export type ServerMessage = SubscribedMsg | UpdateMsg | DpSearchResultMsg | ErrorMsg;

// ─── UI model types ───────────────────────────────────────────────────────────

export type DpType = 'float' | 'int' | 'bool' | 'enum';
export type TimeRange = '30s' | '2min' | '10min';
export type Interpolation = 'step' | 'linear';

/** Metadata for a single DP (assigned when added). */
export interface DpMeta {
  dp: string;
  type: DpType;
  color: string;
  unit?: string;
}

/** Live series buffer for Chart.js — {x: ts ms, y: value}. */
export interface SeriesData {
  points: { x: number; y: number }[];
  latestValue: number | string | boolean | null;
  latestTs: number;
  quality: 'good' | 'uncertain' | 'bad';
}

/** A chart group card. */
export interface ChartGroup {
  id: string;
  name: string;
  dps: string[];
  timerange: TimeRange;
  hiddenDps: string[];
  height: number;
}

/** App settings (persisted). */
export interface AppSettings {
  host: string;
  port: number;
  project: string;
  defaultTimerange: TimeRange;
  interpolation: Interpolation;
  autoReconnect: boolean;
}

/** Full app state. */
export interface AppState {
  connected: boolean;
  paused: boolean;
  groups: ChartGroup[];
  dpMeta: Record<string, DpMeta>;
  dpData: Record<string, SeriesData>;
  settings: AppSettings;
  recentDps: string[];
}

/** Shape persisted to workspaceState. */
export interface PersistedAppState {
  groups: ChartGroup[];
  dpMeta: Record<string, DpMeta>;
  settings: AppSettings;
  recentDps?: string[];
}

/** Snapshot of one DP's latest value shown in the live table. */
export interface LiveValue {
  dp: string;
  value: number | boolean | string | null;
  unit?: string;
  ts: number;
  quality: 'good' | 'bad' | 'uncertain';
}

// ─── Color palette ────────────────────────────────────────────────────────────

export const DP_COLORS: readonly string[] = [
  '#4db8ff',
  '#4ec94e',
  '#f0a030',
  '#b78fff',
  '#ff6b8a',
  '#5dcaa5',
  '#f48771',
  '#cca700',
] as const;

export function colorForIndex(index: number): string {
  return DP_COLORS[index % DP_COLORS.length]!;
}

export const TIME_RANGE_MS: Record<TimeRange, number> = {
  '30s':   30_000,
  '2min':  2 * 60_000,
  '10min': 10 * 60_000,
};
