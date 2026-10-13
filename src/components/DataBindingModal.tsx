import React, { useState, useEffect } from 'react';
import { 
  X, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  ArrowRight, 
  Save, 
  ShieldCheck, 
  Sparkles
} from 'lucide-react';
import { 
   
  ModelExecutionReadiness, 
  OperationalConnectorDefinition 
} from '../types/operationalConfiguration';

interface DataBindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  tenantId: string;
  modelId: string;
  modelTitle: string;
}

export const DataBindingModal: React.FC<DataBindingModalProps> = ({
  isOpen,
  onClose,
  destinationId,
  tenantId,
  modelId,
  modelTitle,
}) => {
  const [connectors, setConnectors] = useState<OperationalConnectorDefinition[]>([]);
  const [readiness, setReadiness] = useState<ModelExecutionReadiness | null>(null);
  const [, setLoading] = useState(false);
  const [selectedConnectorId, setSelectedConnectorId] = useState('');
  const [selectedVariableId, setSelectedVariableId] = useState('');
  const [sourceField, setSourceField] = useState('');
  const [transformation, setTransformation] = useState<'DIRECT' | 'MULTIPLY' | 'DIVIDE' | 'AVERAGE' | 'PEAK' | 'PERCENTAGE'>('DIRECT');
  const [transformationArg, setTransformationArg] = useState<number | undefined>(undefined);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReadinessAndConnectors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const headers: Record<string, string> = {
        'X-PID-Tenant': tenantId,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const [connRes, readRes] = await Promise.all([
        fetch(`/api/connectors?destino=${destinationId}`, { headers }),
        fetch(`/api/models/${modelId}/readiness?destino=${destinationId}`, { headers })
      ]);

      if (connRes.ok) {
        const cData = await connRes.json();
        setConnectors(cData.connectors || []);
        if (cData.connectors && cData.connectors.length > 0 && !selectedConnectorId) {
          setSelectedConnectorId(cData.connectors[0].id);
        }
      }

      if (readRes.ok) {
        const rData = await readRes.json();
        setReadiness(rData);
        if (rData.blockingIssues && rData.blockingIssues.length > 0 && !selectedVariableId) {
          setSelectedVariableId(rData.blockingIssues[0].variableId);
        }
      }
    } catch (err: any) {
      console.error('Error cargando vínculos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReadinessAndConnectors();
    }
  }, [isOpen, destinationId, modelId]);

  if (!isOpen) return null;

  const handleSaveBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariableId || !selectedConnectorId || !sourceField) {
      setMessage({ text: 'Todos los campos marcados con asterisco son obligatorios.', type: 'error' });
      return;
    }

    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const selectedConn = connectors.find(c => c.id === selectedConnectorId);

      const response = await fetch(`/api/bindings?destino=${destinationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          modelId,
          modelTitle,
          modelVariableId: selectedVariableId,
          modelVariableLabel: selectedVariableId,
          required: true,
          connectorId: selectedConnectorId,
          connectorName: selectedConn?.name || 'Conector Asignado',
          connectorStatus: selectedConn?.status || 'ACTIVO_VERIFICADO',
          sourceField,
          transformation,
          transformationArg,
          unit: 'unidades',
          frequency: selectedConn?.updateFrequency || 'Diaria',
          qualityLevel: 'A_CERTIFICADA',
          availability: selectedConn?.status === 'ACTIVO_VERIFICADO' ? 'DISPONIBLE' : 'PENDIENTE_AUTORIZACION',
          active: true
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error asociando el vínculo de datos.');
      }

      setMessage({ text: `Vínculo para la variable «${selectedVariableId}» guardado en PostGIS.`, type: 'success' });
      await fetchReadinessAndConnectors();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Iteración 11 · Cadena de Evidencia</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">Dato → Conector → Variable → Modelo</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Vínculos de Datos para «{modelTitle}»</h2>
              <p className="text-xs text-slate-500">Garantiza que toda variable del modelo esté respaldada por una fuente autorizada y verificable</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel de Estado de Preparación */}
        {readiness && (
          <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${readiness.isReadyToExecute ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {readiness.isReadyToExecute ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-xs font-bold block text-slate-800">
                  {readiness.isReadyToExecute ? 'Modelo Listo para Ejecución Auditada' : 'Simulación Bloqueada por Requisitos Incompletos'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Variables obligatorias cubiertas: {readiness.satisfiedRequiredVariables} de {readiness.totalRequiredVariables}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                readiness.isReadyToExecute 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {readiness.isReadyToExecute ? 'EJECUCIÓN PERMITIDA' : 'BLOQUEADO: REQUIERE CONEXIÓN'}
              </span>
            </div>
          </div>
        )}

        {/* Notificaciones */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Contenido principal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Bloqueos o Alertas actuales */}
          {readiness && readiness.blockingIssues.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Carencias que impiden la simulación del modelo
              </span>
              <div className="space-y-1.5">
                {readiness.blockingIssues.map((issue, idx) => (
                  <div key={idx} className="text-xs text-amber-800 flex items-center justify-between p-2 rounded-lg bg-white border border-amber-200">
                    <span className="font-semibold">{issue.message}</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedVariableId(issue.variableId)}
                      className="text-[10px] text-indigo-700 underline font-bold hover:text-indigo-900"
                    >
                      Asignar ahora
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulario de Asignación de Vínculo */}
          <form onSubmit={handleSaveBinding} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" /> Asignar Fuente / Conector a Variable
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Variable del Modelo *</label>
                <input 
                  type="text" 
                  value={selectedVariableId}
                  onChange={e => setSelectedVariableId(e.target.value)}
                  placeholder="Ej. visitantesHora"
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Conector Operativo *</label>
                <select 
                  value={selectedConnectorId}
                  onChange={e => setSelectedConnectorId(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">Seleccione conector...</option>
                  {connectors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Campo Fuente *</label>
                <input 
                  type="text" 
                  value={sourceField}
                  onChange={e => setSourceField(e.target.value)}
                  placeholder="Ej. conteo_personas"
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Transformación de Entrada</label>
                <select 
                  value={transformation}
                  onChange={e => setTransformation(e.target.value as any)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="DIRECT">Directa (sin alteración)</option>
                  <option value="MULTIPLY">Multiplicar por factor</option>
                  <option value="DIVIDE">Dividir por factor</option>
                  <option value="PERCENTAGE">Convertir a porcentaje (0-100)</option>
                  <option value="AVERAGE">Promedio temporal</option>
                </select>
              </div>

              {transformation !== 'DIRECT' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Factor / Argumento numérico</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={transformationArg || ''}
                    onChange={e => setTransformationArg(Number(e.target.value))}
                    placeholder="1.0"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                className="px-4 py-2 bg-indigo-700 text-white rounded-xl text-xs font-bold hover:bg-indigo-800 flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-4 h-4" /> Guardar Vínculo
              </button>
            </div>
          </form>

          {/* Tabla de Vínculos Configurados */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block flex items-center justify-between">
              <span>Mapa Activo de Vínculos para este Destino</span>
              <span className="text-[10px] text-slate-500 font-normal">Persistido en PostGIS con RLS</span>
            </span>

            {readiness && readiness.bindings.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                No hay vínculos de datos configurados todavía para este modelo.
              </div>
            ) : (
              <div className="space-y-2">
                {readiness?.bindings.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-800 font-mono">{b.sourceField}</span>
                      <span className="text-[10px] text-slate-400">({b.connectorName})</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-indigo-700 font-mono">{b.modelVariableId}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">
                        {b.transformation}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        b.connectorStatus === 'ACTIVO_VERIFICADO' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.connectorStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Pie */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> El motor de simulación rechazará ejecuciones si faltan fuentes obligatorias.
          </span>
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
