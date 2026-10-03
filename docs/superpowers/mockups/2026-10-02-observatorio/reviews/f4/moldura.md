NOTA F4: 87/100 — auditMockup 0 (1440/1200/768); 9 estados; teclado; sidebar; persist:false; bateria hostil do doc ok.
TELA
B1. Depois de publicado, botão do cabeçalho leva ao card publicado (beco) → openForja com flow 'done' vai para 'choose' mantendo S.pub; ou "Pedir outra leitura" no card.
I3. Prévia/thinWarn/lastOf com effNiche() (Todos com IA usada).
I4. FJ.timing(S.req, effNiche()) por nicho.
I10. Rodapé sticky do drawer sem conteúdo por baixo (bottom:-40px / sem padding; nota fora do sticky).
M7 "Fica na fila até a forja ficar livre". M8 relógio sem rótulos encavalados. M9 .inflight nowrap. M12 código morto/duplicado. M13 audit limpa URL e cobre #ch-toasts/#ch-mock.
CHROME
I1. Cabeçalho quebra com drawer entre 1280–1500 → modo compacto pela largura disponível (container query em .ch-main ou regra .ch-with-drawer).
I2. Copiar para o Cowork: await writeText; falha → toast warn "Não deu para copiar" + texto selecionável.
I5. Toasts nó a nó (sem re-render), foco devolvido ao fechar.
I6. persist:false não vaza pelas abas (links das abas com nicho persistido) — CONVENCOES F4.
I7. #ch-req-status: nome = texto visível + aria-describedby com statusText.
I8. Compacto a 768: botão da forja com rótulo; "Pedido em andamento" escondido no compacto (status ao lado).
I9. Blindagem de ::before/::after dos nós do chrome; documentar limites (!important de elemento).
M1 mount após destroy lê a URL atual e zera estado. M2 update({niche,persist}); comentário do topo atualizado. M3 reduced motion em pseudo-elementos. M4 nome acessível curto do item Cowork. M5 aria-controls só quando aberto; popover fecha ao perder foco; sidebar sem estado duplicado. M6 "sem máquina · 12:55" no frescor. M10 sidebar ativa claro rgba(184,72,26,.08)/#9A3A12. M11 2º toast "Concorrentes sincronizados". M14 status terminal no cabeçalho (CONVENCOES F4).
