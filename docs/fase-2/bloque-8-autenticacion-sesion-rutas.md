# Fase 2 — Bloque 8: autenticación, sesión y protección de rutas

## Objetivo y alcance

Se implementa login por correo Auth temporal, sesión SSR en cookies, renovación, logout, consulta del contexto institucional y protección de rutas en Portal Escolar y Sistema Administrativo. No existe registro público, recuperación, MFA, OAuth, magic links, invitaciones ni módulos escolares.

## Arquitectura y clientes

`@preparatoria/supabase/auth-session` es server-only y encapsula un cliente `@supabase/ssr`. Expone operaciones limitadas para credenciales, claims validados, RPC `get_current_identity_context`, refresh y cierre. Nunca expone `SupabaseClient`, una sesión completa o tokens. Cada invocación crea un cliente nuevo; no existe cliente ni estado de sesión global.

Como `core` permanece fuera de Data API, la migración del bloque crea únicamente `public.get_current_identity_context()`: un gateway sin parámetros y de solo lectura, `SECURITY INVOKER`, propietario `postgres`, `search_path = ''`, concedido a `authenticated` y sin acceso para `anon` o `PUBLIC`. No expone datos personales, no permite elegir otra identidad, no expone tablas ni habilita el esquema `core`. La cadena mínima es `authenticated → public.get_current_identity_context() → core.get_current_identity_context()`; la función interna obtiene exclusivamente `auth.uid()`.

Las variables permitidas son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, validadas por `packages/env`. No se usa `service_role`.

## Cookies y sesión

`@supabase/ssr` lee y escribe cookies mediante `getAll/setAll`. La aplicación no manipula access o refresh tokens, no usa localStorage, IndexedDB ni Cache Storage. Todas las opciones de cookie se transfieren íntegramente a Next.js. No se presupone `HttpOnly`: la guía de Supabase indica que las cookies SSR deben estar disponibles para el cliente y el SDK usa `HttpOnly=false` por diseño.

La inspección local de `@supabase/ssr` 0.12.3 emitió `HttpOnly=false`, `SameSite=lax`, `Path=/`, `Max-Age=34560000` y sin `Expires`. `Secure` se configura explícitamente desde la URL validada: `false` únicamente para `http://localhost` local y `true` para URLs HTTPS de producción. Logout emitió la misma cookie con `Max-Age=0` y eliminó el estado local.

Cada aplicación usa `proxy.ts` para crear un cliente por solicitud y llamar inmediatamente a `getClaims()`. Esta operación verifica criptográficamente el JWT mediante JWKS cuando se usan llaves asimétricas; con firma simétrica local, el SDK consulta Auth para validarlo. Nunca se usa `getSession()` como prueba de identidad.

Cuando el SDK renueva una sesión, `setAll` copia primero cada cookie al request, recrea `NextResponse.next({ request })`, copia al response las cookies con todas sus opciones y aplica todos los headers entregados por `@supabase/ssr`. Además, el proxy fija `Cache-Control: private, no-store`, `Pragma: no-cache` y `Expires: 0` en toda respuesta atravesada, haya o no refresh. Se devuelve exactamente ese response y no se crea otro posteriormente. Proxy no decide autorización institucional; las páginas protegidas vuelven a consultar el contexto en servidor.

Las rutas privadas `/`, `/inicio` y `/dashboard` declaran `dynamic = 'force-dynamic'`; no usan ISR, `revalidate` ni `force-cache`.

## Login y logout

Los Server Actions validan correo y longitud de contraseña, invocan Auth y devuelven un mensaje genérico. Tras el login se valida de nuevo el JWT con `getClaims()`, se consulta el gateway `public.get_current_identity_context()` y se evalúa `allowed_applications`. El correo es una credencial técnica temporal para entorno local; matrícula/NIP sigue pendiente.

Logout se ejecuta en servidor, es idempotente y redirige a `/login`. El cierre global de sesiones no está implementado.

## Autoridad institucional

Supabase Auth demuestra identidad, pero no es autoridad del acceso institucional. `core.accounts.account_status` y `allowed_applications` son la decisión final:

- `ACTIVE`: acceso a aplicaciones permitidas.
- `PENDING_INVITATION`, `PENDING_ACTIVATION`, `SUSPENDED`, `BLOCKED`, `DISABLED`: `/estado-cuenta`.
- Sin vínculo: `/acceso-no-disponible`.
- Aplicación no permitida: `/sin-autorizacion`.
- Sin sesión o sesión expirada: `/login`.

`BLOCKED` no garantiza invalidación inmediata de un token ya emitido.

## Rutas y redirecciones

Públicas/estado: `/login`, `/sin-autorizacion`, `/estado-cuenta`, `/acceso-no-disponible`.

Privadas: `/`, `/inicio`, `/dashboard`. La protección se ejecuta antes del render mediante `requirePortalAccess` o `requireAdminAccess`.

Los redirects posteriores al login usan una lista cerrada: `/`, `/inicio`, `/dashboard`. URLs externas, protocol-relative y valores desconocidos terminan en `/dashboard`.

## Seguridad y pruebas

Las pruebas cubren credenciales inválidas, sesión ausente, sesión válida, estados, acceso Portal/Administrativo y cruzado, logout idempotente, redirects, ausencia de tokens, redacción y barrera server-only. También verifican `getClaims`, cliente nuevo por solicitud, propagación de cookies/opciones/headers, protección anti-caché y rutas dinámicas. La suite SQL comprueba la firma sin parámetros, aislamiento entre usuarios, `SECURITY INVOKER`, propietario, `search_path` y grants del gateway.

No se registran credenciales, cookies, sesiones ni tokens. No se confía en metadata Auth, roles del navegador o autorización cliente.

## Riesgos, limitaciones y reversión

- `@supabase/ssr` continúa en beta.
- Falta rate limiting productivo y captcha.
- Falta matrícula/NIP institucional.
- Falta cierre global y revocación de refresh tokens.
- Las pruebas reales completas de navegador dependen del stack local iniciado y fixtures Auth sintéticos.

La reversión elimina `proxy.ts`, páginas, Server Actions, helpers de aplicación y el subpath `auth-session`; conserva todas las migraciones y modelos persistentes.
