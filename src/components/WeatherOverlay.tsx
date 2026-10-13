interface WeatherOverlayProps {
  clima: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
  /** Se omite la lluvia cuando el visor ya pinta la suya (episodio meteorológico en Mapa 2D). */
  omitirLluvia?: boolean;
}

/** Efecto de pantalla del clima activo: lluvia cayendo u ola de calor (viñeta cálida + vaho). */
export default function WeatherOverlay({ clima, omitirLluvia = false }: WeatherOverlayProps) {
  if (clima === 'LLUVIA' && !omitirLluvia) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[6]" aria-hidden>
        <div className="absolute inset-0 bg-slate-700/10" />
        <div className="weather-rain absolute inset-0" />
        <div className="weather-rain weather-rain-far absolute inset-0" />
      </div>
    );
  }
  if (clima === 'CALOR_EXTREMO') {
    return (
      <div className="pointer-events-none absolute inset-0 z-[6]" aria-hidden>
        <div className="weather-heat-tint absolute inset-0" />
        <div className="weather-heat-haze absolute inset-0" />
      </div>
    );
  }
  return null;
}
