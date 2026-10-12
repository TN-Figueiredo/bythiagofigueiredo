/* canal.js: a página do canal PRÓPRIO, com dado. Estados: ?caso=magro|cheio|sem-dado|novo, ?aba=videos|retencao, ?painel=1|0, ?nums=1|0, ?tema=claro. */
(function(){
  'use strict';
  var A = window.A4, D = window.A4D, q = A.q, esc = A.esc;
  var caso = q.get('caso') || 'magro', aba = q.get('aba') || 'videos', painel = q.get('painel') !== '0', nums = q.get('nums') !== '0';
  var M = D.mundo(caso), V = M.videos, semDado = caso === 'sem-dado', novo = caso === 'novo';
  var NOME = M.nome, hoje = M.hoje;

  /* ------------------------------------------------------------ contas */
  var R = D.resumoImp(M.imp), per = M.periodoImp, nDias = M.imp.length;
  var viewsTotal = V.reduce(function(a, v){ return a + v.views; }, 0);
  var vpdLista = V.filter(function(v){ return v.vpd != null; }).map(function(v){ return v.vpd; }), vpdCanal = vpdLista.length ? A.mediana(vpdLista) : null;
  var ptsViews = V.reduce(function(a, v){ return a + (v.pct ? v.pct.n : 0); }, 0), pctCanal = ptsViews ? V.reduce(function(a, v){ return a + (v.pct ? v.pct.p * v.pct.n : 0); }, 0) / ptsViews : null;
  var w = R.imp ? A.wilson(R.clR, R.imp) : null;
  var impVid = V.filter(function(v){ return v.imp > 0; }).sort(function(a, b){ return b.imp - a.imp; });

  /* ------------------------------------------------------------ cabeçalho */
  function cabecalho(){
    var acts = novo ? '' : '<a class="btn" href="comparar-so-seu-canal.html' + (caso === 'cheio' ? '?caso=cheio' : '') + '">Comparar com…</a><span class="btn">Abrir no YouTube</span>';
    var sub = novo ? 'Este canal ainda não tem vídeos sincronizados.' : (M.exemplo ? 'Dados de exemplo.' : 'Dados lidos em 09/10/2026.') + ' ' + (M.totalVideos || V.length) + ' vídeos, todos longos.';
    var cel1 = novo ? [{ v: '3', l: 'inscritos' }, { v: '0', l: 'vídeos' }]
      : [{ v: A.mil(M.inscritos), l: 'inscritos' }, { v: String(M.totalVideos || V.length), l: 'vídeos, todos longos' }, { v: A.mil(M.exemplo ? 1820000 : viewsTotal), l: 'views somadas' },
        semDado ? { v: null, l: 'impressões no período' } : { v: A.n(R.imp), l: 'impressões', sub: 'de ' + A.dm(per[0]) + ' a ' + A.dm(per[1]) },
        semDado ? { v: null, l: 'dias com impressão' } : { v: R.com + ' de ' + nDias, l: 'dias com impressão' },
        { v: A.n(M.ultimoVideoDias) + ' dias', l: 'desde o último vídeo', parado: M.ultimoVideoDias > 60 }];
    var nota = semDado ? '<p class="nota nm-sw" style="display:flex;max-width:92ch">' + A.nmSw() + '<span><b>Não medido:</b> os números de alcance (impressões e cliques) deste canal ainda não chegaram. Quando chegarem, aparecem aqui; até lá, nenhum deles é zero, só falta medir.</span></p>' : '';
    var resumoCanal = novo ? '' : '<p class="resumo-canal">' + (M.ultimoVideoDias > 60 ? '<span class="dn">Canal parado há ' + A.n(M.ultimoVideoDias) + ' dias</span>' : 'Último vídeo há ' + A.n(M.ultimoVideoDias) + ' dias') + (semDado ? '; ainda sem números de alcance.' : '; ' + A.n(R.imp) + ' impressões em ' + nDias + ' dias.') + '</p>';
    var linha2 = '';
    if (nums && !novo) {
      var c2 = [
        semDado ? { v: null, l: 'cliques estimados' } : { v: A.mil(R.clR) || '0', l: 'cliques estimados', sub: 'impressões × taxa de cada dia' },
        semDado ? { v: null, l: 'taxa de clique do canal' } : { v: A.pct(R.cl / R.imp, 1), l: 'taxa de clique do canal', sub: 'entre ' + A.pct(w[0], 1) + ' e ' + A.pct(w[1], 1) },
        semDado ? { v: null, l: 'views por dia por vídeo' } : { v: (vpdCanal === 0 ? '0' : A.dec(vpdCanal, vpdCanal < 10 ? 1 : 0)), l: 'views por dia por vídeo', sub: 'mediana dos longos, 28 dias' },
        semDado ? { v: null, l: '% assistido' } : { v: A.pct(pctCanal, 0), l: '% assistido', sub: ptsViews < 30 ? 'só ' + ptsViews + ' views: pouco para uma média' : 'média pelas views, 28 dias', fraco: ptsViews < 10 },
        { v: null, l: 'retenção (curva)', sub: 'a curva ainda não é coletada' }];
      linha2 = '<div class="nrow">' + A.faixa(c2, 'Mais números do canal', semDado) + '<span style="width:44px;flex:none"></span></div>';
    }
    return '<header class="chead"><span class="av" aria-hidden="true">' + esc(M.ini) + '</span><div class="l1"><h1>' + esc(NOME) + '</h1><span class="chip own">seu canal</span>' + (M.exemplo ? '<span class="ex">exemplo</span>' : '') + '</div><div class="acts">' + acts + '</div><p class="sub">' + esc(sub) + '</p></header>' +
      resumoCanal + '<div class="nrow">' + A.faixa(cel1, 'Números do canal', semDado) + A.ibtn('infoNums', 'De onde vêm os números') + '</div>' + nota +
      (novo ? '' : '<p class="nota"><button type="button" class="lk" id="btnNums" aria-expanded="' + nums + '">Todos os números ' + A.CHEV + '</button></p>') + linha2 +
      A.oculto('infoNums', 'De onde vêm os números', '<ul><li><b>Views somadas:</b> soma das views de todos os vídeos, no dia da última sincronização.</li><li><b>Impressões:</b> dados de alcance do YouTube, por dia do YouTube, de ' + (novo || semDado ? '—' : A.dm(per[0]) + ' a ' + A.dm(per[1])) + '. Dia que não chegou não conta como zero.</li><li><b>Cliques estimados:</b> impressões × taxa de clique de cada dia, somadas. O YouTube não entrega a contagem de cliques.</li><li><b>Taxa de clique do canal:</b> cliques estimados ÷ impressões. O intervalo é o de 95% de confiança (Wilson).</li><li><b>Views por dia:</b> views dos últimos 28 dias do YouTube ÷ dias com medida, por vídeo; o número é a mediana dos longos. Exige 7 dias com medida.</li><li><b>% assistido:</b> média do percentual de cada dia, pesada pelas views do dia.</li></ul>');
  }

  /* ------------------------------------------------------------ "Como o canal está" */
  function frase(){
    if (semDado) return 'Os números de alcance deste canal ainda não chegaram. Quando chegarem, esta área mostra em que dias o canal apareceu e quais vídeos foram mais vistos nas buscas e na página inicial.';
    if (R.imp >= 1000) return 'Com ' + A.n(R.imp) + ' impressões em ' + nDias + ' dias dá para ver em que dias e em quais vídeos o canal apareceu. Nenhum vídeo sozinho diz que uma capa funciona melhor.';
    return 'Com ' + A.n(R.imp) + ' impressões em ' + nDias + ' dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.';
  }
  function resumo(){
    if (!nDias) return 'Os números de alcance deste canal ainda não chegaram.';
    var cl = R.clR === 1 ? '1 clique estimado' : A.n(R.clR) + ' cliques estimados';
    return A.n(R.imp) + ' impressões e ' + cl + ' em ' + nDias + ' dias: ' + R.com + ' dias com impressão' + (R.zero ? ', ' + R.zero + ' medidos em zero' : '') + (R.nm ? ' e ' + R.nm + ' não medidos' : '') + '.';
  }
  function taxaCanal(){
    if (semDado) return '<div class="ctr"><h3>Taxa de clique do canal</h3>' + A.nml('Sem os números de alcance não há como calcular a taxa.') + '</div>';
    var largo = (w[1] - w[0]) > .05, p = R.cl / R.imp;
    var f = '<b>' + A.pct(p, 1) + '</b> das impressões viraram clique (' + A.n(R.clR) + ' de ' + A.n(R.imp) + '). Com este volume, a taxa real fica entre <b>' + A.pct(w[0], 1) + '</b> e <b>' + A.pct(w[1], 1) + '</b>.' + (largo ? ' Ainda não dá para dizer se é alta ou baixa.' : '');
    return '<div class="ctr" id="ctr"><h3>Taxa de clique do canal ' + A.ibtn('infoCtr', 'Como a taxa é calculada', true) + '</h3><p class="fr">' + f + '</p><div id="ctrSvg"></div><p class="nt">Compare com os seus próprios vídeos e períodos, não com outros canais: o YouTube só entrega a taxa de clique ao dono do canal.</p></div>' +
      A.oculto('infoCtr', 'Como a taxa é calculada', '<p>Cliques estimados ÷ impressões, no período. Os cliques são estimados dia a dia (impressões × taxa que o YouTube informa para o dia), porque o YouTube não entrega a contagem de cliques.</p><p>A faixa colorida é o intervalo de 95% de confiança (método de Wilson): com poucas impressões ela é larga, e a taxa de um período não diz muito. É a mesma regra que mantém a taxa de um vídeo sozinho fora desta tela: com 18 impressões o intervalo vai de 3% a 33%.</p>');
  }
  function topo5(){
    if (!impVid.length) return '<p class="mut" style="margin:6px 0 0;font-size:13px">' + (semDado ? 'Sem os números de alcance, não há vídeo para listar.' : 'Nenhum vídeo teve impressão no período.') + '</p>';
    return '<ol class="top5">' + impVid.slice(0, 5).map(function(v){
      var th = D.thumb(v), meta = M.exemplo ? A.mil(v.imp) + ' impressões, ' + A.mil(v.clR) + ' cliques estimados' : A.n(v.imp) + ' impressões, ' + (v.clR ? v.clR + (v.clR === 1 ? ' clique' : ' cliques') : 'nenhum clique') + ' em ' + v.impDias + (v.impDias === 1 ? ' dia' : ' dias');
      return '<li><span class="th" style="background:' + D.cor(v) + '">' + (th ? '<img src="' + th + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span><span><a class="t lk" href="video.html?caso=' + caso + (v.id === M.feat ? '' : '') + '" title="' + esc(v.t) + '" style="text-decoration:none">' + esc(v.t) + '</a><span class="m">' + meta + '</span></span></li>'; }).join('') + '</ol>';
  }
  function secPainel(){
    var cab = '<div class="pn-h"><h2><button type="button" id="btnPn" aria-expanded="' + painel + '" aria-controls="pnB">Como o canal está ' + A.CHEV + '</button></h2><p class="res">' + esc(painel ? '' : resumo()) + '</p></div>';
    if (!painel) return '<section class="pn" aria-labelledby="pnT">' + cab.replace('<h2>', '<h2 id="pnT">') + '</section>';
    return '<section class="pn" aria-labelledby="pnT">' + cab.replace('<h2>', '<h2 id="pnT">') + '<div class="pn-b" id="pnB"><p class="pn-frase">' + esc(frase()) + '</p><div class="pn-cols"><div style="display:grid;gap:22px;min-width:0"><div id="gImp"></div>' + taxaCanal() + '<div id="gViews"></div></div>' +
      '<div style="display:grid;gap:22px;align-content:start;min-width:0"><div><h3>Vídeos que mais apareceram</h3>' + topo5() + '</div><div><h3>O que ainda não é medido</h3><ul class="ainda" style="margin-top:6px"><li><b>Curva de retenção:</b> ainda não é coletada.</li><li><b>Origem do tráfego:</b> ainda não aparece aqui.</li></ul></div>' +
      '</div></div></div></section>';
  }

  /* ------------------------------------------------------------ abas */
  function abas(){
    var base = function(a){ return A.href({ aba: a === 'videos' ? null : a }); };
    return '<nav class="ctabs" aria-label="Seções do canal"><ul>' + [['videos', 'Vídeos', V.length ? '<span class="n">' + (M.totalVideos || V.length) + '</span>' : ''], ['trocas', 'Trocas', ''], ['leitura', 'Leitura', ''], ['retencao', 'Retenção', '']].map(function(t){
      return '<li><a href="' + (t[0] === 'trocas' || t[0] === 'leitura' ? '#' : base(t[0])) + '"' + (aba === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + ' ' + t[2] + '</a></li>'; }).join('') + '</ul></nav>';
  }
  function cartao(v){
    var th = D.thumb(v), imp = semDado ? '' : v.imp > 0 ? '<b>' + (M.exemplo ? A.mil(v.imp) : A.n(v.imp)) + '</b> impressões' : 'sem impressão no período';
    var cl = semDado ? '' : v.imp > 0 ? (M.exemplo ? A.mil(v.clR) + ' cliques estimados' : v.clR ? v.clR + (v.clR === 1 ? ' clique' : ' cliques') + ' em ' + v.impDias + (v.impDias === 1 ? ' dia' : ' dias') : 'nenhum clique em ' + v.impDias + (v.impDias === 1 ? ' dia' : ' dias')) : '';
    var vpd = v.vpd == null ? '' : '<b>' + (v.vpd === 0 ? '0' : A.dec(v.vpd, v.vpd < 10 ? 1 : 0)) + '</b> views por dia';
    return '<article class="vc"><a class="th" href="video.html?caso=' + caso + '" style="background:' + D.cor(v) + '" aria-label="Abrir o histórico de ' + esc(v.t) + '">' + (th ? '<img src="' + th + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<span class="dur">' + A.dur(v.dur) + '</span></a><div class="bd"><div class="tt">' + esc(v.t) + '</div>' +
      '<div class="ln"><b>' + (v.views >= 1000 ? A.mil(v.views) : v.views) + '</b> views</div>' + (semDado ? '' : '<div class="ln">' + vpd + '</div><div class="ln k">' + imp + (cl ? ' · ' + cl : '') + '</div>') + '</div></article>';
  }
  function abaVideos(){
    var lista = V.slice(0, 10);
    return '<section aria-labelledby="hV"><h2 class="sr" id="hV">Vídeos</h2><p class="nota" style="margin-top:12px">Ordenado por mais recentes. ' + (semDado ? 'Nestes cartões, views por dia e alcance estão não medidos: a coleta diária ainda não rodou para este canal.' : 'Views por dia: média dos últimos 28 dias com medida.') + '</p><div class="grade">' + lista.map(cartao).join('') + '</div><p class="nota" style="margin-top:14px">Mostrando ' + lista.length + ' de ' + (M.totalVideos || V.length) + ' vídeos.</p></section>';
  }
  function abaRetencao(){
    if (novo) return '';
    var faixas = [['Até 5 min', 0, 300], ['5 a 15 min', 300, 900], ['Acima de 15 min', 900, 1e9]];
    var ok = V.filter(function(v){ return v.pct && v.pct.n > 0; });
    var med28 = A.mediana(V.map(function(v){ return v.views28 || 0; }));
    var linhas = faixas.map(function(f){
      var dentro = V.filter(function(v){ return v.dur > f[1] && v.dur <= f[2] || (f[1] === 0 && v.dur <= f[2]); }), com = dentro.filter(function(v){ return v.pct && v.pct.n > 0; });
      var normal = com.length >= 5 ? A.pct(A.mediana(com.map(function(v){ return v.pct.p; })), 0) : null;
      f.normal = normal ? A.mediana(com.map(function(v){ return v.pct.p; })) : null;
      return '<tr><th scope="row">' + f[0] + '</th><td class="r num">' + dentro.length + '</td><td>' + (normal ? '<b class="num">' + normal + '</b>' : !dentro.length ? '<span class="mut">nenhum vídeo nesta faixa</span>' : !com.length ? A.nm() + ' <span class="mut">nenhum vídeo desta faixa teve views nos 28 dias</span>' : '<span class="mut">poucos vídeos para comparar (' + com.length + '; precisa de 5)</span>') + '</td></tr>';
    }).join('');
    var faixaDe = function(v){ return faixas.filter(function(f){ return v.dur > f[1] && v.dur <= f[2] || (f[1] === 0 && v.dur <= f[2]); })[0]; };
    var NA_MEDIA = 2; /* pontos de % assistido: até 2 pontos para cima ou para baixo é "na média" (ruído, não sinal) */
    var abaixo = ok.filter(function(v){ var f = faixaDe(v); return f.normal != null && v.views28 > med28 && Math.round((v.pct.p - f.normal) * 100) < -NA_MEDIA; });
    var cmp = function(v){ var f = faixaDe(v), dif = f.normal != null ? Math.round((v.pct.p - f.normal) * 100) : null;
      if (dif == null) return '<span class="mut">poucos vídeos para comparar</span>';
      if (Math.abs(dif) <= NA_MEDIA) return '<span class="cmp eq"><span class="pt">=</span><span class="w">na média da faixa (' + A.pct(f.normal, 0) + ')' + (dif ? ', ' + (dif > 0 ? '+' : '−') + Math.abs(dif) + (Math.abs(dif) === 1 ? ' ponto' : ' pontos') : '') + '</span></span>';
      return '<span class="cmp ' + (dif > 0 ? 'up' : 'dn') + '"><span class="pt">' + (dif > 0 ? '+' : '−') + Math.abs(dif) + (Math.abs(dif) === 1 ? ' ponto' : ' pontos') + '</span><span class="w">' + (dif > 0 ? 'acima' : 'abaixo') + ' do normal da faixa (' + A.pct(f.normal, 0) + ')</span></span>'; };
    var barra = function(v){ var f = faixaDe(v); return '<span class="mini" aria-hidden="true"><i style="width:' + Math.round(v.pct.p * 100) + '%"></i>' + (f.normal != null ? '<s style="left:' + Math.round(f.normal * 100) + '%"></s>' : '') + '</span><b class="num">' + A.pct(v.pct.p, 0) + '</b>' + (v.pct.n < 10 ? ' <span class="mut">(' + v.pct.n + ' views)</span>' : ''); };
    var ordenados = ok.slice().sort(function(a, b){ return b.views28 - a.views28; });
    var corpo;
    if (!ok.length) corpo = '<div class="dep" style="border-style:solid;border-color:var(--border-strong)"><div class="nml">' + A.nm() + '<p>' + (semDado ? 'A coleta diária ainda não rodou para este canal: não há % assistido de nenhum vídeo.' : '<b>Nenhum vídeo teve views nos 28 dias até ' + A.dm(M.ult) + '.</b> Sem views não há % assistido para comparar. Os vídeos voltam a aparecer aqui assim que tiverem uma.') + '</p></div></div>';
    else corpo = '<p class="lead" style="margin:10px 0 6px;font-size:14px">' + (abaixo.length ? '<b>' + abaixo.length + (abaixo.length === 1 ? ' vídeo tem' : ' vídeos têm') + '</b> views acima do normal do canal e % assistido abaixo do normal da faixa: ' + abaixo.map(function(v){ return '“' + esc(v.t) + '”'; }).join(', ') + '.' : 'Nenhum vídeo tem views acima do normal do canal com % assistido abaixo do normal da faixa.') + '</p>' +
      '<div class="tbw rt"><table class="tb"><caption class="sr">Vídeos com % assistido, contra o normal da faixa de duração</caption><thead><tr><th scope="col">Vídeo</th><th scope="col">Faixa</th><th scope="col" class="r">Views, 28 dias</th><th scope="col">% assistido</th><th scope="col">Contra a faixa</th></tr></thead><tbody>' +
      ordenados.map(function(v){ var f = faixaDe(v);
        return '<tr' + (abaixo.indexOf(v) >= 0 ? ' class="alvo"' : '') + '><td><a class="lk" href="video.html?caso=' + caso + '" style="text-decoration:none">' + esc(v.t) + '</a></td><td>' + f[0] + '</td><td class="r num">' + A.n(v.views28) + '</td><td>' + barra(v) + '</td><td>' + cmp(v) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<ul class="rcards" aria-label="Vídeos com % assistido">' + ordenados.map(function(v){ var f = faixaDe(v);
        return '<li class="rcard' + (abaixo.indexOf(v) >= 0 ? ' alvo' : '') + '"><a href="video.html?caso=' + caso + '">' + esc(v.t) + '</a><div class="l2"><span>' + f[0] + '</span><span>' + A.n(v.views28) + ' views em 28 dias</span></div><div>' + barra(v) + '</div><div>' + cmp(v) + '</div></li>'; }).join('') + '</ul>' +
      '<p class="rleg"><span><span class="mini" aria-hidden="true" style="width:34px;margin:0"><i style="width:55%"></i><s style="left:40%"></s></span>a barra é o % assistido; a marca é o normal da faixa</span><span class="cmp up"><span class="pt">+</span><span class="w">acima (3 pontos ou mais)</span></span><span class="cmp eq"><span class="pt">=</span><span class="w">na média (até 2 pontos para cima ou para baixo)</span></span><span class="cmp dn"><span class="pt">−</span><span class="w">abaixo (3 pontos ou mais)</span></span></p>';
    return '<section aria-labelledby="hR" style="margin-top:14px"><h2 class="h-sec" id="hR" style="margin-top:0">% assistido ' + A.ibtn('infoR', 'De onde vem o % assistido', true) + '</h2><p class="nota">Dado do diário do YouTube, dia do YouTube, dos 28 dias até ' + A.dm(M.ult) + '. A curva de retenção por minuto fica na página de cada vídeo.</p>' +
      '<div class="tbw" style="margin-top:8px"><table class="tb"><caption class="sr">Normal de % assistido por faixa de duração</caption><thead><tr><th scope="col">Faixa de duração</th><th scope="col" class="r">Vídeos</th><th scope="col">Normal da faixa (mediana de % assistido)</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' + corpo +
      A.oculto('infoR', 'De onde vem o % assistido', '<ul><li><b>% assistido de um vídeo:</b> média do percentual de cada dia, pesada pelas views do dia. Dá o mesmo resultado que o YouTube calcula para a janela inteira.</li><li><b>Normal da faixa:</b> mediana dos vídeos da faixa. Só aparece com 5 ou mais vídeos com views no período.</li><li><b>Na média:</b> uma diferença de até 2 pontos para cima ou para baixo é ruído e não ganha cor; de 3 pontos em diante é “acima” ou “abaixo”.</li><li><b>Poucas views:</b> abaixo de 10 views o valor aparece com a contagem ao lado, porque uma ou duas pessoas mudam o resultado.</li></ul>') + '</section>';
  }
  function abaNovo(){
    return '<section class="empty" style="border:1px dashed var(--border-strong);border-radius:8px;padding:24px 20px;max-width:680px;margin-top:14px;display:grid;gap:8px"><h2 style="font:600 15px var(--sans)">Este canal ainda não tem vídeos</h2><p style="margin:0">A página ganha vídeos, gráficos e números assim que o primeiro vídeo for sincronizado, o que acontece na próxima coleta. Se você acabou de publicar, volte depois de algumas horas.</p><p class="mut" style="margin:0;font-size:13px">Enquanto isso, o canal já aparece na lista de Canais e pode ser escolhido na comparação (sem vídeos, só com os inscritos).</p><p style="margin:0"><a class="btn" href="index.html">Ver a lista de Canais</a></p></section>';
  }

  /* ------------------------------------------------------------ montagem */
  var barra = { linhas: [{ rotulo: 'Estado', itens: A.opcoes('caso', D.CASOS, 'magro') }, { rotulo: 'Aba', itens: A.opcoes('aba', [['videos', 'Vídeos'], ['retencao', 'Retenção (% assistido)']], 'videos') },
    { rotulo: 'Painel', itens: A.opcoes('painel', [['1', 'Aberto'], ['0', 'Recolhido']], '1') }, A.tema()],
    nota: '<b>Real:</b> título, data, views, curtidas, comentários e duração dos 35 vídeos, e as impressões e a taxa de clique por vídeo e dia (09/09 a 07/10). <b>Exemplo:</b> o diário de views por dia, o % assistido, a curva de retenção e o canal inteiro do caso cheio. Em 390 px, abra esta página numa janela estreita.' };
  var corpo = A.migalha([['Canais', 'index.html'], [NOME]]) + cabecalho() + (novo ? abaNovo() : secPainel() + abas() + (aba === 'retencao' ? abaRetencao() : abaVideos()));
  A.moldura({ titulo: 'Canal próprio: ' + NOME, barra: barra, corpo: corpo });
  A.ligarInfos();

  var bn = document.getElementById('btnNums'); if (bn) bn.addEventListener('click', function(){ location.href = A.href({ nums: nums ? '0' : null }); });
  var bp = document.getElementById('btnPn'); if (bp) bp.addEventListener('click', function(){ location.href = A.href({ painel: painel ? '0' : null }); });
  if (painel && !novo) {
    var gi = document.getElementById('gImp');
    if (gi && nDias) {
      A.serieDia(gi, { id: 'gimp', titulo: 'Impressões por dia do canal', frase: esc(resumo()), meta: 'de ' + A.dm(per[0]) + ' a ' + A.dm(per[1]) + ' · ' + nDias + ' dias · dia do YouTube', dias: M.imp, um: ['impressão', 'impressões'], cliques: true,
        legBarra: 'impressões do dia', legZero: 'zero medido: o YouTube enviou o dia sem impressões', legNm: 'não medido: o dia ainda não chegou',
        fala: function(d){ var c = d.cl; return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'o dia ainda não chegou (não medido)' : d.e === 'zero' ? 'o YouTube enviou o dia sem impressões (zero medido)' : A.n(d.v) + (d.v === 1 ? ' impressão, ' : ' impressões, ') + (c < 1 ? 'menos de 1 clique estimado' : Math.round(c) === 1 ? '1 clique estimado' : A.n(Math.round(c)) + ' cliques estimados')); },
        ajuda: '<p>Cada coluna é um dia do YouTube (o YouTube fecha o dia no horário do Pacífico). <b>Barra</b>: dia com impressões. <b>Caixa vazada</b>: o dia chegou sem impressões: é zero de verdade. <b>Hachura</b>: o dia ainda não chegou: não é zero, é falta de medida, e não entra em nenhuma soma. <b>Bolinha e número embaixo</b>: cliques estimados do dia.</p><p>Use os botões abaixo do gráfico para ler um dia de cada vez.</p>' });
    } else if (gi) gi.innerHTML = '<h3 class="ic-t">Impressões por dia do canal</h3><p class="mut" style="margin:2px 0 0;font-size:13px">Os números de alcance deste canal ainda não chegaram.</p>';
    var gv = document.getElementById('gViews');
    if (gv && M.viewsDias.length) {
      var vc = D.resumoImp(M.viewsDias.map(function(d){ return { d: d.d, v: d.v, e: d.e, cl: 0 }; })), melhor = M.viewsDias.filter(function(d){ return d.e === 'com'; }).sort(function(a, b){ return b.v - a.v; })[0];
      var fr = vc.com === 0 ? 'Nenhuma view nos ' + (vc.zero) + ' dias medidos' + (vc.nm ? '; ' + vc.nm + (vc.nm === 1 ? ' dia' : ' dias') + ' sem medida.' : '.') : A.n(vc.imp) + ' views em ' + (vc.com + vc.zero) + ' dias medidos (' + A.dec(vc.imp / (vc.com + vc.zero), vc.imp / (vc.com + vc.zero) < 10 ? 1 : 0) + ' por dia)' + (melhor ? '. O melhor dia foi ' + A.dm(melhor.d) + ', com ' + A.n(melhor.v) + '.' : '.') + (vc.nm ? ' ' + vc.nm + (vc.nm === 1 ? ' dia sem medida.' : ' dias sem medida.') : '');
      if (vc.com === 0 && vc.zero === 0) fr = 'Sem dia medido.';
      A.serieDia(gv, { id: 'gvw', titulo: 'Views por dia, soma dos vídeos', frase: esc(fr), meta: 'de ' + A.dm(M.viewsDias[0].d) + ' a ' + A.dm(M.ult) + ' · 28 dias · dia do YouTube', dias: M.viewsDias, um: ['view', 'views'], legBarra: 'views do dia', legZero: 'zero medido: o YouTube registrou nenhuma view', legNm: 'não medido: o YouTube não entregou o dia',
        fala: function(d){ return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'o YouTube não entregou este dia (não medido)' : d.v === 0 ? 'nenhuma view (zero medido)' : A.n(d.v) + (d.v === 1 ? ' view' : ' views')); },
        ajuda: '<p>Soma das views por dia de todos os vídeos acompanhados do canal. O dia mais recente chega com 2 a 3 dias de atraso: por isso o gráfico termina em ' + A.dm(M.ult) + ' e não hoje.</p><p><b>Caixa vazada</b>: o YouTube entregou o dia e ninguém viu os vídeos. <b>Hachura</b>: o dia não veio na coleta; não é zero.</p>' });
    }
    var cs = document.getElementById('ctrSvg');
    if (cs && R.imp) A.faixaTaxa(cs, { cliques: R.clR, imp: R.imp, alt: 'Taxa de clique do canal: ' + A.pct(R.cl / R.imp, 1) + ', intervalo de 95% de ' + A.pct(w[0], 1) + ' a ' + A.pct(w[1], 1) });
  }
})();
