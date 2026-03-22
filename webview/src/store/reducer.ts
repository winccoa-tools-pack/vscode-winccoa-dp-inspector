import type {
  AppState,
  AppSettings,
  ChartGroup,
  DpMeta,
  SeriesData,
  TimeRange,
  PersistedAppState,
} from '../types';
import { colorForIndex, TIME_RANGE_MS } from '../types';

// Suppress unused import warning â€” TIME_RANGE_MS used by consumers
void TIME_RANGE_MS;

// â”€â”€â”€ Initial state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEFAULT_SETTINGS: AppSettings = {
  host: 'localhost',
  port: 4712,
  project: 'System1',
  defaultTimerange: '2min',
  interpolation: 'step',
  autoReconnect: true,
};

export const initialState: AppState = {
  connected: false,
  paused: false,
  groups: [],
  dpMeta: {},
  dpData: {},
  settings: DEFAULT_SETTINGS,
};

// â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type Action =
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'ADD_GROUP'; payload: { name: string } }
  | { type: 'REMOVE_GROUP'; payload: { id: string } }
  | { type: 'RENAME_GROUP'; payload: { id: string; name: string } }
  | { type: 'ADD_DP'; payload: { groupId: string; dp: string; dpType: string } }
  | { type: 'REMOVE_DP'; payload: { groupId: string; dp: string } }
  | { type: 'ON_UPDATE'; payload: { dp: string; value: number | string | boolean | null; ts: number; quality: string } }
  | { type: 'SET_TIMERANGE'; payload: { groupId: string; timerange: TimeRange } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'LOAD_STATE'; payload: PersistedAppState }
  | { type: 'TOGGLE_DP_VISIBILITY'; payload: { groupId: string; dp: string } }
  | { type: 'SET_GROUP_HEIGHT'; payload: { groupId: string; height: number } }
  | { type: 'CLEAR_GROUP_DATA'; payload: { groupId: string } }
  | { type: 'TOGGLE_PAUSE' };

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** All DPs currently in any group (deduplicated). */
export function getAllDps(groups: ChartGroup[]): string[] {
  const seen = new Set<string>();
  for (const g of groups) for (const dp of g.dps) seen.add(dp);
  return Array.from(seen);
}

function dpsStillNeeded(groups: ChartGroup[]): Set<string> {
  const s = new Set<string>();
  for (const g of groups) for (const dp of g.dps) s.add(dp);
  return s;
}

const MAX_POINTS = 2000;

function appendPoint(
  existing: SeriesData | undefined,
  value: number | string | boolean | null,
  ts: number,
  quality: string,
): SeriesData {
  const numValue =
    typeof value === 'number' ? value
    : typeof value === 'boolean' ? (value ? 1 : 0)
    : null;

  const prev = existing?.points ?? [];
  const next = numValue !== null
    ? [...prev, { x: ts, y: numValue }].slice(-MAX_POINTS)
    : prev;

  return {
    points: next,
    latestValue: value,
    latestTs: ts,
    quality: quality as 'good' | 'bad' | 'uncertain',
  };
}

// â”€â”€â”€ Reducer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };

    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused };

    case 'ADD_GROUP': {
      const id = `group-${Date.now()}`;
      const group: ChartGroup = {
        id,
        name: action.payload.name,
        dps: [],
        timerange: state.settings.defaultTimerange,
        hiddenDps: [],
        height: 160,
      };
      return { ...state, groups: [...state.groups, group] };
    }

    case 'REMOVE_GROUP': {
      const groups = state.groups.filter((g) => g.id !== action.payload.id);
      const needed = dpsStillNeeded(groups);
      const dpMeta = Object.fromEntries(Object.entries(state.dpMeta).filter(([dp]) => needed.has(dp)));
      const dpData = Object.fromEntries(Object.entries(state.dpData).filter(([dp]) => needed.has(dp)));
      return { ...state, groups, dpMeta, dpData };
    }

    case 'RENAME_GROUP': {
      const groups = state.groups.map((g) =>
        g.id === action.payload.id ? { ...g, name: action.payload.name } : g,
      );
      return { ...state, groups };
    }

    case 'ADD_DP': {
      const { groupId, dp, dpType } = action.payload;
      const groups = state.groups.map((g) => {
        if (g.id !== groupId || g.dps.includes(dp)) return g;
        return { ...g, dps: [...g.dps, dp] };
      });
      const dpMeta = { ...state.dpMeta };
      if (!dpMeta[dp]) {
        const colorIdx = Object.keys(dpMeta).length;
        dpMeta[dp] = { dp, type: dpType as DpMeta['type'], color: colorForIndex(colorIdx) };
      }
      const dpData = { ...state.dpData };
      if (!dpData[dp]) {
        dpData[dp] = { points: [], latestValue: null, latestTs: 0, quality: 'good' };
      }
      return { ...state, groups, dpMeta, dpData };
    }

    case 'REMOVE_DP': {
      const { groupId, dp } = action.payload;
      const groups = state.groups.map((g) =>
        g.id === groupId ? { ...g, dps: g.dps.filter((d) => d !== dp) } : g,
      );
      const needed = dpsStillNeeded(groups);
      const dpMeta = Object.fromEntries(Object.entries(state.dpMeta).filter(([d]) => needed.has(d)));
      const dpData = Object.fromEntries(Object.entries(state.dpData).filter(([d]) => needed.has(d)));
      return { ...state, groups, dpMeta, dpData };
    }

    case 'ON_UPDATE': {
      const { dp, value, ts, quality } = action.payload;
      if (!state.dpData[dp]) return state;
      return {
        ...state,
        dpData: { ...state.dpData, [dp]: appendPoint(state.dpData[dp], value, ts, quality) },
      };
    }

    case 'SET_TIMERANGE': {
      const groups = state.groups.map((g) =>
        g.id === action.payload.groupId ? { ...g, timerange: action.payload.timerange } : g,
      );
      return { ...state, groups };
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'TOGGLE_DP_VISIBILITY': {
      const { groupId, dp } = action.payload;
      const groups = state.groups.map((g) => {
        if (g.id !== groupId) return g;
        const hiddenDps = g.hiddenDps.includes(dp)
          ? g.hiddenDps.filter((d) => d !== dp)
          : [...g.hiddenDps, dp];
        return { ...g, hiddenDps };
      });
      return { ...state, groups };
    }

    case 'SET_GROUP_HEIGHT': {
      const groups = state.groups.map((g) =>
        g.id === action.payload.groupId ? { ...g, height: action.payload.height } : g,
      );
      return { ...state, groups };
    }

    case 'CLEAR_GROUP_DATA': {
      const group = state.groups.find((g) => g.id === action.payload.groupId);
      if (!group) return state;
      const dpData = { ...state.dpData };
      for (const dp of group.dps) {
        if (dpData[dp]) {
          dpData[dp] = { ...dpData[dp], points: [] };
        }
      }
      return { ...state, dpData };
    }

    case 'LOAD_STATE': {
      const { groups, dpMeta = {}, settings } = action.payload;
      // Migrate old persisted groups that lack new fields
      const migratedGroups = groups.map((g) => ({
        ...g,
        hiddenDps: (g as { hiddenDps?: string[] }).hiddenDps ?? [],
        height: (g as { height?: number }).height ?? 160,
      }));
      const dpData: Record<string, SeriesData> = {};
      for (const dp of Object.keys(dpMeta)) {
        dpData[dp] = { points: [], latestValue: null, latestTs: 0, quality: 'good' };
      }
      return { ...state, groups: migratedGroups, dpMeta, dpData, settings: { ...DEFAULT_SETTINGS, ...settings } };
    }

    default:
      return state;
  }
}
