/** Texto y color de la leyenda de las líneas de flujo según el escenario activo (Mapa 2D, Terreno, Mapa 3D y Analítica). */
export interface LeyendaFlujo { color: string; etiqueta: string }

export const leyendaFlujoSimulacion = (escenarioId: string, intensidad: number): LeyendaFlujo | null => {
  if (escenarioId === 'base' || intensidad < 0.04) return null;
  if (escenarioId === 'crucero_masivo') return { color: '#06b6d4', etiqueta: 'Evolución en rutas de cruceristas' };
  if (escenarioId === 'evento_cultural') return { color: '#d946ef', etiqueta: 'Afluencia de la noche en blanco' };
  if (escenarioId === 'episodio_meteo') return { color: '#0ea5e9', etiqueta: 'Afección por lluvias' };
  return null;
};
