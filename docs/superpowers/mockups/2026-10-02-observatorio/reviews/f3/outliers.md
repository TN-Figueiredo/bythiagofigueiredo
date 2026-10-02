NOTA F3: 85/100 — OBS ok, sem chrome local, AA, ordenações, chaves inválidas, leituras de padrões/temas ok.
B1/B2. reading= de tipo que não é de outliers (leitura-video, resumo-trocas) quebra/inventa → aceitar só padroes-titulo, padroes-titulo-shorts, temas; senão chip "a leitura … não é de outliers"; motor: readingScope() null para outros tipos.
I1. Vazio respeita min (F.mult(S.link.min)) + "Tirar o mínimo de 10,0×".
I2. Modo leitura: faixa 181–365 parcial ("até 182 d") e "Todos" → "Escopo da leitura" (ou atalhos desabilitados com dica).
I3. min=0&age=all sem paginação (896 itens, ids de 17,7 KB) → paginar 60 + "Mostrar mais"; ids só da página visível (ou sessionStorage com chave curta).
I4. Usar CHROME.forjaFromScenario(sc).
I5. Shorts: herói abaixo da dobra → thumbs menores (minmax 150–180) ou lead lado a lado.
I6. Herói ≤ 600 também com chips de link (chips na linha do .sumbar; margens menores); 768 idem.
M1 asofReading ignora cenário fora do publicado; com Todos prefere padrões e diz qual. M2 status não repetido. M3 .state em --warning-text nos estados de aviso. M4 texto do escopo sem dois-pontos encadeados. M5 sem nicho redundante com channel. M6 nThen por filtro via motor (readingScope(id,{formula,theme,min}).nThen). M7 histHref via CHROME.link + back= com a query atual. M8 barra de estados atualiza URL. M9 constantes de OBS.RULES/AGE_BANDS. M10 espaço sob a thumb do líder.
MOTOR: readingScope null para tipos não-outliers; readingScope(id,{formula,theme,min}).nThen.
