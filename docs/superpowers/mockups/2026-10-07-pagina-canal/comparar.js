/* comparar.js — rodada 9 (09/10/2026). Tela "Comparar canais": dois canais lado a lado, com seletor em cada lado, URL ?a=<id>&b=<id>.
   Regras duras: nulo nunca vira zero (o que não existe aparece como "não medido" com o motivo e a relação da linha some; zero medido é "0");
   uma linha em que os DOIS lados não têm dado não aparece (a tela conta quantas ficaram de fora); sem verde, sem vermelho, sem "vencedor".
   Fonte dos números: canais-dados.js (resumo dos 13 reais + 2 próprios), vídeos de Leo Khev (LEO, foto de dados.js) e de tnFigueiredo (dados-proprio.js).
   Só esses dois canais têm vídeos no mockup: o que depende de vídeo (engajamento, ritmo, último vídeo, top 5, faixa de publicação) só existe para eles. */
(function(){
  'use strict';
  var C = window.CANAL, F = C.fmt, LEO = window.LEO, NI = window.CANAIS, DIA = 864e5, NOW = LEO.NOW;
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function med(a){ if (!a.length) return null; var x = a.slice().sort(function(p, q){ return p - q; }), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; }
  function n(x){ return x == null ? null : x >= 1e6 ? F.dec(x / 1e6, 2) + ' mi' : x >= 1e4 ? F.num(x) : x >= 1e3 ? F.dec(x / 1e3, 2) + ' mil' : F.dec(x, 0); }

  /* ---------------------------------------------------------------- os canais: resumo (canais-dados.js) + detalhe de vídeos (só Leo Khev e tnFigueiredo) */
  var REG = {}, ORDEM = [];
  NI.proprios.forEach(function(c){ REG[c.id] = Object.assign({}, c); });
  NI.canais.forEach(function(c){ REG[c.id] = Object.assign({}, c); });
  var PROPRIO = 'proprio';

  function detalhe(V, mult, extra){
    var d = {};
    var pubs = V.filter(function(v){ return v.pub != null; });
    var ult = pubs.slice().sort(function(a, b){ return b.pub - a.pub; })[0];
    d.n = V.length; d.ult = ult || null; d.dias = ult ? Math.floor((NOW - ult.pub) / DIA) : null;
    var de13 = NOW - 13 * 7 * DIA, rec = pubs.filter(function(v){ return v.pub > de13; });
    d.sem13 = { lg: rec.filter(function(v){ return v.fmt === 'long'; }).length, sh: rec.filter(function(v){ return v.fmt === 'short'; }).length };
    var eng = V.filter(function(v){ return v.fmt === 'long' && v.views > 0 && v.likes != null && v.comments != null; }).map(function(v){ return (v.likes + v.comments) / v.views; });
    d.eng = { m: med(eng), n: eng.length };
    var durs = V.filter(function(v){ return v.fmt === 'long' && v.dur != null; }).map(function(v){ return v.dur; });
    d.dur = { m: med(durs), n: durs.length };
    var d90 = NOW - 90 * DIA, r90 = pubs.filter(function(v){ return v.pub >= d90; });
    d.r90 = r90;
    var m90 = r90.filter(function(v){ return (extra.exigeSerie ? v.serie : true) && mult(v) != null; });
    d.o2x = m90.length ? { k: m90.filter(function(v){ return mult(v) >= 2; }).length, de: m90.length } : null;
    d.top = V.filter(function(v){ return v.views != null; }).sort(function(a, b){ return b.views - a.views; }).slice(0, 5);
    d.comViews = V.filter(function(v){ return v.views != null; }).length;
    return d;
  }
  /* Leo Khev: os vídeos e o múltiplo são os de canal.html (foto tirada antes de dados-proprio.js) */
  REG['leo-khev'].det = detalhe(LEO.videos, function(v){ return LEO.mult[v.id]; }, { exigeSerie: true });
  REG['leo-khev'].det.trocas = LEO.trocas;
  REG['leo-khev'].det.cresc = LEO.inscritos30 ? { antes: LEO.inscritos30.antes, agora: LEO.inscritos30.agora, data: LEO.inscritos30.antesData } : null;
  REG[PROPRIO].det = detalhe(C.videos, function(v){ return v.mult; }, { exigeSerie: false });
  REG[PROPRIO].det.reach = C.reach;
  REG[PROPRIO].det.cresc = null; REG[PROPRIO].det.trocas = null;

  ORDEM = ['proprio', 'proprio-2'].concat(NI.canais.slice().sort(function(a, b){ return b.inscritos - a.inscritos; }).map(function(c){ return c.id; }));
  var ACIMA = (function(){   /* o concorrente logo acima do canal próprio em inscritos */
    var P = REG[PROPRIO], acima = NI.canais.filter(function(c){ return c.inscritos > P.inscritos; }).sort(function(a, b){ return a.inscritos - b.inscritos; })[0];
    return acima ? acima.id : NI.canais.slice().sort(function(a, b){ return b.inscritos - a.inscritos; })[0].id;
  })();

  /* ---------------------------------------------------------------- estado ⇄ URL */
  var st = { a: PROPRIO, b: ACIMA };
  function lerUrl(){
    var p = new URLSearchParams(location.search.length > 1 ? location.search : location.hash.replace(/^#/, ''));
    var a = p.get('a'), b = p.get('b');
    st.a = REG[a] ? a : PROPRIO;
    st.b = REG[b] && b !== st.a ? b : (st.a === ACIMA ? NI.canais.slice().sort(function(x, y){ return y.inscritos - x.inscritos; })[0].id : ACIMA);
    if (st.b === st.a) st.b = ORDEM.filter(function(i){ return i !== st.a; })[0];
  }
  function gravarUrl(){ try { history.replaceState(null, '', 'comparar.html?a=' + encodeURIComponent(st.a) + '&b=' + encodeURIComponent(st.b)); } catch (e) {} }
  function anunciar(t){ var s = $('status'); s.textContent = ''; setTimeout(function(){ s.textContent = t; }, 40); }

  /* ---------------------------------------------------------------- as linhas da tabela */
  var SEMDET = 'os vídeos deste canal não estão neste mockup';
  function semVideos(c){ return c.semVideos ? 'sem vídeos' : null; }
  function porDet(c, f){ if (c.semVideos) return { why: 'sem vídeos' }; if (!c.det) return { why: SEMDET }; return f(c.det, c); }
  function num(x, t, extra){ return Object.assign({ x: x, t: t }, extra || {}); }
  var G = { tam: 'Tamanho do canal', pub: 'Publicação', des: 'Desempenho dos vídeos' };
  var LINHAS = [
    { curto: 'inscritos', nicho: true, k: 'inscritos', g: G.tam, l: 'Inscritos', sub: 'contagem pública do YouTube, lida em 09/10', noun: { t: 'inscritos', g: 'os' },
      fmt: n, un: 'inscritos',
      get: function(c){ return num(c.inscritos, n(c.inscritos)); } },
    { curto: 'inscritos em 30 dias', k: 'cresc', g: G.tam, l: 'Inscritos em 30 dias', sub: 'a contagem de hoje contra a de 30 dias atrás', nobar: true, norel: true,
      get: function(c){
        if (c.semVideos || c.own) return { why: 'a contagem diária de inscritos do seu canal ainda não existe' };
        if (!c.det || !c.det.cresc) return { why: 'só a contagem de Leo Khev veio neste mockup' };
        var k = c.det.cresc, abs = k.agora - k.antes, un = Math.pow(10, Math.floor(Math.log10(k.agora)) - 2), g = abs / k.antes * 100;
        return num(abs, Math.abs(abs) <= un ? '≈ 0' : (abs > 0 ? '+' : '−') + F.dec(Math.abs(g), 1) + '%', { nota: 'de ' + k.antes.toLocaleString('pt-BR') + ' para ' + k.agora.toLocaleString('pt-BR') });
      } },
    { curto: 'longos acompanhados', nicho: true, k: 'acomp', g: G.pub, l: 'Longos acompanhados', sub: 'longos com contagem diária de views', noun: { t: 'longos acompanhados', g: 'os' }, fmt: String, un: 'longos acompanhados',
      get: function(c){ return c.acomp == null ? { why: semVideos(c) || 'não medido' } : num(c.acomp, String(c.acomp)); } },
    { curto: 'longos em 90 dias', nicho: true, k: 'l90', g: G.pub, l: 'Longos publicados em 90 dias', sub: 'nos últimos 90 dias', noun: { t: 'longos publicados em 90 dias', g: 'os' }, fmt: String, un: 'longos em 90 dias',
      get: function(c){ return c.l90 == null ? { why: semVideos(c) || 'não medido' } : num(c.l90, String(c.l90)); } },
    { curto: 'ritmo de publicação', k: 'cad', g: G.pub, l: 'Longos + Shorts por semana', sub: 'últimas 13 semanas, dividido por 13', noun: { t: 'ritmo de publicação', g: 'o' },
      get: function(c){ return porDet(c, function(d){
        var w = function(x){ x = Math.round(x / 13 * 10) / 10; return x === 0 ? '0' : F.dec(x, 1); };
        return num((d.sem13.lg + d.sem13.sh) / 13, w(d.sem13.lg) + ' + ' + w(d.sem13.sh), { nota: F.plural(d.sem13.lg, 'longo', 'longos') + ' e ' + F.plural(d.sem13.sh, 'Short', 'Shorts') + ' em 13 semanas' });
      }); } },
    { curto: 'tempo desde o último vídeo', k: 'dias', g: G.pub, nobar: true, frase: true, l: 'Dias desde o último vídeo', sub: 'do último vídeo publicado até 07/10', noun: { t: 'tempo desde o último vídeo', g: 'o' },
      get: function(c){ return porDet(c, function(d){ return d.dias == null ? { why: 'nenhum vídeo com data' } : num(d.dias, F.dec(d.dias, 0), { nota: 'publicado em ' + F.data(d.ult.pub, true) }); }); } },
    { curto: 'mediana de views', nicho: true, k: 'med', g: G.des, l: 'Mediana de views dos longos', sub: 'a mediana das views de cada longo', noun: { t: 'mediana de views dos longos', g: 'a' }, fmt: n, un: 'views',
      get: function(c){ return c.med == null ? { why: semVideos(c) || 'não medido' } : num(c.med, n(c.med)); } },
    { curto: 'views por dia', nicho: true, k: 'vpd', g: G.des, l: 'Views por dia nos longos', sub: 'mediana das views ganhas por dia, desde 03/10', noun: { t: 'views por dia nos longos', g: 'as' }, fmt: function(x){ return F.taxa(x); }, un: 'views por dia',
      get: function(c){ return c.vpd == null ? { why: c.semVideos ? 'sem vídeos' : c.own ? 'a coleta diária do seu canal começa em breve' : 'aguarda o 2º registro diário' } : num(c.vpd, F.taxa(c.vpd)); } },
    { curto: 'views por dia por mil inscritos', nicho: true, k: 'vpm', g: G.des, l: 'Views por dia por mil inscritos', sub: 'views por dia nos longos ÷ mil inscritos', noun: { t: 'views por dia por mil inscritos', g: 'as' }, fmt: function(x){ return F.dec(x, 2); }, un: 'views por dia por mil inscritos',
      get: function(c){ return c.vpm == null ? { why: c.semVideos ? 'sem vídeos' : c.own ? 'a coleta diária do seu canal começa em breve' : 'aguarda o 2º registro diário' } : num(c.vpm, F.dec(c.vpm, 2)); } },
    { curto: 'engajamento', valores: true, k: 'eng', g: G.des, l: 'Engajamento nos longos', sub: '(curtidas + comentários) ÷ views, mediana dos longos guardados', noun: { t: 'engajamento', g: 'o' },
      get: function(c){ return porDet(c, function(d){ return d.eng.m == null ? { why: 'nenhum longo com curtidas e comentários' } : num(d.eng.m, F.dec(d.eng.m * 100, 1) + '%', { nota: 'mediana de ' + F.plural(d.eng.n, 'longo', 'longos') }); }); } },
    { curto: 'vídeos acima de 2×', k: 'o2x', g: G.des, l: 'Vídeos acima de 2× em 90 dias', sub: 'vídeos de até 90 dias com 2× ou mais do normal do canal', noun: { t: 'vídeos acima de 2×', g: 'os' },
      get: function(c){ return porDet(c, function(d, ch){ return !d.o2x ? { why: ch.own ? 'nenhum vídeo seu nos últimos 90 dias' : 'nenhum vídeo com múltiplo em 90 dias' } : num(d.o2x.k, d.o2x.k + ' de ' + d.o2x.de); }); } },
    { curto: 'duração', valores: true, k: 'dur', g: G.des, l: 'Duração mediana dos longos', sub: 'mediana dos longos com duração conhecida', noun: { t: 'duração mediana', g: 'a' },
      get: function(c){ return porDet(c, function(d){ return d.dur.m == null ? { why: 'nenhum longo com duração' } : num(d.dur.m, F.dur(Math.round(d.dur.m)), { nota: 'mediana de ' + F.plural(d.dur.n, 'longo', 'longos') }); }); } },
    { curto: 'trocas em 30 dias', k: 'trocas', g: G.des, l: 'Trocas de título e thumbnail em 30 dias', sub: 'trocas vistas nos últimos 30 dias', noun: { t: 'trocas em 30 dias', g: 'as' },
      get: function(c){
        if (c.semVideos) return { why: 'sem vídeos' };
        if (c.own) return { why: 'as trocas do seu canal ficam no A/B Lab' };
        if (!c.det || c.det.trocas == null) return { why: SEMDET };
        return num(c.det.trocas, String(c.det.trocas), { exemplo: true, nota: 'fabricadas neste mockup' });
      } }
  ];

  /* ---------------------------------------------------------------- cores dos lados (rodada 11)
     O canal próprio é SEMPRE o laranja do selo ("seu"); o outro lado é azul frio; sem canal próprio no par, o lado A é areia (o laranja continua querendo dizer "seu"). */
  var COR = ['var(--lado-n)', 'var(--lado-b)'];
  function definirCores(A, B){ COR = A.own ? ['var(--lado-o)', 'var(--lado-b)'] : B.own ? ['var(--lado-b)', 'var(--lado-o)'] : ['var(--lado-n)', 'var(--lado-b)']; }
  function corDe(c){ return c === REG[st.a] ? COR[0] : COR[1]; }
  function chip(l, txt){ return '<span class="lm" style="--c:' + COR[l === 'A' ? 0 : 1] + '">' + esc(txt || l) + '</span>'; }
  var ICONES = {
    tam: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13.5V9M8 13.5V4.5M13 13.5V7"/></svg>',
    pub: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.8h11M5.5 2v3M10.5 2v3"/></svg>',
    des: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12l4-4.5 3 2.5 5-6M10.5 4h3.5v3.5"/></svg>'
  };

  /* ---------------------------------------------------------------- a relação em palavras, sempre partindo do lado A (B em relação a A)
     Rodada 11: "×" a partir de 2×, percentual abaixo ("+32%", "−35%"); o símbolo vai antes: ▲ de quem é maior (a frase diz de quem), ＝ quando praticamente igual,
     nada quando não há razão. Abaixo de 10% de diferença é "praticamente igual". */
  var POSS = { o: 'seu', a: 'sua', os: 'seus', as: 'suas' }, DE = { o: 'do', a: 'da', os: 'dos', as: 'das' }, ART = { o: 'o', a: 'a', os: 'os', as: 'as' };
  function fx(r){ return F.dec(r, r >= 10 ? 0 : 1) + '×'; }
  function haDias(n){ return n === 0 ? 'hoje' : 'há ' + F.plural(n, 'dia', 'dias'); }
  function quem(c, cap){ return c.own ? (cap ? 'Você' : 'você') : c.nome; }
  /* "Dias desde o último vídeo": menor é mais recente; a frase diz quem publicou mais recentemente (sem "×" nem "%") */
  function fraseDias(A, B, ra, rb){
    if (ra.x == null || rb.x == null) return null;
    if (ra.x === rb.x) return { t: 'Os dois publicaram ' + haDias(ra.x), sym: 'eq' };
    var rec = ra.x < rb.x ? A : B, out = ra.x < rb.x ? B : A, xr = Math.min(ra.x, rb.x), xo = Math.max(ra.x, rb.x);
    return { t: quem(rec, true) + ' publicou mais recentemente: ' + haDias(xr) + '; ' + (out.own ? 'você' : out.nome) + ', ' + haDias(xo), sym: 'dot', side: ra.x < rb.x ? 0 : 1, quem: quem(rec, true) };
  }
  /* rodada 12: a frase nomeia quem é maior e diz quanto, sem sinal de menos e sem seta contrariando o sinal.
     "×" só a partir de 2× (a razão é maior÷menor, sempre ≥ 1); abaixo, "+N%" sobre o menor. O símbolo ▲ leva a cor de quem é maior. */
  function quanto(r){ return r >= 2 ? fx(r) : '+' + F.dec((r - 1) * 100, 0) + '%'; }
  /* zero em linguagem de gente, conforme a linha (a razão com zero não existe) */
  var ZERO = {
    l90: { um: function(c){ return (c.own ? 'você não publicou' : c.nome + ' não publicou') + ' longos em 90 dias'; }, dois: 'nenhum dos dois publicou longos em 90 dias' },
    cad: { um: function(c){ return (c.own ? 'você não publicou' : c.nome + ' não publicou') + ' em 13 semanas'; }, dois: 'nenhum dos dois publicou em 13 semanas' },
    o2x: { um: function(c){ return (c.own ? 'você não tem' : c.nome + ' não tem') + ' vídeo acima de 2× em 90 dias'; }, dois: 'nenhum dos dois tem vídeo acima de 2× em 90 dias' }
  };
  function relacao(A, B, ra, rb, noun, k){
    if (ra.x == null || rb.x == null) return null;
    var Z = ZERO[k];
    if (ra.x === 0 && rb.x === 0) return { t: Z ? Z.dois : 'os dois em 0', sym: 'eq' };
    if (ra.x === 0 || rb.x === 0){ var zc = ra.x === 0 ? A : B; return { t: Z ? Z.um(zc) : quem(zc, true) + ' tem 0', dim: true }; }
    var r = rb.x / ra.x, g = noun.g;
    if (r > 0.9 && r < 1.1) return { t: 'praticamente igual', sym: 'eq' };
    var maior = r > 1 ? B : A, menor = r > 1 ? A : B, q = r > 1 ? r : 1 / r, lado = r > 1 ? 1 : 0;
    var ref = ART[g] + ' ' + (menor.own ? POSS[g] + ' ' + noun.t : noun.t + ' de ' + menor.nome);
    return { t: quem(maior, true) + ': ' + (q >= 2 ? fx(q) + ' ' + ref : quanto(q) + ' de ' + noun.t), sym: 'up', side: lado, quem: quem(maior, true) };
  }
  function simbolo(rel){
    if (!rel || !rel.sym) return '';
    if (rel.sym === 'eq') return '<span class="sy eq" aria-hidden="true">＝</span>';
    return '<span class="sy" style="--c:' + COR[rel.side] + '" aria-hidden="true">' + (rel.sym === 'dot' ? '●' : '▲') + '</span><span class="sr">' + esc(rel.quem) + (rel.sym === 'dot' ? ' mais recente. ' : ' é maior. ') + '</span>';
  }
  /* quem é maior em cada número (para a "Leitura rápida"): lado, razão e os dois valores */
  function quemMaior(L, ra, rb){
    if (ra.x == null || rb.x == null || L.k === 'cresc' || L.k === 'trocas') return null;
    if (L.k === 'dias') return ra.x === rb.x ? { q: 'eq' } : { q: 'rec', lado: ra.x < rb.x ? 0 : 1 };
    if (ra.x === 0 && rb.x === 0) return { q: 'eq' };
    if (ra.x === 0 || rb.x === 0) return { q: 'mx', lado: ra.x === 0 ? 1 : 0, r: Infinity };
    var r = rb.x / ra.x;
    if (r > 0.9 && r < 1.1) return { q: 'eq' };
    return r >= 1.1 ? { q: 'mx', lado: 1, r: r } : { q: 'mx', lado: 0, r: 1 / r };
  }

  /* ---------------------------------------------------------------- cabeçalho dos lados */
  function avatar(c){
    var ini = esc(c.nome.replace(/[^A-Za-zÀ-ú]/g, '').slice(0, 1).toUpperCase());
    var url = c.id === 'leo-khev' ? LEO.canal.avatar : '';
    return '<span class="av" aria-hidden="true">' + (url ? '<img src="' + esc(url) + '" alt="" width="44" height="44" onerror="this.replaceWith(document.createTextNode(\'' + ini + '\'))">' : ini) + '</span>';
  }
  function hrefCanal(c){ return c.own ? (c.semVideos ? null : 'canal-proprio.html') : c.id === 'leo-khev' ? 'canal.html' : null; }
  function lado(c, qual){
    $('side' + qual).style.setProperty('--c', COR[qual === 'A' ? 0 : 1]);
    $('id' + qual).innerHTML = avatar(c) + '<div class="cp-nm"><h2 id="h' + qual + '">' + esc(c.nome) + '</h2><p class="cp-m">' + (c.own ? '<span class="own-seal">seu canal</span>' : '') +
      '<span>' + esc(NI.nicho) + '</span><span><b class="num">' + n(c.inscritos) + '</b> inscritos</span></p></div>';
    var h = hrefCanal(c);
    $('open' + qual).innerHTML = h ? '<a class="lk" href="' + h + '">Abrir o canal ' + esc(c.nome) + '</a>' : '<span class="cp-semp">' + (c.semVideos ? 'Sem vídeos: ainda sem página.' : 'Este canal não tem página neste mockup.') + '</span>';
  }
  function montarSeletores(){
    function ops(){
      var propr = ORDEM.filter(function(i){ return REG[i].own; }), conc = ORDEM.filter(function(i){ return !REG[i].own; });
      function o(i){ return '<option value="' + i + '">' + esc(REG[i].nome) + (REG[i].semVideos ? ' (sem vídeos)' : '') + '</option>'; }
      return '<optgroup label="Seus canais">' + propr.map(o).join('') + '</optgroup><optgroup label="Concorrentes de ' + esc(NI.nicho) + ', do maior ao menor">' + conc.map(o).join('') + '</optgroup>';
    }
    $('selA').innerHTML = ops(); $('selB').innerHTML = ops();
  }
  function sincSeletores(){
    var sa = $('selA'), sb = $('selB');
    sa.value = st.a; sb.value = st.b;
    [].forEach.call(sa.options, function(o){ o.disabled = o.value === st.b; });
    [].forEach.call(sb.options, function(o){ o.disabled = o.value === st.a; });
  }

  /* ---------------------------------------------------------------- o nicho: 13 concorrentes lidos em 09/10 + o canal próprio (14). Se um dos lados fica fora (o segundo canal próprio), ele entra no conjunto daquela tela. */
  function conjuntoNicho(A, B){
    var c = NI.canais.map(function(x){ return REG[x.id]; }).concat([REG[PROPRIO]]);
    [A, B].forEach(function(x){ if (c.indexOf(x) < 0) c.push(x); });
    return c;
  }
  var EMPATE = function(p){ return p.emp ? ' (empate)' : ''; };
  function ord(p, n){ return p + 'º de ' + n; }

  /* ---------------------------------------------------------------- tabela */
  function celula(r, c, lado, extra){
    var cor = COR[lado], cls = lado ? 'cB' : 'cA';
    if (r.t == null) return '<td class="nd ' + cls + '" style="--c:' + cor + '" role="cell"><span class="nm"><i class="nm-h" aria-hidden="true"></i>não medido</span><small class="why">' + esc(r.why) + '</small></td>';
    var h = '<td class="' + cls + '" style="--c:' + cor + '" role="cell"><span class="v1 num">' + esc(r.t) + (r.exemplo ? ' <span class="exm">exemplo</span>' : '') + '</span>';
    if (extra && extra.pos) h += '<small class="pos">' + esc(ord(extra.pos.pos, extra.n) + ' no nicho' + EMPATE(extra.pos)) + '</small>';
    if (r.nota) h += '<small class="sub">' + esc(r.nota) + '</small>';
    return h + '</td>';
  }
  /* a célula do meio: régua do nicho (números do nicho), duas barras finas (números só dos dois) ou nada */
  function celulaEixo(L, A, B, ra, rb, conj, info){
    if (L.nicho){
      var vals = conj.filter(function(c){ return c[L.k] != null; }).map(function(c){ return { id: c.id, nome: c.nome, x: c[L.k] }; });
      var marks = [];
      if (ra.x != null) marks.push({ id: A.id, letra: 'A', cor: COR[0] });
      if (rb.x != null) marks.push({ id: B.id, letra: 'B', cor: COR[1] });
      if (!marks.length) return '<td class="cN" role="cell"></td>';
      var falta = [ra.x == null ? A : null, rb.x == null ? B : null].filter(Boolean);
      var R = window.REGUA.nicho(vals, marks, '', { k: L.k, fmt: L.fmt, un: L.un }); RN[L.k] = R;
      var txt = marks.map(function(m){ var c = m.letra === 'A' ? A : B, p = R.pos[m.id]; return 'lado ' + m.letra + ', ' + c.nome + ': ' + ord(p.pos, R.n) + (p.emp ? ', empate' : ''); }).join('; ');
      var html = R.html.replace('aria-label=""', 'aria-label="' + esc('Posição no nicho em ' + L.curto + '. ' + txt + '. Do menor ao maior, um traço por canal; os dois destacados são os lados A e B. Empate: os canais com o mesmo valor ficam empilhados.' + (R.raiz ? ' Escala comprimida (raiz quadrada).' : '')) + '"');
      info.pos[0] = R.pos[A.id]; info.pos[1] = R.pos[B.id]; info.n = R.n; info.raiz = R.raiz;
      return '<td class="cN" role="cell">' + html + '<small class="sub-n">' + (falta.length ? '<span class="nm"><i class="nm-h" aria-hidden="true"></i>sem traço de ' + esc(falta.map(function(c){ return c.nome; }).join(' e ')) + ': não medido</span>' : (R.raiz ? '' : '')) + (R.raiz ? (falta.length ? ' ' : '') + '<span class="raiz">escala √</span>' : '') + '</small></td>';
    }
    if (L.nobar || ra.x == null || rb.x == null || Math.max(ra.x, rb.x) <= 0) return '<td class="cN" role="cell"></td>';
    var mx = Math.max(ra.x, rb.x), oe = false;
    function b2(x, l){ var s = x / mx; if (x > 0 && s < 0.03) oe = true; return '<span class="b2"><span class="b2l" style="--c:' + COR[l] + '">' + (l ? 'B' : 'A') + '</span><span class="b2t"><i style="width:' + (x === 0 ? 0 : s * 100) + '%;--c:' + COR[l] + '"></i></span></span>'; }
    var h = '<span class="bars2" aria-hidden="true">' + b2(ra.x, 0) + b2(rb.x, 1) + '</span>';
    return '<td class="cN" role="cell">' + h + (oe ? '<small class="sub-n">a menor tem menos de 3% da barra da outra (ganha 3 px)</small>' : '') + '</td>';
  }

  /* ---------------------------------------------------------------- "Leitura rápida": o que a tabela diz, sem ler a tabela. Calculada dos mesmos números, sem IA.
     "É maior em", nunca "ganha". Linha sem itens não aparece. */
  function detalheMaior(x){
    var L = x.L, xa = x.ra, xb = x.rb, mx = x.m.lado === 0 ? xa : xb, mn = x.m.lado === 0 ? xb : xa;
    var compacto = function(r){ return L.k === 'cad' ? F.dec(r.x, 1) + ' por semana' : r.t; };
    if (L.valores) return L.curto + ' (' + mx.t + ' contra ' + mn.t + ')';
    if (x.m.r === Infinity) return L.curto + ' (' + compacto(mx) + ' contra 0)';
    return L.curto + ' (' + quanto(x.m.r) + ')';
  }
  function juntar(a){ return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }
  function leitura(A, B, linhas){
    var lados = [A, B], por = [[], []], rec = [], eq = [], falta = [[], []], nSem = 0;
    linhas.forEach(function(x){
      if (x.ra.t == null || x.rb.t == null){ nSem++; if (x.ra.t == null) falta[0].push(x.L.curto); if (x.rb.t == null) falta[1].push(x.L.curto); return; }
      if (!x.m) return;
      if (x.m.q === 'eq') eq.push(x.L.curto);
      else if (x.m.q === 'rec') rec.push(x);
      else por[x.m.lado].push(x);
    });
    var li = [];
    /* rodada 12: no máximo três itens por linha, os de maior diferença; o resto fica na tabela ("e mais N") */
    function lista3(its){
      its.sort(function(a, b){ return a.r === b.r ? 0 : b.r > a.r ? 1 : -1; });
      var top = its.slice(0, 3).map(function(i){ return i.t; }), mais = its.length - 3;
      return mais > 0 ? top.join(', ') + ' e mais ' + mais : juntar(top);
    }
    [0, 1].forEach(function(l){
      var its = por[l].map(function(x){ return { r: x.m.r, t: detalheMaior(x) }; });
      rec.filter(function(x){ return x.m.lado === l; }).forEach(function(){ its.push({ r: 1, t: 'publicação mais recente' }); });
      if (!its.length) return;
      li.push('<li><span class="lr-s" style="--c:' + COR[l] + '" aria-hidden="true">▲</span><span class="lr-t"><b style="color:' + COR[l] + '">' + esc(quem(lados[l], true)) + '</b> é maior em: ' + esc(lista3(its)) + '.</span></li>');
    });
    if (eq.length) li.push('<li><span class="lr-s eq" aria-hidden="true">＝</span><span class="lr-t">Praticamente iguais: ' + esc(eq.length > 3 ? eq.slice(0, 3).join(', ') + ' e mais ' + (eq.length - 3) : juntar(eq)) + '.</span></li>');
    if (nSem){
      var por_ = [0, 1].filter(function(l){ return falta[l].length; }).map(function(l){
        var nm = lados[l].own ? 'do seu canal' : 'de ' + lados[l].nome, n = falta[l];
        return 'falta o dado ' + esc(nm) + ' em ' + esc(n.length > 3 ? n.slice(0, 2).join(', ') + ' e mais ' + (n.length - 2) : juntar(n));
      });
      li.push('<li><span class="lr-s nmk" aria-hidden="true"><i class="nm-h"></i></span><span class="lr-t">Sem como comparar ainda: ' + nSem + (nSem === 1 ? ' número' : ' números') + ' (' + por_.join('; ') + ').</span></li>');
    }
    if (!li.length) return '';
    return '<div class="cp-lr" role="group" aria-labelledby="lrT"><h3 id="lrT">Leitura rápida</h3><ul>' + li.join('') + '</ul><p class="lr-n">Calculada dos mesmos números da tabela, sem IA. “É maior” não quer dizer “é melhor”.</p></div>';
  }

  var RN = {};
  function tabela(A, B){
    RN = {};
    var linhas = [], fora = [], conj = conjuntoNicho(A, B), raizes = [];
    LINHAS.forEach(function(L){
      var ra = L.get(A), rb = L.get(B);
      if (ra.t == null && rb.t == null){ fora.push(L.l); return; }
      var rel = L.norel ? null : L.frase ? fraseDias(A, B, ra, rb) : relacao(A, B, ra, rb, L.noun, L.k);
      var info = { pos: [null, null], n: null, raiz: false };
      var eixo = celulaEixo(L, A, B, ra, rb, conj, info);
      if (info.raiz) raizes.push(L.curto);
      linhas.push({ L: L, ra: ra, rb: rb, rel: rel, eixo: eixo, info: info, m: quemMaior(L, ra, rb) });
    });
    var grupos = [], gi = {};
    linhas.forEach(function(x){ if (!(x.L.g in gi)){ gi[x.L.g] = grupos.length; grupos.push({ g: x.L.g, rows: [] }); } grupos[gi[x.L.g]].rows.push(x); });
    var cab = function(c, l){ return '<th scope="col" role="columnheader" class="c' + (l ? 'B' : 'A') + '" style="--c:' + COR[l] + '"><span class="cl lm">Lado ' + (l ? 'B' : 'A') + '</span>' + esc(c.nome) + '</th>'; };
    var html = '<div class="cp-tw"><table class="cp-t" role="table"><caption class="sr">Números de ' + esc(A.nome) + ' (lado A) e de ' + esc(B.nome) + ' (lado B), lado a lado. Depois dos dois valores vem a posição entre os canais do nicho, e a última coluna diz quanto o lado B é do lado A.</caption>' +
      '<thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader" class="c0"><span class="sr">Número</span></th>' + cab(A, 0) + cab(B, 1) + '<th scope="col" role="columnheader" class="cN"><span class="cl">No nicho</span>do menor ao maior</th><th scope="col" role="columnheader" class="cR"><span class="sr">Relação: </span>B em relação a A</th></tr></thead>';
    var GK = { 'Tamanho do canal': 'tam', 'Publicação': 'pub', 'Desempenho dos vídeos': 'des' };
    grupos.forEach(function(g){
      html += '<tbody role="rowgroup"><tr role="row" class="grp"><th scope="rowgroup" role="rowheader" colspan="5">' + (ICONES[GK[g.g]] || '') + esc(g.g) + '</th></tr>';
      g.rows.forEach(function(x){
        html += '<tr role="row"><th scope="row" role="rowheader" class="rl">' + esc(x.L.l) + '<small>' + esc(x.L.sub) + '</small></th>' +
          celula(x.ra, A, 0, { pos: x.info.pos[0], n: x.info.n }) + celula(x.rb, B, 1, { pos: x.info.pos[1], n: x.info.n }) + x.eixo;
        html += x.rel ? '<td role="cell" class="rel' + (x.rel.dim ? ' dim' : '') + '">' + simbolo(x.rel) + '<span class="rt">' + esc(x.rel.t) + '</span></td>'
          : '<td role="cell" class="rel off">' + (x.L.norel ? '' : '<span class="sr">sem relação: um dos lados não foi medido</span>') + '</td>';
        html += '</tr>';
      });
      html += '</tbody>';
    });
    $('cpTab').innerHTML = html + '</table></div>';
    $('cpLeitura').innerHTML = leitura(A, B, linhas);
    var nota = 'Maior não quer dizer melhor: são canais de tamanhos diferentes.';
    if (fora.length) nota += ' <b>' + (fora.length === 1 ? '1 número ficou' : fora.length + ' números ficaram') + ' de fora</b>: nenhum dos dois canais tem o dado (os nomes estão no ⓘ).';
    $('cpNota').innerHTML = nota;
    window.REGUA.ajustar($('cpTab'));
    return { fora: fora, raizes: raizes, linhas: linhas, nNicho: conj.length };
  }
  function dicaTabela(t){
    var raiz = t.raizes.length ? 'Escala comprimida (raiz quadrada) em ' + juntar(t.raizes) + ', para o maior do nicho não apagar os pequenos; as demais, em escala linear.' : 'Escala linear em todas as réguas.';
    return '<h3>Como ler esta tabela</h3><ul>' +
      '<li><b>Os lados:</b> laranja é o seu canal, azul é o outro; quando nenhum dos dois é seu, o lado A é areia. Cada lado também tem a sua letra, A ou B, para não depender da cor.</li>' +
      '<li><b>Régua do nicho:</b> um traço por canal de Viagem lido em 09/10 (' + t.nNicho + ' canais, com o seu), do menor ao maior; os dois traços destacados e com letra são os lados A e B. A posição escrita ao lado de cada valor é a do mesmo número (1º = o maior). ' + raiz + ' Lado sem dado não ganha traço, e a linha diz de quem falta.</li>' +
      '<li><b>Barras finas:</b> nos números que só existem para os dois canais, uma barra por lado, no mesmo eixo, proporcional ao maior dos dois. Se a menor passa a ser menos de 3% da maior, ela ganha 3 px e a linha avisa.</li>' +
      '<li><b>B em relação a A:</b> a partir de 2× a frase usa “×”; abaixo, percentual. Diferença menor que 10% é “praticamente igual”. ▲ marca o lado maior, ＝ os praticamente iguais. Sem relação quando um lado não foi medido ou há zero.</li>' +
      '<li><b>Dias desde o último vídeo:</b> sem barra nem régua (menor é mais recente, e a barra cheia leria como vantagem).</li>' +
      '<li><b>Não medido</b> (hachura violeta): o dado não existe para esse lado; não é zero.</li>' +
      (t.fora.length ? '<li><b>Ficaram de fora</b> porque nenhum dos dois tem o dado neste mockup: ' + esc(juntar(t.fora)) + '.</li>' : '') + '</ul>';
  }

  /* ---------------------------------------------------------------- "só o seu canal mede" */
  function bloco(A, B){
    var el = $('cpOwn'), donos = [A, B].filter(function(c){ return c.own && c.det && c.det.reach; });
    if (!donos.length){ el.hidden = true; el.innerHTML = ''; return false; }
    var outro = [A, B].filter(function(c){ return !(c.own && c.det && c.det.reach); });
    el.hidden = false;
    el.innerHTML = '<h2 id="hOwn">Só o seu canal mede</h2><p class="cp-lead">Impressões e cliques só chegam ao dono do canal. ' + (outro.length ? esc(outro.map(function(c){ return c.nome; }).join(' e ')) + (outro.length > 1 ? ' não têm' : ' não tem') + ' esse número aqui porque o YouTube não o entrega, <b>não porque seja zero</b>.' : '') + '</p>' +
      donos.map(function(c){
        var R = c.det.reach, lidos = R.diasCom + R.diasVazios, cor = corDe(c);
        return '<div class="cp-ownc" style="--c:' + cor + '"><h3>' + chip(c === A ? 'A' : 'B', c === A ? 'Lado A' : 'Lado B') + esc(c.nome) + '</h3><dl><div><dt>Impressões</dt><dd><b class="num">' + R.imp + '</b></dd></div><div><dt>Cliques estimados</dt><dd><b class="num">' + R.cliques + '</b></dd></div>' +
          '<div><dt>Relatórios com impressão</dt><dd><b class="num">' + R.diasCom + ' de ' + lidos + '</b></dd></div></dl>' +
          '<p><b class="num">' + R.cliques + ' ' + (R.cliques === 1 ? 'clique' : 'cliques') + '</b> estimados em <b class="num">' + R.imp + ' impressões</b>. De ' + F.data(R.de) + ' a ' + F.data(R.ate) + ' (' + R.diasPeriodo + ' dias); ' + (R.diasPeriodo - lidos) + ' dias ainda sem relatório baixado. Pouco demais para falar em percentual. <a class="lk" href="canal-proprio.html?painel=1">Ver o gráfico por dia</a></p></div>';
      }).join('');
    return true;
  }

  /* ---------------------------------------------------------------- vídeos mais vistos */
  function videosDe(c){
    if (c.semVideos) return '<p class="cp-nv">Este canal não tem vídeos.</p>';
    if (!c.det) return '<p class="cp-nv">Os vídeos de ' + esc(c.nome) + ' não estão neste mockup (só os de Leo Khev e tnFigueiredo). ' + (c.acomp != null ? 'No resumo ele tem ' + F.plural(c.acomp, 'longo acompanhado', 'longos acompanhados') + '.' : '') + '</p>';
    var d = c.det;
    return '<p class="cp-cnt">' + (d.top.length < 5 ? 'Só ' + d.top.length + ' vídeos com contagem de views.' : '5 de ' + F.plural(d.n, 'vídeo guardado', 'vídeos guardados') + ', por views.') + '</p><ol class="cp-t5">' + d.top.map(function(v){
      var h = c.own ? 'video-proprio.html?id=' + encodeURIComponent(v.id) : 'video.html?id=' + encodeURIComponent(v.id);
      return '<li><a href="' + esc(h) + '"><img src="' + esc(v.thumb) + '" alt="" width="64" height="36" loading="lazy"><span><b>' + esc(v.t) + '</b><small><span class="num">' + F.num(v.views) + '</span> views, ' + (v.pub ? F.ha(v.pub) : 'sem data') + (v.fmt === 'short' ? ' · Short' : '') + '</small></span></a></li>';
    }).join('') + '</ol>';
  }

  /* ---------------------------------------------------------------- faixa de publicação (90 dias) */
  function publicacao(A, B){
    var el = $('cpPub'), lados = [A, B];
    if (!lados.some(function(c){ return c.det; })){ el.hidden = true; el.innerHTML = ''; return false; }
    var ini = NOW - 90 * DIA;
    function tira(c, i){
      if (c.semVideos) return '<div class="cp-pr" style="--c:' + COR[i] + '"><p class="cp-pl"><b>' + chip(i ? 'B' : 'A') + esc(c.nome) + '</b><span>Sem vídeos.</span></p><p class="cp-pv">Sem vídeos para marcar.</p></div>';
      if (!c.det) return '<div class="cp-pr" style="--c:' + COR[i] + '"><p class="cp-pl"><b>' + chip(i ? 'B' : 'A') + esc(c.nome) + '</b><span>' + (c.l90 != null ? F.plural(c.l90, 'longo', 'longos') + ' em 90 dias no resumo.' : '') + '</span></p><p class="cp-pv">As datas de publicação deste canal não estão neste mockup, então não há o que marcar no tempo.</p></div>';
      var r = c.det.r90, lg = r.filter(function(v){ return v.fmt === 'long'; }).length, sh = r.filter(function(v){ return v.fmt === 'short'; }).length, nc = r.length - lg - sh;
      var txt = r.length ? F.plural(r.length, 'vídeo', 'vídeos') + ' em 90 dias: ' + F.plural(lg, 'longo', 'longos') + ' e ' + F.plural(sh, 'Short', 'Shorts') + (nc ? ' e ' + nc + ' de formato não confirmado' : '') + '.'
        : 'Nenhum vídeo em 90 dias. O último foi em ' + F.data(c.det.ult.pub, true) + '.';
      var al = r.length ? 'Vídeos de ' + c.nome + ' nos últimos 90 dias, nas datas: ' + r.map(function(v){ return F.data(v.pub); }).join(', ') + '.' : txt;
      return '<div class="cp-pr" style="--c:' + COR[i] + '"><p class="cp-pl"><b>' + chip(i ? 'B' : 'A') + esc(c.nome) + '</b><span>' + esc(txt) + '</span></p><div class="cp-strip" role="img" aria-label="' + esc(al) + '">' +
        [30, 60].map(function(d){ return '<i class="gl" style="left:' + (d / 90 * 100) + '%"></i>'; }).join('') +
        r.map(function(v){ return '<i class="t ' + (v.fmt === 'short' ? 'sh' : 'lg') + '" style="left:' + ((v.pub - ini) / (90 * DIA) * 100).toFixed(2) + '%"></i>'; }).join('') + '</div></div>';
    }
    el.hidden = false;
    el.innerHTML = '<h2 id="hPub">Publicação nos últimos 90 dias</h2><p class="cp-lead">Um traço por vídeo, no mesmo eixo para os dois canais. Traço alto: longo. Traço baixo: Short.</p>' + tira(A, 0) + tira(B, 1) +
      '<div class="cp-pr cp-ax"><span class="cp-pl" aria-hidden="true"></span><div class="cp-axis" aria-hidden="true"><span>' + F.data(ini) + '</span><span>' + F.data(ini + 30 * DIA) + '</span><span>' + F.data(ini + 60 * DIA) + '</span><span>hoje, ' + F.data(NOW) + '</span></div></div>';
    return true;
  }

  /* ---------------------------------------------------------------- A7: cartão "Leitura da forja" no fim da página.
     Concorrente × concorrente: botão de pedir + as TRÊS etapas (Na fila, Escrevendo, Pronta) + uma leitura de EXEMPLO (fabricada).
     Com o canal próprio num dos lados: "ainda não disponível", botão desabilitado e o porquê (igual a video-proprio.html).
     "Leitura de comparação" é um pacote novo para a forja: NÃO existe no produto. */
  var fj = { e: 'nunca', timers: [] };
  function fjLimpar(){ fj.timers.forEach(clearTimeout); fj.timers = []; fj.e = 'nunca'; }
  var CHK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 8.3l2.4 2.4 5.2-5.4"/></svg>';
  function fjEtapas(e){
    var i = e === 'fila' ? 0 : e === 'trabalhando' ? 1 : e === 'pronta' ? 3 : -1, nomes = ['Na fila', 'Escrevendo', 'Pronta'];
    return '<ol class="fj-steps n3" aria-label="Etapas do pedido">' + nomes.map(function(n, j){
      var s = j < i ? 'done' : j === i ? 'now' : 'todo', pronta = e === 'pronta';
      if (pronta) s = 'done';
      var sub = s === 'now' ? 'em andamento' : '';
      return '<li class="' + s + '"' + (s === 'now' ? ' aria-current="step"' : '') + '><span class="fj-dot" aria-hidden="true">' + (s === 'done' ? CHK : '') + '</span><span class="fj-sn">' + n + '</span>' +
        (sub ? '<span class="fj-ss">' + sub + '</span>' : '<span class="sr">' + (s === 'done' ? ', concluída' : ', a seguir') + '</span>') + '</li>';
    }).join('') + '</ol>';
  }
  function exemploLeitura(A, B, T){
    function r(k){ return T.linhas.filter(function(x){ return x.L.k === k && x.ra.x != null && x.rb.x != null; })[0]; }
    var f = [], i = r('inscritos'), m = r('med'), l = r('l90'), v = r('vpm'), ac = r('acomp');
    if (i) f.push(B.nome + ' tem ' + i.rb.t + ' inscritos e ' + A.nome + ' tem ' + i.ra.t + '.');
    if (m) f.push('A mediana de views dos longos é ' + m.rb.t + ' em ' + B.nome + ' e ' + m.ra.t + ' em ' + A.nome + '.');
    if (l) f.push('Nos últimos 90 dias, ' + B.nome + ' publicou ' + F.plural(+l.rb.t, 'longo', 'longos') + ' e ' + A.nome + ', ' + l.ra.t + '.');
    else if (ac) f.push('No resumo, ' + B.nome + ' tem ' + F.plural(+ac.rb.t, 'longo acompanhado', 'longos acompanhados') + ' e ' + A.nome + ', ' + ac.ra.t + '.');
    if (v && f.length < 3) f.push('Em views por dia por mil inscritos, são ' + v.rb.t + ' contra ' + v.ra.t + '.');
    f.push('Isso descreve o que os números mostram agora; não diz por que a diferença existe.');
    return f.join(' ');
  }
  function forjaCard(A, B, T){
    var el = $('cpFj'), dono = A.own || B.own;
    if (dono){
      var d = A.own ? A : B, o = A.own ? B : A;
      el.innerHTML = '<section class="forja fj cp-fj off" role="region" aria-labelledby="fjH"><div class="fj-top"><h3 id="fjH">Leitura da forja<span class="fj-off">ainda não disponível para o seu canal</span></h3></div>' +
        '<p class="what">A leitura desta comparação seria sobre os números dos dois canais lado a lado, com as mesmas cautelas das outras leituras: só diz o que está nos números, sem afirmar causa.</p>' +
        '<div class="ask col"><button type="button" class="btn forja-solid" aria-disabled="true" aria-describedby="fjPq">Pedir leitura desta comparação à forja</button>' +
        '<p id="fjPq">Ainda não dá: a forja hoje só recebe dados públicos de concorrentes; a comparação com o seu canal chega depois que a coleta diária estiver no ar.</p></div></section>';
      return;
    }
    var e = fj.e, andando = e === 'fila' || e === 'trabalhando';
    var h = '<section class="forja fj cp-fj" role="region" aria-labelledby="fjH" id="fjCard"><div class="fj-top"><h3 id="fjH" tabindex="-1">Leitura da forja' + (andando ? '<span class="fj-run">em andamento</span>' : '') + '</h3></div>' +
      '<p class="what">A forja leria os números públicos de ' + esc(A.nome) + ' e de ' + esc(B.nome) + ' e escreveria 3 ou 4 frases sobre o que os números mostram, sem afirmar causa.</p>' + fjEtapas(e);
    if (andando) h += '<p class="fj-sim">Simulação do mockup: as etapas avançam sozinhas em poucos segundos. Nada é enviado à forja.</p>';
    if (e === 'pronta'){
      h += '<div class="fj-ex" role="note"><span class="ex">exemplo</span> Texto escrito para o mockup, não pela forja. “Leitura de comparação” é um pacote novo que a forja ainda não tem. Os números citados são os desta tela.</div>' +
        '<div class="row"><span class="stamp">forja · Gemma 12B · em treino · exemplo</span></div>' +
        '<div lang="pt-BR" class="read-box"><p class="read">' + esc(exemploLeitura(A, B, T)) + '</p></div>';
    }
    if (e === 'nunca' || e === 'pronta') h += '<div class="ask"><button type="button" class="btn forja-solid" data-fjc="pedir">' + (e === 'pronta' ? 'Pedir nova leitura desta comparação à forja' : 'Pedir leitura desta comparação à forja') + '</button>' +
      (e === 'nunca' ? '<p>Ainda não há leitura desta comparação. Ninguém pediu uma até hoje.</p>' : '') + '</div>';
    el.innerHTML = h + '</section>';
  }
  function fjPedir(){
    var A = REG[st.a], B = REG[st.b];
    function ir(e, ms, fala){ fj.timers.push(setTimeout(function(){ fj.e = e; forjaCard(A, B, ultima); if (fala) anunciar(fala); var hh = $('fjH'); if (e === 'pronta' && hh) hh.focus({ preventScroll: true }); }, ms)); }
    fj.e = 'fila'; forjaCard(A, B, ultima); anunciar('Pedido enviado. Aguardando: na fila.'); var hh = $('fjH'); if (hh) hh.focus({ preventScroll: true });
    ir('trabalhando', 2200, 'Aguardando: a forja está escrevendo.');
    ir('pronta', 4800, 'Pronta: leitura de exemplo publicada.');
  }
  var ultima = null;

  /* ---------------------------------------------------------------- montagem */
  function render(anuncio){
    var A = REG[st.a], B = REG[st.b];
    definirCores(A, B);
    lado(A, 'A'); lado(B, 'B'); sincSeletores();
    var T = tabela(A, B), fora = T.fora; ultima = T; bloco(A, B);
    $('hVid').textContent = 'Os 5 vídeos mais vistos de cada canal';
    $('cpVids').innerHTML = [A, B].map(function(c, i){ return '<div class="cp-vc" style="--c:' + COR[i] + '"><h3>' + chip(i ? 'B' : 'A', i ? 'Lado B' : 'Lado A') + esc(c.nome) + '</h3>' + videosDe(c) + '</div>'; }).join('');
    var pub = publicacao(A, B);
    if (!pub){ var nota = $('cpNota'); nota.innerHTML += ' <b>O bloco de publicação não aparece</b>: nenhum dos dois canais tem datas de publicação neste mockup.'; }
    fjLimpar(); forjaCard(A, B, T);
    document.title = 'Comparar: ' + A.nome + ' e ' + B.nome + ' — Observatório';
    if (anuncio) anunciar('Comparando ' + A.nome + ' e ' + B.nome + '. ' + (fora.length ? (fora.length === 1 ? '1 número sem dado em nenhum dos dois canais ficou' : fora.length + ' números sem dado em nenhum dos dois canais ficaram') + ' de fora.' : ''));
  }
  function mudar(lado, id){
    var outro = lado === 'a' ? 'b' : 'a';
    if (id === st[outro]) return;
    st[lado] = id; gravarUrl(); render(true);
  }

  lerUrl(); montarSeletores(); gravarUrl(); render(false);
  $('selA').addEventListener('change', function(e){ mudar('a', e.target.value); });
  $('selB').addEventListener('change', function(e){ mudar('b', e.target.value); });
  window.REGUA.ligarNicho($('cpTab'), function(k){ return RN[k]; });
  $('cpInfo').addEventListener('click', function(e){ e.stopPropagation(); window.FAIXA.dica($('cpInfo'), dicaTabela(ultima)); });
  document.addEventListener('click', function(e){ var b = e.target.closest('[data-fjc="pedir"]'); if (b) fjPedir(); });
  addEventListener('load', function(){ window.REGUA.ajustar(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ window.REGUA.ajustar(); });
  $('cpSwap').addEventListener('click', function(){ var t = st.a; st.a = st.b; st.b = t; gravarUrl(); render(true); });

  /* atalhos do mockup: pares que exercitam os casos */
  var PARES = [['Próprio × Leo Khev (o logo acima)', 'proprio', 'leo-khev'], ['Próprio × concorrente grande', 'proprio', 'nomade-raiz'], ['Próprio × concorrente pequeno', 'proprio', 'esq-unltd-daily'],
    ['Concorrente × concorrente', 'dale-philip', 'lucas-bigodinho'], ['Leo Khev × Aldinho', 'leo-khev', 'aldinho'], ['Próprio × Sonhe Alto (sem views/dia)', 'proprio', 'sonhe-alto-viagens'], ['Próprio × Thiago Figueiredo (sem vídeos)', 'proprio', 'proprio-2']];
  $('mkPares').innerHTML = PARES.map(function(p){ return '<a class="mkb" href="comparar.html?a=' + p[1] + '&amp;b=' + p[2] + '">' + p[0] + '</a>'; }).join('');
})();
