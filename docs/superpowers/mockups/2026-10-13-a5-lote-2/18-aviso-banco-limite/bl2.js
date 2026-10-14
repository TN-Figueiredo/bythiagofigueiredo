/* bl2.js: mockup 18-v2 (fase de manutenção, etapa M4, peça 5). Copia de bl.js (o 18 aprovado não foi editado) com as divergências de 04 L336-358 e a revisão do Logan (C7, C8, C9, 11.7).
   ?caso=v0|v1|v1a|v1b|v1n|v2|v3|v4|v5|v6|v7|v8|v8curta|v8a|v8b|v8c|v9|v10|v11|v12a|v12b|v12c|v12n  e os 12 do 18 (verde, amarelo, ...). Os estados V novos têm a data própria de 'hoje' (c.hoje), todo número é exemplo.
   Original: bl.js, mockup 18, aviso "banco chegando ao limite" no cabeçalho do Observatório (A5, lote 2; spec 06 seção 9.2, item 80; medidas 6.5b linha 18).
   Rodada do retorno do dono (13/10): o limite de 500 MB é do banco INTEIRO do site; a tela fala em PERCENTUAL do limite, os MB só aparecem dentro do botão de informação.
   ?caso=verde|amarelo|vermelho-tamanho|vermelho-projecao|acima|sem-crescimento|projecao-nm|sem-leitura|exportacoes|erro|vazio|so-leitura  (lote-pendente = apelido antigo de exportacoes)
   ?painel=aberto|fechado  ?tema=claro. Hoje = 13/10/2026 às 14:40 (São Paulo). Todo número é exemplo (a produção tem outro tamanho).
   Regras (em percentual do limite, sobre o inteiro MOSTRADO): amarelo a partir de 70%; vermelho a partir de 85% ou quando a previsão chega ao limite em menos de 90 dias; acima de 100% = acima do limite;
   previsão = reta dos últimos 28 dias; menos de 14 dias de leitura = previsão "não medida"; sem a linha do dia = "sem leitura hoje", nunca verde.
   FONTE ÚNICA: cada estado guarda só os MB de cada parte (sp) e o quanto cada parte cresceu em 28 dias (g); todo o resto sai por código daqui (tamanho, %, livre, partes que somam 100, dias, data). */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, q = A.q, esc = A.esc;
  var caso = q.get('caso') || 'v1';
  var LIM = 500, AMP = 70, VMP = 85, HOJE;                 /* limite em MB (só no botão de informação); cortes em % do limite */
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

  /* ---------------------------------------------------------------- 18-v2: os estados V (a fonte única também: MB por parte; o resto sai por código) */
  var H1 = '2027-02-20';
  var CP = { k: 'ok', ult: '2027-02-01', mes: 'janeiro' };
  D['v0'] = { hoje: '2026-10-13', sp: SPV, g: GV, copia: { k: 'nunca' } };
  D['v1'] = { hoje: H1, sp: SPV, g: GV, copia: CP };
  D['v1a'] = { hoje: H1, sp: SPV, g: GV, copia: { k: 'atrasada', mes: 'janeiro', dias: 12 } };
  D['v1b'] = { hoje: H1, sp: SPV, g: GV, copia: { k: 'atrasada', mes: 'janeiro', dias: 34 } };
  D['v1n'] = { hoje: H1, sp: SPV, g: GV, copia: { k: 'nm' } };
  D['v2'] = { hoje: H1, sp: [75, 130, 125], g: [10, 9, 5], copia: CP, pronto: { em: '2027-05-01', mes: 'novembro' } };
  D['v3'] = { hoje: H1, sp: [95, 150, 125], g: [4, 3, 2], copia: CP, mesDest: { nome: 'Outubro', pcBanco: 9 }, prontos: { n: 2, pc: 17 } };
  D['v4'] = { hoje: H1, sp: [110, 130, 120], g: [14, 9, 5], copia: CP, pronto: { em: '2027-05-16', mes: 'novembro' } };
  D['v5'] = { hoje: H1, sp: [190, 140, 110], g: [3, 2, 1], copia: CP, pronto: { em: '2027-03-01', mes: 'dezembro' }, mesDest: { nome: 'Outubro', pcBanco: 9 }, prontos: { n: 1, pc: 8 }, libera: true };
  D['v6'] = { hoje: '2027-06-10', sp: [95, 125, 100], g: [22, 19, 12.2], copia: { k: 'ok', ult: '2027-06-01', mes: 'maio' }, pronto: { em: '2027-07-01', mes: 'dezembro' }, saiu: { mes: 'Novembro', em: '2027-06-01', de: 71, para: 64 } };
  D['v7'] = { hoje: '2027-07-12', sp: [100, 95, 75], g: [2.6, 2.0, 1.4], copia: { k: 'ok', ult: '2027-07-01', mes: 'junho' }, arq: { em: '2027-07-08', reg: 412300, videos: 1250 } };
  var SPA = [112.4, 131.0, 116.6], GA = [2.4, 1.9, 1.3];
  D['v8'] = { hoje: H1, sp: SPA, g: GA, copia: CP, casa: { desde: '17/02 22:10', h: 64 } };
  D['v8curta'] = { hoje: H1, sp: SPA, g: GA, copia: CP, casa: { desde: '19/02 18:40', h: 20 } };
  D['v8a'] = { hoje: H1, sp: SPA, g: GA, copia: CP, casa: { desde: '17/02 22:10', h: 64 }, semPausa: true };
  D['v8b'] = { hoje: H1, sp: SPA, g: GA, copia: CP, nas: { k: 'fora', desde: '18/02 03:30', h: 59 } };
  D['v8c'] = { hoje: H1, sp: SPA, g: GA, copia: CP, nas: { k: 'cheio', mes: 'janeiro' } };
  D['v9'] = { hoje: H1, sp: null, ult: { dia: '2027-02-19', tam: 214.8 }, g: null, copia: CP };
  D['v10'] = { hoje: H1, sp: null, erro: true, serie: true, g: null, copia: { k: 'nm' } };
  D['v11'] = { hoje: H1, sp: SPV, g: GV, copia: CP, auto: { em: '18/02' } };
  D['v12a'] = { hoje: H1, sp: SPV, g: GV, copia: CP, rem: { n: 2, idade: 12 } };
  D['v12b'] = { hoje: H1, sp: SPV, g: GV, copia: CP, rem: { n: 2, idade: 34 } };
  D['v12c'] = { hoje: H1, sp: SPV, g: GV, copia: CP, rem: { n: 1, idade: 64 } };
  D['v12n'] = { hoje: H1, sp: SPV, g: GV, copia: CP, rem: null, semComando: true };
  if (caso === 'lote-pendente') caso = 'exportacoes';
  var c = D[caso] || D.v1; c.k = D[caso] ? caso : 'v1';
  HOJE = c.hoje || '2026-10-13'; L.HOJE = HOJE;
  if (!c.copia) c.copia = { k: 'nunca' };   /* os 12 do 18: antes de 28/11 nenhuma cópia existe */
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

  /* 18-v2 (04 L342): a cor da pastilha e da frase segue o MAIS ALTO que o banco chega antes da próxima saída. O preenchimento da barra segue o tamanho de hoje (nivelTam). */
  var PICO = null, diasP = null;
  if (c.pronto && temTam && porDia != null) {
    diasP = Math.max(0, A.dias(HOJE, c.pronto.em));
    PICO = Math.round((c.tam + Math.max(porDia, 0) * diasP) / LIM * 100);
    if (PICO >= VMP && nivel !== 'vermelho') { nivel = 'vermelho'; motivoV = 'pico'; }
    else if (PICO >= AMP && nivel === 'verde') nivel = 'amarelo';
  }
  var picoMostra = PICO != null && temTam && PICO > Math.round(c.tam / LIM * 100);
  var acima = temTam && PC > 100;
  /* nível do TAMANHO (a barra e a minibarra pintam o preenchimento por ele; o vermelho por previsão fica na pastilha, no "enche em N dias" e no losango da régua) */
  var nivelTam = !temTam ? 'nm' : PC >= VMP ? 'vermelho' : PC >= AMP ? 'amarelo' : 'verde';
  /* painel: padrão por estado. Aberto onde pede ação ou desconfiança; fechado onde está tudo bem. ?painel=aberto|fechado força. Em estado calmo a escolha do dono é lembrada. */
  var calmo = nivel === 'verde' && !c.erro && !c.vazio;
  var LEMB = 'banco-painel-calmo';
  /* só na mostra: os estados calmos que o dono precisa JULGAR (zero medido, previsão não medida, exportações a confirmar) abrem o painel por padrão; em produção seguem fechados. Só "Com folga" usa a escolha lembrada. */
  var abreNaMostra = caso === 'sem-crescimento' || caso === 'projecao-nm' || caso === 'exportacoes' || /^v\d/.test(caso);   /* 18-v2: todos os estados novos abrem o painel (plano 3.5) */
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
  var NOME = { verde: 'Com folga', amarelo: 'Enchendo', vermelho: acima ? 'Acima do limite' : motivoV === 'previsao' ? 'Enche em ' + Math.round(dias) + ' dias' : motivoV === 'pico' ? 'Quase cheio antes da saída' : 'Quase cheio' };

  /* ---------------------------------------------------------------- a pastilha, a frase-resumo e a previsão em texto */
  function projTxt(){
    if (proj === 'zero') return 'Nos últimos 28 dias o banco não cresceu: nesse ritmo ele não chega ao limite.';
    if (proj !== 'ok') return '';
    if (dias === 0) return 'O banco já passou do limite.';
    return 'No ritmo dos últimos 28 dias, chega ao limite em ' + mesAno(quando) + (dias < 365 ? ' (em ' + Math.round(dias) + ' dias)' : '') + '.';
  }

  function picoTxt(){ return picoMostra ? 'Antes de ' + c.pronto.mes + ' sair o banco chega a ' + PICO + '% do limite. ' : ''; }
  function d85Txt(){
    if (!temTam) return '';
    if (PC >= VMP) return 'O banco já passou dos ' + VMP + '%.';
    if (!(porDia > 0.0001)) return 'No ritmo de hoje o banco não chega a ' + VMP + '%.';
    return 'No ritmo de hoje o banco chega a ' + VMP + '% em ' + mesAno(A.addDias(HOJE, Math.round((LIM * VMP / 100 - c.tam) / porDia))) + '.';
  }
  function frCasa(){
    var x = c.casa, n = c.nas, ic, t;
    if (x) { ic = x.h >= 36 ? IC.vermelho : IC.amarelo; t = 'A casa não responde desde ' + x.desde + ': nenhum mês pode sair até ela voltar.'; }
    else if (n.k === 'fora') { ic = n.h >= 36 ? IC.vermelho : IC.amarelo; t = 'O NAS não está acessível desde ' + n.desde + ': nenhum mês pode sair até ele voltar.'; }
    else { ic = IC.vermelho; t = 'O NAS está cheio: a cópia de ' + n.mes + ' não coube, e nenhum mês pode sair até haver espaço.'; }
    return '<span class="v2-ico">' + ic + '</span><b>' + t + '</b> ' + d85Txt();
  }
  function fr(){
    var p = temTam ? pc(PC) : '';
    if (c.casa || c.nas) return frCasa();
    if (c.serie) return '<b>Não foi possível ler o tamanho das séries por mês.</b> Sem elas o banco não tem tamanho completo, e um número parcial seria menor do que o real. Nada indica que está tudo bem nem que está ruim.';
    if (c.erro) return '<b>Não foi possível ler o tamanho do banco do site.</b> O banco não respondeu, então nada indica que está tudo bem nem que está ruim.';
    if (c.vazio) return '<b>Ainda sem medida do tamanho do banco do site.</b> A primeira leitura é em 14/10, às 05:00. Antes disso não há dado.';
    if (!temTam) {
      return '<b>Sem leitura do banco do site hoje.</b> A medida das 05:00 não chegou; a última, de ' + A.dm(c.ult.dia) + ', foi ' + pc(PCU) + ' do limite.';
    }
    if (acima) return '<b>Banco do site acima do limite: ' + p + ' do limite.</b>';
    if (nivel === 'vermelho' && motivoV === 'previsao') return '<b>Banco do site enche em ' + Math.round(dias) + ' dias: ' + p + ' do limite</b>, no ritmo dos últimos 28 dias.';
    if (nivel === 'vermelho' && motivoV === 'pico') return '<b>Banco do site: ' + p + ' do limite hoje.</b> ' + picoTxt() + 'Passa dos ' + VMP + '% antes do mês sair. ' + projTxt();
    if (nivel === 'vermelho') return '<b>Banco do site quase cheio: ' + p + ' do limite.</b> Passou dos ' + VMP + '%. ' + picoTxt() + projTxt();
    var ini = nivel === 'amarelo' ? '<b>Banco do site enchendo: ' : '<b>Banco do site com folga: ';
    var fim = '.</b> ';
    if (proj === 'nm-poucos') return ini + p + ' do limite' + fim + 'A previsão ainda não existe: há só ' + c.reg + ' dias de leitura e são precisos 14.';
    return ini + p + ' do limite' + fim + picoTxt() + projTxt();
  }
  function pill(){
    var nome = c.serie ? 'Não medido' : c.erro ? 'Não foi possível ler' : c.vazio ? 'Sem medida' : !temTam ? 'Sem leitura hoje' : NOME[nivel];
    if (nivel === 'nm') return '<span class="bl-p vazia">' + A.nmSw() + '<span>' + nome + '</span></span>';
    return '<span class="bl-p ' + nivel + '">' + IC[nivel] + '<span>' + nome + '</span></span>';
  }

  /* ---------------------------------------------------------------- a barra de 0% a 100% do limite, com os cortes de 70% e 85% desenhados */

  function ghost(){ return picoMostra && nivel !== 'nm' ? '<i class="v2-gh ' + nivel + '" style="left:' + Math.min(PC, 100).toFixed(1) + '%;width:' + Math.max(0, Math.min(PICO, 100) - Math.min(PC, 100)).toFixed(1) + '%"></i>' : ''; }
  function pkLabel(){
    if (!picoMostra) return '';
    var x = Math.min(PICO, 100);
    return '<div class="v2-pk"><i class="v2-tk ' + nivel + '" style="left:' + x + '%"></i><span class="v2-pt ' + nivel + (x > 50 ? ' f' : '') + '" style="left:' + x + '%">' + IC[nivel] + 'chega a ' + PICO + '% antes da próxima saída</span></div>';
  }
  function barra(){
    var nm = nivel === 'nm', w = 0, rotulo, lab = '', cls = 'c';
    if (nm && c.ult) { w = Math.min(PCU, 100); rotulo = A.dm(c.ult.dia) + ': ' + pc(PCU); cls = w > 75 ? 'f' : 'c'; lab = '<span class="bl-v vz ' + cls + '" style="left:' + w.toFixed(1) + '%">' + rotulo + '<span class="mut">leitura de ontem</span></span>'; }
    else if (!nm) {
      w = Math.min(PC, 100);
      cls = w < 12 ? 'i' : w > 70 ? 'f' : 'c';
      rotulo = pc(PC) + (acima ? '<span class="mut">' + pc(PC - 100) + ' acima</span>' : '');
      lab = '<span class="bl-v ' + cls + '" style="left:' + w.toFixed(1) + '%">' + IC[nivel] + rotulo + '</span>';
    }
    var aria = nm ? (c.serie ? 'Banco do site: não medido, falta o tamanho das séries por mês.' : c.erro ? 'Banco do site: não foi possível ler.' : c.vazio ? 'Banco do site: ainda sem medida.' : 'Banco do site hoje: sem leitura. Última leitura, de ' + A.dm(c.ult.dia) + ': ' + pc(PCU) + ' do limite.')
      : 'Banco do site: ' + pc(PC) + ' do limite' + (picoMostra ? ', e chega a ' + PICO + '% antes da próxima saída' : '') + '. Corte amarelo em ' + AMP + '% e vermelho em ' + VMP + '%.';
    return '<div class="bl-sec" style="gap:0"><div class="bl-bar" role="img" aria-label="' + esc(aria) + '">' + lab +
      '<div class="bl-bt' + (nm && !c.ult ? ' vz' : '') + '"><i class="bl-z a"></i><i class="bl-z r"></i>' + (w ? '<i class="bl-f ' + (nm ? 'vz' : nivelTam) + '" style="width:' + w.toFixed(1) + '%"></i>' : '') +
      ghost() + '<i class="bl-zm a">' + IC.amarelo + '</i><i class="bl-zm r">' + IC.vermelho + '</i>' +
      '<i class="bl-tk" style="left:70%"></i><i class="bl-tk" style="left:85%"></i></div>' +
      '<div class="bl-ts" aria-hidden="true"><span style="left:0">0%</span><span style="left:70%">' + AMP + '%</span><span style="left:85%">' + VMP + '%</span><span style="left:100%">100%</span></div>' + pkLabel() + '</div>' +
      '<ul class="bl-leg"><li>' + IC.verde + 'até ' + AMP + '%: com folga</li><li>' + IC.amarelo + AMP + '% a ' + VMP + '%: enchendo</li><li>' + IC.vermelho + 'acima de ' + VMP + '%, ou cheio em menos de 90 dias: quase cheio</li></ul></div>';
  }

  /* ---------------------------------------------------------------- os dois números */
  function celula(rot, v, sub, extra){ return '<div class="bl-c' + (extra || '') + '"><dt>' + rot + '</dt><dd>' + v + (sub ? '<span class="s">' + sub + '</span>' : '') + '</dd></div>'; }
  function numeros(){
    /* sem tamanho de hoje: uma linha só, uma pastilha só (o motivo já está na frase) */
    if (!temTam) {
      var m = c.serie ? 'falta o tamanho das séries por mês' : c.erro ? 'o banco não respondeu' : c.vazio ? 'ainda não há leitura' : 'falta a leitura de hoje';
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

  /* 18-v2 (04 L349): dois marcos na régua do tempo: losango "o banco chega a 85%" e traço "o próximo mês fica pronto para sair". Losango antes do traço = o alívio chega depois do aperto (faixa de âmbar a vermelho, entre dois hex literais). */
  function regua2(){
    var d85 = PC >= VMP ? 0 : Math.max(0, (LIM * VMP / 100 - c.tam) / porDia), dP = diasP;
    var x85 = Math.min(d85 / 365, 1) * 100, xP = Math.min(dP / 365, 1) * 100;
    var aperto = d85 < dP, gap = Math.round(dP - d85);
    function al(x){ return x < 14 ? '' : x > 70 ? ' f' : ' c'; }
    var t85 = PC >= VMP ? 'já passou dos ' + VMP + '%' : VMP + '% em ' + A.dm(A.addDias(HOJE, Math.round(d85)));
    var tP = c.pronto.mes + ' pronto em ' + A.dm(c.pronto.em);
    var aria = 'Previsão: o banco chega a ' + VMP + '% ' + (PC >= VMP ? 'já passou' : 'em ' + A.dm(A.addDias(HOJE, Math.round(d85)))) + '; o próximo mês fica pronto para sair em ' + A.dm(c.pronto.em) + (aperto ? '. O alívio chega depois do aperto: ' + gap + ' dias.' : '. O alívio chega antes do aperto.');
    var m85 = PC >= VMP ? '<span class="v2-mm vermelho" style="left:0"><i></i></span>' : '<span class="v2-mm vermelho" style="left:' + x85.toFixed(1) + '%"><i></i></span>';
    return '<div class="bl-sec"><h3 class="bl-h">Quando o banco aperta e quando o espaço volta</h3><div class="v2-rg" role="img" aria-label="' + esc(aria) + '">' +
      '<span class="v2-l1' + al(x85) + '" style="left:' + x85.toFixed(1) + '%">' + t85 + '</span>' +
      '<div class="bl-rt v2-tr">' + (aperto ? '<i class="v2-ap" style="left:' + x85.toFixed(1) + '%;width:' + Math.max(xP - x85, 0.8).toFixed(1) + '%"></i>' : '') + '</div>' + m85 +
      '<i class="v2-trc" style="left:' + xP.toFixed(1) + '%"></i>' +
      '<div class="bl-mt v2-ax" aria-hidden="true"><span style="left:0">hoje</span><span style="left:24.66%">90 dias</span><span style="left:100%">1 ano</span></div>' +
      '<span class="v2-l2' + al(xP) + '" style="left:' + xP.toFixed(1) + '%">' + tP + '</span></div>' +
      (aperto ? '<p class="v2-aper">' + IC.vermelho + '<span><b>O alívio chega depois do aperto:</b> ' + L.pl(gap, 'dia', 'dias') + ' entre o banco chegar a ' + VMP + '% e o mês poder sair.</span></p>' : '<p class="v2-aper calmo"><span>O próximo mês fica pronto antes de o banco chegar a ' + VMP + '%.</span></p>') +
      '<ul class="bl-leg"><li><i class="v2-lg-d"></i>o banco chega a ' + VMP + '%</li><li><i class="v2-lg-t"></i>o próximo mês fica pronto para sair</li></ul></div>';
  }
  function regua(){
    if (c.pronto && proj === 'ok') return regua2();
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

  /* 18-v2 (11.7): o mês que saiu das telas e ainda não teve o espaço liberado é PARTE de Concorrentes (não soma de novo no total) */
  function subMes(){
    if (!c.mesDest || !P) return '';
    return '<tr class="sub"><th scope="row"><svg class="i v2-pont" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" stroke-dasharray="2.4 2.2"/></svg>' + c.mesDest.nome + ', fora das telas, espaço ainda não liberado<span class="sr"> (parte de concorrentes)</span></th><td class="num">' + c.mesDest.pcBanco + '%</td>' + (c.g == null || (c.g && cresc28 > 0) ? '<td></td>' : '') + '</tr>';
  }
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
    var linhas = lin('Observatório', OBS, cresc(0, OBSG), 'pai') + lin('Concorrentes', P[0], cresc(0), 'filho', 'c') + subMes() + lin('Seu canal', P[1], cresc(1), 'filho', 'p') + lin('Resto do site', P[2], cresc(2), '', 'r');
    var tot = PG ? '<td class="num">100%</td>' : PGX ? '<td class="num">' + A.nm() + '</td>' : '';
    return '<div class="bl-sec">' + cab + frase + barra +
      '<table class="bl-tb"><caption class="sr">Parte de cada um no banco do site' + (PGX ? ' e no crescimento dos últimos 28 dias' : '') + '. O Observatório é a soma de concorrentes e seu canal.</caption><thead><tr><th scope="col">Parte</th><th scope="col">Do que está ocupado</th>' + (PGX ? '<th scope="col">Do crescimento</th>' : '') + '</tr></thead><tbody>' + linhas + '</tbody>' +
      '<tfoot><tr><th scope="row">Banco do site</th><td class="num">100%</td>' + tot + '</tr></tfoot></table></div>';
  }

  /* ---------------------------------------------------------------- exportações do Observatório que esperam a confirmação do dono */
  function lotes(){
    var cab = '<h3 class="bl-h">Exportações <span>' + A.ibtn('infoLote', 'Como confirmar uma exportação', true) + '</span></h3>';
    if (c.erro || (!temTam && !c.lotes)) return '<div class="bl-sec">' + cab + '<p class="bl-l0">' + A.nm() + '<span>As exportações também vêm do banco, ' + (c.serie ? 'que não foi lido por inteiro' : c.erro ? 'que não respondeu' : 'e a leitura de hoje não chegou') + ': não dá para dizer se alguma espera confirmação.</span></p></div>';
    if (!nLotes) return '<div class="bl-sec">' + cab + '<p class="bl-l0"><span class="bl-zero" aria-label="zero medido">0</span><span>exportações esperando a sua confirmação.</span></p></div>';
    var li = c.lotes.map(function(l){
      var idade = A.dias(l.exp, HOJE), falta = l.conf ? 'Falta você confirmar no NAS.' : 'Falta conferir o arquivo.';
      var st = '<li class="ok">' + IC.feito + 'Exportado em ' + A.dm(l.exp) + '</li><li class="' + (l.conf ? 'ok' : 'fal') + '">' + (l.conf ? IC.feito + 'Conferido em ' + A.dm(l.conf) : IC.falta + 'Conferido: falta') + '</li><li class="fal">' + IC.falta + 'Confirmado no NAS: falta</li>';
      return '<li class="bl-lo"><div class="bl-lh"><b>' + l.canal + '</b><span class="m">' + l.per + ' · ' + A.n(l.linhas) + ' registros</span></div><ol class="bl-st" aria-label="Passos da exportação de ' + l.canal + '">' + st + '</ol>' +
        '<p class="bl-lf">' + L.IC.relogio + '<span>' + falta + ' Exportado há ' + L.pl(idade, 'dia', 'dias') + '. Nada foi apagado.</span></p></li>'; }).join('');
    return '<div class="bl-sec">' + cab + '<p class="bl-fr" style="font-size:14px;line-height:21px"><span><b>' + L.pl(nLotes, 'exportação espera', 'exportações esperam') + ' a sua confirmação.</b> Os dados continuam no banco até você confirmar.</span></p><ul class="bl-ls">' + li + '</ul></div>';
  }


  /* ---------------------------------------------------------------- 18-v2: a linha da cópia (no lugar do "Backup no NAS ... ainda não existe"), com os estados que faltavam (Logan C7) */
  var ARQ = '<svg class="i v2-arq" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="3.5" rx="1"/><path d="M3 6.5V13h10V6.5M6.5 9.5h3"/></svg>';
  function libLinhas(){
    var li = [];
    if (c.mesDest) li.push('<li>' + c.mesDest.nome + ' saiu das telas: liberar o espaço devolve cerca de ' + c.mesDest.pcBanco + '% do banco.</li>');
    if (c.prontos) li.push('<li>' + L.pl(c.prontos.n, 'mês pronto para sair', 'meses prontos para sair') + ': ' + (c.prontos.n === 1 ? 'libera' : 'liberam') + ' cerca de ' + c.prontos.pc + '% do banco. <a class="v2-porta" href="#" onclick="return false">Ver o que pode sair</a></li>');
    return li;
  }
  function copia(){
    var k = c.erro ? 'nm' : c.copia.k, ic, cls, t, mais = '';
    var base = 'Todo mês fechado é copiado para o NAS e para o B2.';
    if (k === 'ok') { ic = IC.feito; cls = 'ok'; t = base + ' Última cópia: ' + A.dm(c.copia.ult) + '.' + (c.casa ? ' A próxima espera a casa.' : c.nas ? ' A próxima espera o NAS.' : ''); }
    else if (k === 'nunca') { ic = IC.falta; cls = 'nunca'; t = base + ' A primeira cópia é a de outubro, a partir de 28/11.'; }
    else if (k === 'atrasada') { var v = c.copia.dias > 30; ic = v ? IC.vermelho : IC.amarelo; cls = v ? 'verm' : 'amar'; t = 'A cópia de ' + c.copia.mes + ' está atrasada há ' + c.copia.dias + ' dias.'; mais = ' <a class="v2-porta" href="#" onclick="return false">Abrir o Arquivo</a>'; }
    else { ic = A.nmSw(); cls = 'nm'; t = 'Não foi possível ler a última cópia.'; }
    var lib = (k !== 'nm' && PC != null && PC >= AMP && PC < VMP) ? libLinhas() : [];
    return '<div class="v2-cp ' + cls + '" role="note"><span class="v2-ci">' + ic + '</span><div><p>' + t + mais + '</p>' + (lib.length ? '<ul class="v2-lb">' + lib.join('') + '</ul>' : '') + '</div></div>';
  }
  var NAS = copia();
  /* V5: com 85% ou mais, a lista do que rende, em ordem (nenhuma linha fala em plano pago) */
  function libera(){
    if (!(c.libera && PC != null && PC >= VMP)) return '';
    var it = libLinhas().map(function(x){ return x.replace(/^<li>/, '<li><span class="v2-lt">').replace(/: /, ':</span> '); });
    it.push('<li><span class="v2-lt">Encurtar de 90 para 60 dias as views por dia que ficam no banco:</span> libera cerca de 6% do banco. A tela de histórico passa a mostrar 60 dias, não 90.</li>');
    it.push('<li><span class="v2-lt">Mandar para o arquivo os vídeos com mais de 1 ano dos canais acompanhados:</span> libera cerca de 11% do banco. Esses vídeos deixam de abrir o histórico na hora.</li>');
    it.push('<li><span class="v2-lt">Tirar canais:</span> cada canal libera cerca de 3% do banco. Para voltar abaixo de ' + VMP + '% teriam de sair 2 canais.</li>');
    return '<div class="bl-sec v2-libs"><h3 class="bl-h">O que libera espaço</h3><ol class="v2-lib">' + it.join('') + '</ol></div>';
  }
  /* V8: "o que fazer" quebrado em itens (Logan C8) */
  function fazer(){
    if (!(c.casa || c.nas)) return '';
    var p1 = c.casa ? 'Peça a quem está em casa para religar a forja e o NAS (se não houver ninguém, a data acima é a sua folga: nada mais a fazer agora).' : c.nas.k === 'fora' ? 'Confira se o NAS está ligado e se a pasta do arquivo está montada na forja (ver os comandos).' : 'Libere espaço no NAS (ver os comandos). A cópia é refeita sozinha em até 12 horas.';
    var p3 = c.semPausa ? 'A pausa da coleta de canais ainda não existe.' : 'Se chegar a ' + VMP + '% antes disso, pause a coleta de canais (ver o comando).';
    return '<div class="v2-faz"><p><b>O que fazer:</b></p><ol><li>' + p1 + '</li><li>Até lá, não acrescente canais.</li><li>' + p3 + '</li></ol></div>';
  }
  function notas(){
    var o = '';
    if (c.saiu) o += '<p class="v2-nt"><span class="v2-ico">' + ARQ + '</span><span><b>' + c.saiu.mes + ' saiu em ' + A.dm(c.saiu.em) + ': o banco foi de ' + c.saiu.de + '% para ' + c.saiu.para + '%.</b>' + (nivel !== 'verde' ? ' O banco ainda chega a ' + PICO + '% antes de ' + c.pronto.mes + ' sair, por isso a pastilha não fica verde.' : '') + '</span></p>';
    if (c.arq) o += '<p class="v2-nt"><span class="v2-ico">' + ARQ + '</span><span><b>Em ' + A.dm(c.arq.em) + ', ' + A.n(c.arq.reg) + ' registros de ' + A.n(c.arq.videos) + ' vídeos antigos foram para o arquivo.</b> O percentual não cai com isto: o banco passa a crescer mais devagar.</span></p>';
    return o;
  }
  /* ao lado da pastilha, nunca dentro dela (04 L310, L354) */
  function extras(){
    var o = '';
    if (c.auto) o += L.novo('<a class="v2-ch amarelo" href="#" onclick="return false">' + IC.amarelo + '<span>Automático desligou em ' + c.auto.em + '</span></a>', 'novo', 'bl-fn');
    if (c.rem) { var r = c.rem, k = r.idade >= 60 ? 'vermelho' : r.idade >= 30 ? 'amarelo' : 'cinza';
      o += L.novo('<a class="v2-ch ' + k + '" href="#" onclick="return false">' + (k === 'vermelho' ? IC.vermelho : k === 'amarelo' ? IC.amarelo : ARQ) + '<span>' + (r.n === 1 ? '1 canal removido pede um comando seu' : r.n + ' canais removidos pedem um comando seu') + '</span></a>', 'novo', 'bl-fn'); }
    return o;
  }


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
    '<li><b>Previsão:</b> a reta que passa pelas leituras dos últimos 28 dias. Dias até o limite = (' + LIM + ' MB − tamanho de hoje) ÷ crescimento por dia. Até a próxima saída, o banco cresce nesse ritmo; o mês que sai devolve a parte dele.</li>' +
    '<li><b>Cor da pastilha:</b> segue o mais alto que o banco chega antes da próxima saída, não o tamanho de hoje. A barra continua na cor do tamanho de hoje.</li>' + conta() +
    '<li><b>Menos de 14 dias de leitura:</b> a previsão fica “não medida”.</li>' +
    '<li><b>Sem a leitura de hoje:</b> o aviso diz “sem leitura hoje” e nunca fica verde.</li>' +
    '<li><b>Quem ocupa:</b> o Observatório (concorrentes + seu canal) é uma parte do banco; o resto do site é a outra. Cada coluna soma 100%. “Do que está ocupado” divide o tamanho de hoje; “Do crescimento” divide o que o banco cresceu em 28 dias (e não existe se ele não cresceu).</li>' +
    '<li><b>Cópia:</b> todo mês fechado é copiado para o NAS e para o B2, sempre, sem esperar percentual. O percentual só avisa e mostra o que pode sair.</li>' +
    '<li><b>A casa e o NAS:</b> sem resposta há até 36 horas, a marca é o triângulo âmbar; a partir de 36 horas, o octógono vermelho.</li></ul>');
  var AJUDA2 = A.oculto('infoLote', 'Como confirmar uma exportação', '<ul><li><b>Exportado:</b> o sistema salvou os arquivos do canal.</li><li><b>Conferido:</b> o arquivo tem o mesmo número de registros e o mesmo código de conferência da lista feita na exportação.</li><li><b>Confirmado no NAS:</b> só o dono, depois de copiar os arquivos e conferir lá. O site não confirma nem apaga sozinho.</li><li>Enquanto não confirmar, nada é apagado do banco e o canal não pode ser removido.</li></ul>');

  /* ---------------------------------------------------------------- a pastilha na faixa de frescor do cabeçalho */
  function mini(){
    if (nivel === 'nm') return '<span class="bl-mm vz" aria-hidden="true"><b style="left:70%"></b><b style="left:85%"></b></span>';
    return '<span class="bl-mm" aria-hidden="true"><i class="bl-f ' + nivelTam + '" style="width:' + Math.min(PC, 100) + '%"></i><b style="left:70%"></b><b style="left:85%"></b></span>';
  }
  function chip(){
    var txt = c.serie ? 'Banco do site: não medido' : c.erro ? 'Banco do site: não foi possível ler' : c.vazio ? 'Banco do site: sem medida' : !temTam ? 'Banco do site: sem leitura hoje' : 'Banco do site: ' + pc(PC) + ' do limite';
    var extra = nivel === 'vermelho' && motivoV === 'previsao' ? '<span class="bl-x">enche em ' + Math.round(dias) + ' dias</span>' : nivel === 'amarelo' && proj === 'ok' ? '<span class="bl-x">limite em ' + mesAno(quando) + '</span>' : '';
    var lc = nLotes ? '<span class="bl-lc">' + L.IC.relogio + L.pl(nLotes, 'exportação a confirmar', 'exportações a confirmar') + '</span>' : '';
    return '<button type="button" id="bl-chip" class="c2-fs bl-fs ' + nivel + '" aria-expanded="' + painelAberto + '" aria-controls="bl-painel"><span class="bl-t">' + iconeNivel(nivel) + '<b>' + txt + '</b>' + mini() + '</span>' + extra + lc + L.IC.chev + '</button>';
  }
  function fresh(){
    var base = '<span class="c2-fs"><i class="c2-dot"></i><b>7 canais</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há 3 h</span><i class="c2-sp"></i><span class="c2-fs">todos em dia</span>';
    if (c.leitura) return '<span class="c2-fresh">' + base + '</span>';
    return '<span class="c2-fresh bl-fresh">' + base + '<i class="c2-sp"></i>' + L.novo(chip(), 'novo', 'bl-fn') + extras() + (c.leitura ? '' : '<span class="ex bl-exf">exemplo</span>') + '</span>';
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
      fazer() + notas() + '<div class="bl-g"><div class="bl-col">' + barra() + numeros() + regua() + '</div><div class="bl-col">' + quem() + lotes() + '</div></div>' + libera() + NAS + '</div>' + AJUDA + AJUDA2, 'novo', 'bl-n');
  }
  if (painel && !painelAberto) painel = painel.replace('<div class="c2-novo bl-n">', '<div class="c2-novo bl-n" id="bl-wrap" hidden>');
  function pcDe(k){ var d = D[k]; return Math.round(Math.round(soma(d.sp) * 10) / 10 / LIM * 100); }
  var C18 = [['verde', 'Com folga (' + pcDe('verde') + '%)'], ['amarelo', 'Amarelo (' + pcDe('amarelo') + '%)'], ['vermelho-tamanho', 'Vermelho por tamanho (' + pcDe('vermelho-tamanho') + '%)'], ['vermelho-projecao', 'Vermelho por previsão (' + pcDe('vermelho-projecao') + '%)'], ['acima', 'Acima do limite (' + pcDe('acima') + '%)'], ['sem-crescimento', 'Zero medido (não cresceu)'], ['projecao-nm', 'Previsão não medida (6 dias)'], ['sem-leitura', 'Sem leitura hoje'], ['exportacoes', 'Exportações a confirmar'], ['erro', 'Erro ao ler'], ['vazio', 'Ainda sem medida'], ['so-leitura', 'Só leitura (não vê)']];
  var CV1 = [['v0', 'V0 Antes da 1ª cópia'], ['v1', 'V1 Com folga'], ['v1a', 'V1a Cópia atrasada (12 dias)'], ['v1b', 'V1a Cópia atrasada (34 dias)'], ['v1n', 'V1n Cópia não medida'], ['v2', 'V2 Chega a 78% antes da saída'], ['v3', 'V3 70%+ com meses prontos'], ['v4', 'V4 Alívio depois do aperto'], ['v5', 'V5 85%+ O que libera espaço'], ['v6', 'V6 Depois de uma saída'], ['v7', 'V7 Vídeos antigos no arquivo']];
  var CV2 = [['v8', 'V8 Casa não responde (64 h)'], ['v8curta', 'V8 Casa (20 h)'], ['v8a', 'V8a Sem a pausa da coleta'], ['v8b', 'V8b NAS fora'], ['v8c', 'V8c NAS cheio'], ['v9', 'V9 Sem leitura hoje'], ['v10', 'V10 Séries não medidas'], ['v11', 'V11 Chip do automático'], ['v12a', 'V12 Removidos (12 dias)'], ['v12b', 'V12 Removidos (34 dias)'], ['v12c', 'V12 Removido (64 dias)'], ['v12n', 'V12n Sem o comando']];
  var barraMock = L.barra([{ rotulo: 'Fase de manutenção', param: 'caso', itens: CV1.concat(CV2), padrao: 'v1' }, { rotulo: 'Do 18 aprovado (13/10, inalterados)', param: 'caso', itens: C18, padrao: 'v1' }, { rotulo: 'Painel', param: 'painel', itens: [['auto', 'Padrão do estado'], ['aberto', 'Aberto'], ['fechado', 'Fechado (só a pastilha)']], padrao: 'auto' }],
    'Contorno verde-água e “+ novo” = o acréscimo. 18-v2: ajuste de mockup aprovado: 18, 13/10/2026. Divergências que voltam ao dono: (1) a cor da pastilha segue o mais alto que o banco chega antes da próxima saída; (2) o percentual só avisa, a cópia é mensal e sempre. Cada estado V tem a sua data de “hoje”; todo número é exemplo. Os MB só estão no botão de informação. O 18 aprovado continua abrindo igual em 18-aviso-banco-limite/index.html.');
  var fora = '<div class="tbw" style="max-width:900px"><table class="tb"><caption>O que mudou em relação ao 18 aprovado</caption><thead><tr><th scope="col">Peça</th><th scope="col">No 18 aprovado</th><th scope="col">No 18-v2</th></tr></thead><tbody>' +
    '<tr><th scope="row">cor da pastilha e da frase</th><td>tamanho de hoje, ou previsão em menos de 90 dias</td><td>o mais alto que o banco chega antes da próxima saída (V2: 66% hoje, amarelo)</td></tr>' +
    '<tr><th scope="row">barra</th><td>um marcador</td><td>segundo marcador vazado “chega a N% antes da próxima saída”, com texto visível</td></tr>' +
    '<tr><th scope="row">régua do tempo</th><td>uma data, a do limite</td><td>losango “chega a 85%” e traço “o próximo mês fica pronto”; faixa de âmbar a vermelho entre os dois quando o alívio chega depois</td></tr>' +
    '<tr><th scope="row">linha do backup</th><td>“Backup no NAS … ainda não existe”</td><td>linha da cópia, com seis estados: antes da primeira, em dia, atrasada (âmbar, vermelha), não medida</td></tr>' +
    '<tr><th scope="row">quem ocupa</th><td>três partes</td><td>sub-linha do mês fora das telas, dentro de Concorrentes</td></tr>' +
    '<tr><th scope="row">ao lado da pastilha</th><td>nada</td><td>chip do automático e marca dos canais removidos (sem o comando, a marca não é desenhada)</td></tr></tbody></table></div>';
  A.moldura({ titulo: 'Aviso do banco chegando ao limite (v2)', barra: barraMock, corpo: L.obs({ aba: 'Canais', fresh: fresh() }) + painel + '<div style="margin-top:16px">' + lista() + '</div>', fora: fora });
  A.ligarInfos();
  /* só para a conferência de coerência (capturas e tabela de NOTAS.md): os números derivados, lidos pelo script de verificação */
  window.BL = { PICO: PICO, diasP: diasP, copia: c.copia && c.copia.k, caso: caso, tam: c.tam, PC: PC, PCU: PCU, nivel: nivel, motivoV: motivoV, acima: acima, cresc28: cresc28, cresc28pc: cresc28pc, porDia: porDia, dias: dias, quando: quando, P: P, PG: PG, proj: proj };

  /* a pastilha abre e fecha o painel */
  var bt = document.getElementById('bl-chip'), pn = document.getElementById('bl-painel'), wr = document.getElementById('bl-wrap');
  if (bt && pn) bt.addEventListener('click', function(){ var abre = pn.hidden; pn.hidden = !abre; if (wr) wr.hidden = !abre; bt.setAttribute('aria-expanded', String(abre)); if (lembra) L.lembrar.gravar(LEMB, abre ? 'aberto' : 'fechado'); });
  /* "Tentar de novo" (só no erro): mostra o estado de espera e volta ao erro, como na tela real */
  var rt = document.querySelector('[data-retry]');
  if (rt) rt.addEventListener('click', function(){ var rr = document.getElementById('bl-rr'); rt.textContent = 'Lendo o banco…'; rt.setAttribute('aria-busy', 'true'); rr.textContent = ''; setTimeout(function(){ rt.textContent = 'Tentar de novo'; rt.removeAttribute('aria-busy'); rr.textContent = 'Tentou às 14:41: o banco ainda não respondeu.'; }, 1200); });
  /* V2-2: o rótulo centrado da régua nunca sai da régua (nem da tela): prende a esquerda e a direita */
  function prende(){
    document.querySelectorAll('.v2-rg').forEach(function(rg){
      var W = rg.getBoundingClientRect().width;
      rg.querySelectorAll('.v2-l1.c,.v2-l2.c').forEach(function(l){
        l.style.transform = 'translateX(-50%)'; l.style.left = l.getAttribute('data-x') || l.style.left; l.setAttribute('data-x', l.style.left);
        var w = l.getBoundingClientRect().width, x = parseFloat(l.style.left) / 100 * W, min = w / 2, max = W - w / 2;
        if (w < W && (x < min || x > max)) l.style.left = Math.max(min, Math.min(max, x)).toFixed(1) + 'px';
      });
    });
  }
  prende(); addEventListener('resize', prende);
})();
