import React from 'react';
import type { AppSettings, TimeRange, Interpolation } from '../types';
import type { Action } from '../store/reducer';
import { useWs } from '../context/WsContext';

interface Props {
  settings: AppSettings;
  dispatch: React.Dispatch<Action>;
}

export function SettingsDrawer({ settings, dispatch }: Props) {
  const { connect, disconnect, status } = useWs();

  function update(partial: Partial<AppSettings>) {
    dispatch({ type: 'UPDATE_SETTINGS', payload: partial });
  }

  return (
    <div className="settings-drawer">
      <div className="settings-drawer-header">
        <span>Settings</span>
      </div>

      <div className="settings-grid">
        {/* ── Connection ───────────────────────────────────────── */}
        <section>
          <h3>Connection</h3>
          <label>
            Host
            <input
              className="toolbar-input"
              value={settings.host}
              onChange={(e) => update({ host: e.target.value })}
            />
          </label>
          <label>
            Port
            <input
              className="toolbar-input"
              type="number"
              value={settings.port}
              onChange={(e) => update({ port: parseInt(e.target.value, 10) || 4712 })}
              style={{ width: 80 }}
            />
          </label>
          <label>
            Project
            <input
              className="toolbar-input"
              value={settings.project}
              onChange={(e) => update({ project: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {status !== 'connected' ? (
              <button
                className="toolbar-btn"
                onClick={() => connect(settings.host, settings.port)}
              >
                Connect
              </button>
            ) : (
              <button className="toolbar-btn toolbar-btn-danger" onClick={disconnect}>
                Disconnect
              </button>
            )}
          </div>
        </section>

        {/* ── Display ──────────────────────────────────────────── */}
        <section>
          <h3>Display</h3>
          <label>
            Default time range
            <select
              className="toolbar-input"
              value={settings.defaultTimerange}
              onChange={(e) => update({ defaultTimerange: e.target.value as TimeRange })}
            >
              <option value="30s">30 seconds</option>
              <option value="2min">2 minutes</option>
              <option value="10min">10 minutes</option>
            </select>
          </label>
          <label>
            Interpolation
            <select
              className="toolbar-input"
              value={settings.interpolation}
              onChange={(e) => update({ interpolation: e.target.value as Interpolation })}
            >
              <option value="step">Step (stepped)</option>
              <option value="linear">Linear</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.autoReconnect}
              onChange={(e) => update({ autoReconnect: e.target.checked })}
            />
            Auto-reconnect
          </label>
        </section>
      </div>
    </div>
  );
}
