# Revisão de UX, rodada 1: mockup 15, página do canal de concorrente

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Material: `PLANO.md`, `NOTAS.md`, `index.html`, `pc.css`, `pc.js`, `pc-dados.js`, as 24 capturas de `shots/` (olhadas por amostra) e capturas e medições próprias (Chromium headless sobre `file://`, sem servidor, sem a porta 3099, sem os specs do projeto; 12 estados x 1440/390 x escuro/claro = 48 cruzamentos medidos). Capturas desta rodada: `shots/r1-*.png`.

Numeração: confirmei que este é o mockup 15 da tabela 6.5b (página do canal). A tela D do lote 1 (aviso de atraso) é outra coisa e não foi tocada.

## Resumo

**Veredito geral: volta para ajuste. Não vai ao dono nesta rodada.** 12 estados avaliados: **0 prontos para o dono, 12 voltam para ajuste, 0 reprovados.** Nada está reprovado porque a base é boa (números que fecham, cor e símbolo no lugar, método nos ⓘ, contraste, foco, 44 px). O que impede são 3 bloqueios e 8 correções, listados abaixo. A maioria é de redação e de uma regra de "não medido" que falta aplicar em três estados.

Bloqueios (cada um quebra uma regra dura do dono):
1. **B1.** A pergunta de 3 segundos do próprio PLANO ("o último vídeo foi acima do normal?") não é respondida no cabeçalho, e Lançamentos abre pelo vídeo mais notável, não pelo último.
2. **B2.** Em Erro e Fora do ar, o Ritmo diz "0 dias" / "1 dia" e "esta semana" para um canal que não é lido há dias (contradiz a lista de Lançamentos na mesma tela) e põe "0" em semana que nunca foi medida.
3. **B3.** Na Linha do tempo de canal novo, a frase afirma "3,39 mil views ganhas em 28 dias" com 2 dias de registro e "0 mudanças de campo e 0 trocas" onde nada foi medido (zero onde o dado não existe).

As três coisas que mais derrubam o conjunto:
1. **Zero e janela dizendo mais do que a leitura cobre** (B2, B3): a data do último dado não chega às frases e às casas de Erro, Fora do ar e canal novo.
2. **Texto que se repete** (C4): o mesmo fato escrito 3 vezes no mesmo bloco em 6 estados; em canal sem dado a tela vira "não medido" em pílula, em faixa e em frase.
3. **A resposta de relance está longe do primeiro olhar** (B1): a segunda metade da pergunta mora a 1.500 px (1440) e a 2.600 px (390) do topo.

O que está certo e deve ser preservado: contraste de texto mínimo 4,86:1 em 26.808 textos medidos; elementos gráficos acima de 3:1 (salvo decoração); zero rolagem horizontal; zero alvo abaixo de 44 px a 390 px; zero texto abaixo de 12 px; zero `color-mix()` na interface; foco de 2 px em tudo que foca; `aria` com texto por extenso nos desenhos; Esc fecha o ⓘ e devolve o foco; setas leem o dia da linha do tempo; as contas do Ritmo fecham com as casas (0,9 por semana = 12 vídeos em 13 semanas; 6 semanas com publicação).

## Pergunta do usuário e veredito por estado

Pergunta do dono ao abrir um concorrente (a do PLANO): **"este canal está subindo, parado ou caindo, e o último vídeo dele foi acima do normal?"** Primeira metade: respondida no primeiro olhar (frase com ▲ ▼ ＝, pastilha de estado, célula Direção). Segunda metade: **não respondida de relance** (B1).

| Estado | 1440 escuro | 390 claro | Veredito | Achados que pesam |
|---|---|---|---|---|
| magro (padrão, o caso real) | ok com ressalvas | ok com ressalvas | volta para ajuste | B1, C2, C5, C7 |
| cheio (simulação) | ok | ok | volta para ajuste | B1, C9 |
| extremo | defeito visível | ok | volta para ajuste | C1, B1 |
| parado | ok | ok | volta para ajuste | B1, C2 |
| zero medido | ok | ok | volta para ajuste | C2, C5, C6 |
| não medido | repetição | repetição | volta para ajuste | B3, C3, C4, C5, C6 |
| erro | contradição | contradição | volta para ajuste | **B2**, C4 |
| sem dado (recém-cadastrado) | afirma o que não mediu | idem | volta para ajuste | **B3**, C3, C4, C6 |
| fora do ar | contradição | contradição | volta para ajuste | **B2**, C4 |
| só Shorts | ok | ok | volta para ajuste | B1, C2 |
| nichos diferentes | ok | ok | volta para ajuste | B1 |
| só leitura | ok | ok | volta para ajuste | B1 |

Nenhum estado fica "pronto" porque B1 vale para todos (é do cabeçalho).

## Bloqueios (impedem ir ao dono)

### B1. A segunda metade da pergunta de 3 segundos não está à vista
- **Tela/estado:** todos; mais claro em `cheio` (`shots/r1-cheio-lancamentos-1440-escuro.png`).
- **O que está errado:** o PLANO promete que "o último vídeo foi acima do normal?" é respondido "no cabeçalho, em uma frase e em seis células, sem rolar". O cabeçalho só tem "acertou 2 de 20 vídeos recentes" (janela de 90 dias, não é o último vídeo). A resposta mora em Lançamentos, que começa a cerca de 1.500 px do topo a 1440 e a cerca de 2.600 px a 390 (medido nas capturas). Pior: Lançamentos abre pelo primeiro vídeo "acima do normal" (`pc.js` linha 180, `ESC_V`), não pelo último. No `cheio` a frase de Lançamentos diz "“Os erros que todo mochileiro comete…” saiu acima do normal já no dia 1: 3,3× o normal" (vídeo 2, de 7 dias atrás), enquanto o vídeo mais novo, "Mochilão pelo Vietnã", está "perto do normal" (1,4× no dia 1). Quem lê só os títulos conclui "o canal acaba de acertar" e o último vídeo não acertou.
- **Conserto exato:** (a) a frase do topo ganha uma segunda oração fixa sobre o último vídeo, com a mesma regra de faixa de Lançamentos: "O último vídeo, “Mochilão pelo Vietnã”, está perto do normal (1,4× no dia 1)." Em `magro`: "O último vídeo (ontem) ainda não tem normal para comparar: faltam vídeos medidos na mesma idade." Em `erro`, `fora`, `vazio`, `nm`: "Sem leitura do último vídeo" com o motivo. (b) Lançamentos abre sempre pelo último vídeo (`ESC_V = 0`); a mudança de vídeo continua por clique. O vídeo notável fica na lista com seu selo "muito acima do normal".

### B2. Erro e Fora do ar: o Ritmo fala de "hoje" para um canal que não é lido
- **Tela/estado:** `erro` e `fora`, 1440 e 390 (`shots/r1-erro-ritmo-1440-escuro.png`, `shots/r1-fora-ritmo-1440-escuro.png`).
- **O que está errado:**
  - `erro` (sem leitura desde 04/10): o bloco "Dias desde o último vídeo" diz **"0 dias"** e a grade termina em "esta semana", com 4 semanas seguidas de **"0" em caixa vazada (zero medido)**, duas delas (05/10 em diante) nunca lidas. A frase de Ritmo ainda diz "publicou em 5 de 13 semanas". É zero onde o dado não chegou, no estado em que o sistema falha em verde. A Linha do tempo da mesma tela faz o certo (faixa hachurada "sem leitura" de 04/10 a 13/10); o Ritmo não segue.
  - `fora` (saiu em 09/10): "Dias desde o último vídeo" diz **"1 dia"**, enquanto a lista de Lançamentos da mesma tela diz "publicado há 5 dias" (cálculo feito até a data da última leitura, sem avisar; `pc-dados.js` linha 138, `A.dias(ultAny, fim)`).
- **Conserto exato:** quando houver `fim` anterior a hoje, (a) as semanas que começam depois de `fim` viram casa hachurada (não medido) com o rótulo "sem leitura desde 04/10"; (b) o número de "Dias desde o último vídeo" ganha o complemento "até 04/10" (ou "até 09/10") e o `aria-label` idem; o texto e o título de cada casa dizem a semana; (c) "esta semana" no eixo vira "semana de 05/10" quando a leitura parou; (d) a frase de Ritmo e "Semanas com publicação" contam só as semanas medidas ("5 de 11 semanas lidas" em português simples: "5 de 11 semanas com leitura").

### B3. Canal novo: a Linha do tempo afirma janela e zeros que não existem
- **Tela/estado:** `vazio` (`shots/r1-vazio-linha-do-tempo-1440-escuro.png`), em menor grau `nm` (26 de 28 dias).
- **O que está errado:** a frase diz "**3,39 mil views ganhas em 28 dias** … Nesse tempo: 4 publicações, **0 mudanças de campo e 0 trocas**" quando o gráfico logo abaixo tem 2 barras e uma faixa "ainda sem leitura" de 88 dias. As 3,39 mil views são de 2 dias, não de 28. "0 mudanças e 0 trocas" é zero onde só há 2 dias de registro: deveria ser "não medido". É a mesma classe de erro que o lote 1 pagou ("frase de afirmação forte contradita por outro número").
- **Conserto exato:** quando o registro cobre menos de 28 dias, a frase diz a cobertura real: "3,39 mil views ganhas em 2 dias de registro (a janela de 28 dias completa em 09/11)." e "Mudanças de campo e trocas: não medido antes de 12/10" com a pastilha de "não medido" no lugar dos dois zeros. Mesma regra em `nm` (26 dias: "em 26 dias de registro").

## Correções (vão ao dono só depois de corrigidas)

### C1. Pastilha "Em queda sustentada" por cima da casa "antes dela"
- **Tela/estado:** `extremo`, 1440 (e 1100). `shots/r1-extremo-sobreposicao-1440-escuro.png`.
- **Evidência:** a casa "antes dela" termina em x=1243 e a pastilha começa em x=1221 (22 px de sobreposição; mesma coisa a 1100, 881 contra 903). A pastilha mede 170 px dentro de um contêiner `.pc-dv` de 128 px. A 390 não ocorre.
- **Conserto:** dar à pastilha a largura do conteúdo com `margin-left:auto` e `flex:none`, e reservar a coluna (grade `1fr auto`); ou quebrar a pastilha em duas linhas como a célula Estado já faz.

### C2. A frase do topo diz "Subindo +12%" sem a ressalva da janela que cruza 24/08
- **Tela/estado:** `magro`, `parado`, `zero`, `erro`, `fora`, `shorts` (6 de 12 estados). `shots/r1-magro-cabecalho-1440-escuro.png`.
- **Evidência:** a ressalva existe só na célula Direção (12 px, âmbar) e no bloco Direção. A frase de 17 px com ▲ verde afirma a direção como fato. Até 19/10 os 28 dias anteriores cruzam a mudança de contagem do YouTube; a frase afirma mais do que o dado sustenta.
- **Conserto:** acrescentar ao fim da frase, só quando `cruza`: " (a janela ainda cruza a mudança de contagem de 24/08)". Cor da ressalva fica como está (âmbar de atenção, não de direção).

### C3. "Faltam N dias" e a data não batem (um dia de diferença)
- **Tela/estado:** `nm` e `vazio`, célula Direção, frase do topo, bloco Direção, barra de progresso.
- **Evidência:** `nm`: "faltam 30 dias de registro (completa em 13/11)"; hoje é 13/10, 13/10 + 30 = 12/11. `vazio`: "faltam 54 dias … passa a existir em 07/12/2026"; 13/10 + 54 = 06/12. A causa está em `pc-dados.js` linha 100-101: `dias = dre + 1` (contagem que inclui hoje) e `quando = regDesde + 56` (conta sem incluir). A barra de 112 e a de 180 dias estão certas (24/08 + 50 = 13/10).
- **Conserto:** `quando = A.addDias(c.regDesde, 55)` (o dia 56 de registro), mantendo "faltam 56 − dias".

### C4. Texto repetido (o mesmo fato dito 3 vezes no mesmo bloco)
| Onde | Repetição (texto exato) | Conserto |
|---|---|---|
| `erro` cabeçalho | faixa "Em erro há 9 dias" + pastilha "Em erro há 9 dias" sob o nome + frase "Em erro há 9 dias. Os números abaixo são de 04/10…" | a frase deixa de repetir o título: "Os números abaixo são de 04/10, a última leitura que deu certo." |
| `fora` cabeçalho | faixa "Saiu do YouTube em 09/10" + pastilha igual + frase "Saiu do YouTube em 09/10…" | frase: "Os números valem até 09/10; o YouTube não diz o motivo." |
| `vazio` cabeçalho | faixa "Primeira busca em andamento: 12 de 48" + pastilha + frase "Canal novo na lista. A primeira busca trouxe 12 de 48…" | a faixa fica com a barra; a frase fica só com o que ela acrescenta: "Canal novo na lista: os números aparecem aos poucos." |
| `nm`, `zero`, `erro`, `vazio` Lançamentos | frase "Nenhum vídeo longo com contagem por vídeo ainda" + pastilha "não medido" + linha "nenhum vídeo com contagem por vídeo ainda" | uma frase só + a pastilha; apagar a linha duplicada |
| `nm` Criador responde | frase "Os comentários estão desligados pelo canal." + pastilha + "comentários desligados pelo canal" | frase + pastilha; apagar a terceira |
| `vazio` Ritmo | "Ritmo parcial: ritmo parcial: o canal ainda está buscando vídeos…" (a palavra duas vezes) | "Ritmo parcial: o canal ainda está buscando vídeos. As casas mostram o que já foi buscado." |
| Todos os estados ativos | pastilha "Ativo" no título e célula Estado "Ativo" com a mesma pastilha | célula Estado mostra só "último vídeo ontem" com ícone; ou tira a pastilha do título. O dono escolhe (sugestão no fim) |

### C5. Lançamentos sem curva: gráfico vazio de 250 px e rosa demais
- **Tela/estado:** `nm`, `zero`, `erro` (e, em parte, `magro`). `shots/r1-nm-lancamentos-1440-escuro.png`.
- **Evidência:** `nm` e `zero`: o gráfico ocupa 250 px com eixo 0 a 20 e nenhuma curva; a faixa hachurada com texto "sem a linha do normal: faltam vídeos medidos na mesma idade" cola no rótulo "20" do eixo; embaixo, oito casas "dia N n 0" também hachuradas. Em `magro` a legenda mostra "o normal do canal" para uma linha que não existe no gráfico.
- **Conserto:** quando não há curva, trocar o gráfico por um cartão de 56 px com o estado ("Nenhum vídeo longo com contagem por vídeo ainda" + pastilha + data em que aparece) e não desenhar as 8 casas. Quando só falta o normal (`magro`), manter o gráfico e esconder "o normal do canal" da legenda.

### C6. Palavra proibida e gramática
- **Evidência:** a regra 8 de `CONVENCOES.md` proíbe "lido". Aparece em "menos de 3 vídeos com 72 horas **lidas**. Precisa de 3 vídeos com 72 horas **lidas** (hoje 1)" em `nm`, `zero`, `erro`, `vazio`, `fora`, `shorts`. A frase do topo de `zero` e `nichos`: "ganhou as mesmas views **do que** nos 28 anteriores" (em português é "as mesmas views que").
- **Conserto:** "menos de 3 vídeos com as 72 primeiras horas acompanhadas (hoje 1)"; e "ganhou quase as mesmas views que nos 28 anteriores" (+4%) / "as mesmas views que" (0%).

### C7. Fala de mockup dentro da tela
- **Evidência:** a caixa tracejada no pé de todos os estados: "Vídeos do canal continuam logo abaixo, como já existem na página aprovada em 07/10: abas, filtros e lista de vídeos. Este mockup não os redesenha." É prosa de bastidor na tela simulada.
- **Conserto:** levar para a área "Referência do mockup (não faz parte da tela)" (`aside.fora`); na tela fica só um separador "Vídeos do canal" se for preciso.

### C8. O mesmo símbolo ○ com duas regras diferentes
- **Evidência:** na célula Acerto, "○" é fracasso (múltiplo ≤ 0,5×, M4) e o `aria-label` diz "N fracassos"; nenhuma legenda na tela explica os pontos. Em Lançamentos, "○" é "abaixo de dois terços" (ⓘ do bloco, linha 209 de `pc.js`). O dono vê o mesmo círculo vazado e não sabe qual regra vale.
- **Conserto:** usar na célula Acerto um símbolo próprio de fracasso (por exemplo "×" ou ▽) e uma legenda de uma linha no ⓘ da faixa ("◆ 2× ou mais · ● no meio · × 0,5× ou menos"); manter ○ só para "abaixo do normal" em Lançamentos.

## Sugestões (não bloqueiam)

- **S1. Cor de laranja para views do canal de terceiro.** As barras de views da Linha do tempo e do Ritmo usam `--lado-o` e o selo "criador" usa `--accent`, que na tabela de tokens significam "o canal do dono". Foi herdado do componente aprovado (`.ic`), mas nesta tela o canal é de outro. Decidir uma cor de "views de concorrente" ou declarar a exceção em `NOTAS.md`.
- **S2. Régua com valor fora da escala.** "Vídeos novos, views de hoje" mostra −50,4% preso na borda; mostrar a ponta como "◀ −50% ou menos".
- **S3. Raia de publicações a 390 px** vira borrão de pontos (17 publicações viram 5 blocos); mostrar a contagem da semana ou agrupar.
- **S4. Eixo da Linha do tempo no `cheio`** vai a 500 mil com dado até 275 mil: metade da altura vazia. Usar `nice(max × 1,06)` como em Lançamentos.
- **S5. "mediana"** aparece em "mediana dos longos: 90 dias contra os 90 anteriores" e "Intervalo mediano"; trocar por "valor do meio" na tela e deixar "mediana" no ⓘ.
- **S6. Hachura em escala de cinza.** As casas "não medido" do Ritmo (`vazio`) não têm glifo; em cinza a hachura quase some (`shots/r1-cinza-ritmo-e-queda-1440.png`) e a casa lê como "vazia". Pôr um "—" na casa. Continua distinta da casa de zero (caixa de 2 px com "0").
- **S7. Direção em três vereditos numa frase.** O bloco abre com "Subindo +18%… Os vídeos novos estão descendo (−12%)… estão subindo (+30%)": três sentidos numa linha, o que o PLANO queria evitar. Manter a negrita só na primeira e passar as outras duas para as linhas abaixo (já têm régua).
- **S8. Migalha a 390 px com nome longo** (`extremo`) quebra em 3 linhas ("Canais", "› Aventuras…", "Horários em São Paulo"); cortar com reticências.
- **S9. Percentuais sobre os números exibidos.** `cheio`: "5,4 mi contra 4,6 mi" dá +17% pelos números da tela e a tela diz +18%. Provavelmente está certo pelos valores exatos; conferir no código real (lição do lote 1: a soma e a conta fecham pelo que aparece).
- **S10. Pastilha "Em queda sustentada" a 1440 na célula Estado** quebra em duas linhas dentro da pastilha; aceitável, mas a largura da célula pode ceder 20 px.

## Tabela de medidas

| Medida | Resultado | Método |
|---|---|---|
| Textos medidos | 26.808 (48 cruzamentos) | cor lida do estilo, composta sobre os fundos com alfa |
| Contraste de texto, menor | 4,96:1 escuro ("janela atual", 12 px, `extremo`); 4,86:1 claro ("▼ −34%", 14 px, `extremo`) | exigido 4,5:1; **passa** em todos os cruzamentos |
| Texto abaixo de 4,5:1 (3:1 se grande) | 0 | idem |
| Elementos gráficos (curvas, marcadores, barras, bordas de zero e de hachura) | 4,09:1 a 7,7:1; abaixo de 3:1 só halos de texto (1:1, intencional) e o fundo da faixa "sem mudança" (1,22:1, decoração com borda tracejada e rótulos −10%/+10%) | exigido 3:1 |
| Rolagem horizontal | 0 px nos 48 cruzamentos; 0 elementos além da largura a 390 | `scrollWidth - clientWidth` |
| Texto menor que 12 px | 0 | `font-size` computado |
| Alvos abaixo de 44x44 px a 390 px (ponteiro grosso) | 0 nos 12 estados | `getBoundingClientRect` |
| Alvos a 1440 | `.btn` 34 px, chips de navegação 36 px (ponteiro fino, aceitável); ⓘ, "Mais números", "Ver como tabela", Dia anterior/seguinte, lista de vídeos: 44 px ou mais | idem |
| Foco | 2 px sólido `#FF8240` em todos os 45 primeiros Tab; ordem lógica (cabeçalho, ⓘ, "Mais números", navegação, Direção, vídeos, linha do tempo, ritmo, criador) | Tab real no `cheio` |
| Esc | fecha o ⓘ e devolve o foco ao botão | teclado real |
| Setas | leem o dia da linha do tempo ("qua 12/05: 275.194 views ganhas. Publicou o vídeo…") | teclado real |
| Popover a 390 | 366x572 px, dentro da tela, rolável | `getBoundingClientRect` |
| `color-mix()` | 0 no CSS e no JS (3 comentários "sem color-mix") | `grep` |
| Estrutura | 1 `h1`, 5 `h2`, 1 `h3`; 2 `nav`; 5 `section` rotuladas; `role="img"` com `aria-label` por extenso nos desenhos; `aria-pressed` na lista de vídeos; `aria-live` na leitura do dia; `aria-expanded` nos ⓘ | DOM |
| Sobreposição pílula x casa (C1) | 22 px a 1440 e 1100 | retângulos |

## Pedidos do dono: cobertura

| Pedido | Situação |
|---|---|
| Frase-resumo no topo | sim em cada bloco; com defeitos em B1, B3, C2, C6 |
| Régua ou barra | sim (réguas de direção, barras de progresso, casas, barra de "parado") |
| Cor estável por significado | sim; exceção declarada em S1 |
| Símbolo junto da cor | sim (▲ ▼ ＝, ícone de pausa, de queda, x, formas dos pontos); falha: C8 (○ com duas regras) |
| Método no ⓘ | sim, com a frase fixa em todos; a única conta escrita em prosa na tela é a regra de "parado" (aceitável, é uma linha) |
| Zero medido distinto de não medido | sim no desenho; **falha de regra em B2 e B3** (zero onde não foi medido) |
| Sem bloco monocromático nem prosa | sim; repetição em C4 |
| Sem jargão | falha leve: "lidas" (C6), "mediana" (S5) |
| Estados | 12 desenhados; faltam 2 efeitos: Erro e Fora do ar com Ritmo coerente (B2) e canal novo com janela real (B3). "Carregando" não existe em nenhum estado (a tela é estática) |
| 390 px, 44 px, tema, `color-mix` | passam |
| Coerência com o lote 1 | sim (faixa de erro da tela C, pastilha tracejada da tela E, ＝ neutro, âmbar só de direção, mesmos tokens) |

## O que NÃO consegui verificar
- Leitor de tela (VoiceOver, NVDA): li só os `aria-label` no DOM.
- Safari, Firefox e Opera (o navegador do dono renderiza `color-mix()` transparente; confirmei só a ausência no código). Só Chromium.
- Toque real em aparelho: simulei `hasTouch` e medi alvos.
- As fontes do Google (Fraunces, Inter, JetBrains Mono) ficaram bloqueadas na medição; larguras e quebras com as fontes reais podem variar alguns pixels (o pior risco é a pastilha de C1 e a quebra do título longo de `extremo`).
- Contraste de texto sobre a hachura: medi sobre o fundo plano da pastilha; a hachura reduz um pouco o contraste real do texto "não medido" (olhando as capturas, o rótulo se lê em 1440 e 390).
- Contas do spec além das que conferi (somas do Ritmo, regra de faixas de Lançamentos, regras de data): o `pc-dados.js` calcula tudo de uma série simulada e não verifiquei a série contra a definição de M2 e M3 linha a linha.
- A faixa de 1100 a 1180 px só foi medida em `extremo` (sobreposição de C1).
- Não verifiquei o rolamento fino do popover em tela pequena com teclado virtual.

## Para quem desenhou
Devolve para a rodada 2 com B1 a B3 e C1 a C8 resolvidos. Para cada um que discordar, responda com medida ou captura e eu mantenho ou retiro por escrito. As sugestões podem ficar para o dono decidir. Reconferência: abro `?caso=cheio`, `magro`, `erro`, `fora`, `vazio` e `nm` em 1440 escuro e 390 claro, mais `extremo` a 1100.

Capturas e scripts desta revisão ficam no scratchpad da sessão; as capturas citadas estão em `shots/r1-*.png`.
