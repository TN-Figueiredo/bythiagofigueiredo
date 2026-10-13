/* d.js: mockup D, aviso de atraso da leitura por hora (spec 03, 4.8.5; mockup 15 do spec). O aviso vive no cabeçalho do Observatório (a faixa de frescor) e abre o painel "Leitura por hora".
   ?caso=em-dia|atraso-leve|atraso-3h|atraso-14h|varias|desligada|sem-leitura  ?tema=claro. Agora = 13/10 às 14:40 (São Paulo). Números e canais: exemplo.
   Regras do spec: a hora perdida não volta; atraso acima de 2 h é falha; tarefa desligada aparece "desligada", nunca "em dia"; tabela vazia lê "sem leitura", nunca "em dia". */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, q = A.q, esc = A.esc;
  var caso = q.get('caso') || 'atraso-3h';
  var MES = 303; /* horas de 01/10 00:00 a 13/10 14:00 (as que já passaram) */
  /* por caso: horas sem medida seguidas até agora (parada), horas fora de hora, horas sem medida no mês, estado da tarefa */
  var C = {
    'em-dia':       { parada: 0, fora: [12], semMes: 4, est: 'ok', minAtras: 40 },
    'atraso-leve':  { parada: 1, fora: [], semMes: 5, est: 'leve', minAtras: 100 },
    'atraso-3h':    { parada: 3, fora: [12], semMes: 7, est: 'atrasada', minAtras: 220 },
    'atraso-14h':   { parada: 14, fora: [], semMes: 18, est: 'atrasada', minAtras: 14 * 60 + 40 },
    'varias':       { parada: 3, fora: [12], semMes: 7, est: 'atrasada', minAtras: 220, varias: true },
    'desligada':    { parada: 20, fora: [], semMes: 24, est: 'desligada' },
    'sem-leitura':  { parada: 24, fora: [], semMes: MES, est: 'vazia' }
  };
  var c = C[caso] || C['atraso-3h'];
  function hm(min){ var h = Math.floor(min / 60), m = min % 60; return h ? h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m + ' min' : '') : m + ' min'; }
  function dur(horas){ return L.pl(horas, 'hora', 'horas'); }

  /* ---------------------------------------------------------------- a trilha das últimas 24 horas (15:00 de ontem até 14:00 de hoje) */
  function hh(h){ return (h < 10 ? '0' : '') + h + 'h'; }
  function trilha(){
    if (c.est === 'vazia') return '';
    var cel = '', rot = '', sem = [], fh = [], nOk = 0;
    for (var i = 0; i < 24; i++) {
      var h = (15 + i) % 24, estado = i >= 24 - c.parada ? 'sem' : c.fora.indexOf(i) >= 0 ? 'fh' : 'ok';
      if (estado === 'sem') sem.push(i); else if (estado === 'fh') fh.push(i); else nOk++;
      var lbl = hh(h) + (i < 9 ? ' de ontem' : ' de hoje') + ': ' + (estado === 'ok' ? 'com medida' : estado === 'fh' ? 'medida fora de hora (fica fora do mapa)' : 'sem medida');
      cel += '<li class="at-c ' + estado + '" aria-hidden="true" title="' + lbl + '"></li>';
      if (i % 3 === 0) rot += '<span class="at-l ' + (i % 6 === 0 ? 'k6' : 'k3') + '" style="grid-column:' + (i + 1) + ' / span 3">' + (h < 10 ? '0' : '') + h + 'h' + (h === 0 ? '<span class="hj"> · hoje</span>' : '') + '</span>';
    }
    var quando = function(i){ return hh((15 + i) % 24) + (i < 9 ? ' de ontem' : ' de hoje'); };
    var resumo = 'Últimas 24 horas, de 15h de ontem a 14h de hoje: ' + (sem.length ? sem.length + ' sem medida' + (sem.length > 1 ? ' (das ' + quando(sem[0]) + ' às ' + quando(sem[sem.length - 1]) + ')' : ' (' + quando(sem[0]) + ')') + '; ' : 'nenhuma sem medida; ') + (fh.length ? 'uma medida fora de hora às ' + quando(fh[0]) + '; ' : '') + nOk + ' com medida.';
    return '<div class="at-tr"><ol class="at-cs" role="img" aria-label="' + resumo + '">' + cel + '</ol><div class="at-ls" aria-hidden="true">' + rot + '</div>' +
      '<ul class="ac-leg at-leg"><li><i class="at-sw ok" aria-hidden="true"></i>com medida</li><li><i class="at-sw fh" aria-hidden="true"></i>medida fora de hora: fica fora do mapa</li><li><i class="nm-h" aria-hidden="true"></i>sem medida: a hora não volta</li></ul></div>';
  }
  /* o que faltou e o que fazer (uma linha por assunto, sob a frase) */
  function faltaTxt(){
    var n = c.parada, ate = 14, ini = ate - n + 1;
    return n === 1 ? 'a medida das ' + hh(ate) : n <= 4 ? 'as medidas de ' + Array.apply(null, Array(n)).map(function(_, k){ return hh(ini + k); }).join(', ').replace(/, ([^,]*)$/, ' e $1') : 'as medidas das ' + hh(Math.max(ini, 0)) + ' às ' + hh(ate);
  }
  function fazer(){
    var l = [];
    if (c.est === 'leve') l.push('Falta ' + faltaTxt() + '. O sistema tenta de novo a cada 20 minutos; você não precisa fazer nada.');
    if (c.est === 'atrasada') l.push((c.parada === 1 ? 'Falta ' : 'Faltam ') + faltaTxt() + '. O sistema tenta de novo a cada 20 minutos' + (c.parada >= 6 ? ', mas já são ' + dur(c.parada) + ': confira a tarefa na lista abaixo.' : '; você não precisa fazer nada.'));
    if (c.varias) l.push('Outra tarefa atrasada: retratos de comentários, desde 11/10 (14 execuções ficaram para trás).');
    return l.length ? '<ul class="at-do">' + l.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ul>' : '';
  }
  /* ---------------------------------------------------------------- a frase-resumo e o estado */
  var EST = { ok: ['ok', L.IC.ok, 'em dia'], leve: ['ok', L.IC.relogio, 'dentro do combinado'], atrasada: ['erro', L.IC.aviso, 'parada'], desligada: ['off', L.IC.pausa, 'desligada'], vazia: ['vazia', null, 'sem medida'] };
  function fr(){
    if (c.est === 'ok') return '<b>Leitura por hora em dia.</b> A última medida foi às 14:00, há ' + hm(c.minAtras) + '.';
    if (c.est === 'leve') return '<b>Leitura por hora com pequeno atraso.</b> A última medida foi às 13:00, há ' + hm(c.minAtras) + '. O combinado é no máximo 2 h.';
    if (c.est === 'atrasada') return '<b>Leitura por hora parada há ' + dur(c.parada) + '.</b> ' + L.pl(c.parada, 'hora ficou', 'horas ficaram') + ' sem medida e ' + (c.parada === 1 ? 'não volta' : 'não voltam') + ': o YouTube só mostra o total de agora.';
    if (c.est === 'desligada') return '<b>Leitura por hora desligada.</b> Nenhuma hora está sendo medida desde 12/10 às 18:00.';
    return '<b>Ainda sem medida por hora.</b> A primeira leitura é em 14/10, às 10:00. Antes disso não existe dado de hora, e isso não é zero.';
  }
  function pill(){
    var e = EST[c.est];
    if (c.est === 'vazia') return '<span class="at-p vazia">' + A.nmSw() + '<span>Sem medida</span></span>';
    return '<span class="at-p ' + e[0] + '">' + e[1] + '<span>' + e[2].charAt(0).toUpperCase() + e[2].slice(1) + '</span></span>';
  }
  /* ---------------------------------------------------------------- a cobertura do mês */
  function cobertura(){
    if (c.est === 'vazia') return '<div class="at-cob"><p class="at-ct"><b>Outubro:</b> ' + A.nm('sem medida') + ' <span class="mut">· a leitura por hora começa em 14/10</span></p></div>';
    var com = MES - c.semMes, p = com / MES;
    return '<div class="at-cob"><p class="at-ct"><b>Outubro:</b> <span class="num">' + com + ' de ' + MES + '</span> horas com medida (' + A.pct(p, 0) + '). ' + (c.semMes ? '<span class="num">' + c.semMes + '</span> sem medida.' : '') + '</p><div class="at-bar" role="img" aria-label="' + com + ' de ' + MES + ' horas com medida"><i style="width:' + (p * 100).toFixed(1) + '%"></i><b style="width:' + Math.max(1.2, 100 - p * 100).toFixed(1) + '%"></b></div></div>';
  }
  /* ---------------------------------------------------------------- a tabela de tarefas (só para quem edita) */
  function tarefas(){
    var linhas = [
      ['Leitura por hora', 'a cada hora, até 2 h de tolerância', c.est === 'ok' || c.est === 'leve' ? ['ok', 'Em dia', '13/10 às 14:00'] : c.est === 'atrasada' ? ['erro', 'Parada há ' + dur(c.parada), '13/10 às ' + (14 - c.parada < 10 ? '0' : '') + (14 - c.parada) + ':00'] : c.est === 'desligada' ? ['off', 'Desligada', '12/10 às 18:00'] : ['vazia', 'Sem medida', 'ainda não rodou']],
      ['Limpar nomes de autores de comentário', 'todo dia, até 36 h', ['ok', 'Em dia', '13/10 às 06:10']],
      ['Sincronizar canais', 'a cada 6 horas', ['ok', 'Em dia', '13/10 às 12:20']],
      ['Retratos de comentários', 'todo dia, até 36 h', c.varias ? ['erro', 'Atrasada', '11/10 às 12:20 · 14 execuções ficaram para trás'] : ['ok', 'Em dia', '13/10 às 12:25']],
      ['Somar o mapa de horas do dia', 'todo dia, até 36 h', ['ok', 'Em dia', '13/10 às 00:30']],
      ['Passada semanal do catálogo', 'toda semana, até 8 dias', ['ok', 'Em dia', '11/10 às 18:05']]
    ];
    var P = function(e){ var ic = e[0] === 'erro' ? L.IC.aviso : e[0] === 'off' ? L.IC.pausa : e[0] === 'ok' ? L.IC.ok : ''; return e[0] === 'vazia' ? '<span class="at-p vazia">' + A.nmSw() + '<span>' + e[1] + '</span></span>' : '<span class="at-p ' + e[0] + '">' + ic + '<span>' + e[1] + '</span></span>'; };
    return '<details class="at-det"' + (c.varias || c.parada >= 6 && c.est === 'atrasada' ? ' open' : '') + '><summary>Todas as tarefas da agenda (' + linhas.length + ')</summary><div class="tbw"><table class="tb at-tab"><caption class="sr">Tarefas da agenda e o estado de cada uma</caption><thead><tr><th scope="col">Tarefa</th><th scope="col">Combinado</th><th scope="col">Estado</th><th scope="col">Última execução completa</th></tr></thead><tbody>' +
      linhas.map(function(l){ return '<tr><th scope="row">' + l[0] + '</th><td class="mut">' + l[1] + '</td><td>' + P(l[2]) + '</td><td class="num">' + l[2][2] + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
  }
  var AJUDA = A.oculto('infoAt', 'Como a leitura por hora é medida', '<ul><li><b>O que é:</b> toda hora cheia o sistema anota o total de views e curtidas de cada vídeo. A diferença entre duas horas é o que o mapa de horas mostra.</li><li><b>Hora perdida não volta:</b> o YouTube só mostra o total de agora. Se uma hora falhou, o mapa fica sem ela.</li><li><b>Medida fora de hora:</b> leitura feita aos 20 ou 40 minutos. Fica guardada, mas não entra no mapa.</li><li><b>Quando vira aviso:</b> mais de 2 horas sem medida. Antes disso a tela só informa.</li><li><b>Desligada:</b> a tarefa foi tirada da agenda de propósito. Nunca aparece como “em dia”.</li></ul>');

  /* ---------------------------------------------------------------- a faixa de frescor do cabeçalho */
  function fresh(){
    var e = EST[c.est], cls = c.est === 'atrasada' ? 'erro' : c.est === 'desligada' ? 'off' : c.est === 'vazia' ? 'vazia' : 'ok';
    var txt = c.varias ? '2 tarefas atrasadas' : c.est === 'atrasada' ? 'Leitura por hora parada há ' + dur(c.parada) : c.est === 'desligada' ? 'Leitura por hora desligada' : c.est === 'vazia' ? 'Leitura por hora: sem medida' : 'Leitura por hora em dia';
    var ic = c.est === 'atrasada' ? L.IC.aviso : c.est === 'desligada' ? L.IC.pausa : c.est === 'vazia' ? A.nmSw() : c.est === 'leve' ? L.IC.relogio : L.IC.ok;
    return '<span class="c2-fresh at-fresh ' + cls + '"><span class="c2-fs"><i class="c2-dot"></i><b>7 canais</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há 3 h</span><i class="c2-sp"></i><span class="c2-fs">todos em dia</span><i class="c2-sp"></i>' + L.novo('<span class="c2-fs at-fs ' + cls + '">' + ic + '<b>' + txt + '</b></span>', 'novo', 'at-fn') + L.IC.chev + '</span>';
  }
  /* ---------------------------------------------------------------- um pedaço da Lista de Canais, para o aviso ter o contexto real */
  function lista(){
    var rows = [['Nômade Raiz', '2,1 mi', '2,3', '2,18 mil', '3,4×'], ['Lucas Bigodinho', '325 mil', '1,2', '1,06 mil', '2,6×'], ['Dale Philip', '3,7 mi', '0,6', '175', '1,8×']];
    return '<div class="c2-tbw"><table class="tl" aria-label="Canais acompanhados (trecho)"><thead><tr><th scope="col">Canal</th><th scope="col">Ritmo</th><th scope="col" class="r">Views/dia</th><th scope="col">Outliers</th><th scope="col">Sincronização</th></tr></thead><tbody>' +
      rows.map(function(r){ return '<tr><td><div class="ch"><span class="av" aria-hidden="true">' + r[0].slice(0, 2) + '</span><div><a class="cn" href="#" onclick="return false">' + r[0] + '</a><div class="c2-sub"><span class="c2-nicho">Viagem</span><span class="num">' + r[1] + '</span></div></div></div></td><td><span class="num c2-big">' + r[2] + '</span> <span class="mut c2-u">longos/sem</span></td><td class="r"><span class="num c2-big">' + r[3] + '</span></td><td><b class="num">' + r[4] + '</b></td><td><div class="c2-st"><span class="c2-dot" aria-hidden="true"></span>Sincronizado há 3 h</div></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  var painel = L.novo('<div class="at"><div class="at-top">' + pill() + '<p class="at-fr">' + fr() + ' ' + A.ibtn('infoAt', 'Como a leitura por hora é medida', true) + '</p></div>' + fazer() + trilha() + cobertura() + tarefas() + '</div>' + AJUDA, 'novo', 'at-n');
  var CASOS = [['em-dia', 'Em dia'], ['atraso-leve', 'Atraso pequeno (1 h 40)'], ['atraso-3h', 'Parada há 3 horas'], ['atraso-14h', 'Parada há 14 horas'], ['varias', 'Duas tarefas atrasadas'], ['desligada', 'Desligada'], ['sem-leitura', 'Ainda sem medida']];
  var barra = L.barra([{ rotulo: 'Estado', param: 'caso', itens: CASOS, padrao: 'atraso-3h' }],
    'Contorno verde-água e “+ novo” = o acréscimo: o aviso na faixa de frescor do cabeçalho e o painel “Leitura por hora” logo abaixo. O resto é o cabeçalho e a Lista de Canais já aprovados (trecho). O aviso só aparece para quem edita. Agora = 13/10 às 14:40; dados de exemplo.');
  A.moldura({ titulo: 'Aviso de atraso da leitura por hora', barra: barra, corpo: L.obs({ aba: 'Canais', fresh: fresh() }) + painel + '<div style="margin-top:16px">' + lista() + '</div>',
    fora: '<div class="tbw" style="max-width:860px"><table class="tb"><caption>Quando o aviso aparece</caption><thead><tr><th scope="col">Situação</th><th scope="col">Faixa do cabeçalho</th><th scope="col">Nunca vira</th></tr></thead><tbody>' +
      '<tr><th scope="row">até 2 horas sem medida</th><td>só informa (“em dia” ou “dentro do combinado”)</td><td>alarme</td></tr>' +
      '<tr><th scope="row">mais de 2 horas sem medida</th><td>aviso de erro, com as horas perdidas</td><td>“em dia”</td></tr>' +
      '<tr><th scope="row">tarefa desligada de propósito</th><td>“desligada”, com a data</td><td>“em dia”</td></tr>' +
      '<tr><th scope="row">agenda sem nenhuma execução</th><td>“sem medida”, com a data em que começa</td><td>“em dia” ou zero</td></tr></tbody></table></div>' });
  A.ligarInfos();
})();
