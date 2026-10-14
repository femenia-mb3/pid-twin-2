import { useEffect, useRef } from 'react';

interface WeatherOverlayProps {
  clima: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
  /** Lluvia torrencial del Escenario 3: más gotas, en tres planos de profundidad. 0–1 según la intensidad. */
  lluviaIntensa?: number;
}

interface Gota {
  x: number;
  y: number;
  largo: number;
  velocidad: number;
  alfa: number;
  grosor: number;
}

const crearGotas = (cantidad: number, plano: { largo: [number, number]; velocidad: [number, number]; alfa: [number, number]; grosor: number }): Gota[] =>
  Array.from({ length: cantidad }, () => ({
    x: Math.random(),
    y: Math.random(),
    largo: plano.largo[0] + Math.random() * (plano.largo[1] - plano.largo[0]),
    velocidad: plano.velocidad[0] + Math.random() * (plano.velocidad[1] - plano.velocidad[0]),
    alfa: plano.alfa[0] + Math.random() * (plano.alfa[1] - plano.alfa[0]),
    grosor: plano.grosor,
  }));

/**
 * Lluvia sobre un lienzo transparente. Por defecto es ligera (pocas gotas finas, el mapa sigue legible);
 * con `intensidad` (Escenario 3) hay mucha más densidad, con gotas lejanas, medias y cercanas.
 */
function RainCanvas({ intensidad }: { intensidad?: number }) {
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

    const gotas: Gota[] = intensidad === undefined
      ? crearGotas(90, { largo: [10, 26], velocidad: [0.9, 1.8], alfa: [0.18, 0.4], grosor: 1 })
      : (() => {
          const k = 0.6 + 0.4 * Math.max(0, Math.min(1, intensidad));
          return [
            ...crearGotas(Math.round(480 * k), { largo: [7, 13], velocidad: [0.7, 1.1], alfa: [0.1, 0.2], grosor: 0.8 }),
            ...crearGotas(Math.round(440 * k), { largo: [12, 22], velocidad: [1.1, 1.6], alfa: [0.2, 0.34], grosor: 1 }),
            ...crearGotas(Math.round(260 * k), { largo: [20, 34], velocidad: [1.7, 2.4], alfa: [0.32, 0.5], grosor: 1.4 }),
          ];
        })();
    const viento = intensidad === undefined ? 3.5 : 5;

    let frame = 0;
    const pintar = () => {
      ctx.clearRect(0, 0, ancho, alto);
      ctx.lineCap = 'round';
      for (const g of gotas) {
        const x = g.x * ancho;
        const y = g.y * alto;
        ctx.lineWidth = g.grosor;
        ctx.strokeStyle = `rgba(30, 64, 175, ${g.alfa})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - g.largo * 0.25, y + g.largo);
        ctx.stroke();
        if (!reducido) {
          g.y += (g.velocidad * 14) / Math.max(alto, 1);
          g.x -= (g.velocidad * viento) / Math.max(ancho, 1);
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
  }, [intensidad === undefined ? undefined : Math.round(intensidad * 4)]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

/** Efecto de pantalla del clima activo: lluvia cayendo u ola de calor (viñeta cálida + vaho). */
export default function WeatherOverlay({ clima, lluviaIntensa }: WeatherOverlayProps) {
  if (clima === 'LLUVIA' || lluviaIntensa !== undefined) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[6]" aria-hidden>
        {/* Tinte con estilo en línea: las clases bg-slate-* las pisa el tema claro (.pid-light) con un fondo opaco. */}
        {lluviaIntensa !== undefined && <div className="absolute inset-0" style={{ backgroundColor: 'rgba(51, 65, 85, 0.05)' }} />}
        <RainCanvas intensidad={lluviaIntensa} />
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
