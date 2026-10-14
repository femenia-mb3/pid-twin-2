import React, { useState, useEffect } from "react";
import { 
  X, 
  Box, 
  ShieldCheck, 
  HardDrive
} from "lucide-react";
import { Asset3DRecord } from '../types/advanced3D';

const NOMBRE_NIVEL: Record<number, string> = { 1: 'Municipio', 2: 'Mancomunidad', 3: 'Provincia', 4: 'Comunidad autónoma' };

const estiloEstado = (status: Asset3DRecord['status']) =>
  status === 'PLACEHOLDER_PENDIENTE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';

interface Assets3DCatalogModalProps {
  open: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
}

export const Assets3DCatalogModal: React.FC<Assets3DCatalogModalProps> = ({
  open,
  onClose,
  destinationId,
  destinationName,
}) => {
  const [assets, setAssets] = useState<Asset3DRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filtroNivel, setFiltroNivel] = useState<number | 'TODOS'>('TODOS');
  const [filtroFormato, setFiltroFormato] = useState<string>('TODOS');
  const [activoSeleccionado, setActivoSeleccionado] = useState<Asset3DRecord | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/3d/catalog/assets?destino=${destinationId}`)
      .then(r => r.json())
      .then(d => {
        if (d.assets) {
          setAssets(d.assets);
          if (d.assets.length > 0) setActivoSeleccionado(d.assets[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, destinationId]);

  if (!open) return null;

  const assetsFiltrados = assets.filter(a => {
    const matchNivel = filtroNivel === 'TODOS' || a.level === filtroNivel;
    const matchFormato = filtroFormato === 'TODOS' || a.format === filtroFormato;
    return matchNivel && matchFormato;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl shadow-sm">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold tracking-widest text-cyan-600 uppercase">Cartografía & 3D Abierto</span>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] font-medium text-slate-500">IGN · CNIG · PNOA · Catastro</span>
              </div>
              <h2 className="text-base font-bold text-slate-800">Catálogo de Activos 3D y 4D Territoriales ({destinationName})</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-500">Nivel Espacial:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              {(['TODOS', 1, 2, 3, 4] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setFiltroNivel(n)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    filtroNivel === n ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {n === 'TODOS' ? 'Todos' : `${n} · ${NOMBRE_NIVEL[n]}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-500">Formato Estándar:</span>
            <select
              value={filtroFormato}
              onChange={(e) => setFiltroFormato(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="TODOS">Todos los formatos OGC</option>
              <option value="OGC_3D_TILES">OGC 3D Tiles 1.1</option>
              <option value="OGC_WMS">OGC WMS (PNOA)</option>
              <option value="TMS">TMS / WMTS (IGN Base)</option>
              <option value="GEOJSON_INSPIRE">INSPIRE Building Parts</option>
              <option value="TRAFFIC_LINESTRING">GeoJSON Tráfico Temporal</option>
            </select>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Lista de Activos */}
          <div className="w-full md:w-1/2 p-4 overflow-y-auto border-r border-slate-100 space-y-2.5">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Cargando inventario de activos 3D…</div>
            ) : assetsFiltrados.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No se encontraron activos para los filtros seleccionados.</div>
            ) : (
              assetsFiltrados.map(a => {
                const isSelected = activoSeleccionado?.id === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => setActivoSeleccionado(a)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-cyan-50/70 border-cyan-300 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                            NIVEL {a.level} · {NOMBRE_NIVEL[a.level].toUpperCase()}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{a.name}</span>
                        </div>
                        {a.scopeLabel && <p className="text-[10px] font-semibold text-cyan-700 mt-0.5">{a.scopeLabel}</p>}
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{a.description}</p>
                      </div>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${estiloEstado(a.status)}`}>
                        {a.status}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{a.publisher}</span>
                      <span className="font-mono text-cyan-700 font-semibold">{a.format}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detalle y Ficha del Activo Seleccionado */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-slate-50/50 space-y-4">
            {activoSeleccionado ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider">Ficha Técnica & Gobernanza</span>
                  <h3 className="text-base font-bold text-slate-800 mt-0.5">{activoSeleccionado.name}</h3>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{activoSeleccionado.description}</p>
                  {activoSeleccionado.scopeLabel && <p className="text-[11px] font-semibold text-cyan-700 mt-1">Ámbito: {activoSeleccionado.scopeLabel}</p>}
                  {activoSeleccionado.status === 'PLACEHOLDER_PENDIENTE' && <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">Entrada de marcador: el activo aún no está ingerido. El endpoint y la huella son provisionales.</p>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Organismo Publicador</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{activoSeleccionado.publisher}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Licencia Abierta</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{activoSeleccionado.license}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Sistema de Referencia (CRS)</span>
                    <span className="font-mono font-bold text-indigo-700 mt-0.5 block">{activoSeleccionado.crs}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Resolución / Densidad</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{activoSeleccionado.resolutionOrDensity}</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 text-[11px]">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Endpoint / Ruta del Recurso</span>
                  <code className="block bg-slate-50 p-1.5 rounded font-mono text-[10px] text-slate-700 break-all select-all">
                    {activoSeleccionado.endpointUrl}
                  </code>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 text-[11px]">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Huella Criptográfica SHA-256</span>
                  <code className="block bg-slate-50 p-1.5 rounded font-mono text-[10px] text-cyan-800 break-all select-all">
                    {activoSeleccionado.fingerprintSha256}
                  </code>
                </div>

                <div className="flex items-center justify-between p-3 bg-cyan-50/70 border border-cyan-200 rounded-lg text-[11px]">
                  <div className="flex items-center space-x-2 text-cyan-800">
                    <HardDrive className="w-4 h-4" />
                    <span>Fallback local en caso de pérdida de GPU / WebGL</span>
                  </div>
                  <span className="font-bold text-cyan-900">
                    {activoSeleccionado.isOfflineFallbackAvailable ? 'Habilitado' : 'No requerido'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400">
                Seleccione un activo para consultar sus detalles técnicos.
              </div>
            )}
          </div>

        </div>

        {/* Pie */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Todos los activos corresponden a estándares abiertos OGC y datos públicos oficiales.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
