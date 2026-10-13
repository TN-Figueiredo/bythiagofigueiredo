# Mockup 17b: Outliers ordenados por views aos 7 ou 30 dias, selo "ao vivo ou estreia" (13/10/2026)

Abrir: `cd docs/superpowers/mockups/2026-10-13-a5-lote-2/17b-outliers-v7-v30 && python3 -m http.server 8765 --bind 127.0.0.1`, depois `http://127.0.0.1:8765/index.html?caso=v7`. O seletor "Estados do mockup" (recolhido, no topo, fora da tela) troca de estado; `?ordem=mult|v7|v30` troca a ordem dentro do estado; `?tema=claro` liga o claro. O seletor "Ordenar por" da tela funciona de verdade. Tudo é exemplo (canais e números inventados). Plano: `PLANO.md`. Capturas: `shots/<estado>-1440-escuro.png` e `shots/<estado>-390-claro.png`; `shots/medidas.json` (36 medidas refeitas na rodada 2: sem rolagem horizontal, sem texto abaixo de 12 px, sem alvo abaixo de 44 px a 390).

## Estados (`?caso=`)

| Caso | O que mostra |
|---|---|
| `padrao` | Padrão (multiplicador) com as duas colunas novas e a faixa de cobertura. É o dia de hoje: 3 de 11 têm 7 dias, 0 de 11 têm 30. Tem a vizinha "Estourou e parou". |
| `v7` | Ordenado por 7 dias, hoje (o caso magro real): 3 medidos no alto, 8 no fim "Sem a medida". |
| `nao-medido` | Ordenado por 30 dias com 0 medidos: a frase diz quando a primeira fecha, régua do tempo, botão para voltar; a lista segue o multiplicador. |
| `futuro` | Ordenado por 30 dias em 20/12/2026 (exemplo marcado): 9 de 14 medidos. É o uso que a tela terá. |
| `extremo` | Ordenado por 7 dias com multiplicador de 63× (passa da régua de 50×), título e canal muito longos, 1,2 mi contra 312 views. |
| `zero` | Ordenado por 7 dias com dois vídeos de zero medido (caixa vazada com 0; dois vídeos que ficaram privados ou agendados na primeira semana), ao lado de não medido. |
| `erro` | As duas colunas novas não carregaram; o multiplicador e a ordem por multiplicador seguem. |
| `vazio` | Nenhum outlier (Shorts, até 30 dias) com a ordenação por 7 dias escolhida. |
| `leitura` | Quem só lê: igual a `v7` com o selo "Só leitura" (cadeado). Candidato a sair; ver dúvida 4. |

## Decisões de desenho e por quê

1. **A ordenação entra no seletor que já existe**, com duas opções novas; cada opção diz quantos têm a medida ("Views aos 7 dias: 3 de 11 medidos"). Quem escolhe já sabe o que vai ver, sem clicar para descobrir. O padrão continua sendo o multiplicador.
2. **Duas colunas novas na tabela de hoje** (7 dias e 30 dias), sempre visíveis, com "+ novo". Mostrar as duas mesmo ordenando por uma permite comparar uma com a outra. A coluna ordenada leva ▼ na ponta, `aria-sort` e um fundo suave; a outra fica normal.
3. **A forma de relance é a faixa de cobertura**: uma casa por outlier, na ordem exata da lista (cheia, vazada com 0, hachurada). Mostra onde a ordem deixa de valer sem ler nada. Reusa o padrão de casas do lote 1 (A). Uma faixa por idade, com "3 de 11 medidos".
4. **Motivos dos não medidos em três itens com contagem e data**: "5 antes de 03/10", "2 fecham em 16/10 e 18/10", "1 descoberto tarde". Cada célula repete o motivo curto, para a linha ser lida sozinha, e a frase longa vai no `aria-label` e no ⓘ.
5. **Régua do tempo "Quando fecham"** (só na idade ordenada, só quando alguém ainda vai fechar): de hoje até a última data, com um ◆ por vídeo. Responde "quando isso melhora?" sem texto.
6. **Quem não tem a medida fica no fim, na ordem do multiplicador**, num grupo "Sem a medida". Nunca some da lista e nunca recebe 0. Com 0 medidos, a lista nem muda de ordem: a frase e o botão "Voltar ao multiplicador (padrão)" dizem isso.
7. **Barra do número: areia neutra (`--lado-n`), linear, contra o maior da lista naquela coluna.** Laranja é "seu canal" e azul/tier são do multiplicador; verde e âmbar são direção, e ordenar não é subir nem descer. Cada coluna tem a sua escala (7 dias e 30 dias não se misturam).
8. **Multiplicador mantém a régua de hoje** (log até 50×, marcas em 2×, 5×, 10×) e ganha forma por faixa, para não depender só de cor: círculo (2× a 5×), losango (5× a 10×), estrela (10× ou mais), círculo vazado (abaixo de 2×). Acima de 50× o ponto fica no fim e o texto diz "passa de 50×".
9. **Selo "ao vivo ou estreia"**: ícone de transmissão (ponto com duas ondas), borda `--dim`, texto em `--text`, ícone na areia. Cor neutra porque não é direção nem erro. O vídeo fica na lista com o selo e a linha "não conta no normal do canal". Acima da lista, uma linha diz quantos ficaram fora do cálculo ("2 vídeos ao vivo ou estreia ficaram fora do cálculo do normal do canal; um aparece na lista com o selo").
10. **"Zero medido" e "não medido" são formas diferentes** em todo lugar: caixa vazada com 0 e a palavra "zero medido", contra a hachura rosa com "não medido" e o motivo. Nenhum 0 aparece onde o dado não veio.
11. **Erro tem forma própria**: triângulo e borda `--danger`, texto em `--text`, palavra "não carregou" (nunca "não medido", que é outra coisa). Um aviso no alto com "Tentar de novo".
12. **A leitura "Estourou e parou" (M10) só aparece como vizinha**: uma linha tracejada com a marca "vizinha" no estado `padrao`, dizendo onde entra e que a primeira só existe em 2027. Sem o texto obrigatório do M10 e sem nenhum indício desenhado, porque o desenho fecha no mockup 14.
13. **Abaixo de 900 px a linha vira cartão** com rótulo em cada número (multiplicador, views por dia, 7 dias, 30 dias, idade); a coluna ordenada leva uma barra lateral e o rótulo em negrito. A tabela mantém a semântica de tabela no desktop.
14. **ⓘ único** ao lado de "Views na mesma idade": conta, fonte (frase fixa), viés, motivos de não medido, datas em que passa a existir e a regra de ao vivo/estreia. Nada disso aparece em prosa na tela.

## Tabela de frases da tela (texto exato)

| Onde | Texto |
|---|---|
| Exemplo (hoje) | "exemplo" + "Canais, vídeos e números inventados. Hoje é 13/10/2026." |
| Exemplo (futuro) | "exemplo" + "Esta tela mostra como fica em 20/12/2026, quando as views aos 30 dias já existirem. Hoje elas ainda não existem." |
| Rótulo do seletor | "Ordenar por" |
| Opções do seletor | "Multiplicador (padrão)"; "Views aos 7 dias: N de M medidos" (ou "sem vídeos"); "Views aos 30 dias: N de M medidos"; "Views por dia"; "Mais recente". Em erro: "Views aos 7 dias (indisponível agora)" e idem 30, desabilitadas |
| Marca do seletor | "+ 2 opções novas" |
| Frase, padrão | "**11 outliers** entre **303** vídeos longos com até 90 dias, agrupados por fase." |
| Frase, ordem por idade | "Do maior para o menor número de views aos 7 dias: **3 de 11** outliers já têm essa medida; os outros **8** ficam no fim, na ordem do multiplicador." Com zero medido: "…(2 com **zero medido**)…". Singular: "**13 de 14** outliers já têm essa medida; o outro **1** fica no fim"; com 1 medido: "1 de N … já tem". Zero medidos: "(falta 1 dia)" no singular |
| Frase, 0 medidos | "**Nenhum** dos 11 outliers tem views aos 30 dias ainda: a primeira medida fecha em **03/11** (faltam 21 dias). Enquanto isso, a lista segue o multiplicador." |
| Frase, erro | "**11 outliers** entre **303** vídeos longos com até 90 dias, agrupados por fase. As views aos 7 e aos 30 dias **não carregaram** agora." |
| Frase, vazio | "**0 outliers** entre **87** Shorts com até 30 dias: nenhum passa de 2× o normal do canal." |
| Frase, views por dia / recente | "**11 outliers**, do maior para o menor número de views por dia." / "…, do mais recente ao mais antigo." |
| Linha do selo | [selo] "**2** vídeos ao vivo ou estreia ficaram fora do cálculo do normal do canal; um aparece na lista com o selo." (singular: "vídeo ao vivo ou estreia ficou fora") |
| Selo | "ao vivo ou estreia"; na linha do vídeo: "não conta no normal do canal" |
| Título da faixa | "Views na mesma idade" (ⓘ: "Como contamos as views aos 7 e aos 30 dias") |
| Rótulos da faixa | "7 dias", "30 dias"; marca da ordem atual "▼ ordem" (dica: "a lista está nesta ordem") |
| Contagem da faixa | "**3 de 11** medidos"; com zero: "**13 de 14** medidos (2 com zero medido)" |
| Motivos | "N antes de 03/10"; "N fecha em dd/mm" / "N fecham em dd/mm e dd/mm" / "N fecham de dd/mm a dd/mm"; "N descoberto tarde" / "N descobertos tarde" |
| Régua do tempo | "Quando fecham"; "hoje dd/mm"; datas |
| Legenda | "medido"; "zero medido: o vídeo tinha 0 views naquela idade"; "não medido: o motivo vem abaixo da faixa" |
| Marca da faixa e das colunas | "+ novo" |
| Cabeçalho da tabela | "Vídeo"; "Multiplicador ajustado pela idade"; "Views por dia"; "Views aos 7 dias"; "Views aos 30 dias"; "Idade"; "Ações" (só leitor de tela) |
| Grupos (padrão) | "Estourando agora" + "Até 30 dias e views por dia acima do normal do canal."; "Recentes" + "Até 90 dias."; "Sem ritmo medido" + "Canal com sincronização atrasada ou ainda buscando vídeos." |
| Grupos (ordem por idade) | "Do maior para o menor: views aos 7 dias" + "medidas"; "Sem a medida" + "ficam no fim, na ordem do multiplicador"; com 0 medidos: "Na ordem do multiplicador" + "ainda sem views aos 30 dias" |
| Célula medida | "82,4 mil" (dica: "82.400 views aos 7 dias") + barra |
| Célula zero | caixa "0" + "zero medido" |
| Célula não medido | "não medido" + "antes de 03/10" / "fecha em dd/mm" / "descoberto tarde" |
| Célula erro | "não carregou" |
| Multiplicador | "4,6×"; "contra 14 vídeos do canal"; acima de 50×: "passa de 50× · contra 14 vídeos do canal"; sem ritmo: "sem views por dia recentes" |
| Ações da linha | "Ver histórico do vídeo: {título}", "Abrir no YouTube: {título}" |
| Aviso de erro | "**Não deu para carregar as views aos 7 e aos 30 dias.** O multiplicador e a ordem por multiplicador seguem valendo; só essas duas colunas ficaram de fora." + botão "Tentar de novo" |
| Nota de 0 medidos | botão (comum, não laranja) "Voltar ao multiplicador (padrão)" + "A lista abaixo está na ordem do multiplicador porque nenhum vídeo pode ser ordenado ainda." |
| Vazio | "Nenhum outlier para ordenar" + "Sem outlier não há views aos 7 ou aos 30 dias para comparar." (o motivo "nenhum passa de 2× o normal do canal" fica só na frase de topo) + botões "Voltar ao multiplicador", "Ver vídeos longos", "Ampliar a idade para Todos" |
| Só leitura | cadeado + "**Só leitura**" + "nada nesta tela precisa de permissão para ser lido", ao lado dos filtros |
| Vizinha | "vizinha" + "Aqui entra a leitura “Estourou e parou” na linha do vídeo com 90 dias ou mais e views aos 30 dias. A primeira só existe em 2027." (a referência ao mockup 14 fica só na barra "Formas e cores", fora da tela) |
| ⓘ | Conta (interpolação linear entre as duas leituras vizinhas, mesma idade para todos); Fonte: "cálculo do Observatório sobre dados públicos do YouTube"; Viés (interpolar entre leituras espaçadas subestima a subida inicial; horário e fim de semana pesam mais aos 7 dias); Não medido (os quatro motivos); Quando passa a existir (7 dias desde 10/10/2026, 30 dias desde 02/11/2026, para os 39 vídeos publicados desde 03/10); Ao vivo ou estreia (fora do cálculo do normal do canal: as medianas de views na idade, de curva por idade e de engajamento; a palavra "mediana" só vive aqui); Zero medido (o vídeo existia e tinha 0 views naquela idade, por exemplo por ter ficado privado ou agendado; não é "não medido") |
| aria das casas | "7 dias: 3 de 11 medidos; 8 não medidos: 5 antes de 03/10, 2 fecham em 16/10 e 18/10, 1 descoberto tarde. Uma casa por vídeo, na ordem da lista." |

## Dúvidas para o dono (com o padrão adotado)

1. **Um vídeo ao vivo ou estreia pode ser outlier?** Padrão: pode; aparece na lista com o selo, com o múltiplo contra o normal do canal (que não o inclui). Alternativa: tirá-lo da lista de outliers e só contá-lo ("N ficaram fora").
2. **Barra do número: linear ou escalonada?** Padrão: linear contra o maior da lista naquela idade. Num caso extremo (`?caso=extremo`) um vídeo de 1,2 mi achata os outros e só o número os distingue. Alternativa: raiz quadrada, que mostra a ordem melhor mas deixa de ser proporcional.
3. **Os sem medida ficam no fim na ordem do multiplicador**, ou saem da lista numa seção recolhida? Padrão: no fim, visíveis, porque o dono veio do multiplicador e perder vídeo da lista dá a impressão de que ele sumiu.
4. **"Só leitura": a tela não tem número privado** (tudo é dado público de concorrente); o único estado "só leitura" que faz sentido é o do botão "Tentar de novo" (que o leitor não precisa) e dos botões de sincronizar do cabeçalho. Padrão: o estado `leitura` é igual a `v7` com um selo "Só leitura" e nenhuma coluna escondida. Se o dono confirmar que não existe, o estado sai.
5. **Nome na tela: "multiplicador" (como hoje) ou "múltiplo" (como no spec)?** Padrão: "multiplicador", que é a palavra da produção ("Multiplicador ajustado pela idade").
6. **Duas colunas novas sempre visíveis, ou só a da ordem escolhida?** Padrão: as duas, porque a faixa já as compara e o custo é só largura (a tabela cabe a 1440 sem rolagem). A 1100 px ou menos o menu some e a tabela cabe; abaixo de 900 vira cartão.

## O que o implementador precisa saber

- **Escopo da lista:** as medidas valem só para os outliers que a tela já lista (a janela de idade escolhida). "3 de 11" é "3 dos 11 outliers", não de 303 vídeos. O número 303 da frase padrão é o de hoje ("11 outliers entre 303 vídeos longos") e não muda.
- **Conta (M1):** `viewsAtAge` nas idades 7 e 30, lidas de `competitor_video_marks` (gravadas quando a idade fecha). Cada célula devolve `{ estado: 'medido', valor }` ou `{ estado: 'nao_medido', motivo, desde? }`; `zero` é `medido` com valor 0. Motivos, lista fechada do spec 6.1.5, nesta ordem de teste: descoberto tarde, antes de 03/10, idade menor que N (a data é `publicação + N`), leituras vizinhas a mais de 36 h. Este último não aparece nos dados de exemplo; ao implementar, trate-o como os outros (motivo curto sugerido: "leituras distantes").
- **Ordem:** com `v7` ou `v30`, os medidos (inclusive zero) por valor decrescente; os não medidos depois, por multiplicador decrescente. Sem nenhum medido, a ordem é a do multiplicador e a frase diz isso. A ordem entra na URL (`sort=v7|v30`) como os outros valores de `sort`; valor inválido cai no padrão e a tela avisa, como hoje.
- **Faixa de cobertura:** uma casa por vídeo da lista na ordem atual; a contagem "N de M" usa a mesma lista da tabela (não a página: com "Mostrar mais", conta a lista inteira, e a frase diz o total).
- **Ao vivo ou estreia (`was_live`):** o selo aparece na linha; o vídeo fica fora do cálculo do normal do canal (as medianas de M1, M2 e M7) e a linha acima da faixa diz quantos saíram da conta (o total do canal filtrado, não só os da lista).
- **Erro:** se a leitura das marcas falha, as duas opções ficam desabilitadas no seletor, as células mostram "não carregou" (não "não medido") e o aviso oferece "Tentar de novo". O multiplicador não depende disso.
- **Acessibilidade:** a faixa é um `role="img"` com resumo por extenso e as casas `aria-hidden`; a régua do tempo idem; cada célula de valor tem `aria-label` (zero, não medido e erro dizem o motivo); a coluna ordenada leva `aria-sort="descending"`; o seletor é um `<select>` com `<label>`; os alvos são de 44 px a 390.
- **Cabeçalho do Observatório a 390 px:** as abas empilham porque é o cabeçalho copiado do lote 1; não faz parte deste ajuste.
- **Arquivos:** `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` são cópias congeladas do lote 1; as peças desta tela são `q.css`, `q.js`, `q-dados.js` (prefixo `q-`).
- **Dado real × exemplo:** tudo é exemplo. Os números de 3 de 11, 8 sem medida e 0 de 11 aos 30 dias foram construídos para refletir o calendário real (7 dias desde 10/10; 30 dias desde 02/11; 39 vídeos desde 03/10), mas os canais, títulos e views são inventados.
- **Não verificado:** leitor de tela, Safari, Opera e a ordem de teclado completa; o revisor de UX ainda não viu esta tela.

## Resposta à revisão r1 (13/10/2026, rodada 2)

Revisão: `REVISAO-UX-r1.md`. Todos os bloqueios e correções foram atendidos; nenhuma discordância. Capturas refeitas em `shots/` (1440 escuro e 390 claro dos nove estados; `medidas.json` com os 36 cruzamentos).

| Item | Resposta |
|---|---|
| B1 | Corrigido. "sem views por dia recentes" quebra em três linhas dentro da célula (`white-space: normal`, `overflow-wrap: anywhere`) e a coluna "Views por dia" passou de 104 para 126 px, com 14 px de folga à direita (o "41,0 mil/dia" do `extremo` não encosta mais). Medida (texto e caixas dos filhos contra a célula): nenhum elemento passa da borda da sua célula em padrao, v7, nao-medido, erro, vazio, zero, extremo e leitura, em 1440 e 390, nos dois temas. |
| B2 | Corrigido. Os seis botões de ação são `<button type="button">` com o foco global (anel de 2 px). Prova: Tab a 1440 para em "Voltar ao multiplicador (padrão)" (nao-medido), "Tentar de novo" (erro) e nos três do vazio, todos com contorno sólido de 2 px. A 390 medem 225 x 44 (nao-medido), 328 x 44 (erro, largura total) e 171, 138 e 196 x 44 (vazio). O botão de nao-medido deixou de ser laranja cheio: é comum, e a frase "Nenhum dos 11 outliers…" é o que domina. No mockup só "Voltar ao multiplicador" age (leva a `?ordem=mult`); "Tentar de novo", "Ver vídeos longos" e "Ampliar a idade para Todos" são botões que não fazem nada aqui, e a tela real define o efeito. |
| C1 | Corrigido. A frase agora diz "o outro **1** fica no fim" (zero medido: `13 de 14 … o outro 1 fica no fim`) e flexiona "já tem/já têm", "outlier/outliers" e "falta 1 dia". |
| C2 | Corrigido. Até 640 px o aviso empilha: ícone e texto em cima, botão de largura total (328 x 44) embaixo. |
| C3 | Corrigido. Saiu "mediana" de toda a tela: "ficaram fora do cálculo do normal do canal" e, na linha do vídeo, "não conta no normal do canal". A palavra fica só no ⓘ. |
| C4 | Corrigido. O bloco do vazio ficou com o título e "Sem outlier não há views aos 7 ou aos 30 dias para comparar."; o motivo "nenhum passa de 2× o normal do canal" fica só na frase de topo. O seletor segue com "Views aos 7 dias: sem vídeos" porque é a ordem escolhida; o botão "Voltar ao multiplicador" é o caminho de saída. |
| C5 | Corrigido pela primeira via: o ✓ virou cadeado e a linha diz "Só leitura: nada nesta tela precisa de permissão para ser lido". O estado continua candidato a sair (dúvida 4). |
| C6 | Atendido no mínimo pedido. Abaixo de 900 px a ordem é frase, faixa, linha do selo, lista (a linha do selo desceu para depois da faixa). O cabeçalho empilhado de 700 px é do lote 1 e segue como está; a decisão de recolher a legenda fica com o dono. |
| M1 | Feito: o trilho da barra tem borda `--border-strong`. |
| M2 | Feito: a data na régua do tempo é um traço vertical (a régua do multiplicador mantém o losango). |
| M3 | Feito: a estrela de 10× ou mais é de seis pontas e não lê mais como "+". |
| M4 | Feito: no erro a célula é só o triângulo e o texto "não carregou", sem borda; o aviso do topo já diz o resto. |
| M5 | Não feito, de propósito: é conselho para o implementador. Cartão a 390 com 290 a 330 px por vídeo; o desenho aprovado mantém dois números por linha. |
| M6 | Registrado: **não há estado "carregando" nesta tela**, porque as duas colunas vêm do banco na mesma leitura que a lista; se a leitura demora, a tela inteira espera, e se falha, vale o estado `erro`. |
| M7 | Feito: os dois exemplos de zero medido passam a ser vídeos que ficaram privados ou agendados na primeira semana (e entraram depois), e o ⓘ ganhou o item "Zero medido" dizendo isso. |
| M8 | Feito: o texto da vizinha não cita mais o mockup 14; a referência está só na barra "Formas e cores desta tela", fora da tela. |
| M9 | Anotado: a cor areia (`--lado-n`) vale "medido" (casa e barra) e também é o ícone do selo e o marcador da régua. Fica assim porque o ícone é pequeno e o selo sempre leva texto; se o dono quiser uma cor por significado, o selo troca de cor. |

Itens da condição para a rodada 3 (do fim da r1): (a) transbordamento zero em todos os estados medidos; (b) todo botão recebe foco e mede 44 px a 390; (c) a frase de `zero` está no singular ("o outro 1 fica no fim").
Não verificado, como antes: leitor de tela, Safari e Opera (só Chromium).
