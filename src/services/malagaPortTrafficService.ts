import { TIPOS_CRUCERO, capacidadPorEslora } from '../data/cruiseShipTypes';

export interface BuqueCrucero {
  id: string;
  nombre: string;
  modelo: string;
  capacidad: number;
  estado: 'atracado' | 'en_aproximacion';
  etaMin: number;
}

export interface TraficoPuertoMalaga {
  fuente: 'ais_en_vivo' | 'simulado';
  detalle: string;
  actualizado: string;
  buques: BuqueCrucero[];
}

// Área del puerto de Málaga y su aproximación (lat/lon).
const AREA_PUERTO = [[36.68, -4.46], [36.73, -4.38]];
const MUELLE = { lat: 36.7135, lon: -4.4155 };

let cache: { en: number; datos: TraficoPuertoMalaga } | null = null;

// Calendario simulado y determinista por día, para trabajar sin clave de AIS.
function traficoSimulado(ahora: Date): TraficoPuertoMalaga {
  const dia = Math.floor(ahora.getTime() / 86400000);
  const horaDecimal = ahora.getUTCHours() + ahora.getUTCMinutes() / 60;
  const escalas = 1 + (dia % 3); // 1-3 escalas diarias
  const buques: BuqueCrucero[] = [];
  for (let i = 0; i < escalas; i += 1) {
    const tipo = TIPOS_CRUCERO[(dia + i * 2) % TIPOS_CRUCERO.length];
    const llegada = 7 + i * 1.5; // hora de atraque
    if (horaDecimal >= llegada + 9) continue; // ya zarpó
    const atracado = horaDecimal >= llegada;
    buques.push({
      id: `sim-${dia}-${i}`,
      nombre: tipo.modelo,
      modelo: tipo.modelo,
      capacidad: tipo.capacidad,
      estado: atracado ? 'atracado' : 'en_aproximacion',
      etaMin: atracado ? 0 : Math.round((llegada - horaDecimal) * 60),
    });
  }
  return {
    fuente: 'simulado',
    detalle: 'Calendario sintético de escalas (defina AISSTREAM_API_KEY en el servidor para usar AIS en vivo).',
    actualizado: ahora.toISOString(),
    buques,
  };
}

interface DatosAis { nombre?: string; tipo?: number; eslora?: number; lat?: number; lon?: number; sog?: number }

// Escucha AISStream unos segundos y devuelve los buques de pasaje (tipo 60-69) del puerto.
async function traficoAis(apiKey: string, ventanaMs = 12000): Promise<TraficoPuertoMalaga> {
  const WS = (globalThis as any).WebSocket;
  if (!WS) throw new Error('WebSocket no disponible en este runtime de Node');
  const buques = new Map<string, DatosAis>();
  await new Promise<void>((resolve, reject) => {
    const socket = new WS('wss://stream.aisstream.io/v0/stream');
    const fin = setTimeout(() => { try { socket.close(); } catch { /* ya cerrado */ } resolve(); }, ventanaMs);
    socket.onopen = () => socket.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [AREA_PUERTO],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }));
    socket.onerror = () => { clearTimeout(fin); reject(new Error('Error de conexión con AISStream')); };
    socket.onmessage = (evento: { data: unknown }) => {
      try {
        const msg = JSON.parse(String(evento.data));
        const mmsi = String(msg.MetaData?.MMSI ?? '');
        if (!mmsi) return;
        const actual = buques.get(mmsi) ?? {};
        if (msg.MessageType === 'ShipStaticData') {
          const e = msg.Message.ShipStaticData;
          actual.nombre = String(msg.MetaData?.ShipName ?? e.Name ?? '').trim() || undefined;
          actual.tipo = e.Type;
          actual.eslora = (e.Dimension?.A ?? 0) + (e.Dimension?.B ?? 0);
        } else if (msg.MessageType === 'PositionReport') {
          actual.lat = msg.MetaData.latitude;
          actual.lon = msg.MetaData.longitude;
          actual.sog = msg.Message.PositionReport.Sog;
        }
        buques.set(mmsi, actual);
      } catch { /* mensaje no válido */ }
    };
  });

  const lista: BuqueCrucero[] = [];
  buques.forEach((b, mmsi) => {
    // Pasaje (60-69) con eslora de crucero; sin dato estático todavía se ignora.
    if (!b.tipo || b.tipo < 60 || b.tipo > 69 || (b.eslora ?? 0) < 120) return;
    const km = b.lat !== undefined && b.lon !== undefined
      ? Math.hypot((b.lat - MUELLE.lat) * 111, (b.lon - MUELLE.lon) * 89)
      : 0;
    const atracado = (b.sog ?? 0) < 0.5 && km < 1.5;
    const velocidadKmH = Math.max(2, (b.sog ?? 8) * 1.852);
    lista.push({
      id: mmsi,
      nombre: b.nombre ?? `MMSI ${mmsi}`,
      modelo: b.nombre ?? 'Sin identificar',
      capacidad: capacidadPorEslora(b.eslora ?? 0),
      estado: atracado ? 'atracado' : 'en_aproximacion',
      etaMin: atracado ? 0 : Math.round((km / velocidadKmH) * 60),
    });
  });
  return {
    fuente: 'ais_en_vivo',
    detalle: `AIS en vivo (AISStream), ventana de ${Math.round(ventanaMs / 1000)} s sobre el puerto de Málaga. Capacidad estimada por eslora.`,
    actualizado: new Date().toISOString(),
    buques: lista,
  };
}

export async function obtenerTraficoPuertoMalaga(): Promise<TraficoPuertoMalaga> {
  if (cache && Date.now() - cache.en < 60000) return cache.datos;
  const apiKey = process.env.AISSTREAM_API_KEY;
  let datos: TraficoPuertoMalaga;
  if (apiKey) {
    try {
      datos = await traficoAis(apiKey);
    } catch (error) {
      datos = traficoSimulado(new Date());
      datos.detalle = `AIS no disponible (${error instanceof Error ? error.message : 'error'}); se muestra el calendario sintético.`;
    }
  } else {
    datos = traficoSimulado(new Date());
  }
  cache = { en: Date.now(), datos };
  return datos;
}
