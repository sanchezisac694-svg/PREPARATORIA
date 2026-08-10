import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  Alert,
  AppLink,
  Breadcrumbs,
  Button,
  Card,
  Container,
  DateDisplay,
  EmptyState,
  ErrorState,
  FormActions,
  LoadingIndicator,
  LoadingState,
  MetricCard,
  Money,
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  formatDate,
  formatMoney,
} from "../dist/index.js";

test("renderiza los componentes neutrales con HTML semántico", () => {
  const markup = renderToStaticMarkup(
    createElement(
      Container,
      null,
      createElement(
        Card,
        null,
        createElement(Button, null, "Continuar"),
        createElement(AppLink, { href: "#referencia" }, "Referencia"),
        createElement(Alert, { tone: "info" }, "Información técnica"),
        createElement(LoadingIndicator, { label: "Preparando" }),
      ),
    ),
  );

  assert.match(markup, /<main/);
  assert.match(markup, /<section/);
  assert.match(markup, /<button/);
  assert.match(markup, /<a/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
});

test("el Alert de error utiliza semántica urgente", () => {
  const markup = renderToStaticMarkup(createElement(Alert, { tone: "error" }, "Error"));

  assert.match(markup, /role="alert"/);
  assert.match(markup, /aria-live="assertive"/);
});

test("Button y AppLink soportan variantes sin romper la API base", () => {
  const markup = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(Button, { pending: true, size: "sm", variant: "secondary" }, "Guardar"),
      createElement(AppLink, { href: "/ruta", variant: "button" }, "Ir"),
    ),
  );

  assert.match(markup, /ui-button--secondary/);
  assert.match(markup, /ui-button--pending/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /ui-link--button/);
});

test("formatMoney y Money usan presentación es-MX con MXN", () => {
  assert.equal(formatMoney("0.00"), "$0.00 MXN");
  assert.equal(formatMoney("1.00"), "$1.00 MXN");
  assert.equal(formatMoney("1250.00"), "$1,250.00 MXN");
  assert.equal(formatMoney("9999999999.99"), "$9,999,999,999.99 MXN");
  assert.equal(formatMoney("-25.50"), "$-25.50 MXN");

  const markup = renderToStaticMarkup(createElement(Money, { amount: "1250.00" }));
  assert.match(markup, /\$1,250.00 MXN/);
});

test("formatMoney y Money usan fallback neutral para entradas inválidas", () => {
  assert.equal(formatMoney(""), "—");
  assert.equal(formatMoney("abc"), "—");
  assert.equal(formatMoney("NaN"), "—");
  assert.equal(formatMoney("Infinity"), "—");
  assert.equal(formatMoney("-Infinity"), "—");

  const markup = renderToStaticMarkup(createElement(Money, { amount: "abc" }));
  assert.match(markup, />—</);
});

test("formatDate y DateDisplay muestran fecha en español", () => {
  assert.equal(formatDate("2026-08-10"), "10/08/2026");

  const markup = renderToStaticMarkup(createElement(DateDisplay, { value: "2026-08-10" }));
  assert.match(markup, /10\/08\/2026/);
  assert.match(markup, /dateTime="2026-08-10"/);
});

test("Breadcrumbs, PageHeader y estados reutilizables se renderizan correctamente", () => {
  const markup = renderToStaticMarkup(
    createElement(
      PageContainer,
      null,
      createElement(PageHeader, {
        actions: createElement(Button, { variant: "ghost" }, "Acción"),
        breadcrumbs: createElement(Breadcrumbs, {
          items: [{ href: "/dashboard", label: "Inicio" }, { label: "Finanzas" }],
        }),
        description: "Descripción breve",
        title: "Cobranza",
      }),
      createElement(SectionCard, { description: "Descripción", title: "Sección" }, "Contenido"),
      createElement(MetricCard, { label: "Saldo", value: "$1,250.00 MXN" }),
      createElement(StatusBadge, { tone: "warning" }, "En revisión"),
      createElement(EmptyState, { description: "Nada que mostrar", title: "Sin resultados" }),
      createElement(LoadingState, { title: "Cargando datos" }),
      createElement(ErrorState, { description: "No fue posible continuar", title: "Sin acceso" }),
      createElement(FormActions, {
        primary: createElement(Button, null, "Guardar"),
        secondary: createElement(AppLink, { href: "/volver" }, "Volver"),
      }),
    ),
  );

  assert.match(markup, /aria-label="Breadcrumb"/);
  assert.match(markup, /Cobranza/);
  assert.match(markup, /ui-section-card/);
  assert.match(markup, /ui-metric-card/);
  assert.match(markup, /ui-badge--warning/);
  assert.match(markup, /Sin resultados/);
  assert.match(markup, /Cargando datos/);
  assert.match(markup, /Sin acceso/);
  assert.match(markup, /ui-form-actions/);
});
