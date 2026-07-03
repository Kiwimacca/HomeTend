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
  { id: 'windows', name: 'Window Clean', why: 'The clean that actually happens, on schedule, without you doing it.', angle: 135, maxFrequency: 'quarterly' },
  { id: 'driveway', name: 'Driveway Clean', why: 'Oil, moss and stains lifted before they set into the concrete.', angle: 180, maxFrequency: 'twice-yearly' },
  { id: 'hvac', name: 'HVAC Maintenance', why: 'Checked and filtered regularly so it never has to work harder than it should.', angle: 225, maxFrequency: 'quarterly' },
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
  { id: 'small', label: 'Small', hint: 'Compact home or townhouse', multiplier: 0.8 },
  { id: 'medium', label: 'Medium', hint: 'Average standalone home', multiplier: 1.0 },
  { id: 'large', label: 'Large', hint: 'Larger home or bigger section', multiplier: 1.3 },
];

const BEDROOM_BANDS = [
  { id: '1-2', label: '1–2', multiplier: 0.85 },
  { id: '3', label: '3', multiplier: 1.0 },
  { id: '4+', label: '4+', multiplier: 1.2 },
];

// Per-service bedroom sensitivity — how much bedroom count shifts the price.
// Services tied to interior/window count are more bedroom-sensitive than
// exterior footprint services (roof, driveway) which are more size-sensitive.
const BEDROOM_SENSITIVITY = {
  'house-wash': 0.3,
  'roof': 0.2,
  'gutter': 0.2,
  'windows': 0.7,
  'driveway': 0.2,
  'hvac': 0.6,
  'spa': 0.0,
  'spider': 0.4,
};

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

function calculateQuote({ selected, sizeBand, bedrooms, storeys, hvacOutlets, frequencyByService }) {
  const band = SIZE_BANDS.find((b) => b.id === sizeBand) || SIZE_BANDS[1];
  const bedroomBand = BEDROOM_BANDS.find((b) => b.id === bedrooms) || BEDROOM_BANDS[1];
  let total = 0;
  const breakdown = [];

  selected.forEach((id) => {
    const rate = SERVICE_RATES[id] || 15;
    const freqId = frequencyByService?.[id] || 'annual';
    const freq = FREQUENCIES.find((f) => f.id === freqId) || FREQUENCIES[0];
    const visitCount = freq.visitsPerYear;

    const sens = BEDROOM_SENSITIVITY[id] ?? 0.3;
    const blendedMultiplier = band.multiplier * (1 - sens) + (band.multiplier * bedroomBand.multiplier) * sens;

    let line = rate * visitCount * blendedMultiplier;

    if (isExterior(id) && storeys >= 2) {
      line += STOREY_SURCHARGE[storeys] || 0;
    }

    if (id === 'hvac') {
      const extraOutlets = Math.max(0, (hvacOutlets || 1) - 1);
      line += extraOutlets * 9;
    }

    line = Math.round(line);
    breakdown.push({ id, amount: line, seasonCount: visitCount });
    total += line;
  });

  return { total: Math.round(total), breakdown };
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

const TESTIMONIALS = [
  { name: 'Sarah M.', suburb: 'Fendalton', stars: 5, text: 'I honestly didn\'t realise how much mental energy I was spending worrying about the gutters, the moss on the roof, all of it. HomeTend just made it disappear. The photo after each visit is such a small thing but it means so much.' },
  { name: 'Rachel T.', suburb: 'Merivale', stars: 5, text: 'The crew turned up exactly when they said they would, did an incredible job on the house wash and driveway, and left everything spotless. First time I\'ve had tradespeople I didn\'t have to chase. Worth every cent.' },
  { name: 'Donna K.', suburb: 'St Albans', stars: 5, text: 'I was a bit sceptical at first — a subscription for home maintenance felt unusual. But after the first visit I was completely sold. They noticed a loose gutter bracket I hadn\'t even seen and flagged it before it became a problem. That\'s the difference.' },
  { name: 'Jo W.', suburb: 'Sumner', stars: 5, text: 'Managing the house on my own after my separation was overwhelming. HomeTend genuinely took one big thing off my plate. The windows look amazing, the roof is clear, and I didn\'t have to organise a thing.' },
  { name: 'Amanda B.', suburb: 'Halswell', stars: 5, text: 'Reliable, professional, and the boys are lovely. Never felt uncomfortable having them around the property. My neighbour noticed how good the place looked and asked for their number.' },
  { name: 'Lisa F.', suburb: 'Riccarton', stars: 5, text: 'Set it up in about two minutes online, got a confirmation text the same day, and they were here the following week. The HVAC hasn\'t run this quietly in years. Genuinely impressed.' },
];

function TestimonialCarousel() {
  const [idx, setIdx] = useState(0);
  const total = TESTIMONIALS.length;

  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % total), 5000);
    return () => clearInterval(timer);
  }, [total]);

  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);
  const t = TESTIMONIALS[idx];

  return (
    <section className="carousel-section">
      <div className="carousel-inner">
        <div className="carousel-stars">{'★'.repeat(t.stars)}</div>
        <blockquote className="carousel-quote">"{t.text}"</blockquote>
        <div className="carousel-author">{t.name} · {t.suburb}</div>
        <div className="carousel-controls">
          <button className="carousel-btn" onClick={prev}>←</button>
          <div className="carousel-dots">
            {TESTIMONIALS.map((_, i) => (
              <button key={i} className={`carousel-dot ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)} />
            ))}
          </div>
          <button className="carousel-btn" onClick={next}>→</button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [selected, setSelected] = useState(new Set(['roof', 'gutter', 'house-wash']));
  const [scrolled, setScrolled] = useState(false);
  const [sizeBand, setSizeBand] = useState('medium');
  const [bedrooms, setBedrooms] = useState('3');
  const [storeys, setStoreys] = useState(1);
  const [hvacOutlets, setHvacOutlets] = useState(1);
  const [activeTab, setActiveTab] = useState(null);
  const [frequencyByService, setFrequencyByService] = useState({
    roof: 'annual',
    gutter: 'annual',
    'house-wash': 'annual',
  });
  const tabPanelRef = useRef(null);

  const openTab = (id) => {
    setActiveTab((prev) => {
      const next = prev === id ? null : id;
      if (next) setTimeout(() => tabPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      return next;
    });
  };

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

  const quote = calculateQuote({ selected, sizeBand, bedrooms, storeys, hvacOutlets, frequencyByService });
  const total = quote.total;
  const hasHvac = selected.has('hvac');

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

        /* ABOVE FOLD */
        .above-fold {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 40px;
          padding: 40px 6vw 60px;
          max-width: 1320px;
          margin: 0 auto;
          align-items: start;
        }
        .fold-headline {
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1.1;
          margin: 0 0 28px;
        }
        .fold-headline em {
          font-style: italic;
          color: var(--clay);
        }
        .fold-inputs {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .fold-input-group label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #8A8576;
          margin-bottom: 8px;
        }
        .fold-services-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 24px;
        }
        .fold-services-col {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(181,96,63,0.7); }
          70% { box-shadow: 0 0 0 7px rgba(181,96,63,0); }
          100% { box-shadow: 0 0 0 0 rgba(181,96,63,0); }
        }
        .fold-service-row {
          border-radius: 10px;
          padding: 6px 10px;
          background: var(--stone);
        }
        .fold-service-row.active {
          background: var(--stone);
        }
        .fold-service-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          background: none;
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: left;
          padding: 0;
        }
        .fold-check {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid var(--clay);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
          transition: all 0.15s;
          color: var(--clay);
          background: rgba(181,96,63,0.08);
          animation: pulse-ring 2s ease-out infinite;
        }
        .fold-check.checked {
          background: var(--clay);
          border-color: var(--clay);
          color: white;
          animation: none;
        }
        .fold-service-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
        }
        .fold-freq-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 6px;
          margin-left: 30px;
        }
        .fold-addon {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 5px;
          margin-left: 30px;
          font-size: 12px;
          color: #8A8576;
          font-weight: 600;
        }

        /* FOLD PRICE CARD */
        .fold-right {
          position: sticky;
          top: 80px;
        }
        .fold-price-card {
          background: var(--ink);
          color: var(--paper);
          border-radius: 22px;
          padding: 32px 28px;
          box-shadow: 0 20px 60px -24px rgba(38,48,42,0.35);
        }
        .fold-price-label {
          font-size: 12px;
          opacity: 0.6;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          display: block;
        }
        .fold-price-amount {
          font-family: 'Fraunces', serif;
          font-size: 52px;
          margin: 8px 0 4px;
          line-height: 1;
        }
        .fold-price-amount span { font-size: 16px; opacity: 0.65; }
        .fold-price-empty-state {
          font-size: 14px;
          opacity: 0.55;
          padding: 20px 0;
          text-align: center;
        }
        .fold-price-row-hero {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 14px 0 10px;
        }
        .fold-price-block {
          flex: 1;
          background: rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .fold-price-block-label {
          display: block;
          font-size: 11px;
          opacity: 0.6;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .fold-price-block-amount {
          font-family: 'Fraunces', serif;
          font-size: 28px;
          font-weight: 500;
          line-height: 1;
        }
        .fold-price-block-mo { font-size: 14px; opacity: 0.65; }
        .fold-price-divider {
          font-size: 12px;
          opacity: 0.5;
          font-weight: 600;
          flex-shrink: 0;
        }
        .fold-price-yr2 {
          font-size: 12.5px;
          opacity: 0.7;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          line-height: 1.5;
        }
        .fold-price-yr2 strong { opacity: 1; }
        .fold-price-note {
          font-size: 12px;
          opacity: 0.55;
          margin-bottom: 20px;
        }
        .fold-price-list {
          list-style: none;
          padding: 0;
          margin: 0 0 4px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .fold-price-list li {
          display: flex;
          justify-content: space-between;
          padding: 9px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          font-size: 13px;
        }
        .fold-price-freq { opacity: 0.5; font-size: 12px; }
        .fold-price-empty { opacity: 0.5; justify-content: center !important; }

        @media (max-width: 900px) {
          .above-fold { grid-template-columns: 1fr; }
          .fold-right { position: static; }
          .fold-services-grid { grid-template-columns: 1fr; }
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
        /* PAYMENT NOTE */
        .payment-note {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          background: var(--stone);
          border-radius: 14px;
          padding: 20px 24px;
          margin-top: 40px;
          font-size: 15px;
          line-height: 1.6;
          color: #4A5048;
        }
        .payment-note-icon { font-size: 20px; margin-top: 2px; }
        .payment-note strong { color: var(--ink); }

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

        /* FOLD CAROUSEL (right column version) */
        .fold-carousel {
          margin-top: 16px;
        }
        .fold-carousel .carousel-section {
          border-radius: 18px;
          padding: 28px 24px;
        }
        .fold-carousel .carousel-quote {
          font-size: 14.5px;
        }
        .fold-carousel .carousel-stars {
          font-size: 16px;
          margin-bottom: 12px;
        }
        .fold-carousel .carousel-author {
          margin-bottom: 16px;
        }

        /* NAV active tab */
        .nav-links li.active { opacity: 1; }

        /* CAROUSEL */
        .carousel-section {
          background: var(--ink);
          padding: 56px 6vw;
        }
        .carousel-inner {
          max-width: 720px;
          margin: 0 auto;
          text-align: center;
        }
        .carousel-stars {
          color: var(--clay);
          font-size: 22px;
          letter-spacing: 3px;
          margin-bottom: 20px;
        }
        .carousel-quote {
          font-family: 'Fraunces', serif;
          font-size: clamp(17px, 2.5vw, 22px);
          font-style: italic;
          color: var(--paper);
          line-height: 1.55;
          margin: 0 0 20px;
          font-weight: 400;
        }
        .carousel-author {
          font-size: 13px;
          color: var(--sage);
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 28px;
        }
        .carousel-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }
        .carousel-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: var(--paper);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          transition: background 0.2s;
        }
        .carousel-btn:hover { background: rgba(255,255,255,0.2); }
        .carousel-dots {
          display: flex;
          gap: 8px;
        }
        .carousel-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.3);
          cursor: pointer;
          transition: background 0.2s;
          padding: 0;
        }
        .carousel-dot.active { background: var(--clay); }

        /* TAB PANELS */
        .tab-panel {
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

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
        <div className="nav-logo" onClick={() => setActiveTab(null)} style={{cursor:'pointer'}}>HomeTend.</div>
        <ul className="nav-links">
          {[
            { id: 'how', label: 'How it works' },
            { id: 'why', label: 'Why HomeTend' },
            { id: 'about', label: 'About' },
          ].map((tab) => (
            <li key={tab.id}
              style={{ opacity: activeTab === tab.id ? 1 : 0.7, borderBottom: activeTab === tab.id ? '2px solid var(--clay)' : '2px solid transparent', paddingBottom: 2 }}
              onClick={() => openTab(tab.id)}
            >{tab.label}</li>
          ))}
        </ul>
        <button className="nav-cta" onClick={() => setActiveTab(null)}>Build my plan</button>
      </nav>

      {/* ABOVE-FOLD PRODUCT SECTION */}
      <section className="above-fold">
        {/* Left: headline + configurator */}
        <div className="fold-left">
          <h1 className="fold-headline">Your home is your biggest asset,<br/><em>let us tend to your maintenance needs.</em></h1>

          {/* Property inputs */}
          <div className="fold-inputs">
            <div className="fold-input-group">
              <label>Property size</label>
              <div className="pill-group">
                {SIZE_BANDS.map((b) => (
                  <button key={b.id} type="button"
                    className={`pill ${sizeBand === b.id ? 'active' : ''}`}
                    onClick={() => setSizeBand(b.id)}
                    title={b.hint}
                  >{b.label}</button>
                ))}
              </div>
            </div>
            <div className="fold-input-group">
              <label>Bedrooms</label>
              <div className="pill-group">
                {BEDROOM_BANDS.map((b) => (
                  <button key={b.id} type="button"
                    className={`pill ${bedrooms === b.id ? 'active' : ''}`}
                    onClick={() => setBedrooms(b.id)}
                  >{b.label}</button>
                ))}
              </div>
            </div>
            <div className="fold-input-group">
              <label>Storeys</label>
              <div className="pill-group">
                {[1,2,3].map((n) => (
                  <button key={n} type="button"
                    className={`pill ${storeys === n ? 'active' : ''}`}
                    onClick={() => setStoreys(n)}
                  >{n}{n===3?'+':''}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Service list */}
          <div className="fold-services-grid">
            {[SERVICES.slice(0,4), SERVICES.slice(4,7)].map((col, ci) => (
              <div key={ci} className="fold-services-col">
                {col.map((s) => {
                  const isActive = selected.has(s.id);
                  const allowed = allowedFrequencies(s.id);
                  const currentFreq = frequencyByService[s.id] || 'annual';
                  return (
                    <div key={s.id} className={`fold-service-row ${isActive ? 'active' : ''}`}>
                      <button type="button" className="fold-service-toggle" onClick={() => toggle(s.id)}>
                        <span className={`fold-check ${isActive ? 'checked' : ''}`}>{isActive ? '✓' : '+'}</span>
                        <span className="fold-service-name">{s.name}</span>
                      </button>
                      {isActive && (
                        <div className="fold-freq-pills">
                          {allowed.map((f) => (
                            <button key={f.id} type="button"
                              className={`mini-pill ${currentFreq === f.id ? 'active' : ''}`}
                              onClick={() => setFrequency(s.id, f.id)}
                            >{f.label}</button>
                          ))}
                        </div>
                      )}
                      {isActive && s.id === 'hvac' && (
                        <div className="fold-addon">
                          <span>Units:</span>
                          {[1,2,3,4].map((n) => (
                            <button key={n} type="button"
                              className={`mini-pill ${hvacOutlets === n ? 'active' : ''}`}
                              onClick={() => setHvacOutlets(n)}
                            >{n}{n===4?'+':''}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right: live price */}
        <div className="fold-right">
          <div className="fold-price-card">
            <span className="fold-price-label">Your plan — live</span>
            {selected.size === 0 ? (
              <div className="fold-price-empty-state">Select services to see your quote</div>
            ) : (
              <>
                <div className="fold-price-row-hero">
                  <div className="fold-price-block">
                    <span className="fold-price-block-label">Pay today</span>
                    <span className="fold-price-block-amount">${Math.round(total * 12 * 0.5)}</span>
                  </div>
                  <div className="fold-price-divider">then</div>
                  <div className="fold-price-block">
                    <span className="fold-price-block-label">Per month · year one</span>
                    <span className="fold-price-block-amount">${Math.round((total * 12 * 0.5) / 11)}<span className="fold-price-block-mo">/mo</span></span>
                  </div>
                </div>
                <div className="fold-price-yr2">
                  From year two: <strong>${total}/mo</strong> — or renew on the same deposit structure.
                </div>
                <ul className="fold-price-list">
                  {quote.breakdown.map(({ id, amount }) => {
                    const s = SERVICES.find((sv) => sv.id === id);
                    const freqId = frequencyByService[id] || 'annual';
                    const freq = FREQUENCIES.find((f) => f.id === freqId);
                    return (
                      <li key={id}>
                        <span>{s?.name} <span className="fold-price-freq">· {freq?.label}</span></span>
                        <span>${amount}/mo</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <button className="btn-primary" style={{width:'100%',marginTop:16}}>Lock in this plan</button>
          </div>

          {/* Carousel sits below price card in right column */}
          <div className="fold-carousel">
            <TestimonialCarousel />
          </div>
        </div>
      </section>

      {/* TAB PANELS */}
      <div ref={tabPanelRef}>
      {activeTab === 'how' && (
        <section className="tab-panel section">
          <Reveal>
            <div className="section-head">
              <span className="section-eyebrow">How it works</span>
              <h2>A well-tended home costs less to own.</h2>
              <p className="section-sub">The average Kiwi homeowner spends $3,000–$5,000 a year on home maintenance — most of it unplanned, reactive, and more expensive than it needed to be. HomeTend changes that.</p>
            </div>
          </Reveal>
          <div className="steps">
            {[
              { t: 'Build your plan', d: 'Select the services your home needs and how often. Your quote updates instantly — upfront amount and monthly instalments shown live.' },
              { t: 'Sign your Service Agreement', d: 'Takes two minutes. A 50% deposit secures your plan, with the remaining 50% split across 11 equal monthly payments. No surprises in the fine print.' },
              { t: 'We schedule your visits', d: 'Your crew books in and texts you the date. Visits land when your home actually needs them — gutters before the storms, windows in spring.' },
              { t: 'Proof, every time', d: 'A photo and a short note land in your inbox the moment each visit is done. If we notice anything else worth flagging, we will.' },
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
          <Reveal>
            <div className="payment-note">
              <span className="payment-note-icon">💳</span>
              <div>
                <strong>Year one:</strong> 50% deposit on sign-up, remaining 50% across 11 equal monthly payments.
                {' '}<strong>Year two onwards:</strong> your choice — continue on 12 equal monthly direct debits, or renew with a fresh 50% deposit and lower monthly instalments. We'll remind you six weeks before your anniversary so there are no surprises.
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {activeTab === 'why' && (
        <section className="tab-panel">
          <div className="trust">
            <div className="section">
              <Reveal>
                <div className="section-head">
                  <span className="section-eyebrow">Why HomeTend</span>
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
          </div>
        </section>
      )}

      {activeTab === 'about' && (
        <section className="tab-panel section">
          <Reveal>
            <div className="section-head">
              <span className="section-eyebrow">About HomeTend</span>
              <h2>Built by someone who cares about getting it right.</h2>
              <p className="section-sub">HomeTend was started with one simple belief: homeowners deserve a reliable, professional service that shows up when it says it will, does the work properly, and keeps them in the loop without them having to chase anyone. We're not a franchise. We're not a directory. We're a small, systemised crew with high standards — and your home is in good hands.</p>
            </div>
          </Reveal>
          <div className="trust-grid">
            {[
              { icon: '📍', t: 'Based in Christchurch', d: 'We know the streets, the weather, and what Christchurch homes need — and when they need it.' },
              { icon: '🔒', t: 'Fully insured', d: 'Public liability insurance on every visit. Your home and your peace of mind are covered.' },
              { icon: '📱', t: 'AI-powered scheduling', d: 'Our systems handle the reminders, scheduling, and follow-ups automatically — so nothing falls through the cracks.' },
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
        </section>
      )}
      </div>

      <footer>
        <span>HomeTend. © 2026</span>
        <span>Christchurch, NZ</span>
      </footer>
    </div>
  );
}
