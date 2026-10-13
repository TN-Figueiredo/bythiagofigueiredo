# Revisão de UX, rodada 1: mockup 12 (origem das views, termos e sites, aparelho, país, inscritos)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/12-origem-das-views/`.
Método: Chromium headless (Playwright, `file://`, fontes externas bloqueadas como no script do mockup; nenhuma porta, nenhum servidor, nada da 3099). Olhei as capturas do desenhista e gerei as minhas (recortes a 1:1, `shots/r1-*.png`). Medi com `getBoundingClientRect` e `getComputedStyle`; contraste por cálculo sobre o fundo composto (cor lida da página, alfa composto camada por camada). 14 casos x 4 cruzamentos (1440 e 390, claro e escuro) para rolagem, fonte, alvo e contraste de texto; capturas olhadas nos casos tipico (vídeo, canal 28, desde a publicação), extremo, magro, zero, não medido, vazio, erro, leitura (as duas variantes), país por mês e o cartão da comparação.

## Veredito: VOLTA PARA AJUSTE (não vai ao dono nesta rodada)

**2 bloqueios, 6 "corrige", 8 sugestões.** O desenho de fundo é bom e é o melhor da A5 até aqui: a barra de 40 px que fecha com o total e termina na fatia tracejada "omitido pelo YouTube" responde de relance, a régua de cobertura impede o "42% do mês" falso, as contas fecham (conferi 826, 3.185, 36 e 412.864 somando linha a linha e as porcentagens a 100), cinco "vazios" são cinco formas e nenhum usa a de outro, zero `color-mix()` (grep: só comentários "sem color-mix"), zero rolagem horizontal, texto de 12 px ou mais em todo lugar, contraste de texto 4,73:1 no pior caso. Dois defeitos impedem a ida ao dono: os símbolos dos quatro cartões pequenos (e dos de termos e sites) estão quebrados por uma colisão de CSS, e o estado magro, o caso real por meses, afirma um zero que o próprio desenho diz que não pode afirmar.

### A pergunta do usuário e a resposta em 3 segundos

Pergunta: **"de onde vêm as minhas views, e posso confiar nesse número?"**. A 1440 px, sem rolar e sem abrir dica, a resposta está lá: frase (34% de vídeos sugeridos, 31% da pesquisa, 6% omitido), barra com o maior contraste da tela e régua de cobertura quando a cobertura é parcial. A parte "posso confiar" tem forma própria (fatia tracejada, régua hachurada, "—" onde o YouTube não deu número). A 390 px o cartão começa só em y 940 da página, depois do cabeçalho do vídeo (6 células empilhadas, aprovado em 12/10): a resposta fica abaixo da primeira dobra de 844 px. Não é culpa desta tela (ver melhoria 8).

## Contagem por estado e largura

Par obrigatório (1440 escuro, 390 claro); os outros dois cruzamentos só por medida (rolagem, fonte, alvo, contraste de texto: limpos nos 56 casos).

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico, vídeo, 7 dias | volta (B1) | volta (B1) | resposta de relance boa; chips quebrados nos 4 cartões e em termos e sites |
| Típico, vídeo, desde a publicação | ok | ok | régua 8 de 22 fecha com a frase |
| Típico, canal, 28 dias | volta (B1) | volta (B1) | régua 8 de 28: o bloco medido tem 28,5% da largura (8/28 = 28,6%), correto |
| Extremo, canal, desde 2015 | volta (B1) | volta (B1) | faixa quebrada honesta (8 de 4.205); texto longo quebra sem estourar; contas fecham em 412.864 |
| Magro, canal, 90 dias | **reprovado neste estado (B2)** | **reprovado (B2)** | zero de "sites de fora" contradiz a lista de origem acima |
| Zero medido, vídeo | ok | ok | oito caixas "0" iguais seguidas (sugestão 3) |
| Não medido, vídeo | corrige (C1) | corrige (C1) | motivo e data presentes; texto cita "origem" em aparelho, país e inscritos |
| Sem dado (vídeo de ontem) | ok | ok | contorno pontilhado com relógio, data da primeira leitura |
| Erro | ok | ok | `role="alert"`, pastilha com texto em `--text`, botão de 44 px |
| Só leitura, sem termos e sites | volta (B1) | volta (B1) | cadeado e frase certos; cartões pequenos com o chip quebrado |
| Só leitura, só o total | ok | ok | "7 blocos" confere com a lista |
| País por mês (canal, 90) | corrige (C5) | corrige (C5) | mostra dado de antes de 04/10 que a decisão 32 exclui |
| Cartão da comparação (típico, magro, não medido, leitura) | ok | ok | cinco linhas "+ novo", as formas dos estados repetidas |
| Carregando | **não desenhado (C6)** | não desenhado | |

## Bloqueios (impedem ir ao dono)

### B1. Os símbolos dos cartões de termos, sites, aparelho, país e inscritos estão quebrados (colisão de classe)

- **Onde:** todos os estados com esses cartões, os dois temas e as duas larguras. Capturas: `shots/r1-chips-quebrados-1440-escuro.png`, `shots/r1-chips-quebrados-390-claro.png`, e as originais `tipico-video-1440-escuro.png` e `magro-canal-1440-escuro.png`.
- **O que está errado:** o quadrado laranja que abre a frase de cada cartão aparece como um bloco liso com o ícone caído no canto inferior direito, cortado ("BR" de país vira "BR" pela metade; a lupa de termos e a seta de sites ficam coladas na quina). O cartão "De onde vêm" tem o chip certo (losango centrado), então o dono vê dois chips diferentes na mesma página e o símbolo que a regra 4 exige some justamente nos blocos em que o laranja é a única cor.
- **Evidência:** medida no DOM, o chip `.ov-sw.g.lado` mede 30 x 30 px (devia ser 26 x 26) e o SVG está em x=15, y=15 dentro dele (devia estar em 5, 5). Causa: `ov.css` define `.lado{--c:var(--lado-o)}` e `.ov-sw.lado`/`.ov-sg.lado`, mas o `a4.css:378` já tem `.lado{border:1px solid; border-top:3px solid; padding:12px 14px 14px; border-radius:8px}` (o cartão de lado de uma comparação). Os dois se somam. A mesma classe está na primeira fatia da barra "inscritos" (recebe borda superior e padding do cartão; no estado magro o ícone dela some, a fatia tem 24 px).
- **Correção exata:** trocar `.lado` por `.ov-own` em `ov.css` (linhas 32, 46, 53) e nos pontos do `ov.js` que montam os chips e as fatias dos blocos de uma cor só; conferir depois que `.ov-sw.g` mede 26 x 26 e o SVG fica em (5, 5) em todos os cartões.

### B2. Estado magro: "Zero medido. Nenhuma view veio de sites de fora" contradiz a lista de origem e a regra do próprio mockup

- **Onde:** canal, estado magro (36 views em 90 dias), bloco "Sites de fora do YouTube". Captura: `shots/r1-magro-sites-zero-1440-escuro.png`.
- **O que está errado:** o bloco mostra a caixa vazada "0" e afirma "Nenhuma view veio de sites de fora neste período". Acima, no mesmo estado, a lista de origem tem "Sites e apps de fora: —" e **9 das 14 views omitidas pelo YouTube**, com a dica "onde há “—”, o YouTube não deu número: pode estar aqui dentro". Nada impede que as 9 sejam de sites de fora. A NOTAS (decisão 5) e o spec 7.3 (coberto, sem linha, soma abaixo do total = "zero ou abaixo do limiar") dizem que o 0 só aparece quando o dia chegou e o omitido é 0. É a mesma falha que o lote 1 pagou ("frase de afirmação forte contradita por outro número"), e este é o estado que a tela vai ter por meses.
- **Evidência:** a janela dos termos e sites (34 de 90 dias) é diferente da janela da origem (8 de 90): a tela não tem como saber que externo é zero. O bloco de termos ao lado trata o mesmo caso certo ("Nenhum termo apareceu. O YouTube só mostra termos que trouxeram várias views").
- **Correção exata:** quando há omitido na janela, o bloco de sites usa o mesmo formato tracejado de "Nenhum termo apareceu": "**Nenhum site apareceu.** O YouTube só mostra sites que trouxeram várias views." A caixa "0" de sites fica só para o caso em que a origem "sites e apps de fora" foi medida como zero com omitido zero (estado zero, total 0). Reconferir os outros blocos do estado magro com a mesma regra (aparelho, país e inscritos já usam "—", certo).

## Corrige (vai ao dono só depois de corrigido)

- **C1. Texto de "não medido" fala da coisa errada.** `ov.js:122` usa o mesmo texto "A coleta começa em 14/10. Antes dessa data não guardamos a origem; não é zero." nos cartões de aparelho, país e inscritos (captura `nao-medido-video-1440-escuro.png`). Trocar "a origem" por "o aparelho", "o país" e "quem é inscrito" (um texto por cartão).
- **C2. Cor sem estabilidade de significado em relação ao resto do produto.** A paleta de origem reaproveita `--tier-mid`, `--tier-high`, `--tier-top`, que no produto são faixas de desempenho (mediano, alto, topo: `a4.css:393, 413, 502, 639`, o violeta também é "hábito" e "troca") e `--lado-b`/`--lado-n`, lados de uma comparação. O dono cobra cor estável por significado: o coral "topo" aqui é "Início e inscrições" e o azul-céu "mediano" é "Pesquisa". O PLANO chama de vantagem ("token existente") e não conta a colisão. Ação: declarar a colisão em "Dúvidas ao dono" da NOTAS (ele decide: aceitar porque o símbolo e a posição fixa resolvem, ou trocar), e pôr no ⓘ da origem que a cor vale só dentro destes blocos. Não bloqueia porque o símbolo e a ordem fixa dão leitura em escala de cinza e a CONVENCOES proíbe matiz novo.
- **C3. Inscritos e não inscritos: o destaque está no lado errado.** A frase diz "66% das views vieram de quem **não** é inscrito", mas a fatia dos não inscritos é a apagada (fundo rgba laranja .22 sobre o cartão: 1,48:1 no escuro, 1,29:1 no claro; só a borda de 2 px carrega) e a dos inscritos (29%) é o laranja cheio, o que mais chama atenção. A coisa que mais chama atenção tem de ser a resposta. Inverter: a fatia líder cheia, a menor contornada, mantendo os dois símbolos de pessoa (pessoa-visto e pessoa) que já existem; vale também para a legenda.
- **C4. Rótulo de acessibilidade com gramática quebrada.** Os botões ⓘ dizem "Como em que aparelho é calculado", "Como de que país é calculado", "Como inscritos e não inscritos é calculado" (`ov.js:182`, `'Como ' + titulo.toLowerCase() + ' é calculado'`). Texto por bloco: "Como o aparelho é calculado", "Como o país é calculado", "Como inscritos e não inscritos são calculados". O mesmo título aparece como cabeçalho do popover.
- **C5. "País por mês" mostra dado que a decisão 32 exclui.** Decisão 32 do dono: sem retroação. O spec v2.3 diz que sem retroação não existe linha de mês. O estado mostra julho a setembro (Brasil 23.870, quase 10 vezes a base dos outros cartões da mesma página, que valem 8 dias), ao lado de "antes de 04/10 não medido". A NOTAS já pergunta ao dono (dúvida 2), mas não se manda ao dono uma tela que contradiz o que ele decidiu. Tirar o botão "País por mês" da barra de estados e deixar a dúvida 2 só na NOTAS (ou marcá-lo como "só se a retroação voltar", fora da fila de aprovação).
- **C6. Faltam dois estados que a convenção pede.** Carregando (CONVENCOES 13: "onde houver"): trocar de 7 para 90 dias recarrega a página; ou desenhar o esqueleto de um bloco (barra cinza com o mesmo contorno, sem hachura rosa, que é "não chegou"), ou dizer na NOTAS por que não há. "Em revisão" (spec 7.3, S > B) está declarado "não desenhado aqui": desenhar uma faixa, ou registrar na NOTAS que o dono não verá esse estado e a decisão de quem implementa.

## Sugestões (não bloqueiam)

1. **Linha de changelog na tela.** "A linha “Origem do tráfego” saiu desta lista: agora está acima." (todos os estados) explica uma mudança do produto, não ajuda quem lê. Cortar; o cartão fica só com "Curva de retenção: ainda não é coletada."
2. **Lista não alinha com a barra.** A barra tem 1.134 px a 1440 e a lista termina em 640 px (números em x 835 e 897, metade da direita vazia): o olho não liga a fatia à linha. Estender a lista à largura da barra, ou limitar a barra a 640 px como a régua (que tem 760). A régua de cobertura (760 px) e a barra (1.134 px) também têm larguras diferentes.
3. **Zero medido, oito caixas iguais seguidas.** O estado zero repete a caixa "0" em oito blocos; as de baixo poderiam ser uma linha só ("Aparelho, país, inscritos: nenhuma view nos 7 dias medidos"). Honesto como está, mas lê como bloco monocromático.
4. **Chip da frase no estado magro.** O chip é a lupa (pesquisa, 22%) enquanto a frase diz que o omitido (64%) domina. Usar o símbolo do omitido quando ele passa de 50%.
5. **Escala das barras muda entre cartões.** Termos e sites escalam pelo maior valor (40 = barra cheia); aparelho e país escalam pela fatia do total (66% = 66% da largura). Uma linha no ⓘ resolve.
6. **Jargão que sobra.** "relatório em lote do YouTube" (não medido, termos), "forja e Cowork" no ⓘ de termos, "leitura das 14:32" no erro. Trocar por "o relatório do YouTube ainda não chegou", "não saem do painel" e "a consulta das 14:32". `7  de  7` em monoespaçada tem espaços largos entre as palavras; usar mono só nos números.
7. **Seletor de período a 36 px a 1440** (`.ov-pe{min-height:36px}`); a regra pede 44 px "nos controles novos". A 390 px já tem 44. Subir para 44 (ou 40 como o `.btn` do lote) e registrar.
8. **A 390 px a resposta fica abaixo da primeira dobra** (cartão em y 940). A frase-resumo poderia subir para fora do cartão, logo abaixo do seletor, ou o seletor vir com a frase; a decidir com o dono junto do cabeçalho do vídeo, que é aprovado.
9. **Popover do ⓘ a 390 px sem botão de fechar** (só toque fora; Esc só em teclado físico). Padrão do produto, mas a 390 px o popover ocupa 403 px de altura (47% da tela).

## Tabela de medidas

| Item | Medida | Limite | Resultado |
|---|---|---|---|
| Rolagem horizontal da página (14 casos x 4 cruzamentos) | 0 px em todos | 0 | ok |
| Texto abaixo de 12 px | 0 em todos | 0 | ok |
| Contraste de texto (todo texto da tela, composto sobre o fundo) | pior 4,73:1 (chip "seu canal", claro, componente aprovado); depois 5,24 (escuro) e 5,28 (sigla BR no chip, claro) | 4,5 | ok, nenhum abaixo |
| Contraste de elemento gráfico contra o cartão, escuro: pesquisa 7,73; sugeridos 6,08; início 5,34; Shorts 11,88; externo 6,80; contorno do omitido (`--muted`) 6,18; borda do zero (`--im-zero`) 4,97; laranja 6,72; hachura rosa 7,76 | todos | 3,0 | ok |
| Contraste de elemento gráfico, claro: pesquisa 5,56; sugeridos 6,65; início 5,13; Shorts 8,32; externo 4,43; contorno do omitido 7,13; borda do zero 4,84; laranja 4,94; hachura rosa 7,40 | todos | 3,0 | ok |
| Ícone (`--on-lado`) sobre a fatia, pior caso | 4,73:1 (externo, claro) | 3,0 | ok |
| Fatia "não inscritos" (preenchimento) contra o cartão | 1,48:1 escuro, 1,29:1 claro; borda de 2 px `--lado-o` 6,72 e 4,94 | 3,0 pela borda | ok pela borda, ver C3 |
| Pesquisa x sites de fora (mesmo azul), entre si | 1,14:1 escuro, 1,26:1 claro; separados por símbolo, pontilhado e posição na barra | só forma | declarado na dúvida 4 da NOTAS |
| Sugeridos x início (violeta e coral), em tons de cinza | 1,14:1 e 1,30:1; separados por símbolo e posição | só forma | ok (símbolo carrega) |
| Chip da frase (`.ov-sw.g.lado`) | 30 x 30 px, SVG em (15, 15) | 26 x 26, SVG em (5, 5) | **falha (B1)** |
| Alvo, 390 px: ⓘ | 44 x 44 | 44 x 44 | ok |
| Alvo, 390 px: seletor de período, botão "Tentar de novo" | 44 de altura | 44 | ok |
| Alvo, 1440 px: seletor de período (`.ov-pe`) | 36 de altura (65 a 124 de largura) | 44 em controle novo | sugestão 7 |
| Alvo, 1440 px: ⓘ compacto | 28 x 28 (ponteiro fino, regra do produto) | — | ok pela convenção |
| Foco visível (Tab, 22 passos) | outline sólido 2 px em todos | 2 px `--accent` | ok |
| Ordem de Tab | barra de estados, migalha, ⓘ do cabeçalho, seletor, ⓘ de cada bloco | ordem visual | ok |
| Esc fecha o popover do ⓘ | sim (verificado a 390 px) | sim | ok |
| `role="img"` com texto por extenso | 5 barras (origem, impressões, termo x sem termo, sites, inscritos) | desenhos | ok |
| SVG de enfeite sem `aria-hidden` | 0 | 0 | ok |
| Hierarquia de títulos | H1, H2, H3 (impressões e termos/sites dentro do grupo), H2 | sem salto | ok |
| `color-mix()` na interface | 0 (só 4 comentários "sem color-mix") | 0 | ok |
| Alturas de linha da lista | 38 a 50 px | 132 a 155 só em acréscimo de linha de canal | ok |
| Contas que fecham | origem 826; impressões 11.550; extremo 412.864; magro 14 = 5 + 9; porcentagens 100 | fecha | ok |

## O que não consegui verificar

- Leitor de tela real (VoiceOver, NVDA): conferi só rótulos e papéis no DOM. Em especial, a leitura da barra empilhada e da régua por `aria-label`.
- Safari e Opera (navegador do dono): só Chromium. O mockup não usa `color-mix()` (grep), mas o desenho tracejado/pontilhado/listrado (`repeating-linear-gradient`, `radial-gradient`) não foi visto em Opera.
- Toque real: `hasTouch` do Playwright não liga `pointer: coarse`. Os 44 px a 390 px vêm de regra por largura (a 390 px as medidas bateram), mas não testei um tablet de 900 px com toque.
- Os cruzamentos 1440 claro e 390 escuro foram medidos (rolagem, fonte, alvo, contraste de texto), mas não olhados em captura.
- O estado "carregando" e "em revisão" não existem para eu julgar (ver C6).
- Dado real: tudo é exemplo; o desenho a 8 de 4.205 dias e o magro a 14 views são os dois que mais importam e só poderão ser conferidos com o dado real depois da E11.

## Para a rodada 2

Reconferir: B1 (medir 26 x 26 e SVG em 5, 5 nos 7 chips e na fatia de inscritos, nos dois temas), B2 (magro com a frase tracejada de sites, e os outros blocos do magro), C1 a C6 e as sugestões 1, 2, 4 e 7 (as que mudam a forma). Acordo com `frontend-design`: "pronto para o dono" só com zero bloqueio e zero "corrige" aberto.
