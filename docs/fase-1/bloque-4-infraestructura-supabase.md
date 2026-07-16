# Fase 1 — Bloque 4: infraestructura técnica de Supabase

## Objetivo

Preparar una integración técnica reutilizable y comprobable con Supabase, sin conexión a proyectos reales ni implementación de capacidades institucionales.

Referencia funcional: autorización de **Fase 1 — Bloque 4: infraestructura técnica de Supabase**. Este bloque conserva abiertos los pendientes institucionales de la Fase 0.

## Paquete creado y dependencias exactas

| Paquete                  | Responsabilidad                                     | Dependencias de ejecución                                                    |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@preparatoria/supabase` | Fábricas técnicas, contratos y tipos de integración | `@preparatoria/env`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.6` |

Las versiones se fijaron sin rangos ni etiquetas. El changelog oficial fue revisado antes de implementar; el requisito anunciado de TypeScript 5 o superior queda satisfecho con TypeScript 5.9.3.

## APIs públicas

| Export                                  | API                                                        | Uso permitido                                                 |
| --------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `@preparatoria/supabase/browser`        | `createSupabaseBrowserClient`                              | Crear un cliente público con URL y clave publicable validadas |
| `@preparatoria/supabase/ssr`            | `createSupabaseSsrClient`                                  | Crear un cliente SSR con adaptador de cookies inyectado       |
| `@preparatoria/supabase/admin-contract` | `PrivilegedClientFactory`                                  | Contrato server-only futuro; no tiene implementación          |
| `@preparatoria/supabase/types`          | Tipos de configuración, cookies, resultado y error técnico | Contratos neutrales sin entidades escolares                   |

## Separación cliente/servidor

La entrada `browser` no importa módulos server-only ni acepta credenciales privilegiadas. Las entradas `ssr` y `admin-contract` rechazan ejecución en navegador. Las fábricas aceptan dependencias inyectables para probar su inicialización sin red.

## Variables de entorno

| Variable pública                       | Validación                                   | Momento de lectura                          |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL HTTPS o localhost                        | Solo al solicitar configuración de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Prefijo de clave publicable y valor no vacío | Solo al solicitar configuración de Supabase |

No se exige ninguna variable para compilar o mostrar las páginas provisionales. `.env.example` no contiene valores reales.

## Controles de seguridad

- La validación rechaza claves que no tengan formato publicable.
- No existe fábrica administrativa real ni credencial privilegiada.
- Ninguna entrada accede directamente a `process.env`; esa responsabilidad permanece en `@preparatoria/env/server`.
- No se registran claves, cookies ni tokens.
- No existen consultas a tablas ni operaciones de autenticación.
- Las aplicaciones importan exclusivamente la entrada pública `browser` y no crean clientes.

## Pruebas realizadas

Se verifican configuración válida, URL inválida, clave ausente o no publicable, clientes de navegador y SSR con dobles, adaptador de cookies, entradas server-only, exports públicos, operación sin red, ausencia de consultas, credenciales privilegiadas, secretos, ciclos y tipos escolares. También se ejecutan las validaciones integrales del monorepo: formato, lint, tipos, pruebas y build.

## Restricciones y funciones expresamente no implementadas

- Sin tablas, migraciones, seeds, RLS, Edge Functions ni configuración de datos.
- Sin conexión local o remota, `link`, `db push` o despliegues.
- Sin login, registro, sesiones, middleware, usuarios ni autenticación funcional.
- Sin consultas, Server Actions, API routes o módulos escolares.
- Sin cliente privilegiado real, claves secretas o rol de servicio.
- Sin `supabase/config.toml`, porque no es necesario para las fábricas y contratos de este bloque.

## Riesgos

Los contratos de cookies pueden requerir adaptación cuando se implemente autenticación real; los SDK pueden cambiar antes de esa fase; y una futura integración incorrecta podría instanciar clientes desde módulos no autorizados. Se mitiga mediante exports separados, validación diferida, versiones fijas, pruebas estáticas y revisión obligatoria antes de incorporar autenticación.

## Estrategia de reversión

Eliminar `packages/supabase` y este documento; retirar sus dependencias e imports técnicos de ambas aplicaciones; revertir las extensiones de `packages/env`; y regenerar el lockfile. No hay infraestructura remota ni estado de base de datos que revertir.
