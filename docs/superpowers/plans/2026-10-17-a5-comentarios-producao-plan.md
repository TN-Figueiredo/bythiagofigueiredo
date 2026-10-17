# A5 · Comentários em nível de produção: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Passos com checkbox (`- [ ]`).

**Objetivo:** um componente único `FioDeComentario` desenha o mesmo fio (avatar, autor, meta, texto, respostas do criador) na página do vídeo ("Comentários de destaque") e na página do canal ("O que o criador respondeu"), como no mockup aprovado pelo dono em 17/10.

**Arquitetura:** um modelo puro (`fio-model.ts`) define `FioView` e as falas. As duas telas convertem o próprio dado para `FioView` dentro do modelo que já têm (`secaoDeComentarios`, `listaDoCriador`), e o componente cliente `fio.tsx` desenha. O pacote "Perguntar a uma IA" continua lendo os mesmos modelos, então o texto dele acompanha a tela. **Fase 1 não muda banco, coleta nem cota.** A fase 2 (fio completo, com respostas de outras pessoas) **não é planejada aqui**: a seção F2 reúne só os insumos para a decisão do dono.

**Stack:** Next 16 / React 19, CSS do `[data-obs]`, Vitest (jsdom para componente), Playwright (Gio).

**Base:** mockup `docs/superpowers/mockups/2026-10-17-comentarios-producao/` (`video.html`, `canal.html`, `fio.css`, `RODADA-2.md`; variante **B**). Pareceres em `.superpowers/sdd/a5/noite/`: `t7-cq-yannis.md` e `t7-cq-phil.md` (rodada 2, aplicados na emenda do fim), `t7-ch-logan.md`, `t7-ch-naksu.md`, `t7-cj-logan.md`, `t7-cj-naksu.md`, `t7-c2-phil.md`. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/02-comentarios-de-destaque.md` (§4.6.3). Código de referência: `~/Workspace/wt-trem7` (trem 7, HEAD `042771ff2`, com o conserto C2 do Phil já em `9f6935b67`).

Caminho curto usado abaixo: `C = apps/web/src/app/cms/(authed)/youtube/competitors`, `T = apps/web/test/youtube/observatorio`, `L = apps/web/src/lib/youtube/observatorio/comentarios`.

---

## Resposta à pergunta do dono: as respostas de outras pessoas são guardadas hoje?

**Não.** Nenhuma resposta de quem não é o criador tem o texto guardado, **nem a do autor do comentário original**. Evidência (código e esquema; sem leitura de produção):

1. **Spec 02, §4.6.3 item 7:** "até 3 respostas **do criador** naquela conversa [...]. **Nenhuma resposta de outra pessoa é gravada.**"
2. **Coleta, `L/normalizar.ts:77-109`:** lê `replies.comments` de cada fio, mas só fica com as respostas cujo `authorChannelId` é o canal do vídeo (`doCriadorTodas`), cortadas em `COMMENT_RULES.creatorRepliesMax = 3`. Das outras respostas, só os ids de canal saem (`canaisNasRespostas`), usados em `L/destaque.ts:81` para o motivo "canal que você acompanha", e não são gravados.
3. **Esquema, `supabase/migrations/20261013000003_observatorio_a5_e14_comentarios_destaque.sql:85`:** `constraint competitor_video_comments_reply_check check (parent_id is null or is_creator)`. O comentário da coluna (:92) diz: "o check impede resposta de outra pessoa".
4. **Invariante `respostas_de_terceiros`** (`L/prova.ts:19,91,95`, `L/gravar.ts:83,116`, função da migration :609): conta linha de resposta que não é do criador. Hoje, se aparecer uma, a prova da coleta fica vermelha.
5. **Quantas respostas a API devolve por fio:** `commentThreads.list?part=snippet,replies` (`L/api.ts:109`) traz no máximo **5** respostas por fio (`RESPOSTAS_QUE_O_YOUTUBE_MOSTRA = 5`, `C/_chrome/comentarios/frases.ts:5`), e a conferência C0.3 (plano E14, `2026-10-12-a5-e14-comentarios-plan.md:112`, 100 conversas, 76 parciais) mediu que são as 5 **mais antigas**: um prefixo contínuo do fio, sem buraco no meio (a documentação oficial não garante isso). Para ter o fio inteiro é preciso `comments.list?part=snippet&parentId=<id>&maxResults=100`: **1 unidade por página, por fio** (spec 02, tabela 4.6.1, linhas 2 e 6). O `totalReplyCount` (o total do fio) já é guardado por marco em `competitor_video_comment_marks.reply_count`.

Os fatos para decidir se passa a guardar estão na seção **F2** (insumos para o dono), fora da fase 1.

---

## Regras gerais (valem para toda tarefa)

- Texto de terceiros é sempre nó de texto React com `dir="auto"`. Nunca HTML, nunca link. Endereço dentro do texto continua texto.
- Nome, foto e id de canal do espectador **nunca** aparecem, com uma exceção: o nível `identidade` (quem edita, nos 28 dias), que segue a regra atual. O criador aparece com nome e foto porque o canal é público.
- Cores com hex ou `rgba` literal. **Nunca `color-mix()`.** Sem z-index numérico. Fonte mínima de 12 px. Todo alvo de toque com pelo menos 44 px.
- Token novo, em `[data-obs]`: `--cf-criador: var(--lado-b)`; `--cf-criador-bg: rgba(124,200,248,.10)` (escuro) e `rgba(11,107,168,.08)` (`[data-theme="light"] [data-obs]`). O espectador é neutro e não tem cor.
- Um nome por conceito. O selo é **"Criador"** (maiúscula inicial). O motivo, na legenda, é "com o criador na conversa". O espectador é **"Espectador"**, nunca "Um espectador" nem "?". O verbo de recolher é sempre **"Recolher"**. A imagem do vídeo se chama **"thumbnail"** em qualquer texto (decisão do trem 7, `234bb3f57`). A palavra "miniatura" do mockup não vai para produção.
- Nunca escrever "não respondeu" onde não vimos resposta.
- **Nível `contagem` (reporter), regra única:** o fio **é** desenhado, mas sem nenhum texto de terceiro: `raiz.texto = null` (aparece `FRASES.textoReservado`, "Texto reservado"), `respostaReservada` no lugar das respostas ("O criador respondeu. O texto da resposta é reservado."), meta e pastilha como hoje. O cliente reporter **não recebe** texto nem nome por HTML, DOM ou RSC. É o que a tela faz hoje (`cartao.tsx:90-93`, `model.ts:202`); o plano só mantém. As frases de contagem continuam como hoje.
- **Texto com "Não carregou" não se mexe aqui:** `abaNaoCarregou`, `model.ts:347` e a frase "Não carregou:" da lista do canal são da decisão 75, T8. O CQ só preserva.
- **Data de fala = `dmDeData`** (`_chrome/comentarios/model.ts:90`, fuso `America/Sao_Paulo`) nas duas telas e nos dois pacotes. **Nunca** o `dm` de `_canal/medidas/formatos.ts:5` (corta o ISO em UTC: `2026-10-17T01:30:00Z` sairia 17/10 no canal e 16/10 no vídeo).
- Commits: um por tarefa, por caminho explícito, **sem `--no-verify`** (é código). `npm run build:packages` só se algum `packages/*/src` mudar (não previsto).

## Foco de revisão (o que nenhum teste de tarefa cobre sozinho e mais morde)

1. **Criador sem foto ou com foto quebrada:** cai na inicial com a cor do canal, sem ícone quebrado e sem salto de layout. Teste na Tarefa 2.
2. **Fio com mais respostas do criador do que cabe:** o banco guarda até 3. Com `RESPOSTAS_VISIVEIS = 3`, o botão "Ver as outras N respostas do criador" só aparece se a regra subir. O caso hostil do mockup (5 + 4) não acontece com dado real. Teste com 5 respostas sintéticas na Tarefa 2.
3. **Comentário de topo escrito pelo próprio criador** (`doCriador`, vídeo): a raiz mostra a foto e o selo do criador, sem resposta e sem pastilha de motivo. Teste na Tarefa 3.
4. **Canal com vídeo sem título ou sem `ytId`:** o cabeçalho do grupo mostra "(sem título)" e o fundo `--surface-2` no lugar da thumbnail, sem `<img>` quebrado. Teste na Tarefa 5.
5. **Nome de canal com 60 caracteres e 390 px:** o nome corta com reticências, o selo fica na linha do nome, sem rolagem horizontal. É do Gio (Tarefa 7). No unitário, só a classe de corte (Tarefa 2).

---

## Mapa de arquivos

| Arquivo | Papel | Tarefa |
|---|---|---|
| `L/leitor-tipos.ts`, `L/leitor.ts`, `L/leitor-contagem.ts` | as respostas do criador passam a trazer a data. No canal: até 3 respostas por fio, desempate por `id`, e a data do topo | 1 |
| `C/_chrome/comentarios/fio-model.ts` (novo) | tipos `FioView`/`FalaView`, `ChaveDeMotivo` e funções puras de texto (autor, meta) | 1 |
| `C/_chrome/comentarios/fio.tsx` (novo, `'use client'`) | `FioDeComentario`, `AvatarDoAutor`, `TextoDaFala` | 2 |
| `C/_chrome/comentarios/fio.css` (novo) | prefixo `cf-`, tokens `--cf-criador*` | 2 |
| `C/_chrome/comentarios/model.ts`, `frases.ts` | frase-resumo, legenda só com o que existe, curtidas do marco, `fio` no cartão; sai `casas`; `autorDaFala` mora aqui | 3 |
| `C/_chrome/comentarios/cartao.tsx`, `lista.tsx`, `secao.tsx`, `comentarios.css`; apaga `fileira.tsx` | a tela do vídeo usa o fio | 4 |
| `C/_historico/comentarios-de-destaque.tsx`, `C/_historico/medidas/blocos-do-video.tsx` | passam `criador` (foto do canal) | 4 |
| `C/_canal/medidas/criador-lista-model.ts`, `criador-model.ts`, `criador-responde.tsx`, `grupo-do-criador.tsx` (novo, `'use client'`), `canal-medidas.css`, `contexto-do-canal.ts`, `criador-do-canal.ts`, `blocos-do-canal.tsx` | grupo por vídeo, fio único, frase na ordem do mockup; saem `.pc-cm*` e `.chip own` | 5 |
| `C/_contexto-ia/empacotar-video-comentarios.ts` (+ inventário) | o pacote do vídeo acompanha o texto da tela; **vai no commit da T3+T4** | 3+4+6a |
| `C/_contexto-ia/empacotar-canal-medidas.ts` (+ inventário, tabela), `apps/web/src/lib/youtube/observatorio/contexto-ia/tipos.ts` | o pacote do canal acompanha a tela; **vai no commit da T5** | 5+6b |
| `apps/web/e2e/tests/cms/observatorio/e5a-comentarios*.spec.ts`, `t6-tela-gio.spec.ts`, `canal.spec.ts`, `allowances.ts` | e2e do Gio | 7 |

---

### Tarefa 1: leitores com data e o modelo do fio

**Arquivos:**
- Modificar: `L/leitor-tipos.ts` (`RespostaDoCriadorVista`, `RespostaDoCriador`), `L/leitor.ts:207-210,362-372`, `L/leitor-contagem.ts:100-150`
- Criar: `C/_chrome/comentarios/fio-model.ts`
- Teste: `T/comentarios-e5-ler.test.ts`, `T/comentarios-e5-ler-contagem.test.ts`, `T/comentarios-fio-model.test.ts` (novo)

**Interfaces:**
- Produz (leitor):
  - `RespostaDoCriadorVista { texto: string; cortado: boolean; publicadoEm: string | null }` (ISO; `leitor.ts` já seleciona `published_at`). `null` quando a linha vier sem data (o leitor do vídeo usa `publicadoMs ?? 0`, `leitor.ts:369,373`): a fala então tem `data: null` e nunca escreve 31/12/1970.
  - `RespostaDoCriador` (canal) troca `respostaTexto/respostaCortada` por `respostas: Array<{ texto: string; cortado: boolean; publicadoEm: string | null }>` (até `COMMENT_RULES.creatorRepliesMax`, da mais antiga para a mais nova, **desempate por `id`** como no leitor do vídeo, `leitor.ts:369`; o select do passo 2 não tem `order`, a ordenação é em memória; sem `missing_since`) e ganha `publicadoEm: string | null` (do topo; acrescentar `published_at` ao select dos topos). Cada texto passa por `semMencoes`, e `mencoesTrocadas` soma todas.
- Produz (`fio-model.ts`):
```ts
export interface CriadorDoFio { nome: string; avatar: string | null; ini: string; color: string }
export type ChaveDeMotivo = /* movido de model.ts, que reexporta (sem ciclo de import) */ string
export type AutorDaFala =
  | { tipo: 'espectador' }                               // sem `n`: a F2 devolve o campo, com teste, se for aprovada
  | { tipo: 'criador' }                                  // nome e foto vêm de CriadorDoFio
  | { tipo: 'identidade'; nome: string; fotoUrl: string | null; ate: string }
  | { tipo: 'proprio' } | { tipo: 'grande'; faixa: string | null } | { tipo: 'reservado' }
export interface FalaView { autor: AutorDaFala; data: string | null /* dd/mm */; texto: string | null; cortado: boolean }
export interface FioView {
  id: string
  raiz: FalaView
  respostas: FalaView[]                 // só do criador na fase 1
  respostaReservada: string | null      // "O criador respondeu. O texto da resposta é reservado."
  meta: { curtidas: string | null; regua: number | null /* 0..100 */; posicao: string | null /* "1 de 12" */; respostas: { n: number; texto: string } | null /* "N respostas"; n === 0 é zero medido */ }
  marcas: { entrou: string | null /* "entrou no dia 7" */; saido: boolean }
  pastilha: { chave: ChaveDeMotivo; texto: string } | null
}
export const RESPOSTAS_VISIVEIS = 3
export function rotuloDoAutor(a: AutorDaFala, criador: CriadorDoFio): string
```
`autorDaFala(a: AutorView): AutorDaFala` mora em `model.ts` (quem conhece `AutorView`; o `'criador'` perde o nome, que vem de `CriadorDoFio`). `fio-model.ts` não importa `model.ts`.

- [ ] **Passo 1: testes que falham.**
  - `comentarios-e5-ler.test.ts`: `respostasDoCriador[0].publicadoEm` é o ISO do `published_at` da linha filha falsa, e a ordem continua da mais antiga para a mais nova.
  - `comentarios-e5-ler-contagem.test.ts`: a consulta das respostas leva `is('missing_since', null)` (afirmar o filtro, como os testes do leitor já fazem; o dublê não prova a consulta); com 3 filhas devolvidas pelo dublê, `respostas.length === 3`, em ordem de `published_at` e, no empate, de `id`; com 4 devolvidas, corta em 3. `publicadoEm` do topo vem preenchido. `mencoesTrocadas` soma o topo e as respostas.
  - `comentarios-fio-model.test.ts`: `rotuloDoAutor({tipo:'espectador'}) === 'Espectador'`; `rotuloDoAutor({tipo:'criador'}, {nome:'Matheus Fonseca',...}) === 'Matheus Fonseca'`; `autorDaFala({tipo:'criador',nome:'X'})` (teste em `comentarios-e5-model.test.ts`) devolve `{tipo:'criador'}`.
- [ ] **Passo 2:** `npx vitest run T/comentarios-e5-ler.test.ts T/comentarios-e5-ler-contagem.test.ts T/comentarios-fio-model.test.ts > /tmp/t1.txt 2>&1; grep -E 'FAIL|✗|Error' /tmp/t1.txt`. Esperado: FAIL.
- [ ] **Passo 3:** implementar. Os consumidores de `respostaTexto` (`criador-lista-model.ts`, `empacotar-canal-medidas.ts`) passam a ler `respostas[0]` só para compilar. A troca de verdade é nas Tarefas 5 e 6.
- [ ] **Passo 4:** os mesmos testes e `npm run typecheck -w apps/web > /tmp/tc.txt 2>&1; tail -5 /tmp/tc.txt`. Esperado: PASS, 0 erros.
- [ ] **Passo 5: commit** `feat: leitores de comentários com data das respostas e até 3 respostas do criador no canal; modelo do fio único (comentários em produção, T1)`.

### Tarefa 2: componente `FioDeComentario` e `fio.css`

**Arquivos:**
- Criar: `C/_chrome/comentarios/fio.tsx`, `C/_chrome/comentarios/fio.css`
- Teste: `T/comentarios-fio.test.tsx` (novo, `// @vitest-environment jsdom`), `T/comentarios-e5-css.test.ts` (acrescentar `fio.css`)

**Interfaces:**
- Consome: `FioView`, `CriadorDoFio`, `RESPOSTAS_VISIVEIS`, `rotuloDoAutor` (T1); `ChannelAvatar` (`C/_chrome/channel-avatar.tsx`).
- Produz: `export function FioDeComentario(p: { v: FioView; criador: CriadorDoFio; densidade: 'cartao' | 'lista'; escondido?: boolean; extra?: React.ReactNode }): JSX.Element`, num `<li id={v.id} tabIndex={-1}>`. O `extra` é o encaixe do vídeo: avisos de corte e endereço, "Saiu do YouTube", degraus de canal grande, "não vimos / não sabemos". `entrouNoDia`, "N respostas" e o estado de "saiu dos 12" **não** vão no `extra`: são `FioView.marcas` e `meta.respostas` (T1) e o próprio `FioDeComentario` os desenha.

Estrutura (copiada do mockup `fio.css`, variante B): grade `32px 1fr`, `column-gap:12px`. Linha 1: avatar | autor (600 13.5px) · selo · pastilha · meta (12.5px `--muted`, `tabular-nums`) · posição à direita (`.cf-meta.push`). Linha 2: texto (14px/21px, corte em 4 linhas, "Ver tudo"/"Recolher"). Respostas recuadas 44 px, avatar 24 px, balão `--cf-criador-bg`, filete `3px solid var(--cf-criador)`. A ≤480 px (`@container`, com `container-type:inline-size` no contêiner da seção, não na página): avatar 28 px, resposta em largura total, `.cf-meta.push{order:1}` e `.cf-meta:not(.push){order:2;flex-basis:100%}` (sugestão da Naksu, rodada 2).

- [ ] **Passo 1: testes que falham** (`comentarios-fio.test.tsx`):
  - espectador: há um `svg` dentro de `.cf-av` com `aria-hidden="true"`, e o texto "Espectador" aparece; não existe "?" nem `<img>`.
  - criador com `avatar`: `ChannelAvatar` desenha `img[alt=""]` dentro de `.cf-av.cri`; o selo `.cf-selo` tem o texto exato `Criador`.
  - criador com `avatar: null`: `[data-avatar="ini"]` com `ini`. Disparar `error` no `<img>` leva a `data-avatar="ini"` (Foco 1).
  - 5 respostas sintéticas: 3 visíveis, e o botão "Ver as outras 2 respostas do criador" tem `aria-expanded="false"`; clicar mostra as 5 e o rótulo vira "Recolher"; o foco continua no botão (Foco 2).
  - texto com `<b>x</b>` aparece como texto literal; nenhum `a[href]` dentro de `.cf-txt`.
  - `respostaReservada` aparece no lugar das respostas.
  - **nível contagem:** com `raiz.texto: null`, `.cf-txt` não existe e "Texto reservado" aparece.
  - **um caso por variante de `AutorDaFala`:** `identidade` desenha `img[referrerpolicy=no-referrer]` e o nome, e cai na inicial quando a imagem dá `error`, com "até dd/mm"; `proprio` desenha o selo "Seu canal"; `grande` desenha a faixa e **nenhum nome**; `reservado` não tem texto de autor. O `identidade` é o único caminho em que nome e foto de espectador aparecem: o mais sensível, testado primeiro.
  - `marcas.entrou` desenha "entrou no dia 7" (`.cf-entrou`); `meta.respostas` desenha "N respostas", e `n === 0` desenha o `0` como zero medido (`obs-ch-zero`); `marcas.saido` põe a classe `cf-saiu`.
  - nome com 60 caracteres: o elemento do nome tem a classe `.cf-nome` (corte com reticências no CSS) (Foco 5).
  - `comentarios-e5-css.test.ts`, para `fio.css`: nenhum `color-mix(`; nenhum `font-size` abaixo de 12px; `--cf-criador:var(--lado-b)` existe; `.cf-link` com `min-height:44px`.
- [ ] **Passo 2:** rodar os dois arquivos. Esperado: FAIL (módulo não existe).
- [ ] **Passo 3:** implementar. `TextoDaFala` sai de `Texto` em `cartao.tsx` (o mesmo `useEffect` de medir o corte) e passa a usar "Recolher" (`FRASES.recolher`). A silhueta é um SVG inline (cabeça e ombros), `fill:var(--dim)` sobre disco `--surface-2`, anel `1px solid var(--dim)`.
- [ ] **Passo 4:** PASS.
- [ ] **Passo 5: commit** `feat: FioDeComentario único com avatar do criador, silhueta do espectador e selo Criador (comentários em produção, T2)`.

### Tarefa 3: modelo da seção do vídeo no texto do mockup

**Arquivos:**
- Modificar: `C/_chrome/comentarios/model.ts`, `C/_chrome/comentarios/frases.ts`
- Teste: `T/comentarios-e5-model.test.ts`, `T/comentarios-e5-secao-fixture.ts`

**Interfaces:**
- Consome: `FioView`, `autorDaFala` (T1).
- Produz:
  - `CartaoView` ganha `fio: FioView` e **mantém** `rodape`, `motivo`, `curtidas`, `texto`, `resposta`, que o pacote da IA lê (Tarefa 6). Sai do cartão: nada que o pacote use.
  - O nome do criador vem **só** de `criador.nome` (prop de `ComentariosDeDestaque`), passado ao modelo como `canalNome`; não usar `canaisDoSite` (`blocos-do-video.tsx:79`) para a frase, para que frase e fio nunca divirjam.
  - `ListaView`: sai `casas` (e `CasaView`, `CASAS`, `FRASES.rotuloDaCasa`). `frase` vira `frase: { negrito: string; resto: string | null }`. `barra.texto` vira `"12 de 132"` (sem "(todos)"). `legenda` passa a ser só os motivos com n > 0, e ganha `zeros: string | null`. `movimento.texto` vai para o rodapé da lista (a tela decide o lugar; o modelo só não o põe no topo).

Texto exato (do mockup aprovado):
- Com resposta vista: negrito `O criador respondeu a ${resp} dos ${n} comentários guardados com ${dias(m)}.`; resto `O vídeo tinha ${num(de)}.` quando `completo`; quando não, `Lemos os ${num(de)} primeiros por relevância.` (texto novo: o Logan confirma no portão).
- Sem resposta vista: negrito `Não vimos resposta do criador nos ${n} comentários guardados com ${dias(m)}.` e o mesmo resto.
- Legenda: `FRASES.legendaCurtidos(n)` → `${n} mais curtidos`; criador → `${n} com o criador na conversa`; acompanhado e grande como hoje, só quando n > 0.
- Zeros, uma frase apagada: com acompanhado e grande em zero, `Nenhum de canal que você acompanha nem de canal grande.`; com só um deles em zero, `Nenhum de canal que você acompanha.` ou `Nenhum de canal grande.`; sem zero nenhum, `null`.
- `FRASES.faixaTexto` = `Nome e foto de quem comenta ficam ocultos. O criador aparece porque o canal é público.` A regra dos 28 dias vai para o ⓘ.
- `fio.meta.curtidas`: número no marco do painel, `${num(v)} com ${dias(m)}` (exemplo: "15 com 1 dia"). Fora dos 12 nesse marco: `FRASES.foraDos12`. `fio.meta.regua` = `round(v / maxDoPainel * 100)`, no mínimo 4 quando v > 0; `null` sem número. Base: o mais curtido **da lista daquele painel** (decisão deste plano; o ⓘ diz "a régua compara com o mais curtido desta lista, na idade da aba"; o Logan confirma, porque a nota do RODADA-2 falava em base de 1 dia).
- `fio.pastilha`: `null` quando o motivo é `criador` (a resposta com foto já diz). Nos outros motivos, `{ chave, texto: 'Mais curtido' | 'Canal que você acompanha' | 'Canal grande' }`. O próprio canal mantém o selo atual.
- `fio.meta.posicao` = `FRASES.posicao(i, de)` ("1 de 12"). `FRASES.mostrarOutros(n)` = `Ver as outras ${n}`. `FRASES.mostrarSoOsPrimeiros` = `Recolher`.
- ⓘ (`infoParagrafos`) acrescenta: como os 12 são escolhidos, o que é cada motivo, "O YouTube mostra até 5 respostas por comentário.", o que é "retrato" e o texto da régua.

- [ ] **Passo 1: testes que falham** (fixture `tipico` com 12 cartões, 8 mais curtidos, 4 do criador com resposta e lote completo de 132):
  - `frase.negrito === 'O criador respondeu a 4 dos 12 comentários guardados com 1 dia.'` e `frase.resto === 'O vídeo tinha 132.'`;
  - `barra.texto === '12 de 132'`;
  - `legenda.map(l => l.texto)` igual a `['8 mais curtidos', '4 com o criador na conversa']`, e `zeros === 'Nenhum de canal que você acompanha nem de canal grande.'`;
  - `'casas' in lista === false`;
  - cartão 1: `fio.meta.curtidas === '15 com 1 dia'`, `fio.meta.posicao === '1 de 12'`, `fio.pastilha === null`, `fio.respostas[0].autor.tipo === 'criador'`, e `fio.respostas[0].data` em dd/mm;
  - cartão com `doCriador` (Foco 3): `fio.raiz.autor.tipo === 'criador'`, `fio.respostas.length === 0`, `fio.pastilha === null`;
  - sem resposta vista: `frase.negrito` começa com `Não vimos resposta do criador`; nenhum texto do modelo contém "não respondeu";
  - variantes do texto (cada uma é uma linha na fixture; sem elas um mutante que inverta `> 0` sobrevive): um zero só (`Nenhum de canal grande.`); lote incompleto (`resto === 'Lemos os 12 primeiros por relevância.'`); `meta.curtidas === FRASES.foraDos12` fora dos 12 do marco; `regua === 0` com `v = 0`; `regua === 4` com `v` muito menor que o máximo; `regua === null` sem número;
  - `marcas.entrou`, `meta.respostas` e `marcas.saido` saem do mesmo dado de `entrouNoDia`, `rodape.respostas` e `saidoDosDoze` de hoje (`cartao.tsx:83,87,112`);
  - nível `contagem`: a fixture não traz nenhum texto da fixture `texto` (a mesma sentinela do teste de saída), `raiz.texto === null` e `respostaReservada` preenchida.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar. Apagar `CasaView`, `CASAS` e `rotuloDaCasa`.
- [ ] **Passo 4:** PASS no modelo. Os testes de tela quebram até a T4 (esperado). **Não há commit da T3 sozinha:** o modelo sem a tela não compila no `lista.tsx`, e sem a T6a o `tsc` falha em `empacotar-video-comentarios.ts:71,73` (`frase` agora é objeto; `legenda[].zero` muda de sentido) e o pre-commit recusa. Commit único: **T3+T4+T6a** (mensagem na T4).

### Tarefa 4: tela do vídeo com o fio

**Arquivos:**
- Modificar: `C/_chrome/comentarios/cartao.tsx` (vira um envoltório fino de `FioDeComentario`, com o `extra`), `lista.tsx` (sem `Fileira`; barra fina na linha da frase, `.resumo-linha`; legenda numa linha; `zeros` apagado; movimento no rodapé), `secao.tsx` (`criador` como prop), `comentarios.css` (apagar `.cd-casa*`, `.cd-fileira`, `.cd-cur*`, `.cd-selo-c`, `.cd-foto*`, `.cd-autor`, `.cd-resp*`, `.cd-cartao-h`, `.cd-etq`; manter abas, estados, `.cd-link`, título e ⓘ)
- Apagar: `C/_chrome/comentarios/fileira.tsx`. Junto, o listener do evento `cd-revelar` e o atributo `data-cd-lista` em `lista.tsx:18-28` (só a `fileira.tsx:12` disparava o evento: código morto).
- Modificar (**T6a, no mesmo commit**): `C/_contexto-ia/empacotar-video-comentarios.ts` (`frase = negrito + ' ' + resto`, `barra = "12 de 132"`, `legenda` só dos presentes, campo novo `zeros: string | null`, resposta do criador como `dd/mm: texto` com ` …` quando cortada; `:71,73`) e seu inventário `INVENTARIO_COMENTARIOS_VIDEO` (`:104-116`): entra `'derivado.comentarios.listas[].zeros': 'base'`; se `legenda[].zero` deixar de existir, a chave de `:112` sai também (o teste de declaração velha, `semUso`, `contexto-ia-video-comentarios.test.tsx:115`, acusa a sobra). Teste: `T/contexto-ia-video-comentarios.test.tsx` (ver T6a abaixo).
- Modificar: `C/_historico/comentarios-de-destaque.tsx` (prop `criador: CriadorDoFio`, e **só ela**: `canalNome` do modelo vem de `criador.nome`), `C/_historico/medidas/blocos-do-video.tsx:78-80` (passa `criador` de `p.view.chan`: `{ nome: chan.name, avatar: chan.avatar, ini: chan.ini, color: chan.color }`)
- Teste: `T/comentarios-e5-pecas.test.tsx`, `T/historico-e5-comentarios.test.tsx`, `T/comentarios-e5-saida.test.tsx`

**Interfaces:**
- Consome: T2 e T3.
- Produz: `SecaoDeComentarios({ v, criador, hrefFilaSaiu })`.

- [ ] **Passo 1: testes que falham:**
  - `comentarios-e5-pecas`: não existe `.cd-fileira` nem `.cd-casa`; existe `.cf` × 12, com 5 visíveis; o botão `Ver as outras 7` alterna para `Recolher`, e o foco vai para o 6º fio; a frase-resumo vem antes das abas no DOM; `.cf-selo` aparece 4 vezes (as respostas).
  - `historico-e5-comentarios`: a foto do canal (`h.chan.avatar`) chega ao `img` da resposta.
  - `comentarios-e5-saida` (o teste de saída que já existe): o nome-sentinela do espectador vencido continua fora do HTML e do RSC. A silhueta não leva nome. Fixture `contagem`: nenhum texto da fixture `texto` aparece (mesma sentinela).
  - o painel dos que saíram dos 12 ("Ver os N que saíram") é desenhado com `FioDeComentario` e a classe `cf-saiu`; `entrouNoDia` aparece como "entrou no dia 7".
  - **T6a:** a frase do pacote é igual, caractere por caractere, a `negrito + ' ' + resto` do modelo da tela (fixture `tipico`); `barra === '12 de 132'`; `zeros` presente; nenhuma string do pacote contém "Um espectador", "(todos)" nem "não respondeu"; varredura de saída: o nome-sentinela continua ausente; o inventário não tem chave sem uso nem campo sem chave.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run T/comentarios-e5 T/historico-e5-comentarios T/contexto-ia-video-comentarios T/contexto-ia-varredura > /tmp/t4.txt 2>&1; grep -E 'FAIL|Tests ' /tmp/t4.txt`, mais o typecheck da web. Esperado: PASS e 0 erros.
- [ ] **Passo 5: commit (T3+T4+T6a)** `feat: Comentários de destaque com fio único, frase-resumo antes das abas, legenda só do que existe, sem a fileira de casas, e pacote da IA do vídeo com o mesmo texto (comentários em produção, T3-T4-T6a)`.

### Tarefa 5: canal, "O que o criador respondeu", agrupado por vídeo

**Arquivos:**
- Modificar (**T6b, no mesmo commit**): `C/_contexto-ia/empacotar-canal-medidas.ts` (ver T6b abaixo); sem isso o commit não compila (`:216-219` lê `m.subtitulo`, `m.aMais`, `m.itens[]`; `:445-453` monta a tabela de `cri.lista.itens`).
- Modificar: `C/_canal/medidas/criador-lista-model.ts`, `criador-model.ts` (só a frase de `nao_medido`), `criador-responde.tsx`, `canal-medidas.css` (apagar as linhas 257-263, de `.pc-cm` a `.pc-cma`, e `.pc-cmv a` da :323), `criador-do-canal.ts`, `C/_canal/medidas/contexto-do-canal.ts` (`thumbs` e `criador`), `blocos-do-canal.tsx:105`
- Criar: `C/_canal/medidas/grupo-do-criador.tsx` (`'use client'`: o botão "Ver as outras N deste vídeo")
- Teste: `T/medidas-canal-criador.test.tsx`, `T/medidas-canal-criador-leitura.test.ts`

**Interfaces:**
- Consome: `RespostaDoCriador.respostas/publicadoEm` (T1), `FioDeComentario`, `FioView` (T2), `dmDeData` (`_chrome/comentarios/model.ts`; ver Regras gerais).
- Agrupar por vídeo com `Map` (O(n)); proibido `grupos.find(...)` dentro do laço dos itens (n × g disfarçado).
- Produz:
```ts
export const VISIVEIS_POR_GRUPO = 3
export interface GrupoDoCriador { videoId: string; titulo: string; thumb: string | null; respostasDele: string /* "12 respostas dele" */; fios: FioView[] }
// ModeloDaLista 'itens': { tipo:'itens'; total; nVideos; frase:{negrito,resto}; grupos: GrupoDoCriador[] }   (saem itens, aMais, subtitulo, MAX_NA_LISTA)
```
  - `ContextoDoCanal` ganha `thumbs: ReadonlyArray<readonly [string, string | null]>` (de `view.videos.videos`: `ytId` → `https://i.ytimg.com/vi/${encodeURIComponent(ytId)}/mqdefault.jpg`, como em `_canais/view-model.ts:327`) e `criador: CriadorDoFio` (de `CanalHeaderView`: `name`, `avatar`, `ini`, `color`). `CriadorResponde` recebe `criador`.
  - Fio do canal: `raiz = { autor:{tipo:'espectador'}, data: publicadoEm ? dmDeData(publicadoEm) : null, texto, cortado }`; `respostas` = as do criador, cada uma com `data` por `dmDeData`; `marcas = { entrou: null, saido: false }`; `meta.respostas = null`; `meta.curtidas` = `${num(c)} no retrato de ${marco} dias` (marco 1: `${num(c)} com 1 dia`); `meta.regua = null`; `posicao = null`; `pastilha = null`.
  - Grupos do vídeo mais novo para o mais velho (a ordem atual por `baseDaIdade`). Dentro do grupo, a ordem é a da leitura.

Texto exato (mockup `canal.html`):
- Frase da lista, em negrito, **antes** da régua: `${nome} respondeu a ${ptn(total,'comentário guardado','comentários guardados')}, em ${ptn(nVideos,'vídeo','vídeos')}.` (sai " O vídeo mais recente primeiro." e sai "com retrato de 30 dias").
- Frase do bloco `nao_medido` com fecha-em (`criador-model.ts:199`): sem o negrito "Ainda não dá para medir."; o texto vira `Só ${nBase} dos ${total} vídeos dos últimos ${janela} dias ${já tem|já têm} o retrato de 30 dias; o primeiro dos outros fecha em ${dm}. Quanto ele responde por vídeo ainda não é medido.`, com a pastilha "não medido" **logo depois da frase**, não no `.pc-sh`. As outras variantes de `nao_medido` mantêm o texto e só mudam o lugar da pastilha.
- Ordem da seção: título + ⓘ (sem pastilha) → frase da lista → frase do bloco + pastilha → régua → grupos.
- **Costura com a decisão 75 (D75 T8):** `criador-responde.tsx` tem **um único lugar** que desenha o estado do bloco, `EstadoDoBloco({ bloco })`, logo depois da frase do bloco, com `switch (bloco.tipo)`. O ramo `nao_medido` desenha a pastilha (o mockup a move do `.pc-sh` para depois da frase; se a D75 T1-T2 já tiver entrado, usar `PastilhaAusencia estado="nao_medido"` em vez de `<span class="obs-ch-nm">`). O ramo `nao_carregou` continua com `<NaoCarregou medida="O que o criador respondeu" />`, **intocado**. A lista mantém o ramo `m.tipo === 'nao_carregou'` separado do ramo dos grupos, com a frase "Não carregou:" **igual à de hoje**. O CQ não muda nenhuma frase com "Não carregou".
- Cabeçalho do grupo: thumbnail 64×36 (`width`/`height` declarados, `loading="lazy"`, `alt=""`, fundo `--surface-2`; sem `ytId`, só o fundo) + título com `-webkit-line-clamp:2` dentro do `Link` para o Histórico (alvo de 44 px; o `Link` fica no componente de servidor, nunca vira prop do cliente) + `${n} ${n===1?'resposta dele':'respostas dele'}`.
- Botão: `Ver as outras ${n} deste vídeo` / `Recolher`. O foco vai para o 4º fio ao abrir e volta ao botão ao recolher.

- [ ] **Passo 1: testes que falham:**
  - `medidas-canal-criador`: **data em fuso:** `publicadoEm = '2026-10-17T01:30:00Z'` → `'16/10'` na raiz e em cada resposta; `publicadoEm: null` → `data: null`; **respostas do canal têm data** (`dd/mm`); autores do canal: raiz `espectador`; com 12 respostas num vídeo, 1 grupo, 3 `.cf` visíveis, o botão "Ver as outras 9 deste vídeo"; não existem `.pc-cm`, `.pc-cma` nem `.chip`; "Espectador" aparece e "?" não; `.cf-selo` com o texto "Criador"; o título do vídeo aparece **1** vez; a pastilha "não medido" não está dentro de `.pc-sh`; a frase da lista vem antes de `.pc-rqs` no DOM.
  - vídeo sem título e sem `ytId` (Foco 4): o grupo mostra "(sem título)" e nenhum `img` de thumbnail.
  - a frase do bloco do caso 1/6/7/14 continua citando só números da legenda (o teste do CM item 3 continua verde).
  - `medidas-canal-criador-leitura`: com 2 vídeos, os grupos vêm em ordem de idade; `respostasDele` usa singular e plural certos.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run T/medidas-canal T/canal T/contexto-ia > /tmp/t5.txt 2>&1; grep -E 'FAIL|Tests ' /tmp/t5.txt` + typecheck.
- [ ] **Passo 5: commit (T5+T6b)** `feat: O que o criador respondeu agrupado por vídeo com o fio único e pacote da IA do canal com o mesmo texto; saem .pc-cm e o chip com cursor (comentários em produção, T5-T6b)`.

### Tarefa 6: pacote "Perguntar a uma IA" com o mesmo texto (dividida entre os commits T3+T4 e T5)

Não há commit "T6" próprio: o `tsc` do pre-commit falharia no meio do lote. **T6a** (vídeo) vai no commit T3+T4+T6a; **T6b** (canal) vai no commit T5+T6b.

**Arquivos:**
- T6a: `C/_contexto-ia/empacotar-video-comentarios.ts` (detalhe na T4).
- T6b: `C/_contexto-ia/empacotar-canal-medidas.ts:96-104,212-224,286-319,443-453`
- Teste: `T/contexto-ia-video-comentarios.test.tsx`, `T/contexto-ia-canal-medidas.test.tsx` (`COLUNAS` em `:121`), `T/contexto-ia-tamanhos.test.ts`, `T/contexto-ia-varredura-de-codigo.test.ts`, `T/contexto-ia-varredura-de-saida.test.ts`

**T6a (vídeo):** `listas[].frase` = `negrito + ' ' + resto`; `barra` = `"12 de 132"`; `legenda` só dos presentes, mais `zeros: string | null`. `Comentario.respostaDoCriador.texto` junta as respostas, cada uma `dd/mm: texto` (` …` quando cortada). `Comentario` mantém os campos atuais, sem autor.

**T6b (canal):**
- `ListaDoCriadorIa` troca `itens`, `aMais` e `subtitulo` por `grupos: Array<{ titulo: string; respostasDele: string; fios: Array<{ data: string | null; curtidas: string | null; texto: string; respostas: string[] }> }>`; `respostas` no mesmo formato do vídeo (`dd/mm: texto`, ` …` quando cortada, como `listaIa` faz em `:219`). O pacote leva **todos** os fios (a tela esconde, o pacote não corta). Apagar `MAIS_RESPOSTAS`.
- **Inventário** `INVENTARIO_MEDIDAS_CANAL` (`:316-319`): saem `lista.subtitulo`, `lista.aMais`, `lista.itens[].*`; entram `lista.grupos[].titulo` (`terceiros`), `grupos[].respostasDele` (`base`), `grupos[].fios[].texto` (`terceiros`), `grupos[].fios[].respostas[]` (`terceiros`), `grupos[].fios[].data` e `grupos[].fios[].curtidas` (`base`).
- **Tabela** `canal-criador-respostas`: continua plana, `tipo: 'lista'`, **uma linha por fio**, colunas `Vídeo | Data | Curtidas do comentário | Comentário | Respostas do criador` (respostas juntas com `\n`, cada uma `dd/mm: texto`), na ordem da tela (vídeo mais novo primeiro). **Sem "cortar por grupo"**: esse corte não existe. O corte genérico por degraus `[25,10,5,3,1,0]` (`contexto-ia/regras.ts`, `montar-texto.ts:195-214`, linha "Por tamanho" sempre dita) age sobre as linhas; fios aninhados numa célula só virariam piso não cortável.
- **`COLUNAS`** em `contexto-ia-canal-medidas.test.tsx:121-148` muda junto, para as colunas acima.
- `avisosDoCriador` (`:453`) perde `subtitulo` e `aMais`.
- **Frases (sem duplicar):** `CriadorIa.frase` (o bloco) e `lista.frase` ficam **separados**, como na tabela `canal-criador-frases` (`:443-444`); só se inverte a ordem das linhas para `[lista.frase, cri.frase]`, que é a ordem da tela. A frase da lista aparece **1 vez** no texto montado.
- **Allowance:** os empacotadores **não** importam `fio-model.ts`; `PERMITIDOS` de `contexto-ia-varredura-de-codigo.test.ts` fica igual. Se o executor precisar importar, acrescentar `'../_chrome/comentarios/fio-model'` ao `PERMITIDOS`, com a razão na linha.

- [ ] **Passo 1: testes que falham:**
  - T6a: os do Passo 1 da T4.
  - T6b: com 12 respostas, a tabela tem 12 linhas (um fio por linha), nenhuma string contém "não cabem"; `data` do pacote com `01:30Z` → `16/10`; a frase da lista aparece 1 vez; o inventário não tem chave sem uso nem campo sem chave.
  - `contexto-ia-tamanhos.test.ts`: canal com 24 vídeos × 20 fios de 2.000 caracteres ⇒ arquivo completo ≤ 200.000, linha "Por tamanho" presente, nenhum fio pela metade.
  - varredura de saída: o nome-sentinela continua ausente.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run T/contexto-ia > /tmp/t6.txt 2>&1; grep -E 'FAIL|Tests ' /tmp/t6.txt`. Esperado: PASS.
- [ ] **Passo 5:** sem commit próprio (T6a no commit da T4, T6b no da T5).

### Tarefa 7: e2e do Gio, oráculo e allowances

**Arquivos:**
- Modificar: `apps/web/e2e/tests/cms/observatorio/e5a-comentarios.spec.ts`, `e5a-comentarios-alvos.spec.ts`, **`t6-tela-gio.spec.ts`** (`:51-69` mede `.cd-casa-vazia` e injeta `.cd-foto-inicial` dentro de `.cd-autor`, classes que somem na T4: o caso da casa vazia sai porque a fileira deixa de existir; o da inicial passa a `.cf-av [data-avatar="ini"]`), `canal.spec.ts` (se citar `.pc-cm` ou o texto antigo), `allowances.ts` (entradas que citem "Um espectador", "Mostrar menos", "Mostrar os outros", "(todos)", "Com o criador", "não cabem")
- Varredura obrigatória antes: `grep -rn "Um espectador\|Mostrar menos\|Mostrar os outros\|(todos)\|Com o criador\|não cabem\|cd-casa\|cd-fileira\|cd-autor\|cd-foto\|cd-cartao\|cd-resp\|cd-texto\|cd-cur\|cd-mais\|cd-selo-c\|cd-etq\|pc-cm\|chip own" apps/web/e2e apps/web/test apps/web/src`. Todo acerto ou muda nesta tarefa ou já mudou antes. As fixtures do oráculo (`apps/web/test/fixtures/observatorio/dados.cjs`, `dados-teste.html`) só mudam se citarem esses textos da seção de comentários (o oráculo do Observatório não desenha esta seção; conferir com o grep).

- [ ] **Passo 1: specs novos ou ajustados (o Gio escreve):**
  - `e5a-comentarios-alvos`, para cada combinação de {390, 600, 1440} × {escuro, claro}: sem rolagem horizontal (`scrollWidth <= clientWidth`); `.cf-link`, `.aba` e `.info` com pelo menos 44 px; nenhuma fonte abaixo de 12 px dentro de `.cf`; a 390 com nome típico, "N de 12" na linha do nome (o `top` do `.cf-meta.push` igual ao do `.cf-nome`); com nome de 60 caracteres afirmar só "sem rolagem horizontal e o nome com reticências" (a Naksu aceita que o "N de 12" quebre, `t7-cj-naksu.md:63`); a resposta continua distinta (fundo `--cf-criador-bg`).
  - Teclado: Tab chega a "Ver tudo", "Ver as outras 7" e "Recolher"; Enter alterna; o foco fica no lugar.
  - Leitor de tela: avatares com `aria-hidden`; "Espectador" e "Criador" lidos como texto.
  - Canal: um grupo, o título do vídeo uma vez só, o botão "Ver as outras N deste vídeo".
  - Privacidade (já existe, ajustar seletores): o reporter não recebe texto nem nome em HTML, DOM ou RSC.
  - Opera: o Gio confere a cor `--cf-criador` (sem `color-mix`; ver `reference_colormix_renders_transparent`).
- [ ] **Passo 2:** rodar com o servidor local (runbook `docs/ops/runbook-cms-e2e-local.md`), com a saída em arquivo e só as falhas no contexto.
- [ ] **Passo 3: commit** `test: e2e do fio único nos comentários do vídeo e do canal, 390/600/1440 e dois temas (comentários em produção, T7)`.

---

## Ordem dos commits e portões

**Ordem única com o plano da decisão 75** (`2026-10-17-a5-decisao-75-erro-e-restrito-plan.md`), conferida arquivo a arquivo (Yannis):

1. **D75 T1 → T2** (arquivos novos: `_chrome/ausencia/*`, tokens).
2. **CQ T1 → T2 → (T3+T4+T6a) → (T5+T6b)**, um commit por item, por caminho explícito. **D75 T3, T4 e T5** (modelos de `_proprio`, `_comparar`, `_canais`, aditivos) podem andar **em paralelo, em outro worktree**; não tocam nada do CQ.
3. **D75 T6 → T7 → T8 → T9**, já sobre o CQ (a T8 é uma edição pequena sobre a reescrita grande do CQ; o inverso obrigaria o CQ T5 a preservar edições espalhadas). A varredura da D75 T8 roda depois e pega qualquer "Não carregou" que o CQ tenha carregado.
4. **CQ T7 + D75 T10 numa rodada só do Gio**; um commit de `allowances.ts` por plano, em sequência.

Pontos de contato (para o rebase): `frases.ts` (CQ T3 × D75 T8 `abaNaoCarregou`, 3 linhas de distância), `criador-responde.tsx` (conflito estrutural, resolvido pela costura da T5), `criador-lista-model.ts` (frase "Não carregou:"), `empacotar-canal-medidas.ts` (CQ T6b × D75 T9 `:339`), `allowances.ts`. O plano D75 deve trocar, na T8, a referência `criador-responde.tsx:37` por "o ramo `nao_carregou` de `EstadoDoBloco` (CQ T5)" e somar ao `falhou` a falha parcial (`lista?.tipo === 'nao_carregou'`, `criador-do-canal.ts:15`).

**O executor nunca faz push.** Antes do push (feito pelo controlador): `npx vitest run > /tmp/suite.txt 2>&1` (cerca de 160 s, em segundo plano), só as falhas no contexto; typecheck da web e da API.

**Portão Phil e Yannis no fim do lote:** Phil olha a T1 (leitor e volume das 3 respostas no canal) e a T6b (saída); Yannis olha o lote todo. O Gio confere no navegador (T7) antes de ir ao dono.

## Riscos

- **Divergência do mockup, com dado real:** o mockup mostra 5 respostas do criador e "Ver as outras 4", mas o banco guarda até 3 (`creatorRepliesMax`). A tela real nunca mostra esse botão. Não é defeito; o Gio não deve procurá-lo com dado real.
- **Base da régua:** este plano decide "o mais curtido da lista do painel". A nota do RODADA-2 dizia "marco de 1 dia". O Logan confirma no portão. Mudar é uma linha no modelo.
- **Texto novo sem mockup:** a segunda frase sem lote completo (`Lemos os N primeiros por relevância.`) e os zeros parciais. O Logan confirma.
- **`container-type` na seção:** consulta de contêiner no lugar errado quebra a 390 sem aparecer no unitário. O Gio cobre.
- **Fio cliente dentro de componente de servidor:** `FioDeComentario` é `'use client'`. O `Link` do grupo fica no servidor (regra do Next 16, CLAUDE.md). Não passar `Link` como prop.
- **Pacote da IA crescer no canal:** sem `MAX_NA_LISTA`, o pacote leva todos os fios. No teto, são 14 vídeos × 12 fios × (2.000 + 3 × 2.000 caracteres). O teste de tamanho (`contexto-ia-tamanhos.test.ts`, T6b) cobre o canal; o corte é o genérico por linha, com a linha "Por tamanho" dita, nunca em silêncio.

---


## Dívida declarada

- **D1. O canal manda todos os fios escondidos ao cliente** (criada pela T5; antes `MAX_NA_LISTA = 10` limitava o HTML). Típico: 50 fios x 4 falas x ~150 caracteres, cerca de 30 KB (x2, HTML + RSC); teto teórico cerca de 1,3 MB (x2). **Gatilho:** RSC da página do canal acima de **300 KB** numa medição do Gio, ou canal com mais de 100 fios guardados. Conserto: o servidor manda só os 3 visíveis por grupo e o resto sob demanda, ou um teto por grupo com aviso dito.
- **D3.** `RESPOSTAS_VISIVEIS = 3` igual a `creatorRepliesMax = 3`: o botão "Ver as outras N respostas" é inalcançável com dado real; exercitado só por teste sintético (T2). Sai da dívida se a regra subir.
- `AutorDaFala.espectador.n` foi retirado da fase 1 (sem uso); a F2, se aprovada, devolve o campo com o teste.

---

## F2: insumos para a decisão do dono (nenhuma tarefa planejada)

**Status:** não planejada. Esta seção só junta fatos (Phil, `t7-cq-phil.md`, sem leitura de produção) para o dono decidir. Se ele aprovar, nasce um plano próprio, depois da emenda assinada do spec 02.

**O pedido (dono, 17/10 18:35):** só a resposta do criador perde o contexto. Exemplo: Espectador "gostei disso" -> Criador "gostou do quê?" -> Espectador "de x ou y". A fase 1 não piora nada disso.

### Fatos

1. **O que a API devolve:** `replies.comments` traz no máximo 5 respostas, **as 5 mais antigas** (C0.3, 12/10: 100 conversas, 76 parciais). É um prefixo contínuo do fio, sem buraco no meio; o que falta está todo depois da 5ª. O prefixo é estável entre os marcos 1, 7 e 30 (muda só se uma das 5 for apagada). Limite do exemplo do dono: só é atendido quando a resposta do criador está nas posições 1 a 4 e a fala seguinte até a 5ª. Criador que responde depois de 5 pessoas nem é detectado hoje (`criadorRespondeu = null`, `normalizar.ts:97-100`).
2. **Volume, conta refeita** (spec 06 §9.5: 98 vídeos/canal/ano, linha de comentário 580 B, linha de marca 110 B; até 12 fios com o criador por retrato, não 4, porque `creatorMax = 4` só limita o grupo `criador` da seleção; terceiros por fio <= 4):
   - **real (estimativa, não medida): cerca de 0,67 MB por canal por ano** (cerca de 10 MB/ano com 15 canais), metade do que a E14 inteira soma hoje (1,3 MB);
   - teto de contagem sem limite novo: 80 linhas/vídeo, cerca de 7,1 MB por canal por ano (texto médio), 20,6 MB (texto de 2.000 caracteres); com 15 canais, 107 MB/ano;
   - **com um teto por vídeo, `thirdPartyRepliesMax = 20`** (em `COMMENT_RULES` e `rule_params`, aplicado na RPC como o `v_replies_max` do criador): **1,8 MB (texto médio) a 5,2 MB (texto de 2.000) por canal por ano**, **0 unidade de cota**;
   - a conta do 1º rascunho (2,3 MB "no teto") não era nem teto nem real: usava 4 fios, linha média e ignorava as linhas de marca. Contra o plano gratuito (500 MB), o spec 06 já põe 15 canais em cerca de 257 MB no mês 12; o real não muda a data, o teto de contagem sem limite a adianta em meses.
   - Para trocar estimativa por medida, o dono roda: `select count(*) filter (where creator_replied) * 1.0 / count(distinct video_id) from competitor_video_comments where parent_id is null;` (fios com o criador por vídeo).
3. **Cota:** coleta 0 unidade (`api.ts:109` já pede `part=snippet,replies`). A conferência por id nos marcos 7 e 30 **não é 0 sem conserto**: `coletar.ts:221-224` marca como "visto no lote" só o topo e as respostas do criador; toda resposta de terceiro guardada iria para a conferência por id (+2 blocos de 50, estouro de `checkBlocksMax = 3`, `conferencias_nao_feitas > 0`). Com as terceiras marcadas como vistas no lote e o teto de 20, o pior caso fica cerca de 44 ids por vídeo, 1 bloco. A opção 2b (fio inteiro por `comments.list?parentId=`) fica recusada pelo **tempo**, não pela cota: `WORST_SNAP_MS` 40 s -> cerca de 112 s, fim a 297 s, colado no teto da função.
4. **Crítico se a coleta for ligada: a RPC e os leitores.** (a) A RPC (`20261013000003:402-403`) calcula `ja = count(*) where k.parent_id = p.id`, que conta **todos os filhos**: terceiros comeriam o teto de 3 do criador e a resposta do criador que chega no marco 7 deixaria de ser gravada. (b) Os leitores **não filtram `is_creator`** (`leitor.ts:366-370`; `leitor-contagem.ts:117-118`), e com `PAGINA = 1000` e blocos de 150 topos (150 x 3 = 450 hoje; 150 x 7 = 1.050 com terceiros) a leitura vira `cortada`, `ForaDaForma`, e **a lista do canal some** com "não carregou". Conserto: `and k.is_creator` no `ja`; terceiros num CTE próprio com seu teto; `.eq('is_creator', true)` nos dois leitores até a tela existir; o bloco do canal cai para 100 topos; teste de integração com 4 terceiros já guardados e 1 resposta nova do criador.
5. **Numeração do "Espectador N" na própria coleta, sem chave guardada** (alternativa à chave HMAC do 1º rascunho): em todo retrato cada fala vem com `authorChannelId` (no lote ou na conferência por id); a coleta atribui `speaker_no` uma vez (autor do topo = 1; fala nova de quem já falou recebe o número dele; de quem não falou, `max + 1`) e **descarta o id**. Depois do marco 30 nada é relido, então o número congela. Sem segredo novo de ambiente, sem coluna de dado pessoal, sem cron nem invariante novos. Caso imperfeito: fala anterior que não veio nem no lote nem na conferência. Se o dono preferir a chave mesmo assim, ela vai em `competitor_video_comment_authors` (`display_name` e `avatar_url` nulos, `expires_at = first_seen_at + 28 dias`), onde o expurgo e as invariantes já existem. É pseudonimização, não anonimização. A tela não promete "mesma pessoa" depois do dia 28.
6. **Apagar resposta que some.** Hoje a decisão 32 manda comentário que sai do YouTube para a fila "Saíram do YouTube", com o texto guardado até o dono agir; com terceiros, cada resposta apagada viraria item na fila e texto de pessoa comum que ela apagou ficaria guardado. Se a resposta do criador some, as falas de terceiros perdem a finalidade e a invariante "terceiro em fio sem criador" ficaria vermelha para sempre. Recomendação do Phil, para a emenda do spec: fala de terceiro que some é apagada sozinha na mesma execução (fica só o id em `competitor_removed_items`); quando o fio deixa de ter resposta do criador guardada e presente, as falas de terceiros saem na mesma transação; a invariante passa a ser "terceiro em fio sem resposta do criador presente" = 0.
7. **As 4 regras do "k de N"** (a linha "faltam respostas" no fim do fio): (i) `creatorRepliesMax` sobe de 3 para 5 (cabe no prefixo; senão o criador com 4 das 5 primeiras deixa buraco no meio e a frase mente); (ii) k é o que a tela desenha (falas guardadas com `missing_since is null`) e o texto é `Esta conversa tinha ${N} respostas com ${dias(m)}; aqui estão as ${k} mais antigas que guardamos.`, nunca "o YouTube mostrou"; (iii) N vem de `competitor_video_comment_marks.reply_count` do marco da aba (no canal, do último marco com `reply_count` não nulo); quando o topo veio só por conferência por id, `reply_count` é nulo e a frase é `Não sabemos quantas respostas a conversa tinha com ${dias(m)}.`, nunca "k de k"; (iv) N <= k: sem linha; N > k: linha. Um teste de forma: se o prefixo vier fora de ordem de `published_at`, registrar e não afirmar "as mais antigas".
8. **Migration, se aprovada:** o check `parent_id is null or is_creator or speaker_no is not null` aceitaria `speaker_no` em topo ou em resposta do criador; acrescentar `check (speaker_no is null or (parent_id is not null and not is_creator and speaker_no >= 1))`. A invariante `respostas_de_terceiros` é redefinida na **mesma** migration, com a mesma chave no JSON da prova (`gravar.ts:83`), contando terceiro sem `speaker_no`, terceiro em fio sem criador presente e mais de `thirdPartyRepliesMax` por vídeo. Ordem: migration -> conferência (prova verde com 0 terceiros) -> código. Caminho de volta escrito: `delete from competitor_video_comments where parent_id is not null and not is_creator` antes de recolocar o check antigo. Muda decisão escrita: o item 7 do §4.6.3 do spec 02 precisa de emenda assinada pelo dono.
9. **Dado que expira:** depois do marco 30 nada é relido (spec 02 §4.6.7). Cada dia de atraso na coleta: cerca de **4 vídeos por dia** (15 canais x 98 / 365) passam do marco 30 sem as falas de terceiros, para sempre.

### Separar F2-coleta de F2-tela

- **F2-coleta:** emenda assinada do spec 02 §4.6.3 item 7, migration, RPC com os consertos do fato 4, invariante, **sem tela**. Pode ir antes do mockup, o que respeita "coletar mais dado do que usa" (a origem expira, fato 9). **Não pode ir antes da emenda assinada.**
- **F2-tela:** mockup (Logan e Naksu), modelo, "Espectador N", linha de "k de N". A fase 1 já deixa o componente pronto para falas de espectador em `FioView.respostas` (o campo `n` volta nessa hora).

### Conferências com data, se a coleta for aprovada

D+1 do deploy: `select count(*) from competitor_video_comments where parent_id is not null and not is_creator and speaker_no is null;` = 0, e prova da coleta sem `identidade_invariante`. D+8: `numeros.conferencias_nao_feitas = 0` e `unidades` por retrato igual à média dos 7 dias anteriores (+-1); máximo de terceiros por vídeo <= 20. D+30: média medida de linhas de terceiros por vídeo, no lugar da estimativa.

### Para o dono decidir

- **Recomendação (a minha, com a conta corrigida):** aprovar a 2a-restrita (só fios com resposta do criador, as <= 5 que já vêm) como F2-coleta, com `thirdPartyRepliesMax = 20`, numeração na coleta e a regra de apagar do fato 6. Custa 0 unidade e 0,67 MB/ano real (teto 1,8 a 5,2 MB). Preço: a emenda do spec 02. Dizer a ele o limite do exemplo (fato 1).
- **Da Hanna** (a confirmar): entregar a fase 1 agora, sem esperar; a F2-coleta entra como etapa curta logo depois, pelo prazo de expiração.
- **Custo de não fazer:** o fio continua parcial; a fase 1 não piora isso.

---

## Emenda 17/10 (rodada 2): achados de Yannis e Phil -> onde foram resolvidos

Pareceres: `t7-cq-yannis.md`, `t7-cq-phil.md`. Todas as linhas citadas foram conferidas em `~/Workspace/wt-trem7` (`042771ff2`).

| Achado | Resolvido em |
|---|---|
| Yannis I1 (T3+T4 quebra o `tsc` do pacote do vídeo) | T3 Passo 4, T4 (arquivos, testes, commit **T3+T4+T6a**), T6a, inventário `zeros` |
| Yannis I2 (T5 quebra o `tsc` do pacote do canal) | T5 (arquivos, commit **T5+T6b**), T6b: inventário, tabela, `COLUNAS`, `avisosDoCriador` |
| Yannis I3 (contagem: fio sim ou não) | Regras gerais (regra única), T2 e T3 e T4 (testes com `raiz.texto = null` e sentinela) |
| Yannis I4 (`entrouNoDia`, "N respostas", saídos, autores `identidade`/`proprio`/`grande`) | T1 (`marcas`, `meta.respostas`), T2 (um teste por variante de autor), T3, T4 (`cf-saiu`) |
| Yannis I5 (`t6-tela-gio.spec.ts`, grep) | T7 (arquivo e grep ampliado) |
| Yannis M1 (`cd-revelar`) | T4 (apaga listener e atributo) |
| Yannis M2 (ciclo de import) | T1 (`ChaveDeMotivo` em `fio-model.ts`; `autorDaFala` em `model.ts`) |
| Yannis M3 (`n` sem uso) | T1 (campo retirado), Dívida declarada |
| Yannis M4 (variantes de texto) | T3 Passo 1 |
| Yannis M5 (`missing_since` prova o dublê) | T1 Passo 1 |
| Yannis M6 (390 px com nome longo) | T7 |
| Yannis M7 (nome do criador de duas fontes) | T3 (`criador.nome`), T4 |
| Yannis seção 3 (ordem e costura com a decisão 75) | Ordem dos commits e portões; T5 (`EstadoDoBloco`); Regras gerais ("Não carregou" é da D75 T8) |
| Yannis dívida D1 (payload do canal, gatilho RSC > 300 KB) | Dívida declarada |
| Yannis tabela de complexidade (`Map`, sem `find` no laço) | T5 |
| Phil P1 (fuso da data) | Regras gerais (`dmDeData`), T1 (`publicadoEm` nulável), T5 e T6b (teste `01:30Z` -> `16/10`) |
| Phil P2 (uma linha por fio, teste de tamanho, sem "cortar por grupo") | T6b, Riscos |
| Phil P3 (frase da lista uma vez) | T6b |
| Phil P4 (paridade `dd/mm: texto`, mapa de chaves) | T6b |
| Phil (desempate por `id`) | T1 |
| Phil F1 a F7 e conta refeita (F2) | seção F2, fatos 1 a 9 (sem tarefas) |
| "5 mais antigas", não "documentação não garante" | Resposta ao dono, item 5; F2, fato 1 |

