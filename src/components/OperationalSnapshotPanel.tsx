import React from 'react';
import { Accessibility, ArrowRight, Bus, Database, GraduationCap, HeartPulse, SlidersHorizontal, TrendingUp, Users, Volume2, Wind, Zap } from 'lucide-react';

interface OperationalSnapshotPanelProps {
  destination: string;
  scenario: string;
  isBaseline: boolean;
  current: { visitors: number; saturation: number; alerts: number };
  simulated: { visitors: number; saturation: number; alerts: number; co2: number; noise: number; electricity: number; accessibility: number; healthMin: number; busMin: number; schoolMin: number };
  model: { name: string; version: string; rules: string[]; sources: string[] };
  activeRule: string | null;
  onRuleSelect: (rule: string) => void;
  requestedRules?: string[];
  onRequestedRuleSelect?: () => void;
  // Simulaciones creadas por el usuario: se listan junto a las reglas del modelo.
  userSimulations?: { id: string; name: string }[];
  activeSimulationId?: string | null;
  onUserSimulationSelect?: (id: string) => void;
  recommendation: string;
}

// es-ES no agrupa los números de 4 cifras por defecto (1234); 'always' fuerza el punto de millares (1.234).
const formatoDelta = new Intl.NumberFormat('es-ES', { useGrouping: 'always' as unknown as boolean });
const deltaText = (value: number, suffix = '') => `${value > 0 ? '+' : ''}${formatoDelta.format(value)}${suffix}`;

export const OperationalSnapshotPanel: React.FC<OperationalSnapshotPanelProps> = ({
  destination,
  scenario,
  isBaseline,
  current,
  simulated,
  model,
  activeRule,
  onRuleSelect,
  requestedRules = [],
  onRequestedRuleSelect,
  userSimulations = [],
  activeSimulationId = null,
  onUserSimulationSelect,
  recommendation
}) => {
  const visitorDelta = simulated.visitors - current.visitors;
  const saturationDelta = Number((simulated.saturation - current.saturation).toFixed(1));
  const alertDelta = simulated.alerts - current.alerts;

  const metrics = [
    { label: 'Visitantes Totales', value: simulated.visitors.toLocaleString('es-ES'), detail: deltaText(visitorDelta), icon: Users, color: 'text-cyan-400' },
    { label: 'Saturación Global', value: `${simulated.saturation}%`, detail: `${simulated.alerts} alerta(s)`, icon: TrendingUp, color: 'text-red-400' },
    { label: 'Emisiones CO₂', value: `${simulated.co2}`, detail: 'kg/h', icon: Wind, color: 'text-emerald-400' },
    { label: 'Presión Sonora', value: `${simulated.noise}`, detail: 'dBA', icon: Volume2, color: 'text-amber-400' },
    { label: 'Consumo eléctrico', value: simulated.electricity.toLocaleString('es-ES'), detail: 'MWh/día', icon: Zap, color: 'text-yellow-400' },
    { label: 'Índice de accesibilidad', value: `${simulated.accessibility}`, detail: 'sobre 100', icon: Accessibility, color: 'text-lime-400' },
    { label: 'Tiempo a centro de salud', value: `${simulated.healthMin}`, detail: 'min a pie', icon: HeartPulse, color: 'text-rose-400' },
    { label: 'Tiempo a parada de bus', value: `${simulated.busMin}`, detail: 'min a pie', icon: Bus, color: 'text-sky-400' },
    { label: 'Tiempo a escuela', value: `${simulated.schoolMin}`, detail: 'min a pie', icon: GraduationCap, color: 'text-violet-400' }
  ];

  // En el escenario base no hay comparación: se vacían las columnas Escenario y Δ.
  const sinBase = (valor: string) => (isBaseline ? '' : valor);

  const rows = [
    { label: 'Visitantes', current: current.visitors.toLocaleString('es-ES'), scenario: sinBase(simulated.visitors.toLocaleString('es-ES')), delta: sinBase(deltaText(visitorDelta)) },
    { label: 'Saturación', current: `${current.saturation}%`, scenario: sinBase(`${simulated.saturation}%`), delta: sinBase(deltaText(saturationDelta, ' pp')) },
    { label: 'Alertas', current: String(current.alerts), scenario: sinBase(String(simulated.alerts)), delta: sinBase(deltaText(alertDelta)) }
  ];

  return (
    <aside className="flex h-full flex-col gap-2.5 overflow-y-auto p-3 text-xs">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operativa del destino</p>
          <h2 className="mt-0.5 truncate text-sm font-bold text-slate-800">{destination}</h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">PID ACTIVO</span>
      </header>

      <section className="grid grid-cols-2 gap-2">
        {metrics.map(({ label, value, detail, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500"><Icon className={`h-3.5 w-3.5 ${color}`} />{label}</div>
            <div className="mt-1 font-mono text-base font-bold text-slate-800">{value}</div>
            <div className={`text-[9px] font-semibold ${label === 'Visitantes Totales' && visitorDelta > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{detail}</div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Resultado de simulación</span>
          <Database className="h-3.5 w-3.5 text-cyan-500" />
        </div>
        <p className="mb-2 truncate text-[9px] text-slate-500">{scenario}</p>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <div className="grid grid-cols-[1.2fr_.72fr_.82fr_.65fr] gap-1 bg-slate-50 px-1.5 py-1 text-[8px] font-bold uppercase text-slate-500"><span>Métrica</span><span>Actual</span><span>Escenario</span><span>Δ</span></div>
          {rows.map((row) => <div key={row.label} className="grid grid-cols-[1.2fr_.72fr_.82fr_.65fr] gap-1 border-t border-slate-100 px-1.5 py-1.5 text-[9px]"><span className="font-semibold text-slate-700">{row.label}</span><span className="font-mono text-slate-500">{row.current}</span><span className="font-mono font-semibold text-slate-800">{row.scenario}</span><span className={`font-mono font-bold ${row.delta.startsWith('+') ? 'text-rose-600' : row.delta.startsWith('-') ? 'text-emerald-600' : 'text-slate-500'}`}>{row.delta}</span></div>)}
        </div>
      </section>

      <section className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-2.5">
        <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-800"><SlidersHorizontal className="h-3.5 w-3.5" />Modelo por destino</span><span className="font-mono text-[9px] font-bold text-cyan-700">{model.version}</span></div>
        <p className="mt-1 truncate text-[10px] font-semibold text-slate-800">{model.name}</p>
        <p className="mt-1 text-[8px] leading-relaxed text-slate-500">Seleccione una vista para configurar el mapa, las capas y el escenario.</p>
        <div className="mt-1.5 grid gap-1">
          {model.rules.map((rule) => {
            const isActive = activeRule === rule;
            return (
              <button
                key={rule}
                type="button"
                aria-pressed={isActive}
                onClick={() => onRuleSelect(rule)}
                className="flex items-center justify-between rounded-md border border-cyan-100 bg-white px-2 py-1.5 text-left text-[9px] font-semibold text-slate-600 transition-all hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
              >
                <span>{rule}</span>
                {isActive ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Activo
                  </span>
                ) : (
                  <ArrowRight className="h-3 w-3 text-cyan-500" />
                )}
              </button>
            );
          })}
          {userSimulations.map((sim) => {
            const isActive = activeSimulationId === sim.id;
            return (
              <button
                key={sim.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onUserSimulationSelect?.(sim.id)}
                className="flex items-center justify-between gap-2 rounded-md border border-cyan-100 bg-white px-2 py-1.5 text-left text-[9px] font-semibold text-slate-600 transition-all hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
              >
                <span className="truncate">{sim.name}</span>
                {isActive ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Activo
                  </span>
                ) : (
                  <ArrowRight className="h-3 w-3 shrink-0 text-cyan-500" />
                )}
              </button>
            );
          })}
          {requestedRules.map((rule) => (
            <button
              key={rule}
              type="button"
              onClick={() => onRequestedRuleSelect?.()}
              title="Abrir Interoperabilidad PID"
              className="flex items-center justify-between rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[9px] font-semibold text-slate-400 transition-colors hover:border-amber-300 hover:bg-amber-50/50 hover:text-slate-600"
            >
              <span>{rule}</span>
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-700">Solicitado</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[8px] leading-relaxed text-slate-500">Fuentes: {model.sources.join(' · ')}</p>
      </section>

      <section className="rounded-xl border border-pink-100 bg-pink-50/45 p-2.5">
        <div className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-pink-800"><ArrowRight className="h-3.5 w-3.5" />Trazabilidad del escenario</div>
        <div className="grid grid-cols-4 gap-1 text-center text-[8px]">
          <div className="rounded-md bg-white/80 p-1.5"><b className="block text-slate-700">1. Datos</b><span className="text-slate-500">Actuales</span></div>
          <div className="rounded-md bg-cyan-50 p-1.5"><b className="block text-cyan-800">2. Modelo</b><span className="text-cyan-700">Reglas</span></div>
          <div className="rounded-md bg-amber-50 p-1.5"><b className="block text-amber-800">3. Resultado</b><span className="text-amber-700">Presión</span></div>
          <div className="rounded-md bg-emerald-50 p-1.5"><b className="block text-emerald-800">4. Acción</b><span className="text-emerald-700">Mitigar</span></div>
        </div>
        <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-slate-600"><b>Recomendación:</b> {recommendation}</p>
      </section>
    </aside>
  );
};
