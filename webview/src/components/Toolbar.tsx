import React from 'react';
import type { AppState } from '../types';
import type { Action } from '../store/reducer';
import { useWs, type WsStatus } from '../context/WsContext';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  onOpenSettings: () => void;
  onAddDp: () => void;
}

function StatusDot({ status }: { status: WsStatus }) {
  const bg =
    status === 'connected'    ? 'var(--dp-status-good)' :
    status === 'connecting'   ? 'var(--dp-status-warn)' :
                                'var(--dp-status-bad)';
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', background: bg, flexShrink: 0,
    }} />
  );
}

export function Toolbar({ state, onOpenSettings, onAddDp }: Props) {
  const { status } = useWs();

  const statusText: Record<WsStatus, string> = {
    connected:    `${state.settings.host}:${state.settings.port}`,
    connecting:   `Connecting…`,
    disconnected: 'Disconnected',
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-brand">DP Inspector</span>
        <StatusDot status={status} />
        <span className="toolbar-status-text">{statusText[status]}</span>
      </div>

      <div className="toolbar-right">
        <button
          className="toolbar-btn"
          onClick={onAddDp}
          disabled={state.groups.length === 0}
          title={state.groups.length === 0 ? 'Add a group first' : 'Add datapoint'}
        >
          + Add DP
        </button>
        <button className="toolbar-btn toolbar-btn-ghost" onClick={onOpenSettings}>
          ⚙ Settings
        </button>
      </div>
    </div>
  );
}