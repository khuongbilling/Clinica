/**
 * SIRevealPositions — SilentInfarctionRevealScene layout across its dialogue stages
 *
 * Stage 1 · REACT (Nightingale) — right portrait + normal VN bar
 * Stage 2 · REACT (Fleming)     — right portrait + normal VN bar (contain fit)
 * Stage 3 · SI SPEAK            — no right portrait; SI centred; monologue bar
 * Stage 4 · LOADOUT (Master Bai)— right portrait + normal VN bar (contain fit)
 */

const W = 390;
const H = 844;
const BAR_H = 200;
const PORTRAIT_W = Math.round(W * 0.74);

const NIGHT_H    = H - BAR_H;
const FLEMING_H  = Math.round(W * 0.74 * (1203 / 896));
const MBAI_H     = Math.round(W * 0.74 * (1040 / 896));

const BG    = "/__mockup/images/prologue/ward_corridor_battle.png";
const NIGHT = "/__mockup/images/prologue/nightingale_vn_extended.png";
const FLEM  = "/__mockup/images/prologue/fleming_vn_extended.png";
const SI    = "/__mockup/images/prologue/silent_infarction_nobg.png";
const MBAI  = "/__mockup/images/prologue/master_bai_nobg.png";

interface StageConfig {
  stageLabel:   string;
  stageColor:   string;
  description:  string;
  portrait:     string | null;
  portraitH:    number;
  portraitFit:  "cover" | "contain";
  siCentre?:    boolean;
  redOverlay?:  number;
  barAccent:    string;
  barBg:        string;
  avatar:       string;
  avatarFit:    "cover" | "contain";
  speakerName:  string;
  speakerColor: string;
  dialogueLine: string;
  isMonologue?: boolean;
}

const STAGES: StageConfig[] = [
  {
    stageLabel:   "1 · REACT",
    stageColor:   "#7EC8C8",
    description:  "Nightingale reacts\nshowPortrait=true · textVariant='normal'\nartFit: cover",
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
    stageLabel:   "2 · REACT",
    stageColor:   "#8AB87A",
    description:  "Fleming reacts\nshowPortrait=true · textVariant='normal'\nartFit: contain",
    portrait:     FLEM,
    portraitH:    FLEMING_H,
    portraitFit:  "contain",
    barAccent:    "#8AB87A",
    barBg:        "rgba(4,14,8,0.97)",
    avatar:       FLEM,
    avatarFit:    "contain",
    speakerName:  "ALEXANDER\nFLEMING",
    speakerColor: "#8AB87A",
    dialogueLine: "The visible creatures are not the source!",
  },
  {
    stageLabel:   "3 · SI SPEAK",
    stageColor:   "#8B1A1A",
    description:  "showPortrait=false · textVariant='monologue'\nSI centred in scene JSX · no arrow",
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
    stageLabel:   "4 · LOADOUT",
    stageColor:   "#A07840",
    description:  "Master Bai — loadout dialogue\nshowPortrait=true · textVariant='normal'\nartFit: contain",
    portrait:     MBAI,
    portraitH:    MBAI_H,
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

function Phone({ s }: { s: StageConfig }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%",
                      background: s.stageColor, flexShrink: 0 }} />
        <p style={{ color: s.stageColor, fontSize: 10, fontWeight: 800,
                    letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
          {s.stageLabel}
        </p>
      </div>

      <div style={{ position: "relative", width: W, height: H, flexShrink: 0,
                    borderRadius: 28, border: `2px solid ${s.stageColor}44`,
                    overflow: "hidden", background: "#040810" }}>

        <img src={BG} style={{ position: "absolute", inset: 0, width: "100%",
                                height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom,rgba(0,0,0,.22) 0%,rgba(0,0,0,.06) 45%,rgba(4,8,18,.82) 100%)" }} />

        {s.redOverlay && (
          <div style={{ position: "absolute", inset: 0,
                        background: "#6B0000", opacity: s.redOverlay }} />
        )}

        {/* Right portrait */}
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
            {/* dashed annotation */}
            <div style={{ position: "absolute", right: 0, bottom: BAR_H,
                          width: PORTRAIT_W, height: s.portraitH,
                          border: `1.5px dashed ${s.stageColor}55`, pointerEvents: "none" }} />
            {/* height label */}
            <div style={{ position: "absolute", right: PORTRAIT_W + 3, bottom: BAR_H,
                          height: s.portraitH, display: "flex", alignItems: "center" }}>
              <span style={{ color: `${s.stageColor}88`, fontSize: 8, fontFamily: "monospace",
                             fontWeight: 700, writingMode: "vertical-rl",
                             transform: "rotate(180deg)" }}>
                {s.portraitH}px · {s.portraitFit}
              </span>
            </div>
          </>
        )}

        {/* SI centred presence */}
        {s.siCentre && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: BAR_H + 20,
                        display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            <div style={{ position: "absolute", bottom: 30, width: 320, height: 320,
                          borderRadius: "50%",
                          background: "radial-gradient(circle,rgba(160,0,0,0.45) 0%,transparent 70%)" }} />
            <img src={SI} style={{ width: 300, height: 430, objectFit: "contain",
                                    position: "relative", zIndex: 2 }} />
            <div style={{ position: "absolute", bottom: 435, left: "50%",
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

        {/* Dialogue bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BAR_H,
                      background: s.barBg, borderTop: `1.5px solid ${s.barAccent}55` }}>
          <div style={{ height: 2, background: s.barAccent, opacity: 0.8 }} />
          <div style={{ display: "flex", alignItems: "center",
                        padding: "10px 14px 0", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                          gap: 5, flexShrink: 0, width: 88 }}>
              <div style={{ width: 88, height: 88, borderRadius: 44,
                            border: `3px solid ${s.speakerColor}`, overflow: "hidden" }}>
                <img src={s.avatar} style={{ width: "100%", height: "100%",
                                              objectFit: s.avatarFit }} />
              </div>
              <span style={{ color: s.speakerColor, fontSize: 9, fontWeight: 800,
                             letterSpacing: 1.2, textAlign: "center",
                             textTransform: "uppercase", lineHeight: "13px",
                             whiteSpace: "pre-line" }}>{s.speakerName}</span>
            </div>
            <div style={{ flex: 1 }}>
              {s.isMonologue ? (
                <p style={{ color: "rgba(255,210,210,0.9)", fontSize: 14, fontStyle: "italic",
                            fontWeight: 300, lineHeight: "22px", letterSpacing: 0.5, margin: 0 }}>
                  {s.dialogueLine}
                </p>
              ) : (
                <p style={{ color: "#E8EEF6", fontSize: 14, lineHeight: "22px", margin: 0 }}>
                  {s.dialogueLine}
                  <span style={{ color: s.speakerColor }}>▌</span>
                </p>
              )}
            </div>
            {!s.isMonologue && (
              <span style={{ color: s.speakerColor, fontSize: 20,
                             alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 }}>▾</span>
            )}
          </div>
        </div>

        {!s.portrait && (
          <div style={{ position: "absolute", right: 8, bottom: BAR_H + 8 }}>
            <span style={{ color: "rgba(220,80,80,0.65)", fontSize: 9, fontFamily: "monospace",
                           fontWeight: 700, background: "rgba(15,2,2,0.82)",
                           padding: "2px 6px", borderRadius: 3 }}>showPortrait=false</span>
          </div>
        )}
      </div>

      <p style={{ color: "rgba(200,210,220,0.4)", fontSize: 10, fontFamily: "monospace",
                  textAlign: "center", lineHeight: "16px", margin: 0,
                  whiteSpace: "pre-line" }}>{s.description}</p>
    </div>
  );
}

export function SIRevealPositions() {
  return (
    <div style={{ minHeight: "100vh", background: "#080C14", display: "flex",
                  flexDirection: "column", alignItems: "center",
                  gap: 32, padding: "36px 48px" }}>

      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "#C8D6E8", fontSize: 12, fontWeight: 800,
                     letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>
          SilentInfarctionRevealScene — dialogue stages
        </h1>
        <p style={{ color: "rgba(200,210,220,0.35)", fontSize: 10,
                    marginTop: 6, fontFamily: "monospace" }}>
          react (×2) → si_speak → loadout · showPortrait + textVariant + artFit
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                    justifyContent: "center" }}>
        {STAGES.map((s, i) => (
          <div key={s.stageLabel} style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {STAGES.map(s => <Phone key={s.stageLabel + s.stageColor} s={s} />)}
      </div>
    </div>
  );
}
