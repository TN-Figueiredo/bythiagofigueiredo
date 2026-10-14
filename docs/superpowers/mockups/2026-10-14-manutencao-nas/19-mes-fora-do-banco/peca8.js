/* peca8.js: peça 8, os vídeos antigos (PLANO-DAS-TELAS seção 10; spec 04 L60 e L474-520). Três usos:
   1) peca8-canal.html  : a tela do canal e a tela do vídeo, com a contagem em três partes. ?tela=canal|video  &cs=tres|dez26|pouco|um|nl|mil|carregando  &vs=mensal|parado|sem|semat|arquivo  &perfil=adm|ed|le
   2) arquivo.html      : a seção "Vídeos antigos" no meio da página do Arquivo (arquivo.js chama PECA8.secao).
   3) peca8-estados.html: os estados da seção, cada um dentro do cartão real.
   Hoje = 03/05/2028 (caso cheio) ou 02/12/2026 (canal antes da passagem). Todo número de vídeo e de mês arquivado é exemplo. */
(function(){
  'use strict';
  var Q = M.Q, ic = M.ic, aus = M.aus, esc = M.esc;
  var PERFIL = Q('perfil', 'adm'), ADM = PERFIL === 'adm';
  var N = 0;
  function ibx(txt, rot){ var id = 'p8i' + (++N); return M.ib(id, rot || 'Mais explicação') + M.infoBox(id, txt); }

  /* ------------------------------------------------------------ 1. contagem em três partes */
  var CASOS = {
    tres:  { total: 93, ac: 41, me: 12, ar: 40, antes: '12/2024', hoje: '03/05/2028', nome: 'Três partes (41, 12 e 40)' },
    dez26: { total: 52, ac: 52, me: 0, ar: 0, hoje: '02/12/2026', nome: 'O mesmo canal em dezembro de 2026 (52, 0 e 0)' },
    pouco: { total: 58, ac: 58, me: 0, ar: 0, hoje: '03/05/2028', nome: 'Canal que publica pouco', pouco: '02/2027' },
    um:    { total: 54, ac: 41, me: 12, ar: 1, antes: '12/2024', hoje: '03/05/2028', nome: 'Só 1 no arquivo' },
    nl:    { total: 53, ac: 41, me: 12, ar: null, antes: '12/2024', hoje: '03/05/2028', nome: 'Arquivo não lido' },
    mil:   { total: 312, ac: 120, me: 42, ar: 150, antes: '12/2024', hoje: '03/05/2028', nome: 'Canal grande (312 vídeos)' },
    carregando: { total: 93, ac: 41, me: 12, ar: 40, antes: '12/2024', hoje: '03/05/2028', nome: 'Carregando', carreg: true }
  };
  function fmtN(n){ return String(n).replace(/\B(?=(\d{3})+$)/g, '.'); }
  function frase(c){
    if (c.ar === null) return '<b>pelo menos ' + fmtN(c.total) + ' vídeos</b>: ' + c.ac + ' acompanhados, ' + c.me + ' em leitura mensal, <span class="m-num">no arquivo: não medido</span>';
    var p = '<b>' + fmtN(c.total) + ' vídeos</b>: ' + c.ac + ' acompanhados, ' + c.me + ' em leitura mensal, ' + c.ar + ' no arquivo';
    return p + (c.ar > 0 ? ' (publicados antes de ' + c.antes + ')' : '');
  }
  function barra(c){
    var s = '';
    function seg(cl, n, rot){ return n > 0 ? '<span class="p8-seg ' + cl + '" style="flex:' + n + ' 1 0" title="' + rot + '"></span>' : ''; }
    s += seg('ac', c.ac, c.ac + ' acompanhados') + seg('me', c.me, c.me + ' em leitura mensal');
    if (c.ar === null) s += '<span class="p8-seg nm" style="flex:' + Math.round(c.total * 0.2) + ' 1 0" title="no arquivo: não medido"></span>'; else s += seg('ar', c.ar, c.ar + ' no arquivo');
    return '<div class="p8-barra" role="img" aria-label="' + esc(c.ar === null ? 'Barra: ' + c.ac + ' acompanhados, ' + c.me + ' em leitura mensal, parcela do arquivo não lida' : 'Barra: ' + c.ac + ' acompanhados, ' + c.me + ' em leitura mensal, ' + c.ar + ' no arquivo') + '">' + s + '</div>';
  }
  function legenda(c){
    function item(ico, n, txt){ return '<li>' + ico + '<span><b class="m-num">' + n + '</b> <span class="k">' + txt + '</span></span></li>'; }
    var ar = c.ar === null ? '<li><span class="m-hach" role="img" aria-label="não medido"></span><span><b>no arquivo: não medido</b> <span class="k">Não foi possível ler quantos vídeos do arquivo são deste canal.</span></span></li>'
      : item(c.ar === 0 ? ic('zero') : ic('arq'), c.ar, 'no arquivo');
    return '<ul class="p8-leg">' + item('<span class="p8-sw ac" aria-hidden="true"></span>', c.ac, 'acompanhados') + item(c.me === 0 ? ic('zero') : ic('half'), c.me, 'em leitura mensal') + ar + '</ul>';
  }
  function horizonte(c){
    var t = c.pouco ? 'Os 50 vídeos mais recentes deste canal alcançam ' + c.pouco + ': nenhum vídeo sai antes disso.' : 'Neste canal vão para o arquivo os vídeos com mais de 2 anos que não estão entre os 50 mais recentes.';
    return '<p class="p8-hor">Quando um vídeo sai de “acompanhados”? ' + ibx(t + ' Se houver, a tela diz também: “N vídeos sem data de publicação nunca saem”.', 'Quando um vídeo sai') + '</p>';
  }
  function contagem(c){
    if (c.carreg) return '<div class="p8-esqc" aria-busy="true" role="status" aria-label="Carregando a contagem dos vídeos"><i style="width:80%"></i><i style="width:60%"></i><i style="height:14px;width:100%;margin-top:6px"></i><i class="l"></i><i class="l"></i><i class="l"></i><i style="width:40%"></i></div>';
    return '<p class="p8-conta">' + frase(c) + '</p>' + barra(c) + legenda(c) + horizonte(c);
  }

  /* ------------------------------------------------------------ 2. listas de vídeos */
  var TIT = ['Trem noturno de Hanói a Sapa', 'Um mês na Patagônia sem carro', 'Mercado de Chiang Mai em 5 pratos', 'Cinco dias em Tbilisi com 80 euros', 'A balsa que cruza o lago Titicaca', 'Lisboa fora da rota turística', 'Atravessando o Atlas de ônibus', 'O que custa uma semana em Kyoto', 'Ilhas Lofoten no inverno', 'Pernambuco de ônibus, sem pressa', 'Como achei hospedagem de 9 euros em Praga', 'Mochila de 7 kg: o que ficou de fora'];
  function vlinha(o){
    var href = M.href({ tela: 'video', vs: o.vs, perfil: PERFIL, cs: null });
    var marca = o.marca ? '<span class="p8-mk ' + o.marca[0] + '">' + ic(o.marca[1]) + '<span>' + o.marca[2] + '</span></span>' : '';
    return '<li class="p8-v"><span class="p8-th" aria-hidden="true"></span><div class="p8-vt"><a href="' + href + '">' + esc(o.t) + '</a><span class="d">' + marca + 'Publicado em ' + o.pub + '</span></div><div class="p8-vn">' + o.n + '<small>' + o.lido + '</small></div></li>';
  }
  var ACOMP = [['Trem noturno de Hanói a Sapa', '21/04/2028', '48,2 mil views', 'lido em 03/05/2028'], ['Lisboa fora da rota turística', '02/04/2028', '31,7 mil views', 'lido em 03/05/2028'], ['O que custa uma semana em Kyoto', '11/03/2028', '66,0 mil views', 'lido em 03/05/2028'], ['Ilhas Lofoten no inverno', '19/02/2028', '22,4 mil views', 'lido em 03/05/2028']];
  var MENS = [['Um mês na Patagônia sem carro', '14/03/2025', '8,1 mil views', 'lido em 02/05/2028', 'mensal'], ['Atravessando o Atlas de ônibus', '29/05/2025', '5,6 mil views', 'lido em 02/05/2028', 'mensal'], ['Pernambuco de ônibus, sem pressa', '08/10/2025', '3,9 mil views', 'lido em 02/05/2028', 'mensal']];
  function arqItens(de, ate){
    var r = [];
    for (var i = de; i < ate; i++) {
      var dia = 1 + (i * 7) % 27, mes = 1 + (i * 5) % 12, ano = 2024 - Math.floor((i + 3) / 12);
      var v = (4 + ((i * 37) % 90) / 10).toFixed(1).replace('.', ',');
      r.push({ t: TIT[i % TIT.length] + (i >= TIT.length ? ' (parte ' + (1 + Math.floor(i / TIT.length)) + ')' : ''), pub: (dia < 10 ? '0' : '') + dia + '/' + (mes < 10 ? '0' : '') + mes + '/' + ano, n: v + ' mil views, ' + (180 + (i * 53) % 400) + ' curtidas, ' + (12 + (i * 7) % 60) + ' comentários', lido: 'lido em 02/05/2028', vs: 'arquivo' });
    }
    return r;
  }
  function esqueletoLinhas(n){ /* mesma altura da linha final */ var s = ''; for (var i = 0; i < n; i++) s += '<li class="p8-esq" aria-hidden="true"><i class="th"></i><div><i style="width:70%"></i><i class="l"></i></div><i class="n"></i></li>'; return s; }

  var BASE = 0;
  function maisPrincipal(c){
    var mostra = c.hoje === '02/12/2026' ? 4 : 4 + (c.me > 0 ? 3 : 0), tot = c.ac + c.me;
    BASE = mostra;
    if (tot <= mostra) return '<div class="p8-mais"><span class="m-muted" style="font-size:12.5px" role="status">Mostrando ' + mostra + ' de ' + tot + '</span></div>';
    return '<div class="p8-mais"><button type="button" class="btn" data-p8="mais" data-alvo="p8-lista-pri" data-prox="' + mostra + '" data-total="' + tot + '">Mostrar mais ' + Math.min(25, tot - mostra) + '</button> <span class="m-muted" style="font-size:12.5px" role="status" aria-live="polite">Mostrando ' + mostra + ' de ' + tot + '</span></div>';
  }
  function priItens(de, ate){
    var r = [];
    for (var i = de; i < ate; i++) {
      var dia = 1 + (i * 5) % 27, mes = 1 + (i * 7) % 12, ano = 2025 + ((i + 1) % 3 === 0 ? 1 : 0);
      var v = (3 + ((i * 29) % 140) / 10).toFixed(1).replace('.', ',');
      r.push({ t: TIT[(i + 2) % TIT.length] + ' (parte ' + (2 + Math.floor(i / TIT.length)) + ')', pub: (dia < 10 ? '0' : '') + dia + '/' + (mes < 10 ? '0' : '') + mes + '/' + ano, n: v + ' mil views', lido: 'lido em 02/05/2028', vs: 'mensal' });
    }
    return r;
  }
  function listaCanal(c){
    var h = '<ul class="p8-lista" id="p8-lista-pri" aria-label="Vídeos acompanhados e em leitura mensal">';
    if (c.hoje === '02/12/2026') {
      h += [0, 1, 2, 3].map(function(i){ return vlinha({ t: TIT[(i + 4) % 12], pub: ['28/11/2026', '09/11/2026', '17/09/2026', '03/08/2026'][i], n: ['12,4', '9,8', '15,0', '7,2'][i] + ' mil views', lido: 'lido em 02/12/2026', vs: 'mensal' }); }).join('');
      return h + '</ul>';
    }
    h += ACOMP.map(function(a){ return vlinha({ t: a[0], pub: a[1], n: a[2], lido: a[3], vs: 'mensal' }); }).join('');
    if (c.me > 0) h += MENS.map(function(a){ return vlinha({ t: a[0], pub: a[1], n: a[2], lido: a[3], vs: 'mensal', marca: ['me', 'half', 'leitura mensal de 05/12/2027 a 03/05/2028'] }); }).join('');
    return h + '</ul>';
  }
  function grupoArquivo(c){
    if (c.ar === 0) return '';
    if (c.ar === null) return '<div class="p8-grupo" style="padding:12px 14px">' + aus('nm', 'No arquivo: não medido.', 'Não foi possível ler os vídeos deste canal que estão no arquivo; o total é “pelo menos ' + c.total + ' vídeos”. Pode esperar: recarregue a página mais tarde.') + '</div>';
    var titulo = c.ar === 1 ? '1 vídeo com mais de 2 anos está no arquivo' : fmtN(c.ar) + ' vídeos com mais de 2 anos estão no arquivo';
    if (c.carreg) return '<div class="p8-grupo p8-gesq" aria-busy="true" role="status" aria-label="Carregando os vídeos do arquivo" style="padding:6px 14px;height:53px;box-sizing:border-box;overflow:hidden"><i style="width:40%;margin:4px 0"></i><i style="width:60%;margin:4px 0"></i></div>';
    var passo = Math.min(25, c.ar);
    var pri = arqItens(0, passo).map(vlinhaArq).join('');
    var resto = c.ar - passo;
    var mais = resto > 0 ? '<div class="p8-mais"><button type="button" class="btn" data-p8="mais" data-alvo="p8-arqlista" data-prox="' + passo + '" data-total="' + c.ar + '">Mostrar mais ' + Math.min(25, resto) + '</button> <span class="m-muted" style="font-size:12.5px" role="status" aria-live="polite">Mostrando ' + passo + ' de ' + c.ar + '</span></div>' : '';
    return '<details class="p8-grupo" id="p8-grupo"' + (Q('aberto', '') === '1' ? ' open' : '') + '><summary>' + ic('arq') + '<span><span class="t">No arquivo (' + fmtN(c.ar) + ')</span><span class="s">' + titulo + '</span></span></summary><ul class="p8-lista" id="p8-arqlista">' + pri + '</ul>' + mais + '</details>';
  }
  function vlinhaArq(o){ o.marca = ['ar', 'arq', '03/2024 a 20/02/2027 no arquivo']; return vlinha(o); }

  function pl(n, a, b){ return n + ' ' + (n === 1 ? a : b); }
  function contas(c){
    if (c.hoje === '02/12/2026' || c.ar === 0) return '';
    if (c.carreg) return '<section class="p8-sec" aria-label="O que ficou de fora das contas deste canal" aria-busy="true"><div class="in"><h3>O que ficou de fora das contas deste canal</h3><div class="p8-esqc p8-esqf" role="status" aria-label="Carregando"><i style="width:90%"></i><i style="width:85%"></i><i style="width:80%"></i><i style="width:88%"></i><i style="width:70%"></i></div></div></section>';
    var me = c.me, nl = c.ar === null, n = c.ar;
    var li = function(t){ return '<li>' + ic('arq') + '<span>' + t + '</span></li>'; };
    var nlx = function(t){ return '<li><span class="m-hach" role="img" aria-label="não medido"></span><span>' + t + ' <span class="k">Não foi possível contar os vídeos do arquivo.</span></span></li>'; };
    var vm = nl ? 'pelo menos ' + pl(me, 'vídeo', 'vídeos') + ' em leitura mensal ficaram fora desta conta; os do arquivo não foram contados' : pl(me + n, 'vídeo em leitura mensal ou no arquivo ficou', 'vídeos em leitura mensal ou no arquivo ficaram') + ' fora desta conta';
    return '<section class="p8-sec" aria-label="O que ficou de fora das contas deste canal"><div class="in"><h3>O que ficou de fora das contas deste canal</h3><ul class="p8-fora">' +
      li('Valor do meio de views por dia dos longos: 31 longos com contagem diária; ' + vm + '. ' + ibx('Mesma frase do ⓘ da célula “valor do meio”.', 'Sobre o valor do meio')) +
      (nl ? nlx('Aba Trocas:') : li('Aba Trocas: ' + pl(n, 'troca de vídeo que está no arquivo', 'trocas de vídeos que estão no arquivo') + ' (no rodapé do livro).')) +
      (nl ? nlx('Outliers e Comparar:') : li('Outliers e Comparar: ' + pl(n, 'vídeo no arquivo ficou', 'vídeos no arquivo ficaram') + ' fora da base.')) +
      (nl ? nlx('Comentários de destaque: 5 de 14 vídeos com retrato de 30 dias.') : li('Comentários de destaque: 5 de 14 vídeos com retrato de 30 dias; ' + pl(n, 'vídeo no arquivo ficou', 'vídeos no arquivo ficaram') + ' fora da conta.')) +
      (nl ? nlx('Outras mudanças:') : li('Outras mudanças: ' + pl(n, 'mudança de vídeo que está no arquivo ficou', 'mudanças de vídeos que estão no arquivo ficaram') + ' fora.')) + '</ul></div></section>';
  }

  function telaCanal(){
    var cs = Q('cs', 'tres'), c = CASOS[cs] || CASOS.tres;
    var cx = '<p class="p8-crumb"><a href="#" onclick="return false">Canais</a> / Viagem Lenta</p><h2 class="p8-h1">Viagem Lenta</h2><p class="p8-sub">Canal acompanhado · hoje é ' + c.hoje + ' <span class="m-selo">ajuste de mockup aprovado: 15, 13/10/2026</span></p>';
    var aviso = '<p class="m-aviso"><b>Exemplo.</b> Os números e as datas desta tela são de exemplo; o canal é fictício. A mesma tela, lida em dezembro de 2026, tem 52 vídeos todos acompanhados: o botão “Canal” da barra mostra os dois.</p>';
    var cont = '<section class="p8-sec" aria-label="Contagem dos vídeos"><div class="in"><h3>Vídeos do canal</h3>' + contagem(c) + '</div></section>';
    var lista = '<section class="p8-sec" aria-label="Lista de vídeos"><div class="in" style="padding-bottom:8px"><h3 style="margin:0">Vídeos</h3></div>' + (c.carreg ? '<ul class="p8-lista">' + esqueletoLinhas(7) + '</ul>' : listaCanal(c)) +
      (c.carreg ? '<div class="p8-mais" aria-hidden="true"><i class="p8-bt"></i></div>' : maisPrincipal(c)) + grupoArquivo(c) + '</section>';
    return cx + aviso + M.legenda(false) + cont + lista + contas(c);
  }

  /* ------------------------------------------------------------ 3. a página do vídeo */
  function grafico(){
    var est = !!(window.matchMedia && window.matchMedia('(max-width:820px)').matches);
    var W = est ? 320 : 900, x0 = est ? 42 : 52, x1 = W - 8, yt = 34, yb = est ? 168 : 200, H = yb + 46, DIAS = 1146;
    function X(d){ return x0 + (x1 - x0) * d / DIAS; } function Y(v){ return yb - (yb - yt) * v / 9; }
    var pts = [[0, 0], [7, 1.2], [30, 3.1], [90, 4.9], [200, 5.9], [365, 6.4], [550, 6.9], [700, 7.2], [850, 7.45], [989, 7.6]];
    var d = pts.map(function(p, i){ return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
    var xm = X(995);
    var lidos = [[989, 7.6, '28/11'], [1025, 7.7, '03/01'], [1055, 7.8, '02/02'], [1084, 7.9, '02/03'], [1115, 8.0, '02/04'], [1145, 8.1, '02/05']];
    function mil(v){ return v.toFixed(1).replace('.', ','); }
    var s = '<svg class="p8-grafico" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" role="img" aria-label="Views acumuladas: linha cheia até 05/12/2027, depois só seis leituras mensais isoladas, a última de 8,1 mil em 02/05/2028" aria-describedby="p8-leit">';
    s += '<line class="eixo" x1="' + x0 + '" y1="' + yb + '" x2="' + x1 + '" y2="' + yb + '"/><line class="eixo" x1="' + x0 + '" y1="' + yt + '" x2="' + x0 + '" y2="' + yb + '"/>';
    [0, 3, 6, 9].forEach(function(v){ s += '<text x="' + (x0 - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + (v ? ' mil' : '') + '</text>'; });
    s += '<rect x="' + xm.toFixed(1) + '" y="' + yt + '" width="' + (x1 - xm).toFixed(1) + '" height="' + (yb - yt) + '" class="sem" rx="3"/>';
    s += '<path class="cheia" d="' + d + '"/><line class="marco" x1="' + xm.toFixed(1) + '" y1="' + yt + '" x2="' + xm.toFixed(1) + '" y2="' + (yb + 24) + '"/>';
    lidos.forEach(function(p){ s += '<circle class="pt" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="4"/>'; });
    s += '<text x="' + (x1 - 3) + '" y="' + (Y(8.1) + 22).toFixed(1) + '" text-anchor="end">02/05</text>';
    s += '<text class="fg" x="' + x1 + '" y="14" text-anchor="end">leitura mensal: 05/12/2027 a 03/05/2028</text>';
    s += '<text x="' + x0 + '" y="' + (yb + 17) + '">14/03/2025</text><text x="' + x1 + '" y="' + (yb + 17) + '" text-anchor="end">03/05/2028</text>';
    s += '<text x="' + xm.toFixed(1) + '" y="' + (yb + 38) + '" text-anchor="' + (est ? 'end' : 'middle') + '">05/12/2027</text></svg>';
    var leit = '<table class="p8-leit" id="p8-leit"><thead><tr><th>Leituras mensais (sem linha ligando)</th><th>Views</th></tr></thead><tbody>' + lidos.map(function(p){ return '<tr><td>' + p[2] + (p[2] === '28/11' ? ' (a da passagem)' : '') + '</td><td>' + mil(p[1]) + ' mil</td></tr>'; }).join('') + '</tbody></table>';
    return s + '<p class="m-muted" style="margin:6px 0 0;font-size:13px">A contagem diária vai de 14/03/2025 a 05/12/2027. De 05/12/2027 a 03/05/2028 só há as leituras mensais abaixo, sem contagem por dia.</p>' + leit;
  }
  function porta(){
    if (PERFIL === 'le') return '';
    return '<div class="m-botoes" style="margin-top:10px"><a class="btn small" href="peca6-ver-antigo.html?e=v-ok&amp;perfil=' + PERFIL + '">Ver antigo</a><span class="m-muted" style="font-size:12.5px">Ver o que está no arquivo</span></div>';
  }
  function fixar(vs){
    if (vs === 'arquivo') return aus('arq', 'Este vídeo está no arquivo e não pode ser fixado. As views dele continuam sendo lidas uma vez por mês; o histórico está em “Ver antigo”.', 'Voltar a acompanhar por inteiro um vídeo que está no arquivo ainda não existe.');
    if (PERFIL === 'adm') return '<div class="m-botoes"><button type="button" class="btn" data-p8="fixar">Fixar o vídeo</button><span class="m-muted" style="font-size:13px">Fixar o traz de volta: volta a ser acompanhado por inteiro a partir de hoje.</span></div>';
    return '<p class="p8-fixa m-muted">Este vídeo está em leitura mensal. Só quem administra o site pode voltar a acompanhá-lo por inteiro.</p>';
  }
  function telaVideo(){
    var vs = Q('vs', 'mensal');
    var ar = vs === 'arquivo';
    var titulo = ar ? 'Mercado de Chiang Mai em 5 pratos' : vs === 'sem' ? 'Cinco dias em Tbilisi com 80 euros' : vs === 'semat' ? 'Pernambuco de ônibus, sem pressa' : 'Um mês na Patagônia sem carro';
    var pub = ar ? '18/09/2023' : vs === 'sem' ? '30/03/2026' : vs === 'semat' ? '08/10/2025' : '14/03/2025';
    var cx = '<p class="p8-crumb"><a href="' + M.href({ tela: 'canal', vs: null }) + '">Viagem Lenta</a> / vídeo</p><h2 class="p8-h1">' + titulo + '</h2><p class="p8-sub">Publicado em ' + pub + ' <span class="m-selo">ajuste de mockup aprovado: 13, 13/10/2026</span></p>';
    var est, num, corpo = '';
    var AVISE = 'Só um vídeo que saiu do YouTube demora a aparecer na fila «Saíram do YouTube». A leitura se recupera sozinha.';
    if (ar) {
      est = '<div class="p8-estado ar">' + ic('arq') + '<div><p><b>03/2024 a 20/02/2027 no arquivo.</b> A coleta começou em 03/2024. Aqui ficam o título, a data e as views; o histórico de título, miniatura e descrição está no arquivo.</p>' + porta() + '<p>Nada a fazer.</p></div></div>';
      num = '<div class="p8-big"><span class="n">12,3 mil</span><span class="d">views, lido em 02/05/2028</span></div><p class="p8-apoio">na passagem à leitura mensal: 12,1 mil views, lido em 28/11/2026 ' + ibx('A leitura de apoio é a de 28/11/2026; a tela diz “leitura mensal de 05/12/2026 a 20/02/2027”. As duas datas aparecem como são: a da passagem pode ser até uma semana anterior.', 'Por que duas datas') + '</p>';
      corpo = '<section class="p8-sec"><div class="in"><h3>As views nas idades que continuam online</h3><div class="m-idades"><div class="m-cel marca"><span class="k">1 dia</span><span class="v">0,9 mil</span></div><div class="m-cel marca"><span class="k">7 dias</span><span class="v">4,6 mil</span></div><div class="m-cel marca"><span class="k">30 dias</span><span class="v">9,0 mil</span></div></div><p class="m-muted" style="margin:8px 0 0;font-size:13px">As marcas de 1, 7 e 30 dias continuam online. 3 versões de título estão no arquivo (nenhum “igual desde a publicação” inventado).</p></div></section>' +
        '<section class="p8-sec"><div class="in"><h3>O que não aparece mais aqui, e o que a tela diz no lugar</h3><ul class="p8-fora">' +
        '<li>' + ic('arq') + '<span>Os comentários de destaque deste vídeo estão no arquivo (03/2024 a 20/02/2027).</span></li>' +
        '<li>' + ic('arq') + '<span>03/2024 a 20/02/2027 no arquivo: esta medida não é calculada para vídeo que está no arquivo. ' + ibx('Quando alguém pede uma medida calculada (por exemplo, views por dia de um período) para este vídeo. Nunca zero e nunca “não medido”.', 'Sobre a medida pedida') + '</span></li>' +
        '<li>' + ic('arq') + '<span>Troca de título, miniatura e descrição, e mudanças de campo: 3 versões de título e 2 trocas de miniatura estão no arquivo.</span></li></ul></div></section>' +
        '<section class="p8-sec"><div class="in"><h3>Fixar</h3>' + fixar('arquivo') + '</div></section>';
    } else if (vs === 'parado') {
      est = '<div class="p8-estado am">' + ic('tri') + '<div><p><b>Sem leitura desde 14/03/2028.</b> Em leitura mensal: 05/12/2027 a 03/05/2028.</p><p>A última leitura tem mais de 45 dias; o número abaixo não é de hoje. ' + ibx('O rodízio é de 30 dias; 45 é o rodízio mais meio rodízio de atraso, o mesmo par 45 e 90 dos meses descartados.', 'Por que 45 dias') + '</p><p>Pode esperar: o número só fica parado; nada se perde. ' + AVISE + '</p></div></div>';
      num = '<div class="p8-big"><span class="n">7,9 mil</span><span class="d">views, lido em 14/03/2028</span></div><p class="p8-apoio">na passagem à leitura mensal: 7,6 mil views, lido em 28/11/2027</p>';
      corpo = '<section class="p8-sec"><div class="in"><h3>Views acumuladas</h3>' + grafico() + '</div></section><section class="p8-sec"><div class="in"><h3>Fixar</h3>' + fixar('mensal') + '</div></section>';
    } else if (vs === 'sem') {
      est = '<div class="p8-estado pt">' + ic('pont') + '<div><p><b>Passou à leitura mensal em 05/04/2028.</b> A primeira leitura mensal ainda não aconteceu; está prevista para 05/05/2028.</p><p>Até lá só existe o número da passagem. Nada a fazer: a leitura chega sozinha.</p></div></div>';
      num = '<div class="p8-big"><span class="n" style="color:var(--muted)">ainda sem leitura mensal</span></div><p class="p8-apoio">na passagem à leitura mensal: 5,2 mil views, lido em 30/03/2028</p>';
      corpo = '<section class="p8-sec"><div class="in"><h3>Fixar</h3>' + fixar('mensal') + '</div></section>';
    } else if (vs === 'semat') {
      est = '<div class="p8-estado am">' + ic('tri') + '<div><p><b>Sem leitura mensal desde a passagem, em 05/12/2027: 150 dias.</b></p><p>A primeira leitura era esperada em 04/01/2028; passou de 45 dias. O número abaixo é o da passagem, não é de hoje. ' + ibx('O rodízio é de 30 dias; 45 é o rodízio mais meio rodízio de atraso. Um vídeo que nunca teve a primeira leitura passa pela mesma regra de “sem leitura”.', 'Por que 45 dias') + '</p><p>Pode esperar: o número da passagem continua aqui; nada se perde. ' + AVISE + ' Passou de 90 dias: veja se a linha «Leitura mensal» da página do Arquivo está vermelha; se estiver, avise o Claude Code agora.'+'</p></div></div>';
      num = '<div class="p8-big"><span class="n" style="color:var(--muted)">ainda sem leitura mensal</span></div><p class="p8-apoio">na passagem à leitura mensal: 3,7 mil views, lido em 28/11/2027</p>';
      corpo = '<section class="p8-sec"><div class="in"><h3>Fixar</h3>' + fixar('mensal') + '</div></section>';
    } else {
      est = '<div class="p8-estado me">' + ic('half') + '<div><p><b>Em leitura mensal: 05/12/2027 a 03/05/2028.</b> Este vídeo tem mais de 2 anos. Nesse trecho o site lê só as contagens dele, uma vez por mês; as trocas de título, miniatura e descrição deixaram de ser acompanhadas. O histórico continua aqui e pode ir para o arquivo a partir de 28/01/2028.</p><p>Nada a fazer.</p></div></div>';
      num = '<div class="p8-big"><span class="n">8,1 mil</span><span class="d">views, lido em 02/05/2028</span></div><p class="p8-apoio">na passagem à leitura mensal: 7,6 mil views, lido em 28/11/2027</p>';
      corpo = '<section class="p8-sec"><div class="in"><h3>Views acumuladas</h3>' + grafico() + '<p class="m-muted" style="margin:10px 0 0;font-size:13px">Média de views por dia: <b class="m-num" style="color:var(--text)">6,9 por dia</b> <span class="m-num">· até 05/12/2027</span>. A média não aparece como atual, porque a contagem diária terminou na passagem. ' + ibx('Linha cheia até a passagem; o resto em contorno pontilhado (o mesmo desenho do “saiu do YouTube” do mockup 13); cada leitura mensal é um ponto isolado com a data. Nunca hachura rosa e nunca barra de zero.', 'Como ler o gráfico') + '</p></div></section><section class="p8-sec"><div class="in"><h3>Fixar</h3>' + fixar('mensal') + '</div></section>';
    }
    return cx + est + num + corpo;
  }

  /* ------------------------------------------------------------ 4. a seção "Vídeos antigos" (página do Arquivo) */
  var L4 = [['No NAS'], ['No B2'], ['Recuperação', 'Recup.'], ['Miniaturas', 'Minit.']];
  function r4(f){ return f.map(function(x, i){ return [x, L4[i][0], L4[i][1], ['tri', 'oct', 'pontA'].indexOf(x) >= 0]; }); }
  function linha(o){
    var cls = 'm-mes' + (o.cls ? ' ' + o.cls : '') + (o.f ? '' : ' arqrow');
    return '<li class="' + cls + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><div class="m-mn">' + o.nome + '</div><p class="m-fr">' + (o.lead ? o.lead + ' ' : '') + o.frase + (o.sec ? '<span class="m-sec">' + o.sec + '</span>' : '') + '</p>' + (o.f ? M.regua(r4(o.f), 'Caminho dos vídeos de ' + o.nome) : '') + '<div class="m-ac">' + (o.ac || '') + '</div>' + (o.dentro || '') + '</li>';
  }
  /* "Ver o comando": o mesmo molde da peça 7: uma linha fixa em <pre> com Copiar, passos curtos, "Já rodei". O comando é de exemplo (não existe ainda: emenda de plano). */
  var LINHA = 'npm run obs:videos-desfazer -- 2028-04';
  function cmdPainel(id, mes, prazo){
    return '<div class="p8-cmd" id="cmd-' + id + '" hidden><h4>Para desfazer a passagem de ' + mes + ' à leitura mensal</h4><ol class="p8-pas">' +
      '<li>No Mac, na pasta do projeto, rode esta linha: <span class="p8-sh"><pre><code>' + esc(LINHA) + '</code></pre><button type="button" class="btn small" data-p8="copiar" aria-label="Copiar a linha do passo 1">Copiar</button></span></li>' +
      '<li>Espere: a página confirma sozinha em até 24 horas.</li>' +
      '<li>Rodou a linha? <button type="button" class="btn" data-p8="rodei">Já rodei</button></li></ol>' +
      '<p class="p8-pode">' + (prazo ? 'Pode esperar até ' + prazo + '. ' : 'Pode esperar. ') + 'Também dá para fixar o vídeo, um a um. A linha só é segura de rodar mais de uma vez.</p></div>';
  }
  function btCmd(id, rot){ return ADM ? '<button type="button" class="btn small" data-p8="cmd" aria-expanded="false" aria-controls="cmd-' + id + '">' + rot + '</button>' : ''; }
  function bt(rot, a, cls){ return ADM ? '<button type="button" class="btn ' + (cls || '') + '" data-p8="' + a + '">' + rot + '</button>' : ''; }
  var DEZ27 = 'Dezembro de 2027', DEZ26 = 'Dezembro de 2026';
  var ROW = {
    cong: function(){ return linha({ nome: 'Abril de 2028', f: ['pont', 'pont', 'pont', 'pont'], frase: '9 vídeos passaram à leitura mensal em abril de 2028. A cópia começa em 28/05/2028. Nada a fazer agora. Para desfazer: fixe o vídeo, ou rode o comando. ' + ibx('Por que se espera: um vídeo pode ser fixado, ou ter uma troca salva, até o mês fechar; a cópia espera o mês parar de mudar (28 dias depois de fechar) para não precisar ser refeita.', 'Por que se espera'), ac: btCmd('cong', 'Ver o comando'), dentro: ADM ? cmdPainel('cong', 'abril de 2028', '28/05/2028') : '' }); },
    cop: function(){ return linha({ nome: DEZ27, f: ['bar', 'pont', 'pont', 'pont'], frase: 'Copiando: 12 de 37 vídeos', sec: 'Nada a fazer: a cópia anda sozinha.' }); },
    nas: function(){ return linha({ nome: DEZ27, f: ['ok', 'pont', 'pont', 'pont'], frase: 'No NAS, verificado hoje às 06:17', sec: 'Nada a fazer.' }); },
    b2: function(){ return linha({ nome: DEZ27, f: ['ok', 'ok', 'pont', 'pont'], frase: 'No B2, conferido pela forja hoje às 11:20', sec: 'Nada a fazer.' }); },
    rec: function(){ return linha({ nome: DEZ27, f: ['ok', 'ok', 'ok', 'pont'], frase: 'Recuperação testada em 05/02/2028.', sec: 'Nada a fazer.' }); },
    min: function(){ return linha({ nome: DEZ27, f: ['ok', 'ok', 'ok', 'bar'], frase: 'Miniaturas copiadas: 31 de 37.', sec: 'Nada a fazer: as miniaturas são copiadas sozinhas.' }); },
    min2: function(){ return linha({ nome: DEZ27, f: ['ok', 'ok', 'ok', 'ok'], frase: 'Miniaturas copiadas: 35 de 37.', sec: '2 miniaturas já não existiam na origem e não foram copiadas. Nada a fazer.' }); },
    pode: function(){ return linha({ nome: DEZ27, f: ['ok', 'ok', 'ok', 'ok'], frase: 'Pode ir para o arquivo', sec: 'Pode esperar: o botão fica aqui até você voltar.', ac: bt('Mandar para o arquivo', 'mandar', 'heavy') }); },
    naomais: function(){ return linha({ nome: DEZ27, f: ['ok', 'ok', 'ok', 'ok'], cls: 'alerta', frase: '4 vídeos deste mês não podem mais ir para o arquivo (foram fixados, tiveram troca salva ou saíram do YouTube). Ver quais.', sec: 'Pode esperar: nada se perde com isso.', ac: '<button type="button" class="btn small" data-p8="quais">Ver quais</button>' }); },
    arq: function(nome, em, reg, vid){ return linha({ nome: nome || DEZ26, lead: ic('arq'), frase: 'No arquivo (enviado em ' + (em || '20/02/2027') + '): ' + (reg || '1.914') + ' registros de ' + (vid || 148) + ' vídeos. <b>O tamanho do banco não cai com isto: ele passa a crescer mais devagar.</b>', sec: 'Nada a fazer.' }); },
    esp: function(){ return linha({ nome: 'Esperando você', lead: ic('pont'), frase: 'Pode esperar: nada se perde enquanto isso. Veja antes o que passaria.', ac: bt('Ver o que passaria à leitura mensal', 'sim') }); },
    exc: function(){ return linha({ nome: 'Esperando você', cls: 'alerta', lead: ic('tri'), frase: 'Viagem Lenta tem 140 vídeos para passar à leitura mensal, mais do que o automático faz de uma vez. Confirme pelo botão. Pode esperar: nada se perde enquanto isso.', ac: bt('Ver o que passaria à leitura mensal', 'sim') }); },
    novos: function(){ return linha({ nome: DEZ27, cls: 'alerta vm', lead: ic('oct'), frase: 'Há registros novos de vídeos que já estavam em leitura mensal. Nada desta parte vai para o arquivo até resolver.', sec: 'Pode esperar: nada desta parte sai do banco enquanto isso. Ao voltar, avise o Claude Code para investigar.' }); },
    atras: function(){ return linha({ nome: 'Leitura mensal', cls: 'alerta', lead: ic('tri'), frase: '11 vídeos estão há mais de 45 dias sem leitura.', sec: 'Pode esperar: o número é o da última leitura, não é de hoje; nada se perde. Só vídeo que saiu do YouTube demora a aparecer na fila «Saíram do YouTube». A leitura se recupera sozinha.' }); },
    atras90: function(){ return linha({ nome: 'Leitura mensal', cls: 'alerta vm', lead: ic('oct'), frase: '11 vídeos estão há mais de 45 dias sem leitura.', sec: 'O mais parado está há 97 dias sem leitura: a leitura mensal parou. As contagens dos vídeos antigos só ficam velhas, mas a causa pode estar parando também a coleta dos vídeos novos, e essa não volta depois. Avise o Claude Code agora; veja se a coleta recente também está vermelha.' }); },
    atrasOff: function(){ return linha({ nome: 'Leitura mensal', cls: 'alerta', lead: ic('tri'), frase: 'Leitura mensal desligada.', sec: 'Não dá para dizer quantos vídeos estão atrasados. Pode esperar; só os vídeos que saírem do YouTube nesse tempo entram na fila «Saíram do YouTube» quando religar. Religar é com o Claude Code.' }); }
  };
  var QUAIS = '<ul class="p8-lq" aria-label="Vídeos que deixaram de poder sair">' +
    '<li>' + ic('arq') + '<span><b>Mochila de 7 kg: o que ficou de fora</b>, fixado em 10/03/2028. Fica acompanhado por inteiro; nada a fazer.</span></li>' +
    '<li>' + ic('arq') + '<span><b>Ilhas Lofoten no inverno (parte 2)</b>, com troca salva. Fica como está, com o histórico online.</span></li>' +
    '<li>' + ic('tri') + '<span><b>Cinco dias em Tbilisi com 80 euros</b>, saiu do YouTube em 22/03/2028. Está na fila “Saíram do YouTube”; apagar de lá alcança também o arquivo e as miniaturas.</span></li>' +
    '<li>' + ic('arq') + '<span><b>Como achei hospedagem de 9 euros em Praga</b>, fixado em 01/04/2028. Fica acompanhado por inteiro; nada a fazer.</span></li></ul>';
  function simTab(n){
    var rows = '';
    for (var i = 0; i < n; i++) { var v = n === 3 ? [4, 3, 2][i] : 1 + (i * 7) % 18; var g = n === 3 ? (i === 0 ? 140 : 0) : (i === 6 ? 140 : 0); rows += '<tr><td class="c">' + (i === 0 && n === 3 ? 'Viagem Lenta' : ['Viagem Lenta', 'Rota do Sol', 'Mochila e Mapa', 'Caminhos do Leste', 'Terra à Vista', 'Sem Pressa TV'][i % 6] + (i >= 6 ? ' ' + (1 + Math.floor(i / 6)) : '')) + '</td><td class="n">' + (g || v) + '</td><td class="n">' + fmtN((g || v) * 52) + '</td><td>' + (g ? '40 ficam para o mês seguinte' : '') + '</td></tr>'; }
    return '<div class="p8-sim" tabindex="-1" data-sim><p>' + (n === 3 ? '<b>Não muda nada.</b> Estes 9 vídeos de 3 canais passariam à leitura mensal.' : '<b>Não muda nada.</b> Esta é a simulação de 45 canais: por canal, quantos vídeos e quantos registros.') + '</p><div class="p8-tab" tabindex="0" role="region" aria-label="Simulação por canal"><table><thead><tr><th>Canal</th><th class="n">Vídeos</th><th class="n">Registros</th><th>Se passar de 100</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (ADM ? '<p style="margin:10px 0 0"><button type="button" class="btn heavy" data-p8="passar">Passar estes vídeos à leitura mensal</button></p>' : '') + '</div>';
  }
  var AUTO = {
    desl: function(){ return '<div class="p8-aut">' + ic('pont') + '<span>Passar à leitura mensal sozinho: <b>desligado</b>. Você confirma cada leva. Pode esperar: nada passa sozinho enquanto isso. ' + ibx('Variável OBS_VIDEOS_ANTIGOS_AUTO (nome só aqui). Mudar isto é pedir ao Claude Code para trocar a variável no Vercel e publicar de novo; o Cowork não muda variável do Vercel. Não é o interruptor do automático que tira o mês do banco: este só passa o vídeo à leitura mensal, não tira nada do banco, e dá para desfazer fixando o vídeo.', 'Sobre o automático dos vídeos') + '</span></div>'; },
    lig: function(){ return '<div class="p8-aut">' + ic('ok') + '<span>Passar à leitura mensal sozinho: <b>ligado</b> na configuração do site: até 100 vídeos por canal por dia. Nada a fazer. ' + ibx('Variável OBS_VIDEOS_ANTIGOS_AUTO (nome só aqui). Mudar isto é pedir ao Claude Code para trocar a variável no Vercel e publicar de novo; o Cowork não muda variável do Vercel. Não é o interruptor do automático que tira o mês do banco: este só passa o vídeo à leitura mensal, não tira nada do banco, e dá para desfazer fixando o vídeo.', 'Sobre o automático dos vídeos') + '</span></div>'; }
  };
  function esqSecao(){ return '<div aria-busy="true" role="status" aria-label="Carregando os vídeos antigos">' + [1, 2].map(function(){ return '<div class="p8-esqs" aria-hidden="true"><div><i style="width:70%"></i></div><div><i></i><i class="l"></i></div><div><i></i></div></div>'; }).join('') + '</div>'; }
  var RESUMO_PADRAO = 'Vídeos antigos: 37 de dezembro de 2027 podem ir para o arquivo, sem pressa. 9 esperam o prazo da cópia.';
  /* o = {resumo, rows:[html], extra:html, auto:'desl'|'lig'|null, carreg:bool} */
  function secao(o){
    o = o || {};
    var rows = o.carreg ? esqSecao() : '<ul class="m-rows">' + (o.rows || [ROW.pode(), ROW.arq(), ROW.cong(), ROW.esp()]).join('') + '</ul>';
    var resumo = o.resumo === undefined ? RESUMO_PADRAO : o.resumo;
    return '<section class="m-card" id="p8-secao" aria-label="Vídeos antigos"><div class="m-card-h"><div class="m-card-top"><h3 class="m-h3">Vídeos antigos</h3>' + ibx('O mês desta seção é o mês em que os vídeos passaram à leitura mensal, não o mês do dado. “Leitura mensal” quer dizer: o site passou a ler só as contagens do vídeo, uma vez por mês, e o histórico ainda está no banco. “Arquivo” é depois: o histórico sai do banco e fica no NAS e no B2.', 'O que é esta seção') + '</div>' + (resumo ? '<p class="m-resumo">' + resumo + '</p>' : '') + '</div>' + rows + (o.extra || '') + (o.auto === null ? '' : (AUTO[o.auto || 'desl']())) + '</section>';
  }

  /* diálogo de mandar para o arquivo (peça 3 dos vídeos) */
  var FRASE = 'mandar vídeos antigos de dezembro de 2027 para o arquivo';
  function dlgMandar(st){
    var corpo = '<h2 id="dT">Mandar para o arquivo os vídeos antigos de dezembro de 2027?</h2><p class="t p8-sempressa"><b>Não há pressa.</b> O histórico continua no banco até você confirmar.</p><p class="t">Isto tira do site o histórico de 37 vídeos de 9 canais que passaram à leitura mensal em dezembro de 2027: as versões de título, miniatura e descrição, as mudanças de campo e as trocas.</p>' +
      '<p class="t"><b>O que você perde:</b> não verá mais esse histórico nas telas, só pelo “Ver antigo”; e estes vídeos não poderão mais ser fixados nem voltar a ser acompanhados por inteiro. Para manter algum, cancele, fixe o vídeo na tela dele e volte aqui.</p>' +
      '<p class="t"><b>O que continua:</b> cada vídeo, com título, data e views; e a cópia completa no NAS e no B2.</p><p class="t"><b>Não dá para desfazer pelo site.</b></p>' +
      '<p class="t"><b>Contado agora, no banco:</b> 37 vídeos de 9 canais, 1.206 registros, iguais aos da cópia do NAS (verificada hoje às 06:17) e do B2 (conferido pela forja hoje às 11:20). A recuperação foi testada em 05/02/2028.</p>' +
      '<p class="t">Para continuar, digite: <b>' + FRASE + '</b>.</p><label for="dIn">Frase de confirmação</label><input id="dIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="dSt"><p class="m-st" id="dSt" role="status">Digite a frase para continuar.</p>';
    return '<div class="m-dlg' + (st ? ' st' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dT"><div class="m-dlg-b">' + corpo + '</div><div class="m-dlg-a"><button type="button" class="btn heavy" id="dOk" aria-disabled="true" aria-describedby="dSt" data-ok>Mandar para o arquivo</button><button type="button" class="btn" data-foco data-fecha>Cancelar</button></div></div>';
  }
  function norm(t){ return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function abre(html, gatilho, onOk){
    var m = document.createElement('div'); m.className = 'm-modal'; m.innerHTML = html; document.body.appendChild(m);
    function fecha(){ m.remove(); document.removeEventListener('keydown', key); if (gatilho && document.contains(gatilho)) gatilho.focus(); }
    function key(e){
      if (e.key === 'Escape') { fecha(); return; }
      if (e.key === 'Tab') { var f = m.querySelectorAll('button,input'); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); } }
    }
    document.addEventListener('keydown', key);
    m.addEventListener('click', function(e){ if (e.target === m || e.target.closest('[data-fecha]')) fecha(); var ok = e.target.closest('[data-ok]'); if (ok && ok.getAttribute('aria-disabled') !== 'true') { fecha(); onOk && onOk(); } });
    var inp = m.querySelector('#dIn'); inp.addEventListener('input', function(){ var v = norm(inp.value), ok = v === norm(FRASE); m.querySelector('#dOk').setAttribute('aria-disabled', String(!ok)); m.querySelector('#dSt').textContent = ok ? 'Frase confirmada.' : (v.length >= 5 ? 'Ainda não bate com a frase. Maiúscula e acento não importam.' : 'Digite a frase para continuar.'); });
    inp.focus();
  }

  /* ------------------------------------------------------------ cliques (valem nas três páginas) */
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-p8]'); if (!b) return;
    var a = b.getAttribute('data-p8');
    if (a === 'mais') {
      var ini = +b.getAttribute('data-prox'), tot = +b.getAttribute('data-total'), fim = Math.min(ini + 25, tot), alvo = document.getElementById(b.getAttribute('data-alvo'));
      var pri = b.getAttribute('data-alvo') === 'p8-lista-pri';
      var antes = alvo.children.length, st = b.nextElementSibling, caixa = b.parentNode;
      alvo.insertAdjacentHTML('beforeend', (pri ? priItens(ini, fim).map(vlinha) : arqItens(ini, fim).map(vlinhaArq)).join(''));
      var novo = alvo.children[antes] && alvo.children[antes].querySelector('a');
      st.textContent = 'Mostrando ' + fim + ' de ' + tot;
      if (fim >= tot) { b.remove(); caixa.insertBefore(st, caixa.firstChild); } else { b.setAttribute('data-prox', fim); b.textContent = 'Mostrar mais ' + Math.min(25, tot - fim); }
      if (novo) novo.focus();
    }
    if (a === 'cmd') { var pn = document.getElementById(b.getAttribute('aria-controls')), ab = pn.hasAttribute('hidden'); if (ab) pn.removeAttribute('hidden'); else pn.setAttribute('hidden', ''); b.setAttribute('aria-expanded', String(ab)); b.textContent = ab ? 'Esconder o comando' : 'Ver o comando'; }
    if (a === 'copiar') {
      var code = b.parentNode.querySelector('code'), ok = function(){ b.textContent = 'Copiado'; setTimeout(function(){ b.textContent = 'Copiar'; }, 2000); };
      var sel = function(){ var r = document.createRange(); r.selectNodeContents(code); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r); b.textContent = 'Selecione e copie'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code.textContent).then(ok, sel); else sel();
    }
    if (a === 'rodei') {
      var pc = b.closest('.p8-cmd'); pc.dataset.html = pc.innerHTML;
      pc.innerHTML = '<div class="p8-marc" tabindex="-1" role="status"><h4>Marcado como rodado em 03/05</h4>' + aus('pt', 'Volte em até 24 horas: se houver mais um passo, ele aparece aqui. Se a verificação seguinte achar os vídeos ainda em leitura mensal, o aviso volta. <button type="button" class="btn small" data-p8="desfaz">Desfazer</button>') + '</div>';
      pc.querySelector('.p8-marc').focus();
    }
    if (a === 'desfaz') { var pd = b.closest('.p8-cmd'); pd.innerHTML = pd.dataset.html; pd.querySelector('[data-p8="rodei"]').focus(); }
    if (a === 'sim') {
      var li = b.closest('li'), ex = li.querySelector('[data-sim]');
      if (ex) { ex.remove(); return; }
      li.insertAdjacentHTML('beforeend', simTab(/140|312|45 canais/.test(li.textContent) ? 45 : 3).replace('class="p8-sim"', 'class="p8-sim" style="grid-column:1/-1;margin:0"'));
    }
    if (a === 'quais') { var l2 = b.closest('li'), q = l2.querySelector('.p8-lq'); if (q) q.remove(); else l2.insertAdjacentHTML('beforeend', QUAIS); }
    if (a === 'mandar') abre(dlgMandar(false), b, function(){ var li = b.closest('li'); li.outerHTML = ROW.arq(DEZ27, '03/05/2028', '1.206', 37); });
    if (a === 'passar') { var s = b.closest('[data-sim]'); s.innerHTML = '<p>' + ic('ok') + ' Os vídeos passaram à leitura mensal. Nada a fazer agora. Para desfazer: fixe o vídeo, ou rode o comando.</p><p style="margin:0">' + btCmd('sim', 'Ver o comando') + '</p>' + cmdPainel('sim', 'maio de 2028', ''); var bc = s.querySelector('[data-p8="cmd"]'); if (bc) bc.focus(); }
  });

  /* ------------------------------------------------------------ 5. páginas de mostra */
  function tela(){
    var kind = document.body.getAttribute('data-p8'); if (!kind) return;
    if (kind === 'canal') {
      var t = Q('tela', 'canal'), cs = Q('cs', 'tres');
      var barra = M.mock((t === 'canal' ? 'canal · ' + (CASOS[cs] || CASOS.tres).nome : 'vídeo · ' + ({ mensal: 'em leitura mensal', parado: 'leitura parada', sem: 'ainda sem leitura', semat: 'sem leitura há 150 dias', arquivo: 'no arquivo' }[Q('vs', 'mensal')])), [
        M.grupo('Tela', 'tela', [['canal', 'Canal'], ['video', 'Vídeo']], t),
        M.grupo('Canal', 'cs', Object.keys(CASOS).map(function(k){ return [k, CASOS[k].nome]; }), cs, { tela: 'canal' }),
        M.grupo('Vídeo', 'vs', [['mensal', 'Em leitura mensal'], ['parado', 'Leitura parada'], ['sem', 'Ainda sem leitura'], ['semat', 'Sem leitura há 150 dias'], ['arquivo', 'No arquivo']], Q('vs', 'mensal'), { tela: 'video' }),
        M.grupo('Perfil', 'perfil', [['adm', 'Administra'], ['ed', 'Edita'], ['le', 'Só lê']], PERFIL)],
        'Peça 8 (spec 04 L60 e L474-520). Exemplo: nenhum vídeo saiu do banco ainda; hoje do mockup = 03/05/2028. A contagem vem por requisição (caso Carregando: esqueleto com a altura final). Um parâmetro a mais: <code>?aberto=1</code> abre o grupo “No arquivo”.');
      document.title = 'Mockup 19: vídeos antigos (canal e vídeo)';
      document.body.innerHTML = barra + M.obs('canais', 'cheio') + '<main id="m-main">' + (t === 'video' ? telaVideo() : telaCanal()) + '</main>';
    } else if (kind === 'estados') {
      var G = estados();
      var E = Q('e', 'todos');
      var itens = [['todos', 'Todos']].concat(G.map(function(g){ return [g[0], g[1]]; }));
      var bar = M.mock(E === 'todos' ? 'todos os estados' : E, [M.grupo('Estado', 'e', itens, E), M.grupo('Perfil', 'perfil', [['adm', 'Administra'], ['ed', 'Edita'], ['le', 'Só lê']], PERFIL)], 'Peça 8, seção “Vídeos antigos” da página do Arquivo (spec 04 L498-516). Cada quadro é o cartão real da seção com um estado. O ⓘ de cada quadro cita a linha do spec.');
      var intro = '<h2 class="m-h2">Vídeos antigos: o que a página do Arquivo diz em cada situação</h2><p class="p8-intro">Cada quadro abaixo é a seção “Vídeos antigos” da página do Arquivo, do jeito que ela ficaria naquela situação. A página inteira, com a seção no meio, está em <a href="' + 'arquivo.html" style="color:var(--accent)">arquivo.html</a>. As linhas do spec ficam no ⓘ de cada quadro.</p><p class="m-aviso"><b>Exemplo.</b> Todos os números e datas são de exemplo; nenhum vídeo saiu do banco ainda.</p>';
      var corpo = G.filter(function(g){ return E === 'todos' || E === g[0]; }).map(function(g){ return M.quadro(g[0], g[1], g[2] + ' ' + ibx(g[3], 'De onde vem este estado'), g[4]()); }).join('');
      document.title = 'Mockup 19: vídeos antigos (estados)';
      document.body.innerHTML = bar + M.obs(PERFIL === 'le' ? '' : 'arquivo', 'cheio', PERFIL === 'le') + '<main id="m-main">' + intro + M.legenda(false) + corpo + '</main>';
    }
  }
  /* [id, título em português, rótulo curto, ⓘ (linha do spec), corpo()] */
  function estados(){
    function S(o){ return function(){ return secao(o); }; }
    return [
      ['nada', 'Nada para passar à leitura mensal', 'nenhum vídeo elegível', 'Spec 04 L498: “Nenhum vídeo com mais de 2 anos fora dos mais recentes.” É zero medido (caixa vazada com o 0), nunca vazio sem frase.', S({ resumo: '', rows: ['<li style="padding:12px 14px;border-top:1px solid var(--border-subtle)">' + aus('zr', 'Nenhum vídeo com mais de 2 anos fora dos mais recentes.') + '</li>'], auto: 'desl' })],
      ['esp', 'Há vídeos esperando o seu clique', 'elegíveis', 'Spec 04 L499: “N vídeos de M canais têm mais de 2 anos.” Botão “Ver o que passaria à leitura mensal”; depois dele, “Passar estes vídeos à leitura mensal”. A simulação não muda nada. Aperte o botão no quadro.', S({ resumo: 'Vídeos antigos: 9 vídeos de 3 canais têm mais de 2 anos.', rows: [ROW.esp()] })],
      ['sim45', 'A simulação com 45 canais', 'tabela com rolagem', 'Plano 10.2 e spec 04 L551: tabela com cabeçalho fixo e rolagem interna. Um canal com mais de 100 mostra quantos ficam para o mês seguinte (L499).', S({ resumo: 'Vídeos antigos: 312 vídeos de 45 canais têm mais de 2 anos.', rows: [ROW.esp()], extra: simTab(45) })],
      ['exc', 'Um canal tem mais vídeos do que o automático faz de uma vez', 'excedente do automático', 'Spec 04 L500: âmbar, “<Canal> tem N vídeos para passar à leitura mensal, mais do que o automático faz de uma vez. Confirme pelo botão.”', S({ resumo: 'Vídeos antigos: 9 vídeos de 3 canais têm mais de 2 anos.', rows: [ROW.exc()], auto: 'lig' })],
      ['cong', 'Passaram à leitura mensal e ainda se espera para copiar', 'mês de congelamento aberto', 'Spec 04 L501: “N vídeos passaram à leitura mensal em <mês>. A cópia começa em dd/mm. Para desfazer: fixe o vídeo, ou peça a quem cuida do site (ver o comando).” O mockup troca o fim por “rode o comando” (quem cuida do site é o próprio dono) e “Ver o comando” abre a linha com Copiar e “Já rodei”: remessa ao fecho do spec. O ⓘ diz por que se espera.', S({ resumo: 'Vídeos antigos: 9 vídeos passaram à leitura mensal em abril de 2028. Podem ir para o arquivo a partir de 28/05/2028.', rows: [ROW.cong()] })],
      ['copia', 'A cópia: copiando, no NAS, no B2, recuperação testada', 'copiando e conferido', 'Spec 04 L502: as frases da peça 2, as mesmas da régua dos meses, com a quarta etapa “Miniaturas”.', S({ resumo: 'Vídeos antigos: 37 vídeos de dezembro de 2027 estão sendo copiados.', rows: [ROW.cop(), ROW.nas(), ROW.b2(), ROW.rec()].map(function(h, i){ return h.replace('Dezembro de 2027', ['Copiando', 'No NAS', 'No B2', 'Recuperação'][i]); }), auto: null })],
      ['minis', 'As miniaturas: copiando e quando a origem já perdeu algumas', 'miniaturas', 'Spec 04 L506: “Miniaturas copiadas: N de M.” Quando a origem perdeu alguma, em cinza e sem bloquear: “K miniaturas já não existiam na origem e não foram copiadas.”', S({ resumo: 'Vídeos antigos: 37 vídeos de dezembro de 2027; as miniaturas ainda estão sendo copiadas.', rows: [ROW.min().replace('Dezembro de 2027', 'Copiando'), ROW.min2().replace('Dezembro de 2027', 'Ao final')], auto: null })],
      ['pode', 'Pode ir para o arquivo', 'botão aceso', 'Spec 04 L507: “Pode ir para o arquivo” (acende o botão). O botão abre a confirmação com a frase digitada (quadro seguinte). Só quem administra vê o botão.', S({ resumo: RESUMO_PADRAO, rows: [ROW.pode()], auto: null })],
      ['confirma', 'Confirmar o envio para o arquivo', 'frase digitada, sem desfazer', 'Spec 04 L516 e a peça 3 dos meses: como a dos comentários, com frase digitada, sem desfazer e sem automático. Antes do clique, a prova contada na hora. A frase vale sem acento e com letras maiúsculas ou minúsculas.', function(){ return dlgMandar(true); }],
      ['naomais', 'Alguns vídeos deste mês deixaram de poder sair', 'âmbar com a ação de cada um', 'Spec 04 L508: “N vídeos deste mês não podem mais ir para o arquivo (foram fixados, tiveram troca salva ou saíram do YouTube). Ver quais.” Não é erro: âmbar, com a ação de cada um. Aperte “Ver quais”.', S({ resumo: RESUMO_PADRAO, rows: [ROW.naomais()], auto: null })],
      ['arq', 'Já está no arquivo', 'no arquivo', 'Spec 04 L509: “No arquivo desde dd/mm: N registros de M vídeos” (o mockup diz “enviado em dd/mm”, sem “desde”: remessa ao fecho). O tamanho do banco não cai com isto: ele passa a crescer mais devagar.”', S({ resumo: 'Vídeos antigos: os 148 vídeos de dezembro de 2026 estão no arquivo.', rows: [ROW.arq()], auto: null })],
      ['auto', 'Passar à leitura mensal sozinho: desligado e ligado', 'automático desta peça', 'Spec 04 L510: “Desligado. Você confirma cada leva.” ou “Ligado na configuração do site: até N vídeos por canal por dia.” O nome da variável só no ⓘ. Não é o interruptor da peça 4.', function(){ return secao({ resumo: 'Desligado:', rows: [], auto: 'desl' }) + '<div style="height:12px"></div>' + secao({ resumo: 'Ligado:', rows: [], auto: 'lig' }); }],
      ['novos', 'Chegaram registros novos de vídeo que já estava em leitura mensal', 'vermelho', 'Spec 04 L511: vermelho: “Há registros novos de vídeos que já estavam em leitura mensal. Nada desta parte vai para o arquivo até resolver. Avise quem cuida do site.” O mockup troca o fim por “Pode esperar... Ao voltar, avise o Claude Code para investigar” (remessa ao fecho). Pode esperar: nada sai do banco.', S({ resumo: RESUMO_PADRAO, rows: [ROW.novos()], auto: null })],
      ['atras', 'A leitura mensal está atrasada, parada ou desligada', 'âmbar, vermelho e desligada', 'Spec 04 L512: âmbar acima de 45 dias; vermelho quando algum passa de 90 dias; com a tarefa cortada ou a agenda desligada, “Leitura mensal desligada”, nunca “0 atrasados”. A frase é do redator.', function(){ return secao({ resumo: 'Leitura mensal atrasada:', rows: [ROW.atras()], auto: null }) + '<div style="height:12px"></div>' + secao({ resumo: 'Leitura mensal muito atrasada:', rows: [ROW.atras90()], auto: null }) + '<div style="height:12px"></div>' + secao({ resumo: 'Leitura mensal desligada:', rows: [ROW.atrasOff()], auto: null }); }],
      ['nm', 'Não foi possível ler os vídeos antigos', 'não medido', 'Spec 04 L513: “Não foi possível ler os vídeos antigos.” Hachura rosa. Nunca “nenhum”.', S({ resumo: '', rows: ['<li style="padding:12px 14px;border-top:1px solid var(--border-subtle)">' + aus('nm', 'Não foi possível ler os vídeos antigos.') + '</li>'], auto: null })],
      ['carreg', 'Carregando a seção', 'esqueleto', 'Plano 1.5: a seção vem por requisição; esqueleto com a altura final da linha, nunca “nenhum” enquanto espera.', S({ resumo: 'Lendo os vídeos antigos…', carreg: true, auto: null })]
    ];
  }

  window.PECA8 = { secao: secao, ROW: ROW, estados: estados, abre: abre };
  if (document.body) tela(); else document.addEventListener('DOMContentLoaded', tela);
})();
