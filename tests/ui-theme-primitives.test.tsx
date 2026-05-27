import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import tailwindConfig from "../tailwind.config";
import { buttonVariants } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

test("tailwind semantic colors map accent interactions to dedicated accent tokens", () => {
  const colors = tailwindConfig.theme?.extend?.colors as
    | Record<string, { DEFAULT?: string; foreground?: string }>
    | undefined;

  assert.equal(
    colors?.primary?.DEFAULT,
    "rgb(var(--accent-rgb) / <alpha-value>)",
  );
  assert.equal(
    colors?.accent?.DEFAULT,
    "rgb(var(--accent-soft-rgb) / <alpha-value>)",
  );
  assert.equal(
    colors?.accent?.foreground,
    "rgb(var(--text-primary-rgb) / <alpha-value>)",
  );
});

test("global tokens keep the approved accent across both theme roots", async () => {
  const source = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /--sidebar-bg:\s*#1a2332;/i);
  assert.match(source, /\.light\s*\{[\s\S]*--background:\s*#f0f4f8;/i);
  assert.match(source, /\.light\s*\{[\s\S]*--accent:\s*#00c984;/i);
  assert.match(source, /\.dark\s*\{[\s\S]*--background:\s*#0f1117;/i);
  assert.match(source, /\.dark\s*\{[\s\S]*--surface:\s*#1a1d27;/i);
});

test("shell backdrop keeps sticky ancestors vertically unclipped", async () => {
  const source = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /\.shell-backdrop\s*\{/);
  assert.doesNotMatch(source, /\.shell-backdrop\s*\{[\s\S]*overflow:\s*hidden;/);
});

test("shared primitives render the updated elevated dark theme classes", () => {
  const outlineButton = buttonVariants({ variant: "outline" });
  const secondaryButton = buttonVariants({ variant: "secondary" });
  const inputHtml = renderToStaticMarkup(
    React.createElement(Input, { placeholder: "Buscar producto" }),
  );
  const cardHtml = renderToStaticMarkup(
    React.createElement(Card, null, "Contenido"),
  );

  assert.match(outlineButton, /border-border\/70/);
  assert.match(outlineButton, /bg-background\/80/);
  assert.match(outlineButton, /text-foreground/);
  assert.match(secondaryButton, /border-border\/60/);
  assert.match(secondaryButton, /bg-secondary/);
  assert.match(inputHtml, /bg-card\/80/);
  assert.match(inputHtml, /border-border\/70/);
  assert.match(cardHtml, /border-border\/80/);
  assert.match(cardHtml, /bg-card\/95/);
});
