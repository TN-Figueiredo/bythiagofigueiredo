# Rodada 1 (17/10): Logan e Naksu, sobre o mockup v1
Pareceres completos: `/tmp/abgen/r-logan.md`, `/tmp/abgen/r-naksu.md` (não versionados). Veredito de ambos: volta para ajuste.

## Logan (UX)
| Item | Achado | O que foi feito |
|---|---|---|
| B1 | botão/item desligado onde falta dado contraria "sem dado sem botão" | removidos (2b e menu 3d); fica só a frase |
| B2 | menu leva a faixa "trocou a thumbnail" sem troca; "Testar esta thumbnail" lê como copiar | rótulos "Testar uma ideia a partir desta thumbnail/deste título"; faixa nova "thumbnail de <canal>" (5b) |
| C1 | três nomes para a mesma ação no próprio | mantidos (textos do dono); registrado no INVENTARIO |
| C2 | dica "thumbnail de antes como versão A"; "Caiu." sem ressalva | dica e frase reescritas |
| C3 | "sem leitura" cobre três estados | três frases (não medido, restrito, falhou) |
| C4 | botão no concorrente não medido | mantido, razão no INVENTARIO |
| C5 | "Ver teste" repetido em 4b | aviso único no topo |

## Naksu (UI)
| Item | Achado | O que foi feito |
|---|---|---|
| B1 | gatilho ⋯ 36 px em 390 (cascata) | regra com `.frame .abtn` |
| B2 | miniatura do seletor 279x36 | `.th.mini` 64x36 |
| C1 | texto < 12 px (`.num`, `.av`) | 12 px; fundo do avatar #B34A25 |
| C2 | wizard real é `cms-*` | declarado na legenda 5c e no INVENTARIO |
| C3 | título longo no seletor | clamp de 2 linhas e reticências |
| C4 | botão de largura total em 390 | `width:auto` |
| S1, S3 | largura do link "Trocar"; marcas se sobrepõem | aplicados; S2 (borda do `.btn`, 1,55:1) é do sistema, registrado para o tema A1 |
