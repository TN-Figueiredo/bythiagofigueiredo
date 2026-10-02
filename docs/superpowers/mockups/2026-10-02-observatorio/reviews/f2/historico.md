NOTA F2: 78/100 — 9 vídeos, from= ×4, 10 estados; números de OBS; AA; sem chrome local.
TELA
B1. CSS da tela colide com o chrome (.forja pega .ch-dot.forja/.ch-btn.forja; .sw pega pontos de nicho) → TODO CSS da tela escopado em #screen (CONVENCOES nova regra).
I1. bins[0] < 24 h vira views/dia → "27,97 mil em 23 h" sem /dia (ou começar no 1º registro); esperada ancorada no 1º bin de 24 h.
I2. Chip A→B→A mostra só o 1º veredito → "A → B: perdeu · B → A: neutro" ou dois chips.
I3. Duração de versões em janela → intervalo ("entre 3 e 9 h") ou meio da janela, coerente com o total.
I4. falhou/recusado: botão do card contornado (só o do cabeçalho do vídeo é sólido).
I5. "Pedido em andamento" duplicado → no cabeçalho do vídeo, só linha de status/chip; status do chrome mantido.
I6. Summary da leitura recolhida com o "desde então" curto ("4 trocas mudaram de veredito desde então").
I7. Comprimir pré-03/10 sempre que pub < SERIES_START (ou trecho > 25% da largura).
I8. Escala do efeito: domínio min/max de {observado, q1, q3, 0} ± margem.
I9. Legenda: "ancorada no 1º registro deste vídeo (DD/MM)" quando pub < SERIES_START.
I10. Método do multiplicador visível ("método: aproximação por faixa") ou ⓘ focável.
I11. n = 0 → "Observado −54%; sem base de comparação (n = 0)".
I12. Frase por estado no cabeçalho (nova tentativa / vigia).
M1 capitalizar início de frase (motor fmt.labelReason + tela). M2 sem "Cota: cota". M3 "até entre" → "trocado entre…". M4 "outros Shorts". M5 dois-pontos encadeados. M6 rótulos sobre a curva sem colisão. M7 aviso quando nicho global ≠ nicho do vídeo. M8 datas de OBS. M9 nowrap. M10 toast ao cancelar ("Pedido cancelado"). M11 "pedido das 14:58".
MOTOR
fmt.labelReason com opção sentence-start (capitaliza); "Sem série antes da troca" sem travessão quando label = reason.
