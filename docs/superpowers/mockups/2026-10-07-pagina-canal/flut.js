/* flut.js — rodada 12. Uma só implementação das superfícies flutuantes do mockup (dicas ⓘ, menus, dicas de gráfico e de régua).
   Regras (as mesmas que o produto deve cumprir; ver "Para o produto" no LEIAME):
   1. a superfície mora no contêiner #flut (fim do <body>), nunca dentro da linha, do cartão ou da tabela do gatilho;
   2. fica acima do gatilho: vira para cima quando não cabe embaixo, desloca-se na horizontal quando encostaria na borda, tem largura máxima
      (a da janela menos 16 px) e, se não couber nem em cima nem embaixo, ganha altura máxima com rolagem interna; nunca cobre o gatilho;
   3. reposiciona ao rolar e ao redimensionar; fecha com Esc, clique fora e perda de foco; uma aberta por vez; o foco volta ao gatilho. */
(function(){
  'use strict';
  var camada = null, aberto = null, ocultadores = [];
  function cam(){
    if (!camada || !camada.isConnected){ camada = document.getElementById('flut') || document.createElement('div'); camada.id = 'flut'; document.body.appendChild(camada); }
    return camada;
  }
  function montar(el){ cam().appendChild(el); return el; }
  function vp(){ return { w: document.documentElement.clientWidth, h: innerHeight }; }
  /* ancora: elemento ou retângulo. o: { pref: 'baixo'|'cima'|'lado', alinhar: 'fim'|'meio'|'inicio', cx: x do centro desejado, y: topo desejado (só 'lado'), gap, maxW } */
  function posicionar(el, ancora, o){
    o = o || {};
    var M = 8, G = o.gap == null ? 6 : o.gap, V = vp(), r = ancora.getBoundingClientRect ? ancora.getBoundingClientRect() : ancora;
    el.style.position = 'fixed'; el.style.maxWidth = Math.min(o.maxW || 9999, V.w - 2 * M) + 'px'; el.style.maxHeight = ''; el.style.overflowY = ''; el.style.left = '0px'; el.style.top = '0px';
    var w = el.offsetWidth, h = el.offsetHeight, x, y, pref = o.pref || 'baixo';
    if (pref === 'lado'){
      x = r.right + G;
      if (x + w > V.w - M) x = r.left - G - w;
      if (x >= M){
        y = o.y != null ? o.y : r.top;
        if (h > V.h - 2 * M){ el.style.maxHeight = (V.h - 2 * M) + 'px'; el.style.overflowY = 'auto'; h = el.offsetHeight; }
        y = Math.min(Math.max(M, y), V.h - h - M);
        el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; el.setAttribute('data-lado', 'lado'); return;
      }
      pref = 'baixo';   /* não coube de nenhum lado: cai para cima/baixo */
    }
    var abaixo = V.h - r.bottom - G - M, acima = r.top - G - M, cima;
    if (pref === 'cima') cima = h <= acima ? true : h <= abaixo ? false : acima >= abaixo;
    else cima = h <= abaixo ? false : h <= acima ? true : acima > abaixo;
    var espaco = cima ? acima : abaixo;
    if (h > espaco){ el.style.maxHeight = Math.max(80, espaco) + 'px'; el.style.overflowY = 'auto'; h = el.offsetHeight; }
    y = cima ? r.top - G - h : r.bottom + G;
    var al = o.alinhar || 'fim';
    x = o.cx != null ? o.cx - w / 2 : al === 'meio' ? r.left + r.width / 2 - w / 2 : al === 'inicio' ? r.left : r.right - w;
    x = Math.min(Math.max(M, x), V.w - w - M);
    y = Math.min(Math.max(M, y), V.h - h - M);
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; el.setAttribute('data-lado', cima ? 'cima' : 'baixo');
  }
  /* popover aberto por clique ou teclado (ⓘ, menu "…", "Meu canal"). Uma por vez. o: { pref, alinhar, aoFechar, onde } */
  function esconderDicas(){ ocultadores.forEach(function(f){ try { f(); } catch (e) {} }); }
  function fechar(devolver){
    if (!aberto) return;
    var a = aberto; aberto = null;
    if (a.el.parentNode && !a.o.manter) a.el.remove(); else if (a.o.manter) a.el.hidden = true;
    if (a.dono){ a.dono.setAttribute('aria-expanded', 'false'); a.dono.removeAttribute('aria-describedby'); }
    if (a.o.aoFechar) a.o.aoFechar();
    if (devolver && a.dono) a.dono.focus();
  }
  function abrir(dono, el, o){
    o = o || {}; fechar(false); esconderDicas();
    if (o.manter){ if (el.parentNode !== cam()) montar(el); el.hidden = false; } else montar(el);
    aberto = { dono: dono, el: el, o: o };
    if (dono){ dono.setAttribute('aria-expanded', 'true'); if (o.descreve) dono.setAttribute('aria-describedby', el.id); }
    posicionar(el, dono, o);
    return el;
  }
  function reposicionar(){
    if (!aberto) return;
    var r = aberto.dono.getBoundingClientRect(), V = vp();
    if (r.bottom < 0 || r.top > V.h || r.right < 0 || r.left > V.w){ fechar(false); return; }
    posicionar(aberto.el, aberto.dono, aberto.o);
  }
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && aberto){ e.preventDefault(); fechar(true); } }, true);
  document.addEventListener('mousedown', function(e){ if (aberto && !aberto.el.contains(e.target) && !(aberto.dono && aberto.dono.contains(e.target))) fechar(false); }, true);
  document.addEventListener('focusin', function(e){ if (aberto && !aberto.el.contains(e.target) && !(aberto.dono && aberto.dono.contains(e.target))) fechar(false); });
  addEventListener('scroll', function(e){ if (aberto && aberto.el.contains(e.target)) return; reposicionar(); }, { passive: true, capture: true });
  addEventListener('resize', reposicionar);
  window.FLUT = {
    camada: cam, montar: montar, posicionar: posicionar, abrir: abrir, fechar: fechar,
    aberto: function(){ return aberto; },
    aoAbrirEsconder: function(f){ ocultadores.push(f); }
  };
  if (document.body) cam(); else document.addEventListener('DOMContentLoaded', cam);
})();
