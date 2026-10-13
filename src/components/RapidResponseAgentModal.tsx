import React, { useState, useEffect } from 'react';
import {
  X,
  Bot,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  Clock,
  Radio,
  Zap,
  } from 'lucide-react';
import { Destino } from '../types/ontology';
import {
  RapidResponseAgentProfile,
  CollapseIncident,
  RapidInterventionPlan
} from '../types/rapidResponseAgent';

interface RapidResponseAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: Destino;
  tenantId: string;
}

export const RapidResponseAgentModal: React.FC<RapidResponseAgentModalProps> = ({
  isOpen,
  onClose,
  destination,
  tenantId
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'incidents' | 'governance'>('monitor');
  const [agent, setAgent] = useState<RapidResponseAgentProfile | null>(null);
  const [activeIncident, setActiveIncident] = useState<CollapseIncident | null>(null);
  const [activePlan, setActivePlan] = useState<RapidInterventionPlan | null>(null);
  const [incidentsHistory, setIncidentsHistory] = useState<CollapseIncident[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [executingDecision, setExecutingDecision] = useState(false);
  const [forcedStressBoost] = useState<number>(30); // Para pruebas de colapso
  const [operatorRationale, setOperatorRationale] = useState<string>(
    'Autorización formal de activación de desvíos policiales y parkings disuasorios ante riesgo inminente de colapso.'
  );
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Cargar configuración de agente e incidentes
  useEffect(() => {
    if (!isOpen) return;

    const token = localStorage.getItem('pid_auth_token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'X-PID-Tenant': tenantId,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    fetch(`/api/rapid-response/agents?destino=${destination.id}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.agent) setAgent(data.agent);
      })
      .catch(err => console.error('Error cargando agente:', err));

    fetch(`/api/rapid-response/incidents?destino=${destination.id}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.incidents)) setIncidentsHistory(data.incidents);
      })
      .catch(err => console.error('Error cargando incidentes:', err));
  }, [isOpen, destination.id, tenantId]);

  if (!isOpen) return null;

  const handleEvaluateTerritory = async (boost: number = 0) => {
    setEvaluating(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/rapid-response/evaluate?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ forcedSaturationBoostPct: boost })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error evaluando territorio.');

      if (data.agent) setAgent(data.agent);
      if (data.incident) {
        setActiveIncident(data.incident);
        setActivePlan(data.interventionPlan);
        setMessage({
          text: `¡Alerta crítica detectada por el agente en ${data.incident.sourceZoneName}! (${data.incident.currentSaturationPct}% sat).`,
          type: 'warning'
        });
      } else {
        setActiveIncident(null);
        setActivePlan(null);
        setMessage({ text: data.statusSummary || 'Territorio en parámetros normales.', type: 'success' });
      }

      // Recargar histórico
      const resIncidents = await fetch(`/api/rapid-response/incidents?destino=${destination.id}`, {
        headers: { 'X-PID-Tenant': tenantId, ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const dataInc = await resIncidents.json();
      if (Array.isArray(dataInc.incidents)) setIncidentsHistory(dataInc.incidents);

    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setEvaluating(false);
    }
  };

  const handleAuthorizePlan = async (decision: 'AUTORIZADO_EJECUTADO' | 'RECHAZADO_OPERADOR') => {
    if (!activePlan) return;
    setExecutingDecision(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/rapid-response/plans/${activePlan.id}/execute?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          decision,
          rationale: operatorRationale
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error firmando plan de intervención.');

      setMessage({
        text: decision === 'AUTORIZADO_EJECUTADO'
          ? 'Plan de mitigación Nivel 2 firmado institucionalmente y enviado a Policía Local / Movilidad.'
          : 'Plan de intervención rechazado por el operador.',
        type: 'success'
      });

      setActivePlan(prev => prev ? { ...prev, status: decision } : null);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setExecutingDecision(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Iteración 16 · Respuesta Rápida ante Colapso</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">Gobernanza Human-in-the-Loop</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Agente Autónomo Centinela ante Sobrecargas</h2>
              <p className="text-xs text-slate-500">
                Destino: <span className="font-semibold text-slate-700">{destination.nombre}</span> · Monitorización de afluencias, detección temprana y mitigación escalonada
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'monitor' 
                ? 'border-red-600 text-red-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            Radar Centinela & Intervención Rápida
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'incidents' 
                ? 'border-red-600 text-red-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Historial de Incidentes Detectados ({incidentsHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'governance' 
                ? 'border-red-600 text-red-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Directiva & Reglas de Autorización
          </button>
        </div>

        {/* Mensajes */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : message.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* PESTAÑA 1: MONITOR & PLANES */}
          {activeTab === 'monitor' && (
            <div className="space-y-6">
              
              {/* Barra de Estado del Agente y Botones de Evaluación */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-ping ${agent?.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">
                      {agent?.agentName || 'Agente Centinela Activo'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Modo: <span className="font-semibold text-slate-700">{agent?.mode}</span> · Umbral crítico de disparo: <span className="font-bold text-red-600">{agent?.saturationThresholdPct}%</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEvaluateTerritory(0)}
                    disabled={evaluating}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
                    Inspeccionar Tiempo Real
                  </button>

                  <button
                    onClick={() => handleEvaluateTerritory(forcedStressBoost)}
                    disabled={evaluating}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    title="Simula un shock de afluencia para disparar el protocolo de respuesta"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Simular Shock (+{forcedStressBoost}%)
                  </button>
                </div>
              </div>

              {/* Incidente y Plan de Intervención Activo */}
              {activeIncident && activePlan ? (
                <div className="border border-red-200 bg-red-50/20 rounded-2xl p-5 space-y-5 animate-in fade-in">
                  
                  {/* Tarjeta de Incidente */}
                  <div className="flex items-center justify-between border-b border-red-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase">
                          {activeIncident.severity}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Detectado: {new Date(activeIncident.detectedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-800 mt-1">
                        Saturación Crítica en {activeIncident.sourceZoneName} ({activeIncident.currentSaturationPct}% sat.)
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">{activeIncident.triggerCause}</p>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-xs text-slate-500">Tiempo a alerta límite:</div>
                      <div className="text-lg font-bold text-red-600">{activeIncident.timeToCriticalAlertMinutes} min</div>
                    </div>
                  </div>

                  {/* Plan de Medidas Escalonadas */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                        Medidas Escalonadas de Mitigación (Alivio Estimado: -{activePlan.projectedReliefPct}%)
                      </h5>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        {activePlan.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {activePlan.actions.map(action => (
                        <div 
                          key={action.step}
                          className={`p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3.5 ${
                            action.riskLevel === 'NIVEL_1_INFORMATIVO_AUTONOMO'
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-white border-slate-200 shadow-sm'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            action.riskLevel === 'NIVEL_1_INFORMATIVO_AUTONOMO'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-purple-600 text-white'
                          }`}>
                            {action.step}
                          </div>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{action.name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                action.riskLevel === 'NIVEL_1_INFORMATIVO_AUTONOMO'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {action.riskLevel === 'NIVEL_1_INFORMATIVO_AUTONOMO' ? 'Autónomo (Nivel 1)' : 'Firma Humana (Nivel 2)'}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600">{action.description}</p>

                            <div className="flex gap-3 text-[10px] font-mono text-slate-500 pt-1">
                              <span>• Unidad: <strong className="text-slate-700">{action.responsibleUnit}</strong></span>
                              <span>• Zona: <strong className="text-slate-700">{action.targetZoneName}</strong></span>
                              <span>• Desvío: <strong className="text-emerald-700">-{action.estimatedDiversionSharePct}%</strong></span>
                              <span>• Coste: <strong className="text-slate-700">{action.estimatedCostEuros} €</strong></span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Formulario de Firma Institucional (Human-in-the-Loop) */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm">
                    <label className="text-xs font-bold text-slate-700 block">
                      Justificación Técnica del Operador para la Ejecución de Medidas Nivel 2
                    </label>
                    <textarea
                      rows={2}
                      value={operatorRationale}
                      onChange={e => setOperatorRationale(e.target.value)}
                      className="w-full text-xs font-medium p-2 border border-slate-200 rounded-lg outline-none focus:border-red-600"
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleAuthorizePlan('RECHAZADO_OPERADOR')}
                        disabled={executingDecision}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                      >
                        Rechazar Medidas
                      </button>

                      <button
                        onClick={() => handleAuthorizePlan('AUTORIZADO_EJECUTADO')}
                        disabled={executingDecision || activePlan.status === 'AUTORIZADO_EJECUTADO'}
                        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {executingDecision ? 'Firmando...' : 'Firmar y Ejecutar Plan de Mitigación'}
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center space-y-2 bg-slate-50/50">
                  <Bot className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Sin Incidentes Críticos Activos</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    El agente autónomo centinela monitoriza la afluencia en tiempo real. Pulsa "Simular Shock" para comprobar cómo detecta picos masivos y prepara planes escalonados de contingencia.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* PESTAÑA 2: HISTORIAL DE INCIDENTES */}
          {activeTab === 'incidents' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Registro Inmutable de Alertas Detectadas</h4>
              
              {incidentsHistory.length === 0 ? (
                <p className="text-xs text-slate-400 p-4">No hay incidentes registrados en PostGIS para este destino.</p>
              ) : (
                <div className="space-y-2.5">
                  {incidentsHistory.map(inc => (
                    <div key={inc.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inc.severity === 'ROJA_COLAPSO_INMINENTE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {inc.severity}
                          </span>
                          <span className="font-bold text-slate-800">{inc.sourceZoneName}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(inc.detectedAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-slate-600 text-[11px]">{inc.triggerCause}</p>

                      <div className="flex gap-4 text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                        <span>Saturación: <strong className="text-red-600">{inc.currentSaturationPct}%</strong></span>
                        <span>Visitantes: <strong>{inc.currentVisitors.toLocaleString()}</strong></span>
                        <span>Pico proyectado: <strong>{inc.predictedPeakVisitors.toLocaleString()}</strong></span>
                        <span>Estado: <strong className={inc.resolved ? 'text-emerald-600' : 'text-amber-600'}>{inc.resolved ? 'RESUELTO' : 'ACTIVO'}</strong></span>
                        <span>Huella SHA: <strong>{inc.evidenceFingerprintSha256.substring(0, 10)}...</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 3: GOBERNANZA */}
          {activeTab === 'governance' && (
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Directiva Municipal de Actuación Autónoma (SEGITTUR / PID)
              </h4>
              <p>
                El Gemelo Digital Turístico opera bajo una directiva estricta de dos niveles para garantizar la seguridad ciudadana y la soberanía administrativa:
              </p>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="text-xs font-bold text-emerald-700 block uppercase">Nivel 1: Comunicación e Información</span>
                  <p className="text-[11px] text-slate-500">
                    Avisos en paneles PMV, difusión en apps y recomendaciones de desvío cultural. Son ejecutadas de forma autónoma inmediata por el agente para evitar la escalada del colapso.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="text-xs font-bold text-purple-700 block uppercase">Nivel 2: Intervención Física y Policial</span>
                  <p className="text-[11px] text-slate-500">
                    Corte de accesos, despliegue de patrullas peatonales y habilitación de bolsas de estacionamiento. <strong>Bloqueadas por código hasta que un operador institucional autenticado mediante JWT emite su firma inmutable en PostGIS.</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Agentes autónomos centinela conectados a ontología S2, IoT y calibración PostGIS PID.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
