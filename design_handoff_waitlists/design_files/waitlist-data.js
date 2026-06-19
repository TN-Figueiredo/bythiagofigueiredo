/* ============================================================
   WAITLISTS — seed data for the CMS module.
   Mirrors the production data model (waitlists + signups + the
   optional campaign link). English-first admin (per spec §6).
   Exposed as window.WL.
   ============================================================ */
(function () {
  // Signups fixture for the focused waitlist ("Nômade Dev · Turma 1").
  // Spread across status / suppression_reason / source so every cell renders.
  const sources = ["landing", "embed", "post"];
  const firstNames = ["lucas", "marina", "rafael", "bia", "joao", "ana", "pedro", "carla", "diego",
    "sofia", "thiago", "leticia", "gustavo", "manu", "rodrigo", "isa", "felipe", "nina", "caio", "duda",
    "andre", "yuki", "minho", "chan", "ravi", "noah", "emma", "liam", "olivia", "ken"];
  const domains = ["gmail.com", "hotmail.com", "outlook.com", "proton.me", "icloud.com", "dev.br"];
  const reasons = [null, null, null, null, "unsubscribe", "bounce", "complaint"];

  function makeSignups(n, seed) {
    const out = [];
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < n; i++) {
      const reason = reasons[Math.floor(rnd() * reasons.length)];
      const suppressed = reason != null;
      const fn = firstNames[Math.floor(rnd() * firstNames.length)];
      const dom = domains[Math.floor(rnd() * domains.length)];
      const num = Math.floor(rnd() * 90 + 10);
      const daysAgo = Math.floor(rnd() * 40);
      out.push({
        id: "sg-" + seed + "-" + i,
        email: `${fn}.${num}@${dom}`,
        status: suppressed ? "suppressed" : "pending",
        suppression_reason: reason,
        source: sources[Math.floor(rnd() * sources.length)],
        created: daysAgo,            // days ago (relative)
        locale: rnd() > 0.5 ? "pt" : "en",
      });
    }
    // ensure a couple of clean recent pending at the top
    out.sort((a, b) => a.created - b.created);
    return out;
  }

  const campaigns = [
    { id: "c-asia", title: "Lançamento Ásia 2026" },
    { id: "c-bf", title: "Black Friday Dev" },
    { id: "c-nas", title: "Setup Caseiro" },
    { id: "c-top1", title: "Top 1 do BR" },
    { id: "c-ia", title: "IA pra Devs" },
  ];

  const waitlists = [
    {
      id: "wl-nomade",
      name: "Nômade Dev · Turma 1",
      slug: "nomade-dev-turma-1",
      status: "open",
      signups: 1284,
      pending: 1208,
      suppressed: 76,
      campaign: "c-asia",
      updated: 2,                 // hours ago
      created: "12 mai 2026",
      description: "Cohort de 6 semanas pra rodar a Ásia como dev — visto, grana em dólar, setup remoto.",
      intro: "A primeira turma do Nômade Dev abre em julho. Entre na lista pra ser avisado antes de todo mundo.",
      sender_name: "Thiago Figueiredo",
      sender_email: "noreply@bythiagofigueiredo.com",
      reply_to: "thiago@bythiagofigueiredo.com",
      sources: { landing: 712, embed: 388, post: 184 },
    },
    {
      id: "wl-nas",
      name: "Setup NAS do Zero",
      slug: "setup-nas-do-zero",
      status: "draft",
      signups: 0,
      pending: 0,
      suppressed: 0,
      campaign: null,
      updated: 26,
      created: "14 jun 2026",
      description: "Ebook prático: montar um NAS caseiro que aguenta backup, mídia e self-host.",
      intro: "",
      sender_name: "Thiago Figueiredo",
      sender_email: "noreply@bythiagofigueiredo.com",
      reply_to: "",
      sources: { landing: 0, embed: 0, post: 0 },
    },
    {
      id: "wl-codigo",
      name: "Código em Português · Cohort",
      slug: "codigo-em-portugues",
      status: "closed",
      signups: 847,
      pending: 821,
      suppressed: 26,
      campaign: "c-bf",
      updated: 73,
      created: "2 abr 2026",
      description: "Mentoria ao vivo: decisões de stack, bugs reais, code review em português.",
      intro: "As inscrições da próxima turma já encerraram — mas o lançamento sai em breve.",
      sender_name: "Thiago Figueiredo",
      sender_email: "noreply@bythiagofigueiredo.com",
      reply_to: "thiago@bythiagofigueiredo.com",
      sources: { landing: 503, embed: 211, post: 133 },
    },
    {
      id: "wl-mrr",
      name: "De MMR pra MRR",
      slug: "de-mmr-pra-mrr",
      status: "launching",
      signups: 2417,
      pending: 2390,
      suppressed: 27,
      campaign: "c-top1",
      updated: 0,
      created: "20 mar 2026",
      description: "Curso: do top 1 do ranking ao primeiro SaaS lucrativo. Game sense vira business sense.",
      intro: "Tá no ar. O email de lançamento está sendo enviado agora.",
      sender_name: "Thiago Figueiredo",
      sender_email: "noreply@bythiagofigueiredo.com",
      reply_to: "thiago@bythiagofigueiredo.com",
      sources: { landing: 1402, embed: 690, post: 325 },
    },
    {
      id: "wl-bangkok",
      name: "Diário de Bangkok · Mini-doc",
      slug: "diario-de-bangkok",
      status: "launched",
      signups: 3106,
      pending: 3061,
      suppressed: 45,
      campaign: "c-asia",
      updated: 122,
      created: "8 fev 2026",
      launched_at: "10 jun 2026",
      description: "Mini-documentário: uma semana gravando, codando e comendo em Bangkok.",
      intro: "Já lançou! O link foi enviado pra todo mundo da lista.",
      sender_name: "Thiago Figueiredo",
      sender_email: "noreply@bythiagofigueiredo.com",
      reply_to: "thiago@bythiagofigueiredo.com",
      sources: { landing: 1788, embed: 902, post: 416 },
    },
    {
      id: "wl-cli",
      name: "CLI de Thumbnails · Beta",
      slug: "cli-de-thumbnails",
      status: "failed",
      signups: 412,
      pending: 401,
      suppressed: 11,
      campaign: null,
      updated: 6,
      created: "1 jun 2026",
      description: "Ferramenta de linha de comando pra gerar variantes de thumbnail seguindo a Lei da Thumbnail.",
      intro: "Beta fechado da CLI que monta as 3 variantes A/B automaticamente.",
      sender_name: "Thiago Figueiredo",
      sender_email: "noreply@bythiagofigueiredo.com",
      reply_to: "",
      sources: { landing: 240, embed: 121, post: 51 },
    },
    {
      id: "wl-ia",
      name: "IA pra Devs Brasileiros",
      slug: "ia-pra-devs",
      status: "open",
      signups: 96,
      pending: 94,
      suppressed: 2,
      campaign: null,
      updated: 4,
      created: "11 jun 2026",
      description: "Guia honesto de usar modelos no dia a dia de quem programa — sem hype.",
      intro: "Um guia direto sobre usar IA no fluxo de quem programa de verdade.",
      sender_name: "Thiago Figueiredo",
      sender_email: "noreply@bythiagofigueiredo.com",
      reply_to: "",
      sources: { landing: 58, embed: 24, post: 14 },
    },
  ];

  // Attach a generated signups list to the focused waitlist (used by the detail screen).
  const signupsByList = {
    "wl-nomade": makeSignups(143, 7),
    "wl-codigo": makeSignups(92, 13),
    "wl-mrr": makeSignups(208, 29),
    "wl-bangkok": makeSignups(60, 41),
    "wl-cli": makeSignups(44, 53),
    "wl-ia": makeSignups(31, 61),
    "wl-nas": [],
  };

  window.WL = { waitlists, campaigns, signupsByList };
})();
