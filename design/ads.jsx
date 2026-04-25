/*
 * ads.jsx — Ad slot components for bythiagofigueiredo
 *
 * Philosophy: editorial-first. Every ad is clearly labeled. Reader-respectful:
 *   • All slots can be dismissed (state stored in localStorage by ad id)
 *   • Master toggle disables all ads
 *   • Each slot type can be individually disabled via Tweaks
 *   • Frequency capped: max 1 in-body slot per ~8 paragraphs
 *   • Never deceptive — always "PATROCINADO" / "DA CASA" label
 *   • Respects prefers-reduced-motion
 *
 * Slot types:
 *   1. Marginalia      — small note in the left margin (TOC rail)
 *   2. Anchor          — sticky right-rail card (above key points)
 *   3. Bookmark        — paper scrap stuck mid-article (rotated, taped)
 *   4. Coda            — large card after article body
 *   5. Doorman         — dismissable banner above article (off by default)
 *   6. Bowtie          — newsletter-style inline card (replaces inline newsletter)
 *   7. Sidekick        — alias of Anchor for homepage usage
 *
 * Each component takes:
 *   - ad: object from window.AdsContent.sponsors or houseAds
 *   - L:  language ("pt" | "en")
 *   - theme: theme tokens object
 *   - onDismiss?: optional callback after user dismisses
 */

// ---------- localStorage helpers ----------
const DISMISS_KEY = "btf_ads_dismissed";
const getDismissed = () => {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}"); }
  catch { return {}; }
};
const setDismissed = (id) => {
  const d = getDismissed();
  d[id] = Date.now();
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(d)); } catch {}
};

// ---------- shared hook: dismissable ----------
const useDismissable = (id, onDismiss) => {
  const [dismissed, setLocal] = React.useState(() => Boolean(getDismissed()[id]));
  const dismiss = React.useCallback(() => {
    setDismissed(id);
    setLocal(true);
    if (onDismiss) onDismiss();
  }, [id, onDismiss]);
  return [dismissed, dismiss];
};

// ---------- shared atoms ----------
const AdLabel = ({ ad, L, theme, color }) => (
  <div style={{
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 9, letterSpacing: "0.18em",
    color: color || theme.muted, textTransform: "uppercase", fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 6,
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: ad.brandColor, display: "inline-block",
    }}/>
    {ad["label_" + L] || ad.label_pt}
  </div>
);

const DismissButton = ({ onClick, theme, label }) => (
  <button
    onClick={onClick}
    aria-label={label || "Dismiss"}
    style={{
      background: "transparent", border: "none",
      color: theme.muted, cursor: "pointer", padding: 4,
      fontSize: 14, lineHeight: 1, opacity: 0.55,
      transition: "opacity 0.15s",
    }}
    onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
    onMouseLeave={(e) => e.currentTarget.style.opacity = "0.55"}
  >×</button>
);

// ---------- 1. Marginalia ----------
// Small note that lives in the left rail (replaces or sits below TOC).
// Tone: like a printed margin note. Quiet, not screaming.
// variant: "default" (dashed-border note on any page)
//          "paper"   (torn-notepad feel for the pinboard home)
const Marginalia = ({ ad, L, theme, variant = "default" }) => {
  const [dismissed, dismiss] = useDismissable("m_" + ad.id);
  if (dismissed) return null;
  const isHouse = (ad["label_" + L] || ad.label_pt || "").toUpperCase().includes("CASA") || (ad["label_" + L] || "").toUpperCase().includes("HOUSE");
  const paperBg = theme.dark ? "#312A1E" : "#F5EDD6";
  const wrapStyle = variant === "paper" ? {
    position: "relative",
    padding: "14px 16px 14px",
    background: paperBg,
    color: theme.ink,
    boxShadow: theme.dark
      ? "0 4px 12px rgba(0,0,0,0.28)"
      : "0 3px 10px rgba(60,40,20,0.10)",
    transform: "rotate(0.5deg)",
    // Torn-top edge
    clipPath: "polygon(0 6px, 4% 2px, 10% 5px, 18% 1px, 26% 4px, 34% 0, 42% 3px, 50% 1px, 58% 4px, 66% 0, 74% 3px, 82% 1px, 90% 4px, 96% 2px, 100% 5px, 100% 100%, 0 100%)",
  } : {
    paddingTop: 16, marginTop: 16,
    borderTop: `1px dashed ${theme.line}`,
    position: "relative",
  };
  return (
    <div style={wrapStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 8, paddingTop: variant === "paper" ? 6 : 0 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 9, letterSpacing: "0.16em", fontWeight: 700,
          color: isHouse ? theme.muted : ad.brandColor,
          textTransform: "uppercase",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: isHouse ? theme.muted : ad.brandColor, display: "inline-block",
          }}/>
          {ad["label_" + L] || ad.label_pt}
        </span>
        <DismissButton onClick={dismiss} theme={theme} label={L === "pt" ? "Fechar" : "Close"}/>
      </div>
      <a href={ad.url} style={{ textDecoration: "none", display: "block" }}>
        <div style={{
          fontFamily: '"Fraunces", serif',
          fontSize: 14, fontWeight: 500,
          color: theme.ink, lineHeight: 1.25,
          marginBottom: 6,
          letterSpacing: "-0.005em",
        }}>
          {ad["headline_" + L]}
        </div>
        <div style={{
          fontSize: 12, color: theme.muted,
          lineHeight: 1.45, marginBottom: 8,
          fontFamily: '"Source Serif 4", Georgia, serif',
        }}>
          {ad["body_" + L].split(".")[0] + "."}
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10, letterSpacing: "0.06em",
          color: isHouse ? theme.accent : ad.brandColor, fontWeight: 600,
          textTransform: "none",
        }}>
          {ad["cta_" + L]}
        </div>
      </a>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 9, color: theme.faint,
        letterSpacing: "0.04em", marginTop: 6,
      }}>
        {ad.brand} · {ad["tagline_" + L]}
      </div>
    </div>
  );
};

// ---------- 2/7. Anchor (right rail sticky) / Sidekick alias ----------
// variant: "default" (rigid border card, for post pages)
//          "paper"   (taped paper scrap, for the pinboard home)
const Anchor = ({ ad, L, theme, variant = "default" }) => {
  const [dismissed, dismiss] = useDismissable("a_" + ad.id);
  if (dismissed) return null;
  const isHouse = (ad["label_" + L] || ad.label_pt || "").toUpperCase().includes("CASA") || (ad["label_" + L] || "").toUpperCase().includes("HOUSE");
  const paperBg = theme.dark ? "#2A241A" : "#FBF6E8";
  const wrapStyle = variant === "paper" ? {
    position: "relative",
    padding: "18px 20px 18px",
    background: paperBg,
    color: theme.ink,
    boxShadow: theme.dark
      ? "0 10px 22px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.03)"
      : "0 6px 16px rgba(60,40,20,0.12), inset 0 0 0 1px rgba(0,0,0,0.03)",
    transform: "rotate(-0.4deg)",
  } : {
    padding: "14px 14px 16px",
    border: `1px solid ${theme.line}`,
    background: theme.paper2,
    position: "relative",
  };
  return (
    <div style={wrapStyle}>
      {variant === "paper" && (
        <div style={{
          position: "absolute", top: -9, left: "50%",
          transform: "translateX(-50%) rotate(2deg)",
          width: 70, height: 16,
          background: isHouse ? "rgba(255,226,140,0.72)" : "rgba(255,180,120,0.72)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
        }}/>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
          color: isHouse ? theme.ink : "#FFFCEE",
          background: isHouse ? "transparent" : ad.brandColor,
          border: isHouse ? `1px dashed ${theme.muted}` : "none",
          padding: "3px 7px", borderRadius: 2,
        }}>
          {ad["label_" + L]}
        </span>
        <DismissButton onClick={dismiss} theme={theme}/>
      </div>
      <a href={ad.url} style={{ textDecoration: "none", display: "block", color: "inherit" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
          <div
            style={{ flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: ad.mark }}
          />
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, letterSpacing: "0.04em",
            color: theme.muted, lineHeight: 1.4,
            paddingTop: 2,
          }}>
            <div style={{ fontWeight: 600, color: theme.ink, fontSize: 11, marginBottom: 2 }}>
              {ad.brand}
            </div>
            {ad["tagline_" + L]}
          </div>
        </div>
        <div style={{
          fontFamily: '"Fraunces", serif',
          fontSize: 16, fontWeight: 500, lineHeight: 1.22,
          color: theme.ink, marginBottom: 8,
          letterSpacing: "-0.01em", textWrap: "balance",
        }}>
          {ad["headline_" + L]}
        </div>
        <div style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 13, color: theme.muted, lineHeight: 1.5,
          marginBottom: 12,
        }}>
          {ad["body_" + L]}
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11, letterSpacing: "0.06em",
          color: ad.brandColor, fontWeight: 600,
          paddingTop: 10, borderTop: `1px dashed ${theme.line}`,
        }}>
          {ad["cta_" + L]}
        </div>
      </a>
    </div>
  );
};

const Sidekick = Anchor; // alias

// ---------- 2b. HorizontalAnchor (full-width horizontal row ad) ----------
// Designed for between-section placement. Lays out: [label+mark] [headline+body] [cta]
// in a single row so it doesn't create dead space beside it.
const HorizontalAnchor = ({ ad, L, theme }) => {
  const [dismissed, dismiss] = useDismissable("h_" + ad.id);
  if (dismissed) return null;
  const isHouse = (ad["label_" + L] || ad.label_pt || "").toUpperCase().includes("CASA") || (ad["label_" + L] || "").toUpperCase().includes("HOUSE");
  const bg = theme.dark ? "#1E1A12" : "#F3EAD4";
  return (
    <div style={{
      position: "relative",
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      gap: 28,
      alignItems: "center",
      padding: "18px 22px 20px",
      background: bg,
      borderTop: `1px dashed ${theme.line}`,
      borderBottom: `1px dashed ${theme.line}`,
    }}>
      {/* Left: mark + brand column */}
      <a href={ad.url} style={{
        textDecoration: "none", color: "inherit",
        display: "flex", alignItems: "center", gap: 12,
        minWidth: 0, paddingRight: 20, borderRight: `1px dashed ${theme.line}`,
      }}>
        <div style={{ flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: ad.mark }}/>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
            color: isHouse ? theme.muted : ad.brandColor,
            marginBottom: 4, textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isHouse ? theme.muted : ad.brandColor,
            }}/>
            {ad["label_" + L]}
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11, color: theme.ink, fontWeight: 600,
            letterSpacing: "0.04em",
          }}>
            {ad.brand}
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, color: theme.muted, letterSpacing: "0.04em",
            marginTop: 2,
          }}>
            {ad["tagline_" + L]}
          </div>
        </div>
      </a>

      {/* Middle: headline + body */}
      <a href={ad.url} style={{
        textDecoration: "none", color: "inherit", minWidth: 0,
      }}>
        <div style={{
          fontFamily: '"Fraunces", serif',
          fontSize: 19, fontWeight: 500, lineHeight: 1.22,
          color: theme.ink, marginBottom: 6,
          letterSpacing: "-0.01em", textWrap: "balance",
        }}>
          {ad["headline_" + L]}
        </div>
        <div style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 13.5, color: theme.muted, lineHeight: 1.5,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {ad["body_" + L]}
        </div>
      </a>

      {/* Right: CTA + dismiss */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        <DismissButton onClick={dismiss} theme={theme} label={L === "pt" ? "Fechar" : "Close"}/>
        <a href={ad.url} style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11, letterSpacing: "0.1em", fontWeight: 600,
          color: isHouse ? theme.accent : ad.brandColor,
          textDecoration: "none",
          padding: "9px 14px",
          border: `1px solid ${isHouse ? theme.accent : ad.brandColor}`,
          whiteSpace: "nowrap",
          transition: "background 0.15s, color 0.15s",
        }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isHouse ? theme.accent : ad.brandColor;
            e.currentTarget.style.color = "#FFFCEE";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = isHouse ? theme.accent : ad.brandColor;
          }}
        >
          {ad["cta_" + L]}
        </a>
      </div>
    </div>
  );
};

// ---------- 3. Bookmark (paper scrap mid-article) ----------
// A taped scrap of paper, slightly rotated. Editorial / personal feel.
const Bookmark = ({ ad, L, theme }) => {
  const [dismissed, dismiss] = useDismissable("b_" + ad.id);
  if (dismissed) return null;

  const tape = "rgba(255,180,120,0.72)";

  return (
    <div style={{
      margin: "44px 0",
      display: "flex", justifyContent: "center",
    }}>
      <div style={{
        position: "relative",
        background: theme.dark ? "#F2EBDB" : "#FFFCEE",
        color: "#1A140C",
        padding: "20px 24px 20px",
        maxWidth: 540, width: "100%",
        boxShadow: theme.dark
          ? "0 10px 24px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.04)"
          : "0 6px 18px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.04)",
        transform: "rotate(-0.2deg)",
      }}>
        {/* Tape */}
        <div style={{
          position: "absolute", top: -10, left: "50%",
          transform: "translateX(-50%) rotate(2deg)",
          width: 72, height: 18,
          background: tape,
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
        }}/>

        {/* Header row — prominent PATROCINADO label */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
            color: "#FFFCEE",
            background: ad.brandColor,
            padding: "4px 8px", borderRadius: 2,
          }}>
            {ad["label_" + L]}
          </span>
          <DismissButton onClick={dismiss} theme={{ ...theme, muted: "#5A4A3C" }}/>
        </div>

        {/* Brand mark + brand line */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div dangerouslySetInnerHTML={{ __html: ad.mark }}/>
          <div>
            <div style={{
              fontFamily: '"Fraunces", serif',
              fontSize: 16, fontWeight: 500,
              color: "#1A140C", lineHeight: 1.1,
              marginBottom: 2,
            }}>
              {ad.brand}
            </div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, letterSpacing: "0.06em",
              color: "#5A4A3C",
            }}>
              {ad["tagline_" + L]}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{
          fontFamily: '"Fraunces", serif',
          fontSize: 19, fontWeight: 500, lineHeight: 1.22,
          color: "#1A140C", marginBottom: 10,
          letterSpacing: "-0.01em", textWrap: "balance",
        }}>
          {ad["headline_" + L]}
        </div>
        <div style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 14, color: "#3A2E22", lineHeight: 1.5,
          marginBottom: 16,
        }}>
          {ad["body_" + L]}
        </div>

        {/* CTA */}
        <a href={ad.url} style={{
          display: "inline-block",
          padding: "9px 16px",
          background: "#1A140C",
          color: "#FFFCEE",
          textDecoration: "none",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11, letterSpacing: "0.12em",
          textTransform: "uppercase", fontWeight: 600,
        }}>
          {ad["cta_" + L]}
        </a>
      </div>
    </div>
  );
};

// ---------- 4. Coda (large card after article body) ----------
// Editorial card with serif headline, plenty of breathing room.
const Coda = ({ ad, L, theme }) => {
  const [dismissed, dismiss] = useDismissable("c_" + ad.id);
  if (dismissed) return null;

  return (
    <div style={{
      marginTop: 48, padding: "32px 32px 28px",
      border: `2px solid ${theme.line}`,
      borderTop: `4px solid ${ad.brandColor}`,
      position: "relative",
      background: theme.dark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.012)",
    }}>
      <div style={{ position: "absolute", top: 14, right: 14 }}>
        <DismissButton onClick={dismiss} theme={theme}/>
      </div>

      <div style={{ marginBottom: 20 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
          color: "#FFFCEE", background: ad.brandColor,
          padding: "4px 9px", borderRadius: 2,
        }}>
          {ad["label_" + L]}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "flex-start" }}>
        {/* Mark */}
        <div style={{
          padding: 14,
          background: theme.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
          border: `1px solid ${theme.line}`,
          flexShrink: 0,
        }}>
          <div dangerouslySetInnerHTML={{ __html: ad.mark }}/>
        </div>

        {/* Body */}
        <div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11, letterSpacing: "0.1em",
            color: theme.muted, marginBottom: 6,
          }}>
            {ad.brand} · {ad["tagline_" + L]}
          </div>
          <div style={{
            fontFamily: '"Fraunces", serif',
            fontSize: 26, fontWeight: 500, lineHeight: 1.15,
            color: theme.ink, marginBottom: 12,
            letterSpacing: "-0.015em", textWrap: "balance",
          }}>
            {ad["headline_" + L]}
          </div>
          <div style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 16, color: theme.ink, lineHeight: 1.55,
            marginBottom: 22, opacity: 0.9,
          }}>
            {ad["body_" + L]}
          </div>
          <a href={ad.url} style={{
            display: "inline-block",
            padding: "12px 22px",
            background: ad.brandColor, color: "#FFF",
            textDecoration: "none",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 12, letterSpacing: "0.1em",
            textTransform: "uppercase", fontWeight: 600,
          }}>
            {ad["cta_" + L]}
          </a>
        </div>
      </div>
    </div>
  );
};

// ---------- 5. Doorman (dismissable banner above article) ----------
const Doorman = ({ ad, L, theme }) => {
  const [dismissed, dismiss] = useDismissable("d_" + ad.id);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (dismissed) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setVisible(true), reduce ? 0 : 300);
    return () => clearTimeout(t);
  }, [dismissed]);
  if (dismissed) return null;

  return (
    <div style={{
      width: "100%",
      background: ad.brandColor,
      color: "#FFF",
      padding: "12px 20px",
      display: "flex", alignItems: "center", gap: 14,
      flexWrap: "wrap",
      transform: visible ? "translateY(0)" : "translateY(-100%)",
      opacity: visible ? 1 : 0,
      transition: "transform 0.4s cubic-bezier(.2,.8,.2,1), opacity 0.4s",
      position: "relative",
    }}>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", fontWeight: 700,
        padding: "3px 8px", borderRadius: 2,
        background: "rgba(255,255,255,0.18)",
      }}>
        {ad["label_" + L]}
      </div>
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.4, minWidth: 240 }}>
        <strong style={{ fontWeight: 600 }}>{ad["headline_" + L]}</strong>
        <span style={{ opacity: 0.85, marginLeft: 8 }}>{ad.brand}</span>
      </div>
      <a href={ad.url} style={{
        color: "#FFF", textDecoration: "none",
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11, letterSpacing: "0.1em",
        textTransform: "uppercase", fontWeight: 600,
        padding: "8px 14px",
        border: "1px solid rgba(255,255,255,0.5)",
      }}>
        {ad["cta_" + L]}
      </a>
      <button
        onClick={dismiss}
        aria-label={L === "pt" ? "Fechar" : "Close"}
        style={{
          background: "transparent", border: "none",
          color: "#FFF", cursor: "pointer", padding: 4,
          fontSize: 18, lineHeight: 1, opacity: 0.85,
        }}
      >×</button>
    </div>
  );
};

// ---------- 6. Bowtie (newsletter-style inline card) ----------
// House ad inline form with built-in submit. Ties off the article.
const Bowtie = ({ ad, L, theme }) => {
  const [dismissed, dismiss] = useDismissable("bw_" + ad.id);
  const [submitted, setSubmitted] = React.useState(false);
  if (dismissed) return null;

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const isHouse = ad.label_pt === "DA CASA";

  return (
    <div style={{
      marginTop: 48, padding: "32px 32px 28px",
      background: ad.brandColor, color: "#1A140C",
      position: "relative",
      transform: "rotate(-0.25deg)",
    }}>
      {/* Tape decoration */}
      <div style={{
        position: "absolute", top: -10, left: "40%",
        transform: "rotate(3deg)",
        width: 80, height: 18,
        background: "rgba(255,180,120,0.85)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
      }}/>

      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <DismissButton onClick={dismiss} theme={{ muted: "#1A140C" }} label={L === "pt" ? "Fechar" : "Close"}/>
      </div>

      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", fontWeight: 600,
        opacity: 0.7, marginBottom: 10,
      }}>
        {ad["label_" + L]}
      </div>

      <div style={{
        fontFamily: '"Fraunces", serif',
        fontSize: 26, fontWeight: 500, lineHeight: 1.15,
        marginBottom: 10, textWrap: "balance",
        letterSpacing: "-0.012em",
      }}>
        {ad["headline_" + L]}
      </div>
      <div style={{
        fontFamily: '"Source Serif 4", Georgia, serif',
        fontSize: 14, lineHeight: 1.55, marginBottom: 18, opacity: 0.85,
      }}>
        {ad["body_" + L]}
      </div>

      {isHouse && !submitted ? (
        <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="email" required placeholder={L === "pt" ? "voce@email.com" : "you@email.com"}
            style={{
              flex: 1, minWidth: 200,
              padding: "12px 14px", fontSize: 14,
              border: "1px solid #1A140C", background: "#FFFCEE",
              color: "#1A140C", fontFamily: '"Inter", sans-serif',
            }}
          />
          <button type="submit" style={{
            padding: "12px 20px", background: "#1A140C", color: ad.brandColor,
            border: "none", fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
            fontWeight: 600, cursor: "pointer",
          }}>
            {ad["cta_" + L]}
          </button>
        </form>
      ) : isHouse && submitted ? (
        <div style={{
          padding: "12px 16px",
          background: "rgba(26,20,12,0.08)",
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 14, fontStyle: "italic",
        }}>
          {L === "pt" ? "Recebido. Confira sua caixa." : "Got it. Check your inbox."}
        </div>
      ) : (
        <a href={ad.url} style={{
          display: "inline-block",
          padding: "12px 22px",
          background: "#1A140C", color: ad.brandColor,
          textDecoration: "none",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11, letterSpacing: "0.14em",
          textTransform: "uppercase", fontWeight: 600,
        }}>
          {ad["cta_" + L]}
        </a>
      )}
    </div>
  );
};

// ---------- Export ----------
Object.assign(window, {
  Marginalia,
  Anchor,
  HorizontalAnchor,
  Sidekick,
  Bookmark,
  Coda,
  Doorman,
  Bowtie,
  AdLabel,
  DismissButton,
  useDismissable,
  getAdsDismissed: getDismissed,
});
