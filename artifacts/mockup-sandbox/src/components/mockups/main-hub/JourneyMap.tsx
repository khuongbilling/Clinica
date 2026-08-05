// Journey Map — canvas preview
// Mid-game state: Chapter 1 active & expanded (3 nodes done, 1 "next", 2 locked),
// Chapter 2 locked, Chapters 3–10 locked with compact cards.

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#0B1825',
  surface:      '#0C0E12',
  surfaceSecondary: '#161A1F',
  card:         '#192C3C',
  panel:        '#122030',
  onSurface:    '#E8EAF0',
  onSecondary:  '#C8CDD8',
  onTertiary:   '#7A8494',
  border:       '#252B34',
  brand:        '#D4AF37',  // legacy gold
  inkGold:      '#D4A853',  // Ink & Mist gold
  goldSoft:     '#F0D888',
  jade:         '#3DC4A8',
  air:          '#B0DEFF',
  river:        '#06B6D4',
  error:        '#EF4444',
  mind:         '#A78BFA',
  protection:   '#34D399',
  growth:       '#F472B6',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const R  = { sm: 4, md: 8, lg: 16, pill: 999 };

// Chapter accent colors (Ink & Mist palette)
const CH_ACCENT: Record<number, string> = {
  1:  '#D4A853',   // gold
  2:  '#A78BFA',   // lavender
  3:  '#B0DEFF',   // sky blue
  4:  '#EF4444',   // crimson
  5:  '#34D399',   // emerald
  6:  '#06B6D4',   // cyan
  7:  '#F97316',   // orange
  8:  '#8B5CF6',   // violet
  9:  '#06B6D4',   // teal / real-ward cyan
  10: '#D4A853',   // gold phase finale
};

const CH_THEME: Record<number, string> = {
  1: 'The Fading Apprentice',
  2: 'The First Ward Rotation',
  3: 'Breath Before Battle',
  4: 'Code Rush',
  5: 'Building the Sanctuary',
  6: 'Beyond the Ward Walls',
  7: 'The Fever Season',
  8: 'Crisis Protocol',
  9: 'Real Ward Begins',
  10: 'Phase Finale',
};

const CH_LEVEL: Record<number, number> = { 1:1, 2:2, 3:4, 4:6, 5:7, 6:8, 7:9, 8:10, 9:12, 10:14 };

// ── Asset paths ───────────────────────────────────────────────────────────────
const BASE = '/__mockup/images';
const NODES = {
  battle:   `${BASE}/node-battle.png`,
  memory:   `${BASE}/node-memory.png`,
  lesson:   `${BASE}/node-lesson.png`,
  boss:     `${BASE}/node-boss.png`,
  reward:   `${BASE}/node-reward.png`,
  challenge:`${BASE}/node-challenge.png`,
};
const BG = {
  ch1: `${BASE}/map-bg-ch1.png`,
  ch2: `${BASE}/map-bg-ch2.png`,
  ch3: `${BASE}/map-bg-ch3.png`,
};
const HERO_TRAVELER = `${BASE}/hero-traveler.png`;

// ── Node shape component ───────────────────────────────────────────────────────
type NodeStatus = 'complete' | 'next' | 'available' | 'locked';
type NodeType = 'battle' | 'memory' | 'lesson' | 'boss' | 'reward' | 'challenge' | 'story';

const NODE_IMG: Record<string, string> = {
  battle:   NODES.battle,
  story:    NODES.memory,
  memory:   NODES.memory,
  lesson:   NODES.lesson,
  boss:     NODES.boss,
  reward:   NODES.reward,
  challenge:NODES.challenge,
};

const NODE_LABEL: Record<string, string> = {
  battle:   'Ward Shift',
  story:    'Story',
  memory:   'Memory',
  lesson:   'Lesson',
  boss:     'Boss Trial',
  reward:   'Reward',
  challenge:'Challenge',
};

function MapNode({
  type, status, accent, r = 44, stars = 0, showHero = false,
}: {
  type: string; status: NodeStatus; accent: string; r?: number; stars?: number; showHero?: boolean;
}) {
  const SIZE     = r * 2;
  const isLocked = status === 'locked';
  const isDone   = status === 'complete';
  const isNext   = status === 'next';
  const isBoss   = type === 'boss' || type === 'mini_boss';
  const glowColor = isBoss ? '#C0392B' : C.inkGold;
  const bloomSize = SIZE + 36;

  return (
    <div style={{ width: SIZE, height: SIZE, position: 'relative', flexShrink: 0 }}>
      {/* Glow bloom for "next" */}
      {isNext && (
        <>
          <div style={{ position: 'absolute', width: bloomSize, height: bloomSize, borderRadius: bloomSize / 2, background: glowColor + '30', left: (SIZE - bloomSize) / 2, top: (SIZE - bloomSize) / 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: SIZE + 16, height: SIZE + 16, borderRadius: (SIZE + 16) / 2, background: glowColor + '20', left: -8, top: -8, pointerEvents: 'none' }} />
        </>
      )}

      {/* Ink-seal backing circle */}
      <div style={{
        position: 'absolute', width: SIZE * 0.94, height: SIZE * 0.94,
        borderRadius: SIZE * 0.94 / 2, left: SIZE * 0.03, top: SIZE * 0.03,
        background: isLocked ? '#1a100822' : isDone ? '#3d220844' : isNext ? '#2a1a0840' : '#20140830',
        border: `${isDone ? 1.5 : 1}px solid ${isDone ? '#D4A853AA' : isNext ? '#D4A85366' : isLocked ? '#3d2a1444' : '#D4A85328'}`,
        pointerEvents: 'none',
      }} />
      {/* Concentric rings */}
      {!isLocked && <div style={{ position: 'absolute', width: SIZE * 0.74, height: SIZE * 0.74, borderRadius: SIZE * 0.74 / 2, left: SIZE * 0.13, top: SIZE * 0.13, border: `0.8px solid ${isDone ? '#D4A85355' : '#D4A85522'}`, pointerEvents: 'none' }} />}
      {!isLocked && <div style={{ position: 'absolute', width: SIZE * 0.54, height: SIZE * 0.54, borderRadius: SIZE * 0.54 / 2, left: SIZE * 0.23, top: SIZE * 0.23, border: `0.8px solid ${isDone ? '#D4A85340' : '#D4A85518'}`, pointerEvents: 'none' }} />}

      {/* Node illustration */}
      <img src={NODE_IMG[type] ?? NODES.lesson} style={{ width: SIZE, height: SIZE, objectFit: 'contain', opacity: isLocked ? 0.18 : isDone ? 0.88 : 1, position: 'relative', zIndex: 1, display: 'block' }} />

      {/* Stars (battle nodes) */}
      {stars > 0 && (type === 'battle' || type === 'boss') && (
        <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1, zIndex: 2 }}>
          {[1,2,3].map(s => <span key={s} style={{ fontSize: 9, color: s <= stars ? '#E8C868' : '#8AABB880' }}>{s <= stars ? '★' : '☆'}</span>)}
        </div>
      )}

      {/* LOCKED pill */}
      {isLocked && (
        <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', background: '#2A180E99', borderRadius: 6, border: '1px solid #5a3a2044', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3, zIndex: 2, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 9, color: '#8A6A44' }}>🔒</span>
          <span style={{ fontSize: 7, color: '#8A6A44', fontWeight: 700, letterSpacing: 0.3 }}>LOCKED</span>
        </div>
      )}

      {/* Label band */}
      {!isLocked && (
        <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.62)', borderRadius: 6, padding: '2px 7px', zIndex: 2, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: isDone ? accent + 'BB' : accent, textTransform: 'uppercase' }}>{NODE_LABEL[type] ?? type}</span>
        </div>
      )}

      {/* COMPLETE gold lotus badge */}
      {isDone && (
        <div style={{ position: 'absolute', bottom: -6, right: -6, width: 28, height: 28, borderRadius: 14, background: '#D4A853', border: '1px solid #F0D888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <span style={{ fontSize: 14, color: '#1a0e06', fontWeight: 900, lineHeight: 1 }}>✦</span>
        </div>
      )}

      {/* NEXT ▶ START tag */}
      {isNext && (
        <div style={{ position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)', background: '#D4A853', borderRadius: 5, border: '1px solid #F0D888', padding: '2px 8px', zIndex: 2, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 9, color: '#1a0e06', fontWeight: 900, letterSpacing: 0.6 }}>▶ START</span>
        </div>
      )}

      {/* Hero traveler sprite on "next" node */}
      {showHero && isNext && (
        <img src={HERO_TRAVELER} style={{ position: 'absolute', bottom: SIZE * 0.5, left: SIZE * 0.55, width: 32, height: 32, objectFit: 'contain', zIndex: 3, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
      )}
    </div>
  );
}

// ── Zigzag Chapter 1 path ─────────────────────────────────────────────────────
interface PathNode {
  type: string;
  status: NodeStatus;
  stars?: number;
  title: string;
}

const CH1_NODES: PathNode[] = [
  { type: 'story',     status: 'complete', title: 'The Recall Awakens' },
  { type: 'challenge', status: 'complete', title: 'Your First Triage Call',  stars: 3 },
  { type: 'memory',    status: 'complete', title: 'The Right Order' },
  { type: 'battle',    status: 'next',     title: 'First Shift — Dehydration', stars: 0 },
  { type: 'story',     status: 'locked',   title: "Mentor Bai's Warning" },
  { type: 'boss',      status: 'locked',   title: 'Trial: The Fluid Phantom' },
];

function Chapter1Map({ accent }: { accent: string }) {
  // Nodes zigzag: R → L → R → L → R → L (center column → alternating sides)
  const W = 358; // available width inside card
  const r = 42;  // node radius
  const D = r * 2; // node diameter
  const gapY = 68; // vertical gap between node centers
  const centerX = W / 2;
  const leftX   = W * 0.22;
  const rightX  = W * 0.78;

  // Zigzag x positions
  const xPos = [centerX, rightX, leftX, rightX, leftX, centerX];
  const totalH = CH1_NODES.length * (D + gapY) + 20;

  // Build SVG path points
  const points = CH1_NODES.map((_, i) => ({ x: xPos[i], y: 20 + i * (D + gapY) + r }));

  return (
    <div style={{ position: 'relative', width: W, margin: '0 auto', paddingBottom: 16 }}>
      {/* SVG connecting path */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: W, height: totalH, pointerEvents: 'none' }}>
        {points.slice(0, -1).map((p, i) => {
          const next = points[i + 1];
          const midY = (p.y + next.y) / 2;
          const pathD = `M ${p.x} ${p.y + r} C ${p.x} ${midY}, ${next.x} ${midY}, ${next.x} ${next.y - r}`;
          const isDoneSegment = CH1_NODES[i].status === 'complete';
          const isNextSegment = CH1_NODES[i + 1].status === 'next';
          return (
            <path
              key={i}
              d={pathD}
              fill="none"
              stroke={isDoneSegment || isNextSegment ? accent + '90' : '#3d2a1444'}
              strokeWidth={isDoneSegment ? 2.5 : 1.5}
              strokeDasharray={isDoneSegment ? undefined : '4 4'}
            />
          );
        })}
        {/* Stone-stamp dots along paths */}
        {points.slice(0, -1).map((p, i) => {
          const next = points[i + 1];
          const midY = (p.y + next.y) / 2;
          const midX = (p.x + next.x) / 2;
          const isDoneSegment = CH1_NODES[i].status === 'complete';
          return (
            <circle key={`dot-${i}`} cx={midX} cy={midY} r={3}
              fill={isDoneSegment ? accent + '70' : '#3d2a1440'} />
          );
        })}
      </svg>

      {/* Nodes */}
      {CH1_NODES.map((node, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: xPos[i] - r,
          top: 20 + i * (D + gapY),
        }}>
          <MapNode
            type={node.type} status={node.status} accent={accent}
            r={r} stars={node.stars}
            showHero={node.status === 'next'}
          />
        </div>
      ))}

      {/* Spacer */}
      <div style={{ height: totalH + 20 }} />
    </div>
  );
}

// ── Chapter card ──────────────────────────────────────────────────────────────
function ChapterCard({
  num, status, expanded, battlesCleared = 0, battlesTotal = 3, progressPct = 0,
}: {
  num: number;
  status: 'active' | 'locked' | 'complete';
  expanded?: boolean;
  battlesCleared?: number;
  battlesTotal?: number;
  progressPct?: number;
}) {
  const accent = status === 'locked' ? C.onTertiary : CH_ACCENT[num];
  const bg = [BG.ch1, BG.ch2, BG.ch3][num - 1] ?? null;
  const isLocked = status === 'locked';
  const isDone   = status === 'complete';

  return (
    <div style={{ marginBottom: 0 }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: SP.sm,
        background: C.surface, borderRadius: R.lg,
        border: `1px solid ${isLocked ? C.border : accent + '50'}`,
        padding: SP.sm, position: 'relative', overflow: 'hidden',
        ...(isDone ? { opacity: 0.8 } : {}),
      }}>
        {/* Accent glow overlay for active chapters */}
        {!isLocked && !isDone && (
          <div style={{ position: 'absolute', inset: 0, background: accent + '12', pointerEvents: 'none', borderRadius: R.lg }} />
        )}

        {/* Chapter thumbnail */}
        <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', border: `1px solid ${isLocked ? C.border : accent + '70'}`, flexShrink: 0, position: 'relative', opacity: isDone ? 0.65 : 1 }}>
          {bg ? (
            <img src={bg} style={{ width: 40, height: 40, objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: 40, height: 40, background: C.panel }} />
          )}
          {isLocked && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}>
              <span style={{ fontSize: 11, color: '#fff' }}>🔒</span>
            </div>
          )}
          {isDone && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
              <span style={{ fontSize: 13, color: C.protection }}>✓</span>
            </div>
          )}
        </div>

        {/* Chapter info */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: 0.5 }}>CH.{num}</span>
            {num <= 8 && <span style={{ fontSize: 9, color: '#8EAEC8', background: '#3A4A5522', border: '1px solid #5A7A9A55', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>SIMULATION</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isLocked ? C.onTertiary : C.onSurface, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {CH_THEME[num]}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.onTertiary }}>{6} parts · Lv.{CH_LEVEL[num]}+</span>
            {battlesCleared > 0 && !isLocked && (
              <span style={{ fontSize: 10, color: accent, background: accent + '12', border: `1px solid ${accent}60`, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>★ {battlesCleared}/{battlesTotal}</span>
            )}
          </div>
          {/* Progress bar */}
          {!isLocked && progressPct > 0 && (
            <div style={{ marginTop: 4, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: isDone ? C.protection : accent, borderRadius: 2 }} />
            </div>
          )}
        </div>

        {/* Gift icon (chapter chest) */}
        {!isLocked && (
          <span style={{ fontSize: 16, color: C.inkGold, opacity: 0.7, flexShrink: 0, position: 'relative', zIndex: 1 }}>🎁</span>
        )}
        {/* Chevron */}
        <span style={{ fontSize: 14, color: isLocked ? C.onTertiary : accent, flexShrink: 0, position: 'relative', zIndex: 1 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded content (Chapter 1 zigzag map) */}
      {expanded && (
        <div style={{ background: C.surface, border: `1px solid ${CH_ACCENT[num]}30`, borderTop: 'none', borderBottomLeftRadius: R.lg, borderBottomRightRadius: R.lg, paddingTop: 8 }}>
          {/* Background image overlay */}
          {bg && (
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              <img src={bg} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.08, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <Chapter1Map accent={CH_ACCENT[num]} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Connector between chapters ─────────────────────────────────────────────────
function Connector({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '5px 0' }}>
      {[0,1,2,3].map(k => (
        <div key={k} style={{ width: 5, height: 5, borderRadius: 3, background: accent + '65' }} />
      ))}
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
function PageHeader() {
  return (
    <div style={{ background: C.bg, borderBottom: `1px solid ${C.jade}18`, padding: `${SP.sm}px ${SP.md}px`, display: 'flex', alignItems: 'center', gap: SP.sm }}>
      <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 18, color: C.jade }}>←</span>
      </div>
      <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#F6F0E4', letterSpacing: 0.3 }}>Chapter Journey</span>
      <span style={{ fontSize: 12, color: C.inkGold + 'AA', fontWeight: 700, letterSpacing: 0.5 }}>PHASE 1</span>
    </div>
  );
}

function PhaseHeader() {
  return (
    <div style={{ padding: `${SP.xl}px ${SP.md}px ${SP.lg}px`, textAlign: 'center' }}>
      {/* Decorative divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: SP.md }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${C.inkGold}50)` }} />
        <span style={{ color: C.inkGold + '90', fontSize: 10 }}>✦</span>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${C.inkGold}50)` }} />
      </div>
      {/* Phase badge */}
      <div style={{ display: 'inline-block', background: C.inkGold + '18', border: `1px solid ${C.inkGold}55`, borderRadius: R.pill, padding: '3px 12px', marginBottom: SP.sm }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.inkGold, letterSpacing: 1.2 }}>PHASE 1</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#F6F0E4', marginBottom: SP.sm }}>Kingdom of Healing</div>
      <div style={{ fontSize: 13, color: C.onSecondary, lineHeight: 1.55, maxWidth: 300, margin: '0 auto' }}>
        Ten chapters walk your healer from a trembling apprentice to a seasoned ward guardian. Each chapter opens a new clinical truth.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: SP.sm }}>
        <span style={{ fontSize: 10, color: '#D4A85390' }}>👤</span>
        <span style={{ fontSize: 11, color: '#D4A85390' }}>10 chapters · your healer walks this path</span>
        <span style={{ fontSize: 10, color: '#D4A85390' }}>🌿</span>
      </div>
    </div>
  );
}

// ── TabBar ────────────────────────────────────────────────────────────────────
function TabBar() {
  const tabs = [
    { icon: '🏠', label: 'Home' },
    { icon: '📚', label: 'Study' },
    { icon: '⚔', label: 'Shift', active: true },
    { icon: '👥', label: 'Heroes' },
    { icon: '👤', label: 'Profile' },
  ];
  return (
    <div style={{ display: 'flex', background: C.bg, borderTop: `1px solid ${C.jade}18`, paddingBottom: 8, paddingTop: 4, flexShrink: 0 }}>
      {tabs.map(t => (
        <div key={t.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 0', opacity: t.active ? 1 : 0.5 }}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <span style={{ fontSize: 9, fontWeight: t.active ? 800 : 600, color: t.active ? C.jade : '#948BA6', letterSpacing: 0.3 }}>{t.label.toUpperCase()}</span>
          {t.active && <div style={{ width: 4, height: 4, borderRadius: 2, background: C.jade }} />}
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function JourneyMapPreview() {
  return (
    <div style={{
      width: 390, height: 844, display: 'flex', flexDirection: 'column',
      background: C.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
    }}>
      {/* Fixed header */}
      <PageHeader />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <PhaseHeader />

        <div style={{ padding: `0 ${SP.md}px ${SP.xl}px` }}>
          {/* CH1 — ACTIVE & EXPANDED */}
          <ChapterCard num={1} status="active" expanded battlesCleared={2} battlesTotal={3} progressPct={50} />
          <Connector accent={CH_ACCENT[1]} />

          {/* CH2 — LOCKED */}
          <ChapterCard num={2} status="locked" />
          <Connector accent={C.border} />

          {/* CH3 — LOCKED */}
          <ChapterCard num={3} status="locked" />
          <Connector accent={C.border} />

          {/* CH4–5 collapsed for brevity */}
          <ChapterCard num={4} status="locked" />
          <Connector accent={C.border} />
          <ChapterCard num={5} status="locked" />
          <Connector accent={C.border} />

          {/* CH6–10 collapsed */}
          {[6,7,8,9,10].map((n, i, arr) => (
            <div key={n}>
              <ChapterCard num={n} status="locked" />
              {i < arr.length - 1 && <Connector accent={C.border} />}
            </div>
          ))}

          {/* Phase 2 teaser */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, margin: `${SP.lg}px 0 ${SP.sm}px`, padding: SP.md, background: C.surface, borderRadius: R.lg, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 18, color: C.onTertiary }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.onSecondary }}>Phase 2 — Coming Soon</div>
              <div style={{ fontSize: 12, color: C.onTertiary, lineHeight: 1.4 }}>Complete Chapter 10 and reach a higher level to unlock the next era.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <TabBar />
    </div>
  );
}
