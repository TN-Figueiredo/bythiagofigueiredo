# Conferência da Naksu: 19-1 (mockup 19, peças 1 a 3)

Só os achados de REVISAO-NAKSU-19-1.md. Capturas: revisao-naksu-shots/conf-19-1/. Servidor 47702 derrubado.

| Achado | Estado | Evidência |
|---|---|---|
| A1 esqueleto "Canais removidos" | RESOLVIDO | m19.css L182-183: `.m-can.esq{min-height:187px}`, 312 px até 1200 px; arquivo.js L220 usa a grade `.m-can`. Medido: 390 px = 312 e 312 (linhas reais 147 a 335); 1440 = 187 (reais 97 a 210). Parcial por natureza: linhas curtas (147, 97) encolhem um pouco, mas o salto cai de 130-450 px para no máximo ~90 px. Aceito. |
| A2 nome quebra a 390 | RESOLVIDO | m19.css L181; computed `white-space: normal` a 390. |
| A3 pontilhado âmbar x neutro | RESOLVIDO | m19.js L14 (`1 2.2`, traço 2.2, "!" dentro) e L79 declara na legenda; NOTAS declara a divergência do spec 04 L141. |
| A4 `.m-ibtn` e `.btn` | RESOLVIDO | declarado no NOTAS ("Declarado (Naksu A4)"). |
| S1 rótulo cortado no eixo P1-10 | RESOLVIDO | m19.css L240 e L246. 390: segmentos 328 px, `.rot` 17 px de altura, scrollWidth <= clientWidth, rótulo "(03/10/2026)" inteiro (captura eixo-p1-10-390.png). 1440: `.antes` 139 px, `.rot` 51 px (no limite pedido), `.arq` 34 px; sem rolagem horizontal. P1-4 idem. |
| S2 largura ilustrativa | RESOLVIDO | series.js L74 e L95: "Largura ilustrativa, fora de escala." |
| S3 células de idade | RESOLVIDO | m19.css L227 `minmax(120px,1fr)`. Não remedi as linhas a 1440. |
| I1 links da tabela a 390 | RESOLVIDO | m19.css L265; a 390, 0 links visíveis com largura < 44 px (os 112 a 1440 são desktop, sem exigência de 44). |

Defeito novo bloqueante criado pelas correções: nenhum (sem rolagem horizontal nas páginas medidas).

Não verificado de novo: Opera, leitor de tela, escala de cinza do A3 em captura (li o código e a legenda, não a captura), tema escuro nesta rodada (as correções não mexem em cor além do traço âmbar já medido).

Veredito: ACORDO nas três páginas (index, series, arquivo).
