import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  TrendingUp,
  ShieldAlert,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Destino, ZonaDestino } from '../types/ontology';
import { 
  ModelVariableBindingRule, 
  DestinationCoverageReport, 
  CalibrationProposal, 
  ActiveDestinationCalibration,
  ModelHistoricalAccuracySummary,
  ModelForecastRun
} from '../types/calibrationForecast';

interface ModelCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: Destino;
  tenantId: string;
  zones: ZonaDestino[];
}

export const ModelCalibrationModal: React.FC<ModelCalibrationModalProps> = ({
  isOpen,
  onClose,
  destination,
  tenantId,
  zones
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'calibration' | 'forecast_accuracy'>('rules');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // 1. Reglas y Cobertura
  const [coverageReport, setCoverageReport] = useState<DestinationCoverageReport | null>(null);
  const [rules, setRules] = useState<ModelVariableBindingRule[]>([]);
  const [creatingRule, setCreatingRule] = useState(false);
  const [selectedZoneForNewRule, setSelectedZoneForNewRule] = useState<string>(zones[0]?.id || '');
  const [sensorUrnInput, setSensorUrnInput] = useState<string>('urn:ngsi-ld:Device:malaga:counter:larios:01');
  const [unitMultiplierInput, setUnitMultiplierInput] = useState<number>(4.0); // De aforo 15m a hora
  const [sourceConnectorIdInput, setSourceConnectorIdInput] = useState<string>('conn_iot_malaga_pedestrian');

  // 2. Propuesta de Calibración
  const [calibrationProposal, setCalibrationProposal] = useState<CalibrationProposal | null>(null);
  const [activeCalibration, setActiveCalibration] = useState<ActiveDestinationCalibration | null>(null);
  const [approvingCalibration, setApprovingCalibration] = useState(false);
  const [approvalRationale, setApprovalRationale] = useState<string>('Aprobación técnica de calibración tras verificación de telemetría de aforos peatonales.');

  // 3. Predicciones y Precisión Histórica
  const [accuracySummary, setAccuracySummary] = useState<ModelHistoricalAccuracySummary | null>(null);
  const [forecastRuns, setForecastRuns] = useState<ModelForecastRun[]>([]);
  const [runningForecast, setRunningForecast] = useState(false);
  const [selectedHorizon, setSelectedHorizon] = useState<'T+1' | 'T+4' | 'T+24'>('T+4');

  const modelId = 'mod_afluencia_peatonal_ejes';

  useEffect(() => {
    if (!isOpen) return;
    loadInitialData();
  }, [isOpen, destination.id]);

  const loadInitialData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const headers: Record<string, string> = {
        'X-PID-Tenant': tenantId,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      // Cargar cobertura y reglas
      const [covRes, rulesRes, calRes, accRes, fcRes] = await Promise.all([
        fetch(`/api/calibration/coverage?destino=${destination.id}&modelId=${modelId}`, { headers }),
        fetch(`/api/calibration/rules?destino=${destination.id}&modelId=${modelId}`, { headers }),
        fetch(`/api/calibration/active?destino=${destination.id}&modelId=${modelId}`, { headers }),
        fetch(`/api/forecast/accuracy?destino=${destination.id}&modelId=${modelId}`, { headers }),
        fetch(`/api/forecast/runs?destino=${destination.id}&modelId=${modelId}`, { headers })
      ]);

      if (covRes.ok) setCoverageReport(await covRes.json());
      if (rulesRes.ok) {
        const d = await rulesRes.json();
        setRules(d.rules || []);
      }
      if (calRes.ok) {
        const d = await calRes.json();
        setActiveCalibration(d.activeCalibration);
      }
      if (accRes.ok) setAccuracySummary(await accRes.json());
      if (fcRes.ok) {
        const d = await fcRes.json();
        setForecastRuns(d.forecasts || []);
      }
    } catch (err: any) {
      console.error('Error cargando calibración:', err);
      setMessage({ text: 'Error conectando con los servicios de calibración y predicción.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    setCreatingRule(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const zoneObj = zones.find(z => z.id === selectedZoneForNewRule);

      const payload = {
        modelId,
        modelVariableId: 'visitantesHora',
        modelVariableLabel: 'Afluencia Peatonal Horaria',
        sourceType: 'IOT_MQTT',
        sourceConnectorId: sourceConnectorIdInput,
        sensorUrn: sensorUrnInput,
        targetZoneId: selectedZoneForNewRule,
        targetZoneName: zoneObj?.nombre || selectedZoneForNewRule,
        spatialCoverageType: 'EXACT_ZONE',
        expectedSourceUnit: 'peatones/15min',
        targetModelUnit: 'personas/hora',
        unitMultiplier: unitMultiplierInput,
        aggregationMethod: 'TIME_WEIGHTED_AVERAGE',
        aggregationWindowMinutes: 15,
        minQualityRequired: 'B_ESTIMADA'
      };

      const res = await fetch(`/api/calibration/rules?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.join(', ') || 'Error creando regla');

      setMessage({ text: 'Regla de vínculo formal registrada en estado BORRADOR.', type: 'success' });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setCreatingRule(false);
    }
  };

  const handleApproveRule = async (ruleId: string) => {
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/calibration/rules/${ruleId}/approval?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          state: 'APROBADO_OPERADOR',
          rationale: 'Aprobación institucional tras cotejo con inventario municipal de sensores.'
        })
      });

      if (!res.ok) throw new Error('Error aprobando regla.');
      setMessage({ text: 'Regla formal aprobada por el operador institucional.', type: 'success' });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleGenerateProposal = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/calibration/proposals/generate?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ modelId, windowMinutes: 60 })
      });

      if (!res.ok) throw new Error('Error generando propuesta de calibración.');
      const data = await res.json();
      setCalibrationProposal(data);
      setMessage({ text: 'Propuesta técnica de calibración calculada con éxito.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCalibration = async (decision: 'APROBADA' | 'RECHAZADA') => {
    if (!calibrationProposal) return;
    setApprovingCalibration(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/calibration/proposals/apply?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          proposalId: calibrationProposal.id,
          decision,
          rationale: approvalRationale
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error registrando decisión.');

      setMessage({ 
        text: decision === 'APROBADA' 
          ? 'Calibración formalmente aprobada y activada como vigente en PostGIS.' 
          : 'Propuesta de calibración rechazada.', 
        type: 'success' 
      });
      setCalibrationProposal(null);
      await loadInitialData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setApprovingCalibration(false);
    }
  };

  const handleExecuteForecast = async () => {
    setRunningForecast(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/forecast/runs?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ modelId, horizon: selectedHorizon })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error ejecutando predicción.');

      setMessage({ text: `Predicción emitida para horizonte ${selectedHorizon} y persistida con éxito.`, type: 'success' });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setRunningForecast(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 text-amber-600 flex items-center justify-center font-bold">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Iteración 14 · Gobernanza Operativa</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">Calibración & Predicción</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Calibración Real y Predicción Validable</h2>
              <p className="text-xs text-slate-500">
                Gobernanza de vínculos fuente-variable, factores calibrados con firma humana y verificación de error ex-post
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
            onClick={() => setActiveTab('rules')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'rules' 
                ? 'border-amber-600 text-amber-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Vínculos Formales y Cobertura ({coverageReport?.coveragePct || 0}%)
          </button>
          <button
            onClick={() => setActiveTab('calibration')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'calibration' 
                ? 'border-amber-600 text-amber-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Calibración de Factores (Firma Humana)
          </button>
          <button
            onClick={() => setActiveTab('forecast_accuracy')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'forecast_accuracy' 
                ? 'border-amber-600 text-amber-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Predicción Validable (T+1 / T+4 / T+24)
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

        {/* Contenido según pestaña */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* PESTAÑA 1: REGLAS FORMALES Y COBERTURA */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              
              {/* Diagnóstico de Cobertura */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Cobertura Territorial Aprobada</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-bold text-slate-800">{coverageReport?.coveragePct || 0}%</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      coverageReport?.status === 'COBERTURA_COMPLETA' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : coverageReport?.status === 'COBERTURA_PARCIAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {coverageReport?.status || 'SIN_COBERTURA'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {coverageReport?.coveredZonesCount || 0} de {coverageReport?.totalZonesCount || 0} zonas con señales activas y aprobadas.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-slate-600 font-bold block">{rules.length} Reglas Totales</span>
                  <span className="text-xs text-slate-400 block">{rules.filter(r => r.approvalState === 'APROBADO_OPERADOR').length} Aprobadas por Operador</span>
                </div>
              </div>

              {/* Formulario de Nueva Regla */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4 shadow-sm">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Declarar Nueva Regla Formal de Vínculo
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">Zona Objetivo</label>
                    <select
                      value={selectedZoneForNewRule}
                      onChange={e => setSelectedZoneForNewRule(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none font-medium"
                    >
                      {zones.map(z => (
                        <option key={z.id} value={z.id}>{z.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">Sensor URN / Identificador</label>
                    <input
                      type="text"
                      value={sensorUrnInput}
                      onChange={e => setSensorUrnInput(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">Conector ID</label>
                    <input
                      type="text"
                      value={sourceConnectorIdInput}
                      onChange={e => setSourceConnectorIdInput(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">Factor Conversión (Unidad)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={unitMultiplierInput}
                      onChange={e => setUnitMultiplierInput(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleCreateRule}
                    disabled={creatingRule}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    {creatingRule ? 'Registrando...' : 'Registrar Regla (Borrador)'}
                  </button>
                </div>
              </div>

              {/* Listado de Reglas Existentes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Inventario de Reglas Formales</h4>
                {rules.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No hay reglas de vínculo declaradas para este modelo.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {rules.map(r => (
                      <div key={r.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{r.targetZoneName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.sourceType}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              r.approvalState === 'APROBADO_OPERADOR' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {r.approvalState}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 font-mono">
                            <span>Sensor: {r.sensorUrn || r.sourceConnectorId}</span>
                            <span>• Mult: ×{r.unitMultiplier}</span>
                            <span>• Agregación: {r.aggregationMethod}</span>
                          </div>
                        </div>

                        {r.approvalState === 'BORRADOR' && (
                          <button
                            onClick={() => handleApproveRule(r.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                          >
                            Aprobar Regla
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* PESTAÑA 2: CALIBRACIÓN Y FIRMA HUMANA */}
          {activeTab === 'calibration' && (
            <div className="space-y-6">
              
              {/* Calibración Vigente Actual */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Estado de Calibración en Destino</span>
                    <h3 className="text-sm font-bold text-slate-800">
                      {activeCalibration ? `Calibración Vigente v${activeCalibration.version}` : 'Destino en Modo Paramétrico No Calibrado'}
                    </h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    activeCalibration ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {activeCalibration ? 'ACTIVA_VIGENTE' : 'SIN_CALIBRAR'}
                  </span>
                </div>

                {activeCalibration && (
                  <div className="text-xs space-y-1 text-slate-600 pt-2 border-t border-slate-200/60 font-mono">
                    <p>• Aprobada por: <span className="font-bold text-slate-800">{activeCalibration.operatorName}</span> ({activeCalibration.operatorRole})</p>
                    <p>• Rationale: <span className="italic">{activeCalibration.rationale}</span></p>
                    <p>• Huella SHA-256: <span className="text-[10px] text-slate-400">{activeCalibration.calibrationFingerprintSha256}</span></p>
                  </div>
                )}
              </div>

              {/* Botón para calcular propuesta técnica */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cálculo de Factores de Calibración Zonal</h4>
                  <p className="text-xs text-slate-500">Compara señales agregadas recientes de fuentes aprobadas con la base territorial</p>
                </div>
                <button
                  onClick={handleGenerateProposal}
                  disabled={loading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Generar Propuesta Técnica
                </button>
              </div>

              {/* Visualización de la Propuesta Técnica */}
              {calibrationProposal && (
                <div className="border border-amber-200 bg-amber-50/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Propuesta de Calibración Generada
                      </span>
                      <p className="text-xs text-slate-600 mt-0.5 font-mono">
                        Señales procesadas: {calibrationProposal.totalSignalsProcessed} • Factor medio sugerido: ×{calibrationProposal.averageFactor}
                      </p>
                    </div>
                  </div>

                  {/* Tabla de Factores Zonales */}
                  <div className="bg-white rounded-lg border border-amber-200 overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="p-2.5">Zona</th>
                          <th className="p-2.5">Base Catálogo</th>
                          <th className="p-2.5">Señal Observada</th>
                          <th className="p-2.5">Factor Sugerido</th>
                          <th className="p-2.5">Factor Acotado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {calibrationProposal.proposalsByZone.map(p => (
                          <tr key={p.zoneId} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{p.zoneName}</td>
                            <td className="p-2.5 font-mono">{p.modeledBaseValue}</td>
                            <td className="p-2.5 font-mono">{p.observedAggregateSignal}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-700">×{p.suggestedFactor}</td>
                            <td className="p-2.5 font-mono font-bold text-amber-700">×{p.appliedMultiplierClamped}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Formulario de Aprobación Humana */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">Justificación Técnica del Operador (Auditoría Inmutable)</label>
                    <textarea
                      rows={2}
                      value={approvalRationale}
                      onChange={e => setApprovalRationale(e.target.value)}
                      className="w-full text-xs font-medium p-2 border border-slate-200 rounded-lg outline-none focus:border-amber-600"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApplyCalibration('RECHAZADA')}
                        disabled={approvingCalibration}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleApplyCalibration('APROBADA')}
                        disabled={approvingCalibration}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {approvingCalibration ? 'Firmando...' : 'Firmar y Activar Calibración'}
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* PESTAÑA 3: PREDICCIÓN VALIDABLE Y ERROR EX-POST */}
          {activeTab === 'forecast_accuracy' && (
            <div className="space-y-6">
              
              {/* Emisión de Predicción Formal */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Emitir Nueva Predicción Formal</h4>
                    <p className="text-xs text-slate-500">Registra una proyección para evaluar posteriormente contra la realidad</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedHorizon}
                      onChange={e => setSelectedHorizon(e.target.value as any)}
                      className="text-xs p-2 border border-slate-200 rounded-lg font-bold"
                    >
                      <option value="T+1">Horizonte T+1 h</option>
                      <option value="T+4">Horizonte T+4 h</option>
                      <option value="T+24">Horizonte T+24 h</option>
                    </select>

                    <button
                      onClick={handleExecuteForecast}
                      disabled={runningForecast}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                      {runningForecast ? 'Emitiendo...' : 'Emitir y Registrar Predicción'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumen de Precisión Histórica (MAPE / MAE / Sesgo) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['T+1', 'T+4', 'T+24'] as const).map(h => {
                  const stat = accuracySummary?.byHorizon[h];
                  return (
                    <div key={h} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">{h} ({h === 'T+1' ? '1h' : h === 'T+4' ? '4h' : '24h'})</span>
                        <span className="text-[10px] font-mono text-slate-400">{stat?.samplesCount || 0} muestras</span>
                      </div>
                      <div className="text-xl font-bold text-slate-800">
                        {stat ? `${stat.meanAbsolutePercentageErrorPct}% MAPE` : 'Sin datos'}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span>MAE: {stat?.meanAbsoluteError || 0} pax</span>
                        <span className="font-bold text-emerald-700">{stat?.empiricalConfidencePct || 70}% Fiabilidad</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Histórico de Predicciones Registradas */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Histórico de Predicciones Registradas</h4>
                {forecastRuns.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No se han registrado predicciones formales para este modelo aún.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                    {forecastRuns.slice(0, 8).map(f => (
                      <div key={f.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{f.horizon}</span>
                            <span className="font-mono text-slate-600">{f.predictedVisitorTotal} visitantes proyectados</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              f.status === 'RECONCILIADA_CON_REALIDAD' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {f.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Emitido: {new Date(f.forecastTimestamp).toLocaleTimeString()} • Objetivo: {new Date(f.targetTimestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{f.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Toda calibración y evaluación de error se persiste con RLS y auditoría inmutable en PostGIS.</span>
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
