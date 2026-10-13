// Catálogo estructurado de activos 3D, edificios clave y contratos OGC 3D Tiles para la Fase 2

export type TipoActivo3D = 'point_cloud' | 'terrain' | 'buildings_lod2' | 'photogrammetry_mesh';
export type EstadoDataset3D = 'planificado' | 'captura_pendiente' | 'procesamiento' | 'validado_qa' | 'publicado' | 'retirado';
export type TipologiaEdificio3D = 'patrimonio_complejo' | 'equipamiento_cultural' | 'hito_urbano_portuario' | 'edificacion_residencial' | 'infraestructura_transporte';
export type ClasificacionDifusion = 'publica' | 'restringida_seguridad' | 'interna_municipal';

export interface Dataset3DRecord {
  id: string;
  destinoId: string;
  tipo: TipoActivo3D;
  version: string;
  estado: EstadoDataset3D;
  titulo: string;
  descripcion: string;
  crsHorizontal: string;
  datumVertical: string;
  fechaCaptura: string;
  precisionXyM: number;
  precisionZM: number;
  resolucionODensidad: string;
  tilesetUrl: string;
  formatoContenido: string;
  compresion: string;
  tamanoBytes: number;
  licencia: string;
  atribucion: string;
}

export interface Edificio3DRecord {
  id: string;
  destinoId: string;
  dataset3dId: string;
  recursoTuristicoId?: string;
  buildingIdCatastro?: string;
  nombre: string;
  tipologia: TipologiaEdificio3D;
  oleada: number;
  titularOrganismo: string;
  finalidadGemelo: string;
  clasificacionDifusion: ClasificacionDifusion;
  requierePermisoEspecifico: boolean;
  permisoEstado: 'APROBADO' | 'EN_TRAMITACION' | 'NO_REQUERIDO';
  gsdObjetivoCm: number;
  alturaCumbreraM: number;
  superficieM2: number;
  coordenadasCentro: [number, number]; // [lat, lng]
  estadoQa: 'APROBADO_QA' | 'CAPTURADO' | 'ESPECIFICADO';
  notasOperativas: string;
}

export const DATASETS_3D_CATALOG: Dataset3DRecord[] = [
  {
    id: 'ds3d_malaga_lidar_2024',
    destinoId: 'malaga',
    tipo: 'point_cloud',
    version: '2024-H30',
    estado: 'publicado',
    titulo: 'Nube PNOA-LiDAR 2024 Málaga Centro–Puerto',
    descripcion: 'Nube oficial de tercera cobertura nacional (tesela 373-4065 / H30 NPC02) teselada en OGC 3D Tiles 1.1 con 375 archivos GLB jerárquicos.',
    crsHorizontal: 'EPSG:25830 (ETRS89 / UTM zone 30N)',
    datumVertical: 'REDNAP08 / Altura ortométrica oficial IGN',
    fechaCaptura: '2024-05-15',
    precisionXyM: 0.20,
    precisionZM: 0.10,
    resolucionODensidad: '6.20 puntos/m²',
    tilesetUrl: '/tilesets/malaga-centro-2024/tileset.json',
    formatoContenido: 'OGC 3D Tiles 1.1 / GLB',
    compresion: 'meshopt + KHR_mesh_quantization',
    tamanoBytes: 65445332,
    licencia: 'CC-BY 4.0 Instituto Geográfico Nacional',
    atribucion: 'IGN-CNIG PNOA-LiDAR 2024. Plan Nacional de Ortofotografía Aérea.'
  },
  {
    id: 'ds3d_malaga_lod2_2026',
    destinoId: 'malaga',
    tipo: 'buildings_lod2',
    version: '2026-v1-oleada1',
    estado: 'validado_qa',
    titulo: 'Edificios LOD2 Semánticos (Primera Oleada)',
    descripcion: 'Modelos volumétricos precisos de la envolvente edilicia con clasificación semántica de cubierta (RoofSurface), fachadas (WallSurface) y suelo.',
    crsHorizontal: 'EPSG:25830',
    datumVertical: 'REDNAP08 / Ortométrica',
    fechaCaptura: '2026-02-01',
    precisionXyM: 0.05,
    precisionZM: 0.08,
    resolucionODensidad: 'LOD2 CityJSON 2.0 / 3D Tiles',
    tilesetUrl: '/tilesets/malaga-lod2-oleada1/tileset.json',
    formatoContenido: 'OGC 3D Tiles 1.1 / GLB',
    compresion: 'meshopt + KHR_mesh_quantization',
    tamanoBytes: 14200000,
    licencia: 'Uso institucional PID - Ayuntamiento de Málaga',
    atribucion: 'Ayuntamiento de Málaga · Gerencia Municipal de Urbanismo & SEGITTUR PID'
  },
  {
    id: 'ds3d_malaga_photo_2026',
    destinoId: 'malaga',
    tipo: 'photogrammetry_mesh',
    version: '2026-v1-oleada1',
    estado: 'validado_qa',
    titulo: 'Mallas Fotogramétricas Texturizadas 3D (Primera Oleada)',
    descripcion: 'Mallas trianguladas con texturizado fotográfico de alta resolución para los cuatro activos singulares acordados.',
    crsHorizontal: 'EPSG:25830',
    datumVertical: 'REDNAP08 / Ortométrica',
    fechaCaptura: '2026-02-15',
    precisionXyM: 0.02,
    precisionZM: 0.03,
    resolucionODensidad: 'GSD 1.5 cm/píxel',
    tilesetUrl: '/tilesets/malaga-fotogrametria-oleada1/tileset.json',
    formatoContenido: 'OGC 3D Tiles 1.1 / GLB',
    compresion: 'meshopt + KTX2',
    tamanoBytes: 48500000,
    licencia: 'Convenio Patrimonial Junta de Andalucía / Ayuntamiento de Málaga',
    atribucion: 'Consejería de Cultura / Ayto de Málaga / SEGITTUR'
  }
];

export const EDIFICIOS_OLEADA_1: Edificio3DRecord[] = [
  {
    id: 'b3d_catedral_malaga',
    destinoId: 'malaga',
    dataset3dId: 'ds3d_malaga_photo_2026',
    recursoTuristicoId: 'rec_catedral',
    buildingIdCatastro: '29900A00100001',
    nombre: 'Catedral de Málaga',
    tipologia: 'patrimonio_complejo',
    oleada: 1,
    titularOrganismo: 'Diócesis de Málaga / Cabildo Catedralicio',
    finalidadGemelo: 'Análisis de aforos en Plaza del Obispo, accesos turísticos y microclima en entorno de cubiertas.',
    clasificacionDifusion: 'publica',
    requierePermisoEspecifico: true,
    permisoEstado: 'APROBADO',
    gsdObjetivoCm: 1.0,
    alturaCumbreraM: 84.50,
    superficieM2: 4200.0,
    coordenadasCentro: [36.7202, -4.4199],
    estadoQa: 'APROBADO_QA',
    notasOperativas: 'Vuelos de dron bajo escenario STS-01 en coordinación con Cabildo y Policía Local.'
  },
  {
    id: 'b3d_alcazaba_malaga',
    destinoId: 'malaga',
    dataset3dId: 'ds3d_malaga_photo_2026',
    recursoTuristicoId: 'rec_alcazaba',
    buildingIdCatastro: '29900A00100002',
    nombre: 'Alcazaba',
    tipologia: 'patrimonio_complejo',
    oleada: 1,
    titularOrganismo: 'Ayuntamiento de Málaga (Área de Cultura y Patrimonio)',
    finalidadGemelo: 'Simulación de capacidad de carga en accesos peatonales empinados, sombras y gestión de colas de entrada.',
    clasificacionDifusion: 'publica',
    requierePermisoEspecifico: true,
    permisoEstado: 'APROBADO',
    gsdObjetivoCm: 1.5,
    alturaCumbreraM: 45.20,
    superficieM2: 15000.0,
    coordenadasCentro: [36.7214, -4.4158],
    estadoQa: 'APROBADO_QA',
    notasOperativas: 'Modelado conjunto de murallas y topografía con fotogrametría oblicua y escáner láser terrestre.'
  },
  {
    id: 'b3d_museo_picasso',
    destinoId: 'malaga',
    dataset3dId: 'ds3d_malaga_photo_2026',
    recursoTuristicoId: 'rec_picasso',
    buildingIdCatastro: '29900A00100003',
    nombre: 'Museo Picasso Málaga',
    tipologia: 'equipamiento_cultural',
    oleada: 1,
    titularOrganismo: 'Fundación Museo Picasso Málaga / Junta de Andalucía',
    finalidadGemelo: 'Simulación de dispersión de visitantes hacia Calle San Agustín y mitigación de cuellos de botella.',
    clasificacionDifusion: 'publica',
    requierePermisoEspecifico: true,
    permisoEstado: 'APROBADO',
    gsdObjetivoCm: 1.2,
    alturaCumbreraM: 18.30,
    superficieM2: 2800.0,
    coordenadasCentro: [36.7223, -4.4184],
    estadoQa: 'APROBADO_QA',
    notasOperativas: 'Captura de patios interiores y cubiertas tradicionales sin interrumpir visitas públicas.'
  },
  {
    id: 'b3d_centre_pompidou',
    destinoId: 'malaga',
    dataset3dId: 'ds3d_malaga_photo_2026',
    recursoTuristicoId: 'rec_pompidou',
    buildingIdCatastro: '29900A00100004',
    nombre: 'Centre Pompidou Málaga',
    tipologia: 'hito_urbano_portuario',
    oleada: 1,
    titularOrganismo: 'Ayuntamiento de Málaga / Autoridad Portuaria de Málaga',
    finalidadGemelo: 'Conexión de flujos turísticos entre Muelle Uno y el casco histórico, aforos en paseos marítimos.',
    clasificacionDifusion: 'publica',
    requierePermisoEspecifico: true,
    permisoEstado: 'APROBADO',
    gsdObjetivoCm: 1.5,
    alturaCumbreraM: 12.00,
    superficieM2: 6300.0,
    coordenadasCentro: [36.7181, -4.4132],
    estadoQa: 'APROBADO_QA',
    notasOperativas: 'Geometría contemporánea con superficies translúcidas y prisma de vidrio en espacio portuario.'
  }
];
