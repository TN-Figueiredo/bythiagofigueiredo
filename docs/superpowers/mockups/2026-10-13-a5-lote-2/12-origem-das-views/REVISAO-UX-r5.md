# Revisão de UX, rodada 5: mockup 12 (origem das views)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/12-origem-das-views/`.

Método: Chromium headless por `file://` (Playwright do repositório, fontes externas bloqueadas, sem servidor, sem porta 3099, sem spec do projeto; nada ficou aberto). Scripts meus, em área temporária, não copiados do `verificar-coerencia.mjs`:

1. **Texto de tudo, por código:** 73 casos (vídeo, canal e cartão x 10 estados x períodos) a 1440 px, `innerText` mais todos os `aria-label` mais o conteúdo dos ⓘ (template). Li o texto de típico, extremo, magro (7, 28, 90, desde 2015), zero (7 e desde a publicação), não medido (vídeo e canal), sem dado (7 e desde a publicação), erro, carregando, revisão (vídeo e canal), só leitura (as variantes) e os 11 cartões, e conferi à mão cada número contra os outros da mesma tela e contra a tela vizinha (cartão x página do canal).
2. **Medidas:** 172 casos x 4 cruzamentos (1440 e 390, claro e escuro) = 688 leituras de rolagem horizontal, fonte, alvo, contraste de texto composto (cor lida do estilo computado, fundo composto pelos ancestrais) e erros de página. Tab em 22 passos em dois casos (canal magro 1440, vídeo zero 390), com ⓘ por teclado e Esc.
3. **Olhei em captura:** magro canal 90 dias (1440 escuro inteiro, 390 claro em recorte a 1:1), zero do vídeo (1440 escuro inteiro, 390 claro em recorte), cartão magro (1440 escuro). As demais capturas de `shots/` eu não reabri; a conferência delas é por texto e medida.

## Veredito: VOLTA PARA AJUSTE (1 bloqueio novo, 1 corrige; r4 resolvida de verdade)

Os sete itens da r4 (B1, B2, B3, C1 a C4) estão resolvidos, nenhum conserto criou defeito novo, e as melhorias S1, S2, S5, S7 e S8 também. O desenho segue no nível: frase-resumo, régua, barra, cinco "vazios" distintos por forma, nenhum `color-mix()` na interface.

Sobrou **um** número de exemplo que contradiz outro, e ele o `verificar-coerencia.mjs` não pega porque o valor é digitado no `ov.js` e não derivado: a razão "o normal do canal" do vídeo zero (B1-r5). Mais um nome repetido com dados diferentes entre estados (C1-r5). Os dois são consertos de uma linha cada. Com eles e uma conferência nova no script, é "pronto para o dono".

### Resumo por veredito

| Veredito | Telas e estados |
|---|---|
| pronto para o dono | típico (vídeo e canal), extremo, magro (7, 28, 90, desde 2015), não medido, erro, carregando, revisão, só leitura (as duas variantes), cartão da comparação nos 10 estados |
| volta para ajuste | zero medido, vídeo (B1-r5); sem dado ainda, vídeo (C1-r5) |
| reprovado | nenhum |

As três coisas que mais pesam no conjunto: (1) **número digitado em vez de derivado** (a razão 0,2× e 1,4× são literais no `ov.js:301-303`; é a mesma causa de todos os achados de coerência das rodadas 1 a 4); (2) **o mesmo vídeo com dados diferentes entre estados** (título repetido com data de publicação diferente); (3) a conferência por código ainda cobre soma e janela, não **razão e identidade entre estados**.

## A pergunta do usuário e a resposta em 3 segundos

Pergunta: **"de onde vêm as minhas views, e posso confiar nesse número?"**. Respondida no primeiro olhar a 1440 px sem rolar: frase-resumo com chip da líder, "7 de 7 dias com a origem medida" e a barra de 40 px (típico, extremo, magro com o olho riscado, zero com a caixa "0"). A 390 px o bloco começa depois do cabeçalho e do seletor (dúvida 9 da NOTAS, cabeçalho aprovado, não é desta tela). Estados de ausência por forma e cor: zero (caixa com "0"), não medido (hachura), omitido (tracejado com olho), ainda não existe (pontilhado com relógio), cadeado.

## Conferência dos itens da r4

| Item | Resultado | Evidência |
|---|---|---|
| B1-r4 (nome do canal) | **resolvido** | Magro: migalha "Aldeia Digital Lab", h1 "Aldeia Digital Lab", sigla AD (captura 1440 e 390). Extremo: "tnFigueiredo Viagens" nas três posições, sigla TV. A migalha do vídeo lê o canal típico. |
| B2-r4 (pesquisa 3 contra 5) | **resolvido** | Magro 28 dias: "as 4 views da pesquisa dos 28 dias desta lista" mais "Sem comparar com o total da pesquisa: a origem foi medida em 8 dos 28 dias desta lista". 90 dias e desde 2015: "as 5 ... dos 34 dias" mais "8 dos 34". 7 dias: "as 3 views da pesquisa", igual ao 3 da lista de origem. Conta: 14 views x 3/14 = 3; janela de 28 dias = 19 views x 3/14 = 4; janela de 34 dias = 21 views x 3/14 = 5. Fecha. |
| B3-r4 (cartão magro, cliques) | **resolvido** | Cartão magro: 637 impressões, 10 cliques, 1,6% entre 0,6% e 2,5%; página do canal em 7 dias: 12 views. 10 menor que 12; 10/637 = 1,57%; intervalo 1,96 x raiz(0,0157 x 0,9843 / 637) = 0,97 ponto: 0,6% a 2,5%. Típico 1.980 menor que 3.185; extremo 127.680 menor que 361.256. |
| C1 ("seus vídeos" no vídeo) | **resolvido** | "este vídeo foi mostrado 11.550 vezes" (típico, revisão, só leitura); no canal, "seus vídeos". |
| C2 ("há 2709 dias") | **resolvido** | "há 2.709 dias" no cabeçalho; ⓘ diz que a contagem de dias vai até 11/10 e a idade conta até hoje (2.708 e 2.709 explicados). |
| C3 ("lugar nenhum") | **resolvido** | "O YouTube mandou os 7 dias e nenhuma view foi contada." |
| C4 (ⓘ da revisão) | **resolvido** | "Aqui a soma das origens passou do total, por isso a divisão não aparece até conferir." |
| S1, S2, S5, S7, S8 | feitas | S1: "Quando o relatório do YouTube chegar, este bloco aparece sozinho. Não é zero." S2: "as 14 views dos dias medidos". S7: no canal "só o total" o total fica só no cabeçalho. S8: `aria-label` "origem em revisão". |
| O ajuste criou defeito novo? | não | Nenhum texto novo contradiz outro. Os dois achados abaixo já existiam. |

## Bloqueios (impedem ir ao dono)

### B1-r5. Vídeo zero medido: "0,2× o normal do canal" com 41.200 views contradiz o "1,4×" do mesmo canal e o total do canal

- **Onde:** `?estado=zero` (e `&periodo=tudo`), cabeçalho do vídeo "Mochilão pelo Vietnã em 2019": **41.200 views** e **0,2×** "o normal do canal, views ÷ mediana dos outros vídeos". Captura 1440 escuro (`shots` desta rodada, `video-zero-7-1440-escuro.png`, linha de números do cabeçalho) e recorte a 390 claro (0,2× logo abaixo de 212 comentários, 41.200 na linha de cima).
- **O que está errado:** a razão é "views deste vídeo ÷ mediana de views dos outros vídeos" (o ⓘ do cabeçalho diz isso, e a legenda sob o número também). 41.200 ÷ x = 0,2 obriga a mediana dos outros vídeos a ser 206.000 views. No mesmo canal (tnFigueiredo), o vídeo típico tem 3.870 views e 1,4×, ou seja, mediana de cerca de 2.764. O canal tem 35 vídeos e 1.842.600 views desde 2015: uma mediana de 206.000 exigiria pelo menos 18 vídeos acima disso, mais de 3,6 milhões de views, o dobro do total do canal. Quem alterna Típico e Zero na barra vê o vídeo com 10 vezes mais views e a razão cair de 1,4× para 0,2×.
- **Evidência:** `ov.js:301` (`normal: .2`) e `ov.js:303` (`normal: 1.4`) são literais; nada deriva delas, e o `verificar-coerencia.mjs` não confere razão (busca por "normal" e "mediana" no script: zero ocorrências). Conta do típico: 3.870 ÷ 1,4 = 2.764.
- **Correção exata:** uma constante `D.MEDIANA_OUTROS = 2764` em `ov-dados.js` e `normal = vida / D.MEDIANA_OUTROS` arredondado a uma casa nos dois vídeos (típico 3.870 dá 1,4×, zero 41.200 dá 14,9×; "Sem dado" continua "novo demais"). Se 14,9× ao lado de "zero medido" parecer estranho ao dono, o caminho é baixar as views da vida do zero para cerca de 580 (580 ÷ 2.764 = 0,2×) e ajustar curtidas e comentários para o engajamento continuar fechando; o que não pode é o literal. Acrescentar ao script a conferência "views do cabeçalho ÷ mediana única = razão mostrada (uma casa)".

## Corrige (vai ao dono só depois de corrigido)

### C1-r5. Sem dado ainda: mesmo título do vídeo típico, com data e views diferentes

- **Onde:** `?estado=vazio`, título "Quanto custa uma semana em Hanói?", "Publicado em 12/10/2026 (há 1 dia)", 212 views. No típico, o mesmo título: "Publicado em 20/09/2026 (há 23 dias)", 3.870 views, 212 curtidas.
- **O que está errado:** um vídeo só do canal tnFigueiredo com duas datas de publicação. O desenhista já separou o zero com outro título; o vazio ficou de fora. Também coincide o número 212 (views aqui, curtidas lá), o que piora a impressão de ser o mesmo vídeo.
- **Correção:** dar outro título ao vídeo do estado vazio (por exemplo "Hanói à noite: o que ver depois das 22h") em `ov.js:302`; os números (212 views, 9 curtidas, 1 comentário, 4,7%) seguem iguais.

## Melhorias (não bloqueiam)

1. **S1-r5. ⓘ da origem fala de "vídeo" na página do canal e do "total sempre fecha" no não medido:** "a idade do vídeo conta até hoje" aparece também nos ⓘ do canal, e "O total sempre fecha" aparece no estado em que não há total. Trocar a primeira por texto só no vídeo e omitir a segunda no não medido (`ov.js:136`).
2. **S2-r5. ⓘ cita 24/08/2026 em períodos que não cruzam essa data:** o canal em 7 dias recebe "Períodos que cruzam essa data não se comparam direto". Mostrar a linha só quando o período cruza a data (a régua já marca o losango só nesses casos).
3. **S3-r5. "% assistido 51%" é constante em todos os cartões com dado, inclusive o magro (19 views em 28 dias) e o extremo (milhões):** `D.ASSIST` fixo. Não contradiz nada na tela, mas um dono que alterne os estados vê 51% sempre; derivar um valor por perfil (por exemplo 51%, 38% e 58%) evita a pergunta.
4. **S4-r5. Cartão em revisão:** o `aria-label` da linha de origem ainda diz "não medido", enquanto o bloco da página já diz "origem em revisão". Alinhar.
5. **S5-r5. Parâmetro `pais=mes`:** continua só pela URL, com 34.100 e 2.299 digitados em `ov.js:218`. Não revisei (fora da fila de aprovação); se entrar, precisa passar pela mesma varredura.

## Varredura de coerência dos números de exemplo (a que o dono pediu): tudo o que achei agora

| # | Estado e tela | Conferido | Resultado |
|---|---|---|---|
| 1 | Zero, vídeo | 0,2× contra 41.200 views e contra o 1,4× do típico | **falha, B1-r5** |
| 2 | Sem dado, vídeo | título e data iguais ao do típico com valores diferentes | **falha, C1-r5** |
| 3 | Típico, canal 7, 28, 90, desde 2015 | 3.185; 11.640 (8 x 455 + 20 x 400); 36.440; 1.842.600; origens somam o total; termos 829 = soma da lista; sites 188 = soma da lista; aparelho, país e inscritos somam o total; impressões 41.300 = 7 x 5.900 | fecha |
| 4 | Típico, vídeo 7 e desde a publicação | 826 = 7 x 118; 944 = 8 x 118; 3.870 = 944 + 14 x 209; "há 23 dias" de 20/09; 22 dias de 20/09 a 11/10; 36.300 = 22 x 1.650; engajamento (212+31)/3.870 = 6,3%; termos 149 e sites 30 = somas das listas | fecha |
| 5 | Extremo, canal | 361.256 = 7 x 51.608; termos 23.981 e sites 9.571 = somas; 100% da lista de país (33+12+8+5+4+30+3+5); nome nas três posições | fecha |
| 6 | Magro, canal 7, 28, 90, desde 2015 | 12, 19, 36, 36; 5+7 = 12 e 5+9 = 14; 3 x 14/14 em 7 dias e 8 dias (o dia 04/10 teve 2 views omitidas: 14-12 = 2, 4-3 e 5-4 de celular e Brasil cabem); 34 dias = 21 views; impressões 637, 2.548, 3.094 = 91 x 7, 28, 34 | fecha |
| 7 | Zero, vídeo | engajamento (1.900+212)/41.200 = 5,1%; 14/05/2019 a 13/10 = 2.709 dias e a 11/10 = 2.708; 8 e 34 dias; todo bloco "zero medido" | fecha, exceto o 0,2× |
| 8 | Não medido (vídeo e canal) | "0 de 7, 28, 90, 4.205"; todos os blocos com 14/10; nenhuma porcentagem; "Termos: não coletada" no cartão explicado na NOTAS (fonte antiga x relatório em lote) | fecha |
| 9 | Erro | sete faltas citadas = os 7 blocos; total 3.185 certo; hora 14:32 de hoje e última boa 12/10 06:10 | fecha |
| 10 | Carregando | 36.440 no cabeçalho = típico 90 dias; "de 90 · carregando" | fecha |
| 11 | Revisão | 826 contra 860 (soma passou em 34), ⓘ e frases dizem a mesma coisa; aparelho, país, inscritos somam o total | fecha |
| 12 | Só leitura | 7 blocos contados = origem, impressões, termos, sites, aparelho, país, inscritos; total só no cabeçalho do canal | fecha |
| 13 | Cartão x página do canal, 10 estados | líder (42% e 18%), aparelho 62%, país 70%, inscritos 58% e busca líder 216 iguais; impressões iguais; cliques menores que as views em todos | fecha |
| 14 | Datas | "primeira leitura em 15/10" = 12/10 + 3; 4.205 dias de 08/04/2015 a 11/10; 28 e 90 dias com 14/09 e 14/07; 34 dias de 08/09; nada passa de 11/10 | fecha |

## Tabela de medidas

| Item | Medida | Limite | Resultado |
|---|---|---|---|
| Rolagem horizontal, 172 casos x 4 cruzamentos | 0 px em todos | 0 | ok |
| Texto abaixo de 12 px | 0 | 0 | ok |
| Contraste de texto composto, pior caso, escuro | 4,86:1 ("05/10 a 11/10" na leitura só total) | 4,5 | ok; 0 trechos abaixo do limite (pequeno 4,5; grande 3) |
| Contraste de texto composto, pior caso, claro | 4,73:1 (chip "seu canal") | 4,5 | ok; 0 trechos abaixo |
| Contraste das fatias (elemento gráfico) | não refeito: `ov.css` não mudou desde a r4 (pior caso r4: 4,43:1 "fora" no claro) | 3,0 | ok (herdado da r4) |
| Alvos a 390 px (migalha, período, ⓘ, "Tentar de novo", links) | 0 elementos interativos abaixo de 44 x 44; ⓘ a 44 x 44 | 44 | ok |
| Alvos a 1440 px | ⓘ 28 x 28 e migalha 41 x 20 (ponteiro fino; padrão do lote 1) | sem exigência para mouse | aceito |
| Foco visível (Tab, 22 passos x 2) | contorno sólido 2 px em todos; ordem visual correta; Esc devolve o foco ao ⓘ | 2 px | ok |
| `color-mix()` na interface | 0 regras fora de comentário (conferido na r4; arquivos de estilo não mudaram) | 0 | ok |
| Erros de página no console | 0 | 0 | ok |
| Número x número (razão do cabeçalho do vídeo) | zero 0,2× implica mediana 206.000; típico 1,4× implica 2.764 | uma mediana só | **falha (B1-r5)** |
| Identidade entre estados (vídeo) | vazio e típico: mesmo título, datas 12/10 e 20/09 | um título, uma data | **falha (C1-r5)** |
| Estados de ausência | zero (caixa), não medido (hachura), omitido (tracejado), ainda não existe (pontilhado), cadeado | distintos por forma e cor | ok |

## O que não consegui verificar

- Leitor de tela real (VoiceOver, NVDA): li papéis e `aria-label`, não ouvi.
- Safari e Opera (navegador do dono): só Chromium. Hachura, pontilhado e listrado (`repeating-linear-gradient`) não foram vistos no Opera.
- Toque real: `hasTouch` não liga `pointer: coarse`; os 44 px a 390 px vêm da regra por largura e batem.
- Contraste de texto sobre hachura: nenhum texto fica sobre hachura (conferido nas capturas que abri).
- Impressão em preto e branco: não imprimi (a r4 calculou a luminância das fatias).
- ⓘ por teclado: o foco volta ao botão depois do Esc, mas meu detector de painel aberto não achou o elemento (seletor errado), então não confirmei por código que o painel abre com Enter; a r4 e o lote 1 já tinham passado por isso.
- Capturas: abri só magro 90 dias, zero do vídeo e cartão magro; o resto por texto e medida.
- Dado real: tudo é exemplo.

## Para a rodada 6

Reconferir B1-r5 e C1-r5. Pedido de método: acrescentar ao `verificar-coerencia.mjs` (a) razão do cabeçalho = views da vida ÷ uma mediana única; (b) mesmo título de vídeo, mesma data de publicação em todos os estados. Com isso e os dois consertos, nada novo aberto, é "pronto para o dono".
