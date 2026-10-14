# Conferência Naksu, peça 4, rodada 1 (commit 388176738)

## Veredito: PRONTO PARA O DONO (peça 4 e peças 1 a 3). Nenhum achado novo.

Método: Playwright sobre file:// (sem servidor; 47701 do dono intocada, nenhum 47702 subiu), 1440 e 390, claro e escuro. Capturas e dados em `revisao-naksu-shots/peca4-conf/` (`comparacao.json`, `medidas.txt`, `fluxo-ligar-*.png`, `dlg-*.png`).

## Meus achados
- **C1 (frase sem acento): resolvido.** `ligar automatico de leitura de hora em hora` em maiúsculas e com espaços nas pontas: aria-disabled=false, "Frase confirmada." Frase errada com 5+ caracteres: "Ainda não bate com a frase. Maiúscula e acento não importam." e botão desabilitado. 1440 e 390.
- **C2 (aria-describedby e ordem): resolvido.** `#aOk` e `#aIn` apontam para `#aSt`; ordem do DOM = botão principal, Cancelar (visual = Tab) a 390 e a 1440. Foco inicial em Cancelar mantido.
- **C3 (valor solto): resolvido.** Janela de ligar com 0 elementos `[style]`; frase em `.m-frase`.
- **S1** (`.m-auto` 14 px/--surface), **S4** (toque fora com frase digitada não fecha; sem frase fecha) e **S5** (frase, campo e botões fixos no rodapé `.m-dlg-f`, a regra rola) aplicadas e testadas. S2 e S3 recusadas com razão por escrito em NOTAS.md: aceito (texto do Logan; S3 espera o teste do dono).

## C2 nas peças 1 a 3: sem mudança visual nem de texto
Comparei o commit anterior (HEAD~1, extraído) com o atual em 28 diálogos (t4, t4a, t4b, t4c, t8, Apagar do arquivo x2 nos canais; 1440 e 390; 2 temas): texto idêntico, caixa do diálogo idêntica e retângulo de cada botão idêntico (28 de 28). Só mudou a ordem no DOM e o aria-describedby.

## Elementos novos (medidas)
| Elemento | 1440 (ponteiro fino) | 390 | Contraste claro / escuro (exigência 4,5) |
|---|---|---|---|
| Desligar | 83x36 | 83x44 | 15,76 / 14,48 |
| Ver a regra | 101x36 | 101x44 | 15,76 / 14,48 |
| Ver o que sairia | 130x36 | 130x44 | 15,76 / 14,48 |
| Ligar o automático… | 166x36 | 166x44 | 15,09 / 15,61 |
| Ligar de novo (desabilitado, ainda legível) | 117x36 | 117x44 | 7,13 / 6,18 |
| Botão do diálogo Desligar | 170x36 | 290x44 | 15,76 / 14,48 |
Menor contraste de todo texto medido nos 328 quadros (6 telas x 2 larguras x 2 temas): 6,18. Nenhum botão abaixo de 44 px a 390; 36 px a 1440 é o valor herdado e declarado das peças 1 a 3. Rolagem horizontal 0 e erros de script 0 em todos.
- **Motivo 8 neutro:** `.m-auto.pt`, borda dotted 1 px, ícone `informação` (círculo com i), sem triângulo, sem chip na faixa, sem frase-lead. Forma e texto carregam o estado, não só a cor.

## Observação (não é achado)
Meu primeiro teste de "clique fora" bateu na barra "Estados do mockup" (z-index 200, só do mockup) e não no fundo; refeito fora dela, correto.

## Não verifiquei
Leitor de tela, Opera real, aparelho real e teclado virtual, rede lenta; só Chromium. A leitura de `color-mix` foi por inspeção do diff do CSS (nenhum adicionado).
