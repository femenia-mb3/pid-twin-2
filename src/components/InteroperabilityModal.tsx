import { useEffect, useRef, useState } from 'react';
import { ConnectorConfigurationModal } from './ConnectorConfigurationModal';
import { pidModuleLabel } from '../services/interoperabilityCatalogService';
import {
  Plus,
  ArrowRight,
  CloudCog,
  ExternalLink,
  Link2,
  LoaderCircle,
  Map,
  Network,
  PlugZap,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  InteroperabilityArchitecture,
  InteroperabilityConnector
} from '../types/interoperability';

interface InteroperabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDestinationId: string;
}

interface ArchitectureResponse { architecture: InteroperabilityArchitecture }
interface ConnectorsResponse { destinationId: string; tenantId: string; total: number; connectors: InteroperabilityConnector[] }

const DESTINATIONS = [
  { id: 'malaga', label: 'Málaga' },
  { id: 'palma', label: 'Palma' }
];

export const InteroperabilityModal = ({ isOpen, onClose, initialDestinationId }: InteroperabilityModalProps) => {
  const [architecture, setArchitecture] = useState<InteroperabilityArchitecture | null>(null);
  const [connectors, setConnectors] = useState<InteroperabilityConnector[]>([]);
  const [destinationId, setDestinationId] = useState(initialDestinationId);
  const [activeTab, setActiveTab] = useState<'architecture' | 'connectors'>('architecture');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isNewConnectorModalOpen, setIsNewConnectorModalOpen] = useState(false);
  const requestSequence = useRef(0);

  const load = (targetDestinationId: string) => {
    const requestId = ++requestSequence.current;
    setStatus('loading');
    setError('');
    return Promise.all([
      fetch('/api/interoperability/architecture').then(response => {
        if (!response.ok) throw new Error('No se pudo cargar la arquitectura de interoperabilidad.');
        return response.json() as Promise<ArchitectureResponse>;
      }),
      fetch(`/api/interoperability/connectors?destino=${encodeURIComponent(targetDestinationId)}`).then(response => {
        if (!response.ok) throw new Error('No se pudieron cargar los conectores del destino.');
        return response.json() as Promise<ConnectorsResponse>;
      })
    ]).then(([architectureResponse, connectorsResponse]) => {
      if (requestId !== requestSequence.current) return;
      setArchitecture(architectureResponse.architecture);
      setConnectors(connectorsResponse.connectors);
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

  const changeDestination = (nextDestinationId: string) => {
    setDestinationId(nextDestinationId);
    void load(nextDestinationId);
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
                ['connectors', 'Conectores', CloudCog]
              ].map(([id, label, Icon]) => (
                <button
                  key={id as string}
                  onClick={() => setActiveTab(id as 'architecture' | 'connectors')}
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
