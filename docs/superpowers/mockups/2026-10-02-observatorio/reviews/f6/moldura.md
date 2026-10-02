NOTA F6: 93/100 — SEM BLOQUEADORES (moldura-forja.html + chrome v1.6)
I1 (CHROME) popover frescor/menu ⋯ fecham sozinhos quando foco está em outro botão (Safari/Firefox): st.focusKey='menu'/'fresh' antes do refresh(); ignorar focusin durante refresh (st.inRefresh).
I2 (MOLDURA defaultSync) sync inventa sucesso: atualizar OBS.SYNC/channel.sync.last=NOW no mock + refresh, OU 2º toast "Resultado da sincronização das 12:00: …" sem "atualiza sozinha"/"próxima rodada".
I3 (CHROME) aba atual cortada em 1280 com drawer: scrollIntoView({inline:'nearest'}) na aria-current após refresh.
I4 (MOLDURA+CHROME) estado "publicado (Todos: IA publicada, Viagem trabalhando)" no FLOWS; linha "IA: publicado às 14:50" visível como ch-pill secundária.
I5 (CHROME) statusLabel com horário nulo/forecast → usar sc.statusLabel do motor, não terminal.
M1 F.subs. M2 .inflight>span flex. M3 frescor escopo nicho ("8 canais em Viagem · 14 no total"). M4 tabela do popover tabindex=0+aria-label. M5 pill terminal statusText em ch-sr. M6 tempo repetido com Todos → juntar iguais. M7 "ainda buscando vídeos". M8 cancelado: "Saiu da fila antes de a forja pegar; a cota continua livre." M9 janelas de OBS.RULES. M10 auditMockup: hostil nos 2 temas + drawer aberto, abas cortadas, popover fechando. M12 aria-label em span → ch-sr.
