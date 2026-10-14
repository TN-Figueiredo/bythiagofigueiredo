// Preload dos scripts de linha de comando: @tn-figueiredo/social só exporta a condição "import" (ESM),
// e o tsx carrega os scripts como CommonJS. Resolve os subcaminhos do pacote pelo campo "import" do exports;
// o Node 22+ carrega o arquivo ESM por require. Uso: --require ./apps/web/scripts/_social-esm.cjs
const Module = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const PACOTE = '@tn-figueiredo/social'
const original = Module._resolveFilename
Module._resolveFilename = function (pedido, ...resto) {
  if (pedido === PACOTE || pedido.startsWith(PACOTE + '/')) {
    const pai = resto[0]
    const pastas = (pai && pai.paths) || Module._nodeModulePaths(process.cwd())
    const pkgJson = pastas.map((p) => path.join(p, PACOTE, 'package.json')).find((f) => fs.existsSync(f))
    const mapa = pkgJson ? JSON.parse(fs.readFileSync(pkgJson, 'utf8')).exports : null
    const sub = '.' + pedido.slice(PACOTE.length)
    const alvo = mapa && mapa[sub] && mapa[sub].import
    if (alvo) return path.join(path.dirname(pkgJson), alvo)
  }
  return original.call(this, pedido, ...resto)
}
