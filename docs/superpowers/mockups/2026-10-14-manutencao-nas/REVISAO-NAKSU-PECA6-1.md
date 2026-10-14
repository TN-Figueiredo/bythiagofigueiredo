# Revisão Naksu, peça 6 ("Ver antigo"), rodada 1

Arquivos: `19-mes-fora-do-banco/peca6-ver-antigo.html`, `peca6.js`, bloco peça 6 de `m19.css` (L330-366). Capturas e `medidas.json` em `revisao-naksu-shots/peca6-1/`. Servidor 47702 derrubado (confirmado); 47701 não tocada. Não editei nada.

## Veredito: VOLTA PARA AJUSTE. 1 bloqueante, 3 "corrige", 4 sugestões.

Os 3 defeitos que mais pesam: (1) o painel é reescrito por `innerHTML` a cada 700 ms e o foco do teclado cai no `body` (inclusive em "Cancelar pedido"); (2) o status é anunciado como o painel inteiro, sem `role="status"` próprio; (3) a coluna de números do resultado não diz o que é (sem rótulo nem unidade).

## 1. O que a peça acerta (preservar)
- Mesma família das peças 1 a 4: `.m-bar`, ⓘ, `.btn`, `.m-segs`, ícones `ok`, `pont`, `tri`, `oct`, `nm`, `zero`, `arq` existentes; nenhum `color-mix`, só hex/rgba literais; nenhuma cor nova.
- Forma carrega o estado: visto (veio), triângulo âmbar (NAS parou), octógono vermelho (arquivo não bate), caixa com 0 (julho sem registro), pontilhado + marca "parcial" (abril). Mês faltante nunca vira zero. Em escala de cinza a linha de problema continua distinta (forma + frase).
- Medido: zero rolagem horizontal em 6 grupos x 2 temas x 1440/390 (`hs = 0` nos 24 casos); nenhum texto abaixo de 4,5:1 (script sobre todo texto do `#m-main`, fundo composto); menor fonte 12 px; a 390 todos os botões e ⓘ têm 44 px (0 alvos pequenos); foco `--accent` 2 px visível em todo controle por Tab (escuro rgb 255,130,64; claro rgb 184,72,26).
- Nome de canal de 100 caracteres quebra (título e frase), sem estourar a 390. Número de 15 caracteres na coluna de views quebra em duas linhas sem vazar.
- Frase do painel pronto à frente, lista abaixo, "Pedir outro período" como único botão: hierarquia clara (um destaque).

## 2. Achados

### B1. BLOQUEIA. O foco morre a cada tick e o "Cancelar pedido" fica inalcançável por teclado
Painel "Esperando" na página viva, 390 e 1440, ambos os temas. Evidência (Playwright): após "Pedir", foco em `SECTION#va-painel` (certo); Tab leva a "Cancelar pedido"; 700 ms depois `document.activeElement` é `BODY`. Repetido na leitura (Tab, 0,8 s, `BODY`). Causa: `pinta()` faz `el.innerHTML = corpoVivo()` a cada passo (`peca6.js`, setInterval). No fim ("Veio tudo") o foco também fica no `body`. Por que importa: quem usa teclado ou leitor de tela não consegue cancelar um pedido que dura minutos; é o controle de saída que o brief manda proteger.
Correção: não recriar o painel. Montar o estado "Esperando" uma vez; a cada passo atualizar só `textContent` de `.t span`, `style.width` de `.m-bar i` e `aria-valuenow`. Só trocar o painel nas transições de estado (enviado, andamento, pronto, cancelado) e, nelas, se o foco estava dentro do painel, `painel.focus()` (já há `tabindex="-1"` e `.m-va:focus-visible`). Fim da leitura: foco no `#va-painel` para a frase "Veio tudo...".

### C1. CORRIGE. Status anunciado como painel inteiro; nenhum `role="status"`
`#va-vivo` tem `aria-live="polite"` e contém o painel (cabeçalho, ⓘ, barra, botão, e na chegada 12 linhas de mês). Medido: 0 elementos `role="status"`/`alert` na peça. Cada tick reanunciaria tudo (12 vezes) e a chegada leria a lista inteira. A peça 4 já usa `role="status"` pontual.
Correção: tirar `aria-live` de `#va-vivo`; criar `<p class="m-sr" role="status" id="vaSt">` fora do que é recriado, e escrever nele só marcos: "Pedido feito às 14:32. Aguardando a casa.", "Lendo: 3 de 12 meses." (a cada 25%, não a cada mês), "Veio tudo: 12 meses.", "Faltam 2 de 12 meses.", "Pedido cancelado.". Erros (casa não respondeu, arquivo não bate) em `role="alert"`. A barra determinada já tem `aria-valuenow`; manter `aria-label="Meses lidos"` e acrescentar `aria-valuetext="9 de 12 meses"`.

### C2. CORRIGE. Coluna de números sem rótulo nem unidade
Resultado "pronto", 1440 e 390. `118 mil` na última coluna de cada mês (`.m-vam .v`), sem cabeçalho; a 390 cai sozinho numa linha abaixo da barra. Não diz que são views, nem que são do mês (a ficha do vídeo diz "views"). No 1440 a lista não tem linha de cabeçalho para alinhar.
Correção: texto "118 mil views" (`.v` com `<span class="m-num">118 mil</span> views`, `views` 12,5 px `--muted`), e a 390 pôr o número na linha do nome (grade `24px 1fr auto`, `.v` na linha 1, direita) para cada mês gastar 3 linhas em vez de 4 e a lista de 12 meses cair de ~1.900 px para ~1.400 px.

### C3. CORRIGE. Barra indeterminada vira "35%" parado com movimento reduzido
`m19.css` L131-132 (`m-ind`) + L35 (`prefers-reduced-motion` zera a animação): "Aguardando a casa" fica uma barra preenchida em 35% à esquerda, que lê como progresso. Estado "enviado", todos os temas.
Correção: no `@media (prefers-reduced-motion:reduce)` do `.m-bar.ind i`: `width:100%;background:repeating-linear-gradient(135deg,var(--dim) 0 6px,transparent 6px 12px)` (listrado = sem medida, sem movimento), literais, sem `color-mix`.

### S1. SUGESTÃO. Visto igual para 31 de 31 e 27 de 31 dias
Dezembro (27/31, 87%) e agosto (29/31) levam o mesmo visto verde de maio (31/31); só a barra de 80 px, quase cheia, e o texto "27 de 31" diferenciam. Pela regra da tabela 1.2 (visto = feita e válida) está certo, mas pede olho no número. Opção: mês com menos dias que o total ganha a barra com a ponta vazia à vista (já tem) mais `--warning-text` no "27 de 31"? Não: âmbar contra verde só pela forma. Alternativa mais barata: deixar como está e anotar que o teste no Opera confira se o dono lê a diferença.

### S2. SUGESTÃO. Dois motivos idênticos repetidos
Incompleto: agosto e setembro levam a mesma frase de 2 linhas ("Não veio: o NAS deixou de responder durante a leitura."), e a faixa de cima já a diz. Com 8 meses faltando seriam 8 repetições. Encurtar a linha para "Não veio: NAS parou." ou agrupar meses contíguos.

### S3. SUGESTÃO. Valor solto
Estilos inline em `tela()` (`font-size:12.5px`, `margin:0 0 10px`, `margin-top:14px`) e `.m-va-tira` com botão falso inline (`pointer-events:none`). Passar para `.m-va-sub`, `.m-va-nota`; usar `.m-q-nota` onde cabe. Também: o "Tudo" do seletor existe só para dar erro ao pedir; ver se não deveria vir desabilitado com a frase "passa do tamanho" (fluxo é do Logan).

### S4. SUGESTÃO. Frase com nome interno e rótulo redundante
"deixe para o Claude Code conferir esse mês" (octógono) cita ferramenta que não está no vocabulário do §1.7; e "Ver o que está no arquivo" ao lado do botão "Ver antigo" repete o título do painel logo abaixo. Para o Logan. Do meu lado: cortar o rótulo libera uma linha a 390.

## 3. Tabela de medidas

| Item | Claro | Escuro | Exigência |
|---|---|---|---|
| `--text` sobre `--surface` | 15,76 | 14,48 | 4,5 |
| `--muted` sobre `--surface` (.k, .o) | 7,13 | 6,18 | 4,5 |
| `--muted` sobre `--bg` (lista de meses) | 6,83 | 6,67 | 4,5 |
| `--muted` sobre painel âmbar / vermelho | 6,25 / 6,27 | 4,96 / 5,45 | 4,5 |
| Borda âmbar sobre painel âmbar | 4,12 | 6,18 | 3 |
| Borda/ícone vermelho sobre painel vermelho | 5,41 | 4,93 | 3 |
| Caixa do 0 (`--im-zero`) sobre `--bg` | 4,64 | 5,36 | 3 |
| Círculo pontilhado `--dim` sobre `--bg` | 5,35 | 5,24 | 3 |
| Visto `--success` sobre `--bg` | 6,10 | 7,83 | 3 |
| Preenchimento da barra `--muted` sobre `--sunk` | 6,43 | 6,92 | 3 |
| Texto do botão primário sobre `--accent` | 5,01 | 7,51 | 4,5 |
| Foco `--accent` sobre `--surface` | 4,94 | 6,72 | 3 |
| Texto de todo o `#m-main` (script, 24 casos) | 0 abaixo de 4,5 | 0 abaixo de 4,5 | 4,5 |
| Menor fonte | 12 px | 12 px | 12 |
| Alvos a 390 | todos 44 px | todos 44 px | 44 |
| Alvos a 1440 (ponteiro fino) | ⓘ 28, "Ver antigo" 32, botões 36 | igual | herdado das peças 1 a 4 |
| Rolagem horizontal | 0 | 0 | 0 |
| Foco após tick do pedido | `BODY` | `BODY` | permanecer no controle |
| `role="status"` na peça | 0 | 0 | 1 |

## 4. Não verifiquei
Leitor de tela (a análise do anúncio vem do DOM, não de áudio); Opera de verdade; aparelho real e teclado virtual; a lista de 50 meses ("Tudo" nunca chega a ela: vai para o erro "grande"); ficha do vídeo a 1440 só vista no CSS; rede lenta (a peça é mockup com `setInterval`).

## 5. Acordo
Sem acordo ainda: B1 trava. C1 a C3 entram antes do dono. Com B1 e C1 corrigidos e medidos de novo (foco após 5 s de leitura e `role="status"` presente), dou "pronto para o dono"; os demais são sugestões.
