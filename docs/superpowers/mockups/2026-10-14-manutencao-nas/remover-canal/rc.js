/* rc.js: diálogo "Remover canal" com a linha do arquivo (fase de manutenção, M4; PLANO-DAS-TELAS seção 2 + REVISAO-LOGAN-PLANO C1 a C6, 11.1 a 11.10).
   ?e=d0|d1|d2|d2c|d3|d4a|d4b|d4c|d5|d6|d7|d7r|d8|d58|d9  &cap=nn|ns|ss (comando de limpeza | bloco "Canais removidos": Não|Não, Não|Sim, Sim|Sim)
   &casa=fora  &quem=adm|ed  &n=1|2 (meses em D7)  &dt=antes|depois  &nome=curto|longo  &r=r1|r2|r3 (retorno depois do clique, com o diálogo fechado)  &tema=claro
   Hoje = 14/10/2026. Todo número é exemplo. O estado padrão é D3 Não|Não: depois de 28/11 é o caso normal (Logan C1). */
(function(){
  'use strict';
  var P = new URLSearchParams(location.search);
  function g(k, d){ return P.get(k) || d; }
  var E = g('e', 'd3'), CAP = g('cap', 'nn'), R = P.get('r'), CASA = g('casa', '') === 'fora', QUEM = g('quem', 'adm'), NM = g('n', '1'), DT = g('dt', 'antes'), NOMEQ = g('nome', 'curto'), CLARO = g('tema', '') === 'claro';
  if (CLARO) document.documentElement.setAttribute('data-theme', 'light');
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var NOME = NOMEQ === 'longo' ? 'Mochilão ✈️ pelo Mundo: viagens de baixo custo, trilhas e vida na estrada em 40 países, com o Thiago e a Ana' : 'Mochilão ✈️ pelo Mundo';
  var CMD = CAP === 'ns' ? 'chega em 12/12' : 'ainda não tem data para chegar';   /* a tela escreve uma das duas, conforme o comando exista ou tenha data */

  /* ------------------------------------------------------------ ícones (a 16 px, traço 1,5 px) */
  function svg(c, p){ return '<svg class="rc-ico ' + (c || '') + '" viewBox="0 0 16 16" aria-hidden="true">' + p + '</svg>'; }
  var IC = {
    arq: svg('', '<rect x="2" y="3" width="12" height="3.5" rx="1"/><path d="M3 6.5V13h10V6.5M6.5 9.5h3"/>'),
    tri: svg('rc-ic-am', '<path d="M8 2.2 14.4 13.4H1.6Z"/><path d="M8 6.6v3.2M8 11.5v.1"/>'),
    oct: svg('rc-ic-vm', '<path d="M5.2 1.8h5.6l3.4 3.4v5.6l-3.4 3.4H5.2L1.8 10.8V5.2z"/><path d="M8 4.8v3.8M8 11v.1"/>'),
    pont: svg('rc-ic-pt', '<circle cx="8" cy="8" r="6.2" stroke-dasharray="2.4 2.2"/>'),
    ok: svg('rc-ic-ok', '<circle cx="8" cy="8" r="6.2"/><path d="M5.2 8.3 7.2 10.3 10.9 6"/>'),
    info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.9v.1"/></svg>'
  };
  function ib(id, rot){ return '<button type="button" class="rc-ibtn" data-info="' + id + '" aria-expanded="false" aria-label="' + esc(rot) + '">' + IC.info + '</button>'; }
  function infoBox(id, html){ return '<p class="rc-info" id="' + id + '" hidden>' + html + '</p>'; }

  /* ------------------------------------------------------------ a barra de estados (fora da tela) */
  function href(m){ var u = new URLSearchParams(location.search); Object.keys(m).forEach(function(k){ if (m[k] == null) u.delete(k); else u.set(k, m[k]); }); var s = u.toString(); return '?' + s; }
  function grupo(rot, param, itens, atual, extra){
    return '<div class="rc-mk-row"><span class="rc-mk-lbl">' + rot + '</span><div class="rc-mk-items">' + itens.map(function(i){
      var m = {}; m[param] = i[0]; if (extra) Object.keys(extra).forEach(function(k){ m[k] = extra[k]; });
      if (param === 'e') m.r = null; return '<a class="rc-mk" href="' + href(m) + '"' + (atual === i[0] ? ' aria-current="true"' : '') + '>' + i[1] + '</a>'; }).join('') + '</div></div>';
  }
  var EST = [['d0', 'D0 Contando'], ['d1', 'D1 Sem arquivo, sem imagens'], ['d2', 'D2 Sem arquivo, com imagens'], ['d2c', 'D2c Contando as imagens'], ['d3', 'D3 Com arquivo'], ['d4a', 'D4a Meses fora do banco'], ['d4b', 'D4b Vídeos retirados'], ['d4c', 'D4c Os dois'], ['d5', 'D5 Arquivo não lido'], ['d6', 'D6 Casa fora'], ['d7', 'D7 Mês fora das telas'], ['d7r', 'D7r Recusado no clique'], ['d8', 'D8 Contagem do banco falhou'], ['d58', 'D5 + D8'], ['d9', 'D9 A resposta não chegou']];
  var RET = [['r1', 'R1 Sem arquivo'], ['r2', 'R2 Sem arquivo, com imagens'], ['r3', 'R3 Com arquivo']];
  var capNome = { nn: 'Não | Não', ns: 'Não | Sim', ss: 'Sim | Sim' };
  var atualNome = R === 'fechado' ? 'diálogo fechado' : R ? 'retorno ' + R.toUpperCase() : E.toUpperCase();
  var mock = '<details id="mock"' + (P.get('barra') === 'aberta' ? ' open' : '') + '><summary>Estados do mockup (fora da tela)<b>' + atualNome + ' · ' + capNome[CAP] + '</b></summary><div class="rc-mk-in">' +
    grupo('Diálogo', 'e', EST, R ? '' : E) + grupo('Depois do clique', 'r', RET, R || '') +
    grupo('Comando | Bloco', 'cap', [['nn', 'Não | Não (28/11)'], ['ns', 'Não | Sim'], ['ss', 'Sim | Sim']], CAP) +
    grupo('Casa', 'casa', [['', 'Responde'], ['fora', 'Fora há 64 h']], CASA ? 'fora' : '') +
    grupo('Quem abre', 'quem', [['adm', 'Quem administra'], ['ed', 'Quem só edita']], QUEM) +
    grupo('Meses (D7)', 'n', [['1', 'Um mês'], ['2', 'Dois meses']], NM) + grupo('Data (D7)', 'dt', [['antes', 'Antes de 24/10'], ['depois', 'Depois de 24/10']], DT) +
    grupo('Nome', 'nome', [['curto', 'Curto'], ['longo', '100 caracteres']], NOMEQ) + grupo('Tema', 'tema', [['', 'Escuro'], ['claro', 'Claro']], CLARO ? 'claro' : '') +
    '<p class="rc-mk-nota">Selo: ajuste de mockup aprovado: canais.html, 07/10/2026 (diálogo de remover, com a linha “No arquivo”). Hoje = 14/10/2026; todo número é exemplo. O 18 não tem diálogo de remover: a remoção mora na tela Canais (menu, gaveta e linha de erro abrem este mesmo diálogo). “Comando | Bloco” = o comando de limpeza existe em produção? | o bloco “Canais removidos” existe em produção? A tela escolhe a frase pelo que existe, nunca por data. O botão de confirmar só reage nos estados em que ele é oferecido; Esc fecha; no D4, digite o nome sem acento nem emoji para ver o botão liberar.</p>' +
    '</div></details>';

  /* ------------------------------------------------------------ a tela Canais atrás (contexto) */
  function tela(sem){
    var linhas = [['Nômade Raiz', '2,1 mi inscritos'], ['Lucas Bigodinho', '325 mil inscritos'], ['Dale Philip', '3,7 mi inscritos']];
    if (!sem) linhas.splice(1, 0, [NOME, '98 mil inscritos']);
    return '<main id="rc-scr" aria-label="Canais dos competidores (resumo)"><h1>Canais dos competidores</h1><p class="rc-sub">' + (sem ? '3' : '4') + ' canais acompanhados</p><ul class="rc-rows">' + linhas.map(function(l, i){
      var alvo = !sem && i === 1;
      return '<li><span class="rc-av" aria-hidden="true">' + esc(l[0].slice(0, 2)) + '</span><span class="rc-n">' + esc(l[0]) + '<small>' + l[1] + '</small></span>' + (alvo ? '<button type="button" class="btn small" id="rc-open">Remover canal…</button>' : '') + '</li>'; }).join('') + '</ul></main>';
  }

  /* ------------------------------------------------------------ frases por capacidade (PLANO 2.3 e 2.4; Logan C2: itens curtos, uma frase do spec por item) */
  function acontece(){
    var it = ['O site remove o canal agora e marca o arquivo para apagar.'];
    if (CAP === 'ss') { it.push('Os arquivos só somem do NAS e do B2 depois de um comando seu, no Mac, em até 30 dias.'); it.push('A página do Arquivo mostra cada passo e o dia em que acabou.'); }
    else { it.push('Os arquivos só somem do NAS e do B2 depois de um comando seu, no Mac.'); it.push('Esse comando ainda não existe e ' + CMD + '. Até lá o arquivo continua no NAS e no B2.'); it.push('A página do Arquivo vai mostrar cada passo e o dia em que acabou.'); }
    return it;
  }
  function blob(n){
    var f = CAP === 'ss' ? 'O site tenta apagá-las todo dia, e a página do Arquivo mostra quantas faltam.' : CAP === 'ns' ? 'O comando que as apaga ' + CMD + '; até lá elas continuam no Blob, e a página do Arquivo mostra quantas faltam.' : 'O comando que as apaga ' + CMD + '; até lá elas continuam no Blob. A página do Arquivo vai mostrar quantas faltam.';
    return f;
  }
  var CASAF = 'A limpeza do arquivo espera a casa, que não responde desde 17/02 22:10. A remoção vale do mesmo jeito.';

  /* ------------------------------------------------------------ as linhas da lista de perdas */
  function li(num, rot, apoio, cls){ return '<li' + (cls ? ' class="' + cls + '"' : '') + '><b' + (num.wait ? ' class="rc-wait"' : '') + '>' + num.h + '</b><span>' + rot + (apoio ? '<span>' + apoio + '</span>' : '') + '</span></li>'; }
  function N(x){ return { h: x }; }
  function quatro(fase, parcela, pelomenos){
    var w = { h: 'contando…', wait: true };
    if (fase === 'contando') return [li(w, 'versões guardadas'), li(w, 'dias de registros'), li(w, 'vídeos fixados'), li(w, 'trocas salvas no swipe file')].join('');
    function pm(v){ return pelomenos ? { h: '<small>pelo menos</small>' + v } : N(v); }
    var v = pelomenos ? '948' : '1.284', d = pelomenos ? '420' : '812';
    var av = pelomenos ? 'a parte no arquivo ficou fora da conta' : parcela ? '336 no arquivo' : '', ad = pelomenos ? 'a parte no arquivo ficou fora da conta' : parcela ? '392 dias no arquivo' : '';
    return [
      li(pm(v), 'versões guardadas', 'títulos, thumbnails e descrições de 148 vídeos' + (av ? '; ' + av : '')),
      li(pm(d), 'dias de registros', 'views diárias dos vídeos' + (ad ? '; ' + ad : '')),
      li(N('3'), 'vídeos fixados', 'apagados com o canal; se ele voltar, é preciso fixar de novo'),
      li(N('2'), 'trocas salvas no swipe file', 'saem do swipe file junto com o canal')].join('');
  }
  function linhaArq(k){
    var rot = '<span class="rc-arq">' + IC.arq + 'meses no arquivo</span>';
    if (k === 'contando') return li({ h: 'contando…', wait: true }, '<span class="rc-arq">' + IC.arq + 'no arquivo</span>', '', 'rc-arqrow');
    if (k === 'zero') return li({ h: '<span class="rc-zero" aria-label="zero medido">0</span>' }, rot, '', 'rc-arqrow');
    if (k === 'nm') return '<li class="rc-nm"><span class="rc-nmh" role="img" aria-label="não medido"></span><span>Não foi possível ler o arquivo deste canal. Nada foi removido.</span><button type="button" class="btn small" id="rc-retry">Tentar de novo</button></li>';
    return li(N('14'), rot, 'de 08/2025 a 09/2026 (31.402 registros), no NAS e no B2', 'rc-arqrow');
  }
  var TAIL_ALSO = '<p>Também saem as leituras da forja feitas para vídeos deste canal e o histórico de inscritos dele. O canal deixa o observatório e para de sincronizar.</p>';
  var NEVER_SEM = '<p class="rc-never">Não dá para desfazer: se você adicionar o canal de novo, a coleta recomeça do zero e este histórico não volta.</p>';
  var NEVER_COM = '<p class="rc-never"><b>Não dá para desfazer:</b> depois disso não existe cópia dos registros deste canal em lugar nenhum.</p>';
  var LEAD = '<p class="rc-never" id="rcLead">Remover apaga todo o histórico deste canal:</p>';
  var LEAD_FALHOU = '<p class="rc-never" id="rcLead">Remover apaga todo o histórico deste canal: os vídeos, as versões de título, thumbnail e descrição, os registros diários de views, os vídeos fixados e as trocas salvas no swipe file.</p><p class="rc-msg rc-ic-pt">' + IC.tri + '<span>Não foi possível contar o que será apagado. A remoção continua disponível e apaga tudo o que está descrito acima.</span></p>';

  function d4(v){
    var t = v === 'a' ? '13 desses meses (de 08/2025 a 08/2026) já saíram do banco e só existem no arquivo.'
      : v === 'b' ? '18 vídeos deste canal (publicados de 03/2019 a 11/2022) já foram retirados do banco e só existem no arquivo.'
      : '13 meses (de 08/2025 a 08/2026) e 18 vídeos (publicados de 03/2019 a 11/2022) já saíram do banco e só existem no arquivo.';
    return '<div class="rc-d4"><p>' + IC.arq + ' ' + t + ' <b>Eles se perdem de vez.</b> Para continuar, digite o nome do canal:</p><span class="rc-nome" id="rcNome">' + esc(NOME) + '</span><label for="rcIn">Nome do canal</label><input id="rcIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="rcSt"><p class="rc-st" id="rcSt" role="status">Digite o nome do canal para continuar.</p></div>';
  }
  function d7(){
    var meses = NM === '2' ? 'Outubro e novembro de 2026 saíram das telas e o espaço deles ainda não foi liberado.' : 'Outubro de 2026 saiu das telas e o espaço dele ainda não foi liberado.';
    var ate = '', r = '';
    if (E === 'd7r') ate = '<b>Nada foi removido.</b> ';
    if (QUEM === 'adm') ate += DT === 'antes' ? 'O espaço só pode ser liberado a partir de 24/10; até lá, o que dá para fazer é trazer o mês de volta.' : 'Você já pode liberar o espaço ou trazer o mês de volta. <a class="rc-lnk" href="#" onclick="return false">(abrir o Arquivo)</a>';
    else ate += DT === 'antes' ? 'O espaço só pode ser liberado a partir de 24/10; até lá, o que dá para fazer é trazer o mês de volta. Quem só edita o site: peça a quem o administra.' : 'O espaço já pode ser liberado, e o mês também pode voltar, por quem administra o site.';
    var recus = E === 'd7r' ? 'O mês saiu das telas enquanto este diálogo estava aberto. ' : '';
    return '<p class="rc-msg rc-pont" id="rcLead">' + IC.pont + '<span><b>' + recus + meses + '</b> Enquanto isso não dá para remover canal nem apagar vídeo. ' + ate + ' ' + ib('i7', 'Por que não dá para remover agora') + '</span></p>' +
      infoBox('i7', 'Enquanto o mês pode voltar ao banco, remover o canal deixaria, na volta, registros dele sem canal a que pertencer. “Exportar” continua permitido.');
  }

  /* ------------------------------------------------------------ monta o corpo e o rodapé por estado */
  var sizer = ['Remover canal', 'Remover e apagar do arquivo'];
  function btn(label, estado){   /* estado: on | off */
    var com = label === 'Remover e apagar do arquivo' || E === 'd0' && false;
    return '<button type="button" class="btn danger rc-big" id="rcYes"' + (estado === 'off' ? ' aria-disabled="true" aria-describedby="rcSt0"' : '') + '>' + sizer.map(function(s){ return '<span' + (s === label ? ' class="on"' : '') + '>' + s + '</span>'; }).join('') + '</button>';
  }
  var body = '', acts = '', status = '', tituloExtra = '';
  var CANCEL = '<button type="button" class="btn" id="rcNo">Cancelar</button>';
  var COM = ['d3', 'd4a', 'd4b', 'd4c', 'd6', 'd8'].indexOf(E) >= 0;
  var meio = 'Remover e apagar do arquivo';
  if (E === 'd0') {
    body = LEAD + '<ul class="rc-loss" aria-busy="true">' + quatro('contando') + linhaArq('contando') + '</ul>' + TAIL_ALSO + NEVER_SEM;
    acts = CANCEL + btn('Remover canal', 'off'); status = 'Contando o que será apagado. Remover canal fica disponível quando a contagem chegar.';
  } else if (E === 'd1') {
    body = LEAD + '<ul class="rc-loss">' + quatro('ok') + linhaArq('zero') + '</ul><p class="rc-never">Este canal não tem cópia no arquivo. Ao remover, não sobra nada a limpar.</p>' + TAIL_ALSO + NEVER_SEM;
    acts = CANCEL + btn('Remover canal', 'on'); status = 'Contagem pronta. Sem cópia no arquivo.';
  } else if (E === 'd2' || E === 'd2c') {
    var c = E === 'd2c';
    body = LEAD + '<ul class="rc-loss"' + (c ? ' aria-busy="true"' : '') + '>' + quatro('ok') + linhaArq('zero') + '</ul>' +
      (c ? '<p class="rc-msg rc-pont">' + IC.pont + '<span>Contando as imagens guardadas no Blob…</span></p>' :
        '<p class="rc-msg rc-pont">' + IC.pont + '<span><b>Este canal não tem cópia no arquivo, mas tem 9 imagens guardadas no Blob</b> ' + ib('iB', 'O que é o Blob') + '. Ao remover, elas ficam anotadas para apagar. ' + blob() + '</span></p>' + infoBox('iB', 'Blob é o armazenamento de imagens do site, na Vercel.')) + TAIL_ALSO + NEVER_SEM;
    acts = CANCEL + btn('Remover canal', c ? 'off' : 'on'); status = c ? 'Contando as imagens do canal. Remover canal fica disponível quando a contagem chegar.' : 'Contagem pronta. Nove imagens no Blob.';
  } else if (COM) {
    var par = E.indexOf('d4') === 0;
    var abertura = E === 'd8' ? LEAD_FALHOU + '<ul class="rc-loss">' + linhaArq('arq') + '</ul>' : LEAD + '<ul class="rc-loss">' + quatro('ok', par) + linhaArq('arq') + '</ul>';
    var casaLi = (E === 'd6' && CAP === 'ss') ? '<li class="rc-casa">' + IC.oct + '<span>' + CASAF + '</span></li>' : '';
    body = abertura + NEVER_COM + '<p class="rc-h">O que acontece: ' + ib('iA', 'O que acontece com o arquivo') + '</p>' + infoBox('iA', 'Antes, o arquivo de um canal removido ficava no NAS e no B2 para sempre. Agora vai junto, para o dado não sobrar anos depois. Depois disso, os snapshots do NAS ainda guardam o canal por um prazo (a página mostra a data).') +
      '<ul class="rc-ul">' + acontece().map(function(x){ return '<li>' + x + '</li>'; }).join('') + casaLi + '</ul>' + TAIL_ALSO + (par ? d4(E === 'd4a' ? 'a' : E === 'd4b' ? 'b' : 'c') : '');
    acts = CANCEL + btn(meio, par ? 'off' : 'on'); status = par ? 'Digite o nome do canal para continuar.' : 'Contagem pronta. Catorze meses no arquivo.';
    if (par) acts = acts.replace('aria-describedby="rcSt0"', 'aria-describedby="rcSt"');
  } else if (E === 'd5' || E === 'd58') {
    var ambos = E === 'd58';
    body = (ambos ? LEAD_FALHOU : LEAD) + '<ul class="rc-loss">' + (ambos ? '' : quatro('ok', false, true)) + linhaArq('nm') + '</ul>' + TAIL_ALSO + NEVER_SEM;
    acts = CANCEL; status = 'Não foi possível ler o arquivo deste canal. Remover fica disponível quando a leitura der certo.';
    body = body.replace('</ul>', '</ul><p class="rc-st" id="rcSt0" style="margin:0 0 12px">' + IC.tri + 'Remover fica disponível quando a leitura do arquivo der certo.</p>');
  } else if (E === 'd7' || E === 'd7r') {
    body = d7(); acts = '<button type="button" class="btn" id="rcNo">Fechar</button>'; status = 'Não dá para remover canal agora: o mês saiu das telas.';
  } else if (E === 'd9') {
    body = '<p class="rc-msg rc-amar" id="rcLead">' + IC.tri + '<span><b>Não foi possível confirmar se o canal foi removido: a conexão caiu.</b> Recarregue a lista para ver.</span></p>';
    acts = '<button type="button" class="btn" id="rcNo">Fechar</button><button type="button" class="btn primary" id="rcReload">Recarregar a lista</button>'; status = 'Não foi possível confirmar se o canal foi removido: a conexão caiu. Recarregue a lista para ver.';
  }

  /* ------------------------------------------------------------ o retorno depois do clique (PLANO 2.3/2.4; Logan C3: persistente, neutro quando há algo a fazer) */
  function retorno(k){
    var cmd = CAP === 'ss' ? '' : CMD;
    var casaTxt = CASA ? ' A casa não responde desde 17/02 22:10: a limpeza espera ela voltar.' : '';
    if (k === 'r1') return { ok: true, tit: 'Canal removido em 14/10', txt: 'Não havia arquivo: nada a limpar.', persist: false };
    if (k === 'r2') return { ok: false, tit: 'Canal removido em 14/10', txt: 'Não havia arquivo, mas 9 imagens do canal ainda estão no Blob. ' + (CAP === 'ss' ? 'O site tenta apagá-las todo dia, e a página do Arquivo mostra quantas faltam.' : 'O comando que as apaga ' + cmd + '; até lá não há nada a fazer.'), persist: false };
    var t = CAP === 'ss' ? 'Falta apagar o arquivo dele: 14 meses. <b>Próximo passo: rodar o comando no Mac até 13/11 (30 dias).</b> Ponha um lembrete no celular: a página do Arquivo só avisa quando você a abre.'
      : 'Falta apagar o arquivo dele: 14 meses. O comando para isso ' + cmd + '; até lá não há nada a fazer.';
    return { ok: false, tit: 'Canal removido em 14/10', txt: t + casaTxt, persist: true, prazo: CAP === 'ss' };
  }
  function toast(k){
    var r = retorno(k);
    return '<div class="rc-toast ' + (r.ok ? 'ok' : '') + '" role="status" id="rcToast"><h3>' + (r.ok ? IC.ok : IC.arq) + '<span>' + esc(r.tit) + '</span></h3><p>' + r.txt + '</p><div class="rc-t-a">' +
      (r.persist ? '<span class="rc-t-n">Fica na tela até você tocar em Entendi.</span>' + (r.prazo ? '<button type="button" class="btn small" id="rcCmd">Ver os comandos</button>' : '') + '<button type="button" class="btn small" id="rcOk">Entendi</button>' : '<span class="rc-t-n">Some sozinho em 8 s (o mockup não o esconde).</span>') + '</div></div>';
  }

  /* ------------------------------------------------------------ página */
  var abertoDlg = !R;
  var dlg = '<div class="rc-modal" id="rc-modal" role="dialog" aria-modal="true" aria-labelledby="rcT" aria-describedby="rcLead"><div class="rc-box"><div class="rc-body"><h2 id="rcT"' + (document.getElementById && E.indexOf('d4') === 0 ? ' class="rc-clamp" title="' + esc(NOME) + '"' : '') + '>Remover ' + esc(NOME) + '?</h2>' + body + '</div><p class="rc-sr" id="rcSt0b" role="status">' + esc(status) + '</p><div class="rc-acts">' + acts + '</div></div></div>';
  var FECH = R === 'fechado';
  document.body.innerHTML = mock + tela(!!R && !FECH) + (FECH ? '' : R ? toast(R) : dlg);
  var cap = document.title = 'Remover canal (mockup)';
  function medirBarra(){ var m = document.getElementById('mock'); document.documentElement.style.setProperty('--rc-top', m.getBoundingClientRect().height + 'px'); }
  medirBarra(); document.getElementById('mock').addEventListener('toggle', medirBarra); addEventListener('resize', medirBarra);
  /* o bloco do D5 usa #rcSt0 para descrever; no resto, o status vive em #rcSt0b */
  document.querySelectorAll('[data-info]').forEach(function(b){ b.addEventListener('click', function(){ var t = document.getElementById(b.getAttribute('data-info')), a = t.hidden; t.hidden = !a; b.setAttribute('aria-expanded', String(a)); }); });
  var no = document.getElementById('rcNo'), yes = document.getElementById('rcYes'), rt = document.getElementById('rc-retry'), op = document.getElementById('rc-open'), tk = document.getElementById('rcOk'), rl = document.getElementById('rcReload');
  function irPara(m){ var u = new URLSearchParams(location.search); Object.keys(m).forEach(function(k){ if (m[k] == null) u.delete(k); else u.set(k, m[k]); }); location.search = u.toString(); }
  if (no) { no.focus({ preventScroll: true }); if (document.getElementById('rcIn')) { document.getElementById('rcIn').scrollIntoView({ block: 'nearest' }); var rb = document.querySelector('.rc-body'); rb.scrollTop = rb.scrollHeight; } no.addEventListener('click', function(){ irPara({ r: 'fechado' }); }); }
  if (op) op.addEventListener('click', function(){ irPara({ r: null }); });
  if (rl) rl.addEventListener('click', function(){ irPara({ e: null, r: 'fechado' }); });
  if (tk) tk.addEventListener('click', function(){ document.getElementById('rcToast').hidden = true; });
  addEventListener('keydown', function(e){ if (e.key === 'Escape' && !R) irPara({ r: 'fechado' }); });
  if (rt) rt.addEventListener('click', function(){ rt.textContent = 'Lendo o arquivo…'; rt.setAttribute('aria-busy', 'true'); setTimeout(function(){ rt.textContent = 'Tentar de novo'; rt.removeAttribute('aria-busy'); }, 1200); });
  /* clique em confirmar: leva ao retorno que combina com o estado */
  function liberado(){ return yes && yes.getAttribute('aria-disabled') !== 'true'; }
  if (yes) yes.addEventListener('click', function(){ if (!liberado()) return; irPara({ r: E === 'd1' ? 'r1' : E === 'd2' ? 'r2' : 'r3' }); });
  /* D4: normaliza o que foi digitado e o nome do canal do mesmo jeito: sem emoji e símbolos, sem acento, sem espaço repetido, sem diferença de maiúscula (Logan C5) */
  function norm(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\p{Extended_Pictographic}\p{S}️‍]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  var inp = document.getElementById('rcIn'), st = document.getElementById('rcSt');
  if (inp) inp.addEventListener('input', function(){
    var ok = norm(inp.value) === norm(NOME) && norm(inp.value) !== '';
    if (ok) { yes.removeAttribute('aria-disabled'); yes.removeAttribute('aria-describedby'); st.className = 'rc-st ok'; st.innerHTML = IC.ok + 'Nome confirmado.'; }
    else { yes.setAttribute('aria-disabled', 'true'); yes.setAttribute('aria-describedby', 'rcSt'); st.className = 'rc-st'; st.textContent = 'Digite o nome do canal para continuar.'; }
  });
  window.RC = { norm: norm };
})();
