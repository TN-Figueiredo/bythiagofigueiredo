# Revisão de UX, rodada 1: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Arquivos lidos: `PLANO.md`, `NOTAS.md`, `index.html`, `m13.css`, `m13.js`, `m13-graf.js`, `m13-dados.js`, `medidas.json`, `CONVENCOES.md`, spec 04 (linhas 13 a 17, 59 a 75, 84 a 89, 154). Capturas minhas (Chromium headless sobre servidor estático em porta 47745 a 47746, fatias de página sem reduzir) ficam no scratchpad da sessão e não entram no repositório; as 56 capturas do desenhista estão em `shots/` e eu abri as de `cheio`, `recente`, `erro` e `carregando` a 1440 escuro como conferência.

## Resumo

**Veredito do mockup: VOLTA PARA AJUSTE. Não vai ao dono nesta rodada. 4 bloqueios, 10 "corrige", 9 sugestões.**

A estrutura está boa e acima da média do lote: quatro blocos, cada um com uma pergunta; cor estável (azul = este vídeo, areia = normal do canal, verde só para a subida, rosa hachurado = não medido, caixa vazada = zero, pontilhado = ainda não existe); ⓘ com método e a frase fixa em todos os quatro blocos; 14 estados desenhados; sem rolagem horizontal; nenhum alvo abaixo de 44 px a 390; nenhum texto abaixo de 12 px (nem no SVG, que a 390 está em escala 1:1); `grep color-mix` só acha comentários "sem color-mix". O que derruba é pequeno e concreto: três contas ou frases que não batem com o que o desenho mostra e uma frase de erro que afirma mais do que a tela sabe.

As três coisas que mais derrubam a qualidade:
1. **Texto calculado que contradiz o desenho** (três lugares: "47 das 72 horas" contra 67 medidas; "1 dos 8 pontos" com 10 desenhados; "perto do normal o normal"). É o mesmo erro que o lote 1 pagou como "bloqueia": conta sobre o que NÃO aparece.
2. **Linhas de mudança e de metade das views atravessam números e datas** nos gráficos (rótulo de valor, eixo de datas, "300 em 1 hora"), em todos os estados com mudança.
3. **O zero medido do gráfico por dia não tem o "0"** que a regra do dono e a `NOTAS.md` (item 16) prometem, e a segunda metade da pergunta do dono (algo mudou antes de subir?) só é respondida no fim da página.

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**

- 1440, escuro, `cheio`: a primeira metade responde em 3 s. A frase-resumo está a 655 a 790 px (cabe nos 900 px da janela), com "2,8 vezes o normal" em negrito e "▲ Subiu em 16/10" em verde. A segunda metade (as mudanças dos 14 dias antes) está a cerca de 2.300 px, no fim da página: **não responde em 3 s** (achado C3).
- 390, claro: a frase-resumo começa em y = 1.100 px (viewport 844). O que mais chama atenção é a capa de 300 x 169 px; o resumo só aparece com rolagem. A casca do Observatório ocupa ~680 px antes do vídeo (herdada do lote 1 aprovado), mas a capa grande é escolha deste mockup (`m13.css:19`) (achado C4).

## Veredito por estado e por largura

Medido nos quatro cruzamentos (1440 e 390, escuro e claro) por script próprio: rolagem horizontal 0 em todos; fontes < 12 px: 0 (SVG medido com escala da CTM); alvos < 44 px a 390: 0; contraste de texto HTML < 4,5:1: 0. Erros de console: só "Failed to load resource" (fontes do Google, bloqueadas de propósito). Os "baixos" que meu script apontou (número dentro do marcador de mudança) são falso positivo: o número está em tinta `--on-tr` sobre disco `--tr` (14,5:1 escuro, 15,8:1 claro), que meu cálculo não vê por ser forma de SVG.

| Estado | 1440 escuro | 390 claro | Veredito | O que pesa |
|---|---|---|---|---|
| `cheio` | ok com ressalvas | ok com ressalvas | volta para ajuste | B3 (frase dos pares), C1, C3, C4 |
| `extremo` | ok com ressalvas | ok com ressalvas | volta para ajuste | C1, C6 (¼ sumiu da régua), S3 (10 marcas "dentro dos 14 dias") |
| `recente` (o real de hoje) | ok com ressalvas | ok com ressalvas | volta para ajuste | C1, C4 |
| `magro` | ok | ok | pronto, depois do C4 | só C4 |
| `zero` | **falha** | **falha** | volta para ajuste | B1 (72 contra 67), C2 (sem "0"), C7 ("7 h12 h" a 390) |
| `naomedido` | **falha** | **falha** | volta para ajuste | B2 (1 dos 8), B3 gramática "têm" |
| `semanal` | ok com ressalvas | ok com ressalvas | volta para ajuste | C8 (nome "série" numa célula e "contagem por semana" em outra) |
| `saiu` e `mantido` | ok com ressalvas | ok com ressalvas | volta para ajuste | C1, C9 ("com 4." sem unidade) |
| `aovivo` | ok | ok | pronto, depois do C1 | C1 (linha sobre "232 em 1 hora") |
| `vazio` | ok | ok | pronto | nenhum bloqueio |
| `carregando` | ok | ok | pronto | S6 (esqueleto 1,05:1) |
| `erro` | **falha** | **falha** | volta para ajuste | B4 ("Nada foi perdido") |
| `leitura` (só leitura) | ok | ok | pronto | a tela diz o que ele não pode fazer e por quê |

## Bloqueios (nada vai ao dono com eles abertos)

**B1. Resumo do estado `zero`: "47 das 72 horas" contradiz o bloco das 72 horas ("47 das 67 horas medidas").**
Tela e estado: `zero`, 1440 e 390, resumo no topo (`m13.js:163`). As 5 primeiras horas são "não medido" (hachura rosa no gráfico), então não são nem zero nem "com view": o denominador do resumo as inclui; o bloco abaixo as exclui. Evidência: texto do resumo "e em 47 das 72 horas também não" contra "Em 47 das 67 horas medidas o vídeo não ganhou nenhuma view" (`m13.js:232`). Conserto: o resumo usa a mesma conta do bloco, "e em 47 das 67 horas medidas também não" (ou calcula as duas frases da mesma variável).

**B2. Estado `naomedido`: "Só 1 dos 8 pontos têm contagem" com 8 escrito à mão (`m13.js:206`).**
O gráfico desenha 10 idades: 1 medida (5 d), 4 "não medido" (1, 2, 3 e 7 d) e 5 "ainda não existe" (14 a 90 d). Nem 8 nem 10 se confirmam no que se vê. Além disso "1 … têm" erra a concordância. Conserto: calcular a partir dos pontos desenhados e dizer o que existe: "Só 1 dos 5 pontos que já existem tem contagem; os outros 4 são “não medido” (cada um com o motivo). Os 5 pontos de idades maiores ainda não existem." Trocar também "Passe o dedo" por "Toque" a 390 e "Passe o mouse" no resto (ver C5).

**B3. Frase quebrada nos pares de barras: "perto do normal o normal" e "0,9 vez (abaixo) o normal".**
Em todo estado com comparação (`cheio`, `extremo`, `recente`, `leitura`, `zero`, `saiu`), bloco "Os mesmos pontos, lado a lado". Causa: `m13.js:216` faz `.replace(' o normal','') + ' o normal'`, que só serve quando a frase já termina em " o normal"; "perto do normal" e "(abaixo)" escapam. Capturas: `cheio` 1440 escuro (par "1 dia": "perto do normal o normal"), `cheio` 390 claro (idem, e "0,9 vez (abaixo) o normal"). Conserto: devolver a frase pronta de `razao()` sem concatenar: "perto do normal"; "0,9 vez o normal, abaixo"; "2,8 vezes o normal".

**B4. Erro afirma o que a tela não sabe: "Nada foi perdido: as contagens e as mudanças estão guardadas".**
Estado `erro` (`m13.js:314`), o servidor não respondeu: a tela não tem como saber o que está guardado. Esse sistema falha em verde, e esta frase é a tranquilização que mais pode estar errada. A regra 4 do dono: "nenhuma frase afirma mais do que o dado sustenta". Conserto: "O servidor não respondeu, então não deu para abrir o histórico. Tente de novo; se continuar assim, avise." e manter "O que dá para ver enquanto isso" (esse bloco é verdadeiro: título, canal e data vieram da lista).

## Corrige (vai ao dono só depois de corrigido)

**C1. Linhas verticais atravessam números e datas, nos três gráficos.**
Evidência (capturas minhas, 1440 escuro): `saiu`: a linha da mudança 1 corta "1.964" e "06/10"; `recente`: corta "2.867" e "12/10"; `extremo`: corta as datas "17/10" e "25/10" nas bordas da faixa e da linha 13; `zero`, `aovivo`, `recente` (390): a linha pontilhada de "½ das views" corta "2 em 1 hora", "232 em 1 hora", "436 em 1 hora"; `semanal`: a linha de 24/08 corta "sem contagem antes de 05/10"; `naomedido` e `recente` a 390: "9.520" e "10,1 mil" por cima do marcador do normal. Conserto: (a) a linha da mudança para acima do eixo (para na linha do zero e continua só nas raias), ou o rótulo de data recebe um fundo da cor do cartão de 2 px; (b) o rótulo de pico/valor se desloca para o lado oposto da linha de metade; (c) rótulo do ponto do normal vai para baixo do marcador quando o do vídeo está em cima.

**C2. Zero medido do gráfico por dia sem o "0".**
`zero`, 1440 escuro, gráfico por dia: as barras de 1 view levam "1" em cima, mas as caixas vazadas de 08/10 e 12/10 (zero medido) não levam nada; a regra do dono e a `NOTAS.md` (item 16: "caixa vazada com o 0 dentro (célula, barra do dia, barra da hora)") dizem o contrário. Sem o número, a caixa vazada de 6 px ao lado de uma barra azul de 6 px vira "uma barra menor". Conserto: "0" em cima de cada caixa vazada do gráfico por dia, no mesmo estilo dos outros rótulos (nas horas, onde cabe 3 px, só a legenda e a leitura, e a `NOTAS` deixa de dizer "barra da hora").

**C3. A segunda metade da pergunta não está no resumo.**
`cheio`, `extremo`, `leitura` (os que têm subida): a frase-resumo e a célula "Subida" dizem "16/10 ▲ 4,7× o ritmo", mas não dizem se o canal mexeu em algo antes; isso só aparece a ~2.300 px. Conserto: acrescentar uma linha curta, na célula "Subida" ou como segunda frase do resumo: "Nos 14 dias antes, o canal mudou o título (11/10) e a miniatura (13/10)." (lista, sem causa) e, no `extremo`, "14 mudanças, 12 nos 14 dias antes". Mesma regra: não afirma causa.

**C4. A 390 px a capa de 300 x 169 px empurra o resumo para y = 1.100.**
Todos os estados com resumo, 390 claro (`m13.css:19`; medido: resumo em y 1.100 a 1.168 no `recente`, 1.139 a 1.207 no `cheio`; viewport 844). Conserto: abaixo de 760 px a capa vai para 120 x 68 px ao lado do título (grade 120 px + 1fr) e os botões quebram embaixo; meta: resumo começando antes de y = 900. A casca do Observatório (~680 px) é do lote 1 e não se mexe.

**C5. "Passe o mouse sobre o gráfico" em tela de toque.**
390 claro (ponteiro grosso), os quatro blocos: a linha de leitura diz "Passe o mouse…". Em `naomedido` o resumo diz "Passe o dedo". Conserto: uma frase única, "Toque no gráfico ou use as setas para ler um ponto." (e no 1440 com ponteiro fino, "Passe o mouse ou use as setas"; troca por `@media (pointer: coarse)` ou pela mesma detecção que o mockup já usa para o alvo de 44 px).

**C6. Régua das 72 horas esconde o ¼ quando ele não existe (`extremo`).**
`extremo`, 1440: "este vídeo" mostra só ½ (23 h) e ¾ (39 h); o ¼ some sem dizer nada, ao passo que o normal do canal mostra os três. "O que acontece quando o dado não existe?": a tela cala. Conserto: marca "¼" em hachura rosa na ponta de 0 h com o motivo no ponto: "não medido: o vídeo já tinha mais de ¼ das views quando a contagem por hora começou (7 h 40 min depois de publicar)". O mesmo vale para o ½ (a frase já cobre) e para qualquer estado com `jFirst` alto.

**C7. Rótulos de hora da régua colidem a 390 px.**
`zero`, 390 claro: "7 h" e "12 h" se sobrepõem ("7 h12 h") porque ¼ e ½ ficam a 5 horas de distância na régua de 72 horas. Conserto: se a distância entre dois rótulos for menor que 40 px, empilhar o segundo numa segunda linha (ou "7 h · 12 h" numa linha só embaixo da régua).

**C8. Dois nomes para a mesma coisa na tela `semanal`.**
Célula "Subida": "série semanal" (`m13.js:172`); células vizinhas e resumo: "contagem por semana"; veredito: "inconclusivo: série semanal" (esse é o texto exato do spec e pode ficar). Regra do dono: a mesma coisa com o mesmo nome. Conserto: a célula passa a dizer "contagem por semana", e o veredito (único lugar com "série") leva o ⓘ já existente com "série = a sequência de contagens; aqui, uma por semana". Dúvida 1 das `NOTAS` continua válida para o dono.

**C9. "o vídeo saiu do YouTube com 4." (estado `saiu`, cartão da subida)** deixa a unidade de fora, e "Não vai fechar" não diz o quê. Conserto: "precisa de 14 dias de contagem por dia; o vídeo saiu do YouTube com 4 dias de contagem, então a subida não vai ser medida".

**C10 (documento). A `NOTAS.md` diz "O dado real de 13/10/2026 é o dos estados `recente` e `magro`"; a tela diz "Nomes, números e datas são de exemplo".**
Nomes de canal e título são inventados; só o formato (vídeo de 3 dias, vídeo publicado antes de 03/10) é o do dia de hoje. A spec 6.5c e a convenção 5 pedem uma tabela "dado real × exemplo" por tela na `REVISAO`. Conserto: trocar a frase da `NOTAS` por "recente e magro reproduzem a situação real de hoje com dados inventados" e acrescentar a tabela (tudo exemplo; as únicas constantes reais são 03/10, 04/10 de exemplo para a E2, 24/08, o 2× e as 1.000 views).

## Sugestões (não bloqueiam)

- **S1.** No bloco "Mudanças deste vídeo" do `extremo`, "dentro dos 14 dias antes da subida" repete 10 vezes; marcar só o que está fora ("fora da janela") ou agrupar numa linha de cabeçalho.
- **S2.** `saiu`/`mantido`: a etiqueta "+ novo" encosta no contorno da pastilha "saiu do YouTube" (1440); dar 6 px de respiro. O botão laranja "Responder em “Saíram do YouTube”" é o maior contraste da tela, mas é ação secundária frente aos números; usar o botão neutro.
- **S3.** `saiu`: o dia 09/10 do gráfico por dia fica vazio, sem hachura nem "✕"; só a linha de saída aparece à direita. Hachura de "não medido" ou "saiu" na coluna do dia.
- **S4.** Palavras de uso interno: "barra hachurada" (`naomedido`), "leituras vizinhas" (motivo), "descoberto tarde" (da lista fechada de 6.1.5; ok manter, mas dizer "o vídeo só foi achado 76 horas depois de publicado" na leitura do ponto).
- **S5.** Os quatro botões ⓘ têm o mesmo rótulo, "Como ler este gráfico"; usar o nome do bloco ("Como ler as 72 horas").
- **S6.** `carregando`: o esqueleto mede 1,05:1 (escuro) e 1,11:1 (claro) contra o cartão; o título "Carregando o histórico do vídeo" salva o estado, mas elevar o esqueleto para ~1,5:1.
- **S7.** `carregando`, `erro` e `recente` mostram durações diferentes para o mesmo vídeo (10:00 contra 11:05). Uniformizar.
- **S8.** "perto do normal" e "abaixo" ficam só em texto; considerar "＝" na frente de "perto do normal", como no lote 1.
- **S9.** A linha de leitura (aria-live) fica abaixo da legenda de 3 a 6 linhas a 390 px (~200 px do gráfico); com o dedo no gráfico o resultado pode cair fora da tela. Mover a leitura para logo abaixo do gráfico e a legenda para depois.

## O que está bom (para não perder na correção)

Frase-resumo em um só `<span>` com número em destaque; pares de barras 1, 7 e 30 dias como régua de relance; normal com n < 3 em hachura e vídeo mantido; hora a hora com publicação em São Paulo e hachura antes da primeira contagem; régua de ¼, ½ e ¾; faixa verde da subida com "▲" e faixa tracejada dos 14 dias antes; três raias com forma (losango, triângulo, círculo) e agrupamento "×N"; "série semanal" como estado com forma própria (um ponto por semana, sem barra); "saiu do YouTube" com dado antigo à vista e sem link; `leitura` diz o que o usuário não pode fazer; cada ponto tem texto equivalente, teclado (setas, Início, Fim, Esc), botões de 44 px e tabela. Grupos de gráfico com `tabindex=0`, `role=group`, `aria-label` por extenso; SVG `aria-hidden`; erro com `role=alert`; carregando com `aria-busy` e `role=status`.

## Tabela de medidas

Contraste (WCAG, valores do `a4.css`, sobre `--surface`): texto 4,5:1, gráfico 3:1.

| Elemento | Escuro | Claro | Mínimo |
|---|---|---|---|
| Texto principal `--text` | 14,48 | 15,76 | 4,5 ok |
| `--muted` | 6,18 | 7,13 | 4,5 ok |
| `--dim` (contornos pontilhados, régua) | 4,86 | 5,59 | 3 ok |
| Este vídeo `--lado-b` | 6,80 | 4,43 | 3 ok |
| Normal do canal `--lado-n` | 11,88 | 8,32 | 3 ok |
| Subida `--dir-up` | 7,26 | 6,37 | 4,5 ok |
| Zero medido `--im-zero` (borda) | 4,97 | 4,84 | 3 ok |
| Não medido `--nm` (texto da pastilha) | 7,76 | 7,40 | 4,5 ok |
| Hachura `--nm-line` | 4,09 | 4,57 | 3 ok |
| Esqueleto de carregamento | 1,05 | 1,11 | (S6) |
| Número no marcador (`--on-tr` sobre `--tr`) | 14,5 | 15,8 | 4,5 ok |

Medições de página (script próprio, 14 estados x 4 cruzamentos = 56):

| Medida | Resultado |
|---|---|
| Rolagem horizontal da página | 0 px em 56 de 56 |
| Texto renderizado < 12 px | 0 |
| Alvos < 44 px a 390 | 0 (ⓘ 44 x 44; "anterior/seguinte" 44 x 44; "Ver como tabela" 98 x 44; botões 117 a 153 x 44) |
| Foco visível | contorno sólido de 2 px `--accent` (rgb 184, 72, 26 no claro) em todos os 25 primeiros focos; ordem: casca, botões do vídeo, ⓘ, grupo do gráfico, anterior, seguinte, tabela, bloco seguinte |
| `color-mix` | 0 usos (só 5 comentários "sem color-mix") |
| Resumo (a partir do topo da página) | 1440: y 655 a 790; 390: y 1.100 a 1.207 |
| Tabelas ("Ver como tabela") a 390 | 3 de 3 dentro da largura (rolagem interna só na primeira, 336 contra 314 px) |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA); Safari e Opera (o `color-mix` ausente protege, mas as formas SVG, as hachuras e o `popover` do ⓘ não foram vistos lá); movimento reduzido (`prefers-reduced-motion`, só li o CSS); a ordem completa de teclado depois do último bloco; as capturas de `semanal`, `aovivo`, `vazio` e `leitura` a 390 escuro; a conta numérica da subida em `cheio` e `extremo` linha por linha (conferi os somatórios do `zero` e `naomedido`: batem; a soma do `zero` é 32 = 21 + 5 + 2 + 0 + 1 + 1 + 1 + 0 + 1).

## Condição para a rodada 2

Corrigir B1 a B4 e C1 a C10; sugestões a critério. Na rodada 2 eu reabro `zero`, `naomedido`, `erro`, `cheio`, `extremo`, `recente`, `saiu` e `semanal` nos quatro cruzamentos e meço de novo resumo (y), colisões de rótulo (retângulos de texto contra linhas) e a conta de cada frase calculada contra o que está desenhado.
