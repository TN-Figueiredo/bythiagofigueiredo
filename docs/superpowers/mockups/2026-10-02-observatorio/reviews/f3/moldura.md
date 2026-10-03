NOTA F3: 77/100 — auditMockup 0; replaceState ok; teclado ok; cota no estado "cota" ok; sem número digitado.
TELA
B1. thinWarn afirma regra falsa (minN vale para nUse, não para outliers) → apagar ou reescrever sem prever ("fórmulas com menos de 10 vídeos saem como recorrência"), por nicho.
B2. setFlow('confirm') zera S.pub → pedido sai para nicho bloqueado; S.pub persiste em confirm/queued/cancel; escopo, h4, Limite e requestScenario usam só nichos livres.
I1. auditMockup restaura S.pub/openRead/req/reqFmt.
I2. Rádio usa o nicho exibido na opção.
I3. "Ir até a leitura" ajusta nicho (setNiche silencioso + toast).
I4. Ação primária do drawer acima da dobra (max-height calc ao topo do ch-page ou fixed).
I5. .warnline svg 13px fora de .opt.
I6. status "trabalhando · pedido 14:41" ou hora do estado (forjaFromScenario — chrome).
I10. tabela da amostra a 768: limiar de overflow > 24 px; dica acima.
M textos: "Peça de novo.." ponto duplo; parênteses aninhados; dois travessões; separador " · ". Código morto duplicando o chrome. Contagens do escopo "(1 outlier de canal fora não entra)".
CHROME (chrome.js/css/CHROME.md)
I6 forjaFromScenario status com rótulo inequívoco. I7 botão de frescor sem aria-label que esconde o conteúdo (sr-only prefixo). I8 blindagem das raízes e herdadas (:is(#ch-app,#ch-mock,#ch-toasts){all:revert; font/color/letter-spacing/text-transform/line-height explícitos; display grid}). I9 toasts: pausa em hover/focus, com ação sem timeout ou ✕ 32 px, sem role aninhado. M: .ch-grp td left; doc da sidebar/Tab (ou ciclo explícito); drawer() no resize (tratar ou documentar); escapar status; mount() idempotente + destroy; tema com aria-pressed/rótulo; aria-haspopup só quando modal; fechar menu ao trocar nicho; barra do mockup inerte com modal.
