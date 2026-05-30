/* ============================================================
   social/ui.jsx — primitivos (Icon, Btn, Badge, Card, Seg…)
   + Sidebar/Frame da sessão "Posts". Mesma linguagem do CMS.
   ============================================================ */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- Icons (stroke, 24x24) ---------- */
const SIP = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  upnext: "M4 6h10M4 12h10M4 18h7M18 8v8l5-4z",
  schedule: "M4 5h16v16H4zM4 9h16M8 3v4M16 3v4",
  calendar: "M4 5h16v16H4zM4 9h16M8 3v4M16 3v4",
  analytics: "M3 17l5-6 4 4 8-9M21 6h-4M21 6v4",
  blog: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  video: "M3 6h13v12H3zM16 9l5-3v12l-5-3",
  courses: "M3 8l9-4 9 4-9 4zM7 11v5c0 1.5 10 1.5 10 0v-5",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  megaphone: "M4 10v4l11 5V5L4 10zM4 10H3v4h1M18 8a4 4 0 010 8",
  playlist: "M4 7h12M4 12h12M4 17h7M17 13v6l4-3z",
  research: "M11 4a7 7 0 105 12 7 7 0 00-5-12zM21 21l-5-5",
  reference: "M5 4h13a1 1 0 011 1v15H6a1 1 0 01-1-1zM5 4v15",
  media: "M3 5h18v14H3zM3 16l5-5 4 4 4-4 5 5M9 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0",
  audio: "M5 14v-2a7 7 0 0114 0v2M5 14h2v5H5a1 1 0 01-1-1v-3a1 1 0 011-1zM19 14h-2v5h2a1 1 0 001-1v-3a1 1 0 00-1-1z",
  youtube: "M3 8a3 3 0 013-3h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3zM10 9l5 3-5 3z",
  posts: "M21 3L3 10l7 3 3 7z",
  links: "M9 15l6-6M10 6l1-1a4 4 0 016 6l-1 1M14 18l-1 1a4 4 0 01-6-6l1-1",
  linkbio: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5",
  authors: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1",
  subscribers: "M9 7a3 3 0 116 0 3 3 0 01-6 0zM3 20a6 6 0 0112 0M17 11a3 3 0 000-6M21 20a6 6 0 00-4-5.6",
  contacts: "M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM2 8h2M2 12h2M2 16h2M9 11a2 2 0 104 0 2 2 0 00-4 0M8 17a3 3 0 016 0",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 13a1.6 1.6 0 00.3 1.7l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004 13H3.9a2 2 0 110-4H4a1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0011 4V3.9a2 2 0 114 0V4a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0020 11h.1a2 2 0 110 4z",
  plus: "M12 5v14M5 12h14",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  check: "M20 6L9 17l-5-5",
  sparkles: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 4-4 5 5M9 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0",
  type: "M5 6V4h14v2M12 4v16M9 20h6",
  text: "M4 6h16M4 10h16M4 14h11M4 18h11",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  close: "M6 6l12 12M18 6L6 18",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v4l3 2",
  info: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 8h.01",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 018 0v3",
  refresh: "M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5",
  send: "M21 3L3 10l7 3 3 7z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v3M17 20h3M14 20v-1",
  sticker: "M5 4h9l5 5v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM14 4v5h5M8 14a3 3 0 006 0",
  poll: "M5 20V10M12 20V4M19 20v-7",
  warn: "M12 4l9 16H3zM12 10v4M12 17h.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z",
  list: "M4 6h16M4 12h16M4 18h16",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  move: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  zoomIn: "M11 4a7 7 0 105 12 7 7 0 00-5-12zM21 21l-5-5M11 8v6M8 11h6",
  zoomOut: "M11 4a7 7 0 105 12 7 7 0 00-5-12zM21 21l-5-5M8 11h6",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  heart: "M12 20s-7-4.6-9.5-9C1 8 2.8 4.5 6 4.5c2 0 3.2 1.3 4 2.4.8-1.1 2-2.4 4-2.4 3.2 0 5 3.5 3.5 6.5C19 15.4 12 20 12 20z",
  comment: "M4 5h16v11H9l-4 4z",
  share: "M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13",
  pin: "M12 21s7-6.3 7-12a7 7 0 10-14 0c0 5.7 7 12 7 12zM12 9a2 2 0 100 4 2 2 0 000-4",
  template: "M4 4h16v5H4zM4 12h7v8H4zM14 12h6v8h-6z",
  drag: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
  bookmark: "M6 4h12v16l-6-4-6 4z",
};
function Icon({ name, size = 18, stroke = 1.7, fill, style, className }) {
  const d = SIP[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={fill ? "none" : "currentColor"} strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      {d.split("M").filter(Boolean).map((seg, i) => (
        <path key={i} d={"M" + seg} fill={fill || "none"} />
      ))}
    </svg>
  );
}

/* ---------- Brand glyphs (preview chrome) — line, monocromático ---------- */
function PlatGlyph({ platform, size = 16, color = "currentColor" }) {
  if (platform === "instagram")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none" />
      </svg>
    );
  if (platform === "youtube")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <rect x="2.5" y="5" width="19" height="14" rx="4" />
        <path d="M10 9l5 3-5 3z" fill={color} stroke="none" />
      </svg>
    );
  if (platform === "facebook")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M13.5 8.5h1.6M13.5 8.5c0-1.2.5-2 2-2M13.5 8.5V18M13.5 12h3" />
      </svg>
    );
  return null;
}

/* ---------- Buttons ---------- */
function Btn({ kind = "ghost", size = "md", icon, iconRight, children, onClick, style, disabled, title }) {
  const pad = size === "sm" ? "6px 11px" : size === "lg" ? "12px 20px" : "9px 15px";
  const fs = size === "sm" ? 12.5 : size === "lg" ? 15 : 13.5;
  const base = {
    display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center",
    padding: pad, fontSize: fs, fontWeight: 600, borderRadius: 9,
    border: "1px solid transparent", whiteSpace: "nowrap",
    transition: "all 0.15s ease", letterSpacing: "-0.01em",
    opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : "auto", ...style,
  };
  const kinds = {
    primary: { background: "var(--accent)", color: "#1A120C", borderColor: "var(--accent)" },
    cowork:  { background: "var(--cowork)", color: "#fff" },
    ghost:   { background: "transparent", color: "var(--ink-dim)", borderColor: "var(--line-strong)" },
    soft:    { background: "var(--surface-2)", color: "var(--ink)", borderColor: "var(--line)" },
    quiet:   { background: "transparent", color: "var(--ink-dim)" },
    green:   { background: "var(--green)", color: "#0c1a12", borderColor: "var(--green)" },
    danger:  { background: "transparent", color: "var(--red)", borderColor: "rgba(217,97,74,0.4)" },
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      style={{ ...base, ...kinds[kind] }}
      onMouseEnter={(e) => { if (kind === "ghost" || kind === "quiet") e.currentTarget.style.background = "var(--surface-2)"; if (kind === "primary") e.currentTarget.style.background = "var(--accent-deep)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = kinds[kind].background; }}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 14 : 16} />}
    </button>
  );
}

/* ---------- Badge ---------- */
function Badge({ tone = "neutral", children, dot, icon, style }) {
  const tones = {
    neutral: { bg: "var(--surface-3)", fg: "var(--ink-dim)" },
    accent:  { bg: "var(--accent-soft)", fg: "var(--accent)" },
    green:   { bg: "var(--green-soft)", fg: "var(--green)" },
    amber:   { bg: "var(--amber-soft)", fg: "var(--amber)" },
    cowork:  { bg: "rgba(110,99,242,0.15)", fg: "#9b93f6" },
    red:     { bg: "rgba(217,97,74,0.15)", fg: "var(--red)" },
    live:    { bg: "var(--green-soft)", fg: "var(--green)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 600,
      letterSpacing: "0.06em", textTransform: "uppercase",
      background: t.bg, color: t.fg, ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: t.fg, animation: tone === "live" ? "slotPulse 1.6s infinite" : "none" }} />}
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

/* ---------- Card ---------- */
function Card({ children, pad = 20, style, hover, onClick, className }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} className={className}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: "var(--r)", padding: pad,
        transition: "border-color 0.18s, transform 0.18s, background 0.18s",
        cursor: onClick ? "pointer" : "default",
        ...(hover && h ? { borderColor: "var(--line-strong)" } : null),
        ...style,
      }}>
      {children}
    </div>
  );
}

/* ---------- Breadcrumb (navegação consistente) ---------- */
function Breadcrumb({ items, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "nowrap", minWidth: 0, ...style }}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            <span onClick={it.onClick} style={{
              fontSize: 12.5, fontWeight: last ? 600 : 500,
              color: last ? "var(--ink)" : "var(--ink-dim)",
              cursor: it.onClick ? "pointer" : "default",
              display: "inline-flex", alignItems: "center", gap: 6, transition: "color .15s",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: last ? 220 : "none", flexShrink: last ? 1 : 0,
            }}
              onMouseEnter={(e) => { if (it.onClick) e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { if (it.onClick) e.currentTarget.style.color = "var(--ink-dim)"; }}>
              {it.icon && <Icon name={it.icon} size={13} />}{it.label}
            </span>
            {!last && <Icon name="chevronRight" size={13} style={{ color: "var(--ink-faint)", opacity: 0.7, flexShrink: 0 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------- PageHeader (cabeçalho unificado) ---------- */
function PageHeader({ crumb, title, subtitle, actions, children }) {
  return (
    <div style={{ padding: "20px 30px 0" }}>
      {crumb && <Breadcrumb items={crumb} style={{ marginBottom: 10 }} />}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: subtitle ? 6 : (children ? 18 : 0) }}>
        <h1 className="serif" style={{ margin: 0, fontSize: 29, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{title}</h1>
        {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
      </div>
      {subtitle && <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: children ? 22 : 0, maxWidth: 640 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function SectionLabel({ children, right, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, ...style }}>
      <span className="eyebrow">{children}</span>
      {right}
    </div>
  );
}

/* ---------- Segmented control ---------- */
function Seg({ value, onChange, options, size = "md" }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--surface-2)", borderRadius: 9, padding: 3, gap: 2 }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: size === "sm" ? "5px 10px" : "6px 13px", borderRadius: 7, border: "none",
          fontSize: size === "sm" ? 12 : 12.5, fontWeight: 600,
          background: value === o.id ? "var(--accent)" : "transparent",
          color: value === o.id ? "#1A120C" : "var(--ink-dim)", transition: "all .15s",
        }}>{o.icon && <Icon name={o.icon} size={13} />}{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Toggle ---------- */
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 42, height: 24, borderRadius: 99, border: "none", padding: 3,
      background: on ? "var(--accent)" : "var(--surface-3)", transition: "background .2s",
      display: "flex", justifyContent: on ? "flex-end" : "flex-start", flexShrink: 0,
    }}>
      <span style={{ width: 18, height: 18, borderRadius: 99, background: "#fff", transition: "all .2s" }} />
    </button>
  );
}

/* ---------- PT/EN language toggle ---------- */
function LangToggle({ value, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--surface-2)", borderRadius: 8, padding: 2, gap: 1 }}>
      {["pt", "en"].map((l) => (
        <button key={l} onClick={() => onChange(l)} className="mono" style={{
          padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
          background: value === l ? "var(--accent)" : "transparent",
          color: value === l ? "#1A120C" : "var(--ink-dim)", transition: "all .15s",
        }}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

/* ============================================================
   SIDEBAR — sessão "Posts" ativa
   ============================================================ */
const SNAV = [
  { sec: "Overview" },
  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
  { id: "upnext", icon: "upnext", label: "Up Next" },
  { id: "schedule", icon: "schedule", label: "Schedule" },
  { id: "analytics", icon: "analytics", label: "Analytics" },
  { sec: "Content" },
  { id: "blog", icon: "blog", label: "Blog" },
  { id: "video", icon: "video", label: "Video" },
  { id: "courses", icon: "courses", label: "Courses" },
  { id: "newsletters", icon: "mail", label: "Newsletters", badges: ["1", "2"] },
  { id: "campaigns", icon: "megaphone", label: "Campaigns" },
  { id: "playlists", icon: "playlist", label: "Playlists" },
  { sec: "Social" },
  { id: "youtube", icon: "youtube", label: "YouTube" },
  { id: "posts", icon: "posts", label: "Posts" },
  { id: "links", icon: "links", label: "Links" },
  { id: "linkbio", icon: "linkbio", label: "Link in Bio" },
];

function Sidebar({ onHome, activeId = "posts", hideIds = [] }) {
  return (
    <aside style={{
      width: 232, flexShrink: 0, background: "var(--bg-side)",
      borderRight: "1px solid var(--line)", height: "100vh",
      position: "sticky", top: 0, display: "flex", flexDirection: "column",
      padding: "18px 12px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: "#1d1a14",
          border: "1px solid var(--line-strong)", display: "flex", alignItems: "center",
          justifyContent: "center", fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 15, color: "var(--ink)",
        }}>TF</div>
        <span style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: "-0.01em" }}>ByThiagoFigueiredo</span>
      </div>
      <nav style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {SNAV.filter((n) => !(n.id && hideIds.includes(n.id))).map((n, i) => {
          const active = n.id === activeId;
          return n.sec ? (
            <div key={i} className="eyebrow" style={{ padding: "16px 10px 6px", fontSize: 9.5 }}>{n.sec}</div>
          ) : (
            <a key={n.id} onClick={active ? onHome : undefined} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "8px 10px",
              borderRadius: 8, color: active ? "var(--accent)" : "var(--ink-dim)",
              background: active ? "var(--accent-soft)" : "transparent",
              fontSize: 13.5, fontWeight: active ? 600 : 500, cursor: "pointer", transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e)=>{ if(!active){ e.currentTarget.style.background="var(--surface)"; e.currentTarget.style.color="var(--ink)"; }}}
            onMouseLeave={(e)=>{ if(!active){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="var(--ink-dim)"; }}}>
              <Icon name={n.icon} size={17} stroke={1.6} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badges && n.badges.map((b, j) => (
                <span key={j} className="mono" style={{
                  fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
                  background: j === 0 ? "rgba(224,162,60,0.2)" : "var(--accent-soft)",
                  color: j === 0 ? "var(--amber)" : "var(--accent)",
                }}>{b}</span>
              ))}
            </a>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 8 }}>
        <a style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 8, color: "var(--ink-dim)", fontSize: 13.5, cursor: "pointer" }}>
          <Icon name="settings" size={17} /> Settings
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px 4px" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1A120C", fontWeight: 700, fontSize: 13 }}>T</div>
          <div style={{ lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>thiagojfreak@gmail…</div>
            <div className="eyebrow" style={{ fontSize: 9 }}>super_admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ---------- Frame (with optional custom head) ---------- */
function Frame({ children, head, onHome, activeId, hideIds }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar onHome={onHome} activeId={activeId} hideIds={hideIds} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>{children}</main>
    </div>
  );
}

Object.assign(window, {
  Icon, PlatGlyph, Btn, Badge, Card, Breadcrumb, PageHeader, SectionLabel, Seg, Toggle, LangToggle,
  Sidebar, Frame, useState, useEffect, useRef, useMemo, useCallback,
});
