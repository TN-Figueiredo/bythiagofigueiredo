# Lote 2.1 — Links

Arquivos do lote (todos `'use server'` exceto `lib/links/cache.ts`, que é helper puro):

- `apps/web/src/app/cms/(authed)/links/[id]/edit/actions.ts` — 1 chamada
- `apps/web/src/app/cms/(authed)/links/[id]/qr/actions.ts` — 3 chamadas
- `apps/web/src/app/cms/(authed)/links/[id]/qr/card-actions.ts` — 3 chamadas
- `apps/web/src/app/cms/(authed)/links/actions.ts` — 21 chamadas (inclui o helper `revalidateLinksHub`, 3 chamadas: `links-hub`, `sidebar-badges`, `` links:${siteId} ``)
- `apps/web/src/app/cms/(authed)/links/format-actions.ts` — 2 chamadas
- `apps/web/src/lib/links/cache.ts` — 3 chamadas

Total: 33 chamadas, batendo com o plano (~34, "33 chamadas do lote").

## Confirmação de callers de `lib/links/cache.ts` (antes de tocar)

`grep -rn "invalidateLink\|invalidateList\|invalidateAnalytics"` fora do próprio arquivo acha:
- `apps/web/src/app/api/cron/links-check-expiry/route.ts` — Route Handler (cron), chama `invalidateLink`/`invalidateList` direto.
- `apps/web/src/lib/links/container.ts` — injeta as três funções (`invalidateLink`, `invalidateList`, `invalidateAnalytics`) num objeto `cache` consumido por outro lugar (não Server Action).

Dois contextos de execução para o mesmo código → `updateTag` descartado por construção neste arquivo (regra do wp2-rules.md), não por leitor. Nenhum caller usa Server Action.

## Tabela por tag

| Tag | Leitor (de leitores.md) | Função | Perfil | Por quê |
|---|---|---|---|---|
| `links-hub` | `apps/web/src/app/cms/(authed)/links/page.tsx:437` — dono `unstable_cache(` (linha 56) | `revalidateTag` | `'seconds'` | Tela de staff compartilhada (hub de links). Chamada vive dentro do helper `revalidateLinksHub` em `actions.ts` — helper nunca vira `updateTag`, mesmo invocado de Server Action. Nomeada explicitamente na regra de "tela compartilhada" do wp2-rules.md. |
| `sidebar-badges` | `apps/web/lib/cms/sidebar-badges.ts:161` — dono `unstable_cache(` (linha 158) | `revalidateTag` | `'seconds'` | Contador de navegação compartilhado entre todo staff logado — "outra pessoa" na regra de desempate inclui outro membro do staff. Mesmo helper `revalidateLinksHub`. |
| `` links:${siteId} `` | sem leitor (`orfas.txt`: `links:*`) | `revalidateTag` | `'seconds'` | sem leitor — candidata a remoção. Chamada no helper `revalidateLinksHub` (`actions.ts:34`) e em `invalidateList` (`cache.ts:15`). |
| `` link:${id} `` / `` link:${linkId} `` / `` link:${input.link_id} `` | sem leitor (`orfas.txt`: `link:*`) — falso leitor descartado: `uploadMediaAsset(` em `links/actions.ts:781` e `qr/actions.ts:244`, que é metadata de upload, não `unstable_cache` | `revalidateTag` | `'seconds'` | sem leitor — candidata a remoção. Ocorre em `actions.ts` (5×, `link:${id}`), `actions.ts` (3×, `link:${input.link_id}`), `[id]/edit/actions.ts` (1×, `link:${id}`), `[id]/qr/actions.ts` (1×, `link:${linkId}`), `[id]/qr/card-actions.ts` (3×, `link:${linkId}`) = 13 chamadas. |
| `link-alerts` | sem leitor (`orfas.txt`: `link-alerts`) | `revalidateTag` | `'seconds'` | sem leitor — candidata a remoção. 5 chamadas em `actions.ts`. |
| `links-settings` | sem leitor (`orfas.txt`: `links-settings`) | `revalidateTag` | `'seconds'` | sem leitor — candidata a remoção. 5 chamadas em `actions.ts` + 2 em `[id]/qr/actions.ts` = 7 chamadas. |
| `canvas-formats` | sem leitor (`orfas.txt`: `canvas-formats`) | `revalidateTag` | `'seconds'` | sem leitor — candidata a remoção. 2 chamadas em `format-actions.ts`. |
| `` link:${siteId}:${code} `` | sem leitor (`orfas.txt`: `link:*:*`) — mesmo falso leitor de `uploadMediaAsset(` | `revalidateTag` | `'seconds'` | sem leitor — candidata a remoção. `cache.ts:invalidateLink`, chamado por cron + injeção via `container.ts` — nunca `updateTag` por construção (dois contextos de execução, nenhum Server Action). |
| `` link-analytics:${linkId} `` | sem leitor (`orfas.txt`: `link-analytics:*`) | `revalidateTag` | `'seconds'` | sem leitor — candidata a remoção. `cache.ts:invalidateAnalytics`, mesma injeção via `container.ts`. |

## Resumo

Todas as 33 chamadas do lote são `revalidateTag` com perfil `'seconds'`: as duas tags com
leitor real (`links-hub`, `sidebar-badges`) são tela de staff compartilhada — regra de
desempate manda `revalidateTag` mesmo dentro de Server Action; as outras 31 são órfãs e
caem no fallback padrão. `lib/links/cache.ts` nunca poderia usar `updateTag` de qualquer
forma (helper chamado fora de Server Action, por cron e por injeção via container).

```
esperado: updateTag 0 · {expire:0} 0 · 'seconds' 33 · 'minutes' 0 · 'max' 0
```

Nenhuma dúvida de classificação — todas as 9 tags do lote já estavam em `leitores.md`/
`orfas.txt` com decisão inequívoca (sem leitor, ou leitor de tela de staff).
