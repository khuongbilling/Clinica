import { useEffect, useRef } from 'react';

// ─── Canvas dimensions ───────────────────────────────────────────────────────

const CW = 360;
const CH = 780;

// ─── Hex layout constants (matching HexMapLayer.tsx exactly) ─────────────────

const Q_STEP = 0.75;    // horizontal advance per q unit (= 3/4)
const R_STEP = 0.866;   // vertical advance per r unit   (≈ √3/2)
const Q_VOFF = 0.433;   // vertical bump per q unit      (≈ √3/4)
const SZ = 64;          // tile size in pixels
const R = SZ * 0.5;     // circumradius of flat-top hex — exactly SZ/2 so tiles tessellate edge-to-edge
const OX = CW / 2 - SZ / 2;  // x origin (centres tile q=0)
const OY = 340;               // y origin (visual centre of map)

// ─── Tile data ───────────────────────────────────────────────────────────────

type TileVis = 'hidden' | 'frontier' | 'revealed' | 'current' | 'gate';
type EncType = 'none' | 'battle' | 'treasure_bronze' | 'treasure_gold' | 'merchant' | 'areaBoss';

interface Tile {
  q: number;
  r: number;
  vis: TileVis;
  enc: EncType;
  stars?: number; // 0-3 for done battle tiles
  done?: boolean; // battle cleared
}

const TILES: Tile[] = [
  // Gate tile — top, hidden
  { q:  0, r: -4, vis: 'gate',     enc: 'none' },
  // Hidden tiles (fog)
  { q: -1, r: -3, vis: 'hidden',   enc: 'none' },
  { q:  1, r: -3, vis: 'hidden',   enc: 'none' },
  { q:  0, r: -3, vis: 'hidden',   enc: 'none' },
  { q: -2, r: -2, vis: 'hidden',   enc: 'none' },
  { q:  2, r: -2, vis: 'hidden',   enc: 'none' },
  // Frontier tiles (selectable, no encounter reveal)
  { q: -1, r: -2, vis: 'frontier', enc: 'none' },
  { q:  1, r: -2, vis: 'frontier', enc: 'none' },
  // Revealed tiles — varied encounters
  { q:  0, r: -2, vis: 'revealed', enc: 'areaBoss' },
  { q: -2, r: -1, vis: 'revealed', enc: 'none' },
  { q: -1, r: -1, vis: 'revealed', enc: 'merchant' },
  { q:  0, r: -1, vis: 'revealed', enc: 'battle',        done: true, stars: 2 },
  { q:  1, r: -1, vis: 'revealed', enc: 'treasure_gold' },
  { q:  2, r: -1, vis: 'revealed', enc: 'none' },
  { q: -2, r:  0, vis: 'revealed', enc: 'none' },
  { q: -1, r:  0, vis: 'revealed', enc: 'battle',        done: true, stars: 3 },
  { q:  0, r:  0, vis: 'revealed', enc: 'none' },
  { q:  1, r:  0, vis: 'revealed', enc: 'treasure_bronze' },
  { q:  2, r:  0, vis: 'revealed', enc: 'none' },
  { q: -1, r:  1, vis: 'revealed', enc: 'battle',        done: false },
  { q:  0, r:  1, vis: 'revealed', enc: 'none' },
  { q:  1, r:  1, vis: 'revealed', enc: 'merchant' },
  { q:  0, r:  2, vis: 'revealed', enc: 'none' },
  // Current tile — player position
  { q:  0, r:  3, vis: 'current',  enc: 'none' },
];

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function tileCenter(q: number, r: number): [number, number] {
  const cx = q * Q_STEP * SZ + OX + SZ / 2;
  const cy = (r * R_STEP + q * Q_VOFF) * SZ + OY + SZ / 2;
  return [cx, cy];
}

function flatHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ─── Tile drawing functions ───────────────────────────────────────────────────

function drawHiddenTile(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Dark contiguous base hex only — volumetric fog cloud is layered on top later
  ctx.save();
  flatHexPath(ctx, cx, cy, R);
  const g = ctx.createRadialGradient(cx, cy - R * 0.2, 1, cx, cy, R);
  g.addColorStop(0, '#181a28');
  g.addColorStop(1, '#0e0f18');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(46,48,80,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// Deterministic pseudo-random from tile coords so fog is stable across redraws
function hash2(q: number, r: number, i: number): number {
  const n = Math.sin(q * 127.1 + r * 311.7 + i * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawFogCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, q: number, r: number) {
  ctx.save();
  // 8 soft overlapping puffs, jittered deterministically, spilling past the hex edge
  const PUFFS = 8;
  for (let i = 0; i < PUFFS; i++) {
    const a = hash2(q, r, i) * Math.PI * 2;
    const d = hash2(q, r, i + 20) * R * 0.55;
    const px = cx + Math.cos(a) * d;
    const py = cy + Math.sin(a) * d * 0.8;
    const pr = R * (0.45 + hash2(q, r, i + 40) * 0.5);
    const light = 0.10 + hash2(q, r, i + 60) * 0.10;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, `rgba(150,158,195,${light + 0.10})`);
    g.addColorStop(0.55, `rgba(110,118,160,${light})`);
    g.addColorStop(1, 'rgba(90,95,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  // Brighter central wisp so clouds read as lit volume, not flat haze
  const core = ctx.createRadialGradient(cx, cy - R * 0.15, 0, cx, cy, R * 0.85);
  core.addColorStop(0, 'rgba(175,182,215,0.16)');
  core.addColorStop(1, 'rgba(120,128,170,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // '?' glyph floating in the fog
  ctx.fillStyle = 'rgba(205,210,240,0.7)';
  ctx.shadowColor = 'rgba(160,170,220,0.8)';
  ctx.shadowBlur = 6;
  ctx.font = 'bold 18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy + 1);
  ctx.restore();
}

function drawFrontierTile(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Glow halo
  flatHexPath(ctx, cx, cy, R + 8);
  const halo = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R + 8);
  halo.addColorStop(0, 'rgba(60,180,220,0.22)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fill();

  flatHexPath(ctx, cx, cy, R);
  const g = ctx.createRadialGradient(cx, cy - R * 0.15, 1, cx, cy, R);
  g.addColorStop(0, '#1e2d40');
  g.addColorStop(1, '#111825');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#3cb4dc88';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Inner glow ring
  flatHexPath(ctx, cx, cy, R * 0.82);
  ctx.strokeStyle = 'rgba(80,190,230,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(80,190,230,0.7)';
  ctx.font = 'bold 17px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy + 1);
  ctx.restore();
}

function drawRevealedTile(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  flatHexPath(ctx, cx, cy, R);
  ctx.save();
  ctx.clip();

  // Stone radial gradient
  const g = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, 1, cx, cy, R * 1.1);
  g.addColorStop(0, '#2e3240');
  g.addColorStop(0.5, '#222533');
  g.addColorStop(1, '#16192a');
  ctx.fillStyle = g;
  ctx.fillRect(cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4);

  // Crosshatch texture
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.7;
  for (let i = -R; i <= R; i += 9) {
    ctx.beginPath(); ctx.moveTo(cx + i, cy - R); ctx.lineTo(cx + i, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy + i); ctx.lineTo(cx + R, cy + i); ctx.stroke();
  }
  // Diagonal crosshatch
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  for (let i = -R * 2; i <= R * 2; i += 13) {
    ctx.beginPath(); ctx.moveTo(cx + i - R, cy - R); ctx.lineTo(cx + i + R, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + i - R, cy + R); ctx.lineTo(cx + i + R, cy - R); ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = '#3a3f60';
  ctx.lineWidth = 1.4;
  flatHexPath(ctx, cx, cy, R);
  ctx.stroke();
  ctx.restore();
}

function drawCurrentTile(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Outer glow
  flatHexPath(ctx, cx, cy, R + 12);
  const halo = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R + 12);
  halo.addColorStop(0, 'rgba(30,210,180,0.35)');
  halo.addColorStop(0.6, 'rgba(20,180,160,0.15)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fill();

  // Base
  flatHexPath(ctx, cx, cy, R);
  const g = ctx.createRadialGradient(cx, cy - R * 0.2, 1, cx, cy, R);
  g.addColorStop(0, '#1e3d48');
  g.addColorStop(0.6, '#162d38');
  g.addColorStop(1, '#0e1f28');
  ctx.fillStyle = g;
  ctx.fill();

  // Glowing border
  ctx.strokeStyle = '#20d4b4';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#20d4b4';
  ctx.shadowBlur = 8;
  flatHexPath(ctx, cx, cy, R);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner ring
  flatHexPath(ctx, cx, cy, R * 0.8);
  ctx.strokeStyle = 'rgba(32,212,180,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Corner sparkle dots at 6 hex vertices
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    const sx = cx + R * Math.cos(angle);
    const sy = cy + R * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#20d4b4';
    ctx.shadowColor = '#20d4b4';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawGateTile(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Purple halo
  flatHexPath(ctx, cx, cy, R + 10);
  const halo = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R + 10);
  halo.addColorStop(0, 'rgba(140,60,220,0.35)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fill();

  flatHexPath(ctx, cx, cy, R);
  const g = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.2, 1, cx, cy, R);
  g.addColorStop(0, '#2a1540');
  g.addColorStop(1, '#180d2a');
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = '#9040e0';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#a050ff';
  ctx.shadowBlur = 10;
  flatHexPath(ctx, cx, cy, R);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Arch motif
  ctx.strokeStyle = 'rgba(180,120,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 13, Math.PI, 0);
  ctx.stroke();
  // Arch pillars
  ctx.beginPath(); ctx.moveTo(cx - 13, cy - 4); ctx.lineTo(cx - 13, cy + 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 13, cy - 4); ctx.lineTo(cx + 13, cy + 7); ctx.stroke();
  // Arch base
  ctx.beginPath(); ctx.moveTo(cx - 15, cy + 7); ctx.lineTo(cx + 15, cy + 7); ctx.stroke();

  // Padlock body
  ctx.fillStyle = 'rgba(200,150,255,0.55)';
  ctx.beginPath();
  roundRect(ctx, cx - 6, cy + 2, 12, 9, 2);
  ctx.fill();
  // Shackle arc
  ctx.strokeStyle = 'rgba(200,150,255,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 5, Math.PI, 0);
  ctx.stroke();
  // Keyhole
  ctx.fillStyle = 'rgba(60,20,100,0.8)';
  ctx.beginPath();
  ctx.arc(cx, cy + 6.5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Encounter icon drawing ───────────────────────────────────────────────────

function drawBattleIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.strokeStyle = '#e8c84a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  // Crossed swords (two diagonal lines)
  const d = r * 0.55;
  ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
  // Guard marks
  ctx.lineWidth = 2.5;
  const g2 = d * 0.45;
  ctx.beginPath(); ctx.moveTo(cx - g2 * 1.1, cy - g2 * 0.4); ctx.lineTo(cx - g2 * 0.4, cy - g2 * 1.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + g2 * 0.4, cy + g2 * 1.1); ctx.lineTo(cx + g2 * 1.1, cy + g2 * 0.4); ctx.stroke();
  ctx.restore();
}

function drawTreasureIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, gold?: boolean) {
  ctx.save();
  const col = gold ? '#f0c840' : '#b07830';
  const w = r * 1.3, h = r;
  const lx = cx - w / 2, ty = cy - h / 2 + 2;
  // Chest body
  ctx.fillStyle = gold ? '#3a2808' : '#2a1a08';
  roundRect(ctx, lx, ty + h * 0.35, w, h * 0.65, 3);
  ctx.fill();
  // Lid
  ctx.fillStyle = gold ? '#4a3010' : '#361e0a';
  roundRect(ctx, lx, ty, w, h * 0.42, 3);
  ctx.fill();
  // Outline
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  roundRect(ctx, lx, ty, w, h, 3);
  ctx.stroke();
  // Band
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(lx, ty + h * 0.38); ctx.lineTo(lx + w, ty + h * 0.38); ctx.stroke();
  // Clasp
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, ty + h * 0.38, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Gold coin accent
  if (gold) {
    ctx.fillStyle = '#f0c840';
    ctx.beginPath(); ctx.arc(lx + w + 4, ty - 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a08020'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  ctx.restore();
}

function drawMerchantIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  // Tent triangle
  ctx.fillStyle = '#2a4030';
  ctx.strokeStyle = '#58c080';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.95);
  ctx.lineTo(cx + r * 0.9, cy + r * 0.55);
  ctx.lineTo(cx - r * 0.9, cy + r * 0.55);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Base line
  ctx.beginPath(); ctx.moveTo(cx - r * 1.0, cy + r * 0.55); ctx.lineTo(cx + r * 1.0, cy + r * 0.55); ctx.stroke();
  // Lantern above
  ctx.fillStyle = '#ffd060';
  ctx.beginPath(); ctx.arc(cx, cy - r * 1.15, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore();
}

function drawAreaBossIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  // 3-peak crown
  ctx.fillStyle = '#402010';
  ctx.strokeStyle = '#e07020';
  ctx.lineWidth = 1.5;
  const bY = cy + r * 0.55;
  const bL = cx - r * 0.85;
  const bR = cx + r * 0.85;
  ctx.beginPath();
  ctx.moveTo(bL, bY);
  ctx.lineTo(bL, cy - r * 0.3);
  ctx.lineTo(cx - r * 0.25, cy - r * 0.7);
  ctx.lineTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.25, cy - r * 0.7);
  ctx.lineTo(bR, cy - r * 0.3);
  ctx.lineTo(bR, bY);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Base band
  ctx.fillStyle = '#e07020';
  ctx.fillRect(bL, bY - 5, bR - bL, 5);
  // Gem dots
  const gemY = cy - r * 0.15;
  for (const gx of [cx - r * 0.4, cx, cx + r * 0.4]) {
    ctx.fillStyle = '#ff4060';
    ctx.beginPath(); ctx.arc(gx, gemY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff8090'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  ctx.restore();
}

// ─── Star ratings ─────────────────────────────────────────────────────────────

function drawStars(ctx: CanvasRenderingContext2D, cx: number, cy: number, stars: number) {
  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < stars ? '#f0c840' : '#2a2838';
    ctx.fillText('★', cx + (i - 1) * 11, cy);
  }
  ctx.restore();
}

// ─── Hero token ───────────────────────────────────────────────────────────────

function drawHeroToken(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Shadow pool ellipse
  ctx.fillStyle = 'rgba(20,210,180,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Platform ring
  ctx.strokeStyle = '#20d4b4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 12, 5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Body — oval cloak
  const bodyG = ctx.createRadialGradient(cx, cy + 2, 2, cx, cy + 6, 16);
  bodyG.addColorStop(0, '#3a4870');
  bodyG.addColorStop(1, '#1c2040');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 9, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Triangular lower coat
  ctx.fillStyle = '#242844';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy + 6);
  ctx.lineTo(cx + 9, cy + 6);
  ctx.lineTo(cx, cy + 18);
  ctx.closePath();
  ctx.fill();

  // Head
  const headG = ctx.createRadialGradient(cx - 2, cy - 10, 1, cx, cy - 8, 7);
  headG.addColorStop(0, '#d4a878');
  headG.addColorStop(1, '#a07040');
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 7, 0, Math.PI * 2);
  ctx.fill();

  // Hair arc
  ctx.fillStyle = '#1a1010';
  ctx.beginPath();
  ctx.arc(cx, cy - 11, 7.5, Math.PI * 1.1, Math.PI * 1.9);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 5, cy - 9, 4, Math.PI * 1.0, Math.PI * 0.5);
  ctx.fill();

  // Glowing eyes
  ctx.fillStyle = '#20d4b4';
  ctx.shadowColor = '#20d4b4';
  ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.arc(cx - 2.5, cy - 8.5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 2.5, cy - 8.5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ─── UI chrome ───────────────────────────────────────────────────────────────

function drawTopHUD(ctx: CanvasRenderingContext2D) {
  const W = CW, navH = 72;

  // Nav bar gradient background
  const bg = ctx.createLinearGradient(0, 0, 0, navH);
  bg.addColorStop(0, '#07091488');
  bg.addColorStop(1, 'rgba(7,8,20,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, navH);

  // Back button (left)
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, 10, 10, 34, 34, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, 10, 10, 34, 34, 10);
  ctx.stroke();
  ctx.fillStyle = '#c0c8e0';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('‹', 27, 28);
  ctx.restore();

  // Info button (right)
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, W - 44, 10, 34, 34, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, W - 44, 10, 34, 34, 10);
  ctx.stroke();
  ctx.fillStyle = '#c0c8e0';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ⓘ', W - 27, 27);
  ctx.restore();

  // Eyebrow text
  ctx.save();
  ctx.fillStyle = 'rgba(100,180,220,0.7)';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = '0.18em';
  ctx.fillText('· FOGBOUND TILES ·', W / 2, 11);
  ctx.restore();

  // Chapter title
  ctx.save();
  ctx.fillStyle = '#e8e0f8';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Chapter 1 — The Ward', W / 2, 23);
  ctx.restore();

  // PHASE 1 badge
  ctx.save();
  ctx.fillStyle = 'rgba(80,140,220,0.22)';
  roundRect(ctx, W / 2 - 28, 40, 56, 17, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,160,255,0.4)';
  ctx.lineWidth = 0.8;
  roundRect(ctx, W / 2 - 28, 40, 56, 17, 4);
  ctx.stroke();
  ctx.fillStyle = '#80b0ff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PHASE 1', W / 2, 49);
  ctx.restore();

  // Stamina counter ⚡ 8/12 (top-right below info button)
  ctx.save();
  ctx.fillStyle = 'rgba(255,220,40,0.9)';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('⚡ 8/12', W - 12, 49);
  ctx.restore();

  // Movement cost note
  ctx.save();
  ctx.fillStyle = 'rgba(150,160,190,0.65)';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('1⚡ per tile', 12, 50);
  ctx.restore();
}

function drawKeyFragmentsBar(ctx: CanvasRenderingContext2D) {
  const W = CW;
  const barY = 72;
  const barH = 30;

  // Bar background
  ctx.fillStyle = 'rgba(8,10,22,0.82)';
  ctx.fillRect(0, barY, W, barH);
  ctx.strokeStyle = 'rgba(80,100,180,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, barY + barH); ctx.lineTo(W, barY + barH); ctx.stroke();

  const cy = barY + barH / 2;

  // Crystal icon (diamond shape)
  ctx.save();
  const kx = 14;
  ctx.fillStyle = '#80b0ff';
  ctx.beginPath();
  ctx.moveTo(kx, cy - 7);
  ctx.lineTo(kx + 6, cy);
  ctx.lineTo(kx, cy + 7);
  ctx.lineTo(kx - 6, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a0c8ff';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();

  // Count text
  ctx.save();
  ctx.fillStyle = '#d0e4ff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('3/5', 26, cy);
  ctx.restore();

  // Pip indicators (5 circles, 3 filled gold, 2 empty)
  const pipStartX = 60;
  const pipSpacing = 16;
  for (let i = 0; i < 5; i++) {
    const px = pipStartX + i * pipSpacing;
    ctx.save();
    if (i < 3) {
      ctx.fillStyle = '#f0c840';
      ctx.shadowColor = '#f0c840';
      ctx.shadowBlur = 4;
    } else {
      ctx.fillStyle = 'rgba(80,80,120,0.5)';
    }
    ctx.beginPath();
    ctx.arc(px, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = i < 3 ? '#c0a020' : 'rgba(80,80,130,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // CHAPTER BOSS GATE label (right)
  ctx.save();
  ctx.fillStyle = 'rgba(180,120,255,0.8)';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHAPTER BOSS GATE', W - 10, cy);
  ctx.restore();
}

function drawEncounterLabel(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string, color: string) {
  ctx.save();
  ctx.font = 'bold 8px sans-serif';
  const tw = ctx.measureText(label).width;
  const lx = cx + R + 4;
  const ly = cy - 7;
  // Pill background
  ctx.fillStyle = 'rgba(8,10,24,0.82)';
  roundRect(ctx, lx, ly, tw + 10, 15, 4);
  ctx.fill();
  ctx.strokeStyle = color + '80';
  ctx.lineWidth = 0.8;
  roundRect(ctx, lx, ly, tw + 10, 15, 4);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx + 5, ly + 7.5);
  ctx.restore();
}

function drawLegend(ctx: CanvasRenderingContext2D, y: number) {
  const W = CW;
  const cols = [
    { label: 'Battle',    icon: 'battle',     color: '#e8c84a' },
    { label: 'Treasure',  icon: 'treasure',   color: '#f0a830' },
    { label: 'Merchant',  icon: 'merchant',   color: '#58c080' },
    { label: 'Area Boss', icon: 'areaBoss',   color: '#e07020' },
  ];
  const colW = W / 4;
  const stripH = 42;

  // Strip background
  ctx.fillStyle = 'rgba(8,10,22,0.85)';
  ctx.fillRect(0, y, W, stripH);
  ctx.strokeStyle = 'rgba(60,70,120,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();

  // Header
  ctx.save();
  ctx.fillStyle = 'rgba(140,150,200,0.7)';
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('TILE OUTCOMES', W / 2, y + 3);
  ctx.restore();

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const cx = colW * i + colW / 2;
    const iconCY = y + 22;
    const iconR = 9;

    // Icon circle background
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(cx, iconCY, iconR + 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col.color + '55';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, iconCY, iconR + 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // Icon
    ctx.save();
    ctx.scale(0.55, 0.55);
    const sx = cx / 0.55, sy = iconCY / 0.55;
    if (col.icon === 'battle')   drawBattleIcon(ctx,  sx, sy, iconR / 0.55);
    if (col.icon === 'treasure') drawTreasureIcon(ctx, sx, sy, iconR / 0.55);
    if (col.icon === 'merchant') drawMerchantIcon(ctx, sx, sy, iconR / 0.55);
    if (col.icon === 'areaBoss') drawAreaBossIcon(ctx, sx, sy, iconR / 0.55);
    ctx.restore();

    // Label
    ctx.save();
    ctx.fillStyle = col.color + 'cc';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(col.label, cx, iconCY + iconR + 3);
    ctx.restore();
  }
}

function drawChapterCard(ctx: CanvasRenderingContext2D, y: number) {
  const W = CW;
  const cardH = CH - y;

  // Card background
  const cardG = ctx.createLinearGradient(0, y, 0, CH);
  cardG.addColorStop(0, 'rgba(10,12,28,0.97)');
  cardG.addColorStop(1, '#07080e');
  ctx.fillStyle = cardG;
  roundRect(ctx, 0, y, W, cardH, 0);
  ctx.fill();

  // Top border accent
  ctx.strokeStyle = 'rgba(60,80,180,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();

  // Thumbnail circle
  const thumbX = 26, thumbY = y + 20, thumbR = 20;
  const thumbG = ctx.createRadialGradient(thumbX - 5, thumbY - 5, 2, thumbX, thumbY, thumbR);
  thumbG.addColorStop(0, '#1e3050');
  thumbG.addColorStop(1, '#0e1828');
  ctx.fillStyle = thumbG;
  ctx.beginPath(); ctx.arc(thumbX, thumbY, thumbR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(80,120,220,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(thumbX, thumbY, thumbR, 0, Math.PI * 2); ctx.stroke();
  // Thumbnail icon
  ctx.fillStyle = '#6090d0';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚕', thumbX, thumbY + 1);

  // Chapter label
  ctx.save();
  ctx.fillStyle = 'rgba(120,140,200,0.7)';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('CHAPTER 1', 56, y + 12);
  ctx.restore();

  // Chapter title
  ctx.save();
  ctx.fillStyle = '#d8e0f8';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('The Ward', 56, y + 24);
  ctx.restore();

  // Progress bar
  const pbX = 56, pbY = y + 42, pbW = W - 100, pbH = 6;
  const progress = 0.28;
  ctx.fillStyle = 'rgba(40,45,80,0.8)';
  roundRect(ctx, pbX, pbY, pbW, pbH, 3);
  ctx.fill();
  const pbFill = ctx.createLinearGradient(pbX, 0, pbX + pbW * progress, 0);
  pbFill.addColorStop(0, '#4080e0');
  pbFill.addColorStop(1, '#20c0d0');
  ctx.fillStyle = pbFill;
  roundRect(ctx, pbX, pbY, pbW * progress, pbH, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,140,200,0.6)';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('14/50 tiles', W - 12, pbY + pbH / 2);

  // Reward chips
  const chips = [
    { icon: '💎', qty: '×200', col: '#60c0ff' },
    { icon: '🧪', qty: '×5',   col: '#80e080' },
  ];
  let chipX = 56;
  for (const chip of chips) {
    const chipW = 64;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, chipX, y + 54, chipW, 20, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.7;
    roundRect(ctx, chipX, y + 54, chipW, 20, 6);
    ctx.stroke();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(chip.icon, chipX + 6, y + 64);
    ctx.fillStyle = chip.col;
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(chip.qty, chipX + 22, y + 64);
    chipX += chipW + 8;
  }

  // Search icon (top-right of card)
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, W - 44, y + 12, 34, 34, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,160,200,0.7)';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🗺', W - 27, y + 29);
  ctx.restore();

  // Tab bar
  const tabY = CH - 44;
  ctx.fillStyle = 'rgba(8,10,20,0.96)';
  ctx.fillRect(0, tabY, W, 44);
  ctx.strokeStyle = 'rgba(50,60,110,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, tabY); ctx.lineTo(W, tabY); ctx.stroke();

  const tabs = [
    { icon: '🏥', label: 'Ward' },
    { icon: '📚', label: 'Learn' },
    { icon: '🗺', label: 'Journey' },
    { icon: '🏛', label: 'Realm' },
    { icon: '👤', label: 'Profile' },
  ];
  const tabW = W / tabs.length;
  for (let i = 0; i < tabs.length; i++) {
    const tx = tabW * i + tabW / 2;
    const isActive = i === 2; // Journey active
    ctx.save();
    ctx.fillStyle = isActive ? '#80b0ff' : 'rgba(100,110,160,0.5)';
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tabs[i].icon, tx, tabY + 14);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = isActive ? '#80b0ff' : 'rgba(100,110,160,0.5)';
    ctx.fillText(tabs[i].label, tx, tabY + 30);
    if (isActive) {
      ctx.fillStyle = '#80b0ff';
      ctx.beginPath(); ctx.arc(tx, tabY + 40, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// ─── Background ───────────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D) {
  const W = CW, H = CH;

  // Dark void base
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070810');
  bg.addColorStop(0.5, '#060810');
  bg.addColorStop(1, '#06070e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Teal nebula wash (top-left)
  const neb1 = ctx.createRadialGradient(W * 0.15, H * 0.22, 0, W * 0.15, H * 0.22, W * 0.55);
  neb1.addColorStop(0, 'rgba(20,180,160,0.08)');
  neb1.addColorStop(0.5, 'rgba(10,120,140,0.04)');
  neb1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, W, H);

  // Purple nebula wash (bottom-right)
  const neb2 = ctx.createRadialGradient(W * 0.82, H * 0.68, 0, W * 0.82, H * 0.68, W * 0.6);
  neb2.addColorStop(0, 'rgba(120,40,200,0.1)');
  neb2.addColorStop(0.5, 'rgba(80,20,140,0.05)');
  neb2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, W, H);

  // Star particles
  const stars = [
    [0.06,0.06,0.8],[0.18,0.11,1.0],[0.32,0.04,0.7],[0.45,0.09,1.1],[0.60,0.14,0.9],
    [0.79,0.07,0.7],[0.90,0.17,1.0],[0.04,0.27,0.8],[0.22,0.37,0.6],[0.87,0.29,0.9],
    [0.12,0.51,0.7],[0.76,0.48,1.0],[0.93,0.56,0.8],[0.08,0.71,0.9],[0.37,0.63,0.7],
    [0.65,0.75,0.8],[0.84,0.83,1.0],[0.24,0.83,0.6],[0.93,0.38,0.7],
  ];
  for (const [fx, fy, size] of stars) {
    const sx = fx * W, sy = fy * H, r = size as number;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.5);
    halo.addColorStop(0, 'rgba(200,215,255,0.6)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sx, sy, r * 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(230,240,255,0.9)';
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Fog wisp bands
  for (let i = 0; i < 3; i++) {
    const wy = H * (0.28 + i * 0.22);
    const wg = ctx.createLinearGradient(0, wy - 18, 0, wy + 18);
    wg.addColorStop(0, 'rgba(0,0,0,0)');
    wg.addColorStop(0.5, `rgba(10,14,30,${0.12 + i * 0.04})`);
    wg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(0, wy - 18, W, 36);
  }
}

// ─── Vignette ─────────────────────────────────────────────────────────────────

function drawVignette(ctx: CanvasRenderingContext2D) {
  const W = CW, H = CH;
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ─── roundRect utility ───────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── Main draw ───────────────────────────────────────────────────────────────

function draw(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, CW, CH);

  // Layer 1: Background
  drawBackground(ctx);

  // Layer 2: Tile bases (sorted bottom-to-top, current last)
  const sorted = [...TILES].sort((a, b) => {
    if (a.vis === 'current' && b.vis !== 'current') return 1;
    if (b.vis === 'current' && a.vis !== 'current') return -1;
    return a.r !== b.r ? a.r - b.r : a.q - b.q;
  });

  // Fog clouds are drawn inline in depth order so nearer tiles repaint over
  // any cloud spill from tiles behind them.
  for (const tile of sorted) {
    const [cx, cy] = tileCenter(tile.q, tile.r);
    if (tile.vis === 'hidden') {
      drawHiddenTile(ctx, cx, cy);
      drawFogCloud(ctx, cx, cy, tile.q, tile.r);
    }
    else if (tile.vis === 'frontier') drawFrontierTile(ctx, cx, cy);
    else if (tile.vis === 'gate')    drawGateTile(ctx, cx, cy);
    else if (tile.vis === 'current') {
      drawRevealedTile(ctx, cx, cy);
      drawCurrentTile(ctx, cx, cy);
    } else drawRevealedTile(ctx, cx, cy);
  }

  // Layer 3: Encounter icons on revealed/current tiles
  for (const tile of TILES) {
    if (tile.vis !== 'revealed' && tile.vis !== 'current') continue;
    const [cx, cy] = tileCenter(tile.q, tile.r);
    const iconR = 11;
    if (tile.enc === 'battle')          drawBattleIcon(ctx,   cx, cy - 4, iconR);
    else if (tile.enc === 'treasure_bronze') drawTreasureIcon(ctx, cx, cy - 4, iconR, false);
    else if (tile.enc === 'treasure_gold')   drawTreasureIcon(ctx, cx, cy - 4, iconR, true);
    else if (tile.enc === 'merchant')   drawMerchantIcon(ctx, cx, cy - 4, iconR);
    else if (tile.enc === 'areaBoss')   drawAreaBossIcon(ctx, cx, cy - 4, iconR);
  }

  // Layer 4: Star ratings below cleared battle tiles
  for (const tile of TILES) {
    if (tile.enc !== 'battle' || !tile.done) continue;
    const [cx, cy] = tileCenter(tile.q, tile.r);
    drawStars(ctx, cx, cy + R + 9, tile.stars ?? 0);
  }

  // Layer 5: Encounter pop-out labels (select interesting tiles only)
  const labelTiles: { tile: Tile; label: string; color: string }[] = [
    { tile: TILES.find(t => t.q === 0  && t.r === -2)!, label: 'AREA BOSS', color: '#e07020' },
    { tile: TILES.find(t => t.q === -1 && t.r === -1)!, label: 'MERCHANT',  color: '#58c080' },
    { tile: TILES.find(t => t.q === 1  && t.r === -1)!, label: 'TREASURE',  color: '#f0a830' },
    { tile: TILES.find(t => t.q === -1 && t.r === 0)!,  label: 'BATTLE ★★★', color: '#e8c84a' },
  ];
  for (const { tile, label, color } of labelTiles) {
    if (!tile) continue;
    const [cx, cy] = tileCenter(tile.q, tile.r);
    // Only label on right side if there's space; otherwise skip
    if (cx + R + 80 < CW) {
      drawEncounterLabel(ctx, cx, cy, label, color);
    }
  }

  // Layer 6: Hero token on current tile
  const curr = TILES.find(t => t.vis === 'current');
  if (curr) {
    const [cx, cy] = tileCenter(curr.q, curr.r);
    drawHeroToken(ctx, cx, cy - 6);
  }

  // Layer 7: UI chrome
  drawTopHUD(ctx);
  drawKeyFragmentsBar(ctx);

  // Legend strip
  const legendY = CH - 44 - 42 - 82;
  drawLegend(ctx, legendY);
  drawChapterCard(ctx, legendY + 42);

  // Layer 8: Vignette
  drawVignette(ctx);
}

// ─── Phone Frame ─────────────────────────────────────────────────────────────

function PhoneFrame({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const bezelX = 10, bezelY = 16, notchW = 80, notchH = 22, indW = 50, indH = 5;
  return (
    <div style={{
      position: 'relative',
      width: CW + bezelX * 2,
      height: CH + bezelY * 2 + notchH + indH + 4,
      background: '#0a0a12',
      borderRadius: 40,
      boxShadow: '0 0 0 2px #22222e, 0 8px 60px rgba(0,0,0,0.8), 0 0 50px rgba(20,180,160,0.15)',
      flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: notchW, height: notchH, background: '#0a0a12', borderRadius: '0 0 14px 14px', zIndex: 10 }} />
      <div style={{ position: 'absolute', top: bezelY + notchH, left: bezelX, borderRadius: 28, overflow: 'hidden', width: CW, height: CH, border: '1px solid #1e1e2a' }}>
        <canvas ref={canvasRef} width={CW} height={CH} style={{ display: 'block' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: indW, height: indH, background: '#2a2a38', borderRadius: 3 }} />
    </div>
  );
}

// ─── Annotation Panel ─────────────────────────────────────────────────────────

const SYSTEM_FACTS = [
  {
    title: 'Map Generator',
    body: 'topology.ts runs BFS-growth from (0,0) using portrait-bias weights. Ch 1–5 = 30 tiles, Ch 6–10 = 35, Ch 11–20 = 40. Width capped at ≈√(N×0.75). Up to 60 retries for a valid blob.',
    color: '#60b0ff',
  },
  {
    title: 'Coordinate System',
    body: 'Flat-top axial (q, r). Pixel formula:\n  left = q × 0.75 × sz + ox\n  top  = (r × 0.866 + q × 0.433) × sz + oy\nSZ=64, OX=CW/2−SZ/2, OY=340.',
    color: '#40d0b8',
  },
  {
    title: 'Fog of War',
    body: 'fogCalculator.ts: hidden = not adjacent to current tile; frontier = adjacent (selectable, no encounter shown); revealed = visited (permanent). Frontier moves with player.',
    color: '#b080ff',
  },
  {
    title: 'Encounter Rates (Ch 1–3)',
    body: 'None 65% · Battle 30% · Treasure 5% · Merchant 0% · Area Boss 0%. Caps: ≤3 area bosses, ≤3 treasure, 0 merchant per run. Seeded Fisher-Yates for determinism.',
    color: '#f0c840',
  },
  {
    title: 'Tile States',
    body: 'HIDDEN: volumetric fog cloud + ? glyph, not interactive.\nFRONTIER: blue glow, ? glyph, tappable.\nREVEALED: stone texture + icon, cleared.\nCURRENT: teal glow + hero token.\nGATE: purple, padlock, boss entrance.',
    color: '#e07020',
  },
  {
    title: 'Source Files',
    body: 'topology.ts → shape & layout\nfogCalculator.ts → visibility rules\nencounters.ts → encounter seeding\nconfig.ts → rates & tile counts\nHexMapLayer.tsx → React renderer',
    color: '#80e080',
  },
];

const CHECKLIST = [
  { label: 'Dark void + nebula washes',   ok: true },
  { label: 'Flat-top hex grid',           ok: true },
  { label: 'Hidden / frontier / revealed tile states', ok: true },
  { label: 'Encounter icons on revealed', ok: true },
  { label: 'Gate tile with padlock',      ok: true },
  { label: 'Hero token on current tile',  ok: true },
  { label: 'Star ratings under battle',   ok: true },
  { label: 'Pop-out encounter labels',    ok: true },
  { label: 'Top HUD + stamina counter',   ok: true },
  { label: 'Key fragments bar',           ok: true },
  { label: 'TILE OUTCOMES legend strip',  ok: true },
  { label: 'Chapter info card + tab bar', ok: true },
];

function AnnotationPanel() {
  return (
    <div style={{ width: 280, fontFamily: "'Inter', sans-serif", color: '#c0bbd0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: '#e8e0ff', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
        Fogbound Hex Map
        <span style={{ color: '#40d0b8', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>canvas mockup</span>
      </div>
      <div style={{ color: '#6a6480', fontSize: 10, lineHeight: 1.5 }}>
        Renders the in-game fog-of-war chapter map using flat-top axial hex geometry identical to the production HexMapLayer renderer.
      </div>

      {/* System facts */}
      {SYSTEM_FACTS.map(f => (
        <div key={f.title} style={{ background: '#10101c', border: `1px solid ${f.color}28`, borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ color: f.color, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
          <div style={{ color: '#888098', fontSize: 9.5, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{f.body}</div>
        </div>
      ))}

      {/* Design-match checklist */}
      <div style={{ background: '#0e0e18', border: '1px solid #2a2840', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ color: '#a090c8', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Design-Match Checklist</div>
        {CHECKLIST.map(c => (
          <div key={c.label} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
            <span style={{ color: c.ok ? '#40d0a0' : '#c04040', fontSize: 10 }}>{c.ok ? '✓' : '✗'}</span>
            <span style={{ color: '#7a7098', fontSize: 9.5 }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function FogboundHexMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#06060e',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 24px 48px',
      gap: 32,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ color: '#40d0b8', fontSize: 12, letterSpacing: '0.14em', marginBottom: 4, textTransform: 'uppercase' }}>
          Mockup · journey-map-aesthetics
        </div>
        <div style={{ color: '#e0d8ff', fontSize: 22, fontWeight: 700 }}>Fogbound Hex Map</div>
        <div style={{ color: '#5a5478', fontSize: 11, marginTop: 4 }}>
          Canvas 2D · 360 × 780 · flat-top axial hex · fog-of-war
        </div>
      </div>

      {/* Phone + annotation side by side */}
      <div style={{ display: 'flex', gap: 36, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        <PhoneFrame canvasRef={canvasRef} />
        <AnnotationPanel />
      </div>
    </div>
  );
}
