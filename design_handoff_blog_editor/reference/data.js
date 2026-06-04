/* ============================================================
   Mock data — representative of a growing creator (Thiago F.)
   ============================================================ */
window.DATA = (function () {
  const series = (n, base, amp, seed = 1) => Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.round(base + Math.sin((i + seed) / 2.2) * amp + Math.cos(i / 1.3) * amp * 0.4 + (i * base * 0.012))));

  /* ---- NOTIFICATIONS (spread across 6 domains, priority 1-5) ---- */
  const notifications = [
    { id: "n1", domain: "youtube", priority: 5, mins: 24, read: false,
      title: "Grade caiu: A → B", msg: "“Capítulos da Vida #11” perdeu 12% de CTR nas últimas 48h. Vale revisar a thumbnail.",
      action: "Abrir A/B Lab", route: "analytics", icon: "trending" },
    { id: "n2", domain: "pipeline", priority: 4, mins: 41, read: false,
      title: "Bloqueado no gate VVS", msg: "“O Momento Perfeito Não Existe” ficou em 72% — mínimo p/ avançar é 80%.",
      action: "Ver item", route: "upnext", icon: "warn" },
    { id: "n3", domain: "social", priority: 5, mins: 68, read: false,
      title: "Falha ao publicar no Instagram", msg: "A entrega do Reels falhou (token expirado). Reconecte a conta para reenviar.",
      action: "Reconectar", route: "settingsNotif", icon: "x" },
    { id: "n4", domain: "system", priority: 4, mins: 95, read: false,
      title: "Token do Instagram expira em 3 dias", msg: "Renove o acesso para não interromper as publicações automáticas.",
      action: "Renovar", route: "settingsNotif", icon: "clock" },
    { id: "n5", domain: "newsletter", priority: 3, mins: 180, read: false,
      title: "Edição #12 enviada", msg: "Entregue a 1.284 inscritos · 0 bounces · taxa de abertura subindo.",
      action: "Ver relatório", route: "analytics", icon: "checkcircle" },
    { id: "n6", domain: "youtube", priority: 4, mins: 240, read: true,
      title: "Vencedor declarado: Variante B", msg: "Teste A/B de “Morei 4 Anos no Canadá” fechou com +18% de CTR na variante B.",
      action: "Ver resultado", route: "analytics", icon: "trophy" },
    { id: "n7", domain: "pipeline", priority: 3, mins: 300, read: true,
      title: "Graduado para blog post", msg: "“Aprendi Inglês Porque Não Conseguia Passar de Fase” virou rascunho de blog.",
      action: "Abrir blog", route: "upnext", icon: "arrowright" },
    { id: "n8", domain: "links", priority: 3, mins: 360, read: true,
      title: "Meta de link atingida 🎯", msg: "Seu link-in-bio passou de 500 cliques neste mês — meta concluída.",
      action: "Ver links", route: "analytics", icon: "target" },
    { id: "n9", domain: "pipeline", priority: 3, mins: 420, read: true,
      title: "Etapa avançada", msg: "“Morei 4 Anos no Canadá” foi movido para Revisão de edição.",
      action: "Ver pipeline", route: "upnext", icon: "checkcheck" },
    { id: "n10", domain: "newsletter", priority: 4, mins: 600, read: true,
      title: "2 hard bounces detectados", msg: "Dois e-mails foram desativados automaticamente após retorno permanente.",
      action: "Ver inscritos", route: "analytics", icon: "warn" },
    { id: "n11", domain: "social", priority: 3, mins: 700, read: true,
      title: "Story pronto para revisão", msg: "O story gerado para “De Pro Gamer a Programador” está aguardando sua aprovação.",
      action: "Revisar", route: "upnext", icon: "eye" },
    { id: "n12", domain: "system", priority: 5, mins: 60, read: false,
      title: "1 ação atrasada hoje", msg: "Finalizar roteiro de “O Momento Perfeito Não Existe” passou do prazo.",
      action: "Ir para Up Next", route: "upnext", icon: "flame" },
    // cluster — 3+ do mesmo tipo viram thread agrupada
    { id: "n13", domain: "links", priority: 3, mins: 150, read: false, group: "link-click",
      title: "link-in-bio recebeu 50 cliques", msg: "Pico de tráfego vindo do Instagram nas últimas 2h.", action: "Ver links", route: "analytics", icon: "click" },
    { id: "n14", domain: "links", priority: 2, mins: 165, read: false, group: "link-click",
      title: "tnf.to/nas-build recebeu 40 cliques", msg: "Origem: descrição do vídeo no YouTube.", action: "Ver links", route: "analytics", icon: "click" },
    { id: "n15", domain: "links", priority: 2, mins: 175, read: false, group: "link-click",
      title: "tnf.to/curso-wait recebeu 28 cliques", msg: "Origem: link da newsletter #12.", action: "Ver links", route: "analytics", icon: "click" },
    { id: "n16", domain: "newsletter", priority: 2, mins: 800, read: true,
      title: "42 novos inscritos esta semana", msg: "Maior captação desde o lançamento da edição #10.", action: "Ver inscritos", route: "analytics", icon: "user" },
  ];

  /* ---- PIPELINE QUEUE (Up Next) ---- */
  const queue = {
    overdue: [
      { id: "q1", depth: "deep", est: "~3h", title: "O Momento Perfeito Não Existe", task: "Finalizar roteiro",
        author: "tnFigueiredo", playlist: "AI Empire — Construindo 6 Apps", code: "1000/129", stage: "roteiro" },
    ],
    today: [
      { id: "q2", depth: "medium", est: "~2h", title: "Morei 4 Anos no Canadá, Voltei pro Brasil — Agora Vou pra Ásia", task: "Revisar edição",
        author: "Thiago Figueiredo", playlist: "Capítulos da Vida — A Jornada", code: "1000/11", stage: "edicao" },
    ],
  };
  const weekStrip = [
    { d: "SEG", n: 25, items: 1 }, { d: "TER", n: 26, items: 0 }, { d: "QUA", n: 27, items: 1 },
    { d: "QUI", n: 28, items: 0 }, { d: "SEX", n: 29, items: 0, today: true }, { d: "SAB", n: 30, items: 0 },
    { d: "DOM", n: 31, items: 1 },
  ];
  const next7 = [
    { d: "SEX", n: 29, today: true, type: null }, { d: "SAB", n: 30, type: null },
    { d: "DOM", n: 31, type: "video", flag: "🇧🇷" }, { d: "SEG", n: 1, type: "video", flag: "🇧🇷" },
    { d: "TER", n: 2, type: null }, { d: "QUA", n: 3, type: null }, { d: "QUI", n: 4, type: null },
  ];
  const playlists = [
    { name: "AI Empire — Construindo 6 Apps em 12 Meses", done: 0, total: 128, color: "var(--c-pipeline)" },
    { name: "Capítulos da Vida — A Jornada", done: 0, total: 11, color: "var(--c-newsletter)" },
    { name: "Tomando Controle — Dinheiro, Negócio", done: 0, total: 8, color: "var(--c-social)" },
    { name: "Gaming para Vida — De Pro Gamer a Programador", done: 0, total: 5, color: "var(--c-links)" },
    { name: "Blog: Behind the Scenes", done: 0, total: 4, color: "var(--c-youtube)" },
    { name: "Idiomas como Superpoder", done: 0, total: 3, color: "var(--c-system)" },
  ];

  /* ---- DASHBOARD ---- */
  const attention = [
    { domain: "system", priority: 5, title: "1 ação atrasada", sub: "Finalizar roteiro · O Momento Perfeito Não Existe", route: "upnext" },
    { domain: "pipeline", priority: 4, title: "Item bloqueado no gate VVS", sub: "72% — precisa de 80% para avançar", route: "upnext" },
    { domain: "social", priority: 5, title: "Instagram desconectado", sub: "1 publicação falhou — token expirado", route: "settingsNotif" },
    { domain: "youtube", priority: 4, title: "CTR caindo em 1 vídeo", sub: "Capítulos da Vida #11 · −12% em 48h", route: "analytics" },
  ];

  /* ---- ANALYTICS ---- */
  const analytics = {
    kpis: {
      views: { v: "4.820", delta: 14.2, up: true, spark: series(30, 120, 40, 2) },
      unique: { v: "3.140", delta: 9.1, up: true, spark: series(30, 80, 30, 4) },
      reads: { v: "2.180", delta: 22.0, up: true, spark: series(30, 60, 24, 1) },
      subs: { v: "1.284", delta: 38, up: true, abs: true, spark: series(30, 30, 10, 5) },
      open: { v: "47,2%", delta: 3.4, up: true, spark: series(30, 44, 6, 3) },
      clicks: { v: "392", delta: 6.8, up: false, spark: series(30, 14, 6, 6) },
    },
    funnel: [
      { label: "Views", v: 4820, color: "var(--c-pipeline)" },
      { label: "Leram 50%+", v: 2180, color: "var(--c-newsletter)" },
      { label: "Clicaram link", v: 392, color: "var(--accent)" },
      { label: "Abriram NL", v: 540, color: "var(--c-social)" },
      { label: "Assinaram", v: 38, color: "var(--c-links)" },
    ],
    clicksOverTime: series(30, 14, 8, 6),
    clicksPrev: series(30, 11, 6, 9),
    topPosts: [
      { title: "Aprendi Inglês Porque Não Conseguia Passar de Fase", status: "published", views: 2140, unique: 1620, depth: 58, time: "4:12", reads: 41 },
      { title: "I Learned a Language by Arguing with Strangers Online", status: "published", views: 1810, unique: 1190, depth: 52, time: "3:46", reads: 33 },
      { title: "Por Que Apaguei Meu iCloud Depois de 12 Anos", status: "draft", views: 0, unique: 0, depth: 0, time: "—", reads: 0 },
    ],
    youtube: {
      health: 78, views30: "182.4K", viewsDelta: 11.3, subs: "+1.240", ctr: "6,8%", ctrDelta: 0.9, retention: "48%", retDelta: 2.1,
      spark: series(30, 5200, 1800, 2),
      topVideos: [
        { title: "Morei 4 Anos no Canadá, Voltei pro Brasil", views: "48.2K", ctr: "8,1%", ret: "52%", grade: "A" },
        { title: "De Pro Gamer a Programador — A Transição", views: "31.7K", ctr: "6,9%", ret: "47%", grade: "B" },
        { title: "Montei o NAS no Menor Case Possível", views: "27.1K", ctr: "7,4%", ret: "51%", grade: "A" },
        { title: "Capítulos da Vida #11 — A Jornada", views: "12.4K", ctr: "4,2%", ret: "39%", grade: "C" },
      ],
    },
    countries: [
      { c: "Brasil", code: "🇧🇷", pct: 64 }, { c: "Portugal", code: "🇵🇹", pct: 11 },
      { c: "Estados Unidos", code: "🇺🇸", pct: 9 }, { c: "Canadá", code: "🇨🇦", pct: 6 },
      { c: "Reino Unido", code: "🇬🇧", pct: 4 }, { c: "Outros", code: "🌍", pct: 6 },
    ],
    devices: [ { d: "Mobile", pct: 71 }, { d: "Desktop", pct: 24 }, { d: "Tablet", pct: 5 } ],
    sources: [
      { s: "YouTube", pct: 41, color: "var(--c-youtube)" },
      { s: "Direto", pct: 24, color: "var(--accent)" },
      { s: "Newsletter", pct: 18, color: "var(--c-newsletter)" },
      { s: "Busca", pct: 11, color: "var(--c-pipeline)" },
      { s: "Social", pct: 6, color: "var(--c-social)" },
    ],
    crossFunnel: [
      { label: "YouTube views", v: 182400, color: "var(--c-youtube)" },
      { label: "Visitas ao site", v: 4820, color: "var(--c-pipeline)" },
      { label: "Cliques em link", v: 392, color: "var(--accent)" },
      { label: "Inscrições NL", v: 38, color: "var(--c-newsletter)" },
      { label: "Compras", v: 4, color: "var(--c-links)" },
    ],
    links: {
      total: "2.940", unique: "2.110", conv: "1,3%", active: 14,
      utm: [
        { camp: "newsletter-12", clicks: 612, conv: 18, color: "var(--c-newsletter)" },
        { camp: "yt-nas-build", clicks: 488, conv: 9, color: "var(--c-youtube)" },
        { camp: "ig-bio-asia", clicks: 291, conv: 6, color: "var(--c-social)" },
        { camp: "blog-ingles", clicks: 374, conv: 4, color: "var(--c-pipeline)" },
      ],
      referrers: [
        { dom: "youtube.com", clicks: 1180, pct: 40 },
        { dom: "instagram.com", clicks: 612, pct: 21 },
        { dom: "google.com", clicks: 470, pct: 16 },
        { dom: "t.co", clicks: 294, pct: 10 },
        { dom: "direto / app", clicks: 384, pct: 13 },
      ],
      top: [
        { url: "tnf.to/canada-asia", src: "Newsletter #12", clicks: 612, unique: 540, country: "🇧🇷 BR", device: "Mobile" },
        { url: "tnf.to/nas-build", src: "YouTube desc", clicks: 488, unique: 410, country: "🇧🇷 BR", device: "Desktop" },
        { url: "tnf.to/ingles-game", src: "Blog post", clicks: 374, unique: 305, country: "🇵🇹 PT", device: "Mobile" },
        { url: "tnf.to/curso-wait", src: "Link in bio", clicks: 291, unique: 250, country: "🇧🇷 BR", device: "Mobile" },
      ],
    },
    readDepth: [
      { range: "0–25%", pct: 28 }, { range: "25–50%", pct: 22 },
      { range: "50–75%", pct: 27 }, { range: "75–100%", pct: 23 },
    ],
    engage: series(30, 50, 16, 3),
    fans: [
      { name: "@marina.dev", interactions: 41, last: "2h", badge: "Top fã" },
      { name: "@pedro_codes", interactions: 33, last: "5h", badge: "Recorrente" },
      { name: "@lucas.asia", interactions: 28, last: "1d", badge: "Recorrente" },
      { name: "@ana.brasil", interactions: 19, last: "1d", badge: "" },
      { name: "@joao.nomad", interactions: 12, last: "3d", badge: "" },
    ],
    revenue: {
      total: "R$ 8.420", delta: 19.4,
      streams: [
        { s: "YouTube AdSense", v: "R$ 5.180", pct: 61, color: "var(--c-youtube)" },
        { s: "Memberships", v: "R$ 1.640", pct: 19, color: "var(--c-social)" },
        { s: "Afiliados", v: "R$ 980", pct: 12, color: "var(--c-links)" },
        { s: "Sponsorships", v: "R$ 620", pct: 8, color: "var(--c-newsletter)" },
      ],
      spark: series(30, 220, 90, 4),
    },
  };

  /* ---- SCHEDULE (May 2026) ---- */
  const schedule = {
    published: 8, scheduled: 5, cadence: 86, overdue: 1,
    // day -> events
    events: {
      7: [{ type: "blog", title: "Aprendi Inglês Porque Não Conseguia Passar de Fase" },
          { type: "blog", title: "I Learned a Language by Arguing with Strangers" }],
      9: [{ type: "video", title: "Montei o NAS no Menor Case Possível" }],
      12: [{ type: "newsletter", title: "Edição #11 — Rotina de Criador" }],
      14: [{ type: "video", title: "De Pro Gamer a Programador" }],
      19: [{ type: "newsletter", title: "Edição #12 — Mudança pra Ásia" }],
      21: [{ type: "video", title: "Por Que Apaguei Meu iCloud", scheduled: true }],
      26: [{ type: "newsletter", title: "Edição #13", scheduled: true }],
      28: [{ type: "video", title: "Crise de NAND Flash 2026", scheduled: true }],
      31: [{ type: "video", title: "Vou Morar na Tailândia", scheduled: true }],
    },
    backlog: [
      { type: "video", title: "9.451 Testes. 190 Migrations. 1 Dev.", playlist: "AI Empire" },
      { type: "blog", title: "O Custo Real de Self-Hosting Tudo", playlist: "Behind the Scenes" },
      { type: "video", title: "Indo Pra Ásia Com Meu Pai", playlist: "Capítulos da Vida" },
    ],
  };

  /* ---- BLOG (Posts module — mirrors Newsletter structure) ---- */
  const blog = {
    stats: { total: 54, pipeline: 52, published: 2, throughput: "2/mês" },
    cadence: [
      { lang: "PT-BR", flag: "🇧🇷", every: "7 dias", time: "09:00" },
      { lang: "EN", flag: "🇺🇸", every: "7 dias", time: "09:00" },
    ],
    // categories (a.k.a. tags) — each carries the editorial color used across chips + cards
    categories: [
      { id: "bts",      pt: "Behind the Scenes", en: "Behind the Scenes", slug: "behind-the-scenes", badge: "BTS",   color: "#c14513", dark: "#FF8240", count: 2 },
      { id: "control",  pt: "Controle",          en: "Control",           slug: "control",            badge: "CTRL",  color: "#a855f7", dark: "#c084fc", count: 0 },
      { id: "stories",  pt: "Histórias",         en: "Stories",           slug: "stories",            badge: "STORY", color: "#22b8d6", dark: "#3fcdea", count: 0 },
      { id: "building", pt: "Construindo",       en: "Building",          slug: "building",           badge: "BUILD", color: "#22c55e", dark: "#3ad675", count: 0 },
      { id: "ai",       pt: "AI Empire",         en: "AI Empire",         slug: "ai-empire",          badge: "AI",    color: "#f59e0b", dark: "#ffb02e", count: 0 },
    ],
    // pipeline stages (left→right). Each post lives in one stage.
    stages: [
      { id: "ideia",     label: "Ideia",     color: "var(--c-social)" },
      { id: "rascunho",  label: "Rascunho",  color: "var(--accent)" },
      { id: "pronto",    label: "Pronto",    color: "var(--c-pipeline)" },
      { id: "agendado",  label: "Agendado",  color: "var(--c-newsletter)" },
      { id: "publicado", label: "Publicado", color: "var(--c-links)" },
    ],
    posts: [
      // ── IDEIA ──
      { code: "td-06", lang: "en", age: "14d", pri: "media",  cat: "building", stage: "ideia", done: 0, total: 6,
        title: "The AI-Native Dev Stack: What Changes When AI Is Your Copilot",
        excerpt: "The tools, habits and trade-offs of building with AI in the loop every day." },
      { code: "tc-05", lang: "en", age: "14d", pri: "media",  cat: "control", stage: "ideia", done: 0, total: 6,
        title: "How to Make Big Decisions Without Overthinking",
        excerpt: "A simple framework I use when the stakes are high and the data is thin." },
      { code: "tb-06", lang: "en", age: "14d", pri: "media",  cat: "stories", stage: "ideia", done: 0, total: 6,
        title: "What 15 Years of Coding Taught Me That No Bootcamp Will",
        excerpt: "The unglamorous lessons that only show up after a decade in the trenches." },
      { code: "tb-05", lang: "pt", age: "14d", pri: "media",  cat: "ai", stage: "ideia", done: 0, total: 6,
        title: "6 Apps em 12 Meses: O Plano (e Por Que Pode Falhar)",
        excerpt: "O cronograma honesto por trás do AI Empire — e os riscos que eu enxergo." },
      { code: "ta-10", lang: "en", age: "14d", pri: "media",  cat: "stories", stage: "ideia", done: 0, total: 6,
        title: "How I Think in Two Languages — And Why It Matters for Problem-Solving",
        excerpt: "Switching languages changes how I frame problems. Here's what I noticed." },
      { code: "tf-04", lang: "en", age: "14d", pri: "normal", cat: "stories", stage: "ideia", done: 0, total: 6,
        title: "The Day I Realized Gaming Wasn't Going to Pay My Bills",
        excerpt: "Top 38 in the Americas, 1.500 live viewers, zero revenue. The turning point." },
      // ── RASCUNHO ──
      { code: "tf-05", lang: "en", age: "4d", pri: "media",  cat: "stories", stage: "rascunho", done: 0, total: 6, date: 12,
        title: "Diablo 1, Battle.net, e Duplicar Itens: Meu Primeiro Contato com \"Hacking\"",
        excerpt: "Como exploitar um bug de duplicação aos 11 anos me ensinou a pensar como dev." },
      { code: "te-05", lang: "pt", age: "4d", pri: "media",  cat: "bts", stage: "rascunho", done: 0, total: 6, date: 19,
        title: "O Que 648 Vídeos No YouTube Me Ensinaram (Antes de Eu \"Começar\" de Verdade)",
        excerpt: "Publiquei 648 vídeos antes de levar a sério. Eis o que ficou." },
      { code: "tg-01", lang: "pt", age: "1d", pri: "normal", cat: "ai", stage: "rascunho", done: 1, total: 4, featured: true,
        title: "AI Empire: O Que Vem Por Aí",
        excerpt: "Dev frontend construindo apps reais com IA, documentando tudo em público — do código ao deploy.",
        hook: "Dev frontend construindo apps reais com IA, documentando tudo em público — do código ao deploy, da estratégia à monetização.",
        sinopse: "Artigo manifesto que apresenta AI Empire: o método de construir produtos digitais com inteligência artificial como motor de produção. Cobre a trajetória do autor (Dota pro → construção civil no Canadá → contractor em dólar → builder independente), a tese de que frontend + IA é superpoder, e a decisão de documentar tudo em público no canal, blog e newsletter. Inclui plano de viagem para Ásia como nômade digital.",
        readTime: "6 min", words: 1180, plevel: "P2",
        slug: "",
        tags: ["tg", "ai-empire", "behind-the-scenes", "playlist-g", "build-in-public", "dev-independente", "frontend-ia", "nomade-digital", "construir-com-ia"],
        cover: { kind: "code" }, seoReady: false, coverReady: false, sitePublished: false,
        history: [
          { to: "Rascunho", date: "31 mai" },
          { to: "Agendado", date: "22 mai" },
          { to: "Pronto", date: "22 mai" },
        ],
        versions: [],
        checklist: [
          { label: "Estrutura e arco definidos", done: true },
          { label: "Primeiro rascunho escrito", done: false },
          { label: "Revisão de tom e voz", done: false },
          { label: "Links, CTAs e imagens", done: false },
        ],
        body: [
          { t: "p", html: "Entre 2011 e 2013, eu já tinha mais de <b>1.500 pessoas</b> assistindo minhas streams ao vivo. Fui <b>top 38 das Américas</b> no Dota 2, dedicando em média 14 a 18 horas por dia entre jogar e streamar. O esforço foi sensacional — mas naquela época, praticamente não existia anúncio na Twitch TV para canais brasileiros. Todas aquelas horas de trabalho não eram remuneradas. Nenhum centavo." },
          { t: "img", id: "img-1", alt: "Linha do tempo visual mostrando a evolução das 4 fases — do grind no Canadá ao builder independente", status: "pending" },
          { t: "p", html: "O esforço estava certo. O modelo de negócio é que estava errado. Essa lição eu carrego até hoje: <b>audiência sem monetização é burnout com plateia.</b> Desta vez é diferente — e o nome dessa vez é <b>AI Empire</b>." },
          { t: "img", id: "img-2", alt: "Comparação visual entre abordagem novelty de canais de IA e abordagem profundidade do AI Empire", status: "pending" },
          { t: "quote", html: "Esse post é um bastidor. Vou te contar o que estou montando, por que decidi montar assim, e o que você pode esperar daqui pra frente — no <span class=\"lk\">canal</span>, no <span class=\"lk\">blog</span>, e na <span class=\"lk\">newsletter</span>." },
          { t: "img", id: "img-3", alt: "Pirâmide visual com 3 níveis mostrando a vantagem competitiva do frontend dev com IA", status: "pending" },
        ] },
      // ── PUBLICADO ──
      { code: "ta-01", lang: "pt", age: "8d", pri: "baixa", cat: "bts", stage: "publicado", done: 6, total: 6,
        title: "Aprendi Inglês Porque Não Conseguia Passar de Fase",
        excerpt: "Fiquei preso numa caverna em Namekusei num RPG de Dragon Ball Z. Peguei o dicionário físico. Assim começou.",
        hook: "Fiquei preso numa caverna em Namekusei num RPG de Dragon Ball Z. Peguei o dicionário físico. Assim começou.",
        sinopse: "Artigo pessoal sobre aprender inglês autodidata via games. De ROMs no ZSNES com dicionário físico, passando por voice chat de MOBA em 2008, filmes sem legenda, até TOEFL 91 sem nunca pisar num curso.",
        readTime: "7 min", words: 1500, plevel: "P1",
        slug: "aprendi-ingles-porque-nao-conseguia-passar-de-fase",
        tags: ["ta", "intro", "ingles-autodidata", "gaming", "aprender-ingles", "toefl", "dev-brasileiro", "carreira-internacional"],
        cover: { kind: "image" }, seoReady: true, coverReady: true, sitePublished: true, publishedAt: "23 mai",
        seo: { metaTitle: "Como Aprendi Inglês Jogando Videogame — De Dragon Ball Z ao TOEFL 91", metaDesc: "Fiquei preso numa caverna em Namekusei num RPG de Dragon Ball Z. Peguei o dicionário. Assim começou anos de inglês autodidata até TOEFL 91 sem curso." },
        titleAlts: ["De Dicionário Físico a TOEFL 91: Como Aprendi Inglês Sem Curso", "Dragon Ball Z Me Ensinou Inglês — E Não É Piada", "Nunca Fiz Curso de Inglês. Tirei 91 no TOEFL.", "Como Videogames Me Deram Fluência em Inglês (Sem Professor)"],
        history: [
          { to: "Publicado", date: "23 mai" },
          { to: "Agendado", date: "22 mai" },
          { to: "Pronto", date: "22 mai" },
        ],
        versions: [{ lang: "en", code: "ta-03", status: "published", title: "I Learned a Language by Arguing with Strangers Online" }],
        checklist: [
          { label: "Outline/estrutura definida", done: true },
          { label: "Rascunho escrito", done: true },
          { label: "Revisão de conteúdo", done: true },
          { label: "SEO keywords", done: true },
          { label: "Imagem de capa", done: true },
          { label: "Publicar no site", done: true },
        ],
        body: [
          { t: "p", html: "Eu era adolescente, tinha um emulador chamado ZSNES rodando no PC do meu pai, e uma ROM de Dragon Ball Z RPG que eu tinha baixado de algum site de ROMs. Tela pixelada, menus em inglês, e eu preso há dias numa caverna em Namekusei sem conseguir avançar." },
          { t: "p", html: "O que eu tinha era um dicionário físico. Capa dura, pesado. E comecei a traduzir palavra por palavra até descobrir que precisava <b>\"look inside the holes\"</b> dentro daquela caverna. Buracos. No chão. Em Namekusei." },
          { t: "quote", html: "Depois que você aprende o que é <b>\"hole\"</b> desse jeito — preso, frustrado, traduzindo na raça — você nunca mais esquece. A palavra vira sua. Não é flashcard. É memória de guerra." },
        ] },
      { code: "ta-03", lang: "en", age: "8d", pri: "baixa", cat: "stories", stage: "publicado", done: 6, total: 6,
        title: "I Learned a Language by Arguing with Strangers Online",
        excerpt: "In 2008 I could read and sing in English but had never spoken it. My first real conversation was screaming at teammates.",
        slug: "i-learned-a-language-by-arguing-with-strangers-online",
        readTime: "6 min", words: 1320, plevel: "P1", coverReady: true, seoReady: true, sitePublished: true, publishedAt: "22 mai",
        body: [
          { t: "p", html: "By 2008 I could <b>read</b> English fine and even sing along to whole albums — but I had never actually <b>spoken</b> it. Not one real sentence, out loud, to another human." },
          { t: "p", html: "Then I started playing competitive games with voice chat. My first real conversations in English were me yelling at teammates in the middle of a match. Brutal feedback loop, but the fastest one I ever found." },
          { t: "quote", html: "You don't learn a language in a classroom. You learn it when something you care about is on the line — like not losing the game because nobody understood your call." },
        ] },
    ],
  };

  return { notifications, queue, weekStrip, next7, playlists, attention, analytics, schedule, blog, series };
})();
