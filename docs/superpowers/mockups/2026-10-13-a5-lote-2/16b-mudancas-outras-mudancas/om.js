/* om.js: mockup 16b, aba Mudanças com a visão "Outras mudanças" (tags, categoria, duração, capítulos, formato), fora da conta Trocas.
   Parâmetros: ?caso=trocas|tipico|magro|extremo|zero|nao-medido|filtro-zero|erro|carregando|vazio|leitura  ?tema=claro
   Dentro da tela respondem: a visão (Trocas | Outras mudanças), Janela, Formato, Ordenar, o filtro de tipo, "Mostrar mais" e "Tentar de novo".
   TUDO é exemplo: canais, vídeos e números inventados (a marca "exemplo" está na tela). Hoje = 13/10/2026 (L.HOJE).
   Regras que a tela cumpre: a contagem da aba e a conta "Trocas" são título + miniatura e NÃO mudam; as outras mudanças ficam fora; descrição tem lugar à parte e não entra em nenhuma das duas.
   O histórico dessas mudanças só existe desde o deploy da E1 (data de exemplo por caso): dia antes disso é "não medido" (hachura rosa), nunca zero. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, q = A.q, esc = A.esc, HOJE = L.HOJE;
  var caso = q.get('caso') || 'tipico';

  /* ---------------------------------------------------------------- ícones de traço: uma forma por tipo */
  function sv(c){ return '<svg class="i" viewBox="0 0 16 16" aria-hidden="true">' + c + '</svg>'; }
  var IC = {
    tags: sv('<path d="M2.3 8.1V2.9a.6.6 0 0 1 .6-.6h5.2l5.6 5.6a.9.9 0 0 1 0 1.3L9.2 13.5a.9.9 0 0 1-1.3 0Z"/><circle cx="5.3" cy="5.3" r=".9"/>'),
    categoria: sv('<rect x="2.3" y="2.3" width="4.7" height="4.7" rx="1"/><rect x="9" y="2.3" width="4.7" height="4.7" rx="1"/><rect x="2.3" y="9" width="4.7" height="4.7" rx="1"/><rect x="9" y="9" width="4.7" height="4.7" rx="1"/>'),
    duracao: sv('<circle cx="8" cy="9" r="5"/><path d="M8 6.2V9l2 1.3M6.3 1.8h3.4"/>'),
    capitulos: sv('<circle cx="3.2" cy="4" r=".8"/><circle cx="3.2" cy="8" r=".8"/><circle cx="3.2" cy="12" r=".8"/><path d="M6.2 4h7.3M6.2 8h7.3M6.2 12h5"/>'),
    formato: sv('<rect x="1.6" y="5" width="8.2" height="5.6" rx="1.2"/><rect x="11.2" y="2.6" width="3.2" height="10.8" rx="1.2"/>'),
    todos: sv('<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>'),
    seta: sv('<path d="M2.5 8h10M9 4.5 12.5 8 9 11.5"/>'),
    lock: sv('<rect x="3.2" y="7" width="9.6" height="6.4" rx="1.4"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/>'),
    troca: sv('<path d="M2.5 5.2h8.6M8.6 2.7l2.5 2.5-2.5 2.5M13.5 10.8H4.9M7.4 8.3l-2.5 2.5 2.5 2.5"/>'),
    longo: sv('<rect x="1.8" y="4.6" width="12.4" height="6.8" rx="1.4"/>'),
    short: sv('<rect x="4.8" y="1.8" width="6.4" height="12.4" rx="1.4"/>')
  };
  var TIPOS = [['tags', 'Tags'], ['categoria', 'Categoria'], ['duracao', 'Duração'], ['capitulos', 'Capítulos'], ['formato', 'Formato']];
  var NOME = { tags: 'Tags', categoria: 'Categoria', duracao: 'Duração', capitulos: 'Capítulos', formato: 'Formato' };
  var SLOT = ['entre 00h e 06h', 'entre 06h e 12h', 'entre 12h e 18h', 'entre 18h e 24h'];
  function pl(n, a, b){ return L.pl(n, a, b); }
  function num(n){ return '<b class="num">' + A.n(n) + '</b>'; }

  /* ---------------------------------------------------------------- casos: início do histórico (data de exemplo), contas de trocas por janela */
  var TR = { tip: { 7: 5, 30: 12, 90: 31 }, mag: { 7: 4, 30: 12, 90: 27 }, ext: { 7: 19, 30: 63, 90: 148 } };
  var CASOS = {
    trocas:        { ver: 'trocas', inicio: '2026-09-29', d: 'tip', tr: 'tip' },
    tipico:        { ver: 'outras', inicio: '2026-09-29', d: 'tip', tr: 'tip' },
    magro:         { ver: 'outras', inicio: '2026-10-07', d: 'mag', tr: 'mag' },
    extremo:       { ver: 'outras', inicio: '2026-07-15', d: 'ext', tr: 'ext' },
    zero:          { ver: 'outras', inicio: '2026-09-29', d: 'nada', tr: 'tip' },
    'nao-medido':  { ver: 'outras', inicio: '2026-10-17', d: 'nada', tr: 'tip' },
    'filtro-zero': { ver: 'outras', inicio: '2026-09-29', d: 'tip', tr: 'tip', tipo: 'formato' },
    erro:          { ver: 'outras', inicio: '2026-09-29', d: 'tip', tr: 'tip' },
    carregando:    { ver: 'outras', inicio: '2026-09-29', d: 'tip', tr: 'tip' },
    vazio:         { ver: 'outras', inicio: '2026-09-29', d: 'nada', tr: 'tip' },
    leitura:       { ver: 'outras', inicio: '2026-09-29', d: 'tip', tr: 'tip' }
  };
  if (!CASOS[caso]) caso = 'tipico';
  var CFG = CASOS[caso];
  var ST = { ver: q.get('ver') || CFG.ver, janela: Number(q.get('janela')) || 30, fmt: q.get('fmt') || 'todos', tipo: q.get('tipo') || CFG.tipo || 'todos', ord: q.get('ord') || 'recentes', mais: 1, falhou: caso === 'erro' };
  var INICIO = CFG.inicio;

  /* ---------------------------------------------------------------- dados de exemplo */
  var TAGP = ['viagem barata', 'mochilão', 'sudeste asiático', 'roteiro', 'dicas de viagem', 'nômade digital', 'street food', 'vietnã', 'tailândia', 'hanói', 'bangkok', 'hotel', 'wi-fi', 'custo de vida', '2026', 'vlog', 'lisboa', 'portugal', 'cidade', 'trem', 'bairros', 'seguro viagem', 'chip de celular', 'aeroporto'];
  var CATP = ['Viagem e eventos', 'Entretenimento', 'Pessoas e blogs', 'Educação', 'Estilo de vida'];
  var CANAIS = ['Nômade Raiz', 'Lucas Bigodinho', 'Dale Philip', 'Paddy Doyle', 'Lodir', 'Aldinho', 'Leo'];

  function dadosTip(){
    var V = [
      { id: 1, t: 'Hanói de moto: 3 dias, zero plano', c: 'Dale Philip', fmt: 'long' },
      { id: 2, t: 'Tailândia em 10 dias: o roteiro completo', c: 'Nômade Raiz', fmt: 'long' },
      { id: 3, t: 'Bangkok barata não existe mais', c: 'Paddy Doyle', fmt: 'long' },
      { id: 4, t: 'O truque do Wi-Fi que os hotéis escondem', c: 'Lucas Bigodinho', fmt: 'long' }
    ];
    var R = [
      { v: 1, k: 'capitulos', d: '2026-10-12', s: 3, antes: 0, depois: 6, marcas: [0, .12, .27, .44, .63, .81] },
      { v: 2, k: 'categoria', d: '2026-10-11', s: 1, de: 'Viagem e eventos', para: 'Entretenimento' },
      { v: 2, k: 'tags', d: '2026-10-09', s: 2, add: ['street food', 'custo de vida', '2026'], del: ['viagem barata'], antes: 12, depois: 14 },
      { v: 3, k: 'tags', d: '2026-10-05', s: 2, add: ['custo de vida'], del: [], antes: 7, depois: 8 },
      { v: 4, k: 'duracao', d: '2026-10-03', s: 0, antes: 478, depois: 491 }
    ];
    return { V: V, R: R };
  }
  function dadosMag(){
    return { V: [{ id: 1, t: 'Lisboa em 5 dias com 300 euros', c: 'Lodir', fmt: 'long' }],
      R: [{ v: 1, k: 'tags', d: '2026-10-12', s: 1, add: ['lisboa', 'portugal'], del: [], antes: 9, depois: 11 }] };
  }
  function dadosExt(){
    var r = A.rnd(16), V = [], R = [], i;
    var locais = ['Tailândia', 'Bangkok', 'Hanói', 'Lisboa', 'Chiang Mai', 'Bali', 'Tóquio', 'Medellín', 'Cusco', 'Porto'];
    var modelos = ['em 10 dias: o roteiro completo', 'por R$ 300 por dia: dá?', 'os 5 piores erros', 'guia de bairros para ficar', 'o que ninguém conta', 'de trem, sem pressa', 'mochilão: quanto custou de verdade'];
    for (i = 0; i < 70; i++) {
      var curto = i % 9 === 4;
      V.push({ id: i + 1, t: curto ? locais[i % 10] + ' em 30 segundos' : locais[i % 10] + ' ' + modelos[Math.floor(i / 10) % 7], c: CANAIS[i % 7], fmt: curto ? 'short' : 'long' });
    }
    V[0].t = 'Eu tentei viver três meses em Medellín gastando só o que um brasileiro ganha de salário mínimo, e isto aconteceu';
    function pick(n, ex){ var out = []; while (out.length < n) { var t = TAGP[Math.floor(r() * TAGP.length)]; if (out.indexOf(t) < 0 && ex.indexOf(t) < 0) out.push(t); } return out; }
    function reg(v, k, dia){
      var o = { v: v, k: k, d: A.addDias(HOJE, -dia), s: Math.floor(r() * 4) };
      if (k === 'tags') { var na = 1 + Math.floor(r() * 4), nd = Math.floor(r() * 3); o.add = pick(na, []); o.del = pick(nd, o.add); o.antes = 8 + Math.floor(r() * 10); o.depois = o.antes + na - nd; }
      else if (k === 'categoria') { var a = Math.floor(r() * 5), b = (a + 1 + Math.floor(r() * 4)) % 5; o.de = CATP[a]; o.para = CATP[b]; }
      else if (k === 'duracao') { o.antes = 300 + Math.floor(r() * 1500); o.depois = o.antes + (r() < .5 ? -1 : 1) * (5 + Math.floor(r() * 40)); }
      else if (k === 'capitulos') { o.antes = Math.floor(r() * 4); o.depois = o.antes + 2 + Math.floor(r() * 5); o.marcas = []; for (var j = 0; j < o.depois; j++) o.marcas.push(j === 0 ? 0 : Math.min(.95, j / o.depois + (r() - .5) * .05)); }
      else if (k === 'formato') { o.de = V[v - 1].fmt === 'short' ? 'Longo' : 'Short'; o.para = V[v - 1].fmt === 'short' ? 'Short' : 'Longo'; }
      return o;
    }
    var tipos30 = []; [['tags', 52], ['categoria', 9], ['duracao', 18], ['capitulos', 13], ['formato', 2]].forEach(function(p){ for (var n = 0; n < p[1]; n++) tipos30.push(p[0]); });
    for (i = tipos30.length - 1; i > 0; i--) { var j2 = Math.floor(r() * (i + 1)), t = tipos30[i]; tipos30[i] = tipos30[j2]; tipos30[j2] = t; }
    /* o primeiro vídeo tem a troca de tags mais longa (caso extremo de chips) */
    var big = reg(1, 'tags', 0); big.add = TAGP.slice(0, 9); big.del = TAGP.slice(9, 15); big.antes = 14; big.depois = 17; big.s = 3; R.push(big);
    tipos30.splice(tipos30.indexOf('tags'), 1);
    /* e o primeiro vídeo ganha várias mudanças de campos diferentes: ele puxa o "mais N mudanças" */
    ['capitulos', 'categoria', 'duracao', 'tags'].forEach(function(k, n){ tipos30.splice(tipos30.indexOf(k), 1); var x = reg(1, k, 0); x.s = 2 - n % 3; if (n === 3) x.d = A.addDias(HOJE, -1); R.push(x); });
    var v;
    tipos30.forEach(function(k, n){ v = n < 60 ? 2 + (n % 60) : 2 + Math.floor(r() * 66); R.push(reg(v, k, Math.floor(r() * 30))); });
    var pesos = ['tags', 'tags', 'tags', 'tags', 'tags', 'tags', 'categoria', 'duracao', 'duracao', 'capitulos', 'capitulos', 'formato'];
    for (i = 0; i < 120; i++) R.push(reg(1 + Math.floor(r() * 70), pesos[Math.floor(r() * pesos.length)], 30 + Math.floor(r() * 60)));
    return { V: V, R: R };
  }
  var DADOS = CFG.d === 'tip' ? dadosTip() : CFG.d === 'mag' ? dadosMag() : CFG.d === 'ext' ? dadosExt() : { V: [], R: [] };
  /* a conta de uma troca de formato conferida com a duração: nada a calcular aqui, é exemplo */

  /* ---------------------------------------------------------------- cálculo (sobre o que aparece) */
  function janelaIni(){ return A.addDias(HOJE, -(ST.janela - 1)); }
  function naJanela(r){ return r.d >= janelaIni() && r.d <= HOJE && r.d >= INICIO; }
  function vid(r){ return DADOS.V[r.v - 1]; }
  function filtrados(comTipo){
    return DADOS.R.filter(function(r){
      return naJanela(r) && (ST.fmt === 'todos' || vid(r).fmt === (ST.fmt === 'longos' ? 'long' : 'short')) && (!comTipo || ST.tipo === 'todos' || r.k === ST.tipo);
    });
  }
  function medidos(){ /* dias com histórico dentro da janela */
    var ini = janelaIni(); if (INICIO > HOJE) return 0;
    var de = INICIO > ini ? INICIO : ini; return A.dias(de, HOJE) + 1;
  }
  function trocas(){ return TR[CFG.tr][ST.janela]; }
  function modo(){
    if (caso === 'vazio') return 'vazio';
    if (ST.falhou) return 'erro';
    if (caso === 'carregando') return 'carregando';
    if (medidos() === 0) return 'nm';
    var base = DADOS.R.filter(naJanela);
    if (!base.length) return 'zero';
    return 'dado';
  }
  var MODO = modo();
  /* r1/B1: a caixa de cima é a conta da ABA, que em produção conta SEMPRE 30 dias e não olha o formato.
     Ela roda a mesma lógica com a janela fixa em 30 d e o formato em "todos"; a janela e o formato escolhidos
     mandam só no bloco de baixo. */
  function noTopo(fn){
    var j = ST.janela, f = ST.fmt, m = MODO;
    ST.janela = 30; ST.fmt = 'todos'; MODO = modo();
    try { return fn(); } finally { ST.janela = j; ST.fmt = f; MODO = m; }
  }

  function slotKey(r){ return r.d + String(r.s); }
  function grupos(){
    var rs = filtrados(true), mapa = {}, ordem = [];
    rs.forEach(function(r){ if (!mapa[r.v]) { mapa[r.v] = []; ordem.push(r.v); } mapa[r.v].push(r); });
    ordem.forEach(function(v){ mapa[v].sort(function(a, b){ return slotKey(a) < slotKey(b) ? 1 : -1; }); });
    ordem.sort(function(a, b){
      if (ST.ord === 'muitas' && mapa[a].length !== mapa[b].length) return mapa[b].length - mapa[a].length;
      return slotKey(mapa[a][0]) < slotKey(mapa[b][0]) ? 1 : slotKey(mapa[a][0]) > slotKey(mapa[b][0]) ? -1 : a - b;
    });
    return ordem.map(function(v){ return { v: DADOS.V[v - 1], rs: mapa[v] }; });
  }

  /* ---------------------------------------------------------------- peças pequenas */
  function nomeDeTipo(k){ return NOME[k]; }
  function zero(n){ return '<span class="om-zero" role="img" aria-label="zero medido">' + n + '</span>'; }
  function seg(rotulo, id, itens, atual, dataAttr){
    return '<div class="om-fld"><span class="om-lb" id="' + id + '">' + rotulo + '</span><div class="om-seg" role="group" aria-label="' + rotulo + '">' + itens.map(function(i){
      return '<button type="button" ' + dataAttr + '="' + i[0] + '" aria-pressed="' + (atual === i[0]) + '">' + i[1] + '</button>'; }).join('') + '</div></div>';
  }
  function dataLonga(d){ return A.dm(d); }

  /* ---------------------------------------------------------------- a primeira caixa: frase, duas contas em barras, seletor de visão */
  function fraseGlobal(){
    var n = trocas(), a = num(n) + ' ' + A.plural(n, 'troca', 'trocas') + ' de título ou miniatura nos últimos 30 dias; ';
    var m = filtrados(false).length;
    if (MODO === 'vazio') return 'Nenhum canal acompanhado neste nicho: não há o que contar.';
    if (MODO === 'erro') return a + 'as outras mudanças não carregaram.';
    if (MODO === 'carregando') return a + 'carregando as outras mudanças…';
    if (MODO === 'nm') return a + 'as outras mudanças ainda não são medidas: o Observatório passa a guardá-las em ' + dataLonga(INICIO) + '.';
    if (MODO === 'zero') return a + 'nenhuma outra mudança desde ' + dataLonga(INICIO) + ', fora desta conta.';
    return a + 'mais ' + num(m) + ' ' + A.plural(m, 'outra mudança', 'outras mudanças') + ' no mesmo período, fora desta conta.';
  }
  function contas(){
    var n = trocas(), m = filtrados(false).length, med = medidos();
    var mx = Math.max(n, MODO === 'dado' ? m : 0, 1);
    var pt = Math.max(3, Math.round(n / mx * 100)), po = Math.max(3, Math.round(m / mx * 100));
    var trLinha = MODO === 'vazio'
      ? '<div class="om-conta"><div class="om-cl"><b>' + IC.troca + 'Trocas</b><span>título e miniatura · 30 dias</span></div><span class="om-trk nx" aria-hidden="true"></span><div class="om-cv"><span class="om-nx">sem canais</span></div></div>'
      : '<div class="om-conta"><div class="om-cl"><b>' + IC.troca + 'Trocas</b><span>título e miniatura · 30 dias</span></div><span class="om-trk" aria-hidden="true"><i class="f" style="width:' + pt + '%"></i></span><div class="om-cv num">' + A.n(n) + '</div></div>';
    var sub = 'tags, categoria, duração, capítulos e formato', trk, val;
    if (MODO === 'dado') { trk = '<i class="f ring" style="width:' + po + '%"></i>'; val = '<div class="om-cv num">' + A.n(m) + '</div>'; sub = med < ST.janela ? 'histórico de ' + med + ' dos ' + ST.janela + ' dias' : 'histórico dos ' + ST.janela + ' dias'; }
    var cls = '';
    if (MODO === 'zero') { cls = ' zr'; trk = ''; val = '<div class="om-cv">' + zero(0) + '</div>'; sub = 'nenhuma desde ' + dataLonga(INICIO); }
    if (MODO === 'nm') { cls = ' nm'; trk = ''; val = '<div class="om-cv">' + A.nm('não medido') + '</div>'; sub = 'passa a guardar em ' + dataLonga(INICIO); }
    if (MODO === 'erro') { cls = ' er'; trk = ''; val = '<div class="om-cv"><span class="om-er">' + L.IC.aviso + 'não carregou</span></div>'; sub = 'só esta conta falhou'; }
    if (MODO === 'carregando') { cls = ' sk'; trk = ''; val = '<div class="om-cv num" aria-hidden="true">…</div>'; sub = 'carregando'; }
    if (MODO === 'vazio') { cls = ' nx'; trk = ''; val = '<div class="om-cv"><span class="om-nx">sem canais</span></div>'; sub = 'tags, categoria, duração, capítulos e formato'; }
    var ouLinha = '<div class="om-conta"><div class="om-cl"><b>' + IC.tags + 'Outras mudanças</b><span>' + sub + '</span></div><span class="om-trk' + cls + '" aria-hidden="true">' + (trk || '') + '</span>' + val + '</div>';
    return '<div class="om-contas">' + trLinha + '<div class="om-sep" aria-hidden="true"><span>a conta da aba acaba aqui</span></div>' + ouLinha + '</div>';
  }
  function topo(){
    var visao = '<div class="om-vis" role="group" aria-label="O que mostrar abaixo">' +
      '<button type="button" data-ver="trocas" aria-pressed="' + (ST.ver === 'trocas') + '">' + IC.troca + 'Trocas</button>' +
      '<button type="button" data-ver="outras" aria-pressed="' + (ST.ver === 'outras') + '">' + IC.tags + 'Outras mudanças</button></div>';
    var f = noTopo(fraseGlobal), c = noTopo(contas);
    return L.novo('<div class="om-topo"><p class="om-fr"><span id="om-fr-t">' + f + '</span>' + A.ibtn('iResumo', 'Por que as outras mudanças ficam fora da conta de Trocas') + '</p>' + c + visao +
      '<p class="om-ex"><span class="ex">exemplo</span><span>canais, vídeos e números inventados</span></p></div>', 'novo', 'om-wrap');
  }

  /* ---------------------------------------------------------------- a régua de cobertura (o desenho central) */
  function regua(){
    var nj = ST.janela, med = medidos(), hach = nj - med, rs = filtrados(true), porDia = {}, ini = janelaIni(), i, cols = '';
    rs.forEach(function(r){ porDia[r.d] = (porDia[r.d] || 0) + 1; });
    var diasCom = 0, total = rs.length;
    for (i = hach; i < nj; i++) {
      var c = porDia[A.addDias(ini, i)] || 0;
      if (c) diasCom++;
      cols += c ? '<i class="d" style="height:' + (10 + Math.min(c, 6) * 5) + 'px"></i>' : '<i class="d z"></i>';
    }
    var rotulo = 'Régua de ' + nj + ' dias, de ' + A.dm(ini) + ' a ' + A.dm(HOJE) + ': ' + (hach ? hach + ' ' + A.plural(hach, 'dia sem histórico (não medido)', 'dias sem histórico (não medidos)') + ', ' : '') + (med ? med + ' ' + A.plural(med, 'dia com histórico', 'dias com histórico') + '; ' : '') + (total ? total + ' ' + A.plural(total, 'mudança', 'mudanças') + ' em ' + diasCom + ' ' + A.plural(diasCom, 'dia', 'dias') : 'nenhuma mudança') + '.';
    var leg = '<ul class="om-leg">' + (hach ? '<li><span class="om-sw nm-h" aria-hidden="true"></span>' + (INICIO > HOJE ? 'sem histórico: começa em ' + A.dm(INICIO) : 'sem histórico até ' + A.dm(A.addDias(INICIO, -1))) + ' (não medido)</li>' : '') +
      (med ? '<li><span class="om-sw dz" aria-hidden="true"></span>dia sem mudança</li><li><span class="om-sw dd" aria-hidden="true"></span>dia com mudanças</li>' : '') + '</ul>';
    var dentro = med
      ? (hach ? '<div class="om-hach" style="flex:' + hach + '"></div>' : '') + '<div class="om-dias" style="flex:' + med + '">' + cols + '</div>'
      : '<div class="om-hach" style="flex:1"></div>';
    var eixo = '<div class="om-eixo" aria-hidden="true"><span class="num">' + A.dm(ini) + '</span><span class="num">hoje ' + A.dm(HOJE) + '</span></div>';
    return '<div class="om-regc"><div class="om-reg" role="img" aria-label="' + esc(rotulo) + '">' + dentro + '</div>' + eixo + leg + '</div>';
  }

  /* ---------------------------------------------------------------- filtro de tipo = contagem por tipo */
  function tipos(){
    var base = DADOS.R.filter(function(r){ return naJanela(r) && (ST.fmt === 'todos' || vid(r).fmt === (ST.fmt === 'longos' ? 'long' : 'short')); });
    var nm = MODO === 'nm', cont = {}; TIPOS.forEach(function(t){ cont[t[0]] = 0; }); base.forEach(function(r){ cont[r.k]++; });
    function celula(k, rot, n, ic){
      var conteudo = nm ? A.nmSw() : n === 0 ? zero(0) : '<b class="num">' + A.n(n) + '</b>';
      return '<button type="button" class="om-tb" data-tipo="' + k + '" aria-pressed="' + (ST.tipo === k) + '"' + (nm ? ' disabled' : '') + '><span class="om-tl"><span class="om-mk">' + ic + '</span>' + rot + '</span>' + conteudo + '</button>';
    }
    return '<div class="om-tipos" role="group" aria-label="Tipo de mudança">' + celula('todos', 'Todas', base.length, IC.todos) + TIPOS.map(function(t){ return celula(t[0], t[1], cont[t[0]], IC[t[0]]); }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------- uma linha de mudança */
  function chips(r){
    var todos = r.add.map(function(t){ return '<li class="om-ch add"><span class="sr">acrescentada: </span>+ ' + esc(t) + '</li>'; }).concat(r.del.map(function(t){ return '<li class="om-ch del"><span class="sr">retirada: </span>− ' + esc(t) + '</li>'; }));
    var vis = todos.slice(0, 6), resto = todos.slice(6);
    return '<ul class="om-chips">' + vis.join('') + '</ul>' + (resto.length ? '<details class="om-det"><summary>mais ' + pl(resto.length, 'tag', 'tags') + '</summary><ul class="om-chips">' + resto.join('') + '</ul></details>' : '');
  }
  function corpoLinha(r){
    if (r.k === 'tags') {
      var d = r.depois - r.antes, sinal = d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : '±0';
      return '<p class="om-n"><span class="num">' + r.antes + '</span>' + IC.seta + '<span class="num">' + r.depois + '</span> tags <span class="om-dl num">' + sinal + '</span></p>' + chips(r);
    }
    if (r.k === 'categoria') return '<p class="om-n"><span class="om-ch">' + esc(r.de) + '</span>' + IC.seta + '<span class="om-ch add">' + esc(r.para) + '</span></p>';
    if (r.k === 'formato') return '<p class="om-n"><span class="om-ch">' + (r.de === 'Longo' ? IC.longo : IC.short) + esc(r.de) + '</span>' + IC.seta + '<span class="om-ch add">' + (r.para === 'Longo' ? IC.longo : IC.short) + esc(r.para) + '</span></p>';
    if (r.k === 'duracao') {
      var mx = Math.max(r.antes, r.depois), dl = r.depois - r.antes, ds = (dl > 0 ? '+' : '−') + A.dur(Math.abs(dl));
      return '<div class="om-dur"><span class="om-dt">antes</span><span class="om-bar" aria-hidden="true"><i style="width:' + Math.round(r.antes / mx * 100) + '%"></i></span><span class="num">' + A.dur(r.antes) + '</span>' +
        '<span class="om-dt">depois</span><span class="om-bar" aria-hidden="true"><i class="ap" style="width:' + Math.round(r.depois / mx * 100) + '%"></i></span><span class="num">' + A.dur(r.depois) + ' <span class="om-dl">' + ds + '</span></span></div>';
    }
    /* capítulos: régua com as marcas */
    var tk = function(ms, cls){ return '<span class="om-rg ' + cls + '" aria-hidden="true">' + ms.map(function(x){ return '<i style="left:' + (x * 100).toFixed(1) + '%"></i>'; }).join('') + '</span>'; };
    var antesMarcas = []; for (var j = 0; j < r.antes; j++) antesMarcas.push(r.marcas[j] != null ? r.marcas[j] : j / Math.max(r.antes, 1));
    return '<p class="om-n"><span class="num">' + r.antes + '</span>' + IC.seta + '<span class="num">' + r.depois + '</span> ' + A.plural(r.depois, 'capítulo', 'capítulos') + '</p><div class="om-dur"><span class="om-dt">antes</span>' + (r.antes ? tk(antesMarcas, 'b') : '<span class="om-rg vz" aria-hidden="true"></span>') + '<span class="om-dt">' + (r.antes ? r.antes + (r.antes === 1 ? ' marca' : ' marcas') : 'nenhum') + '</span><span class="om-dt">depois</span>' + tk(r.marcas, 'a') + '<span class="om-dt">' + r.depois + ' ' + A.plural(r.depois, 'marca', 'marcas') + '</span></div>';
  }
  function linha(r){
    return '<li class="om-l"><div class="om-tp"><span class="om-mk">' + IC[r.k] + '</span><b>' + nomeDeTipo(r.k) + '</b></div><div class="om-df">' + corpoLinha(r) + '</div><div class="om-wh"><b class="num">' + A.ds(r.d) + '</b><span>' + SLOT[r.s] + '</span></div></li>';
  }
  function cartao(g){
    var n = g.rs.length, vis = g.rs.slice(0, 3), resto = g.rs.slice(3);
    return '<article class="om-card"><header class="om-vh"><span class="om-th" style="background:' + L.cor(g.v.t) + '" aria-hidden="true"></span><div class="om-vt"><h3>' + esc(g.v.t) + '</h3><p><span>' + esc(g.v.c) + '</span><span class="om-fm">' + (g.v.fmt === 'long' ? IC.longo + 'Longo' : IC.short + 'Short') + '</span><span>' + pl(n, 'mudança', 'mudanças') + ' no período</span></p></div><a class="om-hl" href="#" onclick="return false">Ver histórico do vídeo</a></header>' +
      '<ul class="om-ls">' + vis.map(linha).join('') + '</ul>' + (resto.length ? '<details class="om-det om-detv"><summary>mais ' + pl(resto.length, 'mudança', 'mudanças') + ' deste vídeo</summary><ul class="om-ls">' + resto.map(linha).join('') + '</ul></details>' : '') + '</article>';
  }

  /* ---------------------------------------------------------------- o bloco da visão "Outras mudanças" */
  function barraFiltros(){
    var ro = caso === 'leitura';
    return '<div class="om-tbar" role="search" aria-label="Filtrar outras mudanças">' +
      seg('Mudança feita nos últimos', 'om-lJ', [[7, '7 d'], [30, '30 d'], [90, '90 d']].map(function(x){ return [x[0], x[1]]; }), ST.janela, 'data-jan') +
      seg('Formato do vídeo', 'om-lF', [['todos', 'Todos'], ['longos', 'Longos'], ['shorts', 'Shorts']], ST.fmt, 'data-fmt') +
      '<div class="om-fld"><label class="om-lb" for="om-ord">Ordenar</label><select class="om-sel" id="om-ord"><option value="recentes"' + (ST.ord === 'recentes' ? ' selected' : '') + '>Mais recentes</option><option value="muitas"' + (ST.ord === 'muitas' ? ' selected' : '') + '>Mais mudanças primeiro</option></select></div>' +
      (ro ? '<span class="om-ro-p">' + IC.lock + 'Só leitura' + A.ibtn('iLeitura', 'O que muda para quem só lê', true) + '</span>' : '') + '</div>';
  }
  function fraseBloco(){
    var rs = filtrados(true), med = medidos(), de = INICIO > janelaIni() ? INICIO : janelaIni(), nv = {}, fmt = ST.tipo !== 'todos' ? nomeDeTipo(ST.tipo).toLowerCase() : '';
    rs.forEach(function(r){ nv[r.v] = 1; });
    var janelaTxt = med < ST.janela ? 'nos ' + num(med) + ' ' + A.plural(med, 'dia', 'dias') + ' com histórico (' + A.dm(de) + ' a ' + A.dm(HOJE) + ')' : 'nos ' + num(ST.janela) + ' dias da janela (' + A.dm(janelaIni()) + ' a ' + A.dm(HOJE) + ')';
    if (MODO === 'nm') return 'O histórico dessas mudanças começa em <b class="num">' + dataLonga(INICIO) + '</b>. Até lá, nada aqui é medido.';
    if (MODO === 'zero') return 'Nenhuma outra mudança ' + janelaTxt + '.';
    if (!rs.length) {
      var outras = filtrados(false).length;
      return 'Nenhuma mudança de ' + (fmt || 'nenhum tipo') + ' ' + janelaTxt + (outras ? '; as outras ' + num(outras) + ' são de outros tipos.' : '.');
    }
    var nvv = Object.keys(nv).length;
    return num(rs.length) + ' ' + A.plural(rs.length, 'mudança', 'mudanças') + (fmt ? ' de ' + fmt : '') + ' em ' + num(nvv) + ' ' + A.plural(nvv, 'vídeo', 'vídeos') + ', ' + janelaTxt + '.';
  }
  function esqueleto(){
    var l = '<div class="om-sk-l"><i class="om-sk-m"></i><span class="om-sk-b" style="width:34%"></span><span class="om-sk-b" style="width:18%"></span></div>';
    return '<div class="om-sk" role="status" aria-live="polite"><p class="om-sk-t">Carregando as outras mudanças. As trocas de título e miniatura já estão acima.</p>' + [1, 2].map(function(){ return '<div class="om-card sk" aria-hidden="true"><header class="om-vh"><span class="om-th sk"></span><div class="om-vt"><span class="om-sk-b" style="width:58%;height:16px"></span><span class="om-sk-b" style="width:30%"></span></div></header>' + l + l + '</div>'; }).join('') + '</div>';
  }
  function bloco(){
    var cab = barraFiltros();
    if (MODO === 'vazio') return L.novo('<div class="om-bl"><div class="om-vz" role="status"><h3>Nenhum canal no nicho IA</h3><p>Sem canal acompanhado não há mudança para ler.</p><div class="om-bt"><span class="btn big">Adicionar canal</span><span class="btn big">Ver todos os nichos</span></div></div></div>', 'novo', 'om-wrap om-wrapb');
    var fr = MODO === 'erro' || MODO === 'carregando' ? '' : '<p class="om-fb"><span id="om-fb-t">' + fraseBloco() + '</span>' + A.ibtn('iReg', 'Como ler a régua de dias') + '</p>';
    var corpo;
    if (MODO === 'erro') {
      corpo = '<div class="om-erro" role="alert">' + L.IC.aviso + '<div><h3>As outras mudanças não carregaram</h3><p>As trocas de título e miniatura não foram afetadas, e o número da aba continua certo. Tente de novo; se repetir, o problema é do Observatório, não dos canais.</p></div><button type="button" class="btn big" data-acao="tentar">Tentar de novo</button></div>';
      return L.novo('<div class="om-bl">' + cab + fr + corpo + '</div>', 'novo', 'om-wrap om-wrapb');
    }
    if (MODO === 'carregando') return L.novo('<div class="om-bl" aria-busy="true">' + cab + fr + esqueleto() + '</div>', 'novo', 'om-wrap om-wrapb');
    var gs = MODO === 'nm' ? [] : grupos(), mostra = gs.slice(0, 10 * ST.mais), lista;
    if (MODO === 'nm') {
      lista = '<div class="om-vz nmv" role="status"><div class="om-nmh"><span class="om-sw nm-h big" aria-hidden="true"></span>' + A.nm('não medido') + '</div><h3>Ainda não há histórico de tags, categoria, duração, capítulos nem formato</h3><p>O Observatório passa a guardar estes campos em ' + dataLonga(INICIO) + ' (exemplo). Não é zero: ainda não dá para saber se algo mudou.</p></div>';
    } else if (MODO === 'zero') {
      lista = '<div class="om-vz zr" role="status"><div class="om-nmh">' + zero(0) + '</div><h3>Nenhuma outra mudança desde ' + dataLonga(INICIO) + '</h3><p>O histórico já existe e nada mudou. Isso é resultado: os canais não mexeram em tags, categoria, duração, capítulos nem formato nesse período.</p></div>';
    } else if (!gs.length) {
      lista = '<div class="om-vz zr" role="status"><div class="om-nmh">' + zero(0) + '</div><h3>Nenhuma mudança de ' + nomeDeTipo(ST.tipo).toLowerCase() + ' desde ' + dataLonga(INICIO) + '</h3><p>Com o filtro de agora não há o que listar. As outras mudanças estão em outros tipos.</p><div class="om-bt"><button type="button" class="btn big" data-tipo="todos">Ver todas as mudanças</button></div></div>';
    } else {
      lista = '<div class="om-feed">' + mostra.map(cartao).join('') + '</div><div class="om-pg"><span aria-live="polite">Mostrando ' + mostra.length + ' de ' + pl(gs.length, 'vídeo', 'vídeos') + '</span>' + (mostra.length < gs.length ? '<button type="button" class="btn big" data-acao="mais">Mostrar mais ' + Math.min(10, gs.length - mostra.length) + '</button>' : '') + '</div>';
    }
    var quando = gs.length ? '<p class="om-q">Horários em São Paulo' + A.ibtn('iQuando', 'O que significa "entre 12h e 18h"', true) + '</p>' : '';
    return L.novo('<div class="om-bl">' + cab + fr + regua() + tipos() + quando + lista + '</div>', 'novo', 'om-wrap om-wrapb');
  }

  /* ---------------------------------------------------------------- a visão "Trocas": o que já existe, sem mexer */
  function trocasStub(){
    return '<div class="om-stub-bl"><p class="om-stub"><span class="om-stub-t">Como hoje, sem mudança</span><span>Filtros (janela, formato, tipo, ordenar), cartões antes → depois com o efeito medido.</span></p>' +
      '<div class="om-fantasma" aria-hidden="true"><span class="om-th sk"></span><div><i style="width:46%"></i><i style="width:70%"></i><i style="width:30%"></i></div></div><div class="om-fantasma" aria-hidden="true"><span class="om-th sk"></span><div><i style="width:52%"></i><i style="width:62%"></i><i style="width:26%"></i></div></div></div>';
  }

  /* ---------------------------------------------------------------- páginas, popovers e a casca */
  function popovers(){
    var ini = dataLonga(INICIO);
    return A.oculto('iResumo', 'Por que as outras mudanças ficam fora da conta de Trocas',
        '<ul><li><b>Trocas:</b> título e miniatura. É a conta da aba, da lista de canais e da comparação, e a única com efeito medido (as views antes e depois da troca).</li>' +
        '<li><b>Outras mudanças:</b> tags, categoria, duração, capítulos e formato. Não têm efeito medido e acontecem por motivos diferentes (corrigir um erro não é testar uma ideia). Somar tudo inflaria o número da aba.</li>' +
        '<li><b>Descrição:</b> tem lugar à parte e fica fora das duas contas. Com esta tela, a aba passa a contar só título e miniatura (hoje ela soma a descrição junto: o dono decide).</li>' +
        '<li><b>Janela:</b> a conta de cima é sempre dos últimos 30 dias, como a aba. A janela escolhida abaixo vale só para a lista.</li>' +
        '<li><b>Contagem:</b> cada mudança registrada nos últimos 30 dias, uma por campo e por sincronização. Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>') +
      A.oculto('iReg', 'Como ler a régua de dias',
        '<ul><li><b>Hachura rosa (não medido):</b> o Observatório ainda não guardava estes campos nesses dias. Não dá para saber se algo mudou; por isso não é zero.</li>' +
        '<li><b>Traço baixo:</b> dia com histórico e sem nenhuma mudança (zero medido).</li>' +
        '<li><b>Coluna:</b> dia com mudanças; quanto mais mudanças, mais alta (a altura para em 6).</li>' +
        '<li><b>Começo do histórico:</b> ' + ini + ' (data de exemplo): o dia em que o Observatório passou a guardar estes campos. Antes dele nada pode ser contado.</li>' +
        '<li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>') +
      A.oculto('iQuando', 'O que significa "entre 12h e 18h"',
        '<p>O Observatório confere os vídeos a cada 6 horas. Cada mudança mostra a janela entre duas conferências, não o minuto exato. Horários de São Paulo.</p>') +
      A.oculto('iLeitura', 'O que muda para quem só lê',
        '<ul><li>Nada desta lista é privado: são dados públicos dos canais que você acompanha.</li><li>Quem só lê vê o mesmo que quem edita. Só ficam desligados os botões de sincronizar e de adicionar canal.</li></ul>');
  }
  function obsHtml(){
    var h = L.obs({ aba: 'Mudanças', nCanais: MODO === 'vazio' ? 0 : null });
    h = h.replace('Mudanças<span class="c2-ct">12</span>', 'Mudanças<span class="c2-ct">' + (MODO === 'vazio' ? '—' : TR[CFG.tr][30]) + '</span>');
    if (MODO === 'vazio') h = h.replace('Outliers<span class="c2-ct">9</span>', 'Outliers<span class="c2-ct">—</span>');
    if (MODO === 'vazio') h = h.replace('<span aria-pressed="true">Todos', '<span>Todos').replace('<span><i class="c2-sw a"></i>IA', '<span aria-pressed="true"><i class="c2-sw a"></i>IA');
    if (caso === 'leitura') h = h.replace('<div class="c2-obs"', '<div class="c2-obs om-ro"');
    return h;
  }
  function stubLedger(){ return '<p class="om-ledger" aria-hidden="true"><span>Resumo da semana e leitura da forja: como hoje, sem mudança</span></p>'; }

  function desenhar(){
    MODO = modo();
    document.querySelectorAll('body > .pop').forEach(function(p){ p.remove(); });
    var scr = document.getElementById('screen');
    scr.innerHTML = '<div data-obs-screen="mudancas" class="om-tela">' + obsHtml() + stubLedger() + topo() + (ST.ver === 'trocas' ? trocasStub() : bloco()) + popovers() + '</div>';
    A.ligarInfos(scr);
    /* ligações */
    scr.querySelectorAll('[data-ver]').forEach(function(b){ b.addEventListener('click', function(){ ST.ver = b.getAttribute('data-ver'); desenhar(); foco('[data-ver="' + ST.ver + '"]'); }); });
    scr.querySelectorAll('[data-jan]').forEach(function(b){ b.addEventListener('click', function(){ ST.janela = Number(b.getAttribute('data-jan')); ST.mais = 1; desenhar(); foco('[data-jan="' + ST.janela + '"]'); }); });
    scr.querySelectorAll('[data-fmt]').forEach(function(b){ b.addEventListener('click', function(){ ST.fmt = b.getAttribute('data-fmt'); ST.mais = 1; desenhar(); foco('[data-fmt="' + ST.fmt + '"]'); }); });
    scr.querySelectorAll('.om-tb,[data-tipo]').forEach(function(b){ b.addEventListener('click', function(){ ST.tipo = b.getAttribute('data-tipo'); ST.mais = 1; desenhar(); foco('.om-tb[data-tipo="' + ST.tipo + '"]'); }); });
    var o = scr.querySelector('#om-ord'); if (o) o.addEventListener('change', function(){ ST.ord = o.value; ST.mais = 1; desenhar(); foco('#om-ord'); });
    scr.querySelectorAll('[data-acao="mais"]').forEach(function(b){ b.addEventListener('click', function(){ ST.mais++; desenhar(); }); });
    scr.querySelectorAll('[data-acao="tentar"]').forEach(function(b){ b.addEventListener('click', function(){ ST.falhou = false; caso = 'tipico'; desenhar(); foco('[data-ver="outras"]'); }); });
  }
  function foco(sel){ var e = document.querySelector(sel); if (e) e.focus(); }

  /* ---------------------------------------------------------------- referência fora da tela */
  function fora(){
    var c = { tags: 0, categoria: 0, duracao: 0, capitulos: 0, formato: 0 };
    var t5 = dadosTip(); t5.R.forEach(function(r){ c[r.k]++; });
    var tab = function(cab, linhas){ return '<table class="om-ft"><thead><tr>' + cab.map(function(x){ return '<th scope="col">' + x + '</th>'; }).join('') + '</tr></thead><tbody>' + linhas.map(function(l){ return '<tr>' + l.map(function(x, i){ return i === 0 ? '<th scope="row">' + x + '</th>' : '<td>' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; };
    return L.fora('A conta, caso típico (exemplo)', tab(['Onde', 'Número', 'Entra?'], [
      ['Aba "Mudanças"', '12', 'hoje conta título, miniatura e descrição; com esta tela passaria a título e miniatura (dúvida 1: o dono decide)'],
      ['Conta "Trocas" da visão', '12', 'a mesma, igual à da aba'],
      ['Outras mudanças', '5 = ' + c.tags + ' tags + ' + c.categoria + ' categoria + ' + c.duracao + ' duração + ' + c.capitulos + ' capítulos + ' + c.formato + ' formato', 'fora da aba e da conta Trocas'],
      ['Soma 12 + 5 = 17', 'não aparece em lugar nenhum', 'é isso que o pedido proíbe']])) +
      L.fora('Forma por tipo (sem matiz novo)', tab(['Tipo', 'Símbolo', 'Como o antes e o depois aparece'], [
        ['Tags', IC.tags, '+ e − com contorno cheio e tracejado (riscado), e "12 → 14 tags"'],
        ['Categoria', IC.categoria, 'as duas categorias lado a lado'],
        ['Duração', IC.duracao, 'duas barras proporcionais e o sinal da diferença'],
        ['Capítulos', IC.capitulos, 'régua com as marcas antes e depois'],
        ['Formato', IC.formato, 'Longo → Short, com o retângulo largo ou estreito']]));
  }

  A.moldura({
    titulo: 'Mudanças: outras mudanças',
    barra: L.barra([
      { rotulo: 'Estado', param: 'caso', padrao: 'tipico', extra: { tipo: null, ver: null, janela: null, fmt: null, ord: null }, itens: [
        ['trocas', 'Visão Trocas (como hoje)'], ['tipico', 'Com dado típico'], ['magro', 'Magro (poucos dias)'], ['extremo', 'Com dado extremo'], ['zero', 'Zero medido'], ['nao-medido', 'Não medido'],
        ['filtro-zero', 'Filtro sem resultado'], ['erro', 'Erro'], ['carregando', 'Carregando'], ['vazio', 'Sem dado (nicho sem canal)'], ['leitura', 'Só leitura']] }
    ], 'Mockup 16b. Em cada estado a janela, o formato, a ordem, o tipo e a visão respondem ao clique. Tudo é exemplo.'),
    corpo: '',
    fora: fora()
  });
  desenhar();
})();
