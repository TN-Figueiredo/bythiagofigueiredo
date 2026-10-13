# Revisão de UX, rodada 3: mockup 16b (Mudanças, "Outras mudanças")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Escopo: conferir se o único bloqueio da r2 (B2) foi resolvido e se o ajuste criou defeito novo. Medi no Chromium headless (Playwright próprio, servidores estáticos nas portas 47745 e 47746, encerrados ao fim; nada de 3099, banco ou specs do projeto; nenhum arquivo do mockup foi alterado). Scripts e capturas do ⓘ ficaram no scratchpad da sessão (`ux16b-r3/`), fora da pasta do mockup.

## Veredito: PODE IR AO DONO (0 bloqueios)

| Largura / tema | Estados (11 casos) | Veredito |
|---|---|---|
| 1440 escuro | trocas, típico, magro, extremo, zero, não medido, filtro sem resultado, erro, carregando, sem dado, só leitura | pronto para o dono |
| 1440 claro | os mesmos 11 | pronto para o dono |
| 390 escuro | os mesmos 11 | pronto para o dono |
| 390 claro | os mesmos 11 | pronto para o dono |
| 360 (claro e escuro) | os mesmos 11 | pronto para o dono |

A pergunta da tela ("além de título e miniatura, o que mais eles mexeram, e posso confiar no número?") segue respondida no primeiro olhar: frase com número em destaque, duas barras na mesma escala separadas pela linha "a conta da aba acaba aqui", régua de cobertura com hachura rosa só para "não medido".

## Conferência da r2

| Achado | Resultado | Evidência |
|---|---|---|
| B2 (ⓘ da caixa de cima dizia "na janela escolhida") | **resolvido** | `om.js:332` agora diz "Contagem: cada mudança registrada nos últimos 30 dias, uma por campo e por sincronização." Abri o ⓘ "Por que as outras mudanças ficam fora da conta de Trocas" no típico, a 1440 escuro e a 390 claro, e li o texto renderizado: o item "Janela" ("a conta de cima é sempre dos últimos 30 dias, como a aba. A janela escolhida abaixo vale só para a lista") e o item "Contagem" ("nos últimos 30 dias") não se desmentem mais. O texto é montado uma vez só (`popovers()`), então vale para os 11 casos. |
| M1, M2, M3, M4 | anotados na NOTAS ("Resposta à revisão r2"), sem exigir mudança | M3 conferido: tabela de casos diz 90 dias de histórico e 214 mudanças para o extremo |

Defeito novo criado pelo ajuste: nenhum. O único arquivo de código tocado foi `om.js` (uma frase); `om.css` não mudou desde as capturas (12:15), então as capturas de `shots/` seguem válidas. Reabri as de "não medido" 1440 escuro e "típico" 390 claro e continuam corretas: hachura rosa com texto "não medido" (cor mais símbolo mais palavra), zero medido como caixa vazada "0" em Formato, barras e régua legíveis, sem corte de texto.

## Bloqueios

Nenhum.

## Melhorias (não bloqueiam)

- **M5. Dois ⓘ pequenos a 1440** ("O que significa 'entre 12h e 18h'" e "O que muda para quem só lê") medem 28 x 28 px, e os seletores 7/30/90 d, formato e "Ordenar" medem 34 px de altura a 1440. É área de mouse; a 390 e a 360 todos têm 44 x 44 ou mais (0 abaixo de 44 em 44 cruzamentos estreitos). O lote 1 usa a mesma convenção (44 px só em toque). Se quiser uniformizar, `min-height:44px` também a 1440 em `om.css` linhas 61, 65 e no ⓘ pequeno.
- **M6. Texto do ⓘ fala do dono em terceira pessoa** ("hoje ela soma a descrição junto: o dono decide", e a tabela de referência diz "dúvida 1: o dono decide"). É anotação de mockup que some na implementação e o dono é quem lê; se quiser, trocar por "você decide". Não altera o sentido nem o dado.
- **M7. Fonte do Google bloqueada na minha máquina** (carreguei sem rede de fontes): o contraste e a quebra de linha foram medidos com a fonte de reserva. Diferença esperada: milímetros de largura, não de razão de contraste.

## Medidas (66 cruzamentos: 11 casos x 1440, 390 e 360 x claro e escuro)

| Item | Resultado |
|---|---|
| Rolagem horizontal | 0 px em todos os 66 (`scrollWidth` igual a `clientWidth`) |
| Texto menor que 12 px | nenhum |
| Alvos de toque a 390 e 360 (`a`, `button`, `select`, `summary`, `[tabindex]`) | nenhum menor que 44 x 44 (44 cruzamentos) |
| Alvos a 1440 (mouse) | 34 px de altura nos seletores e 28 x 28 nos dois ⓘ pequenos: ver M5; o ⓘ do topo continua 44 x 44 |
| Contraste de texto (todo texto de `#screen`, cor composta sobre o fundo efetivo, lido de `getComputedStyle`) | menor razão 5,90:1 no escuro (texto "7" do contador de tags), 6,43:1 no claro; 0 abaixo de 4,5:1 |
| Contraste gráfico (barras, hachura, caixa vazada, contorno do zero) | não mudou desde a r1/r2 (só texto foi editado); r1 já dava tudo acima de 3:1 |
| `role=group`, `role=img` e `button` sem nome acessível | 0 |
| Erros de console da página | 0 nos 66 |
| `color-mix()` | 5 ocorrências em 3 CSS (`a4.css` 3, `lote.css` 1, `om.css` 1) e todas são comentários "Sem color-mix()" (conferido linha a linha com `grep -o`); nenhuma regra de estilo usa a função; nenhuma em `om.js`, `lote.js`, `a4-comum.js`, `index.html` |
| ⓘ e Esc | abre pelo clique, Esc fecha, o foco volta ao botão (conferido a 1440 e 390) |
| Popover a 390 | cabe na tela: x 12, largura 366 em 390 |
| Foco visível, `prefers-reduced-motion` | sem mudança desde a r2 (2 px sólido nos 22 primeiros itens da ordem de Tab; regra presente) |

## O que não consegui verificar

Leitor de tela (ouvir os `aria-label`), Safari e Opera, escala de cinza renderizada (julguei pela forma: ícone, palavra, hachura, caixa vazada, contorno), contraste gráfico refeito nesta rodada (confiei na r1: nada de cor mudou), foco visível refeito nos 22 itens (confiei na r2: nenhum CSS mudou).
