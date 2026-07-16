# Sistema Integral de Gestión Escolar

Monorepo para el sistema de una preparatoria de un solo plantel.

## Estado actual

- Fase 0: aprobada con observaciones.
- Fase 1, Bloque 1: configuración raíz del monorepo.
- Aplicaciones y módulos escolares: todavía no implementados.

## Requisitos técnicos

- Node.js `24.18.0` LTS.
- pnpm `11.13.0` mediante Corepack.

## Comandos iniciales

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format
pnpm format:check
```

Mientras no existan aplicaciones o paquetes implementados, los comandos orquestados por Turborepo
terminarán correctamente e informarán que no existen tareas aplicables.

## Estructura preservada

- `apps/`: aplicaciones futuras.
- `docs/`: documentación funcional y técnica.
- `packages/`: código compartido futuro.
- `supabase/`: configuración y cambios de datos futuros; permanece sin configuración real en este bloque.

## Reglas del Bloque 1

- Las versiones se fijan de forma exacta en `package.json` y `pnpm-lock.yaml`.
- No se utilizan etiquetas flotantes o versiones preview.
- `.env.example` contiene únicamente nombres de variables, nunca secretos reales.
- No existen aplicaciones, clientes Supabase, tablas, migraciones, RLS ni módulos escolares.
