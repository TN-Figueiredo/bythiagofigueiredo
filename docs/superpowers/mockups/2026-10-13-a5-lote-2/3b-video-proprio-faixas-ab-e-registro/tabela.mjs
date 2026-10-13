import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
// tabela.mjs: imprime, por estado, os números que a tela mostra lidos do DOM renderizado e as somas recalculadas do que está desenhado (r4).
// Uso (da raiz do repositório): node docs/superpowers/mockups/2026-10-13-a5-lote-2/3b-video-proprio-faixas-ab-e-registro/tabela.mjs
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const casos = ['tipico','extremo','hoje','zero','semnumero','so-teste','so-reconstruido','vazio','erro','leitura'];
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(/^https?:\/\//, r => r.abort());
console.log('| Estado (hoje) | Cabeçalho: views / curtidas / comentários / engajamento / vezes o normal | Gráfico de views (frase) | Gráfico de impressões (frase) | Soma dos cliques desenhados / da coluna da tabela | Cada troca: antes e depois como a tela mostra |\n|---|---|---|---|---|---|');
for (const c of casos) {
  const pg = await ctx.newPage(); await pg.goto('file://' + dir + '/index.html?caso=' + c); await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => {
    const t = e => e ? e.innerText.replace(/\s+/g, ' ').trim() : '';
    const M = window.__b3.M, cells = [...document.querySelectorAll('.vh .nstrip > *')].map(t);
    const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));
    const nums = [...document.querySelectorAll('#gIm .ic-cln')].map(e => e.textContent.trim());
    const tab = [...document.querySelectorAll('#gIm .ic-tab tbody tr')].map(tr => tr.children[2].textContent.trim());
    const soma = a => a.filter(x => /^\d/.test(x)).reduce((s, x) => s + num(x), 0);
    const trocas = [...document.querySelectorAll('.tr-it')].map((it, i) => { const tx = t(it); const g = w => { const m = tx.match(new RegExp(w + ': (\\d+ dias?(?: medidos)? \\([^)]*\\), [\\d.]+ impress(?:ões|ão)|sem dias para comparar|ainda sem dia medido)')); return m ? m[1] : '—'; }; return (i + 1) + ': antes ' + g('Antes') + '; depois ' + g('Depois'); });
    const v = M.video, cabTxt = A4.mil ? [v.views >= 1000 ? A4.mil(v.views) : v.views, A4.n(v.likes), A4.n(v.com), v.eng == null ? 'não medido' : A4.pct(v.eng, 1), v.normal == null ? 'não medido' : A4.dec(v.normal, 1) + '×'].join(' / ') : '';
    return { hoje: M.hoje, cab: cabTxt, fv: t(document.querySelector('#gVw p:not(.ic-sub)')), fi: t(document.querySelector('#gIm p')), nums: nums.length ? soma(nums) + ' (' + nums.length + ' rótulos)' : 'sem rótulos numéricos', tab: tab.some(x => x === '<1') ? 'dias com "<1": a tabela não soma' : soma(tab), trocas };
  });
  console.log('| `' + c + '` (' + r.hoje.slice(8) + '/' + r.hoje.slice(5, 7) + ') | ' + r.cab + ' | ' + r.fv + ' | ' + (r.fi || '').replace(/: \d+ com impressão.*$/, '') + ' | ' + r.nums + ' / ' + r.tab + ' | ' + r.trocas.join('<br>') + ' |'); await pg.close();
}
await br.close();
