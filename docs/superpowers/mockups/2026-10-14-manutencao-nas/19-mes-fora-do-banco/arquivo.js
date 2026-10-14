/* arquivo.js: peça 2 (a página do Arquivo) e peça 3 (tirar o mês). PLANO seções 6 e 7; spec 04 §14.2 e §14.3. Hoje (caso cheio) = 03/05/2028; caso hoje = 14/10/2026; magro = 20/11/2026. Todo número de mês arquivado é exemplo.
   ?e=pagina|todos-meses|todos-problemas|todos-canais|todos-teste|todos-casa|todos-resumo|todos-tirar|<id>  &caso=cheio|hoje|magro  &perfil=adm|ed|le  &cmd=sim|nao (comando de limpeza) */
(function(){
  'use strict';
  var Q = M.Q, ic = M.ic, aus = M.aus, esc = M.esc, D = window.D;
  var E = Q('e', 'pagina'), CASO = Q('caso', 'cheio'), PERFIL = Q('perfil', 'adm'), CMD = Q('cmd', 'sim') === 'sim';
  var ADM = PERFIL === 'adm';
  var NOMEMES = { m8: 'Setembro de 2027', m8a: 'Setembro de 2027', m8b: 'Setembro de 2027', m12b: 'Setembro de 2027', pr3: 'Setembro de 2027', m11: 'Setembro de 2027', m11a: 'Agosto de 2027', m11a2: 'Agosto de 2027', m11b: 'Agosto de 2027', m11c: 'Agosto de 2027', m12c: 'Agosto de 2027', pq1: 'Agosto de 2027', pq2: 'Agosto de 2027', m2: 'Abril de 2028', m1: 'Maio de 2028', m6: 'Dezembro de 2027', m12d: 'Dezembro de 2027', m5a: 'Novembro de 2027', m14: 'Julho de 2027', m5: 'Março de 2028', m4: 'Março de 2028', m5b: 'Março de 2028', m3: 'Abril de 2028' };
  var INFO = {
    'i-m2': 'A cópia espera o mês parar de mudar: 28 dias depois de fechar (45 nos comentários, que recebem respostas até 37 dias depois do vídeo). Se o mês mudar depois da cópia, ele é copiado de novo.',
    'i-ps': 'Carregar o mês do B2 num banco de teste e conferir que bate.',
    'i-blob': 'Blob é o armazenamento de imagens do site, na Vercel.',
    'i-b2': 'A forja confere a cópia do B2 todo dia, sozinha. A cada 5 meses (a validade é de 180 dias) você testa a recuperação no seu Mac: é o que confirma que a forja não se enganou.'
  };
  var hoje = { cheio: '03/05/2028', hoje: '14/10/2026', magro: '20/11/2026' }[CASO];

  function sub(f){ return f.replace(/<IB:([^:]+):([^>]+)>/g, function(_, id, r){ return M.ib(id, r) + M.infoBox(id, INFO[id] || ''); }); }

  /* ------------------------------------------------------------ botões da linha (só quem administra, 04 L41) */
  function acoes(ac, nome){
    if (!ac) return '';
    if (!ADM) return '';
    var mm = nome.toLowerCase();
    if (ac === 'sair') return '<button type="button" class="btn heavy" data-act="sair">Tirar ' + mm + ' do banco online</button><button type="button" class="btn" data-act="simular">Ver o que sairia</button>';
    if (ac === 'cmd1') return '<button type="button" class="btn small" data-act="cmd">Ver o comando</button>';
    if (ac === 'volt-lib') return '<button type="button" class="btn" data-act="voltar">Trazer de volta</button><button type="button" class="btn" aria-disabled="true">Liberar o espaço (disponível em 09/05/2028)</button>';
    if (ac === 'volt-lib2') return '<button type="button" class="btn" data-act="voltar">Trazer de volta</button><button type="button" class="btn heavy" data-act="liberar">Liberar o espaço</button>';
    if (ac === 'voltar') return '<button type="button" class="btn heavy" data-act="voltar">Trazer de volta</button>';
    if (ac === 'cmd') return '<button type="button" class="btn small" data-act="cmd">Ver os comandos</button>';
    if (ac === 'apagar' || ac === 'apagar2') return '<button type="button" class="btn danger small" data-act="apagar">Apagar do arquivo</button>';
    return '';
  }

  /* ------------------------------------------------------------ uma linha de mês */
  function linhaMes(r, o){
    o = o || {};
    var id = r[0], tipo = r[3], f = r[4], nome = o.nome || NOMEMES[id] || 'Outubro de 2027', al = r[7], cls = 'm-mes' + (al ? ' alerta' + (al === 'vm' ? ' vm' : '') : '') + (tipo === '2' ? ' duas' : '') + (tipo === 'arq' || tipo === 'zero' ? ' arqrow' : '') + (o.teste ? ' teste' : '');
    var reg = tipo === '5' ? M.regua(D.r5(f), 'Caminho de ' + nome) : tipo === '2' ? M.regua(D.r2(f), 'Caminho de ' + nome) : '';
    var lead = tipo === 'arq' ? ic(f[1] === 'tri' ? 'tri' : f[1] === 'oct' ? 'oct' : 'arq') + ' ' : tipo === 'zero' ? ic('zero') + ' ' : '';
    if (tipo === 'arq' && f[1]) lead = ic('arq') + ic(f[1]) + ' ';
    var marca = o.teste ? '<span class="m-marca" title="mês fictício">teste</span>' : '';
    return '<li' + (id === 'm5a' && !o.nome ? ' id="mes-m5a"' : '') + ' class="' + cls + '"><div class="m-mn">' + esc(nome) + marca + '</div><p class="m-fr">' + lead + sub(r[5]) + (r[6] ? '<span class="m-sec">' + r[6] + '</span>' : '') + '</p>' + reg + '<div class="m-ac">' + acoes(r[8], nome) + '</div></li>';
  }
  function porId(arr, id){ for (var i = 0; i < arr.length; i++) if (arr[i][0] === id) return arr[i]; }
  function mes(id, o){ return linhaMes(porId(D.MES, id) || porId(D.PROB, id), o); }
  function lista(rows){ return '<ul class="m-rows" style="border:1px solid var(--border);border-radius:8px;background:var(--surface)">' + rows + '</ul>'; }

  /* ------------------------------------------------------------ uma linha de canal removido */
  function linhaCan(r, o){
    var f = r[3], al = r[6], reg = f.length === 4 ? M.regua(D.r4(f), 'Limpeza do arquivo de ' + r[4]) : '';
    var lead = f.length === 1 ? ic(f[0]) + ' ' : '';
    var nome = esc(r[4]);
    return '<li class="m-can' + (al ? ' ' + al : '') + '"><div class="m-cn" title="' + nome + '">' + nome + '</div><p>' + lead + sub(r[5]) + '</p>' + reg + '<div class="m-ac">' + (ADM ? acoes(r[7] === 'cmd' && !CMD ? '' : r[7], '') : '') + '</div></li>';
  }
  function can(id){ return linhaCan(porId(D.CAN, id)); }

  /* ------------------------------------------------------------ o bloco "Canais removidos" (cmd = comando de limpeza em produção) */
  function blocoCanais(rows, resumo, extra){
    return '<section class="m-card" aria-label="Canais removidos"><div class="m-card-h"><div class="m-card-top"><h3 class="m-h3">Canais removidos</h3></div><p class="m-resumo">' + resumo + '</p></div><ul class="m-rows">' + rows + '</ul>' + (extra || '') + '</section>';
  }
  var JA = '<details class="m-ano"><summary>' + ic('ok') + ' Já limpos (3)</summary><div class="m-ano-in">3 canais removidos já não deixam nada a limpar; o último em 12/04/2028.</div></details>';
  function blocoPadrao(){
    if (CASO !== 'cheio') return '';
    if (CMD) return blocoCanais(can('c1') + can('c7'), ADM ? 'Canais removidos: 1 pede um comando seu (o mais antigo, há 5 dias); 1 só espera o prazo dos snapshots do NAS.' : 'Canais removidos: 1 espera um comando de quem administra (o mais antigo, há 5 dias); 1 só espera o prazo dos snapshots do NAS.', JA);
    return blocoCanais(can('c4') + can('c7'), 'Canais removidos: 2 esperam o comando de limpeza, que chega em 12/12/2028.', JA);
  }

  /* ------------------------------------------------------------ cartão de tipo de dado */
  /* peça 4: o interruptor no topo de cada cartão de tipo. ?auto=<estado> força o mesmo estado nos cartões de views e hora (ind, ind-0-0, desl, lig, parcial, perto, trav, nm, desl-1 a desl-13); ?visto=1 = o dono já abriu a peça */
  var AUTO = Q('auto', ''), VISTO = Q('visto', '') === '1';
  function estadoAuto(tipo){
    if (AUTO) return AUTO;
    if (CASO !== 'cheio') return 'ind-0-0';
    return tipo === 'dia' ? 'lig' : 'desl';
  }
  function interruptor(tipo){
    if (tipo === 'texto') return INT.peca('texto', 'x');
    return INT.peca(tipo, estadoAuto(tipo), { adm: ADM, visto: VISTO });
  }
  function cartao(titulo, tipo, resumo, rows, anos){
    return '<section class="m-card" aria-label="' + esc(titulo) + '"><div class="m-card-h"><div class="m-card-top"><h3 class="m-h3">' + esc(titulo) + '</h3></div>' + interruptor(tipo) + '<p class="m-resumo">' + resumo + '</p></div>' +
      '<div class="m-sub"><span>O caminho de cada mês</span><span>' + (CASO === 'cheio' ? 'o mais antigo é o próximo a sair' : 'do mais antigo ao corrente') + '</span></div><ul class="m-rows">' + rows + '</ul>' + (anos || '') + '</section>';
  }
  function anos(lista){
    return lista.map(function(a){ return '<details class="m-ano"><summary>' + ic('arq') + ' ' + a[0] + ': ' + a[1] + ' meses no arquivo, todos conferidos</summary><div class="m-ano-in"><ul>' + a[2].map(function(m){ return '<li>' + ic('arq') + m + '</li>'; }).join('') + '</ul></div></details>'; }).join('');
  }
  var M26 = ['10/2026', '11/2026', '12/2026'];
  function m27(a, b){ var o = []; for (var i = a; i <= b; i++) o.push((i < 10 ? '0' : '') + i + '/2027'); return o; }
  function nenhumArq(){ return '<li class="m-mes arqrow" style="grid-template-columns:minmax(0,1fr)"><p class="m-fr">' + aus('zr', 'Nenhum mês no arquivo ainda.', 'Conferido em ' + hoje + '.') + '</p></li>'; }

  function tipos(){
    if (CASO === 'hoje') {
      var r = function(t, p){ return cartao(t, p, t + ': 1 mês online (o de coleta, desde 03/10/2026). Outubro de 2026 pode sair em 01/05/2027 (faltam 199 dias).', mes('m1', { nome: 'Outubro de 2026' }), ''); };
      return r('Leitura de hora em hora', 'hora') + r('Views por dia', 'dia') + cartao('Comentários e dados antigos do YouTube', 'texto', 'Comentários e dados antigos do YouTube: 1 mês online. Outubro de 2026 pode sair em 15/06/2027 (comentários esperam 45 dias, depois dos 6 meses de prazo).', mes('m1', { nome: 'Outubro de 2026' }), '');
    }
    if (CASO === 'magro') {
      var rm = function(t, p, txt, dt){ return cartao(t, p, t + ': ' + txt, mes('m2', { nome: 'Outubro de 2026' }).replace('28/05/2028', dt || '28/11/2026') + mes('m1', { nome: 'Novembro de 2026' }), ''); };
      return rm('Leitura de hora em hora', 'hora', '2 meses online, 0 no arquivo. Outubro de 2026 pode ser copiado a partir de 28/11/2026.') + rm('Views por dia', 'dia', '2 meses online, 0 no arquivo. Outubro de 2026 pode ser copiado a partir de 28/11/2026.') + rm('Comentários e dados antigos do YouTube', 'texto', '2 meses online, 0 no arquivo. A cópia de outubro de 2026 começa em 15/12/2026.', '15/12/2026');
    }
    var views = mes('m5a') + mes('m8') + mes('m7') + mes('m6', { nome: 'Dezembro de 2027' }) + mes('m6', { nome: 'Janeiro de 2028' }).replace('01/07/2028', '01/08/2028') + mes('m6', { nome: 'Fevereiro de 2028' }).replace('01/07/2028', '01/09/2028') + mes('m5') + mes('m2') + mes('m1');
    var hora = mes('m7', { nome: 'Fevereiro de 2028' }) + mes('m5', { nome: 'Março de 2028' }) + mes('m2') + mes('m1');
    var txt = mes('m4', { nome: 'Março de 2028' }) + mes('m2').replace('28/05/2028', '15/06/2028') + mes('m1');
    return cartao('Leitura de hora em hora', 'hora', 'Leitura de hora em hora: 3 meses online, 15 no arquivo. Fevereiro de 2028 pode sair agora.', hora, anos([['2026', 3, M26], ['2027', 12, m27(1, 12)]])) +
      cartao('Views por dia', 'dia', 'Views por dia: 8 meses online, 11 no arquivo. Outubro de 2027 pode sair agora. Hoje já falta: conferir o B2 de novembro de 2027.', views, anos([['2026', 3, M26], ['2027', 8, m27(1, 8)]])) +
      cartao('Comentários e dados antigos do YouTube', 'texto', 'Comentários e dados antigos do YouTube: 3 meses online, 17 no arquivo. Março de 2028 pode sair em 15/06/2028 (faltam 43 dias).', txt, anos([['2026', 3, M26], ['2027', 12, m27(1, 12)], ['2028', 2, ['01/2028', '02/2028']]]));
  }

  /* ------------------------------------------------------------ frase-resumo da página (Logan 11.8) */
  var RES = {
    casa: ['res-casa', 'Frase-resumo: a casa não responde (vence todas)', 'Logan 11.8', '<p class="m-resumo"><b>A casa não responde desde 30/04/2028 18:40: nenhum mês pode sair até ela voltar.</b></p>', 'tri'],
    dois: ['res-dois', 'Frase-resumo: dois meses precisam de você', 'Logan 11.8', '<p class="m-resumo"><b>2 meses precisam de você; o mais urgente: <a href="#mes-m5a">Views por dia, novembro de 2027: conferir o B2</a>.</b> Um mês já pode sair.</p>'],
    um: ['res-um', 'Frase-resumo: um mês e um canal removido', 'Logan 11.8', '<p class="m-resumo"><b>1 mês precisa de você (<a href="#mes-m5a">Views por dia, novembro de 2027: conferir o B2</a>) e 1 canal removido pede um comando seu.</b> Um mês já pode sair.</p>'],
    calmo: ['res-calmo', 'Frase-resumo: nada precisa de você', 'Logan 11.8', '<p class="m-resumo calmo">Nenhum mês precisa de você. Próxima saída possível: 01/05/2027.</p>'],
    nm: ['res-nm', 'Frase-resumo: não medido', 'Logan 11.8', aus('nm', 'Não foi possível ler o estado do arquivo.')]
  };
  function resumoPagina(){
    if (CASO === 'cheio') return PERFIL === 'ed' ? '<p class="m-resumo"><b>1 mês e 1 canal removido esperam quem administra o site.</b> Um mês já pode sair.</p><p class="m-muted" style="margin:4px 0 0;font-size:12.5px">Quem administra o site faz estas ações.</p>' : RES.um[3];
    if (PERFIL === 'ed') return RES.calmo[3] + '<p class="m-muted" style="margin:4px 0 0;font-size:12.5px">Quem administra o site faz as ações desta página.</p>';
    return RES.calmo[3];
  }

  /* ------------------------------------------------------------ linhas da casa (04 L532-536): a altura fica reservada */
  var CASAF = {
    curso: ['casa-curso', 'Varredura completa em curso', '04 L532-536', '<div class="m-faixa" style="min-height:96px">' + ic('pont', true) + '<div class="m-btxt">A casa voltou depois de 52 horas sem responder. Verificando tudo no NAS: 48.210 de 112.480 arquivos. Você não precisa fazer nada; nenhum mês sai do banco antes de a cópia dele ser relida.' + M.barraProg(43) + '</div></div>'],
    curso2: ['casa-curso2', 'Varredura em curso, só o NAS ficou fora', '04 L534', '<div class="m-faixa" style="min-height:96px">' + ic('pont', true) + '<div class="m-btxt">O NAS voltou depois de 52 horas fora. Verificando tudo no NAS: 48.210 de 112.480 arquivos. Você não precisa fazer nada; nenhum mês sai do banco antes de a cópia dele ser relida.' + M.barraProg(43) + '</div></div>'],
    fim: ['casa-fim', 'Varredura completa terminada, sem divergência', '04 L535', '<div class="m-faixa" style="min-height:96px">' + ic('ok', true) + '<div class="m-btxt">Verificação do NAS terminada em 03/05/2028 08:14: 112.480 arquivos, todos iguais ao registro.</div></div>'],
    fimp: ['casa-fim-prob', 'Varredura terminada, com problema', '04 L535', '<div class="m-faixa vm" style="min-height:96px">' + ic('oct', true) + '<div class="m-btxt">Verificação do NAS terminada em 03/05/2028 08:14: 112.480 arquivos, 3 com problema, nos meses abaixo.</div></div>'],
    rel: ['casa-relogio', 'Relógio da forja fora (mais de 2 minutos)', '04 L536', '<div class="m-faixa am">' + ic('tri', true) + '<div class="m-btxt">O relógio da forja está 7 minutos adiantado. Enquanto estiver assim, as conferências de 24 horas e os horários da cópia podem errar. Nada se perde. Acerte o relógio da forja (ver o comando). <button type="button" class="btn small" data-act="cmd" style="margin-top:6px">Ver o comando</button></div></div>']
  };

  /* ------------------------------------------------------------ problemas no nível da página */
  var PG = [
    ['pg-acabando-am', 'Meses à frente acabando (âmbar, abaixo de 6 meses)', '04 L190', aus('am', 'O banco só está preparado para receber dados até 10/2028. Depois dessa data a coleta para de gravar. Rode o comando de preparar os próximos meses (ver os comandos).')],
    ['pg-acabando-vm', 'Meses à frente acabando (vermelho, abaixo de 3 meses)', '04 L190', aus('vm', 'O banco só está preparado para receber dados até 07/2028. Depois dessa data a coleta para de gravar. Rode o comando de preparar os próximos meses (ver os comandos).')],
    ['pg-desligado', 'Arquivo desligado', '04 L191', aus('pt', 'O arquivo está desligado neste site: nada está sendo copiado nem tirado')],
    ['pg-nunca', 'Meses no arquivo nunca conferidos de fora da casa', '04 L182', aus('pt', '11 meses que já saíram do banco nunca foram conferidos de fora da casa. O seu próximo teste de recuperação começa por eles.', 'Cinza e pontilhado: a conferência de fora ainda não existe. Não é alarme.')],
    ['pg-nm', 'Não medido: o estado do arquivo', '04 L192', aus('nm', 'Não foi possível ler o estado do arquivo.')]
  ];

  /* ------------------------------------------------------------ dado de teste (04 L194-200) */
  function faixaTeste(){ return '<div class="m-teste-h"><b>Dado de teste.</b> Isto é um mês fictício, criado para você testar o caminho inteiro sem tocar no dado real. Nada que sair daqui libera espaço de verdade. <button type="button" class="m-ibtn" style="display:none"></button></div>'; }
  function grupoTeste(estado){
    if (!ADM) return '';
    if (estado === 'encerrado') return aus('pt', 'Dado de teste encerrado em 03/05/2028.');
    var rows = linhaMes(porId(D.MES, 'm7'), { nome: 'Mês de teste (jan/2028)', teste: true }).replace('Pode sair', 'Pode sair (espera de 1 dia no lugar de 7)').replace('Tirar mês de teste (jan/2028) do banco online', 'Tirar o mês de teste do banco online');
    var fim = estado === 'encerrar' ? '<div style="padding:10px 14px;border-top:1px solid var(--border-subtle)"><p style="margin:0 0 8px;font-size:13.5px">A recuperação foi testada e o descarte de teste foi feito.</p><button type="button" class="btn" data-act="encerrar">Encerrar o dado de teste</button></div>' : '';
    return '<section class="m-card" aria-label="Dado de teste">' + faixaTeste() + '<ul class="m-rows">' + rows + '</ul>' + fim + '</section>';
  }
  var VIDEOS_ANTIGOS = '<section class="m-card" aria-label="Vídeos antigos"><div class="m-card-h"><div class="m-card-top"><h3 class="m-h3">Vídeos antigos</h3><span class="m-slot">Peça 8, desenhada à parte.</span></div></div></section>';

  /* ------------------------------------------------------------ peça 3: tirar o mês */
  function dlg(titulo, corpo, ac, st){
    return '<div class="m-dlg' + (st ? ' st' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dT"><div class="m-dlg-b"><h2 id="dT">' + titulo + '</h2>' + corpo + '</div><div class="m-dlg-a">' + ac + '</div></div>';
  }
  var CMDHTML = '<ol class="m-cmd m-cmdlist" style="grid-column:1/-1;padding-left:28px;border:1px solid var(--border);border-radius:8px;background:var(--surface)"><li>No Mac, rode: <code>npx tsx scripts/obs-arquivo.ts expurgar --canal 7F3A91C2</code>. Rodar de novo é sempre seguro. Ele grava um arquivo de comandos.</li><li>Na forja, rode o arquivo que ele gravou, com uma linha só: <code>bash expurgar-7F3A91C2.sh</code>.</li><li>Espere: a página confirma sozinha em até 24 horas.</li><li>Quando a linha disser “Apagado do NAS”, rode o comando de novo: ele grava o arquivo com o que apagar no B2, pelo painel.</li><li>Quando disser “Sua parte terminou”, não há mais nada a fazer.</li></ol>';
  var PROVA = '<p class="t"><b>Contado agora, no banco:</b> 45 canais, 1.234.567 registros de outubro de 2027, iguais aos da cópia do NAS (verificada hoje às 06:17) e do B2 (conferido pela forja hoje às 11:20, ou por você em 02/05/2028). A recuperação foi testada em 05/12/2027.</p><p class="t"><b>Muda nas telas:</b> as curvas passam a começar em 01/11/2027 e as medidas mais antigas passam a dizer “no arquivo”. <b>Continua:</b> o mês inteiro, no NAS e no B2. <b>Para ver de novo:</b> peça o período em “Ver antigo” (números por mês).</p>';
  var DOIS = '<p class="t"><b>Em dois passos:</b> hoje sai das telas; a partir de 10/05/2028 você pode liberar o espaço. Dá para trazer de volta a qualquer momento, até você liberar o espaço. <b>Enquanto o espaço não for liberado, não dá para remover canal nem apagar vídeo da fila “Saíram do YouTube”.</b></p>';
  var QUARTA = '<p class="t"><b>Não volta ao banco por este botão.</b> Daqui em diante a saída é em um passo só e não há “trazer de volta”. Em “Views por dia”, as primeiras horas ainda podem voltar; os views por dia, não.</p>';
  var TEXTO = '<p class="t">Isto apaga do site o <b>texto</b> dos comentários de outubro de 2027 (8.412 comentários de 45 canais). <b>O que você perde:</b> nunca mais verá esse texto no site, nem nos relatórios, que mostram só contagens. <b>O que continua:</b> a cópia completa no NAS e no B2, que só se lê com um comando seu. <b>Não dá para desfazer pelo site.</b> Para continuar, digite: <b>apagar comentários de outubro de 2027</b>.</p><label for="dIn">Frase de confirmação</label><input id="dIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="dSt"><p class="m-st" id="dSt" role="status">Digite a frase para continuar.</p>';
  var CANC = '<button type="button" class="btn" data-foco data-fecha>Cancelar</button>';
  function dT4(v){
    var corpo = v === 'c' ? TEXTO : PROVA + (v === 'a' ? DOIS : '') + (v === 'b' ? QUARTA : '');
    var ok = v === 'c' ? '<button type="button" class="btn heavy" aria-disabled="true" id="dOk" data-ok>Apagar o texto de outubro de 2027</button>' : '<button type="button" class="btn heavy" data-ok>Tirar outubro de 2027 do banco</button>';
    return dlg('Tirar outubro de 2027 do banco online?', corpo, CANC + ok);
  }
  var SIM = '<div class="m-sim"><p><span class="m-marca" style="margin:0 6px 0 0">simulação, nada foi tirado</span>Se você tirasse outubro de 2027 agora: <b class="m-num">45</b> canais, <b class="m-num">1.234.567</b> registros, <b class="m-num">38%</b> do que este tipo de dado ocupa. Contado agora: tudo bate.</p><p style="margin:0 0 4px;font-size:13px;color:var(--muted)">Mais 1 canal removido: os registros dele deste mês já estão só no arquivo. Os 1.204 registros de 1 canal removido se perderam (confirmado por você em 03/05/2028).</p><p style="margin:0;font-size:12.5px;color:var(--muted)">Simulações vistas: 2 de 2</p></div>';
  var COND = [['tri', 'Falta conferir o B2 (última conferência há 41 dias).'], ['tri', 'Cópia sem verificação há 30 horas: a casa não respondeu. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco.'], ['pont', 'Ainda dentro dos 6 meses: pode sair em 01/06/2028.'], ['tri', 'A forja não confere o B2 há 9 dias.']];
  function botoesT(on){
    return '<div class="m-botoes"><button type="button" class="btn ' + (on ? 'heavy' : '') + '"' + (on ? '' : ' aria-disabled="true"') + ' data-act="sair">Tirar ' + (on ? 'outubro' : 'novembro') + ' de 2027 do banco online</button><button type="button" class="btn" data-act="simular">Ver o que sairia</button></div>';
  }
  function T(){
    var s = 'style="margin:0"';
    return [
      ['t1', 'Desabilitado: qual condição falta', '04 L251', '<ul class="m-cond">' + COND.map(function(c){ return '<li>' + ic(c[0]) + '<span>' + c[1] + '</span></li>'; }).join('') + '</ul>' + botoesT(false) + '<p class="m-q-nota">Um símbolo por linha e a ação de cada uma: nunca um botão cinza sem motivo.</p>'],
      ['t2', 'Simulação: “Ver o que sairia”', '04 L252', botoesT(true) + SIM],
      ['t2b', 'Simulação com condição faltando', '04 L252', botoesT(false) + '<div class="m-sim"><p><span class="m-marca" style="margin:0 6px 0 0">simulação, nada foi tirado</span>Hoje não dá para tirar novembro de 2027:</p><ul class="m-cond">' + COND.slice(0, 1).map(function(c){ return '<li>' + ic(c[0]) + '<span>' + c[1] + '</span></li>'; }).join('') + '</ul></div>'],
      ['t3', 'Habilitado', '04 L253', botoesT(true)],
      ['t4', 'Confirmação (Views por dia e hora em hora)', '04 L254', dT4('')],
      ['t4a', 'Confirmação em dois passos (três primeiras saídas)', '04 L255', dT4('a')],
      ['t4b', 'Confirmação da quarta saída em diante', '04 L256', dT4('b')],
      ['t4c', 'Confirmação dos comentários, com a frase digitada', '04 L257', dT4('c')],
      ['t5', 'Durante', '04 L258', '<p class="m-ausente pt">' + ic('pont') + '<span class="m-btxt">Conferindo o banco contra o arquivo' + M.barraProg(0, true) + '</span></p><div style="height:8px"></div><p class="m-ausente pt">' + ic('pont') + '<span class="m-btxt">Tirando' + M.barraProg(0, true) + '</span></p>'],
      ['t6', 'Recusado na hora (as quatro frases do catálogo)', '04 L259', aus('am', 'Ocupado: a coleta está gravando. Tente em alguns minutos.') + '<div style="height:8px"></div>' + aus('am', 'O dado mudou desde a cópia: nada foi tirado; o mês será copiado de novo.') + '<div style="height:8px"></div>' + aus('vm', 'A última conferência do B2 falhou em 02/05/2028: nada foi tirado. A forja confere de novo amanhã; se quiser adiantar, rode a conferência no seu Mac.') + '<div style="height:8px"></div>' + aus('vm', 'A proteção contra remoção durante a saída não está instalada: nada foi tirado. É defeito de instalação; avise quem cuida do site.')],
      ['t7', 'Primeiro passo feito, esperando', '04 L260', lista(mes('m8'))],
      ['t7a', 'Primeiro passo feito, depois dos 7 dias', '04 L261', lista(mes('m8a')) + '<p class="m-q-nota">Aos 14 dias a linha fica âmbar e diz “Libere o espaço ou traga o mês de volta”.</p>'],
      ['t7b', 'Primeiro passo feito, aos 14 dias', '04 L261', lista(mes('m8b'))],
      ['t8', 'Segundo passo (confirmação)', '04 L262', dlg('Liberar o espaço de setembro de 2027?', '<p class="t"><b>Depois disso não dá mais para trazer de volta pelo site.</b> Isto libera cerca de 4% do banco. O dado continua no NAS e no B2.</p><p class="t"><b>Contado agora, no banco:</b> 45 canais, 1.234.567 registros de setembro de 2027, iguais aos da cópia do NAS (verificada hoje às 06:17) e do B2 (conferido pela forja hoje às 11:20).</p>', CANC + '<button type="button" class="btn heavy" data-ok>Liberar o espaço</button>', true)],
      ['t8r', 'Segundo passo recusado', '04 L263', aus('am', 'A cópia não pôde ser confirmada agora (o B2 não respondeu à conferência). O espaço não foi liberado e o mês continua podendo voltar.')],
      ['t8x', 'Segundo passo repetido (não é erro)', '04 L264', aus('pt', 'O espaço deste mês já foi liberado em 03/05/2028.')],
      ['t9', 'Feito', '04 L265', lista(linhaMes(['t9', '', '', 'arq', ['arq'], 'Saiu em 03/05/2028 às 14:32. Liberou 4% do banco', '', '', ''], { nome: 'Setembro de 2027' }))],
      ['t10', 'Trazer de volta', '04 L266', aus('pt', 'Outubro de 2027 voltou ao banco online em 03/05/2028.')],
      ['t10b', 'Trazer de volta, o dado não bateu', '04 L267', aus('pt', 'Outubro de 2027 voltou ao banco online em 03/05/2028. O dado dele não bateu com a cópia: o mês será copiado de novo.')],
      ['t10c', 'Trazer de volta, com a proteção não instalada', '04 L268', aus('am', 'O mês voltou. A proteção contra remoção durante a saída não está instalada; avise quem cuida do site antes de tirar outro mês.')],
      ['t10d', 'Trazer de volta falhou (registros sem vídeo)', '04 L269', aus('vm', 'Não foi possível trazer de volta: o banco encontrou registros sem vídeo. Nada foi alterado; o mês continua fora das telas. Avise quem cuida do site.')],
      ['t11', 'Banco em somente leitura', '04 L272', aus('vm', 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.')]
    ];
  }
  /* o diálogo aberto de verdade, na página */
  var estado = { out: 'm7', set: 'm8', foco: null };
  function abre(html, trigger, onOk){
    estado.foco = trigger; var m = document.createElement('div'); m.className = 'm-modal'; m.id = 'modal'; m.innerHTML = html; document.body.appendChild(m);
    function fecha(){ m.remove(); document.removeEventListener('keydown', key); if (estado.foco && document.contains(estado.foco)) estado.foco.focus(); }
    function key(e){
      if (e.key === 'Escape') { fecha(); return; }
      if (e.key === 'Tab') { var f = m.querySelectorAll('button,input,[tabindex="0"]'); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); } }
    }
    document.addEventListener('keydown', key);
    m.addEventListener('click', function(e){ if (e.target === m || e.target.closest('[data-fecha]')) fecha(); var ok = e.target.closest('[data-ok]'); if (ok && ok.getAttribute('aria-disabled') !== 'true') { fecha(); onOk && onOk(); } });
    var inp = m.querySelector('#dIn'); if (inp) inp.addEventListener('input', function(){ var b = m.querySelector('#dOk'), st = m.querySelector('#dSt'), ok = inp.value.toLowerCase().replace(/\s+/g, ' ').trim() === 'apagar comentários de outubro de 2027'; b.setAttribute('aria-disabled', String(!ok)); st.textContent = ok ? 'Frase confirmada.' : 'Digite a frase para continuar.'; });
    var f0 = m.querySelector('[data-foco]'); if (f0) f0.focus();
  }

  /* ------------------------------------------------------------ montagem das telas */
  function quadroMes(r){ return M.quadro(r[0], r[1], r[2], lista(linhaMes(r))); }
  function quadroCan(r){ return M.quadro(r[0], r[1], r[2], '<ul class="m-rows" style="border:1px solid var(--border);border-radius:8px;background:var(--surface)">' + linhaCan(r) + '</ul>'); }
  var GRUPOS = {
    meses: function(){ return D.MES.map(quadroMes).join(''); },
    problemas: function(){ return D.PROB.map(quadroMes).join('') + PG.map(function(p){ return M.quadro(p[0], p[1], p[2], p[3]); }).join(''); },
    canais: function(){
      var x = D.CAN.map(quadroCan).join('');
      var extra = [
        ['c-resumo-cmd', 'Frase-resumo, com o comando', '04 L202', '<p class="m-resumo">Canais removidos: 3 pedem um comando seu (o mais antigo, há 41 dias); 2 só esperam o prazo dos snapshots do NAS.</p>'],
        ['c-resumo-sem', 'Frase-resumo, sem o comando em produção', '04 L293', '<p class="m-resumo">Canais removidos: 2 esperam o comando de limpeza, que ainda não tem data para chegar.</p>'],
        ['c-zero', 'Zero medido: nenhum canal removido pede limpeza', '04 L204', aus('zr', 'Nenhum canal removido pede limpeza.')],
        ['c-nm', 'Não medido', '04 L237', aus('nm', 'Não foi possível ler os canais removidos.')],
        ['c-limpos', 'Já limpos (N), recolhido; e com zero', '04 L239', '<div style="border:1px solid var(--border);border-radius:8px;background:var(--surface)">' + JA + '</div><div style="height:10px"></div><div style="border:1px solid var(--border);border-radius:8px;background:var(--surface)"><details class="m-ano"><summary>' + ic('zero') + ' Já limpos (0)</summary><div class="m-ano-in">Nenhum canal removido foi limpo ainda.</div></details></div>'],
        ['c-carregando', 'Carregando (requisição): esqueleto com a altura final da linha', '04 L552', '<div aria-busy="true" role="status" aria-label="Carregando os canais removidos">' + [1, 2].map(function(){ return '<div class="m-can esq" aria-hidden="true"><div><div class="b" style="width:70%"></div></div><div><div class="b"></div><div class="b l"></div></div><div><div class="b"></div></div><div></div></div>'; }).join('') + '</div>'],
        ['c-comandos', 'Ver os comandos (só quem administra)', '04 L241', '<div class="m-cmdwrap">' + CMDHTML + '</div>'],
        ['c-apagar', 'Apagar do arquivo: confirmação com a frase digitada', 'Logan 11.2', dlg('Apagar do arquivo os 14 meses de Viagem Lenta?', '<p class="t"><b>Não dá para desfazer.</b> Os 14 meses (de 10/2026 a 11/2027) saem do arquivo e podem ser a única cópia dos registros deste canal.</p><p class="t">Para continuar, digite o nome do canal:</p><p class="t" style="padding:6px 8px;background:var(--sunk);border:1px solid var(--border);border-radius:6px;user-select:all"><b>Viagem Lenta</b></p><label for="dIn2">Nome do canal</label><input id="dIn2" type="text" autocomplete="off"><p class="m-st" role="status">Digite o nome do canal para continuar.</p>', '<button type="button" class="btn" data-fecha>Cancelar</button><button type="button" class="btn danger" aria-disabled="true">Apagar do arquivo</button>', true)],
        ['c-apagar-sd', 'Apagar do arquivo, sem aviso de remoção, com o Blob desconhecido', '04 L243; Logan 11.2', dlg('Apagar do arquivo os 9 meses do código 7F3A91C2?', '<p class="t"><b>Não dá para desfazer.</b> Os 9 meses (de 10/2026 a 06/2027) saem do arquivo e podem ser a única cópia.</p>' + aus('am', 'O site não anotou, na remoção, quais imagens deste canal estão no Blob e não consegue apagá-las. Elas continuam lá depois que o arquivo for apagado.') + '<p class="t">Para continuar, digite o código deste arquivo: <b class="m-num" style="padding:2px 6px;background:var(--sunk);border:1px solid var(--border);border-radius:4px;user-select:all">7F3A91C2</b></p><label for="dIn3">Código do arquivo</label><input id="dIn3" type="text" autocomplete="off"><p class="m-st" role="status">Digite o código para continuar.</p>', '<button type="button" class="btn" data-fecha>Cancelar</button><button type="button" class="btn danger" aria-disabled="true">Apagar do arquivo</button>', true)]
      ];
      return x + extra.map(function(p){ return M.quadro(p[0], p[1], p[2], p[3]); }).join('');
    },
    teste: function(){ return M.quadro('teste-1', 'Dado de teste: a faixa, a marca “teste” e o caminho de sempre', '04 L194-200', grupoTeste('') || aus('pt', 'Só quem administra vê este grupo.')) + M.quadro('teste-2', 'Dado de teste: recuperação testada e descarte feito, botão de encerrar', '04 L199', grupoTeste('encerrar') || aus('pt', 'Só quem administra vê este grupo.')) + M.quadro('teste-3', 'Depois de encerrado (aparece uma vez)', '04 L199', grupoTeste('encerrado') || aus('pt', 'Só quem administra vê este grupo.')); },
    casa: function(){ return Object.keys(CASAF).map(function(k){ var c = CASAF[k]; return M.quadro(c[0], c[1], c[2], c[3]); }).join(''); },
    resumo: function(){ return Object.keys(RES).map(function(k){ var c = RES[k]; return M.quadro(c[0], c[1], c[2], c[3]); }).join(''); },
    tirar: function(){ return T().map(function(t){ return M.quadro(t[0], t[1], t[2], t[3]); }).join(''); }
  };
  var ABAS = [['pagina', 'Página'], ['todos-resumo', 'Frase-resumo'], ['todos-casa', 'Avisos da casa'], ['todos-meses', 'Estados do mês'], ['todos-problemas', 'Estados de problema'], ['todos-canais', 'Canais removidos'], ['todos-teste', 'Dado de teste'], ['todos-tirar', 'Tirar o mês (peça 3)']];

  function corpoTela(){
    if (!PERFIL || PERFIL === 'le') return '<h2 class="m-h2">Esta página é de quem edita o site.</h2><p style="margin:8px 0 0"><a href="#" onclick="return false" style="display:inline-flex;align-items:center;min-height:44px;color:var(--accent)">Voltar para Canais</a></p>';
    if (E === 'pagina') {
      var topo = '<h2 class="m-h2">Arquivo</h2>' + resumoPagina() + '<div style="height:8px"></div>' + M.legenda(false) + (CASO === 'cheio' ? '<div class="m-aviso" style="margin-top:0"><b>Exemplo.</b>&nbsp;Todo número de mês arquivado é exemplo; no caso cheio, hoje = 03/05/2028.</div>' : '<div class="m-aviso"><b>Exemplo.</b>&nbsp;Nenhum mês saiu ainda; as datas dos meses futuros são calculadas.</div>');
      var blocoCima = CASO === 'cheio' && CMD ? blocoPadrao() : '', blocoBaixo = CASO === 'cheio' && !CMD ? blocoPadrao() : '';
      return topo + blocoCima + tipos() + (CASO === 'cheio' ? grupoTeste('') + VIDEOS_ANTIGOS : '') + blocoBaixo;
    }
    var m = E.match(/^todos-(.+)$/);
    if (m && GRUPOS[m[1]]) return '<h2 class="m-h2">' + ABAS.filter(function(a){ return a[0] === E; })[0][1] + '</h2><p class="m-muted" style="margin:0 0 14px">Um quadro por estado. As frases são as do spec 04 §14, sem mudança.</p>' + GRUPOS[m[1]]();
    var out = '';
    D.MES.concat(D.PROB).forEach(function(r){ if (r[0] === E) out = quadroMes(r); });
    D.CAN.forEach(function(r){ if (r[0] === E) out = quadroCan(r); });
    PG.forEach(function(p){ if (p[0] === E) out = M.quadro(p[0], p[1], p[2], p[3]); });
    Object.keys(CASAF).forEach(function(k){ if (CASAF[k][0] === E) out = M.quadro(E, CASAF[k][1], CASAF[k][2], CASAF[k][3]); });
    Object.keys(RES).forEach(function(k){ if (RES[k][0] === E) out = M.quadro(E, RES[k][1], RES[k][2], RES[k][3]); });
    T().forEach(function(t){ if (t[0] === E) out = M.quadro(t[0], t[1], t[2], t[3]); });
    return out || '<p>Estado desconhecido.</p>';
  }

  function render(){
    var ids = []; D.MES.concat(D.PROB).forEach(function(r){ ids.push([r[0], r[0].toUpperCase()]); });
    var barra = M.mock((E === 'pagina' ? 'página' : E.toUpperCase()) + ' · ' + CASO + ' · ' + { adm: 'administra', ed: 'edita', le: 'só lê' }[PERFIL], [
      M.grupo('Tela', 'e', ABAS, E),
      M.grupo('Um estado', 'e', D.MES.map(function(r){ return [r[0], r[0].toUpperCase()]; }), E),
      M.grupo('Problema', 'e', D.PROB.map(function(r){ return [r[0], r[0].toUpperCase()]; }).concat(PG.map(function(p){ return [p[0], p[0].replace('pg-', '').toUpperCase()]; })), E),
      M.grupo('Canal removido', 'e', D.CAN.map(function(r){ return [r[0], r[0].toUpperCase()]; }), E),
      M.grupo('Peça 3', 'e', T().map(function(t){ return [t[0], t[0].toUpperCase()]; }), E),
      M.grupo('Automático (peça 4)', 'auto', [['', 'Padrão do caso'], ['ind', 'Ainda não'], ['desl', 'Desligado'], ['lig', 'Ligado'], ['parcial', 'Dois passos'], ['perto', 'Vence'], ['trav', 'Travado'], ['nm', 'Não medido']].concat(INT.MOTIVOS.map(function(m){ return ['desl-' + m[0], 'Parou ' + m[0]]; })), AUTO),
      M.grupo('Caso', 'caso', [['cheio', 'Cheio (03/05/2028)'], ['hoje', 'Hoje (14/10/2026)'], ['magro', 'Magro (20/11/2026)']], CASO),
      M.grupo('Perfil', 'perfil', [['adm', 'Administra'], ['ed', 'Edita'], ['le', 'Só lê']], PERFIL),
      M.grupo('Comando de limpeza', 'cmd', [['sim', 'Em produção'], ['nao', 'Ainda não']], CMD ? 'sim' : 'nao')],
      'Peças 2 e 3 (spec 04 §14.2 e §14.3). Todo número de mês arquivado é exemplo. Carregamento: o corpo dos tipos vem do servidor (sem esqueleto); o bloco “Canais removidos”, a seção “Vídeos antigos” e as simulações vêm por requisição (esqueleto com a altura final da linha: quadro C-CARREGANDO). “Comando de limpeza” escolhe a frase pelo que existe, nunca por data. Perfil só lê: a aba “Arquivo” não aparece na barra; quem chegar pelo endereço lê “Esta página é de quem edita o site.” e quem só lê vê, nas telas de gráficos, “No arquivo desde mm/aaaa.”, sem a porta “Ver antigo”. Na página, “Ver o que sairia”, “Tirar o mês”, “Liberar o espaço” e “Trazer de volta” funcionam; Esc fecha a janela e devolve o foco.');
    document.title = 'Mockup 19: o Arquivo e tirar o mês';
    document.body.innerHTML = barra + M.obs(PERFIL === 'le' ? '' : 'arquivo', CASO, PERFIL === 'le') + '<main id="m-main">' + corpoTela() + '</main>';
    if (E === 'pagina') { var a0 = estadoAuto('dia'); INT.ajustaFaixa(/^desl-/.test(a0) && !VISTO ? 'desl' : (a0 === 'lig' || a0 === 'parcial' || a0 === 'perto' || estadoAuto('hora') === 'lig') ? 'lig' : 'nenhum'); }
  }
  render();

  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-act]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
    var a = b.getAttribute('data-act'); estado.foco = b;
    if (a === 'sair') return abre(dT4(CASO === 'cheio' ? 'a' : ''), b, function(){ swap('m7', 'm8'); });
    if (a === 'liberar') return abre(porId2('t8'), b, function(){ swap('m8', 'm11'); });
    if (a === 'voltar') { swap(null, 'm10'); return; }
    if (a === 'simular') { var rw = b.closest('li.m-mes'); if (rw) { var s0 = rw.querySelector('.m-sim'); if (s0) s0.remove(); else rw.insertAdjacentHTML('beforeend', SIM.replace('class="m-sim"', 'class="m-sim" style="grid-column:1/-1;margin:0"')); return; } var q = b.closest('.m-q-b,.m-card') || b.parentNode; var s = q.querySelector('.m-sim'); if (!s) { b.parentNode.insertAdjacentHTML('afterend', SIM); } return; }
    if (a === 'cmd') { var li = b.closest('li') || b.parentNode; var ex = li.querySelector('.cmdinfo'); if (ex) { ex.remove(); } else if (li.classList.contains('m-can')) li.insertAdjacentHTML('beforeend', CMDHTML.replace('m-cmdlist', 'm-cmdlist cmdinfo')); else li.insertAdjacentHTML('beforeend', '<ol class="m-cmd cmdinfo" style="grid-column:1/-1;padding-left:28px;border:1px solid var(--border);border-radius:8px;background:var(--surface)"><li>No Mac, rode: <code>npx tsx scripts/obs-arquivo.ts conferir-b2 --mes 2027-11</code>. Ele confere o B2 e grava o resultado; rodar de novo é sempre seguro.</li><li>A linha confirma sozinha em até 12 horas.</li></ol>'); return; }
    if (a === 'apagar') return abre(porId2('c-apagar'), b);
    if (a === 'encerrar') { b.closest('section').outerHTML = grupoTeste('encerrado'); return; }
  });
  function porId2(id){ var t = T().concat(GRUPOS_X()).filter(function(x){ return x[0] === id; })[0]; var h = t[3]; return h; }
  function GRUPOS_X(){ var d = document.createElement('div'); d.innerHTML = GRUPOS.canais(); return [['c-apagar', '', '', (d.querySelector('#q-c-apagar .m-dlg') || {}).outerHTML || '']]; }
  function swap(de, para){
    var gatilho = estado.foco; var row = gatilho && gatilho.closest('li'); if (!row) return;
    var nome = row.querySelector('.m-mn').textContent;
    if (para === 'm8') row.outerHTML = linhaMes(porId(D.MES, 'm8'), { nome: nome }).replace('02/05/2028', '03/05/2028').replace('09/05/2028', '10/05/2028');
    else row.outerHTML = linhaMes(porId(D.MES, para), { nome: nome });
  }
})();
