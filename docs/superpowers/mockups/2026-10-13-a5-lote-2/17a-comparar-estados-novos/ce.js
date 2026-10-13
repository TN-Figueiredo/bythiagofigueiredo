/* ce.js: mockup 17a, "Comparar canais" com as medidas novas da A5 (M3 em três leituras, M1 N=1, M4, M7 na idade 30, M8 no cartão de cada lado).
   Estende a tela aprovada (mockup 9, ../../2026-10-12-a4-proprio-e-ajustes/comparar-direcao.*) e o cartão "Só o seu canal mede".
   Parâmetros: ?estado=tipico|proprio|extremo|zero|naomedido|magro|fora|nichos|queda|2027|erro|vazio|leitura   ?tema=claro   ?barra=0 (recolhe a barra do mockup)
   Todos os números são EXEMPLO (inventados) e a tela diz isso. Prefixo de classe novo: ce-. As classes cd-/rg/dr vêm do mockup 9. */
(function(){
  'use strict';
  var A = window.A4, q = A.q, esc = A.esc, D = window.CE;
  var idE = D.ESTADOS[q.get('estado')] ? q.get('estado') : 'tipico', E = D.estado(idE);
  var CA = E.A, CB = E.B, HOJE = E.hoje, COR = ['var(--lado-n)', 'var(--lado-b)'];
  var PALAVRA = { up: 'subindo', dn: 'descendo', eq: 'estável' }, SIM = { up: '▲', dn: '▼', eq: '＝' };
  var PAR = CB ? [CA, CB] : [CA];
  var DIF_NICHO = !!CB && CA.nicho !== CB.nicho;

  /* ---------------------------------------------------------------- formatos */
  function fv(x){ return x == null ? null : x >= 1e6 ? A.dec(x / 1e6, 1) + ' mi' : x >= 1000 ? A.mil(Math.round(x / 10) * 10) : A.n(Math.round(x)); }
  function fd(x){ return x >= 100 ? A.n(Math.round(x)) : A.dec(x, 1); }
  function pc0(p){ return Math.round(p * 100); }
  function sgn(p){ var r = pc0(p); return (r > 0 ? '+' : r < 0 ? '−' : '') + A.n(Math.abs(r)) + '%'; }
  function kOf(p){ var r = pc0(p); return r >= 10 ? 'up' : r <= -10 ? 'dn' : 'eq'; }
  function lg(n){ return n + (n === 1 ? ' longo' : ' longos'); }
  function dmy(iso){ return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function badge(l){ return '<span class="cb-lado' + (l === 'B' ? ' b' : '') + '" style="--c:' + (l === 'B' ? COR[1] : COR[0]) + '" aria-hidden="true">' + l + '</span>'; }
  function ate(c){ return c.ate ? ', até ' + c.ate : ''; }
  var IC = {
    aviso: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2l6.2 11H1.8z"/><path d="M8 6.6v3.2M8 11.7v.1"/></svg>',
    x: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"/></svg>',
    pausa: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M6.4 5.6v4.8M9.6 5.6v4.8"/></svg>',
    ok: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M5.4 8.2l1.8 1.8 3.4-3.6"/></svg>',
    queda: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M5.4 6.4l2.6 3.6 2.6-3.6z"/></svg>',
    cadeado: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.4" y="7" width="9.2" height="6.4" rx="1.4"/><path d="M5.4 7V5.4a2.6 2.6 0 015.2 0V7"/></svg>',
    relogio: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6"/><path d="M8 4.8V8l2.2 1.4"/></svg>',
    dir: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 11.5l3.5-4 2.5 2 5-5.5M10.5 4.5h3v3"/></svg>',
    des: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.8h11M5.5 2v3M10.5 2v3"/></svg>',
    tam: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13.5V9M8 13.5V4.5M13 13.5V7"/></svg>',
    ida: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 4.8V8l2.2 1.4"/></svg>',
    acerto: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="4" height="4" rx=".8"/><rect x="9.5" y="2.5" width="4" height="4" rx=".8"/><rect x="2.5" y="9.5" width="4" height="4" rx=".8"/><path d="M10 11.6l1.5 1.5 2.6-3"/></svg>'
  };

  /* ---------------------------------------------------------------- células */
  function td(lado, inner, cls){ return '<td class="' + (lado ? 'cB' : 'cA') + (cls ? ' ' + cls : '') + '" style="--c:' + COR[lado] + '" data-l="' + (lado ? 'B' : 'A') + '">' + inner + '</td>'; }
  function tdNm(lado, why){ return td(lado, '<span class="nm">não medido</span><small class="why">' + esc(why) + '</small>', 'nd'); }
  function tdNao(lado){ return td(lado, '<span class="ce-nao">ainda não existe</span>', 'nd'); }
  function tdErro(lado){ return td(lado, '<span class="ce-er">' + IC.aviso + 'não carregou</span>', 'nd'); }
  function zbox(t, pq){ return '<span class="zbox' + (pq ? ' s' : '') + '">' + t + '</span>'; }
  function sinal(k, pct, extra){ return '<span class="dr ' + k + (extra ? ' ' + extra : '') + '"><span class="sy" aria-hidden="true">' + SIM[k] + '</span><b>' + PALAVRA[k] + '</b>' + (pct ? '<span class="pc num">' + pct + '</span>' : '') + '</span>'; }
  function erroDe(lado){ return E.erro && E.erro === (lado ? 'B' : 'A'); }
  /* cada getter devolve { nm: 'motivo' } ou { ok: true, ... } */
  function nm(why){ return { nm: why }; }

  /* ---------------------------------------------------------------- M3: as três leituras de direção */
  function leituraA(c){
    var r = c.a; if (r.nm) return nm(r.nm);
    var p = r.g / r.p - 1; return { ok: true, p: p, k: kOf(p), sub: fv(r.g) + ' contra ' + fv(r.p) + ' views ganhas' + ate(c) };
  }
  function leituraBC(x, c, tipo){
    if (!x) return { futuro: true };
    if (x.nm) return nm(x.nm);
    var onde = tipo === 'c' ? 'com 30 dias fechados' : '';
    if (x.n < 3) return nm(lg(x.n) + ' ' + (onde || 'nos últimos 90 dias') + '; precisa de 3');
    if (x.np < 3) return nm(lg(x.np) + ' ' + (onde || 'nos 90 anteriores') + '; precisa de 3');
    var p = x.m / x.mp - 1;
    return { ok: true, p: p, k: kOf(p), sub: fv(x.m) + ' (' + lg(x.n) + ') contra ' + fv(x.mp) + ' (' + x.np + ')' + ate(c) };
  }
  function leitura(c, id){
    if (id === 'a') return leituraA(c);
    if (id === 'b') return leituraBC(c.b, c, 'b');
    return E.v27 ? leituraBC(c.c, c, 'c') : { futuro: true };
  }
  var NOME_C = { a: 'canal inteiro', b: 'vídeos novos de hoje', c: 'vídeos novos na mesma idade' };
  var NOME_L = { a: 'o canal inteiro', b: 'os vídeos novos (views de hoje)', c: 'os vídeos novos (na mesma idade)' };
  var ORDEM = E.principal === 'c' ? ['c', 'a', 'b'] : ['a', 'b', 'c'];
  var APOIO = ORDEM.slice(1);

  function cruza(dias){ var ini = Date.parse(HOJE + 'T12:00:00Z') - 2 * dias * 864e5; return ini <= Date.parse('2026-08-24T12:00:00Z') && Date.parse(HOJE + 'T12:00:00Z') >= Date.parse('2026-08-24T12:00:00Z'); }
  var MARCA = '<span class="ce-marca">' + IC.aviso + 'a contagem de views do YouTube mudou neste período</span>';

  function dirPub(c){
    var r = c.pub; if (r.n < 3 && r.np < 3) return { nm: r.n === 0 && r.np === 0 ? 'nenhum longo nos dois períodos' : lg(r.n) + ' contra ' + r.np + '; precisa de 3 em um dos períodos' };
    /* a mesma regra de todas as direções: ±10% (sem piso escondido); com 0 no período anterior só há "subindo" ou "estável" */
    var d = r.n - r.np, p = r.np > 0 ? d / r.np : (d > 0 ? 1 : 0), k = kOf(p);
    return { ok: true, k: k, d: d, p: p };
  }

  /* ---------------------------------------------------------------- população do nicho (exemplo, semente fixa) */
  var POP = {};
  function pop(nicho){
    if (POP[nicho]) return POP[nicho];
    var seed = 0; for (var i = 0; i < nicho.length; i++) seed += nicho.charCodeAt(i) * (i + 3);
    var rg = A.rnd(20261013 + seed), v = [];
    for (var k = 0; k < 12; k++) {
      var r = [rg(), rg(), rg(), rg(), rg()], ins = Math.pow(10, 3.1 + 3.3 * r[0]), med = ins * (.03 + r[2] * .35), vpd = med / (45 + r[3] * 170);
      v.push({ id: 'p' + k, ins: ins, a: (r[1] - .44) * 1.05, c: (r[4] - .46) * .8, med: med, vpd: vpd, vpm: vpd / ins * 1000 });
    }
    return (POP[nicho] = v);
  }
  function valsDe(nicho, chave){
    var base = pop(nicho).map(function(p){ return { id: p.id, x: p[chave] }; });
    PAR.filter(function(c){ return c.nicho === nicho; }).forEach(function(c){ var x = xDe(c, chave); if (x != null) base.push({ id: c.id, x: x }); });
    return base;
  }
  function xDe(c, chave){
    if (chave === 'ins') return c.ins;
    if (chave === 'a') { var r = leituraA(c); return r.ok ? r.p : null; }
    if (chave === 'c') { var r2 = leitura(c, 'c'); return r2.ok ? r2.p : null; }
    if (chave === 'med') return c.med.n >= 3 ? c.med.v : null;
    if (chave === 'vpd') return c.vpd.n >= 3 ? c.vpd.v : null;
    if (chave === 'vpm') return c.vpd.n >= 3 ? c.vpd.v / c.ins * 1000 : null;
    return null;
  }
  function posicao(vals, id){
    var x = vals.filter(function(v){ return v.id === id; })[0]; if (!x) return null;
    return { pos: vals.filter(function(v){ return v.x > x.x; }).length + 1, n: vals.length };
  }
  /* régua: um traço por canal; marcas A e B. o.compacta: uma marca só (réguas empilhadas quando os nichos diferem) */
  function regua(vals, o){
    var T = o.log ? Math.log10 : function(x){ return x; }, lo = o.lo, hi = o.hi;
    if (lo == null) { lo = Math.min.apply(null, vals.map(function(v){ return v.x; })); hi = Math.max.apply(null, vals.map(function(v){ return v.x; })); }
    var span = (T(hi) - T(lo)) || 1;
    function pc(x){ return 5 + Math.max(0, Math.min(1, (T(x) - T(lo)) / span)) * 90; }
    function fora(x){ return T(x) > T(hi) ? 1 : T(x) < T(lo) ? -1 : 0; }
    var marcas = [[o.a, 'A'], [o.b, 'B']].filter(function(m){ return m[0]; });
    var ticks = vals.filter(function(v){ return v.id !== o.a && v.id !== o.b; }).map(function(v){ return '<i class="tk" style="left:' + pc(v.x).toFixed(1) + '%"></i>'; }).join('');
    var mk = marcas.map(function(m, idx){
      var v = vals.filter(function(w){ return w.id === m[0]; })[0]; if (!v) return '';
      var f = fora(v.x), lado = m[1] === 'B', col = COR[lado ? 1 : 0];
      return '<i class="tk m" style="left:' + pc(v.x).toFixed(1) + '%;--c:' + col + '"></i><span class="rg-b ' + (o.compacta ? 'a' : (lado ? 'b' : 'a')) + (f ? ' f-ex' + (f > 0 ? ' f-d' : ' f-e') : '') + '" style="left:' + pc(v.x).toFixed(1) + '%;--c:' + col + '">' +
        (f < 0 ? '<i class="rg-ar" aria-hidden="true">◀</i>' : '') + '<span class="cb-lado' + (lado ? ' b' : '') + '" style="--c:' + col + '">' + m[1] + '</span>' + (f > 0 ? '<i class="rg-ar" aria-hidden="true">▶</i>' : '') + '</span>';
    }).join('');
    var band = o.band ? '<i class="rg-eq" style="left:' + pc(o.band[0]).toFixed(1) + '%;width:' + (pc(o.band[1]) - pc(o.band[0])).toFixed(1) + '%"></i><i class="rg-0" style="left:' + pc(0).toFixed(1) + '%"></i>' : '';
    var eixo = o.eixo ? '<span class="rg-ax" aria-hidden="true">' + o.eixo.map(function(t){ return '<span>' + t + '</span>'; }).join('') + '</span>' : '';
    return '<div class="rg' + (o.eixo ? ' dir' : '') + (o.compacta ? ' compacta' : '') + '" role="img" aria-label="' + esc(o.label) + '"><span class="rg-t" aria-hidden="true">' + band + ticks + mk + '</span>' + eixo + '</div>';
  }
  /* coluna "No nicho": uma régua (mesmo nicho) ou duas, uma por lado (nichos diferentes) */
  function colunaNicho(chave, o){
    if (erroDe(0) || erroDe(1)) return '';
    function uma(lista, nicho, rotulo){
      var vals = valsDe(nicho, chave), a = null, b = null;
      lista.forEach(function(c){ if (xDe(c, chave) != null) { if (c === CB) b = c.id; else a = c.id; } });
      var txt = lista.filter(function(c){ return xDe(c, chave) != null; }).map(function(c){ var p = posicao(vals, c.id); return (c === CA ? 'lado A, ' : 'lado B, ') + c.nome + ': ' + p.pos + 'º de ' + p.n; }).join('; ');
      return regua(vals, { a: a, b: b, log: o.log, lo: o.lo, hi: o.hi, band: o.band, eixo: o.eixo, compacta: DIF_NICHO, label: o.alt + ' no nicho ' + nicho + '. ' + txt + '.' }) +
        '<small class="sub-n">' + (rotulo ? '<b>' + esc(nicho) + '</b>, ' : '') + vals.length + ' canais' + (lista.some(function(c){ return xDe(c, chave) == null; }) ? '<span class="nm nm-s">sem traço de ' + esc(lista.filter(function(c){ return xDe(c, chave) == null; }).map(function(c){ return c.nome; }).join(' e ')) + '</span>' : '') + '</small>';
    }
    if (DIF_NICHO) return uma([CA], CA.nicho, true) + uma([CB], CB.nicho, true);
    return uma([CA, CB], CA.nicho, false);
  }
  function posTxt(c, chave){ var p = posicao(valsDe(c.nicho, chave), c.id); return p ? p.pos + 'º de ' + p.n + ' no nicho' + (DIF_NICHO ? ' ' + c.nicho : '') : ''; }

  /* ---------------------------------------------------------------- diferença entre os lados (±10% = "praticamente igual") */
  function fx(k){ return k >= 100 ? A.n(Math.round(k)) : A.dec(k, k >= 10 ? 0 : 1); }
  function relacao(art, noun, xa, xb, o){
    if (erroDe(0) || erroDe(1) || xa == null || xb == null || xa === 0 || xb === 0) return '';
    var r = xb / xa;
    if (r > .9 && r < 1.1) return '<span class="sy2 eq" aria-hidden="true">＝</span><span class="rt">praticamente ' + ((o && o.pl) ? 'iguais' : 'igual') + '</span>' + A.ibtn((o && o.info) || 'infoIgual', 'Quando dois valores são “praticamente iguais”', true);
    var maior = r > 1 ? CB : CA, menor = r > 1 ? CA : CB, k = r > 1 ? r : 1 / r, ateD = (o && o.semAte) ? '' : (CA.ate || CB.ate) ? ' (até ' + (CA.ate || CB.ate) + ')' : '';
    var txt = (k >= 2 ? fx(k) + '× ' + art + ' ' + noun + ' de ' + menor.nome : '+' + Math.round((k - 1) * 100) + '% de ' + noun) + ateD;
    return '<span class="sy2">' + badge(r > 1 ? 'B' : 'A') + '</span><span class="rt">' + esc(maior.nome) + ': ' + esc(txt) + '</span>';
  }

  /* ---------------------------------------------------------------- linhas da tabela */
  function row(rot, sub, ca, cb, mid, rel, cls){
    return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row" class="rl">' + rot + (sub ? '<small>' + sub + '</small>' : '') + '</th>' + ca + cb + '<td class="cN">' + (mid || '') + '</td><td class="rel' + (rel ? '' : ' off') + '">' + (rel || '') + '</td></tr>';
  }
  function grupo(titulo, icone, extra){ return '<tr class="grp"><th scope="rowgroup" colspan="5"><div class="gh"><span class="gt">' + icone + titulo + '</span>' + (extra || '') + '</div></th></tr>'; }
  function celDirP(c, lado, id){   /* leitura principal: símbolo cheio */
    if (erroDe(lado)) return tdErro(lado);
    var r = leitura(c, id);
    if (r.nm) return tdNm(lado, r.nm);
    if (r.futuro) return tdNao(lado, 'a partir de abril de 2027');
    return td(lado, sinal(r.k, sgn(r.p)) + '<small class="sub">' + esc(r.sub) + '</small>');
  }
  function celDirAp(c, lado, id){   /* leitura de apoio: símbolo só em contorno */
    if (erroDe(lado)) return tdErro(lado);
    var r = leitura(c, id);
    if (r.nm) return tdNm(lado, r.nm);
    if (r.futuro) return tdNao(lado, 'a partir de abril de 2027');
    return td(lado, sinal(r.k, sgn(r.p), 'ap') + '<small class="sub">' + esc(r.sub) + '</small>');
  }
  var ROT_L = {
    a: { t: 'Canal inteiro', s: 'views ganhas nos últimos 28 dias contra os 28 anteriores' },
    b: { t: 'Vídeos novos, views de hoje', s: 'mediana dos longos publicados em 90 dias contra os 90 anteriores' },
    c: { t: 'Vídeos novos, mesma idade', s: 'views aos 30 dias de cada vídeo, sem favorecer o vídeo mais velho' }
  };
  function linhasDirecao(){
    var h = '', id0 = ORDEM[0], eixoR = ['descendo', 'estável', 'subindo'], chave = id0 === 'c' ? 'c' : 'a';
    var marca = (id0 === 'a' && cruza(28)) ? '<span class="ce-marcaw">' + MARCA + '</span>' : '';
    h += row('<span class="ce-tag"><span aria-hidden="true">◆</span>leitura principal</span>' + ROT_L[id0].t + ' ' + A.ibtn('infoTres', 'Como ler as três leituras de direção', true), esc(ROT_L[id0].s) + marca,
      celDirP(CA, 0, id0), CB ? celDirP(CB, 1, id0) : '', colunaNicho(chave, { lo: -.6, hi: .6, band: [-.1, .1], eixo: eixoR, alt: 'Direção (' + NOME_L[id0] + '), de 60% abaixo a 60% acima, um traço por canal' }), '', 'prin');
    h += '<tr class="ce-aph"><th scope="rowgroup" colspan="5"><span class="ce-aph-t">Para conferir <span class="ce-aph-n">(leituras de apoio, não são vereditos)</span></span></th></tr>';
    APOIO.forEach(function(id){
      var m = (id === 'b' && cruza(90)) ? '<span class="ce-marcaw">' + MARCA + '</span>' : '';
      var sub = ROT_L[id].s + (id === 'b' ? '. Descer pode ser só idade' : '');
      h += row(ROT_L[id].t, esc(sub) + m, celDirAp(CA, 0, id), CB ? celDirAp(CB, 1, id) : '', '', id === 'c' && !E.v27 ? '<span class="ce-rel-nao">' + IC.relogio + 'Existe a partir de abril de 2027, com 180 dias de registro.</span>' : '', 'apoio');
    });
    /* longos publicados */
    var pa = dirPub(CA), pb = CB ? dirPub(CB) : null;
    function cp(c, lado, p){
      if (erroDe(lado)) return tdErro(lado);
      if (p.nm) return tdNm(lado, p.nm);
      var cont = c.pub.n === 0 ? zbox(0) + ' longos contra ' + c.pub.np : lg(c.pub.n) + ' contra ' + c.pub.np;
      return td(lado, sinal(p.k, '') + '<small class="sub">' + cont + '</small>');
    }
    var relP = (CB && !pa.nm && !pb.nm) ? relacao('os', 'longos publicados', CA.pub.n, CB.pub.n, { pl: true, info: 'infoFreq' }) : '';
    h += row('Longos publicados', 'nos últimos 90 dias contra os 90 anteriores; é uma contagem, não a frequência', cp(CA, 0, pa), CB ? cp(CB, 1, pb) : '', '', relP, 'pub');
    return h;
  }

  function celNum(c, lado, chave, sub){
    if (erroDe(lado)) return tdErro(lado);
    var r = c[chave === 'vpm' ? 'vpd' : chave];
    if (chave === 'ins') return td(lado, '<span class="v1 num">' + fv(c.ins) + '</span><small class="sub">contagem pública, arredondada pelo YouTube</small><small class="pos">' + posTxt(c, 'ins') + '</small>');
    if (r.n < 3 || r.v == null) return tdNm(lado, lg(r.n) + ' em 90 dias; precisa de 3');
    var x = xDe(c, chave);
    return td(lado, '<span class="v1 num">' + (chave === 'vpm' ? A.dec(x, 2) : chave === 'vpd' ? fd(x) : fv(x)) + '</span><small class="sub">' + sub(r) + ate(c) + '</small><small class="pos">' + posTxt(c, chave) + '</small>');
  }
  function linhaNum(chave, rot, subRot, subCel, art, noun){
    var xa = xDe(CA, chave), xb = CB ? xDe(CB, chave) : null;
    return row(esc(rot), esc(subRot), celNum(CA, 0, chave, subCel), CB ? celNum(CB, 1, chave, subCel) : '', colunaNicho(chave, { log: true, alt: rot }), relacao(art, noun, xa, xb, chave === 'ins' ? { semAte: true } : null), '');
  }
  function linhasDesempenho(){
    return linhaNum('med', 'Mediana de views dos longos', 'a mediana das views de cada longo', function(r){ return 'mediana de ' + lg(r.n) + ' publicados em 90 dias'; }, 'a', 'mediana de views') +
      linhaNum('vpd', 'Views por dia nos longos', 'views ganhas por dia, desde 03/10', function(r){ return 'mediana de ' + lg(r.n) + ', desde 03/10'; }, 'as', 'views por dia') +
      linhaNum('vpm', 'Views por dia por mil inscritos', 'views por dia ÷ mil inscritos', function(r){ return 'views por dia ÷ mil inscritos'; }, 'as', 'views por dia por mil inscritos');
  }

  /* barras pareadas: A e B na mesma escala (a mediana de cada lado) */
  function pareadas(xa, xb, nome){
    if (erroDe(0) || erroDe(1)) return '';
    var m = Math.max(xa || 0, xb || 0) || 1;
    function b(x, l){ return '<div class="pb-r">' + badge(l) + (x == null ? '<span class="pb-nm">' + A.nmSw() + '<span>não medido</span></span>' : '<i class="pb-b" style="width:' + Math.max(3, x / m * 100).toFixed(1) + '%;background:' + COR[l === 'B' ? 1 : 0] + '"></i>') + '</div>'; }
    return '<div class="pb" role="img" aria-label="' + esc(nome + ': ' + (xa == null ? 'lado A não medido' : 'lado A, ' + fv(xa)) + '; ' + (xb == null ? 'lado B não medido' : 'lado B, ' + fv(xb)) + '. Mesma escala nos dois lados.') + '">' + b(xa, 'A') + b(xb, 'B') + '</div><small class="sub-n">mesma escala nos dois lados</small>';
  }
  function m1(c, k){
    var r = c.m1[k]; if (r.nm) return nm(r.nm);
    var rot = { h: 'longos com leitura das primeiras horas', d7: 'longos com 7 dias de contagem', d30: 'longos com 30 dias de contagem' }[k];
    if (r.n < 3) return nm(r.n === 0 ? (k === 'd30' ? 'nenhum longo com 30 dias de contagem' : 'nenhum longo publicado desde ' + (k === 'h' ? '17/10' : '03/10')) : 'só ' + lg(r.n) + ' ' + rot.replace('longos ', '') + '; precisa de 3');
    return { ok: true, m: r.m, n: r.n };
  }
  function celM1(c, lado, k){
    if (erroDe(lado)) return tdErro(lado);
    var r = m1(c, k); if (r.nm) return tdNm(lado, r.nm);
    return td(lado, '<span class="v1 num">' + fv(r.m) + '</span><small class="sub">mediana de ' + lg(r.n) + ate(c) + '</small>');
  }
  function linhaM1(k, rot, subRot, art, noun){
    var ra = m1(CA, k), rb = CB ? m1(CB, k) : { nm: 1 };
    return row(esc(rot), esc(subRot), celM1(CA, 0, k), CB ? celM1(CB, 1, k) : '', pareadas(ra.ok ? ra.m : null, CB && rb.ok ? rb.m : null, rot), relacao(art, noun, ra.ok ? ra.m : null, rb.ok ? rb.m : null), '');
  }
  function linhasPrimeiros(){
    var f = '';
    if (E.magro) f = '<tr class="frase hoje"><td colspan="5"><p><span class="nm-h" aria-hidden="true"></span><span><b>Nada fechou ainda:</b> o primeiro vídeo com 30 dias fecha em <b class="num">02/11</b>.</span></p></td></tr>';
    return f + linhaM1('h', 'Primeiras 24 horas', 'só vídeos publicados depois de 17/10', 'as', 'views nas primeiras 24 horas') +
      linhaM1('d7', 'Primeiros 7 dias', 'mediana dos longos com 7 dias de contagem', 'as', 'views em 7 dias') +
      linhaM1('d30', 'Primeiros 30 dias', 'mediana dos longos com 30 dias de contagem', 'as', 'views em 30 dias');
  }

  /* M4: casas por vídeo. acerto = cor do lado cheia; fracasso = riscada; meio = vazia */
  function celM4(c, lado){
    if (erroDe(lado)) return tdErro(lado);
    var r = c.m4; if (r.nm) return tdNm(lado, r.nm);
    if (r.n < 5) return tdNm(lado, (r.n === 0 ? 'nenhum longo' : 'só ' + lg(r.n)) + ' com 7 dias ou mais; precisa de 5');
    var casas = '', meio = r.n - r.hit - r.fail, i;
    for (i = 0; i < r.hit; i++) casas += '<i class="ce-c hit"></i>';
    for (i = 0; i < meio; i++) casas += '<i class="ce-c"></i>';
    for (i = 0; i < r.fail; i++) casas += '<i class="ce-c fail"></i>';
    var cab = (r.hit === 0 ? zbox(0) : '<span class="v1 num">' + r.hit + '</span>') + '<span class="v1d"> de ' + r.n + '</span>' + (r.n >= 10 ? '<span class="v1p num">' + Math.round(r.hit / r.n * 100) + '%</span>' : '');
    return td(lado, '<span class="ce-m4">' + cab + '</span><span class="ce-cs" role="img" aria-label="' + esc(c.nome + ': ' + r.hit + ' de ' + r.n + ' longos passaram de 2 vezes a mediana do canal; ' + r.fail + ' ficaram na metade ou menos; ' + meio + ' no meio.') + '">' + casas + '</span>' +
      '<small class="sub">passaram de 2× a mediana do próprio canal</small><small class="sub">ficaram na metade ou menos: ' + (r.fail === 0 ? zbox(0, 1) : r.fail) + ' de ' + r.n + '</small>');
  }
  function celM7(c, lado){
    if (erroDe(lado)) return tdErro(lado);
    var r = c.m7; if (r.nm) return tdNm(lado, r.nm);
    if (r.v == null || r.n < 3) return tdNm(lado, (r.n === 0 ? 'nenhum longo' : 'só ' + lg(r.n)) + ' com mais de 100 views; precisa de 3');
    var chip = r.idade === '30' ? '<span class="ce-id ok">' + IC.ok + 'aos 30 dias</span>' : '<span class="ce-id hoje">' + IC.relogio + 'total de hoje</span>';
    if (r.so) chip += '<span class="ce-id so">' + IC.aviso + 'só curtidas: comentários desligados</span>';
    return td(lado, '<span class="v1 num">' + A.dec(r.v * 100, 1) + '%</span><span class="ce-ids">' + chip + '</span><small class="sub">mediana de ' + lg(r.n) + '</small>');
  }
  function linhasAcerto(){
    var h = row('Taxa de acerto', 'longos publicados em 90 dias, com 7 dias ou mais, que passaram de 2× a mediana do próprio canal ' + A.ibtn('infoAcerto', 'Como ler a taxa de acerto', true), celM4(CA, 0), CB ? celM4(CB, 1) : '', '',
      (CB && !erroDe(0) && !erroDe(1)) ? '<span class="ce-rel-nao">' + IC.tam + 'Cada canal contra a própria mediana: mede regularidade, não tamanho.</span>' : '');
    var ra = CA.m7, rb = CB ? CB.m7 : null, ok = ra && rb && !ra.nm && !rb.nm && ra.v != null && rb.v != null && ra.n >= 3 && rb.n >= 3;
    var rel = '';
    if (ok && !erroDe(0) && !erroDe(1)) rel = (ra.idade !== rb.idade || !!ra.so !== !!rb.so) ? '<span class="ce-rel-dif"><span class="sy2" aria-hidden="true">≠</span>Leituras diferentes: não dá para dizer qual é maior.' + A.ibtn('infoReacao', 'Por que as leituras são diferentes', true) + '</span>' : relacao('o', 'engajamento', ra.v, rb.v);
    h += row('Curtidas e comentários por view', 'mediana dos longos com 100 views ou mais, na idade de 30 dias ' + A.ibtn('infoReacao', 'Como ler a reação do público', true), celM7(CA, 0), CB ? celM7(CB, 1) : '', '', rel);
    return h;
  }

  /* ---------------------------------------------------------------- cartões dos lados (com o estado M8) */
  /* a queda sustentada só tem como ser medida a partir de 14/12/2026 (112 dias de registro): antes disso, TODO canal ativo ou parado diz isso, na mesma linha curta */
  function pastilha(c, i){
    if (erroDe(i)) return '<p class="ce-est fdo"><span class="ce-est-p">' + IC.aviso + '<b>não carregou</b></span></p>';
    var e = c.est, ic = { ativo: '<span class="ce-bol" aria-hidden="true"></span>', parado: IC.pausa, queda: IC.queda, fora: IC.x }[e.k];
    var semQueda = HOJE < '2026-12-14' && (e.k === 'ativo' || e.k === 'parado');
    return '<p class="ce-est ' + (e.k === 'fora' ? 'fdo' : e.k) + '"><span class="ce-est-p">' + ic + '<b>' + esc(e.t) + '</b></span><span class="ce-est-s">' + esc(e.s) + '</span>' + A.ibtn('infoEstado', 'Como é calculado o estado do canal', true) + '</p>' +
      (semQueda ? '<p class="ce-estnm">' + A.nmSw() + '<span>queda sustentada: medida a partir de 14/12</span></p>' : '');
  }
  function lado(c, i){
    var l = i ? 'B' : 'A', er = erroDe(i);
    /* lado que não carregou: só o nome e a pastilha "não carregou"; nenhum número (inscritos, longos acompanhados) aparece */
    return '<section class="lado" style="--c:' + COR[i] + '" aria-label="Lado ' + l + (er ? ', não carregou' : '') + '">' + badge(l) + '<div class="id"><span class="av">' + c.ini + '</span><div><h2>' + esc(c.nome) + '</h2>' + (er ? '' : '<p class="m">' +
      (c.own ? '<span class="chip own">seu canal</span>' : '') + '<span>' + esc(c.nicho) + '</span><span class="m-in"><b class="num">' + A.mil(c.ins) + '</b> inscritos</span><span class="m-ac"><b class="num">' + c.acomp + '</b> longos acompanhados</span></p>') + '</div></div>' + pastilha(c, i) + '</section>';
  }
  function ladoVazio(){
    return '<section class="lado ce-vazio" aria-label="Lado B, vazio">' + badge('B') + '<div class="ce-vz"><p><b>Escolha o segundo canal</b></p><p class="ce-vz-s">O Observatório acompanha 14 canais de Viagem e 9 de outros nichos.</p><button type="button" class="btn big">Escolher canal</button></div></section>';
  }

  /* ---------------------------------------------------------------- frase-resumo (Leitura rápida) */
  /* frase-resumo: UMA frase de direção + o fecho das outras leituras em símbolo. O estado do canal (M8) fica só na pastilha do cartão. */
  var SIMNM = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  function fraseLado(c, i){
    var nome = badge(i ? 'B' : 'A') + ' <b>' + esc(c.nome) + '</b>', id0 = ORDEM[0], p = leitura(c, id0);
    if (erroDe(i)) return '<li><span class="sy er" aria-hidden="true">!</span><span class="lr-t">' + nome + ': os números não carregaram. Nada foi medido agora.</span></li>';
    if (p.nm) return '<li><span class="sy nmk" aria-hidden="true">' + SIMNM + '</span><span class="lr-t">' + nome + ': sem direção medida (' + esc(p.nm) + ').</span></li>';
    var corpo = id0 === 'a' ? sgn(p.p) + ' de views no canal inteiro, 28 dias contra 28' : sgn(p.p) + ' de views aos 30 dias nos vídeos novos, 90 dias contra 90';
    var ap = APOIO.map(function(id){ return { id: id, r: leitura(c, id) }; }).filter(function(x){ return x.r.ok; }), conf;
    if (!ap.length) conf = '<span class="lr-ap nm">' + SIMNM + 'ainda sem leitura de apoio</span>';
    else if (ap.every(function(x){ return x.r.k === p.k; })) conf = '<span class="lr-ap ok"><span aria-hidden="true">✓</span>concordam</span>';
    else {
      var longe = ap.filter(function(x){ return x.r.k !== p.k; }), perto = longe.every(function(x){ return Math.abs(x.r.p - p.p) < .1; });
      conf = '<span class="lr-ap ' + (perto ? 'par' : 'div') + '"><span aria-hidden="true">' + (perto ? '≈' : '≠') + '</span>' + (perto ? 'concordam em parte' : 'divergem') + '</span> <span class="lr-ap-d">(' + longe.map(function(x){ return NOME_C[x.id] + ': ' + PALAVRA[x.r.k]; }).join('; ') + (longe.some(function(x){ return x.r.k === 'dn'; }) ? '; pode ser só idade' : '') + ')</span>';
    }
    return '<li><span class="sy ' + p.k + '" aria-hidden="true">' + SIM[p.k] + '</span><span class="lr-t">' + nome + ' está <b>' + PALAVRA[p.k] + '</b>: ' + corpo + '. <span class="lr-of">Outras leituras:</span> ' + conf + '</span></li>';
  }
  function resumo(){
    var li = PAR.map(fraseLado);
    if (CB && (erroDe(0) || erroDe(1))) {
      var ne = erroDe(0) ? CA : CB;
      li.push('<li><span class="sy er" aria-hidden="true">!</span><span class="lr-t">Tamanho: sem comparação, os inscritos de ' + esc(ne.nome) + ' não carregaram.</span></li>');
    } else if (CB) {
      var r = CB.ins / CA.ins, mx = r > 1 ? CB : CA, mn = r > 1 ? CA : CB, k = r > 1 ? r : 1 / r;
      li.push('<li><span class="sy tam" aria-hidden="true">■</span><span class="lr-t">' + (DIF_NICHO ? 'Nichos diferentes (' + esc(CA.nicho) + ' e ' + esc(CB.nicho) + '): a régua ordena cada canal dentro do próprio nicho, não diz quem é melhor. ' : 'Só de contexto: ') + esc(mx.nome) + ' tem ' + fx(k) + '× os inscritos de ' + esc(mn.nome) + '. O tamanho não entra na direção.</span></li>');
    }
    return '<div class="cd-lr" role="group" aria-labelledby="lrT"><h2 id="lrT">Leitura rápida <span class="ex">exemplo</span></h2><ul>' + li.join('') + '</ul></div>';
  }

  /* ---------------------------------------------------------------- cartão "Só o seu canal mede" (aprovado no mockup 9), sempre depois do "Número a número" */
  function linhaSo(rot, sub, val, extra){ return '<li><div class="rt">' + rot + '<small>' + sub + '</small></div><div>' + val + (extra ? '<div id="' + extra + '"></div>' : '') + '</div></li>'; }
  function cartao(){
    var outro = CB;
    if (E.cartao === 'cheio') {
      return '<section class="so" aria-labelledby="hSo"><h2 id="hSo">Só o seu canal mede ' + A.ibtn('infoSo', 'De onde vêm estes números', true) + ' <span class="ex">exemplo</span></h2>' +
        '<p class="lead">Impressões, taxa de clique e % assistido só chegam ao dono do canal. ' + esc(outro.nome) + ' não tem esses números aqui porque o YouTube não os entrega, <b>não porque sejam zero</b>.</p><ul class="linhas">' +
        linhaSo('Impressões', 'de 14/10 a 13/11', '<span class="vl">18.420</span>') + linhaSo('Cliques estimados', 'impressões × taxa de cada dia', '<span class="vl">842</span>') +
        linhaSo('Taxa de clique', 'com intervalo de 95%', '<span class="vl">4,6%<small>entre 4,3% e 4,9%</small></span>', 'ctrC') + linhaSo('% assistido', 'média pelas views, 28 dias', '<span class="vl">41%</span>') + '</ul></section>';
    }
    if (E.cartao === 'sem-acesso') {
      return '<section class="so ce-priv" aria-labelledby="hSo"><h2 id="hSo">Só o seu canal mede ' + A.ibtn('infoSo', 'De onde vêm estes números', true) + '</h2>' +
        '<p class="lead ce-lock"><span class="ce-lockic" aria-hidden="true">' + IC.cadeado + '</span><span><b>Você não vê estes números.</b> Impressões, taxa de clique e % assistido de ' + esc(CA.nome) + ' são privados do canal, e a sua conta só lê o que é público.</span></p>' +
        '<ul class="linhas">' + ['Impressões', 'Cliques estimados', 'Taxa de clique', '% assistido'].map(function(t){ return '<li><div class="rt">' + t + '</div><div><span class="ce-sem"><span class="ce-lockic" aria-hidden="true">' + IC.cadeado + '</span>sem permissão para ver</span></div></li>'; }).join('') + '</ul>' +
        '<p class="ce-priv-n">Para ver, peça ao dono do canal o acesso de editor. O resto desta tela continua igual para você.</p></section>';
    }
    return '<p class="ce-semprop">' + A.INFO + '<span>Nenhum dos dois é o seu canal. Impressões, taxa de clique e % assistido só aparecem quando um dos lados é o seu, porque o YouTube só as entrega ao dono.</span></p>';
  }

  /* ---------------------------------------------------------------- tabela */
  function tabela(){
    var h = '<div class="cd-tw"><table class="cd-t ce-t"><caption class="sr">Números de ' + esc(CA.nome) + ' (lado A) e de ' + esc(CB.nome) + ' (lado B), lado a lado. Depois dos dois valores vem a posição entre os canais do nicho, e a última coluna diz qual lado é maior e por quanto.</caption>' +
      '<colgroup><col class="k0"><col class="k1"><col class="k1"><col class="k2"><col class="k3"></colgroup>' +
      '<thead><tr><th scope="col" class="c0"><span class="sr">Número</span></th><th scope="col" class="cA" style="--c:' + COR[0] + '">' + badge('A') + esc(CA.nome) + '</th><th scope="col" class="cB" style="--c:' + COR[1] + '">' + badge('B') + esc(CB.nome) + '</th>' +
      '<th scope="col" class="cN">No nicho ' + A.ibtn('infoNicho', 'Como ler a régua do nicho', true) + '<small>do menor ao maior</small></th><th scope="col" class="cR">Diferença ' + A.ibtn('infoIgual', 'Quando dois valores são “praticamente iguais”', true) + '<small>o lado maior sobre o menor</small></th></tr></thead>';
    var jan = (function(){ function d(n){ return dmy(A.addDias(HOJE, n)); } return d(-27) + ' a ' + dmy(HOJE) + ' contra ' + d(-55) + ' a ' + d(-28); })();
    h += '<tbody id="direcao">' + grupo('Direção: cada canal contra ele mesmo', IC.dir, '<span class="gx">leitura principal: ' + (ORDEM[0] === 'a' ? 'canal inteiro, ' + jan : 'vídeos novos na mesma idade, 90 dias contra 90') + '</span>') + linhasDirecao() + '</tbody>';
    h += '<tbody>' + grupo('Desempenho dos vídeos', IC.des, '<span class="gx">longos publicados nos últimos 90 dias</span>') + linhasDesempenho() + '</tbody>';
    h += '<tbody>' + grupo('Tamanho do canal', IC.tam) + linhaNum('ins', 'Inscritos', 'contagem pública do YouTube', function(){ return ''; }, 'os', 'inscritos') + '</tbody>';
    h += '<tbody>' + grupo('Views nos primeiros dias de cada vídeo', IC.ida, '<span class="gx">compara vídeos na mesma idade, sem favorecer o vídeo mais velho ' + A.ibtn('infoDias', 'Como são medidos os primeiros dias', true) + '</span>') + linhasPrimeiros() + '</tbody>';
    h += '<tbody>' + grupo('Acerto e reação do público', IC.acerto, '<span class="gx ce-leg">' + legenda() + '</span>') + linhasAcerto() + '</tbody>';
    return h + '</table></div>';
  }
  function legenda(){ return '<span class="ce-lg"><i class="ce-c hit" style="--c:var(--text)"></i>passou de 2× a mediana</span><span class="ce-lg"><i class="ce-c"></i>no meio</span><span class="ce-lg"><i class="ce-c fail"></i>metade da mediana ou menos</span>'; }

  /* ---------------------------------------------------------------- avisos de estado */
  function bandaExemplo(){
    return '<p class="exband ce-top"><span class="ex">exemplo</span><span>Números inventados. ' + (E.magro ? 'A tela com a data de hoje, 13/10/2026, o caso real por meses: quase tudo ainda sem medir.' : E.queda ? 'A tela como fica em 20/12/2026, depois de 14/12, quando a queda sustentada já pode ser medida.' : E.v27 ? 'A tela como fica em 20/04/2027, quando a leitura justa existe.' : 'A tela como fica em 13/11/2026, um mês depois de a coleta nova entrar no ar.') + '</span></p>';
  }
  function avisoErro(){
    return '<div class="ce-banner er" role="alert"><span class="ce-bic" aria-hidden="true">' + IC.aviso + '</span><div><b>Os números de ' + esc(CB.nome) + ' não carregaram.</b><span>O lado de ' + esc(CA.nome) + ' está inteiro. Tente de novo; se repetir, o problema é nosso, não do canal.</span></div><button type="button" class="btn big">Tentar de novo</button></div>';
  }
  function esqueleto(){
    var t = ['Direção: cada canal contra ele mesmo', 'Desempenho dos vídeos', 'Tamanho do canal', 'Views nos primeiros dias de cada vídeo', 'Acerto e reação do público'];
    return '<section class="cd-sec" aria-labelledby="hNum"><h2 id="hNum">Número a número</h2><ul class="ce-sk" aria-label="O que a comparação vai mostrar">' + t.map(function(x){ return '<li><span>' + x + '</span><i aria-hidden="true"></i></li>'; }).join('') + '</ul></section>';
  }

  /* ---------------------------------------------------------------- ⓘ */
  var BASE = '<li><b>De onde vem:</b> cálculo do Observatório sobre dados públicos do YouTube.</li>';
  var info =
    A.oculto('infoTres', 'As três leituras de direção',
      '<ul><li><b>Leitura principal hoje:</b> o canal inteiro. Soma das views ganhas nos últimos 28 dias contra a soma dos 28 anteriores. ▲ se a diferença é de +10% ou mais, ▼ se é de −10% ou menos, ＝ no meio.</li>' +
      '<li><b>Para conferir:</b> os vídeos novos, pela mediana das views de hoje (90 dias contra 90). Descer pode ser só idade: os vídeos mais velhos tiveram mais tempo para juntar views.</li>' +
      '<li><b>Quando existir:</b> os vídeos novos vistos na mesma idade (30 dias). Não tem viés de idade e passa a ser a principal em abril de 2027, quando houver 180 dias de contagem diária.</li>' +
      '<li><b>Janela:</b> 28 contra 28 dias (canal inteiro); 90 contra 90 (vídeos novos). Canal inteiro inclui Shorts e vídeos apagados.</li>' +
      '<li><b>Não mede</b> com menos de 56 dias de registro (canal inteiro) ou menos de 3 longos em um período (vídeos novos).</li>' + BASE + '</ul>') +
    A.oculto('infoIgual', 'Quando dois valores são “praticamente iguais”',
      '<ul><li><b>Limiar:</b> ±10%. Se o maior é menos de 10% acima do menor, a tela escreve “praticamente igual” e mostra ＝.</li>' +
      '<li><b>De 10% a 2×:</b> a diferença aparece em percentual. <b>De 2× para cima:</b> aparece em vezes.</li>' +
      '<li>Maior não quer dizer melhor: são canais de tamanhos e nichos diferentes.</li>' + BASE + '</ul>') +
    A.oculto('infoFreq', 'Longos publicados não é frequência',
      '<ul><li><b>O que é:</b> quantos longos cada canal publicou nos últimos 90 dias. Dois canais com a mesma contagem podem ter ritmos diferentes: um posta toda semana, o outro posta tudo num mês.</li><li><b>Para o ritmo:</b> o intervalo entre os vídeos é outra medida (ritmo), que esta tela não mostra.</li><li><b>Direção:</b> a mesma regra das outras leituras. Menos de 10% de diferença entre as duas contagens é ＝; 10% ou mais é ▲ ou ▼, mesmo com poucos vídeos (3 contra 4 já é −25%).</li>' + BASE + '</ul>') +
    A.oculto('infoNicho', 'A régua do nicho',
      '<ul><li><b>O que é:</b> um traço por canal do mesmo nicho, do menor ao maior. A letra marca onde cada lado está.</li><li><b>Escala:</b> para números que vão de centenas a milhões, a régua usa escala de proporção (logarítmica): cada passo vale o mesmo em vezes, não em unidades. Na direção, a régua é linear, de −60% a +60%.</li><li><b>Fora da régua:</b> ◀ ou ▶ na ponta; o texto alternativo diz o valor.</li><li>A régua ordena dentro do nicho. Não diz qual nicho é melhor.</li>' + BASE + '</ul>') +
    A.oculto('infoEstado', 'Estado do canal',
      '<ul><li><b>Ativo:</b> publicou dentro do esperado.</li><li><b>Parado:</b> mais dias sem longo novo do que o maior entre 28 e 4 vezes o intervalo mediano do canal.</li><li><b>Em queda sustentada:</b> o canal inteiro ganhou 10% menos views em três janelas de 28 dias seguidas (112 dias). A primeira leitura limpa é de 14/12/2026: até lá, o cartão diz “medida a partir de 14/12” em vez de calar.</li><li><b>Fora do ar:</b> o YouTube não devolveu o canal em duas leituras seguidas. Os números valem até o último registro.</li><li>Canal sazonal pode parecer parado. Inscritos não entram.</li>' + BASE + '</ul>') +
    A.oculto('infoAcerto', 'Taxa de acerto',
      '<ul><li><b>O que é:</b> dos longos publicados nos últimos 90 dias e com 7 dias ou mais, quantos passaram de 2× a mediana do próprio canal. A casa riscada é o contrário: ficou na metade da mediana ou menos.</li><li><b>Mede regularidade, não tamanho:</b> cada canal é medido contra ele mesmo, então não dá para dizer que um acerta mais que o outro em valor absoluto.</li><li><b>Mostra “3 de 12”.</b> O percentual só aparece com 10 vídeos ou mais.</li><li><b>Não mede</b> com menos de 5 longos.</li>' + BASE + '</ul>') +
    A.oculto('infoReacao', 'Curtidas e comentários por view',
      '<ul><li><b>Conta:</b> (curtidas + comentários) ÷ views de cada longo, e a mediana entre eles. Só vídeos com 100 views ou mais.</li><li><b>Aos 30 dias:</b> usa a leitura do dia 30 de cada vídeo, para todos estarem na mesma idade (a taxa cai com o tempo).</li><li><b>Total de hoje:</b> quando falta a leitura do dia 30, usa o total de hoje, só para vídeos de até 90 dias. É outra leitura: não se compara com uma de dia 30.</li><li><b>Só curtidas:</b> quando os comentários estão desligados, mostra só as curtidas e diz isso.</li><li><b>Não mede</b> com curtidas ocultas e comentários desligados.</li>' + BASE + '</ul>') +
    A.oculto('infoDias', 'Como são medidos os primeiros dias',
      '<ul><li><b>O que é:</b> as views que o vídeo juntou nas primeiras 24 horas, nos primeiros 7 e nos primeiros 30 dias depois de publicado. Todos na mesma idade.</li><li><b>24 horas:</b> usa as leituras das primeiras horas e só existe para vídeos publicados depois de 17/10/2026 (exemplo da data). 7 e 30 dias usam a contagem diária, que começou em 03/10.</li><li><b>Mínimo de 3 vídeos</b> por canal; com menos, “não medido” e quantos há.</li><li>Ao vivo e estreia ficam de fora.</li>' + BASE + '</ul>') +
    A.oculto('infoSo', 'De onde vêm estes números',
      '<ul><li><b>Impressões e taxa de clique:</b> dados de alcance do YouTube, por dia do YouTube. Dia que não chegou não conta como zero.</li><li><b>Taxa de clique:</b> cliques estimados ÷ impressões, com intervalo de 95%.</li><li><b>% assistido:</b> média do percentual de cada dia, pesada pelas views do dia.</li></ul>');

  /* ---------------------------------------------------------------- montagem */
  var estadosBarra = Object.keys(D.ESTADOS).map(function(k){ return [k, D.ESTADOS[k].rotulo]; });
  var barra = { aberta: q.get('barra') !== '0', linhas: [{ rotulo: 'Estado', itens: A.opcoes('estado', estadosBarra, 'tipico') }, A.tema()],
    nota: 'Mockup 17a, extensão da tela de Comparar aprovada (mockup 9) e do cartão “Só o seu canal mede”. Todo número é inventado. “Seu canal” e os nomes dos concorrentes seguem a convenção do lote; nenhum dado real do dono.' };
  var corpo = A.migalha([['Canais', '#'], ['Comparar']]) + '<header class="cd-head"><h1>Comparar canais</h1><p class="cd-sub">Dois canais, lado a lado. O que importa aqui é a direção de cada um, não quem é maior.</p></header>' + bandaExemplo() +
    '<div class="lados">' + lado(CA, 0) + (CB ? lado(CB, 1) : ladoVazio()) + '</div>';
  if (E.vazio) corpo += esqueleto();
  else {
    if (E.erro) corpo += avisoErro();
    corpo += resumo() + '<section class="cd-sec" aria-labelledby="hNum"><h2 id="hNum">Número a número ' + A.ibtn('infoIgual', 'Como ler a tabela e a diferença', true) + '</h2>' + tabela() + '<p class="cd-n">Maior não quer dizer melhor: são canais de tamanhos diferentes.</p></section>' + (E.erro ? '' : cartao());
  }
  A.moldura({ titulo: 'Comparar canais: estados novos', barra: barra, corpo: corpo + info });
  A.ligarInfos();
  var c = document.getElementById('ctrC'); if (c) A.faixaTaxa(c, { cliques: 842, imp: 18420, alt: 'Taxa de clique do canal 4,6%, intervalo de 4,3% a 4,9%' });
})();
