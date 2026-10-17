# Rodada 2: achados de Logan e Naksu e onde cada um foi resolvido

Arquivos: `index.html` (mockup) e `INVENTARIO.md`. Sem navegador nesta rodada: render real em 390/1440 fica para o Gio.

| Achado | Resolução |
|---|---|
| Logan R1 (T9 "leitura falhou" / "teste A/B restrito") | T9: pastilhas dizem só `falhou` e `restrito`; o complemento foi para a frase ("A leitura falhou: ...", "Teste A/B restrito: ...") |
| Logan R2 ("Não carregou:" nas frases) | INVENTARIO, seção 0: "A leitura falhou:" no mesmo commit do rótulo (C5, C7, C10); chaves internas ficam |
| Logan F1 (duas saídas para o mesmo estado) | Regra escrita na legenda do erro e no INVENTARIO: onde há botão a frase não manda recarregar; onde não há, "recarregue"; nunca as duas |
| Logan F2 (bloqueante, três estados) | T8: seção "Os três estados": (a) Tentando (botão `aria-disabled` + `aria-busy`, largura mínima fixa), (b) Falhou de novo, (c) Deu certo com foco no valor e `aria-live`. Colunas lado a lado no 1440, empilhadas no 390 (container query, botões do topo). Mais um bloco "Ao vivo" clicável (1ª vez falha, 2ª dá certo) |
| Logan F3 / Naksu 2 (alvo 44 px) | `.retry`: `min-height:44px; padding:0 12px`, fora da pastilha, `flex-wrap` (embaixo no 390, ao lado no 1440); um botão por bloco |
| Logan F3 / Naksu 3 (`role="alert"` repetido) | Nenhum `role="alert"` restante; avisos de lista usam `role="status"` numa nota só por lista |
| Logan, sugestão (tabela longa) | Mantida a nota única acima da tabela (T3) |
| Logan A4/A16/A20 | INVENTARIO: ficam "não medido", com o teste de A23 como condição |
| Logan B6-B8 | INVENTARIO: modelo passa `estado` em toda célula |
| Logan C9 | INVENTARIO: lista de Canais mostra restrito na coluna do canal próprio |
| Logan D1 | INVENTARIO: "falhou"/"restrito" no pacote da IA, entram na varredura de frases |
| Naksu 1 (número da borda) | INVENTARIO seção 0: 6,18:1 (escuro) e 7,13:1 (claro); borda não foi mexida; 1,1-1,2 é só o preenchimento |
| Naksu 4 (sem cor nova para restrito) | Mantido `--muted`; nenhuma cor criada |
| Naksu 5 (quadradinho sem `title`) | Todos os `.q` ganharam `title` igual ao `aria-label` |
