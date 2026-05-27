import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import tailwindConfig from "../tailwind.config";
import { buttonVariants } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

test("tailwind semantic colors use Cotizapp green as primary and accent", () => {
  const colors = tailwindConfig.theme?.extend?.colors as
    | Record<string, { DEFAULT?: string; foreground?: string }>
    | undefined;

  assert.equal(colors?.primary?.DEFAULT, "#00E5A0");
  assert.equal(colors?.primary?.foreground, "#000000");
  assert.equal(colors?.accent?.DEFAULT, "#00E5A0");
  assert.equal(colors?.accent?.foreground, "#000000");
});

test("global tokens keep the approved accent across both theme roots", async () => {
  const source = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /--sidebar-bg:\s*#111318;/i);
  assert.match(source, /--header-bg:\s*#111318;/i);
  assert.match(source, /\.light\s*\{[\s\S]*--background:\s*#f0f2f5;/i);
  assert.match(source, /\.light\s*\{[\s\S]*--accent:\s*#00c984;/i);
  assert.match(source, /\.dark\s*\{[\s\S]*--background:\s*#0a0a0f;/i);
  assert.match(source, /\.dark\s*\{[\s\S]*--accent:\s*#00e5a0;/i);
  assert.doesNotMatch(source, /#3b82f6/i);
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
  const defaultButton = buttonVariants({ variant: "default" });
  const inputHtml = renderToStaticMarkup(
    React.createElement(Input, { placeholder: "Buscar producto" }),
  );
  const cardHtml = renderToStaticMarkup(
    React.createElement(Card, null, "Contenido"),
  );

  assert.match(defaultButton, /bg-\[#00E5A0\]/);
  assert.match(defaultButton, /text-\[#000000\]/);
  assert.match(outlineButton, /border-border\/70/);
  assert.match(outlineButton, /bg-background\/80/);
  assert.match(outlineButton, /text-foreground/);
  assert.match(secondaryButton, /border-border\/60/);
  assert.match(secondaryButton, /bg-secondary/);
  assert.match(inputHtml, /bg-\[rgb\(var\(--input-bg-rgb\)\/1\)\]/);
  assert.match(inputHtml, /border-input/);
  assert.match(cardHtml, /border-border\/80/);
  assert.match(cardHtml, /bg-card/);
});
