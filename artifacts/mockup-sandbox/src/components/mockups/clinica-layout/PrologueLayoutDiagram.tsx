export function PrologueLayoutDiagram() {
  const W = 390, H = 844;
  const insets = 34;

  const scenes = [
    { label: "FormerSelfIntro\nWarningDialogue\nFormerSelfVictory\nSilentInfarction", barH: 200, portraitW: 0.74, note: "74% width scenes" },
    { label: "TacticalWarning\nScene", barH: 240, portraitW: 0.68, note: "68% width scene\n(barH measured)" },
  ];

  const SCALE = 0.58;
  const PW = W * SCALE;
  const PH = H * SCALE;
  const FRAME = 12;

  const colors = {
    bg: "#0b1120",
    scene: "#1a2744",
    portrait: "#2a3d6e",
    portraitBorder: "#4a7fc1",
    bar: "#1e3a2a",
    barBorder: "#3ecf8e",
    barLeft: "#2a4a35",
    label: "#e2e8f0",
    dim: "#94a3b8",
    accent: "#f59e0b",
    frame: "#334155",
  };

  return (
    <div style={{ background: "#080f1e", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 40, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.9 }}>
        Prologue VN — Portrait Layout Areas
      </div>
      <div style={{ color: colors.dim, fontSize: 12, marginTop: -28 }}>
        iPhone reference: W=390px, H=844px, insets.bottom=34px
      </div>

      <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
        {scenes.map((scene, i) => {
          const barTotal = scene.barH + insets;
          const pW = Math.round(W * scene.portraitW);
          const artH_prodigy = Math.round(pW * 1280 / 896);
          const artH_bai = Math.round(pW * 1040 / 896);
          const finalH_prodigy = Math.min(artH_prodigy, H - barTotal);
          const finalH_bai = Math.min(artH_bai, H - barTotal);

          const scaledBar = barTotal * SCALE;
          const scaledPortraitW = pW * SCALE;
          const scaledPortraitH = finalH_prodigy * SCALE;

          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              {/* Scene label */}
              <div style={{ color: colors.accent, fontSize: 12, fontWeight: 700, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.5 }}>
                {scene.note}
              </div>

              <div style={{ position: "relative" }}>
                {/* Phone frame */}
                <div style={{
                  width: PW + FRAME * 2,
                  height: PH + FRAME * 2,
                  background: colors.frame,
                  borderRadius: 24,
                  padding: FRAME,
                  boxShadow: "0 0 0 2px #475569, 0 8px 32px rgba(0,0,0,0.6)",
                  position: "relative",
                }}>
                  {/* Screen */}
                  <div style={{ width: PW, height: PH, position: "relative", overflow: "hidden", borderRadius: 12, background: colors.scene }}>

                    {/* ① Scene background label */}
                    <div style={{
                      position: "absolute", top: 10, left: 10,
                      color: "#7dd3fc", fontSize: 9, fontWeight: 600,
                    }}>
                      ① Scene BG (full W × H)
                    </div>

                    {/* ② Portrait box */}
                    <div style={{
                      position: "absolute",
                      right: 0,
                      bottom: scaledBar,
                      width: scaledPortraitW,
                      height: scaledPortraitH,
                      background: colors.portrait,
                      border: `1.5px dashed ${colors.portraitBorder}`,
                      borderBottom: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                    }}>
                      <div style={{ color: colors.portraitBorder, fontSize: 9, fontWeight: 700 }}>② Portrait</div>
                      <div style={{ color: "#93c5fd", fontSize: 8 }}>{Math.round(scene.portraitW * 100)}% W × {finalH_prodigy}px</div>
                      <div style={{ color: colors.dim, fontSize: 7 }}>({pW} × {finalH_prodigy})</div>
                      <div style={{ color: "#64748b", fontSize: 7, marginTop: 2 }}>Bai: {finalH_bai}px tall</div>
                    </div>

                    {/* Left exposed bg strip */}
                    <div style={{
                      position: "absolute",
                      left: 0,
                      bottom: scaledBar,
                      width: PW - scaledPortraitW,
                      height: scaledPortraitH,
                      background: "rgba(255,255,255,0.03)",
                      borderRight: "1px dashed #334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <div style={{ color: "#475569", fontSize: 7, textAlign: "center", writing: "vertical" }}>
                        BG visible<br />{Math.round(W * (1 - scene.portraitW))}px
                      </div>
                    </div>

                    {/* ③ Bar: text side (left 26%/32%) */}
                    <div style={{
                      position: "absolute",
                      left: 0,
                      bottom: 0,
                      width: PW - scaledPortraitW,
                      height: scaledBar,
                      background: colors.barLeft,
                      border: `1px dashed ${colors.barBorder}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}>
                      <div style={{ color: colors.barBorder, fontSize: 8, fontWeight: 700 }}>③ Text zone</div>
                      <div style={{ color: "#6ee7b7", fontSize: 7 }}>name + dialogue</div>
                    </div>

                    {/* ③ Bar: right side under portrait */}
                    <div style={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      width: scaledPortraitW,
                      height: scaledBar,
                      background: colors.bar,
                      border: `1px dashed ${colors.barBorder}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}>
                      <div style={{ color: colors.barBorder, fontSize: 8, fontWeight: 700 }}>③ Bar</div>
                      <div style={{ color: "#6ee7b7", fontSize: 7 }}>{scene.barH}+{insets}={barTotal}px</div>
                    </div>

                  </div>
                </div>

                {/* Dimension callouts — right side */}
                <div style={{ position: "absolute", right: -(80), top: 0, height: PH + FRAME * 2, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: FRAME }}>
                  {/* Portrait height bracket */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: scaledBar - 1, height: scaledPortraitH }}>
                    <div style={{ width: 1, height: "100%", background: "#4a7fc1" }} />
                    <div style={{ color: "#93c5fd", fontSize: 9, whiteSpace: "nowrap" }}>{finalH_prodigy}px</div>
                  </div>
                  {/* Bar bracket */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, height: scaledBar }}>
                    <div style={{ width: 1, height: "100%", background: "#3ecf8e" }} />
                    <div style={{ color: "#6ee7b7", fontSize: 9, whiteSpace: "nowrap" }}>{barTotal}px</div>
                  </div>
                </div>
              </div>

              {/* Dimension table */}
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", fontSize: 10, color: colors.dim, display: "grid", gridTemplateColumns: "auto auto", gap: "3px 12px", minWidth: 200 }}>
                <span style={{ color: "#7dd3fc" }}>① BG</span><span>full {W} × {H}px</span>
                <span style={{ color: colors.portraitBorder }}>② Portrait W</span><span>{pW}px ({Math.round(scene.portraitW * 100)}% of W)</span>
                <span style={{ color: colors.portraitBorder }}>② Prodigy/Flem H</span><span>{finalH_prodigy}px</span>
                <span style={{ color: colors.portraitBorder }}>② Master Bai H</span><span>{finalH_bai}px</span>
                <span style={{ color: colors.barBorder }}>③ Bar height</span><span>{scene.barH} + {insets} = {barTotal}px</span>
                <span style={{ color: "#f59e0b" }}>Left text zone</span><span>{W - pW}px wide</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
        {[
          { color: "#7dd3fc", label: "① Scene Background" },
          { color: "#4a7fc1", label: "② Portrait box (right-anchored)" },
          { color: "#3ecf8e", label: "③ Dialogue bar (full width)" },
          { color: "#f59e0b", label: "Left 26/32% — text only" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
            <span style={{ color: colors.dim, fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
