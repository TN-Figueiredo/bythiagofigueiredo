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
  /* trocas de título e de thumbnail (EXEMPLO: ainda não existe registro de trocas para vídeo do canal próprio).
     ?trocas=recente (troca de ontem: o depois ainda não foi medido) | nenhuma (registro ligado, sem troca) | sem-registro (como é hoje). Vídeo novo e sem dado: sempre sem registro. */
  var modo = q.get('trocas') || 'exemplo', registro = novoV || semDado || !impS || modo === 'sem-registro' ? 'sem' : modo === 'nenhuma' ? 'nenhuma' : 'exemplo';
  var trocas = registro !== 'exemplo' ? [] : (v.trocas || []).slice();
  if (registro === 'exemplo' && modo === 'recente' && base === 'cheio') trocas.push({ d: '2026-10-09', tipo: 't', n: 3, antes: v.t, depois: 'Hanói em 7 dias: o custo real, dia a dia' });
  trocas.sort(function(a, b){ return a.d < b.d ? -1 : 1; });
  /* janela de um lado da troca: até A.JANELA dias, parando na troca vizinha; ficam de fora o dia da troca (tem as duas versões) e o dia da publicação (pico de lançamento). dias = só dias medidos */
  function janela(serie, t, lado){
    var ds = serie.map(function(x){ return x.d; }), i = ds.indexOf(t.d), k = trocas.indexOf(t), ant = k > 0 ? ds.indexOf(trocas[k - 1].d) : -1, prox = k < trocas.length - 1 ? ds.indexOf(trocas[k + 1].d) : serie.length, pi = ds.indexOf(v.pub);
    var a = lado < 0 ? Math.max(ant + 1, i - A.JANELA, pi + 1) : i + 1, b = lado < 0 ? i - 1 : Math.min(prox - 1, i + A.JANELA), r = { imp: 0, cl: 0, dias: 0, de: null, ate: null };
    for (var j = a; j <= b; j++) { var x = serie[j]; if (!x || x.e === 'nm') continue; r.dias++; if (!r.de) r.de = x.d; r.ate = x.d; if (x.e === 'com') { r.imp += x.v; r.cl += x.cl || 0; } }
    r.cliques = Math.round(r.cl); return r;
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
  function resumoTrocas(){
    if (registro !== 'exemplo' || !trocas.length) return '';
    var desf = { sobe: 'taxa subiu', cai: 'taxa caiu', igual: 'sem diferença firme', poucas: 'ainda não dá para dizer', nm: 'o depois ainda não foi medido' };
    var itens = trocas.map(function(t){ return nomeTroca(t) + ' (' + t.n + ') em ' + A.dm(t.d) + ', ' + desf[leituraTroca(t).vr.k]; }).join('; ');
    return '<p class="tr-res"><span class="ex">exemplo</span><span class="tr-res-t"><b>Trocas deste vídeo:</b> ' + esc(itens) + '.</span><a class="lk tr-res-lk" href="#trocas">Ver antes e depois</a></p>';
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
  /* thumbnail ilustrativa: o mockup não tem a imagem antiga, então desenha uma capa de exemplo */
  function capa(tom, rot){
    var fundo = tom ? ['#C2410C', '#F59E0B'] : ['#3B4A5C', '#566579'];
    return '<span class="tr-img"><svg viewBox="0 0 160 90" role="img" aria-label="' + esc(rot) + '" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cg' + tom + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + fundo[0] + '"/><stop offset="1" stop-color="' + fundo[1] + '"/></linearGradient></defs><rect width="160" height="90" fill="url(#cg' + tom + ')"/>' +
      (tom ? '<circle cx="112" cy="46" r="26" fill="#FDE7C8"/><circle cx="104" cy="42" r="3" fill="#7C2D12"/><circle cx="120" cy="42" r="3" fill="#7C2D12"/><path d="M103 54q9 8 18 0" stroke="#7C2D12" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="8" y="12" width="64" height="14" rx="3" fill="#FFF"/><rect x="8" y="30" width="48" height="14" rx="3" fill="#FFF"/><rect x="8" y="48" width="38" height="14" rx="3" fill="#14110D"/>'
        : '<circle cx="118" cy="52" r="16" fill="#8794A5"/><rect x="10" y="62" width="70" height="6" rx="3" fill="#A6B2C2"/><rect x="10" y="72" width="44" height="6" rx="3" fill="#A6B2C2"/>') + '</svg></span>';
  }
  function leituraTroca(t){
    var a = janela(impS, t, -1), d = janela(impS, t, 1), vr = a.dias === 0 || d.dias === 0 ? { k: 'nm', lado: d.dias === 0 ? 'depois' : 'antes' } : A.veredito(a, d); return { a: a, d: d, vr: vr };
  }
  function nomeTroca(t){ return t.tipo === 't' ? 'título' : 'thumbnail'; }
  function marca(t){ return '<span class="tr-mk ' + t.tipo + '" aria-hidden="true">' + t.n + '</span>'; }
  function lista(xs){ return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]; }
  var ATRASO = 'o YouTube entrega com 2 a 3 dias de atraso';
  function secTrocas(){
    if (registro === 'sem') return '<p class="tr-vazia" id="trocas"><b>Trocas deste vídeo:</b> ' + '<span class="tr-nr">' + A.fantasmas('tr-fan') + 'não registrado</span>' + ' O sistema ainda não registra as trocas de título e de thumbnail dos vídeos do seu canal, então não dá para dizer se este teve alguma. Quando registrar, cada troca aparece aqui, com o antes e o depois.</p>';
    if (registro === 'nenhuma') return '<p class="tr-vazia" id="trocas"><span class="ex">exemplo</span> <b>Trocas deste vídeo:</b> <span class="tr-zero"><b class="num">0</b> trocas registradas</span> desde a publicação, em ' + (idade > 365 ? A.dmy(v.pub) : A.dm(v.pub)) + '. O título e a thumbnail são os de origem.</p>';
    var L = trocas.map(leituraTroca), top = A.topoTaxa([].concat.apply([], L.map(function(x){ return [{ cliques: x.a.cliques, imp: x.a.imp }, { cliques: x.d.cliques, imp: x.d.imp }]; })));
    var desf = { sobe: 'subiu', cai: 'caiu', igual: 'sem diferença que se sustente', poucas: 'poucas impressões, ainda não dá para dizer', nm: 'o depois ainda não foi medido' };
    var frase = '<b>' + trocas.length + (trocas.length === 1 ? ' troca' : ' trocas') + '</b> neste vídeo: ' + lista(trocas.map(function(t){ return nomeTroca(t) + ' em ' + A.dm(t.d) + ' (' + t.n + ')'; })) + '. Taxa de clique depois da troca: ' +
      (trocas.length === 1 ? desf[L[0].vr.k] : L.map(function(x, i){ return nomeTroca(trocas[i]) + ' (' + trocas[i].n + '), ' + desf[x.vr.k]; }).join('; ')) + '.';
    var itens = trocas.map(function(t, i){
      var x = L[i], vr = x.vr, p = function(r){ return A.pct(r.cliques / r.imp, 1); };
      var chip = { sobe: ['up', '▲ taxa subiu'], cai: ['dn', '▼ taxa caiu'], igual: ['sep', '≈ sem diferença firme'], poucas: ['poucas', '… ainda não dá para dizer'], nm: ['nmc', '? ' + vr.lado + ' ainda não medido'] }[vr.k];
      var vtxt = vr.k === 'nm' ? '<b>Ainda não dá para comparar.</b> ' + (vr.lado === 'depois' ? 'Depois desta troca ainda não há dia fechado' : 'Antes desta troca não há dia fechado') + ': ' + ATRASO + '. Quando o primeiro dia chegar, a leitura aparece sozinha.'
        : vr.k === 'poucas' ? '<b>Ainda não dá para dizer.</b> São ' + A.n(x.a.imp) + (x.a.imp === 1 ? ' impressão' : ' impressões') + ' antes e ' + A.n(x.d.imp) + ' depois: com menos de ' + A.MIN_IMP + ' de um lado, qualquer taxa seria chute.'
        : vr.k === 'igual' ? 'De ' + p(x.a) + ' para ' + p(x.d) + ', mas as faixas se cruzam: a diferença pode ser só acaso.'
        : '<b>' + (vr.k === 'sobe' ? 'Subiu' : 'Caiu') + '</b> de ' + p(x.a) + ' para ' + p(x.d) + '. As faixas ' + (vr.gap < .004 ? 'quase se tocam: a diferença é pequena.' : 'não se cruzam.');
      var mud = t.tipo === 't' ? '<dl class="tr-mud"><dt>Antes</dt><dd class="vel">' + esc(t.antes) + '</dd><dt>Depois</dt><dd>' + esc(t.depois) + '</dd></dl>'
        : '<div class="tr-th"><figure>' + capa(t.antes.tom, 'Thumbnail antes da troca (imagem de exemplo)') + '<figcaption>antes</figcaption></figure><figure>' + (D.thumb(v) && !M.exemplo ? '<span class="tr-img"><img src="' + D.thumb(v) + '" alt="Thumbnail depois da troca"></span>' : capa(t.depois.tom, 'Thumbnail depois da troca (imagem de exemplo)')) + '<figcaption>depois</figcaption></figure></div>';
      return '<li class="tr-it" id="troca' + t.n + '"><div class="tr-cab">' + marca(t) + '<h3>Troca de ' + nomeTroca(t) + '</h3><span class="qd">' + A.ds(t.d) + '</span><span class="tr-dv ' + chip[0] + '">' + chip[1] + '</span></div>' + mud +
        '<div class="tr-taxa"><h4>Taxa de clique' + (vr.k === 'poucas' || vr.k === 'nm' ? '' : ' <span class="qd" style="font-weight:400;color:var(--muted)">com intervalo de 95%</span>') + '</h4><div id="trx' + t.n + '"></div></div><p class="tr-v">' + vtxt + '</p></li>';
    }).join('');
    return '<section class="sec tr" id="trocas" aria-labelledby="hTr"><h2 id="hTr">Trocas deste vídeo ' + A.ibtn('infoTr', 'Como ler antes e depois', true) + '</h2>' +
      '<p class="exband"><span class="ex">exemplo</span> Hoje o sistema ainda não registra trocas dos vídeos do seu canal. Esta seção mostra como ficaria' + (M.exemplo ? '; as trocas e as capas são inventadas.' : ', sobre um vídeo real; a troca e a capa de antes são inventadas.') + '</p>' +
      '<p class="exband tr-dec"><span class="ex dec">decisão sua</span> Regras de exemplo: mínimo de ' + A.MIN_IMP + ' impressões por lado; janela de até ' + A.JANELA + ' dias antes e ' + A.JANELA + ' depois da troca.</p>' +
      '<p class="fr">' + frase + '</p><ol class="tr-lista">' + itens + '</ol>' +
      A.oculto('infoTr', 'Como ler antes e depois', '<ul><li><b>Antes e depois:</b> até ' + A.JANELA + ' dias de cada lado da troca, parando na troca vizinha. Ficam de fora o dia da troca (tem as duas versões) e o dia da publicação (o pico de lançamento não é comparável com uma semana comum). Os ' + A.JANELA + ' dias e as ' + A.MIN_IMP + ' impressões são regras de exemplo, a decidir.</li><li><b>Taxa de clique:</b> cliques estimados ÷ impressões, nos dias medidos de cada lado. A faixa é o intervalo de 95% (Wilson). Se as faixas se cruzam, a diferença pode ser só acaso.</li><li><b>Poucas impressões:</b> com menos de ' + A.MIN_IMP + ' de um lado a tela não mostra faixa nem número.</li><li><b>Não medido:</b> se um dos lados ainda não tem dia fechado (' + ATRASO + '), a tela diz isso e não conta zero.</li><li><b>Não é teste A/B:</b> o período muda junto com a troca (o vídeo envelhece, a recomendação muda, o dia da semana muda). Antes × depois mostra o que aconteceu, não o que a troca causou. Para separar a capa do momento, use o A/B Lab.</li></ul>') + '</section>';
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

  var TROCAS_OPC = [['exemplo', 'Com trocas (exemplo)']].concat(base === 'cheio' ? [['recente', 'Troca de ontem (o depois não foi medido)']] : []).concat([['nenhuma', 'Nenhuma troca registrada'], ['sem-registro', 'Sem registro (como é hoje)']]);
  var barra = { linhas: [{ rotulo: 'Estado', itens: CASOS.map(function(c){ return { t: c[1], href: A.href({ caso: c[0] === 'cheio' ? null : c[0], trocas: null }), atual: caso === c[0] }; }) }]
      .concat(base === 'cheio' || base === 'magro' ? [{ rotulo: 'Trocas', itens: A.opcoes('trocas', TROCAS_OPC, 'exemplo') }] : []).concat([A.tema()]),
    nota: '<b>Cheio</b> e <b>vídeo novo</b>: exemplo. <b>Magro</b>: o vídeo real “O Que Esperar Do MBK Center” (118 views, 18 impressões, 2 cliques estimados); o diário de views e o % assistido são exemplo. <b>Retenção</b>: a curva só existe no caso cheio, como exemplo; o resto depende de coleta nova. <b>Trocas de título e thumbnail</b>: hoje o sistema não registra trocas de vídeo do seu canal. “Sem registro” é o estado de hoje (vídeo novo e sem dado também); “nenhuma troca registrada” só vale depois que o registro existir. Os casos cheio (2 trocas) e magro (1 troca, impressões insuficientes) mostram como a seção ficaria. <b>Duas regras de exemplo para você decidir:</b> mínimo de ' + A.MIN_IMP + ' impressões por lado e janela de até ' + A.JANELA + ' dias antes e ' + A.JANELA + ' depois (parando na troca vizinha).' };
  A.moldura({ titulo: 'Vídeo próprio: ' + v.t, barra: barra,
    corpo: A.migalha([['Canais', 'index.html'], [M.nome, 'canal.html?caso=' + (base === 'novo' ? 'cheio' : base)], ['Vídeo']]) + pager() + cabecalho() + resumoTrocas() + secViews() + secImp() + secTrocas() + secAssistido() + secRetencao() + secCanal() +
      '' });
  A.ligarInfos();

  var LEGTR = registro === 'sem' ? 'trocas de título e de thumbnail: ainda não registradas' : null, AVISO_TR = registro === 'sem' ? '<p><b>Trocas de título e de thumbnail:</b> o sistema ainda não as registra, então o gráfico não marca nenhuma. Gráfico sem marca não quer dizer que não houve troca. Os dois contornos pontilhados na legenda (losango e triângulo) querem dizer isto: as marcas iriam aqui, e não há registro.</p>' : '';
  if (vd) {
    var c = D.resumoImp(vd.map(function(d){ return { d: d.d, v: d.v, e: d.e, cl: 0 }; }));
    A.serieDia(document.getElementById('gVw'), { id: 'gvv', semTitulo: true, titulo: 'Views do vídeo, dia a dia', frase: fraseViews(), meta: 'de ' + A.dm(vd[0].d) + ' a ' + A.dm(vd[vd.length - 1].d) + ' · ' + vd.length + ' dias · dia do YouTube', dias: vd, um: ['view', 'views'], pub: v.pub,
      trocas: trocas, trocasEx: true, bordaFinal: true, legTrocas: LEGTR, legBarra: 'views do dia', legZero: 'zero medido: ninguém viu neste dia', legNm: 'não medido: o YouTube não entregou o dia',
      fala: function(d){ return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'o YouTube não entregou este dia (não medido)' : d.v === 0 ? 'nenhuma view (zero medido)' : A.n(d.v) + (d.v === 1 ? ' view' : ' views')); },
      ajuda: '<p>Cada coluna é um dia do YouTube (fecha no horário do Pacífico), com 2 a 3 dias de atraso. <b>Caixa vazada</b>: o dia veio e ninguém viu o vídeo. <b>Hachura</b>: o dia não veio; não é zero.</p><p>Use os botões abaixo do gráfico para ler um dia de cada vez.</p>' + (trocas.length ? '<p><b>Losango</b>: troca de título. <b>Triângulo</b>: troca de thumbnail. O número é a ordem em “Trocas deste vídeo”. <b>As marcas são de exemplo</b>: hoje o sistema não registra trocas. A troca pode ter acontecido a qualquer hora do dia marcado.</p>' : '') + AVISO_TR });
  }
  if (impS) {
    var ri = RI;
    A.serieDia(document.getElementById('gIm'), { id: 'gim', semTitulo: true, titulo: 'Impressões e cliques por dia', frase: (ri.imp ? A.n(ri.imp) + (ri.imp === 1 ? ' impressão' : ' impressões') + ' e ' + (ri.clR === 1 ? '1 clique estimado' : A.n(ri.clR) + ' cliques estimados') + ' em ' + impS.length + ' dias: ' + ri.com + ' dias com impressão, ' + ri.zero + ' medidos em zero e ' + ri.nm + ' não medidos.' : 'Nenhuma impressão em ' + impS.length + ' dias.') + (ri.imp < 100 ? ' É pouco para dizer se a capa funciona: leia como contagem.' : ''),
      meta: 'de ' + A.dm(impS[0].d) + ' a ' + A.dm(impS[impS.length - 1].d) + ' · dia do YouTube', dias: impS, um: ['impressão', 'impressões'], cliques: true, trocas: trocas, trocasEx: true, folgaNum: 2, escalonar: true, bordaFinal: true, legTrocas: LEGTR, pub: v.pub, ajuda: '<p>Cada coluna é um dia do YouTube. <b>Caixa vazada</b>: o dia veio sem impressões. <b>Hachura</b>: o dia não veio; não é zero.</p><p><b>Faixa sob as datas</b>: os cliques estimados do dia, escritos por extenso. Todos os pontos ficam na mesma linha: a altura não mede nada. Em tela estreita os números se alternam em duas linhas, e um fio liga o número de baixo ao seu ponto. Os cliques são estimados (impressões × taxa do dia).</p>' + (trocas.length ? '<p><b>Losango</b>: troca de título. <b>Triângulo</b>: troca de thumbnail. O número é a ordem em “Trocas deste vídeo”. <b>As marcas são de exemplo</b>: hoje o sistema não registra trocas.</p>' : '') + AVISO_TR + '<p>Use os botões abaixo do gráfico para ler um dia de cada vez.</p>', legBarra: 'impressões do dia', legZero: 'zero medido: o YouTube enviou o dia sem impressões deste vídeo', legNm: 'não medido: o dia ainda não chegou',
      fala: function(d){ var cl = d.cl; return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'o dia ainda não chegou (não medido)' : d.e === 'zero' ? 'o YouTube enviou o dia sem impressões deste vídeo (zero medido)' : A.n(d.v) + (d.v === 1 ? ' impressão, ' : ' impressões, ') + (cl < 1 ? 'menos de 1 clique estimado' : Math.round(cl) === 1 ? '1 clique estimado' : A.n(Math.round(cl)) + ' cliques estimados')); } });
    var cv = document.getElementById('ctrV'); if (cv && RI.imp) A.faixaTaxa(cv, { cliques: RI.clR, imp: RI.imp, ref: wc ? { cliques: canalImp.clR, imp: canalImp.imp } : null, alt: 'Taxa de clique do vídeo ' + A.pct(RI.cl / RI.imp, 1) + ', de ' + A.pct(w[0], 1) + ' a ' + A.pct(w[1], 1) + '; do canal, de ' + (wc ? A.pct(wc[0], 1) + ' a ' + A.pct(wc[1], 1) : '') });
  }
  if (trocas.length) {
    var TL = trocas.map(leituraTroca), topo = A.topoTaxa([].concat.apply([], TL.map(function(x){ return [{ cliques: x.a.cliques, imp: x.a.imp }, { cliques: x.d.cliques, imp: x.d.imp }]; })));
    trocas.forEach(function(t, i){
      var h = document.getElementById('trx' + t.n), x = TL[i]; if (!h) return;
      var rot = function(nome, r){ return nome + ': ' + (r.dias ? r.dias + (r.dias === 1 ? ' dia' : ' dias') + ' (' + (r.dias > 1 ? A.dm(r.de) + ' a ' + A.dm(r.ate) : A.dm(r.de)) + '), ' + A.n(r.imp) + (r.imp === 1 ? ' impressão' : ' impressões') : 'ainda sem dia medido'); };
      A.antesDepois(h, { top: topo, uid: 'trx' + t.n, antes: { cliques: x.a.cliques, imp: x.a.imp, nm: x.a.dias === 0, rot: rot('Antes', x.a) }, depois: { cliques: x.d.cliques, imp: x.d.imp, nm: x.d.dias === 0, rot: rot('Depois', x.d) },
        alt: 'Taxa de clique antes e depois da troca de ' + nomeTroca(t) + ' em ' + A.dm(t.d) + (x.vr.k === 'nm' ? ': o ' + x.vr.lado + ' ainda não foi medido.' : x.vr.k === 'poucas' ? ': poucas impressões, sem faixa.' : ': antes ' + A.pct(x.a.cliques / x.a.imp, 1) + ', depois ' + A.pct(x.d.cliques / x.d.imp, 1) + '.') });
    });
  }
  var cvh = document.getElementById('curv'); if (cvh) A.curva(cvh, { pts: v.curva, dur: v.dur, meio: curvaInfo().meio, saidas: curvaInfo().saidas.map(function(s){ return s[1]; }), rea: [[.355 * 99, .405 * 99], [.6 * 99, .64 * 99]].map(function(r){ return [Math.round(r[0]), Math.round(r[1])]; }), alt: 'Curva de retenção de exemplo: de 100% no início, metade do público sai aos ' + A.dur(curvaInfo().meio * v.dur) });
})();
