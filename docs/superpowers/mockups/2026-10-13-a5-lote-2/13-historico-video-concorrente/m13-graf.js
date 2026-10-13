/* m13-graf.js: os quatro desenhos do mockup 13 (curva por idade, 72 horas, dia a dia com raias, semana a semana). Tudo em SVG gerado aqui, sem biblioteca.
   Convenções: o vídeo é azul (--lado-b, círculo); o normal do canal é areia (--lado-n, quadrado tracejado); zero medido = caixa vazada; não medido = hachura rosa;
   "ainda não existe" = contorno pontilhado; mudança de campo = --tr com forma (losango título, triângulo miniatura, círculo outras) e o número da ordem. */
(function(){
  'use strict';
  var A = window.A4, esc = A.esc, G = window.M13G = {}, NS = 'http://www.w3.org/2000/svg';
  function mk(tag, attrs, txt){ var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function(k){ e.setAttribute(k, attrs[k]); }); if (txt != null) e.textContent = txt; return e; }
  function nice(m){ var e = Math.pow(10, Math.floor(Math.log(m) / Math.LN10)), f = m / e, g = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 6 ? 6 : f <= 8 ? 8 : 10; return Math.max(4, g * e); }
  function vn(n){ return n >= 1e6 ? A.dec(n / 1e6, n >= 1e7 ? 1 : 2).replace(/,0+$/, '').replace(/(,\d)0$/, '$1') + (n >= 2e6 ? ' milhões' : ' milhão') : n >= 10000 ? A.mil(n) : A.n(n); }
  G.vn = vn;
  /* C5: a frase de leitura segue o ponteiro (dedo ou mouse); G.passe() também serve às frases de cada bloco */
  G.dedo = function(){ try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; } };
  G.passe = function(){ return G.dedo() ? 'Toque em' : 'Passe o mouse sobre'; };
  function vazio(){ return G.dedo() ? 'Toque no gráfico ou use as setas para ler um ponto.' : 'Passe o mouse sobre o gráfico ou use as setas para ler um ponto.'; }

  /* esqueleto comum: cartão do gráfico com o rodapé de leitura (anterior / seguinte) e a tabela */
  G.casca = function(host, o){
    host.innerHTML = '<figure class="ic" style="margin:0" aria-labelledby="' + o.id + 't"><h3 class="sr" id="' + o.id + 't">' + esc(o.titulo) + '</h3>' +
      '<div class="ic-sc"><div class="ic-grupo" role="group" tabindex="0" aria-label="' + esc(o.aria) + '"></div></div>' +
      '<div class="ic-step"><button type="button" data-p="-1" aria-label="' + esc(o.ant) + '">' + A.L + '</button><p class="ic-out vazio" role="status" aria-live="polite">' + vazio() + '</p><button type="button" data-p="1" aria-label="' + esc(o.seg) + '">' + A.R + '</button></div>' +
      '<div class="ic-leg">' + o.legenda + '</div>' +
      '<details class="ic-tab"><summary>Ver como tabela</summary><div class="ic-tw" role="region" tabindex="0" aria-label="' + esc(o.titulo) + ', em tabela">' + o.tabela + '</div></details></figure>';
    return { grupo: host.querySelector('.ic-grupo'), out: host.querySelector('.ic-out'), prev: host.querySelector('[data-p="-1"]'), next: host.querySelector('[data-p="1"]') };
  };
  /* liga leitura por ponto: n pontos, fala(i) devolve o texto, pinta(i) marca o ponto no desenho */
  G.leitura = function(el, n, fala, pinta, sel0){
    var sel = sel0 == null ? -1 : sel0;
    function mostra(){ el.out.className = 'ic-out' + (sel < 0 ? ' vazio' : ''); el.out.innerHTML = sel < 0 ? vazio() : '<span>' + esc(fala(sel)) + '</span>'; el.prev.setAttribute('aria-disabled', String(sel === 0)); el.next.setAttribute('aria-disabled', String(sel === n - 1)); pinta(sel); }
    function ir(i){ sel = Math.max(0, Math.min(n - 1, i)); mostra(); }
    el.prev.addEventListener('click', function(){ if (el.prev.getAttribute('aria-disabled') !== 'true') ir(sel < 0 ? n - 1 : sel - 1); });
    el.next.addEventListener('click', function(){ if (el.next.getAttribute('aria-disabled') !== 'true') ir(sel < 0 ? 0 : sel + 1); });
    el.grupo.addEventListener('keydown', function(e){ var k = e.key; if (k === 'ArrowLeft') { ir(sel < 0 ? n - 1 : sel - 1); e.preventDefault(); } else if (k === 'ArrowRight') { ir(sel < 0 ? 0 : sel + 1); e.preventDefault(); } else if (k === 'Home') { ir(0); e.preventDefault(); } else if (k === 'End') { ir(n - 1); e.preventDefault(); } else if (k === 'Escape') { sel = -1; mostra(); } });
    return { ir: ir, mostra: mostra, atual: function(){ return sel; } };
  };
  function hachura(svg, uid){ var defs = mk('defs'), pat = mk('pattern', { id: uid + 'h', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }); pat.appendChild(mk('rect', { width: 6, height: 6, 'class': 'ic-hb' })); pat.appendChild(mk('line', { x1: 0, y1: 0, x2: 0, y2: 6, 'class': 'ic-hl' })); defs.appendChild(pat); svg.appendChild(defs); }
  function redesenha(host, draw){ draw(); var u = host.clientWidth; if (window.ResizeObserver) new ResizeObserver(function(){ if (Math.abs(host.clientWidth - u) > 2) { u = host.clientWidth; draw(); } }).observe(host); }

  /* ======================================================================= 1. curva por idade
     cfg: { id, idades: [{ a, rot, v (views do vídeo | null), vst: 'ok'|'nm'|'fut', nor (normal | null), n, fala }], linha: [{ a, v }] (pontos diários do vídeo, só para a linha), semNormal, sel } */
  G.idade = function(host, cfg){
    var ids = cfg.idades, n = ids.length, uid = cfg.id;
    var el = G.casca(host, { id: uid, titulo: 'Views por idade, o vídeo contra o normal do canal', aria: 'Views por idade: ' + n + ' idades. Setas andam de idade em idade.', ant: 'Idade anterior', seg: 'Idade seguinte',
      legenda: '<span class="ic-lg"><i class="hv-sw-vid" aria-hidden="true"></i>este vídeo (círculo)</span>' + (cfg.semNormal ? '' : '<span class="ic-lg"><i class="hv-sw-nor" aria-hidden="true"></i>o normal do canal (quadrado tracejado)</span>') +
        '<span class="ic-lg"><i class="nm-h" aria-hidden="true"></i>não medido</span><span class="ic-lg"><i class="hv-sw-ai" aria-hidden="true"></i>ainda não existe</span>' + (cfg.semNormal ? '' : '<span class="ic-lg">n = vídeos do canal no normal</span>') + '',
      tabela: '<table><thead><tr><th scope="col">Idade</th><th scope="col" class="r">Este vídeo</th>' + (cfg.semNormal ? '' : '<th scope="col" class="r">Normal do canal</th><th scope="col" class="r">n</th>') + '</tr></thead><tbody>' +
        ids.map(function(x){ return '<tr><th scope="row">' + x.rot + '</th><td class="r num">' + (x.vst === 'ok' ? A.n(x.v) : x.vst === 'fut' ? '<span class="ex">ainda não existe</span>' : A.nm()) + '</td>' + (cfg.semNormal ? '' : '<td class="r num">' + (x.nor == null ? A.nm() : A.n(x.nor)) + '</td><td class="r num">' + x.n + '</td>') + '</tr>'; }).join('') + '</tbody></table>' });
    var pinta;
    function draw(){
      var W = Math.max(280, Math.floor(host.clientWidth || 640)), vals = [1]; ids.forEach(function(x){ if (x.v != null) vals.push(x.v); if (x.nor != null) vals.push(x.nor); });
      var max = nice(Math.max.apply(null, vals) * 1.08), L = 14 + 7.4 * A.n(max).length, R = 8, T = 22, PH = W < 520 ? 150 : 180, AX = 22, NR = 32, H = T + PH + AX + NR + 4, sw = (W - L - R) / n;
      var X = function(i){ return L + sw * (i + .5); }, Y = function(v){ return T + PH - v / max * PH; }, base = T + PH, hits = [];
      var svg = mk('svg', { 'class': 'ic-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' }); hachura(svg, uid);
      [0, .5, 1].forEach(function(f){ var y = T + PH - f * PH; svg.appendChild(mk('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'ic-grid' })); svg.appendChild(mk('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'class': 'ic-ax' }, A.n(Math.round(max * f)))); });
      /* linha do vídeo: um traço por trecho contínuo de pontos medidos; a do normal idem */
      function trecho(cls, pega){ var seg = []; function fecha(){ if (seg.length > 1) svg.appendChild(mk('polyline', { points: seg.join(' '), 'class': cls })); seg = []; } ids.forEach(function(x, i){ var v = pega(x); if (v == null) fecha(); else seg.push(X(i).toFixed(1) + ',' + Y(v).toFixed(1)); }); fecha(); }
      if (!cfg.semNormal) trecho('hv-nor', function(x){ return x.nor; });
      trecho('hv-vid', function(x){ return x.vst === 'ok' ? x.v : null; });
      /* R2-S3: todos os quadrados do normal primeiro, depois os círculos do vídeo: o círculo nunca fica por baixo do quadrado */
      ids.forEach(function(x, i){ if (!cfg.semNormal && x.nor != null) svg.appendChild(mk('rect', { x: X(i) - 5, y: Y(x.nor) - 5, width: 10, height: 10, rx: 1.5, 'class': 'hv-nor-p' })); });
      ids.forEach(function(x, i){
        var cx = X(i);
        if (x.vst === 'ok') svg.appendChild(mk('circle', { cx: cx, cy: Y(x.v), r: 5, 'class': 'hv-vid-p' }));
        else if (x.vst === 'fut') svg.appendChild(mk('circle', { cx: cx, cy: base - 10, r: 6, 'class': 'hv-ainda' }));
        else { svg.appendChild(mk('rect', { x: cx - 8, y: base - 18, width: 16, height: 16, rx: 3, fill: 'url(#' + uid + 'h)', 'class': 'ic-nm' })); }
        /* rótulos de idade e n do normal */
        svg.appendChild(mk('text', { x: cx, y: base + 16, 'text-anchor': 'middle', 'class': 'ic-ax' }, sw < 40 ? String(x.a) : x.rot));
        if (!cfg.semNormal) {
          svg.appendChild(mk('text', { x: cx, y: base + AX + 14, 'text-anchor': 'middle', 'class': 'hv-nrow' }, String(x.n)));
          if (x.nor == null) svg.appendChild(mk('rect', { x: cx - 9, y: base + AX + 18, width: 18, height: 4, rx: 1, fill: 'url(#' + uid + 'h)', 'class': 'ic-nm' }));
        }
      });
      /* valores do último ponto medido do vídeo e do normal na mesma idade.
         C1: a curva sobe para a direita, então o rótulo de cima fica à esquerda do marcador e o de baixo à direita: nenhum atravessa a linha nem o marcador do outro */
      var ult = -1; ids.forEach(function(x, i){ if (x.vst === 'ok') ult = i; });
      if (ult >= 0) {
        var u = ids[ult], cx = X(ult), yv = Y(u.v), yn = u.nor == null ? null : Y(u.nor), clamp = function(y){ return Math.max(T + 10, Math.min(base - 5, y)); };
        var pon = function(txt, y, cima, cls, yAlt){
          var w = txt.length * 7.3 + 4, anc = cima ? 'end' : 'start', x = cima ? cx + 7 : cx - 7;
          if (cima && x - w < L - 2) { anc = 'start'; x = cx - 7; } else if (!cima && x + w > W - R) { anc = 'end'; x = cx + 7; if (yAlt != null) y = yAlt; /* r6-S5: o rótulo de baixo, jogado para a esquerda do último ponto, seria cruzado pela linha que sobe até ele; vai para cima do marcador */ }
          svg.appendChild(mk('text', { x: x, y: clamp(y), 'text-anchor': anc, 'class': cls }, txt));
        };
        if (yn == null) pon(vn(u.v), yv - 10, true, 'hv-lab');
        else {
          var vUp = yv <= yn, entre = Math.abs(yv - yn) >= 40, cimaV = vUp ? !entre : entre, cimaN = vUp ? entre : !entre;
          pon(vn(u.v), cimaV ? yv - 10 : yv + 20, cimaV, 'hv-lab', yv - 10); pon(vn(u.nor), cimaN ? yn - 10 : yn + 20, cimaN, 'hv-labn');
        }
      }
      if (!cfg.semNormal) svg.appendChild(mk('text', { x: 2, y: base + AX + 14, 'class': 'hv-nrow' }, 'n'));
      if (sw < 40) svg.appendChild(mk('text', { x: L - 6, y: base + 16, 'text-anchor': 'end', 'class': 'hv-rot' }, 'dias'));
      ids.forEach(function(x, i){ var r = mk('rect', { x: L + sw * i, y: T - 4, width: sw, height: PH + AX + NR + 6, 'class': 'ic-hit' }); r.addEventListener('pointerdown', function(){ ctl.ir(i); }); r.addEventListener('pointerenter', function(e){ if (e.pointerType === 'mouse') ctl.ir(i); }); svg.appendChild(r); hits.push(r); });
      el.grupo.innerHTML = ''; el.grupo.appendChild(svg); pinta = function(s){ hits.forEach(function(r, k){ r.setAttribute('class', 'ic-hit' + (k === s ? ' on' : '')); }); }; pinta(ctl.atual());
    }
    var ctl = G.leitura(el, n, function(i){ return ids[i].fala; }, function(s){ if (pinta) pinta(s); }, cfg.sel);
    redesenha(host, draw); ctl.mostra();
  };

  /* ======================================================================= 2. primeiras 72 horas, hora a hora
     cfg: { id, horas: v.horas, pub: {d, h, m}, jFirst, fala(j) -> texto, metade: hora (em horas desde a publicação) | null } */
  G.horas = function(host, cfg){
    var hs = cfg.horas, n = hs.length, uid = cfg.id;
    var el = G.casca(host, { id: uid, titulo: 'Views hora a hora nas primeiras 72 horas', aria: 'Views por hora nas primeiras 72 horas, em horário de São Paulo. Setas andam de hora em hora.', ant: 'Hora anterior', seg: 'Hora seguinte',
      legenda: '<span class="ic-lg"><i class="ic-sw imp" aria-hidden="true"></i>hora com views</span><span class="ic-lg"><i class="ic-sw zero" aria-hidden="true"></i>zero medido</span><span class="ic-lg"><i class="nm-h" aria-hidden="true"></i>não medido (antes da primeira contagem)</span><span class="ic-lg"><i class="ic-sw pub" aria-hidden="true"></i>publicação</span>',
      tabela: '<table><thead><tr><th scope="col">Hora (São Paulo)</th><th scope="col" class="r">Views nessa hora</th></tr></thead><tbody>' + hs.map(function(x){ return '<tr><th scope="row" class="num">' + (cfg.rot ? cfg.rot(x) : A.dm(x.d) + ' ' + cfg.hh(x)) + '</th><td class="r num">' + (x.e === 'nm' ? A.nm() : A.n(x.v)) + '</td></tr>'; }).join('') + '</tbody></table>' });
    var pinta;
    function draw(){
      var W = Math.max(280, Math.floor(host.clientWidth || 640)), vmax = Math.max.apply(null, hs.map(function(x){ return x.e === 'com' ? x.v : 0; }).concat([1])), max = nice(vmax * 1.2); /* R2-B2: folga em cima para o rótulo do pico nunca encostar em "1/2 das views" */
      var L = 14 + 7.4 * A.n(max).length, R = 6, T = 34, PH = W < 520 ? 130 : 160, AX = 36, H = T + PH + AX + 2, u = (W - L - R) / hs[n - 1].t, base = T + PH;
      /* R8-B1: UMA escala só, a do tempo real (horas desde a publicação). A barra j ocupa de max(0, t-1) a t; a 1ª é parcial (da publicação até a hora cheia).
         Hachura, marca de publicação, traços de 00:00 e 12:00, linha de 1/2 e retângulos de toque saem da mesma conta (L + horas * u). */
      var xa = function(j){ return L + Math.max(0, hs[j].t - 1) * u; }, xb = function(j){ return L + hs[j].t * u; };
      var X = function(j){ return (xa(j) + xb(j)) / 2; }, bwj = function(j){ return Math.max(2.4, (xb(j) - xa(j)) * .72); }, hits = [];
      var svg = mk('svg', { 'class': 'ic-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' }); hachura(svg, uid);
      [0, .5, 1].forEach(function(f){ var y = T + PH - f * PH; svg.appendChild(mk('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'ic-grid' })); svg.appendChild(mk('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'class': 'ic-ax' }, A.n(Math.round(max * f)))); });
      /* trecho antes da primeira contagem: hachura com a legenda dentro quando cabe */
      var nm = 0; hs.forEach(function(x, j){ if (x.e === 'nm') nm = j + 1; });
      if (nm) { var w = xb(nm - 1) - L; svg.appendChild(mk('rect', { x: L, y: T, width: w, height: PH, rx: 3, fill: 'url(#' + uid + 'h)', 'class': 'ic-nm' })); /* R4-S2: a hachura ocupa a altura toda: não sugere uma grandeza que não existe */ }
      /* C1: a linha de "1/2 das views" vai por baixo das barras e dos rótulos, e o rótulo fica acima da área do gráfico */
      var xm = cfg.metadeJ != null ? xb(cfg.metadeJ) : null;
      var pico = -1, pv = 0;
      hs.forEach(function(x, j){ if (x.e === 'com' && x.v > pv) { pv = x.v; pico = j; } });
      /* R3-C1: a posição do rótulo do pico sai ANTES da linha de "1/2 das views"; se o texto cruzaria a linha, a linha abre um vão no lugar do texto (nenhum traço passa dentro da frase) */
      var rotPico = null;
      if (pico >= 0) {
        var tp = 'maior hora medida: ' + A.n(pv), lw = tp.length * 7.6 + 6, xp = X(pico), yp = base - pv / max * PH - 6;
        var cabeD = xp + 6 + lw <= W - R - 2, cabeE = xp - 6 - lw >= L + 2;
        var cruza = function(ini){ return xm != null && xm > ini - 4 && xm < ini + lw + 4; };
        var dir = 0, sobe = false;
        if (cabeD && !cruza(xp + 6)) dir = 1; else if (cabeE && !cruza(xp - 6 - lw)) dir = -1; else if (cabeD) dir = 1; else if (cabeE) dir = -1;
        var xt, anc, x0;
        if (dir > 0) { xt = xp + 6; anc = 'start'; x0 = xt; } else if (dir < 0) { xt = xp - 6; anc = 'end'; x0 = xt - lw; }
        else { anc = 'middle'; xt = Math.min(W - R - 2 - lw / 2, Math.max(L + 2 + lw / 2, xp)); sobe = true; x0 = xt - lw / 2; }
        var yt = Math.max(24, yp - (sobe ? 14 : 0));
        rotPico = { txt: tp, x: xt, y: yt, anc: anc, x0: x0, x1: x0 + lw };
      }
      if (xm != null) {
        var vaoIni = null, vaoFim = null;
        if (rotPico && xm > rotPico.x0 - 4 && xm < rotPico.x1 + 4) { vaoIni = rotPico.y - 15; vaoFim = rotPico.y + 6; }
        var segs = vaoIni == null ? [[T - 4, base]] : [[T - 4, Math.min(base, vaoIni)], [Math.min(base, vaoFim), base]];
        segs.forEach(function(sg){ if (sg[1] > sg[0]) svg.appendChild(mk('line', { x1: xm, x2: xm, y1: sg[0], y2: sg[1], 'class': 'hv-cur' })); });
        svg.appendChild(mk('text', { x: xm + 4, y: T - 6, 'class': 'hv-rot t halo' }, '1/2 das views'));
      }
      hs.forEach(function(x, j){
        var cx = X(j);
        if (x.e === 'com') { var h = Math.max(2, x.v / max * PH); svg.appendChild(mk('rect', { x: cx - bwj(j) / 2, y: base - h, width: bwj(j), height: h, rx: 1, 'class': 'ic-bar' })); }
        else if (x.e === 'zero') svg.appendChild(mk('rect', { x: cx - bwj(j) / 2, y: base - 6, width: bwj(j), height: 6, rx: 1, 'class': 'ic-zero' }));
      });
      if (rotPico) svg.appendChild(mk('text', { x: rotPico.x, y: rotPico.y, 'text-anchor': rotPico.anc, 'class': 'hv-lab halo' }, rotPico.txt));
      /* publicação (marca tracejada na borda esquerda) */
      svg.appendChild(mk('line', { x1: L, x2: L, y1: T - 10, y2: base, 'class': 'ic-pub' }));
      svg.appendChild(mk('text', { x: L + 4, y: 12, 'class': 'ic-publ' }, 'publicado ' + A.ds(cfg.pub.d) + ', ' + cfg.pubTxt));
      /* eixo: 00:00 e 12:00 de São Paulo, com a data debaixo da meia-noite */
      hs.forEach(function(x, j){ if (x.hc === 0 || x.hc === 12) { var cx = xb(j); if (cx < L + 18 || cx > W - R - 18) return; svg.appendChild(mk('line', { x1: cx, x2: cx, y1: base, y2: base + 4, stroke: 'currentColor', 'class': 'ic-grid' })); svg.appendChild(mk('text', { x: cx, y: base + 17, 'text-anchor': 'middle', 'class': 'ic-ax' }, ('0' + x.hc).slice(-2) + ':00')); if (x.hc === 0) svg.appendChild(mk('text', { x: cx, y: base + 31, 'text-anchor': 'middle', 'class': 'hv-rot' }, A.ds(x.d))); } });
      hs.forEach(function(x, j){ var r = mk('rect', { x: xa(j), y: T - 4, width: xb(j) - xa(j), height: PH + AX, 'class': 'ic-hit' }); r.addEventListener('pointerdown', function(){ ctl.ir(j); }); r.addEventListener('pointerenter', function(e){ if (e.pointerType === 'mouse') ctl.ir(j); }); svg.appendChild(r); hits.push(r); });
      el.grupo.innerHTML = ''; el.grupo.appendChild(svg); pinta = function(s){ hits.forEach(function(r, k){ r.setAttribute('class', 'ic-hit' + (k === s ? ' on' : '')); }); }; pinta(ctl.atual());
    }
    var ctl = G.leitura(el, n, cfg.fala, function(s){ if (pinta) pinta(s); }, cfg.sel);
    redesenha(host, draw); ctl.mostra();
  };

  /* ======================================================================= 3. dia a dia, com a subida e as raias de mudança
     cfg: { id, dias: [{d, v, e: 'pub'|'com'|'zero'|'nm'|'fora', motivo?}], trocas: [{n, d, tipo, campos}], subida: {d, fim, idx}|null, fim: {d, mantido}|null, fala(i), pub, pubTxt, laneRotulos } */
  var TIPOS = [['t', 'Título'], ['m', 'Miniatura'], ['o', 'Outras']];
  G.dias = function(host, cfg){
    var dias = cfg.dias, n = dias.length, uid = cfg.id, tr = cfg.trocas || [], idx = {}; dias.forEach(function(x, i){ idx[x.d] = i; });
    var el = G.casca(host, { id: uid, titulo: 'Views por dia e cada mudança', aria: 'Views por dia, com as mudanças do vídeo. Setas andam de dia em dia.', ant: 'Dia anterior', seg: 'Dia seguinte',
      legenda: '<span class="ic-lg"><i class="ic-sw imp" aria-hidden="true"></i>dia com views</span><span class="ic-lg"><i class="ic-sw zero" aria-hidden="true"></i>zero medido</span><span class="ic-lg"><i class="nm-h" aria-hidden="true"></i>não medido</span>' +
        (tr.some(function(t){ return t.tipo === 't'; }) || true ? '<span class="ic-lg"><i class="ic-sw trt" aria-hidden="true"></i>título</span><span class="ic-lg"><i class="ic-sw trm" aria-hidden="true"></i>miniatura</span><span class="ic-lg"><i class="ic-sw" style="width:13px;height:13px;border-radius:50%;background:var(--tr)" aria-hidden="true"></i>outras (descrição, tags, categoria, duração, capítulos)</span>' : '') +
        (cfg.subida ? '<span class="ic-lg"><i class="hv-sw-sub" aria-hidden="true"></i>▲ 7 dias da subida</span><span class="ic-lg"><i class="hv-sw-bk" aria-hidden="true"></i>14 dias antes</span>' : ''),
      tabela: '<table><thead><tr><th scope="col">Dia</th><th scope="col" class="r">Views no dia</th><th scope="col">Mudanças no dia</th></tr></thead><tbody>' + dias.map(function(x){ var t = (cfg.trDia ? cfg.trDia(x.d) : tr.filter(function(y){ return y.d === x.d; })).map(function(y){ return y.n + ' ' + y.campos.join(', ') + (y.prec === '6h' && y.a >= '12:00' ? ' (depois da contagem das 12:00)' : '') + (y.prec === 'gap' ? ' (entre ' + A.dm(y.a) + ' e ' + A.dm(y.b) + ', sem dia certo)' : ''); }).join('; '); return '<tr><th scope="row" class="num">' + A.dm(x.d) + '</th><td class="r num">' + (x.e === 'com' ? A.n(x.v) : x.e === 'zero' ? '0' : x.e === 'pub' ? '<span class="ex">publicação</span>' : x.e === 'fora' ? '<span class="ex">fora do ar</span>' : A.nm()) + '</td><td>' + esc(t) + '</td></tr>'; }).join('') + '</tbody></table>' });
    var pinta;
    function draw(){
      var W = Math.max(280, Math.floor(host.clientWidth || 640)), amplo = W >= 640, vmax = Math.max.apply(null, dias.map(function(x){ return x.e === 'com' ? x.v : 0; }).concat([1])), max = nice(vmax * 1.06);
      var L = Math.max(14 + 7.4 * A.n(max).length, amplo ? 84 : 14 + 7.4 * A.n(max).length), R = 8, T = 40, PH = W < 520 ? 130 : 170, AX = 22, LH = 28, H = T + PH + AX + 3 * LH + 10, cw = (W - L - R) / n, bw = Math.max(3, Math.min(22, cw * .66)), base = T + PH, lane0 = base + AX;
      var X = function(i){ return L + cw * i + cw / 2; }, hits = [];
      /* R8-C1: a marca de uma mudança com a contagem parada ('gap') não cai no centro de um dia: fica na divisa entre o dia dela e o seguinte (a janela inteira são os dois dias) */
      var XT = function(t){ return t.prec === 'gap' ? L + cw * (idx[t.d] + 1) : X(idx[t.d]); };
      var svg = mk('svg', { 'class': 'ic-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' }); hachura(svg, uid);
      /* faixa dos 14 dias antes da subida (só sobre as raias) e dos 7 dias seguintes (sobre tudo) */
      if (cfg.subida) {
        var is = idx[cfg.subida.d], ie = idx[cfg.subida.fim], i0 = Math.max(0, is - 14);
        svg.appendChild(mk('rect', { x: L + cw * i0, y: lane0 + 2, width: cw * (is - i0), height: 3 * LH - 2, rx: 3, 'class': 'hv-bk' }));
        svg.appendChild(mk('rect', { x: L + cw * (is + 1), y: T - 24, width: cw * (ie - is), height: H - T + 20, rx: 3, 'class': 'hv-sub-band' }));
        svg.appendChild(mk('text', { x: L + cw * (is + 1) + 5, y: T - 9, 'class': 'hv-sub-l' }, '▲ subida'));
      }
      [0, .5, 1].forEach(function(f){ var y = T + PH - f * PH; svg.appendChild(mk('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'ic-grid' })); svg.appendChild(mk('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'class': 'ic-ax' }, A.n(Math.round(max * f)))); });
      /* C1: as linhas das mudanças ficam num grupo por baixo das barras e dos textos (que levam um contorno da cor do cartão) */
      var gl = mk('g'); svg.appendChild(gl);
      /* o que acontece depois do fim (saiu do YouTube) */
      var fimI = cfg.fim ? idx[cfg.fim.d] : null;
      /* R4-S1: com muitas barras só o melhor dia e o último levam número (o resto está na tabela); com poucas, todas que cabem */
      var iMax = -1, iUlt = -1, vMax = -1; dias.forEach(function(x, i){ if (x.e === 'com') { iUlt = i; if (x.v > vMax) { vMax = x.v; iMax = i; } } });
      dias.forEach(function(x, i){
        var cx = X(i);
        if (x.e === 'com') { var h = Math.max(3, x.v / max * PH); svg.appendChild(mk('rect', { x: cx - bw / 2, y: base - h, width: bw, height: h, rx: 1.5, 'class': 'ic-bar' })); var wl = 7.4 * A.n(x.v).length, esparso = dias.length <= 12 && cw >= wl + 4, destaque = (i === iMax || i === iUlt) && !esparso; if (esparso || destaque) { var xl = Math.min(W - R - wl / 2, Math.max(L + wl / 2, cx)); svg.appendChild(mk('text', { x: xl, y: base - h - 5, 'text-anchor': 'middle', 'class': 'ic-val' }, A.n(x.v))); } }
        else if (x.e === 'zero') { svg.appendChild(mk('rect', { x: cx - bw / 2, y: base - 6, width: bw, height: 6, rx: 1, 'class': 'ic-zero' })); if (cw >= 11) svg.appendChild(mk('text', { x: cx, y: base - 11, 'text-anchor': 'middle', 'class': 'ic-val' }, '0')); }
        else if (x.e === 'nm') { var hN = Math.round(PH * .22); svg.appendChild(mk('rect', { x: cx - Math.max(bw / 2, 3), y: base - hN, width: Math.max(bw, 6), height: hN, fill: 'url(#' + uid + 'h)', 'class': 'ic-nm' })); }
      });
      if (fimI != null) { var xf = L + cw * fimI; if (xf < W - R - 6) svg.appendChild(mk('rect', { x: xf + 2, y: T, width: W - R - xf - 2, height: PH, rx: 3, 'class': 'hv-fimr' })); svg.appendChild(mk('line', { x1: xf, x2: xf, y1: T - 8, y2: lane0 + 3 * LH, 'class': 'hv-fim' })); svg.appendChild(mk('text', { x: xf - 6, y: 30, 'text-anchor': 'end', 'class': 'hv-fim-tag' }, W < 520 ? '✕ saiu em ' + A.dm(cfg.fim.d) : '✕ saiu do YouTube em ' + A.dm(cfg.fim.d) + ': a contagem termina aqui')); }
      var ip = idx[cfg.pub]; if (ip != null) { svg.appendChild(mk('line', { x1: X(ip), x2: X(ip), y1: T - 6, y2: base, 'class': 'ic-pub' })); svg.appendChild(mk('text', { x: X(ip) + 5, y: 12, 'class': 'ic-publ' }, 'publicado ' + cfg.pubTxt)); }
      /* eixo de datas */
      var passo = Math.max(1, Math.ceil(52 / cw)); dias.forEach(function(x, i){ if (i === n - 1 || (i % passo === 0 && n - 1 - i >= passo * .9)) { var enc = X(i) > W - R - 14; svg.appendChild(mk('text', { x: enc ? W - R : X(i), y: base + 16, 'text-anchor': enc ? 'end' : 'middle', 'class': 'ic-ax' }, A.dm(x.d))); } /* R8 (varredura): a última data encosta na borda alinhada à direita, sobre a própria coluna, e não deslocada para a coluna do dia anterior */ });
      /* raias */
      TIPOS.forEach(function(tp, k){
        var cy = lane0 + LH * k + LH / 2 + 1;
        svg.appendChild(mk('line', { x1: L, x2: W - R, y1: cy, y2: cy, 'class': 'hv-lane' }));
        if (amplo) svg.appendChild(mk('text', { x: 6, y: cy + 4, 'class': 'hv-laneL' }, tp[1]));
        else { var ccx = Math.max(8, L / 2 - 2); svg.appendChild(mk(tp[0] === 'o' ? 'circle' : 'polygon', tp[0] === 'o' ? { cx: ccx, cy: cy, r: 6, 'class': 'ic-trp o' } : { points: tp[0] === 't' ? [ccx, cy - 7, ccx + 7, cy, ccx, cy + 7, ccx - 7, cy].join(' ') : [ccx, cy - 7, ccx + 7, cy + 6, ccx - 7, cy + 6].join(' '), 'class': 'ic-trp' })); }
        var itens = tr.filter(function(t){ return t.tipo === tp[0] && idx[t.d] != null; }).map(function(t){ return { x: XT(t), t: t }; }).sort(function(a, b){ return a.x - b.x; }), grupos = [];
        itens.forEach(function(it){ var g = grupos[grupos.length - 1]; if (g && it.x - g.xf < 26) { g.its.push(it); g.xf = it.x; } else grupos.push({ x: it.x, xf: it.x, its: [it] }); });
        grupos.forEach(function(g){
          var cx = (g.x + g.xf) / 2, mais = g.its.length > 1, txt = mais ? '×' + g.its.length : String(g.its[0].t.n);
          if (mais) svg.appendChild(mk(tp[0] === 'o' ? 'circle' : 'rect', tp[0] === 'o' ? { cx: cx, cy: cy, r: 15, fill: 'none', stroke: 'var(--tr)', 'stroke-width': 1.2 } : { x: cx - 17, y: cy - 13, width: 34, height: 26, rx: 4, fill: 'none', stroke: 'var(--tr)', 'stroke-width': 1.2 }));
          if (g.its.length === 1) g.its[0].t._cx = cx;
          g.its.forEach(function(it){ gl.appendChild(mk('line', { x1: XT(it.t), x2: XT(it.t), y1: tr.length > 6 ? lane0 : T, y2: lane0 + LH * k + 2, 'class': 'ic-trl' })); });
          var pts = tp[0] === 't' ? [cx, cy - 12, cx + 13, cy, cx, cy + 12, cx - 13, cy].join(' ') : [cx, cy - 11, cx + 13, cy + 10, cx - 13, cy + 10].join(' ');
          svg.appendChild(tp[0] === 'o' ? mk('circle', { cx: cx, cy: cy, r: 11, 'class': 'ic-trp o' }) : mk('polygon', { points: pts, 'class': 'ic-trp' }));
          svg.appendChild(mk('text', { x: cx, y: cy + (tp[0] === 'm' ? 6 : 4), 'text-anchor': 'middle', 'class': 'ic-trn' }, txt));
        });
      });
      if (cfg.corte != null && idx[cfg.corte] != null) { var xc = X(idx[cfg.corte]); svg.appendChild(mk('line', { x1: xc, x2: xc, y1: T - 6, y2: base, 'class': 'hv-corte' })); svg.appendChild(mk('text', { x: xc + 5, y: T + 12, 'class': 'hv-corte-l' }, '24/08: mudou a regra de contar views')); }
      dias.forEach(function(x, i){ var r = mk('rect', { x: L + cw * i, y: T - 2, width: cw, height: PH + AX, 'class': 'ic-hit' }); r.addEventListener('pointerdown', function(){ ctl.ir(i); }); r.addEventListener('pointerenter', function(e){ if (e.pointerType === 'mouse') ctl.ir(i); }); svg.appendChild(r); hits.push(r); });
      el.grupo.innerHTML = ''; el.grupo.appendChild(svg); pinta = function(s){ hits.forEach(function(r, k){ r.setAttribute('class', 'ic-hit' + (k === s ? ' on' : '')); }); }; pinta(ctl.atual());
    }
    var ctl = G.leitura(el, n, cfg.fala, function(s){ if (pinta) pinta(s); }, cfg.sel);
    redesenha(host, draw); ctl.mostra();
  };

  /* ======================================================================= 4. série semanal: um ponto por semana, sem veredito
     cfg: { id, dias: [datas do eixo, da publicação até hoje], semanas: [{d, taxa|null, motivo}], inicio: primeira data com contagem, corte, fala(i) } */
  G.semanas = function(host, cfg){
    var ds = cfg.dias, n = ds.length, idx = {}; ds.forEach(function(d, i){ idx[d] = i; }); var uid = cfg.id, sem = cfg.semanas;
    var el = G.casca(host, { id: uid, titulo: 'Views por semana, uma contagem por semana', aria: 'Views por semana: ' + sem.length + ' pontos. Setas andam de semana em semana.', ant: 'Semana anterior', seg: 'Semana seguinte',
      legenda: '<span class="ic-lg"><i class="hv-sw-sem" aria-hidden="true"></i>média por dia da semana (um ponto por semana)</span><span class="ic-lg"><i class="nm-h" aria-hidden="true"></i>não medido</span><span class="ic-lg"><i class="hv-sw-ai" aria-hidden="true"></i>sem contagem (antes da primeira contagem)</span><span class="ic-lg"><i class="ic-sw" style="width:0;height:14px;border-left:2px dashed var(--terco-baixo)" aria-hidden="true"></i>24/08: mudou a regra de contar views</span>',
      tabela: '<table><thead><tr><th scope="col">Semana que termina em</th><th scope="col" class="r">Média de views por dia</th></tr></thead><tbody>' + sem.map(function(x){ return '<tr><th scope="row" class="num">' + A.dm(x.d) + '</th><td class="r num">' + (x.taxa == null ? A.nm() : A.n(Math.round(x.taxa))) + '</td></tr>'; }).join('') + '</tbody></table>' });
    var pinta;
    function draw(){
      var W = Math.max(280, Math.floor(host.clientWidth || 640)), vmax = Math.max.apply(null, sem.map(function(x){ return x.taxa || 0; }).concat([1])), max = nice(vmax * 1.2);
      var L = 14 + 7.4 * A.n(max).length, R = 12, T = 30, PH = W < 520 ? 130 : 160, AX = 22, H = T + PH + AX + 4, cw = (W - L - R) / n, base = T + PH, X = function(i){ return L + cw * i + cw / 2; }, hits = [];
      var svg = mk('svg', { 'class': 'ic-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' }); hachura(svg, uid);
      [0, .5, 1].forEach(function(f){ var y = T + PH - f * PH; svg.appendChild(mk('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'ic-grid' })); svg.appendChild(mk('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'class': 'ic-ax' }, A.n(Math.round(max * f)))); });
      var i0 = idx[cfg.inicio]; svg.appendChild(mk('rect', { x: L, y: T, width: cw * i0, height: PH, rx: 3, 'class': 'hv-fimr' }));
      var ic = idx[cfg.corte]; if (ic != null) { var xc = X(ic); svg.appendChild(mk('line', { x1: xc, x2: xc, y1: T - 6, y2: base, 'class': 'hv-corte' })); svg.appendChild(mk('text', { x: xc + 5, y: T + 10, 'class': 'hv-corte-l' }, W < 520 ? '24/08' : '24/08: mudou a regra de contar views')); }
      var pi = idx[cfg.pub]; if (pi != null) { svg.appendChild(mk('line', { x1: X(pi), x2: X(pi), y1: T - 6, y2: base, 'class': 'ic-pub' })); svg.appendChild(mk('text', { x: X(pi) + 5, y: 12, 'class': 'ic-publ' }, 'publicado em ' + A.dm(cfg.pub))); }
      /* C1: o texto vem depois das linhas (e leva contorno), então a linha de 24/08 não o atravessa */
      if (cw * i0 > 150) { var tsc = 'sem contagem por semana antes de ' + A.dm(cfg.inicio), xs = L + 10, wsc = tsc.length * 6.6 + 8, xcc = ic != null ? X(ic) : null; if (xcc != null && xcc > xs - 4 && xcc < xs + wsc) xs = xcc + 9; svg.appendChild(mk('text', { x: xs, y: T + PH / 2 + 14, 'class': 'hv-rot' }, tsc)); }
      var rotulos = [];
      sem.forEach(function(s, k){
        var i = idx[s.d]; if (i == null) return; var cx = X(i), x0 = Math.max(L, cx - cw * 7 + cw / 2), x1 = cx + cw / 2;
        if (s.taxa == null) { svg.appendChild(mk('rect', { x: Math.max(L, cx - 7), y: base - 26, width: 14, height: 26, rx: 3, fill: 'url(#' + uid + 'h)', 'class': 'ic-nm' })); return; }
        var y = T + PH - s.taxa / max * PH; svg.appendChild(mk('line', { x1: x0 + 2, x2: x1 - 2, y1: y, y2: y, 'class': 'hv-sem-seg' })); svg.appendChild(mk('circle', { cx: cx - (cw * 3.5) + cw / 2, cy: y, r: 6, 'class': 'hv-sem-p' }));
        /* R2-C1: o rótulo vai em cima do ponto; se tocar um rótulo já posto, desce para baixo do ponto; se também tocar, fica só na linha de leitura e na tabela */
        var tx = cx - (cw * 3.5) + cw / 2, tt = A.n(Math.round(s.taxa)), tw = tt.length * 7.4 + 6, cand = [y - 12, y + 22], ok = false;
        for (var q = 0; q < cand.length && !ok; q++) {
          var ty = cand[q]; if (ty > base - 2 || ty < T - 14) continue;
          var bate = rotulos.some(function(r){ return Math.abs(r.x - tx) < (r.w + tw) / 2 + 3 && Math.abs(r.y - ty) < 15; });
          if (!bate) { rotulos.push({ x: tx, y: ty, w: tw }); svg.appendChild(mk('text', { x: tx, y: ty, 'text-anchor': 'middle', 'class': 'hv-seg-l halo' }, tt)); ok = true; }
        }
      });
      var passo = Math.max(1, Math.ceil(56 / cw)); ds.forEach(function(d, i){ if (i === n - 1 || (i % passo === 0 && n - 1 - i >= passo * .9)) { var enc2 = X(i) > W - R - 12; svg.appendChild(mk('text', { x: enc2 ? W - R : X(i), y: base + 16, 'text-anchor': enc2 ? 'end' : 'middle', 'class': 'ic-ax' }, A.dm(d))); } });
      sem.forEach(function(s, k){ var i = idx[s.d]; if (i == null) return; var r = mk('rect', { x: Math.max(L, L + cw * (i - 6)), y: T - 2, width: Math.min(cw * 7, L + cw * (i + 1) - Math.max(L, L + cw * (i - 6))), height: PH + AX, 'class': 'ic-hit' }); r.addEventListener('pointerdown', function(){ ctl.ir(k); }); r.addEventListener('pointerenter', function(e){ if (e.pointerType === 'mouse') ctl.ir(k); }); svg.appendChild(r); hits.push(r); });
      el.grupo.innerHTML = ''; el.grupo.appendChild(svg); pinta = function(s){ hits.forEach(function(r, k){ r.setAttribute('class', 'ic-hit' + (k === s ? ' on' : '')); }); }; pinta(ctl.atual());
    }
    var ctl = G.leitura(el, sem.length, cfg.fala, function(s){ if (pinta) pinta(s); }, cfg.sel);
    redesenha(host, draw); ctl.mostra();
  };
})();
