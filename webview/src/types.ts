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

export interface DpSearchResultMsg {
  type: 'dpSearchResult';
  id: string;
  dps: string[];
}

export interface ErrorMsg {
  type: 'error';
  id: string;
  message: string;
}

export type ServerMessage = SubscribedMsg | UpdateMsg | DpSearchResultMsg | ErrorMsg;

// ─── UI model types ───────────────────────────────────────────────────────────

/** A single timestamped data point for a series on a chart. */
export interface DataPoint {
  ts: number; // unix ms
  value: number | null;
}

/** One DP series inside a chart group. */
export interface DpSeries {
  dp: string;
  color: string;
  data: DataPoint[];
}

export type TimeRange = '30s' | '2min' | '10min' | 'custom';

/** A chart panel that can show multiple DPs overlaid. */
export interface ChartGroup {
  id: string;
  name: string;
  dps: string[]; // ordered list of subscribed DP names
  timeRange: TimeRange;
  customRangeMs?: number; // only used when timeRange === 'custom'
}

/** Snapshot of one DP's latest value shown in the live table. */
export interface LiveValue {
  dp: string;
  value: number | boolean | string | null;
  unit?: string;
  ts: number;
  quality: 'good' | 'bad' | 'uncertain';
}

/** The entire application state that is persisted to VS Code workspaceState. */
export interface PersistedAppState {
  groups: ChartGroup[];
  host: string;
  port: number;
}

/** Runtime state (not persisted — cleared on reload). */
export interface SeriesDataMap {
  // dp → DpSeries
  [dp: string]: DpSeries;
}

// ─── Distinct color palette for series (8 colors) ────────────────────────────

export const DP_COLORS: readonly string[] = [
  '#4fc3f7', // sky blue
  '#81c784', // green
  '#ffb74d', // amber
  '#e57373', // red
  '#ba68c8', // purple
  '#4dd0e1', // cyan
  '#fff176', // yellow
  '#ff8a65', // orange
] as const;

export function colorForIndex(index: number): string {
  return DP_COLORS[index % DP_COLORS.length]!;
}

/** Time ranges in milliseconds. */
export const TIME_RANGE_MS: Record<Exclude<TimeRange, 'custom'>, number> = {
  '30s': 30_000,
  '2min': 2 * 60_000,
  '10min': 10 * 60_000,
};
