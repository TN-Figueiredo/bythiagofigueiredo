# Runbook — validar o CMS autenticado localmente (e2e com credenciais falsas)

**Por quê:** a promoção do Next 16 (2026-09-05) deixou `/cms` em 500 por ~11 h sem nenhum
gate perceber. CI, `next build`, smoke público e `/api/health` não têm sessão; o erro
(`Functions cannot be passed directly to Client Components`, `next/link` passado como prop
ao `CmsAdminProvider`) só aparece **logado**. Este runbook reproduz o CMS inteiro em
minutos, sem tocar em produção.

## Pré-requisitos
Docker rodando; nada em produção é lido nem escrito (Supabase e API locais).

## Passos (~5 min)

```bash
# 1. Supabase local com todas as migrations
npm run db:start && npm run db:reset          # ou só db:start se já estiver atualizado
npm run db:env                                 # gera apps/{web,api}/.env.local-db

# 2. Senha FALSA para o usuário staff semeado (só existe no banco local)
SRK=$(grep ^SUPABASE_SERVICE_ROLE_KEY= apps/web/.env.local-db | cut -d= -f2-)
curl -s -X PUT http://127.0.0.1:54321/auth/v1/admin/users/00000000-0000-0000-0000-000000000001 \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H 'Content-Type: application/json' \
  -d '{"password":"cms-e2e-local-2026","email_confirm":true}'

# 3. API (o login por senha passa pelo Fastify: NEXT_PUBLIC_API_URL/auth/signin)
(cd apps/api && npx tsx --env-file=.env.local-db src/index.ts) &

# 4. Web em dev, env local + chaves de TESTE do Turnstile (sempre passam)
(cd apps/web && set -a && source .env.local-db && set +a \
  && unset NEXT_PUBLIC_SENTRY_DSN SENTRY_DSN \
  && NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
     TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
     npx next dev -p 3997) &
```

Armadilhas já pagas:
- **Não** exporte variáveis vazias (`TURNSTILE_SECRET_KEY=`): o schema é `min(1).optional()`
  e string vazia derruba `getServerEnv()` → "Erro de comunicação com o servidor" em 3 ms.
- Sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` a chave real do `.env.local` entra e o widget recusa
  `localhost` ("Unable to connect"). Use as chaves de teste acima.
- `localhost` já está em `sites.domains` na migration de seed — o middleware resolve o site.

## Validação (navegador controlado — chrome-devtools MCP ou Playwright)
1. `http://localhost:3997/cms/login?next=%2Fcms` → `thiago@bythiagofigueiredo.com` /
   `cms-e2e-local-2026` → deve cair no dashboard com a sidebar completa e `super_admin`.
2. Varredura server-side de todas as rotas da sidebar, com a sessão do navegador:

```js
// evaluate no console da página /cms
const hrefs = [...new Set([...document.querySelectorAll('nav[aria-label="CMS Navigation"] a')].map(a => a.getAttribute('href')))];
for (const h of hrefs) { const r = await fetch(h, { credentials: 'include' }); const t = await r.text();
  console.log(h, r.status, /Something went wrong/.test(t) ? 'BOUNDARY' : 'ok'); }
```
   Esperado: todas 200 e `ok`. (2026-09-06 após o fix: 26/26.)
3. Navegar de verdade (hidratação + navegação suave) nas páginas pesadas: Blog, editor de
   post, Newsletters, YouTube/Channels, Up Next, Settings — console sem `error`.

## Onde os erros aparecem
- Servidor: log do `next dev` (stack + `digest`). Em prod: `vercel logs --environment production --level error -n 500 -x`.
- Cliente: console do navegador; o boundary de `/cms` (`src/app/cms/error.tsx`) mostra o digest.

## Instagram OAuth — E2E local (5 min, autenticado)

Pré-requisito: túnel HTTPS local (o `http://localhost` é recusado como Redirect URI) **ou** o host de
loopback declarado em `sites.domains` (o `resolveOAuthOrigin` aceita loopback fora de produção).

1. `npm run dev -w apps/web`, entrar no CMS e abrir `/cms/settings/instagram`.
2. Clicar em **Connect with Instagram** e conferir, no DevTools (aba Network, "Preserve log"), que a
   resposta é **302** para `https://www.instagram.com/oauth/authorize?...` com
   `scope=instagram_business_basic`, `enable_fb_login=false` e **sem** `force_reauth`.
3. Sem completar na Meta, abrir manualmente
   `/api/instagram/oauth/callback?code=fake&state=<o state da URL do passo 2>` na MESMA janela
   (o cookie de nonce está no navegador): a página do popup mostra
   **"Instagram rejected the authorization"** e o opener sai de `In progress`.
4. Conferir que o card voltou ao estado anterior e que `/cms/settings/instagram` redireciona para
   `/cms/settings?section=instagram`.
