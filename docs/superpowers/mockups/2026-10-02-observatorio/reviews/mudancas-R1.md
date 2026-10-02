NOTA R1: 78/100 (dados 16/25, utilidade 15/20, hierarquia 13/15, sistema 8/10, texto 9/10, a11y 8/10, técnica 9/10)

BLOQUEADORES
1. Veredito em views/dia bruto com cara de efeito. Aplicar o "Modelo de efeito de troca" da CONVENCOES: observado vs esperado sem a troca.
   - Esperado pela idade = mediana da razão views/dia(idade+k)/views/dia(idade) de vídeos do MESMO canal e formato na mesma faixa de idade que NÃO foram trocados (dados existem só desde 03/10 — dizer n). Combine com tendência pré-troca quando pré ≥ 7 d.
   - Controle do canal: dividir pelo movimento dos outros vídeos do canal na mesma janela (absorve vídeo novo puxando os antigos).
   - Banda de ruído derivada da variação pré-troca, não ±10% fixo.
   - Painel: "Observado 420/dia · Esperado pela idade 455/dia (faixa 410–500) · −8%, dentro do ruído". Sparkline com projeção tracejada pós-troca + banda sombreada. Ganhou/Perdeu só fora da banda, selo "ajustado pela idade e pelo canal · não prova causa".
   - Sem base (vídeo < 14 d ou pré < 7 d): "Sem base ajustada: vídeo novo demais" — sem veredito colorido.
   - Ledger: mediana do efeito ajustado; trocas combinadas e reversões em linha própria.
   (Caso Nate Herk: pré caiu −35% em 7 d; pós achatou → bruto diz "Perdeu", ajustado seria neutro/positivo.)
2. Resumo contradiz feed (16 trocas na semana / Matt Wolfe 5, mas feed decrescente mostra trocas de 15/10, 11/10…; reversão fora da janela). Números do resumo derivam do mesmo dataset do feed.
3. Mediana thumb "+18%" n=4 não bate com os cards (≈ +3%). Recalcular dos dados; dizer se troca combinada entra.
4. Filtros só filtram as 11 carregadas ("Descrição 24" + Viagem dá vazio). No produto filtro é server-side sobre os 136; vazio só se não há nada em 90 d; contadores dos chips recalculam por nicho/canal. No mockup: dataset com mais itens e contagens coerentes.

IMPORTANTES
1. "Provável teste A/B do YouTube" afirma demais (título alternativo ficou 20 dias). → "Voltou ao título de 12/09 (ficou 20 dias no ar)"; "compatível com Test & Compare" só se ≤ 14 d ou alternância.
2. Thumb antiga com filter saturate/brightness distorce a comparação → mesma fidelidade, marcar só por rótulo/borda.
3. Título antigo inteiro riscado é ilegível → quando reescrito inteiro, antigo sem <del>, em dim; risco só em diff parcial.
4. "Recuperou parte da queda" é causal → "Views/dia voltaram a 1.174, perto do nível antes da 1ª troca. Não prova causa."
5. Sem ordenação por efeito e sem ponte com a forja → seletor "Mais recentes / Maior efeito ajustado"; no resumo, um botão secundário "Pedir leitura à forja" (classificar padrões de reescrita), selo forja.
6. Laranja em "Carregar mais" → neutro.
7. Contraste claro botão primário → tokens claros da CONVENCOES.
8. --muted redefinido → tokens da CONVENCOES.

MENORES
1. "horário de Brasília" em toda linha → uma vez no cabeçalho ("Horários em São Paulo").
2. Sparkline esticada ao redimensionar (preserveAspectRatio none) → ResizeObserver ou rótulo fora do SVG.
3. Eixo Y truncado exagera → base perto de 0 ou mín/máx nas pontas.
4. "Salvar no swipe file" quebra em 2 linhas → ícone + aria-label/tooltip ou rótulo curto mantendo o nome canônico no tooltip.
5. Alvos < 32px (.linkbtn, checkbox) → min-height 32; botão Tema com aria-pressed.
6. Topbar em 768 esconde itens sem indicação → fade.
7. Pontilhado dos dias faltantes em --faint (<3:1) → --dim.
8. ".num" monoespaça "mil" → mono só no número.
9. Chips somam 136 mas troca dupla conta 2 → explicitar "eventos".
10. aria-label das sparklines genérico → incluir números (antes, depois, esperado).

EXCELENTE (não mexer): estados de efeito específicos ("título antigo ficou só 30 min", "thumbnail mudou 22 h depois", "aguardando — veredito sai terça 28/10"); thumb não arquivada hachurada; "n = 4, pouco para concluir"; diff de título por palavra + diff de descrição com ruído UTM oculto; sparkline 7+7 com marcador.
