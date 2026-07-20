# Fase 2 — Bloque 9: identificador institucional y NIP

## Objetivo y alcance

El bloque habilita acceso SSR con identificador institucional y NIP para cuentas institucionales, conserva temporalmente correo y contraseña para ASPIRANTE y mantiene a Supabase Auth como administrador de sesiones. `core.accounts` continúa siendo la autoridad de vínculo, estado, roles y aplicaciones.

No incluye registro, recuperación, cambio de NIP, cambio de identificador, MFA, CAPTCHA, rate limiting distribuido, envío de credenciales, UI administrativa, módulos escolares ni producción.

## Alternativas y decisión

| Alternativa                                   | Ventaja                                                     | Riesgo o costo                                      | Decisión         |
| --------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- | ---------------- |
| Alias Auth determinista                       | No consulta identidad antes de Auth ni requiere privilegios | Es predecible                                       | Elegida          |
| Backend privado con credencial administrativa | Resolución no expuesta                                      | Requiere cliente privilegiado y operación adicional | Fuera de alcance |
| RPC anónima                                   | Implementación directa                                      | Permite enumerar o correlacionar identificadores    | Rechazada        |

El servidor normaliza el identificador, deriva un alias y llama directamente a `signInWithPassword`. No existe endpoint, tabla expuesta o RPC pública para resolver existencia, correo, alias, `auth_user_id`, `account_id`, `person_id`, rol o estado.

## Modelo persistente

La migración `20260720153551_add_institutional_identifier_access.sql` agrega a `core.accounts`:

- `institutional_identifier_type`;
- `institutional_identifier`, siempre canónico;
- `identifier_assigned_at`;
- `identifier_changed_at`.

El enum cerrado contiene `NUMERO_CONTROL`, `MATRICULA`, `EMPLOYEE_ID` y `ADMINISTRATIVE_ID`. Los cuatro campos son simultáneamente nulos o completos. El índice parcial único impide que dos cuentas compartan el mismo identificador normalizado, incluso con tipos distintos. Las cuentas en transición y ASPIRANTE pueden permanecer sin identificador.

`core.accounts` conserva RLS; no se agregan políticas ni grants para `anon` o `authenticated`. `core` continúa fuera de Data API.

## Normalización

SQL y TypeScript aplican la misma regla:

1. eliminan únicamente espacios externos;
2. convierten letras ASCII a mayúsculas;
3. exigen 4–32 caracteres;
4. permiten `A–Z`, `0–9` y guion;
5. exigen letra o número al inicio y final;
6. rechazan espacios internos, Unicode ambiguo, correo, slash, punto, comillas y controles.

No se eliminan caracteres significativos. Los ceros iniciales se conservan. La función SQL es `IMMUTABLE`, `STRICT`, `SECURITY INVOKER`, tiene `search_path = ''` y no puede ejecutarse desde roles de aplicación.

## Alias Auth y dominio técnico

`deriveInstitutionalAuthAlias()` produce un alias determinista mediante prefijo de tipo, identificador canónico y `INSTITUTIONAL_AUTH_ALIAS_DOMAIN`. El tipo forma parte del alias para evitar colisiones semánticas. El alias no contiene correo personal, no se muestra, no se registra y no se devuelve al cliente.

El dominio se valida en `packages/env`, es server-only, no admite protocolo, ruta, puerto ni mayúsculas y debe configurarse por entorno. Las pruebas usan `identidad.sistema-preparatoria.invalid`, reservado para datos sintéticos. El dominio y el alias determinista no son secretos; su predecibilidad no debe convertirse en confirmación de existencia.

## Tratamiento del NIP

El NIP:

- se conserva como `string`;
- permite valor numérico;
- conserva ceros iniciales;
- exige 6–64 caracteres ASCII visibles;
- rechaza espacios y controles sin modificar el valor;
- solo se transporta por POST en Server Action;
- solo vive en memoria al llamar a Supabase Auth;
- no se almacena en `core`, eventos, metadata, errores, logs, cookies propias ni storage del navegador.

Supabase Auth almacena únicamente su hash. La política inicial de seis caracteres es transitoria y más débil que la recomendación general de ocho o más; su endurecimiento institucional continúa pendiente.

## Flujos de acceso

Portal Escolar expone rutas separadas:

- `/login/institucional`: identificador y NIP;
- `/login/aspirante`: correo y contraseña;
- `/login`: selector explícito.

Sistema Administrativo expone únicamente acceso institucional. No se infiere el flujo por formato.

El acceso institucional normaliza, deriva el alias, consulta el guard, llama a Auth, valida JWT con `getClaims()`, consulta `public.get_current_identity_context()` y evalúa `account_status` y `allowed_applications`. Una cuenta con roles de ambas aplicaciones usa la misma cuenta, identificador, NIP y usuario Auth.

El acceso de ASPIRANTE conserva correo y contraseña temporalmente, pero reutiliza la misma validación SSR, contexto institucional, decisiones por aplicación, refresh y logout.

## Prevención de enumeración

Formato inválido, alias inexistente, NIP incorrecto, Auth sin usuario, contexto no disponible y bloqueo temporal producen el mismo mensaje público: “No fue posible iniciar sesión con los datos proporcionados.”

Solo después de autenticación válida se permite redirigir a estados genéricos de cuenta o falta de acceso a la aplicación. No se muestran identificadores internos, alias, roles completos ni IDs persistentes.

## Intentos repetidos

`AuthenticationAttemptGuard` define `checkAllowed`, `recordFailure` y `recordSuccess`. El adaptador local en memoria permite cinco fallos en quince minutos. Su llave es HMAC-SHA-256 sobre IP normalizada, tipo e identificador canónico usando `AUTH_ATTEMPT_GUARD_SALT`; el mapa no almacena el identificador legible ni el NIP.

El estado se reinicia después de éxito o al expirar la ventana. Esta protección no es rate limiting productivo, no se comparte entre procesos o instancias y debe reemplazarse antes de despliegue distribuido.

## Aprovisionamiento

El contrato distingue `APPLICANT_EMAIL` de `INSTITUTIONAL_NIP`. Para la segunda modalidad:

- la persistencia recibe únicamente tipo e identificador normalizado;
- el puerto Auth recibe alias y NIP en memoria;
- `prepare`, eventos, errores y metadata no reciben NIP ni alias;
- se conservan idempotencia, reconciliación, compensación, roles y vínculo.

No se implementó ni ejecutó un adaptador administrativo real. No hubo aprovisionamiento remoto.

## Cambio futuro de identificador

No existe UI ni operación de cambio. El identificador persistente y el alias Auth deben cambiar coordinadamente; PostgreSQL y Auth no comparten transacción. Una futura modificación requerirá saga con idempotencia, reconciliación y compensación. No debe hacerse un `UPDATE` parcial.

## Seguridad, privacidad y pruebas

La suite TypeScript cubre normalización, ceros, alias, dominio, NIP, flujos, mensajes, aplicaciones, guard, bloqueo, reset, server-only, API limitada y ausencia de datos sensibles. pgTAP cubre enum, función, constraints, unicidad, nullable, RLS, políticas, grants, Data API, ausencia de NIP/RPC/trigger Auth, limpieza y reversión.

La prueba local utiliza exclusivamente Supabase y Auth locales con fixtures sintéticos; no imprime identificadores, NIP, contraseñas, alias, correos, tokens o cookies.

## Reversión

En una base local descartable:

1. eliminar el índice único;
2. eliminar checks y cuatro columnas de `core.accounts`;
3. eliminar `core.normalize_institutional_identifier(text)`;
4. eliminar el enum;
5. revertir formularios, contratos, variables y pruebas del bloque.

La reversión no modifica las seis migraciones anteriores.

## Riesgos, limitaciones y pendientes

- Alias determinista predecible, aunque no confirma existencia.
- NIP mínimo de seis caracteres pendiente de validación institucional.
- Guard en memoria no productivo ni distribuido.
- Cambio de identificador pendiente de saga.
- Recuperación y cambio de NIP pendientes.
- MFA y CAPTCHA pendientes.
- Correo de ASPIRANTE es compatibilidad temporal.
- `@supabase/ssr` continúa en beta.
- No hubo conexión remota, `supabase link`, `db push` ni `db pull`.
