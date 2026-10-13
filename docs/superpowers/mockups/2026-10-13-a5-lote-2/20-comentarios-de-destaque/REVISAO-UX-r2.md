# Revisão de UX, rodada 2: mockup 20, Comentários de destaque do vídeo de concorrente

Revisor: engenheiro sênior de UX. Data: 13/10/2026. Pedido: spec 02, 4.6.9 (os 12 pontos), 4.6.2, 4.6.3, 4.6.5; medidas 6.5b linha 161; perguntas 9, 10 e 41; CONVENCOES.md; lote 1 aprovado.

**Aviso sobre a rodada 1.** Não existe `REVISAO-UX-r1.md` na pasta do mockup 20 (existe nas pastas 11b a 18, 22 e 3b). Não consegui conferir "bloqueio por bloqueio" do que a r1 pediu. Julguei a tela inteira como está hoje (arquivos de 12:03 a 12:13) e procurei também defeito novo. Se a r1 foi entregue só por mensagem, quem desenhou deve cruzar a lista abaixo com ela.

## Veredito

**VOLTA PARA AJUSTE. 4 bloqueios, todos pequenos e de conserto curto (texto, uma conta, um foco). Nenhum exige redesenho.** São 16 estados (13 da página do vídeo e 3 da página do canal). Por conteúdo, 13 estão prontos e 3 voltam (só leitura sem texto, M11 com dado, M11 fecha em dd/mm). Por comportamento, B3 (foco) atravessa todo estado com mais de 5 cartões e volta junto.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico (o comum, nenhum canal grande) | pronto, salvo B3 | pronto, salvo B3 | B3 (foco) vale para esta tela |
| Extremo (quatro motivos, todos os textos) | pronto | pronto | abre com os 12 cartões; B3 não ocorre aqui |
| Lote completo (todos os 37) | pronto | pronto | |
| Aba de 1 dia | pronto, salvo B3 | pronto, salvo B3 | |
| Zero medido | pronto | pronto | |
| Desligados pelo canal | pronto | pronto | |
| Não coletado (2 motivos) | pronto | pronto | |
| Antes da coleta | pronto | pronto | |
| Fecha em dd/mm (vídeo novo) | pronto | pronto | |
| Carregando | pronto | pronto | |
| Erro de leitura | pronto | pronto | |
| Só leitura, sem o texto | volta (B2) | volta (B2) | |
| Só leitura, com o texto sem o nome | pronto | pronto | |
| Página do canal, M11 com dado | volta (B1) | volta (B1) | |
| Página do canal, M11 fecha em dd/mm | volta (B4) | volta (B4) | |
| Página do canal, M11 não medido | pronto | pronto | |

Todas as telas, nas duas larguras e nos dois temas (cruzei os quatro: 1440 e 390, escuro e claro): rolagem horizontal 0, nenhum texto abaixo de 12 px, nenhum alvo abaixo de 44 x 44 px a 390 px (ponteiro grosso), nenhum `color-mix()` (o `grep` só acha comentários "sem color-mix"). Medidas em `shots/r2/medidas-r2.json`; script em `shots/r2/medir-r2.mjs`.

## A pergunta de quem abre

"O que o público destacou neste vídeo, e o criador respondeu a quem?"

Resposta no primeiro olhar, sem rolar, no 1440 escuro típico: **sim.** A frase-resumo ("Com 7 dias, guardamos **12 dos 100** primeiros comentários que o YouTube mostra...: 8 mais curtidos e 4 com o criador"), a barra "12 de 100" e a fileira de 12 casas (polegar areia, microfone azul, olho violeta, alvo coral) aparecem juntas acima da dobra de 900 px (a seção começa em y=655 e a fileira termina em y=915; a legenda e o primeiro cartão ficam logo abaixo). A casa ainda lê em escala de cinza (`shots/r2/ev-escala-de-cinza.png`): o símbolo basta, a cor só reforça.

## O que a r1 provavelmente cobrou e hoje está resolvido (conferido na tela, não no código)

- Frase-resumo num só `<span>`, com o número em destaque; a 390 px ela quebra em 4 linhas sem separar o negrito do resto.
- Régua/barra: "12 de 100" (e "12 de 37 (todos)"), barra de curtidas por idade na mesma escala em todos os cartões.
- Cor estável por motivo, com símbolo em toda casa, selo e legenda. Mínimo medido de elemento gráfico nas casas: 4,24:1 (azul, tema claro, 390) e máximo 12,81:1. Todos acima de 3:1.
- Zero medido (caixa vazada com 0, borda 4,64 a 5,36:1), não medido (hachura rosa, borda 4,09 a 4,57:1) e ainda não existe (pontilhado, 5,24:1) são três formas diferentes. "fora dos 12" é hachura, nunca 0.
- Método no ⓘ, com a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube." nos três popovers (seção, canal grande e M11). Os sete limites estão no ⓘ do canal grande.
- Texto de terceiros num bloco neutro, sem cor; endereço como texto com a linha "Aqui ele é só texto, não abre."; árabe alinhado à direita; emoji e japonês renderizam; palavra longa e endereço de 200 caracteres sem rolagem a 390 px; "Ver tudo" (44 px a 390) e "Mostrar menos" funcionam com `aria-expanded`.
- Abas com `role="tablist"`, seta esquerda/direita troca a aba e o painel (`aria-live="polite"`), `tabindex` móvel (-1 nas inativas). Foco visível em todo controle (2 px `--accent`, medido).
- Ordem de tabulação: abas, ⓘ, 12 casas (cada uma com `aria-label` "Comentário N de 12, motivo, curtidas" e leva ao cartão `#c-N`), "Ver os 3 que saíram", ⓘ do canal grande, "Ver na fila", "Ver tudo". Esc fecha o ⓘ e devolve o foco ao botão.
- Contraste de texto medido nos quatro cruzamentos: o menor é 4,78:1 ("respondeu", 12,5 px, escuro 1440); todo o resto do texto fica em 5,1:1 ou mais. O script marcou 1,07:1 e 1,20:1 na inicial "L" do criador no tema claro, **falso positivo**: o fundo é um `linear-gradient` (HSL 30% e 20% de luminosidade) e o texto é branco; a captura mostra disco escuro com letra branca legível.
- Português sem jargão: não achei "lido", "gravou", "série", "snapshot", "payload", "retenção" nem "pipeline" na tela. A tela diz "guardamos 12 dos 100 primeiros comentários que o YouTube mostra" (dúvida 1 das NOTAS; mantenho, é o mais restrito e segue a regra do dono).
- Nenhuma frase diz "não respondeu": "Não vimos resposta do criador" (zero medido, caixa com 0) e "Não sabemos se o criador respondeu" (hachura com interrogação) têm forma própria. "O YouTube não diz por quê" na pastilha de "saiu do YouTube" e o atalho para a fila: presentes.
- Perguntas 9 e 10: nenhuma tela usa "verificado" nem "famoso" (a palavra "famosa" só aparece no ⓘ, no limite 5, entre aspas, para dizer que não é dado). Pergunta 41: os dois níveis de só leitura estão desenhados; ver B2.

## Bloqueios (não vão ao dono até corrigir)

### B1. M11 "com dado": os números da mesma tela não fecham (página do canal, `?caso=canal`, 1440 e 390)

Captura: `shots/r2/ev-m11-1440-escuro.png` e `shots/r2/ev-m11-390-claro.png`.

- O cabeçalho diz "14 vídeos nos últimos 90 dias" e a frase diz "Leo respondeu a comentários em **5 de 14** vídeos dos últimos 90 dias (36%)". A fileira tem **17 casas** (5 azuis + 9 vazadas + 3 pontilhadas "ainda sem retrato de 30 dias, fora da conta"; confirmado: `ol` com 17 `role="img"`). 5 + 9 = 14 são os vídeos com retrato de 30 dias; os 3 pontilhados são a mais. A frase afirma "dos últimos 90 dias" e deixa 3 vídeos de fora sem dizer; o `aria-label` da lista diz "Um vídeo por casa, dos últimos 90 dias" (17).
- Na lista logo abaixo: "Leo respondeu a **4 comentários** guardados, **em 3 vídeos**", mas M11 acabou de dizer que ele respondeu em **5 vídeos**. Dois números sobre a mesma coisa, na mesma tela, que não batem. O dono, que cobra "nenhuma frase afirma mais do que o dado sustenta", vai ver.

Correção exata (`c20.js`, `paginaCanal`, estado `cheio`):
1. Frase: "Leo respondeu a comentários em **5 de 14** vídeos com retrato de 30 dias (**36%**). Outros 3 vídeos recentes ainda não fecharam os 30 dias. É um mínimo: ...". O cabeçalho do canal passa a "17 vídeos nos últimos 90 dias" (no estado `cheio`; os outros dois estados já fecham em 14).
2. `aria-label` da lista: "Um vídeo por casa, dos últimos 90 dias: 17 vídeos".
3. Lista "O que o criador respondeu": acrescentar itens para que apareçam respostas em 5 vídeos (hoje 4 comentários em 3), com a frase "Leo respondeu a **6 comentários** guardados, em 5 vídeos"; ou, se a lista é de propósito curta, "Os 4 mais recentes de 6 comentários com resposta dele". Qualquer das duas, mas o número de vídeos tem de ser 5.

### B2. Só leitura "sem o texto": a faixa afirma o contrário da regra da pergunta 41 e do ⓘ (`?caso=leitura`)

Captura: `shots/r2/ev-leitura-1440-escuro.png`. A faixa diz: "O texto, o nome e a foto são de terceiros e ficam reservados a quem tem o direito 'ver desempenho privado' ou edita o site." Isso diz que quem tem "ver desempenho privado" vê o **nome e a foto**. A regra desenhada (spec 4.6.9 ponto 10, pergunta 41, o estado "só leitura com o texto, sem o nome" e o ⓘ "Só quem edita o site vê o nome e a foto") é: quem tem esse direito vê o texto, **não** o nome nem a foto. A tela se desmente em duas faixas.

Correção exata: "**Você vê quantos comentários há e como cada um evoluiu.** O texto fica reservado a quem tem o direito “ver desempenho privado” ou edita o site; o nome e a foto, só a quem edita." (Fica em duas linhas a 1440 e em quatro a 390, dentro da caixa que já existe.)

### B3. "Mostrar os outros 7": o foco se perde (típico, teclado, 1440 e 390)

Teste: foco no botão, Enter. Resultado medido: os 12 cartões aparecem, `document.activeElement` vira `BODY`; o botão continua com o texto "Mostrar os outros 7" e `aria-expanded="false"` (agora escondido). Quem usa teclado volta ao topo da página e tem de tabular tudo de novo (ordem de foco, item 6 do meu critério). Mesma queda de foco ao ir por uma casa da fileira (`#c-9`): o hash muda, mas o foco fica em `BODY`.

Correção exata: depois de expandir, mover o foco para o primeiro cartão revelado (cartão com `tabindex="-1"` e `.focus({preventScroll:false})`), e atualizar o botão para "Mostrar só os 5 primeiros" com `aria-expanded="true"` (como o "Ver tudo", que já faz certo), ou removê-lo depois de mover o foco. Nas casas, dar `tabindex="-1"` ao cartão de destino e chamar `.focus()` nele ao ativar o link. Acrescentar uma nota nas NOTAS ("o foco vai para o cartão").

### B4. Plural errado: "em 1 vídeos" (página do canal, `?caso=canal-fecha`)

Captura: `shots/r2/ev-m11-fecha-1440-escuro.png`: "Leo respondeu a 2 comentários guardados, **em 1 vídeos**." O texto é montado por concatenação (`' vídeos'` fixo). Correção: usar `L.pl(n, 'vídeo', 'vídeos')` (que já existe no lote 1) nas três frases (cheio, fecha, nm), e o mesmo para "comentário(s)". Conferir "1 comentários" no mesmo trecho.

## Melhorias (não bloqueiam)

1. **Trilho da barra com contorno fraco.** `.cd-bar` (barra "12 de 100" e as barras de curtidas) usa `border: 1px solid var(--border)`: 1,36:1 no escuro e 1,26:1 no claro (calculado dos tokens). O preenchimento (`--muted`) tem 6,92 e 6,43:1 contra o fundo da barra, então o número se lê; o que some é o fim do trilho (a prova visual de "12 de 100"). As CONVENCOES já mandam usar `--dim` em controle sem texto (5,44 e 5,04:1). Trocar a borda para `--dim`.
2. **Zero medido sem o 0 na casa do M11.** As casas "não vimos resposta" (`.cd-casa.m11.nao`) são caixa vazada sem o algarismo (os cartões e a legenda do vídeo trazem o 0 dentro). A borda é a certa (`--im-zero`, 4,64 a 5,36:1), e a legenda diz "9 vídeos em que não vimos resposta"; só falta o 0 para ficar igual à convenção 6. A 28 px na legenda cabe.
3. **Frase com "0 medido" ao lado de "1 autor com inscritos ocultos".** "nenhum canal grande entre os 20 mais curtidos" (com o 0) e, logo abaixo, a pastilha rosa "1 autor com inscritos ocultos" dizem juntos a verdade, mas o 0 sozinho lido de relance afirma 20 de 20 medidos. Dizer na legenda "nenhum canal grande entre os 19 que deu para medir" quando há ocultos; sem ocultos, a frase de hoje.
4. **Exemplo do comentário que saiu do YouTube.** No extremo, o cartão 10 diz "Não veio mais do YouTube desde 12/10" e mostra 240 curtidas aos 7 dias, um retrato de 13/10. Um comentário que sumiu em 12/10 não tem retrato de 13/10. Trocar a data para "desde 13/10" (hoje) ou tirar a medida de 7 dias desse cartão. É dado de exemplo, mas o dono lê datas.
5. **Só leitura sem texto esconde o nome do criador.** O cartão 2 (Leo, "criador") mostra "Autor reservado" em `?caso=leitura` e "Leo" em `?caso=leitura-privado`. O spec 4.6.9 (9b) diz que o criador e o canal acompanhado aparecem sempre com nome, vindos do cadastro. Mostrar "Leo" nos dois, ou registrar a razão nas NOTAS.
6. **Tecla End nas abas.** `End` com o foco em "1 dia" não vai para "30 dias" (a aba "fecha em 05/11" não recebe foco por End). Home e End fazem parte do padrão de abas; ou ativar a 30 dias, ou documentar que ela é pulada.
7. **Dois ⓘ com o mesmo nome acessível** ("Como escolhemos os comentários": no título e ao lado da frase-resumo). Um leitor de tela anuncia dois botões iguais. Manter só o da frase, ou nomear o segundo "Como contamos os 12 de 100".
8. **ⓘ do título a 390 px.** Com o título, a marca "exemplo" e o ⓘ, o ⓘ cai sozinho na linha de baixo, à esquerda, com 40 px de vazio (visível na captura típica 390). Deixar o ⓘ na linha da marca ("exemplo" mais curto ou título em 17 px).
9. **Frase-resumo e "o criador respondeu quem?".** A pergunta do dono tem duas metades; a frase só responde à primeira ("4 com o criador" não distingue "comentou" de "respondeu"). Sugestão: "...8 mais curtidos e 4 em conversa com o criador (ele respondeu em 3)", se o dado permitir.
10. **Textos secundários de estado em 2 linhas** ("Não é zero comentários e não é falha nossa: ninguém pode comentar... Se o canal religar..."). São curtos e dizem o que houve e o que fazer (convenção 13), então não reprovo; se o dono achar que é prosa, o ⓘ da seção é o lugar.

## Tabela de medidas

Texto, contraste calculado dos valores lidos do navegador (cor do texto sobre o fundo efetivo composto), nos quatro cruzamentos. Elemento gráfico: borda ou preenchimento contra o fundo da casa.

| Elemento | Escuro 1440 | Claro 390 | Limite |
|---|---|---|---|
| Texto menor (todos os estados) | 4,78 ("respondeu" 12,5 px); o resto 5,1 ou mais | 5,1 ou mais | 4,5 |
| Texto das abas (ativa) | 14,48 | 15,76 | 4,5 |
| Casa: mais curtido (borda / ícone) | 12,81 / 9,36 | 7,97 / 6,93 | 3 |
| Casa: com o criador | 7,34 / 5,73 | 4,24 / 3,79 | 3 |
| Casa: canal que você acompanha | 6,56 / 5,10 | 6,37 / 5,61 | 3 |
| Casa: canal grande | 5,76 / 4,53 | 4,91 / 4,35 | 3 |
| Caixa de zero medido (borda) | 5,36 | 4,64 | 3 |
| Pastilha de não medido (borda) | 4,09 a 4,40 | 4,38 a 4,57 | 3 |
| Aba (borda) | 5,24 | 5,35 | 3 |
| Casa do M11: com resposta / zero medido / pontilhada | 7,34 / 5,36 / 5,24 | 4,24 / 4,64 / 5,35 | 3 |
| Barra de curtidas, preenchimento | 6,92 | 6,43 | 3 |
| Barra de curtidas, borda do trilho | 1,36 | 1,26 | 3 (ver melhoria 1) |

| Alvo de toque a 390 px (ponteiro grosso) | Medido |
|---|---|
| Casa da fileira (12) | 52 x 44 |
| ⓘ | 44 x 44 |
| "Mostrar os outros 7", "Ver tudo", "Ver na fila", "Tentar de novo" | 110 x 108 (as 3 colunas de abas), 86 x 44, 81 x 44, 224 x 44 |
| Menor alvo fora de `.fora` | 44 x 44 |

A 1440 px os `.btn` ficam com 34 px e o ⓘ com 28 px, como o lote 1 aprovado (convenção: 44 px só em ponteiro grosso ou abaixo de 640 px; `.ibtn` compacto de 28 px acima de 900 px em ponteiro fino).

| Largura | Altura da página (típico) | Rolagem horizontal |
|---|---|---|
| 1440 | 3.685 px (extremo 5.559; zero 2.032; erro 1.982) | 0 |
| 390 | 6.286 px (extremo 9.431; zero 3.627; erro 3.416) | 0 |

## O que não consegui verificar

- Leitor de tela (VoiceOver, NVDA): conferi só os atributos (`role`, `aria-label`, `aria-selected`, `aria-live`, `aria-expanded`), não o que é anunciado.
- Safari e Opera: só Chromium. O `color-mix()` está ausente, então o risco do Opera nesta tela é baixo, mas não abri no Opera do dono.
- Fontes reais: a captura bloqueia as fontes externas (cai nas do sistema), como o `capturar.mjs` faz de propósito; a largura de linha com Inter e JetBrains Mono pode mudar um pouco a quebra das frases.
- Foto real do autor que carrega ou não: o exemplo usa disco com ícone; o `onerror` com inicial só foi olhado no desenho do estado "foto que não carrega".
- Movimento reduzido: confirmei que existe a regra `prefers-reduced-motion` no CSS (1 bloco) e abri a página com a preferência ligada sem erro; não medi cada transição.
- Tema claro a 1440 e escuro a 390 foram gerados e passaram nas medidas; só olhei as capturas dos pares obrigatórios (1440 escuro e 390 claro).

## Arquivos desta rodada

- `shots/r2/medidas-r2.json` (medidas dos 64 cruzamentos) e `shots/r2/medir-r2.mjs` (script, porta própria, sem tocar na 3099).
- Evidências: `shots/r2/ev-m11-1440-escuro.png`, `ev-m11-390-claro.png`, `ev-m11-fecha-1440-escuro.png`, `ev-leitura-1440-escuro.png`, `ev-escala-de-cinza.png`.
- Nada fora de `docs/superpowers/mockups/2026-10-13-a5-lote-2/20-comentarios-de-destaque/` foi alterado; nada foi commitado.
