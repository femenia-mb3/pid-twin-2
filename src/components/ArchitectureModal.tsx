import React, { useState } from 'react';
import { X, Server, Layers, Cpu, Database, CheckCircle2, Copy, Terminal } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'arquitectura' | 'postgis' | 'docker' | 'ogc'>('arquitectura');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dockerComposeCode = `version: '3.8'

# ==============================================================================
# PILOTO PERSISTENTE GEMELO DIGITAL TURÍSTICO (SEGITTUR PID)
# Despliegue listo: PostGIS 16 + GeoServer 2.25 + Aplicación Fullstack (API + Visor)
# ==============================================================================

services:
  # 1. Base de datos espacial PostGIS
  postgis:
    image: postgis/postgis:16-3.4
    container_name: gemelotur_postgis
    environment:
      POSTGRES_DB: gemelotur_db
      POSTGRES_USER: segittur_admin
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-SegitturPassword2026!}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "5432:5432"
    volumes:
      - postgis_data:/var/lib/postgresql/data
      - ./schema_postgis.sql:/docker-entrypoint-initdb.d/01_schema.sql
      - ./seed_data.sql:/docker-entrypoint-initdb.d/02_seed.sql
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U segittur_admin -d gemelotur_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 2. Servidor Geoespacial GeoServer (WMS, WFS, WMTS, OGC API)
  geoserver:
    image: kartoza/geoserver:2.25.0
    container_name: gemelotur_geoserver
    environment:
      GEOSERVER_ADMIN_USER: admin
      GEOSERVER_ADMIN_PASSWORD: \${GEOSERVER_ADMIN_PASSWORD:-geoserver_password}
      INITIAL_MEMORY: 2G
      MAXIMUM_MEMORY: 4G
      STABLE_EXTENSIONS: "vectortiles-plugin,ogcapi-plugin"
    ports:
      - "8080:8080"
    depends_on:
      postgis:
        condition: service_healthy
    volumes:
      - geoserver_data:/opt/geoserver/data_dir
    restart: unless-stopped

  # 3. Aplicación Gemelo Digital Turístico (Backend Express Fullstack + Visor Web)
  gemelotur_app:
    build:
      context: ..
      dockerfile: Dockerfile
    container_name: gemelotur_app
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://segittur_admin:\${POSTGRES_PASSWORD:-SegitturPassword2026!}@postgis:5432/gemelotur_db
      GEOSERVER_URL: http://geoserver:8080/geoserver
    ports:
      - "3000:3000"
    depends_on:
      postgis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgis_data:
    name: gemelotur_postgis_volume
  geoserver_data:
    name: gemelotur_geoserver_volume
`;

  const sqlSchemaCode = `-- Esquema Relacional-Espacial PostGIS para Gemelo Digital Turístico (SEGITTUR)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Destinos Turísticos Inteligentes (DTI)
CREATE TABLE destinos (
    id VARCHAR(64) PRIMARY KEY,
    nombre VARCHAR(128) NOT NULL,
    codigo_ine VARCHAR(10) NOT NULL UNIQUE,
    comunidad_autonoma VARCHAR(64) NOT NULL,
    poblacion_censada INTEGER NOT NULL,
    capacidad_carga_maxima INTEGER NOT NULL,
    descripcion TEXT,
    geometria_centro GEOMETRY(Point, 4326) NOT NULL,
    limites_administrativos GEOMETRY(MultiPolygon, 4326),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Zonas de Carga y Polígonos de Destino
CREATE TABLE zonas_destino (
    id VARCHAR(64) PRIMARY KEY,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    nombre VARCHAR(128) NOT NULL,
    capa VARCHAR(32) NOT NULL DEFAULT 'turismo',
    tipo_zona VARCHAR(32) NOT NULL,
    aforo_maximo INTEGER NOT NULL,
    afluencia_actual INTEGER DEFAULT 0,
    geometria_poligono GEOMETRY(Polygon, 4326) NOT NULL,
    fuente_origen VARCHAR(128) NOT NULL,
    tipo_fuente VARCHAR(32) NOT NULL DEFAULT 'pid_turistico',
    calidad_dato VARCHAR(32) NOT NULL DEFAULT 'A_CERTIFICADA',
    trazabilidad_id VARCHAR(64) NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Recursos Turísticos y Equipamientos (POIs)
CREATE TABLE recursos_turisticos (
    id VARCHAR(64) PRIMARY KEY,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    nombre VARCHAR(128) NOT NULL,
    categoria VARCHAR(32) NOT NULL,
    capa VARCHAR(32) NOT NULL DEFAULT 'turismo',
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    aforo_maximo INTEGER NOT NULL,
    visitantes_hora INTEGER DEFAULT 0,
    tiempo_medio_visita_min INTEGER DEFAULT 60,
    precio_medio NUMERIC(6,2) DEFAULT 0.0,
    accesibilidad_pmr BOOLEAN DEFAULT TRUE,
    horario VARCHAR(64),
    fuente_origen VARCHAR(128) NOT NULL,
    trazabilidad_id VARCHAR(64) NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sensores IoT y Telemetría en Tiempo Real
CREATE TABLE sensores_iot (
    id VARCHAR(64) PRIMARY KEY,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    tipo_sensor VARCHAR(32) NOT NULL,
    nombre VARCHAR(128) NOT NULL,
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    valor_actual NUMERIC(10,2) NOT NULL,
    unidad VARCHAR(16) NOT NULL,
    umbral_alerta NUMERIC(10,2) NOT NULL,
    estado VARCHAR(16) DEFAULT 'NORMAL',
    ultima_lectura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fuente_origen VARCHAR(128) NOT NULL,
    trazabilidad_id VARCHAR(64) NOT NULL
);

-- Índices espaciales GiST para alto rendimiento
CREATE INDEX idx_destinos_centro_geo ON destinos USING GIST (geometria_centro);
CREATE INDEX idx_zonas_poligono_geo ON zonas_destino USING GIST (geometria_poligono);
CREATE INDEX idx_recursos_ubicacion_geo ON recursos_turisticos USING GIST (ubicacion);
CREATE INDEX idx_sensores_ubicacion_geo ON sensores_iot USING GIST (ubicacion);
`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-lg bg-red-950/80 text-red-500 border border-red-800">
              <Server className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Arquitectura SEGITTUR & Guía de Transición</h3>
              <p className="text-xs text-slate-400">Diseño del Gemelo Digital PID y paso de Demo Temporal a Piloto Persistente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de navegación */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-2 space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('arquitectura')}
            className={`pb-2.5 px-2 border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'arquitectura'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Capas Arquitectónicas</span>
          </button>
          <button
            onClick={() => setActiveTab('docker')}
            className={`pb-2.5 px-2 border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'docker'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Despliegue Docker (PostGIS + GeoServer)</span>
          </button>
          <button
            onClick={() => setActiveTab('postgis')}
            className={`pb-2.5 px-2 border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'postgis'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Esquema SQL PostGIS</span>
          </button>
          <button
            onClick={() => setActiveTab('ogc')}
            className={`pb-2.5 px-2 border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'ogc'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Integración GIS / ESRI / OGC</span>
          </button>
        </div>

        {/* Contenido según pestaña */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'arquitectura' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Correspondencia directa con la Arquitectura SEGITTUR</span>
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  Este MVP implementa las 7 capas oficiales definidas por SEGITTUR para la Plataforma Inteligente de Destinos (PID):
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-red-400 font-bold block mb-1">1. Fuentes de Datos Multi-Origen</span>
                    <span className="text-slate-400">Datos turísticos PID (recursos, oferta, eventos), territoriales (IGN, Catastro) y tiempo real IoT (sensores, movilidad).</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-red-400 font-bold block mb-1">2. Capa de Integración & Normalización</span>
                    <span className="text-slate-400">Ingestión REST, conectores sectoriales y adaptadores alineados con estándares NGSI-LD y OGC API.</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-red-400 font-bold block mb-1">3. Modelo del Destino (PostGIS Ready)</span>
                    <span className="text-slate-400">Almacenamiento geoespacial relacional con capas temáticas: turismo, movilidad, medio ambiente e infraestructuras.</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-red-400 font-bold block mb-1">4. Motor de Contexto y Simulación</span>
                    <span className="text-slate-400">Capacidad de carga física/psicológica, simulación de escenarios What-If (cruceros, lluvia, eventos) y rutas de desvío.</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-red-400 font-bold block mb-1">5. Servicios Geoespaciales & OGC</span>
                    <span className="text-slate-400">Publicación en GeoJSON, Vector Tiles (MVT) y endpoints preparados para GeoServer WMS/WFS.</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-red-400 font-bold block mb-1">6. Visualización Multinivel</span>
                    <span className="text-slate-400">Nivel 1 operativo en 2D/2.5D; Nivel 2 con extrusión demostrativa; Nivel 3 pendiente de incorporar datos reales 3D Tiles, LiDAR, CityGML o fotogrametría del destino.</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-800/50 p-4 rounded-xl flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-emerald-300">¿Cómo pasar de esta Demo al Piloto Persistente?</h5>
                  <p className="text-slate-300 mt-1">
                    Solo requiere desplegar el archivo <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">docker-compose.yml</code> provisto en un servidor con Ubuntu/Docker. El backend de esta aplicación se conectará automáticamente mediante la variable <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">DATABASE_URL</code> sin tener que modificar una sola línea de código de lógica o interfaz.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'docker' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Archivo listo para producción: <code className="text-cyan-400">database/docker-compose.yml</code></span>
                <button
                  onClick={() => copyToClipboard(dockerComposeCode)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center space-x-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copiado' : 'Copiar archivo'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                {dockerComposeCode}
              </pre>
            </div>
          )}

          {activeTab === 'postgis' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Script DDL espacial: <code className="text-cyan-400">database/schema_postgis.sql</code></span>
                <button
                  onClick={() => copyToClipboard(sqlSchemaCode)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center space-x-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copiado' : 'Copiar SQL'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                {sqlSchemaCode}
              </pre>
            </div>
          )}

          {activeTab === 'ogc' && (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white">Integración con ESRI ArcGIS & Soluciones OGC</h4>
                <p>
                  Conforme a la Capa 7 del diseño de SEGITTUR, los destinos que ya dispongan de infraestructura corporativa de <strong>ESRI ArcGIS Enterprise</strong> o <strong>ArcGIS Online</strong> pueden federar este Gemelo Digital de dos formas directas:
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-300 pl-2">
                  <li><strong>Consumo de Feature Services y Scene Services:</strong> La API REST exporta colecciones GeoJSON y MVT nativamente consumibles desde ArcGIS Pro y Web AppBuilder.</li>
                  <li><strong>Publicación WFS/WMS estándar:</strong> GeoServer expone las capas de afluencia, calor y capacidad de carga con estilos SLD que se añaden a cualquier mapa base corporativo municipal.</li>
                  <li><strong>Cuadros de mando externos (ArcGIS Dashboards / QGIS):</strong> Los resultados del motor de simulación se actualizan periódicamente en las capas OGC para alimentar los visores ya existentes de la Policía Local o Áreas de Turismo.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>SEGITTUR PID • Arquitectura de Gemelo Digital Turístico</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
