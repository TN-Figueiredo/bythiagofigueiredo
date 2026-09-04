# Next.js 16 — Validação do Ecossistema

> **Para executores:** use `superpowers:subagent-driven-development`. Passos com `- [ ]`.
>
> **Este plano exige worktree isolado — exceção deliberada à convenção do repositório.**
> O `CLAUDE.md` e o histórico dizem para trabalhar direto em `staging`, sem branch, porque
> vários terminais rodam em paralelo. Essa convenção pressupõe que a árvore compila o tempo
> todo. **Aqui ela não compila:** assim que o Next sobe para a 16, as 171 chamadas de
> `revalidateTag` viram erro de tipo simultaneamente, e só voltam a compilar quando o
> último lote fechar. Deixar isso em `staging` bloquearia o pre-commit de todos os outros
> terminais por horas. Use `superpowers:using-git-worktrees`.
>
> **Nenhum sub-agente commita** — o controller revisa e commita em série, porque o
> pre-commit roda typecheck do monorepo inteiro.

**Objetivo:** subir `apps/web` para Next.js 16 e, com isso, responder à pergunta que só este repositório pode responder — **as sete bibliotecas `@tn-figueiredo/*` com peer de `next` funcionam na 16?**

**Por que agora:** sete pacotes publicados declaram peer aberto (`>=14`, `>=15`). Eles *aceitam* a 16; ninguém verificou que *funcionam* nela. Quando um projeto downstream subir, o custo do descobrimento cai no dono, num repositório que não é dele. Este repo é o único consumidor real de sete deles ao mesmo tempo.

**Por que NÃO é para fechar o gate de audit:** medido — só o Next 16 limpa as cópias aninhadas (`next/node_modules/{sharp,postcss,nanoid}`); as outras sete vivem na raiz, vindas de outras árvores, inclusive do `fastify` do `apps/api`. Nenhum dos dois caminhos fecha sozinho. O gate é assunto separado.

**Base:** `5e482db7` · Next 15.5.25 · React ^19.1.0 · Node 22 · Tailwind 4.3.0

---

## Constraints globais

- **Worktree isolado**, pelo motivo acima. Merge para `staging` só com a árvore compilando. `git add` por caminho explícito.
- Nunca rodar a suíte completa dentro de um lote — só runs direcionados (~1s). A suíte inteira roda nos portões: **`cd apps/web && npx vitest run`** — da raiz do repo ela
  quebra em massa, porque não existe `vitest.config.ts` lá e os aliases `@/...` não resolvem.
  Ordem de grandeza medida: ~1078 arquivos, ~13.780 testes, 2-3min conforme a máquina.
- **NUNCA rodar `npx @next/codemod upgrade latest`.** Em ambiente não-interativo ele aplica todos os codemods sem chance de recusa, incluindo `middleware-to-proxy`, que este plano rejeita por decisão registrada.
- TypeScript strict, nunca `any`.
- **`next build` NUNCA reprova erro de tipo neste repo.** `next.config.ts:37` tem
  `typescript: { ignoreBuildErrors: true }`. Em todo portão deste plano, quem prova tipo é
  `npx tsc --noEmit` e só ele; um `next build` verde prova que o bundler emitiu, nada além
  disso. Nunca aceite build verde no lugar do typecheck — sobretudo no WP-2 e WP-3, onde o
  plano diz que erros de tipo são o estado esperado e o hábito de relativizar `tsc` vermelho
  se instala com facilidade.
- Um pacote de trabalho por commit. Nenhum agente commita; o controller revisa e commita.

---

## Os seis achados que moldam este plano

**1. O bloqueador do build é de cinco linhas.** `next.config.ts:61-66` define `resolve.extensionAlias` porque `packages/links-admin/src/index.ts` importa com extensão `.js` de arquivos que só existem como `.ts`/`.tsx`. `links-admin` é workspace **local e privado**. Corrigir os imports elimina a config inteira.

**Armadilha:** portar para `turbopack.resolveExtensions` seria **falsa portabilidade**. São coisas diferentes — `resolveExtensions` cobre imports *sem* extensão; `extensionAlias` remapeia extensão *explícita*. O Turbopack não tem equivalente (`vercel/next.js#82945`, tracking `PACK-5449`). O build passaria e a resolução quebraria em silêncio.

**2. `revalidateTag(tag, 'max')` NÃO preserva o comportamento atual.** O segundo argumento lê apenas `expire`. A forma de um argumento hoje equivale a expirar imediatamente. Inserir `'max'` mecanicamente faz o sistema servir conteúdo velho por até um ano onde hoje expira na hora — **regressão silenciosa em 171 pontos**, verde em todo teste.

**3. `updateTag` só funciona em Server Action.** Não roda em Route Handler, cron nem webhook. Isso classifica metade das chamadas automaticamente.

**4. O ecossistema está essencialmente pronto.** Dos 23 pacotes: zero `revalidateTag`, zero `unstable_*`, zero `serverRuntimeConfig`, zero `next/amp`, zero `quality` em `next/image`. Todo `cookies()`/`headers()` já é `await`. Seis dos sete com peer de `next` não têm nenhuma superfície afetada.

**5. O único ponto do ecossistema é de contrato, não de código.** `auth-nextjs/dist/middleware/create-auth-middleware.js:16` traz o comentário *"Edge Runtime safe"*. Migrar o app para `proxy.ts` — que roda só em Node — tornaria essa promessa falsa para todos os consumidores. **Este plano fica em `middleware.ts`.**

**6. Tailwind sob Turbopack tem modo de falha silencioso.** Exposição, com o comando que a produz — o número sozinho não é verificável e muda com o
repo:
```
grep -rlE 'className=.*[a-zA-Z-]+-\[[^]]+\]' apps/web/src --include="*.tsx" | wc -l   # 566
grep -rhoE '[a-zA-Z-]+-\[[^]]+\]'            apps/web/src --include="*.tsx" | wc -l   # 5319
```
Ordem de grandeza: **centenas de arquivos, milhares de ocorrências**. O que importa para o
WP-4 é a escala, não o dígito: é grande demais para conferir à mão, e é por isso que o portão
compara CSS gerado em vez de inspecionar código. Dos bugs documentados, um é barulhento (`RangeError`) e o outro é mudo — build passa, classe aparece no DOM, regra CSS não é gerada. `tailwindlabs/tailwindcss#19556` segue aberta, com relato em Next 16.2.6 e monorepo. Turbopack **não está em uso hoje**: o risco nasce com esta migração.

---

## Ordem

Ordens de grandeza, para quem executa saber se está no ritmo — não são prazos:
WP-1 ~1h · 4.1 ~15min · WP-3 ~2h · WP-2 ~1 dia (6 lotes, o mais longo) ·
WP-4 ~2h · WP-5 ~1h pós-deploy · WP-6 ~3h.

```
EM STAGING, direto (compila o tempo todo, sem isolamento)
  WP-1  desarmar o bloqueador     — vale por si, mesmo se a migração for abortada
  4.1   CSS de referência          — build com webpack, guardar o resultado
        (é o passo 4.1, listado aqui porque roda ANTES do worktree; o
         resto do WP-4 roda depois. Não existe seção "WP-0".)

NO WORKTREE (a arvore fica sem compilar entre WP-3 e o fim do WP-2)
  WP-3  o upgrade                  — 171 erros de tipo aparecem aqui, e isso e ESPERADO
  WP-2  revalidateTag em 6 lotes   — cada lote reduz a contagem de erros
  WP-4  portao de paridade do CSS  — bloqueia o merge

MERGE para staging -> deploy
  WP-5  QA comportamental          — pos-deploy
  WP-6  relatorio do ecossistema   — o entregavel que justifica tudo
```

**A ordem é forçada, não escolhida.** `revalidateTag` com dois argumentos e `updateTag`
**não existem no Next 15.5.25** — verificado contra o pacote instalado: a declaração é
`revalidateTag(tag: string): undefined`, sem sobrecarga, e `updateTag` não é exportado
(`TS2554` e `TS2305` respectivamente). Logo o WP-2 **não pode** vir antes do WP-3.

Consequência que o executor precisa esperar: **logo após o WP-3, `tsc` acusa 171 erros**.
Isso é o estado correto, não uma falha. A contagem cai a cada lote do WP-2 e chega a zero
no fim. Meça — é o melhor indicador de progresso que este plano tem.

Só o **WP-1** é independente e fica mesmo se tudo o mais for abortado. O WP-2 fica preso ao
WP-3 nos dois sentidos: não pode vir antes, e não pode ficar sozinho se o WP-3 voltar. Ver
**Reversão**.

---

## WP-1 — Desarmar o bloqueador do build

**Arquivos:** `packages/links-admin/src/index.ts` · `apps/web/next.config.ts`

- [ ] **1.1** Trocar as cinco linhas de `packages/links-admin/src/index.ts` que importam com `.js` (`'./types.js'` ×2 nas linhas 19 e 21; `'./components/qr-card-builder/index.js'` na 23;
  `'./components/qr-card-builder/template-browser.js'` na 24;
  `'./components/qr-card-builder/qr-templates.js'` na 25 — os dois últimos moram sob
  `components/qr-card-builder/`, não na raiz do pacote) para a forma sem extensão. O `tsconfig.json` do pacote usa `moduleResolution: "bundler"`, que resolve sem extensão.
- [ ] **1.2** Rodar `npm run build:packages` e o typecheck de `apps/web`. Se falhar, a causa é outra e o passo 1.3 não deve acontecer.
- [ ] **1.3** Remover o bloco `webpack(config)` inteiro de `apps/web/next.config.ts:61-66`.
- [ ] **1.4** Remover `eslint: { ignoreDuringBuilds: true }` de `next.config.ts:36` — chave removida no Next 16, e o repo não tem ESLint configurado. Nenhum codemod faz isso.

**Portão:**
```
npm run build:packages
cd apps/web && npx tsc --noEmit -p tsconfig.json
npx next build            # com Next 15 ainda, webpack — prova que a config saiu sem quebrar
npx vitest run            # suite completa
```
Critério: build verde **sem** o `webpack()`, com Next 15. Isso isola a mudança de resolução da mudança de bundler.

---

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

## WP-3 — O upgrade

- [ ] **3.1** `npm i next@latest -w apps/web` mais `@next/mdx` na mesma major. `react`/`react-dom` em `^19.1.0` já resolvem 19.2.x — **não mexer**.
- [ ] **3.2** Rodar **apenas** `npx @next/codemod@canary remove-experimental-ppr apps/web/src` (no-op esperado) e `remove-unstable-prefix apps/web/src` com `--dry` primeiro. **Auditar o resultado do segundo** — o repo tem 25 arquivos com `unstable_cache`, que é
  API diferente de `unstable_cacheTag` e **não** deve ser tocada:
  ```
  grep -rl "unstable_cache" apps/web/src apps/web/lib | sort > /tmp/uc.txt          # 25 linhas
  npx @next/codemod@canary remove-unstable-prefix apps/web/src --dry 2>&1 | tee /tmp/dry.log
  grep -oE 'apps/web/[^ ]+\.tsx?' /tmp/dry.log | sort -u | comm -12 - /tmp/uc.txt   # DEVE sair vazio
  ```
  Se a interseção não for vazia, o codemod ia tocar `unstable_cache`: não rode sem `--dry`;
  faça as trocas de `unstable_cacheTag`/`unstable_cacheLife` à mão. Se for vazia, rode sem
  `--dry` e repita a interseção com `git diff --name-only | sort` como segunda prova.
- [ ] **3.3** Não renomear `middleware.ts`. Registrar no commit o motivo — a garantia "Edge Runtime safe" do `auth-nextjs`.
- [ ] **3.4** `npx next typegen` para gerar `PageProps`/`LayoutProps`/`RouteContext`.
- [ ] **3.5** Ajustar `images` em `next.config.ts` conforme WP-5.

- [ ] **3.6 Reproduzir o `npm ci` da CI, sem a flag.** O `vercel.json` instala com
  `npm ci --legacy-peer-deps`; **todos** os sete `npm ci` do `ci.yml` rodam **sem** ela. Um
  bump de major do Next mexe em peers, então o mesmo commit pode buildar verde na Vercel e
  quebrar com `ERESOLVE` na CI — ou o inverso. Rodar `npm ci` limpo, sem a flag, antes de
  subir. Se conflitar, resolver o peer na raiz; não mascarar com a flag.
- [ ] **3.7 `apps/api` entra junto pelo lockfile.** A API não importa `next` (verificado por
  grep), mas divide o `package-lock.json` do monorepo, e os jobs `typecheck (apps/api)` e
  `test-api` rodam `npm ci` sobre esse mesmo lockfile. Um `npm ci` que quebre pelo passo 3.6
  derruba os dois — sem nenhuma regressão no código da API. Incluir
  `cd apps/api && npx tsc --noEmit` no portão.
- [ ] **3.8 O job com Node fixado.** `ci.yml:124` (`test-db-integration`) é o único job com
  `node-version: '20'` literal; os outros sete usam `node-version-file: .nvmrc` (= 22).
  Conferir o `engines.node` do `next` instalado. Se o mínimo passar de 20.x, alinhar esse job
  ao `.nvmrc` **no mesmo commit do bump** — não num commit de conserto depois.

**Portão:**
```
cd apps/web && npx tsc --noEmit -p tsconfig.json    # o unico portao de tipo (ver constraints)
cd apps/api && npx tsc --noEmit                      # o lockfile e compartilhado
npm ci                                               # sem --legacy-peer-deps, como a CI faz
cd apps/web && npx next build                        # agora com Turbopack por padrao
npx vitest run
```
**Exercitar `@app/shared` sob Turbopack.** O `transpilePackages` lista três pacotes
(`next.config.ts:59`); o achado 1 cobriu só o `links-admin`. O `@app/shared` é o caso mais
arriscado — o `CLAUDE.md` o documenta como exceção, TS cru com NodeNext, sem build de
workspace. Abrir uma rota que importe dele e confirmar que resolve; o webpack e o Turbopack
tratam `transpilePackages` por caminhos diferentes.

---

## WP-4 — Portão de paridade do CSS (bloqueia o merge)

**Existe porque o modo de falha do Tailwind sob Turbopack é silencioso.** Build verde e CSS
faltando é indistinguível de build verde e CSS correto — sem esta comparação.

**Três pacotes do ecossistema entram no bundle por `@import` de CSS**, e por isso pertencem à
superfície deste portão, não só à do WP-6: `cms-ui` e `cms-admin` direto em `globals.css:1-2`
(com `layer(packages)`), e `cms-reader` via `styles/reader-pinboard.css:1`. A camada
`layer(packages)` importa: mudança de ordem de cascata entre bundlers muda quem ganha um
conflito de especificidade, e isso não aparece em contagem de regra — só na comparação
visual do 4.4.

- [ ] **4.1 (roda antes de tudo, ainda em `staging`)** Antes de entrar no worktree, ainda em `staging` com Next 15/webpack: `npx next build` e guardar a referência **fora de qualquer árvore git** — o 4.2 roda no
  worktree, que é outro diretório:
  ```
  mkdir -p ~/next16-css && cat apps/web/.next/static/css/*.css > ~/next16-css/ref.css
  ```
- [ ] **4.2** Depois do WP-3, com Turbopack, no worktree:
  `npx next build && cat apps/web/.next/static/css/*.css > ~/next16-css/turbo.css`
- [ ] **4.3** Comparar **conjuntos de seletores**, nunca os arquivos brutos — um `diff`
  direto entre bundlers diferentes estoura em ruído de ordem e minificação e não sinaliza
  nada. No CSS compilado o Tailwind escapa os colchetes (`.w-\[32px\]`), e é essa forma
  que o grep procura:
  ```
  cd ~/next16-css
  for f in ref turbo; do
    grep -oE '\.[A-Za-z0-9_-]+\\\[[^]]*\\\]' $f.css | sort -u > $f.arb   # so valor arbitrario
    grep -oE '[^{};]+\{' $f.css | sed 's/{$//' | tr ',' '\n' | sed 's/^ *//' \
      | grep -v '^@' | sort -u > $f.sel                                        # todos os seletores
  done
  wc -l ref.arb turbo.arb ref.sel turbo.sel
  comm -23 ref.arb turbo.arb     # no webpack e AUSENTE no Turbopack
  comm -23 ref.sel turbo.sel
  ```
  **Nunca ancore em `^`**: cada chunk de CSS compilado é **uma linha só** — `wc -l` dá 0
  para todos — e `^[^{]+\{` casa uma única vez no arquivo inteiro (medido: 1 seletor contra
  5.449 com a forma acima, no build atual). Um portão com esse grep compararia dois arquivos
  de uma linha e "passaria" sem provar nada. Valores esperados hoje, para calibrar: 823 em
  `ref.arb`, ~5.400 em `ref.sel`. Se o seu `ref.sel` sair com poucas dezenas, o grep está
  errado, não o CSS.

  **Régua: os dois `comm -23` devem sair vazios.** Qualquer seletor presente na referência e
  ausente no Turbopack **reprova, sem exceção "explicada"** — esse é exatamente o sintoma do
  bug mudo. Seletor presente só no Turbopack (`comm -13`) é ruído de bundler, não reprova.
  A contagem do `wc -l` é para registro no WP-6; a decisão é o `comm`.
- [ ] **4.4** Comparação visual com checklist fixo, definido **antes** de comparar. Escolha
  cinco componentes que usam valor arbitrário conhecido, registre a classe exata e o efeito
  esperado de cada um, e confira os cinco nos dois builds. Sem a lista escrita antes, a
  comparação vira impressão e não portão.
- [ ] **4.5** Repetir com `next dev` a frio — o relato da issue diz que o defeito aparece em cold start.

- [ ] **4.6** Repetir a comparação **num preview da Vercel**, não só local. O projeto já
  está linkado (`apps/web/.vercel/project.json` → `bythiagofigueiredo-web`):
  `cd apps/web && vercel deploy` imprime a URL do preview. É **um** build, não os quatro que
  um push dispara — cabe no orçamento. Baixar o CSS do preview
  (`curl -s <url>/_next/static/css/<hash>.css`, hash visível no HTML da página) e rodar o
  mesmo `comm` do 4.3 contra `ref.arb`/`ref.sel`. O `CLAUDE.md` é
  explícito que a Vercel é a paridade real de build, e o bug do Tailwind é relatado em
  contexto de monorepo, onde ordem de scan e contagem de workers divergem entre a máquina e
  a nuvem. Buildar local e aprovar seria confiar no ambiente que o próprio projeto declara
  não-autoritativo.

**Critério de merge: paridade demonstrada, local e no preview.** Se houver diferença não explicada, o WP-3 não sobe. A ponte `--webpack` existe, mas custa `import.meta.env`, `import.meta.glob`, cache de filesystem entre builds e tree-shaking otimizado — é retirada tática, não solução.

---

## WP-5 — Comportamento

- [ ] **5.1 O A/B Lab e o cache de imagem — o único risco de produto.** `minimumCacheTTL` vai de 60s para 4h. O YouTube **reusa a mesma URL** ao trocar thumbnail. Depois de uma rotação, `/cms/youtube/videos` pode mostrar a thumbnail da variante anterior por até 4 horas, atribuindo a nota à variante errada. **Fixar `images.minimumCacheTTL: 60` explicitamente** em `next.config.ts` para preservar o comportamento atual, e registrar o motivo em comentário.
- [ ] **5.2 `scroll-behavior: smooth`** (`globals.css:498`). O Next 16 para de sobrescrever, então toda navegação no CMS passa a animar a rolagem até o topo em vez de saltar. Verificar numa lista longa (`/cms/blog`, `/cms/youtube/videos`).

  **Esta decisão não é do executor.** É mudança visível de comportamento de UI, e a convenção
  do projeto é aprovação visual antes de fixar. O executor **restaura o comportamento atual**
  — `data-scroll-behavior="smooth"` no `<html>` — que é a opção que não muda nada para o
  usuário, registra que a alternativa existe, e leva as duas para decisão depois do deploy.
  Migração não é a hora de estrear mudança de UX: se a rolagem animada for desejável, ela
  entra por decisão própria, não de carona num bump de major.
- [ ] **5.3 Avatares do Google.** `maximumRedirects` cai para 3. `*.googleusercontent.com` historicamente redireciona. Abrir uma tela com avatar de canal e confirmar que carrega.
- [ ] **5.4** Não afetam, verificado: `qualities` (nenhum `quality=` em `next/image`), `imageSizes` sem o 16 (nada renderiza a 16px), IP local (todos os hosts são públicos), `.next/dev` (o `.gitignore` já cobre).

- [ ] **5.5 Exercitar os três destinos de invalidação em produção — e pelo menos uma tag por
  lote.** Um por destino prova que cada *mecanismo* funciona; não prova que cada *lote*
  escolheu o perfil certo. Por isso, além dos três abaixo, escolha **uma tag com leitor real
  de cada um dos seis lotes** (o `lote-2.<n>.md` lista quais têm) e observe a sequência de
  cabeçalho de cache na URL do leitor — `STALE` depois `HIT` para perfil, `MISS` imediato
  para `{ expire: 0 }`. Erro de perfil dentro de `revalidateTag` não tem outro portão: o
  portão por lote conta destinos, não perfis. O WP-2 muda 171 call
  sites para três comportamentos diferentes, e nenhum portão anterior os observa rodando:
  `tsc` aceita os três, e a suíte usa mocks. Depois do deploy, disparar um de cada e
  confirmar que o conteúdo muda no tempo esperado — `updateTag` por uma Server Action real
  (salvar um post), `revalidateTag(tag, { expire: 0 })` por um cron ou webhook real, e a
  forma `'max'` **se algum `lote-2.<n>.md` registrou uma tag nesse perfil** — pelo inventário
  de hoje nenhuma qualifica, e nesse caso o item fica "não aplicável, zero tags em `'max'`",
  o que é resultado, não omissão. **Para `'max'`, "o conteúdo muda" não é a régua** — o
  achado 2 diz que esse perfil pode servir conteúdo velho por muito tempo, e isso é o
  comportamento correto, não um defeito. O que prova que `'max'` foi aplicado é a sequência
  stale-while-revalidate, observável com dois `curl -sI` na mesma URL logo após a edição:
  a **primeira** resposta traz o valor antigo com `x-nextjs-cache: STALE` (ou o equivalente
  `x-vercel-cache`), a **segunda** traz o valor novo com `HIT`. Se a primeira já vier nova,
  o perfil aplicado foi `{ expire: 0 }`, não `'max'` — classificação errada. Um erro de
  classificação de lote não tem outro lugar
  onde apareça: ele não quebra build, não quebra tipo e não quebra teste — só serve conteúdo
  velho, ou invalida cache demais, em silêncio.
---

## WP-6 — O relatório do ecossistema

**Este é o entregável que justifica o plano.**

- [ ] **6.1** Com o app rodando na 16, exercitar cada uma das sete bibliotecas por uma tela
  real. Cada uma tem consumidor conhecido — este é o roteiro, não "abra o CMS e veja".
  Contagens medidas com `grep -rl "@tn-figueiredo/<pkg>" apps/web/src apps/web/lib` — os
  dois diretórios, porque `lib/` tem consumidor que `src/` sozinho esconde:

  | Pacote | Consumidor no repo | O que exercitar | Aprovado quando |
  |---|---|---|---|
  | `auth-nextjs` | 145 arquivos (src+lib); `middleware.ts` é o ponto de entrada crítico, não o único consumidor | Login e um acesso direto a rota protegida deslogado | Redireciona para login e volta autenticado; sem erro de Edge Runtime no log |
  | `admin` | 6 arquivos: `admin/login/`, `admin/forgot/`, `admin/reset/`, `components/admin/admin-shell.tsx`, `components/cms/site-switcher-provider.tsx` | Três superfícies distintas, não só uma: (a) login em `/admin/login`; (b) recuperação de senha ponta a ponta em `/admin/forgot` → `/admin/reset` — **use a sua
  própria conta de staff**: o e-mail de reset vai para a caixa dela, e é de lá que o link
  sai; não há inbox de teste em produção; (c) o seletor de site no shell do admin | Login autentica; reset conclui; o site-switcher lista e troca de site sem recarregar quebrado |
  | `cms-ui` | 39 arquivos, incl. `cms/(authed)/layout.tsx` | O maior consumidor: navegar 3 telas do CMS e abrir `cms/(authed)/settings` | Layout, nav e campos renderizam com estilo; nenhum componente sem CSS |
  | `cms-admin` | 4 arquivos (src+lib): `lib/cms/admin.ts` (`createCmsAdmin` — a fábrica, o consumidor que importa), `cms/(authed)/layout.tsx`, `cms/(authed)/blog/_components/posts-filters-connected.tsx`, `globals.css` | Filtrar a lista de posts em `/cms/blog` — passa pela fábrica e pelo componente | Filtro aplica e a lista atualiza |
  | `cms-reader` | `lib/cms/registry.tsx` (`LinkedH2/H3`), `lib/cms/reader-adapter.ts`, `styles/reader-pinboard.css` | Abrir um post publicado no site público, com heading de nível 2 e 3 | Âncoras de heading funcionam **e** o CSS importado do pacote aplica |
  | `seo` | **Nenhum.** `@tn-figueiredo/seo@0.1.0` está no `package.json:69` e não é importado por arquivo algum — `sitemap.ts`/`robots.ts` usam `@/lib/seo/*`, módulo local | **Não há tela neste app que o exercite.** Não finja: registre no relatório como "sem consumidor aqui; validar no repo do pacote" | Não se aplica — e o `curl` no sitemap continua valendo como smoke do *app*, só não conta como validação do *pacote* |
  | `ad-engine-admin` | `admin/(authed)/ads/page.tsx` (2 arquivos) | Abrir a tela de campanhas e salvar uma edição | Tela carrega e a Server Action de campanha grava |
- [ ] **6.2** Registrar o resultado por pacote em `docs/ops/ecosystem-next16-validation.md`.
  O resultado honesto é **seis validados por tela, um sem consumidor**. O `seo` sem import é
  achado por si: dependência declarada e morta, que ainda assim puxa peer de `next` para o
  `npm ci`. Registre; a remoção do `package.json` é commit separado, fora deste plano.
- [ ] **6.3** Registrar quais pacotes passaram e **abrir um plano de release separado** para
  estreitar os peers. Isto **não é um passo deste plano**: cada pacote vive no seu próprio
  repositório, e estreitar peer significa bump, publish no GitHub Packages e sincronizar os
  espelhos de versão — o `CLAUDE.md` trata "Ecosystem release" como evento próprio, e o
  histórico do projeto registra 53 pacotes com espelhos a sincronizar. Tratar isso como um
  bullet aqui esconderia um dia de trabalho dentro de um relatório.
  O entregável **deste** plano é a evidência; o release é o próximo plano.
- [ ] **6.3b Sentry sob Turbopack.** O `withSentryConfig` só liga quando
  `SENTRY_AUTH_TOKEN`/`ORG`/`PROJECT` existem — ou seja, nunca em dev local, só em preview e
  produção. Confirmar num preview da Vercel que o upload de source map ainda acontece sob
  Turbopack: procurar `@sentry/nextjs` no log de build (`vercel logs <url-do-preview>` ou o
  dashboard da Vercel) e disparar um evento de teste para ver se o stack trace vem resolvido.
  **Exige login no dashboard do Sentry** — `SENTRY_ORG`/`PROJECT`/`AUTH_TOKEN` estão vazios
  no `.env.local` por desenho (são build-only, vivem só na Vercel). Sem o dashboard, a
  alternativa é `vercel env pull --environment=production` e
  `npx @sentry/cli releases files <release> list` com o token puxado — apaga o arquivo
  depois. Uma regressão aqui não dá sinal nenhum localmente; aparece
  como stack trace ilegível no primeiro incidente de produção.
- [ ] **6.4** Decidir o contrato do `auth-nextjs`: manter a garantia edge e documentar que o consumidor deve ficar em `middleware.ts`, ou publicar variante para `proxy.ts` em Node com as implicações declaradas.

---

## Reversão

**Só o WP-1 é independente.** Ele não depende de nada e fica mesmo se todo o resto for
abortado.

**O WP-2 não sobrevive sozinho a um revert do WP-3.** Ele usa `updateTag` e a forma de dois
argumentos, que não existem no Next 15 — reverter só o WP-3 deixa a árvore sem compilar.
Abortar depois do WP-2 significa reverter WP-3 **e** WP-2 juntos, na mesma operação. A ordem
que torna a migração executável é a mesma que torna esses dois pacotes inseparáveis na volta;
não há como ter um sem o outro.

WP-3 isolado é um commit de dependência: `git revert` mais `npm ci` retornam ao estado
anterior. Nada em WP-1 a WP-4 escreve em produção. WP-5 e WP-6 acontecem depois do deploy.

**Se o revert acontecer depois de um deploy em produção na 16**, force o primeiro deploy de
volta sem cache (`vercel --force`, ou invalide o build cache no dashboard). O cache que o
Turbopack gravou não tem compatibilidade garantida com o pipeline webpack da 15, e um build
que reaproveite esse cache pode sair inconsistente sem erro visível.

## Fora de escopo

- O gate de audit — não é fechado por esta migração.
- `middleware` → `proxy` — rejeitado por decisão registrada (achado 5).
- `sharp` 0.35.4 e a remoção do `@vercel/og` — independentes, valem por si, não pertencem aqui.
- `cacheComponents` / PPR — o guia é explícito que não é renomeação, e sim adoção de outro modelo.
