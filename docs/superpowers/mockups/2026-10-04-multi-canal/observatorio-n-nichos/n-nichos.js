/* =====================================================================================
   n-nichos.js — SÓ DESTE MOCKUP (2026-10-04-multi-canal/observatorio-n-nichos).
   Carregar DEPOIS de dados.js e mockup.js e ANTES de chrome.js.

   Nicho vira dado: o dono cria nichos. Este arquivo acrescenta ao motor os nichos do estado
   escolhido em "Estados do mockup" (?nichos=2|3|4|6; 2 = só os de fábrica, e aí NADA muda).
   - Viagem e IA continuam primeiro, com as cores de hoje; os criados entram depois, na ordem de criação.
   - Nicho criado pelo dono não tem lista de temas (hasThemes = false) e só usa as fórmulas universais.
   - Para o grupo "Jogos" existir na tabela, dois concorrentes de IA são postos em Jogos (e, com seis
     nichos, um de Viagem em Culinária) pelo MESMO caminho do seletor da linha (OBS.setNiche): os números
     continuam saindo do motor. "Pessoal" e "Finanças" ficam vazios: é o nicho recém-criado.
   ===================================================================================== */
(function () {
  'use strict';
  /* Paleta proposta para nichos criados pelo dono: quatro tons que não repetem nenhuma cor com significado
     no Observatório (laranja = ação / seu canal, teal = forja, violeta = Cowork, âmbar = aviso, vermelho = erro,
     ciano = informação, verde = Viagem, azul = IA). Par escuro / claro, AA sobre surface. */
  var PALETTE = {
    ameixa:  { dark: '#D29AE8', light: '#7B2A91' },
    rosa:    { dark: '#F293C2', light: '#A3216B' },
    lima:    { dark: '#B9CB62', light: '#55650B' },
    ardosia: { dark: '#AAB4C0', light: '#4B5563' }
  };
  var EXTRA = {
    jogos:     { id: 'jogos',     label: 'Jogos',     tone: 'ameixa',  from: ['preguica-artificial', 'the-ai-advantage'] },
    pessoal:   { id: 'pessoal',   label: 'Pessoal',   tone: 'rosa',    from: [] },
    culinaria: { id: 'culinaria', label: 'Culinária', tone: 'lima',    from: ['paddy-doyle'] },
    financas:  { id: 'financas',  label: 'Finanças',  tone: 'ardosia', from: [] }
  };
  var PRESETS = { '2': [], '3': ['jogos'], '4': ['jogos', 'pessoal'], '6': ['jogos', 'pessoal', 'culinaria', 'financas'] };
  var KEY = 'obs-mock-nichos', here = location.pathname.split('/').pop();
  var asked = new URL(location.href).searchParams.get('nichos'), saved = null;
  try { saved = sessionStorage.getItem(KEY); } catch (e) { }
  var preset = PRESETS[asked] ? asked : PRESETS[saved] ? saved : '2';
  try { sessionStorage.setItem(KEY, preset); } catch (e) { }

  var BUILTIN = Object.keys(OBS.NICHES);                       // viagem, ia (ordem das abas)
  var custom = PRESETS[preset].map(function (id) { return EXTRA[id]; });
  var hex = function (h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
  var css = { dark: '', light: '', rules: '' };
  custom.forEach(function (n) {
    var c = PALETTE[n.tone];
    OBS.NICHES[n.id] = { id: n.id, label: n.label, color: { dark: c.dark, light: c.light }, custom: true };
    n.from.forEach(function (ch) { OBS.setNiche(ch, n.id); });
    css.dark += '--n-' + n.id + ':' + c.dark + ';--n-' + n.id + '-subtle:' + hex(c.dark, .13) + ';';
    css.light += '--n-' + n.id + ':' + c.light + ';--n-' + n.id + '-subtle:' + hex(c.light, .08) + ';';
    /* o mesmo desenho de .niche.viagem / .niche.ia e de .ch-nic-viagem / .ch-nic-ia, com a cor do nicho */
    css.rules += ':is(#screen,#drawer,#dlgs) .niche.' + n.id + '{background-color:var(--n-' + n.id + '-subtle);color:var(--n-' + n.id + ')}' +
      '#ch-app .ch-nic-' + n.id + '{color:var(--n-' + n.id + ')}';
  });
  custom.forEach(function (n) { OBS.TAB_COUNTS[n.id] = OBS.tabCounts(n.id); });
  if (custom.length) {
    BUILTIN.forEach(function (id) { OBS.TAB_COUNTS[id] = OBS.tabCounts(id); });
    var s = document.createElement('style');
    s.textContent = ':root{' + css.dark + '}' +
      '@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){' + css.light + '}}' +
      ':root[data-theme="light"]{' + css.light + '}' + css.rules;
    document.head.appendChild(s);
  }

  var ids = Object.keys(OBS.NICHES);
  window.MOCKNICHES = {
    preset: preset, palette: PALETTE,
    /** nichos na ordem das abas: os de fábrica, depois os criados */
    ids: ids,
    /** ordem em que a forja enumera: IA, Viagem, depois os demais */
    forjaOrder: ['ia', 'viagem'].concat(ids.filter(function (n) { return BUILTIN.indexOf(n) < 0; })),
    label: function (n) { return n === 'todos' ? 'Todos' : OBS.NICHES[n] ? OBS.NICHES[n].label : n; },
    isCustom: function (n) { return !!(OBS.NICHES[n] && OBS.NICHES[n].custom); },
    /** só os de fábrica têm lista de temas (catálogo fixo) */
    hasThemes: function (n) { return BUILTIN.indexOf(n) >= 0; },
    cssColor: function (n) { return n === 'ia' ? 'var(--ai)' : n === 'viagem' ? 'var(--travel)' : 'var(--n-' + n + ')'; },
    /** texto aprovado para Temas e Lacunas em nicho sem lista de temas */
    noThemesText: function (n) { return 'Ainda não há lista de temas para ' + OBS.NICHES[n].label + '. Padrões de título, o mapa de publicação e “Você no nicho” funcionam normalmente.'; },
    mockGroup: function () {
      return { label: 'Nichos do site', items: [['2', '2 (Viagem, IA)'], ['3', '3 (+ Jogos)'], ['4', '4 (+ Jogos, Pessoal)'], ['6', '6 (+ Jogos, Pessoal, Culinária, Finanças)']].map(function (x) { return { id: 'nichos:' + x[0], label: x[1], pressed: preset === x[0] }; }),
        note: 'Quantos nichos o site tem; a página recarrega. Jogos recebe 2 concorrentes que eram de IA e Culinária 1 que era de Viagem (só para os grupos existirem); Pessoal e Finanças ficam vazios, como um nicho recém-criado.' };
    },
    set: function (p) { if (!PRESETS[p]) return; try { sessionStorage.setItem(KEY, p); localStorage.removeItem('obs-niche'); } catch (e) { } var u = new URL(location.href); u.searchParams.set('nichos', p); u.searchParams.delete('niche'); u.searchParams.delete('channel'); location.replace(here + u.search); }
  };
})();
