# Revisão de UX, rodada 2: mockup 15, página do canal de concorrente

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Escopo: conferir se os 3 bloqueios (B1 a B3) e as 8 correções (C1 a C8) da `REVISAO-UX-r1.md` foram resolvidos e se o ajuste criou defeito novo. Método: Chromium headless sobre `file://` (sem servidor, sem a porta 3099, sem os specs do projeto), 12 estados x (1440 escuro, 390 claro, 1440 claro, 390 escuro) = 48 cruzamentos medidos, mais 1100 px em `extremo`; capturas e texto da tela lidos por estado. Capturas citadas: `shots/r2-*.png`.

## Resumo

**Veredito geral: NÃO PODE ir ao dono nesta rodada. 2 bloqueios novos, 4 correções, 7 melhorias.**

Os 3 bloqueios e as 8 correções da rodada 1 foram resolvidos, todos conferidos na tela (lista na seção seguinte). O desenho está no nível: frase do topo responde a pergunta inteira, `Lançamentos` abre pelo último vídeo, Erro e Fora do ar dizem a data, canal novo diz a cobertura real. O que impede agora são **dois números do bloco Ritmo que contradizem o que está desenhado logo acima deles**, a mesma classe de erro de B2 e B3 da rodada 1, e que o ajuste de r1 não alcançou:

1. **B1.** "Maior buraco" e "O maior intervalo sem publicar" ficam menores que o buraco que está acontecendo agora, e menores que as semanas vazias que a própria grade mostra (zero medido: 27 dias sem publicar contra "maior intervalo: 19 dias").
2. **B2.** Em canal novo, "Semanas com publicação: 4 de 5" conta semanas que a grade desenhou como "—" (não medido); a grade mostra 2 de 5.

As três coisas que mais derrubam o conjunto agora:
1. **Contas do Ritmo que não fecham com as casas** (B1, B2): a grade é a melhor parte do bloco e o resumo embaixo a contradiz.
2. **Contagem de dias de registro com duas convenções na mesma tela** (C1): "26 de 56" e "25 de 112" no mesmo canal.
3. **Um defeito de layout no caso principal a 390 px** (C2): a linha "Vídeos novos, views de hoje" do `magro` comprime o rótulo a 78 px e o texto vira 7 linhas.

## Os bloqueios e correções da rodada 1: conferência

| Item r1 | Resultado | Evidência |
|---|---|---|
| B1 (último vídeo no primeiro olhar) | **Resolvido** | A frase do topo termina com a oração do último vídeo em todos os 12 estados ("ainda não tem normal para comparar", "está perto do normal (1,4× no dia 1)", "saiu hoje e ainda não completou um dia", "Sem leitura do último vídeo: …"). `Lançamentos` abre pelo último: `cheio` seleciona "o mais recente com contagem"; o notável (3,3×) fica na lista e se escolhe por clique (testado: `aria-pressed` troca e a frase muda). `shots/r2-magro-cabecalho-1440-escuro.png`, `shots/r2-cheio-lancamentos-1440-escuro.png`. A resposta está a menos de 200 px do título do canal a 1440 e a cerca de 650 px a 390. |
| B2 (Erro e Fora do ar com "0" e "1 dia") | **Resolvido** | `erro`: duas últimas semanas viram casa "—" hachurada ("não medido: sem leitura desde 04/10"), "5 de 11 semanas com leitura" (conferido: 2+3+1+2+2 = 5 semanas com publicação nas 11 medidas), "0 dias até 04/10". `fora`: "1 dia até 09/10", eixo "semana de 07/10", Shorts da semana parcial em "—". A lista de Lançamentos e o Ritmo deixaram de discordar. |
| B3 (canal novo afirma 28 dias e zeros) | **Resolvido** | `vazio`: "3,39 mil views ganhas em 2 dias de registro (a janela de 28 dias completa em 08/11) … Mudanças de campo e trocas: não medido antes de 12/10" com a pastilha. `nm`: "em 26 dias de registro (… completa em 15/10)" (18/09 + 27 = 15/10, confere). |
| C1 (pastilha sobre a casa) | **Resolvido** | `extremo` a 1440 e a 1100: a pastilha "Em queda sustentada" tem coluna própria, sem sobreposição (`shots` r2 em scratchpad; a 1100 as três casas e a pastilha cabem em uma linha). |
| C2 (ressalva da janela de 24/08 na frase) | **Resolvido** | "(a janela ainda cruza a mudança de contagem de 24/08)" em âmbar na frase, nos 6 estados em que cruza. |
| C3 ("faltam N dias" x data) | **Resolvido para a barra de 56 dias** | `nm` faltam 30 e completa em 12/11 (13/10 + 30); `vazio` faltam 54 e 06/12. Ver C1 desta rodada para a barra de 112 dias. |
| C4 (texto repetido) | **Resolvido** | Frases de erro, fora e canal novo sem o título da faixa; Lançamentos sem curva é uma frase mais a pastilha; "Ativo" só na célula Estado; "Ritmo parcial" sem duplicar. Em `fora` a pastilha na faixa e na célula é aceitável (aviso e estado), como o desenhista declarou. |
| C5 (gráfico vazio de 250 px) | **Resolvido** | `nm`, `zero`, `erro`: cartão de uma linha com a pastilha e a data; sem as 8 casas. `magro`: gráfico mantido e a legenda não promete "o normal do canal". |
| C6 (palavra proibida) | **Resolvido** | `grep` no texto renderizado dos 12 estados: zero ocorrências de lido/lida, gravou, diário, série, retenção, snapshot, mediana (a palavra só existe dentro dos ⓘ). "as mesmas views que" correto. |
| C7 (fala de mockup na tela) | **Resolvido** | A caixa saiu da tela; está na "Referência do mockup (não faz parte da tela)". |
| C8 (○ com duas regras) | **Resolvido** | O fracasso do Acerto é ×; a legenda "◆ 2× ou mais · ● no meio · × 0,5× ou menos" está na referência e no ⓘ. |

## Pergunta do usuário

**"Este canal está subindo, parado ou caindo, e o último vídeo dele foi acima do normal?"** Respondida no primeiro olhar, sem rolar, nos 12 estados: ▲ ▼ ＝ ou pastilha de estado na frase do topo, a mesma frase termina no último vídeo, e as seis células embaixo repetem a direção, o estado, o acerto, o ritmo e o criador em símbolo e número. Passa.

## Veredito por estado e por largura

"Pronto" aqui vale para o que o estado mostra; o conserto de B1 mexe em código compartilhado por todos (a conta do "maior buraco") e precisa ser reconferido em todos antes de a tela ir ao dono.

| Estado | 1440 escuro | 390 claro | Veredito | Achados próprios |
|---|---|---|---|---|
| magro (padrão, caso real) | ok | **defeito de layout (C2)** | volta para ajuste | B1 (3 semanas vazias de longos contra "17 dias"), C2 |
| cheio (simulação) | ok | ok | pronto para o dono | só melhorias (M2, M3) |
| extremo | ok (C1 resolvido) | ok | pronto para o dono | nenhum |
| parado | contradição | contradição | volta para ajuste | **B1** (64 dias sem publicar contra "maior intervalo: 22 dias") |
| zero medido | contradição | contradição | volta para ajuste | **B1** (27 dias contra 19), C4 |
| não medido | ok | ok | volta para ajuste | C1 (26 de 56 contra 25 de 112) |
| erro | ok | ok | pronto para o dono | nenhum |
| sem dado (recém-cadastrado) | contradição | contradição | volta para ajuste | **B2** (4 de 5 contra 2 de 5), C1, C3 |
| fora do ar | ok | ok | pronto para o dono | nenhum |
| só Shorts | ok | ok | pronto para o dono | nenhum |
| nichos diferentes | ok | ok | pronto para o dono | nenhum |
| só leitura | ok | ok | pronto para o dono | nenhum |

Resumo: 7 estados prontos, 5 voltam para ajuste, 0 reprovados. Tema claro a 1440 e escuro a 390 foram medidos (rolagem, alvos, contraste) e não mudam o veredito.

## Bloqueios (impedem ir ao dono)

### B1. "Maior buraco" e "o maior intervalo sem publicar" são menores que o buraco que está acontecendo
- **Tela/estado:** Ritmo e regularidade, `zero`, `parado` (e `magro` por ambiguidade). `shots/r2-zero-ritmo-1440-escuro.png`, `shots/r2-magro-ritmo-1440-escuro.png`.
- **O que está errado:**
  - `zero`: o cartão "Dias desde o último vídeo" diz **27 dias**, a grade de Longos termina com 3 semanas em zero, e a frase e o cartão dizem "O maior intervalo sem publicar, em 26 semanas, foi de **19 dias**" (17/08 a 05/09). O buraco de agora (27) é maior que o "maior" (19).
  - `parado`: 64 dias sem publicar contra "maior intervalo … 22 dias". Mesma contradição, mais extrema, no estado cujo assunto é justamente o buraco.
  - `magro`: a grade de Longos mostra 3 semanas seguidas em zero (pelo menos 22 dias entre dois longos) e o texto diz "17 dias". A causa é que `pc-dados.js` (linhas 134 a 137) calcula o buraco com `todas`, que mistura longos e Shorts, enquanto a frase abre com "Publica 0,9 vídeos longos por semana" e a grade principal é de Longos. Quem lê a grade e depois o número vê dois fatos que não fecham.
  - Pelo código, o buraco só mede o intervalo entre duas publicações já feitas; o intervalo em aberto (do último vídeo até hoje, ou até a última leitura) nunca entra.
- **Conserto exato:** (a) o "maior buraco" passa a ser o maior entre os intervalos fechados e o intervalo em aberto (`desde`), então `zero` mostra 27 dias "até hoje, ainda aberto" e `parado` 64; quando o maior é o que está aberto, a data fica "10/08 até hoje". (b) Dizer o formato: na frase "O maior intervalo sem publicar um longo, em 26 semanas, foi de N dias" e no cartão "Maior buraco entre longos (26 semanas)"; a conta usa só o formato principal (`P`, não `todas`), a mesma base da grade e do "Intervalo típico". Em `shorts` o formato é Short. (c) Reconferir os 12 estados: nenhum "maior buraco" pode ser menor que "Dias desde o último vídeo" nem que a maior sequência de semanas em zero da grade vezes 7.

### B2. Canal novo: "Semanas com publicação: 4 de 5" conta semanas que a grade desenhou como não medidas
- **Tela/estado:** Ritmo, `vazio`, 1440 e 390. `shots/r2-vazio-ritmo-1440-escuro.png`.
- **O que está errado:** a grade de Longos tem 8 casas "—" (não buscada) e 5 casas medidas: 2, 0, 0, 0, 2. Só 2 das 5 têm publicação. O cartão diz **"4 de 5 semanas com leitura"**. A causa em `pc-dados.js` linha 142: `semCom = wl.filter(x > 0).length` roda sobre as 13 semanas, inclusive as 8 "não medidas", mas o denominador `semMed` já as tira. É a regra que o próprio `NOTAS.md` (decisão 9) escreve, "sai da conta", falhando justamente onde ela nasceu. Pior: o número vem de semanas que a tela esconde sob hachura.
- **Conserto exato:** `semCom` conta só as semanas medidas (`idx` onde `nmL[idx]` é falso). Vale também para a taxa "por semana" (`np` soma as 13 semanas e divide por `semMed`): somar só as medidas. Conferir em `erro` e `fora`, onde a regra já funciona por acaso (semanas "—" sem publicação não somam nada).

## Correções (vão ao dono só depois de corrigidas)

### C1. Duas convenções de contagem de dias de registro na mesma tela
- **Tela/estado:** `nm` (e `vazio`), bloco Direção. `shots/r2-nm-direcao-1440-escuro.png`.
- **Evidência:** `nm`: "Views do canal inteiro: **26 de 56 dias**" e, três linhas abaixo, "Queda sustentada: **25 de 112 dias** desde a mudança de contagem de 24/08; a primeira leitura limpa é em 08/01/2027". Mesmo canal, mesmo início de registro (18/09): 26 e 25. `vazio`: "2 de 56" e "1 de 112". A barra de 56 dias conta com hoje dentro e termina no dia 56 (início + 55, o conserto de C3 da rodada 1); a de 112 e a de 180 contam dias passados e terminam em início + 112. Além disso o texto diz "desde a mudança de contagem de 24/08" para canais cadastrados depois dessa data (18/09 e 12/10), o que é falso: o registro começa no cadastro.
- **Conserto:** usar a mesma regra nas três barras (hoje dentro; data = início + 55, 111, 179), o que dá 26 de 112 e 07/01/2027 em `nm`, 2 de 112 e 31/01/2027 em `vazio`; e trocar o texto para "desde 18/09, o cadastro do canal" quando o início for o cadastro, mantendo "desde a mudança de contagem de 24/08" só quando o canal já existia nessa data.

### C2. 390 px, `magro`: a linha "Vídeos novos, views de hoje" espreme o rótulo a 78 px
- **Tela/estado:** `magro`, bloco Direção, 390 px (o caso real e o padrão). `shots/r2-magro-direcao-390-claro.png`.
- **Evidência:** medi o rótulo de cada linha de Direção nos 6 estados mais carregados: 214 a 240 px em todos, menos `magro`, onde a linha 2 mede **78 x 188 px**. O texto "ou menos, fora da escala" ao lado do valor "−50%" ocupa a coluna da direita e o rótulo ("Vídeos novos, views de hoje" mais a descrição) quebra em 4 e 7 linhas. É o único ponto da tela em que o 390 px parece quebrado.
- **Conserto:** a legenda "ou menos, fora da escala" sai da coluna do valor e vai para a linha de baixo, junto de "19,0 mil contra 38,3 mil views", ou a coluna do valor ganha `max-width` de 96 px com a legenda abaixo do número; o rótulo volta a 200 px ou mais.

### C3. `vazio`: unidade errada no `aria-label` e "1 dias"
- **Evidência:** `role="img"` da barra de busca: "vídeos buscados: **12 de 48 dias**" (são vídeos). `role="img"` do Ritmo: "**1 dias** sem publicar" (o texto visível diz "1 dia" certo).
- **Conserto:** "12 de 48 vídeos"; usar o mesmo singular/plural do texto visível no `aria-label` do Ritmo.

### C4. `zero`: "1 mudança de campo e trocas" + pastilha cai para a linha seguinte
- **Evidência:** a frase da Linha do tempo diz "Nesse tempo: 1 publicação, 1 mudança de campo e trocas" e a pastilha "não medido antes de 03/10" cai na linha de baixo, deixando o ponto final sozinho. Lê-se como "trocas" sendo algo que aconteceu.
- **Conserto:** "…1 mudança de campo. Trocas: [não medido antes de 03/10]." (mesma forma de `vazio`, que fica clara).

## Melhorias (não bloqueiam)

- **M1. "Ainda cruza a mudança de 24/08" dito 3 vezes no `magro`** (frase, célula Direção, bloco Direção). A frase é a que importa; a célula pode ficar só com o ícone ⚠ e "janela ainda não limpa".
- **M2. `cheio`: legenda "menos de 3 vídeos: sem ponto"** aparece embaixo do gráfico sem nenhuma casa hachurada (todos os n ≥ 39). Mostrar a legenda só quando existe a casa.
- **M3. `cheio`: o rótulo "5" da curva do vídeo 5 é cortado pela linha do normal** (x ≈ 1100). Deslocar o rótulo 8 px para cima.
- **M4. "Referência do mockup (não faz parte da tela)" aparece duas vezes seguidas** (linha do `summary` e `h2`). Tirar uma.
- **M5. 390 px, `magro`: a faixa hachurada "sem normal: faltam vídeos" corta o fim do texto** ("…na mesma idade") por falta de largura. Encurtar para "sem a linha do normal" a 390 px.
- **M6. 8 casas "dia N, n 0" em hachura no `magro` e no `vazio`:** o fim da fileira (n 0) repete o aviso das primeiras casas. Podem ser cortadas depois do último dia com n maior que zero. Não bloqueia: o que mostram é verdade.
- **M7. `vazio`: "Dias desde o último vídeo: 1 dia"** vale só pelo que já foi buscado (12 de 48). Acrescentar "pelo que já foi buscado" na dica, já que o canal ainda está buscando vídeos. S3 da rodada 1 (agrupar a raia de publicações a 390 px) segue em aberto, declarado pelo desenhista.

## Tabela de medidas

| Medida | Resultado | Método |
|---|---|---|
| Textos medidos | 26.420 (4 combinações de largura e tema x 12 estados) | cor lida do estilo, composta sobre os fundos com alfa |
| Contraste de texto, menor | 4,96:1 escuro ("janela atual", 12 px, `extremo`); 4,86:1 claro ("▼ −34%", 14 px, `extremo`) | exigido 4,5:1; **passa**, 0 textos abaixo |
| Elementos gráficos | barras, curvas, marcadores, bordas de zero medido e de hachura acima de 3:1 nos dois temas; abaixo de 3:1 só linhas de grade (1,25 a 1,27:1, decoração) e halos de texto na cor do fundo | exigido 3:1 |
| Rolagem horizontal | 0 px nos 48 cruzamentos | `scrollWidth - clientWidth` |
| Texto menor que 12 px | 0 | `font-size` computado |
| Alvos abaixo de 44 x 44 px a 390 px | 0 na tela; só os botões da barra "Estados do mockup" (32 px), que ficam fora da tela simulada | `getBoundingClientRect` em `button, a, summary, [tabindex]` |
| Alvos a 1440 | ⓘ, "Mais números", "Ver como tabela", dia anterior/seguinte e lista de vídeos: 44 px ou mais; botões e atalhos 34 e 36 px (ponteiro fino, aceito na rodada 1) | idem |
| Foco | 2 px sólido `#FF8240` em 69 de 69 paradas de Tab, em `cheio` e em `erro`; ordem: cabeçalho, ⓘ, "Mais números", atalhos, Direção, vídeos, Linha do tempo (área focável), dia anterior/seguinte, tabela, Ritmo, Criador | Tab real |
| Esc | fecha o ⓘ (`aria-expanded` volta a `false`) e devolve o foco ao botão, em `cheio` e em `erro` | teclado real |
| Setas na Linha do tempo | leem o dia ("ter 11/05: 180.235 views ganhas. Publicou o vídeo “…”.") | teclado real |
| Estrutura | 1 `h1`, `h2` por bloco, `h3` só nos ⓘ e em "Primeiras 72 horas"; `role="img"` com `aria-label` por extenso em todos os desenhos (com C3 de unidade); `role="alert"` na faixa de erro; 0 botões sem nome | DOM |
| `color-mix()` | 0 no CSS e no JS que carregam interface; 5 ocorrências em comentários dizendo "sem color-mix()" (`a4.css`, `lote.css`, `pc.css`, `pc.js`) | `grep` |
| Sobreposição pastilha x casa (C1 de r1) | 0 px a 1100 e a 1440 | captura e retângulos |
| Jargão na tela | 0 ocorrências de lido, gravou, diário, série, retenção, snapshot, mediana, payload | texto renderizado dos 12 estados |
| Frase-resumo, régua/barra, cor+símbolo, ⓘ | presentes nos 5 blocos; "zero medido" (caixa vazada com 0) e "não medido" (hachura rosa com "—" ou pastilha) distintos; em escala de cinza o "—" separa a casa não medida da casa de zero | capturas |
| Contas conferidas | `erro`: 5 de 11 semanas (2+3+1+2+2); `magro`: 0,9 por semana = 12 longos em 13 semanas, 6 semanas com publicação; datas de 56 dias (nm 12/11, vazio 06/12) e janela de 28 dias (vazio 08/11, nm 15/10); +12%, +7% e +18% conferem com as views mostradas | cálculo manual sobre o texto e a grade |

## Pedidos do dono: cobertura

| Pedido | Situação |
|---|---|
| Frase-resumo no topo | sim, em cada bloco |
| Régua ou barra | sim |
| Cor estável por significado, inclusive "não medido" | sim (rosa hachurado só para dado que não veio) |
| Símbolo junto da cor | sim |
| Método no botão de informação | sim; prosa na tela só em "parado depois de N dias" (uma linha, aceita) |
| Zero medido distinto de não medido | sim no desenho; **falha de conta em B2** (semana não medida entra no "com publicação") |
| Nada de prosa nem bloco monocromático | sim |
| Frases sem jargão | sim |
| Nenhuma frase afirma mais do que o dado sustenta | **falha em B1** ("maior" menor que o atual) |
| Todos os estados | 12 desenhados; "carregando" não existe (tela estática, declarado em r1) |
| 390 px, 44 px, tema claro e escuro | passam, com C2 de layout |
| `color-mix()` | ausente |
| Coerência com o lote 1 | sim (tokens, faixa de erro da tela C, pastilha tracejada da tela E, ＝ neutro, âmbar de direção) |

## O que NÃO consegui verificar
- Leitor de tela (VoiceOver, NVDA): li só os `aria-label` e a estrutura de títulos no DOM.
- Safari, Firefox e Opera (o navegador do dono renderiza `color-mix()` transparente; confirmei só a ausência no código). Só Chromium.
- Toque real em aparelho: simulei `hasTouch` com viewport de 390 px e medi os alvos (a regra de 44 px do CSS é por largura, não por `pointer: coarse`).
- Fontes do Google (Fraunces, Inter, JetBrains Mono): bloqueadas na medição; quebras de linha e larguras com as fontes reais podem variar alguns pixels (o risco está em C2 e na pastilha da queda).
- Contraste do texto "não medido" sobre a hachura: medi sobre o fundo plano; a hachura reduz um pouco o contraste real. Nas capturas o texto se lê em 1440 e em 390.
- Os estados `cheio`, `extremo`, `nichos`, `leitura` e `shorts` não tiveram o "maior buraco" conferido contra a grade semana a semana (só `magro`, `zero`, `parado`, `erro`, `fora`, `vazio`); o conserto de B1 pede essa conferência nos 12.
- Série simulada contra a definição de M2, M3 e M6 do spec linha a linha: conferi só as contas citadas na tabela de medidas.
- Rolagem fina do popover em tela pequena com teclado virtual.

## Para quem desenhou
Devolve para a rodada 3 com B1, B2 e C1 a C4 resolvidos. A reconferência é rápida: abro `?caso=zero`, `parado`, `magro`, `vazio`, `nm` em 1440 escuro e 390 claro, e passo uma regra de fechamento em cada estado (maior buraco ≥ dias desde o último vídeo; "N de M semanas" só com semanas medidas; barras de 56, 112 e 180 dias com a mesma regra). As melhorias M1 a M7 ficam para o dono decidir. Se discordar de B1 por achar que "maior buraco" deve mostrar só intervalos fechados, responda com a frase que deixaria a tela sem a contradição entre "27 dias sem publicar" e "maior intervalo, 19 dias", e eu mantenho ou retiro por escrito.
