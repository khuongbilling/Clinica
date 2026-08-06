// PlayerStatusBar — unified premium status bar
// Extracted from Current.tsx (Push 3)

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
  muted:        '#9DA8AA',
  border:       'rgba(199,161,93,0.30)',
  jadeBorder:   'rgba(130,213,186,0.35)',
  jadeGlow:     'rgba(130,213,186,0.20)',
};

const F = {
  display: '"Marcellus","Cinzel",Georgia,serif',
  ui:      '"Source Sans 3","Inter",-apple-system,sans-serif',
};

const SP = { xs: 4, sm: 8, md: 12 };
const R  = { xl: 18, pill: 999 };

const PLAYER = {
  name:       'Dr. Chen',
  level:      3,
  classLabel: 'Medic',
  role:       'Junior Clinician',
  stamina:    14,
  staminaMax: 20,
  crowns:     120,
};

// ── PlusBtn ───────────────────────────────────────────────────────────────────
function PlusBtn() {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: 9,
      background: 'rgba(199,161,93,0.12)',
      border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', flexShrink: 0,
    }}>
      <span style={{ color: C.goldBright, fontSize: 12, lineHeight: 1, fontWeight: 700, fontFamily: F.ui }}>+</span>
    </div>
  );
}

// ── PlayerStatusBar ───────────────────────────────────────────────────────────
export default function PlayerStatusBar() {
  const pct = (PLAYER.stamina / PLAYER.staminaMax) * 100;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: SP.sm,
      padding: `${SP.sm}px ${SP.md}px`,
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderRadius: R.xl, margin: `${SP.sm}px ${SP.sm}px 0`,
      boxShadow: `inset 0 0 16px ${C.jadeGlow}, 0 2px 8px rgba(0,0,0,0.5)`,
    }}>

      {/* Profile medallion — stethoscope inside jade-bordered circle */}
      <div style={{
        width: 40, height: 40, borderRadius: 20,
        background: 'linear-gradient(135deg, #0D2535, #091822)',
        border: `2px solid ${C.jade}60`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 0 10px ${C.jade}40`,
      }}>
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke={C.jade} strokeWidth="1" fill="none" opacity="0.5"/>
          {/* Stethoscope */}
          <path d="M6 5Q6 3 8 3Q10 3 10 5V10Q10 13 13 13Q16 13 16 10"
            stroke={C.jade} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <circle cx="16" cy="9" r="2" stroke={C.jade} strokeWidth="1.2" fill={C.jadeGlow}/>
          <circle cx="7" cy="5" r="1" fill={C.jade}/>
          <circle cx="9" cy="5" r="1" fill={C.jade}/>
        </svg>
      </div>

      {/* Identity column — three lines */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Line 1: name */}
        <div style={{
          fontSize: 14, fontFamily: F.display,
          color: C.ivory, lineHeight: 1.15, letterSpacing: 0.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {PLAYER.name}
        </div>
        {/* Line 2: level · class */}
        <div style={{
          fontSize: 10, fontFamily: F.ui, fontWeight: 600,
          color: C.jade, marginTop: 1, lineHeight: 1.2,
        }}>
          Lv. {PLAYER.level}&nbsp;·&nbsp;{PLAYER.classLabel}
        </div>
        {/* Line 3: rank title */}
        <div style={{
          fontSize: 9, fontFamily: F.ui,
          color: C.muted, marginTop: 1, lineHeight: 1.2,
        }}>
          {PLAYER.role}
        </div>
      </div>

      {/* Stamina chip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: '#091822', borderRadius: R.pill, padding: '4px 7px',
        border: `1px solid ${C.jadeBorder}`,
      }}>
        <img src="/images/icon-stamina.png"
          style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} />
        <div style={{
          width: 30, height: 3.5,
          background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg,${C.jadeDeep},${C.jade})`, borderRadius: 2,
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}>
          <span style={{ fontSize: 10, color: C.jade, fontFamily: F.ui, fontWeight: 700, lineHeight: 1.1 }}>
            {PLAYER.stamina}/{PLAYER.staminaMax}
          </span>
          <span style={{ fontSize: 8, color: C.muted, fontFamily: F.ui, lineHeight: 1.1 }}>
            ~3 min
          </span>
        </div>
        <PlusBtn />
      </div>

      {/* Crowns chip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: '#091822', borderRadius: R.pill, padding: '4px 7px',
        border: `1px solid ${C.border}`,
      }}>
        <img src="/images/icon-crowns.png"
          style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: C.goldBright, fontFamily: F.ui, fontWeight: 700 }}>
          {PLAYER.crowns}
        </span>
        <PlusBtn />
      </div>

    </div>
  );
}
