import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  AlertTriangle, 
  ShieldCheck, 
  Sliders, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Info, 
  RefreshCw, 
  FileCheck 
} from 'lucide-react';
import { 
  AiSimulationProposal, 
  AiAgentCapabilities 
} from '../types/aiAgent';

interface AiSimulationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
  tenantId: string;
  activeZoneId?: string;
  onApplyProposal: (proposal: AiSimulationProposal) => void;
  onOpenInScenarioStudio: (proposal: AiSimulationProposal) => void;
}

export const AiSimulationDrawer: React.FC<AiSimulationDrawerProps> = ({
  isOpen,
  onClose,
  destinationId,
  destinationName,
  tenantId,
  activeZoneId,
  onApplyProposal,
  onOpenInScenarioStudio
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<AiSimulationProposal | null>(null);
  const [capabilities, setCapabilities] = useState<AiAgentCapabilities | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'proposal' | 'evidence' | 'parameters'>('proposal');

  const recordDecisionOnServer = async (decision: 'APLICADO_SIMULADOR' | 'EXPORTADO_ESTUDIO' | 'RECHAZADO', rationale?: string) => {
    if (!proposal?.id) return;
    try {
      await fetch(`/api/ai/audit/decision?destino=${destinationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId
        },
        body: JSON.stringify({
          proposalId: proposal.id,
          decision,
          decisionRationale: rationale || `Decisión ejecutada por el operador desde el Copiloto IA.`
        })
      });
    } catch (err) {
      console.warn('[Audit Client Warning] No se pudo registrar evento de decisión:', err);
    }
  };

  // Cargar capacidades y sugerencias del destino al abrir o cambiar de destino
  useEffect(() => {
    if (!isOpen || !destinationId || !tenantId) return;

    fetch(`/api/ai/capabilities?destino=${encodeURIComponent(destinationId)}`, {
      headers: {
        'X-PID-Tenant': tenantId
      }
    })
      .then(res => res.json())
      .then(data => setCapabilities(data))
      .catch(err => console.warn('[AI Drawer] Error cargando capacidades:', err));
  }, [isOpen, destinationId, tenantId]);

  const handleSubmitPrompt = async (textToSubmit?: string) => {
    const text = (textToSubmit || prompt).trim();
    if (!text || text.length < 5) {
      setErrorMessage('Por favor introduce una consulta de al menos 5 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setProposal(null);

    try {
      const response = await fetch('/api/ai/simulate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId
        },
        body: JSON.stringify({
          destinationId,
          prompt: text,
          activeZoneId
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || `Error del servidor (${response.status})`);
      }

      const result: AiSimulationProposal = await response.json();
      setProposal(result);
      if (textToSubmit) setPrompt(textToSubmit);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error procesando la simulación en lenguaje natural.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">
        
        {/* Cabecera del Drawer */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800">
                  Copiloto IA de Simulación y What-If
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700">
                  PID / SEGITTUR
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Destino activo: <strong className="text-slate-700">{destinationName}</strong> · Tenant: <span className="font-mono text-[11px] text-slate-600">{tenantId}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Cerrar asistente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido principal scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Banner de Copiloto Seguro / Human-in-the-loop */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-3 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Supervisión humana garantizada:</strong> El copiloto genera propuestas estructuradas auditables con evidencias de fuentes autorizadas. Ningún escenario se ejecuta o persiste sin tu validación explícita.
            </div>
          </div>

          {/* Cuadro de texto de entrada */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
              ¿Qué hipótesis o escenario deseas evaluar en {destinationName}?
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmitPrompt();
                  }
                }}
                placeholder="Ejemplo: ¿Qué ocurriría si llegan 8.000 cruceristas al centro con lluvia a las 12:00 y reducimos el tráfico?"
                className="w-full h-24 p-3 text-sm text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-inner resize-none placeholder:text-slate-400"
              />
              <button
                disabled={loading || !prompt.trim()}
                onClick={() => handleSubmitPrompt()}
                className="absolute bottom-3 right-3 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Interpretando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Interpretar
                  </>
                )}
              </button>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span>Atajo: Ctrl + Enter para enviar</span>
              {capabilities && (
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${capabilities.llmConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  Motor: {capabilities.llmConfigured ? capabilities.llmModel : 'Reglas Heurísticas PID'}
                </span>
              )}
            </div>
          </div>

          {/* Sugerencias contextualizadas */}
          {capabilities && capabilities.destinationPrompts.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Sugerencias para {destinationName}:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {capabilities.destinationPrompts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSubmitPrompt(p.prompt)}
                    className="p-2.5 text-left border border-slate-200 hover:border-red-300 hover:bg-red-50/50 rounded-lg text-xs transition-colors group"
                  >
                    <div className="font-semibold text-slate-700 group-hover:text-red-700 flex items-center justify-between">
                      <span>{p.label}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-red-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      {p.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mensajes de error */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong>Error en la interpretación:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Resultado de la Propuesta IA */}
          {proposal && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm space-y-0">
              
              {/* Header de la propuesta */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      proposal.status === 'READY_FOR_REVIEW' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : proposal.status === 'REQUIRES_CLARIFICATION'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {proposal.status === 'READY_FOR_REVIEW' ? 'Propuesta Lista para Revisión' : proposal.status}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-600 font-medium">
                      Intención: <strong>{proposal.interpretation.intent}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {proposal.id.slice(-8)}
                  </span>
                </div>
                
                <h3 className="text-sm font-bold text-slate-800 mt-2">
                  {proposal.scenarioDraft.name}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {proposal.scenarioDraft.description}
                </p>
              </div>

              {/* Pestañas de detalle */}
              <div className="flex border-b border-slate-200 text-xs font-medium bg-slate-50/50">
                <button
                  onClick={() => setActiveTab('proposal')}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors ${
                    activeTab === 'proposal'
                      ? 'border-red-600 text-red-600 bg-white font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Resumen e Impacto
                </button>
                <button
                  onClick={() => setActiveTab('evidence')}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === 'evidence'
                      ? 'border-red-600 text-red-600 bg-white font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Evidencias y Fuentes ({proposal.evidence.dataSources.length})
                </button>
                <button
                  onClick={() => setActiveTab('parameters')}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors ${
                    activeTab === 'parameters'
                      ? 'border-red-600 text-red-600 bg-white font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Variables Calculadas
                </button>
              </div>

              {/* Contenido según pestaña activa */}
              <div className="p-4 space-y-4">
                
                {/* 1. Pestaña Propuesta General */}
                {activeTab === 'proposal' && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <h4 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                        Zonas Territoriales Afectadas:
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {proposal.interpretation.targetZoneNames.map((name, i) => (
                          <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium border border-slate-200">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="font-semibold text-slate-700">Justificación Técnica del Agente:</div>
                      <p className="text-slate-600 leading-relaxed">
                        {proposal.evidence.rationale}
                      </p>
                    </div>

                    {proposal.evidence.assumptions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                          Supuestos Adoptados:
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600">
                          {proposal.evidence.assumptions.map((assump, idx) => (
                            <li key={idx}>{assump}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Pestaña Evidencias Obligatorias */}
                {activeTab === 'evidence' && (
                  <div className="space-y-4 text-xs">
                    {/* Tarjeta de huella y gobernanza */}
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-900 font-semibold">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Vinculación a Evidencia Comprobable (PID)</span>
                      </div>
                      <div className="text-[11px] text-emerald-800 space-y-1">
                        <p><strong>Huella Contextual SHA-256:</strong> <span className="font-mono text-[10px] break-all">{proposal.evidence.contextFingerprint}</span></p>
                        <p><strong>Origen:</strong> {proposal.evidence.origin} · <strong>Versión:</strong> {proposal.evidence.contextVersion}</p>
                        <p><strong>Aviso de Gobernanza:</strong> {proposal.evidence.governanceNotice}</p>
                      </div>
                    </div>

                    {/* Lista de fuentes de datos invocadas */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                        Fuentes de Datos Autorizadas Citadas:
                      </h4>
                      <div className="space-y-2">
                        {proposal.evidence.dataSources.map((source) => (
                          <div key={source.id} className="p-2.5 border border-slate-200 rounded-lg bg-slate-50/50 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">{source.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                {source.dataQuality}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Trazabilidad: {source.traceabilityId} · Estado: {source.authorization}
                            </p>
                            <p className="text-[11px] text-slate-600">
                              <strong>Aporte al escenario:</strong> {source.contribution}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Incertidumbre y advertencia de datos sintéticos */}
                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-amber-900 font-semibold text-xs">
                        <span>Nivel de Incertidumbre: {proposal.evidence.uncertainty.level}</span>
                        <span>Confianza: {proposal.evidence.uncertainty.confidencePct}%</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        {proposal.evidence.uncertainty.disclaimer}
                      </p>
                      {proposal.evidence.uncertainty.factors.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-amber-200/60">
                          <span className="font-semibold text-amber-900 text-[10px] block">Factores determinantes:</span>
                          <ul className="list-disc pl-3 text-[10px] text-amber-800 space-y-0.5 mt-0.5">
                            {proposal.evidence.uncertainty.factors.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Pestaña Parámetros Calculados */}
                {activeTab === 'parameters' && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Variación Visitantes</span>
                        <span className="text-base font-bold text-slate-800">
                          {proposal.scenarioDraft.inputs.visitorVariationPct > 0 ? '+' : ''}
                          {proposal.scenarioDraft.inputs.visitorVariationPct}%
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Capacidad Operativa</span>
                        <span className="text-base font-bold text-slate-800">
                          {proposal.scenarioDraft.inputs.operationalCapacityPct}%
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Hora de Simulación</span>
                        <span className="text-base font-bold text-slate-800">
                          {String(proposal.scenarioDraft.inputs.hour).padStart(2, '0')}:00 h
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Condición Climática</span>
                        <span className="text-base font-bold text-slate-800">
                          {proposal.scenarioDraft.inputs.climate}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Modo de Movilidad</span>
                        <span className="text-base font-bold text-slate-800">
                          {proposal.scenarioDraft.inputs.mobilityMode}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Distribución Espacial</span>
                        <span className="text-base font-bold text-slate-800">
                          {proposal.scenarioDraft.inputs.spatialDistribution}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botonera de Acciones Human-in-the-loop */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2 justify-end">
                {proposal.status === 'READY_FOR_REVIEW' ? (
                  <>
                    <button
                      onClick={() => {
                        recordDecisionOnServer('EXPORTADO_ESTUDIO');
                        onOpenInScenarioStudio(proposal);
                        onClose();
                      }}
                      className="px-3.5 py-2 border border-slate-300 hover:bg-white text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      Abrir en Editor de Escenarios
                    </button>
                    <button
                      onClick={() => {
                        recordDecisionOnServer('APLICADO_SIMULADOR');
                        onApplyProposal(proposal);
                        onClose();
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aplicar al Simulador y Ver Impacto
                    </button>
                  </>
                ) : (
                  <div className="w-full text-center text-xs text-amber-700 font-medium py-1">
                    {proposal.clarificationPrompt || proposal.rejectionReason || 'La propuesta requiere aclaración o no cumple gobernanza territorial antes de aplicarse.'}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
