// capturar.mjs: captura e mede um mockup estático (sem o projeto de e2e, sem banco, sem porta 3099).
// Uso (da raiz do repositório):
//   node docs/superpowers/mockups/2026-10-13-a5-lote-2/capturar.mjs <pasta-do-mockup> <saida-dir> <porta 47710-47790> "arquivo.html?caso=x" "outro.html?caso=y" ...
// Para cada URL gera <saida-dir>/<arquivo>-<caso>-<1440|390>-<escuro|claro>.png (página inteira, 1440 escuro e 390 claro SÃO os pares obrigatórios;
// os quatro cruzamentos são gerados) e <saida-dir>/medidas.json com: rolagem horizontal, textos menores que 12 px, alvos de toque menores que 44 px a 390 (ponteiro grosso).
// Fontes e capas externas são bloqueadas (captura determinística). O servidor estático sobe na porta dada e cai ao terminar (derrube pelo PID se travar).
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const [pasta, saida, portaS, ...urls] = process.argv.slice(2);
if (!pasta || !saida || !portaS || !urls.length) { console.error('uso: node capturar.mjs <pasta> <saida-dir> <porta> <arquivo?query>...'); process.exit(2); }
const porta = Number(portaS);
if (porta < 47710 || porta > 47790) { console.error('porta fora de 47710-47790'); process.exit(2); }
const raiz = path.resolve(pasta); fs.mkdirSync(saida, { recursive: true });
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const p = path.join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(raiz) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': tipos[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(porta, '127.0.0.1');
const medidas = {};
const br = await chromium.launch();
try {
  for (const u of urls) for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) for (const tema of ['escuro', 'claro']) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    const pg = await ctx.newPage();
    const url = new URL(`http://127.0.0.1:${porta}/${u}`); if (tema === 'claro') url.searchParams.set('tema', 'claro');
    await pg.goto(url.href, { waitUntil: 'load' }); await pg.waitForTimeout(250);
    const nome = u.replace(/\.html\?/, '-').replace(/\.html$/, '').replace(/[?&=]/g, '-').replace(/[^a-z0-9-]/gi, '') + `-${w}-${tema}`;
    await pg.screenshot({ path: path.join(saida, nome + '.png'), fullPage: true });
    medidas[`${u}|${w}|${tema}`] = await pg.evaluate((alvo) => {
      const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('#mock'); };
      const fontes = [...document.querySelectorAll('body *')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30)).slice(0, 20);
      const alvos = alvo ? [...document.querySelectorAll('a[href],button,input,select,summary,[role=button],[tabindex="0"]')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(e => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30)).slice(0, 20) : [];
      return { rolagem: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth), fontesMenores: fontes, alvosMenores: alvos };
    }, w === 390);
    await ctx.close();
  }
} finally { await br.close(); srv.close(); }
fs.writeFileSync(path.join(saida, 'medidas.json'), JSON.stringify(medidas, null, 1));
console.log('ok', Object.keys(medidas).length, 'capturas em', saida);
