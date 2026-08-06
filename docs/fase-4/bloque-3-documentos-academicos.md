# Fase 4 — Bloque 3: Documentos académicos

Referencia funcional principal: `docs/Plan_Maestro_Sistema_Preparatoria_V1.docx`, bloque documental de consulta, emisión controlada y verificación mínima.

## Objetivo

Introducir un dominio documental auditable e inmutable para documentos informativos generados por el sistema, con snapshot académico, folio técnico, hash reproducible, verificación mínima y lecturas controladas para alumno y tutor.

## Estado de migraciones

- 22 migraciones anteriores al Bloque 3 permanecen intactas.
- La ?nica migraci?n nueva de este bloque es `20260806201803_academic_documents.sql`.
- El repositorio queda con 23 migraciones totales al cierre del Bloque 3.

## Alcance

- tipos;
- plantillas técnicas;
- versiones activas;
- solicitudes;
- emisiones;
- snapshots;
- folios;
- metadatos de archivo;
- códigos de verificación;
- auditoría;
- idempotencia;
- inmutabilidad;
- lectura propia del alumno;
- lectura condicionada del tutor;
- verificación pública mínima.

## Documentos incluidos

| Código interno           | Nombre visible provisional             |
| ------------------------ | -------------------------------------- |
| `SEMESTER_REPORT`        | Boleta semestral informativa           |
| `ENROLLMENT_CERTIFICATE` | Constancia informativa de inscripción  |
| `ACADEMIC_TRANSCRIPT`    | Trayectoria académica informativa      |
| `ENROLLMENT_RECEIPT`     | Comprobante informativo de inscripción |

## Validez provisional

Toda representación usa la leyenda neutral:

> Documento informativo generado por el sistema. Su validez institucional está pendiente de confirmación.

No se implementan:

- firma electrónica;
- sellos;
- logotipos inventados;
- certificados oficiales;
- validez SEP;
- almacenamiento remoto productivo.

## Storage

- `supabase/config.toml` mantiene `storage.enabled = false`.
- El bloque no activa Supabase Storage.
- La base solo conserva metadatos de archivo con `storage_provider = LOCAL_TEST`.
- `object_path` es opaco y no guarda rutas absolutas del equipo.

## Folios y hashes

- Folio técnico provisional: `DOC-{TYPE_SHORT}-{YEAR}-{SEQUENCE}`.
- No se declara como formato institucional definitivo.
- Se generan:
  - `snapshot_hash`
  - `content_hash`
  - `file_hash`
- Todos son SHA-256 reproducibles.

## Contrato de idempotencia de folios

Referencia técnica: migración `supabase/migrations/20260806201803_academic_documents.sql`, función `academic.assign_document_folio(...)`.

Orden transaccional actual:

1. valida actor, aplicación administrativa, permiso exacto, `session_version` vigente y AAL2 mediante `academic.require_document_permission('documents.generate')`;
2. bloquea la emisión objetivo con `FOR UPDATE`;
3. si la emisión ya tiene folio, devuelve ese mismo folio inmediatamente y no abre un comando nuevo;
4. si aún no tiene folio, abre o reutiliza el comando lógico con `academic.begin_document_command(...)`;
5. `begin_document_command(...)` toma un `pg_advisory_xact_lock(...)` estable por `actor + command_type + idempotency_key`;
6. si ya existe un comando previo:
   - misma huella: devuelve el `result_entity_id` previo cuando el estado es `COMPLETED`;
   - distinta huella: devuelve `IDEMPOTENCY_CONFLICT`;
   - estado activo no resuelto: devuelve `CONCURRENT_MODIFICATION`;
7. solo la primera ejecución efectiva incrementa `academic.document_folio_sequences`;
8. la emisión recibe el folio una sola vez;
9. se registra un único evento `DOCUMENT_FOLIO_ASSIGNED`;
10. el comando queda en `COMPLETED` con `result_entity_id` y `completed_at`;
11. la función devuelve el mismo folio estable en reintentos.

Contrato verificado:

- misma `idempotency_key` + misma huella:
  - devuelve exactamente el mismo folio;
  - no consume secuencia adicional;
  - no crea comando adicional;
  - no duplica el evento;
  - no devuelve `CONCURRENT_MODIFICATION`;
- misma `idempotency_key` + distinta huella:
  - devuelve `IDEMPOTENCY_CONFLICT`;
  - no altera el folio previo;
  - no consume secuencia adicional;
  - no crea evento adicional;
- clave distinta sobre una emisión ya foliada:
  - devuelve el folio ya existente;
  - no crea un segundo comando;
  - no genera un segundo folio.

## Concurrencia

- La serialización primaria se apoya en dos barreras:
  - `FOR UPDATE` sobre `academic.document_issuances`;
  - `pg_advisory_xact_lock(...)` sobre la identidad lógica del comando.
- Dos emisiones distintas pueden obtener folios distintos en paralelo.
- Dos intentos equivalentes sobre la misma emisión convergen al mismo resultado.
- La prueba de concurrencia local valida:
  - unicidad de folios bajo carrera;
  - reutilización idempotente del mismo folio;
  - conflicto por huella cuando la clave se reutiliza para otra emisión.

## Comandos y eventos

- `academic.complete_document_command(...)` persiste `status = COMPLETED`, `result_entity_type`, `result_entity_id` y `completed_at`.
- No se guarda payload arbitrario con datos personales; la huella se conserva como `request_fingerprint`.
- `DOCUMENT_FOLIO_ASSIGNED` se registra una sola vez por `event_type + idempotency_key`.
- Si una transacción falla antes del cierre, el comando y sus mutaciones revierten juntos; no se documentó recuperación automática por tiempo.

## Tutor

- Se agregó `can_view_documents boolean not null default false` a `academic.guardian_access_scopes`.
- `STANDARD_ACADEMIC_READ` permanece con `can_view_documents = false`.
- Las rutas del tutor existen, pero la lectura documental sigue cerrada por scope.
- La descarga para tutor no se habilita en este bloque.

## Alumno

- Puede listar emisiones propias visibles.
- Puede consultar detalle mínimo.
- Puede obtener descriptor server-only de descarga para archivo local de prueba únicamente cuando la emisión está `PUBLISHED`.
- Emisiones `REVOKED` y `SUPERSEDED` se muestran sin descarga.

## Verificación pública

Ruta prevista:

- `/verificar-documento`

Contrato público mínimo:

- `verified`
- `folio`
- `typeName`
- `issuedAt`
- `status`:
  - `VIGENTE`
  - `REVOCADO`
  - `SUSTITUIDO`
  - `EXPIRADO`
  - `NO_VERIFICADO`

No expone datos personales ni académicos.

## Seguridad

- funciones administrativas sin `EXECUTE` para `PUBLIC`, `anon` y `authenticated`;
- funciones de lectura propia mediante wrappers públicos mínimos;
- `academic` permanece fuera de Data API;
- tablas nuevas con RLS habilitada;
- cero grants directos a tablas;
- `session_version` vigente en lecturas propias y mutaciones administrativas;
- AAL1 para lectura propia;
- AAL2 + MFA + aplicación administrativa + permiso exacto para mutaciones.

## Riesgos

- El formato institucional definitivo de folio sigue pendiente.
- La validez jurídica externa sigue sin definición.
- La descarga del tutor depende de decisión institucional posterior.
- El artefacto PDF local es técnico y determinista; no equivale a un formato oficial aprobado.
- Supabase CLI sigue mostrando intermitencia previa al habilitar pgTAP; cuando aparece, el bloqueo es de infraestructura local y no del modelo documental.
- Storage continúa deshabilitado; la descarga usa solo descriptor local de prueba y no cubre un backend productivo.

## Pendientes institucionales

- nombre oficial completo;
- logotipo;
- firmas;
- sellos;
- autoridad emisora;
- QR obligatorio;
- vigencia formal de constancias;
- política final de acceso documental del tutor.

## Fuera de alcance

- certificados finales;
- títulos;
- equivalencias;
- pagos de documentos;
- envío por correo o mensajería;
- almacenamiento remoto productivo;
- panel administrativo amplio;
- integraciones remotas.
