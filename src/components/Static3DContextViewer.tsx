import { Building2, Compass, Route, Radio, TriangleAlert } from 'lucide-react';

interface Static3DContextViewerProps {
  scenario: string;
  saturation: number;
  activeAlerts: number;
  level?: 3 | 4;
}

/**
 * Representación estable del contenido del Nivel 3 para navegadores que no
 * disponen de un contexto WebGL operativo. Conserva la semántica del gemelo:
 * trama urbana, edificios, zonas de presión, rutas y sensores.
 */
export function Static3DContextViewer({ scenario, saturation, activeAlerts, level = 3 }: Static3DContextViewerProps) {
  const severity = saturation >= 90 ? 'Riesgo alto' : saturation >= 75 ? 'Precaución' : 'Rango operativo';
  const severityClass = saturation >= 90
    ? 'bg-rose-100 text-rose-700 border-rose-200'
    : saturation >= 75
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eef7f9]">
      <img
        src="/visor-3d-contextual-compatibilidad.png"
        alt="Entorno urbano isométrico con edificios, volúmenes de aforo, sensores y rutas de redistribución"
        className="h-full w-full object-cover"
      />

      <section className="absolute left-4 top-4 z-10 max-w-sm rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <h2 className="text-xs font-bold text-slate-800">Nivel {level} · Vista 3D contextual</h2>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {level === 4
            ? 'Entorno urbano con edificios extruidos y lectura temporal simulada del mismo motor de contexto.'
            : 'Entorno urbano con edificios extruidos, zonas de aforo, rutas de redistribución y sensores IoT del mismo motor de simulación.'}
        </p>
        <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
          <Compass className="h-3.5 w-3.5 text-cyan-600" />
          <span>Modo compatible · sin aceleración WebGL</span>
        </div>
      </section>

      <section className="absolute left-4 bottom-6 z-10 w-64 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-pink-700">
          <Building2 className="h-3.5 w-3.5" />
          <span>Lectura operativa</span>
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-snug text-slate-700">{scenario}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
          <span className="text-slate-500">Saturación simulada</span>
          <span className={`rounded border px-2 py-0.5 font-bold ${severityClass}`}>{saturation.toFixed(1)}% · {severity}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
          <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
          <span>{activeAlerts} alerta(s) activa(s)</span>
        </div>
      </section>

      <section className="absolute bottom-6 right-5 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 text-[11px] text-slate-600 shadow-xl backdrop-blur">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Leyenda 3D</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-slate-400 bg-slate-300" />Edificación urbana</div>
        <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-500" />Aforo normal</div>
        <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-500" />Precaución</div>
        <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-rose-500" />Saturación</div>
        <div className="mt-1 flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-cyan-600" />Sensor IoT</div>
        <div className="mt-1 flex items-center gap-2"><Route className="h-3.5 w-3.5 text-sky-600" />Ruta de redistribución</div>
      </section>
    </div>
  );
}
