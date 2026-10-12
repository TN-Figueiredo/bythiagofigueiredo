/* c1-seletor.js: a caixa de combinação com busca dos dois lados da comparação (pedido do dono, 12/10). Funciona de verdade (teclado, filtro, grupos).
   ?estado=fechado|aberto|digitando|sem-resultado|teclado|outro-lado|sem-videos, ?tema=claro. Padrão: WAI-ARIA 1.2, combobox editável com listbox e aria-activedescendant. */
(function(){
  'use strict';
  var A = window.A4, esc = A.esc, q = A.q, C = window.CANAIS;
  var semAc = function(s){ return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  /* ---------------------------------------------------------------- os canais (13 + 57 de Viagem vêm do mockup aprovado; Entretenimento e sem nicho são inventados para mostrar os grupos) */
  var LISTA = [];
  C.proprios.forEach(function(c){ LISTA.push({ id: c.id, nome: c.nome, ins: c.inscritos, g: 0, own: true, semVideos: !!c.semVideos }); });
  C.canais.concat(C.ficticios).sort(function(a, b){ return b.inscritos - a.inscritos; }).forEach(function(c){ LISTA.push({ id: c.id, nome: c.nome, ins: c.inscritos, g: 1, ex: !!c.ficticio }); });
  [['Gaveta de Filmes', 880000], ['Cinema de Quarta', 410000], ['Resenha Rápida', 96000], ['Mesa de Jogos', 51000], ['Teatro de Bolso', 18400], ['Domingo de Série', 7200]].forEach(function(x, i){ LISTA.push({ id: 'ent' + i, nome: x[0], ins: x[1], g: 2, ex: true }); });
  [['Arquivo Aberto', 23000], ['Coleção de Mapas', 2400]].forEach(function(x, i){ LISTA.push({ id: 'sn' + i, nome: x[0], ins: x[1], g: 3, ex: true }); });
  var GRUPOS = [['Seus canais', null], ['Concorrentes de Viagem, do maior ao menor', 'Viagem'], ['Concorrentes de Entretenimento, do maior ao menor', 'Entretenimento'], ['Concorrentes sem nicho', null]];
  var NICHO = ['', 'Viagem', 'Entretenimento', ''];
  var estado = q.get('estado') || 'fechado';
  var sel = { A: 'proprio', B: 'vou-sem-volta' };
  var por = {}; LISTA.forEach(function(c){ por[c.id] = c; });
  var ini = function(n){ var p = n.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean); return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : p[0].slice(0, 2); };
  var cor = { A: 'var(--lado-n)', B: 'var(--lado-b)' };
  var N_TOTAL = LISTA.length;

  /* Popover API quando existe (camada do navegador, por cima de tudo); sem ela, a mesma lista em position:fixed, com o cartão do campo elevado acima do vizinho */
  var TEM_POP = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype && (function(){ try { document.createElement('div').matches(':popover-open'); return true; } catch (e) { return false; } })();
  if (!TEM_POP) document.documentElement.classList.add('sem-popover');

  function Combo(lado){
    var id = 'cb' + lado, outro = lado === 'A' ? 'B' : 'A', aberto = false, ativo = null, texto = null, ordem = [];
    var host = document.getElementById(id);
    host.innerHTML = '<div class="cb-lb"><span class="cb-lado' + (lado === 'B' ? ' b' : '') + '" aria-hidden="true">' + lado + '</span><span id="' + id + 'L">Lado ' + lado + '</span></div><div class="cb-in"><input id="' + id + 'I" type="text" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + 'Lb" aria-label="Canal do lado ' + lado + '" aria-describedby="' + id + 'D" autocomplete="off" spellcheck="false" placeholder="Buscar canal pelo nome">' +
      '<button type="button" tabindex="-1" aria-label="Mostrar todos os canais" id="' + id + 'B">' + A.CHEV + '</button></div><p class="cb-cnt" id="' + id + 'D">Digite parte do nome. ' + N_TOTAL + ' canais.</p>' +
      '<div class="cb-lista flut"' + (TEM_POP ? ' popover="manual"' : '') + ' id="' + id + 'Lb" role="listbox" aria-label="Canais para o lado ' + lado + '" hidden></div><p class="sr" role="status" aria-live="polite" id="' + id + 'S"></p>';
    var inp = host.querySelector('input'), lista = host.querySelector('.cb-lista'), st = host.querySelector('[role=status]'), cnt = host.querySelector('.cb-cnt');
    function atual(){ return por[sel[lado]]; }
    function motivo(c){ return c.id === sel[outro] ? 'é o canal do lado ' + outro : null; }
    function marca(nome, t){ if (!t) return esc(nome); var i = semAc(nome).indexOf(semAc(t)); return i < 0 ? esc(nome) : esc(nome.slice(0, i)) + '<mark>' + esc(nome.slice(i, i + t.length)) + '</mark>' + esc(nome.slice(i + t.length)); }
    function desenha(){
      var t = texto && texto.trim() ? texto.trim() : '', k = semAc(t), n = 0; ordem = [];
      var html = GRUPOS.map(function(g, gi){
        var itens = LISTA.filter(function(c){ return c.g === gi && (!k || semAc(c.nome).indexOf(k) >= 0); }); if (!itens.length) return '';
        n += itens.length;
        return '<div role="group" aria-labelledby="' + id + 'G' + gi + '"><div class="cb-gh" id="' + id + 'G' + gi + '">' + esc(g[0]) + (t ? ' <span class="mut">(' + itens.length + ')</span>' : '') + '</div>' + itens.map(function(c){
          var m = motivo(c), oid = id + 'O' + c.id; ordem.push(c.id);
          return '<div class="cb-o" role="option" id="' + oid + '" data-id="' + esc(c.id) + '" aria-selected="' + (c.id === sel[lado]) + '"' + (m ? ' aria-disabled="true"' : '') + (c.id === ativo ? ' data-ativo' : '') + '><span class="av" aria-hidden="true">' + esc(ini(c.nome)) + '</span><span class="nm1">' + marca(c.nome, t) + (c.ex ? ' <span class="ex" style="margin-left:4px">exemplo</span>' : '') + '</span><span class="tg">' + (c.id === sel[lado] ? '<span class="ok" aria-hidden="true">✓</span> atual' : m ? 'indisponível' : c.semVideos ? '<span class="chip">sem vídeos</span>' : c.own ? '<span class="chip own">seu canal</span>' : '') + '</span><span class="sb">' + (NICHO[gi] ? NICHO[gi] + ' · ' : '') + A.mil(c.ins) + ' inscritos' + (m ? '. Indisponível: ' + m + '.' : c.semVideos ? '. Sem vídeos: a comparação usa só os inscritos.' : '') + '</span></div>'; }).join('') + '</div>';
      }).join('');
      lista.innerHTML = html || '<div class="cb-vazio"><p><b>Nenhum canal com “' + esc(t) + '”.</b></p><p class="m">Confira a grafia ou apague parte do texto. A busca olha só o nome do canal, sem acento e sem diferença de maiúscula.</p></div>';
      cnt.textContent = t ? (n ? n + (n === 1 ? ' canal encontrado.' : ' canais encontrados.') : 'Nenhum canal encontrado.') : 'Digite parte do nome. ' + N_TOTAL + ' canais.';
      if (aberto) st.textContent = t ? (n ? n + (n === 1 ? ' canal encontrado' : ' canais encontrados') : 'Nenhum canal encontrado') : '';
      if (ativo) { inp.setAttribute('aria-activedescendant', id + 'O' + ativo); } else inp.removeAttribute('aria-activedescendant');
      lista.querySelectorAll('.cb-o').forEach(function(o){ o.addEventListener('pointerdown', function(e){ e.preventDefault(); }); o.addEventListener('click', function(){ escolher(o.getAttribute('data-id')); }); o.addEventListener('pointermove', function(){ if (ativo !== o.getAttribute('data-id')) { ativo = o.getAttribute('data-id'); marcaAtivo(false); } }); });
    }
    /* a lista vive na camada do navegador (Popover API), por cima de tudo, e é posicionada sob o campo */
    function posicionar(){
      if (!aberto) return;
      var r = host.querySelector('.cb-in').getBoundingClientRect(), c = cnt.getBoundingClientRect(), vh = window.innerHeight, top = c.bottom + 6, abaixo = vh - top - 12, acima = r.top - 6 - 12;
      lista.style.setProperty('--x', r.left + 'px'); lista.style.setProperty('--w', r.width + 'px');
      /* a lista nunca passa da janela: com menos de 180 px embaixo e mais espaço em cima, abre para cima; senão encolhe até caber */
      var sobe = abaixo < 180 && acima > abaixo;
      lista.classList.toggle('acima', sobe);
      if (sobe) { lista.style.setProperty('--b', (vh - r.top + 6) + 'px'); lista.style.setProperty('--mh', Math.max(96, acima) + 'px'); }
      else { lista.style.setProperty('--y', top + 'px'); lista.style.setProperty('--mh', Math.max(96, abaixo) + 'px'); }
    }
    function emPopover(){ if (!TEM_POP) return false; try { return lista.matches(':popover-open'); } catch (e) { return false; } }
    function mostra(){ if (TEM_POP) { if (!emPopover()) lista.showPopover(); } else { var l = host.closest('.lado'); if (l) l.classList.add('cb-aberto'); } }
    function esconde(){ if (TEM_POP) { if (emPopover()) lista.hidePopover(); } else { var l = host.closest('.lado'); if (l) l.classList.remove('cb-aberto'); } }
    /* ao abrir, traz o campo para perto do topo se faltar espaço embaixo (a página rola; a lista acompanha) */
    function traz(){
      var c = cnt.getBoundingClientRect(), falta = 220 - (window.innerHeight - c.bottom - 18);
      if (falta > 0) window.scrollBy(0, Math.min(falta, Math.max(0, c.top - 80)));
    }
    window.addEventListener('scroll', posicionar, true); window.addEventListener('resize', posicionar);
    function marcaAtivo(rolar){
      lista.querySelectorAll('.cb-o').forEach(function(o){ if (o.getAttribute('data-id') === ativo) { o.setAttribute('data-ativo', ''); if (rolar) o.scrollIntoView({ block: 'nearest' }); } else o.removeAttribute('data-ativo'); });
      if (ativo) { inp.setAttribute('aria-activedescendant', id + 'O' + ativo); var c = por[ativo], m = motivo(c); st.textContent = c.nome + (c.ex ? ', exemplo' : '') + (m ? ', indisponível: ' + m : c.id === sel[lado] ? ', canal atual' : '') + ', ' + (ordem.indexOf(ativo) + 1) + ' de ' + ordem.length; } else inp.removeAttribute('aria-activedescendant');
    }
    function abrir(texto0, ativo0){
      aberto = true; if (texto0 !== undefined) texto = texto0; ativo = ativo0 !== undefined ? ativo0 : (texto && texto.trim() ? null : sel[lado]);
      desenha(); lista.hidden = false; mostra(); traz(); posicionar(); inp.setAttribute('aria-expanded', 'true');
      if (ativo == null && texto && texto.trim() && ordem.length) ativo = ordem.filter(function(i){ return !motivo(por[i]); })[0] || ordem[0];
      marcaAtivo(true);
    }
    function fechar(restaurar){
      aberto = false; esconde(); lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); ativo = null; texto = null;
      if (restaurar !== false) inp.value = atual().nome; cnt.textContent = 'Digite parte do nome. ' + N_TOTAL + ' canais.';
    }
    function escolher(cid){
      var c = por[cid], m = motivo(c); if (m) { st.textContent = c.nome + ' indisponível: ' + m + '. Escolha outro canal.'; return; }
      sel[lado] = cid; fechar(); st.textContent = 'Lado ' + lado + ': ' + c.nome + ' escolhido'; pintaCartao(lado); window.dispatchEvent(new Event('cb-troca'));
    }
    function passo(d){
      var i = ordem.indexOf(ativo); i = i < 0 ? (d > 0 ? 0 : ordem.length - 1) : (i + d + ordem.length) % ordem.length; ativo = ordem[i]; marcaAtivo(true);
    }
    inp.addEventListener('focus', function(){ if (!aberto) { inp.select(); } });
    inp.addEventListener('click', function(){ if (!aberto) { abrir(''); inp.select(); } });
    inp.addEventListener('input', function(){ abrir(inp.value); });
    host.querySelector('button').addEventListener('click', function(){ if (aberto) fechar(); else { abrir(''); inp.focus(); } });
    inp.addEventListener('blur', function(){ setTimeout(function(){ if (aberto && !host.contains(document.activeElement)) fechar(); }, 0); });
    inp.addEventListener('keydown', function(e){
      var k = e.key;
      if (k === 'ArrowDown') { e.preventDefault(); if (!aberto) abrir(e.altKey ? '' : '', sel[lado]); else if (!e.altKey) passo(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); if (!aberto) abrir('', sel[lado]); else passo(-1); }
      else if (k === 'Enter') { if (aberto) { e.preventDefault(); if (ativo) escolher(ativo); } }
      else if (k === 'Escape') { if (aberto) { e.preventDefault(); fechar(); } else { inp.value = atual().nome; } }
      else if (k === 'Tab') { if (aberto) fechar(); }
      else if (k === 'PageDown' && aberto) { e.preventDefault(); for (var i = 0; i < 5; i++) passo(1); }
      else if (k === 'PageUp' && aberto) { e.preventDefault(); for (var j = 0; j < 5; j++) passo(-1); }
    });
    inp.value = atual().nome;
    return { abrir: abrir, fechar: fechar, inp: inp, passo: passo };
  }

  function cartao(lado){ var c = por[sel[lado]]; return '<div class="id"><span class="av" aria-hidden="true">' + esc(ini(c.nome)) + '</span><div><h2>' + esc(c.nome) + '</h2><p class="m">' + (c.own ? '<span class="chip own">seu canal</span>' : '<span>' + (NICHO[c.g] || 'sem nicho') + '</span>') + '<span><b class="num">' + A.mil(c.ins) + '</b> inscritos</span></p></div></div>'; }
  function pintaCartao(l){ document.getElementById('id' + l).innerHTML = cartao(l); }
  function lado(l){ return '<section class="lado" style="--c:' + cor[l] + '" aria-label="Lado ' + l + '"><div class="cb" id="cb' + l + '" style="--c:' + cor[l] + '"></div><div id="id' + l + '">' + cartao(l) + '</div></section>'; }

  var ES = [['fechado', 'Fechado'], ['aberto', 'Aberto (lado A)'], ['digitando', 'Digitando “vida”'], ['teclado', 'Com teclado (setas)'], ['sem-resultado', 'Sem resultado'], ['outro-lado', 'Lado B: o outro lado indisponível'], ['sem-videos', 'Lado B: canal sem vídeos']];
  A.moldura({ titulo: 'Seletor de canal com busca', barra: { aberta: false, linhas: [{ rotulo: 'Estado', itens: ES.map(function(e){ return { t: e[1], href: A.href({ estado: e[0] }), atual: estado === e[0] }; }) }, A.tema()],
      nota: 'Funciona de verdade: clique, digite, use as setas, Enter e Esc. Dos 77 canais, 13 concorrentes de Viagem e os 2 seus são reais; os 57 fictícios de Viagem (mockup aprovado) e os 8 de Entretenimento e “sem nicho” são inventados e levam a palavra “exemplo”. Em 390 px, abra a página numa janela estreita.' },
    corpo: A.migalha([['Canais', 'index.html'], ['Comparar']]) + '<div class="lados lc" style="align-items:start">' + lado('A') + lado('B') + '</div>',
    fora: '<section class="reg" aria-labelledby="hTe"><h2 id="hTe">Teclado</h2><dl><dt><kbd>↓</kbd> <kbd>↑</kbd></dt><dd>Abre a lista e anda entre os canais, passando pelos grupos sem parar nos títulos. No fim da lista volta ao começo.</dd><dt><kbd>Enter</kbd></dt><dd>Escolhe o canal destacado. Num canal indisponível não faz nada e a tela diz por quê.</dd><dt><kbd>Esc</kbd></dt><dd>Fecha a lista e devolve o nome do canal atual no campo.</dd><dt><kbd>Tab</kbd></dt><dd>Sai do campo sem trocar o canal.</dd><dt>Digitar</dt><dd>Filtra pelo nome, sem acento e sem diferença de maiúscula. Os grupos e a ordem continuam; grupo sem canal some.</dd></dl></section>' });
  var cA = Combo('A'), cB = Combo('B');
  var mapa = { aberto: ['A', ''], digitando: ['A', 'vida'], teclado: ['A', ''], 'sem-resultado': ['A', 'xyzw'], 'outro-lado': ['B', ''], 'sem-videos': ['B', 'thiago'] };
  if (mapa[estado]) {
    var cb = mapa[estado][0] === 'A' ? cA : cB;
    cb.abrir(mapa[estado][1], estado === 'outro-lado' ? 'proprio' : undefined);
    if (mapa[estado][1]) cb.inp.value = mapa[estado][1];
    if (estado === 'teclado') { cb.inp.focus(); cb.passo(1); cb.passo(1); cb.passo(1); }
    if (estado === 'outro-lado' || estado === 'aberto') cb.inp.focus();
    if (estado === 'digitando' || estado === 'sem-resultado' || estado === 'sem-videos') cb.inp.focus();
  }
})();
