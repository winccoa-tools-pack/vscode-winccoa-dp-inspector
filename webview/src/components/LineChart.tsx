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

// ── Resolve CSS custom properties from the document (canvas ignores CSS vars) ─
function cssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.body).getPropertyValue(name).trim();
  return val || fallback;
}

function themeColors() {
  return {
    fg:      cssVar('--vscode-foreground', '#cccccc'),
    grid:    'rgba(128,128,128,0.18)',
    tooltip: cssVar('--vscode-editorWidget-background', '#252526'),
  };
}

// ── X-axis time config per timerange ─────────────────────────────────────────
const TICK_CONFIG: Record<TimeRange, {
  unit: 'second' | 'minute';
  stepSize: number;
  displayFormat: string;
  maxTicksLimit: number;
  snapMs: number;        // snap max to this boundary so ticks stay stable
}> = {
  '30s':   { unit: 'second', stepSize: 5,  displayFormat: ':ss',   maxTicksLimit: 7, snapMs: 5_000   },
  '2min':  { unit: 'second', stepSize: 30, displayFormat: 'mm:ss', maxTicksLimit: 5, snapMs: 30_000  },
  '10min': { unit: 'minute', stepSize: 2,  displayFormat: 'HH:mm', maxTicksLimit: 6, snapMs: 120_000 },
};

/** Round ts UP to the nearest snapMs boundary so the axis window shifts in discrete steps. */
function snapMax(ts: number, snapMs: number): number {
  return Math.ceil(ts / snapMs) * snapMs;
}

// ── Dual-Y detection ──────────────────────────────────────────────────────────
function detectYAxes(
  dps: string[],
  dpData: Record<string, SeriesData>,
): Record<string, 'y' | 'y2'> {
  if (dps.length < 2) return Object.fromEntries(dps.map((dp) => [dp, 'y']));

  const ranges: Record<string, number> = {};
  for (const dp of dps) {
    const pts = dpData[dp]?.points ?? [];
    if (pts.length === 0) { ranges[dp] = 1; continue; }
    const values = pts.map((p) => p.y);
    ranges[dp] = (Math.max(...values) - Math.min(...values)) || 1;
  }

  const maxRange = Math.max(...Object.values(ranges));
  const minRange = Math.min(...Object.values(ranges));

  // Only split axes if ranges differ by factor > 10
  if (maxRange / minRange < 10) {
    return Object.fromEntries(dps.map((dp) => [dp, 'y']));
  }

  const sorted = [...dps].sort((a, b) => ranges[b]! - ranges[a]!);
  const axis1 = new Set(sorted.slice(0, Math.ceil(sorted.length / 2)));
  return Object.fromEntries(dps.map((dp) => [dp, axis1.has(dp) ? 'y' : 'y2']));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  dps: string[];
  dpMeta: Record<string, DpMeta>;
  dpData: Record<string, SeriesData>;
  dpHidden: string[];
  timerange: TimeRange;
  height?: number;
  paused?: boolean;
}

export const LineChart = React.memo(function LineChart({
  dps, dpMeta, dpData, dpHidden, timerange, height = 120, paused = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  // ── Create / recreate when DPs or timerange change ───────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const { fg, grid, tooltip: tooltipBg } = themeColors();
    const tick = TICK_CONFIG[timerange];
    const windowMs = TIME_RANGE_MS[timerange];
    const now = snapMax(Date.now(), tick.snapMs);
    const yAxes = detectYAxes(dps, dpData);
    const hasDualAxis = new Set(Object.values(yAxes)).size > 1;

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
            yAxisID: yAxes[dp] ?? 'y',
            hidden: dpHidden.includes(dp),
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
            backgroundColor: tooltipBg,
            titleColor: fg,
            bodyColor: fg,
            borderColor: grid,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            type: 'time',
            min: now - windowMs,
            max: now,
            time: {
              unit: tick.unit,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(({ stepSize: tick.stepSize, displayFormats: { [tick.unit]: tick.displayFormat } }) as any),
            },
            ticks: {
              color: fg,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: tick.maxTicksLimit,
              font: { size: 10 },
            },
            grid: { color: grid },
          },
          y: {
            position: 'left',
            ticks: { color: fg, font: { size: 10 }, maxTicksLimit: 5 },
            grid: { color: grid },
          },
          ...(hasDualAxis ? {
            y2: {
              type: 'linear',
              position: 'right',
              ticks: { color: fg, font: { size: 10 }, maxTicksLimit: 5 },
              grid: { drawOnChartArea: false },
            },
          } : {}),
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dps.join(','), timerange]);

  // ── Live data update (no recreation) ────────────────────────────────────
  useEffect(() => {
    if (paused) return;
    const chart = chartRef.current;
    if (!chart) return;

    const tick = TICK_CONFIG[timerange];
    const windowMs = TIME_RANGE_MS[timerange];
    const now = snapMax(Date.now(), tick.snapMs);
    const yAxes = detectYAxes(dps, dpData);
    const hasDualAxis = new Set(Object.values(yAxes)).size > 1;

    chart.data.datasets.forEach((ds, i) => {
      const dp = dps[i];
      if (!dp) return;
      if (dpData[dp]) ds.data = dpData[dp].points as unknown as { x: number; y: number }[];
      (ds as { yAxisID?: string }).yAxisID = yAxes[dp] ?? 'y';
      (ds as { hidden?: boolean }).hidden = dpHidden.includes(dp);
    });

    if (chart.options.scales?.x) {
      chart.options.scales.x.min = now - windowMs;
      chart.options.scales.x.max = now;
    }

    // Add/remove y2 axis dynamically
    if (hasDualAxis && !chart.options.scales?.['y2']) {
      const { fg, grid } = themeColors();
      if (chart.options.scales) {
        chart.options.scales['y2'] = {
          type: 'linear',
          position: 'right',
          ticks: { color: fg, font: { size: 10 }, maxTicksLimit: 5 },
          grid: { drawOnChartArea: false, color: grid },
        };
      }
    } else if (!hasDualAxis && chart.options.scales?.['y2']) {
      delete chart.options.scales['y2'];
    }

    chart.update('none');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpData, dpHidden, timerange, paused]);

  return (
    <div style={{ height, width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
});