# Fase 1 — Bloque 5: integración continua y puertas de calidad

## Objetivo

Validar automáticamente el monorepo en GitHub Actions sin conectarse a Supabase, desplegar infraestructura o introducir capacidades institucionales.

Referencia funcional: autorización de **Fase 1 — Bloque 5: integración continua y puertas de calidad**.

## Workflow creado

| Archivo                    | Responsabilidad                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml` | Ejecutar seguridad, límites del monorepo, instalación reproducible y las cinco puertas de calidad |

## Eventos

- `pull_request` dirigido a `main`.
- `push` sobre `main`.
- Ejecución manual mediante `workflow_dispatch`.

La concurrencia cancela ejecuciones anteriores de la misma referencia para evitar consumo duplicado.

## Versiones y acciones

| Componente           | Versión o referencia                                      |
| -------------------- | --------------------------------------------------------- |
| Node.js              | `24.18.0`                                                 |
| pnpm                 | `11.13.0`                                                 |
| `actions/checkout`   | SHA `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0` (`v7.0.0`) |
| `pnpm/action-setup`  | SHA `0ebf47130e4866e96fce0953f49152a61190b271` (`v6.0.9`) |
| `actions/setup-node` | SHA `820762786026740c76f36085b0efc47a31fe5020` (`v7.0.0`) |

Las acciones están fijadas por SHA completo. No se utilizan ramas ni etiquetas flotantes como referencia ejecutable.

## Job, comandos y dependencias

Existe un único job `quality-gates` sobre `ubuntu-24.04`. Al no dividirlo en varios jobs, la instalación y restauración de caché se realizan una sola vez.

El orden es:

1. Checkout.
2. Configuración de pnpm.
3. Configuración de Node.js y caché.
4. Control de secretos y clientes privilegiados.
5. Control de límites del monorepo.
6. `pnpm install --frozen-lockfile`.
7. `pnpm format:check`.
8. `pnpm lint`.
9. `pnpm typecheck`.
10. `pnpm test`.
11. `pnpm build`.

## Permisos y caché

El workflow declara exclusivamente:

```yaml
permissions:
  contents: read
```

No concede permisos de escritura. `actions/setup-node` administra la caché de pnpm usando `pnpm-lock.yaml`; no se almacenan variables de entorno ni secretos.

## Controles de secretos

`.github/scripts/check-security.mjs` revisa archivos ejecutables rastreados y falla ante:

- Variables o valores de claves secretas y de rol de servicio de Supabase.
- Claves privadas, tokens comunes y JWT hardcodeados.
- Patrones de creación no autorizada de clientes administrativos o privilegiados.
- Archivos `.env` reales rastreados.

Se excluyen documentación, pruebas, dependencias y artefactos compilados. Las pruebas contienen términos prohibidos únicamente como controles negativos; excluirlas evita falsos positivos sin omitir código ejecutable.

## Límites del monorepo

`.github/scripts/check-boundaries.mjs` verifica:

- Que ninguna aplicación dependa o importe otra aplicación.
- Que ningún paquete dependa de una aplicación.
- Que las dependencias internas existan y estén declaradas.
- Que los imports internos usen exports públicos.
- Que los imports relativos no crucen aplicaciones o paquetes.
- Que no existan ciclos.
- Que Git no rastree `node_modules`, `dist`, `.next`, `.turbo`, `coverage` o `*.tsbuildinfo`.

## Fallos esperados

El workflow debe fallar ante formato incorrecto, lint o tipos inválidos, pruebas fallidas, build fallido, lockfile desactualizado, secretos detectables, imports internos no públicos, dependencias prohibidas, ciclos o artefactos generados rastreados.

GitHub Actions no se ejecuta localmente de forma idéntica. La validación local comprende ejecución directa de los scripts, análisis estático del workflow y validación de sintaxis YAML mediante Prettier.

## Deudas técnicas registradas

| ID     | Deuda                                                                                                                                                 | Fecha límite                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| DT-001 | La separación de módulos SSR y administrativos se valida actualmente en tiempo de ejecución; debe añadirse una barrera de importación en compilación. | Antes de la Fase 2                        |
| DT-002 | El tipo público `SupabaseClient` es amplio; deben crearse adaptadores con capacidades limitadas.                                                      | Antes de cualquier consulta institucional |

Este bloque registra ambas deudas, pero no modifica la infraestructura de Supabase para resolverlas.

## Funciones no implementadas

- Sin conexión, proyecto o configuración remota de Supabase.
- Sin tablas, migraciones, RLS, consultas o autenticación.
- Sin middleware, proxy, módulos escolares o secretos.
- Sin despliegue de aplicaciones, funciones o infraestructura.
- Sin configuración de ambientes de producción.

## Riesgos

Los patrones de seguridad pueden requerir ampliación cuando aparezcan nuevos lenguajes o rutas ejecutables. Los controles de imports se basan en manifests y sintaxis estática de JavaScript/TypeScript. Las actualizaciones futuras de acciones deben revisar changelogs y renovar deliberadamente sus SHA.

## Estrategia de reversión

Eliminar el workflow, los dos scripts de validación y este documento; después retirar los patrones `.github` de los scripts raíz de formato y lint. No existe infraestructura externa ni estado desplegado que revertir.
