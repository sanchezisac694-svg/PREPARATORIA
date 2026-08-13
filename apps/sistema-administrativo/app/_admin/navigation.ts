import { permissions, type Permission, type Role } from "@preparatoria/authz";

export type AdminNavGroupKey = "caja" | "control_escolar" | "finanzas" | "inicio" | "seguridad";

export type AdminNavItem = Readonly<{
  description?: string;
  group: AdminNavGroupKey;
  href: string;
  icon:
    | "academico"
    | "caja"
    | "cargos"
    | "cierre"
    | "cobranza"
    | "convenios"
    | "inicio"
    | "reporte"
    | "seguridad";
  label: string;
  match?: (pathname: string) => boolean;
  requiredPermissions?: readonly Permission[];
  shortLabel?: string;
}>;

export const adminNavGroups = Object.freeze({
  caja: "Caja",
  control_escolar: "Control escolar",
  finanzas: "Finanzas",
  inicio: "Inicio",
  seguridad: "Seguridad",
} as const satisfies Record<AdminNavGroupKey, string>);

export const adminNavigation = Object.freeze<readonly AdminNavItem[]>([
  {
    description: "Resumen inicial del backoffice",
    group: "inicio",
    href: "/dashboard",
    icon: "inicio",
    label: "Inicio",
    match: (pathname) => pathname === "/" || pathname === "/inicio" || pathname === "/dashboard",
  },
  {
    description: "Consulta administrativa de alumnado e historial visible.",
    group: "control_escolar",
    href: "/control-escolar/alumnos",
    icon: "academico",
    label: "Alumnos",
    match: (pathname) => pathname.startsWith("/control-escolar/alumnos"),
    requiredPermissions: [permissions.ACADEMIC_STUDENTS_READ],
  },
  {
    description: "Consulta grupos, alumnado asignado y horario visible.",
    group: "control_escolar",
    href: "/control-escolar/grupos",
    icon: "academico",
    label: "Grupos",
    match: (pathname) => pathname.startsWith("/control-escolar/grupos"),
    requiredPermissions: [permissions.ACADEMIC_GROUPS_READ],
  },
  {
    description: "Consulta inscripciones administrativas con filtros reales.",
    group: "control_escolar",
    href: "/control-escolar/inscripciones",
    icon: "academico",
    label: "Inscripciones",
    match: (pathname) => pathname.startsWith("/control-escolar/inscripciones"),
    requiredPermissions: [permissions.ACADEMIC_ENROLLMENTS_READ],
  },
  {
    description: "Consulta calificaciones, resultados, ventanas y correcciones autorizadas.",
    group: "control_escolar",
    href: "/control-escolar/calificaciones",
    icon: "academico",
    label: "Calificaciones",
    match: (pathname) => pathname.startsWith("/control-escolar/calificaciones"),
    requiredPermissions: [
      permissions.ACADEMIC_GRADES_READ,
      permissions.ACADEMIC_GRADES_CAPTURE,
      permissions.ACADEMIC_GRADES_REVIEW,
      permissions.ACADEMIC_GRADES_FINALIZE,
      permissions.ACADEMIC_GRADES_CORRECT,
      permissions.ACADEMIC_GRADE_WINDOWS_MANAGE,
      permissions.ACADEMIC_SUBJECT_RESULTS_READ,
    ],
  },
  {
    description: "Consulta la estructura académica consolidada.",
    group: "control_escolar",
    href: "/control-escolar/estructura",
    icon: "academico",
    label: "Estructura académica",
    match: (pathname) => pathname.startsWith("/control-escolar/estructura"),
    requiredPermissions: [
      permissions.ACADEMIC_PERIODS_READ,
      permissions.ACADEMIC_PLANS_READ,
      permissions.ACADEMIC_SUBJECTS_READ,
      permissions.ACADEMIC_GROUPS_READ,
    ],
  },
  {
    group: "caja",
    href: "/caja/turno",
    icon: "caja",
    label: "Turno",
    match: (pathname) => pathname === "/caja" || pathname.startsWith("/caja/turno"),
  },
  {
    group: "caja",
    href: "/caja/cobros/nuevo",
    icon: "caja",
    label: "Nuevo cobro",
    match: (pathname) => pathname.startsWith("/caja/cobros"),
  },
  {
    group: "caja",
    href: "/caja/movimientos",
    icon: "caja",
    label: "Movimientos",
    match: (pathname) => pathname.startsWith("/caja/movimientos"),
  },
  {
    group: "caja",
    href: "/caja/arqueo",
    icon: "caja",
    label: "Arqueo",
    match: (pathname) => pathname.startsWith("/caja/arqueo"),
  },
  {
    group: "caja",
    href: "/caja/cierre",
    icon: "cierre",
    label: "Cierre",
    match: (pathname) => pathname.startsWith("/caja/cierre"),
  },
  {
    group: "finanzas",
    href: "/finanzas/generacion-cargos",
    icon: "cargos",
    label: "Generación de cargos",
    match: (pathname) => pathname.startsWith("/finanzas/generacion-cargos"),
  },
  {
    group: "finanzas",
    href: "/finanzas/cobranza",
    icon: "cobranza",
    label: "Cobranza",
    match: (pathname) => pathname.startsWith("/finanzas/cobranza"),
  },
  {
    group: "finanzas",
    href: "/finanzas/becas",
    icon: "reporte",
    label: "Becas y descuentos",
    match: (pathname) =>
      pathname.startsWith("/finanzas/becas") || pathname.startsWith("/finanzas/descuentos"),
  },
  {
    group: "finanzas",
    href: "/finanzas/convenios",
    icon: "convenios",
    label: "Convenios",
    match: (pathname) => pathname.startsWith("/finanzas/convenios"),
  },
  {
    group: "finanzas",
    href: "/finanzas/reportes",
    icon: "reporte",
    label: "Reportes",
    match: (pathname) => pathname.startsWith("/finanzas/reportes"),
  },
  {
    group: "finanzas",
    href: "/finanzas/cierres",
    icon: "cierre",
    label: "Cierres",
    match: (pathname) => pathname.startsWith("/finanzas/cierres"),
  },
  {
    group: "seguridad",
    href: "/seguridad/cambiar-nip",
    icon: "seguridad",
    label: "Cambiar NIP",
    match: (pathname) => pathname.startsWith("/seguridad/cambiar-nip"),
  },
  {
    group: "seguridad",
    href: "/seguridad/mfa",
    icon: "seguridad",
    label: "MFA",
    match: (pathname) =>
      pathname === "/seguridad/mfa" ||
      pathname.startsWith("/seguridad/mfa/") ||
      pathname.startsWith("/mfa/verificar") ||
      pathname.startsWith("/mfa/requerido"),
  },
  {
    group: "seguridad",
    href: "/seguridad/mfa-recuperaciones",
    icon: "seguridad",
    label: "Recuperaciones MFA",
    match: (pathname) => pathname.startsWith("/seguridad/mfa-recuperaciones"),
  },
]);

export function isPublicAdminPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname === "/acceso-no-disponible" ||
    pathname === "/estado-cuenta" ||
    pathname === "/sesion-expirada" ||
    pathname === "/sin-autorizacion" ||
    pathname.startsWith("/mfa/requerido") ||
    pathname.startsWith("/mfa/verificar")
  );
}

export function findActiveAdminNav(pathname: string) {
  return (
    adminNavigation.find((item) =>
      item.match ? item.match(pathname) : pathname.startsWith(item.href),
    ) ?? null
  );
}

export function getAdminBreadcrumbs(pathname: string) {
  const active = findActiveAdminNav(pathname);
  if (active === null) {
    return [{ href: "/dashboard", label: "Inicio" }] as const;
  }

  const groupLabel = adminNavGroups[active.group];
  return active.group === "inicio"
    ? ([{ href: "/dashboard", label: "Inicio" }] as const)
    : ([
        { href: "/dashboard", label: "Inicio" },
        { href: active.href, label: groupLabel },
        { label: active.label },
      ] as const);
}

export function getAdminPageCopy(pathname: string) {
  const active = findActiveAdminNav(pathname);
  if (active === null) {
    return {
      description: "Backoffice institucional con acceso seguro a los módulos disponibles.",
      title: "Sistema Administrativo",
    } as const;
  }

  const descriptions: Record<string, string> = {
    Alumnos: "Consulta alumnado, trayectoria visible y estado institucional actual.",
    "Becas y descuentos":
      "Administra beneficios financieros con contexto y lenguaje administrativo.",
    Calificaciones:
      "Consulta offerings, captura por unidad y revisa resultados usando el contrato público de calificaciones.",
    Arqueo: "Revisa conteos, diferencias y conciliación con una vista más usable.",
    Cierre: "Consulta y opera el cierre de turnos con mejor contexto visual.",
    Cierres:
      "Consulta cierres operativos financieros y su historial dentro del shell administrativo.",
    Cobranza: "Consulta y da seguimiento administrativo a cuentas con adeudo.",
    Convenios: "Consulta y prepara convenios de pago dentro de una navegación consistente.",
    "Estructura académica":
      "Consulta ciclos, periodos, planes, materias y grupos sin exponer detalles técnicos.",
    "Generación de cargos":
      "Coordina la generación institucional de cargos con navegación y contexto unificados.",
    Grupos: "Consulta grupos, horario y asignaciones visibles de Control Escolar.",
    Inicio: "Accede rápidamente a los módulos administrativos disponibles.",
    Inscripciones: "Consulta inscripciones visibles con filtros y paginación reales.",
    MFA: "Administra autenticación reforzada y pasos de verificación.",
    Movimientos: "Registra movimientos manuales autorizados con mejor contexto operativo.",
    "Nuevo cobro": "Prepara el flujo de cobro presencial dentro del shell administrativo.",
    Reportes: "Consulta reportes financieros con una navegación centralizada y en español.",
    "Recuperaciones MFA": "Gestiona solicitudes administrativas de recuperación MFA.",
    Turno: "Consulta el estado operativo del turno de caja.",
    "Cambiar NIP": "Actualiza tu NIP institucional desde una vista protegida y consistente.",
  };

  return {
    description:
      descriptions[active.label] ??
      "Consulta esta sección dentro del shell administrativo unificado.",
    title: active.label,
  } as const;
}

export function getRoleDisplayName(role: Role) {
  const labels: Record<Role, string> = {
    ADMINISTRATIVO: "Administrativo",
    ALUMNO: "Alumno",
    ASPIRANTE: "Aspirante",
    CAJA: "Caja",
    CONTROL_ESCOLAR: "Control escolar",
    DOCENTE: "Docente",
    PREFECTURA: "Prefectura",
    SUPERADMIN: "Superadministración",
    TUTOR: "Tutor",
  };

  return labels[role];
}
