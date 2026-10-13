import React, { useEffect, useState } from 'react';
import { 
  X, 
  Database, 
  Layers, 
  Car, 
} from 'lucide-react';
import { OpenDataCatalogResponse, TrafficFlowSegment } from '../types/openData';

interface OpenDataLayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
}

export const OpenDataLayersModal: React.FC<OpenDataLayersModalProps> = ({
  isOpen,
  onClose,
  destinationId,
  destinationName,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'traffic'>('catalog');
  const [catalog, setCatalog] = useState<OpenDataCatalogResponse | null>(null);
  const [trafficSegments, setTrafficSegments] = useState<TrafficFlowSegment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/geo/open-data/catalog?destino=${destinationId}`).then(res => res.json()),
      fetch(`/api/geo/open-data/traffic?destino=${destinationId}`).then(res => res.json())
    ])
      .then(([catalogData, trafficData]) => {
        setCatalog(catalogData);
        if (trafficData.features) {
          setTrafficSegments(trafficData.features.map((f: any) => ({
            id: f.id,
            nombreVia: f.properties.nombreVia,
            nivelCongestion: f.properties.nivelCongestion,
            velocidadMediaKmh: f.properties.velocidadMediaKmh,
            intensidadVehiculosHora: f.properties.intensidadVehiculosHora,
            coordenadas: f.geometry.coordinates,
            fuente: f.properties.fuente,
            timestamp: f.properties.timestamp
          })));
        }
      })
      .catch(err => {
        console.error('Error cargando catálogo de datos abiertos:', err);
      })
      .finally(() => setLoading(false));
  }, [isOpen, destinationId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-700 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">Iteración 10 · Datos Abiertos & 3D Realista</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 font-semibold text-emerald-800">100% Open Source</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Repositorio de Datos Abiertos · {destinationName}</h2>
              <p className="text-xs text-slate-500">Servicios cartográficos oficiales OGC, INSPIRE, Catastro, PNOA y sensores de tráfico</p>
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
            onClick={() => setActiveTab('catalog')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'catalog' 
                ? 'border-cyan-600 text-cyan-700' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Fuentes OGC Oficiales ({catalog?.totalSources || 5})
          </button>
          <button
            onClick={() => setActiveTab('traffic')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'traffic' 
                ? 'border-cyan-600 text-cyan-700' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            Red de Tráfico y Movilidad ({trafficSegments.length} Tramos)
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Consultando metadatos de servicios abiertos...</div>
          ) : activeTab === 'catalog' ? (
            <div className="space-y-3">
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-900 leading-relaxed">
                <strong>Arquitectura Geoespacial Abierta:</strong> En cumplimiento de las directrices institucionales, todos los datos consumidos por el gemelo (ortoimágenes, elevaciones MDT, nubes LiDAR y envolventes catastrales) se sirven mediante protocolos interoperables de la IDE de España y licencias públicas CC-BY 4.0.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(catalog?.sources || []).map(source => (
                  <div key={source.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 hover:border-cyan-300 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">{source.name}</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                        {source.serviceType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{source.description}</p>
                    
                    <div className="pt-2 border-t border-slate-100 space-y-1 text-[10px] text-slate-500">
                      <div className="flex justify-between">
                        <span>Organismo:</span>
                        <b className="text-slate-700">{source.publisher}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Estándar:</span>
                        <b className="text-slate-700">{source.openSourceStandard}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Licencia:</span>
                        <b className="text-emerald-700">{source.license}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Resolución:</span>
                        <b className="text-slate-700">{source.resolutionOrDensity}</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                <strong>Aforos y Movilidad Abierta:</strong> Red de flujo vehicular y peatonal utilizada por el motor de simulación para modelar cuellos de botella en accesos a cascos históricos, terminales portuarias y recursos turísticos clave.
              </div>

              <div className="space-y-2">
                {trafficSegments.map(segment => {
                  const badgeColor = segment.nivelCongestion === 'CONGESTIONADO' ? 'bg-red-100 text-red-800 border-red-200'
                                   : segment.nivelCongestion === 'DENSO' ? 'bg-orange-100 text-orange-800 border-orange-200'
                                   : segment.nivelCongestion === 'MODERADO' ? 'bg-amber-100 text-amber-800 border-amber-200'
                                   : 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  return (
                    <div key={segment.id} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{segment.nombreVia}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                            {segment.nivelCongestion}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">{segment.fuente}</p>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="text-xs font-bold text-slate-800 font-mono">{segment.velocidadMediaKmh} km/h</div>
                        <div className="text-[10px] text-slate-500">{segment.intensidadVehiculosHora} veh/h</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Servicios interoperables verificados mediante especificación OGC WMS/WMTS e INSPIRE.</span>
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
