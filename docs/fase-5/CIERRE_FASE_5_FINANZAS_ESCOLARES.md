# Cierre técnico — Fase 5: Finanzas Escolares

## Control del documento

| Campo | Valor |
| --- | --- |
| Proyecto | Sistema Preparatoria |
| Fase | Fase 5 — Finanzas Escolares |
| Alcance | Cierre técnico documental de la V1 financiera escolar |
| Estado | CERRADA TÉCNICAMENTE CON OBSERVACIONES |
| Fecha de cierre técnico | 2026-08-10 |
| Rama | `codex/fase-5-finanzas-escolares` |
| Commit de último bloque | `da6ac5a` — `feat: implementa reportes financieros y cierre operativo` |
| Número total de migraciones | 29 |
| Resultado global de pruebas | Baseline global verde: format, lint, typecheck, pnpm test, build, pgTAP global y validaciones complementarias en PASS |

## Objetivo de la fase

La Fase 5 construye el dominio financiero escolar V1 del proyecto. Su objetivo es establecer una base monetaria única, auditable y segura para operar cargos, pagos, caja escolar, generación institucional de cargos, adeudos, cobranza administrativa, beneficios financieros, convenios de pago, reportes financieros y cierres operativos sin crear una contabilidad paralela.

## Bloques implementados

| Bloque | Propósito | Componentes principales | Estado | Commit |
| --- | --- | --- | --- | --- |
| Bloque 1 | Base financiera y estado de cuenta | Ledger financiero, cargos, pagos, allocations, ajustes, recibos, lectura propia de alumno y tutor fail-closed | COMPLETO | `a2c987d` |
| Bloque 2 | Caja escolar | Cajas, asignaciones, sesiones, cobros presenciales, movimientos, conteos, conciliaciones y cierre de turno | COMPLETO | `c77d05d` |
| Bloque 3 | Generación institucional de cargos | Reglas, versiones, preview, batches, ejecución, exclusiones, elegibilidad, deduplicación | COMPLETO | `55f5eb8` |
| Bloque 4 | Adeudos y cobranza administrativa | Deuda derivada, aging, casos, acciones, compromisos y cierre administrativo | COMPLETO | `965b90a` |
| Bloque 5 | Becas, descuentos, condonaciones y convenios | Programas de beca, asignaciones individuales, aplicaciones, convenios, parcialidades y reconciliación con pagos reales | COMPLETO | `ba3e13d` |
| Bloque 6 | Reportes financieros y cierre operativo | Resumen, reportes administrativos, exportación CSV y cierres históricos de periodo | COMPLETO | `da6ac5a` |

## Capacidades finales

| Capacidad | Estado | Bloque | Observación |
| --- | --- | --- | --- |
| Conceptos | COMPLETO | 1 | Catálogo financiero base implementado |
| Tarifas | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 1 | Faltan montos productivos definitivos |
| Cuentas financieras | COMPLETO | 1 | Una cuenta por alumno financiero |
| Cargos | COMPLETO | 1, 3 | Manuales y masivos |
| Ajustes | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 1, 5 | Beneficios y reversas vía adjustments |
| Pagos | COMPLETO | 1, 2 | Registro, confirmación, allocation y vínculo con caja |
| Allocations | COMPLETO | 1 | Aplicación monetaria formal al ledger |
| Recibos | COMPLETO | 1 | Recibo interno no fiscal |
| Reversas | COMPLETO | 1, 2, 6 | Historial preservado y estado live actualizado |
| Caja | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 2 | Cancelación y reapertura quedan fuera de V1 operativa |
| Generación masiva | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 3 | Reglas y responsables finales siguen pendientes |
| Deuda | COMPLETO | 4 | Derivada desde ledger |
| Aging | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 4 | Buckets técnicos pendientes de ratificación formal |
| Cobranza | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 4 | Política institucional final pendiente |
| Compromisos | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 4 | No alteran el ledger |
| Becas | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 5 | Reglas institucionales por cerrar |
| Descuentos | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 5 | Políticas finales pendientes |
| Condonaciones | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 5 | Operan vía adjustments |
| Convenios | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 5 | No crean ingreso por sí mismos |
| Reportes | COMPLETO | 6 | Reportes server-side sobre fuente única |
| CSV | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 6 | Formatos oficiales y retención pendientes |
| Cierre operativo | COMPLETO CON VALIDACIÓN INSTITUCIONAL | 6 | Responsables y periodos cerrables pendientes |

## Source of truth

La fuente monetaria única del dominio financiero queda formalmente establecida en:

- `finance.student_charges`
- `finance.charge_adjustments`
- `finance.payments`
- `finance.payment_allocations`

Los siguientes componentes no actúan como segundo ledger:

- `collection cases`
- `commitments`
- `scholarships`
- `agreements`
- `financial_period_closures`
- `reports`

## Principios financieros

- `original_amount` no se reescribe por pagos, beneficios, convenios ni cierres.
- Los beneficios financieros se materializan exclusivamente vía `charge_adjustments`.
- El saldo es derivado, no editable.
- Los convenios no crean ingreso.
- Los compromisos de pago no crean ingreso.
- El cierre operativo no bloquea el ledger productivo.
- Las reversas preservan historial y ajustan el estado live.
- El cierre histórico no cambia tras pagos, reversas o ajustes posteriores.

## Seguridad

- RBAC con permisos `finance.*` específicos y cerrados.
- RLS habilitada en tablas financieras sensibles.
- Sin grants directos a `PUBLIC`, `anon` ni `authenticated` sobre tablas operativas.
- `finance` permanece fuera de Data API.
- Operaciones sensibles protegidas con AAL2 y MFA cuando corresponde.
- `session_version` vigente como requisito transversal en mutaciones críticas.
- Idempotencia con `finance.financial_commands` y fingerprint.
- Auditoría append-only mediante `finance.financial_events`.
- Segregación `creator != approver` en operaciones sensibles donde corresponde.

## Calidad y pruebas

| Validación | Resultado |
| --- | --- |
| format | PASS |
| lint | PASS |
| typecheck | PASS |
| pnpm test | PASS |
| build | PASS |
| Migraciones | 29 |
| pgTAP global | `Files=25`, `Tests=1242`, `PASS` |
| db lint core | PASS |
| db lint academic | PASS |
| db lint finance | PASS |
| Regresiones Bloques 1–6 | PASS |
| Portales | PASS |
| boundaries | PASS |
| security | PASS |

## P0 / P1 / P2

### P0

0

### P1

0

### P2

| ID | Descripción |
| --- | --- |
| DT-01 | warning NFT/Turbopack preexistente |
| DT-02 | mojibake cosmético en algunos outputs |
| DT-03 | revisar granularidad futura de `finance.payments.reverse` |
| DT-04 | `CANCELLED` en caja sin flujo V1 completo |
| DT-05 | varias superficies administrativas aún son UI mínima o shell |

## PENDING_INSTITUTIONAL_VALIDATION

### A. Cobros

PENDING_INSTITUTIONAL_VALIDATION

- montos reales;
- periodicidad;
- cuotas;
- fechas límite;
- estados cobrables;
- recargos.

### B. Caja

PENDING_INSTITUTIONAL_VALIDATION

- cancelación y reapertura;
- políticas institucionales finales.

### C. Generación

PENDING_INSTITUTIONAL_VALIDATION

- responsables;
- aprobación;
- ejecución;
- exclusiones.

### D. Cobranza

PENDING_INSTITUTIONAL_VALIDATION

- prioridades;
- aging oficial;
- escalamiento;
- responsables.

### E. Becas y descuentos

PENDING_INSTITUTIONAL_VALIDATION

- tipos;
- porcentajes;
- topes;
- elegibilidad;
- combinaciones;
- reversión.

### F. Convenios

PENDING_INSTITUTIONAL_VALIDATION

- parcialidades;
- mínimos;
- tolerancias;
- default;
- consecuencias.

### G. Reportes y cierres

PENDING_INSTITUTIONAL_VALIDATION

- timezone;
- formatos;
- PDF/XLSX;
- firma o sello;
- responsables;
- periodos cerrables;
- retención.

### H. Alumno y tutor

PENDING_INSTITUTIONAL_VALIDATION

- eventual acceso financiero tutor.

## Fuera de alcance V1

- CFDI;
- SAT;
- PAC;
- impuestos;
- pagos online;
- Stripe;
- Mercado Pago;
- SPEI automático;
- Open Banking;
- contabilidad general;
- libro mayor;
- pólizas;
- BI avanzado;
- ML;
- forecasting;
- automatización n8n o cron financiera.

## Riesgos residuales

| Riesgo | Probabilidad | Impacto | Mitigación | Acción futura |
| --- | --- | --- | --- | --- |
| Decisiones institucionales tardías | Media | Media | fail-closed y catálogo explícito de pendientes | cierre institucional por dominio |
| UI mínima en superficies administrativas | Alta | Baja | backend, permisos y pruebas ya cerrados | fase de integración visual y operativa |
| Granularidad futura de `finance.payments.reverse` | Baja | Media | wrappers, RBAC, AAL2 y MFA | revisar separación fina por suboperación |
| warning NFT/Turbopack | Baja | Media | baseline verde y warning conocido | revisión técnica posterior de tracing/bundle |

## Criterio de cierre

La Fase 5 se considera técnicamente cerrada porque:

- P0 = 0;
- P1 = 0;
- el ledger es consistente;
- las invariantes monetarias están cubiertas;
- las pruebas globales están en verde;
- permisos y RLS son correctos;
- no falta ningún requisito financiero V1 indispensable.

## Decisión sobre Bloque 7

No se requiere un Bloque 7 técnico obligatorio.

Podrá existir trabajo posterior para:

- decisiones institucionales;
- integración operativa;
- UI/UX;
- evolución POST-V1.

Ese trabajo no bloquea el cierre técnico de la Fase 5.

## Siguiente fase

Fase siguiente recomendada:

UI/UX e integración operativa del Sistema Administrativo

Objetivos generales:

- consolidar layout;
- navegación;
- dashboard;
- tablas;
- filtros;
- formularios;
- modales;
- estados visuales;
- loading, error y empty states;
- responsive;
- accesibilidad;
- conexión visual con los servicios reales ya existentes.

## Declaración de cierre

La Fase 5 — Finanzas Escolares queda:

CERRADA TÉCNICAMENTE CON OBSERVACIONES

Las observaciones restantes no impiden continuar con la siguiente fase del proyecto.
