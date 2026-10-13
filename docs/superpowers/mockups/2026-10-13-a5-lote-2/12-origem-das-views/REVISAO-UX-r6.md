# Revisão de UX, rodada 6: mockup 12 (origem das views)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/12-origem-das-views/`.

## Veredito: PRONTO PARA O DONO (0 bloqueios, 0 "corrige"; 5 melhorias)

B1-r5 e C1-r5 estão resolvidos de verdade, nenhum ajuste criou defeito novo, e a varredura de coerência que fiz sozinha, estado por estado, não achou nenhum número que se contradiga.

## Como revisei

Chromium headless por `file://` (Playwright do repositório, fontes externas bloqueadas, sem servidor, sem porta 3099, sem spec do projeto; nada ficou aberto). Scripts meus, em área temporária, não os do `verificar-coerencia.mjs`:

1. **Texto de tudo, por código:** 108 casos (vídeo, canal e cartão x 10 estados x períodos, mais "só total"), 1440 px, `innerText` + todos os `aria-label` + conteúdo dos ⓘ. Li à mão e refiz as contas de cada estado (tabela abaixo).
2. **Medidas:** 33 telas x 4 cruzamentos (1440 e 390, claro e escuro) = 132 leituras: rolagem horizontal, fonte, alvo de toque, contraste de texto composto (cor lida do estilo computado, fundo composto pelos ancestrais), erros de página.
3. **Teclado:** 28 Tab em três casos (zero 390, magro canal 1440, vazio 390); ⓘ por Enter e Esc.
4. **Capturas que abri e olhei:** zero do vídeo (1440 escuro), vazio do vídeo (390 claro), típico do vídeo (1440 escuro), cartão "não medido" (1440 escuro), magro do canal em 90 dias (1440 escuro), revisão do vídeo (390 claro). As datas de `shots/` (13:43 a 13:44) são posteriores às do `ov.js` e do `ov-dados.js` (13:43:31), então as capturas da pasta refletem o código atual.
5. Rodei o `verificar-coerencia.mjs`: 73 casos, 0 falhas.

## A pergunta do usuário e a resposta em 3 segundos

Pergunta: **"de onde vêm as minhas views, e posso confiar nesse número?"**. A frase-resumo com chip da líder, "7 de 7 dias com a origem medida" e a barra de 40 px respondem sem rolar a 1440 px (típico, extremo, magro com olho riscado, zero com a caixa "0"). Cinco "vazios" distintos por forma e cor: zero (caixa "0"), não medido (hachura rosa), omitido (tracejado com olho), ainda não existe (pontilhado com relógio), cadeado. Nenhuma cor depende só de si: toda origem tem cor, símbolo e textura. Sem `color-mix()` em regra de estilo (só em comentário). Método nos ⓘ.

## Conferência dos itens da r5

| Item | Resultado | Evidência |
|---|---|---|
| B1-r5 (0,2x contra 41.200 views) | **resolvido** | `D.MEDIANA_OUTROS = 2764` e `normalDoCanal(vida)` lidos pelos dois vídeos. Típico 3.870 ÷ 2.764 = 1,40 → 1,4x. Zero 41.200 ÷ 2.764 = 14,9x. Na captura do zero 1440 a linha mostra "14,9× o normal do canal / views ÷ mediana dos outros vídeos". 14,9x ao lado de "zero medido" não contradiz: o cabeçalho é da vida inteira (publicado em 2019), o bloco é dos últimos 7 dias. Plausível com 35 vídeos e 1.842.600 views no canal (média 52,6 mil, mediana dos outros 2.764). |
| C1-r5 (vazio com o título do típico) | **resolvido** | Título "Hanói à noite: o que ver depois das 22h", 187 views, 9 curtidas, 1 comentário, 5,3% (10/187 = 5,35). Nenhum dos números repete o 212 do típico. Publicado 12/10, "há 1 dia", "primeira leitura em 15/10" = 12/10 + 3. |
| Comentários do zero (212 → 340) | resolvido | (1.900+340)/41.200 = 5,44% → 5,4%. |
| S1-r5 (ⓘ) | feito | "idade do vídeo" só nos ⓘ do vídeo (nenhum canal tem); "total sempre fecha" ausente no não medido (canal 28: "Quando a coleta começar, a soma das origens mais o omitido será igual ao total"). |
| S2-r5 (24/08 no ⓘ) | feito | "Períodos que cruzam essa data..." só no canal 90 dias e nos períodos "desde" que cruzam (zero tudo); ausente em 7 e 28 dias do canal e no vídeo típico. |
| S3-r5 (% assistido) | feito | 51% típico, 38% magro, 58% extremo nos cartões. |
| S4-r5 (aria-label do cartão em revisão) | feito | o cartão em revisão diz "Não medido: a origem está em revisão". |
| S5-r5 (`pais=mes`) | feito | 36.800 = 92 x 400; 25.766+4.414+1.467+739+370+2.207+370+1.467 = 36.800. |
| Pedido de método | atendido | o script confere razão = views ÷ mediana única e título = data. |
| O ajuste criou defeito novo? | **não** | Nenhum texto novo contradiz outro; nenhuma medida piorou. |

## Bloqueios

Nenhum.

## Corrige

Nenhum.

## Melhorias (não bloqueiam; ficam para o dono decidir ou para o código real)

1. **M1. Vazio do vídeo: "não medido" (hachura rosa) no "o normal do canal", e "Ainda não existe" (pontilhado) nos seis blocos.** Captura vazio 390 claro. A causa é a mesma (o vídeo é novo demais) e a forma muda. Pela regra do lote ("ainda não existe" é o que vai existir; "não medido" é o que não vai chegar), o chip certo seria "ainda não existe". A r5 aceitou; deixo registrado, não derruba.
2. **M2. Cartão "não medido": "Termos de pesquisa: Não coletada: o relatório do YouTube ainda não chegou"**, com a mesma hachura das outras linhas que dizem "Não medido". Mesma forma, dois nomes. Sugestão: "Não medido: o relatório do YouTube ainda não chegou". A NOTAS já declara a diferença de fonte (§10, S3), e a r4/r5 aceitaram.
3. **M3. Duração "15:47" igual no vídeo típico e no vídeo "sem dado".** São vídeos diferentes com título, data e views diferentes; só a duração coincide. Trocar o vazio por outra duração (por exemplo 11:08) tira a pergunta.
4. **M4. Canal magro "Desde 2015" mostra 36 views, igual ao de 90 dias, e os três canais (tnFigueiredo, Viagens, Aldeia Digital Lab) compartilham a mesma data de abertura (08/04/2015).** Não contradiz nada na tela (a NOTAS diz que o canal não tinha views antes), mas um canal de 3 vídeos e 27 inscritos aberto em 2015 sem views por 11 anos faz o dono perguntar. Uma data de abertura por canal em `D.CANAL` resolveria.
5. **M5. Combinações de URL sem tela própria** (`tela=video&estado=magro`, `...extremo`, `...carregando`, `tela=canal&estado=zero|vazio`) caem, em silêncio, na tela do canal (magro, extremo, carregando) ou do vídeo (zero, vazio). Não estão na fila de aprovação nem na barra de estados; só confunde quem digitar a URL à mão.

## Varredura de coerência dos números de exemplo (a que o dono pediu): tudo o que achei agora

Conferi cada número mostrado contra a conta que o gera e contra os outros da mesma tela.

| # | Estado e tela | Contas conferidas | Resultado |
|---|---|---|---|
| 1 | Típico, canal 7/28/90/desde 2015 | 3.185 = 455x7; 11.640 = 8x455 + 20x400; 36.440 = 3.640 + 82x400; 1.842.600 informado. Origens 1.338+573+478+319+223+76+178 = 3.185; 8 dias = 3.640 e as 7 linhas somam 3.640. Impressões 41.300 = 7x5.900, 165.200 = 28x5.900, 200.600 = 34x5.900 (somam, porcentagens 12/34/38/9/4/3). Termos 7 dias: 829 = soma da lista; 28 dias 3.030 e 90 dias 3.656 = somas. Sites 188. Aparelho, país (inclui Outros e Não identificado) e inscritos somam o total medido. "Sem comparar" aparece nas janelas de 8 dos 28 e 8 dos 34 dias. | fecha |
| 2 | Típico, vídeo 7 dias e desde a publicação | 826 = 7x118; 944 = 8x118; 3.870 = 944 + 14x209; "há 23 dias" de 20/09 a 13/10; 22 dias de 20/09 a 11/10 e impressões 36.300 = 22x1.650; 11.550 = 7x1.650; (212+31)/3.870 = 6,3%; 3.870 ÷ 2.764 = 1,4x; termos 149 e sites 30 = somas das listas; vídeo (826) menor que canal (3.185). | fecha |
| 3 | Extremo | 361.256 = 7x51.608; 412.864 = 8x51.608; origens + omitido = total; termos 23.981 e sites 9.571 = somas; país 33+12+8+5+4+30+3+5 = 100; impressões 2.660.000 = 7x380.000, 12.920.000 = 34x380.000; "tnFigueiredo Viagens", sigla TV, 412 vídeos, 1,2 mi nas três posições. | fecha |
| 4 | Magro, 7/28/90/desde 2015 | MAG_DIA: 12 (7 dias), 14 (8 dias), 19 (28), 36 (90 e desde 2015: 14 + 22). 3+2 = 5 e 5+7 = 12; 5+9 = 14. Aparelho 3+9 = 12; país 4+8 = 12; inscritos 1+3+8 = 12. Termos "as 3 views da pesquisa" (7 dias = origem 3), "as 4" (28 dias) e "as 5" (34 dias) com a linha "Sem comparar": 14 x 3/14 = 3; 19 x 3/14 = 4; 21 x 3/14 = 5. Impressões 637 = 7x91, 2.548 = 28x91, 3.094 = 34x91; porcentagens somam 100 (3+2+9 dá 22/14/64). Cartão: 10 cliques = 12 x 0,8 arredondado; 10/637 = 1,57%; intervalo 0,6% a 2,5%; 10 menor que 12. | fecha |
| 5 | Zero, vídeo (7 dias e desde a publicação) | 41.200 e 14,9x (conta acima); 5,4%; 14/05/2019 a 13/10 = 2.709 dias (2.557 até 14/05/2026 + 152); a 11/10 = 2.708; "8 de 2.708"; "34 dias" 08/09 a 11/10; 0 em todos os blocos; marca 24/08/2026 dentro da régua. | fecha |
| 6 | Não medido, vídeo e canal | "0 de 28 · a coleta começa em 14/10"; mesma data (14/10) em barra, ⓘ, aparelho, país, inscritos; nenhum percentual; cabeçalho 11.640/3.870 iguais aos do típico (as views existem; só a origem não); nada mostra "não é zero" como zero. | fecha |
| 7 | Sem dado ainda | 187, 9, 1, 5,3%; publicado 12/10 > último dia entregue 11/10; "primeira leitura em 15/10" nos 6 blocos; razão "novo demais". | fecha |
| 8 | Erro | 14:32 de hoje; última boa 12/10 06:10 (antes de agora); sete faltas citadas (origem, impressões, aparelho, país, inscritos, termos, sites) para os blocos da tela; total 3.185/3.870 igual ao do típico. | fecha |
| 9 | Carregando | 36.440 no cabeçalho = típico 90 dias; "de 90 · carregando". | fecha |
| 10 | Revisão | 826 contra 860 ("passou do total"); aparelho, país, inscritos somam 826; termos sem comparar; cartão diz "em revisão". | fecha |
| 11 | Só leitura (3 variantes) | 7 blocos contados = origem, impressões, termos, sites, aparelho, país, inscritos; totais 826/3.185 só no cabeçalho; termos e sites ocultos com cadeado. | fecha |
| 12 | Cartão x canal (7 dias) nos 10 estados | impressões, líder (42% e 18%), aparelho 62%, país 70%, inscritos 58%, busca líder 216 iguais à página; cliques 1.980 < 3.185; 127.680 < 361.256; 10 < 12; 41.300 x 4,8% = 1.982 → 1.980. | fecha |
| 13 | Datas | hoje 13/10; último dia entregue 11/10; coleta desde 04/10 = 8 dias; lote desde 08/09 = 34 dias; 4.205 dias de 08/04/2015 a 11/10; 28 e 90 dias começam em 14/09 e 14/07; nada passa de 11/10; nenhuma data de comentário (a tela não tem comentário). | fecha |
| 14 | `?pais=mes` | 36.800 e linhas somam. | fecha |
| 15 | Identidade entre estados (vídeo) | típico e vazio têm títulos diferentes; o zero é de 2019 e não colide com ninguém; nenhum número do vazio repete o de outro campo do típico. | fecha |

## Tabela de medidas

| Item | Medida | Limite | Resultado |
|---|---|---|---|
| Rolagem horizontal, 33 telas x 4 cruzamentos | 0 px em todos | 0 | ok |
| Texto abaixo de 12 px | 0 | 0 | ok |
| Contraste de texto composto, pior caso, escuro | 4,86:1 (leitura só total) | 4,5 | ok; 0 trechos abaixo |
| Contraste de texto composto, pior caso, claro | 4,73:1 (chip "seu canal", típico do vídeo) | 4,5 | ok; 0 trechos abaixo |
| Contraste de elemento gráfico (fatias) | não refeito: `ov.css` (13:10), `a4.css` e `lote.css` (11:56) não mudaram desde a r4 (pior caso r4: 4,43:1 "fora" no claro) | 3,0 | ok (herdado) |
| Alvos a 390 px | 0 interativos abaixo de 44 x 44 (ⓘ 44 x 44; o único menor é o H1 que recebe foco programático, 144 x 26, não é controle) | 44 | ok |
| Alvos a 1440 px | ⓘ 28 x 28 e migalha 41 x 20 (ponteiro fino, padrão do lote 1) | sem exigência para mouse | aceito |
| Foco visível (Tab, 28 passos x 3 casos) | 0 elementos sem contorno ou sombra de foco | visível | ok |
| ⓘ por teclado | Enter abre o painel; Esc fecha e devolve o foco ao botão (3 casos) | | ok |
| `color-mix()` na interface | 0 regras (só em comentários) | 0 | ok |
| Erros de página no console | 0 (os "Failed to load resource" são as fontes que eu mesma bloqueio) | 0 | ok |
| Número x número (razão do cabeçalho) | 3.870 ÷ 2.764 = 1,4; 41.200 ÷ 2.764 = 14,9; uma mediana só | | ok |
| Estados de ausência | zero (caixa "0"), não medido (hachura), omitido (tracejado), ainda não existe (pontilhado), cadeado | distintos por forma e cor | ok |

## O que não consegui verificar

- Leitor de tela real (VoiceOver, NVDA): li papéis e `aria-label`, não ouvi.
- Safari e Opera (navegador do dono): só Chromium. Hachura, pontilhado e listrado (`repeating-linear-gradient`) não vistos no Opera.
- Toque real: `hasTouch` não liga `pointer: coarse`; os 44 px a 390 px vêm da regra por largura e batem.
- Contraste de texto sobre hachura: o cálculo ignora o fundo em gradiente; conferi nas capturas que abri que nenhum texto fica sobre hachura.
- Contraste das fatias nesta rodada (herdado da r4, pois o CSS não mudou).
- Capturas: abri 6 delas (lista acima); o resto da pasta conferi por texto e medida.
- Impressão em preto e branco: não imprimi.
- Dado real: tudo é exemplo.

## Para o dono

Nada pendente de ajuste. M1 a M5 podem ir como estão; M1 e M2 (vocabulário do "ainda não existe" e do "não medido") são as que mais valem ser decididas antes do código real.
