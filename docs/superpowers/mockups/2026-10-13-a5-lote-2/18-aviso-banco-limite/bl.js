/* bl.js: mockup 18, aviso "banco chegando ao limite" no cabeçalho do Observatório (A5, lote 2; spec 06 seção 9.2, item 80; medidas 6.5b linha 18).
   Rodada do retorno do dono (13/10): o limite de 500 MB é do banco INTEIRO do site; a tela fala em PERCENTUAL do limite, os MB só aparecem dentro do botão de informação.
   ?caso=verde|amarelo|vermelho-tamanho|vermelho-projecao|acima|sem-crescimento|projecao-nm|sem-leitura|exportacoes|erro|vazio|so-leitura  (lote-pendente = apelido antigo de exportacoes)
   ?painel=aberto|fechado  ?tema=claro. Hoje = 13/10/2026 às 14:40 (São Paulo). Todo número é exemplo (a produção tem outro tamanho).
   Regras (em percentual do limite, sobre o inteiro MOSTRADO): amarelo a partir de 70%; vermelho a partir de 85% ou quando a previsão chega ao limite em menos de 90 dias; acima de 100% = acima do limite;
   previsão = reta dos últimos 28 dias; menos de 14 dias de leitura = previsão "não medida"; sem a linha do dia = "sem leitura hoje", nunca verde.
   FONTE ÚNICA: cada estado guarda só os MB de cada parte (sp) e o quanto cada parte cresceu em 28 dias (g); todo o resto sai por código daqui (tamanho, %, livre, partes que somam 100, dias, data). */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, q = A.q, esc = A.esc;
  var caso = q.get('caso') || 'verde';
  var LIM = 500, AMP = 70, VMP = 85, HOJE = L.HOJE;                 /* limite em MB (só no botão de informação); cortes em % do limite */
  var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function mesAno(iso){ return MES[+iso.slice(5, 7) - 1] + '/' + iso.slice(0, 4); }
  function mb(x, c){ return A.dec(x, c == null ? 0 : c); }
  function pc(x, c){ return A.dec(x, c == null ? 0 : c) + '%'; }
  function soma(v){ return v.reduce(function(a, b){ return a + b; }, 0); }

  /* ---------------------------------------------------------------- dados de exemplo (a fonte única)
     sp = MB de [concorrentes, seu canal, resto do site]; g = quanto cada parte cresceu em 28 dias (MB); a reta tem o crescimento = soma(g) / 28 */
  var SPV = [41.3, 88.1, 86.6], GV = [2.9, 2.1, 1.7];
  var LOTES = [
    { canal: 'Aldinho', per: 'jan/2025 a set/2026', linhas: 118402, exp: '2026-10-09', conf: '2026-10-09' },
    { canal: 'Leo', per: 'abr/2025 a set/2026', linhas: 61870, exp: '2026-10-12', conf: null }
  ];
  var D = {
    'verde':             { sp: SPV, g: GV },
    'amarelo':           { sp: [112.4, 131.0, 116.6], g: [2.4, 1.9, 1.3] },
    'vermelho-tamanho':  { sp: [171.5, 142.2, 126.3], g: [4.6, 2.1, 1.7] },
    'vermelho-projecao': { sp: [158.0, 120.4, 113.6], g: [24.1, 8.9, 4.8] },
    'acima':             { sp: [201.4, 160.0, 159.6], g: [4.6, 2.1, 1.7] },
    'sem-crescimento':   { sp: SPV, g: [0, 0, 0] },
    'projecao-nm':       { sp: SPV, g: null, reg: 6 },
    'sem-leitura':       { sp: null, ult: { dia: '2026-10-12', tam: 214.8 }, g: null },
    'exportacoes':       { sp: SPV, g: GV, lotes: LOTES },
    'erro':              { sp: null, erro: true, g: null },
    'vazio':             { sp: null, vazio: true, g: null },
    'so-leitura':        { sp: SPV, g: GV, leitura: true }
  };
  if (caso === 'lote-pendente') caso = 'exportacoes';
  var c = D[caso] || D.verde; c.k = D[caso] ? caso : 'verde';
  c.tam = c.sp ? Math.round(soma(c.sp) * 10) / 10 : null;          /* tamanho de hoje = soma das três partes (nunca digitado à parte) */

  /* ---------------------------------------------------------------- a conta (tudo derivado dos números acima, para nada contradizer nada) */
  var temTam = c.tam != null;
  var cresc28 = c.g ? soma(c.g) : null;                              /* MB em 28 dias */
  var porDia = cresc28 == null ? null : cresc28 / 28;
  var dias = null, quando = null;                                    /* dias até o limite, e a data */
  if (temTam && porDia != null && porDia > 0.0001) { dias = Math.max(0, (LIM - c.tam) / porDia); quando = A.addDias(HOJE, Math.round(dias)); }
  /* estado da previsão: ok | zero (não cresceu) | nm-poucos | nm-sem | nm-erro | nm-vazio */
  var proj = c.erro ? 'nm-erro' : c.vazio ? 'nm-vazio' : !temTam ? 'nm-sem' : c.reg != null ? 'nm-poucos' : porDia === 0 ? 'zero' : 'ok';
  /* O percentual é UM inteiro, arredondado uma vez; a cor, o nome e todo texto leem ESTE inteiro */
  var PC = temTam ? Math.round(c.tam / LIM * 100) : null;
  var PCU = c.ult ? Math.round(c.ult.tam / LIM * 100) : null;       /* última leitura (sem leitura hoje) */
  var cresc28pc = cresc28 == null ? null : cresc28 / LIM * 100;      /* % do limite, uma casa */
  var nivel;                                                         /* verde | amarelo | vermelho | nm */
  var motivoV = '';
  if (!temTam) nivel = 'nm';
  else if (PC >= VMP) { nivel = 'vermelho'; motivoV = 'tamanho'; }
  else if (proj === 'ok' && dias < 90) { nivel = 'vermelho'; motivoV = 'previsao'; }
  else if (PC >= AMP) nivel = 'amarelo';
  else nivel = 'verde';
  var acima = temTam && PC > 100;
  /* nível do TAMANHO (a barra e a minibarra pintam o preenchimento por ele; o vermelho por previsão fica na pastilha, no "enche em N dias" e no losango da régua) */
  var nivelTam = !temTam ? 'nm' : PC >= VMP ? 'vermelho' : PC >= AMP ? 'amarelo' : 'verde';
  /* painel: padrão por estado. Aberto onde pede ação ou desconfiança; fechado onde está tudo bem. ?painel=aberto|fechado força. Em estado calmo a escolha do dono é lembrada. */
  var calmo = nivel === 'verde' && !c.erro && !c.vazio;
  var LEMB = 'banco-painel-calmo';
  /* só na mostra: os estados calmos que o dono precisa JULGAR (zero medido, previsão não medida, exportações a confirmar) abrem o painel por padrão; em produção seguem fechados. Só "Com folga" usa a escolha lembrada. */
  var abreNaMostra = caso === 'sem-crescimento' || caso === 'projecao-nm' || caso === 'exportacoes';
  var lembra = calmo && !abreNaMostra;
  var painelAberto = q.get('painel') === 'aberto' ? true : q.get('painel') === 'fechado' ? false : abreNaMostra ? true : calmo ? L.lembrar.ler(LEMB) === 'aberto' : true;
  var nLotes = c.lotes ? c.lotes.length : 0;

  /* ---------------------------------------------------------------- ícones: uma forma por estado (lê em cinza) */
  function svg(cl, p){ return '<svg class="i ' + cl + '" viewBox="0 0 16 16" aria-hidden="true">' + p + '</svg>'; }
  var IC = {
    verde: svg('bl-ic verde', '<circle cx="8" cy="8" r="6.2"/><path d="M5.2 8.3 7.2 10.3 10.9 6"/>'),
    amarelo: svg('bl-ic amarelo', '<path d="M8 2.2 14.4 13.4H1.6Z"/><path d="M8 6.6v3.2M8 11.5v.1"/>'),
    vermelho: svg('bl-ic vermelho', '<path d="M5.2 1.8h5.6l3.4 3.4v5.6l-3.4 3.4H5.2L1.8 10.8V5.2z"/><path d="M8 4.8v3.8M8 11v.1"/>'),
    feito: svg('', '<circle cx="8" cy="8" r="6.2"/><path d="M5.2 8.3 7.2 10.3 10.9 6"/>'),
    falta: svg('', '<circle cx="8" cy="8" r="6.2" stroke-dasharray="2.4 2.2"/>')
  };
  function iconeNivel(n){ return n === 'nm' ? A.nmSw() : IC[n]; }
  var NOME = { verde: 'Com folga', amarelo: 'Enchendo', vermelho: acima ? 'Acima do limite' : motivoV === 'previsao' ? 'Enche em ' + Math.round(dias) + ' dias' : 'Quase cheio' };

  /* ---------------------------------------------------------------- a pastilha, a frase-resumo e a previsão em texto */
  function projTxt(){
    if (proj === 'zero') return 'Nos últimos 28 dias o banco não cresceu: nesse ritmo ele não chega ao limite.';
    if (proj !== 'ok') return '';
    if (dias === 0) return 'O banco já passou do limite.';
    return 'No ritmo dos últimos 28 dias, chega ao limite em ' + mesAno(quando) + (dias < 365 ? ' (em ' + Math.round(dias) + ' dias)' : '') + '.';
  }
  function fr(){
    var p = temTam ? pc(PC) : '';
    if (c.erro) return '<b>Não foi possível ler o tamanho do banco do site.</b> O banco não respondeu, então nada indica que está tudo bem nem que está ruim.';
    if (c.vazio) return '<b>Ainda sem medida do tamanho do banco do site.</b> A primeira leitura é em 14/10, às 05:00. Antes disso não há dado.';
    if (!temTam) {
      return '<b>Sem leitura do banco do site hoje.</b> A medida das 05:00 não chegou; a última, de ' + A.dm(c.ult.dia) + ', foi ' + pc(PCU) + ' do limite.';
    }
    if (acima) return '<b>Banco do site acima do limite: ' + p + ' do limite.</b>';
    if (nivel === 'vermelho' && motivoV === 'previsao') return '<b>Banco do site enche em ' + Math.round(dias) + ' dias: ' + p + ' do limite</b>, no ritmo dos últimos 28 dias.';
    if (nivel === 'vermelho') return '<b>Banco do site quase cheio: ' + p + ' do limite.</b> Passou dos ' + VMP + '%. ' + projTxt();
    var ini = nivel === 'amarelo' ? '<b>Banco do site enchendo: ' : '<b>Banco do site com folga: ';
    var fim = '.</b> ';
    if (proj === 'nm-poucos') return ini + p + ' do limite' + fim + 'A previsão ainda não existe: há só ' + c.reg + ' dias de leitura e são precisos 14.';
    return ini + p + ' do limite' + fim + projTxt();
  }
  function pill(){
    var nome = c.erro ? 'Não foi possível ler' : c.vazio ? 'Sem medida' : !temTam ? 'Sem leitura hoje' : NOME[nivel];
    if (nivel === 'nm') return '<span class="bl-p vazia">' + A.nmSw() + '<span>' + nome + '</span></span>';
    return '<span class="bl-p ' + nivel + '">' + IC[nivel] + '<span>' + nome + '</span></span>';
  }

  /* ---------------------------------------------------------------- a barra de 0% a 100% do limite, com os cortes de 70% e 85% desenhados */
  function barra(){
    var nm = nivel === 'nm', w = 0, rotulo, lab = '', cls = 'c';
    if (nm && c.ult) { w = Math.min(PCU, 100); rotulo = A.dm(c.ult.dia) + ': ' + pc(PCU); cls = w > 75 ? 'f' : 'c'; lab = '<span class="bl-v vz ' + cls + '" style="left:' + w.toFixed(1) + '%">' + rotulo + '<span class="mut">leitura de ontem</span></span>'; }
    else if (!nm) {
      w = Math.min(PC, 100);
      cls = w < 12 ? 'i' : w > 70 ? 'f' : 'c';
      rotulo = pc(PC) + (acima ? '<span class="mut">' + pc(PC - 100) + ' acima</span>' : '');
      lab = '<span class="bl-v ' + cls + '" style="left:' + w.toFixed(1) + '%">' + IC[nivel] + rotulo + '</span>';
    }
    var aria = nm ? (c.erro ? 'Banco do site: não foi possível ler.' : c.vazio ? 'Banco do site: ainda sem medida.' : 'Banco do site hoje: sem leitura. Última leitura, de ' + A.dm(c.ult.dia) + ': ' + pc(PCU) + ' do limite.')
      : 'Banco do site: ' + pc(PC) + ' do limite. Corte amarelo em ' + AMP + '% e vermelho em ' + VMP + '%.';
    return '<div class="bl-sec" style="gap:0"><div class="bl-bar" role="img" aria-label="' + esc(aria) + '">' + lab +
      '<div class="bl-bt' + (nm && !c.ult ? ' vz' : '') + '"><i class="bl-z a"></i><i class="bl-z r"></i>' + (w ? '<i class="bl-f ' + (nm ? 'vz' : nivelTam) + '" style="width:' + w.toFixed(1) + '%"></i>' : '') +
      '<i class="bl-zm a">' + IC.amarelo + '</i><i class="bl-zm r">' + IC.vermelho + '</i>' +
      '<i class="bl-tk" style="left:70%"></i><i class="bl-tk" style="left:85%"></i></div>' +
      '<div class="bl-ts" aria-hidden="true"><span style="left:0">0%</span><span style="left:70%">' + AMP + '%</span><span style="left:85%">' + VMP + '%</span><span style="left:100%">100%</span></div></div>' +
      '<ul class="bl-leg"><li>' + IC.verde + 'até ' + AMP + '%: com folga</li><li>' + IC.amarelo + AMP + '% a ' + VMP + '%: enchendo</li><li>' + IC.vermelho + 'acima de ' + VMP + '%, ou cheio em menos de 90 dias: quase cheio</li></ul></div>';
  }

  /* ---------------------------------------------------------------- os dois números */
  function celula(rot, v, sub, extra){ return '<div class="bl-c' + (extra || '') + '"><dt>' + rot + '</dt><dd>' + v + (sub ? '<span class="s">' + sub + '</span>' : '') + '</dd></div>'; }
  function numeros(){
    /* sem tamanho de hoje: uma linha só, uma pastilha só (o motivo já está na frase) */
    if (!temTam) {
      var m = c.erro ? 'o banco não respondeu' : c.vazio ? 'ainda não há leitura' : 'falta a leitura de hoje';
      return '<p class="bl-nl" aria-label="Números do banco">' + A.nm() + '<span>Hoje, quanto falta para o limite e quanto cresceu em 28 dias: ' + m + '.</span></p>';
    }
    var cel = [];
    cel.push(acima ? celula('Passou', '<b class="num">' + pc(PC - 100) + '</b>', 'do limite', ' alerta') : celula('Ainda livre', '<b class="num">' + pc(100 - PC) + '</b>', 'do limite'));
    if (proj === 'ok') cel.push(celula('Cresceu em 28 dias', '<b class="num">+' + pc(cresc28pc, 1) + '</b>', 'do limite'));
    else if (proj === 'zero') cel.push(celula('Cresceu em 28 dias', '<span class="bl-zero" aria-label="zero medido">0%</span>', 'medido: o banco não mudou'));
    else cel.push(celula('Cresceu em 28 dias', A.nm(), 'só ' + c.reg + ' dias de leitura'));
    return '<dl class="bl-ns" aria-label="Números do banco">' + cel.join('') + '</dl>';
  }

  /* ---------------------------------------------------------------- a régua do tempo (previsão): 0 a 1 ano, com a zona de 90 dias */
  function regua(){
    if (proj === 'ok' || proj === 'zero') {
      var x = proj === 'zero' ? null : Math.min(dias / 365, 1) * 100, fora = dias != null && dias > 365, vm = nivel === 'vermelho' && motivoV === 'previsao';
      var cls = x == null ? '' : x > 70 ? 'f' : x < 14 ? 'i' : 'c';
      var aria = proj === 'zero' ? 'Previsão: o banco não cresceu nos últimos 28 dias, então não há data para chegar ao limite.' : dias === 0 ? 'Previsão: o banco já passou do limite.' : 'Previsão: chega ao limite em ' + mesAno(quando) + ', ' + (dias < 365 ? 'daqui a ' + Math.round(dias) + ' dias' : 'depois de 1 ano') + '. Menos de 90 dias é vermelho.';
      var marca = x == null ? '<span class="bl-mv i" style="left:0">sem data<span class="mut">não está crescendo</span></span>' : '<span class="bl-mv ' + cls + (vm ? ' vermelho' : '') + '" style="left:' + x.toFixed(1) + '%">' + (dias < 365 ? A.dmy(quando) : mesAno(quando) + '<span class="mut">depois de 1 ano</span>') + '</span><span class="bl-m' + (vm ? ' vermelho' : '') + '" style="left:' + x.toFixed(1) + '%"><i></i></span>';
      if (dias === 0) marca = '<span class="bl-mv i vermelho" style="left:0">já passou</span><span class="bl-m vermelho" style="left:0"><i></i></span>';
      return '<div class="bl-sec"><h3 class="bl-h">Quando chega ao limite</h3><div class="bl-rg" role="img" aria-label="' + esc(aria) + '">' + marca + '<div class="bl-rt"><i class="bl-rz' + (vm ? '' : ' q') + '"></i></div>' +
        '<div class="bl-mt" aria-hidden="true"><span style="left:0">hoje</span><span style="left:24.66%">90 dias</span><span style="left:100%">1 ano</span></div></div>' +
        '<ul class="bl-leg"><li>' + IC.vermelho + 'menos de 90 dias até o limite: vermelho, qualquer que seja o tamanho de hoje</li></ul></div>';
    }
    /* previsão não medida: a hachura (sem pastilha: o motivo está na frase e a hachura é o símbolo) e, quando existe, a data em que passa a existir */
    var m, rotulo = 'Previsão não medida';
    if (proj === 'nm-poucos') {
      var fal = 14 - c.reg, cel = '';
      for (var i = 0; i < 14; i++) cel += '<li class="' + (i < c.reg ? 'ok' : 'nao') + '"></li>';
      m = '<p><b>Poucos dias de leitura:</b> faltam ' + fal + ' dias. A previsão passa a existir em ' + A.dm(A.addDias(HOJE, fal)) + '.</p><ol class="bl-reg" role="img" aria-label="' + c.reg + ' de 14 dias de leitura">' + cel + '</ol>';
    } else if (proj === 'nm-sem') m = '<p>Volta quando a leitura das 05:00 chegar.</p>';
    else if (proj === 'nm-erro') m = '<p>Volta quando o banco puder ser lido.</p>';
    else m = '<p>Passa a existir em 27/10, quando houver 14 dias de leitura.</p>';
    return '<div class="bl-sec"><h3 class="bl-h">Quando chega ao limite</h3><div class="bl-nmx"><div class="bl-rt vz" role="img" aria-label="' + rotulo + '"></div>' + m + '</div></div>';
  }

  /* ---------------------------------------------------------------- quem ocupa o banco do site: o Observatório (concorrentes + seu canal) é UMA parte; o resto do site é a outra */
  /* maior resto: devolve inteiros que somam exatamente 100 */
  function pcts(v){ var tot = soma(v), r = v.map(function(x){ return x / tot * 100; }), b = r.map(Math.floor), falta = 100 - soma(b);
    r.map(function(x, i){ return [x - b[i], i]; }).sort(function(a, b2){ return b2[0] - a[0]; }).slice(0, falta).forEach(function(p){ b[p[1]]++; }); return b; }
  var P = c.sp ? pcts(c.sp) : null, PG = c.g && cresc28 > 0 ? pcts(c.g) : null;      /* parte do banco; parte do crescimento (só existe se o banco cresceu) */
  function quem(){
    var cab = '<h3 class="bl-h">Quem ocupa o banco do site</h3>';
    if (!c.sp) return '<div class="bl-sec">' + cab + '<div class="bl-sb vz" role="img" aria-label="Divisão do banco: não medida"></div><p class="bl-sbn">' + (c.erro ? 'Volta quando o banco puder ser lido.' : c.vazio ? 'Aparece com a primeira leitura.' : 'Volta com a próxima leitura.') + '</p></div>';
    var N = ['Concorrentes', 'Seu canal', 'Resto do site'], K = ['c', 'p', 'r'], OBS = P[0] + P[1], OBSG = PG ? PG[0] + PG[1] : null;
    var fim = PG ? ' e responde por ' + OBSG + '% do que o banco cresceu em 28 dias.' : proj === 'zero' ? ', e o banco não cresceu em 28 dias.' : ', e o crescimento ainda não foi medido.';
    var frase = '<p class="bl-fr" style="font-size:14px;line-height:21px"><span><b>O Observatório ocupa ' + OBS + '% do que o banco do site ocupa' + fim + '</b></span></p>';
    var aria = 'Parte do banco do site: Observatório ' + OBS + '% (concorrentes ' + P[0] + '%, seu canal ' + P[1] + '%); resto do site ' + P[2] + '%.';
    var barra = '<div class="bl-qb" role="img" aria-label="' + esc(aria) + '">' +
      '<div class="bl-qg" style="flex-grow:' + OBS + '"><span class="bl-ql">Observatório ' + OBS + '%</span><ul class="bl-sb"><li class="c" style="flex-grow:' + P[0] + '"></li><li class="p" style="flex-grow:' + P[1] + '"></li></ul></div>' +
      '<div class="bl-qg" style="flex-grow:' + P[2] + '"><span class="bl-ql">Resto do site ' + P[2] + '%</span><ul class="bl-sb"><li class="r" style="flex-grow:1"></li></ul></div></div>';
    var PGX = PG || (c.g == null ? 'nm' : null);   /* coluna do crescimento: existe com crescimento (%) ou sem medida (hachura "não medido"); some só em zero medido, onde a frase explica */
    function cresc(i, soG){ if (!PGX) return ''; if (!PG) return '<td class="num">' + A.nm() + '</td>'; var v = soG != null ? soG : PG[i]; return '<td class="num">' + (v === 0 ? '<span class="bl-zero" aria-label="zero medido">0%</span>' : v + '%') + '</td>'; }
    function lin(nome, pp, g, cls, sw){ return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + (sw ? '<i class="bl-sw ' + sw + '" aria-hidden="true"></i>' : '') + nome + '</th><td class="num">' + pp + '%</td>' + g + '</tr>'; }
    var linhas = lin('Observatório', OBS, cresc(0, OBSG), 'pai') + lin('Concorrentes', P[0], cresc(0), 'filho', 'c') + lin('Seu canal', P[1], cresc(1), 'filho', 'p') + lin('Resto do site', P[2], cresc(2), '', 'r');
    var tot = PG ? '<td class="num">100%</td>' : PGX ? '<td class="num">' + A.nm() + '</td>' : '';
    return '<div class="bl-sec">' + cab + frase + barra +
      '<table class="bl-tb"><caption class="sr">Parte de cada um no banco do site' + (PGX ? ' e no crescimento dos últimos 28 dias' : '') + '. O Observatório é a soma de concorrentes e seu canal.</caption><thead><tr><th scope="col">Parte</th><th scope="col">Do que está ocupado</th>' + (PGX ? '<th scope="col">Do crescimento</th>' : '') + '</tr></thead><tbody>' + linhas + '</tbody>' +
      '<tfoot><tr><th scope="row">Banco do site</th><td class="num">100%</td>' + tot + '</tr></tfoot></table></div>';
  }

  /* ---------------------------------------------------------------- exportações do Observatório que esperam a confirmação do dono */
  function lotes(){
    var cab = '<h3 class="bl-h">Exportações <span>' + A.ibtn('infoLote', 'Como confirmar uma exportação', true) + '</span></h3>';
    if (c.erro) return '<div class="bl-sec">' + cab + '<p class="bl-l0">' + A.nm() + '<span>As exportações também vêm do banco, que não respondeu: não dá para dizer se alguma espera confirmação.</span></p></div>';
    if (!nLotes) return '<div class="bl-sec">' + cab + '<p class="bl-l0"><span class="bl-zero" aria-label="zero medido">0</span><span>exportações esperando a sua confirmação.</span></p></div>';
    var li = c.lotes.map(function(l){
      var idade = A.dias(l.exp, HOJE), falta = l.conf ? 'Falta você confirmar no NAS.' : 'Falta conferir o arquivo.';
      var st = '<li class="ok">' + IC.feito + 'Exportado em ' + A.dm(l.exp) + '</li><li class="' + (l.conf ? 'ok' : 'fal') + '">' + (l.conf ? IC.feito + 'Conferido em ' + A.dm(l.conf) : IC.falta + 'Conferido: falta') + '</li><li class="fal">' + IC.falta + 'Confirmado no NAS: falta</li>';
      return '<li class="bl-lo"><div class="bl-lh"><b>' + l.canal + '</b><span class="m">' + l.per + ' · ' + A.n(l.linhas) + ' registros</span></div><ol class="bl-st" aria-label="Passos da exportação de ' + l.canal + '">' + st + '</ol>' +
        '<p class="bl-lf">' + L.IC.relogio + '<span>' + falta + ' Exportado há ' + L.pl(idade, 'dia', 'dias') + '. Nada foi apagado.</span></p></li>'; }).join('');
    return '<div class="bl-sec">' + cab + '<p class="bl-fr" style="font-size:14px;line-height:21px"><span><b>' + L.pl(nLotes, 'exportação espera', 'exportações esperam') + ' a sua confirmação.</b> Os dados continuam no banco até você confirmar.</span></p><ul class="bl-ls">' + li + '</ul></div>';
  }

  /* ---------------------------------------------------------------- o lugar reservado do backup no NAS (fase futura): só contorno pontilhado, sem botão e sem campo */
  var NAS = '<div class="bl-nas" role="note"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="4" rx="1"/><rect x="2" y="9" width="12" height="4" rx="1"/><path d="M5 5h.1M5 11h.1"/></svg><span>Backup no NAS ao chegar a um percentual do limite</span><span class="bl-ne">ainda não existe</span></div>';

  /* ---------------------------------------------------------------- o ⓘ: a conta (aqui, e só aqui, aparecem os MB) */
  function conta(){
    if (proj === 'ok' && dias > 0) return '<li><b>Conta de hoje:</b> (' + LIM + ' − ' + mb(c.tam, 1) + ') ÷ ' + mb(porDia, 2) + ' MB por dia = ' + A.n(Math.round(dias)) + ' dias, ou seja, ' + mesAno(quando) + '.</li>';
    if (proj === 'zero') return '<li><b>Conta de hoje:</b> a reta está plana (0,0 MB por dia), então não existe data. Se aparecer 0% em tudo por vários dias, confira se a leitura das 05:00 está rodando: uma leitura repetida também dá zero.</li>';
    if (proj === 'ok') return '<li><b>Conta de hoje:</b> o banco já passou do limite (dias até o limite = 0).</li>';
    return '<li><b>Conta de hoje:</b> não existe, porque ' + (proj === 'nm-poucos' ? 'há só ' + c.reg + ' dias de leitura' : proj === 'nm-sem' ? 'falta a leitura de hoje' : proj === 'nm-erro' ? 'o banco não respondeu' : 'ainda não há leitura') + '.</li>';
  }
  function hoje(){
    if (c.sp) return '<li><b>Hoje, em MB:</b> ' + mb(c.tam, 1) + ' MB de ' + LIM + ' MB = ' + pc(PC) + ' do limite. Concorrentes ' + mb(c.sp[0], 1) + ' MB + seu canal ' + mb(c.sp[1], 1) + ' MB + resto do site ' + mb(c.sp[2], 1) + ' MB.</li>' +
      (c.g ? '<li><b>Crescimento, em MB:</b> ' + (cresc28 === 0 ? '0,0 MB' : '+' + mb(cresc28, 1) + ' MB') + ' em 28 dias = ' + pc(cresc28pc, 1) + ' do limite (' + mb(porDia, 2) + ' MB por dia). Concorrentes ' + mb(c.g[0], 1) + ' MB, seu canal ' + mb(c.g[1], 1) + ' MB, resto do site ' + mb(c.g[2], 1) + ' MB.</li>' : '');
    if (c.ult) return '<li><b>Última leitura, em MB:</b> ' + mb(c.ult.tam, 1) + ' MB de ' + LIM + ' MB = ' + pc(PCU) + ' do limite (' + A.dm(c.ult.dia) + ').</li>';
    return '';
  }
  var AJUDA = A.oculto('infoBl', 'Como o tamanho do banco do site é medido', '<ul>' +
    '<li><b>O que é:</b> o tamanho de todo o banco do site, não só o do Observatório, medido uma vez por dia, às 05:00 (São Paulo). Vem do próprio banco, não do YouTube.</li>' +
    '<li><b>Limite:</b> ' + LIM + ' MB para o banco inteiro. A tela mostra só o percentual do limite; os MB ficam aqui.</li>' + hoje() +
    '<li><b>Enchendo (amarelo):</b> a partir de ' + AMP + '% (' + (LIM * AMP / 100) + ' MB).</li>' +
    '<li><b>Quase cheio (vermelho):</b> a partir de ' + VMP + '% (' + (LIM * VMP / 100) + ' MB), ou quando a previsão chega ao limite em menos de 90 dias.</li>' +
    '<li><b>Previsão:</b> a reta que passa pelas leituras dos últimos 28 dias. Dias até o limite = (' + LIM + ' MB − tamanho de hoje) ÷ crescimento por dia.</li>' + conta() +
    '<li><b>Menos de 14 dias de leitura:</b> a previsão fica “não medida”.</li>' +
    '<li><b>Sem a leitura de hoje:</b> o aviso diz “sem leitura hoje” e nunca fica verde.</li>' +
    '<li><b>Quem ocupa:</b> o Observatório (concorrentes + seu canal) é uma parte do banco; o resto do site é a outra. Cada coluna soma 100%. “Do que está ocupado” divide o tamanho de hoje; “Do crescimento” divide o que o banco cresceu em 28 dias (e não existe se ele não cresceu).</li>' +
    '<li><b>Backup no NAS:</b> ainda não existe. A ideia é, quando existir, enviar ao chegar a um percentual do limite, por botão ou agendado.</li></ul>');
  var AJUDA2 = A.oculto('infoLote', 'Como confirmar uma exportação', '<ul><li><b>Exportado:</b> o sistema salvou os arquivos do canal.</li><li><b>Conferido:</b> o arquivo tem o mesmo número de registros e o mesmo código de conferência da lista feita na exportação.</li><li><b>Confirmado no NAS:</b> só o dono, depois de copiar os arquivos e conferir lá. O site não confirma nem apaga sozinho.</li><li>Enquanto não confirmar, nada é apagado do banco e o canal não pode ser removido.</li></ul>');

  /* ---------------------------------------------------------------- a pastilha na faixa de frescor do cabeçalho */
  function mini(){
    if (nivel === 'nm') return '<span class="bl-mm vz" aria-hidden="true"><b style="left:70%"></b><b style="left:85%"></b></span>';
    return '<span class="bl-mm" aria-hidden="true"><i class="bl-f ' + nivelTam + '" style="width:' + Math.min(PC, 100) + '%"></i><b style="left:70%"></b><b style="left:85%"></b></span>';
  }
  function chip(){
    var txt = c.erro ? 'Banco do site: não foi possível ler' : c.vazio ? 'Banco do site: sem medida' : !temTam ? 'Banco do site: sem leitura hoje' : 'Banco do site: ' + pc(PC) + ' do limite';
    var extra = nivel === 'vermelho' && motivoV === 'previsao' ? '<span class="bl-x">enche em ' + Math.round(dias) + ' dias</span>' : nivel === 'amarelo' && proj === 'ok' ? '<span class="bl-x">limite em ' + mesAno(quando) + '</span>' : '';
    var lc = nLotes ? '<span class="bl-lc">' + L.IC.relogio + L.pl(nLotes, 'exportação a confirmar', 'exportações a confirmar') + '</span>' : '';
    return '<button type="button" id="bl-chip" class="c2-fs bl-fs ' + nivel + '" aria-expanded="' + painelAberto + '" aria-controls="bl-painel"><span class="bl-t">' + iconeNivel(nivel) + '<b>' + txt + '</b>' + mini() + '</span>' + extra + lc + L.IC.chev + '</button>';
  }
  function fresh(){
    var base = '<span class="c2-fs"><i class="c2-dot"></i><b>7 canais</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há 3 h</span><i class="c2-sp"></i><span class="c2-fs">todos em dia</span>';
    if (c.leitura) return '<span class="c2-fresh">' + base + '</span>';
    return '<span class="c2-fresh bl-fresh">' + base + '<i class="c2-sp"></i>' + L.novo(chip(), 'novo', 'bl-fn') + (c.leitura ? '' : '<span class="ex bl-exf">exemplo</span>') + '</span>';
  }

  /* ---------------------------------------------------------------- um trecho da Lista de Canais, para o aviso ter o contexto */
  function lista(){
    var rows = [['Nômade Raiz', '2,1 mi', '2,3', '2,18 mil', '3,4×'], ['Lucas Bigodinho', '325 mil', '1,2', '1,06 mil', '2,6×'], ['Dale Philip', '3,7 mi', '0,6', '175', '1,8×']];
    return '<div class="c2-tbw"><table class="tl" aria-label="Canais acompanhados (trecho)"><thead><tr><th scope="col">Canal</th><th scope="col">Ritmo</th><th scope="col" class="r">Views/dia</th><th scope="col">Outliers</th><th scope="col">Sincronização</th></tr></thead><tbody>' +
      rows.map(function(r){ return '<tr><td><div class="ch"><span class="av" aria-hidden="true">' + r[0].slice(0, 2) + '</span><div><a class="cn" href="#" onclick="return false">' + r[0] + '</a><div class="c2-sub"><span class="c2-nicho">Viagem</span><span class="num">' + r[1] + '</span></div></div></div></td><td><span class="num c2-big">' + r[2] + '</span> <span class="mut c2-u">longos/sem</span></td><td class="r"><span class="num c2-big">' + r[3] + '</span></td><td><b class="num">' + r[4] + '</b></td><td><div class="c2-st"><span class="c2-dot" aria-hidden="true"></span>Sincronizado há 3 h</div></td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---------------------------------------------------------------- o painel */
  var painel = '';
  if (!c.leitura) {
    painel = L.novo('<div class="bl" id="bl-painel" role="region" aria-label="Tamanho do banco"' + (painelAberto ? '' : ' hidden') + '><div class="bl-top"><div class="bl-pw">' + pill() + '<span class="ex">exemplo</span></div><p class="bl-fr"><span>' + fr() + '</span> ' + A.ibtn('infoBl', 'Como o tamanho do banco do site é medido', true) + '</p>' + (c.erro ? '<div class="bl-rw"><button type="button" class="btn big bl-retry" data-retry>Tentar de novo</button><span class="bl-rr" id="bl-rr" aria-live="polite"></span></div>' : '') + '</div>' +
      '<div class="bl-g"><div class="bl-col">' + barra() + numeros() + regua() + '</div><div class="bl-col">' + quem() + lotes() + '</div></div>' + NAS + '</div>' + AJUDA + AJUDA2, 'novo', 'bl-n');
  }
  if (painel && !painelAberto) painel = painel.replace('<div class="c2-novo bl-n">', '<div class="c2-novo bl-n" id="bl-wrap" hidden>');
  function pcDe(k){ var d = D[k]; return Math.round(Math.round(soma(d.sp) * 10) / 10 / LIM * 100); }
  var CASOS = [['verde', 'Com folga (' + pcDe('verde') + '%)'], ['amarelo', 'Amarelo (' + pcDe('amarelo') + '%)'], ['vermelho-tamanho', 'Vermelho por tamanho (' + pcDe('vermelho-tamanho') + '%)'], ['vermelho-projecao', 'Vermelho por previsão (' + pcDe('vermelho-projecao') + '%)'], ['acima', 'Acima do limite (' + pcDe('acima') + '%)'], ['sem-crescimento', 'Zero medido (não cresceu)'], ['projecao-nm', 'Previsão não medida (6 dias)'], ['sem-leitura', 'Sem leitura hoje'], ['exportacoes', 'Exportações a confirmar'], ['erro', 'Erro ao ler'], ['vazio', 'Ainda sem medida'], ['so-leitura', 'Só leitura (não vê)']];
  var barraMock = L.barra([{ rotulo: 'Estado', param: 'caso', itens: CASOS, padrao: 'verde' }, { rotulo: 'Painel', param: 'painel', itens: [['auto', 'Padrão do estado'], ['aberto', 'Aberto'], ['fechado', 'Fechado (só a pastilha)']], padrao: 'auto' }],
    'Contorno verde-água e “+ novo” = o acréscimo: a pastilha do banco do site na faixa de frescor do cabeçalho (ao lado de onde a tela D põe a leitura por hora) e o painel que ela abre. O resto é o cabeçalho e a Lista de Canais já aprovados (trecho). O aviso só aparece para quem edita o site. Hoje = 13/10 às 14:40; todo número é exemplo. O limite é do banco inteiro do site, então a tela fala em percentual do limite; os MB só estão no botão de informação.');
  var fora = '<div class="tbw" style="max-width:900px"><table class="tb"><caption>Quando cada estado aparece</caption><thead><tr><th scope="col">Situação</th><th scope="col">Pastilha</th><th scope="col">Nunca vira</th></tr></thead><tbody>' +
    '<tr><th scope="row">menos de 70% do limite e previsão em 90 dias ou mais</th><td>“Com folga” (círculo com visto)</td><td>alarme à toa</td></tr>' +
    '<tr><th scope="row">de 70% a 84% do limite</th><td>“Enchendo” (triângulo), com “limite em mês/ano”</td><td>verde</td></tr>' +
    '<tr><th scope="row">85% a 100% do limite, ou previsão em menos de 90 dias</th><td>“Quase cheio” ou “Enche em N dias” (octógono, família do erro)</td><td>amarelo</td></tr>' +
    '<tr><th scope="row">mais de 100% do limite</th><td>“Acima do limite”, com o percentual real (104%) e quanto passou (4%)</td><td>100% ou “cheio”</td></tr>' +
    '<tr><th scope="row">menos de 14 dias de leitura</th><td>tamanho segue as cores; previsão “não medida”, com a data em que passa a existir</td><td>previsão de 0 dia ou “sem risco”</td></tr>' +
    '<tr><th scope="row">sem a linha de hoje</th><td>“Sem leitura hoje” (hachura rosa), com a última leitura em %</td><td>verde</td></tr>' +
    '<tr><th scope="row">o banco não respondeu</th><td>“Não foi possível ler” (hachura rosa), com “Tentar de novo”</td><td>verde ou vermelho</td></tr>' +
    '<tr><th scope="row">estado calmo (com folga, zero medido, previsão não medida, exportações a confirmar)</th><td>painel fechado; a escolha do dono é lembrada neste navegador (nesta mostra, zero medido, previsão não medida e exportações a confirmar abrem o painel para você julgar)</td><td>aberto à toa</td></tr>' +
    '<tr><th scope="row">enchendo, quase cheio, acima do limite, sem leitura, erro, sem medida</th><td>painel aberto (pede ação ou desconfiança)</td><td>fechado sem o dono pedir</td></tr>' +
    '<tr><th scope="row">MB (o tamanho em números absolutos)</th><td>só dentro do botão de informação do painel</td><td>pastilha, barra, frase, números, “quem ocupa”</td></tr>' +
    '<tr><th scope="row">linha “Backup no NAS … ainda não existe”</th><td>só com o painel aberto; contorno pontilhado, sem botão (fase futura)</td><td>botão, campo ou cor de estado</td></tr>' +
    '<tr><th scope="row">usuário só de leitura</th><td>nenhuma: a pastilha, o painel e as exportações não são desenhados</td><td>pastilha desativada ou cinza</td></tr></tbody></table></div>';
  A.moldura({ titulo: 'Aviso do banco chegando ao limite', barra: barraMock, corpo: L.obs({ aba: 'Canais', fresh: fresh() }) + painel + '<div style="margin-top:16px">' + lista() + '</div>', fora: fora });
  A.ligarInfos();
  /* só para a conferência de coerência (capturas e tabela de NOTAS.md): os números derivados, lidos pelo script de verificação */
  window.BL = { caso: caso, tam: c.tam, PC: PC, PCU: PCU, nivel: nivel, motivoV: motivoV, acima: acima, cresc28: cresc28, cresc28pc: cresc28pc, porDia: porDia, dias: dias, quando: quando, P: P, PG: PG, proj: proj };

  /* a pastilha abre e fecha o painel */
  var bt = document.getElementById('bl-chip'), pn = document.getElementById('bl-painel'), wr = document.getElementById('bl-wrap');
  if (bt && pn) bt.addEventListener('click', function(){ var abre = pn.hidden; pn.hidden = !abre; if (wr) wr.hidden = !abre; bt.setAttribute('aria-expanded', String(abre)); if (lembra) L.lembrar.gravar(LEMB, abre ? 'aberto' : 'fechado'); });
  /* "Tentar de novo" (só no erro): mostra o estado de espera e volta ao erro, como na tela real */
  var rt = document.querySelector('[data-retry]');
  if (rt) rt.addEventListener('click', function(){ var rr = document.getElementById('bl-rr'); rt.textContent = 'Lendo o banco…'; rt.setAttribute('aria-busy', 'true'); rr.textContent = ''; setTimeout(function(){ rt.textContent = 'Tentar de novo'; rt.removeAttribute('aria-busy'); rr.textContent = 'Tentou às 14:41: o banco ainda não respondeu.'; }, 1200); });
})();
