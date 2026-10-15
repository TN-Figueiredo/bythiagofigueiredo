/* pi-dados.js: dados de EXEMPLO do mockup 22 ("Perguntar a uma IA"). Nomes e números inventados (nada é dado real do dono).
   Cada tela do Observatório que tem modelo de tela entra na lista TELAS (spec 07, 8.1.5: 11 telas). Cada tela diz o que o pacote dela leva:
   nTab = tabelas, alvo = caracteres do pacote com a pergunta vazia (inclui a linha "Minha pergunta:"), med = [medidos, zeros medidos, não medidos] (soma dos números do pacote),
   priv = o que só entra com o direito "ver desempenho privado" (8.1.4), coment = comentários de terceiros (só entram para quem tem o direito ou edita), tabs = as primeiras tabelas (a prévia mostra as duas primeiras).
   var = variações pedidas pelos estados (zero, nm, vazio, extremo, extremo2): sobrepõem os campos da tela. */
(function(){
  'use strict';
  var P = window.PI = {};
  P.HOJE = '13/10/2026'; P.HORA = '14:32'; P.LIMITE = 30000; P.MAXIMO = 200000; P.PERG_MAX = 1000;
  var T = P.TELAS = {};

  T.comparar = {
    id: 'comparar', nome: 'Comparar', titulo: 'Comparar canais', tipo: 'pagina', migalha: [['Canais', '#'], ['Comparar']],
    foco: 'Nômade Raiz (A) × Lucas Bigodinho (B), dois canais concorrentes do nicho Viagem', janela: 'últimos 90 dias · vídeos longos',
    nTab: 7, alvo: 12400, json: 2340, med: [18, 0, 4], recente: '13/10/2026 09:10',
    tabs: [
      { t: 'Direção de cada canal contra ele mesmo', c: ['Medida', 'Nômade Raiz', 'Lucas Bigodinho', 'Base'], r: [
        ['Views dos vídeos novos', '▲ subindo, +18%', '▼ descendo, −24%', 'mediana de 11 e de 9 longos em 90 dias, contra 12 e 10 nos 90 anteriores'],
        ['Longos publicados', '＝ estável, 11 contra 12', '▼ 9 contra 14', 'conta de longos; não mede frequência'] ] },
      { t: 'Desempenho dos vídeos', c: ['Medida', 'Nômade Raiz', 'Lucas Bigodinho', 'Base'], r: [
        ['Mediana de views dos longos', '41,2 mil', '8,4 mil', 'longos publicados em 90 dias'],
        ['Views por dia nos longos', '1.480', '310', 'mediana, desde 03/10'],
        ['Engajamento nos longos', '4,7%', '6,1%', '(curtidas + comentários) ÷ views'],
        ['Views nos primeiros 30 dias', 'não medido', 'não medido', 'nenhum vídeo com 30 dias de contagem; o primeiro fecha em 02/11'] ] } ],
    meio: 'resto da seção 4 (5 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['Qual dos dois está crescendo mais?', 'O que eu ainda não consigo afirmar com estes números?'],
    sumFalta: ''
  };

  T.canais = {
    id: 'canais', nome: 'Canais', titulo: 'Canais acompanhados', tipo: 'obs', aba: 'Canais', migalha: null,
    foco: '7 canais acompanhados, nicho Todos', janela: 'situação de 13/10/2026 · vídeos longos',
    nTab: 3, alvo: 8100, json: 1500, med: [19, 0, 5], recente: '13/10/2026 09:10',
    tabs: [
      { t: 'Canais acompanhados', c: ['Canal', 'Inscritos', 'Direção das views', 'Último vídeo'], r: [
        ['Nômade Raiz', '412 mil', '▲ subindo', '11/10'], ['Lucas Bigodinho', '96,8 mil', '▼ descendo', '09/10'],
        ['Dale Philip', '61,2 mil', '＝ estável', '06/10'], ['Paddy Doyle', '8,4 mil', 'não medido (canal novo)', '12/10'] ] } ],
    meio: 'resto da seção 4 (2 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['Quais canais estão subindo?', 'Qual canal eu devo olhar primeiro?'],
    corte: [['dia a dia de 60 canais', 190000], ['linhas além da 25ª da lista', null]],
    var: {
      extremo2: { rot: 'lista de 60 canais com os números dia a dia de 90 dias de cada um (exemplo extremo)', foco: '60 canais acompanhados, nicho Todos', nTab: 3, alvo: 262400, med: [1480, 12, 96] },
      vazio: { foco: 'nenhum canal acompanhado ainda', nTab: 0, alvo: 1900, json: 120, med: [0, 0, 0], tabs: [], vazio: 'nenhum canal acompanhado ainda', meio: '2. Como ler este pacote e 6. Avisos', sug: [] }
    }
  };

  T.canal = {
    id: 'canal', nome: 'Canal', titulo: 'Nômade Raiz', tipo: 'pagina', migalha: [['Canais', '#'], ['Nômade Raiz']],
    foco: 'Nômade Raiz (concorrente, nicho Viagem, 412 mil inscritos)', janela: 'últimos 90 dias · vídeos longos',
    nTab: 6, alvo: 9800, json: 1900, med: [24, 1, 2], recente: '13/10/2026 09:10',
    tabs: [
      { t: 'Números do canal', c: ['Medida', 'Valor', 'Base'], r: [
        ['Inscritos', '412 mil', 'contagem pública do YouTube, 13/10'], ['Longos publicados em 90 dias', '11', 'conta de longos'],
        ['Mediana de views dos longos', '41,2 mil', 'mediana de 11 longos em 90 dias'], ['Direção das views', '▲ subindo, +18%', '11 longos contra 12 nos 90 anteriores'] ] } ],
    meio: 'resto da seção 4 (5 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['O que este canal publica mais?', 'Há algo nos lançamentos que merece atenção?'],
    var: {
      nm: { foco: 'Paddy Doyle (concorrente, nicho Viagem, acompanhado desde 11/10)', nTab: 6, alvo: 2900, json: 520, med: [2, 0, 14], recente: '13/10/2026 09:10',
        aviso: 'AVISO: quase tudo nesta tela está não medido (2 de 16 números). O canal foi acompanhado há 2 dias. Os motivos estão na seção 4. Não trate “não medido” como zero.',
        tabs: [ { t: 'Números do canal', c: ['Medida', 'Valor', 'Base'], r: [
          ['Inscritos', '8,4 mil', 'contagem pública do YouTube, 13/10'], ['Longos acompanhados', '6', 'limite de 50'],
          ['Mediana de views dos longos', 'não medido', 'só 2 longos em 90 dias; a conta pede 3'],
          ['Direção das views', 'não medido', 'precisa de 3 longos nos dois períodos de 90 dias'],
          ['Views por dia nos longos', 'não medido', 'aguarda o 2º registro do dia'],
          ['Engajamento nos longos', 'não medido', 'só 2 longos em 90 dias; a conta pede 3'] ] } ],
        meio: 'resto da seção 4 (5 tabelas, todas quase só “não medido”), 5. Definições e 6. Avisos' }
    }
  };

  T.video = {
    id: 'video', nome: 'Vídeo', titulo: 'Tailândia em 10 dias: o roteiro completo', tipo: 'pagina', migalha: [['Canais', '#'], ['Nômade Raiz', '#'], ['Tailândia em 10 dias']],
    foco: 'Tailândia em 10 dias: o roteiro completo (Nômade Raiz, publicado em 14/07/2026, vídeo longo)', janela: 'desde a publicação',
    nTab: 4, alvo: 7200, json: 1300, med: [12, 0, 2], recente: '13/10/2026 09:10',
    tabs: [
      { t: 'Números do vídeo', c: ['Medida', 'Valor', 'Base'], r: [
        ['Views', '184 mil', 'última sincronização, 13/10'], ['Curtidas', '9,1 mil', 'idem'], ['Comentários', '412', 'idem'],
        ['Engajamento', '5,3%', '(curtidas + comentários) ÷ views'], ['O normal do canal', '4,5×', 'views ÷ mediana dos outros longos'] ] } ],
    coment: { n: 12, chars: 3100 },
    meio: 'resto da seção 4 (3 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['O que os comentários elogiam e o que criticam?', 'Este vídeo está acima do normal do canal?'],
    amostra: [ '[comentário 1 · 214 curtidas · há 3 dias · texto de terceiros]', '│ O roteiro do terceiro dia salvou minha viagem, sem enrolação.', '[resposta do criador (Nômade Raiz)]', '│ Que bom! Conta depois como foi.' ]
  };

  T.outliers = {
    id: 'outliers', nome: 'Outliers', titulo: 'Outliers', tipo: 'obs', aba: 'Outliers', migalha: null,
    foco: 'vídeos que passaram do normal do canal, 7 canais', janela: 'últimos 30 dias · vídeos longos',
    nTab: 2, alvo: 3900, json: 800, med: [6, 0, 1], recente: '13/10/2026 09:10',
    tabs: [ { t: 'Vídeos com 2× o normal do canal ou mais', c: ['Vídeo', 'Canal', 'Views', 'Vezes o normal'], r: [
      ['Vietnã de moto: custo real', 'Lucas Bigodinho', '88 mil', '3,1×'], ['Bali: o que ninguém conta', 'Dale Philip', '52 mil', '2,4×'] ] } ],
    meio: 'resto da seção 4 (1 tabela), 5. Definições e método e 6. Avisos',
    sug: ['O que estes vídeos têm em comum?', 'Isso muda o que eu devo publicar?'],
    var: {
      zero: { med: [6, 1, 1], nTab: 2, alvo: 3300,
        tabs: [ { t: 'Vídeos com 2× o normal do canal ou mais', c: ['Faixa', 'Vídeos', 'Base'], r: [
          ['2× o normal ou mais', '0 (zero medido)', '38 longos olhados em 7 canais, últimos 30 dias'],
          ['De 1,5× a 2×', '3', 'mesma base'], ['Canais sem 3 longos em 30 dias', 'não medido', 'a conta pede 3 longos no período'] ] } ],
        meio: 'resto da seção 4 (1 tabela), 5. Definições e método e 6. Avisos',
        sumExtra: '0 vídeos passaram de 2× o normal (zero medido)' }
    }
  };

  T.insights = {
    id: 'insights', nome: 'Insights', titulo: 'Insights', tipo: 'obs', aba: 'Insights', migalha: null,
    foco: 'nicho Viagem, 7 canais', janela: 'últimos 90 dias contra os 90 anteriores',
    nTab: 3, alvo: 5600, json: 1100, med: [14, 0, 2], recente: '13/10/2026 09:10',
    tabs: [ { t: 'Direção do nicho', c: ['Direção', 'Canais', 'Base'], r: [
      ['▲ subindo', '3', 'mediana de views dos longos, 90 dias contra 90'], ['＝ estável', '2', 'diferença de até 10%'], ['▼ descendo', '1', 'diferença de 10% ou mais'], ['não medido', '1', 'menos de 3 longos em um dos períodos'] ] } ],
    meio: 'resto da seção 4 (2 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['O nicho está subindo ou descendo?', 'Onde o meu canal está nisso?']
  };

  T.mudancas = {
    id: 'mudancas', nome: 'Mudanças', titulo: 'Mudanças', tipo: 'obs', aba: 'Mudanças', migalha: null,
    foco: 'trocas de título e miniatura dos 7 canais', janela: 'de 06/10 a 13/10/2026',
    nTab: 4, alvo: 9200, json: 1700, med: [14, 2, 1], recente: '13/10/2026 09:10',
    tabs: [ { t: 'Trocas de título e miniatura', c: ['Quando', 'Canal', 'Vídeo', 'O que mudou'], r: [
      ['12/10 18:40', 'Nômade Raiz', 'Tailândia em 10 dias', 'título trocado'], ['11/10 09:12', 'Lucas Bigodinho', 'Vietnã de moto: custo real', 'miniatura trocada'],
      ['10/10 21:05', 'Dale Philip', 'Bali: o que ninguém conta', 'título e miniatura trocados'] ] } ],
    meio: 'resto da seção 4 (3 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['Quem mexeu mais em títulos?', 'O que mudou antes de um vídeo subir?'],
    corte: [['dia a dia de 8 canais', 7300], ['linhas além da 25ª da tabela de trocas', null]],
    var: { extremo: { foco: 'trocas de título e miniatura dos 7 canais', janela: 'de 15/07 a 13/10/2026 (90 dias)', alvo: 41800, med: [212, 9, 4] } }
  };

  T.fila = {
    id: 'fila', nome: 'Saíram do YouTube', titulo: 'Saíram do YouTube', tipo: 'obs', aba: 'fila', migalha: null,
    foco: '2 itens na fila: 1 vídeo e 1 comentário que saíram do YouTube', janela: 'desde 03/10/2026',
    nTab: 2, alvo: 3100, json: 600, med: [8, 1, 0], recente: '13/10/2026 09:10',
    tabs: [ { t: 'Fila', c: ['Item', 'Canal', 'Saiu em', 'Situação'], r: [
      ['Tailândia em 10 dias (vídeo)', 'Nômade Raiz', '03/10', 'aberto, sem decisão'], ['Comentário no vídeo Bali (texto não incluído)', 'Dale Philip', '09/10', 'aberto, sem decisão'] ] } ],
    meio: 'resto da seção 4 (1 tabela), 5. Definições e método e 6. Avisos',
    sug: ['Há algo nesta fila que eu deveria manter?']
  };

  T['canal-proprio'] = {
    id: 'canal-proprio', nome: 'Canal próprio', titulo: 'tnFigueiredo', tipo: 'pagina', migalha: [['Canais', '#'], ['Meu canal: tnFigueiredo']],
    foco: 'tnFigueiredo (seu canal, nicho Viagem)', janela: 'últimos 90 dias · vídeos longos',
    nTab: 8, alvo: 14300, json: 2500, med: [20, 1, 3], recente: '13/10/2026 09:10',
    priv: { n: 3, chars: 7500, med: [6, 1, 1], itens: 'impressões, cliques estimados e % assistido' },
    tabs: [
      { t: 'Números públicos do canal', c: ['Medida', 'Valor', 'Base'], r: [
        ['Inscritos', '3,2 mil', 'contagem pública do YouTube, 13/10'], ['Longos publicados em 90 dias', '4', 'conta de longos'], ['Mediana de views dos longos', '1.120', 'mediana de 4 longos em 90 dias'] ] },
      { t: 'Impressões e cliques estimados (privado do canal)', priv: true, c: ['Medida', 'Valor', 'Base'], r: [
        ['Impressões em 90 dias', '212 mil', 'soma dos dias medidos'], ['Cliques estimados', '9,8 mil', 'impressões × taxa de clique estimada'], ['% assistido (mediana)', '38%', '4 longos em 90 dias'] ] } ],
    meio: 'resto da seção 4 (6 tabelas), 5. Definições e método e 6. Avisos',
    meioSem: 'resto da seção 4 (4 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['O que melhorou nos meus últimos vídeos?', 'O que ainda não dá para medir?']
  };

  T['video-proprio'] = {
    id: 'video-proprio', nome: 'Vídeo próprio', titulo: 'Quanto custa uma semana em Hanói?', tipo: 'pagina', migalha: [['Canais', '#'], ['Meu canal', '#'], ['Quanto custa uma semana em Hanói?']],
    foco: 'Quanto custa uma semana em Hanói? (vídeo seu, publicado em 02/10/2026, vídeo longo)', janela: 'desde a publicação',
    nTab: 6, alvo: 9100, json: 1600, med: [14, 1, 2], recente: '13/10/2026 09:10',
    priv: { n: 2, chars: 2300, med: [3, 1, 1], itens: 'impressões por dia e cliques estimados' },
    coment: { n: 14, chars: 1400 },
    tabs: [
      { t: 'Números públicos do vídeo', c: ['Medida', 'Valor', 'Base'], r: [
        ['Views', '1.248', 'última sincronização, 13/10'], ['Curtidas', '96', 'idem'], ['Comentários', '14', 'idem'] ] },
      { t: 'Impressões e cliques estimados (privado do canal)', priv: true, c: ['Medida', 'Valor', 'Base'], r: [
        ['Impressões', '18,4 mil', 'soma dos 11 dias medidos'], ['Cliques estimados', '1,1 mil', 'impressões × taxa de clique estimada'], ['Dias sem leitura', 'não medido', '2 dias antes de 05/10'] ] } ],
    meio: 'resto da seção 4 (4 tabelas), 5. Definições e método e 6. Avisos',
    meioSem: 'resto da seção 4 (3 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['A miniatura está funcionando?', 'O que os comentários pedem?'],
    amostra: [ '[comentário 1 · 6 curtidas · há 2 dias · texto de terceiros]', '│ Dá para fazer a versão com hostel também?', '[resposta do criador (tnFigueiredo)]', '│ Boa ideia, anotei.' ]
  };

  T.ritmo = {
    id: 'ritmo', nome: 'Ritmo por hora', titulo: 'Ritmo por hora', tipo: 'pagina', migalha: [['Canais', '#'], ['Ritmo por hora']],
    foco: 'tnFigueiredo e 7 concorrentes (tela ainda não existe: números de exemplo)', janela: 'últimos 30 dias de leitura',
    nTab: 3, alvo: 6400, json: 1200, med: [9, 0, 6], recente: '13/10/2026 09:10',
    tabs: [ { t: 'Perfil de 24 horas do nicho', c: ['Faixa', 'Views no 1º dia (mediana)', 'Base'], r: [
      ['18h às 20h', '3,1 mil', '11 longos'], ['20h às 22h', '2,6 mil', '9 longos'], ['12h às 14h', 'não medido', 'só 2 longos nesta faixa; a conta pede 3'] ] } ],
    meio: 'resto da seção 4 (2 tabelas), 5. Definições e método e 6. Avisos',
    sug: ['Qual a melhor faixa de hora para publicar?', 'O que este perfil não consegue dizer?']
  };

  P.ORDEM = ['canais', 'canal', 'video', 'comparar', 'outliers', 'insights', 'mudancas', 'fila', 'canal-proprio', 'video-proprio', 'ritmo'];
  P.ROTULO = { canais: 'Lista de Canais', canal: 'Página do canal', video: 'Página do vídeo', comparar: 'Comparar', outliers: 'Outliers', insights: 'Insights', mudancas: 'Mudanças', fila: 'Saíram do YouTube', 'canal-proprio': 'Canal próprio', 'video-proprio': 'Vídeo próprio', ritmo: 'Ritmo por hora' };

  /* os estados do mockup: cada um traz a tela em que se vê melhor */
  P.ESTADOS = [
    ['tipico', 'Com dado típico', { tela: 'comparar' }],
    ['copiado', 'Copiado', { tela: 'comparar', passo: 'copiado', pergunta: 'Qual dos dois está crescendo mais?' }],
    ['falhou', 'Falhou ao copiar', { tela: 'comparar', passo: 'falhou' }],
    ['extremo', 'Cortado por tamanho (dado extremo)', { tela: 'mudancas', variante: 'extremo' }],
    ['extremo2', 'Passa até do arquivo completo', { tela: 'canais', variante: 'extremo2' }],
    ['zero', 'Zero medido', { tela: 'outliers', variante: 'zero' }],
    ['nm', 'Não medido (canal novo)', { tela: 'canal', variante: 'nm' }],
    ['vazio', 'Vazio (nenhum canal)', { tela: 'canais', variante: 'vazio' }],
    ['privado', 'Com dado privado do canal', { tela: 'video-proprio' }],
    ['leitura', 'Só leitura (sem o direito)', { tela: 'video-proprio', direito: false }],
    ['comentarios', 'Comentários de terceiros', { tela: 'video' }],
    ['erro', 'Erro ao montar o pacote', { tela: 'comparar', passo: 'erro' }],
    ['carregando', 'Montando o pacote', { tela: 'comparar', passo: 'carregando' }],
    ['fechado', 'Tela com o botão (fechado)', { tela: 'comparar', fechado: true }],
    ['mapa', 'Onde fica o botão (11 telas)', { mapa: true }]
  ];
})();
