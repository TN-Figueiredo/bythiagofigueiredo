/* prova-flutuantes.js — rodada 12. Conferência, NÃO faz parte da tela: nenhuma página a carrega. Cola-se no navegador:
     s = document.createElement('script'); s.src = 'prova-flutuantes.js?' + Date.now(); document.head.appendChild(s); s.onload = () => PROVA.rodar().then(console.log)
   Para cada flutuante da tela (ⓘ, menus, dicas de régua, de gráfico e de linha do tempo, lista de grupo) e para cada posição do gatilho
   (centro da janela, colado embaixo, colado em cima), abre, espera e confere:
     1. elementsFromPoint no centro e nos quatro cantos da caixa: o elemento do topo é a própria dica (ou um filho dela);
     2. a caixa está inteira dentro da janela (esquerda, topo, direita, base);
     3. a caixa mora em #flut (filho do <body>) e não cobre o gatilho;
     4. fecha com Esc, e nos popovers de clique o foco volta ao gatilho.
   Também confere, uma vez por família: clique fora fecha; abrir um segundo fecha o primeiro (uma aberta por vez).
   As dicas de mouse têm pointer-events:none (não roubam clique); a prova as liga durante o teste, senão elementsFromPoint não as veria. */
(function(){
  'use strict';
  var esperar = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function visivel(el){ var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]'); }
  function esc(){ var a = document.activeElement || document.body; a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); }
  function conferir(tip, gatilho){
    var r = tip.getBoundingClientRect(), W = document.documentElement.clientWidth, H = innerHeight;
    var dentro = r.width > 0 && r.height > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5;
    var pts = [[(r.left + r.right) / 2, (r.top + r.bottom) / 2], [r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]], topo = true, quem = '';
    pts.forEach(function(p){
      var x = Math.min(Math.max(p[0], 0), W - 1), y = Math.min(Math.max(p[1], 0), H - 1), els = document.elementsFromPoint(x, y), t = els[0];
      if (!(t && (t === tip || tip.contains(t)))){ topo = false; quem = (t ? t.tagName + '.' + (t.className && t.className.baseVal != null ? t.className.baseVal : t.className) : 'nada') + ' em ' + Math.round(x) + ',' + Math.round(y); }
    });
    var g = gatilho.getBoundingClientRect(), cobre = !(r.right <= g.left + 0.5 || r.left >= g.right - 0.5 || r.bottom <= g.top + 0.5 || r.top >= g.bottom - 0.5);
    var noFlut = !!tip.closest('#flut') && tip.closest('#flut').parentNode === document.body;
    return { ok: dentro && topo && !cobre && noFlut, dentro: dentro, topo: topo, cobre: cobre, noFlut: noFlut, quem: quem, caixa: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], janela: [W, H] };
  }
  var FAMILIAS = [
    { id: 'ⓘ (.ibtn)', sel: '.ibtn', modo: 'clique' },
    { id: 'menu "…" (vídeo e canal)', sel: '[data-acts],#chMenu', modo: 'clique', max: 6 },
    { id: 'menu "Meu canal"', sel: '#mcBtn', modo: 'clique' },
    { id: 'régua do vídeo', sel: '.rg[data-m]', modo: 'foco', tip: '.rg-tip' },
    { id: 'régua do nicho (comparação)', sel: '.rg.cmp', modo: 'foco', tip: '.rg-tip' },
    { id: 'gráfico de impressões (dia)', sel: '.ic-hit', modo: 'foco', tip: '.ic-tip', amostra: true },
    { id: 'linha do tempo: marcador', sel: '#lanes .mk, #lanes .gbtn', modo: 'foco', tip: '#tip.show', max: 8 },
    { id: 'linha do tempo: lista do grupo', sel: '#lanes .gbtn', modo: 'clique-grupo', tip: '.gpop.aberto', max: 6 }
  ];
  function escolher(lista, f){
    var v = lista.filter(visivelOuFora);
    if (f.amostra && v.length > 3){ v = [v[0], v[v.length >> 1], v[v.length - 1]]; }
    if (f.max && v.length > f.max){ var o = [], passo = (v.length - 1) / (f.max - 1); for (var i = 0; i < f.max; i++) o.push(v[Math.round(i * passo)]); v = o; }
    return v;
  }
  function visivelOuFora(el){ var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  var POS = [['centro', 'center'], ['colado embaixo', 'end'], ['colado em cima', 'start']];
  async function abrir(f, el){
    if (document.activeElement === el) el.blur();   /* depois do Esc o foco fica no gatilho: sem sair e voltar não há focusin */
    el.focus({ preventScroll: true });
    if (f.modo === 'foco'){ await esperar(50); return document.querySelector(f.tip); }
    el.click(); await esperar(60);
    if (f.modo === 'clique-grupo') return document.querySelector(f.tip);
    var a = window.FLUT && FLUT.aberto(); return a ? a.el : null;
  }
  async function rodar(){
    var st = document.createElement('style'); st.textContent = '#flut>*{pointer-events:auto!important}'; document.head.appendChild(st);
    var saida = { tela: location.pathname.split('/').pop() + location.search, janela: [document.documentElement.clientWidth, innerHeight], familias: [], total: 0, passou: 0, falhas: [] };
    for (var fi = 0; fi < FAMILIAS.length; fi++){
      var f = FAMILIAS[fi], els = escolher([].slice.call(document.querySelectorAll(f.sel)), f);
      if (!els.length) continue;
      var fam = { familia: f.id, flutuantes: els.length, checagens: 0, passou: 0 };
      for (var i = 0; i < els.length; i++){
        var el = els[i];
        for (var p = 0; p < POS.length; p++){
          el.scrollIntoView({ block: POS[p][1], inline: 'nearest' }); await esperar(40);
          if (!visivel(el)) continue;
          var tip = await abrir(f, el), res;
          fam.checagens++; saida.total++;
          if (!tip || !visivel(tip)) res = { ok: false, quem: 'a flutuante não abriu' };
          else res = conferir(tip, el);
          if (res.ok) { fam.passou++; saida.passou++; } else saida.falhas.push({ familia: f.id, gatilho: (el.getAttribute('aria-label') || el.textContent || el.id || el.className.baseVal || el.className || '').toString().trim().slice(0, 40), pos: POS[p][0], dentro: res.dentro, topo: res.topo, cobre: res.cobre, noFlut: res.noFlut, quem: res.quem, caixa: res.caixa });
          /* fecha com Esc e confere o foco (popover de clique devolve o foco ao gatilho) */
          esc(); await esperar(40);
          if (f.modo === 'clique-grupo'){ var g = el.closest('.gwrap'); if (g && g.classList.contains('open')){ el.click(); await esperar(30); } }
          if (f.modo === 'clique'){
            var aberta = window.FLUT && FLUT.aberto();
            fam.esc = (fam.esc == null ? true : fam.esc) && !aberta && document.activeElement === el;
          }
          if (document.activeElement && document.activeElement !== el && f.modo !== 'clique') document.activeElement.blur();
        }
      }
      saida.familias.push(fam);
    }
    /* clique fora e uma aberta por vez */
    var ib = [].slice.call(document.querySelectorAll('.ibtn')).filter(visivelOuFora);
    if (ib.length >= 2){
      ib[0].scrollIntoView({ block: 'center' }); await esperar(30); ib[0].focus(); ib[0].click(); await esperar(50);
      ib[1].scrollIntoView({ block: 'center' }); await esperar(30); ib[1].focus(); ib[1].click(); await esperar(50);
      saida.umaPorVez = document.querySelectorAll('#flut .pop').length === 1;
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await esperar(40);
      saida.cliqueFora = document.querySelectorAll('#flut .pop').length === 0;
    }
    st.remove();
    return saida;
  }
  window.PROVA = { rodar: rodar, conferir: conferir };
})();
