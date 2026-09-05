> **SUPERADO EM 2026-09-05.** Os perfis registrados aqui foram todos trocados por
> `{ expire: 0 }` — perfil nomeado serve conteudo velho e nao e paridade com o Next 15.
> Ver `CORRECAO-perfis-vs-paridade.md`. A medicao de leitores continua valida.

# Lote 2.5 — Settings, Contacts, Media, Ads, Social

Arquivos do lote:
- `apps/web/src/app/(public)/contact/actions.ts`
- `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts`
- `apps/web/src/app/admin/(authed)/ads/_actions/slot-config.ts`
- `apps/web/src/app/admin/(authed)/settings/ads/_actions.ts`
- `apps/web/src/app/api/cron/instagram-sync/route.ts`
- `apps/web/src/app/cms/(authed)/contacts/actions.ts`
- `apps/web/src/app/cms/(authed)/media/actions.ts`
- `apps/web/src/app/cms/(authed)/settings/actions.ts`
- `apps/web/src/lib/social/actions/_shared.ts`

Nenhum destes arquivos tem `updateTag` neste lote — nenhuma tag do lote atende ao
critério "quem salvou é quem vai ler" (canônico do wp2-rules.md). Todas caem em
`revalidateTag`, por três motivos possíveis: exceção público→admin, tela
compartilhada de staff, leitura por visitante público, ou órfã sem leitor.

## Tabela por tag

| Tag | Leitor (leitores.md) | Função | Perfil | Por quê |
|---|---|---|---|---|
| `layout-counts` (`contact/actions.ts:131`) | `apps/web/lib/cms/layout-counts.ts:37` (`unstable_cache`) | `revalidateTag` | `'seconds'` | Server Action **pública**, mas o leitor é o badge do painel admin — exceção "público → admin" nomeada explicitamente no wp2-rules.md para este arquivo |
| `layout-counts` (`contacts/actions.ts:54,79,103,130,211`; `settings/actions.ts:512`) | idem | `revalidateTag` | `'seconds'` | contador de navegação compartilhado entre staff — regra de tela compartilhada (quem edita não é necessariamente quem vê o contador atualizado) |
| `ads` (`campaigns.ts:91,119,131,219,257`; `slot-config.ts:76`; `settings/ads/_actions.ts:36`) | `apps/web/src/lib/ads/resolve.ts:352` (`unstable_cache(..., { tags: ['ads'], revalidate: 300 })`) | `revalidateTag` | `'minutes'` | lido por **visitante** em página pública do blog — "quarto caso" do wp2-rules.md; vale mesmo dentro de Server Action, porque quem lê não é quem salvou |
| `` ad:slot-config:${appId} `` (`slot-config.ts:74`) | sem leitor | `revalidateTag` | `'seconds'` (fallback) | órfã — candidata a remoção |
| `` ad:slot:${slotKey} `` (`slot-config.ts:75`) | sem leitor | `revalidateTag` | `'seconds'` (fallback) | órfã — candidata a remoção |
| `instagram-feed` (`instagram-sync/route.ts:89`; `settings/actions.ts:602,633,718`) | `apps/web/lib/home/queries.ts:429` (`unstable_cache`, `getInstagramPosts`) | `revalidateTag` | `'minutes'` | lido por visitante na home pública — mesma regra de `ads`. Em `instagram-sync/route.ts` (Route Handler/cron) a função já seria `revalidateTag` por contexto; o perfil ainda vem do leitor, não `{ expire: 0 }` |
| `` media:gallery:${siteId} ``, `` media:stats:${siteId} ``, `` media:asset:${assetId} `` (`media/actions.ts:54-56`, helper `revalidateMedia`) | sem leitor | `revalidateTag` | `'seconds'` (fallback) | órfãs — candidatas a remoção. Helper nunca usa `updateTag` (chamado de múltiplas actions, contexto misto) |
| `seo-config` (`settings/actions.ts:97,115,132,348`) | `apps/web/lib/seo/config.ts:70` | `revalidateTag` | `'seconds'` | **override explícito** do wp2-rules.md, seção "Cobre o resto do lote 2.5": *"'layout-counts', 'youtube' e 'seo-config' no mesmo lote continuam 'seconds' pela regra de tela compartilhada"*. Ver dúvida registrada abaixo — a tabela geral do mesmo documento classifica o mesmo leitor como "crawler e visitante → 'minutes'" quando a chamada vem do helper `lib/seo/cache-invalidation.ts` (lote 2.3, mesma tag, mesmo leitor) |
| `youtube` (`settings/actions.ts:323,466,511`) | `apps/web/src/app/cms/(authed)/youtube/page.tsx:122`, `apps/web/src/lib/youtube/queries.ts:124`, `apps/web/lib/home/queries.ts:282,328,393,411` | `revalidateTag` | `'seconds'` | regra de tela compartilhada — tag nomeada explicitamente na generalização do wp2-rules.md e reafirmada no override específico do lote 2.5 |
| `social` (`_shared.ts:29`, helper `revalidateSocialPaths`) | sem leitor | `revalidateTag` | `'seconds'` (fallback) | órfã — candidata a remoção. Helper nunca usa `updateTag` |

## Dúvida registrada

`seo-config`, dentro de `cms/(authed)/settings/actions.ts`, tem leitor real em
`lib/seo/config.ts` que é consumido por sitemap, robots e metadata (crawler +
visitante). A regra do "leitor decide o perfil" apontaria `'minutes'` aqui,
igual à classificação já registrada para o helper `lib/seo/cache-invalidation.ts`
(lote 2.3) que invalida a mesma tag. Mas o wp2-rules.md tem uma frase dirigida
explicitamente a este lote — *"'seo-config' no mesmo lote continua 'seconds'
pela regra de tela compartilhada"* — que eu seguí como diretiva autoritativa,
por ser posterior e nomeada ("no mesmo lote" = lote 2.5). Registro a divergência
para o WP-6 conferir: mesma tag, mesmo leitor, dois perfis diferentes
dependendo de qual arquivo chama `revalidateTag`, o que tecnicamente contraria
"o leitor decide o perfil, nunca o call site" — mas é o que o documento pede
por nome para este lote.

## Expectativa

```
esperado: updateTag 0 · {expire:0} 0 · 'seconds' 16 · 'minutes' 15 · 'max' 0
```

Total: 31 chamadas de `revalidateTag` nos 9 arquivos do lote (0 `updateTag`,
0 `{expire:0}`, 16 `'seconds'`, 15 `'minutes'` (após a reconciliação de `seo-config`, ver rodapé), 0 `'max'`).

Route Handler do lote (`instagram-sync/route.ts`): confirmar `! grep -q
"updateTag(" instagram-sync/route.ts` no portão final — não deve ter nenhum.


**Reconciliação do controller (2026-09-04):** `seo-config` ×4 em `settings/actions.ts` movida de `'seconds'` para `'minutes'` — o leitor medido (`lib/seo/config.ts`, usado por sitemap/robots/metadata) é público, e o lote 2.3 já a classificou assim pelo mesmo leitor. A frase do plano "seo-config continua 'seconds'" era inferência pelo nome; a medição vence. Esperado corrigido: `'seconds' 16 · 'minutes' 15`.
