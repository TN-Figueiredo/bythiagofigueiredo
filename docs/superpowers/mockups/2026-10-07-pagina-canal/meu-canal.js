/* meu-canal.js — rodada 7. Atalho permanente "Meu canal" na moldura do Observatório, nas telas todas do mockup.
   Mora na linha da trilha, à direita (em produção, na lista, o lugar é o grupo de ações do cabeçalho, .obs-ch-actions).
   "Meu canal" é a pessoa agindo (botão, atalho); "seu canal" é a tela falando com ela. */
(function(){
  'use strict';
  var nav = document.querySelector('#screen nav.crumbs'); if (!nav) return;
  var aqui = /canal-proprio|video-proprio/.test(location.pathname);
  var CH = [
    { nome: 'tnFigueiredo', nota: '35 vídeos, 1,16 mil inscritos', href: 'canal-proprio.html' },
    { nome: 'Thiago Figueiredo', nota: 'sem vídeos, 3 inscritos: ainda sem página', href: null }
  ];
  var box = document.createElement('div'); box.className = 'mc';
  box.innerHTML = '<button type="button" class="mc-b" id="mcBtn" aria-haspopup="true" aria-expanded="false" aria-controls="mcMenu"><span class="mc-l">Meu canal:</span> <b>' + CH[0].nome + '</b>' +
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg></button>' +
    '<div class="mc-m" id="mcMenu" hidden><p class="mc-h">Meus canais</p><ul>' + CH.map(function(c){
      return '<li>' + (c.href ? '<a href="' + c.href + '"' + (aqui ? ' aria-current="page"' : '') + '>' : '<span class="off">') + '<b>' + c.nome + '</b><small>' + c.nota + '</small>' + (c.href ? '</a>' : '</span>') + '</li>';
    }).join('') + '<li class="sep"><a href="canais.html">Ver meus canais na lista de Canais</a></li></ul></div>';
  var ol = nav.querySelector('ol'); ol.insertAdjacentElement('afterend', box);
  var b = box.querySelector('#mcBtn'), m = box.querySelector('#mcMenu');
  /* o menu mora em #flut (flut.js): acima de tudo, dentro da janela; "manter" devolve o mesmo nó em vez de recriar */
  m.setAttribute('role', 'region'); m.setAttribute('aria-label', 'Meus canais');
  function fechar(foco){ FLUT.fechar(!!foco); }
  function abrirMenu(){
    FLUT.abrir(b, m, { pref: 'baixo', alinhar: 'fim', manter: true });
    var a = m.querySelector('a'); if (a) a.focus();
  }
  b.addEventListener('click', function(){ var ab = FLUT.aberto(); if (ab && ab.dono === b) fechar(false); else abrirMenu(); });
  function teclas(e){
    var ab = FLUT.aberto(); if (!ab || ab.dono !== b) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var as = [].slice.call(m.querySelectorAll('a')), i = as.indexOf(document.activeElement);
    e.preventDefault(); as[(i + (e.key === 'ArrowDown' ? 1 : as.length - 1)) % as.length].focus();
  }
  m.addEventListener('keydown', teclas); box.addEventListener('keydown', teclas);
})();
