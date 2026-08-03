/**
 * CoverContainExplainer
 *
 * Visual explanation of objectFit cover vs contain using the actual
 * portrait images from PrologueVNBar, plus a diagram of what each
 * mode does to the image box.
 *
 * Characters shown:
 *  Nightingale — cover  (fills 289 × 644 px portrait box)
 *  The Prodigy — contain (289 × 341 px, ratio-matched)
 *  Fleming     — contain (289 × 389 px, ratio-matched)
 */

const W = 390;
const H = 844;
const BAR_H = 200;
const PORTRAIT_W = Math.round(W * 0.74); // 289px

const BG    = "/__mockup/images/prologue/ward_corridor_battle.png";
const NIGHT = "/__mockup/images/prologue/nightingale_vn_extended.png";
const PROD  = "/__mockup/images/prologue/prodigy_vn_extended.png";
const FLEM  = "/__mockup/images/prologue/fleming_vn_extended.png";

const NIGHTINGALE_H = H - BAR_H;
const PRODIGY_H     = Math.round(W * 0.74 * (1060 / 896));
const FLEMING_H     = Math.round(W * 0.74 * (1203 / 896)); // ≈ 389px

// ── Small diagram ─────────────────────────────────────────────────────────────

function FitDiagram({ mode }: { mode: "cover" | "contain" }) {
  const isCover = mode === "cover";
  const boxW = 80, boxH = 100;
  const imgW = isCover ? 100 : 60;
  const imgH = isCover ? 120 : 70;
  const imgX = (boxW - imgW) / 2;
  const imgY = (boxH - imgH) / 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={boxW + 40} height={boxH + 40} style={{ overflow: "visible" }}>
        <defs>
          <clipPath id={`clip-${mode}`}>
            <rect x={20} y={20} width={boxW} height={boxH} />
          </clipPath>
        </defs>
        <rect
          x={20 + imgX} y={20 + imgY} width={imgW} height={imgH}
          fill={isCover ? "rgba(100,180,255,0.18)" : "rgba(100,220,140,0.18)"}
          stroke={isCover ? "rgba(100,180,255,0.6)" : "rgba(100,220,140,0.6)"}
          strokeWidth={1.5} strokeDasharray={isCover ? "4 2" : "none"}
        />
        <rect x={20} y={20} width={boxW} height={boxH}
          fill="none" stroke="rgba(200,210,220,0.5)" strokeWidth={2} />
        {isCover && (
          <>
            <line x1={20} y1={20 + imgY} x2={20 - 8} y2={20 + imgY}
              stroke="rgba(100,180,255,0.7)" strokeWidth={1} />
            <text x={20 - 9} y={20 + imgY - 3} fill="rgba(100,180,255,0.7)"
              fontSize={7} textAnchor="end">cropped</text>
          </>
        )}
        {!isCover && (
          <>
            <line x1={20} y1={20} x2={20} y2={20 + imgY - 2}
              stroke="rgba(100,220,140,0.7)" strokeWidth={1} strokeDasharray="3 2" />
            <text x={20 + 3} y={20 + imgY / 2} fill="rgba(100,220,140,0.7)" fontSize={7}>gap</text>
          </>
        )}
        <text x={20 + boxW / 2} y={20 + boxH + 14} fill="rgba(200,210,220,0.55)"
          fontSize={8} textAnchor="middle">container</text>
        <text x={20 + boxW / 2} y={20 + boxH + 24}
          fill={isCover ? "rgba(100,180,255,0.7)" : "rgba(100,220,140,0.7)"}
          fontSize={8} textAnchor="middle" fontWeight="bold">image ({mode})</text>
      </svg>
    </div>
  );
}

// ── Phone frame ───────────────────────────────────────────────────────────────

interface PhoneConfig {
  label:        string;
  subtitle:     string;
  color:        string;
  art:          string;
  artH:         number;
  fit:          "cover" | "contain";
  avatarFit:    "cover" | "contain";
  speakerName:  string;
  line:         string;
  fitNote:      string;
}

const CHARS: PhoneConfig[] = [
  {
    label:       "NIGHTINGALE",
    subtitle:    "objectFit: cover",
    color:       "#7EC8C8",
    art:         NIGHT,
    artH:        NIGHTINGALE_H,
    fit:         "cover",
    avatarFit:   "cover",
    speakerName: "FLORENCE\nNIGHTINGALE",
    line:        "Wait — let me run an observation scan first.",
    fitNote:     "Image fills the full portrait box.\nEdges cropped to fill 289 × 644 px.",
  },
  {
    label:       "THE PRODIGY",
    subtitle:    "objectFit: contain",
    color:       "#C89B4A",
    art:         PROD,
    artH:        PRODIGY_H,
    fit:         "contain",
    avatarFit:   "contain",
    speakerName: "THE\nPRODIGY",
    line:        "There is no time for scans. The corruption spreads.",
    fitNote:     `Full art visible — nothing cropped.\nPortrait box 289 × 341 px\n(W × 74% × image ratio 1060/896).`,
  },
  {
    label:       "FLEMING",
    subtitle:    "objectFit: contain",
    color:       "#8AB87A",
    art:         FLEM,
    artH:        FLEMING_H,
    fit:         "contain",
    avatarFit:   "contain",
    speakerName: "ALEXANDER\nFLEMING",
    line:        "This corruption is adapting. To act without assessing the resistance—",
    fitNote:     `Full art visible — nothing cropped.\nPortrait box 289 × 389 px\n(W × 74% × image ratio 1203/896).`,
  },
];

function Phone({ c }: { c: PhoneConfig }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <p style={{ color: c.color, fontSize: 11, fontWeight: 800, letterSpacing: 2.5,
                  textTransform: "uppercase", margin: 0 }}>{c.label}</p>
      <p style={{ color: "rgba(200,210,220,0.45)", fontSize: 10, fontFamily: "monospace",
                  margin: 0 }}>{c.subtitle}</p>

      <div style={{ position: "relative", width: W, height: H,
                    borderRadius: 28, border: `2px solid ${c.color}44`,
                    overflow: "hidden", background: "#040810", flexShrink: 0 }}>
        {/* bg */}
        <img src={BG} style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                                objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom,rgba(0,0,0,.18) 0%,rgba(0,0,0,.05) 45%,rgba(4,8,18,.78) 100%)" }} />

        {/* portrait box */}
        <div style={{ position: "absolute", right: 0, bottom: BAR_H,
                      width: PORTRAIT_W, height: c.artH, overflow: "hidden" }}>
          <img src={c.art} style={{ width: "100%", height: "100%", objectFit: c.fit,
                                     objectPosition: "top center" }} />
          <div style={{ position: "absolute", inset: 0,
                        background: "linear-gradient(to right,rgba(4,8,18,.82) 0%,rgba(4,8,18,0) 38%)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "32%",
                        background: "linear-gradient(to bottom,transparent,rgba(4,8,18,.96))" }} />
        </div>

        {/* portrait box dashed annotation */}
        <div style={{ position: "absolute", right: 0, bottom: BAR_H,
                      width: PORTRAIT_W, height: c.artH,
                      border: `1.5px dashed ${c.color}55`, pointerEvents: "none" }} />

        {/* portrait height label */}
        <div style={{ position: "absolute", right: PORTRAIT_W + 4, bottom: BAR_H,
                      height: c.artH, display: "flex", alignItems: "center" }}>
          <span style={{ color: `${c.color}99`, fontSize: 8, fontFamily: "monospace",
                         fontWeight: 700, writingMode: "vertical-rl",
                         transform: "rotate(180deg)", letterSpacing: 0.5 }}>
            {c.artH}px
          </span>
        </div>

        {/* portrait width label */}
        {c.artH < H - BAR_H - 30 && (
          <div style={{ position: "absolute", bottom: BAR_H + c.artH + 6, right: 0,
                        width: PORTRAIT_W, display: "flex", justifyContent: "center" }}>
            <span style={{ color: `${c.color}aa`, fontSize: 8, fontFamily: "monospace",
                           fontWeight: 700, background: "rgba(4,8,18,0.85)",
                           padding: "1px 5px", borderRadius: 3, letterSpacing: 0.5 }}>
              W × 74% = {PORTRAIT_W}px
            </span>
          </div>
        )}

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
                <img src={c.art} style={{ width: "100%", height: "100%",
                                           objectFit: c.avatarFit }} />
              </div>
              <span style={{ color: c.color, fontSize: 9, fontWeight: 800,
                             letterSpacing: 1.2, textAlign: "center",
                             textTransform: "uppercase", lineHeight: "13px",
                             whiteSpace: "pre-line" }}>{c.speakerName}</span>
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

      <p style={{ color: "rgba(200,210,220,0.45)", fontSize: 10, fontFamily: "monospace",
                  textAlign: "center", lineHeight: "16px", margin: 0,
                  whiteSpace: "pre-line" }}>{c.fitNote}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CoverContainExplainer() {
  return (
    <div style={{ minHeight: "100vh", background: "#080C14", display: "flex",
                  flexDirection: "column", alignItems: "center",
                  gap: 40, padding: "36px 48px" }}>

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

      {/* Diagrams */}
      <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
        {(["cover", "contain"] as const).map(mode => (
          <div key={mode} style={{ display: "flex", flexDirection: "column",
                                   alignItems: "center", gap: 6 }}>
            <FitDiagram mode={mode} />
            <p style={{ color: mode === "cover" ? "rgba(100,180,255,0.8)" : "rgba(100,220,140,0.8)",
                        fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                        textTransform: "uppercase", margin: 0 }}>{mode}</p>
            <p style={{ color: "rgba(200,210,220,0.45)", fontSize: 10, textAlign: "center",
                        maxWidth: 180, lineHeight: "15px", margin: 0, fontFamily: "monospace" }}>
              {mode === "cover"
                ? "Image scaled until it fills the box. Sides that don't fit are cropped."
                : "Image scaled to fit entirely inside. Box height matches image ratio — no gap."}
            </p>
          </div>
        ))}
      </div>

      {/* Three phones */}
      <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
        {CHARS.map(c => <Phone key={c.label} c={c} />)}
      </div>
    </div>
  );
}
