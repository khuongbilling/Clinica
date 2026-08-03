import { useEffect, useRef, type RefObject } from 'react';

// ─── Shared Data ────────────────────────────────────────────────────────────

type NodeType = 'story' | 'battle' | 'memory' | 'reflection' | 'boss';
type NodeState = 'done' | 'next' | 'locked';

interface MapNode {
  type: NodeType;
  state: NodeState;
  label: string;
  stars?: number; // 0-3, shown for battle nodes that are done
}

const NODES: MapNode[] = [
  { type: 'story',      state: 'done',   label: 'The Arrival' },
  { type: 'battle',     state: 'done',   label: 'Triage Rush',    stars: 3 },
  { type: 'memory',     state: 'done',   label: 'Recall' },
  { type: 'battle',     state: 'next',   label: 'Fever Ward',     stars: 0 },
  { type: 'reflection', state: 'locked', label: 'Reflection' },
  { type: 'boss',       state: 'locked', label: 'Corruption' },
];

// Node positions as fraction of canvas width/height
const NODE_POSITIONS = [
  { x: 0.5,  y: 0.10 },
  { x: 0.72, y: 0.24 },
  { x: 0.58, y: 0.40 },
  { x: 0.30, y: 0.54 },
  { x: 0.55, y: 0.68 },
  { x: 0.50, y: 0.84 },
];

const NODE_R = 26; // base node radius

// ─── Phone Frame Wrapper ─────────────────────────────────────────────────────

interface PhoneFrameProps {
  accentColor: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
}

function PhoneFrame({ accentColor, canvasRef, width, height }: PhoneFrameProps) {
  const bezelX = 10;
  const bezelY = 16;
  const notchW = 80;
  const notchH = 22;
  const indicatorW = 50;
  const indicatorH = 5;

  return (
    <div style={{
      position: 'relative',
      width: width + bezelX * 2,
      height: height + bezelY * 2 + notchH + indicatorH + 4,
      background: '#0d0d10',
      borderRadius: 40,
      boxShadow: `0 0 0 2px #2a2a35, 0 8px 48px rgba(0,0,0,0.7), 0 0 40px ${accentColor}40`,
      flexShrink: 0,
    }}>
      {/* Notch */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: notchW,
        height: notchH,
        background: '#0d0d10',
        borderRadius: '0 0 14px 14px',
        zIndex: 10,
      }} />
      {/* Screen */}
      <div style={{
        position: 'absolute',
        top: bezelY + notchH,
        left: bezelX,
        borderRadius: 28,
        overflow: 'hidden',
        width: width,
        height: height,
        border: `1px solid #2a2a35`,
      }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ display: 'block' }}
        />
      </div>
      {/* Home indicator */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        width: indicatorW,
        height: indicatorH,
        background: '#3a3a45',
        borderRadius: 3,
      }} />
    </div>
  );
}

// ─── Design Notes Card ───────────────────────────────────────────────────────

interface DesignNotesProps {
  title: string;
  tagline: string;
  palette: string;
  path: string;
  nodes: string;
  feel: string;
  accentColor: string;
}

function DesignNotes({ title, tagline, palette, path, nodes, feel, accentColor }: DesignNotesProps) {
  return (
    <div style={{
      width: 260,
      background: '#12111a',
      border: `1px solid ${accentColor}55`,
      borderRadius: 12,
      padding: '14px 16px',
      fontFamily: "'Inter', sans-serif",
      flexShrink: 0,
    }}>
      <div style={{ color: accentColor, fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{title}</div>
      <div style={{ color: '#666', fontSize: 10, fontStyle: 'italic', marginBottom: 10 }}>{tagline}</div>
      {[
        ['Palette', palette],
        ['Path', path],
        ['Nodes', nodes],
        ['Feel', feel],
      ].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
          <div style={{ color: '#555', fontSize: 10, minWidth: 44, paddingTop: 1 }}>{k}</div>
          <div style={{ color: '#c0bbc8', fontSize: 10, lineHeight: 1.45 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared spec row ─────────────────────────────────────────────────────────

function SpecRow() {
  const specs = [
    {
      title: 'Node Types',
      desc: '◎ Story  ✙ Battle  ✦ Memory  ◈ Reflection  ⚔ Boss — each gets a distinct glyph icon inside the node seal.',
    },
    {
      title: 'Chapter Nav',
      desc: '← Chapter 1 →  arrow tap loads adjacent chapter. Title centred in nav bar.',
    },
    {
      title: 'Star Rating',
      desc: '★★★ row appears directly below a Battle node that is done. Partial stars for partial score. Hidden on locked.',
    },
    {
      title: 'Claim / Start',
      desc: '"CLAIM" button on done nodes with unclaimed reward. "START" on the next node. Neither overlaps the node circle or label.',
    },
  ];

  return (
    <div style={{
      marginTop: 32,
      width: '100%',
      maxWidth: 900,
      background: '#0e0e16',
      border: '1px solid #2a2a40',
      borderRadius: 14,
      padding: '18px 20px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ color: '#888', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Shared Functional Spec — any chosen direction must satisfy
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
      }}>
        {specs.map((s) => (
          <div key={s.title}>
            <div style={{ color: '#e2dff0', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
            <div style={{ color: '#6a6680', fontSize: 10, lineHeight: 1.55 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function nodeIcon(type: NodeType): string {
  return { story: '◎', battle: '✙', memory: '✦', reflection: '◈', boss: '⚔' }[type];
}

function nodePos(idx: number, W: number, H: number) {
  const p = NODE_POSITIONS[idx];
  return { x: p.x * W, y: p.y * H };
}

// ─── DESIGN A — Ink & Mist ───────────────────────────────────────────────────

function drawInkMist(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;

  // ── Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0e06');
  bg.addColorStop(0.5, '#160c06');
  bg.addColorStop(1, '#0e0804');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ink-wash horizontal bands
  for (let i = 0; i < 6; i++) {
    const y = H * (0.1 + i * 0.15);
    const bGrad = ctx.createLinearGradient(0, y - 12, 0, y + 12);
    bGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bGrad.addColorStop(0.5, `rgba(212,168,83,${0.025 + i * 0.005})`);
    bGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bGrad;
    ctx.fillRect(0, y - 12, W, 24);
  }

  // Gold splatter marks
  const splatterSeeds = [
    [0.15, 0.08], [0.82, 0.14], [0.07, 0.32], [0.91, 0.45],
    [0.12, 0.62], [0.88, 0.72], [0.20, 0.88], [0.75, 0.93],
  ];
  for (const [fx, fy] of splatterSeeds) {
    const sx = fx * W, sy = fy * H;
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let k = 0; k < 5; k++) {
      const angle = (k / 5) * Math.PI * 2 + 0.3;
      const len = 4 + k * 2;
      ctx.strokeStyle = '#D4A853';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#D4A853';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Path — multi-layer brushstroke segments
  for (let i = 0; i < NODES.length - 1; i++) {
    const a = nodePos(i, W, H);
    const b = nodePos(i + 1, W, H);
    const isDone = NODES[i].state === 'done' && NODES[i + 1].state !== 'locked';
    const color = isDone ? '#D4A853' : '#3d2a14';
    const alpha = isDone ? 0.85 : 0.35;

    // 4 brushstroke layers with slight offsets
    const offsets = [
      { dx: -2.5, lw: 4.5, a: alpha * 0.3 },
      { dx: 1.5,  lw: 3.0, a: alpha * 0.5 },
      { dx: -1.0, lw: 2.0, a: alpha * 0.8 },
      { dx: 0.5,  lw: 1.0, a: alpha       },
    ];
    for (const off of offsets) {
      ctx.save();
      ctx.globalAlpha = off.a;
      ctx.strokeStyle = color;
      ctx.lineWidth = off.lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // Slight horizontal wobble via quadratic
      const mx = (a.x + b.x) / 2 + off.dx;
      const my = (a.y + b.y) / 2;
      ctx.moveTo(a.x + off.dx, a.y);
      ctx.quadraticCurveTo(mx, my, b.x + off.dx, b.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Nav bar
  const navH = 44;
  const navGrad = ctx.createLinearGradient(0, 0, 0, navH);
  navGrad.addColorStop(0, '#2a1a0c');
  navGrad.addColorStop(1, '#1a0e06');
  ctx.fillStyle = navGrad;
  ctx.fillRect(0, 0, W, navH);
  ctx.strokeStyle = '#D4A85355';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, navH); ctx.lineTo(W, navH); ctx.stroke();

  ctx.font = "bold 13px 'Playfair Display', serif";
  ctx.fillStyle = '#D4A853';
  ctx.textAlign = 'center';
  ctx.fillText('Chapter I — The Ward', W / 2, navH / 2 + 5);

  ctx.font = "16px 'Playfair Display', serif";
  ctx.fillStyle = hexAlpha('#D4A853', 0.7);
  ctx.textAlign = 'left';
  ctx.fillText('‹', 14, navH / 2 + 6);
  ctx.textAlign = 'right';
  ctx.fillText('›', W - 14, navH / 2 + 6);

  // ── Hero traveller token
  const heroPos = nodePos(3, W, H); // sits near the "next" node
  ctx.save();
  const heroGrad = ctx.createRadialGradient(heroPos.x, heroPos.y - 50, 2, heroPos.x, heroPos.y - 50, 18);
  heroGrad.addColorStop(0, '#D4A853');
  heroGrad.addColorStop(1, '#8a5c1a');
  ctx.fillStyle = heroGrad;
  ctx.beginPath();
  ctx.arc(heroPos.x - 36, heroPos.y - 8, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D4A85388';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = "10px sans-serif";
  ctx.fillStyle = '#1a0e06';
  ctx.textAlign = 'center';
  ctx.fillText('✦', heroPos.x - 36, heroPos.y - 8 + 4);
  ctx.restore();

  // ── Nodes
  for (let i = 0; i < NODES.length; i++) {
    const node = NODES[i];
    const { x, y } = nodePos(i, W, H);

    const isDone   = node.state === 'done';
    const isNext   = node.state === 'next';
    const isLocked = node.state === 'locked';
    const isBoss   = node.type === 'boss';

    const accent = isBoss ? '#c0392b' : '#D4A853';
    const nodeAlpha = isLocked ? 0.35 : 1;

    ctx.save();
    ctx.globalAlpha = nodeAlpha;

    // Outer glow
    if (!isLocked) {
      const glow = ctx.createRadialGradient(x, y, NODE_R - 4, x, y, NODE_R + 16);
      glow.addColorStop(0, hexAlpha(accent, 0.25));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, NODE_R + 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Seal fill
    const fill = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, NODE_R);
    if (isDone) {
      fill.addColorStop(0, '#3d2208');
      fill.addColorStop(1, '#1e1006');
    } else if (isNext) {
      fill.addColorStop(0, '#2a1a08');
      fill.addColorStop(1, '#1a0e04');
    } else {
      fill.addColorStop(0, '#1a1008');
      fill.addColorStop(1, '#0e0804');
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.strokeStyle = isDone ? accent : isNext ? hexAlpha(accent, 0.7) : '#3d2a14';
    ctx.lineWidth = isDone ? 2 : 1.5;
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    ctx.stroke();

    // Inner concentric rings
    for (const r of [NODE_R * 0.78, NODE_R * 0.55]) {
      ctx.strokeStyle = isDone ? hexAlpha(accent, 0.45) : hexAlpha(accent, 0.2);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Icon glyph
    ctx.font = `${isBoss ? 15 : 13}px serif`;
    ctx.fillStyle = isDone ? accent : isNext ? hexAlpha(accent, 0.9) : '#5a3a20';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeIcon(node.type), x, y + 1);

    ctx.restore();

    // Stars for done battle nodes
    if (node.type === 'battle' && isDone && (node.stars ?? 0) > 0) {
      const stars = node.stars ?? 0;
      const starY = y + NODE_R + 11;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < stars ? '#D4A853' : '#3d2a14';
        ctx.fillText('★', x + (s - 1) * 12, starY);
      }
    }

    // Label
    const labelY = y + NODE_R + (node.type === 'battle' && isDone ? 22 : 12);
    ctx.font = isNext ? "bold 9px 'Playfair Display', serif" : "9px 'Playfair Display', serif";
    ctx.fillStyle = isDone ? '#c9a86c' : isNext ? '#D4A853' : '#4a3320';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, x, labelY);

    // START / CLAIM button
    if (isNext) {
      const btnY = labelY + 16;
      ctx.fillStyle = '#D4A853';
      ctx.beginPath();
      roundRect(ctx, x - 22, btnY, 44, 16, 3);
      ctx.fill();
      ctx.font = "bold 8px 'Playfair Display', serif";
      ctx.fillStyle = '#1a0e06';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('START', x, btnY + 8);
    }
  }
}

// ─── DESIGN B — Celestial Ward ───────────────────────────────────────────────

function drawCelestialWard(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W * 0.5, H);
  bg.addColorStop(0, '#06091a');
  bg.addColorStop(0.6, '#080c20');
  bg.addColorStop(1, '#040714');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Nebula washes
  const neb1 = ctx.createRadialGradient(W * 0.25, H * 0.35, 0, W * 0.25, H * 0.35, W * 0.6);
  neb1.addColorStop(0, 'rgba(168,190,255,0.06)');
  neb1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, W, H);

  const neb2 = ctx.createRadialGradient(W * 0.75, H * 0.65, 0, W * 0.75, H * 0.65, W * 0.5);
  neb2.addColorStop(0, 'rgba(255,160,80,0.05)');
  neb2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, W, H);

  // Star field
  const starPositions = [
    [0.07,0.05],[0.18,0.12],[0.33,0.03],[0.47,0.08],[0.61,0.15],
    [0.80,0.06],[0.91,0.18],[0.04,0.28],[0.22,0.38],[0.88,0.30],
    [0.13,0.50],[0.77,0.47],[0.94,0.55],[0.08,0.70],[0.38,0.62],
    [0.66,0.74],[0.85,0.82],[0.25,0.82],[0.52,0.90],[0.73,0.95],
  ];
  for (const [fx, fy] of starPositions) {
    const sx = fx * W, sy = fy * H;
    const micro = ctx.createRadialGradient(sx, sy, 0, sx, sy, 3);
    micro.addColorStop(0, 'rgba(200,215,255,0.9)');
    micro.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = micro;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
    // Core dot
    ctx.fillStyle = 'rgba(230,240,255,0.85)';
    ctx.beginPath();
    ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Path — dashed constellation lines
  ctx.setLineDash([5, 4]);
  for (let i = 0; i < NODES.length - 1; i++) {
    const a = nodePos(i, W, H);
    const b = nodePos(i + 1, W, H);
    const isDoneSegment = NODES[i].state === 'done';

    if (isDoneSegment) {
      // Glow under completed
      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = hexAlpha('#A8BEFF', 0.12);
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = isDoneSegment ? hexAlpha('#A8BEFF', 0.7) : hexAlpha('#A8BEFF', 0.2);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── Nav bar
  const navH = 44;
  ctx.fillStyle = '#080d22ee';
  ctx.fillRect(0, 0, W, navH);
  ctx.strokeStyle = hexAlpha('#A8BEFF', 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, navH); ctx.lineTo(W, navH); ctx.stroke();

  ctx.font = "bold 12px 'Outfit', sans-serif";
  ctx.fillStyle = '#A8BEFF';
  ctx.textAlign = 'center';
  ctx.fillText('Chapter I — The Ward', W / 2, 26);

  ctx.font = "16px 'Outfit', sans-serif";
  ctx.fillStyle = hexAlpha('#A8BEFF', 0.6);
  ctx.textAlign = 'left';
  ctx.fillText('‹', 14, 27);
  ctx.textAlign = 'right';
  ctx.fillText('›', W - 14, 27);

  // Progress dots
  for (let d = 0; d < 5; d++) {
    const dx = W / 2 + (d - 2) * 10;
    ctx.beginPath();
    ctx.arc(dx, 38, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = d < 2 ? '#A8BEFF' : hexAlpha('#A8BEFF', 0.25);
    ctx.fill();
  }

  // ── Hero token
  const heroPos = nodePos(3, W, H);
  ctx.save();
  ctx.strokeStyle = '#A8BEFFaa';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.arc(heroPos.x - 36, heroPos.y - 8, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = hexAlpha('#A8BEFF', 0.15);
  ctx.beginPath();
  ctx.arc(heroPos.x - 36, heroPos.y - 8, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#A8BEFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', heroPos.x - 36, heroPos.y - 8 + 1);
  ctx.restore();

  // ── Nodes
  for (let i = 0; i < NODES.length; i++) {
    const node = NODES[i];
    const { x, y } = nodePos(i, W, H);

    const isDone   = node.state === 'done';
    const isNext   = node.state === 'next';
    const isLocked = node.state === 'locked';
    const isBoss   = node.type === 'boss';
    const accent   = isBoss ? '#f5a623' : '#A8BEFF';

    ctx.save();
    ctx.globalAlpha = isLocked ? 0.3 : 1;

    // Outer glow
    if (!isLocked) {
      const glow = ctx.createRadialGradient(x, y, NODE_R, x, y, NODE_R + 20);
      glow.addColorStop(0, hexAlpha(accent, 0.2));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, NODE_R + 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Node fill (crosshatch texture via clip)
    const fill = ctx.createRadialGradient(x, y - 5, 2, x, y, NODE_R);
    if (isDone) {
      fill.addColorStop(0, '#10173a');
      fill.addColorStop(1, '#080c20');
    } else if (isNext) {
      fill.addColorStop(0, '#14193c');
      fill.addColorStop(1, '#0a0e24');
    } else {
      fill.addColorStop(0, '#0c1022');
      fill.addColorStop(1, '#060814');
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    ctx.fill();

    // Crosshatch texture clipped to node
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, NODE_R - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = hexAlpha(accent, 0.07);
    ctx.lineWidth = 0.7;
    for (let c = -NODE_R; c <= NODE_R * 2; c += 5) {
      ctx.beginPath();
      ctx.moveTo(x - NODE_R + c, y - NODE_R);
      ctx.lineTo(x - NODE_R + c - NODE_R, y + NODE_R);
      ctx.stroke();
    }
    ctx.restore();

    // Outer orbit ring
    if (isBoss) {
      // Crescent arc
      ctx.strokeStyle = hexAlpha(accent, isDone ? 0.9 : 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, NODE_R + 5, -Math.PI * 0.7, Math.PI * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, NODE_R + 5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
    } else {
      ctx.strokeStyle = isDone ? hexAlpha(accent, 0.8) : hexAlpha(accent, 0.2);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, NODE_R + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Inner ring
    ctx.strokeStyle = hexAlpha(accent, isDone ? 0.45 : 0.15);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, NODE_R * 0.68, 0, Math.PI * 2);
    ctx.stroke();

    // Solid border
    ctx.strokeStyle = isDone ? hexAlpha(accent, 0.9) : isNext ? hexAlpha(accent, 0.6) : hexAlpha(accent, 0.2);
    ctx.lineWidth = isDone ? 2 : 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    ctx.stroke();

    // Icon
    ctx.font = `${isBoss ? 15 : 13}px sans-serif`;
    ctx.fillStyle = isDone ? accent : isNext ? hexAlpha(accent, 0.9) : hexAlpha(accent, 0.3);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeIcon(node.type), x, y + 1);

    ctx.restore();

    // Stars
    if (node.type === 'battle' && isDone && (node.stars ?? 0) > 0) {
      const stars = node.stars ?? 0;
      const starY = y + NODE_R + 12;
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < stars ? '#A8BEFF' : hexAlpha('#A8BEFF', 0.15);
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', x + (s - 1) * 12, starY);
      }
    }

    // Label
    const labelY = y + NODE_R + (node.type === 'battle' && isDone ? 22 : 12);
    ctx.font = isNext ? "bold 9px 'Outfit', sans-serif" : "9px 'Outfit', sans-serif";
    ctx.fillStyle = isDone ? hexAlpha(accent, 0.85) : isNext ? accent : hexAlpha(accent, 0.3);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, x, labelY);

    if (isNext) {
      const btnY = labelY + 16;
      ctx.fillStyle = accent;
      ctx.beginPath();
      roundRect(ctx, x - 22, btnY, 44, 16, 3);
      ctx.fill();
      ctx.font = "bold 8px 'Outfit', sans-serif";
      ctx.fillStyle = '#06091a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('START', x, btnY + 8);
    }
  }
}

// ─── DESIGN C — Bioluminescent Neural ────────────────────────────────────────

function drawBioNeural(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;

  // Background
  ctx.fillStyle = '#040d10';
  ctx.fillRect(0, 0, W, H);

  // Diagonal overlay
  const diag = ctx.createLinearGradient(0, 0, W, H);
  diag.addColorStop(0, 'rgba(0,212,184,0.04)');
  diag.addColorStop(0.5, 'rgba(0,0,0,0)');
  diag.addColorStop(1, 'rgba(123,79,255,0.05)');
  ctx.fillStyle = diag;
  ctx.fillRect(0, 0, W, H);

  // Floating glow particles
  const particles = [
    [0.10,0.09,8,'#00D4B8',0.25],[0.85,0.12,6,'#7B4FFF',0.20],[0.22,0.30,10,'#00D4B8',0.18],
    [0.76,0.28,7,'#7B4FFF',0.22],[0.05,0.52,5,'#00D4B8',0.15],[0.93,0.48,9,'#7B4FFF',0.17],
    [0.18,0.72,6,'#00D4B8',0.20],[0.82,0.70,7,'#7B4FFF',0.18],[0.40,0.90,8,'#00D4B8',0.14],
    [0.60,0.88,5,'#7B4FFF',0.16],[0.50,0.18,6,'#00D4B8',0.13],[0.30,0.50,7,'#7B4FFF',0.12],
  ] as Array<[number, number, number, string, number]>;

  for (const [fx, fy, r, color, a] of particles) {
    const px = fx * W, py = fy * H;
    const pg = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
    pg.addColorStop(0, hexAlpha(color, a));
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexAlpha(color, a * 1.8);
    ctx.beginPath();
    ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Path — glowing neural spine
  for (let i = 0; i < NODES.length - 1; i++) {
    const a = nodePos(i, W, H);
    const b = nodePos(i + 1, W, H);
    const isDone = NODES[i].state === 'done';
    const color = isDone ? '#00D4B8' : '#7B4FFF';
    const glowA = isDone ? 0.18 : 0.10;
    const coreA = isDone ? 0.85 : 0.35;

    // Wide glow layer
    ctx.save();
    ctx.strokeStyle = hexAlpha(color, glowA);
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Mid glow
    ctx.strokeStyle = hexAlpha(color, glowA * 1.8);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Core
    ctx.strokeStyle = hexAlpha(color, coreA);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();

    // Dendrite branches off done battle nodes
    if (isDone && (NODES[i].type === 'battle' || NODES[i + 1].type === 'battle')) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const perpX = -(b.y - a.y);
      const perpY = b.x - a.x;
      const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
      const nx = perpX / len, ny = perpY / len;

      for (let d = 0; d < 3; d++) {
        const t = 0.25 + d * 0.25;
        const ox = a.x + (b.x - a.x) * t;
        const oy = a.y + (b.y - a.y) * t;
        const sign = d % 2 === 0 ? 1 : -1;
        const dLen = 10 + d * 4;
        const ex = ox + nx * dLen * sign;
        const ey = oy + ny * dLen * sign;

        const dendG = ctx.createLinearGradient(ox, oy, ex, ey);
        dendG.addColorStop(0, hexAlpha('#00D4B8', 0.6));
        dendG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = dendG;
        ctx.lineWidth = 0.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ox, oy); ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }
  }

  // ── Nav bar
  const navH = 44;
  ctx.fillStyle = '#030a0d';
  ctx.fillRect(0, 0, W, navH);
  // Teal progress bar
  ctx.fillStyle = hexAlpha('#00D4B8', 0.15);
  ctx.fillRect(0, navH - 4, W * 0.35, 4);
  ctx.fillStyle = hexAlpha('#00D4B8', 0.5);
  ctx.fillRect(0, navH - 4, W * 0.35, 2);

  ctx.strokeStyle = hexAlpha('#00D4B8', 0.15);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, navH); ctx.lineTo(W, navH); ctx.stroke();

  ctx.font = "bold 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = '#00D4B8';
  ctx.textAlign = 'center';
  ctx.fillText('CH.01 // THE WARD', W / 2, 26);

  ctx.font = "13px 'JetBrains Mono', monospace";
  ctx.fillStyle = hexAlpha('#00D4B8', 0.5);
  ctx.textAlign = 'left';
  ctx.fillText('‹', 14, 27);
  ctx.textAlign = 'right';
  ctx.fillText('›', W - 14, 27);

  // ── Hero token
  const heroPos = nodePos(3, W, H);
  ctx.save();
  const heroGlow = ctx.createRadialGradient(heroPos.x - 36, heroPos.y - 8, 0, heroPos.x - 36, heroPos.y - 8, 16);
  heroGlow.addColorStop(0, 'rgba(0,212,184,0.25)');
  heroGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = heroGlow;
  ctx.beginPath();
  ctx.arc(heroPos.x - 36, heroPos.y - 8, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#00D4B8bb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(heroPos.x - 36, heroPos.y - 8, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#00D4B8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', heroPos.x - 36, heroPos.y - 8 + 1);
  ctx.restore();

  // ── Nodes
  for (let i = 0; i < NODES.length; i++) {
    const node = NODES[i];
    const { x, y } = nodePos(i, W, H);

    const isDone   = node.state === 'done';
    const isNext   = node.state === 'next';
    const isLocked = node.state === 'locked';
    const isBoss   = node.type === 'boss';
    const accent   = isBoss ? '#7B4FFF' : '#00D4B8';

    ctx.save();
    ctx.globalAlpha = isLocked ? 0.3 : 1;

    // Outer glow
    if (!isLocked) {
      const glow = ctx.createRadialGradient(x, y, NODE_R - 4, x, y, NODE_R + 18);
      glow.addColorStop(0, hexAlpha(accent, 0.22));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, NODE_R + 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Node fill
    ctx.fillStyle = isDone ? hexAlpha(accent, 0.08) : isNext ? hexAlpha(accent, 0.05) : 'rgba(4,13,16,0.8)';
    ctx.beginPath();
    if (isBoss) {
      hexagon(ctx, x, y, NODE_R);
    } else {
      ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    }
    ctx.fill();

    // Petri-dish rings
    for (const r of [NODE_R * 0.72, NODE_R * 0.46]) {
      ctx.strokeStyle = hexAlpha(accent, isDone ? 0.4 : 0.15);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = isDone ? accent : isNext ? hexAlpha(accent, 0.7) : hexAlpha(accent, 0.2);
    ctx.lineWidth = isDone ? 2 : 1.5;
    ctx.beginPath();
    if (isBoss) {
      hexagon(ctx, x, y, NODE_R);
    } else {
      ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    }
    ctx.stroke();

    // Icon
    ctx.font = `${isBoss ? 15 : 13}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = isDone ? accent : isNext ? hexAlpha(accent, 0.9) : hexAlpha(accent, 0.3);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeIcon(node.type), x, y + 1);

    ctx.restore();

    // Stars
    if (node.type === 'battle' && isDone && (node.stars ?? 0) > 0) {
      const stars = node.stars ?? 0;
      const starY = y + NODE_R + 12;
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < stars ? '#00D4B8' : hexAlpha('#00D4B8', 0.12);
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', x + (s - 1) * 12, starY);
      }
    }

    // Label
    const labelY = y + NODE_R + (node.type === 'battle' && isDone ? 22 : 12);
    ctx.font = isNext ? "bold 8px 'JetBrains Mono', monospace" : "8px 'JetBrains Mono', monospace";
    ctx.fillStyle = isDone ? hexAlpha(accent, 0.8) : isNext ? accent : hexAlpha(accent, 0.25);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, x, labelY);

    if (isNext) {
      const btnY = labelY + 16;
      const grad = ctx.createLinearGradient(x - 22, btnY, x + 22, btnY + 16);
      grad.addColorStop(0, '#00D4B8');
      grad.addColorStop(1, '#00a891');
      ctx.fillStyle = grad;
      ctx.beginPath();
      roundRect(ctx, x - 22, btnY, 44, 16, 3);
      ctx.fill();
      ctx.font = "bold 7px 'JetBrains Mono', monospace";
      ctx.fillStyle = '#040d10';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('START', x, btnY + 8);
    }
  }
}

// ─── Canvas drawing helpers ──────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const angle = (k * Math.PI) / 3 - Math.PI / 6;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ─── Canvas Wrapper ──────────────────────────────────────────────────────────

interface CanvasMapProps {
  draw: (canvas: HTMLCanvasElement) => void;
  width: number;
  height: number;
  accentColor: string;
}

function CanvasMap({ draw, width, height, accentColor }: CanvasMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Ensure fonts are loaded before drawing
    document.fonts.ready.then(() => {
      draw(canvas);
    });
  }, [draw]);

  return (
    <PhoneFrame
      accentColor={accentColor}
      canvasRef={canvasRef}
      width={width}
      height={height}
    />
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function JourneyMapAesthetics() {
  const CW = 260;  // canvas width
  const CH = 560;  // canvas height

  return (
    <div style={{
      minHeight: '100vh',
      background: '#08080f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 24px 60px',
      fontFamily: "'Inter', sans-serif",
      gap: 0,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 700 }}>
        <div style={{
          color: '#e2dff0',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}>
          Journey Map — Aesthetic Direction Concepts
        </div>
        <div style={{ color: '#555566', fontSize: 11 }}>
          Three distinct visual directions for the Chapter Journey Map. Each shows a full Chapter 1 run: 6 nodes, done/next/locked states, star ratings, hero token, and chapter nav.
        </div>
      </div>

      {/* Three phone frames */}
      <div style={{
        display: 'flex',
        gap: 40,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>

        {/* ── Design A */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{
            color: '#D4A853',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>A — Ink &amp; Mist</div>
          <CanvasMap
            draw={drawInkMist}
            width={CW}
            height={CH}
            accentColor="#D4A853"
          />
          <DesignNotes
            title="Ink & Mist"
            tagline="Warmest · Most on-brand · Lowest risk"
            accentColor="#D4A853"
            palette="Deep umber #160c06 · Gold #D4A853 · Jade accent"
            path="Multi-layer brushstroke segs, 4 strokes/seg with slight x offsets"
            nodes="Circular ink-stamp seals, concentric inner rings, calligraphic glyphs"
            feel="Matches existing donghua warm-dark UI token layer"
          />
        </div>

        {/* ── Design B */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{
            color: '#A8BEFF',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>B — Celestial Ward</div>
          <CanvasMap
            draw={drawCelestialWard}
            width={CW}
            height={CH}
            accentColor="#A8BEFF"
          />
          <DesignNotes
            title="Celestial Ward"
            tagline="Epic · Mysterious · High contrast"
            accentColor="#A8BEFF"
            palette="Deep indigo #06091a · Periwinkle #A8BEFF · Amber boss accent"
            path="Dashed constellation lines, soft glow on completed segments"
            nodes="Orbit-ring medallions, crosshatch texture, crescent boss motif"
            feel="Medical-meets-cosmos; works well at smaller node sizes"
          />
        </div>

        {/* ── Design C */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{
            color: '#00D4B8',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>C — Bioluminescent Neural</div>
          <CanvasMap
            draw={drawBioNeural}
            width={CW}
            height={CH}
            accentColor="#00D4B8"
          />
          <DesignNotes
            title="Bioluminescent Neural"
            tagline="Clinical sci-fi · Highest differentiation"
            accentColor="#00D4B8"
            palette="Near-black #040d10 · Teal #00D4B8 · Violet #7B4FFF"
            path="Glowing neural spine (wide glow + core) with lateral dendrite branches"
            nodes="Petri-dish concentric rings; boss node hexagon outline; monospace labels"
            feel="Immersive, science-forward; highest differentiation from current style"
          />
        </div>
      </div>

      {/* Shared spec row */}
      <SpecRow />
    </div>
  );
}

export default JourneyMapAesthetics;
