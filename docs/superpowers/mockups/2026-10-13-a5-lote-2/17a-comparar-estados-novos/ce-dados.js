/* ce-dados.js: dados de EXEMPLO do mockup 17a (Comparar canais, estados novos). Tudo aqui é inventado; nada é dado real do dono.
   Forma de cada medida (o desenho decide "não medido" pelas regras do spec 5; um campo { nm: 'motivo' } força o motivo):
     a    M3(a) canal inteiro: { g: views ganhas nos últimos 28 dias, p: views ganhas nos 28 anteriores }
     b    M3(b) vídeos novos, views de hoje: { n, np (longos nos dois períodos de 90 dias), m, mp (medianas) }
     c    M3(c) vídeos novos, mesma idade (V30): { n, np, m, mp }; só existe em 2027
     pub  longos publicados nos 90 dias e nos 90 anteriores: { n, np }
     med / vpd  mediana de views dos longos e views por dia (90 dias): { n, v }
     m1   views na idade N: { h: 24 horas, d7, d30 } cada um { n, m }
     m4   taxa de acerto: { n (longos com 7 dias ou mais), hit, fail }
     m7   engajamento: { n, v, idade: '30' | 'hoje', so?: 'curtidas' }
     est  M8: { k: 'ativo' | 'parado' | 'queda' | 'fora', t (texto), s (apoio) }; "Em queda" só em data de 14/12/2026 em diante (estado `queda`)  */
window.CE = (function(){
  'use strict';
  var CH = {
    paddy: { nome: 'Paddy Doyle', ini: 'PD', nicho: 'Viagem', ins: 341000, acomp: 45,
      est: { k: 'ativo', t: 'Ativo', s: 'último longo há 6 dias' },
      a: { g: 1412000, p: 1104000 }, b: { n: 13, np: 11, m: 66800, mp: 58300 }, pub: { n: 13, np: 11 },
      med: { n: 13, v: 66800 }, vpd: { n: 13, v: 118.4 },
      m1: { h: { n: 4, m: 5200 }, d7: { n: 9, m: 19800 }, d30: { n: 5, m: 41300 } },
      m4: { n: 12, hit: 3, fail: 2 }, m7: { n: 5, v: .041, idade: '30' } },
    nomade: { nome: 'Nômade Raiz', ini: 'NR', nicho: 'Viagem', ins: 2080000, acomp: 50,
      est: { k: 'ativo', t: 'Ativo', s: 'último longo há 4 dias' },
      a: { g: 3100000, p: 3900000 }, b: { n: 12, np: 13, m: 1620000, mp: 2050000 }, pub: { n: 12, np: 13 },
      med: { n: 12, v: 1620000 }, vpd: { n: 12, v: 749 },
      m1: { h: { n: 3, m: 88000 }, d7: { n: 5, m: 312000 }, d30: { n: 2, m: 540000 } },
      m4: { n: 11, hit: 1, fail: 4 }, m7: { n: 11, v: .027, idade: 'hoje' } },
    tn: { nome: 'tnFigueiredo', ini: 'TF', nicho: 'Viagem', ins: 1340, acomp: 35, own: true,
      est: { k: 'ativo', t: 'Ativo', s: 'último longo há 19 dias' },
      a: { g: 3920, p: 3380 }, b: { n: 3, np: 4, m: 410, mp: 380 }, pub: { n: 3, np: 4 },
      med: { n: 3, v: 410 }, vpd: { n: 3, v: 1.4 },
      m1: { h: { n: 1, m: 90 }, d7: { n: 2, m: 160 }, d30: { n: 0, m: null } },
      m4: { n: 3, hit: 0, fail: 0 }, m7: { n: 3, v: .118, idade: 'hoje' } },
    lodir: { nome: 'Lodir', ini: 'LO', nicho: 'Viagem', ins: 15400, acomp: 21,
      est: { k: 'ativo', t: 'Ativo', s: 'último longo há 2 dias' },
      a: { g: 61000, p: 52000 }, b: { n: 12, np: 9, m: 5360, mp: 4000 }, pub: { n: 12, np: 9 },
      med: { n: 12, v: 5360 }, vpd: { n: 12, v: 28.6 },
      m1: { h: { n: 5, m: 610 }, d7: { n: 8, m: 1840 }, d30: { n: 4, m: 3700 } },
      m4: { n: 10, hit: 2, fail: 2 }, m7: { n: 4, v: .061, idade: '30' } },
    lucas: { nome: 'Lucas Bigodinho', ini: 'LB', nicho: 'Viagem', ins: 3250000, acomp: 50,
      est: { k: 'ativo', t: 'Ativo', s: 'último longo há 1 dia' },
      a: { g: 38400000, p: 12100000 }, b: { n: 14, np: 10, m: 1480000, mp: 420000 }, pub: { n: 14, np: 10 },
      med: { n: 14, v: 1480000 }, vpd: { n: 14, v: 10480 },
      m1: { h: { n: 6, m: 410000 }, d7: { n: 11, m: 1200000 }, d30: { n: 8, m: 2900000 } },
      m4: { n: 14, hit: 14, fail: 0 }, m7: { n: 8, v: .174, idade: '30' } },
    leo: { nome: 'Leo', ini: 'LE', nicho: 'Viagem', ins: 1530, acomp: 34,
      est: { k: 'parado', t: 'Parado', s: 'há 74 dias sem longo novo' },
      a: { g: 150, p: 410 }, b: { n: 2, np: 1, m: 260, mp: 310 }, pub: { n: 2, np: 1 },
      med: { n: 2, v: 260 }, vpd: { n: 2, v: .2 },
      m1: { h: { n: 0, m: null }, d7: { n: 0, m: null }, d30: { n: 0, m: null } },
      m4: { n: 3, hit: 0, fail: 0 }, m7: { n: 5, v: .009, idade: 'hoje', so: 'curtidas' } },
    dale: { nome: 'Dale Philip', ini: 'DP', nicho: 'Viagem', ins: 3740000, acomp: 10,
      est: { k: 'parado', t: 'Parado', s: 'há 95 dias sem longo novo' },
      a: { g: 214000, p: 288000 }, b: { n: 0, np: 8, m: null, mp: 157000 }, pub: { n: 0, np: 8 },
      med: { n: 0, v: null }, vpd: { n: 0, v: null },
      m1: { h: { n: 0, m: null }, d7: { n: 0, m: null }, d30: { n: 0, m: null } },
      m4: { n: 0, hit: 0, fail: 0 }, m7: { n: 0, v: null, idade: 'hoje' } },
    aldinho: { nome: 'Aldinho', ini: 'AL', nicho: 'Viagem', ins: 37300, acomp: 50,
      est: { k: 'ativo', t: 'Ativo', s: 'último longo há 3 dias' },
      a: { g: 88000, p: 86000 }, b: { n: 12, np: 11, m: 7100, mp: 7700 }, pub: { n: 12, np: 11 },
      med: { n: 12, v: 7100 }, vpd: { n: 12, v: 30.8 },
      m1: { h: { n: 4, m: 310 }, d7: { n: 8, m: 1200 }, d30: { n: 6, m: 2500 } },
      m4: { n: 12, hit: 0, fail: 4 }, m7: { n: 6, v: .047, idade: '30' } },
    carol: { nome: 'Carol Rotas', ini: 'CR', nicho: 'Viagem', ins: 9800, acomp: 14,
      est: { k: 'ativo', t: 'Ativo', s: 'último longo há 5 dias'},
      a: { nm: 'menos de 56 dias de registro: tem 32 e fecha em 07/12' }, b: { n: 2, np: 0, m: null, mp: null }, pub: { n: 2, np: 0 },
      med: { n: 2, v: null }, vpd: { n: 2, v: null },
      m1: { h: { nm: 'publicado antes de 17/10: as primeiras horas não foram contadas' }, d7: { nm: 'descoberto com mais de 24 h depois de publicado' }, d30: { nm: 'o primeiro fecha em 22/11' } },
      m4: { n: 2, hit: 0, fail: 0 }, m7: { nm: 'curtidas ocultas e comentários desligados' } },
    vagabundo: { nome: 'Vagabundo Digital', ini: 'VD', nicho: 'Viagem', ins: 128000, acomp: 41, ate: '01/11',
      est: { k: 'fora', t: 'Fora do ar', s: 'desde 02/11; último registro em 01/11' },
      a: { nm: 'fora do ar: falta o registro de hoje' }, b: { n: 8, np: 9, m: 22400, mp: 25100 }, pub: { n: 8, np: 9 },
      med: { n: 8, v: 22400 }, vpd: { n: 8, v: 64.5 },
      m1: { h: { n: 3, m: 2100 }, d7: { n: 4, m: 5100 }, d30: { n: 3, m: 9800 } },
      m4: { n: 8, hit: 2, fail: 1 }, m7: { n: 3, v: .033, idade: '30' } },
    marta: { nome: 'Marta Panela', ini: 'MP', nicho: 'Culinária', ins: 412000, acomp: 50,
      est: { k: 'ativo', t: 'Ativo', s: 'último longo há 2 dias' },
      a: { g: 920000, p: 1010000 }, b: { n: 22, np: 20, m: 38200, mp: 36100 }, pub: { n: 22, np: 20 },
      med: { n: 22, v: 38200 }, vpd: { n: 22, v: 164.2 },
      m1: { h: { n: 9, m: 3100 }, d7: { n: 17, m: 11400 }, d30: { n: 12, m: 24100 } },
      m4: { n: 22, hit: 4, fail: 6 }, m7: { n: 12, v: .052, idade: '30' } }
  };
  /* 2027: a leitura justa (c) existe */
  var C27 = { paddy: { c: { n: 12, np: 11, m: 44200, mp: 38900 }, a: { g: 1190000, p: 1090000 } }, lodir: { c: { n: 10, np: 9, m: 3800, mp: 4300 }, a: { g: 66000, p: 63500 } } };
  /* o desenho do magro usa o dia de verdade (13/10): quase nada fechou */
  var MAGRO = {
    lodir: { b: { n: 2, np: 1, m: null, mp: null }, a: { nm: 'menos de 56 dias de registro: tem 54 e fecha em 15/10' },
      m1: { h: { nm: 'as primeiras horas passam a ser contadas em 17/10' }, d7: { n: 2, m: 780 }, d30: { nm: 'o primeiro fecha em 02/11' } },
      m4: { n: 4, hit: 0, fail: 0 }, m7: { n: 4, v: .066, idade: 'hoje' }, pub: { n: 2, np: 1 }, med: { n: 2, v: null }, vpd: { n: 2, v: null } },
    leo: { b: { n: 2, np: 2, m: null, mp: null }, a: { g: 120, p: 170 },
      m1: { h: { nm: 'as primeiras horas passam a ser contadas em 17/10' }, d7: { n: 0, m: null }, d30: { nm: 'nenhum longo publicado desde 03/10' } },
      m4: { n: 3, hit: 0, fail: 0 }, m7: { n: 5, v: .009, idade: 'hoje', so: 'curtidas' }, pub: { n: 2, np: 2 }, med: { n: 2, v: null }, vpd: { n: 2, v: null }, est: { k: 'ativo', t: 'Ativo', s: 'último longo há 22 dias'} }
  };
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function com(id, extra){ var c = clone(CH[id]); c.id = id; if (extra) Object.keys(extra).forEach(function(k){ c[k] = extra[k]; }); return c; }

  var ESTADOS = {
    tipico:      { rotulo: 'Com dado (dois concorrentes)', hoje: '2026-11-13', a: 'paddy', b: 'nomade', principal: 'a' },
    proprio:     { rotulo: 'Seu canal × concorrente', hoje: '2026-11-13', a: 'tn', b: 'lodir', principal: 'a', cartao: 'cheio' },
    extremo:     { rotulo: 'Dado extremo', hoje: '2026-11-13', a: 'lucas', b: 'leo', principal: 'a' },
    zero:        { rotulo: 'Zero medido', hoje: '2026-11-13', a: 'dale', b: 'aldinho', principal: 'a' },
    naomedido:   { rotulo: 'Um lado não medido', hoje: '2026-11-13', a: 'paddy', b: 'carol', principal: 'a' },
    magro:       { rotulo: 'Par magro (13/10, o caso real)', hoje: '2026-10-13', a: 'lodir', b: 'leo', principal: 'a', magro: true },
    fora:        { rotulo: 'Um lado fora do ar', hoje: '2026-11-13', a: 'paddy', b: 'vagabundo', principal: 'a' },
    nichos:      { rotulo: 'Nichos diferentes', hoje: '2026-11-13', a: 'paddy', b: 'marta', principal: 'a' },
    queda:       { rotulo: 'Em queda sustentada (20/12/2026)', hoje: '2026-12-20', a: 'paddy', b: 'nomade', principal: 'a', queda: true },
    '2027':      { rotulo: 'Abril de 2027 (leitura justa existe)', hoje: '2027-04-20', a: 'paddy', b: 'lodir', principal: 'c', v27: true },
    erro:        { rotulo: 'Erro (um lado não carregou)', hoje: '2026-11-13', a: 'paddy', b: 'nomade', principal: 'a', erro: 'B' },
    vazio:       { rotulo: 'Sem segundo canal', hoje: '2026-11-13', a: 'paddy', b: null, principal: 'a', vazio: true },
    leitura:     { rotulo: 'Só leitura (número privado)', hoje: '2026-11-13', a: 'tn', b: 'lodir', principal: 'a', cartao: 'sem-acesso' }
  };
  function estado(id){
    var e = ESTADOS[id] || ESTADOS.tipico, r = Object.assign({ id: id }, e);
    r.A = com(e.a); r.B = e.b ? com(e.b) : null;
    if (e.magro) { r.A = com(e.a, MAGRO[e.a]); r.B = com(e.b, MAGRO[e.b]); }
    if (e.queda) r.B = com(e.b, { est: { k: 'queda', t: 'Em queda', s: '3 janelas de 28 dias seguidas' } });
    if (e.v27) { r.A = com(e.a, C27[e.a]); r.B = com(e.b, C27[e.b]); }
    return r;
  }
  return { ESTADOS: ESTADOS, estado: estado, CH: CH };
})();
