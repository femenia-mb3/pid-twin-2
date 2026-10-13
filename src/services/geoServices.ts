import { Destino, RecursoTuristico, SensorIoT, ZonaDestino } from '../types/ontology';

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: Array<Record<string, unknown>>;
}

export class GeoServicesCatalog {
  public static getDestinosGeoJSON(destinations: Destino[]): GeoJSONFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: destinations.map(destination => ({
        type: 'Feature',
        id: destination.id,
        geometry: { type: 'Point', coordinates: [destination.centro[1], destination.centro[0]] },
        properties: {
          id: destination.id,
          nombre: destination.nombre,
          codigoIne: destination.codigoIne,
          poblacion: destination.poblacionCensada,
          capacidadCargaTeorica: destination.capacidadCargaMaximaTeorica,
          comunidadAutonoma: destination.comunidadAutonoma,
        },
      })),
    };
  }

  public static getZonasGeoJSON(zonas: ZonaDestino[]): GeoJSONFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: zonas.map(zone => ({
        type: 'Feature',
        id: zone.id,
        geometry: { type: 'Polygon', coordinates: [zone.coordenadasPoligono.map(([lat, lng]) => [lng, lat])] },
        properties: {
          id: zone.id,
          nombre: zone.nombre,
          capa: zone.capa,
          tipoZona: zone.tipoZona,
          aforoMaximo: zone.aforoMaximo,
          afluenciaActual: zone.afluenciaActual,
          capacidadCargaPct: zone.capacidadCargaPct,
          fuente: zone.gobernanza.fuente,
          calidad: zone.gobernanza.calidad,
          trazabilidadId: zone.gobernanza.trazabilidadId,
        },
      })),
    };
  }

  public static getRecursosGeoJSON(recursos: RecursoTuristico[]): GeoJSONFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: recursos.map(resource => ({
        type: 'Feature',
        id: resource.id,
        geometry: { type: 'Point', coordinates: [resource.ubicacion[1], resource.ubicacion[0]] },
        properties: {
          id: resource.id,
          nombre: resource.nombre,
          categoria: resource.categoria,
          capa: resource.capa,
          aforoMaximo: resource.aforoMaximo,
          visitantesHora: resource.visitantesHora,
          precioMedio: resource.precioMedio,
          accesibilidadPmr: resource.accesibilidadPmr,
          horario: resource.horario,
          fuente: resource.gobernanza.fuente,
        },
      })),
    };
  }

  public static getSensoresGeoJSON(sensores: SensorIoT[]): GeoJSONFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: sensores.map(sensor => ({
        type: 'Feature',
        id: sensor.id,
        geometry: { type: 'Point', coordinates: [sensor.ubicacion[1], sensor.ubicacion[0]] },
        properties: {
          id: sensor.id,
          nombre: sensor.nombre,
          tipoSensor: sensor.tipoSensor,
          valorActual: sensor.valorActual,
          unidad: sensor.unidad,
          umbralAlerta: sensor.umbralAlerta,
          estado: sensor.estado,
          ultimaLectura: sensor.ultimaLectura,
          fuente: sensor.gobernanza.fuente,
        },
      })),
    };
  }

  public static getOgcMetadata() {
    return {
      title: 'Plataforma Inteligente de Destinos (PID) - OGC API & GeoServer Endpoint',
      description: 'Catálogo de servicios geoespaciales conforme a OGC API Features y WMS/WFS/WMTS. Las capas requieren el parámetro destino.',
      links: [
        { href: '/api/geo/ogc/collections', rel: 'data', type: 'application/json', title: 'Colecciones de datos espaciales' },
        { href: '/api/geo/capas/zonas?destino={destinationId}', rel: 'item', type: 'application/geo+json', title: 'Polígonos de zonificación turística' },
        { href: '/api/geo/capas/recursos?destino={destinationId}', rel: 'item', type: 'application/geo+json', title: 'Equipamientos y POIs turísticos' },
        { href: '/api/geo/capas/sensores?destino={destinationId}', rel: 'item', type: 'application/geo+json', title: 'Red IoT y afluencia en tiempo real' },
        { href: 'http://localhost:8080/geoserver/wms?service=WMS&request=GetCapabilities', rel: 'service-desc', type: 'application/xml', title: 'Capabilities WMS GeoServer (Piloto)' },
      ],
      collections: [
        { id: 'pid:zonas_capacidad', title: 'Zonas y Capacidad de Carga', crs: ['http://www.opengis.net/def/crs/OGC/1.3/CRS84'] },
        { id: 'pid:recursos_turisticos', title: 'Recursos y POIs de Destino', crs: ['http://www.opengis.net/def/crs/OGC/1.3/CRS84'] },
        { id: 'pid:sensores_iot', title: 'Sensores IoT y Telemetría', crs: ['http://www.opengis.net/def/crs/OGC/1.3/CRS84'] },
      ],
    };
  }
}
