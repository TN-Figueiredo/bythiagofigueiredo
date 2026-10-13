import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
// derivacao.mjs (r6): imprime, por estado, cada número que a tela mostra, DE ONDE ele deriva na fonte única (3b-dados.js) e com que outro número da mesma tela ele fecha,
// e confere cada linha contra o texto renderizado ("ok" só se o número aparece na tela E a conta fecha). Saída em markdown para a NOTAS.md.
// Uso (da raiz do repositório): node docs/superpowers/mockups/2026-10-13-a5-lote-2/3b-video-proprio-faixas-ab-e-registro/derivacao.mjs   (W=390 para a largura estreita)
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const casos = ['tipico','extremo','hoje','zero','semnumero','so-teste','so-reconstruido','vazio','erro','leitura'];
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: Number(process.env.W || 1440), height: 900 } });
await ctx.route(/^https?:\/\//, r => r.abort());
let ruins = 0;
for (const c of casos) {
  const pg = await ctx.newPage(); await pg.goto('file://' + dir + '/index.html?caso=' + c); await pg.waitForTimeout(300);
  const rows = await pg.evaluate(() => {
    const A = window.A4, M = window.__b3.M, v = M.video, tela = document.getElementById('screen').innerText.replace(/\s+/g, ' ');
    const R = [], add = (num, deriva, fecha, ok, aparece) => R.push([num, deriva, fecha, ok && (aparece === undefined || tela.includes(aparece)) ? 'ok' : 'FALHA']);
    const ms = M.views.filter(x => x.e !== 'nm'), tot = ms.reduce((a, x) => a + x.v, 0), nmN = M.views.length - ms.length, est = Math.round(tot / ms.length * nmN);
    const idade = A.dias(v.pub, M.hoje);
    add('há ' + idade + ' dias', 'de ' + A.dm(v.pub) + ' a ' + A.dm(M.hoje), 'posição "vídeo ' + Math.min(35, 1 + Math.floor(idade / 5)) + ' de 35" = 1 + idade ÷ 5', true, 'há ' + idade + ' dias');
    add(A.n(v.views) + ' views no cabeçalho', M.viewsAntes + ' antes do gráfico + ' + tot + ' dos dias medidos + ' + est + ' estimadas (' + nmN + ' dias não entregues)', 'maior ou igual aos ' + M.vistaViews.reduce((a, x) => a + (x.v || 0), 0) + ' views do gráfico', v.views >= M.vistaViews.reduce((a, x) => a + (x.v || 0), 0));
    add(A.n(v.likes) + ' curtidas + ' + A.n(v.com) + ' comentários = ' + A.pct(v.eng, 1) + ' de engajamento', 'views × ' + M.lr + ' e × ' + M.cr, (v.likes + v.com) + ' ÷ ' + v.views + ' = ' + A.pct((v.likes + v.com) / v.views, 1), Math.abs(v.eng - (v.likes + v.com) / v.views) < 1e-9, A.pct(v.eng, 1));
    const vv = M.vistaViews, dm = vv.filter(x => x.e !== 'nm').length, sv = vv.reduce((a, x) => a + (x.v || 0), 0);
    add(A.n(sv) + ' views em ' + dm + ' dias medidos (' + vv.length + ' dias no eixo)', 'soma do gráfico de views, de ' + A.dm(vv[0].d) + ' a ' + A.dm(vv[vv.length - 1].d), dm + ' medidos + ' + (vv.length - dm) + ' não medidos = ' + vv.length + ' dias; não medidos: ' + vv.filter(x => x.e === 'nm').map(x => A.dm(x.d)).join(', '), dm + (vv.length - dm) === vv.length, A.n(sv) + (sv === 1 ? ' view' : ' views') + ' em ' + dm + ' dias medidos');
    if (M.leitor !== 'leitura') {
      const S = M.vistaImp, com = S.filter(x => x.e === 'com'), zer = S.filter(x => x.e === 'zero'), nm = S.filter(x => x.e === 'nm'), imp = com.reduce((a, x) => a + x.v, 0), cl = com.reduce((a, x) => a + x.cl, 0);
      add(A.n(imp) + ' impressões em ' + S.length + ' dias', 'soma do gráfico de impressões', com.length + ' com impressão + ' + zer.length + ' zero medido + ' + nm.length + ' não medidos = ' + (com.length + zer.length + nm.length) + '; views (' + sv + ') ≤ impressões', com.length + zer.length + nm.length === S.length && sv <= imp || imp === 0, A.n(imp) + (imp === 1 ? ' impressão' : ' impressões') + ' e');
      add('cliques estimados: ' + (com.some(x => x.cl >= 1) ? Math.round(com.reduce((a, x) => a + Math.round(x.cl), 0)) : 'cerca de ' + Math.round(cl)), 'impressões de cada dia × taxa do dia, somadas', com.some(x => x.cl >= 1) ? 'soma dos rótulos sob as barras (a 1440)' : 'todo dia abaixo de 1 clique: soma exata arredondada', true);
    }
    M.trocas.forEach((t, k) => {
      const le = window.B3D.leitura(M, k);
      const mostra = le.k !== 'semorigem' && M.leitor !== 'leitura'; /* origem não sabida e leitura (sem acesso ao número privado): a tela não escreve os lados */
      if (!mostra) { add('troca ' + t.n + ': lados antes e depois', 'não aparecem na tela (' + (M.leitor === 'leitura' ? 'quem só lê não vê impressões' : 'origem não sabida: sem comparação') + ')', 'a tela não escreve número de lado nenhum', !/Antes: \\d+ dia|Depois: \\d+ dia/.test(tela)); return; }
      ['a', 'd'].forEach(q => { const l = le[q], nome = q === 'a' ? 'Antes' : 'Depois'; if (!l.dias) { add('troca ' + t.n + ' ' + nome + ': ' + l.st, 'sem dia medido na janela (' + (l.por ? 'vizinha em ' + A.dm(l.por.d) : l.motivo || 'dia ainda não entregue') + ')', '—', true); return; }
        const cal = A.dias(l.de, l.ate) + 1, nmN2 = (l.nm || []).length;
        add('troca ' + t.n + ' ' + nome + ': ' + l.dias + (l.dias === 1 ? ' dia' : ' dias') + ', ' + A.dm(l.de) + ' a ' + A.dm(l.ate) + (nmN2 ? ', sem ' + l.nm.map(A.dm).join(', ') : '') + ', ' + A.n(l.imp) + ' impressões', 'soma da série no intervalo; ficam de fora ' + (q === 'a' ? 'o dia anterior e o dia da troca (' + A.dm(A.addDias(t.d, -1)) + ' e ' + A.dm(t.d) + ')' : 'o dia da troca (' + A.dm(t.d) + ')') + ' e os dias além de outra troca ou ciclo', cal + ' dias de calendário - ' + nmN2 + ' não medidos = ' + (cal - nmN2) + ' = ' + l.dias, cal - nmN2 === l.dias, A.dm(l.de)); });
      if (le.d.depois && le.d.dia1) add('troca ' + t.n + ': primeiro dia ' + A.dm(le.d.dia1) + ', chega ' + A.dm(le.d.primeiro) + ', completa ' + A.dm(le.d.cheia), 'troca ' + A.dm(t.d) + ' + 1, + 3, + 9', 'chega (' + A.dm(le.d.primeiro) + ') depois de hoje (' + A.dm(M.hoje) + ')', le.d.primeiro > M.hoje, A.dm(le.d.cheia));
    });
    /* r7/N2: a frase-resumo do topo existe em todo estado; o que ela conta sai de trocas, testes e pre */
    { const el = document.querySelector('.tr-res'), tx = el ? el.innerText.replace(/\s+/g, ' ') : '', nT = M.trocas.length, nTe = M.testes.length;
      add('frase do topo: ' + (nT || nTe ? nT + ' trocas e ' + nTe + ' testes A/B' : 'nenhuma troca' + (M.pre ? ' e 1 teste reconstruído' : '')), 'conta de M.trocas (' + nT + '), M.testes (' + nTe + ')' + (M.pre ? ' e M.pre (' + M.pre.teste.replace(/\/\d{4}$/, '') + ')' : ''), 'começa por "Trocas deste vídeo" ou pela contagem; ' + (nT ? 'bate com os ' + nT + ' cartões da lista' : 'bate com 0 cartões na lista') + (M.pre ? '; a faixa reconstruída está abaixo' : ''), !!el && /^(exemplo )?(Trocas deste vídeo|\d+ trocas?)/.test(tx) && document.querySelectorAll('.tr-it').length === nT && (!M.pre || (/foi reconstruído/.test(tx) && !!document.querySelector('.vb-pre'))) && (nT || nTe || /nenhuma desde 07\/10/.test(tx))); }
    /* r8/S2: taxa de clique e faixa de 95% de cada lado com 100 impressões ou mais (Wilson, recalculada de cliques e impressões do lado), "o normal do canal", duração e total por tipo de leitura */
    if (M.leitor !== 'leitura') M.trocas.forEach((t, k) => { const le = window.B3D.leitura(M, k); if (le.k === 'semorigem') return;
      ['a', 'd'].forEach(q => { const l = le[q], nome = q === 'a' ? 'Antes' : 'Depois'; if (!l.dias || !(l.imp >= A.MIN_IMP)) return;
        const p = l.cliques / l.imp, w = A.wilson(l.cliques, l.imp), f1 = x => (x * 100).toFixed(1).replace('.', ','), txt = f1(p) + '% [' + f1(w[0]) + ' a ' + f1(w[1]) + ']';
        add('troca ' + t.n + ' ' + nome + ': taxa ' + f1(p) + '%, faixa de 95% de ' + f1(w[0]) + '% a ' + f1(w[1]) + '%', 'Wilson sobre ' + Math.round(l.cliques) + ' cliques estimados e ' + A.n(l.imp) + ' impressões do lado', 'faixa contém a taxa; lado com 100 impressões ou mais (' + A.n(l.imp) + ')', w[0] <= p && p <= w[1] && l.imp >= A.MIN_IMP, f1(p) + '%'); }); });
    if (v.normal != null) add((v.normal.toFixed(1).replace('.', ',')) + '× o normal do canal', A.n(v.views) + ' views do vídeo ÷ ' + A.n(M.mediana) + ' (mediana dos outros vídeos)', 'mesmo número de views do cabeçalho (' + A.n(v.views) + ')', Math.abs(v.normal - v.views / M.mediana) < 1e-9, v.normal.toFixed(1).replace('.', ',') + '×');
    add('duração ' + A.dur(v.dur), v.dur + ' segundos', 'vídeo longo (mais de 60 segundos)', v.dur > 60, A.dur(v.dur));
    { const tl = [...document.querySelectorAll('.vb-tally li b.num')].map(e => +e.innerText); if (tl.length) add('trocas por tipo de leitura: ' + tl.join(' + ') + ' = ' + tl.reduce((a, x) => a + x, 0), 'uma leitura por troca (M.trocas)', 'total = ' + M.trocas.length + ' trocas da frase do topo e da lista', tl.reduce((a, x) => a + x, 0) === M.trocas.length); }
    /* r8/N3: falha de leitura aparece na frase do topo, com a data de corte e as datas da falha */
    if (M.registro.ok === false) { const tx = (document.querySelector('.tr-res') || {}).innerText || ''; add('aviso de falha na frase do topo', 'M.registro: última leitura boa ' + A.dm(M.registro.ultima) + ', falhou em ' + A.dm(M.registro.falhaDe) + ' e ' + A.dm(M.hoje), 'o aviso completo (role="alert") está abaixo e diz as mesmas datas', /falharam/.test(tx) && tx.includes(A.dm(M.registro.ultima)) && tx.includes(A.dm(M.registro.falhaDe)) && tx.includes(A.dm(M.hoje)) && !!document.querySelector('.vb-erro')); }
    M.testes.forEach(te => add('teste ' + A.dm(te.de) + (te.ate ? ' a ' + A.dm(te.ate) : ' em andamento') + ', ' + te.ciclos.length + ' ciclos', 'ciclos ' + te.ciclos.map(A.dm).join(', '), 'cada ciclo entre o início e ' + (te.ate ? A.dm(te.ate) : 'hoje ' + A.dm(M.hoje)), te.ciclos.every(x => x >= te.de && x <= (te.ate || M.hoje)), te.ciclos.length + ' ciclo'));
    return R;
  });
  console.log('\n#### `' + c + '`\n\n| Número na tela | Deriva de | Fecha com | Confere na tela |\n|---|---|---|---|');
  rows.forEach(r => { console.log('| ' + r.join(' | ') + ' |'); if (r[3] !== 'ok') ruins++; });
  await pg.close();
}
await br.close(); console.log('\nlinhas com FALHA: ' + ruins);
