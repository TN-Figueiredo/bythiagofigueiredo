/* video-proprio.js — rodadas 7 e 8. Histórico MÍNIMO e honesto de um vídeo do canal próprio.
   Só o que existe de verdade (dados-proprio.js): total de views, curtidas, comentários, duração, e impressões + CTR de miniatura por dia.
   O que não existe (views por dia, retenção, trocas lidas, leitura da forja) aparece com a frase do porquê.
   Rodada 8: paginador Anterior/Próximo na ordem da lista de origem; faixa de números com ⓘ preenchido; posição do vídeo no canal;
   dias em que apareceu; cartão "Leitura da forja" no estado "ainda não disponível". */
(function(){
  'use strict';
  var C = window.CANAL, F = C.fmt, IM = window.IMPRESSOES, $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var q = new URLSearchParams(location.search), back = q.get('back') || '';
  if (back && back.charAt(0) !== '?') back = '';
  var T = C.videos.slice().sort(function(a, b){ return b.pub - a.pub; });      /* os 35, do mais novo ao mais antigo */
  var v = C.porId(q.get('id')) || T.slice().sort(function(a, b){ return b.imp - a.imp; })[0];

  /* ---------------------------------------------------------------- a ordem da lista de onde a pessoa veio (o canal manda sort, dir, fmt e q em ?back=) */
  var bp = new URLSearchParams(back.replace(/^\?/, '')), SORTS = {
    recentes: ['do mais novo ao mais antigo', 'do mais antigo ao mais novo', function(x){ return x.pub; }],
    vistos: ['dos mais vistos aos menos vistos', 'dos menos vistos aos mais vistos', function(x){ return x.views; }],
    multiplo: ['do maior ao menor múltiplo', 'do menor ao maior múltiplo', function(x){ return x.mult; }],
    imp: ['das mais às menos impressões no período', 'das menos às mais impressões no período', function(x){ return x.imp; }]
  };
  var sk = SORTS[bp.get('sort')] ? bp.get('sort') : 'recentes', asc = bp.get('dir') === 'asc', fmt = bp.get('fmt') === 'longos' ? 'longos' : '', busca = (bp.get('q') || '').trim();
  function ordenar(){
    var k = F.semAcento(busca), chave = SORTS[sk][2], s = asc ? 1 : -1;
    var L = T.filter(function(x){ return !k || F.semAcento(x.t).indexOf(k) >= 0; });
    var main = L.filter(function(x){ return chave(x) != null; }).sort(function(a, b){ return s * (chave(a) - chave(b)) || b.pub - a.pub; });
    var sem = L.filter(function(x){ return chave(x) == null; }).sort(function(a, b){ return b.pub - a.pub; });
    return main.concat(sem);
  }
  var V = ordenar(), i = V.indexOf(v);
  if (i < 0){ sk = 'recentes'; asc = false; fmt = ''; busca = ''; V = ordenar(); i = V.indexOf(v); }
  var ant = V[i - 1], prox = V[i + 1];
  var ordem = 'na ordem da lista: ' + (fmt ? 'longos, ' : '') + (busca ? 'busca “' + busca + '”, ' : '') + SORTS[sk][asc ? 1 : 0];
  function href(x){ return 'video-proprio.html?id=' + encodeURIComponent(x.id) + (back ? '&back=' + encodeURIComponent(back) : ''); }

  /* ---------------------------------------------------------------- números */
  var outros = T.filter(function(x){ return x !== v && x.views != null; }).map(function(x){ return x.views; }).sort(function(a, b){ return a - b; });
  var med = outros.length % 2 ? outros[outros.length >> 1] : (outros[outros.length / 2 - 1] + outros[outros.length / 2]) / 2, mult = v.views / med;
  var S = IM.serie(v.id), R = IM.resumo(S), eng = v.views ? (v.likes + (v.comments || 0)) / v.views : null;
  var periodo = IM.dm(S[0].d) + ' a ' + IM.dm(S[S.length - 1].d), LIDO = 'lida em ' + F.data(C.reach.lidoEm, true);
  var celulas = [
    { v: F.num(v.views), l: 'views', b: 'Contagem pública do YouTube ' + LIDO + '.' },
    { v: F.num(v.likes), l: 'curtidas', b: 'Contagem do YouTube ' + LIDO + '.' },
    { v: F.num(v.comments), l: 'comentários', b: 'Contagem do YouTube ' + LIDO + '.' }
  ];
  if (eng != null) celulas.push({ v: F.dec(eng * 100, 1) + '%', l: 'engajamento', b: '(' + F.plural(v.likes, 'curtida', 'curtidas') + ' + ' + F.plural(v.comments || 0, 'comentário', 'comentários') + ') ÷ ' + F.plural(v.views, 'view', 'views') + ' = ' + F.dec(eng * 100, 1) + '%.' });
  celulas.push({ v: F.mult(mult), l: 'o normal do canal',
    b: 'Views deste vídeo (' + F.num(v.views) + ') ÷ mediana de views dos outros ' + outros.length + ' vídeos do canal (' + F.num(med) + ') = ' + F.mult(mult) + '. Os ' + T.length + ' vídeos têm mais de 365 dias, então todos estão na mesma faixa de idade. 1× é o vídeo típico do canal.' });
  celulas.push({ v: F.dur(v.dur), l: 'duração', b: 'Duração do vídeo no YouTube, lida junto com as views.' });

  /* ---------------------------------------------------------------- posição do vídeo entre os 35 (rodada 10: régua por número, regua.js) */
  var N = T.length;
  T.forEach(function(o){ o._eng = o.views != null && o.views ? (o.likes + (o.comments || 0)) / o.views : null; if (o.likes == null || o.comments == null) o._eng = null; });
  var semImp = T.filter(function(o){ return !o.imp; }).length;
  function dec1(x){ return F.dec(x, 1); }
  var GRUPOS = [
    { g: 'Alcance', itens: [
      { k: 'imp', nome: 'impressões', un: 'impressões', get: function(o){ return o.imp > 0 ? o.imp : null; }, fmt: function(x){ return F.num(x); }, sr: function(x){ return F.plural(x, 'impressão', 'impressões'); },
        href: 'canal-proprio.html?sort=imp#v-' + v.id, semValorTxt: 'sem impressão de ' + periodo },
      { k: 'views', nome: 'views', un: 'views', get: function(o){ return o.views; }, fmt: function(x){ return F.num(x); }, sr: function(x){ return F.plural(x, 'view', 'views'); },
        href: 'canal-proprio.html?sort=vistos#v-' + v.id } ] },
    { g: 'Resposta', itens: [
      { k: 'eng', nome: 'engajamento', un: 'de engajamento', get: function(o){ return o._eng; }, fmt: function(x){ return F.dec(x * 100, 1) + '%'; }, sr: function(x){ return F.dec(x * 100, 1) + '% de engajamento'; } },
      { k: 'likes', nome: 'curtidas', un: 'curtidas', get: function(o){ return o.likes; }, fmt: function(x){ return F.num(x); }, sr: function(x){ return F.plural(x, 'curtida', 'curtidas'); } },
      { k: 'comments', nome: 'comentários', un: 'comentários', get: function(o){ return o.comments; }, fmt: function(x){ return F.num(x); }, sr: function(x){ return F.plural(x, 'comentário', 'comentários'); } } ] },
    { g: 'Formato', itens: [
      { k: 'dur', nome: 'duração', un: '', neutra: true, get: function(o){ return o.dur; }, fmt: function(x){ return F.dur(Math.round(x)); }, sr: function(x){ return 'duração ' + F.dur(Math.round(x)); } } ] }
  ];
  var honest = v.imp
    ? 'Impressões: ' + F.plural(v.imp, 'impressão', 'impressões') + ' em ' + F.plural(R.com, 'dia', 'dias') + ', somadas dos ' + (R.com + R.zero) + ' relatórios diários lidos de ' + periodo + (R.falta ? ' (' + F.plural(R.falta, 'dia ainda sem relatório baixado', 'dias ainda sem relatório baixado') + ')' : '') + '. Com tão poucas, a posição em impressões muda de um dia para o outro.'
    : 'Impressões: nenhum dos ' + (R.com + R.zero) + ' relatórios diários lidos de ' + periodo + ' trouxe impressão deste vídeo' + (R.falta ? ' (' + F.plural(R.falta, 'dia ainda sem relatório baixado', 'dias ainda sem relatório baixado') + ')' : '') + '. ' + (semImp > 2 ? 'Os outros ' + (semImp - 1) + ' vídeos nessa situação ficam' : semImp === 2 ? 'O outro vídeo nessa situação fica' : 'Nenhum outro vídeo está nessa situação; este fica') + ' fora da régua de impressões. Com poucas impressões por vídeo, a posição dos demais muda de um dia para o outro.';

  /* rodada 12: a caixa "Dias em que apareceu" saiu; a mesma tabela (dia, impressões, cliques estimados, estado do relatório) é o "Ver como tabela" do gráfico de impressões */

  /* ---------------------------------------------------------------- montagem */
  var CH = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>', CN = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
  function nav(x, qual){
    var txt = qual === 'ant' ? CH + 'Anterior' : 'Próximo' + CN, lbl = qual === 'ant' ? 'Vídeo anterior da lista' : 'Próximo vídeo da lista';
    return x ? '<a class="btn ghost" data-nav="' + qual + '" id="p' + qual + '" href="' + esc(href(x)) + '" aria-label="' + lbl + '" aria-keyshortcuts="' + (qual === 'ant' ? '[' : ']') + '">' + txt + '</a>'
             : '<a class="btn ghost" data-nav="' + qual + '" id="p' + qual + '" role="link" aria-disabled="true" tabindex="0" aria-label="' + lbl + ': não há">' + txt + '</a>';
  }
  $('crumbCanal').href = 'canal-proprio.html' + back;
  document.title = 'Histórico do vídeo: ' + v.t + ' — Seu canal — Observatório';
  $('vp').innerHTML =
    '<header class="vp-h"><img src="https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg" alt="" width="320" height="180">' +
    '<div><h1 id="h1" tabindex="-1">' + esc(v.t) + '</h1>' +
    '<p class="vp-m"><span class="own-seal" style="height:22px;font-size:12px;margin-right:8px">seu canal</span>Publicado em ' + F.data(v.pub, true) + ' (' + F.ha(v.pub) + '). Vídeo longo. Lido em ' + F.data(C.reach.lidoEm, true) + '.</p>' +
    '<div id="vpNums"></div>' +
    '<div class="vp-a"><a class="btn" href="https://www.youtube.com/watch?v=' + v.id + '" target="_blank" rel="noopener">Abrir no YouTube<span class="sr"> (abre em nova aba)</span></a>' +
      '<div class="vp-pg" id="pager" role="group" aria-label="Navegar entre os vídeos da lista">' + nav(ant, 'ant') + '<span class="vp-pos"><b class="num">' + (i + 1) + '</b> de ' + V.length + '</span>' + nav(prox, 'prox') + '<span class="vp-ord">' + esc(ordem) + '</span></div></div></div></header>' +

    '<section class="vp-sec" aria-labelledby="vpI"><h2 id="vpI">Impressões por dia, de ' + periodo + '</h2>' +
    '<p>' + (R.imp ? IM.frase(R) + ' ' + (R.imp < 30 ? 'É pouco para dizer se a capa funciona: leia como contagem, não como taxa.' : '') : 'Nenhuma impressão deste vídeo nos ' + (R.com + R.zero) + ' relatórios lidos de ' + periodo + '; ' + F.plural(R.falta, 'dia ainda está', 'dias ainda estão') + ' sem relatório baixado.') + '</p>' +
    '<div id="vpChart"></div></section>' +

    '<section class="vp-sec vp-rg" aria-labelledby="vpK"><h2 id="vpK">Este vídeo no canal</h2><div id="vpRg"></div></section>' +

    '<section class="forja fj vp-fj" role="region" aria-labelledby="fjH"><div class="fj-top"><h3 id="fjH">Leitura da forja<span class="fj-off">ainda não disponível para o seu canal</span></h3></div>' +
    '<p class="what">A leitura deste vídeo seria sobre views por dia, impressões e cliques dele, comparados com os outros vídeos do seu canal.</p>' +
    '<div class="ask col"><button type="button" class="btn forja-solid" aria-disabled="true" aria-describedby="fjPq">Pedir leitura deste vídeo à forja</button>' +
    '<p id="fjPq">Ainda não dá: a forja hoje só recebe dados públicos de concorrentes; a leitura do seu canal chega depois que a coleta diária estiver no ar.</p></div></section>' +

    '<section class="vp-sec" aria-labelledby="vpN"><h2 id="vpN">O que ainda não há deste vídeo</h2>' +
    '<p>Views por dia (a coleta diária entra nos próximos dias, por isso só há o total de ' + F.num(v.views) + '), percentual assistido e retenção (chegam no lote seguinte da coleta), origem do tráfego (o relatório já é baixado todo dia, mas esta tela ainda não o lê) e trocas de título e thumbnail (ainda não são lidas aqui; os testes do seu canal ficam no A/B Lab).</p></section>';
  window.FAIXA.montar($('vpNums'), celulas, { rotulo: 'Números deste vídeo', titulo: 'De onde vêm os números deste vídeo' });
  window.REGUA.montar($('vpRg'), { T: T, v: v, grupos: GRUPOS, periodo: periodo, honestidade: honest, poucas: v.imp > 0 && v.imp < 30, abrir: function(o){ location.href = href(o); } });
  IM.render($('vpChart'), S, { titulo: 'Impressões por dia deste vídeo', video: true, ph: 110 });

  /* ---------------------------------------------------------------- teclado: [ e ] como no Histórico de concorrente */
  function ir(x, qual){ if (!x) return; try { sessionStorage.setItem('pc:foco-vp', qual); } catch (e) {} location.replace(href(x)); }
  document.addEventListener('keydown', function(e){
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var a = document.activeElement; if (!(a && (a.id === 'h1' || a.closest('#pager')))) return;
    if (e.key === '[') ir(ant, 'ant'); if (e.key === ']') ir(prox, 'prox');
  });
  $('pager').addEventListener('click', function(e){ var b = e.target.closest('[aria-disabled="true"]'); if (b) e.preventDefault(); });
  var comImp = T.slice().sort(function(a, b){ return b.imp - a.imp; });
  $('mkCasos').innerHTML = [['Mais impressões (' + comImp[0].imp + ')', comImp[0]], ['Com 1 clique', C.videos.filter(function(x){ return x.cliques === 1; })[0]], ['Com 1 impressão', C.videos.filter(function(x){ return x.imp === 1; })[0]], ['Sem impressão', C.videos.filter(function(x){ return !x.imp; })[0]]]
    .filter(function(x){ return x[1]; }).map(function(x){ return '<a class="mkb" href="' + esc(href(x[1])) + '" aria-current="' + (x[1] === v) + '">' + x[0] + '</a>'; }).join('');
  var foco = null; try { foco = sessionStorage.getItem('pc:foco-vp'); sessionStorage.removeItem('pc:foco-vp'); } catch (e) {}
  var alvo = foco ? document.querySelector('#pager [data-nav="' + foco + '"]') : null;
  (alvo || $('h1')).focus({ preventScroll: true });
})();
