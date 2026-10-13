# Informe Técnico — Iteración 15: Simulación Macroeconómica, Optimización de Flujos y Prueba de Estrés
**Plataforma Inteligente de Destinos (PID / SEGITTUR)**  
**Fecha de Implementación:** 9 de octubre de 2026  
**Entorno:** PostgreSQL 16 + PostGIS 3.4 / Node.js 22 / Express 5 / React 18 + Vite / Tailwind CSS

---

## 1. Resumen Ejecutivo

La **Iteración 15** introduce capacidades analíticas avanzadas y operacionales para el Gemelo Digital Turístico:
1. **Simulación de Impacto Macroeconómico Cuantitativo**: Modelo territorial que desglosa el gasto directo de visitantes, estima el Valor Añadido Bruto (VAB) directo e indirecto/inducido mediante matriz insumo-producto acotada, calcula el retorno fiscal municipal y cuantifica las externalidades socioambientales (limpieza viaria, seguridad extraordinaria, amortización de pavimento y derechos de emisión de carbono ETS).
2. **Motor de Optimización Automática y Desvío Dinámico de Flujos**: Algoritmo de balanceo territorial que detecta zonas en saturación crítica (≥80%) y genera corredores peatonales alternativos hacia áreas receptoras con capacidad ociosa, calculando el alivio proyectado y sometiendo la propuesta a **revisión y firma humana obligatoria**.
3. **Banco de Pruebas de Estrés Multiescala (T+1 h, T+4 h, T+24 h)**: Inyección controlada de shocks de afluencia masiva (+25% a +110%) evaluando la resiliencia de la infraestructura turística, el tiempo hasta la alerta crítica y el riesgo de colapso físico.
4. **Reorganización Ergonómica de la Cabecera**: Agrupación limpia de los más de 12 botones horizontales en menús desplegables categorizados (**Gobernanza & Operación** y **Datos & PID**), manteniendo destacados los accesos a **Copiloto IA** y **Macro & Optimización**.

---

## 2. Arquitectura de Datos y Migración PostGIS 018

Se aplicó la migración `database/migrations/018_macroeconomia_optimizacion_estres.sql` sobre PostgreSQL 16 con políticas de Row Level Security forzadas y aislamiento bicomponente (`tenant_id`, `destino_id`):

| Tabla PostGIS | Propósito | Regla de Seguridad / RLS |
| :--- | :--- | :--- |
| `simulaciones_impacto_macroeconomico` | Balances económicos comparativos `BASE / ESCENARIO / DELTA` | RLS forzada por tenant y destino. Permisos `SELECT, INSERT` al rol no-superusuario `gemelotur_app`. |
| `propuestas_optimizacion_flujos` | Propuestas de desvío de flujos y corredores sugeridos | RLS forzada. Huella criptográfica SHA-256 de las rutas propuestas. |
| `decisiones_optimizacion_flujos` | Registro de firma institucional (Aprobada / Rechazada) | Inmutable (Append-only). Trigger `trg_decisiones_optimizacion_immutable` (`fn_prevent_audit_tampering`) bloquea `UPDATE` y `DELETE`. |
| `pruebas_estres_horizontes` | Registro de resultados de sobrecarga en T+1, T+4 y T+24 | RLS forzada. Trazabilidad de scores de resiliencia y veredictos globales. |

---

## 3. Resultados de la Prueba de Estrés sobre Horizontes Temporales

Se evaluaron tres perfiles de shock territorial sobre el destino piloto **Málaga**:

| Horizonte Temporal | Afluencia Base | Afluencia Stressed (+75%) | Saturación Media | Zonas en Saturación (≥85%) | Score Resiliencia | Tiempo a Alerta Crítica |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **T+1 h (Inmediato)** | 12.500 pax | 18.125 pax (+45%) | 72.5% | 2 zonas | **76 / 100** | 45 minutos |
| **T+4 h (Pico Central)** | 12.500 pax | 21.875 pax (+75%) | 87.5% | 4 zonas | **61 / 100** | 15 minutos |
| **T+24 h (Acumulado)** | 12.500 pax | 20.000 pax (+60%) | 80.0% | 3 zonas | **68 / 100** | 30 minutos |

### Veredicto Global: `VULNERABILIDAD_MODERADA` (Riesgo en Ejes Centrales)
- En **T+4 h**, el pico severo desborda la capacidad física del eje Calle Larios y Plaza de la Constitución, activando la recomendación inmediata de cortes perimetrales temporales y desvío hacia el Muelle Uno y Soho.
- En la prueba extrema de **Colapso / Evento Extraordinario (+110%)**, el sistema emite el veredicto `RIESGO_COLAPSO_INMINENTE`, calculando un sobrecoste de servicios de emergencia de **+35.600 €** en refuerzo de baldeo y seguridad.

---

## 4. Resultados de la Suite Automatizada

La suite `scripts/validate_iteration15_macro_optimization_stress.sh` ejecutó 18 aserciones automatizadas:
- **TEST 1:** Login institucional con token JWT y resolución de tenant (`tenant_ayto_malaga`) — **PASS**.
- **TEST 2:** Simulación macroeconómica (+25% afluencia) con cálculo de VAB, retorno fiscal y externalidades — **PASS**.
- **TEST 3:** Generación de propuesta de optimización de flujos con estado inicial `PENDIENTE_FIRMA` y rutas sugeridas — **PASS**.
- **TEST 4:** Firma y aprobación formal del operador institucional con justificación técnica (`APROBADA_OPERADOR`) — **PASS**.
- **TEST 5:** Prueba de estrés en horizontes T+1, T+4 y T+24 con perfiles de resiliencia cuantificados — **PASS**.
- **TEST 6:** Prueba de estrés extrema verificando veredicto `RIESGO_COLAPSO_INMINENTE` — **PASS**.
- **TEST 7:** Aislamiento multitenant: operador de Palma intentando ejecutar estrés en Málaga bloqueado con código `403 Forbidden` — **PASS**.
- **TEST 8:** Auditoría inmutable: intento de `UPDATE` directo en base de datos repelido por trigger de seguridad — **PASS**.

**Balance:** 18 casos aprobados, 0 fallos.
