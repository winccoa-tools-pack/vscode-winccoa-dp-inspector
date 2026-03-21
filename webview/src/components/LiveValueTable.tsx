import React, { useEffect, useRef, useState } from 'react';
import type { LiveValue, SeriesDataMap } from '../types';

interface Props {
  liveValues: Record<string, LiveValue>;
  seriesData: SeriesDataMap;
}

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 1000) return 'just now';
  if (diffMs < 60_000) return `${(diffMs / 1000).toFixed(1)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}min ago`;
  return `${Math.floor(diffMs / 3_600_000)}h ago`;
}

function qualityBadge(quality: 'good' | 'bad' | 'uncertain') {
  const styles: Record<string, string> = {
    good: 'var(--dp-status-good)',
    bad: 'var(--dp-status-bad)',
    uncertain: 'var(--dp-status-warn)',
  };
  return (
    <span style={{ color: styles[quality] ?? 'inherit', fontSize: 11 }}>
      {quality}
    </span>
  );
}

/** Row component — tracks its own flash state. */
function ValueRow({ lv, color }: { lv: LiveValue; color: string }) {
  const [flash, setFlash] = useState(false);
  const prevTsRef = useRef(lv.ts);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0); // forces re-render for relative time

  // Flash on value-change
  useEffect(() => {
    if (lv.ts !== prevTsRef.current) {
      prevTsRef.current = lv.ts;
      setFlash(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setFlash(false), 600);
    }
  }, [lv.ts]);

  // Refresh relative timestamp every second
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Suppress unused variable warning
  void tick;

  const displayValue =
    lv.value === null ? '—' : typeof lv.value === 'boolean' ? String(lv.value) : String(lv.value);

  const shortName = lv.dp.split(':').pop() ?? lv.dp;

  return (
    <tr className={`value-row${flash ? ' value-row-flash' : ''}`}>
      <td className="value-cell value-cell-dp" title={lv.dp}>
        <span
          className="dp-chip-dot"
          style={{ background: color, display: 'inline-block', marginRight: 6 }}
        />
        <span>{shortName}</span>
      </td>
      <td className="value-cell value-cell-value" title={displayValue}>
        {displayValue}
      </td>
      <td className="value-cell value-cell-unit">
        {lv.unit ?? ''}
      </td>
      <td className="value-cell value-cell-updated">
        {relativeTime(lv.ts)}
      </td>
      <td className="value-cell value-cell-quality">
        {qualityBadge(lv.quality)}
      </td>
    </tr>
  );
}

export function LiveValueTable({ liveValues, seriesData }: Props) {
  const rows = Object.values(liveValues);

  if (rows.length === 0) {
    return (
      <div className="live-table-empty">
        No active subscriptions. Add DPs to a chart group to start monitoring.
      </div>
    );
  }

  return (
    <div className="live-table-container">
      <table className="live-table">
        <thead>
          <tr>
            <th>DP Name</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Updated</th>
            <th>Quality</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lv) => (
            <ValueRow
              key={lv.dp}
              lv={lv}
              color={seriesData[lv.dp]?.color ?? 'var(--vscode-foreground)'}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
