/*
 * Newsletters hub — one page with all newsletters, checkbox multi-select,
 * single email capture that subscribes to all checked items at once.
 */

const NewslettersHub = ({ t, dark, content }) => {
  const C = content;
  const sites = C.sites;
  const nls = C.newsletters;
  const L = window._lang;

  const theme = window.makePinboardTheme(dark);
  const kit = window.makePinboardKit(theme);
  const { PageHeader, Paper, Tape } = kit;
  const { bg, paper, paper2, ink, muted, faint, line, accent, marker, hand, tape, tape2, rot, lift } = theme;

  // ---------- Selection state (persisted) ----------
  const [checked, setChecked] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("btf_nl_picks") || "null");
      if (saved && Array.isArray(saved)) return new Set(saved);
    } catch {}
    // Default: "main" pre-checked
    return new Set(nls.filter(n => n.primary).map(n => n.id));
  });
  const [email, setEmail] = React.useState("");
  const [phase, setPhase] = React.useState("pick"); // pick | sent | suggest
  const [sentTo, setSentTo] = React.useState([]);

  React.useEffect(() => {
    try { localStorage.setItem("btf_nl_picks", JSON.stringify(Array.from(checked))); } catch {}
  }, [checked]);

  const toggle = (id) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!email.includes("@") || checked.size === 0) return;
    const ids = Array.from(checked);
    setSentTo(ids);
    // If only main was selected, next phase suggests the extras
    const onlyMain = ids.length === 1 && ids[0] === "main";
    setPhase(onlyMain ? "suggest" : "sent");
  };

  const nav = [
    { key: "home", href: "Pinboard.html", label: t.nav.home },
    { key: "writing", href: "blog.html", label: t.nav.writing },
    { key: "videos", href: "videos.html", label: t.nav.videos },
    { key: "newsletters", href: "newsletters.html", label: t.nav.newsletter },
    { key: "about", href: "#", label: t.nav.about },
    { key: "contact", href: sites.contact.url, label: sites.contact["label_" + L] },
    { key: "dev", href: sites.dev.url, label: sites.dev["label_" + L], external: true },
  ];

  // Color resolver per theme
  const nlColor = (n) => dark ? n.color_dark : n.color;

  // ---------- Card ----------
  const NewsletterCard = ({ n, index }) => {
    const isChecked = checked.has(n.id);
    const color = nlColor(n);
    return (
      <div style={{ position: "relative", paddingTop: 18 }}>
        {/* Corner tape — BEHIND the paper, only the top portion pokes out */}
        <Tape
          color={index % 2 ? tape2 : tape}
          style={{
            top: 4,
            [index % 2 ? "left" : "right"]: "22%",
            transform: `rotate(${(index * 9) % 14 - 7}deg)`,
            zIndex: 0,
          }}
        />
        <Paper
          tint={index % 3 === 1 ? paper2 : paper}
          pad="0"
          rotation={rot(index + 3)}
          y={lift(index + 3)}
          style={{
            outline: isChecked ? `2px solid ${color}` : "none",
            outlineOffset: 4,
            transition: "outline 0.2s",
            zIndex: 1,
          }}
        >
          {/* Left color ribbon */}
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: 0, width: 6,
            background: color,
          }}/>

          {/* Content */}
          <label style={{ display: "block", cursor: "pointer", padding: "22px 24px 22px 32px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                {/* Kicker row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                    letterSpacing: "0.18em", textTransform: "uppercase", color,
                    fontWeight: 700,
                  }}>
                    {String(index + 1).padStart(2, "0")} · {n["cadence_" + L]}
                  </span>
                  {n.badge_pt && (
                    <span style={{
                      padding: "2px 8px", background: color, color: "#FFF",
                      fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                      letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
                      transform: "rotate(-1deg)", display: "inline-block",
                    }}>
                      {n["badge_" + L]}
                    </span>
                  )}
                </div>

                <h3 style={{
                  fontFamily: '"Fraunces", serif', fontSize: 28, lineHeight: 1.1,
                  margin: "0 0 10px", fontWeight: 500, letterSpacing: "-0.02em", color: ink,
                }}>
                  {n["name_" + L]}
                </h3>

                <p style={{ fontSize: 15, color: muted, lineHeight: 1.5, margin: "0 0 14px" }}>
                  {n["tagline_" + L]}
                </p>
              </div>

              {/* Checkbox */}
              <div style={{
                flexShrink: 0,
                width: 28, height: 28,
                border: `2px solid ${isChecked ? color : line}`,
                background: isChecked ? color : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
                marginTop: 4,
              }}>
                {isChecked && <span style={{ color: "#FFF", fontSize: 16, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(n.id)}
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                  tabIndex={-1}
                />
              </div>
            </div>

            {/* Sample issue */}
            <div style={{
              padding: "10px 12px",
              background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              borderLeft: `2px solid ${color}`,
              marginBottom: 14,
            }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: faint, marginBottom: 4 }}>
                {L === "pt" ? "última edição" : "latest issue"}
              </div>
              <div style={{ fontSize: 13, color: ink, lineHeight: 1.4, fontStyle: "italic" }}>
                "{n["sample_" + L]}"
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 16, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: faint, letterSpacing: "0.04em" }}>
              <span>◉ {n["subs_" + L]}</span>
              <span>▦ {n["issues_" + L]}</span>
            </div>
          </label>
        </Paper>
      </div>
    );
  };

  // ---------- Sticky bar ----------
  const selectedList = Array.from(checked).map(id => nls.find(n => n.id === id)).filter(Boolean);
  const disabled = checked.size === 0 || !email.includes("@");

  const StickyBar = () => (
    <div style={{
      position: "sticky", bottom: 0, left: 0, right: 0, zIndex: 10,
      background: dark ? "rgba(20,18,10,0.96)" : "rgba(251,246,232,0.96)",
      borderTop: `2px solid ${accent}`,
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      padding: "18px 28px",
      marginTop: 48,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        {/* Count + selected badges */}
        <div style={{ flex: "1 1 300px" }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: faint, marginBottom: 6 }}>
            {checked.size > 0 ? (
              <>{L === "pt" ? "você escolheu" : "you picked"} <span style={{ color: accent, fontWeight: 700 }}>{checked.size}</span> {checked.size === 1 ? (L === "pt" ? "newsletter" : "newsletter") : (L === "pt" ? "newsletters" : "newsletters")}</>
            ) : (
              <>{L === "pt" ? "marca pelo menos uma 👆" : "pick at least one 👆"}</>
            )}
          </div>
          {selectedList.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selectedList.map(n => (
                <span key={n.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 9px",
                  border: `1.5px solid ${nlColor(n)}`, color: nlColor(n),
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                  letterSpacing: "0.04em",
                }}>
                  {n["name_" + L]}
                  <button onClick={() => toggle(n.id)} style={{
                    background: "transparent", border: "none", color: "inherit",
                    cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1,
                  }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Email + submit */}
        <form onSubmit={submit} style={{ display: "flex", gap: 8, flex: "1 1 380px", maxWidth: 560 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={L === "pt" ? "seu email" : "your email"}
            style={{
              flex: 1, padding: "12px 14px",
              border: `1.5px solid ${line}`, background: dark ? "rgba(0,0,0,0.25)" : "#FFF", color: ink,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={disabled}
            style={{
              padding: "12px 22px",
              background: disabled ? (dark ? "#3A2E1F" : "#D8C9A7") : accent,
              color: disabled ? faint : "#FFF",
              border: "none",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            ✉ {L === "pt" ? "inscrever" : "subscribe"}
          </button>
        </form>
      </div>
    </div>
  );

  // ---------- Success / suggest screens ----------
  if (phase === "sent") {
    return (
      <div id="top" style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: '"Inter", sans-serif' }}>
        <PageHeader nav={nav} current="newsletters" ctas={null}/>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "96px 28px" }}>
          <div style={{ ...hand, fontSize: 64, color: accent, lineHeight: 1, marginBottom: 16, transform: "rotate(-2deg)" }}>
            {L === "pt" ? "valeu!" : "thanks!"}
          </div>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 44, margin: "0 0 24px", fontWeight: 500, letterSpacing: "-0.02em" }}>
            {L === "pt"
              ? <>Inscreveu em <span style={{ color: accent }}>{sentTo.length}</span> newsletters.</>
              : <>Subscribed to <span style={{ color: accent }}>{sentTo.length}</span> newsletters.</>}
          </h1>
          <p style={{ fontSize: 17, color: muted, lineHeight: 1.6, marginBottom: 28 }}>
            {L === "pt"
              ? `Manda um email de confirmação pra ${email} — clica no link que ficou tudo certo.`
              : `Sent a confirmation email to ${email} — click the link and you're set.`}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
            {sentTo.map(id => {
              const n = nls.find(x => x.id === id);
              return (
                <div key={id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  borderLeft: `3px solid ${nlColor(n)}`,
                  background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                }}>
                  <span style={{ color: nlColor(n), fontWeight: 700 }}>✓</span>
                  <span style={{ fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 500 }}>{n["name_" + L]}</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: "0.06em", marginLeft: "auto" }}>
                    {n["cadence_" + L]}
                  </span>
                </div>
              );
            })}
          </div>
          <a href="Pinboard.html" style={{
            display: "inline-block", padding: "12px 26px",
            background: "transparent", color: ink, border: `1.5px solid ${line}`,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
            letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600,
            textDecoration: "none",
          }}>
            {L === "pt" ? "voltar pra home" : "back to home"}
          </a>
        </section>
      </div>
    );
  }

  if (phase === "suggest") {
    const others = nls.filter(n => !sentTo.includes(n.id));
    return (
      <div id="top" style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: '"Inter", sans-serif' }}>
        <PageHeader nav={nav} current="newsletters" ctas={null}/>
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "72px 28px 48px" }}>
          <div style={{ ...hand, fontSize: 48, color: accent, lineHeight: 1, marginBottom: 12, transform: "rotate(-2deg)" }}>
            {L === "pt" ? "inscrito!" : "subscribed!"}
          </div>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 38, margin: "0 0 14px", fontWeight: 500, letterSpacing: "-0.02em" }}>
            {L === "pt"
              ? "Já está no diário. Agora, posso te mandar mais algumas coisas?"
              : "You're on the diary. Now, can I send you a few more things?"}
          </h1>
          <p style={{ fontSize: 16, color: muted, lineHeight: 1.6, marginBottom: 36 }}>
            {L === "pt"
              ? `Usamos o mesmo ${email}. Marca o que te interessa, ou pula — sem drama.`
              : `We'll use the same ${email}. Check what interests you, or skip — no drama.`}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 28 }}>
            {others.map((n, i) => (
              <NewsletterCard key={n.id} n={n} index={i + 2}/>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                const extra = Array.from(checked).filter(id => !sentTo.includes(id));
                if (extra.length === 0) { setPhase("sent"); return; }
                setSentTo([...sentTo, ...extra]);
                setPhase("sent");
              }}
              style={{
                padding: "12px 22px",
                background: accent, color: "#FFF", border: "none",
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✉ {L === "pt" ? "inscrever nas selecionadas" : "subscribe to selected"}
            </button>
            <button
              onClick={() => setPhase("sent")}
              style={{
                padding: "12px 22px",
                background: "transparent", color: muted, border: `1.5px solid ${line}`,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {L === "pt" ? "pular, só a principal" : "skip, main only"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ---------- Pick phase (default) ----------
  return (
    <div id="top" style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: '"Inter", sans-serif' }}>

      <PageHeader nav={nav} current="newsletters" ctas={null}/>

      {/* Hero */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 28px 32px" }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>
          / {L === "pt" ? "newsletters" : "newsletters"} · {nls.length} {L === "pt" ? "cadernos" : "notebooks"}
        </div>
        <h1 style={{
          fontFamily: '"Fraunces", serif', fontSize: 64, margin: 0, fontWeight: 500,
          letterSpacing: "-0.03em", lineHeight: 1.0, position: "relative", display: "inline-block",
        }}>
          {L === "pt" ? "Escolhe o que você quer receber" : "Pick what you want to get"}
          <span style={{
            position: "absolute", bottom: 4, left: -6, right: -6, height: 18,
            background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
          }}/>
        </h1>
        <p style={{ fontSize: 16, color: muted, marginTop: 18, maxWidth: 720, lineHeight: 1.6 }}>
          {L === "pt"
            ? "Eu escrevo em várias frentes e não quero te encher de coisa que você não pediu. Então são newsletters separadas, cada uma com sua frequência. Marca quantas quiser."
            : "I write across several fronts and don't want to spam you with stuff you didn't ask for. So they're separate newsletters, each with its own rhythm. Check as many as you like."}
        </p>

        {/* Quick utility */}
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <button onClick={() => setChecked(new Set(nls.map(n => n.id)))} style={{
            padding: "6px 14px",
            background: "transparent", color: ink, border: `1px dashed ${line}`,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
            cursor: "pointer",
          }}>
            ✓ {L === "pt" ? "marcar todas" : "check all"}
          </button>
          <button onClick={() => setChecked(new Set())} style={{
            padding: "6px 14px",
            background: "transparent", color: faint, border: `1px dashed ${line}`,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
            cursor: "pointer",
          }}>
            ✕ {L === "pt" ? "desmarcar" : "clear"}
          </button>
          <span style={{ ...hand, fontSize: 18, color: accent, transform: "rotate(-1deg)", marginLeft: "auto", alignSelf: "center" }}>
            ↓ {L === "pt" ? "quatro opções, sem drama" : "four options, no drama"}
          </span>
        </div>
      </section>

      {/* Grid of newsletters */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 28px 24px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 28,
          rowGap: 48,
        }}>
          {nls.map((n, i) => (
            <NewsletterCard key={n.id} n={n} index={i}/>
          ))}
        </div>
      </section>

      {/* Meta note */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px 0" }}>
        <div style={{
          display: "flex", gap: 16, flexWrap: "wrap",
          padding: "20px 24px",
          background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
          borderLeft: `3px solid ${muted}`,
        }}>
          <div style={{ ...hand, fontSize: 28, color: muted, lineHeight: 1, transform: "rotate(-2deg)" }}>p.s.</div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <p style={{ fontSize: 14, color: muted, lineHeight: 1.6, margin: 0 }}>
              {L === "pt"
                ? <>Sem anúncios, sem parceria escondida, sem gatilho de "URGENTE". É um email por quando der, sobre o que tá rolando. <a href="#" style={{ color: accent, textDecoration: "underline" }}>descadastro sempre no rodapé</a>.</>
                : <>No ads, no hidden sponsorships, no "URGENT" triggers. One email when it's ready, about what's happening. <a href="#" style={{ color: accent, textDecoration: "underline" }}>unsubscribe is always in the footer</a>.</>}
            </p>
          </div>
        </div>
      </section>

      {/* Sticky subscription bar */}
      <StickyBar/>

      {/* Footer */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: "28px", textAlign: "center", color: faint, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.08em" }}>
        <a href="Pinboard.html" style={{ color: accent, textDecoration: "none" }}>← {L === "pt" ? "voltar pra home" : "back to home"}</a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="blog.html" style={{ color: muted, textDecoration: "none" }}>{L === "pt" ? "blog" : "blog"}</a>
        <span style={{ margin: "0 10px", opacity: 0.5 }}>·</span>
        <a href="videos.html" style={{ color: muted, textDecoration: "none" }}>{L === "pt" ? "vídeos" : "videos"}</a>
      </footer>
    </div>
  );
};

window.NewslettersHub = NewslettersHub;
