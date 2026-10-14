import { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectorConfigurationModal } from './ConnectorConfigurationModal';
import { pidModuleLabel } from '../services/interoperabilityCatalogService';
import {
  Plus,
  ArrowRight,
  CheckCircle2,
  CloudCog,
  ExternalLink,
  FileText,
  GitBranch,
  Link2,
  LoaderCircle,
  Map,
  Network,
  Play,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  X
} from 'lucide-react';
import {
  InteroperabilityArchitecture,
  InteroperabilityConnector,
  ModelInstantiationPreview,
  ModelVariableDefinition,
  OwnModelResult,
  ReusableModelTemplate
} from '../types/interoperability';

interface InteroperabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDestinationId: string;
}

interface ArchitectureResponse { architecture: InteroperabilityArchitecture }
interface ConnectorsResponse { destinationId: string; tenantId: string; total: number; connectors: InteroperabilityConnector[] }
interface ModelsResponse { destinationId: string; total: number; models: ReusableModelTemplate[] }

const DESTINATIONS = [
  { id: 'malaga', label: 'Málaga' },
  { id: 'palma', label: 'Palma' }
];

const defaultsFor = (model: ReusableModelTemplate): Record<string, string | number | boolean> =>
  Object.fromEntries(model.variables.map(variable => [variable.id, variable.defaultValue]));

const variableType = (variable: ModelVariableDefinition): 'number' | 'string' | 'boolean' =>
  variable.valueType || (typeof variable.defaultValue as 'number' | 'string' | 'boolean');

export const InteroperabilityModal = ({ isOpen, onClose, initialDestinationId }: InteroperabilityModalProps) => {
  const [architecture, setArchitecture] = useState<InteroperabilityArchitecture | null>(null);
  const [connectors, setConnectors] = useState<InteroperabilityConnector[]>([]);
  const [models, setModels] = useState<ReusableModelTemplate[]>([]);
  const [destinationId, setDestinationId] = useState(initialDestinationId);
  const [activeTab, setActiveTab] = useState<'architecture' | 'connectors' | 'models'>('architecture');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>([]);
  const [parameters, setParameters] = useState<Record<string, string | number | boolean>>({});
  const [showOwnModelForm, setShowOwnModelForm] = useState(false);
  const [ownTitle, setOwnTitle] = useState('');
  const [ownDomain, setOwnDomain] = useState('');
  const [ownSummary, setOwnSummary] = useState('');
  const [ownVariableId, setOwnVariableId] = useState('factorLocal');
  const [ownVariableLabel, setOwnVariableLabel] = useState('Factor local');
  const [ownVariableDefault, setOwnVariableDefault] = useState(1);
  const [ownModelResult, setOwnModelResult] = useState<OwnModelResult | null>(null);
  const [isCreatingOwnModel, setIsCreatingOwnModel] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [instantiation, setInstantiation] = useState<ModelInstantiationPreview | null>(null);
  const [isInstantiating, setIsInstantiating] = useState(false);
  const [isNewConnectorModalOpen, setIsNewConnectorModalOpen] = useState(false);
  const requestSequence = useRef(0);

  const selectModel = (model: ReusableModelTemplate, availableConnectors = connectors) => {
    setSelectedModelId(model.id);
    setParameters(defaultsFor(model));
    setSelectedConnectorIds(
      availableConnectors
        .filter(connector => model.requiredLanes.includes(connector.lane) && connector.status !== 'PENDIENTE_AUTORIZACION')
        .map(connector => connector.id)
    );
    setInstantiation(null);
  };

  const load = (targetDestinationId: string) => {
    const requestId = ++requestSequence.current;
    setStatus('loading');
    setError('');
    setInstantiation(null);
    return Promise.all([
      fetch('/api/interoperability/architecture').then(response => {
        if (!response.ok) throw new Error('No se pudo cargar la arquitectura de interoperabilidad.');
        return response.json() as Promise<ArchitectureResponse>;
      }),
      fetch(`/api/interoperability/connectors?destino=${encodeURIComponent(targetDestinationId)}`).then(response => {
        if (!response.ok) throw new Error('No se pudieron cargar los conectores del destino.');
        return response.json() as Promise<ConnectorsResponse>;
      }),
      fetch(`/api/models/reusable?destino=${encodeURIComponent(targetDestinationId)}`).then(response => {
        if (!response.ok) throw new Error('No se pudo cargar el catálogo de modelos reutilizables.');
        return response.json() as Promise<ModelsResponse>;
      })
    ]).then(([architectureResponse, connectorsResponse, modelsResponse]) => {
      if (requestId !== requestSequence.current) return;
      setArchitecture(architectureResponse.architecture);
      setConnectors(connectorsResponse.connectors);
      setModels(modelsResponse.models);
      const defaultModel = modelsResponse.models[0];
      if (defaultModel) selectModel(defaultModel, connectorsResponse.connectors);
      setStatus('ready');
    }).catch((reason: Error) => {
      if (requestId !== requestSequence.current) return;
      setError(reason.message);
      setStatus('error');
    });
  };

  useEffect(() => {
    if (!isOpen) {
      requestSequence.current += 1;
      return;
    }
    setDestinationId(initialDestinationId);
    void load(initialDestinationId);
  }, [isOpen, initialDestinationId]);

  const selectedModel = useMemo(
    () => models.find(model => model.id === selectedModelId) || models[0] || null,
    [models, selectedModelId]
  );

  const changeDestination = (nextDestinationId: string) => {
    setDestinationId(nextDestinationId);
    setSelectedModelId(null);
    setSelectedConnectorIds([]);
    setParameters({});
    setOwnModelResult(null);
    void load(nextDestinationId);
  };

  const instantiate = async () => {
    if (!selectedModel) return;
    setIsInstantiating(true);
    setInstantiation(null);
    try {
      const response = await fetch(`/api/models/reusable/${encodeURIComponent(selectedModel.id)}/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId,
          connectorIds: selectedConnectorIds,
          parameters
        })
      });
      const result = await response.json() as ModelInstantiationPreview;
      setInstantiation(result);
      if (!response.ok && !result.errors?.length) setError('No fue posible validar la instancia del modelo.');
    } catch {
      setError('No fue posible validar la instancia del modelo.');
    } finally {
      setIsInstantiating(false);
    }
  };

  const createOwnModel = async () => {
    setIsCreatingOwnModel(true);
    setOwnModelResult(null);
    try {
      const response = await fetch('/api/models/own', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId,
          title: ownTitle,
          domain: ownDomain,
          summary: ownSummary,
          requiredLanes: ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'],
          sourceRequirements: ['Fuente ontológica o activos normalizados', 'Fuente histórica o contextual del destino'],
          variables: [{ id: ownVariableId, label: ownVariableLabel, defaultValue: ownVariableDefault, valueType: 'number', min: 0, max: 10, required: true }],
          ruleSummary: 'La variable local ajusta el comportamiento de la plantilla en el destino propietario.',
          privacyRule: 'El borrador no puede contener datos personales; las fuentes se vinculan y clasifican antes de activarse.'
        })
      });
      const result = await response.json() as OwnModelResult;
      setOwnModelResult(result);
      if (result.valid && result.model) {
        setModels(previous => [...previous, result.model!]);
        selectModel(result.model);
        setShowOwnModelForm(false);
        setOwnTitle('');
        setOwnDomain('');
        setOwnSummary('');
      }
    } catch {
      setOwnModelResult({ persistence: 'REJECTED', valid: false, errors: ['No se pudo crear el borrador de modelo propio.'] });
    } finally {
      setIsCreatingOwnModel(false);
    }
  };

  const publishOwnModel = async () => {
    if (!selectedModel) return;
    try {
      const response = await fetch(`/api/models/${encodeURIComponent(selectedModel.id)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationId })
      });
      const result = await response.json() as OwnModelResult;
      setOwnModelResult(result);
      if (result.valid && result.model) {
        setModels(previous => previous.map(model => model.id === result.model!.id ? result.model! : model));
        selectModel(result.model);
      }
    } catch {
      setOwnModelResult({ persistence: 'REJECTED', valid: false, errors: ['No se pudo publicar el modelo propio.'] });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex gap-3">
            <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><PlugZap className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-700">PID · SEGITTUR</span>
                <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-700">Módulo transversal</span>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Contratos demo</span>
              </div>
              <h2 className="mt-1 text-base font-bold text-slate-800">Interoperabilidad PID y Modelos Reutilizables</h2>
              <p className="mt-0.5 text-xs text-slate-500">Fuentes trazables por destino, normalización por carriles y plantillas reutilizables sin replicar el motor común.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar interoperabilidad PID"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold">
              {[
                ['architecture', 'Arquitectura', Network],
                ['connectors', 'Conectores', CloudCog],
                ['models', 'Catálogo de modelos', GitBranch]
              ].map(([id, label, Icon]) => (
                <button
                  key={id as string}
                  onClick={() => setActiveTab(id as 'architecture' | 'connectors' | 'models')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${activeTab === id ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label as string}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              Destino de trabajo
              <select value={destinationId} onChange={(event) => changeDestination(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-cyan-500">
                {DESTINATIONS.map(destination => <option key={destination.id} value={destination.id}>{destination.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        <main className="p-6">
          {status === 'loading' && <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-medium text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin text-cyan-600" /> Cargando contratos, carriles y evidencia…</div>}
          {status === 'error' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><b>No se pudo consultar el módulo:</b> {error}</div>}

          {status === 'ready' && architecture && (
            <div className="space-y-5">
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span><b>Transparencia:</b> estos son contratos y catálogos del MVP. Los estados no prueban una conexión externa activa; cada integración real necesita autorización, credenciales seguras, finalidad, calidad y política de privacidad.</span>
              </div>

              {activeTab === 'architecture' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600"><Network className="h-4 w-4 text-cyan-600" /> Flujo del módulo transversal</div>
                    <div className="grid gap-2 md:grid-cols-6">
                      {architecture.flow.map((step, index) => (
                        <div key={step} className="flex items-center gap-2 md:flex-col md:items-stretch">
                          <div className={`min-h-[74px] flex-1 rounded-lg border p-3 text-[11px] font-semibold leading-relaxed ${index === 1 ? 'border-cyan-200 bg-cyan-50 text-cyan-950' : index === 3 ? 'border-pink-200 bg-pink-50 text-pink-950' : 'border-slate-200 bg-white text-slate-700'}`}>{step}</div>
                          {index < architecture.flow.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 md:mx-auto md:rotate-0" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {architecture.lanes.map(lane => (
                      <article key={lane.id} className={`rounded-xl border p-4 ${lane.id === 'ONTOLOGICO' ? 'border-cyan-200 bg-cyan-50/40' : 'border-violet-200 bg-violet-50/40'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div><h3 className="font-bold text-slate-800">{lane.title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">{lane.subtitle}</p></div>
                          <span className="rounded bg-white px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm">{lane.id.replaceAll('_', ' ')}</span>
                        </div>
                        <div className="mt-3 grid gap-3 text-[11px] text-slate-600 sm:grid-cols-2">
                          <div><span className="font-bold uppercase tracking-wider text-slate-400">Fuentes</span><ul className="mt-1 space-y-1">{lane.sources.map(source => <li key={source}>• {source}</li>)}</ul></div>
                          <div><span className="font-bold uppercase tracking-wider text-slate-400">Tratamiento</span><ul className="mt-1 space-y-1">{lane.processing.map(step => <li key={step}>• {step}</li>)}</ul></div>
                        </div>
                        <div className="mt-3 rounded-lg border border-white bg-white/80 p-2 text-[11px] text-slate-700"><b>Salida:</b> {lane.output}</div>
                        <a href={lane.evidence.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"><Link2 className="h-3 w-3" /> Evidencia del carril</a>
                      </article>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700"><Map className="mr-2 inline h-4 w-4 text-pink-600" />Relación declarativa con servicios PID</div>
                    <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
                      {architecture.pidServices.map(service => (
                        <article key={service.id} className="p-3.5">
                          <div className="flex items-center justify-between gap-2"><span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white">{pidModuleLabel(service.id)}</span><a href={service.evidence.url} target="_blank" rel="noreferrer" className="text-cyan-700 hover:text-cyan-900" title="Abrir evidencia"><ExternalLink className="h-3.5 w-3.5" /></a></div>
                          <p className="mt-2 text-xs font-semibold text-slate-800">{service.role}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{service.dataTreatment}</p>
                          <p className="mt-2 text-[10px] leading-relaxed text-amber-800"><b>Privacidad:</b> {service.privacyRule}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'connectors' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><CloudCog className="h-4 w-4 text-cyan-600" /> {connectors.length} contratos de fuente para {DESTINATIONS.find(destination => destination.id === destinationId)?.label}</div>
  <button 
    onClick={() => setIsNewConnectorModalOpen(true)}
    className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-800 flex items-center gap-1.5 shadow-sm"
  >
    <Plus className="h-3.5 w-3.5" /> Nuevo conector
  </button>
</div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {connectors.map(connector => (
                      <article key={connector.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div><span className={`rounded px-2 py-1 text-[10px] font-bold ${connector.lane === 'ONTOLOGICO' ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>{connector.lane.replaceAll('_', ' ')}</span><h3 className="mt-2 text-sm font-bold text-slate-800">{connector.title}</h3></div>
                          <span className={`rounded px-2 py-1 text-[10px] font-bold ${connector.status === 'PILOTO_VALIDADO' ? 'bg-emerald-50 text-emerald-700' : connector.status === 'PENDIENTE_AUTORIZACION' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{connector.status.replaceAll('_', ' ')}</span>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{connector.purpose}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                          <div className="rounded bg-slate-50 p-2"><span className="block font-bold uppercase text-slate-400">Entrada</span><span className="text-slate-700">{connector.connectorType} · {connector.inputFormat}</span></div>
                          <div className="rounded bg-slate-50 p-2"><span className="block font-bold uppercase text-slate-400">Actualización</span><span className="text-slate-700">{connector.updateFrequency}</span></div>
                          <div className="col-span-2 rounded bg-slate-50 p-2"><span className="block font-bold uppercase text-slate-400">Calidad y privacidad</span><span className="text-slate-700">{connector.qualityRule} · <b>{connector.privacyLevel.replaceAll('_', ' ')}</b></span></div>
                        </div>
                        <div className="mt-3 text-[11px] text-slate-600"><b>Normalización:</b> {connector.normalizationSteps.join(' → ')}</div>
                        <a href={connector.evidence.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"><Link2 className="h-3 w-3" /> {connector.evidence.label}</a>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'models' && (
                <div className="grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><GitBranch className="h-4 w-4 text-pink-600" /> Catálogo de plantillas reutilizables</div><div className="flex items-center gap-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{models.length} modelos</span><button onClick={() => { setShowOwnModelForm(value => !value); setOwnModelResult(null); }} className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-violet-700">Crear modelo propio</button></div></div>

                    {showOwnModelForm && (
                      <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-violet-900"><FileText className="h-4 w-4" /> Borrador propio de {DESTINATIONS.find(destination => destination.id === destinationId)?.label}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-violet-900">El borrador queda aislado en el destino propietario. Solo después de revisar variables, fuentes, evidencia y privacidad puede publicarse como plantilla reutilizable.</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="text-[11px] font-semibold text-slate-700">Título<input value={ownTitle} onChange={event => setOwnTitle(event.target.value)} placeholder="Ej. Turismo astronómico" className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs" /></label>
                          <label className="text-[11px] font-semibold text-slate-700">Dominio<input value={ownDomain} onChange={event => setOwnDomain(event.target.value)} placeholder="Ej. Experiencias singulares" className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs" /></label>
                          <label className="sm:col-span-2 text-[11px] font-semibold text-slate-700">Resumen<textarea value={ownSummary} onChange={event => setOwnSummary(event.target.value)} placeholder="Qué problema resuelve y qué simula" className="mt-1 min-h-16 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs" /></label>
                          <label className="text-[11px] font-semibold text-slate-700">ID de variable<input value={ownVariableId} onChange={event => setOwnVariableId(event.target.value)} className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs font-mono" /></label>
                          <label className="text-[11px] font-semibold text-slate-700">Etiqueta de variable<input value={ownVariableLabel} onChange={event => setOwnVariableLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs" /></label>
                          <label className="text-[11px] font-semibold text-slate-700">Valor por defecto<input type="number" min="0" max="10" step="0.1" value={ownVariableDefault} onChange={event => setOwnVariableDefault(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs" /></label>
                        </div>
                        <button disabled={isCreatingOwnModel} onClick={() => void createOwnModel()} className="mt-3 flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" /> {isCreatingOwnModel ? 'Validando…' : 'Guardar borrador validado'}</button>
                      </div>
                    )}

                    {ownModelResult && <div className={`rounded-lg border p-3 text-[11px] ${ownModelResult.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>{ownModelResult.valid ? <span><b>Operación válida:</b> {ownModelResult.persistence}. La demostración conserva el modelo en memoria; PostGIS lo persistirá tras autorización.</span> : <ul className="list-disc pl-4">{ownModelResult.errors.map(item => <li key={item}>{item}</li>)}</ul>}</div>}

                    <div className="grid gap-3 md:grid-cols-2">
                      {models.map(model => (
                        <button key={model.id} onClick={() => selectModel(model)} className={`rounded-xl border p-3 text-left transition-colors ${selectedModel?.id === model.id ? 'border-cyan-400 bg-cyan-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <div className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-slate-800">{model.title}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${model.publication === 'REUTILIZABLE_PID' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>{model.publication === 'REUTILIZABLE_PID' ? 'REUTILIZABLE' : 'PROPIO · BORRADOR'}</span></div>
                          <p className="mt-1 text-[10px] font-semibold text-pink-700">{model.domain} · v{model.version}</p>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{model.summary}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedModel && (
                    <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-24">
                      <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-wider text-pink-600">Instancia local</span><h3 className="mt-1 text-sm font-bold text-slate-800">{selectedModel.title}</h3></div><SlidersHorizontal className="h-4 w-4 text-cyan-600" /></div>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{selectedModel.ruleSummary}</p>
                      <div className="mt-3 text-[11px]"><span className="font-bold text-slate-700">Fuentes mínimas</span><ul className="mt-1 space-y-1 text-slate-600">{selectedModel.sourceRequirements.map(requirement => <li key={requirement}>• {requirement}</li>)}</ul></div>

                      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                        <span className="block text-[11px] font-bold text-slate-700">Conectores autorizados a vincular</span>
                        {connectors.filter(connector => selectedModel.requiredLanes.includes(connector.lane)).map(connector => {
                          const unavailable = connector.status === 'PENDIENTE_AUTORIZACION';
                          return <label key={connector.id} className={`flex items-start gap-2 rounded-lg border p-2 text-[10px] ${unavailable ? 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-800' : 'cursor-pointer border-slate-200 bg-white text-slate-700'}`}><input type="checkbox" disabled={unavailable} checked={selectedConnectorIds.includes(connector.id)} onChange={event => setSelectedConnectorIds(previous => event.target.checked ? [...new Set([...previous, connector.id])] : previous.filter(id => id !== connector.id))} className="mt-0.5 accent-cyan-600" /><span><b>{connector.title}</b><br />{unavailable ? 'Pendiente de autorización: no vinculable.' : `${connector.lane.replaceAll('_', ' ')} · ${connector.status.replaceAll('_', ' ')}`}</span></label>;
                        })}
                      </div>

                      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                        <span className="block text-[11px] font-bold text-slate-700">Parámetros de la plantilla</span>
                        {selectedModel.variables.map(variable => {
                          const type = variableType(variable);
                          const value = parameters[variable.id];
                          return <label key={variable.id} className="block text-[11px] font-semibold text-slate-700">{variable.label}{variable.unit ? ` (${variable.unit})` : ''}{type === 'boolean' ? <input type="checkbox" checked={Boolean(value)} onChange={event => setParameters(previous => ({ ...previous, [variable.id]: event.target.checked }))} className="ml-2 accent-cyan-600" /> : variable.allowedValues ? <select value={String(value)} onChange={event => setParameters(previous => ({ ...previous, [variable.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">{variable.allowedValues.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input type={type === 'number' ? 'number' : 'text'} min={variable.min} max={variable.max} step={type === 'number' ? 'any' : undefined} value={String(value ?? '')} onChange={event => setParameters(previous => ({ ...previous, [variable.id]: type === 'number' ? Number(event.target.value) : event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700" />}</label>;
                        })}
                      </div>

                      {selectedModel.publication === 'MODELO_PROPIO' && selectedModel.ownerDestinationId === destinationId && <button onClick={() => void publishOwnModel()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100"><GitBranch className="h-3.5 w-3.5" /> Publicar como plantilla reutilizable</button>}
                      <button disabled={isInstantiating} onClick={() => void instantiate()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-60"><Play className="h-3.5 w-3.5" /> {isInstantiating ? 'Validando…' : `Validar instancia para ${DESTINATIONS.find(destination => destination.id === destinationId)?.label}`}</button>
                      {instantiation && <div className={`mt-3 rounded-lg border p-3 text-[11px] leading-relaxed ${instantiation.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><div className="flex items-center gap-1.5 font-bold">{instantiation.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}{instantiation.valid ? 'Instancia validada' : 'Instancia rechazada'}</div>{instantiation.valid ? <p className="mt-1">Estado: <b>{instantiation.persistence}</b>. Se vincularían {instantiation.instance?.connectorIds.length} conectores con parámetros validados por la plantilla.</p> : <ul className="mt-1 list-disc pl-4">{instantiation.errors.map(item => <li key={item}>{item}</li>)}</ul>}</div>}
                      <a href={selectedModel.evidence.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"><FileText className="h-3 w-3" /> Evidencia de la plantilla</a>
                    </aside>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </section>
      <ConnectorConfigurationModal
        isOpen={isNewConnectorModalOpen}
        onClose={() => setIsNewConnectorModalOpen(false)}
        destinationId={destinationId}
        tenantId={destinationId === 'malaga' ? 'tenant_ayto_malaga' : 'tenant_ayto_palma'}
        onConnectorCreated={() => load(destinationId)}
      />
    </div>
  );
};
