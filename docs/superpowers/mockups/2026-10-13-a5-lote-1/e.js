/* e.js: mockup E, fila "Saíram do YouTube" (spec 01, 4.5; mockup 10 do spec). Uma aba nova do Observatório, com contador.
   ?caso=cheia|vazia|confirmar|confirmar-pronto|confirmar-canal|confirmar-comentarios|apagar-mantido|recusa|apagando|voltou  ?tema=claro. Agora = 13/10. Tudo é exemplo (canais e vídeos inventados; os códigos do YouTube são fictícios).
   RODADA 2: comentário de terceiros apagado no YouTube VAI para a fila (decisão do dono) e passa pelo mesmo painel "o que some / o que fica"; nenhum apagar sem painel, nem a partir de "Mantido";
   "apagando" é visível, tem bloco próprio e entra no contador.
   Regras do spec: sem resposta o dado fica; canal que saiu inteiro é UM item; "apagar" pede digitar APAGAR e mostra antes a contagem; recusa enquanto a forja lê o vídeo; "apagando" enquanto faltar miniatura ou arquivo; "voltou ao ar"; o YouTube não diz o motivo. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, q = A.q, esc = A.esc;
  var caso = q.get('caso') || 'cheia';
  var vazia = caso === 'vazia';
  /* ---------------------------------------------------------------- os itens (exemplo) */
  var VID = [
    { id: 'v1', k: 'video', t: 'Tailândia em 10 dias: o roteiro completo', canal: 'Nômade Raiz', dur: '18:42', pub: '14/07/2026', visto: '20/07/2026', desde: '03/10', dias: 10, leitura: '02/10', views: '184 mil', likes: '9,1 mil', com: '412', canalNoAr: true, cod: 'JdZ3kQp8w1s',
      gs: '41 dias de views, 3 títulos, 2 miniaturas, 1 descrição, 5 mudanças', some: [['1', 'vídeo'], ['41', 'dias de views por dia'], ['12', 'leituras das primeiras horas'], ['3', 'versões de título'], ['2', 'versões de miniatura e os 2 arquivos delas'], ['1', 'versão de descrição'], ['5', 'mudanças registradas'], ['2', 'leituras da forja'], ['1', 'vez salvo e fixado'], ['', 'Este vídeo deixa de contar nas medidas do canal']], nas: 0 },
    { id: 'v2', k: 'video', t: 'Os 5 piores erros em Bangkok', canal: 'Nômade Raiz', dur: '11:05', pub: '02/08/2026', visto: '05/08/2026', desde: '08/10', dias: 5, leitura: '07/10', views: '96 mil', likes: '4,4 mil', com: '187', canalNoAr: true, cod: 'Qm8Lx2VnT4c', gs: '32 dias de views, 1 título, 1 miniatura, 2 mudanças', some: [['1', 'vídeo'], ['32', 'dias de views por dia'], ['9', 'leituras das primeiras horas'], ['1', 'versão de título'], ['1', 'versão de miniatura e o arquivo dela'], ['2', 'mudanças registradas'], ['1', 'leitura da forja em andamento'], ['', 'Este vídeo deixa de contar nas medidas do canal']], nas: 0 },
    { id: 'v3', k: 'video', t: 'O truque do Wi-Fi que os hotéis escondem', canal: 'Lucas Bigodinho', dur: '07:58', pub: '21/09/2026', visto: '22/09/2026', desde: '10/10', dias: 3, leitura: '09/10', views: '412 mil', likes: '21 mil', com: '1,9 mil', canalNoAr: true, cod: 'Nw4Rk7TyP0e', gs: '18 dias de views, 2 títulos, 3 miniaturas, 6 mudanças', some: [['1', 'vídeo'], ['18', 'dias de views por dia'], ['4', 'leituras das primeiras horas'], ['2', 'versões de título'], ['3', 'versões de miniatura e os 3 arquivos delas'], ['6', 'mudanças registradas'], ['', 'Este vídeo deixa de contar nas medidas do canal']], nas: 0 },
    { id: 'c1', k: 'canal', t: 'Paddy Doyle', canal: '', desde: '06/10', dias: 7, leitura: '05/10', ins: '341 mil inscritos', views: '2,1 mi', nVid: 13, canalNoAr: false, cod: 'UCpd7Lw3Rz9QxK1mT8vNa2Hg',
      gs: '13 vídeos, 412 dias do canal, 2.318 dias de views por vídeo, 39 títulos, 27 miniaturas', some: [['1', 'canal'], ['13', 'vídeos acompanhados'], ['2.318', 'dias de views por vídeo'], ['412', 'dias de inscritos e views do canal'], ['39', 'versões de título'], ['27', 'arquivos de miniatura'], ['184', 'mudanças registradas'], ['11', 'leituras da forja'], ['', 'Este canal deixa de contar nas medidas do nicho']], nas: 2 },
    { id: 'm1', k: 'comentarios', t: '7 comentários de 2 vídeos', canal: 'Nômade Raiz', desde: '09/10', dias: 4, leitura: '08/10', vids: ['Chiang Mai para nômades digitais (4 comentários)', 'Quanto custa viajar pelo Vietnã (3 comentários)'], cod: '', gs: '7 textos de comentário e as contagens por marco', some: [['7', 'textos de comentário, de terceiros (4 em um vídeo, 3 em outro)'], ['21', 'contagens de curtidas e respostas, por marco de tempo'], ['', 'Os 7 comentários deixam de contar nas medidas dos dois vídeos']], nas: 0 }
  ];
  /* um vídeo que o dono MANTEVE e agora pode apagar: o botão "Apagar…" de "Já respondidos" abre o mesmo painel */
  var MAN = { id: 'mn1', k: 'video', t: 'Lisboa em 5 dias com 300 euros', canal: 'Vou sem volta', cod: 'Hs4Tn9Wq2Lb', nas: 0,
    some: [['1', 'vídeo'], ['27', 'dias de views por dia'], ['6', 'leituras das primeiras horas'], ['2', 'versões de título'], ['1', 'versão de miniatura e o arquivo dela'], ['3', 'mudanças registradas'], ['', 'Este vídeo deixa de contar nas medidas do canal']] };
  var itens = vazia ? [] : caso === 'voltou' ? VID.slice(0, 2) : VID;
  var qtd = itens.length, nV = itens.filter(function(i){ return i.k === 'video'; }).length, nC = itens.filter(function(i){ return i.k === 'canal'; }).length, nM = itens.filter(function(i){ return i.k === 'comentarios'; }).length;
  var apagandoN = vazia ? 0 : 2, voltaPend = caso === 'voltou' ? 1 : 0, contador = qtd + apagandoN + voltaPend;
  if (caso === 'apagando') { itens = []; qtd = nV = nC = nM = 0; contador = apagandoN; }
  var abre = { confirmar: 'v1', 'confirmar-pronto': 'v1', recusa: 'v2', 'confirmar-canal': 'c1', 'confirmar-comentarios': 'm1', 'apagar-mantido': 'mn1' }[caso] || null;

  var KIND = { video: [L.IC.video, 'Vídeo'], canal: [L.IC.canal, 'Canal inteiro'], comentarios: [L.IC.comentario, 'Comentários'] };
  function pl(n, a, b){ return L.pl(n, a, b); }
  /* ---------------------------------------------------------------- o painel de confirmação: o que some e o que fica (o mesmo para vídeo, canal inteiro e comentários) */
  function confirmacao(i){
    var recusa = caso === 'recusa' && i.id === abre, pronto = caso === 'confirmar-pronto', canal = i.k === 'canal', com = i.k === 'comentarios';
    var some = '<ul class="sq-ul some">' + i.some.map(function(x){ return x[0] === '' ? '<li class="ef"><b class="num" aria-hidden="true">→</b><span>' + x[1] + '</span></li>' : '<li><b class="num">' + x[0] + '</b><span>' + x[1] + '</span></li>'; }).join('') + '</ul>';
    var fica = '<ul class="sq-ul fica"><li><span>' + (com ? 'O código de cada comentário no YouTube e a data desta decisão. Nenhum texto, nome ou contagem.' : 'O código ' + (canal ? 'do canal' : 'do vídeo') + ' no YouTube (<span class="num">' + esc(i.cod) + '</span>) e a data desta decisão. Nenhum título, número ou imagem.') + '</span></li>' +
      (canal ? '<li><span>Os seus outros 6 canais e tudo o que é deles.</span></li>' : com ? '<li><span>Os 2 vídeos e o canal ' + esc(i.canal) + '.</span></li>' : '<li><span>O canal ' + esc(i.canal) + ' e os outros vídeos dele.</span></li>') + '</ul>';
    var nao = '<h5>O que não sai com o apagar</h5><ul class="sq-ul fora-dele"><li><span>Texto copiado ou enviado para uma IA fora daqui: o sistema não alcança.</span></li><li><span>' + (i.nas ? '<b>' + pl(i.nas, 'arquivo', 'arquivos') + ' no NAS</b> com dado ' + (canal ? 'deste canal' : 'deste vídeo') + '. Preparamos os comandos para você apagar lá; o item só conta como concluído quando você marcar que rodou.' : 'Cópias no arquivo do NAS: nenhuma para ' + (canal ? 'este canal' : com ? 'estes comentários' : 'este vídeo') + '.') + '</span></li></ul>';
    var rec = recusa ? '<p class="sq-recusa" role="alert">' + L.IC.relogio + '<span><b>A forja está lendo este vídeo agora.</b> Tente de novo em até 20 minutos: apagar no meio da leitura deixaria o resultado dela sem lugar para ir.</span></p>' : '';
    var que = canal ? 'este canal inteiro' : com ? 'estes 7 comentários' : 'este vídeo';
    return '<div class="sq-cf" id="cf-' + i.id + '"' + (abre === i.id ? '' : ' hidden') + '><p class="sq-cft">' + L.IC.aviso + '<span><b>Apagar ' + que + ' para sempre?</b> Não dá para desfazer. Se ' + (com ? 'voltarem ao YouTube, entram de novo como novos' : (canal ? 'ele' : 'o vídeo') + ' voltar ao YouTube, entra de novo como novo') + ', sem este histórico.</span></p>' + rec +
      '<div class="sq-2c"><section class="sq-col"><h4><span class="sq-mk x">' + L.IC.x + '</span>O que some</h4>' + some + '</section><section class="sq-col"><h4><span class="sq-mk ok">' + L.IC.ok + '</span>O que fica</h4>' + fica + nao + '</section></div>' +
      '<div class="sq-dig"><label for="in-' + i.id + '">Para confirmar, digite <b class="num">APAGAR</b></label><input id="in-' + i.id + '" class="sq-in" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + (pronto && i.id === abre ? 'APAGAR' : '') + '"' + (recusa ? ' disabled' : '') + '></div>' +
      '<p class="sq-ba"><span class="btn" role="button" tabindex="0" data-fecha="' + i.id + '">Cancelar</span><span class="btn perigo' + (pronto && i.id === abre ? ' pronto' : '') + '" role="button" tabindex="0" id="ap-' + i.id + '" aria-disabled="' + (pronto && i.id === abre ? 'false' : 'true') + '">Apagar para sempre</span></p></div>';
  }
  /* ---------------------------------------------------------------- um item da fila (curto: o detalhe do que há guardado e o que some mora no painel) */
  function item(i){
    var k = KIND[i.k], quando = 'Não veio mais do YouTube desde ' + i.desde + ' (' + pl(i.dias, 'dia', 'dias') + ')';
    var fatos = '', corpo;
    if (i.k === 'video') {
      fatos = '<div><dt>Última contagem <small>(leitura de ' + i.leitura + ')</small></dt><dd><span class="num">' + i.views + '</span> views · <span class="num">' + i.likes + '</span> curtidas · <span class="num">' + i.com + '</span> comentários</dd></div>' +
        '<div><dt>O canal</dt><dd>' + (i.canalNoAr ? 'continua no ar' : 'também saiu') + '</dd></div><div class="sq-w2"><dt>Guardado</dt><dd>' + i.gs + '</dd></div>';
      corpo = '<span class="sq-th" style="background:' + L.cor(i.t) + '" aria-hidden="true">' + L.IC.video + '</span><div class="sq-main"><h3>' + esc(i.t) + '</h3><p class="sq-l2">' + esc(i.canal) + ' · vídeo longo · ' + i.dur + ' · publicado em ' + i.pub + ' · visto pela 1ª vez em ' + i.visto + '</p><dl class="sq-f">' + fatos + '</dl>';
    } else if (i.k === 'canal') {
      fatos = '<div><dt>Última contagem <small>(leitura de ' + i.leitura + ')</small></dt><dd><span class="num">' + i.ins + '</span> · <span class="num">' + i.views + '</span> views no total</dd></div><div><dt>O canal</dt><dd><b>saiu inteiro</b>, com os ' + i.nVid + ' vídeos dele</dd></div><div class="sq-w2"><dt>Guardado</dt><dd>' + i.gs + '</dd></div>';
      corpo = '<span class="sq-th canal" style="background:' + L.cor(i.t) + '" aria-hidden="true">' + L.IC.canal + '</span><div class="sq-main"><h3>' + esc(i.t) + '</h3><p class="sq-l2">Viagem · ' + i.ins + ' · um item só, não um por vídeo</p><dl class="sq-f">' + fatos + '</dl>';
    } else {
      fatos = '<div class="sq-w2"><dt>Vídeos dos comentários</dt><dd>' + i.vids.map(esc).join(' · ') + '</dd></div><div><dt>Última conferência</dt><dd>' + i.leitura + '</dd></div><div><dt>Guardado</dt><dd>' + i.gs + '</dd></div>';
      corpo = '<span class="sq-th com" aria-hidden="true">' + L.IC.comentario + '</span><div class="sq-main"><h3>' + esc(i.t) + '</h3><p class="sq-l2">' + esc(i.canal) + ' · comentários de terceiros, agrupados por vídeo</p><dl class="sq-f">' + fatos + '</dl>';
    }
    var apagarTxt = i.k === 'canal' ? 'Apagar o canal…' : i.k === 'video' ? 'Apagar o vídeo…' : 'Apagar os textos…';
    return '<article class="sq-it ' + i.k + '" aria-labelledby="t-' + i.id + '"><header class="sq-hd"><span class="sq-k ' + i.k + '">' + k[0] + '<span>' + k[1] + '</span></span><span class="sq-w">' + quando + '</span></header>' +
      '<div class="sq-bd">' + corpo.replace('<h3>', '<h3 id="t-' + i.id + '">') + '</div></div>' +
      '<footer class="sq-ft"><span class="btn pri" role="button" tabindex="0">Manter para análise</span><span class="btn perigo" role="button" tabindex="0" data-abre="' + i.id + '" aria-expanded="' + (abre === i.id ? 'true' : 'false') + '" aria-controls="cf-' + i.id + '">' + apagarTxt + '</span></footer>' +
      confirmacao(i) + '</article>';
  }
  /* "voltou ao ar": os dois casos num bloco só, com a diferença dita */
  function voltou(){
    return L.novo('<section class="sq-vl" aria-labelledby="t-vl"><h3 id="t-vl" class="sq-vlh">Voltaram ao ar (2)</h3><p class="sq-l2" style="max-width:80ch">O primeiro tinha sido mantido e continua com todo o histórico. O segundo tinha sido apagado e recomeça do zero, se você quiser voltar a acompanhar.</p><ol class="sq-ls">' +
      '<li><article class="sq-it volta"><header class="sq-hd"><span class="sq-k video">' + L.IC.video + '<span>Vídeo</span></span><span class="sq-w">Voltou ao ar em 11/10 · você tinha mantido</span></header><div class="sq-bd" style="grid-template-columns:minmax(0,1fr)"><div class="sq-main"><h3>Chiang Mai para nômades digitais</h3><p class="sq-l2">Nômade Raiz. Continua com o histórico inteiro; a marca “saiu do YouTube” saiu das telas. Nada a fazer.</p></div></div></article></li>' +
      '<li><article class="sq-it volta" aria-labelledby="t-vt"><header class="sq-hd"><span class="sq-k video">' + L.IC.video + '<span>Vídeo</span></span><span class="sq-w">Voltou ao ar em 11/10 · você apagou em 03/10</span></header><div class="sq-bd"><span class="sq-th" aria-hidden="true">' + L.IC.video + '</span><div class="sq-main"><h3 id="t-vt" class="num" style="font-size:16px">Zk39vPq1Nc7</h3><p class="sq-l2">Só o código do YouTube e as datas: o título, os números e as imagens foram apagados e não voltam.</p></div></div>' +
      '<footer class="sq-ft"><span class="btn pri" role="button" tabindex="0">Voltar a acompanhar</span><span class="btn" role="button" tabindex="0">Ignorar</span><span class="sq-hint">“Voltar” começa um histórico novo, do zero. “Ignorar” não pergunta de novo.</span></footer></article></li></ol></section>', 'novo', 'sq-vn');
  }
  /* ---------------------------------------------------------------- o resumo e a barra por tipo */
  function resumo(){
    if (vazia) return '<div class="sq-res vazia"><p class="sq-fr"><b>Nenhum item esperando.</b> Tudo o que você acompanha continua vindo do YouTube. A fila só enche quando algo some. Última conferência: hoje, às 12:20.</p></div>';
    var partes = []; if (nV) partes.push(pl(nV, 'vídeo', 'vídeos')); if (nC) partes.push(pl(nC, 'canal inteiro', 'canais inteiros')); if (nM) partes.push(pl(nM, 'grupo de comentários', 'grupos de comentários'));
    var tit = (qtd ? pl(qtd, 'item esperando você', 'itens esperando você') : 'Nenhum item esperando você') + (apagandoN ? ' e ' + apagandoN + ' apagando' : '');
    var det = (qtd ? ' ' + partes.join(', ').replace(/, ([^,]*)$/, ' e $1') + (qtd > 1 ? ' esperam' : ' espera') + ' sua resposta. Nenhum destes itens foi apagado; sem resposta, o dado fica. O YouTube não diz por que sumiram.' : '') +
      ' Dos ' + apagandoN + ' que estão sendo apagados, 1 espera você rodar os comandos no NAS.' + (voltaPend ? ' 1 voltou ao ar e espera você decidir se volta a acompanhar.' : '');
    var seg = function(n, k, txt){ return n ? '<li class="sq-sg ' + k + '" style="flex:' + n + ' 1 0"><span class="sq-sgi">' + KIND[k][0] + '</span><span class="sq-sgt"><b class="num">' + n + '</b> ' + txt + '</span></li>' : ''; };
    return '<div class="sq-res"><p class="sq-fr"><b>' + tit + '.</b>' + det + ' ' + A.ibtn('infoSq', 'Como a fila funciona', true) + '</p>' + (qtd ? '<ul class="sq-bar" aria-label="Itens esperando você, por tipo">' + seg(nV, 'video', nV === 1 ? 'vídeo' : 'vídeos') + seg(nC, 'canal', nC === 1 ? 'canal' : 'canais') + seg(nM, 'comentarios', nM === 1 ? 'grupo de comentários' : 'grupos de comentários') + '</ul>' : '') + '</div>';
  }
  var AJUDA = A.oculto('infoSq', 'Como a fila funciona', '<ul><li><b>Quando entra aqui:</b> o vídeo, o canal ou o comentário não veio do YouTube em duas leituras seguidas. Uma leitura só não basta: falha de rede não é sumiço.</li><li><b>Sem resposta, nada acontece:</b> nenhuma rotina apaga por prazo. O dado fica até você decidir.</li><li><b>O motivo:</b> o YouTube devolve a mesma ausência para algo apagado pelo autor, privado, denunciado ou removido por ordem judicial. A tela não adivinha.</li><li><b>Manter:</b> continua em todas as telas com a marca “saiu do YouTube em dd/mm, mantido para análise”. Dá para apagar depois, com o mesmo painel.</li><li><b>Apagar:</b> não dá para desfazer. Pede a palavra APAGAR e mostra antes a contagem do que some e do que fica.</li><li><b>Apagando:</b> falta apagar miniaturas ou arquivos. O item conta no número da aba até acabar.</li></ul>');
  /* ---------------------------------------------------------------- apagando (sempre à vista) e já respondidos (fechado) */
  var P = function(t, ic, c){ return '<span class="sq-st ' + c + '">' + ic + '<span>' + t + '</span></span>'; };
  function tabela(linhas, rotQuando, rotSit){
    return '<div class="tbw"><table class="tb sq-tab"><caption class="sr">Itens ' + (rotSit === 'O que falta' ? 'sendo apagados' : 'já respondidos') + ': só código e datas</caption><thead><tr><th scope="col">Código no YouTube</th><th scope="col">Tipo</th><th scope="col">Situação</th><th scope="col">' + rotQuando + '</th><th scope="col">' + rotSit + '</th><th scope="col"><span class="sr">Ações</span></th></tr></thead><tbody>' +
      linhas.map(function(l){ return '<tr><th scope="row" class="num sq-cod">' + l[0] + '</th><td>' + l[1] + '</td><td>' + l[2] + '</td><td class="num">' + l[3] + '</td><td>' + l[4] + '</td><td><span class="sq-acs">' + l[5] + '</span></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function apagando(){
    if (vazia) return '';
    var linhas = [
      ['8fQm2RtLw0a', 'vídeo', P('Apagando', L.IC.relogio, 'apagando'), '12/10', '<b>faltam 3 miniaturas</b> no Blob; a próxima tentativa conclui sozinha', '<span class="btn" role="button" tabindex="0">Tentar de novo</span>'],
      ['Pk37vNd1Xc4', 'vídeo', P('Apagando', L.IC.relogio, 'apagando'), '30/09', '<b>2 arquivos no NAS</b> esperando você apagar lá', '<span class="btn" role="button" tabindex="0">Ver os comandos</span><span class="btn" role="button" tabindex="0">Já rodei</span>']
    ];
    return L.novo('<section class="sq-ap" aria-labelledby="t-ap"><h3 id="t-ap" class="sq-vlh">Apagando (2)</h3><p class="sq-l2" style="max-width:80ch">Já foram respondidos com “apagar”, mas falta apagar parte. O item só conta como concluído quando acabar.</p>' + tabela(linhas, 'Desde', 'O que falta') + '</section>', 'novo', 'sq-apn');
  }
  function respondidos(){
    if (vazia) return '';
    var linhas = [
      [MAN.cod + '<br><span class="mut" style="font-weight:400">' + esc(MAN.t) + '</span>', 'vídeo', P('Mantido', L.IC.pin, 'mant'), '05/10', 'continua em todas as telas, com a marca “saiu do YouTube em 03/10 · mantido para análise”', '<span class="btn perigo" role="button" tabindex="0" data-abre="mn1" aria-expanded="' + (abre === 'mn1' ? 'true' : 'false') + '" aria-controls="cf-mn1">Apagar…</span>'],
      ['UCw2Qn8Lr5TxZ0bYm4KdFe7A', 'canal', P('Apagado', L.IC.x, 'apag'), '02/10', 'tudo removido, e os arquivos do Blob também', '']
    ];
    return '<details class="sq-rd"' + (abre === 'mn1' ? ' open' : '') + '><summary>Já respondidos (' + linhas.length + ')</summary>' + tabela(linhas, 'Quando', 'Situação') + confirmacao(MAN) + '<p class="nota" style="margin-top:6px">Do que foi apagado ficam só o código e as datas. Nada de título, número ou imagem. “Apagar…” em um item mantido abre o mesmo painel “o que some / o que fica”.</p></details>';
  }
  var lista = itens.length ? '<ol class="sq-ls" aria-label="Itens esperando resposta">' + itens.map(function(i){ return '<li>' + item(i) + '</li>'; }).join('') + '</ol>' : (vazia ? '<p class="sq-vz">' + L.IC.ok + '<span>Quando um vídeo, um canal ou um comentário sumir do YouTube, ele aparece aqui, com o que você tem guardado e a pergunta: manter ou apagar.</span></p>' : '');
  var corpo = L.obs({ aba: 'fila', fila: contador }) + '<div class="sq">' + L.novo(resumo(), 'novo', 'sq-rn') + lista + (caso === 'voltou' ? voltou() : '') + apagando() + respondidos() + '</div>' + AJUDA;
  var CASOS = [['cheia', 'Fila cheia (5 itens)'], ['vazia', 'Fila vazia'], ['confirmar', 'Apagar vídeo: pedindo confirmação'], ['confirmar-pronto', 'Apagar vídeo: APAGAR digitado'], ['confirmar-canal', 'Apagar canal inteiro'], ['confirmar-comentarios', 'Apagar comentários'], ['apagar-mantido', 'Apagar um vídeo mantido'], ['recusa', 'Recusa: a forja está lendo'], ['apagando', 'Só “apagando”'], ['voltou', 'Voltou ao ar']];
  var barra = L.barra([{ rotulo: 'Estado', param: 'caso', itens: CASOS, padrao: 'cheia' }],
    'Contorno verde-água e “+ novo” = o acréscimo: a aba “Saíram do YouTube” e a tela dela. O cabeçalho do Observatório é o já aprovado. Todo nome, número e código aqui é de exemplo. Os botões “Apagar…” abrem o painel de confirmação (o mesmo para vídeo, canal, comentários e item mantido) e o campo APAGAR funciona; o resto é estático.');
  A.moldura({ titulo: 'Saíram do YouTube', barra: barra, corpo: corpo,
    fora: '<table class="tb" style="max-width:820px"><caption>As duas respostas, lado a lado</caption><thead><tr><th scope="col"></th><th scope="col">Manter para análise</th><th scope="col">Apagar</th></tr></thead><tbody>' +
      '<tr><th scope="row">O que acontece</th><td>continua em todas as telas, com a marca “saiu do YouTube em dd/mm · mantido para análise”; entra nas medidas de quando estava no ar</td><td>some o vídeo (o canal, os comentários) com a série, as versões, as miniaturas e as leituras; sobra o código e as datas</td></tr>' +
      '<tr><th scope="row">Dá para desfazer?</th><td>sim: a marca tem “Apagar…”, que abre o mesmo painel</td><td><b>não</b></td></tr>' +
      '<tr><th scope="row">Como se confirma</th><td>um toque</td><td>ler a contagem e digitar APAGAR</td></tr></tbody></table>' });
  A.ligarInfos();
  function abrePainel(b){ var id = b.getAttribute('data-abre'), p = document.getElementById('cf-' + id); if (!p) return; var h = p.hasAttribute('hidden'); if (h) { p.removeAttribute('hidden'); var inp = document.getElementById('in-' + id); if (inp && !inp.disabled) inp.focus(); } else p.setAttribute('hidden', ''); b.setAttribute('aria-expanded', String(h)); }
  function fechaPainel(id){ var p = document.getElementById('cf-' + id); if (p) p.setAttribute('hidden', ''); var a = document.querySelector('[data-abre="' + id + '"]'); if (a) { a.setAttribute('aria-expanded', 'false'); a.focus(); } }
  document.querySelectorAll('[data-abre]').forEach(function(b){ b.addEventListener('click', function(){ abrePainel(b); }); });
  document.querySelectorAll('[data-fecha]').forEach(function(b){ b.addEventListener('click', function(){ fechaPainel(b.getAttribute('data-fecha')); }); });
  document.querySelectorAll('.sq-cf').forEach(function(p){ p.addEventListener('keydown', function(e){ if (e.key === 'Escape') fechaPainel(p.id.replace('cf-', '')); }); });
  /* a trava é a digitação, não a caixa: aceita maiúsculas e minúsculas e espaços nas pontas (teclado de celular com autocorreção) */
  document.querySelectorAll('.sq-in').forEach(function(inp){ inp.addEventListener('input', function(){ var id = inp.id.replace('in-', ''), b = document.getElementById('ap-' + id), ok = inp.value.trim().toUpperCase() === 'APAGAR'; b.setAttribute('aria-disabled', String(!ok)); b.classList.toggle('pronto', ok); }); });
})();
