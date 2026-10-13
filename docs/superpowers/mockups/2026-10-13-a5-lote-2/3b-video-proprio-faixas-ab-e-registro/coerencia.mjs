import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
// coerencia.mjs: confere, para os 10 estados, que os números mostrados fecham entre si e com a fonte única (3b-dados.js).
// Uso (da raiz do repositório): node docs/superpowers/mockups/2026-10-13-a5-lote-2/3b-video-proprio-faixas-ab-e-registro/coerencia.mjs   (W=390 para a largura estreita; V=1 imprime os números)
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const casos = ['tipico','extremo','hoje','zero','semnumero','so-teste','so-reconstruido','vazio','erro','leitura'];
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: Number(process.env.W||1440), height: 900 } });
await ctx.route(/^https?:\/\//, r => r.abort());
let falhas = 0;
for (const c of casos) {
  const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('file://' + dir + '/index.html?caso=' + c); await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => {
    const A = window.A4, M = window.__b3.M, out = { fail: [], info: {} }, F = m => out.fail.push(m);
    const txt = s => [...document.querySelectorAll(s)].map(e => e.innerText.replace(/\s+/g,' ').trim());
    const num = s => Number(String(s).replace(/\./g,'').replace(',','.'));
    const dm = iso => A.dm(iso);
    // cabeçalho
    const cells = [...document.querySelectorAll('.vh .nstrip > *')].map(e=>e.innerText.replace(/\s+/g,' ').trim());
    const v = M.video, ms = M.views.filter(x=>x.e!=='nm'), sumAll = ms.reduce((a,x)=>a+x.v,0), sumJan = M.vistaViews.reduce((a,x)=>a+(x.v||0),0);
    out.info.cab = cells.join(' | ');
    if (v.views < sumAll) F('views do cabeçalho < soma dos dias medidos '+v.views+' < '+sumAll);
    if (v.views < sumJan) F('views do cabeçalho < soma do gráfico');
    if (M.serie[0].d === M.pub && M.viewsAntes === 0 && v.views - sumAll > Math.ceil(sumAll/ms.length*M.viewsNm)+1) F('cabeçalho excede o ciclo de vida medido');
    if (A.dias(v.pub, M.hoje) + (A.dias(v.pub,M.hoje)===1?' dia':' dias') !== v.idadeTxt) F('idade');
    if (!document.querySelector('.vh .l2').innerText.includes('há '+v.idadeTxt)) F('idade na tela');
    if (Math.abs(v.eng - (v.likes+v.com)/v.views) > 1e-9) F('eng');
    if (v.normal != null && Math.abs(v.normal - v.views/M.mediana)>1e-9) F('normal');
    if (v.likes + v.com > v.views) F('curtidas+comentários > views');
    // gráficos
    const fv = txt('#gVw p, #gVw .ic-fr')[0]||''; const mv = fv.match(/^([\d.]+) views? em (\d+) dias medidos/);
    const vv = M.vistaViews, dmed = vv.filter(x=>x.e!=='nm').length;
    if (mv) { if (num(mv[1]) !== sumJan) F('frase views '+mv[1]+' != '+sumJan); if (+mv[2] !== dmed) F('dias medidos views'); } else if (!/Nenhuma view/.test(fv)) F('frase views não lida: '+fv);
    const meta = txt('#gVw p').find(x=>/ dias · /.test(x))||''; const mm = meta.match(/· (\d+) dias/); if (mm && +mm[1] !== vv.length) F('dias do gráfico views');
    if (!M.leitor || M.leitor !== 'leitura') {
      const S = M.vistaImp, imp = S.reduce((a,x)=>a+(x.e==='com'?x.v:0),0), cl = S.some(x=>x.e==='com'&&x.cl>=1) ? S.reduce((a,x)=>a+(x.e==='com'?Math.round(x.cl):0),0) : Math.round(S.reduce((a,x)=>a+(x.e==='com'?x.cl:0),0)); // r4/B1: soma dos dias como aparecem; sem nenhum dia >= 1, soma exata arredondada ("cerca de")
      const fi = txt('#gIm p')[0]||''; const mi = fi.match(/^([\d.]+) impress(?:ão|ões) e (?:cerca de )?([\d.]+) cliques? estimados? em (\d+) dias: (\d+) com impressão, (\d+) medidos em zero e (\d+) não medidos?/);
      if (mi) { if (num(mi[1])!==imp) F('imp total'); if (num(mi[2])!==cl) F('cliques total'); if (+mi[3]!==S.length) F('dias imp'); if (+mi[4]+ +mi[5]+ +mi[6] !== S.length) F('partes != dias'); if (+mi[4]!==S.filter(x=>x.e==='com').length||+mi[5]!==S.filter(x=>x.e==='zero').length||+mi[6]!==S.filter(x=>x.e==='nm').length) F('partes imp'); if (num(mi[1]) > 0 && v.views < imp*0 ) F('x'); if (sumJan > imp * 1.0001 && imp>0) F('views do gráfico > impressões'); }
      else if (!/Nenhuma impressão/.test(fi)) F('frase imp não lida: '+fi);
      out.info.imp = fi;
      // r4/B1: o que está DESENHADO tem de fechar com a frase (a conta anterior recontava a mesma série e passava)
      const nums = [...document.querySelectorAll('#gIm .ic-cln')].map(e=>e.textContent.trim());
      const tab = [...document.querySelectorAll('#gIm .ic-tab tbody tr')].map(tr=>tr.children[2].textContent.trim());
      const numT = x => /^\d/.test(x) ? num(x) : null, numeric = tab.map(numT).filter(x=>x!==null), temMenos1 = tab.some(x=>x==='<1');
      if (mi) {
        const total = num(mi[2]), cerca = /e cerca de/.test(fi);
        if (!temMenos1 && tab.length) { const st = numeric.reduce((a,x)=>a+x,0); if (st !== total) F('soma da coluna Cliques da tabela '+st+' != frase '+total); }
        if (nums.length) { if (nums.some(x=>x==='<1')) F('mistura de <1 e números na faixa de cliques'); const sn = nums.map(numT).reduce((a,x)=>a+x,0); if (nums.length === S.filter(x=>x.e==='com').length && sn !== total) F('soma dos rótulos de cliques desenhados '+sn+' != frase '+total); }
        if (temMenos1 && !cerca) F('há dia com <1 mas a frase não diz "cerca de"');
        if (!temMenos1 && cerca) F('"cerca de" sem dia <1');
        if (temMenos1 && numeric.some(x=>x>0)) F('tabela mistura <1 e números inteiros (frase não sabe somar)');
        if (nums.length && temMenos1) F('rótulos <1 desenhados com legenda de "menos de 1"');
        if (temMenos1 && !/menos de 1/.test(document.querySelector('#gIm').innerText)) F('falta a legenda "menos de 1"');
      }
    }
    out.info.views = fv;
    // trocas e testes
    const itens = [...document.querySelectorAll('.tr-it')];
    if (itens.length !== M.trocas.length) F('itens != trocas');
    if (document.querySelectorAll('.vb-teste').length !== M.testes.length) F('testes na lista');
    const fr = txt('#trocas .fr')[0]||''; const m1 = fr.match(/^(\d+) trocas?/); if (m1 && +m1[1] !== M.trocas.length) F('frase-resumo trocas');
    const tally = [...document.querySelectorAll('.vb-tally li b.num')].reduce((a,e)=>a+ +e.innerText,0); if (document.querySelector('.vb-tally b.num') && tally !== M.trocas.length) F('tally '+tally);
    const res = txt('.tr-res')[0]||''; if (!/^(exemplo\s*)?(Trocas deste vídeo|\d+ trocas?)/.test(res.replace(/\s+/g,' '))) F('frase-resumo do topo ausente ou sem "Trocas deste vídeo"/contagem (r7/N2): ['+res.slice(0,60)+']'); const m2 = res.match(/(\d+) trocas? e|^exemplo (\d+) trocas?/); 
    /* r8/N3: com falha de leitura, a frase do topo existe (também sem troca), diz "falharam" e as datas de corte e de falha, e o aviso completo está na tela */
    if (M.registro.ok === false) { const rs = res.replace(/\s+/g,' '), dmm = d => d.slice(8)+'/'+d.slice(5,7); if (!res) F('erro: sem frase do topo (N3)'); else { if (!/falharam/.test(rs)) F('erro: frase do topo sem "falharam" (N3)'); [M.registro.ultima, M.registro.falhaDe, M.hoje].forEach(d => { if (!rs.includes(dmm(d))) F('erro: frase do topo sem a data '+dmm(d)+' (N3)'); }); } if (!document.querySelector('.vb-erro')) F('erro: aviso completo ausente'); }
    M.testes.forEach((te,i)=>{ const el=document.querySelectorAll('.vb-teste')[i]; if (el){ const n=(el.innerText.match(/(\d+) ciclos?/)||[])[1]; if (+n!==te.ciclos.length) F('ciclos do teste'); const c = te.ciclos; if (c[0]!==te.de) F('1o ciclo != início'); if (te.ate && c[c.length-1]>te.ate) F('ciclo depois do fim'); } });
    // datas
    M.trocas.forEach((t,i)=>{ if (t.d < M.pub) F('troca antes da publicação'); if (t.d > M.hoje) F('troca no futuro'); if (t.d < '2026-10-07') F('troca antes do registro'); if (i && M.trocas[i-1].d >= t.d) F('trocas fora de ordem'); });
    // antes e depois (recalcula da série)
    itens.forEach((it,i)=>{
      const t = M.trocas[i], tx = it.innerText.replace(/\s+/g,' ');
      const re = /(Antes|Depois): (\d+) dias?(?: medidos)?(?: \(|, )(\d\d)\/(\d\d)(?: a (\d\d)\/(\d\d))?(?:, sem ([\d\/, e]+))?\)?, ([\d.]+) impress/g; let m;
      if (/(Antes|Depois): \d\d\/\d\d/.test(tx)) F('troca '+t.n+': lado sem a contagem de dias (r7/S4): '+(tx.match(/(Antes|Depois): \d\d\/\d\d[^;]{0,40}/)||[''])[0]);
      while ((m = re.exec(tx))) {
        const y = M.pub.slice(0,4), d0 = y+'-'+m[4]+'-'+m[3], d1 = m[5] ? y+'-'+m[6]+'-'+m[5] : d0;
        const rng = M.serie.filter(x=>x.d>=d0 && x.d<=d1 && x.e!=='nm'), imp = rng.reduce((a,x)=>a+(x.e==='com'?x.v:0),0);
        if (rng.length !== +m[2]) F('troca '+t.n+' '+m[1]+' dias '+rng.length+' != '+m[2]);
        // r6/B1: o N do rótulo tem de fechar com as DUAS datas escritas ao lado: dias de calendário - dias citados em "sem ..." = N, e todo dia não medido do intervalo tem de estar citado
        const cal = A.dias(d0, d1) + 1, nmIn = M.serie.filter(x=>x.d>=d0 && x.d<=d1 && x.e==='nm').map(x=>dm(x.d)), citados = m[7] ? m[7].split(/, | e /).filter(Boolean) : [];
        if (cal - citados.length !== +m[2]) F('troca '+t.n+' '+m[1]+': "'+m[2]+' dias" não fecha com '+dm(d0)+' a '+dm(d1)+' ('+cal+' dias de calendário, '+citados.length+' citados)');
        if (citados.slice().sort().join() !== nmIn.slice().sort().join()) F('troca '+t.n+' '+m[1]+': dias não medidos do intervalo ['+nmIn+'] != citados ['+citados+']');
        if (imp !== num(m[8])) F('troca '+t.n+' '+m[1]+' imp '+imp+' != '+m[7]);
        if (m[1]==='Antes' && d1 > A.addDias(t.d,-2)) F('antes invade o dia anterior'); if (m[1]==='Depois' && d0 < A.addDias(t.d,1)) F('depois antes da troca');
        if (d0 <= M.pub) F('lado inclui a publicação'); if (d1 > M.ultFechado) F('lado inclui dia não fechado');
        M.trocas.forEach(o=>{ if (o.n!==t.n && o.d>=d0 && o.d<=d1) F('troca '+t.n+' atravessa troca '+o.n); });
        M.testes.forEach(te=>te.ciclos.forEach(cy=>{ if (cy>=d0 && cy<=d1) F('troca '+t.n+' atravessa ciclo '+cy); }));
        if (imp >= 100 && /só [\d.]+ impress/.test(tx) && m[1]) {}
      }
      if (/Primeiro dia depois da troca:/.test(tx)) F('frase antiga "Primeiro dia depois da troca: dd/mm" (r4/B2)');
      const pr = tx.match(/O primeiro dia depois da troca \((\d\d\/\d\d)\) só chega do YouTube em (\d\d\/\d\d)\. Leitura completa em (\d\d\/\d\d)/); if (pr) {
        // r4/B2: o primeiro dia depois é o seguinte à troca (o mesmo início da janela "depois" das outras trocas); o YouTube o entrega 2 dias depois de fechado
        if (pr[1] !== dm(A.addDias(t.d,1))) F('troca '+t.n+': primeiro dia depois != troca + 1');
        if (pr[2] !== dm(A.addDias(A.addDias(t.d,1),2))) F('troca '+t.n+': entrega != primeiro dia + 2');
        if (pr[3] !== dm(A.addDias(t.d,9))) F('janela cheia');
        if (A.addDias(t.d,1) <= M.ultFechado) F('troca '+t.n+' diz nm mas há dia fechado');
        // o dia dito "só chega em X" tem de ser realmente depois de hoje: no dia X ele já está fechado (ultFechado = hoje - 2)
        if (A.addDias(A.addDias(t.d,1),2) <= M.hoje) F('troca '+t.n+': a entrega do primeiro dia já passou');
      }
      const so = tx.match(/só (\d+) impress/g); 
    });
    // dia da semana
    itens.forEach((it,i)=>{ if (!it.innerText.includes(A.ds(M.trocas[i].d))) F('data da troca'); });
    // r5: fala de CADA dia dos dois gráficos (o leitor de dia) e conteúdo de TODOS os ⓘ
    const falas = {};
    ['gVw','gIm'].forEach(id => {
      const host = document.getElementById(id); if (!host) return; const dias = id === 'gVw' ? M.vistaViews : M.vistaImp; falas[id] = {};
      const nxt = host.querySelector('.ic-step button[data-p="1"]'), out = host.querySelector('.ic-out'); if (!nxt || !out) { F('leitor de dia ausente em '+id); return; }
      dias.forEach(d => { nxt.click(); const t = out.innerText.replace(/\s+/g,' ').trim(); falas[id][d.d] = t;
        if (!t.startsWith(A.ds(d.d))) F(id+' '+d.d+': fala não começa pelo dia certo: '+t);
        if ((d.d === M.video.pub) !== /Dia da publicação do vídeo/.test(t)) F(id+' '+d.d+': "Dia da publicação" só no dia da publicação (r6/S3): '+t);
        if (d.e === 'nm') {
          if (!/\(não medido\)/.test(t)) F(id+' '+d.d+': dia nm sem "(não medido)": '+t);
          if (/ainda não chegou/.test(t)) F(id+' '+d.d+': frase antiga "ainda não chegou" (r5/B1)');
          const ainda = /o YouTube ainda não entregou/.test(t); if (ainda !== (d.d > M.ultFechado)) F(id+' '+d.d+': "ainda" só para dia depois do último fechado ('+M.ultFechado+'): '+t);
          if (ainda && A.dias(d.d, M.hoje) > 1) F(id+' '+d.d+': "ainda" para dia com mais de 1 dia de idade');
        } else if (d.e === 'zero' && !/zero medido/.test(t)) F(id+' '+d.d+': zero sem "zero medido"');
        else if (d.e === 'com' && /não medido|zero medido/.test(t)) F(id+' '+d.d+': dia com número dito não medido/zero');
      });
    });
    if (falas.gVw && falas.gIm) M.vistaViews.forEach(d => { if (d.e === 'nm') { const o = M.vistaImp.find(x => x.d === d.d); if (o && o.e === 'nm' && falas.gVw[d.d] !== falas.gIm[d.d]) F('mesmo dia nm com falas diferentes nos dois gráficos '+d.d+': ['+falas.gVw[d.d]+'] x ['+falas.gIm[d.d]+']'); if (o && o.e !== 'nm') F('dia '+d.d+' nm nas views e medido nas impressões'); } });
    const infos = [...document.querySelectorAll('template[data-titulo], [id][data-titulo]')].map(e => (e.content ? e.content.textContent : e.textContent).replace(/\s+/g,' ').trim());
    infos.forEach(tx => {
      const j = tx.match(/cerca de (\d+) dias depois da troca/); if (j && +j[1] !== A.JANELA + 2) F('ⓘ: leitura completa em '+j[1]+' dias, a tela usa troca + '+(A.JANELA+2));
      if (/janela cheia, cerca de 10/.test(tx)) F('ⓘ: texto antigo "janela cheia, cerca de 10"');
      const w = tx.match(/até (\d+) dias de cada lado/); if (w && +w[1] !== A.JANELA) F('ⓘ: janela '+w[1]+' != '+A.JANELA);
      const m = tx.match(/Menos de (\d+) impressões num lado/); if (m && +m[1] !== A.MIN_IMP) F('ⓘ: limiar '+m[1]);
      const r = tx.match(/registra títulos e thumbnails desde (\d\d\/\d\d\/\d{4})/); if (r && r[1] !== A.dmy('2026-10-07')) F('ⓘ: início do registro '+r[1]);
      if (/poucas impressões/i.test(tx) && /o canal tem/.test(tx)) F('ⓘ: afirma "o canal tem poucas impressões"');
      if (/costuma trocar/.test(tx)) F('ⓘ: afirma hábito sem dado');
      if (/soma dos números|nenhum número é escrito|2 vídeos que tiveram/.test(tx)) F('ⓘ com redação antiga do método ou "2 vídeos" (r7/N1,S3): '+tx.slice(0,80));
      if (/soma dos cliques de cada dia/.test(tx) && !/os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela/.test(tx)) F('ⓘ do método sem a frase única (r7/N1)');
      if (/escritos sob as barras/.test(tx) && !document.querySelectorAll('#gIm .ic-cln').length) F('ⓘ cita números escritos sob as barras, mas esta largura não escreve nenhum (r6/C1)');
      if (M.leitor === 'leitura' && /(impressões ×|seu canal|Os cliques são estimados)/.test(tx)) F('ⓘ de quem só lê descreve cliques ou "seu canal"');
    });
    out.info.nInfos = infos.length;
    // r6: varredura GERAL de datas escritas na tela: nenhuma antes da publicação nem depois de hoje, salvo as duas datas futuras que a tela promete ("só chega em", "Leitura completa em");
    //     o "hoje, dd/mm" da régua é o hoje do estado; "N dias (dd/mm a dd/mm)" em qualquer lugar fecha com as datas
    {
      const sc = document.getElementById('screen').innerText.replace(/\s+/g,' ').replace(/só chega do YouTube em \d\d\/\d\d/g,'').replace(/Leitura completa em \d\d\/\d\d/g,'').replace(/\(\d\d\/\d\d\) só chega/g,'');
      const re2 = /(?<![\d\/])(\d\d)\/(\d\d)(?:\/(\d{4}))?(?![\d])/g; let q;
      while ((q = re2.exec(sc))) { const iso = (q[3]||M.pub.slice(0,4))+'-'+q[2]+'-'+q[1]; if (q[3] && iso === '2026-10-07') continue; /* início do registro */ if (iso === '2026-10-07') continue;
        if (iso < M.pub) F('data '+q[0]+' escrita na tela é anterior à publicação do vídeo ('+M.pub+')'); if (iso > M.hoje) F('data '+q[0]+' escrita na tela é depois de hoje ('+M.hoje+')'); }
      const hj = document.getElementById('screen').innerText.match(/hoje, (\d\d\/\d\d)/); if (hj && hj[1] !== dm(M.hoje)) F('"hoje, '+hj[1]+'" da régua != hoje do estado '+M.hoje);
      const re3 = /(\d+) dias? \((\d\d)\/(\d\d) a (\d\d)\/(\d\d)\)/g; let z; while ((z = re3.exec(sc))) { const y = M.pub.slice(0,4); if (A.dias(y+'-'+z[3]+'-'+z[2], y+'-'+z[5]+'-'+z[4]) + 1 !== +z[1]) F('"'+z[0]+'": N != dias de calendário'); }
    }
    // r6: texto dentro de um desenho (SVG) nunca passa da borda do desenho (a 390 o rótulo "Depois: 6 dias medidos (..., sem 15/10), 0 impressões" saía cortado)
    document.querySelectorAll('.tr-it svg').forEach(sv => { const w = sv.getBoundingClientRect().width, r0 = sv.getBoundingClientRect(); sv.querySelectorAll('text').forEach(t => { const b = t.getBoundingClientRect(); if (b.width && (b.right > r0.right + 1 || b.left < r0.left - 1)) F('texto do desenho cortado ('+Math.round(b.right - r0.right)+' px): '+t.textContent.slice(0,70)); }); });
    // pager: a posição do vídeo na lista vem da idade (r5/S2)
    const pg = (document.querySelector('.pager')||{innerText:''}).innerText.match(/vídeo (\d+) de 35/); if (!pg) F('pager sem posição'); else if (+pg[1] !== Math.min(35, 1 + Math.floor(A.dias(v.pub, M.hoje)/5))) F('posição do vídeo na lista '+pg[1]);
    // barra de estados: os 158 são dos dois canais; o vídeo do estado tem de ter menos que isso
    const imT = M.vistaImp ? M.vistaImp.reduce((a,x)=>a+(x.e==='com'?x.v:0),0) : 0; if ((document.querySelector('#mock')||{innerText:''}).innerText.includes('158') && M.leitor !== 'leitura' && !M.futuro && imT > 158) F('vídeo com mais impressões que os dois canais somados (158)');
    out.info.n = { trocas: M.trocas.length, testes: M.testes.length, pub: M.pub, hoje: M.hoje, ult: M.ultFechado };
    return out;
  });
  console.log('==', c, r.fail.length ? 'FALHAS' : 'ok', errs.join(';')); r.fail.forEach(f=>console.log('   FAIL', f)); if (process.env.V) console.log('  ', JSON.stringify(r.info)); falhas += r.fail.length; await pg.close();
}
await br.close(); console.log('total falhas', falhas);
