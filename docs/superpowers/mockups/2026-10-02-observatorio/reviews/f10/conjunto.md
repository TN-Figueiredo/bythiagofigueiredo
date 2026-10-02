NOTA CONJUNTO F10: 89/100 (dados 35/40, nav 24/25, forja 11/15, visual 19/20)
D1 (MUDANÇAS l.759) views de canal atrasado "até 23/10 00:00" (sync.last) → último registro diário (22/10 12:00).
D2 (OUTLIERS l.650, MOLDURA l.484) com pedido em andamento usar since().textNoAsk; Insights também (sem regex).
D3 (HISTÓRICO) shortText fora do selo + .text no detalhe (= F10 I1).
D4 (MOTOR + Canais/Mudanças/Moldura/Histórico) effect.waitText único com a frase inteira (dias coletados + readyText + aviso de inconclusivo).
D5 (MOLDURA l.406) amostra de Canais "Sincronizado agora" após sync; aviso de que o mock reseta a sync.
D6 (HISTÓRICO) n = 0 dito 3×: só noBaseText.
D7 (OUTLIERS) shortText na linha recolhida (= F10 I2).
D8 (MOTOR) fila entre tipos: seq global numa máquina só; "atrás de" considera todos os tipos.
D9 (MUDANÇAS) statusText visível com Todos na linha recolhida.
