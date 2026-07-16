# Cierre técnico del Bloque 2 — Esqueletos de aplicaciones

## Alcance cerrado

El Bloque 2 creó exclusivamente dos aplicaciones Next.js mínimas dentro del monorepo. No incorpora autenticación, Supabase, API institucional, paquetes compartidos ni módulos escolares.

## Aplicaciones creadas

| Aplicación             | Paquete                                | Propósito actual                                                |
| ---------------------- | -------------------------------------- | --------------------------------------------------------------- |
| Portal Escolar         | `@preparatoria/portal-escolar`         | Esqueleto técnico provisional para la futura aplicación externa |
| Sistema Administrativo | `@preparatoria/sistema-administrativo` | Esqueleto técnico provisional para la futura aplicación interna |

Ambas aplicaciones usan App Router, Server Components por defecto y páginas provisionales sin datos escolares.

## Versiones instaladas

| Dependencia        | Versión exacta |
| ------------------ | -------------: |
| Node.js            |      `24.18.0` |
| pnpm               |      `11.13.0` |
| Next.js            |      `16.2.10` |
| React              |       `19.2.7` |
| React DOM          |       `19.2.7` |
| TypeScript         |        `5.9.3` |
| ESLint             |       `10.7.0` |
| typescript-eslint  |       `8.64.0` |
| Prettier           |        `3.9.5` |
| Turborepo          |       `2.10.5` |
| `@types/node`      |      `24.13.3` |
| `@types/react`     |      `19.2.17` |
| `@types/react-dom` |       `19.2.3` |

Todas las dependencias directas utilizan versiones exactas. No se emplean etiquetas flotantes o versiones preliminares.

## Puertos

| Aplicación             | Desarrollo | Inicio de build local |
| ---------------------- | ---------: | --------------------: |
| Portal Escolar         |     `3000` |                `3000` |
| Sistema Administrativo |     `3001` |                `3001` |

Las dos aplicaciones se iniciaron simultáneamente y respondieron HTTP 200 en sus respectivos puertos.

## Pruebas ejecutadas

| Prueba                             | Resultado                           |
| ---------------------------------- | ----------------------------------- |
| Instalación con pnpm 11.13.0       | Correcta                            |
| Comprobación de peer dependencies  | Sin conflictos al cierre            |
| `pnpm format:check`                | Correcta                            |
| `pnpm lint`                        | Correcta                            |
| `pnpm typecheck`                   | Dos aplicaciones correctas          |
| `pnpm test`                        | Dos pruebas técnicas correctas      |
| Build de Portal Escolar            | Correcto                            |
| Build de Sistema Administrativo    | Correcto                            |
| Arranque en 3000 y 3001            | Correcto; HTTP 200                  |
| Contenido provisional              | Títulos, mensaje y estado correctos |
| Imports cruzados                   | Ninguno                             |
| Secretos                           | Ninguno detectado                   |
| Contenido escolar fuera de alcance | Ninguno                             |

Las pruebas técnicas utilizan el runner nativo de Node y verifican el contenido mínimo de cada página provisional.

## Estado de `eslint-config-next`

`eslint-config-next@16.2.10` no quedó instalado porque sus dependencias transitivas de ESLint declaraban compatibilidad hasta ESLint 9, mientras que la versión raíz aprobada es `eslint@10.7.0`. Mantenerlo habría requerido forzar peer dependencies o cambiar una versión previamente aprobada.

El Bloque 2 conserva la configuración compartida basada en `typescript-eslint@8.64.0`. Esta configuración valida TypeScript y reglas generales, pero todavía no incorpora todas las reglas oficiales específicas de Next.js.

### Riesgo temporal

Mientras no se utilicen las reglas oficiales de Next.js, lint podría no detectar ciertos patrones específicos del framework relacionados con imágenes, enlaces, fuentes, convenciones del App Router o prácticas recomendadas de rendimiento.

El riesgo es aceptable temporalmente porque las páginas actuales son esqueletos estáticos mínimos, sin imágenes, navegación, obtención de datos, autenticación ni lógica institucional.

### Acción posterior recomendada

En un bloque posterior de calidad:

1. Verificar si `eslint-config-next` ya es compatible con ESLint 10.
2. Incorporarlo sin `--force` y sin ignorar peer dependencies.
3. Ejecutar lint sobre ambas aplicaciones.
4. Documentar cualquier nueva regla o corrección requerida.
5. Si la compatibilidad continúa ausente, evaluar ESLint 9 solamente mediante una decisión técnica aprobada, nunca mediante cambio silencioso.

## Scripts nativos deshabilitados

pnpm mantiene deshabilitados explícitamente los scripts de instalación de:

- `sharp`
- `unrs-resolver`

No quedaron scripts de build ignorados automáticamente; ambos casos están declarados de forma explícita mediante `allowBuilds`.

### Consecuencia técnica conocida

- `sharp`: la optimización avanzada de imágenes de Next.js podría no disponer de su implementación nativa. El Bloque 2 no utiliza `next/image` ni procesa imágenes, por lo que los builds actuales no se ven afectados.
- `unrs-resolver`: cualquier función que dependa de su componente nativo podría utilizar una ruta alternativa o no estar disponible. La configuración ESLint actual y los builds pasaron correctamente sin ejecutar ese script.

### Acción posterior recomendada

Antes de incorporar imágenes, reglas avanzadas de resolución o despliegues definitivos:

1. Revisar procedencia, integridad y necesidad de cada script.
2. Consultar la documentación y versiones oficiales.
3. Aprobar individualmente solo el script requerido.
4. Ejecutar `pnpm rebuild` para el paquete autorizado.
5. Repetir instalación congelada, lint, pruebas y builds.
6. Mantener denegado cualquier script que no sea necesario.

## Condiciones de cierre

- No existen imports cruzados entre aplicaciones.
- No existe conexión con Supabase.
- No existen clientes Supabase, tablas, migraciones o RLS.
- No existen paquetes compartidos.
- No existen módulos escolares.
- Las aplicaciones compilan y se ejecutan independientemente.
- No se realizó commit ni push como parte del cierre.
