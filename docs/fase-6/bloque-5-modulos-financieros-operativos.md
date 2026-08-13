# Fase 6 — Bloque 5: módulos financieros operativos

## Objetivo

Conectar las superficies financieras del Sistema Administrativo con adapters SSR app-side que reutilizan contratos existentes de `packages/supabase`, sin duplicar reglas financieras, sin crear SQL nuevo y sin modificar permisos o migraciones.

## Capa de integración SSR

La arquitectura aplicada en este bloque quedó así:

- Server Page / Server Action
- `apps/sistema-administrativo/lib/*`
- `packages/supabase/src/*`
- RPC / DB existente

La implementación técnica se concentra en:

- `apps/sistema-administrativo/lib/financial-runtime.ts`
- `apps/sistema-administrativo/lib/cash-register.ts`
- `apps/sistema-administrativo/lib/collections.ts`
- `apps/sistema-administrativo/lib/charge-generation.ts`
- `apps/sistema-administrativo/lib/financial-benefits.ts`
- `apps/sistema-administrativo/lib/payment-agreements.ts`

Todos estos adapters:

- son `server-only`;
- reutilizan el contexto autenticado existente;
- crean el cliente SSR con cookies del request;
- traducen errores de dominio a mensajes administrativos;
- no reimplementan cálculos;
- no hacen SQL directo;
- no exponen objetos privilegiados al cliente.

`apps/sistema-administrativo` conserva `@supabase/ssr` como dependencia directa porque
`apps/sistema-administrativo/lib/financial-runtime.ts` crea el cliente SSR app-side
con `createServerClient(...)` y `cookies()` de Next.js para reutilizar la sesión
autenticada del request en los adapters administrativos.

## Contratos reutilizados

| Adapter app-side        | Contrato reutilizado                        | Capacidades visibles                                                                                   |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `cash-register.ts`      | `@preparatoria/supabase/cash-register`      | turno visible, apertura, cobro, movimiento, inicio de cierre, conteo, cierre, aprobación de diferencia |
| `collections.ts`        | `@preparatoria/supabase/collections`        | adeudos, posición de deuda, apertura de caso, seguimiento, compromiso, cierre                          |
| `charge-generation.ts`  | `@preparatoria/supabase/charge-generation`  | vista previa, creación de lote, envío a revisión, aprobación, ejecución                                |
| `financial-benefits.ts` | `@preparatoria/supabase/financial-benefits` | programa de beca, aplicación de beca, descuento autorizado, condonación                                |
| `payment-agreements.ts` | `@preparatoria/supabase/payment-agreements` | creación, evaluación, aprobación, conciliación, cancelación, incumplimiento                            |

## Superficies actualizadas

### Caja

- `/caja`
- `/caja/turno`
- `/caja/cobros/nuevo`
- `/caja/movimientos`
- `/caja/arqueo`
- `/caja/cierre`

Estado: PARCIAL

Notas:

- usa lectura real de sesión activa y reporte de caja;
- el navegador no decide qué cuenta cobrar;
- el cierre y la aprobación siguen segregados.
- durante la validación visual local se observaron errores técnicos en:
  - `/caja/turno`
  - `/caja/cobros/nuevo`
  - `/caja/movimientos`
  - `/caja/arqueo`
  - `/caja/cierre`
- mientras no exista evidencia funcional adicional, estas rutas no deben declararse operativas.

### Cobranza

- `/finanzas/cobranza`
- `/finanzas/cobranza/adeudos`
- `/finanzas/cobranza/nuevo`
- `/finanzas/cobranza/[caseId]`

Estado: PARCIAL

Notas:

- adeudos y resumen usan lectura real del reporte de deuda;
- apertura de caso, seguimiento, compromiso y cierre usan mutaciones reales;
- el detalle completo de caso sigue dependiendo de un DTO de lectura backend.

### Generación de cargos

- `/finanzas/generacion-cargos`
- `/finanzas/generacion-cargos/nuevo`
- `/finanzas/generacion-cargos/[batchId]`

Estado: PARCIAL

Notas:

- la vista previa es el flujo principal;
- creación, revisión, aprobación y ejecución usan acciones reales;
- el detalle completo de lote sigue dependiendo de lectura backend dedicada.
- durante la validación visual local se observó un error técnico en `/finanzas/generacion-cargos`;
- mientras no exista evidencia funcional adicional, esta superficie no debe declararse operativa.

### Becas, descuentos y condonaciones

- `/finanzas/becas`
- `/finanzas/becas/nuevo`
- `/finanzas/becas/[scholarshipId]`
- `/finanzas/descuentos`

Estado: PARCIAL

Notas:

- listados visibles reutilizan el reporte de beneficios;
- altas y aplicaciones usan contratos reales;
- falta DTO completo para detalle de programa/asignación.

### Convenios

- `/finanzas/convenios`
- `/finanzas/convenios/nuevo`
- `/finanzas/convenios/[agreementId]`

Estado: PARCIAL

Notas:

- listado visible reutiliza el reporte de convenios;
- evaluación y mutaciones usan contratos reales;
- falta DTO completo de detalle operativo del convenio.

## Labels y estados centralizados

Se creó `apps/sistema-administrativo/app/_admin/financial-labels.tsx` para evitar `switch(status)` repetidos y mantener copy administrativo consistente.

Ejemplos:

- `PENDING` → `Pendiente`
- `PREVIEWED` → `Vista previa lista`
- `MANUAL_REVIEW_REQUIRED` → `Revisión institucional`
- `PAST_DUE` → `Parcialidades vencidas`
- `SHORTAGE` → `Faltante`

## Componentes compartidos nuevos

Se extendió `packages/ui` con:

- `DataTable`
- `TableHeadSection`
- `TableBodySection`
- `TableRow`
- `TableCell`
- `TableHeadCell`
- `DescriptionList`
- `DescriptionItem`

Uso:

- tablas SSR semánticas;
- wrapper con overflow horizontal;
- detalles administrativos con `dl`, `dt`, `dd`.

## Dependencias backend detectadas

| ID       | Dominio    | Pantalla                                | Capacidad faltante              | Contrato actual                    | Impacto UX | ¿Bloquea V1 visual? | Recomendación                                              |
| -------- | ---------- | --------------------------------------- | ------------------------------- | ---------------------------------- | ---------- | ------------------- | ---------------------------------------------------------- |
| DB-UX-01 | Cobranza   | `/finanzas/cobranza/[caseId]`           | DTO de lectura completa de caso | mutaciones sí, lectura completa no | P2         | No                  | agregar wrapper read-only futuro sobre el detalle del caso |
| DB-UX-02 | Generación | `/finanzas/generacion-cargos/[batchId]` | DTO de detalle de lote          | acciones sí, detalle completo no   | P2         | No                  | agregar lectura dedicada de batch y sus items              |
| DB-UX-03 | Beneficios | `/finanzas/becas/[scholarshipId]`       | DTO de programa/asignación      | aplicación sí, detalle no          | P2         | No                  | agregar lectura institucional de programa y asignación     |
| DB-UX-04 | Convenios  | `/finanzas/convenios/[agreementId]`     | DTO completo de convenio        | evaluación sí, detalle completo no | P2         | No                  | agregar lectura completa de convenio y parcialidades       |

## Validación visual local y estado real auditado

Durante la validación visual local del Bloque 5 se observaron errores técnicos en:

- `/caja/turno`
- `/caja/cobros/nuevo`
- `/caja/movimientos`
- `/caja/arqueo`
- `/caja/cierre`
- `/finanzas/generacion-cargos`
- `/finanzas/reportes`
- `/finanzas/cierres`

Estos hallazgos impiden clasificar esas superficies como operativas hasta contar con evidencia funcional específica.

## Pruebas

Pruebas estructurales y de UI relevantes:

- `apps/sistema-administrativo/tests/smoke.test.mjs`
- `apps/sistema-administrativo/tests/financial-modules.test.mjs`
- `packages/ui/tests/ui.test.mjs`

Cobertura validada:

- adapters `server-only`;
- reuse de contratos públicos;
- ausencia de SQL directo en app;
- copy administrativo en español;
- términos visibles correctos:
  - `Antigüedad del adeudo`
  - `Condonación`
  - `Preview obligatorio`
  - `Parcialidades`

## Restricciones preservadas

Confirmado en esta implementación:

- sin cambios en `supabase/migrations/*`;
- sin cambios en `packages/supabase/src/*`;
- sin cambios en `packages/authz/src/*`;
- sin SQL nuevo;
- sin RPC nuevo;
- sin cambios de reglas financieras;
- sin acceso cliente directo a contratos server-only.

## Riesgos

- varias pantallas siguen operativas parciales por ausencia de DTOs de lectura;
- el uso temporal de UUID administrativos en formularios internos reduce ergonomía;
- el warning NFT/Turbopack previo debe seguir auditándose aparte si reaparece en build.
- reportes y cierres permanecen bloqueados en el estado auditado actual por errores técnicos observados en la validación visual local.

## Clasificación final por pantalla

| Pantalla                   | Clasificación       |
| -------------------------- | ------------------- |
| Caja                       | PARCIAL             |
| Turno                      | PARCIAL             |
| Nuevo cobro                | PARCIAL             |
| Movimientos                | PARCIAL             |
| Arqueo                     | PARCIAL             |
| Cierre                     | PARCIAL             |
| Cobranza                   | PARCIAL             |
| Adeudos                    | PARCIAL             |
| Nuevo caso                 | PARCIAL             |
| Detalle de caso            | DEPENDENCIA BACKEND |
| Generación                 | PARCIAL             |
| Nuevo lote                 | PARCIAL             |
| Detalle de lote            | DEPENDENCIA BACKEND |
| Becas                      | PARCIAL             |
| Nuevo programa             | PARCIAL             |
| Detalle de beca/asignación | DEPENDENCIA BACKEND |
| Descuentos                 | PARCIAL             |
| Convenios                  | PARCIAL             |
| Nuevo convenio             | PARCIAL             |
| Detalle de convenio        | PARCIAL             |
| Reportes                   | BLOQUEADO           |
| Cierres                    | BLOQUEADO           |
