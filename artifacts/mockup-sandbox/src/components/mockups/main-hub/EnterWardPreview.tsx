// EnterWardPreview — standalone mockup showing all three states of the
// new ornate jade EnterWardButton: default, disabled, and loading.
// Uses only Tailwind classes and inline styles (no RN imports).

const C = {
  bg:          '#07141D',
  jade:        '#3DC4A8',
  jadeBright:  '#7DE6D6',
  jadeDeep:    '#2C9E88',
  gold:        '#E8C868',
  goldDim:     'rgba(232,200,104,0.30)',
  navy:        '#082019',
  ivoryDim:    '#C8BFAD',
  muted:       '#9DA8AA',
  panel:       '#0B1C25',
};

const F = {
  ui:      '"Source Sans 3","Inter",-apple-system,sans-serif',
  display: '"Marcellus","Cinzel",Georgia,serif',
};

// ── Inline medalion SVG (medical cross) ──────────────────────────────────────
function MedallionIcon() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 14,
      background: C.jade,
      border: `1px solid rgba(255,255,255,0.25)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {/* Inline medical cross */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <rect x="10" y="3"  width="4" height="18" rx="1.5" fill={C.navy}/>
        <rect x="3"  y="10" width="18" height="4"  rx="1.5" fill={C.navy}/>
      </svg>
    </div>
  );
}

// ── Corner flourish helper ────────────────────────────────────────────────────
function Flourish({ pos }: { pos: 'tl'|'tr'|'bl'|'br' }) {
  const base: React.CSSProperties = {
    position: 'absolute', width: 6, height: 6,
    borderColor: C.gold, borderStyle: 'solid',
    borderTopWidth:    pos==='tl'||pos==='tr' ? 1 : 0,
    borderBottomWidth: pos==='bl'||pos==='br' ? 1 : 0,
    borderLeftWidth:   pos==='tl'||pos==='bl' ? 1 : 0,
    borderRightWidth:  pos==='tr'||pos==='br' ? 1 : 0,
    top:    pos==='tl'||pos==='tr' ? 6    : undefined,
    bottom: pos==='bl'||pos==='br' ? 6    : undefined,
    left:   pos==='tl'||pos==='bl' ? 14   : undefined,
    right:  pos==='tr'||pos==='br' ? 14   : undefined,
  };
  return <div style={base} />;
}

// ── Single button card ────────────────────────────────────────────────────────
function StateCard({
  stateLabel,
  disabled = false,
  loading = false,
}: {
  stateLabel: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const opacity = disabled ? 0.45 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 260 }}>
      {/* State label */}
      <div style={{
        fontFamily: F.display, fontSize: 10, letterSpacing: 1.4,
        color: C.muted, textAlign: 'center', textTransform: 'uppercase',
      }}>
        {stateLabel}
      </div>

      {/* Button shell */}
      <div style={{
        opacity,
        borderRadius: 999,
        boxShadow: `0 0 18px rgba(79,216,196,0.34), 0 4px 10px rgba(0,0,0,0.4)`,
        position: 'relative',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}>
        <div style={{
          background: `linear-gradient(to right, ${C.jadeBright}, ${C.jade}, ${C.jadeDeep})`,
          borderRadius: 999,
          border: `1.5px solid ${C.gold}`,
          minHeight: 54,
          display: 'flex', alignItems: 'center',
          paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12,
          gap: 8,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Corner flourishes */}
          <Flourish pos="tl" />
          <Flourish pos="tr" />
          <Flourish pos="bl" />
          <Flourish pos="br" />

          {/* Left medallion */}
          <MedallionIcon />

          {/* Label / loader */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              {/* Spinner approximation */}
              <div style={{
                width: 18, height: 18, borderRadius: 9,
                border: `2px solid rgba(8,32,25,0.25)`,
                borderTopColor: C.navy,
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : (
            <span style={{
              flex: 1, textAlign: 'center',
              color: C.navy, fontSize: 16, fontWeight: 800,
              letterSpacing: 0.8, fontFamily: F.ui,
            }}>
              ENTER THE WARD
            </span>
          )}

          {/* Right arrow */}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M13 6l6 6-6 6" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          {/* Shimmer (default state only) */}
          {!disabled && !loading && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: 60,
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.28), transparent)',
              borderRadius: 999,
              // Static shimmer position for mockup — live component animates this
              left: '35%',
              pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Root preview ──────────────────────────────────────────────────────────────
export default function EnterWardPreview() {
  return (
    <div style={{
      background: C.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
      padding: 40,
      fontFamily: F.ui,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontFamily: F.display, fontSize: 10, color: C.gold, letterSpacing: 2, marginBottom: 6 }}>
          COMPONENT PREVIEW
        </div>
        <div style={{ fontFamily: F.display, fontSize: 22, color: '#F0E7D5', letterSpacing: 0.5 }}>
          Enter the Ward Button
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Ink & Mist jade treatment — all three interaction states
        </div>
      </div>

      {/* All three states */}
      <StateCard stateLabel="Default"  />
      <StateCard stateLabel="Disabled" disabled />
      <StateCard stateLabel="Loading"  loading />

      {/* Design notes */}
      <div style={{
        marginTop: 16,
        background: C.panel,
        borderRadius: 12,
        border: `1px solid rgba(232,200,104,0.18)`,
        padding: '14px 20px',
        maxWidth: 300,
        fontSize: 11,
        color: C.muted,
        lineHeight: 1.7,
        fontFamily: F.ui,
      }}>
        <strong style={{ color: C.gold, letterSpacing: 0.5 }}>SPEC NOTES</strong><br/>
        • Mint → jade → deep gradient (L→R)<br/>
        • Gold 1.5px border + subtle corner flourishes<br/>
        • Circular jade medallion left, arrow right<br/>
        • Label optically centred via flex:1<br/>
        • Shimmer loops on 2.4 s, paused when disabled<br/>
        • Pressed: scale 0.98 spring · Disabled: opacity 0.45
      </div>

      {/* Spinner keyframe (works in browser preview) */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
