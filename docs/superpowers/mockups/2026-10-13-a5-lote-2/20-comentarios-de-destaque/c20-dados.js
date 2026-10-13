/* c20-dados.js: dados de EXEMPLO do mockup 20 (comentários de destaque). Nomes, números e textos inventados; nada é dado real do dono.
   Hoje = 13/10/2026 (L.HOJE). Vídeo publicado em 06/10: marcos de 1 dia (07/10), 7 dias (13/10, hoje) e 30 dias (05/11, "fecha").
   Cada comentário: g = motivo (c mais curtido, k com o criador, a canal acompanhado, g canal grande); l = curtidas [1 dia, 7 dias, 30 dias] (null = fora dos 12 daquele dia / ainda não existe);
   resp = o criador respondeu: 'sim' | 'nao' (vimos todas as respostas, nenhuma dele) | 'ns' (não sabemos: vieram só parte das respostas) | 'proprio' (o comentário é do criador) | null (sem respostas).
   au = autor: { t: 'ident' | 'criador' | 'acomp' | 'grande' | 'espectador', n: nome, foto: 'ok' | 'quebrada' }. A data "identidade guardada até" NÃO é digitada: c20.js a deriva (primeira idade em que o comentário foi guardado + 28 dias).
   pub = dia do comentário (dd/mm). Regra de coerência (conferida por c20.js em window.C20_AUDITORIA): comentário guardado no dia 1 foi publicado até o marco de 1 dia; quem entrou só no dia 7 foi publicado depois dele; nenhuma curtida de comentário passa as curtidas do vídeo; "ns" só com mais de 5 respostas.
   Escala: as curtidas dos comentários são ~10% das do vídeo de exemplo (um comentário não tem mais curtidas que o vídeo). */
(function(){
  'use strict';
  var D = window.C20 = {};
  D.HOJE = '2026-10-13';
  D.COLETA = '2026-10-06';          /* dia em que a coleta de comentários começou: nenhuma idade existe antes disso */
  D.HOJE_FUT = '2027-01-12';        /* "hoje" dos exemplos da página do canal que precisam de vídeos com 30 dias fechados (a coleta só tem 7 dias em 13/10) */

  D.CANAL = { nome: 'Leo', insc: '6,2 mil' };
  D.VIDEO = { t: 'Mochilão no Vietnã: o que eu faria diferente', pub: '2026-10-06', views: '21 mil', likes: '1,9 mil', com: '1.240', dur: '14:20' };
  D.VIDEO_PEQUENO = { t: 'Pho em Hanói: cinco barracas, cinco preços', pub: '2026-10-06', views: '2,3 mil', likes: '214', com: '37', dur: '08:05' };
  D.VIDEO_NOVO = { t: 'Três erros que eu cometi em Hué', pub: '2026-10-10', views: '3,1 mil', likes: '260', com: '92', dur: '09:12',
    /* comentários feitos DEPOIS do retrato de 1 dia (11/10) e que não estão entre os 12 guardados: de 12/10 a 13/10. O total do retrato de 1 dia é 92 - 21 = 71 (derivado em c20.js, nunca digitado) */
    fora: { 1: 21 } };
  D.VIDEO_ZERO = { t: 'Bastidores: o que ficou fora do roteiro', pub: '2026-10-06', views: '412', likes: '9', com: '0', dur: '03:40' };
  D.VIDEO_ANTES = { t: 'Hanói de trem: a viagem de 30 horas', pub: '2026-08-20', views: '9,4 mil', likes: '810', com: '286', dur: '11:48' };

  /* texto longo: 2.000 caracteres, cortado, com um endereço sem espaços para provar a quebra a 390 px */
  var P = 'Fiz o roteiro inteiro em março e queria deixar registrado o que mudou desde então, porque muita gente vai se basear neste vídeo. O visto, o chip de celular e o transporte entre as cidades mudaram de preço, e a pensão do bairro antigo dobrou. Anotei tudo numa planilha que está em https://exemplo.example/planilhas/vietna-2026/roteiro-completo-com-todas-as-paradas-e-precos-atualizados-em-outubro-de-dois-mil-e-vinte-e-seis/versao-final-v7 para quem quiser copiar. ';
  var LONGO = ''; while (LONGO.length < 2000) LONGO += P;
  LONGO = LONGO.slice(0, 2000);
  D.LONGO_N = LONGO.length;

  var T = {
    hanoi: 'Morei 3 meses em Hanói e o item 4 é a mais pura verdade: o trânsito parece caos, mas tem uma lógica. Quem for, alugue a moto só depois da primeira semana, e leve o capacete de casa, porque o de lá não protege nada.',
    proprio: 'Obrigado por assistir! A planilha de custos está no primeiro link da descrição, com cada centavo anotado. Se algum preço mudou desde a gravação, me avisa aqui que eu atualizo.',
    visto: 'Alguém sabe se o visto eletrônico de 90 dias já está valendo para brasileiros? Vou em novembro e não achei nada oficial.',
    respVisto: 'Está sim. Entrei em setembro com o de 90 dias, o processo levou 3 dias úteis e custou 25 dólares. Só use o site do governo.',
    ingles: 'Subscribed after the Ha Giang loop part. The bit about the homestay price was gold, we saved at least 40 dollars a night.',
    ofensivo: 'Que vídeo lixo. Esse cara não sabe porra nenhuma de Vietnã, só repete o que leu em blog. Desinstala e vai trabalhar.',
    espanhol: 'En Hanói el truco es pedir el precio antes de sentarte. Funciona en todos los puestos y nadie se ofende.',
    seguro: 'Quanto você pagou de seguro viagem? Fiquei na dúvida entre as duas opções que você mostrou aos 6 minutos.',
    respSeguro: 'Paguei 41 dólares por 30 dias, com cobertura de moto. A outra era mais barata, mas não cobria acidente de scooter.',
    emoji: '🔥🔥🔥 melhor vídeo de viagem do mês 🇻🇳❤️🛵👏🏽 só falta o episódio de Da Nang 🙏',
    arabe: 'فيديو رائع، شكراً على النصائح المفيدة حول الأسعار في هانوي. سأسافر الشهر القادم إن شاء الله',
    golpe: 'GANHE R$ 500 POR DIA trabalhando de casa, sem experiência. Veja como em www.ganhe-rapido.example/vip e chame no zap, vagas limitadas',
    japones: 'ベトナムに行きたくなりました。ハノイの屋台のお金の話がとても参考になりました。',
    grande: 'Esse roteiro de Ha Giang é o melhor que vi em português. Parabéns, Leo, vou indicar para quem pergunta lá no meu canal.',
    acomp: 'Concordo com a parte do visto. Fiz igual em setembro e deu certo, só atenção ao prazo de entrada.',
    custo: 'No começo achei exagero, mas o custo de 38 dólares por dia bate com o que gastei na semana passada em Hanói.',
    bomvideo: 'Bom vídeo, continua assim!',
    primeiro: 'Primeiro! Quem mais veio pelo Shorts?',
    pergunta: 'Tem desconto para quem compra o roteiro agora ou só no final do mês?',
    /* textos próprios do vídeo "Pho em Hanói" (completo) e do vídeo "Três erros em Hué" (novo): os comentários com resposta do criador aparecem juntos na lista da página do canal e não podem se repetir */
    phoQ: 'Em qual dessas cinco barracas você pagaria de novo? A da esquina da rua do mercado me pareceu cara para o que serviram.',
    phoR: 'A segunda, sem pensar. É a mais simples e a que o pessoal do bairro enche às sete da manhã. A da esquina é só para quem quer foto.',
    phoQ2: 'O preço de 40 mil dong por tigela já é o de turista ou ainda é o preço local?',
    phoR2: 'Ainda é o local. Nas barracas de turista a mesma tigela vai de 70 a 90 mil. Se o preço não está escrito, pergunte antes de sentar.',
    phoQ3: 'Fui na terceira barraca hoje cedo e confirmo: o caldo é o melhor, mas só abre até as dez da manhã e acaba cedo. Quem for depois disso vai encontrar fechado.',
    phoR3: 'Obrigado pelo aviso. Vou fixar o seu comentário para ninguém chegar tarde, e coloco o horário na descrição.',
    hueQ: 'Qual desses três erros custou mais caro para você? Estou montando o orçamento e quero saber onde não economizar.',
    hueR: 'O terceiro: reservei o trem sem conferir o horário e perdi uma diária. Confira sempre o horário no site da estação.',
    hueQ2: 'A cidadela imperial vale o ingresso de manhã ou só no fim da tarde, como você falou?',
    hueR2: 'Vá de manhã, antes das nove: tem menos gente e o calor ainda dá para aguentar. O fim da tarde é para o rio.',
    hueQ3: 'Fiquei na dúvida sobre o segundo erro, o da moto. Dá para alugar com a carteira brasileira ou precisa da internacional?',
    hueR3: 'Precisa da internacional. Sem ela o seguro não cobre nada, e eu aprendi isso do jeito difícil.'
  };
  D.T = T;

  /* o conjunto TÍPICO (o comum): 12 guardados aos 7 dias, nenhum autor de destaque. Ordem = curtidas aos 7 dias, da maior para a menor */
  D.tipico = [
    { id: 1,  g: 'c', t: T.hanoi,    l: [112, 411, null], rep: 62, resp: 'ns',   au: { t: 'ident', n: 'Marina Teles' }, pub: '07/10' },
    { id: 2,  g: 'k', t: T.proprio,  l: [41, 154, null],  rep: 18, resp: 'proprio', au: { t: 'criador' }, pub: '06/10' },
    { id: 3,  g: 'c', t: T.ingles,   l: [null, 90, null],  rep: 4,  resp: 'nao',  au: { t: 'ident', n: 'Jess Parker' }, pub: '11/10', novo: true },
    { id: 4,  g: 'k', t: T.visto,    l: [23, 87, null],   rep: 9,  resp: 'sim',  re: T.respVisto, au: { t: 'ident', n: 'Marcos Antunes' }, pub: '07/10' },
    { id: 5,  g: 'c', t: T.ofensivo, l: [19, 64, null],   rep: 2,  resp: 'nao',  au: { t: 'ident', n: 'Beto Lima', foto: 'quebrada' }, pub: '07/10' },
    { id: 6,  g: 'c', t: T.espanhol, l: [9, 51, null],    rep: 0,  resp: null,   au: { t: 'ident', n: 'Valentina R.' }, pub: '07/10' },
    { id: 7,  g: 'k', t: T.seguro,   l: [null, 39, null],  rep: 6,  resp: 'sim',  re: T.respSeguro, au: { t: 'ident', n: 'Priya Nair' }, pub: '11/10', novo: true },
    { id: 8,  g: 'c', t: T.emoji,    l: [12, 30, null],   rep: 1,  resp: 'nao',  au: { t: 'ident', n: 'Diego M.' }, pub: '07/10' },
    { id: 9,  g: 'c', t: T.arabe,    l: [null, 28, null],  rep: 0,  resp: null,   au: { t: 'ident', n: 'Omar Khalid' }, pub: '12/10', novo: true },
    { id: 10, g: 'c', t: T.golpe,    l: [15, 24, null],   rep: 0,  resp: null,   au: { t: 'ident', n: 'Vagas Online' }, pub: '07/10' },
    { id: 11, g: 'c', t: T.japones,  l: [6, 22, null],    rep: 0,  resp: null,   au: { t: 'ident', n: 'Yuki Tanaka' }, pub: '07/10' },
    { id: 12, g: 'k', t: LONGO,      l: [4, 19, null],    rep: 7,  resp: 'sim',  re: 'Obrigado pelo detalhe. Vou fixar este comentário, ele resume bem o que mudou nos preços.', au: { t: 'ident', n: 'Carla Brandão' }, pub: '07/10', longo: true }
  ];
  /* o que estava nos 12 do dia 1 e saiu até o dia 7 */
  D.saiuTipico = [
    { t: T.bomvideo,   l1: 10, au: 'Rafa Souza' },
    { t: T.primeiro,   l1: 7, au: 'Tati Moura' },
    { t: T.pergunta,   l1: 5, au: 'Léo Campos' }
  ];

  /* o conjunto EXTREMO: os quatro motivos (6 mais curtidos, 4 com o criador, 1 acompanhado, 1 grande) */
  D.extremo = D.tipico.map(function(c){ return JSON.parse(JSON.stringify(c)); });
  (function(){
    var e = D.extremo;
    e[2] = { id: 3, g: 'g', t: T.grande, l: [null, 90, null], rep: 4, resp: 'nao', au: { t: 'grande', n: 'Mundo Afora TV', tam: 3, razao: 3 }, pub: '11/10', novo: true };
    e[5] = { id: 6, g: 'a', t: T.acomp, l: [9, 51, null], rep: 0, resp: null, au: { t: 'acomp', n: 'Nômade Raiz' }, pub: '07/10' };
    e[9] = { id: 10, g: 'c', t: T.golpe, l: [15, 24, null], rep: 0, resp: null, au: { t: 'ident', n: 'Vagas Online' }, pub: '07/10', saiu: '13/10' };
    e[0].resp = 'ns';
  })();

  /* o conjunto do vídeo PEQUENO (todos os comentários do vídeo, 37): mesmos 12, com ~7% das curtidas (o vídeo tem 214); respostas limitadas a 3
     (12 comentários + 21 respostas = 33 dos 37); com 3 respostas o YouTube mostrou todas, então "não sabemos" vira "não vimos" */
  /* curtidas do vídeo pequeno: ~10% das do típico, sem empate no piso (cada posição ganha pelo menos 1 curtida a mais que a de baixo, piso 2), para "Mais curtido" ordenar de verdade.
     O dia 1 nunca passa o dia 7 do mesmo comentário (conferido na auditoria). */
  function ranqueia(arr, f){
    var idx = arr.map(function(x, i){ return i; }).filter(function(i){ return arr[i] != null; }).sort(function(a, b){ return arr[a] - arr[b]; });
    var out = arr.map(function(){ return null; }), prev = 1;
    idx.forEach(function(i){ var v = Math.max(Math.round(arr[i] * f), prev + 1); out[i] = v; prev = v; });
    return out;
  }
  D.completo = D.tipico.map(function(c){ var n = JSON.parse(JSON.stringify(c)); n.rep = Math.min(n.rep, 3); if (n.resp === 'ns' && n.rep <= 5) n.resp = 'nao'; return n; });
  D.saiuCompleto = D.saiuTipico.map(function(s){ return { t: s.t, l1: s.l1, au: s.au }; });
  (function(){
    var l7 = ranqueia(D.completo.map(function(c){ return c.l[1]; }), 0.1);
    var dia1 = D.completo.map(function(c){ return c.l[0]; }).concat(D.saiuCompleto.map(function(s){ return s.l1; }));
    var l1 = ranqueia(dia1, 0.1);
    D.completo.forEach(function(c, i){ c.l = [l1[i] == null ? null : (l7[i] == null ? l1[i] : Math.min(l1[i], l7[i])), l7[i], null]; });
    D.saiuCompleto.forEach(function(s, k){ s.l1 = l1[D.completo.length + k]; });
    /* quem saiu dos 12 não pode ter mais curtidas do que o menor "mais curtido" que ficou (curtida quase não cai): força abaixo do piso dos 7 dias, por código */
    var piso = Math.min.apply(null, D.completo.filter(function(c){ return c.g === 'c'; }).map(function(c){ return c.l[1]; }));
    D.saiuCompleto.forEach(function(s, k){ s.l1 = Math.max(1, piso - 1 - (k === 2 ? 1 : 0)); });
    /* textos do Pho: os 3 comentários em que o criador respondeu */
    var T = D.T;
    [[3, T.phoQ, T.phoR], [6, T.phoQ2, T.phoR2], [11, T.phoQ3, T.phoR3]].forEach(function(x){ var c = D.completo[x[0]]; c.t = x[1]; c.re = x[2]; c.longo = false; });
    /* autores próprios do Pho (não repetem os do Mochilão) e um texto em inglês que fala deste vídeo */
    [[3, 'Ana Beatriz Luz'], [6, 'Kenji Mori'], [11, 'Sofia Lund']].forEach(function(x){ D.completo[x[0]].au = { t: 'ident', n: x[1] }; });
    D.completo[2].t = 'Subscribed after the street food part. The tip about asking the price before sitting down saved us a few dollars a bowl.';
  })();

  /* o conjunto do vídeo NOVO (publicado em 10/10, 92 comentários): só existe o retrato de 1 dia (11/10). Os 12 foram comentados em 10/10 ou 11/10;
     curtidas ~9% das do típico (o vídeo tem 260); respostas limitadas a 6 (12 comentários + 37 respostas = 49 dos 92) */
  var PUB_NOVO = ['10/10', '10/10', '11/10', '10/10', '10/10', '11/10', '11/10', '10/10', '11/10', '10/10', '11/10', '10/10'];
  D.novo = D.tipico.map(function(c, i){
    var n = JSON.parse(JSON.stringify(c));
    n.l = [Math.max(2, Math.round(c.l[1] * 0.09)), null, null]; n.novo = false; n.pub = PUB_NOVO[i]; n.rep = Math.min(c.rep, 6);
    if (i === 0) n.t = n.t.replace('o item 4', 'o item 3');
    return n;
  });
  [[3, D.T.hueQ, D.T.hueR], [6, D.T.hueQ2, D.T.hueR2], [11, D.T.hueQ3, D.T.hueR3]].forEach(function(x){ var c = D.novo[x[0]]; c.t = x[1]; c.re = x[2]; c.longo = false; });
  /* autores e textos próprios do Hué (não repetem os do Mochilão nem os do Pho) */
  [[3, 'Tomás Reis'], [6, 'Helena Vaz'], [11, 'Ravi Sethi']].forEach(function(x){ D.novo[x[0]].au = { t: 'ident', n: x[1] }; });
  D.novo[0].t = 'Estive em Hué em agosto e o erro 2 é a mais pura verdade: a cidade é calma, mas o calor do meio-dia não perdoa. Quem for, deixe os passeios ao ar livre para antes das dez da manhã.';
  D.novo[5].t = 'En Hué el truco es comprar la entrada en la puerta lateral de la ciudadela. Casi nadie hace fila y cuesta lo mismo.';
  D.novo[8].t = 'فيديو رائع، شكراً على النصائح المفيدة حول مدينة هوي. سأسافر الشهر القادم إن شاء الله';
  D.novo[10].t = 'フエに行きたくなりました。三つの失敗の話がとても参考になりました。';
  D.novo[2].t = 'Subscribed after the imperial city part. Going before nine in the morning was the best advice, we had the whole place almost to ourselves.';

  /* ---- página do canal. Os vídeos de que ela fala (título e dia de publicação) e os comentários em que o criador respondeu.
     O estado "com dado" e o "não medido" precisam de vídeos com 30 dias fechados; como a coleta só começou em 06/10, o "hoje" desses dois exemplos é D.HOJE_FUT.
     Nada de contagem é digitada: c20.js conta vídeos, comentários e casas a partir daqui. ---- */
  D.CV = {
    hanoi48: { t: 'Hanói em 48 horas: o roteiro que eu repetiria', pub: '2026-11-20' },
    danang: { t: 'Dez dias em Da Nang sem carro', pub: '2026-11-12' },
    saigon: { t: 'Saigon de moto: onde comer e quanto pagar', pub: '2026-11-05' },
    hoian: { t: 'Hoi An em dois dias sem pressa', pub: '2026-10-28' },
    custo: { t: 'Quanto custou a viagem toda: planilha aberta', pub: '2026-10-17' }
  };
  D.RESPOSTAS = [
    { v: 'hanoi48', d: '2026-11-24', c: 'Dá para fazer o roteiro de 48 horas com criança de 6 anos?', r: 'Dá, mas tire o segundo dia da lista: é muito andar. Eu trocaria pelo lago e pelo museu.', l: 64 },
    { v: 'hanoi48', d: '2026-11-24', c: 'Nos mercados do roteiro dá para pagar no cartão ou só em dinheiro?', r: 'Nos mercados, só dinheiro. Leve dong trocado, as notas pequenas ajudam.', l: 31 },
    { v: 'danang', d: '2026-11-15', c: 'Qual bairro você recomenda para ficar com criança pequena?', r: 'Eu ficaria perto da praia de My Khe, tem mercado e farmácia a pé. Evite a zona do aeroporto.', l: 21 },
    { v: 'saigon', d: '2026-11-09', c: 'A barraca do segundo bairro mudou de endereço, vocês sabiam?', r: 'Não sabíamos, obrigado pelo aviso! Vou conferir na próxima ida e atualizo a descrição.', l: 9 },
    { v: 'hoian', d: '2026-11-01', c: 'A lanterna da foto de capa vende em qual rua? Quero levar de presente.', r: 'É na rua da ponte coberta, segunda barraca à esquerda. Vá cedo, antes das nove.', l: 16 },
    { v: 'custo', d: '2026-10-20', c: 'Você não contou o seguro viagem na planilha, ou ficou de fora de propósito?', r: 'Ficou de fora, erro meu. Já está na versão nova que está na descrição, obrigado!', l: 12 }
  ];
  /* vídeos com 30 dias fechados em que não vimos resposta dele (dia de publicação) */
  D.CANAL_NAO = ['2026-10-15', '2026-10-22', '2026-10-30', '2026-11-03', '2026-11-08', '2026-11-16', '2026-11-23', '2026-11-29', '2026-12-06'];
  /* vídeos recentes, cujos 30 dias ainda não fecharam em D.HOJE_FUT */
  D.CANAL_RECENTES = ['2026-12-15', '2026-12-29', '2027-01-08'];
  /* canal-fecha (hoje real, 13/10): os vídeos de Leo que as telas de vídeo deste mockup mostram e que têm coleta de comentários (a partir de 06/10). m = marco do retrato que existe hoje (7 dias; o vídeo novo só tem o de 1 dia).
     A lista "O que o criador respondeu" sai destes conjuntos por código: o "ele respondeu a N" de cada página de vídeo e a lista do canal são a mesma conta. */
  D.CANAL_FECHA_VIDEOS = [
    { v: D.VIDEO, set: D.tipico, m: 7 },
    { v: D.VIDEO_PEQUENO, set: D.completo, m: 7 },
    { v: D.VIDEO_ZERO, set: [], m: 7 },
    { v: D.VIDEO_NOVO, set: D.novo, m: 1 }
  ];
  /* canal-fecha: vídeos publicados antes da coleta, dentro dos 90 dias e com mais de 30 dias em 06/10 */
  D.CANAL_ANTES = ['2026-07-18', '2026-07-20', '2026-07-27', '2026-08-02', '2026-08-10', '2026-08-15', '2026-08-20', '2026-08-24', '2026-08-25', '2026-08-29', '2026-09-02', '2026-09-05'];
})();
