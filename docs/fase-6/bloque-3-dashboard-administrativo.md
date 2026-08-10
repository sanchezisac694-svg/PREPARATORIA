# Fase 6 — Bloque 3: dashboard administrativo

## Objetivo

Convertir `/dashboard` en un panel administrativo útil y claro usando únicamente datos y servicios que ya existen en la solución actual.

## Layout

El dashboard quedó organizado en este orden:

- `PageHeader`
- bloque de bienvenida y contexto de rol
- métricas operativas
- accesos rápidos
- módulos
- sección condicional de atención

No se añadieron gráficas, tablas avanzadas ni rediseños de módulos internos.

## Servicios reales reutilizados

Servicio reutilizado:

- `getFinancialReportsService()`

Método utilizado:

- `getSummary()`

Datos utilizados:

- `grossCharges`
- `netCollections`
- `outstanding`
- `overdue`
- `businessDate`
- `chargeCount`
- `paymentCount`
- `debtorAccountCount`

Motivo:

- exponer un resumen operativo real sin crear queries nuevas ni lógica financiera adicional.

## Métricas

Cuando el actor tiene permiso para leer el resumen financiero, el dashboard muestra:

- Cargos generados
- Cobranza neta
- Saldo pendiente
- Adeudo vencido

Todos los montos usan `Money`.

La fecha de corte usa `DateDisplay`.

Si el resumen no está disponible por error, el dashboard muestra `ErrorState` parcial y conserva visibles las demás secciones.

## Accesos rápidos

El dashboard incluye accesos rápidos conservadores, filtrados por permisos/rol:

- Nuevo cobro
- Ver turno de caja
- Generar cargos
- Revisar adeudos
- Ver convenios
- Consultar reportes

No se muestran acciones inventadas ni rutas inexistentes.

## Módulos

Se muestran tarjetas para:

- Caja
- Finanzas
- Seguridad

Cada tarjeta incluye únicamente enlaces reales ya existentes en la aplicación.

## Permission-aware behavior

El dashboard adapta accesos rápidos y enlaces de módulo mediante permisos y roles ya definidos en `@preparatoria/authz`.

Ejemplos:

- el resumen financiero solo se intenta cargar si existe permiso para `FINANCE_REPORTS_SUMMARY_READ`;
- la recuperación administrativa de MFA solo se muestra a roles permitidos por el flujo actual;
- el backend sigue siendo la autoridad final para autorizar cada ruta.

## Responsive

- mobile: una columna
- tablet: dos columnas
- desktop: hasta cuatro métricas y tres cards por fila según sección

El dashboard usa el ancho administrativo del shell y no vuelve al contenedor estrecho de autenticación.

## Accesibilidad

- jerarquía de encabezados con `h1`, `h2` y `h3`
- links con texto claro
- badges de estado como apoyo visual, no como único indicador
- cards con estructura semántica válida

## Límites del bloque

Este bloque:

- no crea migraciones;
- no modifica RLS;
- no cambia contratos backend;
- no crea lógica financiera nueva;
- no añade charts;
- no añade DataTable;
- no rediseña login o MFA;
- no rediseña páginas financieras internas.
