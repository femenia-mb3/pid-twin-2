import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  RefreshCw,
  Coins,
  Scale
} from 'lucide-react';
import { Destino, ZonaDestino } from '../types/ontology';
import { 
  MacroeconomicSimulationResult, 
  FlowOptimizationProposal, 
  StressTestExecutionResult 
} from '../types/macroOptimizationStress';

interface MacroOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: Destino;
  tenantId: string;
  zones: ZonaDestino[];
}

export const MacroOptimizationModal: React.FC<MacroOptimizationModalProps> = ({
  isOpen,
  onClose,
  destination,
  tenantId
}) => {
  const [activeTab, setActiveTab] = useState<'macro' | 'optimization' | 'stress'>('macro');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // 1. Simulación Macroeconómica
  const [macroResult, setMacroResult] = useState<MacroeconomicSimulationResult | null>(null);
  const [visitorDeltaInput, setVisitorDeltaInput] = useState<number>(20);

  // 2. Optimización de Flujos
  const [optimizationProposal, setOptimizationProposal] = useState<FlowOptimizationProposal | null>(null);
  const [optRationale, setOptRationale] = useState<string>('Aprobación técnica de dispersión de aforos hacia zonas de capacidad remanente.');
  const [approvingOpt, setApprovingOpt] = useState(false);

  // 3. Prueba de Estrés
  const [stressResult, setStressResult] = useState<StressTestExecutionResult | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<'PICO_MASIVO_MODERADO' | 'PICO_SEVERO_INMINENTE' | 'COLAPSO_EVENTO_EXTRAORDINARIO'>('PICO_SEVERO_INMINENTE');

  if (!isOpen) return null;

  const handleRunMacroSimulation = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/macro/simulate?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          scenarioTitle: `Simulación Macroeconómica (${visitorDeltaInput > 0 ? '+' : ''}${visitorDeltaInput}% afluencia)`,
          visitorDeltaPct: visitorDeltaInput
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error ejecutando simulación macroeconómica.');
      setMacroResult(data);
      setMessage({ text: 'Simulación macroeconómica calculada y persistida en PostGIS.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOptProposal = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/optimization/proposals/generate?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ criticalThresholdPct: 80 })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error generando propuesta de desvío.');
      setOptimizationProposal(data);
      setMessage({ text: 'Propuesta técnica de balanceo de flujos calculada.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyOptDecision = async (decision: 'APROBADA_OPERADOR' | 'RECHAZADA_OPERADOR') => {
    if (!optimizationProposal) return;
    setApprovingOpt(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/optimization/proposals/apply?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          proposalId: optimizationProposal.id,
          decision,
          rationale: optRationale
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error registrando decisión de optimización.');
      setMessage({ 
        text: decision === 'APROBADA_OPERADOR' 
          ? 'Medidas de desvío de flujos firmadas y aprobadas institucionalmente.' 
          : 'Propuesta de optimización rechazada por el operador.', 
        type: 'success' 
      });
      setOptimizationProposal(null);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setApprovingOpt(false);
    }
  };

  const handleRunStressTest = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/stress-test/execute?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ profile: selectedProfile })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error ejecutando prueba de estrés.');
      setStressResult(data);
      setMessage({ text: `Prueba de estrés multiescala ejecutada (${selectedProfile}).`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Iteración 15 · Motor Analítico Avanzado</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">Macroeconomía, Optimización & Estrés</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Impacto Macroeconómico, Optimización de Flujos y Estrés</h2>
              <p className="text-xs text-slate-500">
                Gasto turístico, VAB, retorno fiscal, costes de externalidades, balanceo territorial y shock testing multiescala
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
            onClick={() => setActiveTab('macro')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'macro' 
                ? 'border-purple-600 text-purple-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Coins className="w-4 h-4" />
            Impacto Macroeconómico (BASE / ESCENARIO / DELTA)
          </button>
          <button
            onClick={() => setActiveTab('optimization')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'optimization' 
                ? 'border-purple-600 text-purple-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            Optimización de Flujos y Desvío Dinámico
          </button>
          <button
            onClick={() => setActiveTab('stress')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'stress' 
                ? 'border-purple-600 text-purple-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Flame className="w-4 h-4" />
            Banco de Pruebas de Estrés (T+1 / T+4 / T+24)
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
          
          {/* PESTAÑA 1: IMPACTO MACROECONÓMICO */}
          {activeTab === 'macro' && (
            <div className="space-y-6">
              
              {/* Formulario de Simulación Macroeconómica */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Configurar Escenario de Afluencia</h4>
                  <p className="text-xs text-slate-500">Modela el retorno económico y coste de servicios públicos bajo variación de demanda</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-600">Variación Afluencia:</span>
                    <input
                      type="number"
                      step="5"
                      value={visitorDeltaInput}
                      onChange={e => setVisitorDeltaInput(Number(e.target.value))}
                      className="w-20 p-1.5 border border-slate-200 rounded-lg text-center font-bold text-xs"
                    />
                    <span className="font-bold text-slate-700">%</span>
                  </div>

                  <button
                    onClick={handleRunMacroSimulation}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Calcular Impacto Macroeconómico
                  </button>
                </div>
              </div>

              {/* Resultados Macroeconómicos BASE / ESCENARIO / DELTA */}
              {macroResult && (
                <div className="space-y-4">
                  
                  {/* Tarjetas Comparativas Principales */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Gasto Turístico Directo</span>
                      <div className="text-lg font-bold text-slate-800">
                        {macroResult.metrics.scenario.directVisitorSpendEuros.toLocaleString()} €
                      </div>
                      <div className="text-[11px] font-mono text-emerald-700 font-bold">
                        Δ {macroResult.metrics.delta.spendDiffEuros > 0 ? '+' : ''}{macroResult.metrics.delta.spendDiffEuros.toLocaleString()} € ({macroResult.metrics.delta.spendDiffPct}%)
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">VAB Turístico Total</span>
                      <div className="text-lg font-bold text-slate-800">
                        {macroResult.metrics.scenario.grossValueAddedEuros.toLocaleString()} €
                      </div>
                      <div className="text-[11px] font-mono text-indigo-700 font-bold">
                        Δ {macroResult.metrics.delta.vabDiffEuros > 0 ? '+' : ''}{macroResult.metrics.delta.vabDiffEuros.toLocaleString()} € (x{macroResult.metrics.scenario.multiplierUsed})
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Retorno Fiscal Municipal</span>
                      <div className="text-lg font-bold text-slate-800">
                        {macroResult.metrics.scenario.fiscalReturnEuros.totalFiscalRevenueEuros.toLocaleString()} €
                      </div>
                      <div className="text-[11px] font-mono text-emerald-700 font-bold">
                        Δ +{macroResult.metrics.delta.fiscalRevenueDiffEuros.toLocaleString()} €
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Coste de Externalidades</span>
                      <div className="text-lg font-bold text-amber-800">
                        {macroResult.metrics.scenario.externalitiesCostEuros.totalExternalitiesCostEuros.toLocaleString()} €
                      </div>
                      <div className="text-[11px] font-mono text-amber-700 font-bold">
                        Δ +{macroResult.metrics.delta.externalitiesDiffEuros.toLocaleString()} €
                      </div>
                    </div>
                  </div>

                  {/* Tabla Desglosada Socioeconómica */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="p-3">Indicador Macroeconómico</th>
                          <th className="p-3">Situación BASE</th>
                          <th className="p-3">ESCENARIO ({visitorDeltaInput > 0 ? '+' : ''}{visitorDeltaInput}%)</th>
                          <th className="p-3 font-bold text-purple-700">DELTA NETO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        <tr>
                          <td className="p-3 font-bold text-slate-700">Afluencia Total Modelada</td>
                          <td className="p-3">{macroResult.metrics.base.directVisitorSpendEuros / macroResult.metrics.base.averageSpendPerVisitorDayEuros} pax</td>
                          <td className="p-3">{macroResult.totalVisitorsModeled} pax</td>
                          <td className="p-3 font-bold text-purple-700">+{macroResult.totalVisitorsModeled - (macroResult.metrics.base.directVisitorSpendEuros / macroResult.metrics.base.averageSpendPerVisitorDayEuros)} pax</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-slate-700">Empleo Equivalente (ETC)</td>
                          <td className="p-3">{macroResult.metrics.base.equivalentJobsGenerated} empleos</td>
                          <td className="p-3">{macroResult.metrics.scenario.equivalentJobsGenerated} empleos</td>
                          <td className="p-3 font-bold text-emerald-700">+{macroResult.metrics.delta.jobsDiff} empleos</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-slate-700">Gasto en Restauración & Ocio</td>
                          <td className="p-3">{macroResult.metrics.base.spendByCategoryEuros.restauracion.toLocaleString()} €</td>
                          <td className="p-3">{macroResult.metrics.scenario.spendByCategoryEuros.restauracion.toLocaleString()} €</td>
                          <td className="p-3 font-bold text-indigo-700">+{(macroResult.metrics.scenario.spendByCategoryEuros.restauracion - macroResult.metrics.base.spendByCategoryEuros.restauracion).toLocaleString()} €</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-slate-700">Gasto en Alojamiento</td>
                          <td className="p-3">{macroResult.metrics.base.spendByCategoryEuros.alojamiento.toLocaleString()} €</td>
                          <td className="p-3">{macroResult.metrics.scenario.spendByCategoryEuros.alojamiento.toLocaleString()} €</td>
                          <td className="p-3 font-bold text-indigo-700">+{(macroResult.metrics.scenario.spendByCategoryEuros.alojamiento - macroResult.metrics.base.spendByCategoryEuros.alojamiento).toLocaleString()} €</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-slate-700">Coste Refuerzo Limpieza RSU</td>
                          <td className="p-3">{macroResult.metrics.base.externalitiesCostEuros.refuerzoLimpiezaResiduos.toLocaleString()} €</td>
                          <td className="p-3">{macroResult.metrics.scenario.externalitiesCostEuros.refuerzoLimpiezaResiduos.toLocaleString()} €</td>
                          <td className="p-3 font-bold text-amber-700">+{(macroResult.metrics.scenario.externalitiesCostEuros.refuerzoLimpiezaResiduos - macroResult.metrics.base.externalitiesCostEuros.refuerzoLimpiezaResiduos).toLocaleString()} €</td>
                        </tr>
                        <tr className="bg-purple-50/50">
                          <td className="p-3 font-bold text-purple-900">Beneficio Neto Socioeconómico Municipal</td>
                          <td className="p-3 font-bold text-slate-800">{macroResult.metrics.base.netSocioeconomicBenefitEuros.toLocaleString()} €</td>
                          <td className="p-3 font-bold text-slate-800">{macroResult.metrics.scenario.netSocioeconomicBenefitEuros.toLocaleString()} €</td>
                          <td className="p-3 font-bold text-purple-800">+{macroResult.metrics.delta.netBenefitDiffEuros.toLocaleString()} €</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between font-mono">
                    <span>Metodología: {macroResult.methodologyDisclaimer}</span>
                    <span>Huella SHA-256: {macroResult.evidenceFingerprintSha256.substring(0, 16)}...</span>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* PESTAÑA 2: OPTIMIZACIÓN Y DESVÍO DE FLUJOS */}
          {activeTab === 'optimization' && (
            <div className="space-y-6">
              
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Generador de Medidas de Desvío Dinámico</h4>
                  <p className="text-xs text-slate-500">Detecta zonas en riesgo de saturación y propone corredores alternativos de descongestión</p>
                </div>
                
                <button
                  onClick={handleGenerateOptProposal}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Calcular Plan de Optimización
                </button>
              </div>

              {optimizationProposal && (
                <div className="border border-purple-200 bg-purple-50/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-purple-600" />
                        Propuesta de Balanceo de Flujos Peatonales
                      </span>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Alivio proyectado en picos: <span className="font-bold text-purple-700">-{optimizationProposal.projectedPeakReliefPct}% de saturación</span>
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                      {optimizationProposal.status}
                    </span>
                  </div>

                  {/* Rutas sugeridas */}
                  <div className="space-y-2.5">
                    {optimizationProposal.suggestedRoutes.map((r, i) => (
                      <div key={i} className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-sm text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{r.corridorName}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">
                            Desvío Sugerido: {r.suggestedDiversionSharePct}%
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                          <div>• Zona Crítica Origen: <span className="font-bold text-red-600">{r.sourceZoneName}</span> ({r.sourceCurrentSaturationPct}% sat.)</div>
                          <div>• Zona Receptora Destino: <span className="font-bold text-emerald-600">{r.targetZoneName}</span> ({r.targetCurrentSaturationPct}% sat.)</div>
                        </div>

                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="font-semibold text-slate-700">Medidas e Incentivos:</span>
                          <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                            {r.incentivesSuggested.map((inc, j) => (
                              <li key={j}>{inc}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Formulario de Aprobación Humana */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">Justificación Técnica del Operador Institucional</label>
                    <textarea
                      rows={2}
                      value={optRationale}
                      onChange={e => setOptRationale(e.target.value)}
                      className="w-full text-xs font-medium p-2 border border-slate-200 rounded-lg outline-none focus:border-purple-600"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApplyOptDecision('RECHAZADA_OPERADOR')}
                        disabled={approvingOpt}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleApplyOptDecision('APROBADA_OPERADOR')}
                        disabled={approvingOpt}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {approvingOpt ? 'Firmando...' : 'Firmar y Autorizar Plan de Optimización'}
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* PESTAÑA 3: BANCO DE PRUEBAS DE ESTRÉS */}
          {activeTab === 'stress' && (
            <div className="space-y-6">
              
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Configurar Escenario de Sobrecarga Masiva</h4>
                  <p className="text-xs text-slate-500">Evalúa la resistencia territorial en T+1h, T+4h y T+24h ante picos no programados</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProfile}
                    onChange={e => setSelectedProfile(e.target.value as any)}
                    className="text-xs p-2 border border-slate-200 rounded-lg font-bold"
                  >
                    <option value="PICO_MASIVO_MODERADO">Pico Moderado (+25% a +40%)</option>
                    <option value="PICO_SEVERO_INMINENTE">Pico Severo (+45% a +75%)</option>
                    <option value="COLAPSO_EVENTO_EXTRAORDINARIO">Colapso / Evento Extraordinario (+70% a +110%)</option>
                  </select>

                  <button
                    onClick={handleRunStressTest}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Ejecutar Prueba de Estrés
                  </button>
                </div>
              </div>

              {stressResult && (
                <div className="space-y-4">
                  
                  {/* Veredicto Global de Resiliencia */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Veredicto Global de Resiliencia</span>
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mt-0.5">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                        {stressResult.globalResilienceVerdict}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">{stressResult.disclaimer}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                      Perfil: {stressResult.stressProfileName}
                    </span>
                  </div>

                  {/* Comparativa por Horizontes T+1, T+4 y T+24 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(['T+1', 'T+4', 'T+24'] as const).map(h => {
                      const outcome = stressResult.horizons[h];
                      return (
                        <div key={h} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                              <span className="text-xs font-bold text-slate-800">{h} ({outcome.horizonHours}h)</span>
                              <span className="text-[10px] text-slate-400 block font-mono">Shock: +{outcome.shockFactorPct}%</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              outcome.resilienceScorePct >= 70 ? 'bg-emerald-100 text-emerald-800' : outcome.resilienceScorePct >= 45 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {outcome.resilienceScorePct}/100 Score
                            </span>
                          </div>

                          <div className="space-y-1 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Visitantes Stressed:</span>
                              <span className="font-bold text-slate-800">{outcome.stressedVisitors.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Saturación Media:</span>
                              <span className={`font-bold ${outcome.averageSaturationPct >= 85 ? 'text-red-600' : 'text-slate-800'}`}>
                                {outcome.averageSaturationPct}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Zonas Saturadas:</span>
                              <span className="font-bold text-amber-700">{outcome.saturatedZonesCount} zonas</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Tiempo hasta Alerta:</span>
                              <span className="font-bold text-purple-700">{outcome.timeToCriticalAlertMinutes} min</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Sobrecoste Alerta:</span>
                              <span className="font-bold text-slate-700">+{outcome.externalitiesShockEuros.toLocaleString()} €</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700 block mb-0.5">Medida Preventiva:</span>
                            <p className="italic">{outcome.recommendations[0]}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Modelos analíticos de equilibrio socioeconómico e infraestructura resiliente SEGITTUR/PID.</span>
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
