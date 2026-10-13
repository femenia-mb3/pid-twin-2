import React from 'react';
import { ArrowRight, CheckCircle2, Database, GitBranch, SlidersHorizontal, Sparkles } from 'lucide-react';

interface SimulationTransparencyPanelProps {
  destino: string;
  escenario: string;
  datosActuales: {
    visitantes: number;
    saturacion: number;
    alertas: number;
  };
  resultado: {
    visitantes: number;
    saturacion: number;
    alertas: number;
  };
  configuracion: {
    nombre: string;
    version: string;
    reglas: string[];
    fuentes: string[];
  };
  variables: {
    incremento: number;
    clima: string;
    umbral: number;
  };
  recomendacion: string;
}

const formatDelta = (value: number, suffix = '') => {
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? '+' : ''}${value.toLocaleString('es-ES')}${suffix}`;
};

export const SimulationTransparencyPanel: React.FC<SimulationTransparencyPanelProps> = ({
  destino,
  escenario,
  datosActuales,
  resultado,
  configuracion,
  variables,
  recomendacion
}) => {
  const deltaVisitantes = resultado.visitantes - datosActuales.visitantes;
  const deltaSaturacion = Number((resultado.saturacion - datosActuales.saturacion).toFixed(1));
  const deltaAlertas = resultado.alertas - datosActuales.alertas;

  const rows = [
    { label: 'Visitantes', actual: datosActuales.visitantes.toLocaleString('es-ES'), escenario: resultado.visitantes.toLocaleString('es-ES'), delta: formatDelta(deltaVisitantes) },
    { label: 'Saturación', actual: `${datosActuales.saturacion}%`, escenario: `${resultado.saturacion}%`, delta: formatDelta(deltaSaturacion, ' pp') },
    { label: 'Alertas activas', actual: String(datosActuales.alertas), escenario: String(resultado.alertas), delta: formatDelta(deltaAlertas) }
  ];

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Comparativa verificable</h3>
            <p className="mt-0.5 text-[10px] text-slate-500">{destino}: observado frente a escenario calculado</p>
          </div>
          <Database className="h-4 w-4 text-cyan-500" />
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <div className="grid grid-cols-[1.22fr_.88fr_.88fr_.72fr] gap-1 bg-slate-50 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
            <span>Métrica</span><span>Actual</span><span>Escenario</span><span>Delta</span>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1.22fr_.88fr_.88fr_.72fr] gap-1 border-t border-slate-100 px-2 py-2 text-[10px]">
              <span className="font-semibold text-slate-700">{row.label}</span>
              <span className="font-mono text-slate-500">{row.actual}</span>
              <span className="font-mono font-semibold text-slate-800">{row.escenario}</span>
              <span className={`font-mono font-bold ${row.delta.startsWith('+') ? 'text-rose-600' : row.delta.startsWith('-') ? 'text-emerald-600' : 'text-slate-500'}`}>{row.delta}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-800">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Modelo configurable por destino
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-800">{configuracion.nombre} <span className="font-mono text-cyan-700">{configuracion.version}</span></p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-cyan-700 shadow-sm">ACTIVO</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {configuracion.reglas.map((regla) => <span key={regla} className="rounded-md border border-cyan-100 bg-white px-1.5 py-1 text-[9px] text-slate-600">{regla}</span>)}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">Fuentes configuradas: {configuracion.fuentes.join(' · ')}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
          <GitBranch className="h-3.5 w-3.5 text-pink-600" />
          Trazabilidad del escenario
        </div>
        <div className="grid grid-cols-[1fr_18px_1fr_18px_1fr_18px_1fr] items-stretch gap-1 text-[9px]">
          <div className="rounded-lg bg-slate-50 p-2">
            <span className="font-bold text-slate-700">1. Entradas</span>
            <p className="mt-1 text-slate-500">{escenario}</p>
            <p className="text-slate-500">{variables.incremento >= 0 ? '+' : ''}{variables.incremento}% · {variables.clima}</p>
          </div>
          <ArrowRight className="my-auto h-3.5 w-3.5 text-slate-300" />
          <div className="rounded-lg bg-cyan-50 p-2">
            <span className="font-bold text-cyan-800">2. Modelo</span>
            <p className="mt-1 text-cyan-700">Capacidad, flujos y reglas</p>
            <p className="text-cyan-700">Umbral {variables.umbral}%</p>
          </div>
          <ArrowRight className="my-auto h-3.5 w-3.5 text-slate-300" />
          <div className="rounded-lg bg-amber-50 p-2">
            <span className="font-bold text-amber-800">3. Resultado</span>
            <p className="mt-1 text-amber-700">{resultado.saturacion}% saturación</p>
            <p className="text-amber-700">{resultado.alertas} alertas</p>
          </div>
          <ArrowRight className="my-auto h-3.5 w-3.5 text-slate-300" />
          <div className="rounded-lg bg-emerald-50 p-2">
            <span className="flex items-center gap-1 font-bold text-emerald-800"><CheckCircle2 className="h-3 w-3" />4. Acción</span>
            <p className="mt-1 text-emerald-700">{recomendacion}</p>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-400"><Sparkles className="h-3 w-3" />Cada ejecución puede exportarse con su versión de modelo y sus variables de entrada.</p>
      </div>
    </section>
  );
};
