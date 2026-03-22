import React, { useEffect, useReducer, useRef, useState } from 'react';
import { reducer, initialState, getAllDps } from './store/reducer';
import type { PersistedAppState } from './types';
import { WsContextProvider, useWs } from './context/WsContext';
import { Toolbar } from './components/Toolbar';
import { ChartGroup } from './components/ChartGroup';
import { LiveValueTable } from './components/LiveValueTable';
import { SettingsDrawer } from './components/SettingsDrawer';
import { AddDpDialog } from './components/AddDpDialog';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AppState } from './types';
import type { Action } from './store/reducer';

// ─── VS Code API ──────────────────────────────────────────────────────────────

declare global {
  function acquireVsCodeApi(): {
    postMessage: (msg: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
  };
}
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <WsContextProvider dispatch={dispatch}>
      <AppShell state={state} dispatch={dispatch} />
    </WsContextProvider>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

interface ShellProps { state: AppState; dispatch: React.Dispatch<Action>; }

function AppShell({ state, dispatch }: ShellProps) {
  const { connect } = useWs();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showAddDp, setShowAddDp]       = useState(false);
  const [liveTableCollapsed, setLiveTableCollapsed] = useState(false);

  // ── Bridge messages from extension host ─────────────────────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent<{ command: string; [key: string]: unknown }>) {
      const msg = event.data;
      switch (msg.command) {
        case 'initState': {
          const persisted = msg['persistedState'] as PersistedAppState | null | undefined;
          const fallbackHost = (msg['host'] as string | undefined) ?? 'localhost';
          const fallbackPort = (msg['port'] as number | undefined) ?? 4712;
          if (persisted?.groups?.length) {
            dispatch({ type: 'LOAD_STATE', payload: persisted });
            connect(persisted.settings?.host ?? fallbackHost, persisted.settings?.port ?? fallbackPort);
          } else {
            dispatch({ type: 'UPDATE_SETTINGS', payload: { host: fallbackHost, port: fallbackPort } });
            connect(fallbackHost, fallbackPort);
          }
          break;
        }
        case 'configChanged': {
          const host = msg['host'] as string | undefined;
          const port = msg['port'] as number | undefined;
          if (host !== undefined || port !== undefined) {
            dispatch({ type: 'UPDATE_SETTINGS', payload: { ...(host ? { host } : {}), ...(port ? { port } : {}) } });
          }
          break;
        }
      }
    }
    window.addEventListener('message', handleMessage);
    vscode?.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  // ── Persist state (debounced 500ms) ─────────────────────────────────────
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const persisted: PersistedAppState = {
        groups:   state.groups,
        dpMeta:   state.dpMeta,
        settings: state.settings,
      };
      vscode?.postMessage({ command: 'saveState', state: persisted });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state.groups, state.dpMeta, state.settings]);

  function handleAddGroup() {
    dispatch({ type: 'ADD_GROUP', payload: { name: `Group ${state.groups.length + 1}` } });
  }

  const allDps = getAllDps(state.groups);

  return (
    <div className="app">
      <Toolbar
        state={state}
        dispatch={dispatch}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(s => !s)}
        onAddDp={() => setShowAddDp(true)}
      />

      {showSettings && (
        <SettingsDrawer
          settings={state.settings}
          dispatch={dispatch}
        />
      )}

      <div className="chart-area">
        {state.groups.length === 0 ? (
          <div className="chart-area-empty">
            <p>No chart groups yet.</p>
            <button className="toolbar-btn" onClick={handleAddGroup}>
              + Add Group
            </button>
          </div>
        ) : (
          <>
            {state.groups.map((group) => (
              <ChartGroup
                key={group.id}
                group={group}
                dpMeta={state.dpMeta}
                dpData={state.dpData}
                dispatch={dispatch}
                paused={state.paused}
              />
            ))}
            <button className="add-group-btn" onClick={handleAddGroup}>
              + Add Group
            </button>
          </>
        )}
      </div>

      {allDps.length > 0 && (
        <div className={`live-table-section${liveTableCollapsed ? ' live-table-section--collapsed' : ''}`}>
          <div className="live-table-header" onClick={() => setLiveTableCollapsed(c => !c)} style={{ cursor: 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {liveTableCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              Live Values
            </span>
            <span className="live-table-count">{allDps.length} DP{allDps.length !== 1 ? 's' : ''}</span>
          </div>
          {!liveTableCollapsed && <LiveValueTable dpMeta={state.dpMeta} dpData={state.dpData} />}
        </div>
      )}

      {showAddDp && (
        <AddDpDialog
          groups={state.groups}
          dpMeta={state.dpMeta}
          recentDps={state.recentDps}
          dispatch={dispatch}
          onClose={() => setShowAddDp(false)}
        />
      )}
    </div>
  );
}