/* ============================================================
   links/data.js — dados do Links + Linktree (com analytics rico)
   Decisão de produto: UM hub "Links" com abas
   Linktree (porta de entrada) · Short links · Analytics.
   ("Link in Bio" deixa de ser item separado de nav.)
   ============================================================ */
(function () {
  const channel = { name: "ByThiagoFigueiredo", domain: "go.bythiagofigueiredo.com" };

  // série com ruído suave
  function series(n, base, amp, seed = 1) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(Math.max(0, Math.round(base + Math.sin(i * 1.3 + seed) * amp + (Math.cos(i * 0.7) * amp * 0.4))));
    return out;
  }

  const SOURCES = [
    { id: "newsletter", label: "Newsletter", color: "#A77CE8" },
    { id: "social", label: "Social", color: "#3FA9C0" },
    { id: "blog", label: "Blog", color: "#46B17E" },
    { id: "qr", label: "QR / impresso", color: "#E0A23C" },
    { id: "campaign", label: "Campanha", color: "#5B7FD6" },
    { id: "manual", label: "Manual", color: "#8A8F98" },
  ];

  // ---- Short links (com dados vivos, não tudo zero) ----
  const LINKS = [
    {
      id: "x5qdwDR", title: "Thiago's Journal", slug: "/x5qdwDR", source: "newsletter", badge: "Newsletter",
      dest: "bythiagofigueiredo.com/newsletters/thiago-s-journal", status: "active",
      clicks: 1840, last30: 612, unique: 1290, scans: 880, topCountry: "BR", ctr: 7.2,
      created: "09 mai 2026", health: "ok", redirect: 301, clickIds: true,
      spark: series(14, 30, 14, 2),
    },
    {
      id: "4utjiXb", title: "Diário do Thiago", slug: "/4utjiXb", source: "newsletter", badge: "Newsletter",
      dest: "bythiagofigueiredo.com/pt/newsletters/diario-do-thiago", status: "active",
      clicks: 2310, last30: 740, unique: 1610, scans: 1190, topCountry: "BR", ctr: 8.1,
      created: "02 mai 2026", health: "ok", redirect: 301, clickIds: true,
      spark: series(14, 40, 18, 5),
    },
    {
      id: "mbk47", title: "Vídeo MBK · Ouro R$47", slug: "/mbk47", source: "social", badge: "Social",
      dest: "youtu.be/S1iMQVIOFL4", status: "active",
      clicks: 980, last30: 410, unique: 870, scans: 60, topCountry: "BR", ctr: 5.4,
      created: "18 mai 2026", health: "ok", redirect: 302, clickIds: true,
      spark: series(14, 22, 16, 9),
    },
    {
      id: "curso01", title: "Lançamento · Curso Indie", slug: "/curso01", source: "campaign", badge: "Campanha",
      dest: "bythiagofigueiredo.com/courses/indie-launch", status: "active",
      clicks: 1456, last30: 1456, unique: 1100, scans: 210, topCountry: "PT", ctr: 11.3,
      created: "21 mai 2026", health: "ok", redirect: 301, clickIds: true,
      spark: series(14, 10, 30, 3),
    },
    {
      id: "qrcard", title: "QR Card · Newsletter", slug: "/qrcard", source: "qr", badge: "QR / impresso",
      dest: "bythiagofigueiredo.com/newsletters/thiago-s-journal", status: "active",
      clicks: 312, last30: 188, unique: 280, scans: 305, topCountry: "BR", ctr: 4.0,
      created: "12 mai 2026", health: "warn", redirect: 301, clickIds: true,
      spark: series(14, 6, 8, 7),
    },
    {
      id: "oldgear", title: "Setup antigo (2024)", slug: "/oldgear", source: "blog", badge: "Blog",
      dest: "bythiagofigueiredo.com/blog/meu-setup-2024", status: "paused",
      clicks: 540, last30: 0, unique: 470, scans: 20, topCountry: "US", ctr: 2.1,
      created: "10 fev 2026", health: "broken", redirect: 301, clickIds: false,
      spark: series(14, 0, 2, 1),
    },
  ];

  // ---- Linktree (porta de entrada) ----
  const linktree = {
    url: "go.bythiagofigueiredo.com",
    pageviews: 4820, last30: 1560, unique: 2940, engagement: 38.4, topCountry: "BR",
    spark: series(30, 50, 22, 4),
    // CTR por bloco da árvore (qual link converte)
    blocks: [
      { id: "b1", label: "Blog (EN)", section: "English", clicks: 420, ctr: 27 },
      { id: "b2", label: "Thiago's Journal", section: "English", clicks: 380, ctr: 24 },
      { id: "b3", label: "YouTube (EN)", section: "English", clicks: 210, ctr: 13 },
      { id: "b4", label: "Blog (PT)", section: "Português", clicks: 540, ctr: 35 },
      { id: "b5", label: "Diário do Thiago", section: "Português", clicks: 610, ctr: 39 },
      { id: "b6", label: "YouTube (PT)", section: "Português", clicks: 350, ctr: 22 },
      { id: "b7", label: "Sobre mim", section: "Geral", clicks: 120, ctr: 8 },
      { id: "b8", label: "Contato", section: "Geral", clicks: 90, ctr: 6 },
    ],
    // links compartilhados (editor)
    sharedLinks: [
      { id: "s1", icon: "authors", labelPt: "Sobre mim", labelEn: "About me", url: "/about" },
      { id: "s2", icon: "contacts", labelPt: "Contato", labelEn: "Contact", url: "/contact" },
    ],
  };

  // ---- Analytics agregado (rico) ----
  const analytics = {
    totalClicks: 7438, prevClicks: 6120,
    unique: 5210, prevUnique: 4480,
    ctr: 8.9, prevCtr: 7.6,
    qrShare: 41, // % de cliques que vieram de QR scan
    byDay: series(30, 180, 70, 6),
    byDayPrev: series(30, 150, 55, 2),
    bySource: [
      { id: "newsletter", clicks: 3060, pct: 41 },
      { id: "campaign", clicks: 1456, pct: 20 },
      { id: "social", clicks: 980, pct: 13 },
      { id: "qr", clicks: 805, pct: 11 },
      { id: "blog", clicks: 720, pct: 10 },
      { id: "manual", clicks: 417, pct: 5 },
    ],
    devices: [{ k: "Mobile", v: 58, color: "#F2683C" }, { k: "Desktop", v: 34, color: "#3FA9C0" }, { k: "Tablet", v: 8, color: "#A77CE8" }],
    browsers: [{ k: "Chrome", v: 44 }, { k: "Safari", v: 31 }, { k: "Instagram", v: 14 }, { k: "Opera", v: 7 }, { k: "Outros", v: 4 }],
    os: [{ k: "iOS", v: 41 }, { k: "Android", v: 27 }, { k: "macOS", v: 22 }, { k: "Windows", v: 8 }, { k: "Linux", v: 2 }],
    referrers: [{ k: "instagram.com", v: 38 }, { k: "Direto / QR", v: 29 }, { k: "youtube.com", v: 16 }, { k: "newsletter", v: 12 }, { k: "google.com", v: 5 }],
    countries: [
      { code: "BR", name: "Brasil", v: 62, cities: ["São Paulo", "Rio de Janeiro", "Belo Horizonte"] },
      { code: "PT", name: "Portugal", v: 18, cities: ["Lisboa", "Porto"] },
      { code: "US", name: "Estados Unidos", v: 11, cities: ["New York", "Miami"] },
      { code: "ES", name: "Espanha", v: 5, cities: ["Madrid"] },
      { code: "Outros", name: "Outros", v: 4, cities: [] },
    ],
    // heatmap 7 dias × 24h (intensidade 0..4)
    heatmap: Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => {
      const peak = (h >= 11 && h <= 13) || (h >= 18 && h <= 21);
      const base = peak ? 3 : h < 6 ? 0 : 1;
      return Math.max(0, Math.min(4, base + (Math.sin(d * 2 + h) > 0.6 ? 1 : 0) - (d >= 5 && h < 9 ? 1 : 0)));
    })),
    topLinks: [...LINKS].sort((a, b) => b.last30 - a.last30).slice(0, 5),
    // insights gerados (narrativa) — "potencial" pra IA preencher
    insights: [
      { tone: "up", icon: "trendingUp", text: "Cliques subiram 22% vs. período anterior — puxados pela campanha do curso indie." },
      { tone: "accent", icon: "qr", text: "41% dos cliques vieram de QR impresso. O QR Card da newsletter é seu canal físico mais forte." },
      { tone: "amber", icon: "clock", text: "Pico de cliques entre 18h–21h (BR). Agende compartilhamentos nessa janela." },
      { tone: "red", icon: "warn", text: "1 link com destino quebrado (/oldgear) e 1 a expirar — revise em Saúde dos links." },
    ],
  };

  // ---- Templates de QR (diferentes do Social) ----
  const QR_TEMPLATES = [
    { id: "qr_news", name: "Newsletter Card", ratio: "story", desc: "QR + chamada editorial (impressão)", bg: "linear-gradient(155deg,#F7F1E8,#EDE3D2)", paper: true, tag: "popular" },
    { id: "qr_business", name: "Cartão de visita", ratio: "landscape", desc: "85×55mm · QR + handle + nome", bg: "linear-gradient(135deg,#262219,#161410)", tag: "print" },
    { id: "qr_sticker", name: "Adesivo redondo", ratio: "square", desc: "QR central + 'aponte a câmera'", bg: "linear-gradient(135deg,#1B1230,#2a1846)" },
    { id: "qr_tent", name: "Cavalete de mesa", ratio: "portrait", desc: "QR grande pra balcão/evento", bg: "linear-gradient(155deg,#F7F1E8,#EDE3D2)", paper: true, tag: "print" },
    { id: "qr_poster", name: "Pôster A4", ratio: "portrait", desc: "QR + título grande pra parede", bg: "linear-gradient(135deg,#3a2456,#160c24)" },
    { id: "qr_story", name: "Story", ratio: "story", desc: "QR pra divulgar no Instagram", bg: "linear-gradient(135deg,#2a3340,#0f1820)" },
  ];

  // design inicial do QR card (igual ao screenshot)
  function qrCardDesign() {
    return {
      bg: "#F7F1E8", bgKind: "solid",
      elements: [
        { id: "frame", type: "frame", label: "Moldura editorial", color: "#1F1B17", locked: false },
        { id: "kicker", type: "text", label: "Kicker", text: "NEWSLETTER · WEEKLY", font: "mono", size: 22, color: "#9a6b3f", x: 50, y: 9, align: "center", boxed: true },
        { id: "title", type: "text", label: "Título", text: "Thiago's\nJournal", font: "serif", size: 84, color: "#1F1B17", x: 50, y: 22, align: "center", weight: 700 },
        { id: "qr", type: "image", label: "QR Code", x: 50, y: 56, w: 62, h: 30 },
        { id: "cta", type: "text", label: "Chamada", text: "Point your camera here", font: "serif", size: 40, color: "#1F1B17", x: 50, y: 76, align: "center", weight: 600 },
        { id: "logo", type: "logo", label: "Carimbo TF", x: 50, y: 92 },
      ],
    };
  }

  window.LINKS_DATA = { channel, SOURCES, LINKS, linktree, analytics, QR_TEMPLATES, qrCardDesign, srcById: (id) => SOURCES.find((s) => s.id === id) };
})();
