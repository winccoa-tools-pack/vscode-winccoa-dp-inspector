import React, { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import type { DpMeta, SeriesData, TimeRange } from '../types';
import { TIME_RANGE_MS } from '../types';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip);

interface Props {
  dps: string[];
  dpMeta: Record<string, DpMeta>;
  dpData: Record<string, SeriesData>;
  timerange: TimeRange;
}

export const LineChart = React.memo(function LineChart({ dps, dpMeta, dpData, timerange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // ─── Create / recreate chart when DP list or timerange changes ────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const windowMs = TIME_RANGE_MS[timerange];
    const now = Date.now();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        datasets: dps.map((dp) => {
          const meta = dpMeta[dp];
          const isStepped = meta?.type === 'bool' || meta?.type === 'enum';
          return {
            label: dp.split(':').pop() ?? dp,
            data: (dpData[dp]?.points ?? []) as { x: number; y: number }[],
            borderColor: meta?.color ?? '#4db8ff',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            stepped: isStepped ? ('before' as const) : false,
            tension: 0,
          };
        }),
      },
      options: {
        animation: false,
        parsing: false,
        normalized: true,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
            titleColor: 'var(--vscode-foreground, #ccc)',
            bodyColor: 'var(--vscode-foreground, #ccc)',
            borderColor: 'var(--vscode-panel-border, #444)',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            type: 'time',
            min: now - windowMs,
            max: now,
            ticks: {
              color: 'var(--vscode-foreground, #ccc)',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6,
              font: { size: 10 },
            },
            grid: { color: 'var(--vscode-panel-border, #333)' },
          },
          y: {
            ticks: {
              color: 'var(--vscode-foreground, #ccc)',
              font: { size: 10 },
              maxTicksLimit: 5,
            },
            grid: { color: 'var(--vscode-panel-border, #333)' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dps.join(','), timerange]);

  // ─── Update data without full recreation ──────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const windowMs = TIME_RANGE_MS[timerange];
    const now = Date.now();

    chart.data.datasets.forEach((ds, i) => {
      const dp = dps[i];
      if (dp && dpData[dp]) {
        ds.data = dpData[dp].points as unknown as { x: number; y: number }[];
      }
    });

    if (chart.options.scales?.x) {
      chart.options.scales.x.min = now - windowMs;
      chart.options.scales.x.max = now;
    }

    chart.update('none');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpData, timerange]);

  return (
    <div style={{ height: 90, width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
});
