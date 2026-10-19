# Mockup S7: cartão de confirmação do teste do YouTube (18/10/2026)

`index.html` autocontido, dados sintéticos, tokens e componentes do S9 aprovado. Chaves no topo: 5 estados e tema; 1440 e 390 px lado a lado; os botões funcionam (confirmar, descartar, desfazer, marcar miniatura).

## Estados
1. Detectado: títulos A e B, "visto em 29 de 60 / 31 de 60", desde 17/10 09:40, guarda explicada em 3 linhas (Lab pausado no dia 9 de 14, não escreve, dados guardados), caixa opcional "Também testa miniatura", botões "Confirmar" e "Não é teste".
2. Confirmado: selo com hora, "Desfazer confirmação", marca de miniatura se escolhida.
3. Vencedor provável: título que ficou, quando alternou, guarda liberada, "Retomar do dia 9", "Começar teste novo", "Recalcular"; regra no ⓘ.
4. Descartado: registro da decisão, Lab liberado, "Desfazer".
5. Sem leitura: hachura, A/B/proporção "não medido", "sem leitura não é sem teste", saídas "Sei que há teste" e "Sei que não há".

## Decisões
- A confirmação nunca mostra a miniatura do B (de fora só se vê o título, plano §10); a caixa de miniatura é só declaração do dono.
- O efeito da guarda aparece como tabela de 3 linhas (âmbar), não como prosa.
- Mesma linguagem do S9: tracejado azul-acinzentado, âmbar, hachura rosa, verde só com ✓ e palavra.

## O que testar
1. Em 3 s o dono entende que confirmar não altera o vídeo, só mantém o Lab parado?
2. A caixa de miniatura aparece cedo demais (antes de confirmar)? Alternativa: só após confirmar.
3. "Visto em 29 de 60" é claro como proporção?

Limites: pilha de fontes do sistema; contrastes herdados do S9, não remedidos; navegador não aberto.

## Rodada 2 (18/10/2026, conserto dos achados de Logan e Naksu)
Chave nova no topo: "Antes do sem leitura" (era provável / nunca houve sinal), só no estado 5.
- A1 (liberar em 1 toque): "Não é teste" (estado 1) e "Sei pelo Studio que não há teste" (estado 5) abrem faixa com a consequência escrita, "Liberar o Lab" e "Cancelar" (2 toques, como no S9); o ghost fica longe do Confirmar (24 px no desktop, linha própria a 390). Foco vai para Cancelar e volta ao gatilho ao cancelar.
- A2/S7-1/S7-5: h3 removido de todos os estados (a frase-resumo é a única); selo "terminou" removido; no estado 1 os botões vêm logo após o dado e a guarda vira 1 linha depois deles (CTA a 637 px em 390); no 5 a guarda (tabela) vem depois dos botões. "Ficou no ar" só no selo do topo.
- A3: dica do estado 1 diz "O Lab já está parado. Confirmar só registra na biblioteca; você pode desfazer."
- A4: "Ficou no ar: B" no lugar de "Vencedor provável"; "informe à mão" saiu, fica "O resultado oficial está só no Studio."; ⓘ sem "não é o número oficial".
- A5/S7-2/S7-3/A6: estado 3 mantém números ("antes de fixar"); rótulo "Leituras com este título"; "alternância regular" removido; números coerentes com rodada de 3 leituras a cada 6 h (15 leituras em 29 h, última 09:40; próxima rodada 15:40; A7).
- Dúvida 1: caixa de miniatura só no estado 2. Dúvida 2: ⓘ sem frase de número oficial. Dúvida 3: guarda no sem leitura só se o último estado era provável/confirmado, com o motivo; sem sinal anterior aparece "O Lab não pausou"; últimos A/B conhecidos (5 de 9 / 4 de 9) no estado 5, "não medido" para hoje.
- Estado 3 mostra "Você tinha confirmado em 18/10, 14:32" com "Desfazer confirmação".
- S7-4/A8 (foco): o mockup restaura o foco após render e Esc fecha o ⓘ. Na tela real, atualizar estado sem remontar o cartão.
- ⓘ ancorado ao cartão (30 px de folga nos dois lados a 390). S7-7: "Liberado" agora é selo verde com ✓. S7-6: bordas dos botões e do ⓘ em --btn-line (>= 3:1 contra a superfície).
Medido em Playwright (1500 px, 390 px): sem rolagem horizontal, sem erro de console nos 5 estados.

## Rodada 3 (18/10/2026, espaçamento)
Causa raiz: o reset `.frame h2,.frame h3,.frame p{margin:0}` (especificidade 0,1,1) anulava as margens de `.sum`, `.hint`, `.cap`, `.gline`. Agora é `:where(.frame) :is(h2,h3,p){margin:0}` e os `style="margin-top"` inline saíram do script.
- Escala única 4/8/12/16/24/32: nota/dica a 8 do que explica; dentro do grupo 12; entre grupos 16; entre seções 24 (cabeçalho -> frase-resumo). Valores 6/7/9/10/13/14/18 trocados pelo degrau mais próximo. Padding do cartão 16 (390) e 24 (>=641).
- 390 px: botões em coluna, largura total, gap 8; `.far` com `flex-basis:auto` e 16 acima (8 de gap + 16 = 24 do primário). Pílula Pausado/Liberado em linha própria a 390 (`margin-right:8` no desktop); `.lnk` como flex com 4 acima, sem inflar o parágrafo.
- Logan: dica do estado 1 sem "O Lab já está parado." (repetia o resumo); dica a 8 dos botões, guarda a 16; estado 5, dois `.meta` seguidos a 8.
- Divergências: gap dos botões empilhados a 390, Naksu 12 e Logan 8; vale 8 (brief), compensado pelos 16 do `.far`. Px segue a Naksu; agrupamento e texto, o Logan.
- Medido em Playwright (1440 e 390, escuro e claro, 5 estados + 2 variantes do 5): sem rolagem horizontal, 0 erros de console, folgas entre irmãos só em 4/8/12/16/24/32 (exceções esperadas: linhas da tabela da guarda coladas por borda de 1 px e botões lado a lado no desktop). Capturas: `r3-shots/final_*.png`.
- Pendente: o S9 (`ab-detalhe-teste-youtube/index.html`, linha 43) tem o mesmo reset; não mexido.
