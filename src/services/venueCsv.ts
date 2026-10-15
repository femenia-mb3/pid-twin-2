// Importación de recintos desde CSV para el Escenario 2 (evento cultural / Noche en Blanco).
// Columnas: nombre;capacidad;latitud;longitud;hora_apertura;hora_cierre
import { dividirLinea, normalizar } from './cruiseCsv';

export interface RecintoCsv {
  nombre: string;
  capacidad: number;
  lat: number;
  lon: number;
  /** Horas 0-23; null si el archivo no las indica. */
  horaApertura: number | null;
  horaCierre: number | null;
}

export interface ResultadoCsvRecintos {
  recintos: RecintoCsv[];
  avisos: string[];
}

export interface ResumenRecintos {
  numeroRecintos: number;
  capacidadTotal: number;
  capacidadMedia: number;
  horaInicio: number | null;
  horaFin: number | null;
}

export const PLANTILLA_RECINTOS_CSV = [
  'nombre;capacidad;latitud;longitud;hora_apertura;hora_cierre',
  'Museo Picasso Málaga;1200;36.7216;-4.4183;19:00;01:00',
  'Catedral de Málaga;1500;36.7210;-4.4192;20:00;00:00',
  'Alcazaba;2500;36.7211;-4.4153;19:00;02:00',
  'Teatro Cervantes;1000;36.7226;-4.4259;20:00;01:00',
  'Centre Pompidou Málaga;1800;36.7189;-4.4170;19:00;02:00',
].join('\r\n') + '\r\n';

export function descargarPlantillaRecintosCsv(): void {
  // BOM para que Excel interprete correctamente los acentos.
  const blob = new Blob(['﻿' + PLANTILLA_RECINTOS_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'ejemplo_recintos.csv';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

const ALIAS_COLUMNAS: Record<string, string[]> = {
  nombre: ['nombre', 'recinto', 'name', 'venue', 'lugar'],
  capacidad: ['capacidad', 'aforo', 'personas', 'capacity'],
  lat: ['latitud', 'lat', 'latitude'],
  lon: ['longitud', 'lon', 'lng', 'long', 'longitude'],
  coordenadas: ['coordenadas', 'ubicacion', 'coords', 'location'],
  apertura: ['hora_apertura', 'apertura', 'inicio', 'hora_inicio', 'start'],
  cierre: ['hora_cierre', 'cierre', 'fin', 'hora_fin', 'end'],
};

const numero = (valor: string | undefined) => Number(String(valor ?? '').replace(/\s/g, '').replace(',', '.'));

function parseHora(valor: string | undefined): number | null {
  const m = (valor ?? '').match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?$/);
  if (!m) return null;
  const hora = Number(m[1]);
  return hora >= 0 && hora <= 23 ? hora : null;
}

export function parsearRecintosCsv(texto: string): ResultadoCsvRecintos {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(linea => linea.trim() !== '');
  if (lineas.length < 2) throw new Error('El archivo debe tener una cabecera y al menos un recinto.');
  const separador = [';', ',', '\t'].reduce((mejor, s) => (lineas[0].split(s).length > lineas[0].split(mejor).length ? s : mejor), ';');
  const cabecera = dividirLinea(lineas[0], separador).map(normalizar);
  const col = Object.fromEntries(Object.entries(ALIAS_COLUMNAS).map(([clave, alias]) => [clave, cabecera.findIndex(c => alias.includes(c))])) as Record<string, number>;
  const faltan: string[] = [];
  if (col.nombre < 0) faltan.push('nombre');
  if (col.capacidad < 0) faltan.push('capacidad');
  if (col.coordenadas < 0 && (col.lat < 0 || col.lon < 0)) faltan.push('latitud, longitud');
  if (faltan.length) throw new Error(`Faltan columnas obligatorias: ${faltan.join(', ')}.`);

  const recintos: RecintoCsv[] = [];
  const avisos: string[] = [];
  lineas.slice(1).forEach((linea, i) => {
    const celdas = dividirLinea(linea, separador);
    const capacidad = numero(celdas[col.capacidad]);
    let lat = col.lat >= 0 ? numero(celdas[col.lat]) : NaN;
    let lon = col.lon >= 0 ? numero(celdas[col.lon]) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const partes = (celdas[col.coordenadas] ?? '').match(/-?\d+(?:[.,]\d+)?/g);
      if (partes && partes.length >= 2) { lat = numero(partes[0]); lon = numero(partes[1]); }
    }
    if (!celdas[col.nombre] || !Number.isFinite(capacidad) || capacidad <= 0 || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      avisos.push(`Línea ${i + 2} ignorada: nombre, capacidad o coordenadas no válidos.`);
      return;
    }
    recintos.push({
      nombre: celdas[col.nombre],
      capacidad: Math.round(capacidad),
      lat,
      lon,
      horaApertura: col.apertura >= 0 ? parseHora(celdas[col.apertura]) : null,
      horaCierre: col.cierre >= 0 ? parseHora(celdas[col.cierre]) : null,
    });
  });
  if (!recintos.length) throw new Error(avisos[0] ?? 'No se encontró ningún recinto válido.');
  return { recintos, avisos };
}

export function resumirRecintos(recintos: RecintoCsv[]): ResumenRecintos {
  const capacidadTotal = recintos.reduce((total, r) => total + r.capacidad, 0);
  // Ventana del evento: primera apertura y último cierre (el cierre se lleva al día siguiente si es menor que la apertura).
  const aperturas = recintos.map(r => r.horaApertura).filter((h): h is number => h !== null);
  const cierres = recintos.filter(r => r.horaApertura !== null && r.horaCierre !== null)
    .map(r => (r.horaCierre! <= r.horaApertura! ? r.horaCierre! + 24 : r.horaCierre!));
  return {
    numeroRecintos: recintos.length,
    capacidadTotal,
    capacidadMedia: Math.round(capacidadTotal / recintos.length),
    horaInicio: aperturas.length ? Math.min(...aperturas) : null,
    horaFin: cierres.length ? Math.max(...cierres) % 24 : null,
  };
}
