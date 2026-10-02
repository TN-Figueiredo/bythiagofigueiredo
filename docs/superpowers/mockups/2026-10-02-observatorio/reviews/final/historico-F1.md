NOTA F1: 85/100 — 12 vídeos/17 trocas conferidos por script: 0 divergências com OBS. Contraste AA ok.
TELA
B1. Frescor fabricado em canal atrasado (paddy-bkk-hotel): cabeçalho usa OBS.SYNC global → usar channelStats(v.ch).syncText/ch.sync; hachura "sem registro desde 22/10 — sincronização do canal atrasada" quando pts acabam antes de LAST_IDX; botão desabilitado com reason de eligibleChannels(...).out.
I1. Botão ignora cota (usedToday ≥ 1) → desabilitado "Cota de hoje usada — próximo pedido amanhã" (quotaScope.text).
I2. "trabalhando" conta S.pts localmente → usar contagem do motor (sent/preview).
I4. sem-antes não ganha readyOn ("Primeira leitura possível em 31/10") → excluir sem-antes como sem-serie.
I5. Legenda do esperado com gráfico oculto (few) → condicionar a !S.few.
M1 .vl com F.num. M2 painel Dependências novas atualizado (leitura-video existe; cota por tipo e nicho via quotaScope.text). M3 "falhou" sem repetir "3 tentativas". M4 "de 20/10 06:10 (SP)" sem parênteses aninhados. M5 pedido em andamento = botão desabilitado "Pedido em andamento" + "Seu pedido das HH:MM está na fila…" (CONVENCOES). M6 breadcrumb href via OBS.link.canais; sidebar em PT (Painel, Canais, Desempenho…) — padronizar em TODAS as telas. M7 colisões na régua/faixa/eixo em 768. M8 paginador sem volta nas pontas.
MOTOR (dados.js)
I2. sent.nPoints off-by-one (asOfIdx 21 = 22 pontos).
I3. Textos leitura-video: não repetir rótulo ("sem série: Sem série…"), minúscula após ":" (ou usar " — "), sem parênteses aninhados nos numbers, lead pelos tipos que de fato mudaram (não "1 título" quando só thumb/descrição), "Desde então" em lista/"N trocas mudaram de veredito".
