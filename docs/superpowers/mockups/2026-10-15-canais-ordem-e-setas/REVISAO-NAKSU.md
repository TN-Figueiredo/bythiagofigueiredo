# Revisão da Naksu (UI): mockup 17, Canais ordem e setas (15/10/2026)

Veredito: **APROVA COM RESSALVA**. Nenhum achado bloqueia; 2 "corrige" (C1, C2) entram antes de ir ao dono; o resto é sugestão.
Capturas e medidas: `shots/naksu/` (16 capturas 1440/390 x claro/escuro x 4 ordens, `medidas.json`, `hostil-1440.png`, `hostil-390.png`, `crop390-*`, `foco-1440-claro.png`, `pop-cr-1440-claro.png`). Navegador: Chromium (Playwright, file://).

## O que acerta (preservar)
- Tokens: o bloco `:root` (escuro e claro) é idêntico ao do mockup 16 (diff de `--*`: só faltam `--c2-*`/`--ic-*`, que esta tela não usa). Sem `color-mix()`, sem z-index, nenhum texto < 12 px (varredura de `.scr *`: zero).
- "+/−" no Crescimento em texto neutro (`--text`) e ▲▼＝ só na Direção: distinguíveis a olho em 1440 e 390; a legenda da ordem (`.leg`) diz isso na hora em que importa. Em tons de cinza a Direção continua legível (forma ▲ ＝ ▼ + sinal + régua).
- "Sem medida" no fim nos dois sentidos, com traço na P e divisor próprio; "não medido" tem pílula hachurada (forma) e motivo.
- 390: sem rolagem horizontal (scrollWidth = clientWidth = 364 em todas as 8 combinações); alvos 44 px. 1440: `.tw` 1382 = 1382.

## Achados

### C1 corrige: o "＝" de empate colide com o "＝" de "sem mudança" (P x Direção)
- Tela: Canais, ordem Direção (e Crescimento, onde as duas colunas aparecem juntas), 1440 e 390, ambos os temas.
- O mesmo glifo "＝" significa "empatado" na coluna P (`td.p .tie`, 12 px, `--muted`) e "sem mudança" no selo da Direção (`.sy.eq`, 20x20, `--dir-eq`). Na captura `1440-escuro-cr.png` as linhas 6º＝ ficam a 600 px de um selo ＝ e o olho lê os dois como o mesmo conceito. No mockup a Direção não empata (nenhum % igual), mas com 75 canais empate de percentual inteiro é certo (a própria NOTAS pergunta 3 diz que vale), e aí "4º＝" ficará ao lado de um selo "＝ +4%".
- Correção: trocar o símbolo de empate por texto. P vira duas linhas: `6º` (13 px mono, `--text`) e embaixo `empate` (12 px, `--muted`, sans); a 390, no canto do cartão, `6º · empate` na mesma linha. Largura da coluna P: de 56 para 64 px. A legenda `＝ mesma posição: mesmo valor na tela.` vira `empate: mesmo valor na tela, mesma posição.` Manter o `.sr` ", empatado".

### C2 corrige: contradição visível na regra do arredondamento do Crescimento
- Tela: Canais, ordem Crescimento, 1440 (`1440-escuro-cr.png`).
- "Linha de Comando Zen" mostra `+0,6%` (+400) na 5ª posição, e "Bússola Quebrada" (+1 mil, 0,85%) cai em "sem variação" 6º＝. Quem lê vê um ganho MAIOR sumir e um menor aparecer. A causa (passo do arredondamento 100 contra 1.000) está só no ⓘ.
- Correção: no cartão "sem variação" mostrar o dado que existe, na segunda linha: `dentro do arredondamento (±2 mil)` com o passo daquele canal (2 x passo, `2 × 1.000`), para o leitor ver que o limite é por canal. Mantém a posição por empate; só dá a razão onde a dúvida nasce. Alternativa mais barata: texto `±2 mil: não distingue de zero`.

### S1 sugestão: Crescimento negativo só por sinal
- `.cr.neg .big` tem a mesma cor de `.cr .big` (`#F5EFE6` escuro / `#231C14` claro, 14,5:1 e 15,8:1). O sinal "−" em mono 15 px é a única marca; em listas de 75 linhas perdas não saltam. Respeita a decisão (cor de direção só na Direção) e passa "cor E forma", mas é o ponto mais monocromático da tela. Opção sem nova cor: negrito 600 já está; acrescentar o ganho em `--muted` é o que há. Não corrijo; registro para o roteiro de teste do dono.

### S2 sugestão: chevrons dos cabeçalhos inativos parecem "ordenado ↓" nas 3 colunas
- `.hb svg` opacity .45 sobre `--surface-2`: ≈ 2,2:1 (elemento gráfico, abaixo de 3:1) e os 4 apontam para baixo; o ativo se distingue por peso 600 (12,5 px), cor `--text` e faixa `td.c-ord`. Trocar o inativo por duplo chevron ⇅ (ou ocultar até hover/foco) e deixar o ativo com um só. `aria-sort` já está certo.

### S3 sugestão: alvo dos cabeçalhos a 1440
- `.hb` 28 px de altura (63 a 94 px de largura), `.ibtn` 28x28; a 390 já sobe a 44. Mouse em desktop; subir o `.hb` a `min-height:36px` sem mudar o ritmo (a célula já tem 10 px de padding).

### S4 sugestão: moldura de coluna ordenada a 390
- `td.sel` desenha outline 1,5 px `--text` + offset 3 px, que se parece com anel de foco (e `:focus-visible` usa outro: 2 px `--accent`). Usar fundo `--surface-2` com borda 1 px `--border-strong` e deixar o contorno forte só para foco.

### S5 sugestão: nomes de componente
- A Direção em produção é `.tr-dv` (mockup 16, `.tr-dv.up/.dn`); aqui virou `.dir`/`.sy`. Declarar na implementação que `.dir` = `.tr-dv` (mesmo componente, ganha `aria-sort` no cabeçalho) e que `.sy.eq` usa `--dir-eq`, para não nascerem dois selos.

## Dado real (injetado no DOM; o mockup não tem controle para isso)
- Nome de 120 caracteres + palavra de 50 sem espaço: quebra por `overflow-wrap:anywhere`, sem rolagem horizontal (1440: linha 80 px; 390: 6 linhas, cartão 398 px). OK, mas o cartão mais alto empurra a P para o canto, que continua alinhada (position:absolute). Sugestão: `line-clamp:2` no `.cn` com o nome inteiro em `title`/ⓘ, para a lista não ficar com linha de 400 px.
- 75 linhas: 1440 = 6.721 px de altura; 390 = 24.757 px de rolagem (≈ 330 px por cartão). Funciona, mas 24 mil px a 390 é longo: a barra "Ordenar por" rola embora e não fica fixa. Sugestão: `position:sticky` na `.sortbar` (e para o Logan: paginar ou virtualizar acima de ~40).
- Número de 9 algarismos no mock ("123.456.789" no lugar de inscritos): cabe; o produto formata com `mil()` ("123 mi").
- NÃO testei: P com "＝" em 3 dígitos ("100º＝") a 1440 (coluna fixa 56 px, `white-space:nowrap`; estimo 59 px, alarga a coluna 3 px: resolvido em C1 com 64 px); lista vazia; erro de carregamento; esqueleto (o mockup não tem esses estados, são da implementação: esqueleto com 14 linhas de 77 px a 1440 e cartões de 330 px a 390).

## Tabela de medidas
| Par / bloco | Escuro | Claro | Mínimo |
|---|---|---|---|
| `--muted` sobre `--surface` | 6,18 | 7,13 | 4,5 ok |
| `--muted` sobre `--surface-2` (cabeçalho) | 5,90 | 6,43 | 4,5 ok |
| `--text` sobre `--surface` | 14,48 | 15,76 | ok |
| `--dim` sobre `--surface` | 4,86 | 5,59 | ok |
| `--on-lado` sobre selo ▲ | 8,13 | 6,81 | ok |
| `--on-lado` sobre selo ▼ | 8,62 | 5,93 | ok |
| `--on-lado` sobre selo ＝ | 6,92 | 7,62 | ok |
| selo ▲ contra `--surface` (gráfico, 3:1) | 7,26 | 6,37 | ok |
| selo ▼ contra `--surface` | 7,71 | 5,55 | ok |
| pílula "não medido" `--nm` sobre `--nm-bg` | 6,77 | 6,37 | ok |
| chevron inativo (opacity .45) | ≈ 2,2 | ≈ 2,4 | 3 (S2) |
| `--border` contra `--surface` (decorativa) | 1,44 | 1,77 | não carrega significado |
| Texto menor da tela | 12 px (`.ct`, `.hu`, `.tie`, `.sy`) | igual | 12 ok |
| Alvos 1440 / 390 | 28 px (`.hb`, `.ibtn`) / 34 px (`.btn`) | 44 px a 390 | 44 (S3 só em 1440) |
| Rolagem horizontal | nenhuma, 8 combinações | nenhuma | ok |
| Valores soltos | nenhum cor/raio novo; 124 px da régua `.rg`, 56 px da P (a mudar para 64) | | |

## Não verifiquei
Opera real (só Chromium; sem `color-mix`, então o risco é baixo), leitor de tela (li o `aria-sort`, `aria-label` dos ⓘ e `.sr` no código, não ouvi), aparelho real, rede lenta (as fontes vêm do Google), toque no ⓘ. Foco por teclado: captura em `foco-1440-claro.png` mostra anel `--accent` de 2 px nos cabeçalhos.

## Para o Logan
Faixa do dono "sem posição por Crescimento" ocupa um bloco inteiro de 87 px por duas informações negativas (nada a fazer aqui, só observar); pergunta aberta 1 (P recontada de 1º no sentido crescente x posição canônica na faixa) é dele.
