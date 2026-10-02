NOTA R1: 63/100 (dados 12/25, utilidade 14/20, hierarquia 12/15, sistema 6/10, texto 7/10, a11y 6/10, técnica 6/10)
(Nota do coordenador: snapshots DIÁRIOS DE CANAL — inscritos/views totais — já existem desde maio em `competitor_channel_snapshots`, então "inscritos últimos 30 d" é legítimo. O que começou em 03/10 é a série POR VÍDEO e o arquivamento de thumbs.)

BLOQUEADORES
1. "Hoje" do mockup é 02/10 → rebasear tudo para 24/10 15:02 (SP). Nenhuma troca detectada (com antes/depois de thumb ou efeito) anterior a 03/10; coluna "Trocas" rotulada "desde 03/10 (21 d)" ou "30 d" contando só o que existe.
2. Efeito inventado (troca 13/09 com views/dia antes/depois) → "Troca anterior ao início da coleta por vídeo (03/10): sem antes nem depois para medir".
3. Efeito fora do modelo → CONVENCOES "Modelo de efeito de troca" (observado vs esperado, n, veredito ícone+texto, inconclusivo para troca simultânea).
4. Placeholders como dado real no drawer de canais ≠ Matt ("Título anterior registrado"; "Lista completa no mockup final"; bald com 1 vídeo "— views") → cada canal com conteúdo coerente e do tipo certo.
5. Janelas que excedem a coleta: "views/dia mediana 90 d" → série por vídeo tem ≤ 21 d: "mediana dos últimos 21 d (desde 03/10)". Inscritos 30 d pode ficar (ver nota acima); remover a contradição do Vou sem volta (recém-adicionado: "precisa de 30 d de coleta" vale só para ele).
6. "14 de 15" justificado por quota (suposição) → "Limite de 15 canais definido no observatório. Para acompanhar outro, remova um." Sem .meter.

IMPORTANTES
1. Cobertura: "50 mais recentes" → "N vídeos do limite do canal (até 200)" com N real.
2. Multiplicador no formato da CONVENCOES ("9,8× vs vídeos do canal com 31–90 dias (n = 12)", método, sem contar este vídeo, base fraca n<3 — inclusive no seu canal n = 2).
3. Janela de outliers: "até 90 dias (0–30 + 31–90)".
4. Nicho é filtro GLOBAL da moldura (mostrar a barra global no topo do mockup, persistida); contagens atualizam ao mudar nicho de um canal; seg de formato "Longos / Shorts".
5. Barra de estados do mockup no topo, recolhível, não fixa; ?theme=light|dark + toggle.
6. Tokens → CONVENCOES (danger texto #F26B6B, tier-top #E0735C, todos os claros). Contrastes do youtag "seu canal" e select de nicho no claro.
7. Thumbs com gradiente → 2 blocos sólidos, texto 18–22% da altura, silhueta com ombros.
8. Alvos < 32px (.tip, .niche, .seg button, .btn.small, demo) → área clicável ≥ 32.
9. Semântica: abas do drawer (aria-controls, setas, tabpanel), focus trap no dialog, menu ⋯ com setas, sort alterna direção + aria-sort, button type, nome do canal como botão explícito "Abrir detalhes de X".
10. Tooltip de arredondamento de inscritos 10× errado (±5 mil, não 50 mil); bald −0,1% → "dentro do arredondamento do YouTube".
11. color-mix() na célula sticky do seu canal → rgba/hex literal (Opera renderiza color-mix transparente).
12. Linha de grupo some no scroll horizontal → span sticky dentro da td.
13. Drawer incoerente com escala da tabela (absoluto vs por mil; sem janela); pílula de sync sem horário absoluto (SP) no title.
14. Pontes: "Ver os N outliers" / "Ver as N trocas" (Outliers/Mudanças filtrados pelo canal); "Ver histórico do vídeo" com destino (historico-video.html); ⋯ com "Copiar pedido para o Cowork"; opcional "Pedir leitura à forja" do canal.

MENORES
1. "há 6 horas" → "há 6 h".
2. "⧗" vira tofu → SVG + "Aguardando".
3. Título antigo riscado → muted + rótulo "Antes".
4. Select "Ordenar" duplica cabeçalhos com nomes diferentes → alinhar nomes (ou remover o select).
5. Meta do grupo IA "1 com erro" sem ícone → ícone.
6. Explicação de quota só se vier de quotaExceeded real — no mockup, use erro por canal plausível (ex.: 404 canal não encontrado — mudou de handle?) para não insinuar quota.
7. .arrow opacity → --dim.
8. Mudar nicho sem feedback → toast "Nicho de X alterado para Viagem — vale para todas as abas".
9. "14/05" sem ano → "14/05/2026" quando > 1 ano ou ambíguo.

EXCELENTE (não mexer): tira de cadência de 13 semanas (elemento memorável); linha "seu canal" fixa com escala "Por mil inscritos"; vazios honestos por célula; confirmação de remoção explícita; tabela densa com unidade/janela em toda coluna e a mesma cells() alimentando tabela e cards.
