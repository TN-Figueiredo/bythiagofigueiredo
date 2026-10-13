# Revisão de UX, mockup 17c (Insights: "quem sobe e quem desce no nicho"), rodada 2, 13/10/2026

Revisor: `revisor-ux-senior`. Chromium headless (Playwright, `file://`, fontes externas bloqueadas, sem porta de rede, sem a 3099, sem os specs do projeto). Escopo da rodada: conferir se B1 e C1 a C5 da r1 foram resolvidos e se os ajustes criaram defeito novo. Medi nos 12 estados, em 4 cruzamentos (1440 escuro, 1440 claro, 390 claro, 390 escuro), e abri com os olhos as capturas de cartão que gerei em `shots/r2/` (`r2-*.png`, só do cartão; as do designer ficam como estão).

## Resumo

**Veredito da tela: PRONTO PARA O DONO. 0 bloqueios, 0 "corrige", 6 melhorias que não bloqueiam.**

| Veredito | Telas |
|---|---|
| pronto para o dono | 1 (17c) |
| volta para ajuste | 0 |
| reprovado | 0 |

Os 6 achados da r1 (B1, C1 a C5) estão resolvidos com medida. O ajuste não criou defeito novo que bloqueie. O que ainda pesa, em ordem, e vai ao dono como pergunta, não como falha:

1. A primeira linha de canal a 1440 px cai em y=915 de uma janela de 900 (a frase e a barra estão acima da dobra, em y=661 e 705). A causa é a casca da aba (cabeçalho e as duas tiras "já existe"), não o cartão; está declarada na pergunta 5.7.
2. O zero medido e o "sem base" recebem tratamento diferente (M3 abaixo). A distinção é a regra do dono, mas o ⓘ usa para um lado um argumento que vale para o outro. Vale uma linha na pergunta 4.
3. A frase do estado "mesma idade, nenhum medido" é a única que ficou pesada (4 linhas a 390 px, M1).

## A pergunta de quem abre

"Neste nicho, quem está subindo e quem está descendo, cada canal contra ele mesmo?" Primeiro olhar a 1440 (sem rolar): a frase diz quantos e em que janela ("▲ 3 sobem, ▼ 2 descem e ＝ 1 fica estável em views nos últimos 28 dias, no nicho Viagem. 1 canal ainda não pôde ser medido."), a barra de contagem repete em largura proporcional, e o seletor mostra qual leitura vale. O "quem" (nomes) começa 254 px abaixo da frase (era 292); a 390 px começa 342 px abaixo (era 540). Resposta de relance: **sim para "quantos", sim para "quem" com uma rolagem curta**. Aceito, com a pergunta 5.7 declarada.

## Conferência dos achados da r1

| Achado | Estado | Evidência |
|---|---|---|
| **B1** frase sem objeto e janela | **Resolvido** | Lido de `#q-fr` com clique real: a "frase a" diz "em views nos últimos 28 dias"; a "b" diz "nas views do vídeo típico dos longos publicados nos últimos 90 dias"; a "c" acrescenta "medidas aos 30 dias de vida". Trocar o botão reescreve a frase e o foco fica no botão novo. `um-canal`, `magro`, `extremo`, `zero` também têm objeto e janela. |
| **C1** rolagem horizontal 901 a 1023 | **Resolvido** | `scrollWidth - clientWidth` = 0 em 320, 360, 600, 768, 900, 901, 960, 1024, 1099, 1100, 1280 (estados `extremo`, `zero`, `leituras`). Era 133, 74 e 10. |
| **C2** "N contra 0" e "0 contra 0" | **Resolvido** | `r2-zero-1440-escuro.png` e `r2-zero-390-claro.png`: Ana Passaporte ("3.100 views contra 0") e Voo Baixo ("0 contra 0") ficam "não medido, sem base para comparar", sem posição ("–"), fora da frase ("2 sobem e 2 descem… 3 canais ainda não puderam ser medidos") e fora da barra (○ 3). Caixa vazada com 0 mantida. O contorno pontilhado da trilha é diferente do pontilhado com hachura de progresso do Pedro no Mundo: a falta de registro e a falta de base não se confundem. |
| **C3** erro afirma o que não sabe | **Resolvido** | `r2-erro-390-claro.png`: "Os outros cartões desta tela carregaram. Tente de novo; se o erro continuar, confira se a sincronização dos canais está atrasada." Sem ⓘ no título. |
| **C4** nomes abaixo dos controles | **Resolvido (na parte do cartão)** | Primeira linha de canal em relação à frase: 1440 de 292 para 254 px; 390 de 540 para 342 px (medi o topo do botão ▾; a linha começa uns 12 px antes). Seletor a 390 em uma linha de 48 px de altura (era 74 a 80 empilhado). A discordância parcial do designer (o resto é casca da aba) procede: a frase está em y=661 (1440) e y=620 (390) por causa do que vem antes do cartão. Aceito; o cartão perdeu o que podia perder. |
| **C5** borda do "As 3 leituras" a 390 | **Resolvido** | Borda `#958A75` (escuro) e `#6E624E` (claro), 1 px, em botão de 44 x 44. Contra o cartão: 4,60:1 e 5,5:1 (era 1,44 e 1,77). |
| S1 a S9 | Feitos | "Até 18/10" na tela; ⓘ fala "na leitura escolhida"; botão sob a frase quando só outra leitura mede (44 px de alto a 390, clique troca a leitura e leva o foco); "vídeo típico: 52.000 views (mediana de 11 longos)"; `um-canal` sem barra; sem ⓘ em vazio e erro; eixo some quando nada está medido; NOTAS corrigida (151 px). |

Defeito novo criado pelo ajuste: nenhum que bloqueie. Procurei especificamente: texto do "Mesma idade" estourando o botão a 390 (não estoura: `scrollWidth <= clientWidth` em todo `.q-op`), `aria-controls` apontando para id inexistente (zero), id duplicado (zero), o ✓ do botão escolhido (vê-se bem; o escolhido tem ✓, borda forte e fundo), a frase `aria-live` (um nó, `#q-fr`), o botão sob a frase (alvo de 44 px a 390, 32 px a 1440 com mouse, igual ao lote 1).

## Veredito por estado e por largura

"1440 e" = 1440 px tema escuro; "390 c" = 390 px tema claro (o par obrigatório). Cruzei também 1440 claro e 390 escuro em todos (medidas) e olhei com os olhos os estados marcados com (olhei).

| Estado | 1440 e | 390 c | Observação |
|---|---|---|---|
| tipico | pronto (olhei) | pronto (olhei) | |
| leituras (linha aberta) | pronto | pronto (olhei) | painel com a principal em símbolo cheio e as outras em contorno, sem veredito |
| videos (leitura b) | pronto (olhei) | pronto | frase passa de uma linha a 1440 e deixa "medido." sozinho na segunda (M6) |
| justa (leitura c, nenhum medido) | pronto | pronto (olhei) | M1 (frase longa), M4 (texto repetido 7 vezes) |
| extremo | pronto (olhei) | pronto | +340% com ›, −78% com ‹, −60% sem seta, 3 empates em 2º e o seguinte 5º, +10% de 9,68%, nome de 69 caracteres em duas linhas, dia sem registro; conferi as contas de 6 linhas: batem |
| zero | pronto (olhei) | pronto (olhei) | C2 resolvido; M3 |
| nao-medido | pronto (olhei) | pronto | M4 |
| magro (2 canais) | pronto | pronto | |
| um-canal | pronto | pronto | sem barra de contagem |
| sem-dado | pronto | pronto | sem ⓘ |
| sem-dado-leitura | pronto | pronto (olhei) | botão desabilitado explica o motivo |
| erro | pronto | pronto (olhei) | borda e ícone em `--danger`, texto em `--text` |

**Carregando:** não desenhado, e a NOTAS justifica (aba montada no servidor) e deixa a regra para o caso de requisição à parte. Aceito, igual à r1.

## Bloqueios

Nenhum.

## Melhorias (não bloqueiam; fazer ou responder por escrito)

**M1. Frase do estado "mesma idade, nenhum medido" é a mais pesada da tela.** `justa`, 390 c: "Nenhum canal do nicho Viagem tem medida nas views do vídeo típico dos longos publicados nos últimos 90 dias, medidas aos 30 dias de vida ainda: o primeiro fecha em 01/04/2027." ocupa 4 linhas (y 105 a 190 do cartão) e o "medida… medidas… ainda" soa truncado. Sugestão: "Nenhum canal do nicho Viagem tem a medida aos 30 dias de vida ainda: o primeiro fecha em 01/04/2027." (o objeto detalhado já está no botão e no ⓘ). A "frase a" do `nao-medido` tem o mesmo molde ("tem medida em views nos últimos 28 dias ainda"): "…tem a medida de views dos últimos 28 dias ainda: o primeiro fecha em 27/11."

**M2. O símbolo ◌ do segmento "não medidos" quase não se vê.** `r2-zero-1440-escuro.png`, barra de contagem: o ◌ sai com traço fino e pequeno (fonte reserva) ao lado de um "3" em rosa forte; na captura em cinza e no claro a 390 ele continua legível só porque a hachura e o texto "não medidos" carregam. Os outros dois segmentos têm ▲ e ▼ cheios. Sugestão: trocar o ◌ pelo mesmo quadradinho hachurado que o seletor já usa em "nenhum medido" (forma própria, estável, sem depender de glifo).

**M3. Zero medido e "sem base" usam argumentos opostos.** `zero`: "Trilha Sem Mapa, 0 views contra 41.000" é ▼ −100%, 4º, barra âmbar até a seta; "3.100 contra 0" é "não medido". O ⓘ diz que "0 views seguidas pode ser dado que não chegou" para o período anterior. O mesmo vale para o período atual, e o canal com 0 hoje entra na contagem como "desce". A distinção é a regra do dono (zero medido é uma medida) e a divisão por 0 é de fato impossível, então não bloqueio. Sugestão: acrescentar à pergunta 4 da NOTAS o caso espelho ("0 contra N: ▼ −100% ou não medido?") com a captura `17c-zero-1440-escuro.png`.

**M4. Estados cheios de "não medido" repetem o mesmo texto.** `justa`: 7 vezes "fecha em 01/04/2027" e 7 vezes "precisa de 180 dias de registro dos vídeos novos", cada uma com pastilha, trilha e faixa "estável" desenhadas, a 390 são 1.583 px de cartão para uma informação. Sugestão: com todos no mesmo motivo e data, um bloco só ("Os 7 fecham em 01/04/2027") e a lista de nomes sem trilha.

**M5. Pergunta 5.7 (cartão sobe para o topo da aba?) é a decisão que mais muda a leitura de relance.** Medido: com a casca atual o cartão começa em y=517 a 1440 e a primeira linha de canal em y=915; a 390 a frase está em y=620 e o primeiro canal em y=962 (janela 844). Manter como pergunta ao dono, com a captura `17c-tipico-1440-escuro.png`.

**M6. Frase da leitura b a 1440 quebra deixando "medido." sozinho** (`r2-videos-1440-escuro.png`). Se a M1 encurtar o objeto, resolve; senão, trocar "ainda não pôde ser medido" por "sem medida" não é necessário.

## Medidas

Contraste de texto lido da página (cor composta sobre o fundo composto, o pior de cada cruzamento; mínimo 4,5:1 texto, 3:1 elemento gráfico). Nenhum texto do cartão ficou abaixo de 4,5:1 nos 12 estados x 4 cruzamentos (fora a seta, que está sobre a barra, e a hachura, calculada à parte).

| Item | Escuro | Claro |
|---|---|---|
| Pastilha / "não medidos": texto `#E59CC0` sobre `#3A2232` e sobre a listra da hachura | 6,77 / 5,13 | `#8E2A62` sobre `#F7E1EC` e sobre a listra: 6,37 / 5,47 |
| Seta ›/‹ sobre a barra (texto `#16130F` sobre verde e âmbar) | ≥ 7 (o medidor ingênuo leu 1,1 contra o cartão; a seta fica sobre a barra) | branco sobre `#11692F`, `#8A5A00`: 6,37 e 5,55 |
| Borda do botão "As 3 leituras" a 390 (`--dim`) | 4,60 | 5,5 |
| Barra ▲ / ▼ / ＝ contra o cartão (r1, tokens inalterados) | 7,26 / 7,71 / 6,18 | 6,37 / 5,55 / 7,13 |
| Menor texto do cartão | 12 px (nenhum menor) | 12 px |

Escala de cinza (`r2-zero-390-claro-cinza.png`): a tela se lê. ▲ e ▼ saem em cinza escuro parecido, e separam por símbolo, lado da barra e palavra; "não medido" segue inconfundível (claro, hachura, pontilhado); o ✓ marca o botão escolhido.

Geometria e conforto:

| Medida | 1440 | 390 |
|---|---|---|
| Rolagem horizontal da página, 12 estados x 4 cruzamentos | 0 | 0 |
| Rolagem em 320, 360, 600, 768, 900, 901, 960, 1024, 1099, 1100, 1280 (3 estados) | 0 | 0 |
| Texto cortado ou fora do cartão | nenhum (só o texto só-para-leitor-de-tela) | nenhum |
| Alvos menores que 44 x 44 px | ponteiro fino: ⓘ 28, "As 3 leituras" 122 x 36, nome do canal 17 de altura, botão sob a frase 32 (como no lote 1) | nenhum (emulado com toque: ⓘ, ▾ 44 x 44, nome, seletor 105 x 48, botão sob a frase 44) |
| Altura do cartão com 7 canais, `tipico` | 864 px | 1.569 px (era 1.819) |
| Primeira linha de canal abaixo da frase | 254 px | 342 px |
| Erros de página (JS) | 0 | 0 (as únicas mensagens do console são "Failed to load resource" das fontes que eu bloqueei) |
| `aria-controls` sem alvo / id duplicado | 0 / 0 | 0 / 0 |
| Foco (Tab, 30 passos, 1440) | contorno 2 px sólido em todo controle do cartão; ordem: ⓘ do título, 3 botões do seletor, ⓘ da legenda, depois nome e "As 3 leituras" de cada linha, ⓘ do seu canal | n/a |
| Esc no ⓘ do título | fecha e devolve o foco ao botão | idem |
| ⓘ aberto a 390 (`r2-info-390.png`) | cabe na janela, texto sem rolar | cabe (366 de largura) |
| Linha "As 3 leituras" aberta | `aria-expanded` verdadeiro, painel existe, foco fica no botão da linha | idem |
| Troca de leitura por clique | frase e meta reescritas, foco no botão novo | idem |
| `color-mix()` na pasta | só o comentário "Sem color-mix()" em `m17c.css` (lote 1 idem) | idem |
| Alterações fora da pasta do mockup | nenhuma (`git status` do lote 1: sem diff) | |

## Consistência com o lote 1

Boa e inalterada desde a r1. Mesmos tokens, casca, "+ novo" tracejado, hachura rosa para "não medido", caixa vazada para zero medido, método no ⓘ com a frase fixa, "exemplo" em todo número. A divergência da r1 (frase sem janela) foi eliminada: a frase agora faz como o `pe-fr` do lote 1.

## O que NÃO verifiquei

- Leitor de tela (VoiceOver, NVDA): li a árvore e os atributos (`role="img"` com texto por extenso, `aria-pressed`, `aria-expanded`, `aria-controls`, `aria-live` num único nó), mas não ouvi nada.
- Safari, Firefox e Opera. Só Chromium. O `color-mix()` está ausente e o Opera é o navegador do dono, mas não abri o mockup nele. O ◌ (M2) depende da fonte reserva de cada navegador.
- Toque real em aparelho (usei emulação de toque com `isMobile`).
- Fechar o ⓘ por toque fora do balão a 390 px: usei Esc; o padrão é o do lote 1 e não o reavaliei.
- Contraste do texto sobre a hachura da barra de contagem e da pastilha: calculado com os dois tons da hachura (acima), não lido do pixel.
- Dado real: tudo é exemplo (pergunta 3 da NOTAS: quantos canais já têm 56 dias de registro; não consultei produção). Mais de 40 canais no nicho continua declarado como não resolvido pelo designer (regra "mostrar 10 e Mostrar mais N" do lote 1).
- Vi com os olhos: tipico (1440 e, 390 c), zero (1440 e, 390 c, cinza), nao-medido 1440, justa 390, extremo 1440, leituras 390, videos 1440, erro 390, sem-dado-leitura 390, info 390. `magro`, `um-canal`, `sem-dado`, os cruzamentos 1440 claro e 390 escuro: só por medida e por texto.

## Para quem desenhou

Pode ir ao dono. As melhorias M1 a M6 ficam a seu critério; se não fizer, diga por quê. Peço só que a M3 vire uma linha na pergunta 4 da NOTAS e que a M5 (pergunta 5.7) vá com a captura, porque são as duas decisões que o dono pode querer inverter.
