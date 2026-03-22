import React, { useState } from 'react';
import type { ChartGroup as ChartGroupType, DpMeta, SeriesData, TimeRange } from '../types';
import type { Action } from '../store/reducer';
import { useWsSubscription } from '../hooks/useWsSubscription';
import { LineChart } from './LineChart';

interface Props {
  group: ChartGroupType;
  dpMeta: Record<string, DpMeta>;
  dpData: Record<string, SeriesData>;
  dispatch: React.Dispatch<Action>;
}

const TIME_RANGE_LABELS: { key: TimeRange; label: string }[] = [
  { key: '30s',   label: '30s' },
  { key: '2min',  label: '2min' },
  { key: '10min', label: '10min' },
];

export function ChartGroup({ group, dpMeta, dpData, dispatch }: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState(group.name);

  useWsSubscription(group.id, group.dps);

  function handleNameSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (nameInput.trim()) {
      dispatch({ type: 'RENAME_GROUP', payload: { id: group.id, name: nameInput.trim() } });
    }
    setEditingName(false);
  }

  function handleRemoveDp(dp: string) {
    dispatch({ type: 'REMOVE_DP', payload: { groupId: group.id, dp } });
  }

  function handleRemoveGroup() {
    dispatch({ type: 'REMOVE_GROUP', payload: { id: group.id } });
  }

  function handleTimeRange(tr: TimeRange) {
    dispatch({ type: 'SET_TIMERANGE', payload: { groupId: group.id, timerange: tr } });
  }

  return (
    <div className="group-card">
      <div className="group-header">
        {editingName ? (
          <form onSubmit={handleNameSubmit} style={{ display: 'flex', gap: 4, flex: 1 }}>
            <input
              className="toolbar-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
              onBlur={() => handleNameSubmit()}
              style={{ fontWeight: 600, flex: 1 }}
            />
          </form>
        ) : (
          <span
            className="group-name"
            onClick={() => { setNameInput(group.name); setEditingName(true); }}
            title="Click to rename"
          >
            {group.name}
          </span>
        )}

        <div className="group-chips">
          {group.dps.map((dp) => (
            <span
              key={dp}
              className="dp-chip"
              style={{ borderColor: dpMeta[dp]?.color ?? 'var(--vscode-panel-border)' }}
            >
              <span
                className="dp-chip-dot"
                style={{ background: dpMeta[dp]?.color ?? 'var(--vscode-foreground)' }}
              />
              <span className="dp-chip-label" title={dp}>{dp.split(':').pop() ?? dp}</span>
              <button
                className="dp-chip-remove"
                onClick={() => handleRemoveDp(dp)}
                aria-label={`Remove ${dp}`}
              >
                x
              </button>
            </span>
          ))}
        </div>

        <div className="group-timerange">
          {TIME_RANGE_LABELS.map(({ key, label }) => (
            <button
              key={key}
              className={`timerange-btn${group.timerange === key ? ' active' : ''}`}
              onClick={() => handleTimeRange(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className="toolbar-btn toolbar-btn-icon toolbar-btn-danger"
          onClick={handleRemoveGroup}
          aria-label="Remove group"
          title="Remove group"
        >
          x
        </button>
      </div>

      {group.dps.length === 0 ? (
        <div className="chart-empty">No DPs yet. Click "+ Add DP" to add one.</div>
      ) : (
        <LineChart dps={group.dps} dpMeta={dpMeta} dpData={dpData} timerange={group.timerange} />
      )}
    </div>
  );
}
