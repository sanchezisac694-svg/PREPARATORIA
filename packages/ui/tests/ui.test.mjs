import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Alert, AppLink, Button, Card, Container, LoadingIndicator } from "../dist/index.js";

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
