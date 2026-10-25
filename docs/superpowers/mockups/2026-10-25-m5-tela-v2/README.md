# Mockup M5 r1: tela v2 do teste A/B do YouTube (S8-F4, ex-T12), 25/10/2026

`index.html` (um arquivo, dados sintéticos). Seletor: `?estado=&tema=claro|escuro&largura=1440|390|ambas` (também botões no topo). Cresce sobre o M4 r3.1 (`../2026-10-24-m4-placar/`), cujo placar e faixa de dias entram intactos em todo estado.

## Estados (24)
- Início: `inicio-aviso`, `inicio-sem-alcance`.
- Ativo: `ativo-antes-pisos`, `ativo-sem-volume`, `ativo-sinal`, `ativo-encerrar` (confirmação aberta), `ativo-teto-sem-volume`, `v1-ativo`.
- Concluído: `concluido-vencedor-provisorio`, `-vencedor-final`, `-aplicado`, `-aplicado-mudou`, `-aplicado-outra`, `-original-vence`, `-sem-diferenca`, `-inconclusivo-volume`, `-inconclusivo-dado`, `-inconclusivo-falha`, `-aguardando`, `-pendente`, `-ilegivel`, `v1-concluido`.
- `carregando`, `erro`.
Capturas em `shots/<estado>-<tema>-<largura>.png` (Playwright headless): completas (1440 e 390, claro e escuro) para `ativo-sem-volume`, `ativo-sinal`, `concluido-vencedor-provisorio`, `concluido-original-vence`, `concluido-inconclusivo-volume`; os demais, 1 captura 390 claro. 390 sem rolagem horizontal (verificado por script nas 39).

## Como testar
1. Ativo: em 3 s, a frase diz "já decide?" e o que falta; sem lift, sem %, sem botão de aplicar.
2. `ativo-sem-volume`: barra por variante com "412 de 10.315" e aviso dentro do bloco. `ativo-antes-pisos`: tudo "—" com "não medido", nunca 0.
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
- Aviso de volume no ativo (`avisoVol`): a regra que o dispara não está definida sem recalcular; Yannis/Phil só garantem pisos e `v2.n`. Precisa de decisão: derivar de `volume/dia` já gravado ou cortar (Logan e Naksu cortaram; o brief do controlador manda ter).
- Texto do piso de relógio no ⓘ (sem números, de propósito).
- Nome do desfecho "aguardando alcance" e "pendente" no concluído: texto proposto, não validado com dado real.
- Leitor de tela, Opera, aparelho real, teclado fora de ⓘ/Encerrar. Revisão de Logan e Naksu ainda não feita.
