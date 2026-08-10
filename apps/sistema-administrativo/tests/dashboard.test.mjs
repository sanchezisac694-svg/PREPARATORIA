import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el dashboard usa servicios reales, formato compartido y copy administrativo en español", async () => {
  const page = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(page, /PageHeader/);
  assert.match(page, /getFinancialReportsService/);
  assert.match(page, /requireAdminAccess/);
  assert.match(page, /Money/);
  assert.match(page, /DateDisplay/);
  assert.match(page, /StatusBadge/);
  assert.match(page, /title="Inicio"/);
  assert.match(page, /Resumen operativo del Sistema Administrativo\./);
  assert.match(page, /Cargos generados/);
  assert.match(page, /Cobranza neta/);
  assert.match(page, /Saldo pendiente/);
  assert.match(page, /Adeudo vencido/);
  assert.doesNotMatch(page, /Gross charges|Net collections|Outstanding|Overdue|Benefits/);
  assert.doesNotMatch(page, /"use client"/);
});

test("el dashboard publica accesos rápidos y módulos solo con rutas reales", async () => {
  const page = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(page, /\/caja\/cobros\/nuevo/);
  assert.match(page, /\/caja\/turno/);
  assert.match(page, /\/finanzas\/generacion-cargos/);
  assert.match(page, /\/finanzas\/cobranza\/adeudos/);
  assert.match(page, /\/finanzas\/convenios/);
  assert.match(page, /\/finanzas\/reportes\/resumen/);
  assert.match(page, /\/seguridad\/cambiar-nip/);
  assert.match(page, /\/seguridad\/mfa/);
  assert.match(page, /\/seguridad\/mfa-recuperaciones/);
  assert.match(page, /title: "Caja"/);
  assert.match(page, /title: "Finanzas"/);
  assert.match(page, /title: "Seguridad"/);
});

test("la documentación del bloque 3 refleja servicios, métricas y límites reales", async () => {
  const doc = await readFile(
    new URL("../../../docs/fase-6/bloque-3-dashboard-administrativo.md", import.meta.url),
    "utf8",
  );

  assert.match(doc, /dashboard administrativo/i);
  assert.match(doc, /getFinancialReportsService/);
  assert.match(doc, /getSummary/);
  assert.match(doc, /Cargos generados/);
  assert.match(doc, /Cobranza neta/);
  assert.match(doc, /Saldo pendiente/);
  assert.match(doc, /Adeudo vencido/);
  assert.match(doc, /no crea migraciones/i);
  assert.match(doc, /permission-aware/i);
});
