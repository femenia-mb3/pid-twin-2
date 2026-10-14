import React, { useEffect, useRef, useState } from 'react';
import { Bot, RefreshCw, Send, User } from 'lucide-react';
import { ContextoIndicadores, answerIndicatorQuestion } from '../services/indicatorQa';

interface IndicatorChatPanelProps {
  context: ContextoIndicadores;
}

interface Mensaje {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
}

const SUGERENCIAS = [
  'Dame un resumen de los indicadores',
  '¿Qué zona está más saturada?',
  '¿Cuántos visitantes hay y cómo cambia respecto a hoy?',
  '¿Cómo están el ruido y las emisiones de CO₂?',
  '¿Hay alertas o sensores en estado crítico?',
  '¿Qué recomiendas hacer?',
];

export const IndicatorChatPanel: React.FC<IndicatorChatPanelProps> = ({ context }) => {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  const enviar = async (texto?: string) => {
    const q = (texto ?? pregunta).trim();
    if (q.length < 2 || cargando) return;
    const historial = mensajes.map(({ role, content }) => ({ role, content }));
    setMensajes(actuales => [...actuales, { role: 'user', content: q }]);
    setPregunta('');
    setCargando(true);

    try {
      const response = await fetch('/api/ai/indicators-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context, history: historial }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { answer: string; sources?: string[]; engine?: string };
      setMensajes(actuales => [...actuales, {
        role: 'assistant',
        content: data.answer,
        meta: `${data.engine === 'LLM' ? 'Modelo de lenguaje' : 'Reglas sobre indicadores'} · ${(data.sources ?? []).join(', ')}`,
      }]);
    } catch {
      // Sin servidor: el mismo motor de reglas responde en el navegador.
      const local = answerIndicatorQuestion(q, context);
      setMensajes(actuales => [...actuales, { role: 'assistant', content: local.answer, meta: `Reglas locales · ${local.sources.join(', ')}` }]);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
          Pregunta por los indicadores de <strong>{context.destino}</strong> en el escenario activo
          «{context.escenario}». Las respuestas usan solo los datos que ves en el panel (sintéticos de demostración).
        </div>

        {mensajes.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS.map(s => (
              <button
                key={s}
                onClick={() => void enviar(s)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-red-300 hover:bg-red-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'assistant' && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"><Bot className="h-4 w-4" /></div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${m.role === 'user' ? 'bg-slate-800 text-white' : 'border border-slate-200 bg-white text-slate-800 shadow-sm'}`}>
              <p className="whitespace-pre-line">{m.content}</p>
              {m.meta && <p className="mt-1.5 text-[10px] text-slate-400">{m.meta}</p>}
            </div>
            {m.role === 'user' && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"><User className="h-4 w-4" /></div>
            )}
          </div>
        ))}

        {cargando && (
          <div className="flex items-center gap-2 text-xs text-slate-500"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Consultando indicadores…</div>
        )}
        <div ref={finRef} />
      </div>

      <form
        onSubmit={e => { e.preventDefault(); void enviar(); }}
        className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/80 p-4"
      >
        <input
          value={pregunta}
          onChange={e => setPregunta(e.target.value)}
          maxLength={500}
          placeholder="Ej.: ¿Qué zona tiene más ocupación y por qué?"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
        />
        <button
          type="submit"
          disabled={cargando || pregunta.trim().length < 2}
          className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-slate-300"
        >
          <Send className="h-3.5 w-3.5" /> Preguntar
        </button>
      </form>
    </div>
  );
};
