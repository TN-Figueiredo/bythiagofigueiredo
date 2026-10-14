/* interruptor.js: peça 4, o interruptor do automático (PLANO seção 10b; spec 04 §14.4). Usado por interruptor.html (todos os quadros) e por arquivo.js (a peça encaixada no topo de cada cartão de tipo). Datas de exemplo: hoje = 03/05/2028. Revisão 1 (Logan A1-A9, Naksu C1-C3) aplicada em 14/10/2026. */
(function(){
  'use strict';
  var ic = M.ic, esc = M.esc, ib = M.ib, infoBox = M.infoBox;
  var N = 0;
  var TIPO = {
    dia: { nome: 'Views por dia', frase: 'ligar automático de views por dia', ate: 'outubro de 2027', desde: '04/05/2028', ult: 'setembro de 2027' },
    texto: { nome: 'Comentários e dados antigos do YouTube', frase: '', ate: '', desde: '', ult: '' },
    hora: { nome: 'Leitura de hora em hora', frase: 'ligar automático de leitura de hora em hora', ate: 'fevereiro de 2028', desde: '04/05/2028', ult: 'janeiro de 2028' }
  };
  var ATE = '19/07/2028';
  var CALMA = 'Nada saiu do banco por causa disso, e nada sai até você ligar de novo.';
  var CALMA7 = 'O que já saiu continua saído, e nada mais sai até você ligar de novo.';
  var ESPERA = 'Pode esperar: se você está fora de casa, resolva quando voltar.';
  var ONDE = 'A configuração do site é a variável <code>OBS_ARQUIVO_AUTO_DROP</code>. Você muda lá; se não souber como, deixe para o Claude Code ou o Cowork. Enquanto ela estiver desligada, o botão de ligar não aparece, e cada mês sai pelo botão.';

  /* motivos do desligamento: lista fechada (04 §14.4, 1 a 11 e 13; o 12 está retirado). [id, motivo curto (chip e frase-resumo), frase do spec, o que fazer, pode esperar?, título do quadro para o dono] */
  var MOTIVOS = [
    ['1', 'O arquivo de um mês ficou diferente', 'O arquivo de outubro de 2027 ficou diferente do que o site guardou. Nada sai até você resolver.', 'Abra a linha de outubro de 2027 na lista abaixo e leia o aviso dela.', false, 'Quando o arquivo de um mês fica diferente do que o site guardou'],
    ['2', 'A casa ficou mais de 36 horas sem responder', 'A casa ficou mais de 36 horas sem responder. Veja o que fazer no aviso da casa.', 'Veja o aviso da casa no topo desta página e espere ela voltar.', true, 'Quando a casa fica mais de 36 horas sem responder'],
    ['2v', 'A casa ficou mais de 36 horas sem responder', 'A casa ficou mais de 36 horas sem responder. Veja o que fazer no aviso da casa.', 'A casa voltou a responder em 03/05. Veja o que sairia e ligue de novo quando quiser.', false, 'Quando a casa ficou fora, mas já voltou'],
    ['3', 'A cópia ficou sem verificação duas vezes seguidas (no NAS)', 'A cópia de outubro de 2027 ficou sem verificação em duas rodadas seguidas. Veja se a casa está respondendo.', 'Veja se a forja e o NAS estão ligados e respondendo.', true, 'Quando a cópia no NAS fica sem verificação duas vezes seguidas'],
    ['3b', 'A cópia ficou sem verificação duas vezes seguidas (no B2)', 'A forja ficou sem conferir o B2 de outubro de 2027 por mais de 7 dias, duas vezes seguidas.', 'Veja se a forja está ligada e conferindo o B2.', true, 'Quando a forja não consegue conferir o B2 duas vezes seguidas'],
    ['4', 'A cópia atrasou mais de 30 dias', 'A cópia atrasou mais de 30 dias.', 'Veja o aviso da linha do mês atrasado; se a casa também estiver fora, o aviso dela está no topo desta página.', true, 'Quando a cópia atrasa mais de 30 dias'],
    ['5', 'O banco passou de 85%', 'O banco passou de 85%: agora quem decide é você; veja o que pode sair.', 'Veja na lista abaixo o que pode sair e tire pelo botão de cada mês.', false, 'Quando o banco passa de 85%'],
    ['6', 'O banco não pôde ser medido hoje', 'Não foi possível medir o banco hoje.', 'Veja o aviso do banco no topo; a medida é refeita na próxima leitura.', false, 'Quando o banco não pode ser medido'],
    ['7', 'Mais de um mês sairia no mesmo dia', 'O automático tentou tirar mais de um mês no mesmo dia e parou.', 'Veja na lista abaixo quais meses saíram hoje antes de ligar de novo.', false, 'Quando mais de um mês sairia no mesmo dia'],
    ['8', 'A validade de 90 dias acabou', 'A validade de 90 dias acabou. Nada deu errado.', 'Ligue de novo quando quiser.', false, 'Quando a validade de 90 dias termina (não é problema)'],
    ['9', 'Foi desligado na configuração do site', 'O automático foi desligado na configuração do site.', 'Você liga de volta na configuração do site (veja o ⓘ); sem isso não dá para ligar aqui.', false, 'Quando o automático é desligado na configuração do site'],
    ['10', 'A conferência do B2 falhou', 'A conferência do B2 de outubro de 2027 falhou em 02/05/2028: faltam arquivos.', 'Na linha de outubro de 2027, use “Ver o comando” e rode a conferência do B2 de novo.', true, 'Quando a conferência do B2 de um mês falha'],
    ['11', 'O banco recusou tirar um mês', 'O banco recusou tirar outubro de 2027: o mês ainda está recebendo dados de outra parte do site.', 'Leia o motivo acima. Se não entender, anote a frase e deixe para quando voltar.', false, 'Quando o banco recusa tirar um mês'],
    ['13', 'A forja e o seu Mac discordaram sobre o B2', 'A forja e o seu Mac deram respostas diferentes sobre a cópia de outubro de 2027 no B2. Nada sai sozinho até você olhar.', 'Na linha de outubro de 2027, use “Ver o comando” e rode a conferência no seu Mac; compare com a da forja.', true, 'Quando a forja e o seu Mac discordam sobre o B2']
  ];
  /* a regra, antes de ligar: as 11 paradas, em 4 linhas com título (Logan A8) */
  var DESLIGA = [
    ['A casa ou a cópia deixa de responder', 'a casa fica mais de 36 horas sem responder; a cópia fica sem verificação duas vezes seguidas; a cópia atrasa mais de 30 dias; a conferência do B2 de um mês falha; a forja e o seu Mac dão respostas diferentes sobre o B2'],
    ['O arquivo ou o banco recusa', 'o arquivo de algum mês fica diferente do que o site guardou; o banco recusa tirar um mês; mais de um mês sairia no mesmo dia'],
    ['O banco passa de 85% ou não pode ser medido', ''],
    ['Validade e configuração', 'a validade de 90 dias acaba; o automático é desligado na configuração do site']
  ];

  /* o aviso é "alerta" (triângulo, chip, frase-resumo) em todo desligamento, menos no 8 (decisão do dono, 14/10/2026: aviso neutro) */
  function alerta(id){ return /^desl-/.test(id || '') && id !== 'desl-8'; }

  function bar(rot, feitas, total){
    var pct = Math.round(100 * feitas / total), ok = feitas >= total;
    return '<div class="b"><div class="t"><span>' + rot + '</span><span class="m-num">' + (ok ? ic('ok') : '') + feitas + ' de ' + total + '</span></div><div class="m-bar" role="progressbar" aria-label="' + esc(rot) + '" aria-valuenow="' + feitas + '" aria-valuemin="0" aria-valuemax="' + total + '"><i style="width:' + pct + '%"></i></div></div>';
  }
  function barras(s, v){ return '<div class="m-auto-bars">' + bar('Saídas feitas por você', s, 3) + bar('Simulações vistas', v, 2) + '</div>'; }
  function info(t, rot, html){ var id = 'i-auto-' + t + '-' + (++N); return ib(id, rot) + infoBox(id, html); }
  function painel(t, cls, icone, titulo, corpo){
    return '<div class="m-auto ' + cls + '" data-auto-tipo="' + t + '" tabindex="-1" role="group" aria-label="Automático de ' + esc(TIPO[t].nome.toLowerCase()) + '">' + icone + '<div class="m-ac-b"><span class="h">' + titulo + '</span>' + corpo + '</div></div>';
  }
  function botaoLigar(t, adm, rot){
    if (!adm) return '<p class="k">Quem administra o site liga o automático.</p>';
    return '<div class="m-auto-ac"><button type="button" class="btn heavy" data-auto="ligar" data-tipo="' + t + '">' + (rot || 'Ligar o automático…') + '</button><small>Antes de ligar, você lê a regra e digita uma frase.</small></div>';
  }
  /* decisão do dono, 14/10/2026: há "Ver a regra" e "Desligar" no painel ligado */
  function acLigado(t, adm){
    return '<div class="m-auto-ac"><button type="button" class="btn" data-auto="regra" data-tipo="' + t + '">Ver a regra</button>' + (adm ? '<button type="button" class="btn" data-auto="desligar" data-tipo="' + t + '">Desligar</button>' : '') + '</div>';
  }
  function botaoSimular(){ return '<div class="m-auto-ac"><button type="button" class="btn" data-auto="simular">Ver o que sairia</button></div>'; }
  var COMO_DESLIGAR = 'Toque em “Desligar”: vale na hora e não pede frase. Também dá para desligar na configuração do site (variável <code>OBS_ARQUIVO_AUTO_DROP</code>); ela vale por cima de tudo. Os motivos que desligam sozinho estão em “Ver a regra”.';
  function ligadoP(t, extra){ return 'Próximo mês: ' + TIPO[t].ate + ', a partir de ' + TIPO[t].desde + '. Último que saiu: ' + TIPO[t].ult + ', em 03/05. Sai no máximo um mês por dia, e só com as duas cópias conferidas.' + (extra || ''); }

  /* ------------------------------------------------------------ os estados. peca(tipo, id, opt) devolve o painel. opt: adm (padrão true), visto, manual, ancora */
  function peca(t, id, o){
    o = o || {};
    var h = peca0(t, id, o);
    if (!h) return h;
    return h.replace('<div class="m-auto ', '<div data-auto-id="' + id + '"' + (o.ancora ? ' id="auto-' + t + '"' : '') + ' class="m-auto ');
  }
  function peca0(t, id, o){
    var adm = o.adm !== false;
    if (t === 'texto') return painel('texto', 'pt', ic('pont'), 'Automático: não existe aqui', '<p>Comentários saem sempre por clique: o texto some do site, e isso nunca acontece sem você ver.</p>');
    var m;
    if ((m = /^ind(?:-(\d)-(\d))?$/.exec(id))) {
      var s = m[1] == null ? 1 : +m[1], v = m[2] == null ? 0 : +m[2], fs = 3 - s, fv = 2 - v, p = [];
      if (fs > 0) p.push(fs + (fs === 1 ? ' saída feita por você' : ' saídas feitas por você') + ' (' + s + ' de 3)');
      if (fv > 0) p.push(fv + (fv === 1 ? ' simulação vista' : ' simulações vistas') + ' (' + v + ' de 2)');
      return painel(t, 'pt', ic('pont'), 'Automático: ainda não dá para ligar', '<p>Falta: ' + p.join(' e ') + '.</p>' + barras(s, v) + '<p class="k">Uma saída feita por você é um mês que você tirou do banco pelo botão. Uma simulação é o “Ver o que sairia”, que não tira nada. ' + info(t, 'Por que o automático espera', 'O automático só liga depois que você mesmo tirou meses e viu o que sairia, para conhecer o caminho antes de deixar de olhar. Enquanto isso, cada mês sai pelo botão.') + '</p>' + (adm && fv > 0 ? botaoSimular() : ''));
    }
    if (id === 'desl') return painel(t, '', ic('pont'), 'Automático: desligado', '<p>' + (o.manual ? 'Desligado por você em 03/05/2028. ' : '') + 'Você tira cada mês pelo botão. Para o automático ligar, você já cumpriu as 3 saídas e as 2 simulações.</p>' + botaoLigar(t, adm));
    if (id === 'lig') return painel(t, '', ic('ok'), 'Automático: ligado até ' + ATE, '<p>' + ligadoP(t) + ' ' + info(t, 'Como desligar', COMO_DESLIGAR) + '</p>' + acLigado(t, adm));
    if (id === 'parcial') return painel(t, '', ic('ok'), 'Automático: ligado até ' + ATE, '<p>As primeiras horas ainda saem pelo botão, em dois passos (1 de 3 saídas feitas). O automático pula essa parte e continua ligado. Último que saiu: ' + TIPO[t].ult + ', em 03/05.' + ' ' + info(t, 'Como desligar', COMO_DESLIGAR) + '</p>' + acLigado(t, adm));
    if (id === 'perto') return painel(t, 'pt', ic('info'), 'Automático: ligado, vence em 6 dias', '<p>Ligado até 09/05/2028. Depois disso ele desliga e você liga de novo: veja o que sairia e digite a frase.' + ' ' + info(t, 'Como desligar', COMO_DESLIGAR) + '</p>' + acLigado(t, adm));
    if (id === 'trav') return painel(t, 'pt', ic('pont'), 'Automático: desligado na configuração', '<p>O automático está desligado na configuração do site. ' + info(t, 'Onde fica essa configuração', ONDE) + '</p>');
    if (id === 'nm') return painel(t, 'nm', ic('nm'), 'Automático: não medido', '<p>Não foi possível ler o estado do automático. Enquanto isso, nada sai sozinho.</p>');
    if ((m = /^desl-(.+)$/.exec(id))) {
      var mo = MOTIVOS.filter(function(x){ return x[0] === m[1]; })[0]; if (!mo) return '';
      var neutro = m[1] === '8', visto = !!o.visto;
      var cls = neutro || visto ? 'pt' : 'am';
      var icone = neutro ? ic('info') : visto ? ic('pont') : ic('tri');
      var titulo = neutro ? 'Automático: a validade de 90 dias acabou em 02/05/2028' : 'Automático: desligou sozinho em 02/05/2028';
      var fid = 'falta-' + (++N);
      var fazer = (neutro ? '' : '<p class="calma">' + (m[1] === '7' ? CALMA7 : CALMA) + '</p>') +
        '<p class="do"><b>O que fazer:</b> ' + mo[3] + (m[1] === '9' ? ' ' + info(t, 'Onde fica essa configuração', ONDE) : '') + '</p>' + (mo[4] ? '<p class="pode">' + ESPERA + '</p>' : '');
      return painel(t, cls, icone, titulo,
        '<p>' + mo[2] + '</p>' + fazer +
        '<p class="k">Para ligar de novo: veja o que sairia (uma vez) e digite a frase. Ele não liga sozinho. ' + info(t, 'Por que não liga sozinho', 'Se parou por um motivo, a cópia ou o banco pode estar com problema. Ligar de novo é uma escolha sua, depois de ver uma simulação feita depois do desligamento. A validade recomeça em 90 dias.') + '</p>' +
        (adm ? '<div class="m-auto-ac"><button type="button" class="btn" data-auto="simular">Ver o que sairia</button><button type="button" class="btn" data-auto="religar" data-tipo="' + t + '" aria-disabled="true" aria-describedby="' + fid + '">Ligar de novo</button><small id="' + fid + '">Falta ver o que sairia.</small></div>' : '<p class="k">Quem administra o site liga o automático.</p>'));
    }
    return '';
  }

  /* ------------------------------------------------------------ a regra (diálogo): ligar (com a frase) ou só ler (botão “Ver a regra”) */
  function regraHtml(T, leitura){
    return '<p class="t">' + (leitura ? 'O site tira um mês do banco sozinho, <b>sem você ver na hora</b>. A regra:' : 'Depois de ligar, o site tira um mês do banco sozinho, <b>sem você ver na hora</b>. A regra:') + '</p>' +
      '<ul class="m-lista"><li>Sai <b>no máximo um mês por dia</b>.</li><li>Só sai um mês com as duas cópias conferidas e a recuperação testada.</li><li>Vale por <b>90 dias</b>; depois você liga de novo.</li><li><b>Continua precisando do seu teste de recuperação</b>, a cada 5 meses (duas a três vezes por ano; uma a mais se o formato dos dados mudar).</li></ul>' +
      '<p class="t">Ele <b>desliga sozinho</b> e avisa na faixa do topo de todas as telas do Observatório quando:</p>' +
      '<ul class="m-lista">' + DESLIGA.map(function(x){ return '<li><b>' + x[0] + '</b>' + (x[1] ? ': ' + x[1] : '') + '.</li>'; }).join('') + '</ul>' +
      '<p>Quando desliga, ele não liga de novo sozinho.</p>';
  }
  function dlgLigar(t, estatico, leitura){
    var T = TIPO[t];
    if (leitura) return '<div class="m-dlg' + (estatico ? ' st' : '') + '" role="dialog" aria-modal="true" aria-labelledby="aT"><div class="m-dlg-b"><h2 id="aT">A regra do automático de ' + T.nome.toLowerCase() + '</h2>' + regraHtml(T, true) + '</div>' +
      '<div class="m-dlg-a"><button type="button" class="btn" data-fecha data-foco>Fechar</button></div></div>';
    return '<div class="m-dlg' + (estatico ? ' st' : '') + '" role="dialog" aria-modal="true" aria-labelledby="aT"><div class="m-dlg-b"><h2 id="aT">Ligar o automático de ' + T.nome.toLowerCase() + '?</h2>' + regraHtml(T, false) + '</div>' +
      '<div class="m-dlg-f"><p>Para ligar, digite: <b class="m-num m-frase">' + T.frase + '</b></p>' +
      '<label for="aIn">Frase de confirmação</label><input id="aIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-auto-in="' + t + '" aria-describedby="aSt"><p class="m-st" id="aSt" role="status">Digite a frase para continuar.</p></div>' +
      '<div class="m-dlg-a"><button type="button" class="btn heavy" id="aOk" data-auto-ok aria-disabled="true" aria-describedby="aSt">Ligar o automático</button><button type="button" class="btn" data-fecha data-foco>Cancelar</button></div></div>';
  }
  /* desligar: sem frase; a confirmação diz o que acontece (decisão do dono, 14/10/2026) */
  function dlgDesligar(t, estatico){
    var T = TIPO[t];
    return '<div class="m-dlg' + (estatico ? ' st' : '') + '" role="dialog" aria-modal="true" aria-labelledby="aT"><div class="m-dlg-b"><h2 id="aT">Desligar o automático de ' + T.nome.toLowerCase() + '?</h2>' +
      '<p class="t">Nada sai sozinho até você ligar de novo; <b>o que já saiu continua saído</b>. Cada mês volta a sair pelo botão.</p>' +
      '<p>Para ligar de novo, vale a regra de sempre: você lê a regra e digita a frase.</p></div>' +
      '<div class="m-dlg-a"><button type="button" class="btn" id="aOk" data-auto-ok>Desligar o automático</button><button type="button" class="btn" data-fecha data-foco>Cancelar</button></div></div>';
  }

  var foco = null;
  function norm(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function algumLigado(){
    return [].slice.call(document.querySelectorAll('.m-auto[data-auto-id]')).some(function(e){ return ['lig', 'parcial', 'perto'].indexOf(e.getAttribute('data-auto-id')) >= 0; });
  }
  function atualizaFaixa(){ ajustaFaixa(algumLigado() ? 'lig' : 'nenhum'); var l = document.querySelector('.m-res-lead'); if (l && !document.querySelector('.m-auto.am')) l.remove(); }
  function troca(t, id, o){
    var alvo = document.querySelector('.m-auto[data-auto-tipo="' + t + '"]'); if (!alvo) return;
    var anc = alvo.id ? { ancora: true } : {}; o = o || {}; o.ancora = !!anc.ancora;
    alvo.outerHTML = peca(t, id, o);
    var h = document.querySelector('.m-auto[data-auto-tipo="' + t + '"]'); if (h) h.focus();
    atualizaFaixa();
  }
  function abreDlg(btn, html, aoConfirmar, aposMontar){
    foco = btn;
    var m = document.createElement('div'); m.className = 'm-modal'; m.innerHTML = html; document.body.appendChild(m);
    function fecha(){ m.remove(); document.removeEventListener('keydown', key); if (foco && document.contains(foco)) foco.focus(); }
    function key(e){
      if (e.key === 'Escape') { fecha(); return; }
      if (e.key === 'Tab') { var f = m.querySelectorAll('button,input'); var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); } }
    }
    document.addEventListener('keydown', key);
    m.addEventListener('click', function(e){
      var inp = m.querySelector('input');
      /* Naksu S4: um toque fora não descarta a frase já digitada */
      if (e.target === m) { if (!(inp && inp.value)) fecha(); return; }
      if (e.target.closest('[data-fecha]')) { fecha(); return; }
      var ok = e.target.closest('[data-auto-ok]');
      if (ok && ok.getAttribute('aria-disabled') !== 'true') { fecha(); aoConfirmar && aoConfirmar(); }
    });
    if (aposMontar) aposMontar(m);
    m.querySelector('[data-foco]').focus();
  }
  function abreLigar(btn){
    var t = btn.getAttribute('data-tipo');
    abreDlg(btn, dlgLigar(t, false), function(){ troca(t, 'lig', { adm: true }); }, function(m){
      m.querySelector('[data-auto-in]').addEventListener('input', function(ev){
        var v = ev.target.value, ok = norm(v) === norm(TIPO[t].frase);
        m.querySelector('#aOk').setAttribute('aria-disabled', String(!ok));
        m.querySelector('#aSt').textContent = ok ? 'Frase confirmada.' : (v.trim().length >= 5 ? 'Ainda não bate com a frase. Maiúscula e acento não importam.' : 'Digite a frase para continuar.');
      });
    });
  }
  function simula(btn){
    var pa = btn.closest('.m-auto'); if (!pa) return;
    var t = pa.getAttribute('data-auto-tipo'), bloco = pa.querySelector('.m-ac-b');
    if (!bloco.querySelector('.m-sim')) bloco.insertAdjacentHTML('beforeend', '<div class="m-sim" tabindex="-1"><p><span class="m-marca">simulação, nada foi tirado</span>Se você tirasse ' + TIPO[t].ate + ' agora: <b class="m-num">45</b> canais, <b class="m-num">1.234.567</b> registros, <b class="m-num">38%</b> do que este tipo de dado ocupa. Contado agora: tudo bate.</p></div>');
    var re = pa.querySelector('[data-auto="religar"]');
    if (re) { re.setAttribute('aria-disabled', 'false'); re.classList.add('heavy'); var sm = pa.querySelector('.m-auto-ac small'); if (sm) sm.textContent = 'Simulação vista: nada foi tirado.'; }
    var s = bloco.querySelector('.m-sim'); if (s) s.focus();
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-auto]'); if (!b) return;
    var a = b.getAttribute('data-auto'), t = b.getAttribute('data-tipo');
    if (b.getAttribute('aria-disabled') === 'true') return;
    if (a === 'ligar' || a === 'religar') abreLigar(b);
    else if (a === 'regra') abreDlg(b, dlgLigar(t, false, true));
    else if (a === 'desligar') abreDlg(b, dlgDesligar(t), function(){ troca(t, 'desl', { adm: true, manual: true }); });
    else if (a === 'simular') simula(b);
  });

  /* ------------------------------------------------------------ "visto" = o painel esteve com metade na tela por 1 segundo (Logan A2) */
  function marcaVisto(el){
    el.classList.remove('am'); el.classList.add('pt');
    var i = el.firstElementChild; if (i) { i.insertAdjacentHTML('beforebegin', ic('pont')); i.remove(); }
    if (!document.querySelector('.m-auto.am')) atualizaFaixa();
  }
  function observaVisto(){
    var els = [].slice.call(document.querySelectorAll('.m-auto.am')); if (!els.length || !('IntersectionObserver' in window)) return;
    var tm = new Map();
    var io = new IntersectionObserver(function(es){ es.forEach(function(en){
      var el = en.target;
      if (en.isIntersecting && en.intersectionRatio >= 0.5) { if (!tm.has(el)) tm.set(el, setTimeout(function(){ marcaVisto(el); io.unobserve(el); }, 1000)); }
      else if (tm.has(el)) { clearTimeout(tm.get(el)); tm.delete(el); }
    }); }, { threshold: [0, 0.5, 1] });
    els.forEach(function(e){ io.observe(e); });
  }

  /* ------------------------------------------------------------ a faixa de frescor (o chip ao lado da pastilha do banco, não dentro dela) */
  function ajustaFaixa(modo, raiz){
    var f = (raiz || document).querySelector('.m-obs .m-fresh'); if (!f) return;
    [].slice.call(f.querySelectorAll('.m-chip')).forEach(function(c){ if (/Autom[aá]tico ligado|autom[aá]tico desligou/.test(c.textContent)) c.remove(); });
    if (modo === 'lig') f.insertAdjacentHTML('beforeend', '<span class="m-chip">' + ic('ok') + 'Automático ligado</span>');
    if (modo === 'desl') f.insertAdjacentHTML('beforeend', '<a class="m-chip" href="arquivo.html?caso=cheio&auto=desl-1#auto-dia" aria-label="O automático de views por dia desligou em 02/05. Abrir o Arquivo, no aviso">' + ic('tri') + 'automático desligou em 02/05</a>');
  }

  /* ------------------------------------------------------------ cartão de tipo (como na página do Arquivo) */
  function emCartao(t, painelHtml, resumo){
    return '<section class="m-card" aria-label="' + esc(TIPO[t] ? TIPO[t].nome : t) + '"><div class="m-card-h"><div class="m-card-top"><h3 class="m-h3">' + esc(TIPO[t].nome) + '</h3></div>' + painelHtml + (resumo ? '<p class="m-resumo">' + resumo + '</p>' : '') + '</div></section>';
  }

  window.INT = { peca: peca, emCartao: emCartao, ajustaFaixa: ajustaFaixa, dlgLigar: dlgLigar, dlgDesligar: dlgDesligar, MOTIVOS: MOTIVOS, TIPO: TIPO, alerta: alerta, observaVisto: observaVisto };

  /* ============================================================ interruptor.html: um quadro por estado */
  if (!document.getElementById('int-page')) return;
  var Q = M.Q, E = Q('e', 'todos-antes'), ADM = Q('perfil', 'adm') === 'adm';
  /* A9: título em português do dono; o código e a fonte vão para o ⓘ do quadro, para quem revisa */
  function Qd(id, titulo, fonte, t, estado, o, extra){ return [id, titulo, fonte, emCartao(t, peca(t, estado, o)) + (extra || '')]; }
  function quadro(q){
    var iid = 'i-q-' + q[0];
    return '<section class="m-q" id="q-' + q[0] + '"><header class="m-q-h m-q-h-dono"><h4 class="m-q-t">' + q[1] + '</h4>' + ib(iid, 'Para quem revisa: código e fonte deste quadro') + '</header><div class="m-q-b">' + infoBox(iid, 'Para quem revisa: quadro <b>' + q[0].toUpperCase() + '</b>. Fonte: ' + q[2] + '.') + q[3] + '</div></section>';
  }
  function parou(m){
    var ex = m[0] === '11' ? '<p class="m-q-nota">A frase do motivo (“o mês ainda está recebendo dados de outra parte do site”) é só um exemplo: a frase final vem do catálogo fechado do spec (14.3).</p>' : m[0] === '8' ? '<p class="m-q-nota">Este não leva triângulo nem chip na faixa: terminar a validade não é problema, é só um aviso.</p>' : m[0] === '2v' ? '<p class="m-q-nota">Mesmo motivo do quadro anterior, mas a casa já voltou: o painel diz isso em vez de mandar esperar.</p>' : '';
    return Qd('c' + m[0], m[5], 'spec 04 L316-330, motivo ' + m[0].replace('b', ' (B2)'), m[0] === '3' ? 'hora' : 'dia', 'desl-' + m[0], { adm: ADM }, ex);
  }
  var GP = [['A casa ou a cópia deixa de responder', ['2', '2v', '3', '3b', '4', '10', '13']], ['O arquivo ou o banco recusa', ['1', '7', '11']], ['O banco passa de 85% ou não pode ser medido', ['5', '6']], ['Validade e configuração', ['8', '9']]];
  function porMotivo(id){ return MOTIVOS.filter(function(x){ return x[0] === id; })[0]; }
  function parouHtml(){
    return GP.map(function(g){
      var qs = g[1].map(function(id){ return parou(porMotivo(id)); });
      return '<h3 class="m-grupo-t">' + g[0] + '</h3>' + quadro(qs[0]) + (qs.length > 1 ? '<details class="m-outros"><summary>As outras ' + (qs.length - 1) + (qs.length - 1 === 1 ? ' situação deste grupo' : ' situações deste grupo') + '</summary><div>' + qs.slice(1).map(quadro).join('') + '</div></details>' : '');
    }).join('');
  }
  var F = {
    antes: [
      Qd('a-ind0', 'Ainda não dá para ligar: nada feito ainda', 'spec 04 L303', 'dia', 'ind-0-0', { adm: ADM }),
      Qd('a-ind', 'Ainda não dá para ligar: faltam saídas e simulações', 'spec 04 L303', 'dia', 'ind', { adm: ADM }),
      Qd('a-ind2', 'Ainda não dá para ligar: só falta ver o que sairia', 'spec 04 L303', 'hora', 'ind-3-1', { adm: ADM }),
      Qd('a-desl', 'Pode ligar: o automático está desligado', 'spec 04 L304', 'dia', 'desl', { adm: ADM })
    ],
    regra: [
      ['a-ligar', 'A regra inteira e a frase que você digita para ligar (a janela de “Ligar o automático…”)', 'spec 04 L305', dlgLigar('dia', true) + '<p class="m-q-nota">Na página do Arquivo ou no quadro “Pode ligar”, o botão abre esta janela de verdade: o botão fica tracejado até a frase ser digitada (maiúscula, minúscula e acento não importam; colar vale); a frase e o botão ficam fixos embaixo, e a regra rola por cima. Esc fecha e o foco volta ao botão.</p>']
    ],
    ligado: [
      Qd('b-lig', 'Ligado', 'spec 04 L306', 'dia', 'lig'),
      Qd('b-parcial', 'Ligado, com uma parte ainda em dois passos', 'spec 04 L307', 'hora', 'parcial'),
      Qd('b-perto', 'Ligado, perto de vencer (aviso neutro: não há o que fazer, só esperar)', 'spec 04 L308', 'dia', 'perto'),
      ['b-regra', 'O botão “Ver a regra”: a mesma regra, só para ler', 'decisão do dono 14/10/2026 (fora do spec)', dlgLigar('dia', true, true)],
      ['b-desligar', 'O botão “Desligar”: confirma sem pedir frase e diz o que acontece', 'decisão do dono 14/10/2026 (fora do spec)', dlgDesligar('dia', true) + '<p class="m-q-nota">Depois de confirmar, o cartão passa a “desligado”: ' + 'o dono volta a tirar cada mês pelo botão e, para ligar, lê a regra e digita a frase.</p>']
    ],
    fora: [
      ['d-chip', 'O aviso fora da página: o chip na faixa de todas as telas, ao lado da pastilha do banco', 'spec 04 L310', '<div id="faixa-quadro" class="m-faixa-q"></div><p class="m-q-nota">O chip leva o triângulo âmbar e a borda neutra; a pastilha do banco segue com a cor do banco. Clique no chip: abre o Arquivo já no painel que explica. Depois que o painel fica 1 segundo na tela, o chip some.</p>'],
      Qd('d-visto', 'Depois que o painel ficou na tela: o aviso fica, o triângulo sai e o chip some', 'spec 04 L309-310', 'dia', 'desl-1', { visto: true, adm: ADM }),
      ['d-quatro', 'As quatro recusas que NÃO desligam: nada disso aparece como problema aqui', 'spec 04 L332', emCartao('dia', peca('dia', 'lig')) + '<p class="m-q-nota">O mês ainda dentro do prazo, a coleta gravando naquele instante (ele tenta de novo no mesmo dia), a parte que ainda exige dois passos (quadro “Ligado, com uma parte em dois passos”) e o mês que ficou fora das telas esperando o segundo passo (ele o pula e tira o seguinte): em todos o painel continua “ligado”, sem triângulo e sem chip. A primeira cópia sem verificação também não desliga; só a segunda seguida (“Quando a cópia no NAS fica sem verificação duas vezes seguidas”).</p>']
    ],
    outros: [
      Qd('e-trav', 'Desligado na configuração do site', 'spec 04 L311', 'dia', 'trav'),
      Qd('e-nm', 'Não deu para ler o estado: nada sai sozinho', 'spec 04 L312', 'dia', 'nm'),
      ['e-texto', 'Comentários: não existe automático, e a tela diz por quê', 'spec 04 L300', emCartao('texto', peca('texto', 'x'))],
      Qd('e-edita', 'Quem edita mas não administra: vê o estado, não vê os botões de ligar e desligar', 'spec 04 L303', 'dia', 'desl', { adm: false })
    ]
  };
  var GR = [['todos-antes', 'Antes de ligar'], ['todos-regra', 'Ligar (a regra)'], ['todos-ligado', 'Ligado'], ['todos-parou', 'Desligou sozinho'], ['todos-fora', 'O aviso fora da página'], ['todos-outros', 'Os outros casos']];
  var CH = { 'todos-antes': 'antes', 'todos-regra': 'regra', 'todos-ligado': 'ligado', 'todos-fora': 'fora', 'todos-outros': 'outros' };
  var TODOS = []; Object.keys(F).forEach(function(k){ TODOS = TODOS.concat(F[k]); });
  var PAROU = MOTIVOS.map(parou); TODOS = TODOS.concat(PAROU);

  function corpo(){
    if (E === 'todos-parou') return parouHtml();
    var qs = CH[E] ? F[CH[E]] : TODOS.filter(function(q){ return q[0] === E; });
    if (!qs.length) return '<p>Estado desconhecido.</p>';
    return qs.map(quadro).join('');
  }
  var ids = TODOS.map(function(q){ return [q[0], q[0].toUpperCase()]; });
  var barra = M.mock('peça 4 · ' + E, [M.grupo('Grupo', 'e', GR, E), M.grupo('Um quadro', 'e', ids, E), M.grupo('Perfil', 'perfil', [['adm', 'Administra'], ['ed', 'Edita']], ADM ? 'adm' : 'ed')],
    'Peça 4 (spec 04 §14.4, com a revisão 1). Datas de exemplo: hoje = 03/05/2028. A peça mora no topo de cada cartão de tipo da página do Arquivo (arquivo.html; use ?auto=desl-2 etc.). “Ligar o automático…”, “Ver a regra”, “Desligar”, “Ver o que sairia” e “Ligar de novo” funcionam de verdade. Carregamento: o estado vem do servidor junto da página, sem esqueleto.');
  document.title = 'Mockup 19: o interruptor do automático';
  document.body.innerHTML = barra + M.obs('arquivo', 'cheio') + '<main id="m-main"><h2 class="m-h2">O interruptor do automático</h2><div class="m-int-intro"><p>Este é o interruptor do automático.</p><p>Ele tira um mês do banco por dia, sozinho, depois que você o liga.</p><p>Veja abaixo cada situação em que ele aparece ou para sozinho.</p></div>' + M.legenda(false) + corpo() + '</main>';
  ajustaFaixa('nenhum');
  var fq = document.getElementById('faixa-quadro');
  if (fq) { fq.innerHTML = M.obs('arquivo', 'cheio'); ajustaFaixa('desl', fq); }
})();
