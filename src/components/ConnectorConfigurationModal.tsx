import React, { useState } from 'react';
import { 
  X, 
  PlugZap, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  FileText, 
  Database, 
  Clock, 
  Plus
} from 'lucide-react';
import { 
  OperationalConnectorType, 
  OperationalPrivacyLevel, 
  ConnectorFieldMapping 
} from '../types/operationalConfiguration';

interface ConnectorConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  tenantId: string;
  onConnectorCreated: (connector: any) => void;
}

export const ConnectorConfigurationModal: React.FC<ConnectorConfigurationModalProps> = ({
  isOpen,
  onClose,
  destinationId,
  tenantId,
  onConnectorCreated,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<OperationalConnectorType>('REST_API');
  const [lane, setLane] = useState<'ONTOLOGICO' | 'NO_ONTOLOGICO_HISTORICO'>('NO_ONTOLOGICO_HISTORICO');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [secretReference, setSecretReference] = useState('');
  const [updateFrequency, setUpdateFrequency] = useState('Cada 15 minutos');
  const [responsibleEntity, setResponsibleEntity] = useState(`Ayuntamiento de ${destinationId === 'malaga' ? 'Málaga' : 'Palma'}`);
  const [license, setLicense] = useState('CC-BY-4.0');
  const [purpose, setPurpose] = useState('Monitorización de afluencia y capacidad de carga territorial');
  const [retentionPolicy, setRetentionPolicy] = useState('5 años con agregación temporal');
  const [privacyLevel, setPrivacyLevel] = useState<OperationalPrivacyLevel>('INTERNO_AGREGADO');
  const [dataQualityMinPct, setDataQualityMinPct] = useState(85);

  const [fieldMappings, setFieldMappings] = useState<ConnectorFieldMapping[]>([
    { sourceField: 'conteo_personas', sourceType: 'number', targetConcept: 'visitantesHora', unit: 'personas/h', required: true, description: 'Aforo detectado en la vía pública' }
  ]);
  const [newSourceField, setNewSourceField] = useState('');
  const [newTargetConcept, setNewTargetConcept] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleAddField = () => {
    if (!newSourceField || !newTargetConcept) return;
    setFieldMappings(prev => [
      ...prev,
      { sourceField: newSourceField, sourceType: 'number', targetConcept: newTargetConcept, required: true }
    ]);
    setNewSourceField('');
    setNewTargetConcept('');
  };

  const handleSaveConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('pid_auth_token') || '';
      const response = await fetch(`/api/connectors?destino=${destinationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PID-Tenant': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name,
          type,
          lane,
          endpointUrl: endpointUrl || undefined,
          secretReference: secretReference || undefined,
          updateFrequency,
          fieldMappings,
          evidence: {
            responsibleEntity,
            license,
            purpose,
            retentionPolicy,
            privacyLevel,
            dataQualityMinPct,
            territorialCoverage: destinationId,
            url: endpointUrl || undefined
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (data.errors && data.errors.join(', ')) || 'Error creando conector.');
      }

      setMessage({ text: `Conector «${name}» configurado correctamente. Estado inicial: ${data.connector.status}.`, type: 'success' });
      setTimeout(() => {
        onConnectorCreated(data.connector);
        onClose();
      }, 1000);
    } catch (err: any) {
      setMessage({ text: err.message || 'Error guardando el conector.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-700 flex items-center justify-center font-bold">
              <PlugZap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">Iteración 11 · Autonomía No-Code</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 font-semibold text-amber-800">Gobernanza PID</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Configurador No-Code de Conectores</h2>
              <p className="text-xs text-slate-500">Define nuevas fuentes del destino con trazabilidad, calidad y referencia segura a credenciales</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
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

        {/* Formulario */}
        <form onSubmit={handleSaveConnector} className="p-6 overflow-y-auto space-y-5 flex-1">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nombre del Conector *</label>
              <input 
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Red Municipal de Aforadores Larios"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-cyan-600"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tipo de Conector *</label>
              <select 
                value={type}
                onChange={e => {
                  const t = e.target.value as OperationalConnectorType;
                  setType(t);
                  if (t === 'PID_SERVICE_S2' || t === 'OGC_API' || t === 'GEOJSON') setLane('ONTOLOGICO');
                  else setLane('NO_ONTOLOGICO_HISTORICO');
                }}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-cyan-600 bg-white"
              >
                <option value="REST_API">API REST Municipal / Externa</option>
                <option value="MQTT">MQTT / Sensores IoT</option>
                <option value="PID_SERVICE_S2">PID S2 · Armonización Ontológica (NGSI-LD)</option>
                <option value="PID_SERVICE_C4">PID C4 · Series Temporales e Históricos</option>
                <option value="OGC_API">Servicios GIS / OGC API Features</option>
                <option value="CSV">Archivos CSV Tabulares</option>
                <option value="GEOJSON">Capas GeoJSON / JSON</option>
                <option value="SHP_ZIP">Shapefile Comprimido (ZIP)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Carril de Datos PID</label>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
                {lane === 'ONTOLOGICO' ? 'Ontológico (S2/S1/Recursos)' : 'No-Ontológico / Histórico (C4)'}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Frecuencia de Actualización</label>
              <input 
                type="text"
                value={updateFrequency}
                onChange={e => setUpdateFrequency(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-cyan-600"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Calidad Mínima Exigida</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  min="50"
                  max="100"
                  value={dataQualityMinPct}
                  onChange={e => setDataQualityMinPct(Number(e.target.value))}
                  className="w-20 text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-cyan-600 font-mono"
                />
                <span className="text-xs text-slate-500">% umbral mínimo</span>
              </div>
            </div>
          </div>

          {/* Endpoint URL y referencia segura a credenciales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Endpoint URL / Recurso</label>
              <input 
                type="text"
                value={endpointUrl}
                onChange={e => setEndpointUrl(e.target.value)}
                placeholder="https://datos.ayuntamiento.es/api/v1/aforos"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-cyan-600 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                <span>Referencia Segura a Credenciales</span>
                <span className="text-[10px] text-amber-700 font-normal">Sin secretos visibles</span>
              </label>
              <input 
                type="text"
                value={secretReference}
                onChange={e => setSecretReference(e.target.value)}
                placeholder="secret://vault/token_aforos_malaga"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-cyan-600 font-mono bg-slate-50"
              />
            </div>
          </div>

          {/* Gobernanza, Privacidad y Licencia */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-600" /> Gobernanza y Política de Datos
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Entidad Responsable</label>
                <input 
                  type="text"
                  value={responsibleEntity}
                  onChange={e => setResponsibleEntity(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nivel de Privacidad</label>
                <select 
                  value={privacyLevel}
                  onChange={e => setPrivacyLevel(e.target.value as OperationalPrivacyLevel)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="PUBLICO">Público (Open Data)</option>
                  <option value="INTERNO_AGREGADO">Interno Agregado (Operación)</option>
                  <option value="REQUIERE_EVALUACION">Requiere Evaluación Previa</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Licencia de Difusión</label>
                <input 
                  type="text"
                  value={license}
                  onChange={e => setLicense(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Finalidad Declarada</label>
                <input 
                  type="text"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Política de Retención</label>
                <input 
                  type="text"
                  value={retentionPolicy}
                  onChange={e => setRetentionPolicy(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Mapeo de Campos de Origen */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center justify-between">
              <span>Campos de Origen y Conceptos Turísticos</span>
              <span className="text-[10px] text-slate-400 font-normal">{fieldMappings.length} campos mapeados</span>
            </span>

            <div className="space-y-2">
              {fieldMappings.map((m, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono font-bold text-slate-800">{m.sourceField}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-bold text-cyan-700">{m.targetConcept}</span>
                    {m.unit && <span className="text-[10px] text-slate-500">({m.unit})</span>}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">
                    {m.sourceType}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center gap-2">
              <input 
                type="text"
                placeholder="Campo fuente (ej. ocupacion_pct)"
                value={newSourceField}
                onChange={e => setNewSourceField(e.target.value)}
                className="flex-1 text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
              />
              <span className="text-slate-400">→</span>
              <input 
                type="text"
                placeholder="Concepto (ej. capacidadObjetivo)"
                value={newTargetConcept}
                onChange={e => setNewTargetConcept(e.target.value)}
                className="flex-1 text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
              />
              <button 
                type="button"
                onClick={handleAddField}
                className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> El conector se guardará en PostGIS con aislamiento RLS.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-cyan-700 text-white rounded-xl text-xs font-bold hover:bg-cyan-800 shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {loading ? 'Guardando...' : 'Crear Conector'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
