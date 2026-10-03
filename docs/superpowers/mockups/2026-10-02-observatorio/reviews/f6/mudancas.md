NOTA F6: 93/100 — SEM BLOQUEADORES.
I1. #fSort não chama syncUrl → sort na URL.
I2. back= vaza nicho de exibição → filterParams(forBack) só inclui niche se = persistido e sem channel/changes/video.
I3. (MOTOR) statusLines com Todos usam "pedido HH:MM" em vez do statusLabel do evento → cada linha = "<Nicho>: " + statusLabel do pedido.
M1 toast no modo ?changes= quando o nicho de exibição muda. M2 mocks não copiam niche antigo para a URL. M3 busca preserva caixa na URL/campo. M4 código morto (if(false), #weekNote, linhas vazias, override em renderDeps). M5 toasts da forja kind 'forja'. M6 pedido novo com Todos menciona o 2º na fila. M7 etiqueta do card em publicado+Todos ("IA publicado · Viagem trabalhando"). M8 rodapé do inconclusivo só com o motivo. M9 "esconde a única".
