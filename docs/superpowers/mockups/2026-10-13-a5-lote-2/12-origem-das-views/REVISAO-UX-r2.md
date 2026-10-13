# Revisão de UX, rodada 2: mockup 12 (origem das views, termos e sites, aparelho, país, inscritos)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/12-origem-das-views/`.
Método: Chromium headless (Playwright, `file://`, fontes externas bloqueadas; nenhuma porta, nenhum servidor, nada da 3099, nenhum spec do projeto). Medi 25 casos x 4 cruzamentos (1440 e 390, claro e escuro) = 100 medidas de rolagem, fonte, alvo, contraste de texto composto e tamanho dos chips; gerei as capturas `shots/r2-*.png` (par obrigatório de todos os casos + os quatro cruzamentos de típico e magro) e olhei em recorte a 1:1: típico canal 28 (1440 escuro e 390 claro), magro canal (1440 escuro, 390 claro), extremo 390 claro, não medido, em revisão, carregando, erro, zero, sem dado, só leitura (as duas), cartão da comparação. Li o DOM de cada estado (texto e `aria-label`) e conferi as contas somando linha a linha.

## Veredito: VOLTA PARA AJUSTE (1 bloqueio novo, 2 "corrige" novos)

Os dois bloqueios da r1 estão resolvidos, os seis "corrige" também (C2 por declaração, como combinado) e o desenho melhorou de verdade. Mas a conferência do DOM achou um defeito que a r1 não podia ver e que é da mesma família do B2: **o rótulo de leitor de tela da barra de origem diz "0%" onde a tela mostra "—"**. Mais duas incoerências na tabela de referência ao lado da tela. Nada disso exige redesenho; é uma tarde de ajuste e uma rodada 3 curta.

### Conferência dos itens da r1

| Item | Resultado | Evidência |
|---|---|---|
| B1 chips quebrados | **resolvido** | `.ov-sw.g` mede 26 x 26 com o símbolo em (5, 5) em todos os 100 cruzamentos (os chips de sigla, "BR", não têm SVG e medem 26 x 26); fatia de inscritos sem borda nem padding herdados; `grep "\.lado" ov.css ov.js` = 0 |
| B2 magro, "zero" de sites | **resolvido** (visual) | `r2-magro-canal-1440-escuro.png`: "Nenhum site apareceu. O YouTube só mostra sites que trouxeram várias views." em contorno tracejado, igual aos termos; aparelho, país e inscritos com "—". **Mas ver B1 abaixo (aria)** |
| C1 texto do não medido | resolvido | "não guardamos a origem / o aparelho / o país / quem é inscrito" (`r2-nao-medido-video-1440-escuro.png`) |
| C2 cor repetida | aceito como declarado | dúvida 8 da NOTAS, "Padrão: aceitar", e o ⓘ da origem abre com "Cores: valem só dentro destes blocos. Em outras telas as mesmas cores indicam faixas de desempenho" (lido no popover aberto por teclado). A decisão é do dono; não bloqueia |
| C3 inscritos, destaque | resolvido | fatia líder cheia (6,72:1 escuro, 4,94:1 claro), a menor contornada; frase e destaque apontam para o mesmo lado (`r2-tipico-canal-28-1440-escuro.png`) |
| C4 rótulos do ⓘ | resolvido | 6 botões lidos: "Como a origem é calculada", "...o aparelho é calculado", "...o país é calculado", "...inscritos e não inscritos são calculados" etc.; 44 x 44 a 390 px |
| C5 país por mês | resolvido | sem botão na barra, sem captura; só `?pais=mes` no código, declarado na NOTAS (decisão 9) |
| C6 carregando e em revisão | resolvido | esqueleto liso, sem hachura rosa nem pontilhado, "Carregando…" com seta circular, `role="status"`, pulso some em `prefers-reduced-motion` (`ov.css:216`); em revisão usa a forma "não medido" com o motivo e diz "Não é zero" |
| Sug. 1, 2, 4, 7 | feitas | changelog fora; barra, lista e régua em 760 px (alinham); símbolo do omitido na frase quando passa de 50% (magro); seletor com 44 px nos dois tamanhos (era 36 a 1440) |

### A pergunta do usuário e a resposta em 3 segundos

Pergunta: **"de onde vêm as minhas views, e posso confiar nesse número?"**. A 1440 px, sem rolar: frase, barra de 40 px com o maior contraste da tela e fatia tracejada do omitido; régua de cobertura hachurada quando a cobertura é parcial. Responde. A 390 px o cartão começa em y 940 (cabeçalho aprovado do vídeo empilhado): já está declarado como dúvida 9 e não é culpa desta tela.

## Contagem por estado e largura

Par obrigatório (1440 escuro, 390 claro). Os outros dois cruzamentos só por medida (rolagem, fonte, alvo, contraste: limpos nos 100 casos), mais captura olhada em típico e magro.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico, vídeo, 7 dias | volta (B1) | volta (B1) | resposta de relance boa |
| Típico, vídeo, desde a publicação | volta (B1) | volta (B1) | idem |
| Típico, canal, 28 dias | volta (B1) | volta (B1) | contas fecham: 3.640 = 3.436 + 204; aparelho, país e inscritos somam 3.640; porcentagens 100 |
| Extremo, canal, desde 2015 | volta (B1) | volta (B1) | faixa quebrada honesta (8 de 4.205), 390 px sem estourar |
| Magro, canal, 90 dias | volta (B1) | volta (B1) | visual certo; aria da barra de origem afirma zero |
| Zero medido | ok | ok | caixa vazada nos blocos largos, linha com caixa pequena nos três cartões |
| Não medido | corrige (C7 na tabela de referência) | corrige (C7) | tela certa; tabela lateral diz "7 dias medidos, 826" |
| Sem dado | ok | ok | contorno pontilhado com relógio e data |
| Erro | ok | ok | `role="alert"`, texto em `--text`, botão de 44 px a 390 |
| Só leitura, sem termos e sites | ok | ok | cadeado e frase certos; 7 blocos conferem |
| Só leitura, só o total | ok | ok | |
| Carregando | ok | ok | desenhado, ver C6 acima |
| Origem em revisão | corrige (C7) | corrige (C7) | tela certa; tabela lateral diz "826 (fecha)" no estado em que a soma passou do total |
| Cartão da comparação (5 casos) | ok | ok | cinco linhas "+ novo", mesmas formas dos estados |

## Bloqueios (impedem ir ao dono)

### B1. A barra de origem do magro diz, para leitor de tela, "Início e inscrições 0% (0)" onde a tela mostra "—"

- **Onde:** canal, estado magro (e qualquer estado em que uma origem sem número fica ao lado de um omitido > 0). Captura do que se vê: `shots/r2-magro-canal-1440-escuro.png` (as quatro linhas com "—").
- **O que está errado:** o `aria-label` do `role="img"` da barra empilhada é gerado com todas as origens, inclusive as sem número: "De 14 views nos dias medidos: Pesquisa do YouTube 22% (3); Vídeos sugeridos 14% (2); **Início e inscrições 0% (0); Feed de Shorts 0% (0); Sites e apps de fora 0% (0); Outras origens 0% (0)**; omitido pelo YouTube 64% (9)." Quem usa leitor de tela ouve quatro zeros que o desenho, a NOTAS (decisão 5) e o spec 7.3 dizem que não podem ser afirmados: o YouTube pode ter escondido essas views dentro das 9 omitidas. É a mesma falha do B2 da r1, agora fora do alcance da vista, e a regra mais cobrada do dono é "nulo nunca aparece como zero". O mockup é a especificação que o implementador copia.
- **Evidência:** `ov.js:92` monta `ORIG[k].n + ' ' + pctDito(pc[i], vals[i]) + ' (' + n(vals[i]) + ')'` para todas as chaves. Lido do DOM no estado magro; nos estados típico, extremo, leitura e revisão não há linha com "—", então o defeito só aparece onde a tela mostra "—".
- **Correção exata:** em `ov.js:92`, para a origem cujo valor a lista mostra como "—" (valor 0 com omitido maior que 0), escrever "{origem}: sem número do YouTube" (ou não listá-la e acrescentar ao fim "origens sem número ficam dentro do omitido"). Manter "0% (0)" só no estado zero (total 0). Reconferir o `aria-label` do inscritos e das impressões no magro (hoje estão certos: só listam o que tem número).

## Corrige (vai ao dono só depois de corrigido)

- **C7. Tabela de referência ao lado da tela contradiz o estado.** O bloco "A conta que fecha neste estado" (fora da tela, mas o dono lê) mostra os mesmos números do típico em dois estados em que a tela diz outra coisa: **Não medido** (`nao-medido`, 1440): "Dias com origem medida 7 (desde 04/10/2026), Views dos dias medidos 826, Soma das origens 776, Omitido 50, Soma + omitido 826 (fecha)", enquanto a tela diz "a coleta começa em 14/10" e mostra hachura; **Em revisão** (`revisao`): "Soma + omitido 826 (fecha)" no estado cuja razão de existir é a soma ter passado do total. Correção: no não medido, esconder a tabela (como já faz em sem dado e carregando) ou mostrar "Dias com origem medida 0"; na revisão, mostrar a soma que passou do total (ex.: "Soma das origens 860 > total 826: em revisão"). A mesma tabela no estado erro mostra "fecha" com valores que a tela não mostra; aceitável porque a tela diz que o total continua certo, mas vale cortar junto.
- **C8. Mesmo caso, rótulo da faixa quebrada com número sem separador.** `aria-label` da régua: "Origem medida em 8 de 4205 dias" (a tela escreve 4.205). Usar o mesmo formatador `A.n`. Correção de uma linha, junto com B1.

## Sugestões (não bloqueiam)

1. **Fatia pequena dos inscritos perde o símbolo.** No magro, a fatia "inscritos" (7%) mede cerca de 25 px de largura e fica sem o ícone de pessoa-visto; só a borda e a legenda carregam. Honesto, mas a regra "símbolo junto da cor" pede o ícone ou, quando a fatia for menor que 24 px, um ponto na legenda ligando ao símbolo. Já tem a lista logo abaixo, por isso sugestão.
2. **Estado zero sem símbolo na frase.** "Nenhuma view nos 7 dias medidos..." abre sem chip (os outros estados abrem com chip). Se for deliberado (não há o que simbolizar), registrar na NOTAS.
3. **Três cartões pequenos de um matiz só.** Aparelho, país e inscritos usam o laranja do "seu canal" nas barras (declarado, com ícone, sigla e posição). Se o dono achar "monocromático", a saída é a cor da origem; pergunta ao dono, não mudança minha.
4. **Escala de cinza.** Pesquisa (7,73:1), sugeridos (6,08) e início (5,34) ficam parecidos em tons de cinza; o símbolo, a ordem fixa e a lista separam. Mesmo achado da r1, sem piora.
5. **Popover do ⓘ a 390 px sem botão de fechar:** padrão do produto, dúvida 10 da NOTAS.

## Tabela de medidas

| Item | Medida | Limite | Resultado |
|---|---|---|---|
| Rolagem horizontal (25 casos x 4 cruzamentos) | 0 px em todos | 0 | ok |
| Texto abaixo de 12 px | 0 em todos | 0 | ok |
| Contraste de texto composto, pior caso por tema | escuro 4,86 (data "05/10 a 11/10" em cinza, só leitura) e 5,24; claro 4,73 (chip "seu canal", componente aprovado) | 4,5 | ok, nenhum abaixo |
| Chips `.ov-sw.g` | 26 x 26, SVG em (5, 5), em todos os cruzamentos | 26 x 26 | ok (B1 da r1 resolvido) |
| Fatia contra o cartão, escuro: pesquisa 7,73; sugeridos 6,08; início 5,34; Shorts 11,88; externo 6,80; inscritos cheia 6,72; contorno do omitido 6,18 | todos | 3,0 | ok |
| Fatia contra o cartão, claro: pesquisa 5,56; sugeridos 6,65; início 5,13; Shorts 8,32; externo 4,43; inscritos cheia 4,94; contorno do omitido 7,13 | todos | 3,0 | ok |
| Fatia contornada de inscritos (preenchimento) | 1,48:1 escuro, 1,29:1 claro; borda de 2 px `--lado-o` 6,72 e 4,94 | 3,0 pela borda | ok pela borda |
| Ícone sobre a fatia, pior caso | 4,73:1 (externo, claro) | 3,0 | ok |
| Alvo a 390 px: seletor de período, ⓘ, "Tentar de novo" | 44 x 44 | 44 | ok |
| Alvo a 1440 px: seletor de período | 44 de altura | 44 | ok (era 36) |
| Alvo a 1440 px: ⓘ compacto, migalha | 28 x 28, 41 x 20 | convenção do produto (ponteiro fino) | ok pela convenção; migalha é componente aprovado |
| Foco visível, Tab (30 passos) | outline sólido 2 px em todos, ordem visual correta | 2 px | ok |
| Esc fecha o ⓘ e devolve o foco ao botão | sim | sim | ok |
| Hierarquia de títulos | H1, H2, H3 dentro dos grupos, H2 | sem salto | ok |
| `aria-label` dos ⓘ | 6 rótulos corretos | gramática | ok |
| SVG de enfeite sem `aria-hidden` | 0 (o único achado é filho de `<i aria-hidden>`) | 0 | ok |
| `role="alert"` no erro, `role="status"` no carregando | presentes | presentes | ok |
| `color-mix()` na interface | 0 (comentários "sem color-mix" e as 3 ocorrências em `a4.css`/`lote.css`, todas em comentário) | 0 | ok |
| Jargão (lido, gravou, CTR, diário, série, snapshot, payload, pipeline, cron, forja, Cowork) nos 11 estados | 0 | 0 | ok |
| Contas que fecham | origem 826 e 3.640; aparelho, país e inscritos 3.640; magro 14 = 5 + 9, 14 = 4 + 10, 14 = 5 + 9, 14 = 1 + 4 + 9; porcentagens 100 | fecha | ok |
| `aria-label` da barra de origem no magro | "Início e inscrições 0% (0)" e mais três | só o que o YouTube deu | **falha (B1)** |

## O que não consegui verificar

- Leitor de tela real (VoiceOver, NVDA): li só rótulos e papéis no DOM; é como achei o B1, mas não ouvi a leitura.
- Safari e Opera (navegador do dono): só Chromium. Sem `color-mix()`, mas a hachura, o pontilhado e o listrado (`repeating-linear-gradient`, `radial-gradient`) não foram vistos no Opera.
- Toque real: `hasTouch` não liga `pointer: coarse`; os 44 px a 390 px vêm da regra por largura e batem.
- Os cruzamentos 1440 claro e 390 escuro foram medidos em todos os casos; olhados em captura só em típico e magro.
- Dado real: tudo é exemplo; magro e extremo só serão vistos com dado depois da E11.

## Para a rodada 3

Reconferir: B1 (ler o `aria-label` da barra no magro), C7 (tabela lateral nos estados não medido e em revisão), C8 (4.205). O resto fica como está. "Pronto para o dono" sai com zero bloqueio e zero "corrige" aberto.
