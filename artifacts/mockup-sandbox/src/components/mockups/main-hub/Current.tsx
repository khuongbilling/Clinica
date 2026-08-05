// Main Hub — live canvas preview
// Represents the "mid-game" state: Lv.3 player, hero recruited, Ward Shift unlocked.
// Pure web React — no React Native dependencies.

import { CSSProperties, ReactNode } from 'react';

// ── Design tokens (from frontend/src/theme/) ──────────────────────────────────
const COLORS = {
  surface: '#0C0E12',
  surfaceSecondary: '#161A1F',
  onSurface: '#E8EAF0',
  onSurfaceSecondary: '#C8CDD8',
  onSurfaceTertiary: '#7A8494',
  brand: '#D4AF37',
  error: '#EF4444',
  air: '#B0DEFF',
  river: '#06B6D4',
  fire: '#F97316',
  mind: '#A78BFA',
  forge: '#D97706',
  protection: '#34D399',
  growth: '#F472B6',
};

const UI = {
  bgDeep: '#130F1C',
  sanctuaryBg: '#0B1825',
  sanctuaryPanel: '#122030',
  sanctuaryCard: '#192C3C',
  jade: '#3DC4A8',
  gold: '#E8C868',
  goldSoft: '#F3DE97',
  text: '#F6F0E4',
  textSoft: '#CFC6DC',
  textDim: '#948BA6',
  border: 'rgba(232,200,104,0.20)',
  borderStrong: 'rgba(232,200,104,0.42)',
  divider: 'rgba(246,240,228,0.08)',
  panel: '#241C34',
  onGold: '#1B1308',
  onTeal: '#082019',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const R = { sm: 4, md: 8, lg: 16, pill: 999, card: 18 };

// ── Asset paths (vite base = /__mockup/) ─────────────────────────────────────
const IMG = {
  hubBg:          '/__mockup/images/home_hub_bg.png',
  heroSprite:     '/__mockup/images/hero-sprite.png',
  stamina:        '/__mockup/images/icon-stamina.png',
  crowns:         '/__mockup/images/icon-crowns.png',
  rounds:         '/__mockup/images/emblem-daily-rounds.png',
  journey:        '/__mockup/images/emblem-journey.png',
  milestones:     '/__mockup/images/emblem-milestones.png',
  summoning:      '/__mockup/images/emblem-summoning.png',
  wardDefense:    '/__mockup/images/emblem-ward-defense.png',
};

// ── Mock player data ──────────────────────────────────────────────────────────
const PLAYER = {
  name: 'Dr. Chen',
  level: 3,
  class: 'Medic',
  rank: 'Junior Clinician',
  stamina: 14,
  staminaMax: 20,
  crowns: 120,
  xp: 340,
  xpNext: 500,
  aptitudeColor: COLORS.river,
};

const HERO = {
  name: 'Acute Step Warden',
  title: 'Physiotherapist',
  element: 'River',
  elementColor: COLORS.river,
  level: 8,
  star: 3,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Icon({ name, size = 16, color = UI.textDim }: { name: string; size?: number; color?: string }) {
  // Map Ionicons name → unicode emoji / SVG-char fallback for web
  const icons: Record<string, string> = {
    'sparkles': '✦',
    'person-circle': '◉',
    'flash': '⚡',
    'medical': '✚',
    'map': '🗺',
    'gift-outline': '🎁',
    'trophy-outline': '🏆',
    'skull-outline': '☠',
    'shield-checkmark': '🛡',
    'arrow-forward': '→',
    'chevron-forward': '›',
    'lock-closed': '🔒',
    'close': '×',
    'flag': '⚑',
    'settings-outline': '⚙',
    'star': '★',
    'star-outline': '☆',
    'help-circle-outline': '?',
    'question': '?',
    'book-outline': '📖',
    'people-outline': '👥',
  };
  return (
    <span style={{ fontSize: size, color, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
      {icons[name] || '•'}
    </span>
  );
}

function StaminaBar() {
  const pct = (PLAYER.stamina / PLAYER.staminaMax) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: UI.sanctuaryCard, borderRadius: R.pill, paddingLeft: 7, paddingRight: 9, paddingTop: 4, paddingBottom: 4, border: `1px solid ${UI.jade}30` }}>
      <img src={IMG.stamina} style={{ width: 14, height: 14, objectFit: 'contain' }} />
      <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: UI.jade, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: UI.jade, fontWeight: 700 }}>{PLAYER.stamina}</span>
    </div>
  );
}

function CrownChip() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: UI.sanctuaryCard, borderRadius: R.pill, paddingLeft: 7, paddingRight: 9, paddingTop: 4, paddingBottom: 4, border: `1px solid ${UI.gold}30` }}>
      <img src={IMG.crowns} style={{ width: 14, height: 14, objectFit: 'contain' }} />
      <span style={{ fontSize: 11, color: UI.gold, fontWeight: 700 }}>{PLAYER.crowns}</span>
    </div>
  );
}

function PlayerHeaderBar() {
  const xpPct = (PLAYER.xp / PLAYER.xpNext) * 100;
  return (
    <div style={{ background: UI.sanctuaryBg, borderBottom: `1px solid ${UI.jade}18`, paddingTop: 8, paddingBottom: 0 }}>
      {/* Row 1: identity + chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, paddingLeft: SP.md, paddingRight: SP.md, paddingBottom: 6 }}>
        {/* Avatar */}
        <div style={{ width: 34, height: 34, borderRadius: 17, border: `2px solid ${PLAYER.aptitudeColor}70`, background: UI.sanctuaryCard, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 16, color: PLAYER.aptitudeColor }}>◉</span>
        </div>
        {/* Name + rank */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: UI.text, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {PLAYER.name} <span style={{ color: UI.jade, fontWeight: 600, fontSize: 12 }}>Lv.{PLAYER.level} {PLAYER.class}</span>
          </div>
          <div style={{ fontSize: 11, color: UI.textDim }}>{PLAYER.rank}</div>
        </div>
        {/* Chips */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <StaminaBar />
          <CrownChip />
        </div>
      </div>
      {/* Row 2: XP bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${xpPct}%`, height: '100%', background: `linear-gradient(90deg, ${PLAYER.aptitudeColor}80, ${PLAYER.aptitudeColor})` }} />
      </div>
    </div>
  );
}

function SceneLabel() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `6px ${SP.md}px 4px` }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 1 }} />
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8 }}>◆</span>
      <span style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 700, letterSpacing: 1.6, opacity: 0.85 }}>GRAND WARD ATRIUM</span>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8 }}>◆</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 1 }} />
    </div>
  );
}

function NarratorCard() {
  return (
    <div style={{ margin: `${SP.xs}px ${SP.md}px 2px`, border: `1.5px solid ${UI.jade}55`, borderRadius: R.lg, background: UI.sanctuaryCard, padding: SP.md, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: SP.md }}>
        {/* Portrait */}
        <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${UI.jade}AA`, background: UI.sanctuaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 22 }}>🩺</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 10 }}>✦</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: UI.jade, letterSpacing: 1.1 }}>THE SYSTEM</span>
          </div>
          <div style={{ fontSize: 13, color: COLORS.onSurface, lineHeight: 1.55 }}>
            Ward Shift unlocked — step into the ward for your first simulation.
          </div>
        </div>
      </div>
      {/* Objective chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `rgba(61,196,168,0.13)`, border: `1px solid ${UI.jade}55`, borderRadius: R.md, padding: '7px 10px' }}>
        <span style={{ fontSize: 11, color: UI.jade }}>⚑</span>
        <span style={{ flex: 1, fontSize: 12, color: COLORS.onSurface, lineHeight: 1.5 }}>
          <span style={{ color: UI.jade, fontWeight: 800, letterSpacing: 0.6, fontSize: 11 }}>OBJECTIVE  </span>
          Complete your first Ward Shift simulation
        </span>
      </div>
      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP.sm, background: UI.jade, borderRadius: R.md, padding: `${SP.md}px`, cursor: 'pointer' }}>
        <span style={{ color: UI.onTeal, fontSize: 13, fontWeight: 800, letterSpacing: 0.8 }}>ENTER WARD SHIFT</span>
        <span style={{ color: UI.onTeal, fontSize: 14 }}>→</span>
      </div>
    </div>
  );
}

function EmblemButton({
  src, label, color, badge, live,
}: {
  src: string; label: string; color: string; badge?: number; live?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, cursor: 'pointer' }}>
      <div style={{ width: 58, height: 78, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,9,16,0.52)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
        <img src={src} style={{ width: 56, height: 75, objectFit: 'contain', display: 'block' }} />
        {/* Label overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 2px', textAlign: 'center', background: 'rgba(4,7,12,0.78)' }}>
          <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.8, color, textTransform: 'uppercase' }}>{label}</span>
        </div>
        {/* Live dot */}
        {live && (
          <div style={{ position: 'absolute', top: 2, right: 2, width: 9, height: 9, borderRadius: 5, background: '#34D399', border: `1.5px solid ${COLORS.surface}` }} />
        )}
        {/* Badge */}
        {badge && badge > 0 ? (
          <div style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, background: COLORS.error, border: `1.5px solid ${COLORS.surface}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>{badge}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeftColumn() {
  return (
    <div style={{ width: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', padding: `${SP.sm}px 0` }}>
      <EmblemButton src={IMG.rounds} label="Rounds" color={UI.gold} badge={3} />
      <EmblemButton src={IMG.journey} label="Journey" color={COLORS.river} />
      <EmblemButton src={IMG.milestones} label="Goals" color={COLORS.protection} />
    </div>
  );
}

function RightColumn() {
  return (
    <div style={{ width: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', padding: `${SP.sm}px 0` }}>
      <EmblemButton src={IMG.summoning} label="Recruit" color={UI.gold} live />
      <EmblemButton src={IMG.wardDefense} label="Defense" color={COLORS.air} />
    </div>
  );
}

function HeroCenter() {
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <img
        src={IMG.heroSprite}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom center' }}
      />
      {/* Tap hint */}
      <div style={{ position: 'absolute', bottom: SP.sm, right: SP.sm, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(12,14,18,0.55)', borderRadius: R.pill, padding: '3px 7px' }}>
        <div style={{ width: 5, height: 5, borderRadius: 3, background: HERO.elementColor, opacity: 0.85 }} />
        <span style={{ color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.3 }}>TAP TO ACT</span>
      </div>
    </div>
  );
}

function HeroInfoPanel() {
  const xpPct = 62; // 62% into current hero level
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, margin: `${SP.xs}px ${SP.md}px 0`, background: UI.sanctuaryCard, borderRadius: R.card, padding: SP.md, border: `1.5px solid ${HERO.elementColor}30`, position: 'relative', overflow: 'hidden' }}>
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: HERO.elementColor, opacity: 0.85 }} />
      {/* Element badge */}
      <div style={{ border: `1px solid ${HERO.elementColor}90`, background: `${HERO.elementColor}20`, borderRadius: R.pill, padding: '4px 9px', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: HERO.elementColor, letterSpacing: 0.4 }}>{HERO.element}</span>
      </div>
      {/* Hero info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: UI.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{HERO.name}</div>
        <div style={{ fontSize: 12, color: UI.textDim }}>{HERO.title}</div>
      </div>
      {/* XP column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <div style={{ width: 64, height: 4, borderRadius: 2, background: UI.divider, overflow: 'hidden' }}>
          <div style={{ width: `${xpPct}%`, height: '100%', background: HERO.elementColor, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 11, color: UI.textDim, letterSpacing: 0.2 }}>340/500 XP</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: `${HERO.elementColor}AA`, letterSpacing: 0.3 }}>TAP TO CHANGE</span>
      </div>
    </div>
  );
}

function EnterWardButton() {
  return (
    <div style={{ margin: `${SP.sm}px ${SP.md}px ${SP.xs}px` }}>
      <div style={{ background: UI.jade, borderRadius: R.lg, padding: `${SP.md + 2}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP.sm, cursor: 'pointer', boxShadow: `0 4px 14px ${UI.jade}55` }}>
        <span style={{ fontSize: 16, color: UI.onTeal }}>✚</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: UI.onTeal, letterSpacing: 1 }}>ENTER THE WARD</span>
      </div>
    </div>
  );
}

function TabBar() {
  const tabs = [
    { icon: '🏠', label: 'Home', active: true },
    { icon: '📚', label: 'Study' },
    { icon: '⚔', label: 'Shift' },
    { icon: '👥', label: 'Heroes' },
    { icon: '👤', label: 'Profile' },
  ];
  return (
    <div style={{ display: 'flex', background: UI.sanctuaryBg, borderTop: `1px solid ${UI.jade}18`, paddingBottom: 8, paddingTop: 4 }}>
      {tabs.map((t) => (
        <div key={t.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 0', cursor: 'pointer', opacity: t.active ? 1 : 0.5 }}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <span style={{ fontSize: 9, fontWeight: t.active ? 800 : 600, color: t.active ? UI.jade : UI.textDim, letterSpacing: 0.3 }}>{t.label.toUpperCase()}</span>
          {t.active && <div style={{ width: 4, height: 4, borderRadius: 2, background: UI.jade }} />}
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MainHubPreview() {
  return (
    <div style={{ width: 390, height: 844, display: 'flex', flexDirection: 'column', background: UI.sanctuaryBg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* ── Background ── */}
      <img
        src={IMG.hubBg}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', pointerEvents: 'none' }}
      />
      {/* Edge vignettes */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(4,6,10,0.45) 0%, transparent 18%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(4,6,10,0.45) 0%, transparent 18%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(4,6,10,0.40) 0%, transparent 22%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%', background: 'linear-gradient(to top, rgba(4,6,10,0.55), transparent)', pointerEvents: 'none' }} />

      {/* ── Content (scrollable zone, placed above bg) ── */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1 }}>
        {/* Player header */}
        <PlayerHeaderBar />

        {/* Tutorial row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `${SP.xs}px ${SP.lg}px 0` }}>
          <div style={{ width: 34, height: 34, borderRadius: 17, background: UI.sanctuaryCard, border: `1px solid ${UI.jade}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span style={{ fontSize: 14, color: UI.jade }}>?</span>
          </div>
        </div>

        {/* Scene label */}
        <SceneLabel />

        {/* Narrator guide — objective card */}
        <NarratorCard />

        {/* Arena */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
          <LeftColumn />
          <HeroCenter />
          <RightColumn />
        </div>

        {/* Hero info panel */}
        <HeroInfoPanel />

        {/* Enter Ward button */}
        <EnterWardButton />
      </div>

      {/* Tab bar */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <TabBar />
      </div>
    </div>
  );
}
