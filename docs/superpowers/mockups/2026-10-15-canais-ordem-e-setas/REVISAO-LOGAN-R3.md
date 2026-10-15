# Revisão de textos das dicas por célula, r3 (Logan, 15/10)

Escopo: só texto em `index.html` (funções `tipXxx`/`nmTip`). Estrutura, dados e lógica intactos. Backup antes da troca: fora da pasta (scratchpad). Não revi com leitor de tela nem em aparelho real.

## Inventado pelo mockup (conferido no código)
| Item do mockup | O que o produto faz | Fonte |
|---|---|---|
| Sync a cada 6 h / 24 h / 3 dias por ritmo; "1 h" no canal próprio | Todos os canais seguem as mesmas faixas fixas 00h, 06h, 12h e 18h (São Paulo). Não há intervalo por ritmo. | `competitor-sync-batch.ts:43`; `syncTip` em `view-model.ts:961` |
| "o YouTube não respondeu" na falha | O produto não distingue a causa na célula; só diz que a sincronização não completou. | `estado-model.ts` / `cells.tsx` SyncView |
| Limiar de 5 longos para Outliers | Não existe. Outlier = vídeo longo de até 90 dias com 2× ou mais a mediana de views/dia (7 d) do canal; sem mediana, sem outlier. Os limiares reais são `outlierMin: 2`, `weakBase: 3` (mediana) e `medianMinN: 5` (só Temas e Lacunas). | `rules.ts:8-9,102`; `outliers.ts:30-37,120` |
| Outlier "contra o esperado para a mesma idade" | A base é a mediana do canal, não a idade do vídeo. | `outliers.ts` |
| "Passa a medir em DD/MM" | O produto fala em "a janela ainda não fechou e fecha em DD/MM" e, sem data, "não há data prevista para fechar". Data de competidor é derivável (56 ou 30 dias menos os já coletados); a do canal próprio não está no código. | `medidas-frases.ts:41` |
| Trocas "vistas nos vídeos acompanhados" | A janela é 30 dias, longos e Shorts. | `channel-table.tsx:32` |
| Aviso "poucos vídeos" em Views/dia com n < 5 | O corte de mediana no código é 3 (`weakBase`). Texto mantido; **a regra do mockup (n < 5) precisa de Yannis**. | `series.ts:203` |

## Antes → depois
- **Crescimento, não medido, próprio:** "Seu canal ainda não tem a coleta de inscritos ligada, então não há número de 30 dias. Sem data: passa a medir 30 dias depois de ligar." → "Seu canal ainda não tem a coleta de inscritos ligada. Passa a medir 30 dias depois de ligada."
- **Crescimento, oculto:** "O canal esconde os inscritos, então não há o que comparar. Sem data: só muda se ele mostrar." → "O canal esconde os inscritos: não há o que comparar. Sem data prevista; só muda se ele mostrar."
- **Crescimento, não medido, concorrente:** "Só N dias de registro; precisamos de 30. Passa a medir em DD/MM." → "Só N dias de registro; a medida pede 30. A janela fecha em DD/MM."
- **Direção, não medido, próprio:** "Seu canal tem 20 dias de coleta própria; ... precisa de 56. Passa a medir em DD/MM." → "Seu canal ainda não tem 56 dias de coleta (28 contra 28). Sem data prevista." (o "20 dias" e a data eram inventados)
- **Direção, não medido, concorrente:** "Só N dias de vídeos; precisamos de 56 (28 contra 28). Passa a medir em DD/MM." → "Só N dias de vídeos; a medida pede 56 (28 contra 28). A janela fecha em DD/MM."
- **Direção, medido:** sem troca (já cumpre: número primeiro, igual ao ⓘ do cabeçalho e ao pedido do dono).
- **Crescimento, medido:** "Há 30 dias: X inscritos. Hoje: Y. Ganho de G (P%). O YouTube arredonda este canal de 1 mil em 1 mil." → "De X para Y inscritos em 30 dias: G (P%). Inscritos arredondados a 3 algarismos pelo YouTube." (texto de Hanna)
- **Crescimento, dentro do arredondamento:** "Há 30 dias: X. Hoje: Y. A diferença (G) é menor que 2 passos do arredondamento do canal (passo de N): pode ser só arredondamento do YouTube." → "De X para Y inscritos em 30 dias (G). Dentro do arredondamento do YouTube (passo de N): pode ser só isso."
- **Inscritos:** "O YouTube mostra N, arredondado a 3 algarismos (de p em p). O número real pode estar até m acima ou abaixo." → "N inscritos, arredondados a 3 algarismos pelo YouTube. O número real pode estar até m acima ou abaixo."
- **Views/dia:** "Mediana dos N vídeos longos dos últimos 90 dias: V views por dia. Para cada mil inscritos: Z views por dia." → "V views por dia, a mediana dos N vídeos longos dos últimos 90 dias. Por mil inscritos: Z views por dia." (número primeiro)
- **Outliers, com outlier:** "“T” fez M× o esperado: V views contra E esperadas para um vídeo da mesma idade neste canal." → "“T”: M× as views típicas do canal (V contra E)."
- **Outliers, nenhum:** "Nenhum vídeo recente passou de 2× o esperado para a mesma idade." → "Nenhum vídeo dos últimos 90 dias passou de 2× as views típicas do canal."
- **Outliers, poucos vídeos:** "Só N vídeos longos; precisamos de 5 para saber o que é esperado deste canal." → "Só N vídeos longos: ainda não dá para saber o que é típico deste canal."
- **Trocas, nenhuma:** "Nenhuma troca ... vista nos vídeos acompanhados." → "Nenhuma troca de título ou thumbnail nos últimos 30 dias."
- **Trocas, com troca:** "Mudou o título de “T”. Visto há N dias (data)." → "Mudou o título de “T”, há N dias (data)."
- **Sincronização, ok:** "Última sincronização há X, com N vídeos acompanhados. Volta a cada 6 h porque postou nos últimos 7 dias." → "Última sincronização há X, com N vídeos acompanhados. Automática às 00h, 06h, 12h e 18h (São Paulo)."
- **Sincronização, falha:** "A última tentativa, há X, não completou: o YouTube não respondeu. ... tentamos de novo a cada 6 h." → "A tentativa de há X não completou. Seguimos com os dados de antes (N vídeos) e tentamos de novo na próxima sincronização."
- **Ritmo:** sem troca.

## Pendências (não mexi: são dado/lógica, não texto)
1. Colunas "Sincronização" no mockup ainda mostram "há X h" e "N vídeos": ok; só o intervalo inventado saiu. A função `intervalo()` ficou sem uso no texto (código morto, inofensivo).
2. Outliers: confirmar com software se "views típicas" é views/dia (7 d); se for, a dica deve dizer "views por dia" e o mockup mostrar valores por dia, não totais.
3. Views/dia: corte do aviso (n < 5 no mockup, 3 no código).
4. Data do canal próprio: decidir com Phil se existe fonte; até lá, "Sem data prevista".
