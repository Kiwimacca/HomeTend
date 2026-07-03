import React, { useState, useEffect, useRef } from 'react';

// ── REPLACE THIS with Finn's real Calendly link once his account is set up ──
const CALENDLY_URL = 'https://calendly.com/hometend-christchurch/house-wash';
// ────────────────────────────────────────────────────────────────────────────

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
// Pricing matrix — bedrooms and storeys determine size scaling.
// Property size removed — bedrooms is a more precise and customer-friendly proxy.
// Source ranges (one-off, NZD): house wash $239-295, roof moss/mould $250-600,
// gutter $100-300, windows (ext) $50-110, driveway $150-350, HVAC $80-200/unit,
// spider control $99-150.
const BEDROOM_BANDS = [
  { id: '1-2', label: '1–2', multiplier: 0.75 },
  { id: '3',   label: '3',   multiplier: 1.0  },
  { id: '4+',  label: '4+',  multiplier: 1.3  },
];

// Rate per single visit/year (monthly-equivalent, with ~12% reliability premium).
const SERVICE_RATES = {
  'house-wash': 25,
  'roof':       37,
  'gutter':     17,
  'windows':     8.5,
  'driveway':   20,
  'hvac':       13,
  'spider':     11,
};

const STOREY_SURCHARGE = { 1: 0, 2: 6, 3: 12 };

function isExterior(id) {
  return ['house-wash', 'roof', 'gutter', 'windows', 'driveway', 'spider'].includes(id);
}

function calculateQuote({ selected, bedrooms, storeys, hvacOutlets, frequencyByService }) {
  const bedroomBand = BEDROOM_BANDS.find((b) => b.id === bedrooms) || BEDROOM_BANDS[1];
  let total = 0;
  const breakdown = [];

  selected.forEach((id) => {
    const rate = SERVICE_RATES[id] || 15;
    const freqId = frequencyByService?.[id] || 'annual';
    const freq = FREQUENCIES.find((f) => f.id === freqId) || FREQUENCIES[0];
    const visitCount = freq.visitsPerYear;

    let line = rate * visitCount * bedroomBand.multiplier;

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

const JOBS = [
  {
    service: 'House Wash',
    location: 'Fendalton',
    time: '9:47 AM',
    date: 'Tue 14 Jan',
    review: { name: 'Sarah M.', stars: 5, text: 'HomeTend just made it disappear. The photo after each visit means so much.' },
    photo: (
      <svg viewBox="0 0 160 120" className="phone-photo">
        <defs>
          <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8DBE8"/><stop offset="100%" stopColor="#E8F0F5"/></linearGradient>
          <filter id="warm"><feColorMatrix type="matrix" values="1.1 0.05 0 0 0.02  0 1.0 0 0 0  0 0 0.9 0 0  0 0 0 1 0"/></filter>
        </defs>
        <rect width="160" height="120" fill="url(#sky1)"/>
        {/* lawn */}
        <rect y="85" width="160" height="35" fill="#7A9E6A"/>
        {/* driveway */}
        <polygon points="50,120 110,120 100,85 60,85" fill="#C8C0B0"/>
        {/* house body */}
        <rect x="20" y="45" width="120" height="45" fill="#F5F0E8"/>
        {/* roof */}
        <polygon points="10,45 80,12 150,45" fill="#6B5A4E"/>
        {/* windows gleaming */}
        <rect x="35" y="58" width="28" height="22" fill="#BFD8E8" opacity="0.9"/>
        <rect x="97" y="58" width="28" height="22" fill="#BFD8E8" opacity="0.9"/>
        <line x1="49" y1="58" x2="49" y2="80" stroke="white" strokeWidth="1.5" opacity="0.6"/>
        <line x1="35" y1="69" x2="63" y2="69" stroke="white" strokeWidth="1.5" opacity="0.6"/>
        <line x1="111" y1="58" x2="111" y2="80" stroke="white" strokeWidth="1.5" opacity="0.6"/>
        <line x1="97" y1="69" x2="125" y2="69" stroke="white" strokeWidth="1.5" opacity="0.6"/>
        {/* door */}
        <rect x="68" y="65" width="24" height="25" fill="#B5603F"/>
        {/* gutter highlight — clean */}
        <rect x="18" y="44" width="124" height="4" fill="#A8B5A0" opacity="0.8"/>
        {/* warm photo overlay */}
        <rect width="160" height="120" fill="#B5603F" opacity="0.06"/>
        {/* vignette */}
        <radialGradient id="vig1" cx="50%" cy="50%" r="70%"><stop offset="60%" stopColor="transparent"/><stop offset="100%" stopColor="rgba(0,0,0,0.3)"/></radialGradient>
        <rect width="160" height="120" fill="url(#vig1)"/>
      </svg>
    ),
  },
  {
    service: 'Gutter Clean',
    location: 'Merivale',
    time: '11:23 AM',
    date: 'Thu 23 Jan',
    review: { name: 'Rachel T.', stars: 5, text: 'First time I\'ve had tradespeople I didn\'t have to chase. Worth every cent.' },
    photo: (
      <svg viewBox="0 0 160 120" className="phone-photo">
        <defs><linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4E4EE"/><stop offset="100%" stopColor="#EBF2F7"/></linearGradient></defs>
        <rect width="160" height="120" fill="url(#sky2)"/>
        {/* close-up gutter angle shot */}
        {/* fascia board */}
        <rect x="0" y="28" width="160" height="18" fill="#E8E0D0"/>
        {/* gutter channel — clean */}
        <rect x="0" y="46" width="160" height="14" fill="#8A9E8A" rx="3"/>
        <rect x="2" y="48" width="156" height="10" fill="#A8B8A8" rx="2"/>
        {/* water droplet catching light — clean drain */}
        <ellipse cx="80" cy="53" rx="4" ry="2" fill="#BFD8E8" opacity="0.8"/>
        {/* roof tiles above */}
        <rect x="0" y="0" width="160" height="30" fill="#7A6A5E"/>
        {/* tile lines */}
        {[0,20,40,60,80,100,120,140].map(x => <line key={x} x1={x} y1="0" x2={x} y2="30" stroke="#6A5A4E" strokeWidth="1" opacity="0.5"/>)}
        {[0,10,20].map(y => <line key={y} x1="0" y1={y} x2="160" y2={y} stroke="#6A5A4E" strokeWidth="1" opacity="0.3"/>)}
        {/* downpipe */}
        <rect x="140" y="46" width="12" height="74" fill="#9AA89A"/>
        {/* subtle warmth */}
        <rect width="160" height="120" fill="#C8A860" opacity="0.05"/>
        <radialGradient id="vig2" cx="50%" cy="50%" r="70%"><stop offset="60%" stopColor="transparent"/><stop offset="100%" stopColor="rgba(0,0,0,0.25)"/></radialGradient>
        <rect width="160" height="120" fill="url(#vig2)"/>
      </svg>
    ),
  },
  {
    service: 'Roof Wash',
    location: 'St Albans',
    time: '2:15 PM',
    date: 'Fri 7 Feb',
    review: { name: 'Donna K.', stars: 5, text: 'They noticed a loose gutter bracket I hadn\'t even seen. That\'s the difference.' },
    photo: (
      <svg viewBox="0 0 160 120" className="phone-photo">
        <defs><linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8CCE0"/><stop offset="100%" stopColor="#D8E8F0"/></linearGradient></defs>
        <rect width="160" height="120" fill="url(#sky3)"/>
        {/* looking down on clean roof tiles */}
        {/* tile grid — clean dark tiles */}
        {Array.from({length:7}).map((_,row) =>
          Array.from({length:9}).map((_,col) => (
            <rect key={`${row}-${col}`}
              x={col*20 - (row%2)*10} y={row*18}
              width="19" height="16" rx="1"
              fill={row%2===0 ? '#5A4E44' : '#52463C'}
              opacity={0.85 + (col%3)*0.05}
            />
          ))
        )}
        {/* ridge line at top */}
        <rect x="0" y="0" width="160" height="6" fill="#3E3430"/>
        {/* no moss — clean tiles gleam slightly */}
        <rect width="160" height="120" fill="#E8F0F5" opacity="0.08"/>
        <radialGradient id="vig3" cx="50%" cy="50%" r="70%"><stop offset="60%" stopColor="transparent"/><stop offset="100%" stopColor="rgba(0,0,0,0.3)"/></radialGradient>
        <rect width="160" height="120" fill="url(#vig3)"/>
      </svg>
    ),
  },
  {
    service: 'Window Clean',
    location: 'Sumner',
    time: '10:02 AM',
    date: 'Wed 19 Mar',
    review: { name: 'Jo W.', stars: 5, text: 'The windows look amazing, the roof is clear, and I didn\'t have to organise a thing.' },
    photo: (
      <svg viewBox="0 0 160 120" className="phone-photo">
        <defs>
          <linearGradient id="sky4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B0CCE0"/><stop offset="100%" stopColor="#D0E8F8"/></linearGradient>
          <linearGradient id="refl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C8E0F0" stopOpacity="0.9"/><stop offset="60%" stopColor="#E8F4FF" stopOpacity="0.7"/><stop offset="100%" stopColor="#F0F8FF" stopOpacity="0.5"/></linearGradient>
        </defs>
        <rect width="160" height="120" fill="#E8E0D4"/>
        {/* window frame */}
        <rect x="20" y="10" width="120" height="100" fill="#D0C8B8" rx="2"/>
        {/* panes */}
        <rect x="24" y="14" width="54" height="44" fill="url(#refl)" rx="1"/>
        <rect x="82" y="14" width="54" height="44" fill="url(#refl)" rx="1"/>
        <rect x="24" y="62" width="54" height="44" fill="url(#refl)" rx="1"/>
        <rect x="82" y="62" width="54" height="44" fill="url(#refl)" rx="1"/>
        {/* sky reflection */}
        <ellipse cx="45" cy="28" rx="20" ry="10" fill="url(#sky4)" opacity="0.6"/>
        <ellipse cx="103" cy="28" rx="20" ry="10" fill="url(#sky4)" opacity="0.6"/>
        {/* gleam line */}
        <line x1="28" y1="18" x2="60" y2="50" stroke="white" strokeWidth="2" opacity="0.5" strokeLinecap="round"/>
        <line x1="86" y1="18" x2="118" y2="50" stroke="white" strokeWidth="2" opacity="0.5" strokeLinecap="round"/>
        <rect width="160" height="120" fill="#D4A860" opacity="0.04"/>
        <radialGradient id="vig4" cx="50%" cy="50%" r="70%"><stop offset="60%" stopColor="transparent"/><stop offset="100%" stopColor="rgba(0,0,0,0.2)"/></radialGradient>
        <rect width="160" height="120" fill="url(#vig4)"/>
      </svg>
    ),
  },
  {
    service: 'Driveway Clean',
    location: 'Halswell',
    time: '3:40 PM',
    date: 'Sat 29 Mar',
    review: { name: 'Amanda B.', stars: 5, text: 'My neighbour noticed how good the place looked and asked for their number.' },
    photo: (
      <svg viewBox="0 0 160 120" className="phone-photo">
        <defs><linearGradient id="conc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D8D0C0"/><stop offset="100%" stopColor="#C8C0B0"/></linearGradient></defs>
        <rect width="160" height="120" fill="url(#conc)"/>
        {/* clean concrete panels */}
        {[0,40,80].map(y => <line key={y} x1="0" y1={y} x2="160" y2={y} stroke="#B8B0A0" strokeWidth="2"/>)}
        {[0,53,106,160].map(x => <line key={x} x1={x} y1="0" x2={x} y2="120" stroke="#B8B0A0" strokeWidth="1.5"/>)}
        {/* sharp shadow from fence — late afternoon */}
        <polygon points="0,60 0,120 40,120 0,60" fill="rgba(0,0,0,0.12)"/>
        {/* wet gleam where just washed */}
        <ellipse cx="100" cy="70" rx="40" ry="20" fill="white" opacity="0.15"/>
        {/* gate post edge */}
        <rect x="0" y="0" width="8" height="120" fill="#8A8070"/>
        {/* subtle warmth */}
        <rect width="160" height="120" fill="#C89040" opacity="0.08"/>
        <radialGradient id="vig5" cx="50%" cy="50%" r="70%"><stop offset="60%" stopColor="transparent"/><stop offset="100%" stopColor="rgba(0,0,0,0.25)"/></radialGradient>
        <rect width="160" height="120" fill="url(#vig5)"/>
      </svg>
    ),
  },
  {
    service: 'HVAC Service',
    location: 'Riccarton',
    time: '1:08 PM',
    date: 'Mon 7 Apr',
    review: { name: 'Lisa F.', stars: 5, text: 'The HVAC hasn\'t run this quietly in years. Genuinely impressed.' },
    photo: (
      <svg viewBox="0 0 160 120" className="phone-photo">
        <rect width="160" height="120" fill="#E8E4E0"/>
        {/* wall */}
        <rect width="160" height="120" fill="#F0ECE8"/>
        {/* HVAC unit on wall */}
        <rect x="20" y="30" width="120" height="50" fill="#E0DCD8" rx="6"/>
        <rect x="24" y="34" width="112" height="42" fill="#D8D4D0" rx="4"/>
        {/* vents — clean */}
        {[0,1,2,3,4,5,6].map(i => (
          <rect key={i} x="28" y={38+i*5} width="80" height="3" fill="#C8C4C0" rx="1.5"/>
        ))}
        {/* brand panel */}
        <rect x="110" y="38" width="22" height="30" fill="#A8B5A0" rx="2"/>
        <circle cx="121" cy="53" r="6" fill="#26302A" opacity="0.2"/>
        <circle cx="121" cy="53" r="3" fill="#26302A" opacity="0.4"/>
        {/* clean filter held up — subtle */}
        <rect x="28" y="85" width="60" height="25" fill="#C8C4B8" rx="2" opacity="0.6"/>
        <text x="58" y="100" textAnchor="middle" fontSize="8" fill="#8A8680" fontFamily="Arial">Clean ✓</text>
        <rect width="160" height="120" fill="#A8B060" opacity="0.04"/>
        <radialGradient id="vig6" cx="50%" cy="50%" r="70%"><stop offset="60%" stopColor="transparent"/><stop offset="100%" stopColor="rgba(0,0,0,0.2)"/></radialGradient>
        <rect width="160" height="120" fill="url(#vig6)"/>
      </svg>
    ),
  },
  {
    service: 'Spider Control',
    location: 'Papanui',
    time: '8:55 AM',
    date: 'Tue 15 Apr',
    review: { name: 'Karen S.', stars: 5, text: 'Eaves are completely clear. They did the whole perimeter and even got under the deck. Brilliant.' },
    photo: (
      <svg viewBox="0 0 160 120" className="phone-photo">
        <defs><linearGradient id="sky7" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C0D0E0"/><stop offset="100%" stopColor="#E0ECF4"/></linearGradient></defs>
        <rect width="160" height="120" fill="url(#sky7)"/>
        {/* eave soffit — looking up at clean corner */}
        <rect x="0" y="0" width="160" height="50" fill="#E8E4DC"/>
        {/* fascia */}
        <rect x="0" y="48" width="160" height="10" fill="#D8D0C4"/>
        {/* wall below */}
        <rect x="0" y="58" width="160" height="62" fill="#F0EDE6"/>
        {/* corner join — perfectly clean */}
        <line x1="80" y1="0" x2="80" y2="58" stroke="#C8C0B4" strokeWidth="2"/>
        {/* no webs — clean */}
        <circle cx="82" cy="10" r="2" fill="#E0DCD4" opacity="0.5"/>
        {/* morning light shaft */}
        <polygon points="0,0 60,0 0,60" fill="white" opacity="0.08"/>
        {/* treated surface sheen */}
        <rect x="0" y="0" width="160" height="58" fill="#F8F4F0" opacity="0.12"/>
        <rect width="160" height="120" fill="#C0A860" opacity="0.05"/>
        <radialGradient id="vig7" cx="50%" cy="50%" r="70%"><stop offset="60%" stopColor="transparent"/><stop offset="100%" stopColor="rgba(0,0,0,0.2)"/></radialGradient>
        <rect width="160" height="120" fill="url(#vig7)"/>
      </svg>
    ),
  },
];

function FilmReel() {
  const [paused, setPaused] = useState(false);
  const items = [...JOBS, ...JOBS]; // doubled for seamless loop

  return (
    <div
      className="film-reel-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Top sprocket strip */}
      <div className="film-sprockets">
        {Array(28).fill(0).map((_, i) => <div key={i} className="sprocket-hole"/>)}
      </div>

      {/* Scrolling frames */}
      <div className="film-track-outer">
        <div className={`film-track ${paused ? 'paused' : ''}`}>
          {items.map((job, i) => (
            <div key={i} className="film-frame">
              {/* Phone photo */}
              <div className="phone-wrap">
                {job.photo}
                {/* Camera UI overlay */}
                <div className="phone-timestamp">{job.date} · {job.time}</div>
                <div className="phone-location">📍 {job.location}</div>
                <div className="phone-service-tag">{job.service}</div>
              </div>
              {/* Caption below */}
              <div className="film-caption">
                <div className="film-stars">{'★'.repeat(job.review.stars)}</div>
                <p className="film-quote-text">"{job.review.text}"</p>
                <div className="film-reviewer">— {job.review.name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom sprocket strip */}
      <div className="film-sprockets">
        {Array(28).fill(0).map((_, i) => <div key={i} className="sprocket-hole"/>)}
      </div>
    </div>
  );
}

// ── SIGNATURE PAD ─────────────────────────────────────────────────────────
function SignaturePad({ onSign }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [mode, setMode] = useState('draw'); // 'draw' | 'type'
  const [typedName, setTypedName] = useState('');

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return [src.clientX - rect.left, src.clientY - rect.top];
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const [x, y] = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const [x, y] = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#26302A';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stop = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const confirm = () => {
    if (mode === 'type') {
      if (typedName.trim().length < 2) return;
      onSign({ type: 'typed', value: typedName.trim() });
    } else {
      if (!hasSignature) return;
      const canvas = canvasRef.current;
      onSign({ type: 'drawn', value: canvas.toDataURL() });
    }
  };

  return (
    <div className="sig-wrap">
      <div className="sig-mode-toggle">
        <button type="button" className={`sig-mode-btn ${mode === 'draw' ? 'active' : ''}`} onClick={() => setMode('draw')}>Draw</button>
        <button type="button" className={`sig-mode-btn ${mode === 'type' ? 'active' : ''}`} onClick={() => setMode('type')}>Type</button>
      </div>
      {mode === 'draw' ? (
        <div className="sig-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={480}
            height={120}
            className="sig-canvas"
            onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
            onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
          />
          <span className="sig-hint">Sign above</span>
          {hasSignature && <button type="button" className="sig-clear" onClick={clear}>Clear</button>}
        </div>
      ) : (
        <div className="sig-type-wrap">
          <input
            className="sig-type-input"
            placeholder="Type your full name"
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
          />
          {typedName && <div className="sig-type-preview">{typedName}</div>}
        </div>
      )}
      <button
        type="button"
        className="btn-primary sig-confirm"
        disabled={mode === 'draw' ? !hasSignature : typedName.trim().length < 2}
        onClick={confirm}
      >
        Confirm signature
      </button>
    </div>
  );
}

// ── CALENDLY INLINE EMBED ─────────────────────────────────────────────────
function CalendlyEmbed({ url, prefill }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Load Calendly widget script once
    const scriptId = 'calendly-widget-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Initialise the inline widget once script is ready
    const init = () => {
      if (window.Calendly && containerRef.current) {
        window.Calendly.initInlineWidget({
          url: `${url}?hide_gdpr_banner=1&primary_color=b5603f`,
          parentElement: containerRef.current,
          prefill: prefill || {},
        });
      }
    };

    // Script may already be loaded, or we wait for it
    if (window.Calendly) {
      init();
    } else {
      const script = document.getElementById(scriptId);
      script.addEventListener('load', init);
      return () => script.removeEventListener('load', init);
    }
  }, [url]);

  return (
    <div className="calendly-wrap">
      <div ref={containerRef} className="calendly-container" />
    </div>
  );
}

// ── SIGNUP FLOW MODAL ──────────────────────────────────────────────────────
function SignupModal({ plan, total, quote, frequencyByService, onClose }) {
  const [step, setStep] = useState(1); // 1=form, 2=agreement, 3=signed, 4=confirmed
  const [form, setForm] = useState({
    name: '', email: '', mobile: '', address: '', access: '', dogs: 'No',
  });
  const [errors, setErrors] = useState({});
  const [signature, setSignature] = useState(null);
  const agreementRef = useRef(null);

  const today = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
  const annualValue = total * 12;
  const deposit = Math.round(annualValue * 0.5);
  const monthlyInstalment = Math.round((annualValue * 0.5) / 11);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.match(/^[^@]+@[^@]+\.[^@]+$/)) e.email = 'Valid email required';
    if (!form.mobile.trim()) e.mobile = 'Required';
    if (!form.address.trim()) e.address = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      setStep(2);
      setTimeout(() => agreementRef.current?.scrollTo(0, 0), 50);
    }
  };

  const handleSign = (sig) => {
    setSignature(sig);
    setStep(3);
  };

  const handlePayDeposit = () => {
    setStep(4);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* Step indicator */}
        <div className="modal-steps">
          {['Your details', 'Service Agreement', 'Pay deposit', 'Book first visit'].map((s, i) => (
            <div key={s} className={`modal-step ${step > i+1 ? 'done' : step === i+1 ? 'active' : ''}`}>
              <div className="modal-step-dot">{step > i+1 ? '✓' : i+1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>

        {/* ── STEP 1: Details form ── */}
        {step === 1 && (
          <div className="modal-body">
            <h2 className="modal-title">Your details</h2>
            <p className="modal-sub">Takes about a minute. This information goes directly into your Service Agreement.</p>
            <div className="form-grid">
              {[
                { key: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Smith' },
                { key: 'email', label: 'Email address', type: 'email', placeholder: 'jane@example.com' },
                { key: 'mobile', label: 'Mobile number', type: 'tel', placeholder: '021 123 4567' },
                { key: 'address', label: 'Home address', type: 'text', placeholder: '12 Example Street, Merivale, Christchurch' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key} className="form-field">
                  <label>{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className={errors[key] ? 'error' : ''}
                  />
                  {errors[key] && <span className="form-error">{errors[key]}</span>}
                </div>
              ))}
              <div className="form-field form-full">
                <label>Special access instructions <span className="form-optional">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. gate code 1234, access via side lane"
                  value={form.access}
                  onChange={e => setForm(f => ({ ...f, access: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label>Dogs on the property?</label>
                <div className="form-radio-group">
                  {['No', 'Yes — will be secured', 'Yes — please call ahead'].map(opt => (
                    <label key={opt} className="form-radio">
                      <input type="radio" name="dogs" value={opt} checked={form.dogs === opt} onChange={e => setForm(f => ({ ...f, dogs: e.target.value }))} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 24 }} onClick={handleSubmit}>
              Continue to Service Agreement →
            </button>
          </div>
        )}

        {/* ── STEP 2: Agreement ── */}
        {step === 2 && (
          <div className="modal-body modal-agreement" ref={agreementRef}>
            <div className="agreement-doc">

              <div className="agreement-header">
                <div className="agreement-logo">HomeTend.</div>
                <div className="agreement-meta">
                  <div>HomeTend Christchurch Limited</div>
                  <div>hello@hometend.co.nz</div>
                  <div>Date: {today}</div>
                </div>
              </div>

              <h1 className="agreement-title">Service Agreement</h1>

              {/* Plan Summary */}
              <div className="agreement-section agreement-plan-summary">
                <h2>Your Plan Summary</h2>
                <div className="agreement-customer-details">
                  <div><strong>Customer:</strong> {form.name}</div>
                  <div><strong>Address:</strong> {form.address}</div>
                  <div><strong>Email:</strong> {form.email}</div>
                  <div><strong>Mobile:</strong> {form.mobile}</div>
                  {form.access && <div><strong>Access instructions:</strong> {form.access}</div>}
                  <div><strong>Dogs on property:</strong> {form.dogs}</div>
                </div>

                <table className="agreement-table">
                  <thead>
                    <tr><th>Service</th><th>Frequency</th><th>Monthly equivalent</th></tr>
                  </thead>
                  <tbody>
                    {quote.breakdown.map(({ id, amount }) => {
                      const svc = SERVICES.find(s => s.id === id);
                      const freqId = frequencyByService[id] || 'annual';
                      const freq = FREQUENCIES.find(f => f.id === freqId);
                      return (
                        <tr key={id}>
                          <td>{svc?.name}</td>
                          <td>{freq?.label}</td>
                          <td>${amount}/mo</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="agreement-payment-summary">
                  <div className="agreement-payment-row"><span>Annual plan value</span><span>${annualValue}</span></div>
                  <div className="agreement-payment-row highlight"><span>Deposit due today (50%)</span><span>${deposit}</span></div>
                  <div className="agreement-payment-row"><span>Monthly instalments × 11</span><span>${monthlyInstalment}/mo</span></div>
                  <div className="agreement-payment-row"><span>Year two monthly direct debit</span><span>${total}/mo</span></div>
                </div>
              </div>

              {/* Key points box */}
              <div className="agreement-keypoints">
                <h3>Key things to know before you sign</h3>
                <ul>
                  <li>50% deposit today, then 11 equal monthly payments for the rest of year one</li>
                  <li>Your first visit is a house wash — we'll confirm the date with you after signing</li>
                  <li>Cancel any time with 30 days notice — deposit is non-refundable</li>
                  <li>If we were at your door today, you have 5 working days to change your mind — full refund, no questions</li>
                  <li>We'll send you a photo when every visit is done</li>
                </ul>
              </div>

              {/* Signature block */}
              <div className="agreement-signature-block">
                <h2>Sign here</h2>
                <p>By signing below you confirm you have read and agree to the terms of this agreement.</p>
                <SignaturePad onSign={handleSign} />
              </div>

              {/* Full terms */}
              <div className="agreement-terms">
                <h2>Terms and Conditions</h2>

                <h3>1. Your Plan</h3>
                <p>This agreement sets out the home maintenance services you have selected, the frequency at which they will be delivered, and the payment terms that apply. Your plan begins on the date you sign this agreement and your first payment is received.</p>

                <h3>2. Payment Terms</h3>
                <p><strong>Year One:</strong> A deposit of 50% of your annual plan value is due at the time of signing. The remaining 50% is divided into 11 equal monthly instalments, charged on the same date each month following your sign-up date.</p>
                <p><strong>Year Two Onwards:</strong> Approximately six weeks before your plan anniversary, we will contact you to confirm your renewal preferences. You may choose to continue on 12 equal monthly direct debit payments, or renew with a fresh 50% deposit and lower monthly instalments. If we do not hear from you, your plan will automatically renew on 12 equal monthly payments.</p>
                <p>All payments are processed securely via Stripe. All prices are in New Zealand dollars and are inclusive of GST where applicable.</p>

                <h3>3. Scheduling and Delivery</h3>
                <p>Services are scheduled at the time of year most appropriate for each service. We will notify you of scheduled visits at least 48 hours in advance by text message. We reserve the right to reschedule a visit due to adverse weather, equipment issues, or circumstances outside our control, and will reschedule within 14 days.</p>
                <p><strong>First Visit:</strong> Your first visit will be a house wash, scheduled at a time agreed between you and HomeTend following signing.</p>

                <h3>4. Access to Your Property</h3>
                <p>You agree to ensure that our crew can safely access the areas of your property required to deliver the agreed services. Our crew will close all gates and leave the property as they found it upon completion of each visit. If our crew is unable to access your property on a scheduled date due to circumstances within your control, the visit will be treated as completed for billing purposes.</p>

                <h3>5. What We Will Do</h3>
                <p>On completion of each visit, HomeTend will send you a photo of the completed work, note any items of concern observed on your property, and confirm the date of your next scheduled visit. We will carry out all services with reasonable care and skill.</p>

                <h3>6. Cancellation and Changes</h3>
                <p>You may cancel your plan at any time by giving 30 days written notice to hello@hometend.co.nz. If you cancel during Year One, your deposit is non-refundable. You may add or remove services at any time — changes take effect from the following billing cycle.</p>

                <h3>7. Cooling-Off Period</h3>
                <p>If this agreement was entered into as a result of an unsolicited approach at your home, you have the right to cancel within 5 working days of signing without penalty. Any deposit paid will be refunded in full. To exercise this right, notify us in writing at hello@hometend.co.nz.</p>

                <h3>8. Liability</h3>
                <p>HomeTend Christchurch Limited carries public liability insurance. Our liability to you is limited to the value of services delivered under this agreement in the 12 months preceding any claim. Nothing in this agreement limits any rights you have under the Consumer Guarantees Act 1993 or the Fair Trading Act 1986.</p>

                <h3>9. Privacy</h3>
                <p>We collect your personal information for the purpose of delivering our services and processing payments. We will not sell or share your personal information with third parties except as required to deliver our services or as required by law. Our handling of your information is governed by the Privacy Act 2020.</p>

                <h3>10. General</h3>
                <p>This agreement is governed by the laws of New Zealand. This agreement, together with your Plan Summary above, constitutes the entire agreement between us in relation to the services described.</p>

                <div className="agreement-authorised">
                  <div>
                    <svg viewBox="0 0 300 60" className="agreement-sig-svg">
                      <path d="M 30 45 C 28 30,32 18,38 16 C 44 14,46 24,42 32 C 38 40,32 44,34 50 C 36 56,44 52,52 42 M 58 24 C 58 22,60 19,62 20 C 64 21,64 26,62 34 C 60 42,58 48,60 52 M 58 28 C 64 27,72 27,76 29 M 82 18 C 78 24,76 34,76 44 C 76 54,78 58,82 57 C 86 56,90 49,92 40 C 94 31,92 22,88 21 C 84 20,80 26,80 34 M 100 22 C 98 29,96 39,96 50 C 96 61,100 64,106 60 M 100 32 C 104 30,112 30,118 34 M 132 18 C 128 30,126 44,128 56 C 130 68,136 72,142 66 C 148 60,154 46,156 34 M 156 34 C 158 22,154 14,148 14 C 142 14,136 24,134 34 M 175 45 C 163 36,159 26,163 18 C 167 10,177 10,183 18 C 189 26,187 38,179 46 C 171 54,165 56,167 62 C 169 68,181 66,191 58 M 199 18 C 197 25,195 35,195 45 C 195 55,197 60,201 59 C 205 58,209 50,211 39 C 213 28,211 19,207 19 C 203 19,199 27,199 35 M 219 18 C 217 25,215 35,215 48 C 215 61,219 65,225 61 M 233 14 C 227 20,223 30,221 42 C 219 54,221 62,227 62 C 233 62,241 54,245 42 C 249 30,247 18,241 14 C 235 10,229 14,227 22 M 253 18 C 251 25,249 35,249 48 C 249 61,253 65,259 61 C 265 57,271 45,273 34 M 253 31 C 259 29,267 29,273 34 M 287 12 C 281 18,277 28,275 40 C 273 52,275 60,281 60" fill="none" stroke="#26302A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
                    </svg>
                    <div className="agreement-authorised-name">Finley McDrury</div>
                    <div className="agreement-authorised-title">Director, HomeTend Christchurch Limited</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Signed — pay deposit ── */}
        {step === 3 && (
          <div className="modal-body modal-centered">
            <div className="modal-success-icon">✓</div>
            <h2 className="modal-title">Agreement signed</h2>
            <p className="modal-sub">Your Service Agreement has been signed and will be emailed to {form.email} for your records.</p>
            <div className="modal-summary-box">
              <div className="modal-summary-row"><span>Deposit due today</span><strong>${deposit}</strong></div>
              <div className="modal-summary-row"><span>Then {monthlyInstalment}/month × 11</span><span>Year one instalments</span></div>
              <div className="modal-summary-row"><span>From year two</span><span>${total}/month</span></div>
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 24 }} onClick={handlePayDeposit}>
              Pay ${deposit} deposit →
            </button>
            <p className="modal-stripe-note">Secure payment via Stripe. You'll receive a receipt immediately.</p>
          </div>
        )}

        {/* ── STEP 4: Deposit paid — book first visit ── */}
        {step === 4 && (
          <div className="modal-body">
            <h2 className="modal-title">Let's book your first visit</h2>
            <p className="modal-sub">Pick a time that suits you — your house wash will be Finn's first job at your property.</p>
            <CalendlyEmbed url={CALENDLY_URL} prefill={{ name: form.name, email: form.email }} />
            <button className="btn-secondary calendly-skip" onClick={onClose}>
              I'll book later — close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState(new Set(['roof', 'gutter', 'house-wash']));
  const [scrolled, setScrolled] = useState(false);
  const [bedrooms, setBedrooms] = useState('3');
  const [storeys, setStoreys] = useState(1);
  const [hvacOutlets, setHvacOutlets] = useState(1);
  const [activeTab, setActiveTab] = useState(null);
  const [showModal, setShowModal] = useState(false);
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

  const quote = calculateQuote({ selected, bedrooms, storeys, hvacOutlets, frequencyByService });
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
          padding: 3px 9px;
          font-size: 11px;
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

        /* ABOVE FOLD — 3 panes */
        .above-fold {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0;
          max-width: 1400px;
          margin: 0 auto;
        }
        .fold-pane {
          padding: 24px 22px;
          display: flex;
          flex-direction: column;
          background: var(--paper);
        }
        .fold-pane-hero {
          border-right: 1px solid var(--line);
        }
        .fold-pane-services {
          border-right: 1px solid var(--line);
        }
        .fold-pane-right {
          background: var(--paper);
        }
        .fold-pane-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--clay-dark);
          margin-bottom: 12px;
        }
        .fold-services-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .fold-headline {
          font-size: clamp(20px, 2.8vw, 32px);
          line-height: 1.15;
          margin: 0 0 18px;
        }
        .fold-headline em {
          font-style: italic;
          color: var(--clay);
        }
        .fold-inputs {
          display: flex;
          gap: 18px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .fold-input-group label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #8A8576;
          margin-bottom: 6px;
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
          border-radius: 8px;
          padding: 4px 8px;
          background: transparent;
          transition: background 0.12s;
        }
        .fold-service-row:hover {
          background: var(--stone);
        }
        .fold-service-row.active {
          background: #FBF1EC;
        }
        .fold-service-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: left;
          padding: 0;
        }
        .fold-check {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--clay);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
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
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
        }
        .fold-freq-pills {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          margin-top: 4px;
          margin-left: 26px;
          margin-bottom: 4px;
        }
        .fold-addon {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          margin-left: 26px;
          margin-bottom: 4px;
          font-size: 11px;
          color: #8A8576;
          font-weight: 600;
        }

        /* FOLD PRICE CARD — dark floating card */
        .fold-price-card {
          background: var(--ink);
          color: var(--paper);
          padding: 22px 20px;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(38,48,42,0.18);
        }
        .fold-price-label {
          font-size: 10px;
          opacity: 0.6;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          display: block;
          margin-bottom: 10px;
        }
        .fold-price-amount {
          font-family: 'Fraunces', serif;
          font-size: 44px;
          margin: 6px 0 4px;
          line-height: 1;
        }
        .fold-price-amount span { font-size: 14px; opacity: 0.65; }
        .fold-price-empty-state {
          font-size: 13px;
          opacity: 0.55;
          padding: 16px 0;
          text-align: center;
        }
        .fold-price-row-hero {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 0 8px;
        }
        .fold-price-block {
          flex: 1;
          background: rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .fold-price-block-label {
          display: block;
          font-size: 10px;
          opacity: 0.6;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .fold-price-block-amount {
          font-family: 'Fraunces', serif;
          font-size: 24px;
          font-weight: 500;
          line-height: 1;
        }
        .fold-price-block-mo { font-size: 12px; opacity: 0.65; }
        .fold-price-divider {
          font-size: 11px;
          opacity: 0.5;
          font-weight: 600;
          flex-shrink: 0;
        }
        .fold-price-yr2 {
          font-size: 11.5px;
          opacity: 0.7;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          line-height: 1.45;
        }
        .fold-price-yr2 strong { opacity: 1; }
        .fold-price-note {
          font-size: 11px;
          opacity: 0.55;
          margin-bottom: 12px;
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
          padding: 6px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          font-size: 12px;
        }
        .fold-price-freq { opacity: 0.5; font-size: 11px; }
        .fold-price-empty { opacity: 0.5; justify-content: center !important; }

        @media (max-width: 900px) {
          .above-fold { grid-template-columns: 1fr; }
          .fold-pane { border-right: none; border-bottom: 1px solid var(--line); }
          .fold-pane-right { border-bottom: none; }
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
          gap: 6px;
          flex-wrap: wrap;
        }
        .pill {
          border: 1.5px solid var(--line);
          background: var(--paper);
          border-radius: 999px;
          padding: 6px 13px;
          font-size: 12px;
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

        /* NAV active tab */
        .nav-links li.active { opacity: 1; }

        /* FILM REEL */
        .film-reel-wrap {
          background: #1A1F1C;
          overflow: hidden;
          border-top: 1px solid #2E3830;
          border-bottom: 1px solid #2E3830;
        }
        .film-sprockets {
          display: flex;
          gap: 0;
          padding: 4px 0;
          background: #111614;
        }
        .sprocket-hole {
          width: 14px;
          height: 10px;
          min-width: 14px;
          background: #1A1F1C;
          border-radius: 2px;
          margin: 2px 6px;
          border: 1px solid #2A2F2C;
        }
        .film-track-outer {
          overflow: hidden;
          padding: 20px 0;
        }
        .film-track {
          display: flex;
          gap: 24px;
          width: max-content;
          animation: filmScroll 38s linear infinite;
        }
        .film-track.paused {
          animation-play-state: paused;
        }
        @keyframes filmScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .film-frame {
          width: 200px;
          flex-shrink: 0;
          cursor: default;
        }
        .phone-wrap {
          position: relative;
          width: 160px;
          margin: 0 auto 12px;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 6px 20px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,255,255,0.08);
        }
        .phone-photo {
          display: block;
          width: 100%;
          height: auto;
        }
        .phone-timestamp {
          position: absolute;
          bottom: 28px;
          left: 8px;
          font-size: 9px;
          color: rgba(255,255,255,0.85);
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          text-shadow: 0 1px 3px rgba(0,0,0,0.6);
          letter-spacing: 0.02em;
        }
        .phone-location {
          position: absolute;
          bottom: 16px;
          left: 8px;
          font-size: 9px;
          color: rgba(255,255,255,0.85);
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          text-shadow: 0 1px 3px rgba(0,0,0,0.6);
        }
        .phone-service-tag {
          position: absolute;
          top: 8px;
          right: 8px;
          background: var(--clay);
          color: white;
          font-size: 9px;
          font-weight: 700;
          padding: 3px 7px;
          border-radius: 999px;
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .film-caption {
          text-align: center;
          padding: 0 8px;
        }
        .film-stars {
          color: var(--clay);
          font-size: 12px;
          letter-spacing: 2px;
          margin-bottom: 6px;
        }
        .film-quote-text {
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-size: 12px;
          line-height: 1.5;
          color: rgba(252,251,248,0.8);
          margin: 0 0 6px;
        }
        .film-reviewer {
          font-size: 10px;
          color: var(--sage);
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* TAB PANELS */
        .tab-panel {
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── CALENDLY EMBED ── */
        .calendly-wrap {
          margin-top: 16px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid var(--line);
        }
        .calendly-container {
          min-width: 320px;
          height: 630px;
        }
        .calendly-skip {
          margin-top: 16px;
          display: block;
          width: 100%;
          text-align: center;
          font-size: 13px;
          color: #8A8576;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
        }

        /* ── MODAL ── */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(38,48,42,0.7);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px 16px;
          overflow-y: auto;
        }
        .modal-sheet {
          background: var(--paper);
          border-radius: 20px;
          width: 100%;
          max-width: 760px;
          position: relative;
          box-shadow: 0 32px 80px rgba(0,0,0,0.35);
          min-height: 200px;
        }
        .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: var(--stone);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 14px;
          color: var(--ink);
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-steps {
          display: flex;
          gap: 0;
          padding: 20px 24px;
          border-bottom: 1px solid var(--line);
          overflow-x: auto;
        }
        .modal-step {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 500;
          color: #C9C2B2;
          white-space: nowrap;
          padding-right: 20px;
        }
        .modal-step:not(:last-child)::after {
          content: '→';
          margin-left: 8px;
          color: var(--line);
        }
        .modal-step.active { color: var(--ink); }
        .modal-step.done { color: var(--clay); }
        .modal-step-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--stone);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .modal-step.active .modal-step-dot { background: var(--ink); color: white; }
        .modal-step.done .modal-step-dot { background: var(--clay); color: white; }
        .modal-body {
          padding: 28px 28px 32px;
        }
        .modal-body.modal-agreement {
          padding: 0;
          max-height: 75vh;
          overflow-y: auto;
        }
        .modal-title {
          font-family: 'Fraunces', serif;
          font-size: 24px;
          font-weight: 500;
          margin: 0 0 8px;
        }
        .modal-sub {
          font-size: 15px;
          color: #4A5048;
          margin: 0 0 24px;
          line-height: 1.5;
        }
        .modal-centered {
          text-align: center;
        }
        .modal-success-icon {
          font-size: 40px;
          margin-bottom: 16px;
        }
        .modal-summary-box {
          background: var(--stone);
          border-radius: 14px;
          padding: 20px 24px;
          margin-top: 20px;
          text-align: left;
        }
        .modal-summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
          border-bottom: 1px solid var(--line);
        }
        .modal-summary-row:last-child { border-bottom: none; }
        .modal-stripe-note {
          font-size: 12px;
          color: #8A8576;
          margin-top: 12px;
        }

        /* ── FORM ── */
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-field.form-full { grid-column: 1 / -1; }
        .form-field label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #8A8576;
        }
        .form-optional { font-weight: 400; text-transform: none; letter-spacing: 0; }
        .form-field input {
          border: 1.5px solid var(--line);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 15px;
          font-family: 'Inter', sans-serif;
          color: var(--ink);
          background: var(--paper);
          outline: none;
          transition: border-color 0.15s;
        }
        .form-field input:focus { border-color: var(--clay); }
        .form-field input.error { border-color: #C44; }
        .form-error { font-size: 12px; color: #C44; }
        .form-radio-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 2px;
        }
        .form-radio {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          cursor: pointer;
        }
        .form-radio input { width: auto; border: none; padding: 0; }

        /* ── SERVICE AGREEMENT ── */
        .agreement-doc {
          padding: 32px 36px 40px;
        }
        .agreement-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--ink);
        }
        .agreement-logo {
          font-family: 'Fraunces', serif;
          font-size: 28px;
          font-weight: 600;
          color: var(--ink);
        }
        .agreement-meta {
          text-align: right;
          font-size: 12px;
          color: #4A5048;
          line-height: 1.7;
        }
        .agreement-title {
          font-family: 'Fraunces', serif;
          font-size: 22px;
          font-weight: 500;
          margin: 0 0 24px;
          color: var(--ink);
        }
        .agreement-section { margin-bottom: 28px; }
        .agreement-plan-summary {
          background: var(--stone);
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .agreement-plan-summary h2 {
          font-family: 'Fraunces', serif;
          font-size: 17px;
          font-weight: 500;
          margin: 0 0 16px;
        }
        .agreement-customer-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 24px;
          font-size: 13.5px;
          margin-bottom: 20px;
          color: #26302A;
          line-height: 1.5;
        }
        .agreement-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
          margin-bottom: 20px;
        }
        .agreement-table th {
          text-align: left;
          padding: 8px 12px;
          background: var(--ink);
          color: var(--paper);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .agreement-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--line);
        }
        .agreement-payment-summary {
          border-top: 1.5px solid var(--line);
          padding-top: 14px;
        }
        .agreement-payment-row {
          display: flex;
          justify-content: space-between;
          font-size: 13.5px;
          padding: 5px 0;
        }
        .agreement-payment-row.highlight {
          font-weight: 700;
          color: var(--clay-dark);
          font-size: 15px;
          padding: 8px 0;
        }
        .agreement-keypoints {
          background: #FBF1EC;
          border-left: 3px solid var(--clay);
          border-radius: 0 10px 10px 0;
          padding: 18px 20px;
          margin-bottom: 28px;
        }
        .agreement-keypoints h3 {
          font-family: 'Fraunces', serif;
          font-size: 15px;
          font-weight: 500;
          margin: 0 0 12px;
        }
        .agreement-keypoints ul {
          margin: 0;
          padding-left: 18px;
        }
        .agreement-keypoints li {
          font-size: 13.5px;
          line-height: 1.6;
          margin-bottom: 4px;
          color: #3A4838;
        }
        .agreement-signature-block {
          border: 1.5px solid var(--clay);
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 32px;
          background: var(--paper);
        }
        .agreement-signature-block h2 {
          font-family: 'Fraunces', serif;
          font-size: 17px;
          font-weight: 500;
          margin: 0 0 6px;
        }
        .agreement-signature-block p {
          font-size: 13px;
          color: #4A5048;
          margin: 0 0 16px;
        }
        .agreement-terms h2 {
          font-family: 'Fraunces', serif;
          font-size: 18px;
          font-weight: 500;
          margin: 0 0 16px;
          padding-top: 24px;
          border-top: 1px solid var(--line);
        }
        .agreement-terms h3 {
          font-size: 14px;
          font-weight: 700;
          margin: 18px 0 6px;
          color: var(--ink);
        }
        .agreement-terms p {
          font-size: 13.5px;
          line-height: 1.65;
          color: #3A4838;
          margin: 0 0 10px;
        }
        .agreement-authorised {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid var(--line);
        }
        .agreement-sig-svg {
          width: 200px;
          height: 40px;
          display: block;
          margin-bottom: 4px;
        }
        .agreement-authorised-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
        }
        .agreement-authorised-title {
          font-size: 12px;
          color: #8A8576;
        }

        /* ── SIGNATURE PAD ── */
        .sig-wrap { }
        .sig-mode-toggle {
          display: flex;
          gap: 0;
          margin-bottom: 12px;
          border: 1.5px solid var(--line);
          border-radius: 10px;
          overflow: hidden;
          width: fit-content;
        }
        .sig-mode-btn {
          padding: 8px 18px;
          border: none;
          background: var(--paper);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: #8A8576;
        }
        .sig-mode-btn.active {
          background: var(--ink);
          color: var(--paper);
        }
        .sig-canvas-wrap {
          position: relative;
          margin-bottom: 12px;
        }
        .sig-canvas {
          border: 1.5px solid var(--line);
          border-radius: 10px;
          display: block;
          width: 100%;
          height: 100px;
          cursor: crosshair;
          background: #FAFAF8;
          touch-action: none;
        }
        .sig-hint {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          color: #C9C2B2;
          pointer-events: none;
        }
        .sig-clear {
          position: absolute;
          top: 8px;
          right: 8px;
          font-size: 11px;
          background: none;
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 3px 8px;
          cursor: pointer;
          color: #8A8576;
        }
        .sig-type-wrap { margin-bottom: 12px; }
        .sig-type-input {
          width: 100%;
          border: 1.5px solid var(--line);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 15px;
          font-family: 'Inter', sans-serif;
          margin-bottom: 8px;
          box-sizing: border-box;
        }
        .sig-type-preview {
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-size: 28px;
          color: var(--ink);
          padding: 8px 14px;
          border-bottom: 1.5px solid var(--line);
        }
        .sig-confirm {
          width: 100%;
        }
        .sig-confirm:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 600px) {
          .form-grid { grid-template-columns: 1fr; }
          .agreement-customer-details { grid-template-columns: 1fr; }
          .agreement-doc { padding: 20px; }
          .modal-body { padding: 20px; }
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

      {/* ABOVE-FOLD — 3 pane layout */}
      <section className="above-fold">

        {/* Pane 1: Headline + property inputs */}
        <div className="fold-pane fold-pane-hero">
          <h1 className="fold-headline">Your home is your biggest asset,<br/><em>let us tend to your maintenance needs.</em></h1>
          <div className="fold-inputs">
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
            {hasHvac && (
              <div className="fold-input-group">
                <label>HVAC units</label>
                <div className="pill-group">
                  {[1,2,3,4].map((n) => (
                    <button key={n} type="button"
                      className={`pill ${hvacOutlets === n ? 'active' : ''}`}
                      onClick={() => setHvacOutlets(n)}
                    >{n}{n===4?'+':''}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pane 2: Services */}
        <div className="fold-pane fold-pane-services">
          <div className="fold-pane-label">Select services</div>
          <div className="fold-services-list">
            {SERVICES.map((s) => {
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Pane 3: Live price + carousel */}
        <div className="fold-pane fold-pane-right">
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
                    <span className="fold-price-block-label">Per month · yr one</span>
                    <span className="fold-price-block-amount">${Math.round((total * 12 * 0.5) / 11)}<span className="fold-price-block-mo">/mo</span></span>
                  </div>
                </div>
                <div className="fold-price-yr2">
                  From year two: <strong>${total}/mo</strong> — or renew on deposit.
                </div>
                <ul className="fold-price-list">
                  {quote.breakdown.map(({ id, amount }) => {
                    const s = SERVICES.find((sv) => sv.id === id);
                    const freqId = frequencyByService[id] || 'annual';
                    const freq = FREQUENCIES.find((f) => f.id === freqId);
                    return (
                      <li key={id}>
                        <span>{s?.name} <span className="fold-price-freq">· {freq?.label}</span></span>
                        <span>${amount}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <button className="btn-primary" style={{width:'100%',marginTop:16}} onClick={() => setShowModal(true)}>Lock in this plan</button>
          </div>
        </div>

      </section>

      {/* FILM REEL — full width between configurator and tabs */}
      <FilmReel />

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

      {showModal && (
        <SignupModal
          plan={selected}
          total={total}
          quote={quote}
          frequencyByService={frequencyByService}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
