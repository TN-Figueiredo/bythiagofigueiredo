/*
 * Case study — single-page tour of the bythiagofigueiredo project.
 * Sections: manifesto · brand explorations · pages · ads · handoff.
 * Uses pinboard primitives (Paper, Tape) but in a tour layout.
 */

const CaseStudy = ({ dark, L }) => {
  // --- palette (mirrors pinboard.jsx) ---
  const bg     = dark ? "#14110B" : "#E9E1CE";
  const paper  = dark ? "#2A241A" : "#FBF6E8";
  const paper2 = dark ? "#312A1E" : "#F5EDD6";
  const ink    = dark ? "#EFE6D2" : "#161208";
  const muted  = dark ? "#958A75" : "#6A5F48";
  const faint  = dark ? "#6B634F" : "#9C9178";
  const line   = dark ? "#2E2718" : "#CEBFA0";
  const accent = dark ? "#FF8240" : "#C14513";
  const yt     = "#FF3333";
  const marker = "#FFE37A";
  const tape   = dark ? "rgba(255, 226, 140, 0.42)" : "rgba(255, 226, 140, 0.75)";
  const tape2  = dark ? "rgba(209, 224, 255, 0.36)" : "rgba(200, 220, 255, 0.7)";
  const tapeR  = dark ? "rgba(255, 120, 120, 0.40)" : "rgba(255, 150, 150, 0.7)";

  const hand   = { fontFamily: '"Caveat", cursive', color: accent };
  const mono   = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' };
  const serif  = { fontFamily: '"Fraunces", serif' };

  const Tape = ({ color = tape, style = {} }) => (
    <div style={{
      position: "absolute", width: 80, height: 18, background: color,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)", ...style,
    }}/>
  );

  const Paper = ({ children, tint = paper, pad = "20px", rotation = 0, y = 0, style = {} }) => (
    <div style={{
      background: tint, padding: pad, position: "relative",
      transform: `rotate(${rotation}deg) translateY(${y}px)`,
      boxShadow: dark
        ? "0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)"
        : "0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)",
      ...style,
    }}>{children}</div>
  );

  // -- copy (PT/EN bilingual) --
  const tx = {
    pt: {
      eyebrow: "ESTUDO DE CASO · 2026",
      heroTitle: "bythiagofigueiredo",
      heroSub: "marca pessoal + blog + canal — um sistema só, construído à mão.",
      manifesto: "Este projeto é um experimento de marca pessoal honesta para um desenvolvedor brasileiro que escreve, faz vídeos no YouTube e constrói pequenos produtos. O briefing era simples: nada de vibes corporativas, nada de templates. Quero algo que pareça meu — papel, fita-crepe, JetBrains Mono e Fraunces — mas que funcione como produto: leitura confortável, monetização discreta, e um sistema de marca que sobrevive a um redesign.",
      manifestoFootnote: "feito em ~6 turnos com Claude · abr/mai 2026",
      jumpTo: "Ir para",
      sectionBrand: "Explorações de marca",
      sectionBrandKicker: "§ 01 · IDENTIDADE",
      sectionBrandIntro: "Cinco arquiteturas conceituais distintas, exploradas em paralelo. Cada uma resolve o problema de \"quem assina\" de um jeito diferente. A direção final (\"Marginalia\") combina o asterisco de seis pétalas com o tipo Fraunces, mas as cinco famílias permanecem documentadas como sistema.",
      sectionPages: "As seis páginas",
      sectionPagesKicker: "§ 02 · PRODUTO",
      sectionPagesIntro: "Cada página é um protótipo navegável, com tweaks ao vivo (tema, idioma, ads) e PT/EN simétrico. Os textos são reais, os autores são fictícios, mas o sistema é o que entrega ao desenvolvedor.",
      sectionAds: "Sistema de anúncios",
      sectionAdsKicker: "§ 03 · MONETIZAÇÃO",
      sectionAdsIntro: "Sete formatos de slot (Marginalia, Anchor, Bookmark, Coda, Doorman, Bowtie, Sidekick), três patrocinadores mock e três house ads. Cada slot tem regras: dismissable, frequency caps, persistência em localStorage. Tudo togglável pelos tweaks.",
      sectionHandoff: "Handoff",
      sectionHandoffKicker: "§ 04 · DEV",
      sectionHandoffIntro: "Um brief de 371 linhas para o time de engenharia, mais o brand guide de 252 linhas. Os SVGs estão exportados em /brand. O CSS é inline (transferível direto pra Tailwind ou CSS Modules), e as chaves de localStorage estão documentadas.",
      readDoc: "Ler documento",
      openPage: "Abrir página",
      stats: { brands: "explorações de marca", pages: "páginas funcionais", logos: "logos JSX explorados", ads: "slots de anúncio", langs: "idiomas (PT + EN)", themes: "temas (light + dark)" },
      footer: "feito à mão em BH, 2026",
    },
    en: {
      eyebrow: "CASE STUDY · 2026",
      heroTitle: "bythiagofigueiredo",
      heroSub: "personal brand + blog + YouTube channel — a single system, hand-built.",
      manifesto: "This project is an experiment in honest personal branding for a Brazilian developer who writes, makes YouTube videos, and ships small products. The brief was simple: no corporate vibes, no templates. Make something that feels like mine — paper, masking tape, JetBrains Mono and Fraunces — but works as a product: comfortable reading, quiet monetization, and a brand system that survives a redesign.",
      manifestoFootnote: "made in ~6 sessions with Claude · Apr–May 2026",
      jumpTo: "Jump to",
      sectionBrand: "Brand explorations",
      sectionBrandKicker: "§ 01 · IDENTITY",
      sectionBrandIntro: "Five distinct conceptual architectures, explored in parallel. Each one solves the \"who signs this\" problem differently. The final direction (\"Marginalia\") combines the six-petal asterisk with Fraunces type, but the other four families remain documented as a system.",
      sectionPages: "The six pages",
      sectionPagesKicker: "§ 02 · PRODUCT",
      sectionPagesIntro: "Each page is a navigable prototype with live tweaks (theme, language, ads) and symmetric PT/EN. The copy is real, the authors are fictional, but the system is what ships to the dev.",
      sectionAds: "Ad system",
      sectionAdsKicker: "§ 03 · MONETIZATION",
      sectionAdsIntro: "Seven slot formats (Marginalia, Anchor, Bookmark, Coda, Doorman, Bowtie, Sidekick), three mock sponsors and three house ads. Each slot has rules: dismissable, frequency caps, localStorage persistence. All toggleable from the Tweaks panel.",
      sectionHandoff: "Handoff",
      sectionHandoffKicker: "§ 04 · DEV",
      sectionHandoffIntro: "A 371-line brief for the engineering team, plus the 252-line brand guide. SVGs are exported in /brand. CSS is inline (portable to Tailwind or CSS Modules), and localStorage keys are documented.",
      readDoc: "Read document",
      openPage: "Open page",
      stats: { brands: "brand explorations", pages: "functional pages", logos: "JSX logos explored", ads: "ad slots", langs: "languages (PT + EN)", themes: "themes (light + dark)" },
      footer: "handmade in Brazil, 2026",
    },
  };
  const t = tx[L];

  // --- Brand explorations ---
  const brandExplorations = [
    {
      n: "01", title: "T isolado",
      pt: "Letra T como objeto editorial: capitular, ornamento, marco de seção.",
      en: "The letter T as editorial object: drop-cap, ornament, section marker.",
      tint: "#FF8240",
    },
    {
      n: "02", title: "Sobrenome",
      pt: "\"Figueiredo\" inteiro como assinatura — comprido, manuscrito, declarativo.",
      en: "\"Figueiredo\" as full signature — long, handwritten, declarative.",
      tint: "#1E4D7A",
    },
    {
      n: "03", title: "Carimbo",
      pt: "Selo circular editorial com TF central — funciona como avatar e watermark.",
      en: "Editorial circular stamp with central TF — works as avatar and watermark.",
      tint: "#2F6B22",
    },
    {
      n: "04", title: "Fleuron editorial",
      pt: "Glifo ❦ inline antes do nome — invocação tipográfica de século XIX.",
      en: "Inline ❦ glyph before the name — 19th-century typographic invocation.",
      tint: "#8A4A8F",
    },
    {
      n: "05", title: "Brasão tipográfico",
      pt: "Composição modular com regra horizontal, like Penguin Classics meets typewriter.",
      en: "Modular composition with horizontal rule — Penguin Classics meets typewriter.",
      tint: "#D65B1F",
    },
  ];

  // --- Pages ---
  const pages = [
    { id: "home", file: "Pinboard.html", icon: "▤",
      pt_title: "Home (Pinboard)", en_title: "Home (Pinboard)",
      pt: "Hub principal: dois heros (post + vídeo), feed unificado, canais YouTube, mais lidos, newsletter.",
      en: "Main hub: dual hero (post + video), unified feed, YouTube channels, most-read, newsletter." },
    { id: "blog", file: "blog.html", icon: "✎",
      pt_title: "Blog", en_title: "Blog",
      pt: "Arquivo completo com filtros por categoria, busca, paginação e séries.",
      en: "Full archive with category filters, search, pagination and series." },
    { id: "post", file: "post.html?slug=manifesto-bythiagofigueiredo", icon: "§",
      pt_title: "Post", en_title: "Post",
      pt: "Layout de leitura 3-colunas: TOC, corpo (max 720px Fraunces), key points + ads.",
      en: "3-column reading layout: TOC, body (max 720px Fraunces), key points + ads." },
    { id: "videos", file: "videos.html", icon: "▶",
      pt_title: "Vídeos", en_title: "Videos",
      pt: "Wall de polaroids com séries, filtros por canal (PT/EN) e player inline.",
      en: "Polaroid wall with series, per-channel filter (PT/EN) and inline player." },
    { id: "newsletters", file: "newsletters.html", icon: "✉",
      pt_title: "Newsletters", en_title: "Newsletters",
      pt: "Página dedicada às 4 newsletters — checkboxes para inscrever em uma ou todas.",
      en: "Dedicated page for the 4 newsletters — checkboxes to subscribe to one or all." },
    { id: "brand", file: "Brand.html", icon: "❦",
      pt_title: "Brand", en_title: "Brand",
      pt: "Mini design system: paleta, tipografia, marca, regras de uso.",
      en: "Mini design system: palette, typography, marks, usage rules." },
  ];

  // --- Ad slots ---
  const adSlots = [
    { name: "Marginalia", pt: "nota lateral discreta no rail",   en: "discreet sidebar note" },
    { name: "Anchor",     pt: "card horizontal full-width",       en: "full-width horizontal card" },
    { name: "Bookmark",   pt: "tira inline entre seções",         en: "inline strip between sections" },
    { name: "Coda",       pt: "card no fim do artigo",            en: "card at the end of an article" },
    { name: "Doorman",    pt: "banner dismissable no topo",       en: "dismissable top banner" },
    { name: "Bowtie",     pt: "card de newsletter sticky",        en: "sticky newsletter card" },
    { name: "Sidekick",   pt: "anúncio sticky no rail",           en: "sticky rail ad" },
  ];

  // --- Stats ---
  const statValues = [
    { v: "5",  k: t.stats.brands },
    { v: "9",  k: t.stats.pages },     // 6 main + about + now + 404
    { v: "8",  k: t.stats.logos },
    { v: "7",  k: t.stats.ads },
    { v: "2",  k: t.stats.langs },
    { v: "2",  k: t.stats.themes },
  ];

  // small helper for offsetting paper rotations deterministically
  const rot = (i) => ((i * 37) % 7 - 3) * 0.5;

  // ----- render -----

  return (
    <div style={{
      background: bg, color: ink, minHeight: "100vh",
      fontFamily: '"Inter", system-ui, sans-serif',
      backgroundImage: dark
        ? "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.015), transparent 40%), radial-gradient(circle at 85% 70%, rgba(255,255,255,0.015), transparent 40%)"
        : "radial-gradient(circle at 15% 20%, rgba(166,130,80,0.06), transparent 40%), radial-gradient(circle at 85% 70%, rgba(166,130,80,0.06), transparent 40%)",
    }}>

      {/* HERO */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 28px 40px" }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.22em", color: accent, marginBottom: 22 }}>
          {t.eyebrow}
        </div>
        <h1 style={{
          ...serif, fontSize: "clamp(48px, 7vw, 96px)",
          lineHeight: 0.96, letterSpacing: "-0.035em",
          margin: 0, fontWeight: 500,
        }}>
          <span style={{ position: "relative" }}>
            by
            <span style={{
              position: "absolute", bottom: 6, left: -2, right: -2, height: "0.32em",
              background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
            }}/>
          </span>
          <span style={{ fontStyle: "italic" }}>thiago</span>
          <br/>
          <span>figueiredo</span>
        </h1>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 28, flexWrap: "wrap" }}>
          <p style={{
            ...serif, fontStyle: "italic", fontSize: "clamp(18px, 1.8vw, 24px)",
            color: muted, margin: 0, maxWidth: 640, lineHeight: 1.45,
          }}>
            {t.heroSub}
          </p>
          <span style={{ ...hand, fontSize: 26, transform: "rotate(-2deg)", display: "inline-block" }}>
            ↓ {L === "pt" ? "tour completo abaixo" : "full tour below"}
          </span>
        </div>

        {/* Manifesto card */}
        <div style={{ marginTop: 56, position: "relative", paddingTop: 14, maxWidth: 920 }}>
          <Paper tint={paper} pad="34px 36px 30px" rotation={-0.3}>
            <Tape color={tape} style={{ top: -9, left: "10%", transform: "rotate(-3deg)" }}/>
            <Tape color={tape2} style={{ top: -9, right: "12%", transform: "rotate(3deg)" }}/>
            <p style={{
              ...serif, fontSize: 19, lineHeight: 1.55, margin: 0,
              fontWeight: 400, letterSpacing: "-0.005em",
              textWrap: "pretty",
            }}>
              {t.manifesto}
            </p>
            <div style={{ ...hand, fontSize: 20, marginTop: 18, color: accent, transform: "rotate(-1deg)", display: "inline-block" }}>
              {t.manifestoFootnote}
            </div>
          </Paper>
        </div>

        {/* Stats strip */}
        <div style={{
          marginTop: 64, padding: "22px 0",
          borderTop: `1px dashed ${line}`, borderBottom: `1px dashed ${line}`,
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 24,
        }} className="stats-grid">
          {statValues.map((s, i) => (
            <div key={i}>
              <div style={{ ...serif, fontSize: "clamp(36px, 4vw, 56px)", lineHeight: 1, fontWeight: 500, color: accent, letterSpacing: "-0.04em" }}>
                {s.v}
              </div>
              <div style={{ ...mono, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginTop: 6, lineHeight: 1.35 }}>
                {s.k}
              </div>
            </div>
          ))}
        </div>

        {/* Jump nav */}
        <nav style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <span style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: faint }}>
            {t.jumpTo} →
          </span>
          {[
            { id: "brand",   label: t.sectionBrand },
            { id: "pages",   label: t.sectionPages },
            { id: "ads",     label: t.sectionAds },
            { id: "handoff", label: t.sectionHandoff },
          ].map(j => (
            <a key={j.id} href={`#${j.id}`} style={{
              ...mono, fontSize: 12, letterSpacing: "0.06em",
              color: ink, textDecoration: "none",
              borderBottom: `1.5px solid ${accent}`, paddingBottom: 2,
            }}>
              {j.label}
            </a>
          ))}
        </nav>
      </section>

      {/* BRAND EXPLORATIONS */}
      <section id="brand" style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 28px 32px", scrollMarginTop: 60 }}>
        <SectionHead
          kicker={t.sectionBrandKicker}
          title={t.sectionBrand}
          intro={t.sectionBrandIntro}
          accent={accent} marker={marker} muted={muted} mono={mono} serif={serif}
        />

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 22,
          marginTop: 48,
        }} className="brand-grid">
          {brandExplorations.map((b, i) => (
            <div key={b.n} style={{ position: "relative", paddingTop: 14 }}>
              <Paper tint={i % 2 ? paper2 : paper} pad="0" rotation={rot(i)}>
                <Tape
                  color={i % 2 ? tape2 : tape}
                  style={{ top: -9, left: "30%", transform: `rotate(${(i * 11) % 10 - 5}deg)` }}
                />
                {/* Badge w/ index + visual mark zone */}
                <div style={{
                  aspectRatio: "1 / 1.1", background: dark ? "#1E1812" : "#FFF7E8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", overflow: "hidden",
                }}>
                  <BrandMarkPreview kind={b.n} tint={b.tint} dark={dark} ink={ink} accent={accent}/>
                  <div style={{
                    position: "absolute", top: 10, left: 10,
                    ...mono, fontSize: 10, letterSpacing: "0.16em",
                    color: faint,
                  }}>{b.n}</div>
                </div>
                <div style={{ padding: "18px 18px 20px", borderTop: `1px dashed ${line}` }}>
                  <h3 style={{ ...serif, fontSize: 19, fontWeight: 500, margin: 0, letterSpacing: "-0.01em" }}>
                    {b.title}
                  </h3>
                  <p style={{ fontSize: 13, color: muted, lineHeight: 1.5, marginTop: 6, marginBottom: 0 }}>
                    {b[L]}
                  </p>
                </div>
              </Paper>
            </div>
          ))}
        </div>

        {/* Link to deep brand explorations */}
        <div style={{ marginTop: 36, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <DocLink href="brand-explore.html" label={L === "pt" ? "Exploração v1–v3 (8 logos)" : "Exploration v1–v3 (8 logos)"} accent={accent} mono={mono} ink={ink} line={line}/>
          <DocLink href="Carimbo + Fleuron · v6 · brand law.html" label={L === "pt" ? "Brand law · v6 (carimbo + fleuron)" : "Brand law · v6 (stamp + fleuron)"} accent={accent} mono={mono} ink={ink} line={line}/>
          <DocLink href="Brand.html" label={L === "pt" ? "Mini design system →" : "Mini design system →"} accent={accent} mono={mono} ink={ink} line={line}/>
          <DocLink href="Logos.html" label={L === "pt" ? "Os 8 logos lado a lado" : "All 8 logos side-by-side"} accent={accent} mono={mono} ink={ink} line={line}/>
        </div>
      </section>

      {/* PAGES */}
      <section id="pages" style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 28px 32px", scrollMarginTop: 60 }}>
        <SectionHead
          kicker={t.sectionPagesKicker}
          title={t.sectionPages}
          intro={t.sectionPagesIntro}
          accent={accent} marker={marker} muted={muted} mono={mono} serif={serif}
        />

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, rowGap: 44,
          marginTop: 48,
        }} className="pages-grid">
          {pages.map((p, i) => (
            <div key={p.id} style={{ position: "relative", paddingTop: 16 }}>
              <Paper tint={paper} pad="0" rotation={rot(i + 3)}>
                <Tape color={i % 2 ? tape2 : tape} style={{ top: -9, [i % 2 ? "right" : "left"]: "20%", transform: `rotate(${(i * 13) % 10 - 5}deg)` }}/>
                <a href={p.file} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  {/* Visual screen preview area */}
                  <div style={{
                    aspectRatio: "16/10",
                    background: i % 2 === 0
                      ? `linear-gradient(135deg, ${dark ? "#231C13" : "#FFF7E0"}, ${dark ? "#1A150F" : "#F0E5C8"})`
                      : `linear-gradient(135deg, ${dark ? "#1F1A14" : "#FFFAEB"}, ${dark ? "#15110C" : "#EFE2BE"})`,
                    position: "relative", overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {/* Faux page chrome */}
                    <div style={{ position: "absolute", inset: 0, padding: 14 }}>
                      <div style={{ height: 8, background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", marginBottom: 10, width: "70%" }}/>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{ height: 50, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}/>
                        <div style={{ height: 50, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}/>
                      </div>
                      <div style={{ height: 6, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginTop: 10, width: "90%" }}/>
                      <div style={{ height: 6, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginTop: 6, width: "60%" }}/>
                    </div>
                    {/* Big icon mark */}
                    <div style={{
                      ...serif, fontSize: 92, color: accent, opacity: 0.85,
                      lineHeight: 1, textShadow: dark ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 12px rgba(255,255,255,0.5)",
                      position: "relative",
                    }}>
                      {p.icon}
                    </div>
                  </div>
                  {/* Caption */}
                  <div style={{ padding: "18px 20px 22px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                      <h3 style={{ ...serif, fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.015em" }}>
                        {p[L + "_title"]}
                      </h3>
                      <span style={{ ...mono, fontSize: 10, letterSpacing: "0.1em", color: faint }}>
                        {p.file.split("?")[0]}
                      </span>
                    </div>
                    <p style={{ fontSize: 13.5, color: muted, lineHeight: 1.55, margin: "6px 0 12px" }}>
                      {p[L]}
                    </p>
                    <div style={{ ...hand, fontSize: 18, color: accent, transform: "rotate(-1deg)", display: "inline-block" }}>
                      {t.openPage} →
                    </div>
                  </div>
                </a>
              </Paper>
            </div>
          ))}
        </div>
      </section>

      {/* AD SYSTEM */}
      <section id="ads" style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 28px 32px", scrollMarginTop: 60 }}>
        <SectionHead
          kicker={t.sectionAdsKicker}
          title={t.sectionAds}
          intro={t.sectionAdsIntro}
          accent={accent} marker={marker} muted={muted} mono={mono} serif={serif}
        />

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12,
          marginTop: 48,
        }} className="ads-grid">
          {adSlots.map((a, i) => (
            <div key={a.name} style={{ position: "relative", paddingTop: 12 }}>
              <Paper tint={i % 2 ? paper2 : paper} pad="14px 12px 16px" rotation={rot(i + 5) * 0.6}>
                <Tape color={tapeR} style={{ top: -8, left: "30%", transform: `rotate(${(i * 9) % 8 - 4}deg)`, width: 50, height: 12 }}/>
                <div style={{
                  ...mono, fontSize: 9, letterSpacing: "0.16em",
                  textTransform: "uppercase", color: faint, marginBottom: 6,
                }}>0{i + 1}</div>
                <h4 style={{ ...serif, fontSize: 16, fontWeight: 500, margin: 0, letterSpacing: "-0.005em" }}>
                  {a.name}
                </h4>
                <p style={{ fontSize: 11.5, color: muted, lineHeight: 1.4, margin: "4px 0 0" }}>
                  {a[L]}
                </p>
              </Paper>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 32, fontSize: 13, color: muted, fontStyle: "italic", maxWidth: 720 }}>
          {L === "pt"
            ? "→ Ative os ads no painel Tweaks para vê-los em ação no Pinboard ou em qualquer post."
            : "→ Toggle ads in the Tweaks panel to see them live on the Pinboard or any post."}
        </p>
      </section>

      {/* HANDOFF */}
      <section id="handoff" style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 28px 100px", scrollMarginTop: 60 }}>
        <SectionHead
          kicker={t.sectionHandoffKicker}
          title={t.sectionHandoff}
          intro={t.sectionHandoffIntro}
          accent={accent} marker={marker} muted={muted} mono={mono} serif={serif}
        />

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32,
          marginTop: 48,
        }} className="handoff-grid">
          <DocCard
            tint={paper} rotation={-0.6}
            label="BRAND_GUIDE.md" lines={252}
            title={L === "pt" ? "Guia da marca" : "Brand guide"}
            desc={L === "pt"
              ? "Identidade · cor · tipografia · composição · regras invioláveis. Cobre TF (mark + texto), uso do laranja (≤10%), regras de fundo, e os 5 princípios de composição."
              : "Identity · color · typography · composition · inviolable rules. Covers TF (mark + text), orange usage (≤10%), background rules, and the 5 composition principles."}
            href="BRAND_GUIDE.md"
            cta={t.readDoc + " →"}
            tape={tape} tape2={tape2} accent={accent} ink={ink} muted={muted} mono={mono} serif={serif} hand={hand}
            Paper={Paper} Tape={Tape}
          />
          <DocCard
            tint={paper2} rotation={0.5}
            label="CLAUDE_CODE_BRIEF.md" lines={371}
            title={L === "pt" ? "Brief para engenharia" : "Engineering brief"}
            desc={L === "pt"
              ? "Como portar o protótipo para Next.js 14 + TypeScript: layouts, breakpoints, ad slots, deep links, chaves de localStorage, micro-copy, e checklist de QA."
              : "How to port the prototype to Next.js 14 + TypeScript: layouts, breakpoints, ad slots, deep links, localStorage keys, micro-copy, and QA checklist."}
            href="CLAUDE_CODE_BRIEF.md"
            cta={t.readDoc + " →"}
            tape={tapeR} tape2={tape} accent={accent} ink={ink} muted={muted} mono={mono} serif={serif} hand={hand}
            Paper={Paper} Tape={Tape}
          />
        </div>

        {/* Brand assets row */}
        <div style={{ marginTop: 56 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: faint, marginBottom: 14 }}>
            /brand · {L === "pt" ? "10 SVGs prontos pra produção" : "10 SVGs production-ready"}
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10,
          }} className="brand-files-grid">
            {[
              "monogram-dark-bg.svg", "monogram-light-bg.svg",
              "wordmark-dark-bg.svg", "wordmark-light-bg.svg",
              "wordmark-tagline-dark-bg.svg", "wordmark-tagline-light-bg.svg",
              "symbol-deep.svg", "symbol-warm.svg",
              "favicon.svg", "README.md",
            ].map((f, i) => (
              <div key={f} style={{
                ...mono, fontSize: 10, padding: "10px 12px",
                background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                color: muted, letterSpacing: "0.04em", border: `1px dashed ${line}`,
              }}>
                <span style={{ color: faint, marginRight: 6 }}>{String(i + 1).padStart(2, "0")}</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: "32px 28px 48px", textAlign: "center" }}>
        <div style={{ ...hand, fontSize: 22, color: muted }}>
          — {t.footer} —
        </div>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: faint, marginTop: 12 }}>
          {L === "pt" ? "PROTÓTIPO · NÃO DEPLOYADO" : "PROTOTYPE · NOT DEPLOYED"}
        </div>
      </footer>

      {/* Mobile media queries */}
      <style>{`
        @media (max-width: 980px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr) !important; row-gap: 24px; }
          .brand-grid, .pages-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .ads-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .handoff-grid { grid-template-columns: 1fr !important; }
          .brand-files-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .brand-grid, .pages-grid, .ads-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

// --- helpers ---

const SectionHead = ({ kicker, title, intro, accent, marker, muted, mono, serif }) => (
  <div style={{ maxWidth: 800 }}>
    <div style={{ ...mono, fontSize: 11, letterSpacing: "0.22em", color: accent, marginBottom: 10 }}>
      {kicker}
    </div>
    <h2 style={{
      ...serif, fontSize: "clamp(36px, 5vw, 56px)",
      lineHeight: 1.02, letterSpacing: "-0.025em",
      margin: 0, fontWeight: 500, position: "relative", display: "inline-block",
    }}>
      {title}
      <span style={{
        position: "absolute", bottom: 4, left: -4, right: -4, height: "0.22em",
        background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
      }}/>
    </h2>
    <p style={{ ...serif, fontStyle: "italic", fontSize: 17, color: muted, lineHeight: 1.55, marginTop: 18, marginBottom: 0, textWrap: "pretty" }}>
      {intro}
    </p>
  </div>
);

const DocLink = ({ href, label, accent, mono, ink, line }) => (
  <a href={href} style={{
    ...mono, fontSize: 12, letterSpacing: "0.06em",
    color: ink, textDecoration: "none",
    padding: "10px 14px", border: `1px dashed ${line}`,
  }}>
    {label}
  </a>
);

const DocCard = ({ tint, rotation, label, lines, title, desc, href, cta, tape, tape2, accent, ink, muted, mono, serif, hand, Paper, Tape }) => (
  <div style={{ position: "relative", paddingTop: 18 }}>
    <Paper tint={tint} pad="32px 32px 28px" rotation={rotation}>
      <Tape color={tape} style={{ top: -9, left: "20%", transform: "rotate(-3deg)" }}/>
      <Tape color={tape2} style={{ top: -9, right: "20%", transform: "rotate(3deg)" }}/>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <span style={{ ...mono, fontSize: 11, letterSpacing: "0.14em", color: accent, fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ ...mono, fontSize: 10, color: muted }}>
          {lines} lines
        </span>
      </div>
      <h3 style={{ ...serif, fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: "-0.02em" }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, color: muted, lineHeight: 1.55, marginTop: 10, marginBottom: 18, textWrap: "pretty" }}>
        {desc}
      </p>
      <a href={href} style={{
        ...mono, fontSize: 12, letterSpacing: "0.06em",
        color: ink, textDecoration: "none",
        borderBottom: `1.5px solid ${accent}`, paddingBottom: 2,
      }}>
        {cta}
      </a>
    </Paper>
  </div>
);

// Tiny abstract previews of each brand exploration kind
const BrandMarkPreview = ({ kind, tint, dark, ink, accent }) => {
  const c = tint;
  if (kind === "01") {
    // T isolated — giant T with serif
    return (
      <svg viewBox="0 0 100 110" width="60%" height="60%">
        <text x="50" y="80" fontSize="100" fontFamily='"Fraunces", serif' fontWeight="500"
          textAnchor="middle" fill={c} letterSpacing="-4">T</text>
      </svg>
    );
  }
  if (kind === "02") {
    // Surname signature
    return (
      <svg viewBox="0 0 200 60" width="80%" height="60%">
        <text x="100" y="40" fontSize="22" fontFamily='"Caveat", cursive' fontWeight="600"
          textAnchor="middle" fill={c} fontStyle="italic">Figueiredo</text>
        <line x1="20" y1="48" x2="180" y2="48" stroke={c} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.5"/>
      </svg>
    );
  }
  if (kind === "03") {
    // Stamp with TF
    return (
      <svg viewBox="0 0 120 120" width="64%" height="64%">
        <circle cx="60" cy="60" r="52" fill="none" stroke={c} strokeWidth="2"/>
        <circle cx="60" cy="60" r="44" fill="none" stroke={c} strokeWidth="0.6"/>
        <text x="60" y="70" fontSize="34" fontFamily='"Fraunces", serif' fontWeight="600"
          textAnchor="middle" fill={c} letterSpacing="-2">TF</text>
        <circle cx="60" cy="20" r="2.4" fill={c}/>
      </svg>
    );
  }
  if (kind === "04") {
    // Fleuron + name
    return (
      <svg viewBox="0 0 200 48" width="86%" height="56%">
        <text x="14" y="32" fontSize="22" fontFamily='"Fraunces", serif' fontStyle="italic" fontWeight="400"
          fill={c}>tf</text>
        <text x="46" y="32" fontSize="22" fontFamily='"Fraunces", serif' fontWeight="500"
          fill={c}>❦</text>
        <text x="76" y="32" fontSize="14" fontFamily='"Fraunces", serif' fontWeight="500"
          fill={dark ? "#EFE6D2" : "#161208"}>Thiago Figueiredo</text>
      </svg>
    );
  }
  if (kind === "05") {
    // Editorial crest
    return (
      <svg viewBox="0 0 200 100" width="80%" height="76%">
        <line x1="20" y1="20" x2="180" y2="20" stroke={c} strokeWidth="1.5"/>
        <line x1="20" y1="80" x2="180" y2="80" stroke={c} strokeWidth="1.5"/>
        <text x="100" y="46" fontSize="20" fontFamily='"Fraunces", serif' fontWeight="500"
          textAnchor="middle" fill={c} letterSpacing="2">THIAGO</text>
        <text x="100" y="68" fontSize="14" fontFamily='"JetBrains Mono", monospace' fontWeight="400"
          textAnchor="middle" fill={c} letterSpacing="6">FIGUEIREDO</text>
      </svg>
    );
  }
  return null;
};

window.CaseStudy = CaseStudy;
