/**
 * DEV-ONLY route: /journey/sprite-audit
 *
 * Audits every raster asset used by the fog-map renderer for alpha
 * transparency.  Each asset is rendered over white, black, and a
 * grey/white checkerboard so that opaque rectangular backing,
 * colour fringing, and premultiplied-alpha artefacts are obvious.
 *
 * PRODUCTION SAFETY
 *   Hard-redirects to / when !__DEV__, so real users can never reach it.
 *   Not linked from any tab or navigation menu.
 *
 * Usage (dev only):
 *   Navigate to /journey/sprite-audit in the Expo dev server.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import SpriteAuditScreen from '@/src/components/journey/dev/SpriteAuditScreen';

export default function SpriteAuditRoute() {
  // Redirect non-dev builds immediately — this screen must never be
  // reachable by production users.
  if (!__DEV__) return <Redirect href="/" />;
  return <SpriteAuditScreen />;
}
