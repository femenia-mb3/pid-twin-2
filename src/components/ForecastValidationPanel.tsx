import React, { useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, FlaskConical, Target } from 'lucide-react';
import { SyntheticForecastExperiment } from '../services/syntheticForecast';

interface ForecastValidationPanelProps {
  destination: string;
  scenario: string;
  experiment: SyntheticForecastExperiment;
}

const chartPoints = (values: number[], width: number, height: number, padding: number) => {
  const minimum = Math.min(...values) * 0.88;
  const maximum = Math.max(...values) * 1.08;
  return values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - minimum) / Math.max(maximum - minimum, 1)) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

export const ForecastValidationPanel: React.FC<ForecastValidationPanelProps> = ({ destination, scenario, experiment }) => {
  const width = 320;
  const height = 142;
  const padding = 18;
  const prediction = experiment.series.map(point => point.prediccion);
  const observed = experiment.series.map(point => point.observado);
  const predictionLine = chartPoints(prediction, width, height, padding);
  const observedLine = chartPoints(observed, width, height, padding);
  const validationGood = experiment.mape <= 10;

  const [hover, setHover] = useState<number | null>(null);
  const toPoints = (line: string) => line.split(' ').map(p => p.split(',').map(Number));
  const predictionPoints = toPoints(predictionLine);
  const observedPoints = toPoints(observedLine);

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((x - padding) / (width - padding * 2)) * (prediction.length - 1));
    setHover(Math.min(prediction.length - 1, Math.max(0, idx)));
  };

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-fuchsia-800">
              <FlaskConical className="h-3.5 w-3.5" />
              Laboratorio de predicción
            </div>
            <p className="mt-1 text-[10px] text-slate-600">Histórico, predicción y observado generados con datos sintéticos reproducibles.</p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-fuchsia-600 px-2 py-1 text-[9px] font-bold text-white">{experiment.etiquetaDatos}</span>
        </div>
        <p className="mt-2 rounded-md border border-fuchsia-100 bg-white/80 px-2 py-1.5 text-[10px] text-slate-500">No representa calibración real. Se sustituye por telemetría observada cuando el destino conecte series históricas.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{scenario}</h3>
            <p className="mt-0.5 text-[10px] text-slate-500">{destination} · modelo {experiment.modeloVersion} · horizonte {experiment.horizonte}</p>
          </div>
          <Target className="h-4 w-4 text-cyan-500" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-cyan-50 p-2">
            <span className="text-[9px] font-bold uppercase text-cyan-700">Predicción T+4</span>
            <p className="mt-1 font-mono text-base font-bold text-slate-800">{experiment.prediccionT4.toLocaleString('es-ES')}</p>
            <span className="text-[9px] text-slate-500">personas estimadas</span>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <span className="text-[9px] font-bold uppercase text-slate-600">Observado T+4</span>
            <p className="mt-1 font-mono text-base font-bold text-slate-800">{experiment.observadoT4.toLocaleString('es-ES')}</p>
            <span className="text-[9px] text-slate-500">serie sintética</span>
          </div>
        </div>

        <div className="relative mt-3">
        <svg className="h-auto w-full touch-none" onPointerMove={handleMove} onPointerLeave={() => setHover(null)} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Comparación de predicción y dato observado sintético">
          {[30, 58, 86, 114].map(y => <line key={y} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" />)}
          <polyline points={observedLine} fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          <polyline points={predictionLine} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {hover !== null && (
            <g pointerEvents="none">
              <line x1={predictionPoints[hover][0]} x2={predictionPoints[hover][0]} y1={padding} y2={height - padding} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={observedPoints[hover][0]} cy={observedPoints[hover][1]} r="3.5" fill="#ffffff" stroke="#475569" strokeWidth="2" />
              <circle cx={predictionPoints[hover][0]} cy={predictionPoints[hover][1]} r="4.5" fill="#ffffff" stroke="#06b6d4" strokeWidth="2.5" />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] shadow-md"
            style={{ left: `${Math.min(80, Math.max(20, (predictionPoints[hover][0] / width) * 100))}%` }}
          >
            <div className="font-bold text-slate-700">{experiment.series[hover].hora}</div>
            <div className="text-cyan-600">Predicción: <b className="font-mono">{prediction[hover].toLocaleString('es-ES')}</b></div>
            <div className="text-slate-500">Observado: <b className="font-mono">{observed[hover].toLocaleString('es-ES')}</b></div>
            <div className="font-mono text-slate-500">Δ {prediction[hover] - observed[hover] >= 0 ? '+' : ''}{(prediction[hover] - observed[hover]).toLocaleString('es-ES')}</div>
          </div>
        )}
        </div>
        <div className="mt-1 flex justify-between px-1 text-[9px] text-slate-400">
          {experiment.series.filter((_, index) => index % 2 === 0).map(point => <span key={point.hora}>{point.hora}</span>)}
        </div>
        <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-cyan-500" />Predicción</span>
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dashed border-slate-600" />Observado</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-2"><span className="text-[9px] uppercase text-slate-500">Error T+4</span><p className="mt-1 font-mono text-sm font-bold text-slate-800">{experiment.errorPctT4}%</p></div>
          <div className="rounded-lg bg-slate-50 p-2"><span className="text-[9px] uppercase text-slate-500">MAPE</span><p className={`mt-1 font-mono text-sm font-bold ${validationGood ? 'text-emerald-600' : 'text-amber-600'}`}>{experiment.mape}%</p></div>
          <div className="rounded-lg bg-slate-50 p-2"><span className="text-[9px] uppercase text-slate-500">Sesgo</span><p className="mt-1 font-mono text-sm font-bold text-slate-800">{experiment.sesgo > 0 ? '+' : ''}{experiment.sesgo}%</p></div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Intervalo de confianza simulado: {experiment.confianzaPct}%.</p>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800"><Activity className="h-3.5 w-3.5" />Proceso operativo simulado</div>
          <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${experiment.playbook.estado === 'PROPUESTO' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>{experiment.playbook.estado}</span>
        </div>
        <p className="mt-1.5 flex items-start gap-1 text-[10px] text-slate-600"><AlertTriangle className="mt-0.5 h-3 w-3 flex-none text-amber-600" />{experiment.playbook.disparador}</p>
        <div className="mt-2 space-y-1.5">
          {experiment.playbook.pasos.map((step, index) => (
            <div key={step} className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1.5 text-[10px] text-slate-600">
              <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-700">{index + 1}</span>
              <span>{step}</span>
              {index < experiment.playbook.pasos.length - 1 && <ArrowRight className="ml-auto h-3 w-3 text-slate-300" />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
