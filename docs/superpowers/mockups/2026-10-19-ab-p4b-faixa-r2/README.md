# Mockup r2 da faixa de restauração (P4b), 19/10/2026

Abrir: `open -a Opera index.html`. HTML estático, dados sintéticos, só hex/rgba literais, textos copiados de `faixa-restauracao-texto.ts` e `faixa-com-acoes.tsx`. Tokens de `globals.css` (`--theme-cms-*`, `--pb-accent`).

Cada estado (d erro, f só "Já corrigi", tentando) aparece em dois temas lado a lado, a 1440 px (conteúdo de 1154 px, como nas capturas) e a 390 px, em três versões: antes (o que está no ar), depois com padding 16 em volta (opção A) e depois com padding 12/16 (opção B).

## O que mudou, item a item (lista da Hanna)

| # | Mudança | Onde ver |
|---|---|---|
| 1, 2 | Borda dos botões com token novo `--btn-ctl` (#928871 escuro, #756A51 claro), 4 a 4,7:1; antes era `--cms-border`, quase invisível. Vale também para Pausar e Encerrar (só a cor da borda). | Todos os botões secundários |
| 3 | Primário no tema claro: texto #FFF8F0 sobre #B94210 (5,18:1; antes #1A120A, 3,39:1). | Tema claro, "Tentar agora" |
| 4 | Botões da faixa a 36 px (padding 8 16, fonte 13, gap 8), raio 9 mantido. Pausar e Encerrar não mudam de tamanho (pergunta 3). | Qualquer botão |
| 5 | Botões em `.fr-botoes`; a 390 px viram coluna, largura total, 44 px. | Versões de 390 px |
| 6 | Link, nota e botões num grupo `.fr-acoes` com gap 12. | Distância link/botões |
| 7 | Faixa: padding e gap 12, borda esquerda 4 (era 5). O padding é a pergunta 4: A = 16 em volta, B = 12/16. | Linhas "opção A" e "opção B" |
| 8 | Colunas do resumo 20 + 8; ícones das linhas com 2 px a mais: "Erro:" e "Título" no mesmo x. | Alinhamento à esquerda |
| 9 | Link com altura mínima de 24 px (44 em toque), sem o vazio de 44 px de antes. | Acima dos botões |
| 10 | "Horários de São Paulo" com 8 px de margem (era 6). | Topo da faixa |
| 11 | Tentando: primário laranja cheio com "Tentando…" (texto novo, pergunta 2); "Já corrigi" desabilitado em cinza legível, sem 50% de opacidade. | Estado tentando |
| 12 | Só no escuro: fundo de erro rgba(248,113,113,.12), âmbar rgba(251,191,36,.12), azul rgba(56,189,248,.12); linhas de erro .55 e de info .5. Tema claro igual. | Tema escuro, depois |

13 (teste e 36 capturas) é de código, fora do mockup.

## O que o dono testa

1. Os botões agora parecem botões (borda visível, 36 px) nos dois temas? Se ainda parecerem quadrados, o gatilho é subir o raio de 9 para 10 (D1).
2. Padding: A (16 em volta, mais respiro, 8 px mais alta) ou B (12/16, como o cartão S7)? Padrão recomendado: A.
3. "Tentando…" no botão laranja no estado tentando: aprova o texto novo?
4. Escuro: as cores de fundo da faixa leem melhor de relance? (único item que muda matiz)
5. A 390 px: botões empilhados em largura total, link perto dos botões.
6. Não mudam: Pausar e Encerrar (só a borda), fuso fora da faixa, raio.
