import type { ChartGroup, SeriesDataMap, LiveValue, TimeRange, PersistedAppState, DataPoint } from '../types';
import { colorForIndex, TIME_RANGE_MS } from '../types';

// ─── State ────────────────────────────────────────────────────────────────────

export interface AppState {
  groups: ChartGroup[];
  seriesData: SeriesDataMap;
  liveValues: Record<string, LiveValue>; // dp → LiveValue
  host: string;
  port: number;
}

export const initialState: AppState = {
  groups: [],
  seriesData: {},
  liveValues: {},
  host: 'localhost',
  port: 4712,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'RESTORE_STATE'; state: PersistedAppState }
  | { type: 'SET_CONNECTION'; host: string; port: number }
  | { type: 'ADD_GROUP'; group: ChartGroup }
  | { type: 'REMOVE_GROUP'; groupId: string }
  | { type: 'RENAME_GROUP'; groupId: string; name: string }
  | { type: 'SET_TIME_RANGE'; groupId: string; timeRange: TimeRange; customRangeMs?: number }
  | { type: 'ADD_DP_TO_GROUP'; groupId: string; dp: string }
  | { type: 'REMOVE_DP_FROM_GROUP'; groupId: string; dp: string }
  | { type: 'UPDATE_VALUE'; dp: string; value: number | boolean | string | null; ts: number; quality: 'good' | 'bad' | 'uncertain' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All DPs currently subscribed across all groups (deduplicated). */
export function getAllDps(groups: ChartGroup[]): string[] {
  const set = new Set<string>();
  for (const g of groups) {
    for (const dp of g.dps) set.add(dp);
  }
  return Array.from(set);
}

function trimDataToWindow(data: DataPoint[], windowMs: number): DataPoint[] {
  if (data.length === 0) return data;
  const cutoff = Date.now() - windowMs;
  // Keep last point before cutoff as well (for chart continuity)
  const idx = data.findIndex((p) => p.ts >= cutoff);
  if (idx <= 0) return data;
  return data.slice(Math.max(0, idx - 1));
}

/** Resolve the window size for a group in milliseconds. */
function windowMs(group: ChartGroup): number {
  if (group.timeRange === 'custom' && group.customRangeMs) return group.customRangeMs;
  return TIME_RANGE_MS[group.timeRange as Exclude<TimeRange, 'custom'>] ?? 30_000;
}

/** Largest window across all groups containing a given DP. */
function maxWindowForDp(dp: string, groups: ChartGroup[]): number {
  let max = 30_000;
  for (const g of groups) {
    if (g.dps.includes(dp)) max = Math.max(max, windowMs(g));
  }
  return max;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'RESTORE_STATE': {
      const { state: persisted } = action;
      // Re-initialise seriesData entries for all DPs in restored groups
      const seriesData = { ...state.seriesData };
      let colorIdx = 0;
      for (const g of persisted.groups) {
        for (const dp of g.dps) {
          if (!seriesData[dp]) {
            seriesData[dp] = { dp, color: colorForIndex(colorIdx++), data: [] };
          }
        }
      }
      return {
        ...state,
        groups: persisted.groups,
        host: persisted.host,
        port: persisted.port,
        seriesData,
      };
    }

    case 'SET_CONNECTION':
      return { ...state, host: action.host, port: action.port };

    case 'ADD_GROUP':
      return { ...state, groups: [...state.groups, action.group] };

    case 'REMOVE_GROUP': {
      const remaining = state.groups.filter((g) => g.id !== action.groupId);
      // Clean up series data for DPs no longer in any group
      const dpsStillNeeded = new Set(getAllDps(remaining));
      const seriesData = Object.fromEntries(
        Object.entries(state.seriesData).filter(([dp]) => dpsStillNeeded.has(dp)),
      );
      const liveValues = Object.fromEntries(
        Object.entries(state.liveValues).filter(([dp]) => dpsStillNeeded.has(dp)),
      );
      return { ...state, groups: remaining, seriesData, liveValues };
    }

    case 'RENAME_GROUP': {
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, name: action.name } : g,
      );
      return { ...state, groups };
    }

    case 'SET_TIME_RANGE': {
      const groups = state.groups.map((g) =>
        g.id === action.groupId
          ? { ...g, timeRange: action.timeRange, customRangeMs: action.customRangeMs }
          : g,
      );
      return { ...state, groups };
    }

    case 'ADD_DP_TO_GROUP': {
      const { groupId, dp } = action;
      const groups = state.groups.map((g) => {
        if (g.id !== groupId || g.dps.includes(dp)) return g;
        return { ...g, dps: [...g.dps, dp] };
      });
      // Ensure series data entry exists for this DP
      const seriesData = { ...state.seriesData };
      if (!seriesData[dp]) {
        const colorIdx = Object.keys(seriesData).length;
        seriesData[dp] = { dp, color: colorForIndex(colorIdx), data: [] };
      }
      return { ...state, groups, seriesData };
    }

    case 'REMOVE_DP_FROM_GROUP': {
      const { groupId, dp } = action;
      const groups = state.groups.map((g) =>
        g.id === groupId ? { ...g, dps: g.dps.filter((d) => d !== dp) } : g,
      );
      // Clean up series data if DP is no longer in any group
      const dpsStillNeeded = new Set(getAllDps(groups));
      const seriesData = Object.fromEntries(
        Object.entries(state.seriesData).filter(([d]) => dpsStillNeeded.has(d)),
      );
      const liveValues = Object.fromEntries(
        Object.entries(state.liveValues).filter(([d]) => dpsStillNeeded.has(d)),
      );
      return { ...state, groups, seriesData, liveValues };
    }

    case 'UPDATE_VALUE': {
      const { dp, value, ts, quality } = action;
      if (!state.seriesData[dp]) return state; // ignore updates for unsubscribed DPs

      const numValue = typeof value === 'number' ? value : null;
      const maxWindow = maxWindowForDp(dp, state.groups);
      const newPoint: DataPoint = { ts, value: numValue };
      const existingData = state.seriesData[dp]!.data;
      const newData = trimDataToWindow([...existingData, newPoint], maxWindow);

      const seriesData = {
        ...state.seriesData,
        [dp]: { ...state.seriesData[dp]!, data: newData },
      };

      const liveValues = {
        ...state.liveValues,
        [dp]: { dp, value, ts, quality },
      };

      return { ...state, seriesData, liveValues };
    }

    default:
      return state;
  }
}
