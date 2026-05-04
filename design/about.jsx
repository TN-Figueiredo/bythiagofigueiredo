/*
 * About page — narrative-first, polaroid-led, paper-and-tape style.
 * Short (one-screen) bio that invites the reader to follow along.
 *
 * All text is editable via the Tweaks panel and persists to disk via
 * the EDITMODE block in about.html.
 */

const About = ({ tweaks, setTweak, dark, L }) => {
  // Theme — same paper-and-tape palette as Pinboard / newsletter-landing-v3
  const bg     = dark ? "#14110B" : "#E9E1CE";
  const paper  = dark ? "#2A241A" : "#FBF6E8";
  const paper2 = dark ? "#312A1E" : "#F5EDD6";
  const ink    = dark ? "#EFE6D2" : "#161208";
  const muted  = dark ? "#958A75" : "#6A5F48";
  const faint  = dark ? "#6B634F" : "#9C9178";
  const line   = dark ? "#2E2718" : "#CEBFA0";
  const accent = tweaks.accent || (dark ? "#FF8240" : "#C14513");
  const marker = "#FFE37A";
  const tape   = dark ? "rgba(255, 226, 140, 0.42)" : "rgba(255, 226, 140, 0.78)";
  const tape2  = dark ? "rgba(209, 224, 255, 0.36)" : "rgba(200, 220, 255, 0.72)";

  const hand  = { fontFamily: '"Caveat", cursive', color: accent };
  const mono  = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' };
  const serif = { fontFamily: '"Fraunces", serif' };

  const Tape = ({ color = tape, style = {} }) => (
    <div style={{
      position: "absolute", width: 78, height: 18, background: color,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)", ...style,
    }}/>
  );

  // ---------- copy (bilingual, all editable) ----------
  const copy = window.ABOUT_COPY[L];
  const T = (k, fallback) => (tweaks[`${k}_${L}`] ?? fallback);

  const kicker     = T("kicker", copy.kicker);
  const headline   = T("headline", copy.headline);
  const tagline    = T("tagline", copy.tagline);
  const ch1        = T("ch1", copy.ch1);
  const ch2        = T("ch2", copy.ch2);
  const ch3        = T("ch3", copy.ch3);
  const ctaKicker  = T("ctaKicker", copy.ctaKicker);
  const signoff    = T("signoff", copy.signoff);
  const photoCap   = T("photoCap", copy.photoCap);
  const photoDate  = T("photoDate", copy.photoDate);

  const photoMode = tweaks.photoMode || "polaroid";   // polaroid | round | hidden
  const showCTA   = tweaks.showCTA !== false;
  const email     = tweaks.email || copy.email;

  // ---------- photo treatments ----------
  const Photo = () => {
    if (photoMode === "hidden") return null;

    if (photoMode === "round") {
      return (
        <div style={{
          width: 140, height: 140, borderRadius: "50%",
          backgroundImage: `url("photo-thiago-toronto.png")`,
          backgroundSize: "cover", backgroundPosition: "center 30%",
          flex: "0 0 auto",
          boxShadow: dark
            ? "0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 4px " + paper
            : "0 4px 14px rgba(70,50,20,0.22), inset 0 0 0 4px " + paper,
          border: `2px solid ${accent}`,
        }}/>
      );
    }

    // polaroid (default)
    return (
      <div style={{ position: "relative", paddingTop: 18, flex: "0 0 auto" }}>
        <div style={{
          background: dark ? "#F2EBDB" : "#FFFEF8",
          padding: "14px 14px 18px",
          transform: "rotate(-2.4deg)",
          boxShadow: dark
            ? "0 3px 0 rgba(0,0,0,0.6), 0 18px 36px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.08)"
            : "0 1px 0 rgba(0,0,0,0.05), 0 14px 28px rgba(70,50,20,0.22), inset 0 0 0 1px rgba(0,0,0,0.04)",
          width: 320, position: "relative",
        }}>
          <Tape color={tape}  style={{ top: -10, left: 30,  transform: "rotate(-5deg)" }}/>
          <Tape color={tape2} style={{ top: -10, right: 24, transform: "rotate(4deg)", width: 64 }}/>

          <div style={{
            width: "100%", aspectRatio: "1/1",
            backgroundImage: `url("photo-thiago-toronto.png")`,
            backgroundSize: "cover", backgroundPosition: "center 25%",
            background_color: "#1a1a1a",
          }}/>

          <div style={{ ...hand, fontSize: 22, color: "#1A1410", marginTop: 12, lineHeight: 1.1, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {photoCap}
          </div>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.18em", color: "#9C8E70", textAlign: "center", marginTop: 6, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {photoDate}
          </div>
        </div>
      </div>
    );
  };

  // ---------- CTA chip ----------
  const Chip = ({ href, label, kicker, external }) => (
    <a href={href} target={external ? "_blank" : undefined} rel="noopener" style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "12px 16px", textDecoration: "none", color: "inherit",
      border: `1px dashed ${line}`, background: "transparent",
      transition: "transform 120ms ease, border-color 120ms ease, background 120ms ease",
    }}
    className="about-chip">
      <span style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", color: faint, textTransform: "uppercase" }}>
        {kicker}
      </span>
      <span style={{ ...serif, fontSize: 16, color: ink, letterSpacing: "-0.005em" }}>
        {label}
      </span>
      <span style={{ color: accent, fontSize: 14 }}>→</span>
    </a>
  );

  return (
    <div style={{
      background: bg, color: ink, minHeight: "calc(100vh - 44px)",
      fontFamily: '"Inter", system-ui, sans-serif',
      backgroundImage: dark
        ? "radial-gradient(circle at 12% 18%, rgba(255,130,64,0.04), transparent 45%), radial-gradient(circle at 88% 78%, rgba(255,255,255,0.012), transparent 50%)"
        : "radial-gradient(circle at 12% 18%, rgba(193,69,19,0.06), transparent 45%), radial-gradient(circle at 88% 78%, rgba(166,130,80,0.06), transparent 50%)",
    }}>
      {/* Header — kicker + huge headline */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 28px 24px" }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.22em", color: accent, marginBottom: 16 }}>
          § {kicker}
        </div>
        <h1 style={{
          ...serif, fontSize: "clamp(56px, 10vw, 132px)",
          lineHeight: 0.92, letterSpacing: "-0.04em",
          margin: 0, fontWeight: 500,
          textWrap: "balance",
        }}>
          {headline.split("|").map((part, i) => i === 0 ? (
            <span key={i}>{part}</span>
          ) : (
            <span key={i} style={{ position: "relative", display: "inline-block" }}>
              <span style={{ position: "relative", zIndex: 1 }}>{part}</span>
              <span style={{
                position: "absolute", bottom: "0.10em", left: "-0.06em", right: "-0.06em",
                height: "0.26em", background: marker, opacity: 0.78,
                transform: "skew(-3deg) rotate(-0.6deg)", zIndex: 0,
              }}/>
            </span>
          ))}
        </h1>
      </section>

      {/* Polaroid + chapters — main layout */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 28px 48px" }}>
        <div className="about-main" style={{
          display: "grid",
          gridTemplateColumns: photoMode === "round" ? "auto 1fr" : "auto 1fr",
          gap: photoMode === "round" ? 36 : 56,
          alignItems: "start",
        }}>
          <Photo/>

          <div style={{ paddingTop: photoMode === "polaroid" ? 8 : 4, maxWidth: 620 }}>
            {/* Tagline (small, italic) */}
            <p style={{
              ...serif, fontStyle: "italic", fontSize: 22, lineHeight: 1.4,
              color: muted, margin: "0 0 28px",
              textWrap: "pretty",
            }}>
              {tagline}
            </p>

            {/* Three short chapters */}
            <div style={{
              ...serif, fontSize: 19, lineHeight: 1.6, color: ink,
            }}>
              <Chapter text={ch1} accent={accent}/>
              <Chapter text={ch2} accent={accent}/>
              <Chapter text={ch3} accent={accent} last/>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — invitation to follow */}
      {showCTA && (
        <section style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 28px 40px" }}>
          <div style={{ position: "relative", paddingTop: 18 }}>
            <Paper tint={paper2} pad="28px 32px 24px" rotation={-0.3} dark={dark}>
              <Tape color={tape}  style={{ top: -9, left: "26%", transform: "rotate(-3deg)" }}/>
              <Tape color={tape2} style={{ top: -9, right: "30%", transform: "rotate(2.5deg)", width: 64 }}/>

              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "nowrap", marginBottom: 18 }}>
                <span style={{ ...mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, fontWeight: 700, whiteSpace: "nowrap" }}>
                  ◉ {ctaKicker}
                </span>
                <span style={{ flex: 1, minWidth: 40, height: 1, borderTop: `1px dashed ${line}` }}/>
              </div>

              <div className="cta-grid" style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
              }}>
                <Chip kicker="01" label={L === "pt" ? "blog" : "blog"} href="blog.html"/>
                <Chip kicker="02" label={L === "pt" ? "vídeos" : "videos"} href="videos.html"/>
                <Chip kicker="03" label={L === "pt" ? "newsletters" : "newsletters"} href="newsletters.html"/>
                <Chip kicker="04" label={L === "pt" ? "instagram" : "instagram"} href={copy.instagram} external/>
              </div>

              <div style={{ marginTop: 22, display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
                <span style={{ ...hand, fontSize: 22, color: accent, whiteSpace: "nowrap" }}>
                  {signoff}
                </span>
                <a href={`mailto:${email}`} style={{
                  ...mono, fontSize: 12, color: muted, textDecoration: "none",
                  borderBottom: `1px dashed ${line}`, paddingBottom: 2,
                  letterSpacing: "0.02em", whiteSpace: "nowrap",
                }}>
                  {email}
                </a>
              </div>
            </Paper>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: "32px 28px 56px", textAlign: "center", marginTop: 16 }}>
        <div style={{ ...hand, fontSize: 22, color: muted }}>
          — {L === "pt" ? "feito à mão, em trânsito, 2026" : "handmade, in transit, 2026"} —
        </div>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: faint, marginTop: 12 }}>
          <a href="Pinboard.html" style={{ color: "inherit", textDecoration: "none", marginRight: 14 }}>home</a>
          <a href="blog.html"     style={{ color: "inherit", textDecoration: "none", marginRight: 14 }}>blog</a>
          <a href="videos.html"   style={{ color: "inherit", textDecoration: "none", marginRight: 14 }}>vídeos</a>
          <a href="now.html"      style={{ color: "inherit", textDecoration: "none" }}>now</a>
        </div>
      </footer>

      {/* About-specific styles + responsive */}
      <style>{`
        .about-chip:hover { transform: translateY(-1px); border-color: ${accent} !important; }
        .about-chip:hover span:nth-child(2) { color: ${accent} !important; }

        @media (max-width: 760px) {
          .about-main {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
            justify-items: center;
          }
          .about-main > div:first-child { display: flex; justify-content: center; }
          .about-main > div:last-child  { max-width: 100% !important; }
          .cta-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .cta-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

// Single chapter — first letter is a serif drop-cap in accent color when long
const Chapter = ({ text, accent, last }) => {
  if (!text || !text.trim()) return null;
  return (
    <p style={{
      margin: 0, marginBottom: last ? 0 : 18,
      textWrap: "pretty",
    }}>
      {text}
    </p>
  );
};

const Paper = ({ children, tint, pad, rotation = 0, dark, style = {} }) => (
  <div style={{
    background: tint, padding: pad, position: "relative",
    transform: `rotate(${rotation}deg)`,
    boxShadow: dark
      ? "0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)"
      : "0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)",
    ...style,
  }}>{children}</div>
);

window.About = About;
