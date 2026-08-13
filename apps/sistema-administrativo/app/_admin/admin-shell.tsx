"use client";

import { hasAnyPermission, type Role } from "@preparatoria/authz";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppLink, Breadcrumbs, Button, PageContainer, StatusBadge } from "@preparatoria/ui";
import { usePathname } from "next/navigation";

import {
  adminNavGroups,
  adminNavigation,
  findActiveAdminNav,
  getAdminBreadcrumbs,
  getAdminPageCopy,
  getRoleDisplayName,
  isPublicAdminPath,
} from "./navigation";

type RoleCode = Role | "PREFECTURA";

type AdminShellProps = Readonly<{
  children: ReactNode;
  logoutAction: (formData: FormData) => void | Promise<void>;
  userSummary: {
    readonly primaryRole: RoleCode | null;
    readonly roleCount: number;
    readonly roleCodes: readonly RoleCode[];
  } | null;
}>;

function Icon({ name }: Readonly<{ name: (typeof adminNavigation)[number]["icon"] }>) {
  const common = {
    className: "admin-shell__icon",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.75,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "inicio":
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
        </svg>
      );
    case "academico":
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
          <path d="M7 11.5V15c0 1.7 2.2 3 5 3s5-1.3 5-3v-3.5" />
          <path d="M21 9v6" />
        </svg>
      );
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
    case "cierre":
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M8 6h8" />
          <path d="M7 3h10v4H7z" />
          <path d="M7 10h10v11H7z" />
          <path d="m10 15 2 2 4-4" />
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

export function AdminShell({ children, logoutAction, userSummary }: AdminShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const publicPath = isPublicAdminPath(pathname);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  const groupedNavigation = useMemo(() => {
    const roles = userSummary?.roleCodes ?? [];

    return Object.entries(adminNavGroups)
      .map(([group, label]) => ({
        items: adminNavigation.filter((item) => {
          if (item.group !== group) {
            return false;
          }

          if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
            return true;
          }

          return hasAnyPermission(roles, item.requiredPermissions);
        }),
        key: group,
        label,
      }))
      .filter((group) => group.items.length > 0);
  }, [userSummary?.roleCodes]);

  if (publicPath) {
    return <>{children}</>;
  }

  const breadcrumbs = getAdminBreadcrumbs(pathname);
  const page = getAdminPageCopy(pathname);
  const active = findActiveAdminNav(pathname);
  const roleLabel = userSummary?.primaryRole ? getRoleDisplayName(userSummary.primaryRole) : null;

  return (
    <div className="admin-shell">
      <aside
        aria-label="Navegación principal"
        className={`admin-shell__sidebar ${drawerOpen ? "admin-shell__sidebar--open" : ""}`}
        id="admin-navigation-drawer"
      >
        <div className="admin-shell__brand">
          <span className="admin-shell__brand-mark">SP</span>
          <div>
            <strong>Sistema Administrativo</strong>
            <p>Backoffice institucional</p>
          </div>
        </div>

        <nav aria-label="Secciones administrativas" className="admin-shell__nav">
          {groupedNavigation.map((group) => (
            <section className="admin-shell__nav-group" key={group.key}>
              <h2>{group.label}</h2>
              <ul>
                {group.items.map((item) => {
                  const isActive = item.match
                    ? item.match(pathname)
                    : pathname.startsWith(item.href);

                  return (
                    <li key={item.href}>
                      <AppLink
                        aria-current={isActive ? "page" : undefined}
                        className={`admin-shell__nav-link ${isActive ? "admin-shell__nav-link--active" : ""}`}
                        href={item.href}
                        variant="muted"
                      >
                        <Icon name={item.icon} />
                        <span>{item.label}</span>
                      </AppLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </aside>

      {drawerOpen ? (
        <button
          aria-label="Cerrar menú"
          className="admin-shell__backdrop"
          onClick={() => setDrawerOpen(false)}
          type="button"
        />
      ) : null}

      <div className="admin-shell__body">
        <header className="admin-shell__topbar">
          <div className="admin-shell__topbar-main">
            <Button
              aria-controls="admin-navigation-drawer"
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? "Cerrar navegación" : "Abrir navegación"}
              className="admin-shell__menu-button"
              onClick={() => setDrawerOpen((value) => !value)}
              size="sm"
              variant="ghost"
            >
              <span aria-hidden="true">☰</span>
            </Button>
            <div>
              <Breadcrumbs items={breadcrumbs} />
              <div className="admin-shell__topbar-copy">
                <strong>{page.title}</strong>
                {active ? <span>{page.description}</span> : null}
              </div>
            </div>
          </div>

          <div className="admin-shell__topbar-actions">
            {roleLabel ? <StatusBadge tone="info">{roleLabel}</StatusBadge> : null}
            {userSummary?.roleCount && userSummary.roleCount > 1 ? (
              <StatusBadge tone="neutral">{`${userSummary.roleCount} roles`}</StatusBadge>
            ) : null}
            <form action={logoutAction}>
              <Button size="sm" variant="secondary">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </header>

        <main className="admin-shell__main">
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
    </div>
  );
}
