/*
 * Hero illustrations — editorial SVG compositions per post.
 *
 * Selected via post.heroIllustration:
 *   "constellation" — a central open notebook with 5 satellite cards
 *                     (the 6 products), threads connecting each to it.
 *                     Represents the "one notebook, many outputs" thesis.
 */

const HeroConstellation = ({ dark, accent }) => {
  const ink = dark ? "#F2EBDB" : "#1A1410";
  const paper = dark ? "#2A1F14" : "#FDF6E2";
  const paperDim = dark ? "#3A2B1C" : "#F2E8CE";
  const line = dark ? "rgba(242,235,219,0.45)" : "rgba(26,20,16,0.5)";
  const lineSoft = dark ? "rgba(242,235,219,0.22)" : "rgba(26,20,16,0.22)";
  const cardTint = dark ? "#3F2E1E" : "#EADFC3";
  const thread = dark ? "rgba(242,235,219,0.4)" : "rgba(26,20,16,0.4)";

  return (
    <svg
      viewBox="0 0 800 450"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block" }}
      aria-hidden
    >
      {/* Background wash */}
      <defs>
        <pattern id="btf-paper-grain" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={lineSoft} strokeWidth="0.3" />
        </pattern>
        <filter id="btf-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="4" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="800" height="450" fill={paper} />
      <rect width="800" height="450" fill="url(#btf-paper-grain)" opacity="0.4" />

      {/* Threads (drawn first, behind everything) */}
      <g stroke={thread} strokeWidth="1.1" fill="none" strokeLinecap="round">
        {/* from center notebook to each satellite */}
        <path d="M 400 240 C 340 200, 280 160, 200 130" strokeDasharray="3 4" />
        <path d="M 400 240 C 460 200, 540 180, 620 140" strokeDasharray="3 4" />
        <path d="M 400 240 C 320 280, 220 310, 140 330" strokeDasharray="3 4" />
        <path d="M 400 240 C 490 290, 580 320, 660 340" strokeDasharray="3 4" />
        <path d="M 400 240 C 400 290, 400 330, 400 370" strokeDasharray="3 4" />
      </g>

      {/* Satellite card 1 — top left (Vagalume — startup) */}
      <g filter="url(#btf-shadow)" transform="translate(140, 80) rotate(-4)">
        <rect width="120" height="75" rx="2" fill={cardTint} stroke={line} strokeWidth="1" />
        <rect x="10" y="10" width="54" height="4" fill={line} opacity="0.7" />
        <rect x="10" y="22" width="100" height="2" fill={line} opacity="0.4" />
        <rect x="10" y="30" width="80" height="2" fill={line} opacity="0.4" />
        <rect x="10" y="38" width="92" height="2" fill={line} opacity="0.4" />
        <circle cx="100" cy="60" r="6" fill={accent} opacity="0.85" />
        <text x="10" y="68" fontFamily="'JetBrains Mono', monospace" fontSize="7" fill={ink} opacity="0.6" letterSpacing="0.1em">VGL</text>
      </g>

      {/* Satellite card 2 — top right (TNG — agency) */}
      <g filter="url(#btf-shadow)" transform="translate(560, 90) rotate(5)">
        <rect width="130" height="80" rx="2" fill={cardTint} stroke={line} strokeWidth="1" />
        <rect x="12" y="12" width="70" height="5" fill={line} opacity="0.7" />
        <g transform="translate(12, 26)">
          <rect width="30" height="30" fill={paperDim} stroke={line} strokeWidth="0.5" />
          <rect x="36" width="30" height="30" fill={paperDim} stroke={line} strokeWidth="0.5" />
          <rect x="72" width="30" height="30" fill={paperDim} stroke={line} strokeWidth="0.5" />
        </g>
        <text x="12" y="72" fontFamily="'JetBrains Mono', monospace" fontSize="7" fill={ink} opacity="0.6" letterSpacing="0.1em">TNG</text>
      </g>

      {/* Satellite card 3 — bottom left (app — product) */}
      <g filter="url(#btf-shadow)" transform="translate(80, 300) rotate(-6)">
        <rect width="100" height="65" rx="8" fill={cardTint} stroke={line} strokeWidth="1" />
        <rect x="8" y="8" width="84" height="8" rx="1" fill={line} opacity="0.12" />
        <circle cx="14" cy="12" r="2" fill={ink} opacity="0.5" />
        <rect x="8" y="22" width="40" height="2.5" fill={line} opacity="0.5" />
        <rect x="8" y="30" width="62" height="2" fill={line} opacity="0.35" />
        <rect x="8" y="36" width="52" height="2" fill={line} opacity="0.35" />
        <rect x="8" y="42" width="56" height="2" fill={line} opacity="0.35" />
        <rect x="8" y="52" width="30" height="8" rx="4" fill={accent} opacity="0.8" />
      </g>

      {/* Satellite card 4 — bottom right (video) */}
      <g filter="url(#btf-shadow)" transform="translate(600, 310) rotate(4)">
        <rect width="130" height="80" rx="2" fill={cardTint} stroke={line} strokeWidth="1" />
        <rect x="10" y="10" width="110" height="48" fill={paperDim} stroke={line} strokeWidth="0.5" />
        {/* play triangle */}
        <polygon points="56,26 56,42 72,34" fill={ink} opacity="0.6" />
        <circle cx="65" cy="34" r="11" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.4" />
        <rect x="10" y="64" width="50" height="2.5" fill={line} opacity="0.5" />
        <rect x="10" y="70" width="80" height="2" fill={line} opacity="0.35" />
      </g>

      {/* Satellite card 5 — bottom center (newsletter) */}
      <g filter="url(#btf-shadow)" transform="translate(340, 350) rotate(-2)">
        <rect width="120" height="60" rx="1" fill={cardTint} stroke={line} strokeWidth="1" />
        <rect x="10" y="10" width="60" height="3.5" fill={line} opacity="0.7" />
        <rect x="10" y="20" width="100" height="2" fill={line} opacity="0.4" />
        <rect x="10" y="26" width="92" height="2" fill={line} opacity="0.4" />
        <rect x="10" y="32" width="96" height="2" fill={line} opacity="0.4" />
        <rect x="10" y="38" width="70" height="2" fill={line} opacity="0.4" />
        <g transform="translate(88, 42)">
          {/* envelope fold */}
          <path d="M 0 0 L 22 0 L 22 12 L 0 12 Z" fill={paperDim} stroke={line} strokeWidth="0.5" />
          <path d="M 0 0 L 11 7 L 22 0" fill="none" stroke={line} strokeWidth="0.5" />
        </g>
      </g>

      {/* Center: Open notebook (the hub) */}
      <g transform="translate(400, 240)">
        {/* shadow */}
        <ellipse cx="0" cy="60" rx="130" ry="8" fill="rgba(0,0,0,0.15)" />

        {/* left page */}
        <g filter="url(#btf-shadow)">
          <path
            d="M -120 -60 L 0 -72 L 0 60 L -120 50 Z"
            fill={paper}
            stroke={line}
            strokeWidth="1"
          />
          {/* ruled lines */}
          <g stroke={lineSoft} strokeWidth="0.6">
            <line x1="-108" y1="-42" x2="-10" y2="-50" />
            <line x1="-108" y1="-30" x2="-10" y2="-38" />
            <line x1="-108" y1="-18" x2="-10" y2="-26" />
            <line x1="-108" y1="-6" x2="-10" y2="-14" />
            <line x1="-108" y1="6" x2="-10" y2="-2" />
            <line x1="-108" y1="18" x2="-10" y2="10" />
            <line x1="-108" y1="30" x2="-10" y2="22" />
          </g>
          {/* handwritten scribbles */}
          <g stroke={ink} strokeWidth="1.2" fill="none" opacity="0.85" strokeLinecap="round">
            <path d="M -105 -38 q 8 -4 20 0 t 20 -1 t 18 2" />
            <path d="M -105 -26 q 10 -3 16 0 t 22 -2 t 14 1" />
            <path d="M -105 -14 q 6 -2 14 0 t 24 -1 t 18 2" />
            <path d="M -105 -2 q 8 -3 18 1 t 18 -2" />
            <path d="M -105 10 q 10 -2 16 0" />
          </g>
        </g>

        {/* right page */}
        <g filter="url(#btf-shadow)">
          <path
            d="M 0 -72 L 120 -60 L 120 50 L 0 60 Z"
            fill={paper}
            stroke={line}
            strokeWidth="1"
          />
          {/* ruled lines */}
          <g stroke={lineSoft} strokeWidth="0.6">
            <line x1="10" y1="-50" x2="108" y2="-42" />
            <line x1="10" y1="-38" x2="108" y2="-30" />
            <line x1="10" y1="-26" x2="108" y2="-18" />
            <line x1="10" y1="-14" x2="108" y2="-6" />
            <line x1="10" y1="-2" x2="108" y2="6" />
            <line x1="10" y1="10" x2="108" y2="18" />
            <line x1="10" y1="22" x2="108" y2="30" />
          </g>
          {/* title + 5 bullet points (the pipeline outline) */}
          <g fill={ink}>
            <rect x="18" y="-54" width="60" height="3" opacity="0.85" />
            <rect x="18" y="-48" width="34" height="2" opacity="0.5" />
          </g>
          <g fontFamily="'Caveat', cursive" fontSize="12" fill={ink} opacity="0.9">
            <text x="18" y="-28">1 · idea</text>
            <text x="18" y="-14">2 · draft</text>
            <text x="18" y="0">3 · publish</text>
            <text x="18" y="14">4 · distribute</text>
            <text x="18" y="28">5 · forget</text>
          </g>
          {/* accent highlight on "publish" */}
          <rect x="16" y="-7" width="56" height="10" fill={accent} opacity="0.25" />
        </g>

        {/* spine */}
        <line x1="0" y1="-72" x2="0" y2="60" stroke={line} strokeWidth="1.5" />
        <line x1="-1.5" y1="-72" x2="-1.5" y2="60" stroke={lineSoft} strokeWidth="0.6" />
        <line x1="1.5" y1="-72" x2="1.5" y2="60" stroke={lineSoft} strokeWidth="0.6" />

        {/* pen on the notebook */}
        <g transform="translate(20, 36) rotate(20)">
          <rect x="0" y="0" width="80" height="5" rx="2" fill={ink} />
          <polygon points="80,0 90,2.5 80,5" fill={accent} />
          <rect x="4" y="0" width="10" height="5" fill={accent} opacity="0.9" />
        </g>
      </g>

      {/* Small orbiting dot accents */}
      <circle cx="200" cy="130" r="3" fill={accent} opacity="0.9" />
      <circle cx="620" cy="140" r="3" fill={accent} opacity="0.9" />
      <circle cx="140" cy="330" r="3" fill={accent} opacity="0.9" />
      <circle cx="660" cy="340" r="3" fill={accent} opacity="0.9" />
      <circle cx="400" cy="370" r="3" fill={accent} opacity="0.9" />

      {/* Corner fold annotations (editorial marks) */}
      <g fontFamily="'JetBrains Mono', monospace" fontSize="9" fill={ink} opacity="0.5" letterSpacing="0.1em">
        <text x="24" y="32">FIG. 1</text>
        <text x="24" y="44" opacity="0.7" fontSize="7">— a hub and its satellites</text>
      </g>
      <g fontFamily="'JetBrains Mono', monospace" fontSize="9" fill={ink} opacity="0.5" letterSpacing="0.1em">
        <text x="700" y="432" textAnchor="start">bythiagofigueiredo</text>
      </g>
    </svg>
  );
};

// Registry
const HERO_ILLUSTRATIONS = {
  constellation: HeroConstellation,
};

window.HeroIllustration = ({ kind, dark, accent }) => {
  const Comp = HERO_ILLUSTRATIONS[kind];
  if (!Comp) return null;
  return <Comp dark={dark} accent={accent} />;
};
