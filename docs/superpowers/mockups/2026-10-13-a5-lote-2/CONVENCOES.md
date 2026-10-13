# Convenções dos mockups da A5, lote 2 (levantadas em 13/10/2026 do lote 1 aprovado)

Quem desenha o lote 2 lê este arquivo antes de abrir qualquer outro. Ele diz **o que já está decidido** (cores, componentes, casca, método) para que nenhuma tela do lote 2 invente linguagem nova. O lote 1 (`../2026-10-13-a5-lote-1/`) está **aprovado pelo dono e congelado**: não se edita nada lá; copia-se.

Fonte de cada afirmação: `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` e `LEIAME.md` do lote 1; spec `docs/superpowers/specs/2026-10-12-observatorio-a5/04-medidas-telas-e-mockups.md` (seções 5, 6.1 a 6.5); decisões 32 a 35, 58 a 62 em `.superpowers/sdd/a5/decisoes-do-dono.md`.

## 1. As regras do dono (reprovação certa se faltar)

Valem para toda tela de dados. O revisor de UX trata cada uma como requisito.

1. **Frase-resumo no topo** de cada bloco, dizendo o que os números significam (uma frase só, número em destaque, símbolo). Num `<span>` único (no lote 1 uma frase quebrou em duas colunas a 390 px porque o negrito e o texto eram dois itens de um flex).
2. **Régua ou barra** para comparar de relance. Posição e proporção desenhadas, não escritas.
3. **Cor estável por significado**, a mesma em toda tela e nos dois temas (tabela da seção 3). **"Não medido" tem cor própria (rosa com hachura) e nunca a de zero.**
4. **Símbolo junto da cor**, sempre (▲ ▼ ＝, ícone, forma da casa). Tem de ler em escala de cinza.
5. **O método de cálculo vai num botão ⓘ** (`A.ibtn` + `A.oculto`), nunca em prosa na tela. Frase fixa do ⓘ de medida: "cálculo do Observatório sobre dados públicos do YouTube" (item de aceite 35); toda medida diz base, janela e conta.
6. **"Zero medido" e "não medido" visualmente distintos:** zero = caixa vazada com o 0 dentro (borda `--im-zero`, 2 px); não medido = hachura rosa; "ainda não existe" = contorno pontilhado. Nunca um zero onde o dado não veio (o sistema falha em verde: pergunte "o que acontece quando o dado não existe?" antes de "quando dá erro?").
7. **Nada de bloco monocromático** nem de **parágrafo de prosa**. Texto corrido de explicação é ⓘ ou `<details>`.
8. **Frases sem jargão interno.** Proibidos na tela: "lido", "gravou", "CTR", "diário", "cron vermelho" (esse só no ⓘ), "série", "snapshot", "payload", "pipeline". Nunca a palavra "retenção" numa tela de concorrente (item 56). Nome de tela de M10 fecha no mockup 14.
9. **Nenhum `color-mix()`** no CSS que carrega a interface (o navegador do dono renderiza transparente): hex ou `rgba()` literal. Verificação: `grep -rn "color-mix" <pasta>` só pode achar comentários "sem color-mix".
10. **Tema escuro a 1440 px e tema claro a 390 px são o par obrigatório;** o lote 1 gerou os quatro cruzamentos.
11. **Alvo de toque de 44 x 44 px** a 390 px (ponteiro grosso) e nos controles novos; **foco visível** (`:focus-visible`, já global em `a4.css`: 2 px `--accent`); **aria correto** (`role="img"` com `aria-label` por extenso nos desenhos, `aria-hidden` no que é só enfeite, `aria-current`, `aria-pressed`, `aria-live` onde o texto muda). Texto de 12 px ou mais. Sem rolagem horizontal da página. Contraste de texto 4,5:1 e de elemento gráfico 3:1, nos dois temas.
12. **Todo número de exemplo leva a marca "exemplo"** (`<span class="ex">exemplo</span>`), e a tela diz o que é dado real. Mockup de dado que ainda não existe (M10, ritmo por hora) diz isso no topo. Nada de afirmar causa: "depois da troca", nunca "por causa da troca"; M10 é "indício, não medição".
13. **Mínimo de estados por tela** (spec 6.5c, itens 98 e 99): com dado (cheio), **magro** (o caso real por meses), **zero medido**, **não medido com o motivo da lista fechada de 6.1.5**, **sem dado**, **erro** onde houver, **carregando** onde houver, **só leitura** (usuário sem o direito de editar ou de ver o dado privado: a tela diz o que ele não vê, não fica muda). Cada "não medido" traz o motivo e, quando existir, a data em que passa a existir.
14. **Cor de direção só para direção:** verde `--dir-up` (subindo, ▲), âmbar `--dir-dn` (ocre no claro; descendo, ▼) e nunca vermelho. O estado "parado" de M8 também é âmbar (spec 6.1.9). Atenção: no lote 1 o "＝" (entre −10% e +10%, ou "até 2 pontos") usa o neutro `--dir-eq`, não o âmbar; a NC do spec (se "parado" do dono é o "＝" ou o estado de M8) não foi respondida: **não decida sozinho**, mostre os dois como o lote 1 mostrou e anote na `REVISAO.md`.

## 2. A casca em volta de toda tela

Tudo vive dentro do Observatório real (aba **Competidores** do YouTube, `/cms/youtube/competitors`). O que já existe em produção aparece normal; **o que a proposta acrescenta leva contorno tracejado verde-água e a marca "+ novo"** (`L.novo(html, texto)` e `L.tag(texto)`, classes `.c2-novo` e `.c2-tag`).

Anatomia (função `A.moldura({ titulo, barra, corpo, fora })`, `a4-comum.js:83`):

- `#mock`: barra recolhida "Estados do mockup (não faz parte da tela)", um botão por estado (`L.barra(grupos)` monta as linhas; `A.opcoes(param, itens, padrao)` gera os links; o último grupo é sempre o tema, `A.tema()`).
- `#app`: grade com `aside.ch-side` (menu do CMS, `inert`, 208 px, some abaixo de 1100 px) e `.ch-main`: `.ch-shell` ("YouTube"), `.ch-tabs` (Painel, Vídeos, A/B Lab, Categorias, Comentários, Conteúdo, **Competidores** ativo, Desempenho) e `main.scr#screen` (padding 14/28/64 px, largura máxima 1240; abaixo de 900 px, 12/16/48).
- `aside.fora`: tabelas de referência do mockup, fora da tela ("Referência do mockup (não faz parte da tela)").
- Cabeçalho do Observatório de dentro da tela: `L.obs({ aba, fila, nCanais, fresh })` (`lote.js`): título em Fraunces, três botões, faixa de frescor, abas Canais/Mudanças/Outliers/Insights (+ "Saíram do YouTube" quando `fila` é passado), filtro de nicho.
- Tela do vídeo próprio: `L.videoCab({...})` (cabeçalho com seis células, aprovado em 12/10).
- Migalha: `A.migalha([[texto, href], ...])`.

## 3. Tokens de cor (valores exatos, copiados de `chrome.css` e `tokens-telas.css` da produção; vivem em `a4.css`)

Escuro em `:root`, claro em `:root[data-theme="light"]` (`?tema=claro` liga). Nenhum matiz novo no lote 1; **o lote 2 também não cria matiz livre** (forma e número dizem o resto).

| Token | Escuro | Claro | Significado (estável em toda tela) |
|---|---|---|---|
| `--bg` / `--surface` / `--surface-2` / `--sunk` | #1A1714 / #221E1A / #272219 / #16130F | #F7F2E9 / #FBF7F0 / #F2EBDF / #F2EBDF | fundo, cartão, cartão elevado, rebaixado |
| `--side` | #100E0B | #EFE8DA | menu lateral |
| `--border` / `--border-subtle` / `--border-strong` | #332D25 / #2A251F / #40382D | #DDD2BF / #E7DECF / #C9BBA3 | linhas. **`--border-strong` mede 1,44:1 (escuro) e 1,77:1 (claro): não use em controle sem texto; use `--dim`** |
| `--text` / `--muted` / `--dim` / `--faint` | #F5EFE6 / #A89D88 / #958A75 / #5C5345 | #231C14 / #5E5240 / #6E624E / #A69A84 | texto principal, secundário, terciário (4,86 e 5,59:1), só decorativo |
| `--accent` / `--accent-hover` / `--accent-subtle` / `--on-accent` | #FF8240 / #FF9A60 / rgba(255,130,64,.12) / #1A120A | #B8481A / #A23E14 / rgba(184,72,26,.10) / #FFF8F1 | ação primária, **"seu canal"** (chip `.chip.own`), foco |
| `--lado-o` / `--lado-b` / `--lado-n` / `--on-lado` | #FF8240 / #5AAEE6 / #EAD9B2 / #16130F | #B8481A / #1B78BA / #5C4710 / #FFFFFF | lados de uma comparação: o (laranja, o canal do dono, "com impressões"), b (azul, o outro), n (areia, neutro) |
| `--forja` / `--forja-soft-bg` / `--forja-soft-text` / `--forja-subtle` / `--forja-line` / `--on-forja` | #5CC3B2 / #2F5D56 / #DCF3EE / rgba(92,195,178,.12) / rgba(92,195,178,.35) / #0E2A25 | #17695C / #A9D2CA / #0E2A25 / rgba(23,105,92,.06) / rgba(23,105,92,.35) / #FFFFFF | **proposta ("+ novo")**, e a forja; seleção na barra de estados |
| `--success` | #22c55e | #11692F | tudo certo (em dia, sincronizado) |
| `--dir-up` | #22c55e | #11692F | **direção: subindo ▲** (só direção) |
| `--dir-dn` | #F59E0B | #8A5A00 | **direção: descendo ▼ e parado** (só direção) |
| `--dir-eq` | #A89D88 | #5E5240 | **"＝"**, sem mudança entre −10% e +10% (ou "até 2 pontos" no % assistido) |
| `--warning` / `--warning-text` / `--warn-subtle` | #f59e0b / #f59e0b / rgba(245,158,11,.12) | #B45309 / #92400E / rgba(180,83,9,.10) | atenção que não é direção (atraso leve) |
| `--danger` / `--danger-text` / `--danger-subtle` | #F26B6B / #F26B6B / rgba(239,68,68,.12) | #B42318 / #B42318 / rgba(180,35,24,.08) | **erro** (família do erro: borda e ícone; o texto da pastilha fica em `--text` por contraste). Nunca para direção |
| `--ok-subtle` | rgba(34,197,94,.12) | rgba(17,105,47,.10) | fundo suave de "ok" |
| `--nm` / `--nm-line` / `--nm-bg` / `--nm-fio` | #E59CC0 / #B0678F / #3A2232 / rgba(229,156,192,.14) | #8E2A62 / #A85585 / #F7E1EC / rgba(142,42,98,.10) | **NÃO MEDIDO**: rosa com hachura de 135 graus, uma forma só em toda tela (`.nm`, `.nm-h`, `.ac-c.nm`). Nunca para "poucas views" sem decisão (dívida B5 do lote 1: o dono definiu a hachura como "o dado não chegou") |
| `--im-zero` | #7A8FA6 | #5B6F86 | **zero medido** (borda da caixa vazada) |
| `--im-cl` | #F5EFE6 | #231C14 | cliques estimados (marca clara, não pode ser lida como escala) |
| `--terco-baixo` | #F2C14E | #8A5A00 | terço de baixo (réguas) |
| `--tier-mid` / `--tier-high` / `--tier-top` | #38BDF8 / #A78BFA / #E0735C | #0369A1 / #6D28D9 / #B4452F | faixas de desempenho (mediano, alto, topo) |
| `--tr` / `--on-tr` | #F5EFE6 / #1A1714 | #231C14 / #FBF7F0 | marcador de troca (sem matiz: a forma e o número dizem título, miniatura e a ordem) |
| `--shadow` / `--hit` | 0 12px 32px rgba(0,0,0,.45) / rgba(127,127,127,.16) | 0 12px 32px rgba(60,40,10,.14) / rgba(80,60,20,.12) | sombra de popover, área de toque |

Contraste do lote 1: menor razão de texto 4,64:1 (claro, "▼ −3", 12,5 px); o resto do conjunto 4,73 ou mais; menor do escuro 5,24.

**Tipografia** (`--sans`, `--mono`, `--serif`): **Inter** 400/500/600 (corpo 14 px/1,5; texto de apoio 12 a 13 px); **JetBrains Mono** para números e rótulos de casa (`font-variant-numeric: tabular-nums`; números de célula 500 15 px/22 px); **Fraunces** 400/600 no título do Observatório e na marca do menu. Carregadas do Google Fonts por `<link>`; sem rede caem nas do sistema (a captura bloqueia as fontes de propósito, para ser determinística).

**Espaçamentos e formas:** cartões com raio 5 a 6 px e borda `--border`; `.btn` 34 px (44 em ponteiro grosso ou abaixo de 640 px; `.btn.big` 44); `.ibtn` (ⓘ) 44 x 44 px no toque e 28 px compacto em ponteiro fino acima de 900 px; chips de 22 px; pastilhas de erro de 34 px; casas da faixa de 7 dias 58 px de altura; gaps de bloco 14 a 22 px; sem `z-index` numérico (camadas por Popover API); movimento reduzido respeitado (`prefers-reduced-motion`). Breakpoints: 1180 (grade de duas colunas vira uma), 1100 (menu some), 900 (padding menor), 640 e 600 (cartões e células em duas colunas).

## 4. Componentes reutilizáveis (de onde copiar)

Os dois arquivos-base estão em `../2026-10-13-a5-lote-1/` (cópia dos aprovados em 12/10, original em `../2026-10-12-a4-proprio-e-ajustes/`). **Copie para a pasta do lote 2:** `a4.css`, `a4-comum.js`, `lote.css`, `lote.js`; peças novas vão em `lote2.css` e `lote2.js` com **prefixo novo por tela** (lote 1: `ac-` A, `pe-` B, `er-` C, `at-` D, `sq-` E). Não edite os arquivos copiados; se for inevitável, só acrescente e liste a mudança no `LEIAME.md` (o lote 1 mudou uma coisa: `a4-comum.js` aceita `cfg.soZeros`).

| Peça | Arquivo e símbolo | Para quê |
|---|---|---|
| Formatadores pt-BR | `a4-comum.js`: `A.n`, `A.dec`, `A.pct`, `A.mil`, `A.dm`, `A.dmy`, `A.ds`, `A.addDias`, `A.dias`, `A.faixaDias`, `A.dur`, `A.plural`, `A.mediana`, `A.wilson`, `A.rnd(seed)` (aleatório com semente: o exemplo é sempre o mesmo) | números e datas |
| Não medido | `A.nm`, `A.nml(motivo)`, `A.nmSw` (+ `.nm`, `.nml`, `.nm-h` em `a4.css:102-106`) | pastilha, pastilha com motivo, amostra de hachura |
| Faixa de números | `A.faixa(cells, rotulo, quieto)` (`.nstrip`, `a4.css:118-124`) | linha de células rótulo + valor, com `nm`, `parado`, `fraco` |
| ⓘ do método | `A.ibtn(id)`, `A.oculto(id, titulo, html)`, `A.info`, `A.ligarInfos` | método e fonte em popover |
| Gráfico por dia | `A.serieDia(host, cfg)` (barras com zero medido, não medido, marcas de troca, "dia anterior / dia seguinte", `bordaFinal`) | impressões, views, curvas por dia |
| Taxa com intervalo | `A.faixaTaxa`, `A.antesDepois`, `A.veredito`, `A.topoTaxa` | taxa de clique com Wilson 95%, antes × depois |
| Régua | `A.regua(vals, mine, fmtV)` | posição entre valores |
| Curva | `A.curva(host, cfg)` | retenção (mockup 6 aprovado) |
| Barra e estados | `A.barra`, `A.opcoes`, `A.tema`, `A.href`, `L.barra(grupos)` | "Estados do mockup" |
| Casca | `A.moldura`, `A.migalha`, `L.obs`, `L.videoCab`, `L.pager`, `L.fora` | ver seção 2 |
| Proposta | `L.novo`, `L.tag` (+ `.c2-novo`, `.c2-tag`, `a4.css:645+`) | "+ novo" tracejado |
| Ícones de traço | `L.IC` (aviso, sino, semSino, relogio, envelope, ok, x, pausa, video, canal, comentario, sync, plus, dots, chev, pin) | sem emoji, `currentColor`, 15 px |
| Utilidades | `L.pl(n, um, varios)`, `L.hm`, `L.cor(titulo)` (capa de exemplo), `L.lembrar.ler/gravar` (localStorage com try/catch; padrão do lote: escolha lembrada no navegador, com "Voltar ao padrão") | |
| Botões e chips | `.btn`, `.btn.pri`, `.btn.perigo`, `.chip`, `.chip.own`, `.ex` ("exemplo") em `a4.css:91-98` e `lote.css` | |
| Faixa de 7 casas (zero medido / não medido / futuro) | `lote.css` `.ac-*` (`.ac-c.zero`, `.com`, `.nm`, `.fut`), `a.js` | modelo de "forma por estado" |
| Seletor de período com ▲ ▼ ＝ e frase | `lote.css` `.pe-*` (`.pe-fr.up/.dn`, `.pe-sim`), `b.js` | seletor de janela + régua de direção |
| Linha de canal em erro e escada | `lote.css` `.er-*`, `c.js` (linha de 141 px, pastilha, e-mail, "Sincronizar agora") | lista de Canais |
| Trilha de casas por hora, bloco do mês | `lote.css` `.at-*`, `d.js` | ritmo por hora, cobertura |
| Fila, cartão, painel "o que some / o que fica", confirmação APAGAR | `lote.css` `.sq-*`, `e.js` | qualquer confirmação destrutiva |

Cada tela tem **um** `.html` de 12 linhas, **um** `.js` com o desenho, e lê `?caso=` e `?tema=claro`.

## 5. Como estruturar a pasta de cada mockup (lote 2)

O lote 1 usou pasta plana, com peças compartilhadas na raiz (as telas dividem a casca). O lote 2 segue o mesmo, com o `index.html` que o spec (6.5a) pede:

```
docs/superpowers/mockups/2026-10-13-a5-lote-2/
  index.html                    lista de links de todo mockup e de cada ?caso= (a lista que o dono percorre)
  LEIAME.md                     ordem de abrir, o que olhar primeiro em cada tela, decisões do dono, tabelinhas que fecham, dívida declarada
  PLANO-UX.md                   feito ANTES do desenho: pergunta de 3 segundos por tela e a forma de relance
  REVISAO-UX.md  AJUSTES-UX-N.md  (do revisor e das rodadas de correção)
  a4.css  a4-comum.js  lote.css  lote.js        cópias do lote 1 (congeladas)
  lote2.css  lote2.js           peças novas do lote 2, prefixo por tela
  m<id>-<slug>.html             stub de 12 linhas: <link a4.css> <link lote.css> <link lote2.css> + scripts na ordem a4-comum, lote, lote2, m<id>
  m<id>.js                      o desenho da tela (cabeçalho do arquivo diz: parâmetros ?caso=, regras, o que é exemplo)
  m<id>-dados.js                (se precisar) dados de exemplo: canais fictícios, vídeos, séries com A.rnd(seed); marca "exemplo"
  medidas.json                  saída do capturar.mjs (rolagem, fontes menores que 12 px, alvos menores que 44 px)
  shots/                        m<id>-<caso>-<1440|390>-<escuro|claro>.png
  capturar.mjs                  o script de captura (seção 6)
```

Stub (copie do lote 1, `a-ainda-cedo.html`): `<!doctype html><html lang="pt-BR">`, `<meta charset>`, `<meta viewport>`, `<title>… (mockup)</title>`, o `<link>` do Google Fonts (Fraunces 9..144 400/600, Inter 400/500/600, JetBrains Mono 400/500/600), os CSS, e `<body>` só com os `<script>` (a casca é montada por `A.moldura`).

Convenção de dados: canal próprio **tnFigueiredo**; vídeo de exemplo "Quanto custa uma semana em Hanói?"; concorrentes fictícios do Observatório (Nômade Raiz, Lucas Bigodinho, Dale Philip, Paddy Doyle, Lodir, Aldinho, Leo; hoje `2026-10-13` em `L.HOJE`). Números reais dos canais do dono (spec 6.5c) vêm de `../2026-10-12-a4-proprio-e-ajustes/dados-real.js` e `a4-dados.js`; **na `REVISAO-UX.md`, uma tabela por tela diz o que é dado real e o que é exemplo**.

Ao terminar cada mockup: `LEIAME.md` com os parâmetros, `grep -rn "color-mix"` = 0, `medidas.json` limpo, capturas em `shots/`.

## 6. Como capturar e medir

O lote 1 usou **scripts ad hoc de Playwright, em Chromium headless, no scratchpad da sessão** (não ficaram no repositório; a `REVISAO-UX.md` diz "Capturas e scripts desta revisão ficam no scratchpad da sessão"): servidor estático numa porta local derrubado pelo PID, fontes e capas externas bloqueadas, 1440 e 390 px, claro e escuro, `medidas.json` com `rolagem`, `fontesMenores` e `alvosMenores`; 368 medidas na rodada 2 e 72 na 3. **Para o lote 2 o script ficou no repositório:**

```
node docs/superpowers/mockups/2026-10-13-a5-lote-2/capturar.mjs <pasta> <saida-dir> <porta 47710-47790> "m13-historico-video.html?caso=cheio" "m13-historico-video.html?caso=magro"
```

Rodar da raiz do repositório. Sobe um servidor estático em `127.0.0.1:<porta>`, abre cada URL nos quatro cruzamentos (1440 e 390 x escuro e claro; a 390 liga ponteiro grosso e toque), grava `<saida-dir>/<arquivo>-<caso>-<largura>-<tema>.png` de página inteira e o `medidas.json`, e derruba o servidor ao terminar. Testado em 13/10 sobre uma tela do lote 1 (quatro capturas, medidas zeradas). Não usa a porta 3099, o banco local nem os specs e2e do projeto. Se ficar preso, derrube pelo PID do servidor (`lsof -ti :<porta>`), nunca `pkill`/`killall`.

Mostrar ao dono (rito do lote 1): `cd <pasta> && python3 -m http.server <porta> --bind 127.0.0.1`, `open "http://127.0.0.1:<porta>/<arquivo>?caso=..."`, e um guia de 5 ou 6 passos por tela (onde clicar, o que verificar); **uma tela por vez**, ele responde "aprovado" ou o ajuste.

Contraste e foco o revisor mede no navegador (cor composta sobre o fundo composto, lida do estilo computado); o script mede só rolagem, fonte e alvo. Abra no contexto só as capturas que precisar julgar (a pasta de capturas do lote 1 pesou cerca de 56 MB: gere os quatro cruzamentos só dos casos que mudam).

## 7. O rito (spec 6.5d, regras do dono de 12/10)

1. `frontend-design` faz o `PLANO-UX.md` (para quem é, a pergunta de 3 segundos e a resposta de relance, uma forma memorável por tela, estados) **e** o desenho.
2. `revisor-ux-senior` (`~/.claude/agents/revisor-ux-senior.md`, Sonnet, único que abre navegador) avalia plano e desenho: veredito por tela (*pronto para o dono*, *volta para ajuste*, *reprovado*), achados com tela, estado, evidência, severidade (**bloqueia**, **corrige**, **sugestão**) e conserto em uma linha; tabela de medidas e **o que ele não conseguiu verificar**. Arquivo: `REVISAO-UX.md`.
3. Correção de todo "bloqueia" e "corrige"; reconferência; os dois têm de concordar. **Nenhum mockup vai ao dono com "bloqueia" ou "corrige" aberto.**
4. Dono aprova, pede ajuste ou reprova, **um por vez**; a resposta vira linha no ledger (`.superpowers/sdd/a5/decisoes-do-dono.md`).
5. Os dois especialistas de dados e de software não revisam mockup; revisam spec e implementação.

## 8. Armadilhas que o lote 1 já pagou (não repita)

- **Conta sobre o que aparece:** diferença em pontos feita sobre os números **arredondados exibidos** (51 contra 47 é +4); soma de partes tem de fechar com o total (horas do mês somaram 303; o gráfico de views por dia tinha de somar com o cabeçalho).
- **"Faltam N dias" tem de bater com a faixa** desenhada; a frase diz a data.
- **Texto de pastilha em `--text`**, a família do erro na borda e no ícone (o par que media 4,29:1 no escuro foi corrigido assim).
- **Frase de afirmação forte contradita por outro número** (zero medido com 640 views no cabeçalho) foi achado "bloqueia": reconcilie o texto com o cabeçalho.
- **Linha de tabela:** a meta aceita para um acréscimo é 132 a 155 px por linha (a produção tem 66 a 73); a linha de canal em erro do lote 1 mede 141 px a 1440. Não passe disso sem decisão.
- **Setas e legendas no corpo viram sopa:** a legenda de ▲ ▼ ＝ é uma linha curta e o resto vai no ⓘ.
- **A 390 px:** sem rolagem horizontal da página, tabela larga vira cartão; a última data do eixo não pode ser cortada (`bordaFinal`); sem mapa de 24 colunas (blocos de 2 ou 3 horas ou só o perfil de 24 horas).
- **Estado aprovado pelo dono não se redesenha** sem pedido: telas aprovadas em 12/10 (lote A4, mockups 1 a 9) e em 13/10 (lote 1, A a E) entram como vizinhas, no mesmo lugar e com a mesma forma.
- **Dívida declarada e aceita do lote 1** (não corrigir aqui, só não piorar): fila longa sem paginação (implementar 10 por vez com "Mostrar mais N"); rótulo "1 grupo de com…" cortado a 1440; casas da trilha de 11,5 px (não são alvo de toque); `--border-strong` fraco em controles; leitor de tela, Safari, Opera e ordem de teclado completa nunca foram verificados.
