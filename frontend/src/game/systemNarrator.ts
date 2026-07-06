// ────────────────────────────────────────────────────────────
// THE SYSTEM — narrator identity
//
// "The System" is the guiding voice that narrates the guided-onboarding
// tutorials (stamina/currency → Ward hub → University → Shops) and other
// milestone moments. It has a single donghua portrait that starts as a dark,
// unreadable silhouette and only resolves into a colored identity once the
// player reaches Player Level 10 — at which point its form is tinted by the
// player's aptitude (guardian / sage / warden / weaver).
//
// Art lives in `frontend/assets/system/`:
//   system_shadow.png   — level < 10 (dark silhouette, identity hidden)
//   system_guardian.png — level >= 10, aptitude "guardian"
//   system_sage.png     — level >= 10, aptitude "sage"
//   system_warden.png   — level >= 10, aptitude "warden"
//   system_weaver.png   — level >= 10, aptitude "weaver"
// ────────────────────────────────────────────────────────────

import { APTITUDE_INFO } from './content';

export const SYSTEM_REVEAL_LEVEL = 10;

export type SystemAptitude = 'guardian' | 'sage' | 'warden' | 'weaver';

const SYSTEM_ART: Record<'shadow' | SystemAptitude, any> = {
  shadow: require('../../assets/system/system_shadow.png'),
  guardian: require('../../assets/system/system_guardian.png'),
  sage: require('../../assets/system/system_sage.png'),
  warden: require('../../assets/system/system_warden.png'),
  weaver: require('../../assets/system/system_weaver.png'),
};

// The System's shadow / pre-reveal accent color. Deliberately a cold,
// desaturated slate so the pre-reveal narrator reads as "unknown".
const SHADOW_COLOR = '#8B93A7';
const SHADOW_NAME = 'The System';

export interface SystemIdentity {
  revealed: boolean;
  aptitude: SystemAptitude | null;
  name: string;      // "The System" pre-reveal, else "The System — <Aptitude>"
  color: string;     // accent color for name/frame/glow
  art: any;          // require()'d image source
}

function normalizeAptitude(aptitude?: string | null): SystemAptitude | null {
  switch (aptitude) {
    case 'guardian':
    case 'sage':
    case 'warden':
    case 'weaver':
      return aptitude;
    default:
      return null;
  }
}

// Resolves the narrator's current identity from the player's level + aptitude.
// Below SYSTEM_REVEAL_LEVEL the identity is always the neutral dark silhouette,
// regardless of aptitude, so the reveal stays a genuine milestone moment.
export function getSystemIdentity(
  playerLevel: number,
  aptitude?: string | null
): SystemIdentity {
  const apt = normalizeAptitude(aptitude);
  const revealed = playerLevel >= SYSTEM_REVEAL_LEVEL && !!apt;
  if (!revealed) {
    return {
      revealed: false,
      aptitude: null,
      name: SHADOW_NAME,
      color: SHADOW_COLOR,
      art: SYSTEM_ART.shadow,
    };
  }
  const info = APTITUDE_INFO[apt!];
  return {
    revealed: true,
    aptitude: apt,
    name: `${SHADOW_NAME} — ${info?.title || apt}`,
    color: info?.color || SHADOW_COLOR,
    art: SYSTEM_ART[apt!],
  };
}

// One line of System dialogue. `emphasis` lets an overlay tint/scale a key
// phrase if it wants to; purely optional metadata.
export interface SystemLine {
  text: string;
  emphasis?: boolean;
}
