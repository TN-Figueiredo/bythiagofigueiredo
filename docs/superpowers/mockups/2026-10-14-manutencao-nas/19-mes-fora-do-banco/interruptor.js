/* interruptor.js: peça 4, o interruptor do automático (PLANO seção 10b; spec 04 §14.4). Usado por interruptor.html (todos os quadros) e por arquivo.js (a peça encaixada no topo de cada cartão de tipo). Datas de exemplo: hoje = 03/05/2028. */
(function(){
  'use strict';
  var ic = M.ic, esc = M.esc, ib = M.ib, infoBox = M.infoBox;
  var N = 0;
  var TIPO = {
    dia: { nome: 'Views por dia', frase: 'ligar automático de views por dia', ate: 'outubro de 2027', desde: '04/05/2028' },
    texto: { nome: 'Comentários e dados antigos do YouTube', frase: '', ate: '', desde: '' },
    hora: { nome: 'Leitura de hora em hora', frase: 'ligar automático de leitura de hora em hora', ate: 'fevereiro de 2028', desde: '04/05/2028' }
  };
  var ATE = '19/07/2028';

  /* motivos do desligamento: lista fechada (04 §14.4, 1 a 11 e 13; o 12 está retirado). [id, título do quadro, frase do spec, o que fazer] */
  var MOTIVOS = [
    ['1', 'O arquivo de um mês ficou diferente', 'O arquivo de outubro de 2027 ficou diferente do que o site guardou. Nada sai até você resolver.', 'Abra a linha de outubro de 2027 na lista abaixo e leia o aviso dela.'],
    ['2', 'A casa ficou mais de 36 horas sem responder', 'A casa ficou mais de 36 horas sem responder. Veja o que fazer no aviso do banco.', 'Veja o aviso da casa no topo desta página e espere ela voltar.'],
    ['3', 'A cópia ficou sem verificação duas vezes seguidas (no NAS)', 'A cópia de outubro de 2027 ficou sem verificação em duas rodadas seguidas. Veja se a casa está respondendo.', 'Veja se a forja e o NAS estão ligados e respondendo.'],
    ['3b', 'A cópia ficou sem verificação duas vezes seguidas (no B2)', 'A forja ficou sem conferir o B2 de outubro de 2027 por mais de 7 dias, duas vezes seguidas.', 'Veja se a forja está ligada e conferindo o B2.'],
    ['4', 'A cópia atrasou mais de 30 dias', 'A cópia atrasou mais de 30 dias.', 'Veja o aviso da casa no topo desta página e o aviso da linha do mês atrasado.'],
    ['5', 'O banco passou de 85%', 'O banco passou de 85%: agora quem decide é você; veja o que pode sair.', 'Veja na lista abaixo o que pode sair e tire pelo botão de cada mês.'],
    ['6', 'O banco não pôde ser medido hoje', 'Não foi possível medir o banco hoje.', 'Veja o aviso do banco no topo; a medida é refeita na próxima leitura.'],
    ['7', 'Mais de um mês sairia no mesmo dia', 'O automático tentou tirar mais de um mês no mesmo dia e parou.', 'Veja na lista abaixo quais meses saíram hoje antes de ligar de novo.'],
    ['8', 'A validade de 90 dias acabou', 'A validade de 90 dias acabou.', 'Nada deu errado: o automático só vale por 90 dias. Ligue de novo quando quiser.'],
    ['9', 'Foi desligado na configuração do site', 'O automático foi desligado na configuração do site.', 'Quem cuida do site precisa ligá-lo de volta na configuração; sem isso não dá para ligar aqui.'],
    ['10', 'A conferência do B2 falhou', 'A conferência do B2 de outubro de 2027 falhou em 02/05/2028: faltam arquivos.', 'Na linha de outubro de 2027, use “Ver o comando” e rode a conferência do B2 de novo.'],
    ['11', 'O banco recusou tirar um mês', 'O banco recusou tirar outubro de 2027: o mês ainda está recebendo dados de outra parte do site.', 'Leia o motivo acima e resolva-o; se não entender, avise quem cuida do site.'],
    ['13', 'A forja e o seu Mac discordaram sobre o B2', 'A forja e o seu Mac deram respostas diferentes sobre a cópia de outubro de 2027 no B2. Nada sai sozinho até você olhar.', 'Na linha de outubro de 2027, use “Ver o comando” e rode a conferência no seu Mac; compare com a da forja.']
  ];
  var DESLIGA = ['o arquivo de algum mês fica diferente do que o site guardou', 'a casa fica mais de 36 horas sem responder', 'a cópia fica sem verificação duas vezes seguidas', 'a cópia atrasa mais de 30 dias', 'o banco passa de 85% ou não pode ser medido', 'mais de um mês sairia no mesmo dia', 'a validade de 90 dias acaba', 'o automático é desligado na configuração do site', 'a conferência do B2 de um mês falha', 'a forja e o seu Mac dão respostas diferentes sobre o B2', 'o banco recusa tirar um mês'];

  function bar(rot, feitas, total){
    var pct = Math.round(100 * feitas / total), ok = feitas >= total;
    return '<div class="b"><div class="t"><span>' + rot + '</span><span class="m-num">' + (ok ? ic('ok') : '') + feitas + ' de ' + total + '</span></div><div class="m-bar" role="progressbar" aria-label="' + esc(rot) + '" aria-valuenow="' + feitas + '" aria-valuemin="0" aria-valuemax="' + total + '"><i style="width:' + pct + '%"></i></div></div>';
  }
  function barras(s, v){ return '<div class="m-auto-bars">' + bar('Saídas feitas por você', s, 3) + bar('Simulações vistas', v, 2) + '</div>'; }
  function info(t, rot, html){ var id = 'i-auto-' + t + '-' + (++N); return ib(id, rot) + infoBox(id, html); }
  function painel(t, cls, icone, titulo, corpo){
    return '<div class="m-auto ' + cls + '" data-auto-tipo="' + t + '" role="group" aria-label="Automático de ' + esc(TIPO[t].nome.toLowerCase()) + '">' + icone + '<div class="m-ac-b"><span class="h">' + titulo + '</span>' + corpo + '</div></div>';
  }
  function botaoLigar(t, adm, rot){
    if (!adm) return '<p class="k">Quem administra o site liga o automático.</p>';
    return '<div class="m-auto-ac"><button type="button" class="btn heavy" data-auto="ligar" data-tipo="' + t + '">' + (rot || 'Ligar o automático…') + '</button><small>Antes de ligar, você lê a regra e digita uma frase.</small></div>';
  }
  var COMO_DESLIGAR = 'Para desligar de novo por vontade própria, ou quando alguém precisar parar tudo, o interruptor fica na configuração do site (variável <code>OBS_ARQUIVO_AUTO_DROP</code>). Os motivos que desligam sozinho estão na regra, ao ligar.';

  /* ------------------------------------------------------------ os estados. peca(tipo, id, opt) devolve o painel. opt: adm (padrão true), visto */
  function peca(t, id, o){
    o = o || {}; var adm = o.adm !== false, T = TIPO[t].nome;
    if (t === 'texto') return painel('texto', 'pt', ic('pont'), 'Automático: não existe aqui', '<p>Comentários saem sempre por clique: o texto some do site, e isso nunca acontece sem você ver.</p>');
    var m;
    if ((m = /^ind(?:-(\d)-(\d))?$/.exec(id))) {
      var s = m[1] == null ? 1 : +m[1], v = m[2] == null ? 0 : +m[2], fs = 3 - s, fv = 2 - v, p = [];
      if (fs > 0) p.push(fs + (fs === 1 ? ' saída feita por você' : ' saídas feitas por você') + ' (' + s + ' de 3)');
      if (fv > 0) p.push(fv + (fv === 1 ? ' simulação vista' : ' simulações vistas') + ' (' + v + ' de 2)');
      return painel(t, 'pt', ic('pont'), 'Automático: ainda não dá para ligar', '<p>Falta: ' + p.join(' e ') + '.</p>' + barras(s, v) + '<p class="k">Uma saída feita por você é um mês que você tirou do banco pelo botão. Uma simulação é o “Ver o que sairia”, que não tira nada. ' + info(t, 'Por que o automático espera', 'O automático só liga depois que você mesmo tirou meses e viu o que sairia, para conhecer o caminho antes de deixar de olhar. Enquanto isso, cada mês sai pelo botão.') + '</p>');
    }
    if (id === 'desl') return painel(t, '', ic('pont'), 'Automático: desligado', '<p>Desligado. Você tira cada mês pelo botão.</p>' + barras(3, 2) + botaoLigar(t, adm));
    if (id === 'lig') return painel(t, '', ic('ok'), 'Automático: ligado até ' + ATE, '<p>Próximo mês: ' + TIPO[t].ate + ', a partir de ' + TIPO[t].desde + '. Sai no máximo um mês por dia, e só com as duas cópias conferidas.' + ' ' + info(t, 'Como desligar', COMO_DESLIGAR) + '</p>');
    if (id === 'parcial') return painel(t, '', ic('ok'), 'Automático: ligado até ' + ATE, '<p>As primeiras horas ainda saem pelo botão, em dois passos (1 de 3 saídas feitas). O automático pula essa parte e continua ligado.' + ' ' + info(t, 'Como desligar', COMO_DESLIGAR) + '</p>');
    if (id === 'perto') return painel(t, '', ic('tri'), 'Automático: ligado, vence em 6 dias', '<p>Ligado até 09/05/2028. Quando vencer, ele desliga sozinho e você liga de novo.' + ' ' + info(t, 'Como desligar', COMO_DESLIGAR) + '</p>');
    if (id === 'trav') return painel(t, 'pt', ic('pont'), 'Automático: desligado na configuração', '<p>O automático está desligado na configuração do site. ' + info(t, 'Onde fica essa configuração', 'A configuração é a variável <code>OBS_ARQUIVO_AUTO_DROP</code> do site. Enquanto ela estiver desligada, o botão de ligar não aparece, e cada mês sai pelo botão.') + '</p>');
    if (id === 'nm') return painel(t, 'nm', ic('nm'), 'Automático: não medido', '<p>Não foi possível ler o estado do automático. Enquanto isso, nada sai sozinho.</p>');
    if ((m = /^desl-(.+)$/.exec(id))) {
      var mo = MOTIVOS.filter(function(x){ return x[0] === m[1]; })[0]; if (!mo) return '';
      var visto = !!o.visto;
      return painel(t, visto ? 'pt' : 'am', visto ? ic('pont') : ic('tri'), 'Automático: desligou sozinho em 02/05/2028',
        '<p>' + mo[2] + '</p><p class="do"><b>O que fazer:</b> ' + mo[3] + '</p><p class="k">Para ligar de novo: resolva o motivo, veja uma simulação nova e digite a frase. Ele não liga sozinho. ' + info(t, 'Por que não liga sozinho', 'Se parou por um motivo, a cópia ou o banco pode estar com problema. Ligar de novo é uma escolha sua, depois de ver uma simulação feita depois do desligamento. A validade recomeça em 90 dias.') + '</p>' +
        '<div class="m-auto-bars">' + bar('Simulação nova depois de desligar', 0, 1) + '</div>' +
        (adm ? '<div class="m-auto-ac"><button type="button" class="btn" aria-disabled="true">Ligar de novo</button><small>Falta: uma simulação nova.</small></div>' : '<p class="k">Quem administra o site liga o automático.</p>'));
    }
    return '';
  }

  /* ------------------------------------------------------------ a regra, antes de ligar (diálogo) */
  function dlgLigar(t, estatico){
    var T = TIPO[t];
    return '<div class="m-dlg' + (estatico ? ' st' : '') + '" role="dialog" aria-modal="true" aria-labelledby="aT"><div class="m-dlg-b"><h2 id="aT">Ligar o automático de ' + T.nome.toLowerCase() + '?</h2>' +
      '<p class="t">Depois de ligar, o site tira um mês do banco sozinho, <b>sem você ver na hora</b>. A regra:</p>' +
      '<ul class="m-lista"><li>Sai <b>no máximo um mês por dia</b>.</li><li>Só sai um mês com as duas cópias conferidas e a recuperação testada.</li><li>Vale por <b>90 dias</b>; depois você liga de novo.</li><li><b>Continua precisando do seu teste de recuperação</b>, a cada 5 meses (duas a três vezes por ano; uma a mais se o formato dos dados mudar).</li></ul>' +
      '<p class="t">Ele <b>desliga sozinho</b> e avisa na faixa do topo de todas as telas do Observatório quando:</p>' +
      '<ul class="m-lista">' + DESLIGA.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ul>' +
      '<p>Quando desliga, ele não liga de novo sozinho.</p>' +
      '<p class="t">Para ligar, digite: <b class="m-num" style="padding:2px 6px;background:var(--sunk);border:1px solid var(--border);border-radius:4px;user-select:all">' + T.frase + '</b></p>' +
      '<label for="aIn">Frase de confirmação</label><input id="aIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-auto-in="' + t + '" aria-describedby="aSt"><p class="m-st" id="aSt" role="status">Digite a frase para continuar.</p></div>' +
      '<div class="m-dlg-a"><button type="button" class="btn" data-fecha data-foco>Cancelar</button><button type="button" class="btn heavy" id="aOk" data-auto-ok aria-disabled="true">Ligar o automático</button></div></div>';
  }
  var foco = null;
  function norm(s){ return s.toLowerCase().replace(/\s+/g, ' ').trim(); }
  function abreLigar(btn){
    var t = btn.getAttribute('data-tipo'); foco = btn;
    var m = document.createElement('div'); m.className = 'm-modal'; m.innerHTML = dlgLigar(t, false); document.body.appendChild(m);
    function fecha(){ m.remove(); document.removeEventListener('keydown', key); if (foco && document.contains(foco)) foco.focus(); }
    function key(e){
      if (e.key === 'Escape') { fecha(); return; }
      if (e.key === 'Tab') { var f = m.querySelectorAll('button,input'); var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); } }
    }
    document.addEventListener('keydown', key);
    m.addEventListener('click', function(e){
      if (e.target === m || e.target.closest('[data-fecha]')) { fecha(); return; }
      var ok = e.target.closest('[data-auto-ok]');
      if (ok && ok.getAttribute('aria-disabled') !== 'true') {
        var alvo = document.querySelector('.m-auto[data-auto-tipo="' + t + '"]'); fecha();
        if (alvo) { alvo.outerHTML = peca(t, 'lig', { adm: true }); var h = document.querySelector('.m-auto[data-auto-tipo="' + t + '"]'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }
      }
    });
    m.querySelector('[data-auto-in]').addEventListener('input', function(ev){
      var ok = norm(ev.target.value) === TIPO[t].frase; m.querySelector('#aOk').setAttribute('aria-disabled', String(!ok)); m.querySelector('#aSt').textContent = ok ? 'Frase confirmada.' : 'Digite a frase para continuar.';
    });
    m.querySelector('[data-foco]').focus();
  }
  document.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('[data-auto="ligar"]'); if (b) abreLigar(b); });

  /* ------------------------------------------------------------ a faixa de frescor (o chip ao lado da pastilha do banco, não dentro dela) */
  function ajustaFaixa(modo, raiz){
    var f = (raiz || document).querySelector('.m-obs .m-fresh'); if (!f) return;
    [].slice.call(f.querySelectorAll('.m-chip')).forEach(function(c){ if (/Autom[aá]tico ligado/.test(c.textContent)) c.remove(); });
    if (modo === 'lig') f.insertAdjacentHTML('beforeend', '<span class="m-chip">' + ic('ok') + 'Automático ligado</span>');
    if (modo === 'desl') f.insertAdjacentHTML('beforeend', '<a class="m-chip" href="arquivo.html?caso=cheio&auto=desl-1&visto=1" aria-label="Automático desligou em 02/05. Abrir o Arquivo">' + ic('tri') + 'automático desligou em 02/05</a>');
  }

  /* ------------------------------------------------------------ cartão de tipo (como na página do Arquivo) */
  function emCartao(t, painelHtml, resumo){
    return '<section class="m-card" aria-label="' + esc(TIPO[t] ? TIPO[t].nome : t) + '"><div class="m-card-h"><div class="m-card-top"><h3 class="m-h3">' + esc(TIPO[t].nome) + '</h3></div>' + painelHtml + (resumo ? '<p class="m-resumo">' + resumo + '</p>' : '') + '</div></section>';
  }

  window.INT = { peca: peca, emCartao: emCartao, ajustaFaixa: ajustaFaixa, dlgLigar: dlgLigar, MOTIVOS: MOTIVOS, TIPO: TIPO };

  /* ============================================================ interruptor.html: um quadro por estado */
  if (!document.getElementById('int-page')) return;
  var Q = M.Q, E = Q('e', 'todos-antes'), ADM = Q('perfil', 'adm') === 'adm';
  var NOTA_PARCIAL = 'Aparece no cartão em que as primeiras saídas ainda são em dois passos.';
  function Qd(id, titulo, fonte, t, estado, o, extra){ return [id, titulo, fonte, emCartao(t, peca(t, estado, o)) + (extra || '')]; }
  var F = {
    antes: [
      Qd('a-ind0', 'Ainda não dá para ligar: nada feito', 'spec 04 L303', 'dia', 'ind-0-0', { adm: ADM }),
      Qd('a-ind', 'Ainda não dá para ligar: 1 de 3 saídas, 0 de 2 simulações', 'spec 04 L303', 'dia', 'ind', { adm: ADM }),
      Qd('a-ind2', 'Ainda não dá para ligar: só falta uma simulação', 'spec 04 L303', 'hora', 'ind-3-1', { adm: ADM }),
      Qd('a-desl', 'Pode ligar, e está desligado', 'spec 04 L304', 'dia', 'desl', { adm: ADM }),
      ['a-ligar', 'A regra inteira e a frase que o dono digita (a janela de “Ligar o automático…”)', 'spec 04 L305', dlgLigar('dia', true) + '<p class="m-q-nota">Na página do Arquivo ou no quadro “Pode ligar”, o botão abre esta janela de verdade: o botão fica tracejado até a frase ser digitada (maiúscula ou minúscula, colar vale); Esc fecha e o foco volta ao botão.</p>']
    ],
    ligado: [
      Qd('b-lig', 'Ligado', 'spec 04 L306', 'dia', 'lig'),
      Qd('b-parcial', 'Ligado, com uma parte ainda em dois passos', 'spec 04 L307', 'hora', 'parcial'),
      Qd('b-perto', 'Ligado, perto de vencer', 'spec 04 L308', 'dia', 'perto')
    ],
    parou: MOTIVOS.map(function(m){
      return Qd('c' + m[0], 'Desligou sozinho, motivo ' + m[0].replace('b', '') + (m[0] === '3b' ? ' (B2)' : '') + ': ' + m[1], 'spec 04 L316-330', m[0] === '3' ? 'hora' : 'dia', 'desl-' + m[0], { adm: ADM });
    }),
    fora: [
      ['d-chip', 'O aviso fora da página: o chip na faixa de todas as telas, ao lado da pastilha do banco', 'spec 04 L310', '<div id="faixa-quadro"></div><p class="m-q-nota">O chip leva o triângulo âmbar e a borda neutra; a pastilha do banco segue com a cor do banco. Clique no chip: abre o Arquivo, e lá o chip some.</p>'],
      Qd('d-visto', 'Depois que o dono abriu a peça: o aviso fica, o triângulo sai e o chip some', 'spec 04 L309-310', 'dia', 'desl-1', { visto: true, adm: ADM }),
      ['d-quatro', 'As quatro recusas que NÃO desligam: nada disso aparece como problema aqui', 'spec 04 L332', emCartao('dia', peca('dia', 'lig')) + '<p class="m-q-nota">O mês ainda dentro do prazo, a coleta gravando naquele instante (ele tenta de novo no mesmo dia), a parte que ainda exige dois passos (quadro “Ligado, com uma parte em dois passos”) e o mês que ficou fora das telas esperando o segundo passo (ele o pula e tira o seguinte): em todos o painel continua “ligado”, sem triângulo e sem chip. A primeira cópia sem verificação também não desliga; só a segunda seguida (motivo 3).</p>']
    ],
    outros: [
      Qd('e-trav', 'Travado pela configuração do site', 'spec 04 L311', 'dia', 'trav'),
      Qd('e-nm', 'Não medido: nada sai sozinho', 'spec 04 L312', 'dia', 'nm'),
      ['e-texto', 'Comentários: não existe automático, e a tela diz por quê', 'spec 04 L300', emCartao('texto', peca('texto', 'x'))],
      Qd('e-edita', 'Quem edita mas não administra: vê o estado, não vê o botão de ligar', 'spec 04 L303', 'dia', 'desl', { adm: false })
    ]
  };
  var GR = [['todos-antes', 'Antes de ligar'], ['todos-ligado', 'Ligado'], ['todos-parou', 'Desligou sozinho (um por motivo)'], ['todos-fora', 'O aviso fora da página'], ['todos-outros', 'Os outros casos']];
  var CH = { 'todos-antes': 'antes', 'todos-ligado': 'ligado', 'todos-parou': 'parou', 'todos-fora': 'fora', 'todos-outros': 'outros' };
  var TODOS = []; Object.keys(F).forEach(function(k){ TODOS = TODOS.concat(F[k]); });

  function corpo(){
    var qs = CH[E] ? F[CH[E]] : TODOS.filter(function(q){ return q[0] === E; });
    if (!qs.length) return '<p>Estado desconhecido.</p>';
    return qs.map(function(q){ return M.quadro(q[0], q[1], q[2], q[3]); }).join('');
  }
  var ids = TODOS.map(function(q){ return [q[0], q[0].toUpperCase()]; });
  var barra = M.mock('peça 4 · ' + E, [M.grupo('Grupo', 'e', GR, E), M.grupo('Um quadro', 'e', ids, E), M.grupo('Perfil', 'perfil', [['adm', 'Administra'], ['ed', 'Edita']], ADM ? 'adm' : 'ed')],
    'Peça 4 (spec 04 §14.4). Datas de exemplo: hoje = 03/05/2028. A peça mora no topo de cada cartão de tipo da página do Arquivo (arquivo.html; use ?auto=desl-2 etc.). “Ligar o automático…” abre a janela de verdade. Carregamento: o estado vem do servidor junto da página, sem esqueleto.');
  document.title = 'Mockup 19: o interruptor do automático';
  document.body.innerHTML = barra + M.obs('arquivo', 'cheio') + '<main id="m-main"><h2 class="m-h2">O interruptor do automático</h2><p class="m-muted" style="margin:0 0 14px">Um quadro por estado. Cada quadro mostra o cartão do tipo de dado com a peça no topo; na página do Arquivo ela está nos três cartões.</p>' + M.legenda(false) + corpo() + '</main>';
  ajustaFaixa('nenhum');
  var fq = document.getElementById('faixa-quadro');
  if (fq) { fq.innerHTML = M.obs('arquivo', 'cheio'); fq.firstChild.style.cssText = 'border:1px solid var(--border);border-radius:8px'; ajustaFaixa('desl', fq); }
})();
