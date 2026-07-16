# Fase 2 — Bloque 2: contratos de identidad, roles y autorización

## Objetivo

Establecer contratos técnicos únicos y comprobables para identidad institucional, roles, permisos, estados de cuenta y autorización, sin ejecutar autenticación ni acceder a datos.

Referencia funcional: autorización de **Fase 2 — Bloque 2: contratos de identidad, roles y autorización**.

## Modelo de identidad

Una persona posee una sola identidad institucional, compartida por todas las aplicaciones. Una identidad puede acumular varios roles sin duplicar cuentas.

| Identificador | Responsabilidad                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authUserId`  | Identificador futuro y opcional de Supabase Auth. Su presencia no concede permisos.                                                               |
| `personId`    | Identificador institucional obligatorio y único de la persona.                                                                                    |
| `profileId`   | Identificador técnico opcional del perfil institucional, reservado para separar identidad y datos de perfil si el diseño persistente lo requiere. |

Los tres identificadores son tipos nominales distintos para evitar intercambios accidentales. No se definen todavía entidades de alumno, tutor, docente o administrativo.

## Autenticación y autorización

La autenticación responderá en una fase posterior quién controla una cuenta y si existe una sesión válida. Este paquete no autentica.

La autorización responde qué capacidades puede solicitar una identidad ya autenticada, considerando estado, roles, aplicación y permisos. Los resultados no sustituyen las futuras restricciones por propiedad, relación, grupo, materia, persona, recurso o RLS.

## Catálogo de roles

| Rol               | Etiqueta           | Regla inicial                                                                    |
| ----------------- | ------------------ | -------------------------------------------------------------------------------- |
| `SUPERADMIN`      | Superadministrador | Permisos explícitos y futura trazabilidad obligatoria; no existe wildcard.       |
| `ADMINISTRATIVO`  | Administrativo     | Operación institucional general limitada por la matriz.                          |
| `CONTROL_ESCOLAR` | Control escolar    | Capacidades académicas y documentales.                                           |
| `CAJA`            | Caja               | Capacidades financieras autorizadas.                                             |
| `DOCENTE`         | Docente            | Capacidades académicas, asistencia y calificaciones; sin administración general. |
| `TUTOR`           | Tutor              | Lecturas relacionadas con seguimiento y obligaciones autorizadas.                |
| `ALUMNO`          | Alumno             | Lecturas académicas y personales autorizadas.                                    |
| `ASPIRANTE`       | Aspirante          | Seguimiento de admisión antes de una posible conversión a alumno.                |

Tutor y alumno son identidades distintas. Aspirante y alumno son roles distintos. Una identidad puede tener varios roles cuando exista una razón institucional válida.

## Catálogo de permisos

| Área           | Lectura           | Gestión u operación       |
| -------------- | ----------------- | ------------------------- |
| Identidad      | `identity.read`   | `identity.manage`         |
| Roles          | `roles.read`      | `roles.assign`            |
| Admisiones     | `admissions.read` | `admissions.manage`       |
| Académico      | `academics.read`  | `academics.manage`        |
| Asistencia     | `attendance.read` | `attendance.manage`       |
| Calificaciones | `grades.read`     | `grades.manage`           |
| Pagos          | `payments.read`   | `payments.manage`         |
| Documentos     | `documents.read`  | `documents.manage`        |
| Reportes       | `reports.read`    | `reports.export`          |
| Configuración  | `settings.read`   | `settings.manage`         |
| Auditoría      | `audit.read`      | No definida en esta etapa |

No existen `*`, `all`, `admin.*` ni permisos libres.

## Matriz inicial de roles y permisos

| Rol               | Permisos explícitos                                                                                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPERADMIN`      | Los 21 permisos del catálogo, enumerados individualmente                                                                                                                                                                                      |
| `ADMINISTRATIVO`  | `identity.read`, `roles.read`, `admissions.read`, `admissions.manage`, `academics.read`, `payments.read`, `documents.read`, `documents.manage`, `reports.read`, `reports.export`, `settings.read`                                             |
| `CONTROL_ESCOLAR` | `identity.read`, `admissions.read`, `admissions.manage`, `academics.read`, `academics.manage`, `attendance.read`, `attendance.manage`, `grades.read`, `grades.manage`, `documents.read`, `documents.manage`, `reports.read`, `reports.export` |
| `CAJA`            | `identity.read`, `admissions.read`, `payments.read`, `payments.manage`, `reports.read`                                                                                                                                                        |
| `DOCENTE`         | `academics.read`, `attendance.read`, `attendance.manage`, `grades.read`, `grades.manage`, `documents.read`                                                                                                                                    |
| `TUTOR`           | `academics.read`, `attendance.read`, `grades.read`, `payments.read`, `documents.read`                                                                                                                                                         |
| `ALUMNO`          | `academics.read`, `attendance.read`, `grades.read`, `payments.read`, `documents.read`                                                                                                                                                         |
| `ASPIRANTE`       | `admissions.read`, `payments.read`, `documents.read`                                                                                                                                                                                          |

La matriz es una puerta provisional de capacidad general y no debe interpretarse como acceso global. Por ejemplo, `grades.read` no concede lectura de todas las calificaciones: el alcance por propiedad, relación, grupo, materia, persona y recurso deberá imponerse posteriormente en adaptadores, servicios y políticas RLS.

## Acceso por aplicación

| Aplicación               | Roles iniciales                                           |
| ------------------------ | --------------------------------------------------------- |
| `PORTAL_ESCOLAR`         | `ASPIRANTE`, `ALUMNO`, `TUTOR`, `DOCENTE`                 |
| `SISTEMA_ADMINISTRATIVO` | `SUPERADMIN`, `ADMINISTRATIVO`, `CONTROL_ESCOLAR`, `CAJA` |

Una persona con múltiples roles puede acceder cuando al menos uno pertenece al catálogo de la aplicación. `DOCENTE` no permite acceso administrativo general.

## Estados de cuenta y transiciones

| Estado actual        | Estados siguientes permitidos      |
| -------------------- | ---------------------------------- |
| `PENDING_INVITATION` | `PENDING_ACTIVATION`, `DISABLED`   |
| `PENDING_ACTIVATION` | `ACTIVE`, `DISABLED`               |
| `ACTIVE`             | `SUSPENDED`, `BLOCKED`, `DISABLED` |
| `SUSPENDED`          | `ACTIVE`, `BLOCKED`, `DISABLED`    |
| `BLOCKED`            | `ACTIVE`, `DISABLED`               |
| `DISABLED`           | Ninguno                            |

No se permiten transiciones al mismo estado ni saltos arbitrarios. Solo una cuenta `ACTIVE` puede recibir una decisión positiva de `evaluateAccess`.

## APIs públicas

| API                          | Responsabilidad                                                               |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `hasRole`                    | Comprobar un rol exacto.                                                      |
| `hasAnyRole`                 | Comprobar si existe al menos uno de varios roles.                             |
| `hasPermission`              | Comprobar una capacidad derivada de uno o varios roles.                       |
| `hasAnyPermission`           | Comprobar si existe al menos una capacidad solicitada.                        |
| `canAccessApplication`       | Evaluar acceso inicial según roles y aplicación.                              |
| `canTransitionAccountStatus` | Validar una transición tipada.                                                |
| `evaluateAccess`             | Evaluar estado, aplicación, roles requeridos y todos los permisos requeridos. |
| `isRole`                     | Validar de forma segura un rol recibido como `unknown`.                       |
| `isPermission`               | Validar de forma segura un permiso recibido como `unknown`.                   |
| `isApplication`              | Validar de forma segura una aplicación recibida como `unknown`.               |
| `isAccountStatus`            | Validar de forma segura un estado recibido como `unknown`.                    |

`AccessDecision` devuelve razones estables: `AUTHORIZED`, `INVALID_AUTHORIZATION_CONTEXT`, `ACCOUNT_NOT_ACTIVE`, `APPLICATION_ACCESS_DENIED`, `REQUIRED_ROLE_MISSING` y `REQUIRED_PERMISSION_MISSING`. Las denegaciones solo incluyen roles o permisos técnicos faltantes; no contienen información personal.

Los validadores aceptan `unknown`, no lanzan excepciones y devuelven `false` para valores ajenos al catálogo. Las funciones públicas conservan overloads tipados para uso interno y responden de forma segura ante conjuntos o valores externos inválidos. `evaluateAccess` devuelve `INVALID_AUTHORIZATION_CONTEXT` cuando la estructura externa no puede validarse.

## Pruebas

Se comprueban catálogos cerrados, ausencia de wildcards y strings libres, matriz explícita, conjuntos vacíos, roles duplicados, personas con uno o varios roles, accesos por aplicación, ausencia de escalamiento implícito, transiciones válidas e inválidas, catálogo exacto de estados, diferencia entre bloqueo y suspensión, razones estables, determinismo y denegación segura ante entradas `unknown`.

Una prueba negativa de TypeScript compila un fixture temporal fuera del repositorio y exige tres errores `TS2322` específicos para demostrar que `AuthUserId`, `PersonId` y `ProfileId` no son intercambiables. El fixture se elimina mediante `finally`.

La ausencia de ciclos no se afirma como prueba unitaria de `authz`: se verifica mediante la puerta global `.github/scripts/check-boundaries.mjs`, que analiza el grafo completo del monorepo. Las pruebas del paquete verifican además que su única dependencia sea `@preparatoria/config` y que no existan referencias a Supabase, Next.js, React, UI o aplicaciones.

## Riesgos y limitaciones

- La matriz todavía no ha sido validada institucionalmente.
- Los permisos no representan por sí solos propiedad, relación o alcance de datos.
- `reports.read`, `documents.read`, `documents.manage`, `payments.read`, `admissions.read` y `admissions.manage` son capacidades generales provisionales cuya amplitud debe validarse.
- `SUPERADMIN` conserva un conjunto amplio pero explícito; cada uso futuro deberá producir trazabilidad.
- La existencia de un rol no sustituye una cuenta activa ni una sesión futura válida.
- El paquete no conoce datos persistentes y no puede comprobar relaciones entre personas.
- Las identidades con múltiples roles acumulan capacidades; esta composición requerirá trazabilidad y validación institucional.

## Decisiones pendientes de validación institucional

- Alcance definitivo de cada rol.
- Facultades exactas de `SUPERADMIN`.
- Posible acceso futuro de `DOCENTE` a módulos administrativos limitados.
- Responsables autorizados para asignar o retirar roles.
- Proceso formal de suspensión, bloqueo, reactivación y desactivación.
- Amplitud definitiva de `reports.read`.
- Amplitud definitiva de `documents.read` y `documents.manage`.
- Alcance definitivo de `payments.read`.
- Alcance definitivo de `admissions.read` y `admissions.manage`.
- Autoridad y proceso necesarios para `BLOCKED → ACTIVE`.
- Autoridad y proceso necesarios para `SUSPENDED → BLOCKED`.
- Tratamiento de privilegios acumulativos en identidades con múltiples roles.

La matriz completa de `CAJA`, `ASPIRANTE`, `TUTOR`, `ALUMNO`, `DOCENTE`, `CONTROL_ESCOLAR`, `ADMINISTRATIVO` y `SUPERADMIN` requiere validación institucional definitiva antes de utilizarse para acceso real.

Estas decisiones permanecen abiertas y no deben resolverse mediante suposiciones.

## Funciones no implementadas

- Sin login, registro, recuperación de contraseña o sesiones.
- Sin usuarios, invitaciones o asignaciones reales.
- Sin middleware, proxy o dashboards.
- Sin Supabase, tablas, migraciones, SQL o RLS.
- Sin módulos escolares ni operaciones asociadas a los permisos.

## Estrategia de reversión

Eliminar `packages/authz`, este documento y la entrada generada del workspace en `pnpm-lock.yaml`. No existen usuarios, sesiones, datos o infraestructura que revertir.
