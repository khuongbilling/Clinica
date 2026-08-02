/**
 * SIRevealPositions — SilentInfarctionRevealScene layout across its three dialogue stages
 *
 * Stage 1 · REACT    — hero reacts (Nightingale), right portrait + normal VN bar
 * Stage 2 · SI SPEAK — no right portrait; SI centred at 65% height;
 *                       bar in monologue mode (italic, pinkish, no arrow)
 * Stage 3 · LOADOUT  — back to hero dialogue (Master Bai), right portrait + normal VN bar
 */

const W = 390;
const H = 844;
const BAR_H = 200;
const PORTRAIT_W = Math.round(W * 0.74); // 289px

// Nightingale portrait height (cover — fills the column)
const NIGHT_H = H - BAR_H; // 644

// Master Bai: contain — use same formula: W * 0.74 * (img_h / img_w)
// master_bai_nobg is roughly square-ish; treat as 1040/896 like other heroes
const MASTER_BAI_H = Math.round(W * 0.74 * (1040 / 896)); // ~337

const BG    = "/__mockup/images/prologue/ward_corridor_battle.png";
const NIGHT = "/__mockup/images/prologue/nightingale_vn_extended.png";
const SI    = "/__mockup/images/prologue/silent_infarction_nobg.png";
const MBAI  = "/__mockup/images/prologue/master_bai_nobg.png";

// ── Stage configs ─────────────────────────────────────────────────────────────

interface StageConfig {
  stageLabel:    string;
  stageColor:    string;
  description:   string;

  // right portrait (null = hidden during si_speak)
  portrait:      string | null;
  portraitH:     number;
  portraitFit:   "cover" | "contain";

  // centre SI presence (only during si_speak)
  siCentre?:     boolean;

  // bar
  barAccent:     string;
  barBg:         string;
  avatar:        string;
  avatarFit:     "cover" | "contain";
  speakerName:   string;
  speakerColor:  string;
  dialogueLine:  string;
  isMonologue?:  boolean;  // italic pinkish, no arrow
  redOverlay?:   number;   // 0–1 red tint
}

const STAGES: StageConfig[] = [
  {
    stageLabel:   "1 · REACT",
    stageColor:   "#7EC8C8",
    description:  "Hero reacts — right portrait + normal VN bar\nshowPortrait=true · textVariant='normal'",
    portrait:     NIGHT,
    portraitH:    NIGHT_H,
    portraitFit:  "cover",
    barAccent:    "#7EC8C8",
    barBg:        "rgba(6,18,28,0.97)",
    avatar:       NIGHT,
    avatarFit:    "cover",
    speakerName:  "FLORENCE\nNIGHTINGALE",
    speakerColor: "#7EC8C8",
    dialogueLine: "Their condition is deteriorating!",
  },
  {
    stageLabel:   "2 · SI SPEAK",
    stageColor:   "#8B1A1A",
    description:  "SI monologue — no right portrait; SI centred;\nbar: textVariant='monologue', no arrow\nshowPortrait=false",
    portrait:     null,
    portraitH:    0,
    portraitFit:  "contain",
    siCentre:     true,
    redOverlay:   0.45,
    barAccent:    "#8B1A1A",
    barBg:        "rgba(15,2,2,0.97)",
    avatar:       SI,
    avatarFit:    "contain",
    speakerName:  "THE SILENT\nINFARCTION",
    speakerColor: "#8B1A1A",
    dialogueLine: "The strongest healers are often the easiest to deceive.",
    isMonologue:  true,
  },
  {
    stageLabel:   "3 · LOADOUT",
    stageColor:   "#A07840",
    description:  "Back to hero dialogue — right portrait + normal bar\nshowPortrait=true · textVariant='normal'",
    portrait:     MBAI,
    portraitH:    MASTER_BAI_H,
    portraitFit:  "contain",
    barAccent:    "#A07840",
    barBg:        "rgba(14,10,4,0.97)",
    avatar:       MBAI,
    avatarFit:    "contain",
    speakerName:  "MASTER\nBAI",
    speakerColor: "#A07840",
    dialogueLine: "A capable team exists to challenge your judgment.",
  },
];

// ── Phone frame ───────────────────────────────────────────────────────────────

function Phone({ s }: { s: StageConfig }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* stage badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%",
                      background: s.stageColor, flexShrink: 0 }} />
        <p style={{ color: s.stageColor, fontSize: 11, fontWeight: 800,
                    letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
          {s.stageLabel}
        </p>
      </div>

      {/* phone */}
      <div style={{ position: "relative", width: W, height: H, flexShrink: 0,
                    borderRadius: 28, border: `2px solid ${s.stageColor}44`,
                    overflow: "hidden", background: "#040810" }}>

        {/* bg */}
        <img src={BG} style={{ position: "absolute", inset: 0, width: "100%",
                                height: "100%", objectFit: "cover" }} />

        {/* bg overlay */}
        <div style={{ position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom,rgba(0,0,0,.22) 0%,rgba(0,0,0,.06) 45%,rgba(4,8,18,.82) 100%)" }} />

        {/* red tint for SI stage */}
        {s.redOverlay && (
          <div style={{ position: "absolute", inset: 0,
                        background: "#6B0000", opacity: s.redOverlay }} />
        )}

        {/* ── Right portrait (hidden during si_speak) ── */}
        {s.portrait && (
          <>
            <div style={{ position: "absolute", right: 0, bottom: BAR_H,
                          width: PORTRAIT_W, height: s.portraitH, overflow: "hidden" }}>
              <img src={s.portrait}
                   style={{ width: "100%", height: "100%",
                            objectFit: s.portraitFit, objectPosition: "top center" }} />
              <div style={{ position: "absolute", inset: 0,
                            background: "linear-gradient(to right,rgba(4,8,18,.82) 0%,rgba(4,8,18,0) 38%)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "32%",
                            background: "linear-gradient(to bottom,transparent,rgba(4,8,18,.96))" }} />
            </div>
            {/* annotation outline */}
            <div style={{ position: "absolute", right: 0, bottom: BAR_H,
                          width: PORTRAIT_W, height: s.portraitH,
                          border: `1.5px dashed ${s.stageColor}55`, pointerEvents: "none" }} />
          </>
        )}

        {/* ── SI centred presence ── */}
        {s.siCentre && (
          <div style={{ position: "absolute", left: 0, right: 0,
                        bottom: BAR_H + 20,
                        display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            {/* crimson glow behind SI */}
            <div style={{ position: "absolute", bottom: 30, width: 320, height: 320,
                          borderRadius: "50%",
                          background: "radial-gradient(circle,rgba(160,0,0,0.45) 0%,transparent 70%)" }} />
            <img src={SI}
                 style={{ width: 300, height: 430, objectFit: "contain",
                          position: "relative", zIndex: 2 }} />
            {/* annotation: "centred, not PrologueVNBar portrait" */}
            <div style={{ position: "absolute", bottom: 430 + 10, left: "50%",
                          transform: "translateX(-50%)" }}>
              <span style={{ color: "rgba(220,80,80,0.75)", fontSize: 9,
                             fontFamily: "monospace", fontWeight: 700, letterSpacing: 0.8,
                             background: "rgba(15,2,2,0.85)", padding: "2px 6px",
                             borderRadius: 3, whiteSpace: "nowrap" }}>
                scene JSX · not PrologueVNBar
              </span>
            </div>
          </div>
        )}

        {/* ── Dialogue bar ── */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BAR_H,
                      background: s.barBg, borderTop: `1.5px solid ${s.barAccent}55` }}>
          <div style={{ height: 2, background: s.barAccent, opacity: 0.8 }} />
          <div style={{ display: "flex", alignItems: "center",
                        padding: "10px 14px 0", gap: 12 }}>
            {/* avatar + name */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                          gap: 5, flexShrink: 0, width: 88 }}>
              <div style={{ width: 88, height: 88, borderRadius: 44,
                            border: `3px solid ${s.speakerColor}`, overflow: "hidden" }}>
                <img src={s.avatar}
                     style={{ width: "100%", height: "100%", objectFit: s.avatarFit }} />
              </div>
              <span style={{ color: s.speakerColor, fontSize: 9, fontWeight: 800,
                             letterSpacing: 1.2, textAlign: "center",
                             textTransform: "uppercase", lineHeight: "13px",
                             whiteSpace: "pre-line" }}>{s.speakerName}</span>
            </div>

            {/* text */}
            <div style={{ flex: 1 }}>
              {s.isMonologue ? (
                <p style={{ color: "rgba(255,210,210,0.9)", fontSize: 14,
                            fontStyle: "italic", fontWeight: 300,
                            lineHeight: "22px", letterSpacing: 0.5, margin: 0 }}>
                  {s.dialogueLine}
                </p>
              ) : (
                <p style={{ color: "#E8EEF6", fontSize: 14,
                            lineHeight: "22px", margin: 0 }}>
                  {s.dialogueLine}
                  <span style={{ color: s.speakerColor }}>▌</span>
                </p>
              )}
            </div>

            {/* arrow — hidden for monologue */}
            {!s.isMonologue && (
              <span style={{ color: s.speakerColor, fontSize: 20,
                             alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 }}>▾</span>
            )}
          </div>
        </div>

        {/* ── "no portrait" label for SI stage ── */}
        {!s.portrait && (
          <div style={{ position: "absolute", right: 8, bottom: BAR_H + 8 }}>
            <span style={{ color: "rgba(220,80,80,0.65)", fontSize: 9,
                           fontFamily: "monospace", fontWeight: 700,
                           background: "rgba(15,2,2,0.82)", padding: "2px 6px",
                           borderRadius: 3 }}>showPortrait=false</span>
          </div>
        )}
      </div>

      {/* description below */}
      <p style={{ color: "rgba(200,210,220,0.4)", fontSize: 10, fontFamily: "monospace",
                  textAlign: "center", lineHeight: "16px", margin: 0,
                  whiteSpace: "pre-line" }}>{s.description}</p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function SIRevealPositions() {
  return (
    <div style={{ minHeight: "100vh", background: "#080C14", display: "flex",
                  flexDirection: "column", alignItems: "center",
                  gap: 36, padding: "36px 48px" }}>

      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "#C8D6E8", fontSize: 12, fontWeight: 800,
                     letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>
          SilentInfarctionRevealScene — three dialogue stages
        </h1>
        <p style={{ color: "rgba(200,210,220,0.35)", fontSize: 10,
                    marginTop: 6, fontFamily: "monospace" }}>
          react → si_speak → loadout · PrologueVNBar showPortrait + textVariant props
        </p>
      </div>

      {/* flow arrow row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {STAGES.map((s, i) => (
          <div key={s.stageLabel} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: "4px 12px", borderRadius: 20,
                          border: `1.5px solid ${s.stageColor}66`,
                          background: `${s.stageColor}11` }}>
              <span style={{ color: s.stageColor, fontSize: 10, fontWeight: 700,
                             letterSpacing: 1.5 }}>{s.stageLabel}</span>
            </div>
            {i < STAGES.length - 1 && (
              <span style={{ color: "rgba(200,210,220,0.25)", fontSize: 14 }}>→</span>
            )}
          </div>
        ))}
      </div>

      {/* Three phones */}
      <div style={{ display: "flex", gap: 56, alignItems: "flex-start" }}>
        {STAGES.map(s => <Phone key={s.stageLabel} s={s} />)}
      </div>
    </div>
  );
}
