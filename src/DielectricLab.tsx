import { useEffect, useRef, useState } from 'react';
import { charge, dielectric, format, plateCapacitance } from './physics';
import { Challenges, GuidedInvestigation, Prediction, modeItems, type Mode } from './learning';
import { Choices, Equation, Experiment, Field, Icon, PlateScene, Readings, Toggle, useReducedMotion } from './ui';
import { DisplayMath, InlineMath, MathText } from './math';
import { equations as eq } from './equations';
const materials = [{ name: 'Air', er: 1 }, { name: 'Paper', er: 3 }, { name: 'Glass', er: 5 }, { name: 'Plastic', er: 2.5 }, { name: 'Ceramic', er: 10 }];
export default function DielectricLab() {
  const [mode, setMode] = useState<Mode>('explore'), [er, setEr] = useState(4), [area, setArea] = useState(200), [gap, setGap] = useState(1.2), [source, setSource] = useState(12), [fraction, setFraction] = useState(0), [isolatedQ, setIsolatedQ] = useState<number | null>(null), [overlays, setOverlays] = useState(true), [material, setMaterial] = useState('Custom');
  const reduced = useReducedMotion();
  const [controlKey, setControlKey] = useState(0);
  const insertionFrame = useRef(0), [moving, setMoving] = useState(false);
  useEffect(() => () => cancelAnimationFrame(insertionFrame.current), []);
  const setInsertion = (value: number) => { cancelAnimationFrame(insertionFrame.current); setMoving(false); setFraction(value); };
  const animateInsertion = () => {
    const start = fraction, target = fraction === 1 ? 0 : 1;
    cancelAnimationFrame(insertionFrame.current);
    if (reduced) { setFraction(target); return; }
    setMoving(true); let beginning: number | null = null;
    const frame = (stamp: number) => {
      if (beginning === null) beginning = stamp;
      const t = Math.min(1, (stamp - beginning) / 400);
      // Every intermediate insertion fraction uses the valid lateral-fill model.
      setFraction(start + (target - start) * (t * t * (3 - 2 * t)));
      if (t < 1) insertionFrame.current = requestAnimationFrame(frame); else setMoving(false);
    };
    insertionFrame.current = requestAnimationFrame(frame);
  };
  const c0 = plateCapacitance(area * 1e-4, gap * 1e-3), c = plateCapacitance(area * 1e-4, gap * 1e-3, er, fraction), s = dielectric(c, source, isolatedQ, gap * 1e-3);
  const connected = isolatedQ === null;
  const reset = () => { setEr(4); setArea(200); setGap(1.2); setSource(12); setInsertion(0); setIsolatedQ(null); setOverlays(true); setMaterial('Custom'); setControlKey(k => k + 1); };
  return <>
    <div className="lab-heading"><div><span className="eyebrow">2.3 · MATTER IN THE FIELD</span><h2>The dielectric explorer</h2><p>Capacitors with dielectrics</p></div><button className="reset-button" onClick={reset}><Icon name="reset" size={17} />Reset tab</button></div>
    <Choices label="Learning mode" value={mode} items={modeItems} onChange={setMode} />
    <div className="lab-grid"><div className="lab-main"><Experiment title="Change the space between" subtitle="Insert an insulator. Discover what the electrical boundary keeps constant." badge={connected ? 'BATTERY CONNECTED · FIXED VOLTAGE' : 'BATTERY DISCONNECTED · FIXED FREE CHARGE'}>
      <PlateScene fraction={fraction} er={er} chargeFraction={s.q / 8e-9} fieldStrength={s.field / 10000} showCharges={overlays} showField={overlays} connected={connected} area={area} gap={gap} voltage={source} animate={!reduced} />
      <div className="apparatus-actions"><button disabled={moving} className={fraction === 1 ? 'primary' : ''} onClick={animateInsertion}>{fraction === 1 ? 'Remove dielectric' : 'Fully insert dielectric'}</button><button onClick={() => setIsolatedQ(connected ? s.q : null)}>{connected ? 'Disconnect battery' : 'Reconnect battery'}</button></div>
      <Readings values={[{ label: 'Capacitance C', value: format(c, 'F') }, { label: 'Voltage V', value: format(s.v, 'V') }, { label: 'Free charge Q', value: format(s.q, 'C'), accent: '#eab775' }, { label: 'Stored energy U', value: format(s.u, 'J'), accent: '#7bdec9' }]} />
    </Experiment>
      <dl className="dielectric-status" aria-label="Dielectric measurements">
        <div><dt>Net electric field <InlineMath tex="E" /></dt><dd>{format(s.field, 'V/m')}</dd></div>
        <div><dt>Air capacitance <InlineMath tex="C_0" /></dt><dd>{format(c0, 'F')}</dd></div>
        <div><dt>Dielectric constant <InlineMath tex={String.raw`\varepsilon_r`} /></dt><dd>{er.toFixed(3)}</dd></div>
        <div><dt>Capacitance ratio <InlineMath tex={String.raw`C/C_0`} /></dt><dd>{(c / c0).toFixed(3)}</dd></div>
      </dl>
      <p className="callout">The dielectric constant describes the material. The capacitance ratio uses the current insertion; it matches the material’s dielectric constant at complete filling.</p>
      <p className="callout">{connected ? 'The source holds voltage constant. Inserting dielectric increases capacitance, so free charge and stored energy increase. At fixed plate separation the net electric field stays the same.' : 'Free charge is conserved at the actual value when you disconnected. Increasing capacitance reduces voltage, stored energy and the net field at fixed geometry.'}</p>
      <Equation note="These dielectric equations apply to complete uniform filling of the same plate geometry. A larger plate area increases air capacitance; greater separation decreases it. During partial insertion, the readouts show the current filling instead. The model neglects edge effects and assumes a linear dielectric." symbols={String.raw`$\varepsilon_r$: relative permittivity of the material (dimensionless); $\varepsilon_0$: vacuum permittivity in $\mathrm{F\,m^{-1}}$; $C_0$: air capacitance; $C$: fully filled capacitance in these equations, both in farads (F); $A$: plate area in $\mathrm{m^2}$; $d$: separation in metres (m).`}>{[eq.airC, eq.permittivity, eq.filledC]}</Equation>
      <details className="model-notes equation-library"><summary>Dielectric equations & battery conditions</summary>
        <h3>Complete uniform filling</h3>{[eq.airC, eq.permittivity, eq.filledC].map(tex => <DisplayMath key={tex} tex={tex} />)}
        <p>These relations compare the same plate geometry before and after the dielectric completely fills the gap.</p>
        <h3>Battery connected</h3>{[eq.fixedV, eq.charge, eq.energyCV].map(tex => <DisplayMath key={tex} tex={tex} />)}<p>The source fixes voltage and exchanges charge and energy with the capacitor.</p>
        <h3>Battery disconnected</h3>{[eq.fixedQ, eq.isolatedV, eq.energyQC].map(tex => <DisplayMath key={tex} tex={tex} />)}<p>Free charge stays fixed at its actual value at disconnection. A larger capacitance then lowers voltage and stored energy.</p>
        <p><MathText>{String.raw`$V$: potential difference in volts (V); $Q$: free charge in coulombs (C); $U$: stored energy in joules (J).`}</MathText></p>
      </details>
      <details className="model-notes"><summary>Polarization, partial insertion & ideal switching</summary><p>Dipoles have negative bound charge facing the positive plate and positive bound charge facing the negative plate. These depict polarization, not mobile electrons traversing the slab. Free charges remain on the conductors.</p><p>During lateral partial insertion, the filled and air regions act as parallel capacitors. The slab fills the whole gap thickness over part of the plate area. Fringing and mechanical forces are neglected. The dielectric equations above describe complete filling.</p><p>Reconnecting the ideal source immediately restores the source voltage; charge and energy can jump because the source exchanges them. Isolated geometry changes preserve free charge.</p><p><InlineMath tex={String.raw`\varepsilon_0=8.8541878128\times10^{-12}\,\mathrm{F\,m^{-1}}`} />. The depicted plate area and gap scale with the controls; field-arrow strength and charge-symbol density are qualitative.</p></details>
    </div><aside className="control-panel" key={controlKey}><div className="control-title"><Icon name="capacitor" /><h3>Material & geometry</h3></div>
      <label className="select-label">Illustrative material<select aria-label="Dielectric material" value={material} onChange={e => { const m = materials.find(x => x.name === e.target.value); setMaterial(e.target.value); if (m) setEr(m.er); }}><option>Custom</option>{materials.map(m => <option key={m.name}>{m.name}</option>)}</select></label>
      <Field label="Relative permittivity εr" displayLabel={<>Relative permittivity <InlineMath tex={String.raw`\varepsilon_r`} /></>} unit="" value={er} min={1} max={12} step={0.1} onChange={n => { setEr(n); setMaterial('Custom'); }} />
      <Field label="Plate area" unit="cm²" value={area} min={100} max={400} onChange={setArea} />
      <Field label="Plate separation" unit="mm" value={gap} min={0.5} max={3} step={0.1} onChange={setGap} />
      <Field label="Battery voltage" unit="V" value={source} min={0} max={24} step={0.1} onChange={setSource} />
      <Field label="Lateral insertion (enrichment)" unit="%" value={fraction * 100} min={0} max={100} onChange={n => setInsertion(n / 100)} />
      <Toggle label="Battery connected" checked={connected} onChange={next => setIsolatedQ(next ? null : s.q)} /><Toggle label="Field & charge overlays" checked={overlays} onChange={setOverlays} />
      <p className="small">Material values are illustrative: air ≈ 1, paper ≈ 3, glass ≈ 5, plastic ≈ 2.5, ceramic ≈ 10. Actual <InlineMath tex={String.raw`\varepsilon_r`} /> depends on composition, temperature and frequency; ceramic values vary widely.</p>
      <div className="preset"><span className="eyebrow">TRY THIS</span><p>Compare full insertion of <InlineMath tex={String.raw`\varepsilon_r=4`} /> with the battery connected, then repeat while isolated.</p><button onClick={reset}>Load air-filled baseline <Icon name="arrow" size={15} /></button></div>
    </aside></div>
    {mode === 'predict' && <Prediction tab={2} run={() => { const baseline = plateCapacitance(.02, .0012); setEr(4); setArea(200); setGap(1.2); setSource(12); setIsolatedQ(charge(baseline, 12)); setInsertion(1); setMaterial('Custom'); }} />}{mode === 'challenges' && <Challenges tab={2} />}{mode === 'experiment' && <GuidedInvestigation tab={2} />}
    <details className="learning-summary"><summary>Learning summary & model assumptions</summary><p>Relative permittivity <InlineMath tex={eq.permittivity} /> compares a fully dielectric-filled capacitor to the same geometry with air approximated as vacuum. Air capacitance is proportional to area and inversely proportional to plate separation. The battery boundary matters: connected fixes voltage; isolated fixes free charge. Dielectric insertion does not always reduce the net field. Polarization produces bound surface charge and changes the charge–voltage relation.</p></details>
  </>;
}
