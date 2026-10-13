# Revisão de UX, rodada 1: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Material: `PLANO.md`, `NOTAS.md`, `index.html`, `3b.css`, `3b.js`, `3b-dados.js`, as 41 capturas de `shots/` e capturas e medidas próprias (Playwright sobre `file://`, scripts no scratchpad da sessão, nada na porta 3099, nenhum spec do projeto). Navegador fechado ao fim. Nenhum arquivo do mockup foi alterado.

## Veredito

**NÃO PODE ir ao dono: 1 bloqueio.** O resto é conserto pequeno ("corrige") ou sugestão. O desenho dos dois elementos novos está bom: lê de relance, a forma separa os estados em escala de cinza, o contraste passa nos dois temas, o método está no ⓘ, não há `color-mix()`, não há rolagem horizontal, nenhuma fonte abaixo de 12 px e nenhum alvo abaixo de 44 px a 390. O que derruba é um texto que escapa da própria caixa a 390 px, justamente no estado que o spec mais usa (vencedor de teste A/B).

A pergunta do usuário nesta tela: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". Resposta de relance: o colchete "em teste A/B" e o colchete pontilhado "antes do início do registro" respondem "o que esteve no ar e quando" no primeiro gráfico, sem rolar (1440: acima de y 560). A linha "Trocas deste vídeo: título (1) em 03/11, janela cortada; ..." acima dos gráficos responde "se já dá para ler". Passa nos 3 segundos.

| Resumo | Contagem |
|---|---|
| Estados com veredito "volta para ajuste" | 10 de 10 (todos herdam o bloqueio B1 em 390, mas só 2 o exibem: ver abaixo) |
| Estados "pronto para o dono" depois do conserto de B1 e dos "corrige" | a decidir na rodada 2 |
| Bloqueios | 1 |
| Corrige | 5 |
| Sugestões | 7 |

As três coisas que mais derrubam o conjunto:
1. Texto de 346 px dentro de caixa de 304 px nos rótulos "cortada: ..." (B1).
2. Prosa de método e frase repetida onde a regra do dono pede ⓘ ou corte (C2, C3).
3. Colisões de linha pontilhada com rótulo e com outra linha pontilhada, que fazem duas formas distintas parecerem uma (C1, C4).

## Bloqueio

### B1. Texto "cortada: ..." escapa da caixa a 390 px (e piora a 360)

- Telas e estados: `tipico`, `extremo` (e qualquer vídeo com vencedor ou restauro de teste A/B), 390 px, os dois temas. Capturas: `shots/index-caso-tipico-390-claro.png` (bloco "Troca de título", ter 03/11, "Taxa de clique, Antes"), `shots/index-caso-extremo-390-claro.png` (trocas 1, 3 e 5).
- O que está errado: na caixa de "janela cortada" o texto monoespaçado é mais largo que a caixa. A frase "cortada: antes disto o vídeo estava em teste A/B" mostra "co" fora da borda esquerda e "A/B" fora da borda direita; "cortada: um ciclo de teste A/B vem logo depois" perde o "i" sob a barra grossa do lado cortado. Parece defeito de renderização, e é o estado que o spec 7.5.3 faz acontecer em **todo** vencedor e restauro.
- Evidência (medida por `getBBox` nos `<text>` dos `.ctr-svg`): a 390 px o texto mede 346 px (x de -8 a 338) numa caixa de 304 px (x de 10 a 314) e num SVG de 324 px; a segunda frase mede 331 px. A 360 px o primeiro texto sai 23 px para fora do SVG (caixa de 274 px). A 1440 cabe.
- Conserto: encurtar as duas frases do mecanismo (`3b.js` linha 103) para caberem em 270 px no tamanho de fonte atual, por exemplo "cortada: teste A/B antes" e "cortada: teste A/B logo depois" (a explicação completa já está na frase abaixo, "Janela cortada. Antes desta troca o vídeo estava em teste A/B..."), ou quebrar o texto em duas linhas dentro do SVG quando a largura for menor que o texto. Reconferir a 390 e a 360 com `getBBox`: texto dentro de `[caixa.x + 8, caixa.x + caixa.largura - 8]`.

## Corrige (vai ao dono só depois de corrigido)

### C1. A linha pontilhada de 07/10 atravessa o rótulo do colchete "em teste A/B" quando o teste começou antes do registro

- Estado: `so-teste` (o caso real mais provável: teste em andamento desde 03/10), 1440 e 390, nos dois gráficos. Capturas: `shots/index-caso-so-teste-1440-escuro.png`, `shots/index-caso-so-teste-390-claro.png`.
- O que está errado: a linha pontilhada vertical de 07/10 passa por dentro do texto "em teste A/B (em andamento)" (1440) e "teste A/B" (390). O rótulo fica riscado, e os dois elementos novos são justamente os que o dono vai olhar juntos.
- Conserto: a linha de 07/10 para na altura da base do colchete A/B (não sobe até a linha do rótulo) ou o rótulo do A/B ganha fundo da cor do cartão (`--surface`) de 4 px de folga atrás do texto.

### C2. Prosa de método na tela, repetida em cada estado sem número

- Estados: `hoje`, `semnumero`, `tipico`, `extremo`. Exemplos: "Ainda não dá para comparar. O primeiro dia depois da troca chega em 15/10 e a janela de 7 dias fica cheia em 21/10: o YouTube entrega com 2 a 3 dias de atraso. A leitura aparece sozinha." (4 linhas a 390); "Sem antes para comparar. O vídeo foi publicado em 06/10, 2 dias antes da troca, e o dia da publicação não conta. O depois também foi cortado por outra troca." (4 linhas a 390).
- O que está errado: "janela de 7 dias", "2 a 3 dias de atraso" e "o dia da publicação não conta" são método, e o método já está no ⓘ "Como ler antes e depois". A regra do dono é método no ⓘ, não em prosa.
- Conserto: deixar na tela só o que é dado e data: "Ainda não dá para comparar. Primeiro dia depois da troca: 15/10. Janela cheia: 21/10." e "Sem antes para comparar: o vídeo foi publicado em 06/10, 2 dias antes da troca." O resto fica no ⓘ, que já o diz.

### C3. Frase repetida no estado vazio e no estado só-teste

- Estados: `vazio` (1440 e 390) e `so-teste`. Capturas: `shots/index-caso-vazio-1440-escuro.png`, `shots/index-caso-so-teste-390-claro.png`.
- O que está errado: `vazio` diz duas vezes a mesma frase, uma sob a outra: "0 trocas registradas desde 07/10/2026, quando o registro começou." (frase-resumo) e a pastilha "0 trocas registradas" seguida de "desde 07/10/2026, quando o registro começou. Antes dessa data o sistema não sabe se houve troca." Em `so-teste` são três: "0 trocas fora do A/B Lab desde 07/10/2026 e 1 teste A/B em andamento...", depois "0 trocas registradas desde 07/10/2026...", depois "O teste A/B acima não conta.". Texto repetido: cortar.
- Conserto: manter só a frase-resumo e a pastilha de zero (caixa vazada com o 0, que é a forma de "zero medido"); mover "Antes dessa data o sistema não sabe se houve troca" para o ⓘ ou para o colchete pontilhado do gráfico, que já diz isso; apagar "O teste A/B acima não conta" (a frase-resumo já diz).

### C4. Duas linhas pontilhadas verticais a uma barra de distância querem dizer coisas diferentes

- Estado: `semnumero` (vídeo publicado em 06/10, um dia antes do registro), 1440 e 390. Capturas: `shots/index-caso-semnumero-1440-escuro.png` (gráfico de views: linha de "dia da publicação" em 06/10 e borda do colchete do registro em 07/10), `shots/index-caso-semnumero-390-claro.png`.
- O que está errado: "dia da publicação" e "antes do início do registro" usam o mesmo traço pontilhado vertical, 24 px uma da outra. A linha da publicação ainda atravessa o número 5 da barra. O leitor não separa as duas, e a legenda dos dois itens fica em linhas diferentes.
- Conserto: a linha de publicação passa a ter forma própria (traço longo e fino em vez de pontilhado, ou um marcador "▾ publicado" no topo) e para de cruzar o rótulo numérico da barra; a borda do colchete do registro continua pontilhada, que é a convenção do dono para "ainda não existe".

### C5. "Janela cortada" é a leitura da maioria das trocas e a tela não diz a consequência

- Estados: `tipico` (1 de 2), `extremo` (4 de 6). O spec 7.5.3 e 7.5.5 fazem todo vencedor e todo restauro cair em "janela cortada", e é o caso mais comum de quem usa o A/B Lab. Isso é fiel ao spec e as NOTAS (dúvida 2) já o declaram, mas na tela o dono lê quatro "janela cortada" e nenhum número.
- O que está errado: o rótulo "janela cortada" é jargão interno (a regra proíbe palavra do sistema na frase) e não diz a quem lê o que fazer.
- Conserto: trocar o rótulo do chip e da contagem por algo que diga o fato, por exemplo "sem dias para comparar" (a frase de baixo continua explicando a causa); manter a dúvida 2 para o dono, com este número: no `extremo`, 4 de 6 trocas ficam sem leitura por causa disto. Não é bloqueio porque está declarada e o desenho é fiel ao spec.

## Sugestões (não bloqueiam)

- **S1. Régua das versões é um terceiro elemento novo que o dono não pediu.** Ela repete as marcas do gráfico acima (no `hoje`, uma linha com dois losangos a 6 dias de história). Está marcada "+ novo", ocupa 120 px de altura. Opção: manter e perguntar ao dono se quer, ou cortar e deixar só gráfico e lista. Dizer isso na pergunta da NOTAS (hoje ela está nas decisões de desenho, não nas dúvidas).
- **S2. Rótulo do grupo do gráfico não diz que há faixa.** `aria-label` do `.ic-grupo`: "Views do vídeo, dia a dia: 36 dias. Setas andam de dia em dia." A leitura por seta já diz "Neste dia o vídeo estava em teste A/B..." (verificado: dia 24/10 do `tipico` e dia 16/09 do `hoje`), mas quem chega por leitor de tela só descobre andando 13 dias. Acrescentar ao rótulo "Inclui teste A/B de 20/10 a 02/11 e dias anteriores ao registro" quando houver faixa.
- **S3. ⓘ solto numa linha própria a 390 px na faixa reconstruída.** `so-reconstruido`, 390: o ícone das duas formas, o título e o ⓘ ficam em três linhas, com um vão de 24 px acima do ⓘ (captura `shots/index-caso-so-reconstruido-390-claro.png`). Conserto: título e ⓘ na mesma linha (o ⓘ `margin:-12px 0` de `.vb-pre-h .ibtn` tira o ⓘ do fluxo); o ícone de formas ao lado do título.
- **S4. Dois pontos seguidos.** "Teste parado: o original voltou: o teste de 08/11..." (`extremo`): trocar o segundo dois-pontos por vírgula ou ponto.
- **S5. Estado "carregando" não desenhado.** A convenção 13 pede "carregando onde houver". O bloco é derivado na leitura; ou desenhar o esqueleto (régua e colchetes em contorno pontilhado) ou escrever na NOTAS que não há carregamento separado do da tela do vídeo.
- **S6. Só leitura mostra dado do A/B Lab sem o direito de abrir o teste.** `leitura`: o teste ("de 20/10 a 02/11, 5 ciclos, o vencedor foi aplicado em 03/11") continua visível e o link vira "sem acesso ao A/B Lab". Se o dado do teste não é público do canal, a faixa deveria sumir também; deixar como pergunta ao dono nas NOTAS.
- **S7. A 360 px o texto de "Depois: 7 dias (21/10 a 27/10), 24.976 impressões" encosta na borda do SVG** (286 px de texto, 294 de largura útil). Não é largura obrigatória, mas é componente herdado do mockup 3; vale reduzir o texto ao conferir B1.

## Veredito por estado e por largura

Legenda: B1 só aparece em quem tem vencedor ou restauro com "janela cortada" (tipico e extremo) a 390 px. Os demais estados estão corretos em estrutura.

| Estado | 1440 escuro | 390 claro | Cruzamentos (1440 claro, 390 escuro) | Veredito |
|---|---|---|---|---|
| `tipico` (cheio, um mês de registro) | ok; colchete A/B com 5 dentes e fundo; régua; linha do teste; vencedor | B1 (texto escapa da caixa) | idem | volta para ajuste (B1, C2, C5) |
| `hoje` (magro, o caso real) | ok; colchete pontilhado do registro, dois "sem número" diferentes | ok | ok | volta para ajuste (C2) |
| `extremo` (3 testes, 6 trocas, título longo, 118 mil impressões) | ok | B1 em três caixas; tally com 3 chips | idem | volta para ajuste (B1, C5) |
| `semnumero` (os estados sem número num vídeo só) | ok | ok | ok | volta para ajuste (C2, C4) |
| `zero` (zero medido dos dois lados) | ok; caixa vazada com o 0 distinta da hachura e do pontilhado | ok | ok | volta para ajuste (nenhum achado próprio; revalida com o conjunto) |
| `so-teste` (teste em andamento, sem troca) | colisão C1 | colisão C1 | ok | volta para ajuste (C1, C3) |
| `so-reconstruido` (faixa pontilhada das versões) | ok | S3 | ok | volta para ajuste (S3 é só sugestão; revalida com o conjunto) |
| `vazio` | frase repetida | frase repetida | ok | volta para ajuste (C3) |
| `erro` (A/B Lab ilegível, dois dias) | ok; pastilha com borda e ícone na família do erro, texto em `--text`, diz até quando está certo e quando tenta de novo | ok | ok | volta para ajuste (nenhum achado próprio; revalida com o conjunto) |
| `leitura` (sem direito ao número privado) | ok; caixa com cadeado diz o que não vê e por quê | ok | ok | volta para ajuste (S6 é pergunta) |

Nenhum estado é "reprovado": a linguagem do lote 1 está respeitada (tokens, forma de ausência, "+ novo", ⓘ, "exemplo").

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Passa. Acima dos gráficos ("Trocas deste vídeo: ... ") e no bloco ("2 trocas e 1 teste A/B neste vídeo desde 07/10/2026..."). Num `<span>` único. |
| Régua ou barra | Passa: régua das versões (S1: não pedida), faixas e barras de taxa do mockup 3. |
| Cor estável por significado | Passa: nenhum matiz novo; colchete A/B em `--text` com alfa baixo; ausência em `--muted`/`--dim`; hachura rosa só para "não medido". |
| Símbolo junto da cor | Passa: ícone de duas setas no A/B, "?" na hachura, círculo pontilhado, barra de corte, losango/triângulo com número. Em escala de cinza (conferido no 1440 escuro do `semnumero`) a hachura rosa perde a cor mas fica separada pelo "?", pelo contorno cheio e pelo texto. |
| "Zero medido" ≠ "não medido" | Passa: `zero` mostra a caixa vazada com 0 (borda `--im-zero`); `hoje` e `semnumero` mostram a hachura rosa, com ícone e palavra. |
| Método no ⓘ | Passa no bloco e no gráfico (o ⓘ do gráfico ganhou a explicação dos dois colchetes; o da faixa reconstruída existe). Falha parcial: C2. |
| Sem prosa nem bloco monocromático | Falha parcial: C2, C3. Blocos: o colchete A/B tem fundo de 1,28:1 (escuro) e 1,17:1 (claro) contra o cartão, mas é só acompanhamento da linha de 14,5:1 e 15,8:1; não é bloco monocromático. |
| Sem jargão | Falha leve: "janela cortada", "ciclos" (C5). "Hachura rosa" só aparece na legenda fora da tela. |
| Estados desenhados | Todos os quatro do spec 7.5.5 (depois não medido, sem antes, em teste A/B, janela cortada), mais poucas impressões, zero, origem não sabida, vazio, erro, leitura. Falta "carregando" (S5). |
| 390 px sem rolagem horizontal | Passa: `scrollWidth - clientWidth = 0` nos 40 casos (medi de novo). B1 não gera rolagem, mas texto fora da caixa. |
| Alvo de 44 px | Passa: 0 alvos abaixo de 44 em `tipico`, `so-reconstruido`, `extremo` a 390 (`a`, `button`, `summary`, `[tabindex]`), incluindo "Ver o teste" e os ⓘ. |
| Tema escuro e claro | Passa: 1440 escuro e 390 claro vistos e os cruzamentos amostrados. |
| Consistência com o lote 1 | Passa: mesmos tokens, `A.serieDia` com a única mudança declarada (`cfg.faixas`, `cfg.nvTag`), mesma casca. |
| `color-mix()` | Ausente: `grep -rn "color-mix"` só acha comentários "sem color-mix" em `a4.css` (3, 604, 692), `lote.css` (2) e `3b.css` (1). |
| Acessibilidade básica | Passa: `role="img"` com `aria-label` extenso na régua, `role="group"` no gráfico, `role="alert"` no erro, foco visível 2 px `--accent` em todos os alvos de teclado (40 tabs, nenhum sem contorno, só o `<body>`), ordem de foco coerente, leitura por seta diz a faixa do dia. |

## Tabela de medidas

Contraste por cálculo WCAG com os valores de cor lidos da página (`getComputedStyle`), cartão #221E1A (escuro) e #FBF7F0 (claro). Alvo: 4,5:1 texto, 3:1 elemento gráfico.

| Elemento | Escuro | Claro |
|---|---|---|
| Traço do colchete A/B (`.ic-abk`, `--text`) | 14,48:1 | 15,76:1 |
| Rótulo do colchete (`.ic-bkl`, `--text`) | 14,48:1 | 15,76:1 |
| Fundo do colchete A/B contra o cartão (decorativo, não carrega sentido sozinho) | 1,28:1 | 1,17:1 |
| Chip "sem antes" (texto e borda pontilhada, `--muted`) | 6,92:1 | 6,43:1 |
| Chip "janela cortada" (texto `--muted`; borda `--dim`) | 6,18:1; 4,86:1 | 7,13:1; 5,59:1 |
| Chip "origem não sabida" (texto; borda) | 6,18:1; 4,86:1 | 7,13:1; 5,59:1 |
| Chip "poucas impressões" (texto; borda tracejada) | 6,92:1; 5,44:1 | 6,43:1; 5,04:1 |
| Chip de origem `.vb-orc` (texto `--text`; borda `--dim`) | 14,48:1; 4,86:1 | 15,76:1; 5,59:1 |
| "5 ciclos" `.vb-ciclos` (texto; borda) | 6,18:1; 4,86:1 | 7,13:1; 5,59:1 |
| Texto de apoio `.vb-or` (13 px, `--muted`) | 6,18:1 | 7,13:1 |
| "+ novo" `.vb-nv` e `.c2-tag` (12 px) | 6,42:1 | 9,27:1 |

Tamanhos (medidos):

| Medida | Resultado |
|---|---|
| Rolagem horizontal (40 casos: 10 estados x 4 combinações) | 0 px em todos |
| Texto abaixo de 12 px (390, 3 estados e capturas do projeto) | 0 |
| Alvos abaixo de 44 x 44 a 390 | 0 |
| Texto fora da caixa (SVG `getBBox`), 390 px | 346 px de texto em caixa de 304 px (x de -8 a 338 num SVG de 324); 331 px na outra frase |
| Texto fora da caixa, 360 px (fora do par obrigatório) | 346 px em caixa de 274 px; 23 px para fora do SVG |
| Páginas inteiras (altura) | 1440: 2135 a 5082 px; 390: 3264 a 7193 px |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): conferi só os atributos e o texto da leitura por seta, não a fala.
- Safari, Opera (o navegador do dono) e Firefox: só Chromium. O risco principal está resolvido por construção (nenhum `color-mix`), mas o desenho dos colchetes pontilhados (`stroke-dasharray` de 1,5 e 3,5 px, com `stroke-linecap: round`) não foi visto no Opera.
- Movimento reduzido: o desenho novo não tem animação; não testei.
- Zoom de 200% e fonte do sistema maior: não testados.
- Largura de 360 px só foi medida para texto fora de caixa, não revisada visualmente.
- Mouse sobre o gráfico (dica de dia): usei só o teclado.
- Os estados `zero`, `erro` e `leitura` a 390 escuro e a 1440 claro foram vistos por amostra, não todos os cruzamentos.

## Para a rodada 2

Corrigir B1, C1 a C5 (C5 pode ser só o rótulo e a pergunta ao dono), responder por escrito às sugestões que não aceitar, regenerar as capturas dos estados afetados (`tipico`, `extremo`, `so-teste`, `vazio`, `semnumero`) e `medidas.json`, e juntar uma medida de `getBBox` provando que nenhum texto de SVG sai da caixa a 390 e a 360 px.
