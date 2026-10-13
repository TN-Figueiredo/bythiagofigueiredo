# Revisão de UX, mockup 17c (Insights: "quem sobe e quem desce no nicho"), rodada 1, 13/10/2026

Revisor: `revisor-ux-senior`. Aberto no Chromium headless (Playwright, `file://`, fontes externas bloqueadas, sem porta de rede, sem a 3099). Medi no navegador: rolagem, alvos, fonte mínima, contraste (cor composta sobre o fundo composto, lida do estilo computado), foco, ordem de Tab, ⓘ, tema, escala de cinza. As capturas desta rodada estão em `shots/r1/` (`r1-*.png`, só do cartão; as do designer ficam como estão).

## Resumo

**Veredito da tela: VOLTA PARA AJUSTE. 1 bloqueio, 5 "corrige", 9 sugestões. Não vai ao dono.**

| Veredito | Telas |
|---|---|
| pronto para o dono | 0 |
| volta para ajuste | 1 (17c) |
| reprovado | 0 |

O que mais derruba a tela:

1. **A frase-resumo não diz o que sobe nem em que janela, e é a mesma frase nas três leituras** (B1). Sem isso, "3 sobem" lê-se como verdade única do nicho, e ela só vale para a leitura escolhida.
2. **O dado que falta pode virar o primeiro colocado, em verde** (C2): "▲ subindo de 0", 1º lugar, barra até a seta da borda, para um canal que tinha 0 views nos 28 dias anteriores. É a falha em verde do CLAUDE.md, com o padrão adotado sendo o mais arriscado.
3. **A pergunta é "quem", e os nomes ficam abaixo de três blocos de controle** (C4): a 390 px a primeira linha de canal está 540 px abaixo da frase; a 1440 px ela começa em y=955 numa janela de 900. A tela ainda quebra a página em 901 a 1023 px (C1).

O que está bom e não deve mudar: a régua desdobrada (um canal por linha, mesma escala, faixa do "estável" atravessando), a posição escrita com "empate", o painel "As 3 leituras" sem veredito, a distinção entre zero medido (caixa vazada com 0), não medido (hachura com progresso e data) e "fora desta régua" (pontilhado), o método todo em ⓘ, `color-mix()` ausente, cor estável nos dois temas, leitura em escala de cinza, alvo de 44 px a 390 px, foco 2 px em tudo, Esc devolvendo o foco ao botão.

## A pergunta de quem abre

"Neste nicho, quem está subindo e quem está descendo, cada canal contra ele mesmo?" Em 3 segundos, sem rolar: a frase e a barra de contagem respondem **quantos**; **quem** só vem na régua, abaixo da dobra (ver C4). A forma da resposta (frase, barra, régua) é a certa; falta a frase dizer o quê (B1) e a régua chegar mais perto.

## Veredito por estado e por largura

"1440 e" = 1440 px tema escuro; "390 c" = 390 px tema claro (o par obrigatório). Cruzei também 1440 claro e 390 escuro em todos os 12 estados (medidas) e olhei com os olhos tipico nos quatro cruzamentos. Nenhum "pronto" abaixo vale enquanto B1 e C1 estiverem abertos nos estados que os têm; a coluna diz o que pesa em cada um.

| Estado | 1440 e | 390 c | O que pesa |
|---|---|---|---|
| tipico | volta | volta | B1, C4 |
| leituras (linha aberta) | volta | volta | B1, C4 |
| videos (leitura b) | volta | volta | B1 (a frase é idêntica à da leitura a) |
| justa (leitura c, nenhum medido) | ok | ok | só sugestões S3 e S8; a frase tem data e não afirma nada |
| extremo | volta | volta | B1, C1; as bordas (+340% com seta, −60% sem seta, −78% com seta, 3 empates em 2º e o seguinte 5º, 9,68% como +10% ▲, nome de 69 caracteres, dia sem registro) estão certas |
| zero | volta | volta | C2; zero medido x não medido está bem resolvido |
| nao-medido | ok | ok | S3, S8 |
| magro (2 canais) | volta | volta | B1 |
| um-canal | volta | volta | B1, S5 |
| sem-dado | ok | ok | S6 |
| sem-dado-leitura | ok | ok | S6 |
| erro | volta | volta | C3 |

Estado não desenhado e que o brief pede: **carregando**. A NOTAS justifica (aba montada no servidor, sem carregamento próprio) e dá a regra para o caso de requisição à parte. Aceito.

## Bloqueio (impede ir ao dono)

**B1. Frase-resumo sem objeto e sem janela, igual nas três leituras. Todos os estados com dado, 1440 e 390.**
Evidência: o texto é "▲ 3 sobem, ▼ 2 descem e ＝ 1 fica estável no nicho Viagem. 1 canal ainda não pôde ser medido." Não diz "views" nem "28 dias". O código (`frase()` em `m17c.js`) só usa o nome do nicho, as contagens e o plural; trocando para `?leitura=b` o texto é idêntico, embora a conta passe a ser "mediana das views dos vídeos longos publicados em 90 dias contra os 90 anteriores". A janela está só no `.q-meta` (13 px, `--muted`, no canto direito a 1440), e a métrica só no botão do seletor, mais abaixo. O lote 1 aprovado diz a janela dentro da frase (`pe-fr`: "…nos últimos 28 dias…"). Regra do dono: a frase diz o que os números significam; nenhuma frase afirma mais do que o dado sustenta.
Conserto: a frase passa a ter o objeto e a janela por leitura, no mesmo `<span>`:
- a: "▲ 3 sobem, ▼ 2 descem e ＝ 1 fica estável em views nos últimos 28 dias, no nicho Viagem. 1 canal ainda não pôde ser medido."
- b: "… nas views do vídeo típico dos longos publicados nos últimos 90 dias, no nicho Viagem. …"
- c: o mesmo com "aos 30 dias de vida".
Mantenha o `.q-meta`, mas ele deixa de ser o único lugar da janela.

## Corrige (vai ao dono só depois de corrigido)

**C1. Rolagem horizontal da página entre 901 e 1023 px. Todos os estados com lista.**
Evidência: `scrollWidth - clientWidth` = 133 px a 901, 74 a 960, 10 a 1024, 0 a 1099. O cartão tem largura mínima de 998 px (`--q-cols: 56px minmax(200px,1fr) minmax(300px,1.7fr) 196px 140px` + gaps + padding) e o menu lateral só some abaixo de 1100, mas o layout de cartão do `m17c.css` só liga em 900. O estado `sem-dado` mede 0 de rolagem, então é a lista. Fora do par obrigatório, mas é a janela de um notebook pequeno ou de meia tela, e o T0 do spec trata justamente de contêiner que quebra no meio do monitor.
Conserto: ligar o layout de cartão (linha em três faixas) até 1099 px, ou deixar as colunas encolherem (`minmax(0,…)`, régua mínima 200 px, botão só com o ícone abaixo de 1100).

**C2. "N contra 0" vira o 1º lugar, e "0 contra 0" vira "estável". Estado `zero`, 1440 e 390.**
Evidência (captura `r1-zero-1440-escuro.png` e `r1-zero-390-claro.png`): "Ana Passaporte, 3.100 views contra 0: ▲ subindo de 0", 1º, barra verde até a seta da borda, entrando em "3 sobem" na frase e na contagem. "Voo Baixo, 0 contra 0: ＝ estável, sem mudança", entrando em "1 fica estável". Um canal sem nenhuma view em 28 dias seguidos, com 56 dias de registro, é muito mais provável de ser dado ausente do que de ser uma fase. A caixa vazada com 0 distingue o zero, mas a leitura em verde diz "subiu" por uma divisão que não existe. A pergunta 4 da NOTAS já nomeia o risco, e o padrão escolhido é o de maior risco.
Conserto: padrão conservador. "N contra 0" e "0 contra 0" ficam "não medido: sem base para comparar (0 views nos 28 dias anteriores)", sem posição e fora da contagem, mantendo a caixa vazada com 0 na linha de base; a alternativa (▲ "de 0") vai como pergunta ao dono, com a captura atual para ele ver.

**C3. Erro afirma o que não sabe. Estado `erro`, 1440 e 390.**
Evidência: "Os outros cartões desta tela continuam certos." A tela não tem como saber isso; se a consulta das views falhou, outros cartões que usam a mesma fonte podem estar errados. Fere "nenhuma frase afirma mais do que o dado sustenta".
Conserto: "Os outros cartões desta tela carregaram." (ou cortar a frase). Mantenha "Tente de novo; se o erro continuar, confira se a sincronização dos canais está atrasada."

**C4. Os nomes ficam abaixo de três blocos de controle. Estados com dado, principalmente 390 c.**
Evidência (medido, janela 1440x900 e 390x844): a 1440 a frase está em y=663, a barra em 705, o seletor em 757 a 831 e a primeira linha de canal em y=955, abaixo da dobra; a 390 a frase está em y=657, o seletor ocupa 800 a 1038 (três botões empilhados de 74 a 80 px) e a primeira linha só começa em y=1197, 540 px abaixo da frase. Entre a frase e a régua há barra, seletor, legenda, aviso e eixo. O olho acha "quantos" e depois rola para achar "quem". O seletor, que o dono usa pouco (o padrão é a leitura a), pesa mais que a régua: o botão selecionado tem borda de 2 px em `--text`, o segundo elemento de maior contraste da tela depois da barra.
Conserto: a 390, o seletor vira controle segmentado de uma linha (rótulos "Canal inteiro", "Vídeos novos", "Mesma idade"; o "6 de 7 medidos" vai para o ⓘ ou para uma linha sob o controle); a legenda e o aviso de 19/10 ficam numa linha só cada, sob a barra, e a régua sobe ao menos 200 px. A 1440, o seletor pode dividir a linha com o `.q-meta` e a legenda.

**C5. Botão "As 3 leituras" a 390 px com borda `--border-strong` e sem texto. 390 c e 390 e, todas as linhas.**
Evidência: o botão é só o ícone (44 x 44) com borda `--border-strong`, que mede 1,77:1 no claro e 1,44:1 no escuro; a CONVENCOES (item 3, tabela de tokens) diz para não usar `--border-strong` em controle sem texto e usar `--dim`. A seta é `--muted` (passa), mas a caixa do botão some.
Conserto: borda `--dim` (4,86:1 escuro, 5,59:1 claro) no `.q-mais` abaixo de 640 px.

## Sugestões (não bloqueiam)

- **S1. "Até 19/10".** A janela anterior ainda inclui 24/08 até 18/10 (18/10 − 55 dias = 24/08) e deixa de incluir em 19/10, e o código tira o aviso em 19/10 (`HOJE < '2026-10-19'`). A frase "Até 19/10" diz que o aviso vale também em 19/10. Trocar por "Até 18/10".
- **S2. ⓘ do título fixo em 28 dias.** "Na leitura principal, as views que o canal inteiro ganhou nos últimos 28 dias…" aparece igual quando a leitura escolhida é b ou c. Trocar por "Na leitura escolhida (veja o botão selecionado): …" ou mostrar o parágrafo da leitura ativa.
- **S3. `nao-medido` e `justa` não levam ao que existe.** Com a leitura a sem nenhum medido, o botão "Vídeos novos" diz "6 de 7 medidos" e a frase não aponta para ele. Acrescentar ao fim da frase "Vídeos novos já mede 6 de 7" (como botão ou link).
- **S4. Palavras.** "mediana de 21.500 views" no painel das leituras: o lote 1 diz "vídeo típico"; usar "vídeo típico: 21.500 views (mediana de 8 longos)". "volta a medir quando o registro chegar": "registro" é o termo do spec, mas na tela do dono fica interno; "volta a medir quando houver o dado de 13/10".
- **S5. `um-canal`.** A barra de contagem com um segmento 100% verde não compara nada: tirar a barra quando só há um canal. A frase "ele sobe… não há quem suba ou desça ao lado" se contradiz na leitura rápida; trocar por "Só 1 canal no nicho Culinária, e ele sobe ▲. Sem outro canal, não há com quem comparar."
- **S6. ⓘ solto no vazio e no erro.** Sem régua, o botão "Como ler esta régua" não tem o que explicar; a 390 px ele cai sozinho numa linha de 44 px abaixo do título (`r1`/folha 390: erro e sem-dado). Tirar o ⓘ nesses dois estados.
- **S7. A tela de 7 trilhas vazias** (`nao-medido`, `justa`): o eixo "descendo / estável / subindo" e as 7 trilhas pontilhadas dizem pouco quando nada está medido. Esconder o eixo e deixar uma lista de nome, progresso e data.
- **S8. As tiras "já existe, não muda"** têm 56 px; os cartões reais "Leitura da forja" e "Você no nicho" são bem mais altos, então ao vivo o cartão novo cai bem abaixo da dobra. Dizer isso na NOTAS e perguntar ao dono se o cartão sobe para o topo da aba.
- **S9. A NOTAS (seção 6) diz "cerca de 125 px por linha" a 390 px; medi 151 px** (y 1197 a 1348). Corrigir o número. A 1440 a linha mede 77 px (meta aceita: 132 a 155), bem dentro.
- **Para o implementador, no NOTAS:** o mockup refaz o cartão inteiro com `innerHTML`, o que troca o nó `#q-fr`; leitor de tela não anuncia uma região `aria-live` que foi substituída. Na versão real, manter o nó e trocar só o texto.

## Medidas

Contraste de texto (razão, lida da página; piores casos por tela; mínimos exigidos 4,5:1 texto, 3:1 elemento gráfico):

| Item | Escuro | Claro |
|---|---|---|
| Menor texto do cartão (todos os estados) | 4,64 (`.q-b2`, 12,5 px, sobre `--surface-2` na linha aberta); 4,86 nos demais | 4,94 (chip "seu canal") |
| Texto sobre barra de contagem ▲ / ▼ / ＝ | ≥ 7 (texto `#16130F`) | ≥ 5,5 (texto branco sobre #11692F, #8A5A00, #5E5240) |
| Texto "não medido" (rosa, sobre hachura) | ~6 (calculado à mão: `#E59CC0` sobre `#3A2232`) | ~6 (`#8E2A62` sobre `#F7E1EC`) |
| Barra ▲ / ▼ / ＝ contra o cartão | 7,26 / 7,71 / 6,18 | 6,37 / 5,55 / 7,13 |
| Contorno do "não medido" (pontilhado) | 4,09 | 4,57 |
| Caixa vazada do zero medido | 4,97 | 4,84 |
| "fora desta régua" (contorno `--dim`) | 4,86 | 5,59 |
| Linha do zero (`--muted`) | 6,18 | 7,13 |
| Faixa do "estável" (fundo) | 1,05 (as bordas tracejadas `--dim` carregam: 4,86) | 1,11 (bordas 5,59) |
| Seta ›/‹ sobre a barra | o medidor leu 1,1:1 contra o cartão; a seta está sobre a barra (texto `#16130F` sobre `#22c55e`, ≥ 7) e passa | branco sobre verde/ocre escuros, ≥ 5,5 |
| Borda do botão "As 3 leituras" (`--border-strong`) | 1,44 | 1,77 (ver C5) |

Escala de cinza (`filter: grayscale(1)`, 1440 e, `r1-tipico-1440-escuro-cinza.png`): a tela lê. Verde e âmbar viram o mesmo cinza, e quem separa é o símbolo (▲ ▼ ＝), o lado da barra e a palavra ("subindo/descendo/estável"). A hachura do "não medido" continua inconfundível.

Geometria e conforto:

| Medida | 1440 | 390 |
|---|---|---|
| Rolagem horizontal, 12 estados x 4 cruzamentos | 0 | 0 |
| Rolagem em 320, 360, 600, 768, 900 / 901, 960, 1024 / 1099, 1100 | 0 / 133, 74, 10 / 0, 0 (ver C1) | 0 |
| Texto menor que 12 px | nenhum | nenhum |
| Alvos menores que 44 x 44 px | n/a (ponteiro fino: ⓘ 28, botão de linha 36 x 122, nome do canal 17 de altura, aceitos pelo lote 1) | nenhum (ⓘ, botão ▾, nome do canal, seletor) |
| Altura do cartão com 7 canais | 926 px | 1819 px |
| Altura de uma linha de canal | 77 px | 151 px |
| Erros de console da página | 0 | 0 |
| Foco (Tab em 40 passos) | contorno 2 px sólido `#FF8240` em todo controle; ordem: ⓘ, 3 botões do seletor, ⓘ, depois nome e "As 3 leituras" de cada linha, "seu canal" | n/a |
| Esc no ⓘ | fecha e devolve o foco ao botão | n/a |
| ⓘ aberto | 380 x 468 px, dentro da janela | 366 x 524 px de 844, dentro da janela |
| Movimento reduzido | `transition-duration` 0s | n/a |
| `grep color-mix` na pasta | só o comentário "Sem color-mix()" | idem |

## Consistência com o lote 1

Boa. Mesmos tokens, mesma casca (`A.moldura`, `L.obs`), "+ novo" tracejado verde-água, ＝ neutro com a variante âmbar em botão, símbolo cheio com cor, hachura rosa do não medido, caixa vazada do zero, método no ⓘ com a frase fixa, "exemplo" em todo número. A única divergência da frase é a de B1 (o lote 1 diz a janela dentro da frase). As três perguntas ao dono estão declaradas na NOTAS com o padrão adotado; a pergunta 4 (C2) muda de padrão (a conta sugerida pelo revisor é a conservadora).

## O que NÃO verifiquei

- Leitor de tela (VoiceOver, NVDA): li o ARIA no código e na árvore (`role="img"` com texto por extenso, `aria-pressed`, `aria-expanded` e `aria-controls`, `aria-live`), mas não ouvi nada.
- Safari, Firefox e Opera. Só Chromium. O Opera é o navegador do dono e o `color-mix()` está ausente, mas não abri o mockup nele.
- Toque real em aparelho (usei emulação de ponteiro grosso com `isMobile`).
- Contraste do texto sobre a hachura (barra de contagem e pastilha "não medido") foi calculado à mão com os dois tons da hachura, não lido do pixel.
- Abri um ⓘ de três (o do título, nos dois tamanhos); li o texto dos outros no código.
- Dado real: tudo é exemplo; o `tipico` pode não ser o que o dono verá em 13/10 (pergunta 3 da NOTAS: quantos canais já têm 56 dias de registro). Não consultei produção.
- Mais de 40 canais no nicho: declarado como não resolvido pelo designer; a regra "mostrar 10 e Mostrar mais N" é a do lote 1.
- Vi de olho as capturas: tipico (4 cruzamentos e cinza), extremo, zero, nao-medido, leituras, um-canal, magro, erro, sem-dado-leitura (1440 e), zero, erro, sem-dado-leitura (390 c). `videos` e `justa` só por medida e pelo código.

## Para quem desenhou

Corrija B1 e C1 a C5; as sugestões S1 a S9 ficam a seu critério, e as que você não fizer, diga por quê. Se discordar de algum achado, responda com medida ou captura; mantenho ou retiro por escrito. A rodada 2 reconfere B1, C1 (largura de 901 a 1023 e 1100), C2 (estado `zero`), C3, C4 (y da primeira linha a 390 e a 1440) e C5.
