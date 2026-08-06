// LocationHeader — slim location row below the status bar
// Extracted from Current.tsx (Push 3)

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  panel:    '#0B1C25',
  gold:     '#C7A15D',
  goldBright:'#E1C27C',
  muted:    '#9DA8AA',
  border:   'rgba(199,161,93,0.30)',
};

const F = {
  display: '"Marcellus","Cinzel",Georgia,serif',
  ui:      '"Source Sans 3","Inter",-apple-system,sans-serif',
};

const SP = { xs: 4, sm: 8, md: 12 };

// ── LocationHeader ─────────────────────────────────────────────────────────────
export default function LocationHeader() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: `${SP.sm}px ${SP.md}px`,
      position: 'relative',
    }}>
      {/* Diamond dividers + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
        <span style={{ fontSize: 10, color: C.gold, opacity: 0.7 }}>◇</span>
        <span style={{
          fontFamily: F.display, fontSize: 13,
          color: C.goldBright, letterSpacing: 1.8,
          textShadow: `0 0 14px ${C.gold}80`,
        }}>
          GRAND WARD ATRIUM
        </span>
        <span style={{ fontSize: 10, color: C.gold, opacity: 0.7 }}>◇</span>
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 10, fontFamily: F.ui,
        color: C.muted, marginTop: 2, lineHeight: 1.3,
        textAlign: 'center',
      }}>
        A place of healing and learning.
      </div>

      {/* Top-right absolute cluster */}
      <div style={{
        position: 'absolute', right: SP.md, top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex', alignItems: 'center', gap: SP.xs,
      }}>
        {/* Help / info button */}
        <div style={{
          width: 24, height: 24, borderRadius: 12,
          background: C.panel, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke={C.muted} strokeWidth="1"/>
            <line x1="6" y1="5" x2="6" y2="9" stroke={C.muted} strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="6" cy="3.5" r="0.8" fill={C.muted}/>
          </svg>
        </div>
        {/* Map-pin button — teardrop/pin SVG */}
        <div style={{
          width: 24, height: 24, borderRadius: 12,
          background: C.panel, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {/* Pin head (circle) */}
            <circle cx="6" cy="4.5" r="2.5" stroke={C.muted} strokeWidth="1" fill="none"/>
            {/* Pin stem */}
            <path d="M4.2 6.5 Q6 12 6 12 Q6 12 7.8 6.5" stroke={C.muted} strokeWidth="1"
              fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
