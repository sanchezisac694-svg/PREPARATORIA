import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el shell administrativo centraliza navegación, contexto y exclusiones públicas", async () => {
  const [layout, shell, navigation, dashboard, globals] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_admin/admin-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_admin/navigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /AdminShell/);
  assert.match(layout, /logoutAction/);
  assert.match(layout, /roleCodes/);
  assert.match(shell, /aria-label="Secciones administrativas"/);
  assert.match(shell, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(shell, /aria-controls="admin-navigation-drawer"/);
  assert.match(shell, /aria-expanded=\{drawerOpen\}/);
  assert.match(shell, /Breadcrumbs/);
  assert.match(shell, /hasAnyPermission/);
  assert.match(navigation, /Generación de cargos/);
  assert.match(navigation, /Recuperaciones MFA/);
  assert.match(navigation, /Control escolar/);
  assert.match(navigation, /\/control-escolar\/alumnos/);
  assert.match(navigation, /isPublicAdminPath/);
  assert.doesNotMatch(navigation, /Docentes|Configuración/);
  assert.match(dashboard, /PageHeader/);
  assert.match(dashboard, /StatusBadge/);
  assert.match(globals, /admin-shell__sidebar/);
  assert.match(globals, /control-school-metric-grid/);
  assert.match(globals, /@media \(min-width: 1024px\)/);
});

test("la navegación global permanece en español y evita términos técnicos crudos", async () => {
  const navigation = await readFile(
    new URL("../app/_admin/navigation.ts", import.meta.url),
    "utf8",
  );

  assert.match(navigation, /"Inicio"/);
  assert.match(navigation, /"Control escolar"/);
  assert.match(navigation, /"Caja"/);
  assert.match(navigation, /"Finanzas"/);
  assert.match(navigation, /"Seguridad"/);
  assert.doesNotMatch(navigation, /waiver|aging|ledger|allocation|snapshot/i);
  assert.doesNotMatch(navigation, /pathname === "\/"\s*\|\|\s*pathname\.startsWith\("\/login"\)/);
  assert.doesNotMatch(
    navigation,
    /pathname\.startsWith\("\/seguridad\/mfa"\)\s*\|\|\s*pathname\.startsWith\("\/mfa\/verificar"\)/,
  );
  assert.match(navigation, /pathname === "\/seguridad\/mfa"/);
  assert.match(navigation, /pathname\.startsWith\("\/seguridad\/mfa\/"\)/);
});

test("el drawer móvil se puede cerrar con Escape y no queda focusable al estar oculto", async () => {
  const [shell, globals] = await Promise.all([
    readFile(new URL("../app/_admin/admin-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(shell, /event\.key === "Escape"/);
  assert.match(globals, /visibility: hidden;/);
  assert.match(globals, /pointer-events: none;/);
});
