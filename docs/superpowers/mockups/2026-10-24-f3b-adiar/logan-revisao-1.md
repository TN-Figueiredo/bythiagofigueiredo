# F3b Adiar 7 dias: revisão de fluxo do mockup (Logan, rodada 1, 23/10/2026)

**Nota: 86/100. Aprova: NÃO** (3 achados "corrige"; nenhum "bloqueia"). Capturas em `ux-revisao-shots/` (12 estados x 1440/390, mais `corrida-reabre-*`). Verificado em Playwright (Chromium headless) nos dois tamanhos; sem overflow horizontal a 390 (scrollWidth 390).

## Resumo
Tela única (lista Sugestões) + bloco do A/B Lab. Pergunta: "isto agora não, mas quero ver de novo; volta quando?". Tarefa principal (adiar): **2 toques, 0 confirmação, 0 rolagem** a 1440 e a 390 (medido: gatilho, "Adiar 7 dias"); a faixa responde "volta em sex, 30/10". Veredito: **volta para ajuste**. Três fricções que mais custam: (1) o painel aceita Cancelar/motivo durante "Adiando…"; (2) depois do erro "expira antes", o painel volta a oferecer o botão que já falhou; (3) no bloco do A/B Lab a faixa nunca aparece e o foco cai no `body`.

## O que acerta (preservar)
Gatilho "Dispensar ou adiar" (e aria-label no ⋯ a 390); três grupos na ordem do plano com `‖` (1440) e fio horizontal (390); frase com ampulheta no lugar do botão, fora do Tab; datas com dia da semana corretas para 2026 (ter 27/10, qua 28/10, sex 30/10; conferido); texto único da contagem; relógio = volta, ampulheta = vence; "não medido" nunca vira 0; "Tentar de novo" com o nome da ação; ja_adiado vira sucesso com data.

## Achados

### A1. corrige. Painel: "Adiando…" Aberto por Cancelar e motivos
- **Tela/estado:** lista, painel em `adiar-salvando` (e no fluxo vivo, 700 ms de Adiando).
- **Defeito:** só o botão Adiar fica `aria-disabled`; "Cancelar" e os motivos seguem ativos. Medido: clicar Cancelar durante o Adiando fecha o painel, e 0,7 s depois aparece a faixa "Adiada" (a gravação não foi cancelada). Clicar um motivo no mesmo intervalo marca `done=disp` e depois a conclusão sobrescreve por `adiada`: dois estados para a mesma linha.
- **Por quê:** ação cancelada na metade; com rede lenta a janela é de segundos, não de 0,7 s. Custo: o dono acha que cancelou e a linha some por 7 dias; ou dispensa por 30 dias e o resultado final diz "Adiada".
- **Correção (HTML):**
  1. em `painel(it)`, quando `busy`, gerar motivos, "Já fiz" e Cancelar com `disabled aria-disabled="true"` (mesmo estilo `.sg-btn[disabled]`; para o link Cancelar, `class="sg-lnk" disabled`).
  2. no listener de clique, no topo (depois dos seletores de tema/largura): `if(S.busy&&ev.target.closest('[data-mot],[data-cancel],[data-dis]'))return;`
  3. acrescentar `[disabled]{...}` ao `.sg-lnk`: `.sg-lnk[disabled]{color:var(--muted);text-decoration:none;cursor:not-allowed}`.

### A2. corrige. Erro `expira_antes` e o painel volta a oferecer o botão que falhou
- **Tela/estado:** `adiar-corrida-vence`, depois do erro.
- **Defeito:** medido: após "Não adiou: ela vence em 28/10…", reabrir "Dispensar ou adiar" mostra de novo o botão "Adiar 7 dias" (`[data-adiar="s3"]` = 1) com o erro ainda na linha; um segundo toque repete o erro. O cliente já sabe que vence antes.
- **Por quê:** erro sem saída e passo repetido; contraria D4 (aviso antes do toque). Custo: toques inúteis e dúvida de se o app travou.
- **Correção:** em `tentar()`, no ramo `corrida`, trocar a linha para "ciente": `S.itens=S.itens.map(x=>x.id===id?Object.assign({},x,{stale:false}):x);` antes do `render`. Como `BASE[2]` já tem `vence:'qua, 28/10'` e `venDias:5`, o painel passa a mostrar a frase com ampulheta. Em produção: o cliente guarda `expira_em` devolvido pelo servidor e recalcula `venceAntes`.

### A3. corrige. Bloco do A/B Lab: a faixa some e o foco se perde
- **Tela/estado:** `ctx-ablab-adiadas` (e `ctx-ablab-vazio` depois de 5 s).
- **Defeito:** em `bloco()`, `vazio=live.length===0` ignora as faixas em andamento. Medido: ao adiar/dispensar a última linha aberta, a faixa "Adiada/Dispensada" nunca é vista, o vazio aparece de imediato e `document.activeElement` = `BODY`. Além disso `focoProx` aponta para `#sum`, que não existe no bloco.
- **Por quê:** teclado e continuidade (foco volta onde estava); o dono não vê a confirmação de que a ação gravou. Custo: dúvida se adiou; leitor de tela perde a posição.
- **Correção:**
  1. `const vazio=live.length===0&&!its.some(x=>S.done[x.id]);` em `bloco()` (igual a `pagina()`);
  2. no `<h2>` do bloco: `<h2 id="sum" tabindex="-1">Sugestões …`;
  3. CSS: `.sg-phd h2:focus{outline:none}` `.sg-phd h2:focus-visible{outline:2px solid var(--accent)}`.
  4. no ramo não-vazio do bloco, quando `live.length===0` mostrar `<p class="sg-meta sg-blkmeta">Nenhuma sugestão aberta.</p>` em vez de `resumo(live)` (que hoje daria "0 sugestão: ." ).

### A4. corrige. Vazio "contagem não medida" afirma "Você adiou sugestões"
- **Tela/estado:** `vazio-adiado-nm`, página e bloco.
- **Defeito:** o título afirma o fato que a tela diz não saber. Nenhuma frase pode afirmar mais que o dado sustenta.
- **Custo:** o dono lê que adiou algo, procura e não acha (não há lista de adiadas).
- **Correção:** página: `<h3>Adiadas por você: <span class="sg-nm">não medido</span></h3><p>Não deu para contar quantas voltam nem quando.</p><p>Os vídeos acima do normal ainda não bastam para virar sugestão.</p>`. Bloco: `Adiadas por você: <não medido>. Não deu para contar quantas voltam nem quando.` Se Phil confirmar que o vazio `adiado` só dispara com `contagens.adiados>0` medido, este estado é o vazio genérico "não medido" e o texto acima se mantém.

### S1. sugestão. Selo "⏱ N adiadas" repete a linha de contagem
Na captura `lista-com-adiadas-1440` o selo (canto direito) e a linha logo sob o resumo dizem a mesma coisa a 25 px de distância; a 390 o selo ainda consome a fileira do cabeçalho. O plano tinha só a linha, que traz a data. Recomendo remover `seloAdi()` da página e do bloco (um elemento a menos para ler). Se o dono quiser o selo, tudo bem: a decisão é dele (custo: 1 elemento duplicado).

### S2. sugestão. Erro de corrida sem próximo passo
Depois de A2 o painel já explica. Opcional: terminar o erro com "Veja as opções em Dispensar ou adiar." só se Naksu medir espaço; não bloqueia.

## Verificado e sem defeito
Esc fecha e devolve foco ao gatilho (código + fluxo); Tab do painel (motivos, Já fiz, Adiar, Cancelar; a frase não recebe foco); faixa `role="status"`; erro `role="alert"` com foco no retry; N, resumo e selo já descontam a linha adiada; "Adiar" da última linha da página cai em vazio com data; "não medido" não vira zero; 390 sem corte no painel nem nos selos.

## Para a Naksu (sem medir)
Largura de "Dispensar ou adiar" a 1440 com o primário mais longo (ok no 1440 da captura); contraste da frase em `--muted` no tema claro; distinção `‖` x `|` a 390 (virou fio; ok); borda da faixa Adiada vs Dispensada.

## Não verificado
Leitor de tela real, fuso de outro país, rede lenta real, Opera real, tema claro com contraste medido (é da Naksu). O fluxo `ja_adiado` foi lido no código, não clicado de ponta a ponta.
