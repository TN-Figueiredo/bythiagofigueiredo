# Brief (executor): qualidade da compactação e simulação do limite

Contexto: o dono ligou `autoCompactWindow: 300000` no global em 14/10. Na avaliação de 21/10 ele quer saber se a
qualidade piorou e se o limite deve subir (400K, 500K) ou ficar. Acrescente isso a `~/.claude/hooks/custo-aceite.py`
(sem quebrar `janela`, `diario` e `relatorio`; o `diario.csv` NÃO muda de colunas).

## 1. Subcomando `qualidade --desde ... --ate ...` (incluído também como seção no `relatorio`)
Só sessão principal (não subagente). Detecte cada compactação (queda grande de contexto entre passos seguidos, ou o
marcador de compact/summary que o log tiver; documente qual foi usado). Para cada uma, olhe os 20 passos seguintes:
- **releitura**: Read de caminho já lido na mesma sessão antes da compactação (contagem e % dos Reads da janela).
- **correção do dono**: mensagem do usuário (texto digitado, não tool_result) que case, sem diferenciar maiúscula e
  minúscula, com: `já (te )?(falei|disse|decidimos|combinamos)`, `de novo`, `esqueceu`, `não era isso`, `perdeu o fio`,
  `#perdeu-o-fio`.
- **pergunta ao dono**: turno do assistente que termina em `?` ou usa AskUserQuestion.
**Controle**: as mesmas três taxas, por passo/turno, nos trechos da mesma janela que estão a mais de 20 passos de
qualquer compactação. Saída: tabela pós-compactação × controle, com razão (x vezes) e N de cada lado. Liste também a
contagem de `#perdeu-o-fio` com data e sessão (só o id curto, sem o texto da mensagem).

## 2. Simulação do limite (`--limites 300000,400000,500000,1000000`)
Para cada sessão principal da janela, reconstrua a curva de contexto por passo e simule cada limite: ao passar o
limite, compacta (contexto cai para a mediana pós-compactação observada nos dados; se não houver dado, 90K e diga isso),
paga o custo real médio de uma compactação observada (output do resumo + escrita de cache) e segue com o mesmo
crescimento por passo. Saída: US$ da principal por limite e diferença contra o limite atual. Indique as premissas.

## 3. Recomendação automática no relatório (regra, não opinião)
- Se o N pós-compactação for menor que 10 compactações: "dados insuficientes; manter 300K mais 1 semana".
- Se a correção do dono ou a releitura for ≥2× o controle, e a economia de 300K contra 500K for <US$ 5/dia: "subir para 500K".
- Se a correção for ≥2× o controle e a economia for ≥US$ 5/dia: "decidir com o dono" (mostrar os dois números).
- Senão: "manter 300K".
- Qualquer `#perdeu-o-fio` aparece em destaque, seja qual for a regra.

## Regras
Python stdlib, `python3 -I`, só agregados (nunca texto de mensagem na saída, exceto o id da sessão). Nenhum comando
parado mais de 4 min. Teste com uma janela dos últimos 7 dias (vai ter poucas compactações, o que é esperado) e grave a
saída em `~/Workspace/handoff/custo/prova-qualidade.txt`. Relatório final em até 10 linhas.
