import { createHash } from 'node:crypto';
import { Asset3DRecord, SpatialLevel, TerritorialScope } from '../types/advanced3D';

// Entradas de marcador (placeholder) del Catálogo 3D / 4D: un activo por proveedor oficial
// (PNOA, IGN, Catastro, CNIG) y por ámbito territorial (municipio, mancomunidad, provincia y
// comunidad autónoma). Los datos reales se sustituirán al ingerir cada ámbito.

interface AmbitoTerritorial {
  scope: TerritorialScope;
  label: string;
  /** [minLon, minLat, maxLon, maxLat] aproximado, solo orientativo. */
  extent: [number, number, number, number];
}

const AMBITOS_POR_DESTINO: Record<string, AmbitoTerritorial[]> = {
  malaga: [
    { scope: 'MUNICIPIO', label: 'Municipio de Málaga', extent: [-4.55, 36.62, -4.27, 36.80] },
    { scope: 'MANCOMUNIDAD', label: 'Mancomunidad de Municipios de la Costa del Sol Occidental', extent: [-5.25, 36.35, -4.45, 36.70] },
    { scope: 'PROVINCIA', label: 'Provincia de Málaga', extent: [-5.65, 36.35, -3.85, 37.30] },
    { scope: 'COMUNIDAD_AUTONOMA', label: 'Comunidad Autónoma de Andalucía', extent: [-7.55, 35.95, -1.60, 38.75] },
  ],
  palma: [
    { scope: 'MUNICIPIO', label: 'Municipio de Palma', extent: [2.50, 39.50, 2.80, 39.65] },
    { scope: 'MANCOMUNIDAD', label: 'Mancomunitat del Pla de Mallorca', extent: [2.85, 39.50, 3.30, 39.80] },
    { scope: 'PROVINCIA', label: 'Provincia de las Illes Balears', extent: [1.15, 38.60, 4.40, 40.10] },
    { scope: 'COMUNIDAD_AUTONOMA', label: 'Comunidad Autónoma de las Illes Balears', extent: [1.15, 38.60, 4.40, 40.10] },
  ],
};

const AMBITOS_GENERICOS = (nombre: string): AmbitoTerritorial[] => [
  { scope: 'MUNICIPIO', label: `Municipio de ${nombre}`, extent: [-9.5, 35.9, 3.5, 43.9] },
  { scope: 'MANCOMUNIDAD', label: `Mancomunidad de ${nombre}`, extent: [-9.5, 35.9, 3.5, 43.9] },
  { scope: 'PROVINCIA', label: `Provincia de ${nombre}`, extent: [-9.5, 35.9, 3.5, 43.9] },
  { scope: 'COMUNIDAD_AUTONOMA', label: `Comunidad Autónoma de ${nombre}`, extent: [-9.5, 35.9, 3.5, 43.9] },
];

const ESCALA: Record<TerritorialScope, string> = {
  MUNICIPIO: 'municipal',
  MANCOMUNIDAD: 'mancomunada',
  PROVINCIA: 'provincial',
  COMUNIDAD_AUTONOMA: 'autonómica',
};

/** Nivel espacial del catálogo: 1 municipio, 2 mancomunidad, 3 provincia, 4 comunidad autónoma. */
const NIVEL_POR_ÁMBITO: Record<TerritorialScope, SpatialLevel> = { MUNICIPIO: 1, MANCOMUNIDAD: 2, PROVINCIA: 3, COMUNIDAD_AUTONOMA: 4 };

const sha = (texto: string) => createHash('sha256').update(texto).digest('hex');

export function generarActivosTerritorialesPlaceholder(destinationId: string, destinationName: string): Asset3DRecord[] {
  const ambitos = AMBITOS_POR_DESTINO[destinationId] ?? AMBITOS_GENERICOS(destinationName);
  const activos: Asset3DRecord[] = [];

  for (const ambito of ambitos) {
    const slug = ambito.scope.toLowerCase();
    const level = NIVEL_POR_ÁMBITO[ambito.scope];
    const base = { destinationId, scope: ambito.scope, scopeLabel: ambito.label, boundingExtent: ambito.extent, isOfflineFallbackAvailable: false, status: 'PLACEHOLDER_PENDIENTE' as const };
    const entrada = (e: Omit<Asset3DRecord, 'level' | 'destinationId' | 'scope' | 'scopeLabel' | 'boundingExtent' | 'isOfflineFallbackAvailable' | 'status' | 'fingerprintSha256'>): Asset3DRecord =>
      ({ ...base, level, ...e, fingerprintSha256: sha(`placeholder:${e.id}`) });

    activos.push(
      entrada({
        id: `ph-pnoa-ortofoto-${destinationId}-${slug}`,
        name: `Ortofoto PNOA · ${ambito.label}`,
        format: 'OGC_WMS',
        endpointUrl: 'https://www.ign.es/wms-inspire/pnoa-ma',
        layerOrFileIdentifier: 'OI.OrthoimageCoverage',
        crs: 'EPSG:4326',
        publisher: 'Instituto Geográfico Nacional (IGN / CNIG) · PNOA',
        license: 'CC-BY 4.0 IGN-CNIG',
        licenseUrl: 'https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf',
        resolutionOrDensity: '25-50 cm/píxel',
        description: `Entrada de marcador: recorte de ortofotografía aérea PNOA de escala ${ESCALA[ambito.scope]} para ${ambito.label}.`,
      }),
      entrada({
        id: `ph-ign-base-${destinationId}-${slug}`,
        name: `Cartografía base IGN · ${ambito.label}`,
        format: 'TMS',
        endpointUrl: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{y}.jpeg',
        crs: 'EPSG:3857',
        publisher: 'Instituto Geográfico Nacional (IGN) / IDEE',
        license: 'CC-BY 4.0 IGN-CNIG',
        licenseUrl: 'https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf',
        resolutionOrDensity: ambito.scope === 'MUNICIPIO' || ambito.scope === 'MANCOMUNIDAD' ? 'Zoom 0-19' : 'Zoom 0-16',
        description: `Entrada de marcador: mapa base del IGN de escala ${ESCALA[ambito.scope]} para ${ambito.label}.`,
      }),
      entrada({
        id: `ph-catastro-edificios-${destinationId}-${slug}`,
        name: `Catastro INSPIRE Edificaciones · ${ambito.label}`,
        format: 'GEOJSON_INSPIRE',
        endpointUrl: `/data/placeholder/${destinationId}/catastro-${slug}.geojson`,
        crs: 'EPSG:4326',
        publisher: 'Dirección General del Catastro',
        license: 'Reutilización de Información del Sector Público (Ley 37/2007)',
        licenseUrl: 'https://www.catastro.hacienda.gob.es/',
        resolutionOrDensity: 'Huellas BuildingPart con plantas sobre rasante',
        description: `Entrada de marcador: edificaciones INSPIRE del Catastro de escala ${ESCALA[ambito.scope]} para ${ambito.label}; pendiente de descarga y teselado.`,
      }),
      entrada({
        id: `ph-cnig-lidar-${destinationId}-${slug}`,
        name: `CNIG LiDAR / MDT 3D Tiles · ${ambito.label}`,
        format: 'OGC_3D_TILES',
        endpointUrl: `/tilesets/placeholder/${destinationId}-${slug}/tileset.json`,
        crs: 'EPSG:4979',
        publisher: 'Centro Nacional de Información Geográfica (CNIG)',
        license: 'CC-BY 4.0 IGN-CNIG',
        licenseUrl: 'https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf',
        resolutionOrDensity: ambito.scope === 'MUNICIPIO' ? 'LiDAR ≥ 5 puntos/m² · MDT 0,5 m' : 'LiDAR decimado · MDT 5 m',
        description: `Entrada de marcador: nube LiDAR y modelo digital del terreno del CNIG de escala ${ESCALA[ambito.scope]} para ${ambito.label}; pendiente de descarga y teselado 3D Tiles.`,
      }),
    );
  }
  return activos;
}
