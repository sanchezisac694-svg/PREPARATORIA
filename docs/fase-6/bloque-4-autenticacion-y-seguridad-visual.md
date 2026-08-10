# Fase 6 — Bloque 4: autenticación y seguridad visual

## Alcance

Este bloque rediseña visualmente las superficies existentes de autenticación y seguridad del
Sistema Administrativo sin cambiar la arquitectura de Auth, MFA, AAL, `session_version`, RLS,
Server Actions ni contratos de Supabase.

## Inventario auditado

### Rutas públicas sin navegación administrativa visible

- `/login`
- `/login/institucional` (alias por reexport)
- `/mfa/requerido`
- `/mfa/verificar`
- `/acceso-no-disponible`
- `/sin-autorizacion`
- `/sesion-expirada`
- `/estado-cuenta`

### Rutas autenticadas dentro del contexto administrativo

- `/seguridad/mfa`
- `/seguridad/mfa/configurar`
- `/seguridad/cambiar-nip`
- `/seguridad/mfa-recuperaciones`
- `/seguridad/mfa-recuperaciones/nueva`
- `/seguridad/mfa-recuperaciones/[id]`

## AuthShell

Se introduce `apps/sistema-administrativo/app/_auth/auth-shell.tsx` como patrón visual reutilizable
para autenticación pública. Proporciona:

- identidad institucional sobria;
- título y descripción claros;
- panel compacto de formulario;
- ayuda contextual opcional;
- footer mínimo;
- layout responsive de una columna en móvil y dos paneles en escritorio.

No reutiliza `AdminShell` ni muestra sidebar/topbar en login o MFA público.

## Login

`/login` conserva `InstitutionalLoginForm` y `institutionalLoginAction`. El rediseño:

- mantiene identificador institucional, tipo de identificador y NIP;
- usa campos tipados reutilizables (`Field`, `Input`, `Select`, `FormMessage`);
- conserva `autoComplete="username"` y `autoComplete="current-password"`;
- usa estado pending visible en el botón;
- evita términos técnicos crudos en el copy.

## MFA

### `/mfa/requerido`

Explica que se necesita una verificación adicional y ofrece CTA hacia la configuración real
existente.

### `/mfa/verificar`

Conserva `MfaChallengeForm` y `verifyMfaChallengeAction`, usa `one-time-code` y muestra mensajes
claros en español.

### `/seguridad/mfa`

Permanece dentro del contexto administrativo, ahora con:

- `PageHeader`;
- resumen y advertencia contextual;
- estados legibles para factores (`Verificado`, `Pendiente de verificación`);
- CTA real para configurar factor;
- acción real para retirar factor.

### `/seguridad/mfa/configurar`

Conserva `beginMfaEnrollmentAction` y `verifyMfaEnrollmentAction`. Si existe QR real, se muestra con:

- proporción preservada;
- contexto textual;
- clave temporal visible solo en el flujo actual;
- tratamiento visual de dato sensible.

## Cambio de NIP

`/seguridad/cambiar-nip` conserva `changeNipAction`, usa un formulario consistente y mantiene:

- `current-password` para el NIP actual;
- `new-password` para nuevo NIP y confirmación;
- mensajes claros de éxito/error;
- ausencia de filtraciones en URL o copy técnico.

## Recuperaciones MFA

Las rutas administrativas se rediseñan sin inventar un backend de consulta adicional:

- `/seguridad/mfa-recuperaciones`
- `/seguridad/mfa-recuperaciones/nueva`
- `/seguridad/mfa-recuperaciones/[id]`

Se preservan las acciones reales existentes y se presenta el flujo como herramienta sensible de
operación institucional. Cuando no hay datos de lista, la UI declara explícitamente que la vista
actual es mínima y no finge estados inexistentes.

## Estados de acceso

Las pantallas:

- `/acceso-no-disponible`
- `/sin-autorizacion`
- `/sesion-expirada`
- `/estado-cuenta`

usan `AuthShell` + `ErrorState` con copy claro y sin exponer `403`, JWT, AAL, `session_version` o
detalles internos.

`/estado-cuenta` se presenta como estado de acceso de la cuenta para evitar ambigüedad con el estado
de cuenta financiero.

## Componentes introducidos o ampliados

### En `packages/ui`

- `Field`
- `Input`
- `Select`
- `FormMessage`

### Locales del Sistema Administrativo

- `AuthShell`
- `AuthSupportNote`
- `AuthBackHomeLink`
- `SecurityStatusBadge`

## Idioma y copy

Todo el copy visible nuevo se mantiene en español. Se eliminan expresiones crudas como:

- `challenge`
- `factorId`
- `aal`
- `session_version`
- `claim`
- `recovery request`

## Responsive y accesibilidad

- formularios compactos para auth pública;
- focus visible en botones, inputs y selects;
- mensajes de error con `role="alert"` cuando aplica;
- `one-time-code` conservado para MFA;
- QR con texto alternativo útil;
- sin dependencia de modales complejos.

## Datos sensibles

Se evita exponer innecesariamente:

- `factor_id`;
- `auth_user_id`;
- `session_version`;
- claims;
- tokens;
- códigos antiguos;
- secretos persistidos fuera del flujo actual.

La referencia operativa de recuperación MFA puede mostrarse como identificador secundario de trabajo,
pero no desplaza el copy principal ni revela contexto interno adicional.

## Pruebas

Se ajustan pruebas razonables y pequeñas para verificar:

- exclusión visual de rutas públicas respecto al shell administrativo;
- export y uso de `AuthShell`;
- conservación de Server Actions reales;
- copy sin términos técnicos crudos;
- formularios reutilizables;
- estados de acceso claros.

## Límites

- no se modificó backend de Auth/MFA/NIP;
- no se creó recuperación por email, SMS o social login;
- no se agregaron nuevas features de sesión;
- no se tocaron migraciones, RLS ni servicios de Supabase;
- la vista de recuperaciones MFA sigue siendo operativa mínima mientras no exista un servicio de
  consulta más rico aprobado para esta fase.
