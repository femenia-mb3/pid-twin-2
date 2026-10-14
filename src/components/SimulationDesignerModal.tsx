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
import { ScenarioDefinition, ScenarioDraftInput, createScenarioDraft } from '../types/scenarioStudio';
import { MODELO_EDITOR_VISUAL } from '../services/modelFlows';
import { applyModelProfile, createSessionScenario, packageToSessionScenario } from '../services/sessionScenarios';
import { SimulationModelPackageV1 } from '../types/simulationModelPackage';
import { DataBindingModal } from './DataBindingModal';

interface SimulationDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: Destino;
  tenantId: string;
  zones: ZonaDestino[];
  /** El escenario se añade al panel del usuario solo durante la sesión (no se guarda). */
  onScenarioImported: (scenario: ScenarioDefinition) => void;
}

export const SimulationDesignerModal: React.FC<SimulationDesignerModalProps> = ({
  isOpen,
  onClose,
  destination,
  tenantId,
  zones,
  onScenarioImported,
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
  const [appliedMapping, setAppliedMapping] = useState<string[]>([]);

  // Editor visual no-code
  const [editorDraft, setEditorDraft] = useState<ScenarioDraftInput>(() => createScenarioDraft(destination.id, tenantId));

  // Modal de vínculos
  const [bindingModalOpen, setBindingModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setMessage(null);
    setSelectedZoneIds(zones.slice(0, 2).map(z => z.id));
    setEditorDraft({ ...createScenarioDraft(destination.id, tenantId), inputs: { ...createScenarioDraft(destination.id, tenantId).inputs, zoneIds: zones.slice(0, 2).map(z => z.id) } });

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

  const addToSession = (scenario: ScenarioDefinition, text: string) => {
    setMessage({ text, type: 'success' });
    setTimeout(() => {
      onScenarioImported(scenario);
      onClose();
    }, 600);
  };

  const handleImportToSimulator = async () => {
    if (!selectedModel) return;
    setImporting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/models/reusable/${selectedModel.id}/scenario-draft?destino=${destination.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneIds: selectedZoneIds, parameters: modelParameters }),
      });
      const data = await response.json();
      if (!response.ok || !data.draft) {
        throw new Error(data.error || 'No se pudo generar la simulación desde el modelo.');
      }
      const centroZoneIds = zones.filter(z => z.tipoZona === 'CENTRO_HISTORICO').map(z => z.id);
      const scenario = createSessionScenario(applyModelProfile({ ...data.draft, tenantId }, selectedModel.id, centroZoneIds));
      addToSession(scenario, `«${selectedModel.title}» añadida a tu panel. Estará disponible hasta que recargues la página.`);
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al añadir la simulación.', type: 'error' });
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

  const handleAddPackage = () => {
    if (!validatedPackage) return;
    if (selectedZoneIds.length === 0) {
      setMessage({ text: 'Selecciona al menos una zona afectada.', type: 'error' });
      return;
    }
    const { scenario, applied } = packageToSessionScenario(validatedPackage, destination.id, tenantId, selectedZoneIds);
    setAppliedMapping(applied);
    addToSession(scenario, `«${validatedPackage.name}» añadida a tu panel. Estará disponible hasta que recargues la página.`);
  };

  const patchEditor = <K extends keyof ScenarioDraftInput['inputs']>(key: K, value: ScenarioDraftInput['inputs'][K]) => {
    setEditorDraft(current => ({ ...current, inputs: { ...current.inputs, [key]: value } }));
  };

  const toggleEditorZone = (id: string) => {
    const zoneIds = editorDraft.inputs.zoneIds;
    patchEditor('zoneIds', zoneIds.includes(id) ? zoneIds.filter(z => z !== id) : [...zoneIds, id]);
  };

  const handleCreateFromEditor = () => {
    if (!editorDraft.name.trim()) {
      setMessage({ text: 'Indica un nombre para la simulación.', type: 'error' });
      return;
    }
    if (editorDraft.inputs.zoneIds.length === 0) {
      setMessage({ text: 'Selecciona al menos una zona afectada.', type: 'error' });
      return;
    }
    const scenario = createSessionScenario({ ...editorDraft, destinationId: destination.id, tenantId, sourceModelId: MODELO_EDITOR_VISUAL });
    addToSession(scenario, `«${scenario.name}» creada y añadida a tu panel. Estará disponible hasta que recargues la página.`);
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
                      Añade la simulación a tu panel. Solo estará disponible hasta que recargues la página.
                    </span>
                    <button
                      onClick={handleImportToSimulator}
                      disabled={importing || selectedZoneIds.length === 0}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      {importing ? 'Añadiendo...' : 'Añadir a mi panel'}
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

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Zonas afectadas en {destination.nombre}</span>
                    <div className="grid grid-cols-2 gap-2">
                      {zones.map(z => (
                        <div
                          key={z.id}
                          onClick={() => toggleZone(z.id)}
                          className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between ${
                            selectedZoneIds.includes(z.id) ? 'border-emerald-600 bg-white font-bold text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{z.nombre}</span>
                          {selectedZoneIds.includes(z.id) && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {appliedMapping.length > 0 && (
                    <ul className="text-[11px] text-slate-600 list-disc pl-5">
                      {appliedMapping.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-500">
                      Se añadirá a tu panel de simulaciones solo durante esta sesión; desaparece al recargar la página.
                    </span>
                    <button
                      onClick={handleAddPackage}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      Añadir a mi panel
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
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-800">Editor Visual de Simulaciones</h3>
                <p className="text-xs text-slate-500">Define aforos, meteorología, movilidad y umbrales. La simulación se añade a tu panel solo durante esta sesión.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700 md:col-span-2">
                  Nombre
                  <input
                    value={editorDraft.name}
                    onChange={e => setEditorDraft(c => ({ ...c, name: e.target.value }))}
                    placeholder="Ej.: Fin de semana de feria con calor"
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700 md:col-span-2">
                  Descripción
                  <textarea
                    rows={2}
                    value={editorDraft.description}
                    onChange={e => setEditorDraft(c => ({ ...c, description: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Tipo de escenario
                  <select
                    value={editorDraft.type}
                    onChange={e => setEditorDraft(c => ({ ...c, type: e.target.value as ScenarioDraftInput['type'] }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-red-500"
                  >
                    <option value="PERSONALIZADO">Personalizado</option>
                    <option value="EVENTO_CULTURAL">Evento cultural</option>
                    <option value="CRUCERO_MASIVO">Llegada / crucero</option>
                    <option value="EPISODIO_METEO">Episodio meteorológico</option>
                    <option value="CORTE_ACCESO">Corte o restricción de acceso</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Meteorología
                  <select
                    value={editorDraft.inputs.climate}
                    onChange={e => patchEditor('climate', e.target.value as ScenarioDraftInput['inputs']['climate'])}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-red-500"
                  >
                    <option value="DESPEJADO">Despejado</option>
                    <option value="LLUVIA">Lluvia</option>
                    <option value="CALOR_EXTREMO">Calor extremo</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Movilidad
                  <select
                    value={editorDraft.inputs.mobilityMode}
                    onChange={e => patchEditor('mobilityMode', e.target.value as ScenarioDraftInput['inputs']['mobilityMode'])}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-red-500"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="RESTRINGIDA">Restringida</option>
                    <option value="REFORZADA">Reforzada</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Distribución espacial
                  <select
                    value={editorDraft.inputs.spatialDistribution}
                    onChange={e => patchEditor('spatialDistribution', e.target.value as ScenarioDraftInput['inputs']['spatialDistribution'])}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-red-500"
                  >
                    <option value="UNIFORME">Uniforme</option>
                    <option value="CONCENTRADA">Concentrada</option>
                    <option value="REDISTRIBUIDA">Redistribuida</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  <span className="flex justify-between"><span>Hora</span><span className="font-mono text-slate-500">{String(editorDraft.inputs.hour).padStart(2, '0')}:00</span></span>
                  <input type="range" min={0} max={23} value={editorDraft.inputs.hour} onChange={e => patchEditor('hour', Number(e.target.value))} className="w-full accent-red-600" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  <span className="flex justify-between"><span>Variación de visitantes</span><span className="font-mono text-slate-500">{editorDraft.inputs.visitorVariationPct > 0 ? '+' : ''}{editorDraft.inputs.visitorVariationPct} %</span></span>
                  <input type="range" min={-50} max={150} value={editorDraft.inputs.visitorVariationPct} onChange={e => patchEditor('visitorVariationPct', Number(e.target.value))} className="w-full accent-red-600" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  <span className="flex justify-between"><span>Capacidad operativa</span><span className="font-mono text-slate-500">{editorDraft.inputs.operationalCapacityPct} %</span></span>
                  <input type="range" min={30} max={130} value={editorDraft.inputs.operationalCapacityPct} onChange={e => patchEditor('operationalCapacityPct', Number(e.target.value))} className="w-full accent-red-600" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  <span className="flex justify-between"><span>Umbral de alerta</span><span className="font-mono text-slate-500">{editorDraft.inputs.alertThresholdPct} %</span></span>
                  <input type="range" min={40} max={120} value={editorDraft.inputs.alertThresholdPct} onChange={e => patchEditor('alertThresholdPct', Number(e.target.value))} className="w-full accent-red-600" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  <span className="flex justify-between"><span>Intensidad del escenario</span><span className="font-mono text-slate-500">{editorDraft.inputs.intensity.toFixed(1)}</span></span>
                  <input type="range" min={0} max={2} step={0.1} value={editorDraft.inputs.intensity} onChange={e => patchEditor('intensity', Number(e.target.value))} className="w-full accent-red-600" />
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-red-600" />
                  Zonas afectadas en {destination.nombre}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {zones.map(z => (
                    <div
                      key={z.id}
                      onClick={() => toggleEditorZone(z.id)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        editorDraft.inputs.zoneIds.includes(z.id)
                          ? 'border-red-500 bg-red-50/40 font-bold text-slate-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{z.nombre}</span>
                      {editorDraft.inputs.zoneIds.includes(z.id) && <CheckCircle2 className="w-4 h-4 text-red-600" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Solo disponible hasta que recargues la página.</span>
                <button
                  onClick={handleCreateFromEditor}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Crear y añadir a mi panel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pie */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Las simulaciones que añadas solo existen en tu sesión: desaparecen al recargar la página.</span>
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
