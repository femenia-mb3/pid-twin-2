# Gemelotur

Gemelo digital turístico multidestino. Combina un visor 2D/3D (Leaflet, Cesium, Three.js), simulación de escenarios, un asistente de IA y una capa de interoperabilidad con la PID (S2, C4, etc.) y catálogo de modelos reutilizables.

## Stack

- Frontend: React 18, Vite, Tailwind, Leaflet, Cesium, Three.js
- Backend: Express 5 (`server.ts`, ejecutado con `tsx`)
- Datos: PostgreSQL/PostGIS (opcional, ver `database/`)
- Contratos semánticos: `ontology/`, `schemas/`, `context-package/`

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo Vite
npm run lint    # comprobación de tipos
npm run build   # build de producción
```

## Despliegue con Docker

```bash
cp .env.example .env   # ajustar APP_NAME, APP_PORT, API_PORT
docker compose up -d --build
```

Más detalle en [`DESPLIEGUE_DEMO.md`](DESPLIEGUE_DEMO.md).

## Estructura

| Ruta | Contenido |
|------|-----------|
| `src/` | Aplicación React (componentes, motor de simulación, servicios) |
| `server.ts` | API y servidor de la aplicación |
| `database/` | Esquema PostGIS, migraciones y datos semilla |
| `ontology/`, `schemas/`, `context-package/` | Ontologías, JSON Schema y ejemplos de ContextPackage |
| `scripts/` | Procesado LiDAR/3D Tiles y scripts de validación por iteración |

## Documentación

El proyecto se ha desarrollado por iteraciones; cada una tiene su `PLAN_ITERACION_N_*.md`, `ITERACION_N_*.md` e informes de validación en la raíz. Puntos de partida: [`plan.md`](plan.md), [`ONTOLOGIA_Y_MODELO_MULTIDESTINO.md`](ONTOLOGIA_Y_MODELO_MULTIDESTINO.md) y [`TODO.md`](TODO.md).
