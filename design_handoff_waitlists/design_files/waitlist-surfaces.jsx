/*
 * Waitlist — public surfaces composition.
 * Renders: hosted landing (Surface 1) + every state as a labeled frame,
 * embeddable block (Surface 2), and the in-blog-post node + TipTap inset (Surface 3).
 * Exposes window.WaitlistPublic.
 */

function SectionKicker({ glyph, kick, title, sub, theme }) {
  const { ink, muted, faint } = theme;
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: faint, fontWeight: 700, marginBottom: 10 }}>
        {glyph} {kick}
      </div>
      <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 38, margin: 0, fontWeight: 500, letterSpacing: "-0.025em", color: ink, lineHeight: 1.05 }}>{title}</h2>
      {sub && <p style={{ fontSize: 15.5, color: muted, lineHeight: 1.6, margin: "12px 0 0", maxWidth: 620, textWrap: "pretty" }}>{sub}</p>}
    </div>
  );
}

/* labeled frame for the state gallery */
function Frame({ index, label, note, theme, accent, w = 360, children }) {
  const { ink, faint, muted, line, dark } = theme;
  return (
    <div style={{ width: w }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 10 }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.1em" }}>{index}</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: ink, fontWeight: 600 }}>{label}</span>
      </div>
      {children}
      {note && <div style={{ fontSize: 11.5, color: faint, lineHeight: 1.5, margin: "10px 2px 0", maxWidth: w }}>{note}</div>}
    </div>
  );
}

/* a single form card with accent stripe (the shared unit) */
function FormCard({ state, accent, theme, L, product, variant = "landing", interactive, onState, stripe = true, width }) {
  const { paper, dark } = theme;
  const neutral = state === "closed";
  const stripeColor = neutral ? (dark ? "#4A4232" : "#CEBFA0") : accent;
  return (
    <div style={{
      background: paper, position: "relative", width,
      boxShadow: dark
        ? "0 2px 0 rgba(0,0,0,0.5), 0 14px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)"
        : "0 1px 0 rgba(0,0,0,0.04), 0 10px 26px rgba(70,50,20,0.14), inset 0 0 0 1px rgba(0,0,0,0.03)",
    }}>
      {stripe && <div style={{ height: 6, background: stripeColor }} />}
      <window.WaitlistForm state={state} accent={accent} theme={theme} L={L} product={product} variant={variant} interactive={interactive} onState={onState} />
    </div>
  );
}

const WaitlistPublic = ({ L, dark, accent, customAccent }) => {
  const product = window.WL_PUB.product;
  const theme = window.makePinboardTheme(dark);
  const kit = window.makePinboardKit(theme);
  const { PageHeader, Paper, Tape } = kit;
  const { bg, paper, paper2, ink, muted, faint, line, marker, hand } = theme;

  const nav = [
    { key: "home", href: "Pinboard.html", label: L === "pt" ? "Início" : "Home" },
    { key: "writing", href: "blog.html", label: L === "pt" ? "Escritos" : "Writing" },
    { key: "videos", href: "youtube.html", label: L === "pt" ? "Vídeos" : "Videos" },
    { key: "newsletters", href: "newsletters.html", label: "Newsletters" },
    { key: "about", href: "about.html", label: L === "pt" ? "Sobre" : "About" },
  ];

  const [liveState, setLiveState] = React.useState("idle");
  const S = window.wlpStrings(L, product);
  const slug = product["slug_" + L];

  const STATE_FRAMES = [
    ["idle", L === "pt" ? "aberto · formulário" : "open · form", L === "pt" ? "Estado padrão. Email + 1 checkbox de consentimento + o slot do Turnstile (verificação de segurança) logo abaixo." : "Default. Email + 1 consent checkbox + the Turnstile security slot just below."],
    ["submitting", L === "pt" ? "enviando" : "submitting", L === "pt" ? "Botão em carregamento; o Turnstile mostra o spinner enquanto valida." : "Button loading; Turnstile shows the spinner while validating."],
    ["success", L === "pt" ? "sucesso" : "success", L === "pt" ? "Substitui o formulário no lugar. Promessa de um único email." : "Replaces the form in place. Promise of a single email."],
    ["duplicate", L === "pt" ? "já inscrito" : "duplicate", L === "pt" ? "Mesmo tom tranquilizador — ninguém é inscrito duas vezes." : "Same reassuring tone — nobody is signed up twice."],
    ["closed", L === "pt" ? "encerrado" : "closed", L === "pt" ? "Bloco de mensagem, sem formulário. Faixa neutra (não laranja)." : "Message block, no form. Neutral stripe (not orange)."],
    ["launched", L === "pt" ? "lançado" : "launched", L === "pt" ? "Bloco de mensagem + link opcional pro produto no ar." : "Message block + optional link to the live product."],
    ["error", L === "pt" ? "erro · tentar de novo" : "error · retry", L === "pt" ? "Formulário mantido; banner de erro + ação de repetir." : "Form kept; error banner + retry action."],
    ["rateLimited", L === "pt" ? "rate-limit (429)" : "rate-limited (429)", L === "pt" ? "Muitas tentativas — pedir pra aguardar. Backstop do WAF por IP." : "Too many attempts — ask to wait. WAF per-IP backstop."],
    ["unavailable", L === "pt" ? "indisponível (503)" : "unavailable (503)", L === "pt" ? "Turnstile sem chave em produção falha fechado: 503 honesto." : "Missing Turnstile key in prod fails closed: an honest 503."],
  ];

  return (
    <div lang={L === "pt" ? "pt-BR" : "en"} style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: '"Inter", sans-serif' }}>
      <PageHeader nav={nav} current={null} ctas={null} />

      {/* doc intro */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 28px 0" }}>
        <nav style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.12em", color: faint, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>{L === "pt" ? "Início" : "Home"}</span><span>/</span>
          <span style={{ color: accent }}>waitlists</span><span>/</span>
          <span>{slug}</span>
        </nav>
      </section>

      {/* ============ SURFACE 1 — HOSTED LANDING ============ */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 28px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint, fontWeight: 700 }}>{L === "pt" ? "Superfície 1" : "Surface 1"}</span>
          <span style={{ height: 1, flex: 1, background: line }} />
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint }}>/waitlists/{slug}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 52, alignItems: "start" }}>
          {/* LEFT — pitch */}
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, fontWeight: 700, whiteSpace: "nowrap" }}>✦ {L === "pt" ? "lista de espera" : "waitlist"}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.1em", color: muted }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3CB371" }} /> {product["opens_" + L]}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.1em", color: muted }}>
                <span style={{ color: accent }}>◉</span> {product.signups.toLocaleString(L === "pt" ? "pt-BR" : "en-US")} {L === "pt" ? "já na lista" : "already in line"}
              </span>
            </div>
            <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 68, margin: 0, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 0.98, color: ink, position: "relative", display: "inline-block", textWrap: "balance" }}>
              {product["name_" + L]}
              <span style={{ position: "absolute", bottom: 6, left: -8, right: -8, height: 20, background: accent, opacity: 0.16, zIndex: -1, transform: "skew(-2deg)" }} />
            </h1>
            <p style={{ fontFamily: '"Fraunces", serif', fontSize: 22, color: muted, lineHeight: 1.4, margin: "20px 0 26px", fontWeight: 400, fontStyle: "italic", maxWidth: 540 }}>
              {product["tagline_" + L]}
            </p>
            <p style={{ fontSize: 16.5, color: ink, lineHeight: 1.65, margin: "0 0 30px", maxWidth: 600, textWrap: "pretty" }}>
              {product["description_" + L]}
            </p>
            <div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: faint, marginBottom: 14, fontWeight: 700 }}>
                ▦ {L === "pt" ? "o que você vai receber" : "what you'll get"}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 11 }}>
                {product["bullets_" + L].map((b, i) => (
                  <li key={i} style={{ display: "flex", gap: 13, alignItems: "flex-start", fontSize: 15.5, color: ink, lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, marginTop: 8, width: 8, height: 8, background: accent, transform: "rotate(45deg)" }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT — live form */}
          <div style={{ position: "sticky", top: 110 }}>
            <div style={{ position: "relative", paddingTop: 12 }}>
              <Tape color={theme.tape2} style={{ top: -8, right: "24%", transform: "rotate(-4deg)", zIndex: 2 }} />
              <FormCard state={liveState} accent={accent} theme={theme} L={L} product={product} interactive onState={setLiveState} />
            </div>
          </div>
        </div>
      </section>

      {/* footer of landing — terms/privacy */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px 44px" }}>
        <div style={{ borderTop: `1px dashed ${line}`, paddingTop: 18, display: "flex", gap: 18, flexWrap: "wrap", fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: faint, letterSpacing: "0.06em" }}>
          <span>{S.footerNote}</span>
          <span style={{ flex: 1 }} />
          <a href="#" onClick={e => e.preventDefault()} style={{ color: muted, textDecoration: "none" }}>{S.terms}</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="#" onClick={e => e.preventDefault()} style={{ color: muted, textDecoration: "none" }}>{S.privacy}</a>
        </div>
      </section>

      {/* ============ SURFACE 1b — EVERY STATE ============ */}
      <section style={{ background: dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.022)", borderTop: `1px dashed ${line}`, borderBottom: `1px dashed ${line}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "54px 28px" }}>
          <SectionKicker glyph="◰" kick={L === "pt" ? "todos os estados" : "every state"} theme={theme}
            title={L === "pt" ? "Cada estado, um frame" : "Each state, one frame"}
            sub={L === "pt" ? "Opt-in único: sem email de confirmação. O sucesso troca o formulário no lugar. Email + um consentimento — nada de nome, telefone ou preço." : "Single opt-in: no confirmation email. Success swaps the form in place. Email + one consent — no name, phone, or price."} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "32px 28px" }}>
            {STATE_FRAMES.map(([st, label, note], i) => (
              <Frame key={st} index={String(i + 1).padStart(2, "0")} label={label} note={note} theme={theme} accent={accent} w={350}>
                <FormCard state={st} accent={accent} theme={theme} L={L} product={product} width={350} />
              </Frame>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SURFACE 2 — EMBED ============ */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 56px" }}>
        <SectionKicker glyph="❏" kick={L === "pt" ? "superfície 2 · embed" : "surface 2 · embed"} theme={theme}
          title={L === "pt" ? "Bloco incorporável" : "Embeddable block"}
          sub={L === "pt" ? "O mesmo formulário, num card de ~480px que cai em qualquer página via <iframe>. Funciona sozinho num fundo branco/transparente, com borda fina e sombra. Tematizável por uma cor de destaque." : "The same form in a ~480px card that drops into any page via <iframe>. Stands alone on a white/transparent background, thin border + shadow. Themeable by accent color."} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-start" }}>
          <EmbedFrame label={L === "pt" ? "padrão · estado aberto" : "default · open state"} theme={theme} accent={accent} L={L} product={product} state="idle" mono={L === "pt" ? "<iframe src=\".../embed/waitlists/" + slug + "\">" : "<iframe src=\".../embed/waitlists/" + slug + "\">"} />
          <EmbedFrame label={L === "pt" ? "cor de destaque custom" : "custom accent"} theme={theme} accent={customAccent} L={L} product={product} state="idle" mono={"?accent=" + (dark ? "5AA9D6" : "1F5F8B")} />
          <EmbedFrame label={L === "pt" ? "estado de sucesso" : "success state"} theme={theme} accent={accent} L={L} product={product} state="success" />
        </div>
        <EmbedSnippet theme={theme} accent={accent} L={L} slug={slug} />
      </section>

      {/* ============ SURFACE 3 — IN A BLOG POST ============ */}
      <section style={{ background: dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.022)", borderTop: `1px dashed ${line}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "60px 28px 64px" }}>
          <SectionKicker glyph="¶" kick={L === "pt" ? "superfície 3 · dentro de um post" : "surface 3 · inside a post"} theme={theme}
            title={L === "pt" ? "Nó inline no artigo" : "Inline node in the article"}
            sub={L === "pt" ? "O formulário interrompe a leitura como um bloco distinto — separado do corpo por um leve fundo e uma borda de acento. À direita, como o editor (TipTap) representa o nó." : "The form interrupts reading as a distinct block — set apart by a subtle tint and an accent border. On the right, how the editor (TipTap) represents the node."} />
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 40, alignItems: "start" }}>
            <ArticleWithNode theme={theme} accent={accent} L={L} product={product} />
            <div style={{ position: "sticky", top: 100 }}>
              <TipTapInset theme={theme} accent={accent} L={L} product={product} slug={slug} />
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: "30px 28px", textAlign: "center", color: faint, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.08em" }}>
        <div style={{ marginBottom: 14, color: muted }}>{S.footerNote}</div>
        <a href="Pinboard.html" style={{ color: accent, textDecoration: "none" }}>← {S.backHome}</a>
      </footer>

      <style>{`
        @keyframes wlpSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { [style*="wlpSpin"] { animation: none !important; } }
      `}</style>
    </div>
  );
};

/* ---------- embed copy-paste snippet ---------- */
function EmbedSnippet({ theme, accent, L, slug }) {
  const { ink, muted, faint, line, dark, paper } = theme;
  const [copied, setCopied] = React.useState(false);
  const iframeCode = `<iframe src="https://bythiagofigueiredo.com/embed/waitlists/${slug}"\n        width="480" height="420" loading="lazy"\n        style="border:0;width:100%;max-width:480px"></iframe>`;
  const listenerCode = `<script>\n  addEventListener('message', (e) => {\n    if (e.data?.type === 'waitlist:resize')\n      document.querySelector('#wl-embed').style.height = e.data.height + 'px';\n  });\n<\/script>`;
  const copy = () => {
    const text = iframeCode + "\n\n" + listenerCode;
    const fallback = () => { try { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } catch (e) {} };
    try {
      const p = navigator.clipboard && navigator.clipboard.writeText(text);
      if (p && p.catch) p.catch(fallback); else fallback();
    } catch (e) { fallback(); }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  const codeBox = { background: dark ? "#0E0D0B" : "#1A1714", color: "#E8DFCB", fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, lineHeight: 1.7, padding: "14px 16px", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "auto" };
  return (
    <div style={{ marginTop: 36, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: ink, fontWeight: 600 }}>{L === "pt" ? "como incorporar" : "how to embed"}</span>
        <span style={{ flex: 1, height: 1, background: line }} />
        <button onClick={copy} aria-label={L === "pt" ? "copiar código" : "copy code"} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px",
          background: copied ? accent : "transparent", color: copied ? "#FFF" : accent,
          border: `1.5px solid ${accent}`, fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
          letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
        }}>{copied ? (L === "pt" ? "✓ copiado" : "✓ copied") : (L === "pt" ? "⧉ copiar" : "⧉ copy")}</button>
        <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>{copied ? (L === "pt" ? "Código copiado para a área de transferência" : "Code copied to clipboard") : ""}</span>
      </div>
      <div style={{ border: `1px solid ${dark ? "#23211C" : "#2E2A24"}`, borderRadius: 4, overflow: "hidden" }}>
        <div style={codeBox}><span style={{ color: faint }}>{L === "pt" ? "// cole onde o card deve aparecer" : "// paste where the card should appear"}</span>{"\n"}{iframeCode}</div>
        <div style={{ ...codeBox, borderTop: `1px solid rgba(255,255,255,0.08)` }}><span style={{ color: faint }}>{L === "pt" ? "// opcional: auto-altura sem barra de rolagem" : "// optional: auto-height, no scrollbar"}</span>{"\n"}{listenerCode}</div>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: faint, marginTop: 10, lineHeight: 1.5 }}>
        {L === "pt" ? "O bloco posta " : "The block posts "}<span style={{ color: accent }}>waitlist:resize</span>{L === "pt" ? " no mount e a cada mudança de altura. Tema via " : " on mount and on every height change. Theme via "}<span style={{ color: accent }}>?accent=RRGGBB</span>.
      </div>
    </div>
  );
}

/* ---------- embed frame (card on a neutral host) ---------- */
function EmbedFrame({ label, theme, accent, L, product, state, mono }) {
  const { faint, ink, dark } = theme;
  // host background: simulate a third-party white/neutral page
  const hostBg = dark ? "#0E0D0B" : "#FFFFFF";
  return (
    <div style={{ width: 432 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 10 }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: ink, fontWeight: 600 }}>{label}</span>
      </div>
      {/* host frame */}
      <div style={{ background: hostBg, padding: 26, border: `1px solid ${dark ? "#23211C" : "#E6DECB"}`, borderRadius: 4 }}>
        <div style={{
          background: theme.paper, position: "relative", borderRadius: 3, overflow: "hidden",
          border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}`,
          boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 22px rgba(40,30,10,0.10)",
        }}>
          <div style={{ height: 5, background: state === "closed" ? "#CEBFA0" : accent }} />
          <window.WaitlistForm state={state} accent={accent} theme={theme} L={L} product={product} variant="embed" />
          <div style={{ padding: "8px 22px 12px", borderTop: `1px dashed ${theme.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: faint, letterSpacing: "0.06em" }}>{L === "pt" ? "lista de espera" : "waitlist"} · bythiagofigueiredo.com</span>
            <window.WLBrandMark color={accent} size={11} />
          </div>
        </div>
      </div>
      {mono && <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: faint, marginTop: 10, letterSpacing: "0.02em", wordBreak: "break-all" }}>{mono}</div>}
    </div>
  );
}

/* small 6-petal brand asterisk (reused from shared Brand) */
window.WLBrandMark = function ({ color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <g fill={color}>
        {[0, 60, 120].map(deg => <path key={deg} d="M 12 1 C 10.2 5, 10.2 19, 12 23 C 13.8 19, 13.8 5, 12 1 Z" transform={`rotate(${deg} 12 12)`} />)}
        <circle cx="12" cy="12" r="0.81" fill={color} />
      </g>
    </svg>
  );
};

/* ---------- article with inline node ---------- */
function ArticleWithNode({ theme, accent, L, product }) {
  const { ink, muted, faint, line, dark, hand } = theme;
  const serif = '"Source Serif 4", Georgia, serif';
  const paras = L === "pt" ? [
    "Eu calculei tudo três vezes antes de aceitar que daria certo. O aluguel de um apê decente em Bangkok custava menos que a minha conta de internet em casa — e ainda sobrava pra comer fora todo dia.",
    "A parte difícil nunca foi a passagem. Foi o medo de largar a estabilidade: o contrato, a previsibilidade, a desculpa de que \u201cum dia eu vou\u201d. O jogo só mudou quando parei de tratar isso como sonho e comecei a tratar como projeto — com checklist, orçamento e data.",
  ] : [
    "I ran the numbers three times before I let myself believe it would work. Rent on a decent flat in Bangkok cost less than my home internet bill — and there was still money left to eat out every day.",
    "The hard part was never the flight. It was the fear of leaving stability behind: the contract, the predictability, the \u201cone day I'll go\u201d excuse. The game only changed when I stopped treating it as a dream and started treating it as a project — checklist, budget, date.",
  ];
  const para3 = L === "pt"
    ? "Estou montando uma turma pra fazer isso junto, do zero. Se isso te interessa, deixa seu email — você fica sabendo antes de abrir pro público."
    : "I'm putting together a cohort to do this together, from scratch. If that's interesting to you, drop your email — you'll hear before it opens to the public.";

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: accent, fontWeight: 700, marginBottom: 10 }}>
        {L === "pt" ? "diário · ásia" : "journal · asia"}
      </div>
      <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 34, margin: "0 0 18px", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.12, color: ink }}>
        {L === "pt" ? "O dia em que o câmbio virou meu argumento" : "The day the exchange rate became my argument"}
      </h2>
      {paras.map((p, i) => (
        <p key={i} style={{ fontFamily: serif, fontSize: 18, lineHeight: 1.7, color: ink, margin: "0 0 20px", textWrap: "pretty" }}>{p}</p>
      ))}

      {/* inline waitlist node — set apart */}
      <div style={{
        margin: "30px 0", padding: "2px 0 0",
        position: "relative",
      }}>
        <div style={{
          background: dark ? "rgba(255,130,64,0.06)" : "rgba(193,69,19,0.045)",
          border: `1px solid ${dark ? "rgba(255,130,64,0.26)" : "rgba(193,69,19,0.2)"}`,
          borderLeft: `3px solid ${accent}`,
        }}>
          <div style={{ padding: "16px 20px 0" }}>
            <div style={{ ...hand, fontSize: 22, color: accent, lineHeight: 1, marginBottom: 4 }}>
              {L === "pt" ? "curtiu? entra na lista." : "into it? join the list."}
            </div>
          </div>
          <window.WaitlistForm state="idle" accent={accent} theme={theme} L={L} product={product} variant="inline" />
        </div>
      </div>

      <p style={{ fontFamily: serif, fontSize: 18, lineHeight: 1.7, color: ink, margin: "0 0 20px", textWrap: "pretty" }}>{para3}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
        <span style={{ width: 30, height: 1, background: line }} />
        <span style={{ fontFamily: serif, fontSize: 15, color: accent }}>❦</span>
        <span style={{ width: 30, height: 1, background: line }} />
      </div>
    </div>
  );
}

/* ---------- TipTap editor inset (how the node looks while editing) ---------- */
function TipTapInset({ theme, accent, L, product, slug }) {
  const { ink, muted, faint, line, dark, paper } = theme;
  const Bar = ({ w }) => <div style={{ height: 9, width: w, background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", borderRadius: 3 }} />;
  return (
    <div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: ink, fontWeight: 600, marginBottom: 10 }}>
        {L === "pt" ? "no editor (TipTap)" : "in the editor (TipTap)"}
      </div>
      <div style={{ background: dark ? "#1B1813" : "#FFFDF8", border: `1px solid ${dark ? "#2A2620" : "#E6DECB"}`, borderRadius: 6, overflow: "hidden" }}>
        {/* faux toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderBottom: `1px solid ${line}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
          {["B", "i", "“", "</>"].map((g, i) => (
            <span key={i} style={{ width: 24, height: 22, display: "grid", placeItems: "center", borderRadius: 5, color: faint, fontSize: 11, fontWeight: 700, fontStyle: g === "i" ? "italic" : "normal", fontFamily: g === "</>" ? '"JetBrains Mono", monospace' : "inherit" }}>{g}</span>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: faint, letterSpacing: "0.08em" }}>MDX</span>
        </div>
        {/* faux body */}
        <div style={{ padding: "16px 16px 18px", display: "grid", gap: 9 }}>
          <Bar w="92%" /><Bar w="80%" /><Bar w="86%" />
          <div style={{ height: 4 }} />
          {/* selected node */}
          <div style={{ position: "relative", outline: `2px solid ${accent}`, outlineOffset: 3, borderRadius: 2 }}>
            <div style={{ position: "absolute", top: -9, left: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", background: accent, color: "#FFF", fontFamily: '"JetBrains Mono", monospace', fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, zIndex: 2 }}>
              <span style={{ display: "inline-flex", gap: 2 }}>
                <span style={{ width: 2, height: 2, borderRadius: "50%", background: "#FFF" }} />
                <span style={{ width: 2, height: 2, borderRadius: "50%", background: "#FFF" }} />
              </span>
              waitlist node
            </div>
            <div style={{ background: dark ? "rgba(255,130,64,0.06)" : "rgba(193,69,19,0.04)", border: `1px solid ${dark ? "rgba(255,130,64,0.22)" : "rgba(193,69,19,0.16)"}`, padding: "16px 14px 14px" }}>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: 16, fontWeight: 500, color: ink, marginBottom: 4 }}>{product["name_" + L]}</div>
              <div style={{ fontSize: 11.5, color: muted, marginBottom: 12, lineHeight: 1.4 }}>{L === "pt" ? "Formulário de lista de espera · email + consentimento" : "Waitlist form · email + consent"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, height: 30, border: `1px solid ${line}`, background: dark ? "rgba(0,0,0,0.2)" : "#FFF", display: "flex", alignItems: "center", padding: "0 10px", fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: faint }}>{L === "pt" ? "email…" : "email…"}</div>
                <div style={{ height: 30, padding: "0 12px", background: accent, color: "#FFF", display: "grid", placeItems: "center", fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{L === "pt" ? "avisar" : "notify"}</div>
              </div>
            </div>
          </div>
          <div style={{ height: 4 }} />
          <Bar w="88%" /><Bar w="74%" />
        </div>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: faint, marginTop: 10, lineHeight: 1.5, letterSpacing: "0.02em" }}>
        {L === "pt" ? "Serializa como " : "Serializes as "}<span style={{ color: accent }}>{`<WaitlistForm slug="${slug}" />`}</span>{L === "pt" ? " no MDX — bloco selecionável, arrastável, deletável." : " in MDX — a selectable, draggable, deletable block."}
      </div>
    </div>
  );
}

window.WaitlistPublic = WaitlistPublic;
