# NOTAS da tela 3b: vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro"

Abrir: `cd <esta pasta> && python3 -m http.server 47711 --bind 127.0.0.1` e `index.html?caso=...` (`tipico`, `extremo`, `hoje`, `zero`, `semnumero`, `so-teste`, `so-reconstruido`, `vazio`, `erro`, `leitura`; `&tema=claro`; `&novo=nao` esconde as marcas "+ novo"). Capturas em `shots/` (10 estados x 1440 escuro, 390 claro, mais os dois cruzamentos extras). `shots/medidas.json`: rolagem 0, fontes menores que 12 px 0, alvos menores que 44 px 0, nos 40 casos. `grep color-mix` só acha comentário. Tudo é exemplo inventado. Plano: `PLANO.md`.

Mudança no arquivo copiado: `a4-comum.js` (cópia do lote 1) ganhou `cfg.faixas` e `cfg.nvTag` em `A.serieDia` e, na r3, o limite separado de ponto (5 px por dia) e de número (7,5 px) da faixa de cliques (marcadas "3b" no código). `lote.js` segue sem mudança (o formato das views do cabeçalho é feito em `3b.js`). Sem `faixas`, o gráfico é idêntico ao aprovado. O resto da pasta (`a4.css`, `lote.css`, `lote.js`) é cópia sem mudança.

## 1. Decisões de desenho e por quê

1. **Teste A/B no gráfico = colchete cheio sobre as barras, fundo suave e dentes nos ciclos.** O fundo é o tom do texto com alfa baixo (rgba literal), não um matiz. Os dentes mostram, sem texto, por que não há losango ali: o teste troca a cada ciclo e isso é do A/B Lab. Ícone de duas setas trocando (desenhado em SVG, não é emoji nem caractere) junto do rótulo, então a leitura não depende de cor. Teste em andamento tem o colchete aberto com uma seta à direita.
2. **Antes do início do registro = colchete pontilhado, sem fundo, mais uma linha pontilhada vertical em 07/10.** Pontilhado é "ainda não existe" na convenção do dono; por isso não é hachura rosa (dado que não chegou) nem losango (troca). Só aparece quando o gráfico começa antes de 07/10, e diz o que importa: gráfico sem marca ali não quer dizer sem troca. Pergunta 1 abaixo.
3. **Cada tipo de faixa tem linha própria acima das marcas** (nunca sobre as barras de dado). Dois tipos juntos usam duas linhas; um só, uma.
4. **Régua das versões (nova, dentro do bloco):** linha do tempo de 07/10 até hoje com testes e trocas na mesma forma do gráfico. Responde de relance "o que esteve no ar e quando" sem rolar de volta ao gráfico. Marcas próximas (menos de 27 px) sobem de linha, em vez de se sobrepor; o gráfico por dia usa a mesma regra (r2/B2).
5. **Teste A/B na lista = linha própria**, com fundo suave e borda de cima cheia (o mesmo colchete), sem número, sem antes × depois, com o resultado do teste e o link. Diz "as N trocas de ciclo não entram aqui". Só contam como troca (losango ou triângulo numerado) as de origem `fora_do_sistema`, `vencedor` e `restauro`; `nao_se_sabe` aparece numerada, mas sem comparação (pergunta 3).
6. **Origem dita na tela**, uma linha por troca: chip com ícone (seta para fora, duas setas, interrogação) + frase. "Fora do A/B Lab: feita no Studio ou por outra ferramenta; o sistema não sabe qual." `nao_se_sabe` nunca afirma origem.
7. **Faixa das versões reconstruídas (pre_registro):** moldura pontilhada (a mesma forma do colchete), cabeçalho "Antes do início do registro (07/10/2026), reconstruído do A/B Lab", linhas com losango pontilhado (não é marcador de troca: sem número, sem preenchimento), e dois selos pontilhados "sem antes e depois" e "a thumbnail original não dá para recuperar". Fica acima da lista, com um divisor "07/10/2026: o registro começa", porque a ordem é cronológica. Nunca aparece como versão corrente (a frase diz que o que está no ar é o do cabeçalho). Só os 2 vídeos reais têm; no gráfico não aparece (o gráfico não alcança maio e junho).
8. **Os quatro estados sem número têm forma de borda própria**, para separar em escala de cinza: depois ainda não medido = hachura rosa (existente, "o dado vai chegar"); sem antes = contorno pontilhado ("não existe"); sem dias para comparar (antes "janela cortada") = contorno cheio com barra grossa no lado cortado; poucas impressões = tracejado (existente). Zero medido = caixa vazada com o 0 dentro (existente, borda `--im-zero`).
9. **Resumo do bloco em duas camadas:** uma frase (num `<span>` só) e uma linha de contagens com o mesmo chip de cada estado ("▲ taxa subiu 1", "sem dias para comparar 4"). A contagem é a legenda e o placar ao mesmo tempo.
10. **A leitura mostra o lado que tem número mesmo quando o outro não tem** (ex.: depois com 24.976 impressões e 2,8% quando o antes foi cortado pelo teste). Dá informação sem inventar comparação.
11. **Só leitura:** o que é público continua (views, títulos, thumbnails, marcas, faixas). O que é privado (impressões, cliques, taxa) vira uma caixa com cadeado que diz o que a pessoa não vê e por quê. O link do A/B Lab vira "sem acesso ao A/B Lab".
12. **Erro:** pastilha na família do erro (borda e ícone em `--danger`, texto em `--text`), diz quais leituras falharam, até quando as trocas estão certas e quando o sistema tenta de novo.
13. **Tudo o que a proposta acrescenta leva a marca "+ novo"** (régua, linha de teste, faixa reconstruída, itens da legenda, origem). `?novo=nao` esconde, para ver a tela sem elas.
14. **"Hoje" e "um mês depois":** `hoje`, `zero`, `semnumero`, `so-*`, `vazio`, `erro` usam a data de hoje (13/10), com o registro de 6 dias. `tipico`, `extremo` e `leitura` mostram a tela com um mês de registro (17/11), dito no topo do bloco; sem isso nenhum antes × depois teria dias suficientes para ser desenhado.

## 2. Tabela de frases da tela (texto exato)

| Onde | Texto |
|---|---|
| Linha acima dos gráficos, sem troca nem teste (r7) | `vazio`: "Trocas deste vídeo: nenhuma desde 07/10." · `so-reconstruido`: "Trocas deste vídeo: nenhuma desde 07/10; um teste A/B de 31/05 a 07/06 foi reconstruído (mais abaixo)." |
| Linha acima dos gráficos | Até 3 trocas: "Trocas deste vídeo: {título (1) em 03/11, sem dias para comparar; thumbnail (2) em 09/11, sem diferença firme; teste A/B de 20/10 a 02/11}." Mais de 3 (r2/C2): "**6 trocas e 2 testes A/B** desde 07/10: ▲ 1 taxa subiu · 4 sem dias para comparar · 1 origem não sabida." (cada item com o símbolo do chip; 4 linhas a 390 px em `extremo`, 2 a 1440) + link "Ver antes e depois" (some quando não há troca, r4/S5) |
| Rótulo do colchete A/B (gráfico) | "em teste A/B" · curto "teste A/B" · aberto "em teste A/B (em andamento)" |
| Rótulo do colchete de registro (gráfico) | "antes do início do registro (07/10): trocas não registradas" · curto "antes do início do registro" · mínimo "antes do registro" |
| Legenda do gráfico | "em teste A/B: as trocas de ciclo não são contadas" · "antes de 07/10: o sistema não registra trocas" |
| Fala do dia (leitor de tela e abaixo do gráfico) | "Neste dia o vídeo estava em teste A/B: as trocas de ciclo não são marcadas aqui" · "Este dia é anterior ao início do registro de trocas (07/10/2026): o sistema não sabe se houve troca"  · dia não medido, a MESMA frase nos dois gráficos (r5/B1): "o YouTube não entregou este dia (não medido)", e "o YouTube ainda não entregou este dia (não medido)" só para o dia depois do último fechado (o de ontem) |
| Tabela por dia, coluna Situação | "... · em teste A/B" · "... · antes do início do registro" |
| Rótulo do gráfico (leitor de tela) | "Views do vídeo, dia a dia: 36 dias. Inclui teste A/B de 20/10 a 02/11. Os dias até 06/10 são anteriores ao início do registro. Setas andam de dia em dia." |
| Publicação no gráfico | "dia da publicação": linha tracejada longa e fina com marcador ▾ no topo, que para acima do número da barra; se a barra do dia toca o teto do gráfico, o ▾ passa a ficar acima do número e o gráfico ganha 16 px no topo (r2/B1); o pontilhado curto é só do registro |
| Título do bloco | "Trocas deste vídeo" (ⓘ "Como ler antes e depois") |
| Aviso de exemplo | "Todos os números e títulos desta tela são inventados, como ficaria mais de um mês depois do início do registro (hoje, 17/11)." (r6/S6: de 07/10 a 17/11 são 41 dias) / "...; as datas seguem o dia de hoje (13/10)." |
| Frase-resumo | "{N} trocas e {M} testes A/B neste vídeo desde 07/10/2026. Os ciclos de teste não contam como troca." · só teste: "0 trocas fora do A/B Lab desde 07/10/2026 e 1 teste A/B em andamento, que não conta como troca." · vazio: "0 trocas registradas desde 07/10/2026, quando o registro começou." |
| Régua | título "O que esteve no ar desde 07/10/2026"; extremos "07/10 início do registro" e "hoje, 17/11"; rótulo "teste A/B" (ou "teste A/B (começou em 03/10)") |
| Linha do teste | "Teste A/B · de 20/10 a 02/11 · 5 ciclos" / "desde 03/10, em andamento" · "As 5 trocas de ciclo não entram aqui. Resultado: o vencedor foi aplicado em 03/11. Ver o teste no A/B Lab" |
| Origem | "Fora do A/B Lab: feita no Studio ou por outra ferramenta; o sistema não sabe qual" · "Vencedor do teste A/B: aplicado em 03/11, no fim do teste de 20/10 a 02/11" · "Teste parado, o original voltou" (chip) + "o teste de 08/11 foi parado em 12/11 e o título de antes voltou" · "Origem não sabida: o sistema não conseguiu ler o A/B Lab neste dia e não afirma de onde veio" · link "Ver o teste" |
| Chips de leitura | "▲ taxa subiu" · "▼ taxa caiu" · "≈ sem diferença firme" · "… ainda não dá para dizer" · "? depois ainda não medido" (ou "antes") · "sem antes" · "sem dias para comparar" · "origem não sabida" |
| Lados do antes × depois | "Antes: 4 dias (04/11 a 07/11), 295 impressões" · "só 8 impressões: sem faixa" · "zero medido: o vídeo não apareceu" · "não medido: ainda sem dia fechado" · rótulo do lado sem número (um nome só, r2/C1): "Antes: sem dias para comparar" / "Depois: sem dias para comparar", e dentro da caixa só a causa: "o vídeo saiu logo antes da troca" · "as impressões só existem desde 08/09" · "a troca (2) vem logo antes" · "a troca (2) vem logo depois" · "um teste A/B vem logo antes" · "um teste A/B vem logo depois" (cabem em 270 px) · a 360 px o lado "Depois" perde a contagem de dias: "Depois: 21/10 a 27/10, 24.976 impressões" |
| Total de cliques (r4/B1) | com ao menos um dia de 1 clique ou mais: "3.031 impressões e 131 cliques estimados em 36 dias" (131 = soma dos 35 números desenhados sob o gráfico = soma da coluna da tabela); se todo dia tem menos de 1: "30 impressões e cerca de 3 cliques estimados em 29 dias" (nenhum número escrito, só pontos, legenda "cliques estimados por dia: menos de 1 em cada dia"; o ⓘ diz a conta) |
| Frase de cada leitura | **depois não medido (r4/B2):** "Ainda não dá para comparar. O primeiro dia depois da troca (13/10) só chega do YouTube em 15/10. Leitura completa em 21/10." (13/10 = troca + 1, o mesmo início do "depois" das outras trocas; 15/10 = troca + 3; 21/10 = troca + 9) · **sem antes:** "Sem antes para comparar. O vídeo foi publicado em 06/10, 2 dias antes da troca." (variante: "As impressões por dia só existem desde 08/09/2026."; se o depois também ficou sem dias: "O depois também ficou sem dias.") · **sem dias para comparar (r3/C2):** um lado: "A troca (4) vem 1 dia depois desta: não sobra dia inteiro desse lado."; dois lados: "Sem dias para comparar. A troca (1) vem 2 dias antes desta e a troca (3), 2 dias depois: não sobra dia inteiro para nenhum dos lados."; com ciclo: "Antes desta troca o vídeo estava em teste A/B (o último ciclo começou em 01/11). Comparar ciclos é do A/B Lab." · **poucas:** "Ainda não dá para dizer. São 8 impressões antes e 1 depois: com menos de 100 de um lado, qualquer taxa seria chute." · **zero:** "Nos dias medidos o vídeo teve 0 impressões antes e 0 depois: o YouTube entregou os dias e ele não apareceu para ninguém." · **sem origem:** "Sem comparação. O sistema não conseguiu ler o A/B Lab neste dia, então não sabe se a troca foi sua ou de um ciclo de teste. Comparar ciclos é do A/B Lab." · subiu/caiu/igual: as do mockup 3 |
| Faixa reconstruída | "Antes do início do registro (07/10/2026), reconstruído do A/B Lab" · "Teste A/B de 31/05 a 07/06/2026. São títulos do passado: o que está no ar agora é o do cabeçalho." · linhas "31/05 às 14:00 · ciclo 1 de 4 · {título}" e "antes do teste · título original" · selos "sem antes e depois", "a thumbnail original não dá para recuperar" · divisor "07/10/2026: o registro começa" |
| Sem troca | só a pastilha "0 trocas" (caixa vazada com o 0 e a palavra, r3/S3) sob a frase-resumo "0 trocas registradas..."; "antes de 07/10 o sistema não sabe se houve troca" saiu da tela e está no colchete do gráfico e no ⓘ |
| Erro | "Não foi possível atualizar as trocas. A leitura de 12/10 e a de 13/10 falharam." / "As trocas até 11/10 estão certas. Se você trocou algo depois disso, ainda não aparece aqui. O sistema tenta de novo amanhã às 09:00." |
| Só leitura | "Você não vê impressões nem cliques." / "Esses números são privados do canal e só aparecem para quem administra. Você vê o que é público: views, títulos, thumbnails e as trocas." · "Taxa de clique antes e depois: só para quem administra o canal." · "taxa de clique: só para quem administra" · "sem acesso ao A/B Lab" |
| ⓘ do bloco | janela, início do registro (novo), atraso, limiar, quais trocas contam, origem não sabida, "não é teste A/B" (3 motivos) e fonte: "cálculo do Observatório sobre os dados do YouTube Analytics do seu canal (impressões e cliques não são públicos). Os cliques são estimados: impressões × taxa do dia." |

## 3. Dúvidas para o dono (padrão adotado entre parênteses)

0. **Novas na rodada 1.** (a) 4 das 6 trocas do estado `extremo` caem em "sem dias para comparar" (todo vencedor e todo restauro, spec 7.5.3 e 7.5.5): é o caso mais comum de quem usa o A/B Lab; veja a dúvida 2. (b) A **régua das versões** não foi pedida: ela repete as marcas do gráfico (120 px de altura). Fica marcada "+ novo"; se o dono achar demais, corta-se e ficam gráfico e lista. (c) No **só leitura**, o dado do teste (datas, ciclos, "o vencedor foi aplicado em 03/11") continua visível e só o link some: decidir se o dado do teste é público do canal; se não for, a linha do teste também some para quem só lê.
1. **O gráfico mostra a faixa "antes do início do registro" mesmo sem versão reconstruída ali?** (Sim: colchete pontilhado + linha em 07/10 sempre que o gráfico começa antes dessa data, porque é o aviso honesto de que o gráfico sem marca não prova ausência de troca; some sozinho quando a janela de 35 dias passa de 07/10. Se preferir só na faixa dentro do bloco, cortamos o colchete e fica o aviso de uma linha.)
2. **A troca "vencedor" ou "restauro" compara com o quê?** O spec (7.5.5) corta a janela na troca vizinha de "qualquer campo", e o ciclo de um teste é uma troca vizinha; então o antes de todo vencedor e de todo restauro cai em "sem dias para comparar" (no estado `extremo`, 4 das 6 trocas). (Adotei exatamente isso e disse a causa na tela: "antes disto o vídeo estava em teste A/B". Alternativa: comparar o depois do vencedor com os dias anteriores ao teste. Muda a regra e o texto do spec; só faço se você pedir.)
3. **Troca com origem "não sabida" entra com antes × depois?** (Não: aparece numerada, sem comparação, porque pode ter sido um ciclo de teste e comparar ciclos é do A/B Lab. Alternativa: comparar mesmo assim e avisar.)
4. **Mostrar a falha da leitura também no gráfico e na régua?** (Hoje só no bloco, com pastilha de erro. Dá para marcar os dias sem leitura com o mesmo colchete pontilhado.)
5. **Limiar de 100 impressões e janela de 7 dias** continuam à espera da sua decisão (pergunta 27 do spec). O estado `hoje` mostra o efeito: com 158 impressões em 30 dias nos dois canais, toda troca dá "ainda não dá para dizer". Baixar o limiar alarga a faixa até ela não separar nada.
6. **A frase fixa do ⓘ.** O item 35 pede "cálculo do Observatório sobre dados públicos do YouTube". Impressões e cliques não são públicos, então usei "...sobre os dados do YouTube Analytics do seu canal (impressões e cliques não são públicos)". (Se o item 35 valer literalmente aqui, o texto muda numa linha.)
7. **(r4/S1) Views e cliques: razão de verossimilhança.** Nos exemplos o gráfico de views soma cerca de 11 vezes os cliques estimados (1.477 views e 131 cliques em `tipico`): quem conhece o canal pode estranhar que 90% das views venham de fora das impressões. Não é contradição de número, e mudar mexe em todos os números derivados; padrão adotado: manter. Se o dono quiser, as views do dia passam a sair dos cliques do dia (views = cliques x 1,3 a 2,5), uma linha em `viewsDe`.

## 4. O que o implementador precisa saber

- **Componente do gráfico:** `A.serieDia` ganha `faixas: [{ k: 'ab', de, ate, andamento, ciclos, rot, rotCurto, fala }, { k: 'reg', ate, rot, rotCurto, rotMin, fala }]` (o código está em `a4-comum.js`, trechos marcados "3b"). A altura do gráfico cresce 24 px por tipo de faixa presente; as marcas de troca descem junto. Cada tipo vira um item de legenda e uma frase na leitura por dia e na tabela. Também em `A.serieDia` (r2): marcas de troca a menos de 28 px da anterior descem para outra linha (28 px de altura por linha, só quando há colisão), o ▾ da publicação sobe quando a barra toca o teto, e a haste da troca para acima do número da barra.
- **Quais datas viram faixa:** `ab` vem das tabelas do A/B Lab (início do teste, fim ou parada, e a data de cada ciclo), não das versões; por isso o colchete cobre dias anteriores a 07/10 quando o teste começou antes. `reg` é derivado: último dia antes do início do registro.
- **A lista mistura três tipos de linha**, em ordem cronológica: faixa reconstruída (no topo, quando houver `pre_registro`), teste A/B (sem número) e troca numerada. O número da troca conta só as trocas que contam; o ciclo nunca recebe número.
- **Leitura da troca** (`3b-dados.js`, `lado()` e `leitura()`): lado antes = até 7 dias terminando 2 dias antes da troca; depois = até 7 dias começando no dia seguinte; param na troca vizinha de qualquer origem, incluindo o ciclo de teste; o dia da publicação não conta. Estados na ordem de prioridade: origem não sabida, depois não medido, sem antes, janela cortada, antes não medido, poucas impressões (menos de 100 de um lado, inclusive zero), subiu/caiu/sem diferença firme. Datas dos estados: primeiro dia do depois = troca + 3 dias; janela cheia = troca + 9 dias (o dia da troca mais 1 e mais 7, mais o atraso de 2).
- **Zero medido nunca é "não medido":** dia coberto sem linha = zero (caixa vazada com 0); dia não entregue = hachura rosa, fora da soma. Testado nos estados `zero` e `hoje`.
- **A cor do colchete e do fundo é o tom do texto do tema** (token `--ab-fundo`, rgba literal nos dois temas), sem matiz novo.
- **Acessibilidade:** gráfico e régua com `role="img"` e `aria-label` por extenso; leitura por teclado com setas inalterada e agora diz a faixa do dia; chips com ícone e texto (nunca só cor); erro com `role="alert"`; alvos de 44 px no toque (link "Ver o teste" 44 x 44, 28 com mouse); foco visível global.
- **Revisão:** rodada 1 do `revisor-ux-senior` respondida abaixo; a rodada 2 revalida. Contraste medido pelo revisor (colchete 14,5:1 escuro e 15,8:1 claro; chips de 4,86:1 para cima). Leitor de tela, Safari e Opera não foram verificados.
- **Carregando:** o bloco é derivado na leitura e carrega junto da tela do vídeo; não há carregamento separado, então não há esqueleto próprio (resposta a S5).
- **Linha do registro com teste A/B por cima:** a linha pontilhada de 07/10 para acima do colchete A/B e recomeça abaixo dele (`a4-comum.js`, marcado "3b r1/C1").

## 5. Resposta à revisão r1 (`REVISAO-UX-r1.md`)

Medidas novas (script próprio, `getBBox` em todo `<text>` do SVG de antes e depois, 10 estados, 2 temas): a 390 e a 360 px **nenhum texto sai da caixa nem do SVG**; rolagem 0, fontes menores que 12 px 0 e alvos menores que 44 px 0 nos 40 casos (`shots/medidas.json` refeito). Capturas refeitas em `shots/` para os 10 estados, nas duas larguras e nos dois temas; conferidas abrindo `tipico` 390 claro, `so-teste` 1440 escuro, `semnumero` 1440 escuro, `so-reconstruido` 390 claro, `vazio` 390 claro e `hoje` 390 claro.

| Item | Resposta |
|---|---|
| **B1** texto "cortada: ..." escapa da caixa a 390 | Aceito. Frases encurtadas para "cortada: teste A/B antes" e "cortada: teste A/B logo depois" (212 px, a caixa tem 270 a 304); a causa completa continua na frase de baixo. `getBBox` dentro da caixa a 390 e a 360. |
| **C1** linha de 07/10 atravessa o rótulo do colchete A/B | Aceito. A linha pontilhada para acima do colchete A/B e recomeça abaixo dele; o rótulo "em teste A/B (em andamento)" ficou limpo (`so-teste`, 1440 e 390). |
| **C2** prosa de método nos estados sem número | Aceito. "Ainda não dá para comparar. Primeiro dia depois da troca: 15/10. Leitura completa em 21/10." e "Sem antes para comparar. O vídeo foi publicado em 06/10, 2 dias antes da troca." Janela de 7 dias, atraso e dia da publicação ficaram só no ⓘ. Também cortei "então não há o que comparar desse lado" e "Só o depois pode ser lido". |
| **C3** frase repetida em `vazio` e `so-teste` | Aceito. Fica a frase-resumo e a pastilha "0 trocas" (caixa vazada, a forma de zero medido); saíram "Antes dessa data o sistema não sabe se houve troca" (foi para o ⓘ, item "Início do registro", e já está no colchete do gráfico) e "O teste A/B acima não conta". |
| **C4** duas linhas pontilhadas parecidas | Aceito. A publicação ganhou forma própria: linha tracejada longa e fina (8 e 4) com marcador ▾ no topo, que para acima do número da barra e não o cruza; legenda com o mesmo traço. O pontilhado curto é só do registro. |
| **C5** "janela cortada" é jargão | Aceito. Chip, contagem, legenda, frase e rótulo do estado agora dizem "sem dias para comparar" (a causa vem na frase de baixo e na caixa). Dúvida 2 permanece, agora com o número: no `extremo`, 4 de 6 trocas ficam sem leitura. Mantive "ciclo" (palavra da tela do A/B Lab, que o dono já usa) e "origem não sabida". |
| **S1** régua das versões não pedida | Aceito como pergunta: decisão de desenho 0(b), marcada "+ novo". |
| **S2** rótulo do gráfico não diz que há faixa | Aceito. O rótulo agora inclui "Inclui teste A/B de 20/10 a 02/11" e "Os dias até 06/10 são anteriores ao início do registro". |
| **S3** ⓘ solto numa linha a 390 | Aceito. O ⓘ acompanha a última palavra do título da faixa reconstruída, ícone de formas ao lado (`so-reconstruido` 390). |
| **S4** dois pontos seguidos | Aceito. O chip passou a "Teste parado, o original voltou". |
| **S5** estado "carregando" | Não desenhado de propósito: o bloco carrega com a tela do vídeo (ver seção 4). |
| **S6** só leitura mostra o dado do teste | Virou pergunta ao dono (decisão de desenho 0(c)); o padrão é o que a revisão encontrou. |
| **S7** texto encosta na borda a 360 px | Aceito. Abaixo de 310 px de largura o lado mostra só o período ("Depois: 21/10 a 27/10, 24.976 impressões"); o rótulo de leitura de tela mantém a contagem de dias. |

Nenhum bloqueio ou "corrige" foi recusado. Fora desta pasta nada foi alterado.

## 6. Resposta à revisão r2 (`REVISAO-UX-r2.md`)

Capturas refeitas para os 10 estados nas duas larguras e nos dois temas (`shots/index-caso-*`); medidas refeitas: rolagem 0, fontes menores que 12 px 0, alvos menores que 44 px 0 nos 40 casos, 0 erro de JavaScript, `color-mix()` só em comentário. Recortes que provam os consertos, conferidos abrindo-os: `shots/r2b-semnumero-390-escuro-grafico.png` e `r2b-semnumero-1440-escuro-grafico.png` (publicação no dia mais alto), `r2b-extremo-390-claro-grafico.png` (6 marcas, nenhuma coberta), `r2b-extremo-390-claro-resumo.png` e `r2b-extremo-1440-escuro-resumo.png` (linha-resumo), `r2b-tipico-390-claro-troca1.png` e `r2b-semnumero-390-claro-troca1.png` (nomes), `r2b-vazio-390-claro-zero.png`.

| Item | Resposta |
|---|---|
| **B1** ▾ da publicação risca o "10" da barra mais alta | Aceito. Quando a barra do dia da publicação toca o teto do gráfico, o ▾ passa a ficar acima do número (o gráfico ganha 16 px no topo só nesse caso) e a linha não desce até ele; o bug de fundo era o piso `T + 4` da linha, que a empurrava para dentro do número. Visto em `semnumero`, 390 e 1440, escuro. |
| **B2** marcador 4 cobre o 3 a 390 px | Aceito, com a regra da régua: marca a menos de 28 px da anterior desce para a linha de baixo (28 px por linha, só com colisão); a haste de cada marca nasce na sua linha. `extremo` a 390 claro: os seis números inteiros, nenhuma coberta. 1440 não muda. 360 px: mesma regra, não revisado visualmente. |
| **C1** quatro nomes para "sem dias para comparar" | Aceito. Rótulo do lado: "Antes: sem dias para comparar" (singular e plural iguais; vale também para "sem antes"); dentro da caixa só a causa, sem "cortada": "um teste A/B vem logo antes", "a troca (2) vem logo depois", "o vídeo saiu logo antes da troca", "as impressões só existem desde 08/09". "Nenhum dia inteiro sobrou" saiu. Na caixa do lado sem antes a frase antiga "sem antes: não há dia para comparar" virou a causa, porque o chip "sem antes" já diz o estado. |
| **C2** linha de trocas vira parágrafo a 390 px | Aceito. Com mais de 3 trocas a linha é "6 trocas e 2 testes A/B desde 07/10: ▲ 1 taxa subiu · 4 sem dias para comparar · 1 origem não sabida." com o símbolo de cada chip, 3 linhas a 390 e 2 a 1440; o detalhe fica no bloco. Até 3 itens continua a lista por extenso. Só leitura: sem a contagem de taxa (é privada). |
| **S1** texto de 11,4 px a 360 px | Não feito: 360 está fora do par obrigatório e o texto do SVG escala com a largura; a 390 todo texto é de 12 px ou mais. Se o dono quiser 360, é um piso de corpo no SVG, uma linha. |
| **S2** causa repetida (chip, caixa, frase) | Mantido, de propósito: o chip diz o estado, a caixa a causa em 5 palavras (pedido de C1) e a frase a explicação completa. Quem lê só o chip ou só a caixa já entende. |
| **S3** "0 trocas" duas vezes em `vazio` | Aceito. A pastilha ficou só com o 0 (caixa vazada); "trocas" ficou para o leitor de tela. |
| **S4** régua das versões não pedida | Sem mudança: continua a pergunta 0(b), marcada "+ novo". |
| **S5** dado do teste para quem só lê | Sem mudança: continua a pergunta 0(c). |
| **S6** haste da troca cruza o número da barra | Aceito de graça: a haste agora para acima do número da barra (`semnumero`, 10/10 e 08/10 limpos). |

Nenhum bloqueio ou "corrige" foi recusado. O que o revisor não pôde verificar (leitor de tela, Safari e Opera, zoom de 200%, mouse sobre o gráfico) continua não verificado. Fora desta pasta nada foi alterado.

## 7. Fonte única dos números e tabela de coerência (r3)

**Fonte única.** Todo número do cabeçalho agora sai da série de `3b-dados.js` (função no fim de `D.mundo`), nunca é digitado: views do vídeo = `viewsAntes` (views anteriores ao início da série, o único número digitado) + soma dos dias medidos + estimativa (média por dia medido) dos dias ainda não entregues; curtidas e comentários = views x taxa do mundo; engajamento = (curtidas + comentários) / views; "o normal do canal" = views / mediana dos outros vídeos (a mediana é digitada); idade = dias entre a publicação e "hoje" do estado. Antes e depois, totais de impressões e cliques, contagens de dias, a linha-resumo, a contagem por estado e as datas de "primeiro dia" e "janela cheia" já saíam da série por código. `coerencia.mjs` (nesta pasta) confere tudo isso nos 10 estados, a 1440 e a 390, lendo a tela renderizada e recalculando da série: **0 falhas** (`node docs/superpowers/mockups/2026-10-13-a5-lote-2/3b-video-proprio-faixas-ab-e-registro/coerencia.mjs`, `W=390` para o estreito, `V=1` imprime os números). Contradições achadas e corrigidas nesta rodada (nenhuma delas citada na r3): `semnumero` dizia 96 views no cabeçalho para um vídeo de 7 dias cujo gráfico, que cobre a vida inteira, soma 27 (agora 32 = 27 + 5 do dia ainda não entregue); `so-reconstruido` dizia 241 views com engajamento de 8/118 (agora 223 views e 3,6%); `tipico` dizia 4120 views para um vídeo cuja série inteira soma 3.003 mais 55 estimadas (3,06 mil, 1,7x o normal, antes 2,3x); `extremo` dizia 482 mil (agora 231 mil e 8,8x); os estados `hoje`, `erro`, `vazio` e `so-teste` mostram o mesmo vídeo com 96 views (antes 118) e `zero` 108 (antes 118 igual a `hoje`, que tem outra data).

Regras que a tabela confere em todo estado: (a) views do cabeçalho >= soma dos dias medidos do gráfico, e igual a ela mais a estimativa quando o gráfico cobre a vida toda; (b) impressões >= views do gráfico; (c) dias medidos + zero + não medidos = dias do gráfico; (d) cada lado de antes e depois recalculado da série dá os mesmos dias e as mesmas impressões que a tela mostra, nunca inclui o dia anterior à troca, o dia da troca, o dia da publicação, um dia não fechado, outra troca ou um ciclo de teste; (e) "primeiro dia depois da troca" = troca + 1 (o mesmo início da janela "depois" das outras trocas), "chega do YouTube em" = troca + 3 e "leitura completa" = troca + 9, e só aparecem quando não há dia fechado depois da troca e a entrega ainda não passou (r4/B2); (h) o que está DESENHADO fecha com a frase: soma dos números de cliques sob o gráfico e soma da coluna "Cliques estimados" da tabela = total da frase; "cerca de" só quando todo dia tem menos de 1 (r4/B1); (f) contagens (frase-resumo, linha do topo, contagem por estado, itens da lista, ciclos do teste) = dados; (g) datas: troca >= registro e >= publicação, <= hoje, em ordem; ciclo <= fim do teste; idade e dia da semana batem com a data.

Legenda das colunas: "deriva de" = onde o número nasce; "fecha com" = o que mais na mesma tela tem de concordar.

### 7.1 `tipico` (hoje 17/11; publicado 22/09; último dia fechado 15/11)

| Número na tela | Deriva de | Fecha com |
|---|---|---|
| há 56 dias | 22/09 a 17/11 | data de publicação do cabeçalho |
| (r4/S4: o vídeo agora é "Quanto custa uma semana em Bangkok?", 13:32, para não repetir título e duração do vídeo de 14/07 com outra data de publicação) 3,06 mil views, 139 curtidas, 17 comentários, 5,1%, 1,7x | série de views desde 22/09: 3.003 nos dias medidos (1.477 no gráfico de 12/10 a 16/11 e 1.526 de 22/09 a 11/10) + 55 estimadas para o dia 16/11, ainda não entregue = 3.058 (3,06 mil); taxas 4,56% e 0,56%; mediana 1.790 | gráfico: 1.477 views em 35 dias medidos (menor que o cabeçalho); 139 + 17 = 156 = 5,1% de 3.058 |
| 1.477 views em 35 dias medidos (42 por dia) | soma de `vistaViews`, 36 dias de 12/10 a 16/11, 1 não medido (16/11) | 35 + 1 = 36 dias; 1.477 / 35 = 42 |
| 3.031 impressões, 131 cliques, 35 + 0 + 1 = 36 dias | soma de `vistaImp`; cliques = soma do número de cada dia (arredondado, como aparece) | views do gráfico (1.477) menor que impressões; 35 números de cliques desenhados somam 131 e a coluna da tabela também (r4/B1: antes dizia 132, a soma exata arredondada no fim) |
| Troca 1 (03/11): antes sem dias (teste A/B logo antes, último ciclo 01/11), depois 4 dias 04/11 a 07/11, 295 impressões, 4,1% (2,3% a 7,0%) | série; corte pela troca 2 (09/11 menos 2 dias = 07/11) e pelo ciclo 01/11 | troca 2: antes = os mesmos 4 dias e 295 impressões |
| Troca 2 (09/11): depois 6 dias 10/11 a 15/11, 462 impressões, 5,8% (4,0% a 8,4%) | série; 15/11 é o último dia fechado | 4,1% e 5,8% com faixas que se cruzam = "sem diferença firme" |
| Teste 20/10 a 02/11, 5 ciclos; vencedor aplicado em 03/11 | dados do teste | troca 1 em 03/11, origem "vencedor", ciclos 20/10 a 01/11 dentro do teste |
| 2 trocas e 1 teste A/B; contagem 1 + 1 | dados | 2 itens de troca e 1 de teste na lista |

### 7.2 `extremo` (hoje 17/11; publicado 04/08; último fechado 15/11)

| Número na tela | Deriva de | Fecha com |
|---|---|---|
| há 105 dias | 04/08 a 17/11 | cabeçalho |
| 231 mil views, 10.480 curtidas, 1.643 comentários, 5,2%, 8,8x | série desde 04/08: 229.149 nos dias medidos (57.271 no gráfico) + 2.203 estimadas para 16/11 = 231.352 (231 mil); taxas 4,53% e 0,71%; mediana 26.210 | gráfico: 57.271 views nos 36 dias da janela (menor); 231.352 / 26.210 = 8,8 |
| 57.271 views em 35 dias medidos (1.636 por dia) | soma de `vistaViews` | 1.636 x 35 = 57.271 |
| 118.798 impressões, 5.217 cliques, 35 + 0 + 1 = 36 dias | `vistaImp`; cliques = soma do número de cada dia (r4/B1: antes dizia 5.220, e a coluna da tabela somava 5.217) | views do gráfico (57.271) menor que impressões; 4,4% de cliques entre os 2,8% e 7,5% das trocas |
| 6 trocas, 2 testes; contagem 1 subiu + 4 sem dias + 1 origem não sabida = 6 | dados e `D.leitura` | 6 itens de troca; marcas 1 a 6 no gráfico |
| Troca 1 (20/10): depois 7 dias 21/10 a 27/10, 24.976 impressões, 2,8% (2,6% a 3,0%) | série | troca 2: antes 7 dias 22/10 a 28/10, 25.750, 2,8% (janelas deslocadas de 1 dia, cada uma terminando 2 dias antes da troca ou 7 dias depois da outra) |
| Troca 2 (30/10): depois 4 dias 31/10 a 03/11, 12.299 impressões, 7,5% (7,0% a 8,0%); "subiu de 2,8% para 7,5%, faixas não se cruzam" | série; corte em 03/11 (troca 3 menos 2 dias) | troca 3: antes = os mesmos 4 dias e 12.299; 2,6% a 3,0% e 7,0% a 8,0% não se cruzam |
| Trocas 3, 4, 5 sem dias para comparar | datas 05/11, 06/11, 12/11 e ciclos 08/11, 10/11 | cada frase cita a vizinha certa: (3) tem a (4) 1 dia depois; (4) tem a (3) 1 dia antes e o ciclo de 08/11, 2 dias depois; (5) tem o ciclo de 10/11 antes e a (6) 2 dias depois |
| Teste A 14/10 a 19/10, 3 ciclos, vencedor em 20/10; teste B 08/11 a 11/11, 2 ciclos, parado em 12/11 | dados | troca 1 em 20/10 (vencedor de A) e troca 5 em 12/11 (restauro de B) |

### 7.3 `hoje` (hoje 13/10; publicado 14/07; último fechado 11/10)

| Número na tela | Deriva de | Fecha com |
|---|---|---|
| há 91 dias | 14/07 a 13/10 | cabeçalho |
| 96 views, 6 curtidas, 1 comentário, 7,3% | 84 views antes de 14/09 + 11 do gráfico + 1 estimada para os 3 dias não entregues | gráfico: 11 views em 26 dias medidos (0,4 por dia); 7 / 96 = 7,3% |
| 30 impressões, cerca de 3 cliques, 26 + 0 + 3 = 29 dias (14/09 a 12/10) | `vistaImp`; não medidos: 27/09, 28/09 e 12/10 (depois do último fechado) | 29 dias na meta do gráfico; views (11) menor que impressões (30); todo dia com menos de 1 clique, por isso "cerca de" e nenhum número sob os pontos (r4/B1, S3) |
| Troca 1 (09/10): antes 7 dias 01/10 a 07/10, 8 impressões; depois 1 dia (10/10), 1 impressão | série; o depois pára em 10/10 porque a troca 2 (12/10) corta 2 dias antes | troca 2: antes = 1 dia (10/10), 1 impressão (mesmo dia) |
| Troca 2 (12/10): depois ainda não medido; primeiro dia depois da troca 13/10, chega do YouTube em 15/10, leitura completa em 21/10 | 12/10 + 1, + 3 e + 9 (r4/B2) | o "depois" da troca 1 da mesma tela também começa no dia seguinte à troca (09/10 e 10/10); último fechado 11/10 (nenhum dia depois de 12/10 fechado) |
| 2 trocas; contagem 1 + 1 | dados | 2 itens |

### 7.4 `zero` (hoje 20/10; publicado 14/07; último fechado 18/10)

| Número na tela | Deriva de | Fecha com |
|---|---|---|
| há 98 dias | 14/07 a 20/10 | cabeçalho |
| 108 views, 6 curtidas, 1 comentário, 6,5% | 101 antes de 21/09 + 6 do gráfico + 1 estimada | 6 views em 26 dias medidos (0,2 por dia) |
| 12 impressões, cerca de 1 clique, 7 com impressão + 19 zero + 3 não medidos = 29 dias (21/09 a 19/10) | `vistaImp`; não medidos 30/09, 15/10, 19/10 | views (6) menor que impressões (12) |
| Troca 1 (09/10): antes 7 dias 01/10 a 07/10, 0 impressões (zero medido); depois **6 dias medidos (10/10 a 16/10, sem 15/10)**, 0 impressões (zero medido; r6/B1: o 15/10 é não medido e o rótulo agora o cita) | série | 10/10 a 16/10 são 7 dias de calendário - 1 não medido = 6; os 19 dias zero incluem esses 13; nenhum dia "não medido" entra na soma |

### 7.5 `semnumero` (hoje 13/10; publicado 06/10; último fechado 11/10)

| Número na tela | Deriva de | Fecha com |
|---|---|---|
| há 7 dias | 06/10 a 13/10 | cabeçalho |
| 32 views, 2 curtidas, 0 comentários, 6,3% | gráfico cobre a vida inteira: 27 medidos + 5 estimados para 12/10 | 27 views em 6 dias medidos (4,5 por dia); 4,5 x 1 = 5 |
| 55 impressões, cerca de 3 cliques, 6 + 0 + 1 = 7 dias | `vistaImp` | 7 dias de 06/10 a 12/10; views (27) menor que impressões (55); "<1" por dia, 3 no total (55 x 5%) |
| Troca 1 (08/10): sem antes (vídeo saiu 2 dias antes), depois cortado pela troca 2 (10/10) | datas | troca 2: antes cortado pela troca 1 (2 dias antes) e depois pela troca 3 (2 dias depois) |
| Troca 3 (12/10): depois não medido, primeiro dia depois da troca 13/10, chega em 15/10, leitura completa em 21/10; antes cortado pela troca 2 | 12/10 + 1, + 3 e + 9 (r4/B2) | último fechado 11/10 |

### 7.6 `so-teste`, `vazio`, `erro`, `so-reconstruido` (hoje 13/10)

| Estado | Número na tela | Deriva de e fecha com |
|---|---|---|
| `so-teste` | 96 views; 11 views, 30 impressões, 26 + 0 + 3 = 29 dias | igual a `hoje` (mesmo vídeo e mesma série) |
| `so-teste` | teste desde 03/10, 4 ciclos (03, 06, 09, 12/10), em andamento; "0 trocas fora do A/B Lab" | ciclos dentro do teste e até hoje; teste começa antes do registro (07/10) e a régua diz "começou em 03/10" |
| `vazio` | 96 views; 0 trocas, 0 testes | mesmos números do gráfico de `hoje`; nenhum item de lista |
| `erro` | 96 views; troca 1 (09/10) com antes 7 dias 01/10 a 07/10 (8 impressões) e depois 2 dias 10/10 a 11/10 (3 impressões) | sem a troca 2 de `hoje`, o depois vai até 11/10, o último fechado; "leitura de 12/10 e de 13/10 falharam, trocas certas até 11/10" = hoje 13/10 e último dia certo 11/10 |
| `so-reconstruido` | 223 views (212 antes de 14/09 + 10 do gráfico + 1), 3,6%; há 148 dias | 18/05 a 13/10; 10 views em 26 dias medidos; 28 impressões e cerca de 2 cliques (todo dia abaixo de 1) |
| `so-reconstruido` | teste de 31/05 a 07/06, 4 ciclos (31/05, 02/06, 04/06, 06/06), "ciclo 1 de 4" a "ciclo 4 de 4" | ciclos de 2 em 2 dias dentro do teste; todos depois da publicação (18/05) e antes do registro (07/10) |

### 7.7 `leitura` (mesmo vídeo e série de `tipico`)

| Número na tela | Deriva de | Fecha com |
|---|---|---|
| 3,06 mil views, 139, 17, 5,1%, 1,7x | igual a `tipico` (público) | 1.477 views em 35 dias medidos no gráfico |
| Nenhuma impressão, clique ou taxa | privado: a caixa com cadeado diz isso | linha do topo sem veredito de taxa (r3/B1); chips de leitura só em "origem não sabida" (público); contagem trocada por "taxa de clique: só para quem administra" |

Conferido contra as capturas (abertas: `extremo` 390 claro, `semnumero` 390 claro, `leitura` 1440 escuro, `vazio` 390 claro ; os recortes de revisão foram apagados): os números das tabelas são os que aparecem.

## 8. Resposta à revisão r3 (`REVISAO-UX-r3.md`)

Capturas refeitas para os 10 estados nas duas larguras e nos dois temas (`shots/index-caso-*`), `shots/medidas.json` refeito (40 casos: rolagem 0, texto menor que 12 px 0, alvo menor que 44 px 0), 0 erro de JavaScript, `color-mix()` só em comentário, `coerencia.mjs` com 0 falhas a 1440 e a 390. Os recortes `shots/r2*`, `r3*` e `r4-*` foram apagados na r5 (S6 da r4): as capturas completas de `shots/index-caso-*` são as vigentes.

| Item | Resposta |
|---|---|
| **B1** só leitura mostra o veredito de taxa | Aceito. Com `leitura`, o chip de cada troca só existe para "origem não sabida" (a origem é pública); o chip "sem dias para comparar" e "≈ sem diferença firme" saíram. A mesma fuga existia na linha do topo ("título (1) em 03/11, sem dias para comparar; thumbnail (2) ... sem diferença firme"), que a revisão não citou: agora só data ("título (1) em 03/11; thumbnail (2) em 09/11; ..."). Capturas de `leitura` refeitas (4 combinações). |
| **C1** faixa de cliques vazia a 390 px | Aceito, com os dois limites separados: o ponto aparece a partir de 5 px por dia (raio menor abaixo de 7,5 px), o número só a partir de 7,5 px; sem número, a faixa diz "cliques estimados · valor ao ler o dia". 35 pontos para 35 barras em `tipico` e `extremo` a 360, 390 e 1440. |
| **C2** "Os dois lados foram cortados" | Aceito, e a frase inteira foi reescrita por código para todos os casos: um lado: "A troca (4) vem 1 dia depois desta: não sobra dia inteiro desse lado."; dois lados: "A troca (1) vem 2 dias antes desta e a troca (3), 2 dias depois: não sobra dia inteiro para nenhum dos lados."; com ciclo de teste, a frase cita a data do ciclo e termina em "Comparar ciclos é do A/B Lab." Não existe mais "cortado" nem "nenhum dia inteiro fica entre as duas" na tela. |
| **C3** "482310 views" no cabeçalho | Aceito, sem tocar em `lote.js`: `3b.js` formata como o vídeo aprovado ("231 mil", "3,06 mil", abaixo de mil o número inteiro). O número em si agora vem da série (seção 7). Curtidas e comentários ficam como no aprovado. |
| **S1** "·" sobrando nas linhas quebradas | Aceito. Os itens da linha-resumo perderam o "·" e ganharam respiro; cada item já começa pelo símbolo. |
| **S2** ▲ com dois sentidos | Pergunta ao dono (nova, 7): ▲ é "troca de thumbnail" no gráfico e "taxa subiu" no chip (verde). Mantido como no mockup 3 aprovado. Se o dono quiser, o chip passa a "↑". |
| **S3** pastilha "0" solta | Aceito. A pastilha agora diz "0 trocas" na própria caixa vazada. |
| **S4** listras atravessam o texto da caixa hachurada | Aceito. Um retângulo sólido na cor do fundo do "não medido" (token existente) fica atrás do texto; as listras ficam em volta. |
| **S5** texto do SVG a 11,4 px a 360 px | Sem mudança, como na r2: 360 está fora do par obrigatório; a 390 todo texto tem 12 px ou mais. |
| **Varredura de coerência (pedida pelo dono, fora da r3)** | Seção 7: 5 contradições de números achadas e corrigidas pela fonte única (cabeçalho contra gráfico em `semnumero`, `so-reconstruido`, `tipico`, `extremo`, e engajamento digitado). Nenhum conserto de antes e depois foi necessário: todos os lados recalculados da série bateram. |

Nenhum item foi recusado. Fora desta pasta nada foi alterado.

## 9. Resposta à revisão r4 (`REVISAO-UX-r4.md`)

Capturas dos 10 estados refeitas nas duas larguras e nos dois temas com `capturar.mjs` (40 casos; `shots/medidas.json`: rolagem 0, texto menor que 12 px 0, alvo menor que 44 px 0). `coerencia.mjs` estendido e com 0 falhas a 1440 e a 390. `color-mix()` só em comentário. Abertas e conferidas a olho: `hoje` 390 claro e 1440 escuro (faixa de cliques, frase "cerca de 3", cartão "o normal do canal"), `tipico` 1440 escuro (35 números de cliques, 131), `semnumero` 390 claro (frase de "primeiro dia"). Fora desta pasta nada foi alterado.

| Item | Resposta |
|---|---|
| **B1** soma dos cliques por dia não fecha com o total (132 contra 131; 5.220 contra 5.217) | Aceito. O total é a soma dos números do dia como aparecem (`resumoImp`): `tipico` 131, `extremo` 5.217; os 35 números sob o gráfico e a coluna da tabela somam o mesmo. Quando todo dia tem menos de 1 clique (nenhum número escrito), o total é a soma exata arredondada e a frase diz "cerca de" (`hoje` e vizinhos: "cerca de 3 cliques"); o ⓘ diz a conta. O `coerencia.mjs` agora soma o que está DESENHADO (rótulos do SVG e coluna da tabela) e compara com a frase; antes só refazia a conta sobre a mesma série. A taxa de antes e depois continua sobre a soma exata (nenhum número de clique aparece nos lados, só a taxa). |
| **B2** "Primeiro dia depois da troca: 15/10" contradiz o "depois" que começa no dia seguinte | Aceito, com o texto do revisor: "Ainda não dá para comparar. O primeiro dia depois da troca (13/10) só chega do YouTube em 15/10. Leitura completa em 21/10." (`hoje` troca 2 e `semnumero` troca 3). A regra (e) do `coerencia.mjs` agora exige troca + 1, troca + 3 e troca + 9 e recusa a frase antiga. |
| **C1** ⓘ diz "o canal tem poucas impressões" onde a tela mostra de 295 a 25.750 | Aceito: item reduzido a "Menos de 100 impressões num lado: sem taxa e sem faixa, só "ainda não dá para dizer"." |
| **C2** seção 2 com texto da r2 | Aceito: reescritas "Frase de cada leitura", "Sem troca", "Linha acima dos gráficos" (4 linhas a 390) e acrescentada "Total de cliques". |
| **S1** views 11 vezes os cliques | Virou pergunta ao dono (7 em "Dúvidas"). Não mudei: mexe em todo número derivado. |
| **S2** "10480 curtidas", "1643 comentários" | Aceito, sem tocar em `lote.js`: `3b.js` formata com `A.n` (10.480 e 1.643). |
| **S3** "<1" repetido 26 vezes | Aceito: quando todo dia com impressão tem menos de 1 clique, a faixa mostra só os pontos e a legenda "cliques estimados por dia: menos de 1 em cada dia" (a 390: "cliques estimados: menos de 1 por dia"); a tabela "Ver como tabela" mantém "<1" por dia. Mudança em `a4-comum.js` (marcada "3b r4/S3"). |
| **S4** mesmo vídeo, datas diferentes | Aceito: `tipico` e `leitura` agora são "Quanto custa uma semana em Bangkok?" (13:32), outro vídeo, com os títulos de antes e depois da troca 1 trocados junto. |
| **S5** "Ver antes e depois" em `so-teste` | Aceito: o link só aparece com ao menos uma troca. |
| **S6** lixo em `shots/` | Aceito: `r2*`, `r2b*`, `r3*`, `r4-*` e o arquivo com espaço no nome apagados; ficam as capturas vigentes e os 4 recortes da revisão (`r4rev-*`). |
| **Varredura de coerência (pedida pelo dono), em todos os estados** | Duas contradições novas, que a revisão não citou: (1) "o normal do canal" dizia "faltam dias medidos para comparar" ao lado de "11 views em 26 dias medidos" em `hoje`, `zero`, `so-teste`, `so-reconstruido`, `vazio` e `erro`; agora diz "a mediana dos outros vídeos ainda não foi medida" (o motivo é a mediana, não os dias deste vídeo). (2) Em `hoje` e vizinhos a frase dizia "3 cliques" sobre uma faixa em que cada dia era "<1": agora "cerca de 3" com a legenda. Conferidos sem achado: idades e dias da semana, soma de dias (medidos + zero + não medidos), cada lado de antes e depois recalculado da série (15 trocas), cabeçalho contra gráfico, "26 dias medidos" contra a meta do gráfico, contagens (1 + 4 + 1 = 6), vizinhas citadas em cada "sem dias para comparar", ciclos dentro do teste, "hoje" de cada estado contra a data da frase de exemplo. |

### 9.1 Tabela de coerência gerada do que a tela mostra (r4)

Saída de `tabela.mjs` (lê o DOM de cada estado a 1440; a 390 o texto é o mesmo fora dos rótulos de eixo, conferido por `W=390 coerencia.mjs`). Cada número abaixo tem de fechar com os da mesma linha: o gráfico de views com o cabeçalho (menor ou igual), as impressões com as views (maiores), os cliques desenhados com o total da frase, os lados de cada troca com a série. A seção 7 diz de onde cada um deriva.

| Estado (hoje) | Cabeçalho: views / curtidas / comentários / engajamento / vezes o normal | Gráfico de views (frase) | Gráfico de impressões (frase) | Soma dos cliques desenhados / da coluna da tabela | Cada troca: antes e depois como a tela mostra |
|---|---|---|---|---|---|
| `tipico` (17/11) | 3,06 mil / 139 / 17 / 5,1% / 1,7× | 1.477 views em 35 dias medidos (42 por dia). | 3.031 impressões e 131 cliques estimados em 36 dias | 131 (35 rótulos) / 131 | 1: antes sem dias para comparar; depois 4 dias (04/11 a 07/11), 295 impressões<br>2: antes 4 dias (04/11 a 07/11), 295 impressões; depois 6 dias (10/11 a 15/11), 462 impressões |
| `extremo` (17/11) | 231 mil / 10.480 / 1.643 / 5,2% / 8,8× | 57.271 views em 35 dias medidos (1.636 por dia). | 118.798 impressões e 5.217 cliques estimados em 36 dias | 5217 (35 rótulos) / 5217 | 1: antes sem dias para comparar; depois 7 dias (21/10 a 27/10), 24.976 impressões<br>2: antes 7 dias (22/10 a 28/10), 25.750 impressões; depois 4 dias (31/10 a 03/11), 12.299 impressões<br>3: antes 4 dias (31/10 a 03/11), 12.299 impressões; depois sem dias para comparar<br>4: antes sem dias para comparar; depois sem dias para comparar<br>5: antes sem dias para comparar; depois sem dias para comparar<br>6: antes —; depois — |
| `hoje` (13/10) | 96 / 6 / 1 / 7,3% / não medido | 11 views em 26 dias medidos (0,4 por dia). | 30 impressões e cerca de 3 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma | 1: antes 7 dias (01/10 a 07/10), 8 impressões; depois 1 dia (10/10), 1 impressão<br>2: antes 1 dia (10/10), 1 impressão; depois ainda sem dia medido |
| `zero` (20/10) | 108 / 6 / 1 / 6,5% / não medido | 6 views em 26 dias medidos (0,2 por dia). | 12 impressões e cerca de 1 clique estimado em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma | 1: antes 7 dias (01/10 a 07/10), 0 impressões; depois 6 dias (10/10 a 16/10), 0 impressões |
| `semnumero` (13/10) | 32 / 2 / 0 / 6,3% / não medido | 27 views em 6 dias medidos (4,5 por dia). | 55 impressões e cerca de 3 cliques estimados em 7 dias | sem rótulos numéricos / dias com "<1": a tabela não soma | 1: antes sem dias para comparar; depois sem dias para comparar<br>2: antes sem dias para comparar; depois sem dias para comparar<br>3: antes sem dias para comparar; depois ainda sem dia medido |
| `so-teste` (13/10) | 96 / 6 / 1 / 7,3% / não medido | 11 views em 26 dias medidos (0,4 por dia). | 30 impressões e cerca de 3 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma |  |
| `so-reconstruido` (13/10) | 223 / 7 / 1 / 3,6% / não medido | 10 views em 26 dias medidos (0,4 por dia). | 28 impressões e cerca de 2 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma |  |
| `vazio` (13/10) | 96 / 6 / 1 / 7,3% / não medido | 11 views em 26 dias medidos (0,4 por dia). | 30 impressões e cerca de 3 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma |  |
| `erro` (13/10) | 96 / 6 / 1 / 7,3% / não medido | 11 views em 26 dias medidos (0,4 por dia). | 30 impressões e cerca de 3 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma | 1: antes 7 dias (01/10 a 07/10), 8 impressões; depois 2 dias (10/10 a 11/10), 3 impressões |
| `leitura` (17/11) | 3,06 mil / 139 / 17 / 5,1% / 1,7× | 1.477 views em 35 dias medidos (42 por dia). |  | sem rótulos numéricos / 0 | 1: antes —; depois —<br>2: antes —; depois — |

## 10. Resposta à revisão r5 (`REVISAO-UX-r5.md`)

Capturas dos 10 estados refeitas nas duas larguras e nos dois temas (40 casos, `shots/medidas.json`: rolagem 0, texto menor que 12 px 0, alvo menor que 44 px 0); `shots/` só tem `index-caso-*` e `medidas.json` (recortes das revisões apagados). `coerencia.mjs` com 0 falhas a 1440 e a 390; desfiz o conserto de B1 em memória e o `coerencia.mjs` falhou nos dois estados "um mês depois", logo o teste novo pega a classe de erro. `color-mix()` só em comentário. Abertas e conferidas a olho: `hoje` 390 claro (pager "vídeo 19 de 35", legendas, fala das duas telas, régua e cartões) e a leitura dos 10 estados em texto (`innerText` do `#screen`).

| Item | Resposta |
|---|---|
| **B1** fala do dia de impressões diz "o dia ainda não chegou" para dia do passado | Aceito. Uma função só (`falaNm` em `3b.js`) serve os dois gráficos: "o YouTube não entregou este dia (não medido)", e "ainda não entregou" só para dia depois do último fechado (o de ontem, que de fato vai chegar). A legenda "não medido: o YouTube não entregou o dia" também passou a ser a mesma nos dois gráficos (`cfgBase`). |
| **C1** ⓘ "janela cheia, cerca de 10" contra "21/10" (9 dias) | Aceito. O texto sai de `A.JANELA + 2`: "a leitura completa, cerca de 9 dias depois da troca". |
| **S1** views x cliques (11 vezes) | Segue como pergunta ao dono (dúvida 7); não mexi. |
| **S2** "vídeo 1 de 35" em todo estado | Aceito. Pager local em `3b.js`: a posição vem da idade do vídeo (1 vídeo a cada 5 dias, 35 no canal): 12 (Bangkok), 22, 19, 20, 2, 30. "Anterior" só desabilita no 1. Sem editar `lote.js`. |
| **S3** método dos cliques só no ⓘ de duas telas abaixo | Aceito: o ⓘ do gráfico de impressões ganhou "Cliques estimados: impressões do dia × taxa do dia; o total é a soma dos números sob as barras; todo dia abaixo de 1 vira 'cerca de'". |
| **S4** ⓘ de quem só lê fala de cliques e "seu canal" | Aceito: em `leitura` o ⓘ de "Trocas deste vídeo" tem só início do registro, quais trocas contam, origem não sabida e uma fonte que diz "dados públicos do YouTube" e que a comparação é privada. |
| **S5** barra diz 158 impressões, tela diz 30 | Aceito: "158 impressões em 30 dias (o vídeo do estado “hoje” tem 30 delas)". |
| **S6** ⓘ afirma hábito sem dado; lixo em `shots/` | Aceito: "a troca pode ter sido feita porque o vídeo ia mal". Recortes `r4rev-*` e `r5rev-*` apagados. |
| **`coerencia.mjs` cego ao leitor de dia e aos ⓘ** | Estendido: clica "Dia seguinte" dos dois gráficos em cada estado e exige (a) a fala começar pelo dia certo, (b) a mesma frase para o mesmo dia não medido nos dois gráficos, (c) "ainda" só depois do último fechado e só no dia de ontem, (d) zero com "zero medido", dia com número sem "não medido"; lê todos os ⓘ e confere janela, limiar, data do registro, "cerca de 9", ausência de "costuma trocar" e de cliques no ⓘ de `leitura`; confere a posição do pager e que o vídeo não tem mais impressões que os dois canais somados. |
| **Varredura nova (todos os estados)** | Leitura integral do texto renderizado dos 10 estados e do desenho: sem contradição de número. Achei um ponto de honestidade, não de número, e corrigi: o "antes" de uma troca pode começar antes de 07/10 (hoje, 01/10 a 07/10), onde o sistema não registra trocas; o ⓘ "Início do registro" agora diz que esse "antes" pode misturar versões. |

### 10.1 Tabela de coerência (gerada por `tabela.mjs` do que a tela mostra; a seção 7 diz de onde cada número deriva; `coerencia.mjs` confere)

Regras que cada linha tem de cumprir: views do cabeçalho maiores ou iguais à soma do gráfico; impressões maiores ou iguais às views do gráfico; com impressão + zero + não medidos = dias do gráfico; soma dos cliques desenhados = coluna da tabela = frase; cada lado de cada troca = soma da série no intervalo mostrado; o dia não medido tem a mesma fala nos dois gráficos; troca + 1 = primeiro dia depois, + 3 = chega do YouTube, + 9 = leitura completa; posição no pager = 1 + idade ÷ 5.

| Estado (hoje) | Cabeçalho: views / curtidas / comentários / engajamento / vezes o normal | Gráfico de views (frase) | Gráfico de impressões (frase) | Soma dos cliques desenhados / da coluna da tabela | Cada troca: antes e depois como a tela mostra |
|---|---|---|---|---|---|
| `tipico` (17/11) | 3,06 mil / 139 / 17 / 5,1% / 1,7× | 1.477 views em 35 dias medidos (42 por dia). | 3.031 impressões e 131 cliques estimados em 36 dias | 131 (35 rótulos) / 131 | 1: antes sem dias para comparar; depois 4 dias (04/11 a 07/11), 295 impressões<br>2: antes 4 dias (04/11 a 07/11), 295 impressões; depois 6 dias (10/11 a 15/11), 462 impressões |
| `extremo` (17/11) | 231 mil / 10.480 / 1.643 / 5,2% / 8,8× | 57.271 views em 35 dias medidos (1.636 por dia). | 118.798 impressões e 5.217 cliques estimados em 36 dias | 5217 (35 rótulos) / 5217 | 1: antes sem dias para comparar; depois 7 dias (21/10 a 27/10), 24.976 impressões<br>2: antes 7 dias (22/10 a 28/10), 25.750 impressões; depois 4 dias (31/10 a 03/11), 12.299 impressões<br>3: antes 4 dias (31/10 a 03/11), 12.299 impressões; depois sem dias para comparar<br>4: antes sem dias para comparar; depois sem dias para comparar<br>5: antes sem dias para comparar; depois sem dias para comparar<br>6: antes —; depois — |
| `hoje` (13/10) | 96 / 6 / 1 / 7,3% / não medido | 11 views em 26 dias medidos (0,4 por dia). | 30 impressões e cerca de 3 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma | 1: antes 7 dias (01/10 a 07/10), 8 impressões; depois 1 dia (10/10), 1 impressão<br>2: antes 1 dia (10/10), 1 impressão; depois ainda sem dia medido |
| `zero` (20/10) | 108 / 6 / 1 / 6,5% / não medido | 6 views em 26 dias medidos (0,2 por dia). | 12 impressões e cerca de 1 clique estimado em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma | 1: antes 7 dias (01/10 a 07/10), 0 impressões; depois 6 dias (10/10 a 16/10), 0 impressões |
| `semnumero` (13/10) | 32 / 2 / 0 / 6,3% / não medido | 27 views em 6 dias medidos (4,5 por dia). | 55 impressões e cerca de 3 cliques estimados em 7 dias | sem rótulos numéricos / dias com "<1": a tabela não soma | 1: antes sem dias para comparar; depois sem dias para comparar<br>2: antes sem dias para comparar; depois sem dias para comparar<br>3: antes sem dias para comparar; depois ainda sem dia medido |
| `so-teste` (13/10) | 96 / 6 / 1 / 7,3% / não medido | 11 views em 26 dias medidos (0,4 por dia). | 30 impressões e cerca de 3 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma |  |
| `so-reconstruido` (13/10) | 223 / 7 / 1 / 3,6% / não medido | 10 views em 26 dias medidos (0,4 por dia). | 28 impressões e cerca de 2 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma |  |
| `vazio` (13/10) | 96 / 6 / 1 / 7,3% / não medido | 11 views em 26 dias medidos (0,4 por dia). | 30 impressões e cerca de 3 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma |  |
| `erro` (13/10) | 96 / 6 / 1 / 7,3% / não medido | 11 views em 26 dias medidos (0,4 por dia). | 30 impressões e cerca de 3 cliques estimados em 29 dias | sem rótulos numéricos / dias com "<1": a tabela não soma | 1: antes 7 dias (01/10 a 07/10), 8 impressões; depois 2 dias (10/10 a 11/10), 3 impressões |
| `leitura` (17/11) | 3,06 mil / 139 / 17 / 5,1% / 1,7× | 1.477 views em 35 dias medidos (42 por dia). |  | sem rótulos numéricos / 0 | 1: antes —; depois —<br>2: antes —; depois — |

Fala dos dias não medidos (lida dos dois gráficos pelo `coerencia.mjs`): `tipico`/`extremo` 16/11 "ainda não entregou" (ontem, último fechado 15/11) nos dois; `hoje`, `so-teste`, `so-reconstruido`, `vazio`, `erro` 27/09, 28/09 "não entregou" nos dois e 12/10 "ainda não entregou"; `zero` 30/09, 15/10 "não entregou" e 19/10 "ainda não entregou"; `semnumero` 12/10 "ainda não entregou". Pager: `tipico` e `leitura` 12 de 35 (56 dias), `extremo` 22 (105), `hoje`, `so-teste`, `vazio`, `erro` 19 (91), `zero` 20 (98), `semnumero` 2 (7), `so-reconstruido` 30 (148).


## 11. Resposta à revisão r6 (`REVISAO-UX-r6.md`)

Capturas dos 10 estados refeitas nas duas larguras e nos dois temas (40 casos, `shots/medidas.json`: rolagem 0, texto menor que 12 px 0, alvo menor que 44 px 0); `shots/` só tem `index-caso-*` (40 png) e `medidas.json`; os 4 arquivos de nome gigante e os 3 `r6rev-*` foram apagados. Abertas e conferidas a olho: `zero` 390 claro e 1440 escuro (cartão da troca 1 inteiro, rótulo do "Depois" sem corte), cabeçalho de `hoje` 1440 escuro e de `extremo` 390 claro (miniatura nova). `coerencia.mjs` com 0 falhas a 1440 e a 390; `derivacao.mjs` (novo) com 0 linhas em falha nas duas larguras; `color-mix()` só em comentário.

| Item | Resposta |
|---|---|
| **B1** `zero`: "Depois: 6 dias (10/10 a 16/10)" são 7 dias de calendário | Aceito. `soma()` (`3b-dados.js`) agora guarda os dias não medidos que caem DENTRO do intervalo (`r.nm`); `rotLado()` (`3b.js`) escreve "Depois: 6 dias medidos (10/10 a 16/10, sem 15/10), 0 impressões" (vários: "sem 15/10 e 17/10"); sem dia pulado o texto não muda. Achado extra ao abrir a captura: a 390 o rótulo novo, mais longo, saía cortado ("0 im…"); `rotFit()` cai para a forma curta ("Depois: 10/10 a 16/10, sem 15/10, 0 impressões") quando não cabe. Só o `zero` tem dia não medido dentro de um lado (varri os 15 lados com número). |
| **C1** ⓘ de impressões cita "números escritos sob as barras" que a 390 não existem | Aceito, com o texto sugerido: "O total da frase é a soma dos cliques de cada dia: os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela. Quando todo dia tem menos de 1 clique, o total é a soma exata arredondada (“cerca de”)." Vale nas duas larguras. |
| **C2** lixo em `shots/` e NOTAS apontando para recortes inexistentes | Aceito: 4 arquivos e 3 `r6rev-*` apagados (e apagados de novo os 4 que um comando mal formado recriou ao refazer as capturas: conferido `ls shots` = 40 png + `medidas.json`); linha "Conferido contra as capturas" da seção 7 reescrita sem `r4-*`. |
| **S1** views contra cliques (taxa que triplica sem efeito em views) | Segue como pergunta ao dono (dúvida 7 desta NOTAS): se pedir, views = cliques × 1,3 a 2,5 em `viewsDe`. Não mexi sem pedido. Vai junto da entrega. |
| **S2** miniatura do cabeçalho diferente do "depois" da última troca de thumbnail | Aceito, barato: `cabecalho()` troca o placeholder pela mesma `capa()` do "depois" da última troca de thumbnail (muda em `tipico`, `extremo`, `hoje`, `erro` e `leitura`, que têm troca de thumbnail; os estados sem troca de thumbnail ficam como antes). |
| **S3** fala do dia da publicação | Aceito: "Dia da publicação do vídeo." acrescentado à fala do dia nos dois gráficos (`diaPub()`); `coerencia.mjs` exige a frase só no dia da publicação. |
| **S4** "158 em 30 dias" contra "30 em 29 dias" | Aceito: a barra diz "158 impressões em 30 dias nos dois canais. Neste vídeo do estado “hoje”: 30 impressões em 29 dias", com os dois números lidos de `D.mundo('hoje')` (não digitados). |
| **S5** a 390 a pergunta cai logo abaixo da dobra | Não mexi: cabeçalho é do mockup 3 aprovado; miniatura de 140 px a 390 fica como pergunta ao dono se ele quiser a linha uns 60 px mais acima. |
| **S6** "um mês depois" com 41 dias | Aceito: "mais de um mês depois" no aviso de exemplo e na barra. |
| **S7** chip "seu canal" em `leitura` | Pergunta de produto, não de desenho: segue o "seu canal" do mockup 3 aprovado. Vai ao dono: "o canal que você acompanha" para quem só lê? |
| **`coerencia.mjs`: pontos cegos** | Estendido com 5 regras: (a) para todo lado "N dias (dd/mm a dd/mm)": N = dias de calendário entre as datas menos os dias citados em "sem ...", e todo dia não medido do intervalo tem de estar citado; (b) varredura geral: nenhuma data escrita na tela é anterior à publicação nem posterior a hoje (salvo "só chega em" e "Leitura completa em"), "hoje, dd/mm" da régua = hoje do estado, e qualquer "N dias (dd/mm a dd/mm)" da tela fecha; (c) ⓘ que cita "escritos sob as barras" exige número escrito na largura corrente; (d) texto de desenho SVG não passa da borda do desenho; (e) fala do dia da publicação. Testei que (d) enxerga o corte (a medida lê a folga de cada texto). |
| **Varredura de coerência (pedida pelo dono), todos os estados** | Reli o texto dos 10 estados a 1440 e a 390 e refiz cada conta por código (`derivacao.mjs`, 11.1: cada número com a fonte, a conta e a conferência contra o texto renderizado). Fora o B1 e o corte do rótulo a 390 não achei contradição nova de número. Dois pontos de fraseado que não contradizem número, mas conferi: `hoje` troca 2 "Antes: 1 dia (10/10)" e troca 1 "Depois: 1 dia (10/10)" são o mesmo dia 10/10 (a troca 1 acaba 2 dias antes da 2, a 2 começa o antes no mesmo corte); `extremo` troca 6 não escreve lado nenhum (origem não sabida) e `leitura` não escreve impressões (privado). |

### 11.1 Tabela de coerência por estado (r6)

Substituída pela tabela regenerada da r7 em 12.1 (mesmo gerador, `derivacao.mjs`, agora com a linha da frase do topo).

## 12. Resposta à revisão r7 (`REVISAO-UX-r7.md`)

Capturas dos 10 estados refeitas nas duas larguras e nos dois temas (40 casos, `shots/medidas.json`: rolagem 0, texto menor que 12 px 0, alvo menor que 44 px 0; `shots/` = 40 png + `medidas.json`). Abertas e conferidas a olho: `vazio` e `so-reconstruido` (topo a 1440 escuro e a 390 claro, e a faixa reconstruída a 390), `zero` 390 (cartão da troca 1 com o rótulo em duas linhas) e `extremo` 390 (régua, teste A/B, troca 1 e 2). `coerencia.mjs` e `derivacao.mjs`: 0 falhas a 1440 e a 390. `color-mix()` só em comentário.

| Item | Resposta |
|---|---|
| **N2 (bloqueia)** `vazio` e `so-reconstruido` sem frase-resumo no topo | Aceito. `resumoTrocas()` (`3b.js`) agora escreve a linha em todo estado, na mesma posição e no mesmo estilo: `vazio` "Trocas deste vídeo: nenhuma desde 07/10."; `so-reconstruido` "Trocas deste vídeo: nenhuma desde 07/10; um teste A/B de 31/05 a 07/06 foi reconstruído (mais abaixo)." (a data do teste sai de `M.pre.teste`, sem o ano). `coerencia.mjs` ganhou a regra: em todo estado `.tr-res` existe e começa com "Trocas deste vídeo" ou com a contagem. `derivacao.mjs` ganhou a linha "frase do topo" (conta contra os cartões da lista e, em `so-reconstruido`, contra a faixa reconstruída). Capturas dos dois estados refeitas. |
| **N1 (corrige)** ⓘ "Como ler antes e depois", item "Fonte", com a redação antiga | Aceito, com o texto sugerido: "O total é a soma dos cliques de cada dia: os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela. Quando todo dia tem menos de 1 clique, o total é a soma exata arredondada (“cerca de”)." `coerencia.mjs`: a regra (c) agora também reprova "soma dos números", "nenhum número é escrito" e "2 vídeos que tiveram", e exige a frase única sempre que o ⓘ diz "soma dos cliques de cada dia". |
| **S1** views contra cliques | Segue como pergunta ao dono (dúvida 7). Não mexi sem pedido; se ele pedir, `viewsDe` passa a cliques x 1,3 a 2,5. Vai escrita junto da entrega. |
| **S2** mesmo vídeo com histórias diferentes entre estados | Aceito pelo caminho barato: a barra de estados diz "Cada estado é um mundo à parte: o mesmo vídeo pode ter histórias diferentes de um estado para outro." Não troquei o título de nenhum vídeo. |
| **S3** ⓘ da faixa reconstruída cita "os 2 vídeos" | Aceito: "Para os vídeos que tiveram teste no A/B Lab antes disso". `coerencia.mjs` reprova "2 vídeos que tiveram". |
| **S4** forma curta do lado perde a contagem de dias | Aceito e padronizado: o lado sempre escreve a contagem. Ordem: forma completa ("7 dias (22/10 a 28/10), 25.750 impressões"); se não cabe, forma curta com contagem ("7 dias, 22/10 a 28/10, 25.750 impressões"); se ainda não cabe (a 390 em `zero`, com "sem 15/10"), duas linhas ("Depois: 6 dias medidos (10/10 a 16/10, sem 15/10)" e "0 impressões"). A forma sem contagem deixou de existir. O regex de `coerencia.mjs` agora lê as duas formas (antes a forma curta saía da conferência em silêncio) e reprova qualquer "Antes:/Depois: dd/mm" sem contagem. Muda só a 390 em `extremo` (3 lados) e `zero` (1 lado). |
| **S5** marcador no centro do dia e rótulo "início do registro" no canto | Não mexi: meio dia (cerca de 31 px a 1440), não confunde, e o marcador no centro da célula é o que o gráfico por dia faz. |
| **S6** miniatura a 390 e chip "seu canal" em `leitura` | Seguem como perguntas ao dono (mockup 3 aprovado). |
| **Varredura de coerência, todos os estados** | Refeita por código (12.1, 10 estados, 1440 e 390) e reconferida contra as capturas dos estados que mudaram. Contradição de número: nenhuma nova. Pontos que olhei de propósito: "nenhuma desde 07/10" em `vazio` e `so-reconstruido` (o registro começou em 07/10; as 0 trocas do rodapé da lista também dizem 0); o teste reconstruído 31/05 a 07/06 tem seus 4 ciclos (31/05, 02/06, 04/06, 06/06) dentro das datas e é anterior ao registro; "148 dias" de `so-reconstruido` = 18/05 a 13/10; 223 views no cabeçalho >= 10 do gráfico; engajamento 8 ÷ 223 = 3,6% e 7 ÷ 96 = 7,3%; o sentido de cada "7 dias" do lado (calendário menos não medidos) segue fechado pela regra (a) da `coerencia.mjs`. |

### 12.1 Tabela de coerência por estado (gerada por `derivacao.mjs` da fonte única `3b-dados.js`; cada linha é conferida contra o texto renderizado de `#screen`: "ok" só se o número aparece na tela E a conta fecha)

Os números nunca são digitados em dois lugares: cabeçalho, gráficos, lados das trocas, frase do topo, "chega em" e posição do vídeo saem de `D.mundo()`/`D.leitura()`. Rodar `node docs/superpowers/mockups/2026-10-13-a5-lote-2/3b-video-proprio-faixas-ab-e-registro/derivacao.mjs` (da raiz) refaz esta tabela; `W=390` confere a largura estreita (as duas dão 0 falhas). Cada linha: o número, de onde deriva, com o que fecha na mesma tela, e se a tela confere.

(Tabela da r7 retirada: os números de views mudaram na r8 por causa da S1; a tabela vigente está em 13.1.)

## 13. Resposta à revisão r8 (`REVISAO-UX-r8.md`)

Capturas dos 10 estados refeitas nas duas larguras e nos dois temas (40 casos, `shots/medidas.json`: rolagem 0, texto menor que 12 px 0, alvo menor que 44 px 0). Abertas e conferidas a olho: `erro` (topo a 1440 escuro e a 390 claro), `tipico` 1440 (página inteira), `zero` 390 e 1440 (views e frase), `hoje` 390, `extremo` 1440 (views). `coerencia.mjs` (1440 e 390) e `derivacao.mjs` (1440 e 390): 0 falhas. `color-mix()` só em comentário. Servidor de captura na 47745, derrubado ao fim.

As tabelas das seções 7 a 11 são histórico: os números de views delas mudaram na S1 abaixo; vale só a 13.1.

| Item | Resposta |
|---|---|
| **N3 (bloqueia)** `erro`: frase do topo sem o aviso de falha | Aceito. `resumoTrocas()` agora, com `M.registro.ok === false`, escreve "Trocas deste vídeo até 11/10: título (1) em 09/10, ainda não dá para dizer." e, na mesma linha, o aviso com o símbolo de aviso (ícone na cor de erro, texto em `--text`): "A leitura de 12/10 e a de 13/10 falharam: pode haver troca nova (aviso abaixo)." As três datas saem de `M.registro.ultima`, `M.registro.falhaDe` e `M.hoje`, sem digitar. O caminho sem troca (antes devolvia vazio) escreve "Trocas deste vídeo: não foi possível atualizar. ⚠ A leitura de ... falharam (aviso abaixo)." (só alcançável com troca zero e falha; o `erro` do exemplo tem 1 troca). O ramo de mais de 3 trocas também leva o aviso. Medido a 390: a frase ocupa 4 linhas (2 da frase, 2 do aviso), não 3 como o revisor pediu; o aviso não foi encurtado porque "pode haver troca nova" é o que o dono precisa ler, e o aviso inteiro está na primeira tela. `coerencia.mjs`: se `registro.ok === false`, o `.tr-res` existe, diz "falharam" e as três datas, e o aviso completo está na tela. `derivacao.mjs`: linha "aviso de falha na frase do topo". 4 capturas do `erro` refeitas e abertas. |
| **S1** views contra cliques (11 vezes) | Feito por código, em vez de pergunta ao dono: `viewsDe` agora gera views do dia = cliques estimados do dia x 1,3 a 2,5 (o resto vem de fora das impressões), nunca acima das impressões do dia, com o resto fracionário passando ao dia seguinte (o total fecha com os cliques). Resultado: `tipico` 261 views para 131 cliques (2,0 vezes), `extremo` 10.083 para 5.217 (1,9), `hoje` 4 para cerca de 3, `zero` 1 para cerca de 1, `semnumero` 5 para cerca de 3. Cabeçalho, engajamento, "N views em M dias", o gráfico e a lista saem da mesma fonte e se atualizaram sozinhos. As medianas de "o normal do canal" são entrada digitada (300 e 3.300 views, antes 1.790 e 26.210) e foram refeitas para o mesmo 1,7x e 8,9x (o revisor leu 8,8x com o número anterior: 231.352 ÷ 26.210; agora 29.292 ÷ 3.300 = 8,9x). Efeito colateral aceito: nos estados magros há muitos dias de views em "zero medido" com impressão no mesmo dia (impressão sem clique é legítima) e a frase "0,0 por dia" para 1 view em 26 dias virou "menos de 0,1 por dia" (achado desta rodada, corrigido). |
| **S2** a tabela não listava todo número | Aceito. `derivacao.mjs` agora gera, por estado: taxa e faixa de 95% de cada lado com 100 impressões ou mais (Wilson recalculada de cliques e impressões do lado, e procurada no texto da tela), "N,Nx o normal do canal" (views ÷ mediana), duração (segundos formatados) e o total por tipo de leitura (por exemplo `extremo` 1 + 4 + 1 = 6 trocas). Tudo em 13.1. |
| **S3** `tipico`: 8 dias de 3 dígitos sem rótulo sobre a barra | O desenho não mudou (a regra "quando cabem" vale para os rótulos; os dois gráficos têm tabela e leitura por dia). O ⓘ dos dois gráficos ganhou o parágrafo "Números sobre as barras: aparecem quando cabem; os dois gráficos têm a tabela e a leitura dia a dia." |
| **S4** três nomes para a faixa pontilhada | Dois nomes só: o longo ("antes do início do registro (07/10): trocas não registradas", usado no rótulo da faixa quando cabe) e o curto, "antes do registro", agora igual no rótulo curto da faixa (antes "antes do início do registro" no meio), na legenda do gráfico ("antes do registro (07/10): o sistema não registra trocas") e na tabela de referência. |
| **S5** miniatura a 390, chip "seu canal" em `leitura`, barra de estados fechada | Seguem como perguntas ao dono (mockup 3 aprovado). |
| **Varredura de coerência, todos os estados** | Refeita por código sobre a nova fonte (13.1, 10 estados, 1440 e 390) e a olho nos estados que mudaram. Pontos olhados: views do gráfico <= impressões do dia em todo estado; cabeçalho >= soma do gráfico (511 >= 261; 29.292 >= 10.083; 88 >= 4; 102 >= 1; 6 >= 5; ...); engajamento recalculado do novo total; "o normal do canal" recalculado; "N dias medidos" + "não medidos" = dias do eixo; `erro`: "até 11/10" (última leitura boa) < "12/10" (primeira falha) < "13/10" (hoje) e a troca 1 de 09/10 é anterior ao corte; "(menos de 0,1 por dia)" confere com 1 view em 26 dias. Nenhuma contradição nova. |

### 13.1 Tabela de coerência por estado (gerada por `derivacao.mjs` da fonte única `3b-dados.js`; "ok" só se o número aparece na tela E a conta fecha; 1440 e 390 dão as mesmas 0 falhas)

#### `tipico`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 56 dias | de 22/09 a 17/11 | posição "vídeo 12 de 35" = 1 + idade ÷ 5 | ok |
| 511 views no cabeçalho | 0 antes do gráfico + 502 dos dias medidos + 9 estimadas (1 dias não entregues) | maior ou igual aos 261 views do gráfico | ok |
| 23 curtidas + 3 comentários = 5,1% de engajamento | views × 0.0456 e × 0.0056 | 26 ÷ 511 = 5,1% | ok |
| 261 views em 35 dias medidos (36 dias no eixo) | soma do gráfico de views, de 12/10 a 16/11 | 35 medidos + 1 não medidos = 36 dias; não medidos: 16/11 | ok |
| 3.031 impressões em 36 dias | soma do gráfico de impressões | 35 com impressão + 0 zero medido + 1 não medidos = 36; views (261) ≤ impressões | ok |
| cliques estimados: 131 | impressões de cada dia × taxa do dia, somadas | soma dos rótulos sob as barras (a 1440) | ok |
| troca 1 Antes: cortada | sem dia medido na janela (vizinha em 01/11) | — | ok |
| troca 1 Depois: 4 dias, 04/11 a 07/11, 295 impressões | soma da série no intervalo; ficam de fora o dia da troca (03/11) e os dias além de outra troca ou ciclo | 4 dias de calendário - 0 não medidos = 4 = 4 | ok |
| troca 2 Antes: 4 dias, 04/11 a 07/11, 295 impressões | soma da série no intervalo; ficam de fora o dia anterior e o dia da troca (08/11 e 09/11) e os dias além de outra troca ou ciclo | 4 dias de calendário - 0 não medidos = 4 = 4 | ok |
| troca 2 Depois: 6 dias, 10/11 a 15/11, 462 impressões | soma da série no intervalo; ficam de fora o dia da troca (09/11) e os dias além de outra troca ou ciclo | 6 dias de calendário - 0 não medidos = 6 = 6 | ok |
| frase do topo: 2 trocas e 1 testes A/B | conta de M.trocas (2), M.testes (1) | começa por "Trocas deste vídeo" ou pela contagem; bate com os 2 cartões da lista | ok |
| troca 1 Depois: taxa 4,1%, faixa de 95% de 2,3% a 7,0% | Wilson sobre 12 cliques estimados e 295 impressões do lado | faixa contém a taxa; lado com 100 impressões ou mais (295) | ok |
| troca 2 Antes: taxa 4,1%, faixa de 95% de 2,3% a 7,0% | Wilson sobre 12 cliques estimados e 295 impressões do lado | faixa contém a taxa; lado com 100 impressões ou mais (295) | ok |
| troca 2 Depois: taxa 5,8%, faixa de 95% de 4,0% a 8,4% | Wilson sobre 27 cliques estimados e 462 impressões do lado | faixa contém a taxa; lado com 100 impressões ou mais (462) | ok |
| 1,7× o normal do canal | 511 views do vídeo ÷ 300 (mediana dos outros vídeos) | mesmo número de views do cabeçalho (511) | ok |
| duração 13:32 | 812 segundos | vídeo longo (mais de 60 segundos) | ok |
| trocas por tipo de leitura: 1 + 1 = 2 | uma leitura por troca (M.trocas) | total = 2 trocas da frase do topo e da lista | ok |
| teste 20/10 a 02/11, 5 ciclos | ciclos 20/10, 23/10, 26/10, 29/10, 01/11 | cada ciclo entre o início e 02/11 | ok |

#### `extremo`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 105 dias | de 04/08 a 17/11 | posição "vídeo 22 de 35" = 1 + idade ÷ 5 | ok |
| 29.292 views no cabeçalho | 0 antes do gráfico + 29013 dos dias medidos + 279 estimadas (1 dias não entregues) | maior ou igual aos 10083 views do gráfico | ok |
| 1.327 curtidas + 208 comentários = 5,2% de engajamento | views × 0.0453 e × 0.0071 | 1535 ÷ 29292 = 5,2% | ok |
| 10.083 views em 35 dias medidos (36 dias no eixo) | soma do gráfico de views, de 12/10 a 16/11 | 35 medidos + 1 não medidos = 36 dias; não medidos: 16/11 | ok |
| 118.798 impressões em 36 dias | soma do gráfico de impressões | 35 com impressão + 0 zero medido + 1 não medidos = 36; views (10083) ≤ impressões | ok |
| cliques estimados: 5217 | impressões de cada dia × taxa do dia, somadas | soma dos rótulos sob as barras (a 1440) | ok |
| troca 1 Antes: cortada | sem dia medido na janela (vizinha em 18/10) | — | ok |
| troca 1 Depois: 7 dias, 21/10 a 27/10, 24.976 impressões | soma da série no intervalo; ficam de fora o dia da troca (20/10) e os dias além de outra troca ou ciclo | 7 dias de calendário - 0 não medidos = 7 = 7 | ok |
| troca 2 Antes: 7 dias, 22/10 a 28/10, 25.750 impressões | soma da série no intervalo; ficam de fora o dia anterior e o dia da troca (29/10 e 30/10) e os dias além de outra troca ou ciclo | 7 dias de calendário - 0 não medidos = 7 = 7 | ok |
| troca 2 Depois: 4 dias, 31/10 a 03/11, 12.299 impressões | soma da série no intervalo; ficam de fora o dia da troca (30/10) e os dias além de outra troca ou ciclo | 4 dias de calendário - 0 não medidos = 4 = 4 | ok |
| troca 3 Antes: 4 dias, 31/10 a 03/11, 12.299 impressões | soma da série no intervalo; ficam de fora o dia anterior e o dia da troca (04/11 e 05/11) e os dias além de outra troca ou ciclo | 4 dias de calendário - 0 não medidos = 4 = 4 | ok |
| troca 3 Depois: cortada | sem dia medido na janela (vizinha em 06/11) | — | ok |
| troca 4 Antes: cortada | sem dia medido na janela (vizinha em 05/11) | — | ok |
| troca 4 Depois: cortada | sem dia medido na janela (vizinha em 08/11) | — | ok |
| troca 5 Antes: cortada | sem dia medido na janela (vizinha em 10/11) | — | ok |
| troca 5 Depois: cortada | sem dia medido na janela (vizinha em 14/11) | — | ok |
| troca 6: lados antes e depois | não aparecem na tela (origem não sabida: sem comparação) | a tela não escreve número de lado nenhum | ok |
| frase do topo: 6 trocas e 2 testes A/B | conta de M.trocas (6), M.testes (2) | começa por "Trocas deste vídeo" ou pela contagem; bate com os 6 cartões da lista | ok |
| troca 1 Depois: taxa 2,8%, faixa de 95% de 2,6% a 3,0% | Wilson sobre 690 cliques estimados e 24.976 impressões do lado | faixa contém a taxa; lado com 100 impressões ou mais (24.976) | ok |
| troca 2 Antes: taxa 2,8%, faixa de 95% de 2,6% a 3,0% | Wilson sobre 712 cliques estimados e 25.750 impressões do lado | faixa contém a taxa; lado com 100 impressões ou mais (25.750) | ok |
| troca 2 Depois: taxa 7,5%, faixa de 95% de 7,0% a 8,0% | Wilson sobre 921 cliques estimados e 12.299 impressões do lado | faixa contém a taxa; lado com 100 impressões ou mais (12.299) | ok |
| troca 3 Antes: taxa 7,5%, faixa de 95% de 7,0% a 8,0% | Wilson sobre 921 cliques estimados e 12.299 impressões do lado | faixa contém a taxa; lado com 100 impressões ou mais (12.299) | ok |
| 8,9× o normal do canal | 29.292 views do vídeo ÷ 3.300 (mediana dos outros vídeos) | mesmo número de views do cabeçalho (29.292) | ok |
| duração 30:40 | 1840 segundos | vídeo longo (mais de 60 segundos) | ok |
| trocas por tipo de leitura: 1 + 4 + 1 = 6 | uma leitura por troca (M.trocas) | total = 6 trocas da frase do topo e da lista | ok |
| teste 14/10 a 19/10, 3 ciclos | ciclos 14/10, 16/10, 18/10 | cada ciclo entre o início e 19/10 | ok |
| teste 08/11 a 11/11, 2 ciclos | ciclos 08/11, 10/11 | cada ciclo entre o início e 11/11 | ok |

#### `hoje`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 91 dias | de 14/07 a 13/10 | posição "vídeo 19 de 35" = 1 + idade ÷ 5 | ok |
| 88 views no cabeçalho | 84 antes do gráfico + 4 dos dias medidos + 0 estimadas (3 dias não entregues) | maior ou igual aos 4 views do gráfico | ok |
| 5 curtidas + 1 comentários = 6,8% de engajamento | views × 0.06 e × 0.008 | 6 ÷ 88 = 6,8% | ok |
| 4 views em 26 dias medidos (29 dias no eixo) | soma do gráfico de views, de 14/09 a 12/10 | 26 medidos + 3 não medidos = 29 dias; não medidos: 27/09, 28/09, 12/10 | ok |
| 30 impressões em 29 dias | soma do gráfico de impressões | 26 com impressão + 0 zero medido + 3 não medidos = 29; views (4) ≤ impressões | ok |
| cliques estimados: cerca de 3 | impressões de cada dia × taxa do dia, somadas | todo dia abaixo de 1 clique: soma exata arredondada | ok |
| troca 1 Antes: 7 dias, 01/10 a 07/10, 8 impressões | soma da série no intervalo; ficam de fora o dia anterior e o dia da troca (08/10 e 09/10) e os dias além de outra troca ou ciclo | 7 dias de calendário - 0 não medidos = 7 = 7 | ok |
| troca 1 Depois: 1 dia, 10/10 a 10/10, 1 impressões | soma da série no intervalo; ficam de fora o dia da troca (09/10) e os dias além de outra troca ou ciclo | 1 dias de calendário - 0 não medidos = 1 = 1 | ok |
| troca 2 Antes: 1 dia, 10/10 a 10/10, 1 impressões | soma da série no intervalo; ficam de fora o dia anterior e o dia da troca (11/10 e 12/10) e os dias além de outra troca ou ciclo | 1 dias de calendário - 0 não medidos = 1 = 1 | ok |
| troca 2 Depois: nm | sem dia medido na janela (dia ainda não entregue) | — | ok |
| troca 2: primeiro dia 13/10, chega 15/10, completa 21/10 | troca 12/10 + 1, + 3, + 9 | chega (15/10) depois de hoje (13/10) | ok |
| frase do topo: 2 trocas e 0 testes A/B | conta de M.trocas (2), M.testes (0) | começa por "Trocas deste vídeo" ou pela contagem; bate com os 2 cartões da lista | ok |
| duração 14:46 | 886 segundos | vídeo longo (mais de 60 segundos) | ok |
| trocas por tipo de leitura: 1 + 1 = 2 | uma leitura por troca (M.trocas) | total = 2 trocas da frase do topo e da lista | ok |

#### `zero`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 98 dias | de 14/07 a 20/10 | posição "vídeo 20 de 35" = 1 + idade ÷ 5 | ok |
| 102 views no cabeçalho | 101 antes do gráfico + 1 dos dias medidos + 0 estimadas (3 dias não entregues) | maior ou igual aos 1 views do gráfico | ok |
| 6 curtidas + 1 comentários = 6,9% de engajamento | views × 0.06 e × 0.008 | 7 ÷ 102 = 6,9% | ok |
| 1 views em 26 dias medidos (29 dias no eixo) | soma do gráfico de views, de 21/09 a 19/10 | 26 medidos + 3 não medidos = 29 dias; não medidos: 30/09, 15/10, 19/10 | ok |
| 12 impressões em 29 dias | soma do gráfico de impressões | 7 com impressão + 19 zero medido + 3 não medidos = 29; views (1) ≤ impressões | ok |
| cliques estimados: cerca de 1 | impressões de cada dia × taxa do dia, somadas | todo dia abaixo de 1 clique: soma exata arredondada | ok |
| troca 1 Antes: 7 dias, 01/10 a 07/10, 0 impressões | soma da série no intervalo; ficam de fora o dia anterior e o dia da troca (08/10 e 09/10) e os dias além de outra troca ou ciclo | 7 dias de calendário - 0 não medidos = 7 = 7 | ok |
| troca 1 Depois: 6 dias, 10/10 a 16/10, sem 15/10, 0 impressões | soma da série no intervalo; ficam de fora o dia da troca (09/10) e os dias além de outra troca ou ciclo | 7 dias de calendário - 1 não medidos = 6 = 6 | ok |
| frase do topo: 1 trocas e 0 testes A/B | conta de M.trocas (1), M.testes (0) | começa por "Trocas deste vídeo" ou pela contagem; bate com os 1 cartões da lista | ok |
| duração 14:46 | 886 segundos | vídeo longo (mais de 60 segundos) | ok |
| trocas por tipo de leitura: 1 = 1 | uma leitura por troca (M.trocas) | total = 1 trocas da frase do topo e da lista | ok |

#### `semnumero`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 7 dias | de 06/10 a 13/10 | posição "vídeo 2 de 35" = 1 + idade ÷ 5 | ok |
| 6 views no cabeçalho | 0 antes do gráfico + 5 dos dias medidos + 1 estimadas (1 dias não entregues) | maior ou igual aos 5 views do gráfico | ok |
| 0 curtidas + 0 comentários = 0,0% de engajamento | views × 0.0625 e × 0 | 0 ÷ 6 = 0,0% | ok |
| 5 views em 6 dias medidos (7 dias no eixo) | soma do gráfico de views, de 06/10 a 12/10 | 6 medidos + 1 não medidos = 7 dias; não medidos: 12/10 | ok |
| 55 impressões em 7 dias | soma do gráfico de impressões | 6 com impressão + 0 zero medido + 1 não medidos = 7; views (5) ≤ impressões | ok |
| cliques estimados: cerca de 3 | impressões de cada dia × taxa do dia, somadas | todo dia abaixo de 1 clique: soma exata arredondada | ok |
| troca 1 Antes: sem | sem dia medido na janela (pub) | — | ok |
| troca 1 Depois: cortada | sem dia medido na janela (vizinha em 10/10) | — | ok |
| troca 2 Antes: cortada | sem dia medido na janela (vizinha em 08/10) | — | ok |
| troca 2 Depois: cortada | sem dia medido na janela (vizinha em 12/10) | — | ok |
| troca 3 Antes: cortada | sem dia medido na janela (vizinha em 10/10) | — | ok |
| troca 3 Depois: nm | sem dia medido na janela (dia ainda não entregue) | — | ok |
| troca 3: primeiro dia 13/10, chega 15/10, completa 21/10 | troca 12/10 + 1, + 3, + 9 | chega (15/10) depois de hoje (13/10) | ok |
| frase do topo: 3 trocas e 0 testes A/B | conta de M.trocas (3), M.testes (0) | começa por "Trocas deste vídeo" ou pela contagem; bate com os 3 cartões da lista | ok |
| duração 11:42 | 702 segundos | vídeo longo (mais de 60 segundos) | ok |
| trocas por tipo de leitura: 1 + 1 + 1 = 3 | uma leitura por troca (M.trocas) | total = 3 trocas da frase do topo e da lista | ok |

#### `so-teste`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 91 dias | de 14/07 a 13/10 | posição "vídeo 19 de 35" = 1 + idade ÷ 5 | ok |
| 88 views no cabeçalho | 84 antes do gráfico + 4 dos dias medidos + 0 estimadas (3 dias não entregues) | maior ou igual aos 4 views do gráfico | ok |
| 5 curtidas + 1 comentários = 6,8% de engajamento | views × 0.06 e × 0.008 | 6 ÷ 88 = 6,8% | ok |
| 4 views em 26 dias medidos (29 dias no eixo) | soma do gráfico de views, de 14/09 a 12/10 | 26 medidos + 3 não medidos = 29 dias; não medidos: 27/09, 28/09, 12/10 | ok |
| 30 impressões em 29 dias | soma do gráfico de impressões | 26 com impressão + 0 zero medido + 3 não medidos = 29; views (4) ≤ impressões | ok |
| cliques estimados: cerca de 3 | impressões de cada dia × taxa do dia, somadas | todo dia abaixo de 1 clique: soma exata arredondada | ok |
| frase do topo: 0 trocas e 1 testes A/B | conta de M.trocas (0), M.testes (1) | começa por "Trocas deste vídeo" ou pela contagem; bate com 0 cartões na lista | ok |
| duração 14:46 | 886 segundos | vídeo longo (mais de 60 segundos) | ok |
| teste 03/10 em andamento, 4 ciclos | ciclos 03/10, 06/10, 09/10, 12/10 | cada ciclo entre o início e hoje 13/10 | ok |

#### `so-reconstruido`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 148 dias | de 18/05 a 13/10 | posição "vídeo 30 de 35" = 1 + idade ÷ 5 | ok |
| 216 views no cabeçalho | 212 antes do gráfico + 4 dos dias medidos + 0 estimadas (3 dias não entregues) | maior ou igual aos 4 views do gráfico | ok |
| 6 curtidas + 1 comentários = 3,2% de engajamento | views × 0.03 e × 0.004 | 7 ÷ 216 = 3,2% | ok |
| 4 views em 26 dias medidos (29 dias no eixo) | soma do gráfico de views, de 14/09 a 12/10 | 26 medidos + 3 não medidos = 29 dias; não medidos: 27/09, 28/09, 12/10 | ok |
| 28 impressões em 29 dias | soma do gráfico de impressões | 26 com impressão + 0 zero medido + 3 não medidos = 29; views (4) ≤ impressões | ok |
| cliques estimados: cerca de 2 | impressões de cada dia × taxa do dia, somadas | todo dia abaixo de 1 clique: soma exata arredondada | ok |
| frase do topo: nenhuma troca e 1 teste reconstruído | conta de M.trocas (0), M.testes (0) e M.pre (de 31/05 a 07/06) | começa por "Trocas deste vídeo" ou pela contagem; bate com 0 cartões na lista; a faixa reconstruída está abaixo | ok |
| duração 14:46 | 886 segundos | vídeo longo (mais de 60 segundos) | ok |

#### `vazio`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 91 dias | de 14/07 a 13/10 | posição "vídeo 19 de 35" = 1 + idade ÷ 5 | ok |
| 88 views no cabeçalho | 84 antes do gráfico + 4 dos dias medidos + 0 estimadas (3 dias não entregues) | maior ou igual aos 4 views do gráfico | ok |
| 5 curtidas + 1 comentários = 6,8% de engajamento | views × 0.06 e × 0.008 | 6 ÷ 88 = 6,8% | ok |
| 4 views em 26 dias medidos (29 dias no eixo) | soma do gráfico de views, de 14/09 a 12/10 | 26 medidos + 3 não medidos = 29 dias; não medidos: 27/09, 28/09, 12/10 | ok |
| 30 impressões em 29 dias | soma do gráfico de impressões | 26 com impressão + 0 zero medido + 3 não medidos = 29; views (4) ≤ impressões | ok |
| cliques estimados: cerca de 3 | impressões de cada dia × taxa do dia, somadas | todo dia abaixo de 1 clique: soma exata arredondada | ok |
| frase do topo: nenhuma troca | conta de M.trocas (0), M.testes (0) | começa por "Trocas deste vídeo" ou pela contagem; bate com 0 cartões na lista | ok |
| duração 14:46 | 886 segundos | vídeo longo (mais de 60 segundos) | ok |

#### `erro`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 91 dias | de 14/07 a 13/10 | posição "vídeo 19 de 35" = 1 + idade ÷ 5 | ok |
| 88 views no cabeçalho | 84 antes do gráfico + 4 dos dias medidos + 0 estimadas (3 dias não entregues) | maior ou igual aos 4 views do gráfico | ok |
| 5 curtidas + 1 comentários = 6,8% de engajamento | views × 0.06 e × 0.008 | 6 ÷ 88 = 6,8% | ok |
| 4 views em 26 dias medidos (29 dias no eixo) | soma do gráfico de views, de 14/09 a 12/10 | 26 medidos + 3 não medidos = 29 dias; não medidos: 27/09, 28/09, 12/10 | ok |
| 30 impressões em 29 dias | soma do gráfico de impressões | 26 com impressão + 0 zero medido + 3 não medidos = 29; views (4) ≤ impressões | ok |
| cliques estimados: cerca de 3 | impressões de cada dia × taxa do dia, somadas | todo dia abaixo de 1 clique: soma exata arredondada | ok |
| troca 1 Antes: 7 dias, 01/10 a 07/10, 8 impressões | soma da série no intervalo; ficam de fora o dia anterior e o dia da troca (08/10 e 09/10) e os dias além de outra troca ou ciclo | 7 dias de calendário - 0 não medidos = 7 = 7 | ok |
| troca 1 Depois: 2 dias, 10/10 a 11/10, 3 impressões | soma da série no intervalo; ficam de fora o dia da troca (09/10) e os dias além de outra troca ou ciclo | 2 dias de calendário - 0 não medidos = 2 = 2 | ok |
| frase do topo: 1 trocas e 0 testes A/B | conta de M.trocas (1), M.testes (0) | começa por "Trocas deste vídeo" ou pela contagem; bate com os 1 cartões da lista | ok |
| duração 14:46 | 886 segundos | vídeo longo (mais de 60 segundos) | ok |
| trocas por tipo de leitura: 1 = 1 | uma leitura por troca (M.trocas) | total = 1 trocas da frase do topo e da lista | ok |
| aviso de falha na frase do topo | M.registro: última leitura boa 11/10, falhou em 12/10 e 13/10 | o aviso completo (role="alert") está abaixo e diz as mesmas datas | ok |

#### `leitura`

| Número na tela | Deriva de | Fecha com | Confere na tela |
|---|---|---|---|
| há 56 dias | de 22/09 a 17/11 | posição "vídeo 12 de 35" = 1 + idade ÷ 5 | ok |
| 511 views no cabeçalho | 0 antes do gráfico + 502 dos dias medidos + 9 estimadas (1 dias não entregues) | maior ou igual aos 261 views do gráfico | ok |
| 23 curtidas + 3 comentários = 5,1% de engajamento | views × 0.0456 e × 0.0056 | 26 ÷ 511 = 5,1% | ok |
| 261 views em 35 dias medidos (36 dias no eixo) | soma do gráfico de views, de 12/10 a 16/11 | 35 medidos + 1 não medidos = 36 dias; não medidos: 16/11 | ok |
| troca 1: lados antes e depois | não aparecem na tela (quem só lê não vê impressões) | a tela não escreve número de lado nenhum | ok |
| troca 2: lados antes e depois | não aparecem na tela (quem só lê não vê impressões) | a tela não escreve número de lado nenhum | ok |
| frase do topo: 2 trocas e 1 testes A/B | conta de M.trocas (2), M.testes (1) | começa por "Trocas deste vídeo" ou pela contagem; bate com os 2 cartões da lista | ok |
| 1,7× o normal do canal | 511 views do vídeo ÷ 300 (mediana dos outros vídeos) | mesmo número de views do cabeçalho (511) | ok |
| duração 13:32 | 812 segundos | vídeo longo (mais de 60 segundos) | ok |
| teste 20/10 a 02/11, 5 ciclos | ciclos 20/10, 23/10, 26/10, 29/10, 01/11 | cada ciclo entre o início e 02/11 | ok |
