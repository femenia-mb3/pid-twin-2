import React, { useState, useEffect } from 'react';
import { X, TrendingUp, CheckCircle, Activity } from 'lucide-react';
import { ForecastCalibrationRecord } from '../types/pilotOperations';

interface ForecastCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
  tenantId: string;
}

export const ForecastCalibrationModal: React.FC<ForecastCalibrationModalProps> = ({
  isOpen,
  onClose,
  destinationId,
  destinationName,
  tenantId,
}) => {
  const [records, setRecords] = useState<ForecastCalibrationRecord[]>([]);
  const [metrics, setMetrics] = useState<Array<{ horizon: string; avgAbsoluteError: number; avgPercentageError: number; sampleCount: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/calibrations?destino=${destinationId}`, {
      headers: { 'X-PID-Tenant': tenantId }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.recentRecords) setRecords(data.recentRecords);
        if (data?.horizonMetrics) setMetrics(data.horizonMetrics);
      })
      .catch(err => console.error('Error cargando calibraciones:', err))
      .finally(() => setLoading(false));
  }, [isOpen, destinationId, tenantId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Calibración Predictiva (Predicción vs Dato Real)</h2>
              <p className="text-xs text-slate-500">Destino: <span className="font-semibold text-slate-700">{destinationName}</span> · Validación empírica de error T+1h, T+4h y T+24h</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Métricas por Horizonte */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Error Medio por Horizonte Temporal</h3>
            <div className="grid grid-cols-3 gap-4">
              {metrics.map(m => (
                <div key={m.horizon} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase font-mono">{m.horizon.replace('_', '+')}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{m.sampleCount} mediciones</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Error Medio:</span>
                      <span className="text-sm font-bold text-slate-800">±{m.avgAbsoluteError} personas</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Desvío %:</span>
                      <span className={`text-sm font-bold ${m.avgPercentageError < 5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {m.avgPercentageError}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla de Muestras Calibradas */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Registros Recientes de Calibración</h3>
            {loading ? (
              <p className="text-xs text-slate-400 p-2">Cargando mediciones...</p>
            ) : records.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No hay registros de calibración disponibles.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Zona</th>
                      <th className="py-2.5 px-3 font-semibold">Horizonte</th>
                      <th className="py-2.5 px-3 font-semibold">Predicción</th>
                      <th className="py-2.5 px-3 font-semibold">Dato Real IoT</th>
                      <th className="py-2.5 px-3 font-semibold">Error Absoluto</th>
                      <th className="py-2.5 px-3 font-semibold">Precisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-800">{r.zoneName}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-600">{r.horizon.replace('_', '+')}</td>
                        <td className="py-2.5 px-3 font-mono">{r.predictedVisitors.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono text-blue-700 font-semibold">{r.observedVisitors.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">±{r.absoluteError} ({r.percentageError}%)</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                            r.percentageError < 5 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <CheckCircle className="w-3 h-3" /> {r.calibratedConfidencePct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <Activity className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Procedimiento de Calibración Continua:</strong> Cada predicción generada se congela con su huella de modelo. Transcurrido el horizonte temporal correspondiente (T+1h o T+4h), el servicio de calibración compara automáticamente la proyección con la lectura real de los sensores IoT del destino, alimentando la curva de error del modelo.
            </p>
          </div>

        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
