import React from 'react';
import { X, ShieldCheck, Database, Clock, Activity, MapPin, AlertTriangle, Building2 } from 'lucide-react';

interface ElementDetailModalProps {
  elemento: {
    tipo: 'ZONA' | 'RECURSO' | 'SENSOR' | 'RUTA' | 'EDIFICIO_CATASTRO';
    data: any;
  } | null;
  onClose: () => void;
}

export const ElementDetailModal: React.FC<ElementDetailModalProps> = ({ elemento, onClose }) => {
  if (!elemento) return null;

  const { tipo, data } = elemento;

  return (
    <div className="absolute bottom-6 left-6 z-20 w-96 max-w-[calc(100vw-3rem)] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-4 shadow-2xl text-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 rounded-lg bg-red-950/80 text-red-400 border border-red-800/50">
            {tipo === 'ZONA' && <MapPin className="w-4 h-4" />}
            {tipo === 'RECURSO' && <Database className="w-4 h-4" />}
            {tipo === 'SENSOR' && <Activity className="w-4 h-4" />}
            {tipo === 'RUTA' && <AlertTriangle className="w-4 h-4" />}
            {tipo === 'EDIFICIO_CATASTRO' && <Building2 className="w-4 h-4" />}
          </span>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {tipo === 'ZONA' && 'Polígono Territorial'}
              {tipo === 'RECURSO' && 'POI / Equipamiento'}
              {tipo === 'SENSOR' && 'Dispositivo IoT'}
              {tipo === 'RUTA' && 'Ruta de Mitigación'}
              {tipo === 'EDIFICIO_CATASTRO' && 'Pieza de edificio INSPIRE'}
            </div>
            <h4 className="text-sm font-bold text-white leading-tight">
              {tipo === 'EDIFICIO_CATASTRO'
                ? `Edificio ${data.localId || 'sin identificador'}`
                : data.nombre || `${data.origen} → ${data.destino}`}
            </h4>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2.5 text-xs">
        {/* Metadatos específicos por tipo */}
        {tipo === 'ZONA' && (
          <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
            <div>
              <span className="text-slate-400 block text-[10px]">Afluencia Actual</span>
              <span className="font-bold text-slate-100 text-sm">
                {(data.afluenciaSimulada || data.afluenciaActual).toLocaleString()} pers.
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Aforo Máximo</span>
              <span className="font-bold text-slate-100 text-sm">
                {data.aforoMaximo.toLocaleString()} pers.
              </span>
            </div>
            <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between">
              <span className="text-slate-400">Capacidad de Carga:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                (data.capacidadCargaSimuladaPct || data.capacidadCargaPct) >= 90
                  ? 'bg-red-900/60 text-red-200 border border-red-700'
                  : 'bg-emerald-900/60 text-emerald-200 border border-emerald-700'
              }`}>
                {data.capacidadCargaSimuladaPct || data.capacidadCargaPct}%
              </span>
            </div>
          </div>
        )}

        {tipo === 'RECURSO' && (
          <div className="space-y-1.5 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex justify-between">
              <span className="text-slate-400">Categoría:</span>
              <span className="font-medium text-slate-200">{data.categoria}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Visitantes/hora:</span>
              <span className="font-bold text-cyan-400">{data.visitantesSimuladosHora || data.visitantesHora}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tarifa media:</span>
              <span>{data.precioMedio === 0 ? 'Gratuito' : `${data.precioMedio} €`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Horario:</span>
              <span className="text-slate-300">{data.horario}</span>
            </div>
          </div>
        )}

        {tipo === 'SENSOR' && (
          <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Lectura en vivo:</span>
              <span className="text-base font-mono font-bold text-cyan-300">
                {data.valorSimulado !== undefined ? data.valorSimulado : data.valorActual} {data.unidad}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Umbral Alerta:</span>
              <span className="text-slate-300 font-mono">{data.umbralAlerta} {data.unidad}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Estado de telemetría:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                (data.estadoSimulado || data.estado) === 'CRITICO'
                  ? 'bg-red-900 text-red-200'
                  : 'bg-emerald-900 text-emerald-200'
              }`}>
                {data.estadoSimulado || data.estado}
              </span>
            </div>
          </div>
        )}

        {tipo === 'RUTA' && (
          <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 space-y-2">
            <p className="text-slate-300 italic">{data.descripcion}</p>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800">
              <span className="text-slate-400">Capacidad de desvío:</span>
              <span className="font-bold text-sky-400">+{data.capacidadDesvioHora} pers/h</span>
            </div>
          </div>
        )}

        {tipo === 'EDIFICIO_CATASTRO' && (
          <div className="space-y-2 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex justify-between">
              <span className="text-slate-400">Plantas sobre rasante:</span>
              <span className="font-bold text-sky-300">{data.plantas}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Altura analítica:</span>
              <span className="font-bold text-slate-100">~{data.alturaEstimada} m</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Fuente:</span>
              <span className="text-right text-slate-200">{data.fuente}</span>
            </div>
            <p className="border-t border-slate-800 pt-2 text-[10px] text-slate-500">
              Altura estimada a 3 m por planta. Debe sustituirse por altura LiDAR/MDS cuando se complete ese proceso.
            </p>
          </div>
        )}

        {/* Bloque de Gobernanza del Dato SEGITTUR (Ontología) */}
        {data.gobernanza && (
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gobernanza del Dato (SEGITTUR PID)</span>
            </div>
            <div className="flex justify-between">
              <span>Fuente:</span>
              <span className="text-slate-200 truncate max-w-[200px]" title={data.gobernanza.fuente}>
                {data.gobernanza.fuente}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Calidad del dato:</span>
              <span className="text-emerald-400 font-medium">{data.gobernanza.calidad}</span>
            </div>
            <div className="flex justify-between">
              <span>Trazabilidad ID:</span>
              <span className="font-mono text-slate-400">{data.gobernanza.trazabilidadId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Frecuencia:</span>
              <span className="inline-flex items-center space-x-1 text-slate-300">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>{data.gobernanza.frecuenciaActualizacion}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
