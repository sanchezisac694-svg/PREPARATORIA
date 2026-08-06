# Fase 4 — Bloque 2: Portal del tutor y vinculación segura tutor–alumno

## Objetivo

Permitir que una cuenta con rol `TUTOR` consulte únicamente información académica publicada de alumnos con vínculo institucional activo y vigente, resuelto server-side desde `auth.uid()`.

## Alcance

- Solicitudes institucionales de vínculo.
- Aprobación y creación de vínculo.
- Activación, suspensión, reactivación, expiración y revocación.
- Scope técnico provisional `STANDARD_ACADEMIC_READ`.
- Portal privado `/tutor` dentro de `apps/portal-escolar`.
- Lecturas propias del tutor mediante wrappers públicos mínimos.
- Idempotencia, auditoría, historial e inmutabilidad.

## Vínculo institucional

El expediente académico y el vínculo digital de acceso son conceptos separados. Que una persona figure como madre, padre o responsable en datos administrativos no concede acceso automáticamente al portal. El acceso requiere:

- cuenta institucional `ACTIVE`;
- rol `TUTOR` activo;
- aplicación `PORTAL_ESCOLAR`;
- `session_version` vigente;
- vínculo `ACTIVE` y vigente;
- scope activo.

Conocer matrícula, UUID o nombre no otorga acceso.

## Solicitudes y aprobación

Se modelan:

- `academic.guardian_student_link_requests`
- `academic.guardian_student_links`
- `academic.guardian_student_link_history`
- `academic.guardian_access_scopes`
- `academic.guardian_portal_commands`
- `academic.guardian_portal_events`

La solicitud y el vínculo son entidades distintas. Aprobar una solicitud no concede acceso por sí sola; el acceso comienza hasta que existe un vínculo activo.

## Scope

Se crea `STANDARD_ACADEMIC_READ` como política técnica provisional pendiente de ratificación institucional.

- No concede mutaciones.
- No define múltiples scopes oficiales.
- La visibilidad efectiva es:

información publicada ∩ vínculo activo y vigente ∩ scope autorizado ∩ sesión válida

## Autorización

Lectura propia del tutor:

- AAL1 permitido.
- Validación de cuenta, rol, aplicación, `session_version`, vínculo y scope.

Mutaciones administrativas:

- AAL2.
- MFA satisfecha.
- aplicación administrativa.
- permiso exacto.

Los roles `SUPERADMIN`, `ADMINISTRATIVO` y `CONTROL_ESCOLAR` administran vínculos, pero no usan `get_my_guardian_*` para consultar terceros en este bloque.

## Session version y caché

Todas las rutas `/tutor` son:

- dinámicas;
- `private, no-store`;
- sin ISR;
- sin rendering estático con datos personales.

El acceso se invalida por:

- cambio de `session_version`;
- suspensión;
- expiración;
- revocación.

## Publicación

Se mantiene la misma política base del portal del alumno:

- horario: `PUBLISHED`;
- asistencia: `CLOSED` o `LOCKED`;
- calificaciones: `FINALIZED` o `CORRECTED`;
- resultados: `CONFIRMED`;
- decisiones: `CONFIRMED`.

Estados borrador o intermedios permanecen ocultos.

## Privacidad

El tutor puede ver:

- código institucional del alumno cuando está disponible;
- estado académico mínimo;
- información académica publicada.

No se exponen:

- `student_record_id`;
- `account_id`;
- `person_id`;
- `auth_user_id`;
- UUIDs internos;
- correos, teléfonos, domicilio;
- datos médicos;
- otros tutores;
- actores administrativos;
- auditoría, comandos o eventos.

Para `linkId` inexistente, ajeno, revocado, suspendido, expirado o fuera de scope, el comportamiento público es cerrado con `GUARDIAN_PORTAL_ACCESS_DENIED`.

## Portal y rutas

Rutas privadas implementadas:

- `/tutor`
- `/tutor/alumnos`
- `/tutor/alumnos/[linkId]`
- `/tutor/alumnos/[linkId]/expediente`
- `/tutor/alumnos/[linkId]/materias`
- `/tutor/alumnos/[linkId]/horario`
- `/tutor/alumnos/[linkId]/asistencia`
- `/tutor/alumnos/[linkId]/permisos`
- `/tutor/alumnos/[linkId]/calificaciones`
- `/tutor/alumnos/[linkId]/trayectoria`

`linkId` es una referencia opaca, no una autorización suficiente.

## Idempotencia, concurrencia, auditoría e inmutabilidad

- `academic.guardian_portal_commands` conserva `idempotency_key`, fingerprint SHA-256 y resultado estable.
- `academic.guardian_portal_events` registra eventos cerrados del bloque.
- `academic.guardian_student_link_history` conserva historial append-only.
- Se prohíbe `DELETE` directo y se protegen estados terminales.

## Pruebas

Se agregan:

- `supabase/tests/guardian-portal.test.sql`
- `supabase/tests/guardian-portal-local.test.mjs`
- `supabase/tests/guardian-portal-concurrency.test.mjs`

Además se amplía la cobertura de:

- `packages/supabase/tests/supabase.test.mjs`
- `apps/portal-escolar/tests/smoke.test.mjs`

### Estado actual verificado

- P0 corregido en el hardening del bloque.
- `guard_guardian_history()` ya no mezcla el enum de solicitudes con el enum de vínculos.
- `academic.get_my_linked_students()` usa `statement_timestamp()` para no ocultar falsamente vínculos creados dentro de la misma transacción de prueba.
- El listado y el overview del tutor muestran únicamente vínculos `ACTIVE` y vigentes.
- La suite focalizada del tutor mantiene `plan(104)` y queda en verde.

### Suite global SQL

Validación amplia más reciente:

- Archivos pgTAP: 16
- Pruebas totales: 941
- Fallos: 0
- Skips: 0 visibles
- Resultado: `PASS`

### Integración local del tutor

La validación local cubre y verifica:

- Tutor A con varios alumnos.
- Alumno con varios tutores.
- `linkId` propio y ajeno.
- `periodId` propio y ajeno.
- Vínculo `ACTIVE`, `PENDING_ACTIVATION`, `SUSPENDED`, `EXPIRED`, `REVOKED`.
- Solicitud cancelada sin concesión de acceso.
- `valid_from` futuro y `valid_until` vencido.
- Scope inactivo.
- Cuenta suspendida.
- Rol `TUTOR` revocado.
- Aplicación revocada.
- `session_version` obsoleta.
- Lectura permitida en AAL1.
- Rechazo de `DOCENTE`, `PREFECTURA`, `CAJA`, `ALUMNO` y `ASPIRANTE`.
- Publicación de horario, asistencia y calificaciones solo en estados visibles.
- Privacidad sin fuga de UUID internos, correos ni actores administrativos.
- Error público uniforme `GUARDIAN_PORTAL_ACCESS_DENIED`.

### Concurrencia

La validación nativa de concurrencia usa dos conexiones PostgreSQL independientes, barreras explícitas con `pg_advisory_lock`, timeout por escenario y cleanup reejecutable.

Escenarios verificados:

1. solicitudes duplicadas;
2. aprobaciones dobles;
3. activaciones dobles;
4. suspensión frente a lectura;
5. revocación frente a lectura;
6. expiración frente a lectura;
7. cambio de scope frente a lectura;
8. revocación de rol frente a lectura;
9. `session_version` frente a lectura;
10. vínculos `ACTIVE` duplicados;
11. misma `idempotency_key` y misma huella;
12. misma `idempotency_key` con payload distinto.

Resultado más reciente:

- Subpruebas: 12 escenarios dentro de 1 suite Node (`tests=13` reportados por el runner al contar la prueba contenedora).
- Fallos: 0
- Resultado: `PASS`

### Grants exactos

Funciones administrativas auditadas:

- `create_guardian_link_request`
- `submit_guardian_link_request`
- `begin_guardian_link_review`
- `approve_guardian_link_request`
- `reject_guardian_link_request`
- `cancel_guardian_link_request`
- `expire_guardian_link_request`
- `change_guardian_link_request_status`
- `create_guardian_student_link`
- `activate_guardian_student_link`
- `suspend_guardian_student_link`
- `reactivate_guardian_student_link`
- `revoke_guardian_student_link`
- `expire_guardian_student_link`

Confirmaciones:

- `PUBLIC`: sin `EXECUTE`
- `anon`: sin `EXECUTE`
- `authenticated`: sin `EXECUTE`
- owner: `postgres`
- `search_path`: vacío
- `SECURITY DEFINER`: usado para mutación cerrada del bloque
- SQL dinámico: no detectado en estas funciones
- rol `TUTOR`: sin acceso directo a funciones administrativas

### Trazabilidad del scope

- `STANDARD_ACADEMIC_READ` permanece como scope técnico provisional.
- `is_system_scope` distingue scopes institucionales del catálogo editable.
- El constraint de trazabilidad exige:
  - scope de sistema → `created_by_account_id` nulo;
  - scope no sistémico → `created_by_account_id` obligatorio.

### Reversión específica

Estado A: hasta portal del alumno

- sin objetos del portal tutor;
- pruebas del alumno aplicables;
- aislamiento y publicación del alumno intactos.

Estado B: migración inicial del tutor

- objetos de vínculo presentes;
- wrappers públicos disponibles;
- sin el hardening posterior del P0/P1.

Estado C: estado completo actual

- migración inicial del tutor;
- migración de hardening;
- suite global pgTAP;
- integración local;
- doce carreras de concurrencia.

Reversión lógica documentada:

- grants administrativos;
- `is_system_scope`;
- constraint de trazabilidad;
- triggers endurecidos;
- funciones reemplazadas;
- filtros `ACTIVE` y vigentes;
- dependencias exclusivas del Bloque 2.

## Reversión

La implementación se introduce en una sola migración aditiva posterior al portal del alumno. Las 20 migraciones anteriores permanecen intactas.

## Riesgos

- La política institucional final de parentescos, máximos, vigencias y tutor principal sigue pendiente.
- `STANDARD_ACADEMIC_READ` es una política técnica inicial, no una ratificación institucional definitiva.
- Las consultas administrativas de terceros quedan fuera de este bloque.
- La concurrencia validada cubre carreras críticas del bloque, pero no reemplaza futuras pruebas E2E cuando exista flujo UI completo.
- La reversión aquí es lógica y local; no debe ejecutarse de forma destructiva sobre datos reales.

## Decisiones pendientes

Siguen abiertas, sin suposición automática:

- máximo de tutores por alumno;
- tutor principal obligatorio;
- vigencias formales;
- acceso tras baja o egreso;
- tratamiento de mayoría de edad;
- disputa o revocación formal;
- privacidad diferenciada por caso.
- facultades institucionales finales sobre scopes adicionales.

## Fuera de alcance

- autoservicio de vínculo;
- búsqueda abierta por matrícula;
- edición académica;
- documentos oficiales;
- pagos;
- notificaciones reales;
- conexión remota.
