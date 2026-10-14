/* peca7.js: peça 7, o arquivo pendente na fila "Saíram do YouTube" (PLANO seção 9; spec 04 §14.7, L388-400). Encaixada na tela E do lote 1 (aba da fila), com o selo.
   ?e=cheia|comandos-1|comandos-1b|comandos-2|refutado|bloqueado|vazia|nm   ?tema=claro  ?cinza=1  ?barra=aberta
   Hoje = 03/05/2028 (caso cheio do mockup 19). Todo nome, número, data e comando é de exemplo. */
(function(){
  'use strict';
  var Q = M.Q, ic = M.ic, esc = M.esc, ib = M.ib, infoBox = M.infoBox;
  var E = Q('e', 'cheia');
  var vazia = E === 'vazia', nm = E === 'nm';
  var N = 0;
  function pl(n, a, b){ return n + ' ' + (n === 1 ? a : b); }

  /* os itens que esperam o dono rodar os comandos, do mais antigo ao mais novo. t = tempo dos comandos: 1 (copiar), '1b' (conferir o B2), 2 (apagar as antigas) */
  var IT = [
    { id: 'a', k: 'Vídeo', de: 'Nômade Raiz', t: 'Tailândia em 10 dias: o roteiro completo', dias: 63, desde: '01/03', mes: 'setembro de 2027', mm: '2027-09', tempo: 2, tipo: 'video' },
    { id: 'b', k: 'Vídeo', de: 'Nômade Raiz', t: 'Os 5 piores erros em Bangkok', dias: 34, desde: '30/03', mes: 'outubro de 2027', mm: '2027-10', tempo: 1, tipo: 'video' },
    { id: 'c', k: 'Comentários', de: 'Nômade Raiz', t: '7 comentários de 2 vídeos', dias: 8, desde: '26/03', pede: '25/04', mes: 'agosto de 2027', mm: '2027-08', tempo: 2, tipo: 'com' }
  ];
  if (E === 'comandos-1b') IT[1].tempo = '1b';
  var abre = { 'comandos-1': 'b', 'comandos-1b': 'b', 'comandos-2': 'a', refutado: '' }[E] || '';
  if (E === 'bloqueado') IT[0].tempo = 'blq';
  var itens = (vazia || nm) ? [] : IT;
  var LINHA = "cd ~/Workspace/bythiagofigueiredo && npm run -s obs:arquivo | ssh forja 'bash -s'";
  var mais = itens.length ? Math.max.apply(null, itens.map(function(i){ return i.dias; })) : 0;

  function faixa(d){ return d >= 60 ? 'vm' : d >= 30 ? 'am' : ''; }
  function forma(d){ return d >= 60 ? 'oct' : d >= 30 ? 'tri' : 'arq'; }

  /* ---------------------------------------------------------------- a barra de idade: 0 a 60 dias, cortes em 30 e 60 */
  function idade(i){
    var f = faixa(i.dias), pct = Math.min(100, Math.round(100 * i.dias / 60));
    return '<p class="p7-id">' + ic(forma(i.dias)) + '<span><b class="m-num">há ' + pl(i.dias, 'dia', 'dias') + '</b> esperando os comandos' + '' + '</span></p>' +
      '<div class="p7-age ' + f + '" role="img" aria-label="' + i.dias + ' dias de 60; âmbar a partir de 30 e vermelho a partir de 60"><i style="width:' + pct + '%"></i><b class="t30"></b><b class="t60"></b><u class="z">0</u><u class="u30">30</u><u class="u60">' + (i.dias > 60 ? '60+ dias' : '60 dias') + '</u></div>';
  }

  /* ---------------------------------------------------------------- "Ver os comandos": uma linha só, fixa, igual nos três tempos (fatos do Yannis); o tempo muda só o título e a régua */
  function cmd(i){
    var sujeito = i.tipo === 'com' ? 'comentários de ' + i.mes : 'registros de ' + i.mes;
    var etapas, trava = '', titulo, corpo;
    var ET = [['Copiar a versão nova', 'Copiar'], ['Verificar no NAS', 'NAS'], ['Conferir o B2', 'B2'], ['Apagar as antigas', 'Apagar']];
    function reg(feitos){ return ET.map(function(e, k){ return [k < feitos ? 'ok' : 'pont', e[0], e[1]]; }); }
    if (i.tempo === 'blq') {
      etapas = reg(3);
      titulo = 'A cópia nova está verificada, mas apagar as antigas de ' + i.mes + ' está indisponível agora.';
      corpo = M.aus('pt', 'Apagar está indisponível: veja o aviso acima da lista. <b>Não há linha para rodar agora.</b>');
    } else {
      if (i.tempo === 1) {
        etapas = reg(0);
        titulo = 'Primeiro, copiar a versão nova dos ' + sujeito + '.';
        trava = M.aus('pt', 'Os passos de apagar as cópias antigas aparecem depois que a cópia nova for verificada no NAS e conferida no B2. <b>Falta verificar a cópia nova.</b>');
      } else if (i.tempo === '1b') {
        etapas = reg(2);
        titulo = 'A forja não conseguiu conferir o B2 em 02/05.';
        trava = M.aus('pt', 'Os passos de apagar as cópias antigas aparecem depois que a cópia nova for conferida no B2. <b>Falta conferir o B2 de novo.</b>');
      } else {
        etapas = reg(3);
        titulo = 'A cópia nova está verificada. A linha abaixo apaga a cópia antiga dos ' + sujeito + '.';
      }
      corpo = '<ol class="p7-pas"><li>No Mac, rode esta linha: <span class="p7-sh"><pre><code>' + esc(LINHA) + '</code></pre><button type="button" class="btn small" data-copiar="' + i.id + '" aria-label="Copiar a linha do passo 1">Copiar</button></span></li>' +
        '<li>Confira a última linha que apareceu: tem de começar com <code>OBS-ARQUIVO:</code>. Se não começar, nada rodou.</li>' +
        '<li>Espere: a página confirma sozinha em até 24 horas' + (i.tempo === 2 ? ', e o item sai da lista' : '') + '.</li>' +
        '<li>Rodou a linha? <button type="button" class="btn" data-rodei="' + i.id + '">Já rodei</button></li></ol>' + trava;
    }
    return '<div class="p7-cmd" id="cmd-' + i.id + '"' + (abre === i.id ? '' : ' hidden') + '><h4>' + titulo + '</h4>' + M.regua(etapas, 'Etapas dos comandos') + corpo + '</div>';
  }

  /* ---------------------------------------------------------------- um item que espera o dono */
  function cls(i){ return 'p7-it ' + faixa(i.dias); }
  function dentro(i){
    var f = faixa(i.dias);
    var st = i.tipo === 'com'
      ? 'Há uma cópia antiga dos comentários de ' + i.mes + ', substituída em ' + i.desde + '. Passou a esperar você em ' + i.pede + ': veja os comandos.'
      : 'Apagado do site em ' + i.desde + '. Há cópia no arquivo: 1 espera você rodar os comandos';
    var lembrete = f === 'vm' ? '<p class="p7-lemb">Passou de 60 dias: é só um lembrete. Quando puder, abra «Ver os comandos» e rode a linha.</p>' : '';
    var refut = (E === 'refutado' && i.id === 'b')
      ? '<div class="p7-refut">' + M.aus('am', 'Você marcou que rodou em 02/05, mas a verificação de hoje ainda encontra no NAS os registros de «' + esc(i.t) + '». <b>O item voltou para a lista.</b> A idade continua contando desde 30/03.') + '</div>' : '';
    var aberto = abre === i.id;
    return '<div><p class="p7-k">' + i.k + ' · ' + esc(i.de) + '</p><h4 id="t-' + i.id + '">' + esc(i.t) + '</h4>' +
      '<p class="p7-st">' + ic('arq') + '<span>' + st + '</span></p>' + lembrete + '</div>' +
      '<div class="p7-side">' + idade(i) + '<div class="p7-ac"><button type="button" class="btn" data-cmd="' + i.id + '" aria-expanded="' + (aberto ? 'true' : 'false') + '" aria-controls="cmd-' + i.id + '">' + (aberto ? 'Esconder os comandos' : 'Ver os comandos') + '</button></div></div>' +
      refut + cmd(i);
  }
  function item(i){ return '<li class="' + cls(i) + '" id="it-' + i.id + '" aria-labelledby="t-' + i.id + '">' + dentro(i) + '</li>'; }

  /* ---------------------------------------------------------------- frase-resumo (proposta do plano, 11.8) */
  function resumo(){
    var corpo;
    if (vazia) return '<div class="p7-res zr">' + ic('zero') + '<p><b>Nenhum item espera você rodar comandos.</b><small>Última conferência do arquivo: hoje, às 07:10.</small></p></div>';
    if (nm) return '<div class="p7-res nm"><span class="m-hach" role="img" aria-label="não medido"></span><p><b>Não foi possível ler se há cópia no arquivo.</b> Os itens abaixo, que esperam a sua resposta, não foram comparados com o arquivo.<small>Isto não quer dizer que não há cópia. A leitura é refeita na próxima verificação. Última leitura em 02/05: 3 itens, o mais antigo há 62 dias.</small></p></div>';
    var n = itens.length;
    var iid = 'i-p7-res';
    corpo = '<b>' + (n === 1 ? '1 item espera' : n + ' itens esperam') + ' você rodar os comandos;</b> o mais antigo há ' + pl(mais, 'dia', 'dias') + '. ' + ib(iid, 'Por que esta lista pode ser longa') + infoBox(iid, 'Os registros de um vídeo apagado só saem do arquivo quando você roda o comando; nenhuma rotina apaga por prazo. A idade conta desde que o item pediu o comando. Âmbar a partir de 30 dias e vermelho a partir de 60: são lembretes, não perda. Rodar a linha de novo é sempre seguro. Quem só edita o site vê o resumo e a idade, sem os comandos. Spec 04, seção 14.7 (L388-400).');
    return '<div class="p7-res">' + ic(forma(mais)) + '<div><p>' + corpo + '</p><p class="p7-esp">Esperar não perde nada: nenhum dado do site depende desta lista. As cópias antigas só continuam no NAS e no B2 até você rodar a linha, e somem uns 45 dias depois de você rodar.</p><p class="p7-esp">De fora do país, a linha funciona com o Tailscale ligado no Mac e a forja ligada.</p></div></div>';
  }

  /* ---------------------------------------------------------------- os itens que esperam resposta (a fila de hoje, sem mudança), com o "apagar" bloqueado num dos casos */
  function aviso(){
    return M.aus('pt', '<b>Setembro de 2027 saiu das telas e o espaço dele ainda não foi liberado.</b> Enquanto isso não dá para remover canal nem apagar vídeo. O espaço só pode ser liberado a partir de 08/05; até lá, o que dá para fazer é trazer o mês de volta. <a href="arquivo.html">Abrir o Arquivo</a> ' + ib('i-p7-blq', 'Por que não dá para apagar agora') + infoBox('i-p7-blq', 'Enquanto o mês pode voltar ao banco, apagar deixaria, na volta, registros dele sem vídeo a que pertencer. O item fica na fila e não conta prazo. Spec 04, L270 e L393. Quem só edita o site vê a mesma frase sem o link, com “peça a quem administra o site”.'));
  }
  function resposta(){
    var blq = E === 'blq' || E === 'bloqueado';
    function linha(t, sub, bt){
      return '<li class="p7-resp' + (blq ? ' blq' : '') + '"><div><p class="p7-k">' + sub + '</p><h4 class="p7-rt">' + esc(t) + '</h4></div>' +
        '<div class="p7-ac"><button type="button" class="btn">Manter para análise</button>' + (blq ? '' : '<button type="button" class="btn danger">' + bt + '</button>') + '</div>' +
        (blq ? '<p class="m-ausente pt p7-indisp">Apagar indisponível: veja o aviso acima.</p>' : '') + '</li>';
    }
    return '<h3 class="p7-gt">Esperam a sua resposta (2)</h3><ul class="p7-ls">' +
      linha('O truque do Wi-Fi que os hotéis escondem', 'Vídeo · Lucas Bigodinho · não veio mais do YouTube desde 28/04 (5 dias)', 'Apagar o vídeo…') +
      linha('Paddy Doyle', 'Canal inteiro · não veio mais do YouTube desde 20/04 (13 dias)', 'Apagar o canal…') + '</ul>' +
      '<p class="p7-fim">Estes dois itens são a tela de hoje, sem mudança. Os já respondidos (2) ficam recolhidos logo abaixo, como hoje.</p>';
  }

  /* ---------------------------------------------------------------- a página */
  var casos = [['cheia', 'Fila com 3 comandos'], ['comandos-1', 'Comandos: copiar (falta verificar a cópia nova)'], ['comandos-1b', 'Comandos: falta conferir o B2'], ['comandos-2', 'Comandos: apagar as antigas'], ['refutado', '“Já rodei” refutado'], ['bloqueado', '“Apagar” bloqueado por mês fora das telas'], ['vazia', 'Nada a rodar (zero medido)'], ['nm', 'Não foi possível ler (não medido)']];
  var nav = '<header class="m-obs"><h1>Observatório</h1><nav aria-label="Telas do Observatório"><a href="#" onclick="return false">Canais</a><a href="#" onclick="return false">Vídeos</a><a href="#" onclick="return false">Arquivo</a><a href="#" onclick="return false" aria-current="page">Saíram do YouTube<span class="p7-chipn" aria-label="' + (vazia ? 2 : 5) + ' itens">' + (vazia ? 2 : 5) + '</span></a></nav><div class="m-fresh"><span class="m-chip">Banco 15%</span></div></header>';
  var lista = itens.length ? '<h3 class="p7-gt p7-gt2">Esperam você rodar os comandos (' + itens.length + ')</h3><ul class="p7-ls">' + itens.map(item).join('') + '</ul>' : '';
  document.body.innerHTML = M.mock('Peça 7 · ' + (casos.filter(function(c){ return c[0] === E; })[0] || casos[0])[1], [M.grupo('Situação', 'e', casos, E)], 'Peça 7 do plano (PLANO-DAS-TELAS seção 9; spec 04 L388-400), sobre a tela E do lote 1. Hoje = 03/05/2028; nomes, datas e comandos são de exemplo. “Ver os comandos” e “Já rodei” funcionam; o resto é estático. Os dois itens de baixo são a fila de hoje, sem mudança.') +
    nav + '<main id="m-main"><div class="p7-sel"><h2 class="m-h2 p7-h2">Saíram do YouTube</h2><span class="m-selo">ajuste de mockup aprovado: E, 13/10/2026 · peça 7 nova</span></div>' +
    '<aside class="m-aviso">Peça 7: o bloco “Esperam você rodar os comandos” e a frase-resumo são novos; o resto da tela é o de hoje.</aside>' +
    M.legenda(false) + resumo() + (E === 'bloqueado' ? aviso() : '') + resposta() + lista + '<div class="p7-sr" id="p7-live" role="status"></div></main>';
  /* quem faz cada etapa da régua (Logan C4): sem cor nova */
  Array.prototype.forEach.call(document.querySelectorAll('.p7-cmd .m-reg'), function(r){ Array.prototype.forEach.call(r.querySelectorAll('li'), function(li, k){ var q = document.createElement('span'); q.className = 'p7-quem'; q.textContent = (k === 0 || k === 3) ? 'você' : 'sozinho'; (li.querySelector('.m-rl') || li).appendChild(q); }); });

  function fala(t){ var l = document.getElementById('p7-live'); if (l) l.textContent = t; }
  function achar(id){ return IT.filter(function(x){ return x.id === id; })[0]; }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-cmd]');
    if (b) { var p = document.getElementById('cmd-' + b.getAttribute('data-cmd')), h = p.hasAttribute('hidden'); if (h) p.removeAttribute('hidden'); else p.setAttribute('hidden', ''); b.setAttribute('aria-expanded', String(h)); b.textContent = h ? 'Esconder os comandos' : 'Ver os comandos'; return; }
    var c = e.target.closest && e.target.closest('[data-copiar]');
    if (c) {
      var code = c.parentNode.querySelector('code'), ok = function(){ c.textContent = 'Copiado'; fala('Comando copiado'); setTimeout(function(){ c.textContent = 'Copiar'; }, 2000); };
      var sel = function(){ var r = document.createRange(); r.selectNodeContents(code); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); c.textContent = 'Selecione e copie'; fala('Selecione e copie o comando'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code.textContent).then(ok, sel); else sel();
      return;
    }
    var r = e.target.closest && e.target.closest('[data-rodei]');
    if (r) {
      var id = r.getAttribute('data-rodei'), it = achar(id), li = document.getElementById('it-' + id);
      li.className = 'p7-it';
      li.innerHTML = '<div style="grid-column:1/-1" class="p7-marc" tabindex="-1"><h4 id="t-' + id + '">' + esc(it.t) + ': marcado como rodado em 03/05</h4>' +
        M.aus('pt', 'Volte em até 24 horas: se houver mais um passo, ele aparece aqui. Se a verificação seguinte não achar a mudança no arquivo, o item volta para a lista. <button type="button" class="btn small" data-desfaz="' + id + '">Desfazer</button>') + '</div>';
      fala(it.t + ': marcado como rodado'); li.querySelector('.p7-marc').focus();
      return;
    }
    var d = e.target.closest && e.target.closest('[data-desfaz]');
    if (d) { var i2 = d.getAttribute('data-desfaz'), l2 = document.getElementById('it-' + i2), x = achar(i2); abre = ''; l2.className = cls(x); l2.innerHTML = dentro(x); fala('Marcação desfeita'); l2.querySelector('[data-cmd]').focus(); }
  });
})();
