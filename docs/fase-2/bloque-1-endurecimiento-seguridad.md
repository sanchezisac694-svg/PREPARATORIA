# Fase 2 — Bloque 1: endurecimiento previo de seguridad

## Objetivo

Resolver DT-001 y DT-002 antes de implementar identidad y acceso, sin introducir autenticación, consultas, credenciales privilegiadas o infraestructura institucional.

Referencia funcional: autorización de **Fase 2 — Bloque 1: endurecimiento previo de seguridad**.

## Resolución de DT-001

DT-001 queda resuelta el 2026-07-16 mediante una barrera de compilación compatible con Next.js:

- `packages/supabase/src/ssr.ts` importa `server-only`.
- `packages/supabase/src/admin-contract.ts` importa `server-only`.
- Ambos exports permanecen separados de la entrada de navegador.
- Las comprobaciones de `window` se conservan únicamente como defensa adicional de ejecución.
- Dos pruebas generan Client Components temporales y verifican que Next.js rechace durante el build los imports de `@preparatoria/supabase/ssr` y `@preparatoria/supabase/admin-contract`.

El mecanismo evita que un módulo marcado como cliente incorpore accidentalmente estas entradas a su grafo.

## Resolución de DT-002

DT-002 queda resuelta el 2026-07-16. Las APIs públicas ya no importan, exportan ni devuelven `SupabaseClient`.

El SDK permanece encapsulado como una dependencia desconocida dentro de implementaciones privadas. Los consumidores reciben adaptadores que solo permiten comprobar su entorno e inicialización.

## Adaptadores limitados y APIs públicas

| Export                                  | API                                                                   | Capacidades públicas                                                        |
| --------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `@preparatoria/supabase/browser`        | `createSupabaseBrowserClient`, `BrowserSupabaseAdapter`               | `runtime: "browser"` e `isInitialized()`                                    |
| `@preparatoria/supabase/ssr`            | `createSupabaseSsrClient`, `SsrSupabaseAdapter`, adaptador de cookies | `runtime: "server"` e `isInitialized()`                                     |
| `@preparatoria/supabase/admin-contract` | `PrivilegedClientFactory`, `AdministrativeSupabaseAdapter`            | Contrato futuro sin implementación; entorno administrativo e inicialización |
| `@preparatoria/supabase/types`          | Configuración, cookies, adaptadores, resultados y errores técnicos    | Tipos neutrales sin entidades institucionales                               |

Los adaptadores no exponen `from`, `rpc`, `storage`, autenticación, funciones, canales, realtime u operaciones administrativas.

## Dependencia server-only

Se utiliza `server-only@0.0.1`, fijada exactamente en el manifiesto y el lockfile. Next.js reconoce esta marca y produce un error de compilación cuando el módulo entra al grafo de un Client Component.

Las pruebas directas de Node usan la condición `react-server`, mientras las pruebas negativas usan `next build --webpack`. Cada fallo debe incluir simultáneamente el patrón oficial `'server-only' cannot be imported from a Client Component module`, el subpath exacto resuelto en el import trace y la referencia explícita a Client Component.

Las aserciones rechazan resultados causados por módulos o dependencias ausentes, archivos inexistentes, errores de sintaxis, configuración TypeScript inválida o configuración general inválida.

Los fixtures se generan mediante `os.tmpdir()` y `fs.mkdtemp()`, fuera del repositorio. Contienen la aplicación mínima y copias temporales exclusivamente de `package.json` y `dist` para `@preparatoria/supabase` y `@preparatoria/env`; las dependencias de terceros se enlazan desde la instalación local. La ejecución usa `npm_execpath` cuando está disponible, Corepack como fallback en Windows y un ejecutable pnpm descubierto sin shell en sistemas POSIX.

## Pruebas

- Import y creación válidos del adaptador de navegador.
- Import y creación válidos del adaptador SSR en servidor.
- Cookies SSR inyectadas mediante un doble.
- Fallo de build al importar SSR desde Client Component.
- Fallo de build al importar el contrato administrativo desde Client Component.
- Identificación explícita de `server-only`, del subpath prohibido y del entorno cliente.
- Exclusión explícita de errores alternativos de resolución, sintaxis, archivos, dependencias o configuración.
- Defensa adicional de ejecución en entorno navegador.
- Ausencia de `SupabaseClient` en las APIs públicas.
- Ausencia de capacidades generales del SDK, consultas, autenticación y credenciales privilegiadas.
- Operación con dobles y sin conexión de red.
- Verificaciones integrales de formato, lint, tipos, pruebas, build, ciclos y tipos escolares.

## Evidencia relacionada

- `packages/supabase/src/browser.ts`.
- `packages/supabase/src/ssr.ts`.
- `packages/supabase/src/admin-contract.ts`.
- `packages/supabase/src/types.ts`.
- `packages/supabase/tests/supabase.test.mjs`.
- `packages/supabase/package.json`.
- `docs/fase-1/bloque-5-ci-calidad.md`.

## Riesgos y limitaciones

- Los adaptadores actuales son intencionalmente mínimos y todavía no permiten operaciones con Supabase.
- Las capacidades deberán ampliarse mediante interfaces específicas y revisadas, nunca devolviendo nuevamente el cliente general.
- La prueba negativa depende del comportamiento documentado de Next.js para `server-only`; una actualización de Next.js deberá volver a validarla.
- La limpieza mediante `finally` cubre ejecuciones y fallos normales, pero no puede garantizarse ante la terminación abrupta del proceso.
- La ejecución directa con `node --test` requiere que `npm_execpath`, Corepack o un ejecutable pnpm sin shell estén disponibles; en caso contrario se emite un error explícito.

## Funciones no implementadas

- Sin login, registro, usuarios, sesiones o autenticación funcional.
- Sin middleware o proxy.
- Sin clientes administrativos o privilegiados reales.
- Sin tablas, migraciones, RLS, consultas o tipos escolares.
- Sin conexión a Supabase, producción o servicios externos.

## Estrategia de reversión

Retirar `server-only`, restaurar las firmas anteriores de las fábricas y contratos, revertir las pruebas y devolver DT-001 y DT-002 a estado abierto. Después regenerar el lockfile. No existe estado remoto, datos o infraestructura que revertir.
