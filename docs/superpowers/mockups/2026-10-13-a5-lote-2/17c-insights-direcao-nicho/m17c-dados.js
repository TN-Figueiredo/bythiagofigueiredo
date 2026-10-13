/* m17c-dados.js: dados de EXEMPLO do mockup 17c (Insights: quem sobe e quem desce no nicho). Nomes e números inventados; nada é dado real do dono.
   Hoje = 2026-10-13. Um canal tem, por leitura:
   a (canal inteiro, 28 dias): rec = views ganhas nos últimos 28 dias, prev = nos 28 anteriores, reg = dia do primeiro registro (precisa de 56 dias), semBorda = falta o registro de hoje.
   b (vídeos novos, 90 dias): m90 / mP = mediana das views dos longos publicados em cada período, n90 / nP = quantos longos.
   c (vídeos novos, mesma idade): ainda não existe para nenhum canal. */
(function(){
  'use strict';
  var D = window.Q17D = {};
  function c(id, nome, a, b, extra){ var o = { id: id, nome: nome, a: a, b: b }; if (extra) Object.keys(extra).forEach(function(k){ o[k] = extra[k]; }); return o; }

  /* 7 canais de Viagem: 3 sobem, 2 descem, 1 estável, 1 sem 56 dias de registro (a). */
  var VIAGEM = [
    c('rota',   'Rota Solta',        { rec: 612000, prev: 431000, reg: '2026-02-11' }, { m90: 52000, mP: 38000, n90: 11, nP: 9 }),
    c('mala',   'Mala Pronta',       { rec: 198400, prev: 163900, reg: '2026-03-02' }, { m90: 21500, mP: 24100, n90: 8, nP: 7 }),
    c('trilha', 'Trilha Sem Mapa',   { rec: 87300,  prev: 76100,  reg: '2026-02-27' }, { m90: 9300,  mP: 8100,  n90: 6, nP: 5 }),
    c('pedro',  'Pedro no Mundo',    { rec: 340000, prev: 336000, reg: '2026-01-20' }, { m90: 0, mP: 0, n90: 2, nP: 8 }),
    c('casal',  'Casal Itinerante',  { rec: 121000, prev: 150700, reg: '2026-03-14' }, { m90: 14200, mP: 12900, n90: 7, nP: 6 }),
    c('voo',    'Voo Baixo',         { rec: 54200,  prev: 91400,  reg: '2026-04-09' }, { m90: 5100,  mP: 7800,  n90: 4, nP: 5 }),
    c('ana',    'Ana Passaporte',    { rec: 29800,  prev: 27500,  reg: '2026-09-08' }, { m90: 18000, mP: 17200, n90: 6, nP: 5 })
  ];

  /* valores nas bordas da escala e da regra de arredondamento */
  var EXTREMO = [
    c('ze',     'Viagem de Carona com o Zé Gringo, Canal Oficial do Mochilão Barato', { rec: 1980000, prev: 450000, reg: '2026-01-05' }, { m90: 410000, mP: 120000, n90: 14, nP: 12 }),
    c('rota',   'Rota Solta',        { rec: 520000, prev: 419000, reg: '2026-02-11' }, { m90: 52000, mP: 38000, n90: 11, nP: 9 }),
    c('mala',   'Mala Pronta',       { rec: 198400, prev: 160000, reg: '2026-03-02' }, { m90: 21500, mP: 24100, n90: 8, nP: 7 }),
    c('trilha', 'Trilha Sem Mapa',   { rec: 99200,  prev: 80000,  reg: '2026-02-27' }, { m90: 9300,  mP: 8100,  n90: 6, nP: 5 }),
    c('casal',  'Casal Itinerante',  { rec: 119000, prev: 108500, reg: '2026-03-14' }, { m90: 14200, mP: 12900, n90: 7, nP: 6 }),
    c('voo',    'Voo Baixo',         { rec: 36500,  prev: 91250,  reg: '2026-04-09' }, { m90: 5100,  mP: 7800,  n90: 4, nP: 5 }),
    c('pedro',  'Pedro no Mundo',    { rec: 74000,  prev: 336000, reg: '2026-01-20' }, { m90: 0, mP: 0, n90: 2, nP: 8 }),
    c('ana',    'Ana Passaporte',    { rec: 29800,  prev: 27500,  reg: '2026-07-01', semBorda: true }, { m90: 18000, mP: 17200, n90: 6, nP: 5 })
  ];

  /* zero medido (a caixa vazada com 0) ao lado de não medido */
  var ZERO = [
    c('rota',   'Rota Solta',        { rec: 612000, prev: 431000, reg: '2026-02-11' }, { m90: 52000, mP: 38000, n90: 11, nP: 9 }),
    c('mala',   'Mala Pronta',       { rec: 198400, prev: 163900, reg: '2026-03-02' }, { m90: 21500, mP: 24100, n90: 8, nP: 7 }),
    c('ana',    'Ana Passaporte',    { rec: 3100,   prev: 0,      reg: '2026-04-20' }, { m90: 18000, mP: 17200, n90: 6, nP: 5 }),
    c('voo',    'Voo Baixo',         { rec: 0,      prev: 0,      reg: '2026-04-09' }, { m90: 0, mP: 0, n90: 0, nP: 0 }),
    c('trilha', 'Trilha Sem Mapa',   { rec: 0,      prev: 41000,  reg: '2026-02-27' }, { m90: 9300,  mP: 8100,  n90: 6, nP: 5 }),
    c('casal',  'Casal Itinerante',  { rec: 121000, prev: 150700, reg: '2026-03-14' }, { m90: 14200, mP: 12900, n90: 7, nP: 6 }),
    c('pedro',  'Pedro no Mundo',    { rec: 12000,  prev: 11000,  reg: '2026-10-05' }, { m90: 0, mP: 0, n90: 2, nP: 8 })
  ];

  /* todos recém-acompanhados (registro desde 03/10 a 10/10) */
  var NOVOS = [
    c('rota',   'Rota Solta',        { rec: 0, prev: 0, reg: '2026-10-03' }, { m90: 52000, mP: 38000, n90: 11, nP: 9 }),
    c('mala',   'Mala Pronta',       { rec: 0, prev: 0, reg: '2026-10-03' }, { m90: 21500, mP: 24100, n90: 8, nP: 7 }),
    c('trilha', 'Trilha Sem Mapa',   { rec: 0, prev: 0, reg: '2026-10-05' }, { m90: 9300,  mP: 8100,  n90: 6, nP: 5 }),
    c('pedro',  'Pedro no Mundo',    { rec: 0, prev: 0, reg: '2026-10-05' }, { m90: 0, mP: 0, n90: 2, nP: 8 }),
    c('casal',  'Casal Itinerante',  { rec: 0, prev: 0, reg: '2026-10-08' }, { m90: 14200, mP: 12900, n90: 7, nP: 6 }),
    c('voo',    'Voo Baixo',         { rec: 0, prev: 0, reg: '2026-10-08' }, { m90: 5100,  mP: 7800,  n90: 4, nP: 5 }),
    c('ana',    'Ana Passaporte',    { rec: 0, prev: 0, reg: '2026-10-10' }, { m90: 18000, mP: 17200, n90: 6, nP: 5 })
  ];

  var IA2 = [
    c('prompt', 'Prompt de Bolso',   { rec: 88000, prev: 74500, reg: '2026-03-18' }, { m90: 8800, mP: 7700, n90: 9, nP: 8 }),
    c('bit',    'Bit Diário',        { rec: 41200, prev: 47300, reg: '2026-03-18' }, { m90: 3900, mP: 4300, n90: 7, nP: 8 })
  ];
  var CULI1 = [
    c('fogao',  'Fogão a Lenha da Vó', { rec: 66600, prev: 56400, reg: '2026-03-30' }, { m90: 7100, mP: 6900, n90: 5, nP: 4 })
  ];

  D.NICHOS = [
    { id: 'viagem', nome: 'Viagem', sw: 'v' },
    { id: 'ia', nome: 'IA', sw: 'a' },
    { id: 'culinaria', nome: 'Culinária', sw: 'n' }
  ];
  /* cada caso: nicho aberto, canais de cada nicho (para as contagens das abas), canais do nicho aberto, e o que mais a tela precisa */
  D.CASOS = {
    'tipico':           { nicho: 'viagem', canais: VIAGEM, contagem: { viagem: 7, ia: 2, culinaria: 1 } },
    'leituras':         { nicho: 'viagem', canais: VIAGEM, contagem: { viagem: 7, ia: 2, culinaria: 1 }, abrir: 'mala' },
    'videos':           { nicho: 'viagem', canais: VIAGEM, contagem: { viagem: 7, ia: 2, culinaria: 1 }, leitura: 'b' },
    'justa':            { nicho: 'viagem', canais: VIAGEM, contagem: { viagem: 7, ia: 2, culinaria: 1 }, leitura: 'c' },
    'extremo':          { nicho: 'viagem', canais: EXTREMO, contagem: { viagem: 8, ia: 2, culinaria: 1 } },
    'zero':             { nicho: 'viagem', canais: ZERO, contagem: { viagem: 7, ia: 2, culinaria: 1 } },
    'nao-medido':       { nicho: 'viagem', canais: NOVOS, contagem: { viagem: 7, ia: 2, culinaria: 1 } },
    'magro':            { nicho: 'ia', canais: IA2, contagem: { viagem: 7, ia: 2, culinaria: 1 } },
    'um-canal':         { nicho: 'culinaria', canais: CULI1, contagem: { viagem: 7, ia: 2, culinaria: 1 } },
    'sem-dado':         { nicho: 'culinaria', canais: [], contagem: { viagem: 7, ia: 2, culinaria: 0 } },
    'sem-dado-leitura': { nicho: 'culinaria', canais: [], contagem: { viagem: 7, ia: 2, culinaria: 0 }, soLeitura: true },
    'erro':             { nicho: 'viagem', canais: [], contagem: { viagem: 7, ia: 2, culinaria: 1 }, erro: true }
  };
})();
