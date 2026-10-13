import { useState, useEffect } from 'react';
import {
  Globe,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  RotateCcw,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import {
  GoogleGeoConnectorConfig,
  GoogleGeoModuleDefinition,
  GoogleGeoPrevalidationRequest,
  GoogleGeoAuditQueryRecord,
} from '../types/googleGeoSuite';

interface GoogleGeoSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  destinationName: string;
  tenantId: string;
  onToggleVisualProvider?: (provider: 'PID_OPEN_DATA' | 'GOOGLE_PHOTOREALISTIC_3D') => void;
}

export function GoogleGeoSuiteModal({
  isOpen,
  onClose,
  destinationId,
  destinationName,
  tenantId,
  onToggleVisualProvider,
}: GoogleGeoSuiteModalProps) {
  const [activeTab, setActiveTab] = useState<'gobernanza' | 'modulos' | 'prevalidacion' | 'auditoria'>('gobernanza');
  const [loading, setLoading] = useState<boolean>(false);
  const [config, setConfig] = useState<GoogleGeoConnectorConfig | null>(null);
  const [modules, setModules] = useState<GoogleGeoModuleDefinition[]>([]);
  const [auditLogs, setAuditLogs] = useState<GoogleGeoAuditQueryRecord[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Formulario de prevalidación
  const [authorizedEntity, setAuthorizedEntity] = useState<string>(`Ayuntamiento de ${destinationName} - Área de Turismo e Innovación`);
  const [targetZoneId, _setTargetZoneId] = useState<string>(destinationId === 'malaga' ? 'malaga-centro' : 'palma-centro');
  const [targetZoneName, setTargetZoneName] = useState<string>(destinationId === 'malaga' ? 'Centro Histórico y Puerto' : 'Centro Histórico y Catedral');
  const [purpose, setPurpose] = useState<'VISUALIZACION_FOTORREALISTA' | 'INSPECCION_PATRIMONIAL' | 'ANALISIS_TERRITORIAL_WHAT_IF'>('VISUALIZACION_FOTORREALISTA');
  const [acceptedTerms, setAcceptedTerms] = useState({
    attributionVisible: true,
    noTileCachingOrStorage: true,
    humanSupervisionOnly: true,
    segitturDataSovereigntyAccepted: true,
  });
  const [technicalNotes, setTechnicalNotes] = useState<string>('Prevalidación para habilitar Cesium 3D Tiles de Google con fines de inspección y contextualización fotorrealista.');

  useEffect(() => {
    if (!isOpen) return;
    loadStatus();
    loadModules();
    loadAudit();
  }, [isOpen, destinationId]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('pid_jwt_token') || sessionStorage.getItem('pid_jwt_token');
    return {
      'Content-Type': 'application/json',
      'X-PID-Tenant': tenantId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/google-geo/status?destino=${destinationId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Error cargando estado Google Geo Suite:', err);
    }
  };

  const loadModules = async () => {
    try {
      const res = await fetch('/api/google-geo/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
      }
    } catch (err) {
      console.error('Error cargando catálogo de módulos:', err);
    }
  };

  const loadAudit = async () => {
    try {
      const res = await fetch(`/api/google-geo/audit?destino=${destinationId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.auditLogs || []);
      }
    } catch (err) {
      console.error('Error cargando auditoría Google Geo:', err);
    }
  };

  const handlePrevalidate = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const payload: GoogleGeoPrevalidationRequest = {
        destinationId,
        tenantId,
        authorizedEntity,
        targetZoneId,
        targetZoneName,
        purpose,
        acceptedTerms,
        technicalNotes,
      };

      const res = await fetch(`/api/google-geo/prevalidate?destino=${destinationId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setNotification({ type: 'success', message: 'Prevalidación institucional registrada y aprobada formalmente en PostGIS.' });
        loadStatus();
        loadAudit();
        setActiveTab('gobernanza');
      } else {
        setNotification({ type: 'error', message: data.error || 'Error al procesar la prevalidación.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGoogle3D = async (enable: boolean) => {
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/google-geo/toggle?destino=${destinationId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enableGoogle3D: enable }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          message: enable
            ? 'Google Photorealistic 3D Tiles activado con sobre de evidencia sellado en auditoría.'
            : 'Desactivado. Retorno garantizado al visor PID Open Data (PNOA / Catastro).',
        });
        loadStatus();
        loadAudit();
        if (onToggleVisualProvider) {
          onToggleVisualProvider(data.currentVisualProvider);
        }
      } else {
        setNotification({ type: 'error', message: data.error || 'Error al conmutar proveedor visual.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Encabezado Institucional */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">PID · SEGITTUR · GOOGLE GEO SUITE</span>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-400/30">
                  Gobernanza & Soberanía
                </span>
              </div>
              <h2 className="text-base font-bold text-white">
                Google Geo Suite Gobernado — Destino {destinationName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notificaciones */}
        {notification && (
          <div className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between ${
            notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-red-50 text-red-800 border-b border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">×</button>
          </div>
        )}

        {/* Pestañas de Navegación */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('gobernanza')}
            className={`border-b-2 py-3 px-4 transition-colors ${
              activeTab === 'gobernanza' ? 'border-blue-600 text-blue-700 font-bold bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Gobernanza & Visor 3D
          </button>
          <button
            onClick={() => setActiveTab('modulos')}
            className={`border-b-2 py-3 px-4 transition-colors ${
              activeTab === 'modulos' ? 'border-blue-600 text-blue-700 font-bold bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Catálogo de Capacidades ({modules.length})
          </button>
          <button
            onClick={() => setActiveTab('prevalidacion')}
            className={`border-b-2 py-3 px-4 transition-colors ${
              activeTab === 'prevalidacion' ? 'border-blue-600 text-blue-700 font-bold bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Prevalidación Institucional
          </button>
          <button
            onClick={() => setActiveTab('auditoria')}
            className={`border-b-2 py-3 px-4 transition-colors ${
              activeTab === 'auditoria' ? 'border-blue-600 text-blue-700 font-bold bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Registro de Auditoría Inmutable ({auditLogs.length})
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {/* TAB 1: GOBERNANZA & VISOR 3D */}
          {activeTab === 'gobernanza' && (
            <div className="space-y-6">
              
              {/* Tarjeta de Estado del Conector */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Estado del Conector Territorial</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                        config?.status === 'ACTIVO_VERIFICADO'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : config?.status === 'APROBADO_PILOTO'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {config?.status || 'DESHABILITADO'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Proveedor Visual Activo: <strong>{config?.currentVisualProvider === 'GOOGLE_PHOTOREALISTIC_3D' ? 'Google Photorealistic 3D (Cesium)' : 'PID Open Data (IGN/PNOA/Catastro)'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {config?.currentVisualProvider === 'GOOGLE_PHOTOREALISTIC_3D' ? (
                      <button
                        onClick={() => handleToggleGoogle3D(false)}
                        disabled={loading}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                        Volver a PID Open Data (Fallback)
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleGoogle3D(true)}
                        disabled={loading || !config?.prevalidation || config?.prevalidation.status !== 'APROBADO_PILOTO'}
                        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition-colors shadow-sm ${
                          config?.prevalidation?.status === 'APROBADO_PILOTO'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-slate-300 cursor-not-allowed text-slate-500'
                        }`}
                        title={config?.prevalidation?.status !== 'APROBADO_PILOTO' ? 'Requiere prevalidación formal previa' : 'Activar visualización fotorrealista'}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        Activar Google Photorealistic 3D
                      </button>
                    )}
                  </div>
                </div>

                {/* Resumen de Prevalidación Vigente */}
                {config?.prevalidation ? (
                  <div className="mt-4 rounded-lg bg-blue-50/70 p-3.5 border border-blue-100 text-xs">
                    <div className="flex items-center justify-between text-blue-900 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <FileCheck2 className="h-4 w-4 text-blue-600" />
                        Prevalidación Piloto en Vigor ({config.prevalidation.id})
                      </span>
                      <span className="text-[10px] text-blue-600 font-medium">Expira: {new Date(config.prevalidation.expiresAt).toLocaleDateString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px] mt-2">
                      <div><strong>Entidad Autorizada:</strong> {config.prevalidation.authorizedEntity}</div>
                      <div><strong>Zona Habilitada:</strong> {config.prevalidation.targetZoneName}</div>
                      <div><strong>Finalidad Lícita:</strong> {config.prevalidation.purpose}</div>
                      <div><strong>Operador Responsable:</strong> {config.prevalidation.reviewedBy.operatorName} ({config.prevalidation.reviewedBy.operatorRole})</div>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-slate-500 truncate">
                      Huella SHA-256: {config.prevalidation.fingerprintSha256}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">No hay prevalidación aprobada para este destino.</div>
                      <div className="text-[11px] text-amber-700 mt-0.5">
                        Para cumplir con la gobernanza institucional de SEGITTUR, diríjase a la pestaña <strong>3. Prevalidación Institucional</strong> para formalizar la autorización antes de activar el visor 3D fotorrealista.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Principios de Soberanía y Garantías */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Soberanía del Dato PID
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Todos los modelos de predicción, simulaciones what-if y ontologías turísticas residen en PostGIS. Google opera exclusivamente como capa visual complementaria bajo demanda.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                    <RotateCcw className="h-4 w-4 text-blue-600" />
                    Fallback Garantizado
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    En caso de fallo de red, expiración o falta de cuota en Google, el sistema conmuta automáticamente a la cartografía abierta (PNOA LiDAR / Catastro / Leaflet) sin interrumpir la operación.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                    <Info className="h-4 w-4 text-purple-600" />
                    No Persistencia de Mallas
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Conforme a las directrices de Google Maps Tile API, no se almacenan ni redistribuyen geometrías 3D en servidores locales ni bases de datos de la PID.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CATÁLOGO DE MÓDULOS */}
          {activeTab === 'modulos' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200 flex items-center justify-between">
                <span>Catálogo de servicios evaluados de la suite Google Maps Platform para enriquecimiento del Gemelo PID.</span>
                <span className="font-bold">5 Módulos Definidos</span>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {modules.map((mod) => (
                  <div key={mod.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          mod.status === 'DISPONIBLE_ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {mod.status === 'DISPONIBLE_ACTIVO' ? 'ACTIVO EN PILOTO' : 'PREPARADO / EN RESERVA'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm">{mod.name}</h3>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{mod.category}</span>
                    </div>

                    <p className="mt-2 text-slate-600 leading-relaxed text-[11px]">{mod.description}</p>

                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5 text-[11px]">
                      <div>
                        <span className="font-bold text-slate-700">Rol de Enriquecimiento:</span>
                        <p className="text-slate-500 mt-0.5">{mod.enrichmentRole}</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">Gobernanza & Salpicadura:</span>
                        <p className="text-slate-500 mt-0.5">{mod.governanceRequirement}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 bg-slate-50 p-2 rounded">
                      <span>Atribución Requerida: <em>{mod.attributionText}</em></span>
                      <span className="font-mono text-emerald-700 font-semibold">{mod.nonPersistenceRule}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PREVALIDACIÓN INSTITUCIONAL */}
          {activeTab === 'prevalidacion' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 text-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Formulario de Prevalidación Institucional</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  El protocolo de gobernanza exige que un operador cualificado certifique las condiciones antes de encender el fotorrealismo de Google.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Entidad Responsable Solicitante</label>
                  <input
                    type="text"
                    value={authorizedEntity}
                    onChange={(e) => setAuthorizedEntity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Zona Territorial Delimitada</label>
                  <input
                    type="text"
                    value={targetZoneName}
                    onChange={(e) => setTargetZoneName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Finalidad Operativa Declarada</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="VISUALIZACION_FOTORREALISTA">Visualización Fotorrealista de Edificios Singulares y Cubiertas (Cesium)</option>
                  <option value="INSPECCION_PATRIMONIAL">Inspección Patrimonial y Evaluación de Fachadas Históricas</option>
                  <option value="ANALISIS_TERRITORIAL_WHAT_IF">Análisis Territorial Complementario para What-If de Flujos</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Memoria Técnica Justificativa</label>
                <textarea
                  rows={3}
                  value={technicalNotes}
                  onChange={(e) => setTechnicalNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Compromisos de Gobernanza */}
              <div className="space-y-2 rounded-lg bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-bold text-slate-800 block text-xs">Compromisos de Cumplimiento Normativo (Obligatorios):</span>
                
                <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms.attributionVisible}
                    onChange={(e) => setAcceptedTerms({ ...acceptedTerms, attributionVisible: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Garantizar atribución visible y legible de Google y proveedores de cartografía en pantalla.</span>
                </label>

                <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms.noTileCachingOrStorage}
                    onChange={(e) => setAcceptedTerms({ ...acceptedTerms, noTileCachingOrStorage: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Certificar que no se realizará descarga masiva, almacenamiento local ni redistribución de teselas 3D.</span>
                </label>

                <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms.humanSupervisionOnly}
                    onChange={(e) => setAcceptedTerms({ ...acceptedTerms, humanSupervisionOnly: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Mantener en todo momento supervisión humana; no aplicar cambios de aforo de forma automatizada por Google.</span>
                </label>

                <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms.segitturDataSovereigntyAccepted}
                    onChange={(e) => setAcceptedTerms({ ...acceptedTerms, segitturDataSovereigntyAccepted: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Preservar la soberanía del módulo común de la Plataforma Inteligente de Destinos (SEGITTUR).</span>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handlePrevalidate}
                  disabled={loading || !acceptedTerms.attributionVisible || !acceptedTerms.noTileCachingOrStorage}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:bg-slate-300"
                >
                  {loading ? 'Firmando y Registrando...' : 'Firmar y Registrar Prevalidación Institucional'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: AUDITORÍA INMUTABLE */}
          {activeTab === 'auditoria' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Histórico inmutable sellado criptográficamente en tabla <code>google_geo_auditoria_consultas</code>.</span>
                <span className="font-bold text-slate-800">{auditLogs.length} Registros Auditados</span>
              </div>

              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          log.status === 'AUTORIZADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.status}
                        </span>
                        <span className="font-bold text-slate-800">{log.purpose}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(log.requestedAt).toLocaleString()}</span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                      <div><strong>Operador:</strong> {log.operatorName}</div>
                      <div><strong>Módulo:</strong> {log.moduleId}</div>
                      <div><strong>Destino:</strong> {destinationName}</div>
                    </div>

                    <div className="mt-2 text-[10px] font-mono text-slate-400 truncate bg-slate-50 p-1.5 rounded">
                      SHA-256: {log.evidenceSha256} | Atribución: {log.attributionRendered}
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">No hay consultas registradas todavía en la auditoría.</div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Pie Institucional con Atribución Obligatoria */}
        <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-bold text-slate-700">Atribución Requerida:</span>
            <span>Imagery ©2026 Google | Datos Territoriales Plataforma Inteligente de Destinos (SEGITTUR)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
