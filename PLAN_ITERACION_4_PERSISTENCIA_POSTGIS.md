# Plan de Implementación — Iteración 4: Persistencia PostGIS Autenticada y Escritor Robusto

## Objetivo de Producto
Cerrar la persistencia real del Gemelo Digital Turístico SEGITTUR mediante un adaptador y escritor PostGIS que:
1. Permita ejecutar en modo híbrido: si PostGIS está disponible y configurado con credenciales (`DATABASE_URL` o `PGHOST`/`PGUSER`...), persiste transaccionalmente con control RLS (`SET LOCAL app.tenant_id` y `SET LOCAL app.destino_id`); si no está configurado, mantiene el fallback transparente en memoria sin romper la demo.
2. Persista íntegramente las tres grandes entidades de las iteraciones 1, 2 y 3:
   - **ContextPackages v1** (tabla `context_packages`, `context_package_validaciones`, `context_package_fuentes`, `context_package_variables`, `destinos`, `destino_perfiles_semanticos`, `zonas_destino`, `recursos_turisticos`, `sensores_iot`).
   - **Escenarios creados por destinos** (tabla `escenarios_definiciones`, `escenarios_validaciones`, `escenarios_versiones`).
   - **SimulationRuns normalizados** (tabla `simulation_runs`, `simulation_run_layers`).
3. Exponga el estado de persistencia real en el endpoint `/api/health` (`persistence: { driver: 'postgres' | 'memory', connected: boolean, rls_enabled: boolean, counts: { ... } }`).
4. Provea un endpoint de diagnóstico y sincronización `/api/persistence/status` y scripts de verificación automatizados.
5. Verifique que todas las consultas y escrituras respeten el aislamiento estricto por `tenant_id` y `destino_id`, validando que no se mezclen datos entre municipios.

## Arquitectura de Componentes
- `src/services/postgisClient.ts`: Pool de conexiones PostgreSQL con soporte de transacciones seguras y setting de variables de sesión RLS (`app.tenant_id`, `app.destino_id`).
- `src/services/postgisRepository.ts`: Métodos tipados para:
  - `saveContextPackage(pkg, report, tenantId, destinoId)`: transacción completa insertando destino, perfil semántico, paquete, validación, fuentes, variables, zonas, recursos y sensores.
  - `loadContextPackage(id, tenantId, destinoId)` y `listContextPackages(tenantId, destinoId)`.
  - `saveScenario(scenario, tenantId, destinoId)` y `loadScenarios(destinationId, tenantId)`.
  - `saveSimulationRun(run, tenantId, destinoId)` y `loadSimulationRuns(destinationId, tenantId)`.
  - `getPersistenceDiagnostics()`.
- Integración en `contextPackageService.ts`, `scenarioStudioService.ts`, `simulationRunService.ts`: delegación al repositorio PostGIS cuando la base de datos está conectada, conservando caché en memoria para alto rendimiento en lecturas.
- `database/seed_data.sql` y migraciones `001` a `007` ya aplicadas y validadas contra PostgreSQL 16 + PostGIS 3.4.
