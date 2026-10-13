# Revisão de UX, rodada 1: mockup 22 "Perguntar a uma IA" (13/10/2026)

Revisor: `revisor-ux-senior`. Não editei nada do mockup. Servi a pasta por HTTP na porta 47768 (derrubada ao fim) com Playwright/Chromium headless próprio, sem a porta 3099, sem o projeto de e2e. Abri a tela de verdade em 1440 e 390 px (toque a 390), nos dois temas, e também em 1440x720, 1280x680 e 390x844 (viewport real, não página inteira). Julguei pelas capturas (as do desenhista e as minhas, em `/private/tmp/claude-501/.../scratchpad/ux22/`, fora do repositório) e medi com `getComputedStyle` e `getBoundingClientRect`. Li PLANO.md, NOTAS.md, CONVENCOES.md, `pi.js`, `pi-dados.js`, `pi.css` e o spec 8.1.5 (linhas 169-193).

## Veredito: NÃO PODE ir ao dono ainda. Volta para ajuste (2 bloqueios, 3 corrige).

A tela é boa. A forma central (as quatro linhas "o que ficou de fora", a barra de tamanho com corte desenhado, a régua medido / zero medido / não medido) responde de relance e é coerente com o lote 1. Dois defeitos concretos, ambos de regra dura do dono, seguram a aprovação. Os dois se resolvem em poucas linhas de `pi.js` e `pi-dados.js`.

### Pergunta de quem abre
"O que vai sair do site, cabe numa mensagem, e o que ficou de fora?" Resposta no primeiro olhar a 1440: frase-resumo no topo ("Pacote da tela Comparar: 7 tabelas, 12.400 caracteres, nada privado"), barra com a marca de 30.000, as quatro linhas com ✓ / tesoura / cadeado / círculo pontilhado. Passa nos 3 segundos, sem rolar, no escuro a 1440. A 390 a mesma ordem cabe no primeiro quadro (frase, tamanho, números, o que ficou de fora) e os botões ficam fixos no rodapé.

## Resumo por estado e largura

Par obrigatório = 1440 escuro e 390 claro. Cruzamentos que olhei: típico 1440 claro, típico e leitura 390 escuro/claro.

| Estado | 1440 escuro | 390 claro | Veredito |
|---|---|---|---|
| Típico (Comparar) | ok | ok | pronto |
| Copiado | ok | ok | pronto |
| Falhou ao copiar | ok (Baixar vira principal) | ok | pronto |
| Cortado por tamanho (Mudanças, 41.800) | B1 (prosa e "séries"); resto ok | idem | volta |
| Passa do arquivo completo (Canais, 262.400) | B1 | B1 | volta |
| Zero medido (Outliers) | ok | ok | pronto |
| Não medido / magro (Canal) | C2 (nota repete a frase) | C2 | volta (corrige) |
| Vazio | C2 | C2 | volta (corrige) |
| Só leitura, sem o direito (Vídeo próprio) | B2 (dobra "0 caracteres") | B2 | volta |
| Com dado privado | C3 (3 linhas de prosa) | idem | volta (corrige) |
| Comentários de terceiros | C3 | C3 | volta (corrige) |
| Erro ao montar | ok | ok | pronto |
| Carregando | C1 | C1 | volta (corrige) |
| Tela fechada (botão) | ok | ok | pronto |
| Mapa dos 11 quadros | ok como posição (ver M1) | ok | pronto |

## Bloqueios (impedem ir ao dono)

### B1. "Por tamanho" quando cortou: parágrafo de prosa com a palavra proibida "série"
- Telas e estados: `?estado=extremo` (Mudanças) e `?estado=extremo2` (Canais), 1440 e 390. Capturas: `shots/extremo-1440-escuro.png`, `shots/extremo2-390-claro.png`.
- O que está errado: a linha que explica o corte, a mais importante do estado, tem 4 linhas de texto corrido a 12,5 px ("Saíram primeiro as séries dia a dia de 8 canais (7.300 caracteres) e depois as linhas da tabela de trocas além da 25ª (4.500). Definições e avisos nunca saem. O arquivo completo leva os 11.800 que a cópia não levou."). CONVENCOES 1.7 (nada de parágrafo de prosa) e 1.8 (proibido "série" na tela) estão violadas no mesmo trecho. O dono reprova exatamente isto. A fonte do texto é `T.corte` em `pi-dados.js` linhas 40 e 121 e a montagem em `pi.js` linha 162.
- A frase ainda mistura três números (7.300, 4.500, 11.800) que o olho tem de somar sozinho: 7.300 + 4.500 = 11.800, fecha, mas ninguém vê isso.
- Conserto exato: trocar a prosa por uma lista de **no máximo duas linhas curtas, cada uma com número em mono alinhado à direita**: "dia a dia de 8 canais   7.300" e "linhas além da 25ª da tabela de trocas   4.500". Trocar "séries dia a dia" por "gráficos dia a dia" ou "números dia a dia". A frase "Definições e avisos nunca saem" vai para o ⓘ "Como o tamanho é medido e cortado" (já está lá). A frase "O arquivo completo leva os 11.800..." já está desenhada duas vezes (legenda da barra "11.800 só no arquivo completo" e botão "Baixar completo (41.800)"): cortar da linha. Em `extremo2`, a mesma lista (60 canais dia a dia 170.000; 62.400 "não saem": a legenda da barra já diz isso, cortar da linha).

### B2. Estado "só leitura": a dobra da prévia diz "0 caracteres no meio" e as contas não fecham
- Tela e estado: `?estado=leitura` (Vídeo próprio sem o direito), 1440 e 390. Captura: `shots/leitura-1440-escuro.png`.
- O que está errado: o diálogo diz "Tamanho 2.470 caracteres" e a dobra da prévia diz "⋯ 0 caracteres no meio: resto da seção 4 (4 tabelas), 5. Definições e método e 6. Avisos". Zero caracteres não comporta quatro tabelas, definições e avisos. Medi: texto visível 1.550 + dobra 0 + segunda dobra 1.600 = 3.150, não 2.470 (nos outros estados fecha: típico 1.872+8.188+2.340 = 12.400; privado 1.814+5.686+1.600 = 9.100; cortado 1.548+26.752+1.700 = 30.000; magro 1.696+684+520 = 2.900; comentários 1.648+4.252+1.300 = 7.200). A dobra de `leitura` foi calculada com `Math.max(0, ...)`, escondendo um total pequeno demais. É "frase que afirma mais do que o dado sustenta" e contradiz o cabeçalho da própria prévia (o lote 1 tratou o mesmo tipo de contradição como bloqueio).
- Conserto exato: o total do estado `leitura` (2.470) tem de ser pelo menos texto visível + dobra + fim (hoje 3.150 sem nenhuma dobra). Subir o total para um valor coerente (por exemplo 6.350 com a dobra do meio em ~3.200) e refazer a barra, a frase-resumo, a legenda, o ⓘ e a linha de dado privado a partir dele; ou, se a ideia é que o pacote sem o direito é pequeno, mostrar só um bloco de dobra (sem a "seção 4 (4 tabelas)") e descrever o texto como é. Depois de corrigir, rodar a conta visível + dobras = total em todos os estados do `?tela=` (só os 6 estados do `?estado=` foram conferidos aqui).

## Corrige (vai ao dono só depois de corrigido)

### C1. Carregando: "Copiar texto" aparece ligado, em laranja cheio
- `?estado=carregando`, `shots/carregando-1440-escuro.png` e `-390-claro.png`. O botão está `aria-disabled="true"` (pi.js linha 200), mas `.btn.pri` não tem estilo de desligado; o "Baixar .md" ao lado fica tracejado e apagado, o "Copiar texto" fica laranja cheio e parece clicável. Quem toca copia o quê?
- Conserto: estilo único para `.btn[aria-disabled="true"]` (borda tracejada, texto em `--dim`, sem fundo cheio) aplicado também ao `.pri`; ou remover os dois botões de ação enquanto carrega e deixar só "Fechar". O texto "Montando o pacote..." aparece duas vezes (frase-resumo e acima dos botões): deixar só o do topo.

### C2. Nota de caso magro e de vazio repete a frase-resumo e a primeira linha da prévia
- `?estado=nm` e `?estado=vazio`, `shots/nm-390-claro.png`, `shots/vazio-390-claro.png`. A caixa tracejada ("Quase tudo nesta tela está não medido. O texto diz isso na primeira linha, em vez de uma tabela de traços.") é uma segunda frase corrida dizendo o que a frase-resumo ("só 2 de 16 números medidos") e a faixa rosa da prévia já dizem. Ocupa 3 linhas a 390.
- Conserto: cortar a nota. A frase-resumo com a hachura e a faixa de AVISO na prévia bastam; se quiser manter uma explicação de "o texto avisa a IA", ela vai para o ⓘ "O que quer dizer medido, zero medido e não medido".

### C3. Detalhes de "dado privado" e "comentários" são prosa de 2 a 3 linhas
- `?estado=privado`, `?estado=leitura`, `?estado=comentarios`, `shots/privado-1440-escuro.png`, `shots/leitura-1440-escuro.png`, `shots/comentarios-1440-escuro.png`. Exemplos: "Você não tem o direito “ver desempenho privado”. Ficou de fora: impressões por dia e cliques estimados. O texto avisa a IA de que existe e foi omitido." (3 linhas) e "14 comentários, sem o nome de quem escreveu, marcados como texto de terceiros." O estado "não incluído" é o único em que a pessoa precisa de uma instrução; os outros só repetem o que a pastilha diz.
- Conserto: reduzir cada detalhe a uma linha com o que ficou de fora e o número ("impressões por dia, cliques estimados · 14 comentários"). "Sem o nome de quem escreveu, marcados como texto de terceiros" já está no ⓘ "Como o pacote é montado" e nas primeiras linhas da prévia: tirar da linha.

## Sugestões (não bloqueiam)

- **S1. A mesma cor âmbar significa três coisas dentro do diálogo** (cortado, não incluído por falta de direito, aviso fixo "sai do site"). O símbolo separa as duas primeiras (tesoura x cadeado), mas "nunca entram" também leva um cadeado, em cinza: em escala de cinza o cadeado de "não incluído" e o de "nunca entram" são o mesmo desenho e só a palavra os separa. Troque o ícone de "nunca entram" por um escudo ou uma chave riscada.
- **S2. Dado privado incluído: duas cores para o mesmo fato.** Quem tem o direito vê a pastilha laranja "inclui dado privado do canal" na frase-resumo e, duas linhas abaixo, a linha verde "incluído". Pode ser o desejado (laranja = "seu canal", verde = "entrou"), mas o dono vai perguntar. Declare no LEIAME ou unifique em laranja nas duas.
- **S3. "medido" na régua de números é areia/marrom (`--lado-n`).** No lote 1 o mesmo triplo (medido / zero / não medido) na faixa de 7 casas usava laranja para "com impressões". É escolha defensável (laranja é "seu canal"), mas `--lado-n` é "lado neutro de uma comparação", então o token ganha um segundo sentido. Registre na `REVISAO` do lote ou use um token próprio de "medido" com os mesmos hex.
- **S4. Estado "comentários": o bloco de texto de terceiros (linhas com `│ `) fica no meio da prévia, fora da primeira dobra de rolagem.** O dono quer ver como o comentário anônimo aparece (spec 8.1.5). Rolar a prévia sozinha até o primeiro comentário nesse estado, ou abrir já nele.
- **S5. Altura útil do diálogo.** A 1440x900 o típico cabe sem rolar. A 1440x720 e 1280x680 o miolo rola (447/632 e 409/632 px) com a prévia rolando por dentro (391/1016): duas rolagens aninhadas. O rodapé com os botões continua visível, então não é bloqueio. Em `?tela=canal-proprio&direito=0` a 1440x900 a linha "Exemplos:" é cortada no meio pelo rodapé (ver `canal_proprio_direito_0`). Considerar a prévia com altura fixa menor quando a coluna esquerda crescer.
- **S6. Mapa dos 11 quadros é esquemático.** Mostra a posição do botão, mas só Comparar tem tela de trás desenhada (as outras dez são retângulos). O dono aprova "uma posição só" sem ver como o botão se comporta junto do `L.videoCab` e do cabeçalho do canal próprio, que são os dois cabeçalhos mais cheios. Se for barato, desenhar a faixa de topo real (migalha + botão) a 390 para Vídeo e Vídeo próprio.
- **S7. Palavras de engenharia visíveis.** "Markdown", ".md" e "Baixar .md" estão no spec; "diário" aparece na tabela de exemplo da prévia ("aguarda o 2º registro diário", `pi-dados.js` linha 64), que é palavra proibida na tela. Trocar por "aguarda o 2º registro do dia".
- **S8. Grafia do `aria-label` das barras.** "18 números medidos, 0 zero medido, 4 não medidos": usar "0 zeros medidos" (ou "nenhum zero medido"). A frase "Montando o pacote" repete no `role="status"`, bom, mas o `status` vazio do estado normal poderia sair da árvore.

## Medidas

Contraste calculado a partir dos valores lidos da página (cor composta sobre o fundo composto), texto, nos dois temas e nos estados `tipico`, `extremo`, `nm`, `leitura`, `privado`, `falhou`, `erro`, `vazio`:

| Elemento | Escuro | Claro | Mínimo | Resultado |
|---|---|---|---|---|
| Texto menor razão (escuro, "Markdown · início e fim", 12,5 px) | 5,90:1 | | 4,5 | passa |
| Texto de apoio `--muted` ("exemplo", legendas) | 6,18:1 | 6,43:1 (cartão de prévia) | 4,5 | passa |
| "Copiar texto" (13 px, texto sobre `--accent`) | | 5,01:1 | 4,5 | passa, é o menor do conjunto |
| "não medido" na prévia (rosa sobre rosa claro) | | 6,37:1 | 4,5 | passa |
| Borda "zero medido" `--im-zero` sobre cartão | 4,97:1 | 4,84:1 | 3 | passa |
| Hachura/borda `--nm-line` | 4,09:1 | 4,57:1 | 3 | passa |
| Barra de tamanho, verde `--success` | 7,26:1 | 6,37:1 | 3 | passa |
| Barra cortada, âmbar `--warning` | 7,71:1 | 4,70:1 | 3 | passa |
| Fundo da hachura `--nm-bg` contra o cartão | 1,15:1 | 1,16:1 | n/a | só enfeite: a forma é dada pela borda e pela hachura |
| `--border` do cartão | 1,22:1 | 1,40:1 | n/a | só divisória, não carrega informação |

Alvos de toque a 390 px (ponteiro grosso), todos os controles do diálogo medidos: Fechar 44x44, os três ⓘ 44x44, Copiar 174x44, Baixar 174x44, Fechar (rodapé) 358x44, chips de exemplo 243x44 e 358x44, campo de pergunta 358x65. Botão que abre ("Perguntar a uma IA") 169x44. Nenhum alvo menor que 44.

Outras medidas:
- Rolagem horizontal da página: 0 em todos os estados e larguras (medidas.json do desenhista, e `scrollWidth` = 390 no meu teste).
- Fonte menor que 12 px: nenhuma.
- `grep color-mix`: só acha comentários "sem color-mix" em `pi.css`, `lote.css`, `a4.css`. Zero no CSS que carrega.
- Altura do diálogo: típico 1440x900 cabe (≈860 px); 1440x720 e 1280x680 rolam por dentro com rodapé visível.
- Foco: anel de 2 px `--accent` com 2 px de afastamento em todo controle (laço de 14 Tab: nenhum "sem anel", nenhum controle fora do diálogo). Foco inicial no título, como declarado (dúvida 3 do desenhista: concordo com o padrão adotado). Esc fecha o ⓘ primeiro e depois o diálogo (testado).
- Pergunta de 1.000 caracteres: contador mostra "1.000 de 1.000" e o total sobe 12.400 → 13.400 (a conta fecha).
- Fecha a conta: "Copiado: 12.434 caracteres" = 12.400 + 34 da pergunta digitada.
- Contas dos estados cortados fecham (30.000 + 11.800 = 41.800; 30.000 + 170.000 + 62.400 = 262.400; 1.480+12+96 = 1.588 na régua de Canais).
- aria: `dialog` com `aria-labelledby` (título) e `aria-describedby` (frase-resumo); barras com `role="img"` e `aria-label` por extenso; prévia `role="region"` com `tabindex="0"` e `aria-label`; `role="status"` no resultado, `role="alert"` na falha; campo com `<label for>` e `maxlength` 1000. Em ordem, sem pendência.

## Conferência do que o dono cobra

| Regra | Resultado |
|---|---|
| Frase-resumo no topo, um `<span>` | passa (todas as telas e estados) |
| Régua ou barra para comparar de relance | passa: barra de tamanho com corte e régua medido / zero / não medido |
| Cor estável por significado, "não medido" nunca com a cor de zero | passa (rosa hachurado x caixa azul-cinza x areia) |
| Símbolo junto da cor | passa (✓, tesoura, cadeado, círculo pontilhado, hachura); ver S1 |
| Método em botão ⓘ | passa (3 ⓘ, frase fixa do item 35 presente) |
| Zero medido x não medido distintos | passa, inclusive dentro do código da prévia |
| Nada de bloco monocromático nem de parágrafo de prosa | **falha**: B1, C2, C3 |
| Frases sem jargão interno | **falha**: "séries" em B1; "diário" em S7 |
| Sem `color-mix()` | passa |
| Escuro 1440 e claro 390 | passa (e cruzamentos) |
| Alvo 44x44, foco, aria | passa |
| Todos os estados desenhados (spec 98 e 99) | passa: cheio, magro, zero, não medido, vazio, erro, carregando, só leitura, com privado, comentários, cortado, passou, copiado, falhou |
| Consistência com o lote 1 | passa: mesmos tokens, `<dialog>` modal nativo, "+ novo" tracejado, ⓘ com popover, texto de pastilha em `--text`, nenhum matiz novo |
| Spec 8.1.5: botão em toda tela com modelo de tela (inclui canal e vídeo próprios e ritmo por hora), 30.000, "Baixar completo" até 200.000, comentários anônimos em bloco de terceiros, aviso fixo | passa; o bloco de comentários só aparece após rolar a prévia (S4) |
| Spec 8.1.4: "ver desempenho privado" muda o pacote e o diálogo diz o que ficou de fora | passa |

## O que não consegui verificar

- Leitor de tela (VoiceOver, NVDA): só conferi a árvore de atributos.
- Safari, Firefox e o Opera do dono: só Chromium headless.
- Toque real em celular: simulei ponteiro grosso e viewport de 390 px; não testei teclado virtual abrindo sobre a folha.
- `navigator.clipboard` real (o estado "falhou" é simulado; o "copiado" é de exemplo).
- Clique em "Baixar" (gera arquivo de exemplo).
- Ordem de Tab na tela de trás (ela é inerte quando o diálogo está aberto; a tela fechada tem só o botão).
- As telas `?tela=` de Lista de Canais, Saíram do YouTube e Ritmo por hora abrem o diálogo com o resumo certo, mas conferi por texto e por uma captura de cada, não por todos os cruzamentos.

## Próximo passo

Corrigir B1 e B2 (bloqueios) e C1 a C3, rodar a conta visível + dobras = total em todos os estados e telas, regerar `medidas.json` e as capturas dos estados tocados (`extremo`, `extremo2`, `leitura`, `carregando`, `nm`, `vazio`, `privado`, `comentarios`) e me chamar para a rodada 2. S1 a S8 ficam a critério de quem desenhou; as que forem recusadas, dizer por escrito.
