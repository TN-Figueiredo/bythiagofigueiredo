/* a.js: mockup A, "ainda cedo". A tela do VÍDEO próprio (a de video.html, aprovada em 12/10) com o estado novo no bloco de impressões.
   ?caso=17h|2d|3d-zeros|4d-zeros|4d-numeros|5d-zeros|6d-zeros|7d-zeros|7d|sem-dado  ?tema=claro
   Tudo é exemplo (vídeo inventado, mesmo canal). A regra (rodada 2): o dia da publicação é o dia 1 e a faixa tem 7 casas (dia 1 a dia 7). Menos de 3 dias de idade = "vídeo novo";
   de 3 a 5 dias com todos os dias medidos em zero = "ainda cedo" (faixa, sem gráfico); com algum número, ou no dia 7 (6 dias depois da publicação) em diante, o gráfico aparece.
   Assim a 7ª casa da faixa é o dia em que o gráfico volta, e "faltam N dias" = casas que ainda estão pontilhadas depois de hoje, contando a 7ª.
   Hoje e ontem são sempre "não medido" (o relatório do YouTube chega com 2 a 3 dias de atraso); dia antes da publicação não existe. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, q = A.q, esc = A.esc;
  var caso = q.get('caso') || '4d-zeros';
  var T = 'Quanto custa uma semana em Hanói?', DUR = 886;
  /* idade = dias de calendário desde o dia da publicação até hoje; imp = impressões dos dias JÁ medidos (do dia da publicação em diante); vd = views por dia */
  var C = {
    '17h':        { idade: 1, horas: '17 horas', views: 38, likes: 3, com: 0, imp: [], vd: [] },
    '2d':         { idade: 2, views: 214, likes: 9, com: 1, imp: [], vd: [] },
    '3d-zeros':   { idade: 3, views: 301, likes: 14, com: 2, imp: [0, 0], vd: [70, 140] },
    '4d-zeros':   { idade: 4, views: 412, likes: 22, com: 3, imp: [0, 0, 0], vd: [60, 150, 110] },
    '4d-numeros': { idade: 4, views: 412, likes: 22, com: 3, imp: [0, 40, 69], vd: [60, 150, 110] },
    '5d-zeros':   { idade: 5, views: 505, likes: 27, com: 3, imp: [0, 0, 0, 0], vd: [60, 150, 110, 90] },
    '6d-zeros':   { idade: 6, views: 598, likes: 31, com: 4, imp: [0, 0, 0, 0, 0], vd: [60, 150, 110, 90, 80] },
    '7d-zeros':   { idade: 7, views: 640, likes: 33, com: 4, imp: [0, 0, 0, 0, 0, 0], vd: [60, 150, 110, 90, 80, 70] },
    '7d':         { idade: 7, views: 1180, likes: 58, com: 7, imp: [0, 40, 69, 120, 98, 81], vd: [90, 260, 210, 190, 160, 140] },
    'sem-dado':   { idade: 4, views: 412, likes: 22, com: 3, imp: null, vd: null }
  };
  var c = C[caso] || C['4d-zeros'], idade = c.idade, pub = A.addDias(L.HOJE, -idade);
  var novoV = idade < 3, semDado = c.imp === null;
  var impDias = [], vdDias = [];
  if (!novoV && !semDado) {
    for (var k = 0; k <= idade; k++) {
      var d = A.addDias(pub, k);
      if (k < c.imp.length) { impDias.push(c.imp[k] === 0 ? { d: d, v: 0, e: 'zero', cl: 0 } : { d: d, v: c.imp[k], e: 'com', cl: Math.round(c.imp[k] * 5) / 100 }); vdDias.push(c.vd[k] === 0 ? { d: d, v: 0, e: 'zero' } : { d: d, v: c.vd[k], e: 'com' }); }
      else { impDias.push({ d: d, v: null, e: 'nm' }); vdDias.push({ d: d, v: null, e: 'nm' }); }
    }
  }
  var medidos = novoV || semDado ? 0 : c.imp.length, totalImp = (c.imp || []).reduce(function(a, x){ return a + x; }, 0), algumNumero = totalImp > 0;
  /* a regra do estado novo, num lugar só */
  var ainda = !novoV && !semDado && idade < 6 && !algumNumero;
  var faltam = 6 - idade, ret = A.addDias(pub, 6); /* a 7ª casa: o dia em que o gráfico volta */

  /* ---------------------------------------------------------------- cabeçalho */
  var eng = (c.likes + c.com) / c.views;
  var cab = L.videoCab({ t: T, pub: pub, idadeTxt: c.horas || null, dur: DUR, views: c.views, likes: c.likes, com: c.com, eng: eng, normal: idade >= 6 ? 1.6 : null, normalSub: 'mediana dos outros vídeos: 740 views', normalMotivo: 'com poucos dias ainda não dá para comparar' });

  /* ---------------------------------------------------------------- a faixa dos 7 dias */
  function faixa(){
    var casas = '';
    for (var k = 0; k < 7; k++) {
      var d = A.addDias(pub, k), cls, txt, lbl;
      if (!novoV && !semDado && k < c.imp.length) { var v = c.imp[k]; cls = v === 0 ? 'zero' : 'com'; txt = A.n(v); lbl = v === 0 ? 'zero medido: o YouTube mandou o dia e não houve impressão' : A.n(v) + ' impressões'; }
      else if (k <= idade) { cls = 'nm'; txt = k === idade ? 'hoje' : k === idade - 1 ? 'ontem' : 'não medido'; lbl = 'não medido: o dia ainda não chegou' + (k === idade ? ' (hoje)' : k === idade - 1 ? ' (ontem)' : ''); }
      else { cls = 'fut'; txt = ''; lbl = k === 6 ? 'ainda não existe; neste dia o gráfico volta' : 'ainda não existe'; }
      casas += '<li class="ac-d"><span class="ac-c ' + cls + '" role="img" aria-label="' + esc(A.ds(d) + ': ' + lbl) + '">' + esc(txt) + '</span><span class="ac-n">dia ' + (k + 1) + '</span><span class="ac-dt">' + A.dm(d) + '</span></li>';
    }
    var fT = faltam === 1 ? 'falta 1 dia, amanhã' : 'faltam ' + faltam + ' dias';
    var quando = 'O gráfico volta no primeiro dia com impressão ou em ' + A.dm(ret) + ' (' + fT + '), a última casa da faixa.';
    var fr = novoV
      ? '<b>Vídeo novo.</b> Publicado há ' + (c.horas || idade + ' dias') + '. O YouTube entrega as impressões de cada dia 2 a 3 dias depois. ' + quando
      : '<b>Ainda cedo para ler as impressões.</b> ' + L.pl(medidos, 'dia medido', 'dias medidos') + ', ' + (medidos === 1 ? 'com 0' : 'todos com 0') + '; o vídeo já teve ' + A.n(c.views) + ' views, o relatório de alcance é que chega atrasado. ' + quando;
    return '<div class="ac"><p class="ac-fr">' + fr + '</p><ol class="ac-faixa" aria-label="Os 7 primeiros dias do vídeo, um por casa">' + casas + '</ol>' +
      '<ul class="ac-leg" aria-label="Legenda da faixa"><li><i class="ac-sw zero" aria-hidden="true"></i>zero medido: o dia chegou e não houve impressão</li><li><i class="ac-sw com" aria-hidden="true"></i>com impressões</li><li><i class="nm-h" aria-hidden="true"></i>não medido: o dia ainda não chegou</li><li><i class="ac-sw fut" aria-hidden="true"></i>ainda não existe</li></ul></div>';
  }
  var AJUDA_IMP = A.oculto('infoIm', 'Por que ainda não há gráfico', '<ul><li><b>O relatório chega atrasado:</b> o YouTube entrega as impressões de cada dia 2 a 3 dias depois. Hoje e ontem nunca estão medidos.</li><li><b>Os 0 são do que já chegou:</b> nos primeiros dias o YouTube costuma mandar o dia ainda sem impressão. Isso não quer dizer que ninguém viu o vídeo.</li><li><b>Quando o gráfico volta:</b> no primeiro dia medido com impressão, ou no dia 7 (o dia da publicação conta como dia 1, então é 6 dias depois), o que vier primeiro. No dia 7, se ainda for tudo 0, o gráfico mostra o 0 como zero medido, sem inventar escala.</li></ul>');

  /* ---------------------------------------------------------------- seções */
  function secViews(){
    var cab = '<section class="sec" aria-labelledby="hVw"><h2 id="hVw">Views por dia</h2><div id="gVw">';
    if (semDado) return cab + A.nml('A coleta diária de views ainda não rodou para este canal. Nenhum dia é zero: falta medir.') + '</div></section>';
    if (novoV) return cab + A.nml('Vídeo novo: o YouTube entrega as views de cada dia com 2 a 3 dias de atraso, então com menos de 3 dias de vida ainda não há dia fechado.') + '</div></section>';
    return cab + '</div></section>';
  }
  function secImp(){
    var h = '<section class="sec" aria-labelledby="hIm"><h2 id="hIm">Impressões e cliques ' + A.ibtn('infoIm', 'Por que ainda não há gráfico', true) + '</h2>';
    if (semDado) return h + A.nml('Os números de alcance deste canal ainda não chegaram: impressões e cliques deste vídeo aparecem quando chegarem. Nenhum deles é zero.') + AJUDA_IMP + '</section>';
    if (novoV || ainda) return h + L.novo(faixa(), 'novo', 'ac-novo') + AJUDA_IMP + '</section>';
    return h + '<div id="gIm"></div>' + AJUDA_IMP + '</section>';
  }

  var CASOS = [['17h', '17 horas'], ['2d', '2 dias'], ['3d-zeros', '3 dias, só zeros'], ['4d-zeros', '4 dias, só zeros'], ['4d-numeros', '4 dias, com número'], ['5d-zeros', '5 dias, só zeros (falta 1)'], ['6d-zeros', 'Dia 7, só zeros'], ['7d-zeros', '8º dia, só zeros'], ['7d', '8º dia, com números'], ['sem-dado', 'Coleta não rodou']];
  var barra = L.barra([{ rotulo: 'Idade e dado', param: 'caso', itens: CASOS, padrao: '4d-zeros' }],
    'Vídeo inventado (exemplo) no canal tnFigueiredo. A tela é a do vídeo próprio já aprovada; só o bloco “Impressões e cliques” muda (contorno verde-água e “+ novo”). Os blocos de baixo da tela (trocas, % assistido, retenção, posição no canal) não mudam e não foram redesenhados.');
  var regra = '<table class="tb" style="max-width:760px"><caption>A regra, numa tabela (o dia da publicação é o dia 1)</caption><thead><tr><th scope="col">Idade do vídeo</th><th scope="col">Dados medidos</th><th scope="col">O bloco de impressões mostra</th></tr></thead><tbody>' +
    '<tr><th scope="row">menos de 3 dias</th><td>nenhum</td><td>Vídeo novo: a faixa dos 7 dias, sem gráfico</td></tr>' +
    '<tr><th scope="row">3 a 5 dias</th><td>todos os dias medidos são 0</td><td><b>Ainda cedo: a faixa, sem gráfico</b></td></tr>' +
    '<tr><th scope="row">3 a 5 dias</th><td>algum dia com número</td><td>o gráfico por dia, como hoje</td></tr>' +
    '<tr><th scope="row">6 dias ou mais (dia 7 em diante)</th><td>qualquer um</td><td>o gráfico; se tudo for 0, a frase diz “nenhuma impressão” e os 0 aparecem como zero medido, sem escala inventada</td></tr>' +
    '<tr><th scope="row">qualquer idade</th><td>a coleta não rodou</td><td>“não medido” com o motivo (não é 0)</td></tr></tbody></table>';
  A.moldura({ titulo: 'Vídeo próprio: ainda cedo', barra: barra,
    corpo: A.migalha([['Canais', '#'], ['tnFigueiredo', '#'], ['Vídeo']]) + L.pager(36) + cab + secViews() + secImp(),
    fora: regra + '<p class="nota" style="margin-top:10px">Ligados a este estado: o 0 dentro de uma casa é <b>zero medido</b> (o YouTube mandou o dia); a hachura rosa é <b>não medido</b> (o dia não chegou). As duas formas nunca se confundem: uma é caixa vazada com número, a outra é hachura com a palavra.</p>' });
  A.ligarInfos();

  /* os gráficos da tela de hoje, nos casos em que o gráfico aparece */
  var gV = document.getElementById('gVw');
  if (gV && vdDias.length) {
    var tv = vdDias.reduce(function(a, d){ return a + (d.v || 0); }, 0), dm = vdDias.filter(function(d){ return d.e !== 'nm'; }).length;
    A.serieDia(gV, { id: 'gvv', semTitulo: true, titulo: 'Views do vídeo, dia a dia', frase: '<b>' + A.n(tv) + ' views</b> em ' + dm + ' dias medidos (' + A.dec(tv / dm, 0) + ' por dia). ' + L.pl(vdDias.length - dm, 'dia não medido', 'dias não medidos') + '.',
      meta: 'de ' + A.dm(vdDias[0].d) + ' a ' + A.dm(vdDias[vdDias.length - 1].d) + ' · dia do YouTube', dias: vdDias, um: ['view', 'views'], pub: pub, bordaFinal: true,
      legBarra: 'views do dia', legZero: 'zero medido: ninguém viu neste dia', legNm: 'não medido: o YouTube não entregou o dia',
      fala: function(d){ return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'o YouTube não entregou este dia (não medido)' : d.v === 0 ? 'nenhuma view (zero medido)' : A.n(d.v) + (d.v === 1 ? ' view' : ' views')); } });
  }
  var gI = document.getElementById('gIm');
  if (gI) {
    var nCom = impDias.filter(function(d){ return d.e === 'com'; }).length, med = impDias.filter(function(d){ return d.e !== 'nm'; }).length, nnm = impDias.length - med;
    var cl = Math.round(impDias.reduce(function(a, d){ return a + (d.cl || 0); }, 0));
    var fr = totalImp ? '<b>' + A.n(totalImp) + ' impressões</b> e ' + (cl === 1 ? '1 clique estimado' : A.n(cl) + ' cliques estimados') + ' em ' + L.pl(med, 'dia medido', 'dias medidos') + '. ' + L.pl(nnm, 'dia não medido', 'dias não medidos') + ' (ontem e hoje).'
      : '<b>Nenhuma impressão nos ' + med + ' dias medidos</b>, mas o vídeo teve ' + A.n(c.views) + ' views. O relatório de alcance do YouTube pode estar incompleto: os 0 são o que ele mandou. Ontem e hoje ainda não chegaram.';
    A.serieDia(gI, { id: 'gim', semTitulo: true, titulo: 'Impressões e cliques por dia', frase: fr, meta: 'de ' + A.dm(impDias[0].d) + ' a ' + A.dm(impDias[impDias.length - 1].d) + ' · dia do YouTube', dias: impDias, um: ['impressão', 'impressões'], pub: pub,
      folgaNum: 2, escalonar: true, bordaFinal: true, legBarra: 'impressões do dia', cliques: totalImp > 0, soZeros: totalImp === 0,
      fala: function(d){ return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'o dia ainda não chegou (não medido)' : d.e === 'zero' ? 'o YouTube enviou o dia sem impressões deste vídeo (zero medido)' : A.n(d.v) + (d.v === 1 ? ' impressão' : ' impressões')); } });
  }
})();
