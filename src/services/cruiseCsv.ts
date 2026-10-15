// Importación de cruceros desde CSV para el Escenario 1 (presión por llegada de cruceros).
// Columnas: nombre;pasajeros;fecha;hora_llegada;hora_salida;porcentaje_desembarco
export interface BuqueCsv {
  nombre: string;
  pasajeros: number;
  /** Fecha ISO (YYYY-MM-DD). */
  fecha: string;
  horaLlegada: number;
  horaSalida: number;
  /** Porcentaje de pasajeros que desembarca (20-100). */
  porcentajeDesembarco: number;
}

export interface ResultadoCsvCruceros {
  buques: BuqueCsv[];
  avisos: string[];
}

export const PORCENTAJE_DESEMBARCO_DEFECTO = 78;

// Perfil de pasajeros en tierra según las horas transcurridas desde el atraque.
const PERFIL_DESEMBARCO = [0.3, 0.7, 1, 0.9, 0.7, 0.5, 0.35, 0.2];

export const PLANTILLA_CRUCEROS_CSV = [
  'nombre;pasajeros;fecha;hora_llegada;hora_salida;porcentaje_desembarco',
  'MSC Musica;3200;2026-10-20;08:00;18:00;78',
  'Costa Smeralda;6600;2026-10-20;09:30;19:00;80',
  'Seabourn Ovation;600;2026-10-20;07:00;16:00;90',
  'Wonder of the Seas;7000;2026-10-22;08:00;20:00;75',
  'Celebrity Silhouette;2800;2026-10-22;10:00;18:00;78',
].join('\r\n') + '\r\n';

export function descargarPlantillaCrucerosCsv(): void {
  // BOM para que Excel interprete correctamente los acentos.
  const blob = new Blob(['﻿' + PLANTILLA_CRUCEROS_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'ejemplo_cruceros.csv';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export function dividirLinea(linea: string, separador: string): string[] {
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

export const normalizar = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const ALIAS_COLUMNAS: Record<string, string[]> = {
  nombre: ['nombre', 'crucero', 'buque', 'barco', 'name', 'ship'],
  pasajeros: ['pasajeros', 'personas', 'capacidad', 'pax', 'passengers'],
  fecha: ['fecha', 'dia', 'date'],
  horaLlegada: ['hora_llegada', 'llegada', 'hora_atraque', 'eta', 'arrival'],
  horaSalida: ['hora_salida', 'salida', 'hora_zarpe', 'etd', 'departure'],
  porcentaje: ['porcentaje_desembarco', 'desembarco', 'distribucion', 'porcentaje', 'pct'],
};

function parseFecha(valor: string): string | null {
  const iso = valor.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const esp = valor.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const [a, m, d] = iso ? [iso[1], iso[2], iso[3]] : esp ? [esp[3], esp[2], esp[1]] : [];
  if (!a) return null;
  const fecha = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d)));
  if (fecha.getUTCMonth() !== Number(m) - 1) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseHora(valor: string): number | null {
  const coincidencia = valor.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?$/);
  if (!coincidencia) return null;
  const hora = Number(coincidencia[1]);
  return hora >= 0 && hora <= 23 ? hora : null;
}

export function parsearCrucerosCsv(texto: string): ResultadoCsvCruceros {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(linea => linea.trim() !== '');
  if (lineas.length < 2) throw new Error('El archivo debe tener una cabecera y al menos un crucero.');
  const separador = [';', ',', '\t'].reduce((mejor, s) => (lineas[0].split(s).length > lineas[0].split(mejor).length ? s : mejor), ';');
  const cabecera = dividirLinea(lineas[0], separador).map(normalizar);
  const indice = (clave: string) => cabecera.findIndex(col => ALIAS_COLUMNAS[clave].includes(col));
  const col = Object.fromEntries(Object.keys(ALIAS_COLUMNAS).map(clave => [clave, indice(clave)])) as Record<string, number>;
  const faltan = ['nombre', 'pasajeros', 'fecha', 'horaLlegada'].filter(clave => col[clave] < 0);
  if (faltan.length) throw new Error(`Faltan columnas obligatorias: ${faltan.map(f => ({ nombre: 'nombre', pasajeros: 'pasajeros', fecha: 'fecha', horaLlegada: 'hora_llegada' } as Record<string, string>)[f]).join(', ')}.`);

  const buques: BuqueCsv[] = [];
  const avisos: string[] = [];
  lineas.slice(1).forEach((linea, i) => {
    const celdas = dividirLinea(linea, separador);
    const n = i + 2;
    const pasajeros = Number(String(celdas[col.pasajeros]).replace(/[.\s]/g, '').replace(',', '.'));
    const fecha = parseFecha(celdas[col.fecha] ?? '');
    const llegada = parseHora(celdas[col.horaLlegada] ?? '');
    if (!celdas[col.nombre] || !Number.isFinite(pasajeros) || pasajeros <= 0 || !fecha || llegada === null) {
      avisos.push(`Línea ${n} ignorada: datos obligatorios no válidos.`);
      return;
    }
    const salidaLeida = col.horaSalida >= 0 ? parseHora(celdas[col.horaSalida] ?? '') : null;
    const horaSalida = salidaLeida !== null && salidaLeida > llegada ? salidaLeida : Math.min(23, llegada + 8);
    const pctLeido = col.porcentaje >= 0 ? Number(String(celdas[col.porcentaje] ?? '').replace('%', '').replace(',', '.')) : NaN;
    buques.push({
      nombre: celdas[col.nombre],
      pasajeros: Math.round(pasajeros),
      fecha,
      horaLlegada: llegada,
      horaSalida,
      porcentajeDesembarco: Number.isFinite(pctLeido) && pctLeido > 0 ? Math.min(100, Math.max(20, pctLeido)) : PORCENTAJE_DESEMBARCO_DEFECTO,
    });
  });
  if (!buques.length) throw new Error(avisos[0] ?? 'No se encontró ningún crucero válido.');
  return { buques, avisos };
}

export interface AgregadoCruceros {
  /** Pasajeros en tierra por hora (0-23). */
  porHora: number[];
  pico: number;
  horaPico: number;
  /** Intensidad normalizada 0-1 por hora. */
  intensidad: number[];
}

export function agregarCruceros(buques: BuqueCsv[]): AgregadoCruceros {
  const porHora = Array.from({ length: 24 }, () => 0);
  for (const buque of buques) {
    for (let h = buque.horaLlegada; h < buque.horaSalida && h < 24; h++) {
      const peso = PERFIL_DESEMBARCO[Math.min(PERFIL_DESEMBARCO.length - 1, h - buque.horaLlegada)];
      porHora[h] += buque.pasajeros * (buque.porcentajeDesembarco / 100) * peso;
    }
  }
  const pico = Math.max(...porHora);
  const horaPico = pico > 0 ? porHora.indexOf(pico) : 10;
  return { porHora, pico, horaPico, intensidad: porHora.map(valor => (pico > 0 ? Math.max(0.04, valor / pico) : 0)) };
}
