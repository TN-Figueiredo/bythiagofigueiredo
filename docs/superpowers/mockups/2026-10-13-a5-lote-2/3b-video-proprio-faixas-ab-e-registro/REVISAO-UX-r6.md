# Revisão de UX, rodada 6: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Material lido: `REVISAO-UX-r5.md`, `NOTAS.md` (seções 2, 3, 7, 10 e 10.1), `3b.js`, `3b-dados.js`, `coerencia.mjs`, capturas em `shots/`. Medi por conta própria, com scripts de Chromium headless sobre `file://` e o `capturar.mjs` do lote (servidor estático na porta 47761, derrubado ao fim; nada na 3099, nenhum spec do projeto): texto renderizado dos 10 estados a 1440 e a 390 (`#screen`, todos os ⓘ, tabelas "Ver como tabela"), a fala de cada dia dos dois gráficos (clicando "Dia anterior" e "Dia seguinte" do primeiro ao último dia, 10 estados), 559 rótulos "dia da semana + dd/mm" contra o calendário de 2026, a idade de cada vídeo contra "hoje", a soma de cada tabela contra a frase do gráfico, contraste de todo texto de `#screen` (4 combinações de largura e tema, 10 estados), alvos de 44 px, ⓘ aberto por Enter e fechado por Esc nas duas larguras (posição do popover, tamanho da fonte, volta do foco), regeração das 40 capturas (idênticas, byte a byte, às que estão em `shots/`: as capturas vigentes são as desta pasta) e `coerencia.mjs` nas duas larguras (0 falhas). Nenhum arquivo do mockup foi alterado; acrescentei só este parecer e três recortes `shots/r6rev-*.png` (apagar antes da entrega). Navegador fechado.

## Veredito

**NÃO PODE ir ao dono ainda: 1 bloqueio e 2 "corrige".** Os dois itens da r5 (B1 "o dia ainda não chegou" e C1 "cerca de 10 dias") foram resolvidos de verdade e as sugestões S2 a S6 também. O que sobra é a mesma classe de erro de novo num lugar que nem o `coerencia.mjs` nem as revisões anteriores olharam: **um número do cartão que não fecha com as datas escritas na mesma linha** (`zero`: "6 dias (10/10 a 16/10)", são 7 dias de calendário). O resto da tela, em 8 dos 10 estados, está pronto.

A pergunta de quem abre: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". Respondida no primeiro olhar a 1440 (linha "Trocas deste vídeo: ..." logo abaixo dos botões, acima do primeiro gráfico) e, a 390, com meia rolagem (a linha começa em y = 905 px no `hoje` e em y = 975 no `extremo`, com a janela de 844; o cabeçalho com miniatura é do mockup 3 aprovado, ver S5).

| Resumo | Contagem |
|---|---|
| Estados "pronto para o dono" | 8 de 10: `tipico`, `hoje`, `semnumero`, `so-teste`, `so-reconstruido`, `vazio`, `erro`, `leitura` |
| Estados "volta para ajuste" | 2 de 10: `zero` (B1) e `extremo` (C1, só a 390) |
| Reprovado | 0 |
| Bloqueios | 1 (B1) |
| Corrige | 2 (C1 e C2) |
| Sugestões | 7 |

As três coisas que mais derrubam o conjunto agora:
1. Um rótulo de contagem ("6 dias") que ignora o dia não medido no meio do intervalo que ele mesmo escreve ao lado (B1).
2. Texto de ⓘ escrito para 1440 e lido a 390: diz "números escritos sob as barras" onde, a 390, não há número nenhum (C1).
3. O `coerencia.mjs` confere o que a tela mostra contra a série, mas não confere um rótulo contra o outro rótulo da mesma linha, nem o ⓘ contra a largura. As duas falhas desta rodada estão nesses dois pontos cegos.

## Conferência da rodada 5

| Item r5 | Resolvido? | Evidência desta rodada |
|---|---|---|
| B1 fala do dia: "ainda não chegou" para dia do passado | Sim | Percorri os dois gráficos dia a dia nos 10 estados. Mesmo dia, mesma frase nos dois: `hoje` 27/09 e 28/09 "o YouTube não entregou este dia (não medido)"; 12/10 "o YouTube ainda não entregou este dia (não medido)". `zero` 30/09 e 15/10 "não entregou", 19/10 "ainda não entregou". `tipico` e `extremo` 16/11 "ainda". `semnumero` 12/10 "ainda". "Ainda" só no dia de ontem. |
| C1 ⓘ "janela cheia, cerca de 10" | Sim | ⓘ de "Trocas deste vídeo": "o primeiro dia depois da troca aparece cerca de 3 dias depois; a leitura completa, cerca de 9 dias depois da troca". Tela: troca 12/10, "chega em 15/10", "leitura completa em 21/10" (12/10 + 3 e + 9). |
| S2 "vídeo 1 de 35" em todo estado | Sim | Posição = 1 + idade ÷ 5: `tipico` 12 (56 dias), `extremo` 22 (105), `hoje` 19 (91), `zero` 20 (98), `semnumero` 2 (7), `so-reconstruido` 30 (148). Cada uma confere. |
| S3 método dos cliques só no ⓘ de duas telas abaixo | Sim, mas gerou C1 | O ⓘ do gráfico de impressões agora traz o método. Só que o texto vale para 1440 (ver C1). |
| S4 ⓘ de `leitura` fala de cliques | Sim | ⓘ de `leitura`: início do registro, quais trocas contam, origem não sabida, fonte "dados públicos do YouTube"; nenhum clique, nenhuma impressão. |
| S5 barra "158 impressões" contra 30 | Sim, com ressalva (S4 abaixo) | "158 impressões em 30 dias (o vídeo do estado 'hoje' tem 30 delas)". |
| S6 hábito sem dado; lixo em `shots/` | Em parte | Texto do ⓘ: "a troca pode ter sido feita porque o vídeo ia mal". Sobraram 4 arquivos de nome gigante em `shots/` (C2). |
| `coerencia.mjs` cego ao leitor de dia e aos ⓘ | Sim | Roda e dá 0 falhas a 1440 e a 390; a regra (b) e (c) da fala do dia estão lá. Continua cego aos dois pontos de B1 e C1. |

## Bloqueio

### B1. `zero`: "Depois: 6 dias (10/10 a 16/10)", são 7 dias de calendário, e a tela não diz qual falta

- Tela e estado: `zero` (hoje 20/10), cartão da troca 1, lado "Depois"; 1440 e 390, os dois temas (o texto é o mesmo). Capturas: `shots/r6rev-zero-1440-escuro-6-dias-sete-datas.png` (gráfico de impressões com o dia 15/10 hachurado, e o cartão logo abaixo) e `shots/r6rev-zero-390-claro-6-dias-sete-datas.png`.
- O que está errado: o cartão escreve "Depois: 6 dias (10/10 a 16/10), 0 impressões". De 10/10 a 16/10 são 7 dias. O sexto dia que falta é o 15/10, que o YouTube não entregou (hachura rosa no gráfico logo acima, fala "o YouTube não entregou este dia (não medido)"), mas o cartão não menciona isso. Quem conta as datas lê 7 e vê "6": é exatamente a classe de erro das rodadas anteriores (número do rótulo que não fecha com o intervalo escrito ao lado dele). O desenhista sabe a razão (NOTAS 7.4: "15/10 fica de fora por ser não medido"), mas a explicação mora só na NOTAS, não na tela. O "Antes" do mesmo cartão ("7 dias (01/10 a 07/10)") fecha, o que deixa o "Depois" mais estranho ainda.
- Evidência: `3b.js`, `rotLado()`: `plural(r.dias, 'dia', 'dias') + ' (' + DM(r.de) + ' a ' + DM(r.ate) + ')'`; `3b-dados.js`, `soma()`: o laço pula o dia `nm` sem registrá-lo. Só o `zero` tem dia não medido dentro de uma janela (varri os 15 lados com número: nenhum outro).
- Conserto: em `soma()` guardar a lista dos dias `nm` pulados dentro do intervalo (`r.nm.push(x.d)`), e em `rotLado()` escrever "Depois: 6 dias medidos (10/10 a 16/10, sem 15/10), 0 impressões" quando `r.nm.length` for maior que 0; sem dia pulado o texto fica como está. No `coerencia.mjs`: para cada lado com "N dias (dd/mm a dd/mm)", exigir N = dias de calendário entre as duas datas, mais 1, a menos que o rótulo cite os dias que faltam. Não precisa regerar nada além do `zero` (4 capturas).

## Corrige (vai ao dono só depois de corrigido)

### C1. ⓘ do gráfico de impressões diz "números escritos sob as barras", mas a 390 o `extremo` não escreve número nenhum

- Tela e estado: `extremo`, gráfico "Impressões e cliques", a 390 (claro e escuro). Captura: `shots/r6rev-extremo-390-claro-cliques-sem-numeros.png`.
- O que está errado: o ⓘ diz "o total da frase é a soma dos números escritos sob as barras. Quando todo dia tem menos de 1 clique, nenhum número é escrito...". A 1440 há 35 números sob as barras e eles somam 5.217, como a frase. A 390, com 35 barras de menos de 7,5 px, nenhum número é escrito (medi: 35 `ic-cln` a 1440, 0 a 390; a legenda a 390 diz "cliques estimados · valor ao ler o dia"). O método do ⓘ manda conferir uma soma que não está na tela. O `tipico` a 390 escreve os 35 números (barras mais largas), então só o `extremo` cai nisso. O ⓘ é o mesmo texto nas duas larguras.
- Evidência: `3b.js`, `ajudaGrafico(imp)`; `a4-comum.js` linha 174 (limite de 7,5 px por barra para escrever o número).
- Conserto: trocar a frase do ⓘ por uma que vale nas duas larguras: "O total da frase é a soma dos cliques de cada dia: os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela. Quando todo dia tem menos de 1 clique, o total é a soma exata arredondada ("cerca de")." Acrescentar ao `coerencia.mjs` uma conferência: se o ⓘ cita "escritos sob as barras", a 390 tem de haver número escrito, ou o texto não pode citá-los.

### C2. `shots/` com 4 arquivos de lixo e NOTAS apontando para recortes que não existem mais

- Onde: `shots/index-caso-tipicoindexhtml-caso-extremoindexhtml-...-leitura-{1440,390}-{escuro,claro}.png` (4 arquivos de nome com 230 caracteres, 1440x900 e 980x2121, 6 a 10 KB: captura de uma URL montada errado). A NOTAS (10) diz "shots/ só tem index-caso-* e medidas.json": o filtro `index-caso-*` os inclui, então a frase é verdadeira só na letra. A NOTAS 7 (linha "Conferido contra as capturas") cita `shots/r4-*.png`, que já não existem.
- Conserto: apagar os 4 arquivos; reescrever a linha da NOTAS 7 com as capturas que existem (`index-caso-*`). Apagar também os 3 `r6rev-*.png` quando B1 e C1 estiverem fechados.

## Sugestões (não bloqueiam)

- **S1. Views contra cliques, de novo (r4/S1, r5/S1; é a pergunta 7 das NOTAS).** `extremo`: na troca 2 a taxa vai de 2,8% para 7,5% e os cliques por dia de 84 para 220, mas as views por dia ficam entre 1.164 e 1.996 antes e depois, porque `viewsDe` deriva só das impressões. Quem lê a história que a própria tela conta ("subiu") e olha o gráfico de cima vê uma taxa que quase triplica sem efeito em views. As views valem 11 vezes os cliques em `tipico` e `extremo`, 9 vezes em `semnumero`. Não é contradição de número fechado; deixo como pergunta ao dono, mas ela vai junto da entrega. Se ele pedir, o conserto de uma linha é o que o desenhista já descreveu (views = cliques x 1,3 a 2,5).
- **S2. Miniatura do cabeçalho não é a do "depois" da última troca de thumbnail.** `hoje`: o cabeçalho tem a miniatura verde (placeholder do mockup 3, gerada do título) e a troca 2 mostra "depois" laranja com rosto. A faixa reconstruída diz "o que está no ar agora é o do cabeçalho". Usar a mesma `capa()` do último "depois" no cabeçalho, ou deixar escrito que a miniatura é provisória. Herança do mockup aprovado, por isso não bloqueia.
- **S3. Fala do dia da publicação.** `semnumero`, 06/10: a legenda desenha "dia da publicação" (▾ no topo da barra), mas a fala do dia diz só "ter 06/10: 5 views." Acrescentar "Dia da publicação do vídeo." à fala do dia 06/10, nos dois gráficos.
- **S4. Barra "158 impressões em 30 dias" contra "30 impressões em 29 dias".** Fecham (o vídeo tem 30 das 158 dos dois canais), mas as janelas são diferentes e o leitor compara 30 com 30. Escrever "158 nos dois canais em 30 dias; neste vídeo, 30 em 29 dias".
- **S5. A 390 a pergunta cai logo abaixo da dobra.** A linha "Trocas deste vídeo: ..." começa em y = 905 (`hoje`) e 975 (`extremo`, título de 5 linhas); a janela de teste é de 844. O cabeçalho (pager, miniatura de 200 px, seis números) é do mockup 3 aprovado; se o dono quiser, a miniatura a 390 pode cair para 140 px de altura e a linha sobe uns 60 px. Não mexer sem pedido.
- **S6. "Um mês depois do início do registro (hoje, 17/11)":** de 07/10 a 17/11 são 41 dias. "Mais de um mês" evita a conta.
- **S7. Chip "seu canal" em `leitura`.** Quem só lê vê "seu canal" no cabeçalho. O chip diz de quem é o canal; para quem não administra o texto "o canal que você acompanha" seria menos errado. Pergunta de produto, não de desenho.

## Varredura de coerência dos números de exemplo (a que pediu o dono), todos os estados, de uma vez

Método: li o texto renderizado de cada estado a 1440 e a 390; percorri a fala de todos os dias dos dois gráficos; somei as colunas das duas tabelas de cada estado; reconferi dias da semana (559 rótulos, 0 erros), idades (10 de 10 certas), duração (812, 886, 702, 1.840 s = 13:32, 14:46, 11:42, 30:40), contagens de chips e do resumo, cada lado de cada troca contra a janela e o corte, o título atual contra o "depois" da última troca de título, a cadeia de capas e de títulos, o "primeiro dia, chega em, completa em" (troca + 1, + 3, + 9), e os ⓘ contra a tela. Tudo o que achei está listado: **uma contradição (B1), uma frase de ⓘ que não vale a 390 (C1), uma sujeira de pasta (C2) e as 7 sugestões.** Nada mais.

| Estado (hoje) | Números na tela | Deriva de | Fecha com | Resultado |
|---|---|---|---|---|
| `tipico` (17/11) | 3,06 mil views, 139 curtidas, 17 comentários, 5,1%, 1,7× | 3.003 medidos + 55 estimados = 3.058; taxas 4,56% e 0,56%; mediana 1.790 | 156/3.058 = 5,1%; 3.058/1.790 = 1,7; gráfico 1.477 (menor) | ok |
| `tipico` | 1.477 views em 35 dias; 3.031 impressões e 131 cliques em 36 dias; 35+0+1 | tabelas: 1.477, 3.031 e 131; 36 linhas, 1 "não medido" | 35 rótulos de cliques somam 131 (a 1440 e a 390); views menor que impressões | ok |
| `tipico` | troca 1 (03/11): antes sem dias, depois 4 dias (04/11 a 07/11), 295 impr., 4,1% (2,3 a 7,0); troca 2 (09/11): antes os mesmos 4 dias e 295, depois 6 dias (10/11 a 15/11), 462, 5,8% (4,0 a 8,4) | corte pela troca vizinha (09/11 menos 2 = 07/11) e pelo ciclo de 01/11; último fechado 15/11 | 10 a 15/11 são 6 dias de calendário e 6 medidos; faixas se cruzam = "sem diferença firme" | ok |
| `tipico` | teste 20/10 a 02/11, 5 ciclos (20/10, 23/10, 26/10, 29/10, 01/11), vencedor em 03/11 | dados | ciclos dentro do teste; 03/11 = 02/11 + 1 | ok |
| `extremo` (17/11) | 231 mil, 10.480, 1.643, 5,2%, 8,8× | 231.352; 4,53% e 0,71%; mediana 26.210 | 12.123/231.352 = 5,24%; 231.352/26.210 = 8,8 | ok |
| `extremo` | 57.271 views (35 dias); 118.798 impr. e 5.217 cliques (36 dias) | tabelas somam 57.271, 118.798, 5.217 | 5.217 = soma dos 35 rótulos a 1440; **a 390 nenhum rótulo é escrito** | ok a 1440; **C1** a 390 |
| `extremo` | 6 trocas, 2 testes; 1 subiu + 4 sem dias + 1 origem não sabida = 6 | dados | itens da lista 1 a 6; marcas 1 a 6 | ok |
| `extremo` | troca 1: depois 7 dias (21/10 a 27/10), 24.976; troca 2: antes 7 dias (22/10 a 28/10), 25.750, depois 4 dias (31/10 a 03/11), 12.299; troca 3: antes os mesmos 4 dias e 12.299 | cortes pela troca vizinha de qualquer origem | cada intervalo tem tantos dias de calendário quanto o rótulo diz; 2,8% e 7,5% com faixas que não se cruzam = "subiu" | ok |
| `extremo` | trocas 3 a 6 "sem dias" ou "origem não sabida": cada frase cita a vizinha certa e a distância certa (1 dia, 1 dia e ciclo 08/11 a 2 dias, ciclo 10/11 e troca 6 a 2 dias) | datas 05/11, 06/11, 08/11, 10/11, 12/11, 14/11 | cada distância confere com as datas | ok |
| `extremo` | testes A (14/10 a 19/10, 3 ciclos 14, 16, 18; vencedor 20/10) e B (08/11 a 11/11, 2 ciclos 08, 10; parado em 12/11) | dados | troca 1 = vencedor de A (20/10); troca 5 = restauro de B (12/11); título atual = depois da troca 5 | ok |
| `hoje` (13/10) | 96 views, 6, 1, 7,3%; "o normal" não medido | 84 antes de 14/09 + 11 do gráfico + 1 estimada | 11 views em 26 dias (26+3 = 29); 7/96 = 7,3% | ok |
| `hoje` | 30 impr., "cerca de 3 cliques", 26+0+3 = 29 dias | tabelas: 30; 22 dias com 1 e 4 com 2; todo dia abaixo de 1 clique | views (11) menor que impr. (30); legenda "menos de 1 em cada dia" | ok |
| `hoje` | troca 1 (09/10): antes 7 dias (01/10 a 07/10), 8 impr.; depois 1 dia (10/10), 1 impr.; troca 2 (12/10): antes 1 dia (10/10), 1 impr.; depois ainda sem dia medido, "13/10 chega em 15/10, completa em 21/10" | corte da troca 2 (12/10 menos 2 = 10/10); +1, +3, +9 | os dois "1 dia (10/10)" são o mesmo dia; 09/10 sex, 12/10 seg | ok |
| `zero` (20/10) | 108 views, 6,5%; 6 views em 26 dias; 12 impr., "cerca de 1 clique", 7+19+3 = 29 | 101 + 6 + 1; 12 × 6% = 0,7 | (6+1)/108 = 6,5%; 6 views contra 12 impressões | ok |
| `zero` | troca 1: antes 7 dias (01/10 a 07/10), 0 impr.; **depois 6 dias (10/10 a 16/10)**, 0 impr. | série; 15/10 não medido, dentro do intervalo | 10/10 a 16/10 = 7 dias de calendário, 6 medidos | **B1** |
| `semnumero` (13/10) | 32 views, 6,3%; 27 views em 6 dias; 55 impr., "cerca de 3 cliques", 6+0+1 = 7 | 27 + 5 estimados; 55 × 5% = 2,75 | 5+4+5+4+4+5 = 27; 10+8+10+8+9+10 = 55; há 7 dias (06/10 a 13/10) | ok |
| `semnumero` | troca 1 "sem antes: publicado em 06/10, 2 dias antes da troca"; troca 2 cercada pelas trocas 1 e 3 a 2 dias; troca 3 "13/10 chega em 15/10, completa em 21/10" | datas 08/10, 10/10, 12/10 | 1 sem antes + 1 sem dias + 1 depois não medido = 3 | ok |
| `so-teste` (13/10) | teste desde 03/10, 4 ciclos (03, 06, 09, 12/10); "0 trocas fora do A/B Lab"; 11 views, 30 impr. | dados; série igual à de `hoje` | ciclos dentro do teste e antes de hoje; sem item de troca | ok |
| `so-reconstruido` (13/10) | 223 views, 3,6%, há 148 dias; 10 views, 28 impr., "cerca de 2 cliques"; teste 31/05 a 07/06, ciclos 31/05, 02/06, 04/06, 06/06 ("ciclo 1 a 4 de 4") | 212 + 10 + 1; 8/223; 18/05 a 13/10 | ciclos depois da publicação e antes do registro; 28 × ~7% = 2 | ok |
| `vazio` (13/10) | 96 views; 11 views; 30 impr.; 0 trocas | igual a `hoje` | nenhuma lista | ok |
| `erro` (13/10) | troca 1: antes 7 dias (01/10 a 07/10), 8 impr.; depois 2 dias (10/10 a 11/10), 3 impr.; "leitura de 12/10 e a de 13/10 falharam; trocas certas até 11/10; tenta de novo amanhã às 09:00" | sem a troca 2 de `hoje` o depois vai até o último fechado (11/10) | 12/10 e 13/10 = ontem e hoje; "amanhã" = 14/10 09:00, o horário do ⓘ | ok |
| `leitura` (17/11) | mesmos números públicos de `tipico`; nenhuma impr., clique ou taxa | privado | caixa com cadeado; chips de taxa só em "origem não sabida" | ok |
| Todos | dias da semana (559 rótulos), idades, durações, posição "vídeo N de 35", contagens de chips | calendário de 2026 | tela | ok |

Fala do dia (percorri 2 gráficos × 10 estados): mesma frase para o mesmo dia não medido nos dois; zero sempre "zero medido"; dia com número nunca "não medido"; ciclo de teste e "antes do início do registro" aparecem na fala dos dias certos (`so-teste` 03/10 a 06/10 diz os dois, como o gráfico desenha). Única falta: o dia da publicação não é dito na fala (S3).

## Por estado e por largura

Pergunta e leitura de relance iguais em todos os estados. Par obrigatório 1440 escuro e 390 claro (os outros dois cruzamentos por medida e amostra).

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| `tipico` | pronto | pronto | números dos 35 dias escritos a 390; frases do bloco certas |
| `extremo` | pronto | **volta (C1)** | a 1440 tudo fecha; a 390 o ⓘ cita números que não estão na tela |
| `hoje` | pronto | pronto | hachura rosa com texto legível; três dias não medidos; "chega em 15/10" confere |
| `zero` | **volta (B1)** | **volta (B1)** | caixa vazada com 0 em ambos os lados (nunca hachura); falta o "sem 15/10" no "Depois" |
| `semnumero` | pronto | pronto | ▾ da publicação acima do número; três chips sem número, cada um com o motivo |
| `so-teste` | pronto | pronto | colchete aberto "em andamento"; sem "Ver antes e depois" |
| `so-reconstruido` | pronto | pronto | faixa reconstruída com 4 ciclos e "thumbnail original não dá para recuperar" |
| `vazio` | pronto | pronto | "0 trocas" na caixa vazada |
| `erro` | pronto | pronto | pastilha com ícone e texto; diz até quando está certo |
| `leitura` | pronto | pronto | cadeado na caixa e no cartão; nenhuma taxa vaza |

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Passa: linha "Trocas deste vídeo: ..." (ou contagem e símbolos com mais de 3 trocas) e uma frase em cada bloco. |
| Régua ou barra | Passa: colchetes, régua das versões, faixa de taxa com intervalo, faixa de pontos de cliques. |
| Cor estável com símbolo; escala de cinza | Passa. CSS não mudou depois da r4 (`3b.css` de 13:08); verde só em ▲, rosa só em "não medido", sem vermelho para direção. |
| "Zero medido" distinto de "não medido" | Passa: caixa vazada com 0, hachura rosa, tracejado e pontilhado se separam por forma; tabelas e fala do dia usam a mesma palavra para o mesmo caso. |
| Método no ⓘ | Passa, com C1 (texto do ⓘ de impressões a 390). |
| Sem prosa nem bloco monocromático | Passa. |
| Frases sem jargão; nada afirma mais do que o dado sustenta | Passa. Varri as 10 telas e os ⓘ por "lido, gravou, CTR, diário, série, snapshot, payload, pipeline, cron": zero ocorrências na tela (só "última sincronização" no ⓘ do cabeçalho aprovado). |
| Sem `color-mix()` | `grep` em todos os `.css`, `.js` e `index.html`: só comentários "sem color-mix". |
| 1440 escuro e 390 claro; alvo de 44 px | Passa (tabela abaixo). |
| Números de exemplo sem contradição | **Falha em B1** (um cartão de `zero`); C1 é texto de ⓘ, não número. |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Menor contraste de texto (todo texto de `#screen`, cor composta, 10 estados) | **4,73:1** ("seu canal", 12 px, claro, 1440 e 390) e **4,83:1** (rótulo do teste A/B, 12,5 px, escuro). Resto acima. Igual à r5 |
| Contraste de elemento gráfico (colchete, marcador, hachura) | não medi de novo; nada mudou no CSS desde a r3 (14,48:1 escuro e 15,76:1 claro) |
| Rolagem horizontal a 390, 10 estados, 2 temas | 0 px |
| Texto abaixo de 12 px | 0 |
| Alvos abaixo de 44 x 44 a 390 (ponteiro grosso) | 0 (`shots/medidas.json`, 40 casos) |
| ⓘ a 390 | botão 44 x 44; popover de x = 12 a 378 em 390 (dentro da tela), fonte 13 px; o mais alto (ⓘ de "Trocas deste vídeo") vai de y = 8 a 838 com janela de 844, cabe com 6 px de folga |
| ⓘ a 1440 (mouse) | botão 28 x 28 (compacto, convenção do lote); popover dentro da tela; Enter abre, Esc fecha, foco volta ao botão (os 4 ⓘ em 3 estados) |
| Erros de JavaScript | 0 (10 estados) |
| `coerencia.mjs` | 0 falhas a 1440 e a 390 |
| Soma das tabelas contra as frases | todas iguais: `tipico` 1.477 views, 3.031 impr., 131 cliques; `extremo` 57.271, 118.798, 5.217; `hoje`, `erro`, `vazio` e `so-teste` 11 e 30; `zero` 6 e 12; `semnumero` 27 e 55; `so-reconstruido` 10 e 28 |
| Números escritos sob as barras de cliques | `tipico` 35 a 1440 e 35 a 390; `extremo` 35 a 1440 e **0 a 390** (C1) |
| Páginas | 1440: 2.157 a 5.102 px; 390: 3.251 a 7.215 px |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): conferi rótulos, `role` e o texto do `aria-live` de cada dia; não a fala.
- Safari, Opera (navegador do dono) e Firefox: só Chromium.
- Contraste dos elementos gráficos: não medi de novo (CSS inalterado desde a r3).
- Movimento reduzido, zoom de 200% e fonte maior do sistema; mouse real sobre o gráfico (usei os botões de dia, que chamam a mesma `fala`).
- 360 px: fora do par obrigatório, não medi.
- Ordem de foco por Tab no conjunto: a r5 mediu 68 paradas sem perda de contorno; esta rodada só reconferiu o foco dos ⓘ, e o código de foco não mudou.

## Para a rodada 7

1. Corrigir B1 (`soma()` e `rotLado()`, texto "6 dias medidos (10/10 a 16/10, sem 15/10)") e C1 (frase do ⓘ de impressões), apagar os 4 arquivos de lixo de `shots/` (C2).
2. Estender o `coerencia.mjs` com as duas regras novas (contagem de dias do lado contra o intervalo; ⓘ contra o que a 390 escreve).
3. Refazer só as capturas de `zero` (4) e de `extremo` a 390 (2, o ⓘ não aparece na captura, então basta a medida). Atualizar a linha do `zero` na tabela 10.1 da NOTAS.
4. Responder às sugestões por escrito (S1 e S7 são perguntas ao dono; S2 a S6 o desenhista decide). Se discordar de B1 ou C1, responda com captura: mantenho ou retiro por escrito.

Com B1 e C1 corrigidos, os 10 estados ficam prontos para o dono; não vejo outro bloqueio.
