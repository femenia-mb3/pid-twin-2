import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { IndicatorChatPanel } from './IndicatorChatPanel';
import { ContextoIndicadores } from '../services/indicatorQa';

interface AiSimulationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  destinationName: string;
  tenantId: string;
  /** Instantánea de indicadores del destino para responder preguntas. */
  contextoIndicadores: ContextoIndicadores;
}

export const AiSimulationDrawer: React.FC<AiSimulationDrawerProps> = ({
  isOpen,
  onClose,
  destinationName,
  tenantId,
  contextoIndicadores,
}) => {
  if (!isOpen) return null;

  return (
    // Sin fondo atenuado ni desenfoque: el mapa sigue visible e interactivo junto al panel.
    <div className="pointer-events-none fixed inset-0 z-50 flex justify-end">
      <div className="pointer-events-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">

        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800">Asistente IA de indicadores</h2>
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

        <div className="min-h-0 flex-1">
          <IndicatorChatPanel context={contextoIndicadores} />
        </div>

      </div>
    </div>
  );
};
