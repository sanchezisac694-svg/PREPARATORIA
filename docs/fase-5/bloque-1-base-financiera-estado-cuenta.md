# Fase 5 — Bloque 1: base financiera escolar y estado de cuenta

## Alcance

Implementación V1 cerrada y auditable del dominio `finance` para conceptos, tarifas, cuentas, cargos, ajustes, pagos, aplicaciones, saldos derivados, recibos internos y lectura propia en Portal Escolar.

## Decisiones técnicas

- Moneda única V1: `MXN`.
- Montos: `numeric(12,2)` en PostgreSQL; TypeScript recibe decimales como string.
- `finance` permanece fuera de Data API.
- Sin grants directos a `PUBLIC`, `anon` o `authenticated`.
- RLS habilitada en todas las tablas financieras, sin políticas directas.
- Recibo interno no fiscal con formato `REC-{YEAR}-{SEQUENCE}`.
- Sin CFDI, sin PDF productivo, sin pagos en línea, sin panel completo de caja.

## Objetos principales

| Sección | Implementación |
| --- | --- |
| Tablas | `charge_concepts`, `charge_rates`, `student_accounts`, `student_charges`, `charge_adjustments`, `payments`, `payment_allocations`, `financial_commands`, `financial_events`, `receipt_sequences` |
| Wrappers alumno | `public.get_my_student_financial_summary`, `public.get_my_student_account_statement`, `public.get_my_student_charges`, `public.get_my_student_payments`, `public.get_my_student_payment`, `public.get_my_student_receipt` |
| Wrappers tutor | `public.get_my_guardian_student_financial_summary`, `public.get_my_guardian_student_account_statement` |
| Servicio server-only | `packages/supabase/src/student-finance.ts` |
| Rutas UI | `/alumno/estado-cuenta`, `/alumno/pagos`, `/alumno/pagos/[paymentId]`, `/tutor/alumnos/[linkId]/estado-cuenta` |

## Permisos

Se agregaron permisos cerrados `finance.*`, además de:

- `portal.student.finance.read_own`
- `portal.guardian.finance.read_linked`

Los permisos genéricos `payments.*` permanecen por compatibilidad, pero no autorizan el dominio financiero nuevo por equivalencia.

## Alumno y tutor

- Alumno: lectura propia en AAL1, con `session_version` vigente, cuenta `ACTIVE`, rol `ALUMNO` y aplicación `PORTAL_ESCOLAR`.
- Tutor: fail-closed mientras `academic.guardian_access_scopes.can_view_financial_account = false` en `STANDARD_ACADEMIC_READ`.

## Privacidad

- No se exponen `auth_user_id`, `account_id`, `person_id`, `student_record_id` ni actores administrativos.
- Las referencias de pago se presentan enmascaradas.
- Las rutas usan `force-dynamic`, `noStore()` y respuesta privada/no-cache.

## Idempotencia, auditoría e inmutabilidad

- Idempotencia y huella: `finance.financial_commands`.
- Auditoría append-only: `finance.financial_events`.
- Sin `DELETE` ordinario en tablas operativas.
- Estados y montos terminales cambian solo por funciones controladas.

## Pruebas

| Prueba | Objetivo |
| --- | --- |
| `supabase/tests/student-finance.test.sql` | Validación pgTAP de schema, wrappers, RLS, grants y Data API |
| `supabase/tests/student-finance-local.test.mjs` | Flujo local end-to-end con cargo, pago, recibo, idempotencia y tutor fail-closed |
| `supabase/tests/student-finance-concurrency.test.mjs` | Idempotencia concurrente y secuencias de recibo |
| `packages/supabase/tests/supabase.test.mjs` | Contrato TypeScript server-only |
| `apps/portal-escolar/tests/smoke.test.mjs` | Integración UI sin IDs internos, sin CFDI y sin “Pagar ahora” |

## Riesgos y pendientes

- La huella de idempotencia usa `md5(...)` determinista en esta fase; puede elevarse a un hash criptográfico más fuerte cuando se formalice la dependencia correspondiente.
- El scope financiero del tutor sigue deshabilitado por política institucional.
- No existe todavía panel administrativo completo de caja ni operación de pagos en línea.

## Reversión

- Revertir mediante una migración compensatoria nueva; no reescribir migraciones históricas.
- Validar primero en Supabase local con `db reset --local` y `test db --local`.

## Fuera de alcance

- CFDI.
- PDF fiscal productivo.
- Pasarela de pago.
- Notificaciones reales.
- Integración con `academic.document_issuances`.
- Bloque 2 financiero.
