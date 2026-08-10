import {
  hasPermission,
  permissions,
  roleLabels,
  roles,
  type Permission,
  type Role,
} from "@preparatoria/authz";
import {
  Alert,
  AppLink,
  DateDisplay,
  ErrorState,
  MetricCard,
  Money,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@preparatoria/ui";
import type { FinancialReportSummary } from "@preparatoria/supabase/financial-reports";

import { requireAdminAccess } from "../../lib/auth";
import { getFinancialReportsService } from "../../lib/financial-reports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DashboardLink = Readonly<{
  description: string;
  href: string;
  label: string;
  requiredPermissions?: readonly Permission[];
  requiredRoles?: readonly Role[];
}>;

type DashboardModule = Readonly<{
  description: string;
  links: readonly DashboardLink[];
  title: string;
}>;

type DashboardAction = DashboardLink &
  Readonly<{
    icon: "caja" | "cargos" | "cobranza" | "convenios" | "reporte" | "seguridad";
  }>;

const quickActions = Object.freeze<readonly DashboardAction[]>([
  {
    description: "Registra un pago presencial dentro del flujo autorizado de caja.",
    href: "/caja/cobros/nuevo",
    icon: "caja",
    label: "Nuevo cobro",
    requiredPermissions: [permissions.FINANCE_PAYMENTS_REGISTER],
  },
  {
    description: "Consulta el estado operativo del turno y sus pasos de cierre.",
    href: "/caja/turno",
    icon: "caja",
    label: "Ver turno de caja",
    requiredPermissions: [permissions.FINANCE_CASH_SESSIONS_READ],
  },
  {
    description: "Revisa batches, vistas previas y ejecución controlada de cargos.",
    href: "/finanzas/generacion-cargos",
    icon: "cargos",
    label: "Generar cargos",
    requiredPermissions: [
      permissions.FINANCE_CHARGE_GENERATION_BATCHES_READ,
      permissions.FINANCE_CHARGE_GENERATION_PREVIEW,
    ],
  },
  {
    description: "Da seguimiento a cuentas con saldo vencido y compromisos activos.",
    href: "/finanzas/cobranza/adeudos",
    icon: "cobranza",
    label: "Revisar adeudos",
    requiredPermissions: [
      permissions.FINANCE_COLLECTIONS_CASES_READ,
      permissions.FINANCE_COLLECTIONS_REPORTS_READ,
    ],
  },
  {
    description: "Consulta convenios de pago autorizados y su seguimiento.",
    href: "/finanzas/convenios",
    icon: "convenios",
    label: "Ver convenios",
    requiredPermissions: [permissions.FINANCE_PAYMENT_AGREEMENTS_READ],
  },
  {
    description: "Abre el concentrado financiero para análisis y exportación.",
    href: "/finanzas/reportes/resumen",
    icon: "reporte",
    label: "Consultar reportes",
    requiredPermissions: [permissions.REPORTS_READ, permissions.FINANCE_REPORTS_SUMMARY_READ],
  },
]);

const modules = Object.freeze<readonly DashboardModule[]>([
  {
    description: "Cobro presencial, movimientos, arqueo y cierre del turno.",
    links: [
      {
        description: "Consulta el turno actual.",
        href: "/caja/turno",
        label: "Turno actual",
        requiredPermissions: [permissions.FINANCE_CASH_SESSIONS_READ],
      },
      {
        description: "Registra un nuevo cobro.",
        href: "/caja/cobros/nuevo",
        label: "Nuevo cobro",
        requiredPermissions: [permissions.FINANCE_PAYMENTS_REGISTER],
      },
      {
        description: "Revisa movimientos manuales.",
        href: "/caja/movimientos",
        label: "Movimientos",
        requiredPermissions: [permissions.FINANCE_CASH_MOVEMENTS_CREATE],
      },
      {
        description: "Captura el arqueo del turno.",
        href: "/caja/arqueo",
        label: "Arqueo",
        requiredPermissions: [permissions.FINANCE_CASH_COUNTS_CREATE],
      },
      {
        description: "Avanza al cierre del turno.",
        href: "/caja/cierre",
        label: "Cierre",
        requiredPermissions: [permissions.FINANCE_CASH_SESSIONS_CLOSE],
      },
    ],
    title: "Caja",
  },
  {
    description: "Generación de cargos, cobranza, beneficios, convenios y reportes.",
    links: [
      {
        description: "Consulta la operación de cargos.",
        href: "/finanzas/generacion-cargos",
        label: "Generación de cargos",
        requiredPermissions: [permissions.FINANCE_CHARGE_GENERATION_BATCHES_READ],
      },
      {
        description: "Da seguimiento a casos de cobranza.",
        href: "/finanzas/cobranza",
        label: "Cobranza",
        requiredPermissions: [permissions.FINANCE_COLLECTIONS_CASES_READ],
      },
      {
        description: "Administra becas y descuentos.",
        href: "/finanzas/becas",
        label: "Becas y descuentos",
        requiredPermissions: [permissions.FINANCE_SCHOLARSHIPS_PROGRAMS_MANAGE],
      },
      {
        description: "Consulta convenios de pago.",
        href: "/finanzas/convenios",
        label: "Convenios",
        requiredPermissions: [permissions.FINANCE_PAYMENT_AGREEMENTS_READ],
      },
      {
        description: "Abre los reportes financieros.",
        href: "/finanzas/reportes",
        label: "Reportes",
        requiredPermissions: [permissions.REPORTS_READ],
      },
      {
        description: "Revisa cierres financieros.",
        href: "/finanzas/cierres",
        label: "Cierres",
        requiredPermissions: [permissions.FINANCE_PERIOD_CLOSE_READ],
      },
    ],
    title: "Finanzas",
  },
  {
    description: "Protección de acceso institucional y autenticación reforzada.",
    links: [
      {
        description: "Actualiza tu NIP institucional.",
        href: "/seguridad/cambiar-nip",
        label: "Cambiar NIP",
      },
      {
        description: "Consulta y administra tus factores MFA.",
        href: "/seguridad/mfa",
        label: "MFA",
      },
      {
        description: "Gestiona recuperaciones administrativas de MFA.",
        href: "/seguridad/mfa-recuperaciones",
        label: "Recuperaciones MFA",
        requiredRoles: [roles.SUPERADMIN, roles.ADMINISTRATIVO, roles.CONTROL_ESCOLAR],
      },
    ],
    title: "Seguridad",
  },
]);

function canSeeLink(roleCodes: readonly Role[], item: DashboardLink) {
  const permissionAllowed =
    item.requiredPermissions === undefined ||
    item.requiredPermissions.some((permission) => hasPermission(roleCodes, permission));
  const roleAllowed =
    item.requiredRoles === undefined || item.requiredRoles.some((role) => roleCodes.includes(role));

  return permissionAllowed && roleAllowed;
}

function Icon({
  name,
}: Readonly<{ name: "caja" | "cargos" | "cobranza" | "convenios" | "reporte" | "seguridad" }>) {
  const common = {
    className: "dashboard-action-card__icon",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.75,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "caja":
      return (
        <svg aria-hidden="true" {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 14h4" />
        </svg>
      );
    case "cargos":
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v5h5" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case "cobranza":
      return (
        <svg aria-hidden="true" {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v10" />
          <path d="M9 10.5c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 2-3 2-3 .9-3 2 1.3 2 3 2 3-.9 3-2" />
        </svg>
      );
    case "convenios":
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M8 7h8" />
          <path d="M8 12h8" />
          <path d="M8 17h5" />
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );
    case "reporte":
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-8" />
        </svg>
      );
    case "seguridad":
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M12 3 5 6v5c0 5 3.3 8.7 7 10 3.7-1.3 7-5 7-10V6l-7-3Z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="16" r=".5" fill="currentColor" />
        </svg>
      );
  }
}

function DashboardActionCard({ item }: Readonly<{ item: DashboardAction }>) {
  return (
    <article className="dashboard-action-card">
      <div className="dashboard-action-card__header">
        <Icon name={item.icon} />
        <h3>{item.label}</h3>
      </div>
      <p>{item.description}</p>
      <AppLink href={item.href}>Abrir</AppLink>
    </article>
  );
}

function DashboardModuleCard({
  description,
  links,
  title,
}: Readonly<{
  description: string;
  links: readonly DashboardLink[];
  title: string;
}>) {
  return (
    <article className="dashboard-module-card">
      <div className="dashboard-module-card__header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <ul className="dashboard-module-card__links">
        {links.map((link) => (
          <li key={link.href}>
            <AppLink href={link.href}>{link.label}</AppLink>
            <span>{link.description}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function buildSummaryMetrics(summary: FinancialReportSummary) {
  return [
    {
      description: "Total agregado del periodo visible en el resumen institucional.",
      key: "grossCharges",
      label: "Cargos generados",
      value: <Money amount={summary.grossCharges} />,
    },
    {
      description: "Pagos confirmados menos reversos dentro del mismo corte.",
      key: "netCollections",
      label: "Cobranza neta",
      value: <Money amount={summary.netCollections} />,
    },
    {
      description: "Saldo total todavía pendiente de pago.",
      key: "outstanding",
      label: "Saldo pendiente",
      value: <Money amount={summary.outstanding} />,
    },
    {
      description: "Importe vencido que requiere seguimiento administrativo.",
      key: "overdue",
      label: "Adeudo vencido",
      value: <Money amount={summary.overdue} />,
    },
  ] as const;
}

export default async function Page() {
  const identity = await requireAdminAccess();
  const roleCodes = identity.context.roleCodes;
  const visibleRoleLabels = roleCodes.map((role) => roleLabels[role]);
  const primaryRoleLabel = roleCodes[0] ? roleLabels[roleCodes[0]] : "Sistema Administrativo";

  const visibleQuickActions = quickActions.filter((item) => canSeeLink(roleCodes, item));
  const visibleModules = modules
    .map((module) => ({
      ...module,
      links: module.links.filter((item) => canSeeLink(roleCodes, item)),
    }))
    .filter((module) => module.links.length > 0);

  const canReadFinancialSummary = hasPermission(
    roleCodes,
    permissions.FINANCE_REPORTS_SUMMARY_READ,
  );

  let summary: FinancialReportSummary | null = null;
  if (canReadFinancialSummary) {
    try {
      const reports = await getFinancialReportsService();
      summary = await reports.getSummary();
    } catch {}
  }

  const requiresAttention =
    summary !== null &&
    (Number(summary.overdue) > 0 ||
      Number(summary.outstanding) > 0 ||
      summary.debtorAccountCount > 0);

  return (
    <>
      <PageHeader description="Resumen operativo del Sistema Administrativo." title="Inicio" />

      <SectionCard
        className="dashboard-welcome-card"
        description="Gestiona operaciones escolares, caja, finanzas y seguridad desde un solo lugar."
        title="Sistema Administrativo"
      >
        <div className="dashboard-welcome-card__content">
          <div>
            <p className="dashboard-eyebrow">Buen día</p>
            <p className="dashboard-welcome-card__lead">
              Estás dentro del panel administrativo con acceso a los módulos habilitados para tu
              cuenta.
            </p>
          </div>
          <div className="dashboard-role-summary" aria-label="Contexto de rol">
            <StatusBadge tone="info">{primaryRoleLabel}</StatusBadge>
            {visibleRoleLabels.slice(1).map((role) => (
              <StatusBadge key={role} tone="neutral">
                {role}
              </StatusBadge>
            ))}
            {roleCodes.length > 1 ? (
              <span className="dashboard-role-summary__meta">{`${roleCodes.length} roles activos`}</span>
            ) : null}
            {summary ? (
              <span className="dashboard-role-summary__meta">
                Corte del resumen: <DateDisplay value={summary.businessDate} />
              </span>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {canReadFinancialSummary ? (
        <SectionCard
          description="Indicadores reales reutilizados del resumen financiero institucional."
          title="Métricas operativas"
        >
          {summary ? (
            <>
              <div className="dashboard-metric-grid">
                {buildSummaryMetrics(summary).map((metric) => (
                  <MetricCard
                    description={metric.description}
                    key={metric.key}
                    label={metric.label}
                    value={metric.value}
                  />
                ))}
              </div>
              <div className="dashboard-summary-meta">
                <StatusBadge tone="success">{`${summary.chargeCount} cargos visibles`}</StatusBadge>
                <StatusBadge tone="info">{`${summary.paymentCount} pagos visibles`}</StatusBadge>
                <StatusBadge tone={summary.debtorAccountCount > 0 ? "warning" : "neutral"}>
                  {`${summary.debtorAccountCount} cuentas con adeudo`}
                </StatusBadge>
              </div>
            </>
          ) : (
            <ErrorState
              description="No fue posible cargar el resumen financiero, pero el resto del panel sigue disponible."
              title="Resumen financiero no disponible"
            />
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        description="Atajos a las tareas administrativas más frecuentes según tus permisos."
        title="Accesos rápidos"
      >
        <div className="dashboard-action-grid">
          {visibleQuickActions.map((item) => (
            <DashboardActionCard item={item} key={item.href} />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        description="Navega por las superficies principales disponibles para tu cuenta."
        title="Módulos"
      >
        <div className="dashboard-module-grid">
          {visibleModules.map((module) => (
            <DashboardModuleCard
              description={module.description}
              key={module.title}
              links={module.links}
              title={module.title}
            />
          ))}
        </div>
      </SectionCard>

      {requiresAttention && summary ? (
        <SectionCard
          description="Señales reales derivadas del resumen financiero ya disponible."
          title="Requiere atención"
        >
          <div className="dashboard-attention-grid">
            {Number(summary.overdue) > 0 ? (
              <Alert tone="warning">
                <strong>Adeudo vencido</strong>
                <div>
                  Hay <Money amount={summary.overdue} /> en adeudos vencidos dentro del corte
                  actual.
                </div>
                <div>
                  <AppLink href="/finanzas/cobranza/adeudos">Revisar adeudos</AppLink>
                </div>
              </Alert>
            ) : null}
            {summary.debtorAccountCount > 0 ? (
              <Alert tone="info">
                <strong>Cuentas con seguimiento</strong>
                <div>{`${summary.debtorAccountCount} cuentas muestran saldo pendiente en el resumen visible.`}</div>
                <div>
                  <AppLink href="/finanzas/cobranza">Abrir cobranza</AppLink>
                </div>
              </Alert>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </>
  );
}
