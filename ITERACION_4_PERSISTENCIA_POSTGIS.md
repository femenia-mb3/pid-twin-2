# ITERACIÓN 4: ESCRITOR POSTGIS AUTENTICADO Y PERSISTENCIA TRANSACCIONAL CON RLS

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Versión de Entrega:** 1.4.0-PostGIS-RLS  
**Fecha:** 8 de Octubre de 2026  
**Entorno Validado:** PostgreSQL 16.15 + PostGIS 3.4 (USE_GEOS=1, USE_PROJ=1, USE_STATS=1)

---

## 1. Resumen Ejecutivo

La **Iteración 4** culmina la transición desde un demostrador con estado en memoria hacia un **piloto persistente gobernado con PostGIS real**. Esta fase implementa:

1. **Escritor PostGIS Transaccional (`postgisClient.ts` y `postgisRepository.ts`)**: Capacidad de persistencia de ContextPackages, Escenarios Propios Versionados y Corridas de Simulación (`SimulationRun`) directamente en PostgreSQL 16 con geometrías espaciales indexadas (SP-GiST/GIST).
2. **Seguridad y Aislamiento Multitenant con RLS (`Row Level Security`)**: Políticas forzadas en base de datos (`FORCE ROW LEVEL SECURITY`) que impiden de forma estricta que un destino o tenant acceda, modifique o liste escenarios, paquetes o simulaciones pertenecientes a otro municipio.
3. **Rol de Aplicación No-Superusuario (`gemelotur_app`)**: La aplicación opera bajo un rol con mínimos privilegios, asegurando que las políticas RLS se aplican obligatoriamente en todas las consultas y mutaciones.
4. **Métricas Globales de Salud con `SECURITY DEFINER`**: Endpoint administrativo `/api/persistence/status` y `/api/health` para monitorizar de forma segura el número de entidades y el estado de la base de datos sin comprometer el aislamiento entre destinos.
5. **Compatibilidad Híbrida Automática (Fallback Graceful)**: Si la base de datos PostGIS no estuviese accesible, el motor continúa funcionando transparentemente en modo de memoria (`STANDALONE_MEMORY_DEMO`), garantizando resiliencia operativa.

---

## 2. Arquitectura de Datos y Migraciones SQL Ejecutadas

La persistencia se apoya en la cadena acumulativa de migraciones SQL:

| Migración | Objeto | Función en el Gemelo |
| :--- | :--- | :--- |
| `schema_postgis.sql` | `destinos`, `zonas_destino`, `recursos_turisticos`, `sensores_iot` | Modelo territorial base, aforos, capacidad de carga y geometrías espaciales PostGIS. |
| `002_fase2_datasets_3d.sql` | `dataset_3d`, `edificio_3d` | Catálogo de activos 3D (LiDAR, LOD2 envolventes y fotogrametría). |
| `003_ontologia_multidestino.sql` | `tenants_gemelo`, `destino_perfiles_semanticos` | Perfiles semánticos NGSI-LD, tenants y políticas RLS iniciales. |
| `004_interoperabilidad_modelos.sql` | `modelos_reutilizables`, `modelos_instancias_destino` | Catálogo transversal de plantillas de modelos y adaptadores locales. |
| `005_context_packages.sql` | `context_packages`, `context_package_fuentes`, `context_package_variables`, `context_package_validaciones` | Persistencia inmutable y versionada de paquetes de contexto municipal. |
| `006_editor_escenarios.sql` | `escenarios_definiciones`, `escenarios_versiones`, `escenarios_validaciones` | Ciclo de vida completo de escenarios (Borrador, Validado, Ejecutado, Archivado). |
| `007_simulation_runs.sql` | `simulation_runs`, `simulation_run_layers` | Registro auditable de ejecuciones con desglose BASE / ESCENARIO / DELTA y capas derivadas. |
| `008_health_metrics_security_definer.sql` | `fn_gemelotur_persistence_health()` | Función de diagnóstico global accesible para el rol de aplicación `gemelotur_app`. |

---

## 3. Modelo de Aislamiento y Políticas RLS

Cada interacción con la base de datos fija en la transacción local las variables de contexto:

```sql
SET LOCAL app.tenant_id = 'tenant_ayto_malaga';
SET LOCAL app.destino_id = 'malaga';
```

Las tablas críticas cuentan con políticas `WITH CHECK` y `USING`:

```sql
CREATE POLICY escenarios_definiciones_scope_policy ON escenarios_definiciones
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );
```

### Evidencia de Aislamiento Efectivo
Ejecutando la prueba con el usuario no-superusuario `gemelotur_app`:
* **Bajo contexto `tenant_ayto_malaga`**: Visualiza exactamente sus escenarios y corridas (`count = 1`).
* **Bajo contexto `tenant_ayto_palma`**: Devuelve `0` filas sobre las tablas de Málaga.
* **Sin variables de sesión fijadas**: Devuelve `0` filas (aislamiento estricto por omisión).

---

## 4. Endpoints de Diagnóstico y Salud

### `GET /api/health`
Devuelve el modo operativo del gemelo (`POSTGIS_PERSISTED_PILOT` o `STANDALONE_MEMORY_DEMO`) y el desglose de persistencia:

```json
{
  "status": "ONLINE",
  "mode": "POSTGIS_PERSISTED_PILOT",
  "persistence": {
    "driver": "postgis",
    "connected": true,
    "database": "gemelotur",
    "serverVersion": "16.15",
    "postgisVersion": "3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1",
    "rlsEnabled": true,
    "counts": {
      "destinos": 5,
      "contextPackages": 3,
      "escenarios": 3,
      "simulationRuns": 3,
      "zonas": 10
    }
  },
  "storage": {
    "postgis_configured": true,
    "postgis_host": "127.0.0.1",
    "geoserver_configured": false,
    "geoserver_host": "ready-for-docker-compose"
  }
}
```

### `GET /api/persistence/status`
Permite a herramientas de monitorización, cuadros de mando y administradores verificar la latencia y métricas de la base de datos en tiempo real.

---

## 5. Validación Automatizada

Se entrega el script ejecutable [`scripts/validate_iteration4_postgis.sh`](/home/ubuntu/gemelotur/scripts/validate_iteration4_postgis.sh) que verifica de extremo a extremo:
1. Conectividad y versiones de PostgreSQL 16 y PostGIS 3.4.
2. Estado de `FORCE ROW LEVEL SECURITY`.
3. Importación transaccional de un `ContextPackage` con inserción de geometrías espaciales `ST_MakePolygon` en `zonas_destino`.
4. Creación y versionado de un escenario en `escenarios_definiciones` y `escenarios_versiones`.
5. Ejecución de la simulación con persistencia de `SimulationRun` y sus capas GeoJSON (`simulation_run_layers`).
6. Aislamiento estricto multitenant mediante transacciones SQL con distintos roles y contextos.
