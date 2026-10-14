/* m19.js: peças comuns do mockup 19 (PLANO-DAS-TELAS seções 1 e 4; spec 04 §14.1 a §14.3). Hoje = 14/10/2026 no caso "hoje". Todo número de mês arquivado é exemplo. */
(function(){
  'use strict';
  var P = new URLSearchParams(location.search);
  function Q(k, d){ return P.get(k) || d; }
  if (Q('tema', '') === 'claro') document.documentElement.setAttribute('data-theme', 'light');
  if (Q('cinza', '') === '1') document.documentElement.classList.add('m-cinza');
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ------------------------------------------------------------ ícones: os 9 estados da legenda; a caixa de arquivo e o meio-círculo são os dois novos (PLANO 1.3) */
  var PATH = {
    ok: '<circle cx="8" cy="8" r="6.2"/><path d="M5.2 8.3 7.2 10.3 10.9 6"/>',
    pont: '<circle cx="8" cy="8" r="6.2" stroke-dasharray="2.4 2.2"/>',
    pontA: '<circle cx="8" cy="8" r="6.2" stroke-dasharray="1 2.2" style="stroke-width:2.2"/><path d="M8 6.2v2.4M8 10.4v.1" style="stroke-width:1.6"/>',
    tri: '<path d="M8 2.2 14.4 13.4H1.6Z"/><path d="M8 6.6v3.2M8 11.5v.1"/>',
    oct: '<path d="M5.2 1.8h5.6l3.4 3.4v5.6l-3.4 3.4H5.2L1.8 10.8V5.2z"/><path d="M8 4.8v3.8M8 11v.1"/>',
    arq: '<rect x="2" y="3" width="12" height="3.5" rx="1"/><path d="M3 6.5V13h10V6.5M6.5 9.5h3"/>',
    half: '<circle cx="8" cy="8" r="6.2" style="stroke-width:2"/><path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" style="fill:currentColor;stroke:none"/>',
    info: '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.9v.1"/>',
    vol: '<path d="M3 8h8M7 4.5 3.4 8 7 11.5"/><path d="M13 3v10" />'
  };
  var COR = { ok: 'm-c-ok', pont: 'm-c-pt', pontA: 'm-c-am', tri: 'm-c-am', oct: 'm-c-vm', arq: 'm-c-ar', half: 'm-c-pt' };
  function ic(kind, g){
    if (kind === 'nm') return '<span class="m-hach' + (g ? ' g' : '') + '" role="img" aria-label="não medido"></span>';
    if (kind === 'bar') return '<span style="display:inline-flex;height:24px;align-items:center"><span class="m-bar" style="width:30px;min-width:30px" role="img" aria-label="copiando"><i style="width:45%"></i></span></span>';
    if (kind === 'zero') return '<span class="m-zero' + (g ? ' g' : '') + '" role="img" aria-label="zero medido">0</span>';
    var k = kind;
    return '<svg class="m-ico ' + (g ? 'g ' : '') + (COR[kind] || '') + '" viewBox="0 0 16 16" role="img" aria-label="' + ({ ok: 'feito', pont: 'falta', pontA: 'falta e devia estar', tri: 'atenção', oct: 'parado', arq: 'no arquivo', half: 'em leitura mensal', info: 'informação' }[kind] || '') + '">' + PATH[k] + '</svg>';
  }
  function ib(id, rot){ return '<button type="button" class="m-ibtn" data-info="' + id + '" aria-expanded="false" aria-label="' + esc(rot) + '"><svg viewBox="0 0 16 16" aria-hidden="true">' + PATH.info + '</svg></button>'; }
  function infoBox(id, html){ return '<span class="m-info" id="' + id + '" hidden>' + html + '</span>'; }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-info]'); if (!b) return;
    var el = document.getElementById(b.getAttribute('data-info')); if (!el) return;
    var abre = el.hasAttribute('hidden'); if (abre) el.removeAttribute('hidden'); else el.setAttribute('hidden', ''); b.setAttribute('aria-expanded', String(abre));
  });

  /* ------------------------------------------------------------ a régua de etapas: steps = [[forma, rótulo, curto, problema?]] */
  function regua(steps, aria){
    var ant = 'ok';
    return '<ol class="m-reg" aria-label="' + esc(aria || 'Etapas do mês') + '">' + steps.map(function(s, i){
      var pend = i > 0 && ['ok', 'arq', 'zero'].indexOf(steps[i - 1][0]) < 0;
      return '<li class="' + (pend ? 'pend ' : '') + (s[3] ? 'prob' : '') + '">' + ic(s[0], true) + '<span class="m-rl">' + (s[2] && s[2] !== s[1] ? '<span class="l">' + esc(s[1]) + '</span><span class="s" aria-hidden="true">' + esc(s[2]) + '</span>' : esc(s[1])) + '</span></li>'; }).join('') + '</ol>';
  }
  function barra(pct, ind){ return '<div class="m-bar' + (ind ? ' ind' : '') + '" role="progressbar" aria-label="progresso"' + (ind ? '' : ' aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"') + '><i style="width:' + (ind ? 35 : pct) + '%"></i></div>'; }

  /* ------------------------------------------------------------ ausências em linha */
  function aus(tipo, html, peq, ik){
    var m = { nm: '<span class="m-hach" role="img" aria-label="não medido"></span>', arq: ic('arq'), zr: ic('zero'), pt: ic('pont'), am: ic('tri'), vm: ic('oct') };
    return '<p class="m-ausente ' + tipo + '">' + (ik || m[tipo]) + '<span class="m-btxt">' + html + (peq ? '<small>' + peq + '</small>' : '') + '</span></p>';
  }

  /* ------------------------------------------------------------ a barra "Estados do mockup" (fora da tela). grupos = [[rótulo, param, [[valor, texto]], atual, extra]] */
  function href(m){ var u = new URLSearchParams(location.search); Object.keys(m).forEach(function(k){ if (m[k] == null || m[k] === '') u.delete(k); else u.set(k, m[k]); }); var s = u.toString(); return '?' + s; }
  function grupo(rot, param, itens, atual, extra){
    return '<div class="m-mk-row"><span class="m-mk-lbl">' + rot + '</span><div class="m-mk-items">' + itens.map(function(i){
      var m = {}; m[param] = i[0]; if (extra) Object.keys(extra).forEach(function(k){ m[k] = extra[k]; });
      return '<a class="m-mk" href="' + href(m) + '"' + (String(atual) === String(i[0]) ? ' aria-current="true"' : '') + '>' + i[1] + '</a>'; }).join('') + '</div></div>';
  }
  function mock(resumo, grupos, nota){
    return '<details id="mock"' + (Q('barra', '') === 'aberta' ? ' open' : '') + '><summary>Estados do mockup (fora da tela)<b>' + resumo + '</b></summary><div class="m-mk-in">' +
      grupos.join('') + grupo('Tema', 'tema', [['', 'Escuro'], ['claro', 'Claro']], Q('tema', '') === 'claro' ? 'claro' : '') + grupo('Escala de cinza', 'cinza', [['', 'Cores'], ['1', 'Cinza']], Q('cinza', '')) +
      '<p class="m-mk-nota">' + nota + '</p></div></details>';
  }

  /* ------------------------------------------------------------ casca do Observatório (resumida) */
  function obs(atual, caso, semArq){
    var hoje = caso === 'cheio' ? '15%' : '66%';
    var links = [['Canais', 'canais'], ['Vídeos', 'videos'], ['Arquivo', 'arquivo']].filter(function(l){ return !(semArq && l[1] === 'arquivo'); });
    return '<header class="m-obs"><h1>Observatório</h1><nav aria-label="Telas do Observatório">' + links.map(function(l){ return '<a href="#" onclick="return false"' + (atual === l[1] ? ' aria-current="page"' : '') + '>' + l[0] + '</a>'; }).join('') + '</nav>' +
      '<div class="m-fresh"><span class="m-chip">Banco ' + hoje + '</span><span class="m-chip">Automático ligado</span></div></header>';
  }

  /* ------------------------------------------------------------ legenda única "Como ler as formas" (PLANO 1.3) */
  function legenda(aberta){
    var it = [
      ['ok', 'Feita e válida', 'círculo com visto; a linha fica em texto normal, sem verde.'],
      ['pont', 'Falta, ainda vai chegar', 'círculo pontilhado, contorno neutro.'],
      ['pontA', 'Falta e devia estar', 'círculo de pontos mais curtos e densos, com “!” dentro, em âmbar (o pontilhado neutro não tem “!”).'],
      ['tri', 'Atrasada ou vencendo', 'triângulo com “!”, âmbar.'],
      ['oct', 'Parada, ou o arquivo não bate', 'octógono com “!”, vermelho; o texto da linha fica em texto normal.'],
      ['nm', 'Não medido', 'hachura rosa, sempre com o que não foi lido.'],
      ['arq', 'No arquivo', 'caixa de arquivo, contorno sólido neutro sobre fundo apagado.'],
      ['zero', 'Zero medido, ou sem registro neste mês', 'caixa vazada com o 0 dentro.'],
      ['half', 'Em leitura mensal', 'círculo com a metade cheia.']
    ];
    return '<details class="m-leg"' + (aberta ? ' open' : '') + '><summary>Como ler as formas</summary><div class="m-leg-in"><ul>' + it.map(function(i){
      return '<li>' + ic(i[0]) + '<span><b>' + i[1] + '</b>: ' + i[2] + '</span></li>'; }).join('') + '</ul>' +
      '<ul><li>' + ic('ok') + '<span><b>Conferido pela forja</b> e <b>conferido por você</b>: o mesmo visto, sem cor própria. A origem está no texto da linha.</span></li>' +
      '<li>' + ic('tri') + '<span><b>A casa não respondeu</b>: triângulo até 36 horas; octógono a partir de 36 horas, sempre com a data e a hora do último sinal. ' + ib('i-36', 'Por que 36 horas') + '</span></li></ul>' + infoBox('i-36', 'A casa é a forja e o NAS; o site não sabe qual dos dois está parado. As 36 horas são o mesmo limite do motivo que desliga o automático.') +
      '<div class="m-prova" aria-label="Prova a 16 px: pontilhado, meio-círculo e caixa de arquivo lado a lado"><span>' + ic('pont') + 'pontilhado</span><span>' + ic('half') + 'leitura mensal</span><span>' + ic('arq') + 'no arquivo</span><span>' + ic('zero') + 'zero medido</span><span><span class="m-hach"></span>não medido</span><span>Prova a 16 px: as três primeiras nunca se confundem, nem em escala de cinza.</span></div>' +
      '</div></details>';
  }

  /* ------------------------------------------------------------ quadro (um estado) */
  function quadro(id, titulo, fonte, corpo, extra){
    return '<section class="m-q" id="q-' + id + '"><header class="m-q-h"><span class="m-q-id">' + id.toUpperCase() + '</span><h3 class="m-q-t">' + titulo + '</h3>' + (fonte ? '<span class="m-q-f">' + fonte + '</span>' : '') + '</header><div class="m-q-b">' + corpo + (extra || '') + '</div></section>';
  }
  function focus(){ var t = document.querySelector('[data-foco]'); if (t) t.focus(); }

  window.M = { P: P, Q: Q, esc: esc, ic: ic, ib: ib, infoBox: infoBox, regua: regua, barraProg: barra, aus: aus, mock: mock, grupo: grupo, href: href, obs: obs, legenda: legenda, quadro: quadro };
})();
