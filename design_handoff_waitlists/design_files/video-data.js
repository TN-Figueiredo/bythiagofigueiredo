/* ============================================================
   VIDEO MODULE DATA  (was "Pipeline")
   A video lives as: Ideia (a direction/seed) → Roteiro (the
   script you read) → Gravação (the printable sheet) → Publicado.
   Script grammar (per beat.script item):
     { t:'line', text, key? }   spoken line. **word** = emphasis.
     { t:'pause', s }           a breath, in seconds.
     { t:'dir',  text }         tone/performance note (talent layer).
     { t:'vis',  text }         visual cue (editor layer).
     { t:'ed',   text }         note for the editor (editor layer).
   ============================================================ */
window.VIDEO_DATA = (function () {
  const channels = {
    pt: { name: "tnFigueiredo",       flag: "🇧🇷", label: "PT-BR" },
    en: { name: "Thiago Figueiredo",  flag: "🇺🇸", label: "EN" },
  };

  const pillars = [
    { id: "viagem", label: "Viagem", color: "#22b8d6" },
    { id: "ia",     label: "IA",     color: "#8b8cf6" },
    { id: "codigo", label: "Código", color: "#fb7a52" },
    { id: "games",  label: "Games",  color: "#f43f5e" },
    { id: "nas",    label: "NAS",    color: "#22c55e" },
  ];

  const stages = [
    { id: "ideia",     label: "Ideia",     color: "#8b8cf6" },
    { id: "roteiro",   label: "Roteiro",   color: "#22b8d6" },
    { id: "gravacao",  label: "Gravação",  color: "#f59e0b" },
    { id: "publicado", label: "Publicado", color: "#22c55e" },
  ];

  /* ---- HERO: Canadá → Brasil → Ásia (PT script, EN addable) ---- */
  const heroPT = {
    title: "Morei 4 Anos no Canadá, Voltei pro Brasil — Agora Vou pra Ásia",
    // the seed/direction the Ideia stage shows
    direction:
      "A transição Brasil → Ásia contada como decisão, não como sorte. Três movimentos (Canadá, volta ao Brasil, Ásia) que parecem loucos isolados mas formam uma estratégia. O gancho honesto: 'estou indo', nunca 'moro lá'.",
    siblings: [
      "Por que larguei um salário em dólar no Canadá (e não me arrependo)",
      "O plano de 3 movimentos pra virar dev nômade na Ásia",
    ],
    logline:
      "Um dev brasileiro explica por que trocou a estabilidade do Canadá pela aposta da Ásia — e mostra o plano que está seguindo.",
    pillar: "viagem",
    angles: "A1 · A2 · A5",
    framework: "McKee — Arco Dramático",
    duration: "16–19 min",
    location: "Ubatuba",
    recorded: "23 abr 2026",
    beats: [
      {
        name: "Hook",
        dur: 26,
        tone: "Calmo, próximo, sem drama. Conversando com um amigo, não palestrando.",
        script: [
          { t: "vis", text: "Montage 3s: foto Canadá (neve) → Brasil → Sudeste Asiático. Corta pra talking head. (Lean: abrir direto no rosto.)" },
          { t: "line", text: "Eu morei **quatro anos** no Canadá. Emprego bom. Salário **em dólar**. Vida estável." },
          { t: "pause", s: 0.5 },
          { t: "line", text: "Decidi **voltar pro Brasil**." },
          { t: "pause", s: 0.5 },
          { t: "line", text: "E agora tô me preparando pra me mudar pra **Ásia**." },
          { t: "line", text: "Olhando de fora, cada uma dessas decisões parece loucura. Larguei estabilidade duas vezes." },
          { t: "line", text: "Mas cada uma delas foi proposital. E nesse vídeo eu vou te contar **por quê** — e te mostrar exatamente o plano que eu tô seguindo pra fazer isso acontecer.", key: true },
          { t: "ed", text: "Não falar: promessa dupla + por que cada decisão + plano pra Ásia. Credencial implícita em 'quatro anos no Canadá'." },
        ],
      },
      {
        name: "As Duas Malas",
        dur: 95,
        tone: "Nostálgico, mas concreto. Coloca o espectador na cena de 2017.",
        script: [
          { t: "vis", text: "B-roll fotos Canadá, Ken Burns. Lower third: 'Agosto 2017 · Toronto'." },
          { t: "line", text: "Em agosto de 2017, eu desembarquei em Toronto com **duas malas** e um visto de estudante." },
          { t: "line", text: "Não conhecia ninguém. Não tinha emprego. Meu inglês era ok, mas longe de fluente." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Os primeiros meses foram os mais difíceis da minha vida. Eu lavava prato, estudava de madrugada e mandava currículo de manhã." },
          { t: "line", text: "Teve semana que eu comi miojo cinco dias seguidos pra economizar pra passagem de metrô." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Mas eu tinha um plano claro: estudar, entrar em tech, e construir uma vida lá fora — custasse o que custasse." },
          { t: "line", text: "E eu lembro de pensar, naquele frio de menos quinze: se eu aguentar isso, eu aguento qualquer coisa." },
          { t: "ed", text: "Empatia: mostrar o grind real, sem romantizar. O frio e o miojo são detalhes que prendem." },
        ],
      },
      {
        name: "O Grind Invisível",
        dur: 120,
        tone: "Pragmático, ritmo conversacional. É a base que dá autoridade pro resto.",
        script: [
          { t: "vis", text: "B-roll: coding, sala de aula, primeiro crachá. Speed 103–105% no talking head." },
          { t: "line", text: "O primeiro ano inteiro foi estudar. College de programação de dia, trabalho braçal de noite." },
          { t: "line", text: "Eu não tinha o luxo de só estudar. Cada mês eu precisava fechar a conta, em dólar, numa cidade cara." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Em março de 2019 eu consegui o primeiro emprego de dev. Júnior, salário modesto pra Toronto, mas era **dentro da área**.", key: true },
          { t: "line", text: "E aí o jogo virou. Porque eu já vinha de uma mentalidade competitiva — eu fui **top 1 do Brasil** no Dota anos antes." },
          { t: "line", text: "A mesma coisa que me fazia treinar dez horas por dia num jogo, eu apontei pra carreira." },
          { t: "pause", s: 0.5 },
          { t: "line", text: "Em dois anos eu saltei de júnior pra pleno, depois pra sênior. Troquei de empresa, dobrei o salário." },
          { t: "line", text: "No fim de 2021 eu era dev sênior numa startup, ganhando bem, morando num apê legal em **downtown Toronto**." },
          { t: "line", text: "No papel, eu tinha vencido. Era exatamente a vida que eu tinha desenhado quando desci do avião com as duas malas." },
          { t: "ed", text: "Plantar o arco gamer→builder (MMR→MRR) aqui, sutil. Vai ser pago lá na frente." },
        ],
      },
      {
        name: "O Conforto Perigoso",
        dur: 92,
        tone: "Mais íntimo, reflexivo. Pausa depois da frase-chave.",
        script: [
          { t: "vis", text: "Talking head fechado, luz mais quente. Menos b-roll — é o beat emocional." },
          { t: "line", text: "Só que tinha uma coisa que não encaixava. E demorou pra eu admitir." },
          { t: "pause", s: 0.5 },
          { t: "line", text: "Eu tava **confortável**. E conforto, pra mim, é o sinal mais perigoso de que você parou de crescer.", key: true },
          { t: "pause", s: 0.8 },
          { t: "line", text: "Eu acordava, fazia o mesmo trajeto, resolvia os mesmos tipos de problema, recebia o mesmo depósito." },
          { t: "line", text: "Era bom. Era seguro. E era exatamente por isso que me incomodava." },
          { t: "line", text: "Porque eu não tinha cruzado um oceano e comido miojo cinco dias por semana pra chegar no **piloto automático**." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Eu tinha virado funcionário de um sonho que já não era mais o meu." },
          { t: "ed", text: "Esse é o coração emocional. Reduzir corte, deixar respirar. É o 'porquê' real antes do 'o quê'." },
        ],
      },
      {
        name: "A Decisão Contrarian",
        dur: 100,
        tone: "Intensidade sobe. Convicção, não arrogância. Olho na câmera nos pontos-chave.",
        script: [
          { t: "vis", text: "Mix talking head + b-roll. Lower third: 'Dezembro 2021 · Pedido de demissão'." },
          { t: "line", text: "A maioria das pessoas no meu lugar teria ficado. Emprego estável, caminho pra residência permanente, vida resolvida." },
          { t: "pause", s: 0.5 },
          { t: "line", text: "Eu **pedi demissão**.", key: true },
          { t: "pause", s: 1.0 },
          { t: "line", text: "Meus amigos acharam que eu tinha enlouquecido. 'Você vai largar dólar pra voltar pro Brasil? Na crise?'" },
          { t: "line", text: "E eu entendo. No papel, é o movimento errado. Você não troca o primeiro mundo pelo terceiro." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Mas eu não tava voltando porque o Canadá era ruim. O Canadá foi a melhor escola da minha vida." },
          { t: "line", text: "Eu tava voltando porque o Brasil tinha uma coisa que o Canadá não podia me dar.", key: true },
          { t: "ed", text: "Segurar a revelação (escala+custo) pro próximo beat. Tensão = retenção." },
        ],
      },
      {
        name: "Por Que o Brasil",
        dur: 108,
        tone: "Didático, mas com energia. Aqui entra a lógica que justifica a loucura.",
        script: [
          { t: "vis", text: "Motion graphic simples: gráfico custo de vida Toronto × São Paulo. Não exagerar no design." },
          { t: "line", text: "No Canadá, eu era **um** dev numa startup. Eu ajudava a construir o sonho de outra pessoa." },
          { t: "line", text: "No Brasil, com o que eu aprendi lá fora, eu podia ser o cara que **monta** a startup.", key: true },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Pensa na matemática. Pra viver bem em Toronto, eu precisava de uns oito, dez mil dólares por mês." },
          { t: "line", text: "No Brasil, com **mil dólares** por mês eu vivo tranquilo. Com três, eu vivo muito bem." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Então cada dólar que eu faturo rendendo em cliente lá fora vale **muito mais** vivendo aqui.", key: true },
          { t: "line", text: "Produto, tech, inglês, network, a mentalidade de quem competiu no alto nível — tudo isso virou vantagem competitiva." },
          { t: "line", text: "Eu não tava descendo de nível. Eu tava pegando uma vantagem de câmbio e jogando ela a meu favor." },
          { t: "ed", text: "O contraste de preço é a isca-mãe do canal. Número que dói, sempre honesto." },
        ],
      },
      {
        name: "Do Zero, De Novo",
        dur: 112,
        tone: "Energia alta, ritmo acelerado. Mostrar resultados sem se gabar.",
        script: [
          { t: "vis", text: "B-roll São Paulo, co-working, praia, telas de código. Cortes mais rápidos." },
          { t: "line", text: "Voltei pro Brasil em março de 2022. E adivinha: comecei **do zero** de novo." },
          { t: "line", text: "Primeiro mês: **zero** de receita. Segundo mês: um freela pequeno. Terceiro: dois clientes." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Mas a diferença é que dessa vez eu não tava aprendendo do zero. Eu tava aplicando quatro anos de Canadá num lugar onde eles valiam o dobro." },
          { t: "line", text: "Em um ano eu tinha uma empresa, um time pequeno e distribuído, e projetos que no Canadá levariam **cinco anos** pra conseguir." },
          { t: "pause", s: 0.5 },
          { t: "line", text: "E aqui que a peça final caiu. O jogo tinha mudado de novo — de **MMR pra MRR**.", key: true },
          { t: "line", text: "A mesma obsessão por ranking que me fez top 1 no Dota, agora media receita recorrente em vez de pontos." },
          { t: "line", text: "Mesma pessoa, mesmo instinto competitivo, placar diferente." },
          { t: "ed", text: "Pagamento do arco gamer→builder. Essa é a frase-assinatura do canal." },
        ],
      },
      {
        name: "O Número Que Dói",
        dur: 104,
        tone: "Provocativo no bom sentido. Aqui é o contraste que prende quem pensa em sair do Brasil.",
        script: [
          { t: "vis", text: "Frames nítidos da Ásia: skyline, metrô, placa em escrita não-latina, comida de rua. A cena é a estrela." },
          { t: "line", text: "Aí eu olhei pro mapa e fiz uma pergunta perigosa: por que parar aqui?" },
          { t: "line", text: "Se o time é remoto, se o cliente é global, se a receita é em dólar — por que eu preciso ficar num lugar só?" },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Eu comecei a pesquisar o Sudeste Asiático. E os números me assustaram, no bom sentido." },
          { t: "line", text: "Em algumas cidades da Tailândia ou do Vietnã, você vive **muito** bem com o que um café da manhã custa numa capital ocidental." },
          { t: "line", text: "Internet rápida, comida incrível, comunidade de gente do mundo inteiro construindo coisa — e um custo que, com receita em dólar, é quase risível.", key: true },
          { t: "pause", s: 0.4 },
          { t: "line", text: "É o mesmo movimento do Brasil, levado mais longe. Arbitragem de câmbio, só que com o mundo todo como opção." },
          { t: "line", text: "E sendo bem honesto com você: a maioria dos brasileiros **não pode** fazer isso. Eu cheguei nessa posição depois de anos de grind. Não é sorte, é sequência." },
          { t: "ed", text: "DNA: escassez + aspiração. Honesto, sem clickbait. NÃO dizer 'moro lá' — eu ainda tô no Brasil." },
        ],
      },
      {
        name: "Por Que Ásia, Por Que Agora",
        dur: 96,
        tone: "Firme, estratégico. Conecta os três movimentos numa coisa só.",
        script: [
          { t: "vis", text: "Mapa animado simples: Canadá → Brasil → Ásia, com setas. Lower third: 'O terceiro movimento'." },
          { t: "line", text: "Então deixa eu deixar uma coisa clara, porque é importante e é honesto." },
          { t: "line", text: "Eu **ainda moro no Brasil**. Eu não tô te falando de uma vida que eu já tenho — eu tô te mostrando uma decisão que eu tô tomando agora, em tempo real.", key: true },
          { t: "pause", s: 0.5 },
          { t: "line", text: "A Ásia não é férias. Não é fuga. É o **terceiro movimento** de uma estratégia que começou lá em 2017 com duas malas." },
          { t: "line", text: "Canadá me deu a habilidade. Brasil me deu a alavanca. A Ásia é onde eu testo até onde essa alavanca vai." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Primeira parada, provavelmente a Tailândia. Depois, quem sabe Vietnã, Japão, Coreia." },
          { t: "line", text: "Sozinho, com passaporte brasileiro, pela primeira vez. E eu vou documentar **tudo**, antes de morar lá de verdade." },
          { t: "ed", text: "Reforçar a narrativa da TRANSIÇÃO. 'Tô indo', nunca 'moro lá'. Iscas honestas pro pilar viagem." },
        ],
      },
      {
        name: "O Plano Honesto",
        dur: 88,
        tone: "Calmo de novo, gerando confiança. Não vender mágica.",
        script: [
          { t: "vis", text: "Talking head, luz quente. Lista simples na tela com os 3 pilares do plano." },
          { t: "line", text: "Agora, eu não quero romantizar. Esse plano tem três pernas, e nenhuma delas é mágica." },
          { t: "line", text: "Primeira: receita em moeda forte, recorrente, que não depende de eu estar num CEP específico." },
          { t: "line", text: "Segunda: custo de vida baixo de propósito — escolher onde morar como uma decisão financeira, não só emocional." },
          { t: "line", text: "Terceira: documentar o processo, porque ensinar o que eu faço virou parte de como eu faço.", key: true },
          { t: "pause", s: 0.5 },
          { t: "line", text: "Não é 'largue tudo e seja feliz'. É 'construa a alavanca primeiro, depois escolha o lugar'." },
          { t: "line", text: "E é exatamente esse processo, com os números reais, que eu vou abrir aqui no canal nos próximos vídeos." },
          { t: "ed", text: "Anti-clickbait. O honesto é o diferencial. Conectar com o resto da série." },
        ],
      },
      {
        name: "Fechamento + CTA",
        dur: 52,
        tone: "Volta pro tom de amigo. Callback pro hook. Convite, não súplica.",
        script: [
          { t: "vis", text: "Subscribe CTA + QR nos últimos 12s. Card pro próximo vídeo da série." },
          { t: "line", text: "Então: quatro anos no Canadá, uma volta pro Brasil que todo mundo achou loucura, e agora a Ásia." },
          { t: "line", text: "Três decisões que, isoladas, parecem impulsivas. Juntas, são a mesma pessoa seguindo o mesmo plano." },
          { t: "pause", s: 0.4 },
          { t: "line", text: "Se você tá pensando em fazer um movimento parecido — sair, construir longe, apostar em você — fica por aqui.", key: true },
          { t: "line", text: "Porque os próximos vídeos são o passo a passo, com os números na mesa. Te vejo no próximo." },
          { t: "ed", text: "Callback ao hook + gancho de série. Fechar o loop aberto no começo." },
        ],
      },
    ],
  };

  /* ---- SHORT bilingual sample (IA pillar) ---- */
  const aiPT = {
    title: "A IA Não Vai Roubar Seu Emprego — Mas Isso Vai",
    direction: "Recortar o medo da IA com uma virada honesta: o risco real não é a IA, é quem usa IA. Tom de conversa, sem hype.",
    siblings: ["O que eu automatizei no estúdio (e o que mantive humano)"],
    logline: "Por que o pânico com IA mira o alvo errado — e o que de fato muda o jogo pra quem cria.",
    pillar: "ia",
    angles: "A2 · A5",
    framework: "Contrarian + Prova",
    duration: "8–10 min",
    location: "Home",
    recorded: "—",
    beats: [
      {
        name: "Hook",
        dur: 18,
        tone: "Direto, provocativo no bom sentido. Pausa depois da virada.",
        script: [
          { t: "line", text: "Todo mundo tá com medo de que a **IA** roube o emprego dele." },
          { t: "pause", s: 0.6 },
          { t: "line", text: "Eu acho que esse medo tá mirando o **alvo errado**.", key: true },
          { t: "ed", text: "Reaproveitar b-roll de manchetes 'IA vai substituir X'." },
        ],
      },
      {
        name: "A Virada",
        dur: 40,
        tone: "Calmo, construindo o argumento. Olho na câmera na frase-chave.",
        script: [
          { t: "vis", text: "Split screen: alguém parado x alguém usando IA pra entregar 10x." },
          { t: "line", text: "A IA não vai te substituir. Mas uma **pessoa usando IA** pode." },
          { t: "pause", s: 0.5 },
          { t: "line", text: "A diferença não é a ferramenta. É **quem aprende a dirigir** ela primeiro.", key: true },
        ],
      },
    ],
  };
  const aiEN = {
    title: "AI Won't Steal Your Job — But This Will",
    direction: "Same contrarian flip, English-native phrasing. Conversational, no hype.",
    siblings: [],
    logline: "Why the AI panic aims at the wrong target — and what actually changes the game for creators.",
    pillar: "ia",
    angles: "A2 · A5",
    framework: "Contrarian + Proof",
    duration: "8–10 min",
    location: "Home",
    recorded: "—",
    beats: [
      {
        name: "Hook",
        dur: 18,
        tone: "Direct, good-provocative. Beat of silence after the flip.",
        script: [
          { t: "line", text: "Everyone's scared that **AI** is going to take their job." },
          { t: "pause", s: 0.6 },
          { t: "line", text: "I think that fear is aimed at the **wrong target**.", key: true },
          { t: "ed", text: "Reuse b-roll of 'AI will replace X' headlines." },
        ],
      },
      {
        name: "The Flip",
        dur: 40,
        tone: "Calm, building the argument. Eyes to camera on the key line.",
        script: [
          { t: "vis", text: "Split screen: someone idle vs someone shipping 10x with AI." },
          { t: "line", text: "AI won't replace you. But a **person using AI** might." },
          { t: "pause", s: 0.5 },
          { t: "line", text: "The edge isn't the tool. It's **who learns to drive it** first.", key: true },
        ],
      },
    ],
  };

  /* ---- lighter entries to populate the board ---- */
  const seedDota = {
    title: "De Top 1 do Brasil no Dota a Programador",
    direction: "Ligar o pedigree gamer (top 1 BR) ao arco builder. O 'jogo mudou — de MMR pra MRR'. Credencial rara + virada.",
    siblings: [
      "O que o Dota me ensinou que a faculdade não ensinou",
      "Larguei o competitivo no auge — e por quê",
    ],
    logline: "Do topo do ranking de Dota ao código: o que transfere, o que não, e por que a mentalidade competitiva virou vantagem.",
    pillar: "games",
    angles: "A1 · A2",
    framework: "McKee",
    duration: "10–12 min",
    location: "Home",
    recorded: "—",
    beats: [],
  };
  const seedNas = {
    title: "Montei um Servidor em Casa pra Fugir da Nuvem",
    direction: "NAS caseiro como manifesto de soberania de dados, sem virar tutorial chato. O gancho é o 'porquê', não o 'como'.",
    siblings: ["Quanto custa parar de pagar nuvem pra sempre"],
    logline: "Por que montei meu próprio servidor — privacidade, custo e o prazer de ter as coisas em casa.",
    pillar: "nas",
    angles: "A5",
    framework: "Behind the Scenes",
    duration: "9–11 min",
    location: "Home",
    recorded: "—",
    beats: [],
  };
  const pubBangkok = {
    title: "Uma Manhã em Bangkok com Passaporte Brasileiro",
    direction: "Dia comum de dev nômade na Tailândia: o contraste de preço Brasil × lá, sem clickbait. O estrangeiro nítido na cena.",
    siblings: [],
    logline: "Como é viver uma manhã de trabalho remoto em Bangkok — em dólar, sozinho, com passaporte brasileiro.",
    pillar: "viagem",
    angles: "A1 · A5",
    framework: "Day-in-the-life",
    duration: "12–14 min",
    location: "Bangkok",
    recorded: "12 mai 2026",
    beats: [],
  };

  /* ---- channel DNA the editor always follows (from the real brief) ---- */
  const editorDefaults = {
    editor: "Khiem Nguyen",
    turnaround: "48h por rodada",
    deadline: "5 dias após receber o footage",
    drive: "YouTube/ · B-roll por local, scripts e QR em /Resources",
    energy: "Storytelling cinematográfico, calma confiante — não vlog-rápido, não corporativo-lento. Pessoal e aterrado.",
    references: ["Einerd TV", "Manosphere Highlights Daily"],
    style: [
      { k: "Zoom & reframe", v: "Alterna wide/tight com zoom digital no 4K. Punch-in nos momentos emocionais, pull-back nas transições." },
      { k: "Ritmo de corte", v: "Nenhum plano estático > 8–10s. Jump cuts nos monólogos. B-roll a cada 20–30s no storytelling." },
      { k: "Speed ramp", v: "Talking head 1.05–1.15x. B-roll 2–4x em montagem; slow-mo nos reveals cinematográficos." },
      { k: "Sound design", v: "Whoosh nas transições · pop em textos/lower-thirds/QR · bass hit nos reveals · typing quando falo de código. Natural, não meme edit." },
      { k: "Música", v: "Atmosférica, sempre sob a voz. Beats iniciais reflexivo · meio quente/emocional · final uplifting." },
      { k: "Texto na tela", v: "Stats-chave (ex.: 'em dólar, gasta em real'). Máx 5–7 palavras, fonte limpa e moderna." },
    ],
    ctas: {
      note: "O QR da newsletter é DIFERENTE por idioma — confira antes de finalizar.",
      rows: [
        { k: "Newsletter QR", pt: "QR PT · /Resources/Newsletters/PT-BR", en: "QR EN · /Resources/Newsletters/EN" },
        { k: "Cross-promo", pt: "Sim — cita o canal EN (Beat 2)", en: "Sem cross-promo" },
        { k: "Instagram", pt: "@thiagonfigueiredo", en: "@thiagonfigueiredo" },
      ],
      display: "Mostrar o QR quando eu cito a newsletter (payoff) · ~5–8s · canto inferior direito · pop-in sutil.",
    },
  };

  /* ---- A/B: every video ships with 4 thumbs + titles (YouTube Test & Compare) ---- */
  const heroAB = {
    leader: "A",
    variants: [
      { id: "A", tag: "original", title: "Morei 4 Anos no Canadá, Voltei pro Brasil — Agora Vou pra Ásia", thumb: "rosto + bandeiras (atual)" },
      { id: "B", title: "Larguei um Salário em Dólar pra Voltar pro Brasil", thumb: "reação no preço, olhar pro lado" },
      { id: "C", title: "O Plano de 3 Movimentos pra Virar Dev Nômade", thumb: "mapa Brasil → Ásia" },
      { id: "D", title: "Por Que Saí do Canadá no Auge da Carreira", thumb: "rosto sério, skyline Toronto" },
    ],
  };
  const bangkokAB = {
    leader: "A",
    variants: [
      { id: "A", tag: "original", title: "Uma Manhã em Bangkok com Passaporte Brasileiro", thumb: "rua Sukhumvit, placa em tailandês" },
      { id: "B", title: "O Que R$20 Compram numa Manhã em Bangkok", thumb: "comida de rua + preço" },
      { id: "C", title: "Trabalho Remoto em Bangkok: Um Dia Real", thumb: "laptop no café, skyline" },
      { id: "D", title: "Sozinho em Bangkok com Passaporte Brasileiro", thumb: "rosto + metrô lotado" },
    ],
  };

  const videos = [
    { code: "VID-014", stage: "roteiro",   pillar: "viagem", primary: "pt", versions: { pt: { ...heroPT, ab: heroAB }, en: null }, updated: "há 2 h" },
    { code: "VID-021", stage: "roteiro",   pillar: "ia",     primary: "pt", versions: { pt: aiPT, en: aiEN },   updated: "ontem" },
    { code: "VID-022", stage: "ideia",     pillar: "games",  primary: "pt", versions: { pt: seedDota, en: null }, updated: "há 3 dias" },
    { code: "VID-023", stage: "ideia",     pillar: "nas",    primary: "pt", versions: { pt: seedNas, en: null },  updated: "há 5 dias" },
    { code: "VID-009", stage: "gravacao",  pillar: "viagem", primary: "pt", versions: { pt: { ...pubBangkok, ab: bangkokAB }, en: null }, updated: "há 6 dias" },
    { code: "VID-002", stage: "publicado", pillar: "viagem", primary: "pt", versions: { pt: { ...pubBangkok, title: "Larguei Tudo pra Virar Dev Nômade — Antes de Morar Lá", recorded: "2 mai 2026", ab: { ...bangkokAB, leader: "C" } }, en: null }, updated: "há 2 semanas" },
  ];

  return { channels, pillars, stages, videos, editorDefaults };
})();
