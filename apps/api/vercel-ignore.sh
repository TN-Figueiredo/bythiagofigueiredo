#!/bin/sh
# Passo "Ignored Build Step" da Vercel: exit 0 = pula o build, exit 1 = builda.
# Qualquer outro código a Vercel trata como ERRO; por isso nada aqui pode vazar 128 do git.
[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && exit 0
P="$VERCEL_GIT_PREVIOUS_SHA"
[ -n "$P" ] && git cat-file -e "$P^{commit}" 2>/dev/null \
  && git diff --quiet "$P" HEAD -- . ../../packages ../../package.json ../../package-lock.json ../../tsconfig.json ../../.npmrc \
  && exit 0
exit 1
