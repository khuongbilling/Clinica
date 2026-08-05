import { useState, type ReactNode } from 'react';

const C = {
  ink: '#111722',
  inkSoft: '#263143',
  paper: '#F4F0E8',
  panel: '#FFF9EE',
  teal: '#167D78',
  tealDark: '#0D514F',
  coral: '#D9664A',
  gold: '#C8913D',
  muted: '#788092',
  line: '#D8D2C7',
};

const missions = [
  { title: 'First Ward Shift', detail: 'Simulation · 6 min', progress: 0.72, tone: C.teal, icon: '✚' },
  { title: 'Clinical Cue drill', detail: '3 questions remaining', progress: 0.35, tone: C.coral, icon: '◈' },
];

function Pill({ children, tone = C.teal }: { children: ReactNode; tone?: string }) {
  return <span style={{ color: tone, border: `1px solid ${tone}55`, background: `${tone}12`, borderRadius: 99, padding: '5px 9px', fontSize: 10, fontWeight: 800, letterSpacing: 0.7 }}>{children}</span>;
}

function MissionCard({ mission, onOpen }: { mission: typeof missions[number]; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={{ textAlign: 'left', width: '100%', background: C.panel, border: `1px solid ${C.line}`, borderRadius: 15, padding: 14, cursor: 'pointer', boxShadow: '0 5px 16px rgba(34,25,16,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: `${mission.tone}16`, color: mission.tone, display: 'grid', placeItems: 'center', fontSize: 19 }}>{mission.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: C.ink, fontSize: 13, fontWeight: 800 }}>{mission.title}</div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{mission.detail}</div>
        </div>
        <span style={{ color: C.inkSoft, fontSize: 19 }}>›</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14 }}>
        <div style={{ flex: 1, height: 6, background: '#E9E5DC', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${mission.progress * 100}%`, height: '100%', background: mission.tone, borderRadius: 99 }} /></div>
        <span style={{ color: mission.tone, fontSize: 10, fontWeight: 800 }}>{Math.round(mission.progress * 100)}%</span>
      </div>
    </button>
  );
}

export default function CommandDeck() {
  const [toast, setToast] = useState('');
  const [active, setActive] = useState('Home');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const nav = ['Home', 'Study', 'Shift', 'Heroes', 'Profile'];

  return (
    <div style={{ width: 390, height: 844, overflow: 'hidden', background: C.paper, color: C.ink, fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif', position: 'relative' }}>
      <div style={{ height: 9, background: C.teal }} />
      <header style={{ padding: '18px 18px 15px', background: C.paper, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.6, fontWeight: 800 }}>Grand Ward · Tuesday</div>
            <h1 style={{ margin: '5px 0 0', fontFamily: 'Georgia, serif', fontSize: 26, lineHeight: 1, color: C.ink }}>Good morning, Chen.</h1>
          </div>
          <button onClick={() => notify('Profile brief opened')} aria-label="Open profile" style={{ width: 43, height: 43, borderRadius: 15, background: C.ink, color: '#BDE7DD', border: 0, fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>DC</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 17 }}>
          <Pill>LV 3 · MEDIC</Pill><Pill tone={C.gold}>120 CROWNS</Pill><Pill tone={C.coral}>14 / 20 AP</Pill>
        </div>
      </header>

      <main style={{ padding: '17px 18px 78px', height: 670, overflowY: 'auto' }}>
        <section style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
          <div><div style={{ color: C.teal, fontSize: 10, fontWeight: 900, letterSpacing: 1.4 }}>TODAY'S BRIEF</div><h2 style={{ margin: '4px 0 0', fontFamily: 'Georgia, serif', fontSize: 22 }}>Your next best move</h2></div>
          <button onClick={() => notify('All missions marked for review')} style={{ border: 0, background: 'none', color: C.muted, fontSize: 11, cursor: 'pointer' }}>View all</button>
        </section>

        <div style={{ background: C.tealDark, color: C.paper, borderRadius: 17, padding: 17, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -24, top: -31, width: 130, height: 130, borderRadius: '50%', border: '1px solid #83D1C0', opacity: .35 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}><Pill tone="#A8E8D8">RECOMMENDED</Pill><span style={{ fontSize: 22, opacity: .75 }}>↗</span></div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, margin: '18px 0 5px' }}>Enter Ward Shift</h3>
          <p style={{ color: '#BDE7DD', fontSize: 12, lineHeight: 1.5, maxWidth: 250, margin: 0 }}>One focused simulation completes your daily objective and earns a care token.</p>
          <button onClick={() => notify('Ward Shift queued')} style={{ marginTop: 16, background: C.paper, color: C.tealDark, border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 900, fontSize: 11, letterSpacing: .8, cursor: 'pointer' }}>START SIMULATION  →</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 19 }}>In progress</h2><span style={{ color: C.muted, fontSize: 11 }}>2 missions</span></div>
        <div style={{ display: 'grid', gap: 9 }}>
          {missions.map((m) => <MissionCard key={m.title} mission={m} onOpen={() => notify(`${m.title} opened`)} />)}
        </div>

        <section style={{ marginTop: 20, background: '#E9E0D2', borderRadius: 15, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: C.gold, color: '#FFF5DF', display: 'grid', placeItems: 'center', fontSize: 19 }}>★</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 900 }}>Acute Step Warden</div><div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>River · Level 8 · 340 / 500 XP</div></div>
          <button onClick={() => notify('Hero roster opened')} style={{ border: 0, background: 'none', color: C.teal, fontWeight: 900, fontSize: 11, cursor: 'pointer' }}>ROSTER</button>
        </section>
      </main>

      {toast && <div style={{ position: 'absolute', left: 18, right: 18, bottom: 72, background: C.ink, color: C.paper, padding: '12px 14px', borderRadius: 11, fontSize: 12, fontWeight: 700, boxShadow: '0 8px 20px rgba(0,0,0,.2)' }}>{toast}</div>}
      <nav style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', background: C.panel, borderTop: `1px solid ${C.line}`, padding: '9px 6px 12px' }}>
        {nav.map((item, i) => <button key={item} onClick={() => { setActive(item); notify(`${item} section selected`); }} style={{ flex: 1, border: 0, background: 'none', color: active === item ? C.teal : C.muted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 900, letterSpacing: .4 }}><span style={{ fontSize: 17 }}>{['⌂', '▤', '⚔', '♟', '◉'][i]}</span>{item.toUpperCase()}</button>)}
      </nav>
    </div>
  );
}