# Revisão de UX, rodada 4: mockup 15, página do canal de concorrente

Revisor: revisor-ux-senior. Data: 13/10/2026. Escopo: conferir se B1, B2, C1 e C2 da r3 foram resolvidos de verdade, se o ajuste criou defeito novo, e fazer a varredura de coerência dos números de exemplo nos 12 estados de uma vez.

Método: servidor estático próprio nas portas 47741 a 47747 (todos derrubados ao terminar; nada na 3099, sem specs do projeto). Li o texto renderizado dos 12 estados (com os blocos "Ver como tabela" e "Mais números do canal" abertos, os `aria-label` dos desenhos e o conteúdo de cada ⓘ), extraí os vídeos e a série de views de `window.PC_M` e refiz as contas por conta própria (janelas de 90 dias, de 13 semanas, de 28 dias, somas, datas por calendário). Medi 12 estados x 4 combinações (1440 escuro, 390 claro, 1440 claro, 390 escuro) = 48 cruzamentos. Li as capturas de magro, erro, nm, fora, parado, zero (1440 escuro) e extremo, vazio, erro (390 claro). Rodei o `coerencia.mjs` do desenhista: 0 falhas, e é justamente o que preocupa (ver "Por que o conferidor não pegou", abaixo).

## Resumo

Veredito geral: NÃO PODE ir ao dono. 3 bloqueios, 7 correções, 7 sugestões.

Estados: 0 prontos para o dono, 12 voltam para ajuste, 0 reprovados.

Pergunta do usuário: "este canal está subindo, parado ou caindo, e o último vídeo dele foi acima do normal?". Respondida no primeiro olhar nos 12 estados (símbolo mais frase no topo, seis células embaixo; 1440 escuro e 390 claro lidos). Passa. O desenho, a cor, o contraste e o toque estão no nível; o que derruba é a mesma classe de erro das rodadas anteriores: número ou data de exemplo que contradiz outro número da mesma tela. As três coisas que mais derrubam o conjunto:

1. O bloco "Mais números do canal" (4 células) foi esquecido na limpeza de coerência: "média dos últimos 28 dias" calculada sobre 24 ou 26 dias, "30 dias" sobre 26, e "não medido" sem motivo.
2. A data de início da coleta de comentários (11/10) aparece como fato verdadeiro em estados onde não pode ser (erro, que parou de ser lido em 04/10) e é contradita por um "0 de 6" medido no `zero`, no mesmo 13/10.
3. A palavra "publicação" conta só longos em "Semanas com publicação", e a raia de Shorts desenhada logo acima mostra semanas cheias que o número ignora (extremo: "11 de 13" com Shorts em todas as 13 colunas).

## Conferência da r3

| Item da r3 | Resultado | Evidência |
|---|---|---|
| B1 barra de 180 dias do vazio | RESOLVIDO | vazio "2 de 180 dias... passa a existir em 09/04/2027" (12/10 + 179 dias = 09/04, conferido por calendário); erro "2 de 180... a leitura parou em 04/10" (03/10 e 04/10 = 2); fora "7 de 180" (03/10 a 09/10 = 7); magro/parado/zero/nm/shorts "11 de 180... 31/03/2027" (03/10 a 13/10 contados com as duas pontas = 11; 03/10 + 179 = 31/03). |
| B2 dois relógios no Erro | RESOLVIDO | ponteiro "Dias desde o último vídeo (longo ou Short): 0 dias até 04/10"; frase "o que começou em 14/09 e ainda não acabou: 20 dias, até 04/10"; cartão "sem longo desde 14/09, até 04/10". 04/10 - 14/09 = 20. O Short de 04/10 existe nos dados. |
| C1 conta "4 x intervalo" | RESOLVIDO | só o `fora` mostra a conta ("4 × o intervalo típico, 9,5 dias" = 38, bate com o limite); nos outros a linha diz só "28 dias". |
| C2 "nesse tempo" do vazio | RESOLVIDO | vazio "1 publicação (só longos)... Antes de o canal entrar na lista: 3 publicações". Conferi nos dados: 28 dias = 1 em registro + 3 antes = 4; as outras 3 dos "7 de 48 buscados" são mais velhas que 28 dias (coluna da semana 1 da raia). Fecha. |
| M2 percentual contra os valores | RESOLVIDO | cheio 5,43/4,60 = +18,0%; erro 41,31/30,73 = +34,4% (tela +34%); fora 11,2/11,8 = −5,1%; extremo 2,09/4,01 = −47,9%. |
| M1 e M4 | RESOLVIDOS | datas não se repetem em três lugares; célula Estado do erro diz "sem leitura desde 04/10". |

Defeito novo criado pelos ajustes da r4: nenhum nos pontos tocados, mas dois "não promete data para canal parado" ficaram pela metade (B2 abaixo) e o "agora 0 e 0" do vazio (C3) saiu da mudança de "canal novo só tem os vídeos já buscados".

## Bloqueios (não vão ao dono)

### B1. nm, fora, erro, vazio: "Mais números do canal" contradiz a janela que a própria tela declara
- Tela/estado: bloco "Mais números do canal (4)", estados `nm` (1440 e 390) e `fora` (1440 e 390). Captura: lida com o bloco aberto (nm 1440 escuro e fora 1440 escuro).
- O que está errado, em duas partes.
  (a) **Views por dia no canal**. Causa em `pc.js`, função `todosNumeros()`: `dd.slice(-28).filter(v != null)` e média sobre os dias que existirem (mínimo 20), mas o rótulo diz "média dos últimos 28 dias".
  - `nm`: a célula diz **901** "média dos últimos 28 dias". A mesma tela diz, na Linha do tempo, "23,4 mil views ganhas em 26 dias de registro (a janela de 28 dias completa em 15/10)" e, em Direção, "26 de 56 dias". Uma média de 28 dias que a própria tela diz que ainda não existe (23,4 mil / 26 = 900; 23,4 mil / 28 = 836).
  - `fora`: a célula diz **3,37 mil** por dia. A Direção do mesmo estado diz "97,3 mil views ganhas em 28 dias". 97,3 mil / 28 = 3,47 mil; 3,37 mil x 28 = 94 mil. A conta só fecha se a média for sobre 24 dias (a leitura parou em 09/10 e o código fatia os últimos 28 dias até hoje, 13/10), o que o rótulo não diz.
  - Nos 8 estados completos a conta fecha (magro 271.703/28 = 9,70 mil; cheio 5.431.732/28 = 194 mil; parado 289.746/28 = 10,3 mil; zero 2.403/28 = 86).
  (b) **Inscritos em 30 dias**: `nm` mostra **+1,4%** com 26 dias de registro (cadastro em 18/09). Não existe variação de 30 dias com 26 dias de leitura. O código só trata `c.novo` e `erro` como "não medido".
- Conserto exato: (a) a média usa os 28 dias que terminam na última leitura (`fim`) e só aparece com os 28 dias completos; abaixo disso "não medido" com o motivo "menos de 28 dias de registro; completa em 15/10" (nm). No `fora` passa a mostrar 3,47 mil. Regra de fechamento para conferir por código: "Views por dia" x 28 = a soma de 28 dias da Direção (magro 9,7 mil x 28 = 272 mil). (b) "Inscritos em 30 dias" só com 30 dias de registro; no `nm` vira "não medido, menos de 30 dias de registro; completa em 17/10" (18/09 + 29 dias).

### B2. erro: "a coleta de comentários começou em 11/10; fecha em 10/11" num canal que parou de ser lido em 04/10
- Tela/estado: `erro`, célula "Criador responde" e seção "O que o criador respondeu", 1440 e 390 (visível na captura do Ritmo e do fim da página a 390). Causa: `pc-dados.js`, `erro.resp.nm`.
- O que está errado: o canal está em erro desde 04/10 (faixa: "Os números valem até 04/10"; 72 horas: "sem leitura nova desde 04/10"), e a tela diz que a coleta de comentários dele "começou em 11/10" e "fecha em 10/11". Uma coleta não começa sete dias depois de o canal parar de ser lido, e a data futura é uma promessa que o próprio desenhista tirou dos outros blocos do erro na r4 ("canal parado não promete data").
- Conserto exato: no erro, motivo "o canal está em erro: a coleta de comentários não chegou a começar antes de a leitura parar (04/10)" ou, mais curto, "sem leitura desde 04/10" (a mesma forma da célula Estado), sem "fecha em". No `fora` já está certo ("o canal saiu do YouTube").

### B3. zero: "Criador responde 0 de 6" medido no dia 13/10, quando os 5 estados irmãos dizem que a coleta começou em 11/10
- Tela/estado: `zero`, célula "Criador responde" e seção "O que o criador respondeu", 1440 e 390. Captura lida: zero 1440 escuro (célula com a caixa vazada "0 de 6").
- O que está errado: o banner do estado diz "Hoje, 13/10/2026... o que é novo aparece quase todo não medido". Magro, parado, vazio, shorts e erro, do mesmo dia, dizem que a coleta de comentários começou em 11/10 e "precisa de 5 vídeos com 30 dias de comentários" (o ⓘ diz "vídeos... com os comentários de 30 dias guardados"). Duas telas do mesmo dia afirmam fatos opostos sobre o mesmo sistema; o dono troca entre elas no seletor. Em `pc-dados.js` o `zero` tem `resp: { k: 0, n: 6, ok: true }`.
- Conserto exato: no `zero` real (13/10) a célula e a seção viram "não medido, a coleta de comentários começou em 11/10; fecha em 10/11", como nos irmãos; o "zero medido de resposta do criador" (caixa vazada, "Não vimos resposta em nenhum dos 6 vídeos") passa para um estado de simulação de 12/05/2027, por exemplo `nichos` com `k = 0` e `n = 12`. O "zero medido" do Acerto (0 de 8) e das semanas continua no `zero`.

## Correções (vão ao dono só depois de corrigidas)

### C1. "Semanas com publicação" conta só longos, e a raia de Shorts desenhada acima mostra semanas cheias
- Estados: extremo, cheio, leitura, magro, erro, fora, vazio, nm (1440 e 390). Capturas lidas: magro e erro 1440 (Ritmo), erro 390.
- Evidência: união das duas raias contra o número da tela: extremo **13 de 13** semanas com algum vídeo (Shorts: 2,2,7,1,2,3,2,3,5,6,2,3,3, nenhuma coluna vazia) contra "publicou em **11** de 13"; cheio e leitura 12 contra 11; magro 9 contra **6**; erro 8 contra 5; fora 9 contra 8; vazio 3 contra 2; nm 4 contra 2. O ⓘ do Ritmo diz "Semanas com publicação: quantas das 13 semanas tiveram pelo menos uma publicação" (não diz "longo"). O nm diz "menos de 4 publicações na janela" com 4 casas preenchidas (2 longos + 2 Shorts).
- Conserto: dizer a base onde o número aparece. Rótulo "Semanas com um longo" (ou "com um Short" no canal só de Shorts), célula "com longo em 6 de 13 semanas", ⓘ idem, nm "menos de 4 longos na janela". Alternativa: contar os dois formatos (magro 9 de 13), mas então "0,9 por semana" muda de base; a primeira é mais barata.

### C2. Semana de leitura parcial: uma raia diz "não medido" e a outra mostra número na mesma coluna
- Estados: `erro` (coluna da semana de 30/09: Longos "—" e Shorts "1"; "5 de 11 semanas com leitura" ao lado de 12 casas medidas de Shorts) e `fora` (coluna da semana de 07/10: Longos "1" e Shorts "—"). Capturas lidas: erro 1440 e erro 390.
- Conserto: a mesma regra nas duas raias. Recomendo coluna parcial "—" nas duas (o Short de 04/10 continua na Linha do tempo e no ponteiro "0 dias até 04/10"); assim "N semanas com leitura" bate com as casas medidas nas duas raias.

### C3. vazio: "valor do meio dos longos... (agora 0 e 0)" com 4 longos já buscados
- Evidência: texto "o canal ainda está buscando vídeos (agora 0 e 0)" na linha "Vídeos novos, views de hoje", e o Ritmo do mesmo estado desenha 4 longos (2,0,0,0,2) e a faixa do topo diz "7 de 48 vídeos já buscados". Nos dados o canal tem 4 longos nos últimos 90 dias.
- Conserto: tirar o parêntese ("agora N e M") quando o motivo é "ainda buscando vídeos", ou mostrar "agora 4 e 0" (4 longos achados, o período anterior ainda não buscado).

### C4. "não medido" sem motivo em "Mais números do canal", e regra diferente entre erro e fora
- Evidência (cada "não medido" tem de dizer por quê, CONVENCOES, regra 13): nm "Views típicas, vídeos longos"; erro "Inscritos em 30 dias" e "Views por dia no canal" (a linha de baixo repete o método: "de 1 mil em 1 mil..." e "média dos últimos 28 dias"); vazio os três (inscritos, views por dia, views típicas); shorts "Views típicas, Shorts" (o rótulo promete uma medida de Shorts que a conta, feita só para longos, nunca calcula; hoje o canal tem 72 Shorts em 91 dias). No `erro` as duas células ficam não medidas e "Views típicas" e "Engajamento" aparecem medidas, e no `fora` as quatro aparecem medidas: não há regra que explique a diferença para canais parados.
- Conserto: trocar a linha de método pelo motivo (`A.nml("menos de 28 dias de registro")`, "leitura parou em 04/10", "canal ainda buscando vídeos", "só calculado para vídeos longos"); e uma regra única para canal sem leitura nova: mostrar o valor com "até 04/10" (erro e fora) ou "não medido" nos dois.

### C5. ⓘ do Estado diz 14/12/2026; a barra da mesma tela diz 13/12/2026
- Evidência: ⓘ "Estado... em queda sustentada (três janelas de 28 dias seguidas com −10% ou menos; só a partir de 14/12/2026)" contra "51 de 112 dias desde a mudança de contagem de 24/08; a primeira leitura limpa é em 13/12/2026" (magro, parado, zero, shorts). A mesma regra de contagem inclusiva que fecha "11 de 180... 31/03/2027" dá 13/12.
- Conserto: 13/12/2026 no ⓘ (ou, melhor, gerar a data do ⓘ da mesma variável da barra).

### C6. nichos: "−50% ou menos, fora da escala" para um valor de −49,8%
- Evidência: `nichos` "Vídeos novos, views de hoje": 116 mil contra 230 mil views (115.596 contra 230.056 nos dados) = −49,75%. A tela mostra o marcador preso na ponta (▼‹), o selo "−50%" e "ou menos, fora da escala". O valor está dentro da escala (−50%), e quem divide 116 por 230 (−49,6%) vê que "ou menos" é falso por um quarto de ponto. Em magro (−50,5%) a mesma frase é verdadeira.
- Conserto: marcador "fora da escala" só quando o valor exato for menor ou igual a −50%; abaixo disso o marcador fica na posição real (−49,8%) e o selo diz "−50%" sem "ou menos".

### C7. Erro e magro são o mesmo canal ("Lucas Bigodinho", 325 mil, mesmos vídeos e títulos), com views diferentes
- Evidência: nos dados o `erro` é o mundo do `magro` cortado em 04/10 (as 11 primeiras semanas de longos são idênticas: 0,2,0,3,0,1,0,2,2,0,0; o mesmo Short "Preço do táxi em Bangkok" em 04/10). Mas os 28 dias até 04/10 somam **329 mil** no erro e **288 mil** na tabela do magro (soma das linhas 07/09 a 04/10), e Acerto "1 de 12" e "Views típicas 41,3 mil" no erro contra "2 de 10" e "19,0 mil" no magro. Quem troca entre os dois estados vê o mesmo canal com números incompatíveis.
- Conserto: dar ao `erro` outro nome, outro @ e outro número de inscritos (é um canal de exemplo; a semente já gera outros vídeos), ou derivar o erro do magro truncado. A primeira opção é uma linha em `pc-dados.js`.

## Sugestões (não bloqueiam)
- S1. Duas janelas de longos que não fecham na soma: o Ritmo desenha 13 semanas (91 dias, até hoje) e "views de hoje" e Acerto contam 90 dias até a última leitura. No `zero` a soma da raia é 9 e "8 e 17 vídeos"/"0 de 8" dizem 8; no `fora` 9 contra "11 e 16 vídeos"; no `erro` 10 contra "12 e 19". Só se vê somando as casas, e cada ⓘ declara a janela, mas custa uma linha: alinhar o fim das janelas (última leitura) ou escolher exemplos sem vídeo na fronteira.
- S2. `aria-label` do Acerto: "1 acertos, 1 fracassos", "0 acertos" (parado, erro, fora, zero). Usar `A.plural`.
- S3. As cinco marcas de exemplo no canto esquerdo das raias da Linha do tempo (círculo cheio, círculo vazado, quadrado, losango, triângulo, em x entre 18 e 36) parecem eventos de 16/07 a 20/07; o losango (troca de título) nem consta na legenda quando o canal não tem troca de título. Sugiro tirá-las ou rotular as três raias.
- S4. `leitura` (só leitura): o chip "você só lê este site" diz o que o usuário é, não o que ele deixa de ver ou fazer (CONVENCOES 13: "a tela diz o que ele não vê"). Uma linha: "sem o menu de ações do canal".
- S5. Sem estado de carregamento (mockup estático, declarado desde a r1): repetido, não bloqueia.
- S6. Marcas de "Mudanças de campo e trocas": magro diz "1 mudança de campo e 1 troca" sem ressalva num intervalo de 28 dias que começa 17 dias antes do início do registro (03/10); parado, zero, nm e erro dizem "não medido antes de 03/10". A regra "mostra o que achou, avisa quando é zero" é coerente, mas o magro mostra uma contagem que é piso sem dizer; "pelo menos" resolve.

- S7. Banner dos estados de 13/10: "a contagem por vídeo tem 10 dias"; as barras dizem "11 de 180 dias" (03/10 a 13/10 com as duas pontas) e "51 de 112" (24/08 a 13/10, também inclusivo). A conta das barras está certa; o banner conta de outro jeito. Trocar por "desde 03/10" ou "11 dias".

## Varredura de coerência: o que conferi por estado

Cada linha é um relacionamento entre números da mesma tela, recalculado fora do código de desenho. "ok" = fecha. As falhas remetem aos achados.

| Estado | Fecha (ok) | Não fecha |
|---|---|---|
| magro | 272 mil/243 mil = +12%; 272 mil/28 = 9,7 mil; 51 de 112 desde 24/08 e 13/12; 11 de 180 e 31/03; 7 publicações (2 longos, 5 Shorts) = linhas da tabela; grade de longos soma 12 = "12 e 20 vídeos"; 6 de 13 semanas; buraco 25 dias (14/09 a 09/10); intervalo típico 3 (mediana das 11 diferenças); Acerto 10 = 12 menos os 2 com menos de 7 dias; 72 horas "hoje 0" | C1 (6 de 13 contra 9 colunas com algum vídeo); C5; S7 |
| cheio / leitura | +18% (5,43/4,60); −12% (208/236 mil); +30% (222/171 mil); 5,43 mi/28 = 194 mil; 17 publicações (8 longos + 9 Shorts) = soma das 4 últimas colunas de cada raia (3+2+1+2 e 2+0+4+3); 22 longos em 13 semanas = "22 e 25"; Acerto 20 = 22 menos 2 recentes; 5 de 14 = 36%; comentários sempre depois do vídeo (6, 12 e 19 dias contra vídeos de 7, 17 e 22 dias); "2 de 20 = 10%"; buraco 18 dias (05/03 a 23/03) | C1 (11 de 13 contra 12 colunas); C5 |
| extremo | −34% (35/53 mi); queda −34/−21/−14; −48% e −32% batem com os valores; 1,3 mi/dia = 35 mi/28; 19 publicações (5+14); 22 longos; 1 de 11 = 9%; buraco 20 dias (21/12 a 10/01) | C1 (11 de 13 contra 13 colunas com Shorts); C5 |
| parado | −20% (290/362 mil); 64 dias (10/08 a 13/10); limite 28; 5 longos = 0,4/semana; 4 de 13; "1 de 5"; buraco aberto 64 | C5 |
| zero | 0% (2,4 mil/2,4 mil); 86 = 2,4 mil/28; −17% (606/729); buraco 27 dias desde 16/09 (3 semanas zero no fim da raia); "0 de 8" = 8 vídeos com 7 dias ou mais | **B3**; C5; S1 (raia soma 9, texto diz 8) |
| nm | 26 de 56 desde 18/09 e 12/11; 26 de 112 e 07/01/2027; janela de 28 completa em 15/10; 1 publicação só de Shorts = marca da Linha do tempo; "agora 2 e 6" | **B1** (901 por dia "28 dias" e +1,4% em "30 dias" com 26 dias de registro); C1 ("menos de 4 publicações" com 4 casas); C4 (Views típicas sem motivo) |
| erro | +7% (329/307 mil); +34% (41,31/30,73 mil); 42 de 112 desde 24/08 até 04/10; "2 de 180"; 20 dias de buraco (14/09 a 04/10); 5 de 11 semanas com leitura; 0 dias até 04/10 | **B2**; C2; C4; C7 |
| vazio | 2 de 56 e 06/12; 2 de 112 e 31/01/2027; 2 de 180 e 09/04/2027; janela de 28 completa em 08/11; 7 de 48 vídeos; 1 + 3 publicações = 4 em 28 dias | C1 (2 de 5 contra 3 colunas); C3 (agora 0 e 0); C4 |
| fora | +9% (97,3/89,3 mil); −5% (11,2/11,8 mil); 47 de 112 e 7 de 180 até 09/10; 4 x 9,5 = 38; buraco 28 dias (25/07 a 22/08); 6 publicações (4+2) | **B1** (3,37 mil contra 3,47 mil); C2; C5; S1 |
| shorts | +14% (320/281 mil); 320 mil/28 = 11,4 mil; 72 Shorts em 13 semanas = 5,5; 22 publicações = últimas 4 colunas; buraco 4 dias; 13 de 13 | C4 (Views típicas, Shorts); C5 |
| nichos | +4% (1,83/1,76 mi); −45% (86,1/156 mil); 6 curvas; n 42 = 21 + 21; Acerto 20 = 21 menos 1 | C6; C5 |

## Veredito por estado e largura

Medidas de rolagem, fonte, alvo e contraste limpas em todos (tabela abaixo); o veredito vem só dos achados.

| Estado | 1440 escuro | 390 claro | Veredito | Pendências |
|---|---|---|---|---|
| magro (caso real) | ok | ok | volta para ajuste | C1, C5 |
| cheio | ok | ok | volta para ajuste | C1, C5 |
| extremo | ok | ok | volta para ajuste | C1, C5 |
| parado | ok | ok | volta para ajuste | C5 (uma linha) |
| zero medido | contradição | contradição | volta para ajuste | B3, C5 |
| não medido (nm) | contradição | contradição | volta para ajuste | B1, C1, C4, C5 |
| erro | contradição | contradição | volta para ajuste | B2, C2, C4, C7 |
| sem dado (vazio) | ok com defeito | ok com defeito | volta para ajuste | C1, C3, C4 |
| fora do ar | contradição | contradição | volta para ajuste | B1, C2, C5 |
| só Shorts | ok | ok | volta para ajuste | C4, C5 |
| nichos diferentes | ok | ok | volta para ajuste | C5, C6 |
| só leitura | ok | ok | volta para ajuste | C1, C5 |

Resumo: 0 prontos, 12 voltam para ajuste, 0 reprovados. Os três bloqueios são correções de dados de exemplo e de uma regra de motivo; nenhum exige redesenho. Depois deles e de C1 a C7, é uma reconferência de uma passada.

## Por que o conferidor não pegou

`coerencia.mjs` passa com 0 falhas em 409 linhas porque só confere o que o desenhista já pensou em conferir. Não cobre: o bloco "Mais números do canal" (B1, C4), o conteúdo dos ⓘ (C5, "publicação" em C1), a coerência entre estados (B3, C7), a união das duas raias de ritmo (C1) e o "(agora N e M)" (C3). Sugestão para a rodada 5: acrescentar ao conferidor (1) "Views por dia x 28 = soma da Direção", (2) "dias de registro >= 30 para Inscritos em 30 dias", (3) "todo não medido tem motivo escrito" por varredura de DOM, (4) "data de ⓘ = data da barra", (5) "nenhum estado com data de 13/10 afirma coleta de comentários medida".

## Tabela de medidas

| Item | Resultado | Como medi |
|---|---|---|
| Rolagem horizontal, 12 estados x 4 combinações | 0 px em 48 de 48 | scrollWidth - clientWidth |
| Texto menor que 12 px | 0 em 48 de 48 | font-size computado |
| Alvos abaixo de 44 x 44 px a 390 px (toque), dentro da tela simulada | 0 em 24 de 24 | getBoundingClientRect em links, botões e summary; ignorei o #mock (barra do mockup) |
| Contraste de texto (cor composta sobre o fundo efetivo, alfa incluído), 48 combinações | menor razão 4,86:1; 0 textos abaixo de 4,5:1 (3:1 para texto grande) | WCAG sobre getComputedStyle; não cobre texto sobre a hachura rosa (fundo em gradiente) |
| Contraste gráfico, escuro | barra de views 6,72:1; marca de publicação 14,48:1; borda de zero medido 5,36:1 | fill/border contra o fundo do cartão |
| Contraste gráfico, claro | barra 4,94:1; marca 15,76:1; borda de zero medido 4,64:1 | idem |
| color-mix() | 0 em CSS e JS que carregam interface; só comentários "sem color-mix()" | grep na pasta |
| Jargão na tela (lido, gravou, CTR, diário, cron, série, snapshot, payload, pipeline, retenção, mediana) | 0 nos 12 estados (a palavra "mediana" aparece só nos ⓘ, permitido) | texto renderizado com os blocos abertos |
| aria com "undefined", "NaN", "1 dias" | 0; achei "1 acertos", "1 fracassos", "0 acertos" (S2) | varredura de aria-label |
| Contas dos números de exemplo | 12 estados, ver varredura acima | recálculo a partir de `window.PC_M` (vídeos e série por dia) e do texto renderizado |
| Servidores e navegadores desta revisão | portas 47741 a 47747 derrubadas (lsof vazio) | lsof |

## O que NÃO consegui verificar
- Leitor de tela (VoiceOver, NVDA): só li `aria-label`, ⓘ e a estrutura de títulos.
- Safari, Firefox e Opera (o navegador do dono renderiza `color-mix()` transparente; confirmei só a ausência no código). Só Chromium.
- Toque real em aparelho (simulei hasTouch com viewport de 390 px); foco por Tab e Esc no ⓘ não foram refeitos nesta rodada (a r3 mediu 36 a 42 paradas por estado sem falha, e nada mudou na estrutura).
- Fontes do Google (Fraunces, Inter, JetBrains Mono) bloqueadas na captura; quebras de linha reais podem variar alguns pixels.
- Contraste do texto "não medido" sobre a hachura rosa (medi sobre o fundo plano; nas capturas lê-se bem).
- Escala de cinza: li as capturas em cor; a r3 já verificou que "não medido" (hachura) e "zero medido" (caixa vazada) se separam sem cor, e nada nas formas mudou.
- Capturas lidas nesta rodada: magro (1440), erro (1440 e 390), nm, fora, parado, zero (1440), extremo, vazio (390). Cheio, nichos, shorts e leitura foram lidos por texto, `aria-label` e dados, não por captura.

## Para quem desenhou

Devolve para a rodada 5 com B1, B2, B3 e C1 a C7. Se discordar de B3 (preferir manter o "0 de 6" no `zero` de 13/10), responda com a frase que explica como um canal tem 6 vídeos com 30 dias de comentários guardados quando a coleta começou há dois dias, e eu mantenho ou retiro por escrito. Em C1, se o dono quiser contar os dois formatos, é decisão de produto: levar como dúvida. As sugestões ficam para o dono decidir.
