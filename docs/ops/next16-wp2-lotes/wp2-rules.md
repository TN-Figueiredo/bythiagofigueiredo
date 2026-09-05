> Cópia da seção WP-2 do plano `docs/superpowers/plans/2026-09-04-next16-ecosystem-validation.md`, congelada em 2026-09-04 como a fonte normativa que as fichas `lote-2.*.md` citam.

## WP-2 — `revalidateTag`: 171 chamadas, 44 arquivos, 6 lotes

**Roda DEPOIS do WP-3, dentro do worktree.** A sintaxe de dois argumentos e o `updateTag`
só existem a partir do Next 16 — verificado contra o pacote instalado, não contra a
documentação. Tentar antes produz `TS2554` e `TS2305`.

**A classificação é o trabalho; a sintaxe é trivial.** Três destinos:

| Contexto | Destino | Motivo |
|---|---|---|
| Server Action do CMS, disparada por formulário | `updateTag(tag)` | o usuário salvou e precisa ver agora |
| Route Handler, cron, webhook | `revalidateTag(tag, { expire: 0 })` | `updateTag` não roda aqui; `{expire:0}` preserva o comportamento de hoje |
| Artefato lido só por crawler, **com leitor medido** | `revalidateTag(tag, 'max')` | atraso aceitável, ganha stale-while-revalidate — hoje o grep não acha tag nessa condição; `sitemap:*`/`og:*` parecem ser, mas não têm leitor |

**Perfis embutidos reais** (não inventar outros): `default`, `seconds`, `minutes`, `hours`, `days`, `weeks`, `max`.

**Precedência — a regra canônica do WP-2.** Tudo o que vem depois nesta seção ("regra de
desempate", "generalização", "quarto caso", tabela de leitores) é **esta mesma regra
aplicada a um caso**, não uma regra nova. Em dúvida entre formulações, vale esta. As duas
metades decidem coisas diferentes, e nunca conflitam. Elas parecem
brigar quando uma tag nomeada aparece num Route Handler; não brigam, porque respondem a
perguntas distintas:

> **O contexto de execução decide a FUNÇÃO.** Server Action → `updateTag` é permitido.
> Qualquer outro contexto (Route Handler, cron, webhook) → `revalidateTag`, sempre;
> `updateTag` fora de Server Action é erro de runtime que o `tsc` não pega.
>
> **O leitor do dado decide o PERFIL.** Uma vez que você está em `revalidateTag`, quem
> escolhe entre `{ expire: 0 }`, `'seconds'`, `'minutes'` e `'max'` é quem lê a tag — nunca
> onde a chamada mora.

**Como achar o leitor** — a regra acima não vale nada sem isto:
```
grep -rn "'<tag>'" apps/web/src apps/web/lib --include="*.ts*" | grep -E "cacheTag|unstable_cache|tags:"
```
O leitor é quem declara a tag num `unstable_cache(..., { tags })`, `cacheTag()` ou
`fetch(..., { next: { tags } })`. É dele que sai a categoria: crawler, visitante, editor ou
staff. **Um hit em `tags:` só conta se o dono do bloco for `unstable_cache(`.** Uma janela fixa
de contexto (`grep -B6`) **não serve**: nos leitores reais deste repo o `unstable_cache(`
fica 12, 14, 31 e 77 linhas antes do `tags:` (`lib/newsletter/queries.ts`,
`author-queries.ts`, `suggestions.ts`), e o `-B6` devolve vazio — falso "sem leitor" em
três das seis linhas da tabela abaixo. Use a função, que acha o **dono** do `tags:` sem
limite de distância:
```
leitor() {   # uso: leitor 'ads'   |   tag dinamica: so o prefixo -> leitor 'author:'
  awk -v t="$1" '
    FNR==1 { owner=""; oln=0 }
    /unstable_cache\(|uploadMediaAsset\(|cacheTag\(/ { owner=$0; oln=FNR; sub(/^[ \t]+/,"",owner) }
    $0 ~ "tags:.*[\x27\"`]" t { printf "%s:%d  <- %d: %s\n", FILENAME, FNR, oln, substr(owner,1,55) }
  ' $(grep -rl --include="*.ts" --include="*.tsx" -- "$1" apps/web/src apps/web/lib)
}
```
Cada linha da saída diz de qual chamada o `tags:` faz parte. **Regra: é leitor se, e só se,
o dono é `unstable_cache(`.** Dono `uploadMediaAsset(` é metadata, dono `0` é array solto —
nenhum dos dois é leitor. Calibração medida: `leitor 'ads'` → `src/lib/ads/resolve.ts:352 <- 349: unstable_cache(`
(mais três linhas de `adsense/` com dono 0, ignorar); `leitor 'link:'` → só
`uploadMediaAsset(` em `links/actions.ts:781` e `qr/actions.ts:244`, logo **sem leitor**;
`leitor 'author:'` → dois `uploadMediaAsset(` em `authors/actions.ts` **e** dois
`unstable_cache(` em `lib/newsletter/author-queries.ts:22,47` — leitor real, que o `-B6`
não via. Para tag dinâmica, passe só o prefixo até o `${`.

**Quando o grep não acha leitor — e isso é a regra, não a exceção.** Medido em 2026-09-04:
das **43 tags distintas** invalidadas pelas 171 chamadas, o `comm -23` cru dá 26 sem
leitor e 48 chamadas — **e esse número cru está errado nos dois sentidos**, pelas ressalvas
abaixo: `page-content:youtube` (2 chamadas) sai, porque é lida via `page-content:*`; e
`link:*` (13 chamadas) entra, porque seu "leitor" é metadata de upload. Conjunto corrigido,
que é o que vale: **26 tags, 59 chamadas** — ~35% do WP-2 é fallback. A soma por padrão dá
60, não 59: `link:*` como regex (`link:.*`) casa também a única `link:${siteId}:${code}`
(`lib/links/cache.ts:8`), que `link:*:*` já conta — uma chamada em dois padrões; subtraia 1. O executor grava esse
conjunto em `orfas.txt` no 2.0, depois de passar cada candidata pela função `leitor`; é
sobre `orfas.txt`, nunca sobre o `comm` cru, que o assert do portão final roda. O repo não usa `cacheTag()` nem `fetch(..., { next: { tags } })`
(zero ocorrências), então `unstable_cache` é o único mecanismo de leitura que existe. O
inventário sai deste comando, que o executor **re-roda** no início do WP-2 e cola no
`lote-2.0.md`:
```
# Portabilidade, medida e nao presumida: este bloco e a funcao `leitor` dao resultado
# identico (43 tags / 26 orfas, diff vazio) com o BSD grep 2.6.0 de fabrica do macOS
# (`command grep`) e com ugrep 7.8.4. Nao exigem GNU grep. Uma versao anterior desta nota
# afirmava o contrario sem ter testado.
grep -rhoE "tags: *\[[^]]*\]" apps/web/src apps/web/lib --include="*.ts*" \
  | grep -oE "['\`][^'\`]+['\`]" | tr -d "'\`" | sed -E 's/\$\{[^}]*\}/*/g' | sort -u > read.txt
grep -rhoE "revalidateTag\([^)]*\)" apps/web/src apps/web/lib --include="*.ts*" \
  | grep -oE "['\`][^'\`]+['\`]" | tr -d "'\`" | sed -E 's/\$\{[^}]*\}/*/g' | sort -u > inv.txt
comm -23 inv.txt read.txt        # invalidada e nunca lida
```
Duas ressalvas do comando, para não confiar cegamente: ele normaliza `${x}` para `*`, então
`page-content:youtube` aparece como órfã mas é lida por `page-content:*` — conferir à mão
cada órfã cujo prefixo tenha versão dinâmica lida; e o grep de `tags:` também pega arrays
que não são de cache — e isso **não é só ruído inofensivo**: além de nomes como `React` e
`PHP`, ele marca `link:*` como lida quando o único `tags:` com essa forma é metadata de
upload. Resultado: **o `comm -23` subestima as órfãs**. Toda tag que o `read.txt` diz ser
lida precisa da conferência de contexto acima antes de sair da lista de candidatas.
Sem leitor hoje, confirmado à mão: `sitemap:*`, `og:blog:*`, `og:campaign:*`,
`og:newsletter:*`, `blog:post:*`, `campaign:*`, `newsletter:type:*`, `ad:slot:*`,
`ad:slot-config:*`, `links:*`, `link-analytics:*`, **`link:*` em todas as formas** (`` link:${id} ``,
`` link:${linkId} ``, `` link:${input.link_id} ``, `` link:${siteId}:${code} `` — 14 chamadas em 5
arquivos, falso leitor no inventário), `linktree-config`, as três `media:asset:*` / `media:gallery:*` / `media:stats:*`,
`ab-tests`, `most-read`, `content-analytics`, e mais. A tag é resíduo, ou o leitor foi
removido e a invalidação ficou. Regra de fallback, para que isso vire decisão registrada e
não suposição silenciosa:

> Tag sem leitor localizável → `revalidateTag(tag, 'seconds')`, nunca `updateTag`; e uma
> linha no arquivo de expectativa do lote: `<tag>: sem leitor — candidata a remoção`. Não
> remova a chamada neste plano; a remoção é limpeza separada, com o próprio commit.

Aplicado ao caso que expõe o conflito: `revalidateTag('layout-counts')` em
`api/pipeline/research/import/route.ts:20`. Contexto Route Handler → a função é
`revalidateTag`. Leitor: contador de navegação compartilhado entre staff → o perfil é
`'seconds'`. **Não é `{ expire: 0 }`**, apesar de estar num Route Handler. Onde o lote 2.4
diz "tudo `{ expire: 0 }`", leia "tudo `revalidateTag`, nunca `updateTag`" — o perfil ainda
sai do leitor, tag a tag.

**Regra de desempate — a metade "leitor" da Precedência, reafirmada.** A tabela acima decide pelo *contexto de
execução*; quando ele não basta, decida pelo **leitor do dado**:

> Se o alvo da tag é conteúdo lido por **outra pessoa** que não o autor da ação, trate como
> público — `revalidateTag` com perfil — mesmo dentro de uma Server Action. `updateTag` é
> para quando quem salvou é quem vai ler.

O caso que parecia mais comum do lote 2.3 — admin edita SEO, alvo `sitemap:*`/`og:*` "lido
por crawler" — **não existe como eu o descrevi**: pelo inventário acima, nenhuma dessas tags
tem leitor. Elas caem no fallback (`'seconds'` + registro), não em `'max'`. O perfil `'max'`
fica reservado para tag **com leitor medido** cujo consumidor seja só crawler ou artefato
estático; hoje o grep não encontra nenhuma nessa condição. Se o executor achar uma, é ela
que vai de `'max'` — e não uma tag que *parece* de SEO pelo nome.

**A lista abaixo é ilustrativa, não exaustiva — e a generalização que a segue é, de novo, a
Precedência aplicada a leitor = staff.** Ela mostra a regra aplicada; ela não é o
conjunto de todos os casos. A generalização que fecha a dúvida:

> **Toda tag cujo alvo é superfície de CMS compartilhada entre staff — hub, listagem,
> contador, badge — vai de `revalidateTag` com perfil curto (`'seconds'`), nunca de
> `updateTag`**, mesmo quando a chamada está dentro de uma Server Action. Isso inclui, por
> nome: `blog-hub`, `links-hub`, `newsletter-hub`, `pipeline-blog`, `sidebar-badges`,
> `layout-counts`, `youtube`. Se aparecer uma tag de hub ou contador que não está nesta
> lista, ela segue a mesma regra — o critério é o alvo ser tela compartilhada, não estar
> nomeado aqui.

**Três casos já classificados por essa regra** — quem submete não é quem lê:
- `app/(public)/contact/actions.ts` — formulário público invalidando badge do painel admin.
- `newsletter/confirm/[token]/actions.ts` — confirmação de double opt-in.
- **Contadores de navegação compartilhados entre staff** — `sidebar-badges` e
  `layout-counts`. Este é o caso que os dois primeiros não cobrem: não há público
  envolvido, mas o leitor ainda não é o autor. Um editor arquiva um post e o contador da
  sidebar muda para **todo staff logado**, não só para ele. **"Outra pessoa" na regra inclui
  outro membro do staff olhando a mesma tela** — logo estas vão de `revalidateTag` com perfil
  curto (`'seconds'`), não de `updateTag`. Se fossem `updateTag`, só a sessão de quem agiu
  veria o número certo, e os demais ficariam com o contador velho até a próxima navegação
  completa — exatamente o tipo de divergência que ninguém reporta como bug.

**Caso especial — os helpers locais, e são oito, não três.** Funções que agrupam
`revalidateTag` e são chamadas de dentro de Server Actions, sem serem elas próprias a
action. A conta, explícita: o grep por nome (`function revalidate[A-Za-z]+`) acha **17
funções em 11 arquivos**. Agrupadas por dono — os 4 de `lib/seo/cache-invalidation.ts` como
um, os 4 de `lib/newsletter/cache-invalidation.ts` como um, `revalidateResearch` nos seus
dois arquivos como um, e as 7 restantes uma a uma — dão **dez grupos**. Duas dessas 17 —
`playlists/actions.ts:revalidatePlaylists` e `settings/actions.ts:revalidateContactPaths` —
só chamam `revalidatePath`, nunca `revalidateTag`, e não pertencem a este plano: sobram
**15 funções em oito grupos**. A versão
anterior deste parágrafo as listou porque mediu o nome e não o corpo. Os oito, com
`revalidateTag` no corpo confirmado: `lib/seo/cache-invalidation.ts` (4 funções, 9 chamadas),
`lib/newsletter/cache-invalidation.ts` (4 funções, 8), `blog/_shared/server-utils.ts:revalidateBlogHub` (4),
`links/actions.ts:revalidateLinksHub` (3), `newsletters/actions.ts:revalidateNewsletterHub` (3),
`media/actions.ts:revalidateMedia` (3), `lib/social/actions/_shared.ts:revalidateSocialPaths` (1),
e `revalidateResearch` (1 cada) em `pipeline/research/foco-actions.ts` e `decision-actions.ts`. `updateTag` exige estar no corpo da própria action, então
**dentro de helper é sempre `revalidateTag`**, perfil por tag pelo leitor medido. Inline-los
nas actions engordaria o escopo sem ganho proporcional. Cada helper fica no lote do seu
diretório; se o executor achar um nono, a regra é a mesma — e confira o corpo, não o nome.

**Leitor medido das 17 tags dos dois arquivos de helpers em `lib/`.** A coluna "leitor" vem do grep
de leitor (2026-09-04), não de inferência pelo nome — a versão anterior desta tabela
classificou `newsletter-suggestions` como "config interna do CMS" e o único leitor real é
um widget público. O executor **abre o arquivo do leitor** antes de fixar o perfil, e
registra no lote.

| Tag | Leitor medido | Perfil |
|---|---|---|
| `` sitemap:${siteId} `` (×4), `` og:blog:* ``, `` og:campaign:* ``, `` og:newsletter:* ``, `` blog:post:* ``, `` campaign:* ``, `` newsletter:type:* `` | **nenhum** | fallback: `'seconds'` + `sem leitor — candidata a remoção` |
| `` author:${authorId} `` | `lib/newsletter/author-queries.ts`, `cms/(authed)/authors/actions.ts` | abrir o leitor: se página pública → `'minutes'`; se só CMS → `'seconds'` |
| `` about:${siteId} `` | `lib/about/queries.ts` | página pública → `'minutes'` |
| `newsletter:types:count` | `lib/newsletter/queries.ts` | abrir o leitor e decidir pela mesma régua |
| `newsletter-suggestions` | `lib/newsletter/suggestions.ts` → widget em `app/(public)/newsletters/[slug]/` | visitante → `'minutes'` (**corrigido**; era `'seconds'`) |
| `seo-config` | `lib/seo/config.ts` (usado por sitemap, robots e metadata) | crawler e visitante → `'minutes'` |

**Quarto caso de leitor: conteúdo público lido por visitante em página renderizada.** As três categorias
acima (crawler, editor, staff) não cobrem tag lida pelo **visitante** numa página renderizada
— e o lote 2.5 é feito disso. Exemplo real: `'ads'`, invalidada em
`admin/(authed)/ads/_actions/campaigns.ts:91`, é consumida por `lib/ads/resolve.ts:352`
(`unstable_cache(..., { tags: ['ads'], revalidate: 300 })`) e lida na página pública do blog.

> **Tag lida por visitante em página renderizada → `revalidateTag(tag, 'minutes')`.** Não
> `'max'`, que é para artefato de crawler e adiaria demais uma troca de campanha; não
> `'seconds'`, que joga fora o cache que o `revalidate: 300` existe para manter.

Cobre o resto do lote 2.5: `'ads'` (leitor `src/lib/ads/resolve.ts`) e `'instagram-feed'`
(leitor `lib/home/queries.ts`) vão de `'minutes'`. `` `ad:slot:${slotKey}` `` e
`` `ad:slot-config:${appId}` `` **não têm leitor** — fallback. `'layout-counts'`, `'youtube'` e `'seo-config'` no
mesmo lote continuam `'seconds'` pela regra de tela compartilhada.

**`src/lib/links/cache.ts` segue o mesmo caso especial** (`link:${siteId}:${code}`,
`links:${siteId}`, `link-analytics:${linkId}`, linhas 8, 15 e 22). Ele não é Server Action, é
injetado via `lib/links/container.ts` **e** chamado pelo cron de expiry — dois contextos de
execução para o mesmo código. Por isso `updateTag` está descartado por construção, não por
julgamento. E as três tags são **órfãs** — `leitor 'link'` não acha `unstable_cache` para
nenhuma, nem em `app/go/[code]` nem em `packages/links*`; o comentário em `cache.ts:5`
("downstream consumers use `unstable_cache` with these tag keys") descreve consumidores que
não existem. Logo as três vão de fallback `'seconds'` + registro. Uma versão anterior mandava
`link:${siteId}:${code}` para `{ expire: 0 }` "porque o redirect público precisa refletir a
expiração na hora" — inferência pelo nome; nada lê a tag, então o perfil não muda
comportamento nenhum, e a contradição com o assert de órfãs era real.

Um dos oito, com decisão registrada em detalhe porque mistura domínios, é
`revalidateBlogHub(siteId?)` em
`apps/web/src/app/cms/(authed)/blog/_shared/server-utils.ts:11` — 4 chamadas no corpo
(`blog-hub`, `pipeline-blog`, `sidebar-badges`, `` `sitemap:${siteId}` ``), com 13 call sites
(9 em `blog/actions.ts`, 4 em `blog/tag-actions.ts`). **Mesma decisão: continua
`revalidateTag`, perfil por tag** — as três primeiras são tela de staff → `'seconds'`;
`` `sitemap:${siteId}` `` **não tem leitor** (`leitor 'sitemap:'` devolve vazio) → fallback
`'seconds'` + registro "sem leitor — candidata a remoção". Uma versão anterior deste
parágrafo a mandava para `'max'` "porque é SEO"; era inferência pelo nome, e estava errada.
Ele fica **inteiro no lote 2.6**, mesmo contendo uma tag de domínio SEO: o critério
de lote é o arquivo, não a tag, e partir um helper de 4 linhas entre dois lotes cria
justamente a janela de meio-caminho que a divisão em lotes existe para evitar. O lote 2.3
não deve tocá-lo — quem o abrir ali, pare e deixe para o 2.6.

**Lotes:**

- [ ] **2.0 Os mocks de `next/cache`, antes do primeiro lote.** O `vitest.config.ts` faz
  alias global de `next/cache` para `test/__stubs__/next-cache.ts`, que exporta
  `revalidateTag(_tag: string)` de um argumento e **não** exporta `updateTag`. Além dele,
  **85 arquivos de teste** fazem o próprio `vi.mock('next/cache', ...)` local, também sem
  `updateTag`. Assim que um lote trocar uma call site para `updateTag`, o teste daquela
  action importa um binding `undefined` e falha **em runtime** — o `tsc` não pega, porque o
  alias só existe no vitest. Atualizar o stub para exportar `updateTag(tag: string): void {}`
  e a forma de dois argumentos de `revalidateTag`; e em **cada** lote, antes de aplicar,
  rodar `grep -l "vi.mock('next/cache'" <arquivos de teste do lote>` e acrescentar
  `updateTag: vi.fn()` aos mocks locais encontrados. Fazer isso depois de aplicar o lote
  transforma um erro de classificação em ruído de suíte vermelha.
  **Ainda no 2.0, antes de qualquer lote:** rodar o bloco de inventário (`read.txt`,
  `inv.txt`, `comm -23`), passar cada candidata a órfã e cada "leitora" suspeita pela função
  `leitor`, e gravar o conjunto corrigido em `docs/ops/next16-wp2-lotes/orfas.txt` — hoje
  isso significa tirar `page-content:youtube` e pôr `link:*`. Esse arquivo é a entrada do
  assert por órfã no portão final e vai no commit do 2.0. Sem ele, o assert roda sobre o
  cru e deixa 13 chamadas de fora.
- [ ] **2.1 Links** (~34) — `links/actions.ts`, qr/edit actions, `lib/links/cache.ts`. A maior
  parte deste lote é órfã: as 14 chamadas de `link:*` (em `links/actions.ts`,
  `[id]/qr/actions.ts`, `[id]/qr/card-actions.ts`, `[id]/edit/actions.ts`, `lib/links/cache.ts`)
  mais `links:*`, `link-analytics:*`, `links-settings` (7), `link-alerts` (5) e
  `canvas-formats` (2) não têm leitor — **31 das 33 chamadas do lote são fallback**. Só duas
  tags têm leitor real, ambas tela de staff → `'seconds'`: `links-hub` (`links/page.tsx:437`,
  dentro de `unstable_cache`) e `sidebar-badges` (`lib/cms/sidebar-badges.ts`). O inventário
  do 2.0 marca `link:*`, `qr`, `qr-card` e `qr-template` como lidas; são todas metadata de
  `uploadMediaAsset`, o falso leitor descrito acima — e as três `qr*` nem são invalidadas,
  portanto não entram no WP-2. **Antes de tocar `lib/links/cache.ts`, confirmar os callers** — o grep direto achou só o cron de expiry, mas há injeção via `lib/links/container.ts` que o grep não pega.
- [ ] **2.2 YouTube** (~35) — ab-lab, videos, categories, comments, content, prompt-actions, cron `sync-youtube`.
- [ ] **2.3 Newsletters, SEO e autores** (~35) — o lote mais delicado, mistura os três destinos.
- [ ] **2.4 Pipeline e Research** (25 exatas: 9 nos 7 `route.ts` de `api/pipeline/research/**`
  + 16 nas Server Actions `cms/(authed)/pipeline/actions.ts` (9), `pipeline/research/actions.ts`
  (5), `decision-actions.ts` (1), `foco-actions.ts` (1)). **O lote é por domínio, não por tipo
  de arquivo** — as Server Actions estão dentro e seguem as regras normais; as tags delas
  (`pipeline-blog`, `layout-counts`) são tela compartilhada → `'seconds'`. Nos 7 `route.ts`,
  **nenhum `updateTag`**, sem exceção; o perfil ainda sai do leitor, tag a tag (ver
  Precedência) — a maioria `{ expire: 0 }`, mas `'layout-counts'` é `'seconds'` mesmo ali. Os `route.ts` deste lote ganham um assert de verdade, não uma conferência de
  contagem — `updateTag` neles é erro **por construção**:
  `! grep -rq "updateTag(" <arquivos do lote 2.4>` — falhou se encontrar qualquer um.
  **O mesmo assert vale para todo `route.ts` do repo, em qualquer lote** — são 12 arquivos:
  ```
  ! grep -l "updateTag(" $(grep -rl "revalidateTag(" apps/web/src --include="route.ts")
  ```
  Ele entra no portão final do WP-2. Dois desses 12 não estão em lote nomeado e ficam
  atribuídos aqui: `api/cron/aggregate-content-metrics/route.ts` → lote 2.6 (varredura),
  `api/webhooks/ses/route.ts` → lote 2.3 (newsletter). Os outros crons já têm dono:
  `sync-youtube` → 2.2, `send-scheduled-newsletters` → 2.3, `instagram-sync` → 2.5.
  Isto importa porque `updateTag` fora de Server Action é restrição de **runtime**: o `tsc`
  compila `updateTag` dentro de um Route Handler sem reclamar.
- [ ] **2.5 Settings, Contacts, Media, Ads, Social** (~35).
- [ ] **2.6 Blog, Video, Linktree e varredura final** (~10).

**Pertencimento a lote é por diretório de domínio.** Arquivo com `revalidateTag` que não
esteja nomeado acima vai para o lote do seu domínio — não fica órfão, e não é escolha do
executor. Os que o grep acha hoje e nenhum lote cita por caminho:
`cms/(authed)/links/format-actions.ts` (2) → **2.1**; `lib/social/actions/_shared.ts` (1) →
**2.5**; e os dois arquivos de helpers em `lib/`, `lib/seo/cache-invalidation.ts` (9) e
`lib/newsletter/cache-invalidation.ts` (8) → **2.3**, o lote de SEO e newsletter — o terceiro
helper já tem dono (2.6). Se aparecer outro, o executor aplica a mesma regra e registra o
arquivo no `lote-2.<n>.md` correspondente.

Os tamanhos por lote são aproximados e somam mais que 171 por sobreposição de arquivo entre
lotes. O número que fecha o pacote é o portão final, não a soma: `tsc` em zero erro e o grep
corrigido em zero linha.

**Portão por lote — sintaxe E semântica.** O grep de sintaxe sozinho **não é portão**: ele
verifica se existe um segundo argumento, nunca *qual*. Um lote inteiro classificado errado
passaria verde nele.

Antes de tocar cada lote, **registre a expectativa** em
`docs/ops/next16-wp2-lotes/lote-2.<n>.md` — quantas chamadas vão para cada destino, e por
quê. O arquivo é **versionado e commitado junto com o lote**: ele é o rastro que o WP-6 cita
e a única evidência de que a classificação foi decidida antes de aplicar, não racionalizada
depois. Não deixe em scratch solto — o plano manda `git add` por caminho explícito, e um
arquivo de expectativa fora do repo se perde no fim do worktree.

**O arquivo do lote carrega, por tag, a saída do grep de leitor** — não só a contagem por
destino. Formato mínimo: `<tag> | <arquivo do leitor ou "sem leitor"> | <perfil> | <por quê>`.
Uma tabela pré-computada neste plano já errou um leitor; o portão não pode herdar
classificação sem re-medir. Expectativa sem a coluna de leitor **não conta como registrada**.

**E a lista de tags do lote é auditada contra o inventário, não contra a memória:** toda tag
que `grep -rhoE "revalidateTag\([^)]*\)" <arquivos do lote>` devolve tem de ter linha no
`lote-2.<n>.md`, e toda linha marcada "sem leitor" tem de constar do `comm -23` do 2.0 (ou
da conferência de contexto que o corrigiu). Tag no código sem linha no arquivo = lote não
registrado. Foi assim que `link:*` — 14 chamadas dentro do escopo nomeado do lote 2.1 —
passou sem classificação por três revisões deste plano.

```
lote 2.1 links — esperado: updateTag 28 · {expire:0} 6 · 'max' 0
```
Os números acima são **formato, não expectativa vinculante** — não os copie. A expectativa
real de cada lote sai da classificação que você fizer com as regras desta seção, antes de
tocar no código.

Depois de aplicar, confira contra a expectativa registrada:

```
# por destino, no escopo do lote
grep -rc "updateTag(" <arquivos do lote>
grep -rc "{ expire: 0 }" <arquivos do lote>
grep -rc "'max')" <arquivos do lote>
```

Divergência entre o registrado e o medido é falha do lote — ou a classificação mudou de
ideia no meio, e isso precisa ser decisão consciente, não deriva.

**Portão final do WP-2:**
```
cd apps/web && npx tsc --noEmit -p tsconfig.json     # DEVE chegar a zero erro
grep -rn "revalidateTag(" apps/web/src apps/web/lib \
  | sed -E 's#^[^:]+:[0-9]+:##' \
  | grep -v ", " | grep -vE "^[[:space:]]*import"
```
**O `sed` não é enfeite.** A forma ingênua deste portão — `| grep -v ", " | grep -v import` —
filtra a linha inteira que o `grep -rn` imprime, **caminho incluído**. Existe exatamente uma
chamada no repo cujo caminho contém a substring `import`:
`apps/web/src/app/api/pipeline/research/import/route.ts:20`. Ela some do resultado sem ter
sido convertida, e o portão retorna zero com o defeito presente. O `sed` corta
`caminho:linha:` antes de filtrar, de modo que só o conteúdo é examinado. Foi medido: a forma
ingênua conta 170, a corrigida conta 171.
**Assert por órfã — automático, não auto-declarado.** Para cada tag do `comm -23` do 2.0
(as órfãs), toda chamada no código tem de estar no fallback. Isto é greppável, e fecha a
brecha em que a expectativa do lote "bate consigo mesma":
```
# orfas.txt = comm -23 cru, corrigido a mao com `leitor` no 2.0 (hoje: -page-content:youtube, +link:*)
for t in $(sed 's/\*/.*/g' orfas.txt); do      # link:*:* -> link:.*:.* (o * interno importa)
  grep -rnE "revalidateTag\([\x27\"\`]$t" apps/web/src apps/web/lib --include="*.ts*" \
    | grep -v "'seconds')" && echo "ORFA FORA DO FALLBACK: $t"
done                                  # DEVE imprimir nada
```
Uma órfã com `'max'`, `{ expire: 0 }` ou `updateTag` reprova aqui — foi assim que
`sitemap:${siteId}` ficou com `'max'` numa versão anterior deste plano, e nenhum outro
portão pegava. **Rodar sobre o `comm -23` cru em vez de `orfas.txt` reabre a brecha**: o
cru não contém `link:*`, e 13 chamadas ficariam fora do loop — uma versão anterior deste
assert fazia exatamente isso. Antes de rodar, confira que `orfas.txt` contém `link:*`.

O typecheck é o portão real deste pacote — é ele que prova que as 171 foram convertidas.
O WP-1 e o WP-3 já o tinham; a ausência dele aqui era a lacuna que deixava o executor
descobrir o problema só ao compilar o primeiro lote.

Deve retornar **zero**. Isso prova só que não sobrou chamada de um argumento — a prova da
classificação é a conferência por lote acima. Depois: suíte completa.

**Atenção às 35 tags dinâmicas** em template string, em 10 arquivos. A sintaxe é igual; o que muda é o critério de perfil por call site. Revisar uma a uma.

---

