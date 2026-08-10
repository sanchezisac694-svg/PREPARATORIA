# Fase 6 — Bloque 2: design system base y shell administrativo

## Objetivo

Construir la primera capa visual reutilizable del Sistema Administrativo sin modificar la lógica de negocio existente. Este bloque introduce tokens, componentes base, shell global, navegación principal responsive y contexto visual en español.

## Decisiones visuales

- Se mantiene el stack actual basado en CSS global y `packages/ui`.
- No se incorpora Tailwind, shadcn/ui, Radix ni un framework CSS completo.
- Se conserva una estética institucional, sobria y de densidad media.
- No se modifica la lógica financiera, contratos backend, RLS ni migraciones.

## Tokens

Se formalizaron variables semánticas para:

- fondos;
- superficies;
- bordes;
- texto;
- color primario;
- estados `success`, `warning`, `danger`, `info`;
- spacing;
- radius;
- elevation.

La base cromática conserva la dirección cyan/slate aprobada en auditoría.

## Componentes base

Se mejoraron componentes existentes:

- `Button`
- `AppLink`
- `Container`
- `Card`
- `Alert`
- `LoadingIndicator`

Se agregaron componentes nuevos:

- `PageContainer`
- `Breadcrumbs`
- `PageHeader`
- `StatusBadge`
- `Money`
- `DateDisplay`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `SectionCard`
- `MetricCard`
- `FormActions`

## Shell administrativo

Se implementó un shell con:

- sidebar;
- topbar;
- main content;
- navegación principal real;
- breadcrumbs;
- contexto resumido de rol;
- cierre de sesión visible.

El shell se aplica a rutas autenticadas de backoffice y excluye:

- `/login`
- `/login/institucional`
- `/mfa/requerido`
- `/mfa/verificar`
- `/acceso-no-disponible`
- `/sin-autorizacion`
- `/sesion-expirada`
- rutas públicas de acceso o sesión expirada

La decisión de exclusión se realiza en un wrapper cliente que usa `usePathname`, evitando hacks basados en headers. La ruta raíz `/` conserva shell porque actualmente delega al dashboard autenticado.

## Navegación

La navegación global quedó en español y usa únicamente rutas reales:

- Inicio
- Caja
  - Turno
  - Nuevo cobro
  - Movimientos
  - Arqueo
  - Cierre
- Finanzas
  - Generación de cargos
  - Cobranza
  - Becas y descuentos
  - Convenios
  - Reportes
  - Cierres
- Seguridad
  - Cambiar NIP
  - MFA
  - Recuperaciones MFA

## Responsive

- Desktop: sidebar visible
- Mobile/tablet: drawer con botón de menú accesible, backdrop y cierre con tecla `Escape`
- Main content con ancho administrativo generoso
- Sin doble scroll innecesario

## Accesibilidad

- `nav aria-label` en navegación
- botón de menú con `aria-expanded`, `aria-controls` y `aria-label`
- `aria-current="page"` para ruta activa
- foco visible
- el drawer oculto deja de ser interactivo en móvil
- compatibilidad con `prefers-reduced-motion`

## Idioma

La navegación global y el contexto principal quedaron en español.

Se mantiene deuda localizada en contenidos existentes de ciertos módulos donde aún aparecen términos técnicos o etiquetas mixtas. Esa corrección total queda fuera del alcance de este bloque.

## Límites del bloque

Este bloque no implementa todavía:

- DataTable completa
- dashboard final
- rediseño total de auth
- rediseño completo de reportes o finanzas
- dark mode
- toasts
- búsqueda global
- charts o BI

## Deuda UX restante

- varias pantallas financieras siguen siendo shell/UI mínima;
- persisten términos técnicos visibles en algunos contenidos;
- no existe todavía tabla administrativa reusable;
- dashboard aún es inicial;
- faltan estados visuales más ricos en módulos completos.
