/**
 * TokenSwatch — smoke-test component for the Clinica DS token foundation.
 *
 * Renders a visual grid of every colour token, font samples, shadow utilities,
 * radius tokens, and motion values so the palette is verifiable on the canvas.
 *
 * Preview at: /__mockup/src/ds/clinica-ds/#/TokenSwatch
 */

import { COLORS, RADIUS_SM, RADIUS_MD, RADIUS_LG, RADIUS_XL, RADIUS_PILL,
         DURATION_FAST, DURATION_BASE, DURATION_SLOW, DURATION_SCENE } from '@workspace/clinica-ds/tokens';

const colourMeta: { name: string; key: Extract<keyof typeof COLORS, string>; usage: string }[] = [
  { name: 'background',      key: 'background',     usage: 'Page / app background' },
  { name: 'panel',           key: 'panel',          usage: 'Default card surface' },
  { name: 'panel-raised',    key: 'panelRaised',    usage: 'Elevated surface, modals' },
  { name: 'panel-objective', key: 'panelObjective', usage: 'Objective / highlight panels' },
  { name: 'jade',            key: 'jade',           usage: 'Primary interactive colour' },
  { name: 'teal-bright',     key: 'tealBright',     usage: 'Bright accent / glow source' },
  { name: 'gold-antique',    key: 'goldAntique',    usage: 'Default gold, borders, dividers' },
  { name: 'gold-bright',     key: 'goldBright',     usage: 'Highlighted gold, active state' },
  { name: 'ivory',           key: 'ivory',          usage: 'Primary text' },
  { name: 'muted',           key: 'muted',          usage: 'Secondary / placeholder text' },
];

const radii: { label: string; value: number }[] = [
  { label: 'radius-sm (6px)',   value: RADIUS_SM },
  { label: 'radius-md (12px)',  value: RADIUS_MD },
  { label: 'radius-lg (18px)',  value: RADIUS_LG },
  { label: 'radius-xl (24px)',  value: RADIUS_XL },
  { label: 'radius-pill (999px)', value: RADIUS_PILL },
];

const durations: { label: string; ms: number }[] = [
  { label: 'fast',  ms: DURATION_FAST },
  { label: 'base',  ms: DURATION_BASE },
  { label: 'slow',  ms: DURATION_SLOW },
  { label: 'scene', ms: DURATION_SCENE },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-cinzel text-gold-bright text-xl uppercase tracking-widest mb-4 border-b border-gold-antique pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function TokenSwatch() {
  return (
    <div
      className="min-h-screen p-8"
      style={{ backgroundColor: COLORS.background, fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
    >
      <header className="mb-10">
        <h1 className="font-display text-ivory text-4xl mb-1">Clinica Design System</h1>
        <p className="text-muted text-base">Token Foundation · Visual smoke-test</p>
      </header>

      {/* Colour palette */}
      <Section title="Colour Tokens">
        <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {colourMeta.map(({ name, key, usage }) => {
            const hex = COLORS[key];
            const isDark = ['background', 'panel', 'panelRaised', 'panelObjective'].includes(key);
            return (
              <div
                key={name}
                className="shadow-panel border-gold"
                style={{
                  backgroundColor: COLORS.panel,
                  borderRadius: RADIUS_MD,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    backgroundColor: hex,
                    height: 64,
                    border: isDark ? '1px solid rgba(199,161,93,0.3)' : 'none',
                  }}
                />
                <div className="p-3">
                  <p className="text-ivory font-semibold text-sm">--color-{name}</p>
                  <p className="text-muted text-xs mt-0.5">{hex}</p>
                  <p className="text-muted text-xs mt-1 opacity-70">{usage}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div className="space-y-6">
          <div className="border-gold p-5 shadow-panel" style={{ backgroundColor: COLORS.panel, borderRadius: RADIUS_LG }}>
            <p className="text-muted text-xs uppercase tracking-widest mb-2">font-display (Marcellus)</p>
            <p className="font-display text-ivory text-4xl">The Kingdom of Healing</p>
            <p className="font-display text-gold-bright text-2xl mt-1">Clinica: Chapter One</p>
          </div>
          <div className="border-gold p-5 shadow-panel" style={{ backgroundColor: COLORS.panel, borderRadius: RADIUS_LG }}>
            <p className="text-muted text-xs uppercase tracking-widest mb-2">font-ui (Source Sans 3)</p>
            <p className="font-ui text-ivory text-base leading-relaxed">
              Clinical assessment reveals elevated biomarkers consistent with systemic inflammatory response.
              Initiate stabilisation protocol and monitor corruption levels every 4 hours.
            </p>
            <p className="font-ui text-muted text-sm mt-2">Secondary label · 14 px · muted</p>
          </div>
          <div className="border-gold p-5 shadow-panel" style={{ backgroundColor: COLORS.panel, borderRadius: RADIUS_LG }}>
            <p className="text-muted text-xs uppercase tracking-widest mb-2">font-cinzel (Cinzel — headings only)</p>
            <p className="font-cinzel text-gold-antique text-2xl tracking-wider uppercase">Chapter III</p>
            <p className="font-cinzel text-jade text-lg tracking-wider uppercase mt-1">The Verdant Corruption</p>
          </div>
        </div>
      </Section>

      {/* Shadows */}
      <Section title="Shadows &amp; Glows">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {[
            { label: 'shadow-teal',    cls: 'shadow-teal' },
            { label: 'shadow-gold',    cls: 'shadow-gold' },
            { label: 'shadow-ambient', cls: 'shadow-ambient' },
            { label: 'shadow-panel',   cls: 'shadow-panel' },
          ].map(({ label, cls }) => (
            <div
              key={label}
              className={`border-gold p-4 flex items-center justify-center ${cls}`}
              style={{ backgroundColor: COLORS.panelRaised, borderRadius: RADIUS_MD, minHeight: 80 }}
            >
              <span className="text-ivory text-sm font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Radius */}
      <Section title="Radius Tokens">
        <div className="flex flex-wrap gap-4">
          {radii.map(({ label, value }) => (
            <div
              key={label}
              className="border-gold-bright flex items-center justify-center"
              style={{
                backgroundColor: COLORS.panelRaised,
                borderRadius: Math.min(value, 36),
                width: 120,
                height: 64,
                border: `1px solid ${COLORS.goldBright}`,
              }}
            >
              <span className="text-ivory text-xs text-center px-2">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Motion */}
      <Section title="Motion Tokens">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {durations.map(({ label, ms }) => (
            <div
              key={label}
              className="border-gold p-4"
              style={{ backgroundColor: COLORS.panel, borderRadius: RADIUS_MD }}
            >
              <p className="text-jade font-semibold text-base">--duration-{label}</p>
              <p className="text-gold-bright text-2xl font-display mt-1">{ms}ms</p>
            </div>
          ))}
        </div>
      </Section>

      {/* State utilities */}
      <Section title="State Utilities">
        <div className="flex flex-wrap gap-4">
          <div
            className="nav-active shadow-teal flex items-center justify-center px-6 py-3"
            style={{ backgroundColor: COLORS.panelRaised, borderRadius: RADIUS_MD }}
          >
            <span className="font-semibold">nav-active</span>
          </div>
          <div
            className="nav-inactive flex items-center justify-center px-6 py-3"
            style={{ backgroundColor: COLORS.panelRaised, borderRadius: RADIUS_MD, color: COLORS.muted }}
          >
            <span className="font-semibold">nav-inactive</span>
          </div>
          <div
            className="disabled-state flex items-center justify-center px-6 py-3 border-gold"
            style={{ backgroundColor: COLORS.panelRaised, borderRadius: RADIUS_MD, color: COLORS.ivory }}
          >
            <span className="font-semibold">disabled-state</span>
          </div>
          <div
            className="focus-ring flex items-center justify-center px-6 py-3"
            style={{ backgroundColor: COLORS.panelRaised, borderRadius: RADIUS_MD, color: COLORS.ivory }}
          >
            <span className="font-semibold">focus-ring</span>
          </div>
        </div>
      </Section>

      {/* Border utilities */}
      <Section title="Border Utilities">
        <div className="flex flex-wrap gap-4">
          {[
            { cls: 'border-gold',        label: 'border-gold', desc: 'Default panel border' },
            { cls: 'border-gold-bright', label: 'border-gold-bright', desc: 'Active / focused' },
            { cls: 'border-jade',        label: 'border-jade', desc: 'Selected / confirmed' },
          ].map(({ cls, label, desc }) => (
            <div
              key={label}
              className={`${cls} px-6 py-4`}
              style={{ backgroundColor: COLORS.panel, borderRadius: RADIUS_MD, minWidth: 160 }}
            >
              <p className="text-ivory font-semibold text-sm">{label}</p>
              <p className="text-muted text-xs mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
