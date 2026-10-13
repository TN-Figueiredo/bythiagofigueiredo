/* m13-dados.js: dados de EXEMPLO do mockup 13 (Histórico do vídeo de concorrente). Nomes, números e datas inventados; nada é dado real do dono.
   O motor abaixo faz as mesmas contas que a tela promete: soma dos dias = contagem do cabeçalho, curva de 72 horas e curva por dia saem da MESMA contagem acumulada,
   "subida" segue a regra de M5 (taxa dos 7 dias seguintes >= 2x a dos 7 anteriores E ganho >= 1.000 views), "metade em N horas" sai das leituras.
   Mundo do mockup: o dia da contagem diária começa em 03/10/2026 (E1); a leitura por hora começa em 04/10/2026 (E2: data de exemplo, o implementador usa a real). */
(function(root){
  'use strict';
  var D = root.M13D = {};
  D.INICIO_DIARIA = '2026-10-03';
  D.INICIO_HORA = '2026-10-04';
  D.CORTE = '2026-08-24';

  function rnd(seed){ var a = seed; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function addDias(iso, n){ var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dias(a, b){ return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }
  D.addDias = addDias; D.diasEntre = dias;

  /* o normal do canal (M2): mediana das views acumuladas por idade, com o n de cada ponto (n < 3 = não medido) */
  D.IDADES = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90];
  D.normalCurva = function(esc, ns){
    return D.IDADES.map(function(a, i){ var n = ns[i]; return { idade: a, n: n, v: n >= 3 ? Math.round(5200 * esc * Math.pow(a, .55) / 10) * 10 : null }; });
  };

  /* gera um vídeo. p: { pub, h, m, agora (dia da última leitura das 12:00), seed, A, tau, B, burst:{s,peak,ramp,tb}, nCedo (leituras por hora: 'tarde' = horas depois de publicar em que foi descoberto), zeros:[datas], buracos:[datas] } */
  D.gerar = function(p){
    var R = rnd(p.seed || 1), hp = p.h + p.m / 60, passo = .05;
    var noon0 = (24 - hp) + 12;                                  // horas entre a publicação e as 12:00 do dia seguinte
    var nDias = dias(p.pub, p.agora);                            // leituras das 12:00: dia seguinte à publicação até 'agora'
    var tMax = noon0 + 24 * (nDias - 1) + .01;
    var ruido = []; for (var k = 0; k < Math.ceil(tMax) + 2; k++) ruido.push(1 + (R() - .5) * .22);
    var N = Math.ceil(tMax / passo), C = new Array(N + 2), acc = 0; C[0] = 0;
    for (var i = 1; i <= N + 1; i++) {
      var t = i * passo, hc = (hp + t) % 24, circ = 1 + .5 * Math.cos(2 * Math.PI * (hc - 20) / 24);
      var lam = p.A * Math.exp(-t / p.tau) + p.B;
      if (p.burst && t >= p.burst.s) lam += p.burst.peak * (1 - Math.exp(-(t - p.burst.s) / p.burst.ramp)) * Math.exp(-(t - p.burst.s) / p.burst.tb);
      acc += lam * circ * ruido[Math.floor(t)] * passo; C[i] = acc;
    }
    function Cat(t){ if (t <= 0) return 0; var x = t / passo, i0 = Math.floor(x), f = x - i0; if (i0 >= N + 1) return C[N + 1]; return C[i0] + (C[i0 + 1] - C[i0]) * f; }
    var o = { p: p, Cat: Cat, tLast: tMax, noon0: noon0, nDias: nDias };
    /* leituras das 12:00 */
    var rd = [], prev = 0;
    for (var d = 0; d < nDias; d++) { var cum = Math.round(Cat(noon0 + 24 * d)), dt = addDias(p.pub, d + 1); rd.push({ d: dt, cum: cum, v: cum - prev, e: 'com' }); prev = cum; }
    (p.zeros || []).forEach(function(z){ rd.forEach(function(x, j){ if (x.d === z) { x.v = 0; } }); });
    /* zeros pedidos: refaz a soma para que o total continue sendo a soma dos dias */
    var s = 0; rd.forEach(function(x){ s += x.v; x.cum = s; if (x.v === 0) x.e = 'zero'; });
    (p.buracos || []).forEach(function(b){ var j = rd.findIndex(function(x){ return x.d === b; }); if (j >= 0 && j + 1 < rd.length) { rd[j].e = 'nm'; rd[j + 1].e = 'nm'; rd[j].junto = rd[j].v + rd[j + 1].v; rd[j + 1].junto = rd[j].junto; } });
    /* a coluna do dia da publicação: sem leitura das 12:00 (publicado depois do meio-dia) ou com o ganho desde a publicação, se antes */
    o.dias = [{ d: p.pub, v: null, e: 'pub' }].concat(rd);
    o.total = rd.length ? rd[rd.length - 1].cum : 0;
    /* views na idade N (M1): interpola entre as leituras vizinhas; sem as 12:00 do primeiro dia, usa a curva por hora (idade 1 dia) */
    o.cumNaIdade = function(idade){
      var t = idade * 24; if (t > tMax + 1e-6) return null;
      if (o.horas && t <= 72) { return Math.round(Cat(t)); }
      var pts = [{ t: 0, c: 0 }].concat(rd.map(function(x, j){ return { t: noon0 + 24 * j, c: x.cum }; }));
      for (var j = 1; j < pts.length; j++) if (t <= pts[j].t) { var a = pts[j - 1], b = pts[j]; return Math.round(a.c + (b.c - a.c) * (t - a.t) / (b.t - a.t)); }
      return null;
    };
    /* primeiras 72 horas: leitura toda hora cheia depois da descoberta */
    if (p.horas !== false) {
      var first = (60 - p.m) / 60 % 1 || 1; if (p.m === 0) first = 1;
      var tardeH = p.descoberto == null ? ([0, 6, 12, 18, 24].filter(function(x){ return x > hp; })[0] - hp + 1) : p.descoberto; // horas depois de publicar até a 1ª leitura
      var jFirst = Math.max(0, Math.ceil(Math.round((tardeH - first) * 1e6) / 1e6));
      var hs = [], prevc = 0;
      for (var j = 0; j < 72; j++) {
        var tj = first + j, c = Math.round(Cat(tj)), v = c - prevc, hcl = Math.floor((hp + tj) % 24);
        var e = j <= jFirst ? 'nm' : 'com'; if (e === 'com' && v === 0) e = 'zero';
        if (p.zerosHora && p.zerosHora.indexOf(j) >= 0) { e = 'zero'; v = 0; }
        hs.push({ j: j, t: tj, hc: hcl, d: addDias(p.pub, Math.floor((hp + tj) / 24)), v: v, cum: c, e: e }); prevc = c;
      }
      o.horas = hs; o.jFirst = jFirst; o.primeiraLeitura = hs[jFirst]; o.pubTxt = ('0' + p.h).slice(-2) + ':' + ('0' + p.m).slice(-2);
      /* metade em N horas: primeira leitura em que a contagem chega a metade da de 72 horas */
      var tot72 = hs[71].cum;
      function quando(f){ if (jFirst > 0 && hs[jFirst] && hs[jFirst].cum >= f * tot72) return null; /* o marco já tinha passado quando a primeira contagem chegou: não foi observado */ for (var q = 0; q < 72; q++) if (hs[q].cum >= f * tot72) return Math.round(hs[q].t); return null; }
      o.q25 = quando(.25); o.q50 = quando(.5); o.q75 = quando(.75); o.tot72 = tot72;
      if (jFirst > 0 && hs[jFirst]) { o.q25 = o.q25 != null && o.q25 < hs[jFirst].t ? null : o.q25; o.q50 = o.q50 != null && o.q50 < hs[jFirst].t ? null : o.q50; }
    }
    /* subida (M5) */
    o.subida = null;
    var Rc = [0].concat(rd.map(function(x){ return x.cum; }));      // Rc[j+1] = rd[j].cum; índice i da regra = posição em rd
    for (var q = 7; q + 7 < rd.length + 0; q++) {
      var antes = (rd[q].cum - rd[q - 7].cum) / 7, depois = (rd[q + 7].cum - rd[q].cum) / 7, ganho = rd[q + 7].cum - rd[q].cum;
      if (rd[q].e !== 'com' || rd[q - 7].e !== 'com' || rd[q + 7].e !== 'com') continue;
      if (depois >= 2 * antes && ganho >= 1000) { o.subida = { d: rd[q].d, fim: rd[q + 7].d, ganho: ganho, antes: antes, depois: depois, razao: depois / antes, idx: q + 1 }; break; }
    }
    return o;
  };
})(typeof window !== 'undefined' ? window : globalThis);
