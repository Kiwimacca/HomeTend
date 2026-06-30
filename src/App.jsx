import React, { useState, useEffect, useRef } from 'react';

// Every service uses the same 4-option frequency control. Which options are
// enabled per service is gated by maxFrequency below.
const FREQUENCIES = [
  { id: 'annual', label: 'Annual', visitsPerYear: 1 },
  { id: 'twice-yearly', label: 'Twice-yearly', visitsPerYear: 2 },
  { id: 'quarterly', label: 'Quarterly', visitsPerYear: 4 },
  { id: 'monthly', label: 'Monthly', visitsPerYear: 12 },
];

const SERVICES = [
  { id: 'house-wash', name: 'House Wash', why: 'Pollen and grime build through the warmer months — washed off before it sets in.', angle: 0, maxFrequency: 'twice-yearly' },
  { id: 'roof', name: 'Roof Wash & Mould Removal', why: 'Cleared before winter rain drives moss and mould deeper in.', angle: 45, maxFrequency: 'twice-yearly' },
  { id: 'gutter', name: 'Gutter Clean', why: 'Cleared before the storms hit, so water has somewhere to go.', angle: 90, maxFrequency: 'twice-yearly' },
  { id: 'windows', name: 'Window Clean', why: 'The clean that actually happens, on schedule, without you doing it.', angle: 135, maxFrequency: 'monthly' },
  { id: 'driveway', name: 'Driveway Clean', why: 'Oil, moss and stains lifted before they set into the concrete.', angle: 180, maxFrequency: 'twice-yearly' },
  { id: 'hvac', name: 'HVAC Maintenance', why: 'Checked and filtered regularly so it never has to work harder than it should.', angle: 225, maxFrequency: 'monthly' },
  { id: 'spa', name: 'Spa Pool Maintenance', why: 'Filter and chemical service — choose how often suits your use.', angle: 270, maxFrequency: 'monthly' },
  { id: 'spider', name: 'Spider Control', why: 'Treated before they move in for the warmer months — eaves, corners, window frames.', angle: 315, maxFrequency: 'twice-yearly' },
];

function allowedFrequencies(serviceId) {
  const svc = SERVICES.find((s) => s.id === serviceId);
  const maxIdx = FREQUENCIES.findIndex((f) => f.id === (svc?.maxFrequency || 'annual'));
  return FREQUENCIES.slice(0, maxIdx + 1);
}

// Pricing matrix — proxy-based, no address/m² lookup required.
// Rates derived from Christchurch market research (mid-2026), converted from
// typical one-off visit pricing to a per-visit monthly-equivalent rate, plus
// a ~12% reliability/subscription premium. Total scales with chosen frequency.
// Source ranges (one-off, NZD): house wash $239-295, roof moss/mould $250-600,
// gutter $100-300, windows (ext) $50-110, driveway $150-350, HVAC $80-200/unit,
// spa pool $120-250+, spider control $99-150.
const SIZE_BANDS = [
  { id: 'small', label: 'Small', hint: 'Apartment / townhouse, up to ~2 bedrooms', multiplier: 0.8 },
  { id: 'medium', label: 'Medium', hint: 'Standalone home, 3 bedrooms', multiplier: 1.0 },
  { id: 'large', label: 'Large', hint: '4+ bedrooms, or a larger section', multiplier: 1.3 },
];

// Rate per single visit/year (monthly-equivalent, with premium applied).
// Multiplied by however many visits/year the customer chooses.
const SERVICE_RATES = {
  'house-wash': 25,
  'roof': 37,
  'gutter': 17,
  'windows': 8.5,
  'driveway': 20,
  'hvac': 13,
  'spa': 17,
  'spider': 11,
};

const STOREY_SURCHARGE = { 1: 0, 2: 6, 3: 12 }; // added per applicable exterior service if 2+ storeys

function isExterior(id) {
  return ['house-wash', 'roof', 'gutter', 'windows', 'driveway', 'spider'].includes(id);
}

function calculateQuote({ selected, sizeBand, storeys, hvacOutlets, spaSize, frequencyByService }) {
  const band = SIZE_BANDS.find((b) => b.id === sizeBand) || SIZE_BANDS[1];
  let total = 0;
  const breakdown = [];

  selected.forEach((id) => {
    const rate = SERVICE_RATES[id] || 15;
    const freqId = frequencyByService?.[id] || 'annual';
    const freq = FREQUENCIES.find((f) => f.id === freqId) || FREQUENCIES[0];
    const visitCount = freq.visitsPerYear;

    let line = rate * visitCount * band.multiplier;

    if (isExterior(id) && storeys >= 2) {
      line += STOREY_SURCHARGE[storeys] || 0;
    }

    if (id === 'hvac') {
      const extraOutlets = Math.max(0, (hvacOutlets || 1) - 1);
      line += extraOutlets * 9;
    }

    if (id === 'spa') {
      const spaMultiplier = { small: 0.85, medium: 1, large: 1.25 }[spaSize || 'medium'];
      line = line * spaMultiplier;
    }

    line = Math.round(line);
    breakdown.push({ id, amount: line, seasonCount: visitCount });
    total += line;
  });

  // base callout/admin component once any service is selected
  const calloutBase = selected.size > 0 ? 12 : 0;
  total += calloutBase;

  return { total: Math.round(total), breakdown, calloutBase };
}

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function SeasonalWheel() {
  const [active, setActive] = useState(null);
  const size = 560;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 240;
  const innerR = 150;
  const dotR = 195;

  const seasonColor = {
    Spring: '#A8B5A0',
    Summer: '#D8B25C',
    Autumn: '#B5603F',
    Winter: '#8AA0AE',
  };

  const polarToXY = (angleDeg, r) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  const arc = (startAngle, endAngle, r) => {
    const [x1, y1] = polarToXY(startAngle, r);
    const [x2, y2] = polarToXY(endAngle, r);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  const seasonSpans = [
    { name: 'Spring', start: 270, end: 360 },
    { name: 'Summer', start: 0, end: 90 },
    { name: 'Autumn', start: 90, end: 180 },
    { name: 'Winter', start: 180, end: 270 },
  ];

  return (
    <div className="wheel-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="wheel-svg">
        {seasonSpans.map((s) => (
          <path
            key={s.name}
            d={arc(s.start, s.end, outerR)}
            fill={seasonColor[s.name]}
            opacity={0.13}
          />
        ))}
        {seasonSpans.map((s) => (
          <circle key={s.name + 'ring'} cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--line)" strokeWidth="1" />
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill="var(--paper)" stroke="var(--line)" strokeWidth="1.5" />

        {seasonSpans.map((s) => {
          const mid = (s.start + s.end) / 2;
          const [lx, ly] = polarToXY(mid, outerR + 24);
          return (
            <text
              key={s.name + 'label'}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="wheel-season-label"
              fill={seasonColor[s.name]}
            >
              {s.name}
            </text>
          );
        })}

        <text x={cx} y={cy - 10} textAnchor="middle" className="wheel-center-title" fill="var(--ink)">HomeTend</text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="wheel-center-sub" fill="#8A8576">one plan, all year</text>

        {SERVICES.map((s) => {
          const [x, y] = polarToXY(s.angle, dotR);
          const isActive = active === s.id;
          return (
            <g
              key={s.id}
              onMouseEnter={() => setActive(s.id)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(isActive ? null : s.id)}
              className="wheel-node"
              style={{ cursor: 'pointer' }}
            >
              <circle cx={x} cy={y} r={isActive ? 9 : 6.5} fill={seasonColor[s.season]} stroke="var(--paper)" strokeWidth="2.5" />
            </g>
          );
        })}
      </svg>

      <div className="wheel-detail">
        {active ? (
          (() => {
            const s = SERVICES.find((x) => x.id === active);
            return (
              <>
                <span className="wheel-detail-season" style={{ color: seasonColor[s.season] }}>{s.season} · {s.cadence}</span>
                <h3>{s.name}</h3>
                <p>{s.why}</p>
              </>
            );
          })()
        ) : (
          <>
            <span className="wheel-detail-season">Hover a point</span>
            <h3>Your home, on its own rhythm</h3>
            <p>Every service has a season it actually belongs in. We schedule around what your home needs, not an arbitrary monthly visit.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState(new Set(['roof', 'gutter', 'house-wash']));
  const [scrolled, setScrolled] = useState(false);
  const [sizeBand, setSizeBand] = useState('medium');
  const [storeys, setStoreys] = useState(1);
  const [hvacOutlets, setHvacOutlets] = useState(1);
  const [spaSize, setSpaSize] = useState('medium');
  const [frequencyByService, setFrequencyByService] = useState({
    roof: 'annual',
    gutter: 'annual',
    'house-wash': 'annual',
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setFrequencyByService((m) => {
          const next2 = { ...m };
          delete next2[id];
          return next2;
        });
      } else {
        next.add(id);
        setFrequencyByService((m) => ({ ...m, [id]: 'annual' }));
      }
      return next;
    });
  };

  const setFrequency = (id, freqId) => {
    setFrequencyByService((m) => ({ ...m, [id]: freqId }));
  };

  const quote = calculateQuote({ selected, sizeBand, storeys, hvacOutlets, spaSize, frequencyByService });
  const total = quote.total;
  const hasHvac = selected.has('hvac');
  const hasSpa = selected.has('spa');

  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');

        :root {
          --stone: #EDE8E0;
          --paper: #FCFBF8;
          --ink: #26302A;
          --clay: #B5603F;
          --clay-dark: #9A4E32;
          --sage: #A8B5A0;
          --line: #D9D2C2;
        }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }
        .page {
          font-family: 'Inter', sans-serif;
          background: var(--paper);
          color: var(--ink);
          overflow-x: hidden;
        }
        h1, h2, h3, .display {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          letter-spacing: -0.01em;
          margin: 0;
        }
        a { color: inherit; }

        /* NAV */
        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 22px 6vw;
          transition: background 0.3s ease, box-shadow 0.3s ease, padding 0.3s ease;
        }
        .nav.scrolled {
          background: rgba(252, 251, 248, 0.92);
          backdrop-filter: blur(8px);
          box-shadow: 0 1px 0 var(--line);
          padding: 14px 6vw;
        }
        .nav-logo {
          font-family: 'Fraunces', serif;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .nav-links {
          display: flex;
          gap: 32px;
          font-size: 14px;
          font-weight: 500;
          list-style: none;
        }
        .nav-links li { cursor: pointer; opacity: 0.75; transition: opacity 0.2s; }
        .nav-links li:hover { opacity: 1; }
        .nav-cta {
          background: var(--ink);
          color: var(--paper);
          padding: 10px 22px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }

        /* HERO */
        .hero {
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
          padding: 64px 6vw 40px;
          max-width: 1320px;
          margin: 0 auto;
        }
        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--clay-dark);
          margin-bottom: 18px;
        }
        .hero-eyebrow::before {
          content: '';
          width: 18px;
          height: 1px;
          background: var(--clay-dark);
        }
        .hero h1 {
          font-size: clamp(40px, 6vw, 72px);
          line-height: 1.03;
          max-width: 16ch;
        }
        .hero h1 em {
          font-style: italic;
          color: var(--clay);
        }
        .hero-sub {
          margin-top: 22px;
          font-size: 19px;
          line-height: 1.55;
          max-width: 46ch;
          color: #4A5048;
        }
        .hero-ctas {
          margin-top: 34px;
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }
        .btn-primary {
          background: var(--clay);
          color: var(--paper);
          padding: 16px 30px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 16px;
          border: none;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .btn-primary:hover { background: var(--clay-dark); transform: translateY(-1px); }
        .btn-secondary {
          font-weight: 600;
          font-size: 15px;
          padding: 16px 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          color: var(--ink);
        }

        /* seasonal wheel */
        .wheel-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }
        .wheel-svg {
          width: 100%;
          max-width: 480px;
          height: auto;
          display: block;
          overflow: visible;
        }
        .wheel-season-label {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .wheel-center-title {
          font-family: 'Fraunces', serif;
          font-size: 26px;
          font-weight: 600;
        }
        .wheel-center-sub {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
        }
        .wheel-node circle { transition: r 0.15s ease; }
        .wheel-detail {
          margin-top: 8px;
          text-align: center;
          max-width: 380px;
          min-height: 96px;
        }
        .wheel-detail-season {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #8A8576;
        }
        .wheel-detail h3 {
          font-size: 19px;
          margin: 8px 0 6px;
        }
        .wheel-detail p {
          font-size: 14.5px;
          line-height: 1.55;
          color: #4A5048;
          margin: 0;
        }

        /* HERO PREVIEW (simple two-call card) */
        .hero-price-card {
          background: var(--ink);
          color: var(--paper);
          border-radius: 22px;
          padding: 36px 32px;
          box-shadow: 0 20px 60px -28px rgba(38,48,42,0.35);
        }
        .hero-price-label {
          font-size: 13px;
          opacity: 0.65;
          font-weight: 500;
          display: block;
        }
        .hero-price-amount {
          font-family: 'Fraunces', serif;
          font-size: 56px;
          margin: 10px 0 22px;
        }
        .hero-price-amount span {
          font-size: 18px;
          opacity: 0.7;
        }
        .hero-price-services {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,0.14);
        }
        .hero-price-empty {
          font-size: 13px;
          opacity: 0.6;
        }
        .hero-price-chip {
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 500;
        }
        .hero-price-chip-count {
          opacity: 0.6;
          font-size: 12px;
        }

        /* CALL PICKER */
        .picker-label {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #8A8576;
          margin-bottom: 14px;
          display: block;
        }
        .card-season-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--line);
        }
        .mini-pill {
          border: 1.5px solid var(--line);
          background: var(--paper);
          border-radius: 999px;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          color: var(--ink);
          transition: all 0.15s;
        }
        .mini-pill.active {
          background: var(--clay);
          border-color: var(--clay);
          color: var(--paper);
        }

        /* TICKER */
        .ticker-wrap {
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          padding: 18px 0;
          overflow: hidden;
          background: var(--stone);
        }
        .ticker {
          display: flex;
          gap: 56px;
          white-space: nowrap;
          animation: scroll 26s linear infinite;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.03em;
        }
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        /* SECTION generic */
        .section {
          padding: 110px 6vw;
          max-width: 1320px;
          margin: 0 auto;
        }
        .section-head {
          max-width: 640px;
          margin-bottom: 56px;
        }
        .section-eyebrow {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--clay-dark);
          margin-bottom: 14px;
          display: block;
        }
        .section h2 {
          font-size: clamp(30px, 4vw, 44px);
          line-height: 1.1;
        }
        .section-sub {
          margin-top: 16px;
          font-size: 17px;
          color: #4A5048;
          line-height: 1.6;
        }

        /* PROBLEM / felt section */
        .felt-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
        }
        .felt-card {
          background: var(--stone);
          border-radius: 18px;
          padding: 32px 28px;
        }
        .felt-card .num {
          font-family: 'Fraunces', serif;
          font-size: 15px;
          color: var(--clay-dark);
          margin-bottom: 18px;
          display: block;
        }
        .felt-card p {
          font-size: 17px;
          line-height: 1.55;
          margin: 0;
        }

        /* PROPERTY FORM */
        .property-form {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 24px;
          background: var(--stone);
          border-radius: 18px;
          padding: 28px 30px;
          margin-bottom: 40px;
        }
        .property-field label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .pill-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pill {
          border: 1.5px solid var(--line);
          background: var(--paper);
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          color: var(--ink);
        }
        .pill.active {
          background: var(--ink);
          border-color: var(--ink);
          color: var(--paper);
        }
        .property-hint {
          display: block;
          font-size: 12.5px;
          color: #8A8576;
          margin-top: 10px;
          line-height: 1.4;
        }

        /* SERVICES PICKER */
        .picker {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 56px;
          align-items: start;
        }
        .service-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .service-card {
          border: 1.5px solid var(--line);
          border-radius: 14px;
          padding: 20px 20px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, transform 0.15s;
          background: var(--paper);
          position: relative;
        }
        .service-card:hover { transform: translateY(-2px); }
        .service-card.active {
          border-color: var(--clay);
          background: #FBF1EC;
        }
        .service-card .tag {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #8A8576;
          font-weight: 600;
        }
        .service-card .name {
          font-size: 16px;
          font-weight: 600;
          margin-top: 6px;
        }
        .service-card .check {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1.5px solid #C9C2B2;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          transition: all 0.2s;
        }
        .service-card.active .check {
          background: var(--clay);
          border-color: var(--clay);
          color: white;
        }

        .price-panel {
          background: var(--ink);
          color: var(--paper);
          border-radius: 22px;
          padding: 38px 34px;
          position: sticky;
          top: 100px;
        }
        .price-panel .label { font-size: 13px; opacity: 0.65; font-weight: 500; }
        .price-panel .amount {
          font-family: 'Fraunces', serif;
          font-size: 56px;
          margin: 10px 0 4px;
        }
        .price-panel .amount span { font-size: 18px; opacity: 0.7; }
        .price-panel ul { list-style: none; padding: 0; margin: 26px 0; }
        .price-panel li {
          padding: 10px 0;
          border-top: 1px solid rgba(255,255,255,0.12);
          font-size: 14px;
          display: flex;
          justify-content: space-between;
        }
        .price-panel .btn-primary { width: 100%; margin-top: 10px; }

        /* HOW IT WORKS */
        .steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
        }
        .step {
          padding: 0 24px 0 0;
          border-left: 1px solid var(--line);
          padding-left: 24px;
        }
        .step:first-child { border-left: none; padding-left: 0; }
        .step .stepnum {
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-size: 15px;
          color: var(--clay-dark);
        }
        .step h3 { font-size: 19px; margin: 14px 0 10px; }
        .step p { font-size: 15px; line-height: 1.55; color: #4A5048; margin: 0; }

        /* TRUST band */
        .trust {
          background: var(--stone);
        }
        .trust-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
        }
        .trust-item h3 { font-size: 20px; margin-bottom: 10px; }
        .trust-item p { font-size: 15.5px; line-height: 1.6; color: #4A5048; margin: 0; }
        .trust-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: var(--paper);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
          font-size: 20px;
        }

        /* FINAL CTA */
        .final-cta {
          background: var(--ink);
          color: var(--paper);
          border-radius: 28px;
          margin: 0 6vw 110px;
          padding: 90px 6vw;
          text-align: center;
        }
        .final-cta h2 { color: var(--paper); font-size: clamp(32px, 5vw, 50px); max-width: 18ch; margin: 0 auto; }
        .final-cta p { color: rgba(252,251,248,0.7); margin: 20px auto 36px; max-width: 44ch; font-size: 17px; }

        footer {
          padding: 50px 6vw;
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #8A8576;
          border-top: 1px solid var(--line);
        }

        @media (max-width: 900px) {
          .nav-links { display: none; }
          .felt-grid, .picker, .steps, .trust-grid { grid-template-columns: 1fr; }
          .service-grid { grid-template-columns: 1fr 1fr; }
          .price-panel { position: static; }
          .step { border-left: none; padding-left: 0; border-top: 1px solid var(--line); padding-top: 20px; margin-top: 20px; }
          .step:first-child { border-top: none; margin-top: 0; padding-top: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">HomeTend.</div>
        <ul className="nav-links">
          <li>Services</li>
          <li>How it works</li>
          <li>Pricing</li>
          <li>About</li>
        </ul>
        <button className="nav-cta">Get started</button>
      </nav>

      {/* HERO */}
      <section className="hero">
        <Reveal>
          <span className="hero-eyebrow">Your home, tended to on its own seasons</span>
          <h1>Your home is your biggest asset. <em>It deserves tending to.</em></h1>
          <p className="hero-sub">
            Choose what your home needs and which seasons it happens in. One flat monthly fee, smoothed evenly across the year — updates instantly as you build your plan below.
          </p>
          <div className="hero-ctas">
            <button className="btn-primary">Build your plan</button>
            <button className="btn-secondary">See how it works →</button>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="hero-price-card">
            <span className="hero-price-label">Your monthly plan, live</span>
            <div className="hero-price-amount">${total}<span> / mo</span></div>
            <div className="hero-price-services">
              {[...selected].length === 0 && (
                <span className="hero-price-empty">Pick services below to see your price</span>
              )}
              {[...selected].map((id) => {
                const s = SERVICES.find((sv) => sv.id === id);
                const freqId = frequencyByService[id] || 'annual';
                const freq = FREQUENCIES.find((f) => f.id === freqId);
                return (
                  <span key={id} className="hero-price-chip">
                    {s?.name} <span className="hero-price-chip-count">{freq?.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </Reveal>
      </section>

      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker">
          {Array(2).fill(0).map((_, i) => (
            <React.Fragment key={i}>
              <span>HOUSE WASH</span>
              <span>·</span>
              <span>ROOF & MOULD</span>
              <span>·</span>
              <span>GUTTERS</span>
              <span>·</span>
              <span>HVAC</span>
              <span>·</span>
              <span>WINDOWS</span>
              <span>·</span>
              <span>DRIVEWAY</span>
              <span>·</span>
              <span>SPA POOL</span>
              <span>·</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* FELT PROBLEM */}
      <section className="section">
        <Reveal>
          <div className="section-head">
            <span className="section-eyebrow">Why this exists</span>
            <h2>Your home holds its value when it's looked after consistently — not fixed up occasionally.</h2>
          </div>
        </Reveal>
        <div className="felt-grid">
          {[
            { n: '01', t: 'A home that\'s tended to, season after season, simply holds its value better than one that isn\'t.' },
            { n: '02', t: 'Most home services are one-off and reactive — called in only once something\'s already gone wrong.' },
            { n: '03', t: 'One flat monthly plan, smoothed across the year — the work happens on your home\'s schedule, not an arbitrary one.' },
          ].map((c, i) => (
            <Reveal key={c.n} delay={i * 100}>
              <div className="felt-card">
                <span className="num">{c.n}</span>
                <p>{c.t}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SERVICE PICKER */}
      <section className="section" id="services">
        <Reveal>
          <div className="section-head">
            <span className="section-eyebrow">Build your plan</span>
            <h2>Choose your services. Choose your seasons.</h2>
            <p className="section-sub">Most services run twice a year — pick which two seasons suit your home. Add a third or fourth if you'd rather it happen more often.</p>
          </div>
        </Reveal>

        <Reveal>
          <div className="property-form">
            <div className="property-field">
              <label>Property size</label>
              <div className="pill-group">
                {SIZE_BANDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`pill ${sizeBand === b.id ? 'active' : ''}`}
                    onClick={() => setSizeBand(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <span className="property-hint">{SIZE_BANDS.find((b) => b.id === sizeBand)?.hint}</span>
            </div>
            <div className="property-field">
              <label>Storeys</label>
              <div className="pill-group">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`pill ${storeys === n ? 'active' : ''}`}
                    onClick={() => setStoreys(n)}
                  >
                    {n}{n === 3 ? '+' : ''}
                  </button>
                ))}
              </div>
              <span className="property-hint">Taller homes take a little longer to work on safely.</span>
            </div>
            {hasHvac && (
              <div className="property-field">
                <label>HVAC outlets / units</label>
                <div className="pill-group">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`pill ${hvacOutlets === n ? 'active' : ''}`}
                      onClick={() => setHvacOutlets(n)}
                    >
                      {n}{n === 4 ? '+' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {hasSpa && (
              <div className="property-field">
                <label>Spa pool size</label>
                <div className="pill-group">
                  {[{ id: 'small', l: 'Small' }, { id: 'medium', l: 'Medium' }, { id: 'large', l: 'Large' }].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`pill ${spaSize === s.id ? 'active' : ''}`}
                      onClick={() => setSpaSize(s.id)}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Reveal>

        <div className="picker">
          <Reveal>
            <span className="picker-label">All services — tap to add, then choose how often</span>
            <div className="service-grid">
              {SERVICES.map((s) => {
                const isActive = selected.has(s.id);
                const allowed = allowedFrequencies(s.id);
                const currentFreq = frequencyByService[s.id] || 'annual';
                return (
                  <div
                    key={s.id}
                    className={`service-card ${isActive ? 'active' : ''}`}
                  >
                    <div onClick={() => toggle(s.id)} style={{ cursor: 'pointer' }}>
                      <span className="tag">Up to {allowed[allowed.length - 1].label.toLowerCase()}</span>
                      <div className="name">{s.name}</div>
                      <div className="check">{isActive ? '✓' : ''}</div>
                    </div>
                    {isActive && (
                      <div className="card-season-pills" onClick={(e) => e.stopPropagation()}>
                        {allowed.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className={`mini-pill ${currentFreq === f.id ? 'active' : ''}`}
                            onClick={() => setFrequency(s.id, f.id)}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="price-panel">
              <span className="label">Plan breakdown</span>
              <div className="amount" style={{ fontSize: 32, margin: '10px 0 18px' }}>${total}<span style={{ fontSize: 14 }}> / mo</span></div>
              <p style={{ fontSize: 13, opacity: 0.65, margin: '0 0 18px', lineHeight: 1.5 }}>
                Billed evenly all year. Visits scheduled by season, not by calendar month.
              </p>
              <ul>
                {quote.breakdown.map(({ id, amount, seasonCount }) => (
                  <li key={id}>
                    <span>{SERVICES.find((s) => s.id === id)?.name} <span style={{ opacity: 0.5 }}>×{seasonCount}</span></span>
                    <span>${amount}</span>
                  </li>
                ))}
                {quote.calloutBase > 0 && (
                  <li>
                    <span>Plan administration</span>
                    <span>${quote.calloutBase}</span>
                  </li>
                )}
                {selected.size === 0 && <li style={{ opacity: 0.6 }}>Pick a service to begin</li>}
              </ul>
              <button className="btn-primary">Lock in this plan</button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section">
        <Reveal>
          <div className="section-head">
            <span className="section-eyebrow">How it works</span>
            <h2>Set it once. It runs itself.</h2>
          </div>
        </Reveal>
        <div className="steps">
          {[
            { t: 'Pick your plan', d: 'Choose your services. We place each one in the season it actually belongs to.' },
            { t: 'It\'s billed evenly', d: 'One flat fee every month, all year — not a lump sum twice a year.' },
            { t: 'We schedule by season', d: 'Visits land when your home needs them — gutters before storms, windows in spring.' },
            { t: 'You get proof', d: 'A photo and a short note land in your inbox the moment each visit\'s done.' },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 90}>
              <div className="step">
                <span className="stepnum">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section className="trust">
        <div className="section">
          <Reveal>
            <div className="section-head">
              <span className="section-eyebrow">Why people stay</span>
              <h2>Young crew. A properly run operation.</h2>
            </div>
          </Reveal>
          <div className="trust-grid">
            {[
              { icon: '✓', t: 'Same crew, every visit', d: 'You\'re not getting a stranger each time — you get a consistent, vetted team who know your property.' },
              { icon: '✉', t: 'Proof, not promises', d: 'Every visit ends with a photo and a note. If something looks off, we flag it before you ever have to ask.' },
              { icon: '↻', t: 'We service your street, not just your house', d: 'When we\'re already in your neighbourhood for a job, your home\'s on the list — which is how a fair monthly price works.' },
            ].map((item, i) => (
              <Reveal key={item.t} delay={i * 100}>
                <div className="trust-item">
                  <div className="trust-icon">{item.icon}</div>
                  <h3>{item.t}</h3>
                  <p>{item.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <Reveal>
        <div className="final-cta">
          <h2>Give your home the attention it's worth.</h2>
          <p>Build a plan in under two minutes. One monthly fee, your home tended to on its own seasons.</p>
          <button className="btn-primary">Build your plan</button>
        </div>
      </Reveal>

      <footer>
        <span>HomeTend. © 2026</span>
        <span>Auckland & beyond</span>
      </footer>
    </div>
  );
}
