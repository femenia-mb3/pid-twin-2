import React, { useState, useEffect } from "react";
import { 
  X, 
  Share2, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Play, 
  ShieldCheck, 
  Database, 
  Users, 
  Building2, 
  ArrowRight, 
  FileCheck
} from "lucide-react";
import { 
  FederatedModelConfig, 
  FederatedSimulationResult, 
  ParticipantCompatibilityEvaluation
} from "../types/federatedSimulation";
import { ReusableModelTemplate } from "../types/interoperability";

interface FederatedSimulationModalProps {
  open: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
  tenantId: string;
  destinosDisponibles: Array<{ id: string; nombre: string }>;
}

export const FederatedSimulationModal: React.FC<FederatedSimulationModalProps> = ({
  open,
  onClose,
  destinationId,
  destinationName,
  tenantId,
  destinosDisponibles,
}) => {
  const [tab, setTab] = useState<'NUEVA_FEDERACION' | 'HISTORIAL_FEDERADO'>('NUEVA_FEDERACION');
  const [modelos, setModelos] = useState<ReusableModelTemplate[]>([]);
  const [modeloSeleccionadoId, setModeloSeleccionadoId] = useState<string>('');
  const [participantesSeleccionados, setParticipantesSeleccionados] = useState<string[]>([]);
  const [nombreFederacion, setNombreFederacion] = useState<string>('');
  const [descripcionFederacion] = useState<string>('Simulacion federada conjunta de destinos PID.');
  
  // Estado de evaluación de compatibilidad
  const [evaluando, setEvaluando] = useState<boolean>(false);
  const [evaluaciones, setEvaluaciones] = useState<ParticipantCompatibilityEvaluation[]>([]);
  const [configuracionCreada, setConfiguracionCreada] = useState<FederatedModelConfig | null>(null);
  
  // Estado de ejecución
  const [ejecutando, setEjecutando] = useState<boolean>(false);
  const [resultadoFederado, setResultadoFederado] = useState<FederatedSimulationResult | null>(null);
  const [errorEjecucion, setErrorEjecucion] = useState<string | null>(null);

  // Historial
  const [historialConfigs, setHistorialConfigs] = useState<FederatedModelConfig[]>([]);

  // Decisión humana
  const [registrandoDecision, setRegistrandoDecision] = useState<boolean>(false);
  const [decisionRegistrada, setDecisionRegistrada] = useState<boolean>(false);
  const [justificacionDecision, setJustificacionDecision] = useState<string>('Resultados federados homologados y conformes con la política de privacidad de la PID.');

  useEffect(() => {
    if (!open) return;
    
    // Cargar modelos disponibles
    fetch(`/api/models/reusable?destino=${destinationId}`, {
      headers: { 'X-PID-Tenant': tenantId }
    })
      .then(r => r.json())
      .then(d => {
        if (d.models) {
          setModelos(d.models);
          if (d.models.length > 0) {
            setModeloSeleccionadoId(d.models[0].id);
            setNombreFederacion(`Federación ${destinationName} — ${d.models[0].title}`);
          }
        }
      })
      .catch(() => {});

    // Cargar historial
    cargarHistorial();

    // Por defecto seleccionar al destino actual y otro participante si existe
    const otros = destinosDisponibles.filter(d => d.id !== destinationId).map(d => d.id);
    setParticipantesSeleccionados([destinationId, ...(otros.length > 0 ? [otros[0]] : [])]);
  }, [open, destinationId, tenantId]);

  const cargarHistorial = () => {
    fetch(`/api/federation/configs?destino=${destinationId}`, {
      headers: { 'X-PID-Tenant': tenantId }
    })
      .then(r => r.json())
      .then(d => {
        if (d.configs) setHistorialConfigs(d.configs);
      })
      .catch(() => {});
  };

  const handleToggleParticipante = (destId: string) => {
    if (destId === destinationId) return; // Coordinador siempre incluido
    setParticipantesSeleccionados(prev => 
      prev.includes(destId) ? prev.filter(id => id !== destId) : [...prev, destId]
    );
    // Resetear evaluación al cambiar participantes
    setEvaluaciones([]);
    setConfiguracionCreada(null);
    setResultadoFederado(null);
  };

  const handleEvaluarCompatibilidad = async () => {
    if (!modeloSeleccionadoId || participantesSeleccionados.length === 0) return;
    setEvaluando(true);
    setErrorEjecucion(null);

    try {
      const res = await fetch(`/api/federation/evaluate-compatibility?destino=${destinationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId
        },
        body: JSON.stringify({
          modelId: modeloSeleccionadoId,
          participantDestinationIds: participantesSeleccionados
        })
      });

      const data = await res.json();
      if (res.ok && data.evaluaciones) {
        setEvaluaciones(data.evaluaciones);
      } else {
        setErrorEjecucion(data.error || 'Error al evaluar compatibilidad');
      }
    } catch (err: any) {
      setErrorEjecucion(err.message);
    } finally {
      setEvaluando(false);
    }
  };

  const handleCrearConfiguracion = async () => {
    const modelo = modelos.find(m => m.id === modeloSeleccionadoId);
    if (!modelo) return;

    try {
      const res = await fetch(`/api/federation/configs?destino=${destinationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId
        },
        body: JSON.stringify({
          modelPackageId: modelo.id,
          modelPackageVersion: modelo.version,
          modelTitle: modelo.title,
          name: nombreFederacion || `Federación ${destinationName}`,
          description: descripcionFederacion || 'Simulación conjunta federada multidestino.',
          temporalHorizonHours: 4,
          dataSharingPolicy: 'SOLO_INDICADORES_AGREGADOS',
          participants: evaluaciones.map(ev => ({
            destinationId: ev.destinationId,
            destinationName: ev.destinationName,
            tenantId: ev.tenantId,
            role: ev.destinationId === destinationId ? 'COORDINADOR' : 'PARTICIPANTE',
            compatibilityStatus: ev.status,
            localBindingsSnapshot: {}
          }))
        })
      });

      const data = await res.json();
      if (res.ok) {
        setConfiguracionCreada(data);
        cargarHistorial();
      } else {
        setErrorEjecucion(data.error || 'Error creando configuración federada');
      }
    } catch (err: any) {
      setErrorEjecucion(err.message);
    }
  };

  const handleEjecutarSimulacionFederada = async () => {
    if (!configuracionCreada) return;
    setEjecutando(true);
    setErrorEjecucion(null);

    try {
      const res = await fetch(`/api/federation/configs/${configuracionCreada.id}/execute?destino=${destinationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId
        }
      });

      const data = await res.json();
      if (res.ok) {
        setResultadoFederado(data);
        setDecisionRegistrada(false);
      } else {
        setErrorEjecucion(data.error || 'Error ejecutando simulación federada');
      }
    } catch (err: any) {
      setErrorEjecucion(err.message);
    } finally {
      setEjecutando(false);
    }
  };

  const handleRegistrarDecision = async () => {
    if (!resultadoFederado) return;
    setRegistrandoDecision(true);

    try {
      const res = await fetch(`/api/federation/runs/${resultadoFederado.id}/decision?destino=${destinationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId
        },
        body: JSON.stringify({
          action: 'APROBAR_COMPARTICION',
          rationale: justificacionDecision
        })
      });

      if (res.ok) {
        setDecisionRegistrada(true);
      }
    } catch (err) {
    } finally {
      setRegistrandoDecision(false);
    }
  };

  if (!open) return null;

  const hayIncompatibles = evaluaciones.some(e => e.status === 'INCOMPLETO' || e.status === 'NO_COMPATIBLE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Cabecera Modal */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-cyan-500 text-white rounded-xl shadow-sm">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">Módulo PID Federado</span>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] font-medium text-slate-500">Soberanía de Datos & Cero Cruce Crudo</span>
              </div>
              <h2 className="text-base font-bold text-slate-800">Simulación Multidestino Federada</h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-200/70 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setTab('NUEVA_FEDERACION')}
                className={`px-3 py-1 rounded-md transition-all ${
                  tab === 'NUEVA_FEDERACION' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Configurar Simulación
              </button>
              <button
                onClick={() => setTab('HISTORIAL_FEDERADO')}
                className={`px-3 py-1 rounded-md transition-all ${
                  tab === 'HISTORIAL_FEDERADO' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Historial ({historialConfigs.length})
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {errorEjecucion && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-bold">Error en la operación federada</p>
                <p>{errorEjecucion}</p>
              </div>
            </div>
          )}

          {tab === 'NUEVA_FEDERACION' && (
            <div className="space-y-6">
              
              {/* Paso 1: Selección de Modelo y Participantes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>1. Modelo de Simulación Reutilizable</span>
                  </label>
                  <select
                    value={modeloSeleccionadoId}
                    onChange={(e) => {
                      setModeloSeleccionadoId(e.target.value);
                      const m = modelos.find(mod => mod.id === e.target.value);
                      if (m) setNombreFederacion(`Federación ${destinationName} — ${m.title}`);
                      setEvaluaciones([]);
                      setConfiguracionCreada(null);
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {modelos.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title} (v{m.version}) · {m.creatorDestinationName}
                      </option>
                    ))}
                  </select>
                  {modeloSeleccionadoId && (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {modelos.find(m => m.id === modeloSeleccionadoId)?.summary}
                    </p>
                  )}
                </div>

                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-cyan-600" />
                    <span>2. Destinos Participantes (Soberanía Local)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {destinosDisponibles.map(d => {
                      const isCoord = d.id === destinationId;
                      const isSelected = participantesSeleccionados.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          onClick={() => handleToggleParticipante(d.id)}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs text-left transition-all ${
                            isSelected 
                              ? 'bg-indigo-50/90 border-indigo-300 text-indigo-900 font-semibold' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{d.nombre}</span>
                          {isCoord ? (
                            <span className="text-[9px] px-1.5 py-0.5 bg-indigo-600 text-white rounded font-bold">Coord.</span>
                          ) : isSelected ? (
                            <CheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Botón de Comprobación Previa de Compatibilidad */}
              <div className="flex items-center justify-between p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">3. Evaluación Previa y Obligatoria de Compatibilidad</h4>
                  <p className="text-[11px] text-indigo-700">
                    Comprueba que cada destino cumpla las variables obligatorias, calidad mínima y CRS territorial sin exponer datos crudos.
                  </p>
                </div>
                <button
                  onClick={handleEvaluarCompatibilidad}
                  disabled={evaluando || participantesSeleccionados.length < 2}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center space-x-2 shrink-0"
                >
                  {evaluando ? <Clock className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{evaluando ? 'Evaluando matriz…' : 'Evaluar Compatibilidad'}</span>
                </button>
              </div>

              {/* Matriz de Compatibilidad Obtenida */}
              {evaluaciones.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Matriz de Idoneidad Federada</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {evaluaciones.map(ev => {
                      const isOk = ev.status === 'COMPATIBLE' || ev.status === 'COMPATIBLE_CON_CONDICIONES';
                      return (
                        <div 
                          key={ev.destinationId}
                          className={`p-4 rounded-xl border transition-all ${
                            isOk ? 'bg-white border-emerald-200 shadow-sm' : 'bg-rose-50/50 border-rose-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Building2 className={`w-4 h-4 ${isOk ? 'text-emerald-600' : 'text-rose-600'}`} />
                              <span className="text-xs font-bold text-slate-800">{ev.destinationName}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ev.status === 'COMPATIBLE' ? 'bg-emerald-100 text-emerald-800' :
                              ev.status === 'COMPATIBLE_CON_CONDICIONES' ? 'bg-amber-100 text-amber-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {ev.status} ({ev.compatibilityScorePct}%)
                            </span>
                          </div>

                          <div className="space-y-1.5 text-[11px]">
                            {ev.checks.map((chk, i) => (
                              <div key={i} className="flex items-center justify-between py-0.5 border-b border-slate-100 last:border-0">
                                <span className="text-slate-600">{chk.requirement}</span>
                                <span className={`font-semibold ${
                                  chk.evaluatedStatus === 'CUMPLE' ? 'text-emerald-600' :
                                  chk.evaluatedStatus === 'ADVERTENCIA' ? 'text-amber-600' : 'text-rose-600'
                                }`}>
                                  {chk.evaluatedStatus}
                                </span>
                              </div>
                            ))}
                          </div>

                          {ev.unmetMandatoryRequirements.length > 0 && (
                            <div className="mt-2.5 p-2 bg-rose-100/60 rounded text-[10px] text-rose-800 font-medium">
                              Bloqueo: {ev.unmetMandatoryRequirements.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Acciones para guardar configuración o bloquear */}
                  <div className="pt-2 flex items-center justify-between">
                    {hayIncompatibles ? (
                      <div className="flex items-center space-x-2 text-rose-600 text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>No se puede federar: existen destinos con variables faltantes o incompatibles.</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-emerald-600 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Todos los participantes cumplen los requisitos mínimos declarativos.</span>
                      </div>
                    )}

                    {!configuracionCreada ? (
                      <button
                        onClick={handleCrearConfiguracion}
                        disabled={hayIncompatibles}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                      >
                        Guardar Configuración Federada
                      </button>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-slate-500 font-medium">Configuración guardada en PostGIS</span>
                        <button
                          onClick={handleEjecutarSimulacionFederada}
                          disabled={ejecutando}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center space-x-2"
                        >
                          {ejecutando ? <Clock className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          <span>{ejecutando ? 'Simulando en paralelo…' : 'Ejecutar Simulación Federada'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Resultados de la Simulación Federada */}
              {resultadoFederado && (
                <div className="mt-6 p-5 bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-indigo-200 rounded-2xl space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded">RESULTADO FEDERADO</span>
                        <span className="text-xs font-bold text-slate-800">{resultadoFederado.modelTitle}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ejecutado por {resultadoFederado.executedBy} · Huella SHA-256: <code className="text-indigo-600">{resultadoFederado.evidence.federationFingerprintSha256.substring(0, 16)}…</code>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800">Incertidumbre Global</span>
                      <p className="text-[11px] font-semibold text-amber-600">{resultadoFederado.aggregatedMetrics.nivelIncertidumbreGlobal}</p>
                    </div>
                  </div>

                  {/* KPIs Consolidados */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Visitantes Base</span>
                      <p className="text-base font-bold text-slate-800 mt-0.5">
                        {resultadoFederado.aggregatedMetrics.totalVisitantesBase.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">Visitantes Escenario</span>
                      <p className="text-base font-bold text-indigo-700 mt-0.5">
                        {resultadoFederado.aggregatedMetrics.totalVisitantesEscenario.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase">Delta Global</span>
                      <p className="text-base font-bold text-emerald-600 mt-0.5">
                        +{resultadoFederado.aggregatedMetrics.deltaTotalVisitantes.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-500 uppercase">Saturación Media</span>
                      <p className="text-base font-bold text-amber-700 mt-0.5">
                        {resultadoFederado.aggregatedMetrics.saturacionMediaPonderadaPct}%
                      </p>
                    </div>
                  </div>

                  {/* Comparativa por Destino Local (BASE / ESCENARIO / DELTA) */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-700">Desglose Local Homologado por Destino</h5>
                    <div className="space-y-2">
                      {resultadoFederado.localResults.map(loc => (
                        <div key={loc.destinationId} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                          <div className="w-1/4">
                            <span className="font-bold text-slate-800">{loc.destinationName}</span>
                            <p className="text-[10px] text-slate-400">Tenant: {loc.tenantId}</p>
                          </div>
                          <div className="flex items-center space-x-6 text-[11px]">
                            <div>
                              <span className="text-slate-400 block text-[9px]">BASE</span>
                              <span className="font-semibold">{loc.base.visitantesEnDestino.toLocaleString()} p</span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                            <div>
                              <span className="text-indigo-400 block text-[9px]">ESCENARIO</span>
                              <span className="font-semibold text-indigo-700">{loc.scenario.visitantesEnDestino.toLocaleString()} p</span>
                            </div>
                            <div className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <span className="text-emerald-700 font-bold">+{loc.delta.visitantesEnDestino.toLocaleString()} ({loc.delta.saturacionGlobalPct}% sat)</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Panel de Aprobación Humana de Compartición */}
                  <div className="p-4 bg-white border border-indigo-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileCheck className="w-4 h-4 text-indigo-600" />
                        <h5 className="text-xs font-bold text-slate-800">Decisión Humana y Publicación a la PID</h5>
                      </div>
                      {decisionRegistrada && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                          DECISIÓN REGISTRADA EN POSTGIS
                        </span>
                      )}
                    </div>
                    
                    <input
                      type="text"
                      value={justificacionDecision}
                      onChange={(e) => setJustificacionDecision(e.target.value)}
                      placeholder="Justificación de aprobación y gobernanza..."
                      disabled={decisionRegistrada}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                    />

                    {!decisionRegistrada && (
                      <div className="flex justify-end">
                        <button
                          onClick={handleRegistrarDecision}
                          disabled={registrandoDecision || !justificacionDecision}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center space-x-1.5"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>{registrandoDecision ? 'Firmando y persistiendo…' : 'Firmar y Registrar en Auditoría Inmutable'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

          {tab === 'HISTORIAL_FEDERADO' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Configuraciones Federadas Guardadas en PostGIS</h4>
              {historialConfigs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400">
                  No hay configuraciones federadas registradas para este destino.
                </div>
              ) : (
                <div className="space-y-2">
                  {historialConfigs.map(c => (
                    <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800">{c.name}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                            {c.modelTitle}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Participantes: {c.participants.map(p => p.destinationName).join(', ')} · Creado por {c.createdBy}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Pie Modal */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Garantía de Aislamiento PID: los datos crudos locales nunca cruzan fronteras de tenant.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
