import { useEffect, useRef } from 'react';

interface WeatherOverlayProps {
  clima: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
  /** Se omite la lluvia cuando el visor ya pinta la suya (episodio meteorológico en Mapa 2D). */
  omitirLluvia?: boolean;
}

/** Lluvia ligera: pocas gotas finas sobre un lienzo transparente, para que el mapa siga legible. */
function RainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let ancho = 0;
    let alto = 0;
    const ajustar = () => {
      ancho = canvas.clientWidth;
      alto = canvas.clientHeight;
      canvas.width = ancho;
      canvas.height = alto;
    };
    ajustar();
    const observer = new ResizeObserver(ajustar);
    observer.observe(canvas);

    const gotas = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      largo: 10 + Math.random() * 16,
      velocidad: 0.9 + Math.random() * 0.9,
      alfa: 0.18 + Math.random() * 0.22,
    }));

    let frame = 0;
    const pintar = () => {
      ctx.clearRect(0, 0, ancho, alto);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (const g of gotas) {
        const x = g.x * ancho;
        const y = g.y * alto;
        ctx.strokeStyle = `rgba(30, 64, 175, ${g.alfa})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - g.largo * 0.25, y + g.largo);
        ctx.stroke();
        if (!reducido) {
          g.y += (g.velocidad * 14) / Math.max(alto, 1);
          g.x -= (g.velocidad * 3.5) / Math.max(ancho, 1);
          if (g.y > 1 || g.x < 0) {
            g.y = -0.05;
            g.x = Math.random() * 1.1;
          }
        }
      }
      if (!reducido) frame = requestAnimationFrame(pintar);
    };
    pintar();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

/** Efecto de pantalla del clima activo: lluvia cayendo u ola de calor (viñeta cálida + vaho). */
export default function WeatherOverlay({ clima, omitirLluvia = false }: WeatherOverlayProps) {
  if (clima === 'LLUVIA' && !omitirLluvia) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[6]" aria-hidden>
        <RainCanvas />
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
