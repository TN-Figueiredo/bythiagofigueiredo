// Uso: node verifica.mjs  (Playwright headless; gera shots/ e confere overflow 390, coerência de números, alvo de 44 px)
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const require=createRequire('/Users/figueiredo/Workspace/bythiagofigueiredo/package.json');
const {chromium}=require('playwright');
const dir=path.dirname(fileURLToPath(import.meta.url));
const url=pathToFileURL(path.join(dir,'index.html')).href;
const FULL=['ativo-sem-volume','ativo-sinal','concluido-vencedor-provisorio','concluido-original-vence','concluido-inconclusivo-volume'];
const browser=await chromium.launch();
const pg=await browser.newPage({viewport:{width:1500,height:900}});
await pg.goto(url);
const estados=await pg.$$eval('#sEstado button',b=>b.map(x=>x.dataset.v));
let falhas=0;const ng=(m)=>{falhas++;console.log('FALHA',m)};
let nshots=0;
for(const k of estados){
  const combos=FULL.includes(k)?[['claro','1440'],['escuro','1440'],['claro','390'],['escuro','390']]:[['claro','390']];
  for(const [t,w] of combos){
    await pg.setViewportSize({width:w==='390'?390:1500,height:900});
    await pg.goto(`${url}?estado=${k}&tema=${t}&largura=${w}`);
    await pg.waitForSelector('.frame');
    if(w==='390'){
      const ov=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      const ovf=await pg.evaluate(()=>{const fr=document.querySelector('.frame');const f=fr.getBoundingClientRect();let m=0;fr.querySelectorAll('*').forEach(e=>{if(e.closest('[hidden]'))return;const r=e.getBoundingClientRect();if(r.width&&r.right-f.right>m)m=r.right-f.right});return Math.max(m,fr.scrollWidth-fr.clientWidth)});
      if(ov>0||ovf>0)ng(`${k} ${t} 390 overflow ${ov}/${ovf}`);
      // alvos de toque (botões, chevrons, ⓘ, rádios)
      const peq=await pg.evaluate(()=>[...document.querySelectorAll('.frame button:not([hidden]), .frame a.btn')].filter(b=>b.offsetParent&&!b.closest('[hidden]')).map(b=>{const r=b.getBoundingClientRect();return [b.className||b.textContent.trim().slice(0,20),Math.round(r.width),Math.round(r.height)]}).filter(([,w,h])=>w<44||h<44));
      if(peq.length)ng(`${k} ${t} alvo<44: ${JSON.stringify(peq)}`);
    }
    // coerência: dias válidos (placar x pisos x faixa) e impressões (placar x pisos)
    if(t==='claro'&&w===(FULL.includes(k)?'390':'390')){
      const r=await pg.evaluate(()=>{
        const f=document.querySelector('.frame');const out={};
        f.querySelectorAll('.vrow .vr').forEach(x=>{const l=x.getAttribute('aria-label').slice(-1);const ap=x.querySelector('.ap')?.textContent||'';const m=ap.match(/(\d+) válid/);const imp=x.querySelector('.vi .num')?.textContent||null;out[l]={apV:m?+m[1]:null,apImp:imp};});
        f.querySelectorAll('.pr').forEach(x=>{const l=x.getAttribute('aria-label').slice(-1);const dv=x.querySelector('.pdv b')?.textContent;const im=x.querySelector('.pnum .num')?.textContent;out[l]=out[l]||{};out[l].pV=dv?+dv:null;out[l].pImp=im||null;out[l].pnm=/não medido/.test(x.querySelector('.pnum').textContent)});
        f.querySelectorAll('.dc.m').forEach(d=>{const l=d.firstElementChild.textContent;out[l]=out[l]||{};out[l].m=(out[l].m||0)+1});
        out._avisoVol=!!f.querySelector('.aviso-vol');out._lift=/vs A|lift/.test(f.querySelector('.sum')?.textContent||'');
        return out;});
      for(const [l,o] of Object.entries(r)){ if(l[0]==='_')continue;
        if(o.pV!=null&&o.apV!=null&&o.pV!==o.apV)ng(`${k} ${l}: dias válidos pisos ${o.pV} x placar ${o.apV}`);
        if(o.pV!=null&&o.m!=null&&o.pV!==o.m)ng(`${k} ${l}: dias válidos pisos ${o.pV} x faixa ${o.m}`);
        if(o.pImp&&o.apImp&&o.pImp!==o.apImp)ng(`${k} ${l}: impressões pisos ${o.pImp} x placar ${o.apImp}`);
        if(o.pnm&&o.apImp)ng(`${k} ${l}: pisos não medido mas placar mostra ${o.apImp}`);
      }
      if(r._avisoVol)ng(`${k}: aviso de volume presente`);
      if(k.startsWith('ativo')&&r._lift)ng(`${k}: lift no ativo`);
    }
    await pg.setViewportSize({width:w==='390'?430:1500,height:900}); // a moldura de 390 px cabe inteira (a página do mockup tem 16 px de margem)
    await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots',`${k}-${t}-${w}.png`)});nshots++;
  }
}
// cor do selo "vence (provisório)" deve ser --ok
await pg.setViewportSize({width:390,height:900});
for(const [t,esp] of [['claro','rgb(30, 107, 67)'],['escuro','rgb(111, 207, 151)']]){
  await pg.goto(`${url}?estado=concluido-vencedor-provisorio&tema=${t}&largura=390`);
  const c=await pg.$eval('.frame .sel',e=>getComputedStyle(e).color+'|'+getComputedStyle(e).fontSize);
  if(c!==esp+'|14px')ng(`selo vence ${t}: ${c}`);
}
// ⓘ 44 px a 390
await pg.goto(`${url}?estado=ativo-sinal&tema=claro&largura=390`);
const ib=await pg.$eval('.frame .info',e=>{const r=e.getBoundingClientRect();return [r.width,r.height]});
if(ib[0]<44||ib[1]<44)ng('ⓘ '+ib);
// grep color-mix
const fs=await import('node:fs');
if(/color-mix\(/.test(fs.readFileSync(path.join(dir,'index.html'),'utf8')))ng('color-mix presente');
await browser.close();
console.log(`${nshots} capturas; ${falhas} falha(s)`);
process.exit(falhas?1:0);
