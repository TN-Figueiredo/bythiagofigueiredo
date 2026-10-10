/* faixa-numeros.js — rodada 8. A faixa de números (valor em cima, rótulo embaixo, fio vertical entre as células) e o ⓘ com a base de cada número,
   para a tela do vídeo próprio. É a mesma marcação e o mesmo CSS do cabeçalho do canal (.nstrip, .nc, .ibtn, .pop.tip de canal.css);
   o posicionamento, o Esc, o clique fora e a camada são de flut.js (rodada 12).
   Regra: nenhuma célula entra sem base (b). O ⓘ nunca abre vazio: se faltar base, a montagem lança um erro à vista. */
(function(){
  'use strict';
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var INFO = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.6M8 5.1v.2"/></svg>';
  var dica = null, dono = null;
  function fechar(devolver){
    if (!dica) return;
    var d = dono; FLUT.fechar(false);
    if (devolver && d) d.focus();
  }
  function abrir(btn, html){
    if (dono === btn){ fechar(true); return; }
    fechar(false);
    dica = document.createElement('div'); dica.className = 'pop tip'; dica.id = 'tip'; dica.setAttribute('role', 'note'); dica.innerHTML = html;
    dono = btn; FLUT.abrir(btn, dica, { pref: 'baixo', alinhar: 'fim', descreve: true, aoFechar: function(){ dica = null; dono = null; } });
  }
  /* cells: [{ v: valor, l: rótulo, sub: segunda linha do rótulo (opcional), b: a base do número (obrigatória) }] */
  function montar(el, cells, o){
    o = o || {};
    cells.forEach(function(c){ if (!c.b) throw new Error('faixa-numeros: a célula "' + c.l + '" não tem base para o ⓘ'); });
    var corpo = '<h3>' + esc(o.titulo || 'De onde vêm os números') + '</h3><ul>' + cells.map(function(c){ return '<li><b>' + esc(c.l.charAt(0).toUpperCase() + c.l.slice(1)) + ':</b> ' + esc(c.b) + '</li>'; }).join('') + '</ul>';
    el.innerHTML = '<div class="vp-nrow"><div class="nclip"><dl class="nstrip" aria-label="' + esc(o.rotulo || 'Números') + '">' + cells.map(function(c){
      return '<div class="nc"><dt>' + esc(c.l) + (c.sub ? '<span class="nsub">' + esc(c.sub) + '</span>' : '') + '</dt><dd><b class="num">' + esc(c.v) + '</b></dd></div>';
    }).join('') + '</dl></div><div class="ntools"><button type="button" class="ibtn" aria-expanded="false" aria-label="' + esc(o.titulo || 'De onde vêm os números') + '">' + INFO + '</button></div></div>';
    var btn = el.querySelector('.ibtn');
    btn.addEventListener('click', function(e){ e.stopPropagation(); abrir(btn, corpo); });
  }
  window.FAIXA = { montar: montar, dica: abrir };
})();
