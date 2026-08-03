/**
 * ScenePositions — FormerSelfIntroScene portrait & bar layout
 *
 * Shows Nightingale and The Prodigy side-by-side at mobile scale (390×844),
 * replicating the exact proportions used by PrologueVNBar:
 *   • Portrait: right-aligned, 74% screen width, bottom-flush with dialogue bar
 *   • Left-edge linear gradient blend (82% → 0 over 38% of portrait width)
 *   • Bottom feather on portrait (transparent → near-black, bottom 32%)
 *   • Dialogue bar: accent strip + avatar ring (92×92) + text + ▾ arrow
 */

const W = 390;
const H = 844;
const BAR_H = 200;            // matches VN_BAR_HEIGHT default
const PORTRAIT_W = W * 0.74; // 288.6 → 289px

// Nightingale: cover fit, so we let the image fill the portrait column height
const NIGHTINGALE_H = H - BAR_H;  // 644px (cover — fills available space)

// Prodigy: contain fit, aspect-ratio from code: W * 0.74 * 1060 / 896
const PRODIGY_H = Math.round(W * 0.74 * (1060 / 896)); // ≈ 341px

const BG = "/__mockup/images/prologue/ward_corridor_battle.png";
const NIGHTINGALE_ART = "/__mockup/images/prologue/nightingale_vn_extended.png";
const PRODIGY_ART     = "/__mockup/images/prologue/prodigy_vn_extended.png";

interface CharConfig {
  label:       string;
  color:       string;          // accent
  barColor:    string;
  art:         string;
  artH:        number;
  artFit:      "cover" | "contain";
  avatarSrc:   string;
  speakerLine: string;
  dialogueLine: string;
}

const CHARS: CharConfig[] = [
  {
    label:       "Nightingale",
    color:       "#7EC8C8",
    barColor:    "rgba(6,18,28,0.97)",
    art:         NIGHTINGALE_ART,
    artH:        NIGHTINGALE_H,
    artFit:      "cover",
    avatarSrc:   NIGHTINGALE_ART,
    speakerLine: "FLORENCE\nNIGHTINGALE",
    dialogueLine: "Wait — let me run an observation scan first. The monitoring readings are behaving strangely.",
  },
  {
    label:       "The Prodigy",
    color:       "#C89B4A",
    barColor:    "rgba(18,14,6,0.97)",
    art:         PRODIGY_ART,
    artH:        PRODIGY_H,
    artFit:      "contain",
    avatarSrc:   PRODIGY_ART,
    speakerLine: "THE\nPRODIGY",
    dialogueLine: "There is no time for scans. The corruption spreads while we stand and deliberate.",
  },
];

function PhoneFrame({ char }: { char: CharConfig }) {
  const portraitBottom = BAR_H;   // flush with top of bar

  return (
    <div className="flex flex-col items-center gap-3">
      {/* label above */}
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: char.color }}>
        {char.label}
      </p>

      {/* phone bezel */}
      <div
        className="relative overflow-hidden rounded-[28px] border-2 shadow-2xl flex-shrink-0"
        style={{ width: W, height: H, borderColor: `${char.color}44`, background: "#040810" }}
      >
        {/* ── Background ── */}
        <img
          src={BG}
          alt="background"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* ── Dim overlay so art reads clearly ── */}
        <div
          style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.05) 45%, rgba(4,8,18,0.78) 100%)",
          }}
        />

        {/* ── Character portrait — right side, bottom-flush with bar ── */}
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: portraitBottom,
            width: PORTRAIT_W,
            height: char.artH,
            overflow: "hidden",
          }}
        >
          <img
            src={char.art}
            alt={char.label}
            style={{ width: "100%", height: "100%", objectFit: char.artFit, objectPosition: "top center" }}
          />
          {/* left-edge blend */}
          <div
            style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to right, rgba(4,8,18,0.82) 0%, rgba(4,8,18,0) 38%)",
            }}
          />
          {/* bottom feather */}
          <div
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "32%",
              background: "linear-gradient(to bottom, transparent, rgba(4,8,18,0.96))",
            }}
          />
        </div>

        {/* ── Portrait position annotation lines ── */}
        {/* Right edge marker */}
        <div style={{
          position: "absolute", right: 0, bottom: portraitBottom,
          width: 2, height: char.artH,
          background: `${char.color}55`,
          borderRight: `1.5px dashed ${char.color}88`,
        }} />
        {/* Left edge of portrait marker */}
        <div style={{
          position: "absolute", right: PORTRAIT_W, bottom: portraitBottom,
          width: 1.5, height: char.artH,
          borderRight: `1.5px dashed ${char.color}55`,
        }} />
        {/* Portrait width label */}
        <div style={{
          position: "absolute", bottom: portraitBottom + char.artH + 6, right: 0,
          width: PORTRAIT_W,
          display: "flex", justifyContent: "center",
        }}>
          <span style={{
            color: `${char.color}bb`, fontSize: 9, fontFamily: "monospace", fontWeight: 700,
            background: "rgba(4,8,18,0.82)", padding: "1px 5px", borderRadius: 3,
            letterSpacing: 0.8,
          }}>
            W × 74% = {Math.round(PORTRAIT_W)}px
          </span>
        </div>

        {/* ── Dialogue bar ── */}
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: BAR_H,
            background: char.barColor,
            borderTop: `1.5px solid ${char.color}66`,
          }}
        >
          {/* Accent strip */}
          <div style={{ height: 2, background: char.color, opacity: 0.8 }} />

          {/* Inner row */}
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 0", gap: 14 }}>
            {/* Left: avatar + name */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, width: 92 }}>
              <div style={{
                width: 92, height: 92, borderRadius: 46,
                border: `3px solid ${char.color}`,
                overflow: "hidden", flexShrink: 0,
              }}>
                <img
                  src={char.avatarSrc}
                  alt={char.label}
                  style={{ width: "100%", height: "100%", objectFit: char.artFit === "cover" ? "cover" : "contain" }}
                />
              </div>
              <span style={{
                color: char.color, fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
                textAlign: "center", textTransform: "uppercase", lineHeight: "13px",
                whiteSpace: "pre-line",
              }}>
                {char.speakerLine}
              </span>
            </div>

            {/* Dialogue text */}
            <div style={{ flex: 1 }}>
              <p style={{ color: "#E8EEF6", fontSize: 15, fontWeight: 400, lineHeight: "23px", margin: 0 }}>
                {char.dialogueLine}
                <span style={{ color: char.color }}>▌</span>
              </p>
            </div>

            {/* Arrow */}
            <div style={{ alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 }}>
              <span style={{ color: char.color, fontSize: 22, fontWeight: 900, opacity: 0.9 }}>▾</span>
            </div>
          </div>
        </div>

        {/* ── Bar height annotation ── */}
        <div style={{
          position: "absolute", left: 4, bottom: 0,
          height: BAR_H, width: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderLeft: `1.5px dashed ${char.color}77`,
        }}>
          <span style={{
            color: `${char.color}bb`, fontSize: 8, fontFamily: "monospace",
            writingMode: "vertical-rl", transform: "rotate(180deg)",
            letterSpacing: 0.5, fontWeight: 700,
            background: "rgba(4,8,18,0.82)", padding: "2px 2px",
          }}>
            bar {BAR_H}px
          </span>
        </div>
      </div>

      {/* measurements below */}
      <div className="flex flex-col items-center gap-1" style={{ color: "rgba(200,210,220,0.55)", fontSize: 10, fontFamily: "monospace" }}>
        <span>portrait h: {char.artH}px  ({char.artFit})</span>
        <span>portrait bottom: {portraitBottom}px from screen bottom</span>
      </div>
    </div>
  );
}

export function ScenePositions() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-10 py-10"
      style={{ background: "#080C14" }}
    >
      {/* Title */}
      <div className="text-center">
        <h1 style={{ color: "#C8D6E8", fontSize: 13, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>
          FormerSelfIntroScene — VN Portrait & Bar Layout
        </h1>
        <p style={{ color: "rgba(200,210,220,0.4)", fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
          PrologueVNBar · right-aligned portrait · 74% width · bottom-flush with dialogue bar
        </p>
      </div>

      {/* Two phone frames side by side */}
      <div className="flex flex-row items-start gap-16">
        {CHARS.map((c) => (
          <PhoneFrame key={c.label} char={c} />
        ))}
      </div>

      {/* Legend */}
      <div
        className="flex flex-row gap-8 px-6 py-4 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {[
          { color: "rgba(200,210,220,0.6)", label: "Dialogue bar (200px + safe-area inset)" },
          { color: "rgba(200,210,220,0.6)", label: "Portrait: right-aligned, bottom-flush with bar" },
          { color: "rgba(200,210,220,0.6)", label: "Left-edge blend gradient (0→38% of portrait width)" },
          { color: "rgba(200,210,220,0.6)", label: "Bottom feather (bottom 32% of portrait)" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
            <span style={{ color: "rgba(200,210,220,0.55)", fontSize: 10, fontFamily: "monospace" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
