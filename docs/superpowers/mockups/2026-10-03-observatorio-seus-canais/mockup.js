/* Só destes mockups. Carregar DEPOIS de dados.js e ANTES de chrome.js.
   1) confere que os canais próprios extras entraram no motor (senão a tela mentiria);
   2) escolhe QUAIS canais próprios existem neste estado do mockup (1, 2, 5…) e qual é o nicho de cada um
      (canal próprio tem nicho, como concorrente; pode estar sem nicho) — window.MOCKOWN;
   3) aponta os links das telas que não existem nesta pasta para os mockups originais;
   4) sobe a faixa "Nota do mockup" para o topo da página, acima da barra de estados. */
(function () {
  'use strict';
  var ORIG = '../2026-10-02-observatorio/', L = OBS.link, here = location.pathname.split('/').pop();
  var SEED = window.__SEGUNDO_CANAL;
  if (!SEED || !SEED.ids.every(function (id) { return OBS.channel(id); })) {
    if (SEED) SEED.desfazer();
    console.error('[mockup] os canais próprios extras não entraram no motor: confira segundo-canal.js contra dados.js');
  }

  /* ---------------- canais próprios do estado do mockup ----------------
     ids = canais próprios que existem neste estado; none = os que estão SEM nicho (o motor não tem esse estado:
     lá todo canal nasce com nicho; aqui a tela trata o canal como "sem nicho" até o dono escolher). */
  var PRESETS = {
    '1':    { ids: ['tnfigueiredo'], none: [] },
    '2':    { ids: ['tnfigueiredo', 'tnfigueiredo-en'], none: [] },
    '5':    { ids: ['tnfigueiredo', 'tnfigueiredo-en', 'thiago-na-estrada', 'slow-roads', 'mochila-leve'], none: [] },
    'mix':  { ids: ['tnfigueiredo', 'tnfigueiredo-en', 'thiago-na-estrada', 'thiago-testa-ia', 'mochila-leve'], none: ['mochila-leve'] },
    'zero': { ids: ['thiago-testa-ia', 'mochila-leve'], none: ['mochila-leve'] }
  };
  var KEY = 'obs-mock-owns';
  var read = function () { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  var write = function (s) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } };
  var st = read(), url = new URL(location.href), asked = url.searchParams.get('owns');
  var forced = /^insights-(a|b)-/.test(here) ? '2' : null;      // A e B ficaram como estavam: sempre dois canais
  if (asked && PRESETS[asked] && asked !== st.preset) { st = { preset: asked, niche: {} }; write(st); }   // ?owns= vence e é guardado
  if (!PRESETS[st.preset]) st = { preset: '2', niche: {} };
  var preset = forced || st.preset, P = PRESETS[preset], assigned = forced ? {} : (st.niche || {});
  /* tira do motor os canais próprios que não existem neste estado (e os vídeos deles): nenhuma tela os enxerga */
  for (var i = OBS.channels.length - 1; i >= 0; i--) { var c = OBS.channels[i]; if (c.own && P.ids.indexOf(c.id) < 0) OBS.channels.splice(i, 1); }
  for (var j = OBS.videos.length - 1; j >= 0; j--) { var ch = OBS.channel(OBS.videos[j].ch); if (ch.own && P.ids.indexOf(ch.id) < 0) OBS.videos.splice(j, 1); }
  Object.keys(assigned).forEach(function (id) { if (P.ids.indexOf(id) >= 0 && OBS.channel(id).niche !== assigned[id]) OBS.setNiche(id, assigned[id]); });
  window.MOCKOWN = {
    preset: preset,
    owns: function () { return P.ids.map(function (id) { return OBS.channel(id); }); },
    /** nicho do canal próprio: 'viagem' | 'ia' | null (sem nicho) */
    nicheOf: function (c) { return assigned[c.id] || (P.none.indexOf(c.id) >= 0 ? null : c.niche); },
    assign: function (id, n) { assigned[id] = n; if (!forced) { st.niche = assigned; write(st); } OBS.setNiche(id, n); },
    clearAssigned: function () { assigned = {}; if (!forced) { st.niche = {}; write(st); } },
    set: function (p) { if (!PRESETS[p]) return; write({ preset: p, niche: {} }); var u = new URL(location.href); u.searchParams.delete('owns'); u.searchParams.delete('channel'); location.replace(here + u.search); }
  };

  /* ---------------- links ---------------- */
  ['outliers', 'mudancas', 'historico'].forEach(function (k) { var f = L[k]; L[k] = function () { return ORIG + f.apply(L, arguments); }; });
  var ins = L.insights, insFile = /^insights-/.test(here) ? here : 'insights-n-canais.html';
  L.insights = function (o) { return ins(o).replace(/^insights\.html/, insFile); };
  /* Insights só mostra os cards com um nicho escolhido: na primeira abertura (sem ?niche= e sem escolha guardada), abre em Viagem */
  try { var u = new URL(location.href);
    if (/^insights-/.test(here) && !u.searchParams.get('niche') && !localStorage.getItem('obs-niche')) { u.searchParams.set('niche', 'viagem'); history.replaceState(null, '', here + u.search); }
  } catch (e) { }
  document.addEventListener('DOMContentLoaded', function () { var n = document.getElementById('mocknote'); if (n) document.body.prepend(n); });
})();
