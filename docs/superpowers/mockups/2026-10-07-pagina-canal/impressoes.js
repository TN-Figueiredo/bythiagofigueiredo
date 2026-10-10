/* impressoes.js — rodadas 7 e 8. O gráfico "Impressões por dia" do canal próprio e de cada vídeo próprio.
   Ele separa TRÊS coisas que neste sistema nunca se confundem:
     'imp'   dia com relatório e com impressões        → barra, com o número em cima
     'zero'  dia com relatório e nenhuma impressão     → zero MEDIDO: um traço na linha de base
     'falta' dia cujo relatório ainda não foi baixado  → NÃO MEDIDO: coluna hachurada de cima a baixo
   Rodada 8: sem símbolo decorado. Duas linhas com nome: o gráfico é "impressões" (eixo com o nome) e, logo abaixo das datas, a faixa
   "cliques" com o número sob cada dia que teve clique. Cada dia tem uma dica (mouse e teclado: setas, Home e End) com a frase inteira.
   Tudo sai de window.PROPRIO (dados-proprio.js): reach = [dia, vídeo, impressões, ctr], diasVazios, periodo. Nada é inventado.
   Cores: só tokens do CMS (--text, --muted, --dim, --border*). Sem movimento. */
(function(){
  'use strict';
  var P = window.PROPRIO, DIA = 864e5;
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dm(iso){ return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  /* a série de um vídeo (ou do canal inteiro quando videoId é nulo), um item por dia do período.
     fonte do zero: 'vazio' = o relatório do dia veio só com o cabeçalho; 'sem' = o relatório trouxe outros vídeos, mas nenhuma linha deste */
  function serie(videoId){
    var com = {}, porDia = {};
    P.reach.forEach(function(r){ com[r[0]] = 1; if (videoId && r[1] !== videoId) return; var x = porDia[r[0]] || (porDia[r[0]] = { imp: 0, cl: 0 }); x.imp += r[2]; x.cl += r[2] * r[3]; });
    var vazio = {}; P.diasVazios.forEach(function(d){ vazio[d] = 1; });
    var out = [], t = Date.parse(P.periodo[0] + 'T12:00:00Z'), fim = Date.parse(P.periodo[1] + 'T12:00:00Z');
    for (; t <= fim; t += DIA){
      var d = new Date(t).toISOString().slice(0, 10), x = porDia[d];
      out.push(x && x.imp ? { d: d, st: 'imp', imp: x.imp, cl: Math.round(x.cl) } : (com[d] || vazio[d]) ? { d: d, st: 'zero', fonte: vazio[d] ? 'vazio' : 'sem', imp: 0, cl: 0 } : { d: d, st: 'falta', imp: null, cl: null });
    }
    return out;
  }
  function resumo(S){
    var r = { dias: S.length, imp: 0, cl: 0, com: 0, zero: 0, falta: 0 };
    S.forEach(function(x){ if (x.st === 'imp'){ r.com++; r.imp += x.imp; r.cl += x.cl; } else if (x.st === 'zero') r.zero++; else r.falta++; });
    return r;
  }
  function plural(n, um, muitos){ return n + ' ' + (n === 1 ? um : muitos); }
  function frase(r){
    return plural(r.imp, 'impressão', 'impressões') + ' e ' + (r.cl ? plural(r.cl, 'clique estimado', 'cliques estimados') : 'nenhum clique estimado') + ' em ' + r.dias + ' dias: ' +
      plural(r.com, 'dia com impressão', 'dias com impressão') + ', ' + plural(r.zero, 'dia medido em zero', 'dias medidos em zero') + ' e ' + plural(r.falta, 'dia ainda sem relatório baixado', 'dias ainda sem relatório baixado') + '.';
  }
  /* a frase de cada dia: vai na dica, no rótulo de acessibilidade e é a mesma que a tabela resume */
  function diaTxt(x, videoId){
    if (x.st === 'falta') return dm(x.d) + ': relatório ainda não baixado (não medido)';
    if (x.st === 'zero') return dm(x.d) + ': ' + (x.fonte === 'sem' && videoId ? 'o relatório do dia não trouxe este vídeo (nenhuma impressão)' : 'relatório veio vazio (nenhuma impressão)');
    return dm(x.d) + ': ' + plural(x.imp, 'impressão', 'impressões') + ', ' + (x.cl ? plural(x.cl, 'clique estimado', 'cliques estimados') : 'nenhum clique');
  }
  var nId = 0;
  var vivos = [];   /* contêineres já desenhados: repintam quando a largura muda (rodada 12) */
  function render(el, S, o){
    o = o || {};
    var tabAberta = !!(el.querySelector('.ic-tab') && el.querySelector('.ic-tab').open);
    if (el._ictip){ el._ictip.remove(); el._ictip = null; }
    el._icArgs = [S, o]; el._icW = Math.round(el.clientWidth); if (vivos.indexOf(el) < 0) vivos.push(el);
    var id = 'ic' + (++nId), cw = Math.round(el.clientWidth) || 760, estreito = cw < 560,
       W = estreito ? Math.max(300, cw) : Math.min(860, cw),   /* o desenho nasce na largura em que aparece: o texto fica em 12 px, sem encolher. Rodada 9: abaixo de 560 px ele cabe na coluna (sem rolagem interna): margem esquerda menor, os mesmos 29 dias */
       L = estreito ? 46 : 58, R = 6, T = 30, PH = o.ph || 110, DR = 22, CR = 24, B = 6, n = S.length, bw = (W - L - R) / n, R_ = resumo(S);
    var H = T + PH + DR + CR + B, yDatas = T + PH + 15, yCl = T + PH + DR, vid = !!o.video;
    var max = Math.max.apply(null, S.map(function(x){ return x.imp || 0; }).concat([1])), topo = max <= 4 ? 4 : max <= 10 ? 10 : Math.ceil(max / 20) * 20;
    function y(v){ return T + PH - v / topo * PH; }
    var g = '<defs><pattern id="' + id + 'h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="ic-hb"/><line x1="0" y1="0" x2="0" y2="6" class="ic-hl"/></pattern></defs>';
    g += '<text class="ic-an" x="0" y="11">impressões</text>';
    [0, topo / 2, topo].forEach(function(v){ g += '<line class="ic-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ic-ax" x="' + (L - 6) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + v + '</text>'; });
    g += '<line class="ic-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + yCl + '" y2="' + yCl + '"/><text class="ic-an r" x="' + (L - 6) + '" y="' + (yCl + 16) + '" text-anchor="end">cliques</text>';
    var hits = '';
    S.forEach(function(x, i){
      var x0 = L + i * bw, cx = x0 + bw / 2, w = Math.max(6, bw - 6), topY = T + PH;
      if (x.st === 'falta'){
        g += '<rect class="ic-falta" x="' + (x0 + 1) + '" y="' + T + '" width="' + (bw - 2) + '" height="' + PH + '" fill="url(#' + id + 'h)"/>' +
             '<rect class="ic-falta" x="' + (x0 + 1) + '" y="' + (yCl + 3) + '" width="' + (bw - 2) + '" height="' + (CR - 6) + '" fill="url(#' + id + 'h)"/>';
      } else if (x.st === 'zero'){
        g += '<line class="ic-zero" x1="' + (cx - w / 2) + '" x2="' + (cx + w / 2) + '" y1="' + (T + PH) + '" y2="' + (T + PH) + '"/>';
      } else {
        var h = Math.max(3, x.imp / topo * PH); topY = T + PH - h;
        g += '<rect class="ic-bar" x="' + (cx - w / 2) + '" y="' + topY + '" width="' + w + '" height="' + h + '" rx="1.5"/><text class="ic-val" x="' + cx + '" y="' + (topY - 5) + '" text-anchor="middle">' + x.imp + '</text>';
        if (x.cl) g += '<circle class="ic-dot" cx="' + cx + '" cy="' + (T + PH - 4.5) + '" r="3.6"/><text class="ic-cln" x="' + cx + '" y="' + (yCl + 16) + '" text-anchor="middle">' + x.cl + '</text>';
      }
      if (i === 0 || i === n - 1 || i % 7 === 0 && i < n - 3) g += '<text class="ic-ax" x="' + (estreito && i === n - 1 ? W - R : cx) + '" y="' + yDatas + '" text-anchor="' + (estreito && i === n - 1 ? 'end' : 'middle') + '">' + dm(x.d) + '</text>';
      hits += '<rect class="ic-hit" x="' + x0 + '" y="' + T + '" width="' + bw + '" height="' + (PH + DR + CR) + '" tabindex="' + (i === 0 ? 0 : -1) + '" role="img" aria-label="' + esc(diaTxt(x, vid)) + '" data-i="' + i + '" data-top="' + topY + '" data-cx="' + cx + '"/>';
    });
    /* rodada 11: legenda em uma linha, com a amostra de cada estado (a forma e o texto dizem o mesmo que a cor) */
    var leg = '<span class="ic-lg"><i class="ic-sw imp" aria-hidden="true"></i>impressões do dia</span>' +
      '<span class="ic-lg"><i class="ic-sw cl" aria-hidden="true"></i>cliques estimados</span>' +
      '<span class="ic-lg"><i class="ic-sw zero" aria-hidden="true"></i>' + (vid ? 'zero medido: relatório sem impressão deste vídeo' : 'zero medido: relatório vazio') + '</span>' +
      '<span class="ic-lg"><i class="nm-h" aria-hidden="true"></i>não medido: relatório ainda não baixado</span>';
    var rot = { imp: 'com impressões', zero: 'relatório veio vazio: zero medido', zerosem: 'relatório baixado, sem este vídeo: zero medido', falta: 'ainda não baixado: não medido' };
    el.innerHTML = '<figure class="ic">' +
      '<div class="ic-sc"><svg class="ic-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc((o.titulo || 'Impressões por dia') + ', de ' + dm(S[0].d) + ' a ' + dm(S[n - 1].d) + '. ' + frase(R_) + ' Use as setas para percorrer os dias.') + '">' + g + hits + '</svg></div>' +
      '<figcaption class="ic-leg">' + leg + '</figcaption>' +
      '<details class="ic-tab"><summary>Ver como tabela</summary><div class="ic-tw"><table><caption class="sr">' + esc(o.titulo || 'Impressões por dia') + '</caption><thead><tr><th scope="col">Dia</th><th scope="col" class="r">Impressões</th><th scope="col" class="r">Cliques estimados</th><th scope="col">Estado do relatório</th></tr></thead><tbody>' +
      S.map(function(x){ var k = x.st === 'zero' && x.fonte === 'sem' && vid ? 'zerosem' : x.st; return '<tr class="' + x.st + '"><th scope="row">' + dm(x.d) + '</th><td class="r num">' + (x.st === 'falta' ? '<span class="nd">não medido</span>' : x.imp) + '</td><td class="r num">' + (x.st === 'falta' ? '<span class="nd">não medido</span>' : x.cl) + '</td><td>' + rot[k] + '</td></tr>'; }).join('') +
      '</tbody></table></div></details></figure>';
    if (tabAberta) el.querySelector('.ic-tab').open = true;
    ligar(el.querySelector('.ic'), S, vid, W);
    el._ictip = el.querySelector('.ic')._tip;
  }
  /* repinta quando a janela muda de largura ou o aparelho gira: o desenho nasce na largura do contêiner */
  var tResize = 0;
  function repintar(){
    vivos = vivos.filter(function(e){ return e.isConnected; });
    vivos.forEach(function(e){ if (Math.round(e.clientWidth) !== e._icW && e._icArgs) render(e, e._icArgs[0], e._icArgs[1]); });
  }
  addEventListener('resize', function(){ clearTimeout(tResize); tResize = setTimeout(repintar, 120); });
  addEventListener('orientationchange', function(){ clearTimeout(tResize); tResize = setTimeout(repintar, 250); });
  /* dica: aparece com o mouse e com o foco (roving: uma parada de Tab, setas percorrem os dias) */
  function ligar(fig, S, vid, W){
    var svg = fig.querySelector('svg'), tip = document.createElement('div'), hits = [].slice.call(fig.querySelectorAll('.ic-hit')), atual = -1;
    tip.className = 'ic-tip'; tip.setAttribute('aria-hidden', 'true'); tip.hidden = true; FLUT.montar(tip); fig._tip = tip;
    FLUT.aoAbrirEsconder(function(){ tip.hidden = true; });
    function mostrar(h){
      var x = S[+h.dataset.i]; tip.textContent = diaTxt(x, vid); tip.hidden = false; atual = +h.dataset.i;
      /* a dica fica ao lado da coluna (à direita; à esquerda se faltar lugar), no alto da área do gráfico: não cobre a barra do dia nem a dos vizinhos */
      var sr = svg.getBoundingClientRect(), k = sr.width / W;
      FLUT.posicionar(tip, h.getBoundingClientRect(), { pref: 'lado', y: sr.top + 30 * k + 2, gap: 8, maxW: 420 });
    }
    function esconder(){ tip.hidden = true; atual = -1; }
    fig._re = function(){ if (!tip.hidden && atual >= 0) mostrar(hits[atual]); };
    svg.addEventListener('mouseover', function(e){ var h = e.target.closest('.ic-hit'); if (h) mostrar(h); });
    svg.addEventListener('mouseleave', function(){ if (!fig.contains(document.activeElement) || !document.activeElement.classList.contains('ic-hit')) esconder(); else mostrar(document.activeElement); });
    svg.addEventListener('focusin', function(e){ var h = e.target.closest('.ic-hit'); if (!h) return; hits.forEach(function(x){ x.setAttribute('tabindex', x === h ? '0' : '-1'); }); mostrar(h); });
    svg.addEventListener('focusout', function(){ esconder(); });
    svg.addEventListener('keydown', function(e){
      var h = e.target.closest('.ic-hit'); if (!h) return; var i = +h.dataset.i, j = i;
      if (e.key === 'ArrowRight') j = Math.min(hits.length - 1, i + 1); else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1); else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = hits.length - 1;
      else if (e.key === 'Escape'){ esconder(); return; } else return;
      e.preventDefault(); hits[j].focus();
    });
  }
  addEventListener('scroll', function(){ vivos.forEach(function(e){ var f = e.querySelector('.ic'); if (f && f._re) f._re(); }); }, { passive: true, capture: true });
  window.IMPRESSOES = { serie: serie, resumo: resumo, frase: frase, render: render, dm: dm, diaTxt: diaTxt };
})();
