/* ============================================================
   social/data.js — mock data para a sessão de Posts Sociais
   Modelo mental: DESTINOS reais, não "plataformas" genéricas.
   - YouTube  → aba Comunidade (texto / imagem / enquete) · NUNCA vídeo
   - Instagram→ Story (padrão) · Feed (raro, lançamentos)
   - Facebook → Fanpage (imagem / vídeo + texto)
   ============================================================ */
(function () {
  const channel = {
    name: "ByThiagoFigueiredo",
    handle: "@bythiagofigueiredo",
    igHandle: "@thiago.figueiredo",
    fbPage: "Thiago Figueiredo",
    avatar: "TF",
    subsYT: "1,16 mil",
    followersIG: "8.420",
    followersFB: "3.910",
  };

  // ---- Destinos: a verdade de onde o conteúdo aparece ----
  // surface = a superfície real; cada destino tem regras próprias.
  const DESTINATIONS = [
    {
      id: "ig_story",
      platform: "instagram",
      surface: "story",
      label: "Instagram",
      sub: "Story",
      tint: "#E8823C",
      icon: "instagram",
      ratio: "9:16",
      ratioPx: "1080×1920",
      media: ["image", "video"],
      recommended: true,
      truth: "O padrão da casa. Some em 24h. Foto ou vídeo vertical, montado no canvas.",
      capLimit: 0, // story não tem legenda longa — texto vai no canvas + sticker de link
      note: "Texto e link vão dentro da arte (canvas) — não há legenda longa.",
    },
    {
      id: "yt_community",
      platform: "youtube",
      surface: "community",
      label: "YouTube",
      sub: "Comunidade",
      tint: "#E0574E",
      icon: "youtube",
      ratio: "1:1",
      ratioPx: "1080×1080",
      media: ["text", "image", "poll"],
      recommended: false,
      truth: "Só publica na aba Comunidade. Vídeo NÃO entra aqui — vai pela seção Vídeo.",
      capLimit: 1500,
      note: "Vídeos do canal são gerenciados em Vídeo › não nos Posts.",
    },
    {
      id: "fb_page",
      platform: "facebook",
      surface: "page",
      label: "Facebook",
      sub: "Fanpage",
      tint: "#5B7FD6",
      icon: "facebook",
      ratio: "4:5",
      ratioPx: "1080×1350",
      media: ["image", "video", "text"],
      recommended: false,
      truth: "Post normal na fanpage. Imagem ou vídeo + texto, link com preview.",
      capLimit: 2200,
      note: "Link gera card de preview automático na timeline.",
    },
    {
      id: "ig_feed",
      platform: "instagram",
      surface: "feed",
      label: "Instagram",
      sub: "Feed",
      tint: "#C964A8",
      icon: "instagram",
      ratio: "4:5",
      ratioPx: "1080×1350",
      media: ["image", "video"],
      recommended: false,
      rare: true,
      truth: "Raro — só lançamentos (ex: curso novo). Costuma ir pro arquivo depois.",
      capLimit: 2200,
      note: "Fica fixo no perfil. Lembre de arquivar quando o lançamento acabar.",
    },
  ];

  // ---- Conexões das contas (honesto sobre estado) ----
  const ACCOUNTS = [
    { platform: "instagram", icon: "instagram", handle: "@thiago.figueiredo", status: "ok", detail: "Story + Feed · token válido", followers: "8.420" },
    { platform: "youtube", icon: "youtube", handle: "Comunidade ativa", status: "ok", detail: "Aba Comunidade liberada", followers: "1,16 mil" },
    { platform: "facebook", icon: "facebook", handle: "Thiago Figueiredo", status: "warn", detail: "Token expira em 6 dias — reconectar", followers: "3.910" },
  ];

  // ---- Feed: posts já publicados / agendados, renderizados nativos ----
  const FEED = [
    {
      id: "p1", dest: "ig_story", status: "published", when: "há 3h", lang: "pt",
      media: { kind: "image", bg: "linear-gradient(155deg,#F7F1E8,#EDE3D2)", paper: true,
        kicker: "NEWSLETTER WEEKLY", title: "Thiago's\nJournal", footer: "Aponte a câmera" },
      caption: "Edição 042 no ar 📬",
      stats: { views: "1.204", replies: 18, taps: 96, exits: "12%" },
      source: { kind: "newsletter", name: "Thiago's Journal · #042" },
    },
    {
      id: "p2", dest: "yt_community", status: "published", when: "ontem", lang: "pt",
      media: { kind: "image", bg: "linear-gradient(135deg,#3a2456,#160c24)", overlay: "R$800\nvs\nR$47" },
      caption: "Vídeo novo no ar 🇹🇭 Fui ao MBK Center comparar o preço do ouro — o resultado me surpreendeu. Link nos comentários!",
      poll: null,
      stats: { likes: 142, comments: 23, votes: null },
      source: { kind: "video", name: "MBK Center · Ouro" },
    },
    {
      id: "p3", dest: "yt_community", status: "published", when: "há 2 dias", lang: "pt",
      media: null,
      caption: "Qual conteúdo você quer ver primeiro essa semana?",
      poll: { options: [{ t: "Bastidores da edição", pct: 58 }, { t: "Roteiro de viagem", pct: 31 }, { t: "Setup de gravação", pct: 11 }], votes: 312 },
      stats: { likes: 64, comments: 9, votes: 312 },
      source: null,
    },
    {
      id: "p4", dest: "fb_page", status: "scheduled", when: "amanhã, 09:00", lang: "pt",
      media: { kind: "image", bg: "linear-gradient(155deg,#F7F1E8,#EDE3D2)", paper: true,
        kicker: "NO BLOG", title: "Aprendi inglês\nbrigando online", footer: "bythiagofigueiredo.com" },
      caption: "Em 2009 eu xingava em inglês quebrado. Em 2017 tirei 91 no TOEFL sem nenhuma aula. Como o competitivo me ensinou fluência 👇",
      stats: null,
      source: { kind: "blog", name: "I Learned a Language by Arguing…" },
    },
    {
      id: "p5", dest: "ig_story", status: "scheduled", when: "amanhã, 09:05", lang: "en",
      media: { kind: "image", bg: "linear-gradient(155deg,#1B1230,#2a1846)", overlay: "I LEARNED\nENGLISH\nBY ARGUING" },
      caption: "New on the blog 🇬🇧",
      stats: null,
      source: { kind: "blog", name: "I Learned a Language by Arguing…" },
    },
    {
      id: "p6", dest: "fb_page", status: "failed", when: "há 5h", lang: "pt",
      media: { kind: "video", bg: "linear-gradient(135deg,#2a3340,#0f1820)", dur: "0:38" },
      caption: "Bastidores da gravação em Bangkok 🎬",
      stats: null,
      error: "Token da página expirou — reconecte o Facebook pra reenviar.",
      source: { kind: "video", name: "Bastidores · Bangkok" },
    },
  ];

  // ---- Conteúdo do CMS pra "Do blog/CMS" (compartilhar automático) ----
  const CMS_CONTENT = [
    {
      id: "c1", kind: "blog", badge: "BLOG", lang: "en",
      title: "I Learned a Language by Arguing with Strangers Online",
      url: "https://bythiagofigueiredo.com/blog/i-learned-a-language-by-arguing-with-strangers-online",
      og: {
        title: "I Learned a Language by Arguing with Strangers Online",
        desc: "In 2009 I was screaming at teammates in broken English. By 2017 I scored 91 on the TOEFL without a single class. Here's how competitive gaming taught me fluency.",
        image: "linear-gradient(135deg,#3a2456,#160c24)",
      },
      published: "há 2 dias",
      auto: { story: true, fbPage: true, ytCommunity: true, igFeed: false },
    },
    {
      id: "c2", kind: "blog", badge: "BLOG", lang: "pt",
      title: "Aprendi Inglês Porque Não Conseguia Passar de Fase",
      url: "https://bythiagofigueiredo.com/blog/aprendi-ingles-jogando",
      og: {
        title: "Aprendi Inglês Porque Não Conseguia Passar de Fase",
        desc: "Em 2009 eu xingava em inglês quebrado no meio de uma partida. Em 2017 tirei 91 no TOEFL sem nenhuma aula formal. A história de como o competitivo virou método.",
        image: "linear-gradient(135deg,#2a3340,#0f1820)",
      },
      published: "há 4 dias",
      auto: { story: true, fbPage: true, ytCommunity: true, igFeed: false },
    },
    {
      id: "c3", kind: "newsletter", badge: "NEWSLETTER", lang: "pt",
      title: "Thiago's Journal · Edição #042",
      url: "https://bythiagofigueiredo.com/newsletters/thiago-s-journal/042",
      og: {
        title: "Thiago's Journal #042 — Uma leitura de domingo",
        desc: "Uma carta por semana sobre construir, escrever e pensar em voz alta. Bastidores do que eu tô lançando, notas de leitura e o que acertei (e errei) essa semana.",
        image: "linear-gradient(155deg,#F7F1E8,#EDE3D2)",
      },
      published: "há 6 dias",
      auto: { story: true, fbPage: true, ytCommunity: false, igFeed: false },
    },
    {
      id: "c4", kind: "video", badge: "VÍDEO", lang: "pt",
      title: "Comprei Ouro por R$47 no MBK Center Bangkok",
      url: "https://youtu.be/S1iMQVIOFL4",
      og: {
        title: "Comprei Ouro por R$47 no MBK Center Bangkok 🇹🇭",
        desc: "Fui até o maior mercado de Bangkok comparar o preço do ouro com o Brasil. R$800 aqui, R$47 lá. Será que vale? Vem comigo.",
        image: "linear-gradient(135deg,#3a2456,#160c24)",
      },
      published: "há 1 dia",
      note: "Vídeo já está no YouTube — aqui você só divulga (Story, Comunidade, Fanpage).",
      auto: { story: true, fbPage: true, ytCommunity: true, igFeed: false },
    },
  ];

  // ---- Templates do canvas (reaproveitáveis no CMS) ----
  const TEMPLATES = [
    { id: "t_blog_story", name: "Blog → Story", ratio: "Story", desc: "Capa do post + título + sticker de link", bg: "linear-gradient(155deg,#F7F1E8,#EDE3D2)", paper: true, tag: "auto" },
    { id: "t_news_story", name: "Newsletter → Story", ratio: "Story", desc: "QR / link da edição + chamada", bg: "linear-gradient(155deg,#F7F1E8,#EDE3D2)", paper: true, tag: "auto" },
    { id: "t_video_story", name: "Vídeo → Story", ratio: "Story", desc: "Thumb + 'Vídeo novo' + arrasta pra cima", bg: "linear-gradient(135deg,#3a2456,#160c24)", tag: "auto" },
    { id: "t_quote", name: "Citação", ratio: "Story", desc: "Frase grande sobre fundo creme", bg: "linear-gradient(155deg,#F7F1E8,#EDE3D2)", paper: true },
    { id: "t_launch_feed", name: "Lançamento (Feed)", ratio: "Feed", desc: "Capa de curso 4:5", bg: "linear-gradient(135deg,#1B1230,#2a1846)" },
    { id: "t_community", name: "Comunidade", ratio: "Square", desc: "Card quadrado pra aba Comunidade", bg: "linear-gradient(135deg,#262219,#161410)" },
  ];

  const RATIOS = [
    { id: "story", label: "Story", px: "1080×1920", w: 1080, h: 1920, hint: "IG/FB Story" },
    { id: "square", label: "Quadrado", px: "1080×1080", w: 1080, h: 1080, hint: "YT Comunidade" },
    { id: "feed", label: "Feed", px: "1080×1350", w: 1080, h: 1350, hint: "IG/FB Feed" },
    { id: "landscape", label: "Paisagem", px: "1920×1080", w: 1920, h: 1080, hint: "YT/Thumb" },
    { id: "og", label: "Wide (OG)", px: "1200×630", w: 1200, h: 630, hint: "Link preview" },
    { id: "custom", label: "Custom", px: "—", w: 350, h: 960, hint: "Livre" },
  ];

  // ---- Calendário / melhor horário ----
  const BEST_TIMES = {
    instagram: ["09:00", "12:30", "19:00"],
    youtube: ["18:00", "20:00"],
    facebook: ["08:00", "13:00"],
  };

  const QUEUE = [
    { id: "q1", dest: "ig_story", when: "Hoje · 19:00", caption: "Story do vídeo do MBK 🇹🇭", lang: "pt" },
    { id: "q2", dest: "yt_community", when: "Amanhã · 18:00", caption: "Enquete: próximo destino?", lang: "pt" },
    { id: "q3", dest: "fb_page", when: "Qui · 13:00", caption: "Resumo da semana no blog", lang: "pt" },
  ];

  // calendário: dias da semana × posts agendados
  const CAL_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const CAL_EVENTS = [
    { day: 0, time: "09:00", dest: "fb_page", title: "Blog → Fanpage" },
    { day: 0, time: "09:05", dest: "ig_story", title: "Blog → Story (EN)" },
    { day: 1, time: "18:00", dest: "yt_community", title: "Enquete semanal" },
    { day: 1, time: "19:00", dest: "ig_story", title: "Vídeo MBK" },
    { day: 3, time: "13:00", dest: "fb_page", title: "Resumo da semana" },
    { day: 4, time: "19:00", dest: "ig_story", title: "Citação · domingo" },
    { day: 6, time: "10:00", dest: "ig_story", title: "Newsletter #043" },
  ];

  // ---- Drafts sugeridos pela IA (dá vida ao 'No AI drafts pending') ----
  const AI_DRAFTS = [
    {
      id: "d1", trigger: "Vídeo publicado há 1 dia", icon: "video",
      title: "Post de Comunidade pro vídeo do MBK",
      desc: "Detectei que o vídeo saiu mas não foi divulgado na Comunidade. Montei um post com o link.",
      dest: "yt_community", lang: "pt", confidence: 0.92,
    },
    {
      id: "d2", trigger: "Post novo no blog", icon: "blog",
      title: "Story em inglês do post novo",
      desc: "Post saiu em inglês — legenda e arte montadas em EN, prontas pro Story.",
      dest: "ig_story", lang: "en", confidence: 0.88,
    },
    {
      id: "d3", trigger: "Newsletter enviada", icon: "mail",
      title: "Divulgar a edição #042 no Story",
      desc: "Template Newsletter→Story preenchido com o QR da edição.",
      dest: "ig_story", lang: "pt", confidence: 0.81,
    },
  ];

  // pipeline de publicação (AUTO)
  const PIPELINE = [
    { id: "post", label: "Post", hint: "Validar conteúdo" },
    { id: "shortlink", label: "Short Link", hint: "Gerar link rastreado" },
    { id: "prepare", label: "Preparar destino", hint: "Adaptar por superfície" },
    { id: "deliver", label: "Entregar", hint: "Publicar nas contas" },
  ];

  // ---- Gerador de legendas por IA (tom por plataforma + hashtags + horário) ----
  function aiSuggest(destId, lang, source) {
    const en = lang === "en";
    const t = source && source.og ? source.og.title : null;
    const base = {
      yt_community: {
        tone: en ? "Direct · drives comments" : "Direto · puxa comentário",
        vars: t
          ? [en ? `New video is live 🎬\n\n${t}\n\nLink in the comments — what surprised you most? 👇` : `Vídeo novo no ar 🎬\n\n${t}\n\nLink nos comentários — o que mais te surpreendeu? 👇`,
             en ? `Just dropped: ${t}. Worth it or not? Tell me below.` : `Saiu agora: ${t}. Vale ou não vale? Me conta aí embaixo.`]
          : [en ? `Quick one for the community 👇 what should I cover next?` : `Pergunta rápida pra comunidade 👇 o que vocês querem ver a seguir?`,
             en ? `Behind the scenes this week. Drop a 🔥 if you're in.` : `Tem bastidor chegando essa semana. Manda um 🔥 se tá dentro.`],
        tags: [],
      },
      fb_page: {
        tone: en ? "Descriptive · link-friendly" : "Descritivo · bom pra link",
        vars: t
          ? [source.og.desc, en ? `${t} — full story on the blog. Link below 👇` : `${t} — história completa no blog. Link aqui 👇`]
          : [en ? `A few thoughts on what I'm building this week — and what I got wrong.` : `Algumas reflexões sobre o que tô construindo essa semana — e o que deu errado.`,
             en ? `New on the blog this week. Give it a read 👇` : `Saiu coisa nova no blog essa semana. Dá uma lida 👇`],
        tags: ["#bythiagofigueiredo", "#blog"],
      },
      ig_feed: {
        tone: en ? "Casual · emoji · hashtags" : "Casual · emoji · hashtags",
        vars: t
          ? [en ? `${t} ✨\nNew drop — link in bio.` : `${t} ✨\nSaiu agora — link na bio.`,
             en ? `Been working on this 👀 ${t}` : `Trabalhando nisso 👀 ${t}`]
          : [en ? `New chapter ✨ link in bio` : `Capítulo novo ✨ link na bio`,
             en ? `Something I'm proud of 👀` : `Algo que me orgulha 👀`],
        tags: ["#viagem", "#tailândia", "#bangkok", "#mochilão", "#bythiagofigueiredo"],
      },
      ig_story: {
        tone: en ? "Ultra short · the art does the work" : "Curtíssimo · a arte fala",
        vars: t
          ? [en ? `New on the blog 🇬🇧` : `Saiu no blog 📬`, en ? `Tap to read 👆` : `Arrasta pra ler 👆`]
          : [en ? `New 👀` : `Novidade 👀`, en ? `Swipe up 👆` : `Arrasta pra cima 👆`],
        tags: [],
      },
    };
    const plat = destId === "yt_community" ? "youtube" : destId === "fb_page" ? "facebook" : "instagram";
    const b = base[destId] || base.ig_story;
    return { variations: b.vars, hashtags: b.tags, tone: b.tone, bestTime: (window.SOCIAL.BEST_TIMES[plat] || ["19:00"])[0], platform: plat };
  }

  window.SOCIAL = {
    channel, DESTINATIONS, ACCOUNTS, FEED, CMS_CONTENT,
    TEMPLATES, RATIOS, BEST_TIMES, QUEUE, CAL_DAYS, CAL_EVENTS,
    AI_DRAFTS, PIPELINE, aiSuggest,
    destById: (id) => DESTINATIONS.find((d) => d.id === id),
  };
})();
