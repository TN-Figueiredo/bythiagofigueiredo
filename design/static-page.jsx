/*
 * Static page kit — shared layout for About, Now, 404.
 * Each page exports a small data object; this file renders them
 * inside a Paper-and-Tape "letter from the author" layout.
 */

const StaticPage = ({ kind, dark, L }) => {
  const bg     = dark ? "#14110B" : "#E9E1CE";
  const paper  = dark ? "#2A241A" : "#FBF6E8";
  const paper2 = dark ? "#312A1E" : "#F5EDD6";
  const ink    = dark ? "#EFE6D2" : "#161208";
  const muted  = dark ? "#958A75" : "#6A5F48";
  const faint  = dark ? "#6B634F" : "#9C9178";
  const line   = dark ? "#2E2718" : "#CEBFA0";
  const accent = dark ? "#FF8240" : "#C14513";
  const marker = "#FFE37A";
  const tape   = dark ? "rgba(255, 226, 140, 0.42)" : "rgba(255, 226, 140, 0.75)";
  const tape2  = dark ? "rgba(209, 224, 255, 0.36)" : "rgba(200, 220, 255, 0.7)";

  const hand  = { fontFamily: '"Caveat", cursive', color: accent };
  const mono  = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' };
  const serif = { fontFamily: '"Fraunces", serif' };

  const Tape = ({ color = tape, style = {} }) => (
    <div style={{
      position: "absolute", width: 80, height: 18, background: color,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)", ...style,
    }}/>
  );
  const Paper = ({ children, tint = paper, pad = "20px", rotation = 0, style = {} }) => (
    <div style={{
      background: tint, padding: pad, position: "relative",
      transform: `rotate(${rotation}deg)`,
      boxShadow: dark
        ? "0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)"
        : "0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)",
      ...style,
    }}>{children}</div>
  );

  const data = window.PAGE_DATA[kind][L];

  // --- About page layout ---
  if (kind === "about") {
    return (
      <Wrap bg={bg} dark={dark} ink={ink}>
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "80px 28px 32px" }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.22em", color: accent, marginBottom: 14 }}>
            {data.kicker}
          </div>
          <h1 style={{
            ...serif, fontSize: "clamp(48px, 7vw, 88px)",
            lineHeight: 1, letterSpacing: "-0.035em",
            margin: 0, fontWeight: 500, position: "relative", display: "inline-block",
          }}>
            {data.title}
            <span style={{
              position: "absolute", bottom: 10, left: -4, right: -4, height: "0.22em",
              background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
            }}/>
          </h1>
          <p style={{ ...serif, fontStyle: "italic", fontSize: 22, color: muted, lineHeight: 1.45, marginTop: 22, maxWidth: 720 }}>
            {data.subtitle}
          </p>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "32px 28px 32px" }}>
          {/* Bio paragraphs */}
          <div style={{ ...serif, fontSize: 19, lineHeight: 1.6, color: ink, maxWidth: 680 }}>
            {data.body.map((p, i) => (
              <p key={i} style={{ marginTop: i === 0 ? 0 : 22, marginBottom: 0, textWrap: "pretty" }}>
                {i === 0 && (
                  <span style={{
                    ...serif, fontSize: 80, lineHeight: 0.8,
                    color: accent, float: "left",
                    marginRight: 12, marginTop: 6, marginBottom: -4,
                    fontWeight: 500,
                  }}>
                    {p.charAt(0)}
                  </span>
                )}
                {i === 0 ? p.slice(1) : p}
              </p>
            ))}
          </div>
        </section>

        {/* Where to find me — paper card */}
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 32px" }}>
          <div style={{ position: "relative", paddingTop: 16 }}>
            <Paper tint={paper2} pad="28px 32px 28px" rotation={-0.4}>
              <Tape color={tape} style={{ top: -9, left: "20%", transform: "rotate(-3deg)" }}/>
              <Tape color={tape2} style={{ top: -9, right: "22%", transform: "rotate(3deg)" }}/>
              <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, marginBottom: 12 }}>
                {data.linksKicker}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="links-grid">
                {data.links.map((l) => (
                  <a key={l.label} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noopener" style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", textDecoration: "none", color: "inherit",
                    border: `1px dashed ${line}`, fontSize: 14,
                  }}>
                    <span>
                      <span style={{ ...mono, fontSize: 11, letterSpacing: "0.12em", color: faint, marginRight: 10 }}>
                        {l.kind}
                      </span>
                      {l.label}
                    </span>
                    <span style={{ color: accent, fontSize: 16 }}>→</span>
                  </a>
                ))}
              </div>
            </Paper>
          </div>
        </section>

        {/* Now & values footnote */}
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 80px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }} className="meta-grid">
            <div>
              <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: faint, marginBottom: 10 }}>
                {data.nowKicker}
              </div>
              <div style={{ ...serif, fontSize: 16, lineHeight: 1.55 }}>
                {data.nowBlurb} <a href="now.html" style={{ color: accent, textDecoration: "underline", textDecorationStyle: "wavy", textUnderlineOffset: 4 }}>{data.nowLink}</a>
              </div>
            </div>
            <div>
              <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: faint, marginBottom: 10 }}>
                {data.valuesKicker}
              </div>
              <ul style={{ ...serif, fontSize: 15, lineHeight: 1.6, paddingLeft: 18, margin: 0, color: muted }}>
                {data.values.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <SiteFooter dark={dark} L={L}/>
      </Wrap>
    );
  }

  // --- Now page layout ---
  if (kind === "now") {
    return (
      <Wrap bg={bg} dark={dark} ink={ink}>
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "80px 28px 24px" }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", color: accent }}>
            {data.kicker} <span style={{ color: faint, marginLeft: 8 }}>· {data.updated}</span>
          </div>
          <h1 style={{
            ...serif, fontSize: "clamp(48px, 7vw, 88px)",
            lineHeight: 1, letterSpacing: "-0.035em",
            margin: "14px 0 0", fontWeight: 500,
          }}>
            {data.title}
          </h1>
          <p style={{ ...serif, fontStyle: "italic", fontSize: 20, color: muted, lineHeight: 1.5, marginTop: 18, maxWidth: 700 }}>
            {data.subtitle}
          </p>
        </section>

        <section style={{ maxWidth: 920, margin: "0 auto", padding: "16px 28px 64px" }}>
          {data.sections.map((s, i) => (
            <div key={i} style={{
              padding: "32px 0",
              borderTop: i === 0 ? "none" : `1px dashed ${line}`,
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 32 }} className="now-row">
                <div style={{ ...mono, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: accent, paddingTop: 4 }}>
                  {s.kicker}
                </div>
                <div>
                  <h3 style={{ ...serif, fontSize: 24, fontWeight: 500, margin: 0, letterSpacing: "-0.015em" }}>
                    {s.title}
                  </h3>
                  <ul style={{ ...serif, fontSize: 16, lineHeight: 1.65, paddingLeft: 18, marginTop: 12, marginBottom: 0 }}>
                    {s.items.map((it, j) => (
                      <li key={j} style={{ marginBottom: 6, color: ink }}>
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Sticky note from author */}
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "0 28px 80px" }}>
          <div style={{ position: "relative", paddingTop: 14, maxWidth: 480 }}>
            <Paper tint={"#FFEFA8"} pad="22px 24px 20px" rotation={-1.4}>
              <Tape color={tape} style={{ top: -9, left: "30%", transform: "rotate(-4deg)" }}/>
              <div style={{ ...hand, fontSize: 22, color: "#1A1410", lineHeight: 1.3 }}>
                {data.note}
              </div>
              <div style={{ ...hand, fontSize: 26, color: "#C14513", marginTop: 10 }}>
                — tf
              </div>
            </Paper>
          </div>
        </section>

        <SiteFooter dark={dark} L={L}/>
      </Wrap>
    );
  }

  // --- 404 page ---
  if (kind === "notfound") {
    return (
      <Wrap bg={bg} dark={dark} ink={ink}>
        <section style={{
          minHeight: "calc(100vh - 44px - 100px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "60px 28px",
        }}>
          <div style={{ maxWidth: 760, textAlign: "center" }}>
            <div style={{ ...mono, fontSize: 11, letterSpacing: "0.22em", color: accent, marginBottom: 18 }}>
              {data.kicker}
            </div>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
              <h1 style={{
                ...serif, fontSize: "clamp(120px, 18vw, 220px)",
                lineHeight: 0.86, letterSpacing: "-0.06em",
                margin: 0, fontWeight: 500, color: accent,
                fontStyle: "italic",
              }}>
                404
              </h1>
              {/* hand-scrawled overlay */}
              <div style={{
                ...hand, fontSize: 32, position: "absolute",
                top: -10, right: -40, transform: "rotate(8deg)", color: accent,
              }}>
                ¯\_(ツ)_/¯
              </div>
            </div>
            <h2 style={{ ...serif, fontSize: "clamp(24px, 3vw, 36px)", margin: "16px 0 0", fontWeight: 500, letterSpacing: "-0.02em" }}>
              {data.title}
            </h2>
            <p style={{ ...serif, fontStyle: "italic", fontSize: 18, color: muted, lineHeight: 1.5, marginTop: 14, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
              {data.subtitle}
            </p>

            {/* Suggestions card */}
            <div style={{ marginTop: 40, position: "relative", paddingTop: 14, textAlign: "left" }}>
              <Paper tint={paper} pad="24px 28px 22px" rotation={-0.4}>
                <Tape color={tape} style={{ top: -9, left: "30%", transform: "rotate(-3deg)" }}/>
                <Tape color={tape2} style={{ top: -9, right: "28%", transform: "rotate(3deg)" }}/>
                <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, marginBottom: 14 }}>
                  {data.tryKicker}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }} className="links-grid">
                  {data.links.map((l) => (
                    <a key={l.href} href={l.href} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", textDecoration: "none", color: "inherit",
                      border: `1px dashed ${line}`, fontSize: 14,
                    }}>
                      <span>{l.label}</span>
                      <span style={{ color: accent }}>→</span>
                    </a>
                  ))}
                </div>
              </Paper>
            </div>

            <div style={{ ...hand, fontSize: 20, color: accent, marginTop: 32, transform: "rotate(-1deg)", display: "inline-block" }}>
              {data.footnote}
            </div>
          </div>
        </section>

        <SiteFooter dark={dark} L={L}/>
      </Wrap>
    );
  }

  return null;
};

const Wrap = ({ bg, dark, ink, children }) => (
  <div style={{
    background: bg, color: ink, minHeight: "100vh",
    fontFamily: '"Inter", system-ui, sans-serif',
    backgroundImage: dark
      ? "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.015), transparent 40%), radial-gradient(circle at 85% 70%, rgba(255,255,255,0.015), transparent 40%)"
      : "radial-gradient(circle at 15% 20%, rgba(166,130,80,0.06), transparent 40%), radial-gradient(circle at 85% 70%, rgba(166,130,80,0.06), transparent 40%)",
  }}>
    {children}
    <style>{`
      @media (max-width: 720px) {
        .links-grid { grid-template-columns: 1fr !important; }
        .meta-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
        .now-row { grid-template-columns: 1fr !important; gap: 8px !important; }
      }
    `}</style>
  </div>
);

const SiteFooter = ({ dark, L }) => {
  const muted = dark ? "#958A75" : "#6A5F48";
  const faint = dark ? "#6B634F" : "#9C9178";
  const line  = dark ? "#2E2718" : "#CEBFA0";
  return (
    <footer style={{ borderTop: `1px dashed ${line}`, padding: "32px 28px 48px", textAlign: "center" }}>
      <div style={{ fontFamily: '"Caveat", cursive', fontSize: 22, color: muted }}>
        — {L === "pt" ? "feito à mão em BH, 2026" : "handmade in Brazil, 2026"} —
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: faint, marginTop: 12 }}>
        <a href="index.html" style={{ color: "inherit", textDecoration: "none", marginRight: 14 }}>index</a>
        <a href="Pinboard.html" style={{ color: "inherit", textDecoration: "none", marginRight: 14 }}>home</a>
        <a href="about.html" style={{ color: "inherit", textDecoration: "none", marginRight: 14 }}>about</a>
        <a href="now.html" style={{ color: "inherit", textDecoration: "none" }}>now</a>
      </div>
    </footer>
  );
};

window.StaticPage = StaticPage;
