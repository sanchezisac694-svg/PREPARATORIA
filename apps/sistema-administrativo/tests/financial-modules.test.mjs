import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("los adapters financieros app-side permanecen server-only y envuelven contratos existentes", async () => {
  const [runtime, cash, collections, generation, benefits, agreements] = await Promise.all([
    readFile(new URL("../lib/financial-runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/cash-register.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/collections.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/charge-generation.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/financial-benefits.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payment-agreements.ts", import.meta.url), "utf8"),
  ]);

  assert.match(runtime, /createServerClient/);
  assert.match(cash, /import "server-only"/);
  assert.match(collections, /import "server-only"/);
  assert.match(generation, /import "server-only"/);
  assert.match(benefits, /import "server-only"/);
  assert.match(agreements, /import "server-only"/);

  assert.match(cash, /@preparatoria\/supabase\/cash-register/);
  assert.match(collections, /@preparatoria\/supabase\/collections/);
  assert.match(generation, /@preparatoria\/supabase\/charge-generation/);
  assert.match(benefits, /@preparatoria\/supabase\/financial-benefits/);
  assert.match(agreements, /@preparatoria\/supabase\/payment-agreements/);

  assert.doesNotMatch(
    cash + collections + generation + benefits + agreements,
    /from\(|select \*|insert into|update .* set|delete from/gi,
  );
});

test("las acciones y pantallas financieras mantienen copy administrativo y no exponen términos crudos", async () => {
  const [
    cashActions,
    collectionActions,
    generationActions,
    benefitActions,
    agreementActions,
    cashPage,
    overduePage,
    generationPage,
    discountsPage,
    agreementsPage,
  ] = await Promise.all([
    readFile(new URL("../app/caja/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/finanzas/cobranza/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/finanzas/generacion-cargos/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/finanzas/becas/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/finanzas/convenios/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/caja/cobros/nuevo/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/finanzas/cobranza/adeudos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/finanzas/generacion-cargos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/finanzas/descuentos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/finanzas/convenios/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(cashActions, /getCashRegisterAdapter/);
  assert.match(collectionActions, /getCollectionsAdapter/);
  assert.match(generationActions, /getChargeGenerationAdapter/);
  assert.match(benefitActions, /getFinancialBenefitsAdapter/);
  assert.match(agreementActions, /getPaymentAgreementsAdapter/);

  assert.match(cashPage, /Nuevo cobro presencial|Registrar cobro/i);
  assert.match(overduePage, /Adeudo vencido|Saldo pendiente/i);
  assert.match(generationPage, /Preview obligatorio|vista previa/i);
  assert.match(discountsPage, /Condonaci/i);
  assert.match(agreementsPage, /Parcialidades/i);

  const visiblePages =
    cashPage +
    "\n" +
    overduePage +
    "\n" +
    generationPage +
    "\n" +
    discountsPage +
    "\n" +
    agreementsPage;
  assert.doesNotMatch(visiblePages, /\ballocation\b|\baging\b|\bwaiver\b|\binstallments\b/gi);
});
