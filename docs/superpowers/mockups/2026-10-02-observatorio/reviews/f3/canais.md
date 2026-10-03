NOTA F3: 81/100 — números de OBS nas 15 linhas; sem chrome local; .ch-* blindado; console limpo.
B1. REGRESSÃO do escopo de CSS: `#screen /* comentário */ :root{…}` vira `#screen :root` → tokens da tela vazios (ritmo preto, nicho sem cor, seu canal sem fundo, tiers em muted). Corrigir (tokens em `#screen{…}` ou :root isolado) e reconferir contraste das faixas no claro. AUDITORIA: checar que todo custom property usado pela tela resolve para valor não vazio.
I1. Pedido guardado por canal, escopo é o nicho → st.forja[niche]; abrir drawer nunca zera setForja se há pedido em andamento.
I2. Drawers de canais fora do escopo mostram o status do pedido do nicho + motivo no botão desabilitado.
I3. Restaurar nichos com drawer aberto → re-render do drawer.
I4. Foco após trocar nicho pela linha → mesmo select (ou próxima linha).
I5. .dstats .l sem ellipsis (white-space normal ou 2ª linha).
I6. Vazio com ?filter=problemas → "Nenhum canal com problema em IA" + "Mostrar todos".
I7. own-empty: perMilSubs coerente com o cenário; OE.cadence também no modo Shorts.
I8. "Nenhum Short entre os N vídeos acompanhados" (não "não publicou desde 03/10").
M1 setTabNew(null) fora do publicado. M2 "Ver a leitura" leva readingId (Mudanças aceita reading=?) ou "aparece no topo de Mudanças". M3 sem parênteses aninhados. M4 ≈ 0 sem símbolo duplicado. M5 cap dos cards sem margin-left inline. M6 replaceState remove add/channel ao fechar. M7 "Sincronizado agora" coerente com grupo/crescimento/cabeçalho. M8 OBS.tierOf e FM.subs. M9 regras de OBS.RULES/OBS.SYNC. M10 "Testar e comparar". M11 drawer a 768 em 2 colunas. M12 separador único no efeito. M13 /cms/upnext ok.
