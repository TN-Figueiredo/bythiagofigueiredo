# A5 · Comentários em nível de produção: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Passos com checkbox (`- [ ]`).

**Objetivo:** um componente único `FioDeComentario` desenha o mesmo fio (avatar, autor, meta, texto, respostas do criador) na página do vídeo ("Comentários de destaque") e na página do canal ("O que o criador respondeu"), como no mockup aprovado pelo dono em 17/10.

**Arquitetura:** um modelo puro (`fio-model.ts`) define `FioView` e as falas. As duas telas convertem o próprio dado para `FioView` dentro do modelo que já têm (`secaoDeComentarios`, `listaDoCriador`), e o componente cliente `fio.tsx` desenha. O pacote "Perguntar a uma IA" continua lendo os mesmos modelos, então o texto dele acompanha a tela. **Fase 1 não muda banco, coleta nem cota.** A fase 2 (fio completo, com respostas de outras pessoas) fica desligada, como decisão do dono (seção F2).

**Stack:** Next 16 / React 19, CSS do `[data-obs]`, Vitest (jsdom para componente), Playwright (Gio).

**Base:** mockup `docs/superpowers/mockups/2026-10-17-comentarios-producao/` (`video.html`, `canal.html`, `fio.css`, `RODADA-2.md`; variante **B**). Pareceres em `.superpowers/sdd/a5/noite/`: `t7-ch-logan.md`, `t7-ch-naksu.md`, `t7-cj-logan.md`, `t7-cj-naksu.md`, `t7-c2-phil.md`. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/02-comentarios-de-destaque.md` (§4.6.3). Código de referência: `~/Workspace/wt-trem7` (trem 7, com o conserto C2 do Phil já em `9f6935b67`).

Caminho curto usado abaixo: `C = apps/web/src/app/cms/(authed)/youtube/competitors`, `T = apps/web/test/youtube/observatorio`, `L = apps/web/src/lib/youtube/observatorio/comentarios`.

---

## Resposta à pergunta do dono: as respostas de outras pessoas são guardadas hoje?

**Não.** Nenhuma resposta de quem não é o criador tem o texto guardado, **nem a do autor do comentário original**. Evidência (código e esquema; sem leitura de produção):

1. **Spec 02, §4.6.3 item 7:** "até 3 respostas **do criador** naquela conversa [...]. **Nenhuma resposta de outra pessoa é gravada.**"
2. **Coleta, `L/normalizar.ts:77-109`:** lê `replies.comments` de cada fio, mas só fica com as respostas cujo `authorChannelId` é o canal do vídeo (`doCriadorTodas`), cortadas em `COMMENT_RULES.creatorRepliesMax = 3`. Das outras respostas, só os ids de canal saem (`canaisNasRespostas`), usados em `L/destaque.ts:81` para o motivo "canal que você acompanha", e não são gravados.
3. **Esquema, `supabase/migrations/20261013000003_observatorio_a5_e14_comentarios_destaque.sql:85`:** `constraint competitor_video_comments_reply_check check (parent_id is null or is_creator)`. O comentário da coluna (:92) diz: "o check impede resposta de outra pessoa".
4. **Invariante `respostas_de_terceiros`** (`L/prova.ts:19,91,95`, `L/gravar.ts:83,116`, função da migration :609): conta linha de resposta que não é do criador. Hoje, se aparecer uma, a prova da coleta fica vermelha.
5. **Quantas respostas a API devolve por fio:** `commentThreads.list?part=snippet,replies` (`L/api.ts:109`) traz no máximo **5** respostas por fio (`RESPOSTAS_QUE_O_YOUTUBE_MOSTRA = 5`, `C/_chrome/comentarios/frases.ts:5`), e a documentação não garante **quais** 5. Para ter o fio inteiro é preciso `comments.list?part=snippet&parentId=<id>&maxResults=100`: **1 unidade por página, por fio** (spec 02, tabela 4.6.1, linhas 2 e 6). O `totalReplyCount` (o total do fio) já é guardado por marco em `competitor_video_comment_marks.reply_count`.

O custo de passar a guardar e o desenho do "fio completo" estão na seção **F2**, fora da fase 1.

---

## Regras gerais (valem para toda tarefa)

- Texto de terceiros é sempre nó de texto React com `dir="auto"`. Nunca HTML, nunca link. Endereço dentro do texto continua texto.
- Nome, foto e id de canal do espectador **nunca** aparecem, com uma exceção: o nível `identidade` (quem edita, nos 28 dias), que segue a regra atual. O criador aparece com nome e foto porque o canal é público.
- Cores com hex ou `rgba` literal. **Nunca `color-mix()`.** Sem z-index numérico. Fonte mínima de 12 px. Todo alvo de toque com pelo menos 44 px.
- Token novo, em `[data-obs]`: `--cf-criador: var(--lado-b)`; `--cf-criador-bg: rgba(124,200,248,.10)` (escuro) e `rgba(11,107,168,.08)` (`[data-theme="light"] [data-obs]`). O espectador é neutro e não tem cor.
- Um nome por conceito. O selo é **"Criador"** (maiúscula inicial). O motivo, na legenda, é "com o criador na conversa". O espectador é **"Espectador"**, nunca "Um espectador" nem "?". O verbo de recolher é sempre **"Recolher"**. A imagem do vídeo se chama **"thumbnail"** em qualquer texto (decisão do trem 7, `234bb3f57`). A palavra "miniatura" do mockup não vai para produção.
- Nunca escrever "não respondeu" onde não vimos resposta.
- Nível `contagem`: o fio não é desenhado (não existe texto). As frases de contagem continuam como hoje.
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
| `L/leitor-tipos.ts`, `L/leitor.ts`, `L/leitor-contagem.ts` | as respostas do criador passam a trazer a data. No canal: até 3 respostas por fio e a data do topo | 1 |
| `C/_chrome/comentarios/fio-model.ts` (novo) | tipos `FioView`/`FalaView` e funções puras de texto (autor, meta) | 1 |
| `C/_chrome/comentarios/fio.tsx` (novo, `'use client'`) | `FioDeComentario`, `AvatarDoAutor`, `TextoDaFala` | 2 |
| `C/_chrome/comentarios/fio.css` (novo) | prefixo `cf-`, tokens `--cf-criador*` | 2 |
| `C/_chrome/comentarios/model.ts`, `frases.ts` | frase-resumo, legenda só com o que existe, curtidas do marco, `fio` no cartão; sai `casas` | 3 |
| `C/_chrome/comentarios/cartao.tsx`, `lista.tsx`, `secao.tsx`, `comentarios.css`; apaga `fileira.tsx` | a tela do vídeo usa o fio | 4 |
| `C/_historico/comentarios-de-destaque.tsx`, `C/_historico/medidas/blocos-do-video.tsx` | passam `criador` (foto do canal) | 4 |
| `C/_canal/medidas/criador-lista-model.ts`, `criador-model.ts`, `criador-responde.tsx`, `grupo-do-criador.tsx` (novo, `'use client'`), `canal-medidas.css`, `contexto-do-canal.ts`, `criador-do-canal.ts`, `blocos-do-canal.tsx` | grupo por vídeo, fio único, frase na ordem do mockup; saem `.pc-cm*` e `.chip own` | 5 |
| `C/_contexto-ia/empacotar-video-comentarios.ts`, `empacotar-canal-medidas.ts`, `apps/web/src/lib/youtube/observatorio/contexto-ia/tipos.ts` | o pacote da IA acompanha o texto da tela | 6 |
| `apps/web/e2e/tests/cms/observatorio/e5a-comentarios*.spec.ts`, `canal.spec.ts`, `allowances.ts` | e2e do Gio | 7 |

---

### Tarefa 1: leitores com data e o modelo do fio

**Arquivos:**
- Modificar: `L/leitor-tipos.ts` (`RespostaDoCriadorVista`, `RespostaDoCriador`), `L/leitor.ts:207-210,362-372`, `L/leitor-contagem.ts:100-150`
- Criar: `C/_chrome/comentarios/fio-model.ts`
- Teste: `T/comentarios-e5-ler.test.ts`, `T/comentarios-e5-ler-contagem.test.ts`, `T/comentarios-fio-model.test.ts` (novo)

**Interfaces:**
- Produz (leitor):
  - `RespostaDoCriadorVista { texto: string; cortado: boolean; publicadoEm: string }` (ISO; `leitor.ts` já seleciona `published_at`).
  - `RespostaDoCriador` (canal) troca `respostaTexto/respostaCortada` por `respostas: Array<{ texto: string; cortado: boolean; publicadoEm: string }>` (até `COMMENT_RULES.creatorRepliesMax`, da mais antiga para a mais nova, sem `missing_since`) e ganha `publicadoEm: string` (do topo; acrescentar `published_at` ao select dos topos). Cada texto passa por `semMencoes`, e `mencoesTrocadas` soma todas.
- Produz (`fio-model.ts`):
```ts
export interface CriadorDoFio { nome: string; avatar: string | null; ini: string; color: string }
export type AutorDaFala =
  | { tipo: 'espectador'; n: number | null }            // n sempre null na fase 1 (reservado para a F2)
  | { tipo: 'criador' }                                  // nome e foto vêm de CriadorDoFio
  | { tipo: 'identidade'; nome: string; fotoUrl: string | null; ate: string }
  | { tipo: 'proprio' } | { tipo: 'grande'; faixa: string | null } | { tipo: 'reservado' }
export interface FalaView { autor: AutorDaFala; data: string | null /* dd/mm */; texto: string | null; cortado: boolean }
export interface FioView {
  id: string
  raiz: FalaView
  respostas: FalaView[]                 // só do criador na fase 1
  respostaReservada: string | null      // "O criador respondeu. O texto da resposta é reservado."
  meta: { curtidas: string | null; regua: number | null /* 0..100 */; posicao: string | null /* "1 de 12" */ }
  pastilha: { chave: ChaveDeMotivo; texto: string } | null
}
export const RESPOSTAS_VISIVEIS = 3
export function rotuloDoAutor(a: AutorDaFala, criador: CriadorDoFio): string
export function autorDaFala(a: AutorView): AutorDaFala   // AutorView de model.ts: 'criador' perde o nome (vem de CriadorDoFio)
```

- [ ] **Passo 1: testes que falham.**
  - `comentarios-e5-ler.test.ts`: `respostasDoCriador[0].publicadoEm` é o ISO do `published_at` da linha filha falsa, e a ordem continua da mais antiga para a mais nova.
  - `comentarios-e5-ler-contagem.test.ts`: um topo com 3 filhas e uma com `missing_since` devolve `respostas.length === 2`, em ordem de `published_at`. `publicadoEm` do topo vem preenchido. `mencoesTrocadas` soma o topo e as duas respostas.
  - `comentarios-fio-model.test.ts`: `rotuloDoAutor({tipo:'espectador',n:null}) === 'Espectador'`; `rotuloDoAutor({tipo:'espectador',n:2}) === 'Espectador 2'`; `rotuloDoAutor({tipo:'criador'}, {nome:'Matheus Fonseca',...}) === 'Matheus Fonseca'`; `autorDaFala({tipo:'criador',nome:'X'})` devolve `{tipo:'criador'}`.
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
- Produz: `export function FioDeComentario(p: { v: FioView; criador: CriadorDoFio; densidade: 'cartao' | 'lista'; escondido?: boolean; extra?: React.ReactNode }): JSX.Element`, num `<li id={v.id} tabIndex={-1}>`. O `extra` é o encaixe do vídeo: avisos de corte e endereço, "Saiu do YouTube", degraus de canal grande, "não vimos / não sabemos".

Estrutura (copiada do mockup `fio.css`, variante B): grade `32px 1fr`, `column-gap:12px`. Linha 1: avatar | autor (600 13.5px) · selo · pastilha · meta (12.5px `--muted`, `tabular-nums`) · posição à direita (`.cf-meta.push`). Linha 2: texto (14px/21px, corte em 4 linhas, "Ver tudo"/"Recolher"). Respostas recuadas 44 px, avatar 24 px, balão `--cf-criador-bg`, filete `3px solid var(--cf-criador)`. A ≤480 px (`@container`, com `container-type:inline-size` no contêiner da seção, não na página): avatar 28 px, resposta em largura total, `.cf-meta.push{order:1}` e `.cf-meta:not(.push){order:2;flex-basis:100%}` (sugestão da Naksu, rodada 2).

- [ ] **Passo 1: testes que falham** (`comentarios-fio.test.tsx`):
  - espectador: há um `svg` dentro de `.cf-av` com `aria-hidden="true"`, e o texto "Espectador" aparece; não existe "?" nem `<img>`.
  - criador com `avatar`: `ChannelAvatar` desenha `img[alt=""]` dentro de `.cf-av.cri`; o selo `.cf-selo` tem o texto exato `Criador`.
  - criador com `avatar: null`: `[data-avatar="ini"]` com `ini`. Disparar `error` no `<img>` leva a `data-avatar="ini"` (Foco 1).
  - 5 respostas sintéticas: 3 visíveis, e o botão "Ver as outras 2 respostas do criador" tem `aria-expanded="false"`; clicar mostra as 5 e o rótulo vira "Recolher"; o foco continua no botão (Foco 2).
  - texto com `<b>x</b>` aparece como texto literal; nenhum `a[href]` dentro de `.cf-txt`.
  - `respostaReservada` aparece no lugar das respostas.
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
  - sem resposta vista: `frase.negrito` começa com `Não vimos resposta do criador`; nenhum texto do modelo contém "não respondeu".
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar. Apagar `CasaView`, `CASAS` e `rotuloDaCasa`.
- [ ] **Passo 4:** PASS, e `npx vitest run T/comentarios-e5 > /tmp/t3.txt 2>&1; grep -E 'FAIL' /tmp/t3.txt` (os testes de tela quebram até a T4, e isso é esperado; anotar quais).
- [ ] **Passo 5: commit junto com a Tarefa 4** (o modelo sem a tela não compila no `lista.tsx`). Mensagem na T4.

### Tarefa 4: tela do vídeo com o fio

**Arquivos:**
- Modificar: `C/_chrome/comentarios/cartao.tsx` (vira um envoltório fino de `FioDeComentario`, com o `extra`), `lista.tsx` (sem `Fileira`; barra fina na linha da frase, `.resumo-linha`; legenda numa linha; `zeros` apagado; movimento no rodapé), `secao.tsx` (`criador` como prop), `comentarios.css` (apagar `.cd-casa*`, `.cd-fileira`, `.cd-cur*`, `.cd-selo-c`, `.cd-foto*`, `.cd-autor`, `.cd-resp*`, `.cd-cartao-h`, `.cd-etq`; manter abas, estados, `.cd-link`, título e ⓘ)
- Apagar: `C/_chrome/comentarios/fileira.tsx`
- Modificar: `C/_historico/comentarios-de-destaque.tsx` (prop `criador: CriadorDoFio`), `C/_historico/medidas/blocos-do-video.tsx:78-80` (passa `criador` de `p.view.chan`: `{ nome: chan.name, avatar: chan.avatar, ini: chan.ini, color: chan.color }`)
- Teste: `T/comentarios-e5-pecas.test.tsx`, `T/historico-e5-comentarios.test.tsx`, `T/comentarios-e5-saida.test.tsx`

**Interfaces:**
- Consome: T2 e T3.
- Produz: `SecaoDeComentarios({ v, criador, hrefFilaSaiu })`.

- [ ] **Passo 1: testes que falham:**
  - `comentarios-e5-pecas`: não existe `.cd-fileira` nem `.cd-casa`; existe `.cf` × 12, com 5 visíveis; o botão `Ver as outras 7` alterna para `Recolher`, e o foco vai para o 6º fio; a frase-resumo vem antes das abas no DOM; `.cf-selo` aparece 4 vezes (as respostas).
  - `historico-e5-comentarios`: a foto do canal (`h.chan.avatar`) chega ao `img` da resposta.
  - `comentarios-e5-saida` (o teste de saída que já existe): o nome-sentinela do espectador vencido continua fora do HTML e do RSC. A silhueta não leva nome.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run T/comentarios-e5 T/historico-e5-comentarios > /tmp/t4.txt 2>&1; grep -E 'FAIL|Tests ' /tmp/t4.txt`, mais o typecheck da web. Esperado: PASS e 0 erros.
- [ ] **Passo 5: commit (T3+T4)** `feat: Comentários de destaque com fio único, frase-resumo antes das abas, legenda só do que existe e sem a fileira de casas (comentários em produção, T3-T4)`.

### Tarefa 5: canal, "O que o criador respondeu", agrupado por vídeo

**Arquivos:**
- Modificar: `C/_canal/medidas/criador-lista-model.ts`, `criador-model.ts` (só a frase de `nao_medido`), `criador-responde.tsx`, `canal-medidas.css` (apagar as linhas 257-263, de `.pc-cm` a `.pc-cma`, e `.pc-cmv a` da :323), `criador-do-canal.ts`, `C/_canal/medidas/contexto-do-canal.ts` (`thumbs` e `criador`), `blocos-do-canal.tsx:105`
- Criar: `C/_canal/medidas/grupo-do-criador.tsx` (`'use client'`: o botão "Ver as outras N deste vídeo")
- Teste: `T/medidas-canal-criador.test.tsx`, `T/medidas-canal-criador-leitura.test.ts`

**Interfaces:**
- Consome: `RespostaDoCriador.respostas/publicadoEm` (T1), `FioDeComentario`, `FioView` (T2).
- Produz:
```ts
export const VISIVEIS_POR_GRUPO = 3
export interface GrupoDoCriador { videoId: string; titulo: string; thumb: string | null; respostasDele: string /* "12 respostas dele" */; fios: FioView[] }
// ModeloDaLista 'itens': { tipo:'itens'; total; nVideos; frase:{negrito,resto}; grupos: GrupoDoCriador[] }   (saem itens, aMais, subtitulo, MAX_NA_LISTA)
```
  - `ContextoDoCanal` ganha `thumbs: ReadonlyArray<readonly [string, string | null]>` (de `view.videos.videos`: `ytId` → `https://i.ytimg.com/vi/${encodeURIComponent(ytId)}/mqdefault.jpg`, como em `_canais/view-model.ts:327`) e `criador: CriadorDoFio` (de `CanalHeaderView`: `name`, `avatar`, `ini`, `color`). `CriadorResponde` recebe `criador`.
  - Fio do canal: `raiz = { autor:{tipo:'espectador',n:null}, data: dm(publicadoEm), texto, cortado }`; `respostas` = as do criador com data; `meta.curtidas` = `${num(c)} no retrato de ${marco} dias` (marco 1: `${num(c)} com 1 dia`); `meta.regua = null`; `posicao = null`; `pastilha = null`.
  - Grupos do vídeo mais novo para o mais velho (a ordem atual por `baseDaIdade`). Dentro do grupo, a ordem é a da leitura.

Texto exato (mockup `canal.html`):
- Frase da lista, em negrito, **antes** da régua: `${nome} respondeu a ${ptn(total,'comentário guardado','comentários guardados')}, em ${ptn(nVideos,'vídeo','vídeos')}.` (sai " O vídeo mais recente primeiro." e sai "com retrato de 30 dias").
- Frase do bloco `nao_medido` com fecha-em (`criador-model.ts:199`): sem o negrito "Ainda não dá para medir."; o texto vira `Só ${nBase} dos ${total} vídeos dos últimos ${janela} dias ${já tem|já têm} o retrato de 30 dias; o primeiro dos outros fecha em ${dm}. Quanto ele responde por vídeo ainda não é medido.`, com a pastilha "não medido" **logo depois da frase**, não no `.pc-sh`. As outras variantes de `nao_medido` mantêm o texto e só mudam o lugar da pastilha.
- Ordem da seção: título + ⓘ (sem pastilha) → frase da lista → frase do bloco + pastilha → régua → grupos.
- Cabeçalho do grupo: thumbnail 64×36 (`width`/`height` declarados, `loading="lazy"`, `alt=""`, fundo `--surface-2`; sem `ytId`, só o fundo) + título com `-webkit-line-clamp:2` dentro do `Link` para o Histórico (alvo de 44 px; o `Link` fica no componente de servidor, nunca vira prop do cliente) + `${n} ${n===1?'resposta dele':'respostas dele'}`.
- Botão: `Ver as outras ${n} deste vídeo` / `Recolher`. O foco vai para o 4º fio ao abrir e volta ao botão ao recolher.

- [ ] **Passo 1: testes que falham:**
  - `medidas-canal-criador`: com 12 respostas num vídeo, 1 grupo, 3 `.cf` visíveis, o botão "Ver as outras 9 deste vídeo"; não existem `.pc-cm`, `.pc-cma` nem `.chip`; "Espectador" aparece e "?" não; `.cf-selo` com o texto "Criador"; o título do vídeo aparece **1** vez; a pastilha "não medido" não está dentro de `.pc-sh`; a frase da lista vem antes de `.pc-rqs` no DOM.
  - vídeo sem título e sem `ytId` (Foco 4): o grupo mostra "(sem título)" e nenhum `img` de thumbnail.
  - a frase do bloco do caso 1/6/7/14 continua citando só números da legenda (o teste do CM item 3 continua verde).
  - `medidas-canal-criador-leitura`: com 2 vídeos, os grupos vêm em ordem de idade; `respostasDele` usa singular e plural certos.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run T/medidas-canal T/canal > /tmp/t5.txt 2>&1; grep -E 'FAIL|Tests ' /tmp/t5.txt` + typecheck.
- [ ] **Passo 5: commit** `feat: O que o criador respondeu agrupado por vídeo com o fio único, frase do que há antes da taxa não medida; saem .pc-cm e o chip com cursor (comentários em produção, T5)`.

### Tarefa 6: pacote "Perguntar a uma IA" com o mesmo texto

**Arquivos:**
- Modificar: `C/_contexto-ia/empacotar-video-comentarios.ts`, `C/_contexto-ia/empacotar-canal-medidas.ts:96-104,212-224`
- Teste: `T/contexto-ia-video-comentarios.test.tsx`, `T/contexto-ia-canal-medidas.test.tsx`, `T/contexto-ia-varredura-de-codigo.test.ts`, `T/contexto-ia-varredura-de-saida.test.ts`

**Interfaces:**
- Vídeo: `listas[].frase` = `negrito + ' ' + resto` (o texto da tela); `listas[].barra` = `"12 de 132"`; `listas[].legenda` = só os presentes, mais `zeros` (campo novo `zeros: string | null`). `Comentario.respostaDoCriador.texto` junta as respostas, cada uma com a data: `dd/mm: texto`. `Comentario` mantém os campos atuais (sem autor nenhum).
- Canal: `ListaDoCriadorIa` troca `itens`, `aMais` e `subtitulo` por `grupos: Array<{ titulo: string; respostasDele: string; fios: Array<{ data: string | null; curtidas: string | null; texto: string; respostas: string[] }> }>`. O pacote leva **todos** os fios (a tela esconde, o pacote não corta). Apagar `MAIS_RESPOSTAS`. `CriadorIa.frase` = a frase da lista seguida da frase do bloco, na ordem da tela.
- **Allowance:** os empacotadores **não** importam `fio-model.ts` (ele não tem `'use client'`, mas também não é preciso). O `PERMITIDOS` de `contexto-ia-varredura-de-codigo.test.ts` fica igual. Se o executor precisar importar `fio-model`, acrescentar `'../_chrome/comentarios/fio-model'` ao `PERMITIDOS`, com a razão na linha.

- [ ] **Passo 1: testes que falham:**
  - vídeo: a frase do pacote é igual, caractere por caractere, a `negrito + ' ' + resto` do modelo da tela, na fixture `tipico`; nenhuma string do pacote contém "Um espectador", "(todos)" nem "não respondeu".
  - canal: com 12 respostas, `grupos[0].fios.length === 12`; nenhuma string contém "não cabem".
  - varredura de saída: o nome-sentinela continua ausente.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run T/contexto-ia > /tmp/t6.txt 2>&1; grep -E 'FAIL|Tests ' /tmp/t6.txt`. Esperado: PASS.
- [ ] **Passo 5: commit** `feat: pacote da IA com a frase, a legenda e os grupos do fio único, mesmo texto da tela (comentários em produção, T6)`.

### Tarefa 7: e2e do Gio, oráculo e allowances

**Arquivos:**
- Modificar: `apps/web/e2e/tests/cms/observatorio/e5a-comentarios.spec.ts`, `e5a-comentarios-alvos.spec.ts`, `canal.spec.ts` (se citar `.pc-cm` ou o texto antigo), `allowances.ts` (entradas que citem "Um espectador", "Mostrar menos", "Mostrar os outros", "(todos)", "Com o criador", "não cabem")
- Varredura obrigatória antes: `grep -rn "Um espectador\|Mostrar menos\|Mostrar os outros\|(todos)\|Com o criador\|não cabem\|cd-casa\|cd-fileira\|pc-cm\|chip own" apps/web/e2e apps/web/test apps/web/src`. Todo acerto ou muda nesta tarefa ou já mudou antes. As fixtures do oráculo (`apps/web/test/fixtures/observatorio/dados.cjs`, `dados-teste.html`) só mudam se citarem esses textos da seção de comentários (o oráculo do Observatório não desenha esta seção; conferir com o grep).

- [ ] **Passo 1: specs novos ou ajustados (o Gio escreve):**
  - `e5a-comentarios-alvos`, para cada combinação de {390, 600, 1440} × {escuro, claro}: sem rolagem horizontal (`scrollWidth <= clientWidth`); `.cf-link`, `.aba` e `.info` com pelo menos 44 px; nenhuma fonte abaixo de 12 px dentro de `.cf`; a 390, "N de 12" na linha do nome (o `top` do `.cf-meta.push` igual ao do `.cf-nome`); a resposta continua distinta (fundo `--cf-criador-bg`).
  - Teclado: Tab chega a "Ver tudo", "Ver as outras 7" e "Recolher"; Enter alterna; o foco fica no lugar.
  - Leitor de tela: avatares com `aria-hidden`; "Espectador" e "Criador" lidos como texto.
  - Canal: um grupo, o título do vídeo uma vez só, o botão "Ver as outras N deste vídeo".
  - Privacidade (já existe, ajustar seletores): o reporter não recebe texto nem nome em HTML, DOM ou RSC.
  - Opera: o Gio confere a cor `--cf-criador` (sem `color-mix`; ver `reference_colormix_renders_transparent`).
- [ ] **Passo 2:** rodar com o servidor local (runbook `docs/ops/runbook-cms-e2e-local.md`), com a saída em arquivo e só as falhas no contexto.
- [ ] **Passo 3: commit** `test: e2e do fio único nos comentários do vídeo e do canal, 390/600/1440 e dois temas (comentários em produção, T7)`.

---

## Ordem dos commits e portões

1. T1 → T2 → (T3+T4) → T5 → T6 → T7, um commit por item, por caminho explícito.
2. Antes do push: `npx vitest run > /tmp/suite.txt 2>&1` (cerca de 160 s, em segundo plano) e só as falhas no contexto; typecheck da web e da API.
3. Portão Phil e Yannis no fim do lote: Phil olha a T1 (leitor e volume das 3 respostas no canal) e a T6 (saída); Yannis olha o lote todo.
4. O Gio confere no navegador (T7) antes de ir ao dono.

## Riscos

- **Divergência do mockup, com dado real:** o mockup mostra 5 respostas do criador e "Ver as outras 4", mas o banco guarda até 3 (`creatorRepliesMax`). A tela real nunca mostra esse botão. Não é defeito; o Gio não deve procurá-lo com dado real.
- **Base da régua:** este plano decide "o mais curtido da lista do painel". A nota do RODADA-2 dizia "marco de 1 dia". O Logan confirma no portão. Mudar é uma linha no modelo.
- **Texto novo sem mockup:** a segunda frase sem lote completo (`Lemos os N primeiros por relevância.`) e os zeros parciais. O Logan confirma.
- **`container-type` na seção:** consulta de contêiner no lugar errado quebra a 390 sem aparecer no unitário. O Gio cobre.
- **Fio cliente dentro de componente de servidor:** `FioDeComentario` é `'use client'`. O `Link` do grupo fica no servidor (regra do Next 16, CLAUDE.md). Não passar `Link` como prop.
- **Pacote da IA crescer no canal:** sem `MAX_NA_LISTA`, o pacote leva todos os fios. No teto, são 14 vídeos × 12 fios × (2.000 + 3 × 2.000 caracteres). O teste de tamanho do pacote (CM item 2) precisa de um caso do canal; se passar do teto, cortar por grupo **com aviso dito**, nunca em silêncio.

---

## F2 (desligada; decisão do dono): o "fio completo", com respostas de outras pessoas

**O pedido (dono, 17/10 18:35):** só a resposta do criador perde o contexto. Exemplo: Espectador "gostei disso" → Criador "gostou do quê?" → Espectador "de x ou y". Sem a terceira fala, a resposta do criador não faz sentido.

**Hoje:** não é guardado (ver a resposta do topo). A fase 1 já deixa o componente pronto: `AutorDaFala.espectador.n` e `FioView.respostas` aceitam falas de espectador. A F2 não reescreve a tela; muda a coleta, o banco e o modelo.

### Desenho na tela

- O fio em **ordem cronológica**: raiz e depois todas as respostas guardadas, criador e espectadores misturados na ordem em que foram escritas.
- Espectadores **numerados dentro do fio**: "Espectador 1" é quem abriu; "Espectador 2", "Espectador 3"… na ordem da primeira fala; a mesma pessoa tem sempre o mesmo número. Sem nome, sem foto: silhueta e balão neutro, com o mesmo recuo do criador. O número só aparece quando o fio tem fala de mais de um espectador ou do próprio autor respondendo. Num fio só com o criador, continua "Espectador".
- O criador continua com foto, selo "Criador" e balão `--cf-criador-bg`.
- Limite visível: as 3 primeiras respostas, depois "Ver as outras N" (mesmo botão, mesmo foco).
- Fio incompleto: quando `reply_count` é maior que as guardadas, uma linha apagada no fim: `O YouTube mostrou ${k} das ${total} respostas.` Nunca dar a entender que o fio acabou.
- Muda no mockup aprovado: falas de espectador dentro das respostas, os rótulos numerados e a linha de fio incompleto. **Precisa de uma rodada de mockup (Logan e Naksu) antes do código.** A página do canal ganha o mesmo fio.

### Custo de dado

Três opções, da mais barata para a mais cara:

| Opção | Cota da API | Linhas novas | Outro custo |
|---|---|---|---|
| **2a-restrita (recomendada):** só nos fios **com resposta do criador**, só as ≤5 respostas que o `commentThreads` já traz | **0 unidade** (já vem na chamada atual) | até 4 fios × 5 = **20 por retrato**; a resposta já vista não repete entre marcos | a ordem cronológica pode ter buraco quando o fio passa de 5 (a linha "mostrou k de N" diz) |
| 2a-larga: os 12 fios, ≤5 respostas cada | 0 unidade | até 60 por retrato | volume 3× o da restrita, para fios sem o criador, que não respondem à pergunta do dono |
| 2b: o fio inteiro, por `comments.list?parentId=` | +1 unidade por fio com mais de 5 respostas: **até +12 por retrato** (hoje são 1 a 2) | sem teto prático | quebra o orçamento acoplado: `callsPerSnapMax` 5 → 17; `WORST_SNAP_MS` 40 s → cerca de 112 s; `lastSnapStartsByMs`, `callsMax = 60` e o teto do cron precisam ser refeitos. **Não recomendo.** |

**Volume no teto da 2a-restrita:** 20 linhas × 3 marcos, sem repetição, é no máximo cerca de 40 por vídeo. Com cerca de 580 B por linha (spec 06, §9), dá cerca de 23 KB por vídeo; 98 vídeos por canal por ano dão cerca de **2,3 MB por canal por ano** no teto. Com 15 canais, cerca de 34 MB por ano no teto; o real é bem menor, porque a maioria dos fios tem menos de 5 respostas e menos de 4 fios têm o criador. É uma conta de teto, não uma medida. O Phil refaz a conta com o volume real (`select count(*)` dos fios com `creator_replied` por vídeo, que o dono roda).

**Retenção:** igual à do comentário. A resposta é filha por `parent_id ... on delete cascade` e vai embora com o topo, no mesmo ciclo (spec 06) e na mesma anulação por `missing_since`.

**LGPD:**
- Guardar só o **texto** e o **número do orador no fio** (`speaker_no smallint`). Nunca nome, foto nem `authorChannelId` do espectador. É menos do que o comentário de topo guarda hoje (que tem identidade por 28 dias).
- Para a mesma pessoa manter o número entre marcos (1, 7 e 30 dias), a coleta precisa reconhecê-la depois. Proposta: `speaker_key = HMAC-SHA256(segredo, youtube_comment_id_do_topo || authorChannelId)`, que só serve dentro daquele fio, **apagada aos 28 dias** junto com a identidade (o mesmo cron). Depois disso, o número fica congelado; o marco 30 (dias 30 a 37) já passa dos 28 dias, então uma fala nova no marco 30 ganha número novo, e um espectador que voltou pode aparecer com dois números. A tela não promete "mesma pessoa" depois do dia 28 (o ⓘ diz isso). Alternativa sem chave nenhuma: numerar só dentro de cada retrato, o que é mais simples, mas o número pode mudar entre as abas.
- É pseudonimização, não anonimização (o mesmo limite do risco 19 do spec 02). Texto de terceiro pode citar nomes: `semMencoes` já troca @menções na leitura. Nome escrito por extenso fica, como no topo hoje.
- Muda decisão escrita: o item 7 do §4.6.3 do spec 02 ("nenhuma resposta de outra pessoa é gravada") precisa de emenda assinada pelo dono.

**Mudanças técnicas (só se o dono aprovar):** migration por `npm run db:new` que troca o check `competitor_video_comments_reply_check` por `parent_id is null or is_creator or speaker_no is not null`; colunas `speaker_no smallint` e `speaker_key text` (esta com `null` aos 28 dias); RPC de gravação (:402-414) sem o corte de 3 para as falas de terceiros (o corte de 3 do criador continua); invariante `respostas_de_terceiros` redefinida como "resposta de terceiro em fio **sem** resposta do criador" ou "com `speaker_key` passados 28 dias"; `normalizar.ts` mantém `respostasDeTerceiros` (≤5) só quando `criadorRespondeu === true`; leitor e modelo passam a preencher `AutorDaFala.espectador.n`; o pacote da IA leva as falas com "Espectador N" (sem nome). Portões: spec emendado → Phil e Yannis → plano da F2 → mockup → código.

### Recomendação para o dono

- **Minha:** aprovar a **2a-restrita** como F2, depois da fase 1. Custa 0 unidade de cota e cerca de 2 MB por canal por ano no teto, e responde exatamente ao exemplo dele (o contexto em volta da resposta do criador). O preço é a emenda do spec 02 e uma chave de 28 dias.
- **Da Hanna** (a confirmar com ela no fecho do plano): entregar a fase 1 agora, sem esperar a F2, porque ela não depende de dado novo e tira as fricções que o dono já viu. A F2 entra como próxima etapa curta, com a coleta ligada logo (dado que a origem expira: fala que sai do YouTube não volta). Isso segue a regra "coletar mais dado do que usa".
- **Custo de não fazer:** o fio continua parcial e o dono lê respostas do criador sem a pergunta que as gerou. A fase 1 não piora isso.
