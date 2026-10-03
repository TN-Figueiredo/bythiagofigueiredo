NOTA R2: 76/100 (dados 15/25, utilidade 16/20, hierarquia 13/15, sistema 8/10, texto 8/10, a11y 7/10, técnica 9/10)
R1 resolvidos: B1, B2, B4, B5, B6; I1, I3, I4, I5, I7, I9–I12; menores 1–9. Parciais: B3, I2, I6, I8, I13, I14.

CAUSA-RAIZ dos bloqueadores: dados digitados à mão. Reconstrua com a regra "DADOS DO MOCKUP" da CONVENCOES (uma lista de vídeos por canal → tudo derivado).

BLOQUEADORES
1. Outlier contradiz Views/dia do canal (melhor outlier com views/dia < mediana: Matt 14,6 vs 21,8; Dale 38,1 vs 52,3; Leo 24,8 vs 31,4) e bases implícitas impossíveis (Matt 63 mil vs piso 458 mil; Luke, Dale, Matheus, AI Advantage, Sabrina, Paddy idem). → derivar vpd, videos[] e out da mesma série; outlier com views/dia acima da mediana.
2. n impossível no "mesmo dia de vida" (Luke KFC n=22 possível 0–1; Matheus 13 vs ≈3; AI Advantage 6 vs ≈2; Sabrina 18 vs ≈12 e 5 vs ≈3) e na faixa (Esq 24 vs ≈15; Paddy 6 vs ≈4) → limitar n ao ritmo; fallback da CONVENCOES.
3. Dale troca 06/10 com before:7 (série desde 03/10) → before:3 + "Antes: 3 dias (a coleta por vídeo começou em 03/10)".

IMPORTANTES
1. Contagens das abas fora de "Contagens das abas" (mostra 20/93; Viagem 8/40; IA 12/53) → 14 · 18 · 11 (Viagem 8/5; IA 10/6); title= no <a> da aba com os textos da CONVENCOES; outs por canal somando 11 longos (hoje Preguiça 13, AI Advantage 12).
2. "outlier 1,6×/1,4×/1,9×" no drawer → "1,6× a mediana" sem palavra outlier e sem cor.
3. Troca dupla do Matt conta 1 → conta 2 (por evento), card único "na mesma janela".
4. Cadência não bate (bald tira com uploads recentes mas "parado há 35 d"; n > vídeos; pw mal arredondado) → derivar de uma lista de datas.
5. "Vídeos mais recentes" fora de ordem/implausíveis → ordenar por data, plausíveis ao ritmo (ou renomear "Vídeos em destaque").
6. "Pedir leitura à forja" do drawer sem estado/escopo/trava → desabilitado com motivo (Esq "sem sincronização desde 21/10 18h — sincronize antes"; Vou sem volta "Coleta em andamento"); após envio, estados do Health Coach; painel "Dependências novas".
7. Links: ?canal= → ?channel= (+ niche, fmt; Outliers age=0-30,31-90); "Ver histórico do vídeo" com ?video=<id>.
8. Tokens R2/R3: forja claro #17695C; nicho Viagem #5BBF8A/#11692F, IA #6EA8FE/#1D4ED8.
9. Contraste claro: .youtag 3,96; warning em tr.group 4,24; .weak 4,46; hover .btn.forja 4,24 → CONVENCOES (warning-texto #92400E, tag seu canal).
10. --dim sobre surface-2 (thead .unit, .globalbar .gm, .mockbar .grp) → --muted.

MENORES
1. "Ver as 1 trocas" → singular.
2. "há 2 d" quebra → NBSP entre número e unidade.
3. Vou sem volta "faltam 29 d" 42 min depois → "faltam 30 d (primeira contagem hoje)".
4. Fechar do drawer 28×32 → 32×32.
5. Esq/Paddy stats "desde 03/10" com dados parados → "desde 03/10 até 21/10 18h".
6. Preguiça "Ganhou" com antes de 1 dia → inconclusivo (CONVENCOES).
7. Dale Ninja neutro com texto "dentro" mas fora da faixa → texto diz o motivo real (|efeito| < 10 pp).
8. Texto das thumbs grandes invade a silhueta → max-width 52% / 10cqw.
9. Drawer usa a frase completa do multiplicador.
10. Cabeçalho do drawer em 768 ocupa ~440px → stats em 1 linha rolável ou rolam com o corpo.

EXCELENTE (não mexer): tira de cadência de 13 semanas; linha "seu canal" com "Por mil inscritos"; cards de troca com o modelo de efeito completo; vazios honestos por célula/drawer; semântica e teclado; hierarquia de ações.
