import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CapacitanceLab from './CapacitanceLab';
import RCLab from './RCLab';
import DielectricLab from './DielectricLab';
import { Icon } from './ui';
import './styles.css';
function App() {
  const [tab, setTab] = useState(0);
  const names = ['Capacitance', 'RC Circuits', 'Dielectrics'];
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="./" aria-label="Capacitor Lab home"><span className="brand-symbol"><Icon name="capacitor" size={27} /></span><span>PHYSICS<span className="brand-light"> / LAB</span><small>SEE IT. CHANGE IT. UNDERSTAND IT.</small></span></a><div className="semester"><span className="status-dot" />SEMESTER 2 <span className="syllabus">SP025</span></div></header>
    <main><div className="chapter-intro"><div><span className="eyebrow">THE INTERACTIVE LEARNING LABORATORY</span><h1>Small components.<br className="mobile-break" /> <span>Remarkable physics.</span></h1><p>Chapter 02 <span className="dot-separator">/</span> Capacitors and dielectrics</p></div><div className="chapter-mark" aria-hidden="true">02<span>CAPACITORS<br />& DIELECTRICS</span></div></div>
      <nav className="chapter-nav" aria-label="Chapter subtopics" role="tablist">{names.map((name, i) => <button id={`tab-${i}`} role="tab" type="button" aria-selected={tab === i} aria-controls={`panel-${i}`} tabIndex={tab === i ? 0 : -1} key={name} onClick={() => setTab(i)} onKeyDown={e => { let next = tab; if (e.key === 'ArrowRight') next = (tab + 1) % 3; else if (e.key === 'ArrowLeft') next = (tab + 2) % 3; else if (e.key === 'Home') next = 0; else if (e.key === 'End') next = 2; else return; e.preventDefault(); setTab(next); document.getElementById(`tab-${next}`)?.focus(); }}><span className="tab-number">2.{i + 1}</span>{name}<Icon name="arrow" size={17} /></button>)}</nav>
      <div id="panel-0" role="tabpanel" aria-labelledby="tab-0" hidden={tab !== 0}><CapacitanceLab /></div>
      <div id="panel-1" role="tabpanel" aria-labelledby="tab-1" hidden={tab !== 1}><RCLab active={tab === 1} /></div>
      <div id="panel-2" role="tabpanel" aria-labelledby="tab-2" hidden={tab !== 2}><DielectricLab /></div>
    </main><footer><span><Icon name="capacitor" size={17} /> Built for curiosity. Grounded in physics.</span><span>Semester 2 · SP025 · Chapter 02</span></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
