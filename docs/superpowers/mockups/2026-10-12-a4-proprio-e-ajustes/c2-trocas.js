/* c2-trocas.js: a troca de descrição como ACRÉSCIMO à Lista de Canais e ao painel do canal que já existem (reenquadrado em 12/10 depois de o dono não entender "como se chega nessa página").
   A tela é a de produção (colunas de apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-table.tsx; painel de channel-drawer.tsx): o que já existe aparece normal, o que esta proposta acrescenta leva contorno tracejado e a marca "+ novo".
   Números e nomes de canais: exemplo (o acréscimo usa os mesmos de antes). Parâmetros: ?canal=nomade|lucas|dale|vou|leo|paddy|proprio escolhe o canal aberto no painel; ?novo=0 tira as marcas de "novo"; ?painel=1|0 abre ou fecha o painel (padrão: aberto a partir de 1280 px, fechado abaixo, onde o painel é diálogo modal); ?tema=claro. */
(function(){
  'use strict';
  var A = window.A4, esc = A.esc, q = A.q, atual = q.get('canal') || 'nomade', semNovo = q.get('novo') === '0',
      wide = window.matchMedia('(min-width:1280px)').matches, pp = q.get('painel'), aberto = pp === '1' ? true : pp === '0' ? false : wide;
  /* o contexto de cada canal (colunas que já existem): pos, nicho, inscritos, ritmo das 13 semanas, views/dia, n, outlier, crescimento, sincronização; ev = o que o painel mostra. */
  var CH = [
    { id: 'nomade', nome: 'Nômade Raiz', ins: 2080000, tt: 6, vt: 4, last: 'título trocado, visto pela 1ª vez há 2 d', desc: { n: 3, v: 2, sem: [1, 1, 0, 1] },
      rit: [2, 2, 1, 2, 3, 2, 2, 1, 2, 2, 3, 2, 2], pw: '2,3', vpd: '2,18 mil', vn: 14, out: '3,4×', outn: '2 vídeos', cr: '+1,8%', crs: 'em 30 d', sy: 'há 3 h', eng: '3,9%', ev: [
      { t: 'multi', q: 'há 2 d', v: 'Tailândia em 10 dias: o roteiro completo', vw: '184 mil views', a: 'Tailândia em 10 dias', d: 'Tailândia em 10 dias: o roteiro completo' },
      { t: 'desc', q: 'há 6 d', v: 'Os 5 piores erros em Bangkok', vw: '96 mil views', chip: '+3 linhas, −1 linha' },
      { t: 'titulo', q: 'há 9 d', v: 'Quanto custa viajar pelo Vietnã', vw: '71 mil views', a: 'Vietnã barato?', d: 'Quanto custa viajar pelo Vietnã' },
      { t: 'desc', q: 'há 15 d', v: 'Chiang Mai para nômades digitais', vw: '203 mil views', chip: '+1 linha' },
      { t: 'desc', q: 'há 23 d', v: 'Os 5 piores erros em Bangkok', vw: '96 mil views', semTexto: true }] },
    { id: 'lucas', nome: 'Lucas Bigodinho', ins: 325000, tt: 4, vt: 3, last: 'thumbnail trocada, vista pela 1ª vez há 5 d', desc: null,
      rit: [1, 1, 2, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1], pw: '1,2', vpd: '1,06 mil', vn: 14, out: '2,6×', outn: '1 vídeo', cr: '+0,9%', crs: 'em 30 d', sy: 'há 3 h', eng: '4,4%', ev: [
      { t: 'thumb', q: 'há 5 d', v: 'Comi só no 7-Eleven por 3 dias', vw: '412 mil views' }, { t: 'titulo', q: 'há 12 d', v: 'A pior estrada do Laos', vw: '188 mil views', a: 'Estrada do Laos', d: 'A pior estrada do Laos' }] },
    { id: 'dale', nome: 'Dale Philip', ins: 3740000, tt: 0, vt: 0, last: null, desc: { n: 2, v: 2, sem: [0, 0, 1, 1] },
      rit: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0], pw: '0,6', vpd: '175', vn: 10, out: '1,8×', outn: 'nenhum', cr: '+0,3%', crs: 'em 30 d', sy: 'há 3 h', eng: '2,1%', ev: [
      { t: 'desc', q: 'há 4 d', v: 'Um dia em Osaka', vw: '1,2 mi views', chip: '+2 linhas' }, { t: 'desc', q: 'há 11 d', v: 'Kyoto sem multidão', vw: '860 mil views', chip: '+1 linha, −1 linha' }] },
    { id: 'vou', nome: 'Vou sem volta', ins: 593000, tt: 2, vt: 2, last: 'título trocado, visto pela 1ª vez há 13 d', desc: { n: 1, v: 1, sem: [0, 0, 0, 1] },
      rit: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1], pw: '0,8', vpd: '147', vn: 12, out: '2,2×', outn: '1 vídeo', cr: '−0,4%', crs: 'em 30 d', sy: 'há 3 h', eng: '3,0%', ev: [
      { t: 'desc', q: 'há 3 d', v: 'Meio ano em Bali', vw: '240 mil views', chip: '+1 linha' }, { t: 'titulo', q: 'há 13 d', v: 'Voltei para o Brasil?', vw: '305 mil views', a: 'Voltei?', d: 'Voltei para o Brasil?' }] },
    { id: 'paddy', nome: 'Paddy Doyle', ins: 341000, tt: 3, vt: 3, last: 'título e thumbnail trocados na mesma janela, vistos há 1 d', desc: { n: 5, v: 1, sem: [1, 2, 1, 1] },
      rit: [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1], pw: '0,9', vpd: '118', vn: 13, out: '1,6×', outn: 'nenhum', cr: '+0,6%', crs: 'em 30 d', sy: 'há 3 h', eng: '2,8%', ev: [
      { t: 'desc', q: 'há 1 d', v: 'Irlanda de carro em 7 dias', vw: '58 mil views', chip: '+1 linha' }, { t: 'desc', q: 'há 5 d', v: 'Irlanda de carro em 7 dias', vw: '58 mil views', chip: '+1 linha, −1 linha' }, { t: 'desc', q: 'há 9 d', v: 'Irlanda de carro em 7 dias', vw: '58 mil views', chip: '−1 linha' }] },
    { id: 'leo', nome: 'Leo Khev', ins: 1530, tt: 0, vt: 0, last: null, desc: null,
      rit: [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0], pw: '0,3', vpd: '31', vn: 8, out: '1,4×', outn: 'nenhum', cr: '+1,3%', crs: 'em 30 d', sy: 'há 4 h', eng: '1,9%', ev: [] },
    { id: 'proprio', nome: 'tnFigueiredo', ins: 1160, own: true,
      rit: [0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], pw: '0,4', vpd: '20', vn: 6, out: '1,3×', outn: 'nenhum', cr: '+0,8%', crs: 'em 30 d', sy: 'há 2 h', eng: '2,4%', ev: [] }
  ];
  var por = {}; CH.forEach(function(c){ por[c.id] = c; });
  function sem(c){ return c.desc ? c.desc.sem.filter(Boolean).length : 0; }
  function habito(c){ return sem(c) >= 3 && c.desc.v >= 2; }
  function nTr(n, um, vs){ return n + ' ' + (n === 1 ? um : vs); }
  function pal(n, um, vs){ return n === 1 ? um : vs; }
  /* a marca de "novo": o contorno é do .c2-novo; o rótulo "+ novo" vai em todo bloco, mas na lista só o 1º aparece em tela larga (a classe rep o esconde); em 390 todos aparecem */
  var jaTag = false;
  function tag(texto, lista){ var rep = lista && jaTag; if (lista) jaTag = true; return '<span class="c2-tag' + (rep ? ' rep' : '') + '">+ ' + texto + '</span>'; }

  function marcas(c){
    var lbl = 'Semanas, da mais antiga à mais recente: ' + c.desc.sem.map(function(x){ return x ? (x > 1 ? 'mais de uma troca' : 'com troca') : 'sem troca'; }).join(', ');
    return '<span class="sem" role="img" aria-label="' + esc(lbl) + '">' + c.desc.sem.map(function(x){ return x > 1 ? '<i class="rep">2+</i>' : x ? '<i class="on">1</i>' : '<i></i>'; }).join('') + '</span><span class="sem-ax" aria-hidden="true"><span>antiga</span><span>recente</span></span>';
  }
  function lblSem(c){ return 'Semanas, da mais antiga à mais recente: ' + c.desc.sem.map(function(x){ return x ? (x > 1 ? 'mais de uma troca' : 'com troca') : 'sem troca'; }).join(', '); }
  function marcasCel(c){ return '<span class="sem" role="img" aria-label="' + esc(lblSem(c)) + '" title="' + esc(lblSem(c)) + '">' + c.desc.sem.map(function(x){ return x > 1 ? '<i class="rep">2+</i>' : x ? '<i class="on">1</i>' : '<i></i>'; }).join('') + '</span><span class="c2-4s" aria-hidden="true">4 sem</span>'; }
  function fraseSem(c){ var s = sem(c); return s === 4 ? 'nas 4 últimas semanas' : 'em ' + s + ' das 4 últimas semanas'; }

  /* ---------------------------------------------------------------- as colunas que já existem (contexto) */
  function strip(c){
    var s = '<svg class="c2-strip" width="104" height="26" viewBox="0 0 104 26" role="img" aria-label="Uploads por semana nas últimas 13 semanas">';
    c.rit.forEach(function(n, i){ var x = i * 8; s += n ? '<rect x="' + x + '" y="' + (26 - Math.min(n, 3) * 7) + '" width="5" height="' + Math.min(n, 3) * 7 + '" rx="1" class="b"/>' : '<rect x="' + x + '" y="24" width="5" height="2" class="z"/>'; });
    return s + '</svg>';
  }
  function celRitmo(c){ return '<div class="c2-cad">' + strip(c) + '<span><span class="num c2-big">' + c.pw + '</span> <span class="mut c2-u">longos/sem</span></span></div>'; }
  function celVpd(c){ return '<span class="num c2-big">' + c.vpd + '</span><span class="c2-cap">n = ' + c.vn + '</span>'; }
  function celOut(c){ return '<span class="c2-out"><b class="num ' + (parseFloat(c.out.replace(',', '.')) >= 2 ? 'm' : '') + '">' + c.out + '</b> <span class="c2-cap" style="display:inline">' + c.outn + '</span></span>'; }
  function celCr(c){ var neg = c.cr.charAt(0) === '−'; return '<span class="num c2-big ' + (neg ? 'dn' : 'up') + '">' + (neg ? '▼ ' : '▲ ') + c.cr + '</span><span class="c2-cap">' + c.crs + '</span>'; }
  function celSy(c){ return '<div class="c2-st"><span class="c2-dot" aria-hidden="true"></span>Sincronizado ' + c.sy + '</div>'; }

  /* ---------------------------------------------------------------- a coluna Trocas: o número e a frase de sempre; a linha da descrição é o acréscimo */
  function celula(c){
    if (c.own) return '<span class="mut" style="font-size:12.5px">Suas trocas ficam no A/B Lab.</span>';
    var full = 'Descrição: ' + nTr(c.desc ? c.desc.n : 0, 'troca', 'trocas') + (c.desc ? (c.desc.v === 1 && c.desc.n > 1 ? ' no mesmo vídeo' : ' em ' + nTr(c.desc.v, 'vídeo', 'vídeos')) + ', ' + fraseSem(c) : '');
    var d = c.desc ? '<div class="c2-dc c2-novo" title="' + esc(full) + '">' + tag('novo', true) + '<div class="d">Descrição: ' + c.desc.n + (c.desc.v === 1 && c.desc.n > 1 ? ' no mesmo vídeo' : ' em ' + nTr(c.desc.v, 'vídeo', 'vídeos')) + '</div><div class="l2">' + marcasCel(c) + '</div>' + (habito(c) ? '<span class="habito">costuma trocar</span>' : '') + '</div>' : '';
    return '<div class="cel"><div class="k">' + c.tt + '</div><div class="l">' + (c.tt ? esc(c.last) : 'nenhuma de título ou thumbnail em 30 d') + '</div>' + d + '</div>';
  }

  /* ---------------------------------------------------------------- o painel: cabeçalho, abas e rodapé são os de hoje; o resumo e as trocas de descrição são o acréscimo */
  function resumo(c){
    if (c.own) return '<p class="c2-sech">Suas trocas de título e thumbnail ficam no A/B Lab.</p>';
    if (!c.tt && !c.desc) return '<div class="resumo c2-novo">' + tag('novo') + '<p style="margin:0">Nenhuma troca de título, thumbnail ou descrição nos últimos 30 dias.</p></div>';
    var l1 = '<div class="ln"><b class="num">' + c.tt + '</b><span>' + (c.tt ? pal(c.tt, 'troca', 'trocas') + ' de título ou thumbnail, em ' + nTr(c.vt, 'vídeo', 'vídeos') + '. <span class="rot">É o número da lista.</span>' : 'trocas de título ou thumbnail.') + '</span></div>';
    var l2 = c.desc ? '<div class="ln"><b class="num">' + c.desc.n + '</b><span>' + pal(c.desc.n, 'troca', 'trocas') + ' de descrição' + (c.desc.v === 1 && c.desc.n > 1 ? ', todas no mesmo vídeo' : ', em ' + nTr(c.desc.v, 'vídeo', 'vídeos')) + ', ' + fraseSem(c) + '. ' + (habito(c) ? '<span class="habito">costuma trocar</span>' : '') + '<br>' + marcas(c) + '</span></div>' : '';
    return '<div class="resumo c2-novo">' + tag('novo') + l1 + l2 + (c.desc ? '<p class="sem-leg" style="margin:0"><span><i class="n0"></i>semana sem troca</span><span><i class="n1">1</i>uma troca</span><span><i class="n2">2+</i>mais de uma</span></p>' : '') + '<p class="c2-sech" style="margin:0">As trocas de descrição têm um filete violeta à esquerda e não entram no número da lista.</p></div>';
  }
  function cartao(e){
    var rot = { multi: ['Título e thumbnail trocados', ''], titulo: ['Título trocado', ''], thumb: ['Thumbnail trocada', ''], desc: ['Descrição trocada', 'desc'] }[e.t];
    var corpo = '';
    if (e.t === 'desc') corpo = e.semTexto ? '<p class="mut" style="margin:8px 0 0;font-size:12.5px">A descrição mudou. Antes de 03/10 só registramos que mudou, sem o texto.</p>' : '<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="chip num">' + esc(e.chip) + '</span><span class="btn">Ver comparação</span></div>';
    else if (e.t === 'thumb') corpo = '<div class="ba"><div><div class="lab">Antes</div>capa anterior</div><div><div class="lab">Depois</div>capa atual</div></div>';
    else corpo = '<div class="ba"><div><div class="lab">Antes</div>' + esc(e.a) + '</div><div><div class="lab">Depois</div>' + esc(e.d) + '</div></div>';
    var novo = e.t === 'desc';
    return '<div class="swapcard' + (novo ? ' desc c2-novo' : '') + '">' + (novo ? tag('novo') : '') + '<div class="when"><span><strong>' + rot[0] + '</strong>, visto pela 1ª vez ' + e.q + '</span><span>' + esc(e.vw) + '</span></div><div class="vt">' + esc(e.v) + '</div>' + corpo + '</div>';
  }
  var INTRO = 'Contadas por evento. Desde 03/10 a sincronização roda a cada 6 h (antes, diária às 09:00): título e descrição têm a janela entre duas sincronizações; thumbnail tem o minuto.';
  function stats(c){
    var cel = function(l, v, s){ return '<div><div class="l">' + l + '</div><div class="v num">' + v + '</div><div class="l">' + s + '</div></div>'; };
    return '<div class="c2-dst">' + cel('Ritmo, 13 sem', c.pw.replace(/^(\S+)$/, '$1 + 0,2'), 'longos + Shorts por semana') + cel('Views/dia, longos', c.vpd, 'mediana, n = ' + c.vn + ', 7 dias') + cel('Crescimento, 30 d', c.cr.replace('-', '−'), 'inscritos em 30 dias') + cel('Engajamento, longos', c.eng, 'mediana, n = ' + c.vn + ', 90 dias') + cel('Sincronização', 'Sincronizado ' + c.sy, 'a cada 6 h') + '</div>';
  }
  function painel(c){
    var tem = c.ev && c.ev.length, ini = c.nome.slice(0, 2);
    return '<aside class="c2-drawer" aria-label="Painel de ' + esc(c.nome) + '">' +
      '<div class="c2-dhead"><div class="c2-row1"><span class="c2-av" aria-hidden="true">' + esc(ini) + '</span><div style="min-width:0"><h3>' + esc(c.nome) + '</h3><div class="c2-meta">' + (c.own ? '<span class="chip own">seu canal</span>' : '') + '<span class="c2-nicho">Viagem</span><span class="num">' + A.mil(c.ins) + '</span><span>inscritos</span></div></div><a class="c2-x" href="' + A.href({ painel: '0' }) + '" aria-label="Fechar o painel">' + A.X + '</a></div>' + stats(c) + '</div>' +
      '<div class="ctabs c2-tabs"><ul><li><a href="#" aria-current="page">Trocas <span class="n">' + (c.tt != null ? c.tt : 0) + '</span></a></li><li><a href="#">Outliers <span class="n">' + (c.own || c.outn === 'nenhum' ? 0 : parseInt(c.outn, 10)) + '</span></a></li><li><a href="#">Vídeos</a></li></ul></div>' +
      '<div class="c2-dbody"><p class="c2-sec">Trocas nos últimos 30 dias</p><p class="c2-sech">' + INTRO + '</p>' +
      resumo(c) + (tem ? c.ev.map(cartao).join('') + '<span class="btn">Ver as trocas em Mudanças</span>' : '') + '</div>' +
      '<div class="c2-dfoot"><span class="c2-trash" aria-hidden="true"><svg class="i" viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5"/></svg></span><span class="btn">Abrir no YouTube</span></div></aside>';
  }

  /* ---------------------------------------------------------------- o cabeçalho do Observatório (ObservatoryChrome: observatory-chrome.tsx, chrome.css, view-model.ts), estático */
  var IC = {
    sync: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.6-4.5M4 13a8 8 0 0 0 14.6 4.5"/><path d="M4 4v4h4M20 20v-4h-4"/></svg>',
    plus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    dots: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
    chev: '<svg class="i c2-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    pin: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>'
  };
  function chrome(){
    var tabs = [['Canais', 7, true], ['Mudanças', 12, false], ['Outliers', 9, false], ['Insights', null, false]].map(function(t){ return '<span class="c2-otab"' + (t[2] ? ' aria-current="page"' : '') + '>' + t[0] + (t[1] != null ? '<span class="c2-ct">' + t[1] + '</span>' : '') + '</span>'; }).join('');
    var nichos = [['Todos', 7, '', true], ['Viagem', 7, 'v', false], ['IA', 0, 'a', false]].map(function(n){ return '<span' + (n[3] ? ' aria-pressed="true"' : '') + '>' + (n[2] ? '<i class="c2-sw ' + n[2] + '"></i>' : '') + n[0] + '<span class="c2-nn">' + n[1] + '</span></span>'; }).join('');
    return '<div class="c2-obs" aria-hidden="true">' +
      '<div class="c2-oh"><div class="c2-ot"><h2>Observatório de Competidores</h2><p>O que os canais que você acompanha mudaram, o que está estourando agora e o que a forja leu disso, para decidir o próximo vídeo, título e thumbnail.</p></div>' +
      '<div class="c2-oa"><span class="c2-ob">' + IC.sync + '<span class="c2-lt">Sincronizar concorrentes</span></span><span class="c2-ob">' + IC.plus + '<span class="c2-lt">Adicionar canal</span></span><span class="c2-ob c2-mc"><span class="c2-lt">Meu canal</span><span class="c2-mn">: <b>tnFigueiredo</b></span></span><span class="c2-ob c2-ic">' + IC.dots + '</span></div></div>' +
      '<div class="c2-fr"><span class="c2-fresh"><span class="c2-fs"><i class="c2-dot"></i><b>7 canais</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há 3 h</span><i class="c2-sp"></i><span class="c2-fs">todos em dia</span>' + IC.chev + '</span><span class="c2-tz">Horários em São Paulo</span></div>' +
      '<div class="c2-nav"><nav class="c2-otabs">' + tabs + '</nav><div class="c2-niche"><span class="c2-nl">Nicho</span><span class="c2-segc">' + nichos + '</span><span class="c2-pin">' + IC.pin + '</span></div></div></div>';
  }

  /* ---------------------------------------------------------------- a tela: ferramentas e tabela como na produção */
  function ferramentas(){
    return '<div class="c2-tool" inert aria-hidden="true"><span class="c2-busca">' + '<svg class="i" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>Buscar canal</span>' +
      '<span class="c2-seg"><b>Todos</b><span>Longos</span><span>Shorts</span></span><span class="c2-seg"><b>Absoluto</b><span>Por mil inscritos</span></span><span class="c2-seg"><b>Tabela</b><span>Cards</span></span><span class="c2-gap"></span><span class="ex">números de exemplo</span><span class="c2-quota"><span class="num">7</span> de <span class="num">20</span> canais</span></div>';
  }
  function tabela(){
    var th = function(t, u, cls, ord){ return '<th scope="col" class="' + (cls || '') + '">' + (ord == null ? t : '<span class="c2-sb">' + t + ' <span class="c2-ar" aria-hidden="true">' + ord + '</span></span>') + (u ? '<span class="c2-u2">' + u + '</span>' : '') + '</th>'; };
    return '<div class="c2-tbw"><table class="tl c2-tl" aria-label="Canais acompanhados"><thead><tr>' + th('<span class="sr">Posição</span>', '', 'c2-pos') + th('Canal', 'nicho e inscritos', '', '') + th('Ritmo', 'uploads por semana, 13 sem', '', '') + th('Views/dia', 'mediana nos longos', 'r', '▼') + th('Outliers', '2× ou mais, até 90 dias', '', '') + th('Trocas', 'título e thumbnail, 30 d, longos e Shorts', '', '') + th('Crescimento', 'inscritos, 30 d', 'r c2-hide', '') + th('Sincronização', 'e vídeos acompanhados', 'c2-hide') + th('Com o meu canal', '', 'c2-cmpc') + '<th scope="col"><span class="sr">Ações</span></th></tr></thead><tbody>' + CH.map(function(c, i){
      var ref = A.href({ canal: c.id, painel: '1' });
      return '<tr data-canal="' + c.id + '" data-href="' + ref + '"' + (aberto && c.id === atual ? ' class="hl"' : '') + '><td class="c2-pos num" data-l="Posição">' + (i + 1) + 'º</td><td data-l="Canal" class="c2-tdc"><div class="ch"><span class="av" aria-hidden="true">' + esc(c.nome.slice(0, 2)) + '</span><div><div><a class="cn" href="' + ref + '"' + (aberto && c.id === atual ? ' aria-current="true"' : '') + '>' + esc(c.nome) + '</a>' + (c.own ? ' <span class="chip own">seu canal</span>' : '') + '</div><div class="c2-sub"><span class="c2-nicho">Viagem</span><span class="num">' + A.mil(c.ins) + '</span></div></div></div></td>' +
        '<td data-l="Ritmo">' + celRitmo(c) + '</td><td class="r" data-l="Views/dia">' + celVpd(c) + '</td><td data-l="Outliers">' + celOut(c) + '</td><td data-l="Trocas" class="c2-tdt">' + celula(c) + '</td><td class="r c2-hide" data-l="Crescimento">' + celCr(c) + '</td><td class="c2-hide" data-l="Sincronização">' + celSy(c) + '</td>' +
        '<td class="c2-cmpc" data-l="Com o meu canal">' + (c.own ? '<span aria-hidden="true" class="mut">–</span><span class="sr">seu canal, sem comparação</span>' : '<a class="c2-cmp" href="#" aria-label="Comparar ' + esc(c.nome) + ' com o meu canal">Comparar</a>') + '</td>' +
        '<td class="c2-act"><button type="button" class="c2-more" aria-label="Mais ações para ' + esc(c.nome) + '">' + IC.dots + '</button></td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---------------------------------------------------------------- a barra "Estados do mockup": o andaime fica aqui, recolhida */
  var ESTADOS = [
    ['Nenhuma troca', 'leo', 'Nenhuma troca de título, thumbnail ou descrição nos últimos 30 dias.'],
    ['Só descrição', 'dale', 'Zero de título ou thumbnail no número principal; a descrição aparece à parte, com a conta dela.'],
    ['As duas', 'vou', 'O número principal bate com a lista; a linha da descrição vem logo abaixo, sem hábito (1 semana de 4).'],
    ['As duas, com hábito', 'nomade', 'Descrição em 3 das 4 últimas semanas e em 2 ou mais vídeos: aparece o selo “costuma trocar”.'],
    ['Mesmo vídeo, várias vezes', 'paddy', '5 trocas de descrição em 1 vídeo: a frase diz “no mesmo vídeo” e o selo não aparece, porque hábito é mexer em vários vídeos, não ajustar um só.'],
    ['Só título ou thumbnail', 'lucas', 'Sem linha de descrição: o silêncio é a informação.'],
    ['Canal próprio', 'proprio', 'Suas trocas ficam no A/B Lab (como hoje).']];
  var estAtual = ESTADOS.filter(function(e){ return e[1] === atual; })[0] || ESTADOS[3];
  var barra = { linhas: [
      { rotulo: 'Estado (abre o canal)', itens: ESTADOS.map(function(e){ return { t: e[0], href: A.href({ canal: e[1], painel: '1' }), atual: aberto && atual === e[1] }; }) },
      { rotulo: 'Painel do canal', itens: [{ t: 'Aberto', href: A.href({ painel: '1' }), atual: aberto }, { t: 'Fechado (só a lista)', href: A.href({ painel: '0' }), atual: !aberto }] },
      { rotulo: 'Marca de novo', itens: [{ t: 'Ligada', href: A.href({ novo: null }), atual: !semNovo }, { t: 'Desligada', href: A.href({ novo: '0' }), atual: semNovo }] },
      A.tema()],
    nota: '<b style="color:var(--text);font-weight:600">' + esc(estAtual[0]) + ' (' + esc(por[estAtual[1]].nome) + '):</b> ' + estAtual[2] + '<br>' +
      'A proposta acrescenta duas coisas a telas que já existem: a linha da descrição na coluna <b>Trocas</b> da lista e, no painel do canal, o resumo das duas contas e as trocas de descrição com filete violeta. O <b>número principal</b> continua título + thumbnail (igual à lista de hoje e à comparação); a descrição vem à parte, com a conta dela e quatro marcas de semana (a frase completa e o eixo antiga/recente estão no painel e no <code>title</code> da célula).<br>' +
      '<b style="color:var(--text);font-weight:600">Onde este mockup difere da produção:</b> (1) nomes de canais, contagens das abas e dos nichos e todos os números são <b>de exemplo</b>; (2) o cabeçalho do Observatório, as colunas (inclusive Comparar e ⋯) e o painel seguem o código, mas os botões da forja do cabeçalho não aparecem, e cabeçalhos, filtros, abas e menus são inertes; (3) abaixo de 1280 px o painel é diálogo modal, como em produção, e a lista começa sem painel; em 1280 px ou mais o painel fica ao lado e acompanha a rolagem (não conferi o comportamento exato da produção); em 1280 px a tabela rola cerca de 140 px para o lado dentro da própria caixa (Comparar e ⋯ ficam fora da vista), em 1440 px cabe inteira; (4) em 390 px as linhas viram cartões em grade de duas colunas, uma simplificação (a produção tem o layout Cards próprio); (5) o contorno verde-água e o rótulo “+ novo” são andaime: com “Marca de novo: Desligada” sobra a tela como ficaria.' };
  var corpo = chrome() + ferramentas() +
    '<div class="c2-split' + (aberto ? ' c2-ab' : ' c2-fe') + '"><div style="min-width:0">' + tabela() + '</div>' + (aberto ? '<div class="c2-pn" id="c2-pn"></div>' : '') + '</div>';
  A.moldura({ titulo: 'Observatório de Competidores', barra: barra, corpo: corpo });
  document.body.classList.add('c2-pg');
  if (semNovo) document.body.classList.add('c2-sem-novo');
  /* a faixa fixa: o caminho e a legenda da marca ficam SEMPRE visíveis, fora da barra recolhida */
  var bar = document.getElementById('mock');
  if (bar) bar.insertAdjacentHTML('afterend', '<div class="c2-faixa"><p><b>Como se chega:</b> menu YouTube, aba Competidores, aba Canais; clique num canal e o painel abre.</p><p>' + (semNovo ? 'Marca de novo desligada: é a tela como ficaria. Nomes e números de exemplo.' : '<span class="c2-demo">+ novo</span> = o que esta proposta acrescenta. Nomes e números de exemplo.') + '</p></div>');
  /* o painel: ao lado (aside) em tela larga, diálogo modal abaixo de 1280 px, como na produção */
  if (aberto) {
    var host = document.getElementById('c2-pn'), fechar = A.href({ painel: '0' });
    if (wide) host.innerHTML = painel(por[atual]);
    else {
      host.innerHTML = '<dialog class="c2-dlg" aria-label="Painel de ' + esc(por[atual].nome) + '">' + painel(por[atual]) + '</dialog>';
      var dlg = host.firstChild;
      try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
      dlg.setAttribute('tabindex', '-1'); dlg.focus();
      dlg.addEventListener('close', function(){ location.href = fechar; });
      dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
    }
  }
  /* a linha inteira abre o painel, como na produção */
  document.querySelectorAll('tr[data-href]').forEach(function(tr){ tr.addEventListener('click', function(e){ if (!e.target.closest('a,button')) location.href = tr.getAttribute('data-href'); }); });
  document.querySelectorAll('.c2-drawer a[href="#"], .c2-tl a[href="#"]').forEach(function(a){ a.addEventListener('click', function(e){ e.preventDefault(); }); });
  /* a linha do canal aberto entra na vista (rola o mínimo) para a ligação linha-painel nunca sumir */
  var hl = document.querySelector('tr.hl');
  if (hl && wide) { var ir = function(){ hl.scrollIntoView({ block: 'nearest' }); }; if (document.fonts && document.fonts.ready) document.fonts.ready.then(ir); else ir(); }
})();
