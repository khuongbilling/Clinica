// Main Hub — live canvas preview  (redesign v2)
// Matches the reference redesign: location banner, floating icon buttons,
// updated hero panel, wide Enter-the-Ward CTA, illustrated tab bar.
// Pure web React — no React Native dependencies.

// ── Design tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  surface:             '#0C0E12',
  onSurface:           '#E8EAF0',
  onSurfaceSecondary:  '#C8CDD8',
  onSurfaceTertiary:   '#7A8494',
  river:               '#06B6D4',
};

const UI = {
  bg:           '#080F14',
  panel:        'rgba(8,18,26,0.88)',
  panelSolid:   '#0B1520',
  card:         'rgba(12,26,38,0.92)',
  jade:         '#3DC4A8',
  jadeDim:      '#2A8F7B',
  gold:         '#E8C868',
  goldSoft:     '#F3DE97',
  goldDim:      '#B89A3A',
  text:         '#F0EAD8',
  textSoft:     '#C8BFA8',
  textDim:      '#7A8090',
  border:       'rgba(232,200,104,0.22)',
  borderStrong: 'rgba(232,200,104,0.50)',
  divider:      'rgba(240,234,216,0.08)',
  riverChip:    'rgba(6,182,212,0.18)',
};

const GAME_FONT = '"Rajdhani","Barlow Condensed","Impact",sans-serif';
const CINZEL    = '"Cinzel Decorative","Cinzel",Georgia,serif'; // kept for the Enter Ward button only
const SANS      = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const R  = { sm: 4, md: 8, lg: 14, xl: 20, pill: 999 };

// ── Assets ────────────────────────────────────────────────────────────────────
const IMG = {
  hubBg:      '/__mockup/images/home_hub_bg.png',
  heroSprite: '/__mockup/images/hero-sprite.png',
  crowns:     '/__mockup/images/icon-crowns.png',
  // emblem cards — cropped 1:1 from the reference art (frame + icon + label baked)
  journey:    '/__mockup/images/ref-card-journey.png',
  goals:      '/__mockup/images/ref-card-goals.png',
  recruit:    '/__mockup/images/ref-card-recruit.png',
  rounds:     '/__mockup/images/ref-card-rounds.png',
  defense:    '/__mockup/images/ref-card-defense.png',
  supplies:   '/__mockup/images/ref-card-supplies.png',
  // tab icons — cropped 1:1 from the reference art
  tabHome:    '/__mockup/images/ref-tab-home.png',
  tabStudy:   '/__mockup/images/ref-tab-study.png',
  tabShift:   '/__mockup/images/ref-tab-shift.png',
  tabHeroes:  '/__mockup/images/ref-tab-heroes.png',
  tabProfile: '/__mockup/images/ref-tab-profile.png',
};

const PLAYER = { name: 'Dr. Chen', level: 3, rank: 'Junior Clinician', stamina: 14, staminaMax: 20, crowns: 120 };
const HERO   = { name: 'Acute Step Warden', title: 'Physiotherapist', element: 'River', level: 8, stars: 2, xp: 340, xpNext: 500 };

// ── Small helpers ─────────────────────────────────────────────────────────────

function PlusBtn() {
  return (
    <div style={{ width: 18, height: 18, borderRadius: 9, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <span style={{ color: UI.text, fontSize: 12, lineHeight: 1, fontWeight: 700, marginTop: -1 }}>+</span>
    </div>
  );
}

function Stars({ count, total = 3 }: { count: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ fontSize: 13, color: i < count ? UI.gold : 'rgba(232,200,104,0.25)' }}>★</span>
      ))}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header() {
  const pct = (PLAYER.stamina / PLAYER.staminaMax) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, padding: `${SP.sm}px ${SP.md}px`, background: UI.panelSolid, borderBottom: `1px solid ${UI.divider}` }}>
      {/* Avatar */}
      <div style={{ width: 36, height: 36, borderRadius: 18, background: '#0D2535', border: `2px solid ${UI.jade}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 17 }}>🩺</span>
      </div>
      {/* Identity */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: UI.text, whiteSpace: 'nowrap' }}>
          {PLAYER.name}&nbsp;<span style={{ color: UI.jade, fontWeight: 600, fontSize: 12 }}>Lv.{PLAYER.level}</span>
        </div>
        <div style={{ fontSize: 10, color: UI.textDim }}>{PLAYER.rank}</div>
      </div>
      {/* Stamina chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0D2535', borderRadius: R.pill, padding: '4px 6px', border: `1px solid ${UI.jade}35` }}>
        <span style={{ fontSize: 11 }}>⚡</span>
        <div style={{ width: 32, height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: UI.jade, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 10, color: UI.jade, fontWeight: 700 }}>{PLAYER.stamina}/{PLAYER.staminaMax}</span>
        <PlusBtn />
      </div>
      {/* Crowns chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0D2535', borderRadius: R.pill, padding: '4px 6px', border: `1px solid ${UI.gold}35` }}>
        <img src={IMG.crowns} style={{ width: 14, height: 14, objectFit: 'contain' }} />
        <span style={{ fontSize: 10, color: UI.gold, fontWeight: 700 }}>{PLAYER.crowns}</span>
        <PlusBtn />
      </div>
    </div>
  );
}

// ── Location Banner ───────────────────────────────────────────────────────────
function LocationBanner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: 'rgba(5,14,20,0.72)', borderBottom: `1px solid ${UI.border}` }}>
      {/* Cross emblem */}
      <div style={{ width: 46, height: 46, borderRadius: 10, background: 'linear-gradient(135deg,#0D2E2A,#0A1E1A)', border: `2px solid ${UI.jade}70`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 12px ${UI.jade}55, inset 0 0 8px rgba(61,196,168,0.15)` }}>
        <span style={{ fontSize: 22, filter: `drop-shadow(0 0 5px ${UI.jade})` }}>✚</span>
      </div>
      {/* Title + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: UI.text, letterSpacing: 0.8, lineHeight: 1.2 }}>GRAND WARD ATRIUM</div>
        <div style={{ fontSize: 11, color: UI.jade, fontStyle: 'italic', marginTop: 1 }}>A place of healing and learning.</div>
      </div>
      {/* View Map */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(12,26,38,0.85)', border: `1px solid ${UI.border}`, borderRadius: R.pill, padding: '5px 10px', cursor: 'pointer', flexShrink: 0 }}>
        <span style={{ fontSize: 10 }}>📍</span>
        <span style={{ fontSize: 10, color: UI.textSoft, fontWeight: 600 }}>View Map</span>
      </div>
    </div>
  );
}

// ── Narrator Card ─────────────────────────────────────────────────────────────
function NarratorCard() {
  return (
    <div style={{ margin: `${SP.xs}px ${SP.sm}px`, background: UI.card, border: `1.5px solid ${UI.jade}45`, borderRadius: R.lg, overflow: 'hidden' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: SP.md, padding: `${SP.md}px ${SP.md}px ${SP.sm}px` }}>
        {/* Avatar */}
        <div style={{ width: 38, height: 38, borderRadius: 19, background: '#0A2015', border: `2px solid ${UI.jade}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 10px ${UI.jade}55` }}>
          <span style={{ fontSize: 18 }}>🩺</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: UI.jade, letterSpacing: 1.2, marginBottom: 3 }}>THE SYSTEM</div>
          <div style={{ fontSize: 12, color: COLORS.onSurface, lineHeight: 1.55 }}>
            Ward Shift unlocked — step into the ward for your first simulation.
          </div>
        </div>
        {/* Collapse */}
        <div style={{ width: 22, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: UI.textDim }}>∧</span>
        </div>
      </div>
      {/* Objective row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `6px ${SP.md}px`, background: 'rgba(61,196,168,0.08)', borderTop: `1px solid ${UI.jade}25` }}>
        <span style={{ fontSize: 11, color: UI.jade }}>⚑</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: UI.jade, letterSpacing: 0.8 }}>OBJECTIVE</span>
        <span style={{ fontSize: 11, color: COLORS.onSurfaceSecondary }}>Complete your first Ward Shift simulation.</span>
      </div>
    </div>
  );
}

// ── Icon Buttons ──────────────────────────────────────────────────────────────

// Emblem cards are exact crops from the reference art — frame, icon, label and
// badges are all baked into the image, so we just render the card.
function EmblemCard({ src, width = 74 }: { src: string; width?: number }) {
  return (
    <img
      src={src}
      style={{ width, height: 'auto', objectFit: 'contain', cursor: 'pointer', filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.8))' }}
    />
  );
}

// ── Arena (hero + icon columns) ───────────────────────────────────────────────
function Arena() {
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
      {/* Hero scene bg */}
      <img src={IMG.hubBg} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      {/* Vignettes */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(4,8,14,0.55) 0%, transparent 30%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(4,8,14,0.55) 0%, transparent 30%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to top, rgba(4,8,14,0.7), transparent)', pointerEvents: 'none' }} />

      {/* Left column */}
      <div style={{ position: 'relative', zIndex: 1, width: 86, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', padding: `${SP.sm}px 0 ${SP.sm}px ${SP.xs}px` }}>
        <EmblemCard src={IMG.journey} />
        <EmblemCard src={IMG.goals} />
        <EmblemCard src={IMG.recruit} />
      </div>

      {/* Hero center */}
      <div style={{ flex: 1, position: 'relative' }}>
        <img src={IMG.heroSprite} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom center' }} />
        {/* Glow ring under hero */}
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', width: 80, height: 16, borderRadius: '50%', background: `radial-gradient(ellipse, ${UI.jade}50 0%, transparent 70%)` }} />
      </div>

      {/* Right column */}
      <div style={{ position: 'relative', zIndex: 1, width: 86, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', padding: `${SP.sm}px ${SP.xs}px ${SP.sm}px 0` }}>
        <EmblemCard src={IMG.rounds} />
        <EmblemCard src={IMG.defense} />
        <EmblemCard src={IMG.supplies} />
      </div>
    </div>
  );
}

// ── Hero Info Panel ───────────────────────────────────────────────────────────
function HeroPanel() {
  const xpPct = (HERO.xp / HERO.xpNext) * 100;
  return (
    <div style={{ margin: `0 ${SP.sm}px ${SP.xs}px`, background: UI.card, border: `1px solid ${UI.border}`, borderRadius: R.xl, padding: `${SP.sm}px ${SP.md}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
        {/* Avatar circle with element icon */}
        <div style={{ width: 44, height: 44, borderRadius: 22, background: 'linear-gradient(135deg,#0A2015,#071510)', border: `2px solid ${COLORS.river}70`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 12px ${COLORS.river}40` }}>
          <span style={{ fontSize: 20 }}>🌿</span>
        </div>
        {/* Name + title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: UI.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{HERO.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <div style={{ background: UI.riverChip, border: `1px solid ${COLORS.river}60`, borderRadius: R.pill, padding: '2px 8px' }}>
              <span style={{ fontSize: 9, color: COLORS.river, fontWeight: 700, letterSpacing: 0.4 }}>💧 {HERO.element}</span>
            </div>
            <Stars count={HERO.stars} />
          </div>
        </div>
        {/* XP + View Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: UI.textSoft }}>{HERO.xp}<span style={{ color: UI.textDim }}>/{HERO.xpNext} XP</span></span>
          </div>
          <div style={{ width: 72, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${xpPct}%`, height: '100%', background: COLORS.river, borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: R.pill, padding: '3px 8px', cursor: 'pointer', marginTop: 1 }}>
            <span style={{ fontSize: 9 }}>👤</span>
            <span style={{ fontSize: 9, color: UI.textSoft, fontWeight: 600 }}>View Profile</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Enter-the-Ward Button ─────────────────────────────────────────────────────
function EnterWardBtn() {
  return (
    <div style={{ margin: `0 ${SP.sm}px ${SP.xs}px`, position: 'relative' }}>
      {/* Gold border glow */}
      <div style={{
        background: 'linear-gradient(135deg,#0E2820,#091A14)',
        border: `2px solid ${UI.gold}`,
        borderRadius: R.pill,
        padding: `${SP.md}px ${SP.xl}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP.md,
        cursor: 'pointer',
        boxShadow: `0 0 18px ${UI.jade}55, 0 0 0 1px ${UI.gold}30`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Sparkle corners */}
        {['topLeft','topRight','bottomLeft','bottomRight'].map((pos) => {
          const s: Record<string,string|number> = { position:'absolute', fontSize:10, opacity:0.7, color:UI.goldSoft };
          if (pos==='topLeft')     { s.top=4; s.left=14; }
          if (pos==='topRight')    { s.top=4; s.right=14; }
          if (pos==='bottomLeft')  { s.bottom=4; s.left=14; }
          if (pos==='bottomRight') { s.bottom=4; s.right=14; }
          return <span key={pos} style={s as any}>✦</span>;
        })}
        <span style={{ fontFamily: CINZEL, fontSize: 16, fontWeight: 700, color: UI.goldSoft, letterSpacing: 1.5, textShadow: `0 0 12px ${UI.jade}AA` }}>
          ENTER THE WARD
        </span>
        <span style={{ fontSize: 16, color: UI.goldSoft }}>→</span>
      </div>
    </div>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────
// Icons are exact crops from the reference art (hand-drawn style, glow baked in
// on the active HOME icon).
function TabBar() {
  const tabs = [
    { label: 'HOME',    src: IMG.tabHome,    active: true  },
    { label: 'STUDY',   src: IMG.tabStudy,   active: false },
    { label: 'SHIFT',   src: IMG.tabShift,   active: false },
    { label: 'HEROES',  src: IMG.tabHeroes,  active: false },
    { label: 'PROFILE', src: IMG.tabProfile, active: false },
  ];
  return (
    <div style={{ display: 'flex', background: UI.panelSolid, borderTop: `1px solid ${UI.border}`, paddingBottom: 8, paddingTop: 4 }}>
      {tabs.map((t) => {
        const col = t.active ? UI.jade : UI.textDim;
        return (
          <div key={t.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer' }}>
            <img src={t.src} style={{ width: 46, height: 31, objectFit: 'contain' }} />
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: GAME_FONT, color: col, letterSpacing: 0.8, lineHeight: 1 }}>
              {t.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function MainHubPreview() {
  return (
    <div style={{
      width: 390, height: 844,
      display: 'flex', flexDirection: 'column',
      background: UI.bg,
      fontFamily: SANS,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Content stack */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1 }}>
        <Header />
        <LocationBanner />
        <NarratorCard />
        <Arena />
        <HeroPanel />
        <EnterWardBtn />
      </div>
      {/* Tab bar pinned */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <TabBar />
      </div>
    </div>
  );
}
