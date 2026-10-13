/* q.js: mockup 17b, aba Outliers com ordenação por views aos 7 ou 30 dias (V7, V30; M1 do spec) e selo "ao vivo ou estreia".
   ?caso=padrao|v7|nao-medido|futuro|extremo|zero|erro|vazio|leitura   ?ordem=mult|v7|v30|vpd|recent (troca a ordem do caso)   ?tema=claro
   Tudo é exemplo (canais e números inventados). Hoje = 13/10/2026; "futuro" é um exemplo de 20/12/2026.
   Regras: o padrão continua sendo o multiplicador; quem não tem a medida fica no fim, na ordem do multiplicador; nunca um 0 onde o dado não veio. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, Q = window.Q, q = A.q, esc = A.esc;
  var caso = q.get('caso') || 'padrao';

  /* ---------------------------------------------------------------- os casos */
  function clone(l){ return l.map(function(v){ var o = {}; Object.keys(v).forEach(function(k){ o[k] = v[k]; }); return o; }); }
  var extremo = clone(Q.FUT_LISTA);
  extremo[0].t = 'Gastei R$ 100 mil para passar um ano inteiro vivendo em hotéis de aeroporto, trens noturnos e hostels de cinco continentes sem repetir cidade';
  extremo[0].c = 'Canal de Viagens e Tecnologia do Zé da Silva Sauro'; extremo[0].views = 6400000; extremo[0].m = 63; extremo[0].v7 = 1240000; extremo[0].v30 = 3180000; extremo[0].vpd = 41000;
  extremo[1].views = 1900000; extremo[1].m = 48; extremo[1].v7 = 410000; extremo[1].v30 = 1210000; extremo[1].vpd = 22000;
  extremo[13].v7 = 312; extremo[13].v30 = 1900; extremo[13].views = 2100; extremo[13].m = 2.0; extremo[13].vpd = 6;
  var zero = clone(Q.FUT_LISTA);
  zero[3].v7 = 0; zero[7].v7 = 0; /* f4 e f8: vídeos que ficaram privados ou agendados na primeira semana (ver o ⓘ) */
  var CASOS = {
    'padrao':     { lista: Q.HOJE_LISTA, hoje: Q.HOJE, ordem: 'mult', total: 303, fora: 2, janela: 'Até 90 dias' },
    'v7':         { lista: Q.HOJE_LISTA, hoje: Q.HOJE, ordem: 'v7', total: 303, fora: 2, janela: 'Até 90 dias' },
    'nao-medido': { lista: Q.HOJE_LISTA, hoje: Q.HOJE, ordem: 'v30', total: 303, fora: 2, janela: 'Até 90 dias' },
    'futuro':     { lista: Q.FUT_LISTA, hoje: Q.FUT_HOJE, ordem: 'v30', total: 318, fora: 3, janela: 'Até 90 dias', exemplo: true },
    'extremo':    { lista: extremo, hoje: Q.FUT_HOJE, ordem: 'v7', total: 318, fora: 3, janela: 'Até 90 dias', exemplo: true },
    'zero':       { lista: zero, hoje: Q.FUT_HOJE, ordem: 'v7', total: 318, fora: 3, janela: 'Até 90 dias', exemplo: true },
    'erro':       { lista: Q.HOJE_LISTA, hoje: Q.HOJE, ordem: 'mult', total: 303, fora: 2, janela: 'Até 90 dias', erro: true },
    'vazio':      { lista: [], hoje: Q.HOJE, ordem: 'v7', total: 87, fora: 0, janela: 'Até 30 dias', vazio: true, fmt: 'Shorts' },
    'leitura':    { lista: Q.HOJE_LISTA, hoje: Q.HOJE, ordem: 'v7', total: 303, fora: 2, janela: 'Até 90 dias', leitura: true }
  };
  var C = CASOS[caso] || CASOS.padrao;
  var ordem = q.get('ordem') || C.ordem;
  if (C.erro && (ordem === 'v7' || ordem === 'v30')) ordem = 'mult';
  var N = ordem === 'v7' ? 7 : ordem === 'v30' ? 30 : 0;

  /* ---------------------------------------------------------------- a conta de cada célula (M1) */
  function est(v, n){
    var val = n === 7 ? v.v7 : v.v30;
    if (val != null) return { k: val === 0 ? 'zero' : 'com', val: val };
    if (v.tarde) return { k: 'nm', cod: 'tarde', curto: 'descoberto tarde', longo: 'descobrimos o vídeo mais de 24 horas depois de publicado' };
    if (v.pub < Q.INICIO) return { k: 'nm', cod: 'antes', curto: 'antes de ' + A.dm(Q.INICIO), longo: 'a contagem diária começou em ' + A.dm(Q.INICIO) };
    var f = A.addDias(v.pub, n);
    return { k: 'nm', cod: 'fecha', fecha: f, curto: 'fecha em ' + A.dm(f), longo: 'o vídeo ainda não tem ' + n + ' dias; a medida fecha em ' + A.dm(f) };
  }
  function medidos(lista, n){ return lista.filter(function(v){ return est(v, n).k !== 'nm'; }).length; }
  var lista = C.lista.slice();
  var nMed = N ? medidos(lista, N) : 0;
  var porMult = function(a, b){ return b.m - a.m; };
  var ordenada;
  if (ordem === 'v7' || ordem === 'v30') {
    var com = lista.filter(function(v){ return est(v, N).k !== 'nm'; }).sort(function(a, b){ return est(b, N).val - est(a, N).val; });
    var sem = lista.filter(function(v){ return est(v, N).k === 'nm'; }).sort(porMult);
    ordenada = { medidos: com, sem: sem, lista: com.concat(sem) };
  } else if (ordem === 'vpd') { ordenada = { lista: lista.slice().sort(function(a, b){ return (b.vpd || -1) - (a.vpd || -1); }) };
  } else if (ordem === 'recent') { ordenada = { lista: lista.slice().sort(function(a, b){ return a.pub < b.pub ? 1 : -1; }) };
  } else {
    var fases = [['est', 'Estourando agora', 'Até 30 dias e views por dia acima do normal do canal.'], ['rec', 'Recentes', 'Até 90 dias.'], ['sem', 'Sem ritmo medido', 'Canal com sincronização atrasada ou ainda buscando vídeos.']];
    ordenada = { grupos: fases.map(function(f){ return { id: f[0], t: f[1], d: f[2], l: lista.filter(function(v){ return v.f === f[0]; }).sort(porMult) }; }).filter(function(g){ return g.l.length; }) };
    ordenada.lista = [].concat.apply([], ordenada.grupos.map(function(g){ return g.l; }));
  }
  var MAX = { 7: 1, 30: 1 }; [7, 30].forEach(function(n){ lista.forEach(function(v){ var e = est(v, n); if (e.k !== 'nm' && e.val > MAX[n]) MAX[n] = e.val; }); }); /* cada coluna tem a sua escala: o maior da lista naquela idade */

  /* ---------------------------------------------------------------- peças */
  var IC = {
    live: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="1.8"/><path d="M4.7 4.7a4.7 4.7 0 0 0 0 6.6M11.3 4.7a4.7 4.7 0 0 1 0 6.6"/></svg>',
    down: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 2h8L5 8.5z"/></svg>',
    hist: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5h11M4 11l3-3.5 2.5 2 3-4.5"/></svg>',
    ext: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M11.5 9.5v4h-9v-9h4"/></svg>',
    lock: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.6"/><path d="M5.2 7V5.4a2.8 2.8 0 0 1 5.6 0V7"/></svg>',
    busca: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6"/><path d="M10.4 10.4 14 14M5 7h4"/></svg>'
  };
  var SH = { base: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.3"/></svg>', mid: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.8"/></svg>',
    high: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .8 11.2 6 6 11.2.8 6Z"/></svg>', top: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .4 10.85 8.8H1.15ZM6 11.6 1.15 3.2h9.7Z"/></svg>' };
  function tier(m){ return m >= 10 ? 'top' : m >= 5 ? 'high' : m >= 2 ? 'mid' : 'base'; }
  var TIERN = { base: 'abaixo de 2×', mid: 'de 2× a menos de 5×', high: 'de 5× a menos de 10×', top: '10× ou mais' };
  function selo(){ return '<span class="q-selo">' + IC.live + 'ao vivo ou estreia</span>'; }
  function idadeDias(v){ return A.dias(v.pub, C.hoje); }
  function dm(d){ return A.dm(d); }

  function celMult(v){
    var t = tier(v.m), pos = Math.min(100, Math.log(Math.max(v.m, 1)) / Math.log(50) * 100), acima = v.m > 50;
    var txt = A.dec(v.m, v.m >= 10 ? 0 : 1) + '×';
    return '<span class="q-mx ' + t + '" role="img" aria-label="' + esc(txt + ', ' + TIERN[t] + (acima ? ', além do fim da régua de 50×' : '')) + '">' + SH[t] + txt + '</span>' +
      '<span class="q-rg" aria-hidden="true">' + [17.7, 41.1, 58.9].map(function(p){ return '<i style="left:' + p + '%"></i>'; }).join('') + '<b class="' + t + '" style="left:' + pos.toFixed(1) + '%"></b></span>' +
      '<span class="q-mb">' + (acima ? '<span class="q-ov">passa de 50×</span> · ' : '') + 'contra ' + v.b + ' vídeos do canal</span>';
  }
  function celV(v, n){
    if (C.erro) return '<span class="q-er" role="img" aria-label="não carregou: as views aos ' + n + ' dias não puderam ser lidas agora">' + L.IC.aviso + 'não carregou</span>';
    var e = est(v, n);
    if (e.k === 'com') return '<div class="q-vv"><span class="q-vn" title="' + esc(A.n(e.val) + ' views aos ' + n + ' dias') + '">' + A.mil(e.val) + '</span><span class="q-bar" aria-hidden="true"><i style="width:' + Math.max(1.5, e.val / MAX[n] * 100).toFixed(1) + '%"></i></span></div>';
    if (e.k === 'zero') return '<span class="q-z" role="img" aria-label="zero medido: o vídeo tinha 0 views aos ' + n + ' dias">0</span><span class="q-zt">zero medido</span>';
    return '<span class="q-nm" role="img" aria-label="' + esc('não medido: ' + e.longo) + '"><i class="nm-h" aria-hidden="true"></i><b>não medido</b><span>' + e.curto + '</span></span>';
  }
  function linha(v){
    var d = idadeDias(v), on7 = N === 7, on30 = N === 30;
    return '<tr data-id="' + v.id + '"><td class="cv"><div class="q-vd"><span class="q-th" aria-hidden="true" style="background:' + L.cor(v.t) + '"><i>' + A.dur(v.dur) + '</i></span><div><h3 class="q-ti" title="' + esc(v.t) + '">' + esc(v.t) + '</h3>' +
      '<div class="q-wh"><span class="q-ch">' + esc(v.c) + '</span><span class="q-ni">' + v.n + '</span>' + (v.live ? selo() : '') + '</div>' +
      (v.live ? '<div class="q-wh"><span>não conta no normal do canal</span></div>' : '') + '</div></div></td>' +
      '<td data-l="Multiplicador">' + celMult(v) + '</td>' +
      '<td class="q-dd" data-l="Views por dia">' + (v.vpd == null ? '<span class="q-pd"><small>sem views por dia recentes</small></span>' : '<span class="q-pd">' + A.mil(v.vpd) + '/dia</span>') + '</td>' +
      '<td class="' + (on7 ? 'q-on' : '') + '" data-l="Views aos 7 dias">' + celV(v, 7) + '</td>' +
      '<td class="' + (on30 ? 'q-on' : '') + '" data-l="Views aos 30 dias">' + celV(v, 30) + '</td>' +
      '<td data-l="Idade"><span class="q-id" title="publicado em ' + A.dmy(v.pub) + '">' + d + ' d</span></td>' +
      '<td class="ca"><span class="q-ac"><a href="#" onclick="return false" aria-label="Ver histórico do vídeo: ' + esc(v.t) + '">' + IC.hist + '</a><a href="#" onclick="return false" aria-label="Abrir no YouTube: ' + esc(v.t) + '">' + IC.ext + '</a></span></td></tr>';
  }
  function cabecalho(){
    function th(txt, cls, aria, extra){ return '<th scope="col"' + (cls ? ' class="' + cls + '"' : '') + (aria ? ' aria-sort="descending"' : '') + '>' + (extra || '') + txt + (aria ? ' ' + IC.down : '') + '</th>'; }
    return '<thead><tr><th scope="col">Vídeo</th>' + th('Multiplicador ajustado pela idade') + th('Views por dia') +
      th('Views aos 7 dias', 'q-nv' + (N === 7 ? ' q-on' : ''), N === 7, L.tag('novo')) + th('Views aos 30 dias', 'q-nv' + (N === 30 ? ' q-on' : ''), N === 30) +
      th('Idade') + '<th scope="col"><span class="sr">Ações</span></th></tr></thead>';
  }
  function gcab(t, n, d, sub){ return '<tr class="q-g"><th colspan="7" scope="colgroup"><div class="q-gh"><span>' + esc(t) + '</span><span class="q-gn">' + n + '</span>' + (d ? '<small>' + esc(d) + '</small>' : '') + '</div></th></tr>'; }
  function tabela(){
    var corpo = '';
    if (ordenada.grupos) ordenada.grupos.forEach(function(g){ corpo += '<tbody>' + gcab(g.t, g.l.length, g.d) + g.l.map(linha).join('') + '</tbody>'; });
    else if (ordenada.medidos) {
      var nome = 'Views aos ' + N + ' dias';
      if (ordenada.medidos.length) corpo += '<tbody>' + gcab('Do maior para o menor: ' + nome.toLowerCase(), ordenada.medidos.length, 'medidas') + ordenada.medidos.map(linha).join('') + '</tbody>';
      if (ordenada.sem.length) corpo += '<tbody>' + gcab(ordenada.medidos.length ? 'Sem a medida' : 'Na ordem do multiplicador', ordenada.sem.length, ordenada.medidos.length ? 'ficam no fim, na ordem do multiplicador' : 'ainda sem ' + nome.toLowerCase()) + ordenada.sem.map(linha).join('') + '</tbody>';
    } else corpo += '<tbody>' + gcab(ordem === 'vpd' ? 'Do maior para o menor número de views por dia' : 'Do mais recente ao mais antigo', ordenada.lista.length) + ordenada.lista.map(linha).join('') + '</tbody>';
    return '<table class="q-t"><caption>Outliers: ' + ordenada.lista.length + ' vídeos</caption><colgroup><col class="c-v"><col class="c-m"><col class="c-d"><col class="c-7"><col class="c-30"><col class="c-i"><col class="c-a"></colgroup>' + cabecalho() + corpo + '</table>';
  }

  /* ---------------------------------------------------------------- cobertura (faixa de casas) */
  function motivos(n){
    var cont = { antes: 0, tarde: 0, fecha: [] };
    ordenada.lista.forEach(function(v){ var e = est(v, n); if (e.cod === 'antes') cont.antes++; else if (e.cod === 'tarde') cont.tarde++; else if (e.cod === 'fecha') cont.fecha.push(e.fecha); });
    cont.fecha.sort();
    var out = [];
    if (cont.antes) out.push(cont.antes + ' antes de ' + dm(Q.INICIO));
    if (cont.fecha.length) { var u = cont.fecha.filter(function(d, i, a){ return a.indexOf(d) === i; }); out.push(cont.fecha.length + (cont.fecha.length === 1 ? ' fecha em ' + dm(u[0]) : u.length === 2 ? ' fecham em ' + dm(u[0]) + ' e ' + dm(u[1]) : ' fecham de ' + dm(u[0]) + ' a ' + dm(u[u.length - 1]))); }
    if (cont.tarde) out.push(cont.tarde + ' descoberto' + (cont.tarde === 1 ? '' : 's') + ' tarde');
    return { itens: out, fecha: cont.fecha };
  }
  function cobLinha(n){
    var itens = ordenada.lista.map(function(v){ return est(v, n); }), tot = itens.length, med = itens.filter(function(e){ return e.k !== 'nm'; }).length, zs = itens.filter(function(e){ return e.k === 'zero'; }).length;
    var mo = motivos(n), sem = tot - med;
    var casas = itens.map(function(e){ return '<li class="' + e.k + '">' + (e.k === 'zero' ? '0' : '') + '</li>'; }).join('');
    var aria = n + ' dias: ' + med + ' de ' + tot + ' medidos' + (zs ? ', ' + zs + ' com zero medido' : '') + (sem ? '; ' + sem + ' não medidos: ' + mo.itens.join(', ') : '') + '. Uma casa por vídeo, na ordem da lista.';
    var marca = n === N ? '<span class="q-ordm" title="a lista está nesta ordem">' + IC.down + 'ordem</span>' : '';
    var det = sem ? '<ul class="q-cm" aria-label="Por que não foram medidos">' + mo.itens.map(function(t){ return '<li><i class="nm-h" aria-hidden="true"></i>' + t + '</li>'; }).join('') + '</ul>' : '';
    return '<li class="q-cr"><span class="q-cn">' + n + ' dias' + marca + '</span><ol class="q-cs" role="img" aria-label="' + esc(aria) + '">' + casas + '</ol>' +
      '<span class="q-cc"><b>' + med + ' de ' + tot + '</b> medidos' + (zs ? ' (' + zs + ' com zero medido)' : '') + '</span>' + det + '</li>';
  }
  function regua(){
    if (!N) return '';
    var m = motivos(N); if (!m.fecha.length) return '';
    var ini = C.hoje, fim = m.fecha[m.fecha.length - 1], span = Math.max(1, A.dias(ini, fim));
    var marcas = m.fecha.map(function(d){ var p = A.dias(ini, d) / span * 100; return '<svg class="q-tl-m" style="left:' + p.toFixed(1) + '%" viewBox="0 0 8 16" aria-hidden="true"><rect x="2" y="1" width="4" height="14" rx="1"/></svg>'; }).join('');
    var faltam = A.dias(ini, m.fecha[0]);
    var aria = 'Régua do tempo: hoje, ' + dm(ini) + '; passam a ter a medida de ' + N + ' dias em ' + m.fecha.map(dm).join(', ') + '.';
    var un = m.fecha.filter(function(d, i, a){ return a.indexOf(d) === i; }), rot = un.length <= 3 ? un : [un[0], un[un.length - 1]];
    var labels = rot.map(function(d){ return '<span class="q-tl-l" style="left:' + (A.dias(ini, d) / span * 100).toFixed(1) + '%">' + dm(d) + '</span>'; }).join('');
    return '<div class="q-tl"><span class="q-tl-t">Quando fecham</span><div class="q-tl-b" role="img" aria-label="' + esc(aria) + '"><i class="q-tl-hj"></i>' + marcas +
      '<span class="q-tl-l i"><b>hoje</b> ' + dm(ini) + '</span>' + labels + '</div></div>';
  }
  function infoM1(){
    return A.oculto('infoM1', 'Como contamos as views aos 7 e aos 30 dias',
      '<ul><li><b>Conta:</b> as views do vídeo no instante “publicação + 7 dias” (ou + 30), por interpolação linear entre as duas leituras vizinhas. Todo vídeo é medido na mesma idade, então um vídeo de 9 dias pode ser comparado com um de 52.</li>' +
      '<li><b>Fonte:</b> cálculo do Observatório sobre dados públicos do YouTube.</li>' +
      '<li><b>Viés:</b> interpolar entre leituras espaçadas subestima a subida inicial; o horário da publicação e o fim de semana pesam mais aos 7 dias do que aos 30.</li>' +
      '<li><b>Não medido:</b> “antes de ' + dm(Q.INICIO) + '” (a contagem diária começou em ' + dm(Q.INICIO) + '); “fecha em dd/mm” (o vídeo ainda não tem a idade); “descoberto tarde” (descobrimos o vídeo mais de 24 horas depois de publicado); ou leituras vizinhas muito distantes (mais de 36 horas).</li>' +
      '<li><b>Quando passa a existir:</b> aos 7 dias desde 10/10/2026 e aos 30 dias desde 02/11/2026, para os 39 vídeos publicados desde ' + dm(Q.INICIO) + '.</li>' +
      '<li><b>Ao vivo ou estreia:</b> fica fora do cálculo do normal do canal (as medianas de views na idade, de curva por idade e de engajamento). O vídeo continua na lista, com o selo.</li>' +
      '<li><b>Zero medido:</b> o vídeo existia, mas tinha 0 views naquela idade; por exemplo, ficou privado ou agendado e foi liberado depois. Não é o mesmo que “não medido”, que quer dizer que não temos a leitura.</li></ul>');
  }
  function cobertura(){
    if (C.erro || C.vazio) return '';
    return '<section class="q-cob c2-novo" aria-label="Quantos outliers têm as views na mesma idade">' + L.tag('novo') +
      '<div class="q-cob-h"><b>Views na mesma idade</b>' + A.ibtn('infoM1', 'Como contamos as views aos 7 e aos 30 dias') + '</div>' +
      '<ul class="q-cb">' + cobLinha(7) + cobLinha(30) + '</ul>' + regua() +
      '<ul class="q-leg" aria-label="Legenda"><li><i class="q-sw com" aria-hidden="true"></i>medido</li><li><i class="q-sw zero" aria-hidden="true"></i>zero medido: o vídeo tinha 0 views naquela idade</li><li><i class="q-sw nm" aria-hidden="true"></i>não medido: o motivo vem abaixo da faixa</li></ul></section>';
  }

  /* ---------------------------------------------------------------- controles, frase e linha do selo */
  function controles(){
    var ordLabels = { mult: 'Multiplicador (padrão)', vpd: 'Views por dia', recent: 'Mais recente' };
    function opt(v, t, dis){ return '<option value="' + v + '"' + (ordem === v ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + t + '</option>'; }
    var tot = C.lista.length, o7 = C.erro ? 'Views aos 7 dias (indisponível agora)' : 'Views aos 7 dias: ' + (tot ? medidos(C.lista, 7) + ' de ' + tot + ' medidos' : 'sem vídeos'),
        o30 = C.erro ? 'Views aos 30 dias (indisponível agora)' : 'Views aos 30 dias: ' + (tot ? medidos(C.lista, 30) + ' de ' + tot + ' medidos' : 'sem vídeos');
    var n1 = C.vazio ? 0 : C.lista.length;
    var idade = C.vazio
      ? '<span data-on>Até 30 dias <span class="q-n">0</span></span><span>31–90 d <span class="q-n">0</span></span><span>Todos <span class="q-n">4</span></span>'
      : '<span data-on>' + C.janela + ' <span class="q-n">' + n1 + '</span></span><span>31–90 d <span class="q-n">6</span></span><span>Todos <span class="q-n">18</span></span>';
    var fmt = C.fmt === 'Shorts' ? '<span>Longos</span><span data-on>Shorts</span>' : '<span data-on>Longos</span><span>Shorts</span>';
    return '<section class="q-ctl" aria-label="Filtros"><div class="q-grp" aria-hidden="true">' + idade + '</div><div class="q-grp" aria-hidden="true">' + fmt + '</div>' +
      (C.leitura ? '<span class="q-ro" role="note">' + IC.lock + '<b>Só leitura</b><span>nada nesta tela precisa de permissão para ser lido</span></span>' : '') +
      '<div class="q-ord c2-novo">' + L.tag('2 opções novas') + '<label for="q-ord">Ordenar por</label><select id="q-ord" class="q-sel">' +
      opt('mult', ordLabels.mult) + opt('v7', o7, C.erro) + opt('v30', o30, C.erro) + opt('vpd', ordLabels.vpd) + opt('recent', ordLabels.recent) + '</select></div></section>';
  }
  function frase(){
    var n = C.lista.length, tot = C.total, b = function(x){ return '<b>' + x + '</b>'; };
    var fmtTxt = C.fmt === 'Shorts' ? 'Shorts' : 'vídeos longos', jan = C.janela.toLowerCase();
    if (C.vazio) return '<p class="q-fr"><span>' + b('0 outliers') + ' entre ' + b(tot) + ' ' + fmtTxt + ' com ' + jan + ': nenhum passa de 2× o normal do canal.</span></p>';
    if (C.erro) return '<p class="q-fr"><span>' + b(n + ' outliers') + ' entre ' + b(tot) + ' ' + fmtTxt + ' com ' + jan + ', agrupados por fase. As views aos 7 e aos 30 dias ' + b('não carregaram') + ' agora.</span></p>';
    if (N) {
      var com = ordenada.medidos.length, sem = n - com, zs = ordenada.medidos.filter(function(v){ return est(v, N).k === 'zero'; }).length;
      var nome = 'views aos ' + N + ' dias';
      if (!com) { var m = motivos(N), f1 = m.fecha[0];
        return '<p class="q-fr"><span>' + b('Nenhum') + ' dos ' + n + ' outliers tem ' + nome + ' ainda: ' + (f1 ? 'a primeira medida fecha em ' + b(dm(f1)) + (A.dias(C.hoje, f1) === 1 ? ' (falta 1 dia)' : ' (faltam ' + A.dias(C.hoje, f1) + ' dias)') : 'nenhuma vai fechar') + '. Enquanto isso, a lista segue o multiplicador.</span></p>'; }
      var plur = function(x, um, varios){ return x === 1 ? um : varios; };
      return '<p class="q-fr"><span>Do maior para o menor número de ' + nome + ': ' + b(com + ' de ' + n) + ' ' + plur(n, 'outlier', 'outliers') + ' ' + plur(com, 'já tem', 'já têm') + ' essa medida' + (zs ? ' (' + zs + ' com ' + b('zero medido') + ')' : '') + (sem ? '; ' + plur(sem, 'o outro ', 'os outros ') + b(sem) + ' ' + plur(sem, 'fica', 'ficam') + ' no fim, na ordem do multiplicador' : '') + '.</span></p>';
    }
    if (ordem === 'vpd') return '<p class="q-fr"><span>' + b(n + ' outliers') + ', do maior para o menor número de views por dia.</span></p>';
    if (ordem === 'recent') return '<p class="q-fr"><span>' + b(n + ' outliers') + ', do mais recente ao mais antigo.</span></p>';
    return '<p class="q-fr"><span>' + b(n + ' outliers') + ' entre ' + b(tot) + ' ' + fmtTxt + ' com ' + jan + ', agrupados por fase.</span></p>';
  }
  function linhaSelo(){
    if (C.vazio) return '';
    var viu = ordenada.lista.filter(function(v){ return v.live; }).length;
    return '<p class="q-fl">' + selo() + '<span><b>' + C.fora + '</b> ' + (C.fora === 1 ? 'vídeo ao vivo ou estreia ficou fora' : 'vídeos ao vivo ou estreia ficaram fora') + ' do cálculo do normal do canal' +
      (viu ? '; ' + (viu === 1 ? 'um aparece' : viu + ' aparecem') + ' na lista com o selo' : '') + '.</span></p>';
  }
  function bannerErro(){
    return '<div class="q-ban" role="status">' + L.IC.aviso + '<p><b>Não deu para carregar as views aos 7 e aos 30 dias.</b> O multiplicador e a ordem por multiplicador seguem valendo; só essas duas colunas ficaram de fora.</p><button type="button" class="btn big q-tn">Tentar de novo</button></div>';
  }
  function vazio(){
    return '<div class="q-vazio" role="status">' + IC.busca + '<div><h3>Nenhum outlier para ordenar</h3><p>Sem outlier não há views aos 7 ou aos 30 dias para comparar.</p>' +
      '<div class="q-acts"><button type="button" class="btn big pri q-mult">Voltar ao multiplicador</button><button type="button" class="btn big q-nada">Ver vídeos longos</button><button type="button" class="btn big q-nada">Ampliar a idade para Todos</button></div></div></div>';
  }
  function notaVazia30(){
    if (caso !== 'nao-medido') return '';
    return '<div class="q-nota"><button type="button" class="btn big q-mult">Voltar ao multiplicador (padrão)</button><span>A lista abaixo está na ordem do multiplicador porque nenhum vídeo pode ser ordenado ainda.</span></div>';
  }
  function vizinha(){
    if (caso !== 'padrao') return '';
    return '<p class="q-viz"><span class="chip">vizinha</span><span>Aqui entra a leitura <b>“Estourou e parou”</b> na linha do vídeo com 90 dias ou mais e views aos 30 dias. A primeira só existe em 2027.</span></p>';
  }

  /* ---------------------------------------------------------------- tela e referência */
  var corpo = '<div class="q">' + L.obs({ aba: 'Outliers' }).replace('Outliers<span class="c2-ct">9</span>', 'Outliers<span class="c2-ct">' + (C.vazio ? 0 : 11) + '</span>') +
    (C.exemplo ? '<p class="exband"><span class="ex">exemplo</span><span>Esta tela mostra como fica em ' + A.dmy(C.hoje) + ', quando as views aos 30 dias já existirem. Hoje elas ainda não existem.</span></p>' : '<p class="exband"><span class="ex">exemplo</span><span>Canais, vídeos e números inventados. Hoje é 13/10/2026.</span></p>') +
    controles() + frase() + linhaSelo() + (C.erro ? bannerErro() : '') + cobertura() + notaVazia30() +
    '<div class="q-res">' + (C.vazio ? vazio() : tabela()) + vizinha() + '</div></div>' + infoM1();
  var fora = L.fora('Formas e cores desta tela', '<ul class="q-leg" style="border:0;padding:0"><li><i class="q-sw com"></i>medido: barra areia contra o maior da lista</li><li><i class="q-sw zero"></i>zero medido: caixa vazada com 0</li><li><i class="q-sw nm"></i>não medido: hachura rosa, palavra e motivo</li><li>' + selo() + '</li><li>linha tracejada “vizinha”: onde entra a leitura “Estourou e parou”, que é o mockup 14</li></ul>');
  var estados = [['padrao', 'Padrão (multiplicador, hoje)'], ['v7', '7 dias (hoje, magro)'], ['nao-medido', '30 dias, zero medidos (hoje)'], ['futuro', '30 dias em dezembro (exemplo)'], ['extremo', 'Extremo'], ['zero', 'Zero medido'], ['erro', 'Erro'], ['vazio', 'Vazio'], ['leitura', 'Só leitura']];
  A.moldura({ titulo: 'Outliers por views na mesma idade', barra: { linhas: [{ rotulo: 'Estado', itens: A.opcoes('caso', estados, 'padrao', { ordem: null }) }, { rotulo: 'Ordem', itens: A.opcoes('ordem', [['', 'a do estado'], ['mult', 'multiplicador'], ['v7', '7 dias'], ['v30', '30 dias']], '') }, A.tema()], nota: '' }, corpo: corpo, fora: fora });
  var sel = document.getElementById('q-ord');
  if (sel) sel.addEventListener('change', function(){ location.href = A.href({ ordem: sel.value }); });
  A.ligarInfos();
  /* botões da tela: só "Voltar ao multiplicador" faz algo no mockup; os outros são botões de verdade (foco, teclado) e a tela real decide o resto */
  Array.prototype.forEach.call(document.querySelectorAll('.q-mult'), function(b){ b.addEventListener('click', function(){ location.href = A.href({ ordem: 'mult' }); }); });
})();
