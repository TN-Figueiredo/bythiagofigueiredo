# Revisão de UX, mockup 16 (Lista de Canais: direção, estado, filtros), rodada 2, 13/10/2026

Revisor: `revisor-ux-senior`. Escopo: conferir se cada item da r1 (B1, C1 a C6, S1 a S9) foi resolvido e se o ajuste criou defeito novo. Material: REVISAO-UX-r1.md, NOTAS.md (seção 5), PLANO.md, `lista.css`, `lista.js`, `lista-dados.js`, as capturas `shots/caso-*` (refeitas às 12:27) e as minhas: script próprio em Chromium headless sobre servidor estático nas portas 47745 a 47748 (cada uma derrubada ao fim; nada na 3099, nenhum spec do projeto). Evidência desta rodada: `shots/r2-*.png` e `r2-medidas.json`. `grep color-mix(`: só aparece em comentário ("sem color-mix").

## Veredito

**NÃO PODE ir ao dono. 1 bloqueio (resíduo do C4 da r1, só a 1440), 4 melhorias.** B1 está resolvido de verdade: a barra agora tem a palavra embaixo de cada casa, a frase usa as mesmas palavras, e "descendo" deixou de se passar por "em queda". C1, C2, C3, C5 e C6 estão resolvidos. O C4 foi corrigido a 390 px e **não** a 1440 px, ao contrário do que a NOTAS afirma ("Conferido nas capturas de erro e extremo"). É um retoque de uma linha de CSS, mas é a captura obrigatória (1440 escuro) e o texto coberto é conteúdo do lote 1 já aprovado.

Pergunta do dono: "Algum canal que eu acompanho parou, está caindo ou sumiu, e quais estão subindo?" Resposta de relance: a frase diz parados, subindo e descendo na primeira linha; a barra repete com cor, símbolo e palavra; os chips de estado ficam no mesmo bloco. Passa nos 3 segundos nos dois tamanhos (a 390 o bloco inteiro cabe na primeira tela, de 370 a 733 px).

| Estado | 1440 escuro | 390 claro |
|---|---|---|
| típico (13/10) | pronto | pronto |
| completo (15/12) | pronto | pronto |
| extremo | **volta para ajuste (B1: tag cobre o e-mail do erro)** | pronto |
| zero (parados e em queda) | pronto | pronto |
| zero + filtro "parados" / direção "descendo" (vazio com zero medido) | pronto | pronto |
| magro | pronto | pronto |
| erro | **volta para ajuste (B1)** | pronto |
| fora do ar / "Saiu do YouTube" | pronto (M1) | pronto (M3) |
| carregando | pronto (visto só por medida: 4 casas de 40 px, frase em 1 linha) | idem |
| só leitura | pronto (M2) | pronto |
| 78 canais / nicho IA | **volta para ajuste (B1: o nicho IA tem linha em erro)** | pronto |
| típico + filtro "em queda" (vazio explicado) | pronto | pronto |
| típico + filtro "parados" | pronto | pronto |

## Conferência da r1, item por item

| Item | Resultado |
|---|---|
| B1 barra x frase | **Resolvido.** `shots/r2-tipico-1440-escuro-resumo.png`: "2 canais parados, 5 subindo, 3 descendo. Em queda sustentada (...) só dá para medir a partir de 14/12." e embaixo "subindo / sem mudança / descendo / não medido". A palavra "queda" só aparece onde a regra de 3 períodos vale. Zero medido é caixa vazada com 0 (extremo: "▲ 0 subindo"), não medido é hachura, e as duas formas não se confundem. Completo: "(1 em queda sustentada)" bate com o chip "Em queda". Contas fecham: 5+4+3+3=15 (típico), 0+5+7+3=15 (extremo), 8+6+0+1=15 (zero), 3+1+0+11=15 (magro). |
| C1 colunas | **Resolvido.** Ações 48 px em todos os casos (r1: 40 a 193). Linhas: típico 86 a 121, erro 86 a 143, extremo 97 a 143, fora 86 a 137, só leitura 86 a 151, nicho IA 85 a 143 px (aceito: 132 a 155). Views/dia 75 a 92 px (r1: 70 a 90), cabeçalho sempre 89 px. Resíduo pequeno: ver M2. |
| C2 nome e aba | **Resolvido.** A aba "Saíram do YouTube 1" aparece (`r2-c-fora-1440.png`), o nome é um só (pastilha, frase, chip, filtro, direção) e a divergência com "fora do ar" do spec está na dúvida 2 de NOTAS. |
| C3 jargão | **Resolvido.** "...3 períodos de 28 dias seguidos depois da mudança de contagem de 24/08/2026. O primeiro dia possível é 14/12/2026, daqui a 62 dias." (`r2-c-queda-1440.png`, `r2-c-queda-390.png`). |
| C4 tag sobre texto | **Resolvido a 390, NÃO resolvido a 1440 (B1 abaixo).** |
| C5 só leitura | **Resolvido.** A frase "Você só pode ler esta lista..." está logo abaixo dos botões (`r2-c-leitura-1440.png`), antes do chip de frescor e das abas; botão "Sincronizar agora" desligado com cadeado. |
| C6 casas viram botões | **Resolvido, e marcado para o dono como acréscimo ao spec (dúvida 9).** Cada casa é `button` com `aria-pressed` e rótulo por extenso ("5 subindo"); pressionada: anel + "×" (`caso-zero-dir-descendo-1440-escuro.png`). A subida dos chips de estado para dentro do bloco da barra resolveu a nota de hierarquia. |
| S1 a S9 | Feitos como dito na NOTAS; conferi S1 (escala no ⓘ), S2 (frase do magro de uma linha a 1440, 3 a 390), S3, S4, S8. |

## Bloqueio (impede ir ao dono)

### B1. A tag "+ novo" do botão "Sincronizar agora" cobre metade da linha do e-mail do erro a 1440. Telas erro, extremo e muitos com nicho IA, 1440 (também claro).

- **Evidência.** `shots/r2-z-extremo-erro-tag.png` (recorte ampliado de `caso-extremo-1440-escuro.png`): a tag verde-água e o tracejado entram na metade de baixo de "Se continuar, e-mail em 16/12". Medido com `getBoundingClientRect` (`r2b.mjs`): a tag invade o texto em 8 px em `erro` ("E-mail em 07/10 · próximo em 14/10" e "Se continuar, e-mail em 14/10"), em `extremo` ("Se continuar, e-mail em 16/12") e em `muitos&nicho=IA` ("E-mail em 14/12 · próximo em 21/12"). A 390 px: 0 px de sobreposição em todos (o ajuste de 20 px funcionou ali). A NOTAS (seção 5, C4) diz "margem de 18 px (desktop)" e "Conferido nas capturas", mas 18 px não cobre a altura da tag mais o tracejado. A linha coberta diz **quando o dono será avisado**, e é texto aprovado do lote 1.
- **Conserto.** No desktop (`.ls-t`, bloco do botão da coluna Sincronização no erro), subir a margem de cima de 18 px para 28 px (o tracejado e a tag passam a ficar abaixo da última linha de texto, com 2 px de folga). Efeito: a linha em erro sobe de 143 para cerca de 153 px, ainda dentro dos 132 a 155; conferir que o caso só leitura (151 px hoje, botão desligado) não passe de 155 (se passar, tirar 4 px de `padding-bottom` da célula). Reconferir a sobreposição em `erro`, `extremo`, `muitos&nicho=IA` e `leitura` a 1440 e 390, e corrigir a frase da NOTAS ("conferido") para o que foi de fato conferido.

## Melhorias (não bloqueiam)

- **M1. A tag "+ novo" da aba "Saíram do YouTube" encosta no topo do texto** (`r2-z-fora-aba.png`): o acento de "Saíram" some atrás dela a 1440. É anotação do mockup, mas se o dono olhar a aba vai ler "Sairam". Deslocar a tag 4 px para cima ou para a esquerda da aba.
- **M2. Cabeçalho "Views/dia ▼" quebra o triângulo sozinho numa linha** quando a coluna fica em 75 a 78 px (erro, só leitura, nicho IA; `r2-c-leitura-1440.png`, cabeçalho: "Views/dia", "▼", "mediana", "nos longos"). Altura do cabeçalho não mudou (89 px), então é só feio: colar o ▼ ao título com `white-space: nowrap` no título e deixar o subtítulo quebrar sozinho.
- **M3. A 390 px as quatro casas têm alturas diferentes (61 px contra 77 e 93 px)** porque "sem mudança" e "não medido" quebram em duas linhas e "descendo" não (`r2-tipico-390-claro-resumo.png`, `r2-magro-390-claro-resumo.png`). O bloco lê bem e cada alvo continua acima de 44 px, mas a linha de rótulos fica irregular. Alinhar os rótulos ao topo da casa com altura mínima igual (77 px) ou encurtar "sem mudança" para "estável" só nessa largura (o resto da tela usa "sem mudança", então prefira a altura mínima).
- **M4. A frase a 390 px quebra "3 / descendo" em duas linhas e a aba "Saíram do YouTube" fica fora da primeira tela** (as abas rolam por dentro, herdado do lote 1; `r2-c-fora-390-topo.png`). O chip "1 saiu do YouTube" no cabeçalho e a frase cobrem o aviso, então não bloqueia. Se quiser pegar a quebra feia, `white-space: nowrap` em "N subindo" e "N descendo" dentro da frase.
- Observação para o dono, sem custo de desenho: ▼ âmbar significa "descendo" na barra e "em queda sustentada" no chip e na pastilha (regra 6.1.9, decidida). O que separa os dois é a palavra. Se houver confusão em uso real, o chip pode ganhar uma segunda marca.

## Medidas

Contraste medido no navegador (cor composta sobre o fundo composto, incluindo a opacidade da linha esmaecida de quem saiu do YouTube), texto da tabela, do resumo e das abas, 3 casos x 3 cruzamentos:

| Item | Valor | Limite |
|---|---|---|
| Menor texto da tela (4,1x azul de "Outliers", extremo, 390 claro) | 4,68:1 | 4,5 |
| Linha esmaecida de quem saiu do YouTube (fora, 1440 escuro, texto mais fraco) | 4,86:1 | 4,5 |
| Glifo e número ▲ sobre a casa de subindo, tema claro | 4,84:1 | 4,5 |
| Menor texto no tema escuro (típico) | 5,90:1 | 4,5 |
| Casas contra a superfície, hachura, zero medido, pastilhas | iguais à r1 (>= 3,0 em elemento gráfico; mín. 4,09) | 3,0 |
| Escala de cinza | ▲, ＝ e ▼ ainda têm luminância próxima (valores da r1), mas agora cada casa tem a palavra e o número ao lado: o teste passa por palavra, não por tom | — |

| Medida | Valor |
|---|---|
| Rolagem horizontal da página (12 casos x 4 cruzamentos) | 0 px em todos |
| Rolagem dentro da tabela (`.ls-tw`) | 0 px em todos |
| Alvos de toque abaixo de 44 x 44 px a 390 (casas, chips, ⓘ, links da tabela) | 0 |
| Alvos a 1440 (chips de estado, ponteiro fino) | 34 px de altura; sem exigência de 44 em ponteiro fino, igual ao lote 1 |
| Altura do bloco frase + barra + chips | 169 a 191 px (1440), 317 a 386 px (390) |
| Altura de linha 1440 | 85 a 151 px (acréscimo dentro de 132 a 155 em todos os estados com erro) |
| Altura de cartão 390 | 342 a 495 px |
| Colunas a 1440 (Direção / Views/dia / Outliers / Ações) | típico 173/88/86/48; extremo 159/91/91/48; erro 164/75/68/48; nicho IA 143/78/71/48 |
| Foco | contorno de 2 px laranja (255,130,64) em 14 de 14 controles testados; ordem de leitura correta (nicho, ⓘ, quatro casas, chips); casas e chips com `aria-pressed` |
| Movimento reduzido | regra `prefers-reduced-motion` presente em `lista.css` |
| `color-mix()` em CSS de interface | ausente (só em comentários) |

## O que NÃO consegui verificar

- Leitor de tela de verdade (li só os `aria-label` e `aria-pressed`), Safari e Opera (usei Chromium).
- Tema claro a 1440 e escuro a 390: medi contraste, rolagem e sobreposição (B1 se repete no claro a 1440), mas não abri a captura de página inteira.
- "Carregando" e "78 canais com Mostrar mais" a 1440: julguei por medida (alturas e rolagem) e pelo veredito da r1, sem reabrir a captura.
- Esc fechando o popover do ⓘ e a ordem de teclado da barra de ferramentas e das abas: vêm de `a4-comum.js` e `lote.js`, congelados do lote 1.

## Condição para a rodada 3

Corrigir B1 (margem de 28 px, uma linha de CSS) e reconferir em `erro`, `extremo`, `muitos&nicho=IA` e `leitura`, 1440 e 390. As melhorias M1 a M4 não condicionam, mas M1 e M2 são de um minuto e valem ser feitas junto. Com B1 fechado e a sobreposição medida em 0 px, dou PODE_IR_AO_DONO sem reabrir o resto.
