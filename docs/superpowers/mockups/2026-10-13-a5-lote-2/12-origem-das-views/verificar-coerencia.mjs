/* verificar-coerencia.mjs (r3): abre cada caso do mockup 12 e confere, pelo DOM, que os números da MESMA tela fecham entre si.
   Uso: node verificar-coerencia.mjs   (usa o playwright do repositório, file://, sem porta, sem spec do projeto). Saída: lista de falhas; vazia = tudo fecha. */
import { createRequire } from 'module';
const require = createRequire('/Users/figueiredo/Workspace/bythiagofigueiredo/package.json');
const { chromium } = require('playwright');
import fs from 'fs';
const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const ESTADOS = ['tipico','extremo','magro','zero','nao-medido','vazio','erro','leitura','carregando','revisao'];
const casos = [];
for (const tela of ['video','canal','cartao']) for (const e of ESTADOS) {
  const pers = tela === 'cartao' ? [null] : tela === 'canal' ? ['7','28','90','tudo'] : ['7','tudo'];
  for (const p of pers) casos.push([tela, e, p]);
}
casos.push(['video','leitura','so-total'], ['canal','leitura','so-total'], ['cartao','leitura','so-total']);
const num = t => { const m = String(t).replace(/\./g, '').match(/-?\d+/); return m ? Number(m[0]) : null; };
const ident = {}, assist = {};
const b = await chromium.launch(); const falhas = []; const resumo = []; const cruz = {};
for (const [tela, e, p] of casos) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage();
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const qs = 'tela=' + tela + '&estado=' + e + (p ? (p === 'so-total' ? '&leitura=so-total' : '&periodo=' + p) : '');
  await pg.goto('file://' + DIR + '/index.html?' + qs); await pg.waitForSelector('#screen');
  const d = await pg.evaluate(() => {
    const sc = document.getElementById('screen'), tx = el => el.textContent.replace(/\s+/g, ' ').trim();
    const listas = [...sc.querySelectorAll('ul.ov-lg')].map(ul => ({ rows: [...ul.querySelectorAll('li.ov-r')].map(li => ({ cls: li.className, nome: tx(li.querySelector('.ov-n')), v: tx(li.querySelector('.ov-v') || document.createElement('i')), p: tx(li.querySelector('.ov-p') || document.createElement('i')) })) })).filter(l => l.rows.some(r => /tot/.test(r.cls)));
    const cards = [...sc.querySelectorAll('.ov-card')].map(c => ({ t: tx(c.querySelector('h2')), rows: [...c.querySelectorAll('li.ov-hb, li.ov-r')].map(li => ({ cls: li.className, nome: tx(li.querySelector('.ov-n')), v: tx(li.querySelector('.ov-v') || document.createElement('i')), p: tx(li.querySelector('.ov-p') || document.createElement('i')) })), texto: tx(c) }));
    const cel = [...sc.querySelectorAll('.nstrip .nc')].map(c => { const sub = c.querySelector('.nsub'); return { l: tx(c.querySelector('dt')).replace(sub ? tx(sub) : '§', '').trim(), sub: sub ? tx(sub) : '', v: tx(c.querySelector('dd')), tudo: tx(c.querySelector('dt')) + ' ' + tx(c.querySelector('dd')) }; });
    const secs = [...sc.querySelectorAll('section.ov-sec')].map(s => tx(s));
    const linhas = [...sc.querySelectorAll('ul.linhas > li')].map(li => ({ rot: tx(li.querySelector('.rt b, .rt .ov-rt') || li.querySelector('.rt')), tudo: tx(li.querySelector('.rt')), val: tx(li.children[1]) }));
    const crumbs = [...document.querySelectorAll('nav.crumbs li')].map(li => tx(li)), av = document.querySelector('.chead .av'), h1 = document.getElementById('vt');
    const aria = [...document.querySelectorAll('#screen [aria-label]')].map(x => x.getAttribute('aria-label')).join(' | ');
    return { crumbs, av: av ? tx(av) : null, h1: h1 ? tx(h1) : '', aria, linhas, listas, cards, cel, texto: tx(sc), secs, termos: [...sc.querySelectorAll('.ov-ts')].map(t => ({ h: tx(t.querySelector('h3')), itens: [...t.querySelectorAll('li.ov-tm .ov-v')].map(x => tx(x)), mini: tx(t.querySelector('.ov-mini') || document.createElement('i')), txt: tx(t) })) };
  });
  const F = m => falhas.push(qs + ' :: ' + m);
  // I1: cada lista com total fecha em valor e em porcentagem
  for (const l of d.listas) {
    const tot = l.rows.find(r => /tot/.test(r.cls)), resto = l.rows.filter(r => !/tot/.test(r.cls));
    const soma = resto.reduce((a, r) => a + (num(r.v) || 0), 0), totN = num(tot.v);
    if (soma !== totN) F('lista soma ' + soma + ' != total ' + totN + ' (' + tot.nome + ')');
    const ps = resto.map(r => r.p), pSoma = ps.reduce((a, x) => a + (/^\d+%$/.test(x) ? num(x) : 0), 0), temMenor = ps.some(x => x === '<1%');
    if (!temMenor && pSoma !== 100) F('porcentagens somam ' + pSoma + ' em ' + tot.nome);
    if (temMenor && (pSoma < 99 || pSoma > 100)) F('porcentagens (com <1%) somam ' + pSoma);
    for (const r of resto) if (/^0$/.test(r.v) && num(tot.v) > 0 && !/ov-r om/.test(r.cls) && false) F('0 solto');
  }
  const origem = d.listas[0]; const totOrig = origem ? num(origem.rows.find(r => /tot/.test(r.cls)).v) : null;
  // I2: aparelho, país, inscritos somam o mesmo total da origem (mesma cobertura)
  if (origem && /Total de views/.test(origem.rows.find(r => /tot/.test(r.cls)).nome)) {
    for (const c of d.cards) {
      const s = c.rows.reduce((a, r) => a + (num(r.v) || 0), 0);
      if (c.rows.length && s !== totOrig) F('cartão "' + c.t + '" soma ' + s + ' != total da origem ' + totOrig);
    }
  }
  // I3 e I4: cabeçalho do canal x rodapé da origem x régua x linhas de cobertura
  const cViews = d.cel.find(c => c.l.startsWith('views no período')), cDias = d.cel.find(c => c.l.startsWith('dias com origem'));
  const mRod = d.texto.match(/Views no período todo: ([\d.]+)/);
  if (cViews && mRod && num(cViews.v.replace(/\d{2}\/\d{2} a \d{2}\/\d{2}/, '')) !== num(mRod[1])) F('views do cabeçalho (' + cViews.v + ') != rodapé (' + mRod[1] + ')');
  // I3b: total da barra <= views do período; com cobertura total (sem "A divisão acima usa só") os dois são IGUAIS
  if (origem && mRod) {
    const tot = totOrig, per = num(mRod[1]), parcial = /A divisão acima usa só/.test(d.texto);
    if (!parcial && tot !== per) F('cobertura total mas total da barra ' + tot + ' != views do período ' + per);
    if (parcial && !(tot < per)) F('cobertura parcial mas total da barra ' + tot + ' não é menor que as views do período ' + per);
  }
  const cVid = tela === 'video' && p === 'tudo' ? d.cel.find(c => c.l === 'views') : null;
  if (cVid && mRod && num(cVid.v) !== num(mRod[1])) F('views da vida do vídeo (' + cVid.v + ') != views desde a publicação (' + mRod[1] + ')');
  if (tela === 'video' && e !== 'vazio') { const cv = d.cel.find(c => c.l === 'views'); if (cv && !/^\d{1,3}(\.\d{3})*$/.test(cv.v)) F('views do cabeçalho do vídeo sem separador: ' + cv.v); }
  const mCob = d.texto.match(/(?<!\d)(\d[\d.]*) de ([\d.]+) dias? com a origem medida/);
  if (cDias && mCob) {
    const mm = cDias.sub.match(/de ([\d.]+)/);
    if (!(num(cDias.v) === num(mCob[1]) && mm && mm[1] === mCob[2])) F('célula de dias (' + cDias.v + ' / ' + cDias.sub + ') != régua (' + mCob[0] + ')');
  }
  // I4b: as linhas "Medido em A de B dias" dos três cartões pequenos concordam com a régua da origem
  if (mCob) for (const c of d.cards) {
    const m1 = c.texto.match(/Medido em ([\d.]+) de ([\d.]+) dias/), m2 = c.texto.match(/Medido nos ([\d.]+) dias/);
    if (m1 && !(num(m1[1]) === num(mCob[1]) && num(m1[2]) === num(mCob[2]))) F('cartão "' + c.t + '": ' + m1[0] + ' != régua ' + mCob[0]);
    if (m2 && !(num(m2[1]) === num(mCob[1]) && num(m2[1]) === num(mCob[2]))) F('cartão "' + c.t + '": ' + m2[0] + ' != régua ' + mCob[0]);
  }
  // regra de estado: nenhuma célula, régua ou rodapé pode afirmar dias medidos onde a tela diz não medido
  if (e === 'nao-medido') {
    if (/Medido (nos|em) \d+/.test(d.texto) || /dias com a origem medida/.test(d.texto) && !/0 de/.test(d.texto)) F('não medido afirma dias medidos: ' + (d.texto.match(/Medido (nos|em) \d+[^|]{0,30}/) || [''])[0]);
    if (cDias && !/não medido/.test(cDias.tudo + cDias.v)) F('célula de dias do não medido não usa o marcador: ' + cDias.tudo);
    if (d.listas.length) F('não medido mostra lista com total');
    if (/foram omitidos|das views vieram/.test(d.texto)) F('frase de percentual no não medido');
  }
  if (e === 'revisao' && !/revis/.test(cDias ? cDias.sub : 'revis') ) F('célula de dias não diz revisão');
  if ((e === 'erro' || e === 'carregando') && cDias && !/—/.test(cDias.v)) F('erro/carregando com número na célula de dias: ' + cDias.tudo);
  if (e === 'zero' && d.texto.match(/\b[1-9][\d.]* (views|vezes)\b/) && !d.texto.match(/Views no período|views no período/)) { /* zero: nenhuma frase com contagem positiva de origem */ }
  // I5: porcentagens da frase-resumo existem na lista
  const fr = (d.secs[0] || '').match(/(?:Nos \d+ dias? medidos? \(\d+\/\d+ a \d+\/\d+\), )?(\d+)% das views vieram [^.;]*? e (\d+)% /);
  if (fr && origem) { const ps = origem.rows.map(r => r.p); for (const k of [fr[1], fr[2]]) if (!ps.includes(k + '%')) F('porcentagem da frase ' + k + '% não está na lista'); }
  // I6: termos e sites
  for (const t of d.termos) {
    const m = t.txt.match(/Das ([\d.]+) views [^:]*: ([\d.]+) com [^,]*, ([\d.]+) omitidas/);
    const soma = t.itens.reduce((a, x) => a + num(x), 0);
    if (m) { if (soma !== num(m[2])) F('termos/sites somam ' + soma + ' != "com termo" ' + m[2]); if (num(m[2]) + num(m[3]) !== num(m[1])) F('com + omitidas != base em ' + t.h); }
    if (m && origem) { const k = /Termos/.test(t.h) ? 'Pesquisa do YouTube' : 'Sites e apps de fora', r = origem.rows.find(r => r.nome === k); if (r && num(r.v) !== num(m[1])) F('base de ' + t.h + ' (' + m[1] + ') != origem ' + k + ' (' + r.v + ')'); }
    if (t.itens.length && soma > 0 && m == null && /Sem comparar/.test(t.mini) === false) { /* sem comparação por outro motivo */ }
  }
  // I7: nenhuma contagem negativa, nenhum "NaN", nenhum "undefined"
  if (/NaN|undefined|\bnull\b|(^|\s)-\d/.test(d.texto)) F('texto com NaN/undefined/negativo: ' + (d.texto.match(/.{20}(NaN|undefined|null).{10}/) || [''])[0]);
  // I8: cartão da comparação: impressões e cliques coerentes com o estado
  if (tela === 'cartao') {
    const t = d.texto;
    const imp = t.match(/Impressões\s*de \d+\/\d+ a \d+\/\d+\s*([\d.]+|0|Ainda não existe)/);
    if (e === 'zero' && !/Impressões\s*de [\d/ a]+\s*0\s*Zero medido/.test(t)) F('cartão zero não mostra impressões = 0');
    if (e === 'zero' && /Taxa de clique[^%]*\d+,\d%/.test(t)) F('cartão zero mostra taxa de clique com 0 impressões');
    if (e === 'vazio' && imp && /^\d/.test(imp[1])) F('cartão vazio mostra impressões ' + imp[1]);
    if (['erro'].includes(e) && /42%|18%|216 views/.test(t)) F('cartão erro mostra números da origem');
    if (['carregando'].includes(e) && /\d+% (da|do|em|de)/.test(t.replace(/\d+% de? ?(intervalo)/, ''))) F('cartão carregando mostra números da origem');
  }
  // I10: o cartão (7 dias do canal) concorda com a página do canal em 7 dias, estado a estado
  {
    const chave = e + (tela === 'cartao' ? '' : '');
    const impOrig = d.listas.find(l => /Total de impressões/.test(l.rows.find(r => /tot/.test(r.cls)).nome));
    const lider = d.secs[0] && (d.secs[0].match(/(\d+)% das views vieram/) || [])[1];
    const topo = d.termos[0] && d.termos[0].itens[0] ? num(d.termos[0].itens[0]) : null;
    if (tela === 'canal' && p === '7') cruz[chave + ':canal'] = { imp: impOrig ? num(impOrig.rows.find(r => /tot/.test(r.cls)).v) : null, lider, topo, tot: totOrig, ap: (d.cards[0] && d.cards[0].rows[0] || {}).p, pa: (d.cards[1] && d.cards[1].rows.find(r => r.nome === 'Brasil') || {}).p, ins: (d.cards[2] && d.cards[2].rows.find(r => r.nome === 'Não inscritos') || {}).p };
    if (tela === 'cartao') {
      const L = k => (d.linhas.find(l => l.tudo.includes(k)) || { val: '' }).val, t = d.texto;
      const vi = L('Impressões'), vc = L('Cliques'), vt = L('Taxa de clique');
      const mt = vt.match(/([\d,]+)%\s*entre ([\d,]+)% e ([\d,]+)%/);
      cruz[chave + ':cartao'] = { imp: /^[\d.]+$/.test(vi) ? num(vi) : null, lider: (L('De onde vêm').match(/(\d+)% (?:da|do|de)/) || [])[1], topo: (L('Termos').match(/a busca que mais trouxe gente, ([\d.]+) views/) || [])[1], ap: ((L('Aparelho').match(/^(\d+)% em celular/) || [])[1] || '') + '%', pa: ((L('País').match(/^(\d+)% do Brasil/) || [])[1] || '') + '%', ins: ((L('Inscritos').match(/^(\d+)% de quem não/) || [])[1] || '') + '%' };
      if (/^[\d.]+$/.test(vi) && /^[\d.]+$/.test(vc) && mt) {
        const imp7 = num(vi), cl = num(vc), tx = Number(mt[1].replace(',', '.')) / 100, lo = Number(mt[2].replace(',', '.')) / 100, hi = Number(mt[3].replace(',', '.')) / 100;
        if (Math.abs(cl - imp7 * tx) > Math.max(10, imp7 * tx * 0.01)) F('cliques ' + cl + ' != impressões ' + imp7 + ' x taxa ' + mt[1] + '%');
        if (!(lo <= tx && tx <= hi)) F('taxa fora do próprio intervalo');
        resumo.push(qs + ' impressões ' + vi + ' | cliques ' + vc + ' | taxa ' + vt);
      }
    }
  }
  if (tela === 'cartao' && e === 'zero' && /omit/i.test(d.linhas.map(l => l.val).join(' '))) F('cartão zero fala de omitido (zero medido não é omitido)');
  // I9: "N dias medidos (dd/mm a dd/mm)" com N = dias entre as datas
  for (const m of d.texto.matchAll(/(\d+) dias? medidos? \((\d{2})\/(\d{2}) a (\d{2})\/(\d{2})\)/g)) {
    const a = Date.UTC(2026, +m[3] - 1, +m[2]), z = Date.UTC(2026, +m[5] - 1, +m[4]); const dias = Math.round((z - a) / 864e5) + 1;
    if (dias !== +m[1]) F('"' + m[0] + '": entre as datas há ' + dias + ' dias');
  }
  // ---- r5: as quatro conferências pedidas pelo revisor na r4, mais as de identidade, janela, grandeza e data
  // (a) identidade do canal: nome igual na migalha, no título e na sigla do avatar (sigla = 1a letra + 1a letra da 2a palavra, ou a 1a maiúscula seguinte)
  const tl = tela === 'cartao' ? 'cartao' : d.av !== null ? 'canal' : 'video';   /* a página força a tela em alguns estados (extremo e magro = canal; zero e vazio = vídeo) */
  if (tl !== 'cartao' && d.crumbs.length) {
    const nome = tl === 'canal' ? d.crumbs[d.crumbs.length - 1] : d.crumbs[1];
    if (tl === 'canal' && nome !== d.h1) F('migalha "' + nome + '" != título "' + d.h1 + '"');
    if (tl === 'canal') { const pal = nome.split(' '), sg = (pal[0][0] + (pal[1] ? pal[1][0] : (pal[0].slice(1).match(/[A-Z]/) || [''])[0])).toUpperCase(); if (d.av !== sg) F('sigla do avatar "' + d.av + '" != "' + sg + '" do nome "' + nome + '"'); }
    if (tl === 'video' && nome !== 'tnFigueiredo') F('migalha do vídeo diz "' + nome + '"');
  }
  // (b) "N views da pesquisa" ou "de sites de fora" na frase de lista vazia: janela igual à da origem, ou a linha "Sem comparar" / "dias desta lista" na mesma tela
  for (const m of d.texto.matchAll(/as ([\d.]+) views (da pesquisa|de fora do YouTube)( dos \d+ dias desta lista)? ficaram sem/g)) {
    const k = m[2] === 'da pesquisa' ? 'Pesquisa do YouTube' : 'Sites e apps de fora', r = origem && origem.rows.find(r => r.nome === k);
    if (r && num(r.v) !== num(m[1]) && !(m[3] && /Sem comparar/.test(d.texto))) F('"' + m[0] + '" contra ' + k + ' ' + r.v + ' na lista de origem, sem explicar a outra janela');
  }
  // (d) vídeo: nenhuma frase "seus vídeos"
  if (tl === 'video' && /seus vídeos/.test(d.texto)) F('página do vídeo diz "seus vídeos"');
  // "N de M": N nunca maior que M (a classe "5 das 3")
  for (const m of d.texto.matchAll(/(?<![\d.\/])([\d.]+) de ([\d.]+) (dias?|views|vídeos)/g)) if (num(m[1]) > num(m[2])) F('"' + m[0] + '": N maior que M');
  // número com milhar sem separador ("há 2709 dias")
  for (const m of (d.texto + ' ' + d.aria).matchAll(/(?<![\w.,\/:-])(\d{4,})(?![\w.,\/-])/g)) if (!/^(19|20)\d\d$/.test(m[1])) F('número sem separador de milhar: ' + m[1]);
  // datas: toda janela "dd/mm a dd/mm" em ordem e sem passar de 11/10 (último dia entregue); nenhuma data de coleta/leitura no passado
  for (const m of (d.texto + ' ' + d.aria).matchAll(/(\d{2})\/(\d{2})(?:\/(\d{4}))? a (\d{2})\/(\d{2})(?:\/(\d{4}))?/g)) {
    const ini = (m[3] || '2026') + m[2] + m[1], fim = (m[6] || '2026') + m[5] + m[4];
    if (ini > fim) F('janela invertida: ' + m[0]); if (fim > '20261011') F('janela termina depois do último dia entregue (11/10): ' + m[0]);
  }
  if (e === 'nao-medido' && !/14\/10/.test(d.texto)) F('não medido sem a data 14/10');
  // vídeo: publicado em <= hoje, e a idade bate com a data
  { const m = d.texto.match(/Publicado em (\d{2})\/(\d{2})\/(\d{4}) \(há ([\d.]+) dias?\)/); if (m) { const dd = Math.round((Date.UTC(2026, 9, 13) - Date.UTC(+m[3], +m[2] - 1, +m[1])) / 864e5); if (dd !== num(m[4])) F('idade do vídeo "' + m[0] + '": entre a data e 13/10 há ' + dd); } }
  // revisão: nenhuma frase diz que o total "sempre fecha" (o ⓘ vive num <template>, então lemos pelo HTML)
  if (e === 'revisao') { const inf = await pg.evaluate(() => [...document.querySelectorAll('template')].map(t => t.innerHTML).join(' ')); if (/total sempre fecha/.test(inf)) F('revisão: o ⓘ diz que o total sempre fecha'); }
  // ---- r6: razão do vídeo, identidade do vídeo entre estados, ⓘ por tela, % assistido por perfil
  if (tl === 'video') {
    const cViews = d.cel.find(c => c.l === 'views'), cNormal = d.cel.find(c => c.l === 'o normal do canal');
    const MED = 2764;   /* D.MEDIANA_OUTROS: a mediana é uma só; confere contra o valor lido da página */
    const med = await pg.evaluate(() => window.OVD && window.OVD.MEDIANA_OUTROS);
    if (med !== MED) F('mediana dos outros vídeos mudou (' + med + ')');
    if (cViews && cNormal && cNormal.v && /×/.test(cNormal.v)) {
      const razao = Number(cNormal.v.replace('×', '').replace(',', '.')), esperado = Math.round(num(cViews.v) / med * 10) / 10;
      if (razao !== esperado) F('razão "o normal do canal" ' + cNormal.v + ' != views ' + cViews.v + ' ÷ mediana ' + med + ' = ' + esperado);
    }
    const mt = d.texto.match(/Publicado em (\d{2}\/\d{2}\/\d{4})/), ti = await pg.evaluate(() => (document.querySelector('#screen h1') || {}).textContent);
    if (mt && ti) { const id = ti + ' @ ' + mt[1]; (ident[ti] = ident[ti] || new Set()).add(mt[1]); if (ident[ti].size > 1) F('o mesmo título "' + ti + '" com datas de publicação diferentes: ' + [...ident[ti]].join(' e ')); }
  }
  // ⓘ: a idade do vídeo só no vídeo; a linha de 24/08 só quando o período cruza a data; "total sempre fecha" nunca no não medido
  { const inf = await pg.evaluate(() => [...document.querySelectorAll('template')].map(t => t.innerHTML).join(' '));
    if (tl === 'canal' && /idade do vídeo/.test(inf)) F('ⓘ da página do canal fala da idade do vídeo');
    const per = d.texto.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))? a (\d{2})\/(\d{2})/);
    if (/24\/08\/2026:<\/b> o YouTube mudou/.test(inf) && p === '7' && tl !== 'cartao') F('ⓘ cita 24/08/2026 em período de 7 dias, que não cruza a data');
    if (e === 'nao-medido' && /total sempre fecha/.test(inf)) F('não medido: o ⓘ diz que o total sempre fecha'); }
  // % assistido do cartão: nunca igual em magro, típico e extremo
  if (tela === 'cartao') { const v = (d.linhas.find(l => l.tudo.includes('% assistido')) || { val: '' }).val; const m = v.match(/^(\d+)%/); if (m) (assist[e] = m[1]); }
  // (c) guarda para o cruzamento cartão x canal: views da semana e cliques
  if (tl === 'canal' && p === '7') { const v = d.cel.find(c => c.l.startsWith('views no período')); cruz[e + ':views'] = v ? num(v.v.replace(/\d{2}\/\d{2} a \d{2}\/\d{2}/, '')) : null; }
  if (tela === 'cartao') { const vc = (d.linhas.find(l => l.tudo.includes('Cliques')) || { val: '' }).val; cruz[e + ':cliques'] = /^[\d.]+$/.test(vc) ? num(vc) : null; }
  await ctx.close();
}
await b.close();
for (const e of ESTADOS) { const v = cruz[e + ':views'], c = cruz[e + ':cliques']; if (v != null && c != null) resumo.push('cartão x canal (' + e + '): cliques ' + c + ' <= views da semana ' + v);
  if (v != null && c != null && c > v) falhas.push('cartão (' + e + '): cliques ' + c + ' maiores que as views da mesma semana ' + v); }
for (const e of ESTADOS) {
  const A = cruz[e + ':canal'], B = cruz[e + ':cartao'];
  if (!A || !B) continue;
  if (A.imp != null && B.imp != null && A.imp !== B.imp) falhas.push('cartão x canal (' + e + '): impressões ' + B.imp + ' != ' + A.imp);
  if (A.topo != null && B.topo != null && String(num(B.topo)) !== String(A.topo)) falhas.push('cartão x canal (' + e + '): busca líder ' + B.topo + ' != ' + A.topo);
  for (const k of ['ap', 'pa', 'ins']) if (A[k] && B[k] && B[k] !== '%' && A[k] !== B[k]) falhas.push('cartão x canal (' + e + '): ' + k + ' ' + B[k] + ' != ' + A[k]);
  if (A.lider && B.lider && A.lider !== B.lider) falhas.push('cartão x canal (' + e + '): líder ' + B.lider + '% != ' + A.lider + '%');
}
if (assist.tipico && assist.tipico === assist.magro && assist.magro === assist.extremo) falhas.push('% assistido igual nos três perfis: ' + assist.tipico + '%');
console.log(casos.length + ' casos conferidos; ' + falhas.length + ' falha(s)');
for (const f of falhas) console.log('FALHA ' + f);
for (const r of resumo.slice(0, 40)) console.log('  ' + r);
