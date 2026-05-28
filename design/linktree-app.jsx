/*
 * Linktree — go.bythiagofigueiredo.com
 * Pinboard-editorial style, mobile-first, bilingual sections.
 * v3 — final craft pass: contrast, hierarchy, visual rhythm, accessibility.
 */

const { useState, useEffect, useCallback, useMemo } = React;

// ─── Editable data ─────────────────────────────────────────────────

// ✦ HIGHLIGHT — set active: true when running a campaign, course launch, etc.
const HIGHLIGHT = {
  active: true,
  badge_pt: "Em breve",
  badge_en: "Coming soon",
  title_pt: "Curso: Do zero ao deploy — Next.js + Supabase",
  title_en: "Course: Zero to deploy — Next.js + Supabase",
  desc_pt: "Tudo que eu aprendi construindo 6 apps em 2 anos, condensado em um curso prático.",
  desc_en: "Everything I learned building 6 apps in 2 years, condensed into a hands-on course.",
  cta_pt: "Entrar na lista de espera",
  cta_en: "Join the waitlist",
  url: "https://bythiagofigueiredo.com/curso",
  color: "accent",
};

const LATEST = {
  post: {
    title_pt: "Todos os blocos do CMS, em um lugar só",
    title_en: "Every CMS block, in one place",
    date_pt: "06 Mai 2026", date_en: "May 06, 2026",
    read: "7",
    cat: { pt: "Código", en: "Code", color: "#D65B1F" },
    url: "https://bythiagofigueiredo.com/blog/showcase-cms-blocos",
  },
  video: {
    title_pt: "Como eu publico em 6 sites com um clique",
    title_en: "How I publish to 6 sites with one click",
    date_pt: "08 Mai 2026", date_en: "May 08, 2026",
    duration: "12:34",
    channel: "@bythiagofigueiredo",
    url: "https://youtube.com/@bythiagofigueiredo",
  },
};

const SECTIONS = {
  pt: {
    flag: "🇧🇷", label: "Português", hand: "em português",
    items: [
      { id: "blog-pt", label: "Blog", desc: "Artigos sobre código, produto e vida indie", url: "https://bythiagofigueiredo.com/pt", icon: "blog" },
      { id: "nl-pt", label: "Diário do bythiago", desc: "Newsletter semanal · sextas", url: "https://bythiagofigueiredo.com/pt/newsletters/diario-do-bythiago", icon: "mail" },
      { id: "yt-pt", label: "YouTube", desc: "@bythiagofigueiredo · toda quinta", url: "https://youtube.com/@bythiagofigueiredo", icon: "youtube" },
    ],
  },
  en: {
    flag: "🇺🇸", label: "English", hand: "in english",
    items: [
      { id: "blog-en", label: "Blog", desc: "Posts on code, product & indie life", url: "https://bythiagofigueiredo.com", icon: "blog" },
      { id: "nl-en", label: "Thiago's Journal", desc: "Weekly newsletter · Fridays", url: "https://bythiagofigueiredo.com/newsletters/thiago-s-journal", icon: "mail" },
      { id: "yt-en", label: "YouTube", desc: "@thiagofigueiredo · every 2 weeks", url: "https://youtube.com/@thiagofigueiredo", icon: "youtube" },
    ],
  },
};

const SHARED_LINKS = [
  { id: "about", label_pt: "Sobre mim", label_en: "About me", url: "https://bythiagofigueiredo.com/about", icon: "person" },
  { id: "contact", label_pt: "Contato", label_en: "Contact", url: "https://bythiagofigueiredo.com/contact", icon: "contact" },
];

const SOCIALS = [
  { id: "youtube", url: "https://youtube.com/@bythiagofigueiredo", label: "YouTube" },
  { id: "github", url: "https://github.com/tnfigueiredo", label: "GitHub" },
  { id: "x", url: "https://x.com/bythiagofig", label: "X" },
  { id: "instagram", url: "https://instagram.com/bythiagofigueiredo", label: "Instagram" },
];

// ─── Theme-aware colors ─────────────────────────────────────────────

function palette(dark) {
  return {
    bg:     dark ? "#14110B" : "#E9E1CE",
    paper:  dark ? "#241F18" : "#FBF6E8",
    paper2: dark ? "#2E2820" : "#F5EDD6",
    paperH: dark ? "#362F24" : "#EFE7D0",
    ink:    dark ? "#F0E8D6" : "#161208",
    muted:  dark ? "#A09580" : "#6A5F48",
    faint:  dark ? "#756B58" : "#9C9178",
    line:   dark ? "#352D20" : "#CEBFA0",
    line2:  dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    accent: dark ? "#FF8240" : "#C14513",
    accentSoft: dark ? "rgba(255,130,64,0.12)" : "rgba(193,69,19,0.08)",
    yt:     dark ? "#FF3333" : "#CC0000",
    tape:   dark ? "rgba(255,226,140,0.55)" : "rgba(210,190,100,0.65)",
    tape2:  dark ? "rgba(180,210,255,0.40)" : "rgba(150,180,230,0.55)",
    shadow: dark
      ? "0 2px 0 rgba(0,0,0,0.6), 0 10px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)"
      : "0 1px 0 rgba(0,0,0,0.04), 0 6px 18px rgba(70,50,20,0.15), inset 0 0 0 1px rgba(0,0,0,0.04)",
  };
}

// ─── Icons ──────────────────────────────────────────────────────────

const I = {
  youtube: (c, bg) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29.94 29.94 0 0 0 1 12a29.94 29.94 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29.94 29.94 0 0 0 23 12a29.94 29.94 0 0 0-.46-5.58z" fill={c}/><path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z" fill={bg || "#fff"}/></svg>,
  blog: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  mail: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,4 12,13 2,4"/></svg>,
  person: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  contact: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  arrowR: (c) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>,
  arrow: (c) => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7,7 17,7 17,17"/></svg>,
  sun: (c) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: (c) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  s_youtube: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill={c}><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29.94 29.94 0 0 0 1 12a29.94 29.94 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29.94 29.94 0 0 0 23 12a29.94 29.94 0 0 0-.46-5.58z"/><path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z" fill="var(--bg)"/></svg>,
  s_github: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill={c}><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>,
  s_x: (c) => <svg width="17" height="17" viewBox="0 0 24 24" fill={c}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  s_instagram: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><circle cx="17.5" cy="6.5" r="1" fill={c} stroke="none"/></svg>,
};

// ─── Fade-in animation ──────────────────────────────────────────────

const useFadeIn = (delay = 0) => {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, []);
  return {
    opacity: vis ? 1 : 0,
    transform: vis ? "translateY(0) scale(1)" : "translateY(14px) scale(0.98)",
    transition: `opacity 0.55s cubic-bezier(0.23,1,0.32,1), transform 0.55s cubic-bezier(0.23,1,0.32,1)`,
  };
};

// ─── Primitives ─────────────────────────────────────────────────────

const Tape = ({ color, w = 74, rot = 0, style = {} }) => (
  <div style={{
    position: "absolute", width: w, height: 18,
    background: `linear-gradient(90deg, transparent 0%, ${color} 5%, ${color} 95%, transparent 100%)`,
    transform: `rotate(${rot}deg)`,
    zIndex: 2, pointerEvents: "none",
    ...style,
  }}>
    <div style={{
      position: "absolute", inset: 0,
      backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.07) 4px, rgba(255,255,255,0.07) 5px)",
    }}/>
  </div>
);

const Paper = ({ children, rotation = 0, pad = "18px 20px", shadow, style = {} }) => (
  <div style={{
    background: "var(--paper)",
    padding: pad,
    position: "relative",
    transform: `rotate(${rotation}deg)`,
    boxShadow: shadow,
    ...style,
  }}>
    {children}
  </div>
);

const Hand = ({ children, style = {} }) => (
  <span style={{
    fontFamily: '"Caveat", cursive', color: "var(--accent)",
    fontWeight: 600, ...style,
  }}>{children}</span>
);

// ─── Carimbo TF ─────────────────────────────────────────────────────

const Carimbo = ({ size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" role="img" aria-label="TF monogram">
    <circle cx="30" cy="30" r="27.5" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.8"/>
    <circle cx="30" cy="30" r="22.5" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.25"/>
    <g fontFamily="'Source Serif 4', Georgia, serif" letterSpacing="-4.16">
      <text x="15" y="46" fontSize="52" fontWeight="500" fill="var(--ink)">T</text>
      <text x="30" y="46" fontSize="52" fontWeight="500" fontStyle="italic" fill="var(--accent)" opacity="0.95">F</text>
    </g>
    <circle cx="50" cy="48" r="1.6" fill="var(--ink)"/>
  </svg>
);

const Asterisk = ({ color = "var(--accent)", size = 8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block" }}>
    <g fill={color}>{[0,60,120].map(d => <path key={d} d="M 12 1 C 10.2 5, 10.2 19, 12 23 C 13.8 19, 13.8 5, 12 1 Z" transform={`rotate(${d} 12 12)`}/>)}<circle cx="12" cy="12" r="0.81"/></g>
  </svg>
);

// ─── Theme Toggle ───────────────────────────────────────────────────

const ThemeBtn = ({ dark, toggle, P }) => {
  const [h, setH] = useState(false);
  return (
    <button onClick={toggle} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      aria-label={dark ? "Mudar para claro" : "Mudar para escuro"}
      style={{
        background: h ? P.accentSoft : "transparent",
        border: `1px solid ${h ? P.accent : P.line}`,
        borderRadius: 999, width: 36, height: 36, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}
    >{dark ? I.sun(P.muted) : I.moon(P.muted)}</button>
  );
};

// ─── Highlight Card ─────────────────────────────────────────────────

const HighlightCard = ({ data, L, P, animStyle }) => {
  const [h, setH] = useState(false);
  if (!data.active) return null;
  const title = data[`title_${L}`] || data.title_en;
  const desc = data[`desc_${L}`] || data.desc_en;
  const badge = data[`badge_${L}`] || data.badge_en;
  const cta = data[`cta_${L}`] || data.cta_en;

  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ textDecoration: "none", color: "inherit", display: "block", width: "100%", ...animStyle }}
    >
      <div style={{
        background: P.accent,
        padding: 0, position: "relative",
        transform: "rotate(1deg)",
        boxShadow: `0 4px 20px ${P.accent}33, 0 2px 0 rgba(0,0,0,0.15)`,
        transition: "transform 0.2s, box-shadow 0.2s",
        ...(h ? { transform: "rotate(1deg) translateY(-3px)", boxShadow: `0 8px 28px ${P.accent}44, 0 2px 0 rgba(0,0,0,0.15)` } : {}),
        overflow: "hidden",
      }}>
        <Tape color={P.tape} rot={-4} style={{ top: -5, left: 12 }} w={60}/>
        <div style={{ padding: "16px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: P.accent, background: `${P.paper}cc`,
              padding: "3px 8px", lineHeight: 1.3,
            }}>{badge}</span>
            <Hand style={{ fontSize: 15, opacity: 0.7, color: "#1A1410" }}>
              {L === "pt" ? "destaque ✦" : "featured ✦"}
            </Hand>
          </div>
          <div style={{
            fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700,
            lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: 6,
            color: "#1A1410",
          }}>{title}</div>
          <div style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 13.5, color: "rgba(26,20,16,0.7)", lineHeight: 1.55, marginBottom: 16,
          }}>{desc}</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "#1A1410", color: P.accent,
            fontFamily: "'Fraunces', serif", fontSize: 13.5, fontWeight: 600,
            padding: "9px 18px", borderRadius: 4,
            boxShadow: h ? "0 6px 16px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.15)",
            transition: "box-shadow 0.2s",
          }}>
            {cta} {I.arrowR("currentColor")}
          </div>
        </div>
      </div>
    </a>
  );
};

// ─── Latest Card ────────────────────────────────────────────────────

const LatestCard = ({ type, data, L, P }) => {
  const [h, setH] = useState(false);
  const isPost = type === "post";
  const title = data[`title_${L}`] || data.title_en;
  const date = data[`date_${L}`] || data.date_en;

  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: "block", textDecoration: "none",
        background: h ? P.paperH : P.paper2,
        padding: "12px 14px",
        transition: "background 0.15s, transform 0.12s",
        transform: h ? "translateX(3px)" : "none",
        borderLeft: `3px solid ${isPost ? (data.cat?.color || P.accent) : P.yt}`,
        color: P.ink,
      }}
    >
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: isPost ? P.muted : P.yt,
        marginBottom: 5, display: "flex", alignItems: "center", gap: 4,
      }}>
        {isPost ? "▤" : "▶"} {isPost ? (L === "pt" ? "Último post" : "Latest post") : (L === "pt" ? "Último vídeo" : "Latest video")}
      </div>
      <div style={{
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize: 15.5, fontWeight: 600, lineHeight: 1.3,
        color: P.ink, marginBottom: 4,
      }}>{title}</div>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 9, color: P.faint, letterSpacing: "0.02em",
      }}>
        {date} <span style={{ opacity: 0.4 }}>·</span> {isPost ? `${data.read} min` : data.duration}
      </div>
    </a>
  );
};

// ─── Link Row ───────────────────────────────────────────────────────

const LinkRow = ({ item, L, isLast, P }) => {
  const [h, setH] = useState(false);
  const label = item.label_pt ? item[`label_${L}`] : item.label;
  const desc = item.desc_pt ? item[`desc_${L}`] : item.desc;
  const iconFn = I[item.icon];
  const isYT = item.icon === "youtube";

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 16px",
        background: h ? P.paperH : "transparent",
        textDecoration: "none", color: P.ink,
        transition: "background 0.15s, transform 0.12s",
        transform: h ? "translateX(3px)" : "none",
        borderBottom: isLast ? "none" : `1px solid ${P.line2}`,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 7,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isYT ? `${P.yt}18` : P.accentSoft,
        flexShrink: 0,
      }}>
        {iconFn && iconFn(isYT ? P.yt : P.accent, P.paper)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 15, fontWeight: 500, lineHeight: 1.2,
        }}>{label}</div>
        {desc && <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10, color: P.muted, letterSpacing: "0.01em",
          marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{desc}</div>}
      </div>
      <div style={{
        opacity: h ? 0.6 : 0.15, transition: "opacity 0.2s, transform 0.2s",
        transform: h ? "translate(2px,-2px)" : "none", flexShrink: 0,
      }}>{I.arrow(P.ink)}</div>
    </a>
  );
};

// ─── Language Section ───────────────────────────────────────────────

const LangSection = ({ section, tapeColor, rot, tapeRot, animStyle, L, P }) => (
  <div style={animStyle}>
    <Paper rotation={rot} shadow={P.shadow} style={{ overflow: "hidden" }}>
      <Tape color={tapeColor} rot={tapeRot} style={{ top: -4, left: "50%", marginLeft: -34 }}/>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingTop: 12, paddingBottom: 10,
        borderBottom: `1px solid ${P.line2}`,
      }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{section.flag}</span>
        <span style={{
          fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700,
          letterSpacing: "-0.01em", color: P.ink,
        }}>{section.label}</span>
        <Hand style={{ fontSize: 14, marginLeft: "auto", opacity: 0.55 }}>
          {section.hand}
        </Hand>
      </div>
      <div style={{ display: "flex", flexDirection: "column", margin: "0 -20px" }}>
        {section.items.map((item, i) => (
          <LinkRow key={item.id} item={item} L={L} isLast={i === section.items.length - 1} P={P}/>
        ))}
      </div>
    </Paper>
  </div>
);

// ─── Social Bar ─────────────────────────────────────────────────────

const SocialBar = ({ P }) => {
  const [hov, setHov] = useState(null);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
      {SOCIALS.map(s => (
        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}
          onMouseEnter={() => setHov(s.id)} onMouseLeave={() => setHov(null)}
          style={{
            width: 44, height: 44, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: hov === s.id ? P.accentSoft : "transparent",
            transition: "background 0.2s, transform 0.15s",
            transform: hov === s.id ? "translateY(-2px)" : "none",
          }}
        >{I["s_" + s.id] && I["s_" + s.id](hov === s.id ? P.accent : P.faint)}</a>
      ))}
    </div>
  );
};

// ─── App ────────────────────────────────────────────────────────────

const LinktreeApp = () => {
  const L = useMemo(() => {
    const nav = (navigator.language || "pt").toLowerCase();
    return nav.startsWith("pt") ? "pt" : "en";
  }, []);

  const [themeOverride, setThemeOverride] = useState(() => {
    try { return localStorage.getItem("btf_go_theme"); } catch { return null; }
  });
  const systemDark = useMemo(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  , []);
  const dark = themeOverride ? themeOverride === "dark" : systemDark;
  const P = useMemo(() => palette(dark), [dark]);

  useEffect(() => {
    const t = dark ? "dark" : "light";
    document.documentElement.dataset.theme = t;
    document.body.dataset.theme = t;
  }, [dark]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (!themeOverride) {
        const t = mq.matches ? "dark" : "light";
        document.documentElement.dataset.theme = t;
        document.body.dataset.theme = t;
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeOverride]);

  const toggleTheme = useCallback(() => {
    const next = dark ? "light" : "dark";
    setThemeOverride(next);
    try { localStorage.setItem("btf_go_theme", next); } catch {}
  }, [dark]);

  const order = L === "pt" ? ["pt", "en"] : ["en", "pt"];

  const a0 = useFadeIn(0);
  const a1 = useFadeIn(100);
  const a2 = useFadeIn(200);
  const a3 = useFadeIn(320);
  const a4 = useFadeIn(420);
  const a5 = useFadeIn(500);
  const a6 = useFadeIn(580);

  return (
    <div key={dark ? 'd' : 'l'} style={{
      width: "100%", maxWidth: 420, position: "relative",
      display: "flex", flexDirection: "column", alignItems: "center",
      paddingTop: "max(40px, env(safe-area-inset-top, 40px))",
      paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))",
    }}>

      {/* Theme toggle */}
      <div style={{ position: "absolute", top: "max(40px, env(safe-area-inset-top, 40px))", right: 0, zIndex: 10, ...a0 }}>
        <ThemeBtn dark={dark} toggle={toggleTheme} P={P}/>
      </div>

      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 28, ...a0 }}>
        <a href="https://bythiagofigueiredo.com" target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
        >
          <Carimbo size={58}/>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3.5, marginTop: 2 }}>
            <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 300, fontStyle: "italic", fontSize: 13, opacity: 0.5, color: P.ink }}>by</span>
            <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em", color: P.ink }}>Thiago Figueiredo</span>
            <span style={{ display: "inline-block", marginLeft: 1, transform: "translateY(-3px)" }}><Asterisk/></span>
          </div>
        </a>
        <p style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10, color: P.muted, textAlign: "center",
          lineHeight: 1.6, letterSpacing: "0.02em", whiteSpace: "nowrap",
        }}>
          {L === "pt" ? "dev indie · blog · YouTube · 6 apps" : "indie dev · blog · YouTube · 6 apps"}
        </p>
      </div>

      {/* Highlight */}
      <div style={{ width: "100%", marginBottom: 18 }}>
        <HighlightCard data={HIGHLIGHT} L={L} P={P} animStyle={a1}/>
      </div>

      {/* Latest */}
      <div style={{ width: "100%", marginBottom: 20, ...a2 }}>
        <Paper rotation={-1.2} pad="14px 16px" shadow={P.shadow} style={{ overflow: "hidden" }}>
          <Tape color={P.tape} rot={4} style={{ top: -5, right: -6 }} w={76}/>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 600,
              letterSpacing: "0.14em", textTransform: "uppercase", color: P.faint,
            }}>{L === "pt" ? "Novidades" : "What's new"}</span>
            <Hand style={{ fontSize: 14, opacity: 0.6 }}>
              {L === "pt" ? "fresquinho ✦" : "fresh ✦"}
            </Hand>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <LatestCard type="post" data={LATEST.post} L={L} P={P}/>
            <LatestCard type="video" data={LATEST.video} L={L} P={P}/>
          </div>
        </Paper>
      </div>

      {/* Language Sections */}
      {order.map((key, i) => (
        <div key={key} style={{ width: "100%", marginBottom: i === 0 ? 18 : 16 }}>
          <LangSection
            section={SECTIONS[key]} L={L} P={P}
            tapeColor={i === 0 ? P.tape : P.tape2}
            rot={i === 0 ? 1 : -0.8}
            tapeRot={i === 0 ? -3 : 4}
            animStyle={i === 0 ? a3 : a4}
          />
        </div>
      ))}

      {/* Shared links — compact row */}
      <div style={{ width: "100%", marginBottom: 0, ...a5 }}>
        <Paper rotation={0.6} pad="4px 0" shadow={P.shadow} style={{ overflow: "hidden" }}>
          <Tape color={P.tape} rot={-2.5} style={{ top: -5, left: 16 }} w={52}/>
          {SHARED_LINKS.map((item, i) => (
            <LinkRow key={item.id} item={item} L={L} isLast={i === SHARED_LINKS.length - 1} P={P}/>
          ))}
        </Paper>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 28, ...a6 }}>
        <SocialBar P={P}/>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5,
          color: P.faint, opacity: 0.4, letterSpacing: "0.05em",
        }}>go.bythiagofigueiredo.com</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.2 }}>
          <div style={{ width: 18, height: 1, background: P.accent }}/>
          <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: P.accent, fontSize: 12 }}>❦</span>
          <div style={{ width: 18, height: 1, background: P.accent }}/>
        </div>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<LinktreeApp/>);
