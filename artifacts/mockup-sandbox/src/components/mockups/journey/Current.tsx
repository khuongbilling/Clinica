/**
 * Journey — Current Design (post vibe-coding push)
 *
 * Faithful web recreation of frontend/app/journey.tsx (Chapter tab) with the
 * new Fogbound Tile Map shell (frontend/src/components/FogboundTileMap.tsx).
 * All tokens copied verbatim from src/theme/ui.ts + src/theme/colors.ts.
 */
import React, { useMemo, useState } from "react";

// ── Tokens (exact copies) ────────────────────────────────────────────────────
const UI = {
  bgBase: "#1A1526",
  gold: "#E8C868",
  onGold: "#1B1308",
  teal: "#4FD8C4",
  lavender: "#BBA7EA",
  text: "#F6F0E4",
  textSoft: "#CFC6DC",
  textDim: "#948BA6",
  border: "rgba(232,200,104,0.20)",
  sanctuaryBg: "#0B1825",
  sanctuaryPanel: "#122030",
  sanctuaryCard: "#192C3C",
  sanctuaryBorder: "rgba(61,196,168,0.18)",
};
const COLORS = {
  brand: "#D4AF37",
  brandTertiary: "#3A3116",
  onBrand: "#0C0E12",
  onSurface: "#E8EAF0",
  onSurfaceTertiary: "#7A8494",
  surfaceTertiary: "#1E2328",
  error: "#EF4444",
};
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const R = { sm: 4, md: 8 };

// ── Chapter data (chapter 1 — fogbound_tiles) ───────────────────────────────
const CHAPTER = { number: 1, theme: "The Fading Apprentice", accent: "#D4AF37", completionXp: 30 };
const CHAPTER_TABS = [
  { n: 1, status: "current" }, { n: 2, status: "open" }, { n: 3, status: "locked" },
  { n: 4, status: "locked" }, { n: 5, status: "locked" }, { n: 6, status: "locked" },
  { n: 7, status: "locked" }, { n: 8, status: "locked" }, { n: 9, status: "locked" }, { n: 10, status: "locked" },
];

const TILE_ACCENT: Record<string, string> = {
  battle: "#EF4444", treasure: "#D4AF37", merchant: "#4FD8C4",
  area_boss: "#F97316", boss_gate: "#8B5CF6", empty: "#334155",
};
const TILE_GLYPH: Record<string, string> = {
  battle: "⚡", treasure: "🎁", merchant: "🏪", area_boss: "💀", boss_gate: "🔒", empty: "◦",
};
const TILE_OUTCOMES = [
  { type: "battle", glyph: "⚡", label: "Battle", desc: "A Ward Shift encounter. Defeat the disease-spirit to progress.", accent: "#EF4444" },
  { type: "treasure", glyph: "🎁", label: "Treasure", desc: "A supply cache. Collect Ward Coins, Codex Shards, or items.", accent: "#D4AF37" },
  { type: "merchant", glyph: "🏪", label: "Merchant", desc: "Trade post. Exchange Ward Coins for consumables at special rates.", accent: "#4FD8C4" },
  { type: "area_boss", glyph: "💀", label: "Area Boss", desc: "A powerful sub-boss guarding this map zone. Drops key fragments.", accent: "#F97316" },
];
const MERCHANT_RATES: [string, number][] = [
  ["health tonic", 30], ["stabilize charm", 50], ["ward shield", 45],
  ["diagnosis scroll", 35], ["assessment kit", 60], ["antidote vial", 40],
];

// Deterministic tile grid (7×8) mirroring getDefaultFogMapConfig behaviour.
function makeTiles() {
  const rows = 8, cols = 7;
  let h = 2166136261; // FNV-ish hash of "chapter_1"
  for (const c of "chapter_1") { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const tiles: { id: string; row: number; col: number; type: string; revealed: boolean; visited: boolean; keyFragment?: boolean }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = rnd();
    let type = "empty";
    if (r === 0 && c === 3) type = "boss_gate";
    else if (v < 0.3) type = "battle";
    else if (v < 0.42) type = "treasure";
    else if (v < 0.5) type = "merchant";
    else if (v < 0.56) type = "area_boss";
    const near = Math.abs(r - 7) <= 1 && Math.abs(c - 3) <= 1;
    tiles.push({ id: `tile_${r}_${c}`, row: r, col: c, type, revealed: near, visited: r === 7 && c === 3, keyFragment: type === "area_boss" && v < 0.53 });
  }
  return tiles;
}

// ── Small helpers ────────────────────────────────────────────────────────────
const Ico = ({ g, size = 14, color }: { g: string; size?: number; color?: string }) => (
  <span style={{ fontSize: size, lineHeight: 1, color, display: "inline-block" }}>{g}</span>
);

export default function Current() {
  const tiles = useMemo(makeTiles, []);
  const [activeTab, setActiveTab] = useState("chapter");
  const explored = tiles.filter((t) => t.visited).length;
  const pct = Math.round((explored / 56) * 100);

  const rpgTabs = [
    { key: "chapter", label: "Chapter", glyph: "🧭" },
    { key: "lessons", label: "Lessons", glyph: "🪷" },
    { key: "quests", label: "Quests", glyph: "🛡", badge: 3 },
    { key: "memories", label: "Memories", glyph: "📖" },
  ];

  return (
    <div style={{ width: 430, margin: "0 auto", minHeight: "100vh", background: UI.sanctuaryBg, color: UI.text, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: SP.sm, padding: `${SP.sm}px ${SP.md}px`, borderBottom: `1px solid ${UI.sanctuaryBorder}` }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: UI.sanctuaryPanel, border: `1px solid ${UI.sanctuaryBorder}`, display: "grid", placeItems: "center", color: COLORS.onSurface }}>‹</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: COLORS.brand }}>PHASE 1 · CHAPTERS 1–10</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.onSurface }}>Chapter Journey</div>
        </div>
        <div style={{ background: COLORS.brandTertiary, borderRadius: R.sm, border: `1px solid ${COLORS.brand}60`, padding: `4px ${SP.sm}px`, fontSize: 12, fontWeight: 700, color: COLORS.brand }}>Lv.3</div>
      </div>

      {/* RPG tab bar */}
      <div style={{ background: UI.bgBase, borderBottom: `1px solid ${UI.border}`, display: "flex", padding: `0 ${SP.sm}px` }}>
        {rpgTabs.map((t) => {
          const active = t.key === activeTab;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "10px 4px 8px", position: "relative", borderBottom: active ? `2px solid ${UI.gold}` : "2px solid transparent" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Ico g={t.glyph} size={13} />
                <span style={{ fontSize: 12, fontWeight: 700, color: active ? UI.gold : UI.textDim }}>{t.label}</span>
                {!!t.badge && <span style={{ background: COLORS.error, color: "#fff", borderRadius: 8, fontSize: 9, fontWeight: 800, padding: "1px 5px" }}>{t.badge}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab !== "chapter" && (
        <div style={{ padding: 40, textAlign: "center", color: UI.textDim, fontSize: 12 }}>
          ({rpgTabs.find((t) => t.key === activeTab)?.label} tab — list view; Chapter tab holds the new map design)
        </div>
      )}

      {activeTab === "chapter" && (
        <>
          {/* Next-step strip */}
          <div style={{ display: "flex", alignItems: "center", gap: SP.sm, margin: `${SP.sm}px ${SP.md}px`, background: UI.sanctuaryPanel, borderRadius: R.md, border: `1px solid ${UI.sanctuaryBorder}`, padding: SP.sm }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: CHAPTER.accent }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: CHAPTER.accent }}>NEXT · CH.1 — PART 4</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.onSurface, marginTop: 1 }}>First Ward Shift — The Dehydration Wisp</div>
            </div>
            <Ico g="➜" size={16} color={CHAPTER.accent} />
          </div>

          {/* Chapter selector */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: `0 ${SP.md}px ${SP.sm}px`, scrollbarWidth: "none" as any }}>
            {CHAPTER_TABS.map((c) => {
              const sel = c.n === 1, locked = c.status === "locked";
              return (
                <div key={c.n} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: R.md, border: `1px solid ${sel ? CHAPTER.accent : UI.sanctuaryBorder}`, background: sel ? CHAPTER.accent + "22" : UI.sanctuaryPanel, opacity: locked ? 0.35 : 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: sel ? CHAPTER.accent : locked ? COLORS.onSurfaceTertiary : UI.textSoft }}>CH.{c.n}</span>
                  {locked && <Ico g="🔒" size={8} />}
                </div>
              );
            })}
          </div>

          {/* ── Fogbound Tile Map ── */}
          {/* Map header */}
          <div style={{ display: "flex", alignItems: "center", gap: SP.xs, padding: `${SP.sm}px ${SP.md}px`, borderBottom: `1px solid ${UI.sanctuaryBorder}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: UI.sanctuaryPanel, border: `1px solid ${UI.sanctuaryBorder}`, display: "grid", placeItems: "center" }}>‹</div>
            <div style={{ flex: 1 }}>
              <span style={{ background: UI.gold + "22", border: `1px solid ${UI.gold}40`, borderRadius: R.sm, padding: "2px 6px", fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: UI.gold }}>PHASE 1</span>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{CHAPTER.theme}</div>
            </div>
            <span style={{ display: "inline-flex", gap: 4, alignItems: "center", background: UI.teal + "18", border: `1px solid ${UI.teal}40`, borderRadius: R.sm, padding: "4px 8px", fontSize: 12, fontWeight: 700, color: UI.teal }}>👣 8/12</span>
            <span style={{ background: UI.sanctuaryPanel, border: `1px solid ${UI.sanctuaryBorder}`, borderRadius: R.sm, padding: "3px 6px", fontSize: 10, fontWeight: 600, color: UI.textDim }}>-1 / move</span>
            <span style={{ color: UI.textDim, fontSize: 16 }}>ⓘ</span>
          </div>

          {/* Key fragment card */}
          <div style={{ margin: `${SP.sm}px ${SP.md}px 0`, background: UI.sanctuaryPanel, borderRadius: R.md, border: "1px solid #D4AF3740", padding: SP.sm, display: "flex", alignItems: "center", gap: SP.sm }}>
            <div style={{ display: "flex", alignItems: "center", gap: SP.xs }}>
              <Ico g="🗝" size={18} color="#D4AF37" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#D4AF37" }}>0 / 3</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: UI.textSoft }}>Chapter Key Fragments</div>
              </div>
            </div>
            <div style={{ flex: 1, fontSize: 11, color: UI.textDim, textAlign: "right", lineHeight: "16px" }}>Collect 3 to unlock the Chapter Boss Gate</div>
          </div>

          {/* Boss gate */}
          <div style={{ display: "flex", justifyContent: "center", padding: `${SP.xs}px 0` }}>
            <div style={{ display: "flex", alignItems: "center", gap: SP.xs, background: "#1A0B0580", borderRadius: R.md, border: `2px solid ${UI.textDim}50`, padding: `${SP.sm}px ${SP.md}px` }}>
              <Ico g="🔒" size={18} color={UI.textDim} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, color: UI.textDim }}>BOSS GATE — LOCKED</span>
            </div>
          </div>

          {/* Hex tile grid */}
          <div style={{ overflowX: "auto", padding: `${SP.sm}px ${SP.md}px` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "max-content" }}>
              {Array.from({ length: 8 }, (_, r) => (
                <div key={r} style={{ display: "flex", gap: 2, marginLeft: r % 2 === 1 ? 22 : 0 }}>
                  {tiles.filter((t) => t.row === r).map((t) => {
                    const accent = TILE_ACCENT[t.type];
                    const player = t.id === "tile_7_3";
                    return (
                      <div key={t.id} style={{ width: 44, height: 38, borderRadius: R.sm, position: "relative", display: "grid", placeItems: "center", background: t.visited ? UI.sanctuaryCard : UI.sanctuaryPanel, border: player ? `2px solid ${UI.gold}` : `1px solid ${t.revealed ? accent + "60" : "#334155"}` }}>
                        {!t.revealed ? (
                          <div style={{ position: "absolute", inset: 0, background: "#0B1825CC", borderRadius: R.sm, display: "grid", placeItems: "center" }}><Ico g="☁" size={14} color="#334155" /></div>
                        ) : (
                          <>
                            <Ico g={TILE_GLYPH[t.type]} size={13} color={accent} />
                            {t.keyFragment && <div style={{ position: "absolute", top: 3, right: 3, width: 6, height: 6, borderRadius: 3, background: "#D4AF37" }} />}
                          </>
                        )}
                        {player && (
                          <div style={{ position: "absolute", bottom: 3, right: 3, width: 14, height: 14, borderRadius: 7, background: UI.gold, display: "grid", placeItems: "center", fontSize: 8, color: UI.onGold }}>●</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ margin: `0 ${SP.md}px`, background: UI.sanctuaryPanel, borderRadius: R.md, border: `1px solid ${UI.sanctuaryBorder}`, padding: SP.sm }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: UI.textDim, marginBottom: SP.xs }}>TILE OUTCOMES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: SP.xs }}>
              {TILE_OUTCOMES.map((o) => (
                <div key={o.type} style={{ display: "flex", gap: SP.xs }}>
                  <div style={{ width: 28, height: 28, borderRadius: R.sm, flexShrink: 0, display: "grid", placeItems: "center", background: o.accent + "22", border: `1px solid ${o.accent}55` }}><Ico g={o.glyph} size={13} /></div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: o.accent }}>{o.label}</div>
                    <div style={{ fontSize: 11, color: UI.textDim, lineHeight: "15px" }}>{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Merchant rates */}
          <div style={{ margin: `${SP.sm}px ${SP.md}px 0`, background: UI.sanctuaryPanel, borderRadius: R.md, border: `1px solid ${UI.teal}30`, padding: SP.sm }}>
            <div style={{ display: "flex", alignItems: "center", gap: SP.xs, marginBottom: SP.xs }}>
              <Ico g="🏪" size={13} color={UI.teal} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: UI.teal }}>MERCHANT RATES</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: SP.xs }}>
              {MERCHANT_RATES.map(([name, cost]) => (
                <span key={name} style={{ display: "inline-flex", gap: 4, alignItems: "center", background: UI.sanctuaryCard, borderRadius: R.sm, padding: "4px 8px", fontSize: 11, color: UI.textSoft, textTransform: "capitalize" }}>
                  {name} <b style={{ color: UI.teal }}>{cost} ⚙</b>
                </span>
              ))}
            </div>
          </div>

          {/* Progress card */}
          <div style={{ margin: `${SP.sm}px ${SP.md}px 80px`, background: UI.sanctuaryPanel, borderRadius: R.md, border: `1px solid ${UI.sanctuaryBorder}`, padding: SP.md, display: "flex", flexDirection: "column", gap: SP.xs }}>
            <div style={{ display: "flex", alignItems: "center", gap: SP.sm, marginBottom: 4 }}>
              <div style={{ width: 48, height: 48, borderRadius: R.sm, display: "grid", placeItems: "center", background: CHAPTER.accent + "22", border: `1px solid ${CHAPTER.accent}55` }}><Ico g="✨" size={22} color={CHAPTER.accent} /></div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: UI.textDim }}>Chapter {CHAPTER.number}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{CHAPTER.theme}</div>
              </div>
            </div>
            <div style={{ height: 8, background: UI.sanctuaryCard, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: 8, width: `${Math.max(pct, 2)}%`, borderRadius: 4, background: CHAPTER.accent, minWidth: 4 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: UI.textSoft, alignSelf: "flex-end", marginTop: -4 }}>{pct}%</div>
            <div style={{ fontSize: 12, color: UI.textDim }}>Explored {explored}/56 tiles</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: SP.xs, marginTop: 4 }}>
              {[["⭐", `+${CHAPTER.completionXp} XP`], ["🛡", "Chapter Stars"], ["🗝", "Boss Access"]].map(([g, txt]) => (
                <span key={txt} style={{ display: "inline-flex", gap: 4, alignItems: "center", background: UI.sanctuaryCard, border: `1px solid ${UI.sanctuaryBorder}`, borderRadius: R.sm, padding: "4px 8px", fontSize: 11, fontWeight: 600, color: UI.textSoft }}>
                  <Ico g={g} size={10} /> {txt}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
