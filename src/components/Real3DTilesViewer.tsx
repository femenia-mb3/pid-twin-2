import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cesium3DTileset,
  Color,
  ColorMaterialProperty,
  CallbackProperty,
  CustomDataSource,
  Entity,
  HeadingPitchRoll,
  HeadingPitchRange,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  Model,
  PolygonHierarchy,
  PolylineDashMaterialProperty,
  Transforms,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  ImageryLayer,
  VerticalOrigin,
  Viewer,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { CheckCircle2, Layers, LoaderCircle, MapPin, TriangleAlert, Building2, Cloud, Boxes, Pause, Play, Box, X, MousePointer2, Sun, Car } from 'lucide-react';
import { RecursoTuristico, SensorIoT, ZonaDestino } from '../types/ontology';
import { EDIFICIOS_OLEADA_1, Edificio3DRecord } from '../services/catalog3DService';
import { OpenDataService } from '../services/openDataService';
import { sensorMarkerDataUri, sensorVisual } from '../services/sensorVisuals';
import { leyendaFlujoSimulacion } from '../services/simulationFlowLegend';
import { FlujoModelo, leyendaFlujosModelo } from '../services/modelFlows';
import { cargarViarioPrincipal, colorCarga, construirRed } from '../services/trafficNetwork';
import { KpiMapa, KPI_MAPA_CONFIG, clasesLeyenda, textoClase, oscurecer, coloresKpiEdificios, precalentarKpis } from '../services/kpiBuildingColors';
import { RUTAS_CRUCERO_VIARIAS, RUTAS_EVENTO_VIARIAS } from '../data/rutasCruceroViarias';

type ZonaSimulada = ZonaDestino & {
  capacidadCargaSimuladaPct?: number;
  afluenciaSimulada?: number;
};

type RecursoSimulado = RecursoTuristico & {
  visitantesSimuladosHora?: number;
  ocupacionSimuladaPct?: number;
};

type SensorSimulado = SensorIoT & {
  valorSimulado?: number;
  estadoSimulado?: string;
};

interface Real3DTilesViewerProps {
  zonas: ZonaSimulada[];
  recursos: RecursoSimulado[];
  sensores: SensorSimulado[];
  rutasDesvio: {
    origen: string;
    destino: string;
    coordenadasRuta: [number, number][];
    capacidadDesvioHora: number;
    descripcion: string;
  }[];
  simulacionVisual?: { escenarioId: string; intensidad: number; flujos?: FlujoModelo[] };
  /** Evolución temporal simulada compartida con el panel derecho. */
  evolucionTemporal?: {
    reproduciendo: boolean;
    hora: number;
    escenarioNombre: string;
    intensidad: number;
    onAlternar: () => void;
    onCambiarHora: (hora: number) => void;
  };
  analytics4D?: boolean;
  kpiMapa?: KpiMapa | null;
  onSelectEdificio?: (edificio: Edificio3DRecord) => void;
  onWebglUnavailable?: () => void;
}

export interface Real3DTilesViewerHandle {
  flyToEdificio: (edificio: Edificio3DRecord) => void;
}

const TILESET_LIDAR_URL = '/tilesets/malaga-centro-2024/tileset.json';
const BUILDING_TWIN_MODEL_URL = '/models/villa-lucia-building.glb?v=2';
const BUILDING_TWIN_POSITION = { longitude: -4.41435, latitude: 36.72045, altitude: 0 };
const BUILDING_TWIN_SCALE = 2.4;
const BUILDING_TWIN_HEADING = 18;
const BUILDING_TWIN_FOOTPRINT: [number, number][] = [
  [-0.15, 2.20],
  [2.11, 0.51],
  [1.41, -1.53],
  [-0.99, -2.21],
  [-2.12, -0.35],
  [-1.75, 1.25],
];
const BUILDING_TWIN_MARKER_ID = 'building-twin-villa-lucia-marker';
const BUILDING_TWIN_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="72" height="84" viewBox="0 0 72 84">
    <defs><filter id="s" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".35"/></filter></defs>
    <path filter="url(#s)" d="M36 2C17.2 2 2 17.2 2 36c0 25 34 46 34 46s34-21 34-46C70 17.2 54.8 2 36 2Z" fill="#6d28d9" stroke="white" stroke-width="3"/>
    <circle cx="36" cy="35" r="23" fill="#ffffff"/>
    <text x="36" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="900" fill="#6d28d9">3D</text>
  </svg>`)}`;
// Versión pre-procesada (sin partes < 40 m² y con propiedades mínimas) para una carga más ligera.
const EDIFICIOS_CATASTRO_URL = '/data/malaga/malaga-urbana-edificios-3d-lite.geojson';
const BUILDINGS_CAMERA_RANGE = 4200;
const BUILDINGS_CAMERA_PITCH = CesiumMath.toRadians(-42);
const ANALYTICS_CAMERA_POSITION = { longitude: -4.42473, latitude: 36.71911, altitude: 80 };

type Modo3D = 'lidar' | 'edificios';
type UsoEnergetico = 'residencial' | 'comercial' | 'hotelero';

type EnergyBuildingRecord = {
  entity: Entity;
  baseLoad: number;
  seed: number;
  usage: UsoEnergetico;
  lat: number;
  lng: number;
  plantas: number;
  baseMaterial: ColorMaterialProperty;
};

type CatastroFeature = {
  properties?: {
    localId?: string;
    numberOfFloorsAboveGround?: number;
    lidarColor?: string | null;
    lidarPointCount?: number;
  };
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
};

const colorEdificio = (plantas: number) => {
  if (plantas >= 6) return Color.fromCssColorString('#8b827b');
  if (plantas >= 3) return Color.fromCssColorString('#a79b91');
  return Color.fromCssColorString('#c4b8ad');
};

const crearJerarquia = (anillos: number[][][]) => new PolygonHierarchy(
  Cartesian3.fromDegreesArray(anillos[0].flat()),
  anillos.slice(1).map(anillo => new PolygonHierarchy(Cartesian3.fromDegreesArray(anillo.flat())))
);

const POI_EMOJI: Record<string, string> = { MUSEO: '🏛️', MONUMENTO: '🏰', PLAYA: '🏖️' };
const POI_CACHE = new Map<string, string>();
// Mismo icono que el marcador de Mapa 2D: círculo blanco con borde rojo y emoji por categoría.
const poiMarkerDataUri = (categoria: string) => {
  let uri = POI_CACHE.get(categoria);
  if (!uri) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#ef4444" stroke-width="2"/><text x="16" y="21" font-size="15" text-anchor="middle">${POI_EMOJI[categoria] ?? '📍'}</text></svg>`;
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    POI_CACHE.set(categoria, uri);
  }
  return uri;
};

const MATERIALES_KPI = new Map<string, ColorMaterialProperty>();
const materialKpi = (color: string) => {
  let material = MATERIALES_KPI.get(color);
  if (!material) {
    material = new ColorMaterialProperty(Color.fromCssColorString(color));
    MATERIALES_KPI.set(color, material);
  }
  return material;
};

const seedFromId = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const energyAtHour = (record: EnergyBuildingRecord, hour: number) => {
  const residential = [0.26, 0.22, 0.20, 0.19, 0.20, 0.28, 0.48, 0.72, 0.66, 0.48, 0.40, 0.38, 0.40, 0.39, 0.38, 0.42, 0.50, 0.68, 0.88, 1.00, 0.92, 0.72, 0.50, 0.34];
  const commercial = [0.12, 0.10, 0.09, 0.09, 0.10, 0.14, 0.22, 0.48, 0.76, 0.94, 1.00, 0.98, 0.92, 0.96, 1.00, 0.96, 0.88, 0.68, 0.40, 0.24, 0.18, 0.15, 0.13, 0.12];
  const hotel = [0.46, 0.42, 0.40, 0.39, 0.40, 0.48, 0.62, 0.78, 0.82, 0.72, 0.66, 0.64, 0.70, 0.68, 0.66, 0.70, 0.78, 0.88, 0.96, 1.00, 0.94, 0.80, 0.66, 0.54];
  const profile = record.usage === 'residencial' ? residential : record.usage === 'comercial' ? commercial : hotel;
  return record.baseLoad * profile[hour] * (0.85 + record.seed * 0.3);
};

const ENERGY_MATERIALS = [
  new ColorMaterialProperty(Color.fromCssColorString('#16a34a')),
  new ColorMaterialProperty(Color.fromCssColorString('#84cc16')),
  new ColorMaterialProperty(Color.fromCssColorString('#facc15')),
  new ColorMaterialProperty(Color.fromCssColorString('#f97316')),
  new ColorMaterialProperty(Color.fromCssColorString('#dc2626')),
];

const energyMaterial = (intensity: number) => {
  if (intensity < 0.28) return ENERGY_MATERIALS[0];
  if (intensity < 0.48) return ENERGY_MATERIALS[1];
  if (intensity < 0.68) return ENERGY_MATERIALS[2];
  if (intensity < 0.86) return ENERGY_MATERIALS[3];
  return ENERGY_MATERIALS[4];
};

/**
 * Visor Nivel 3 ampliado para Fase 2:
 * - Renderiza la nube de puntos LiDAR PNOA 2024 como capa territorial base.
 * - Instancia tilesets independientes para LOD2 semántico y mallas fotogramétricas.
 * - Control dinámico de visibilidad independiente para evitar duplicidad y z-fighting.
 */
export const Real3DTilesViewer = forwardRef<Real3DTilesViewerHandle, Real3DTilesViewerProps>(({ 
  recursos,
  sensores,
  rutasDesvio,
  simulacionVisual,
  evolucionTemporal,
  analytics4D = false,
  kpiMapa = null,
  onSelectEdificio,
  onWebglUnavailable
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  
  // Referencias a las dos representaciones principales del mismo territorio.
  const tilesetLidarRef = useRef<Cesium3DTileset | null>(null);
  const edificiosCatastroRef = useRef<CustomDataSource | null>(null);
  const energyBuildingsRef = useRef<EnergyBuildingRecord[]>([]);
  const buildingTwinModelRef = useRef<Model | null>(null);
  const buildingTwinPlaceholderRef = useRef<Entity | null>(null);
  const buildingTwinMarkerRef = useRef<Entity | null>(null);
  const buildingTwinLoadAttemptRef = useRef(0);
  const hiddenOperationalEntitiesRef = useRef<Map<string, boolean>>(new Map());

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [modo3D, setModo3D] = useState<Modo3D>('edificios');
  const [numeroEdificios, setNumeroEdificios] = useState(0);
  const energyHour = evolucionTemporal?.hora ?? 12;
  const [buildingTwinOpen, setBuildingTwinOpen] = useState(false);
  const [buildingTwinStatus, setBuildingTwinStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [buildingTwinError, setBuildingTwinError] = useState('');
  
  // Iteración 10: Datos abiertos y controles de realismo
  const [mapaBase3D, setMapaBase3D] = useState<'ign_gris' | 'pnoa_ortofoto'>('ign_gris');
  const [mostrarTraficoAbierto, setMostrarTraficoAbierto] = useState<boolean>(true);
  const [iluminacionSolar, setIluminacionSolar] = useState<boolean>(!analytics4D);
  const [presetCamara, setPresetCamara] = useState<'cenital' | 'oblicua' | 'peatonal'>('oblicua');
  const pnoaLayerRef = useRef<ImageryLayer | null>(null);
  const ignGrisLayerRef = useRef<ImageryLayer | null>(null);
  const trafficEntitiesRef = useRef<CustomDataSource | null>(null);

  // Carga optimizada (como v3): el visor se crea una sola vez y los datos cambiantes se aplican sobre él.
  const [lidarReady, setLidarReady] = useState(false);
  const framedRef = useRef(false);
  const lidarLoadingRef = useRef(false);
  const recursosRef = useRef(recursos);
  const sensoresRef = useRef(sensores);
  const kpiRef = useRef<KpiMapa | null>(kpiMapa);
  kpiRef.current = kpiMapa;
  const rutasRef = useRef(rutasDesvio);
  recursosRef.current = recursos;
  sensoresRef.current = sensores;
  rutasRef.current = rutasDesvio;
  const operationalEntitiesRef = useRef<Entity[]>([]);

  // Colorea los edificios según el KPI activo (o restaura el color de fachada si no hay ninguno).
  const applyKpiColors = () => {
    const kpi = kpiRef.current;
    const records = energyBuildingsRef.current;
    // Colores precalculados por KPI (caché compartida): cambiar de KPI no repite el kriging.
    const colores = kpi ? coloresKpiEdificios(records, sensoresRef.current, kpi) : [];
    records.forEach((record, index) => {
      if (!record.entity.polygon) return;
      const color = colores[index];
      const material = color ? materialKpi(color) : record.baseMaterial;
      if (record.entity.polygon.material !== material) record.entity.polygon.material = material;
    });
    viewerRef.current?.scene.requestRender();
  };
  const flowPhaseRef = useRef(0);
  const zonasInundacionRef = useRef<{ features: { properties: { riesgo: 'alto' | 'medio' | 'bajo' }; geometry: { type: string; coordinates: unknown } }[] } | null>(null);
  const [zonasInundacionListas, setZonasInundacionListas] = useState(false);
  const simulacionRef = useRef(simulacionVisual);
  simulacionRef.current = simulacionVisual;

  // Recursos, sensores y rutas cambian con cada tick de la simulación: se regeneran
  // sobre el visor existente en lugar de reconstruir todo Cesium.
  const rebuildOperationalEntities = (viewer: Viewer) => {
    operationalEntitiesRef.current.forEach(entity => viewer.entities.remove(entity));
    operationalEntitiesRef.current = [];
    const twinOpen = hiddenOperationalEntitiesRef.current.size > 0;
    const add = (options: ConstructorParameters<typeof Entity>[0]) => {
      const entity = viewer.entities.add(options as any);
      if (twinOpen) {
        hiddenOperationalEntitiesRef.current.set(entity.id, true);
        entity.show = false;
      }
      operationalEntitiesRef.current.push(entity);
    };

    // Líneas de flujo del escenario activo (también en Analítica temporal), igual que en Mapa 2D.
    const simulacion = simulacionRef.current;
    if (simulacion && simulacion.escenarioId !== 'base' && simulacion.intensidad >= 0.04) {
      const intensidad = Math.max(0.15, Math.min(1, simulacion.intensidad));
      const flujo = simulacion.escenarioId === 'crucero_masivo'
        ? { color: '#06b6d4', puntos: RUTAS_CRUCERO_VIARIAS, etiqueta: 'Flujo simulado de cruceristas' }
        : simulacion.escenarioId === 'evento_cultural'
          ? { color: '#d946ef', puntos: RUTAS_EVENTO_VIARIAS, etiqueta: 'Circuito cultural nocturno' }
          : null;
      // Afección por lluvias: zonas de acumulación de agua sobre calzada (mismas que en Mapa 2D).
      const zonasAgua = zonasInundacionRef.current;
      if (simulacion.escenarioId === 'episodio_meteo' && zonasAgua) {
        const estilos = { alto: ['#0369a1', 0.8], medio: ['#0ea5e9', 0.55], bajo: ['#7dd3fc', 0.4] } as const;
        zonasAgua.features.forEach((feature, fi) => {
          const [fill, opacidad] = estilos[feature.properties.riesgo];
          const poligonos = feature.geometry.type === 'MultiPolygon'
            ? feature.geometry.coordinates as number[][][][]
            : [feature.geometry.coordinates as number[][][]];
          poligonos.forEach((anillos, pi) => add({
            id: `lluvia-${fi}-${pi}`,
            name: `Posible acumulación de agua · riesgo ${feature.properties.riesgo}`,
            polygon: {
              hierarchy: crearJerarquia(anillos),
              height: 1,
              material: Color.fromCssColorString(fill).withAlpha(opacidad * (0.35 + 0.65 * intensidad)),
            },
          }));
        });
      }
      simulacion.flujos?.forEach((flujoModelo) => {
        const color = Color.fromCssColorString(flujoModelo.color);
        const peso = flujoModelo.peso;
        add({
          id: flujoModelo.id,
          name: flujoModelo.etiqueta,
          description: `${Math.round(intensidad * peso * 100)}% de intensidad`,
          polyline: {
            positions: flujoModelo.puntos.map(([lat, lng]) => Cartesian3.fromDegrees(lng, lat, 24)),
            width: (3 + intensidad * 4) * peso + 1,
            material: new PolylineDashMaterialProperty({
              color: color.withAlpha(0.5 + intensidad * 0.45),
              dashLength: 24,
              dashPattern: new CallbackProperty(() => {
                const k = flowPhaseRef.current % 16;
                return ((0xF0F0 << k) | (0xF0F0 >> (16 - k))) & 0xFFFF;
              }, false) as any,
            }),
          },
        });
        const [latFin, lngFin] = flujoModelo.puntos[flujoModelo.puntos.length - 1];
        add({
          id: `${flujoModelo.id}-destino`,
          position: Cartesian3.fromDegrees(lngFin, latFin, 24),
          point: { pixelSize: new CallbackProperty(() => (8 + intensidad * 6) * peso * (1 + 0.35 * Math.sin(flowPhaseRef.current / 16 * Math.PI * 2)) + 4, false) as any, color: color.withAlpha(0.8), outlineColor: Color.WHITE, outlineWidth: 2 },
        });
      });
      flujo?.puntos.forEach((coordenadas, indice) => {
        const color = Color.fromCssColorString(flujo.color);
        add({
          id: `flujo-simulado-${indice}`,
          name: `${flujo.etiqueta} ${indice + 1}`,
          description: `${Math.round(intensidad * 100)}% de intensidad`,
          polyline: {
            positions: coordenadas.map(([lat, lng]) => Cartesian3.fromDegrees(lng, lat, 22)),
            width: 4 + intensidad * 4,
            // El patrón de guiones se rota 1 bit por paso: los guiones avanzan por la ruta.
            material: new PolylineDashMaterialProperty({
              color: color.withAlpha(0.45 + intensidad * 0.5),
              dashLength: 24,
              dashPattern: new CallbackProperty(() => {
                const k = flowPhaseRef.current % 16;
                return ((0xF0F0 << k) | (0xF0F0 >> (16 - k))) & 0xFFFF;
              }, false) as any,
            }),
          },
        });
        const [latFin, lngFin] = coordenadas[coordenadas.length - 1];
        add({
          id: `flujo-simulado-destino-${indice}`,
          position: Cartesian3.fromDegrees(lngFin, latFin, 22),
          point: { pixelSize: new CallbackProperty(() => (10 + intensidad * 6) * (1 + 0.35 * Math.sin(flowPhaseRef.current / 16 * Math.PI * 2)), false) as any, color: color.withAlpha(0.8), outlineColor: Color.WHITE, outlineWidth: 2 },
        });
      });
    }

    // En Analítica temporal se muestran puntos de interés (museos, monumentos, Alcazaba…) y sensores, como en Mapa 2D.
    if (analytics4D) recursosRef.current.forEach((recurso) => {
      const [lat, lng] = recurso.ubicacion;
      add({
        name: recurso.nombre,
        position: Cartesian3.fromDegrees(lng, lat, 40),
        billboard: {
          image: poiMarkerDataUri(recurso.categoria),
          width: 32,
          height: 32,
          verticalOrigin: VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: recurso.nombre,
          font: '600 11px sans-serif',
          fillColor: Color.fromCssColorString('#243047'),
          outlineColor: Color.WHITE,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(20, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    });

    // Recursos turísticos ordinarios
    if (!analytics4D) recursosRef.current.forEach((recurso) => {
      const [lat, lng] = recurso.ubicacion;
      add({
        name: recurso.nombre,
        position: Cartesian3.fromDegrees(lng, lat, 12),
        point: { pixelSize: 8, color: Color.fromCssColorString('#d9295d'), outlineColor: Color.WHITE, outlineWidth: 2 },
        label: {
          text: recurso.nombre,
          font: '600 11px sans-serif',
          fillColor: Color.fromCssColorString('#243047'),
          outlineColor: Color.WHITE,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian3(10, 0, 0),
        },
      });
    });

    // Sensores IoT: solo el icono, sin etiqueta
    sensoresRef.current.forEach((sensor) => {
      const [lat, lng] = sensor.ubicacion;
      const estado = sensor.estadoSimulado ?? sensor.estado;
      const visual = sensorVisual(sensor);
      add({
        name: sensor.nombre,
        position: Cartesian3.fromDegrees(lng, lat, 15),
        billboard: {
          image: sensorMarkerDataUri(sensor.tipoSensor, visual.color, estado === 'CRITICO' ? '#ef4444' : estado === 'PRECAUCION' ? '#f59e0b' : visual.color),
          width: 28,
          height: 28,
          verticalOrigin: VerticalOrigin.CENTER,
        },
      });
    });

    // Rutas de desvío
    if (!analytics4D) rutasRef.current.forEach((ruta) => {
      if (ruta.coordenadasRuta.length < 2) return;
      add({
        name: `Ruta de desvío · ${ruta.origen} → ${ruta.destino}`,
        polyline: {
          positions: ruta.coordenadasRuta.map(([lat, lng]) => Cartesian3.fromDegrees(lng, lat, 28)),
          width: 3,
          material: new PolylineDashMaterialProperty({ color: Color.fromCssColorString('#0ea5e9'), dashLength: 16 }),
        },
      });
    });
    viewer.scene.requestRender();
  };

  const frameCity = (viewer: Viewer, duration = 0.8) => {
    const center = Cartesian3.fromDegrees(ANALYTICS_CAMERA_POSITION.longitude, ANALYTICS_CAMERA_POSITION.latitude, 0);
    viewer.camera.flyToBoundingSphere(new BoundingSphere(center, 1500), {
      duration,
      offset: new HeadingPitchRange(0, BUILDINGS_CAMERA_PITCH, BUILDINGS_CAMERA_RANGE),
    });
  };

  const setBuildingTwinView = (view: 'front' | 'side' | 'top') => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const position = Cartesian3.fromDegrees(
      BUILDING_TWIN_POSITION.longitude,
      BUILDING_TWIN_POSITION.latitude,
      BUILDING_TWIN_POSITION.altitude + 3,
    );
    const views = {
      front: new HeadingPitchRange(CesiumMath.toRadians(145), CesiumMath.toRadians(-16), 34),
      side: new HeadingPitchRange(CesiumMath.toRadians(55), CesiumMath.toRadians(-16), 34),
      top: new HeadingPitchRange(0, CesiumMath.toRadians(-88), 28),
    };
    viewer.camera.flyToBoundingSphere(new BoundingSphere(position, 11), {
      duration: 0.9,
      offset: views[view],
    });
  };

  const focusAnalyticsBuildings = (viewer: Viewer, duration = 0.8) => {
    const center = Cartesian3.fromDegrees(
      ANALYTICS_CAMERA_POSITION.longitude,
      ANALYTICS_CAMERA_POSITION.latitude,
      ANALYTICS_CAMERA_POSITION.altitude,
    );
    viewer.camera.flyToBoundingSphere(new BoundingSphere(center, 1450), {
      duration,
      offset: new HeadingPitchRange(CesiumMath.toRadians(8), CesiumMath.toRadians(-48), 2850),
    });
  };

  const openBuildingTwin = async () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    setBuildingTwinOpen(true);
    setBuildingTwinStatus('loading');
    setBuildingTwinError('');
    if (hiddenOperationalEntitiesRef.current.size === 0) {
      viewer.entities.values.forEach((entity) => {
        hiddenOperationalEntitiesRef.current.set(entity.id, entity.show);
        entity.show = false;
      });
    }
    if (buildingTwinPlaceholderRef.current) buildingTwinPlaceholderRef.current.show = false;
    if (buildingTwinMarkerRef.current) buildingTwinMarkerRef.current.show = false;

    const position = Cartesian3.fromDegrees(
      BUILDING_TWIN_POSITION.longitude,
      BUILDING_TWIN_POSITION.latitude,
      BUILDING_TWIN_POSITION.altitude,
    );
    setBuildingTwinView('front');

    const attempt = ++buildingTwinLoadAttemptRef.current;
    if (buildingTwinModelRef.current) {
      viewer.scene.primitives.remove(buildingTwinModelRef.current);
      buildingTwinModelRef.current = null;
    }

    try {
      const model = await Model.fromGltfAsync({
        url: BUILDING_TWIN_MODEL_URL,
        modelMatrix: Transforms.headingPitchRollToFixedFrame(
          position,
          new HeadingPitchRoll(CesiumMath.toRadians(BUILDING_TWIN_HEADING), 0, 0),
        ),
        scale: BUILDING_TWIN_SCALE,
      });

      if (attempt !== buildingTwinLoadAttemptRef.current || viewer.isDestroyed()) {
        if (!model.isDestroyed()) model.destroy();
        return;
      }

      viewer.scene.primitives.add(model);
      buildingTwinModelRef.current = model;
      setBuildingTwinStatus('ready');
    } catch (error) {
      if (attempt !== buildingTwinLoadAttemptRef.current) return;
      setBuildingTwinStatus('error');
      setBuildingTwinError(error instanceof Error ? error.message : 'No se pudo cargar el modelo fotogramétrico.');
    }
  };

  const closeBuildingTwin = () => {
    const viewer = viewerRef.current;
    buildingTwinLoadAttemptRef.current += 1;
    if (viewer && !viewer.isDestroyed() && buildingTwinModelRef.current) {
      viewer.scene.primitives.remove(buildingTwinModelRef.current);
    }
    buildingTwinModelRef.current = null;
    viewer?.entities.values.forEach((entity) => {
      const previousVisibility = hiddenOperationalEntitiesRef.current.get(entity.id);
      if (previousVisibility !== undefined) entity.show = previousVisibility;
    });
    hiddenOperationalEntitiesRef.current.clear();
    setBuildingTwinOpen(false);
    setBuildingTwinStatus('idle');
    setBuildingTwinError('');
  };

  useImperativeHandle(ref, () => ({
    flyToEdificio: (edificio: Edificio3DRecord) => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      const [lat, lng] = edificio.coordenadasCentro;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lng, lat - 0.0018, 140),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-35),
          roll: 0,
        },
        duration: 1.2,
      });
    }
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    framedRef.current = false;
    tilesetLidarRef.current = null;
    lidarLoadingRef.current = false;
    setLidarReady(false);
    (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium/';

    // Sin un contexto WebGL funcional, Cesium puede abrir un diálogo nativo y
    // dejar el contenedor vacío. En ese caso se delega al visor compatible.
    try {
      const probe = document.createElement('canvas');
      const hasWebGL = Boolean(
        probe.getContext('webgl2', { antialias: false }) ||
        probe.getContext('webgl', { antialias: false }),
      );
      if (!hasWebGL) {
        onWebglUnavailable?.();
        return () => { disposed = true; };
      }
    } catch {
      onWebglUnavailable?.();
      return () => { disposed = true; };
    }

    let viewer: Viewer;
    try {
      viewer = new Viewer(container, {
        animation: false,
        baseLayer: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: true,
        selectionIndicator: false,
        timeline: false,
        // Render bajo demanda: sin fotogramas continuos cuando la escena está quieta.
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
      });
    } catch {
      container.replaceChildren();
      onWebglUnavailable?.();
      return () => { disposed = true; };
    }
    viewerRef.current = viewer;

    // Cámara inicial directamente sobre Málaga: evita el vuelo desde la vista global del planeta.
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        ANALYTICS_CAMERA_POSITION.longitude,
        ANALYTICS_CAMERA_POSITION.latitude,
        3500,
      ),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-60), roll: 0 },
    });

    viewer.scene.backgroundColor = Color.fromCssColorString('#d8d8d8');
    viewer.scene.globe.baseColor = Color.fromCssColorString('#d8d8d8');
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.highDynamicRange = true;
    viewer.scene.globe.enableLighting = !analytics4D; // la Analítica 4D usa la paleta clara de la v3 (base gris, sin iluminación solar)
    if (viewer.scene.fog) {
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.00015;
    }

    // Capa 1: Base Gris IGN
    const ignGrisLayer = viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({
      url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{reverseY}.jpeg',
      maximumLevel: 17,
      credit: 'CC-BY 4.0 Instituto Geográfico Nacional',
    }));
    ignGrisLayerRef.current = ignGrisLayer;
    ignGrisLayer.show = mapaBase3D === 'ign_gris';

    // Capa 2: Ortoimagen Satelital Aérea Real PNOA IGN (WMS Abierto)
    const pnoaLayer = viewer.imageryLayers.addImageryProvider(new WebMapServiceImageryProvider({
      url: 'https://www.ign.es/wms-inspire/pnoa-ma',
      layers: 'OI.OrthoimageCoverage',
      parameters: {
        format: 'image/jpeg',
        transparent: 'false',
        version: '1.3.0',
      },
      credit: 'CC-BY 4.0 Instituto Geográfico Nacional - PNOA',
    }));
    pnoaLayerRef.current = pnoaLayer;
    pnoaLayer.show = mapaBase3D === 'pnoa_ortofoto';

    // Gemelo de edificio demostrador: permanece visible como un activo más de Málaga.
    if (!analytics4D) {
      const headingRadians = CesiumMath.toRadians(BUILDING_TWIN_HEADING);
      const metersPerDegreeLatitude = 111_320;
      const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.cos(CesiumMath.toRadians(BUILDING_TWIN_POSITION.latitude));
      const projectFootprint = (innerScale = 1) => BUILDING_TWIN_FOOTPRINT.flatMap(([localX, localZ]) => {
          const scaledX = localX * BUILDING_TWIN_SCALE * innerScale;
          const scaledZ = localZ * BUILDING_TWIN_SCALE * innerScale;
          const east = scaledX * Math.cos(headingRadians) - scaledZ * Math.sin(headingRadians);
          const north = scaledX * Math.sin(headingRadians) + scaledZ * Math.cos(headingRadians);
          return [
            BUILDING_TWIN_POSITION.longitude + east / metersPerDegreeLongitude,
            BUILDING_TWIN_POSITION.latitude + north / metersPerDegreeLatitude,
          ];
        });
      const footprintDegrees = projectFootprint();
      const buildingTwinPlaceholder = viewer.entities.add({
        id: 'building-twin-villa-lucia-placeholder',
        name: 'Villa Málaga · Edificio preparado para gemelo 3D',
        polygon: {
          hierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(footprintDegrees)),
          height: BUILDING_TWIN_POSITION.altitude,
          extrudedHeight: BUILDING_TWIN_POSITION.altitude + 5,
          material: Color.fromCssColorString('#af8c82'),
          outline: true,
          outlineColor: Color.fromCssColorString('#6f514a'),
        },
      });
      buildingTwinPlaceholderRef.current = buildingTwinPlaceholder;

      const buildingTwinMarker = viewer.entities.add({
      id: BUILDING_TWIN_MARKER_ID,
      name: 'Abrir gemelo 3D de Villa Málaga',
      position: Cartesian3.fromDegrees(
        BUILDING_TWIN_POSITION.longitude,
        BUILDING_TWIN_POSITION.latitude,
        BUILDING_TWIN_POSITION.altitude + 9,
      ),
      billboard: {
        image: BUILDING_TWIN_ICON,
        width: 32,
        height: 38,
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: 'GEMELO 3D',
        font: '800 9px sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString('#4c1d95'),
        outlineWidth: 4,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.TOP,
        horizontalOrigin: HorizontalOrigin.CENTER,
        pixelOffset: new Cartesian2(0, 8),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      });
      buildingTwinMarkerRef.current = buildingTwinMarker;

      viewer.selectedEntityChanged.addEventListener((selectedEntity) => {
        if (selectedEntity?.id === buildingTwinMarker.id) void openBuildingTwin();
      });
    }

    // 1. Activos singulares de la Primera Oleada de Fase 2 (marcadores e interacción)
    if (!analytics4D) EDIFICIOS_OLEADA_1.forEach((edificio) => {
      const [lat, lng] = edificio.coordenadasCentro;
      viewer.entities.add({
        name: edificio.nombre,
        position: Cartesian3.fromDegrees(lng, lat, edificio.alturaCumbreraM + 8),
        point: {
          pixelSize: 12,
          color: Color.fromCssColorString('#e11d48'),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `★ ${edificio.nombre}`,
          font: 'bold 12px sans-serif',
          fillColor: Color.fromCssColorString('#1e293b'),
          outlineColor: Color.WHITE,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian3(0, -10, 0),
        },
      });
    });

    rebuildOperationalEntities(viewer);

    // Encuadre inmediato sobre Málaga (sin vuelo desde la vista del globo).
    if (analytics4D) focusAnalyticsBuildings(viewer, 0);
    else frameCity(viewer, 0);

    // 4b. Red de tráfico y movilidad abierta
    if (!analytics4D) {
      const trafficSource = new CustomDataSource('trafico-abierto-3d');
      trafficEntitiesRef.current = trafficSource;
      trafficSource.show = mostrarTraficoAbierto;
      void viewer.dataSources.add(trafficSource);
      // Viario principal real (OSM) con carga sintética por jerarquía, centralidad y hora.
      void cargarViarioPrincipal().then(features => {
        if (disposed) return;
        const ancho: Record<string, number> = { motorway: 6, primary: 5, secondary: 3.5, motorway_link: 3, primary_link: 3 };
        construirRed(features, new Date().getHours() + new Date().getMinutes() / 60).forEach(tramo => {
          trafficSource.entities.add({
            name: `Tráfico: ${tramo.nombre}`,
            description: `Carga: ${Math.round(tramo.carga * 100)} % · Velocidad: ${tramo.velocidadKmh} km/h · Intensidad: ${tramo.vehiculosHora} veh/h · Fuente viario: © OpenStreetMap contributors (simulación calibrada)`,
            polyline: {
              positions: Cartesian3.fromDegreesArrayHeights(tramo.coordenadas.flatMap(([lng, lat]) => [lng, lat, 8])),
              width: ancho[tramo.clase] ?? 3,
              material: Color.fromCssColorString(colorCarga(tramo.carga)).withAlpha(0.9),
            },
          });
        });
        viewer.scene.requestRender();
      }).catch(() => {
        if (disposed) return;
        // Respaldo: tramos de ejemplo si el viario OSM no está disponible.
        OpenDataService.getTrafficSegments('malaga').forEach(seg => {
          const color = seg.nivelCongestion === 'CONGESTIONADO' ? '#ef4444'
                      : seg.nivelCongestion === 'DENSO' ? '#f97316'
                      : seg.nivelCongestion === 'MODERADO' ? '#eab308'
                      : '#10b981';
          trafficSource.entities.add({
            name: `Tráfico: ${seg.nombreVia}`,
            polyline: {
              positions: seg.coordenadas.map(([lat, lng]) => Cartesian3.fromDegrees(lng, lat, 18)),
              width: 5,
              material: Color.fromCssColorString(color).withAlpha(0.85),
            },
          });
        });
        viewer.scene.requestRender();
      });
    }

    // 5. Carga progresiva: mapa base -> edificios neutros (por lotes) -> color por edificio.
    const yieldToBrowser = () => new Promise<void>(resolve => window.setTimeout(resolve, 0));
    const CHUNK = 700;
    const NEUTRAL_MATERIAL = new ColorMaterialProperty(Color.fromCssColorString('#c9c1b8'));

    const loadRepresentations = async () => {
      try {
        const response = await fetch(EDIFICIOS_CATASTRO_URL);
        if (!response.ok) throw new Error(`Catastro HTTP ${response.status}`);
        const collection = await response.json() as { features?: CatastroFeature[] };
        if (disposed) return;

        const edificiosSource = new CustomDataSource('edificios-catastro-3d');
        edificiosSource.show = true;
        edificiosCatastroRef.current = edificiosSource;
        energyBuildingsRef.current = [];
        await viewer.dataSources.add(edificiosSource);

        // Edificios sin color (material compartido), en lotes para no bloquear la interfaz.
        const facades: Color[] = [];
        let total = 0;
        let enLote = 0;
        edificiosSource.entities.suspendEvents();
        const flush = async () => {
          edificiosSource.entities.resumeEvents();
          viewer.scene.requestRender();
          await yieldToBrowser();
          edificiosSource.entities.suspendEvents();
          enLote = 0;
        };

        for (const [featureIndex, feature] of (collection.features || []).entries()) {
          if (disposed) return;
          if (!feature.geometry?.coordinates) continue;
          const plantas = Math.max(1, Number(feature.properties?.numberOfFloorsAboveGround || 1));
          const altura = Math.max(3, plantas * 3);
          const puntosColor = Number(feature.properties?.lidarPointCount || 0);
          const fachada = feature.properties?.lidarColor
            ? Color.fromCssColorString(feature.properties.lidarColor)
            : colorEdificio(plantas);
          const poligonos = feature.geometry.type === 'MultiPolygon'
            ? feature.geometry.coordinates as number[][][][]
            : [feature.geometry.coordinates as number[][][]];

          for (const [polygonIndex, anillos] of poligonos.entries()) {
            const buildingId = `${feature.properties?.localId || featureIndex}-${polygonIndex}`;
            const seed = seedFromId(buildingId);
            const usage: UsoEnergetico = seed < 0.58 ? 'residencial' : seed < 0.84 ? 'comercial' : 'hotelero';
            const entity = edificiosSource.entities.add({
              id: `catastro-${buildingId}`,
              name: `Edificio Catastro · ${feature.properties?.localId || featureIndex}`,
              description: `${plantas} plantas · altura estimada ${altura} m · ${puntosColor > 0 ? 'color LiDAR' : 'tono neutro'}`,
              polygon: {
                hierarchy: crearJerarquia(anillos),
                height: 0,
                extrudedHeight: altura,
                material: NEUTRAL_MATERIAL,
              },
              properties: {
                localId: feature.properties?.localId,
                plantas,
                alturaEstimada: altura,
                lidarColor: feature.properties?.lidarColor,
                lidarPointCount: puntosColor,
                fuente: 'D.G. del Catastro · INSPIRE BU',
              },
            });
            const ring = anillos[0];
            facades.push(fachada);
            energyBuildingsRef.current.push({
              entity,
              lat: ring.reduce((a, p) => a + p[1], 0) / ring.length,
              lng: ring.reduce((a, p) => a + p[0], 0) / ring.length,
              plantas,
              baseMaterial: NEUTRAL_MATERIAL,
              baseLoad: (10 + plantas * 7) * (0.72 + seed * 0.9),
              seed,
              usage,
            });
            total += 1;
            enLote += 1;
            if (enLote >= CHUNK) {
              await flush();
              if (disposed) return;
            }
          }
        }
        edificiosSource.entities.resumeEvents();
        viewer.scene.requestRender();
        if (disposed) return;
        setNumeroEdificios(total);
        setStatus('ready');

        // Colores de fachada (LiDAR). En Analítica los colores los pone la energía.
        if (analytics4D) return;
        await yieldToBrowser();
        const records = energyBuildingsRef.current;
        for (let start = 0; start < records.length; start += CHUNK) {
          if (disposed) return;
          for (let i = start; i < Math.min(start + CHUNK, records.length); i += 1) {
            const record = records[i];
            record.baseMaterial = new ColorMaterialProperty(facades[i]);
            if (record.entity.polygon && !kpiRef.current) record.entity.polygon.material = record.baseMaterial;
          }
          viewer.scene.requestRender();
          await yieldToBrowser();
        }
        if (!disposed) {
          applyKpiColors();
          precalentarKpis(records, sensoresRef.current, () => disposed);
        }
      } catch (error) {
        if (!disposed) {
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Error al preparar los edificios 3D.');
        }
      }
    };

    // El mapa base se pinta primero; los edificios empiezan después.
    window.setTimeout(() => { if (!disposed) void loadRepresentations(); }, 150);

    return () => {
      disposed = true;
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, [analytics4D]);

  // Refrescar marcadores operativos sin reiniciar el visor.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    rebuildOperationalEntities(viewer);
  }, [recursos, sensores, rutasDesvio, analytics4D, zonasInundacionListas, simulacionVisual?.escenarioId, simulacionVisual?.flujos, simulacionVisual && Math.round(simulacionVisual.intensidad * 20)]);

  // Zonas de acumulación de agua: se descargan al activar el episodio de lluvia.
  const lluviaActiva = simulacionVisual?.escenarioId === 'episodio_meteo';
  useEffect(() => {
    if (!lluviaActiva || zonasInundacionRef.current) return;
    const controller = new AbortController();
    fetch('/data/malaga/malaga-zonas-inundacion.geojson', { signal: controller.signal })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then(data => { zonasInundacionRef.current = data; setZonasInundacionListas(true); })
      .catch(error => { if (error.name !== 'AbortError') console.warn('No se pudieron cargar las zonas de inundación', error); });
    return () => controller.abort();
  }, [lluviaActiva]);

  // Anima las líneas de flujo (Cesium renderiza bajo demanda, así que se pide un frame por paso).
  const flujoActivo = Boolean(simulacionVisual && simulacionVisual.escenarioId !== 'base' && simulacionVisual.intensidad >= 0.04);
  useEffect(() => {
    if (!flujoActivo) return;
    const id = window.setInterval(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      flowPhaseRef.current = (flowPhaseRef.current + 1) % 1600;
      viewer.scene.requestRender();
    }, 70);
    return () => window.clearInterval(id);
  }, [flujoActivo, analytics4D]);

  // Alternar sin reconstruir Cesium: una sola representación territorial visible cada vez.
  useEffect(() => {
    const viewer = viewerRef.current;
    const lidar = tilesetLidarRef.current;
    const edificios = edificiosCatastroRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (buildingTwinOpen) {
      if (lidar) lidar.show = false;
      if (edificios) edificios.show = false;
      viewer.scene.requestRender();
      return;
    }

    if (lidar) lidar.show = modo3D === 'lidar';
    if (edificios) edificios.show = modo3D === 'edificios';
    viewer.scene.requestRender();

    // El primer encuadre ya se hizo al crear el visor: solo se anima al cambiar de representación.
    const firstFraming = !framedRef.current && numeroEdificios > 0;
    if (numeroEdificios > 0) framedRef.current = true;
    const duration = firstFraming ? 0 : 0.8;

    if (modo3D === 'edificios' && edificios && numeroEdificios > 0) {
      if (firstFraming) return;
      if (analytics4D) focusAnalyticsBuildings(viewer, duration);
      else frameCity(viewer, duration);
    } else if (modo3D === 'lidar') {
      // La nube LiDAR pesa mucho: solo se descarga cuando el usuario la pide.
      if (lidar) {
        void viewer.flyTo(lidar, { duration, offset: new HeadingPitchRange(0, CesiumMath.toRadians(-35), 700) });
        return;
      }
      if (lidarLoadingRef.current) return;
      lidarLoadingRef.current = true;
      void Cesium3DTileset.fromUrl(TILESET_LIDAR_URL, {
        maximumScreenSpaceError: 12,
        cacheBytes: 256 * 1024 * 1024,
        maximumCacheOverflowBytes: 128 * 1024 * 1024,
      }).then(async (tsLidar) => {
        if (viewer.isDestroyed()) return;
        tsLidar.pointCloudShading.attenuation = true;
        tsLidar.pointCloudShading.geometricErrorScale = 1.25;
        viewer.scene.primitives.add(tsLidar);
        tilesetLidarRef.current = tsLidar;
        setLidarReady(true);
        await viewer.flyTo(tsLidar, { duration: 0, offset: new HeadingPitchRange(0, CesiumMath.toRadians(-35), 700) });
      }).catch((error) => {
        console.warn('No se pudo cargar la nube LiDAR', error);
      }).finally(() => { lidarLoadingRef.current = false; });
    }
  }, [modo3D, numeroEdificios, buildingTwinOpen, analytics4D, lidarReady]);

  // Alternar mapa base entre PNOA Satelital y Base Gris IGN
  useEffect(() => {
    if (pnoaLayerRef.current) pnoaLayerRef.current.show = mapaBase3D === 'pnoa_ortofoto';
    if (ignGrisLayerRef.current) ignGrisLayerRef.current.show = mapaBase3D === 'ign_gris';
    viewerRef.current?.scene.requestRender();
  }, [mapaBase3D]);

  // Alternar visibilidad de la red de tráfico
  useEffect(() => {
    if (trafficEntitiesRef.current) {
      trafficEntitiesRef.current.show = mostrarTraficoAbierto;
      viewerRef.current?.scene.requestRender();
    }
  }, [mostrarTraficoAbierto]);

  // Alternar iluminación solar
  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) {
      viewer.scene.globe.enableLighting = iluminacionSolar;
      viewer.scene.requestRender();
    }
  }, [iluminacionSolar]);

  // Presets de cámara
  const aplicarPresetCamara = (preset: 'cenital' | 'oblicua' | 'peatonal') => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    setPresetCamara(preset);

    const centro = Cartesian3.fromDegrees(-4.4200, 36.7200, 0);
    if (preset === 'cenital') {
      viewer.camera.flyToBoundingSphere(new BoundingSphere(centro, 1200), {
        duration: 1.0,
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(-88), 1800),
      });
    } else if (preset === 'oblicua') {
      viewer.camera.flyToBoundingSphere(new BoundingSphere(centro, 1000), {
        duration: 1.0,
        offset: new HeadingPitchRange(CesiumMath.toRadians(15), CesiumMath.toRadians(-35), 1100),
      });
    } else if (preset === 'peatonal') {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(-4.4210, 36.7185, 35),
        orientation: {
          heading: CesiumMath.toRadians(35),
          pitch: CesiumMath.toRadians(-12),
          roll: 0,
        },
        duration: 1.2,
      });
    }
  };

  useEffect(() => {
    if (analytics4D) setModo3D('edificios');
  }, [analytics4D]);

  useEffect(() => {
    if (analytics4D) return;
    if (kpiMapa) setModo3D('edificios');
    applyKpiColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiMapa, sensores, numeroEdificios, analytics4D]);

  useEffect(() => {
    if (numeroEdificios === 0) return;
    const records = energyBuildingsRef.current;

    if (!analytics4D) return;

    records.forEach(record => {
      const value = energyAtHour(record, energyHour);
      const intensity = Math.min(1, value / Math.max(1, record.baseLoad * 1.05));
      if (record.entity.polygon) {
        record.entity.polygon.material = energyMaterial(intensity);
      }
    });
    viewerRef.current?.scene.requestRender();
  }, [analytics4D, energyHour, numeroEdificios]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#e7f0f4]">
      <div ref={containerRef} className="h-full w-full" />

      {/* Cambio rápido de mapa base (Base Gris IGN, como la v3, o ortofoto PNOA) */}
      <button
        type="button"
        onClick={() => setMapaBase3D(v => (v === 'ign_gris' ? 'pnoa_ortofoto' : 'ign_gris'))}
        title="Cambiar mapa base"
        className="absolute right-14 top-2 z-10 flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-lg backdrop-blur hover:bg-slate-50"
      >
        <Layers className="h-3.5 w-3.5 text-cyan-600" />
        {mapaBase3D === 'ign_gris' ? 'Base Gris · ver Ortofoto' : 'Ortofoto PNOA · ver Base Gris'}
      </button>

      {/* Tarjeta de estado de metadatos del activo territorial */}
      {!buildingTwinOpen && <div className="absolute left-4 top-4 z-10 max-w-sm rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          {status === 'loading' && <LoaderCircle className="h-4 w-4 animate-spin text-cyan-600" />}
          {status === 'ready' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          {status === 'error' && <TriangleAlert className="h-4 w-4 text-rose-600" />}
          <span className="text-xs font-bold text-slate-800">
            {analytics4D ? 'Nivel 4 · Analítica temporal 3D' : 'Nivel 3 · Representación territorial'}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
          {analytics4D
            ? 'Evolución temporal simulada del escenario · Málaga urbana ampliada.'
            : 'Málaga urbana ampliada · Seleccione la representación 3D manteniendo el mismo contexto operativo.'}
        </p>
        
        {analytics4D ? (
          <div className="mt-2.5 border-t border-slate-100 pt-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-700">Evolución temporal simulada</div>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-black text-slate-800">{String(energyHour).padStart(2, '0')}:00</span>
              <button
                type="button"
                onClick={() => evolucionTemporal?.onAlternar()}
                className="flex items-center gap-1 rounded-lg border border-cyan-700 bg-cyan-50 px-2.5 py-1.5 text-[10px] font-bold text-cyan-800 transition-colors hover:bg-cyan-100"
              >
                {evolucionTemporal?.reproduciendo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {evolucionTemporal?.reproduciendo ? 'Pausar' : 'Reproducir'}
              </button>
            </div>
            <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-600">{evolucionTemporal?.escenarioNombre}</div>
            <input
              type="range"
              min="0"
              max="23"
              step="1"
              value={energyHour}
              onChange={event => evolucionTemporal?.onCambiarHora(Number(event.target.value))}
              className="mt-2 h-1.5 w-full cursor-pointer accent-cyan-500"
              aria-label="Hora simulada"
            />
            <div className="mt-1 flex justify-between text-[8px] font-medium text-slate-400"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
            <div className="mt-2 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[10px]">
              <span className="text-slate-500">Intensidad activa del escenario</span>
              <b className="font-mono text-cyan-700">{Math.round((evolucionTemporal?.intensidad ?? 0) * 100)}%</b>
            </div>
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[9px] font-medium text-amber-800">Datos sintéticos para demostración.</p>
          </div>
        ) : (
          <>
        {/* Selector excluyente de representación 3D */}
        <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
          <button
            onClick={() => setModo3D('edificios')}
            disabled={numeroEdificios === 0}
            className={`flex min-h-14 flex-col items-start justify-center rounded-lg border px-2.5 py-2 text-left transition-all ${
              modo3D === 'edificios'
                ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50/50'
            } disabled:cursor-wait disabled:opacity-50`}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold"><Boxes className="h-3.5 w-3.5" /> Edificios 3D</span>
            <span className="mt-0.5 text-[9px]">{numeroEdificios > 0 ? `${numeroEdificios.toLocaleString('es-ES')} piezas` : 'Preparando…'}</span>
          </button>
          <button
            onClick={() => setModo3D('lidar')}
            className={`flex min-h-14 flex-col items-start justify-center rounded-lg border px-2.5 py-2 text-left transition-all ${
              modo3D === 'lidar'
                ? 'border-slate-600 bg-slate-100 text-slate-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold"><Cloud className="h-3.5 w-3.5" /> Nube LiDAR</span>
            <span className="mt-0.5 text-[9px]">PNOA 2024 RGBI</span>
          </button>
        </div>

        <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-[9px] leading-relaxed text-slate-500">
          {modo3D === 'edificios'
            ? '9.192 piezas reales: 1.956 con color LiDAR RGB y el resto en tonos neutros. Altura estimada por plantas.'
            : 'Nube de puntos LiDAR real, conservando color y geometría capturados en vuelo.'}
        </div>

        {/* Controles de Realismo y Datos Abiertos (Iteración 10) */}
        <div className="mt-3 border-t border-slate-100 pt-2 space-y-2">
          {/* Selector de Procedencia de Capa Visual (Iteración 17) */}
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 bg-blue-50/60 p-1.5 rounded-lg border border-blue-200/60">
            <span className="flex items-center gap-1 text-blue-900"><Layers className="w-3 h-3 text-blue-600" /> Procedencia 3D</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-blue-700 border border-blue-200">
              PID Open Data (PNOA)
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
            <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-cyan-600" /> Mapa Base</span>
            <div className="flex gap-1">
              <button
                onClick={() => setMapaBase3D('pnoa_ortofoto')}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${mapaBase3D === 'pnoa_ortofoto' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                PNOA Ortofoto
              </button>
              <button
                onClick={() => setMapaBase3D('ign_gris')}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${mapaBase3D === 'ign_gris' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Base Gris
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
            <span className="flex items-center gap-1"><Car className="w-3 h-3 text-emerald-600" /> Tráfico Abierto</span>
            <button
              onClick={() => setMostrarTraficoAbierto(v => !v)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold ${mostrarTraficoAbierto ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              {mostrarTraficoAbierto ? 'Visible' : 'Oculto'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
            <span className="flex items-center gap-1"><Sun className="w-3 h-3 text-amber-500" /> Sol & Niebla</span>
            <button
              onClick={() => setIluminacionSolar(v => !v)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold ${iluminacionSolar ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              {iluminacionSolar ? 'Activado' : 'Desactivado'}
            </button>
          </div>

          <div className="pt-1 border-t border-slate-100">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cámara de Inspección</span>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => aplicarPresetCamara('cenital')}
                className={`py-1 rounded text-[9px] font-semibold text-center ${presetCamara === 'cenital' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Cenital
              </button>
              <button
                onClick={() => aplicarPresetCamara('oblicua')}
                className={`py-1 rounded text-[9px] font-semibold text-center ${presetCamara === 'oblicua' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Oblicua
              </button>
              <button
                onClick={() => aplicarPresetCamara('peatonal')}
                className={`py-1 rounded text-[9px] font-semibold text-center ${presetCamara === 'peatonal' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Peatonal
              </button>
            </div>
          </div>
        </div>
          </>
        )}

        {status === 'loading' && <p className="mt-1.5 text-[10px] font-medium text-cyan-700">Sincronizando teselas georreferenciadas…</p>}
        {status === 'error' && <p className="mt-1.5 text-[10px] font-medium text-rose-700">{errorMessage}</p>}
      </div>}

      {/* Lista interactiva de los 4 edificios de la 1.ª Oleada */}
      {!analytics4D && !buildingTwinOpen && <div className="absolute left-4 bottom-6 z-10 max-w-xs rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-pink-700">
          <Building2 className="h-3.5 w-3.5" />
          <span>Edificios monitorizados</span>
        </div>
        <div className="mt-2 space-y-1">
          <button
            onClick={() => void openBuildingTwin()}
            disabled={status !== 'ready'}
            className="mb-2 w-full rounded-lg border border-violet-200 bg-gradient-to-r from-violet-50 to-cyan-50 p-2.5 text-left transition hover:border-violet-400 hover:shadow-md disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[11px] font-extrabold text-violet-800">
                <Box className="h-4 w-4" /> Villa Málaga · Gemelo 3D
              </span>
              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">Abrir</span>
            </span>
            <span className="mt-1 block text-[9px] leading-relaxed text-slate-600">Fachada fotogramétrica real · GLB optimizado para web</span>
          </button>
          {EDIFICIOS_OLEADA_1.map((edificio) => (
            <button
              key={edificio.id}
              onClick={() => onSelectEdificio?.(edificio)}
              className="w-full flex items-center justify-between rounded-lg p-1.5 text-left text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span className="truncate pr-2">{edificio.nombre}</span>
              <span className="shrink-0 rounded bg-pink-100 px-1.5 py-0.2 text-[9px] font-bold text-pink-700">
                Ficha
              </span>
            </button>
          ))}
        </div>
      </div>}

      {/* Leyenda operativa */}
      {!buildingTwinOpen && <div className="absolute bottom-6 right-5 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 text-[11px] text-slate-600 shadow-xl backdrop-blur">
        <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <Layers className="h-3.5 w-3.5 text-cyan-600" />
          <span>{analytics4D ? 'Consumo eléctrico 4D' : 'Leyenda Nivel 3'}</span>
        </div>
        {analytics4D ? (
          <>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-green-600" />Muy bajo</div>
            <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-lime-500" />Bajo</div>
            <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-yellow-400" />Medio</div>
            <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-orange-500" />Alto</div>
            <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-red-600" />Muy alto</div>
          </>
        ) : kpiMapa ? (
          <>
            <div className="text-[10px] font-bold text-slate-500">{KPI_MAPA_CONFIG[kpiMapa].label}</div>
            {clasesLeyenda(kpiMapa).map(c => (
              <div key={c.desde} className="mt-1 flex items-center gap-2">
                <span className="h-3 w-4 rounded-sm border" style={{ background: c.color, borderColor: oscurecer(c.color, 0.75) }} />
                <span className="font-mono text-[10px]">{textoClase(kpiMapa, c)}</span>
              </div>
            ))}
            <div className="mt-1 max-w-[190px] text-[9px] italic text-slate-500">Kriging ordinario sobre sensores simulados y estaciones virtuales sintéticas</div>
          </>
        ) : modo3D === 'lidar' ? (
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-slate-400" />LiDAR PNOA 2024 RGBI</div>
        ) : (
          <>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#af8c82]" />Color mediano de fachada</div>
            <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-stone-400" />Neutro sin color de fachada</div>
            <div className="mt-1 text-[9px] text-slate-500">Altura estimada según plantas de Catastro</div>
          </>
        )}
        {!analytics4D && <>
          <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-cyan-400" />Aforo</div>
          <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-purple-500" />Ruido</div>
          <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-orange-500" />Temperatura</div>
          <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" />Calidad del aire</div>
          <div className="mt-1 text-[9px] italic text-slate-500">Sensores y valores simulados</div>
        </>}
        {(() => {
          const flujo = simulacionVisual ? leyendaFlujoSimulacion(simulacionVisual.escenarioId, simulacionVisual.intensidad) : null;
          return flujo && (
            <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[10px] font-semibold" style={{ color: flujo.color }}>
              <span className="h-1 w-4 border-b-[3px] border-dashed" style={{ borderColor: flujo.color }} />
              {flujo.etiqueta}
            </div>
          );
        })()}
        {leyendaFlujosModelo(simulacionVisual?.flujos ?? []).map(item => (
          <div key={item.etiqueta} className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[10px] font-semibold" style={{ color: item.color }}>
            <span className="h-1 w-4 border-b-[3px] border-dashed" style={{ borderColor: item.color }} />
            {item.etiqueta}
          </div>
        ))}
        <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2 text-[9px] text-slate-500">
          <MapPin className="h-3 w-3" />
          <span>{analytics4D ? 'Indicador sintético por edificio y hora' : 'Fichas con permisos UAS STS-01 y QA'}</span>
        </div>
      </div>}

      {buildingTwinOpen && (
        <>
          <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-r from-slate-950/35 via-transparent to-slate-950/10" />
          <section className="absolute left-5 top-5 z-30 w-[min(360px,calc(100%-2.5rem))] overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-cyan-700 p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                    <Box className="h-4 w-4" /> Gemelo de edificio
                  </div>
                  <h3 className="mt-1 text-lg font-black">Villa Málaga</h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-indigo-100">Activo demostrador reubicado virtualmente en Málaga.</p>
                </div>
                <button onClick={closeBuildingTwin} aria-label="Cerrar gemelo de edificio" className="rounded-full bg-white/15 p-2 transition hover:bg-white/25">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {buildingTwinStatus === 'loading' && (
                <div className="flex items-center gap-2 rounded-lg bg-cyan-50 p-2 text-[10px] font-bold text-cyan-800">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Descargando el edificio recortado y sus texturas 4K (23,96 MB)…
                </div>
              )}
              {buildingTwinStatus === 'ready' && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-[10px] font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Modelo fotogramétrico completo listo para explorar
                </div>
              )}
              {buildingTwinStatus === 'error' && (
                <div className="rounded-lg bg-rose-50 p-2 text-[10px] font-bold text-rose-800">
                  <div className="flex items-center gap-2"><TriangleAlert className="h-4 w-4" /> No se pudo abrir el modelo.</div>
                  <p className="mt-1 font-normal">{buildingTwinError}</p>
                  <button onClick={() => void openBuildingTwin()} className="mt-2 rounded bg-rose-700 px-2 py-1 text-white">Reintentar</button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2"><strong className="block text-sm text-slate-800">23,96 MB</strong><span className="text-[8px] uppercase text-slate-500">peso web</span></div>
                <div className="rounded-lg bg-slate-50 p-2"><strong className="block text-sm text-slate-800">886 K</strong><span className="text-[8px] uppercase text-slate-500">triángulos</span></div>
                <div className="rounded-lg bg-slate-50 p-2"><strong className="block text-sm text-slate-800">4K</strong><span className="text-[8px] uppercase text-slate-500">texturas</span></div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setBuildingTwinView('front')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-700 hover:border-violet-400 hover:text-violet-700">Fachada</button>
                <button onClick={() => setBuildingTwinView('side')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-700 hover:border-violet-400 hover:text-violet-700">Lateral</button>
                <button onClick={() => setBuildingTwinView('top')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-700 hover:border-violet-400 hover:text-violet-700">Cenital</button>
              </div>

              <div className="flex gap-2 rounded-lg border border-violet-100 bg-violet-50/70 p-2.5 text-[9px] leading-relaxed text-violet-900">
                <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span><strong>Explore el edificio:</strong> arrastre para orbitar, use la rueda para acercar la fachada y Ctrl + arrastre para cambiar el ángulo.</span>
              </div>

              <p className="text-[9px] leading-relaxed text-slate-500">La localización es exclusivamente demostrativa. El modelo acredita que la plataforma puede incorporar gemelos detallados de edificios, fachadas y activos singulares.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
});
Real3DTilesViewer.displayName = 'Real3DTilesViewer';
