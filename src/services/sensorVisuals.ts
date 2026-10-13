import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Camera, Car, CloudRain, CloudSun, Footprints, LucideIcon, Thermometer, Volume2, Wind } from 'lucide-react';
import { SensorIoT } from '../types/ontology';

export type TipoMapaCalor = 'afluencia' | 'ruido' | 'temperatura' | 'calidad_aire';

export const SENSOR_VISUALS: Record<SensorIoT['tipoSensor'], { color: string; label: string }> = {
  CONTEO_PEATONAL: { color: '#06b6d4', label: 'Aforo peatonal' },
  CAMARA_AFORO: { color: '#06b6d4', label: 'Cámara de aforo' },
  RUIDO_DB: { color: '#a855f7', label: 'Ruido' },
  TEMPERATURA_C: { color: '#f97316', label: 'Temperatura' },
  CALIDAD_AIRE_NO2: { color: '#10b981', label: 'Calidad del aire · NO₂' },
  ESTACION_METEO: { color: '#f97316', label: 'Estación meteorológica' },
  PLUVIOMETRO: { color: '#0ea5e9', label: 'Pluviómetro' },
  TRAFICO_VEHICULAR: { color: '#64748b', label: 'Tráfico' },
};

export const SENSOR_ICONS: Record<SensorIoT['tipoSensor'], LucideIcon> = {
  CONTEO_PEATONAL: Footprints,
  CAMARA_AFORO: Camera,
  RUIDO_DB: Volume2,
  TEMPERATURA_C: Thermometer,
  CALIDAD_AIRE_NO2: Wind,
  ESTACION_METEO: CloudSun,
  PLUVIOMETRO: CloudRain,
  TRAFICO_VEHICULAR: Car,
};

// SVG del icono del sensor, para imágenes (Cesium).
export const sensorIconSvg = (tipo: SensorIoT['tipoSensor'], color: string, size: number) =>
  renderToStaticMarkup(createElement(SENSOR_ICONS[tipo], { color, size, strokeWidth: 2.2 }));

// Marcador circular completo (fondo blanco, borde de estado e icono), como data URI.
export const sensorMarkerDataUri = (tipo: SensorIoT['tipoSensor'], color: string, borde: string, size = 32) => {
  const icono = sensorIconSvg(tipo, color, size * 0.55).replace('<svg', `<svg x="${size * 0.225}" y="${size * 0.225}"`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#fff" stroke="${borde}" stroke-width="3"/>${icono}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const HEATMAP_LABELS: Record<TipoMapaCalor, string> = {
  afluencia: 'Afluencia',
  ruido: 'Ruido (dB)',
  temperatura: 'Temperatura (°C)',
  calidad_aire: 'Calidad del aire (NO₂)',
};

export const HEATMAP_GRADIENT_CSS: Record<TipoMapaCalor, string> = {
  afluencia: 'linear-gradient(90deg,#22c55e,#f59e0b,#dc2626)',
  ruido: 'linear-gradient(90deg,#c4b5fd,#8b5cf6,#be123c)',
  temperatura: 'linear-gradient(90deg,#38bdf8,#facc15,#dc2626)',
  calidad_aire: 'linear-gradient(90deg,#22c55e,#a3e635,#f59e0b,#7e22ce)',
};

export const sensorVisual = (sensor: SensorIoT) => SENSOR_VISUALS[sensor.tipoSensor];
