import { OpenDataCatalogResponse, OpenDataSourceRecord, TrafficFlowSegment } from '../types/openData';

export class OpenDataService {
  private static readonly SOURCES: OpenDataSourceRecord[] = [
    {
      id: 'pnoa_ortoimagen_maxima_actualidad',
      name: 'Ortoimágenes Aéreas PNOA Máxima Actualidad (IGN)',
      category: 'ORTOFOTO',
      serviceType: 'WMS',
      endpointUrl: 'https://www.ign.es/wms-inspire/pnoa-ma',
      wmsLayerName: 'OI.OrthoimageCoverage',
      publisher: 'Instituto Geográfico Nacional (IGN) / CNIG',
      license: 'CC-BY 4.0 scne.es',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      crs: 'EPSG:4326 / EPSG:3857 / EPSG:25830',
      coverage: 'Cobertura Nacional (España)',
      resolutionOrDensity: '25 cm / 50 cm píxel',
      updateFrequency: 'Vuelos anuales y bianuales PNOA',
      openSourceStandard: 'OGC_WMS',
      status: 'ONLINE',
      description: 'Servicio WMS 1.3.0 oficial del Plan Nacional de Ortofotografía Aérea que sirve ortoimágenes de máxima actualidad y ortoimágenes verdaderas urbanas.'
    },
    {
      id: 'ign_base_gris_cartografia',
      name: 'Cartografía Base Gris Oficial (IGN)',
      category: 'ORTOFOTO',
      serviceType: 'TMS',
      endpointUrl: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{y}.jpeg',
      publisher: 'Instituto Geográfico Nacional (IGN)',
      license: 'CC-BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      crs: 'EPSG:3857 (Web Mercator)',
      coverage: 'España peninsular, Baleares y Canarias',
      resolutionOrDensity: 'Niveles z0 a z18',
      updateFrequency: 'Trimestral',
      openSourceStandard: 'OGC_WMTS',
      status: 'ONLINE',
      description: 'Mapa base de alta legibilidad en escala de grises optimizado para visualizaciones temáticas de analítica urbana y gemelo digital.'
    },
    {
      id: 'pnoa_lidar_tercera_cobertura',
      name: 'Nube de Puntos LiDAR 3D PNOA (3D Tiles 1.1)',
      category: 'LIDAR_PUNTOS',
      serviceType: '3D_TILES',
      endpointUrl: '/tilesets/malaga-centro-2024/tileset.json',
      publisher: 'Centro Nacional de Información Geográfica (CNIG)',
      license: 'CC-BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      crs: 'EPSG:4979 (ETRS89 3D)',
      coverage: 'Tesela piloto Málaga Centro-Puerto (373-4065)',
      resolutionOrDensity: '6.20 puntos/m² con color RGBI',
      updateFrequency: 'Trienal PNOA-LiDAR',
      openSourceStandard: 'OGC_3D_TILES',
      status: 'ONLINE',
      description: 'Nube LiDAR clasificada teselada con compresión abierta meshopt para inspección altimétrica y de vegetación urbana.'
    },
    {
      id: 'catastro_inspire_building_parts',
      name: 'Edificación Urbana y Cubiertas (Catastro INSPIRE)',
      category: 'CATASTRO_EDIFICIOS',
      serviceType: 'GEOJSON',
      endpointUrl: '/data/malaga/malaga-urbana-building-parts-lidar-color.geojson',
      publisher: 'Dirección General del Catastro / Ministerio de Hacienda',
      license: 'Reutilización de Información del Sector Público (Ley 37/2007)',
      licenseUrl: 'https://www.catastro.minhap.es/ayuda/lang/castellano/inspire.htm',
      crs: 'EPSG:4326',
      coverage: 'Málaga urbana / Casco Antiguo',
      resolutionOrDensity: '9.192 piezas de edificios con plantas y alturas',
      updateFrequency: 'Actualización continua',
      openSourceStandard: 'INSPIRE',
      status: 'ONLINE',
      description: 'Huellas vectoriales de envolvente edilicia INSPIRE BU combinadas con clasificación de plantas y coloración LiDAR.'
    },
    {
      id: 'trafico_urbano_flujos_abiertos',
      name: 'Red de Aforos y Tráfico Urbano de Acceso a Nodos Turísticos',
      category: 'TRAFICO_MOVILIDAD',
      serviceType: 'GEOJSON',
      endpointUrl: '/api/geo/open-data/traffic',
      publisher: 'Área de Movilidad y Tráfico Municipal / Portal de Datos Abiertos',
      license: 'CC-BY 4.0 Datos Abiertos Municipales',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      crs: 'EPSG:4326',
      coverage: 'Corredores puerto-centro, rondas y accesos principales',
      resolutionOrDensity: 'Aforos cada 15 minutos en tramos principales',
      updateFrequency: 'Tiempo casi real / Simulación calibrada',
      openSourceStandard: 'GEOJSON',
      status: 'ONLINE',
      description: 'Métricas de velocidad media, intensidad de paso de vehículos y niveles de congestión para análisis de movilidad turística.'
    }
  ];

  public static getCatalog(destinationId: string): OpenDataCatalogResponse {
    return {
      type: 'OpenDataCatalog',
      destinationId,
      totalSources: this.SOURCES.length,
      sources: this.SOURCES,
      disclaimer: 'Todos los servicios integrados utilizan protocolos abiertos OGC/INSPIRE y licencias públicas compatibles con la Plataforma Inteligente de Destinos.'
    };
  }

  public static getTrafficSegments(destinationId: string): TrafficFlowSegment[] {
    const timestamp = new Date().toISOString();
    if (destinationId === 'palma') {
      return [
        {
          id: 'traf-palma-01',
          nombreVia: 'Paseo Marítimo (Avenida Gabriel Roca)',
          destinoId: 'palma',
          nivelCongestion: 'DENSO',
          velocidadMediaKmh: 28,
          intensidadVehiculosHora: 1450,
          coordenadas: [
            [39.5645, 2.6320],
            [39.5662, 2.6390],
            [39.5680, 2.6450]
          ],
          fuente: 'Red de Sensores de Tráfico Palma · Datos Abiertos',
          timestamp
        },
        {
          id: 'traf-palma-02',
          nombreVia: 'Avenidas (Avinguda d’Alexandre Rosselló)',
          destinoId: 'palma',
          nivelCongestion: 'MODERADO',
          velocidadMediaKmh: 35,
          intensidadVehiculosHora: 1100,
          coordenadas: [
            [39.5740, 2.6530],
            [39.5720, 2.6545],
            [39.5685, 2.6520]
          ],
          fuente: 'Red de Sensores de Tráfico Palma · Datos Abiertos',
          timestamp
        },
        {
          id: 'traf-palma-03',
          nombreVia: 'Acceso Catedral - Moll Vell',
          destinoId: 'palma',
          nivelCongestion: 'CONGESTIONADO',
          velocidadMediaKmh: 14,
          intensidadVehiculosHora: 980,
          coordenadas: [
            [39.5670, 2.6440],
            [39.5675, 2.6480]
          ],
          fuente: 'Red de Sensores de Tráfico Palma · Datos Abiertos',
          timestamp
        }
      ];
    }

    // Default: Málaga
    return [
      {
        id: 'traf-mlg-01',
        nombreVia: 'Paseo de los Curas / Corredor Puerto-Centro',
        destinoId: 'malaga',
        nivelCongestion: 'DENSO',
        velocidadMediaKmh: 24,
        intensidadVehiculosHora: 1680,
        coordenadas: [
          [36.7175, -4.4120],
          [36.7180, -4.4160],
          [36.7188, -4.4210]
        ],
        fuente: 'Centro de Gestión del Tráfico de Málaga · Datos Abiertos',
        timestamp
      },
      {
        id: 'traf-mlg-02',
        nombreVia: 'Alameda Principal / Calle Larios (Acceso Peatonal)',
        destinoId: 'malaga',
        nivelCongestion: 'MODERADO',
        velocidadMediaKmh: 20,
        intensidadVehiculosHora: 650,
        coordenadas: [
          [36.7188, -4.4210],
          [36.7178, -4.4245],
          [36.7165, -4.4285]
        ],
        fuente: 'Centro de Gestión del Tráfico de Málaga · Datos Abiertos',
        timestamp
      },
      {
        id: 'traf-mlg-03',
        nombreVia: 'Avenida Manuel Agustín Heredia (Soho)',
        destinoId: 'malaga',
        nivelCongestion: 'FLUIDO',
        velocidadMediaKmh: 42,
        intensidadVehiculosHora: 920,
        coordenadas: [
          [36.7150, -4.4220],
          [36.7145, -4.4260],
          [36.7138, -4.4295]
        ],
        fuente: 'Centro de Gestión del Tráfico de Málaga · Datos Abiertos',
        timestamp
      },
      {
        id: 'traf-mlg-04',
        nombreVia: 'Paseo Marítimo Ciudad de Melilla (La Malagueta)',
        destinoId: 'malaga',
        nivelCongestion: 'MODERADO',
        velocidadMediaKmh: 36,
        intensidadVehiculosHora: 840,
        coordenadas: [
          [36.7185, -4.4080],
          [36.7195, -4.4030],
          [36.7205, -4.3980]
        ],
        fuente: 'Centro de Gestión del Tráfico de Málaga · Datos Abiertos',
        timestamp
      }
    ];
  }
}
