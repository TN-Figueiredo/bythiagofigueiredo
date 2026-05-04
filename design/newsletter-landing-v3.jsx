/*
 * Newsletter Landing — single-newsletter conversion page.
 * v2: double opt-in flow, real samples, mobile sticky CTA, weighted cross-promo,
 * collapsible FAQ, recency indicator, refined hierarchy.
 */

const NewsletterLanding = ({ t, dark, content, slug, tier = "guest" }) => {
  const C = content;
  const sites = C.sites;
  const nls = C.newsletters;
  const L = window._lang;

  const type = nls.find(n => n["slug_" + L] === slug || n.slug_pt === slug || n.slug_en === slug);

  const theme = window.makePinboardTheme(dark);
  const kit = window.makePinboardKit(theme);
  const { PageHeader, Paper, Tape } = kit;
  const { bg, paper, paper2, ink, muted, faint, line, accent: globalAccent, marker, hand, tape, tape2, rot, lift } = theme;

  const nav = [
    { key: "home", href: "Pinboard.html", label: t.nav.home },
    { key: "writing", href: "blog.html", label: t.nav.writing },
    { key: "videos", href: "videos.html", label: t.nav.videos },
    { key: "newsletters", href: "newsletters.html", label: t.nav.newsletter },
    { key: "about", href: "about.html", label: t.nav.about },
    { key: "contact", href: sites.contact.url, label: sites.contact["label_" + L] },
  ];

  const nlColor = (n) => dark ? n.color_dark : n.color;

  // ---------- 404 fallback ----------
  if (!type) {
    return (
      <div style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: '"Inter", sans-serif' }}>
        <PageHeader nav={nav} current="newsletters" ctas={null}/>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "96px 28px" }}>
          <div style={{ ...hand, fontSize: 56, color: globalAccent, transform: "rotate(-3deg)", marginBottom: 12 }}>
            {L === "pt" ? "epa." : "huh."}
          </div>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 44, margin: "0 0 16px", fontWeight: 500, letterSpacing: "-0.02em" }}>
            {L === "pt" ? "Essa newsletter não existe." : "That newsletter doesn't exist."}
          </h1>
          <p style={{ fontSize: 17, color: muted, lineHeight: 1.6, marginBottom: 32 }}>
            {L === "pt"
              ? "Talvez o link tenha quebrado. Aqui estão as que existem agora:"
              : "Maybe the link broke. Here are the ones that exist now:"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {nls.map(n => (
              <a key={n.id} href={`?slug=${n["slug_" + L]}`} style={{
                display: "block", textDecoration: "none", color: "inherit",
                padding: "16px 18px", borderLeft: `4px solid ${nlColor(n)}`,
                background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
              }}>
                <div style={{ fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{n["name_" + L]}</div>
                <div style={{ fontSize: 13, color: muted }}>{n["tagline_" + L]}</div>
              </a>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ---------- Resolved type ----------
  const accent = nlColor(type);
  const subsCount = type.subs_count || 0;
  const issuesCount = type.issues_count || 0;
  const showSubs = subsCount >= 100;
  const showIssues = issuesCount >= 1;
  const isNew = subsCount < 100 && issuesCount < 3;
  const samples = type["sample_issues_" + L] || [];
  const lastIssueDate = samples[0]?.date || "—";
  const daysSinceLast = type.id === "main" ? 5 : type.id === "code" ? 6 : type.id === "growth" ? 9 : 38;

  // ---------- Form state — double opt-in ----------
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [phase, setPhase] = React.useState("idle"); // idle | loading | pending | confirmed | error
  const [errorKey, setErrorKey] = React.useState("");
  const [openFaq, setOpenFaq] = React.useState(0);

  const submit = (e) => {
    e.preventDefault();
    if (!email.includes("@") || !consent) return;
    setPhase("loading");
    setTimeout(() => {
      if (email.toLowerCase().includes("blocked")) { setErrorKey("rate"); setPhase("error"); return; }
      if (email.toLowerCase().includes("dup")) { setErrorKey("dup"); setPhase("error"); return; }
      if (!email.includes(".")) { setErrorKey("invalid"); setPhase("error"); return; }
      setPhase("pending"); // double opt-in: waiting for confirmation
    }, 700);
  };

  // Demo helper to advance to confirmed state
  const simulateConfirmClick = () => setPhase("confirmed");

  // ---------- i18n ----------
  const S = L === "pt" ? {
    crumbHome: "Início", crumbHub: "Newsletters", newBadge: "novo",
    subsLabel: "inscritos", issuesLabel: "edições", subscribers: "inscritos",
    sectionWhat: "O que vem em cada email",
    sectionSamples: "Edições recentes",
    sectionTestimonial: "Quem assina, fala",
    sectionAuthor: "Quem escreve",
    sectionOthers: "As outras três newsletters",
    sectionFaq: "Antes de você se inscrever",
    formKicker: "se inscrever",
    formTitle: "Receba na sua caixa",
    formSubtitle: "É grátis, com confirmação por email.",
    emailLabel: "Seu email",
    emailPlaceholder: "voce@email.com",
    consentPrefix: "Concordo em receber a ",
    consentSuffix: " por email e li a ",
    privacy: "Política de Privacidade",
    submit: "inscrever",
    submitting: "enviando…",
    // double opt-in
    pendingTitle: "Quase lá — falta um clique.",
    pendingBody: (e) => `Acabei de mandar um email para ${e}. Procura pelo assunto "Confirma a inscrição em…" e clica no botão de confirmar.`,
    pendingStep1: "Email enviado",
    pendingStep2: "Aguardando seu clique",
    pendingStep3: "Pronto pra receber",
    pendingTip: "Não chegou em 5 min? Olha no spam ou em \"Promoções\". Ainda não? Tenta um email diferente.",
    pendingResend: "reenviar email",
    pendingResent: "reenviado!",
    pendingChangeEmail: "trocar email",
    pendingDemo: "▸ simular clique no email (demo)",
    confirmedTitle: "Confirmado.",
    confirmedBody: "Sua primeira edição chega no próximo ciclo. Enquanto isso, dá uma olhada nas outras coisas que escrevo.",
    successAgain: "inscrever outro email",
    errRate: "Devagar aí. Tenta de novo em alguns minutos.",
    errDup: "Esse email já está inscrito. Valeu!",
    errInvalid: "Email não parece válido.",
    errServer: "Algo deu errado. Tenta de novo?",
    footerNote: "Sem spam. Sem parceria escondida. Sem 'URGENTE' no assunto.",
    footerSub: "Descadastro com um clique no rodapé de cada email.",
    learnMore: "ver detalhes",
    backToHub: "ver as 4 newsletters",
    sampleKicker: "amostras",
    cadenceLabel: "frequência",
    sentLabel: "última saiu",
    sender: "Thiago Figueiredo",
    senderRole: "dev indie, BH",
    daysAgo: (n) => n === 0 ? "hoje" : n === 1 ? "ontem" : `há ${n} dias`,
    sampleNum: "edição",
    sampleSubject: "assunto",
    sampleTo: "para",
    sampleArchive: "edições completas só pra inscritos",
    // ---- tiers ----
    tierGuestLabel: "visitante",
    tierSubLabel: "inscrito",
    tierColabLabel: "colaborador",
    tierStampGuest: "VISITANTE",
    tierStampSub: "INSCRITO",
    tierStampColab: "COLAB · ARQUIVO ABERTO",
    lockedTitle: "Carta lacrada",
    lockedSubtitle: "Edição publicada antes de você assinar.",
    lockedFor: "só colaboradores leem o arquivo",
    lockedSubText: "Você passa a receber daqui pra frente.",
    lockedColabPerk: "abrir todas as cartas",
    lockedFutureBadge: "✓ futuras inclusas",
    lockedPastBadge: "🔒 passadas",
    sentToColabsOnly: "enviado para colaboradores",
    archiveCount: (n) => `+${n} edições no arquivo`,
    archiveLockedNote: "as edições anteriores ficam lacradas no arquivo. quem se inscreve agora começa do próximo email — sem cobrança, sem pegadinha. quem quer ler tudo vira colaborador.",
    archiveAllOpen: "você tem acesso completo ao arquivo. obrigado por bancar isso.",
    upgradeKicker: "abrir o arquivo",
    upgradeTitle: "Vira colaborador.",
    upgradeBody: "Apoia o que escrevo, libera o arquivo completo das 4 newsletters, recebe um boletim mensal só pra colab e meu email pra responder direto.",
    upgradeOption1Title: "R$ 9 / mês",
    upgradeOption1Sub: "no Pix recorrente",
    upgradeOption1Bullet: "cancela quando quiser",
    upgradeOption2Title: "Contribui com texto",
    upgradeOption2Sub: "publica um post no blog",
    upgradeOption2Bullet: "vira colab por 6 meses",
    upgradeOption3Title: "Convite",
    upgradeOption3Sub: "alguém colab pode te indicar",
    upgradeOption3Bullet: "sem cobrança",
    upgradeCTA: "virar colaborador →",
    upgradeWriteCTA: "ver como contribuir →",
    upgradeNote: "sem upsell agressivo. se preferir só receber as próximas, tá tudo bem — o formulário acima é grátis pra sempre.",
    youCanReadKicker: "você tem acesso a tudo",
    welcomeColabBody: "obrigado por estar aqui. todas as edições estão abertas pra você ler quando quiser. seu próximo boletim de colab sai semana que vem.",
    welcomeColabCTA: "abrir o arquivo completo →",
    finalKicker: "última chamada",
    finalSub: (c) => `Um email, ${c}. Fácil de cancelar, fácil de ler.`,
    backToTopForm: "ir pro formulário",
    crossPick: "recomendado pra você",
    or: "ou",
    faqs: [
      { q: "Vou receber promoção ou venda?", a: "Não. A newsletter é o produto. Se um dia eu lançar algo meu, você fica sabendo \u2014 e ainda assim tem botão de pular." },
      { q: "Você compartilha meu email?", a: "Não. Está num banco que só eu acesso. Sem ferramenta de tracking de terceiros, sem pixel de marketing." },
      { q: "Posso descadastrar quando?", a: "A qualquer hora. Tem link no rodapé de cada email. Não preciso saber o motivo, e você não precisa explicar." },
      { q: "Posso assinar mais de uma?", a: "Sim. Cada uma tem sua frequência e seu tema. Marca quantas quiser na página principal — um email só." },
      { q: "E se você parar de mandar?", a: "Se eu sumir por 2 meses, é porque algo aconteceu. Você não fica num limbo: te aviso ou alguém avisa por mim." },
    ],
  } : {
    crumbHome: "Home", crumbHub: "Newsletters", newBadge: "new",
    subsLabel: "subscribers", issuesLabel: "issues", subscribers: "subscribers",
    sectionWhat: "What's in every email",
    sectionSamples: "Recent issues",
    sectionTestimonial: "From a subscriber",
    sectionAuthor: "Who's writing",
    sectionOthers: "The other three newsletters",
    sectionFaq: "Before you subscribe",
    formKicker: "subscribe",
    formTitle: "Get it in your inbox",
    formSubtitle: "Free, with email confirmation.",
    emailLabel: "Your email",
    emailPlaceholder: "you@email.com",
    consentPrefix: "I agree to receive ",
    consentSuffix: " by email and I've read the ",
    privacy: "Privacy Policy",
    submit: "subscribe",
    submitting: "sending…",
    pendingTitle: "Almost there — one click left.",
    pendingBody: (e) => `I just sent an email to ${e}. Look for the subject "Confirm your subscription to…" and click the confirm button.`,
    pendingStep1: "Email sent",
    pendingStep2: "Waiting for your click",
    pendingStep3: "Ready to receive",
    pendingTip: "Didn't arrive in 5 min? Check spam or \"Promotions\". Still nothing? Try a different email.",
    pendingResend: "resend email",
    pendingResent: "resent!",
    pendingChangeEmail: "change email",
    pendingDemo: "▸ simulate clicking the email (demo)",
    confirmedTitle: "Confirmed.",
    confirmedBody: "Your first issue arrives next cycle. Meanwhile, take a look at the other things I write.",
    successAgain: "subscribe another email",
    errRate: "Easy there. Try again in a few minutes.",
    errDup: "You're already subscribed. Thanks!",
    errInvalid: "That email doesn't look right.",
    errServer: "Something broke. Try again?",
    footerNote: "No spam. No hidden sponsors. No 'URGENT' subject lines.",
    footerSub: "Unsubscribe is one click in every email's footer.",
    learnMore: "see details",
    backToHub: "see all 4 newsletters",
    sampleKicker: "samples",
    cadenceLabel: "cadence",
    sentLabel: "last shipped",
    sender: "Thiago Figueiredo",
    senderRole: "indie dev, Brazil",
    daysAgo: (n) => n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`,
    sampleNum: "issue",
    sampleSubject: "subject",
    sampleTo: "to",
    sampleArchive: "full issues are subscriber-only",
    // ---- tiers ----
    tierGuestLabel: "guest",
    tierSubLabel: "subscriber",
    tierColabLabel: "collaborator",
    tierStampGuest: "GUEST",
    tierStampSub: "SUBSCRIBER",
    tierStampColab: "COLLAB · ARCHIVE OPEN",
    lockedTitle: "Sealed letter",
    lockedSubtitle: "Issue published before you subscribed.",
    lockedFor: "collaborators read the archive",
    lockedSubText: "You'll receive everything from now on.",
    lockedColabPerk: "open every letter",
    lockedFutureBadge: "✓ future issues included",
    lockedPastBadge: "🔒 past ones",
    sentToColabsOnly: "sent to collaborators only",
    archiveCount: (n) => `+${n} issues in the archive`,
    archiveLockedNote: "past issues are sealed in the archive. subscribing now starts you from the next email — no charge, no trick. Want to read everything? become a collaborator.",
    archiveAllOpen: "you have full archive access. thanks for backing this.",
    upgradeKicker: "open the archive",
    upgradeTitle: "Become a collaborator.",
    upgradeBody: "Support what I write, unlock the full archive across all 4 newsletters, get a monthly collab-only digest, and my email to reply directly.",
    upgradeOption1Title: "R$ 9 / month",
    upgradeOption1Sub: "recurring Pix",
    upgradeOption1Bullet: "cancel any time",
    upgradeOption2Title: "Contribute writing",
    upgradeOption2Sub: "publish a guest post",
    upgradeOption2Bullet: "collab for 6 months",
    upgradeOption3Title: "Invite",
    upgradeOption3Sub: "a collab can invite you",
    upgradeOption3Bullet: "no charge",
    upgradeCTA: "become a collaborator →",
    upgradeWriteCTA: "see how to contribute →",
    upgradeNote: "no aggressive upsell. If you'd rather just get the next issues, that's fine — the form above is free forever.",
    youCanReadKicker: "you have full access",
    welcomeColabBody: "thanks for being here. every issue is open for you to read whenever. your next collab-only digest ships next week.",
    welcomeColabCTA: "open full archive →",
    finalKicker: "last call",
    finalSub: (c) => `One email, ${c}. Easy to cancel, easy to read.`,
    backToTopForm: "go to form",
    crossPick: "recommended for you",
    or: "or",
    faqs: [
      { q: "Will I get promos or sales pitches?", a: "No. The newsletter is the product. If I ever launch something of mine, you'll hear about it \u2014 and still get a skip button." },
      { q: "Do you share my email?", a: "No. It's in a database only I can read. No third-party tracking tools, no marketing pixels." },
      { q: "When can I unsubscribe?", a: "Any time. There's a link in every email's footer. I don't need to know why, and you don't need to explain." },
      { q: "Can I subscribe to more than one?", a: "Yes. Each has its own rhythm and theme. Pick as many as you want on the main page — same email, one click each." },
      { q: "What if you stop sending?", a: "If I disappear for 2 months, something happened. You won't be in limbo: I'll let you know, or someone will on my behalf." },
    ],
  };

  const errorMsg = errorKey === "rate" ? S.errRate
    : errorKey === "dup" ? S.errDup
    : errorKey === "invalid" ? S.errInvalid
    : S.errServer;

  const [resentFlag, setResentFlag] = React.useState(false);
  const onResend = () => {
    setResentFlag(true);
    setTimeout(() => setResentFlag(false), 2200);
  };

  // Recommended cross-promo (the one with most subscribers among the others)
  const others = nls.filter(n => n.id !== type.id);
  const recommended = others.slice().sort((a, b) => (b.subs_count || 0) - (a.subs_count || 0))[0];
  const moreOthers = others.filter(n => n.id !== recommended?.id);

  // ============================================================
  //  SUBSCRIBE CARD — handles all phases including double opt-in
  // ============================================================
  const SubscribeCard = ({ id }) => {
    // PENDING — waiting for confirm
    if (phase === "pending") {
      return (
        <Paper tint={paper} pad="0" rotation={0} y={0} style={{ outline: `2px solid ${accent}`, outlineOffset: 4 }}>
          <div style={{ height: 6, background: accent }}/>
          <div style={{ padding: "26px 26px 24px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "4px 10px", marginBottom: 14,
              background: dark ? "rgba(255,226,122,0.14)" : "rgba(255,226,122,0.4)",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: "0.18em", textTransform: "uppercase", color: dark ? "#FFE37A" : "#8B6500",
              fontWeight: 700,
            }}>
              ⏳ {L === "pt" ? "PASSO 2/2" : "STEP 2/2"}
            </div>
            <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: 26, margin: "0 0 12px", fontWeight: 500, letterSpacing: "-0.01em", color: ink, lineHeight: 1.15 }}>
              {S.pendingTitle}
            </h3>
            <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.55, margin: "0 0 18px" }}>
              {S.pendingBody(email)}
            </p>

            {/* Step indicator */}
            <div style={{ display: "grid", gap: 0, marginBottom: 20 }}>
              <Step done label={S.pendingStep1} dark={dark} accent={accent} faint={faint} muted={muted} ink={ink}/>
              <Step active label={S.pendingStep2} dark={dark} accent={accent} faint={faint} muted={muted} ink={ink}/>
              <Step pending label={S.pendingStep3} dark={dark} accent={accent} faint={faint} muted={muted} ink={ink} last/>
            </div>

            <div style={{
              padding: "10px 12px", marginBottom: 16,
              background: dark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.04)",
              borderLeft: `2px dashed ${accent}`,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: muted,
              wordBreak: "break-all",
            }}>
              ✉ <strong style={{ color: ink }}>{email}</strong>
            </div>

            <p style={{ fontSize: 12.5, color: faint, lineHeight: 1.5, margin: "0 0 16px" }}>
              <span style={{ ...hand, fontSize: 16, color: accent, marginRight: 6 }}>↳</span>
              {S.pendingTip}
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <button onClick={onResend} disabled={resentFlag} style={{
                padding: "9px 14px",
                background: resentFlag ? "transparent" : "transparent",
                color: resentFlag ? accent : ink,
                border: `1.5px solid ${resentFlag ? accent : line}`,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
                cursor: resentFlag ? "default" : "pointer",
              }}>
                {resentFlag ? `✓ ${S.pendingResent}` : `↻ ${S.pendingResend}`}
              </button>
              <button onClick={() => { setPhase("idle"); setEmail(""); setConsent(false); }} style={{
                padding: "9px 14px",
                background: "transparent", color: muted, border: `1.5px dashed ${line}`,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
              }}>
                {S.pendingChangeEmail}
              </button>
            </div>

            <button onClick={simulateConfirmClick} style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              color: faint, background: "transparent", border: "none",
              padding: 0, cursor: "pointer", letterSpacing: "0.06em",
              textDecoration: "underline", textUnderlineOffset: 3,
            }}>
              {S.pendingDemo}
            </button>
          </div>
        </Paper>
      );
    }

    // CONFIRMED — done
    if (phase === "confirmed") {
      return (
        <Paper tint={paper} pad="0" rotation={0} y={0} style={{ outline: `2px solid ${accent}`, outlineOffset: 4 }}>
          <div style={{ height: 6, background: accent }}/>
          <div style={{ padding: "30px 26px 26px" }}>
            <div style={{ ...hand, fontSize: 56, color: accent, lineHeight: 0.8, marginBottom: 10, transform: "rotate(-3deg)" }}>
              ✓ {L === "pt" ? "valeu!" : "thanks!"}
            </div>
            <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: 26, margin: "8px 0 12px", fontWeight: 500, letterSpacing: "-0.01em", color: ink }}>
              {S.confirmedTitle}
            </h3>
            <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.6, margin: "0 0 18px" }}>
              {S.confirmedBody}
            </p>
            <div style={{ display: "grid", gap: 0, marginBottom: 18 }}>
              <Step done label={S.pendingStep1} dark={dark} accent={accent} faint={faint} muted={muted} ink={ink}/>
              <Step done label={S.pendingStep2} dark={dark} accent={accent} faint={faint} muted={muted} ink={ink}/>
              <Step done label={S.pendingStep3} dark={dark} accent={accent} faint={faint} muted={muted} ink={ink} last/>
            </div>
            <button onClick={() => { setEmail(""); setConsent(false); setPhase("idle"); setErrorKey(""); }} style={{
              padding: "10px 16px",
              background: "transparent", color: muted, border: `1.5px dashed ${line}`,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
            }}>
              ↻ {S.successAgain}
            </button>
          </div>
        </Paper>
      );
    }

    // IDLE / LOADING / ERROR
    return (
      <Paper tint={paper} pad="0" rotation={-0.4} y={0}>
        <div style={{ height: 6, background: accent }}/>
        <Tape color={tape2} style={{ top: -10, right: "26%", transform: "rotate(-4deg)", zIndex: 2 }}/>

        <form onSubmit={submit} style={{ padding: "28px 26px 26px", position: "relative" }} id={id}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 10px", marginBottom: 12,
            background: accent + "22",
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: "0.18em", textTransform: "uppercase", color: accent,
            fontWeight: 700,
          }}>
            ✉ {L === "pt" ? "PASSO 1/2" : "STEP 1/2"}
          </div>
          <h3 style={{
            fontFamily: '"Fraunces", serif', fontSize: 26, margin: "0 0 6px",
            fontWeight: 500, letterSpacing: "-0.01em", color: ink, lineHeight: 1.15,
            position: "relative", display: "inline-block",
          }}>
            {S.formTitle}
            <span style={{
              position: "absolute", bottom: -2, left: -4, right: -4, height: 6,
              background: marker, zIndex: -1, opacity: 0.85, transform: "skew(-2deg)",
            }}/>
          </h3>
          <p style={{ fontSize: 13, color: muted, margin: "0 0 18px", lineHeight: 1.4 }}>
            {S.formSubtitle}
          </p>

          {/* email */}
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{
              display: "block", fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: "0.14em", textTransform: "uppercase", color: faint, marginBottom: 5,
            }}>
              {S.emailLabel}
            </span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={S.emailPlaceholder}
              required
              disabled={phase === "loading"}
              style={{
                width: "100%", padding: "12px 13px",
                border: `1.5px solid ${phase === "error" ? "#C14513" : line}`,
                background: dark ? "rgba(0,0,0,0.25)" : "#FFF", color: ink,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 13,
                outline: "none",
              }}
              onFocus={e => e.target.style.borderColor = accent}
              onBlur={e => e.target.style.borderColor = phase === "error" ? "#C14513" : line}
            />
          </label>

          {/* consent */}
          <label style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            fontSize: 12.5, lineHeight: 1.5, color: muted, cursor: "pointer",
            marginBottom: 16,
          }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              required
              style={{ marginTop: 2, accentColor: accent, flexShrink: 0, width: 16, height: 16, cursor: "pointer" }}
            />
            <span>
              {S.consentPrefix}
              <strong style={{ color: ink }}>{type["name_" + L]}</strong>
              {S.consentSuffix}
              <a href="#privacy" style={{ color: accent, textDecoration: "underline" }}>{S.privacy}</a>.
            </span>
          </label>

          {phase === "error" && (
            <div role="alert" aria-live="polite" style={{
              padding: "10px 12px", marginBottom: 14,
              background: "rgba(193,69,19,0.1)", borderLeft: `3px solid #C14513`,
              fontSize: 13, color: dark ? "#FFB088" : "#8B2E08",
            }}>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={phase === "loading" || !email.includes("@") || !consent}
            style={{
              width: "100%", padding: "14px 22px",
              background: (phase === "loading" || !email.includes("@") || !consent) ? (dark ? "#3A2E1F" : "#D8C9A7") : accent,
              color: (phase === "loading" || !email.includes("@") || !consent) ? faint : "#FFF",
              border: "none",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
              letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
              cursor: (phase === "loading" || !email.includes("@") || !consent) ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {phase === "loading" ? `↻ ${S.submitting}` : `✉ ${S.submit} →`}
          </button>

          {/* Inline trust microcopy — three icons */}
          <div style={{
            marginTop: 16, paddingTop: 14,
            borderTop: `1px dashed ${line}`,
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
            fontSize: 10, color: faint, fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.06em", textAlign: "center",
          }}>
            <div>✦ {L === "pt" ? "sem spam" : "no spam"}</div>
            <div>✕ {L === "pt" ? "sem venda" : "no pitch"}</div>
            <div>↗ {L === "pt" ? "1 clique pra sair" : "1-click leave"}</div>
          </div>
        </form>
      </Paper>
    );
  };

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <div id="top" lang={L === "pt" ? "pt-BR" : "en"} style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: '"Inter", sans-serif' }}>
      <PageHeader nav={nav} current="newsletters" ctas={null}/>

      {/* Tier stamp — discreet badge in top-right indicating viewer's tier */}
      <div
        className={`tier-stamp ${tier}`}
        role="status"
        aria-live="polite"
        aria-label={
          tier === "collaborator" ? (L === "pt" ? "Tier: colaborador, arquivo aberto" : "Tier: collaborator, archive open")
          : tier === "subscriber" ? (L === "pt" ? "Tier: inscrito" : "Tier: subscriber")
          : (L === "pt" ? "Tier: visitante (não inscrito)" : "Tier: guest (not subscribed)")
        }
        style={{
          color: tier === "collaborator" ? "#B89530"
            : tier === "subscriber" ? accent
            : (dark ? "#9E8E6E" : "#8B7C5F"),
        }}
      >
        <span aria-hidden="true">
          {tier === "collaborator" ? `✦ ${S.tierStampColab}`
            : tier === "subscriber" ? `✓ ${S.tierStampSub}`
            : `◌ ${S.tierStampGuest}`}
        </span>
      </div>

      {/* Breadcrumb */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 28px 0" }}>
        <nav style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          letterSpacing: "0.12em", color: faint, display: "flex", gap: 8, flexWrap: "wrap",
        }}>
          <a href="Pinboard.html" style={{ color: faint, textDecoration: "none" }}>{S.crumbHome}</a>
          <span>/</span>
          <a href="newsletters.html" style={{ color: faint, textDecoration: "none" }}>{S.crumbHub}</a>
          <span>/</span>
          <span style={{ color: accent }}>{type["slug_" + L]}</span>
        </nav>
      </section>

      {/* Hero + Form (2-col) */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 56, alignItems: "start" }}>

          {/* LEFT — pitch */}
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                letterSpacing: "0.2em", textTransform: "uppercase", color: accent, fontWeight: 700,
              }}>
                /{type["slug_" + L]}
              </span>
              {type.badge_pt && (
                <span style={{
                  padding: "3px 8px", background: accent, color: "#FFF",
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                  letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
                  transform: "rotate(-1deg)", display: "inline-block",
                }}>
                  {type["badge_" + L]}
                </span>
              )}
              {showIssues && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "3px 9px",
                  background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                  letterSpacing: "0.1em", color: muted,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: daysSinceLast < 14 ? "#3CB371" : "#D9A441", display: "inline-block" }}/>
                  {S.sentLabel} {S.daysAgo(daysSinceLast)}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 style={{
              fontFamily: '"Fraunces", serif', fontSize: 76, margin: 0, fontWeight: 500,
              letterSpacing: "-0.035em", lineHeight: 0.96, color: ink,
              position: "relative", display: "inline-block", textWrap: "balance",
            }}>
              {type["name_" + L]}
              <span style={{
                position: "absolute", bottom: 6, left: -8, right: -8, height: 22,
                background: accent, opacity: 0.16, zIndex: -1, transform: "skew(-2deg)",
              }}/>
            </h1>

            <p style={{
              fontFamily: '"Fraunces", serif', fontSize: 22, color: muted, lineHeight: 1.4,
              margin: "20px 0 28px", fontWeight: 400, fontStyle: "italic", maxWidth: 560,
            }}>
              {type["tagline_" + L]}
            </p>

            <p style={{
              fontSize: 17, color: ink, lineHeight: 1.65,
              margin: "0 0 32px", maxWidth: 600, textWrap: "pretty",
            }}>
              {type["description_" + L]}
            </p>

            {/* Stat row — refined: each in its own card */}
            <div style={{
              display: "grid", gridTemplateColumns: showSubs && showIssues ? "1fr 1fr 1fr" : "1fr 1fr",
              gap: 0, marginBottom: 36,
              border: `1px solid ${line}`,
            }}>
              <Stat label={S.cadenceLabel} value={type["cadence_" + L]} dark={dark} muted={muted} faint={faint} ink={ink}/>
              {showSubs && (
                <Stat
                  label={S.subsLabel}
                  value={subsCount >= 1000 ? `${(subsCount / 1000).toFixed(1)}k` : String(subsCount)}
                  dark={dark} muted={muted} faint={faint} ink={ink} accent={accent}
                  divider
                />
              )}
              {showIssues && (
                <Stat label={S.issuesLabel} value={String(issuesCount)} dark={dark} muted={muted} faint={faint} ink={ink} divider/>
              )}
            </div>

            {/* Promise list */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
                letterSpacing: "0.2em", textTransform: "uppercase", color: faint,
                marginBottom: 14, fontWeight: 700,
              }}>
                ▦ {S.sectionWhat}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {type["promise_" + L].map((line, i) => (
                  <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", fontSize: 15.5, color: ink, lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, marginTop: 8, width: 8, height: 8, background: accent, transform: "rotate(45deg)" }}/>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT — sticky form */}
          <div style={{ position: "sticky", top: 110 }}>
            <SubscribeCard id="form-hero"/>
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <a href="newsletters.html" style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.12em", color: faint, textDecoration: "none",
              }}>
                {S.or} <span style={{ textDecoration: "underline", color: muted }}>{S.backToHub} →</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Past issues — TIER AWARE */}
      <section id="archive" style={{ background: dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)", borderTop: `1px dashed ${line}`, borderBottom: `1px dashed ${line}`, scrollMarginTop: 80 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 28px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
              letterSpacing: "0.2em", textTransform: "uppercase", color: faint, fontWeight: 700,
            }}>
              ▤ {S.sampleKicker}
            </div>
            <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 36, margin: 0, fontWeight: 500, letterSpacing: "-0.02em", color: ink }}>
              {S.sectionSamples}
            </h2>
            {/* Future / past badge row */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{
                padding: "4px 9px", background: accent + "22", color: accent,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                letterSpacing: "0.12em", fontWeight: 700,
              }}>
                {S.lockedFutureBadge}
              </span>
              {tier !== "collaborator" && (
                <span style={{
                  padding: "4px 9px",
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                  color: faint,
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                  letterSpacing: "0.12em", fontWeight: 700,
                }}>
                  {S.lockedPastBadge}
                </span>
              )}
            </div>
          </div>

          {/* Tier-aware note */}
          <p style={{
            fontSize: 13.5, color: muted, lineHeight: 1.55, margin: "0 0 28px", maxWidth: 720,
            fontStyle: tier === "collaborator" ? "italic" : "normal",
          }}>
            {tier === "collaborator" ? (
              <span><span style={{ color: "#B89530", fontWeight: 600 }}>✦ </span>{S.archiveAllOpen}</span>
            ) : (
              <span>{S.archiveLockedNote}</span>
            )}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
            {samples.map((s, i) => {
              // i === 0 is the most recent — always shown as free sample.
              // collaborator unlocks all.
              const isLocked = tier !== "collaborator" && i > 0;
              return (
                <IssueCard
                  key={i}
                  s={s}
                  i={i}
                  isLocked={isLocked}
                  tier={tier}
                  L={L}
                  S={S}
                  theme={theme}
                  kit={kit}
                  accent={accent}
                  dark={dark}
                  nlId={type.id}
                />
              );
            })}
          </div>

          {/* Archive count footer */}
          {issuesCount > samples.length && (
            <div style={{
              marginTop: 28, paddingTop: 20,
              borderTop: `1px dashed ${line}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: 16, flexWrap: "wrap",
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
                letterSpacing: "0.08em", color: muted,
              }}>
                {tier === "collaborator" ? "▤ " : "🔒 "}
                {S.archiveCount(issuesCount - samples.length)}
              </div>
              {tier === "collaborator" ? (
                <a href="#archive" style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                  letterSpacing: "0.14em", color: accent, textDecoration: "underline",
                }}>
                  {S.welcomeColabCTA}
                </a>
              ) : (
                <a href="#upgrade" style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                  letterSpacing: "0.14em", color: accent, textDecoration: "underline",
                }}>
                  {S.lockedColabPerk} →
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Upgrade section — only for non-collaborators */}
      {tier !== "collaborator" && (
        <section id="upgrade" style={{
          maxWidth: 1180, margin: "0 auto", padding: "72px 28px 16px",
          position: "relative",
        }}>
          {/* Decorative chain icon as transition */}
          <div aria-hidden style={{
            position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
            fontFamily: '"JetBrains Mono", monospace', fontSize: 16,
            color: "#B89530", opacity: 0.5, letterSpacing: "0.4em",
            whiteSpace: "nowrap",
          }}>
            ✦ ─ ✦ ─ ✦
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
              letterSpacing: "0.2em", textTransform: "uppercase", color: faint, fontWeight: 700,
            }}>
              ✦ {S.upgradeKicker}
            </div>
          </div>
          <h2 style={{
            fontFamily: '"Fraunces", serif', fontSize: 44, margin: "0 0 16px", fontWeight: 500,
            letterSpacing: "-0.025em", color: ink, lineHeight: 1.05,
            position: "relative", display: "inline-block",
          }}>
            {S.upgradeTitle}
            <span style={{
              position: "absolute", bottom: 4, left: -6, right: -6, height: 16,
              background: "#B89530", opacity: 0.18, zIndex: -1, transform: "skew(-2deg)",
            }}/>
          </h2>
          <p style={{ fontSize: 16, color: muted, lineHeight: 1.6, margin: "0 0 36px", maxWidth: 640 }}>
            {S.upgradeBody}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            <UpgradeOption
              title={S.upgradeOption1Title} sub={S.upgradeOption1Sub} bullet={S.upgradeOption1Bullet}
              cta={S.upgradeCTA} primary theme={theme} dark={dark} L={L}
            />
            <UpgradeOption
              title={S.upgradeOption2Title} sub={S.upgradeOption2Sub} bullet={S.upgradeOption2Bullet}
              cta={S.upgradeWriteCTA} theme={theme} dark={dark} L={L}
            />
            <UpgradeOption
              title={S.upgradeOption3Title} sub={S.upgradeOption3Sub} bullet={S.upgradeOption3Bullet}
              cta={null} muted theme={theme} dark={dark} L={L}
            />
          </div>

          <p style={{
            fontSize: 12.5, color: faint, lineHeight: 1.55, margin: "28px 0 0", maxWidth: 640,
            fontStyle: "italic",
          }}>
            ↳ {S.upgradeNote}
          </p>
        </section>
      )}

      {/* Welcome strip — only for collaborators */}
      {tier === "collaborator" && (
        <section style={{
          maxWidth: 1180, margin: "0 auto", padding: "48px 28px 16px",
        }}>
          <div style={{
            padding: "26px 30px",
            background: dark ? "rgba(184,149,48,0.08)" : "rgba(184,149,48,0.12)",
            borderLeft: `4px solid #B89530`,
            display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center",
          }}>
            <div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
                letterSpacing: "0.18em", textTransform: "uppercase", color: "#B89530",
                fontWeight: 700, marginBottom: 8,
              }}>
                ✦ {S.youCanReadKicker}
              </div>
              <p style={{ fontSize: 15, color: ink, lineHeight: 1.55, margin: 0, maxWidth: 600 }}>
                {S.welcomeColabBody}
              </p>
            </div>
            <a
              href="#archive"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById("archive");
                if (!el) return;
                el.scrollIntoView({ behavior: "smooth", block: "start" });
                el.classList.remove("archive-flash");
                // restart animation
                void el.offsetWidth;
                el.style.setProperty("--accent-color", accent);
                el.classList.add("archive-flash");
                setTimeout(() => el.classList.remove("archive-flash"), 1800);
              }}
              style={{
                padding: "12px 20px", background: "#B89530", color: "#FFF",
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
                textDecoration: "none", whiteSpace: "nowrap",
              }}>
              {S.welcomeColabCTA}
            </a>
          </div>
        </section>
      )}

      {/* Testimonial + Author */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
          {/* Testimonial — tier-aware: collaborators see a colab quote */}
          {(() => {
            const baseQuote = type["testimonial_" + L];
            const colabQuote = L === "pt" ? {
              text: tier === "collaborator"
                ? `Banco essa newsletter porque é a única coisa do meu RSS que eu leio inteira. Sem clickbait, sem 'tá disponível também no Spotify'. Só email.`
                : null,
              who: "Henrique Vargas, colaborador desde a edição #003",
            } : {
              text: tier === "collaborator"
                ? `I back this because it's the only thing in my RSS I read end to end. No clickbait, no "also on Spotify." Just email.`
                : null,
              who: "Henrique Vargas, collaborator since issue #003",
            };
            const showColab = tier === "collaborator" && colabQuote.text;
            const quote = showColab ? colabQuote : baseQuote;
            const sectionLabel = showColab
              ? (L === "pt" ? "Quem banca, fala" : "From a collaborator")
              : S.sectionTestimonial;
            return (
              <div>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
                  letterSpacing: "0.2em", textTransform: "uppercase",
                  color: showColab ? "#B89530" : faint,
                  fontWeight: 700, marginBottom: 18,
                }}>
                  {showColab ? "✦" : "✎"} {sectionLabel}
                </div>
                <div style={{ position: "relative", paddingTop: 14, maxWidth: 480 }}>
                  <Tape color={showColab ? "#E8C76A" : tape} style={{ top: 0, left: "30%", transform: "rotate(-4deg)", zIndex: 0 }}/>
                  <Paper tint={paper} pad="32px 30px 26px" rotation={-1.2} y={0} style={{ zIndex: 1 }}>
                    <div style={{ ...hand, fontSize: 64, color: showColab ? "#B89530" : accent, lineHeight: 0.6, marginBottom: 8, transform: "rotate(-4deg)", display: "inline-block" }}>
                      "
                    </div>
                    <p style={{
                      fontFamily: '"Caveat", cursive', fontSize: 26, lineHeight: 1.35,
                      color: ink, margin: "0 0 16px", fontWeight: 500,
                    }}>
                      {quote.text}
                    </p>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                      letterSpacing: "0.12em", color: faint, textTransform: "uppercase",
                    }}>
                      — {quote.who}
                    </div>
                  </Paper>
                </div>
              </div>
            );
          })()}

          {/* Author */}
          <div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
              letterSpacing: "0.2em", textTransform: "uppercase", color: faint, fontWeight: 700, marginBottom: 18,
            }}>
              ◉ {S.sectionAuthor}
            </div>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
              <div style={{
                flexShrink: 0, width: 72, height: 72,
                background: accent, color: "#FFF",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: '"Fraunces", serif', fontSize: 28, fontWeight: 600,
                letterSpacing: "-0.02em", transform: "rotate(-2deg)",
                boxShadow: dark ? "0 8px 18px rgba(0,0,0,0.5)" : "0 6px 14px rgba(70,50,20,0.2)",
              }}>
                {C.author.avatar_initials}
              </div>
              <div>
                <div style={{
                  fontFamily: '"Fraunces", serif', fontSize: 22, fontWeight: 500,
                  letterSpacing: "-0.01em", color: ink, marginBottom: 2,
                }}>
                  {C.author.name}
                </div>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                  letterSpacing: "0.12em", color: faint, textTransform: "uppercase", marginBottom: 12,
                }}>
                  {C.author["role_" + L]}
                </div>
                <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.6, margin: "0 0 14px", maxWidth: 460 }}>
                  {(C.author["bio_" + L] || "").split(".").slice(0, 2).join(".") + "."}
                </p>
                <div style={{ display: "flex", gap: 14, fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>
                  <a href="about.html" style={{ color: accent, textDecoration: "underline", letterSpacing: "0.04em" }}>
                    {L === "pt" ? "mais sobre →" : "more about →"}
                  </a>
                  <a href="now.html" style={{ color: muted, textDecoration: "none", letterSpacing: "0.04em" }}>
                    /now
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — collapsible */}
      <section style={{ maxWidth: 880, margin: "0 auto", padding: "32px 28px 56px" }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
          letterSpacing: "0.2em", textTransform: "uppercase", color: faint, fontWeight: 700, marginBottom: 22,
        }}>
          ? {S.sectionFaq}
        </div>
        <div style={{ borderTop: `1px solid ${line}` }}>
          {S.faqs.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={i} style={{ borderBottom: `1px solid ${line}` }}>
                <button
                  onClick={() => setOpenFaq(open ? -1 : i)}
                  style={{
                    width: "100%", padding: "20px 0",
                    background: "transparent", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
                    textAlign: "left", color: "inherit",
                  }}
                >
                  <span style={{
                    fontFamily: '"Fraunces", serif', fontSize: 20, fontWeight: 500,
                    letterSpacing: "-0.01em", color: ink, lineHeight: 1.3,
                    display: "flex", gap: 10, alignItems: "center",
                  }}>
                    <span style={{ color: open ? accent : faint, fontSize: 18, fontWeight: 700, transition: "color 0.2s", flexShrink: 0, width: 16, display: "inline-block" }}>
                      {open ? "−" : "+"}
                    </span>
                    {f.q}
                  </span>
                </button>
                {open && (
                  <div style={{ paddingBottom: 22, paddingLeft: 26, animation: "fadeIn 0.2s ease-out" }}>
                    <p style={{ fontSize: 15, color: muted, lineHeight: 1.65, margin: 0, maxWidth: 720 }}>
                      {f.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Cross-promo — weighted: 1 hero + 2 small */}
      {recommended && (
        <section style={{
          background: dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)",
          borderTop: `1px dashed ${line}`, padding: "64px 0",
        }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
              <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 32, margin: 0, fontWeight: 500, letterSpacing: "-0.02em", color: ink }}>
                {S.sectionOthers}
              </h2>
              <a href="newsletters.html" style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.14em", color: globalAccent, textDecoration: "underline",
              }}>
                {L === "pt" ? "ver todas com checkbox →" : "see all with checkbox →"}
              </a>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 22, alignItems: "stretch" }}>
              {/* Hero recommended */}
              <CrossCard n={recommended} accent={nlColor(recommended)} dark={dark} theme={theme} L={L} hero pickLabel={S.crossPick} learnMore={S.learnMore}/>
              {moreOthers.map((n, i) => (
                <CrossCard key={n.id} n={n} accent={nlColor(n)} dark={dark} theme={theme} L={L} idx={i} learnMore={S.learnMore}/>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA strip */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px" }}>
        <div style={{
          padding: "44px 36px",
          background: accent, color: "#FFF",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, background: "rgba(255,255,255,0.08)", borderRadius: "50%" }}/>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 36, alignItems: "center", position: "relative", zIndex: 1 }}>
            <div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.2em", textTransform: "uppercase",
                opacity: 0.85, marginBottom: 10, fontWeight: 700,
              }}>
                ↓ {S.finalKicker}
              </div>
              <h2 style={{
                fontFamily: '"Fraunces", serif', fontSize: 36, margin: "0 0 10px",
                fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1,
              }}>
                {L === "pt" ? `Entra pra` : `Get on`} {type["name_" + L]}.
              </h2>
              <p style={{ fontSize: 16, opacity: 0.92, lineHeight: 1.55, margin: "0 0 8px", maxWidth: 480 }}>
                {S.finalSub(type["cadence_" + L])}
              </p>
              {showSubs && (
                <p style={{ fontSize: 13, opacity: 0.78, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.06em", margin: 0 }}>
                  {L === "pt"
                    ? `${subsCount.toLocaleString("pt-BR")} ${S.subscribers} já recebem.`
                    : `${subsCount.toLocaleString("en-US")} ${S.subscribers} already get it.`}
                </p>
              )}
            </div>
            <a href="#top" onClick={(e) => {
              e.preventDefault();
              document.querySelector('#form-hero input[type="email"]')?.focus();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }} style={{
              display: "inline-block", padding: "14px 26px",
              background: "#FFF", color: accent,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
              letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
              textDecoration: "none", justifySelf: "end", whiteSpace: "nowrap",
            }}>
              ↑ {S.backToTopForm}
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: `1px dashed ${line}`, padding: "32px 28px", textAlign: "center",
        color: faint, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.08em",
      }}>
        <div style={{ marginBottom: 10, color: muted, letterSpacing: "0.06em", textTransform: "none" }}>
          {S.footerNote}
        </div>
        <div style={{ marginBottom: 18, fontSize: 11, opacity: 0.8 }}>
          {S.footerSub}
        </div>
        <a href="Pinboard.html" style={{ color: globalAccent, textDecoration: "none" }}>
          ← {L === "pt" ? "voltar pra home" : "back to home"}
        </a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="newsletters.html" style={{ color: muted, textDecoration: "none" }}>
          {L === "pt" ? "todas as newsletters" : "all newsletters"}
        </a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="blog.html" style={{ color: muted, textDecoration: "none" }}>blog</a>
      </footer>

      {/* Mobile sticky CTA — visible only on small screens, only when form not in viewport */}
      <MobileStickyCTA accent={accent} S={S} phase={phase}/>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ---------- Helper components ----------

const Stat = ({ label, value, dark, muted, faint, ink, accent, divider }) => (
  <div style={{
    padding: "14px 18px",
    borderLeft: divider ? `1px dashed ${dark ? "#2E2718" : "#CEBFA0"}` : "none",
  }}>
    <div style={{
      fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
      letterSpacing: "0.16em", textTransform: "uppercase", color: faint,
      marginBottom: 4,
    }}>
      {label}
    </div>
    <div style={{
      fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 500,
      color: accent || ink, letterSpacing: "-0.01em", lineHeight: 1.2,
    }}>
      {value}
    </div>
  </div>
);

const Step = ({ done, active, pending, label, dark, accent, faint, muted, ink, last }) => {
  const bullet = done ? "✓" : active ? "●" : "○";
  const color = done ? accent : active ? ink : faint;
  const opacity = pending ? 0.5 : 1;
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "center",
      padding: "8px 0",
      opacity,
      borderTop: last ? "none" : `1px dashed ${dark ? "#2E2718" : "#CEBFA0"}`,
    }}>
      <div style={{
        flexShrink: 0, width: 22, height: 22,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: done ? accent : "transparent",
        color: done ? "#FFF" : color,
        border: done ? "none" : `1.5px solid ${color}`,
        fontSize: done ? 11 : 9, fontWeight: 700,
        animation: active ? "pulse 1.6s ease-in-out infinite" : "none",
      }}>
        {bullet}
      </div>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
        letterSpacing: "0.1em", color, textTransform: "uppercase",
        fontWeight: active || done ? 700 : 400,
      }}>
        {label}
      </div>
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>
    </div>
  );
};

const CrossCard = ({ n, accent, dark, theme, L, hero, idx = 0, pickLabel, learnMore }) => {
  const { paper, paper2, ink, muted, line, rot, lift } = theme;
  return (
    <a href={`?slug=${n["slug_" + L]}`} style={{
      display: "block", textDecoration: "none", color: "inherit",
      position: "relative", paddingTop: 14,
    }}>
      {hero && (
        <div style={{
          position: "absolute", top: -2, left: 14,
          padding: "4px 10px", background: accent, color: "#FFF",
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
          letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
          transform: "rotate(-2deg)", zIndex: 2,
        }}>
          ★ {pickLabel}
        </div>
      )}
      <div style={{
        background: hero ? paper : (idx % 2 === 0 ? paper : paper2),
        position: "relative",
        transform: `rotate(${rot(idx + 9)}deg) translateY(${lift(idx + 9)}px)`,
        boxShadow: dark
          ? "0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)"
          : "0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)",
        height: "100%",
      }}>
        <div style={{ height: hero ? 8 : 5, background: accent }}/>
        <div style={{ padding: hero ? "26px 26px 24px" : "18px 20px 20px" }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
            letterSpacing: "0.16em", textTransform: "uppercase", color: accent,
            fontWeight: 700, marginBottom: 8,
          }}>
            {n["cadence_" + L]}
          </div>
          <h3 style={{
            fontFamily: '"Fraunces", serif',
            fontSize: hero ? 32 : 22, margin: "0 0 8px",
            fontWeight: 500, letterSpacing: "-0.015em", color: ink, lineHeight: 1.1,
          }}>
            {n["name_" + L]}
          </h3>
          <p style={{
            fontSize: hero ? 15 : 13.5, color: muted, lineHeight: 1.5,
            margin: "0 0 14px",
          }}>
            {n["tagline_" + L]}
          </p>
          {hero && n.subs_count >= 100 && (
            <p style={{
              fontSize: 12, color: muted, lineHeight: 1.4, margin: "0 0 14px",
              fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.06em",
            }}>
              ◉ {n.subs_count >= 1000 ? `${(n.subs_count / 1000).toFixed(1)}k` : n.subs_count} {L === "pt" ? "inscritos" : "subscribers"}
              {n.issues_count >= 1 && <span> · ▦ {n.issues_count} {L === "pt" ? "edições" : "issues"}</span>}
            </p>
          )}
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            letterSpacing: "0.12em", color: accent, fontWeight: 600,
          }}>
            {learnMore} →
          </div>
        </div>
      </div>
    </a>
  );
};

const MobileStickyCTA = ({ accent, S, phase }) => {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => {
      const formEl = document.getElementById("form-hero");
      if (!formEl) { setShow(false); return; }
      const rect = formEl.getBoundingClientRect();
      // show when form is mostly out of view (scrolled past) OR very far down
      const offscreen = rect.bottom < 80 || rect.top > window.innerHeight + 100;
      setShow(offscreen && phase === "idle");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase]);

  if (phase !== "idle") return null;

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
      padding: 12,
      background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 100%)",
      transform: show ? "translateY(0)" : "translateY(120%)",
      transition: "transform 0.32s cubic-bezier(.2,.8,.2,1)",
      pointerEvents: show ? "auto" : "none",
      display: "none",
    }} className="mobile-sticky">
      <a href="#top" onClick={(e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => document.querySelector('#form-hero input[type="email"]')?.focus(), 600);
      }} style={{
        display: "block", textAlign: "center",
        padding: "16px 20px",
        background: accent, color: "#FFF",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
        letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
        textDecoration: "none",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}>
        ✉ {S.backToTopForm} ↑
      </a>
      <style>{`
        @media (max-width: 760px) { .mobile-sticky { display: block !important; } }
      `}</style>
    </div>
  );
};

window.NewsletterLanding = NewsletterLanding;

// ---------- IssueCard — tier-aware ----------
const IssueCard = ({ s, i, isLocked, tier, L, S, theme, kit, accent, dark, nlId }) => {
  const { Paper, Tape } = kit;
  const { paper, paper2, ink, muted, faint, line, tape, tape2, rot, lift } = theme;

  // OPEN — collaborator OR i===0 (always-free hero sample)
  if (!isLocked) {
    const isHeroFree = i === 0 && tier !== "collaborator";
    const isColabOpen = tier === "collaborator";
    return (
      <div className="v3-fade" style={{ position: "relative", paddingTop: 18 }}>
        <Tape
          color={i % 2 ? tape2 : tape}
          style={{ top: 8, [i % 2 ? "left" : "right"]: "26%", transform: `rotate(${(i * 9) % 14 - 7}deg)`, zIndex: 0 }}
        />
        <Paper
          tint={i % 2 === 1 ? paper2 : paper}
          pad="0"
          rotation={rot(i + 5)}
          y={lift(i + 5)}
          style={{
            zIndex: 1, position: "relative",
            outline: isHeroFree ? `2px solid ${accent}` : "none",
            outlineOffset: isHeroFree ? 3 : 0,
          }}
        >
          {isHeroFree && (
            <div style={{
              position: "absolute", top: -12, left: 12, zIndex: 5,
              padding: "4px 10px", background: accent, color: "#FFF",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
              letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700,
              transform: "rotate(-3deg)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            }}>
              ✦ {L === "pt" ? "amostra grátis" : "free sample"}
            </div>
          )}
          {isColabOpen && (
            <div style={{
              position: "absolute", top: -10, right: 10, zIndex: 5,
              padding: "4px 9px", background: "#B89530", color: "#FFF",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
              letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
              transform: "rotate(3deg)",
              boxShadow: "0 4px 10px rgba(184,149,48,0.3)",
            }}>
              ✦ {L === "pt" ? "aberto" : "open"}
            </div>
          )}
          <div style={{
            padding: "14px 18px",
            borderBottom: `1px dashed ${line}`,
            background: dark ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.03)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: "0.12em", color: faint,
          }}>
            <span>✉ #{String(s.num).padStart(3, "0")}</span>
            <span>{s.date}</span>
          </div>
          <div style={{ padding: "20px 22px 22px" }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
              letterSpacing: "0.16em", textTransform: "uppercase", color: accent,
              marginBottom: 8, fontWeight: 700,
            }}>
              {S.sampleSubject}
            </div>
            <h3 style={{
              fontFamily: '"Fraunces", serif', fontSize: 19, margin: "0 0 12px",
              fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.3, color: ink,
            }}>
              {s.subject}
            </h3>
            {s.preview && (
              <p style={{
                fontSize: 13.5, color: muted, lineHeight: 1.55, margin: "0 0 14px",
                display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {s.preview}
              </p>
            )}
            <div style={{
              paddingTop: 10, borderTop: `1px dashed ${line}`,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
              color: isColabOpen ? "#B89530" : accent, letterSpacing: "0.06em",
              fontWeight: 600,
            }}>
              {isColabOpen ? "✦ " : "▸ "}{L === "pt" ? "ler edição completa" : "read full issue"} →
            </div>
          </div>
        </Paper>
      </div>
    );
  }

  // LOCKED — wax-sealed envelope. Bigger seal, more presence.
  const teaser = s.preview ? s.preview.split(/[.!?]/)[0].trim() + "…" : "";
  // Vary seal "intactness" for visual rhythm
  const sealRotate = ((i * 7) % 12) - 6;

  return (
    <div className="v3-fade" style={{ position: "relative", paddingTop: 18 }}>
      <Tape
        color={i % 2 ? tape2 : tape}
        style={{ top: 8, [i % 2 ? "left" : "right"]: "26%", transform: `rotate(${(i * 9) % 14 - 7}deg)`, zIndex: 0, opacity: 0.5 }}
      />
      <Paper
        tint={dark ? "#1A1710" : "#DDD0B0"}
        pad="0"
        rotation={rot(i + 5)}
        y={lift(i + 5)}
        style={{
          zIndex: 1, position: "relative",
          filter: dark ? "saturate(0.85)" : "saturate(0.9)",
        }}
      >
        {/* "PASSADA" stamp — top corner, more prominent */}
        <div style={{
          position: "absolute", top: -12, right: 6, zIndex: 6,
          padding: "5px 10px",
          border: `1.8px solid ${dark ? "#8B7C5F" : "#7A6A4D"}`,
          color: dark ? "#A89876" : "#5B4E33",
          background: dark ? "#14110B" : "#E9E1CE",
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
          letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700,
          transform: "rotate(7deg)",
          boxShadow: "0 3px 8px rgba(0,0,0,0.25)",
        }}>
          🔒 {L === "pt" ? "lacrada" : "sealed"}
        </div>

        {/* envelope header — dimmer */}
        <div style={{
          padding: "14px 18px",
          borderBottom: `1px dashed ${line}`,
          background: dark ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.07)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          letterSpacing: "0.12em", color: faint, opacity: 0.85,
        }}>
          <span>✉ #{String(s.num).padStart(3, "0")}</span>
          <span>{s.date}</span>
        </div>

        {/* body — subject, teaser, then BIG WAX SEAL */}
        <div style={{ padding: "20px 22px 26px", position: "relative" }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
            letterSpacing: "0.16em", textTransform: "uppercase", color: accent,
            marginBottom: 8, fontWeight: 700, opacity: 0.85,
          }}>
            {S.sampleSubject}
          </div>
          <h3 style={{
            fontFamily: '"Fraunces", serif', fontSize: 19, margin: "0 0 12px",
            fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.3, color: ink,
            opacity: 0.95,
          }}>
            {s.subject}
          </h3>

          {teaser && (
            <p style={{
              fontSize: 13, color: muted, lineHeight: 1.5, margin: "0 0 22px",
              fontStyle: "italic",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {teaser}
            </p>
          )}

          {/* BIG WAX SEAL — center stage, newsletter-specific glyph */}
          <div style={{
            position: "relative", margin: "8px auto 16px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          }}>
            <div
              role="img"
              aria-label={L === "pt" ? `Selo de cera lacrando edição ${String(s.num).padStart(3, "0")}` : `Wax seal closing issue ${String(s.num).padStart(3, "0")}`}
              style={{
              width: 88, height: 88, borderRadius: "50%",
              background: `radial-gradient(circle at 32% 28%, #E27460 0%, #C14513 35%, #8B2A0F 75%, #5A1808 100%)`,
              boxShadow: dark
                ? "0 8px 22px rgba(0,0,0,0.7), inset 0 -5px 10px rgba(0,0,0,0.5), inset 0 4px 6px rgba(255,255,255,0.22)"
                : "0 8px 16px rgba(70,20,10,0.45), inset 0 -5px 10px rgba(0,0,0,0.5), inset 0 4px 6px rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#3A0F08",
              fontFamily: nlId === "code" ? '"JetBrains Mono", monospace' : '"Fraunces", serif',
              fontSize: nlId === "code" ? 22 : nlId === "trips" ? 36 : nlId === "growth" ? 32 : 30,
              fontWeight: 700,
              letterSpacing: "-0.04em", textTransform: "uppercase",
              animation: "sealWobble 5s ease-in-out infinite",
              animationDelay: `${i * 0.4}s`,
              border: "2px solid rgba(58,15,8,0.5)",
              position: "relative",
              transform: `rotate(${sealRotate}deg)`,
            }}>
              <span aria-hidden="true" style={{
                opacity: 0.9, textShadow: "0 1px 0 rgba(255,255,255,0.15)",
                transform: nlId === "trips" ? "translateY(-1px)" : "translateY(1px)",
              }}>
                {nlId === "code" ? "</>"
                  : nlId === "trips" ? "♪"
                  : nlId === "growth" ? "↗"
                  : "tf"}
              </span>
              {/* dot pattern + a star at top */}
              <svg aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 88 88">
                {Array.from({ length: 18 }).map((_, k) => {
                  const a = (k / 18) * Math.PI * 2;
                  const cx = 44 + Math.cos(a) * 36;
                  const cy = 44 + Math.sin(a) * 36;
                  return <circle key={k} cx={cx} cy={cy} r="1.2" fill="rgba(58,15,8,0.55)"/>;
                })}
                {/* tiny shine */}
                <ellipse cx="32" cy="26" rx="9" ry="5" fill="rgba(255,255,255,0.18)"/>
              </svg>
            </div>
            <div style={{
              fontFamily: '"Caveat", cursive', fontSize: 22, fontWeight: 600,
              color: ink, transform: "rotate(-2deg)", lineHeight: 1.1, textAlign: "center",
              opacity: 0.9,
            }}>
              {S.lockedTitle}
            </div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: "0.1em", color: faint, textAlign: "center",
              maxWidth: 220, lineHeight: 1.45,
            }}>
              {S.lockedSubtitle}
            </div>
          </div>

          {/* footer — open with collab */}
          <div style={{
            paddingTop: 14, marginTop: 4,
            borderTop: `1px dashed ${line}`,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
            letterSpacing: "0.06em",
          }}>
            <span style={{ color: faint }}>{S.lockedFor}</span>
            <a href="#upgrade" onClick={(e) => {
              e.preventDefault();
              document.getElementById("upgrade")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }} style={{
              color: "#D9A841", textDecoration: "underline", letterSpacing: "0.1em",
              fontWeight: 700,
            }}>
              ✦ {S.lockedColabPerk}
            </a>
          </div>
        </div>
      </Paper>
    </div>
  );
};
window.IssueCard = IssueCard;

// ---------- UpgradeOption ----------
const UpgradeOption = ({ title, sub, bullet, cta, primary, muted: isMuted, theme, dark, L }) => {
  const { ink, muted, faint, line } = theme;
  const goldDark = "#B89530";
  return (
    <div style={{
      padding: "22px 22px 20px",
      background: primary
        ? (dark ? "rgba(184,149,48,0.10)" : "rgba(184,149,48,0.10)")
        : (dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)"),
      border: primary ? `2px solid ${goldDark}` : `1px solid ${line}`,
      position: "relative",
      opacity: isMuted ? 0.85 : 1,
      display: "flex", flexDirection: "column",
    }}>
      {primary && (
        <div style={{
          position: "absolute", top: -10, right: 14,
          padding: "3px 8px", background: goldDark, color: "#FFF",
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
          letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
          zIndex: 2,
          boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
        }}>
          ✦ {L === "pt" ? "principal" : "primary"}
        </div>
      )}
      <h3 style={{
        fontFamily: '"Fraunces", serif', fontSize: 24, margin: "0 0 4px",
        fontWeight: 500, letterSpacing: "-0.01em", color: ink,
      }}>
        {title}
      </h3>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
        letterSpacing: "0.1em", color: muted, marginBottom: 14, textTransform: "lowercase",
      }}>
        {sub}
      </div>
      <div style={{
        fontSize: 13, color: muted, lineHeight: 1.5, marginBottom: 18,
        flex: 1,
      }}>
        ✓ {bullet}
      </div>
      {cta && (
        <a href="#" style={{
          display: "inline-block",
          padding: "10px 14px",
          background: primary ? goldDark : "transparent",
          color: primary ? "#FFF" : goldDark,
          border: primary ? "none" : `1.5px solid ${goldDark}`,
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
          textDecoration: "none", textAlign: "center",
        }}>
          {cta}
        </a>
      )}
      {!cta && (
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          letterSpacing: "0.1em", color: faint, fontStyle: "italic",
        }}>
          ↳ {L === "pt" ? "espera ser indicado" : "wait to be invited"}
        </div>
      )}
    </div>
  );
};
window.UpgradeOption = UpgradeOption;
