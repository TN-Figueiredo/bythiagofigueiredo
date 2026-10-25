# Mockup M5 r2: tela v2 do teste A/B do YouTube (S8-F4, ex-T12), 25/10/2026

`index.html` (um arquivo, dados sintéticos). Seletor: `?estado=&tema=claro|escuro&largura=1440|390|ambas` (também botões no topo). Cresce sobre o M4 r3.1 (`../2026-10-24-m4-placar/`), cujo placar e faixa de dias entram intactos em todo estado.

## Estados (24)
- Início: `inicio-aviso`, `inicio-sem-alcance`.
- Ativo: `ativo-antes-pisos`, `ativo-sem-volume`, `ativo-sinal`, `ativo-encerrar` (confirmação aberta), `ativo-teto-sem-volume`, `v1-ativo`.
- Concluído: `concluido-vencedor-provisorio`, `-vencedor-final`, `-aplicado`, `-aplicado-mudou`, `-aplicado-outra`, `-original-vence`, `-sem-diferenca`, `-inconclusivo-volume`, `-inconclusivo-dado`, `-inconclusivo-falha`, `-aguardando`, `-pendente`, `-ilegivel`, `v1-concluido`.
- `carregando`, `erro`.
Capturas em `shots/<estado>-<tema>-<largura>.png` (Playwright headless): completas (1440 e 390, claro e escuro) para `ativo-sem-volume`, `ativo-sinal`, `concluido-vencedor-provisorio`, `concluido-original-vence`, `concluido-inconclusivo-volume`; os demais, 1 captura 390 claro. 390 sem rolagem horizontal (verificado por script nas 39).

## Como testar
1. Ativo: em 3 s, a frase diz "já decide?" e o que falta; sem lift, sem %, sem botão de aplicar.
2. `ativo-sem-volume`: barra por variante com "412 de 10.315", sem aviso de volume. `ativo-antes-pisos`: tudo "—" com "não medido", nunca 0.
3. `ativo-sinal`: linha tracejada "Sinal provisório, não decide". Abra "Encerrar": a confirmação avisa que encerrar à mão tira o teste da decisão.
4. Concluído: um selo (cor + símbolo; veja em escala de cinza) e uma frase. `concluido-vencedor-provisorio`: clique "Aplicar B ao vídeo" (1 confirmação; o sucesso do mockup é simulado). `original-vence`: sem verde, sem lift, sem botão.
5. `aplicado-mudou` e `aplicado-outra`: "No ar agora" vem do que foi aplicado, não do sinal atual.

## Decisões aplicadas
- Sem token global novo: `--ok` e `--err` reusam os valores de `sugestoes.css:10-23`. Contraste medido: texto ok 9,4:1 escuro e 5,8:1 claro; err 8,8 e 6,7; borda ok 4,5 e 3,5; borda err 3,9 e 4,1 (todos acima de 4,5 texto e 3 borda). Verde só no vencedor de variante (provisório tracejado sem preenchimento, final cheio).
- Famílias: vence (verde) | neutro (original ◆, sem diferença =, volume ◔, ilegível ⚠ em borda dupla) | rosa hachurado ∅ (dado) | azul tracejado (◷ aguardando, ◌ pendente) | err ✕ (só falha). Inconclusivo por volume é neutro cheio; tracejado só para "ainda pode mudar".
- Âmbar segue com um só significado (não aparece nesta tela). Lift e "vs A" só em vencedor de variante, no concluído.
- Ativo: pisos lidos de `pisos()`/`v2.n` (nada recalculado); relógio "dia X de T" com ticks; uma barra de impressões por variante, dias válidos como apoio; piso de relógio só no ⓘ.
- "Provisório até DD/MM" = encerramento + 11 dias (dado sintético); depois "Final". "No ar agora" lê `winner_variant_id`.
- v1: "Regra antiga: encerra por duração", sem estatística.

## Onde diverge do M4
Acrescenta, antes do placar: selo/frase de desfecho, relógio e bloco de pisos (ou "Quanto o teste alcançou" no concluído); depois dele: sinal provisório e ações. O M4 não muda. Ativo ganha "Pausar" e "Encerrar" no pé (já existem no produto).

## O que não entra
CTR diário, "descartados por motivo", lift no ativo, botão de aplicar no ativo (veto do Phil), "o sinal de B desapareceu" (sem `historico`), data de aplicação, 3ª variante dedicada, V=3 e dados atrasados (teste de componente).

## Não verificado
- Regra do aviso de volume no ativo: removida na r2 (decisão do controlador: só a barra "volume X de N"); o aviso fica só no início do teste.
- Texto do piso de relógio no ⓘ (sem números, de propósito).
- Nome do desfecho "aguardando alcance" e "pendente" no concluído: texto proposto, não validado com dado real.
- Ação "Voltar à original" (L9): não existe hoje nesta tela; é proposta, precisa de plano e de confirmação do dono.
- Leitor de tela, Opera, aparelho real, teclado fora de ⓘ/Encerrar.

## r2: o que mudou (consertos de Logan L1-L11 e Naksu N1-N5)
Verificação: `node verifica.mjs` (Playwright headless; refaz as 39 capturas e confere overflow a 390, alvos de 44 px, coerência de números, ausência de aviso de volume e de lift no ativo, cor do selo, color-mix). Resultado: 39 capturas, 0 falhas.
- L1: pisos são derivados do mesmo `v2.n` do placar (função `derivaPisos`); dias válidos e impressões batem entre bloco, placar e faixa em todos os estados (o script confere). Dados sintéticos ajustados (teto e volume: 7 dias válidos).
- L2: `inconclusivo-dado`: B com "—" e "não medido" no bloco e no placar, "2 válidos" nos dois, sem 10.200.
- L3 (= N2): aviso de volume removido de `ativo-sem-volume` e `ativo-teto-sem-volume` (código, CSS e README). Título do teto: "Faltam impressões; o teste encerra amanhã." (sem "provavelmente", sem "não vai chegar").
- L4: selo "B vence (provisório)" e depois "B vence"; título "B provavelmente vence" e depois "B vence".
- L5: "Sem diferença clara entre A e B." / "Agora não há diferença clara; ao encerrar, B parecia melhor." / "B está no ar." + "Voltar à original". O "20%" fica fora da tela.
- L6: "Dia X de 15" fora do título do ativo (fica selo do topo + Andamento); faixa "Sem dia fechado" e linha de teto removidas por repetirem título/subtítulo.
- L7 (= N4): sinal provisório neutro, borda 1 px tracejada `--border-strong`, ▲ em `--text`, texto "B está um pouco à frente"; verde só no concluído.
- L8: confirmação de Encerrar: aviso primeiro, depois as opções, depois "Cancelar" à esquerda de "Encerrar teste".
- L9: "Voltar à original" (com confirmação, mesmo padrão do Aplicar) em `aplicado` e `aplicado-mudou`.
- L10: `aplicado-outra` com as 3 versões acima de 10.315 (✓ no piso, coerente com o vencedor).
- L11: ⓘ com área de 44x44 a 390 (visual de 24 px, margem negativa); o script mede.
- N1: classe `.prov` da linha "Provisório até" virou `.provl`; selo "vence" mede ok-texto 14 px (script).
- N3: frase do ativo sem volume cita as duas: "Cada versão precisa de 10.315; A tem 412 e B tem 388." (texto do Logan sem o "Dia 8 de 15").
- N5: `.sel.neu` com borda `--dim`.
- Sugestões: S4 aplicada (barra cheia igual à parcial, com ✓ no texto). S1, S2, S3, N6 (número duplicado, custo declarado) e N7 não aplicadas: dependem de dado/produto que não existe ou são medições futuras.

## Colisões
- Nenhum ponto de Logan ou Naksu contradiz o brief m5-desenho-r1, a não ser L9: o brief limita "Aplicar" a vencedor de variante e não prevê reversão; "Voltar à original" é outra ação e foi incluída como proposta (ver Não verificado). Se o controlador não quiser, remover os dois botões e declarar que a reversão vive em outra tela.
