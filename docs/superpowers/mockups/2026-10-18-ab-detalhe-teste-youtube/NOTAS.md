# Mockup S9: detalhe do A/B com teste nativo do YouTube (18/10/2026)

Arquivo: `index.html` (autocontido, dados sintéticos, sem navegador aberto). Chaves no topo: 7 estados, tema escuro/claro; 1440 e 390 px lado a lado (celular vira cartões por variante via container query).

## Decisões
- Ordem fixa em todo estado: cabeçalho com selos, frase-resumo (serifa, 21 px), faixa de estado, bloco do YouTube (quando houver), placar, faixa de CTR, régua de quanto falta. Método sempre no ⓘ (24 px no desktop, 44 px estreito).
- Linguagem visual estável: hachura rosa = "não sabemos" (impressões, CTR, leitura); borda tracejada azul-acinzentada + ícone de vídeo = "do YouTube"; âmbar + ícone de pare = guarda agindo; verde só com ✓ e "Vencedor provável". Nenhum estado depende só de cor.
- Estado 1 mostra uma faixa calma "nenhum teste visto, verificado há 3 h": ausência de teste também é uma leitura, com hora.
- Estado 2: proporção 31/60 (52%), desde quando, 14 de 20 rodadas mistas; guarda dita em frase ("o Lab não troca nada e não inicia teste novo"); saída "Não é teste, liberar o Lab".
- Estado 2b (só miniatura): ninguém consegue ver por fora, então a confirmação é 1 toque ("Confirmar teste de miniatura"), com a consequência escrita (pausa, não restaura nada).
- Estado 3: "Resultado do YouTube" com A e B, parcelas de leitura, vencedor com ✓, regra v1 no ⓘ e no selo, "Recalcular". 3b: "Vencedor: sem dado" (título oficial não lido), com "Tentar ler agora" e "Informar o vencedor à mão".
- Estados 4a/4b: faixa hachurada "Sem leitura: isto não é 'sem teste'"; selo "Lab pausado por segurança", coerente com a política da S6 (bloqueia em sem_leitura e insuficiente).
- Placar (S8, G3): impressões, cliques, CTR e retenção "não medido" em hachura quando nulos; faixa de CTR vira "faixa não calculada", nunca 0% nem p = 1; régua de dias pausada (relógio parado) em vez de barra vazia.
- Texto de leitura >= 12 px; títulos longos com reticências (desktop) ou quebra (celular).

## O que testar
1. Em cada um dos 7 estados, em 3 s, dá para dizer "tem teste do YouTube / não tem / não sabemos"? (4a/4b não podem parecer o estado 1.)
2. Em 2b, o dono entende que confirmar pausa o Lab sem mexer no vídeo?
3. "Vencedor provável" no 3 não parece número oficial do Studio?
4. Estado 3 sem selo do Lab: a faixa "Lab livre" basta, ou falta mostrar o histórico do teste nosso anterior?
5. Celular: placar em cartões, ⓘ de 44 px, hachura legível no tema claro (remedir contraste com a tela real).

## Limites
Pilha de fontes do sistema (sem Fraunces/Inter da web, para ficar autocontido). Contrastes herdados dos tokens aprovados, não remedidos. Cores `--ok`, `--yt`, `--warn` novas: Naksu deve medir 4,5:1. Abas ABBA/gráfico diário de impressões ficaram fora (tela do placar da S8 já os cobre).

## Rodada 2 (18/10/2026, pareceres de Logan e Naksu)
Aplicados todos os achados; sem `color-mix`, sem cor nova (só tokens já medidos pela Naksu; nada a remedir).
- **A1 (placar zerado):** estados 2, 2b confirmado, 3, 3b, 4a e 4b mostram os valores do estado 1 em tom neutro, sem ▲, com o rótulo "Congelado em 17/10 (dia 9 de 14)" no placar, na faixa de CTR e na régua. "Não medido" ficou só na retenção de B (nulo de verdade). Régua: barras paradas em 64%/92% e a frase "Pausado no dia 9 de 14: o relógio parou" em linha própria (no 3 e 3b: "Teste do Lab parado no dia 9 de 14. Retomar ou começar outro"). A faixa de CTR e a régua do 2b só congelam depois de confirmar (antes o Lab está rodando).
- **A2 (2b):** selo "Lab ativo" até confirmar; depois "Lab pausado", frase "Pausado a seu pedido: teste de miniatura do YouTube. Isto não altera o vídeo." e botão "Desfazer". "Não tenho teste de miniatura" volta ao estado 1 com a linha "Você disse que não há teste de miniatura (18/10)". O estado 1 ganhou o link "Ligou teste só de miniatura no Studio? Avisar o Lab" (leva ao 2b). Texto sem jargão.
- **A3 (guarda sem saída):** 4a e 4b têm "Sei que não há teste: liberar o Lab" (o 2 usa o mesmo fluxo). Toque 1 abre a confirmação "Decisão sua, fica registrada" (hora, consequência escrita); toque 2 libera, com selo "Lab liberado por você" e "Desfazer". É decisão do dono e fica registrada. 4a diz "tentar de novo às 18:00"; 4b diz sem prazo fixo (não há teto pela regra): "Com 3 de 3, o Lab já sabe se há teste do YouTube; se a leitura ainda não for clara, segue lendo a cada 6 h e esta faixa mostra quantas rodadas faltam" (rodada 3, controlador, a partir do Logan r2).
- **A4:** títulos e selos que não se repetem: 4a "Sem leitura: o YouTube não respondeu" / "Sem leitura"; 4b "Poucas leituras: 2 de 3 rodadas necessárias" com régua de 3 blocos (2 cheios) / "Leitura incompleta 2/3" (spec: minLeituras 9 = 3 rodadas de 3); 2b "Teste só de miniatura: você decide" / "Miniatura: só você sabe".
- **A5:** estado 3 com "Retomar do dia 9" (primário), "Começar teste novo" e a linha "O teste do Lab fica como estava: 9.210 impressões por variante". Resposta à pergunta 4: o histórico entra via placar congelado. O 3 ganhou o selo "Lab livre".
- **A6:** barra de estados deixou de ser sticky. **A7c:** "Test & Compare" virou "teste do YouTube".
- **N1:** rótulo da régua deixou de sair do quadro (`.mark span:only-child` e a frase fora do posicionamento absoluto); medido por `getBoundingClientRect` nos 7 estados em 1440, nenhum texto fora. **N2:** no 3b a faixa interna virou uma linha com selo "Vencedor: sem dado". **N3:** absorvido pela A1 (sobrou 1 selo "não medido" por estado; a explicação "sem impressões novas atribuíveis" está no ⓘ do placar congelado). **N4:** `line-clamp:3` no título, com `title` completo. **N5:** `.sum` com 72ch e `text-wrap:balance`.
- **N6 (anotação):** a letra A/B nas miniaturas do mockup é placeholder; a miniatura real não leva letra, o rótulo vem do `vchip`.
- Para a implementação: `vchip` deve usar `--va`/`--vb` (com letra de contraste), não hex solto; reusar `<Selo>` e o selo "não medido" de `competitors/_proprio/`.
- Verificado com Playwright: os 7 estados e os fluxos (confirmar/desfazer 2b, "não tenho", liberar 4a, voltar) rodam sem erro de console. Capturas em `rodada2-shots/` (estado 2, 4b e 2b confirmado, 1440, tema escuro). Não verificado: 390 e tema claro desta rodada.

## Rodada 3 (controlador)

- Logan r2: 4b com 3 rodadas em todo lugar; prazo sem teto inventado.
- Naksu r2: R2-1 resolvido para 3 (não 4, por causa do spec); R2-2 `.i{flex:none;min-width:44px}` a 390; R2-3 `&nbsp;` em "4 h" e "6 h".

## Aprovação do dono

18/10: "Parece bom pra mim" (visto no Opera). Libera: o código de tela da S9 quando S7 e S8 existirem (portão G4 cumprido para a S9). Não libera: deploy antes do E8 (G0).
