# Revisão de UX, rodada 4: mockup 12 (origem das views, termos e sites, aparelho, país, inscritos)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/12-origem-das-views/`.

Método: Chromium headless (Playwright do repositório, `file://`, fontes externas bloqueadas, sem servidor, sem porta 3099, sem spec do projeto; nenhum processo ficou aberto). Duas varreduras novas, feitas por mim e não copiadas do `verificar-coerencia.mjs` do desenhista:

1. **Texto de tudo, por código:** 73 casos (vídeo, canal e cartão x 10 estados x períodos) a 1440 px, com `innerText` e todos os `aria-label`. Li o texto de cada estado e conferi à mão cada número contra os outros da mesma tela e contra a tela vizinha (cartão x página do canal).
2. **Medidas:** 34 casos x 4 cruzamentos (1440 e 390, claro e escuro) = 136 leituras de rolagem, fonte, alvo, estouro de largura e contraste de texto composto (cor lida do estilo computado, fundo composto pelos ancestrais); contraste de elemento gráfico das fatias nos dois temas; 40 passos de Tab em três casos; `color-mix()` nas folhas.

Olhei, em recorte a 1:1: típico do canal 7 dias (1440 escuro, 390 claro, inteiro), não medido do canal (1440 escuro e 390 claro), magro (1440 escuro nos quatro recortes, 390 claro), zero do vídeo (1440 escuro, 390 claro), revisão e erro do canal (1440 escuro), vazio do vídeo (1440 escuro), carregando (390 claro), cartão da comparação magro (1440 escuro). Conferi que as capturas de `shots/` (sem prefixo) são as do código atual: refiz seis e os pixels são idênticos.

## Veredito: VOLTA PARA AJUSTE (3 bloqueios novos, achados na varredura de coerência; o B1-r3 está resolvido de verdade)

O B1-r3 (célula "7 de 7" no não medido do canal) foi corrigido sem criar defeito: a célula agora diz "0 de 7 · a coleta começa em 14/10" com o marcador hachurado, e o mesmo vale em 28, 90 e desde 2015 (0 de 28, 0 de 90, 0 de 4.205). As melhorias 1 a 4 da r3 também foram feitas. O desenho está firme: a frase-resumo, a régua, a barra e o cuidado com "zero medido", "não medido", "omitido" e "ainda não existe" estão no nível.

O que derruba a rodada é exatamente a classe de erro que o dono apontou: **número de exemplo que contradiz outro na mesma tela**, desta vez no estado **magro** (nome do canal, "5 de 3" de pesquisa) e no cartão do magro (cliques acima das views). Nenhum deles aparece em `verificar-coerencia.mjs`, porque o script confere somas e porcentagens, não identidade, janela de datas nem plausibilidade entre grandezas. Lista completa abaixo, de uma vez, para não sobrar nada para a r5.

### Resumo por veredito

| Veredito | Telas e estados |
|---|---|
| pronto para o dono (depois de reconferir os consertos de uma linha) | típico do canal, não medido (vídeo e canal), sem dado, erro, carregando, só leitura (as duas variantes) |
| volta para ajuste | extremo (canal): B1-r4; magro (canal): B1-r4 e B2-r4; cartão da comparação, magro: B3-r4; vídeo em todos os estados com impressões: C1; zero (vídeo): C2 e C3; revisão (ⓘ): C4 |
| reprovado | nenhum |

As três coisas que mais derrubam o conjunto: (1) o **magro** é onde os números derivados de fontes diferentes se separam (identidade do canal, pesquisa 3 contra 5, taxa de clique fixa em 4,8% com 12 views); (2) **texto de canal reaproveitado na página do vídeo** ("seus vídeos foram mostrados" sobre um vídeo só); (3) **a mesma verificação só por soma**: o que falta conferir é identidade, janela e grandeza, não só aritmética.

## A pergunta do usuário e a resposta em 3 segundos

Pergunta: **"de onde vêm as minhas views, e posso confiar nesse número?"**. A 1440 px, sem rolar, no típico do canal: frase com chip da líder ("42% ... da pesquisa do YouTube e 18% de vídeos sugeridos; 6% foram omitidos"), linha "7 de 7 dias com a origem medida", barra de 40 px com o maior contraste da tela e fatia tracejada do omitido. Responde. No magro o chip vira o olho riscado e a frase diz "só 5 views das 14... 9 omitidas": responde. A 390 px o cartão começa abaixo da dobra (dúvida 9 da NOTAS, cabeçalho aprovado, não é desta tela).

## Contagem por estado e largura

Par obrigatório: 1440 escuro e 390 claro. Os outros dois cruzamentos só por medida (todos limpos).

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico, vídeo (7 dias, desde a publicação) | corrige C1 | corrige C1 | "seus vídeos foram mostrados" |
| Típico, canal (7, 28, 90, desde 2015) | ok | ok | contas fecham |
| Extremo, canal | volta (B1-r4) | volta (B1-r4) | migalha "tnFigueiredo" sobre título "tnFigueiredo Viagens"; o resto fecha |
| **Magro, canal (7, 28, 90, desde 2015)** | **volta (B1-r4, B2-r4)** | **volta (B1-r4, B2-r4)** | nome do canal; pesquisa 3 contra 5/4 (B2 de 28 dias em diante) |
| Zero medido, vídeo | corrige C2, C3 | corrige C2, C3 | "há 2709 dias"; frase "lugar nenhum" |
| Não medido, canal e vídeo | ok | ok | B1-r3 resolvido |
| Sem dado ainda | ok | ok | |
| Erro | ok | ok | |
| Carregando | ok | ok | |
| Origem em revisão | corrige C4 | corrige C4 | ⓘ diz "o total sempre fecha" |
| Só leitura (sem termos e sites / só o total) | ok | ok | |
| **Cartão da comparação, magro** | **volta (B3-r4)** | **volta (B3-r4)** | 31 cliques com 12 views |
| Cartão da comparação, os outros 9 estados | ok | ok | |

## Conferência dos itens da r3

| Item | Resultado | Evidência |
|---|---|---|
| B1-r3: célula "dias com origem medida" no não medido do canal | **resolvido** | Texto lido: "dias com origem medida / 0 de 7 · a coleta começa em 14/10" + marcador "não medido" (hachura, não a caixa do zero). 28: "0 de 28", 90: "0 de 90", tudo: "0 de 4.205". Capturas `shots/nao-medido-canal-1440-escuro.png` e `-390-claro.png` conferidas. Nenhuma contradição nova: origem, impressões, termos e sites, aparelho, país e inscritos dizem "não medido" com a mesma data (14/10), inclusive o ⓘ. |
| Melhoria 1 (erro e carregando) | feita | Erro: "—" com "de 7 · não conseguimos ler agora"; carregando: "—" com "de 90 · carregando"; revisão: "7" com "de 7 · origem em revisão". |
| Melhoria 2 (revisão, termos) | feita | "Sem comparar com o total da pesquisa: a origem está em revisão." nos termos e nos sites; a barrinha sai. |
| Melhoria 3 (rodapé do magro) | feita, com ressalva | "A divisão acima usa só as 14 dos dias medidos." Resolve o sentido, mas ver S2 (falta o substantivo). |
| Melhoria 4 (legenda da tabela) | feita | "canal, 7 dias" e "(magro, canal, 90 dias)". |
| Ajuste criou defeito novo? | não | Nenhum dos consertos da r3 introduziu contradição. Os achados abaixo já existiam e passaram despercebidos em r1 a r3 (assumo a parte que me cabe: li o magro pelo aria-label e pelo cabeçalho, não pela identidade da página). |

## Bloqueios (impedem ir ao dono)

### B1-r4. Magro e extremo: a migalha e o avatar dizem "tnFigueiredo", o título diz outro canal

- **Onde:** `?estado=magro` (e `?estado=extremo`), primeira linha e cabeçalho da página, em todos os períodos. Captura `shots/r4-b1-magro-cabecalho-1440-escuro.png` (migalha "Canais › tnFigueiredo" sobre o título "Aldeia Digital Lab", avatar "TF"); a 390 px, `shots/magro-canal-390-claro.png` (mesma contradição, y 150 a 215).
- **O que está errado:** a mesma tela chama o canal de duas coisas. No magro a migalha diz "tnFigueiredo" e o título "Aldeia Digital Lab" (sigla do avatar "TF" não bate com "AD"); no extremo, migalha "tnFigueiredo" e título "tnFigueiredo Viagens". É a primeira linha que o dono lê e é a identidade da tela.
- **Evidência:** `ov.js:302` troca só o título (`mag ? 'Aldeia Digital Lab' : ext ? 'tnFigueiredo Viagens' : 'tnFigueiredo'`); a migalha (`ov.js:298` e `302`) e o avatar `TF` são fixos. Lido do DOM: migalha "Canais tnFigueiredo", h1 "Aldeia Digital Lab", avatar "TF".
- **Correção exata:** derivar nome e sigla de uma constante por cenário (`D.NOME = {tipico:'tnFigueiredo', extremo:'tnFigueiredo Viagens', magro:'Aldeia Digital Lab'}`, sigla = iniciais) e usar nos três lugares (migalha, h1, avatar). Se preferir, deixar os três cenários com "tnFigueiredo" e tirar o nome falso: o que importa é um nome só.

### B2-r4. Magro (28, 90 dias e desde 2015): "Pesquisa do YouTube 3" na lista e "as 5 views da pesquisa" (ou 4) no bloco de termos, na mesma tela

- **Onde:** `?estado=magro&periodo=28` e `90` e `tudo`. Captura `shots/r4-b3-magro-pesquisa-3-contra-5-1440-escuro.png`: lista de origem "Pesquisa do YouTube 3 (22%)" e, três cartões abaixo, "as 5 views da pesquisa ficaram sem termo". Em 28 dias o texto diz "as 4 views".
- **O que está errado:** é o "5 das 3" da r2, em outra forma. As duas contas são certas (3 views de pesquisa nos 8 dias medidos; 5 nos 34 dias do relatório em lote, 3/14 de 21 views), mas a tela não diz isso: no típico existe a linha "Sem comparar com o total da pesquisa: a origem foi medida em 8 dos 34 dias desta lista"; no magro a lista de termos está vazia, então a linha não existe e o leitor vê 3 e 5 para a mesma coisa. Quem lê "pesquisa 3" e depois "as 5 views da pesquisa" conclui que um dos dois erra.
- **Evidência:** texto lido: período 90, "Pesquisa do YouTube | 3 | 22%" e "Nenhum termo apareceu... as 5 views da pesquisa ficaram sem termo". A NOTAS (tabela de coerência, linha do magro) lista "as 3 views da pesquisa (7 dias) / as 5 (90 dias)" como coerente; está, no código, mas não na tela.
- **Correção exata:** quando os dois conjuntos cobrem janelas diferentes (cO.ok diferente de cL.ok), a frase do magro vira "...as 5 views da pesquisa **nos 34 dias desta lista** (a origem acima cobre 8 dias) ficaram sem termo" ou, mais simples, tirar o número ("as views da pesquisa ficaram sem termo"). Em 7 dias, onde as janelas são iguais, o 3 fica como está.

### B3-r4. Cartão da comparação, magro: 31 cliques estimados com 12 views na semana

- **Onde:** `?tela=cartao&estado=magro`. Captura `shots/r4-b2-cartao-magro-1440-escuro.png` (Impressões 637, Cliques estimados 31, Taxa 4,8% entre 3,1% e 6,5%); a página do mesmo canal em 7 dias (`shots/magro-canal-7-1440-escuro.png`) diz 12 views.
- **O que está errado:** o canal teve 12 views em 05/10 a 11/10 e o cartão diz que as impressões da mesma semana geraram 31 cliques. Clique que não vira view em número três vezes maior não existe para quem vive de YouTube. A NOTAS V5 diz que as linhas do cartão derivam do mesmo perfil; derivam, mas a taxa é a constante 4,8% (`D.TAXA`) em todos os estados, inclusive o de 12 views.
- **Evidência:** `ov-dados.js`, `c.card`: `cliques = round(imp7 x taxa)`, `taxa = D.TAXA` fixa; magro: 7 x 91 = 637 impressões, 637 x 4,8% = 31. Na página do canal, 7 dias: 12 views (soma de `MAG_DIA`, últimos 7). No extremo e no típico os cliques ficam abaixo das views (127.680 contra 361.256; 1.980 contra 3.185), por isso só o magro quebra.
- **Correção exata:** derivar a taxa de clique do magro das views (por exemplo, `taxa = round(views_7d x 0,8) / impressoes_7d`, ou 1,6% com 10 cliques e intervalo recalculado), ou subir as views do magro. O que não pode é cliques maiores que as views da mesma janela. Conferir a conta no `verificar-coerencia.mjs`: "cliques do cartão não passam das views do período".

Severidade: B1 e B2 são o mesmo erro de classe da r1 e da r2 (número ou nome que a tela contradiz na própria tela); B3 é o mesmo erro entre a tela e a vizinha. O dono pediu para não deixar essa classe passar.

## Corrige (vai ao dono só depois de corrigido)

### C1. Página do vídeo: "seus vídeos foram mostrados" quando a página é de um vídeo só

- **Onde:** impressões por origem em todos os estados do **vídeo** com dado (típico 7 dias e desde a publicação, revisão, só leitura). Texto lido: "Nos 7 dias medidos, **seus vídeos** foram mostrados 11.550 vezes; 39% em vídeos sugeridos." O estado zero do vídeo, ao contrário, diz "o vídeo não foi mostrado a ninguém", então a própria tela se contradiz de um bloco para outro.
- **Evidência:** `ov.js:180`, a frase é a mesma para canal e vídeo.
- **Correção:** no vídeo, "Nos 7 dias medidos, este vídeo foi mostrado 11.550 vezes; 39% em vídeos sugeridos." (e no zero, mantém).

### C2. Zero (vídeo antigo): "há 2709 dias" sem separador, ao lado de "2.708" e de "2.709" no mesmo bloco

- **Onde:** `?estado=zero` e `?estado=zero&periodo=tudo`, cabeçalho: "Publicado em 14/05/2019 (há **2709** dias)". Embaixo, "8 de **2.708** dias com a origem medida".
- **O que está errado:** formatação diferente para o mesmo tipo de número na mesma tela (a NOTAS V8 disse ter corrigido o "há 2709"; só corrigiu as views). E dois números quase iguais (2709 e 2.708) sem explicação: o primeiro conta até hoje (13/10), o segundo até o último dia entregue (11/10). Em `?periodo=tudo` do vídeo típico acontece o mesmo em escala menor ("há 23 dias" e "8 de 22 dias"), mas ali as datas na régua deixam o leitor conferir; no 2.708 não há régua de datas para comparar a primeira vez.
- **Correção:** passar `idadeTxt` já formatado (`n(A.dias(...))`, "há 2.709 dias") em `ov.js:295` e no cabeçalho do zero. Sugestão: no ⓘ da cobertura, uma frase "conta até 11/10, o último dia entregue".

### C3. Zero (vídeo): "nenhuma view veio de lugar nenhum"

- **Onde:** `?estado=zero`, bloco de origem: "O YouTube mandou os 7 dias e nenhuma view veio de lugar nenhum."
- **O que está errado:** frase confusa, quase um enigma. "Zero medido" já é a mensagem. Regra do dono: frases sem enfeite que afirmam mais do que o dado sustenta.
- **Correção:** "O YouTube mandou os 7 dias e nenhuma view foi contada." (ou "nenhuma view nesses 7 dias").

### C4. Revisão: o ⓘ da origem diz "O total sempre fecha" sobre uma tela que diz que não fechou

- **Onde:** `?estado=revisao`, ⓘ "Como a origem é calculada": "O total sempre fecha: a soma das origens mais o omitido é igual ao total." A tela acima diz "as origens somaram mais views do que o total do dia a dia, então não mostramos a divisão". A tabela de referência embaixo diz 826 contra 860.
- **Evidência:** `ov.js:135-136`, `infoOrigem()` não considera `estado === 'revisao'`.
- **Correção:** em revisão, trocar o item por "Aqui a soma passou do total; por isso a divisão não aparece até conferir." (ou "Normalmente o total fecha...").

## Melhorias (não bloqueiam)

1. **S1. Texto repetido no "não medido":** "Ainda não temos as impressões por origem: o relatório do YouTube não chegou." e logo abaixo "Ainda não coletado: o relatório do YouTube ainda não chegou. Quando chegar, este bloco aparece sozinho." dizem a mesma coisa duas vezes (impressões e termos e sites, nos dois). Cortar o início da segunda: "Quando chegar, este bloco aparece sozinho."
2. **S2. "usa só as 944 dos dias medidos":** falta o substantivo; "as 944 views dos dias medidos". Em todos os estados com cobertura parcial.
3. **S3. Cartão, não medido:** o cartão mostra "Impressões 41.300 de 05/10 a 11/10" e, sete linhas abaixo, "Termos: não coletada: o relatório do YouTube ainda não chegou"; na página, "impressões por origem" também diz que o relatório não chegou. Provavelmente são relatórios diferentes (a linha antiga já existe em produção), mas a NOTAS e o ⓘ do cartão não dizem. Declarar na NOTAS que a linha antiga de impressões não vem do relatório em lote, ou o dono vai perguntar.
4. **S4. A lupa muda de cor:** em "De onde vêm as views" a lupa é azul-céu (pesquisa do YouTube); em "Termos de pesquisa" o chip da lupa é laranja do "seu canal". Mesma forma, duas cores, contra a regra "cor estável por significado" da PLANO. A seta de saída de "Sites de fora" tem o mesmo desencontro (pontilhada azul na origem, laranja nos sites). Defensável pela regra "medida do próprio canal é laranja", mas vale uma frase no ⓘ de termos, ou usar o azul e o pontilhado nos dois lugares. Não bloqueia: nenhuma das duas leituras fica ambígua (o título do bloco diz o que é).
5. **S5. Barra do mockup:** em "Zero medido" e "Sem dado" a escolha "Página do canal" é ignorada em silêncio (o estado força a página do vídeo); em "Magro", "Extremo" e "Carregando" a escolha "Página do vídeo" também. A r3 (minha) listou "Magro (canal e vídeo)"; só existe canal. Quem testa o mockup clica e nada acontece. Desabilitar o botão que não vale para o estado ou dizer na NOTAS.
6. **S6. Erro:** o texto diz "A última consulta que deu certo foi a de 12/10, às 06:10" e a tela não mostra nada dela. Pergunta ao dono (não é erro de desenho): mostrar a última leitura boa com a data, em vez do bloco vazio.
7. **S7. Só leitura, "só o total":** o cabeçalho do canal e o cartão "Views no período" repetem 3.185 (o primeiro como "views no período 05/10 a 11/10", o segundo igual). Cortar um dos dois.
8. **S8. "Não medido" em revisão:** o chip e o `aria-label` do bloco em revisão dizem "não medido", mas o dado chegou e foi retido; a NOTAS reconhece o desenho. Para leitor de tela, "em revisão" informa mais do que "não medido". Sugestão: `aria-label` "origem em revisão".
9. **S9. Cor em escala de cinza:** pesquisa, sugeridos e início ficam com luminância de 156, 160 e 145 (0 a 255) em tons de cinza no escuro, quase iguais. Quem separa são o símbolo dentro da fatia, a ordem fixa e o filete entre elas: aceitável e declarado (dúvida 8), mas é o ponto frágil se o dono pedir impressão em preto e branco.

## Varredura de coerência dos números de exemplo (a que o dono pediu): tudo o que achei agora

| # | Estado e tela | Achado | Onde está neste arquivo |
|---|---|---|---|
| 1 | Magro e extremo, canal | migalha e avatar x título (nome do canal) | B1-r4 |
| 2 | Magro, canal 28/90/tudo | "Pesquisa 3" x "as 5 (ou 4) views da pesquisa" | B2-r4 |
| 3 | Cartão, magro | cliques 31 > views 12 | B3-r4 |
| 4 | Vídeo com impressões | "seus vídeos" (plural) | C1 |
| 5 | Zero, vídeo | "há 2709" sem separador, perto de "2.708" | C2 |
| 6 | Zero, vídeo | frase "nenhuma view veio de lugar nenhum" | C3 |
| 7 | Revisão | ⓘ "o total sempre fecha" | C4 |
| 8 | Não medido (vídeo e canal) | frase repetida | S1 |
| 9 | Todos com cobertura parcial | "só as N dos dias medidos" | S2 |
| 10 | Cartão, não medido | impressões 41.300 x "relatório não chegou" | S3 |
| 11 | Origem x termos (típico/extremo, 28, 90, desde 2015) | números diferentes, mas com a linha "sem comparar... 8 dos 34 dias": ok | sem achado |

O que conferi e **fecha** (para o desenhista não refazer): somas e porcentagens de todas as listas (verificado também por mim, à mão, em típico canal 7 e desde 2015, vídeo 7 e desde a publicação, extremo 7 e 90 e desde 2015, magro 7, 28, 90, zero, revisão); 3.185 = 455 x 7; 11.640 = 8 x 455 + 20 x 400; 36.440 e 3.701.064 idem; 826 = 118 x 7; 3.870 = 944 + 14 x 209; 4.205 dias de 08/04/2015 a 11/10/2026, 2.708 de 14/05/2019 a 11/10/2026 e 2.709 até 13/10; 28 e 90 dias com as datas "14/09 a 11/10" e "14/07 a 11/10"; 34 dias de 08/09 a 11/10; "há 23 dias" de 20/09 e "há 1 dia" de 12/10; engajamento (212+31)/3.870 = 6,3%, (1.900+212)/41.200 = 5,1%, (9+1)/212 = 4,7%; cliques 41.300 x 4,8% = 1.980 e intervalo 4,6% a 5,0%; magro 637 impressões, intervalo 3,1% a 6,5% (conta certa, o problema é B3); "primeira leitura em 15/10" = publicado 12/10 + 3; a posição do losango de 24/08 na régua do magro (45,7% medido contra 45,5% esperado) e a largura do trecho medido (8,8% contra 8/90 = 8,9%); `aria-label` de barras e réguas com os mesmos números da tela; os 7 blocos da leitura só total contados (7).

## Tabela de medidas

| Item | Medida | Limite | Resultado |
|---|---|---|---|
| Rolagem horizontal, 34 casos x 4 cruzamentos | 0 px em todos; 0 elementos além da largura | 0 | ok |
| Texto abaixo de 12 px | 0 | 0 | ok |
| Contraste de texto composto, pior caso por tema | escuro 4,86 ("05/10 a 11/10" na leitura só total); claro 4,73 ("seu canal") | 4,5 | ok; 0 trechos abaixo do limite (pequeno 4,5; grande 3) |
| Contraste das fatias contra o cartão, escuro | pesquisa 7,73; sugeridos 6,08; início 5,34; Shorts 11,88; fora 6,80 | 3,0 | ok |
| Contraste das fatias contra o cartão, claro | pesquisa 5,56; sugeridos 6,65; início 5,13; Shorts 8,32; fora 4,43 | 3,0 | ok |
| Alvos a 390 px (seletor, ⓘ, "Tentar de novo", migalha) | 0 elementos interativos abaixo de 44 x 44 | 44 | ok |
| Foco visível, Tab (40 passos em 3 casos) | contorno sólido 2 px em todos; ordem visual correta (migalha, seletor, ⓘ em ordem) | 2 px | ok |
| `color-mix()` na interface | 0 regras (3 ocorrências em `a4.css`, 1 em `lote.css` e 1 em `ov.css`, todas dentro de comentário) | 0 | ok |
| Erros de página no console | 0 | 0 | ok |
| Identidade do canal (migalha x título x avatar) | magro e extremo divergem | igual | **falha (B1-r4)** |
| Janela x número (pesquisa) no magro 28, 90, tudo | 3 contra 5 / 4 | coerente ou explicado | **falha (B2-r4)** |
| Cliques x views, cartão magro | 31 contra 12 | cliques menores ou iguais | **falha (B3-r4)** |
| Estados de ausência | zero (caixa), não medido (hachura), omitido (tracejado), ainda não existe (pontilhado), cadeado | distintos por forma e cor | ok |

## O que não consegui verificar

- Leitor de tela real (VoiceOver, NVDA): li papéis e `aria-label` no DOM, não ouvi.
- Safari e Opera (navegador do dono): só Chromium. Hachura, pontilhado e listrado (`repeating-linear-gradient`, `radial-gradient`) não foram vistos no Opera; `color-mix()` não existe na interface.
- Toque real: `hasTouch` não ativa `pointer: coarse`; os 44 px a 390 px vêm da regra por largura e batem.
- Contraste de texto sobre hachura: a medição ignora o desenho do gradiente; nenhum texto fica sobre hachura (rótulo e frases ficam em fundo liso, conferido nas capturas).
- Impressão em preto e branco: calculei a luminância das fatias, não imprimi.
- Dado real: tudo é exemplo. A plausibilidade de B3 (cliques menores que views) é regra de ofício do YouTube; o engenheiro de dados deve confirmar quando a E11 chegar à implementação.

## Para a rodada 5

Reconferir B1-r4, B2-r4, B3-r4 e C1 a C4. Pedido de método, para não repetir o ciclo: acrescentar ao `verificar-coerencia.mjs` quatro conferências que ele hoje não faz, todas por código: (a) nome do canal igual na migalha, no título e no avatar; (b) todo número com "views da pesquisa" tem a mesma janela da lista de origem ou a linha "sem comparar"; (c) cliques do cartão menores ou iguais às views da mesma janela; (d) nenhuma frase com "seus vídeos" na página de vídeo. Com esses quatro e os três bloqueios corrigidos, nada novo aberto, é "pronto para o dono".
