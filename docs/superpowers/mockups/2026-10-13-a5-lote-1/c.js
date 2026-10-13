/* c.js: mockup C, canal de concorrente com problema, na Lista de Canais (a tela de c2-trocas.html, aprovada; colunas de apps/web/.../_canais/channel-table.tsx).
   ?caso=nenhum|2h|2d|9d|tres   ?acao=falhou|ocupado|cota|ok (o que o botão "Sincronizar agora" mostrou; vale para o canal em foco)   ?tema=claro
   Agora = 13/10 14:32. RODADA 2, o que o sistema faz de verdade: menos de 12 h = tentando de novo (alarme do sistema desligado); de 12 h ao 3º dia = alarme do sistema ligado (cron vermelho);
   ao cruzar o 3º dia o alarme volta ao verde, o dono recebe UM e-mail e depois um lembrete por semana enquanto durar, e o canal continua marcado "em erro" na lista. Nomes e números: exemplo. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, q = A.q, esc = A.esc;
  var caso = q.get('caso') || '9d', acao = q.get('acao') || '';
  var NOW = 'agora às 14:32';
  var CH = [
    { id: 'nomade', nome: 'Nômade Raiz', ins: 2080000, rit: [2, 2, 1, 2, 3, 2, 2, 1, 2, 2, 3, 2, 2], pw: '2,3', vpd: '2,18 mil', vn: 14, out: '3,4×', outn: '2 vídeos', cr: '+1,8%', tt: 6, sy: 'há 3 h' },
    { id: 'lucas', nome: 'Lucas Bigodinho', ins: 325000, rit: [1, 1, 2, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1], pw: '1,2', vpd: '1,06 mil', vn: 14, out: '2,6×', outn: '1 vídeo', cr: '+0,9%', tt: 4, sy: 'há 3 h' },
    { id: 'dale', nome: 'Dale Philip', ins: 3740000, rit: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0], pw: '0,6', vpd: '175', vn: 10, out: '1,8×', outn: 'nenhum', cr: '+0,3%', tt: 0, sy: 'há 3 h' },
    { id: 'vou', nome: 'Vou sem volta', ins: 593000, rit: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1], pw: '0,8', vpd: '147', vn: 12, out: '2,2×', outn: '1 vídeo', cr: '−0,4%', tt: 2, sy: 'há 3 h' },
    { id: 'paddy', nome: 'Paddy Doyle', ins: 341000, rit: [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1], pw: '0,9', vpd: '118', vn: 13, out: '1,6×', outn: 'nenhum', cr: '+0,6%', tt: 3, sy: 'há 3 h' },
    { id: 'leo', nome: 'Leo Khev', ins: 1530, rit: [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0], pw: '0,3', vpd: '31', vn: 8, out: '1,4×', outn: 'nenhum', cr: '+1,3%', tt: 0, sy: 'há 4 h' },
    { id: 'proprio', nome: 'tnFigueiredo', ins: 1160, own: true, rit: [0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], pw: '0,4', vpd: '20', vn: 6, out: '1,3×', outn: 'nenhum', cr: '+0,8%', tt: 0, sy: 'há 2 h' }
  ];
  var por = {}; CH.forEach(function(c){ por[c.id] = c; });
  /* quem está em erro em cada caso: horas desde o começo do erro e o motivo */
  var ERROS = { nenhum: {}, '2h': { dale: [2, 'demora'] }, '2d': { paddy: [49, 'demora'] }, '9d': { lucas: [219, '404'] }, tres: { lucas: [219, '404'], paddy: [49, 'demora'], dale: [2, 'demora'] } }[caso] || {};
  var MOT = {
    '404': { t: 'O YouTube diz que este canal não existe (erro 404).', d: 'Pode ter sido apagado ou ter mudado de endereço. Confira no YouTube e, se ele não existe mais, remova da lista.', quem: 'voce' },
    'demora': { t: 'O YouTube demorou demais para responder.', d: 'Costuma passar sozinho. Nada a fazer por enquanto.', quem: 'sozinho' },
    'cota': { t: 'A cota diária do YouTube acabou.', d: 'Volta às 04:00 (horário de São Paulo). Vale para todos os canais; não é problema deste.', quem: 'sozinho' }
  };
  function estagio(h){ return h < 12 ? 'novo' : h < 72 ? 'alarme' : 'aviso'; }
  var AGORA = Date.UTC(2026, 9, 13, 14, 32);
  function inicioDia(h){ return new Date(AGORA - h * 36e5).toISOString().slice(0, 10); }
  /* os e-mails: um ao cruzar o 3º dia (dia em que o erro começou + 3) e um por semana a partir dele */
  function emails(h){ var d3 = A.addDias(inicioDia(h), 3); if (d3 > L.HOJE) return { ult: null, prox: d3, primeiro: d3 }; var u = d3; while (A.addDias(u, 7) <= L.HOJE) u = A.addDias(u, 7); return { ult: u, prox: A.addDias(u, 7), primeiro: d3 }; }
  function lc(t){ return t.charAt(0).toLowerCase() + t.slice(1); }
  function fraseEmail(h){
    var m = emails(h), s = estagio(h);
    if (s === 'novo') return 'Tentando de novo às 18:00; ainda não avisamos você.';
    if (s === 'alarme') return 'Se continuar, avisamos você por e-mail em ' + A.dm(m.prox) + '.';
    return m.ult === m.primeiro ? 'Avisamos você por e-mail em ' + A.dm(m.ult) + '; próximo lembrete em ' + A.dm(m.prox) + ', depois toda semana até resolver.' : 'Último e-mail em ' + A.dm(m.ult) + '; próximo lembrete em ' + A.dm(m.prox) + ', depois toda semana até resolver.';
  }
  function idade(h){ return h < 24 ? L.pl(h, 'hora', 'horas') : L.pl(Math.floor(h / 24), 'dia', 'dias'); }
  function desde(h){ var m = 13 * 24 * 60 + 14 * 60 + 32 - h * 60, dia = Math.floor(m / 1440), r = m % 1440; return (dia < 10 ? '0' : '') + dia + '/10 às ' + L.hm(Math.floor(r / 60), r % 60); }
  var emErro = CH.filter(function(c){ return ERROS[c.id]; });
  var foco = q.get('canal') && ERROS[q.get('canal')] ? q.get('canal') : (emErro.length ? emErro.slice().sort(function(a, b){ return ERROS[b.id][0] - ERROS[a.id][0]; })[0].id : null);

  /* "Deu certo": o canal sai do erro e a lista, o contador e o resumo saem com ele */
  var focoE = foco ? ERROS[foco] : null;
  if (acao === 'ok' && foco) { delete ERROS[foco]; por[foco].sy = 'agora, às 14:32'; emErro = CH.filter(function(c){ return ERROS[c.id]; }); }
  /* ---------------------------------------------------------------- as formas dos três estágios (a mesma família de cor; muda a forma e o texto) */
  function pastilha(c){
    var e = ERROS[c.id], h = e[0], s = estagio(h);
    var ic = s === 'aviso' ? L.IC.envelope : s === 'novo' ? L.IC.relogio : L.IC.aviso;
    return '<span class="er-p ' + s + '">' + ic + '<span>' + (s === 'novo' ? 'Erro há ' : 'Em erro há ') + idade(h) + '</span></span>';
  }
  /* linha 1 (até 2 linhas de texto): quem resolve + motivo; linha 2: o e-mail (curto) */
  function linhaMotivo(c){
    var e = ERROS[c.id], m = MOT[e[1]], s = estagio(e[0]);
    if (m.quem === 'voce') return '<span class="er-quem voce"><i class="er-qs" aria-hidden="true"></i>Precisa de você:</span> ' + lc(m.t);
    if (s === 'novo') return '<span class="er-quem sozinho"><i class="er-qs" aria-hidden="true"></i>Passa sozinho:</span> ' + lc(m.t);
    return m.t + ' Já são ' + idade(e[0]) + '.';
  }
  function linhaEmail(h){
    var m = emails(h), s = estagio(h);
    if (s === 'novo') return 'Tentando de novo às 18:00';
    if (s === 'alarme') return 'Se continuar, e-mail em ' + A.dm(m.prox);
    return 'E-mail em ' + A.dm(m.ult) + ' · próximo em ' + A.dm(m.prox);
  }
  function botaoSync(c, cls){
    var foi = c.id === foco, bloq = foi && (acao === 'cota' || acao === 'ocupado');
    var txt = foi && acao === 'cota' ? 'Volta às 04:00' : foi && acao === 'ocupado' ? 'Sincronizando…' : 'Sincronizar agora';
    return L.novo('<span class="btn er-btn" role="button" tabindex="' + (bloq ? '-1' : '0') + '"' + (bloq ? ' aria-disabled="true"' : '') + '>' + L.IC.sync + txt + '</span>', 'novo', 'er-bn ' + cls);
  }
  function celSync(c){
    var e = ERROS[c.id];
    if (!e) return '<div class="c2-st"><span class="c2-dot" aria-hidden="true"></span>Sincronizado ' + c.sy + '</div>';
    return '<div class="er-cel">' + pastilha(c) + '<span class="er-mot">' + linhaMotivo(c) + '</span><span class="er-sub">' + linhaEmail(e[0]) + '</span>' + botaoSync(c, 'er-bn-m') + '</div>';
  }
  /* ---------------------------------------------------------------- a tabela (as colunas de produção) */
  function strip(c){ var s = '<svg class="c2-strip" width="104" height="26" viewBox="0 0 104 26" role="img" aria-label="Uploads por semana nas últimas 13 semanas">'; c.rit.forEach(function(n, i){ var x = i * 8; s += n ? '<rect x="' + x + '" y="' + (26 - Math.min(n, 3) * 7) + '" width="5" height="' + Math.min(n, 3) * 7 + '" rx="1" class="b"/>' : '<rect x="' + x + '" y="24" width="5" height="2" class="z"/>'; }); return s + '</svg>'; }
  function tabela(){
    var th = function(t, u, cls, ord){ return '<th scope="col" class="' + (cls || '') + '">' + (ord == null ? t : '<span class="c2-sb">' + t + ' <span class="c2-ar" aria-hidden="true">' + ord + '</span></span>') + (u ? '<span class="c2-u2">' + u + '</span>' : '') + '</th>'; };
    return '<div class="c2-tbw"><table class="tl c2-tl er-t" aria-label="Canais acompanhados"><thead><tr>' + th('<span class="sr">Posição</span>', '', 'c2-pos') + th('Canal', 'nicho e inscritos', '', '') + th('Ritmo', 'uploads por semana, 13 sem', '', '') + th('Views/dia', 'mediana nos longos', 'r', '▼') + th('Outliers', '2× ou mais, até 90 dias', '', '') + th('Trocas', 'título e thumbnail, 30 d', '', '') + th('Crescimento', 'inscritos, 30 d', 'r', '') + th('Sincronização', 'e vídeos acompanhados', '', '') + th('Com o meu canal', '', 'c2-cmpc') + '<th scope="col"><span class="sr">Ações</span></th></tr></thead><tbody>' +
      CH.map(function(c, i){
        var neg = c.cr.charAt(0) === '−', er = ERROS[c.id];
        return '<tr data-canal="' + c.id + '" class="' + (er ? 'er-lin ' + estagio(er[0]) : '') + '"><td class="c2-pos num" data-l="Posição">' + (i + 1) + 'º</td><td data-l="Canal" class="c2-tdc"><div class="ch"><span class="av" aria-hidden="true">' + esc(c.nome.slice(0, 2)) + '</span><div><div><a class="cn" href="#" onclick="return false">' + esc(c.nome) + '</a>' + (c.own ? ' <span class="chip own">seu canal</span>' : '') + '</div><div class="c2-sub"><span class="c2-nicho">Viagem</span><span class="num">' + A.mil(c.ins) + '</span></div></div></div></td>' +
          '<td data-l="Ritmo"><div class="c2-cad">' + strip(c) + '<span><span class="num c2-big">' + c.pw + '</span> <span class="mut c2-u">longos/sem</span></span></div></td><td class="r" data-l="Views/dia"><span class="num c2-big">' + c.vpd + '</span><span class="c2-cap">n = ' + c.vn + '</span></td>' +
          '<td data-l="Outliers"><span class="c2-out"><b class="num ' + (parseFloat(c.out.replace(',', '.')) >= 2 ? 'm' : '') + '">' + c.out + '</b> <span class="c2-cap" style="display:inline">' + c.outn + '</span></span></td><td data-l="Trocas" class="c2-tdt"><span class="num c2-big">' + c.tt + '</span> <span class="mut c2-u">' + (c.tt === 1 ? 'troca' : 'trocas') + '</span></td>' +
          '<td class="r" data-l="Crescimento"><span class="num c2-big ' + (neg ? 'dn' : 'up') + '">' + (neg ? '▼ ' : '▲ ') + c.cr + '</span><span class="c2-cap">em 30 d</span></td><td data-l="Sincronização" class="er-td">' + celSync(c) + '</td>' +
          '<td class="c2-cmpc" data-l="Com o meu canal">' + (c.own ? '<span aria-hidden="true" class="mut">–</span><span class="sr">seu canal, sem comparação</span>' : '<a class="c2-cmp" href="#" onclick="return false" aria-label="Comparar ' + esc(c.nome) + ' com o meu canal">Comparar</a>') + '</td><td class="c2-act"><div class="er-act">' + (er ? botaoSync(c, 'er-bn-d') : '') + '<button type="button" class="c2-more" aria-label="Mais ações para ' + esc(c.nome) + '">' + L.IC.dots + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function ferramentas(){
    var chip = L.novo('<span class="er-chipf' + (emErro.length ? '' : ' zero') + '">' + L.IC.aviso + '<span>Em erro</span><b class="num">' + emErro.length + '</b></span>', 'novo', 'er-fn');
    return '<div class="c2-tool"><span class="c2-busca"><svg class="i" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>Buscar canal</span><span class="c2-seg"><b>Todos</b><span>Longos</span><span>Shorts</span></span><span class="c2-seg"><b>Absoluto</b><span>Por mil inscritos</span></span><span class="c2-seg"><b>Tabela</b><span>Cards</span></span>' + chip + '<span class="c2-gap"></span><span class="ex">números de exemplo</span><span class="c2-quota"><span class="num">7</span> de <span class="num">20</span> canais</span></div>';
  }
  /* ---------------------------------------------------------------- o cabeçalho (faixa de frescor) e o resumo */
  function fresh(){
    if (!emErro.length) return null;
    var pior = emErro.slice().sort(function(a, b){ return ERROS[b.id][0] - ERROS[a.id][0]; })[0];
    return '<span class="c2-fresh er-fresh"><span class="c2-fs"><i class="c2-dot"></i><b>7 canais</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há 3 h</span><i class="c2-sp"></i>' + L.novo('<span class="c2-fs er-fs">' + L.IC.aviso + '<b>' + L.pl(emErro.length, 'canal em erro', 'canais em erro') + '</b></span>', 'novo', 'er-fn2') + L.IC.chev + '</span>';
  }
  function resumo(){
    if (!emErro.length) return '';
    var cont = { novo: 0, alarme: 0, aviso: 0 }; emErro.forEach(function(c){ cont[estagio(ERROS[c.id][0])]++; });
    var pior = emErro.slice().sort(function(a, b){ return ERROS[b.id][0] - ERROS[a.id][0]; })[0], ep = ERROS[pior.id];
    var fr = emErro.length === 1 ? '<b>1 canal em erro, há ' + idade(ep[0]) + ':</b> ' + esc(pior.nome) + '. ' + MOT[ep[1]].t + (MOT[ep[1]].quem === 'voce' ? ' Você precisa decidir.' : estagio(ep[0]) === 'novo' ? ' Passa sozinho.' : '') + ' ' + fraseEmail(ep[0])
      : '<b>' + emErro.length + ' canais em erro.</b> O mais antigo está assim há ' + idade(ep[0]) + ': ' + esc(pior.nome) + '. ' + (emErro.some(function(c){ return MOT[ERROS[c.id][1]].quem === 'voce'; }) ? 'Um deles precisa de você.' : 'Nenhum precisa de você.') + ' Avisamos você por e-mail ao cruzar o 3º dia de erro e lembramos toda semana até resolver.';
    var seg = function(k, nome, lim, ic){ return '<li class="er-seg ' + k + (cont[k] ? '' : ' zero') + '"><span class="er-p ' + k + '">' + ic + '<b class="num">' + cont[k] + '</b></span><span class="er-sn">' + nome + '<small>' + lim + '</small></span></li>'; };
    /* a escada de três caixas só aparece com 2 ou mais canais em erro; com 1, a frase basta */
    var escada = emErro.length >= 2 ? '<ul class="er-esc" aria-label="Canais em erro, por tempo de erro">' + seg('novo', 'Tentando de novo', 'menos de 12 horas', L.IC.relogio) + seg('alarme', 'Alarme do sistema ligado', '12 horas a 3 dias', L.IC.aviso) + seg('aviso', 'Avisado por e-mail', 'mais de 3 dias', L.IC.envelope) + '</ul>' : '';
    return L.novo('<div class="er-res"><p class="er-fr"><span>' + fr + '</span> ' + A.ibtn('infoEr', 'Como o erro envelhece', true) + '</p>' + escada + '</div>' +
      A.oculto('infoEr', 'Como o erro envelhece', '<ul><li><b>Menos de 12 horas:</b> o erro pode ser passageiro. O sistema tenta de novo na próxima rodada (00, 06, 12 e 18 h) e ainda não dá alarme.</li><li><b>De 12 horas ao 3º dia:</b> o alarme do sistema fica ligado (o painel de saúde do sistema fica vermelho).</li><li><b>Ao cruzar o 3º dia:</b> o alarme do sistema volta ao verde, para não tocar para sempre. Você recebe um e-mail e, enquanto o canal seguir em erro, um lembrete por semana.</li><li><b>Na lista:</b> o canal continua marcado “em erro” até sincronizar de novo, deixar de existir no YouTube ou ser removido por você.</li><li><b>Os dias contam do começo do erro.</b></li></ul>'), 'novo', 'er-rn');
  }
  /* ---------------------------------------------------------------- o que "Sincronizar agora" mostrou */
  function resultado(){
    if (!acao || !foco) return '';
    var c = por[foco], e = focoE, m = MOT[e[1]], tit, det, btns = '', cls, ic;
    if (acao === 'falhou') {
      cls = 'falhou'; ic = L.IC.aviso; tit = 'Não deu para sincronizar ' + esc(c.nome) + ': ' + m.t.charAt(0).toLowerCase() + m.t.slice(1); var dd = m.quem === 'sozinho' && estagio(e[0]) !== 'novo' ? 'Já são ' + idade(e[0]) + ' no mesmo erro. ' + fraseEmail(e[0]) : m.d; det = 'Tentamos às 14:32. ' + dd + (e[1] === 'demora' ? ' A próxima tentativa automática é às 18:00.' : '');
      btns = (e[1] === '404' ? '<span class="btn" role="button" tabindex="0">Abrir no YouTube</span><span class="btn perigo" role="button" tabindex="0">Remover canal…</span>' : '') + '<span class="btn" role="button" tabindex="0">Tentar de novo</span>';
    } else if (acao === 'ocupado') {
      cls = 'recusa'; ic = L.IC.relogio; tit = 'Pedido recusado: ' + esc(c.nome) + ' já está sendo sincronizado.'; det = 'A sincronização começou às 14:30 e leva até 10 minutos. Espere terminar e olhe a lista de novo; não precisa pedir outra vez.'; btns = '<span class="btn" aria-disabled="true">Sincronizando…</span>';
    } else if (acao === 'cota') {
      cls = 'recusa'; ic = L.IC.relogio; tit = 'Pedido recusado: a cota diária do YouTube acabou.'; det = 'Nenhum canal sincroniza antes das 04:00 (horário de São Paulo), quando a cota volta. Não é problema de ' + esc(c.nome) + '.'; btns = '<span class="btn" aria-disabled="true">Disponível às 04:00</span>';
    } else {
      cls = 'ok'; ic = L.IC.ok; tit = esc(c.nome) + ' sincronizou ' + NOW + '.'; det = 'O canal saiu do erro e a marca sumiu da lista. Os números dele já estão atualizados.'; btns = '';
    }
    return L.novo('<div class="er-out ' + cls + '" role="status"><span class="er-oi">' + ic + '</span><div class="er-ob"><p class="er-ot">' + tit + '</p><p class="er-od">' + det + '</p>' + (btns ? '<p class="er-oa">' + btns + '</p>' : '') + '</div></div>', 'novo', 'er-on');
  }

  var corpo = L.obs({ aba: 'Canais', fresh: fresh() }) + resumo() + resultado() + ferramentas() + '<div class="c2-split c2-fe"><div style="min-width:0">' + tabela() + '</div></div>';
  var CASOS = [['nenhum', 'Nenhum canal em erro'], ['2h', '1 canal, há 2 horas'], ['2d', '1 canal, há 2 dias'], ['9d', '1 canal, há 9 dias'], ['tres', '3 canais']];
  var ACOES = [['', 'Ainda não pediu'], ['falhou', 'Falhou'], ['ocupado', 'Recusada: já sincronizando'], ['cota', 'Recusada: cota'], ['ok', 'Deu certo']];
  var barra = { linhas: [{ rotulo: 'Canais em erro', itens: A.opcoes('caso', CASOS, '9d') }, { rotulo: '“Sincronizar agora”', itens: A.opcoes('acao', ACOES, '') }, A.tema()],
    nota: 'A tela é a Lista de Canais já aprovada (7 canais de exemplo). Contorno verde-água e “+ novo” = o que esta proposta acrescenta: o contador “Em erro” no cabeçalho e no filtro, o resumo (com a escada de três idades quando há 2 ou mais canais em erro), o texto curto da coluna Sincronização, o botão “Sincronizar agora” (só em canal em erro, decidido pelo dono) e o aviso do resultado. O resultado mostrado é do canal mais antigo em erro. As datas dos e-mails são calculadas: 3º dia depois do começo do erro, depois uma vez por semana.' };
  A.moldura({ titulo: 'Lista de Canais com canal em erro', barra: barra, corpo: corpo,
    fora: '<div class="tbw" style="max-width:900px"><table class="tb"><caption>Os três estágios e o que o desenho faz em cada um</caption><thead><tr><th scope="col">Idade do erro</th><th scope="col">Forma</th><th scope="col">Alarme do sistema</th><th scope="col">O que você recebe</th><th scope="col">Na lista</th></tr></thead><tbody>' +
      '<tr><th scope="row">menos de 12 horas</th><td><span class="er-p novo">' + L.IC.relogio + '<span>tracejado, relógio</span></span></td><td>desligado (o erro pode ser passageiro)</td><td>nada ainda</td><td>marca e motivo, “tentando de novo às 18:00”</td></tr>' +
      '<tr><th scope="row">12 horas ao 3º dia</th><td><span class="er-p alarme">' + L.IC.aviso + '<span>cheia, com fundo</span></span></td><td><b>ligado</b></td><td>nada ainda; a tela diz a data do e-mail</td><td>marca, motivo e a data do e-mail</td></tr>' +
      '<tr><th scope="row">depois do 3º dia</th><td><span class="er-p aviso">' + L.IC.envelope + '<span>só contorno, envelope</span></span></td><td>volta ao verde</td><td><b>um e-mail ao cruzar o 3º dia e um lembrete por semana</b></td><td>a marca <b>continua</b> até o canal voltar, sumir do YouTube ou você remover; a tela diz a data do último e do próximo e-mail</td></tr></tbody></table></div>' });
  A.ligarInfos();
})();
