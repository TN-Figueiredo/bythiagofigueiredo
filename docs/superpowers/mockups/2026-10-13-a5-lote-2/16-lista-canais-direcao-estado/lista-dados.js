/* lista-dados.js: canais de exemplo do mockup 16 (nomes e números inventados; nada é dado real do dono).
   Cada caso devolve { hoje, canais, erros, fora, nicho... }. Os percentuais de direção são CALCULADOS sobre os números exibidos
   (lição do lote 1: a diferença é feita sobre o que aparece na tela, nunca sobre o valor exato). */
(function(){
  'use strict';
  var A = window.A4, D = window.L16 = {};
  D.HOJE_TIPICO = '2026-10-13';
  D.HOJE_DEZ = '2026-12-15';
  D.QUEDA_INICIO = '2026-12-14';        /* primeira leitura limpa de 112 dias (M8) */
  D.CRUZA_ATE = '2026-10-19';           /* até aqui a janela de 56 dias cruza a mudança de contagem de 24/08 */

  /* views ganhas: arredondadas ao que aparece na tela (3 algarismos) */
  D.vis = function(x){ return x >= 1e5 ? Math.round(x / 1000) * 1000 : x >= 1e4 ? Math.round(x / 100) * 100 : Math.round(x / 10) * 10; };
  D.fv = function(x){ var v = D.vis(x); return v >= 1e5 ? A.n(v / 1000) + ' mil' : v >= 1e3 ? A.dec(v / 1000, v >= 1e4 ? 1 : 2) + ' mil' : String(v); };

  /* base de cada canal (13/10). b = views ganhas nos 28 dias anteriores; pct = direção alvo; ult = dias desde a última publicação; med = intervalo habitual (dias) */
  var BASE = [
    { id: 'nomade', nome: 'Nômade Raiz', nicho: 'Viagem', ins: 2080000, vpd: 2180, vn: 14, pw: '2,3', out: '3,4×', outn: '2 vídeos', tt: 6, cr: '+1,8%', b: 1840000, pct: 18, ult: 3, med: 3, reg: 133 },
    { id: 'lucas', nome: 'Lucas Bigodinho', nicho: 'Viagem', ins: 325000, vpd: 1060, vn: 14, pw: '1,2', out: '2,6×', outn: '1 vídeo', tt: 4, cr: '+0,9%', b: 412000, pct: 4, ult: 5, med: 6, reg: 133 },
    { id: 'prompt', nome: 'Prompt Diário', nicho: 'IA', ins: 204000, vpd: 880, vn: 13, pw: '3,1', out: '4,1×', outn: '3 vídeos', tt: 7, cr: '+3,6%', b: 198000, pct: 63, ult: 1, med: 2, reg: 133 },
    { id: 'mochila', nome: 'Mochila Curta', nicho: 'Viagem', ins: 412000, vpd: 521, vn: 12, pw: '1,5', out: '2,9×', outn: '2 vídeos', tt: 5, cr: '+2,4%', b: 305000, pct: 27, ult: 2, med: 4, reg: 110 },
    { id: 'lodir', nome: 'Lodir Negrini', nicho: 'Viagem', ins: 118000, vpd: 342, vn: 9, pw: '1,0', out: '2,1×', outn: '1 vídeo', tt: 2, cr: '+0,7%', b: 96000, pct: 11, ult: 4, med: 6, reg: 133 },
    { id: 'codigo', nome: 'Código Claro', nicho: 'IA', ins: 71300, vpd: 240, vn: 9, pw: '0,9', out: '1,7×', outn: 'nenhum', tt: 2, cr: '+0,5%', b: 52400, pct: 2, ult: 5, med: 7, reg: 133 },
    { id: 'dale', nome: 'Dale Philip', nicho: 'Viagem', ins: 3740000, vpd: 175, vn: 10, pw: '0,6', out: '1,8×', outn: 'nenhum', tt: 0, cr: '+0,3%', b: 640000, pct: 34, ult: 9, med: 11, reg: 133 },
    { id: 'vou', nome: 'Vou sem volta', nicho: 'Viagem', ins: 593000, vpd: 147, vn: 12, pw: '0,8', out: '2,2×', outn: '1 vídeo', tt: 2, cr: '−0,4%', b: 238000, pct: -14, ult: 8, med: 9, reg: 133 },
    { id: 'paddy', nome: 'Paddy Doyle', nicho: 'Viagem', ins: 341000, vpd: 118, vn: 13, pw: '0,9', out: '1,6×', outn: 'nenhum', tt: 3, cr: '+0,6%', b: 171000, pct: -3, ult: 6, med: 8, reg: 133 },
    { id: 'aldinho', nome: 'Aldinho Viaja', nicho: 'Viagem', ins: 87400, vpd: 96, vn: 11, pw: '0,7', out: '1,5×', outn: 'nenhum', tt: 1, cr: '−0,2%', b: 41200, pct: -8, ult: 7, med: 10, reg: 133 },
    { id: 'terra', nome: 'Terra Firme', nicho: 'Viagem', ins: 56200, vpd: 64, vn: 7, pw: '0,2', out: '1,2×', outn: 'nenhum', tt: 0, cr: '−1,1%', b: 12800, pct: -31, ult: 38, med: 7, reg: 133 },
    { id: 'agente', nome: 'Agente Zero', nicho: 'IA', ins: 18600, vpd: 58, vn: 6, pw: '0,6', out: '1,6×', outn: 'nenhum', tt: 1, cr: '+1,9%', b: 9300, pct: 20, ult: 4, med: 6, reg: 40 },
    { id: 'leo', nome: 'Leo Khev', nicho: 'Viagem', ins: 1530, vpd: 31, vn: 8, pw: '0,3', out: '1,4×', outn: 'nenhum', tt: 0, cr: '+1,3%', b: 3100, pct: -22, ult: 52, med: 9, reg: 133 },
    { id: 'rota', nome: 'Rota Cinco', nicho: 'Viagem', ins: 9800, vpd: 22, vn: 5, pw: '0,5', out: '1,3×', outn: 'nenhum', tt: 1, cr: '+3,2%', b: 5400, pct: 15, ult: 6, med: 8, reg: 24 },
    { id: 'tn', nome: 'tnFigueiredo', nicho: 'Viagem', ins: 1160, vpd: 20, vn: 6, pw: '0,4', out: '1,3×', outn: 'nenhum', tt: 0, cr: '+0,8%', b: 2200, pct: 0, ult: 7, med: 9, reg: 133, own: true }
  ];

  function clone(o){ var r = {}; Object.keys(o).forEach(function(k){ r[k] = o[k]; }); return r; }
  /* ritmo das últimas 13 semanas: de semente fixa, coerente com publicações por semana */
  function ritmo(c, i){ var r = A.rnd(31 + i * 7), m = parseFloat(String(c.pw).replace(',', '.')); var o = []; for (var k = 0; k < 13; k++) { var x = m + (r() - .5) * 1.4; o.push(Math.max(0, Math.round(x))); } return o; }

  var OV = {
    tipico: {},
    erro: {},
    fora: {},
    leitura: {},
    carregando: {},
    completo: {
      nomade: { pct: 16 }, lucas: { pct: 6 }, dale: { pct: 22 }, vou: { pct: -18, queda: true }, paddy: { pct: -2 }, leo: { pct: -35, ult: 115 }, lodir: { pct: 12 },
      aldinho: { pct: -9 }, mochila: { pct: 8 }, terra: { pct: -26, ult: 101 }, rota: { pct: -15, reg: 85 }, prompt: { pct: 41 }, codigo: { pct: 2 }, agente: { pct: -11, reg: 101 }
    },
    zero: {
      nomade: { pct: 18 }, lucas: { pct: 12 }, dale: { pct: 15 }, vou: { pct: 11 }, mochila: { pct: 27 }, prompt: { pct: 63 }, lodir: { pct: 13 }, agente: { pct: 20, reg: 101 },
      paddy: { pct: -2 }, aldinho: { pct: 3 }, terra: { pct: -7, ult: 14 }, rota: { pct: 5, reg: 85 }, codigo: { pct: 2 }, leo: { pct: 6, ult: 20 }
    },
    extremo: {
      nomade: { pct: -24, queda: true, ins: 14200000, b: 9400000 },
      lucas: { pct: -42, queda: true },
      dale: { pct: -78, queda: true, ult: 77, nome: 'Dale Philip' },
      vou: { pct: 3 }, paddy: { pct: -6 }, leo: { pct: -30, ult: 130 }, lodir: { pct: 9 }, aldinho: { pct: -15 },
      mochila: { pct: 0, fora: true }, terra: { pct: -52, ult: 101 }, rota: { pct: 0, reg: 85, vid: 0, b: 0 },
      prompt: { pct: -5 }, codigo: { pct: -3, ins: null, nome: 'Código Claro: programação em português para quem nunca programou' },
      agente: { pct: -19, ult: 61, reg: 101 }
    },
    magro: {
      nomade: { reg: 133 }, lucas: { reg: 133 }, prompt: { reg: 133 }, mochila: { reg: 110 },
      dale: { reg: 41 }, vou: { reg: 34 }, paddy: { reg: 29 }, leo: { reg: 20 }, lodir: { reg: 47 }, aldinho: { reg: 52 }, terra: { reg: 18 }, rota: { reg: 24 }, codigo: { reg: 12 }, agente: { reg: 40 }
    }
  };
  /* "magro" e demais casos: quem tem menos de 56 dias de registro não tem direção */
  D.CASOS = ['tipico', 'completo', 'extremo', 'zero', 'magro', 'erro', 'fora', 'carregando', 'leitura', 'muitos'];

  var NOMES1 = ['Rota', 'Mundo', 'Trilha', 'Terra', 'Mapa', 'Bússola', 'Passaporte', 'Janela', 'Estrada', 'Horizonte', 'Malas', 'Voo'], NOMES2 = ['Aberta', 'Longe', 'do Norte', 'Livre', 'Solta', 'em Dobro', 'Lenta', 'Doze', 'Sem Pressa', 'de Domingo'];
  var IAN1 = ['Modelo', 'Prompt', 'Agente', 'Código', 'Vetor', 'Token', 'Rede'], IAN2 = ['Aberto', 'em Foco', 'na Prática', 'Simples', 'Zero Um', 'de Bolso'];
  var HN1 = ['Riso', 'Piada', 'Esquete', 'Palco', 'Cena'], HN2 = ['Solto', 'da Semana', 'Curto', 'Inteiro', 'sem Roteiro'];

  function muitos(){
    var r = A.rnd(2026), out = [], i, id = 0;
    BASE.forEach(function(c){ out.push(clone(c)); });
    var usados = {}; out.forEach(function(c){ usados[c.nome] = 1; });
    for (i = 0; out.length < 78 && i < 400; i++) {
      var nicho = r() < .52 ? 'Viagem' : r() < .6 ? 'IA' : 'Humor', p1, p2;
      if (nicho === 'Viagem') { p1 = NOMES1; p2 = NOMES2; } else if (nicho === 'IA') { p1 = IAN1; p2 = IAN2; } else { p1 = HN1; p2 = HN2; }
      var nome = p1[Math.floor(r() * p1.length)] + ' ' + p2[Math.floor(r() * p2.length)];
      if (usados[nome]) continue; usados[nome] = 1;
      var ins = Math.round(Math.pow(10, 3.4 + r() * 3.2)), vpd = Math.round(ins * (.0004 + r() * .004)), pct = Math.round((r() - .42) * 70);
      var n = out.length;
      var c = { id: 'x' + (id++), nome: nome, nicho: nicho, ins: ins, vpd: Math.max(8, vpd), vn: 5 + Math.floor(r() * 10), pw: A.dec(.2 + r() * 2.2, 1), out: A.dec(1.1 + r() * 2.6, 1) + '×', outn: r() < .6 ? 'nenhum' : '1 vídeo', tt: Math.floor(r() * 6),
        cr: (r() < .25 ? '−' : '+') + A.dec(r() * 3, 1) + '%', b: Math.max(1800, Math.round(ins * (.04 + r() * .5))), pct: pct, ult: 1 + Math.floor(r() * 12), med: 3 + Math.floor(r() * 8), reg: n % 9 === 0 ? 20 + Math.floor(r() * 30) : 60 + Math.floor(r() * 70) };
      if (n % 11 === 0) { c.ult = 40 + Math.floor(r() * 60); c.pct = -Math.abs(c.pct) - 12; }
      if (n % 17 === 0) { c.queda = true; c.pct = -Math.abs(c.pct) - 15; }
      if (n === 33) c.fora = true;
      out.push(c);
    }
    return out;
  }

  D.caso = function(nome){
    var caso = D.CASOS.indexOf(nome) >= 0 ? nome : 'tipico';
    var dez = ['completo', 'extremo', 'zero', 'muitos'].indexOf(caso) >= 0;
    var hoje = dez ? D.HOJE_DEZ : D.HOJE_TIPICO;
    var base = caso === 'muitos' ? muitos() : BASE.map(clone);
    var ov = OV[caso] || {};
    var fora = {}, erros = {};
    base.forEach(function(c, i){
      var o = ov[c.id]; if (o) Object.keys(o).forEach(function(k){ c[k] = o[k]; });
      if (c.id.charAt(0) === 'x' && dez === false) { /* muitos só roda em dezembro */ }
      c.rit = ritmo(c, i);
      c.sy = i % 4 === 3 ? 'há 4 h' : i % 5 === 2 ? 'há 2 h' : 'há 3 h';
      c.vid = c.vid == null ? 1 : c.vid;
      if (c.fora) fora[c.id] = caso === 'extremo' ? '2026-12-04' : '2026-12-04';
    });
    if (caso === 'fora') { fora.lucas = '2026-10-04'; }
    if (caso === 'erro' || caso === 'leitura') { erros.paddy = [49, 'demora']; erros.lucas = [219, 'demora']; }
    if (caso === 'extremo') { erros.prompt = [49, 'demora']; }
    if (caso === 'muitos') { erros.x4 = [26, 'demora']; erros.x21 = [95, 'demora']; }
    /* ordem de produção: Views/dia, do maior ao menor */
    base.sort(function(a, b){ return b.vpd - a.vpd; });
    base.forEach(function(c){
      /* direção: só com 56 dias de registro; o canal próprio não tem contagem pública por dia guardada; saiu do YouTube e sem vídeos não têm base */
      var nm = null;
      if (c.own) nm = { cod: 'proprio', txt: 'o YouTube não dá esse número do seu canal; ainda não é guardado' };
      else if (fora[c.id]) nm = { cod: 'fora', txt: 'saiu do YouTube em ' + A.dm(fora[c.id]) };
      else if (c.vid === 0) nm = { cod: 'zerob', txt: 'sem views nos 56 dias para comparar' };
      else if (c.reg < 56) nm = { cod: 'fecha', txt: 'fecha em ' + A.dm(A.addDias(hoje, 56 - c.reg)), fecha: A.addDias(hoje, 56 - c.reg) };
      if (nm) { c.dir = null; c.nm = nm; }
      else {
        var a = c.b * (1 + c.pct / 100), bv = D.vis(c.b), av = D.vis(a), pc = Math.round((av / bv - 1) * 100);
        c.dir = { a: av, b: bv, pc: pc, k: pc >= 10 ? 'up' : pc <= -10 ? 'dn' : 'eq' };
      }
      c.limite = Math.max(28, 4 * (c.med || 0));
      c.par = !fora[c.id] && c.vid !== 0 && c.ult > c.limite;
      c.qd = !!c.queda && hoje >= D.QUEDA_INICIO && !fora[c.id];
      c.fo = fora[c.id] || null;
      c.er = erros[c.id] || null;
    });
    var nicho = {};
    base.forEach(function(c){ nicho[c.nicho] = (nicho[c.nicho] || 0) + 1; });
    return { caso: caso, hoje: hoje, canais: base, erros: erros, fora: fora, nicho: nicho, queda: hoje >= D.QUEDA_INICIO,
      quota: caso === 'muitos' ? '78 de 120 canais' : '15 de 20 canais', leitura: caso === 'leitura', carregando: caso === 'carregando' };
  };
})();
