/* peca9.js: delta da M9b no bloco "Canais removidos" (plano 2026-10-30-manutencao-nas-m9b-canal, Task 4). Seis itens, cada um com todos os estados lado a lado.
   ?so=<id> mostra um item só (é o que o quadro de 390 px carrega num iframe)   ?tema=claro  ?cinza=1
   Hoje = 03/05/2028. Todo nome, número, data e comando é de exemplo. */
(function(){
  'use strict';
  var ic = M.ic, esc = M.esc, aus = M.aus, ib = M.ib, infoBox = M.infoBox;
  var SO = M.Q('so', ''), N = 0;
  var LINHA = "cd ~/Workspace/bythiagofigueiredo && npm run -s obs:arquivo | ssh forja 'bash -s'";
  var NOME = 'Viagem Lenta: o mochilão de 14 meses pela Ásia Central, sem avião e sem pressa';
  var ETAPAS = [['Limpeza pedida', 'Pedida'], ['Apagado do NAS', 'NAS'], ['Snapshots do NAS (14 dias)', 'Snapshots'], ['Apagado do B2', 'B2']];
  function id(p){ return p + (++N); }
  function info(txt, rot){ var i = id('p9i'); return ib(i, rot) + infoBox(i, txt); }

  /* a régua: f = forma de cada uma das 4 etapas; o 4º item marca problema (triângulo/octógono) */
  function reg(f){ return M.regua(ETAPAS.map(function(e, k){ return [f[k], e[0], e[1], f[k] === 'tri' || f[k] === 'oct']; }), 'Etapas da limpeza do arquivo do canal'); }
  var V = 'ok', P = 'pont';
  function idadeF(d){ return d >= 60 ? 'oct' : d >= 30 ? 'tri' : 'arq'; }
  function idadeC(d){ return d >= 60 ? 'vm' : d >= 30 ? 'am' : ''; }

  /* o painel único "Ver os comandos" (extraído da peça 7; o mesmo componente nas duas telas) */
  function painel(pid, titulo, aberto){
    return '<div class="p7-cmd" id="' + pid + '"' + (aberto ? '' : ' hidden') + '><h4>' + titulo + '</h4><ol>' +
      '<li>No Mac, rode esta linha: <span class="p7-sh"><pre><code>' + esc(LINHA) + '</code></pre><button type="button" class="btn small" data-p9="copiar" aria-label="Copiar a linha do passo 1">Copiar</button></span></li>' +
      '<li>Confira a última linha que apareceu: tem de começar com <code>OBS-ARQUIVO:</code>. Se não começar, nada rodou.</li>' +
      '<li>Se a última linha disser NÃO TERMINOU e citar RESTA, sobrou arquivo no canal. A tela não enxerga isso. Siga a seção «Sobrou arquivo no canal» do runbook. ' + info('A pasta do canal no NAS não ficou vazia. Nada foi apagado a mais. O que sobrou fica 30 dias em quarentena e se resolve sozinho; a linha, rodada de novo, diz o que falta.', 'O que é RESTA') + '</li>' +
      '<li>Espere: a página confirma sozinha em até 24 horas. Rodar a linha de novo é sempre seguro.</li></ol>' +
      '<p class="m-st" role="status" aria-live="polite"></p></div>';
  }
  function btn(pid, aberto){ return '<button type="button" class="btn small" data-p9="cmd" aria-expanded="' + !!aberto + '" aria-controls="' + pid + '">Ver os comandos</button>'; }

  /* uma linha do bloco (.m-can). o = {sub, al, forma, frase, sec, steps, cmd:'', aberto, adm:false} */
  function linha(o){
    var pid = id('p9c'), adm = o.adm !== false, temCmd = !!o.cmd && adm;
    var forma = o.forma || '';
    var lead = (forma === 'nm' ? '<span class="m-hach" role="img" aria-label="não medido"></span> ' : '') + o.frase;
    var sec = o.sec ? '<span class="p9-sec">' + (o.secIc || ic('arq')) + '<span>' + o.sec + '</span></span>' : '';
    return '<li class="m-can' + (o.al ? ' ' + o.al : '') + '"><div class="m-cn" title="' + esc(NOME) + '">' + esc(o.nome || NOME) + '<small>' + o.sub + '</small></div>' +
      '<p>' + lead + sec + '</p>' + reg(o.steps) +
      '<div class="m-ac">' + (temCmd ? btn(pid, o.aberto) : '') + '</div>' + (temCmd ? painel(pid, o.cmd, o.aberto) : '') + '</li>';
  }
  function rot(t){ return '<li class="p9-rot" aria-hidden="true">' + t + '</li>'; }
  function lista(itens){ return '<ul class="p9-lista">' + itens.join('') + '</ul>'; }
  var TIT_PEDIDO = 'Para limpar o arquivo de Viagem Lenta, rode uma linha no Mac.';

  /* ------------------------------------------------------------ 1. Ver os comandos do canal */
  function it1(){
    var s0 = function(d){ return [idadeF(d), P, P, P]; };
    return lista([
      rot('Pedido há 5 dias, painel aberto (o botão fecha o painel; quem só edita não vê botão)'),
      linha({ sub: 'removido em 28/04/2028', al: idadeC(5), steps: s0(5), cmd: TIT_PEDIDO, aberto: true,
        frase: 'Limpeza pedida há 5 dias. <b>Falta você rodar a linha no Mac</b> (ver os comandos). Se você já rodou, a confirmação chega em até 24 horas; não precisa avisar. Passadas as 24 horas, rode a mesma linha de novo: ela mostra o que falta.' }),
      rot('Pedido há 34 dias (âmbar) e há 63 dias (vermelho): o mesmo painel, a mesma frase'),
      linha({ sub: 'removido em 31/03/2028', al: idadeC(34), steps: s0(34), cmd: TIT_PEDIDO,
        frase: 'Limpeza pedida há 34 dias. <b>Falta você rodar a linha no Mac</b> (ver os comandos). Se você já rodou, a confirmação chega em até 24 horas; não precisa avisar. Passadas as 24 horas, rode a mesma linha de novo: ela mostra o que falta.' }),
      linha({ sub: 'removido em 01/03/2028', al: idadeC(63), steps: s0(63), cmd: TIT_PEDIDO,
        frase: 'Limpeza pedida há 63 dias, mais de 60. <b>Falta você rodar a linha no Mac</b> (ver os comandos). Se você já rodou, a confirmação chega em até 24 horas; não precisa avisar. Passadas as 24 horas, rode a mesma linha de novo: ela mostra o que falta.' }),
      rot('Arquivo reapareceu depois de apagado (octógono, mesmo painel)'),
      linha({ sub: 'removido em 12/02/2028', al: 'vm', steps: [V, V, V, 'oct'], cmd: 'Para limpar de novo o arquivo de Viagem Lenta, rode uma linha no Mac.',
        frase: 'O arquivo do canal reapareceu em 01/05/2028, depois de apagado. <b>Falta você rodar a linha de novo</b> (ver os comandos).' }),
      rot('Sem a linha lida (a leitura das pendências falhou): sem botão, nunca painel vazio'),
      linha({ sub: 'removido em 28/04/2028', forma: 'nm', steps: [idadeF(5), P, P, P], cmd: '',
        frase: 'Limpeza pedida há 5 dias. Não foi possível ler a linha dos comandos; recarregue a página.' }),
      rot('Quem só edita (sem permissão de administrar o site): frase e nenhum botão'),
      linha({ sub: 'removido em 28/04/2028', adm: false, steps: s0(5), cmd: TIT_PEDIDO, frase: 'Limpeza pedida há 5 dias. Espera quem administra o site rodar a linha.' }),
      rot('Flag da limpeza desligada: sem comando, diz quando'),
      linha({ sub: 'removido em 28/04/2028', steps: s0(5), cmd: '', frase: 'Limpeza pedida há 5 dias. Espera o comando, que ainda não tem data para chegar.', forma: 'pont' }),
      rot('Você marcou "Já rodei" na peça 7: só leitura aqui, sem botão (o botão e o Desfazer ficam na peça 7)'),
      linha({ sub: 'removido em 28/04/2028', steps: s0(5), cmd: TIT_PEDIDO,
        frase: 'Limpeza pedida há 5 dias. Falta a confirmação do site, em até 24 horas.', secIc: ic('pont'), sec: 'Você marcou que rodou em 02/05; a confirmação chega em até 24 horas.' })
    ]) + '<p class="p9-nota">Item 5 (decisão do plano, Logan e Naksu de acordo): "Já rodei" fica só no painel da peça 7. A linha do canal ganha apenas a frase de leitura acima, quando o site já tem a marca.</p>';
  }

  /* ------------------------------------------------------------ 2. A ordem da régua: NAS, snapshots, B2 */
  function it2(){
    return lista([
      rot('Apagado do NAS, snapshots ainda guardando: espera, sem comando, sem idade'),
      linha({ sub: 'removido em 10/04/2028', steps: [V, V, 'pont', P], forma: 'pont',
        frase: 'Apagado do NAS em 24/04/2028. Aguardando os snapshots do NAS. <b>Espere até 08/05.</b> ' + info('O NAS guarda cópias diárias por 14 dias e 8 horas. Enquanto elas existirem, o arquivo ainda está no NAS, e o B2 só pode ser apagado depois.', 'Por que esperar') }),
      rot('Sem a data de liberação (nula): nunca "hoje" nem "0 dias"'),
      linha({ sub: 'removido em 10/04/2028', steps: [V, V, 'nm', P], forma: 'nm',
        frase: 'Apagado do NAS em 24/04/2028. Os snapshots ainda guardam o arquivo; a data em que expiram não foi lida. Nada a fazer agora.' }),
      rot('Pendências não lidas: hachura (não medido), sem comando'),
      linha({ sub: 'removido em 10/04/2028', steps: [V, V, 'nm', P], forma: 'nm',
        frase: 'Apagado do NAS em 24/04/2028. Aguardando os snapshots do NAS; a data não foi lida. A leitura é refeita na próxima carga.' }),
      rot('Snapshots não conferidos (snapBloqueio): triângulo âmbar, sem comando'),
      linha({ sub: 'removido em 10/04/2028', al: 'am', steps: [V, V, 'tri', P],
        frase: 'Apagado do NAS em 24/04/2028. Os snapshots do NAS não puderam ser conferidos: peça para olhar a conferência dos snapshots.' }),
      rot('Prazo dos snapshots cumprido (conferir_b2): volta o comando, idade conta de novo'),
      linha({ sub: 'removido em 20/03/2028', al: idadeC(36), steps: [V, V, V, 'tri'], cmd: 'Os snapshots do NAS já expiraram. Falta apagar Viagem Lenta do B2: rode a mesma linha.',
        frase: 'Apagado do NAS em 05/04/2028 e prazo dos snapshots cumprido. <b>Falta apagar no B2:</b> rode a linha de novo (ver os comandos).' }),
      rot('B2 ainda lista arquivos (c6): âmbar; a saída da linha imprime os nomes a apagar no painel do B2'),
      linha({ sub: 'removido em 20/03/2028', al: 'am', steps: [V, V, V, 'tri'], cmd: 'Para apagar do B2 as versões que sobraram de Viagem Lenta, rode a mesma linha.',
        frase: 'O B2 ainda lista 7 arquivos deste canal (conferido em 02/05/2028). Rode a linha de novo (ver os comandos): ela imprime <code>B2-PAINEL: &lt;nome&gt;</code> para cada arquivo. Se o painel do B2 só os escondeu, apague as versões antigas por lá.' }),
      rot('Apagado do B2: sua parte terminou (a frase "falta só o prazo dos snapshots" saiu)'),
      linha({ sub: 'removido em 20/03/2028', steps: [V, V, V, V], forma: 'ok',
        frase: 'Apagado do NAS e do B2 em 01/05/2028. Sua parte terminou. O site conclui a limpeza sozinho; não há mais nada a rodar.' }),
      rot('Apagado do B2, e a confirmação final não chegou (c9): âmbar'),
      linha({ sub: 'removido em 20/03/2028', al: 'am', steps: [V, V, V, 'tri'],
        frase: 'Apagado do NAS e do B2 em 20/04/2028, e a confirmação final ainda não chegou: peça para olhar a conferência do B2.' })
    ]) + '<p class="p9-nota">Ordem nova: pedida, NAS, snapshots (14 dias), B2. O estado "prazo não medido no fim" (antigo c8) deixou de existir. Rótulo curto a 390 px: Pedida, NAS, Snapshots, B2. Verificado no SQL: apagado_b2 só ocorre depois do prazo dos snapshots. Sinal do âmbar c9: apagado_b2, completed_at nulo e mais de 24 horas desde o fim.</p>';
  }

  /* ------------------------------------------------------------ 3. Estados com falta */
  function it3(){
    var imgs = function(t){ return t; };
    return lista([
      rot('lote_e10: o lote exportado à mão ainda está aberto; a limpeza espera, sem botão'),
      linha({ sub: 'removido em 28/04/2028', forma: 'pont', steps: [idadeF(5), P, P, P],
        frase: 'O lote que você exportou à mão deste canal ainda está aberto. Termine-o antes: a limpeza espera. ' + info('É o arquivo que você gerou no Mac para guardar este canal. Ele fica no Mac e no NAS até você apagá-lo.', 'O que é o lote exportado à mão') }),
      rot('blobs: arquivo apagado, imagens ainda no Blob (linha secundária, o site tenta de novo)'),
      linha({ sub: 'removido em 20/03/2028', steps: [V, V, V, V], forma: 'ok',
        frase: 'Apagado do NAS e do B2 em 01/05/2028. <b>Sua parte terminou.</b> A limpeza do arquivo espera as imagens saírem do Blob.',
        secIc: ic('pont'), sec: '412 imagens do canal ainda não foram apagadas do Blob; o site tenta de novo (desde 01/05/2028). ' + info('O Blob é onde ficam as imagens do site. O site apaga sozinho, aos poucos. Não há comando seu.', 'O que é o Blob') }),
      linha({ sub: 'removido em 20/03/2028', al: 'am', steps: [V, V, V, V],
        frase: 'Apagado do NAS e do B2 em 12/04/2028. <b>Sua parte terminou.</b>',
        secIc: ic('tri'), sec: '412 imagens do canal ainda não foram apagadas do Blob há 21 dias; o comando que as apaga ainda não tem data para chegar.' }),
      rot('imagens: o site não anotou quais imagens são do canal e não há aceite (só existe em linha montada à mão): hachura, "peça para olhar"'),
      linha({ sub: 'removido em 28/04/2028', forma: 'nm', steps: [idadeF(5), P, P, P],
        frase: 'O site não anotou quais imagens deste canal estão no Blob; a limpeza espera o seu aceite, que ainda não foi dado. Peça para olhar; a limpeza espera.' }),
      rot('so_prefixo: só restam pastas vazias; a linha as limpa'),
      linha({ sub: 'removido em 20/03/2028', forma: 'pont', steps: [V, V, V, 'arq'], cmd: 'Só restam pastas vazias de Viagem Lenta no NAS: rode a mesma linha.',
        frase: 'Só restam pastas vazias do canal no NAS; a próxima linha que você rodar as limpa (ver os comandos).' }),
      rot('Leitura das pendências falhou: nunca vira "sem falta"'),
      linha({ sub: 'removido em 28/04/2028', forma: 'nm', steps: [idadeF(5), P, P, P],
        frase: 'O que falta não foi lido; a leitura é refeita na próxima carga.' })
    ]) + '<p class="p9-nota">RESTA (arquivo desconhecido na pasta do canal) não existe na tela: é saída de terminal e o canal fica em "pedido". É o ponto onde a tela pode ficar em verde sem estar. A defesa é a idade (âmbar a 30 dias, vermelho a 60) e o passo 3 do painel, com o "i". Nenhum estado novo foi inventado para ele.</p>' + imgs('');
  }

  /* ------------------------------------------------------------ 4. Erro do clique e ja_pedido */
  function dlgBase(estado, aviso, opts){
    opts = opts || {};
    var enviando = estado === 'env';
    var st = enviando ? '<p class="p9-st" role="status">' + ic('pont') + '<span>Enviando o pedido…</span></p>' : '';
    return '<div class="m-dlg" role="group" aria-label="Apagar do arquivo: ' + esc(estado) + '"><div class="m-dlg-b"><h2>Apagar do arquivo os 14 meses de Viagem Lenta?</h2>' +
      '<p class="t"><b>Não dá para desfazer.</b> Os 14 meses (de 10/2026 a 11/2027) saem do arquivo e podem ser a única cópia dos registros deste canal.</p>' +
      '<p class="t">Para continuar, digite o nome do canal:</p><p class="t p9-nome"><b>Viagem Lenta</b></p>' +
      '<label for="' + id('p9n') + '">Nome do canal</label><input type="text" value="Viagem Lenta"' + (enviando ? ' readonly' : '') + ' autocomplete="off">' + (aviso ? '<div class="p9-av">' + aus('am', aviso).replace('<p class="m-ausente am"', '<p role="alert" tabindex="-1" class="m-ausente am"') + '</div>' : '<p class="m-st" role="status">Nome confirmado.</p>') + st +
      '</div><div class="m-dlg-a"><button type="button" class="btn danger"' + (enviando ? ' aria-disabled="true"' : '') + '>' + (enviando ? 'Apagando…' : 'Apagar do arquivo') + '</button><button type="button" class="btn"' + (enviando ? ' aria-disabled="true"' : '') + '>Cancelar</button></div></div>';
  }
  function fig(cap, html){ return '<figure><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function it4(){
    var E = [
      ['Enviando: botão "Apagando…", campo travado, Cancelar e Esc desligados', dlgBase('env')],
      ['sem_permissao', dlgBase('sem_permissao', 'Só quem administra o site pode apagar do arquivo. A limpeza não foi pedida.')],
      ['desligado', dlgBase('desligado', 'A limpeza de canal está desligada agora. A limpeza não foi pedida.')],
      ['nome_nao_confere (só chega se o cliente burlou o botão)', dlgBase('nome', 'O nome do canal mudou desde que você abriu esta janela. Feche e abra de novo. A limpeza não foi pedida.')],
      ['canal_nao_encontrado', dlgBase('canal', 'Este canal não está mais na lista; outra pessoa pode ter pedido a limpeza. Feche e atualize a página. A limpeza não foi pedida por aqui.')],
      ['forma e interno', dlgBase('interno', 'Não deu para pedir a limpeza agora. A limpeza não foi pedida; tente de novo em alguns minutos. Se repetir, avise quem cuida do site.')],
      ['Rede caiu ou a action lançou erro (a resposta se perdeu)', dlgBase('rede', 'Não sabemos se a limpeza foi pedida. Recarregue a página antes de tentar de novo.')]
    ];
    var ok = '<div class="p9-res">' + aus('pt', 'Limpeza pedida para Viagem Lenta.') + '</div>';
    var ja = aus('pt', 'Este canal já estava com a limpeza pedida; a linha foi atualizada.');
    return '<div class="p9-dlgs">' + E.map(function(e){ return fig(e[0], e[1]); }).join('') +
      fig('Sucesso: o diálogo fecha, a página recarrega a lista e a região de status diz isto. O foco vai ao título da linha (tabindex -1), porque o botão sumiu', ok) +
      fig('ja_pedido não é erro: mesmo fechamento, frase própria, sem triângulo', ja) + '</div>' +
      '<p class="p9-nota">Em todo erro: o diálogo fica aberto, o nome digitado fica, o foco vai ao aviso (role=alert, âmbar, nunca vermelho: nada foi apagado ou o estado é incerto) e o botão volta ativo. Só a rede caída não afirma "não foi pedida": manda recarregar antes de tentar de novo, para não virar dois cliques.</p>';
  }

  /* ------------------------------------------------------------ 5. Já rodei: nada na linha do canal (ver item 1); aqui a regra e a prova de que o painel é um só */
  function it5(){
    return '<div class="p9-dlgs">' +
      fig('Painel no bloco do canal (este mockup)', painel('p9x', 'Para limpar o arquivo de Viagem Lenta, rode uma linha no Mac.', true)) +
      fig('Painel na peça 7 (aprovado): o mesmo componente, com o botão "Já rodei" e o Desfazer só lá', '<div class="p7-cmd"><h4>Para limpar o arquivo de Viagem Lenta, rode uma linha no Mac.</h4><ol><li>No Mac, rode esta linha: <span class="p7-sh"><pre><code>' + esc(LINHA) + '</code></pre><button type="button" class="btn small" data-p9="copiar" aria-label="Copiar a linha do passo 1">Copiar</button></span></li><li>Espere: a página confirma sozinha em até 24 horas.</li><li>Rodou a linha? <button type="button" class="btn">Já rodei</button></li></ol></div>') +
      '</div><p class="p9-nota">A pendência vive uma vez só: dois botões para o mesmo registro abririam a dúvida "marquei no lugar certo?". O bloco do canal tem a frase "Se você já rodou, a confirmação chega em até 24 horas; não precisa avisar", que tira a necessidade de marcar.</p>';
  }

  /* ------------------------------------------------------------ 6. Frase do lote da E10 */
  function dlgE10(sd){
    var lote = aus('am', 'O lote que você exportou à mão fica no Mac e no NAS. Apagar do arquivo não o apaga: apague-o você.');
    var blob = aus('am', 'O site não anotou, na remoção, quais imagens deste canal estão no Blob e não consegue apagá-las. Elas continuam lá depois que o arquivo for apagado.');
    var cod = '7F3A91C2';
    return '<div class="m-dlg" role="group"><div class="m-dlg-b"><h2>' + (sd ? 'Apagar do arquivo os 9 meses do código ' + cod + '?' : 'Apagar do arquivo os 14 meses de Viagem Lenta?') + '</h2>' +
      '<p class="t"><b>Não dá para desfazer.</b> ' + (sd ? 'Os 9 meses (de 10/2026 a 06/2027) saem do arquivo e podem ser a única cópia.' : 'Os 14 meses (de 10/2026 a 11/2027) saem do arquivo e podem ser a única cópia dos registros deste canal.') + '</p>' +
      lote + (sd ? blob : '') + '<p class="t">Para continuar, digite ' + (sd ? 'o código deste arquivo: <b class="m-num">' + cod + '</b>' : 'o nome do canal: <b>Viagem Lenta</b>') + '</p>' +
      '<label for="' + id('p9e') + '">' + (sd ? 'Código do arquivo' : 'Nome do canal') + '</label><input type="text" autocomplete="off"><p class="m-st" role="status">Digite ' + (sd ? 'o código' : 'o nome do canal') + ' para continuar.</p></div>' +
      '<div class="m-dlg-a"><button type="button" class="btn danger" aria-disabled="true">Apagar do arquivo</button><button type="button" class="btn">Cancelar</button></div></div>';
  }
  function it6(){
    var ja = '<details class="p9-ja" open><summary>' + ic('arq') + 'Já limpos (5)</summary><div>' +
      '<ul><li>Canal de Receitas da Vó: limpo em 12/03/2028</li><li>Trilhas do Sul: limpo em 02/02/2028</li><li>Viagem Lenta: limpo em 20/01/2028</li><li>Mochilão Barato: limpo em 15/01/2028</li><li>Estrada sem Mapa: limpo em 03/12/2027</li></ul>' +
      '<p class="p9-sec">' + ic('arq') + '<span>2 desses canais tinham lote exportado à mão; ele continua no Mac e no NAS: apague-o.</span></p></div></details>';
    return '<div class="p9-dlgs">' + fig('c-apagar, canal que veio de e10_export (o aviso do lote aparece só nesse caso)', dlgE10(false)) +
      fig('c-apagar-sd, com as duas condições: o aviso do lote vem primeiro (é ação sua), o do Blob depois (é espera do site)', dlgE10(true)) + '</div>' +
      '<div class="p9-ja-w">' + ja + '</div>' +
      '<p class="p9-nota">O canal concluído vai direto para "Já limpos", então a frase mora no &lt;details&gt;, uma linha só quando algum limpo veio de e10_export. Ela não some com o tempo: nada sustenta uma regra de 90 dias. A tela não enxerga o Mac, então a frase é neutra e não cobra com âmbar nem idade; o resumo fechado já leva a marca de arquivo ao lado do número.</p>';
  }

  /* ------------------------------------------------------------ a página */
  var ITENS = [
    ['i1', 'Item 1: "Ver os comandos" do canal', 'substitui CMDHTML, c1, c2, c3, c5, c6, c12', it1],
    ['i2', 'Item 2: ordem da régua, NAS, snapshots, B2', 'substitui c5, c7, c8, c9', it2],
    ['i3', 'Item 3: estados com falta e RESTA', 'novo', it3],
    ['i4', 'Item 4: erro do clique e ja_pedido', 'diálogo c-apagar', it4],
    ['i5', 'Item 5: "Já rodei" no canal', 'decisão: só na peça 7', it5],
    ['i6', 'Item 6: frase do lote da E10', 'c-apagar, c-apagar-sd, Já limpos', it6]
  ];
  function mobil(i){
    var q = new URLSearchParams(location.search); q.set('so', i);
    return '<div class="p9-mob"><b>390 px de largura (a mesma página, em quadro de verdade)</b><iframe title="Item a 390 px" src="?' + q.toString() + '" data-i="' + i + '" loading="lazy"></iframe></div>';
  }
  var corpo = ITENS.filter(function(x){ return !SO || x[0] === SO; }).map(function(x){
    return '<section class="m-q" id="q-' + x[0] + '"><header class="m-q-h"><span class="m-q-id">' + x[0].toUpperCase() + '</span><h3 class="m-q-t">' + x[1] + '</h3><span class="m-q-f">' + x[2] + '</span></header><div class="m-q-b">' + x[3]() + (SO ? '' : mobil(x[0])) + '</div></section>';
  }).join('');
  if (SO) document.body.classList.add('p9-so');
  document.body.insertAdjacentHTML('beforeend', '<main class="p9-wrap"><h1>Canais removidos: o que muda na M9b</h1>' +
    (SO ? '' : '<p>Só o que o mockup aprovado não cobria. Mesmos componentes, mesmos tokens, mesma régua de formas. Cada item mostra os estados lado a lado, com texto longo; o quadro de 390 px é a página real num iframe. Tema e cinza: acrescente ?tema=claro ou ?cinza=1 ao endereço.</p>') + corpo + '</main>');
  if (SO && window.parent !== window) {
    var avisa = function(){ parent.postMessage({ p9h: document.documentElement.scrollHeight, i: SO }, '*'); };
    addEventListener('load', avisa); addEventListener('resize', avisa); document.addEventListener('click', function(){ setTimeout(avisa, 50); });
  }
  addEventListener('message', function(e){ if (!e.data || !e.data.p9h) return; var f = document.querySelector('iframe[data-i="' + e.data.i + '"]'); if (f) f.style.height = (e.data.p9h + 4) + 'px'; });

  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-p9]'); if (!b) return;
    var a = b.getAttribute('data-p9');
    if (a === 'cmd') { var p = document.getElementById(b.getAttribute('aria-controls')), ab = p.hasAttribute('hidden'); if (ab) p.removeAttribute('hidden'); else p.setAttribute('hidden', ''); b.setAttribute('aria-expanded', String(ab)); }
    if (a === 'copiar') {
      var code = b.parentNode.querySelector('code'), st = b.closest('.p7-cmd').querySelector('.m-st');
      var fim = function(t){ b.textContent = t; if (st) st.textContent = t === 'Copiado' ? 'Linha copiada.' : 'Selecione e copie a linha.'; setTimeout(function(){ b.textContent = 'Copiar'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code.textContent).then(function(){ fim('Copiado'); }, function(){ fim('Selecione e copie'); }); else fim('Selecione e copie');
    }
  });
})();
