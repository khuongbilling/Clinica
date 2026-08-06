// Main Hub — Sanctuary Redesign (v3)
// Implements the full 24-section design spec:
// - Bottom nav: Journey · Heroes · Sanctuary · Inventory · Shop
// - 3-left / 2-right shortcut asymmetry (Journey removed from shortcuts)
// - Marcellus display font + Source Sans 3 UI font
// - Exact spec palette: #07141D bg, #82D5BA jade, #C7A15D gold, etc.
// - Jade gradient Enter the Ward button
// - River SVG medallion on hero card, no emoji, no star decorations

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#07141D',
  panel:        '#0B1C25',
  raisedPanel:  '#102A31',
  jade:         '#82D5BA',
  jadeBright:   '#55C8B7',
  jadeDeep:     '#3BA88E',
  gold:         '#C7A15D',
  goldBright:   '#E1C27C',
  goldDim:      '#8A6A2E',
  ivory:        '#F0E7D5',
  ivoryDim:     '#C8BFAD',
  muted:        '#9DA8AA',
  objSurface:   '#16343B',
  alert:        '#D43030',
  available:    '#52D177',
  river:        '#5BB8D4',
  riverDim:     '#2D7A95',
  divider:      'rgba(199,161,93,0.15)',
  border:       'rgba(199,161,93,0.30)',
  borderStrong: 'rgba(199,161,93,0.65)',
  jadeBorder:   'rgba(130,213,186,0.35)',
  jadeGlow:     'rgba(130,213,186,0.20)',
};

const F = {
  display: '"Marcellus","Cinzel",Georgia,serif',
  ui:      '"Source Sans 3","Inter",-apple-system,sans-serif',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 };
const R  = { sm: 4, md: 8, lg: 12, xl: 18, xxl: 24, pill: 999 };

// ── Assets ────────────────────────────────────────────────────────────────────
const IMG = {
  hubBg:      '/__mockup/images/home_hub_bg.png',
  heroSprite: '/__mockup/images/hero-sprite.png',
  crowns:     '/__mockup/images/icon-crowns.png',
  stamina:    '/__mockup/images/icon-stamina.png',
  // Shortcut cards — exact crops from reference art (frame + icon + label baked)
  rounds:     '/__mockup/images/ref-card-rounds.png',
  defense:    '/__mockup/images/ref-card-defense.png',
  goals:      '/__mockup/images/ref-card-goals.png',
  recruit:    '/__mockup/images/ref-card-recruit.png',
  supplies:   '/__mockup/images/ref-card-supplies.png',
  // Tab icons — crops from reference (Sanctuary & Heroes) + SVG for rest
  tabHeroes:    '/__mockup/images/ref-tab-heroes.png',
  tabSanctuary: '/__mockup/images/ref-tab-home.png',
};

const PLAYER = { name: 'Dr. Chen', level: 3, role: 'Junior Clinician', stamina: 14, staminaMax: 20, crowns: 120 };
const HERO   = { name: 'Acute Step Warden', profession: 'Physiotherapist', element: 'River', level: 3, xp: 340, xpNext: 500 };

// ── SVG Tab Icons ─────────────────────────────────────────────────────────────

function TabIconJourney({ color }: { color: string }) {
  // Compass rose — clear silhouette, wayfinder style
  return (
    <svg width="28" height="26" viewBox="0 0 28 26" fill="none">
      {/* Outer ring */}
      <circle cx="14" cy="13" r="11" stroke={color} strokeWidth="1.5" fill="none" opacity="0.7"/>
      {/* N pointer (bright) */}
      <path d="M14 4L16 13H12L14 4Z" fill={color}/>
      {/* S pointer (dimmer) */}
      <path d="M14 22L12 13H16L14 22Z" fill={color} opacity="0.5"/>
      {/* E pointer */}
      <path d="M24 13L14 11V15L24 13Z" fill={color} opacity="0.7"/>
      {/* W pointer */}
      <path d="M4 13L14 15V11L4 13Z" fill={color} opacity="0.7"/>
      {/* Center gem */}
      <circle cx="14" cy="13" r="2.2" fill={color}/>
      <circle cx="14" cy="13" r="1" fill={C.bg}/>
    </svg>
  );
}

function TabIconInventory({ color }: { color: string }) {
  // Medical satchel / apothecary bag
  return (
    <svg width="28" height="26" viewBox="0 0 28 26" fill="none">
      {/* Bag body */}
      <rect x="3" y="10" width="22" height="15" rx="3" fill={color}/>
      {/* Bag flap */}
      <path d="M3 15Q3 10 8 10H20Q25 10 25 15V14Q25 10 20 10H8Q3 10 3 14Z" fill={color} opacity="0.5"/>
      {/* Handle */}
      <path d="M10 10V7Q10 4 14 4Q18 4 18 7V10" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Cross on bag */}
      <rect x="12" y="14" width="4" height="7" rx="1" fill={C.bg} opacity="0.6"/>
      <rect x="10.5" y="16.5" width="7" height="2" rx="1" fill={C.bg} opacity="0.6"/>
    </svg>
  );
}

function TabIconShop({ color }: { color: string }) {
  // Merchant stall / ornate storefront
  return (
    <svg width="28" height="26" viewBox="0 0 28 26" fill="none">
      {/* Stall canopy */}
      <path d="M2 10H26V14Q26 16 24 16H4Q2 16 2 14Z" fill={color}/>
      {/* Canopy scallops */}
      <path d="M2 16Q4 13 6 16Q8 13 10 16Q12 13 14 16Q16 13 18 16Q20 13 22 16Q24 13 26 16" stroke={color} strokeWidth="1.5" fill="none"/>
      {/* Counter */}
      <rect x="4" y="17" width="20" height="8" rx="2" fill={color} opacity="0.75"/>
      {/* Pole left */}
      <rect x="5" y="7" width="2" height="3" rx="1" fill={color}/>
      {/* Pole right */}
      <rect x="21" y="7" width="2" height="3" rx="1" fill={color}/>
      {/* Coin on counter */}
      <circle cx="14" cy="21" r="2.5" fill={C.bg} opacity="0.55"/>
      <circle cx="14" cy="21" r="1.2" fill={color} opacity="0.7"/>
    </svg>
  );
}

// ── Small Components ──────────────────────────────────────────────────────────

function PlusBtn() {
  return (
    <div style={{ width: 18, height: 18, borderRadius: 9, background: `rgba(199,161,93,0.12)`, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <span style={{ color: C.goldBright, fontSize: 12, lineHeight: 1, fontWeight: 700, fontFamily: F.ui }}>+</span>
    </div>
  );
}


// River affinity SVG medallion — painted feel, no emoji
function RiverMedallion({ size = 44 }: { size?: number }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Outer ring */}
      <circle cx="22" cy="22" r="21" stroke={C.river} strokeWidth="1.5" opacity="0.7"/>
      {/* Gradient fill */}
      <defs>
        <radialGradient id="riverBg" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#0E3545"/>
          <stop offset="100%" stopColor="#071822"/>
        </radialGradient>
      </defs>
      <circle cx="22" cy="22" r="19.5" fill="url(#riverBg)"/>
      {/* Water drop — main symbol */}
      <path d="M22 9 C22 9 13 19 13 25 A9 9 0 0 0 31 25 C31 19 22 9 22 9Z" fill={C.river} opacity="0.85"/>
      {/* Inner highlight */}
      <path d="M20 17 C20 17 17 22 17 25 A3.5 3.5 0 0 0 20.5 25.5" stroke="rgba(180,235,255,0.55)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      {/* Teal glow dot */}
      <circle cx="22" cy="25" r="3.5" fill={C.jadeBright} opacity="0.4"/>
    </svg>
  );
}

// Stamina icon — designed teal energy emblem
function StaminaEmblem() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <polygon points="7,1 9.5,5.5 13.5,5.5 10.5,8.5 11.5,13 7,10.5 2.5,13 3.5,8.5 0.5,5.5 4.5,5.5" fill={C.jade} opacity="0.9"/>
    </svg>
  );
}

// Medical cross emblem for Enter Ward button
function MedCross({ size = 20, color = C.jadeDeep }: { size?: number; color?: string }) {
  const s = size / 20;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke={C.goldBright} strokeWidth="1.2" fill={C.jadeDeep} opacity="0.9"/>
      <rect x="8" y="4" width="4" height="12" rx="1" fill={color === C.jadeDeep ? '#1A5040' : color}/>
      <rect x="4" y="8" width="12" height="4" rx="1" fill={color === C.jadeDeep ? '#1A5040' : color}/>
      <rect x="8.5" y="4.5" width="3" height="11" rx="0.8" fill={C.jade} opacity="0.85"/>
      <rect x="4.5" y="8.5" width="11" height="3" rx="0.8" fill={C.jade} opacity="0.85"/>
    </svg>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header() {
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
      {/* Profile medallion */}
      <div style={{ width: 40, height: 40, borderRadius: 20, background: `linear-gradient(135deg, #0D2535, #091822)`, border: `2px solid ${C.jade}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 10px ${C.jade}40` }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke={C.jade} strokeWidth="1" fill="none" opacity="0.5"/>
          {/* Stethoscope */}
          <path d="M6 5Q6 3 8 3Q10 3 10 5V10Q10 13 13 13Q16 13 16 10" stroke={C.jade} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <circle cx="16" cy="9" r="2" stroke={C.jade} strokeWidth="1.2" fill={C.jadeGlow}/>
          <circle cx="7" cy="5" r="1" fill={C.jade}/>
          <circle cx="9" cy="5" r="1" fill={C.jade}/>
        </svg>
      </div>
      {/* Identity */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontFamily: F.display, color: C.ivory, lineHeight: 1.2, letterSpacing: 0.3 }}>
          {PLAYER.name}&nbsp;<span style={{ fontSize: 11, color: C.jade, fontFamily: F.ui, fontWeight: 600 }}>Lv.{PLAYER.level}</span>
        </div>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: F.ui, marginTop: 1 }}>{PLAYER.role}</div>
      </div>
      {/* Stamina chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#091822', borderRadius: R.pill, padding: '4px 7px', border: `1px solid ${C.jadeBorder}` }}>
        <StaminaEmblem />
        <div style={{ width: 30, height: 3.5, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${C.jadeDeep},${C.jade})`, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 10, color: C.jade, fontFamily: F.ui, fontWeight: 700 }}>{PLAYER.stamina}/{PLAYER.staminaMax}</span>
        <PlusBtn />
      </div>
      {/* Crowns chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#091822', borderRadius: R.pill, padding: '4px 7px', border: `1px solid ${C.border}` }}>
        <img src={IMG.crowns} style={{ width: 14, height: 14, objectFit: 'contain' }} />
        <span style={{ fontSize: 10, color: C.goldBright, fontFamily: F.ui, fontWeight: 700 }}>{PLAYER.crowns}</span>
        <PlusBtn />
      </div>
    </div>
  );
}

// ── Location Title ─────────────────────────────────────────────────────────────
function LocationTitle() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `${SP.sm}px ${SP.md}px`, gap: SP.sm, position: 'relative' }}>
      {/* Diamond dividers + title */}
      <span style={{ fontSize: 10, color: C.gold, opacity: 0.7 }}>◇</span>
      <span style={{ fontFamily: F.display, fontSize: 13, color: C.goldBright, letterSpacing: 1.8, textShadow: `0 0 14px ${C.gold}80` }}>
        GRAND WARD ATRIUM
      </span>
      <span style={{ fontSize: 10, color: C.gold, opacity: 0.7 }}>◇</span>
      {/* Right controls */}
      <div style={{ position: 'absolute', right: SP.md, display: 'flex', alignItems: 'center', gap: SP.xs }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: C.panel, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke={C.muted} strokeWidth="1"/>
            <line x1="6" y1="5" x2="6" y2="9" stroke={C.muted} strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="6" cy="3.5" r="0.8" fill={C.muted}/>
          </svg>
        </div>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: C.panel, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="2" stroke={C.muted} strokeWidth="1"/>
            <line x1="6" y1="0" x2="6" y2="2.5" stroke={C.muted} strokeWidth="1"/>
            <line x1="6" y1="9.5" x2="6" y2="12" stroke={C.muted} strokeWidth="1"/>
            <line x1="0" y1="6" x2="2.5" y2="6" stroke={C.muted} strokeWidth="1"/>
            <line x1="9.5" y1="6" x2="12" y2="6" stroke={C.muted} strokeWidth="1"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── System & Objective Card ───────────────────────────────────────────────────
function SystemCard() {
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
        {/* System medallion */}
        <div style={{ width: 40, height: 40, borderRadius: 20, background: `radial-gradient(circle, #0E2E26, #071810)`, border: `2px solid ${C.jade}70`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 12px ${C.jade}50` }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2 L12 8 L18 8 L13 12 L15 18 L10 14 L5 18 L7 12 L2 8 L8 8 Z" fill={C.jade} opacity="0.85"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontFamily: F.display, color: C.jade, letterSpacing: 1.5, marginBottom: 4 }}>THE SYSTEM</div>
          <div style={{ fontSize: 12, color: C.ivoryDim, fontFamily: F.ui, lineHeight: 1.6 }}>
            Ward Shift unlocked — step into the ward for your first simulation.
          </div>
        </div>
        {/* Gold-ringed collapse chevron */}
        <div style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(199,161,93,0.10)', border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 5L5 1L9 5" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {/* Objective strip — nested, no harsh divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `7px ${SP.md}px 10px`, background: `rgba(22,52,59,0.70)` }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 5.5L4 9L10 2" stroke={C.jade} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 9, fontFamily: F.display, color: C.jade, letterSpacing: 1.2 }}>OBJECTIVE</span>
        <span style={{ fontSize: 11, color: C.ivoryDim, fontFamily: F.ui }}>Complete your first Ward Shift simulation.</span>
      </div>
    </div>
  );
}

// ── Shortcut Card ─────────────────────────────────────────────────────────────
// All 5 cards share one component — exact ref crop with baked art + label
function ShortcutCard({ src, width = 78 }: { src: string; width?: number }) {
  return (
    <img
      src={src}
      draggable={false}
      style={{ width, height: 'auto', objectFit: 'contain', cursor: 'pointer', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.85))' }}
    />
  );
}

// ── Hero Arena ────────────────────────────────────────────────────────────────
function Arena() {
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'stretch', minHeight: 0 }}>
      {/* Background */}
      <img src={IMG.hubBg} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      {/* Edge vignettes */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(7,20,29,0.65) 0%, transparent 28%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(7,20,29,0.65) 0%, transparent 28%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '28%', background: 'linear-gradient(to top, rgba(7,20,29,0.75), transparent)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '12%', background: 'linear-gradient(to bottom, rgba(7,20,29,0.55), transparent)', pointerEvents: 'none' }} />

      {/* Left column — 3 cards (Rounds, Goals, Recruit) */}
      <div style={{ position: 'relative', zIndex: 2, width: 90, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', padding: `${SP.sm}px 0 ${SP.sm}px ${SP.xs}px` }}>
        <ShortcutCard src={IMG.rounds} />
        <ShortcutCard src={IMG.goals} />
        <ShortcutCard src={IMG.recruit} />
      </div>

      {/* Hero center */}
      <div style={{ flex: 1, position: 'relative' }}>
        <img src={IMG.heroSprite} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }} />
        {/* Circular glow platform under hero */}
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 90, height: 20, borderRadius: '50%', background: `radial-gradient(ellipse, ${C.jade}55 0%, transparent 70%)`, pointerEvents: 'none' }} />
      </div>

      {/* Right column — 2 cards (Defense, Supplies) — centered vertically */}
      <div style={{ position: 'relative', zIndex: 2, width: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: SP.xl, padding: `${SP.sm}px ${SP.xs}px ${SP.sm}px 0` }}>
        <ShortcutCard src={IMG.defense} />
        <ShortcutCard src={IMG.supplies} />
      </div>
    </div>
  );
}


// ── Hero Card ─────────────────────────────────────────────────────────────────
function HeroCard() {
  const xpPct = (HERO.xp / HERO.xpNext) * 100;
  return (
    <div style={{
      margin: `0 ${SP.sm}px ${SP.xs}px`,
      background: `linear-gradient(145deg, #0D2028, #091820)`,
      border: `1px solid ${C.border}`,
      borderRadius: R.xl,
      padding: `${SP.md}px ${SP.md}px`,
      cursor: 'pointer',
      boxShadow: `0 2px 10px rgba(0,0,0,0.5)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
        {/* River affinity medallion */}
        <div style={{ flexShrink: 0 }}>
          <RiverMedallion size={46} />
        </div>
        {/* Center: name, profession, level, XP bar */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontFamily: F.display, color: C.ivory, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{HERO.name}</div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: F.ui, marginTop: 1 }}>{HERO.profession}&nbsp;·&nbsp;Lv. {HERO.level}</div>
          {/* River chip */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: `rgba(91,184,212,0.12)`, border: `1px solid ${C.river}50`, borderRadius: R.pill, padding: '2px 7px', marginTop: 4 }}>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M4 0.5C4 0.5 1.5 3.5 1.5 5.5A2.5 2.5 0 0 0 6.5 5.5C6.5 3.5 4 0.5 4 0.5Z" fill={C.river}/>
            </svg>
            <span style={{ fontSize: 9, color: C.river, fontFamily: F.ui, fontWeight: 700, letterSpacing: 0.3 }}>River</span>
          </div>
        </div>
        {/* Right: XP values + bar + reward chest */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: C.ivoryDim, fontFamily: F.ui }}>
            {HERO.xp}<span style={{ color: C.muted }}>/{HERO.xpNext} XP</span>
          </span>
          <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${xpPct}%`, height: '100%', background: `linear-gradient(90deg,${C.riverDim},${C.river})`, borderRadius: 2 }} />
          </div>
          {/* Reward chest indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <rect x="1" y="3" width="10" height="7" rx="1.5" fill={C.goldDim} opacity="0.8"/>
              <rect x="1" y="3" width="10" height="2.5" rx="1" fill={C.gold} opacity="0.9"/>
              <rect x="5" y="2" width="2" height="2" rx="0.5" fill={C.goldBright}/>
            </svg>
            <span style={{ fontSize: 9, color: C.gold, fontFamily: F.ui }}>Next at 500</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Enter the Ward Button ─────────────────────────────────────────────────────
function EnterWardBtn() {
  return (
    <div style={{ margin: `0 ${SP.sm}px ${SP.xs}px`, position: 'relative' }}>
      {/* Outer gold glow layer */}
      <div style={{
        borderRadius: R.pill,
        boxShadow: `0 0 28px ${C.gold}55, 0 0 14px ${C.gold}30`,
        position: 'relative',
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#0E2820,#091A14)',
          border: `2px solid ${C.gold}`,
          borderRadius: R.pill,
          padding: `${SP.md}px ${SP.xl}px`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP.md,
          cursor: 'pointer',
          boxShadow: `inset 0 0 12px rgba(199,161,93,0.08)`,
          position: 'relative', overflow: 'visible',
        }}>
          {/* Sparkle corners */}
          {(['topLeft','topRight','bottomLeft','bottomRight'] as const).map((pos) => {
            const s: Record<string,string|number> = { position:'absolute', fontSize:10, opacity:0.7, color:C.goldBright };
            if (pos==='topLeft')     { s.top=4; s.left=14; }
            if (pos==='topRight')    { s.top=4; s.right=14; }
            if (pos==='bottomLeft')  { s.bottom=4; s.left=14; }
            if (pos==='bottomRight') { s.bottom=4; s.right=14; }
            return <span key={pos} style={s as any}>✦</span>;
          })}
          {/* Midpoint gold diamond ornaments — left & right border edges */}
          <span style={{ position:'absolute', left:-8, top:'50%', transform:'translateY(-50%)', fontSize:14, color:C.gold, lineHeight:1, textShadow:`0 0 8px ${C.gold}` }}>◆</span>
          <span style={{ position:'absolute', right:-8, top:'50%', transform:'translateY(-50%)', fontSize:14, color:C.gold, lineHeight:1, textShadow:`0 0 8px ${C.gold}` }}>◆</span>
          <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: C.goldBright, letterSpacing: 1.5, textShadow: `0 0 14px ${C.gold}CC` }}>
            ENTER THE WARD
          </span>
          <span style={{ fontSize: 18, color: C.goldBright }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ── Bottom Navigation ─────────────────────────────────────────────────────────
// Journey · Heroes · Sanctuary · Inventory · Shop
// Sanctuary is the active tab on main hub

function TabItem({ label, active, iconSrc, IconComp }: {
  label: string;
  active: boolean;
  iconSrc?: string;
  IconComp?: React.FC<{ color: string }>;
}) {
  const col = active ? C.jade : C.muted;
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      cursor: 'pointer',
      position: 'relative',
      padding: '4px 0 2px',
      ...(active ? {
        background: `rgba(16,42,49,0.85)`,
        borderRadius: R.lg,
        boxShadow: `inset 0 0 12px rgba(85,200,183,0.18), 0 0 0 1px ${C.jade}40`,
        margin: '2px 3px 2px',
      } : {}),
    }}>
      {iconSrc
        ? <img src={iconSrc} style={{ width: 38, height: 26, objectFit: 'contain', opacity: active ? 1 : 0.45, filter: active ? `drop-shadow(0 0 4px ${C.jade}88)` : 'none' }} />
        : IconComp
          ? <IconComp color={col} />
          : null
      }
      <span style={{ fontSize: 8.5, fontFamily: F.display, color: col, letterSpacing: 0.8, lineHeight: 1 }}>
        {label}
      </span>
      {active && (
        <div style={{ width: 22, height: 2.5, borderRadius: 2, background: C.jade, boxShadow: `0 0 6px ${C.jade}AA`, marginTop: 1 }} />
      )}
    </div>
  );
}

function BottomNav() {
  return (
    <div style={{
      display: 'flex',
      background: C.panel,
      borderTop: `1px solid ${C.border}`,
      paddingBottom: 6,
      paddingTop: 4,
      paddingLeft: 2,
      paddingRight: 2,
    }}>
      <TabItem label="JOURNEY"   IconComp={TabIconJourney}   active={false} />
      <TabItem label="HEROES"    iconSrc={IMG.tabHeroes}     active={false} />
      <TabItem label="SANCTUARY" iconSrc={IMG.tabSanctuary}  active={true}  />
      <TabItem label="INVENTORY" IconComp={TabIconInventory} active={false} />
      <TabItem label="SHOP"      IconComp={TabIconShop}      active={false} />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function MainHubPreview() {
  return (
    <div style={{
      width: 390, height: 844,
      display: 'flex', flexDirection: 'column',
      background: C.bg,
      fontFamily: F.ui,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, gap: 0 }}>
        <Header />
        <LocationTitle />
        <SystemCard />
        <Arena />
        <HeroCard />
        <EnterWardBtn />
      </div>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <BottomNav />
      </div>
    </div>
  );
}

