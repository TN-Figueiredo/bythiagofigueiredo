# Mockup M4 r2 — placar do teste A/B do YouTube (S8-F3 T5), 24/10/2026

`index.html` (autocontido, dados sintéticos). Seletor por URL: `?estado=&tema=claro|escuro&largura=1440|390|ambas` (também há botões no topo).
Estados: `hoje` (sem dia fechado), `atrasado`, `aguardando`, `descartados`, `naomedido`, `poucas` (1–3 impressões), `cheio` (4 variantes, 14 dias, título de 100 caracteres, 7 dígitos), `naoiniciado`, `v1`, `carregando`, `erro`. Cada um (menos carregando/erro) tem frase-resumo sem %. A cauda fixa saiu da frase (r2) e vive no ⓘ do placar.
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
- "Dados do YouTube" no lugar de "retrato" (◆ dono confirma). (r2: sem cauda fixa na frase.)
- Faixa de dias = bloco separável (`.dias` dentro de `placar()`; remover não afeta o resto). Depende de `faixa_dias`/`dias[]` por dia (Yannis: função pura fora do `Placar`); se a paridade do Cowork quebrar, cai.
- Régua "Quanto falta": só dias do prazo (sem volume), sem promessa de líder. Linha do YouTube nativo: calma, como no S9.
- Erro (r2): "Não consegui ler o placar agora. A tela só lê; o teste não foi alterado." + Tentar de novo + Voltar. Carregando: esqueleto na geometria final, shimmer desligado com `prefers-reduced-motion`.

## Onde diverge do S9
Sem hero, sem coluna CTR/"vs A", sem gráfico de CTR, sem selo de vencedor; cliques em contagem; novos: faixa de dias, linha de apoio, estados aguardando/não medido/descartados; âmbar com um só significado.

## O que não entra
Estatística de vencedor, lift, intervalo, ordenação por CTR (voltam na F4); piso de exibição de %; mudança de identidade visual.

## Não verificado
Contraste medido (Naksu), leitor de teclado/tela, Opera, dado real. Opera, leitor de tela real, aparelho, dado real. O texto dos ⓘ é provisório.

## r2: o que mudou (consertos de Logan e Naksu; capturas refeitas em shots/)
- N1 balão do ⓘ agora em fluxo (linha inteira do contêiner, empurra o conteúdo): medido nos 49 ⓘ x 4 combinações, borda a >= 12 px da moldura a 390, 0 overflow.
- N2 aria-label próprio por ⓘ (placar, dias, dia fora, sem CTR, andamento), balão irmão com id + aria-describedby/aria-controls, Esc fecha e devolve o foco (testado em todos).
- N3 "Tentar de novo" com --on-accent: 5,01 claro / 7,51 escuro.
- N4 erro neutro (borda forte, fundo surface, texto pleno); âmbar só em "dados fora de hora".
- N5 skeleton nas alturas finais (hd 75/125, sum 80/120, banda 41/59, linhas 63/150, faixa de dias, andamento): 678/995 px contra 679/996 do estado de 2 variantes.
- N6 letra A no claro #AB4216 (5,03 em surface-2); tokens --va..--vd e --la..--ld no lugar dos hex soltos; chip 24 px.
- N7 "de N" sempre em linha própria a 390, números nowrap.
- N8 / L3 selo âmbar do cabeçalho removido (frase + faixa + rótulo do placar).
- N9 selo do Lab quebra linha e fica dentro da moldura.
- N10 ⓘ desenhado a 24 px, toque de 44 por ::before.
- N11 cartão do placar com max-width 1040 em 1440. N12 bordas das células e do ⓘ em --dim. N13 "0*" em peso 400 e "0" em 600. N14 ⓘ dos dias só com 0* e o que não é falha (legenda visível fica). N15 letra "–" muted; faixa vira role=list com resumo. N16 escala 12/13/14/16 + títulos.
- L1 régua: título "Andamento do teste", barra = dias passados, rótulo "faltam N dias" / "último dia"; sem "% do prazo restante".
- L2 hoje: faixa "O primeiro dia fecha até 03/11", subfrase e chips "aguardando" repetidos saem (traço por célula), sem chevron sem dado.
- L3 atrasado: sem data conflitante (21/10 só), subfrase "a próxima leitura é 25/10 às 06:10", faixa "Não há nada a fazer agora". L3b cauda fixa fora da frase.
- L4 descartados: subfrase passa a "Faltam 5 dias..."; a menção ao dia fora do placar fica só na linha de apoio.
- L5 naomedido: cliques "—" quando há 0 impressões; subfrase "A teve 0 impressões nos dias medidos; o CTR de B não veio."
- L6 legenda "0* o YouTube não listou o dia" (visível e no ⓘ). L7 naoiniciado: selo "Teste do Lab agendado para 25/10 08:00", chevron some; L7b texto do erro. Carregando: role=status "Carregando o placar" e, após 8 s, "Está demorando..." com Tentar de novo.
- Hanna: o ⓘ "ganho é limite inferior" não existia neste mockup (nem Logan nem Naksu pediram para mantê-lo); nada a remover, só não entra no plano.

### Colisões registradas
- N17a (Naksu: frase sem variante) x L5 (Logan: citar o 0 de A e o CTR de B): segui Logan (texto); a Naksu marcou como sugestão.
- N14 (Naksu: tirar a legenda repetida do ⓘ) x L6 (Logan: mesmo texto no ⓘ): ⓘ ficou só com o 0* e o que ele não é; a legenda visível completa fica.
- N17b (duas "idades": "Verificado há 3 h" e "Atualizado em") não alterada (sugestão, sem dono de texto): decidir na F3.
