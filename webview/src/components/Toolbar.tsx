import React, { useState, useRef } from 'react';
import type { AppState, Action } from '../store/reducer';
import { useWs, type WsStatus } from '../context/WsContext';
import { DpSearchDropdown } from './DpSearchDropdown';
import type { ChartGroup } from '../types';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

function StatusDot({ status }: { status: WsStatus }) {
  const colors: Record<WsStatus, string> = {
    connected: 'var(--dp-status-good)',
    connecting: 'var(--dp-status-warn)',
    disconnected: 'var(--dp-status-bad)',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: colors[status],
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

export function Toolbar({ state, dispatch }: Props) {
  const { status, connect, disconnect } = useWs();

  // Local host/port editable fields
  const [hostInput, setHostInput] = useState(state.host);
  const [portInput, setPortInput] = useState(String(state.port));

  // Search UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const statusLabel: Record<WsStatus, string> = {
    connected: `Connected to ${state.host}:${state.port}`,
    connecting: `Connecting to ${state.host}:${state.port}…`,
    disconnected: 'Disconnected',
  };

  function handleConnect() {
    const port = parseInt(portInput, 10);
    if (!hostInput || isNaN(port)) return;
    dispatch({ type: 'SET_CONNECTION', host: hostInput, port });
    connect(hostInput, port);
  }

  function handleDisconnect() {
    disconnect();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) setShowDropdown(true);
  }

  function handleAddGroup() {
    const id = `group-${Date.now()}`;
    const group: ChartGroup = {
      id,
      name: `Group ${Math.floor(Math.random() * 900) + 100}`,
      dps: [],
      timeRange: '2min',
    };
    dispatch({ type: 'ADD_GROUP', group });
  }

  return (
    <div className="toolbar">
      {/* Connection status */}
      <div className="toolbar-section toolbar-status">
        <StatusDot status={status} />
        <span className="toolbar-status-text">{statusLabel[status]}</span>
      </div>

      {/* Host / Port inputs */}
      <div className="toolbar-section" style={{ gap: 4 }}>
        <input
          className="toolbar-input"
          value={hostInput}
          onChange={(e) => setHostInput(e.target.value)}
          placeholder="localhost"
          aria-label="Host"
          style={{ width: 120 }}
        />
        <span style={{ color: 'var(--vscode-foreground)', opacity: 0.6 }}>:</span>
        <input
          className="toolbar-input"
          value={portInput}
          onChange={(e) => setPortInput(e.target.value)}
          placeholder="4712"
          aria-label="Port"
          style={{ width: 60 }}
        />
        {status === 'disconnected' ? (
          <button className="toolbar-btn toolbar-btn-primary" onClick={handleConnect}>
            Connect
          </button>
        ) : (
          <button className="toolbar-btn toolbar-btn-secondary" onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
      </div>

      {/* DP search */}
      <div className="toolbar-section" ref={searchRef} style={{ position: 'relative', flex: 1 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 4, width: '100%' }}>
          <input
            className="toolbar-input"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(false); }}
            placeholder="Search DPs (e.g. System1:Pump*)"
            aria-label="DP search"
            style={{ flex: 1 }}
            disabled={status !== 'connected'}
          />
          <button
            type="submit"
            className="toolbar-btn toolbar-btn-primary"
            disabled={status !== 'connected' || !searchQuery.trim()}
          >
            Search
          </button>
        </form>

        {showDropdown && (
          <DpSearchDropdown
            query={searchQuery}
            groups={state.groups}
            dispatch={dispatch}
            onClose={() => { setShowDropdown(false); setSearchQuery(''); }}
          />
        )}
      </div>

      {/* Add group */}
      <div className="toolbar-section">
        <button className="toolbar-btn toolbar-btn-secondary" onClick={handleAddGroup}>
          + Add Chart Group
        </button>
      </div>
    </div>
  );
}
