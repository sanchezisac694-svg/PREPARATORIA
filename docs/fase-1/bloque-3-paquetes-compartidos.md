# Bloque 3 — Paquetes compartidos mínimos

## Alcance

El Bloque 3 introduce cuatro paquetes técnicos compartidos y los integra en Portal Escolar y Sistema Administrativo. No incorpora Supabase, autenticación, datos institucionales ni módulos escolares.

## Paquetes creados

| Paquete                | Responsabilidad                                                         |
| ---------------------- | ----------------------------------------------------------------------- |
| `@preparatoria/config` | Configuración TypeScript reutilizable para aplicaciones y bibliotecas   |
| `@preparatoria/env`    | Validación Zod y acceso centralizado a variables públicas y de servidor |
| `@preparatoria/shared` | Errores técnicos, códigos estables, redacción, correlación y logging    |
| `@preparatoria/ui`     | Componentes visuales neutrales y estilos técnicos accesibles            |

Ningún paquete está vacío. `config`, `env`, `shared` y `ui` son consumidos por ambas aplicaciones.

## Grafo de dependencias

```text
portal-escolar ───────────────┐
                              ├── config
sistema-administrativo ───────┤
                              ├── env ────── zod
                              ├── shared
                              └── ui ─────── react / react-dom (peer)
```

Reglas:

- Las aplicaciones no dependen entre sí.
- Los paquetes no dependen de las aplicaciones.
- `env`, `shared` y `ui` usan `config` únicamente durante desarrollo y compilación.
- No existen dependencias circulares.
- No existe `packages/supabase`.

## APIs públicas

### `@preparatoria/config`

- `@preparatoria/config/typescript/base.json`
- `@preparatoria/config/typescript/library.json`
- `@preparatoria/config/typescript/nextjs.json`

### `@preparatoria/env/client`

- `parsePublicEnv`
- `PublicEnv`

Este punto de entrada no accede a `process.env`.

### `@preparatoria/env/server`

- `parseServerEnv`
- `readRuntimeEnv`
- `RuntimeEnv`
- `ServerEnv`

El módulo rechaza su importación cuando existe un entorno de navegador. Las aplicaciones pueden iniciar sin configuración externa: `APP_ENV` usa `development` y `LOG_LEVEL` usa `info`. Las URL técnicas son opcionales en tiempo de arranque, pero `parseServerEnv` permite exigirlas con errores claros cuando un flujo las necesite.

### `@preparatoria/shared`

- `AppError`
- `normalizeError`
- `technicalErrorCodes`
- `createCorrelationId`
- `isCorrelationId`
- `redactSensitive`
- Tipos técnicos asociados

### `@preparatoria/shared/logger`

- `createLogger`
- Tipos de nivel, contexto y entrada

El logger produce JSON estructurado y redacta el contexto antes de escribirlo.

### `@preparatoria/ui`

- `Button`
- `AppLink`
- `Container`
- `Card`
- `Alert`
- `LoadingIndicator`

Los estilos se exponen mediante `@preparatoria/ui/styles.css`.

## Validación de entorno

Variables permitidas:

- `APP_ENV`
- `LOG_LEVEL`
- `PORTAL_BASE_URL`
- `ADMIN_BASE_URL`

No se incluyen variables Supabase. El módulo cliente no lee variables privadas ni accede directamente a `process.env`.

## Redacción de información sensible

La redacción cubre claves o patrones relacionados con:

- Contraseñas.
- Tokens.
- Cookies.
- Secretos, API keys y claves.
- Correos.
- CURP.
- Nombres de documentos y archivos.

Los objetos circulares se sustituyen por un marcador seguro.

## Componentes UI

Los componentes utilizan HTML semántico, props tipadas, roles accesibles, foco visible, contraste suficiente y reducción de movimiento. No incluyen branding definitivo, iconos externos, formularios, navegación institucional o conceptos escolares.

## Pruebas

| Área                         | Evidencia                                                  |
| ---------------------------- | ---------------------------------------------------------- |
| Variables válidas            | Esquemas público y servidor aceptan valores permitidos     |
| Variables faltantes          | El esquema estricto informa las claves ausentes            |
| Arranque sin entorno externo | Valores técnicos predeterminados válidos                   |
| Separación cliente/servidor  | Cliente sin `process.env`; servidor bloqueado en navegador |
| Errores                      | Mensajes internos no se filtran                            |
| Redacción                    | Datos sensibles sustituidos por `[REDACTED]`               |
| Correlación                  | UUID válidos y distintos                                   |
| Logger                       | JSON estructurado y contexto redactado                     |
| UI                           | Semántica, roles y atributos ARIA                          |
| Aplicaciones                 | Ambas consumen `@preparatoria/ui` y conservan sus textos   |
| Build                        | Paquetes y aplicaciones compilan correctamente             |

## Restricciones conservadas

- Sin SDK o conexión Supabase.
- Sin autenticación.
- Sin tablas, migraciones o RLS.
- Sin módulos, tipos o componentes escolares.
- Sin dependencias visuales externas.
- Sin formularios, estado global, iconos o Tailwind.
- Sin imports internos que evadan los exports públicos.

## Riesgos

| Riesgo                                     | Tratamiento                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| Un módulo servidor importado desde cliente | Guardia de ejecución y punto de entrada separado                        |
| Redacción incompleta                       | Lista de claves y patrones centralizada con pruebas                     |
| APIs compartidas demasiado amplias         | Exports explícitos por paquete                                          |
| CSS global en conflicto                    | Prefijo `ui-` y tokens `--ui-*`                                         |
| Paquetes fuente incompatibles con Next     | Tipos desde `src`; ejecución desde `dist` construido por Turborepo      |
| Logger utilizado en navegador              | Mantener el logger como subpath separado y revisar consumidores futuros |

## Estrategia de reversión

1. Retirar las dependencias `workspace:*` de ambas aplicaciones.
2. Restaurar `tsconfig`, `next.config.ts`, páginas y estilos del Bloque 2.
3. Eliminar `packages/config`, `packages/env`, `packages/shared` y `packages/ui`.
4. Restaurar scripts raíz, `turbo.json` y lockfile.
5. Eliminar esta nota.
6. Ejecutar instalación congelada, formato, lint, typecheck, pruebas y build.

La reversión no requiere cambios de datos porque el bloque no crea ni conecta infraestructura externa.
