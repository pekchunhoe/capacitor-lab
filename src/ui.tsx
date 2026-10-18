import { useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { format, sampleRC, timeConstant, type RCParameters, type Segment } from './physics';
import { DisplayMath, InlineMath, MathText } from './math';
import { activeCurrentPaths, CURRENT_PATHS, currentMarkers, currentReference, currentVisualSpeed, pointOnCurrentPath } from './currentMotion';

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    capacitor: <><path d="M3 12h6m6 0h6M9 5v14M15 5v14" /></>,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
    expand: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    play: <path d="m7 4 13 8-13 8Z" />,
    pause: <><path d="M8 4v16M16 4v16" /></>,
    spark: <path d="m13 2-9 12h7l-1 8 10-12h-7Z" />,
    flask: <><path d="M9 3h6m-5 0v7L4 20h16l-6-10V3M7 15h10" /></>,
    check: <path d="m5 12 4 4L20 5" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.capacitor}</svg>;
}
export function Field({ label, value, unit, min, max, step = 1, onChange, disabled = false, displayLabel }: { label: string; displayLabel?: ReactNode; value: number; unit: string; min: number; max: number; step?: number; onChange: (n: number) => void; disabled?: boolean }) {
  const id = useId(); const [draft, setDraft] = useState(String(value)); const [error, setError] = useState('');
  useEffect(() => { setDraft(String(Number(value.toPrecision(8)))); setError(''); }, [value]);
  const update = (raw: string) => {
    setDraft(raw); const n = Number(raw);
    if (!raw.trim() || !Number.isFinite(n) || n < min || n > max) { setError(`Enter ${min}–${max} ${unit}.`); return; }
    setError(''); onChange(n);
  };
  return <div className="field">
    <div className="field-heading"><label htmlFor={id}>{displayLabel ?? label}</label><div className="number-unit"><input id={id} aria-label={label} type="number" inputMode="decimal" value={draft} min={min} max={max} step="any" disabled={disabled} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={e => update(e.target.value)} /><span>{unit}</span></div></div>
    <input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => { setError(''); onChange(Number(e.target.value)); }} />
    <div className="range-labels"><span>{min} {unit}</span><span>{max} {unit}</span></div>
    {error && <p className="error" id={`${id}-error`} role="alert">{error}</p>}
  </div>;
}
export function Choices<T extends string>({ label, value, items, onChange }: { label: string; value: T; items: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return <div className="choice-group" role="group" aria-label={label}>{items.map(item => <button key={item.value} aria-pressed={value === item.value} className={value === item.value ? 'chosen' : ''} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span className="toggle-track" aria-hidden="true" /></label>;
}
export function Readings({ values }: { values: { label: string; value: string; accent?: string }[] }) {
  return <dl className="readings">{values.map(v => <div key={v.label} style={{ '--reading-accent': v.accent } as React.CSSProperties}><dt><MathText>{v.label}</MathText></dt><dd>{v.value}</dd></div>)}</dl>;
}
export function Equation({ children, note, symbols }: { children: string | readonly string[]; note: ReactNode; symbols?: string }) {
  return <section className="equation"><div className="eyebrow">THE PHYSICS BEHIND IT</div><div className="formula">{(typeof children === 'string' ? [children] : children).map((tex, i) => <DisplayMath key={i} tex={tex} />)}</div><p>{note}</p>{symbols && <details className="equation-explanation"><summary>Symbols & units</summary><p><MathText>{symbols}</MathText></p></details>}</section>;
}
export function EquationLesson({ sections, note, symbols }: { sections: { title: string; tex: string; explanation: string }[]; note: string; symbols: string }) {
  return <section className="equation equation-lesson" aria-label="The physics behind it">
    <div className="eyebrow">THE PHYSICS BEHIND IT</div>
    {sections.map(({ title, tex, explanation }) => <section className="equation-section" key={title} aria-label={title}>
      <h3>{title}</h3><DisplayMath tex={tex} /><p><MathText>{explanation}</MathText></p>
    </section>)}
    <p><MathText>{note}</MathText></p>
    <details className="equation-explanation"><summary>Symbols & units</summary><p><MathText>{symbols}</MathText></p></details>
  </section>;
}
export function Experiment({ title, subtitle, badge, children }: { title: string; subtitle: string; badge: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const container = useExpansion(expanded, setExpanded);
  return <section ref={container} className={`experiment ${expanded ? 'expanded' : ''}`} aria-label={title} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}>
    <div className="experiment-top"><div><span className="eyebrow">{badge}</span><h3>{title}</h3><p>{subtitle}</p></div><button className="icon-button" aria-label={expanded ? 'Close expanded experiment' : 'Expand experiment'} onClick={() => setExpanded(!expanded)}><Icon name="expand" /></button></div>
    {children}
    <div className="legend"><span><i className="positive-dot" /> + positive / conventional current</span><span><i className="negative-dot" /> − negative</span><span><i className="field-dot" /> electric field</span></div>
  </section>;
}
function useExpansion(expanded: boolean, setExpanded: Dispatch<SetStateAction<boolean>>) {
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    container.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setExpanded(false); }
      if (e.key !== 'Tab') return;
      const controls = [...(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]') || [])].filter(x => x.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [expanded, setExpanded]);
  return container;
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const m = matchMedia('(prefers-reduced-motion: reduce)'); const changed = () => setReduced(m.matches); m.addEventListener('change', changed); return () => m.removeEventListener('change', changed); }, []);
  return reduced;
}
export function PlateScene({ fraction = 0, er = 1, chargeFraction = 0.6, fieldStrength = 0.6, showCharges = true, showField = true, connected = true, voltage = 12, area = 200, gap = 1.2, speed = 1, animate = true, conceptual = false }: { fraction?: number; er?: number; chargeFraction?: number; fieldStrength?: number; showCharges?: boolean; showField?: boolean; connected?: boolean; voltage?: number; area?: number; gap?: number; speed?: number; animate?: boolean; conceptual?: boolean }) {
  const id = useId().replace(/:/g, '');
  const width = 290 * Math.sqrt(area / 200), left = 345 - width / 2, right = left + width, separation = 75 * gap / 1.2, top = 165 - separation / 2, bottom = top + separation;
  const n = chargeFraction <= 0 ? 0 : Math.max(1, Math.min(18, Math.round(chargeFraction * 18)));
  const path = (y: number) => `${left},${y} ${right},${y} ${right + 75},${y - 48} ${left + 75},${y - 48}`;
  return <svg className={`apparatus plate-scene ${animate ? '' : 'still'}`} viewBox="0 0 700 330" role="img" aria-label={`Parallel plates: ${connected ? 'battery connected' : 'isolated'}, ${Math.round(fraction * 100)} percent dielectric insertion. Net electric field points from the positive upper plate to the negative lower plate.`} style={{ '--motion-speed': `${0.45 / speed}s` } as React.CSSProperties}>
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#d6e4f4" /><stop offset=".35" stopColor="#657d9a" /><stop offset=".7" stopColor="#bdcede" /><stop offset="1" stopColor="#546b88" /></linearGradient>
      <linearGradient id={`${id}-slab`} x2="1" y2="1"><stop stopColor="#6be5cc" stopOpacity=".3" /><stop offset="1" stopColor="#278d89" stopOpacity=".7" /></linearGradient>
      <marker id={`${id}-arrow`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="m0 0 5 3-5 3" fill="none" stroke="#70e3cc" /></marker>
      <radialGradient id={`${id}-glow`}><stop stopColor="#2ea797" stopOpacity=".15" /><stop offset="1" stopColor="#2ea797" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="365" cy="195" rx="290" ry="130" fill={`url(#${id}-glow)`} />
    <path d={`M${left + 15} ${top - 10}H72V150M72 180V${bottom + 35}H${left + 20}V${bottom + 5}`} className="wire" />
    <path d="M55 150h34M62 162h20M55 174h34M62 186h20" stroke="#cbd7e6" strokeWidth="3" />
    <text x="43" y="139" className="svg-positive">+</text><text x="45" y="204" className="svg-negative">−</text>
    <text x="22" y="235" className="svg-label">{voltage.toPrecision(3)} V source</text>
    <path d={`M110 ${top - 10}h30`} stroke="#0b1525" strokeWidth="9" /><path d={`M110 ${top - 10}l30 ${connected ? 0 : -16}`} stroke="#e6b674" strokeWidth="3" />
    <polygon points={path(bottom)} fill={`url(#${id}-metal)`} stroke="#a4b8d0" />
    <path d={`M${left} ${bottom}v7H${right}l75-48v-7l-75 48Z`} fill="#425570" stroke="#7085a1" />
    {fraction > 0 && er > 1 && <g className="dielectric-slab">
      <polygon points={`${left + 8},${top + 7} ${left + 8 + (width - 16) * fraction},${top + 7} ${left + 8 + (width - 16) * fraction + 68},${top - 36} ${left + 76},${top - 36}`} fill="#72daca" opacity=".32" />
      <polygon points={`${left + 8},${top + 7} ${left + 8 + (width - 16) * fraction},${top + 7} ${left + 8 + (width - 16) * fraction},${bottom - 6} ${left + 8},${bottom - 6}`} fill={`url(#${id}-slab)`} stroke="#65c8b4" strokeOpacity=".6" />
      {Array.from({ length: Math.max(1, Math.round(fraction * 7)) }, (_, i) => <g key={i} transform={`translate(${left + 21 + i * (width - 35) / 7},${(top + bottom) / 2})`}><line y1="-8" y2="8" stroke="#b4f2df" /><text y="-8" className="dipole-minus">−</text><text y="17" className="dipole-plus">+</text></g>)}
    </g>}
    {showField && fieldStrength > 0 && Array.from({ length: 7 }, (_, i) => <line key={i} x1={left + 25 + i * (width - 35) / 7 + 25} x2={left + 25 + i * (width - 35) / 7 + 25} y1={top + 8} y2={bottom - 15} stroke="#70e3cc" strokeWidth={1 + Math.min(fieldStrength, 2)} opacity={0.15 + Math.min(fieldStrength, 1) * 0.7} markerEnd={`url(#${id}-arrow)`} />)}
    <polygon points={path(top)} fill={`url(#${id}-metal)`} stroke="#d6e0eb" />
    <path d={`M${left} ${top}v7H${right}l75-48v-7l-75 48Z`} fill="#74869d" stroke="#a0b1c7" />
    {showCharges && Array.from({ length: n }, (_, i) => {
      const x = left + 18 + (i % 9) * (width - 30) / 9 + (i >= 9 ? 35 : 0), offset = i >= 9 ? -26 : -8;
      return <g key={i} className="plate-charge"><text x={x} y={top + offset} className="svg-positive">+</text><text x={x} y={bottom + 13 + offset} className="svg-negative">−</text></g>;
    })}
    <path d={`M${right + 100} ${top}h10v${separation}h-10`} fill="none" stroke="#62738c" strokeDasharray="3 3" />
    <text x={right + 115} y={(top + bottom) / 2 + 5} className="svg-label">{conceptual ? 'gap' : `${gap} mm`}</text>
    <text x="345" y="298" textAnchor="middle" className="svg-label">{fraction > 0 ? <>Polarized dielectric · ε<tspan baselineShift="sub" fontSize="9">r</tspan> = {er} · {Math.round(fraction * 100)}% area filled</> : 'Free charges stay on the conducting surfaces'}</text>
    <text x={left + width / 2 + 35} y={top - 65} textAnchor="middle" className="svg-label">{conceptual ? 'Ideal capacitor · schematic geometry' : `${area} cm² plate area`}</text>
  </svg>;
}

export function RCCircuit({ p, v, i, charging, running, time, phase, hiddenC = false }: { p: RCParameters; v: number; i: number; charging: boolean; running: boolean; time: number; phase: number; hiddenC?: boolean }) {
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion(), direction = Math.sign(i), visualSpeed = currentVisualSpeed(i, currentReference(p));
  const markerPhase = reduced ? 0 : phase;
  const fraction = p.source ? v / p.source : 0, n = Math.min(10, Math.round(fraction * 10));
  return <svg className={`apparatus rc-scene ${running ? '' : 'still'}`} viewBox="0 0 700 310" role="img" aria-label={`RC circuit, ${charging ? 'charging' : 'discharging'}. Capacitor voltage ${format(v, 'V')}. Signed conventional current ${format(i, 'A')}. ${direction > 0 ? 'Conventional current follows the charging reference.' : direction < 0 ? 'Conventional current flows opposite to the charging reference.' : 'Zero current; markers are stationary.'} Charge does not cross the insulating gap.`}>
    <defs><linearGradient id={`${id}-resistor`} x2="0" y2="1"><stop stopColor="#d5b28e" /><stop offset=".5" stopColor="#a98058" /><stop offset="1" stopColor="#745239" /></linearGradient></defs>
    <path d="M110 140V65h90M250 65h70m100 0h130v74m0 22v89H110v-85" className="wire" />
    <path d="M160 250V105h40" className={`wire ${charging ? 'inactive-wire' : ''}`} />
    <circle cx="250" cy="65" r="5" fill="#e6b674" /><circle cx="200" cy="65" r="4" fill="#e6b674" /><circle cx="200" cy="105" r="4" fill="#e6b674" />
    <path d={`M250 65 200 ${charging ? 65 : 105}`} stroke="#e6b674" strokeWidth="4" strokeLinecap="round" />
    <text x="209" y="36" textAnchor="middle" className="svg-label">{charging ? 'CHARGE' : 'DISCHARGE'}</text>
    <rect x="320" y="49" width="100" height="32" rx="5" fill={`url(#${id}-resistor)`} stroke="#cba879" />
    <path d="M338 49v32m15-32v32m29-32v32m23-32v32" stroke="#453b35" strokeWidth="5" />
    <text x="370" y="112" textAnchor="middle" className="svg-label">R = {format(p.r, 'Ω')}</text>
    <path d="M88 140h44M98 155h24M88 166h44M98 181h24" stroke="#c9d9ea" strokeWidth="3" /><text x="70" y="137" className="svg-positive">+</text><text x="70" y="187" className="svg-negative">−</text>
    <text x="63" y="216" className="svg-label">{p.source} V</text>
    <path d="M507 139h86m-86 22h86" stroke="#d3e5f7" strokeWidth="6" /><rect x="507" y="142" width="86" height="16" fill="#72e0c3" opacity={fraction * 0.25} />
    {Array.from({ length: n }, (_, k) => <g key={k}><text x={510 + k * 8} y="130" className="small-positive">+</text><text x={510 + k * 8} y="182" className="small-negative">−</text></g>)}
    <text x="550" y="211" textAnchor="middle" className="svg-label">C = {hiddenC ? 'unknown' : format(p.c, 'F')}</text>
    <text x="370" y="174" textAnchor="middle" className="instrument-value">{format(v, 'V')}</text><text x="370" y="197" textAnchor="middle" className="svg-label">CAPACITOR VOLTMETER</text>
    <g className="current-flow" data-current={i} data-time={time} data-phase={phase} data-direction={direction} data-speed={visualSpeed} data-motion-speed={running && !reduced ? visualSpeed : 0} data-reduced-motion={reduced} aria-hidden="true">
      {activeCurrentPaths(charging).map(name => {
        const path = CURRENT_PATHS[name], arrow = pointOnCurrentPath(name, path.length * .55);
        return <g key={name} data-current-path={name}>
          <path className="current-conductor" d={path.d} />
          {currentMarkers(name, markerPhase).map((marker, index) => <circle key={index} className="current-particle" cx={marker.x} cy={marker.y} r="2.7" opacity={marker.opacity} data-distance={marker.distance} />)}
          {direction !== 0 && <path className="current-direction-arrow" d="M-7 -4L5 0L-7 4" transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle + (direction < 0 ? 180 : 0)})`} />}
        </g>;
      })}
    </g>
    <text x="350" y="285" textAnchor="middle" className="svg-label">Conventional current {direction > 0 ? 'clockwise →' : direction < 0 ? 'reverses ←' : 'zero · markers stationary'} · insulating gap carries no free current</text>
    <text x="350" y="302" textAnchor="middle" className="svg-label">Marker speed shows current relative to the circuit’s maximum.</text>
  </svg>;
}

export function NetworkScene({ cs, topology, source, results }: { cs: number[]; topology: 'series' | 'parallel'; source: number; results: { q: number; v: number }[] }) {
  return <svg className="apparatus network-scene" viewBox="0 0 700 330" role="img" aria-label={`${cs.length} capacitors in ${topology}. ${topology === 'series' ? 'One path; every capacitor has equal charge.' : 'Separate branches share the battery voltage.'}`}>
    <path d="M65 145V70H635V260H65v-90" className="wire" /><path d="M45 145h40m-30 15h20m-30 15h40" stroke="#d4dfeb" strokeWidth="3" /><text x="30" y="134" className="svg-positive">+</text><text x="30" y="197" className="svg-negative">−</text><text x="25" y="228" className="svg-label">{source} V</text>
    {topology === 'series' ? cs.map((c, j) => {
      const x = 155 + j * (420 / Math.max(1, cs.length - 1));
      return <g key={j}><path d={`M${x - 9} 70h18`} stroke="#0c1627" strokeWidth="9" /><path d={`M${x - 9} 48v44m18-44v44`} stroke="#b4d2e9" strokeWidth="4" /><text x={x} y="119" textAnchor="middle" className="svg-label">C<tspan baselineShift="sub" fontSize="9">{j + 1}</tspan> · {format(c, 'F')}</text><text x={x} y="146" textAnchor="middle" className="svg-positive">{format(results[j].q, 'C')}</text><text x={x} y="172" textAnchor="middle" className="svg-label">{format(results[j].v, 'V')}</text></g>;
    }) : cs.map((c, j) => {
      const x = 180 + j * (380 / Math.max(1, cs.length - 1));
      return <g key={j}><path d={`M${x} 70v65m0 24v101`} className="wire" /><path d={`M${x - 24} 135h48m-48 24h48`} stroke="#b4d2e9" strokeWidth="4" /><text x={x} y="112" textAnchor="middle" className="svg-label">C<tspan baselineShift="sub" fontSize="9">{j + 1}</tspan></text><text x={x} y="191" textAnchor="middle" className="svg-label">{format(c, 'F')}</text><text x={x} y="216" textAnchor="middle" className="svg-positive">{format(results[j].q, 'C')}</text><text x={x} y="240" textAnchor="middle" className="svg-label">{format(results[j].v, 'V')}</text></g>;
    })}
    <text x="350" y="306" textAnchor="middle" className="svg-label">{topology === 'series' ? 'SAME CHARGE · voltage is shared' : 'SAME VOLTAGE · charge is shared'}</text>
  </svg>;
}

export function RCGraphs({ p, segments, time, inspect, hideCharge = false }: { p: RCParameters; segments: Segment[]; time: number; inspect: (t: number) => void; hideCharge?: boolean }) {
  const tau = timeConstant(p.r, p.c), end = Math.max(tau * 5, time, segments[segments.length - 1].start + tau * 5);
  const [cursor, setCursor] = useState<number | null>(null); const [expanded, setExpanded] = useState(false);
  const container = useExpansion(expanded, setExpanded);
  const viewTime = cursor === null ? time : Math.min(cursor, end), state = sampleRC(p, segments, viewTime);
  const left = 82, right = 536, top = 28, bottom = 168;
  const x = (t: number) => left + t / end * (right - left);
  const markers = hideCharge ? [] : [1, 2, 3, 5].map(k => k * tau);
  const curves = [
    { key: 'q' as const, label: hideCharge ? 'Capacitor voltage versus time' : 'Charge Q–t', unit: hideCharge ? 'V' : 'C', max: hideCharge ? p.source : p.c * p.source, color: '#79dec7' },
    { key: 'i' as const, label: 'Signed current I–t', unit: 'A', max: p.source / p.r, color: '#eab775' },
  ];
  return <section ref={container} className={`graphs-panel ${expanded ? 'graphs-expanded' : ''}`} aria-label="Synchronized RC graphs" role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}><div className="section-row"><h3>Watch the response</h3><button className="icon-button" aria-label={expanded ? 'Close expanded graphs' : 'Expand graphs'} onClick={() => setExpanded(!expanded)}><Icon name="expand" /></button></div>
    <div className="graphs">{curves.map(curve => {
      const signed = curve.key === 'i', minimum = signed ? -curve.max : 0;
      const y = (value: number) => bottom - (value - minimum) / (curve.max - minimum || 1) * (bottom - top);
      const value = (t: number, segment?: Segment) => { const s = segment ? sampleRC(p, [segment], t) : sampleRC(p, segments, t); return curve.key === 'q' ? hideCharge ? s.v : s.q : s.i; };
      const axisScale = signed ? 1e3 : hideCharge ? 1 : 1e6;
      return <div className="graph" key={curve.key}><div className="graph-title"><span><i style={{ background: curve.color }} />{hideCharge && curve.key === 'q' ? <>Capacitor voltage <InlineMath tex="V_C" />–t</> : curve.label}</span><strong style={{ color: curve.color }}>{format(curve.key === 'q' ? hideCharge ? state.v : state.q : state.i, curve.unit)}</strong></div>
        <svg viewBox="0 0 560 209" role="img" aria-label={`${curve.label}. Charging charge rises exponentially; discharge falls exponentially. Current jumps at switch events and decays toward zero. Cursor ${format(viewTime, 's')}.`} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); const rect = e.currentTarget.getBoundingClientRect(); setCursor(Math.max(0, Math.min(end, ((e.clientX - rect.left) / rect.width * 560 - left) / (right - left) * end))); }} onPointerMove={e => { if (e.buttons) { const rect = e.currentTarget.getBoundingClientRect(); setCursor(Math.max(0, Math.min(end, ((e.clientX - rect.left) / rect.width * 560 - left) / (right - left) * end))); } }} style={{ touchAction: 'none' }}>
          <text x="3" y="15" className="tick">{signed ? 'I / mA' : hideCharge ? <>V<tspan baselineShift="sub" fontSize="10">C</tspan> / V</> : 'Q / µC'}</text>
          {[minimum, (minimum + curve.max) / 2, curve.max].map((v, k) => <g key={k}><line x1={left} x2={right} y1={y(v)} y2={y(v)} className="grid-line" /><text x={left - 8} y={y(v) + 4} textAnchor="end" className="tick">{Number((v * axisScale).toPrecision(3))}</text></g>)}
          {markers.map((t, k) => <g key={k}><line x1={x(t)} x2={x(t)} y1={top} y2={bottom} className="tau-line" /><text x={x(t)} y={15} textAnchor="middle" className="tau-label">{[1, 2, 3, 5][k]}τ</text></g>)}
          {[0, end / 2, end].map(t => <text key={t} x={x(t)} y="188" textAnchor="middle" className="tick">{Number(t.toPrecision(3))}</text>)}
          <text x="535" y="205" textAnchor="end" className="tick">t / s</text>
          {segments.map((s, k) => {
            const finish = segments[k + 1]?.start ?? end;
            const points = Array.from({ length: 101 }, (_, j) => { const t = s.start + (finish - s.start) * j / 100; return `${x(t)},${y(value(t, s))}`; }).join(' ');
            return <g key={k}><polyline points={points} fill="none" stroke={curve.color} strokeWidth="2.5" opacity={k === segments.length - 1 ? 1 : .55} />{k > 0 && <line x1={x(s.start)} x2={x(s.start)} y1={top} y2={bottom} stroke="#ab9af4" strokeDasharray="4 4" />}</g>;
          })}
          <line x1={x(viewTime)} x2={x(viewTime)} y1={top} y2={bottom} stroke="#d8e4ef" strokeOpacity=".5" /><circle cx={x(viewTime)} cy={y(value(viewTime))} r="4.5" fill={curve.color} stroke="#0b1526" strokeWidth="2" />
        </svg>
      </div>;
    })}</div>
    <div className="graph-inspect"><label htmlFor="graph-cursor">Inspect at {format(viewTime, 's')}</label><input id="graph-cursor" aria-label="Graph inspection time" type="range" min="0" max={end} step={end / 500} value={viewTime} onChange={e => setCursor(Number(e.target.value))} /><button onClick={() => { if (cursor !== null) inspect(cursor); setCursor(null); }}>{cursor === null ? 'Live cursor' : 'Replay from here'}</button>{cursor !== null && <button onClick={() => setCursor(null)}>Return live</button>}</div>
    <p className="small">Solid curves show the exact response, including the future projection. Purple lines mark switch events; earlier segments are dimmed. Both plots share one cursor.</p>
  </section>;
}
