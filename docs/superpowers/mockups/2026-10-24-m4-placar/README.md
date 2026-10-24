# Mockup M4 r1 — placar do teste A/B do YouTube (S8-F3 T5), 24/10/2026

`index.html` (autocontido, dados sintéticos). Seletor por URL: `?estado=&tema=claro|escuro&largura=1440|390|ambas` (também há botões no topo).
Estados: `hoje` (sem dia fechado), `atrasado`, `aguardando`, `descartados`, `naomedido`, `poucas` (1–3 impressões), `cheio` (4 variantes, 14 dias, título de 100 caracteres, 7 dígitos), `naoiniciado`, `v1`, `carregando`, `erro`. Cada um (menos carregando/erro) tem frase-resumo sem %.
Capturas: `shots/<estado>-<tema>-<largura>.png` (Playwright headless, 1440 e 390, claro e escuro).

## Como testar
1. Em cada estado, em 3 s: o que o placar já diz e o que falta? A frase basta, sem abrir nada?
2. `naomedido`: B mostra 5.000 impressões e "não medido" nos cliques, nunca 0. `poucas`: nenhum % na linha.
3. `atrasado`: âmbar aparece só aqui (faixa + "Dados parados em 21/10"). `aguardando`: relógio tracejado azul, nunca hachura.
4. 390: sem rolagem horizontal; ⓘ e chevron de 44 px; faixa de dias em linhas de 7.
5. Escala de cinza: cada estado de dia tem símbolo (■ 0 0* ◷ ∅ ⊘), não só cor.

## Decisões aplicadas
- Hero do S9 (Líder, lift, Tendência) fora, sem bloco no lugar. Sem gráfico de CTR diário, sem "vs A", sem régua de impressões, sem líder/intervalo.
- Linha da variante: Impressões e "Cliques ≈ N de M"; % só no expandido (chevron). Ordem fixa A..D, uma variante por linha (1440 e 390).
- Faixa de estado com 2 estados: dados do YouTube fora de hora (âmbar) | sem dia fechado (tracejado azul). "Aguardando" não tem faixa: aparece no ◷ da faixa de dias e na linha de apoio.
- Linha de apoio por variante: "N válidos · N aguardando ◷ · N não medido ∅"; por teste (só se > 0): dias de troca ou dia parcial fora do placar ⊘; dias com impressões e sem CTR.
- "Dados do YouTube" no lugar de "retrato" (◆ dono confirma). Cauda da frase fixa: "sem comparação entre variantes por enquanto".
- Faixa de dias = bloco separável (`.dias` dentro de `placar()`; remover não afeta o resto). Depende de `faixa_dias`/`dias[]` por dia (Yannis: função pura fora do `Placar`); se a paridade do Cowork quebrar, cai.
- Régua "Quanto falta": só dias do prazo (sem volume), sem promessa de líder. Linha do YouTube nativo: calma, como no S9.
- Erro: "Não consegui ler o placar. Nada foi perdido." + Tentar de novo + Voltar. Carregando: esqueleto na geometria final, shimmer desligado com `prefers-reduced-motion`.

## Onde diverge do S9
Sem hero, sem coluna CTR/"vs A", sem gráfico de CTR, sem selo de vencedor; cliques em contagem; novos: faixa de dias, linha de apoio, estados aguardando/não medido/descartados; âmbar com um só significado.

## O que não entra
Estatística de vencedor, lift, intervalo, ordenação por CTR (voltam na F4); piso de exibição de %; mudança de identidade visual.

## Não verificado
Contraste medido (Naksu), leitor de teclado/tela, Opera, dado real. Em 390 o ⓘ de 44 px fica grande ao lado de títulos curtos (a revisar). O ⓘ da faixa de dias e do placar contêm texto provisório.
