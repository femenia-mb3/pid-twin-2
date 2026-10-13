import React from 'react';
import { X, Building2, ShieldCheck, CheckCircle2, AlertCircle, FileText, Camera, Globe, Lock } from 'lucide-react';
import { Edificio3DRecord } from '../services/catalog3DService';

interface OleadaDetailModalProps {
  edificio: Edificio3DRecord | null;
  onClose: () => void;
  onFocusEdificio?: (edificio: Edificio3DRecord) => void;
}

export const OleadaDetailModal: React.FC<OleadaDetailModalProps> = ({ edificio, onClose, onFocusEdificio }) => {
  if (!edificio) return null;

  const renderQaBadge = (estado: string) => {
    switch (estado) {
      case 'APROBADO_QA':
        return (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> QA Aprobado
          </span>
        );
      case 'CAPTURADO':
        return (
          <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 flex items-center gap-1">
            <Camera className="h-3 w-3 text-sky-600" /> Capturado (En procesado)
          </span>
        );
      default:
        return (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-amber-600" /> Especificado
          </span>
        );
    }
  };

  const renderDifusionBadge = (difusion: string) => {
    switch (difusion) {
      case 'publica':
        return (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 flex items-center gap-1">
            <Globe className="h-3 w-3 text-slate-500" /> Difusión Pública
          </span>
        );
      case 'restringida_seguridad':
        return (
          <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 flex items-center gap-1">
            <Lock className="h-3 w-3 text-rose-600" /> Restringida (Seguridad)
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 flex items-center gap-1">
            <Lock className="h-3 w-3 text-slate-500" /> Uso Interno Municipal
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-pink-50 p-2 text-pink-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-700 uppercase tracking-wider">
                  Fase 2 · Primera Oleada
                </span>
                {renderQaBadge(edificio.estadoQa)}
                {renderDifusionBadge(edificio.clasificacionDifusion)}
              </div>
              <h3 className="mt-1 text-sm font-bold text-slate-800">{edificio.nombre}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-xs text-slate-600">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Organismo Titular</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{edificio.titularOrganismo}</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Permisos Operacionales UAS</span>
              <span className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {edificio.permisoEstado} (Escenario STS-01 AESA)
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
              <FileText className="h-3 w-3 text-cyan-600" /> Finalidad y Valor en el Gemelo
            </span>
            <p className="mt-1 leading-relaxed text-slate-700">{edificio.finalidadGemelo}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-xs">
              <span className="text-[10px] text-slate-400 block">GSD Objetivo</span>
              <span className="font-mono font-bold text-slate-800 text-xs">{edificio.gsdObjetivoCm} cm/px</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-xs">
              <span className="text-[10px] text-slate-400 block">Altura Cumbrera</span>
              <span className="font-mono font-bold text-slate-800 text-xs">{edificio.alturaCumbreraM} m</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-xs">
              <span className="text-[10px] text-slate-400 block">Superficie Envolvente</span>
              <span className="font-mono font-bold text-slate-800 text-xs">{edificio.superficieM2.toLocaleString()} m²</span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Protocolo Operativo de Captura:</span>
              <p className="mt-0.5 text-amber-800 leading-relaxed">{edificio.notasOperativas}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[10px] font-mono text-slate-400">Ref Catastral: {edificio.buildingIdCatastro || '29900A001'}</span>
          <div className="flex gap-2">
            {onFocusEdificio && (
              <button
                onClick={() => {
                  onFocusEdificio(edificio);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-pink-700 transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Centrar en Visor 3D</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
