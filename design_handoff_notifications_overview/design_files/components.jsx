/* ============================================================
   Shared components + icon set (lucide-style inline SVG).
   Exposed on window for other babel scripts.
   ============================================================ */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- ICONS ---------- */
const P = (d) => <path key={d} d={d} />;
const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  upnext: <>{P("m3 17 2 2 4-4")}{P("m3 7 2 2 4-4")}{P("M13 6h8")}{P("M13 12h8")}{P("M13 18h8")}</>,
  calendar: <>{P("M8 2v4")}{P("M16 2v4")}<rect x="3" y="4" width="18" height="18" rx="2"/>{P("M3 10h18")}</>,
  trending: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  blog: <>{P("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z")}{P("M14 2v6h6")}{P("M16 13H8")}{P("M16 17H8")}{P("M10 9H8")}</>,
  video: <>{P("m22 8-6 4 6 4V8Z")}<rect x="2" y="6" width="14" height="12" rx="2"/></>,
  courses: <>{P("M22 10v6")}{P("M2 10l10-5 10 5-10 5z")}{P("M6 12v5c3 3 9 3 12 0v-5")}</>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2"/>{P("m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7")}</>,
  megaphone: <>{P("m3 11 18-5v12L3 14v-3z")}{P("M11.6 16.8a3 3 0 1 1-5.8-1.6")}</>,
  playlist: <>{P("M21 15V6")}{P("M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z")}{P("M12 12H3")}{P("M16 6H3")}{P("M12 18H3")}</>,
  research: <><circle cx="11" cy="11" r="8"/>{P("m21 21-4.3-4.3")}{P("M11 8v6")}{P("M8 11h6")}</>,
  reference: <>{P("M12 7v14")}{P("M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z")}</>,
  media: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>{P("m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21")}</>,
  audio: <>{P("M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-7a9 9 0 0 1 18 0v7a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3")}</>,
  youtube: <>{P("M22.5 6.4a2.8 2.8 0 0 0-1.9-2C18.9 4 12 4 12 4s-6.9 0-8.6.46a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.8 2.8 0 0 0 3.4 19c1.7.46 8.6.46 8.6.46s6.9 0 8.6-.46a2.8 2.8 0 0 0 1.9-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z")}{P("m9.75 15 5.75-3.27-5.75-3.23z")}</>,
  posts: <>{P("m22 2-7 20-4-9-9-4Z")}{P("M22 2 11 13")}</>,
  link: <>{P("M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7")}{P("M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7")}</>,
  linkbio: <>{P("M15 3h6v6")}{P("M10 14 21 3")}{P("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6")}</>,
  authors: <>{P("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2")}<circle cx="9" cy="7" r="4"/>{P("M22 21v-2a4 4 0 0 0-3-3.9")}{P("M16 3.1a4 4 0 0 1 0 7.8")}</>,
  user: <>{P("M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2")}<circle cx="12" cy="7" r="4"/></>,
  contacts: <>{P("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z")}</>,
  settings: <>{P("M20 7h-9")}{P("M14 17H5")}<circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></>,
  bell: <>{P("M10.3 21a1.9 1.9 0 0 0 3.4 0")}{P("M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9")}</>,
  belloff: <>{P("M8.7 3A6 6 0 0 1 18 8c0 .6 0 1.2.1 1.7")}{P("M17 17H3s3-2 3-9")}{P("M10.3 21a1.9 1.9 0 0 0 3.4 0")}{P("m2 2 20 20")}</>,
  search: <><circle cx="11" cy="11" r="8"/>{P("m21 21-4.3-4.3")}</>,
  plus: <>{P("M5 12h14")}{P("M12 5v14")}</>,
  check: <>{P("M20 6 9 17l-5-5")}</>,
  checkcheck: <>{P("M18 6 7 17l-5-5")}{P("m22 10-7.5 7.5L13 15")}</>,
  x: <>{P("M18 6 6 18")}{P("m6 6 12 12")}</>,
  chevronr: <>{P("m9 18 6-6-6-6")}</>,
  chevrond: <>{P("m6 9 6 6 6-6")}</>,
  chevronl: <>{P("m15 18-6-6 6-6")}</>,
  warn: <>{P("m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z")}{P("M12 9v4")}{P("M12 17h.01")}</>,
  info: <><circle cx="12" cy="12" r="10"/>{P("M12 16v-4")}{P("M12 8h.01")}</>,
  checkcircle: <><circle cx="12" cy="12" r="10"/>{P("m9 12 2 2 4-4")}</>,
  clock: <><circle cx="12" cy="12" r="10"/>{P("M12 6v6l4 2")}</>,
  zap: <>{P("M4 14a1 1 0 0 1-.8-1.6l9.9-10.2a.5.5 0 0 1 .9.5l-1.9 6a1 1 0 0 0 .9 1.3h7a1 1 0 0 1 .8 1.6l-9.9 10.2a.5.5 0 0 1-.9-.5l1.9-6a1 1 0 0 0-.9-1.3z")}</>,
  flame: <>{P("M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z")}</>,
  sparkles: <>{P("m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z")}{P("M5 19l.6 1.7L7.5 21l-1.9.6L5 23l-.6-1.4L2.5 21l1.9-.7z")}</>,
  eye: <>{P("M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z")}<circle cx="12" cy="12" r="3"/></>,
  click: <>{P("m9 9 5 12 1.8-5.2L21 14z")}{P("M7.2 2.2 8 5.1")}{P("M5.1 8 2.2 7.2")}{P("M14 4.1 12 6")}{P("M6 12l-1.9 2")}</>,
  arrowup: <>{P("M7 17 17 7")}{P("M7 7h10v10")}</>,
  arrowdown: <>{P("m7 7 10 10")}{P("M17 7v10H7")}</>,
  arrowright: <>{P("M5 12h14")}{P("m12 5 7 7-7 7")}</>,
  inbox: <>{P("M22 12h-6l-2 3h-4l-2-3H2")}{P("M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z")}</>,
  moon: <>{P("M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z")}</>,
  sun: <><circle cx="12" cy="12" r="4"/>{P("M12 2v2")}{P("M12 20v2")}{P("m4.9 4.9 1.4 1.4")}{P("m17.7 17.7 1.4 1.4")}{P("M2 12h2")}{P("M20 12h2")}{P("m4.9 19.1 1.4-1.4")}{P("m17.7 6.3 1.4-1.4")}</>,
  sliders: <>{P("M4 21v-7")}{P("M4 10V3")}{P("M12 21v-9")}{P("M12 8V3")}{P("M20 21v-5")}{P("M20 12V3")}{P("M1 14h6")}{P("M9 8h6")}{P("M17 16h6")}</>,
  filter: <>{P("M22 3H2l8 9.5V19l4 2v-8.5z")}</>,
  trophy: <>{P("M6 9H4.5a2.5 2.5 0 0 1 0-5H6")}{P("M18 9h1.5a2.5 2.5 0 0 0 0-5H18")}{P("M4 22h16")}{P("M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22")}{P("M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 4")}{P("M18 2H6v7a6 6 0 0 0 12 0V2z")}</>,
  target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  gauge: <>{P("m12 14 4-4")}{P("M3.3 19a10 10 0 1 1 17.3 0z")}</>,
  globe: <><circle cx="12" cy="12" r="10"/>{P("M2 12h20")}{P("M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z")}</>,
  phone: <><rect x="5" y="2" width="14" height="20" rx="2.5"/>{P("M12 18h.01")}</>,
  dollar: <>{P("M12 1v22")}{P("M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6")}</>,
  more: <><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></>,
  pin: <>{P("M12 17v5")}{P("M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z")}</>,
  archive: <><rect x="2" y="4" width="20" height="5" rx="1.5"/>{P("M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9")}{P("M10 13h4")}</>,
  refresh: <>{P("M3 12a9 9 0 0 1 15-6.7L21 8")}{P("M21 3v5h-5")}{P("M21 12a9 9 0 0 1-15 6.7L3 16")}{P("M3 21v-5h5")}</>,
  play: <path d="m6 3 14 9-14 9z" fill="currentColor" stroke="none"/>,
  flask: <>{P("M9 3h6")}{P("M10 9 4.5 18a1 1 0 0 0 .9 1.5h13.2a1 1 0 0 0 .9-1.5L14 9")}{P("M10 3v6")}{P("M14 3v6")}{P("M7.5 14h9")}</>,
  edit: <>{P("M12 20h9")}{P("M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z")}</>,
  grip: <><circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/></>,
  rss: <>{P("M4 11a9 9 0 0 1 9 9")}{P("M4 4a16 16 0 0 1 16 16")}<circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none"/></>,
  layers: <>{P("m12 2 9 5-9 5-9-5z")}{P("m3 12 9 5 9-5")}{P("m3 17 9 5 9-5")}</>,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>,
  partypop: <>{P("M5.8 11.3 2 22l10.7-3.8")}{P("M4 3h.01")}{P("M22 8h.01")}{P("M15 2h.01")}{P("M22 20h.01")}{P("M22 2 19.8 2.8a2.9 2.9 0 0 0-2 3.1c.1.9-.6 1.6-1.4 1.6h-.4c-.9 0-1.6.6-1.8 1.4")}{P("M11.4 11.4a2.9 2.9 0 0 0-3.1-2c-.9.1-1.6-.6-1.6-1.4v-.4c0-.9-.6-1.6-1.4-1.8")}</>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1"/>{P("M12 8v13")}{P("M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7")}{P("M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8 M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8")}</>,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>,
};

function Icon({ name, size = 18, sw = 2, style, className = "" }) {
  const body = ICONS[name] || ICONS.dot;
  return (
    <svg className={"lucide " + className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {body}
    </svg>
  );
}

/* ---------- DOMAIN META ---------- */
const DOMAINS = {
  pipeline:   { label: "Pipeline",   color: "var(--c-pipeline)",   soft: "var(--c-pipeline-s)",   icon: "layers" },
  youtube:    { label: "YouTube",    color: "var(--c-youtube)",    soft: "var(--c-youtube-s)",    icon: "youtube" },
  newsletter: { label: "Newsletter", color: "var(--c-newsletter)", soft: "var(--c-newsletter-s)", icon: "mail" },
  social:     { label: "Social",     color: "var(--c-social)",     soft: "var(--c-social-s)",     icon: "posts" },
  links:      { label: "Links",      color: "var(--c-links)",      soft: "var(--c-links-s)",      icon: "link" },
  system:     { label: "Sistema",    color: "var(--c-system)",     soft: "var(--c-system-s)",     icon: "settings" },
};

/* ---------- PRIMITIVES ---------- */
function Card({ children, className = "", style, ...rest }) {
  return <div className={"card " + className} style={style} {...rest}>{children}</div>;
}
function CardHead({ icon, title, link, onLink, right }) {
  return (
    <div className="card-head">
      {icon && <Icon name={icon} size={16} />}
      <span className="card-title">{title}</span>
      {right}
      {link && <a className="card-link" onClick={onLink}>{link}<Icon name="arrowright" size={13} /></a>}
    </div>
  );
}
function Badge({ children, kind, dot, className = "" }) {
  const cls = kind ? (["ok","warn","danger"].includes(kind) ? kind : "solid-" + kind) : "";
  return <span className={"badge " + cls + " " + className}>{dot && <span className="dot" />}{children}</span>;
}
function Skel({ h = 16, w = "100%", r = 8, style }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}
function EmptyState({ icon = "inbox", title, sub, action }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} size={22} /></div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
      {action}
    </div>
  );
}

/* ---------- SPARKLINE ---------- */
function Sparkline({ data, color = "var(--accent)", h = 32, fill = true, w = 220 }) {
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  const id = "sg" + Math.random().toString(36).slice(2, 7);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height: h }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.22" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---------- DONUT / RING ---------- */
function Ring({ value, size = 56, sw = 6, color = "var(--accent)", label, sub }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: size > 50 ? 16 : 13, fontWeight: 700, lineHeight: 1 }}>{label}</div>
          {sub && <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: ".5px", color: "var(--text-dim)", textTransform: "uppercase", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- relative time ---------- */
/* Format table: agora (<1min), Xmin (1-59), Xh (1-23), ontem (24-47h),
   Xd (2-6), Xsem (1-4), dd/mm (>4sem) */
function rel(mins) {
  if (mins < 1) return "agora";
  if (mins < 60) return mins + "min";
  const h = Math.floor(mins / 60);
  if (h < 24) return h + "h";
  if (h < 48) return "ontem";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d";
  const w = Math.floor(d / 7);
  if (w <= 4) return w + "sem";
  const now = new Date();
  const then = new Date(now.getTime() - mins * 60000);
  return String(then.getDate()).padStart(2, "0") + "/" + String(then.getMonth() + 1).padStart(2, "0");
}

Object.assign(window, { Icon, ICONS, DOMAINS, Card, CardHead, Badge, Skel, EmptyState, Sparkline, Ring, rel,
  React, useState, useEffect, useRef, useMemo, useCallback });
