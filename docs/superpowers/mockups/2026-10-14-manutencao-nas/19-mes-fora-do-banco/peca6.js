/* peca6.js: peça 6, o pedido de período longo ("Ver antigo"). PLANO seção 8; spec 04 §14.6 (L364-382) e L518 (ficha do vídeo). Datas de exemplo: hoje = 03/05/2028; o online começa em 01/10/2027. Todo número de mês arquivado é exemplo.
   ?e=pagina|todos-antes|todos-espera|todos-pronto|todos-erro|todos-video|<id>  &perfil=adm|ed|le  &inicio=pronto|antes (só em e=pagina) */
(function(){
  'use strict';
  var Q = M.Q, ic = M.ic, aus = M.aus, esc = M.esc, ib = M.ib, infoBox = M.infoBox;
  var E = Q('e', 'pagina'), PERFIL = Q('perfil', 'adm'), LE = PERFIL === 'le';
  var CANAL = 'Viagem Lenta';
  var N = 0;

  /* ------------------------------------------------------------ dados de exemplo: os 12 meses fechados, de maio de 2027 a abril de 2028 */
  /* [mês, dias medidos, dias do mês, origem, views, marca]  origem: arq = cópia no NAS; onl = banco; zero = sem registro */
  var MESES = [
    ['Maio de 2027', 31, 31, 'arq', '118 mil'],
    ['Junho de 2027', 30, 30, 'arq', '124 mil'],
    ['Julho de 2027', 0, 31, 'zero', ''],
    ['Agosto de 2027', 29, 31, 'arq', '96 mil'],
    ['Setembro de 2027', 30, 30, 'arq', '131 mil'],
    ['Outubro de 2027', 31, 31, 'onl', '142 mil'],
    ['Novembro de 2027', 30, 30, 'onl', '155 mil'],
    ['Dezembro de 2027', 27, 31, 'onl', '168 mil'],
    ['Janeiro de 2028', 31, 31, 'onl', '149 mil'],
    ['Fevereiro de 2028', 29, 29, 'onl', '136 mil'],
    ['Março de 2028', 31, 31, 'onl', '160 mil'],
    ['Abril de 2028', 30, 30, 'parcial', '152 mil']
  ];
  var CONT = { '12': [12, 7, 5, 'os 12 meses'], '24': [24, 7, 17, 'os 24 meses'], '36': [36, 7, 29, 'os 36 meses'], 'tudo': [50, 7, 43, 'todos os 50 meses (a coleta começou em 03/2024)'] };
  var MN = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  /* nome do i-ésimo mês (0 = o mais antigo) de um período de t meses que termina em abril de 2028 */
  function mesNome(t, i){ var a = 2028 * 12 + 3 - (t - 1) + i; return MN[a % 12] + ' de ' + Math.floor(a / 12); }
  function cap(x){ return x.charAt(0).toUpperCase() + x.slice(1); }
  var LIM = 36;

  /* ------------------------------------------------------------ peças pequenas */
  function info(rot, html){ var id = 'i-va-' + (++N); return ib(id, rot) + infoBox(id, html); }
  function barra(pct, ind, rot, txt, id){ return '<span class="m-bar' + (ind ? ' ind' : '') + '"' + (id ? ' id="' + id + '"' : '') + ' role="progressbar" aria-label="' + esc(rot) + '"' + (ind ? '' : ' aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"' + (txt ? ' aria-valuetext="' + esc(txt) + '"' : '')) + '><i style="width:' + (ind ? 35 : pct) + '%"></i></span>'; }
  function mini(pct){ return '<span class="m-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'; }
  function btn(rot, acao, cls, off){ return '<button type="button" class="btn ' + (cls || '') + '" data-va="' + acao + '"' + (off ? ' disabled aria-describedby="vaFrase"' : '') + '>' + rot + '</button>'; }
  function cab(extra){ return '<div class="m-va-h"><h3>Ver antigo: o que está no arquivo</h3><span class="m-novo">+ novo</span>' + (extra || '') + '</div>'; }
  function painel(corpo, o){
    o = o || {};
    return '<section class="m-va" id="' + (o.id || 'va-painel') + '" tabindex="-1" aria-label="Ver antigo: o que está no arquivo">' + cab(o.ib) + corpo + '</section>';
  }
  var PODE = 'Pode esperar. Nada se resolve daqui: quando a forja e o NAS voltarem, peça de novo.';

  /* uma linha de mês. m = linha de MESES; falha = null | ['tri'|'oct'|'nm', 'motivo'] */
  function mes(m, falha){
    var nome = m[0];
    if (falha) {
      var f = falha[0];
      return '<li class="m-vam falta">' + ic(f) + '<span class="n">' + nome + '</span><span class="c">' + falha[1] + '</span><span class="v"></span></li>';
    }
    if (m[3] === 'zero') return '<li class="m-vam">' + ic('zero') + '<span class="n">' + nome + '</span><span class="c">Sem registro neste mês (conferimos em 03/05)</span><span class="v"></span></li>';
    var pct = Math.round(100 * m[1] / m[2]);
    var orig = m[3] === 'arq' ? 'da cópia no NAS' : m[3] === 'onl' ? 'do banco' : 'do banco, ainda sem cópia';
    var ico = m[3] === 'parcial' ? ic('pont') : ic('ok');
    var marca = m[3] === 'parcial' ? '<span class="m-marca">parcial</span>' : '';
    return '<li class="m-vam">' + ico + '<span class="n">' + nome + '</span><span class="c"><span class="m-num">' + m[1] + ' de ' + m[2] + ' dias medidos</span>' + mini(pct) + '<span class="o">' + orig + '</span>' + marca + '</span><span class="v"><span class="m-num">' + m[4] + '</span> views</span></li>';
  }
  function lista(falhas){
    falhas = falhas || {};
    return '<ul class="m-va-meses" aria-label="Meses do pedido">' + MESES.map(function(m){ return mes(m, falhas[m[0]]); }).join('') + '</ul>';
  }

  /* ------------------------------------------------------------ os momentos do painel */
  function fraseDe(per){
    var c = CONT[per];
    if (per === 'tudo') return 'Tudo passa do que o site guarda (' + c[0] + ' meses). Escolha até ' + LIM + ' meses.';
    return 'Vai ler ' + c[3] + ' de ' + CANAL + ': ' + c[1] + ' estão online, ' + c[2] + ' no arquivo.';
  }
  function antes(per){
    per = per || '12';
    var c = CONT[per];
    var seg = '<div class="m-segs" role="group" aria-label="Período a ler">' + [['12', '12 meses'], ['24', '24 meses'], ['36', '36 meses'], ['tudo', 'Tudo']].map(function(p){
      return '<button type="button" data-per="' + p[0] + '" aria-pressed="' + (p[0] === per ? 'true' : 'false') + '">' + p[1] + '</button>'; }).join('') + '</div>';
    var frase = fraseDe(per);
    return painel(seg + '<p class="m-va-lead" id="vaFrase">' + frase + '</p>' +
      '<p class="k">Não é na hora: a resposta leva de alguns segundos a alguns minutos e depende de a casa estar ligada. Você pode fechar a página e voltar depois.</p>' +
      '<div class="m-va-acoes">' + btn('Pedir', 'pedir', 'primary', per === 'tudo') + '</div>', { ib: info('O que este pedido faz', 'A casa é a forja e o NAS; o site não sabe qual dos dois está parado. O pedido lê os meses que saíram do banco no NAS e mistura com o que ainda está online.') });
  }
  function semArquivo(){
    return painel(aus('pt', 'Ainda não há mês no arquivo. O primeiro sai em 01/02/2027.', 'Por isso não há nada para pedir; o botão só aparece quando houver.'));
  }
  function desligado(){
    return painel(aus('pt', 'O arquivo está desligado neste site. Nada foi pedido.', 'Quem administra o site liga o arquivo; até lá, tudo o que está online continua nas telas.', ic('info')));
  }
  function enviado(hora){
    return painel('<p class="m-va-lead">Pedido feito às ' + (hora || '14:32') + '. Aguardando a casa.</p>' + barra(0, true, 'Aguardando a casa') +
      '<p class="k">Pode fechar esta página: o resultado fica aqui por 30 dias.</p><div class="m-va-acoes">' + btn('Cancelar pedido', 'cancelar') + '</div>');
  }
  function lidos(n, total){
    if (n < 1) return 'Ainda lendo o primeiro mês.';
    if (n === 1) return 'Já lido: ' + mesNome(total, 0) + '.';
    return 'Já lidos: ' + mesNome(total, 0) + ' a ' + mesNome(total, Math.min(n, total) - 1) + '.';
  }
  function andamento(n, total, reaberto){
    total = total || 12;
    var pct = Math.round(100 * n / total);
    var lead = reaberto ? '<p class="m-va-lead">Há um pedido seu em andamento desde 14:32. Pode fechar esta página: o resultado fica aqui por 30 dias.</p>' : '';
    return painel(lead + '<div class="m-va-prog"><div class="t"><span>Lendo: <span class="m-num" id="vaN">' + n + ' de ' + total + '</span> meses</span><span class="m-num" id="vaPct">' + pct + '%</span></div>' + barra(pct, false, 'Meses lidos', n + ' de ' + total + ' meses', 'vaBar') + '</div>' +
      '<p class="k" id="vaLidos">' + lidos(n, total) + '</p><div class="m-va-acoes">' + btn('Cancelar pedido', 'cancelar') + '</div>');
  }
  function pronto(per){
    var t = CONT[per || '12'][0]; if (t > LIM || t < 12) t = 12;
    var mais = t > 12 ? '<p class="k">E mais ' + (t - 12) + ' meses mais antigos (' + mesNome(t, 0) + ' a ' + mesNome(t, t - 13) + '), no mesmo formato. O mockup mostra só os 12 mais recentes.</p>' : '';
    return painel('<p class="m-va-lead">Veio tudo: ' + t + ' meses, de ' + mesNome(t, 0) + ' a abril de 2028. Abril é parcial e julho de 2027 não tinha registro.</p>' +
      '<p class="k">Gerado em 03/05 às 14:34; vale até 02/06. ' + info('Como ler a lista', 'Cada mês diz de onde veio e quantos dias foram medidos. “Parcial” é o mês que ainda está online e não foi copiado: vem do banco e pode mudar, porque o YouTube corrige as contagens dos últimos dias. O resultado nunca traz texto de comentário.') + '</p>' +
      lista() + mais + '<div class="m-va-acoes">' + btn('Pedir outro período', 'novo') + '</div>');
  }
  function venceu(){
    return painel(aus('pt', 'O resultado de 03/05 venceu. Peça de novo.', 'Ele valia por 30 dias; passou de 02/06.', ic('info')) + '<div class="m-va-acoes">' + btn('Pedir de novo', 'novo', 'primary') + '</div>');
  }
  function incompleto(){
    var f = ['tri', 'Não veio: o NAS parou.'];
    return painel(aus('am', 'Faltam 2 de 12 meses: agosto e setembro de 2027, porque o NAS deixou de responder durante a leitura.', 'Os outros 10 meses vieram e estão abaixo. Nada foi perdido. ' + PODE) +
      lista({ 'Agosto de 2027': f, 'Setembro de 2027': f }) + '<div class="m-va-acoes">' + btn('Pedir de novo', 'novo', 'primary') + '</div>');
  }
  function alerta(h){ return '<div role="alert">' + h + '</div>'; }
  function bate(){
    return painel(alerta(aus('vm', 'O arquivo de setembro de 2027 está diferente do que o site guardou. O relatório não foi montado com ele.', 'Falta 1 de 12 meses: setembro de 2027. Os outros 11 vieram. O mês continua guardado no NAS e no B2, sem mudança. Pode esperar até você voltar; ao voltar, peça ao Claude Code para conferir setembro de 2027.')) +
      lista({ 'Setembro de 2027': ['oct', 'Não veio: o arquivo dele está diferente do que o site guardou.'] }), { ib: info('O que significa “diferente”', 'A cópia no NAS não bate com o que o site guardou na hora de copiar. Por isso o relatório deixa de usar esse mês.') });
  }
  function naoResp(){
    return painel(alerta(aus('am', 'A casa não respondeu em 15 minutos. O pedido venceu e nada foi perdido.', 'Último sinal: 02/05 21:40. ' + PODE)) +
      '<div class="m-va-acoes">' + btn('Pedir de novo', 'novo', 'primary') + '</div>', { ib: info('Triângulo ou octógono', 'O aviso é triângulo até 36 horas sem sinal e octógono a partir daí. A casa é a forja e o NAS; o site não sabe qual dos dois está parado.') });
  }
  function nasFora(){
    return painel(alerta(aus('am', 'A forja respondeu, mas o NAS não está acessível.', 'Nada foi perdido. ' + PODE)) + '<div class="m-va-acoes">' + btn('Pedir de novo', 'novo', 'primary') + '</div>');
  }
  function grande(){
    return painel(aus('pt', 'O período pedido passa do tamanho que o site guarda. Peça menos meses.', 'O limite deste site é de ' + LIM + ' meses. Escolha um período menor.', ic('info')) +
      '<div class="m-va-acoes">' + btn('Escolher um período menor', 'novo', 'primary') + '</div>');
  }
  function repetido(){
    return painel(aus('pt', 'Já há um pedido igual em andamento.', 'Foi feito às 14:32. Não é preciso pedir de novo.', ic('info')) + '<div class="m-va-acoes">' + btn('Ver o pedido', 'ver') + '</div>');
  }
  function cancelado(hora){
    return painel(aus('pt', 'Pedido cancelado às ' + (hora || '14:36') + '.', 'Nada foi mudado no banco nem no arquivo.', ic('info')) + '<div class="m-va-acoes">' + btn('Pedir de novo', 'novo', 'primary') + '</div>');
  }
  function naoMedido(){
    return painel(aus('nm', 'Não foi possível ler o estado do pedido.', 'O site não conseguiu ler o próprio registro do pedido. Ele pode ter sido feito. Abra a página de novo em alguns minutos.'));
  }

  /* ------------------------------------------------------------ o vídeo: a ficha de L518 */
  function ficha(semPassagem){
    var passa = semPassagem
      ? aus('am', 'Incompleto: falta a contagem da passagem à leitura mensal.', 'O resumo de fevereiro de 2028 não foi recebido. Nunca “sem dados”.')
      : '<span class="m-num">41,2 mil</span> views, lida em 18/02<span class="ap">Contagem na passagem à leitura mensal (21/02/2028).</span>';
    return '<dl class="m-ficha">' +
      '<dt>Primeiro título</dt><dd>Patagônia em 12 dias: roteiro completo</dd>' +
      '<dt>Último título</dt><dd>Patagônia em 12 dias (roteiro e custos)<span class="ap">3 versões do título</span></dd>' +
      '<dt>Miniatura e descrição</dt><dd>2 versões da miniatura, 4 da descrição</dd>' +
      '<dt>Views em 1 dia</dt><dd class="m-num">1,9 mil</dd><dt>Views em 7 dias</dt><dd class="m-num">14,6 mil</dd><dt>Views em 30 dias</dt><dd class="m-num">31,4 mil</dd>' +
      '<dt>Leitura mais recente</dt><dd><span class="m-num">43,0 mil</span> views, lido em 01/05</dd>' +
      '<dt>Na passagem</dt><dd>' + passa + '</dd></dl>';
  }
  function videoPronto(){
    return painel('<p class="m-va-lead">Veio a ficha completa do vídeo.</p><p class="k">Gerado em 03/05 às 14:34; vale até 02/06.</p>' + ficha(false) + '<div class="m-va-acoes">' + btn('Pedir de novo', 'novo') + '</div>');
  }
  function videoIncompleto(){
    return painel('<p class="m-va-lead">A ficha veio, mas falta uma parte.</p>' + ficha(true) + '<p class="k">Peça de novo quando a forja e o NAS voltarem.</p><div class="m-va-acoes">' + btn('Pedir de novo', 'novo', 'primary') + '</div>');
  }

  /* ------------------------------------------------------------ a tela real: página do canal (mockup 15), "Views por dia" */
  function seed(n, a){ var r = [], x = a || 7; for (var i = 0; i < n; i++) { x = (x * 9301 + 49297) % 233280; r.push(30 + Math.round(x / 233280 * 62)); } return r; }
  function bars(n, a){ return seed(n, a).map(function(h){ return '<i style="height:' + h + '%"></i>'; }).join(''); }
  function grafico(){
    return '<div class="m-ex" role="img" aria-label="Eixo do tempo com o trecho no arquivo e o trecho online"><div class="m-seg arq"><span class="rot">' + ic('arq') + '<span>25/08 a 30/09/2027 no arquivo</span></span></div><div class="m-seg onl" style="flex:215 1 0">' + bars(28, 28) + '</div></div>' +
      '<div class="m-eixo"><span>25/08/2027</span><span class="ini">online desde 01/10/2027</span><span>03/05/2028</span></div>';
  }
  function tela(corpoPainel, aberto){
    var botao = LE ? '' : '<button type="button" class="btn small" id="vaAbre" aria-expanded="' + (aberto ? 'true' : 'false') + '" aria-controls="va-vivo">Ver antigo</button>';
    var le = LE ? aus('arq', '25/08 a 30/09/2027 no arquivo.', 'Quem só lê vê a frase, sem o botão “Ver antigo”.') : '';
    return '<div class="m-va-tela"><h3>' + CANAL + '</h3><p class="m-va-sub">Página do canal · Views por dia</p>' + grafico() +
      (LE || botao ? '<div class="m-cap">' + le + '<div class="m-botoes">' + botao + '</div></div>' : '') + '</div>' +
      (LE ? '' : '<div id="va-vivo"' + (aberto ? '' : ' hidden') + '>' + corpoPainel + '</div><p class="m-sr" role="status" id="vaSt"></p>');
  }
  function tiraCanal(){ return '<p class="m-va-tira">Página de ' + CANAL + ', abaixo do gráfico de views por dia · <span class="btn small m-va-falso" aria-hidden="true">Ver antigo</span></p>'; }
  function tiraVideo(){ return '<p class="m-va-tira">Página do vídeo “Patagônia em 12 dias”, em leitura mensal desde 21/02/2028 · <span class="btn small m-va-falso" aria-hidden="true">Ver antigo</span></p>'; }

  /* ------------------------------------------------------------ quadros (títulos para o dono; código e fonte vão no ⓘ de quem revisa) */
  function quadro(q){
    var iid = 'i-q6-' + q[0];
    var corpo = q[3];
    if (LE && q[4] !== 'sempre') corpo = aus('arq', 'Quem só lê não vê esta peça.', 'Para quem só lê, a página mostra “25/08 a 30/09/2027 no arquivo.” no lugar do botão “Ver antigo”.');
    return '<section class="m-q" id="q-' + q[0] + '"><header class="m-q-h m-q-h-dono"><h4 class="m-q-t">' + q[1] + '</h4>' + ib(iid, 'Para quem revisa: código e fonte deste quadro') + '</header><div class="m-q-b">' + infoBox(iid, 'Para quem revisa: quadro <b>' + q[0].toUpperCase() + '</b>. Fonte: ' + q[2] + '.') + corpo + '</div></section>';
  }
  function Qc(id, t, f, html, nota){ return [id, t, f, tiraCanal() + html + (nota ? '<p class="m-q-nota">' + nota + '</p>' : '')]; }
  function Qv(id, t, f, html, nota){ return [id, t, f, tiraVideo() + html + (nota ? '<p class="m-q-nota">' + nota + '</p>' : '')]; }

  var F = {
    antes: [
      Qc('a-pedir', 'Antes de pedir: o que será lido e que não é na hora', 'spec 04 L366', antes('12'), 'Os botões de período mudam a frase. “Tudo” passa do que o site guarda: o aviso vem antes e o “Pedir” fica desligado. O botão “Pedir” funciona na página (ver “A página, funcionando”).'),
      Qc('a-nada', 'Ainda não há nada no arquivo: não há o que pedir', 'spec 04 L367', semArquivo(), 'Este é o caso de hoje (14/10/2026). O botão “Ver antigo” nem aparece na página.'),
      Qc('a-desl', 'O arquivo está desligado neste site', 'spec 04 L368', desligado()),
      Qc('a-grande', 'Pediu demais: o período passa do que o site guarda', 'spec 04 L379', grande())
    ],
    espera: [
      Qc('e-env', 'Você pediu e a casa ainda não pegou', 'spec 04 L369', enviado('14:32')),
      Qc('e-and', 'A casa está lendo: 9 de 12 meses', 'spec 04 L370', andamento(9)),
      Qc('e-reab', 'Você fechou a página e voltou, e o pedido ainda anda', 'spec 04 L371', andamento(9, 12, true)),
      Qc('e-rep', 'Você pediu de novo o mesmo período', 'spec 04 L380', repetido()),
      Qc('e-canc', 'Você cancelou o pedido', 'spec 04 L381', cancelado('14:36'))
    ],
    pronto: [
      Qc('p-ok', 'O resultado chegou: cada mês com os dias medidos', 'spec 04 L372, L375 (mês sem registro)', pronto(), 'Com 24 ou 36 meses a lista mostra os 12 mais recentes e diz quantos mais vieram (limite do mockup). Cada mês traz de onde veio e quantos dias foram medidos. Abril é parcial (ainda online, sem cópia). Julho não tinha registro: caixa com o 0, nunca um mês vazio sem explicação.'),
      Qc('p-venc', 'O resultado venceu', 'spec 04 L373', venceu())
    ],
    erro: [
      Qc('x-inc', 'Chegou incompleto: faltam 2 meses', 'spec 04 L374', incompleto(), 'Os meses que faltam não têm número e não são zero: levam a forma do motivo.'),
      Qc('x-bate', 'Um mês do arquivo não bate', 'spec 04 L378', bate()),
      Qc('x-casa', 'A casa não respondeu', 'spec 04 L376', naoResp()),
      Qc('x-nas', 'A forja respondeu e o NAS não', 'spec 04 L377', nasFora()),
      Qc('x-nm', 'Não deu para ler o estado do pedido', 'spec 04 L382', naoMedido())
    ],
    video: [
      Qv('v-ok', 'No vídeo: a ficha chegou completa', 'spec 04 L518', videoPronto(), 'A ficha traz títulos, quantas versões, as views em 1, 7 e 30 dias e as duas contagens da leitura mensal, cada uma com a data em que foi lida (vocabulário do spec).'),
      Qv('v-inc', 'No vídeo: a ficha chegou incompleta', 'spec 04 L518', videoIncompleto(), 'Sem o resumo do mês em que o vídeo passou à leitura mensal: “incompleto”, nunca “sem dados”.')
    ]
  };
  var GR = [['pagina', 'A página, funcionando'], ['todos-antes', 'Antes de pedir'], ['todos-espera', 'Esperando'], ['todos-pronto', 'Pronto'], ['todos-erro', 'Deu errado'], ['todos-video', 'No vídeo']];
  var CH = { 'todos-antes': 'antes', 'todos-espera': 'espera', 'todos-pronto': 'pronto', 'todos-erro': 'erro', 'todos-video': 'video' };
  var TODOS = []; Object.keys(F).forEach(function(k){ TODOS = TODOS.concat(F[k]); });

  /* ------------------------------------------------------------ montagem */
  var viva = { st: Q('inicio', 'pronto'), per: '12', n: 0, timer: null };
  function corpoVivo(){
    if (viva.st === 'antes') return antes(viva.per);
    if (viva.st === 'enviado') return enviado('14:32');
    if (viva.st === 'andamento') return andamento(viva.n, CONT[viva.per][0]);
    if (viva.st === 'cancelado') return cancelado('14:36');
    return pronto(viva.per);
  }
  var INTRO = '<h2 class="m-h2">“Ver antigo”: pedir um período longo</h2><div class="m-int-intro"><p>Esta é a página do canal ' + CANAL + ', com o gráfico de views por dia.</p><p>Quando o gráfico diz “no arquivo”, o botão “Ver antigo” pede à casa os meses que saíram do banco.</p><p>Abaixo do gráfico está o pedido: o que será lido, a espera e o resultado mês a mês.</p></div>';
  var corpo;
  if (E === 'pagina') {
    corpo = tela(corpoVivo(), true) + '<p class="m-q-nota" style="margin-top:14px">Funciona de verdade: em “Pedir outro período”, escolha o período e toque em “Pedir”. Você vê o pedido enviado, a leitura andando e o resultado; “Cancelar pedido” para no meio. Os outros momentos (erros, vídeo) estão nos grupos da barra “Estados do mockup”.</p>';
  } else {
    var qs = CH[E] ? F[CH[E]] : TODOS.filter(function(q){ return q[0] === E; });
    corpo = qs.length ? qs.map(quadro).join('') : '<p>Estado desconhecido.</p>';
  }
  var ids = TODOS.map(function(q){ return [q[0], q[0].toUpperCase()]; });
  var barraMk = M.mock('peça 6 · ' + E, [M.grupo('Grupo', 'e', GR, E), M.grupo('Um quadro', 'e', ids, E), M.grupo('Perfil', 'perfil', [['adm', 'Administra'], ['ed', 'Edita'], ['le', 'Só lê']], PERFIL),
      M.grupo('Página começa em', 'inicio', [['pronto', 'Resultado pronto'], ['antes', 'Antes de pedir']], viva.st, { e: 'pagina' })],
    'Peça 6 (spec 04 §14.6). Datas de exemplo: hoje = 03/05/2028, o online começa em 01/10/2027, o canal tem coleta desde 03/2024. Todo número de mês arquivado é exemplo. Carregando: esta peça tem estados próprios de espera (“Aguardando a casa”, “Lendo: 9 de 12 meses”), não esqueleto. Medida: o resultado traz só dias medidos e views por mês; nunca texto de comentário.');
  document.title = 'Mockup 19: ver antigo';
  document.body.innerHTML = barraMk + M.obs('canais', 'cheio') + '<main id="m-main">' + INTRO + M.legenda(false) + corpo + '</main>';

  /* ------------------------------------------------------------ a página viva
     O painel só é trocado nas transições de estado; durante a leitura só o texto, a barra e o aria-valuenow mudam, para o foco e o toque em "Cancelar pedido" não se perderem. */
  var CUR = null;
  function dizer(t){ var st = document.getElementById('vaSt'); if (st) st.textContent = t; }
  function pinta(foco, fala){
    var el = document.getElementById('va-vivo'); if (!el) return;
    var dentro = el.contains(document.activeElement);
    el.innerHTML = corpoVivo(); CUR = viva.st;
    if (foco || dentro) {
      var alvo = (!foco && viva.st !== 'pronto' && el.querySelector('[data-va="cancelar"]')) || document.getElementById('va-painel');
      if (alvo) alvo.focus();
    }
    if (fala) dizer(fala);
  }
  function passo(n, total){
    var N_ = document.getElementById('vaN'), P = document.getElementById('vaPct'), B = document.getElementById('vaBar'), L = document.getElementById('vaLidos');
    var pct = Math.round(100 * n / total);
    if (N_) N_.textContent = n + ' de ' + total;
    if (P) P.textContent = pct + '%';
    if (B) { B.setAttribute('aria-valuenow', String(pct)); B.setAttribute('aria-valuetext', n + ' de ' + total + ' meses'); B.firstChild.style.width = pct + '%'; }
    if (L) L.textContent = lidos(n, total);
    var q = Math.floor(total / 4);
    if (n === q || n === 2 * q || n === 3 * q) dizer('Lendo: ' + n + ' de ' + total + ' meses.');
  }
  function para(){ if (viva.timer) { clearInterval(viva.timer); viva.timer = null; } }
  function pedir(){
    para(); viva.st = 'enviado'; pinta(true, 'Pedido feito às 14:32. Aguardando a casa.');
    var total = CONT[viva.per][0];
    viva.timer = setInterval(function(){
      if (viva.st === 'enviado') { viva.st = 'andamento'; viva.n = 0; pinta(false, 'A casa começou a ler.'); return; }
      if (viva.st === 'andamento') {
        viva.n += 1;
        if (viva.n >= total) { para(); viva.st = 'pronto'; pinta(true, 'Veio tudo: ' + Math.min(total, LIM) + ' meses.'); return; }
        passo(viva.n, total);
      }
    }, 700);
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('#vaAbre');
    if (a) {
      var v = document.getElementById('va-vivo'), abre = v.hasAttribute('hidden');
      if (abre) v.removeAttribute('hidden'); else v.setAttribute('hidden', '');
      a.setAttribute('aria-expanded', String(abre));
      if (abre) { var p = document.getElementById('va-painel'); if (p) p.focus(); }
      return;
    }
    var p = e.target.closest && e.target.closest('[data-per]');
    if (p) {
      var per = p.getAttribute('data-per'); viva.per = per;
      var pai = p.parentNode; pai.querySelectorAll('[data-per]').forEach(function(b){ b.setAttribute('aria-pressed', String(b === p)); });
      var f = document.getElementById('vaFrase'); if (f) f.textContent = fraseDe(per);
      var pd = document.querySelector('#va-vivo [data-va="pedir"]'); if (pd) pd.disabled = per === 'tudo';
      return;
    }
    var b = e.target.closest && e.target.closest('[data-va]'); if (!b) return;
    var ac = b.getAttribute('data-va');
    if (!document.getElementById('va-vivo') || !document.getElementById('va-vivo').contains(b)) { return; }
    if (ac === 'pedir') { if (viva.per !== 'tudo') pedir(); }
    else if (ac === 'cancelar') { para(); viva.st = 'cancelado'; pinta(true, 'Pedido cancelado.'); }
    else if (ac === 'novo') { para(); viva.st = 'antes'; viva.per = '12'; pinta(true); }
  });
})();
