import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Eye, EyeOff, X, Trash2, GripHorizontal, Plus } from 'lucide-react';
import type { ChartGroup as ChartGroupType, DpMeta, SeriesData, TimeRange } from '../types';
import type { Action } from '../store/reducer';
import { useWsSubscription } from '../hooks/useWsSubscription';
import { LineChart } from './LineChart';

interface Props {
  group: ChartGroupType;
  dpMeta: Record<string, DpMeta>;
  dpData: Record<string, SeriesData>;
  dispatch: React.Dispatch<Action>;
  paused?: boolean;
}

const TIME_RANGE_LABELS: { key: TimeRange; label: string }[] = [
  { key: '30s',   label: '30s' },
  { key: '2min',  label: '2m' },
  { key: '10min', label: '10m' },
];

export function ChartGroup({ group, dpMeta, dpData, dispatch, paused = false }: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState(group.name);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

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

  function handleToggleVisibility(dp: string) {
    dispatch({ type: 'TOGGLE_DP_VISIBILITY', payload: { groupId: group.id, dp } });
  }

  // ── Resize handle ────────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: group.height };

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const newH = Math.max(80, dragRef.current.startH + (ev.clientY - dragRef.current.startY));
      dispatch({ type: 'SET_GROUP_HEIGHT', payload: { groupId: group.id, height: newH } });
    }

    function onMouseUp() {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [group.id, group.height, dispatch]);

  // Sync nameInput if group.name changes externally
  useEffect(() => { setNameInput(group.name); }, [group.name]);

  return (
    <div className="group-card">
      {/* ── Header ────────────────────────────────────────────────── */}
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

        {/* DP chips — click name to toggle visibility */}
        <div className="group-chips">
          {group.dps.map((dp) => {
            const isHidden = group.hiddenDps.includes(dp);
            const color = dpMeta[dp]?.color ?? 'var(--vscode-panel-border)';
            return (
              <span
                key={dp}
                className={`dp-chip${isHidden ? ' dp-chip-hidden' : ''}`}
                style={{ borderColor: color }}
              >
                <span
                  className="dp-chip-dot"
                  style={{ background: isHidden ? 'transparent' : color, borderColor: color }}
                />
                <span
                  className="dp-chip-label"
                  title={isHidden ? `${dp} (hidden — click to show)` : `${dp} (click to hide)`}
                  onClick={() => handleToggleVisibility(dp)}
                >
                  {dp.split(':').pop() ?? dp}
                </span>
                <span
                  className="dp-chip-eye"
                  onClick={() => handleToggleVisibility(dp)}
                  title={isHidden ? 'Show' : 'Hide'}
                >
                  {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                </span>
                <button
                  className="dp-chip-remove"
                  onClick={() => handleRemoveDp(dp)}
                  aria-label={`Remove ${dp}`}
                  title="Remove DP"
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>

        {/* Time range buttons */}
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
          className="toolbar-btn toolbar-btn-icon"
          onClick={handleRemoveGroup}
          aria-label="Remove group"
          title="Remove group"
          style={{ color: 'var(--dp-status-bad)', borderColor: 'transparent', background: 'transparent' }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────── */}
      {group.dps.length === 0 ? (
        <div className="chart-empty">
          <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Add DPs via "+" Add DP" in the toolbar.
        </div>
      ) : (
        <LineChart
          dps={group.dps}
          dpMeta={dpMeta}
          dpData={dpData}
          dpHidden={group.hiddenDps}
          timerange={group.timerange}
          height={group.height}
          paused={paused}
        />
      )}

      {/* ── Resize handle ─────────────────────────────────────────── */}
      {group.dps.length > 0 && (
        <div className="resize-handle" onMouseDown={handleResizeMouseDown} title="Drag to resize">
          <GripHorizontal size={14} />
        </div>
      )}
    </div>
  );
}