export function PrologueLayoutDiagram() {
  const W = 390, H = 844;
  const insets = 34;
  const barH = 200;
  const barTotal = barH + insets; // 234
  const portW = Math.round(W * 0.74); // 289

  // Actual PNG dimensions
  const chars = [
    {
      name: "Prodigy",
      file: "/__mockup/images/prologue/prodigy_vn_extended.png",
      imgW: 896, imgH: 1280,
      contentFit: "contain",
      topTransPx: 145, botTransPx: 220,
      color: "#7EB8F7",
    },
    {
      name: "Fleming",
      file: "/__mockup/images/prologue/fleming_vn_extended.png",
      imgW: 896, imgH: 1280,
      contentFit: "contain",
      topTransPx: 108, botTransPx: 77,
      color: "#3ECFB2",
    },
    {
      name: "Master Bai",
      file: "/__mockup/images/prologue/master_bai_vn_extended.png",
      imgW: 896, imgH: 1040,
      contentFit: "contain",
      topTransPx: 73, botTransPx: 0,
      color: "#D9A441",
    },
    {
      name: "Nightingale",
      file: "/__mockup/images/prologue/nightingale_vn_extended.png",
      imgW: 2048, imgH: 2048,
      contentFit: "cover",
      topTransPx: 73, botTransPx: 25,
      color: "#F9A8D4",
    },
  ];

  const PHONE_SCALE = 0.48;
  const PW = Math.round(portW * PHONE_SCALE); // portrait area width scaled
  const portraitW_px = portW; // 289

  return (
    <div style={{
      background: "#080f1e",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "28px 20px 40px",
      gap: 24,
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Portrait Area — Image Position & Transparent Padding
      </div>
      <div style={{ color: "#64748b", fontSize: 11, marginTop: -16, textAlign: "center" }}>
        74% width scenes · W=390 · portW=289px · barTotal=234px · contentPosition defaults to CENTER
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end" }}>
        {chars.map((c) => {
          // Compute portrait box height
          let boxH_px: number;
          let coverCropX = 0;
          if (c.contentFit === "contain") {
            boxH_px = Math.round(portraitW_px * c.imgH / c.imgW);
          } else {
            // cover: box is full available height
            boxH_px = H - barTotal; // 610
            const scaleH = boxH_px / c.imgH;
            const scaledW = Math.round(c.imgW * scaleH);
            coverCropX = Math.round((scaledW - portraitW_px) / 2);
          }

          // Scaled transparent padding in the box
          const scale = (c.contentFit === "contain")
            ? portraitW_px / c.imgW
            : boxH_px / c.imgH;

          const topTrans = Math.round(c.topTransPx * scale);
          const botTrans = Math.round(c.botTransPx * scale);
          const contentH = boxH_px - topTrans - botTrans;

          // Gap: feet are this many px above the box bottom
          const gapFromBar = botTrans;

          // Display scale
          const DS = PHONE_SCALE;
          const boxH_disp = Math.round(boxH_px * DS);
          const topTrans_disp = Math.round(topTrans * DS);
          const botTrans_disp = Math.round(botTrans * DS);
          const contentH_disp = Math.round(contentH * DS);
          const PW_disp = Math.round(portraitW_px * DS);

          return (
            <div key={c.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              {/* Character name */}
              <div style={{ color: c.color, fontSize: 12, fontWeight: 700 }}>{c.name}</div>
              <div style={{ color: "#475569", fontSize: 9 }}>{c.file}</div>
              <div style={{ color: "#64748b", fontSize: 9 }}>{c.imgW}×{c.imgH} · {c.contentFit}</div>

              {/* Portrait box visualization */}
              <div style={{ position: "relative" }}>
                {/* Box outline */}
                <div style={{
                  width: PW_disp,
                  height: boxH_disp,
                  border: `2px dashed ${c.color}66`,
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                  background: "transparent",
                }}>
                  {/* Actual character image — no tint, no overlay */}
                  <img
                    src={c.file}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: c.contentFit as "contain" | "cover",
                      objectPosition: "top center",
                    }}
                  />

                  {/* Top transparent zone label only */}
                  {topTrans_disp > 0 && (
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0,
                      height: topTrans_disp,
                      borderBottom: `1px dashed ${c.color}44`,
                      pointerEvents: "none",
                    }}>
                      <div style={{ color: `${c.color}99`, fontSize: 7, padding: "1px 3px",
                                    background: "rgba(0,0,0,0.55)", display: "inline-block" }}>
                        {topTrans}px transparent
                      </div>
                    </div>
                  )}

                  {/* Bottom transparent zone label only */}
                  {botTrans_disp > 0 && (
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      height: botTrans_disp,
                      borderTop: `1px dashed #dc262688`,
                      pointerEvents: "none",
                    }}>
                      <div style={{ color: "#dc2626", fontSize: 7, padding: "1px 3px",
                                    background: "rgba(0,0,0,0.55)", display: "inline-block" }}>
                        {botTrans}px gap ⚠
                      </div>
                    </div>
                  )}
                </div>

                {/* BAR label below box */}
                <div style={{
                  width: PW_disp,
                  height: 20,
                  background: "#1e3a2a",
                  border: "1px solid #3ecf8e",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 0,
                  borderRadius: "0 0 4px 4px",
                }}>
                  <span style={{ color: "#3ecf8e", fontSize: 8 }}>DIALOGUE BAR</span>
                </div>

                {/* Bracket on right: gap annotation */}
                {botTrans_disp > 0 && (
                  <div style={{
                    position: "absolute",
                    right: -(52),
                    bottom: 20 + botTrans_disp / 2 - 8,
                    color: "#dc2626",
                    fontSize: 9,
                    whiteSpace: "nowrap",
                  }}>
                    ←{gapFromBar}px gap
                  </div>
                )}
              </div>

              {/* Stats table */}
              <div style={{
                background: "#0f172a",
                border: `1px solid ${c.color}33`,
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 9,
                display: "grid",
                gridTemplateColumns: "auto auto",
                gap: "2px 10px",
                width: PW_disp + 20,
              }}>
                <span style={{ color: "#64748b" }}>Box</span>
                <span style={{ color: "#e2e8f0" }}>{portraitW_px} × {boxH_px}px</span>
                <span style={{ color: "#64748b" }}>Top pad</span>
                <span style={{ color: topTrans > 0 ? "#94a3b8" : "#22c55e" }}>{topTrans}px</span>
                <span style={{ color: "#64748b" }}>Content H</span>
                <span style={{ color: c.color }}>{contentH}px</span>
                <span style={{ color: "#64748b" }}>Bot pad</span>
                <span style={{ color: botTrans > 0 ? "#dc2626" : "#22c55e" }}>
                  {botTrans}px {botTrans > 0 ? "⚠ gap from bar" : "✓ flush"}
                </span>
                {c.contentFit === "cover" && (
                  <>
                    <span style={{ color: "#64748b" }}>H-crop each side</span>
                    <span style={{ color: "#e2e8f0" }}>{coverCropX}px</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{
        background: "#0f172a",
        border: "1px solid #1e3a5f",
        borderRadius: 8,
        padding: "12px 18px",
        maxWidth: 700,
        fontSize: 10,
        color: "#94a3b8",
        lineHeight: 1.7,
      }}>
        <div style={{ color: "#f1f5f9", fontWeight: 700, marginBottom: 6, fontSize: 11 }}>Current state — feet-to-bar gap</div>
        <div><span style={{ color: "#7EB8F7" }}>Prodigy</span> — <span style={{ color: "#dc2626" }}>71px gap</span> between feet and bar. artPos:"bottom" defined in config but <b>not passed to ExpoImage</b>. Bottom 220px of the 1280px PNG is transparent.</div>
        <div style={{ marginTop: 4 }}><span style={{ color: "#3ECFB2" }}>Fleming</span> — <span style={{ color: "#f97316" }}>25px gap</span>. Bottom 77px of PNG is transparent.</div>
        <div style={{ marginTop: 4 }}><span style={{ color: "#D9A441" }}>Master Bai</span> — <span style={{ color: "#22c55e" }}>0px gap ✓</span>. No transparent pixels at PNG bottom.</div>
        <div style={{ marginTop: 4 }}><span style={{ color: "#F9A8D4" }}>Nightingale</span> — <span style={{ color: "#22c55e" }}>7px gap</span> (cover mode, mostly fine). Horizontal crop: 160px each side.</div>
        <div style={{ marginTop: 8, color: "#64748b" }}>Fix: pass <code style={{ color: "#a78bfa" }}>contentPosition="bottom"</code> to ExpoImage for contain chars — but since box ratio ≈ image ratio the image fills the box fully, so transparent padding in the PNG cannot be removed this way. The bottom pad must be cropped by reducing artHeight to exclude it.</div>
      </div>
    </div>
  );
}
