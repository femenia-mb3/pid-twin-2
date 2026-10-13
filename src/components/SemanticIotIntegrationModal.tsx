import React, { useEffect, useState } from 'react';
import { 
  Network, 
  Cpu, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Radio, 
  GitBranch, 
  X, 
  Play, 
    FileCode
} from 'lucide-react';
import { 
  S2SemanticConnectorProfile, 
  IotBrokerConnectorProfile, 
  RegisteredIotDevice, 
  NormalizedContextObservation, 
  DataLineageGraph, 
  PidOntologyRegistryRecord 
} from '../types/semanticIngestion';

interface SemanticIotIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationId: string;
  tenantId: string;
}

export const SemanticIotIntegrationModal: React.FC<SemanticIotIntegrationModalProps> = ({
  isOpen,
  onClose,
  destinationId,
  tenantId
}) => {
  const [activeTab, setActiveTab] = useState<'s2' | 'iot' | 'lineage' | 'ontology'>('s2');
  const [ontologies, setOntologies] = useState<PidOntologyRegistryRecord[]>([]);
  const [s2Connectors, setS2Connectors] = useState<S2SemanticConnectorProfile[]>([]);
  const [iotConnectors, setIotConnectors] = useState<IotBrokerConnectorProfile[]>([]);
  const [devices, setDevices] = useState<RegisteredIotDevice[]>([]);
  const [observations, setObservations] = useState<NormalizedContextObservation[]>([]);
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [lineageGraph, setLineageGraph] = useState<DataLineageGraph | null>(null);
  const [, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario nuevo S2
  const [showNewS2Modal, setShowNewS2Modal] = useState(false);
  const [s2Name, setS2Name] = useState('');
  const [s2BaseUrl, setS2BaseUrl] = useState('');
  const [s2Types, setS2Types] = useState('TourismSensor, TouristDestination');
  const [s2Responsible, setS2Responsible] = useState('Área de Innovación y Turismo');
  const [s2Purpose, setS2Purpose] = useState('Armonización ontológica S2 para simulación de flujos peatonales');

  // Formulario nuevo IoT
  const [showNewIotModal, setShowNewIotModal] = useState(false);
  const [iotName, setIotName] = useState('');
  const [iotHost, setIotHost] = useState('mqtt.destino.local');
  const [iotPort, setIotPort] = useState(8883);
  const [iotTopic, setIotTopic] = useState(`pid/${tenantId}/${destinationId}/sensors/`);
  const [iotResponsible, setIotResponsible] = useState('Área de Smart City y Tráfico');
  const [iotPurpose] = useState('Ingesta de telemetría de aforos peatonales y ruido en tiempo real');

  // Formulario nuevo dispositivo
  const [showNewDeviceModal, setShowNewDeviceModal] = useState(false);
  const [selectedConnectorId, setSelectedConnectorId] = useState('');
  const [devUrn, setDevUrn] = useState(`urn:ngsi-ld:TourismSensor:${destinationId}-dev-01`);
  const [devName, setDevName] = useState('Sensor Aforo Centro Histórico');
  const [devConcept, setDevConcept] = useState('visitorCount');
  const [devUnit, setDevUnit] = useState('P1');
  const [devLat, setDevLat] = useState(destinationId === 'malaga' ? 36.7213 : 39.5696);
  const [devLon, setDevLon] = useState(destinationId === 'malaga' ? -4.4214 : 2.6502);

  const token = typeof window !== 'undefined' ? localStorage.getItem('gemelotur_jwt_token') || '' : '';

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    'X-PID-Tenant': tenantId
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ontoRes, s2Res, iotRes, devRes, obsRes] = await Promise.all([
        fetch(`/api/semantic/ontology-registry?destino=${destinationId}`, { headers: authHeaders }),
        fetch(`/api/semantic/s2-connectors?destino=${destinationId}`, { headers: authHeaders }),
        fetch(`/api/iot/connectors?destino=${destinationId}`, { headers: authHeaders }),
        fetch(`/api/iot/devices?destino=${destinationId}`, { headers: authHeaders }),
        fetch(`/api/iot/observations?destino=${destinationId}&limit=25`, { headers: authHeaders })
      ]);

      if (ontoRes.ok) {
        const d = await ontoRes.json();
        setOntologies(d.ontologies || []);
      }
      if (s2Res.ok) {
        const d = await s2Res.json();
        setS2Connectors(d.connectors || []);
      }
      if (iotRes.ok) {
        const d = await iotRes.json();
        setIotConnectors(d.connectors || []);
        if (d.connectors?.length > 0 && !selectedConnectorId) {
          setSelectedConnectorId(d.connectors[0].id);
        }
      }
      if (devRes.ok) {
        const d = await devRes.json();
        setDevices(d.devices || []);
      }
      if (obsRes.ok) {
        const d = await obsRes.json();
        setObservations(d.observations || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos semánticos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, destinationId]);

  const handleCreateS2 = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const types = s2Types.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`/api/semantic/s2-connectors?destino=${destinationId}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: s2Name,
          baseUrl: s2BaseUrl,
          allowedEntityTypes: types,
          fieldMappings: [
            { sourceField: 'visitorCount', targetProperty: 'currentValue', transformation: 'DIRECT' }
          ],
          evidence: {
            responsibleEntity: s2Responsible,
            purpose: s2Purpose,
            license: 'CC-BY-4.0',
            retentionPolicy: '5 años para análisis territorial',
            privacyLevel: 'DATOS_PUBLICOS_AGREGADOS',
            dataQualityMinPct: 90,
            territorialCoverage: destinationId
          }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.errors?.[0] || 'Error al crear conector S2');
      }

      setShowNewS2Modal(false);
      setS2Name('');
      setS2BaseUrl('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateIot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/iot/connectors?destino=${destinationId}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: iotName,
          protocol: 'MQTTS_5',
          brokerHost: iotHost,
          brokerPort: Number(iotPort),
          tlsEnabled: true,
          topicNamespace: iotTopic,
          defaultQos: 1,
          evidence: {
            responsibleEntity: iotResponsible,
            purpose: iotPurpose,
            license: 'CC-BY-4.0',
            retentionPolicy: '5 años para análisis territorial',
            privacyLevel: 'DATOS_PUBLICOS_AGREGADOS',
            dataQualityMinPct: 90,
            territorialCoverage: destinationId
          }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.errors?.[0] || 'Error al crear broker IoT');
      }

      setShowNewIotModal(false);
      setIotName('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/iot/devices?destino=${destinationId}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          connectorId: selectedConnectorId,
          sensorUrn: devUrn,
          name: devName,
          sensorType: 'AFORO_PEATONAL',
          measurementConcept: devConcept,
          unitCode: devUnit,
          coordinates: [Number(devLat), Number(devLon)],
          evidence: {
            responsibleEntity: 'Ayuntamiento Smart Destination',
            purpose: 'Monitoreo de aforo peatonal',
            license: 'CC-BY-4.0',
            retentionPolicy: '5 años',
            privacyLevel: 'DATOS_PUBLICOS_AGREGADOS',
            dataQualityMinPct: 95,
            territorialCoverage: destinationId
          }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.errors?.[0] || 'Error al registrar dispositivo');
      }

      setShowNewDeviceModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePreflightS2 = async (id: string) => {
    try {
      const res = await fetch(`/api/semantic/s2-connectors/${id}/preflight?destino=${destinationId}`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      alert(`Resultado Preflight:\nEstado: ${data.status}\nMensaje: ${data.message}`);
    } catch (err: any) {
      alert('Error en preflight: ' + err.message);
    }
  };

  const handleDecisionS2 = async (id: string, action: 'ACTIVAR' | 'SUSPENDER' | 'VALIDAR') => {
    const rationale = prompt(`Justificación para ${action} el conector S2:`, 'Validación institucional conforme al pliego SEGITTUR');
    if (!rationale) return;

    try {
      const res = await fetch(`/api/semantic/s2-connectors/${id}/decision?destino=${destinationId}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action, rationale })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.errors?.[0] || 'Error al registrar decisión');
      }
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDecisionIot = async (id: string, action: 'ACTIVAR' | 'SUSPENDER' | 'VALIDAR') => {
    const rationale = prompt(`Justificación para ${action} el broker IoT:`, 'Revisión técnica de certificados y puertos seguros');
    if (!rationale) return;

    try {
      const res = await fetch(`/api/iot/connectors/${id}/decision?destino=${destinationId}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action, rationale })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.errors?.[0] || 'Error al registrar decisión');
      }
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFetchLineage = async (obsId: string) => {
    setSelectedObservationId(obsId);
    try {
      const res = await fetch(`/api/semantic/lineage/${obsId}?destino=${destinationId}`, { headers: authHeaders });
      if (res.ok) {
        const graph = await res.json();
        setLineageGraph(graph);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Cabecera institucional PID */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-700 text-white shadow-sm">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-700">PID S2 & IoT</span>
                <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">NGSI-LD 1.8</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">RLS Multidestino</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">Ontologías PID S2 y Conectores IoT Semánticos</h2>
              <p className="text-xs text-slate-500">
                Integración activable de fuentes normalizadas NGSI-LD y MQTT seguro para <b>{destinationId.toUpperCase()}</b> ({tenantId}).
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de navegación de pestañas */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('s2')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors ${
              activeTab === 's2' ? 'border-cyan-700 text-cyan-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Network className="h-4 w-4" />
            Fuentes Semánticas S2 ({s2Connectors.length})
          </button>
          <button
            onClick={() => setActiveTab('iot')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors ${
              activeTab === 'iot' ? 'border-cyan-700 text-cyan-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio className="h-4 w-4" />
            Brokers & Dispositivos IoT ({iotConnectors.length} / {devices.length})
          </button>
          <button
            onClick={() => setActiveTab('lineage')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors ${
              activeTab === 'lineage' ? 'border-cyan-700 text-cyan-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitBranch className="h-4 w-4" />
            Linaje de Datos & Observaciones ({observations.length})
          </button>
          <button
            onClick={() => setActiveTab('ontology')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors ${
              activeTab === 'ontology' ? 'border-cyan-700 text-cyan-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="h-4 w-4" />
            Registro Ontológico SEGITTUR
          </button>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* PESTAÑA S2 */}
          {activeTab === 's2' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Perfiles de Conexión Semántica S2 / NGSI-LD</h3>
                  <p className="text-xs text-slate-500">Mapeos normalizados con `@context` institucional, preflight de seguridad y decisiones humanas auditadas.</p>
                </div>
                <button
                  onClick={() => setShowNewS2Modal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-800"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Conector S2
                </button>
              </div>

              {s2Connectors.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <Network className="h-10 w-10 text-slate-400" />
                  <p className="mt-2 text-sm font-bold text-slate-700">No hay conectores S2 registrados para {destinationId.toUpperCase()}</p>
                  <p className="text-xs text-slate-500">Cree un perfil semántico declarando la URL base, tipos NGSI-LD autorizados y evidencia de gobernanza.</p>
                  <button
                    onClick={() => setShowNewS2Modal(true)}
                    className="mt-4 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800"
                  >
                    Crear perfil S2
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {s2Connectors.map(c => (
                    <div key={c.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-800">{c.apiVersion}</span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            c.activationState === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' :
                            c.activationState === 'VALIDADO' ? 'bg-amber-100 text-amber-800' :
                            c.activationState === 'SUSPENDIDO' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {c.activationState}
                          </span>
                        </div>
                        <h4 className="mt-2 text-sm font-bold text-slate-900">{c.name}</h4>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">{c.baseUrl}</p>
                        
                        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">Tipos:</span>
                            <span className="truncate">{c.allowedEntityTypes.join(', ')}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">Contexto:</span>
                            <span className="truncate text-[11px] font-mono text-cyan-700">{c.contextUrl}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">Responsable:</span>
                            <span>{c.evidence.responsibleEntity}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">Huella SHA-256:</span>
                            <span className="truncate font-mono text-[10px] text-slate-400">{c.contextFingerprintSha256}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <button
                          onClick={() => handlePreflightS2(c.id)}
                          className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <Play className="h-3 w-3" />
                          Preflight
                        </button>
                        <div className="flex items-center gap-1.5">
                          {c.activationState === 'BORRADOR' && (
                            <button
                              onClick={() => handleDecisionS2(c.id, 'VALIDAR')}
                              className="rounded bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
                            >
                              Validar
                            </button>
                          )}
                          {c.activationState === 'VALIDADO' && (
                            <button
                              onClick={() => handleDecisionS2(c.id, 'ACTIVAR')}
                              className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800"
                            >
                              Activar
                            </button>
                          )}
                          {c.activationState === 'ACTIVO' && (
                            <button
                              onClick={() => handleDecisionS2(c.id, 'SUSPENDER')}
                              className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700"
                            >
                              Suspender
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA IOT BROKER */}
          {activeTab === 'iot' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Brokers y Dispositivos IoT Autorizados</h3>
                  <p className="text-xs text-slate-500">Gestión de suscripciones MQTT 5 TLS, lista blanca de dispositivos y control de tasa.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewDeviceModal(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Cpu className="h-4 w-4" />
                    Registrar Dispositivo
                  </button>
                  <button
                    onClick={() => setShowNewIotModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-800"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo Broker MQTT
                  </button>
                </div>
              </div>

              {/* Lista de brokers */}
              <div className="grid gap-4 md:grid-cols-2">
                {iotConnectors.map(c => (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">{c.protocol}</span>
                        {c.tlsEnabled && <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><ShieldCheck className="h-3 w-3" /> TLS</span>}
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        c.activationState === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' :
                        c.activationState === 'VALIDADO' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {c.activationState}
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-slate-900">{c.name}</h4>
                    <p className="font-mono text-xs text-slate-500">{c.brokerHost}:{c.brokerPort}</p>
                    <div className="mt-2 rounded bg-slate-50 p-2 font-mono text-[11px] text-cyan-800">
                      Tópico: {c.topicNamespace}#
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="text-slate-500">QoS {c.defaultQos} · Max {c.maxRateMessagesPerMinute} msg/min</span>
                      <div className="flex gap-1.5">
                        {c.activationState === 'BORRADOR' && (
                          <button
                            onClick={() => handleDecisionIot(c.id, 'VALIDAR')}
                            className="rounded bg-amber-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
                          >
                            Validar
                          </button>
                        )}
                        {c.activationState === 'VALIDADO' && (
                          <button
                            onClick={() => handleDecisionIot(c.id, 'ACTIVAR')}
                            className="rounded bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-800"
                          >
                            Activar
                          </button>
                        )}
                        {c.activationState === 'ACTIVO' && (
                          <button
                            onClick={() => handleDecisionIot(c.id, 'SUSPENDER')}
                            className="rounded bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-700"
                          >
                            Suspender
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Lista de dispositivos autorizados */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Dispositivos y Sensores Autorizados ({devices.length})</h4>
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-2.5">Sensor URN</th>
                        <th className="px-4 py-2.5">Nombre</th>
                        <th className="px-4 py-2.5">Medición</th>
                        <th className="px-4 py-2.5">Unidad</th>
                        <th className="px-4 py-2.5">Coordenadas</th>
                        <th className="px-4 py-2.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {devices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            No hay dispositivos IoT registrados. Registre uno para admitir telemetría.
                          </td>
                        </tr>
                      ) : (
                        devices.map(d => (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-mono text-[11px] text-cyan-800">{d.sensorUrn}</td>
                            <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                            <td className="px-4 py-2 text-slate-600">{d.measurementConcept}</td>
                            <td className="px-4 py-2 font-mono text-slate-500">{d.unitCode}</td>
                            <td className="px-4 py-2 font-mono text-slate-500">{d.coordinates[0].toFixed(4)}, {d.coordinates[1].toFixed(4)}</td>
                            <td className="px-4 py-2">
                              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{d.state}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA LINEAJE */}
          {activeTab === 'lineage' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Observaciones Recientes en PostGIS</h3>
                <p className="text-xs text-slate-500">Seleccione una lectura para inspeccionar su trazabilidad de origen y evidencia SHA-256.</p>

                <div className="mt-3 space-y-2">
                  {observations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                      No hay observaciones registradas en este destino aún.
                    </div>
                  ) : (
                    observations.map(obs => (
                      <button
                        key={obs.id}
                        onClick={() => handleFetchLineage(obs.id)}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          selectedObservationId === obs.id ? 'border-cyan-600 bg-cyan-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-800">{obs.measurementConcept}: <b>{obs.value} {obs.unitCode}</b></span>
                          <span className="font-mono text-slate-400">{new Date(obs.observedAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-cyan-800 truncate">{obs.sensorUrn}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px]">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-600">{obs.sourceType}</span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">{obs.quality}</span>
                          <span className="truncate text-slate-400">SHA: {obs.fingerprintSha256.substring(0, 10)}...</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Detalle de linaje */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <GitBranch className="h-4 w-4 text-cyan-700" />
                  Grafo de Linaje de Datos y Auditoría
                </h4>
                <p className="text-xs text-slate-500">Cadena inmutable desde el conector fuente hasta el motor de simulación.</p>

                {!lineageGraph ? (
                  <div className="mt-12 text-center text-xs text-slate-400">
                    Seleccione una observación para trazar su genealogía.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {lineageGraph.nodes.map((node, idx) => (
                      <div key={node.id} className="relative flex items-start gap-3 pl-2">
                        {idx < lineageGraph.nodes.length - 1 && (
                          <div className="absolute left-[17px] top-6 h-full w-0.5 bg-slate-200" />
                        )}
                        <div className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                          node.type === 'CONECTOR' ? 'border-cyan-600 bg-cyan-100 text-cyan-800' :
                          node.type === 'LOTE' ? 'border-amber-600 bg-amber-100 text-amber-800' :
                          node.type === 'OBSERVACION' ? 'border-emerald-600 bg-emerald-100 text-emerald-800' :
                          'border-violet-600 bg-violet-100 text-violet-800'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{node.label}</span>
                            <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">{node.status}</span>
                          </div>
                          <p className="mt-1 font-mono text-[10px] text-slate-400">SHA-256: {node.fingerprintSha256}</p>
                          <div className="mt-2 text-[11px] text-slate-600">
                            {Object.entries(node.details).map(([k, v]) => (
                              <div key={k} className="flex gap-1">
                                <span className="font-semibold text-slate-500">{k}:</span>
                                <span className="truncate">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PESTAÑA ONTOLOGÍA */}
          {activeTab === 'ontology' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Registro Institucional de Ontologías Turísticas SEGITTUR</h3>
              <p className="text-xs text-slate-500">Vocabulario de referencia y clases semánticas normalizadas con licencia y procedencia verificada.</p>

              <div className="space-y-3">
                {ontologies.map(o => (
                  <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-800">Versión {o.version}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" /> Aprobado Oficialmente
                      </span>
                    </div>
                    <h4 className="mt-2 text-base font-bold text-slate-900">{o.title}</h4>
                    <p className="mt-1 font-mono text-xs text-cyan-800">{o.iri}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{o.provenance}</p>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <div><b>Creador:</b> {o.creator}</div>
                      <div><b>Licencia:</b> {o.license}</div>
                      <div className="truncate"><b>Documentación:</b> <a href={o.documentationUrl} target="_blank" rel="noreferrer" className="text-cyan-700 underline">{o.documentationUrl}</a></div>
                      <div className="truncate font-mono"><b>Fingerprint:</b> {o.fingerprintSha256}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL NUEVO S2 */}
      {showNewS2Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Registrar Conector Semántico S2</h3>
            <p className="text-xs text-slate-500">Se registrará en estado BORRADOR y requerirá validación y autorización humana.</p>
            <form onSubmit={handleCreateS2} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700">Nombre del Conector</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. S2 Afluencias Málaga Centro"
                  value={s2Name}
                  onChange={e => setS2Name(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Base URL del servicio S2 (NGSI-LD)</label>
                <input
                  type="url"
                  required
                  placeholder="https://s2.destino.gob.es/ngsi-ld/v1"
                  value={s2BaseUrl}
                  onChange={e => setS2BaseUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Tipos de Entidad Permitidos (separados por coma)</label>
                <input
                  type="text"
                  required
                  value={s2Types}
                  onChange={e => setS2Types(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Entidad Responsable</label>
                <input
                  type="text"
                  required
                  value={s2Responsible}
                  onChange={e => setS2Responsible(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Finalidad Declarada</label>
                <input
                  type="text"
                  required
                  value={s2Purpose}
                  onChange={e => setS2Purpose(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewS2Modal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-700 px-4 py-1.5 font-bold text-white hover:bg-cyan-800"
                >
                  Guardar Borrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO IOT */}
      {showNewIotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Registrar Broker MQTT IoT</h3>
            <p className="text-xs text-slate-500">Configuración segura TLS con namespace jerárquico.</p>
            <form onSubmit={handleCreateIot} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700">Nombre del Broker</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Broker Municipal Telemetría"
                  value={iotName}
                  onChange={e => setIotName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700">Host del Broker</label>
                  <input
                    type="text"
                    required
                    value={iotHost}
                    onChange={e => setIotHost(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Puerto (TLS)</label>
                  <input
                    type="number"
                    required
                    value={iotPort}
                    onChange={e => setIotPort(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700">Namespace de Tópico</label>
                <input
                  type="text"
                  required
                  value={iotTopic}
                  onChange={e => setIotTopic(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Entidad Responsable</label>
                <input
                  type="text"
                  required
                  value={iotResponsible}
                  onChange={e => setIotResponsible(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewIotModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-700 px-4 py-1.5 font-bold text-white hover:bg-cyan-800"
                >
                  Guardar Borrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO DISPOSITIVO */}
      {showNewDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Registrar Sensor en Lista Blanca</h3>
            <p className="text-xs text-slate-500">Solo dispositivos registrados pueden enviar telemetría al gemelo.</p>
            <form onSubmit={handleRegisterDevice} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700">Conector Broker IoT</label>
                <select
                  value={selectedConnectorId}
                  onChange={e => setSelectedConnectorId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                >
                  {iotConnectors.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.protocol})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700">Sensor URN (NGSI-LD)</label>
                <input
                  type="text"
                  required
                  value={devUrn}
                  onChange={e => setDevUrn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Nombre del Dispositivo</label>
                <input
                  type="text"
                  required
                  value={devName}
                  onChange={e => setDevName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Concepto de Medición</label>
                  <input
                    type="text"
                    required
                    value={devConcept}
                    onChange={e => setDevConcept(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Unidad (UNECE)</label>
                  <input
                    type="text"
                    required
                    value={devUnit}
                    onChange={e => setDevUnit(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={devLat}
                    onChange={e => setDevLat(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={devLon}
                    onChange={e => setDevLon(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDeviceModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-700 px-4 py-1.5 font-bold text-white hover:bg-cyan-800"
                >
                  Registrar Dispositivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
