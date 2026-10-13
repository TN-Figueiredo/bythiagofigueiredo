# Revisão de UX, rodada 3: mockup 20, Comentários de destaque do vídeo de concorrente

Revisor: engenheiro sênior de UX. Data: 13/10/2026. Escopo: conferir se os 4 bloqueios da r2 foram resolvidos e se os ajustes (arquivos de 12:44 a 12:46) criaram defeito novo. Medi de novo os 16 estados em 1440 e 390, nos dois temas (64 cruzamentos), abrindo o arquivo por servidor estático próprio (portas 47772 a 47777, derrubadas ao fim; a 3099 e os specs do projeto não foram tocados). Capturas e medidas em `shots/r3/` (`medidas-r3.json`, `ev-popover-1440-escuro.png`, uma captura por estado e largura); script em `shots/medir-r3.mjs`.

## Veredito: NAO_PODE. 2 bloqueios, ambos de dado de exemplo que se contradiz na tela. Os 4 bloqueios da r2 estão resolvidos.

Nada de desenho, cor, símbolo, layout ou comportamento voltou a ser problema. Os dois bloqueios são de conserto curto, só em `c20-dados.js` e na regra da frase "Não sabemos" em `c20.js` (uma linha).

## Os 4 bloqueios da r2, um a um (conferido por teste e por captura)

| r2 | Situação | Evidência medida |
|---|---|---|
| B1, M11 com dado: números que não fecham | **Resolvido** | `?caso=canal`: cabeçalho "17 vídeos nos últimos 90 dias"; frase "5 de 14 vídeos com retrato de 30 dias (36%). Outros 3 vídeos recentes ainda não fecharam"; fileira com 17 casas (5 + 9 + 3) e `aria-label` "...: 17 vídeos"; lista "6 comentários guardados, em 5 vídeos" e a captura mostra 5 títulos diferentes (Mochilão x2, Dez dias, Pho, Hoi An, Quanto custou). `canal-fecha` e `canal-nm` fecham em 14. |
| B2, faixa do só leitura sem o texto | **Resolvido** | Faixa agora: "Você vê quantos comentários há e como cada um evoluiu. O texto fica reservado a quem tem o direito “ver desempenho privado” ou edita o site; o nome e a foto, só a quem edita." Concorda com o ⓘ e com o estado "com o texto, sem o nome". |
| B3, foco perdido | **Resolvido** | Enter em "Mostrar os outros 7": `activeElement` = `ARTICLE#c-6`, botão vira "Mostrar só os 5 primeiros" com `aria-expanded="true"`; recolher devolve o foco ao botão (5 cartões visíveis). Casa da fileira (nº 7): foco em `ARTICLE#c-7`, hash `#c-7`. Anel de foco 2 px sólido `--accent`. |
| B4, "em 1 vídeos" | **Resolvido** | `canal-fecha`: "2 comentários guardados, em 1 vídeo"; `canal-nm`: "3 comentários, em 2 vídeos". |

Melhorias da r2 que conferi no ar: trilho da barra agora 4,86:1 (escuro) e 5,59:1 (claro) contra o fundo (era 1,36 e 1,26); 0 dentro da casa do M11 e na legenda ("9 vídeos em que não vimos resposta"); "entre os 19 que deu para medir" quando há ocultos; "desde 13/10" no cartão que saiu; Leo com nome nos dois níveis de só leitura; Home vai a "1 dia" e End a "30 dias" (a aba "fecha em 05/11" recebe foco e mostra "ainda não existe"); os dois ⓘ têm nomes diferentes ("Como escolhemos os comentários" e "Como contamos os 12 de 100 comentários"); a 390 px o ⓘ fica colado ao título e o "exemplo" desce. A frase "(ele respondeu a 3)" bate com os cartões (típico e extremo: cartões 4, 7 e 12 têm a resposta do Leo).

## Bloqueios novos (não vão ao dono até corrigir)

### B1. "O YouTube mostrou só 5 das 3 respostas" (estado "lote completo", `?caso=completo`, 1440 e 390)

Captura: `shots/r3/completo-1440-escuro.png` (cartão 1, faixa rosa com hachura). O vídeo pequeno reaproveita o conjunto do típico com `rep` reduzido, e o cartão 1 continua com `resp: 'ns'`. A tela diz, na mesma linha, "Publicado em 07/10 · 3 respostas" e "Não sabemos se o criador respondeu. O YouTube mostrou só 5 das 3 respostas e nenhuma é dele." É a frase mais grave do conjunto: afirma uma contagem impossível e, ainda por cima, diz "não sabemos" num vídeo em que o lote é completo e as 3 respostas foram conferidas.

Correção exata: em `c20-dados.js`, no conjunto `D.completo`, trocar o cartão 1 para `resp: 'nao'` (a faixa passa a ser a caixa vazada com 0: "Não vimos resposta do criador. Conferimos as 3 respostas que o YouTube mostrou e nenhuma é dele."). Para não voltar, em `c20.js` linha 115 só desenhar "Não sabemos" quando `c.rep > 5`; com `rep` até 5 o YouTube mostrou todas e a faixa é "Não vimos".

### B2. Datas de exemplo que contradizem o vídeo (estado "vídeo novo", `?caso=novo`; e a página do canal)

Capturas: `shots/r3/novo-1440-escuro.png`; `shots/r3/canal-1440-escuro.png`.

- **Vídeo novo.** O cabeçalho diz "Publicado em 10/10/2026 (há 3 dias)", mas 8 dos 12 cartões dizem "Publicado em 07/10", "06/10" ou "08/10": comentário publicado antes do vídeo. A aba "7 dias fecha em 17/10" e "30 dias fecha em 09/11" estão certas; só as datas dos cartões não. O dono lê datas (a r2 já cobrou isso na melhoria 4, feita para o cartão que saiu).
- **Página do canal, com dado.** A lista "O que o criador respondeu" traz dois comentários "de 06/09" no vídeo "Mochilão no Vietnã: o que eu faria diferente", que a página do vídeo diz publicado em 06/10. Mesma contradição, de outro lado. O mesmo acontece em `canal-nm` (06/09).

Correção exata: (a) no caso `novo` (c20.js, linha do `C.set === 'novo'`), recalcular `pub` de cada cartão para uma data entre 10/10 e 13/10, mantendo a ordem (ex.: 10/10, 10/10, 11/10, 11/10, 11/10, 12/10, 12/10, 12/10, 13/10...); (b) nas listas do canal (`cheio` e `nm`), trocar o título dos dois primeiros itens por outro vídeo mais antigo do mesmo canal (ex.: "Hanói em 48 horas: o roteiro que eu repetiria") e manter 06/09; os 5 vídeos distintos continuam 5.

## Melhorias (não bloqueiam)

1. **"Depois dos 30 dias nada é relido" no ⓘ da seção.** "Relido" é o "lido" que o dono proíbe, com prefixo. Trocar por "Depois dos 30 dias não guardamos mais nada deste vídeo."
2. **Casa vazia na fileira do M11 (`li.cd-gap`).** A `ol` tem 18 filhos para 17 vídeos (o espaço entre as casas com dado e as pontilhadas é um `li` sem papel). Dar `aria-hidden="true"` e `role="presentation"` a esse `li`.
3. **Textos secundários de 2 linhas** (desligados, não coletado, antes da coleta): continuo sem reprovar (dizem o que houve e o que fazer); se o dono achar prosa, o ⓘ da seção é o lugar.
4. **Tabela "Os quatro estados sem comentário" abaixo da tela** (referência do mockup, não faz parte da tela) usa "Nenhum comentário aos N dias" com "N" literal e frases do spec; está fora da tela e marcada, então não pede ajuste, mas convém o implementador não copiá-la.
5. **Página do vídeo a 390 px mede 6.276 px no típico.** É o preço dos cartões com texto de 3 a 4 linhas; os 5 por vez já seguram. Se o dono achar longo, baixar para 3 a 390 px é a alavanca.

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico | pronto | pronto | |
| Extremo (4 motivos, todos os textos) | pronto | pronto | |
| Lote completo (todos os 37) | **volta (B1)** | **volta (B1)** | "5 das 3 respostas" |
| Aba de 1 dia | pronto | pronto | |
| Zero medido | pronto | pronto | |
| Desligados pelo canal | pronto | pronto | |
| Não coletado (2 motivos) | pronto | pronto | |
| Antes da coleta | pronto | pronto | |
| Vídeo novo (fecha em dd/mm) | **volta (B2)** | **volta (B2)** | datas dos cartões anteriores ao vídeo |
| Carregando | pronto | pronto | |
| Erro de leitura | pronto | pronto | |
| Só leitura, sem o texto | pronto | pronto | B2 da r2 resolvido |
| Só leitura, com o texto sem o nome | pronto | pronto | |
| Página do canal, M11 com dado | pronto no desenho; **volta (B2)** só pelas datas | idem | B1 da r2 resolvido |
| Página do canal, M11 fecha em dd/mm | pronto | pronto | B4 da r2 resolvido |
| Página do canal, M11 não medido | pronto no desenho; datas 06/09 (B2) | idem | |

Largura: 1440 e 390 sem rolagem horizontal em todos os 16 estados, nos dois temas (0 px). Nenhum texto abaixo de 12 px. Nenhum alvo abaixo de 44 x 44 px a 390 px (ponteiro grosso), contados pelo script em links, botões, abas e `tabindex="0"`. Nenhum `color-mix()` fora de comentário (`grep` em `c20.css`, `c20.js`, `c20-dados.js`).

## A pergunta de quem abre

"O que o público destacou neste vídeo, e o criador respondeu quem?" Resposta de relance no 1440 escuro típico: sim. Frase-resumo ("Com 7 dias, guardamos 12 dos 100 ... 8 mais curtidos e 4 com o criador (ele respondeu a 3)"), barra "12 de 100" e fileira de 12 casas (cor e símbolo por motivo) cabem na primeira tela; zero medido (caixa com 0), não medido (hachura rosa) e "ainda não existe" (pontilhado) são três formas diferentes; método no ⓘ, com a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube."; sem "lido", "série", "snapshot", "retenção" na tela (só a melhoria 1, dentro do ⓘ).

## Tabela de medidas (lidas da página, tokens compostos sobre o fundo efetivo)

| Elemento | Escuro 1440 | Claro 390 | Limite |
|---|---|---|---|
| Texto menor de todos os estados | 4,78 ("respondeu", 12,5 px); o resto 5,1 ou mais | 5,1 ou mais | 4,5 |
| Texto das abas (subtítulo) / legenda | 14,48 / 15,61 | 15,76 / 15,09 | 4,5 |
| Trilho das barras (borda) | 4,86 | 5,59 | 3 |
| Preenchimento da barra de curtidas | 6,92 | 6,43 | 3 |
| Borda das abas | 5,24 | 5,35 | 3 |
| Zero medido: cartão / casa do M11 | 4,97 / 5,36 | 4,84 / 4,64 | 3 |
| Casas dos motivos (r2, CSS inalterado) | 4,53 a 12,81 | 3,79 a 7,97 | 3 |
| Foco | 2 px sólido `--accent` (255,130,64) | idem | visível |

Falsos positivos do script, conferidos: inicial "L" e "N" em disco com `linear-gradient` inline (HSL 30% e 20% de luminosidade) e texto branco; contraste real acima de 9:1, e a captura mostra a letra legível.

| Alvo de toque a 390 px | Medido |
|---|---|
| Casa da fileira | 52 x 44 |
| ⓘ | 44 x 44 |
| Abas (3 colunas) | 110 x 108 |
| "Mostrar os outros 7" / "Ver tudo" / "Ver na fila" / "Tentar de novo" | 44 de altura ou mais |
| Menor alvo fora de `.fora` | 44 x 44 |

| Largura | Altura da página (típico) | Rolagem horizontal |
|---|---|---|
| 1440 | 3.685 px (extremo 5.559; zero 2.032; erro 1.982) | 0 |
| 390 | 6.276 px (extremo 9.422; zero 3.617; erro 3.407) | 0 |

## O que não consegui verificar

- Leitor de tela (VoiceOver, NVDA): conferi só os atributos e os nomes acessíveis; não ouvi o que é anunciado.
- Safari e Opera: só Chromium. Sem `color-mix()`, o risco do Opera é baixo, mas não abri no navegador do dono.
- Fontes reais (Inter, JetBrains Mono, Fraunces): a captura bloqueia as externas e cai nas do sistema; a quebra de linha pode mudar um pouco.
- Escala de cinza: não refiz nesta rodada; a r2 a conferiu (`shots/r2/ev-escala-de-cinza.png`) e nenhum símbolo nem forma de estado mudou.
- Tema claro a 1440 e escuro a 390 foram gerados e medidos; só olhei as capturas dos pares obrigatórios (1440 escuro e 390 claro) e as páginas do canal.
- Movimento reduzido: `prefers-reduced-motion` existe em `a4.css`; não medi cada transição.

## Arquivos desta rodada

`shots/r3/medidas-r3.json`, `shots/r3/*.png` (64 capturas), `shots/r3/ev-popover-1440-escuro.png`, `shots/medir-r3.mjs`. Nada fora de `docs/superpowers/mockups/2026-10-13-a5-lote-2/20-comentarios-de-destaque/` foi alterado; nada foi commitado.
