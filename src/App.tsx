import { GoogleGeoSuiteModal } from "./components/GoogleGeoSuiteModal";
import { RapidResponseAgentModal } from "./components/RapidResponseAgentModal";
import { MacroOptimizationModal } from "./components/MacroOptimizationModal";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TIPOS_CRUCERO } from './data/cruiseShipTypes';
import { agregarCruceros, descargarPlantillaCrucerosCsv, parsearCrucerosCsv, type BuqueCsv } from './services/cruiseCsv';
import type { TraficoPuertoMalaga } from './services/malagaPortTrafficService';
import { 
  DESTINOS_DEMO, 
  ZONAS_DEMO, 
  RECURSOS_DEMO, 
  SENSORES_DEMO,
  ESCENARIOS_PREDEFINIDOS
} from './data/demoData';
import { MotorContextoSimulacion, ParametrosDestinoConfigurables } from './engine/simulationEngine';
import { MapViewer } from './components/MapViewer';
import WeatherOverlay from './components/WeatherOverlay';
import { HEATMAP_LABELS, TipoMapaCalor } from './services/sensorVisuals';
import { ThreeDViewer } from './components/ThreeDViewer';
import { Static3DContextViewer } from './components/Static3DContextViewer';
import { Real3DTilesViewerHandle } from './components/Real3DTilesViewer';
import { getDestinationVisualAdapter } from './services/destinationVisualCatalog';

const Real3DTilesViewer = lazy(() => import('./components/Real3DTilesViewer').then(m => ({ default: m.Real3DTilesViewer })));
import { CartographicLevelGuide } from './components/CartographicLevelGuide';
import { ScenarioTrendChart } from './components/ScenarioTrendChart';
import { OperationalSnapshotPanel } from './components/OperationalSnapshotPanel';
import { ForecastValidationPanel } from './components/ForecastValidationPanel';
import { generateSyntheticForecastExperiment } from './services/syntheticForecast';
import { createRuntimeScenarioPresets } from './services/scenarioPresetFactory';
import { MultiDestinationModel } from './services/multiDestinationModel';
import { ElementDetailModal } from './components/ElementDetailModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { OleadaDetailModal } from './components/OleadaDetailModal';
import { MultiDestinationModal } from './components/MultiDestinationModal';
import { InteroperabilityModal } from './components/InteroperabilityModal';
import { ContextPackageModal } from './components/ContextPackageModal';
import { ScenarioEditorModal } from './components/ScenarioEditorModal';
import { AiSimulationDrawer } from './components/AiSimulationDrawer';
import { SimulationDesignerModal } from './components/SimulationDesignerModal';
import { OperationalProtocolsModal } from './components/OperationalProtocolsModal';
import { AiAuditHistoryModal } from './components/AiAuditHistoryModal';
import { ForecastCalibrationModal } from './components/ForecastCalibrationModal';
import { InstitutionalAuthModal } from './components/InstitutionalAuthModal';
import { OpenDataLayersModal } from './components/OpenDataLayersModal';
import { DataIngestionModal } from './components/DataIngestionModal';
import { FederatedSimulationModal } from './components/FederatedSimulationModal';
import { Assets3DCatalogModal } from './components/Assets3DCatalogModal';
import { SemanticIotIntegrationModal } from './components/SemanticIotIntegrationModal';
import { ModelCalibrationModal } from './components/ModelCalibrationModal';
import { Edificio3DRecord } from './services/catalog3DService';
import { ContextPackageV1 } from './types/contextPackage';
import { ScenarioDefinition, ScenarioExecution, scenarioToRuntimeBinding } from './types/scenarioStudio';
import { isSessionScenarioId } from './services/sessionScenarios';
import { MODELO_EDITOR_VISUAL, flujosEditorVisual, flujosParaEscenario } from './services/modelFlows';
import { ContextoIndicadores } from './services/indicatorQa';
import {
  Globe,
  Scale,
  Activity, 
  Layers, 
  Sliders, 
  AlertTriangle, 
  TrendingUp, 
  Compass, 
  Wind, 
  Volume2, 
  Users, 
  BarChart3, 
  RotateCcw, 
  ChevronRight, 
  ShieldCheck,
  CloudRain,
  Sun,
  FlaskConical,
  Info,
  Network,
  PlugZap,
  Play,
  Pause, 
  FilePlus2,
  Sparkles
  , KeyRound
  , Database
  , UploadCloud
  , Share2
  , Box,
  Bot,
  Zap,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Accessibility,
  HeartPulse,
  Bus,
  GraduationCap,
} from 'lucide-react';
import { KpiMapa } from './services/kpiBuildingColors';

// Simulaciones pendientes de desarrollo: se listan como "Solicitado" en el panel izquierdo (modelos por destino).
// Red de drenaje de referencia (Escenario 3): con estos valores la lluvia produce el efecto base.
// Pasajeros equivalentes del ajuste manual por defecto (2 llegadas x 9.500): magnitud 1 del Escenario 1.
const PASAJEROS_REFERENCIA_CRUCEROS = 2 * 9500;

const DRENAJE_REFERENCIA ={ eficiencia: 70, imbornales: 4000, caudalLs: 20 };
const CAPACIDAD_DRENAJE_REFERENCIA_LS = DRENAJE_REFERENCIA.imbornales * DRENAJE_REFERENCIA.caudalLs * (DRENAJE_REFERENCIA.eficiencia / 100);

const SIMULACIONES_SOLICITADAS = [
  { nombre: 'Playas', descripcion: 'Ocupación y capacidad de carga de playas y frente litoral.' },
  { nombre: 'Cicloturismo', descripcion: 'Flujos y demanda de rutas ciclistas y servicios asociados.' }
];

export default function App() {
  // 1. Estado del Destino seleccionado
  const [destinoSeleccionadoId, setDestinoSeleccionadoId] = useState<string>(() => DESTINOS_DEMO[0]?.id || '');
  const [contextPackages, setContextPackages] = useState<ContextPackageV1[]>([]);
  const destinosDisponibles = useMemo(() => [
    ...DESTINOS_DEMO,
    ...contextPackages.map(contextPackage => contextPackage.destination),
  ], [contextPackages]);
  const destinoActual = useMemo(() => {
    return destinosDisponibles.find(d => d.id === destinoSeleccionadoId) || destinosDisponibles[0];
  }, [destinoSeleccionadoId, destinosDisponibles]);
  const contextPackageActual = useMemo(
    () => contextPackages.find(contextPackage => contextPackage.destination.id === destinoActual.id),
    [contextPackages, destinoActual.id],
  );
  const tenantDestinoActual = useMemo(() => (
    contextPackageActual?.tenant.id || MultiDestinationModel.getProfile(destinoActual.id)?.tenantId || ''
  ), [contextPackageActual?.tenant.id, destinoActual.id]);
  const visualAdapter = useMemo(() => getDestinationVisualAdapter(destinoActual.id), [destinoActual.id]);

  // 2. Estado de Capas del Visor
  const [capasActivas, setCapasActivas] = useState({
    zonas: true,
    calor: true,
    recursos: true,
    sensores: true,
    rutas: true,
  });
  const [tipoMapaCalor, setTipoMapaCalor] = useState<TipoMapaCalor>('afluencia');
  const [reglaModeloActiva, setReglaModeloActiva] = useState<string | null>(null);

  // 3. Nivel de representación geoespacial del mismo gemelo y motor de simulación.
  const [nivelVisualizacion, setNivelVisualizacion] = useState<1 | 2 | 3 | 4>(() => {
    if (typeof window !== 'undefined') {
      const nivel = new URLSearchParams(window.location.search).get('nivel');
      if (nivel === '2') return 2;
      if (nivel === '3') return 3;
      if (nivel === '4') return 4;
    }
    return 1;
  });
  const [modo3DCompatible, setModo3DCompatible] = useState(false);
  const activarModoCompatible = useCallback(() => setModo3DCompatible(true), []);

  // 4. Parámetros de simulación
  const [escenarioSeleccionadoId, setEscenarioSeleccionadoId] = useState<string>('base');
  const [incrementoManual, setIncrementoManual] = useState<number>(0);
  const [clima, setClima] = useState<'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO'>('DESPEJADO');
  const [umbralAlerta, setUmbralAlerta] = useState<number>(85);
  const [horaSimulacion, setHoraSimulacion] = useState<number>(10);
  const [reproduciendoSimulacion, setReproduciendoSimulacion] = useState<boolean>(false);
  const [numeroCruceros, setNumeroCruceros] = useState<number>(2);
  // Escenario 1: parámetros fijos, flota por tipos de crucero o tráfico real del puerto de Málaga.
  const [modoCruceros, setModoCruceros] = useState<'manual' | 'flota' | 'tiempo_real' | 'archivo'>('manual');
  // Cruceros importados desde un CSV (arrastrar y soltar en el panel derecho).
  const [crucerosCsv, setCrucerosCsv] = useState<{ archivo: string; buques: BuqueCsv[]; avisos: string[] } | null>(null);
  const [fechaCsv, setFechaCsv] = useState<string>('');
  const [errorCsv, setErrorCsv] = useState<string | null>(null);
  const [arrastrandoCsv, setArrastrandoCsv] = useState<boolean>(false);
  const buquesCsvFecha = useMemo(() => (crucerosCsv?.buques ?? []).filter(b => b.fecha === fechaCsv), [crucerosCsv, fechaCsv]);
  const agregadoCsv = useMemo(() => agregarCruceros(buquesCsvFecha), [buquesCsvFecha]);
  const fechasCsv = useMemo(() => [...new Set((crucerosCsv?.buques ?? []).map(b => b.fecha))].sort(), [crucerosCsv]);
  const [flotaCruceros, setFlotaCruceros] = useState<Record<string, number>>({ mediano: 1, grande: 1 });
  const [traficoPuerto, setTraficoPuerto] = useState<TraficoPuertoMalaga | null>(null);
  const [traficoPuertoEstado, setTraficoPuertoEstado] = useState<'idle' | 'cargando' | 'error'>('idle');
  const [pasajerosCruceros, setPasajerosCruceros] = useState<number>(9500);
  const [porcentajeDesembarco, setPorcentajeDesembarco] = useState<number>(78);
  const [asistentesEvento, setAsistentesEvento] = useState<number>(32000);
  const [precipitacionMmH, setPrecipitacionMmH] = useState<number>(45);
  const [eficienciaDrenaje, setEficienciaDrenaje] = useState<number>(DRENAJE_REFERENCIA.eficiencia);
  const [numeroImbornales, setNumeroImbornales] = useState<number>(DRENAJE_REFERENCIA.imbornales);
  const [caudalImbornalLs, setCaudalImbornalLs] = useState<number>(DRENAJE_REFERENCIA.caudalLs);

  // 5. Modales e interacciones
  const [elementoSeleccionado, setElementoSeleccionado] = useState<{ tipo: any; data: any } | null>(null);
  const [modalArquitecturaAbierto, setModalArquitecturaAbierto] = useState<boolean>(false);
  const [modalMultidestinoAbierto, setModalMultidestinoAbierto] = useState<boolean>(false);
  const [modalInteroperabilidadAbierto, setModalInteroperabilidadAbierto] = useState<boolean>(false);
  const [modalContextPackageAbierto, setModalContextPackageAbierto] = useState<boolean>(false);
  const [modalEditorEscenariosAbierto, setModalEditorEscenariosAbierto] = useState<boolean>(false);
  const [modalDisenadorAbierto, setModalDisenadorAbierto] = useState<boolean>(false);
  const [modalProtocolosAbierto, setModalProtocolosAbierto] = useState<boolean>(false);
  const [modalAuditoriaAiAbierto, setModalAuditoriaAiAbierto] = useState<boolean>(false);
  const [modalCalibracionAbierto, setModalCalibracionAbierto] = useState<boolean>(false);
  const [modalMacroOptAbierto, setModalMacroOptAbierto] = useState<boolean>(false);
  const [modalRapidResponseAbierto, setModalRapidResponseAbierto] = useState<boolean>(false);
  const [seccionCabeceraActiva, setSeccionCabeceraActiva] = useState<'visor' | 'simulacion' | 'operacion' | 'datos'>('simulacion');
  const [modalAuthAbierto, setModalAuthAbierto] = useState<boolean>(false);
  const [modalDatosAbiertosAbierto, setModalDatosAbiertosAbierto] = useState<boolean>(false);
  const [modalIngestionAbierto, setModalIngestionAbierto] = useState<boolean>(false);
  const [modalFederacionAbierto, setModalFederacionAbierto] = useState<boolean>(false);
  const [modalAssets3DAbierto, setModalAssets3DAbierto] = useState<boolean>(false);
  const [modalSemanticIotAbierto, setModalSemanticIotAbierto] = useState<boolean>(false);
  const [modalGoogleGeoAbierto, setModalGoogleGeoAbierto] = useState<boolean>(false);

  const [drawerAiAbierto, setDrawerAiAbierto] = useState<boolean>(false);
  // Simulaciones creadas por el usuario (catálogo, paquete YAML o editor visual): solo en memoria de esta sesión.
  const [escenariosSesion, setEscenariosSesion] = useState<ScenarioDefinition[]>([]);
  const escenariosSesionDestino = useMemo(
    () => escenariosSesion.filter(escenario => escenario.destinationId === destinoActual.id),
    [escenariosSesion, destinoActual.id],
  );
  const escenarioEditorActivo = escenariosSesionDestino.find(escenario => escenario.id === escenarioSeleccionadoId) ?? null;
  // Registrar (o actualizar) un escenario de sesión; pasar null no hace nada.
  const setEscenarioEditorActivo = (escenario: ScenarioDefinition | null) => {
    if (!escenario) return;
    setEscenariosSesion(actuales => [...actuales.filter(item => item.id !== escenario.id), escenario]);
  };
  const handleEliminarEscenarioSesion = (escenarioId: string) => {
    setEscenariosSesion(actuales => actuales.filter(item => item.id !== escenarioId));
    if (escenarioSeleccionadoId === escenarioId) setEscenarioSeleccionadoId('base');
  };
  const [ultimaEjecucionEditor, setUltimaEjecucionEditor] = useState<ScenarioExecution | null>(null);
  const [fichaNivelAbierta, setFichaNivelAbierta] = useState<boolean>(false);
  const [edificioSeleccionado, setEdificioSeleccionado] = useState<Edificio3DRecord | null>(null);
  const real3DViewerRef = useRef<Real3DTilesViewerHandle>(null);
  // Orden de "Capacidad de Carga por Zona": null = orden original.
  const [ordenZonas, setOrdenZonas] = useState<'asc' | 'desc' | null>(null);
  const [kpiMapa, setKpiMapa] = useState<KpiMapa>('visitantes');
  const [pestañaLateral, setPestañaLateral] = useState<'capas' | 'simulador' | 'kpis' | 'validacion' | 'sensores'>('simulador');

  // 6. Ejecución reactiva del Motor de Simulación
  // Los escenarios de la v3 (ids con guion bajo) comparten parámetros con los presets generados.
  const claveEscenario = ({ crucero_masivo: 'presion-alta-demanda', evento_cultural: 'evento-local', episodio_meteo: 'episodio-meteorologico' } as Record<string, string>)[escenarioSeleccionadoId] ?? escenarioSeleccionadoId;
  const intensidadTemporal = useMemo(() => {
    if (claveEscenario === 'presion-alta-demanda') {
      if (modoCruceros === 'archivo') return agregadoCsv.intensidad[horaSimulacion] ?? 0;
      const curva = [0.08, 0.2, 0.55, 1, 0.92, 0.72, 0.48, 0.28, 0.14];
      return curva[Math.max(0, Math.min(curva.length - 1, horaSimulacion - 8))] ?? (horaSimulacion < 8 ? 0.04 : 0.08);
    }
    if (claveEscenario === 'evento-local') {
      const horaNocturna = horaSimulacion < 6 ? horaSimulacion + 24 : horaSimulacion;
      const distanciaPico = Math.abs(horaNocturna - 22);
      return horaNocturna < 18 || horaNocturna > 26 ? 0.05 : Math.max(0.18, 1 - distanciaPico * 0.2);
    }
    if (claveEscenario === 'episodio-meteorologico') {
      const distanciaPico = Math.abs(horaSimulacion - 18);
      return distanciaPico > 4 ? 0.05 : Math.max(0.12, 1 - distanciaPico * 0.24);
    }
    return 0;
  }, [claveEscenario, horaSimulacion, modoCruceros, agregadoCsv]);

  // Pasajeros que llegan según el modo: flota elegida por tipos o buques detectados en el puerto.
  const pasajerosModoCruceros = modoCruceros === 'flota'
    ? TIPOS_CRUCERO.reduce((total, tipo) => total + (flotaCruceros[tipo.id] ?? 0) * tipo.capacidad, 0)
    : modoCruceros === 'archivo'
      ? buquesCsvFecha.reduce((total, buque) => total + buque.pasajeros, 0)
    : modoCruceros === 'tiempo_real'
      ? (traficoPuerto?.buques ?? []).reduce((total, buque) => total + buque.capacidad, 0)
      : 0;

  // Tráfico del puerto de Málaga: se consulta al activar el modo y se refresca cada minuto.
  const cargarTraficoPuerto = useCallback(async () => {
    setTraficoPuertoEstado('cargando');
    try {
      const respuesta = await fetch('/api/puerto/malaga/trafico');
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      setTraficoPuerto(await respuesta.json());
      setTraficoPuertoEstado('idle');
    } catch {
      setTraficoPuertoEstado('error');
    }
  }, []);
  useEffect(() => {
    if (modoCruceros !== 'tiempo_real') return;
    void cargarTraficoPuerto();
    const id = window.setInterval(() => void cargarTraficoPuerto(), 60000);
    return () => window.clearInterval(id);
  }, [modoCruceros, cargarTraficoPuerto]);

  const cargarArchivoCruceros = useCallback(async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      const { buques, avisos } = parsearCrucerosCsv(await archivo.text());
      const primeraFecha = [...new Set(buques.map(b => b.fecha))].sort()[0];
      setCrucerosCsv({ archivo: archivo.name, buques, avisos });
      setFechaCsv(primeraFecha);
      setModoCruceros('archivo');
      setErrorCsv(null);
      setHoraSimulacion(agregarCruceros(buques.filter(b => b.fecha === primeraFecha)).horaPico);
      setReproduciendoSimulacion(false);
    } catch (error) {
      setErrorCsv(error instanceof Error ? error.message : 'No se pudo leer el archivo CSV.');
    }
  }, []);

  // Capacidad de evacuación de la red de imbornales (L/s) = nº de imbornales x caudal medio x eficiencia.
  const capacidadDrenajeLs = numeroImbornales * caudalImbornalLs * (eficienciaDrenaje / 100);

  const magnitudEscenario = useMemo(() => {
    if (claveEscenario === 'presion-alta-demanda') {
      if (modoCruceros === 'archivo') return Math.min(1.5, agregadoCsv.pico / (PASAJEROS_REFERENCIA_CRUCEROS * 0.78));
      if (modoCruceros !== 'manual') return Math.min(1.5, (pasajerosModoCruceros / PASAJEROS_REFERENCIA_CRUCEROS) * (porcentajeDesembarco / 78));
      return Math.min(1.5, (numeroCruceros / 2) * (pasajerosCruceros / 9500) * (porcentajeDesembarco / 78));
    }
    if (claveEscenario === 'evento-local') return Math.min(1.5, asistentesEvento / 32000);
    if (claveEscenario === 'episodio-meteorologico') {
      // Menos capacidad de evacuación que la de referencia => más agua acumulada para la misma lluvia.
      const presionDrenaje = Math.min(1.8, Math.max(0.4, Math.pow(CAPACIDAD_DRENAJE_REFERENCIA_LS / Math.max(1, capacidadDrenajeLs), 0.6)));
      return Math.min(1.5, (precipitacionMmH / 45) * presionDrenaje);
    }
    return 0;
  }, [claveEscenario, numeroCruceros, pasajerosCruceros, porcentajeDesembarco, modoCruceros, pasajerosModoCruceros, agregadoCsv, asistentesEvento, precipitacionMmH, capacidadDrenajeLs]);

  const parametrosBaseSimulacion: ParametrosDestinoConfigurables = useMemo(() => ({
    umbralSaturacionAlerta: umbralAlerta,
    pesoCapacidadFisica: 0.6,
    pesoCapacidadPsicologica: 0.4,
    tasaEmisionKgCo2PorPersonaHora: 0.12,
    incrementoVisitantesManualPct: incrementoManual,
    franjaHoraria: `${String(horaSimulacion).padStart(2, '0')}:00`,
    condicionClima: clima,
    horaSimulacion,
    intensidadEscenario: intensidadTemporal * magnitudEscenario,
    factorCapacidadOperativa: 1,
    factorMovilidad: 1,
  }), [umbralAlerta, incrementoManual, clima, horaSimulacion, intensidadTemporal, magnitudEscenario]);

  const escenarioEditorBinding = useMemo(() => (
    escenarioEditorActivo && escenarioEditorActivo.destinationId === destinoActual.id
      ? scenarioToRuntimeBinding(escenarioEditorActivo)
      : null
  ), [escenarioEditorActivo, destinoActual.id]);

  const zonasDisponibles = useMemo(
    () => [...ZONAS_DEMO, ...contextPackages.flatMap(contextPackage => contextPackage.context.zones)],
    [contextPackages],
  );
  const recursosDisponibles = useMemo(
    () => [...RECURSOS_DEMO, ...contextPackages.flatMap(contextPackage => contextPackage.context.resources)],
    [contextPackages],
  );
  const sensoresDisponibles = useMemo(
    () => [...SENSORES_DEMO, ...contextPackages.flatMap(contextPackage => contextPackage.context.sensors)],
    [contextPackages],
  );

  const zonasFiltradas = useMemo(() => {
    return zonasDisponibles.filter(z => z.destinoId === destinoActual.id);
  }, [destinoActual.id, zonasDisponibles]);

  const recursosFiltrados = useMemo(() => {
    return recursosDisponibles.filter(r => r.destinoId === destinoActual.id);
  }, [destinoActual.id, recursosDisponibles]);

  const sensoresFiltrados = useMemo(() => {
    return sensoresDisponibles.filter(s => s.destinoId === destinoActual.id);
  }, [destinoActual.id, sensoresDisponibles]);

  // Flujos turísticos propios de la simulación del catálogo activa (más la Ruta de Desvío con lluvia o calor).
  const flujosModelo = useMemo(
    () => escenarioEditorActivo?.sourceModelId === MODELO_EDITOR_VISUAL
      ? flujosEditorVisual(escenarioEditorActivo.inputs.zoneIds, zonasFiltradas, destinoActual.centro, clima)
      : flujosParaEscenario(escenarioEditorActivo?.sourceModelId, clima),
    [escenarioEditorActivo, zonasFiltradas, destinoActual.centro, clima],
  );
  const escenariosDisponibles = useMemo(
    () => [
      // Destinos demostradores: escenarios de la v3 (crucero, evento, episodio meteorológico).
      ...(destinoActual.id === 'malaga' || destinoActual.id === 'palma'
        ? ESCENARIOS_PREDEFINIDOS
        : createRuntimeScenarioPresets(zonasFiltradas)),
      ...escenariosSesionDestino.map(escenario => scenarioToRuntimeBinding(escenario).scenario),
    ],
    [destinoActual.id, zonasFiltradas, escenariosSesionDestino],
  );

  const escenarioActual = useMemo(() => {
    return escenariosDisponibles.find(escenario => escenario.id === escenarioSeleccionadoId) || escenariosDisponibles[0];
  }, [escenarioSeleccionadoId, escenariosDisponibles]);

  const parametrosSimulacion = escenarioEditorBinding?.scenario.id === escenarioActual.id
    ? escenarioEditorBinding.parameters
    : parametrosBaseSimulacion;

  // Los escenarios generados en tiempo de ejecución usan ids propios; los visores identifican la
  // narrativa cartográfica (flujos, lluvia) por el tipo de escenario, como en la v3.
  const escenarioVisualId = escenarioActual.id === 'base'
    ? 'base'
    : escenarioActual.tipo === 'CRUCERO_MASIVO' ? 'crucero_masivo'
    : escenarioActual.tipo === 'EVENTO_CULTURAL' ? 'evento_cultural'
    : escenarioActual.tipo === 'EPISODIO_METEO' ? 'episodio_meteo'
    : escenarioActual.id;

  const intensidadVisual = escenarioEditorBinding?.scenario.id === escenarioActual.id
    ? escenarioEditorBinding.parameters.intensidadEscenario
    : Math.min(1.5, intensidadTemporal * magnitudEscenario);

  const resultadoSimulacion = useMemo(() => {
    return MotorContextoSimulacion.simular(
      zonasFiltradas,
      recursosFiltrados,
      sensoresFiltrados,
      escenarioActual,
      parametrosSimulacion
    );
  }, [zonasFiltradas, recursosFiltrados, sensoresFiltrados, escenarioActual, parametrosSimulacion]);

  // Lectura independiente de la situación actual, previa a aplicar el escenario What-If.
  const datosActuales = useMemo(() => {
    const visitantes = zonasFiltradas.reduce((total, zona) => total + zona.afluenciaActual, 0);
    const saturacion = zonasFiltradas.length
      ? Number((zonasFiltradas.reduce((total, zona) => total + zona.capacidadCargaPct, 0) / zonasFiltradas.length).toFixed(1))
      : 0;
    const alertas = zonasFiltradas.filter(zona => zona.capacidadCargaPct >= umbralAlerta).length;
    return { visitantes, saturacion, alertas };
  }, [zonasFiltradas, umbralAlerta]);

  // Perfil declarativo que demuestra que el motor no se limita a sliders globales.
  const configuracionModelo = useMemo(() => {
    if (contextPackageActual) {
      return {
        nombre: contextPackageActual.context.modelProfile.name,
        version: contextPackageActual.context.modelProfile.version,
        reglas: contextPackageActual.context.variables.map(variable => variable.label),
        fuentes: contextPackageActual.context.dataSources.map(source => source.name)
      };
    }
    if (destinoActual.id === 'palma') {
      return {
        nombre: 'Modelo insular Puerto–Centro histórico',
        version: 'PID-PMI-1.1',
        reglas: ['Desembarco de cruceros', 'Dispersión peatonal', 'Capacidad patrimonial'],
        fuentes: ['APB', 'Sensores Paseo del Borne', 'PID Turismo Baleares']
      };
    }
    if (destinoActual.id === 'malaga') {
      return {
        nombre: 'Modelo litoral Centro histórico–Puerto',
        version: 'PID-AGP-1.3',
        reglas: ['Flujo de cruceros', 'Protección patrimonial', 'Confort térmico'],
        fuentes: ['Puerto de Málaga', 'IoT Calle Larios', 'PID Turismo Andalucía']
      };
    }
    return {
      nombre: 'Perfil operacional demostrador',
      version: 'PID-RUNTIME-1.0',
      reglas: ['Capacidad de carga', 'Distribución de flujos', 'Confort y condición meteorológica'],
      fuentes: [...zonasFiltradas, ...recursosFiltrados, ...sensoresFiltrados]
        .map(entidad => entidad.gobernanza.fuente)
        .filter((fuente, index, values) => values.indexOf(fuente) === index)
    };
  }, [contextPackageActual, destinoActual.id, zonasFiltradas, recursosFiltrados, sensoresFiltrados]);

  const experimentoPredictivo = useMemo(() => generateSyntheticForecastExperiment({
    contextFingerprint: contextPackageActual?.id || `catalog-${destinoActual.id}-${zonasFiltradas.length}-${recursosFiltrados.length}-${sensoresFiltrados.length}`,
    modelVersion: contextPackageActual?.context.modelProfile.version || configuracionModelo.version,
    baselineVisitors: datosActuales.visitantes,
    scenarioFactor: escenarioActual.factorAfluencia,
    manualVariation: incrementoManual,
    climate: clima,
    saturation: resultadoSimulacion.indicadoresSimulados.saturacionGlobalPct,
    alertThreshold: umbralAlerta
  }), [contextPackageActual?.id, destinoActual.id, zonasFiltradas.length, recursosFiltrados.length, sensoresFiltrados.length, configuracionModelo.version, datosActuales.visitantes, escenarioActual.factorAfluencia, incrementoManual, clima, resultadoSimulacion.indicadoresSimulados.saturacionGlobalPct, umbralAlerta]);

  useEffect(() => {
    if (!reproduciendoSimulacion) return;
    const timer = window.setInterval(() => setHoraSimulacion(hora => (hora + 1) % 24), 1100);
    return () => window.clearInterval(timer);
  }, [reproduciendoSimulacion]);

  const handleSeleccionarEscenario = (escenarioId: string) => {
    if (ultimaEjecucionEditor?.scenario.id !== escenarioId) setUltimaEjecucionEditor(null);
    setEscenarioSeleccionadoId(escenarioId);
    setReproduciendoSimulacion(false);
    setTipoMapaCalor('afluencia');
    setCapasActivas({ zonas: true, calor: true, recursos: true, sensores: true, rutas: true });

    const escenarioSesion = escenariosSesionDestino.find(escenario => escenario.id === escenarioId);
    if (escenarioSesion) {
      setHoraSimulacion(escenarioSesion.inputs.hour);
      setClima(escenarioSesion.inputs.climate);
      setIncrementoManual(escenarioSesion.inputs.visitorVariationPct);
      setUmbralAlerta(escenarioSesion.inputs.alertThresholdPct);
    } else if (escenarioId === 'presion-alta-demanda' || escenarioId === 'crucero_masivo') {
      setHoraSimulacion(10);
      setClima('DESPEJADO');
    } else if (escenarioId === 'evento-local' || escenarioId === 'evento_cultural') {
      setHoraSimulacion(22);
      setClima('DESPEJADO');
    } else if (escenarioId === 'episodio-meteorologico' || escenarioId === 'episodio_meteo') {
      setHoraSimulacion(18);
      setClima('LLUVIA');
    } else {
      setHoraSimulacion(12);
      setClima('DESPEJADO');
    }
  };

  // Manejador de reseteo de simulación
  const handleResetSimulacion = () => {
    setEscenarioSeleccionadoId('base');
    setEscenarioEditorActivo(null);
    setUltimaEjecucionEditor(null);
    setIncrementoManual(0);
    setClima('DESPEJADO');
    setUmbralAlerta(85);
    setReglaModeloActiva(null);
    setHoraSimulacion(12);
    setReproduciendoSimulacion(false);
    setNumeroCruceros(2);
    setModoCruceros('manual');
    setFlotaCruceros({ mediano: 1, grande: 1 });
    setPasajerosCruceros(9500);
    setPorcentajeDesembarco(78);
    setAsistentesEvento(32000);
    setPrecipitacionMmH(45);
    setEficienciaDrenaje(DRENAJE_REFERENCIA.eficiencia);
    setNumeroImbornales(DRENAJE_REFERENCIA.imbornales);
    setCaudalImbornalLs(DRENAJE_REFERENCIA.caudalLs);
  };

  // Ids de escenario según el catálogo activo (v3 en destinos demostradores, presets generados en el resto).
  const idEscenarioCrucero = escenariosDisponibles.some(e => e.id === 'crucero_masivo') ? 'crucero_masivo' : 'presion-alta-demanda';
  const idEscenarioEvento = escenariosDisponibles.some(e => e.id === 'evento_cultural') ? 'evento_cultural' : 'evento-local';

  // Regla del modelo activa, derivada de la simulación en curso (se actualice desde donde se actualice).
  const reglaModeloVisible = useMemo(() => {
    const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const coincide = (regla: string) => {
      const r = normalizar(regla);
      if (r.includes('confort')) return escenarioSeleccionadoId === 'base' && clima === 'CALOR_EXTREMO';
      if (r.includes('proteccion') || r.includes('capacidad patrimonial')) return escenarioSeleccionadoId === idEscenarioEvento;
      return escenarioSeleccionadoId === idEscenarioCrucero;
    };
    if (reglaModeloActiva && configuracionModelo.reglas.includes(reglaModeloActiva) && coincide(reglaModeloActiva)) {
      return reglaModeloActiva;
    }
    return configuracionModelo.reglas.find(coincide) ?? null;
  }, [reglaModeloActiva, configuracionModelo.reglas, escenarioSeleccionadoId, clima, idEscenarioCrucero, idEscenarioEvento]);

  // Cada regla del modelo funciona como una vista operativa y coordina lo que se representa.
  const handleAplicarReglaModelo = (regla: string) => {
    const reglaNormalizada = regla.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    setReglaModeloActiva(regla);
    setNivelVisualizacion(1);
    setElementoSeleccionado(null);
    setEdificioSeleccionado(null);
    setPestañaLateral('simulador');

    if (reglaNormalizada.includes('confort')) {
      setEscenarioSeleccionadoId('base');
      setClima('CALOR_EXTREMO');
      setTipoMapaCalor('temperatura');
      setCapasActivas({ zonas: false, calor: true, recursos: false, sensores: true, rutas: false });
      return;
    }

    if (reglaNormalizada.includes('proteccion') || reglaNormalizada.includes('capacidad patrimonial')) {
      handleSeleccionarEscenario(idEscenarioEvento);
      setTipoMapaCalor('afluencia');
      setCapasActivas({ zonas: true, calor: true, recursos: true, sensores: false, rutas: false });
      return;
    }

    if (reglaNormalizada.includes('dispersion')) {
      handleSeleccionarEscenario(idEscenarioCrucero);
      setTipoMapaCalor('afluencia');
      setCapasActivas({ zonas: true, calor: true, recursos: true, sensores: true, rutas: true });
      return;
    }

    // Presión sobre los flujos de entrada del destino.
    handleSeleccionarEscenario(idEscenarioCrucero);
    setTipoMapaCalor('afluencia');
    setCapasActivas({ zonas: true, calor: true, recursos: true, sensores: true, rutas: true });
  };

  const handleContextPackageImported = (contextPackage: ContextPackageV1) => {
    setContextPackages(current => current.some(item => item.id === contextPackage.id) ? current : [...current, contextPackage]);
    setDestinoSeleccionadoId(contextPackage.destination.id);
    setEscenarioSeleccionadoId('base');
    setEscenarioEditorActivo(null);
    setUltimaEjecucionEditor(null);
    setReglaModeloActiva(null);
    setNivelVisualizacion(1);
    setModo3DCompatible(false);
    setPestañaLateral('simulador');
  };

  const handleScenarioEditorExecuted = (execution: ScenarioExecution) => {
    setEscenarioEditorActivo(execution.scenario);
    setUltimaEjecucionEditor(execution);
    setEscenarioSeleccionadoId(execution.scenario.id);
    setHoraSimulacion(execution.scenario.inputs.hour);
    setClima(execution.scenario.inputs.climate);
    setIncrementoManual(execution.scenario.inputs.visitorVariationPct);
    setUmbralAlerta(execution.scenario.inputs.alertThresholdPct);
    setReproduciendoSimulacion(false);
    setTipoMapaCalor('afluencia');
    setCapasActivas({ zonas: true, calor: true, recursos: true, sensores: true, rutas: true });
    setPestañaLateral('kpis');
    setModalEditorEscenariosAbierto(false);
  };

  // Instantánea de indicadores que consulta el asistente IA (situación actual + escenario activo).
  const contextoIndicadores = useMemo<ContextoIndicadores>(() => ({
    destino: destinoActual.nombre,
    escenario: escenarioActual.nombre,
    clima,
    hora: horaSimulacion,
    actuales: resultadoSimulacion.indicadoresActuales,
    simulados: resultadoSimulacion.indicadoresSimulados,
    zonas: resultadoSimulacion.zonasResultados.map(z => ({
      nombre: z.nombre,
      aforoMaximo: z.aforoMaximo,
      afluenciaActual: z.afluenciaActual,
      afluenciaSimulada: z.afluenciaSimulada,
      capacidadActualPct: z.capacidadCargaPct,
      capacidadSimuladaPct: z.capacidadCargaSimuladaPct,
      riesgo: z.nivelRiesgo,
    })),
    sensores: resultadoSimulacion.sensoresSimulados.map(sensor => ({
      nombre: sensor.nombre,
      tipo: sensor.tipoSensor,
      valor: sensor.valorSimulado,
      unidad: sensor.unidad,
      estado: sensor.estadoSimulado,
    })),
    recomendaciones: resultadoSimulacion.recomendacionesGestion,
  }), [destinoActual.nombre, escenarioActual.nombre, clima, horaSimulacion, resultadoSimulacion]);

  return (
    <div className="pid-light flex h-screen w-screen overflow-hidden bg-white font-sans text-slate-800">
      
      {/* ======================================================== */}
      {/* CABECERA CONTEXTUAL PID: NAVEGACIÓN POR ÁREAS DE TRABAJO */}
      {/* ======================================================== */}
      <header className="absolute top-0 left-0 right-0 z-30 h-[104px] border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        {/* Fila 1 · Identidad, destino y áreas principales */}
        <div className="flex h-14 items-center gap-4 px-4 md:px-5">
          <div className="flex shrink-0 items-center gap-2.5">
            <img
              src="/pid-logo.png"
              alt="Plataforma Inteligente de Destinos"
              className="h-8 w-auto max-w-[158px] object-contain"
            />
            <span className="hidden h-7 w-px bg-slate-200 xl:block" />
            <div className="hidden xl:block leading-tight">
              <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-pink-600">PID · SEGITTUR</span>
              <h1 className="text-xs font-bold text-slate-900">Gemelo Digital Turístico</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <Compass className="h-3.5 w-3.5 text-cyan-600" />
            <select
              value={destinoSeleccionadoId}
              onChange={(e) => {
                setDestinoSeleccionadoId(e.target.value);
                setEscenarioSeleccionadoId('base');
                setEscenarioEditorActivo(null);
                setUltimaEjecucionEditor(null);
                setReglaModeloActiva(null);
                setModo3DCompatible(false);
              }}
              className="min-w-[210px] max-w-[260px] bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
              title="Seleccionar destino en el Gemelo Digital Turístico alineado con la PID"
            >
              {destinosDisponibles.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Navegación principal: cuatro áreas, no una fila de utilidades */}
          <nav className="hidden min-[1180px]:flex flex-1 items-center justify-center gap-1" aria-label="Áreas principales del Gemelo">
            <button
              onClick={() => { setSeccionCabeceraActiva('visor'); setPestañaLateral('sensores'); }}
              title="Área territorial Inteligencia de Localizaciones"
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                seccionCabeceraActiva === 'visor' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Territorio
            </button>
            <button
              onClick={() => { setSeccionCabeceraActiva('simulacion'); setPestañaLateral('simulador'); }}
              title="Área de previsión y simulación"
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                seccionCabeceraActiva === 'simulacion' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-red-50 hover:text-red-700'
              }`}
            >
              Simulación
            </button>
            <button
              onClick={() => setSeccionCabeceraActiva('operacion')}
              title="Protocolos, control humano, identidad y trazabilidad del Gemelo"
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                seccionCabeceraActiva === 'operacion' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
              }`}
            >
              Operación y trazabilidad
            </button>
            <button
              onClick={() => setSeccionCabeceraActiva('datos')}
              title="Datos semánticos S2, conectores y capa de interoperabilidad PID"
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                seccionCabeceraActiva === 'datos' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
              }`}
            >
              Datos e interoperabilidad
            </button>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden 2xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Marco PID
            </span>
            <button
              onClick={() => { setSeccionCabeceraActiva('simulacion'); setDrawerAiAbierto(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
              title="Preguntar al asistente IA sobre los indicadores"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Asistente IA</span>
              <span className="sm:hidden">IA</span>
            </button>
          </div>
        </div>

        {/* Fila 2 · Herramientas contextuales de una única área */}
        <div className="flex h-[50px] items-center gap-3 overflow-x-auto border-t border-slate-100 bg-slate-50/90 px-4 md:px-5 scrollbar-none">
          {seccionCabeceraActiva === 'visor' && (
            <>
              <div className="flex shrink-0 items-center gap-1.5 pr-2 text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">
                <Layers className="h-3.5 w-3.5 text-cyan-600" /> Localización
              </div>
              <div className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                <button onClick={() => setNivelVisualizacion(1)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${nivelVisualizacion === 1 ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>1 · Base 2D</button>
                <button onClick={() => { setNivelVisualizacion(2); setPestañaLateral('capas'); }}className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${nivelVisualizacion === 2 ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>2 · Terreno</button>
                <button onClick={() => { setNivelVisualizacion(3); setPestañaLateral('kpis'); }} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${nivelVisualizacion === 3 ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>3 · 3D / LiDAR</button>
                <button onClick={() => { setNivelVisualizacion(4); setPestañaLateral('simulador'); }} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${nivelVisualizacion === 4 ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>4 · Analítica 4D</button>
              </div>
              <button onClick={() => setFichaNivelAbierta(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100">
                <Info className="h-3.5 w-3.5 text-slate-500" /> Ficha territorial
              </button>
              <button onClick={() => setModalAssets3DAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-800 transition-colors hover:bg-cyan-100">
                <Box className="h-3.5 w-3.5" /> Catálogo 3D / 4D
              </button>
            </>
          )}

          {seccionCabeceraActiva === 'simulacion' && (
            <>
              <div className="flex shrink-0 items-center gap-1.5 pr-2 text-[10px] font-bold uppercase tracking-[0.11em] text-red-700">
                <Sliders className="h-3.5 w-3.5" /> Escenarios y modelos
              </div>
              <button onClick={() => setModalDisenadorAbierto(true)} title="Diseñar una nueva simulación configurable por el destino" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-red-700">
                <Sliders className="h-3.5 w-3.5" /> + Nueva simulación
              </button>
              <button onClick={() => setDrawerAiAbierto(true)} title="Preguntar al asistente IA sobre los indicadores" className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50">
                <Sparkles className="h-3.5 w-3.5" /> Asistente IA
              </button>
              <button onClick={() => setModalMacroOptAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100">
                <Scale className="h-3.5 w-3.5 text-amber-600" /> Impacto & optimización
              </button>
              <button onClick={() => setModalCalibracionAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-800 transition-colors hover:bg-blue-100">
                <TrendingUp className="h-3.5 w-3.5" /> Calibrar predicción
              </button>
              <button onClick={() => setModalFederacionAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-800 transition-colors hover:bg-indigo-100">
                <Share2 className="h-3.5 w-3.5" /> Multidestino
              </button>
            </>
          )}

          {seccionCabeceraActiva === 'operacion' && (
            <>
              <div className="flex shrink-0 items-center gap-1.5 pr-2 text-[10px] font-bold uppercase tracking-[0.11em] text-amber-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Control humano y trazabilidad
              </div>
              <button onClick={() => setModalProtocolosAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-100">
                <AlertTriangle className="h-3.5 w-3.5" /> Protocolos de saturación
              </button>
              <button onClick={() => setModalRapidResponseAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-800 transition-colors hover:bg-red-100">
                <Bot className="h-3.5 w-3.5" /> Agentes Centinela
              </button>
              <button onClick={() => setModalAuditoriaAiAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-[11px] font-semibold text-purple-800 transition-colors hover:bg-purple-100">
                <ShieldCheck className="h-3.5 w-3.5" /> Auditoría y evidencia
              </button>
              <button onClick={() => setModalCalibracionAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-800 transition-colors hover:bg-blue-50">
                <TrendingUp className="h-3.5 w-3.5" /> Validación predictiva
              </button>
              <button onClick={() => setModalAuthAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100">
                <KeyRound className="h-3.5 w-3.5" /> Identidad institucional
              </button>
            </>
          )}

          {seccionCabeceraActiva === 'datos' && (
            <>
              <div className="flex shrink-0 items-center gap-1.5 pr-2 text-[10px] font-bold uppercase tracking-[0.11em] text-violet-700">
                <Database className="h-3.5 w-3.5" /> S2 · Datos e interoperabilidad
              </div>
              <button onClick={() => setModalSemanticIotAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-800 transition-colors hover:bg-cyan-100">
                <Network className="h-3.5 w-3.5" /> S2 semántico e IoT
              </button>
              <button onClick={() => setModalIngestionAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-800 transition-colors hover:bg-violet-100">
                <UploadCloud className="h-3.5 w-3.5" /> Incorporar datos
              </button>
              <button onClick={() => setModalInteroperabilidadAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-purple-800 transition-colors hover:bg-purple-50">
                <PlugZap className="h-3.5 w-3.5" /> Conectores PID
              </button>
              <button onClick={() => setModalContextPackageAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-semibold text-teal-800 transition-colors hover:bg-teal-100">
                <FilePlus2 className="h-3.5 w-3.5" /> ContextPackage · destino
              </button>
              <button onClick={() => setModalDatosAbiertosAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100">
                <Database className="h-3.5 w-3.5" /> Capas abiertas
              </button>
              <button onClick={() => setModalGoogleGeoAbierto(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-800 transition-colors hover:bg-blue-100">
                <Globe className="h-3.5 w-3.5" /> Google Geo Suite
              </button>
            </>
          )}
        </div>
      </header>

      {/* ======================================================== */}
      {/* PANEL IZQUIERDO: ESTADO, MODELO Y TRAZABILIDAD */}
      {/* Visible desde escritorio estándar: se reserva espacio suficiente para el visor y el panel derecho. */}
      {/* ======================================================== */}
      <div className="hidden min-[1280px]:flex w-[300px] h-full pt-[104px] shrink-0 bg-slate-50/95 border-r border-slate-200 flex-col z-20 shadow-lg">
        <OperationalSnapshotPanel
          destination={destinoActual.nombre}
          scenario={escenarioActual.nombre}
          isBaseline={escenarioActual.id === 'base'}
          current={{ visitors: datosActuales.visitantes, saturation: datosActuales.saturacion, alerts: datosActuales.alertas }}
          simulated={{
            visitors: resultadoSimulacion.indicadoresSimulados.visitantesEnDestino,
            saturation: resultadoSimulacion.indicadoresSimulados.saturacionGlobalPct,
            alerts: resultadoSimulacion.indicadoresSimulados.alertasActivasCount,
            co2: resultadoSimulacion.indicadoresSimulados.emisionesCo2KgHora,
            noise: resultadoSimulacion.indicadoresSimulados.ruidoMedioDb,
            electricity: resultadoSimulacion.indicadoresSimulados.consumoElectricoMwh,
            accessibility: resultadoSimulacion.indicadoresSimulados.indiceAccesibilidad,
            healthMin: resultadoSimulacion.indicadoresSimulados.minutosCentroSalud,
            busMin: resultadoSimulacion.indicadoresSimulados.minutosParadaBus,
            schoolMin: resultadoSimulacion.indicadoresSimulados.minutosEscuela
          }}
          model={{
            name: configuracionModelo.nombre,
            version: configuracionModelo.version,
            rules: configuracionModelo.reglas,
            sources: configuracionModelo.fuentes
          }}
          onRequestedRuleSelect={() => setModalInteroperabilidadAbierto(true)}
          activeRule={reglaModeloVisible}
          requestedRules={SIMULACIONES_SOLICITADAS.map(sim => sim.nombre)}
          userSimulations={escenariosSesionDestino.map(escenario => ({ id: escenario.id, name: escenario.name }))}
          activeSimulationId={escenarioEditorActivo?.id ?? null}
          onUserSimulationSelect={(id) => { handleSeleccionarEscenario(id); setPestañaLateral('simulador'); }}
          onRuleSelect={handleAplicarReglaModelo}
          recommendation={resultadoSimulacion.recomendacionesGestion[0] || 'Mantener la monitorización ordinaria.'}
        />
      </div>

      {/* ======================================================== */}
      {/* ÁREA CENTRAL: VISOR CARTOGRÁFICO INTERACTIVO */}
      {/* ======================================================== */}
      <div className="flex-1 h-full pt-[104px] relative overflow-hidden">
        {(nivelVisualizacion === 3 || nivelVisualizacion === 4) && modo3DCompatible ? (
          <Static3DContextViewer
            level={nivelVisualizacion === 4 ? 4 : 3}
            scenario={escenarioActual.nombre}
            saturation={resultadoSimulacion.indicadoresSimulados.saturacionGlobalPct}
            activeAlerts={resultadoSimulacion.indicadoresSimulados.alertasActivasCount}
          />
        ) : (nivelVisualizacion === 3 || nivelVisualizacion === 4) && visualAdapter.supportsCesiumTiles ? (
          <Suspense fallback={
            <div className="flex h-full w-full items-center justify-center bg-[#e7f0f4] text-xs font-semibold text-slate-600">
              Cargando motor Cesium y tileset 3D LiDAR…
            </div>
          }>
            <Real3DTilesViewer
              key={`tiles-nivel-${nivelVisualizacion}`}
              ref={real3DViewerRef}
              zonas={resultadoSimulacion.zonasResultados}
              recursos={resultadoSimulacion.recursosResultados}
              sensores={resultadoSimulacion.sensoresSimulados}
              rutasDesvio={resultadoSimulacion.rutasOptimizadas}
              simulacionVisual={{ escenarioId: escenarioVisualId, intensidad: intensidadVisual, flujos: flujosModelo }}
              evolucionTemporal={{
                reproduciendo: reproduciendoSimulacion,
                hora: horaSimulacion,
                escenarioNombre: escenarioActual.nombre,
                intensidad: intensidadVisual,
                onAlternar: () => setReproduciendoSimulacion(valor => !valor),
                onCambiarHora: (hora) => { setHoraSimulacion(hora); setReproduciendoSimulacion(false); },
              }}
              analytics4D={nivelVisualizacion === 4}
              kpiMapa={pestañaLateral === 'kpis' ? kpiMapa : null}
              onSelectEdificio={(edificio) => setEdificioSeleccionado(edificio)}
              onWebglUnavailable={activarModoCompatible}
            />
          </Suspense>
        ) : nivelVisualizacion === 3 || nivelVisualizacion === 4 ? (
          <ThreeDViewer
            zonas={resultadoSimulacion.zonasResultados}
            recursos={resultadoSimulacion.recursosResultados}
            sensores={resultadoSimulacion.sensoresSimulados}
            rutasDesvio={resultadoSimulacion.rutasOptimizadas}
            onWebglUnavailable={activarModoCompatible}
          />
        ) : (
          <MapViewer
            centro={destinoActual.centro}
            zoom={destinoActual.zoomInicial}
            zonas={resultadoSimulacion.zonasResultados}
            recursos={resultadoSimulacion.recursosResultados}
            sensores={resultadoSimulacion.sensoresSimulados}
            capasActivas={capasActivas}
            tipoMapaCalor={tipoMapaCalor}
            kpiMapa={pestañaLateral === 'kpis' ? kpiMapa : null}
              simulacionVisual={{
                escenarioId: escenarioVisualId,
                escenarioNombre: escenarioActual.nombre,
                hora: horaSimulacion,
                intensidad: intensidadVisual,
                flujos: flujosModelo,
            }}
            rutasDesvio={resultadoSimulacion.rutasOptimizadas}
            nivelVisualizacion={nivelVisualizacion}
            cartografiaBase={visualAdapter.cartographyBase}
            onSelectElement={(elem) => setElementoSeleccionado(elem)}
            onBaseClick={() => setPestañaLateral('sensores')}
          />
        )}

        <WeatherOverlay
          clima={clima}
          lluviaIntensa={escenarioVisualId === 'episodio_meteo' && intensidadVisual >= 0.12 ? Math.min(1, intensidadVisual) : undefined}
        />

        {/* Modal de Detalle de elemento inspeccionado */}
        <ElementDetailModal
          elemento={elementoSeleccionado}
          onClose={() => setElementoSeleccionado(null)}
        />

        {/* Modal de Ficha de Alcance y Gobernanza de la Primera Oleada (Fase 2) */}
        <OleadaDetailModal
          edificio={edificioSeleccionado}
          onClose={() => setEdificioSeleccionado(null)}
          onFocusEdificio={(edificio) => {
            real3DViewerRef.current?.flyToEdificio(edificio);
          }}
        />

        {/* Alerta flotante en caso de saturación crítica */}
        {resultadoSimulacion.indicadoresSimulados.saturacionGlobalPct >= umbralAlerta && (
          <div className="absolute top-4 right-6 z-20 max-w-md bg-rose-50/95 border border-rose-300 text-rose-950 p-3 rounded-xl shadow-xl flex items-start space-x-3 backdrop-blur">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block">Alerta de Saturación de Destino ({resultadoSimulacion.indicadoresSimulados.saturacionGlobalPct}%)</span>
              <span>El motor ha activado <b>{resultadoSimulacion.rutasOptimizadas.length} ruta(s) de desvío peatonal</b> para preservar la capacidad de carga del centro histórico.</span>
            </div>
          </div>
        )}
      </div>

      {fichaNivelAbierta && (
        <CartographicLevelGuide level={nivelVisualizacion} onClose={() => setFichaNivelAbierta(false)} />
      )}

      {/* ======================================================== */}
      {/* PANEL DERECHO: ESCENARIOS, ACCIONES Y CAPAS */}
      {/* ======================================================== */}
      <div className="w-[340px] max-w-[90vw] h-full pt-[104px] bg-white/95 backdrop-blur-md border-l border-slate-200 flex flex-col z-20 shadow-xl">
        
        {/* Pestañas del Panel Lateral */}
        <div className="flex border-b border-slate-200 bg-slate-100/90 p-1 text-[11px] font-bold text-slate-600">
          <button
            onClick={() => setPestañaLateral('sensores')}
            title="S2 semántico e IoT: sensores y observaciones"
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1.5 transition-colors ${
              pestañaLateral === 'sensores' ? 'bg-white text-amber-700 shadow-sm border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>IoT</span>
          </button>
          <button
            onClick={() => setPestañaLateral('capas')}
            title="Capas e información territorial"
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1.5 transition-colors ${
              pestañaLateral === 'capas' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Capas</span>
          </button>
          <button
            onClick={() => setPestañaLateral('kpis')}
            title="Indicadores y resultados del escenario"
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1.5 transition-colors ${
              pestañaLateral === 'kpis' ? 'bg-white text-cyan-700 shadow-sm border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>KPI</span>
          </button>
          <button
            onClick={() => setPestañaLateral(pestañaLateral === 'validacion' ? 'validacion' : 'simulador')}
            title="Previsión, simulación y validación"
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1.5 transition-colors ${
              (pestañaLateral === 'simulador' || pestañaLateral === 'validacion') ? 'bg-white text-red-600 shadow-sm border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Simulación</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">

          {(pestañaLateral === 'simulador' || pestañaLateral === 'validacion') && (
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-[10px] font-semibold text-slate-500">
              <button
                onClick={() => setPestañaLateral('simulador')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
                  pestañaLateral === 'simulador' ? 'bg-white text-red-600 shadow-sm border border-slate-200' : 'hover:text-slate-900'
                }`}
              >
                <Sliders className="h-3 w-3" />
                <span>Simulación</span>
              </button>
              <button
                onClick={() => setPestañaLateral('validacion')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
                  pestañaLateral === 'validacion' ? 'bg-white text-fuchsia-700 shadow-sm border border-slate-200' : 'hover:text-slate-900'
                }`}
              >
                <FlaskConical className="h-3 w-3" />
                <span>Precisión</span>
              </button>
            </div>
          )}
          
          {/* ========================================== */}
          {/* PESTAÑA: MOTOR DE CONTEXTO Y SIMULACIÓN */}
          {/* ========================================== */}
          {pestañaLateral === 'simulador' && (
            <div className="space-y-4">
              
              {/* Selector de Escenarios What-If */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                    Escenario
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => setModalDisenadorAbierto(true)}
                      className="flex shrink-0 items-center space-x-1 whitespace-nowrap rounded-md bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all"
                      title="Diseñar simulación o importar modelo del catálogo PID"
                    >
                      <Sliders className="h-3 w-3" />
                      <span>+ Nueva simulación</span>
                    </button>
                    <button
                      onClick={() => setDrawerAiAbierto(true)}
                      className="flex items-center space-x-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 transition-colors hover:bg-rose-100"
                      title="Preguntar al Asistente IA sobre los indicadores"
                    >
                      <Sparkles className="h-3 w-3 text-rose-600" />
                      <span>IA</span>
                    </button>
                    <button
                      onClick={handleResetSimulacion}
                      className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center space-x-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restablecer</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {escenariosDisponibles.map(esc => (
                    <div
                      key={esc.id}
                      onClick={() => {
                        setReglaModeloActiva(null);
                        handleSeleccionarEscenario(esc.id);
                      }}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        escenarioSeleccionadoId === esc.id
                          ? 'bg-red-50 border-red-500 text-red-900 shadow-sm'
                          : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>{esc.nombre}</span>
                        {isSessionScenarioId(esc.id) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEliminarEscenarioSesion(esc.id); }}
                            title="Quitar de mi panel"
                            className="ml-auto mr-1 rounded px-1 text-[10px] font-bold text-slate-400 hover:bg-red-100 hover:text-red-600"
                          >
                            ✕
                          </button>
                        )}
                        {esc.factorAfluencia > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold font-mono">
                            +{Math.round((esc.factorAfluencia - 1) * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {esc.descripcion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {ultimaEjecucionEditor && escenarioEditorActivo?.id === escenarioActual.id && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-[11px] text-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold uppercase tracking-wider text-cyan-900">Evidencia de ejecución</span>
                    <span className="rounded bg-cyan-700 px-1.5 py-0.5 font-mono text-[10px] text-white">v{ultimaEjecucionEditor.evidence.scenarioVersion}</span>
                  </div>
                  <p className="mt-1.5 leading-relaxed">BASE observada → ESCENARIO «{ultimaEjecucionEditor.scenario.name}» → DELTA territorial. Estado: <b>{ultimaEjecucionEditor.scenario.status}</b>.</p>
                  <p className="mt-1 text-[10px] text-cyan-700">{ultimaEjecucionEditor.evidence.persistence.replaceAll('_', ' ').toLowerCase()} · {ultimaEjecucionEditor.evidence.engine}</p>
                  <p className="mt-1 break-all font-mono text-[9px] text-slate-500">{ultimaEjecucionEditor.run.id} · modelo {ultimaEjecucionEditor.run.model.version} · ctx {ultimaEjecucionEditor.run.evidence.contextFingerprint}</p>
                </div>
              )}
              {(!ultimaEjecucionEditor || escenarioEditorActivo?.id !== escenarioActual.id) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                  <span className="font-bold uppercase tracking-wider">Vista previa local</span>
                  <p className="mt-1 leading-relaxed">Los controles recalculan una previsualización no persistida. Para crear una corrida trazable con BASE / ESCENARIO / DELTA, versión, huella y evidencia, use el <b>editor de escenarios</b> y ejecute el escenario validado.</p>
                </div>
              )}

              {/* Parámetros y evolución temporal del escenario seleccionado */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-800">Evolución temporal simulada</span>
                    <span className="font-mono text-lg font-bold text-slate-900">{String(horaSimulacion).padStart(2, '0')}:00</span>
                  </div>
                  <button
                    type="button"
                    disabled={escenarioSeleccionadoId === 'base'}
                    onClick={() => setReproduciendoSimulacion(valor => !valor)}
                    className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[10px] font-bold text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {reproduciendoSimulacion ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {reproduciendoSimulacion ? 'Pausar' : 'Reproducir'}
                  </button>
                </div>

                <input
                  type="range"
                  min="0"
                  max="23"
                  step="1"
                  value={horaSimulacion}
                  onChange={(e) => {
                    setHoraSimulacion(Number(e.target.value));
                    setReproduciendoSimulacion(false);
                  }}
                  className="h-1.5 w-full cursor-pointer accent-cyan-600 bg-slate-200 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-500"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>

                {claveEscenario === 'presion-alta-demanda' && (
                  <div className="flex gap-1 border-t border-slate-100 pt-2">
                    {([['manual', 'Parámetros'], ['flota', 'Tipos de crucero'], ['tiempo_real', 'Puerto en tiempo real'], ['archivo', 'Archivo CSV']] as const).map(([modo, etiqueta]) => (
                      <button
                        key={modo}
                        type="button"
                        onClick={() => setModoCruceros(modo)}
                        className={`flex-1 rounded-md border px-1 py-1 text-[9px] font-bold transition-colors ${modoCruceros === modo ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}
                      >{etiqueta}</button>
                    ))}
                  </div>
                )}

                {claveEscenario === 'presion-alta-demanda' && modoCruceros === 'archivo' && (
                  <div className="space-y-1.5">
                    <label
                      onDragOver={(e) => { e.preventDefault(); setArrastrandoCsv(true); }}
                      onDragLeave={() => setArrastrandoCsv(false)}
                      onDrop={(e) => { e.preventDefault(); setArrastrandoCsv(false); void cargarArchivoCruceros(e.dataTransfer.files[0]); }}
                      className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border-2 border-dashed px-2 py-3 text-center text-[10px] transition-colors ${arrastrandoCsv ? 'border-cyan-600 bg-cyan-50 text-cyan-800' : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-cyan-400'}`}
                    >
                      <span className="font-bold">Arrastre aquí un archivo CSV</span>
                      <span className="text-[9px] text-slate-500">o haga clic para seleccionarlo</span>
                      <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void cargarArchivoCruceros(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <button type="button" onClick={descargarPlantillaCrucerosCsv} className="w-full rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-800 hover:bg-cyan-100">
                      ⬇ Descargar archivo de ejemplo
                    </button>
                    <p className="text-[8px] leading-snug text-slate-400">Columnas: nombre; pasajeros; fecha; hora_llegada; hora_salida; porcentaje_desembarco (opcional, 78 por defecto).</p>
                    {errorCsv && <p className="text-[9px] text-red-600">{errorCsv}</p>}
                    {crucerosCsv && (
                      <>
                        <div className="flex items-center justify-between gap-2 text-[9px]">
                          <span className="truncate font-semibold text-slate-700" title={crucerosCsv.archivo}>{crucerosCsv.archivo}</span>
                          <select
                            value={fechaCsv}
                            aria-label="Fecha del escenario"
                            onChange={(e) => {
                              setFechaCsv(e.target.value);
                              setHoraSimulacion(agregarCruceros(crucerosCsv.buques.filter(b => b.fecha === e.target.value)).horaPico);
                            }}
                            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-slate-800"
                          >
                            {fechasCsv.map(fecha => <option key={fecha} value={fecha}>{fecha}</option>)}
                          </select>
                        </div>
                        {buquesCsvFecha.map((buque, i) => (
                          <div key={`${buque.nombre}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                            <div className="min-w-0">
                              <span className="block truncate text-[10px] font-bold text-slate-800">{buque.nombre}</span>
                              <span className="block text-[9px] text-slate-500">{String(buque.horaLlegada).padStart(2, '0')}:00 – {String(buque.horaSalida).padStart(2, '0')}:00 · {buque.porcentajeDesembarco}% desembarca</span>
                            </div>
                            <span className="shrink-0 font-mono text-[10px] font-bold text-slate-700">{buque.pasajeros.toLocaleString('es-ES')} pax</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between rounded bg-cyan-50 px-2 py-1 text-[9px] text-cyan-900">
                          <span className="font-medium">{buquesCsvFecha.length} buques · pico {String(agregadoCsv.horaPico).padStart(2, '0')}:00</span>
                          <span className="font-mono font-bold">{pasajerosModoCruceros.toLocaleString('es-ES')} pasajeros</span>
                        </div>
                        {crucerosCsv.avisos.length > 0 && <p className="text-[9px] text-amber-700">{crucerosCsv.avisos.slice(0, 3).join(' ')}{crucerosCsv.avisos.length > 3 ? ` (+${crucerosCsv.avisos.length - 3} más)` : ''}</p>}
                      </>
                    )}
                  </div>
                )}

                {claveEscenario === 'presion-alta-demanda' && modoCruceros === 'flota' && (
                  <div className="space-y-1">
                    {TIPOS_CRUCERO.map(tipo => (
                      <div key={tipo.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                        <div className="min-w-0">
                          <span className="block truncate text-[10px] font-bold text-slate-800">{tipo.nombre}</span>
                          <span className="block truncate text-[9px] text-slate-500">{tipo.modelo} · {tipo.capacidad.toLocaleString('es-ES')} pax</span>
                        </div>
                        <input
                          type="number" min="0" max="4"
                          aria-label={`Número de ${tipo.nombre}`}
                          value={flotaCruceros[tipo.id] ?? 0}
                          onChange={(e) => setFlotaCruceros(actual => ({ ...actual, [tipo.id]: Math.max(0, Math.min(4, Number(e.target.value))) }))}
                          className="w-12 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center text-slate-800"
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded bg-cyan-50 px-2 py-1 text-[9px] text-cyan-900">
                      <span className="font-medium">{TIPOS_CRUCERO.reduce((t, tipo) => t + (flotaCruceros[tipo.id] ?? 0), 0)} buques</span>
                      <span className="font-mono font-bold">{pasajerosModoCruceros.toLocaleString('es-ES')} pasajeros</span>
                    </div>
                  </div>
                )}

                {claveEscenario === 'presion-alta-demanda' && modoCruceros === 'tiempo_real' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${traficoPuerto?.fuente === 'ais_en_vivo' ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-800'}`}>
                        {traficoPuerto?.fuente === 'ais_en_vivo' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                        {traficoPuerto ? (traficoPuerto.fuente === 'ais_en_vivo' ? 'AIS en vivo' : 'Datos simulados') : 'Sin datos'}
                      </span>
                      <button type="button" onClick={() => void cargarTraficoPuerto()} disabled={traficoPuertoEstado === 'cargando'} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        {traficoPuertoEstado === 'cargando' ? 'Actualizando…' : 'Actualizar'}
                      </button>
                    </div>
                    {traficoPuertoEstado === 'error' && <p className="text-[9px] text-red-600">No se pudo consultar el tráfico del puerto (¿está el servidor API en marcha?).</p>}
                    {traficoPuerto && traficoPuerto.buques.length === 0 && <p className="text-[9px] text-slate-500">No hay cruceros en el puerto ni en aproximación ahora mismo.</p>}
                    {traficoPuerto?.buques.map(buque => (
                      <div
                        key={buque.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border-l-4 border px-2 py-1.5 ${buque.estado === 'atracado'
                          ? 'border-emerald-300 border-l-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-200'
                          : 'border-slate-200 border-l-amber-400 bg-slate-50'}`}
                      >
                        <div className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[11px] font-bold text-slate-900">{buque.nombre}</span>
                            {buque.estado === 'atracado' && (
                              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />Activo
                              </span>
                            )}
                          </span>
                          <span className={`block text-[9px] font-medium ${buque.estado === 'atracado' ? 'text-emerald-800' : 'text-amber-700'}`}>
                            {buque.estado === 'atracado' ? 'Atracado en el puerto' : `En aproximación · ETA ${buque.etaMin} min`}
                          </span>
                        </div>
                        <span className={`shrink-0 font-mono text-[11px] font-bold ${buque.estado === 'atracado' ? 'text-emerald-700' : 'text-slate-500'}`}>{buque.capacidad.toLocaleString('es-ES')} pax</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded bg-cyan-50 px-2 py-1 text-[9px] text-cyan-900">
                      <span className="font-medium">{traficoPuerto?.buques.length ?? 0} buques</span>
                      <span className="font-mono font-bold">{pasajerosModoCruceros.toLocaleString('es-ES')} pasajeros</span>
                    </div>
                    {traficoPuerto && <p className="text-[8px] leading-snug text-slate-400">{traficoPuerto.detalle} Actualizado {new Date(traficoPuerto.actualizado).toLocaleTimeString('es-ES')}.</p>}
                  </div>
                )}

                {claveEscenario === 'presion-alta-demanda' && modoCruceros !== 'manual' && modoCruceros !== 'archivo' && (
                  <label className="block text-[9px] font-semibold text-slate-600">Distribución %
                    <input type="number" min="20" max="100" value={porcentajeDesembarco} onChange={(e) => setPorcentajeDesembarco(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-800" />
                  </label>
                )}

                {claveEscenario === 'presion-alta-demanda' && modoCruceros === 'manual' && (
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2">
                    <label className="text-[9px] font-semibold text-slate-600">Llegadas<input type="number" min="1" max="4" value={numeroCruceros} onChange={(e) => setNumeroCruceros(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-800" /></label>
                    <label className="text-[9px] font-semibold text-slate-600">Volumen<input type="number" min="1000" max="18000" step="500" value={pasajerosCruceros} onChange={(e) => setPasajerosCruceros(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-800" /></label>
                    <label className="text-[9px] font-semibold text-slate-600">Distribución %<input type="number" min="20" max="100" value={porcentajeDesembarco} onChange={(e) => setPorcentajeDesembarco(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-800" /></label>
                  </div>
                )}

                {claveEscenario === 'evento-local' && (
                  <label className="block border-t border-slate-100 pt-2 text-[9px] font-semibold text-slate-600">Asistencia prevista
                    <input type="range" min="8000" max="50000" step="1000" value={asistentesEvento} onChange={(e) => setAsistentesEvento(Number(e.target.value))} className="mt-1.5 h-1.5 w-full cursor-pointer accent-fuchsia-500" />
                    <span className="mt-1 block text-right font-mono text-[11px] font-bold text-fuchsia-700">{asistentesEvento.toLocaleString('es-ES')} personas</span>
                  </label>
                )}

                {claveEscenario === 'episodio-meteorologico' && (
                  <div className="space-y-2 border-t border-slate-100 pt-2">
                  <label className="block text-[9px] font-semibold text-slate-600">Intensidad de precipitación
                    <input type="range" min="10" max="80" step="5" value={precipitacionMmH} onChange={(e) => setPrecipitacionMmH(Number(e.target.value))} className="mt-1.5 h-1.5 w-full cursor-pointer accent-sky-500" />
                    <span className="mt-1 block text-right font-mono text-[11px] font-bold text-sky-700">{precipitacionMmH} mm/h</span>
                  </label>
                  <label className="block text-[9px] font-semibold text-slate-600">Índice de eficiencia de drenaje urbano
                    <input type="range" min="20" max="100" step="5" value={eficienciaDrenaje} onChange={(e) => setEficienciaDrenaje(Number(e.target.value))} className="mt-1.5 h-1.5 w-full cursor-pointer accent-sky-500" />
                    <span className="mt-1 block text-right font-mono text-[11px] font-bold text-sky-700">{eficienciaDrenaje}%</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[9px] font-semibold text-slate-600">Imbornales en la ciudad<input type="number" min="500" max="20000" step="100" value={numeroImbornales} onChange={(e) => setNumeroImbornales(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-800" /></label>
                    <label className="text-[9px] font-semibold text-slate-600">Caudal medio (L/s por imbornal)<input type="number" min="1" max="60" step="1" value={caudalImbornalLs} onChange={(e) => setCaudalImbornalLs(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-800" /></label>
                  </div>
                  <div className="flex items-center justify-between rounded bg-sky-50 px-2 py-1 text-[9px] text-sky-900">
                    <span className="font-medium">Capacidad de evacuación de la red</span>
                    <span className="font-mono font-bold">{Math.round(capacidadDrenajeLs).toLocaleString('es-ES')} L/s</span>
                  </div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 text-[10px]">
                  <span className="text-slate-600 font-medium">Intensidad activa del escenario</span>
                  <span className="font-mono font-bold text-cyan-700">{Math.round(intensidadVisual * 100)}%</span>
                </div>
                <p className="text-[9px] leading-relaxed text-slate-500">Datos sintéticos para demostración. La hora y los parámetros recalculan mapa, KPIs, sensores, alertas y rutas.</p>
              </div>

              {/* Ajuste fino manual de variables de contexto */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                  Variables de Contexto
                </span>

                {/* Slider de variación de afluencia */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-600 font-medium">Variación manual de visitantes:</span>
                    <span className="font-mono font-bold text-cyan-700">
                      {incrementoManual > 0 ? `+${incrementoManual}%` : `${incrementoManual}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="80"
                    step="5"
                    value={incrementoManual}
                    onChange={(e) => setIncrementoManual(Number(e.target.value))}
                    className="w-full accent-red-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Clima de simulación */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-600 font-medium block">Condición meteorológica:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setClima('DESPEJADO')}
                      className={`p-1.5 rounded-md flex flex-col items-center text-[10px] font-semibold border ${
                        clima === 'DESPEJADO' ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 mb-0.5" />
                      <span>Soleado</span>
                    </button>
                    <button
                      onClick={() => setClima('LLUVIA')}
                      className={`p-1.5 rounded-md flex flex-col items-center text-[10px] font-semibold border ${
                        clima === 'LLUVIA' ? 'bg-sky-50 border-sky-500 text-sky-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <CloudRain className="w-3.5 h-3.5 mb-0.5" />
                      <span>Lluvia</span>
                    </button>
                    <button
                      onClick={() => setClima('CALOR_EXTREMO')}
                      className={`p-1.5 rounded-md flex flex-col items-center text-[10px] font-semibold border ${
                        clima === 'CALOR_EXTREMO' ? 'bg-red-50 border-red-500 text-red-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <Wind className="w-3.5 h-3.5 mb-0.5" />
                      <span>Ola Calor</span>
                    </button>
                  </div>
                </div>

                {/* Umbral de Saturación Crítica */}
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-600 font-medium">Umbral de alerta crítica:</span>
                    <span className="font-mono font-bold text-red-700">{umbralAlerta}%</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="95"
                    step="1"
                    value={umbralAlerta}
                    onChange={(e) => setUmbralAlerta(Number(e.target.value))}
                    className="w-full accent-red-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Recomendaciones generadas por el Motor */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Recomendaciones de Mitigación
                </span>
                <div className="space-y-1.5">
                  {resultadoSimulacion.recomendacionesGestion.map((rec, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <ChevronRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* PESTAÑA: INDICADORES Y KPIS DE IMPACTO */}
          {/* ========================================== */}
          {pestañaLateral === 'kpis' && (
            <div className="space-y-3">
              
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'visitantes', Icon: Users, color: 'text-cyan-400', titulo: 'Visitantes Totales',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.visitantesEnDestino.toLocaleString()}</>,
                    sub: <span className={`font-bold ${resultadoSimulacion.indicadoresSimulados.variacionVsMedia >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{resultadoSimulacion.indicadoresSimulados.variacionVsMedia >= 0 ? '+' : ''}{resultadoSimulacion.indicadoresSimulados.variacionVsMedia}% vs media</span> },
                  { id: 'saturacion', Icon: TrendingUp, color: 'text-red-400', titulo: 'Saturación Global',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.saturacionGlobalPct}%</>,
                    sub: <>{resultadoSimulacion.indicadoresSimulados.distritosSaturadosCount} zona(s) en alerta</> },
                  { id: 'co2', Icon: Wind, color: 'text-emerald-400', titulo: 'Emisiones CO₂',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.emisionesCo2KgHora} <span className="text-xs font-normal">kg/h</span></>,
                    sub: <>Impacto ambiental</> },
                  { id: 'ruido', Icon: Volume2, color: 'text-amber-400', titulo: 'Presión Sonora',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.ruidoMedioDb} <span className="text-xs font-normal">dBA</span></>,
                    sub: <>Promedio centros</> },
                  { id: 'consumo', Icon: Zap, color: 'text-yellow-400', titulo: 'Consumo eléctrico',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.consumoElectricoMwh} <span className="text-xs font-normal">MWh/día</span></>,
                    sub: <>Demanda de red</> },
                  { id: 'accesibilidad', Icon: Accessibility, color: 'text-lime-400', titulo: 'Índice de accesibilidad',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.indiceAccesibilidad} <span className="text-xs font-normal">/100</span></>,
                    sub: <>Acceso universal</> },
                  { id: 'centroSalud', Icon: HeartPulse, color: 'text-rose-400', titulo: 'Tiempo a centro de salud',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.minutosCentroSalud} <span className="text-xs font-normal">min</span></>,
                    sub: <>A pie, media</> },
                  { id: 'paradaBus', Icon: Bus, color: 'text-sky-400', titulo: 'Tiempo a parada de bus',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.minutosParadaBus} <span className="text-xs font-normal">min</span></>,
                    sub: <>A pie, media</> },
                  { id: 'escuela', Icon: GraduationCap, color: 'text-violet-400', titulo: 'Tiempo a escuela',
                    valor: <>{resultadoSimulacion.indicadoresSimulados.minutosEscuela} <span className="text-xs font-normal">min</span></>,
                    sub: <>A pie, media</> },
                ] as { id: KpiMapa; Icon: typeof Users; color: string; titulo: string; valor: React.ReactNode; sub: React.ReactNode }[]).map(({ id, Icon, color, titulo, valor, sub }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setKpiMapa(id)}
                    aria-pressed={kpiMapa === id}
                    title="Colorear edificios del mapa por este KPI"
                    className={`p-3 text-left rounded-xl border cursor-pointer transition-all ${kpiMapa === id ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-400 shadow-md' : 'bg-slate-950/80 border-slate-800 hover:bg-slate-900 hover:border-cyan-700'}`}
                  >
                    <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] mb-1">
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                      <span>{titulo}</span>
                    </div>
                    <div className="text-lg font-bold text-white font-mono">{valor}</div>
                    <div className="text-[10px] text-slate-400">{sub}</div>
                  </button>
                ))}
              </div>

              <ScenarioTrendChart
                escenario={escenarioActual.nombre}
                saturacionGlobalPct={resultadoSimulacion.indicadoresSimulados.saturacionGlobalPct}
                variacionVsMedia={resultadoSimulacion.indicadoresSimulados.variacionVsMedia}
              />

              {/* Comparativa por Zona de Destino */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Capacidad de Carga por Zona
                  </span>
                  <button
                    type="button"
                    onClick={() => setOrdenZonas(o => o === null ? 'desc' : o === 'desc' ? 'asc' : null)}
                    title={ordenZonas === 'desc' ? 'Orden descendente (clic para ascendente)' : ordenZonas === 'asc' ? 'Orden ascendente (clic para orden original)' : 'Ordenar por porcentaje'}
                    className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${ordenZonas ? 'border-cyan-600 bg-cyan-50 text-cyan-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    {ordenZonas === 'desc' ? <ArrowDown className="w-3 h-3" /> : ordenZonas === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3" />}
                    <span>{ordenZonas === 'desc' ? 'Mayor a menor' : ordenZonas === 'asc' ? 'Menor a mayor' : 'Ordenar'}</span>
                  </button>
                </div>
                <div className="space-y-2.5">
                  {[...resultadoSimulacion.zonasResultados]
                    .sort((a, b) => ordenZonas === 'asc' ? a.capacidadCargaSimuladaPct - b.capacidadCargaSimuladaPct
                      : ordenZonas === 'desc' ? b.capacidadCargaSimuladaPct - a.capacidadCargaSimuladaPct : 0)
                    .map(z => (
                    <div key={z.id} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-slate-200">{z.nombre}</span>
                        <span className={`font-mono font-bold ${
                          z.capacidadCargaSimuladaPct >= umbralAlerta ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {z.capacidadCargaSimuladaPct}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            z.capacidadCargaSimuladaPct >= umbralAlerta 
                              ? 'bg-red-500' 
                              : z.capacidadCargaSimuladaPct >= 70 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(z.capacidadCargaSimuladaPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* PESTAÑA: PREDICCIÓN Y VALIDACIÓN SINTÉTICA */}
          {/* ========================================== */}
          {pestañaLateral === 'validacion' && (
            <ForecastValidationPanel
              destination={destinoActual.nombre}
              scenario={escenarioActual.nombre}
              experiment={experimentoPredictivo}
            />
          )}

          {/* ========================================== */}
          {/* PESTAÑA: GESTIÓN DE CAPAS TEMÁTICAS */}
          {/* ========================================== */}
          {pestañaLateral === 'capas' && (
            <div className="space-y-3">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Capas del Visor Geoespacial
                </span>
                
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <span className="text-slate-300">Zonas de Aforo & Polígonos</span>
                    <input
                      type="checkbox"
                      checked={capasActivas.zonas}
                      onChange={(e) => setCapasActivas({ ...capasActivas, zonas: e.target.checked })}
                      className="accent-red-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <span className="text-slate-300">Mapa de calor temático</span>
                    <input
                      type="checkbox"
                      checked={capasActivas.calor}
                      onChange={(e) => setCapasActivas({ ...capasActivas, calor: e.target.checked })}
                      className="accent-red-600 rounded"
                    />
                  </label>

                  {capasActivas.calor && (
                    <label className="block rounded-lg border border-slate-800 bg-slate-900 p-2">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Variable representada</span>
                      <select
                        value={tipoMapaCalor}
                        onChange={(e) => {
                          const tipo = e.target.value as TipoMapaCalor;
                          setTipoMapaCalor(tipo);
                          setReglaModeloActiva(null);
                          setCapasActivas(previas => tipo === 'afluencia'
                            ? { ...previas, calor: true, zonas: true, recursos: true }
                            : { ...previas, calor: true, zonas: false, recursos: false, sensores: true, rutas: false }
                          );
                        }}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-600"
                      >
                        {Object.entries(HEATMAP_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <span className="text-slate-300">Recursos y Equipamientos (POIs)</span>
                    <input
                      type="checkbox"
                      checked={capasActivas.recursos}
                      onChange={(e) => setCapasActivas({ ...capasActivas, recursos: e.target.checked })}
                      className="accent-red-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <span className="text-slate-300">Red de Sensores IoT</span>
                    <input
                      type="checkbox"
                      checked={capasActivas.sensores}
                      onChange={(e) => setCapasActivas({ ...capasActivas, sensores: e.target.checked })}
                      className="accent-red-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <span className="text-slate-300">Rutas de Desvío / Mitigación</span>
                    <input
                      type="checkbox"
                      checked={capasActivas.rutas}
                      onChange={(e) => setCapasActivas({ ...capasActivas, rutas: e.target.checked })}
                      className="accent-red-600 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Información sobre Estándares OGC */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2 text-[11px] text-slate-400">
                <span className="font-bold text-slate-300 block">Conectores OGC y GeoServer</span>
                <p>Las capas representadas están preparadas para publicarse como <b>WMS, WFS, WMTS y OGC API Features</b> en la fase de piloto persistente.</p>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* PESTAÑA: TELEMETRÍA IOT Y SENSORES */}
          {/* ========================================== */}
          {pestañaLateral === 'sensores' && (
            <div className="space-y-3">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Red IoT en Tiempo Real ({resultadoSimulacion.sensoresSimulados.length})
                  </span>
                  <span className="flex items-center space-x-1 text-[10px] text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>Datos simulados</span>
                  </span>
                </div>

                <div className="space-y-2">
                  {resultadoSimulacion.sensoresSimulados.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setElementoSeleccionado({ tipo: 'SENSOR', data: s })}
                      className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors space-y-1"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-slate-200">{s.nombre}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          s.estadoSimulado === 'CRITICO' ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-slate-950 text-cyan-300'
                        }`}>
                          {s.valorSimulado} {s.unidad}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{s.tipoSensor}</span>
                        <span>{s.ultimaLectura}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Pie del Panel Lateral */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Motor PID Activo</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">v1.0.0-MVP</span>
        </div>

      </div>

      {/* Modal de Arquitectura */}
      <ArchitectureModal
        isOpen={modalArquitecturaAbierto}
        onClose={() => setModalArquitecturaAbierto(false)}
      />

      <MultiDestinationModal
        isOpen={modalMultidestinoAbierto}
        onClose={() => setModalMultidestinoAbierto(false)}
      />

      <InteroperabilityModal
        isOpen={modalInteroperabilidadAbierto}
        onClose={() => setModalInteroperabilidadAbierto(false)}
        initialDestinationId={destinoActual.id}
      />
      {modalContextPackageAbierto && (
        <ContextPackageModal
          onClose={() => setModalContextPackageAbierto(false)}
          onImported={handleContextPackageImported}
        />
      )}
      {modalEditorEscenariosAbierto && (
        <ScenarioEditorModal
          destination={destinoActual}
          tenantId={tenantDestinoActual}
          zones={zonasFiltradas}
          onClose={() => setModalEditorEscenariosAbierto(false)}
          onExecuted={handleScenarioEditorExecuted}
        />
      )}

      {/* Copiloto IA de Simulación y What-If (Iteración 5) */}
      <AiSimulationDrawer
        contextoIndicadores={contextoIndicadores}
        isOpen={drawerAiAbierto}
        onClose={() => setDrawerAiAbierto(false)}
        destinationName={destinoActual.nombre}
        tenantId={tenantDestinoActual}
      />

      {/* Modal de Protocolos Operativos ante Saturación */}
      <OperationalProtocolsModal
        isOpen={modalProtocolosAbierto}
        onClose={() => setModalProtocolosAbierto(false)}
        destinationId={destinoActual.id}
        destinationName={destinoActual.nombre}
        tenantId={destinoActual.id === 'palma' ? 'tenant_ayto_palma' : 'tenant_ayto_malaga'}
      />

      {/* Modal de Auditoría Inmutable de IA */}
      <AiAuditHistoryModal
        isOpen={modalAuditoriaAiAbierto}
        onClose={() => setModalAuditoriaAiAbierto(false)}
        destinationId={destinoActual.id}
        destinationName={destinoActual.nombre}
        tenantId={destinoActual.id === 'palma' ? 'tenant_ayto_palma' : 'tenant_ayto_malaga'}
      />

      {/* Modal de Calibración Predictiva Empírica */}
      <ForecastCalibrationModal
        isOpen={modalCalibracionAbierto}
        onClose={() => setModalCalibracionAbierto(false)}
        destinationId={destinoActual.id}
        destinationName={destinoActual.nombre}
        tenantId={destinoActual.id === 'palma' ? 'tenant_ayto_palma' : 'tenant_ayto_malaga'}
      />

      {/* Modal de Autenticación Institucional (JWT) */}
      <InstitutionalAuthModal
        isOpen={modalAuthAbierto}
        onClose={() => setModalAuthAbierto(false)}
      />

      {/* Modal Diseñador de Simulaciones y Catálogo PID */}
      <SimulationDesignerModal
        isOpen={modalDisenadorAbierto}
        onClose={() => setModalDisenadorAbierto(false)}
        destination={destinoActual}
        tenantId={tenantDestinoActual}
        zones={zonasFiltradas}
        onScenarioImported={(scenario) => {
          setEscenarioEditorActivo(scenario);
          setEscenarioSeleccionadoId(scenario.id);
          setHoraSimulacion(scenario.inputs.hour);
          setClima(scenario.inputs.climate);
          setIncrementoManual(scenario.inputs.visitorVariationPct);
          setUmbralAlerta(scenario.inputs.alertThresholdPct);
          setReproduciendoSimulacion(false);
          setTipoMapaCalor('afluencia');
          setCapasActivas({ zonas: true, calor: true, recursos: true, sensores: true, rutas: true });
        }}
      />

      {/* Modal de Repositorio de Datos Abiertos (Iteración 10) */}
      <OpenDataLayersModal
        isOpen={modalDatosAbiertosAbierto}
        onClose={() => setModalDatosAbiertosAbierto(false)}
        destinationId={destinoActual.id}
        destinationName={destinoActual.nombre}
      />

      {/* Modal de Ingestión No-Code de Datos Propios */}
      <DataIngestionModal
        isOpen={modalIngestionAbierto}
        onClose={() => setModalIngestionAbierto(false)}
        destinationId={destinoActual.id}
        destinationName={destinoActual.nombre}
        tenantId={tenantDestinoActual}
      />

      {/* Modal de Simulación Multidestino Federada (Iteración 12) */}
      <FederatedSimulationModal
        open={modalFederacionAbierto}
        onClose={() => setModalFederacionAbierto(false)}
        destinationId={destinoActual.id}
        destinationName={destinoActual.nombre}
        tenantId={tenantDestinoActual}
        destinosDisponibles={destinosDisponibles}
      />

      {/* Modal de Integración Semántica S2 e IoT (Iteración 13) */}
      <SemanticIotIntegrationModal
        isOpen={modalSemanticIotAbierto}
        onClose={() => setModalSemanticIotAbierto(false)}
        destinationId={destinoActual.id}
        tenantId={tenantDestinoActual}
      />

      {/* Modal de Catálogo Unificado de Activos 3D/4D (Iteración 12) */}
      <Assets3DCatalogModal
        open={modalAssets3DAbierto}
        onClose={() => setModalAssets3DAbierto(false)}
        destinationId={destinoActual.id}
        destinationName={destinoActual.nombre}
      />

      {/* Modal de Calibración Real y Predicción Validable (Iteración 14) */}
            <MacroOptimizationModal
        isOpen={modalMacroOptAbierto}
        onClose={() => setModalMacroOptAbierto(false)}
        destination={destinoActual}
        tenantId={tenantDestinoActual}
        zones={zonasFiltradas}
      />
      <ModelCalibrationModal
        isOpen={modalCalibracionAbierto}
        onClose={() => setModalCalibracionAbierto(false)}
        destination={destinoActual}
        tenantId={tenantDestinoActual}
        zones={zonasFiltradas}
      />

      {/* Modal de Agentes Autónomos de Respuesta Rápida ante Colapso (Iteración 16) */}
      <RapidResponseAgentModal
        isOpen={modalRapidResponseAbierto}
        onClose={() => setModalRapidResponseAbierto(false)}
        destination={destinoActual}
        tenantId={tenantDestinoActual}
      />

      {/* Modal de Google Geo Suite Gobernado (Iteración 17) */}
      <GoogleGeoSuiteModal
        isOpen={modalGoogleGeoAbierto}
        onClose={() => setModalGoogleGeoAbierto(false)}
        destinationId={destinoActual.id}
        destinationName={destinoActual.nombre}
        tenantId={tenantDestinoActual}
      />

    </div>
  );
}
