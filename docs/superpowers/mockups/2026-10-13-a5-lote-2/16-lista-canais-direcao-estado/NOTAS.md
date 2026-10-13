# Mockup 16: Lista de Canais com direção, estado e filtros (notas, 13/10/2026)

Abrir: `cd` nesta pasta, `python3 -m http.server <porta 47710-47790> --bind 127.0.0.1`, `index.html`. O seletor "Estados do mockup" no topo (fora da tela simulada) troca o caso, o filtro de estado e o tema. Os botões de filtro e de nicho **dentro** da tela também funcionam. `medidas.json` tem rolagem, fontes menores que 12 px, alvos menores que 44 px e a altura das linhas de cada captura. `shots/` tem cada caso a 1440 escuro e a 390 claro.

Todo número e todo canal é exemplo (marca "números de exemplo" na barra de ferramentas). Nada vem do dono. Arquivos: `lista.js` (tela), `lista-dados.js` (canais de exemplo e regras de M3a e M8), `lista.css`; `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` são cópias do lote 1, sem edição.

## Casos (parâmetro `?caso=`)

| Caso | O que mostra |
|---|---|
| `tipico` | Hoje, 13/10/2026, 15 canais. Direção existe; **"em queda" ainda não pode ser medido** (chip com hachura, frase com a data 14/12). Faixa avisa que até 19/10 a janela cruza a mudança de contagem de 24/08. |
| `completo` | 15/12/2026 (exemplo de depois da primeira leitura limpa). Frase: "2 canais parados, 4 subindo, 5 descendo (1 em queda sustentada)." |
| `extremo` | 15/12: nada subindo, 4 parados, 3 em queda (um deles parado **e** em queda), 1 que saiu do YouTube, 1 em erro, 1 sem vídeos, 1 com inscritos ocultos, queda de -78%, 14,2 mi de inscritos, nome de 60 caracteres. |
| `zero` | Nenhum parado nem em queda: os quatro chips e as casas da barra viram caixa vazada com 0 (zero medido). |
| `magro` | 11 canais com menos de 56 dias: direção "não medido, fecha em dd/mm"; frase "medida em 4 de 15". |
| `erro` | 2 canais em erro (a linha do lote 1, 141 px, sem redesenho). |
| `fora` | 1 canal que saiu do YouTube em 04/10 (linha esmaecida, sem link para o YouTube; a aba "Saíram do YouTube" do lote 1 aparece com o contador). |
| `carregando` | Esqueleto; direção "em branco tracejado", nunca hachura (carregar não é "não medido"). |
| `leitura` | Usuário só de leitura: aviso logo abaixo dos botões do cabeçalho, "Sincronizar agora", "Mais ações" e os botões do cabeçalho desligados com o motivo. |
| `muitos` | 78 canais, 20 por vez com "Mostrar mais 10", filtro por nicho (Viagem, IA, Humor) com contagem. |
| `?filtro=queda` em `tipico` | Vazio **explicado** (hachura: ainda não pode ser medido, com a data e os dias que faltam). |
| `?dir=up\|eq\|dn\|nm` | Filtro por direção (as casas da barra são botões). `zero&dir=dn` mostra o vazio com zero medido. |
| `?filtro=parados` em `zero` | Vazio com **zero medido** ("Nenhum canal parado", caixa 0). |

## 1. Decisões de desenho e por quê

1. **Uma coluna nova (Direção) e uma linha de estado sob o nome do canal.** Duas colunas novas estourariam os 1176 px (já estourava por 68 px no pior caso; fechou depois de enxugar larguras e tirar a palavra da célula). A linha em erro do lote 1 fica onde estava (coluna Sincronização + botão na coluna de ações) e mede 141 px a 1440.
2. **Direção = quadrado cheio com ▲ ＝ ▼ + percentual + régua + os dois números.** A régua vai de -50% a +50%, com a faixa tracejada "sem mudança" entre -10% e +10% e a barra saindo do zero; passou do limite, a ponta vira triângulo. Dá para comparar linhas de relance sem ler. Os dois números ("2.171 mil × 1.840 mil") são a base escrita linha a linha; o **percentual é calculado sobre os números exibidos** (lição do lote 1).
3. **Frase-resumo + barra de quatro casas** (subindo, sem mudança, descendo, não medido), sempre as quatro, mesmo com 0. Cada casa leva símbolo, número e a **palavra por extenso logo abaixo** (a cor e o glifo nunca falam sozinhos), e é um botão que filtra a lista por direção. A frase e a barra usam as mesmas palavras: "descendo" é o ▼ do período; "em queda sustentada" é só a regra de 3 períodos. Zero é caixa vazada; não medido é hachura rosa; carregando é tracejado cinza.
4. **Cor só de direção para direção.** Verde = subindo, âmbar = descendo **e parado e em queda** (regra 6.1.9), neutro = sem mudança. Nunca vermelho. Fora do ar e erro usam a família do erro (borda e ícone; texto em `--text`). A forma separa os estados que dividem a cor: pausa (parado) x quadrado com ▼ (em queda) x círculo com X (fora do ar) x triângulo (erro) x contorno pontilhado (sem vídeos) x hachura (inscritos ocultos).
5. **Uma pastilha por canal (a pior).** Precedência: saiu do YouTube, sem vídeos, parado, em queda, ativo. Parado e em queda ao mesmo tempo: pastilha de parado + "Também em queda." (duas pastilhas estourariam os 155 px). "Ativo" não tem pastilha, só "Ativo, publicou há N dias" em cinza: o normal fica quieto, e o número é o que o dono usa para desconfiar de um "parado".
6. **"Em queda" antes de 14/12.** O chip mostra a hachura no lugar do número e a frase diz a data. Mostrar 0 diria "nenhum canal em queda", o que seria falso (a regra não pode rodar ainda). Pergunta 1 abaixo.
7. **Faixa da base** (uma linha, com legenda dos quatro símbolos) fica sobre a tabela; o método vai no ⓘ (no resumo e no cabeçalho da coluna). Quando a janela cruza a mudança de 24/08, uma segunda linha com ícone de aviso diz até quando.
8. **Filtros de estado** como grupo de botões com `aria-pressed`, contagem em mono e o mesmo símbolo da pastilha, **dentro do mesmo bloco da frase e da barra** (a resposta fica num lugar só; a busca e os alternadores vêm depois). Filtro de estado e de direção somam (E). O filtro do lote 1 ("Em erro") entra no mesmo grupo, em vez de ficar sozinho.
9. **A 390 px a linha vira cartão** de 346 a 400 px (475 com erro): nome, estado, caixa de Direção em largura total (a régua ocupa a largura toda), seis números em três colunas, sincronização. Sem rolagem horizontal. Em desktop a palavra da direção ("subindo") fica só para leitor de tela; no cartão aparece.
10. **Quem saiu do YouTube não some da lista:** pastilha "Saiu do YouTube em dd/mm" (o nome aprovado no lote 1), linha esmaecida, borda esquerda de erro, sem link para o YouTube, "Última leitura em dd/mm" no lugar de "Sincronizado", direção "não medido: saiu do YouTube em dd/mm". A aba "Saíram do YouTube" do lote 1 aparece com o contador, e o filtro de estado usa o mesmo nome.
11. **Nicho** é o filtro do cabeçalho, agora interativo, com contagem; o filtro de estado soma por cima. A frase e as contagens seguem o nicho escolhido.
12. **Só leitura:** esta lista só tem números públicos, então não há número privado para esconder. O que muda é o que o usuário pode fazer, e a tela diz isso em uma frase, logo abaixo dos botões desligados.
13. **Botão "Sincronizar agora" do erro** fica dentro da coluna Sincronização, empilhado sob a pastilha, nas duas larguras (como o cartão de 390 já fazia). A coluna Ações tem 48 px em todos os casos e a lista não muda de proporção entre estados.
14. **Espaço da tag "+ novo" acima do botão do erro (r2, B1):** 10 px de margem no desktop (a 390 px continuam 20 px). A tag e o tracejado ficam acima da última linha de texto da célula, sem cobrir o aviso de e-mail. A linha em erro vai de 143 para 153 px, dentro dos 132 a 155 aceitos. Casas da barra têm a mesma altura (rótulo alinhado ao topo) e os números da frase não quebram no meio ("3 descendo" fica junto).

## 2. Tabela de frases (texto exato)

| Onde | Texto |
|---|---|
| Frase-resumo, típico | **2 canais parados**, **5 subindo**, **3 descendo**. Em queda sustentada (3 períodos de 28 dias seguidos) só dá para medir a partir de **14/12**. |
| Frase-resumo, completo | **2 canais parados**, **4 subindo**, **5 descendo** (**1 em queda sustentada**). |
| Frase, extremo | **4 canais parados**, **7 descendo** (**3 em queda sustentada**), nenhum subindo. **1 canal saiu do YouTube** em 04/12. **1 canal em erro**. |
| Frase, zero | Nenhum canal parado, descendo ou em queda sustentada; **8 subindo**. |
| Frase, magro | **2 canais parados**. Direção medida em **4 de 15** canais. Em queda sustentada: só a partir de **14/12**. (As datas em que os 10 fecham ficam sob a casa "não medido": "fecham de 17/10 a 26/11".) |
| Frase, com nicho | "Em IA: 1 canal parado, 7 subindo. ..." |
| Frase em carregando | Contando os canais e lendo a direção de cada um… |
| Casas da barra (texto visível e leitor de tela) | "subindo", "sem mudança", "descendo", "não medido" sob cada casa; leitor: "N subindo" etc., botão com `aria-pressed` ("filtro ligado" quando ativo). Pressionada: anel de 2 px e "×" depois da palavra. |
| Filtros | Todos, Parados, Em queda, Saíram do YouTube, Em erro (grupo "Filtrar canais por estado"). Em queda antes de 14/12: leitor de tela ouve "não medido até 14/12". |
| Faixa da base | **Direção:** views dos últimos 28 dias contra os 28 anteriores, cada canal contra ele mesmo. Legenda: "subindo, +10% ou mais", "sem mudança", "descendo, -10% ou menos", "não medido, com o motivo". |
| Aviso da faixa (até 19/10) | Até **19/10** os 56 dias cruzam a mudança de contagem de 24/08/2026. |
| Cabeçalho da coluna | Direção ⓘ / views, 28 dias × 28 anteriores. Canal: "nicho, inscritos, estado". |
| ⓘ (rótulos do botão) | "Como a direção é calculada" (cabeçalho), "Como o resumo e o estado são calculados" (resumo). |
| Célula Direção | `▲ +18%` (palavra "subindo" só no cartão e no leitor de tela) / régua / "2.171 mil × 1.840 mil" (leitor de tela: "2.171 mil views nos últimos 28 dias, contra 1.840 mil nos 28 anteriores"). |
| Direção não medida | pastilha "não medido" + um dos motivos: "fecha em dd/mm" (menos de 56 dias); "saiu do YouTube em dd/mm"; "sem views nos 56 dias para comparar"; seu canal: "o YouTube não dá esse número do seu canal; ainda não é guardado" (S4; com data de início, "o Observatório começa a guardar o seu em dd/mm"). |
| Pastilha ativo | Ativo, publicou há N dias |
| Pastilha parado | Parado há N dias sem publicar; apoio: "Publica a cada N dias." (ou "Sem ritmo medido: passou de 28 dias.") |
| Pastilha em queda | Em queda sustentada; apoio: "3 períodos de 28 dias." |
| Parado e em queda | pastilha de parado + "▼ Também em queda." |
| Pastilha saiu do YouTube | Saiu do YouTube em dd/mm; apoio: "Sem resposta do YouTube em 2 leituras." |
| Pastilha sem vídeos | Sem vídeos; apoio: "Ainda não publicou nada." Ritmo, Views/dia e Outliers viram "não medido". |
| Inscritos ocultos | pastilha hachurada "inscritos ocultos" no lugar do número; Crescimento vira "não medido: oculto". Nunca um 0. |
| Sincronização, saiu do YouTube | Última leitura em dd/mm |
| Erro | Os textos do lote 1 (tela C), sem mudança: "Em erro há N dias", motivo, e-mail, "Sincronizar agora". |
| Vazio, em queda antes de 14/12 | **Em queda ainda não pode ser medido.** Essa leitura pede 3 períodos de 28 dias seguidos depois da mudança de contagem de 24/08/2026. O primeiro dia possível é 14/12/2026, daqui a 62 dias. Até lá, só dá para ver quem está descendo (▼) neste período: 3 canais. [Ver todos os 15 canais] |
| Vazio, zero medido | Nenhum canal parado / em queda / que saiu do YouTube / em erro / subindo / sem mudança / descendo / sem direção medida. Frases de apoio: "Todos os 15 canais publicaram dentro do prazo habitual de cada um." / "Nenhum canal ficou com ▼ por 3 períodos de 28 dias seguidos." / "O YouTube respondeu por todos os canais nas duas últimas leituras."; direção: "Nenhum dos 15 canais perdeu 10% ou mais de views neste período." / "Todos os canais sincronizaram na última rodada." |
| Vazio, nicho | Nenhum canal neste nicho. Os canais acompanhados em X aparecem aqui quando você adiciona um. |
| Cabeçalho da coluna (r2, M2) | "Views/dia ▼" com espaço sem quebra: o triângulo nunca fica sozinho numa linha; o subtítulo "mediana nos longos" quebra por conta própria. Texto igual ao da r1. |
| Paginação | Mostrando 20 de 78 canais. [Mostrar mais 10] |
| Só leitura (sobe para logo abaixo dos botões do cabeçalho) | **Você só pode ler esta lista.** Sincronizar, adicionar e remover canais ficam desligados. Esta lista só tem números públicos do YouTube, então você vê tudo o que os outros veem. |

## 3. Dúvidas para o dono (e o padrão adotado)

1. **"Em queda" antes de 14/12:** mostrar hachura (não medido) e a data, ou esconder o chip até 14/12? **Adotei:** o chip fica, com hachura, e o vazio explica. Esconder faria a funcionalidade parecer quebrada.
2. **"Saiu do YouTube" e o erro 404 do lote 1 são o mesmo fato** (o YouTube diz que o canal não existe). **Adotei:** o nome do lote 1 ("Saiu do YouTube em dd/mm", aba "Saíram do YouTube"), em vez de "fora do ar" do spec 6.5b; duas leituras seguidas sem o canal viram essa pastilha e deixam de ser "em erro"; erro de verdade (demora, cota) continua na escada do lote 1. A tela C mostra 404 com "Remover canal…": no lugar disso entra a pastilha e a ação vai para o "Mais ações". Confirma o fato e o nome?
3. **Canal parado e em queda ao mesmo tempo:** a pastilha é de parado e a queda vira uma frase curta; o filtro "Em queda" **inclui** esse canal (a contagem dos filtros pode somar mais que o total). Ou prefere uma regra que o tire?
4. **Sem views para comparar** (canal sem vídeos): hoje "não medido: sem views nos 56 dias para comparar". Não está na lista fechada de motivos de 6.1.5; precisa entrar nela?
5. **Seu canal na lista:** a direção dele é "não medido: contagem pública por dia do seu canal ainda não é guardada" (decisão 12.1/R4). Aceita o texto, ou prefere esconder a célula?
6. **Direção ao lado de Crescimento** (inscritos, 30 dias, ▲ ▼ em texto simples da produção): são duas medidas diferentes com os mesmos símbolos. **Adotei:** a Direção usa quadrado cheio e régua, o Crescimento fica como está, e o título da coluna diz "views". Se confundir, o Crescimento perde o ▲ ▼.
7. **Parado x "＝"** (NC do spec, "parado" do dono é o "＝" ou o estado de M8?): desenhei os dois, como no lote 1: "＝" neutro (cinza) na Direção e "parado" âmbar no Estado. Falta a resposta.
8. **75 canais ou mais:** a cota da tela diz "78 de 120 canais" (hoje a produção diz "x de 20"). Quando o limite subir? Paginação de 10 em 10 é a dívida aceita do lote 1.

## 4. O que o implementador precisa saber

- **Regras:** direção = views ganhas em 28 dias ÷ 28 anteriores (`competitor_channel_snapshots.view_count`); ▲ >= +10%, ▼ <= -10%, ＝ no meio, **sobre os números exibidos** (3 algarismos; veja `D.vis` em `lista-dados.js`). Parado: dias desde a última publicação > max(28, 4 × intervalo habitual). Em queda: três janelas de 28 dias seguidas com M3(a) <= -10%; só existe a partir de 14/12/2026. Saiu do YouTube ("fora do ar" no spec): `channels.list` sem o canal em duas leituras (`missing_since`).
- **Altura de linha:** 86 a 121 px (típico), 143 px (erro e extremo, com o botão agora sob a pastilha), 151 px (só leitura), 137 px (saiu do YouTube). Tudo dentro dos 132 a 155 aceitos.
- **Larguras a 1440:** a tabela fecha só com a palavra da direção escondida (fica para leitor de tela), `max-width: 88px` nos subtítulos de coluna, preenchimento lateral de 4 px, Ações em 48 px e a coluna Sincronização com mínimo de 228 px no erro; mexer em uma coluna exige refazer a conta (extremo é o caso mais apertado: 0 px de folga).
- **Zero x não medido x carregando:** `0` em caixa vazada (`--im-zero`), hachura rosa, tracejado cinza. Nunca trocar um pelo outro; um canal sem os 56 dias NÃO é zero.
- **Classe `.nm` não pode ser usada como contêiner** (traz `white-space: nowrap`, borda e preenchimento): foi o bug que mais deu trabalho aqui. Use `.nm` só na pastilha.
- **Acessibilidade:** a tabela vira cartão por CSS (`display: grid`), o que tira a semântica de tabela em leitor de tela; na produção, usar a semântica de lista ou `role` explícito nos cartões. Filtros são `button` com `aria-pressed`; o foco volta ao botão depois de refiltrar (veja `montar()`); a régua é `role="img"` com texto por extenso; o resumo diz a contagem por extenso na barra (`aria-label`).
- **Nunca verificado:** leitor de tela, Safari, Opera e a ordem de teclado completa (a mesma dívida do lote 1).
- **O bloco de resumo do erro do lote 1** (com a escada de três idades) não foi redesenhado aqui; na tela real ele continua acima da barra. Aqui só entram o contador no filtro e a linha na faixa de frescor.
- **Dívida herdada, não piorada:** botão "Sincronizar agora" em duas linhas a 1440 (como no lote 1); as abas do Observatório rolam por dentro a 390 px (como na produção), a página não rola.
- **Contraste:** nenhum texto abaixo de 4,5:1 nos casos típico, extremo, magro, erro e zero, nos dois temas (medido no navegador, cor composta sobre o fundo composto).

## 5. Resposta à revisão r1 (13/10/2026)

Evidência: `shots/caso-*` refeitas (1440 escuro e 390 claro, todos os casos, mais `tipico-dir-subindo`, `zero-dir-descendo`, `extremo-dir-subindo`); `medidas.json` refeito (17 casos x 4 cruzamentos: rolagem da página 0, rolagem da tabela 0, fonte abaixo de 12 px 0, alvo abaixo de 44 px a 390 0). Linhas a 1440: típico 86 a 121 px; erro 143; só leitura 151; extremo 143; fora 137 (todas dentro dos 132 a 155 ou abaixo).

| Item | Resposta |
|---|---|
| B1 | Feito. Cada casa da barra tem a palavra por extenso embaixo (subindo, sem mudança, descendo, não medido; zero medido mantém a caixa vazada, com a palavra). A frase usa as mesmas palavras e separa "descendo" (▼ no período) de "em queda sustentada" (3 períodos): "2 canais parados, 5 subindo, 3 descendo. Em queda sustentada (...) só dá para medir a partir de 14/12." Completo: "...5 descendo (1 em queda sustentada)". A legenda da faixa da base ficou como segunda chave. Glifo e número subiram para 16 px (S6). |
| C1 | Feito. Botão "Sincronizar agora" empilhado sob a pastilha de erro, na coluna Sincronização (como o cartão de 390); Ações com 48 px em todos os casos; par de números da Direção com `nowrap` (a 1440). Ajuste fino para a tabela caber nos casos extremos: preenchimento lateral das células 5 para 4 px e nome do canal com mínimo de 186 px. Medido a 1440: Views/dia 73 a 92 px (contra 70 a 90), título em 3 linhas no máximo. |
| C2 | Feito. A aba "Saíram do YouTube" com contador aparece em `fora` e `extremo` (e em qualquer caso com canal fora). Nome único: "Saiu do YouTube em dd/mm" na pastilha, na frase, no chip do cabeçalho, na direção e no filtro ("Saíram do YouTube"). A divergência com o spec 6.5b ("fora do ar") está na dúvida 2 para o dono. |
| C3 | Feito, tela e ⓘ: "depois da mudança de contagem de 24/08/2026. O primeiro dia possível é 14/12/2026, daqui a 62 dias." |
| C4 | Feito. Margem de 20 px a 390 acima do botão do erro: a tag "+ novo" e o tracejado não tocam mais na linha do e-mail. **Correção na r2:** a 1440 a margem de 18 px nunca valeu (a regra `.ls-t .er-bn`, mais abaixo, a zerava) e a tag cobria 8 px da linha do e-mail; a afirmação "conferido" valia só para 390. Ver a seção 6. |
| C5 | Feito. O aviso "Você só pode ler esta lista..." sobe para logo abaixo dos botões do cabeçalho, antes do chip de frescor e das abas, nas duas larguras. |
| C6 | Feito pelo primeiro caminho do revisor, como proposta marcada para o dono: as casas viram botões de filtro por direção (`aria-pressed`, alvo 44 px, anel + "×" quando ligado, vazio com zero medido por direção). É um acréscimo ao spec (que pede só "parados" e "em queda"): se o dono não quiser, a barra volta a ser desenho sem ação. Nota de hierarquia: a linha de filtros de estado agora está dentro do bloco da frase e da barra, antes da busca. |
| S1 | Feito: o ⓘ diz a escala da régua (−50% a +50%), a faixa tracejada (−10% a +10%) e a ponta em triângulo. |
| S2 | Feito: a frase do magro fica com "Direção medida em 4 de 15 canais" e a queda; as datas dos 10 canais vão para a casa "não medido" ("fecham de 17/10 a 26/11"); "o seu canal ainda não entra" já está na célula dele e no ⓘ. |
| S3 | Feito: "nicho, inscritos, estado", sem a palavra "e" sozinha (cabeçalho do canal sem limite de largura). |
| S4 | Feito: "o YouTube não dá esse número do seu canal; ainda não é guardado" (sem data de início definida, a versão com data fica anotada na tabela de frases). |
| S5 | Feito: barras do esqueleto e das casas em carregamento com um degrau a mais de contraste. |
| S6 | Feito junto com B1 (16 px). |
| S7 | Sem mudança: segue na dúvida 6; Direção e Crescimento continuam separados por três colunas. |
| S8 | Feito: a tabela de referência vira cartões a 390 px (sem corte à direita). |
| S9 | Mantidas as dúvidas 1, 3, 5, 7 e 8 para o dono, junto com a 2 (agora também o nome) e a nova 9 abaixo. |

9. **Filtro por direção (C6):** as casas da barra filtram a lista (subindo, sem mudança, descendo, não medido). Fica? Com 78 canais é a única forma de ver só os que sobem. O spec pede só os filtros "parados" e "em queda".

## 6. Resposta à revisão r2 (13/10/2026)

Evidência: `shots/caso-*` refeitas (17 casos, 1440 escuro e 390 claro) e `r3-medidas.json` (17 casos x 4 cruzamentos: tag sobre o texto do e-mail, tag da aba sobre o acento, altura das casas, título "Views/dia", altura de linha, rolagem). Resultado: sobreposição da tag com o texto do e-mail 0 px em `erro`, `extremo`, `muitos&nicho=IA`, `leitura`, nas duas larguras (era 8 px a 1440); linhas a 1440 de 85 a 153 px (`leitura` 151, `fora` 137, `tipico` 121); rolagem horizontal 0 px em todos; casas da barra com a mesma altura em cada caso (61 px a 1440, 77 ou 93 px a 390). Abri as capturas de `extremo` (tag e botão), da aba "Saíram do YouTube", do cabeçalho "Views/dia" e do resumo a 390 (`magro` e `tipico`).

| Item | Resposta |
|---|---|
| B1 | Feito, com uma correção ao diagnóstico: a margem de 18 px da r1 nunca chegou ao desktop, porque `.ls-t .er-bn{margin:0 2px}` (mesma força, mais abaixo) a anulava; a margem real era 0. Em vez de 28 px (que levaria a linha a 171 px, acima dos 155 aceitos), o ajuste é de 10 px em `div.er-bn.er-bn-m` a partir de 701 px, o suficiente para a tag e o tracejado ficarem acima do e-mail (sobreposição medida 0 px) e a linha em erro ir a 153 px. O botão desligado do `leitura` (um `span`, sem tag) fica como estava, 151 px. Frase "conferido" da r1 corrigida na seção 5. |
| M1 | Feito: a tag "+ novo" da aba "Saíram do YouTube" sobe 9 px (de `top:-2px` para `-11px`); medido: 4 px de folga acima do texto, acento de "Saíram" visível. |
| M2 | Feito: "Views/dia&nbsp;▼" no cabeçalho; o título fica em 1 linha (19 px) com a coluna de 83 a 94 px, e o cabeçalho continua com 89 px. |
| M3 | Feito, nas duas larguras (não só a 390): as casas esticam até a mais alta da barra e o rótulo fica no topo. A 390: 77 px (93 px no `magro`, que tem a data embaixo de "não medido"), em vez de 61, 77 e 93 misturados. Alvo continua acima de 44 px. |
| M4 | Feito: as partes em negrito da frase (`N subindo`, `N descendo`, `N canais parados`, `N em queda sustentada`) não quebram no meio. A aba "Saíram do YouTube" fora da primeira tela a 390 px segue como no lote 1 (as abas rolam por dentro); o chip do cabeçalho e a frase cobrem o aviso. |
| Observação do revisor (▼ âmbar em dois sentidos) | Mantida como decidida (regra 6.1.9): a palavra separa "descendo" de "em queda sustentada". Se houver confusão em uso real, o chip ganha uma segunda marca; fica anotado, sem mudança de desenho. |
