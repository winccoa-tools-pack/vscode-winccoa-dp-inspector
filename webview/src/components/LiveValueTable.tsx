import React, { useEffect, useRef, useState } from 'react';
import type { DpMeta, SeriesData } from '../types';

interface Props {
  dpMeta: Record<string, DpMeta>;
  dpData: Record<string, SeriesData>;
}

function relativeTime(ts: number): string {
  if (ts === 0) return '—';
  const d = Date.now() - ts;
  if (d <  1_000)       return 'just now';
  if (d < 60_000)       return `${(d / 1000).toFixed(1)}s ago`;
  if (d < 3_600_000)    return `${Math.floor(d / 60_000)}min ago`;
  return `${Math.floor(d / 3_600_000)}h ago`;
}

function QualityBadge({ quality }: { quality: 'good' | 'bad' | 'uncertain' }) {
  const color =
    quality === 'good'      ? 'var(--dp-status-good)' :
    quality === 'bad'       ? 'var(--dp-status-bad)'  :
                              'var(--dp-status-warn)';
  return <span style={{ color, fontSize: 11 }}>{quality}</span>;
}

function ValueRow({ dp, meta, data }: { dp: string; meta: DpMeta; data: SeriesData }) {
  const [flash, setFlash] = useState(false);
  const [, setTick] = useState(0);
  const prevTsRef = useRef(data.latestTs);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data.latestTs !== prevTsRef.current) {
      prevTsRef.current = data.latestTs;
      setFlash(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setFlash(false), 600);
    }
  }, [data.latestTs]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const displayValue =
    data.latestValue === null     ? '—' :
    typeof data.latestValue === 'boolean' ? (data.latestValue ? 'true' : 'false') :
    String(data.latestValue);

  const shortName = dp.split(':').pop() ?? dp;

  return (
    <tr className={`value-row${flash ? ' value-row-flash' : ''}`}>
      <td className="value-cell" title={dp}>
        <span className="dp-chip-dot" style={{ background: meta.color }} />
        {shortName}
      </td>
      <td className="value-cell value-cell-value">{displayValue}</td>
      <td className="value-cell" style={{ opacity: 0.6 }}>{meta.unit ?? ''}</td>
      <td className="value-cell" style={{ opacity: 0.6 }}>{relativeTime(data.latestTs)}</td>
      <td className="value-cell"><QualityBadge quality={data.quality} /></td>
    </tr>
  );
}

export function LiveValueTable({ dpMeta, dpData }: Props) {
  const dps = Object.keys(dpMeta);

  if (dps.length === 0) {
    return (
      <div className="live-table-empty">
        Add DPs to a group to start monitoring live values.
      </div>
    );
  }

  return (
    <div className="live-table-container">
      <table className="live-table">
        <thead>
          <tr>
            <th>DP</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Updated</th>
            <th>Quality</th>
          </tr>
        </thead>
        <tbody>
          {dps.map((dp) => {
            const meta = dpMeta[dp];
            const data = dpData[dp];
            if (!meta || !data) return null;
            return <ValueRow key={dp} dp={dp} meta={meta} data={data} />;
          })}
        </tbody>
      </table>
    </div>
  );
}