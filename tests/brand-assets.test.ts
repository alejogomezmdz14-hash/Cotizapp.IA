import assert from "node:assert/strict";
import test from "node:test";

import {
  COTIZAPP_ICON,
  COTIZAPP_LOGO_ON_DARK,
  COTIZAPP_LOGO_ON_LIGHT,
} from "../lib/brand/assets";

test("brand assets point to the icons directory", () => {
  assert.equal(COTIZAPP_LOGO_ON_DARK, "/icons/cotizapp-logo.png");
  assert.equal(COTIZAPP_LOGO_ON_LIGHT, "/icons/cotizapp-logo-light.png");
  assert.equal(COTIZAPP_ICON, "/icons/cotizapp-icon.png");
});
