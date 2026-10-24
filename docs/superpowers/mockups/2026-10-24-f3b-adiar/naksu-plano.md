# F3b "Adiar 7 dias": plano de UI do delta, antes do desenho (Naksu, 23/10)

Fontes lidas: plano F3 §F3b (origin/staging `7c6917406`), spec r17 §6, M3 r2 (`docs/superpowers/mockups/2026-10-21-m3-sugestoes/README.md`) e a tela F3 implementada em `/Users/figueiredo/Workspace/wt-f3-sugestoes` (`lote/f3-sugestoes` `05af396bc`), pasta `apps/web/src/app/cms/(authed)/youtube/competitors/_sugestoes/` (`sugestoes.css`, `linha.tsx`, `icones.tsx`, `vazio.tsx`, `sugestoes-lista.tsx`). Contraste calculado com os hex literais de `.sg` / `[data-theme="light"] .sg`. Não abri navegador: não há delta desenhado ainda; as medidas abaixo são das fichas de token, e a skill tem de remedir no mockup.

**Regra de base para quem desenha:** o mockup do delta parte do CSS implementado (prefixo `sg-`, tokens de `.sg`), não do HTML do M3 r2: a tela já divergiu do mockup (classe `.sg-done`, `.sg-dsp`, `.sg-sep`). Nenhum token novo, nenhuma cor nova, nenhum componente novo: só uma variante declarada de três que já existem (`.sg-done`, `.sg-dsp`, `.sg-vz`/`.sg-vz1`) e um selo `.sg-selo.sg-mute` no cabeçalho.

## 1. O que preservar da F3 (não mexer)

- Um laranja por tela (`--accent` só no primário da linha 1); o "Adiar" não ganha cor.
- `.sg-dsp` com motivos como botões que gravam ao toque, `Salvando…` + `aria-busy`, trava de toque duplo (`ocupada`), `Cancelar` como `.sg-lnk` à direita, Esc fecha.
- Confirmação no mesmo `<li>` (`Confirmacao`, `role="status"`), recolhe em `RECOLHE_MS = 5_000`, foco vai à linha seguinte.
- Erro por linha `.sg-errl` com "Não salvou “X”" + "Tentar de novo “X”".

## 2. Decisões de UI do delta

### D1. Onde o botão mora e o seu peso
- Dentro de `.sg-dsp`, terceiro grupo, depois de um segundo `.sg-sep`: `Por que dispensar? [Lugar errado] [Não me interessa] | [Já fiz] | [⏱ Adiar 7 dias]   Cancelar`.
- Mesmo componente dos motivos: `.sg-btn` (fundo `--surface-2`, borda `--btn-line`, 13 px/500). **Sem** variante nova de cor ou peso. O que o distingue é o grupo próprio e o símbolo de relógio dentro do botão (14 px, `Ic.wait` com tamanho parametrizado: hoje `wait` é fixo em 18 px; mudar para `wait: (w = 18) => sv(w, …, 18)` como já fazem `ok` e `warn`).
- Rótulo de 12 caracteres: a 1440, 13 px/500 Inter, cabe em ~ 130 px com ícone (12 + 14 + 8 + texto ~ 84 + 12); a linha do `.sg-dsp` a 1440 (coluna inteira, `grid-column:1/-1`) tem folga.
- Alvo: 36 px a 1440 com ponteiro fino (como os motivos), 44 px em `@container (max-width:640px)` e em `@media (pointer:coarse)`: regras existentes, nada a acrescentar.

### D2. Grupos a 390 (achado herdado da F3, piora com a F3b)
- Hoje, a 390, `.sg-dsp .sg-sep{display:none}` e os botões têm `flex:1 1 140px`: "Lugar errado" e "Não me interessa" ocupam a 1ª fileira, "Já fiz" a 2ª. Com "Adiar 7 dias", a 2ª fileira vira `[Já fiz][Adiar 7 dias]` lado a lado, sem separador: dois grupos de significado oposto (encerra × volta) lidos como um só. **Corrige.**
- Correção: a 390 o separador vira fio horizontal que força quebra, em vez de sumir:
  `@container (max-width:640px){ .sg-dsp .sg-sep{display:block;flex:1 1 100%;width:auto;height:1px;margin:0;align-self:auto} }`
  Resultado: fileira 1 motivos (2 botões), fio, fileira 2 "Já fiz" (largura toda), fio, fileira 3 "Adiar 7 dias" (largura toda), "Cancelar".
- Custo medido em ficha: `.sg-dsp` a 390 passa de ~ 211 px (p 19 + 16 + 44 + 16 + 44 + 16 + 44 + 12×2) para ~ 291 px (+ 1 fio + 16 + 44 + 16 + 1). Aceitável: o painel só existe aberto. A skill confere com `getBoundingClientRect`.
- O fio usa `--border-strong` como o separador vertical de hoje (1,61:1 escuro / 1,59:1 claro): aceito porque a quebra de fileira já separa os grupos; o fio é reforço, não o único sinal.

### D3. Faixa "Adiada" (confirmação na linha)
- Variante de `Confirmacao`, não componente novo: `desfecho === 'adiada'` → `<li class="sg-row sg-done sg-adi" role="status">`.
- CSS: `.sg-done.sg-adi{border-left-color:var(--btn-line);background:var(--sunk)} .sg-done.sg-adi svg{color:var(--muted)}`.
- **Não usar `--border-strong` na borda**, ao contrário do texto do plano (N-C6 antigo): `--border-strong` sobre `--sunk` dá **1,61:1 escuro / 1,59:1 claro**, abaixo de 3:1, e essa borda é o único traço não textual que separa "Adiada" de uma linha neutra. O próprio cabeçalho de `sugestoes.css` diz "Elemento gráfico usa --btn-line (>= 3:1), nunca --border-strong". `--btn-line` sobre `--sunk`: **3,92:1 escuro / 3,45:1 claro**. Emenda no plano: trocar "border-left em `--border-strong`" por "`--btn-line`". **Corrige (no plano).**
- Símbolo: relógio (`Ic.wait`, 14 px) = "volta numa data", a mesma família `espera` do vazio. A ampulheta (`Ic.late`) já significa "vence em" (acaba numa data) e fica reservada para a variante `expira_antes` (D4). Verde (`--ok`) fica só para "dispensada/já fiz": cor = encerrou; adiada não encerrou.
- Texto (rótulo é do Logan; a forma é minha): negrito curto + data tabular, `<b>Adiada até <span class="num">30/10</span>.</b> Volta para a lista nesse dia.` A data em `DD/MM` tem largura fixa (5 caracteres tabulares), não quebra layout.
- Em escala de cinza, `--ok-line` (#3E8F63) e `--btn-line` (#7D7260) ficam próximos em luminância; a distinção é feita por símbolo (✓ × relógio) e pela palavra ("Dispensada"/"Marcada como já feita" × "Adiada"). Atende "nunca só cor".
- Recolhe em 5 s como as outras confirmações; quem segura a informação depois disso é o selo do cabeçalho (D5).

### D4. Variante `expira_antes` (P-C1 / Y-C4)
- Mesma `.sg-done.sg-adi`, ícone ampulheta (`Ic.late`), texto "Adiada. Ela vence em DD/MM, antes de voltar." Sem `--warn`: não é problema do sistema, é fato da linha. Ícone diferente do D3 é o que faz o dono perceber, de relance, que esta não volta.
- Para o Logan: oferecer "Adiar 7 dias" numa linha que vence em ≤ 7 dias promete algo que não acontece; a tela sabe `vence` (está no ⓘ). Decidir se o botão some, muda de rótulo ou fica.

### D5. Lista com adiados: selo no cabeçalho
- Sem isso, com 3 abertas + 2 adiadas, o N do cabeçalho diz 3 e nada na tela explica para onde foram as 2. Selo `.sg-selo.sg-mute` em `.sg-fresh`, antes da hora do cálculo: `⏱ 2 adiadas · voltam até 30/10` (texto do Logan; o plano traz "2 adiadas voltam até DD/MM.").
- Medidas por ficha: `.sg-selo.sg-mute` 12 px/500, `--muted` sobre `--bg` (≥ 6:1 nos dois temas; a skill mede), borda `--border-strong` decorativa (o texto carrega o sentido). `white-space:nowrap` já existe no selo; com `.sg-fresh` em `flex-wrap:wrap`, a 390 o selo desce de linha inteiro, nunca corta. Texto mais longo possível: "⏱ 99 adiadas · voltam até 30/10" ~ 31 caracteres ≈ 220 px a 12 px: cabe em 358 px.
- Não colocar o número de adiados dentro do pill `.sg-cnt` (ex.: "3 + 2"): o N tem de ser o mesmo do sino e do Cowork.
- Com N = 0 e adiados > 0 o selo some e quem fala é o vazio (D6), para não dizer a mesma coisa duas vezes.

### D6. Vazio `adiado`
- Família `espera` (relógio, neutra, sem classe de cor), `.sg-vz` na página e `.sg-vz1` no bloco do A/B Lab. Nenhum ícone novo.
- Página: `h3` "Você adiou 2 sugestões. A primeira volta em 30/10." + `p` com a frase do motivo do cálculo (P-C2), `min-height:120px` herdado.
- Bloco: só a linha `.sg-vt` (sem parágrafo), `flex:1 1 200px` já quebra a 390. Título mais longo ("Você adiou 37 sugestões. A primeira volta em 30/10.", 51 caracteres, 14 px/600) quebra em 2 linhas a 390: aceitável, nada trunca.
- Número sem chave em `contagens` → "não medido" (`.sg-nm`), como os demais vazios; nunca "0 adiadas".

### D7. Carregando, erro, já adiado
- Carregando: nada novo. `.sg-sk-row` tem as alturas das linhas abertas; o selo D5 vem junto com a página (Server Component), então a linha `.sg-fresh` pode ganhar uma 2ª linha a 390 quando o selo existe: o esqueleto do cabeçalho deve reservar a altura de `.sg-fresh` em duas linhas a 390 (~ 52 px) ou a skill mede o salto e decide. **Sugestão.**
- Gravando: "Salvando…" no lugar de "Adiar 7 dias", ícone some no `aria-busy` (a 1440 a largura cai ~ 35 px; `Cancelar` está com `margin-left:auto` e não pula; a 390 o botão é `flex:1`, sem salto).
- Erro: o `.sg-errl` existente, "Não salvou “Adiar 7 dias”. A sugestão continua aberta." + "Tentar de novo “Adiar 7 dias”" (~ 30 caracteres, ≈ 210 px a 13 px, cabe a 390).
- `ja_adiado` / vencida: tratados como `nao_aberto` → `Confirmacao` "Esta sugestão já saiu da lista." (já existe).
- Gatilho do painel a 390: o `⋯` tem `aria-label="Dispensar: escolher motivo"`; com "Adiar" dentro, o nome acessível mente. Para o Logan: rótulo do `⋯` e do título "Por que dispensar?".

### D8. Temas, Opera, movimento, peso
- Tudo em tokens de `.sg` já literais (hex/rgba). Zero `color-mix()` (Opera). Nenhuma animação nova; nenhuma dependência; ícone reaproveitado.

## 3. Rodada com o opositor (argumento contrário e resposta)

1. **"Adiar devia ser botão visível na linha, ao lado do primário, não escondido em Dispensar."** A 1440 cabe (coluna `.sg-ra` de 248 px, empilhado). A 390 não: `.sg-ra` é `[primário flex:1][⋯ 44]` com 24 px de vão; um terceiro botão de 44 px deixa o primário com ~ 210 px e "Abrir seus 12 vídeos sobre Japão" quebra em 2 linhas, e a linha recolhida (259 px) cresce. Mantenho dentro do painel; se o Logan quiser fora, o custo é esse e vai declarado.
2. **"Siga o plano: `--border-strong` é mais discreto."** 1,61:1 / 1,59:1 não passa os 3:1 de elemento gráfico com sentido. `--btn-line` (3,92 / 3,45) é igualmente neutro (sem matiz) e já é a regra do arquivo. Mantenho.
3. **"Ampulheta é mais 'tempo' que relógio."** A ampulheta já diz "vence em" na mesma linha; usá-la para "volta em" daria ao mesmo símbolo dois sentidos opostos. Relógio = espera/volta (família do vazio). Mantenho.
4. **"O selo no cabeçalho disputa com o N."** É 12 px, `--muted`, sem cor, à direita, na linha da hora; o N é 14 px/600 num pill a 24 px Georgia. Sem ele a lista "perde" itens sem explicação. Mantenho, com a regra de sumir quando o vazio fala.
5. **"Adiar não é negativo: merece cor própria (verde-azulado, `--yt`)."** Um 4º estilo de botão num painel de 4 botões vira ruído, e `--yt` já significa link/Detalhes. Grupo + ícone bastam. Retiro a hipótese de cor.

## 4. Estados que o mockup precisa ter (seletor `?estado=`)

`adiar-aberto` (painel com 3 grupos), `adiar-salvando`, `adiada`, `adiada-expira-antes`, `adiar-nao-salvou`, `ja-adiado`, `lista-com-adiados` (selo), `vazio-adiado`, `vazio-adiado-sem-contagem` (`nm`), `ctx-ablab-adiado` (bloco, `.sg-vz1`). Cada um em 1440 e 390, escuro e claro; mais a 640/641 (troca do container query) no `adiar-aberto`.

## 5. Tabela de medidas (por ficha de token; a skill remede no mockup)

| Par | Escuro | Claro | Limite | Situação |
|---|---|---|---|---|
| Borda faixa `--border-strong` / `--sunk` | 1,61 | 1,59 | 3:1 | reprova (texto do plano) |
| Borda faixa `--btn-line` / `--sunk` | 3,92 | 3,45 | 3:1 | passa (proposta) |
| `--text` / `--sunk` | 16,2 | 14,21 | 4,5 | passa |
| `--muted` / `--sunk` (ícone, texto 2º) | 6,92 | 6,43 | 4,5 | passa |
| `--dim` / `--sunk` | 5,44 | 5,04 | 4,5 | passa |
| `--btn-line` / `--surface` (borda do botão) | 3,51 | 3,83 | 3:1 | passa |
| `--sunk` / `--surface` (fundo da faixa vs lista) | 1,12 | 1,11 | n/a | fundo não carrega sentido sozinho |
| `--ok-line` / `--ok-bg` resolvido (dispensada, referência) | 3,43 | n/m | 3:1 | passa |
| Alvo "Adiar 7 dias" | 36 px fino / 44 px toque e ≤ 640 | | 44 | passa pelas regras existentes |
| Fonte do botão / do selo | 13 px / 12 px | | ≥ 12 | passa |
| `.sg-dsp` a 390 | ~ 211 → ~ 291 px | | | custo declarado |

Valores soltos encontrados: nenhum novo proposto. Pré-existente: `.sg-info` com `style={{ marginTop: 12 }}` inline no cabeçalho (`sugestoes-lista.tsx`), fora do escopo da F3b.

## 6. Não verificado

Tudo acima é medido em ficha, não em tela: não há desenho. Opera real, leitor de tela (anúncio do `role="status"` da faixa adiada), aparelho real e rede lenta ficam para a revisão do mockup e para a T8 da F3b.

## Para o Logan (uma linha cada)
- Rótulo do `⋯` e do "Por que dispensar?" com "Adiar" dentro do painel.
- Botão "Adiar 7 dias" em linha que vence em ≤ 7 dias (some, muda ou fica).
- Texto do selo do cabeçalho e da faixa (forma e posição acima são minhas).
