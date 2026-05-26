import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Profile } from "../types";
import {
  BusinessIdentity,
  getBusinessInitials,
} from "../components/layout/business-identity";
import { resolveDashboardBranding } from "../lib/dashboard-branding";

function treeContainsElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => treeContainsElement(child, predicate));
  }

  if (!React.isValidElement(node)) {
    return false;
  }

  if (predicate(node)) {
    return true;
  }

  const props = node.props as { children?: React.ReactNode };
  return treeContainsElement(props.children, predicate);
}

test("resolveDashboardBranding returns a signed logo URL for dashboard surfaces", async () => {
  const calls: string[] = [];
  const profile = {
    business_name: "Corralon Centro",
    logo_url: "logos/user-1/logo.png",
  } as Profile;

  const result = await resolveDashboardBranding(profile, async (logoPath) => {
    calls.push(logoPath ?? "");

    return {
      logoPath: logoPath ?? "",
      previewUrl: "https://signed.example.com/logo.png",
    };
  });

  assert.deepEqual(calls, ["logos/user-1/logo.png"]);
  assert.deepEqual(result, {
    businessName: "Corralon Centro",
    logoUrl: "https://signed.example.com/logo.png",
  });
});

test("resolveDashboardBranding falls back to no logo when signing fails", async () => {
  const profile = {
    business_name: "Corralon Centro",
    logo_url: "logos/user-1/logo.png",
  } as Profile;

  const result = await resolveDashboardBranding(profile, async () => null);

  assert.deepEqual(result, {
    businessName: "Corralon Centro",
    logoUrl: null,
  });
});

test("getBusinessInitials builds a compact fallback from the business name", () => {
  assert.equal(getBusinessInitials("Corralon Centro"), "CC");
  assert.equal(getBusinessInitials("Pro Mat Mendoza"), "PM");
  assert.equal(getBusinessInitials(""), "TN");
});

test("BusinessIdentity renders the signed logo when one is available", () => {
  const element = BusinessIdentity({
    businessName: "Corralon Centro",
    logoUrl: "https://signed.example.com/logo.png",
    subtitle: "Panel principal",
  });
  const html = renderToStaticMarkup(element);

  assert.equal(
    treeContainsElement(element, (treeElement) => {
      const props = treeElement.props as { src?: string; alt?: string };

      return (
        props.src === "https://signed.example.com/logo.png" &&
        props.alt === "Logo de Corralon Centro"
      );
    }),
    true,
  );
  assert.match(html, /Corralon Centro/);
  assert.match(html, /Panel principal/);
});

test("BusinessIdentity renders initials when there is no logo URL", () => {
  const html = renderToStaticMarkup(
    React.createElement(BusinessIdentity, {
      businessName: "Corralon Centro",
      logoUrl: null,
    }),
  );

  assert.match(html, /Corralon Centro/);
  assert.match(html, />CC</);
  assert.doesNotMatch(html, /https:\/\/signed\.example\.com\/logo\.png/);
});
