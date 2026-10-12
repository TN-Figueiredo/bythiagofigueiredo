/* video.js: a página do VÍDEO próprio, com dado. ?caso=cheio|magro|sem-dado|novo, ?tema=claro. */
(function(){
  'use strict';
  var A = window.A4, D = window.A4D, q = A.q, esc = A.esc, R = window.REAL;
  var caso = q.get('caso') || 'cheio', base = caso === 'novo' ? 'cheio' : caso, M = D.mundo(base);
  var v = M.videos.filter(function(x){ return x.id === M.feat; })[0], semDado = caso === 'sem-dado', novoV = caso === 'novo';
  /* vídeo novo: publicado ontem, com números pequenos (não reaproveita os do vídeo cheio) */
  var vCheio = v;
  if (novoV) v = Object.assign({}, v, { pub: A.addDias(M.hoje, -1), views: 212, likes: 9, com: 1, vdSerie: null, impSerie: null, pct: null, curva: null, vpd: null });
  var idade = A.dias(v.pub, M.hoje), V = M.videos, outros = V.filter(function(x){ return x !== vCheio; });
  var med = A.mediana(outros.map(function(x){ return x.views; })), mult = v.views / med, eng = (v.likes + v.com) / v.views;
  var CASOS = [['cheio', 'Cheio (exemplo)'], ['magro', 'Magro (real)'], ['sem-dado', 'Sem dado (coleta não rodou)'], ['novo', 'Vídeo novo (menos de 3 dias)']];

  /* séries do vídeo */
  var vd = novoV || semDado ? null : (v.vdSerie || v.vd);
  var impS = null;
  if (!semDado && !novoV) {
    if (v.impSerie) impS = v.impSerie;
    else { var porDia = {}; R.reach.forEach(function(r){ if (r[1] === v.id) porDia[r[0]] = r; }); impS = M.imp.map(function(d){ var r = porDia[d.d]; return d.e === 'nm' ? { d: d.d, v: null, e: 'nm' } : r ? { d: d.d, v: r[2], e: 'com', cl: r[2] * r[3], ctr: r[3] } : { d: d.d, v: 0, e: 'zero', cl: 0 }; }); }
  }
  var RI = impS ? D.resumoImp(impS) : null, w = RI && RI.imp ? A.wilson(RI.clR, RI.imp) : null;
  var canalImp = D.resumoImp(M.imp), wc = canalImp.imp ? A.wilson(canalImp.clR, canalImp.imp) : null;

  /* ------------------------------------------------------------ cabeçalho */
  function cabecalho(){
    var cells = [{ v: v.views >= 1000 ? A.mil(v.views) : String(v.views), l: 'views' }, { v: String(v.likes), l: 'curtidas' }, { v: String(v.com), l: 'comentários' }, { v: A.pct(eng, 1), l: 'engajamento', sub: 'curtidas + comentários por view' },
      novoV ? { v: null, l: 'o normal do canal', sub: 'com 1 dia ainda não dá para comparar' } : { v: A.dec(mult, 1) + '×', l: 'o normal do canal', sub: 'mediana dos outros vídeos: ' + A.n(Math.round(med)) + ' views' }, { v: A.dur(v.dur), l: 'duração' }];
    var th = D.thumb(v);
    return '<div class="vh"><span class="th" style="background:' + D.cor(v) + '">' + (th ? '<img src="' + th + '" alt="" onerror="this.remove()">' : '') + '</span><div><h1 id="vt" tabindex="-1">' + esc(v.t) + '</h1><p class="l2"><span class="chip own">seu canal</span>' + (M.exemplo ? '<span class="ex">exemplo</span>' : '') +
      '<span>Publicado em ' + A.dmy(v.pub) + ' (há ' + idade + (idade === 1 ? ' dia' : ' dias') + ') · vídeo longo</span></p>' +
      '<div class="nrow">' + A.faixa(cells, 'Números do vídeo') + A.ibtn('infoV', 'De onde vêm os números') + '</div><p style="margin:0;display:flex;gap:8px;flex-wrap:wrap"><span class="btn">Abrir no YouTube</span><span class="btn">Ampliar thumbnail</span></p></div></div>' +
      A.oculto('infoV', 'De onde vêm os números', '<ul><li><b>Views, curtidas e comentários:</b> totais do vídeo, na última sincronização.</li><li><b>Engajamento:</b> (curtidas + comentários) ÷ views.</li><li><b>O normal do canal:</b> views deste vídeo ÷ mediana de views dos outros vídeos.</li></ul>');
  }
  function pager(){ return '<p class="pager"><span class="d">' + A.L + ' Anterior</span><span>vídeo 1 de ' + (M.totalVideos || V.length) + ', na ordem da lista: do mais novo ao mais antigo</span><a href="#" onclick="return false">Próximo ' + A.R + '</a></p>'; }

  /* ------------------------------------------------------------ seções */
  function fraseViews(){
    if (!vd) return semDado ? A.nml('A coleta diária de views ainda não rodou para este canal. Nenhum dia é zero: falta medir.') : A.nml('Vídeo novo: o YouTube entrega as views de cada dia com 2 a 3 dias de atraso, então com menos de 3 dias de vida ainda não há dia fechado.');
    var c = D.resumoImp(vd.map(function(d){ return { d: d.d, v: d.v, e: d.e, cl: 0 }; })), tot = c.imp, dm = c.com + c.zero, best = vd.filter(function(d){ return d.e === 'com'; }).sort(function(a, b){ return b.v - a.v; })[0];
    if (!tot) return '<b>Nenhuma view</b> nos ' + dm + ' dias medidos' + (c.nm ? ', e ' + c.nm + (c.nm === 1 ? ' dia' : ' dias') + ' sem medida' : '') + '. É zero medido: o YouTube entregou os dias e ninguém viu.';
    var pm = tot / dm;
    return '<b>' + A.n(tot) + (tot === 1 ? ' view' : ' views') + '</b> em ' + dm + ' dias medidos (' + A.dec(pm, pm < 10 ? 1 : 0) + ' por dia).' + (best ? ' O melhor dia foi ' + A.dm(best.d) + ', com ' + A.n(best.v) + (M.exemplo ? ', o ' + (A.dias(v.pub, best.d) + 1) + 'º dia do vídeo.' : '.') : '') + (c.nm ? ' ' + c.nm + (c.nm === 1 ? ' dia' : ' dias') + ' sem medida.' : '');
  }
  function secViews(){
    return '<section class="sec" aria-labelledby="hVw"><h2 id="hVw">Views por dia</h2><div id="gVw">' + (vd ? '' : fraseViews()) + '</div></section>';
  }
  function secImp(){
    var cab = '<section class="sec" aria-labelledby="hIm"><h2 id="hIm">Impressões e cliques</h2>';
    if (!impS) return cab + (semDado ? A.nml('Os números de alcance deste canal ainda não chegaram: impressões e cliques deste vídeo aparecem quando chegarem. Nenhum deles é zero.') : A.nml('Vídeo novo: os números de alcance chegam com 2 a 3 dias de atraso, então ainda não há dia deste vídeo.')) + '</section>';
    var taxa = '';
    if (RI.imp) {
      var p = RI.cl / RI.imp, folga = wc && (w[0] > wc[1] ? 'acima' : w[1] < wc[0] ? 'abaixo' : null), gap = wc ? (folga === 'acima' ? w[0] - wc[1] : folga === 'abaixo' ? wc[0] - w[1] : 0) : 0;
      var verd = !wc ? '' : folga && gap < .004 ? ' Fica um pouco ' + folga + ' da taxa do canal (' + A.pct(wc[0], 1) + ' a ' + A.pct(wc[1], 1) + '): as duas faixas quase se tocam, então a diferença é pequena.' : folga ? ' Fica ' + folga + ' da taxa do canal (' + A.pct(wc[0], 1) + ' a ' + A.pct(wc[1], 1) + '), mesmo contando a incerteza.' : ' Pode ser igual à taxa do canal (' + A.pct(wc[0], 1) + ' a ' + A.pct(wc[1], 1) + '): com este volume, não dá para dizer que a capa funciona melhor ou pior.';
      taxa = '<div class="ctr"><h3>Taxa de clique deste vídeo ' + A.ibtn('infoT', 'Como a taxa é calculada', true) + '</h3><p class="fr"><b>' + A.pct(p, 1) + '</b> das impressões viraram clique (' + A.n(RI.clR) + ' de ' + A.n(RI.imp) + '). A taxa real fica entre <b>' + A.pct(w[0], 1) + '</b> e <b>' + A.pct(w[1], 1) + '</b>.' + verd + '</p><div id="ctrV"></div></div>' +
        A.oculto('infoT', 'Como a taxa é calculada', '<p>Cliques estimados ÷ impressões, nos dias medidos. Os cliques são estimados por dia (impressões × taxa do dia), porque o YouTube não entrega a contagem de cliques.</p><p>A faixa colorida é o intervalo de 95% (Wilson). Com poucas impressões ela é larga e cobre a taxa do canal: por isso a tela diz “não dá para dizer”, em vez de chamar a capa de boa ou ruim. Quando a faixa é larga demais para concluir, ela fica tracejada e cinza.</p>');
    }
    return cab + '<div id="gIm"></div>' + taxa + '</section>';
  }
  function secAssistido(){
    var cab = '<section class="sec" aria-labelledby="hAs"><h2 id="hAs">Quanto do vídeo as pessoas assistem ' + A.ibtn('infoAs', 'De onde vem o % assistido', true) + '</h2>';
    var ajuda = A.oculto('infoAs', 'De onde vem o % assistido', '<ul><li><b>% assistido:</b> do total de tempo de vídeo possível, quanto foi assistido. É a média do percentual de cada dia, pesada pelas views do dia (dá o mesmo valor que o YouTube calcula para o período inteiro).</li><li><b>Janela:</b> os dias com medida deste vídeo, no máximo 28.</li><li><b>Poucas views:</b> abaixo de 10 views o valor sai com a contagem ao lado, em cinza, e sem comparar com o normal do canal.</li><li><b>A cor:</b> a barra é laranja porque é do seu canal, como a de views por dia.</li></ul>');
    if (!v.pct) return cab + (semDado ? A.nml('A coleta diária ainda não rodou: sem ela não há % assistido.') : novoV ? A.nml('Vídeo novo: o YouTube só entrega o % assistido depois de fechar o dia, então com menos de 3 dias de vida ainda não há valor.') : A.nml('Nenhuma view nos 28 dias: sem views não há % assistido.')) + ajuda + '</section>';
    var p = v.pct.p, medC = A.mediana(outros.filter(function(x){ return x.pct; }).map(function(x){ return x.pct.p; })), pouco = v.pct.n < 10;
    var fr = 'Quem assiste vê em média <b' + (pouco ? ' class="as-num pouco"' : '') + '>' + A.pct(p, 0) + '</b> do vídeo (' + A.dur(p * v.dur) + ' de ' + A.dur(v.dur) + ').' + (pouco ? ' São só ' + v.pct.n + (v.pct.n === 1 ? ' view' : ' views') + ': cada pessoa muda o resultado e não dá para comparar com o normal do canal.' : ' Baseado em ' + A.n(v.pct.n) + ' views.');
    var mostraMed = medC != null && !pouco;
    return cab + '<div class="as"><p class="fr">' + fr + '</p><div class="as-barra' + (pouco ? ' pouco' : '') + '" role="img" aria-label="' + A.pct(p, 0) + ' do vídeo assistido em média' + (pouco ? ', com poucas views' : '') + '"><i style="width:' + Math.round(p * 100) + '%"></i>' + (mostraMed ? '<s style="left:' + Math.round(medC * 100) + '%"></s>' : '') + '</div>' +
      '<div class="as-tk"><span>0:00</span><span>' + A.dur(v.dur / 2) + '</span><span>' + A.dur(v.dur) + '</span></div>' +
      (mostraMed ? '<div class="as-med" aria-hidden="true"><span style="left:' + Math.round(medC * 100) + '%">mediana do canal: ' + A.pct(medC, 0) + '</span></div><p class="nt" style="margin:0;font-size:12.5px;color:var(--muted)">' + (Math.abs(p - medC) < .03 ? 'Perto do normal do canal.' : p > medC ? 'Acima do normal do canal (' + A.pct(medC, 0) + ').' : 'Abaixo do normal do canal (' + A.pct(medC, 0) + ').') + '</p>' : '') + '</div>' + ajuda + '</section>';
  }
  function curvaInfo(){
    var pts = v.curva, n = pts.length, dur = v.dur, meio = null; for (var i = 0; i < n; i++) if (pts[i] < .5) { meio = i / (n - 1); break; }
    var saidas = [], tmp = []; for (var j = 0; j + 5 < n; j++) tmp.push([pts[j] - pts[j + 5], j]);
    tmp.sort(function(a, b){ return b[0] - a[0]; }); tmp.forEach(function(t){ if (saidas.length < 2 && saidas.every(function(s){ return Math.abs(s[1] - t[1]) > 12; })) saidas.push(t); });
    saidas.sort(function(a, b){ return a[1] - b[1]; });
    return { meio: meio, saidas: saidas, dur: dur };
  }
  function secRetencao(){
    var cab = '<section class="sec" aria-labelledby="hRt"><h2 id="hRt">Retenção ' + A.ibtn('infoRt', 'De onde vem a curva', true) + '</h2>';
    var ajuda = A.oculto('infoRt', 'De onde vem a curva', '<ul><li><b>Curva:</b> a parte do público que ainda está assistindo em cada ponto do vídeo, da publicação até a coleta. Vem de uma consulta do YouTube Analytics por posição no vídeo.</li><li><b>Janela:</b> a curva é da vida inteira do vídeo; o % assistido acima é dos últimos dias. As janelas são diferentes.</li><li><b>Acima de 100%:</b> trecho que muita gente voltou para rever.</li></ul>');
    if (!M.exemplo || novoV || semDado) return cab + '<div class="dep"><div class="nml">' + A.nm() + '<p><b>Ainda não coletamos esta curva.</b> Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam.</p></div></div>' + ajuda + '</section>';
    var ci = curvaInfo(), rea = [[.355, .405], [.6, .64]];
    return cab + '<p class="exband"><span class="ex">exemplo</span> A curva e os números desta seção são de exemplo.</p>' +
      '<p class="lead">' + (ci.meio != null ? 'Metade das pessoas já saiu aos <b>' + A.dur(ci.meio * v.dur) + '</b> (' + Math.round(ci.meio * 100) + '% do vídeo).' : 'Mais da metade das pessoas ficou até o fim.') + '</p>' +
      '<div id="curv"></div><ul class="saidas"><li><b>Maiores saídas:</b> ' + ci.saidas.map(function(s){ return A.dur(s[1] / 99 * v.dur) + ' a ' + A.dur((s[1] + 5) / 99 * v.dur) + ', de ' + Math.round(v.curva[s[1]] * 100) + '% para ' + Math.round(v.curva[s[1] + 5] * 100) + '%'; }).join('; ') + '.</li><li><b>Trechos revistos:</b> ' + rea.map(function(r){ return A.dur(r[0] * v.dur) + ' a ' + A.dur(r[1] * v.dur); }).join('; ') + '.</li></ul><p class="alerta">' + A.INFO + ' Curva da vida inteira do vídeo, coletada em ' + A.dm(M.hoje) + '. O % assistido da seção anterior é dos últimos dias.</p>' + ajuda + '</section>';
  }
  function linhaRegua(rot, sub, val, lista, minha, texto, aviso){
    var ok = lista.filter(function(x){ return x != null; });
    var cab = '<div class="rgl"><div class="nmx">' + rot + '<small>' + sub + '</small></div>';
    if (minha == null) return cab + '<div>' + A.nm() + '</div><div class="rgw mut" style="font-size:13px">' + texto + '</div><div class="pos"></div></div>';
    if (aviso) return cab + '<div class="num mut">' + val + '</div><div class="rgw mut" style="font-size:13px">' + aviso + '</div><div class="pos"></div></div>';
    if (ok.length < 3) return cab + '<div class="num">' + val + '</div><div class="rgw mut" style="font-size:13px">poucos vídeos para comparar (' + ok.length + '; precisa de 3)</div><div class="pos"></div></div>';
    var maiores = ok.filter(function(x){ return x > minha; }).length + 1, iguais = ok.filter(function(x){ return x === minha; }).length;
    return cab + '<div class="num">' + val + '</div><div class="rgw">' + A.regua(lista, minha) + '<div class="rg-ends" aria-hidden="true"><span>menos</span><span>mais</span></div></div><div class="pos">' + maiores + 'º de ' + (ok.length + 1) + (iguais ? '<br>empate com ' + iguais : '') + '</div></div>';
  }
  function secCanal(){
    if (semDado || novoV) return '<section class="sec" aria-labelledby="hNo"><h2 id="hNo">Este vídeo no canal</h2>' + A.nml(novoV ? 'Vídeo novo: ainda não há leitura diária para posicionar este vídeo entre os outros em views por dia nem em % assistido.' : 'Sem a leitura diária não há como posicionar este vídeo entre os outros em views por dia nem em % assistido.') + '</section>';
    var fracoVpd = v.views28 != null && v.views28 < 10, abaixo1 = outros.filter(function(x){ return x.vpd == null || x.vpd < 1; }).length;
    var avisoVpd = fracoVpd ? 'Com ' + v.views28 + (v.views28 === 1 ? ' view' : ' views') + ' em 28 dias não dá para posicionar este vídeo: ' + abaixo1 + ' dos ' + outros.length + ' outros também ficam abaixo de 1 view por dia.' : null;
    var avisoPct = v.pct && v.pct.n < 10 ? 'Com só ' + v.pct.n + (v.pct.n === 1 ? ' view' : ' views') + ' não dá para posicionar o % assistido.' : null;
    return '<section class="sec" aria-labelledby="hNo"><h2 id="hNo">Este vídeo no canal</h2><p class="meta">Cada traço é um vídeo do canal; o traço grosso é este; o triângulo é a mediana.</p>' +
      linhaRegua('Views por dia', 'média dos últimos 28 dias', v.vpd == null ? null : (v.vpd === 0 ? '0' : A.dec(v.vpd, v.vpd < 10 ? 1 : 0)), outros.map(function(x){ return x.vpd; }), v.vpd, 'sem 7 dias de medida', avisoVpd) +
      linhaRegua('% assistido', 'média pelas views, 28 dias', v.pct ? A.pct(v.pct.p, 0) : null, outros.map(function(x){ return x.pct ? x.pct.p : null; }), v.pct ? v.pct.p : null, 'sem views nos 28 dias', avisoPct) + '</section>';
  }

  var barra = { linhas: [{ rotulo: 'Estado', itens: CASOS.map(function(c){ return { t: c[1], href: A.href({ caso: c[0] === 'cheio' ? null : c[0] }), atual: caso === c[0] }; }) }, A.tema()],
    nota: '<b>Cheio</b> e <b>vídeo novo</b>: exemplo. <b>Magro</b>: o vídeo real “O Que Esperar Do MBK Center” (118 views, 18 impressões, 2 cliques estimados); o diário de views e o % assistido são exemplo. <b>Retenção</b>: a curva só existe no caso cheio, como exemplo; o resto depende de coleta nova.' };
  A.moldura({ titulo: 'Vídeo próprio: ' + v.t, barra: barra,
    corpo: A.migalha([['Canais', 'index.html'], [M.nome, 'canal.html?caso=' + (base === 'novo' ? 'cheio' : base)], ['Vídeo']]) + pager() + cabecalho() + secViews() + secImp() + secAssistido() + secRetencao() + secCanal() +
      '' });
  A.ligarInfos();

  if (vd) {
    var c = D.resumoImp(vd.map(function(d){ return { d: d.d, v: d.v, e: d.e, cl: 0 }; }));
    A.serieDia(document.getElementById('gVw'), { id: 'gvv', semTitulo: true, titulo: 'Views do vídeo, dia a dia', frase: fraseViews(), meta: 'de ' + A.dm(vd[0].d) + ' a ' + A.dm(vd[vd.length - 1].d) + ' · ' + vd.length + ' dias · dia do YouTube', dias: vd, um: ['view', 'views'], pub: v.pub,
      legBarra: 'views do dia', legZero: 'zero medido: ninguém viu neste dia', legNm: 'não medido: o YouTube não entregou o dia',
      fala: function(d){ return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'o YouTube não entregou este dia (não medido)' : d.v === 0 ? 'nenhuma view (zero medido)' : A.n(d.v) + (d.v === 1 ? ' view' : ' views')); },
      ajuda: '<p>Cada coluna é um dia do YouTube (fecha no horário do Pacífico), com 2 a 3 dias de atraso. <b>Caixa vazada</b>: o dia veio e ninguém viu o vídeo. <b>Hachura</b>: o dia não veio; não é zero.</p><p>Use os botões abaixo do gráfico para ler um dia de cada vez.</p>' });
  }
  if (impS) {
    var ri = RI;
    A.serieDia(document.getElementById('gIm'), { id: 'gim', semTitulo: true, titulo: 'Impressões e cliques por dia', frase: (ri.imp ? A.n(ri.imp) + (ri.imp === 1 ? ' impressão' : ' impressões') + ' e ' + (ri.clR === 1 ? '1 clique estimado' : A.n(ri.clR) + ' cliques estimados') + ' em ' + impS.length + ' dias: ' + ri.com + ' dias com impressão, ' + ri.zero + ' medidos em zero e ' + ri.nm + ' não medidos.' : 'Nenhuma impressão em ' + impS.length + ' dias.') + (ri.imp < 100 ? ' É pouco para dizer se a capa funciona: leia como contagem.' : ''),
      meta: 'de ' + A.dm(impS[0].d) + ' a ' + A.dm(impS[impS.length - 1].d) + ' · dia do YouTube', dias: impS, um: ['impressão', 'impressões'], cliques: true, pub: v.pub, legBarra: 'impressões do dia', legZero: 'zero medido: o YouTube enviou o dia sem impressões deste vídeo', legNm: 'não medido: o dia ainda não chegou',
      fala: function(d){ var cl = d.cl; return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'o dia ainda não chegou (não medido)' : d.e === 'zero' ? 'o YouTube enviou o dia sem impressões deste vídeo (zero medido)' : A.n(d.v) + (d.v === 1 ? ' impressão, ' : ' impressões, ') + (cl < 1 ? 'menos de 1 clique estimado' : Math.round(cl) === 1 ? '1 clique estimado' : A.n(Math.round(cl)) + ' cliques estimados')); } });
    var cv = document.getElementById('ctrV'); if (cv && RI.imp) A.faixaTaxa(cv, { cliques: RI.clR, imp: RI.imp, ref: wc ? { cliques: canalImp.clR, imp: canalImp.imp } : null, alt: 'Taxa de clique do vídeo ' + A.pct(RI.cl / RI.imp, 1) + ', de ' + A.pct(w[0], 1) + ' a ' + A.pct(w[1], 1) + '; do canal, de ' + (wc ? A.pct(wc[0], 1) + ' a ' + A.pct(wc[1], 1) : '') });
  }
  var cvh = document.getElementById('curv'); if (cvh) A.curva(cvh, { pts: v.curva, dur: v.dur, meio: curvaInfo().meio, saidas: curvaInfo().saidas.map(function(s){ return s[1]; }), rea: [[.355 * 99, .405 * 99], [.6 * 99, .64 * 99]].map(function(r){ return [Math.round(r[0]), Math.round(r[1])]; }), alt: 'Curva de retenção de exemplo: de 100% no início, metade do público sai aos ' + A.dur(curvaInfo().meio * v.dur) });
})();
