# Revisão de UX, mockup 16 (Lista de Canais: direção, estado, filtros), rodada 3, 13/10/2026

Revisor: `revisor-ux-senior`. Escopo: conferir se o bloqueio da r2 (B1) foi resolvido e se os ajustes (M1 a M4) criaram defeito novo; nova passada nos pontos que o dono cobra. Método: script próprio em Chromium headless sobre servidor estático nas portas 47751 a 47755 (derrubadas ao fim; nada na 3099, nenhum spec do projeto, nada editado fora desta pasta). 16 casos (típico, completo, extremo, zero, magro, erro, fora, carregando, leitura, muitos, muitos + nicho IA, típico + filtro "em queda", típico + filtro "parados", zero + filtro "parados", zero + direção "descendo", típico + direção "subindo") x 1440 e 390 x escuro e claro = 64 cruzamentos medidos. Capturas desta rodada: `shots/r3-*.png` (as `caso-*` do desenhador foram abertas por amostra; as minhas foram refeitas por mim).

## Veredito

**PODE_IR_AO_DONO. 0 bloqueios, 3 melhorias.**

B1 da r2 está resolvido de verdade (medido por mim, não só pelo `r3-medidas.json` do desenhador): a tag "+ novo" do botão "Sincronizar agora" não cobre mais a linha do e-mail do erro. Nenhum dos ajustes M1 a M4 criou defeito novo. Contraste, rolagem, alvos e cor estável seguem como na r2.

Pergunta do dono: "Algum canal que eu acompanho parou, está caindo ou sumiu, e quais estão subindo?" Resposta em 3 segundos: a frase na primeira linha ("2 canais parados, 5 subindo, 3 descendo. Em queda sustentada (...) só dá para medir a partir de 14/12."), a barra de quatro casas com número, símbolo e palavra, e os chips de estado no mesmo bloco. A 1440 o bloco termina antes de 430 px; a 390 cabe na primeira tela e meia (de 370 a 735 px), sem abrir dica e sem rolar a tabela.

| Estado | 1440 escuro | 390 claro |
|---|---|---|
| típico (13/10) | pronto | pronto |
| completo (15/12) | pronto | pronto |
| extremo (nada subindo, 4 parados, 3 em queda, 1 fora, 1 erro) | pronto | pronto |
| zero (nenhum parado nem em queda; casa "descendo" = 0 medido) | pronto | pronto |
| zero + filtro "parados" / direção "descendo" (vazio com zero medido) | pronto | pronto |
| magro (11 não medidos, datas sob a casa) | pronto | pronto |
| erro | pronto (B1 fechado) | pronto |
| saiu do YouTube (aba com contador, linha esmaecida) | pronto | pronto |
| carregando (tracejado cinza, nunca hachura) | pronto | pronto |
| só leitura | pronto | pronto |
| 78 canais / nicho IA | pronto (B1 fechado) | pronto |
| típico + filtro "em queda" (vazio explicado, com a data) | pronto | pronto |
| típico + filtro "parados" | pronto | pronto |

Os pares tema obrigatórios (escuro a 1440, claro a 390) foram abertos; os outros dois cruzamentos foram medidos (contraste, rolagem, sobreposição, alvos) e dão o mesmo resultado.

## Conferência do que veio da r2

| Item | Resultado |
|---|---|
| B1 tag sobre o e-mail do erro (1440) | **Resolvido.** `shots/r3-b1-tag-email-1440.png` (erro escuro, extremo escuro, leitura claro, nicho IA claro): a tag e o tracejado ficam abaixo de "E-mail em 07/10 · próximo em 14/10" e de "Se continuar, e-mail em 16/12", com cerca de 3 px de folga; o texto inteiro legível. Medido com `getClientRects` do texto contra a caixa da tag, 1440 e 390, escuro e claro: 0 px de sobreposição em `erro`, `extremo`, `muitos&nicho=IA` e `leitura` (na r2: 8 px). Linha em erro a 1440: **153 px** (erro, extremo, nicho IA); `leitura` 151 px; `fora` 137 px; todas dentro dos 132 a 155 aceitos. A diferença para o conserto que eu pedi (28 px de margem, que levaria a linha a ~171 px) foi bem escolhida pelo desenhador: 10 px resolvem e respeitam o teto. A NOTAS (seção 6) corrige o diagnóstico errado da r1 e diz o que foi de fato conferido. |
| M1 tag da aba "Saíram do YouTube" cobrindo o acento | Resolvido (`caso-fora-1440-escuro`, `caso-extremo`: "Saíram" com acento visível, tag acima da aba). |
| M2 "Views/dia ▼" quebrando o triângulo | Resolvido: título em 1 linha, subtítulo "mediana nos longos" quebra sozinho; cabeçalho segue com 89 px. |
| M3 casas com alturas diferentes a 390 | Resolvido: as quatro casas têm a mesma altura em cada caso (61 px a 1440; 77 px a 390, 93 px no magro, que tem a data sob "não medido"). Rótulo alinhado ao topo. Alvo continua acima de 44 px. |
| M4 frase quebrando "3 / descendo" | Resolvido: "3 descendo" fica junto (`t390a`, `r3-fora-magro-erro390.png`). A aba "Saíram do YouTube" fora da primeira tela a 390 segue como no lote 1; o chip do cabeçalho e a frase cobrem. |
| Observação (▼ âmbar com dois sentidos) | Sem mudança, decidida (6.1.9). A palavra separa "descendo" de "em queda sustentada". Continua anotada para o dono. |

## Bloqueios

Nenhum.

## Melhorias (não bloqueiam)

- **M1. A tag "+ novo" do cabeçalho da coluna Direção encosta no topo da palavra "Direção" (1440, todos os casos).** `shots/r3-m1-tag-direcao-cabecalho.png`: a caixa da tag e a da linha do texto se cruzam por 2,6 px (a tinta não se toca, folga visível de cerca de 2 px entre a base da tag e o topo do "D"). É anotação do mockup, não da tela; mas é o mesmo tipo de aperto que gerou o B1. Subir a tag 3 px (`top` 3 px mais negativo) no cabeçalho da coluna.
- **M2. A casa "não medido" do magro a 390 tem rótulo de três linhas** ("não medido / fecham de 17/10 a / 26/11"), e a barra fica com 93 px de altura contra 77 px nos outros casos. Lê bem; só dá um salto de altura entre estados. Se quiser calma, mover a data para a frase de método do ⓘ e deixar só "não medido" na casa.
- **M3. Carregando: as quatro casas viram caixinhas tracejadas de 18 px de largura**, bem menores que as casas reais (160 a 300 px). Não confunde com hachura nem com zero (e esse era o ponto), mas a tela dá um salto de layout quando os dados chegam. Esticar o esqueleto para as larguras proporcionais de um caso típico (5/4/3/3).

## O que o dono cobra, ponto a ponto

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Sim, em todos os casos, e com as mesmas palavras da barra ("descendo" x "em queda sustentada"). Contas fecham (5+4+3+3 = 15; 0+5+7+3 = 15; 8+6+0+1 = 15; 3+1+0+11 = 15). |
| Régua ou barra para comparar de relance | Sim: barra de quatro casas (largura proporcional) e régua de -50% a +50% por linha; percentual conferido sobre os números exibidos (7.144/9.400 = -24%; 239/412 = -42%; 188/198 = -5%). |
| Cor estável por significado, inclusive "não medido" | Sim: verde = subindo, neutro = sem mudança, âmbar = descendo, rosa hachurado = não medido, família do erro = erro e fora. Mesma cor em casa, chip, pastilha, cartão e legenda, nos dois temas. |
| Símbolo junto da cor | Sim: ▲ ＝ ▼, hachura, pausa, círculo com X, triângulo, envelope. Em escala de cinza o teste passa por palavra e número ao lado, não por tom (▲ ＝ ▼ têm luminâncias próximas). |
| Método no botão de informação | Sim: dois ⓘ (resumo e cabeçalho da coluna) com texto por extenso (escala da régua, fórmulas, motivos de não medido). Abrem por clique e fecham com Esc, o foco volta ao botão. Nada de método em prosa na tela (sobra uma faixa de uma linha com a base e a legenda). |
| "Zero medido" x "não medido" | Distintos: zero é caixa vazada com 0 (nos chips e nas casas), não medido é hachura rosa; carregando é tracejado cinza. Vazios dos filtros dizem qual dos dois é. |
| Sem bloco monocromático nem prosa | Sim. Blocos são casas coloridas, chips, régua, pastilhas; os parágrafos são frases de uma ou duas linhas. |
| Frases sem jargão | Sim. "3 períodos de 28 dias seguidos", "mudança de contagem de 24/08/2026", "daqui a 62 dias". Sem "M3", "janela", "snapshot". |
| `color-mix()` | Ausente: as únicas ocorrências em `lista.css`, `lista.js`, `lote.css` e `a4.css` estão em comentários que dizem "sem color-mix". |
| Todos os estados desenhados | Sim (16 casos). |
| 390 px sem rolagem horizontal e alvo de 44 px | Rolagem da página 0 px nos 64 cruzamentos. Alvos abaixo de 44 x 44 px a 390: 0 em todos. Textos abaixo de 12 px: 0. |
| Tema escuro 1440 e claro 390 | Abertos e julgados. |
| Consistência com o lote 1 | Mesmos tokens e componentes (`a4.css`, `lote.css` sem edição), a linha em erro do lote 1 reaproveitada, nome "Saiu do YouTube em dd/mm" igual ao do spec 6.2 (linha 89) e da aba do lote 1. Divergências declaradas na NOTAS (dúvidas 1 a 9). |
| Acréscimo de linha de 132 a 155 px (mockup 8 aprovado) | Cumprido: máximo medido 153 px (erro, extremo, nicho IA); típico 86 a 121 px. |

## Medidas

Contraste medido no navegador (cor composta sobre o fundo composto, incluindo opacidade da linha esmaecida), todo texto visível da tela (fora o quadro de referência do mockup e as tags "+ novo" de anotação), 8 casos x 4 cruzamentos de largura e tema: **nenhum texto abaixo de 4,5:1**. Menores valores achados:

| Item | Valor | Limite |
|---|---|---|
| Glifo e número "▲ 0" da casa vazada (extremo, 1440 escuro) | 4,97:1 | 4,5 |
| Texto de apoio da tabela (extremo, 1440 escuro) | 4,86:1 | 4,5 |
| Glifo e número "▲ 0" / "▼ 0" (390 claro) | 4,84:1 | 4,5 |
| "Competidores" no cabeçalho do produto, herdado (390 claro) | 4,73:1 | 4,5 |
| "4,1×" (azul de Outliers, 390 claro) | 4,68:1 | 4,5 |
| Elemento gráfico: casas, hachura, zero medido, pastilhas | iguais à r2 (>= 3,0; mín. 4,09) | 3,0 |

| Medida | Valor |
|---|---|
| Rolagem horizontal da página (16 casos x 4 cruzamentos) | 0 px em todos |
| Alvos de toque abaixo de 44 x 44 px a 390 | 0 |
| Altura de linha 1440 | 81 a 153 px (típico 86 a 121; erro, extremo, nicho IA 153; leitura 151; fora 137) |
| Altura de cartão 390 | 342 a 495 px |
| Altura das casas | 61 px (1440), 77 px (390), 93 px (390, magro); iguais dentro de cada caso |
| Sobreposição tag "+ novo" x texto do e-mail do erro | 0 px (erro, extremo, nicho IA, leitura; 1440 e 390) |
| Sobreposição tag x caixa de "Direção" no cabeçalho | 2,6 px de caixa, sem toque de tinta (melhoria M1) |
| Foco | contorno visível em 30 de 30 controles percorridos por Tab (nicho, ⓘ, quatro casas, cinco chips, ⓘ da coluna, nomes, Comparar, Mais ações); casas e chips com `aria-pressed`; rótulos por extenso ("5 subindo", "Em queda, não medido até 14/12") |
| Esc | fecha o ⓘ e devolve o foco ao botão que abriu |
| Filtro "Parados" | mostra 2 linhas das 2 contadas; o foco permanece no chip |
| Movimento reduzido | `prefers-reduced-motion:no-preference` envolve a animação do esqueleto |

## O que NÃO consegui verificar

- Leitor de tela de verdade (li só `aria-label`, `aria-pressed` e a ordem de foco), Safari e Opera (usei só Chromium).
- A ordem de teclado da barra de ferramentas (busca, segmentos), das abas e do cabeçalho: no mockup são `span` estáticos copiados do lote 1 e não entram no Tab; isso fica para a tela real.
- A semântica de tabela some no cartão a 390 (CSS `display:grid`), como a NOTAS já declara; só se confere na tela real.
- Tema claro a 1440 e escuro a 390: medi (contraste, rolagem, sobreposição, alvos) e abri o claro do `leitura` e do nicho IA, mas não a página inteira.
- Escala de cinza: raciocinei pelas luminâncias medidas na r1/r2 e pelas palavras ao lado dos símbolos; não gerei uma captura em cinza.

## Para o dono (decisões abertas, sem custo de desenho)

As dúvidas 1 a 9 da NOTAS seguem valendo. As que mais mudam a tela: (1) mostrar "em queda" como não medido até 14/12 ou esconder o chip; (6) o filtro por direção nas casas da barra é acréscimo ao spec (que pede só "parados" e "em queda"); (2) "Saiu do YouTube" no lugar de "fora do ar" (o spec 6.2 linha 89 já usa "saiu do YouTube em dd/mm").
