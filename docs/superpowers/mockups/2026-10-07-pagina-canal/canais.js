/* Lista de Canais — mockup (rodadas 6 e 7). O canal próprio aparece NO TOPO (bloco "Seu canal") E NA LISTA, na posição dele.
   Todo número vem de canais-dados.js (window.CANAIS). Estado na URL: ?fmt=todos|longos|shorts&sort=&dir=&ver=cartoes&q=&n=70&own=0.
   Rodada 12: filtro de formato Todos | Longos | Shorts (padrão Longos, lembrado). Em "Todos" cada célula mostra as DUAS medidas, rotuladas, sem misturar numa só; ordena pelos longos. */
(function(){
  'use strict';
  var D = window.CANAIS, $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dec(n, d){ return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function num(n){ var a = Math.abs(n); if (a >= 1e6) return dec(n / 1e6, a >= 1e7 ? 1 : 2) + ' mi'; if (a >= 1e3) return dec(n / 1e3, a >= 1e5 ? 0 : a >= 1e4 ? 1 : 2) + ' mil'; return dec(n, 0); }
  function taxa(n){ return n >= 1000 ? num(n) : n >= 10 ? dec(n, 0) : dec(n, 1); }
  function semAcento(s){ return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  /* fmt: 'longos' | 'shorts' | 'todos'. Texto por formato: x(fmt) devolve a variante. */
  function V3(f, l, sh, td){ return f === 'shorts' ? sh : f === 'todos' ? (td == null ? l : td) : l; }
  var COLS = [
    { k: 'inscritos', fm: false, t: function(){ return 'Inscritos'; }, u: function(){ return 'no YouTube'; }, em: function(){ return 'inscritos'; }, f: num },
    { k: 'vpd', fm: true, suf: '/dia', t: function(){ return 'Views/dia'; }, u: function(f){ return V3(f, 'mediana nos longos', 'mediana nos Shorts', 'longos e Shorts'); }, em: function(f){ return V3(f, 'views/dia nos longos', 'views/dia nos Shorts'); }, f: taxa },
    { k: 'vpm', fm: true, t: function(){ return 'Views/dia por mil'; }, u: function(f){ return V3(f, 'inscritos, nos longos', 'inscritos, nos Shorts', 'longos e Shorts'); }, em: function(f){ return V3(f, 'views/dia por mil inscritos nos longos', 'views/dia por mil inscritos nos Shorts'); }, f: function(n){ return dec(n, 2); } },
    { k: 'med', fm: true, t: function(){ return 'Mediana de views'; }, u: function(f){ return V3(f, 'dos longos', 'dos Shorts', 'longos e Shorts'); }, em: function(f){ return V3(f, 'mediana de views dos longos', 'mediana de views dos Shorts'); }, f: num },
    { k: 'l90', fm: true, t: function(f){ return V3(f, 'Longos em 90 dias', 'Shorts em 90 dias', 'Em 90 dias'); }, u: function(f){ return V3(f, 'publicados', 'publicados', 'longos e Shorts'); }, em: function(f){ return V3(f, 'longos publicados em 90 dias', 'Shorts publicados em 90 dias'); }, f: function(n){ return String(n); } },
    { k: 'acomp', fm: true, t: function(){ return 'Acompanhados'; }, u: function(f){ return V3(f, 'longos', 'Shorts', 'longos e Shorts'); }, em: function(f){ return V3(f, 'longos acompanhados', 'Shorts acompanhados'); }, f: function(n){ return String(n); } }
  ];
  var COL = {}; COLS.forEach(function(c){ COL[c.k] = c; });
  function emT(col){ return col.em(fOrd()); }
  var POR_DIA = { vpd: 1, vpm: 1 };
  var IC = { ch: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>', busca: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
    tab: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h11"/></svg>', card: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>' };
  var st = {};
  function ler(){
    var p = new URLSearchParams(location.search);
    st.sort = COL[p.get('sort')] ? p.get('sort') : 'vpm'; st.dir = p.get('dir') === 'asc' ? 'asc' : 'desc';
    var fm = p.get('fmt'); if (fm !== 'todos' && fm !== 'longos' && fm !== 'shorts'){ try { fm = localStorage.getItem('pc:canais-fmt'); } catch (e) { fm = null; } }
    st.fmt = fm === 'todos' || fm === 'shorts' ? fm : 'longos';
    st.n = p.get('n') === '70' ? 70 : 13; st.own = p.get('own') !== '0'; st.ver = p.get('ver') === 'cartoes' ? 'cartoes' : 'tabela'; st.q = (p.get('q') || '').slice(0, 60);
  }
  function gravar(push){
    var p = new URLSearchParams(); p.set('fmt', st.fmt); try { localStorage.setItem('pc:canais-fmt', st.fmt); } catch (e) {} if (st.sort !== 'vpm') p.set('sort', st.sort); if (st.dir !== 'desc') p.set('dir', st.dir); if (st.ver !== 'tabela') p.set('ver', st.ver); if (st.q) p.set('q', st.q); if (st.n === 70) p.set('n', '70'); if (!st.own) p.set('own', '0');
    var q = p.toString(); try { history[push ? 'pushState' : 'replaceState'](null, '', location.pathname + (q ? '?' + q : '')); } catch (e) {}
  }
  function concorrentes(){ return D.canais.concat(st.n === 70 ? D.ficticios : []); }
  function proprios(){ return st.own ? D.proprios : []; }
  /* formato usado na ORDEM: Shorts só no filtro Shorts; "Todos" ordena pelos longos */
  function fOrd(){ return st.fmt === 'shorts' ? 'shorts' : 'longos'; }
  function valor(c, k, fmt){ return k === 'inscritos' || fmt !== 'shorts' ? c[k] : (c.shorts ? c.shorts[k] : null); }
  /* posição = 1 + quantos canais têm valor maior (empate divide a posição). Nunca inventada: sem valor, sem posição. */
  var O = null;
  function ordenar(){
    var todos = concorrentes().concat(proprios()), k = st.sort, s = st.dir === 'asc' ? 1 : -1, fo = fOrd();
    var com = todos.filter(function(c){ return valor(c, k, fo) != null; }), sem = todos.filter(function(c){ return valor(c, k, fo) == null; });
    com.sort(function(a, b){ return s * (valor(a, k, fo) - valor(b, k, fo)) || b.inscritos - a.inscritos; });
    com.forEach(function(c){ var x = valor(c, k, fo); c._pos = 1 + com.filter(function(y){ return valor(y, k, fo) > x; }).length; c._emp = com.filter(function(y){ return valor(y, k, fo) === x; }).length > 1; });
    sem.forEach(function(c){ c._pos = null; c._emp = false; });
    sem.sort(function(a, b){ return (a.own ? 1 : 0) - (b.own ? 1 : 0) || b.inscritos - a.inscritos; });
    O = { com: com, sem: sem, total: com.length };
  }
  function passa(c){ var k = semAcento(st.q.trim()); return !k || semAcento(c.nome).indexOf(k) >= 0; }
  function href(c){ return c.own ? (c.semVideos ? null : 'canal-proprio.html') : c.id === 'leo-khev' ? 'canal.html' : null; }
  function ini(c){ return esc(c.nome.replace(/[^A-Za-zÀ-ú]/g, '').slice(0, 1).toUpperCase()); }
  function marca(c){ return c.own ? '<span class="own-seal">seu canal</span>' : c.ficticio ? '<span class="exm">exemplo</span>' : ''; }
  function semTxt(c, k, fmt){ return c.semVideos ? 'sem vídeos' : fmt === 'shorts' && c.shorts === null ? 'sem Shorts' : POR_DIA[k] ? (c.own ? 'ainda não medido' : 'aguarda o 2º registro') : 'não medido'; }
  function nomeHtml(c){ var h = href(c); return h ? '<a href="' + h + '">' + esc(c.nome) + '</a>' : '<span class="nm">' + esc(c.nome) + '</span>'; }
  function comparar(c, longo){ return !c.own && !c.ficticio && st.own ? '<a class="cmpl" href="comparar.html?a=proprio&b=' + c.id + '" aria-label="Comparar ' + esc(c.nome) + ' com o meu canal">' + (longo ? 'Comparar com o meu canal' : 'Comparar') + '</a>' : ''; }

  /* ---------------------------------------------------------------- tabela */
  /* uma medida, no formato fmt ('longos' | 'shorts'); sem dado diz por quê (nunca 0) */
  function medida(c, col, fmt){
    var v = valor(c, col.k, fmt);
    return v == null ? '<span class="nd">' + semTxt(c, col.k, fmt) + '</span>' : '<span class="num">' + col.f(v) + (col.suf || '') + '</span>';
  }
  /* "Todos": as duas medidas, cada uma com o seu rótulo, em duas linhas; nunca uma mediana só */
  function celula(c, col, cls){
    if (!col.fm || st.fmt !== 'todos') return '<td class="r' + cls + '">' + medida(c, col, st.fmt === 'shorts' ? 'shorts' : 'longos') + '</td>';
    var semS = c.shorts === null && !c.semVideos;
    return '<td class="r dois' + cls + '"><span class="fm"><span class="fl">longos</span>' + medida(c, col, 'longos') + '</span>' +
      '<span class="fm">' + (semS ? '<span class="nd">sem Shorts</span>' : '<span class="fl">Shorts</span>' + medida(c, col, 'shorts')) + '</span></td>';
  }
  /* o ⓘ do inscritos: a base do número, dentro da linha, e a dica sobe/desce e fica sempre acima do conteúdo (flut.js) */
  function baseInscritos(c){
    return c.own ? 'Inscritos de ' + c.nome + ': a contagem do seu próprio canal, lida em ' + D.lidoEm.slice(8) + '/' + D.lidoEm.slice(5, 7) + '.' :
      'Inscritos de ' + c.nome + ': contagem pública do YouTube, arredondada pelo próprio YouTube a três algarismos significativos, lida em ' + D.lidoEm.slice(8) + '/' + D.lidoEm.slice(5, 7) + '. Não é a contagem exata.';
  }
  function linha(c){
    var h = '<tr class="row' + (c.own ? ' own' : '') + '" id="row-' + c.id + '"' + (c.own ? ' tabindex="-1"' : '') + '><td class="p num">' + (c._pos == null ? '<span class="sr">sem posição</span>' : c._pos + 'º' + (c._emp ? '<span class="sr"> (empate)</span>' : '')) + '</td>' +
      '<th scope="row" class="c"><span class="ch"><span class="av" aria-hidden="true">' + ini(c) + '</span>' + nomeHtml(c) + marca(c) + '</span></th>';
    COLS.forEach(function(col){
      var cls = st.sort === col.k ? ' on' : '';
      if (col.k === 'inscritos') h += '<td class="r' + cls + '"><span class="insc"><span class="num">' + num(c.inscritos) + '</span><button type="button" class="ibtn" data-base="' + c.id + '" aria-expanded="false" aria-label="De onde vem o número de inscritos de ' + esc(c.nome) + '"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.6M8 5.1v.2"/></svg></button></span></td>';
      else h += celula(c, col, cls);
    });
    return h + '<td class="a">' + comparar(c, false) + '</td></tr>';
  }
  function tabela(com, sem){
    var col = COL[st.sort], body = com.map(linha).join('');
    if (sem.length) body += '<tr class="grp"><th scope="rowgroup" colspan="' + (COLS.length + 3) + '">Ainda sem medida para ordenar (' + sem.length + ')<small>sem ' + esc(emT(col)) + '; ficam no fim em qualquer direção</small></th></tr>' + sem.map(linha).join('');
    var head = '<thead><tr><th scope="col" class="p"><span class="sr">Posição</span></th><th scope="col">Canal</th>' + COLS.map(function(c){
      var on = st.sort === c.k;
      var un = on && st.fmt === 'todos' && c.fm ? 'ordenado pelos longos' : c.u(st.fmt);
      return '<th scope="col" class="r"' + (on ? ' aria-sort="' + (st.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '><button type="button" data-sort="' + c.k + '">' + c.t(st.fmt) + '<span class="arrow" aria-hidden="true">' + (on ? (st.dir === 'asc' ? '▲' : '▼') : '') + '</span></button><span class="unit' + (on && st.fmt === 'todos' && c.fm ? ' ord' : '') + '">' + un + '</span></th>';
    }).join('') + '<th scope="col" class="a">' + (st.own ? '<span class="unit">Com o meu canal</span>' : '') + '</th></tr></thead>';
    return '<div class="cn-tw"><table class="cn-t' + (st.fmt === 'todos' ? ' todos' : '') + '" aria-describedby="cnSub"><caption class="sr">Canais acompanhados, ordenados por ' + esc(emT(col)) + '</caption>' + head + '<tbody>' + body + '</tbody></table></div>';
  }
  /* ---------------------------------------------------------------- cartões */
  function ordinalF(n){ return n + 'ª'; }
  function cartao(c){
    var pos = c._pos == null ? '' : '<span class="cp num">' + c._pos + 'º</span>';
    var voce = !c.own ? '' : '<p class="voce">' + (c._pos != null ? 'Você está na ' + ordinalF(c._pos) + ' posição de ' + O.total + ' nesta ordenação' + (c._emp ? ', em empate' : '') + '.' : c.semVideos ? 'Sem vídeos: fora das posições por vídeo.' : (st.fmt === 'shorts' && c.shorts === null ? 'Sem Shorts: fora das posições de Shorts.' : 'Sem posição nesta ordenação: views por dia ainda não são medidas no seu canal.')) + '</p>';
    return '<li class="cc' + (c.own ? ' own' : '') + '" id="row-' + c.id + '"' + (c.own ? ' tabindex="-1"' : '') + '><div class="cch"><span class="av" aria-hidden="true">' + ini(c) + '</span><span class="cn">' + nomeHtml(c) + marca(c) + '</span>' + pos + '</div>' + voce +
      '<dl>' + COLS.map(function(col){
        var dd = !col.fm || st.fmt !== 'todos' ? medida(c, col, st.fmt === 'shorts' ? 'shorts' : 'longos') :
          '<span class="fm"><span class="fl">longos</span>' + medida(c, col, 'longos') + '</span><span class="fm">' + (c.shorts === null && !c.semVideos ? '<span class="nd">sem Shorts</span>' : '<span class="fl">Shorts</span>' + medida(c, col, 'shorts')) + '</span>';
        return '<div' + (st.sort === col.k ? ' class="on"' : '') + '><dt>' + col.t(st.fmt) + '</dt><dd>' + dd + '</dd></div>'; }).join('') + '</dl>' +
      (comparar(c, true) ? '<p class="ccf">' + comparar(c, true) + '</p>' : '') + '</li>';
  }
  function cartoes(com, sem){
    var col = COL[st.sort];
    return '<ul class="cn-cards" aria-label="Canais acompanhados, ordenados por ' + esc(emT(col)) + '">' + com.map(cartao).join('') +
      (sem.length ? '<li class="cdiv" role="presentation"><b>Ainda sem medida para ordenar (' + sem.length + ')</b><small>sem ' + esc(emT(col)) + '</small></li>' + sem.map(cartao).join('') : '') + '</ul>';
  }
  /* ---------------------------------------------------------------- bloco do topo: o canal próprio com a posição e os vizinhos */
  function frasePos(c, curta){
    var col = COL[st.sort], k = st.sort, fo = fOrd();
    if (valor(c, k, fo) == null) return c.semVideos ? 'Sem vídeos: fora das posições por vídeo.' : fo === 'shorts' && c.shorts === null ? 'Sem Shorts no seu canal: fora das posições de Shorts.' : 'Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve. Sem posição nesta ordenação.';
    var i = O.com.indexOf(c), ac = O.com[i - 1], ab = O.com[i + 1], viz = function(x){ return esc(x.nome) + ' (' + col.f(valor(x, k, fo)) + ')'; };
    var t = '<b>' + c._pos + 'º de ' + O.total + '</b> em ' + esc(emT(col)) + (c._emp ? ' (empate)' : '') + ', com <span class="num">' + col.f(valor(c, k, fo)) + '</span>.';
    if (curta) return t;
    return t + (ac ? ' Logo acima: ' + viz(ac) + '.' : ' É o primeiro da lista.') + (ab ? ' Logo abaixo: ' + viz(ab) + '.' : ' É o último da lista.');
  }
  function topo(){
    var P = proprios(), el = $('cnTop'); el.hidden = !P.length; if (!P.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<h2 id="cnTopH">' + (P.length > 1 ? 'Seus canais' : 'Seu canal') + '</h2><ul>' + P.map(function(c){
      /* rodada 8: canal sem vídeos não tem posição para mostrar; vira uma linha fina de uma frase só, sem botão grande */
      if (c.semVideos) return '<li class="fina"><p><span class="nm">' + esc(c.nome) + '</span>: sem vídeos, fora das posições por vídeo. <button type="button" class="lk" data-ir="' + c.id + '" aria-label="Ir até a linha de ' + esc(c.nome) + '">Ir até a linha</button></p></li>';
      return '<li><span class="av" aria-hidden="true">' + ini(c) + '</span><span class="tn">' + nomeHtml(c) + '<span class="own-seal">seu canal</span></span>' +
        '<p class="tp">' + frasePos(c, false) + '</p><span class="ta"><button type="button" class="btn" data-ir="' + c.id + '" aria-label="Ir até a linha de ' + esc(c.nome) + '">Ir até a linha</button>' +
        (href(c) ? '<a class="btn" href="' + href(c) + '" aria-label="Abrir meu canal: ' + esc(c.nome) + '">Abrir meu canal</a>' : '') + '</span></li>';
    }).join('') + '</ul>';
  }
  /* ---------------------------------------------------------------- render */
  function render(){
    FLUT.fechar(false);
    ordenar();
    var col = COL[st.sort], com = O.com.filter(passa), sem = O.sem.filter(passa), nC = concorrentes().length, achou = com.length + sem.length, q = st.q.trim();
    $('cnSub').textContent = 'Nicho ' + D.nicho + '. ' + nC + ' concorrentes' + (st.own ? ' e ' + (D.proprios.length > 1 ? 'os seus ' + D.proprios.length + ' canais' : 'o seu canal') : '') + ', por ' + emT(col) + (st.fmt === 'todos' ? ' (em “Todos”, a ordem é a dos longos)' : '') + ', ' + (st.dir === 'asc' ? 'do menor para o maior' : 'do maior para o menor') + '.';
    topo();
    $('cnRes').textContent = q ? (achou ? achou + (achou === 1 ? ' canal' : ' canais') + ' com “' + q + '”. As posições continuam as da lista inteira.' : '') : '';
    $('cnVer').innerHTML = [['tabela', 'Tabela', IC.tab], ['cartoes', 'Cartões', IC.card]].map(function(x){ return '<button type="button" data-ver="' + x[0] + '" aria-pressed="' + (st.ver === x[0]) + '">' + x[2] + x[1] + '</button>'; }).join('');
    $('cnFmt').innerHTML = [['todos', 'Todos'], ['longos', 'Longos'], ['shorts', 'Shorts']].map(function(x){ return '<button type="button" data-fmt="' + x[0] + '" aria-pressed="' + (st.fmt === x[0]) + '">' + x[1] + '</button>'; }).join('');
    var nf = $('cnFmtNota');
    nf.hidden = st.fmt === 'longos';
    nf.innerHTML = st.fmt === 'todos' ? 'Longos e Shorts lado a lado, sem mediana única (views de Short e de longo não se comparam); ordem pelos longos.'
      : st.fmt === 'shorts' ? 'Só Shorts; quem não publica Shorts fica no fim da lista.' : '';
    if (st.fmt !== 'longos') nf.innerHTML += ' <span class="fab">Mockup: Shorts dos concorrentes (menos Leo Khev) são de exemplo.</span>';
    $('cnSortW').hidden = st.ver !== 'cartoes';
    $('cnSort').innerHTML = COLS.map(function(c){ return '<option value="' + c.k + '"' + (st.sort === c.k ? ' selected' : '') + '>Ordenar por ' + c.em(fOrd()) + '</option>'; }).join('');
    if (document.activeElement !== $('cnQ')) $('cnQ').value = st.q;
    $('cnMiolo').innerHTML = !achou ? '<div class="empty"><p>Nenhum canal com “' + esc(q) + '”.</p><button type="button" class="btn" id="cnLimpa">Limpar busca</button></div>' : st.ver === 'cartoes' ? cartoes(com, sem) : tabela(com, sem);
    pe(); observar(); mock();
  }
  /* linha presa no pé: só quando NEM o bloco do topo NEM a linha do canal estão visíveis */
  function pe(){
    var pin = $('cnPin'), c = proprios()[0]; if (!c){ pin.innerHTML = ''; pin.hidden = true; return; }
    pin.innerHTML = '<span class="own-seal">seu canal</span><p>' + esc(c.nome) + ': ' + frasePos(c, true) + '</p><button type="button" class="lk" data-ir="' + c.id + '">Ir até a linha</button><button type="button" class="lk" data-topo>Voltar ao topo</button>';
  }
  var io = null, vis = { topo: true, linha: false };
  function observar(){
    if (io) io.disconnect(); var c = proprios()[0], pin = $('cnPin'); if (!c){ pin.hidden = true; return; }
    var r = $('row-' + c.id), t = $('cnTop');
    function aplica(){ pin.hidden = vis.topo || vis.linha; }
    io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.target === t) vis.topo = e.isIntersecting; else vis.linha = e.isIntersecting; }); aplica(); }, { threshold: 0.15 });
    vis.linha = false; io.observe(t); if (r) io.observe(r);
  }
  function anunciar(t){ var s = $('status'); s.textContent = ''; setTimeout(function(){ s.textContent = t; }, 30); }
  function ordenarPor(k, alterna){
    if (st.sort === k && alterna) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = 'desc'; }
    gravar(true); render(); var c = proprios()[0];
    anunciar('Ordenado por ' + emT(COL[k]) + ', ' + (st.dir === 'asc' ? 'crescente' : 'decrescente') + '. ' + (c ? (c._pos != null ? 'Seu canal: ' + c._pos + 'º de ' + O.total + '.' : 'Seu canal ainda sem medida nesta coluna.') : ''));
  }
  /* ⓘ do inscritos: uma dica por vez, na camada flutuante (flut.js); clicar de novo no mesmo fecha */
  var dicaB = null, donoB = null;
  function abrirBase(btn, c){
    if (donoB === btn){ FLUT.fechar(true); return; }
    dicaB = document.createElement('div'); dicaB.className = 'pop tip'; dicaB.id = 'tip'; dicaB.setAttribute('role', 'note');
    dicaB.innerHTML = '<h3>De onde vem o número</h3><p class="m" style="margin:0">' + esc(baseInscritos(c)) + '</p>';
    donoB = btn; FLUT.abrir(btn, dicaB, { pref: 'baixo', alinhar: 'fim', descreve: true, aoFechar: function(){ dicaB = null; donoB = null; } });
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-sort]');
    if (b){ ordenarPor(b.dataset.sort, true); var nb = document.querySelector('[data-sort="' + b.dataset.sort + '"]'); if (nb) nb.focus(); return; }
    if ((b = e.target.closest('[data-ir]'))){
      if (st.q && !passa(D.proprios.filter(function(c){ return c.id === b.dataset.ir; })[0])){ st.q = ''; $('cnQ').value = ''; gravar(false); render(); }
      var r = $('row-' + b.dataset.ir); if (!r) return;
      r.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); r.focus({ preventScroll: true }); return;
    }
    if (e.target.closest('[data-topo]')){ scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); $('h1').focus({ preventScroll: true }); return; }
    if ((b = e.target.closest('[data-fmt]'))){
      st.fmt = b.dataset.fmt; gravar(false); render(); $('cnFmt').querySelector('[aria-pressed="true"]').focus();
      anunciar('Formato: ' + ({ todos: 'Todos, longos e Shorts lado a lado, ordem pelos longos', longos: 'Longos', shorts: 'Shorts' })[st.fmt] + '. ' + O.total + ' canais com medida.'); return;
    }
    if ((b = e.target.closest('[data-base]'))){
      var cc = concorrentes().concat(proprios()).filter(function(x){ return x.id === b.dataset.base; })[0];
      if (cc) abrirBase(b, cc); return;
    }
    if ((b = e.target.closest('[data-ver]'))){ st.ver = b.dataset.ver; gravar(false); render(); $('cnVer').querySelector('[aria-pressed="true"]').focus(); anunciar('Vista em ' + (st.ver === 'cartoes' ? 'cartões' : 'tabela') + '.'); return; }
    if (e.target.closest('#cnLimpa')){ st.q = ''; $('cnQ').value = ''; gravar(false); render(); $('cnQ').focus(); return; }
    if ((b = e.target.closest('[data-n]'))){ st.n = +b.dataset.n; gravar(false); render(); return; }
    if ((b = e.target.closest('[data-own]'))){ st.own = b.dataset.own === '1'; gravar(false); render(); return; }
  });
  $('cnQ').addEventListener('input', function(){ st.q = this.value; gravar(false); render(); });
  $('cnQ').addEventListener('keydown', function(e){ if (e.key === 'Escape' && this.value){ e.preventDefault(); this.value = ''; st.q = ''; gravar(false); render(); } });
  $('cnSort').addEventListener('change', function(){ ordenarPor(this.value, false); $('cnSort').focus(); });
  addEventListener('popstate', function(){ ler(); render(); });
  function mock(){
    $('mkTam').innerHTML = [[13, '13 concorrentes (reais)'], [70, '70 concorrentes (57 fictícios)']].map(function(x){ return '<button type="button" data-n="' + x[0] + '" aria-pressed="' + (st.n === x[0]) + '">' + x[1] + '</button>'; }).join('');
    $('mkOwn').innerHTML = [['1', 'Com os canais próprios'], ['0', 'Sem canal próprio']].map(function(x){ return '<button type="button" data-own="' + x[0] + '" aria-pressed="' + ((st.own ? '1' : '0') === x[0]) + '">' + x[1] + '</button>'; }).join('');
  }
  ler(); render();
  window.__cn = { st: st, O: function(){ return O; } };
})();
