import React from 'react';
import { Building2, CheckCircle2, Database, Layers3, Map, Mountain, ScanLine, X, Zap } from 'lucide-react';

interface CartographicLevelGuideProps {
  level: 1 | 2 | 3 | 4;
  onClose: () => void;
}

const LEVELS = {
  1: {
    number: '1',
    title: 'Base abierta 2D / 2.5D',
    representation: 'Modelo territorial básico y universal con simulación.',
    purpose: 'Es el punto de entrada para cualquier destino: permite operar el gemelo sin disponer de cartografía 3D propia.',
    content: ['Cartografía base y zonas del destino', 'Recursos turísticos, alojamientos y eventos', 'Movilidad, sensores y afluencia', 'Capacidad de carga y mapas de calor', 'Resultados de simulación por zonas y redistribución'],
    requirements: 'IGN/CNIG, Catastro, OpenStreetMap, datos abiertos municipales y PID; GeoJSON/WKT, PostGIS, GeoServer y Leaflet o MapLibre.',
    status: 'El motor funciona plenamente aquí: festival +30% → saturación prevista → heatmap → redistribución recomendada.',
    icon: Map,
    tone: 'cyan'
  },
  2: {
    number: '2',
    title: 'Edificios extruidos + MDT/MDS + GIS',
    representation: 'Mismo gemelo con mayor comprensión espacial y volumetría urbana ligera.',
    purpose: 'Sirve para analizar flujos, accesos, pendientes y capacidad por calle, plaza o corredor peatonal.',
    content: ['Edificios extruidos con alturas', 'Relieve y modelos MDT/MDS', 'Parcelas, viario, equipamientos y zonas turísticas', 'Capas GIS más detalladas', 'Simulación de flujos sobre el espacio urbano'],
    requirements: 'Huellas de Catastro, alturas disponibles o estimadas, MDT/MDS IGN/CNIG y capas GIS; PostGIS, GeoServer, OGC API, Vector Tiles y CesiumJS o MapLibre 3D.',
    status: 'Ejemplo: cierre de acceso → el motor recalcula flujos → muestra calles y zonas receptoras → presión y capacidad sobre edificios y áreas.',
    icon: Building2,
    tone: 'amber'
  },
  3: {
    number: '3',
    title: '3D Tiles / LiDAR / Fotogrametría',
    representation: 'Mismo gemelo con representación territorial realista y de alta precisión.',
    purpose: 'Se reserva para destinos que ya poseen o deciden producir activos 3D; no es obligatorio para que el gemelo sea funcional.',
    content: ['Ciudad o territorio con geometría realista', 'Fachadas, volúmenes, arbolado y relieve preciso', 'Nubes de puntos, infraestructuras y espacios urbanos', 'Activos turísticos detallados', 'Flujos, presión en accesos y evolución temporal sobre el modelo real'],
    requirements: 'LiDAR/PNOA, vuelo fotogramétrico, mallas municipales, CityGML/CityJSON, BIM o modelos existentes; PDAL/GDAL, 3D Tiles, CesiumJS, PostGIS y almacenamiento S3/Azure Blob.',
    status: 'Ejemplo: llegada de 20.000 visitantes → visualización de flujos sobre el modelo real → presión en accesos y afección a recursos mediante timeline.',
    icon: ScanLine,
    tone: 'fuchsia'
  },
  4: {
    number: '4',
    title: 'Analítica temporal sobre el modelo 3D',
    representation: 'El territorio 3D incorpora el tiempo y representa indicadores variables por edificio.',
    purpose: 'Permite comunicar patrones horarios, comparar escenarios y detectar concentraciones espaciales mediante una experiencia visual de alto impacto.',
    content: ['Edificios catastrales extruidos', 'Indicador horario por edificio', 'Escala cromática de intensidad', 'Reproducción automática de 24 horas', 'Métricas agregadas y edificios con demanda alta'],
    requirements: 'Modelo 3D o edificios extruidos, series temporales reales o sintéticas y reglas de agregación; CesiumJS, PostGIS/TimescaleDB y APIs de indicadores.',
    status: 'Demostración actual: consumo eléctrico horario sintético por edificio con perfiles residenciales, comerciales y hoteleros.',
    icon: Zap,
    tone: 'violet'
  }
} as const;

const toneStyles = {
  cyan: { badge: 'bg-cyan-500', soft: 'border-cyan-100 bg-cyan-50/90', text: 'text-cyan-800', dot: 'bg-cyan-500' },
  amber: { badge: 'bg-amber-500', soft: 'border-amber-100 bg-amber-50/90', text: 'text-amber-800', dot: 'bg-amber-500' },
  fuchsia: { badge: 'bg-fuchsia-600', soft: 'border-fuchsia-100 bg-fuchsia-50/90', text: 'text-fuchsia-800', dot: 'bg-fuchsia-600' },
  violet: { badge: 'bg-violet-600', soft: 'border-violet-100 bg-violet-50/90', text: 'text-violet-800', dot: 'bg-violet-600' }
};

export const CartographicLevelGuide: React.FC<CartographicLevelGuideProps> = ({ level, onClose }) => {
  const config = LEVELS[level];
  const Icon = config.icon;
  const styles = toneStyles[config.tone];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="level-guide-title" onMouseDown={onClose}>
      <aside className={`w-full max-w-xl rounded-2xl border ${styles.soft} p-5 shadow-2xl`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${styles.badge} text-sm font-black text-white`}>{config.number}</span>
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${styles.text}`}>
              <Icon className="h-3.5 w-3.5" />
              Nivel de representación geoespacial {config.number}
            </div>
            <h2 id="level-guide-title" className="mt-0.5 text-lg font-bold text-slate-800">{config.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">{config.representation}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar ficha del nivel" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition-colors hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">{config.purpose}</p>
        <div className="mt-4 border-t border-white/80 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600"><Layers3 className="h-4 w-4" />Qué representa</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {config.content.map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`h-1.5 w-1.5 flex-none rounded-full ${styles.dot}`} />{item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/90 bg-white/80 p-3 text-xs leading-relaxed text-slate-600">
          <span className="font-bold text-slate-700">Qué necesita: </span>{config.requirements}
        </div>
        <div className="mt-3 flex gap-2 rounded-xl border border-white/90 bg-white/80 p-3 text-xs leading-relaxed text-slate-600">
          {level === 1 ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-500" /> : level === 2 ? <Mountain className="mt-0.5 h-4 w-4 flex-none text-amber-500" /> : level === 3 ? <Database className="mt-0.5 h-4 w-4 flex-none text-fuchsia-500" /> : <Zap className="mt-0.5 h-4 w-4 flex-none text-violet-500" />}
          <span>{config.status}</span>
        </div>
        <p className="mt-4 rounded-lg bg-white/65 p-2.5 text-[11px] text-slate-500">No son gemelos independientes: los cuatro niveles consumen el mismo modelo del destino. Los tres primeros cambian la representación espacial y el cuarto incorpora además la dimensión temporal.</p>
      </aside>
    </div>
  );
};
