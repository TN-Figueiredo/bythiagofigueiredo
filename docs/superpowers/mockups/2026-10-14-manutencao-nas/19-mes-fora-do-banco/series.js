/* series.js: peça 1, "desde dd/mm" e "no arquivo" nas telas de série (PLANO seção 5; spec 04 §14.1). Caso cheio: hoje = 03/05/2028, o online começa em 01/10/2027. Todo número de mês arquivado é exemplo.
   ?e=todos|p1-0..p1-12  &caso=cheio|hoje  &perfil=adm|ed|le */
(function(){
  'use strict';
  var Q = M.Q, ic = M.ic, aus = M.aus;
  var E = Q('e', 'todos'), CASO = Q('caso', 'cheio'), PERFIL = Q('perfil', 'adm');
  var SELO = { '13': 'ajuste de mockup aprovado: 13, 13/10/2026', '15': 'ajuste de mockup aprovado: 15, 13/10/2026', '20': 'ajuste de mockup aprovado: 20, 13/10/2026', '21': 'mockup 21: segurado, ainda sem aprovação' };
  function selo(n){ return n.split(',').map(function(x){ return '<span class="m-selo">' + SELO[x.trim()] + '</span>'; }).join(' '); }

  /* ------------------------------------------------------------ peças */
  function seed(n, a){ var r = [], x = a || 7; for (var i = 0; i < n; i++) { x = (x * 9301 + 49297) % 233280; r.push(30 + Math.round(x / 233280 * 62)); } return r; }
  function bars(n, a){ return seed(n, a).map(function(h){ return '<i style="height:' + h + '%"></i>'; }).join(''); }
  function cel(k, t, v, marca){
    if (t === 'arq') return '<div class="m-cel arq"><span class="k">' + k + '</span><span class="v">' + ic('arq') + '<span>no arquivo desde ' + v + '</span></span></div>';
    if (t === 'pont') return '<div class="m-cel" style="border:1.5px dotted var(--dim)"><span class="k">' + k + '</span><span class="v" style="font:500 12.5px/1.35 var(--sans);display:flex;gap:5px">' + ic('pont') + '<span>chega em ' + v + '</span></span></div>';
    return '<div class="m-cel' + (marca ? ' marca' : '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }
  /* idades: lista de [rótulo, tipo, valor, marca]; no modo "antes" todo "arq" volta a ser número (o que o mockup aprovado mostra) */
  var ANTES = { '2 dias': '2,9 mil', '3 dias': '4,1 mil', '5 dias': '6,0 mil', '14 dias': '18,6 mil', '21 dias': '25,3 mil' };
  function idades(list, antes){
    return '<div class="m-idades" role="list">' + list.map(function(c, i){
      var t = c[1], v = c[2];
      if (antes && t === 'arq') { t = 'num'; v = ANTES[c[0]] || '—'; }
      return cel(c[0], t, v, c[3]); }).join('') + '</div>';
  }
  function grafico(segs, eixo, antes){
    return '<div class="m-ex" role="img" aria-label="Eixo do tempo com o trecho no arquivo e o trecho online">' + segs.map(function(s){
      if (antes && (s.t === 'arq')) s = { t: 'onl', fx: s.fx, n: s.n };
      if (s.t === 'arq') return '<div class="m-seg arq"><span class="rot">' + ic('arq') + '<span>' + s.rot + '</span></span></div>';
      if (s.t === 'antes') return '<div class="m-seg antes"><span class="rot">' + ic('pont') + '<span>' + s.rot + '</span></span></div>';
      if (s.t === 'nm') return '<div class="m-seg nm"><span class="rot"><span class="m-hach"></span><span>' + s.rot + '</span></span></div>';
      return '<div class="m-seg onl" style="flex:' + s.fx + ' 1 0">' + bars(s.n, s.n) + '</div>'; }).join('') + '</div>' +
      '<div class="m-eixo"><span>' + eixo[0] + '</span><span class="ini">' + (eixo[2] || '') + '</span><span>' + eixo[1] + '</span></div>';
  }
  function porta(){
    if (PERFIL === 'le') return '';
    return '<div class="m-botoes"><button type="button" class="btn small" data-venantigo>Ver antigo</button><span class="m-muted" style="font-size:12.5px">Ver o que está no arquivo</span></div><p class="m-info" id="vaNota" hidden>Leva ao pedido do período (peça 6), que é desenhado à parte.</p>';
  }
  var CURS = '';
  var APR = { '13': ['13', '2026-10-13-a5-lote-2/13-historico-video-concorrente'], '15': ['15', '2026-10-13-a5-lote-2/15-pagina-canal-concorrente'], '20': ['20', '2026-10-13-a5-lote-2/20-comentarios-de-destaque'], '21': ['21', '2026-10-13-a5-lote-2/21-ritmo-por-hora'] };
  function rotHoje(){
    var ns = CURS.split(',').map(function(x){ return x.trim(); });
    var l = ns.map(function(n){ return '<a href="../../' + APR[n][1] + '/index.html">' + APR[n][0] + '</a>'; });
    var txt = l.join(' e ');
    if (ns.length === 1 && ns[0] === '21') return 'Hoje (trecho reconstruído do ' + txt + ', segurado)';
    return 'Hoje (trecho reconstruído do ' + txt + ' aprovado' + (ns.length > 1 ? 's' : '') + ')';
  }
  function cmp(antes, depois, nota){
    return '<div class="m-q-cmp"><div><span class="m-q-k">' + rotHoje() + '</span>' + antes + '</div><div><span class="m-q-k">Depois da fase</span>' + depois + '</div></div>' + (nota ? '<p class="m-q-nota">' + nota + '</p>' : '');
  }

  /* o vídeo do caso cheio: publicado em 25/08/2027; o vídeo de Out/2027 (destacado) em 12/10/2027 */
  var VID_ARQ = [['1 dia', 'num', '1,2 mil', true], ['2 dias', 'arq', '01/03/2028'], ['3 dias', 'arq', '01/03/2028'], ['5 dias', 'arq', '01/03/2028'], ['7 dias', 'num', '9,8 mil', true], ['14 dias', 'arq', '02/05/2028'], ['21 dias', 'arq', '02/05/2028'], ['30 dias', 'num', '31,5 mil', true], ['60 dias', 'num', '58,4 mil'], ['90 dias', 'num', '71,0 mil']];
  var VID_HOJE = [['1 dia', 'num', '1,2 mil', true], ['2 dias', 'num', '2,9 mil'], ['3 dias', 'num', '4,1 mil'], ['5 dias', 'num', '6,0 mil'], ['7 dias', 'num', '9,8 mil', true], ['14 dias', 'pont', '20/10'], ['21 dias', 'pont', '27/10'], ['30 dias', 'pont', '05/11', true], ['60 dias', 'pont', '05/12'], ['90 dias', 'pont', '04/01']];
  var SEGS_CHEIO = [{ t: 'arq', fx: 37, n: 20, rot: 'no arquivo desde 08/2027' }, { t: 'onl', fx: 215, n: 28 }];

  /* ------------------------------------------------------------ os 13 estados */
  var FR = [
    { id: 'p1-0', t: 'Nada saiu ainda', ap: ['hoje', 'cheio'], f: '04 L73', s: '13', b: function(){
      return cmp(idades(VID_HOJE, true) + grafico([{ t: 'onl', fx: 1, n: 9 }], ['06/10/2026', '14/10/2026']), idades(VID_HOJE) + grafico([{ t: 'onl', fx: 1, n: 9 }], ['06/10/2026', '14/10/2026']),
        'Nada muda. As idades que ainda não chegaram são pontilhadas com a data em que chegam: nunca zero.'); } },
    { id: 'p1-1', t: 'O que está online começa depois do começo do vídeo: “desde dd/mm” junto do número', ap: ['cheio'], f: '04 L74', s: '13, 15', b: function(){
      var d = '<div class="m-hl"><span class="v">3,4 mil</span><span class="d">views por dia, em média <span class="m-num">· desde 01/10/2027</span></span></div><div class="m-hl"><span class="v">12,8 mil</span><span class="d">no melhor dia, 14/11/2027 <span class="m-num">· desde 01/10/2027</span></span></div>';
      var a = '<div class="m-hl"><span class="v">3,1 mil</span><span class="d">views por dia, em média</span></div><div class="m-hl"><span class="v">12,8 mil</span><span class="d">no melhor dia, 14/11/2027</span></div>';
      return cmp(a, d, 'Toda medida calculada sobre os dados por dia diz de quando ela vale, junto do número, em texto apagado. A média muda porque passa a contar só o que está online. O teto fixo de 365 dias sai: o início vem do registro.'); } },
    { id: 'p1-2', t: 'A medida precisa de um ponto que saiu: “no arquivo”, nunca um número interpolado', ap: ['cheio'], f: '04 L69, L75', s: '13', b: function(){
      return cmp(idades(VID_ARQ, true), idades(VID_ARQ), 'Vídeo de 25/08/2027. 1, 7 e 30 dias vêm das marcas e aparecem sempre. As outras vêm dos dados por dia: com o ponto no arquivo, a célula diz desde quando, com a data do seu mês (agosto saiu em 01/03/2028; setembro, que só saiu das telas, em 02/05/2028). Nunca um número no lugar.'); } },
    { id: 'p1-3', t: 'Mês destacado, espaço ainda não liberado', ap: ['cheio'], f: '04 L76', s: '13', b: function(){
      var i = PERFIL === 'adm' ? M.ib('i-p13', 'O que o arquivo permite aqui') + M.infoBox('i-p13', 'Ainda dá para trazer de volta enquanto o espaço não for liberado.') : '';
      var l = [['14 dias', 'arq', '02/05/2028']];
      return cmp(idades(l, true), '<div class="m-idades">' + cel('14 dias', 'arq', '02/05/2028') + '</div><p style="margin:8px 0 0;font-size:13px;color:var(--muted)">Vídeo de 12/09/2027. Setembro de 2027 saiu das telas em 02/05/2028.' + i + '</p>' + (PERFIL === 'adm' ? '' : ''), 'A tela diz o mesmo que para um mês já arquivado e nunca promete prazo para trazer de volta. O ⓘ só aparece para quem administra o site.'); } },
    { id: 'p1-4', t: 'O gráfico alcança o trecho que está no arquivo', ap: ['cheio'], f: '04 L77', s: '13, 15', b: function(){
      var dep = grafico(SEGS_CHEIO, ['25/08/2027', '03/05/2028', 'online desde 01/10/2027']) + '<div class="m-cap">' + (PERFIL === 'le' ? aus('arq', 'No arquivo desde 08/2027.') : '<span class="sub">No arquivo desde 08/2027.</span>' + porta()) + '</div>';
      return cmp(grafico(SEGS_CHEIO, ['25/08/2027', '03/05/2028'], true), dep, 'Três ausências no mesmo eixo, nunca confundidas: o trecho no arquivo tem fundo apagado, contorno sólido, a caixa e o rótulo repetido na borda esquerda. Largura ilustrativa, fora de escala.'); } },
    { id: 'p1-5', t: 'As 72 primeiras horas já saíram do online', ap: ['cheio'], f: '04 L78', s: '13, 15', b: function(){
      var a = '<div class="m-hl"><span class="v">1 h 40</span><span class="d">metade das views, nas 72 primeiras horas</span></div>' + grafico([{ t: 'onl', fx: 1, n: 24 }], ['0 h', '72 h'], true);
      var d = aus('arq', 'As 72 primeiras horas deste vídeo estão no arquivo desde 01/03/2028.', 'A curva não é desenhada. Metade das views em N horas: não dá para calcular sem as horas.');
      return cmp(a, d, 'Forma de “no arquivo”. Nunca hachura (não é falha de leitura) e nunca curva vazia.'); } },
    { id: 'p1-6', t: 'O normal do canal com menos vídeos', ap: ['cheio'], f: '04 L79', s: '15', b: function(){
      var a = '<p style="margin:0">Normal do canal: <b class="m-num">12 mil</b> views em 72 horas.</p>';
      var d = aus('arq', 'Calculado com 38 vídeos; 7 estão no arquivo.') + '<div style="height:8px"></div>' + aus('nm', 'Não medido: desde 01/10/2027 só há 2 vídeos com as 72 horas online.', 'Abaixo de 3 vídeos o normal não é calculado, e o motivo é dito.');
      return cmp(a, d, 'Acima do mínimo de 3: texto com a caixa. Abaixo: hachura rosa com o motivo.'); } },
    { id: 'p1-7', t: 'Período maior que o que há online (6 e 12 meses)', ap: ['cheio', 'hoje'], f: '04 L80', s: '21', b: function(){
      var ini = CASO === 'hoje' ? 'hoje' : 'cheio';
      return cmp('<p style="margin:0">Ritmo por hora, 12 meses.</p>', '<div class="m-segs" role="group" aria-label="Período"><button type="button" data-per="3">3 meses</button><button type="button" data-per="6">6 meses</button><button type="button" data-per="12" aria-pressed="true">12 meses</button></div><div id="perOut" style="margin-top:10px"></div>',
        'Cada botão mostra o que a tela diria. A data vem de “online desde” do tipo de dado; a linha de baixo diz qual dos dois motivos vale: coleta recente ou arquivo.'); } },
    { id: 'p1-8', t: 'Comentário em destaque cujo texto saiu do online', ap: ['cheio'], f: '04 L81', s: '20', b: function(){
      var a = '<div class="m-comm"><div class="top"><span>Comentário de 09/2027</span><span class="m-num">412 curtidas</span></div><p style="margin:0">“Passei por esse trecho em março e o ônibus atrasou 6 horas, vale a dica.”</p></div>';
      var d = '<div class="m-comm"><div class="top"><span>Comentário de 09/2027</span><span class="m-num">412 curtidas · 38 respostas</span></div>' + aus('arq', 'Comentário de 09/2027. O texto está no arquivo e não aparece aqui.') + '</div>';
      return cmp(a, d, 'O cartão mostra a contagem e a data. Nunca vazio e nunca texto inventado.'); } },
    { id: 'p1-9', t: 'Mês no arquivo que estava vazio', ap: ['cheio'], f: '04 L82', s: '13', b: function(){
      return cmp('<p style="margin:0" class="m-muted">Sem leitura em julho de 2027.</p>', aus('zr', 'Sem registro neste mês (conferimos em 03/05/2028).', 'Não é “no arquivo” (havia dado) nem “não medido” (a leitura deu certo).'), 'Caixa vazada com o 0, a do zero medido.'); } },
    { id: 'p1-10', t: 'Antes do começo da coleta', ap: ['cheio', 'hoje'], f: '04 L83, L546', s: '13, 15', b: function(){
      var segs = CASO === 'hoje' ? [{ t: 'antes', fx: 30, rot: 'Antes do início da coleta (03/10/2026)' }, { t: 'onl', fx: 10, n: 8 }] : [{ t: 'antes', fx: 30, rot: 'Antes do início da coleta (03/10/2026)' }, SEGS_CHEIO[0], SEGS_CHEIO[1]];
      return cmp('<p style="margin:0" class="m-muted">O mockup aprovado não distingue o trecho anterior à coleta.</p>', grafico(segs, ['03/2024', CASO === 'hoje' ? '14/10/2026' : '03/05/2028']), 'Pontilhado, nunca a caixa de arquivo: o dado nunca existiu aqui, não saiu do banco. Largura ilustrativa, fora de escala.'); } },
    { id: 'p1-11', t: 'Não medido: desde quando há dado online', ap: ['cheio', 'hoje'], f: '04 L84', s: '13', b: function(){
      return cmp('<p style="margin:0" class="m-muted">Hoje o carregador assume 365 dias.</p>', grafico([{ t: 'nm', rot: 'Não foi possível ler desde quando há dado online.' }], ['', '']), 'A tela não assume 365 dias nem “tudo online”.'); } },
    { id: 'p1-12', t: 'Só leitura: sem a porta, com a frase', ap: ['cheio'], f: '04 L39, L418', s: '13', b: function(){
      var save = PERFIL; PERFIL = 'le';
      var o = cmp(grafico(SEGS_CHEIO, ['25/08/2027', '03/05/2028'], true), grafico(SEGS_CHEIO, ['25/08/2027', '03/05/2028', 'online desde 01/10/2027']) + '<div class="m-cap">' + aus('arq', 'No arquivo desde 08/2027.') + '</div>', 'Quem só lê vê a frase no lugar da porta “Ver antigo”, e não vê as peças 2 a 7. A porta “Ver antigo” é desta fase (peça 6): hoje a tela não a tem.');
      PERFIL = save; return o; } }
  ];

  /* ------------------------------------------------------------ montagem */
  var lista = E === 'todos' ? FR : FR.filter(function(f){ return f.id === E; });
  var corpo = lista.map(function(f){
    CURS = f.s;
    var apl = f.ap.indexOf(CASO) >= 0;
    var b = apl ? f.b() : M.aus('pt', 'Este estado não existe no caso “hoje”: nada saiu do banco ainda.', 'Mude o caso para “Cheio” na barra para ver o quadro.');
    return M.quadro(f.id, f.t, f.f + ' · ' + selo(f.s), b);
  }).join('');
  var itens = [['todos', 'Todos']].concat(FR.map(function(f){ return [f.id, f.id.toUpperCase()]; }));
  var barra = M.mock(E.toUpperCase() + ' · caso ' + CASO + ' · ' + { adm: 'administra', ed: 'edita', le: 'só lê' }[PERFIL], [
    M.grupo('Estado', 'e', itens, E),
    M.grupo('Caso', 'caso', [['cheio', 'Cheio (03/05/2028)'], ['hoje', 'Hoje (14/10/2026)']], CASO),
    M.grupo('Perfil', 'perfil', [['adm', 'Administra'], ['ed', 'Edita'], ['le', 'Só lê']], PERFIL)],
    'Peça 1 (spec 04 §14.1). Todo número de mês arquivado é exemplo; no caso cheio, hoje = 03/05/2028 e o online começa em 01/10/2027. Esta peça mostra o que a leitura do servidor traz junto da série: <b>não há estado carregando</b>. As três ausências do eixo: hachura rosa (não medido), pontilhado (sem contagem, antes da coleta) e fundo apagado com contorno sólido e caixa (no arquivo).');
  var topo = '<h2 class="m-h2">Peça 1: “desde dd/mm” e “no arquivo” nos gráficos e nos números</h2><p class="m-muted" style="margin:0 0 14px;max-width:80ch">Este número está completo, ou falta um pedaço que saiu do banco? A resposta fica junto do número e no eixo. Cada quadro mostra o mockup aprovado e o que muda.</p><p class="m-aviso"><b>Exemplo.</b> Todo número de mês arquivado nestas telas é exemplo; nenhum mês saiu do banco ainda.</p>';
  document.title = 'Mockup 19: desde e no arquivo';
  document.body.innerHTML = barra + M.obs('videos', CASO) + '<main id="m-main">' + topo + M.legenda(false) + corpo + '</main>';

  document.addEventListener('click', function(e){
    var v = e.target.closest && e.target.closest('[data-venantigo]'); if (v) { var n = document.getElementById('vaNota'); if (n) n.hidden = !n.hidden; }
    var p = e.target.closest && e.target.closest('[data-per]'); if (p) { per(p.getAttribute('data-per')); }
  });
  function per(n){
    var out = document.getElementById('perOut'); if (!out) return;
    document.querySelectorAll('[data-per]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-per') === n)); });
    var h;
    if (CASO === 'hoje') h = M.aus('pt', 'Mostrando desde 03/10/2026 (11 dias online). A coleta começou em 03/10/2026.', 'Só há 11 dias de leitura: a coleta é recente. Não há nada no arquivo.');
    else if (n === '3' || n === '6') h = '<p style="margin:0;font-size:13.5px">Mostrando ' + n + ' meses, desde ' + (n === '3' ? '03/02/2028' : '03/11/2027') + '. Tudo está online.</p>';
    else h = M.aus('arq', 'Mostrando desde 01/10/2027 (7 meses online). Os meses anteriores estão no arquivo.', 'Só há 7 meses de leitura: o resto saiu do banco e está no arquivo; não é coleta recente.') + (PERFIL === 'le' ? '' : '<div style="margin-top:8px">' + porta() + '</div>');
    if (CASO === 'hoje' && PERFIL === 'le') h = h.replace('', '');
    out.innerHTML = h;
  }
  per('12');
})();
