/* ============================================================
   RESEARCH MODULE — seed data
   Foco (horizontes) · Temas · Pesquisas (TipTap docs) · Decisões
   Lives on window.RESEARCH. Mutations persist via research-store.
   ============================================================ */
(function () {
  /* ---- Temas (channel cross-theme DNA) ---- */
  const TEMAS = [
    { id: "asia",  label: "Ásia & Nomadismo", short: "Ásia",   color: "#22b8d6", icon: "globe"    },
    { id: "ia",    label: "IA & Produção",    short: "IA",     color: "#8b8cf6", icon: "sparkles"  },
    { id: "dev",   label: "Programação",      short: "Dev",    color: "#22c55e", icon: "blog"      },
    { id: "games", label: "Games & Pedigree", short: "Games",  color: "#ec4899", icon: "trophy"    },
    { id: "grana", label: "Monetização",      short: "Grana",  color: "#f59e0b", icon: "dollar"    },
    { id: "canal", label: "Canal & Audiência", short: "Canal", color: "#a855f7", icon: "youtube"   },
  ];

  /* ---- Lifecycles ---- */
  const STATUS = {
    fresca:    { label: "Fresca",     kind: "info",   dot: "var(--info)"   },
    analise:   { label: "Em análise", kind: "warn",   dot: "var(--warn)"   },
    aplicada:  { label: "Aplicada",   kind: "ok",     dot: "var(--ok)"     },
    arquivada: { label: "Arquivada",  kind: "muted",  dot: "var(--text-dim)" },
  };
  const SOURCE = {
    cowork: { label: "Claude Cowork", short: "Cowork", icon: "sparkles", tone: "var(--c-courses)" },
    thiago: { label: "Você",          short: "Você",   icon: "edit",     tone: "var(--accent)" },
    dupla:  { label: "Cowork + você",  short: "Dupla",  icon: "authors",  tone: "var(--c-pipeline)" },
  };
  const HORIZONS = [
    { id: "agora",    label: "Agora",    sub: "Próximos 3 meses",   icon: "target",  color: "var(--accent)" },
    { id: "proximo",  label: "Próximo",  sub: "3 a 6 meses",        icon: "arrowright", color: "var(--c-pipeline)" },
    { id: "explorar", label: "Explorar", sub: "Apostas / backlog",  icon: "flask",   color: "var(--c-courses)" },
  ];
  const DECISION_STATUS = {
    decidido: { label: "Decidido",  kind: "ok",   icon: "checkcircle" },
    testando: { label: "Testando",  kind: "warn", icon: "flask" },
    revisar:  { label: "Revisar",   kind: "info", icon: "refresh" },
    arquivado:{ label: "Arquivado", kind: "muted",icon: "archive" },
  };
  const FOCO_STATE = {
    ativo:    { label: "No ar",      tone: "var(--accent)" },
    proposto: { label: "Proposto pelo Cowork", tone: "var(--c-courses)" },
    rascunho: { label: "Rascunho",   tone: "var(--text-dim)" },
  };

  /* ---- Focos / Horizontes (the decisions layer) ----
     author: quem criou (thiago = você / cowork = proposto pela IA)
     state:  ativo (você confirmou) · proposto (Cowork sugeriu) · rascunho
     basedOn: pesquisas que fundamentam a aposta (o "baseado em quê") ---- */
  const FOCOS = [
    {
      id: "f-asia", horizon: "agora", active: true, state: "ativo", author: "thiago", created: "28 mai",
      title: "A transição Brasil → Ásia",
      window: "Jun – Ago 2026",
      thesis: "O canal inteiro gira em torno de UMA narrativa nos próximos 3 meses: a saída do Brasil rumo à Ásia como dev nômade. O gancho é o presente contínuo — “estou indo”, “larguei tudo” —, nunca “moro lá”. Escassez geográfica + aspiração: algo que a maioria dos brasileiros não pode fazer.",
      temas: ["asia", "grana", "canal"],
      metric: "8 de 11 vídeos do trimestre",
      basedOn: ["r-custo", "r-thumb"],
    },
    {
      id: "f-ia", horizon: "proximo", state: "proposto", author: "cowork", created: "há 1 dia",
      title: "IA como motor de produção (mostrar, não falar)",
      window: "Set – Out 2026",
      thesis: "Proposta do Cowork a partir das suas pesquisas: transformar o pilar IA de ‘assunto’ em ‘método visível’ — vídeos onde a IA constrói junto, em público, do código ao deploy. Revise, ajuste e confirme para virar o próximo foco.",
      temas: ["ia", "dev"],
      metric: "Série de 4 episódios em outline",
      basedOn: ["r-stack", "r-mmr"],
    },
    {
      id: "f-games", horizon: "explorar", state: "rascunho", author: "thiago", created: "02 jun",
      title: "Games ao vivo — o arco MMR → MRR",
      window: "Aposta · sem data",
      thesis: "Testar uma série mensal ligando o pedigree gamer (top 1 BR, Dota/WYD) à narrativa de builder. ‘O jogo mudou — de MMR pra MRR.’ Sotaque CRT/scanline próprio, badge AO VIVO citando a Twitch.",
      temas: ["games", "grana"],
      metric: "1 piloto para validar retenção",
      basedOn: ["r-mmr"],
    },
  ];

  /* ---- helpers to compose rich HTML cheaply ---- */
  const h2 = (t) => `<h2>${t}</h2>`;
  const p = (t) => `<p>${t}</p>`;
  const note = (t) => `<blockquote><p>${t}</p></blockquote>`;
  const ul = (items) => `<ul>${items.map(i => `<li><p>${i}</p></li>`).join("")}</ul>`;
  const ol = (items) => `<ol>${items.map(i => `<li><p>${i}</p></li>`).join("")}</ol>`;
  const mark = (t) => `<mark>${t}</mark>`;
  const tasks = (items) => `<ul data-type="taskList">${items.map(([d, t]) => `<li data-type="taskItem" data-checked="${d}"><label><input type="checkbox"${d ? " checked" : ""}><span></span></label><div><p>${t}</p></div></li>`).join("")}</ul>`;

  /* ---- Pesquisas (rich documents) ---- */
  const PESQUISAS = [
    {
      id: "r-custo", tema: "asia", status: "aplicada", source: "cowork",
      title: "Custo de vida: Bangkok × Lisboa × São Paulo para um dev BR",
      summary: "Comparação honesta de moradia, comida, internet e visto. Bangkok ganha em custo/conforto, mas o gancho do vídeo é o contraste em dólar — o número que dói.",
      updated: "há 2 dias", readMin: 7, pinned: true,
      takeaways: [
        "Bangkok roda ~40% mais barato que Lisboa com conforto superior para nômade.",
        "O número-âncora é aluguel + comida em dólar vs salário CLT médio no Brasil.",
        "Visto: o caminho realista é DTV (Destination Thailand Visa), não turista.",
      ],
      decisions: ["d-arco", "d-preco"],
      html: [
        p("Esta pesquisa compara três bases plausíveis para a temporada asiática, sempre pela lente do espectador brasileiro que sonha mas acha impossível. " + mark("O ângulo do vídeo não é ‘é barato’ — é ‘dá pra fazer, e dói ver o quanto’.")),
        h2("O número que dói"),
        p("Em dólar, o combo aluguel + comida + transporte em Bangkok cabe em uma fração de um salário de dev sênior remoto. O choque vem ao colocar lado a lado com o custo equivalente em São Paulo somado ao que sobra no fim do mês."),
        ul([
          "Moradia: studio bom em Sukhumvit sai por menos que um quarto decente em Pinheiros.",
          "Comida: comer fora todo dia é viável — o oposto da intuição brasileira.",
          "Internet: fibra simétrica barata e estável, ponto decisivo para quem faz deploy.",
        ]),
        h2("Lisboa como contraponto"),
        p("Lisboa é a rota ‘segura’ que todo dev BR considera. Serve de contraste: mais cara, mais saturada de brasileiros, menos ‘estrangeiro’ na thumbnail. Bangkok entrega o choque visual (placa em escrita não-latina) que a Lei da Thumbnail pede."),
        note("Cuidado de DNA: nunca afirmar residência que não temos. O enquadramento é sempre ‘estou indo / antes de morar lá’, com passaporte brasileiro."),
        h2("Visto — o caminho real"),
        ol([
          "DTV (Destination Thailand Visa): feito para nômades, 5 anos, múltiplas entradas.",
          "Comprovação de renda remota e reserva — listar os documentos no roteiro.",
          "Plano B: education/Muay Thai visa, citado mas não recomendado como principal.",
        ]),
      ].join(""),
    },
    {
      id: "r-mmr", tema: "games", status: "analise", source: "dupla",
      title: "O arco MMR → MRR: de pro player a builder",
      summary: "Como ligar o pedigree gamer (top 1 BR) à narrativa de monetização sem soar saudosista. A ponte entre o pilar Games e o pilar Grana.",
      updated: "há 5 dias", readMin: 6, pinned: true,
      takeaways: [
        "‘O jogo mudou — de MMR pra MRR’ é o arco-assinatura; usar como série, não vídeo único.",
        "O pedigree é credencial de escassez (top 1 BR), não nostalgia.",
        "Mostrar o número de MRR atual fecha o paralelo com o ranking antigo.",
      ],
      decisions: ["d-games"],
      html: [
        p("O público que veio do gaming respeita resultado medido em ranking. A tese: traduzir essa régua para o mundo de produto — MMR vira MRR. " + mark("Mesma obsessão por subir de patente, outra moeda.")),
        h2("Por que funciona"),
        ul([
          "Credencial rara: ‘fui top 1 do BR’ é escassez + aspiração, igual ao flex geográfico.",
          "Continuidade narrativa: o espectador acompanha uma subida, não um tutorial.",
          "Cross-tema: liga Games ao pilar dev/grana, justificando o carimbo TF como elo.",
        ]),
        h2("Riscos"),
        p("Saudosismo mata. Não pode virar ‘nos meus tempos de Dota’. O passado é trampolim para um número presente — o MRR de hoje na tela, ao lado do MMR de ontem."),
        note("Sotaque do pilar: scanlines CRT, desalinho RGB no punch, patente no lugar da bandeira, badge AO VIVO roxo citando a Twitch. Nunca recriar logos de jogos."),
      ].join(""),
    },
    {
      id: "r-thumb", tema: "canal", status: "aplicada", source: "thiago",
      title: "Formatos de thumbnail para canal de temas misturados",
      summary: "Como o Nômade Raiz faz milhões sem tag de gênero, e o que isso significa para um canal que mistura viagem/IA/games/código.",
      updated: "há 1 dia", readMin: 5, pinned: true,
      takeaways: [
        "Tag de gênero na thumb é poluição — a imagem entrega o tema sozinha.",
        "Dois formatos testáveis: (A) caixa de reação laranja, (B) nome do lugar gigante.",
        "O elo cross-tema é o carimbo TF, não uma tag.",
      ],
      decisions: ["d-formato"],
      html: [
        p("Referência observada (sem copiar): canais de viagem topo de funil vendem ‘é longe + é ele’ sem nenhuma tag. " + mark("O tratamento invariável é a personalidade, não o tema.")),
        h2("As 5 âncoras, sempre"),
        ol([
          "Rosto recortado à direita, reação no olhar, rim-light laranja.",
          "Passaporte no topo-esquerdo: carimbo TF + etiqueta de origem (bandeira ou patente).",
          "Laranja #FF8240 em ≤10% da área (regra 60·30·10).",
          "Voz tipográfica: Archivo 900 + uma palavra Fraunces itálico (o número).",
          "Moldura + o estrangeiro nítido — a cena é a estrela, nunca borrada.",
        ]),
        h2("Os dois formatos a testar"),
        p("Nunca os dois juntos. " + mark("Caixa de reação") + " (frase curta em caixa laranja) versus " + mark("nome do lugar gigante") + " (país em Archivo 900 + número em Fraunces). O público escolhe pela retenção."),
        note("Teste final: encolhida a ~168px, ao lado de outras, dá pra saber que é dele e que é longe sem ler o nome?"),
      ].join(""),
    },
    {
      id: "r-stack", tema: "ia", status: "fresca", source: "cowork",
      title: "Stack de IA para produção de conteúdo em 2026",
      summary: "O que automatizar sem perder a voz: roteiro, corte, legenda, thumbnail. Onde a IA ajuda e onde ela ainda atrapalha.",
      updated: "há 6 horas", readMin: 8, pinned: false,
      takeaways: [
        "IA é motor de produção, não de opinião — a tese sempre é do Thiago.",
        "Maior alavanca: transcrição → outline → variantes de título/thumb.",
        "Corte automático ainda exige passada humana para ritmo.",
      ],
      decisions: [],
      html: [
        p("Mapa do que a IA faz bem hoje no pipeline do estúdio, separando ganho real de hype. " + mark("Regra: a IA acelera a produção; a direção continua humana.")),
        h2("Onde ganha"),
        ul([
          "Transcrição e outline a partir de um take bruto.",
          "Geração de 3 variantes de título/legenda por idioma (PT/EN).",
          "Rascunho de descrição, capítulos e posts derivados.",
        ]),
        h2("Onde ainda atrapalha"),
        ul([
          "Corte fino: ritmo e respiração ainda pedem ouvido humano.",
          "Thumbnail: gera ideias, mas a composição segue a Lei manualmente.",
        ]),
      ].join(""),
    },
    {
      id: "r-news", tema: "canal", status: "analise", source: "cowork",
      title: "Newsletter bilíngue: cadência e formato",
      summary: "Semanal vs quinzenal, PT/EN no mesmo envio ou separados, e como a newsletter vira a memória do canal.",
      updated: "há 3 dias", readMin: 6, pinned: false,
      takeaways: [
        "Separar PT e EN por canal/idioma — confirma a audiência, não dilui.",
        "Cadência semanal só se houver banco de pesquisa alimentando.",
        "A newsletter fecha o loop: pesquisa → decisão → conteúdo → carta.",
      ],
      decisions: ["d-news"],
      html: [
        p("A newsletter não é resumo de vídeo — é o bastidor da decisão. " + mark("‘Por que esse vídeo existe’ é o conteúdo.")),
        h2("Cadência"),
        p("Semanal exige um banco de pesquisa girando. Sem isso, vira tarefa e morre. A recomendação é quinzenal até o pilar de pesquisa estar redondo, depois semanal."),
        h2("Estrutura por edição"),
        tasks([
          [true, "Uma decisão da semana (o que mudou no plano e por quê)."],
          [false, "Um número que dói (o contraste Brasil × lá)."],
          [false, "Um bastidor de produção (a IA no pipeline, o erro do corte)."],
          [false, "Um CTA honesto, sem clickbait."],
        ]),
      ].join(""),
    },
    {
      id: "r-nas", tema: "dev", status: "fresca", source: "thiago",
      title: "Self-hosting: vale um NAS para o estúdio nômade?",
      summary: "Backup de footage 4K, acesso remoto da Ásia e o trade-off entre carregar hardware e depender de cloud.",
      updated: "há 8 horas", readMin: 5, pinned: false,
      takeaways: [
        "Footage 4K cresce rápido — cloud puro fica caro no longo prazo.",
        "NAS em casa + acesso remoto resolve, mas adiciona ponto de falha longe.",
        "Possível vídeo: ‘meu estúdio cabe numa mochila?’",
      ],
      decisions: [],
      html: [
        p("Questão prática que vira conteúdo: como um estúdio de uma pessoa só sobrevive a 17 mil km de distância do backup. " + mark("O hardware é personagem, não especificação.")),
        h2("O trade-off"),
        ul([
          "Cloud: zero hardware para carregar, custo recorrente que escala com footage.",
          "NAS em casa: custo único, mas vira ponto de falha do outro lado do mundo.",
          "Híbrido: NAS como cofre + cloud como cache de trabalho ativo.",
        ]),
      ].join(""),
    },
    {
      id: "r-titulo", tema: "canal", status: "arquivada", source: "dupla",
      title: "Títulos honestos que ainda dão clique",
      summary: "Anti-clickbait sem virar título morno. Como prometer o estrangeiro sem mentir sobre morar lá.",
      updated: "há 3 semanas", readMin: 4, pinned: false,
      takeaways: [
        "Iscas honestas: ‘com passaporte brasileiro’, ‘em dólar’, ‘sozinho’, ‘primeira vez’.",
        "O título completa a thumb, não repete.",
        "Nunca afirmar residência que não temos.",
      ],
      decisions: [],
      html: [
        p("Arquivo de princípios de título já incorporados à Lei. Mantido como referência. " + mark("Honestidade é o diferencial competitivo, não uma limitação.")),
        h2("Iscas que funcionam"),
        ul([
          "Restrição de origem: ‘com passaporte brasileiro’.",
          "Moeda: ‘em dólar’, o contraste que dói.",
          "Vulnerabilidade: ‘sozinho’, ‘primeira vez’, ‘antes de morar lá’.",
        ]),
      ].join(""),
    },
  ];

  /* ---- Decisões ---- */
  const DECISOES = [
    {
      id: "d-arco", statement: "Os próximos 3 meses giram em torno da transição Brasil → Ásia.",
      horizon: "agora", status: "decidido", tema: "asia", date: "28 mai",
      rationale: "É a credencial mais rara e aspiracional do canal. Concentra a narrativa em vez de pulverizar entre temas.",
      context: "O canal mistura viagem, IA, games e código. Sem um eixo, cada vídeo recomeça do zero e a audiência não sabe o que esperar. A saída do Brasil rumo à Ásia como dev nômade é algo que a maioria dos brasileiros não pode fazer — escassez geográfica + aspiração. É a âncora natural do trimestre.",
      consequences: [
        "Todo roteiro do trimestre precisa amarrar no arco Brasil → Ásia, mesmo os de IA/código.",
        "O gancho é sempre o presente contínuo (‘estou indo’, ‘larguei tudo’) — nunca ‘moro lá’.",
        "Pilares fora do arco (games, NAS) entram como apoio, não como vídeo-âncora.",
      ],
      metric: "Retenção média ≥ 45% nos vídeos do arco",
      revisit: "Fim de ago 2026",
      from: ["r-custo"], drives: ["Roteiros", "Newsletter", "Thumbnails"],
      history: [
        { label: "Decidido", date: "28 mai", note: "Confirmado por você a partir da pesquisa de custo de vida." },
        { label: "Proposto", date: "27 mai", note: "Cowork sugeriu a partir de 3 pesquisas de Ásia." },
      ],
    },
    {
      id: "d-formato", statement: "Testar ‘caixa de reação’ × ‘nome do lugar gigante’ em 3 vídeos.",
      horizon: "agora", status: "testando", tema: "canal", date: "30 mai",
      rationale: "São os dois formatos de texto da Lei. O público decide pela retenção — testar nunca a DNA, só o gancho.",
      context: "A Lei da Thumbnail fixa a DNA (rosto, passaporte, laranja, voz, estrangeiro), mas deixa o formato do texto em aberto entre dois caminhos. Em vez de escolher no achismo, rodar um teste A/B honesto: mesma DNA, gancho diferente, o público decide pela retenção.",
      consequences: [
        "3 vídeos seguidos saem com as duas variantes via YouTube Test & Compare.",
        "Só o formato do texto muda — a DNA permanece idêntica nas duas.",
        "A vencedora vira padrão; a perdedora é arquivada com o aprendizado registrado.",
      ],
      metric: "CTR e retenção dos 30s iniciais nas 3 duplas",
      revisit: "Após o 3º vídeo (meados jun)",
      from: ["r-thumb"], drives: ["Thumbnails"],
      history: [
        { label: "Testando", date: "30 mai", note: "Primeiro par no ar." },
        { label: "Decidido", date: "29 mai", note: "Você aprovou rodar o teste." },
      ],
    },
    {
      id: "d-preco", statement: "Todo vídeo de viagem mostra o contraste de preço em dólar.",
      horizon: "agora", status: "decidido", tema: "grana", date: "29 mai",
      rationale: "O número que dói é o gancho universal. Liga viagem a grana sem esforço.",
      context: "Preço em dólar contra o salário CLT médio do Brasil é o número que toda audiência sente. Funciona como ponte entre o pilar viagem e o pilar grana sem precisar de transição forçada — o contraste já carrega a tensão.",
      consequences: [
        "Aluguel + comida sempre aparecem em dólar, com o comparativo Brasil na tela.",
        "O número-âncora entra na thumb quando for o gancho mais forte do vídeo.",
        "Evitar números redondos demais — a precisão é o que dá credibilidade.",
      ],
      metric: "Aparição do contraste em 100% dos vídeos de viagem",
      revisit: "Fim de ago 2026",
      from: ["r-custo"], drives: ["Roteiros"],
      history: [
        { label: "Decidido", date: "29 mai", note: "Confirmado a partir da pesquisa de custo de vida." },
      ],
    },
    {
      id: "d-news", statement: "Newsletter quinzenal agora, semanal quando o banco de pesquisa girar.",
      horizon: "proximo", status: "revisar", tema: "canal", date: "01 jun",
      rationale: "Semanal sem pesquisa alimentando vira tarefa e morre. Escalar cadência depois.",
      context: "A newsletter é a memória do canal, mas só sustenta cadência se houver banco de pesquisa girando. Começar semanal sem lastro vira obrigação e morre em um mês. Quinzenal protege a qualidade até o fluxo de pesquisa justificar acelerar.",
      consequences: [
        "Envio quinzenal fixo até o banco de pesquisa sustentar semanal.",
        "PT e EN separados por canal/idioma — confirma a audiência, não dilui.",
        "Reavaliar a cadência quando houver ≥ 4 pesquisas frescas por mês.",
      ],
      metric: "Taxa de abertura ≥ 40% antes de acelerar",
      revisit: "Set 2026",
      from: ["r-news"], drives: ["Newsletter"],
      history: [
        { label: "Revisar", date: "01 jun", note: "Aguardando o banco de pesquisa encher para decidir cadência." },
      ],
    },
    {
      id: "d-games", statement: "Rodar 1 piloto da série Games ao vivo (MMR → MRR) para validar retenção.",
      horizon: "explorar", status: "revisar", tema: "games", date: "02 jun",
      rationale: "Aposta de pilar. Só vira série recorrente se a retenção do piloto justificar.",
      context: "O arco-assinatura ‘o jogo mudou — de MMR pra MRR’ liga o pedigree gamer (top 1 BR) à narrativa de monetização. Tem potencial de série, mas é aposta: roda 1 piloto ao vivo e deixa a retenção decidir antes de virar formato recorrente.",
      consequences: [
        "1 piloto ao vivo gravado, sem compromisso de série ainda.",
        "Usar o pedigree como credencial de escassez, nunca como nostalgia.",
        "Só vira série se a retenção do piloto bater a média do canal.",
      ],
      metric: "Retenção do piloto ≥ média do canal",
      revisit: "Após o piloto",
      from: ["r-mmr"], drives: ["Roteiros"],
      history: [
        { label: "Revisar", date: "02 jun", note: "Aposta de pilar aguardando piloto." },
      ],
    },
  ];

  window.RESEARCH = { TEMAS, STATUS, SOURCE, HORIZONS, DECISION_STATUS, FOCO_STATE, FOCOS, PESQUISAS, DECISOES };
})();
