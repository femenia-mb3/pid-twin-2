import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FilePlus2,
  LoaderCircle,
  Play,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { Destino, ZonaDestino } from '../types/ontology';
import {
  ScenarioDefinition,
  ScenarioDraftInput,
  ScenarioExecution,
  ScenarioValidationReport,
  createScenarioDraft,
} from '../types/scenarioStudio';

interface ScenarioEditorModalProps {
  destination: Destino;
  tenantId: string;
  zones: ZonaDestino[];
  onClose: () => void;
  onExecuted: (execution: ScenarioExecution) => void;
}

const statusStyles: Record<ScenarioDefinition['status'], string> = {
  BORRADOR: 'bg-slate-100 text-slate-700 border-slate-300',
  VALIDADO: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  EJECUTADO: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  ARCHIVADO: 'bg-amber-50 text-amber-800 border-amber-200',
};

const typeLabels: Record<ScenarioDefinition['type'], string> = {
  PERSONALIZADO: 'Personalizado',
  EVENTO_CULTURAL: 'Evento cultural',
  CRUCERO_MASIVO: 'Llegada / crucero',
  EPISODIO_METEO: 'Episodio meteorológico',
  CORTE_ACCESO: 'Corte o restricción de acceso',
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) {
    const error = new Error(body.error || 'La operación no se pudo completar.') as Error & { data?: unknown };
    error.data = body;
    throw error;
  }
  return body;
}

function reportFromError(error: unknown): ScenarioValidationReport | null {
  const payload = (error as { data?: { report?: ScenarioValidationReport } } | undefined)?.data;
  return payload?.report || null;
}

export function ScenarioEditorModal({ destination, tenantId, zones, onClose, onExecuted }: ScenarioEditorModalProps) {
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [versions, setVersions] = useState<ScenarioDefinition[]>([]);
  const [draft, setDraft] = useState<ScenarioDraftInput>(() => createScenarioDraft(destination.id, tenantId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [report, setReport] = useState<ScenarioValidationReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'load' | 'save' | 'validate' | 'execute' | 'duplicate' | 'archive' | null>('load');

  const scopedRequest = <T,>(url: string, options: RequestInit = {}) => requestJson<T>(url, {
    ...options,
    headers: { 'X-PID-Tenant': tenantId, ...(options.headers || {}) },
  });

  const selectedScenario = useMemo(
    () => scenarios.find(scenario => scenario.id === editingId) || null,
    [editingId, scenarios],
  );

  const load = async () => {
    setBusy('load');
    try {
      const result = await scopedRequest<{ scenarios: ScenarioDefinition[] }>(`/api/scenarios?destino=${encodeURIComponent(destination.id)}`);
      setScenarios(result.scenarios);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar los escenarios.');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    setDraft(createScenarioDraft(destination.id, tenantId));
    setEditingId(null);
    setReport(null);
    setMessage(null);
    void load();
  }, [destination.id, tenantId]);

  useEffect(() => {
    if (!editingId) {
      setVersions([]);
      return;
    }
    let active = true;
    void scopedRequest<{ versions: ScenarioDefinition[] }>(`/api/scenarios/${encodeURIComponent(editingId)}/versions?destino=${encodeURIComponent(destination.id)}`)
      .then(result => {
        if (active) setVersions(result.versions);
      })
      .catch(() => {
        if (active) setVersions([]);
      });
    return () => { active = false; };
  }, [editingId, destination.id, tenantId]);

  const applyScenarioToDraft = (scenario: ScenarioDefinition) => {
    setEditingId(scenario.id);
    setDraft({
      destinationId: scenario.destinationId,
      tenantId: scenario.tenantId,
      name: scenario.name,
      description: scenario.description,
      type: scenario.type,
      createdBy: scenario.createdBy,
      inputs: JSON.parse(JSON.stringify(scenario.inputs)),
    });
    setReport(null);
    setMessage(scenario.status === 'ARCHIVADO' ? 'El escenario está archivado. Duplíquelo para volver a editarlo.' : null);
  };

  const newDraft = () => {
    setEditingId(null);
    setDraft(createScenarioDraft(destination.id, tenantId));
    setReport(null);
    setMessage(null);
  };

  const patchInput = <K extends keyof ScenarioDraftInput['inputs']>(key: K, value: ScenarioDraftInput['inputs'][K]) => {
    setDraft(current => ({ ...current, inputs: { ...current.inputs, [key]: value } }));
    setReport(null);
  };

  const toggleZone = (zoneId: string) => {
    const included = draft.inputs.zoneIds.includes(zoneId);
    patchInput('zoneIds', included
      ? draft.inputs.zoneIds.filter(id => id !== zoneId)
      : [...draft.inputs.zoneIds, zoneId]);
  };

  const persist = async (): Promise<ScenarioDefinition | null> => {
    if (selectedScenario?.status === 'ARCHIVADO') {
      setMessage('Un escenario archivado no se puede modificar. Duplíquelo para crear una nueva versión operativa.');
      return null;
    }
    setBusy('save');
    setMessage(null);
    try {
      const url = editingId
        ? `/api/scenarios/${encodeURIComponent(editingId)}?destino=${encodeURIComponent(destination.id)}`
        : '/api/scenarios';
      const result = await scopedRequest<{ scenario?: ScenarioDefinition; report: ScenarioValidationReport }>(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      setReport(result.report);
      if (!result.scenario) return null;
      const scenario = result.scenario;
      setEditingId(scenario.id);
      setScenarios(current => [scenario, ...current.filter(item => item.id !== scenario.id)]);
      setMessage(`Borrador guardado · versión ${scenario.version}.`);
      return scenario;
    } catch (error) {
      const validationReport = reportFromError(error);
      if (validationReport) setReport(validationReport);
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el borrador.');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const validate = async () => {
    // La validación siempre parte del contenido actual del formulario, no de
    // una versión anterior seleccionada en la lista.
    const scenario = await persist();
    if (!scenario) return;
    setBusy('validate');
    try {
      const result = await scopedRequest<{ scenario?: ScenarioDefinition; report: ScenarioValidationReport }>(
        `/api/scenarios/${encodeURIComponent(scenario.id)}/validate?destino=${encodeURIComponent(destination.id)}`,
        { method: 'POST' },
      );
      setReport(result.report);
      if (result.scenario) {
        setScenarios(current => [result.scenario!, ...current.filter(item => item.id !== result.scenario!.id)]);
        applyScenarioToDraft(result.scenario);
      }
      setMessage(result.report.valid ? 'Escenario validado y listo para ejecutar.' : 'El escenario contiene errores que deben corregirse.');
    } catch (error) {
      const validationReport = reportFromError(error);
      if (validationReport) setReport(validationReport);
      setMessage(error instanceof Error ? error.message : 'No se pudo validar el escenario.');
    } finally {
      setBusy(null);
    }
  };

  const execute = async (scenarioToExecute?: ScenarioDefinition) => {
    const scenario = scenarioToExecute || selectedScenario;
    if (!scenario) {
      setMessage('Guarde el escenario antes de ejecutarlo.');
      return;
    }
    setBusy('execute');
    try {
      const result = await scopedRequest<{ execution?: ScenarioExecution; report: ScenarioValidationReport }>(
        `/api/scenarios/${encodeURIComponent(scenario.id)}/execute?destino=${encodeURIComponent(destination.id)}`,
        { method: 'POST' },
      );
      setReport(result.report);
      if (!result.execution) return;
      setScenarios(current => [result.execution!.scenario, ...current.filter(item => item.id !== result.execution!.scenario.id)]);
      onExecuted(result.execution);
      setMessage(`Escenario ejecutado · versión ${result.execution.scenario.version}. Los resultados se muestran en BASE / ESCENARIO / DELTA.`);
    } catch (error) {
      const validationReport = reportFromError(error);
      if (validationReport) setReport(validationReport);
      setMessage(error instanceof Error ? error.message : 'No se pudo ejecutar el escenario.');
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async (scenario: ScenarioDefinition) => {
    setBusy('duplicate');
    try {
      const result = await scopedRequest<{ scenario?: ScenarioDefinition }>(
        `/api/scenarios/${encodeURIComponent(scenario.id)}/duplicate?destino=${encodeURIComponent(destination.id)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ createdBy: draft.createdBy }) },
      );
      if (result.scenario) {
        setScenarios(current => [result.scenario!, ...current]);
        applyScenarioToDraft(result.scenario);
        setMessage('Copia creada como nuevo borrador independiente.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo duplicar el escenario.');
    } finally {
      setBusy(null);
    }
  };

  const archive = async (scenario: ScenarioDefinition) => {
    setBusy('archive');
    try {
      const result = await scopedRequest<{ scenario?: ScenarioDefinition }>(
        `/api/scenarios/${encodeURIComponent(scenario.id)}/archive?destino=${encodeURIComponent(destination.id)}`,
        { method: 'POST' },
      );
      if (result.scenario) {
        setScenarios(current => current.filter(item => item.id !== result.scenario!.id));
        newDraft();
        setMessage('Escenario archivado. Permanece disponible como evidencia, pero no puede ejecutarse ni editarse.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo archivar el escenario.');
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy !== null;
  const disabled = selectedScenario?.status === 'ARCHIVADO';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Editor de escenarios">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><Sparkles className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-700">Iteración 2 · autonomía gobernada</p>
              <h2 className="text-lg font-bold text-slate-900">Editor de escenarios sin código</h2>
              <p className="text-xs text-slate-600">{destination.nombre} · los borradores son privados del destino y se conservan en memoria durante esta demo.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900" aria-label="Cerrar editor"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
            <button onClick={newDraft} className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">
              <FilePlus2 className="h-4 w-4" /> Nuevo escenario
            </button>
            <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Escenarios del destino</span><span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">{scenarios.length}</span></div>
            {busy === 'load' ? <div className="flex items-center gap-2 p-3 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Cargando…</div> : scenarios.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs leading-relaxed text-slate-500">Aún no hay escenarios propios. Crea uno a partir de las condiciones reales de tu destino.</p> : (
              <div className="space-y-2">
                {scenarios.map(scenario => (
                  <div key={scenario.id} className={`rounded-xl border p-2.5 ${editingId === scenario.id ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}>
                    <button className="w-full text-left" onClick={() => applyScenarioToDraft(scenario)}>
                      <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-xs font-bold text-slate-800">{scenario.name}</span><span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${statusStyles[scenario.status]}`}>{scenario.status}</span></div>
                      <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">v{scenario.version} · {typeLabels[scenario.type]}</p>
                    </button>
                    <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2">
                      <button onClick={() => void execute(scenario)} disabled={isBusy || scenario.status === 'ARCHIVADO'} className="flex-1 rounded border border-cyan-200 bg-cyan-50 px-1.5 py-1 text-[10px] font-bold text-cyan-800 disabled:opacity-40"><Play className="mr-1 inline h-3 w-3" />Ejecutar</button>
                      <button onClick={() => void duplicate(scenario)} disabled={isBusy} className="rounded border border-slate-200 px-1.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40" title="Duplicar"><Copy className="h-3.5 w-3.5" /></button>
                      <button onClick={() => void archive(scenario)} disabled={isBusy || scenario.status === 'ARCHIVADO'} className="rounded border border-slate-200 px-1.5 py-1 text-slate-600 hover:bg-amber-50 disabled:opacity-40" title="Archivar"><Archive className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="min-h-0 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-bold text-slate-900">{editingId ? `Editar versión ${selectedScenario?.version ?? 1}` : 'Definir nuevo escenario'}</h3><p className="text-xs text-slate-500">Los campos marcados condicionan el motor, el mapa de calor y los indicadores.</p></div>
              {selectedScenario && <div className="text-right"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusStyles[selectedScenario.status]}`}>{selectedScenario.status} · v{selectedScenario.version}</span><p className="mt-1 text-[10px] text-slate-500">{versions.length} snapshot(s) de versión</p></div>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">Nombre del escenario<input disabled={disabled} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Ej. Festival gastronómico centro histórico" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100" /></label>
              <label className="block text-xs font-semibold text-slate-700">Autor / responsable<input disabled={disabled} value={draft.createdBy} onChange={event => setDraft(current => ({ ...current, createdBy: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100" /></label>
              <label className="block text-xs font-semibold text-slate-700">Tipo<select disabled={disabled} value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value as ScenarioDefinition['type'] }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-slate-700">Evento o hipótesis (opcional)<input disabled={disabled} value={draft.inputs.eventLabel || ''} onChange={event => patchInput('eventLabel', event.target.value)} placeholder="Nombre de evento o intervención" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100" /></label>
              <label className="block md:col-span-2 text-xs font-semibold text-slate-700">Descripción<textarea disabled={disabled} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="Explica la hipótesis operativa que se quiere comparar con la situación base…" rows={2} className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100" /></label>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between"><div><h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Ámbito territorial</h4><p className="mt-0.5 text-[11px] text-slate-500">Selecciona las zonas sobre las que se concentra o redistribuye el efecto.</p></div><span className="text-xs font-bold text-red-700">{draft.inputs.zoneIds.length} seleccionada(s)</span></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{zones.map(zone => <label key={zone.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${draft.inputs.zoneIds.includes(zone.id) ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}><input disabled={disabled} type="checkbox" checked={draft.inputs.zoneIds.includes(zone.id)} onChange={() => toggleZone(zone.id)} className="mt-0.5 accent-red-600" /><span><span className="block text-xs font-semibold text-slate-800">{zone.nombre}</span><span className="text-[10px] text-slate-500">Aforo {zone.aforoMaximo.toLocaleString('es-ES')} · {zone.tipoZona.replaceAll('_', ' ')}</span></span></label>)}</div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="block text-xs font-semibold text-slate-700">Hora de simulación<span className="mt-1 flex items-center justify-between text-[11px] font-normal text-slate-500"><input disabled={disabled} type="range" min="0" max="23" value={draft.inputs.hour} onChange={event => patchInput('hour', Number(event.target.value))} className="mr-2 flex-1 accent-red-600" /><b className="font-mono text-slate-800">{String(draft.inputs.hour).padStart(2, '0')}:00</b></span></label>
              <label className="block text-xs font-semibold text-slate-700">Clima<select disabled={disabled} value={draft.inputs.climate} onChange={event => patchInput('climate', event.target.value as ScenarioDraftInput['inputs']['climate'])} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100"><option value="DESPEJADO">Despejado</option><option value="LLUVIA">Lluvia</option><option value="CALOR_EXTREMO">Calor extremo</option></select></label>
              <label className="block text-xs font-semibold text-slate-700">Distribución espacial<select disabled={disabled} value={draft.inputs.spatialDistribution} onChange={event => patchInput('spatialDistribution', event.target.value as ScenarioDraftInput['inputs']['spatialDistribution'])} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100"><option value="UNIFORME">Uniforme</option><option value="CONCENTRADA">Concentrada</option><option value="REDISTRIBUIDA">Redistribuida</option></select></label>
              <RangeField disabled={disabled} label="Variación de visitantes" value={draft.inputs.visitorVariationPct} min={-50} max={100} suffix="%" onChange={value => patchInput('visitorVariationPct', value)} />
              <RangeField disabled={disabled} label="Capacidad operativa" value={draft.inputs.operationalCapacityPct} min={50} max={120} suffix="%" onChange={value => patchInput('operationalCapacityPct', value)} />
              <RangeField disabled={disabled} label="Umbral de alerta" value={draft.inputs.alertThresholdPct} min={60} max={100} suffix="%" onChange={value => patchInput('alertThresholdPct', value)} />
              <RangeField disabled={disabled} label="Intensidad" value={draft.inputs.intensity} min={0} max={1.5} step={0.1} suffix="x" onChange={value => patchInput('intensity', value)} />
              <label className="block text-xs font-semibold text-slate-700">Movilidad<select disabled={disabled} value={draft.inputs.mobilityMode} onChange={event => patchInput('mobilityMode', event.target.value as ScenarioDraftInput['inputs']['mobilityMode'])} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100"><option value="NORMAL">Normal</option><option value="RESTRINGIDA">Restringida</option><option value="REFORZADA">Reforzada</option></select></label>
              <label className="block text-xs font-semibold text-slate-700">Notas de supuestos<textarea disabled={disabled} value={draft.inputs.notes || ''} onChange={event => patchInput('notes', event.target.value)} rows={2} className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 disabled:bg-slate-100" /></label>
            </div>

            {report && <ValidationReport report={report} />}
            {message && <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">{message}</div>}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
              <span className="text-[10px] text-slate-500">Demo en memoria · piloto persistente: versiones, validaciones y RLS se guardarán en PostGIS.</span>
              <div className="flex flex-wrap gap-2">
                <button disabled={isBusy || disabled} onClick={() => void persist()} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Guardar borrador</button>
                <button disabled={isBusy || disabled} onClick={() => void validate()} className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"><ClipboardCheck className="h-3.5 w-3.5" /> Validar</button>
                <button disabled={isBusy || disabled || !editingId} onClick={() => void execute()} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40">{busy === 'execute' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Ejecutar en gemelo</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RangeField({ label, value, min, max, step = 1, suffix, disabled, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="block text-xs font-semibold text-slate-700">{label}<span className="mt-1 flex items-center gap-2"><input disabled={disabled} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} className="flex-1 accent-red-600" /><b className="w-10 text-right font-mono text-[11px] text-slate-800">{value}{suffix}</b></span></label>;
}

function ValidationReport({ report }: { report: ScenarioValidationReport }) {
  return <div className={`mt-4 rounded-xl border p-3 text-xs ${report.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
    <div className="flex items-center gap-2 font-bold">{report.valid ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}{report.valid ? 'Contrato válido para el motor' : 'Revisa los campos marcados'}</div>
    {report.errors.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{report.errors.map(error => <li key={`${error.code}-${error.path}`}><b>{error.code}</b> · {error.message}</li>)}</ul>}
    {report.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">{report.warnings.map(warning => <li key={`${warning.code}-${warning.path}`}><b>{warning.code}</b> · {warning.message}</li>)}</ul>}
  </div>;
}
