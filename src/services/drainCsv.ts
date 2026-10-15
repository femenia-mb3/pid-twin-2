// Importación de imbornales desde CSV para el Escenario 3 (episodio meteorológico).
// Columnas: modelo;capacidad_ls;latitud;longitud;calle;numero;unidades
export interface ImbornalCsv {
  modelo: string;
  /** Caudal de evacuación de un imbornal (L/s). */
  capacidadLs: number;
  lat: number;
  lon: number;
  calle: string;
  numero: string;
  unidades: number;
  /** capacidadLs x unidades. */
  totalLs: number;
}

export interface ResultadoCsvImbornales {
  imbornales: ImbornalCsv[];
  avisos: string[];
}

export interface ResumenImbornales {
  numeroImbornales: number;
  sumaLs: number;
  caudalMedioLs: number;
}

export const PLANTILLA_IMBORNALES_CSV = [
  'modelo;capacidad_ls;latitud;longitud;calle;numero;unidades',
  'Imbornal sifónico 40x20;18;36.7213;-4.4214;Calle Larios;5;1',
  'Imbornal sifónico 40x20;18;36.7208;-4.4226;Calle Larios;22;1',
  'Rejilla continua 100;35;36.7196;-4.4150;Paseo del Parque;;2',
  'Imbornal buzón 60x30;24;36.7179;-4.4167;Alameda Principal;14;1',
  'Rejilla continua 100;35;36.7165;-4.4189;Calle Marqués de Larios;1;1',
].join('\r\n') + '\r\n';

export function descargarPlantillaImbornalesCsv(): void {
  // BOM para que Excel interprete correctamente los acentos.
  const blob = new Blob(['﻿' + PLANTILLA_IMBORNALES_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'ejemplo_imbornales.csv';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function dividirLinea(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++; } else entreComillas = !entreComillas;
    } else if (c === separador && !entreComillas) {
      campos.push(actual.trim());
      actual = '';
    } else actual += c;
  }
  campos.push(actual.trim());
  return campos;
}

const normalizar = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const ALIAS_COLUMNAS: Record<string, string[]> = {
  modelo: ['modelo', 'tipo', 'model', 'imbornal'],
  capacidad: ['capacidad_ls', 'capacidad', 'caudal_ls', 'caudal', 'l_s', 'capacity'],
  lat: ['latitud', 'lat', 'latitude'],
  lon: ['longitud', 'lon', 'lng', 'long', 'longitude'],
  coordenadas: ['coordenadas', 'ubicacion', 'coords', 'location'],
  calle: ['calle', 'via', 'direccion', 'street'],
  numero: ['numero', 'num', 'portal', 'number'],
  unidades: ['unidades', 'cantidad', 'num_imbornales', 'units', 'count'],
};

const numero = (valor: string | undefined) => Number(String(valor ?? '').replace(/\s/g, '').replace(',', '.'));

export function parsearImbornalesCsv(texto: string): ResultadoCsvImbornales {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(linea => linea.trim() !== '');
  if (lineas.length < 2) throw new Error('El archivo debe tener una cabecera y al menos un imbornal.');
  const separador = [';', ',', '\t'].reduce((mejor, s) => (lineas[0].split(s).length > lineas[0].split(mejor).length ? s : mejor), ';');
  const cabecera = dividirLinea(lineas[0], separador).map(normalizar);
  const col = Object.fromEntries(Object.entries(ALIAS_COLUMNAS).map(([clave, alias]) => [clave, cabecera.findIndex(c => alias.includes(c))])) as Record<string, number>;
  const faltan: string[] = [];
  if (col.capacidad < 0) faltan.push('capacidad_ls');
  if (col.coordenadas < 0 && (col.lat < 0 || col.lon < 0)) faltan.push('latitud, longitud');
  if (faltan.length) throw new Error(`Faltan columnas obligatorias: ${faltan.join(', ')}.`);

  const imbornales: ImbornalCsv[] = [];
  const avisos: string[] = [];
  lineas.slice(1).forEach((linea, i) => {
    const celdas = dividirLinea(linea, separador);
    const n = i + 2;
    const capacidadLs = numero(celdas[col.capacidad]);
    let lat = col.lat >= 0 ? numero(celdas[col.lat]) : NaN;
    let lon = col.lon >= 0 ? numero(celdas[col.lon]) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      // Coordenadas en una sola celda: "36.72 -4.42" o "36.72/-4.42".
      const partes = (celdas[col.coordenadas] ?? '').match(/-?\d+(?:[.,]\d+)?/g);
      if (partes && partes.length >= 2) { lat = numero(partes[0]); lon = numero(partes[1]); }
    }
    if (!Number.isFinite(capacidadLs) || capacidadLs <= 0 || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      avisos.push(`Línea ${n} ignorada: capacidad o coordenadas no válidas.`);
      return;
    }
    const unidadesLeidas = col.unidades >= 0 ? Math.round(numero(celdas[col.unidades])) : 1;
    const unidades = Number.isFinite(unidadesLeidas) && unidadesLeidas > 0 ? unidadesLeidas : 1;
    imbornales.push({
      modelo: (col.modelo >= 0 && celdas[col.modelo]) || 'Sin modelo',
      capacidadLs,
      lat,
      lon,
      calle: (col.calle >= 0 && celdas[col.calle]) || 'Sin calle',
      numero: col.numero >= 0 ? celdas[col.numero] ?? '' : '',
      unidades,
      totalLs: capacidadLs * unidades,
    });
  });
  if (!imbornales.length) throw new Error(avisos[0] ?? 'No se encontró ningún imbornal válido.');
  return { imbornales, avisos };
}

export function resumirImbornales(imbornales: ImbornalCsv[]): ResumenImbornales {
  const numeroImbornales = imbornales.reduce((total, i) => total + i.unidades, 0);
  const sumaLs = imbornales.reduce((total, i) => total + i.totalLs, 0);
  return { numeroImbornales, sumaLs, caudalMedioLs: numeroImbornales > 0 ? sumaLs / numeroImbornales : 0 };
}
