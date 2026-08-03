/**
 * TacticalWarningPositions
 *
 * Shows all four TacticalWarningScene characters as active speaker,
 * with annotated portrait area and dialogue panel padding.
 *
 * Key differences from PrologueVNBar scenes:
 *   • Portrait width: W × 68% = 265 px  (VNBar uses 74% = 289 px)
 *   • Text centred, NOT left-aligned VN bar
 *   • No avatar ring — portrait row of 4 × 52 px busts at panel top
 *   • Active bust = full opacity; inactive = 0.35
 *   • Panel: paddingHorizontal 20, paddingBottom 12, gap 10
 *   • Portrait bottom flush with panel top (same as VNBar)
 */

const W = 390;
const H = 844;

// Estimated panel height (measured via onLayout in RN; ~240 px at mobile)
const PANEL_H   = 240;
const SAFE_TOP  = 44;  // approximate safe-area top inset
// Portrait bottom sits at panel top (+ safe-area bottom, approximated as 34 px here)
const SAFE_BOT  = 34;
const WRAP_BOT  = PANEL_H + SAFE_BOT;   // portrait bottom offset from screen bottom

const PORTRAIT_W = Math.round(W * 0.68); // 265 px  ← key difference from VNBar

const BG     = "/__mockup/images/prologue/tactical_battlefield.png";
const NIGHT  = "/__mockup/images/prologue/nightingale_vn_extended.png";
const PROD   = "/__mockup/images/prologue/prodigy_vn_extended.png";
const FLEM   = "/__mockup/images/prologue/fleming_vn_extended.png";
const MBAI   = "/__mockup/images/prologue/master_bai_vn_extended.png";

// artHeight formula: Math.round(W * 0.68 * imgH / imgW)
const MBAI_H  = Math.round(W * 0.68 * 1040 / 896); // 308 px
const NIGHT_H = H - WRAP_BOT;                        // cover → fill available space
const FLEM_H  = Math.round(W * 0.68 * 1203 / 896); // 356 px
const PROD_H  = Math.round(W * 0.68 * 1060 / 896); // 314 px

interface CharConfig {
  id:          string;
  label:       string;
  color:       string;
  art:         string;
  artH:        number;
  fit:         "cover" | "contain";
  avatar:      string;
  speakerName: string;
  sampleLine:  string;
  stageDir?:   string;
}

// All four characters: SPEAKER_ORDER = [MASTER_BAI, NIGHTINGALE, FLEMING, PRODIGY]
const ALL: CharConfig[] = [
  {
    id:          "MASTER_BAI",
    label:       "MASTER BAI",
    color:       "#D9A441",
    art:         MBAI,
    artH:        MBAI_H,
    fit:         "contain",
    avatar:      MBAI,
    speakerName: "MASTER BAI",
    sampleLine:  "Something is wrong with this field. The corruption pattern is not what it should be.",
    stageDir:    "The elder healer steps forward.",
  },
  {
    id:          "NIGHTINGALE",
    label:       "NIGHTINGALE",
    color:       "#E8C453",
    art:         NIGHT,
    artH:        NIGHT_H,
    fit:         "cover",
    avatar:      NIGHT,
    speakerName: "FLORENCE NIGHTINGALE",
    sampleLine:  "These injuries do not match the enemies in front of us. We are missing something important.",
  },
  {
    id:          "FLEMING",
    label:       "FLEMING",
    color:       "#3ECFB2",
    art:         FLEM,
    artH:        FLEM_H,
    fit:         "contain",
    avatar:      FLEM,
    speakerName: "SIR ALEXANDER FLEMING",
    sampleLine:  "This corruption is adapting. If we advance carelessly, we may strengthen what we are trying to eliminate.",
  },
  {
    id:          "PRODIGY",
    label:       "THE PRODIGY",
    color:       "#7EB8F7",
    art:         PROD,
    artH:        PROD_H,
    fit:         "contain",
    avatar:      PROD,
    speakerName: "THE PRODIGY",
    sampleLine:  "While we stand discussing possibilities, something is still spreading.",
    stageDir:    "The Prodigy steps forward, impatient.",
  },
];

// ── Annotation helpers ────────────────────────────────────────────────────────

function Ruler({
  label, value, color, direction = "h",
  style,
}: {
  label: string; value: number; color: string;
  direction?: "h" | "v";
  style?: React.CSSProperties;
}) {
  const isH = direction === "h";
  return (
    <div style={{
      position: "absolute", display: "flex",
      alignItems: "center", justifyContent: "center",
      ...style,
    }}>
      {/* line */}
      <div style={{
        position: "absolute",
        ...(isH
          ? { left: 0, right: 0, top: "50%", height: 1, borderTop: `1px dashed ${color}66` }
          : { top: 0, bottom: 0, left: "50%", width: 1, borderLeft: `1px dashed ${color}66` }),
      }} />
      {/* label */}
      <span style={{
        color: `${color}cc`, fontSize: 8, fontFamily: "monospace", fontWeight: 700,
        background: "rgba(4,8,18,0.9)", padding: "1px 4px", borderRadius: 3,
        letterSpacing: 0.5, position: "relative", whiteSpace: "nowrap",
      }}>
        {label} {value}px
      </span>
    </div>
  );
}

// ── Phone frame ───────────────────────────────────────────────────────────────

function Phone({ c }: { c: CharConfig }) {
  const AVATAR_SIZE = 52;
  const AVATAR_GAP  = 14;
  const ROW_W       = ALL.length * AVATAR_SIZE + (ALL.length - 1) * AVATAR_GAP;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%",
                      background: c.color, flexShrink: 0 }} />
        <p style={{ color: c.color, fontSize: 10, fontWeight: 800,
                    letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
          {c.label}
        </p>
      </div>

      {/* phone bezel */}
      <div style={{ position: "relative", width: W, height: H, flexShrink: 0,
                    borderRadius: 28, border: `2px solid ${c.color}44`,
                    overflow: "hidden", background: "#040A12" }}>

        {/* BG */}
        <img src={BG} style={{ position: "absolute", inset: 0, width: "100%",
                                height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom,rgba(0,0,0,.2) 0%,rgba(0,0,0,.05) 40%,rgba(4,10,18,.80) 100%)" }} />

        {/* 65% gradient panel (bottom) */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "65%",
                      background: "linear-gradient(to bottom,transparent 0%,rgba(4,10,18,0.6) 35%,rgba(4,10,18,0.92) 75%)" }} />

        {/* ── Active speaker portrait ── */}
        <div style={{ position: "absolute", right: 0, bottom: WRAP_BOT,
                      width: PORTRAIT_W, height: Math.min(c.artH, H - WRAP_BOT),
                      overflow: "hidden" }}>
          <img src={c.art} style={{ width: "100%", height: "100%",
                                     objectFit: c.fit, objectPosition: "top center" }} />
          {/* left-edge blend — 0→38% */}
          <div style={{ position: "absolute", inset: 0,
                        background: "linear-gradient(to right,rgba(4,10,18,0.88) 0%,rgba(4,10,18,0) 38%)" }} />
          {/* bottom feather — 32% */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "32%",
                        background: "linear-gradient(to bottom,transparent,rgba(4,10,18,0.96))" }} />
        </div>

        {/* ── Portrait annotations ── */}
        {/* dashed portrait box */}
        <div style={{ position: "absolute", right: 0, bottom: WRAP_BOT,
                      width: PORTRAIT_W, height: Math.min(c.artH, H - WRAP_BOT),
                      border: `1.5px dashed ${c.color}55`, pointerEvents: "none" }} />
        {/* portrait width label — top of portrait box */}
        <div style={{ position: "absolute", right: 0, bottom: WRAP_BOT + Math.min(c.artH, H - WRAP_BOT) + 5,
                      width: PORTRAIT_W }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{ color: `${c.color}aa`, fontSize: 8, fontFamily: "monospace",
                           fontWeight: 700, background: "rgba(4,8,18,0.88)",
                           padding: "1px 5px", borderRadius: 3, letterSpacing: 0.5 }}>
              W×68% = {PORTRAIT_W}px · {c.fit}
            </span>
          </div>
        </div>
        {/* portrait height annotation (left of portrait) */}
        <div style={{ position: "absolute", right: PORTRAIT_W + 2, bottom: WRAP_BOT,
                      height: Math.min(c.artH, H - WRAP_BOT),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRight: `1px dashed ${c.color}44` }}>
          <span style={{ color: `${c.color}88`, fontSize: 7, fontFamily: "monospace",
                         fontWeight: 700, writingMode: "vertical-rl",
                         transform: "rotate(180deg)", letterSpacing: 0.5,
                         background: "rgba(4,8,18,0.85)", padding: "2px 2px" }}>
            {Math.min(c.artH, H - WRAP_BOT)}px
          </span>
        </div>
        {/* left-edge blend stop marker */}
        <div style={{ position: "absolute", right: PORTRAIT_W - Math.round(PORTRAIT_W * 0.38),
                      bottom: WRAP_BOT, height: Math.min(c.artH, H - WRAP_BOT),
                      width: 1, borderLeft: `1px dotted ${c.color}33`, pointerEvents: "none" }}>
          <span style={{ position: "absolute", top: 8, left: 2, color: `${c.color}66`,
                         fontSize: 7, fontFamily: "monospace", whiteSpace: "nowrap" }}>
            38% blend
          </span>
        </div>

        {/* ── Top bar ── */}
        <div style={{ position: "absolute", top: SAFE_TOP, left: 0, right: 0,
                      paddingTop: 16, paddingLeft: 20, paddingRight: 20 }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700,
                      letterSpacing: 2.5, textAlign: "center", margin: 0 }}>
            EMERGENCY TREATMENT PLAZA  ·  NIGHT
          </p>
          <div style={{ height: 2, background: "rgba(255,255,255,0.10)",
                        borderRadius: 1, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "45%",
                          background: "rgba(255,255,255,0.40)" }} />
          </div>
        </div>

        {/* ── Dialogue panel ── */}
        <div style={{ position: "absolute", bottom: SAFE_BOT, left: 0, right: 0,
                      paddingLeft: 20, paddingRight: 20, paddingBottom: 12,
                      display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Portrait row — all 4 avatars */}
          <div style={{ display: "flex", justifyContent: "center", gap: AVATAR_GAP,
                        marginBottom: 4 }}>
            {ALL.map(ch => (
              <img key={ch.id} src={ch.avatar}
                   style={{ width: AVATAR_SIZE, height: AVATAR_SIZE,
                            borderRadius: AVATAR_SIZE / 2, objectFit: "cover",
                            opacity: ch.id === c.id ? 1 : 0.35,
                            outline: ch.id === c.id ? `2px solid ${c.color}` : "none" }} />
            ))}
          </div>

          {/* Stage direction */}
          {c.stageDir && (
            <p style={{ color: "rgba(180,200,220,0.55)", fontSize: 11, fontStyle: "italic",
                        textAlign: "center", lineHeight: "16px", letterSpacing: 0.3,
                        margin: 0 }}>
              {c.stageDir}
            </p>
          )}

          {/* Speaker name */}
          <p style={{ color: c.color, fontSize: 12, fontWeight: 800,
                      letterSpacing: 2.5, textAlign: "center", margin: 0 }}>
            {c.speakerName}
          </p>

          {/* Dialogue line */}
          <p style={{ color: "#EDF2F7", fontSize: 16, lineHeight: "26px",
                      textAlign: "center", fontWeight: 300, letterSpacing: 0.3,
                      margin: 0 }}>
            {c.sampleLine}
          </p>

          {/* Tap hint */}
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 10,
                      letterSpacing: 1.5, textAlign: "center",
                      marginTop: 4, margin: 0 }}>
            [ tap ]
          </p>
        </div>

        {/* ── Panel padding annotations ── */}
        {/* Left padding ruler */}
        <div style={{ position: "absolute", bottom: SAFE_BOT, left: 0,
                      width: 20, height: PANEL_H,
                      borderRight: `1px dashed ${c.color}44`,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: `${c.color}77`, fontSize: 7, fontFamily: "monospace",
                         writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: 700 }}>
            pad 20
          </span>
        </div>
        {/* Right padding ruler */}
        <div style={{ position: "absolute", bottom: SAFE_BOT, right: 0,
                      width: 20, height: PANEL_H,
                      borderLeft: `1px dashed ${c.color}44`,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: `${c.color}77`, fontSize: 7, fontFamily: "monospace",
                         writingMode: "vertical-rl", fontWeight: 700 }}>
            pad 20
          </span>
        </div>
        {/* Bottom padding ruler */}
        <div style={{ position: "absolute", bottom: SAFE_BOT, left: 20, right: 20,
                      height: 12, borderBottom: `1px dashed ${c.color}44`,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: `${c.color}77`, fontSize: 7, fontFamily: "monospace",
                         fontWeight: 700 }}>
            pb 12
          </span>
        </div>
        {/* Panel height bracket (left edge) */}
        <div style={{ position: "absolute", bottom: SAFE_BOT, left: 4,
                      height: PANEL_H,
                      borderTop: `1px solid ${c.color}44`,
                      borderBottom: `1px solid ${c.color}44`,
                      display: "flex", alignItems: "center" }}>
          <span style={{ color: `${c.color}66`, fontSize: 7, fontFamily: "monospace",
                         writingMode: "vertical-rl", transform: "rotate(180deg)",
                         fontWeight: 700, letterSpacing: 0.5 }}>
            panel ~{PANEL_H}px
          </span>
        </div>

        {/* Avatar row width bracket */}
        <div style={{ position: "absolute", bottom: SAFE_BOT + PANEL_H - 58,
                      left: (W - ROW_W) / 2, width: ROW_W,
                      borderTop: `1px dashed ${c.color}44`,
                      display: "flex", justifyContent: "center" }}>
          <span style={{ color: `${c.color}77`, fontSize: 7, fontFamily: "monospace",
                         marginTop: 2, fontWeight: 700 }}>
            {ALL.length}×{AVATAR_SIZE} + {ALL.length-1}×{AVATAR_GAP}gap = {ROW_W}px
          </span>
        </div>
      </div>

      {/* Key measurements below */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        {[
          `portrait: ${PORTRAIT_W}px wide (W×68%)  ·  ${Math.min(c.artH, H-WRAP_BOT)}px tall  ·  ${c.fit}`,
          `portrait bottom: ${WRAP_BOT}px  =  panel ${PANEL_H}  +  safe-bot ${SAFE_BOT}`,
          `left-edge blend: 0 → 38%  ·  bottom feather: 32%`,
        ].map(t => (
          <span key={t} style={{ color: "rgba(200,210,220,0.35)", fontSize: 9,
                                  fontFamily: "monospace", textAlign: "center" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TacticalWarningPositions() {
  return (
    <div style={{ minHeight: "100vh", background: "#080C14", display: "flex",
                  flexDirection: "column", alignItems: "center",
                  gap: 36, padding: "36px 48px" }}>

      {/* Title */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "#C8D6E8", fontSize: 12, fontWeight: 800,
                     letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>
          TacticalWarningScene — all four character portrait areas
        </h1>
        <p style={{ color: "rgba(200,210,220,0.35)", fontSize: 10,
                    marginTop: 6, fontFamily: "monospace" }}>
          Portrait: W×68% = 265px (vs VNBar's 74% = 289px) · centred text · portrait row of 4 · no avatar ring
        </p>
      </div>

      {/* Comparison callout */}
      <div style={{ display: "flex", gap: 40, padding: "10px 24px", borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)" }}>
        {[
          { label: "TacticalWarningScene", key: "portrait width", value: "W × 68% = 265px", color: "#7EB8F7" },
          { label: "PrologueVNBar",        key: "portrait width", value: "W × 74% = 289px", color: "#7EC8C8" },
          { label: "TacticalWarningScene", key: "panel padding H", value: "20px each side",   color: "#7EB8F7" },
          { label: "TacticalWarningScene", key: "portrait row",   value: "4 × 52px busts",   color: "#7EB8F7" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
            <span style={{ color: item.color, fontSize: 9, fontFamily: "monospace",
                           fontWeight: 700, letterSpacing: 1 }}>{item.label}</span>
            <span style={{ color: "rgba(200,210,220,0.4)", fontSize: 9,
                           fontFamily: "monospace" }}>{item.key}</span>
            <span style={{ color: "rgba(200,210,220,0.75)", fontSize: 10,
                           fontFamily: "monospace", fontWeight: 700 }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Four phones */}
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {ALL.map(c => <Phone key={c.id} c={c} />)}
      </div>
    </div>
  );
}
