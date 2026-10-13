import { useEffect, useState } from 'react';
import { X, Network, Database, Code2, LoaderCircle, ShieldCheck, Link2, MapPinned, CheckCircle2, GitCompare } from 'lucide-react';
import { DestinationSemanticProfile, SemanticModelDescriptor } from '../types/semantic';
import { MultiDestinationCompatibilityMatrix } from '../types/compatibility';

interface MultiDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileResponse {
  profiles: DestinationSemanticProfile[];
}

export const MultiDestinationModal = ({ isOpen, onClose }: MultiDestinationModalProps) => {
  const [model, setModel] = useState<SemanticModelDescriptor | null>(null);
  const [profiles, setProfiles] = useState<DestinationSemanticProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'profiles' | 'compatibility'>('profiles');
  const [selectedModelForEval, setSelectedModelForEval] = useState<string>('modelo_saturacion_turistica');
  const [compatibilityMatrix, setCompatibilityMatrix] = useState<MultiDestinationCompatibilityMatrix | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatus('loading');
    setError('');

    Promise.all([
      fetch('/api/semantic/model').then(response => {
        if (!response.ok) throw new Error('No se pudo cargar la descripción del modelo semántico.');
        return response.json() as Promise<SemanticModelDescriptor>;
      }),
      fetch('/api/semantic/profiles').then(response => {
        if (!response.ok) throw new Error('No se pudieron cargar los perfiles de destino.');
        return response.json() as Promise<ProfileResponse>;
      })
    ])
      .then(([modelResponse, profilesResponse]) => {
        if (cancelled) return;
        setModel(modelResponse);
        setProfiles(profilesResponse.profiles);
        setStatus('ready');
        void runCompatibilityCheck('modelo_saturacion_turistica');
      })
      .catch((reason: Error) => {
        if (cancelled) return;
        setError(reason.message);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  const runCompatibilityCheck = async (modelId: string) => {
    setEvaluating(true);
    try {
      const res = await fetch('/api/multidestino/compatibility-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          destinationIds: ['malaga', 'palma']
        })
      });
      const data = await res.json();
      setCompatibilityMatrix(data);
    } catch (err) {
      console.error('Error evaluando compatibilidad:', err);
    } finally {
      setEvaluating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex gap-3">
            <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-pink-700 uppercase">PID · SEGITTUR</span>
                <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-cyan-700 uppercase">Multidestino</span>
              </div>
              <h2 className="mt-1 text-base font-bold text-slate-800">Perfil Semántico y Modelo de Destinos</h2>
              <p className="mt-0.5 text-xs text-slate-500">Catálogo verificable de entidades, contratos NGSI-LD y perfiles aislados por destino.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar modelo multidestino">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Selector de pestañas */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'profiles' ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" /> Perfiles y Ontología NGSI-LD
          </button>
          <button
            onClick={() => setActiveTab('compatibility')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'compatibility' ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitCompare className="w-4 h-4" /> Matriz de Compatibilidad de Modelos
          </button>
        </div>

        <div className="p-6">
          {status === 'loading' && (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-medium text-slate-500">
              <LoaderCircle className="h-5 w-5 animate-spin text-cyan-600" /> Cargando contratos semánticos y evidencias…
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <b>No se pudo consultar el modelo:</b> {error}
            </div>
          )}

          {status === 'ready' && model && (
            <div className="space-y-5">
              {activeTab === 'compatibility' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-800">Modelo a contrastar entre destinos:</span>
                      <p className="text-[11px] text-slate-500">Evalúa si los destinos disponen de fuentes requeridas (S2/C4/S11) para ejecutar el modelo de forma homogénea.</p>
                    </div>
                    <select
                      value={selectedModelForEval}
                      onChange={(e) => {
                        setSelectedModelForEval(e.target.value);
                        void runCompatibilityCheck(e.target.value);
                      }}
                      className="text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                    >
                      <option value="modelo_saturacion_turistica">Saturación Turística (Capacidad)</option>
                      <option value="modelo_puertos_cruceros">Puertos y Cruceros</option>
                      <option value="modelo_playas">Playas y Litoral</option>
                      <option value="modelo_patrimonio">Patrimonio Histórico</option>
                    </select>
                  </div>

                  {evaluating ? (
                    <div className="p-8 text-center text-xs text-slate-500">Calculando matriz de requerimientos interterritorial...</div>
                  ) : compatibilityMatrix ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {compatibilityMatrix.destinationsEvaluated.map(dest => (
                          <div key={dest.destinationId} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">{dest.destinationName}</h4>
                                <span className="text-[10px] font-mono text-slate-500">{dest.tenantId}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-black text-slate-800 font-mono">{dest.compatibilityScorePct}%</div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                  dest.readinessLevel === 'LISTO_PARA_OPERAR' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {dest.readinessLevel.replaceAll('_', ' ')}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-slate-100">
                              {dest.checks.map(check => (
                                <div key={check.requirementId} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-50">
                                  <span className="font-medium text-slate-700">{check.name}</span>
                                  <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                                    check.status === 'DISPONIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {check.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-900 space-y-1">
                        <div className="flex items-center gap-2 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-cyan-700" />
                          <span>Factibilidad Multidestino: {compatibilityMatrix.overallCrossDestinationFeasibility}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          {compatibilityMatrix.recommendations.join(' ')}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
              <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Code2 className="h-4 w-4 text-cyan-600" /> Contrato de interoperabilidad
                  </div>
                  <h3 className="mt-2 font-bold text-slate-800">{model.profileName}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Perfil de implementación que relaciona el vocabulario turístico público de SEGITTUR con entidades operativas de gemelo: zonas, sensores, simulación, procedencia y datasets 3D.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono">
                    <span className="rounded bg-white px-2 py-1 text-slate-600 border border-slate-200">{model.profileId}</span>
                    <a className="rounded bg-white px-2 py-1 text-cyan-700 border border-cyan-100 hover:bg-cyan-50" href={model.contextUrl} target="_blank" rel="noreferrer">Contexto JSON-LD v{model.version}</a>
                    <a className="rounded bg-white px-2 py-1 text-cyan-700 border border-cyan-100 hover:bg-cyan-50" href={model.profileUrl} target="_blank" rel="noreferrer">Perfil RDF/Turtle</a>
                    <a className="rounded bg-white px-2 py-1 text-cyan-700 border border-cyan-100 hover:bg-cyan-50" href={model.shaclUrl} target="_blank" rel="noreferrer">Restricciones SHACL</a>
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-800">
                    <ShieldCheck className="h-4 w-4" /> Evidencia semántica
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-cyan-900">Vocabulario de referencia enlazado y visible desde el propio modelo.</p>
                  <a href={model.officialVocabulary.iri} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 hover:text-cyan-950">
                    <Link2 className="h-3.5 w-3.5" /> Ontología turística SEGITTUR
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
                  <Database className="h-4 w-4 text-pink-600" /> Cobertura Ontológica del Gemelo
                  <span className="ml-auto rounded bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 border border-slate-200">{model.entityTypes.length} tipos</span>
                </div>
                <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                  {model.entityTypes.map((entity) => (
                    <div key={entity.type} className="p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-800">{entity.label}</span>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{entity.mapsTo}</code>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">Requeridos: {entity.requiredAttributes.join(' · ')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <MapPinned className="h-4 w-4 text-pink-600" /> Perfiles actualmente configurados
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {profiles.map(profile => (
                    <article key={profile.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-slate-800">{profile.destinationName}</h3>
                          <p className="text-[11px] text-slate-500">{profile.tenantName} · INE {profile.ineCode}</p>
                        </div>
                        <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Perfil activo
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-slate-50 p-2">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Namespace</span>
                          <code className="mt-0.5 block truncate text-[10px] text-slate-600">{profile.namespace}</code>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Nivel geoespacial</span>
                          <span className="mt-0.5 block font-semibold text-slate-700">{profile.activeSpatialLevel.replaceAll('_', ' ')}</span>
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
                        Dominios: {profile.enabledDomains.join(' · ')}. Política: <b>{profile.dataPolicy}</b>.
                      </p>
                      <a href={profile.evidence.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900">
                        <Link2 className="h-3 w-3" /> Evidencia del perfil
                      </a>
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-700">Referencias vinculadas al modelo</p>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                  {model.evidence.map(evidence => (
                    <li key={evidence.url} className="flex gap-2">
                      <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600" />
                      <span><a href={evidence.url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-700 hover:text-cyan-900">{evidence.label}</a> — {evidence.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
              </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
