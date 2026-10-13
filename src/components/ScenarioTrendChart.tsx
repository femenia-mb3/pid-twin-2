import React, { useMemo, useState } from 'react';

interface ScenarioTrendChartProps {
  saturacionGlobalPct: number;
  variacionVsMedia: number;
  escenario: string;
}

const BASE_SERIES = [34, 38, 45, 53, 61, 66, 72, 76, 71, 63, 55, 42];
// Un punto por hora, de 09:00 a 20:00.
const HOURS = BASE_SERIES.map((_, i) => `${String(9 + i).padStart(2, '0')}:00`);
const AXIS_LABEL_INDEXES = [0, 2, 4, 6, 8, 10];

const createPolyline = (values: number[], width: number, height: number, padding: number) => {
  const max = 110;
  const min = 20;
  return values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((Math.min(value, max) - min) / (max - min)) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
};

export const ScenarioTrendChart: React.FC<ScenarioTrendChartProps> = ({
  saturacionGlobalPct,
  variacionVsMedia,
  escenario
}) => {
  const series = useMemo(() => {
    const pressure = Math.max(0, saturacionGlobalPct - 58);
    return BASE_SERIES.map((base, index) => {
      const peakWeight = Math.sin((index / (BASE_SERIES.length - 1)) * Math.PI);
      return Math.min(112, Math.max(18, base + pressure * peakWeight * 0.58 + variacionVsMedia * 0.08));
    });
  }, [saturacionGlobalPct, variacionVsMedia]);

  const [hover, setHover] = useState<number | null>(null);

  const width = 320;
  const height = 136;
  const padding = 18;
  const basePolyline = createPolyline(BASE_SERIES, width, height, padding);
  const scenarioPolyline = createPolyline(series, width, height, padding);
  const scenarioPoints = scenarioPolyline.split(' ').map((p) => p.split(',').map(Number));
  const basePoints = basePolyline.split(' ').map((p) => p.split(',').map(Number));
  const last = scenarioPoints.at(-1) ?? [0, 0];

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((x - padding) / (width - padding * 2)) * (BASE_SERIES.length - 1));
    setHover(Math.min(BASE_SERIES.length - 1, Math.max(0, idx)));
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Evolución de afluencia</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">Curva estimada para: {escenario}</p>
        </div>
        <div className={`rounded-md px-2 py-1 text-[10px] font-bold ${
          saturacionGlobalPct >= 90 ? 'bg-rose-50 text-rose-600' : saturacionGlobalPct >= 75 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
        }`}>
          Pico {Math.round(Math.max(...series))}%
        </div>
      </div>

      <div className="relative">
      <svg className="h-auto w-full touch-none" onPointerMove={handleMove} onPointerLeave={() => setHover(null)} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de evolución de afluencia estimada">
        <defs>
          <linearGradient id="scenario-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="scenario-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="62%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
        </defs>
        {[32, 56, 80, 104].map((y) => (
          <line key={y} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <polygon points={`${padding},${height - padding} ${scenarioPolyline} ${width - padding},${height - padding}`} fill="url(#scenario-area)" />
        <polyline points={basePolyline} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
        <polyline points={scenarioPolyline} fill="none" stroke="url(#scenario-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="4" fill="#ffffff" stroke="#be185d" strokeWidth="2.5" />
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={scenarioPoints[hover][0]} x2={scenarioPoints[hover][0]} y1={padding} y2={height - padding} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={basePoints[hover][0]} cy={basePoints[hover][1]} r="3.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
            <circle cx={scenarioPoints[hover][0]} cy={scenarioPoints[hover][1]} r="4.5" fill="#ffffff" stroke="#be185d" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] shadow-md"
          style={{ left: `${Math.min(80, Math.max(20, (scenarioPoints[hover][0] / width) * 100))}%` }}
        >
          <div className="font-bold text-slate-700">{HOURS[hover]}</div>
          <div className="text-rose-600">Escenario: <b className="font-mono">{Math.round(series[hover])}%</b></div>
          <div className="text-slate-500">Base: <b className="font-mono">{BASE_SERIES[hover]}%</b></div>
          <div className="font-mono text-slate-500">Δ {series[hover] - BASE_SERIES[hover] >= 0 ? '+' : ''}{Math.round(series[hover] - BASE_SERIES[hover])} pp</div>
        </div>
      )}
      </div>

      <div className="relative mt-1 h-3 text-[9px] text-slate-400">
        {AXIS_LABEL_INDEXES.map((i) => (
          <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(basePoints[i][0] / width) * 100}%` }}>{HOURS[i]}</span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dashed border-slate-400" />Base</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-rose-500" />Escenario simulado</span>
      </div>
    </section>
  );
};
