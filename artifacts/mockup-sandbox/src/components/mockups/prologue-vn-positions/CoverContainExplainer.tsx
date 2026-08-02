/**
 * CoverContainExplainer
 *
 * Visual explanation of objectFit cover vs contain using the actual
 * portrait images from PrologueVNBar, plus a diagram of what each
 * mode does to the image box.
 */

const W = 390;
const H = 844;
const BAR_H = 200;
const PORTRAIT_W = Math.round(W * 0.74); // 289px

const BG    = "/__mockup/images/prologue/ward_corridor_battle.png";
const NIGHT = "/__mockup/images/prologue/nightingale_vn_extended.png";
const PROD  = "/__mockup/images/prologue/prodigy_vn_canonical.png";

// Nightingale: native 896×1040 (tall) → cover fills full column, no empty space
// Prodigy: native 896×1060, artHeight = W*0.74*1060/896 ≈ 341px → contain, shows all art
const NIGHTINGALE_H = H - BAR_H;                               // 644 — fills available space
const PRODIGY_H     = Math.round(W * 0.74 * (1060 / 896));   // 341

// ── Small diagram ────────────────────────────────────────────────────────────

function FitDiagram({ mode }: { mode: "cover" | "contain" }) {
  const isCover = mode === "cover";
  // Box = the portrait container (rectangle with dashed border)
  // Image = the actual image extent (larger or smaller)
  const boxW = 80, boxH = 100;
  const imgW = isCover ? 100 : 60;   // cover: image overflows; contain: image fits inside
  const imgH = isCover ? 120 : 70;
  const imgX = (boxW - imgW) / 2;
  const imgY = (boxH - imgH) / 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={boxW + 40} height={boxH + 40} style={{ overflow: "visible" }}>
        {/* clipping region for cover to show overflow bleed hint */}
        <defs>
          <clipPath id={`clip-${mode}`}>
            <rect x={20} y={20} width={boxW} height={boxH} />
          </clipPath>
        </defs>

        {/* Image extent (could overflow or be smaller than box) */}
        <rect
          x={20 + imgX} y={20 + imgY} width={imgW} height={imgH}
          fill={isCover ? "rgba(100,180,255,0.18)" : "rgba(100,220,140,0.18)"}
          stroke={isCover ? "rgba(100,180,255,0.6)" : "rgba(100,220,140,0.6)"}
          strokeWidth={1.5}
          strokeDasharray={isCover ? "4 2" : "none"}
        />

        {/* Container box */}
        <rect
          x={20} y={20} width={boxW} height={boxH}
          fill="none"
          stroke="rgba(200,210,220,0.5)"
          strokeWidth={2}
        />

        {/* Overflow indicator for cover */}
        {isCover && (
          <>
            <line x1={20} y1={20 + imgY} x2={20 - 8} y2={20 + imgY}
              stroke="rgba(100,180,255,0.7)" strokeWidth={1} />
            <line x1={20 + boxW} y1={20 + imgY} x2={20 + boxW + 8} y2={20 + imgY}
              stroke="rgba(100,180,255,0.7)" strokeWidth={1} />
            <text x={20 - 9} y={20 + imgY - 3} fill="rgba(100,180,255,0.7)"
              fontSize={7} textAnchor="end">cropped</text>
          </>
        )}
        {/* Empty-space indicator for contain */}
        {!isCover && (
          <>
            <line x1={20} y1={20} x2={20} y2={20 + imgY - 2}
              stroke="rgba(100,220,140,0.7)" strokeWidth={1} strokeDasharray="3 2" />
            <text x={20 + 3} y={20 + imgY / 2} fill="rgba(100,220,140,0.7)"
              fontSize={7}>gap</text>
          </>
        )}

        {/* Labels */}
        <text x={20 + boxW / 2} y={20 + boxH + 14} fill="rgba(200,210,220,0.55)"
          fontSize={8} textAnchor="middle">container</text>
        <text x={20 + boxW / 2} y={20 + boxH + 24} fill={isCover ? "rgba(100,180,255,0.7)" : "rgba(100,220,140,0.7)"}
          fontSize={8} textAnchor="middle" fontWeight="bold">image ({mode})</text>
      </svg>
    </div>
  );
}

// ── Phone frame ───────────────────────────────────────────────────────────────

interface PhoneConfig {
  label:    string;
  subtitle: string;
  color:    string;
  art:      string;
  artH:     number;
  fit:      "cover" | "contain";
  avatarSrc: string;
  speakerName: string;
  line:     string;
  fitNote:  string;
}

const CHARS: PhoneConfig[] = [
  {
    label:    "NIGHTINGALE",
    subtitle: "objectFit: cover",
    color:    "#7EC8C8",
    art:      NIGHT,
    artH:     NIGHTINGALE_H,
    fit:      "cover",
    avatarSrc: NIGHT,
    speakerName: "FLORENCE\nNIGHTINGALE",
    line:     "Wait — let me run an observation scan first.",
    fitNote:  "Image fills the full portrait box.\nEdges are cropped to fill 289 × 644 px.",
  },
  {
    label:    "THE PRODIGY",
    subtitle: "objectFit: contain",
    color:    "#C89B4A",
    art:      PROD,
    artH:     PRODIGY_H,
    fit:      "contain",
    avatarSrc: PROD,
    speakerName: "THE\nPRODIGY",
    line:     "There is no time for scans. The corruption spreads.",
    fitNote:  `Full art visible — nothing cropped.\nPortrait box is 289 × 341 px\n(W × 74% × image ratio).`,
  },
];

function Phone({ c }: { c: PhoneConfig }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <p style={{ color: c.color, fontSize: 11, fontWeight: 800, letterSpacing: 2.5,
                  textTransform: "uppercase", margin: 0 }}>{c.label}</p>
      <p style={{ color: "rgba(200,210,220,0.45)", fontSize: 10, fontFamily: "monospace",
                  margin: 0 }}>{c.subtitle}</p>

      {/* phone */}
      <div style={{ position: "relative", width: W, height: H,
                    borderRadius: 28, border: `2px solid ${c.color}44`,
                    overflow: "hidden", background: "#040810", flexShrink: 0 }}>
        {/* bg */}
        <img src={BG} style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                                objectFit: "cover" }} />
        {/* bg overlay */}
        <div style={{ position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom,rgba(0,0,0,.18) 0%,rgba(0,0,0,.05) 45%,rgba(4,8,18,.78) 100%)" }} />

        {/* portrait box */}
        <div style={{ position: "absolute", right: 0, bottom: BAR_H,
                      width: PORTRAIT_W, height: c.artH, overflow: "hidden" }}>
          <img src={c.art} style={{ width: "100%", height: "100%", objectFit: c.fit,
                                     objectPosition: "top center" }} />
          {/* left blend */}
          <div style={{ position: "absolute", inset: 0,
                        background: "linear-gradient(to right,rgba(4,8,18,.82) 0%,rgba(4,8,18,0) 38%)" }} />
          {/* bottom feather */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "32%",
                        background: "linear-gradient(to bottom,transparent,rgba(4,8,18,.96))" }} />
        </div>

        {/* portrait box outline annotation */}
        <div style={{ position: "absolute", right: 0, bottom: BAR_H,
                      width: PORTRAIT_W, height: c.artH,
                      border: `1.5px dashed ${c.color}66`, pointerEvents: "none" }} />

        {/* bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BAR_H,
                      background: "rgba(6,10,20,.97)",
                      borderTop: `1.5px solid ${c.color}55` }}>
          <div style={{ height: 2, background: c.color, opacity: 0.8 }} />
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px 0", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                          gap: 5, flexShrink: 0, width: 88 }}>
              <div style={{ width: 88, height: 88, borderRadius: 44,
                            border: `3px solid ${c.color}`, overflow: "hidden" }}>
                <img src={c.avatarSrc} style={{ width: "100%", height: "100%",
                                                 objectFit: c.fit === "cover" ? "cover" : "contain" }} />
              </div>
              <span style={{ color: c.color, fontSize: 9, fontWeight: 800,
                             letterSpacing: 1.2, textAlign: "center", textTransform: "uppercase",
                             lineHeight: "13px", whiteSpace: "pre-line" }}>{c.speakerName}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#E8EEF6", fontSize: 14, lineHeight: "22px", margin: 0 }}>
                {c.line}<span style={{ color: c.color }}>▌</span>
              </p>
            </div>
            <span style={{ color: c.color, fontSize: 20, alignSelf: "flex-end",
                           paddingBottom: 4, flexShrink: 0 }}>▾</span>
          </div>
        </div>
      </div>

      {/* note below */}
      <p style={{ color: "rgba(200,210,220,0.45)", fontSize: 10, fontFamily: "monospace",
                  textAlign: "center", lineHeight: "16px", margin: 0,
                  whiteSpace: "pre-line" }}>{c.fitNote}</p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function CoverContainExplainer() {
  return (
    <div style={{ minHeight: "100vh", background: "#080C14", display: "flex",
                  flexDirection: "column", alignItems: "center", gap: 40, padding: "36px 48px" }}>

      {/* Title */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "#C8D6E8", fontSize: 12, fontWeight: 800, letterSpacing: 3,
                     textTransform: "uppercase", margin: 0 }}>
          cover vs contain — portrait fit
        </h1>
        <p style={{ color: "rgba(200,210,220,0.35)", fontSize: 10, marginTop: 6,
                    fontFamily: "monospace" }}>
          PrologueVNBar · artFit prop · portrait box right-aligned, bottom-flush with bar
        </p>
      </div>

      {/* Diagrams row */}
      <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <FitDiagram mode="cover" />
          <p style={{ color: "rgba(100,180,255,0.8)", fontSize: 10, fontWeight: 700,
                      letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>cover</p>
          <p style={{ color: "rgba(200,210,220,0.45)", fontSize: 10, textAlign: "center",
                      maxWidth: 180, lineHeight: "15px", margin: 0, fontFamily: "monospace" }}>
            Image scaled until it fills the box completely. Sides that don't fit are cropped.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <FitDiagram mode="contain" />
          <p style={{ color: "rgba(100,220,140,0.8)", fontSize: 10, fontWeight: 700,
                      letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>contain</p>
          <p style={{ color: "rgba(200,210,220,0.45)", fontSize: 10, textAlign: "center",
                      maxWidth: 180, lineHeight: "15px", margin: 0, fontFamily: "monospace" }}>
            Image scaled to fit entirely inside the box. The box height matches the image ratio so no gap appears.
          </p>
        </div>
      </div>

      {/* Phones */}
      <div style={{ display: "flex", gap: 60, alignItems: "flex-start" }}>
        {CHARS.map(c => <Phone key={c.label} c={c} />)}
      </div>
    </div>
  );
}
