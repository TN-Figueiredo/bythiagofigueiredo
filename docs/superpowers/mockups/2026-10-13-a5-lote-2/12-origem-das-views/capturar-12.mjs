import { createRequire } from 'module';
const require = createRequire('/Users/figueiredo/Workspace/bythiagofigueiredo/package.json');
const { chromium } = require('playwright');
import fs from 'fs';
const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const ALL = [
 ['tipico-video',''],['tipico-video-tudo','periodo=tudo'],['tipico-canal-7','tela=canal'],['tipico-canal-28','tela=canal&periodo=28'],['tipico-canal-90','tela=canal&periodo=90'],['tipico-canal-tudo','tela=canal&periodo=tudo'],
 ['extremo-canal','estado=extremo'],['magro-canal','estado=magro'],['magro-canal-7','estado=magro&periodo=7'],['zero-video','estado=zero'],['zero-video-tudo','estado=zero&periodo=tudo'],
 ['nao-medido-video','estado=nao-medido'],['nao-medido-canal','tela=canal&estado=nao-medido'],['nao-medido-canal-90','tela=canal&estado=nao-medido&periodo=90'],
 ['vazio-video','estado=vazio'],['erro-video','estado=erro'],['erro-canal','tela=canal&estado=erro'],
 ['leitura-sem-termos','estado=leitura'],['leitura-so-total','estado=leitura&leitura=so-total'],['leitura-canal-so-total','tela=canal&estado=leitura&leitura=so-total'],
 ['carregando-canal','estado=carregando'],['revisao-video','estado=revisao'],['revisao-canal','tela=canal&estado=revisao'],
 ['cartao-tipico','tela=cartao'],['cartao-extremo','tela=cartao&estado=extremo'],['cartao-magro','tela=cartao&estado=magro'],['cartao-zero','tela=cartao&estado=zero'],['cartao-vazio','tela=cartao&estado=vazio'],
 ['cartao-nao-medido','tela=cartao&estado=nao-medido'],['cartao-erro','tela=cartao&estado=erro'],['cartao-carregando','tela=cartao&estado=carregando'],['cartao-revisao','tela=cartao&estado=revisao'],['cartao-leitura','tela=cartao&estado=leitura&leitura=so-total']
];
const only = process.argv.slice(2);
const list = only.length ? ALL.filter(a => only.includes(a[0])) : ALL;
const b = await chromium.launch();
const medidas = [];
for (const [nome, qs] of list) for (const [w, tema, hMin] of [[1440,'escuro',900],[390,'claro',800]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: hMin }, hasTouch: w < 500, isMobile: false, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const erros = []; pg.on('pageerror', e => erros.push(String(e))); pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const q = (qs ? qs + '&' : '') + (tema === 'claro' ? 'tema=claro' : '');
  await pg.goto('file://' + DIR + '/index.html' + (q ? '?' + q : ''));
  await pg.waitForSelector('#screen');
  await pg.waitForTimeout(150);
  const m = await pg.evaluate(() => {
    const out = { rolagem: document.documentElement.scrollWidth - document.documentElement.clientWidth, fontes: [], alvos: [] };
    const sc = document.getElementById('screen');
    sc.querySelectorAll('*').forEach(el => { const cs = getComputedStyle(el); if (el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < 12) out.fontes.push(el.className + ':' + cs.fontSize); });
    sc.querySelectorAll('a,button,[tabindex]').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.width < 44 || r.height < 44)) out.alvos.push((el.className || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
    return out;
  });
  const f = `${DIR}/shots/${nome}-${w}-${tema}.png`;
  await pg.screenshot({ path: f, fullPage: true });
  medidas.push({ nome, w, tema, ...m, erros });
  await ctx.close();
}
await b.close();
fs.writeFileSync(DIR + '/medidas.json', JSON.stringify(medidas, null, 1));
for (const m of medidas) console.log(m.nome, m.w, m.tema, 'rol', m.rolagem, 'fontes', m.fontes.length, 'alvos', m.alvos.length, m.erros.length ? 'ERROS ' + m.erros.join('|') : '');
