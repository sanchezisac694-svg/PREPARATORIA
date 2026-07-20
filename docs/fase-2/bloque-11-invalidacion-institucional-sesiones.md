# Fase 2 — Bloque 11: invalidación institucional de sesiones

## Objetivo y amenaza

Este bloque impide que un access token institucional emitido antes de un evento de
seguridad siga autorizando operaciones. Supabase Auth conserva la validación
criptográfica; PostgreSQL añade una segunda condición: la claim numérica
`session_version` debe coincidir con `core.accounts.session_version` y la cuenta
debe estar `ACTIVE`.

Un JWT firmado puede seguir siendo criptográficamente válido hasta `exp`.
`session_version` no lo destruye: impide inmediatamente su uso institucional.

Referencia funcional: Plan Maestro, seguridad de identidad, acceso y revocación de
sesiones; pendientes institucionales permanecen abiertos.

## Arquitectura

Se eligió el Custom Access Token Hook frente a una resolución exclusivamente en
base porque el requisito exige comparar el token emitido con el estado actual.
`app_metadata` se rechazó como autoridad: requeriría sincronización manual y puede
quedar obsoleta.

La migración `20260720165059_add_institutional_session_version.sql` añade:

- `core.accounts.session_version bigint not null default 1`, restricciones de
  rango y metadatos de última invalidación.
- `core.account_session_security_events`, append-only, RLS habilitada, cero
  políticas y cero grants de aplicación.
- catálogos cerrados de 18 eventos y 12 razones.
- lectores internos de claim/cuenta, validador y guard obligatorio.
- invalidación idempotente con bloqueo `FOR UPDATE`.
- endurecimiento del gateway de identidad y las cuatro políticas SELECT propias.
- invalidación atómica por suspensión, bloqueo o desactivación.

`core` continúa fuera de la Data API.

## Hook y claims

`public.custom_access_token_hook(jsonb)` conserva las claims obligatorias y agrega
solo `session_version`, tomada de `core.accounts` mediante `user_id`. No agrega
roles, cuenta, persona, alias, identificador ni correo. Si Auth no tiene una cuenta
vinculada, omite la claim; el acceso institucional falla cerrado.

La función usa referencias calificadas, `search_path=''`, no usa SQL dinámico y
solo `supabase_auth_admin` puede ejecutarla. `PUBLIC`, `anon` y `authenticated` no
tienen `EXECUTE`. Su `SECURITY DEFINER` se limita a leer una columna interna, ya
que `core` no se expone al rol de Auth. El hook se configuró únicamente en
`supabase/config.toml` local; no se configuró ningún proyecto remoto.

El parser TypeScript `parseInstitutionalSessionVersionClaim()` acepta únicamente
enteros numéricos positivos dentro del rango seguro de JavaScript. Rechaza claim
ausente, texto, cero, negativos, decimales, objetos, arreglos, booleanos y bigint.
Ningún contrato retorna access token, refresh token, cookie o sesión completa.

## Gateway, RLS y rutas

`public.get_current_identity_context()` devuelve el campo cerrado
`session_valid`. Si es falso, `account_id`, `person_id`, roles y aplicaciones se
vacían; las versiones esperada y recibida nunca se exponen. Las páginas privadas
redirigen una sesión obsoleta a `/sesion-expirada`, disponible en ambas
aplicaciones con el mensaje genérico autorizado. Los proxies siguen usando
`getClaims()` y headers `private, no-store`, pero no sustituyen la decisión final
de PostgreSQL.

RPC públicas:

| Superficie                                  | Clasificación                                              |
| ------------------------------------------- | ---------------------------------------------------------- |
| `public.get_current_identity_context()`     | `authenticated`; exige versión vigente                     |
| `public.invalidate_own_sessions(...)`       | `authenticated`; operación propia cerrada                  |
| `public.record_own_nip_security_event(...)` | Evento técnico propio; el acceso previo debe estar vigente |
| RPC de login/recuperación preexistentes     | Públicas o server-only según Bloques 9–10                  |
| `public.custom_access_token_hook(jsonb)`    | Exclusiva de `supabase_auth_admin`                         |
| Funciones `core.*`                          | Internas, salvo el gateway interno preexistente            |

## Ciclo de vida, NIP y cierres

Suspender, bloquear o desactivar incrementa la versión en la misma transacción
institucional. Reactivar no disminuye ni reutiliza versiones anteriores y exige
autenticación nueva.

El cambio autenticado de NIP actualiza la credencial, incrementa la versión,
solicita cierre global y redirige a login. El restablecimiento completa la
operación, incrementa la versión, solicita revocación global y exige login nuevo.
Un fallo de Auth no revierte la invalidación en PostgreSQL.

| Operación                 | Versión                                         | Supabase Auth              | Resultado                            |
| ------------------------- | ----------------------------------------------- | -------------------------- | ------------------------------------ |
| Cerrar actual             | Sin incremento                                  | `scope: local`             | Solo cookie/sesión actual            |
| Cerrar otras              | Incremento cuando es invalidación institucional | `scope: others`            | La actual requiere refresh o login   |
| Cerrar todas              | Incremento                                      | `scope: global`            | Login nuevo obligatorio              |
| Revocación administrativa | Incremento                                      | Puerto privilegiado futuro | No se finge revocación no disponible |

Incrementar `session_version` sin revocar refresh tokens puede permitir obtener un
token nuevo con la versión vigente. Por eso los eventos críticos combinan
incremento y revocación. Auth y PostgreSQL no comparten transacción: el orden es
invalidar y auditar primero, intentar Auth después y marcar reconciliación si el
resultado es fallido o desconocido.

## Idempotencia, concurrencia y auditoría

La misma clave y payload devuelve el resultado previo; una carga distinta produce
`IDEMPOTENCY_CONFLICT`. Una nueva clave puede incrementar de nuevo. El bloqueo de
fila serializa concurrencia, impide decrementos y rechaza overflow. Reintentar la
revocación externa no debe volver a incrementar la versión.

La auditoría no guarda JWT, tokens, cookies, claims completas, NIP, contraseñas,
alias, correo, identificador institucional, IP completa ni user-agent. La tabla es
append-only y sus relaciones usan `ON DELETE RESTRICT`.

## Pruebas y evidencia

- Reset desde base vacía con nueve migraciones.
- pgTAP: 55 aserciones nuevas; suite total de 7 archivos y 166 aserciones.
- Parser, contrato server-only, coordinación y ausencia de exposición del SDK.
- Dos almacenes de cookies independientes en Auth local: ambos tokens nuevos
  contienen claim; tras incrementar la versión los JWT siguen verificables pero
  el gateway rechaza ambos; el cierre global revoca refresh y un login nuevo
  obtiene la versión vigente.
- Inspección de RLS, grants, políticas, hook, Data API, triggers de Auth y
  búsquedas de información sensible.

Todas las identidades son sintéticas y se eliminan al finalizar. Las pruebas no
imprimen JWT, claims, cookies, NIP, alias, correo ni identificadores.

## Reversión local

En una base descartable: desactivar la sección local del hook; retirar gateway y
políticas del bloque; retirar hook, validadores, trigger, operación, auditoría,
enums y columnas; restaurar los contratos del Bloque 10; ejecutar nuevamente las
ocho migraciones históricas. No se modifica ni elimina ninguna migración previa.

## Riesgos, pendientes y exclusiones

- La terminación abrupta entre PostgreSQL y Auth requiere reconciliación.
- Un access token previo conserva validez criptográfica hasta `exp`.
- La revocación administrativa de sesiones de terceros necesita un adaptador
  privilegiado server-only futuro; no se incluyó secret key real.
- La política institucional definitiva sobre suspensión sigue sujeta a validación;
  este bloque aplica la opción segura de invalidar.
- MFA, TOTP, WebAuthn, SMS, correo, CAPTCHA, rate limiting distribuido, SIEM,
  panel/lista de sesiones, dispositivos y producción quedan fuera de alcance.
- No hubo conexión remota, `link`, `db push`, `db pull`, secretos reales ni
  escritura productiva o triggers nuevos sobre `auth.users`.
