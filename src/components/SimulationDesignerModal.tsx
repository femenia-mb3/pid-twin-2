import React, { useState, useEffect } from 'react';
import {
  FileText, 
  X, 
  Sliders, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  Compass, 
  Download, 
  BookOpen, 
  ShieldCheck, 
  Upload,
  AlertCircle,
  Layers,
  FileCheck2,
  FileCode2,
} from 'lucide-react';
import { Destino, ZonaDestino } from '../types/ontology';
import { ReusableModelTemplate } from '../types/interoperability';
import { ScenarioDefinition } from '../types/scenarioStudio';
import { SimulationModelPackageV1 } from '../types/simulationModelPackage';
import { DataBindingModal } from './DataBindingModal';

interface SimulationDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: Destino;
  tenantId: string;
  zones: ZonaDestino[];
  onScenarioImported: (scenario: ScenarioDefinition) => void;
  onOpenStudioFromScratch: () => void;
}

export const SimulationDesignerModal: React.FC<SimulationDesignerModalProps> = ({
  isOpen,
  onClose,
  destination,
  tenantId,
  zones,
  onScenarioImported,
  onOpenStudioFromScratch,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'upload_package' | 'own_model'>('catalog');
  const [models, setModels] = useState<ReusableModelTemplate[]>([]);
  const [selectedModel, setSelectedModel] = useState<ReusableModelTemplate | null>(null);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [modelParameters, setModelParameters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Subida de SimulationModelPackage v1 real
  const [rawPackageText, setRawPackageText] = useState('');
  const [packageFileName, setPackageFileName] = useState('');
  const [validatedPackage, setValidatedPackage] = useState<SimulationModelPackageV1 | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [persisting, setPersisting] = useState(false);

  // Modal de vínculos
  const [bindingModalOpen, setBindingModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setMessage(null);
    setSelectedZoneIds(zones.slice(0, 2).map(z => z.id));

    fetch(`/api/models/reusable?destino=${destination.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          setModels(data.models);
          if (data.models.length > 0) {
            selectModel(data.models[0]);
          }
        }
      })
      .catch(err => {
        console.error('Error cargando modelos:', err);
        setMessage({ text: 'Error conectando con el catálogo de modelos PID.', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [isOpen, destination.id]);

  const selectModel = (model: ReusableModelTemplate) => {
    setSelectedModel(model);
    const initialParams: Record<string, any> = {};
    model.variables.forEach(v => {
      initialParams[v.id] = v.defaultValue;
    });
    setModelParameters(initialParams);
  };

  const handleParamChange = (id: string, value: any) => {
    setModelParameters(prev => ({ ...prev, [id]: value }));
  };

  const toggleZone = (id: string) => {
    setSelectedZoneIds(prev => 
      prev.includes(id) ? prev.filter(z => z !== id) : [...prev, id]
    );
  };

  const handleImportToSimulator = async () => {
    if (!selectedModel) return;
    setImporting(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const response = await fetch(`/api/models/reusable/${selectedModel.id}/import-scenario?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          zoneIds: selectedZoneIds,
          parameters: modelParameters
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error importando el modelo al simulador.');
      }

      if (data.scenario) {
        setMessage({ text: `¡Modelo «${selectedModel.title}» importado con éxito como escenario ejecutable!`, type: 'success' });
        setTimeout(() => {
          onScenarioImported(data.scenario);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Error en la importación.', type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handlePackageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPackageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawPackageText(text);
      handleValidatePackage(text);
    };
    reader.readAsText(file);
  };

  const loadExamplePackage = () => {
    const sampleYaml = `schemaVersion: simulation-model-package-v1
id: modelo_afluencia_peatonal_casco_historico
version: 1.0.0
name: Modelo de Capacidad y Flujo Peatonal en Ejes Comerciales
domain: Movilidad y Capacidad de Carga
summary: Simulación de redistribución de visitantes en arterias comerciales y plazas céntricas.
creatorDestinationId: ${destination.id}
creatorDestinationName: Destino ${destination.nombre}
lifecycleState: BORRADOR
requiredLanes:
  - ONTOLOGICO
  - NO_ONTOLOGICO_HISTORICO
pidModulesRequired:
  - S2
  - C4
  - S18
variables:
  - id: visitantesHora
    label: Afluencia peatonal horaria
    unit: personas/hora
    defaultValue: 1500
    valueType: number
    min: 100
    max: 10000
    required: true
    description: Visitantes estimados por hora en el eje principal
  - id: capacidadOperativaPct
    label: Capacidad operativa de paso
    unit: "%"
    defaultValue: 100
    valueType: number
    min: 50
    max: 120
    required: true
sourceRequirements:
  - lane: NO_ONTOLOGICO_HISTORICO
    concept: Aforos peatonales de sensores IoT
    minimumFrequency: 15min
    recommendedFormat: CSV
    mandatory: true
declarativeRules:
  - ruleId: saturacion_larios
    name: Umbral crítico de paso
    conditionDescription: Si visitantesHora supera 2500 personas/h
    impactVariable: nivelSaturacion
    operator: SET
    value: 95
    evidenceNotes: Basado en protocolo de aforos de eventos de alta intensidad
outputIndicators:
  - id: indice_saturacion_eje
    label: Índice de Saturación Peatonal
    unit: "%"
    category: SATURACION
    targetEntity: ZONA
    formulaSummary: (visitantesHora / capacidadMaxima) * 100
privacyPolicy:
  privacyLevel: INTERNO_AGREGADO
  allowsCrossDestinationUse: true
  dataMinimizationRule: Agregación horaria sin datos personales
evidence:
  origin: Modelo propuesto por el Área de Movilidad y Turismo
  responsibleAuthor: Equipo Técnico Municipal
  license: CC-BY-4.0
  validationMethod: Calibración contra histórico de sensores 2025-2026
  reviewedAt: ${new Date().toISOString()}
`;
    setPackageFileName('modelo_afluencia_peatonal.yaml');
    setRawPackageText(sampleYaml);
    handleValidatePackage(sampleYaml);
  };

  const handleValidatePackage = async (contentToValidate?: string) => {
    const text = contentToValidate || rawPackageText;
    if (!text.trim()) return;

    setValidating(true);
    setValidationErrors([]);
    setValidatedPackage(null);

    try {
      const res = await fetch('/api/models/packages/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawContent: text })
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        setValidationErrors(data.errors || ['Error validando el paquete de modelo.']);
      } else {
        setValidatedPackage(data.normalizedPackage);
        setMessage({ text: 'Paquete de modelo validado con éxito contra el estándar seguro PID.', type: 'success' });
      }
    } catch (err: any) {
      setValidationErrors([err.message || 'Error de comunicación con el servicio de validación.']);
    } finally {
      setValidating(false);
    }
  };

  const handlePersistPackage = async () => {
    if (!rawPackageText) return;
    setPersisting(true);

    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const res = await fetch(`/api/models/packages/import?destino=${destination.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ rawContent: rawPackageText })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error guardando paquete en PostGIS.');
      }

      setMessage({ text: `Paquete «${data.package.name}» (v${data.package.version}) guardado en PostGIS. Estado: BORRADOR.`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setPersisting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Iteración 11 · Configuración Operativa</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">Modelos PID Seguros</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Diseñador y Catálogo de Simulaciones PID</h2>
              <p className="text-xs text-slate-500">Importa modelos reutilizables, sube paquetes de reglas declarativas o define escenarios paso a paso</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Modo */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'catalog' 
                ? 'border-red-600 text-red-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Catálogo Reutilizable PID ({models.length} Modelos)
          </button>
          <button
            onClick={() => setActiveTab('upload_package')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'upload_package' 
                ? 'border-red-600 text-red-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            Subir Paquete de Modelo (YAML/JSON Seguro)
          </button>
          <button
            onClick={() => setActiveTab('own_model')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'own_model' 
                ? 'border-red-600 text-red-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Editor Visual No-Code
          </button>
        </div>

        {/* Notificaciones */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Pestaña 1: Catálogo Reutilizable */}
        {activeTab === 'catalog' && (
          <div className="flex-1 flex overflow-hidden">
            
            {/* Lista de Modelos */}
            <div className="w-1/3 border-r border-slate-200 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Plantillas Disponibles</span>
              {loading ? (
                <div className="text-center py-8 text-xs text-slate-400">Cargando catálogo...</div>
              ) : (
                models.map(m => (
                  <div
                    key={m.id}
                    onClick={() => selectModel(m)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedModel?.id === m.id
                        ? 'border-red-500 bg-white shadow-sm ring-1 ring-red-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                        {m.domain}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">v{m.version}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">{m.title}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{m.summary}</p>
                    
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-slate-600">
                        <Building2 className="w-3 h-3 text-red-500" />
                        {m.creatorDestinationName || 'Destino creador'}
                      </span>
                      <span>{m.adoptedByDestinationIds?.length || 0} destinos</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Detalle y Parametrización */}
            <div className="w-2/3 overflow-y-auto p-6 space-y-6">
              {selectedModel ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-600 uppercase tracking-wider">{selectedModel.domain}</span>
                      <button
                        onClick={() => setBindingModalOpen(true)}
                        className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Ver Vínculos de Datos
                      </button>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{selectedModel.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{selectedModel.summary}</p>
                  </div>

                  {/* Selección de Zonas */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-red-600" />
                      Zonas afectadas en {destination.nombre}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {zones.map(z => (
                        <div
                          key={z.id}
                          onClick={() => toggleZone(z.id)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            selectedZoneIds.includes(z.id)
                              ? 'border-red-500 bg-red-50/40 font-bold text-slate-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{z.nombre}</span>
                          {selectedZoneIds.includes(z.id) && <CheckCircle2 className="w-4 h-4 text-red-600" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Parámetros */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-red-600" />
                      Ajuste de Parámetros del Modelo
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedModel.variables.map(v => (
                        <div key={v.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                          <label className="text-xs font-semibold text-slate-700 block flex items-center justify-between">
                            <span>{v.label}</span>
                            {v.unit && <span className="text-[10px] text-slate-400 font-normal">({v.unit})</span>}
                          </label>
                          <input 
                            type="number"
                            min={v.min}
                            max={v.max}
                            value={modelParameters[v.id] ?? v.defaultValue}
                            onChange={e => handleParamChange(v.id, Number(e.target.value))}
                            className="w-full text-xs font-mono p-1.5 border border-slate-200 rounded focus:border-red-500 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botón de Importación */}
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Convierte la plantilla en un escenario operable y persistible.
                    </span>
                    <button
                      onClick={handleImportToSimulator}
                      disabled={importing || selectedZoneIds.length === 0}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      {importing ? 'Importando...' : 'Importar al Simulador'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Selecciona un modelo del catálogo de la izquierda para ver sus detalles.
                </div>
              )}
            </div>

          </div>
        )}

        {/* Pestaña 2: Subida de SimulationModelPackage v1 */}
        {activeTab === 'upload_package' && (
          <div className="p-8 flex-1 overflow-y-auto space-y-6">
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Cargar Paquete de Modelo Seguro (SimulationModelPackage v1)</h3>
                  <p className="text-xs text-slate-500">Valida reglas declarativas en YAML/JSON sin ejecución de scripts arbitrarios</p>
                </div>
                <button
                  onClick={loadExamplePackage}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-red-600" />
                  Cargar Plantilla YAML
                </button>
              </div>

              {/* Selector de archivo */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center gap-2">
                <input
                  type="file"
                  id="package-upload"
                  accept=".yaml,.yml,.json"
                  onChange={handlePackageFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="package-upload"
                  className="cursor-pointer px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-sm"
                >
                  <Upload className="w-4 h-4 text-red-600" />
                  Seleccionar archivo de paquete (.yaml, .yml, .json)
                </label>
                {packageFileName && (
                  <span className="text-xs font-mono text-slate-600 font-bold">{packageFileName}</span>
                )}
              </div>

              {/* Editor del contenido */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Definición Declarativa del Paquete (YAML / JSON)</label>
                <textarea
                  rows={8}
                  value={rawPackageText}
                  onChange={e => {
                    setRawPackageText(e.target.value);
                    setValidatedPackage(null);
                  }}
                  placeholder="Pega aquí el contenido del paquete de modelo en formato YAML o JSON..."
                  className="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl outline-none focus:border-red-600 bg-slate-50/50"
                />
              </div>

              {/* Errores de validación */}
              {validationErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-1.5">
                  <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600" /> Errores detectados en el esquema del paquete:
                  </span>
                  {validationErrors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700 pl-5">• {err}</p>
                  ))}
                </div>
              )}

              {/* Paquete validado con éxito */}
              {validatedPackage && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Paquete de Modelo Validado Correctamente
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                      v{validatedPackage.version}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-white p-3 rounded-lg border border-emerald-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Identificador:</span>
                      <span className="font-bold text-slate-800 font-mono">{validatedPackage.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Variables declaradas:</span>
                      <span className="font-bold text-slate-800 font-mono">{validatedPackage.variables.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Reglas declarativas:</span>
                      <span className="font-bold text-slate-800 font-mono">{validatedPackage.declarativeRules.length}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-500">
                      Se persistirá en PostGIS en estado BORRADOR para su posterior revisión humana.
                    </span>
                    <button
                      onClick={handlePersistPackage}
                      disabled={persisting}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      {persisting ? 'Guardando...' : 'Persistir en PostGIS'}
                    </button>
                  </div>
                </div>
              )}

              {!validatedPackage && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handleValidatePackage()}
                    disabled={validating || !rawPackageText.trim()}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    {validating ? 'Validando...' : 'Validar Esquema del Paquete'}
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Pestaña 3: Editor Visual */}
        {activeTab === 'own_model' && (
          <div className="p-8 flex-1 overflow-y-auto flex items-center justify-center">
            <div className="max-w-md text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
                <Sliders className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Editor Visual de Escenarios</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Diseña simulaciones personalizadas ajustando aforos, meteorología, movilidad y umbrales de alerta en tiempo real sobre el gemelo.
              </p>
              <button
                onClick={() => {
                  onOpenStudioFromScratch();
                  onClose();
                }}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-2"
              >
                <span>Abrir Editor Visual</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Pie */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Toda simulación importada preserva su trazabilidad ontológica y huella SHA-256.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>

      {/* Modal de Vínculos de Datos */}
      {selectedModel && (
        <DataBindingModal
          isOpen={bindingModalOpen}
          onClose={() => setBindingModalOpen(false)}
          destinationId={destination.id}
          tenantId={tenantId}
          modelId={selectedModel.id}
          modelTitle={selectedModel.title}
        />
      )}
    </div>
  );
};
