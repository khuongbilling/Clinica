// SystemCard — collapsible System & Objective card
// Self-contained: design tokens copied from Current.tsx

import { useId, useState } from 'react';

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#07141D',
  panel:        '#0B1C25',
  jade:         '#82D5BA',
  jadeBright:   '#55C8B7',
  jadeDeep:     '#3BA88E',
  gold:         '#C7A15D',
  goldBright:   '#E1C27C',
  ivory:        '#F0E7D5',
  ivoryDim:     '#C8BFAD',
  muted:        '#9DA8AA',
  objSurface:   '#16343B',
  border:       'rgba(199,161,93,0.30)',
  jadeGlow:     'rgba(130,213,186,0.20)',
};

const F = {
  display: '"Marcellus","Cinzel",Georgia,serif',
  ui:      '"Source Sans 3","Inter",-apple-system,sans-serif',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 };
const R  = { sm: 4, md: 8, lg: 12, xl: 18, xxl: 24, pill: 999 };

// ── SystemCard ────────────────────────────────────────────────────────────────
export function SystemCard({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [focused, setFocused] = useState(false);
  const stripId = useId();

  function toggle() {
    setOpen((v) => !v);
  }

  return (
    <div style={{
      margin: `0 ${SP.sm}px`,
      background: `linear-gradient(145deg, #0D2228, #091820)`,
      border: `1.5px solid ${C.border}`,
      borderRadius: R.xxl,
      overflow: 'hidden',
      boxShadow: `inset 0 0 20px rgba(85,200,183,0.07), 0 4px 16px rgba(0,0,0,0.4)`,
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: SP.md, padding: `${SP.md}px ${SP.md}px ${SP.sm}px` }}>
        {/* System medallion — stethoscope emblem */}
        <div style={{
          width: 40, height: 40, borderRadius: 20,
          background: `radial-gradient(circle, #0E2E26, #071810)`,
          border: `2px solid ${C.jade}70`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 12px ${C.jade}50`,
        }}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <path d="M6 5Q6 3 8 3Q10 3 10 5V10Q10 13 13 13Q16 13 16 10" stroke={C.jade} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
            <circle cx="16" cy="8.5" r="2.2" stroke={C.jade} strokeWidth="1.3" fill="rgba(130,213,186,0.2)"/>
            <circle cx="7" cy="4.5" r="1.1" fill={C.jade}/>
            <circle cx="9" cy="4.5" r="1.1" fill={C.jade}/>
          </svg>
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontFamily: F.display, color: C.jade, letterSpacing: 1.5, marginBottom: 4 }}>
            THE SYSTEM
          </div>
          <div style={{ fontSize: 12, color: C.ivoryDim, fontFamily: F.ui, lineHeight: 1.6 }}>
            Ward Shift unlocked — step into the ward for your first simulation.
          </div>
        </div>

        {/* Gold-ringed collapse chevron button */}
        <button
          onClick={toggle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-expanded={open}
          aria-controls={stripId}
          aria-label="Toggle objective"
          style={{
            width: 24, height: 24, borderRadius: 12,
            background: 'rgba(199,161,93,0.10)',
            border: `1.5px solid ${focused ? C.goldBright : C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            // Visible focus ring matching gold border color
            outline: focused ? `2px solid ${C.goldBright}` : 'none',
            outlineOffset: 2,
            padding: 0,
          }}
        >
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            style={{
              transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 240ms ease',
            }}
          >
            {/* Chevron points up (↑) = expanded; 180° = pointing down (↓) = collapsed */}
            <path d="M1 5L5 1L9 5" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Objective strip — collapses/expands without layout jump */}
      <div
        id={stripId}
        style={{
          maxHeight: open ? '48px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 240ms ease',
          willChange: 'max-height',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: `7px ${SP.md}px 10px`,
          background: `rgba(22,52,59,0.70)`,
        }}>
          {/* Flag icon per spec */}
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <line x1="2" y1="1" x2="2" y2="10.5" stroke={C.jade} strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M2 1.5H9L7 4L9 6.5H2Z" fill={C.jade} opacity="0.9"/>
          </svg>
          <span style={{ fontSize: 9, fontFamily: F.display, color: C.jade, letterSpacing: 1.2 }}>OBJECTIVE</span>
          <span style={{ fontSize: 11, color: C.ivoryDim, fontFamily: F.ui }}>Complete your first Ward Shift simulation.</span>
        </div>
      </div>
    </div>
  );
}

// ── Gallery preview — centered on dark background ─────────────────────────────
export default function SystemCardPreview() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#07141D',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: 374 }}>
        <SystemCard defaultOpen={true} />
      </div>
    </div>
  );
}
