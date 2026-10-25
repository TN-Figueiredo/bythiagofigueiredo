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
// Esc fecha cada confirmação e devolve o foco ao gatilho; sem rótulo de botão duplicado visível
await pg.setViewportSize({width:390,height:900});
for(const [k,id] of [['ativo-sinal','cfA'],['ativo-sinal','cfE'],['concluido-aplicado','cfV'],['concluido-vencedor-provisorio','cfA'],['concluido-aplicado-mudou','cfV']]){
  await pg.goto(`${url}?estado=${k}&tema=claro&largura=390`);
  const g=pg.locator(`.frame [data-abre="${id}"]`);
  if(!await g.count())continue;
  await g.click();
  const m=await pg.evaluate((i)=>{const d=document.getElementById(i);const cs=getComputedStyle(d);const r=d.getBoundingClientRect();return {open:d.open,modal:d.matches(':modal'),foco:document.activeElement?.textContent.trim(),bg:cs.backgroundColor,w:Math.round(r.width),bottom:Math.round(innerHeight-r.bottom)}},id);
  if(!m.open||!m.modal||m.foco!=='Cancelar')ng(`${k} ${id} dialog: ${JSON.stringify(m)}`);
  if(m.bg==='rgba(0, 0, 0, 0)'||m.bg==='transparent')ng(`${k} ${id} dialog sem fundo`);
  if(m.w!==390||m.bottom>1)ng(`${k} ${id} 390 deveria colar ao rodapé: ${JSON.stringify(m)}`);
  const rot=await pg.evaluate(()=>{const m={};[...document.querySelectorAll('.frame button')].filter(b=>b.offsetParent&&!b.hasAttribute('data-info')).forEach(b=>{const r=b.textContent.trim();if(!r)return;m[r]=(m[r]||0)+1});return Object.entries(m).filter(([,n])=>n>1).map(([r])=>r)});
  if(rot.length)ng(`${k} ${id} rótulo duplicado: ${rot}`);
  if(id==='cfV'||id==='cfA'){await pg.setViewportSize({width:430,height:900});await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots',`${k}-claro-390-confirma.png`)});await pg.setViewportSize({width:390,height:900})}
  await pg.keyboard.press('Escape');
  const r2=await pg.evaluate((i)=>({fechado:!document.getElementById(i).open,foco:document.activeElement?.dataset?.abre}),id);
  if(!r2.fechado||r2.foco!==id)ng(`${k} ${id} Esc: ${JSON.stringify(r2)}`);
}
// foco após Aplicar e Voltar vai a um alvo visível (.noar), não ao body
for(const [k,sel] of [['concluido-vencedor-provisorio','[data-aplica]'],['concluido-aplicado','[data-volta]']]){
  await pg.goto(`${url}?estado=${k}&tema=claro&largura=390`);
  await pg.locator('.frame [data-abre]').first().click();
  await pg.locator(`.frame ${sel}`).click();
  const f=await pg.evaluate(()=>{const a=document.activeElement;return {cls:a.className,vis:!!a.offsetParent,body:a===document.body,txt:a.textContent.trim().slice(0,60)}});
  if(f.body||!f.vis||f.cls!=='noar')ng(`${k} foco após ação: ${JSON.stringify(f)}`);
  await pg.setViewportSize({width:430,height:900});await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots',`${k}-claro-390-depois.png`)});await pg.setViewportSize({width:390,height:900});
}
// ⓘ: altura do documento igual aberto/fechado; popover dentro da moldura (390) e fecha por Esc, fora, outro ⓘ, Tab
for(const [t,w] of [['escuro','1440'],['escuro','390'],['claro','390'],['claro','1440']]){
  await pg.setViewportSize({width:w==='390'?390:1500,height:900});
  await pg.goto(`${url}?estado=ativo-sinal&tema=${t}&largura=${w}`);
  const n=await pg.locator('.frame [data-info]').count();
  if(n<2)ng(`ⓘ: só ${n}`);
  for(let i=0;i<n;i++){
    const b=pg.locator('.frame [data-info]').nth(i);
    await b.scrollIntoViewIfNeeded();
    const h0=await pg.evaluate(()=>document.documentElement.scrollHeight);
    const y0=await pg.evaluate(()=>[...document.querySelectorAll('.frame .sec,.frame .dias')].map(e=>Math.round(e.getBoundingClientRect().height)));
    await b.click();
    const tid=await b.getAttribute('aria-controls');
    const h1=await pg.evaluate(()=>document.documentElement.scrollHeight);
    const y1=await pg.evaluate(()=>[...document.querySelectorAll('.frame .sec,.frame .dias')].map(e=>Math.round(e.getBoundingClientRect().height)));
    if(h0!==h1||JSON.stringify(y0)!==JSON.stringify(y1))ng(`ⓘ ${i} ${t} ${w} altera layout ${h0}->${h1}`);
    const g=await pg.evaluate((id)=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),f=document.querySelector('.frame').getBoundingClientRect(),cs=getComputedStyle(e);return {l:r.left-f.left,rt:f.right-r.right,t:r.top,b:innerHeight-r.bottom,pos:cs.position,bd:cs.borderTopColor,dby:document.querySelectorAll('[aria-describedby]').length}},tid);
    if(g.pos!=='absolute'||g.l<-0.5||g.rt<-0.5)ng(`ⓘ ${i} ${t} ${w} fora da moldura ${JSON.stringify(g)}`);
    if(w==='390'&&(g.t<0||g.b<0))ng(`ⓘ ${i} ${t} ${w} fora do viewport ${JSON.stringify(g)}`);
    if(g.dby)ng('aria-describedby presente');
    if(i===0&&(t==='escuro')){await pg.screenshot({path:path.join(dir,'shots',`info-aberto-${t}-${w}.png`)}); /* sem resize: resize fecha o popover */}
    // Esc fecha e devolve foco ao ⓘ
    await pg.keyboard.press('Escape');
    const e1=await pg.evaluate(()=>({exp:document.activeElement.getAttribute('aria-expanded'),inf:document.activeElement.hasAttribute('data-info')}));
    if(e1.exp!=='false'||!e1.inf)ng(`ⓘ ${i} Esc ${JSON.stringify(e1)}`);
    // toque fora
    await b.click();await pg.mouse.click(5,5);
    if(await b.getAttribute('aria-expanded')!=='false')ng(`ⓘ ${i} não fecha por toque fora`);
    // Tab para fora
    await b.click();await b.focus();await pg.keyboard.press('Tab');
    if(await b.getAttribute('aria-expanded')!=='false')ng(`ⓘ ${i} não fecha com Tab`);
  }
  // abrir outro fecha o anterior
  const bs=pg.locator('.frame [data-info]');await bs.nth(0).click();await bs.nth(1).click();
  const ab=await pg.locator('.frame [data-info][aria-expanded="true"]').count();
  if(ab!==1)ng(`ⓘ abertos simultâneos: ${ab}`);
}
// captura do Encerrar aberto (escuro 1440 e 390)
for(const w of ['1440','390']){
  await pg.setViewportSize({width:w==='390'?390:1500,height:900});
  await pg.goto(`${url}?estado=ativo-sinal&tema=escuro&largura=${w}`);
  await pg.locator('.frame [data-abre="cfE"]').click();
  await pg.screenshot({path:path.join(dir,'shots',`encerrar-aberto-escuro-${w}.png`)});
  await pg.keyboard.press('Escape');
}
await browser.close();
console.log(`${nshots} capturas; ${falhas} falha(s)`);
process.exit(falhas?1:0);
