/* Visualizador de thumbnail (rodada 4): diálogo modal acessível, com zoom, arrastar, comparar, abrir o original e baixar.
   Usado pelo histórico do vídeo e pelo canal. Depende de window.HM (hist-dados.js) para as versões da thumbnail de cada vídeo.
   Resolução: pede maxresdefault (1280×720), cai para sddefault (640×480), hqdefault (480×360) e mqdefault (320×180) e mostra a que de fato carregou,
   com o tamanho medido da imagem. Nunca promete mais do que existe. */
(function(){
  'use strict';
  var HM = window.HM, esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var VARS = [['maxresdefault', 'a maior que o YouTube guarda, 16:9'], ['sddefault', '4:3, com barras pretas do próprio YouTube'], ['hqdefault', '4:3, com barras pretas do próprio YouTube'], ['mqdefault', '16:9, pequena']];
  var cache = {};
  var S = null, dlg = null, trigger = null, drag = null, pointers = {}, pinch0 = null, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ico(d){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16">' + d + '</svg>'; }
  var IC = { x: ico('<path d="M6 6l12 12M18 6L6 18"/>'), plus: ico('<path d="M12 5v14M5 12h14"/>'), minus: ico('<path d="M5 12h14"/>'), prev: ico('<path d="m15 18-6-6 6-6"/>'), next: ico('<path d="m9 18 6-6-6-6"/>'),
    ext: ico('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'), dl: ico('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'), cmp: ico('<rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/>'),
    zoom: ico('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/>') };
  window.VIEWER_ICON = IC.zoom;

  /* ---------------------------------------------------------------- carga da maior resolução disponível */
  function melhor(videoId){
    if (cache[videoId]) return cache[videoId];
    cache[videoId] = new Promise(function(res){
      var i = 0;
      (function tenta(){
        if (i >= VARS.length) return res(null);
        var u = 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/' + VARS[i][0] + '.jpg', im = new Image();
        im.onload = function(){ if (im.naturalWidth <= 120 && i < VARS.length - 1){ i++; tenta(); return; } res({ variant: VARS[i][0], nota: VARS[i][1], url: u, w: im.naturalWidth, h: im.naturalHeight }); };
        im.onerror = function(){ i++; tenta(); };
        im.src = u;
      })();
    });
    return cache[videoId];
  }

  /* ---------------------------------------------------------------- itens (uma por versão de thumbnail) */
  function itensDe(videoId){
    var v = HM.video(videoId), vs = HM.versions(videoId, 'thumb');
    return vs.map(function(p){
      return { videoId: videoId, label: p.label, cur: p.cur, arquivada: HM.archived(videoId, p.key), span: p.span, dur: p.dur, titulo: v.title, i: p.i };
    });
  }

  /* ---------------------------------------------------------------- diálogo */
  function montar(){
    dlg = document.createElement('div');
    dlg.className = 'vw'; dlg.hidden = true;
    dlg.innerHTML =
      '<div class="vw-back" data-vw="fechar"></div>' +
      '<div class="vw-box" role="dialog" aria-modal="true" aria-labelledby="vwT" aria-describedby="vwD">' +
        '<div class="vw-top"><div class="vw-ttl"><h2 id="vwT" tabindex="-1"></h2><p id="vwD"></p></div>' +
          '<button type="button" class="vw-b" data-vw="fechar" aria-label="Fechar visualizador">' + IC.x + '<span>Fechar</span></button></div>' +
        '<div class="vw-tools" role="toolbar" aria-label="Zoom e ações da imagem">' +
          '<div class="vw-grp" role="group" aria-label="Versão">' +
            '<button type="button" class="vw-b" data-vw="ant" aria-label="Versão anterior">' + IC.prev + '<span>Anterior</span></button>' +
            '<span class="vw-pos" id="vwPos" aria-hidden="true"></span>' +
            '<button type="button" class="vw-b" data-vw="prox" aria-label="Próxima versão"><span>Próxima</span>' + IC.next + '</button>' +
            '<button type="button" class="vw-b" data-vw="comparar" aria-pressed="false">' + IC.cmp + '<span>Comparar lado a lado</span></button>' +
            '<label class="vw-sel" id="vwCmpL" hidden><span>Comparar com</span><select id="vwCmp"></select></label>' +
          '</div>' +
          '<div class="vw-grp" role="group" aria-label="Zoom">' +
            '<button type="button" class="vw-b icon" data-vw="menos" aria-label="Diminuir o zoom">' + IC.minus + '</button>' +
            '<span class="vw-pct" id="vwPct">100%</span>' +
            '<button type="button" class="vw-b icon" data-vw="mais" aria-label="Aumentar o zoom">' + IC.plus + '</button>' +
            '<button type="button" class="vw-b" data-vw="ajustar">Ajustar</button>' +
            '<button type="button" class="vw-b" data-vw="cem">100%</button>' +
          '</div>' +
          '<div class="vw-grp" role="group" aria-label="Arquivo">' +
            '<a class="vw-b" id="vwExt" target="_blank" rel="noopener" href="#">' + IC.ext + '<span>Abrir original em nova aba<span class="sr"> (abre em nova aba)</span></span></a>' +
            '<button type="button" class="vw-b" data-vw="baixar">' + IC.dl + '<span>Baixar</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="vw-main" id="vwMain"></div>' +
        '<p class="vw-res" id="vwRes"></p>' +
        '<p class="sr" id="vwLive" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '</div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function(e){
      var b = e.target.closest('[data-vw]'); if (!b) return;
      var k = b.dataset.vw;
      if (k === 'fechar') fechar();
      else if (k === 'ant') ir(-1); else if (k === 'prox') ir(1);
      else if (k === 'mais') zoomBy(1.25); else if (k === 'menos') zoomBy(0.8);
      else if (k === 'ajustar') ajustar(); else if (k === 'cem') cem();
      else if (k === 'comparar') comparar(b.getAttribute('aria-pressed') !== 'true');
      else if (k === 'baixar') baixar();
    });
    dlg.querySelector('#vwCmp').addEventListener('change', function(){ S.outro = +this.value; desenhar(); });
    dlg.addEventListener('keydown', teclas);
    var main = dlg.querySelector('#vwMain');
    main.addEventListener('wheel', function(e){ if (S.cmp || !S.img) return; e.preventDefault(); var r = stage().getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, S.s * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    main.addEventListener('pointerdown', pdown); main.addEventListener('pointermove', pmove); main.addEventListener('pointerup', pup); main.addEventListener('pointercancel', pup);
    main.addEventListener('dblclick', function(e){ if (S.cmp || !S.img) return; if (Math.abs(S.s - S.fit) < 0.01) { var r = stage().getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, 1); } else ajustar(); });
    addEventListener('resize', function(){ if (S && !dlg.hidden) reajusta(); });
  }
  var stage = function(){ return dlg.querySelector('.vw-stage'); };
  var live = function(t){ var l = dlg.querySelector('#vwLive'); l.textContent = ''; setTimeout(function(){ l.textContent = t; }, 30); };

  /* ---------------------------------------------------------------- abrir e fechar */
  function open(videoId, indice, gatilho){
    if (!dlg) montar();
    var itens = itensDe(videoId);
    S = { videoId: videoId, itens: itens, i: Math.max(0, Math.min(itens.length - 1, indice == null ? itens.length - 1 : indice)), cmp: false, outro: 0, s: 1, fit: 1, x: 0, y: 0, img: null, info: null };
    trigger = gatilho || document.activeElement;
    dlg.hidden = false; document.documentElement.classList.add('vw-lock');
    ['app', 'mock'].forEach(function(id){ var el = document.getElementById(id); if (el) el.setAttribute('inert', ''); });
    desenhar();
    dlg.querySelector('#vwT').focus();
  }
  function fechar(){
    if (!dlg || dlg.hidden) return;
    dlg.hidden = true; document.documentElement.classList.remove('vw-lock');
    ['app', 'mock'].forEach(function(id){ var el = document.getElementById(id); if (el) el.removeAttribute('inert'); });
    var t = trigger; S = null; pointers = {}; pinch0 = null;
    if (t && document.body.contains(t)) t.focus(); else { var h = document.getElementById('h1'); if (h) h.focus(); }
  }

  /* ---------------------------------------------------------------- desenho */
  function legenda(it){
    return 'Capa ' + it.label + (it.cur ? ' (no ar)' : '') + ': ' + it.span + (it.dur ? '; no ar por ' + it.dur : '');
  }
  function painel(it, rotulo){
    if (!it.arquivada){
      return '<div class="vw-miss" role="img" aria-label="Capa ' + esc(it.label) + ': imagem anterior não arquivada"><div><b>Capa ' + esc(it.label) + ': imagem anterior não arquivada</b>' +
        '<p>A coleta só guarda a thumbnail a partir do momento em que a vê. Esta versão (' + esc(it.span) + ') saiu do ar antes disso, então não há imagem para mostrar nem para baixar.</p>' +
        '<p>O que se sabe dela é o período em que esteve no ar.</p></div></div>';
    }
    return '<div class="vw-fig">' + (rotulo ? '<p class="vw-lab">' + rotulo + '</p>' : '') + '<img alt="Capa ' + esc(it.label) + ': ' + esc(it.titulo) + '" draggable="false"></div>';
  }
  function desenhar(){
    var it = S.itens[S.i], n = S.itens.length, main = dlg.querySelector('#vwMain');
    dlg.querySelector('#vwT').textContent = 'Thumbnail: ' + it.titulo;
    dlg.querySelector('#vwD').textContent = legenda(it);
    dlg.querySelector('#vwPos').textContent = 'Capa ' + it.label + ' · ' + (S.i + 1) + ' de ' + n;
    var multi = n > 1;
    dlg.querySelector('[data-vw="ant"]').hidden = !multi; dlg.querySelector('[data-vw="prox"]').hidden = !multi; dlg.querySelector('#vwPos').hidden = !multi; dlg.querySelector('[data-vw="comparar"]').hidden = !multi;
    dlg.querySelector('[data-vw="ant"]').disabled = S.i === 0; dlg.querySelector('[data-vw="prox"]').disabled = S.i === n - 1;
    dlg.querySelector('[data-vw="comparar"]').setAttribute('aria-pressed', String(S.cmp));
    var sel = dlg.querySelector('#vwCmp'), lab = dlg.querySelector('#vwCmpL');
    lab.hidden = !S.cmp;
    if (S.cmp){
      if (S.outro === S.i || S.outro >= n) S.outro = S.i === 0 ? 1 : S.i - 1;
      sel.innerHTML = S.itens.map(function(x, k){ return k === S.i ? '' : '<option value="' + k + '"' + (k === S.outro ? ' selected' : '') + '>Capa ' + esc(x.label) + (x.arquivada ? '' : ' (não arquivada)') + '</option>'; }).join('');
    }
    var zoomOn = !S.cmp && it.arquivada;
    ['mais', 'menos', 'ajustar', 'cem'].forEach(function(k){ var b = dlg.querySelector('[data-vw="' + k + '"]'); b.disabled = !zoomOn; });
    S.img = null; S.info = null;
    if (S.cmp){
      var o = S.itens[S.outro];
      main.innerHTML = '<div class="vw-cmp">' + [it, o].map(function(x){ return '<div class="vw-side">' + painel(x, 'Capa ' + esc(x.label) + (x.cur ? ' (no ar)' : '')) + '<p class="vw-cap">' + esc(legenda(x)) + '</p></div>'; }).join('') + '</div>';
      dlg.querySelector('#vwPct').textContent = 'sem zoom';
      var imgs = main.querySelectorAll('.vw-side img'), arq = [it, o].filter(function(x){ return x.arquivada; });
      melhor(S.videoId).then(function(info){ if (!S || !S.cmp) return; arq.forEach(function(x, k){ if (imgs[k] && info) imgs[k].src = info.url; });
        infoRes(info, 'Comparação: só a imagem no ar tem arquivo; a outra versão não foi arquivada. '); atualizaLinks(info); });
      if (!arq.length) { infoRes(null, ''); }
      live('Comparando a capa ' + it.label + ' com a capa ' + o.label);
      return;
    }
    if (!it.arquivada){
      main.innerHTML = '<div class="vw-stage vw-only">' + painel(it) + '</div>';
      dlg.querySelector('#vwPct').textContent = '—';
      infoRes(null, 'Sem imagem arquivada desta versão. ');
      var ext = dlg.querySelector('#vwExt'); ext.removeAttribute('href'); ext.setAttribute('aria-disabled', 'true'); dlg.querySelector('[data-vw="baixar"]').disabled = true;
      live('Capa ' + it.label + ': imagem anterior não arquivada.');
      return;
    }
    main.innerHTML = '<div class="vw-stage" id="vwStage" tabindex="0" role="img" aria-label="Capa ' + esc(it.label) + ', ' + esc(it.titulo) + '. Setas movem a imagem, mais e menos dão zoom, 0 ajusta."><img alt="" draggable="false"></div>';
    dlg.querySelector('[data-vw="baixar"]').disabled = false; dlg.querySelector('#vwExt').removeAttribute('aria-disabled');
    infoRes(null, 'Carregando a imagem…');
    melhor(S.videoId).then(function(info){
      if (!S || S.cmp || S.itens[S.i] !== it) return;
      S.info = info;
      if (!info){ main.querySelector('.vw-stage').innerHTML = '<div class="vw-miss"><div><b>A imagem não carregou.</b><p>O YouTube não devolveu nenhuma resolução (ou o navegador está sem rede). Tente de novo mais tarde.</p></div></div>'; infoRes(null, 'Sem imagem. '); return; }
      var im = main.querySelector('.vw-stage img'); im.onload = function(){ S.img = im; reajusta(true); live('Imagem ' + info.variant + ', ' + info.w + ' por ' + info.h + ' pixels.'); }; im.src = info.url;
      infoRes(info, ''); atualizaLinks(info);
    });
  }
  function infoRes(info, pre){
    var p = dlg.querySelector('#vwRes');
    if (!info){ p.textContent = pre; return; }
    var def = info.variant === 'maxresdefault' ? 'maior resolução disponível' : 'o YouTube não tem versão maior deste vídeo';
    p.textContent = pre + 'Exibindo ' + info.variant + '.jpg, ' + info.w + '×' + info.h + ' px (' + def + '; ' + info.nota + '). Acima de 100% a imagem é aumentada: ganha tamanho, não detalhe.';
  }
  function atualizaLinks(info){ var a = dlg.querySelector('#vwExt'); if (info){ a.href = info.url; a.removeAttribute('aria-disabled'); } }

  /* ---------------------------------------------------------------- zoom e arrastar */
  function reajusta(primeira){
    var st = stage(), im = S && S.img; if (!st || !im) return;
    var W = st.clientWidth, H = st.clientHeight, nw = im.naturalWidth, nh = im.naturalHeight;
    var fit = Math.min(W / nw, H / nh); var antigoFit = S.fit; S.fit = fit;
    if (primeira || Math.abs(S.s - antigoFit) < 0.001) S.s = fit;
    aplica(true);
  }
  function limita(){
    var st = stage(), im = S.img, W = st.clientWidth, H = st.clientHeight, w = im.naturalWidth * S.s, h = im.naturalHeight * S.s;
    S.x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, S.x));
    S.y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, S.y));
  }
  function aplica(centro){
    var im = S.img; if (!im) return;
    if (centro){ var st = stage(); S.x = (st.clientWidth - im.naturalWidth * S.s) / 2; S.y = (st.clientHeight - im.naturalHeight * S.s) / 2; }
    limita();
    im.style.width = im.naturalWidth + 'px'; im.style.height = im.naturalHeight + 'px';
    im.style.transform = 'translate(' + S.x + 'px,' + S.y + 'px) scale(' + S.s + ')';
    var pct = Math.round(S.s * 100); dlg.querySelector('#vwPct').textContent = pct + '%';
    stage().classList.toggle('zoomed', S.s > S.fit + 0.01);
  }
  function zoomAt(px, py, ns){
    if (!S.img) return;
    ns = Math.max(S.fit * 0.5, Math.min(8, ns));
    var k = ns / S.s; S.x = px - (px - S.x) * k; S.y = py - (py - S.y) * k; S.s = ns; aplica(false);
  }
  function zoomBy(f){ var st = stage(); if (!st || !S.img) return; zoomAt(st.clientWidth / 2, st.clientHeight / 2, S.s * f); live('Zoom ' + Math.round(S.s * 100) + '%'); }
  function ajustar(){ if (!S.img) return; S.s = S.fit; aplica(true); live('Ajustado à janela, ' + Math.round(S.s * 100) + '%'); }
  function cem(){ var st = stage(); if (!S.img) return; zoomAt(st.clientWidth / 2, st.clientHeight / 2, 1); live('Tamanho real, 100%: um pixel da imagem por pixel da tela.'); }
  function pdown(e){ if (S.cmp || !S.img) return; var st = stage(); if (!st || !st.contains(e.target)) return; pointers[e.pointerId] = { x: e.clientX, y: e.clientY }; st.setPointerCapture && st.setPointerCapture(e.pointerId);
    var ids = Object.keys(pointers); if (ids.length === 2){ var a = pointers[ids[0]], b = pointers[ids[1]]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), s: S.s }; drag = null; } else drag = { x: e.clientX, y: e.clientY, ox: S.x, oy: S.y }; }
  function pmove(e){ if (!pointers[e.pointerId]) return; pointers[e.pointerId] = { x: e.clientX, y: e.clientY }; var ids = Object.keys(pointers);
    if (ids.length === 2 && pinch0){ var a = pointers[ids[0]], b = pointers[ids[1]], r = stage().getBoundingClientRect(); zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, pinch0.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d); }
    else if (drag){ S.x = drag.ox + e.clientX - drag.x; S.y = drag.oy + e.clientY - drag.y; aplica(false); } }
  function pup(e){ delete pointers[e.pointerId]; if (Object.keys(pointers).length < 2) pinch0 = null; if (!Object.keys(pointers).length) drag = null; }

  /* ---------------------------------------------------------------- versões, comparar, baixar, teclado */
  function ir(d){ var k = S.i + d; if (k < 0 || k >= S.itens.length) return; S.i = k; desenhar(); var h = dlg.querySelector('[data-vw="' + (d < 0 ? 'ant' : 'prox') + '"]'); if (h && !h.disabled) h.focus(); else dlg.querySelector('#vwT').focus(); live(legenda(S.itens[S.i])); }
  function comparar(on){ S.cmp = on; desenhar(); dlg.querySelector('[data-vw="comparar"]').focus(); }
  function baixar(){
    var info = S && S.info; if (!info) return;
    var nome = 'thumbnail-' + S.videoId + '-' + info.variant + '.jpg';
    fetch(info.url, { mode: 'cors' }).then(function(r){ if (!r.ok) throw 0; return r.blob(); }).then(function(b){
      var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
      live('Download iniciado: ' + nome);
    }).catch(function(){ window.open(info.url, '_blank', 'noopener'); live('O navegador não deixou baixar direto. A imagem abriu em outra aba: salve por lá.'); });
  }
  function teclas(e){
    if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fechar(); return; }
    if (e.key === 'Tab'){
      var f = [].slice.call(dlg.querySelectorAll('button:not([disabled]):not([hidden]), a[href], select, [tabindex="0"], #vwT')).filter(function(x){ return x.offsetParent !== null; });
      if (!f.length) return; var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement.id === 'vwT')){ e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z){ e.preventDefault(); a.focus(); }
      return;
    }
    var st = document.getElementById('vwStage'), noStage = document.activeElement === st;
    if (e.key === '+' || e.key === '='){ e.preventDefault(); zoomBy(1.25); } else if (e.key === '-' || e.key === '_'){ e.preventDefault(); zoomBy(0.8); }
    else if (e.key === '0'){ e.preventDefault(); ajustar(); } else if (e.key === '1'){ e.preventDefault(); cem(); }
    else if (noStage && S && S.img && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) >= 0){
      e.preventDefault();
      if (S.s > S.fit + 0.01){ var p = 60; if (e.key === 'ArrowLeft') S.x += p; if (e.key === 'ArrowRight') S.x -= p; if (e.key === 'ArrowUp') S.y += p; if (e.key === 'ArrowDown') S.y -= p; aplica(false); }
      else if (e.key === 'ArrowLeft') ir(-1); else if (e.key === 'ArrowRight') ir(1);
    }
  }

  /* ---------------------------------------------------------------- gatilhos: qualquer elemento com data-amp="<videoId>:<índice>" */
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-amp]'); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    var p = t.dataset.amp.split(':'); open(p[0], p[1] === '' || p[1] == null ? null : +p[1], t);
  }, true);
  document.addEventListener('keydown', function(e){
    var t = e.target.closest && e.target.closest('[data-amp][role="button"]'); if (!t || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); var p = t.dataset.amp.split(':'); open(p[0], p[1] === '' || p[1] == null ? null : +p[1], t);
  });
  window.VIEWER = { open: open, close: fechar, melhor: melhor };
})();
