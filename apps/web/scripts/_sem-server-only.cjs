// Preload dos scripts de linha de comando: `server-only` não está instalado (o Next o fornece no build e o vitest usa um stub).
// Fora do Next, resolve o módulo para um arquivo vazio. Uso: npx tsx --require ./apps/web/scripts/_sem-server-only.cjs <script>
const Module = require('node:module')
const vazio = require.resolve('./_vazio.cjs')
const original = Module._resolveFilename
Module._resolveFilename = function (pedido, ...resto) {
  if (pedido === 'server-only') return vazio
  return original.call(this, pedido, ...resto)
}
