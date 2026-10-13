import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2, Clock, Users, AlertTriangle } from 'lucide-react';
import { OperationalProtocol } from '../types/pilotOperations';

interface OperationalProtocolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
  tenantId: string;
}

export const OperationalProtocolsModal: React.FC<OperationalProtocolsModalProps> = ({
  isOpen,
  onClose,
  destinationId,
  destinationName,
  tenantId,
}) => {
  const [protocols, setProtocols] = useState<OperationalProtocol[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<OperationalProtocol | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/protocols?destino=${destinationId}`, {
      headers: { 'X-PID-Tenant': tenantId }
    })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data?.protocols) ? data.protocols : [];
        setProtocols(list);
        if (list.length > 0) setSelectedProtocol(list[0]);
      })
      .catch(err => console.error('Error cargando protocolos:', err))
      .finally(() => setLoading(false));
  }, [isOpen, destinationId, tenantId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Protocolos Operativos ante Saturación</h2>
              <p className="text-xs text-slate-500">Destino: <span className="font-semibold text-slate-700">{destinationName}</span> · Acciones coordinadas y responsables territoriales</p>
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
        <div className="flex-1 flex overflow-hidden">
          
          {/* Lista de Protocolos */}
          <div className="w-1/3 border-r border-slate-200 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Protocolos Activos</h3>
            {loading ? (
              <p className="text-xs text-slate-400 p-2">Cargando protocolos...</p>
            ) : protocols.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No hay protocolos configurados.</p>
            ) : (
              protocols.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProtocol(p)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedProtocol?.id === p.id 
                      ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/20' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.severity === 'CRITICA' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>
                      {p.severity}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">≥ {p.triggerThresholdPct}%</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{p.name}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{p.description}</p>
                </button>
              ))
            )}
          </div>

          {/* Detalle y Secuencia de Acciones */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-white">
            {selectedProtocol ? (
              <>
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-800">{selectedProtocol.name}</h3>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> En vigor
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{selectedProtocol.description}</p>
                  
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Unidad Coordinadora</span>
                      <span className="text-xs font-bold text-slate-700 mt-0.5 block">{selectedProtocol.leadUnit}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Disparador</span>
                      <span className="text-xs font-bold text-amber-600 mt-0.5 block">{selectedProtocol.triggerType} (≥ {selectedProtocol.triggerThresholdPct}%)</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Acreditación</span>
                      <span className="text-xs font-bold text-slate-700 mt-0.5 block truncate" title={selectedProtocol.createdBy}>{selectedProtocol.createdBy}</span>
                    </div>
                  </div>
                </div>

                {/* Secuencia de Actuación */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" /> Secuencia Operativa de Actuación
                  </h4>
                  <div className="space-y-3">
                    {selectedProtocol.actionSteps.map(step => (
                      <div key={step.step} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex gap-4 items-start">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {step.step}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-800 leading-relaxed">{step.action}</p>
                          <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                              <Users className="w-3 h-3 text-slate-400" /> {step.responsibleUnit}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-400" /> ~{step.estimatedExecutionMinutes} min
                            </span>
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                              Zona: {step.targetZoneName}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 leading-relaxed">
                    <strong>Integración con el Motor de Simulación:</strong> Si una corrida o predicción proyecta una afluencia superior al umbral configurado (≥ {selectedProtocol.triggerThresholdPct}%), el gemelo alerta automáticamente al operador sugiriendo la activación escalonada de este protocolo.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">Selecciona un protocolo para ver sus pasos operativos.</p>
            )}
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
