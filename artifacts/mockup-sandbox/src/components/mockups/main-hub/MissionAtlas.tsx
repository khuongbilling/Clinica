import { useState } from 'react';

const C = {
  bg: '#0a121b',
  panel: '#122231',
  panel2: '#172c3c',
  ink: '#f7f2e7',
  muted: '#9aabb4',
  jade: '#59d7ba',
  gold: '#e8c768',
  cyan: '#7ecff0',
  line: 'rgba(228,239,231,.12)',
};

const IMG = {
  bg: '/__mockup/images/home_hub_bg.png',
  hero: '/__mockup/images/hero-sprite.png',
  stamina: '/__mockup/images/icon-stamina.png',
  crowns: '/__mockup/images/icon-crowns.png',
  rounds: '/__mockup/images/emblem-daily-rounds.png',
  journey: '/__mockup/images/emblem-journey.png',
  goals: '/__mockup/images/emblem-milestones.png',
  recruit: '/__mockup/images/emblem-summoning.png',
  defense: '/__mockup/images/emblem-ward-defense.png',
};

type Mission = { id: string; time: string; title: string; detail: string; tone: string; reward: string; done?: boolean };

const missions: Mission[] = [
  { id: 'rounds', time: '08:00', title: 'Daily rounds', detail: 'Review 3 clinical cues in the atrium', tone: C.gold, reward: '+18 XP' },
  { id: 'shift', time: '10:30', title: 'Ward Shift', detail: 'Run the patient-safety simulation', tone: C.jade, reward: '+32 XP', done: true },
  { id: 'study', time: '14:00', title: 'Study interval', detail: 'Complete one lesson at Clinica University', tone: C.cyan, reward: '+12 XP' },
  { id: 'recruit', time: '18:00', title: 'Recruitment Hall', detail: 'Check the summon board for a new ally', tone: '#d9a8e7', reward: '1 draw' },
];

function StatPill({ image, value, label, color }: { image: string; value: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 9px', border: `1px solid ${color}38`, background: `${C.panel}dd`, borderRadius: 20 }}>
      <img src={image} style={{ width: 15, height: 15, objectFit: 'contain' }} />
      <span style={{ color, fontSize: 11, fontWeight: 800 }}>{value}</span>
      <span style={{ color: C.muted, fontSize: 9, letterSpacing: .5 }}>{label}</span>
    </div>
  );
}

function MissionCard({ mission, selected, onSelect }: { mission: Mission; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} style={{
      width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '47px 1fr auto', gap: 10,
      alignItems: 'center', padding: '12px 10px', color: C.ink, background: selected ? `${mission.tone}12` : 'transparent',
      border: `1px solid ${selected ? `${mission.tone}66` : C.line}`, borderRadius: 13, cursor: 'pointer', transition: 'transform .18s ease, opacity .18s ease',
    }}>
      <div style={{ position: 'relative', color: mission.done ? C.jade : C.muted, fontSize: 10, fontWeight: 800 }}>
        <span>{mission.time}</span>
        <div style={{ position: 'absolute', right: -13, top: 5, width: 6, height: 6, borderRadius: 6, background: mission.done ? C.jade : mission.tone, boxShadow: `0 0 0 3px ${C.bg}` }} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{mission.title}</span>
          {mission.done && <span style={{ fontSize: 9, color: C.jade, letterSpacing: .5 }}>COMPLETE</span>}
        </div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 3, lineHeight: 1.35 }}>{mission.detail}</div>
      </div>
      <span style={{ color: mission.tone, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{mission.reward}</span>
    </button>
  );
}

export default function MissionAtlas() {
  const [selected, setSelected] = useState('shift');
  const [activeTab, setActiveTab] = useState('PLAN');
  const selectedMission = missions.find((m) => m.id === selected) || missions[1];
  const tabs = ['PLAN', 'HERO', 'WARD'];

  return (
    <main style={{ width: 390, height: 844, overflow: 'hidden', position: 'relative', color: C.ink, background: C.bg, fontFamily: '"DM Sans", ui-sans-serif, system-ui' }}>
      <img src={IMG.bg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .24 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,15,23,.3), #0a121bf4 73%)' }} />
      <section style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '12px 15px 10px', borderBottom: `1px solid ${C.line}`, background: 'rgba(8,18,27,.84)', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: C.muted, fontSize: 9, fontWeight: 800, letterSpacing: 1.8 }}>THURSDAY · DAY 18</div>
              <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: -.6, marginTop: 3 }}>Your care plan</div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <StatPill image={IMG.stamina} value="14" label="AP" color={C.jade} />
              <StatPill image={IMG.crowns} value="120" label="CROWNS" color={C.gold} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 13 }}>
            {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1px solid ${activeTab === tab ? `${C.jade}75` : C.line}`, background: activeTab === tab ? `${C.jade}18` : 'transparent', color: activeTab === tab ? C.jade : C.muted, fontSize: 9, fontWeight: 900, letterSpacing: 1, cursor: 'pointer' }}>{tab}</button>)}
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'hidden', padding: '15px 15px 10px' }}>
          {activeTab === 'PLAN' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 10 }}>
                <div>
                  <div style={{ color: C.jade, fontSize: 10, fontWeight: 900, letterSpacing: 1.4 }}>TODAY'S ROUTE</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>One focused day in the Grand Ward</div>
                </div>
                <span style={{ color: C.gold, fontSize: 11, fontWeight: 900 }}>1 / 4 complete</span>
              </div>
              <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,.09)', marginBottom: 14 }}>
                <div style={{ width: '29%', height: '100%', borderRadius: 5, background: C.jade }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `1px solid ${C.line}`, paddingLeft: 8 }}>
                {missions.map((mission) => <MissionCard key={mission.id} mission={mission} selected={selected === mission.id} onSelect={() => setSelected(mission.id)} />)}
              </div>
              <div style={{ marginTop: 13, padding: 13, border: `1px solid ${selectedMission.tone}55`, background: `${selectedMission.tone}0d`, borderRadius: 14 }}>
                <div style={{ color: selectedMission.tone, fontSize: 9, fontWeight: 900, letterSpacing: 1.2 }}>NEXT UP · {selectedMission.time}</div>
                <div style={{ fontSize: 16, fontWeight: 900, marginTop: 5 }}>{selectedMission.title}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{selectedMission.detail}</div>
                <button onClick={() => setSelected(selectedMission.id)} style={{ width: '100%', marginTop: 11, padding: 10, border: 0, borderRadius: 9, background: selectedMission.tone, color: '#08131a', fontSize: 11, fontWeight: 900, letterSpacing: .8, cursor: 'pointer' }}>{selectedMission.done ? 'REVIEW COMPLETED SHIFT' : 'START MISSION'} <span style={{ marginLeft: 5 }}>→</span></button>
              </div>
            </>
          ) : activeTab === 'HERO' ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: C.jade, fontSize: 10, fontWeight: 900, letterSpacing: 1.4 }}>ACTIVE COMPANION</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>A focused view for the next encounter</div>
              </div>
              <div style={{ flex: 1, position: 'relative', margin: '0 -4px' }}><img src={IMG.hero} alt="Acute Step Warden" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }} /><div style={{ position: 'absolute', bottom: 18, left: 15, right: 15, padding: 13, background: `${C.panel}e8`, border: `1px solid ${C.jade}55`, borderRadius: 14 }}><div style={{ color: C.jade, fontSize: 9, fontWeight: 900, letterSpacing: 1.2 }}>RIVER · LEVEL 8</div><div style={{ fontSize: 17, fontWeight: 900, marginTop: 3 }}>Acute Step Warden</div><div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>Physiotherapist · 3 star resonance</div></div></div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
              <div style={{ textAlign: 'center', color: C.jade, fontSize: 10, fontWeight: 900, letterSpacing: 1.4 }}>WARD STATUS</div>
              <div style={{ padding: 18, background: C.panel, border: `1px solid ${C.jade}55`, borderRadius: 16, textAlign: 'center' }}><img src={IMG.defense} alt="" style={{ width: 92, height: 110, objectFit: 'contain' }} /><div style={{ fontSize: 19, fontWeight: 900 }}>Ward Defense</div><div style={{ color: C.muted, fontSize: 11, marginTop: 5 }}>The next simulation is ready when you are.</div><button onClick={() => setActiveTab('PLAN')} style={{ marginTop: 15, padding: '10px 20px', borderRadius: 9, border: 0, background: C.jade, color: '#08131a', fontWeight: 900, cursor: 'pointer' }}>VIEW ROUTE</button></div>
            </div>
          )}
        </div>

        <nav style={{ display: 'flex', padding: '8px 8px 11px', borderTop: `1px solid ${C.line}`, background: '#0b1824f2', backdropFilter: 'blur(10px)' }}>
          {['HOME', 'STUDY', 'SHIFT', 'HEROES', 'PROFILE'].map((item) => <button key={item} onClick={() => item === 'HOME' && setActiveTab('PLAN')} style={{ flex: 1, border: 0, background: 'transparent', color: item === 'HOME' ? C.jade : C.muted, fontSize: 9, fontWeight: 900, letterSpacing: .6, cursor: 'pointer', padding: '5px 0' }}><span style={{ display: 'block', fontSize: 15, marginBottom: 3 }}>{item === 'HOME' ? '◆' : item === 'SHIFT' ? '＋' : item === 'HEROES' ? '◉' : item === 'STUDY' ? '▤' : '○'}</span>{item}</button>)}
        </nav>
      </section>
    </main>
  );
}