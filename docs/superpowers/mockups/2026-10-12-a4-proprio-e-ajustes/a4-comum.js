/* a4-comum.js: pequenos blocos usados pelas telas do mockup de 12/10/2026. Sem framework, sem rede (a não ser as fontes e as capas).
   ?tema=claro liga o tema claro; o resto do estado de cada tela vem dos parâmetros dela (veja index.html). */
(function(){
  'use strict';
  var A = window.A4 = {};
  var q = A.q = new URLSearchParams(location.search);
  if (q.get('tema') === 'claro') document.documentElement.setAttribute('data-theme', 'light');
  var NS = 'http://www.w3.org/2000/svg';

  A.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var esc = A.esc;
  A.INFO = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.6M8 5.1v.2"/></svg>';
  A.CHEV = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';
  A.L = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>';
  A.R = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';
  A.X = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

  /* ---------------------------------------------------------------- números e datas (pt-BR) */
  var nf = new Intl.NumberFormat('pt-BR');
  A.n = function(x){ return nf.format(x); };
  A.dec = function(x, c){ return x.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }); };
  A.pct = function(x, c){ return A.dec(x * 100, c == null ? 1 : c) + '%'; };
  A.mil = function(x){
    if (x == null) return null;
    if (x >= 1e6) return A.dec(x / 1e6, x >= 1e7 ? 0 : 1).replace(/,0$/, '') + ' mi';
    if (x >= 1000) { var s = x >= 1e5 ? Math.round(x / 1000) : Math.round(x / 10) / 100; return (x >= 1e4 && x < 1e5 ? A.dec(x / 1000, 1) : A.dec(s, x >= 1e5 ? 0 : 2)).replace(/,00$/, '').replace(/(,\d)0$/, '$1') + ' mil'; }
    return String(x);
  };
  A.dm = function(iso){ return iso.slice(8, 10) + '/' + iso.slice(5, 7); };
  A.dmy = function(iso){ return A.dm(iso) + '/' + iso.slice(0, 4); };
  var DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  A.ds = function(iso){ return DS[new Date(iso + 'T12:00:00Z').getUTCDay()] + ' ' + A.dm(iso); };
  A.addDias = function(iso, n){ var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  A.dias = function(a, b){ return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); };
  A.faixaDias = function(a, b){ var r = [], d = a; while (d <= b) { r.push(d); d = A.addDias(d, 1); } return r; };
  A.dur = function(s){ s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (x < 10 ? '0' : '') + x; };
  A.plural = function(n, um, varios){ return n === 1 ? um : varios; };
  A.mediana = function(xs){ var s = xs.slice().sort(function(a, b){ return a - b; }), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
  /* gerador de semente fixa: o exemplo é sempre o mesmo */
  A.rnd = function(seed){ var a = seed; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  /* intervalo de Wilson de 95% para uma taxa (k cliques em n impressões) */
  A.wilson = function(k, n){ var z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), a = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - a) / d), Math.min(1, (c + a) / d)]; };

  /* ---------------------------------------------------------------- estado na URL */
  A.href = function(mudar){ var p = new URLSearchParams(location.search); Object.keys(mudar).forEach(function(k){ if (mudar[k] == null) p.delete(k); else p.set(k, mudar[k]); }); var s = p.toString(); return location.pathname.split('/').pop() + (s ? '?' + s : ''); };

  /* ---------------------------------------------------------------- popover (camada do navegador, sem z-index) */
  A.info = function(btn, html, titulo){
    var el = document.createElement('div'); el.className = 'pop'; el.setAttribute('popover', 'auto'); el.setAttribute('role', 'note');
    el.innerHTML = (titulo ? '<h3>' + esc(titulo) + '</h3>' : '') + html; document.body.appendChild(el);
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function(){
      if (el.matches(':popover-open')) { el.hidePopover(); return; }
      el.showPopover();
      var r = btn.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      var left = Math.min(Math.max(12, r.right - w), window.innerWidth - w - 12), top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
      el.style.left = left + 'px'; el.style.top = top + 'px';
    });
    el.addEventListener('toggle', function(e){ btn.setAttribute('aria-expanded', String(e.newState === 'open')); if (e.newState === 'closed' && document.activeElement === document.body) btn.focus(); });
    return el;
  };
  A.ligarInfos = function(raiz){
    (raiz || document).querySelectorAll('[data-info]').forEach(function(b){ if (b._ok) return; b._ok = true; var t = document.getElementById(b.getAttribute('data-info')); if (t) A.info(b, t.innerHTML, t.getAttribute('data-titulo')); });
  };
  A.ibtn = function(id, rotulo, compacto){ return '<button type="button" class="ibtn' + (compacto ? ' compacto' : '') + '" data-info="' + id + '" aria-expanded="false" aria-label="' + esc(rotulo) + '">' + A.INFO + '</button>'; };
  A.oculto = function(id, titulo, html){ return '<template id="' + id + '" data-titulo="' + esc(titulo) + '">' + html + '</template>'; };

  /* ---------------------------------------------------------------- moldura da página */
  A.barra = function(o){
    var rows = (o.linhas || []).map(function(l){
      return '<div class="mk-row"><span class="mk-lbl">' + esc(l.rotulo) + '</span><div class="mk-items">' + l.itens.map(function(i){
        return '<a class="mk" href="' + esc(i.href) + '"' + (i.atual ? ' aria-current="true"' : '') + '>' + esc(i.t) + '</a>'; }).join('') + '</div></div>'; }).join('');
    return '<details id="mock"' + (o.aberta ? ' open' : '') + '><summary>Estados do mockup (não faz parte da tela)</summary><div class="mk-in">' + rows + (o.nota ? '<p>' + o.nota + '</p>' : '') + '</div></details>';
  };
  /* linha de opções "por parâmetro": itens com o valor atual marcado */
  A.opcoes = function(param, itens, padrao, extra){
    var atual = q.get(param) || padrao;
    return itens.map(function(i){ var m = {}; m[param] = i[0] === padrao ? null : i[0]; if (extra) Object.keys(extra).forEach(function(k){ m[k] = extra[k]; });
      return { t: i[1], href: A.href(m), atual: atual === i[0] }; });
  };
  A.tema = function(){ var claro = q.get('tema') === 'claro'; return { rotulo: 'Tema', itens: [{ t: 'Escuro', href: A.href({ tema: null }), atual: !claro }, { t: 'Claro', href: A.href({ tema: 'claro' }), atual: claro }] }; };
  A.moldura = function(o){
    var abas = ['Painel', 'Vídeos', 'A/B Lab', 'Categorias', 'Comentários', 'Conteúdo', 'Competidores', 'Desempenho'].map(function(t){ return '<span' + (t === 'Competidores' ? ' data-on' : '') + '>' + t + '</span>'; }).join('');
    document.body.innerHTML = A.barra(o.barra || {}) +
      '<div id="app"><aside class="ch-side" aria-label="Menu do CMS (ilustrativo)" inert><b>bythiagofigueiredo</b><p>YouTube</p><span>Canais</span><span>Vídeos</span><span>A/B Lab</span><span>Desempenho</span><span data-on>Competidores</span></aside>' +
      '<div class="ch-main"><div class="ch-shell" aria-hidden="true">YouTube</div><div class="ch-tabs" aria-hidden="true">' + abas + '</div><main class="scr" id="screen">' + o.corpo + '</main></div></div>' +
      (o.fora ? '<aside class="fora" aria-label="Referência do mockup, fora da tela"><p class="fora-t">Referência do mockup (não faz parte da tela)</p>' + o.fora + '</aside>' : '');
    document.title = o.titulo + ' (mockup)';
  };
  A.migalha = function(itens){ return '<nav class="crumbs" aria-label="Caminho"><ol>' + itens.map(function(i, k){ return k === itens.length - 1 ? '<li aria-current="page">' + esc(i[0]) + '</li>' : '<li><a href="' + esc(i[1]) + '">' + esc(i[0]) + '</a></li>'; }).join('') + '</ol><span>Horários em São Paulo</span></nav>'; };
  A.nm = function(t){ return '<span class="nm">' + esc(t || 'não medido') + '</span>'; };
  /* ausência explicada uma vez: a pastilha curta (sempre "não medido") e o motivo na linha de baixo */
  A.nml = function(motivo){ return '<div class="nml">' + A.nm() + '<p>' + motivo + '</p></div>'; };
  A.nmSw = function(){ return '<span class="nm-h" role="img" aria-label="não medido"></span>'; };

  /* faixa de números: células { v: valor (texto) | null, l: rótulo, sub: segunda linha, nm: 'texto curto' quando não medido } */
  A.faixa = function(cells, rotulo, quieto){
    return '<dl class="nstrip" aria-label="' + esc(rotulo) + '">' + cells.map(function(c){
      var ausente = c.v == null;
      return '<div class="nc' + (c.parado ? ' parado' : '') + (c.fraco ? ' fraco' : '') + '"><dt>' + esc(c.l) + (c.sub ? '<span class="nsub">' + esc(c.sub) + '</span>' : '') + '</dt><dd>' + (ausente ? (quieto ? A.nmSw() : A.nm()) : '<b class="num">' + esc(c.v) + '</b>' + (c.parado ? '<span class="parado-tag">parado</span>' : '')) + '</dd></div>'; }).join('') + '</dl>';
  };

  /* ---------------------------------------------------------------- gráfico por dia (impressões, views)
     cfg: { id, titulo, frase, dias: [{ d, v, e: 'com'|'zero'|'nm', cl?: número estimado de cliques }], um: ['view','views'], cliques: bool, pub: 'AAAA-MM-DD'|null,
            sel: índice inicial (só para as capturas), ajuda: html do ⓘ, meta: texto, fala: function(dia) -> texto do dia, legNm: texto da hachura, legZero: texto do traço } */
  function nice(m){ var s = [4, 10, 20, 40, 60, 80, 100, 200, 300, 400, 600, 800, 1000, 2000, 4000, 6000, 8000, 10000, 20000, 40000, 100000]; for (var i = 0; i < s.length; i++) if (m <= s[i]) return s[i]; return Math.ceil(m / 1e5) * 1e5; }
  function mk(tag, attrs, txt){ var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function(k){ e.setAttribute(k, attrs[k]); }); if (txt != null) e.textContent = txt; return e; }
  var VAZIO = '<span class="m">Passe o mouse sobre o gráfico ou use as setas para ler um dia.</span><span class="t">Use os botões para ler um dia de cada vez.</span>';
  A.serieDia = function(host, cfg){
    var dias = cfg.dias, n = dias.length, sel = cfg.sel == null ? -1 : cfg.sel, uid = cfg.id || 'g' + Math.random().toString(36).slice(2, 6);
    var cont = { com: 0, zero: 0, nm: 0 }; dias.forEach(function(d){ cont[d.e]++; });
    var legenda = '<div class="ic-leg"><span class="ic-lg"><i class="ic-sw imp" aria-hidden="true"></i>' + esc(cfg.legBarra || 'dia com valor') + '</span>' +
      (cfg.cliques ? '<span class="ic-lg"><i class="ic-sw cl" aria-hidden="true"></i>cliques estimados</span>' : '') +
      '<span class="ic-lg"><i class="ic-sw zero" aria-hidden="true"></i>' + esc(cfg.legZero || 'zero medido') + '</span>' +
      '<span class="ic-lg"><i class="nm-h" aria-hidden="true"></i>' + esc(cfg.legNm || 'não medido') + '</span>' +
      (cfg.pub && dias.some(function(d){ return d.d === cfg.pub; }) ? '<span class="ic-lg"><i class="ic-sw pub" aria-hidden="true"></i>dia da publicação</span>' : '') + '</div>';
    host.innerHTML = '<figure class="ic" aria-labelledby="' + uid + 't" style="margin:0">' +
      '<h3 class="' + (cfg.semTitulo ? 'sr' : 'ic-t') + '" id="' + uid + 't">' + esc(cfg.titulo) + '</h3>' +
      '<p class="ic-res">' + cfg.frase + '</p>' +
      '<p class="ic-meta"><span>' + esc(cfg.meta) + '</span>' + (cfg.ajuda ? A.ibtn(uid + 'i', 'Como ler este gráfico', true) : '') + '</p>' +
      '<div class="ic-sc"><div class="ic-grupo" role="group" tabindex="0" aria-label="' + esc(cfg.titulo) + ': ' + n + ' dias. Setas andam de dia em dia.">' + '</div></div>' + legenda +
      '<div class="ic-step"><button type="button" data-p="-1" aria-label="Dia anterior">' + A.L + '</button><p class="ic-out vazio" role="status" aria-live="polite">' + VAZIO + '</p><button type="button" data-p="1" aria-label="Dia seguinte">' + A.R + '</button></div>' +
      '<details class="ic-tab"><summary>Ver como tabela</summary><div class="ic-tw" role="region" tabindex="0" aria-label="' + esc(cfg.titulo) + ', tabela dia a dia"><table><thead><tr><th scope="col">Dia</th><th scope="col" class="r">' + esc(cfg.um[1].charAt(0).toUpperCase() + cfg.um[1].slice(1)) + '</th>' + (cfg.cliques ? '<th scope="col" class="r">Cliques estimados</th>' : '') + '<th scope="col">Situação</th></tr></thead><tbody>' +
      dias.map(function(d){ return '<tr><th scope="row" class="num">' + A.dm(d.d) + '</th><td class="r num">' + (d.e === 'nm' ? A.nm() : A.n(d.v)) + '</td>' + (cfg.cliques ? '<td class="r num">' + (d.e === 'nm' || d.cl == null ? '' : d.cl < 1 && d.cl > 0 ? '&lt;1' : A.n(Math.round(d.cl))) + '</td>' : '') + '<td>' + (d.e === 'com' ? 'com ' + cfg.um[1] : d.e === 'zero' ? 'zero medido' : 'não medido') + '</td></tr>'; }).join('') + '</tbody></table></div></details></figure>';
    if (cfg.ajuda) { var h = document.createElement('template'); h.id = uid + 'i'; h.setAttribute('data-titulo', 'Como ler este gráfico'); h.innerHTML = cfg.ajuda; host.appendChild(h); A.ligarInfos(host); }
    var grupo = host.querySelector('.ic-grupo'), out = host.querySelector('.ic-out'), prev = host.querySelector('[data-p="-1"]'), next = host.querySelector('[data-p="1"]'), hits = [];
    function fala(i){ var d = dias[i]; if (cfg.fala) return cfg.fala(d); return A.ds(d.d) + ': ' + (d.e === 'nm' ? 'não medido' : d.v + ' ' + (d.v === 1 ? cfg.um[0] : cfg.um[1])); }
    function pinta(){
      hits.forEach(function(r, k){ r.setAttribute('class', 'ic-hit' + (k === sel ? ' on' : '')); });
      host.querySelectorAll('.ic-nmlin').forEach(function(l){ l.style.display = Number(l.getAttribute('data-i')) === sel ? '' : 'none'; });
      out.className = 'ic-out' + (sel < 0 ? ' vazio' : '');
      out.innerHTML = sel < 0 ? VAZIO : '<span>' + esc(fala(sel)) + '</span>';
      prev.setAttribute('aria-disabled', String(sel === 0)); next.setAttribute('aria-disabled', String(sel === n - 1));
    }
    function ir(i){ sel = Math.max(0, Math.min(n - 1, i)); pinta(); }
    function draw(){
      var W = Math.max(280, Math.floor(host.clientWidth || 600)), estreito = W < 520, L = 12 + 7.4 * A.n(nice(Math.max.apply(null, dias.map(function(d){ return d.e === 'com' ? d.v : 0; }).concat([1])))).length, R = 6, T = 20, PH = estreito ? 120 : 160, AX = 20, CL = cfg.cliques ? 20 : 0, H = T + PH + AX + CL + 2;
      var cw = (W - L - R) / n, bw = Math.max(4, Math.min(24, cw * .62)), max = nice(Math.max.apply(null, dias.map(function(d){ return d.e === 'com' ? d.v : 0; }).concat([1])));
      var svg = mk('svg', { 'class': 'ic-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' }); hits = [];
      var defs = mk('defs'), pat = mk('pattern', { id: uid + 'h', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
      pat.appendChild(mk('rect', { width: 6, height: 6, 'class': 'ic-hb' })); pat.appendChild(mk('line', { x1: 0, y1: 0, x2: 0, y2: 6, 'class': 'ic-hl' })); defs.appendChild(pat); svg.appendChild(defs);
      [0, .5, 1].forEach(function(f){ var y = T + PH - f * PH; svg.appendChild(mk('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'ic-grid' })); var t = mk('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'class': 'ic-ax' }, A.n(Math.round(max * f * 100) / 100)); svg.appendChild(t); });
      dias.forEach(function(d, i){
        var x = L + cw * i + cw / 2, base = T + PH;
        if (d.e === 'com') {
          var h = Math.max(3, d.v / max * PH); svg.appendChild(mk('rect', { x: x - bw / 2, y: base - h, width: bw, height: h, rx: 1.5, 'class': 'ic-bar' }));
          if (cw >= 7.4 * String(A.n(d.v)).length + 4) svg.appendChild(mk('text', { x: x, y: base - h - 5, 'text-anchor': 'middle', 'class': 'ic-val' }, A.n(d.v)));
          if (cfg.cliques && d.cl != null && d.cl > 0 && cw >= 9) svg.appendChild(mk('circle', { cx: x, cy: base - Math.min(h - 2, 6), r: 3.6, 'class': 'ic-dot' }));
        } else if (d.e === 'zero') svg.appendChild(mk('rect', { x: x - bw / 2, y: base - 6, width: bw, height: 6, rx: 1, 'class': 'ic-zero' }));
        else { var hN = Math.round(Math.min(24, PH * .25)); svg.appendChild(mk('rect', { x: x - Math.max(bw / 2, 3), y: base - hN, width: Math.max(bw, 6), height: hN, fill: 'url(#' + uid + 'h)', 'class': 'ic-nm' })); var ln = mk('line', { x1: x, x2: x, y1: T, y2: base - hN, 'class': 'ic-nmlin' }); ln.style.display = 'none'; ln.setAttribute('data-i', i); svg.appendChild(ln); }
        if (cfg.pub === d.d) { svg.appendChild(mk('line', { x1: x, x2: x, y1: T - 4, y2: base, 'class': 'ic-pub' })); }
      });
      var passo = Math.max(1, Math.ceil(56 / cw)); dias.forEach(function(d, i){ var ult = i === n - 1; if (ult || (i % passo === 0 && n - 1 - i >= passo * .9)) svg.appendChild(mk('text', { x: L + cw * i + cw / 2, y: T + PH + 15, 'text-anchor': 'middle', 'class': 'ic-ax' }, A.dm(d.d))); });
      if (cfg.cliques) dias.forEach(function(d, i){ if (d.e === 'com' && d.cl != null && d.cl > 0 && cw >= 7.4 * (d.cl < 1 ? 2 : String(Math.round(d.cl)).length) + 4) svg.appendChild(mk('text', { x: L + cw * i + cw / 2, y: T + PH + AX + 13, 'text-anchor': 'middle', 'class': 'ic-cln' }, d.cl < 1 ? '<1' : String(Math.round(d.cl)))); });
      if (cfg.cliques) svg.appendChild(mk('text', { x: 2, y: T + PH + AX + 13, 'class': 'ic-an' }, estreito ? '' : ''));
      dias.forEach(function(d, i){ var r = mk('rect', { x: L + cw * i, y: T - 2, width: cw, height: PH + AX + CL, 'class': 'ic-hit' }); r.addEventListener('pointerdown', function(){ ir(i); }); r.addEventListener('pointerenter', function(e){ if (e.pointerType === 'mouse') ir(i); }); svg.appendChild(r); hits.push(r); });
      grupo.innerHTML = ''; grupo.appendChild(svg); pinta();
    }
    prev.addEventListener('click', function(){ if (prev.getAttribute('aria-disabled') !== 'true') ir(sel < 0 ? n - 1 : sel - 1); }); next.addEventListener('click', function(){ if (next.getAttribute('aria-disabled') !== 'true') ir(sel < 0 ? 0 : sel + 1); });
    grupo.addEventListener('keydown', function(e){ var k = e.key; if (k === 'ArrowLeft') { ir(sel < 0 ? n - 1 : sel - 1); e.preventDefault(); } else if (k === 'ArrowRight') { ir(sel < 0 ? 0 : sel + 1); e.preventDefault(); } else if (k === 'Home') { ir(0); e.preventDefault(); } else if (k === 'End') { ir(n - 1); e.preventDefault(); } else if (k === 'Escape') { sel = -1; pinta(); } });
    draw(); var ult = host.clientWidth; if (window.ResizeObserver) new ResizeObserver(function(){ if (Math.abs(host.clientWidth - ult) > 2) { ult = host.clientWidth; draw(); } }).observe(host);
  };

  /* ---------------------------------------------------------------- faixa de taxa de clique: o valor com o intervalo de 95% (e, se houver, o do canal por baixo) */
  A.faixaTaxa = function(host, cfg){
    var k = cfg.cliques, n = cfg.imp, w = A.wilson(k, n), p = k / n, W = Math.max(280, Math.floor(host.clientWidth || 640)), L = 10, R = 10, ref = cfg.ref ? A.wilson(cfg.ref.cliques, cfg.ref.imp) : null;
    var tops = [5, 10, 20, 40, 100], hi = Math.max(w[1], ref ? ref[1] : 0) * 100 * 1.12, top = tops.filter(function(t){ return t >= hi; })[0] || 100;
    var inconclusivo = cfg.inc != null ? cfg.inc : (ref ? (w[1] - w[0]) > 3 * (ref[1] - ref[0]) : (w[1] - w[0]) > .15);
    function X(f){ return L + (W - L - R) * (f * 100 / top); }
    var s = '', y = 0;
    /* uma linha da faixa: título (opcional), valor acima do ponto, barra e os dois limites ABAIXO dela (nunca dentro) */
    function linha(titulo, wi, pp, cls, nota){
      if (titulo) { s += '<text class="ctr-lab" x="' + L + '" y="' + (y + 12) + '">' + esc(titulo) + '</text>'; if (nota) s += '<text class="ctr-lim" x="' + (W - R) + '" y="' + (y + 12) + '" text-anchor="end">' + esc(nota) + '</text>'; y += 18; }
      var x0 = X(wi[0]), x1 = Math.max(X(wi[1]), x0 + 3), cx = X(pp), clamp = function(v, a, b){ return Math.max(a, Math.min(b, v)); };
      s += '<text class="ctr-num" x="' + clamp(cx, L + 18, W - R - 18) + '" y="' + (y + 11) + '" text-anchor="middle">' + A.pct(pp, 1) + '</text>'; y += 16;
      s += '<rect class="ctr-int ' + cls + '" x="' + x0 + '" y="' + y + '" width="' + (x1 - x0) + '" height="22" rx="3"/><rect class="ctr-intb ' + cls + '" x="' + x0 + '" y="' + y + '" width="' + (x1 - x0) + '" height="22" rx="3"/><circle class="ctr-pt ' + cls + '" cx="' + cx + '" cy="' + (y + 11) + '" r="6"/>'; y += 22;
      if (x1 - x0 >= 84) s += '<text class="ctr-lim" x="' + x0 + '" y="' + (y + 14) + '" text-anchor="start">' + A.pct(wi[0], 1) + '</text><text class="ctr-lim" x="' + x1 + '" y="' + (y + 14) + '" text-anchor="end">' + A.pct(wi[1], 1) + '</text>';
      else s += '<text class="ctr-lim" x="' + clamp((x0 + x1) / 2, L + 40, W - R - 40) + '" y="' + (y + 14) + '" text-anchor="middle">' + A.pct(wi[0], 1) + ' a ' + A.pct(wi[1], 1) + '</text>';
      y += 22;
    }
    if (ref) { linha('O canal inteiro', ref, cfg.ref.cliques / cfg.ref.imp, 'ref', null); y += 6; }
    linha(ref ? 'Este vídeo' : null, w, p, inconclusivo ? 'inc' : '', inconclusivo ? 'faixa tracejada: ainda não conclui' : null);
    var yAx = y + 6;
    s = '<line class="ctr-fio" x1="' + L + '" x2="' + (W - R) + '" y1="' + yAx + '" y2="' + yAx + '"/>' + [0, top / 2, top].map(function(t, i){ return '<line class="ctr-fio" x1="' + X(t / 100) + '" x2="' + X(t / 100) + '" y1="' + (yAx - 4) + '" y2="' + (yAx + 4) + '"/><text class="ctr-ax" x="' + X(t / 100) + '" y="' + (yAx + 19) + '" text-anchor="' + (i === 0 ? 'start' : i === 2 ? 'end' : 'middle') + '">' + A.dec(t, t % 1 ? 1 : 0) + '%</text>'; }).join('') + s;
    var H = yAx + 26;
    host.innerHTML = '<svg class="ctr-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.alt) + '">' + s + '</svg>';
    if (!cfg._ro && window.ResizeObserver) { var ult = host.clientWidth; new ResizeObserver(function(){ if (Math.abs(host.clientWidth - ult) > 2) { ult = host.clientWidth; A.faixaTaxa(host, Object.assign({ _ro: 1 }, cfg)); } }).observe(host); }
  };

  /* ---------------------------------------------------------------- régua de um número: um traço por vídeo do canal, este destacado, a mediana marcada */
  A.regua = function(vals, mine, fmtV){
    var W = 600, H = 34, ok = vals.filter(function(v){ return v != null; }), lo = Math.min.apply(null, ok.concat([mine])), hi = Math.max.apply(null, ok.concat([mine])), span = hi - lo || 1, med = A.mediana(ok);
    function X(v){ return 6 + (W - 12) * (v - lo) / span; }
    var s = '<svg class="rg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" height="34" aria-hidden="true"><line class="rg-tr" x1="6" x2="' + (W - 6) + '" y1="22" y2="22"/>';
    ok.forEach(function(v){ s += '<line class="rg-tk" x1="' + X(v) + '" x2="' + X(v) + '" y1="14" y2="28"/>'; });
    s += '<polygon class="rg-md" points="' + (X(med) - 5) + ',34 ' + (X(med) + 5) + ',34 ' + X(med) + ',28"/><line class="rg-me" x1="' + X(mine) + '" x2="' + X(mine) + '" y1="6" y2="32"/></svg>';
    return s;
  };

  /* ---------------------------------------------------------------- a curva de retenção. cfg: { pts: [razão ...], dur: segundos, parcial: bool } */
  A.curva = function(host, cfg){
    var W = Math.max(300, Math.floor(host.clientWidth || 640)), H = W < 520 ? 200 : 240, L = 40, R = 10, T = 14, B = 40, PW = W - L - R, PH = H - T - B, pts = cfg.pts, n = pts.length, max = 1.2;
    function X(i){ return L + PW * i / (n - 1); } function Y(v){ return T + PH * (1 - Math.min(v, max) / max); }
    var s = '<svg class="curva" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(cfg.alt) + '">';
    [0, .5, 1].forEach(function(f){ s += '<line class="ic-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(f) + '" y2="' + Y(f) + '"/><text class="cv-t" x="' + (L - 6) + '" y="' + (Y(f) + 4) + '" text-anchor="end">' + Math.round(f * 100) + '%</text>'; });
    var d = pts.map(function(v, i){ return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
    s += '<path class="cv-area" d="' + d + 'L' + X(n - 1) + ' ' + Y(0) + 'L' + X(0) + ' ' + Y(0) + 'Z"/>';
    (cfg.rea || []).forEach(function(r){ s += '<rect class="cv-re" x="' + X(r[0]) + '" y="' + T + '" width="' + (X(r[1]) - X(r[0])) + '" height="' + PH + '"/>'; });
    s += '<path class="cv-l" d="' + d + '"' + (cfg.parcial ? ' stroke-dasharray="1 0"' : '') + '/>';
    if (cfg.meio != null) s += '<line class="cv-ml" x1="' + X(cfg.meio * (n - 1)) + '" x2="' + X(cfg.meio * (n - 1)) + '" y1="' + T + '" y2="' + (T + PH) + '"/><text class="cv-lb" x="' + (X(cfg.meio * (n - 1)) + 6) + '" y="' + (T + 14) + '">metade já saiu aqui</text>';
    (cfg.saidas || []).forEach(function(i){ s += '<polygon class="cv-sa" points="' + (X(i) - 6) + ',' + (T + PH + 12) + ' ' + (X(i) + 6) + ',' + (T + PH + 12) + ' ' + X(i) + ',' + (T + PH + 3) + '"/>'; });
    [0, .25, .5, .75, 1].forEach(function(f, k){ s += '<text class="cv-t" x="' + (L + PW * f) + '" y="' + (H - 4) + '" text-anchor="' + (k === 0 ? 'start' : k === 4 ? 'end' : 'middle') + '">' + A.dur(cfg.dur * f) + '</text>'; });
    s += '</svg>'; host.innerHTML = s + '<div class="cv-leg"><span><i class="l"></i>parte do público que ainda assiste</span>' + ((cfg.rea || []).length ? '<span><i class="re"></i>trecho revisto (muita gente voltou)</span>' : '') + ((cfg.saidas || []).length ? '<span><i class="sa"></i>maior saída</span>' : '') + '</div>';
  };

  window.addEventListener('DOMContentLoaded', function(){ A.ligarInfos(); });
})();
