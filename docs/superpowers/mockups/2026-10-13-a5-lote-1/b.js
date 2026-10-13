/* b.js: mockup B, "% assistido comparado com os últimos X dias". Duas telas: ?tela=video (padrão) e ?tela=canal (aba Retenção do canal).
   ?caso=cheio|piora|poucos|sem-dado  ?periodo=inteiro|90|28 (sem o parâmetro vale o que ficou lembrado neste navegador)  ?tema=claro
   RODADA 2 (decisão do dono, 12/10): "últimos X dias" = o que foi ASSISTIDO nos últimos X dias, em todos os vídeos do canal (o dado existe por vídeo e por dia).
   A conta é a mesma nos três e é a da tela aprovada: mediana, por vídeo, do % assistido (no canal inteiro, de cada vídeo; nos períodos, só do que foi assistido na janela). Mínimo para comparar: 1.000 views no período.
   Toda diferença em pontos é calculada sobre os valores ARREDONDADOS que aparecem na tela (o dono confere de cabeça). Tudo é exemplo. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, q = A.q, esc = A.esc;
  var caso = q.get('caso') || 'cheio', tela = q.get('tela') === 'canal' ? 'canal' : 'video', MIN = 1000, NA_MEDIA = 2;
  var periodo = q.get('periodo') || L.lembrar.ler('periodo') || 'inteiro';
  if (['inteiro', '90', '28'].indexOf(periodo) < 0) periodo = 'inteiro';
  var semDado = caso === 'sem-dado';
  var FIM = A.addDias(L.HOJE, -2); /* hoje e ontem ainda não chegaram */
  var P = { inteiro: { nome: 'canal inteiro', de: 'do canal inteiro', rot: 'Canal inteiro', curto: 'Inteiro', desde: '2026-04-16', fator: 5.2 },
    '90': { nome: 'últimos 90 dias', de: 'dos últimos 90 dias', rot: 'Últimos 90 dias', curto: '90 dias', desde: A.addDias(FIM, -89), fator: 2.6 },
    '28': { nome: 'últimos 28 dias', de: 'dos últimos 28 dias', rot: 'Últimos 28 dias', curto: '28 dias', desde: A.addDias(FIM, -27), fator: 1 } };

  /* os números de exemplo: [% assistido, views no período] por período e por faixa de duração (Até 5 min, 5 a 15 min, Acima de 15 min) */
  var DADOS = {
    cheio:  { feat: .54, faixa: { inteiro: [[.520, 124000], [.474, 185000], [.410, 103000]], '90': [[.554, 56000], [.526, 85000], [.432, 47000]], '28': [[.562, 18000], [.541, 27000], [.444, 15000]] },
      todo: { inteiro: [.4720, 412000], '90': [.5110, 188000], '28': [.5230, 60000] } },
    piora:  { feat: .46, faixa: { inteiro: [[.540, 114000], [.490, 171000], [.440, 95000]], '90': [[.510, 45000], [.460, 68000], [.410, 37000]], '28': [[.480, 16000], [.430, 23000], [.380, 13000]] },
      todo: { inteiro: [.4925, 380000], '90': [.4625, 150000], '28': [.4325, 52000] } },
    poucos: { feat: .52, faixa: { inteiro: [[.520, 89000], [.480, 133000], [.420, 74000]], '90': [[.530, 12000], [.490, 18000], [.430, 11000]], '28': [[.50, 100], [.46, 160], [.41, 80]] },
      todo: { inteiro: [.4770, 296000], '90': [.4870, 41000], '28': [.4700, 340] } },
    'sem-dado': { feat: null, faixa: { inteiro: [[0, 0], [0, 0], [0, 0]], '90': [[0, 0], [0, 0], [0, 0]], '28': [[0, 0], [0, 0], [0, 0]] }, todo: { inteiro: [0, 0], '90': [0, 0], '28': [0, 0] } }
  };
  var D = DADOS[caso] || DADOS.cheio;
  function mkN(par){ var v = par[1], ok = v >= MIN && !semDado; return { raw: par[0], r: ok ? Math.round(par[0] * 100) : null, views: v, ok: ok }; }
  var NO = {}, NF = {}; ['inteiro', '90', '28'].forEach(function(k){ NO[k] = mkN(D.todo[k]); NF[k] = D.faixa[k].map(mkN); });
  var FAIXAS = ['Até 5 min', '5 a 15 min', 'Acima de 15 min'];
  var FEAT = { t: 'Hanói em 7 dias: o custo real, dia a dia', pub: A.addDias(L.HOJE, -12), dur: 1022, views: 3214, likes: 187, com: 23, n: 3214, pct: D.feat };
  var NA_R = FEAT.pct == null ? null : Math.round(FEAT.pct * 100);
  function dif(a, b){ return a - b; } /* sempre sobre os inteiros mostrados */
  function dir(d){ return Math.abs(d) <= NA_MEDIA ? 'eq' : d > 0 ? 'up' : 'dn'; }
  var SIM = { up: '▲', dn: '▼', eq: '＝' };
  function sinal(d){ return d === 0 ? '0' : (d > 0 ? '+' : '−') + Math.abs(d); }
  function pts(d){ return Math.abs(d) === 1 ? 'ponto' : 'pontos'; }
  function chipDir(d){ var k = dir(d); return '<span class="cmp ' + k + '"><span class="pt">' + SIM[k] + ' ' + sinal(d) + '</span></span>'; }
  function milV(x){ return x >= 1000 ? Math.round(x / 1000) + ' mil' : A.n(x); }

  /* os vídeos da lista da aba Retenção (exemplo; o % de cada um muda com o período) */
  var r = A.rnd(2026101301), V = [];
  var NOMES = ['Quanto custa uma semana em Hanói?', 'Trem noturno Bangkok a Chiang Mai', 'O mercado flutuante que ninguém te conta', 'Moto em Phuket: o que o seguro não cobre', 'Ilhas da Tailândia fora da temporada', 'Visto para o Vietnã em 2026', 'Comi só street food por 48 horas', 'Hostel ou hotel: a conta real de 30 dias'];
  var FX = [180, 420, 780, 1230];
  NOMES.forEach(function(t, i){
    var dur = Math.round(FX[Math.floor(r() * 4)] * (0.8 + r() * .4)), fi = dur <= 300 ? 0 : dur <= 900 ? 1 : 2, v = { t: t, dur: dur, fi: fi, views28: Math.round(2400 * Math.exp(-i * .06) * (0.7 + r() * .6)), pct: {} };
    ['inteiro', '90', '28'].forEach(function(k){ v.pct[k] = Math.min(.95, Math.max(.2, D.faixa[k][fi][0] + (r() - .5) * .12)); });
    V.push(v);
  });

  /* o controle: três cartões que são ao mesmo tempo seletor, valor e tendência */
  function cartoes(){
    var html = ['inteiro', '90', '28'].map(function(k){
      var no = NO[k], ativo = k === periodo, href = A.href({ periodo: k === 'inteiro' ? null : k });
      var corpo;
      if (semDado) corpo = '<span class="pe-v">' + A.nm('sem dado') + '</span><span class="pe-s">sem % assistido</span>';
      else if (!no.ok) corpo = '<span class="pe-v">' + A.nm('poucas views') + '</span><span class="pe-s">' + A.n(no.views) + ' de ' + A.n(MIN) + ' views</span>';
      else if (k !== 'inteiro' && NO.inteiro.ok) corpo = '<span class="pe-v"><b class="num">' + no.r + '%</b> ' + chipDir(dif(no.r, NO.inteiro.r)) + '</span><span class="pe-s">' + milV(no.views) + ' views</span>';
      else corpo = '<span class="pe-v"><b class="num">' + no.r + '%</b></span><span class="pe-s">' + milV(no.views) + ' views</span>';
      return '<a class="pe-c' + (ativo ? ' on' : '') + (!no.ok ? ' sem' : '') + '" href="' + href + '" data-periodo="' + k + '"' + (ativo ? ' aria-current="true"' : '') + '><span class="pe-t"><span class="l">' + P[k].rot + '</span><span class="s">' + P[k].curto + '</span></span>' + corpo + '</a>';
    }).join('');
    return '<div class="pe" role="group" aria-label="Comparar o % assistido com"><p class="pe-lab" id="peLab">Comparar com o que foi assistido: ' + A.ibtn('infoPe', 'Como o período é contado', true) + '</p><div class="pe-cs" aria-labelledby="peLab">' + html + '</div>' +
      '<p class="pe-leg"><span class="cmp up"><span class="pt">▲</span></span><span class="cmp dn"><span class="pt">▼</span></span><span class="cmp eq"><span class="pt">＝</span></span>contra o canal inteiro</p>' +
      (periodo === 'inteiro' ? '' : '<p class="pe-lem"><span class="pe-ok">' + L.IC.ok + '</span>Salvo neste navegador · <a class="lk" href="' + A.href({ periodo: null }) + '" data-periodo="inteiro">Voltar ao padrão (canal inteiro)</a></p>') + '</div>' +
      A.oculto('infoPe', 'Como o período é contado', '<ul><li><b>Últimos 90 dias:</b> o que as pessoas assistiram de ' + A.dm(P['90'].desde) + ' a ' + A.dm(FIM) + ', em todos os outros vídeos do canal, publicados quando for. Para cada vídeo, vale só o % assistido dentro dessa janela; o normal é a mediana desses vídeos (o vídeo do meio, não a média), com a mesma conta do canal inteiro.</li><li><b>Mínimo de ' + A.n(MIN) + ' views:</b> com menos, o número balança e a tela diz “poucas views”, em vez de comparar.</li><li><b>▲ ▼ ＝ nos cartões:</b> o período contra o canal inteiro, com a mesma conta (mediana por vídeo). Mostra se, nesse período, as pessoas assistiram mais ou menos dos vídeos do que no canal todo; não diz por quê. Até ' + NA_MEDIA + ' pontos é “＝”. A diferença é entre os números arredondados que você vê.</li><li><b>Salvo neste navegador:</b> a escolha vale também ' + (tela === 'video' ? 'na aba Retenção do canal' : 'na tela de cada vídeo') + '. Sem escolha, vale o canal inteiro.</li><li><b>Dado de exemplo.</b></li></ul>');
  }

  /* a tela do vídeo */
  function leitura(){
    var no = NO[periodo];
    if (semDado) return A.nml('A coleta diária ainda não rodou: sem ela não há % assistido, nem do vídeo nem do canal.');
    if (!no.ok) return '<p class="pe-fr"><span class="pe-sim" aria-hidden="true">—</span><span>Sem comparação com ' + P[periodo].nome.replace('últimos', 'os últimos') + ': o canal teve só ' + A.n(no.views) + ' views no período (precisa de ' + A.n(MIN) + '). <a class="lk" href="' + A.href({ periodo: null }) + '" data-periodo="inteiro">Ver contra o canal inteiro</a></span></p>';
    var d = dif(NA_R, no.r), k = dir(d);
    var palavra = k === 'up' ? 'Acima do normal ' : k === 'dn' ? 'Abaixo do normal ' : 'Na média ';
    return '<p class="pe-fr ' + k + '"><span class="pe-sim" aria-hidden="true">' + SIM[k] + '</span><span>' + palavra + P[periodo].de + ': <b class="num">' + NA_R + '%</b> contra <b class="num">' + no.r + '%</b> (' + (d === 0 ? 'igual' : sinal(d) + ' ' + pts(d)) + ').</span></p>';
  }
  function barra(){
    if (semDado) return '';
    var no = NO[periodo], tem = no.ok;
    return '<div class="as-barra" role="img" aria-label="' + NA_R + '% do vídeo assistido em média' + (tem ? '; assistido ' + P[periodo].de + ': ' + no.r + '%' : '') + '"><i style="width:' + NA_R + '%"></i>' + (tem ? '<s style="left:' + no.r + '%"></s>' : '') + '</div>' +
      '<div class="as-tk"><span>0:00</span><span>' + A.dur(FEAT.dur / 2) + '</span><span>' + A.dur(FEAT.dur) + '</span></div>' + (tem ? '<div class="as-med" aria-hidden="true"><span style="left:' + no.r + '%">normal ' + P[periodo].de + ': ' + no.r + '%</span></div>' : '');
  }
  function telaVideo(){
    var cab = L.videoCab({ t: FEAT.t, pub: FEAT.pub, dur: FEAT.dur, views: A.n(FEAT.views), likes: FEAT.likes, com: FEAT.com, eng: (FEAT.likes + FEAT.com) / FEAT.views, normal: 1.4, normalSub: 'mediana dos outros vídeos: 2,3 mil views' });
    var sec = '<section class="sec" aria-labelledby="hAs"><h2 id="hAs">Quanto do vídeo as pessoas assistem ' + A.ibtn('infoAs', 'De onde vem o % assistido', true) + '</h2>' +
      A.oculto('infoAs', 'De onde vem o % assistido', '<ul><li><b>% assistido:</b> do total de tempo de vídeo possível, quanto foi assistido, média dos dias medidos pesada pelas views (no máximo 28 dias).</li><li><b>O normal:</b> a mediana do % assistido dos outros vídeos do canal, no período escolhido (cada vídeo conta uma vez; nos períodos, só o que foi assistido na janela).</li></ul>') +
      (semDado ? A.nml('A coleta diária ainda não rodou: sem ela não há % assistido.') : '<div class="as"><p class="fr">Quem assiste vê em média <b>' + NA_R + '%</b> do vídeo (' + A.dur(FEAT.pct * FEAT.dur) + ' de ' + A.dur(FEAT.dur) + '). Baseado em ' + A.n(FEAT.n) + ' views.</p></div>') +
      L.novo(leitura() + barra() + cartoes(), 'novo', 'pe-novo') + '</section>';
    return A.migalha([['Canais', '#'], ['tnFigueiredo', '#'], ['Vídeo']]) + L.pager(36) + cab + sec;
  }

  /* a aba Retenção do canal */
  function cmpVid(v, f){
    if (!f.ok) return '<span class="mut">poucas views para comparar</span>';
    var d = dif(Math.round(v.pct[periodo] * 100), f.r), k = dir(d);
    return '<span class="cmp ' + k + '"><span class="pt">' + SIM[k] + ' ' + sinal(d) + '</span><span class="w">' + (k === 'eq' ? 'na média' : k === 'up' ? 'acima' : 'abaixo') + ' da faixa (' + f.r + '%)</span></span>';
  }
  function telaCanal(){
    var cab = '<div class="chead-l1"><h1 style="font:600 24px/1.2 var(--serif)">tnFigueiredo</h1><p class="l2" style="margin:4px 0 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;color:var(--muted);font-size:13px"><span class="chip own">seu canal</span><span class="ex">exemplo</span><span>1.160 inscritos · 80 vídeos longos</span></p></div>';
    var abas = '<nav class="ctabs" aria-label="Seções do canal"><ul>' + [['Vídeos', '<span class="n">80</span>', 0], ['Trocas', '', 0], ['Leitura', '', 0], ['Retenção', '', 1]].map(function(t){ return '<li><a href="#"' + (t[2] ? ' aria-current="page"' : '') + '>' + t[0] + ' ' + t[1] + '</a></li>'; }).join('') + '</ul></nav>';
    var lin = FAIXAS.map(function(nm, fi){
      var cels = ['inteiro', '90', '28'].map(function(k){
        var f = NF[k][fi], fi0 = NF.inteiro[fi];
        var corpo = semDado ? A.nm('sem dado') : f.ok ? '<b class="num">' + f.r + '%</b>' + (k !== 'inteiro' && fi0.ok ? ' ' + chipDir(dif(f.r, fi0.r)) : '') + '<span class="mut num pe-vw">' + milV(f.views) + ' views</span>' : A.nm('poucas views') + '<span class="mut pe-vw">' + A.n(f.views) + ' de ' + A.n(MIN) + '</span>';
        return '<td' + (k === periodo ? ' class="pe-col"' : '') + '>' + corpo + '</td>';
      }).join('');
      return '<tr><th scope="row">' + nm + '</th>' + cels + '</tr>';
    }).join('');
    var tab = '<div class="tbw"><table class="tb pe-tab"><caption class="sr">Normal de % assistido por faixa de duração e por período</caption><thead><tr><th scope="col">Faixa de duração</th>' + ['inteiro', '90', '28'].map(function(k){ return '<th scope="col"' + (k === periodo ? ' class="pe-col"' : '') + '>' + P[k].rot + '</th>'; }).join('') + '</tr></thead><tbody>' + lin + '</tbody></table></div>';
    var lista = '';
    if (!semDado) {
      var mini = function(v, f){ var p = Math.round(v.pct[periodo] * 100); return '<span class="mini" aria-hidden="true"><i style="width:' + p + '%"></i>' + (f.ok ? '<s style="left:' + f.r + '%"></s>' : '') + '</span><b class="num">' + p + '%</b>'; };
      var vp = function(v){ return A.n(Math.round(v.views28 * P[periodo].fator / 10) * 10); };
      lista = '<h3 class="h-sec">Vídeos mais assistidos, contra o normal da faixa (' + P[periodo].nome + ')</h3><div class="tbw rt"><table class="tb"><caption class="sr">Vídeos com % assistido no período, contra o normal da faixa e do período</caption><thead><tr><th scope="col">Vídeo</th><th scope="col">Faixa</th><th scope="col" class="r">Views no período</th><th scope="col">% assistido</th><th scope="col">Contra a faixa</th></tr></thead><tbody>' +
        V.map(function(v){ var f = NF[periodo][v.fi]; return '<tr><td>' + esc(v.t) + '</td><td>' + FAIXAS[v.fi] + '</td><td class="r num">' + vp(v) + '</td><td>' + mini(v, f) + '</td><td>' + cmpVid(v, f) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<ul class="rcards" aria-label="Vídeos com % assistido">' + V.map(function(v){ var f = NF[periodo][v.fi]; return '<li class="rcard"><a href="#">' + esc(v.t) + '</a><div class="l2"><span>' + FAIXAS[v.fi] + '</span><span>' + vp(v) + ' views no período</span></div><div>' + mini(v, f) + '</div><div>' + cmpVid(v, f) + '</div></li>'; }).join('') + '</ul>';
    }
    var tend = '';
    if (!semDado) {
      var alvo = periodo === 'inteiro' ? '90' : periodo, nn = NO[alvo];
      if (nn.ok && NO.inteiro.ok) { var d = dif(nn.r, NO.inteiro.r), k = dir(d); tend = '<p class="pe-fr ' + k + '"><span class="pe-sim" aria-hidden="true">' + SIM[k] + '</span><span>Nos ' + P[alvo].nome + ', o vídeo típico foi assistido por <b class="num">' + nn.r + '%</b>; no canal inteiro, <b class="num">' + NO.inteiro.r + '%</b> (' + (d === 0 ? 'igual' : sinal(d) + ' ' + pts(d)) + ').</span></p>'; }
      else tend = '<p class="pe-fr"><span class="pe-sim" aria-hidden="true">—</span><span>Não dá para comparar: nos ' + P[alvo].nome + ' o canal teve só ' + A.n(nn.views) + ' views (precisa de ' + A.n(MIN) + ').</span></p>';
    }
    var sec = '<section aria-labelledby="hR" style="margin-top:14px"><h2 class="h-sec" id="hR" style="margin-top:0">% assistido ' + A.ibtn('infoR', 'De onde vem o % assistido', true) + '</h2><p class="nota">Dado dia a dia do YouTube, até ' + A.dm(FIM) + ' (hoje e ontem ainda não chegaram). A curva de retenção por minuto fica na página de cada vídeo.</p>' +
      A.oculto('infoR', 'De onde vem o % assistido', '<ul><li><b>% assistido:</b> de cada vídeo, o que as pessoas assistiram dele no período.</li><li><b>Normal da faixa:</b> a mediana do % assistido dos vídeos da mesma faixa de duração, no período escolhido. Com menos de ' + A.n(MIN) + ' views na faixa e no período, a célula diz “poucas views”.</li></ul>') +
      L.novo(tend + cartoes(), 'novo', 'pe-novo') +
      '<div class="tbw-w" style="margin-top:14px">' + L.novo(tab, 'novo', 'pe-novo2') + '</div>' + lista + '</section>';
    return A.migalha([['Canais', '#'], ['tnFigueiredo']]) + cab + abas + sec;
  }

  var barraM = L.barra([{ rotulo: 'Tela', param: 'tela', itens: [['video', 'Vídeo'], ['canal', 'Aba Retenção do canal']], padrao: 'video' },
    { rotulo: 'Canal', param: 'caso', itens: [['cheio', 'Melhorando (cheio)'], ['piora', 'Piorando'], ['poucos', 'Poucas views no período'], ['sem-dado', 'Sem dado']], padrao: 'cheio' },
    { rotulo: 'Período', param: 'periodo', itens: [['inteiro', 'Canal inteiro'], ['90', 'Últimos 90 dias'], ['28', 'Últimos 28 dias']], padrao: 'inteiro' }],
    'Tudo é exemplo: um canal inventado, com números fixos. As telas são as já aprovadas (vídeo e aba Retenção); o acréscimo leva contorno verde-água e “+ novo”. Sem o parâmetro ?periodo, vale o que ficou lembrado neste navegador. As diferenças em pontos são feitas com os números arredondados que aparecem.');
  var fora = '<table class="tb" style="max-width:860px"><caption>O que cada escolha compara</caption><thead><tr><th scope="col">Escolha</th><th scope="col">O que entra no normal</th><th scope="col">Quando diz “poucas views”</th></tr></thead><tbody>' +
    '<tr><th scope="row">Canal inteiro (hoje)</th><td>mediana, por vídeo, do % assistido de cada vídeo, de ' + A.dm(P.inteiro.desde) + ' a ' + A.dm(FIM) + '</td><td>menos de ' + A.n(MIN) + ' views</td></tr>' +
    '<tr><th scope="row">Últimos 90 dias</th><td>mediana, por vídeo, do % assistido na janela de ' + A.dm(P['90'].desde) + ' a ' + A.dm(FIM) + ' (só o que foi assistido nela)</td><td>menos de ' + A.n(MIN) + ' views nesse período</td></tr>' +
    '<tr><th scope="row">Últimos 28 dias</th><td>mediana, por vídeo, do % assistido na janela de ' + A.dm(P['28'].desde) + ' a ' + A.dm(FIM) + ' (só o que foi assistido nela)</td><td>menos de ' + A.n(MIN) + ' views nesse período</td></tr></tbody></table>' +
    '<p class="nota" style="margin-top:10px">Na tela do vídeo o normal é o do canal todo; na aba Retenção é o da faixa de duração (como já aprovado). Em ambas, ▲ ▼ ＝ seguem a régua aprovada (“na média” = até ' + NA_MEDIA + ' pontos). O período não muda o % assistido do vídeo, só com quem ele é comparado. A conta é a mesma nos três: mediana por vídeo, a da tela aprovada. O “canal inteiro” continua com o número de hoje; os períodos só restringem o que entra à janela.</p>';
  A.moldura({ titulo: '% assistido por período', barra: barraM, corpo: tela === 'canal' ? telaCanal() : telaVideo(), fora: fora });
  A.ligarInfos();
  document.querySelectorAll('[data-periodo]').forEach(function(a){ a.addEventListener('click', function(){ L.lembrar.gravar('periodo', a.getAttribute('data-periodo')); }); });
})();
