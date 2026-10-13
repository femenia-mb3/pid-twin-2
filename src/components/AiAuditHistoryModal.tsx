import React, { useState, useEffect } from 'react';
import { X, History, ShieldCheck, Fingerprint, Database, UserCheck } from 'lucide-react';
import { AiProposalAuditRecord } from '../types/pilotOperations';

interface AiAuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
  tenantId: string;
}

export const AiAuditHistoryModal: React.FC<AiAuditHistoryModalProps> = ({
  isOpen,
  onClose,
  destinationId,
  destinationName,
  tenantId,
}) => {
  const [audits, setAudits] = useState<AiProposalAuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AiProposalAuditRecord | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/ai/audit?destino=${destinationId}`, {
      headers: { 'X-PID-Tenant': tenantId }
    })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data?.audits) ? data.audits : [];
        setAudits(list);
        if (list.length > 0) setSelectedAudit(list[0]);
      })
      .catch(err => console.error('Error cargando auditoría de IA:', err))
      .finally(() => setLoading(false));
  }, [isOpen, destinationId, tenantId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Auditoría Inmutable de Consultas y Propuestas IA</h2>
              <p className="text-xs text-slate-500">Destino: <span className="font-semibold text-slate-700">{destinationName}</span> · Trazabilidad de decisiones humanas y huellas de contexto</p>
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
          
          {/* Lista de Registros */}
          <div className="w-2/5 border-r border-slate-200 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Consultas Auditadas</h3>
            {loading ? (
              <p className="text-xs text-slate-400 p-2">Cargando histórico...</p>
            ) : audits.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No hay propuestas auditadas aún para este destino.</p>
            ) : (
              audits.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAudit(a)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedAudit?.id === a.id 
                      ? 'bg-white border-purple-500 shadow-sm ring-1 ring-purple-500/20' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      a.decision === 'APLICADO_SIMULADOR' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      a.decision === 'RECHAZADO' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {a.decision}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800 line-clamp-2">"{a.prompt}"</h4>
                  <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                    <UserCheck className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{a.operatorName}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detalle del Registro de Auditoría */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-white">
            {selectedAudit ? (
              <>
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                      ID: {selectedAudit.id}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {new Date(selectedAudit.createdAt).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Petición Original del Operador</span>
                    <p className="text-xs font-semibold text-slate-800 italic">"{selectedAudit.prompt}"</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-purple-600 font-semibold block uppercase">Decisión Humana</span>
                      <span className="text-xs font-bold text-purple-900 mt-0.5 block">{selectedAudit.decision}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Operador Responsable</span>
                      <span className="text-xs font-bold text-slate-700 mt-0.5 block truncate">{selectedAudit.operatorName}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Incertidumbre / Confianza</span>
                      <span className="text-xs font-bold text-slate-700 mt-0.5 block">{selectedAudit.uncertaintyLevel} ({selectedAudit.confidencePct}%)</span>
                    </div>
                  </div>
                </div>

                {/* Evidencia y Huella Criptográfica */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Evidencias Inmutables y Trazabilidad (Knowledge Guard)
                  </h4>
                  
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Fingerprint className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="font-semibold text-slate-700">Huella SHA-256 de Contexto:</span>
                      <code className="bg-white px-2 py-0.5 rounded text-[11px] font-mono text-purple-800 border border-slate-200 truncate flex-1">
                        {selectedAudit.contextFingerprint}
                      </code>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Database className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-slate-700">Versión Contextual:</span>
                      <span className="text-slate-600">{selectedAudit.contextVersion}</span>
                      {selectedAudit.syntheticDemoData && (
                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          DATOS SINTÉTICOS DEMOSTRADORES
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-600 block mb-1.5">Fuentes de Datos Autorizadas Citadas:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedAudit.dataSources.map((ds, idx) => (
                        <div key={ds.id || idx} className="p-2.5 rounded-lg border border-slate-200 bg-white flex flex-col justify-between">
                          <span className="text-xs font-semibold text-slate-800">{ds.name}</span>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                            <span className="font-mono">Calidad: {ds.dataQuality}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold">{ds.authorization}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                    <span className="font-bold text-slate-700 block mb-1">Razonamiento y Justificación de la Propuesta:</span>
                    <p className="text-slate-600 leading-relaxed">{selectedAudit.rationale}</p>
                  </div>

                  {selectedAudit.assumptions.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                      <span className="font-bold text-slate-700 block mb-1">Supuestos Asumidos:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        {selectedAudit.assumptions.map((ass, idx) => (
                          <li key={idx}>{ass}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">Selecciona un registro para ver su detalle auditado.</p>
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
