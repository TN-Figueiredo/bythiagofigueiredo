/*
 * Page-specific content for About, Now, 404 — bilingual.
 * Kept in a single object so swapping content doesn't touch layout.
 */
window.PAGE_DATA = {
  about: {
    pt: {
      kicker: "§ SOBRE",
      title: "Quem assina",
      subtitle: "Desenvolvedor brasileiro, escritor de fim de tarde, fazedor de pequenos produtos.",
      body: [
        "Sou Thiago Figueiredo, dev e escritor morando em Belo Horizonte. Há doze anos faço produto: comecei mexendo em PHP em 2013, passei pelo Rails de 2016 a 2020, e nos últimos cinco anos vivo de TypeScript, React e Postgres. Trabalho remoto, faço consultoria pra startups da área de educação e saúde, e nas horas vagas mantenho seis pequenos apps que pagam o café — todos publicados aqui no bythiagofigueiredo.",
        "Escrever sempre foi como eu penso. Comecei um blog em 2015 que durou três meses, outro em 2018 que durou seis, e em 2024 finalmente cedi e comecei a publicar a sério: posts longos sobre arquitetura, ensaios sobre vida indie, e um diário público de bugs estranhos. O canal no YouTube veio em 2025 — live-coding e tours de setup, dois canais (PT e EN) porque metade da minha audiência fala uma língua, metade fala outra.",
        "Esse projeto aqui é a minha tentativa de juntar tudo num só lugar: blog, vídeos, produtos, newsletters. Não é um portfolio polido nem um content engine — é uma estante onde tudo mora junto, organizado por mim, sem algoritmo. Se você gostou de algo, manda um email. Eu respondo.",
      ],
      linksKicker: "ONDE ME ENCONTRAR",
      links: [
        { kind: "MAIL",    label: "tf@bythiagofigueiredo.com", href: "mailto:tf@bythiagofigueiredo.com" },
        { kind: "GH",      label: "github.com/thiagof",       href: "https://github.com/thiagof" },
        { kind: "YT (PT)", label: "Canal em português",        href: "https://youtube.com/@thiagof" },
        { kind: "YT (EN)", label: "Channel in English",        href: "https://youtube.com/@thiagofeng" },
        { kind: "MASTODON",label: "@tf@hachyderm.io",          href: "https://hachyderm.io/@tf" },
        { kind: "RSS",     label: "/feed.xml",                  href: "feed.xml" },
      ],
      nowKicker: "AGORA",
      nowBlurb: "Estou em Belo Horizonte, terminando um livro sobre arquitetura de produto e construindo um CMS pra mim mesmo.",
      nowLink: "Ver lista completa →",
      valuesKicker: "PRINCÍPIOS",
      values: [
        "Honestidade técnica acima de hype.",
        "Posts longos, vídeos longos, código curto.",
        "Open source quando faz sentido, fechado quando paga.",
        "Bilingue de propósito — duas audiências, um pensamento.",
        "Sem newsletter assustadora. Uma por mês, no máximo.",
      ],
    },
    en: {
      kicker: "§ ABOUT",
      title: "Who signs this",
      subtitle: "Brazilian developer, late-afternoon writer, maker of small products.",
      body: [
        "I'm Thiago Figueiredo, a dev and writer living in Belo Horizonte. I've been shipping products for twelve years: started with PHP in 2013, moved through Rails from 2016 to 2020, and for the last five years I've lived in TypeScript, React, and Postgres. I work remotely, consult for education and health startups, and in my off-hours run six small apps that pay for coffee — all published here on bythiagofigueiredo.",
        "Writing has always been how I think. I started a blog in 2015 that lasted three months, another in 2018 that lasted six, and in 2024 I finally gave in and started publishing for real: long posts on architecture, essays on indie life, and a public diary of weird bugs. The YouTube channel came in 2025 — live-coding and setup tours, two channels (PT and EN) because half my audience speaks one language and half speaks the other.",
        "This project is my attempt to put everything in one place: blog, videos, products, newsletters. It's not a polished portfolio or a content engine — it's a shelf where everything lives together, curated by me, without an algorithm. If something here resonates, send me an email. I'll write back.",
      ],
      linksKicker: "WHERE TO FIND ME",
      links: [
        { kind: "MAIL",    label: "tf@bythiagofigueiredo.com", href: "mailto:tf@bythiagofigueiredo.com" },
        { kind: "GH",      label: "github.com/thiagof",       href: "https://github.com/thiagof" },
        { kind: "YT (PT)", label: "Channel in Portuguese",     href: "https://youtube.com/@thiagof" },
        { kind: "YT (EN)", label: "Channel in English",        href: "https://youtube.com/@thiagofeng" },
        { kind: "MASTODON",label: "@tf@hachyderm.io",          href: "https://hachyderm.io/@tf" },
        { kind: "RSS",     label: "/feed.xml",                  href: "feed.xml" },
      ],
      nowKicker: "NOW",
      nowBlurb: "Currently in Belo Horizonte, finishing a book on product architecture and building a CMS for myself.",
      nowLink: "See full list →",
      valuesKicker: "PRINCIPLES",
      values: [
        "Technical honesty over hype.",
        "Long posts, long videos, short code.",
        "Open source when it fits, closed when it pays.",
        "Bilingual on purpose — two audiences, one thought.",
        "No scary newsletter. Monthly at most.",
      ],
    },
  },

  now: {
    pt: {
      kicker: "§ /NOW",
      updated: "atualizado em 24 abr 2026",
      title: "O que estou fazendo",
      subtitle: "Inspirado por Derek Sivers — uma página que diz onde minha cabeça está agora, mais que um perfil estático.",
      sections: [
        { kicker: "FOCO ATUAL", title: "Os três projetos da semana", items: [
          "Terminar o capítulo 4 do livro \"Product is the document\" (75% do rascunho pronto)",
          "Refatorar o CMS pra suportar publicação cross-site (esta arquitetura aqui mesmo)",
          "Gravar o vídeo sobre Postgres triggers — atrasado em duas semanas, sem desculpa",
        ]},
        { kicker: "LEITURA", title: "O que está na cabeceira", items: [
          "\"Designing Data-Intensive Applications\" — Martin Kleppmann (releitura, capítulo 7)",
          "\"O Avesso da Pele\" — Jeferson Tenório",
          "\"Working in Public\" — Nadia Eghbal (terminado mês passado, voltando pra anotações)",
        ]},
        { kicker: "TRABALHO", title: "Consultoria", items: [
          "Fechado pra novos clientes até julho/2026",
          "Mantendo dois contratos em curso (saúde + edtech)",
          "Disponível pra office hours pagas — 1h, R$ 600 — manda email se interessar",
        ]},
        { kicker: "PRODUTOS", title: "Os apps em rotação", items: [
          "Ortega (CRM pra terapeutas) — 230 usuários pagantes, MRR estável",
          "Salário Líquido Brasil — pico de tráfego no início do ano, sem mudança no produto",
          "Tarefa.cafe (TODO minimalista) — em modo de manutenção, sem novos features",
          "Os outros três: hibernando até segundo trimestre",
        ]},
        { kicker: "VIDA", title: "Fora do trabalho", items: [
          "Voltei a treinar corrida — 5km em 28min, meta de 25min até julho",
          "Aprendendo violão clássico — peça atual: \"Lágrima\" de Tárrega",
          "Cozinhando ramen toda sexta — receita do Ivan Orkin",
        ]},
      ],
      note: "essa página muda toda lua nova. Se algo aqui ainda parece exato em três meses, é porque eu esqueci dela.",
    },
    en: {
      kicker: "§ /NOW",
      updated: "updated Apr 24, 2026",
      title: "What I'm doing now",
      subtitle: "Inspired by Derek Sivers — a page that tells you where my head is right now, not a static profile.",
      sections: [
        { kicker: "CURRENT FOCUS", title: "Three projects this week", items: [
          "Finishing chapter 4 of the book \"Product is the document\" (75% of the draft done)",
          "Refactoring the CMS to support cross-site publishing (this very architecture)",
          "Recording the Postgres triggers video — two weeks late, no excuse",
        ]},
        { kicker: "READING", title: "What's on the nightstand", items: [
          "\"Designing Data-Intensive Applications\" — Martin Kleppmann (re-read, chapter 7)",
          "\"O Avesso da Pele\" — Jeferson Tenório (Brazilian fiction)",
          "\"Working in Public\" — Nadia Eghbal (finished last month, going back for notes)",
        ]},
        { kicker: "WORK", title: "Consulting", items: [
          "Closed to new clients until July 2026",
          "Two ongoing contracts (health + edtech)",
          "Available for paid office hours — 1h, US$120 — email me if interested",
        ]},
        { kicker: "PRODUCTS", title: "Apps in rotation", items: [
          "Ortega (CRM for therapists) — 230 paying users, stable MRR",
          "Salário Líquido Brasil — traffic spike early in the year, no product changes",
          "Tarefa.cafe (minimalist TODO) — maintenance mode, no new features",
          "The other three: hibernating until Q2",
        ]},
        { kicker: "LIFE", title: "Outside of work", items: [
          "Back to running — 5km in 28min, goal of 25min by July",
          "Learning classical guitar — currently working on Tárrega's \"Lágrima\"",
          "Cooking ramen every Friday — Ivan Orkin's recipe",
        ]},
      ],
      note: "this page changes every new moon. if anything here still seems accurate in three months, it's because i forgot about it.",
    },
  },

  notfound: {
    pt: {
      kicker: "ERRO · ROTA",
      title: "Essa página foi pro lixo, ou nunca existiu",
      subtitle: "Acontece. Eu reescrevo URLs sem cerimônia, e às vezes esqueço de redirecionar. Tenta um destes:",
      tryKicker: "Tenta um destes",
      links: [
        { label: "← Home (Pinboard)", href: "Pinboard.html" },
        { label: "Arquivo do blog",   href: "blog.html" },
        { label: "Vídeos",            href: "videos.html" },
        { label: "Newsletters",       href: "newsletters.html" },
        { label: "Sobre",             href: "about.html" },
        { label: "Now (o que faço)",  href: "now.html" },
      ],
      footnote: "ou manda um email pra tf@bythiagofigueiredo.com — eu respondo",
    },
    en: {
      kicker: "ERROR · ROUTE",
      title: "This page got tossed, or never existed",
      subtitle: "It happens. I rewrite URLs without ceremony, and I sometimes forget to redirect. Try one of these:",
      tryKicker: "Try one of these",
      links: [
        { label: "← Home (Pinboard)", href: "Pinboard.html" },
        { label: "Blog archive",      href: "blog.html" },
        { label: "Videos",            href: "videos.html" },
        { label: "Newsletters",       href: "newsletters.html" },
        { label: "About",             href: "about.html" },
        { label: "Now (what I'm up to)", href: "now.html" },
      ],
      footnote: "or email tf@bythiagofigueiredo.com — i write back",
    },
  },
};
