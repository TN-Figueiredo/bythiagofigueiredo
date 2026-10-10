/* regua.js — rodada 10 (09/10/2026). O bloco "Este vídeo no canal" do vídeo próprio: uma frase-resumo, uma tabela com uma RÉGUA por número
   (um traço por vídeo do canal, posto pelo valor; este vídeo destacado; cor por terço) e a posição em texto.
   Só desenha o que recebe: não inventa número. Vídeo sem valor num número fica fora daquela régua e a linha diz "de 34".
   Cor nunca é o único portador: cada terço tem também uma forma (▲ cima, ● meio, ▼ baixo) e a posição vem escrita. */
(function(){
  'use strict';
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* terço de cima = "muito alto" da escala do múltiplo nas capas (violeta); meio = "alto" (azul); baixo = amarelo (rodada 11: o creme se confundia com o traço neutro da duração) */
  var BAND = {
    cima:  { cor: '#A78BFA', txt: 'terço de cima',  forma: '<path d="M6 1.5L10.5 9.5H1.5z"/>' },
    meio:  { cor: '#38BDF8', txt: 'terço do meio',  forma: '<circle cx="6" cy="6" r="4"/>' },
    baixo: { cor: '#F2C14E', txt: 'terço de baixo', forma: '<path d="M6 10.5L1.5 2.5H10.5z"/>' }
  };
  function marca(b){ return '<svg class="rg-mk" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style="fill:' + BAND[b].cor + '">' + BAND[b].forma + '</svg>'; }
  function raiz_(a){ return a.length > 0; }
  function lista(a){ return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }

  /* ---------------------------------------------------------------- escala e empates (compartilhados com a régua do nicho, em comparar.js) */
  /* escala: linear, a menos que a maioria se amontoe no primeiro quarto do eixo; aí raiz quadrada (e a tela diz) */
  function escalar(xs){
    var min = Math.min.apply(null, xs), max = Math.max.apply(null, xs), corte = min + 0.25 * (max - min);
    var raiz = max > min && xs.filter(function(x){ return x < corte; }).length / xs.length >= 0.6;
    function f(x){ return raiz ? Math.sqrt(x - min) : x - min; }
    return { min: min, max: max, raiz: raiz, pct: function(x){ return max === min ? 50 : f(x) / f(max) * 100; } };
  }
  /* empates: o mesmo valor desloca 2,6 px para o lado, sem sair do vizinho; o traço destacado fica no valor exato.
     d: [{x}] já ordenado; ehMeu(e) diz se o traço é destacado. Escreve e.dx. */
  function espalhar(d, min, max, ehMeu){
    var S = 2.6, grupos = {};
    d.forEach(function(e, i){ (grupos[e.x] || (grupos[e.x] = [])).push(i); });
    Object.keys(grupos).forEach(function(k){
      var idx = grupos[k], mi = idx.filter(function(i){ return ehMeu(d[i]); }), ot = idx.filter(function(i){ return !ehMeu(d[i]); }), lado = 1, base;
      var ponta = +k === min && max > min ? 1 : +k === max && max > min ? -1 : 0;   /* nas pontas o empate se abre para dentro da régua, nunca para fora */
      mi.forEach(function(i){ d[i].dx = 0; });
      if (mi.length) base = 4.4; else { if (ot.length){ d[ot[0]].dx = 0; ot = ot.slice(1); } base = S; }
      ot.forEach(function(i, j){ d[i].dx = ponta ? ponta * (base + j * S) : lado * (base + Math.floor(j / 2) * S); lado = -lado; });
    });
  }

  /* ---------------------------------------------------------------- estatística de um número */
  function analisar(T, v, it){
    var d = [];
    T.forEach(function(o){ var x = it.get(o); if (x != null && isFinite(x)) d.push({ o: o, x: x }); });
    d.sort(function(a, b){ return a.x - b.x || b.o.pub - a.o.pub; });
    var n = d.length, r = { it: it, d: d, n: n, mine: null };
    if (!n) return r;
    var min = d[0].x, max = d[n - 1].x, mid = n >> 1;
    r.min = min; r.max = max; r.med = n % 2 ? d[mid].x : (d[mid - 1].x + d[mid].x) / 2;
    var es = escalar(d.map(function(e){ return e.x; }));
    r.raiz = es.raiz; r.pct = es.pct;
    var mine = it.get(v);
    if (mine != null && isFinite(mine)){
      var maiores = d.filter(function(e){ return e.x > mine; }).length, iguais = d.filter(function(e){ return e.x === mine; }).length - 1;
      r.mine = mine; r.pos = maiores + 1; r.emp = iguais;
      var meio = r.pos + iguais / 2;    /* posição média no empate: o terço não depende de a quem o desempate favorece */
      r.band = it.neutra ? null : meio <= n / 3 ? 'cima' : meio <= 2 * n / 3 ? 'meio' : 'baixo';
    }
    espalhar(d, min, max, function(e){ return e.o === v; });
    return r;
  }

  /* ---------------------------------------------------------------- a frase do topo, sem número */
  function frase(A, nPoucas, semImp){
    var topo1 = [], cima = [], meio = [], baixo = [];
    A.forEach(function(r){
      if (r.it.neutra || r.mine == null) return;
      var nome = r.it.nome;
      if (r.pos === 1 && r.emp === 0) topo1.push(nome); else if (r.band === 'cima') cima.push(nome); else if (r.band === 'meio') meio.push(nome); else baixo.push(nome);
    });
    var p = [];
    if (semImp) p.push({ b: null, t: 'Sem impressão no período.' });
    if (topo1.length) p.push({ b: 'cima', t: 'Primeiro do canal em ' + lista(topo1) + (nPoucas && topo1.indexOf('impressões') >= 0 ? ', mas com poucas' : '') + '.' });
    if (cima.length) p.push({ b: 'cima', t: 'No terço de cima em ' + lista(cima) + '.' });
    if (meio.length) p.push({ b: 'meio', t: 'No meio em ' + lista(meio) + '.' });
    if (baixo.length) p.push({ b: 'baixo', t: 'No terço de baixo em ' + lista(baixo) + '.' });
    return p;
  }

  /* ---------------------------------------------------------------- uma linha da tabela */
  function linha(r, v, N, periodo){
    var it = r.it, nm = '<th scope="row" role="rowheader" class="rg-nm">' + esc(it.nome.charAt(0).toUpperCase() + it.nome.slice(1)) + '</th>';
    if (it.semValorTxt && r.mine == null) return '<tr role="row" class="rg-r">' + nm + '<td role="cell" colspan="5" class="rg-sem">' + esc(it.semValorTxt) + '</td></tr>';
    if (!r.n) return '<tr role="row" class="rg-r">' + nm + '<td role="cell" colspan="5" class="rg-sem">sem valor em nenhum vídeo do canal</td></tr>';
    var tem = r.mine != null, de = r.n === N ? N : r.n;
    var tick = '', i0 = -1;
    r.d.forEach(function(e, i){
      var eu = e.o === v; if (eu) i0 = i;
      tick += '<i class="rg-t' + (eu ? ' rg-me' + (r.band ? ' b-' + r.band : '') : '') + '" data-i="' + i + '" style="left:calc(' + r.pct(e.x).toFixed(2) + '% + ' + (e.dx || 0).toFixed(1) + 'px)"></i>';
    });
    var med = '<i class="rg-med" style="left:' + r.pct(r.med).toFixed(2) + '%"></i>';
    var foco = 'Régua de ' + it.nome + ': ' + de + ' vídeos do canal, do menor ao maior valor. Setas percorrem os vídeos, Enter abre o vídeo, Esc fecha a dica.';
    var ruler = '<td role="cell" class="rg-c"><div class="rg" tabindex="0" role="group" aria-label="' + esc(foco) + '" data-m="' + esc(it.k) + '" data-i0="' + i0 + '">' +
      '<div class="rg-in" aria-hidden="true"><i class="rg-base"></i>' + med + tick + '</div></div></td>';
    var val = '<td role="cell" class="rg-v num">' + (tem ? esc(it.fmt(r.mine)) : '—') + '</td>';
    var ps = '';
    if (tem){
      var txt = r.pos + 'º de ' + de, vis = it.href ? '<a href="' + esc(it.href) + '">' + txt + '</a>' : txt;
      var sr = r.pos + 'º de ' + de + ' em ' + it.nome + (r.band ? ', ' + BAND[r.band].txt : '') + (r.emp ? ', empate com ' + r.emp : '') + '; ' + it.sr(r.mine) + '; no canal de ' + it.fmt(r.min) + ' a ' + it.fmt(r.max) + '; mediana ' + it.fmt(r.med);
      ps = '<td role="cell" class="rg-p">' + (r.band ? marca(r.band) : '<span class="rg-mk0" aria-hidden="true"></span>') + '<span class="rg-pt" aria-hidden="true">' + vis + (r.emp ? '<small>empate com ' + r.emp + '</small>' : '') + '</span><span class="sr">' + esc(sr) + '</span></td>';
    } else {
      ps = '<td role="cell" class="rg-p"><span class="rg-pt">sem posição</span></td>';
    }
    var mn = '<td role="cell" class="rg-e rg-mn num"><span class="sr">menor: </span>' + esc(it.fmt(r.min)) + '</td>', mx = '<td role="cell" class="rg-e rg-mx num"><span class="sr">maior: </span>' + esc(it.fmt(r.max)) + '</td>';
    return '<tr role="row" class="rg-r' + (r.raiz ? ' raiz' : '') + '">' + nm + val + mn + ruler + mx + ps + '</tr>';
  }

  /* ---------------------------------------------------------------- montagem. cfg: { T, v, grupos:[{g, itens}], periodo, abrir(o), honestidade, poucas } */
  function montar(el, cfg){
    var T = cfg.T, v = cfg.v, N = T.length, all = [];
    var grupos = cfg.grupos.map(function(g){ return { g: g.g, rows: g.itens.map(function(it){ var r = analisar(T, v, it); all.push(r); return r; }) }; });
    var semImp = all.some(function(r){ return r.it.k === 'imp' && r.mine == null; });
    var impRow = all.filter(function(r){ return r.it.k === 'imp'; })[0];
    var fr = frase(all, cfg.poucas, semImp);
    var frHtml = fr.map(function(p){ return '<span class="rg-cl">' + (p.b ? marca(p.b) : '') + esc(p.t) + '</span>'; }).join(' ');
    var raizes = all.filter(function(r){ return r.raiz; }).map(function(r){ return r.it.nome; });
    var body = grupos.map(function(g){
      return '<tbody role="rowgroup"><tr role="row" class="rg-g"><th scope="rowgroup" role="rowheader" colspan="6">' + esc(g.g) + '</th></tr>' + g.rows.map(function(r){ return linha(r, v, N, cfg.periodo); }).join('') + '</tbody>';
    }).join('');
    var lin = all.filter(function(r){ return r.n && !r.raiz; }).map(function(r){ return r.it.nome; });
    var escalaTxt = (raiz_(raizes) ? 'Escala comprimida (raiz quadrada) em ' + lista(raizes) + ', para caber o maior sem apagar os pequenos' + (lin.length ? '; ' + lista(lin) + ' em escala linear' : '') + '. ' : 'Escala linear em todas. ') +
      'Mesmo valor fica lado a lado. Duração não leva cor: vídeo longo não é melhor nem pior.';
    var INFO = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.6M8 5.1v.2"/></svg>';
    var legenda = '<p class="rg-lg" aria-hidden="false"><span class="rg-lg1"><span class="rg-ex"><i class="rg-t"></i></span>um vídeo do canal</span>' +
      '<span class="rg-lg1"><span class="rg-ex"><i class="rg-t rg-me"></i></span>este vídeo</span>' +
      '<span class="rg-lg1"><i class="rg-med rg-medx"></i>mediana do canal</span>' +
      '<span class="rg-lg1">' + marca('cima') + 'terço de cima</span><span class="rg-lg1">' + marca('meio') + 'meio</span><span class="rg-lg1">' + marca('baixo') + 'terço de baixo</span>' +
      '<button type="button" class="ibtn rg-info" aria-expanded="false" aria-label="Sobre a escala das réguas">' + INFO + '</button></p>';
    el.innerHTML = '<p class="rg-fr">' + frHtml + '</p>' +
      '<div class="rg-tw"><table class="rg-t0" role="table"><caption class="sr">Onde este vídeo fica entre os ' + N + ' do canal, em cada número. Cada linha tem o valor deste vídeo, uma régua com um traço por vídeo do canal e a posição.</caption>' +
      '<colgroup><col class="cg-nm"><col class="cg-v"><col class="cg-e"><col><col class="cg-e2"><col class="cg-p"></colgroup>' +
      '<thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader"><span class="sr">Número</span></th><th scope="col" role="columnheader" class="rg-hv">este vídeo</th>' +
      '<th scope="col" role="columnheader" colspan="3" class="rg-hr"><span class="rg-hh"><span>menor</span><span class="rg-hm">os ' + N + ' vídeos do canal</span><span>maior</span></span></th><th scope="col" role="columnheader" class="rg-hp">posição</th></tr></thead>' +
      body + '</table></div>' + legenda + (cfg.honestidade ? '<p class="rg-hon">' + cfg.honestidade + '</p>' : '') +
      '<p class="sr" id="rgLive" aria-live="polite"></p>';

    /* ------------------------------------------------------------ dica e teclado: uma parada de Tab por régua */
    var ib = el.querySelector('.rg-info');
    if (ib && window.FAIXA) ib.addEventListener('click', function(e){ e.stopPropagation(); window.FAIXA.dica(ib, '<h3>Como ler as réguas</h3><p class="m" style="margin:0">' + esc(escalaTxt) + '</p>'); });
    var tip = document.createElement('div'); tip.className = 'rg-tip'; tip.setAttribute('role', 'presentation'); tip.hidden = true; FLUT.montar(tip); FLUT.aoAbrirEsconder(function(){ fechar(); });
    var live = el.querySelector('#rgLive'), porK = {}; all.forEach(function(r){ porK[r.it.k] = r; });
    var atual = null, tipoPont = 'mouse';
    function marcar(rg, i){
      [].forEach.call(rg.querySelectorAll('.rg-t.on'), function(t){ t.classList.remove('on'); });
      if (i != null){ var t = rg.querySelector('.rg-t[data-i="' + i + '"]'); if (t) t.classList.add('on'); }
    }
    function fechar(){ tip.hidden = true; if (atual) marcar(atual.rg, null); atual = null; }
    function mostrar(rg, i, falar){
      var r = porK[rg.getAttribute('data-m')], e = r.d[i]; if (!e) return;
      if (atual && atual.rg !== rg) marcar(atual.rg, null);
      atual = { rg: rg, i: i, r: r }; marcar(rg, i);
      var t = e.o.t.length > 58 ? e.o.t.slice(0, 57) + '…' : e.o.t, eu = e.o === v;
      tip.innerHTML = '<b>' + esc(t) + '</b><span><span class="num">' + esc(r.it.fmt(e.x)) + '</span> ' + esc(r.it.un || '') + (eu ? ' · este vídeo' : '') + '</span>';
      tip.hidden = false;
      var tk = rg.querySelector('.rg-t[data-i="' + i + '"]'), a = tk.getBoundingClientRect();
      FLUT.posicionar(tip, rg, { pref: 'cima', alinhar: 'meio', cx: a.left + a.width / 2, gap: 4, maxW: 300 });
      if (falar) live.textContent = e.o.t + ': ' + r.it.fmt(e.x) + ' ' + (r.it.un || '') + (eu ? ' (este vídeo)' : '');
    }
    function maisPerto(rg, cx){
      var melhor = -1, dm = 1e9;
      [].forEach.call(rg.querySelectorAll('.rg-t'), function(t){ var b = t.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - cx); if (d < dm){ dm = d; melhor = +t.getAttribute('data-i'); } });
      return melhor;
    }
    var tab = el.querySelector('.rg-tw');
    tab.addEventListener('pointerdown', function(e){ tipoPont = e.pointerType || 'mouse'; });
    tab.addEventListener('pointermove', function(e){
      var rg = e.target.closest && e.target.closest('.rg'); if (!rg || e.pointerType === 'touch') return;
      mostrar(rg, maisPerto(rg, e.clientX), false);
    });
    tab.addEventListener('pointerleave', function(){ if (!(atual && document.activeElement === atual.rg)) fechar(); });
    tab.addEventListener('pointerout', function(e){ var rg = e.target.closest && e.target.closest('.rg'); if (rg && !rg.contains(e.relatedTarget) && document.activeElement !== rg) fechar(); });
    tab.addEventListener('click', function(e){
      var rg = e.target.closest && e.target.closest('.rg'); if (!rg) return;
      var i = maisPerto(rg, e.clientX), r = porK[rg.getAttribute('data-m')], o = r.d[i].o;
      if (tipoPont === 'touch' && !(atual && atual.rg === rg && atual.i === i)){ mostrar(rg, i, false); return; }
      if (o !== v) cfg.abrir(o);
    });
    tab.addEventListener('focusin', function(e){
      var rg = e.target.closest && e.target.closest('.rg'); if (!rg || e.target !== rg) return;
      var i = +rg.getAttribute('data-i0'); if (i < 0) i = porK[rg.getAttribute('data-m')].n >> 1;
      rg._i = i; mostrar(rg, i, true);
    });
    tab.addEventListener('focusout', function(e){ var rg = e.target.closest && e.target.closest('.rg'); if (rg && e.target === rg) fechar(); });
    tab.addEventListener('keydown', function(e){
      var rg = e.target.closest && e.target.closest('.rg'); if (!rg || e.target !== rg) return;
      var r = porK[rg.getAttribute('data-m')], i = rg._i != null ? rg._i : 0, n = r.n;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') i = Math.min(n - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') i = Math.max(0, i - 1);
      else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1;
      else if (e.key === 'Escape'){ fechar(); live.textContent = ''; return; }
      else if (e.key === 'Enter'){ var o = r.d[rg._i != null ? rg._i : 0].o; if (o !== v){ e.preventDefault(); cfg.abrir(o); } return; }
      else return;
      e.preventDefault(); rg._i = i; mostrar(rg, i, true);
    });
    window.addEventListener('scroll', function(){ if (atual && !tip.hidden) mostrar(atual.rg, atual.i, false); }, { passive: true, capture: true }); window.addEventListener('resize', fechar);
    return { analise: all };
  }
  /* ---------------------------------------------------------------- rodada 11: a régua do NICHO (uma linha de comparar.html).
     Mesma marcação e mesma escala da régua do vídeo: um traço por canal do nicho, do menor ao maior; dois traços destacados (os lados A e B),
     cada um com a sua cor e uma letra embaixo. vals: [{ id, x }] (só quem tem valor entra); marks: [{ id, letra, cor }] (precisam estar em vals).
     Devolve { html, raiz, n, pos: { id: { pos, emp } } }: a posição é "Nº de n" (1º = maior), com empate dito. */
  function nicho(vals, marks, aria, o){
    o = o || {};
    var d = vals.map(function(e){ return { id: e.id, nome: e.nome || e.id, x: e.x }; }).sort(function(a, b){ return a.x - b.x || (a.nome < b.nome ? -1 : 1); });
    var xs = d.map(function(e){ return e.x; }), es = escalar(xs), mk = {};
    marks.forEach(function(m){ mk[m.id] = m; });
    espalhar(d, es.min, es.max, function(e){ return !!mk[e.id]; });
    /* rodada 12: empates. Valores idênticos SEM lado destacado empilham na vertical (um bloco por canal, para contar quantos são);
       empate com um lado destacado mantém o traço alto no valor exato e abre os outros 2,6 px para os lados (espalhar). */
    var gr = {}; d.forEach(function(e, i){ (gr[e.x] || (gr[e.x] = [])).push(i); });
    Object.keys(gr).forEach(function(k){
      var idx = gr[k]; idx.forEach(function(i){ d[i].n = idx.length; d[i].grupo = idx; });
      if (idx.length < 2 || idx.some(function(i){ return !!mk[d[i].id]; })) return;
      var passo = Math.min(5, Math.floor(26 / idx.length));
      idx.forEach(function(i, j){ d[i].dx = 0; d[i].alt = 19 + j * passo; d[i].passo = passo; });
    });
    var pos = {}, t = '', ch = '';
    marks.forEach(function(m){
      var x = (d.filter(function(e){ return e.id === m.id; })[0] || {}).x;
      pos[m.id] = { pos: d.filter(function(e){ return e.x > x; }).length + 1, emp: d.filter(function(e){ return e.x === x; }).length - 1 };
    });
    d.forEach(function(e, i){
      var m = mk[e.id], l = 'calc(' + es.pct(e.x).toFixed(2) + '% + ' + (e.dx || 0).toFixed(1) + 'px)', pil = e.alt != null && !m;
      e.i = i; e.marca = m ? m.letra : null;
      t += '<i class="rg-t' + (m ? ' rg-me rg-mk-' + m.letra.toLowerCase() : '') + (pil ? ' rg-pl' : '') + '" data-i="' + i + '"' +
        (m ? ' style="--c:' + m.cor + ';left:' + l + '"' : ' style="left:' + l + (pil ? ';bottom:' + e.alt + 'px;height:' + (e.passo - 2) + 'px' : '') + '"') + '></i>';
      if (m) ch += '<b class="rg-ch" data-l="' + m.letra.toLowerCase() + '" style="--c:' + m.cor + ';left:' + es.pct(e.x).toFixed(2) + '%">' + esc(m.letra) + '</b>';
    });
    var foco = (aria || '') + ' Uma parada de Tab; as setas percorrem os canais do menor ao maior valor; Esc fecha a dica.';
    return { html: '<div class="rg cmp" tabindex="0" role="group" aria-label="' + esc(foco) + '"' + (o.k ? ' data-k="' + esc(o.k) + '"' : '') + '><div class="rg-in" aria-hidden="true"><i class="rg-base"></i>' + t + ch + '</div></div>', raiz: es.raiz, n: d.length, pos: pos, d: d, fmt: o.fmt, un: o.un };
  }
  /* a dica e o teclado da régua do nicho (rodada 12): mesmo desenho da régua do vídeo próprio.
     root: contêiner estável (a tabela é refeita, ele não); porK(k) devolve o que nicho() devolveu para aquele número. */
  var tipN = null, liveN = null;
  function ligarNicho(root, porK){
    if (!tipN){ tipN = document.createElement('div'); tipN.className = 'rg-tip'; tipN.setAttribute('role', 'presentation'); tipN.hidden = true; FLUT.montar(tipN); FLUT.aoAbrirEsconder(function(){ fechar(); }); }
    liveN = root.querySelector('.rg-live') || (function(){ var p = document.createElement('p'); p.className = 'sr rg-live'; p.setAttribute('aria-live', 'polite'); root.parentNode.insertBefore(p, root); return p; })();
    var atual = null;
    function marcar(rg, i){
      [].forEach.call(rg.querySelectorAll('.rg-t.on'), function(x){ x.classList.remove('on'); });
      if (i != null){ var x = rg.querySelector('.rg-t[data-i="' + i + '"]'); if (x) x.classList.add('on'); }
    }
    function fechar(){ tipN.hidden = true; if (atual) marcar(atual.rg, null); atual = null; }
    function txt(R, e, ponteiro){
      var un = R.un ? ' ' + R.un : '', val = R.fmt(e.x) + un, lado = e.marca ? ' · lado ' + e.marca : '';
      if (e.n > 1){
        var nomes = e.grupo.map(function(j){ return R.d[j].nome; }), tie = e.n + ' canais com ' + R.fmt(e.x);
        if (ponteiro) return { b: tie, s: nomes.slice(0, 6).join(', ') + (nomes.length > 6 ? ' e mais ' + (nomes.length - 6) : ''), fala: tie + ': ' + nomes.join(', ') };
        return { b: e.nome + lado, s: val + ' · ' + tie, fala: e.nome + ': ' + val + ', ' + tie };
      }
      return { b: e.nome + lado, s: val, fala: e.nome + ': ' + val };
    }
    function mostrar(rg, i, ponteiro, falar){
      var R = porK(rg.getAttribute('data-k')); if (!R || !R.d[i]) return;
      if (atual && atual.rg !== rg) marcar(atual.rg, null);
      var e = R.d[i]; atual = { rg: rg, i: i, R: R, p: !!ponteiro }; marcar(rg, i);
      var tx = txt(R, e, ponteiro);
      tipN.innerHTML = '<b>' + esc(tx.b) + '</b><span>' + esc(tx.s) + '</span>'; tipN.hidden = false;
      var tk = rg.querySelector('.rg-t[data-i="' + i + '"]'), a = tk.getBoundingClientRect();
      FLUT.posicionar(tipN, rg, { pref: 'cima', alinhar: 'meio', cx: a.left + a.width / 2, gap: 4, maxW: 300 });
      if (falar) liveN.textContent = tx.fala;
    }
    function maisPerto(rg, ev){
      var melhor = -1, dm = 1e9;
      [].forEach.call(rg.querySelectorAll('.rg-t'), function(x){ var b = x.getBoundingClientRect(), dx = b.left + b.width / 2 - ev.clientX, dy = Math.max(0, Math.abs(b.top + b.height / 2 - ev.clientY) - b.height / 2), dd = Math.abs(dx) * 3 + dy; if (dd < dm){ dm = dd; melhor = +x.getAttribute('data-i'); } });
      return melhor;
    }
    root.addEventListener('pointermove', function(e){ var rg = e.target.closest && e.target.closest('.rg.cmp'); if (!rg || e.pointerType === 'touch') return; var i = maisPerto(rg, e); if (i >= 0) mostrar(rg, i, true, false); });
    root.addEventListener('pointerdown', function(e){ var rg = e.target.closest && e.target.closest('.rg.cmp'); if (!rg || e.pointerType !== 'touch') return; var i = maisPerto(rg, e); if (i >= 0) mostrar(rg, i, true, false); });
    root.addEventListener('pointerout', function(e){ var rg = e.target.closest && e.target.closest('.rg.cmp'); if (rg && !rg.contains(e.relatedTarget) && document.activeElement !== rg) fechar(); });
    root.addEventListener('focusin', function(e){
      var rg = e.target.closest && e.target.closest('.rg.cmp'); if (!rg || e.target !== rg) return;
      var R = porK(rg.getAttribute('data-k')); if (!R) return;
      var i = rg._i != null ? rg._i : -1; if (i < 0){ var m = R.d.filter(function(x){ return x.marca; })[0]; i = m ? m.i : R.d.length >> 1; }
      rg._i = i; mostrar(rg, i, false, true);
    });
    root.addEventListener('focusout', function(e){ var rg = e.target.closest && e.target.closest('.rg.cmp'); if (rg && e.target === rg) fechar(); });
    root.addEventListener('keydown', function(e){
      var rg = e.target.closest && e.target.closest('.rg.cmp'); if (!rg || e.target !== rg) return;
      var R = porK(rg.getAttribute('data-k')); if (!R) return;
      var i = rg._i != null ? rg._i : 0, n = R.d.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') i = Math.min(n - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') i = Math.max(0, i - 1);
      else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1;
      else if (e.key === 'Escape'){ fechar(); liveN.textContent = ''; return; }
      else return;
      e.preventDefault(); rg._i = i; mostrar(rg, i, false, true);
    });
    addEventListener('scroll', function(){ if (atual && !tipN.hidden) mostrar(atual.rg, atual.i, atual.p, false); }, { passive: true, capture: true });
    addEventListener('resize', fechar);
  }
  /* as letras dos dois lados se afastam quando os traços colidem (os traços não saem do valor) */
  function ajustar(raiz){
    [].forEach.call((raiz || document).querySelectorAll('.rg.cmp .rg-in'), function(rin){
      var cs = rin.querySelectorAll('.rg-ch'); if (cs.length !== 2) return;
      cs[0].style.setProperty('--dx', '0px'); cs[1].style.setProperty('--dx', '0px');
      var a = cs[0].getBoundingClientRect(), b = cs[1].getBoundingClientRect(), dist = Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)), min = 20;
      if (dist < min){
        var f = (min - dist) / 2 + 1, esq = (a.left + a.width / 2) <= (b.left + b.width / 2) ? 0 : 1;
        cs[esq].style.setProperty('--dx', -f + 'px'); cs[1 - esq].style.setProperty('--dx', f + 'px');
      }
    });
  }
  window.addEventListener('resize', function(){ ajustar(); });
  window.REGUA = { montar: montar, BAND: BAND, nicho: nicho, ligarNicho: ligarNicho, ajustar: ajustar, escalar: escalar };
})();
