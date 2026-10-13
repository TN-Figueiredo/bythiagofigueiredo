# Revisão de UX, mockup 18 (aviso "banco chegando ao limite"), rodada 1

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Escopo: PLANO.md, NOTAS.md, index.html, bl.css, bl.js e as capturas em `shots/`, mais capturas e medidas próprias (Chromium headless sobre servidor estático na porta 47725/47726, derrubado ao terminar; scripts e capturas em `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/effd3b68-3fac-4c8a-974c-5f4cdde5fbf0/scratchpad/` e subpasta `r1/`). Nada foi editado fora deste arquivo.

## Veredito: VOLTA PARA AJUSTE (não vai ao dono)

Sete itens impedem (3 "bloqueia" e 4 "corrige", todos têm de ser consertados antes do dono ver: regra do rito, "nenhum mockup vai ao dono com bloqueia ou corrige aberto"). O resto é sugestão.

A pergunta de quem abre: **"o banco vai me deixar na mão, e quando?"**. Em 3 segundos, sem rolar, a pastilha da faixa responde "quanto" ("Banco: 216 de 500 MB" com minibarra), e em vermelho por previsão responde também "quando" ("enche em 80 dias"). Nos outros estados o "quando" só existe com o painel aberto. A resposta de relance funciona; o que derruba o conjunto é a barra de zonas (a forma memorável) não ler em cinza, o painel aberto à toa quando está tudo bem, e a parede de "não medido" repetido quando falta leitura.

Pontos que passaram (medidos): contas fecham em todos os estados (partes somam o total; 28 dias soma o crescimento; MB por dia x dias bate com a data: 140 ÷ 0,20 = 700 dias = set/2028; 60 ÷ 0,30 = 200 dias = mai/2027; 108 ÷ 1,35 = 80 dias = 01/01/2027; percentuais da quebra somam 100; idade dos lotes 4 e 1 dia); `color-mix` ausente (só comentários); sem rolagem horizontal em nenhum dos 48 cruzamentos medidos; nenhum texto abaixo de 12 px; nenhum alvo abaixo de 44 x 44 px a 390; foco visível (2 px laranja) em todos os controles; ordem de teclado lógica (pastilha, ⓘ, "Tentar de novo", ⓘ dos lotes, lista); Enter alterna o painel e `aria-expanded` acompanha; ⓘ abre e Esc fecha devolvendo o foco ao botão.

## Veredito por estado e por largura

Par obrigatório: 1440 escuro e 390 claro. Medi também 1440 claro e 390 escuro.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| verde (216) | volta | volta | B1 (zonas), B3 (painel aberto à toa), C2 (pastilha da faixa quebra), C4 (números repetidos) |
| amarelo (360) | volta | volta | B1, C2, C4 |
| vermelho por tamanho (440) | volta | volta | B1, C2, C3 (nome), C4 |
| vermelho por previsão (392) | volta | volta | B1, C2 (3 linhas, 47 px), C3, C4, frase com a regra no corpo (C5) |
| acima do limite (521) | volta | volta | B1, C3, C4 |
| zero medido (não cresceu) | pronto, com B1 | volta | B1; "0,0" repetido cinco vezes é correto (zero medido), só pesado |
| previsão não medida (6 dias) | volta | volta | B1, pastilhas "não medido" repetidas na tabela (cinco) |
| sem leitura hoje | reprovado neste desenho | reprovado neste desenho | B2 (parede de rosa, frase sobre o próprio aviso), C1 (pastilha sem símbolo) |
| lote pendente | volta | volta | B1, C2 (a pastilha quebra "2 lotes a / confirmar" a 390) |
| erro ao ler | volta | volta | B2, C1 |
| ainda sem medida | volta | volta | B2, C1 |
| só leitura (não vê) | pronto | pronto | desvio da regra 13 declarado e defendido (dúvida 1 do dono); medido: nenhum `#bl-chip` no DOM |
| painel fechado (só a pastilha) | pronto | volta | a 390 a pastilha quebra no meio da frase (C2) |

## Bloqueios (impedem ir ao dono)

### B1. A barra de zonas, a forma memorável, não lê em escala de cinza e não tem símbolo (bloqueia)
- **Onde:** todos os estados com barra (a barra do painel, `.bl-bt`, `.bl-z.a` e `.bl-z.r`), 1440 escuro e 390 claro. Capturas: `r1/vermelho-projecao-1440-escuro.png`, `r1/sem-leitura-390-claro.png`, `r1/bar-sl-zoom.png`.
- **O que está errado:** as zonas de 350 a 425 e de 425 a 500 só se distinguem pelo matiz; não levam símbolo dentro da barra (o triângulo e o octógono só existem na legenda abaixo, a uma linha de distância). Regra do dono: "símbolo junto da cor, nunca só cor" e "tem de ler em escala de cinza".
- **Evidência (lida do estilo computado, zona composta sobre o trilho):** razão de contraste entre as duas zonas **1,17:1 no escuro e 1,07:1 no claro**; tons de cinza (0 a 255): escuro trilho 19, âmbar 55, vermelha 45; claro trilho 236, âmbar 209, vermelha 204. Zona contra trilho: 1,59 e 1,37 no escuro; 1,29 e 1,38 no claro, abaixo dos 3:1 de elemento gráfico. O que salva hoje são os traços de 2 px e os números 350 e 425, mas o dono não "vê a distância até cada corte sem ler número", que é a promessa do plano.
- **Conserto:** desenhar dentro de cada zona o mesmo ícone da legenda (triângulo com "!" na de 350 a 425, octógono com "!" na de 425 a 500; 16 px cabem nos 50 px que a zona tem a 390) e subir a opacidade das zonas até 3:1 contra o trilho (ou dar às zonas uma borda superior de 2 px na cor `--warning` e `--danger`). Não usar a hachura de 135 graus, ela é do "não medido".

### B2. "Sem leitura hoje", "erro" e "vazio": parede de "não medido" repetido e frase que fala do próprio aviso (corrige)
- **Onde:** sem leitura, erro, vazio; 1440 escuro e 390 claro. Capturas: `r1/sem-leitura-1440-escuro.png`, `r1/sem-leitura-390-claro.png`, `r1/erro-1440-escuro.png`.
- **O que está errado:** são o estado mais importante (o sistema falha em verde) e é o que tem mais ruído. Em "sem leitura hoje" contei sete pastilhas rosa no painel (pastilha de estado, "sem leitura hoje" em Hoje, três "não medido" nos outros números, um na régua, um em "Quem ocupa") e o motivo "sem a leitura de hoje" escrito cinco vezes (frase, sub dos dois números, régua, quebra). Em erro são oito. Isso é o bloco monocromático e o texto repetido que o dono reprova. Além disso a frase diz "Sem a leitura de hoje o aviso não pode ficar verde": isso é regra interna do sistema falando de si, não informação para quem edita; e "(com folga)" na mesma frase tranquiliza justo onde o aviso quer dizer "não sei".
- **Conserto:** quando não há tamanho de hoje, trocar os quatro números por uma linha só ("Hoje, Livre, Cresceu e Chega a 500 MB: não medido, falta a leitura de hoje", uma pastilha); a régua e "Quem ocupa" mostram a hachura sem pastilha e sem repetir o motivo (o motivo já está na frase); cortar "o aviso não pode ficar verde" (fica no ⓘ) e "(com folga)" (fica só "215 MB"). Frase proposta: "Sem leitura do banco hoje. A medida das 05:00 não chegou; a última, de 12/10, foi 215 MB."

### B3. Painel aberto por padrão mesmo quando está tudo bem (corrige)
- **Onde:** verde, zero medido, previsão não medida, lote pendente (e acima e vermelho, que merecem abrir); 1440 escuro e 390 claro.
- **O que está errado:** o plano diz "quieta quando está bem", e a tela D aprovada no lote 1 (`d-em-dia`, 1330 px de página a 1440) mostra o "em dia" sem painel. Aqui o verde abre um painel de 420 px a 1440 e **1063 px a 390**, empurrando a Lista de Canais (o motivo de abrir o Observatório) para baixo da dobra (a lista começa em y ≈ 850 a 1440 e y ≈ 1200 a 390). Medido: altura do painel verde 420 px (1440) e 1063 px (390); lote pendente 624 e 1374 px.
- **Conserto:** padrão por estado. Fechado em verde, zero medido e previsão não medida; aberto em amarelo, vermelho, acima, sem leitura, erro e vazio (o que pede ação ou desconfiança). O dono pode abrir; lembrar a escolha com `L.lembrar` como o lote faz. Documentar o padrão em NOTAS.md.

## Corrige (vão ao dono só depois de corrigidos)

### C1. Pastilha do painel nos estados de "não medido" não tem símbolo (corrige)
- **Onde:** sem leitura, erro e vazio, `.bl-p.vazia`, 1440 escuro e 390 claro (`r1/pill-vazia-zoom.png`).
- **Errado:** `.bl-p .nm-h{display:none}` esconde a amostra de hachura, e o fundo hachurado da pastilha (6 px e 8 px, `--nm-bg` e `--nm-fio` a 14%) é invisível a olho: o que se vê é só uma borda rosa e texto. A pastilha da faixa tem o símbolo; a do painel, não. Rule 4: símbolo junto da cor.
- **Conserto:** mostrar a amostra `A.nmSw()` na pastilha do painel (apagar a regra `display:none`), como a da faixa.

### C2. A pastilha da faixa quebra no meio da frase a 390 px (corrige)
- **Onde:** todos os estados a 390; piores: vermelho por previsão e lote pendente (3 linhas, 47 px; `r1/chip390-lote-pendente.png`). Também "Banco: 216 de / 500 MB" em 2 linhas no verde (chip de 44 px, faixa de 109 px).
- **Errado:** `white-space:normal` a 390 deixa "Banco: 392 de / 500 MB", "enche em 80 / dias" e "2 lotes a / confirmar" partidos ao meio, com a minibarra no meio da frase. É a primeira coisa que o dono lê em 3 segundos.
- **Conserto:** o texto "Banco: 216 de 500 MB" fica numa unidade que não quebra (`white-space:nowrap`); minibarra e ícone vão para a segunda linha só se faltar largura; "enche em 80 dias" e "2 lotes a confirmar" são itens que passam inteiros para a linha de baixo (flex-wrap entre itens, não dentro). Manter 44 px de altura mínima por linha de toque.

### C3. "Chegando ao limite" (amarelo) e "Perto do limite" (vermelho) são quase sinônimos (corrige)
- **Onde:** pastilhas, legenda da barra, frases, ⓘ; todos os estados.
- **Errado:** o vermelho tem o nome mais fraco ou igual ao do amarelo ("perto" soa menos urgente que "chegando"). Sem a cor, quem lê só o texto não ordena. A legenda inteira ("350 a 425 MB (70% a 85%): chegando ao limite", "acima de 425 MB, ou cheio em menos de 90 dias: perto do limite") fica difícil de ler.
- **Conserto:** nomes que se ordenam sozinhos: amarelo "Enchendo" (ou "Atenção"), vermelho "Quase cheio"; "Acima do limite" continua. Atualizar pastilha, frase, legenda, tabela fora da tela e ⓘ.

### C4. Número repetido: o mesmo dado aparece até cinco vezes (corrige)
- **Onde:** verde (e todos os com leitura), 1440 e 390 (`r1/lote-pendente-1440-escuro.png`).
- **Errado:** "216" aparece na pastilha da faixa, na frase, no rótulo da barra, na célula "Hoje" e no "Total do banco". "jan/2030" aparece na frase, na célula "Chega a 500 MB" e na régua. É o "texto repetido" do critério 3 e o motivo de o painel ter 420 px.
- **Conserto:** cortar a célula "Hoje" (é o rótulo da barra) e a célula "Chega a 500 MB" (é a régua e a frase); sobram "Livre até 500 MB" e "Cresceu em 28 dias" com os MB por dia, lado a lado. Em "sem leitura" as duas viram a linha única do B2.

### C5. A frase do vermelho por previsão repete o fato e carrega a regra (corrige)
- **Onde:** vermelho por previsão, 1440 escuro e 390 claro.
- **Errado:** "Banco enche em 80 dias: 392 de 500 MB (78%). No ritmo dos últimos 28 dias, chega ao limite em jan/2027 (em 80 dias). Menos de 90 dias é vermelho." Diz "80 dias" duas vezes, e o último trecho é regra de cálculo (já está na legenda da régua e no ⓘ). São 2 frases e meia no que deveria ser uma frase-resumo.
- **Conserto:** "Banco enche em 80 dias: 392 de 500 MB (78%), no ritmo dos últimos 28 dias." A data (jan/2027) fica na régua, a regra no ⓘ.

## Sugestões (não bloqueiam)

1. **Tabela de "Quem ocupa" a 390 px:** o quadradinho de cor cai numa linha acima do nome ("■ / Concorrentes"), "Resto do site" quebra em duas linhas e o cabeçalho "Cresceu em 28 dias" também (`r1/vermelho-projecao-390-claro.png`). Pôr o quadradinho em `inline-block` à esquerda com `white-space:nowrap` na coluna do nome; cabeçalho "Em 28 dias".
2. **Barra do vermelho por previsão:** o preenchimento fica todo vermelho (de 0 a 392) mesmo com o ponteiro dentro da zona âmbar. A barra sozinha parece dizer "vermelho em 78%" enquanto a legenda diz que 350 a 425 é amarelo. Mostrar o preenchimento na cor do tamanho (âmbar) e levar o vermelho para a pastilha, o "enche em 80 dias" e o losango da régua, que já dizem o motivo.
3. **Faixa de frescor inteira com borda vermelha** (vermelho e acima): "7 canais", "sincronizado há 3 h" e "todos em dia" ficam dentro de um contorno de alarme, o que insinua problema neles. Colorir só a pastilha do banco.
4. **Estado "carregando" não desenhado** (regra 13, "onde houver"). Se o aviso é desenhado no servidor junto com o cabeçalho, declarar "não há carregando" em NOTAS.md; se não, desenhar a pastilha com a hachura e "Lendo o banco…". Idem, "Tentar de novo" só tem o estado de espera no botão; falta anunciar o resultado (`aria-live="polite"` na frase).
5. **"Tentar de novo" fica embaixo da régua** (y 527 contra y 172 da frase, a 1440). Quando o erro é o assunto, o botão deve estar ao lado da frase.
6. **Lotes em estado de erro:** "Lotes exportados: não medido, a consulta falhou". Os lotes vêm de outra tabela; se a consulta do tamanho falhou não se sabe que a dos lotes falhou. Mostrar os lotes normalmente ou dizer só "não foi possível ler os lotes".
7. **Zero medido:** "o banco não cresceu em 28 dias", 0,0 exato nas três partes, é um número suspeito (o sistema falha em verde: pode ser leitura repetida). Considerar acrescentar no ⓘ "se for 0,0 em tudo, confira a tarefa de leitura".
8. **Jargão a trocar:** "a consulta falhou" por "o banco não respondeu"; "o sistema gravou os arquivos" (ⓘ dos lotes) por "o sistema salvou os arquivos"; "manifesto" e "soma de controle" só no ⓘ e com uma frase simples; "linhas" por "registros" ou manter; "registro" (14 dias de registro) por "dias de leitura". "NAS" é termo do dono, ok.
9. **O "quando" com o painel fechado:** em verde e amarelo a pastilha só diz o tamanho. O exemplo do spec fala da data na frase do cabeçalho ("chega ao limite em jan/2030"). Com o padrão de B3 (fechado no verde), considerar "limite em set/2028" na pastilha amarela.
10. **Mesmo símbolo para dois estados:** "Perto do limite" e "Acima do limite" usam o mesmo octógono; o texto diferencia. Aceitável, mas um segundo traço (por exemplo um "×") ajudaria em cinza.
11. **Acessibilidade fina:** as duas `role="img"` das barras têm texto por extenso (bom); o painel é `role="region"` com nome (bom); a tabela tem `caption` e `scope` (bom). Falta `aria-live` onde o texto muda (retry).

## Tabela de medidas

Contraste, texto menor da faixa e do painel por estado (pior valor lido; o mínimo exigido é 4,5:1):

| Estado | 1440 escuro | 390 claro | 1440 claro | 390 escuro |
|---|---|---|---|---|
| verde | 6,18 | 6,83 | 6,83 | 6,18 |
| amarelo | 6,18 | 6,64 | 6,64 | 6,18 |
| vermelho por tamanho | 5,59 | 6,16 | 6,16 | 5,59 |
| vermelho por previsão | 5,59 | 5,90 | 5,90 | 5,59 |
| acima | 5,59 | 5,90 | 5,90 | 5,59 |
| demais estados | 6,18 | 6,83 | 6,83 | 6,18 |

Elementos gráficos (3:1 exigido), contra o cartão do painel:

| Elemento | Escuro | Claro | Passa |
|---|---|---|---|
| `--success` (círculo, preenchimento verde) | 7,83 | 6,10 | sim |
| `--warning` | 8,31 | 4,50 | sim |
| `--danger` | 6,03 | 5,90 | sim |
| `--nm-line` (borda do "não medido") | 4,40 | 4,38 | sim |
| `--im-zero` (caixa do zero medido) | 5,36 | 4,64 | sim |
| `--lado-b` (concorrentes) | 7,34 | 4,24 | sim |
| `--lado-o` (seu canal) | 7,24 | 4,73 | sim |
| zona âmbar contra trilho | 1,59 | 1,29 | **não (B1)** |
| zona vermelha contra trilho | 1,37 | 1,38 | **não (B1)** |
| zona âmbar contra zona vermelha | 1,17 | 1,07 | **não (B1)** |

Alvos, rolagem e fontes (todas as 12 telas, quatro cruzamentos): rolagem horizontal 0 px em todos; texto menor que 12 px, nenhum; alvos menores que 44 x 44 px a 390, nenhum. Pastilha da faixa a 390: 44 px (verde, amarelo, vermelho por tamanho, acima, sem leitura, erro, vazio) e 47 px (vermelho por previsão e lote pendente); faixa de frescor 105 a 112 px; a 1440 a pastilha tem 28 px de altura (ponteiro fino; permitido pela convenção).

Alturas do painel: 381 px (vazio), 413 (erro), 416 (sem leitura), 420 (verde, acima, previsão não medida), 440 (amarelo, vermelho por tamanho), 446 (vermelho por previsão), 458 (zero medido), 624 (lote pendente), a 1440; a 390: 725, 780, 786, 1063, 1090, 1092, 1374.

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): só li os atributos de `aria`, `role` e `aria-label` no DOM.
- Safari e Opera (o navegador do dono renderiza `color-mix()` transparente; confirmei só que não há `color-mix` no CSS, e vi o resultado no Chromium).
- Toque em dispositivo real (usei emulação de ponteiro grosso e `hasTouch`).
- Movimento reduzido (li o CSS, que respeita `prefers-reduced-motion`, mas não gravei a transição).
- Fontes (Fraunces, Inter, JetBrains Mono) foram bloqueadas na captura, como no lote 1; as larguras reais com a fonte da web podem diferir poucos pixels, o que pesa em C2.
- A grade 1440 claro e 390 escuro foi medida (contraste, rolagem, alvos), mas só abri as capturas do par obrigatório.

## Condição para a próxima rodada

Zerar B1, B2, B3 e C1 a C5. Reconferir o par obrigatório em todos os 12 estados, mais painel fechado em verde e amarelo, e medir de novo as zonas (3:1 contra o trilho, símbolo dentro da barra, leitura em cinza). Se o desenhista discordar de algum item, responder com medida ou captura; o desacordo que sobrar vai ao dono com os dois lados.
