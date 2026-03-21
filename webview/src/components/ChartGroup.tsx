import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { ChartGroup as ChartGroupType, SeriesDataMap, TimeRange } from '../types';
import { TIME_RANGE_MS } from '../types';
import type { Action } from '../store/reducer';
import { useWsSubscription } from '../hooks/useWsSubscription';

interface Props {
  group: ChartGroupType;
  seriesData: SeriesDataMap;
  dispatch: React.Dispatch<Action>;
}

const TIME_RANGE_LABELS: { key: Exclude<TimeRange, 'custom'>; label: string }[] = [
  { key: '30s', label: '30s' },
  { key: '2min', label: '2min' },
  { key: '10min', label: '10min' },
];

export function ChartGroup({ group, seriesData, dispatch }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(group.name);

  // Subscribe to all DPs in this group via WebSocket
  useWsSubscription(group.id, group.dps);

  // ── Chart creation / recreation on DP list change ─────────────────────────
  useLayoutEffect(() => {
    if (!chartContainerRef.current) return;

    // Destroy previous chart
    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }

    if (group.dps.length === 0) return;

    const width = chartContainerRef.current.clientWidth || 600;

    const series: uPlot.Series[] = [
      { label: 'Time' }, // x-axis series (required)
      ...group.dps.map((dp) => ({
        label: dp.split(':').pop() ?? dp,
        stroke: seriesData[dp]?.color ?? '#4fc3f7',
        width: 2,
        spanGaps: false,
      })),
    ];

    const opts: uPlot.Options = {
      width,
      height: 200,
      series,
      axes: [
        {
          stroke: 'var(--vscode-foreground)',
          ticks: { stroke: 'var(--vscode-panel-border)' },
          grid: { stroke: 'var(--vscode-panel-border)', width: 0.5 },
        },
        {
          stroke: 'var(--vscode-foreground)',
          ticks: { stroke: 'var(--vscode-panel-border)' },
          grid: { stroke: 'var(--vscode-panel-border)', width: 0.5 },
        },
      ],
      cursor: { show: true },
      legend: { show: false },
      padding: [8, 0, 0, 0],
    };

    const data = buildUplotData(group.dps, seriesData, getWindowMs(group));
    uplotRef.current = new uPlot(opts, data, chartContainerRef.current);

    return () => {
      uplotRef.current?.destroy();
      uplotRef.current = null;
    };
  // Recreate chart when DPs list changes (not on data update — that uses setData below)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, group.dps.join(',')]);

  // ── Chart data update on new values (no re-create) ─────────────────────────
  useEffect(() => {
    if (!uplotRef.current || group.dps.length === 0) return;
    const data = buildUplotData(group.dps, seriesData, getWindowMs(group));
    uplotRef.current.setData(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesData, group.timeRange, group.customRangeMs]);

  // ── Resize observer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (uplotRef.current && chartContainerRef.current) {
        uplotRef.current.setSize({ width: chartContainerRef.current.clientWidth, height: 200 });
      }
    });
    ro.observe(chartContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: 'RENAME_GROUP', groupId: group.id, name: nameInput });
    setEditingName(false);
  }

  function handleRemoveDp(dp: string) {
    dispatch({ type: 'REMOVE_DP_FROM_GROUP', groupId: group.id, dp });
  }

  function handleRemoveGroup() {
    dispatch({ type: 'REMOVE_GROUP', groupId: group.id });
  }

  function handleTimeRange(tr: Exclude<TimeRange, 'custom'>) {
    dispatch({ type: 'SET_TIME_RANGE', groupId: group.id, timeRange: tr });
  }

  return (
    <div className="chart-group">
      {/* Header */}
      <div className="chart-group-header">
        {editingName ? (
          <form onSubmit={handleNameSubmit} style={{ display: 'inline-flex', gap: 4 }}>
            <input
              className="toolbar-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
              onBlur={handleNameSubmit}
              style={{ fontWeight: 600 }}
            />
          </form>
        ) : (
          <span
            className="chart-group-name"
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {group.name}
          </span>
        )}

        {/* DP chips */}
        <div className="chart-group-chips">
          {group.dps.map((dp) => (
            <span
              key={dp}
              className="dp-chip"
              style={{ borderColor: seriesData[dp]?.color ?? 'var(--vscode-panel-border)' }}
            >
              <span
                className="dp-chip-dot"
                style={{ background: seriesData[dp]?.color ?? 'var(--vscode-foreground)' }}
              />
              <span className="dp-chip-label" title={dp}>{dp.split(':').pop() ?? dp}</span>
              <button
                className="dp-chip-remove"
                onClick={() => handleRemoveDp(dp)}
                title={`Remove ${dp}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <button
          className="toolbar-btn toolbar-btn-danger"
          onClick={handleRemoveGroup}
          title="Remove group"
        >
          ✕
        </button>
      </div>

      {/* Chart canvas */}
      {group.dps.length === 0 ? (
        <div className="chart-empty">
          Search for a DP and add it using the toolbar above.
        </div>
      ) : (
        <div ref={chartContainerRef} className="chart-canvas-container" />
      )}

      {/* Time range buttons */}
      <div className="chart-timerange">
        {TIME_RANGE_LABELS.map(({ key, label }) => (
          <button
            key={key}
            className={`timerange-btn${group.timeRange === key ? ' active' : ''}`}
            onClick={() => handleTimeRange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWindowMs(group: ChartGroupType): number {
  if (group.timeRange === 'custom' && group.customRangeMs) return group.customRangeMs;
  return TIME_RANGE_MS[group.timeRange as Exclude<TimeRange, 'custom'>] ?? 30_000;
}

/**
 * Build the `data` array expected by uPlot:
 *   data[0] = Float64Array of timestamps (seconds)
 *   data[i] = Float64Array of values for series i-1
 */
function buildUplotData(
  dps: string[],
  seriesData: SeriesDataMap,
  windowMs: number,
): uPlot.AlignedData {
  const cutoff = Date.now() - windowMs;

  // Collect all timestamps from all series, filtered to window
  const allTsSet = new Set<number>();
  for (const dp of dps) {
    for (const pt of seriesData[dp]?.data ?? []) {
      if (pt.ts >= cutoff) allTsSet.add(pt.ts);
    }
  }

  if (allTsSet.size === 0) {
    // Return minimal empty data set
    const empty = new Float64Array(0);
    return [empty, ...dps.map(() => empty)] as unknown as uPlot.AlignedData;
  }

  const tsArr = Array.from(allTsSet).sort((a, b) => a - b);
  const tsSeconds = new Float64Array(tsArr.map((t) => t / 1000));

  const valueSeries = dps.map((dp) => {
    const dataMap = new Map((seriesData[dp]?.data ?? []).map((p) => [p.ts, p.value]));
    return new Float64Array(
      tsArr.map((t) => {
        const v = dataMap.get(t);
        return v !== undefined && v !== null ? v : NaN;
      }),
    );
  });

  return [tsSeconds, ...valueSeries] as unknown as uPlot.AlignedData;
}
