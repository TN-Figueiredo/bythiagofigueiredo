/* index.js: a casca do mockup 19: tabela de sincronia (04 L441, §14.9), legenda única, índice de estados com a coluna "carregando" (04 L432, L552). */
(function(){
  'use strict';
  var D = window.D;
  function a(h, t){ return '<a href="' + h + '">' + t + '</a>'; }
  var ap = 'pendente';
  var SINC = [
    ['13 histórico do vídeo', 'aprovado 13/10/2026', 'Eixo com o trecho “no arquivo”; idades 2, 3, 5, 14, 21, 60 e 90 viram “no arquivo desde dd/mm”; 72 horas viram a frase (peça 8: marca e contagens, à parte)', a('series.html?e=p1-2', 'P1-2') + ', ' + a('series.html?e=p1-4', 'P1-4') + ', ' + a('series.html?e=p1-5', 'P1-5'), '1 (e 8)'],
    ['15 página do canal', 'aprovado 13/10/2026', 'Eixo “desde dd/mm” nas 72 horas, nos 90 e nos 180 dias; “Calculado com N vídeos; M estão no arquivo”', a('series.html?e=p1-4', 'P1-4') + ', ' + a('series.html?e=p1-6', 'P1-6'), '1 (e 8)'],
    ['Página do canal, vídeo, comparar e canais (07/10, pagina-canal)', 'aprovado', 'Marcas “em leitura mensal” e “No arquivo (N)”, contadores em três parcelas', 'peça 8: ainda não desenhada', '8'],
    ['20 comentários de destaque', 'aprovado 13/10/2026', 'Cartão “Comentário de mm/aaaa. O texto está no arquivo e não aparece aqui.”', a('series.html?e=p1-8', 'P1-8'), '1 (e 8)'],
    ['21 ritmo por hora', 'segurado: sem aprovação', 'Seletor de 6 e 12 meses com “Mostrando desde dd/mm” e o motivo (coleta recente ou arquivo)', a('series.html?e=p1-7', 'P1-7'), '1'],
    ['16b “Outras mudanças” e aba Trocas', 'aprovado', 'Rodapé “N trocas de vídeos que estão no arquivo”', 'peça 8: ainda não desenhada', '8'],
    ['Histórico e fixar (06/10)', 'aprovado', 'Duas frases de recusa de fixar; diálogo de remover (linha seguinte)', 'peça 8: ainda não desenhada', '8 e 3'],
    ['Histórico com muitas versões (07/10)', 'aprovado', '“N versões de título no arquivo”', 'peça 8: ainda não desenhada', '8'],
    ['17a Comparar, 17b Outliers', 'aprovados', 'Frase “N vídeos no arquivo ficaram fora da base”. A janela de 180 dias do 17a e do 17c fica a confirmar (1 dia de folga)', 'peça 8: ainda não desenhada', '1 e 8'],
    ['22 Perguntar a uma IA', 'aprovado', 'O pacote traz as mesmas frases, números e datas da tela', 'peça 8: ainda não desenhada', '8'],
    ['Diálogo de remover canal: tela Canais (06/10, canais.html)', 'aprovado, com a linha “No arquivo” em 14/10/2026', 'Linha “No arquivo”, “contando…”, nome digitado, depois do clique, casa fora', a('../remover-canal/index.html?e=d3', 'remover-canal'), '3 e item 12'],
    ['Diálogo de remover canal: mockup 18', 'sem quadro', 'O 18 não tem diálogo de remover: a remoção mora na tela Canais (menu, gaveta e linha de erro abrem o mesmo diálogo). O spec 04 (L270-271) recebe a mesma nota no próximo fecho', 'sem quadro', '3 e item 12'],
    ['Diálogo de remover canal: divergência declarada', 'aprovado 14/10/2026', 'A leitura do arquivo que falha impede a remoção; a contagem do banco que falha a mantém', a('../remover-canal/index.html?e=d5', 'remover-canal (D5)'), '3 e item 12'],
    ['18 aviso do banco, versão 18-v2', 'aprovado 14/10/2026', 'Pastilha com a regra de cor nova, segundo marcador, linha do NAS, régua com dois marcos, “Quem ocupa”', a('../../2026-10-13-a5-lote-2/18-aviso-banco-limite/18-v2.html', '18-v2'), '5'],
    ['Spec 04: “Ver os comandos” do canal removido (L225 contra L241)', 'regra do dono, 14/10/2026', 'L225 diz “o arquivo que ele gravar”; L241 dizia “cole os comandos que ele imprimir”. Vale a regra do dono: tudo chega como arquivo de comandos mais uma linha curta que o roda, nunca como comando para colar. A frase do canal removido diz “rodar o arquivo que ele gravar”; o spec recebe a mesma troca no fecho', a('arquivo.html?e=c-comandos', 'C-COMANDOS'), '2 e 7'],
    ['Fila “Saíram do YouTube” (lote 1, tela E)', 'aprovado', '“Ver os comandos” em dois tempos; “apagar” bloqueado por mês fora das telas', 'peça 7: ainda não desenhada', '7 e 3'],
    ['Faixa de frescor do Observatório (L.obs)', 'aprovada nos mockups acima', 'Chip “automático desligou” e a marca “N canais removidos pedem um comando seu”. A casca das telas deste mockup mostra a pastilha e o chip de hoje', 'peça 4: ainda não desenhada', '4 e item 12'],
    ['Arquivo (página nova, no Observatório)', 'nova', 'Frase-resumo, linhas da casa, canais removidos, três tipos de dado com a régua de etapas, dado de teste', a('arquivo.html', 'arquivo.html'), '2'],
    ['Tirar o mês (diálogos e botões)', 'novo', 'Condições, simulação, confirmações, dois passos, trazer de volta', a('arquivo.html?e=todos-tirar', 'peça 3'), '3'],
    ['19 (este mockup)', 'novo', 'Os quadros das peças 1, 2 e 3 (as peças 4, 6, 7 e 8 vêm depois)', 'esta pasta', 'todas']
  ];
  var P1 = [['p1-0', 'Nada saiu ainda'], ['p1-1', '“desde dd/mm” junto do número'], ['p1-2', 'Medida precisa de ponto que saiu: “no arquivo”'], ['p1-3', 'Mês destacado, espaço não liberado'], ['p1-4', 'O gráfico alcança o arquivo'], ['p1-5', 'As 72 primeiras horas no arquivo'], ['p1-6', 'Normal do canal com menos vídeos'], ['p1-7', 'Período maior que o online'], ['p1-8', 'Comentário em destaque sem texto'], ['p1-9', 'Mês no arquivo que estava vazio'], ['p1-10', 'Antes do começo da coleta'], ['p1-11', 'Não medido: desde quando há dado online'], ['p1-12', 'Só leitura']];
  var T3 = [['t1', 'Desabilitado'], ['t2', 'Simulação'], ['t3', 'Habilitado'], ['t4', 'Confirmação'], ['t4a', 'Confirmação em dois passos'], ['t4b', 'Quarta saída em diante'], ['t4c', 'Comentários, frase digitada'], ['t5', 'Durante'], ['t6', 'Recusado na hora'], ['t7', 'Primeiro passo feito'], ['t7a', 'Depois dos 7 dias'], ['t8', 'Segundo passo'], ['t8r', 'Segundo passo recusado'], ['t8x', 'Segundo passo repetido'], ['t9', 'Feito'], ['t10', 'Trazer de volta'], ['t11', 'Banco em somente leitura']];
  function idx(arr, pg, serv, tt){ return arr.map(function(x){ return '<tr><td data-k="Estado">' + (x[2] || x[1]) + '</td><td data-k="Quadro">' + a(pg + 'e=' + x[0], x[0].toUpperCase()) + '</td><td data-k="Carregando">' + (typeof serv === 'function' ? serv(x) : serv) + '</td></tr>'; }).join(''); }
  var carr = function(x){ return x[0] === 't2' ? 'requisição: esqueleto com a altura final' : 'servidor: sem esqueleto'; };
  var tabIdx = '<div class="m-tw"><table class="m-t"><thead><tr><th>Estado (spec 04)</th><th>Quadro</th><th>Carregando</th></tr></thead><tbody>' +
    idx(P1, 'series.html?', 'servidor, junto da série: sem esqueleto') +
    idx(D.MES.map(function(r){ return [r[0], 0, r[1]]; }), 'arquivo.html?', 'servidor: sem esqueleto') +
    idx(D.PROB.map(function(r){ return [r[0], 0, r[1]]; }), 'arquivo.html?', 'servidor: sem esqueleto') +
    idx(D.CAN.map(function(r){ return [r[0], 0, r[1]]; }), 'arquivo.html?', 'requisição: esqueleto com a altura final (quadro C-CARREGANDO)') +
    idx(T3, 'arquivo.html?', carr) + '</tbody></table></div>';
  var tabSinc = '<div class="m-tw"><table class="m-t"><thead><tr><th>Tela</th><th>Mockup aprovado e data</th><th>O que muda</th><th>Onde está o desenho</th><th>Peça</th><th>Logan</th><th>Dono</th><th>Commit</th></tr></thead><tbody>' + SINC.map(function(r){
    return '<tr><td data-k="Tela">' + r[0] + '</td><td data-k="Aprovado" class="s">' + r[1] + '</td><td data-k="O que muda">' + r[2] + '</td><td data-k="Desenho" class="s">' + r[3] + '</td><td data-k="Peça" class="s">' + r[4] + '</td><td data-k="Logan">' + ap + '</td><td data-k="Dono">' + ap + '</td><td data-k="Commit">—</td></tr>'; }).join('') + '</tbody></table></div>';
  var barra = M.mock('índice', [], 'Mockup 19 (casca): sincronia das telas aprovadas, legenda das formas e índice de estados. Todo número de mês arquivado nestes mockups é exemplo. Selo: “ajuste de mockup aprovado: &lt;número&gt;, &lt;data&gt;” em cada tela tocada.');
  document.title = 'Mockup 19: o que muda quando um mês sai do banco';
  document.body.innerHTML = barra + M.obs('arquivo', 'cheio').replace(/<nav[\s\S]*<\/nav>/, '') + '<main id="m-main"><h2 class="m-h2">O que muda quando um mês sai do banco</h2>' +
    '<p class="m-muted" style="max-width:80ch;margin:0 0 14px">Cada tela aprovada que a fase toca, antes e depois, no caso cheio simulado (03/05/2028) e no caso de hoje (14/10/2026), mais a página nova do Arquivo e a janela de tirar o mês.</p>' +
    '<p class="m-aviso"><b>Exemplo.</b> Todo número de mês arquivado é exemplo; nenhum mês saiu do banco ainda. As peças 4, 6, 7 e 8 não estão neste lote.</p>' +
    '<h3 class="m-gr">Os quadros</h3><ul class="m-lista"><li>' + a('series.html', 'Peça 1: “desde dd/mm” e “no arquivo” nas telas de série') + ' (13 quadros)</li><li>' + a('arquivo.html', 'Peça 2: a página do Arquivo') + ' (casos cheio, hoje e magro; perfis administra, edita e só lê)</li><li>' + a('arquivo.html?e=todos-tirar', 'Peça 3: tirar o mês') + ' (17 quadros, com os diálogos; na página, “Tirar” e “Liberar o espaço” abrem a janela de verdade)</li><li>' + a('../remover-canal/index.html', 'Diálogo “Remover canal”') + ' e ' + a('../../2026-10-13-a5-lote-2/18-aviso-banco-limite/18-v2.html', '18-v2') + ' (aprovados em 14/10/2026)</li></ul>' +
    '<h3 class="m-gr">Como ler as formas</h3>' + M.legenda(true) +
    '<h3 class="m-gr">Vocabulário: a exceção do spec</h3><p class="m-muted" style="max-width:80ch;margin:0 0 10px">O spec 04 (L29, L31) fixa duas expressões que a convenção do lote 2 (§1.8) proibia: <b>“snapshot(s) do NAS”</b> e <b>“lido em dd/mm”</b> (sempre com a data, junto de um número). Valem só as expressões exatas: “lido” solto, “snapshot” sem “do NAS” e “série” como rótulo de tela continuam proibidos (o rótulo é “Views por dia”). A nota está também no <code>CONVENCOES.md</code> §1.8. Um “não medido” aparece sempre com o que não foi lido, nunca como zero.</p>' +
    '<h3 class="m-gr">Tabela de sincronia</h3>' + tabSinc +
    '<h3 class="m-gr">Índice de estados</h3><p class="m-muted" style="max-width:80ch;margin:0 0 10px">Estado da seção 14.x do spec → quadro do mockup, com a coluna “carregando”.</p>' + tabIdx + '</main>';
})();
