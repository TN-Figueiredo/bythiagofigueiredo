/* comparar-direcao.js: "Comparar canais" com base escolhida, direção de cada canal contra ele mesmo e views nos primeiros dias de cada vídeo (pedido do dono, 12/10/2026).
   Parâmetros: ?par=lodir-aldinho|lodir-matheus|lodir-leo  ?base=90|todos  ?trinta=hoje|cheio  ?tema=claro
   REAL (lido em produção em 09/10, de ../2026-10-07-pagina-canal/canais-dados.js): inscritos, longos acompanhados, longos em 90 dias, mediana de views dos longos, views por dia e por mil inscritos
   (a base "todos os acompanhados" é toda real). Lodir Negrini = 21 acompanhados, do print do dono de 12/10 (a leitura de 09/10 dizia 20).
   EXEMPLO (marcado na tela): tudo o que depende de uma janela que o banco ainda não foi consultado para fechar: mediana dos últimos 90 dias e dos 90 anteriores, quantos longos havia nos 90 anteriores,
   engajamento, views dos primeiros 7 e 30 dias. As contagens de longos nos últimos 90 dias são reais; por isso quem tem menos de 3 (bald and bankrupt, Esq Unltd Daily, Leo Khev, tnFigueiredo) é "não medido" de verdade. */
(function(){
  'use strict';
  var A = window.A4, q = A.q, esc = A.esc;
  var base = q.get('base') === 'todos' ? 'todos' : '90';
  var PARES = { 'lodir-aldinho': ['lodir-negrini', 'aldinho'], 'lodir-matheus': ['lodir-negrini', 'matheus-fonseca'], 'lodir-leo': ['lodir-negrini', 'leo-khev'] };
  var parId = PARES[q.get('par')] ? q.get('par') : 'lodir-aldinho';
  var trinta = q.get('trinta') === 'cheio' ? 'cheio' : 'hoje';
  var COR = ['var(--lado-n)', 'var(--lado-b)'];   /* nenhum dos dois é o seu canal: lado A areia, lado B azul (mesma regra da comparação aprovada) */

  /* ---------------------------------------------------------------- os canais */
  var D = window.CANAIS, REG = {};
  D.canais.forEach(function(c){ REG[c.id] = Object.assign({}, c); });
  REG[D.proprio.id] = Object.assign({}, D.proprio);
  REG['lodir-negrini'].acomp = 21;
  var TODOS = Object.keys(REG);

  /* exemplos que contam a história de cada par (números inventados, coerentes com os reais) */
  var FIXO = {
    'lodir-negrini':   { nPrev: 9,  med90: 5360,  medPrev: 4000,  vpd90: 118.4, eng: .061, eng90: .072, f7n: 2, f7med: null, fecha: '03/11' },
    'aldinho':         { nPrev: 11, med90: 6100,  medPrev: 7530,  vpd90: 41.2,  eng: .047, eng90: .041, f7n: 4, f7med: 410, fecha: '02/11' },
    'matheus-fonseca': { nPrev: 12, med90: 54200, medPrev: 56400, vpd90: 241.6, eng: .052, eng90: .049, f7n: 5, f7med: 3900, fecha: '04/11' }
  };
  /* longos com 30 dias fechados no cenário "cheio" (exemplo, seis meses depois): [dias desde a publicação, views nos 30 primeiros dias], do mais antigo ao mais novo */
  var V30 = {
    'lodir-negrini': [[170, 2400], [158, 3100], [146, 2700], [132, 3700], [118, 3300], [104, 4200], [86, 3700], [76, 4200], [64, 4000], [52, 4600], [41, 5000], [33, 4400]],
    'aldinho': [[176, 5200], [168, 4600], [160, 5400], [150, 4400], [142, 5000], [134, 4800], [124, 5300], [116, 4500], [108, 4900], [100, 4200], [94, 4700],
      [84, 3900], [76, 4100], [68, 3400], [60, 3800], [52, 3200], [46, 3600], [40, 3000], [36, 3300], [32, 2900]],
    'matheus-fonseca': [[172, 41000], [160, 44500], [150, 39800], [140, 46100], [130, 43200], [120, 40500], [110, 45300], [100, 42600], [92, 44000],
      [82, 43500], [72, 41800], [64, 46900], [56, 40200], [48, 44800], [42, 45600], [38, 42100], [34, 47200]]
  };
  var rg = A.rnd(20261012);
  TODOS.forEach(function(id, i){
    var c = REG[id], f = FIXO[id] || {};
    c.n90 = c.l90 == null ? 0 : c.l90;                     /* real */
    c.ex = !!f.med90;
    if (id === 'leo-khev') { c.nPrev = 2; c.real90 = true; }       /* 2 longos nos 90 anteriores: contado em dados.js (real) */
    else if (id === 'proprio') { c.nPrev = 0; c.real90 = true; }
    else if (f.nPrev != null) c.nPrev = f.nPrev;
    else c.nPrev = c.n90 < 3 ? Math.floor(rg() * 3) : 3 + Math.floor(rg() * 16);
    var rr = [rg(), rg(), rg(), rg(), rg()];
    c.med90 = f.med90 != null ? f.med90 : c.med == null ? null : Math.round(c.med * (.5 + rr[0] * .45));
    c.medPrev = f.medPrev != null ? f.medPrev : c.med90 == null ? null : Math.round(c.med90 / (1 + (rr[1] - .45) * .8));
    c.vpd90 = f.vpd90 != null ? f.vpd90 : c.vpd == null ? null : Math.round(c.vpd * (1 + rr[2] * .7) * 10) / 10;
    c.engAll = f.eng != null ? f.eng : id === 'proprio' ? .149 : .03 + rr[3] * .06;
    c.eng90 = f.eng90 != null ? f.eng90 : c.engAll * (.8 + rr[4] * .4);
    c.f7n = f.f7n != null ? f.f7n : (id === 'leo-khev' || id === 'proprio') ? 0 : Math.floor(rr[0] * 5);
    c.f7med = f.f7med != null ? f.f7med : c.f7n >= 3 && c.med90 ? Math.round(c.med90 * .3) : null;
    c.fecha = f.fecha || null;
    c.v30 = V30[id] || null;
  });
  var PROP = REG.proprio;

  /* ---------------------------------------------------------------- formatos */
  function fv(x){ return x == null ? null : x >= 1e6 ? A.dec(x / 1e6, 1) + ' mi' : x >= 1000 ? A.mil(Math.round(x / 10) * 10) : A.n(Math.round(x)); }
  function fd(x){ return x >= 100 ? A.n(Math.round(x)) : A.dec(x, 1); }
  function sgn(p){ var r = Math.round(p * 100); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + '%'; }
  function lg(n){ return n + (n === 1 ? ' longo' : ' longos'); }
  function nomeCurto(c){ return c.nome; }
  function badge(l){ return '<span class="cb-lado' + (l === 'B' ? ' b' : '') + '" style="--c:' + (l === 'B' ? COR[1] : COR[0]) + '" aria-hidden="true">' + l + '</span>'; }
  var PAR = PARES[parId].map(function(id){ return REG[id]; }), CA = PAR[0], CB = PAR[1];

  /* ---------------------------------------------------------------- direção (cada canal contra ele mesmo) */
  function dirViews(c){
    if (c.n90 < 3 || c.nPrev < 3 || c.med90 == null || c.medPrev == null) {
      var falta = c.n90 < 3 ? c.n90 + (c.n90 === 1 ? ' longo' : ' longos') + ' nos últimos 90 dias' : c.nPrev + (c.nPrev === 1 ? ' longo' : ' longos') + ' nos 90 anteriores';
      return { nm: true, why: falta + '; precisa de 3 em cada período' };
    }
    var p = c.med90 / c.medPrev - 1;
    return { p: p, k: p >= .1 ? 'up' : p <= -.1 ? 'dn' : 'eq' };
  }
  function dirPub(c){
    if (c.n90 < 3 && c.nPrev < 3) return { nm: true, k: 'nm', d: 0, p: null, why: c.n90 === 0 && c.nPrev === 0 ? 'nenhum longo nos dois períodos' : lg(c.n90) + ' contra ' + c.nPrev + '; precisa de 3 em um dos períodos' };
    var d = c.n90 - c.nPrev, k = Math.abs(d) >= 2 && Math.abs(d) / Math.max(c.nPrev, 1) >= .1 ? (d > 0 ? 'up' : 'dn') : 'eq';
    return { k: k, d: d, p: c.nPrev >= 3 ? d / c.nPrev : null };
  }
  var PALAVRA = { up: 'subindo', dn: 'descendo', eq: 'estável' }, SIM = { up: '▲', dn: '▼', eq: '＝' };
  function sinal(k, pct, extraCls){ return '<span class="dr ' + k + (extraCls ? ' ' + extraCls : '') + '"><span class="sy" aria-hidden="true">' + SIM[k] + '</span><b>' + PALAVRA[k] + '</b>' + (pct ? '<span class="pc num">' + pct + '</span>' : '') + '</span>'; }

  /* ---------------------------------------------------------------- régua do nicho */
  function posicao(vals, id){
    var x = vals.filter(function(v){ return v.id === id; })[0]; if (!x) return null;
    var maiores = vals.filter(function(v){ return v.x > x.x; }).length, iguais = vals.filter(function(v){ return v.x === x.x; }).length;
    return { pos: maiores + 1, n: vals.length, emp: iguais > 1 };
  }
  function regua(vals, o){
    /* vals: [{id,x}]; o: { a: id|null, b: id|null, log, lo, hi, label } */
    var lo = o.lo, hi = o.hi, T = o.log ? Math.log10 : function(x){ return x; };
    if (lo == null) { lo = Math.min.apply(null, vals.map(function(v){ return v.x; })); hi = Math.max.apply(null, vals.map(function(v){ return v.x; })); }
    var span = (T(hi) - T(lo)) || 1;
    function pc(x){ return 2 + Math.max(0, Math.min(1, (T(x) - T(lo)) / span)) * 96; }
    var ticks = vals.filter(function(v){ return v.id !== o.a && v.id !== o.b; }).map(function(v){ return '<i class="tk" style="left:' + pc(v.x).toFixed(1) + '%"></i>'; }).join('');
    var marks = [[o.a, 'A', COR[0], 'a'], [o.b, 'B', COR[1], 'b']].map(function(m){
      var v = vals.filter(function(w){ return w.id === m[0]; })[0]; if (!v) return '';
      return '<i class="tk m" style="left:' + pc(v.x).toFixed(1) + '%;--c:' + m[2] + '"></i><span class="rg-b ' + m[3] + '" style="left:' + pc(v.x).toFixed(1) + '%;--c:' + m[2] + '"><span class="cb-lado' + (m[1] === 'B' ? ' b' : '') + '" style="--c:' + m[2] + '">' + m[1] + '</span></span>';
    }).join('');
    var band = o.band ? '<i class="rg-eq" style="left:' + pc(o.band[0]).toFixed(1) + '%;width:' + (pc(o.band[1]) - pc(o.band[0])).toFixed(1) + '%"></i><i class="rg-0" style="left:' + pc(0).toFixed(1) + '%"></i>' : '';
    var eixo = o.eixo ? '<span class="rg-ax" aria-hidden="true">' + o.eixo.map(function(t){ return '<span>' + t + '</span>'; }).join('') + '</span>' : '';
    return '<div class="rg' + (o.eixo ? ' dir' : '') + '" role="img" aria-label="' + esc(o.label) + '"><span class="rg-t" aria-hidden="true">' + band + ticks + marks + '</span>' + eixo + '</div>';
  }

  /* ---------------------------------------------------------------- linhas */
  /* cada getter devolve { t (texto), x (número para a régua e a relação), sub, ex (é exemplo), nm, why, dir } */
  function nmOf(why){ return { nm: true, why: why }; }
  var LINHAS = {
    ins: { l: 'Inscritos', sub: 'contagem pública do YouTube, lida em 09/10', fmt: fv, art: 'os', noun: 'inscritos', nicho: true, log: true,
      get: function(c){ return { t: fv(c.inscritos), x: c.inscritos }; } },
    med: { l: 'Mediana de views dos longos', fmt: fv, art: 'a', noun: 'mediana de views', nicho: true, log: true,
      get: function(c){
        if (base === 'todos') return { t: fv(c.med), x: c.med, sub: 'mediana de ' + lg(c.acomp) + ' acompanhados' };
        if (c.n90 < 3) return nmOf(c.n90 + (c.n90 === 1 ? ' longo' : ' longos') + ' em 90 dias; precisa de 3');
        return { t: fv(c.med90), x: c.med90, ex: true, sub: 'mediana de ' + lg(c.n90) + ' publicados em 90 dias' };
      } },
    vpd: { l: 'Views por dia nos longos', fmt: fd, art: 'as', noun: 'views por dia', nicho: true, log: true,
      get: function(c){
        if (c.vpd == null) return nmOf('aguarda o 2º registro diário');
        if (base === 'todos') return { t: fd(c.vpd), x: c.vpd, sub: 'mediana de ' + lg(c.acomp) + ' acompanhados, desde 03/10' };
        if (c.n90 < 3) return nmOf(c.n90 + (c.n90 === 1 ? ' longo' : ' longos') + ' em 90 dias; precisa de 3');
        return { t: fd(c.vpd90), x: c.vpd90, ex: true, sub: 'mediana de ' + lg(c.n90) + ' publicados em 90 dias, desde 03/10' };
      } },
    vpm: { l: 'Views por dia por mil inscritos', fmt: function(x){ return A.dec(x, 2); }, art: 'as', noun: 'views por dia por mil inscritos', nicho: true, log: true,
      get: function(c){
        var r = LINHAS.vpd.get(c); if (r.nm) return r;
        var x = r.x / c.inscritos * 1000; return { t: A.dec(x, 2), x: x, ex: r.ex, sub: 'views por dia ÷ mil inscritos' };
      } },
    eng: { l: 'Engajamento nos longos', fmt: function(x){ return A.dec(x * 100, 1) + '%'; }, art: 'o', noun: 'engajamento', nicho: false,
      get: function(c){
        if (base === 'todos') return { t: A.dec(c.engAll * 100, 1) + '%', x: c.engAll, ex: true, sub: 'mediana de ' + lg(c.acomp) + ' acompanhados' };
        if (c.n90 < 3) return nmOf(c.n90 + (c.n90 === 1 ? ' longo' : ' longos') + ' em 90 dias; precisa de 3');
        return { t: A.dec(c.eng90 * 100, 1) + '%', x: c.eng90, ex: true, sub: 'mediana de ' + lg(c.n90) + ' publicados em 90 dias' };
      } }
  };
  var SUB_BASE = {
    med: 'a mediana das views de cada longo', vpd: 'views ganhas por dia, desde 03/10', vpm: 'views por dia nos longos ÷ mil inscritos', eng: '(curtidas + comentários) ÷ views'
  };

  /* relação do lado B com o lado A: mesma regra da comparação aprovada (10% de diferença é "praticamente igual"; "×" a partir de 2×) */
  function relacao(L, ra, rb){
    if (ra.x == null || rb.x == null || ra.nm || rb.nm) return '';
    if (ra.x === 0 || rb.x === 0) return '';
    var r = rb.x / ra.x;
    if (r > .9 && r < 1.1) return '<span class="sy2 eq" aria-hidden="true">＝</span><span class="rt">praticamente igual</span>';
    var maior = r > 1 ? CB : CA, menor = r > 1 ? CA : CB, k = r > 1 ? r : 1 / r, lado = r > 1 ? 1 : 0;
    var txt = k >= 2 ? A.dec(k, k >= 10 ? 0 : 1) + '× ' + L.art + ' ' + L.noun + ' de ' + menor.nome : '+' + Math.round((k - 1) * 100) + '% de ' + L.noun;
    return '<span class="sy2">' + badge(lado ? 'B' : 'A') + '</span><span class="rt">' + esc(maior.nome) + ': ' + esc(txt) + '</span>';
  }

  /* ---------------------------------------------------------------- células */
  function celula(r, lado, extra, quieta){
    var cls = lado ? 'cB' : 'cA', l = lado ? 'B' : 'A', st = ' style="--c:' + COR[lado] + '"';
    if (r.nm && quieta === 'curta') return '<td class="nd ' + cls + '"' + st + ' data-l="' + l + '"><span class="nm-sw">' + A.nmSw() + '<span>não medido</span></span></td>';
    if (r.nm && quieta) return '<td class="nd ' + cls + '"' + st + ' data-l="' + l + '"><span class="nm-sw">' + A.nmSw() + '<span>' + esc(r.why) + '</span></span></td>';
    if (r.nm) return '<td class="nd ' + cls + '"' + st + ' data-l="' + l + '"><span class="nm">não medido</span><small class="why">' + esc(r.why) + '</small></td>';
    var h = '<td class="' + cls + '"' + st + ' data-l="' + l + '"><span class="v1 num">' + esc(r.t) + '</span>';
    if (r.sub) h += '<small class="sub">' + esc(r.sub) + '</small>';
    if (extra) h += '<small class="pos">' + esc(extra) + '</small>';
    return h + '</td>';
  }
  function celDir(r, lado, sub){
    var cls = lado ? 'cB' : 'cA', l = lado ? 'B' : 'A', st = ' style="--c:' + COR[lado] + '"';
    if (r.nm) return '<td class="nd ' + cls + '"' + st + ' data-l="' + l + '"><span class="nm">não medido</span><small class="why">' + esc(r.why) + '</small></td>';
    return '<td class="' + cls + '"' + st + ' data-l="' + l + '">' + sinal(r.k, r.p != null ? sgn(r.p) : '') + '<small class="sub">' + sub + '</small></td>';
  }
  function exChip(){ return ' <span class="ex">exemplo</span>'; }
  function banda(txt){ return '<tr class="exr"><td colspan="5"><p class="exband"><span class="ex">exemplo</span>' + txt + '</p></td></tr>'; }
  function grupo(titulo, icone, extraHtml, cls){
    return '<tr class="grp ' + (cls || '') + '"><th scope="rowgroup" colspan="5"><div class="gh"><span class="gt">' + icone + titulo + '</span>' + (extraHtml || '') + '</div></th></tr>';
  }
  var ICO = {
    tam: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13.5V9M8 13.5V4.5M13 13.5V7"/></svg>',
    dir: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 11.5l3.5-4 2.5 2 5-5.5M10.5 4.5h3v3"/></svg>',
    des: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.8h11M5.5 2v3M10.5 2v3"/></svg>',
    ida: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 4.8V8l2.2 1.4"/></svg>'
  };

  /* ---------------------------------------------------------------- linha de número com régua do nicho */
  var RESUMO_NICHO = {};
  /* canais com menos de 3 longos nos 90 dias: a explicação vai uma vez só, numa faixa acima das linhas, e as células ficam discretas */
  function faltaBase(){ return [CA, CB].filter(function(c){ return c.n90 < 3; }); }
  function bandaFalta(){
    var f = faltaBase(); if (base !== '90' || !f.length) return '';
    return '<tr class="exr"><td colspan="5"><p class="exband nmband">' + A.nmSw() + '<span>' + f.map(function(c){ return '<b>' + esc(c.nome) + '</b> tem ' + lg(c.n90) + ' em 90 dias'; }).join(' e ') + ' e a conta pede 3: nas 4 linhas abaixo' + (f.length === 2 ? ' os dois ficam' : ' o lado dele fica') + ' sem número e sem traço no nicho. Em “Todos os acompanhados” os números aparecem.</span></p></td></tr>';
  }
  function linhaNumero(k){
    var L = LINHAS[k], ra = L.get(CA), rb = L.get(CB), semBase = base === '90' && k !== 'ins' && faltaBase().length > 0;
    var vals = TODOS.map(function(id){ var r = L.get(REG[id]); return r.nm || r.x == null ? null : { id: id, x: r.x, nome: REG[id].nome }; }).filter(Boolean);
    var pa = ra.nm ? null : posicao(vals, CA.id), pb = rb.nm ? null : posicao(vals, CB.id);
    var eixo = '';
    if (L.nicho && vals.length) {
      var falta = semBase ? [] : [ra.nm ? CA : null, rb.nm ? CB : null].filter(Boolean);
      var txt = [pa ? 'lado A, ' + CA.nome + ': ' + pa.pos + 'º de ' + pa.n : '', pb ? 'lado B, ' + CB.nome + ': ' + pb.pos + 'º de ' + pb.n : ''].filter(Boolean).join('; ');
      eixo = regua(vals, { a: ra.nm ? null : CA.id, b: rb.nm ? null : CB.id, log: L.log, label: 'Posição no nicho em ' + L.l.toLowerCase() + ', do menor ao maior, um traço por canal. ' + txt + '.' }) +
        '<small class="sub-n">' + (base === '90' && k !== 'ins' ? vals.length + ' de ' + TODOS.length + ' canais têm 3 longos ou mais em 90 dias. ' : '') + 'escala log' +
        (falta.length ? '<span class="nm nm-s">sem traço de ' + esc(falta.map(function(c){ return c.nome; }).join(' e ')) + '</span>' : '') + '</small>';
      RESUMO_NICHO[k] = vals.length;
    }
    var ex = base === 'todos' && k === 'eng';
    var sub = k === 'ins' ? L.sub : SUB_BASE[k];
    var head = '<th scope="row" class="rl">' + esc(L.l) + (ex ? exChip() : '') + '<small>' + esc(sub) + '</small></th>';
    return '<tr>' + head + celula(ra, 0, L.nicho && pa && pa.n ? pa.pos + 'º de ' + pa.n + ' no nicho' + (pa.emp ? ' (empate)' : '') : '', semBase && ra.nm ? 'curta' : null) + celula(rb, 1, L.nicho && pb && pb.n ? pb.pos + 'º de ' + pb.n + ' no nicho' + (pb.emp ? ' (empate)' : '') : '', semBase && rb.nm ? 'curta' : null) +
      '<td class="cN">' + eixo + '</td><td class="rel">' + relacao(L, ra, rb) + '</td></tr>';
  }

  /* ---------------------------------------------------------------- grupo Direção */
  var DIR_N = { up: 0, dn: 0, eq: 0, nm: 0 };
  function linhaDirViews(){
    var da = dirViews(CA), db = dirViews(CB);
    var vals = TODOS.map(function(id){ var d = dirViews(REG[id]); return d.nm ? null : { id: id, x: d.p }; }).filter(Boolean);
    DIR_N = { up: 0, dn: 0, eq: 0, nm: TODOS.length - vals.length };
    TODOS.forEach(function(id){ var d = dirViews(REG[id]); if (!d.nm) DIR_N[d.k]++; });
    var sa = da.nm ? '' : fv(CA.med90) + ' (' + lg(CA.n90) + ') contra ' + fv(CA.medPrev) + ' (' + CA.nPrev + ')';
    var sb = db.nm ? '' : fv(CB.med90) + ' (' + lg(CB.n90) + ') contra ' + fv(CB.medPrev) + ' (' + CB.nPrev + ')';
    var eixo = regua(vals, { a: da.nm ? null : CA.id, b: db.nm ? null : CB.id, lo: -.6, hi: .6, band: [-.1, .1], eixo: ['descendo', 'estável', 'subindo'],
      label: 'Direção no nicho: cada traço é um canal, de 60% abaixo a 60% acima dos 90 dias anteriores. ' + [da.nm ? '' : 'Lado A, ' + CA.nome + ': ' + PALAVRA[da.k] + ' ' + sgn(da.p), db.nm ? '' : 'lado B, ' + CB.nome + ': ' + PALAVRA[db.k] + ' ' + sgn(db.p)].filter(Boolean).join('; ') + '.' });
    var falta = [da.nm ? CA : null, db.nm ? CB : null].filter(Boolean);
    return '<tr><th scope="row" class="rl">Views dos vídeos novos<small>mediana das views dos longos publicados em cada período</small></th>' + celDir(da, 0, esc(sa)) + celDir(db, 1, esc(sb)) +
      '<td class="cN dirN">' + eixo + '<small class="sub-n">' + vals.length + ' canais medidos: ' + DIR_N.up + ' sobem, ' + DIR_N.eq + ' ficam estáveis, ' + DIR_N.dn + ' descem.' +
      (falta.length ? '<span class="nm nm-s">sem traço de ' + esc(falta.map(function(c){ return c.nome; }).join(' e ')) + '</span>' : '') + '</small></td><td class="rel off"></td></tr>';
  }
  function linhaDirPub(){
    var pa = dirPub(CA), pb = dirPub(CB);
    function sub(c, d){ return d.d === 0 && c.n90 === 0 ? 'nenhum longo nos dois períodos' : lg(c.n90) + ' contra ' + c.nPrev; }
    var vals = TODOS.map(function(id){ var d = dirPub(REG[id]); return d.p == null ? null : { id: id, x: d.p }; }).filter(Boolean);
    var eixo = regua(vals, { a: pa.p == null ? null : CA.id, b: pb.p == null ? null : CB.id, lo: -.6, hi: .6, band: [-.1, .1], eixo: ['publica menos', 'igual', 'publica mais'],
      label: 'Direção da publicação no nicho: mudança no número de longos publicados contra os 90 dias anteriores, um traço por canal com 3 longos ou mais nos 90 anteriores.' });
    var real = (CA.real90 || CB.real90) ? '' : '';
    return '<tr><th scope="row" class="rl">Longos publicados<small>nos últimos 90 dias contra os 90 anteriores; sem viés de idade</small></th>' +
      (pa.nm ? celula(pa, 0, null, true) : '<td class="cA" style="--c:' + COR[0] + '" data-l="A">' + sinal(pa.k, '') + '<small class="sub">' + esc(sub(CA, pa)) + '</small></td>') +
      (pb.nm ? celula(pb, 1, null, true) : '<td class="cB" style="--c:' + COR[1] + '" data-l="B">' + sinal(pb.k, '') + '<small class="sub">' + esc(sub(CB, pb)) + '</small></td>') +
      '<td class="cN dirN">' + eixo + '<small class="sub-n">só canais com 3 longos ou mais nos 90 anteriores</small></td><td class="rel off"></td></tr>';
  }

  /* ---------------------------------------------------------------- grupo "Primeiros dias de cada vídeo" */
  function med(a){ return A.mediana(a); }
  function f30(c){
    if (trinta !== 'cheio' || !c.v30) return null;
    var all = c.v30, rec = all.filter(function(v){ return v[0] < 90; }).map(function(v){ return v[1]; }), prev = all.filter(function(v){ return v[0] >= 90; }).map(function(v){ return v[1]; });
    var d = rec.length >= 3 && prev.length >= 3 ? med(rec) / med(prev) - 1 : null;
    return { n: all.length, med: med(all.map(function(v){ return v[1]; })), dir: d == null ? null : { p: d, k: d >= .1 ? 'up' : d <= -.1 ? 'dn' : 'eq' }, rec: rec.length, prev: prev.length };
  }
  function f7(c){
    if (trinta === 'cheio') { var r = f30(c); return r ? { n: r.n + 2, med: Math.round(r.med * .45) } : { n: 0, med: null }; }
    return { n: c.f7n, med: c.f7n >= 3 ? c.f7med : null };
  }
  function nmFecha(c){
    if (trinta === 'cheio') return nmOf('nenhum longo publicado desde 03/10');
    return c.f7n > 0 && c.fecha ? nmOf('0 vídeos com 30 dias de contagem; o primeiro fecha em ' + c.fecha) : nmOf('nenhum longo publicado desde 03/10');
  }
  function barras(c, max){
    var vids = c.v30; if (!vids) return '';
    var m = med(vids.map(function(v){ return v[1]; }));
    return '<span class="b30" role="img" aria-label="' + esc(vids.length + ' vídeos, do mais antigo ao mais novo, views nos 30 primeiros dias: ' + vids.map(function(v){ return fv(v[1]); }).join(', ') + '. Mediana ' + fv(m) + '.') + '">' +
      vids.map(function(v){ return '<i style="height:' + Math.max(6, v[1] / max * 100).toFixed(0) + '%"></i>'; }).join('') + '<s style="bottom:' + (m / max * 100).toFixed(0) + '%"></s></span>';
  }
  function linhasTrinta(){
    var h = '', a7 = f7(CA), b7 = f7(CB), a30 = f30(CA), b30 = f30(CB);
    /* 7 dias */
    function c7(r, c, lado){
      if (r.n < 3) return celula(nmOf(r.n === 0 ? 'nenhum longo com 7 dias de contagem' : 'só ' + r.n + ' longos com 7 dias de contagem; precisa de 3'), lado, null, true);
      return celula({ t: fv(r.med), x: r.med, sub: 'mediana de ' + lg(r.n) }, lado);
    }
    var r7a = a7.n < 3 ? { nm: true } : { x: a7.med, t: 1 }, r7b = b7.n < 3 ? { nm: true } : { x: b7.med, t: 1 };
    h += '<tr><th scope="row" class="rl">Views nos primeiros 7 dias<small>mediana dos longos com 7 dias de contagem; é o que enche primeiro</small></th>' + c7(a7, CA, 0) + c7(b7, CB, 1) + '<td class="cN"></td><td class="rel">' +
      relacao({ art: 'as', noun: 'views em 7 dias' }, r7a, r7b) + '</td></tr>';
    /* 30 dias */
    function c30(r, c, lado){
      if (!r) return celula(nmFecha(c), lado, null, true);
      var st = ' style="--c:' + COR[lado] + '"', max = Math.max.apply(null, c.v30.map(function(v){ return v[1]; }));   /* escala própria de cada canal: o desenho mostra a direção, não o tamanho */
      return '<td class="' + (lado ? 'cB' : 'cA') + '"' + st + ' data-l="' + (lado ? 'B' : 'A') + '"><span class="v1 num">' + fv(r.med) + '</span><small class="sub">mediana de ' + lg(r.n) + '</small>' + barras(c, max) + '<small class="sub">uma barra por vídeo, do mais antigo ao mais novo; escala própria; tracejado = mediana</small>' +
        (r.dir ? '<span class="dr-m">' + sinal(r.dir.k, sgn(r.dir.p), 'dr-s') + '</span><small class="sub">' + r.rec + ' longos nos últimos 90 dias contra ' + r.prev + ' nos 90 anteriores</small>' : '') + '</td>';
    }
    var ra = a30 ? { x: a30.med, t: 1 } : { nm: true }, rb = b30 ? { x: b30.med, t: 1 } : { nm: true };
    h += '<tr><th scope="row" class="rl">Views nos primeiros 30 dias<small>mediana dos longos com 30 dias de contagem; todos na mesma idade</small></th>' + c30(a30, CA, 0) + c30(b30, CB, 1) + '<td class="cN"></td><td class="rel">' +
      relacao({ art: 'as', noun: 'views em 30 dias' }, ra, rb) + '</td></tr>';
    return h;
  }
  function fraseTrinta(){
    if (trinta === 'cheio') {
      var a = f30(CA), b = f30(CB), partes = [CA, CB].map(function(c, i){ var r = i ? b : a; return r && r.dir ? '<span class="fr-i">' + badge(i ? 'B' : 'A') + '<b>' + esc(c.nome) + '</b>' + sinal(r.dir.k, sgn(r.dir.p), 'dr-s') + '</span>' : '<span class="fr-i">' + badge(i ? 'B' : 'A') + '<b>' + esc(c.nome) + '</b><span class="nm">não medido</span></span>'; });
      return '<tr class="frase"><td colspan="5"><p>Com seis meses de contagem diária, pela medida justa que compara vídeos na mesma idade: ' + partes.join(' ') + '</p></td></tr>';
    }
    var datas = [CA, CB].map(function(c){ return c.fecha; }).filter(Boolean).sort(function(x, y){ return x.split('/').reverse().join('') < y.split('/').reverse().join('') ? -1 : 1; });
    return '<tr class="frase hoje"><td colspan="5"><p><span class="nm-h" aria-hidden="true"></span><span><b>Ainda sem vídeos com 30 dias de contagem.</b> A contagem diária de views começou em 03/10 e só entra vídeo publicado depois: ' +
      (datas.length ? 'o primeiro fecha em <b class="num">' + datas[0] + '</b>.' : 'nenhum dos dois canais publicou um longo desde então.') + ' A direção por esta medida pede 3 vídeos em cada período de 90 dias: a partir de abril de 2027.</span></p></td></tr>';
  }

  /* ---------------------------------------------------------------- Leitura rápida: direção primeiro, tamanho só como contexto. Calculada dos mesmos números, sem IA. */
  function leitura(){
    var li = [];
    PAR.forEach(function(c, i){
      var dv = dirViews(c), dp = dirPub(c), pub = dp.nm ? 'não dá para medir o ritmo de publicação (' + lg(c.n90) + ' contra ' + c.nPrev + '; precisa de 3 em um dos períodos)' : dp.k === 'up' ? 'publica mais (' + lg(c.n90) + ' contra ' + c.nPrev + ')' : dp.k === 'dn' ? 'publica menos (' + lg(c.n90) + ' contra ' + c.nPrev + ')' : c.n90 === 0 && c.nPrev === 0 ? 'não publicou longos nos dois períodos' : 'publica no mesmo ritmo (' + lg(c.n90) + ' contra ' + c.nPrev + ')';
      var nome = badge(i ? 'B' : 'A') + ' <b>' + esc(c.nome) + '</b>';
      if (dv.nm) li.push('<li><span class="sy nmk" aria-hidden="true">◌</span><span class="lr-t">' + nome + ': sem como medir a direção das views (' + esc(dv.why) + '). ' + esc(pub.charAt(0).toUpperCase() + pub.slice(1)) + '.</span></li>');
      else li.push('<li><span class="sy ' + dv.k + '" aria-hidden="true">' + SIM[dv.k] + '</span><span class="lr-t">' + nome + ' está <b>' + PALAVRA[dv.k] + '</b>: as views dos vídeos novos ' + (dv.k === 'eq' ? 'variaram ' : dv.k === 'up' ? 'subiram ' : 'caíram ') + sgn(dv.p).replace('+', '').replace('−', '') + ' contra os 90 dias anteriores' + (dv.k === 'dn' ? ' (pode ser só idade: os vídeos mais velhos tiveram mais tempo para juntar views)' : '') + ', e ' + esc(pub) + '.</span></li>');
    });
    var ra = LINHAS.ins.get(CA).x, rb = LINHAS.ins.get(CB).x, r = rb / ra, mx = r > 1 ? CB : CA, mn = r > 1 ? CA : CB, k = r > 1 ? r : 1 / r;
    li.push('<li><span class="sy tam" aria-hidden="true">■</span><span class="lr-t">Só de contexto: ' + esc(mx.nome) + ' tem ' + A.dec(k, 1) + '× os inscritos de ' + esc(mn.nome) + '. O tamanho não entra na direção.</span></li>');
    return '<div class="cd-lr" role="group" aria-labelledby="lrT"><h3 id="lrT">Leitura rápida <span class="ex">exemplo</span></h3><ul>' + li.join('') + '</ul><p class="lr-n">Calculada dos mesmos números da tabela, sem IA; os números de exemplo da tabela valem para ela. Cada canal é medido contra ele mesmo: subir ou descer não diz quem é melhor.</p></div>';
  }

  /* ---------------------------------------------------------------- montagem */
  function lado(c, i){
    var ini = c.nome.replace(/[^A-Za-zÀ-ú]/g, '').slice(0, 1).toUpperCase();
    return '<section class="lado" style="--c:' + COR[i] + '" aria-label="Lado ' + (i ? 'B' : 'A') + '">' + badge(i ? 'B' : 'A') + '<div class="id"><span class="av">' + ini + '</span><div><h2>' + esc(c.nome) + '</h2>' +
      '<p class="m"><span>Viagem</span><span><b class="num">' + A.mil(c.inscritos) + '</b> inscritos</span><span><b class="num">' + c.acomp + '</b> longos acompanhados <span class="dim">(limite 50)</span></span></p></div></div></section>';
  }
  function seletor(){
    var it = [['90', 'Últimos 90 dias'], ['todos', 'Todos os acompanhados']];
    return '<span class="seg-w"><span class="seg" role="group" aria-label="Base dos números de desempenho">' + it.map(function(i){
      return '<a class="seg-o" href="' + esc(A.href({ base: i[0] === '90' ? null : i[0] }) + '#desempenho') + '"' + (base === i[0] ? ' aria-current="true"' : '') + '>' + esc(i[1]) + '</a>'; }).join('') + '</span>' +
      '<span class="seg-n">Vale para as 4 linhas abaixo. ' + A.ibtn('infoBase', 'Como a base muda os números', true) + '</span></span>';
  }
  function tabela(){
    var h = '<div class="cd-tw"><table class="cd-t"><caption class="sr">Números de ' + esc(CA.nome) + ' (lado A) e de ' + esc(CB.nome) + ' (lado B), lado a lado. Depois dos dois valores vem a posição entre os canais do nicho, e a última coluna diz qual lado é maior e por quanto.</caption>' +
      '<colgroup><col class="k0"><col class="k1"><col class="k1"><col class="k2"><col class="k3"></colgroup>' +
      '<thead><tr><th scope="col" class="c0"><span class="sr">Número</span></th><th scope="col" class="cA" style="--c:' + COR[0] + '">' + badge('A') + esc(CA.nome) + '</th><th scope="col" class="cB" style="--c:' + COR[1] + '">' + badge('B') + esc(CB.nome) + '</th>' +
      '<th scope="col" class="cN">No nicho<small>do menor ao maior</small></th><th scope="col" class="cR">Diferença<small>o lado maior sobre o menor</small></th></tr></thead>';
    h += '<tbody id="direcao">' + grupo('Direção: cada canal contra ele mesmo', ICO.dir, '<span class="gx">últimos 90 dias contra os 90 anteriores (14/07 a 12/10 e 15/04 a 13/07) ' + A.ibtn('infoDir', 'Como ler a direção', true) + '</span>') + banda('Os números deste bloco são de exemplo.') +
      '<tr class="ress"><td colspan="5"><p><span class="ress-s" aria-hidden="true">i</span><span><b>Descer pode ser só idade:</b> os vídeos dos 90 dias anteriores tiveram mais tempo para juntar views. Subir apesar disso é um sinal forte.</span></p></td></tr>' +
      linhaDirViews() + linhaDirPub() + '</tbody>';
    h += '<tbody id="desempenho">' + grupo('Desempenho dos vídeos', ICO.des, seletor()) + (base === '90' ? banda('Os números deste bloco são de exemplo.') : '') + bandaFalta() + ['med', 'vpd', 'vpm', 'eng'].map(linhaNumero).join('') + '</tbody>';
    h += '<tbody>' + grupo('Tamanho do canal', ICO.tam) + linhaNumero('ins') + '</tbody>';
    h += '<tbody id="primeiros">' + grupo('Views nos primeiros dias de cada vídeo', ICO.ida, '<span class="gx">compara vídeos na mesma idade, sem o viés de quem é mais velho ' + A.ibtn('infoDias', 'Como são medidos os primeiros dias', true) + '</span>') + banda(trinta === 'cheio' ? 'Os números deste bloco são de exemplo: a tela como ficaria com seis meses de contagem.' : 'Os números deste bloco são de exemplo.') + fraseTrinta() + linhasTrinta() + '</tbody>';
    return h + '</table></div>';
  }

  var barraLinhas = [
    { rotulo: 'Par', itens: A.opcoes('par', [['lodir-aldinho', 'Lodir × Aldinho (sobe × desce)'], ['lodir-matheus', 'Lodir × Matheus (sobe × estável)'], ['lodir-leo', 'Lodir × Leo Khev (menos de 3 na janela)']], 'lodir-aldinho') },
    { rotulo: 'Base', itens: A.opcoes('base', [['90', 'Últimos 90 dias (padrão)'], ['todos', 'Todos os acompanhados']], '90') },
    { rotulo: 'Primeiros dias', itens: A.opcoes('trinta', [['hoje', 'Hoje: 30 dias vazio'], ['cheio', 'Cheio (exemplo)']], 'hoje') },
    A.tema()
  ];
  var nota = '<b>Ficaram de fora do mockup</b> as linhas que não mudam de desenho: duração mediana (segue a base escolhida), vídeos acima de 2× em 90 dias e trocas em 30 dias (têm janela própria). <b>Real:</b> inscritos, longos acompanhados, longos em 90 dias, mediana de views dos longos e views por dia de todos os acompanhados (lidos em 09/10; Lodir Negrini com 21, do print do dono de 12/10). ' +
    '<b>Exemplo (marcado “exemplo” na linha):</b> a mediana dos últimos 90 dias e dos 90 anteriores, quantos longos havia antes de 90 dias, o engajamento e as views dos primeiros 7 e 30 dias, porque o banco não foi consultado. ' +
    'As contagens de longos dos últimos 90 dias são reais, então quem tem menos de 3 (bald and bankrupt, Esq Unltd Daily, Leo Khev e tnFigueiredo) é “não medido” de verdade. “Hoje” é 12/10/2026.';

  var info = A.oculto('infoDir', 'Como ler a direção',
      '<ul><li><b>O que é:</b> cada canal contra ele mesmo. Compara a mediana das views dos longos publicados nos últimos 90 dias com a dos publicados nos 90 dias anteriores.</li>' +
      '<li><b>Símbolo:</b> ▲ subindo (10% ou mais acima), ＝ estável (dentro de 10%), ▼ descendo (10% ou mais abaixo). O símbolo e a palavra dizem o mesmo que a cor.</li>' +
      '<li><b>Não mede:</b> com menos de 3 longos em qualquer dos dois períodos, a linha diz “não medido” e o motivo, nunca um número frágil.</li>' +
      '<li><b>O viés:</b> views são acumuladas. Quem foi publicado há 120 dias já juntou quase tudo; quem saiu há 10 dias ainda está começando. Por isso a mediana dos vídeos novos tende a parecer menor. Descer pode ser só idade; subir apesar disso é forte.</li>' +
      '<li><b>Publicação:</b> conta de longos, sem o viés. ▲ ou ▼ só com diferença de 2 longos ou mais e de 10% ou mais.</li>' +
      '<li><b>A régua:</b> um traço por canal do nicho, de 60% abaixo a 60% acima; a faixa do meio é “estável”. Não é uma colocação.</li></ul>') +
    A.oculto('infoBase', 'Como a base muda os números',
      '<ul><li><b>Últimos 90 dias (padrão):</b> só os longos publicados nos últimos 90 dias. Mostra como o canal está agora, e canais que postam 3 vezes por semana e 1 vez por mês ficam comparáveis no tempo.</li>' +
      '<li><b>Todos os acompanhados:</b> os longos que o Observatório acompanha de cada canal (no máximo 50). É o número de antes.</li>' +
      '<li><b>A base vem escrita embaixo de cada número</b>, por exemplo “mediana de 12 longos publicados em 90 dias”. Com menos de 3 longos na janela: “não medido” e o motivo.</li>' +
      '<li><b>Vale para:</b> mediana de views, views por dia, views por dia por mil inscritos e engajamento. Inscritos, direção e primeiros dias têm janela própria e não mudam. A régua do nicho muda junto: só entram canais com 3 longos ou mais na janela.</li>' +
      '<li>A escolha vai na URL.</li></ul>') +
    A.oculto('infoDias', 'Como são medidos os primeiros dias',
      '<ul><li><b>O que é:</b> as views que o vídeo juntou nos primeiros 7 (ou 30) dias depois de publicado. Todos os vídeos na mesma idade, então um vídeo velho não ganha de um novo só por ter mais tempo.</li>' +
      '<li><b>Só existe</b> para vídeo publicado depois de 03/10/2026, quando a contagem diária começou. Por isso a linha nasce quase vazia e enche com o tempo.</li>' +
      '<li><b>7 dias enche primeiro:</b> o primeiro vídeo fecha 7 dias em 10/10; 30 dias, em 02/11. Os dois ficam na tela.</li>' +
      '<li><b>Mínimo de 3 vídeos</b> por canal; com menos, “não medido” e quantos há.</li>' +
      '<li><b>Direção por esta medida:</b> só com 3 vídeos fechados em cada período de 90 dias.</li></ul>') +
    A.oculto('infoTab', 'Como ler esta tabela',
      '<ul><li><b>Os lados:</b> o lado A é um quadrado cor de areia com a letra A; o lado B é um círculo azul com a letra B.</li><li><b>Régua do nicho:</b> um traço por canal de Viagem, do menor ao maior, com os dois lados em destaque. Escala log: cada divisão vale 10 vezes a anterior.</li>' +
      '<li><b>Diferença:</b> a frase começa pelo canal maior e diz quanto ele é do menor. A partir de 2× usa “×”; abaixo, percentual. Menos de 10% de diferença é “praticamente igual”.</li><li><b>Não medido</b> (hachura): o dado não existe; não é zero.</li></ul>');

  A.moldura({
    titulo: 'Comparar canais: base e direção',
    barra: { linhas: barraLinhas, nota: nota },
    corpo: A.migalha([['Canais', 'index.html'], ['Comparar']]) +
      '<header class="cd-head"><h1>Comparar canais</h1><p class="cd-sub">Dois canais de Viagem, lado a lado. O que importa aqui é a direção de cada um, não quem é maior.</p></header>' +
      '<div class="lados">' + lado(CA, 0) + lado(CB, 1) + '</div>' +
      '<section class="cd-sec" aria-labelledby="hNum"><h2 id="hNum">Número a número ' + A.ibtn('infoTab', 'Como ler esta tabela', true) + '</h2>' + leitura() + tabela() +
      '<p class="cd-n">Maior não quer dizer melhor: são canais de tamanhos diferentes.</p></section>' + info
  });
  A.ligarInfos();
  var hash = location.hash && document.getElementById(location.hash.slice(1));
  if (hash) hash.scrollIntoView();
})();
