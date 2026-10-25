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

## r3: o que mudou (consertos finais de Logan e Naksu)
1. Esc fecha qualquer confirmação aberta (Aplicar, Encerrar, Voltar à original) e devolve o foco ao botão que a abriu, com `aria-expanded="false"`.
2. Depois de Aplicar e de Voltar à original, o foco vai à linha "No ar agora" (`tabindex="-1"`), alvo visível, não ao body.
3. Texto do Voltar: "A miniatura volta a ser a de A agora no YouTube. O resultado do teste não muda e continua visível aqui."
4. Depois do Voltar: linha "No ar agora: A (original). B deixou de ser aplicada." e selo neutro "Aplicação de B desfeita"; o selo do resultado fica como estava.
5. Confirmar do Voltar ganhou o rótulo "Sim, voltar à original" (o gatilho segue "Voltar à original"): sem dois botões idênticos.
6. `verifica.mjs` confere: Esc fecha cada confirmação e o foco volta ao gatilho; nenhum rótulo de botão duplicado com a confirmação aberta; foco após Aplicar/Voltar em `.noar`. Resultado: 39 capturas, 0 falhas.
7. Capturas novas: `*-claro-390-confirma.png` e `*-claro-390-depois.png` (estados tocados).

## r4: o que mudou (pedido do dono, 25/10: ⓘ não muda o layout; confirmações em diálogo)
1. ⓘ é popover `position:absolute` ancorado ao cabeçalho da seção: a altura do documento e das seções é igual com ⓘ aberto e fechado (o script mede em todos os ⓘ, 1440 e 390, claro e escuro). 1440: à direita do ⓘ, 360 px; 390: acima, vira para baixo só sem espaço no topo; sempre dentro da moldura. Borda `--dim`, sombra rgba literal, um só `aria-expanded`/`aria-controls` (sem `aria-describedby`), toque de 44 px a 390. Fecha com Esc (foco volta ao ⓘ), toque fora, outro ⓘ, Tab para fora e resize.
2. Encerrar, Aplicar e Voltar à original são `<dialog>.showModal()`: centrado a 1440, colado ao rodapé a 390; foco inicial em Cancelar; Esc e Cancelar fecham e devolvem o foco ao gatilho; clique no fundo fecha. `::backdrop` rgba literal, sem color-mix. Os tokens chegam ao dialog por herança do DOM (ele continua dentro de `.frame`); o script confere que o fundo não é transparente nos dois temas. Encerrar sem seta, com `aria-haspopup="dialog"`, e "No ar hoje: A (original)." na primeira linha. Textos das confirmações r3 mantidos.
3. `verifica.mjs`: altura igual com ⓘ aberto/fechado, popover dentro do viewport a 390, dialog modal com foco em Cancelar e Esc devolvendo o foco, mais os checks antigos. 39 capturas, 0 falhas. Capturas novas: `info-aberto-escuro-{1440,390}.png`, `encerrar-aberto-escuro-{1440,390}.png`.
- Vale também para o placar em produção (tarefa da T12): trocar o balão em fluxo pelo popover e usar o mesmo componente de diálogo.

## r5: padrões existentes (dono, 25/10: "por que não manter o padrão?")
Nada inventado: o ⓘ e as confirmações agora são cópia fiel dos componentes do produto (worktree `/Users/figueiredo/Workspace/bt-s8-f2/apps/web/src/app/cms/(authed)/youtube/`). O popover e o balão da r4 saíram.
- ⓘ = `InfoDica` (`competitors/_proprio/info-dica.tsx:12-27`): botão `ibtn vb-info`, ícone `Icon.info()` (`competitors/_chrome/icons.tsx:22`, círculo r9 + traço), `aria-expanded`/`aria-controls`/`aria-label`, abre no clique, fecha no 2º clique.
- Popover = `Popover` de `competitors/_chrome/flut/flut.tsx:106-155` + `place.ts:33-64`: caixa `position:fixed` no `#flut` (fim do body), pref "baixo", align "inicio", maxW 380, gap 6, borda de 8 px da janela, vira para cima se não couber, reposiciona em scroll/resize (não fecha). Fecha como `store.ts:76-79`: Esc (devolve o foco ao ⓘ), mousedown fora, foco fora (inclui Tab); abrir outro ⓘ fecha o anterior.
- CSS copiado: `.ibtn` `_proprio/video.css:24-27,48`; `.vb-info` e `.vb-info-p` `_proprio/video-blocos.css:20-22`; `#flut .obs-fl-pop` `_chrome/flut/flut.css:3-6`; `.canal-tip` `_canal/canal.css:130-131`; `#flut` `_chrome/camadas.css:12-18` (z 1000). Sombra `--shadow` = `_chrome/chrome.css:17,32`. Conteúdo: h3 + parágrafo (título do `<b>` antigo).
- Encerrar = `AbEndTestDialog` (`ab-lab/_components/ab-end-test-dialog.tsx`, componente `Escolha`): `.etd-scrim > .etd` (role dialog), cabeçalho com `.etd-ico`, h2 "Encerrar teste" e `.etd-x`; `.etd-state`, `fieldset` com `.etd-opt` (rádio, miniatura, `.etd-who`, badge "no ar agora"), `.etd-msg.warn` (aqui entra o aviso r3 "encerrar à mão tira o teste da decisão"), rodapé `.etd-f` com `.etd-btn.pri` "Encerrar e ficar com X" e "Cancelar". Foco inicial = 1º focável (Fechar), como `use-modal-focus-trap.ts:44`.
- Aplicar e Voltar à original = `AbConfirmarTrocaDialog` (`ab-confirmar-troca-dialog.tsx:58-118`): role `alertdialog`, `.etd-ico.w` (triângulo), `.etd-lead` + `.etd-tiny`, botão `.etd-btn.over` (âmbar) primeiro e "Voltar" depois, foco inicial em "Voltar" (`voltarRef`). Textos r3 no corpo ("O resultado do teste não muda...", rótulo "Sim, voltar à original").
- CSS do diálogo = `ab-lab/_components/ab-end-test-dialog.css:2-97` inteiro (mudam só os tokens: `--theme-cms-*`/`--pb-accent` viram `--surface/--border/--text/--muted/--surface-2/--accent`). Esc, Tab preso, clique no fundo e retorno do foco ao gatilho como o hook.
- `verifica.mjs` acrescenta: ⓘ 24x24, raio 50%, margem -6 e svg 16 a 1440; popover no `#flut`, `obs-fl-pop canal-tip`, fixed, 380 px, padding 12x14, h3 13,5/600, p 13/19, sombra, distância 6 px do ⓘ, borda de 8 px; `.etd` raio 14, max-width 440, scrim fixed z 60, role dialog/alertdialog, foco inicial, rodapé row-reverse (1440) e column-reverse (390), alvos de 44 px. Resultado: 39 capturas, 0 falhas. Capturas refeitas: `info-aberto-escuro-{1440,390}`, `encerrar-aberto-escuro-{1440,390}`, `*-claro-390-confirma`, `*-claro-390-depois`.

### Colisões (padrão real venceu o brief anterior)
- 390: a confirmação não cola mais ao rodapé; fica centrada com 12 px de margem (`.etd-scrim`), rodapé em coluna. O "colado ao rodapé" da r4 era invenção.
- Cancelar/Voltar: nas confirmações de troca o botão seguro se chama "Voltar" (não "Cancelar") e é o foco inicial; no Encerrar, o foco inicial é o Fechar (1º focável) e não "Cancelar".
- Título do Encerrar: "Encerrar teste" (real), não "Encerrar o teste agora?".
- ⓘ a 390: o produto usa `pointer:coarse` (`video-blocos.css:21`) e `(pointer:coarse),(max-width:900px)` em `comentarios.css:49`; o mockup usa `pointer:coarse` mais container de 640 px para o quadro de 390 aparecer com 44 px também no desktop headless.
- ⓘ não é mais "dentro da moldura": no produto o popover é fixo na janela e cobre o conteúdo abaixo; o que se mantém é "a altura da página não muda".
- Miniaturas do Encerrar são letras sintéticas (no produto, imagem).
