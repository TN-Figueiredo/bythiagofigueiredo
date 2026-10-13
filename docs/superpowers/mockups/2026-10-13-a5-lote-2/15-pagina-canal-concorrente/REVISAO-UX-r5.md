# Revisão de UX, rodada 5: mockup 15, página do canal de concorrente

Revisor: revisor-ux-senior. Data: 13/10/2026. Escopo: conferir se B1, B2, B3 e C1 a C7 da r4 foram resolvidos de verdade, se os ajustes criaram defeito novo, e fazer eu a varredura de coerência dos números de exemplo nos 12 estados de uma vez.

Método: servidor estático próprio (portas 47751 a 47757, todos derrubados por mim; a 47751 hoje responde um processo de outra sessão, PID 97234, que não é meu e não toquei; nada na 3099, sem specs do projeto). Li o texto renderizado dos 12 estados com tudo aberto (blocos "Mais números do canal" e "Ver como tabela", `aria-label` dos desenhos, conteúdo de cada ⓘ), li as capturas de `magro`, `erro`, `nm`, `zero` (1440 escuro) e de `erro`, `extremo`, `vazio`, `cheio` (390 claro), e refiz as contas por conta própria sobre `window.PC_M` (vídeos, série por dia, janelas). Medi 12 estados x 4 combinações (1440 escuro, 390 claro, 1440 claro, 390 escuro) = 48 cruzamentos. Rodei o `coerencia.mjs` do desenhista (0 linhas que não fecham) e, além dele, as relações que ele não cobre (seção "Varredura").

## Resumo

Veredito geral: NÃO PODE ir ao dono ainda. 1 bloqueio, 5 correções, 7 sugestões.

Estados: 2 prontos para o dono (`nm`, `vazio`), 10 voltam para ajuste, 0 reprovados.

Pergunta do usuário: "este canal está subindo, parado ou caindo, e o último vídeo dele foi acima do normal?". Respondida no primeiro olhar nos 12 estados (símbolo mais frase no topo, seis células embaixo; li 1440 escuro e 390 claro). Passa, e passou nas quatro rodadas anteriores.

A rodada 5 fez o que a r4 pediu: os 3 bloqueios e as 7 correções da r4 estão resolvidos de verdade (tabela abaixo), nenhum redesenho foi preciso, e a classe de erro "número que contradiz outro na mesma tela" caiu de dezenas de pontos para dois, ambos finos. As três coisas que ainda derrubam o conjunto:

1. **"Criador responde" não obedece à regra que a própria tela declara.** O ⓘ e a mensagem de "não medido" dizem "vídeos com 30 dias de comentários guardados"; os 4 comentários de exemplo (cheio, leitura, extremo) estão sob vídeos de 7, 17 e 22 dias, e o `n` (14 no cheio e no leitura) é digitado, não derivado, e passa dos 13 vídeos longos que têm 30 dias. É a classe "5 das 3 respostas", em versão que só aparece com o ⓘ aberto.
2. **Duas datas da mesma regra, uma conta com o dia 24/08 e outra sem:** "fica limpa em 19/10" (24/08 + 56) e "primeira leitura limpa em 13/12" (24/08 + 111) saem da mesma constante com deslocamentos que não combinam. Quem pediu 13/12 na r4 fui eu (C5), por ter olhado só a barra de 112 e não a de 56. O erro é meu e vai corrigido aqui.
3. **Detalhe de acabamento que aparece no primeiro olhar:** os pontinhos do Acerto quebram em duas linhas em 3 estados a 1440 px (✕ sozinho na segunda linha), e "Inscritos" mostra 2 algarismos (2,1 mi; 9,8 mi; 3,7 mi) onde o ⓘ promete 3 e a linha de baixo fala em "10 mil em 10 mil".

## Conferência da r4

| Item da r4 | Resultado | Evidência |
|---|---|---|
| B1 (a) "Views por dia" sobre janela de 28 dias que não existe | RESOLVIDO | nm "não medido: menos de 28 dias de registro; completa em 15/10" (18/09 + 27); vazio "completa em 08/11" (12/10 + 27); fora 2,83 mil x 28 = 79,3 mil = soma da Direção; magro 9,70 mil x 28 = 271,7 mil; cheio 194 mil x 28 = 5,43 mi; extremo 1,26 mi x 28 = 35,3 mi; parado 10,3 mil x 28 = 289,7 mil; zero 76 x 28 = 2,14 mil; erro 8,21 mil x 28 = 229,8 mil; shorts 11,5 mil x 28 = 322 mil; nichos 65,5 mil x 28 = 1,83 mi. |
| B1 (b) "Inscritos em 30 dias" com 26 dias de registro | RESOLVIDO | nm "não medido, completa em 17/10" (18/09 + 29), vazio "completa em 10/11" (12/10 + 29). |
| B2 "começou em 11/10; fecha em 10/11" no erro | RESOLVIDO | célula e bloco: "sem leitura desde 04/10: a coleta de comentários não chegou a este canal", sem data futura. |
| B3 zero com "0 de 6" medido em 13/10 | RESOLVIDO | zero é "não medido" nos dois lugares; o zero medido de resposta do criador vive em `nichos` (0 de 12, simulação de 12/05/2027), com a caixa vazada. |
| C1 "semanas com publicação" só de longos | RESOLVIDO | "Semanas com um longo" / "com um Short"; ⓘ diz que o outro formato não entra na conta; nm "menos de 4 longos na janela". |
| C2 semana parcial com uma raia "—" e a outra com número | RESOLVIDO | erro: 2 colunas "—" em cada raia (4 no total), "10 de 11 semanas com leitura" = 13 menos 2; fora: 1 coluna em cada raia, "7 de 12". |
| C3 "(agora 0 e 0)" no vazio | RESOLVIDO | o parêntese só existe no nm ("agora 2 e 6" = 2 longos nos 90 dias e 6 nos 90 anteriores, bate com a grade e com "hoje 2"). |
| C4 "não medido" sem motivo; regra diferente entre erro e fora | RESOLVIDO | os 12 estados: toda célula não medida traz o motivo na linha de baixo; erro e fora mostram valor com "até 04/10" / "até 09/10" nas quatro células. |
| C5 ⓘ 14/12 contra barra 13/12 | RESOLVIDO NA FORMA, ERRADO NO FUNDO | agora as datas saem de uma variável, mas a regra escolhida (13/12) briga com a de 56 dias (19/10). Ver C1 desta rodada. A culpa da escolha é minha. |
| C6 nichos "−50% ou menos" para −49,8% | RESOLVIDO | nichos: "▼ −50%" sem "ou menos" e sem "‹"; magro (−50,4%) e erro (+55,5%) mantêm "fora da escala". |
| C7 erro e magro o mesmo canal | RESOLVIDO | erro virou Lodir Mundo Afora (187 mil, outra semente); nenhum nome nem @ repetido. |
| S1 janelas de 90 dias e de 13 semanas | RESOLVIDO | soma das 13 casas de longos = primeiro número de "N e M vídeos" em todos os estados que leem até hoje (12, 22, 22, 5, 8, 2, 4, 71, 21); erro 16 medidas + 1 na semana "—" = 17, fora 8 + 1 = 9 (ver S7). |
| S2, S3, S4, S6, S7 | RESOLVIDOS | "1 acerto, 1 fracasso, 0 acerto" com singular; rótulos "Vídeos / Campos / Trocas" no lugar das marcas soltas; leitura "sem o menu de ações do canal"; "pelo menos 1 mudança de campo e pelo menos 1 troca"; banner "(11 dias)". |
| S5 sem estado de carregando | NÃO FEITO, declarado desde a r1 | repito como sugestão. |

Defeito novo criado pelos ajustes: um só, a escolha de 13/12 na regra dos 112 dias (acima).

## Bloqueio (não vai ao dono)

### B1. "Criador responde": a base declarada (30 dias de comentários) não combina com os exemplos nem com o n
- Tela/estado: bloco "O que o criador respondeu" e célula "Criador responde", estados `cheio`, `leitura` (idênticos) e `extremo`, 1440 e 390. Capturas lidas: cheio 390 claro (bloco inteiro, três cartões de comentário e o quadro de 14 caixinhas); a regra está nos ⓘ e na mensagem do magro.
- O que está errado, em três partes que se contradizem sem sair da tela.
  - **A regra escrita.** ⓘ "Base: vídeos dos últimos 90 dias com os comentários de 30 dias guardados"; magro, parado, zero, vazio, shorts, nm: "precisa de 5 vídeos com 30 dias de comentários" e "fecha em 10/11" (11/10 + 30). Ou seja, o vídeo entra quando já tem 30 dias.
  - **Os exemplos.** cheio e leitura: "Quanto custa viver em Chiang Mai · comentário de há 6 dias" (vídeo de 7 dias), "Peru em 15 dias · comentário de há 12 dias" (vídeo de 17 dias), "A cidade mais barata da Europa · comentário de há 19 dias" (vídeo de 22 dias); extremo: Peru (vídeo de 17 dias). Nenhum dos quatro vídeos tem 30 dias, então por regra nenhum poderia estar na base de "5 de 14" nem de "1 de 11".
  - **O n.** `pc-dados.js`: `M.resp.n = min(c.resp.n, cands)` com `cands` = longos de 3 a 90 dias (o comentário do código diz "de 3 a 90 dias"), e `c.resp.n` é digitado (14, 11, 12). Contando os longos com 30 a 89 dias na própria lista de vídeos: cheio e leitura 13 (a tela diz **14**: k de n com n maior que o universo), extremo 17 (tela 11), nichos 16 (tela 12). O conferidor reprova só `n <= longos de 3 a 90 dias (20)`, que é o limite errado.
- Conserto exato: escolher uma regra e fazer as quatro peças obedecerem. Recomendo a do ⓘ (30 dias): (1) `cands` passa a ser os longos com 30 a 89 dias de idade na última leitura; (2) `n` = `cands` (cheio e leitura 13, extremo 17, nichos 16), `k` = o digitado limitado a `n`; (3) os comentários de exemplo vão para os vídeos dessa mesma faixa (30 a 89 dias), com "comentário de há N dias" menor que a idade do vídeo e dentro dos 30 primeiros dias dele; (4) a regra do conferidor passa a "n = longos de 30 a 89 dias" e acrescenta "idade do vídeo do comentário >= 30". Alternativa, se o dono preferir contar vídeos de 3 dias ou mais: trocar o ⓘ, a mensagem dos 6 estados "não medido" e a data "fecha em 10/11" (que deixaria de existir); é mais cara e muda a regra do produto. Levar como dúvida só se a regra de 30 dias não estiver no spec.

## Correções (vão ao dono só depois de corrigidas)

### C1. Duas datas da mesma regra: 19/10 (56 dias) e 13/12 (112 dias) contam o dia 24/08 de jeitos opostos
- Estados: magro, parado, zero, shorts (frase "fica limpa em 19/10/2026" e barra "51 de 112 dias... a primeira leitura limpa é em 13/12/2026"), erro (42 de 112) e fora (47 de 112) e os ⓘ de todos. Captura lida: magro 1440 (blocos "Views do canal inteiro" e "Queda sustentada").
- Evidência: `pc-dados.js` linhas 13 e 14: `LIMPA_56 = COR + 56` (19/10, a janela de 56 dias começa em 25/08, o dia 24/08 é o dia sujo) e `LIMPA_112 = COR + 111` ("contando o dia 24/08": 13/12, a barra conta 24/08 como dia 1 e mostra 51). Pela regra dos 56 dias, 112 dias limpos começam em 25/08 e fecham em 14/12, com 50 dias hoje. Pela regra dos 112, os 56 fecham em 18/10. O ⓘ da Direção ainda diz "pede 112 dias sem cruzar 24/08/2026", que é a regra dos 56 aplicada aos 112 (14/12), e o ⓘ do Estado diz 13/12. O `coerencia.mjs` codifica os dois deslocamentos lado a lado ("24/08 + 56" e "24/08 + 111") e por isso passa.
- Por que é minha: na r4 (C5) mandei trocar o ⓘ de 14/12 para 13/12 por "contagem inclusiva", sem testar contra os 19/10 da mesma tela. O ⓘ original estava certo.
- Conserto exato: uma regra só, o dia 24/08 é o dia da mudança e não conta como limpo. `LIMPA_112 = COR + 112` (14/12/2026); a barra passa a "50 de 112" em magro/parado/zero/shorts (24/08 fora; 25/08 a 13/10 = 50), "41 de 112" no erro (até 04/10) e "46 de 112" no fora (até 09/10); ⓘ do Estado "só a partir de 14/12/2026". Os 56 dias ficam em 19/10. Gerar os dois por uma função `limpaEm(n) = COR + n` e o "N de 112" por `dias(COR + 1, fim) + 1`. O conferidor troca "24/08 + 111" por "24/08 + 112".

### C2. Acerto: os pontinhos quebram de linha e deixam ✕ sozinho
- Estados: extremo, erro e nichos a 1440 (duas linhas); cheio, leitura, extremo, erro e nichos a 1180 e a 390 (duas linhas). Medi `getBoundingClientRect` dos filhos do `role="img"` do Acerto (166 px de largura a 1440, 154 px a 390): 20 pontos com ✕ largo não cabem. Captura lida: erro 1440 escuro (um ✕ sozinho abaixo da fileira, a 16 pontos) e erro/extremo 390 claro (fileira cortada no meio, ✕✕ na segunda linha).
- O que está errado: um símbolo órfão parece erro de desenho e quebra a leitura "◆ primeiro, ● no meio, ✕ por último".
- Conserto exato: largura fixa por ponto (6 px) com `gap: 1px` e `flex-wrap: nowrap` (20 pontos = 139 px, cabe nos 154 px do mais estreito), ou duas fileiras fixas de 10 pontos sempre que n passar de 12. O que não pode é a quebra depender da largura do glifo. Alvo de toque não muda (é `role="img"`).

### C3. Inscritos mostra 2 algarismos onde a tela promete 3
- Estados: cheio e leitura ("2,1 mi" para 2.080.000), extremo ("9,8 mi" para 9.840.000), parado ("3,7 mi" para 3.740.000).
- Evidência: ⓘ "arredondada a 3 algarismos pelo próprio YouTube", linha de baixo da célula "arredondado pelo YouTube" e, em "Mais números", "de 10 mil em 10 mil pelo arredondamento". "2,1 mi" tem passo de 100 mil; a tela afirma 10 mil.
- Conserto exato: formatar acima de 1 mi com 3 algarismos ("2,08 mi", "9,84 mi", "3,74 mi"); abaixo de 1 mi já está certo (325 mil, 593 mil, "1,53 mil").

### C4. nichos: "Criador responde 0 de 12" sem o percentual que o ⓘ manda mostrar
- Estado: nichos (1440 e 390). ⓘ: "Percentual só com 10 vídeos ou mais"; cheio "5 de 14 (36%)", extremo "1 de 11 (9%)", erro "1 de 16 (6%)" mostram; nichos com 12 vídeos não mostra "(0%)". É o caso do zero medido, e o mockup o destaca com a caixa vazada, mas a regra é a regra.
- Conserto exato: "0 de 12 (0%)" na célula, com a caixa vazada mantida.

### C5. parado e fora: "Inscritos em 30 dias +1,0%" não combina com o canal que a tela descreve
- Estados: parado (3,74 mi de inscritos, 64 dias sem vídeo, views caindo 20%) e fora (593 mil, saiu do YouTube em 09/10).
- Evidência: o valor é digitado por fórmula de semente (`0,9 + (seed % 7) / 10`), não vem da série. Em parado, +1,0% de 3,74 mi = 37 mil inscritos novos contra 290 mil views em 28 dias (13 inscritos novos para cada 100 views); em fora, 5,9 mil contra 79 mil views (7,5%). Nos outros seis estados com valor medido a razão fica entre 0,3% e 1,8%. Um canal parado que ganha 1% de inscritos em um mês contradiz a frase do topo ("Parado há 64 dias").
- Conserto exato: derivar `ins30` das views (por exemplo, 0,3% a 1,5% das views de 30 dias, dividido pelos inscritos) em vez do sorteio; parado cai para algo como "+0,1%", fora para "+0,4%". Ou, mais simples, "≈ 0" nos dois (o rótulo "dentro do arredondamento" já existe).

## Sugestões (não bloqueiam)
- S1. O modelo de dados não fecha por dentro, e hoje isso não aparece na tela. O ajuste de cada janela de 28 dias para a razão pedida (`c.janelas`, `pc-dados.js`) multiplica os dias do canal e desfaz a identidade "views do canal por dia >= soma do que os vídeos ganharam no dia", que o cabeçalho do arquivo promete. Medi por dia: zero tem 17 dias em que a soma dos vídeos passa a do canal (nos cinco primeiros que listei, o canal está em "zero medido" e os vídeos somam 50 a 79); erro e fora têm 28 dias com vídeos acima do canal; extremo 1 dia (2,35 mi contra 2,32 mi em 25/03/2027); no erro, 228 mil das 230 mil views da janela vêm dos 7 vídeos publicados nela (99%). Nada disso é visível (o mockup não mostra views por vídeo por dia), mas o implementador que usar `pc-dados.js` como fixture herda um dado impossível. Corrigir limitando o ajuste ao `acervo` e não à soma dos vídeos.
- S2. Mesma coisa com dois nomes: o gráfico escreve "sem leitura" (erro) e "ainda sem leitura" (vazio) em cima da hachura, e a legenda e a tabela do mesmo gráfico dizem "sem registro". Usar um nome só ("sem registro", que é o da legenda).
- S3. parado: "Publica 0,4 vídeos longos por semana" (Ritmo, no presente) ao lado de "Ele costumava publicar um longo a cada 5 dias" (topo). As duas são verdadeiras (média de 13 semanas com 9 semanas paradas contra o intervalo do meio de antes de parar), mas se leem como duas versões. Dizer "Publicou 0,4 por semana nas últimas 13 semanas" no estado parado. Em magro, "0,9 por semana" ao lado de "Intervalo típico 3 dias" tem o mesmo cheiro (média contra valor do meio): rotular "valor do meio" no cartão.
- S4. Estados com banner "a contagem por vídeo vai de 03/10 a 13/10 (11 dias)" e barra "2 de 180 dias" (vazio) ou "a leitura parou em 04/10" (erro): o banner fala do sistema, a barra do canal. Acrescentar "neste canal: desde 12/10" evita a leitura de contradição.
- S5. Três títulos de Short se repetem no magro com 30 a 40 dias de intervalo ("Aeroporto às 4 da manhã" 17/08 e 07/10; "Mochila de 7 kg" 05/09 e 11/10; "O trem lotado de Tóquio" 09/08 e 19/09). Na tabela do dia a dia parece publicação em duplicidade. A lista de títulos de Shorts tem poucos itens; ampliar.
- S6. erro e fora: a soma das casas visíveis de longos (16 e 8) difere de "17 e 23 vídeos" e "9 e 15 vídeos" por um vídeo que está na semana "—". A regra é a certa (C2 da r4); se quiser eliminar a pergunta, "(17 contando a semana sem leitura)" na legenda do Ritmo.
- S7. Sem estado de carregando (mockup estático; declarado desde a r1). A página real é renderizada no servidor, então o estado vira esqueleto das seis células; deixar na lista de implementação.

## Varredura de coerência: o que conferi por estado

Cada linha é um relacionamento entre números da mesma tela, recalculado por mim fora do código de desenho (`window.PC_M` mais texto renderizado). "ok" = fecha. As falhas remetem aos achados. As linhas marcadas (novo) são relações que o `coerencia.mjs` não cobre.

| Estado | Fecha (ok) | Não fecha |
|---|---|---|
| magro | 271.703/242.591 = +12%; 9,70 mil x 28 = 271,7 mil; 7 publicações (2 longos + 5 Shorts) = soma das 4 últimas casas de cada raia = linhas da tabela; 12 longos na grade = "12 e 20 vídeos" = 19,0 mil de "Views típicas"; 6 de 13 semanas; buraco 25 dias (14/09 a 09/10); intervalo do meio 3; Acerto 10 = 12 menos os 2 de menos de 7 dias, 2 + 2 + 6 = 10 nos pontinhos; n por idade (2, 1, 1, 0...) = longos publicados desde 03/10 (12/10 e 09/10); marcas de campo e troca depois do vídeo (06/10 e 09/10 sobre o Short de 04/10); 11 de 180 e 31/03/2027, 11 dias no banner | C1 (19/10 contra 13/12), S5 (títulos repetidos) |
| cheio / leitura | +18% (5,43/4,60 mi); 194 mil x 28 = 5,43 mi; n 47 = 22 + 25 (os 180 dias) (novo); 17 publicações (8 + 9) = últimas 4 casas; Acerto 20 = 22 menos 2 recentes; 5 de 14 = 36% e 5 caixinhas marcadas + 9 vazias = 14; buraco 18 (05/03 a 23/03); comentários depois do vídeo | **B1** (n 14 > 13 longos com 30 dias; exemplos com 7, 17 e 22 dias), C2 (pontinhos a 1180 e 390), C3 (2,1 mi) |
| extremo | −34%, −21%, −14%; 35,27 mi/53 mi; n 37 = 22 + 15 (novo); 1,26 mi x 28 = 35,3 mi; 19 publicações (5 + 14); 1 de 11 = 9%; buraco 20 dias (21/12 a 10/01); tier "perto do normal" até 0,7 | **B1** (só o exemplo: Peru com 17 dias; o n de 11 cabe nos 17 elegíveis), C2 (✕ em segunda linha a 1440), C3 (9,8 mi), C1 só no ⓘ |
| parado | −20% (290/362 mil); 10,3 mil x 28; 64 dias (10/08 a 13/10); limite 28; 5 longos = 0,38/semana; 4 de 13 semanas; "1 de 5" sem percentual (5 < 10); buraco aberto 64 | C1, C3 (3,7 mi), C5 (+1,0% de inscritos), S3 |
| zero | 0% (2,14 mil/2,14 mil); 76 x 28 = 2,14 mil; −28% (536/743); "0 de 8" = longos com 7 dias ou mais, 8 na grade; buraco 27 (16/09 a 13/10) e 27 dias < limite 28 = "Ativo"; 1 publicação (só longos) = a de 16/09; evento de 05/10 depois do registro | C1 |
| nm | 26 de 56 e 12/11 (18/09 + 55); 26 de 112 e 07/01/2027; "faltam 30 dias" = 56 − 26; janela de 28 completa em 15/10; 30 dias completa em 17/10; "2 longos" = grade = "hoje 2" = "agora 2 e 6" (novo); 1 publicação (só Shorts) = Short de 22/09, "21 dias" desde o último; Acerto "menos de 5" com 2 longos | nenhuma |
| erro | +7% (230/215 mil); 8,21 mil x 28 = 229,8 mil; +55% (26,9/17,3 mil); 42 de 112 (24/08 a 04/10) e 2 de 180; Acerto 1 de 16 = 6%, aria "1 acerto, 5 fracassos, 10 no meio" = 16; 10 de 11 semanas com leitura; 21 dias de buraco (12/06 a 03/07); "1 dia até 04/10" = vídeo de 03/10 = "publicado em 03/10"; n por idade (1, 0...) | C2 (✕ órfão), S6 |
| vazio | 2 de 56 e 06/12 (12/10 + 55); 2 de 112 e 31/01/2027; 2 de 180 e 09/04/2027; "faltam 54" = 56 − 2; 08/11 e 10/11; 7 de 48 vídeos = 4 longos + 3 Shorts da tabela (novo); 1 + 3 = 4 publicações em 28 dias; 2,16 mil = 1.154 + 1.001; "2 de 5 semanas com leitura" = as casas medidas; "Primeira busca" em vez de "Ativo" | S4 |
| fora | +9% (79,3/72,7 mil); 2,83 mil x 28 = 79,3 mil; −3,8% = "＝" (11,59/11,21 mil); 4 x 9,5 = 38; 47 de 112 e 7 de 180 até 09/10; 7 de 12 semanas; buraco 28 (25/07 a 22/08); Acerto 2 de 7 = 9 menos os 2 de 06/10 e 08/10; n por idade (2, 1, 1, 0...) | C5 (+1,0% de inscritos), S6 |
| shorts | +14% (322/283 mil); 11,5 mil x 28 = 322 mil; 22 publicações = últimas 4 casas; 71 Shorts = 5,46/semana; buraco 4 dias (12/08 a 16/08); 13 de 13 semanas; Views típicas 7,56 mil = mediana de 71; n por idade (8, 8, 7, 5, 3, 0...) (novo) | C1 |
| nichos | +4% (1,83/1,76 mi); 65,5 mil x 28 = 1,83 mi; n 42 = 21 + 21 (novo); −49,8% mostrado "−50%" sem "ou menos" e sem "‹"; Acerto 20 = 21 menos 1; zero medido 0 de 12 com a caixa vazada | C2, C4 |

Relações novas desta rodada, que valem virar regra do conferidor: (1) `n` do ponto da linha do normal = longos publicados nos 180 dias com contagem (cheio 47 = 22 + 25, extremo 37 = 22 + 15, nichos 42 = 21 + 21); (2) soma dos vídeos publicados na janela <= views da janela; (3) `n` de "Criador responde" = longos de 30 a 89 dias (hoje o conferidor usa 3 a 90); (4) idade do vídeo de cada comentário >= 30; (5) "N de 112" e as duas datas pela mesma função; (6) percentual presente sempre que o `n` for de 10 ou mais, em Acerto e em Criador responde.

## Veredito por estado e largura

Medidas de rolagem, fonte, alvo, contraste e foco limpas em todos (tabela abaixo); o veredito vem dos achados.

| Estado | 1440 escuro | 390 claro | Veredito | Pendências |
|---|---|---|---|---|
| magro (caso real) | ok | ok | volta para ajuste | C1 |
| cheio | contradição (B1) | contradição (B1) | volta para ajuste | B1, C1 (ⓘ), C2, C3 |
| extremo | contradição (B1), pontinhos | contradição (B1), pontinhos | volta para ajuste | B1, C2, C3 |
| parado | ok com defeito | ok com defeito | volta para ajuste | C1, C3, C5 |
| zero medido | ok | ok | volta para ajuste | C1 |
| não medido (nm) | ok | ok | pronto para o dono | só sugestões |
| erro | ok com defeito | ok com defeito | volta para ajuste | C2 |
| sem dado (vazio) | ok | ok | pronto para o dono | S4 só como sugestão |
| fora do ar | ok com defeito | ok com defeito | volta para ajuste | C5 |
| só Shorts | ok | ok | volta para ajuste | C1 |
| nichos diferentes | ok com defeito | ok com defeito | volta para ajuste | C2, C4 |
| só leitura | contradição (B1) | contradição (B1) | volta para ajuste | B1, C2, C3 |

Resumo: 2 prontos, 10 voltam para ajuste, 0 reprovados. Nenhum item exige redesenho: B1 é uma decisão de regra mais quatro linhas em `pc-dados.js`; C1 a C5 são uma linha cada.

## Tabela de medidas

| Item | Resultado | Como medi |
|---|---|---|
| Rolagem horizontal, 12 estados x 4 combinações | 0 px em 48 de 48 | scrollWidth − clientWidth |
| Texto menor que 12 px (dentro da tela simulada) | 0 em 48 de 48 | font-size computado de cada nó de texto visível |
| Alvos abaixo de 44 x 44 px a 390 px (ponteiro grosso), dentro da tela simulada | 0 em 24 de 24 | getBoundingClientRect em links, botões, summary, `[role=button]` e `[tabindex=0]`; ignorei o #mock (barra do mockup) e a referência |
| Contraste de texto (cor composta sobre o fundo efetivo, com alfa), 48 combinações, todos os nós de texto | menor razão 4,86:1; 0 abaixo de 4,5:1 (3:1 em texto grande) | WCAG sobre getComputedStyle; não cobre texto sobre a hachura rosa (fundo em gradiente), que li nas capturas |
| Contraste gráfico por token, escuro / claro, sobre o cartão | acento 6,72 / 4,94; subindo 7,26 / 6,37; descendo 7,71 / 5,55; ＝ 6,18 / 7,13; zero medido 4,97 / 4,84; não medido (borda) 4,09 / 4,57; azul do lado b 6,80 / 4,43; tiers 5,13 a 7,73 | razão dos hex de CONVENCOES contra --surface; todos acima de 3:1 |
| Foco por teclado (Tab 70x, a partir do cabeçalho) | 45 paradas no magro, 43 no erro, 53 no cheio, 0 sem anel de foco visível; ⓘ abre com Enter, Esc fecha e o foco volta ao botão | script próprio sobre `:focus-visible` e `[popover]:popover-open` |
| Pontinhos do Acerto em uma linha | 1440: 6 de 9 estados com Acerto medido; 1180 e 390: 4 de 9 | centro vertical dos filhos do `role="img"` agrupado em 12 px (C2) |
| color-mix() | 0 em CSS e JS que carregam a interface; só comentários "sem color-mix()" | grep na pasta |
| Movimento reduzido | `@media (prefers-reduced-motion: reduce)` zera transition e animation em `pc.css` | leitura do CSS |
| Jargão na tela (lido, gravou, CTR, diário, cron, série, snapshot, payload, pipeline, retenção) | 0 nos 12 estados com os blocos abertos | texto renderizado |
| aria com "undefined", "NaN", "1 dias", "1 acertos" | 0 | varredura de `aria-label` |
| Conferidor do desenhista (`coerencia.mjs`, 1440) | 0 linhas que não fecham; as 2 contradições acima passam por ele (ver "Por que o conferidor não pegou") | execução própria na porta 47756 |
| Servidores e navegadores desta revisão | portas 47752 a 47757 derrubadas (lsof vazio); a 47751 hoje serve outro processo (PID 97234, mockup 13), não meu | lsof |

## Por que o conferidor não pegou

O `coerencia.mjs` agora cobre muito (607 linhas), mas as duas falhas restantes têm a mesma causa: ele confere o que o desenhista pensou em conferir, com os mesmos deslocamentos que o desenho usa. Em B1 o limite que ele testa (3 a 90 dias) é o mesmo da fórmula; em C1 ele repete "24/08 + 56" e "24/08 + 111" como verdades separadas. Regra de ouro para a próxima: cada regra de negócio (idade mínima do vídeo, dia de corte, janela) tem uma constante só, e o ⓘ, a barra, a mensagem e o conferidor leem dela.

## O que NÃO consegui verificar
- Leitor de tela (VoiceOver, NVDA): só li `aria-label`, ⓘ e a estrutura de títulos.
- Safari, Firefox e Opera (o navegador do dono renderiza `color-mix()` transparente; confirmei só a ausência no código). Só Chromium.
- Toque real em aparelho (simulei hasTouch com viewport de 390 px).
- Fontes do Google (Fraunces, Inter, JetBrains Mono) bloqueadas na captura; quebras de linha reais podem variar alguns pixels, inclusive a quebra dos pontinhos de C2.
- Contraste do texto "não medido" sobre a hachura rosa (medi só sobre o fundo plano; nas capturas lê-se bem).
- Escala de cinza: li as capturas em cor; a r3 já verificou que a hachura e a caixa vazada se separam sem cor e nada mudou nas formas.
- Leitura direta de capturas: magro, erro, nm, zero (1440 escuro); cheio, erro, extremo e vazio (390 claro). Os demais estados e cruzamentos (extremo, fora, parado, shorts, nichos, leitura a 1440 e 390 nos dois temas) foram conferidos por texto, medidas e dados, não por captura.
- Se os números de exemplo da regra de 30 dias de comentários (B1) estão no spec: li o texto do mockup, não reabri a spec 04.

## Para quem desenhou

Devolve para a rodada 6 com B1 e C1 a C5. Se discordar de B1 (preferir contar vídeos de 3 dias ou mais), responda com a frase que explica como "fecha em 10/11" e "30 dias de comentários guardados" continuam verdadeiros nessa regra, e eu mantenho ou retiro por escrito. Em C1 o que importa é uma regra só; qual dos dois lados vence (24/08 sujo ou limpo) é indiferente para mim, desde que 56 e 112 concordem. As sugestões ficam para o dono decidir. Depois disso, é uma reconferência de uma passada: rodar o conferidor com as seis relações novas e refazer só magro, cheio, extremo, parado, erro, nichos e leitura.
