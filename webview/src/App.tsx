import React, { useEffect, useReducer, useRef } from 'react';
import { reducer, initialState, getAllDps } from './store/reducer';
import type { AppState, Action } from './store/reducer';
import type { PersistedAppState } from './types';
import { WsContextProvider } from './context/WsContext';
import { Toolbar } from './components/Toolbar';
import { ChartGroup as ChartGroupComponent } from './components/ChartGroup';
import { LiveValueTable } from './components/LiveValueTable';
import { useWs } from './context/WsContext';

// ─── VS Code API ──────────────────────────────────────────────────────────────

declare global {
  function acquireVsCodeApi(): {
    postMessage: (msg: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
  };
}

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

// ─── Root App ────────────────────────────────────────────────────────────────
//
// Architecture:
//   App  (owns useReducer, creates WsContextProvider)
//    └─ WsContextProvider (receives dispatch to push UPDATE_VALUE actions)
//         └─ AppShell    (inside provider → has access to connect())
//              ├─ Toolbar
//              ├─ Chart area
//              └─ Live table

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <WsContextProvider dispatch={dispatch}>
      <AppShell state={state} dispatch={dispatch} />
    </WsContextProvider>
  );
}

// ─── AppShell ────────────────────────────────────────────────────────────────

interface ShellProps {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

function AppShell({ state, dispatch }: ShellProps) {
  const { connect } = useWs();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Handle messages from extension host ───────────────────────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent<{ command: string; [key: string]: unknown }>) {
      const message = event.data;
      switch (message.command) {
        case 'initState': {
          const host = (message['host'] as string | undefined) ?? 'localhost';
          const port = (message['port'] as number | undefined) ?? 4712;
          const persisted = message['persistedState'] as PersistedAppState | null | undefined;
          if (persisted?.groups?.length) {
            dispatch({ type: 'RESTORE_STATE', state: persisted });
            connect(persisted.host ?? host, persisted.port ?? port);
          } else {
            dispatch({ type: 'SET_CONNECTION', host, port });
            connect(host, port);
          }
          break;
        }
        case 'configChanged': {
          const host = (message['host'] as string | undefined) ?? state.host;
          const port = (message['port'] as number | undefined) ?? state.port;
          dispatch({ type: 'SET_CONNECTION', host, port });
          break;
        }
      }
    }
    window.addEventListener('message', handleMessage);
    vscode?.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  // ── Persist state changes to VS Code workspaceState (debounced) ───────────
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const persisted: PersistedAppState = {
        groups: state.groups,
        host: state.host,
        port: state.port,
      };
      vscode?.postMessage({ command: 'saveState', state: persisted });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state.groups, state.host, state.port]);

  const allDps = getAllDps(state.groups);

  return (
    <div className="app-container">
      <Toolbar state={state} dispatch={dispatch} />

      <div className="chart-area">
        {state.groups.length === 0 ? (
          <div className="chart-area-empty">
            <p>No chart groups yet.</p>
            <p>Click <strong>+ Add Chart Group</strong> in the toolbar, then search for DPs to add.</p>
          </div>
        ) : (
          state.groups.map((group) => (
            <ChartGroupComponent
              key={group.id}
              group={group}
              seriesData={state.seriesData}
              dispatch={dispatch}
            />
          ))
        )}
      </div>

      <div className="live-table-section">
        <LiveValueTable liveValues={state.liveValues} seriesData={state.seriesData} />
        {allDps.length > 0 && (
          <div className="live-table-count">
            {allDps.length} DP{allDps.length !== 1 ? 's' : ''} monitored
          </div>
        )}
      </div>
    </div>
  );
}
