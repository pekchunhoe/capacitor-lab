import { useEffect, useId, useRef, useState } from 'react';
import { format, sampleRC, timeConstant, transition, type RCParameters, type Segment } from './physics';
import { Challenges, Prediction, VirtualExperiment, modeItems, type Mode, type Reading } from './learning';
import { Choices, EquationLesson, Experiment, Field, Icon, RCCircuit, RCGraphs, Readings } from './ui';
import { DisplayMath, InlineMath, MathText, mathNumber, quantity } from './math';
import { equations as eq } from './equations';
import { currentPhase } from './currentMotion';

const initial: RCParameters = { r: 1e4, c: 100e-6, source: 12 };
function TimeConstantPanel({ tau, concealed }: { tau: number; concealed: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const explanationId = useId();
  const tex = String.raw`\tau=RC=${concealed ? '?' : `${mathNumber(tau)}\\,\\mathrm{s}`}`;
  return <section className="time-constant" aria-label="Time constant">
    <button type="button" className="time-constant-toggle" aria-label={`Time Constant: ${concealed ? 'unknown' : `${Number(tau.toPrecision(3))} s`}`} aria-expanded={expanded} aria-controls={explanationId} onClick={() => setExpanded(value => !value)}>
      <span className="time-constant-title">Time Constant</span><InlineMath tex={tex} />
      <svg className="time-constant-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg>
    </button>
    <div id={explanationId} className="time-constant-explanation" hidden={!expanded}>
      <span className="eyebrow">THE CIRCUIT’S NATURAL TIMESCALE</span><DisplayMath tex={tex} />
      <p>The time constant determines how quickly a capacitor charges or discharges. A larger resistance or capacitance slows the process.</p>
      <ul><li>At one time constant, an initially uncharged capacitor reaches approximately <b>63.2%</b> of its final charge.</li><li>During discharging, approximately <b>36.8%</b> of the initial charge remains after one time constant.</li><li>After five time constants, approximately <b>99.3%</b> of the charging change is complete.</li></ul>
    </div>
  </section>;
}
export default function RCLab({ active }: { active: boolean }) {
  const [p, setP] = useState(initial), [mode, setMode] = useState<Mode>('explore');
  const [segments, setSegments] = useState<Segment[]>([{ start: 0, initial: 0, target: 12 }]), [time, setTime] = useState(0), [running, setRunning] = useState(false), [speed, setSpeed] = useState('1');
  const [readings, setReadings] = useState<Reading[]>([]), [revealed, setRevealed] = useState(false), [notice, setNotice] = useState(''), [trialId, setTrialId] = useState(0);
  const lastFrame = useRef<number | null>(null);
  const tau = timeConstant(p.r, p.c), s = sampleRC(p, segments, time), charging = segments[segments.length - 1].target !== 0, virtual = mode === 'experiment';
  const trialEnd = segments[segments.length - 1].start + 8 * tau;
  useEffect(() => { if (!active) setRunning(false); }, [active]);
  useEffect(() => {
    if (!running || !active) return;
    let raf = 0; lastFrame.current = null; let accumulated = 0;
    const visible = () => { lastFrame.current = null; accumulated = 0; };
    const tick = (stamp: number) => {
      if (document.hidden) { lastFrame.current = null; raf = requestAnimationFrame(tick); return; }
      if (lastFrame.current !== null) accumulated += Math.min((stamp - lastFrame.current) / 1000, .1) * Number(speed);
      lastFrame.current = stamp;
      // Cap UI commits at 30 Hz; analytical values remain independent of frame rate.
      if (accumulated >= Number(speed) / 30) { const dt = accumulated; accumulated = 0; setTime(t => Math.min(t + dt, trialEnd)); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); document.addEventListener('visibilitychange', visible);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visible); lastFrame.current = null; };
  }, [running, active, speed, trialEnd]);
  useEffect(() => { if (time >= trialEnd) setRunning(false); }, [time, trialEnd]);
  const restart = (next = p) => { setRunning(false); setTime(0); setSegments([{ start: 0, initial: 0, target: next.source }]); setReadings([]); setRevealed(false); setTrialId(id => id + 1); lastFrame.current = null; };
  const change = (next: RCParameters) => { setP(next); restart(next); setNotice('Parameter changed: a new discharged trial is ready. Press Charge to start.'); };
  const switchCircuit = (nextCharging: boolean) => {
    if (segments.length >= 200) { setNotice('The 200-switch trial limit is reached. Reset to start a new trial.'); return; }
    if (nextCharging !== charging) setSegments(transition(p, segments, time, nextCharging));
    setNotice(nextCharging ? 'Charging toward the source voltage from the voltage actually present.' : 'Battery removed from the discharge loop. Charge and voltage are continuous; current reverses.');
    setRunning(true);
  };
  const changeMode = (next: Mode) => { if (next === 'experiment' || virtual) { const nextP = { ...initial, c: next === 'experiment' ? 120e-6 : initial.c }; setP(nextP); restart(nextP); setNotice('New trial ready. Select resistance, then press Charge.'); } setMode(next); };
  return <>
    <div className="lab-heading"><div><span className="eyebrow">FOLLOW THE TRANSIENT</span><h2>The RC circuit laboratory</h2><p>Charging and discharging of capacitors</p></div><button className="reset-button" onClick={() => { const next = { ...initial, c: virtual ? 120e-6 : initial.c }; setP(next); restart(next); setSpeed('1'); setNotice('Reset to an initially uncharged capacitor.'); }}><Icon name="reset" size={17} />Reset tab</button></div>
    <Choices label="Learning mode" value={mode} items={modeItems} onChange={changeMode} />
    <div className="lab-grid rc-lab-grid"><div className="lab-main"><Experiment title={virtual ? 'A capacitance waiting to be measured' : 'Watch a circuit find its balance'} subtitle={virtual ? 'Use voltage readings and the stopwatch to discover the unknown C.' : 'A resistor sets the pace. A capacitor remembers its charge.'} badge={running ? `SIMULATION RUNNING · ${speed}×` : 'SIMULATION PAUSED · EXACT RC MODEL'}>
      <RCCircuit p={p} v={s.v} i={s.i} charging={charging} running={running} time={time} phase={currentPhase(p, segments, time)} hiddenC={virtual && !revealed} />
      <div className="rc-actions"><button className={charging ? 'primary' : ''} onClick={() => switchCircuit(true)}><Icon name="spark" size={16} />Charge</button><button className={!charging ? 'primary' : ''} onClick={() => switchCircuit(false)}>Discharge</button><button onClick={() => setRunning(!running)} disabled={time >= trialEnd}><Icon name={running ? 'pause' : 'play'} size={16} />{running ? 'Pause' : 'Resume'}</button><button onClick={() => { restart(); setNotice(String.raw`Circuit reset: $Q=0$ and $V_C=0$ at $t=0$.`); }}><Icon name="reset" size={16} />Reset circuit</button></div>
      <Readings values={[{ label: 'Simulated time $t$', value: `${time.toFixed(2)} s` }, { label: 'Capacitor $V_C$', value: format(s.v, 'V') }, { label: virtual && !revealed ? 'Reference $C$' : 'Charge $Q$', value: virtual && !revealed ? 'Unknown' : format(s.q, 'C'), accent: '#7bdec9' }, { label: 'Signed current $I$', value: format(s.i, 'A'), accent: '#eab775' }]} />
    </Experiment>
      <TimeConstantPanel tau={tau} concealed={virtual && !revealed} />
      <RCGraphs key={trialId} p={p} segments={segments} time={time} hideCharge={virtual && !revealed} inspect={t => { setRunning(false); setTime(t); setSegments(segments.filter((seg, i) => i === 0 || seg.start <= t)); setNotice('Replay starts at the inspected time; later switch events were removed.'); }} />
      <EquationLesson sections={[
        { title: 'Charging', tex: eq.chargeQ, explanation: String.raw`For an initially uncharged capacitor, $Q$ grows towards the maximum charge $Q_0$; $t$ is elapsed charging time.` },
        { title: 'Discharging', tex: eq.dischargeQ, explanation: String.raw`Charge remaining $Q$ falls from the initial charge $Q_0$ present when discharging begins; $t$ is elapsed discharging time.` },
        { title: 'Time Constant', tex: eq.tau, explanation: 'The time constant determines how quickly a capacitor charges or discharges. After one time constant, charging from zero reaches approximately 63.2% of maximum charge; discharging leaves approximately 36.8% of initial charge.' },
      ]} note={String.raw`$Q_0$ means maximum charge in the charging equation, but initial charge in the discharging equation. The charging equation above assumes zero initial charge and does not apply unchanged when recharging a partially charged capacitor. Switching midway preserves the actual charge and voltage; the simulation continues from that state. Current is positive while charging and negative while discharging.`} symbols={String.raw`$Q$: charge at time $t$, in coulombs (C); $Q_0$: maximum charging charge or initial discharging charge, in coulombs (C); $R$: resistance in ohms ($\Omega$); $C$: capacitance in farads (F); $t$: elapsed time for the stated process, in seconds (s); $\tau$: time constant in seconds (s); $e$: base of natural logarithms.`} />
      <details className="model-notes equation-library"><summary>Measuring capacitance & worked example</summary>
        <h3>Measuring capacitance</h3><DisplayMath tex={eq.experimentalC} /><p>Divide the measured time constant in seconds by the known resistance in ohms to obtain capacitance in farads.</p>
        {!virtual && <><h3>Worked example</h3><DisplayMath tex={String.raw`\begin{aligned}\tau&=(${quantity(p.r, 'Ω')})(${quantity(p.c, 'F')})\\&=${quantity(tau, 's')}\end{aligned}`} /><p>These are the current circuit settings.</p></>}
      </details>
    </div><aside className="control-panel"><div className="control-title"><Icon name="spark" /><h3>{virtual ? 'Known apparatus' : 'Circuit parameters'}</h3></div>
      <Field label="Resistance" unit="kΩ" value={p.r / 1e3} min={1} max={100} step={1} onChange={r => change({ ...p, r: r * 1e3 })} />
      {!virtual && <Field label="RC capacitance" unit="µF" value={p.c * 1e6} min={10} max={500} step={10} onChange={c => change({ ...p, c: c * 1e-6 })} />}
      <Field label="Supply voltage" unit="V" value={p.source} min={1} max={24} step={0.5} onChange={source => change({ ...p, source })} />
      <label className="select-label">Playback speed<select aria-label="Playback speed" value={speed} onChange={e => setSpeed(e.target.value)}>{['0.25', '0.5', '1', '2', '5'].map(x => <option value={x} key={x}>{x}×</option>)}</select></label>
      <p className="small">Changing R, C or supply starts a new discharged trial and clears readings. Switching Charge / Discharge preserves the current capacitor state. Speed changes simulated time only.</p>
      <div className="circuit-state"><i className={running ? 'status-dot' : 'paused-dot'} /><span>{charging ? 'Charging circuit' : 'Discharging circuit'} · {running ? 'running' : 'paused'}</span></div>
      <div className="preset"><span className="eyebrow">{virtual ? 'MEASURE IT' : 'TRY THIS'}</span><p><MathText>{virtual ? 'Record at least three readings, bracketing 63.2% of the supply voltage. The reference stays hidden until you check your result or reveal it.' : String.raw`Pause during charging, note $Q$ and $V_C$, then switch to discharge. Those values stay continuous while current changes direction.`}</MathText></p>{!virtual && <button onClick={() => change(initial)}>Load 1-second time constant <Icon name="arrow" size={15} /></button>}</div>
    </aside></div>
    {notice && <p className="status-message" role="status"><MathText>{notice}</MathText></p>}
    {mode === 'predict' && <Prediction tab={1} run={() => { change({ r: 2e4, c: 100e-6, source: 12 }); setRunning(true); setNotice(String.raw`Prediction trial: resistance doubled from 10 kΩ to 20 kΩ, with $C=100\,\mu\mathrm{F}$. The time constant changed from 1 s to 2 s.`); }} />}
    {mode === 'challenges' && <Challenges tab={1} />}
    {virtual && <VirtualExperiment key={trialId} p={p} time={time} readings={readings} record={() => { if (segments.length > 1 || !charging) { setNotice('For this measurement method, reset the circuit and record a single charging run from zero.'); return; } if (readings.some(r => Math.abs(r.t - time) < 1e-9)) { setNotice('A reading already exists at this time. Advance the stopwatch before recording again.'); return; } if (readings.length >= 200) { setNotice('The measurement table holds 200 readings; clear it to record more.'); return; } setReadings([...readings, { t: time, v: s.v }]); }} clearReadings={() => setReadings([])} advance={() => setTime(t => Math.min(t + .2, trialEnd))} paused={!running} revealed={revealed} setRevealed={setRevealed} />}
    <details className="learning-summary"><summary>Learning summary & time-handling policy</summary><p><MathText>{String.raw`Use $\tau=RC$ to determine resistance or capacitance. During charging from zero, charge rises towards its maximum while current decreases towards zero. During discharge, charge decreases and conventional current reverses. After a switch, the simulation keeps the charge and voltage already present.`}</MathText></p><p>Time freezes when the document is hidden. Switching subtopic pauses this apparatus. Resuming continues from the paused time. Trials pause after eight time constants from the last switch; use the graph to inspect or replay.</p></details>
  </>;
}
