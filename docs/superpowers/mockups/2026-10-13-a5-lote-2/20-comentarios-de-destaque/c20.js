/* c20.js: mockup 20, Comentários de destaque do vídeo de concorrente (spec 02, 4.6.9; seção do histórico do vídeo, mockup 13) e M11 na página do canal (mockup 15).
   ?caso=tipico|extremo|completo|idade1|zero|desligados|naocoletado|antes|novo|carregando|erro|leitura|leitura-privado   (página do vídeo)
   ?caso=canal|canal-fecha|canal-nm   (página do canal)   ?tema=claro   ?idade=1|7|30 (aba aberta)
   Tudo é exemplo (canais, pessoas, textos, números). Hoje = 13/10/2026. Os cabeçalhos do 13 e do 15 aparecem só como moldura: são desenhados em outra pasta.
   Regra do dono que guia o desenho: cada motivo e cada estado tem cor E símbolo próprios; "zero medido" (caixa vazada com 0), "não medido" (hachura rosa) e "ainda não existe" (pontilhado) nunca se confundem. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, D = window.C20, esc = A.esc, q = A.q;
  var caso = q.get('caso') || 'tipico';
  var NOCANAL = caso.indexOf('canal') === 0, TODOS = !!q.get('todos') || caso === 'extremo';

  /* ---------------------------------------------------------------- ícones de traço (16 px, currentColor) */
  function svg(c, cls){ return '<svg class="i ' + (cls || '') + '" viewBox="0 0 16 16" aria-hidden="true">' + c + '</svg>'; }
  var I = {
    like: svg('<path d="M4.6 7v6.4H2.4V7ZM4.6 7.2 7.6 2.4c1.3 0 2 .9 1.7 2.2L8.9 6.4h3.4c.9 0 1.5.8 1.3 1.7l-.9 3.9c-.2.8-.8 1.4-1.6 1.4H4.6"/>'),
    mic: svg('<rect x="6" y="1.8" width="4" height="7" rx="2"/><path d="M3.8 7.8a4.2 4.2 0 0 0 8.4 0M8 12v2.4M5.6 14.4h4.8"/>'),
    eye: svg('<path d="M1.4 8S4 3.6 8 3.6 14.6 8 14.6 8 12 12.4 8 12.4 1.4 8 1.4 8Z"/><circle cx="8" cy="8" r="2"/>'),
    alvo: svg('<circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="2.1"/>'),
    pessoa: svg('<circle cx="8" cy="5.6" r="2.6"/><path d="M2.8 13.6c.6-2.6 2.6-4 5.2-4s4.6 1.4 5.2 4"/>'),
    balaoOff: svg('<path d="M2.4 3.4h11.2v7H8.6L5.4 13v-2.6H2.4Z"/><path d="M1.6 1.6l12.8 12.8"/>'),
    reply: svg('<path d="M6.6 3 2.6 7l4 4M2.9 7H10a3.5 3.5 0 0 1 3.5 3.5V13"/>'),
    lock: svg('<rect x="3.4" y="7" width="9.2" height="6.6" rx="1.6"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/>'),
    linkOff: svg('<path d="M6.6 9.4l2.8-2.8M5 7.6 3.8 8.8a2.2 2.2 0 0 0 3.1 3.1L8 10.8M11 8.4l1.2-1.2a2.2 2.2 0 0 0-3.1-3.1L8 5.2M1.8 1.8l12.4 12.4"/>'),
    ajuda: svg('<circle cx="8" cy="8" r="6.2"/><path d="M6.1 6.2a1.9 1.9 0 1 1 2.7 1.8c-.5.3-.8.7-.8 1.3M8 11.5v.1"/>'),
    mais: svg('<circle cx="8" cy="8" r="6.2"/><path d="M5.2 8h5.6M8 5.2v5.6"/>'),
    menos: svg('<circle cx="8" cy="8" r="6.2"/><path d="M5.2 8h5.6"/>'),
    cal: svg('<rect x="2" y="3.2" width="12" height="10.6" rx="1.8"/><path d="M2 6.6h12M5.2 2v2.4M10.8 2v2.4"/>'),
    relogioAviso: svg('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.2 1.4"/>'),
    chevB: svg('<path d="M3.5 6 8 10.5 12.5 6"/>')
  };
  /* os quatro motivos: cor (token), símbolo e palavras. Estáveis em toda tela. */
  var G = {
    c: { ic: I.like, um: 'Mais curtido', leg: 'mais curtidos' },
    k: { ic: I.mic, um: 'Com o criador', leg: 'com o criador' },
    a: { ic: I.eye, um: 'Canal que você acompanha', leg: 'de canal que você acompanha' },
    g: { ic: I.alvo, um: 'Canal grande', leg: 'de canal grande' }
  };
  var ORD = ['c', 'k', 'a', 'g'];
  var TAM = ['', 'de 100 mil a 1 milhão de inscritos', 'de 1 a 10 milhões de inscritos', 'mais de 10 milhões de inscritos'];
  var RAZ = ['', 'de 10 a 100 vezes este canal', 'de 100 a 1.000 vezes este canal', 'mais de 1.000 vezes este canal'];

  /* ---------------------------------------------------------------- o caso: vídeo, conjunto, estado de cada idade, quem vê */
  var base = { v: D.VIDEO, total: 100, set: D.tipico, saiu: D.saiuTipico, idades: { 1: 'ok', 7: 'ok', 30: 'fecha' }, leitor: 'edita', ocultos: 1 };
  var CASOS = {
    tipico: {},
    extremo: { set: D.extremo, ocultos: 0 },
    completo: { v: D.VIDEO_PEQUENO, total: 37, completo: true, set: D.completo, saiu: D.saiuCompleto, ocultos: 0 },
    idade1: { idade: 1 },
    zero: { v: D.VIDEO_ZERO, idades: { 1: 'zero', 7: 'zero', 30: 'fecha' }, set: [], saiu: [] },
    desligados: { v: Object.assign({}, D.VIDEO, { com: null }), idades: { 1: 'desligados', 7: 'desligados', 30: 'fecha' }, set: [], saiu: [] },
    naocoletado: { idades: { 1: 'tarde', 7: 'falhou', 30: 'fecha' }, set: [], saiu: [] },
    antes: { v: D.VIDEO_ANTES, idades: { 1: 'antes', 7: 'antes', 30: 'antes' }, set: [], saiu: [] },
    novo: { v: D.VIDEO_NOVO, total: 92, completo: true, idades: { 1: 'ok', 7: 'fecha', 30: 'fecha' }, set: D.novo, saiu: [], idade: 1, ocultos: 0 },
    carregando: {},
    erro: {},
    leitura: { leitor: 'sem' },
    'leitura-privado': { leitor: 'privado', set: D.extremo, ocultos: 0 }
  };
  var C = {}; Object.keys(base).forEach(function(k){ C[k] = base[k]; }); var ov = CASOS[caso] || {}; Object.keys(ov).forEach(function(k){ C[k] = ov[k]; });
  var PUB = C.v.pub, IDADE_HOJE = A.dias(PUB, D.HOJE);
  function marcoData(n){ return A.dm(A.addDias(PUB, n)); }
    var idade = Number(q.get('idade')) || C.idade || (C.idades[7] === 'fecha' || C.idades[7] == null ? 1 : 7);
  if (!C.idades[idade] || C.idades[idade] === 'fecha') idade = C.idades[7] !== 'fecha' ? 7 : 1;
  var tem = function(n){ return n != null; };

  /* ---------------------------------------------------------------- pequenas peças */
  function mil(x){ return x == null ? '' : A.mil(x); }
  function curt(x){ return A.mil(x) + (x === 1 ? ' curtida' : ' curtidas'); }
  function isoDm(dm){ return '2026-' + dm.slice(3, 5) + '-' + dm.slice(0, 2); }
  /* total de comentários que o vídeo tinha no dia do retrato (nunca digitado): o de hoje menos o que foi comentado depois do retrato (os cartões com data posterior, mais as respostas deles, mais C.v.fora).
     Só vale para "todos os comentários do vídeo"; nos outros a amostra é sempre os 100 primeiros que o YouTube mostra. */
  function totalDia(k){
    if (!C.completo) return C.total;
    var corte = A.addDias(PUB, k), t = C.total - ((C.v.fora && C.v.fora[k]) || 0);
    C.set.forEach(function(c){ if (isoDm(c.pub) > corte) t -= 1 + c.rep; });
    return t;
  }
  /* "identidade guardada até": 28 dias depois do primeiro retrato em que o comentário foi guardado (1 dia: pub+1; 7 dias: pub+7). Nunca digitada. */
  function ateDe(c){
    var k = c.l ? c.l.findIndex(function(x){ return x != null; }) : -1;
    return k < 0 ? (c.au && c.au.ate) || '' : A.dm(A.addDias(PUB, [1, 7, 30][k] + 28));
  }
  function zbox(t){ return '<span class="cd-z" role="img" aria-label="zero medido">' + (t == null ? '0' : t) + '</span>'; }
  function nmTag(t){ return '<span class="nm cd-nmt">' + esc(t) + '</span>'; }
  function casa(g, i, total, c, comLink){
    var lab = 'Comentário ' + (i + 1) + ' de ' + total + ', ' + G[g].um.toLowerCase() + (c && c.l[idade === 1 ? 0 : 1] != null ? ', ' + curt(c.l[idade === 1 ? 0 : 1]) : '');
    return comLink ? '<li><a class="cd-casa g-' + g + '" href="#c-' + (c ? c.id : 'x') + '" aria-label="' + esc(lab) + '">' + G[g].ic + '</a></li>' : '<li><span class="cd-casa g-' + g + '" role="img" aria-label="' + esc(G[g].um) + '">' + G[g].ic + '</span></li>';
  }
  function escada(n, rot, tipo){
    var h = [5, 9, 13], r = '';
    for (var k = 0; k < 3; k++) r += '<rect x="' + (1 + k * 6) + '" y="' + (15 - h[k]) + '" width="4.4" height="' + h[k] + '" rx="1" class="' + (k < n ? 'on' : 'off') + '"/>';
    return '<svg class="cd-esc-s" viewBox="0 0 20 16" width="20" height="16" role="img" aria-label="' + esc(rot) + ', degrau ' + n + ' de 3">' + r + '</svg>';
  }
  function baseBloco(au){
    var t = escada(au.tam, TAM[au.tam]) + '<span>' + TAM[au.tam] + '</span>';
    var r = au.razao ? escada(au.razao, RAZ[au.razao]) + '<span>' + RAZ[au.razao] + '</span>' : '<span class="nm cd-nmt">razão não medida</span><span class="cd-dim">os inscritos do canal do vídeo estão ocultos</span>';
    return '<div class="cd-base"><span class="cd-bi">' + t + '</span><span class="cd-bi">' + r + '</span>' + A.ibtn('infoDest', 'Como o canal grande é definido e o que a regra não vê', true) + '</div>';
  }
  function avatar(nome, tipo){
    var ini = esc((nome || '?').trim().charAt(0).toUpperCase());
    if (tipo === 'foto') return '<span class="cd-av foto" style="background:' + L.cor(nome) + '" aria-hidden="true">' + I.pessoa + '</span>';
    if (tipo === 'esp') return '<span class="cd-av esp" aria-hidden="true">' + I.pessoa + '</span>';
    if (tipo === 'canal') return '<span class="cd-av canal" style="background:' + L.cor(nome + ' canal') + '" aria-hidden="true">' + ini + '</span>';
    return '<span class="cd-av ini" aria-hidden="true">' + ini + '</span>';
  }
  /* o autor, nos quatro estados: com identidade (guardada até dd/mm), foto que não carrega (vira a inicial), um espectador, e o canal grande sem nome */
  function autor(c, leitor){
    var a = c.au, h;
    if (a.t === 'criador') h = avatar('Leo', 'canal') + '<span class="cd-an"><b>Leo</b> <span class="chip cd-chk">' + I.mic + 'criador</span></span>';
    else if (a.t === 'acomp') h = avatar(a.n, 'canal') + '<span class="cd-an"><b>' + esc(a.n) + '</b><span class="cd-dim">canal do seu cadastro; o nome fica</span></span>';
    else if (a.t === 'grande' && leitor !== 'edita') h = '<span class="cd-av gr" aria-hidden="true">' + I.alvo + '</span><span class="cd-an"><b>Um canal com mais de 10 milhões de inscritos comentou</b></span>';
    else if (a.t === 'ident' && leitor !== 'edita') h = avatar('', 'esp') + '<span class="cd-an"><b>Um espectador</b></span>';
    else h = avatar(a.n, a.foto === 'quebrada' ? 'ini' : 'foto') + '<span class="cd-an"><b>' + esc(a.n) + '</b><span class="cd-dim">identidade guardada até ' + ateDe(c) + '</span></span>';
    var b = a.t === 'grande' ? baseBloco(a) : '';
    return '<div class="cd-au">' + h + '</div>' + b;
  }
  function cellIdade(c, k, sel, max){
    var v = c.l[k], dias = [1, 7, 30][k], rot = dias + (k === 0 ? ' dia' : ' dias'), isSel = dias === sel, body;
    if (C.idades[dias] === 'fecha' && v == null) body = '<span class="cd-fc">' + I.cal + 'fecha em ' + marcoData(dias) + '</span>';
    else if (v == null) body = '<span class="cd-fora nm">fora dos 12</span>';
    else body = '<b class="num">' + mil(v) + '</b><i class="cd-bar" aria-hidden="true"><u style="width:' + Math.max(3, Math.round(v / max * 100)) + '%"></u></i>';
    return '<div class="cd-i' + (isSel ? ' sel' : '') + '"><dt>' + rot + '</dt><dd>' + body + '</dd></div>';
  }
  function resposta(c, leitor){
    if (c.resp === 'proprio') return '';
    if (leitor === 'sem') return c.resp === 'sim' ? '<p class="cd-re sim res">' + I.reply + '<span>O criador respondeu. O texto da resposta é reservado.</span></p>' : '';
    if (c.resp === 'sim') return '<div class="cd-re sim">' + I.reply + '<div class="cd-rb"><p class="cd-rh">' + avatar('Leo', 'canal').replace('cd-av', 'cd-av mini') + '<b>Leo</b> <span class="chip cd-chk">' + I.mic + 'criador</span><span class="cd-dim">respondeu</span></p><p class="cd-rt" dir="auto">' + esc(c.re) + '</p></div></div>';
    var resp = c.resp === 'ns' && c.rep <= 5 ? 'nao' : c.resp; /* o YouTube mostra até 5 respostas: com 5 ou menos ele mostrou todas, então é "não vimos", nunca "não sabemos" */
    if (resp === 'nao') return '<p class="cd-re nao">' + zbox() + '<span><b>Não vimos resposta do criador.</b> ' + (c.rep === 1 ? 'Conferimos a única resposta que o YouTube mostrou e ela não é dele.' : 'Conferimos as ' + c.rep + ' respostas que o YouTube mostrou e nenhuma é dele.') + '</span></p>';
    if (resp === 'ns') return '<p class="cd-re ns">' + I.ajuda + '<span><b>Não sabemos se o criador respondeu.</b> O YouTube mostrou só 5 das ' + c.rep + ' respostas e nenhuma é dele.</span></p>';
    return '';
  }
  function texto(c, id){
    var longo = c.t.length > 230, tot = c.longo;
    var t = '<div class="cd-tx" id="tx-' + id + '" dir="auto"><div class="cd-txi' + (longo ? ' cl' : '') + '">' + esc(c.t) + '</div></div>';
    var ex = '';
    if (longo) ex = '<p class="cd-txf"><button type="button" class="btn cd-vt" data-vt="tx-' + id + '" aria-expanded="false" aria-controls="tx-' + id + '">Ver tudo</button>' + (tot ? '<span class="cd-corte" title="O texto guardado tem no máximo 2.000 caracteres">' + I.mais.replace('<circle cx="8" cy="8" r="6.2"/><path d="M5.2 8h5.6M8 5.2v5.6"/>', '<path d="M3 4.5h10M3 8h10M3 11.5h5.5"/>') + 'cortado aos 2.000 caracteres</span>' : '') + '</p>';
    if (/https?:|www\./.test(c.t)) ex += '<p class="cd-ad">' + I.linkOff + '<span>Este comentário tem um endereço. Aqui ele é só texto, não abre.</span></p>';
    return t + ex;
  }
  function pastilhaSaiu(c){
    if (!c.saiu) return '';
    return '<p class="cd-saiu">' + L.IC.comentario + '<span><b>Não veio mais do YouTube desde ' + (c.saiu === A.dm(D.HOJE) ? 'hoje (' + c.saiu + ')' : c.saiu) + '.</b> O YouTube não diz por quê.</span><a class="btn" href="../../2026-10-13-a5-lote-1/e-sairam-do-youtube.html?caso=confirmar-comentarios">Ver na fila “Saíram do YouTube”</a></p>';
  }
  function card(c, i, total, max, leitor, ocultoIdx){
    var g = c.g, n = i + 1;
    var moti = '<span class="cd-mot g-' + g + '">' + G[g].ic + '<span>' + G[g].um + '</span></span>';
    var mv = (idade === 7 && c.novo) ? '<span class="cd-mv">' + I.mais + '<span>entrou nos 12 no dia 7</span></span>' : '';
    var meta = '<p class="cd-meta">Publicado em ' + c.pub + ' · ' + (c.rep === 0 ? zbox() + ' respostas' : A.n(c.rep) + (c.rep === 1 ? ' resposta' : ' respostas')) + '</p>';
    var corpo;
    if (leitor === 'sem') corpo = '<div class="cd-res">' + I.lock + '<span><b>Texto reservado.</b> Há um comentário aqui que você não vê.</span></div>';
    else corpo = texto(c, c.id);
    return '<article class="cd-it g-' + g + '" id="c-' + c.id + '" aria-labelledby="cm-' + c.id + '"' + (ocultoIdx ? ' hidden data-extra="1"' : '') + '>' +
      '<header class="cd-hd" id="cm-' + c.id + '"><span class="cd-n num">' + n + ' de ' + total + '</span>' + moti + mv + '</header>' +
      '<div class="cd-bd"><div class="cd-bl">' + (leitor === 'sem' && c.au.t !== 'criador' && c.au.t !== 'acomp' ? '<div class="cd-au">' + avatar('', 'esp') + '<span class="cd-an"><b>Autor reservado</b></span></div>' : autor(c, leitor)) + corpo + pastilhaSaiu(c) + meta + resposta(c, leitor) + '</div>' +
      '<dl class="cd-ida" aria-label="Curtidas deste comentário nas três idades">' + [0, 1, 2].map(function(k){ return cellIdade(c, k, idade, max); }).join('') + '</dl></div></article>';
  }
  /* ---------------------------------------------------------------- a lista de uma idade */
  function listaDaIdade(){
    var set = C.set.slice(), col = idade === 1 ? 0 : 1;
    var lista = set.filter(function(c){ return tem(c.l[col]); });
    if (idade === 1) (C.saiu || []).forEach(function(s, k){ lista.push({ id: 's' + k, g: 'c', t: s.t, l: [s.l1, null, null], rep: 0, resp: null, au: { t: 'ident', n: s.au }, pub: '07/10', saiuDia7: true }); });
    lista.sort(function(a, b){ return b.l[col] - a.l[col]; });
    return lista;
  }
  function contar(lista){ var n = { c: 0, k: 0, a: 0, g: 0 }; lista.forEach(function(c){ n[c.g]++; }); return n; }

  /* ---------------------------------------------------------------- estados sem lista */
  function boxEstado(k){
    if (k === 'zero') return '<span class="cd-eb zero"><b class="num">0</b></span>';
    if (k === 'fecha') return '<span class="cd-eb fecha">' + I.cal + '</span>';
    var ic = { desligados: I.balaoOff, tarde: I.relogioAviso, falhou: I.relogioAviso, antes: I.cal }[k];
    return '<span class="cd-eb nm-h2">' + ic + '</span>';
  }
  var EST = {
    zero: function(n){ return { frase: 'Com ' + n + (n === 1 ? ' dia' : ' dias') + ', <b>nenhum comentário</b>. O YouTube informou 0 comentários neste vídeo em ' + marcoData(n) + '.', tag: '<span class="cd-zt">zero medido</span>', corpo: 'Medimos e deu zero. Isto não é falta de dado: o YouTube confirmou a contagem.' }; },
    desligados: function(){ return { frase: '<b>Comentários desligados pelo canal.</b> O canal Leo desligou os comentários deste vídeo.', tag: nmTag('não medido') + '<span class="cd-mo">motivo do canal</span>', corpo: 'Não é zero comentários e não é falha nossa: ninguém pode comentar neste vídeo. Se o canal religar, o próximo retrato mostra.' }; },
    tarde: function(n){ return { frase: '<b>Não coletado com ' + n + ' dia.</b> Descobrimos o vídeo com 4 dias, depois do prazo de 3 dias para esta idade.', tag: nmTag('não medido') + '<span class="cd-mo">motivo nosso · ' + marcoData(4) + '</span>', corpo: 'Um retrato tirado depois do prazo seria de outra idade, e a tela não o chamaria de ' + n + ' dia. O vídeo guarda os retratos das outras idades.' }; },
    falhou: function(n){ return { frase: '<b>Não coletado com ' + n + ' dias.</b> O YouTube diz que o vídeo tem ' + C.v.com + ' comentários, mas devolveu a lista vazia em ' + A.dm(D.HOJE) + '.', tag: nmTag('não medido') + '<span class="cd-mo">motivo nosso · tentativa de ' + A.dm(D.HOJE) + '</span>', corpo: 'Isto não é “nenhum comentário”: a contagem diz que há. Tentamos de novo até ' + A.dm(A.addDias(PUB, 10)) + '; se não vier, esta idade fica sem retrato.' }; },
    antes: function(){ var dc = A.dm(D.COLETA); return { frase: '<b>Este vídeo é anterior à coleta de comentários.</b> A coleta começou em ' + dc + '; o vídeo foi publicado em ' + A.dm(PUB) + '.', tag: nmTag('não medido') + '<span class="cd-mo">a coleta começou em ' + dc + '</span>', corpo: 'Nenhuma idade tem retrato, e nenhuma vai ter: quando a coleta começou o vídeo já tinha ' + A.dias(PUB, D.COLETA) + ' dias, mais que os 30 da última idade.' }; },
    fecha: function(n){ return { frase: 'O retrato de <b>' + n + ' dias fecha em ' + marcoData(n) + '</b>.', tag: '<span class="cd-ft">' + I.cal + 'ainda não existe</span>', corpo: 'O vídeo faz ' + n + ' dias em ' + marcoData(n) + '. Até lá não há o que mostrar, e isto não é zero.' }; }
  };
  function painelEstado(k){
    var e = EST[k](idade);
    return '<div class="cd-pe ' + k + '">' + boxEstado(k) + '<div class="cd-pb"><p class="cd-fr"><span>' + e.frase + '</span></p><p class="cd-tg">' + e.tag + '</p><p class="cd-pt">' + e.corpo + '</p></div></div>';
  }

  /* ---------------------------------------------------------------- o painel de uma idade com dado */
  function frase(lista, n){
    var tot = totalDia(idade), parts = [];
    var sim = lista.filter(function(c){ return c.resp === 'sim'; }).length;
    ORD.forEach(function(g){ if (n[g]) parts.push(n[g] + ' ' + { c: 'mais curtidos', k: 'com o criador' + (sim ? ' (ele respondeu a ' + sim + ')' : ''), a: (n.a === 1 ? 'de canal que você acompanha' : 'de canais que você acompanha'), g: (n.g === 1 ? 'de canal grande' : 'de canais grandes') }[g]); });
    var amostra = C.completo ? '<b>' + lista.length + ' de todos os ' + tot + '</b> comentários do vídeo' : '<b>' + lista.length + ' dos ' + tot + '</b> primeiros comentários que o YouTube mostra, na ordem de relevância dele';
    return '<span>Com ' + idade + (idade === 1 ? ' dia' : ' dias') + ', guardamos ' + amostra + ': ' + parts.join(', ').replace(/, ([^,]*)$/, ' e $1') + '.</span>';
  }
  /* o vídeo tem menos de 20 comentários principais? (total do dia menos as respostas dos guardados): então "os 20 mais curtidos" seria afirmar mais do que existe */
  function poucosPrincipais(){
    if (!C.completo) return false;
    var col = idade === 1 ? 0 : 1, reps = 0;
    C.set.forEach(function(c){ if (c.l[col] != null) reps += c.rep; });
    return totalDia(idade) - reps < 20;
  }
  function legenda(n, lista){
    var poucos = poucosPrincipais();
    var itens = ORD.map(function(g){
      if (n[g]) return '<li class="cd-lg g-' + g + '"><span class="cd-casa mini g-' + g + '" aria-hidden="true">' + G[g].ic + '</span><span><b class="num">' + n[g] + '</b> ' + (g === 'g' ? 'de canal grande, ' + (poucos ? 'entre os comentários do vídeo' : 'entre os 20 mais curtidos') : G[g].leg) + '</span></li>';
      var z = { a: 'nenhum canal que você acompanha comentou', g: C.ocultos ? 'nenhum canal grande entre os ' + (20 - C.ocultos) + ' que deu para medir' : (poucos ? 'nenhum canal grande entre os comentários do vídeo' : 'nenhum canal grande entre os 20 mais curtidos') }[g];
      if (!z) return '';
      return '<li class="cd-lg zero"><span class="cd-casa mini zero" aria-hidden="true">' + G[g].ic + '</span>' + zbox() + '<span>' + z + '</span></li>';
    }).join('');
    var ocultos = C.ocultos ? '<li class="cd-lg nm"><span class="cd-casa mini nmx" aria-hidden="true">' + G.g.ic + '</span><span>' + nmTag('não medido') + ' ' + C.ocultos + ' autor com inscritos ocultos</span></li>' : '';
    return '<ul class="cd-leg" aria-label="Por que cada comentário está aqui">' + itens + ocultos + '</ul>';
  }
  function movimento(){
    if (idade !== 7 || C.idades[1] !== 'ok') return idade === 1 ? '<p class="cd-mvl"><span class="cd-dim">Este é o primeiro retrato. O dia 7 mostra quem entrou e quem saiu dos 12.</span></p>' : '';
    var ent = C.set.filter(function(c){ return c.novo; }).length, sai = (C.saiu || []).length;
    if (!ent && !sai) return '';
    return '<div class="cd-mvl"><p class="cd-mvt"><span class="cd-mvs in">' + I.mais + '<b class="num">' + ent + '</b> entraram nos 12 do dia 1 ao dia 7</span><span class="cd-mvs out">' + I.menos + '<b class="num">' + sai + '</b> saíram</span></p>' +
      (sai ? '<details class="cd-sai"><summary>Ver os ' + sai + ' que saíram dos 12</summary><ul>' + C.saiu.map(function(s){ return '<li>' + (C.leitor === 'sem' ? '<span class="cd-sx cd-sx-res">' + I.lock + 'Texto reservado</span>' : '<span class="cd-sx" dir="auto">' + esc(s.t) + '</span>') + '<span class="cd-dim"><b class="num">' + s.l1 + '</b> ' + (s.l1 === 1 ? 'curtida' : 'curtidas') + ' no dia 1 · ' + (C.leitor === 'edita' ? esc(s.au) : 'um espectador') + '</span></li>'; }).join('') + '</ul></details>' : '') + '</div>';
  }
  function painelOk(){
    var lista = listaDaIdade(), n = contar(lista), total = lista.length, TD = totalDia(idade), pct = Math.min(100, Math.round(total / TD * 100));
    var max = 1; C.set.forEach(function(c){ c.l.forEach(function(x){ if (x > max) max = x; }); }); (C.saiu || []).forEach(function(s){ if (s.l1 > max) max = s.l1; });
    var privado = C.leitor === 'privado', sem = C.leitor === 'sem';
    var aviso = sem ? '<p class="cd-av-l">' + I.lock + '<span><b>Você vê quantos comentários há e como cada um evoluiu.</b> O texto fica reservado a quem tem o direito “ver desempenho privado” ou edita o site; o nome e a foto, só a quem edita.</span></p>' :
      privado ? '<p class="cd-av-l">' + I.lock + '<span><b>Você vê o texto, mas não o nome nem a foto</b> de quem comentou. Nos primeiros 28 dias, isso é só de quem edita o site.</span></p>' : '';
    var casas = '<ol class="cd-casas" aria-label="' + total + ' comentários guardados, um por casa, na ordem da lista">' + lista.map(function(c, i){ return casa(c.g, i, total, c, true); }).join('') + '</ol>';
    var am = '<div class="cd-am"><span class="cd-am-t num">' + (C.completo ? total + ' de ' + TD + ' (todos)' : total + ' de ' + TD) + '</span><div class="cd-am-b" role="img" aria-label="' + total + ' de ' + TD + ' comentários guardados' + (C.completo ? ', todos os que o vídeo tinha no dia ' + idade : '') + '"><i style="width:' + pct + '%"></i></div></div>';
    var cards = lista.map(function(c, i){ return card(c, i, total, max, C.leitor, i >= 5 && !TODOS); }).join('');
    var mais = total > 5 && !TODOS ? '<p class="cd-mais"><button type="button" class="btn big" id="cd-mais" aria-expanded="false" aria-controls="cd-lista">Mostrar os outros ' + (total - 5) + '</button></p>' : '';
    return aviso + '<p class="cd-fr">' + frase(lista, n) + A.ibtn('infoSec', 'Como contamos os ' + total + ' de ' + TD + ' comentários', true) + '</p>' + am + casas + legenda(n, lista) + movimento() +
      '<div class="cd-lista" id="cd-lista">' + cards + '</div>' + mais;
  }
  /* ---------------------------------------------------------------- as três abas de idade */
  function aba(k){
    var s = C.idades[k], rot = k + (k === 1 ? ' dia' : ' dias'), sel = k === idade, t2, ic, cls = s;
    var qtd = C.set.filter(function(c){ return tem(c.l[k === 1 ? 0 : 1]); }).length + (k === 1 ? (C.saiu || []).length : 0);
    if (s === 'ok') { t2 = qtd + ' guardados'; ic = '<span class="cd-eb mini ok">' + L.IC.comentario + '</span>'; }
    else if (s === 'zero') { t2 = 'nenhum comentário'; ic = '<span class="cd-eb mini zero"><b class="num">0</b></span>'; }
    else if (s === 'desligados') { t2 = 'desligados pelo canal'; ic = '<span class="cd-eb mini nm-h2">' + I.balaoOff + '</span>'; }
    else if (s === 'tarde' || s === 'falhou') { t2 = 'não coletado'; ic = '<span class="cd-eb mini nm-h2">' + I.relogioAviso + '</span>'; }
    else if (s === 'antes') { t2 = 'antes da coleta'; ic = '<span class="cd-eb mini nm-h2">' + I.cal + '</span>'; }
    else { t2 = 'fecha em ' + marcoData(k); ic = '<span class="cd-eb mini fecha">' + I.cal + '</span>'; }
    return '<button type="button" role="tab" class="cd-tab st-' + cls + '" id="tab-' + k + '" data-idade="' + k + '" aria-selected="' + sel + '" aria-controls="cd-painel" tabindex="' + (sel ? 0 : -1) + '">' + ic + '<span class="cd-tt"><b>' + rot + '</b><span>' + t2 + '</span></span></button>';
  }
  function abas(){ return '<div class="cd-abas" role="tablist" aria-label="Idade do vídeo no retrato dos comentários">' + [1, 7, 30].map(aba).join('') + '</div>'; }
  function painel(){
    var s = C.idades[idade];
    if (s === 'ok') return painelOk();
    return painelEstado(s);
  }

  /* ---------------------------------------------------------------- a seção inteira */
  function cabSecao(){
    return '<header class="cd-top"><h2 id="cd-h">Comentários de destaque</h2><span class="ex">exemplo</span>' + A.ibtn('infoSec', 'Como escolhemos os comentários', true) + '</header>';
  }
  function secaoVideo(){
    if (caso === 'carregando') {
      var sk = function(){ return '<div class="cd-sk"><i class="a"></i><i class="b"></i><i class="c"></i></div>'; };
      return L.novo('<section class="cd" aria-labelledby="cd-h" aria-busy="true">' + cabSecao() + '<p class="cd-ld" role="status">' + L.IC.sync + 'Carregando os comentários guardados…</p>' + sk() + sk() + sk() + '</section>', 'novo', 'cd-novo');
    }
    if (caso === 'erro') {
      return L.novo('<section class="cd" aria-labelledby="cd-h">' + cabSecao() + '<p class="cd-er" role="alert">' + L.IC.aviso + '<span><b>Não deu para abrir os comentários agora.</b> A leitura falhou. Nada foi apagado: o que está guardado continua lá.</span><span class="btn" role="button" tabindex="0">Tentar de novo</span></p></section>', 'novo', 'cd-novo');
    }
    return L.novo('<section class="cd" aria-labelledby="cd-h">' + cabSecao() + abas() + '<div class="cd-painel" id="cd-painel" role="tabpanel" aria-labelledby="tab-' + idade + '" aria-live="polite">' + painel() + '</div></section>', 'novo', 'cd-novo');
  }

  /* o cabeçalho e o histórico do vídeo são do mockup 13: aqui só a moldura que mostra onde a seção se encaixa */
  function cabVideo(){
    var v = C.v, ago = IDADE_HOJE + (IDADE_HOJE === 1 ? ' dia' : ' dias');
    var cells = [{ v: v.views, l: 'views' }, { v: v.likes, l: 'curtidas' }, { v: v.com, l: 'comentários' }, { v: v.dur, l: 'duração' }];
    return '<div class="vh cd-vh"><span class="th" style="background:' + L.cor(v.t) + '"></span><div><h1 id="vt" tabindex="-1">' + esc(v.t) + '</h1><p class="l2"><span class="chip">Leo</span><span class="ex">exemplo</span><span>Publicado em ' + A.dmy(v.pub) + ' (há ' + ago + ') · vídeo longo</span></p><div class="nrow">' + A.faixa(cells, 'Números do vídeo') + '</div></div></div>' +
      '<p class="cd-m13">' + L.IC.video + '<span>Aqui ficam a curva por idade, as primeiras 72 horas e o dia a dia: <b>mockup 13</b>. A seção abaixo entra logo depois.</span></p>';
  }
  var AJUDA =
    A.oculto('infoSec', 'Como escolhemos os comentários', '<ul><li><b>A amostra:</b> pegamos os 100 primeiros comentários que o YouTube mostra, na ordem de relevância dele, e guardamos 12. Se o vídeo tem menos de 100, vemos todos. Não é a lista completa e não é a dos “melhores”.</li><li><b>Quem entra:</b> até 4 com o criador (comentário dele ou com resposta dele), até 2 de autor de destaque, o resto pelos mais curtidos. Vaga que sobra vai para os mais curtidos.</li><li><b>Três idades:</b> 1, 7 e 30 dias de vida do vídeo. Depois dos 30 dias não guardamos mais nada deste vídeo. Um comentário que não está nos 12 de uma idade mostra “fora dos 12”, não zero.</li><li><b>Nome e foto:</b> guardados por 28 dias e apagados; o texto e as curtidas ficam. Só quem edita o site vê o nome e a foto.</li><li><b>Respostas:</b> guardamos até 3 respostas do criador por comentário, nenhuma de outra pessoa.</li><li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>') +
    A.oculto('infoDest', 'Canal grande e canal que você acompanha', '<ul><li><b>Canal que você acompanha:</b> quem comentou é um canal que está no seu cadastro. Aparece sempre com o nome.</li><li><b>Canal grande:</b> o canal de quem comentou tem 100 mil inscritos ou mais <i>e</i> pelo menos 10 vezes os inscritos do canal do vídeo. Só olhamos os autores dos 20 comentários mais curtidos. Depois de 28 dias fica só a faixa, nunca o nome.</li><li><b>O que a regra não vê (os sete limites):</b></li><li>1. Canal grande com poucas curtidas fica fora dos 20 e não é marcado.</li><li>2. Inscritos ocultos: o tamanho não se sabe; não marcamos e contamos à parte, nunca como “pequeno”.</li><li>3. Inscritos ocultos no canal do vídeo: vale só o mínimo de 100 mil e a razão fica “não medida”.</li><li>4. O YouTube arredonda os inscritos; um canal na borda de uma faixa pode cair na vizinha.</li><li>5. Pessoa famosa numa conta pequena não aparece. “Famoso” não é um dado.</li><li>6. Autor sem canal identificado não é consultado.</li><li>7. Homônimo e conta falsa: o tamanho é o filtro; o nome nunca entra na regra.</li><li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>') +
    A.oculto('infoM11', 'O criador responde', '<ul><li><b>Conta:</b> vídeos do canal publicados nos últimos 90 dias, com retrato de 30 dias, em que pelo menos um dos comentários guardados tem resposta do criador. Sempre “5 de 14”; percentual só com 10 vídeos ou mais.</li><li><b>É um mínimo:</b> só vemos as respostas dele nos cerca de 12 comentários guardados e nas respostas que o YouTube mostrou. “Não vimos resposta” não quer dizer que ele não respondeu. Quem responde a todos e quem responde só aos mais curtidos dão o mesmo número.</li><li><b>Não medido:</b> menos de 5 vídeos com retrato de 30 dias, ou a coleta começou há menos de 30 dias.</li><li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>');

  /* ---------------------------------------------------------------- a página do canal (M11 e a lista do que o criador respondeu)
     Nada de contagem é digitada: vídeos, casas, "5 de 14", "36%", "6 comentários, em 5 vídeos" e o cabeçalho "17 vídeos" saem de D.CV, D.RESPOSTAS, D.CANAL_* e do que a lista mostra.
     "com dado" e "não medido" têm vídeos com 30 dias fechados; a coleta só começou em 06/10, então o "hoje" desses dois exemplos é D.HOJE_FUT (a nota fora da tela diz isso). */
  function paginaCanal(){
    var est = caso === 'canal' ? 'cheio' : caso === 'canal-fecha' ? 'fecha' : 'nm', MIN = 5;
    var HOJE = est === 'fecha' ? D.HOJE : D.HOJE_FUT, ZERO = '<b class="num">0</b>';
    function cs(cl, ic, lab){ return '<li><span class="cd-casa m11 ' + cl + '" role="img" aria-label="' + esc(lab) + '">' + ic + '</span></li>'; }
    function clip(t){ return t.length > 220 ? t.slice(0, t.lastIndexOf(' ', 220)) + '…' : t; }
    /* os comentários em que o criador respondeu (o mais recente primeiro) */
    var itens;
    if (est === 'fecha') { itens = []; D.CANAL_FECHA_VIDEOS.forEach(function(w){ w.set.filter(function(c){ return c.resp === 'sim'; }).forEach(function(c){ itens.push({ vk: w.v.t, v: w.v.t, vp: w.v.pub, d: isoDm(c.pub), c: c.t, r: c.re, l: c.l[w.m === 1 ? 0 : 1], m: w.m }); }); }); }
    else itens = (est === 'cheio' ? D.RESPOSTAS : D.RESPOSTAS.slice(0, 3)).map(function(x){ return { vk: x.v, v: D.CV[x.v].t, vp: D.CV[x.v].pub, d: x.d, c: x.c, r: x.r, l: x.l, m: 7 }; });
    itens.sort(function(a, b){ return a.d < b.d ? 1 : a.d > b.d ? -1 : a.vp < b.vp ? 1 : a.vp > b.vp ? -1 : b.l - a.l; });
    var vids = {}; itens.forEach(function(x){ vids[x.vk] = x.vp; });
    var sim = Object.keys(vids).length;
    var casas = [], leg = '', fr, total, closed = 0, rec = 0, antes = 0, esp = [], nEsp = 0, retrato = 0, nao = 0, sem = 0;
    if (est === 'cheio') {
      nao = D.CANAL_NAO.length; rec = D.CANAL_RECENTES.length; closed = sim + nao; total = closed + rec;
      for (var i = 0; i < sim; i++) casas.push(cs('sim', I.reply, 'vídeo ' + (i + 1) + ': vimos resposta do criador'));
      for (i = 0; i < nao; i++) casas.push(cs('nao', ZERO, 'vídeo ' + (sim + i + 1) + ': não vimos resposta do criador'));
      casas.push('<li class="cd-gap" role="presentation" aria-hidden="true"></li>'); for (i = 0; i < rec; i++) casas.push(cs('fe', I.cal, 'vídeo recente: o retrato de 30 dias ainda não fechou'));
      fr = '<span>Leo respondeu a comentários em <b>' + sim + ' de ' + closed + '</b> vídeos com retrato de 30 dias' + (closed >= 10 ? ' (<b>' + Math.round(100 * sim / closed) + '%</b>)' : '') + '. Outros ' + rec + ' vídeos recentes ainda não fecharam os 30 dias. É um mínimo: só vemos as respostas dele nos 12 comentários guardados de cada vídeo.</span>';
      leg = '<li class="cd-lg"><span class="cd-casa mini m11 sim" aria-hidden="true">' + I.reply + '</span><span><b class="num">' + sim + '</b> vídeos com resposta dele</span></li><li class="cd-lg"><span class="cd-casa mini m11 nao" aria-hidden="true">' + ZERO + '</span><span><b class="num">' + nao + '</b> vídeos em que não vimos resposta</span></li><li class="cd-lg"><span class="cd-casa mini m11 fe" aria-hidden="true">' + I.cal + '</span><span><b class="num">' + rec + '</b> ainda sem retrato de 30 dias, fora da conta</span></li>';
    } else if (est === 'fecha') {
      antes = D.CANAL_ANTES.length; nEsp = D.CANAL_FECHA_VIDEOS.length; esp = []; D.CANAL_FECHA_VIDEOS.map(function(w){ return A.addDias(w.v.pub, 30); }).sort().forEach(function(d){ var x = A.dm(d); if (esp.indexOf(x) < 0) esp.push(x); }); total = antes + nEsp;
      for (i = 0; i < antes; i++) casas.push(cs('antes', I.cal, 'vídeo anterior à coleta de comentários'));
      for (i = 0; i < nEsp; i++) casas.push(cs('fe', I.cal, 'o retrato de 30 dias ainda não fechou'));
      fr = '<span><b>Ainda não dá para medir.</b> Só ' + nEsp + ' dos ' + total + ' vídeos dos últimos 90 dias têm coleta de comentários, e o primeiro retrato de 30 dias fecha em <b>' + esp[0] + '</b>.</span>';
      leg = '<li class="cd-lg"><span class="cd-casa mini m11 antes" aria-hidden="true">' + I.cal + '</span><span><b class="num">' + antes + '</b> vídeos anteriores à coleta, que começou em ' + A.dm(D.COLETA) + '</span></li><li class="cd-lg"><span class="cd-casa mini m11 fe" aria-hidden="true">' + I.cal + '</span><span><b class="num">' + nEsp + '</b> esperando os 30 dias (' + esp.join(' e ') + ')</span></li>';
    } else {
      nao = 1; retrato = sim + nao; total = Object.keys(D.CV).length + D.CANAL_NAO.length; sem = total - retrato;
      for (i = 0; i < sim; i++) casas.push(cs('sim', I.reply, 'vimos resposta do criador'));
      for (i = 0; i < nao; i++) casas.push(cs('nao', ZERO, 'não vimos resposta do criador'));
      for (i = 0; i < sem; i++) casas.push(cs('antes', L.IC.relogio, 'sem retrato de 30 dias'));
      fr = '<span><b>Ainda não dá para medir.</b> Só ' + retrato + ' dos ' + total + ' vídeos têm retrato de 30 dias, e a conta pede pelo menos ' + MIN + '.</span>';
      leg = '<li class="cd-lg"><span class="cd-casa mini m11 sim" aria-hidden="true">' + I.reply + '</span><span><b class="num">' + sim + '</b> com resposta dele</span></li><li class="cd-lg"><span class="cd-casa mini m11 nao" aria-hidden="true">' + ZERO + '</span><span><b class="num">' + nao + '</b> sem resposta à vista</span></li><li class="cd-lg"><span class="cd-casa mini m11 antes" aria-hidden="true">' + L.IC.relogio + '</span><span><b class="num">' + sem + '</b> sem retrato de 30 dias (o motivo de cada um está na página do vídeo)</span></li>';
    }
    var bloco = '<section class="cd-m11" aria-labelledby="m11h"><h2 id="m11h">O criador responde<span class="ex">exemplo</span>' + A.ibtn('infoM11', 'Como o criador responde é calculado', true) + '</h2><p class="cd-fr">' + fr + '</p><ol class="cd-casas m11" aria-label="Um vídeo por casa, dos últimos 90 dias: ' + total + ' vídeos">' + casas.join('') + '</ol><ul class="cd-leg">' + leg + '</ul></section>';
    var nCom = itens.length, escopo = est === 'fecha' ? '' : ' com retrato de 30 dias';
    var lista = '<section class="cd-rl" aria-labelledby="rlh"><h2 id="rlh">O que o criador respondeu</h2><p class="cd-fr"><span>Leo respondeu a <b>' + L.pl(nCom, 'comentário', 'comentários') + '</b> ' + (nCom === 1 ? 'guardado' : 'guardados') + ', em ' + L.pl(sim, 'vídeo', 'vídeos') + escopo + '. O mais recente primeiro.</span></p><ol class="cd-rls">' + itens.map(function(x){
      return '<li class="cd-ri"><p class="cd-rv"><a href="#" onclick="return false">' + esc(x.v) + '</a><span class="cd-dim">comentário de ' + A.dm(x.d) + ' · <b class="num">' + A.mil(x.l) + '</b> ' + (x.l === 1 ? 'curtida' : 'curtidas') + (x.m === 1 ? ' no dia 1' : ' aos 7 dias') + '</span></p><p class="cd-rc" dir="auto">' + esc(clip(x.c)) + '</p><p class="cd-rr">' + I.reply + '<span class="cd-rrh">' + avatar('Leo', 'canal').replace('cd-av', 'cd-av mini') + '<b>Leo</b> <span class="chip cd-chk">' + I.mic + 'criador</span></span><span class="cd-rt" dir="auto">' + esc(x.r) + '</span></p></li>'; }).join('') + '</ol></section>';
    var head = '<div class="chead"><span class="av" aria-hidden="true">L</span><div class="l1"><h1>Leo</h1><span class="chip">Viagem</span><span class="ex">exemplo</span></div><div class="acts"><span class="btn">Abrir no YouTube</span></div><p class="sub"><b>6,2 mil</b> inscritos · ' + total + ' vídeos nos últimos 90 dias · o cabeçalho completo é do <b>mockup 15</b></p></div>';
    window.C20_CANAL = { est: est, hoje: HOJE, total: total, sim: sim, nao: nao, rec: rec, closed: closed, antes: antes, esp: esp, nEsp: nEsp, retrato: retrato, sem: sem, min: MIN, itens: itens, vids: vids, naoPubs: D.CANAL_NAO, recPubs: D.CANAL_RECENTES, antesPubs: D.CANAL_ANTES };
    return head + L.novo(bloco, 'novo', 'cd-novo cd-nv11') + L.novo(lista, 'novo', 'cd-novo cd-nvrl');
  }

  /* ---------------------------------------------------------------- monta a página */
  var VID = [['tipico', 'Com dado típico (o comum: nenhum canal grande)'], ['extremo', 'Com dado extremo (os quatro motivos e todos os textos)'], ['completo', 'Vídeo pequeno (todos os 37 comentários)'], ['idade1', 'Aba de 1 dia'],
    ['zero', 'Zero medido (nenhum comentário)'], ['desligados', 'Não medido: desligados pelo canal'], ['naocoletado', 'Não medido: não coletado (motivo nosso)'], ['antes', 'Não medido: antes da coleta'], ['novo', 'Fecha em dd/mm (vídeo novo)'],
    ['carregando', 'Carregando'], ['erro', 'Erro de leitura'], ['leitura', 'Só leitura: sem o texto'], ['leitura-privado', 'Só leitura: com o texto, sem o nome']];
  var CAN = [['canal', 'M11 com dado (exemplo)'], ['canal-fecha', 'M11: fecha em dd/mm (o caso de hoje)'], ['canal-nm', 'M11 não medido: poucos vídeos']];
  var barra = L.barra([{ rotulo: 'Página do vídeo', param: 'caso', itens: VID, padrao: 'tipico' }, { rotulo: 'Página do canal', param: 'caso', itens: CAN, padrao: '__nenhum__' }],
    'Contorno verde-água e “+ novo” = o acréscimo: a seção “Comentários de destaque” (na página do vídeo, depois do histórico do mockup 13) e, na página do canal (mockup 15), o bloco “O criador responde” e a lista “O que o criador respondeu”. Tudo aqui é exemplo: canais, pessoas, textos e números inventados. Na página do vídeo, as abas de 1, 7 e 30 dias, “Ver tudo”, “Mostrar os outros” e o ⓘ funcionam; o resto é estático. Texto de comentário é de terceiros, mostrado como veio.');
  var corpo;
  if (NOCANAL) corpo = A.migalha([['Observatório', '#'], ['Canais', '#'], ['Leo', '#']]) + L.obs({ aba: 'Canais', fila: 7 }) + paginaCanal() + AJUDA;
  else corpo = A.migalha([['Observatório', '#'], ['Leo', '#'], [C.v.t, '#']]) + L.obs({ aba: 'Mudanças', fila: 7 }) + cabVideo() + secaoVideo() + AJUDA;

  /* referência fora da tela: os dois momentos do mesmo comentário, os quatro estados do autor, as formas da base */
  function fora(){
    if (NOCANAL) return caso === 'canal-fecha' ? L.fora('De onde vêm os números deste exemplo', '<p class="cd-notaex">Este estado é o canal em ' + A.dmy(D.HOJE) + ', com os mesmos quatro vídeos recentes das telas de vídeo deste mockup (' + D.CANAL_FECHA_VIDEOS.map(function(w){ return esc(w.v.t); }).join('; ') + ') e doze vídeos mais antigos. A lista de respostas é a soma do “ele respondeu a N” de cada uma dessas telas. Os outros dois estados da página do canal (“com dado” e “não medido”) são exemplos à parte, com vídeos e números próprios.</p>') : L.fora('Data deste exemplo', '<p class="cd-notaex">Este estado simula o canal em <b>' + A.dmy(D.HOJE_FUT) + '</b>, e não em ' + A.dmy(D.HOJE) + ': a coleta de comentários começou em ' + A.dmy(D.COLETA) + ', então só a partir de ' + A.dm(A.addDias(D.COLETA, 30)) + ' existem vídeos com 30 dias fechados. Todas as datas desta página (vídeos, comentários, “últimos 90 dias”) seguem esse dia. O estado “fecha em dd/mm” é de ' + A.dmy(D.HOJE) + ', o dia real.</p>');
    var g = D.extremo[2];
    var a1 = '<div class="cd-it g-g ref"><header class="cd-hd"><span class="cd-mot g-g">' + G.g.ic + '<span>Canal grande</span></span><span class="cd-dim">Hoje, até ' + ateDe(g) + '</span></header><div class="cd-bd">' + autor(g, 'edita') + '</div></div>';
    var a2 = '<div class="cd-it g-g ref"><header class="cd-hd"><span class="cd-mot g-g">' + G.g.ic + '<span>Canal grande</span></span><span class="cd-dim">Depois de ' + ateDe(g) + '</span></header><div class="cd-bd">' + autor(g, 'depois') + '</div></div>';
    var ex = function(au, rot){ return '<div class="cd-it ref"><header class="cd-hd"><span class="cd-dim">' + rot + '</span></header><div class="cd-bd">' + autor({ au: au, l: [1, null, null] }, 'edita') + '</div></div>'; };
    var estados = ex({ t: 'ident', n: 'Marina Teles' }, 'Com identidade (foto carregada)') + ex({ t: 'ident', n: 'Beto Lima', foto: 'quebrada' }, 'Com identidade, foto que não carrega: vira a inicial') +
      '<div class="cd-it ref"><header class="cd-hd"><span class="cd-dim">Sem identidade (depois de 28 dias, ou para quem não edita)</span></header><div class="cd-bd">' + autor({ au: { t: 'ident', n: 'x' } }, 'depois') + '</div></div>' + ex({ t: 'acomp', n: 'Nômade Raiz' }, 'Canal que você acompanha: o nome fica, vem do cadastro');
    var bases = '<div class="cd-it g-g ref"><header class="cd-hd"><span class="cd-dim">Base com a razão medida</span></header><div class="cd-bd">' + baseBloco({ tam: 3, razao: 3 }) + '</div></div>' +
      '<div class="cd-it g-g ref"><header class="cd-hd"><span class="cd-dim">Razão não medida (inscritos do canal do vídeo ocultos)</span></header><div class="cd-bd">' + baseBloco({ tam: 2, razao: null }) + '</div></div>' +
      '<div class="cd-it g-g ref"><header class="cd-hd"><span class="cd-dim">Base de um canal de tamanho médio</span></header><div class="cd-bd">' + baseBloco({ tam: 1, razao: 1 }) + '</div></div>';
    return L.fora('Os dois momentos do mesmo comentário', '<div class="cd-fg2">' + a1 + a2 + '</div>') + L.fora('Os estados do autor', '<div class="cd-fg2">' + estados + '</div>') + L.fora('Formas da base do canal grande', '<div class="cd-fg2">' + bases + '</div>') +
      L.fora('Os quatro estados sem comentário, lado a lado', '<div class="tbw"><table class="tb" style="max-width:980px"><thead><tr><th scope="col">Estado</th><th scope="col">Forma</th><th scope="col">Quando</th><th scope="col">Na tela</th></tr></thead><tbody>' +
      '<tr><th scope="row">Nenhum comentário</th><td><span class="cd-eb mini zero"><b class="num">0</b></span> caixa vazada com 0</td><td>o YouTube confirma 0 comentários</td><td>zero medido</td></tr>' +
      '<tr><th scope="row">Comentários desligados pelo canal</th><td><span class="cd-eb mini nm-h2">' + I.balaoOff + '</span> hachura rosa</td><td>o canal desligou os comentários</td><td>não medido, motivo do canal</td></tr>' +
      '<tr><th scope="row">Não coletado</th><td><span class="cd-eb mini nm-h2">' + I.relogioAviso + '</span> hachura rosa</td><td>falha, lista vazia com contagem maior que 0, ou fora do prazo</td><td>não medido, motivo nosso, com a data</td></tr>' +
      '<tr><th scope="row">Fecha em dd/mm</th><td><span class="cd-eb mini fecha">' + I.cal + '</span> pontilhado</td><td>o marco ainda não chegou</td><td>ainda não existe</td></tr></tbody></table></div>');
  }
  /* a referência fora da tela é fixa: as datas dela contam a partir do vídeo típico (06/10), qualquer que seja o estado aberto */
  var PUB_ABERTO = PUB; PUB = D.VIDEO.pub; var FORA = fora(); PUB = PUB_ABERTO;
  A.moldura({ titulo: 'Comentários de destaque', barra: barra, corpo: corpo, fora: FORA });
  A.ligarInfos();

  /* ---------------------------------------------------------------- auditoria de coerência dos dados de exemplo
     Roda sempre; o resultado fica em window.C20_AUDITORIA (lista vazia = tudo fecha) e, se houver contradição, vai ao console. O script shots/auditoria-r4.mjs lê isto e confere o DOM. */
  function auditar(){
    var er = [], num = function(t){ if (t == null) return null; var x = parseFloat(String(t).replace(/\./g, '').replace(',', '.')); return /mil$/.test(t) ? x * 1000 : x; };
    function ok(cond, msg){ if (!cond) er.push(msg); }
    var iso = function(dm){ return '2026-' + dm.slice(3, 5) + '-' + dm.slice(0, 2); };
    if (NOCANAL) {
      var K = window.C20_CANAL, H = K.hoje;
      K.itens.forEach(function(x, i){
        ok(x.d >= x.vp, 'lista ' + i + ': comentário de ' + x.d + ' antes do vídeo ' + x.vp);
        ok(x.d <= A.addDias(x.vp, x.m), 'lista ' + i + ': comentário depois do marco de ' + x.m + ' dia(s) do vídeo, mas o rótulo das curtidas é desse marco');
        ok(x.d <= H, 'lista ' + i + ': comentário no futuro');
        if (i) ok(K.itens[i - 1].d >= x.d, 'lista fora de ordem (mais recente primeiro)');
        if (K.est !== 'fecha') ok(A.addDias(x.vp, 30) <= H, 'lista ' + i + ': vídeo sem os 30 dias fechados entra em "com retrato de 30 dias"');
        ok(x.vp >= A.addDias(H, -90), 'lista ' + i + ': vídeo fora dos últimos 90 dias');
      });
      if (K.est !== 'fecha') {
        var pubsSim = Object.keys(K.vids).map(function(k){ return K.vids[k]; });
        K.naoPubs.concat(pubsSim).forEach(function(p){ ok(A.addDias(p, 30) <= H && p >= A.addDias(H, -90) && p >= D.COLETA, 'vídeo fechado ' + p + ' fora da janela de 90 dias, ou antes da coleta, ou sem 30 dias'); });
        ok(K.naoPubs.filter(function(p){ return pubsSim.indexOf(p) >= 0; }).length === 0, 'dia de publicação repetido entre vídeos com e sem resposta');
        K.recPubs.forEach(function(p){ ok(A.addDias(p, 30) > H && p <= H, 'vídeo recente ' + p + ' já fechou os 30 dias, ou está no futuro'); });
        ok(H > A.addDias(D.COLETA, 30), 'o "hoje" do exemplo não deixa nenhum vídeo fechar 30 dias depois da coleta');
        if (K.est === 'cheio') { ok(K.closed >= K.min, 'cheio com menos vídeos que o mínimo'); ok(K.total === K.closed + K.rec, 'total'); }
        else { ok(K.retrato < K.min, 'não medido com vídeos suficientes'); ok(K.sim + K.nao + K.sem === K.total, 'casas do não medido não somam o total'); }
      } else {
        K.antesPubs.forEach(function(p){ ok(p >= A.addDias(H, -90) && A.dias(p, D.COLETA) > 30, 'vídeo "anterior à coleta" ' + p + ' fora dos 90 dias ou com 30 dias ainda por fechar depois da coleta'); });
        ok(K.antes === K.antesPubs.length, 'antes');
        ok(K.antes + K.nEsp === K.total, 'total do fecha');
        D.CANAL_FECHA_VIDEOS.forEach(function(w){ ok(w.v.pub >= D.COLETA && A.addDias(w.v.pub, 30) > H, 'vídeo do fecha ' + w.v.pub + ' sem coleta ou com 30 dias já fechados'); });
        ok(K.itens.length === D.CANAL_FECHA_VIDEOS.reduce(function(a, w){ return a + w.set.filter(function(c){ return c.resp === 'sim'; }).length; }, 0), 'lista do fecha x comentários com resposta dele nas páginas de vídeo');
      }
    } else {
      var v = C.v, likes = num(v.likes), com = num(v.com), vp1 = A.addDias(PUB, 1);
      ok(A.dias(PUB, D.HOJE) >= 0, 'vídeo publicado no futuro');
      ok(C.total <= 100, 'amostra maior que 100');
      if (com != null && (C.idades[1] === 'ok' || C.idades[7] === 'ok')) { ok(C.completo ? C.total === com : (C.total === 100 && com >= 100), 'amostra ' + C.total + ' x comentários do vídeo ' + com); }
      [1, 7, 30].forEach(function(k){
        var s = C.idades[k], fut = A.addDias(PUB, k) > D.HOJE;
        ok((s === 'fecha') === fut, 'idade ' + k + ': estado ' + s + ' contra a data (fecha em ' + A.addDias(PUB, k) + ', hoje ' + D.HOJE + ')');
        if (s === 'zero') ok(com === 0, 'zero medido, mas o cabeçalho diz ' + v.com + ' comentários');
        if (s === 'desligados') ok(v.com == null, 'desligados, mas o cabeçalho traz número de comentários');
        if (s === 'ok') ok(PUB >= D.COLETA, 'retrato "guardado" de vídeo anterior à coleta');
        if (s === 'antes') ok(A.dias(PUB, D.COLETA) > 30, '"antes da coleta" com idade ainda alcançável: o vídeo tinha ' + A.dias(PUB, D.COLETA) + ' dias na coleta');
        if (s === 'tarde' || s === 'falhou') ok(com > 0 && !fut, 'não coletado sem comentários ou no futuro');
      });
      var todos = C.set.concat((C.saiu || []).map(function(s){ return { l: [s.l1, null, null], pub: '07/10', rep: 0, resp: null, id: 's', saidaDoDia1: true }; }));
      var sr = 0;
      C.set.forEach(function(c){
        var p = iso(c.pub), r = c.resp === 'ns' && c.rep <= 5 ? 'nao' : c.resp;
        ok(p >= PUB && p <= D.HOJE, 'comentário ' + c.id + ' de ' + p + ' fora do intervalo do vídeo');
        if (c.l[0] != null) ok(p <= vp1, 'comentário ' + c.id + ' (' + c.pub + ') está no retrato de 1 dia, mas é de depois de ' + A.dm(vp1));
        if (c.l[0] == null && c.l[1] != null) ok(p > vp1 && p <= A.addDias(PUB, 7), 'comentário ' + c.id + ' (' + c.pub + ') entrou só no dia 7, mas é de antes do dia 1');
        if (c.l[0] != null && c.l[1] != null) ok(c.l[0] <= c.l[1], 'curtidas diminuem do dia 1 ao 7 (comentário ' + c.id + ')');
        if (c.l[1] != null && c.l[2] != null) ok(c.l[1] <= c.l[2], 'curtidas diminuem do dia 7 ao 30');
        c.l.forEach(function(x){ if (x != null) ok(x <= likes, 'comentário ' + c.id + ' tem ' + x + ' curtidas e o vídeo ' + likes); });
        if (r === 'ns') ok(c.rep > 5, 'não sabemos com ' + c.rep + ' respostas');
        if (r === 'nao') ok(c.rep <= 5 && c.rep >= 1, 'não vimos com ' + c.rep + ' respostas');
        if (r === 'sim') ok(c.rep >= 1, 'o criador respondeu, mas o comentário tem 0 respostas');
        sr += c.rep;
      });
      (C.saiu || []).forEach(function(s){ ok(s.l1 <= likes, 'comentário que saiu tem mais curtidas que o vídeo'); });
      if (C.idades[1] === 'ok' && C.idades[7] === 'ok' && (C.saiu || []).length) {
        var pisoC = Math.min.apply(null, C.set.filter(function(c){ return c.g === 'c' && c.l[1] != null; }).map(function(c){ return c.l[1]; }));
        (C.saiu || []).forEach(function(s){ ok(s.l1 <= pisoC, 'quem saiu dos 12 (' + s.l1 + ' curtidas no dia 1) tem mais curtidas que o menor "mais curtido" que ficou (' + pisoC + ' aos 7 dias)'); });
      }
      if (com != null && C.idades[1] === 'ok' || C.idades[7] === 'ok') ok(com == null || sr + C.set.length <= com, 'comentários + respostas (' + (sr + C.set.length) + ') passam os ' + com + ' do vídeo');
      [1, 7].forEach(function(k){
        if (C.idades[k] !== 'ok') return;
        var n = C.set.filter(function(c){ return c.l[k === 1 ? 0 : 1] != null; }).length + (k === 1 ? (C.saiu || []).length : 0);
        ok(n === Math.min(12, C.total), 'idade ' + k + ': ' + n + ' guardados, mas deveriam ser ' + Math.min(12, C.total));
      });
      if (C.completo) [1, 7].forEach(function(k){
        if (C.idades[k] !== 'ok') return;
        var td = totalDia(k), col = k === 1 ? 0 : 1, doDia = C.set.filter(function(c){ return c.l[col] != null; }), reps = doDia.reduce(function(a, c){ return a + c.rep; }, 0) + (k === 1 ? (C.saiu || []).length * 0 : 0);
        ok(td >= doDia.length + (k === 1 ? (C.saiu || []).length : 0) + reps, 'total do dia ' + k + ' (' + td + ') menor que os guardados mais as respostas deles');
        ok(td <= com, 'total do dia ' + k + ' (' + td + ') maior que o total de hoje (' + com + ')');
        if (A.addDias(PUB, k) === D.HOJE) ok(td === com, 'o retrato de hoje tem de ter o total de hoje (' + td + ' x ' + com + ')');
        else ok(td < com, 'retrato antigo com o total de hoje');
        C.set.forEach(function(c){ if (c.l[col] != null) ok(isoDm(c.pub) <= A.addDias(PUB, k), 'comentário ' + c.id + ' está no retrato do dia ' + k + ' mas é de depois dele'); });
      });
      if (C.idades[1] === 'ok' && C.idades[7] === 'ok') {
        var ent = C.set.filter(function(c){ return c.novo; }).length, sai = (C.saiu || []).length;
        ok(ent === sai, 'entraram ' + ent + ' e saíram ' + sai + ', mas a lista continua com o mesmo tamanho');
        ok(C.set.filter(function(c){ return c.l[0] == null; }).length === ent, 'entraram não bate com quem não tem retrato de 1 dia');
      }
    }
    window.C20_AUDITORIA = er;
    if (er.length && window.console) console.error('C20 auditoria: ' + er.length + ' contradição(ões)\n' + er.join('\n'));
  }
  auditar();

  /* ---------------------------------------------------------------- comportamento */
  function religa(){
    var p = document.getElementById('cd-painel'); if (p) A.ligarInfos(p);
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('[data-idade]') : null;
    if (t) { trocar(Number(t.getAttribute('data-idade'))); return; }
    var vt = e.target.closest ? e.target.closest('[data-vt]') : null;
    if (vt) { var x = document.getElementById(vt.getAttribute('data-vt')).firstElementChild, ab = x.classList.toggle('cl') === false; vt.setAttribute('aria-expanded', String(ab)); vt.textContent = ab ? 'Mostrar menos' : 'Ver tudo'; return; }
    var m = e.target.closest ? e.target.closest('#cd-mais') : null;
    if (m) { if (m.getAttribute('aria-expanded') === 'true') recolher(); else revelar('primeiro'); return; }
    var c = e.target.closest ? e.target.closest('a.cd-casa') : null;
    if (c) { e.preventDefault(); revelar(); var alvo = document.getElementById((c.getAttribute('href') || '').slice(1)); irAoCartao(alvo); try { history.replaceState(null, '', c.getAttribute('href')); } catch (x) {} }
  });
  /* B3: o foco nunca cai no body. Expandir leva o foco ao primeiro cartão revelado; o botão vira "Mostrar só os 5 primeiros" (aria-expanded true) e recolhe de volta. */
  function extras(){ return document.querySelectorAll('.cd-lista .cd-it[data-extra]'); }
  function irAoCartao(el){ if (!el) return; el.setAttribute('tabindex', '-1'); el.focus(); }
  function revelar(foco){
    var ex = extras(), m = document.getElementById('cd-mais'); if (!ex.length) return;
    ex.forEach(function(a){ a.hidden = false; });
    if (m) { m.setAttribute('aria-expanded', 'true'); m.textContent = 'Mostrar só os 5 primeiros'; }
    if (foco === 'primeiro') irAoCartao(ex[0]);
  }
  function recolher(){
    var m = document.getElementById('cd-mais'), ex = extras(); if (!m) return;
    ex.forEach(function(a){ a.hidden = true; });
    m.setAttribute('aria-expanded', 'false'); m.textContent = 'Mostrar os outros ' + ex.length; m.focus();
  }
  function trocar(k){
    if (!C.idades[k] || k === idade) return;
    idade = k;
    document.querySelectorAll('.cd-tab').forEach(function(b){ var s = Number(b.getAttribute('data-idade')) === k; b.setAttribute('aria-selected', String(s)); b.tabIndex = s ? 0 : -1; });
    var p = document.getElementById('cd-painel'); p.setAttribute('aria-labelledby', 'tab-' + k); p.innerHTML = painel(); religa();
  }
  document.addEventListener('keydown', function(e){
    var t = e.target.closest ? e.target.closest('.cd-tab') : null; if (!t) return;
    var ks = [1, 7, 30], i = ks.indexOf(Number(t.getAttribute('data-idade'))), n = null;
    if (e.key === 'ArrowRight') n = ks[(i + 1) % 3]; else if (e.key === 'ArrowLeft') n = ks[(i + 2) % 3]; else if (e.key === 'Home') n = 1; else if (e.key === 'End') n = 30; else return;
    e.preventDefault(); trocar(n); var b = document.getElementById('tab-' + n); if (b) b.focus();
  });
  religa();
})();
