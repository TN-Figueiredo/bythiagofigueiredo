// Uso: node verifica.mjs  (Playwright headless; gera shots/ e confere overflow 390, coerência de números, alvo de 44 px)
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const require=createRequire('/Users/figueiredo/Workspace/bythiagofigueiredo/package.json');
const {chromium}=require('playwright');
const dir=path.dirname(fileURLToPath(import.meta.url));
const url=pathToFileURL(path.join(dir,'index.html')).href;
const FULL=['concluido-desfeita-bloqueado','concluido-desfeita-provisorio','concluido-desfeita-final','concluido-desfeita-mudou','ativo-sem-volume','ativo-sinal','concluido-vencedor-provisorio','concluido-original-vence','concluido-inconclusivo-volume'];
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
// ⓘ 44 px a 390 (container) e 24 px a 1440; classes e medidas do produto
await pg.goto(`${url}?estado=ativo-sinal&tema=claro&largura=390`);
const ib=await pg.$eval('.frame .ibtn',e=>{const r=e.getBoundingClientRect();return [r.width,r.height]});
if(ib[0]<44||ib[1]<44)ng('ⓘ 390 '+ib);
await pg.setViewportSize({width:1500,height:900});
await pg.goto(`${url}?estado=ativo-sinal&tema=escuro&largura=1440`);
const i24=await pg.$eval('.frame .ibtn.vb-info',e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e),sv=getComputedStyle(e.querySelector('svg'));return [r.width,r.height,c.borderTopWidth,c.borderRadius,c.marginTop,sv.width,sv.height]});
if(JSON.stringify(i24)!==JSON.stringify([24,24,'0px','50%','-6px','16px','16px']))ng('ibtn 1440 difere do produto: '+JSON.stringify(i24));
// grep color-mix
const fs=await import('node:fs');
if(/color-mix\(/.test(fs.readFileSync(path.join(dir,'index.html'),'utf8')))ng('color-mix presente');
// diálogo .etd: estrutura e medidas do produto; Esc fecha e devolve o foco; foco inicial como o produto (Encerrar: 1º focável = Fechar; troca: Voltar)
await pg.setViewportSize({width:390,height:900});
for(const [k,id] of [['ativo-sinal','cfE'],['concluido-aplicado','cfV'],['concluido-vencedor-provisorio','cfA'],['concluido-aplicado-mudou','cfV']]){
  await pg.goto(`${url}?estado=${k}&tema=claro&largura=390`);
  const g=pg.locator(`.frame [data-abre="${id}"]`);
  if(!await g.count())continue;
  await g.click();
  const m=await pg.evaluate((i)=>{const d=document.querySelector('#dlg .etd');if(!d)return null;const cs=getComputedStyle(d),r=d.getBoundingClientRect(),sc=getComputedStyle(d.parentElement);const f=document.activeElement;const bt=[...d.querySelectorAll('.etd-btn,.etd-x')].map(b=>{const q=b.getBoundingClientRect();return [Math.round(q.width),Math.round(q.height)]});return {role:d.getAttribute('role'),modal:d.getAttribute('aria-modal'),foco:f.className+'|'+f.textContent.trim(),bg:cs.backgroundColor,rad:cs.borderTopLeftRadius,sh:cs.boxShadow,maxw:cs.maxWidth,pos:sc.position,z:sc.zIndex,w:Math.round(r.width),l:Math.round(r.left),rt:Math.round(innerWidth-r.right),b:Math.round(innerHeight-r.bottom),bt,ovf:document.documentElement.scrollWidth-innerWidth,fRev:getComputedStyle(d.querySelector('.etd-f')).flexDirection}},id);
  if(!m){ng(`${k} ${id} diálogo não abriu`);continue}
  const roleEsp=id==='cfE'?'dialog':'alertdialog';
  if(m.role!==roleEsp||m.modal!=='true')ng(`${k} ${id} role ${m.role}`);
  const focoEsp=id==='cfE'?'etd-x|':'etd-btn|Cancelar';
  if(m.foco!==focoEsp)ng(`${k} ${id} foco inicial ${m.foco} (esperado ${focoEsp})`);
  if(m.bg==='rgba(0, 0, 0, 0)'||m.bg==='transparent')ng(`${k} ${id} dialog sem fundo`);
  if(m.rad!=='14px'||!/60px/.test(m.sh)||m.maxw!=='440px'||m.pos!=='fixed'||m.z!=='60')ng(`${k} ${id} medidas .etd: ${JSON.stringify(m)}`);
  if(m.l<12||m.rt<12||m.ovf>0)ng(`${k} ${id} 390 fora das margens do scrim: ${JSON.stringify(m)}`);
  if(m.fRev!=='column-reverse')ng(`${k} ${id} rodapé a 390 deveria ser column-reverse: ${m.fRev}`);
  if(m.bt.some(([w,h])=>w<44||h<44))ng(`${k} ${id} alvo<44 no diálogo ${JSON.stringify(m.bt)}`);
  const rot=await pg.evaluate(()=>{const m={};[...document.querySelectorAll('.frame button,#dlg button')].filter(b=>b.offsetParent&&!b.hasAttribute('data-info')).forEach(b=>{const r=b.textContent.trim();if(!r)return;m[r]=(m[r]||0)+1});return Object.entries(m).filter(([,n])=>n>1).map(([r])=>r)});
  if(rot.length)ng(`${k} ${id} rótulo duplicado: ${rot}`);
  if(id==='cfV'||id==='cfA')await pg.screenshot({path:path.join(dir,'shots',`${k}-claro-390-confirma.png`)});
  await pg.keyboard.press('Escape');
  const r2=await pg.evaluate((i)=>({fechado:!document.querySelector('#dlg .etd'),foco:document.activeElement?.dataset?.abre}),id);
  if(!r2.fechado||r2.foco!==id)ng(`${k} ${id} Esc: ${JSON.stringify(r2)}`);
  // fundo clicável fecha e devolve o foco
  await g.click();await pg.mouse.click(2,2);
  const r3=await pg.evaluate(()=>({fechado:!document.querySelector('#dlg .etd'),foco:document.activeElement?.dataset?.abre}));
  if(!r3.fechado||r3.foco!==id)ng(`${k} ${id} clique no fundo: ${JSON.stringify(r3)}`);
}
// 1440: diálogo centrado, largura 440
await pg.setViewportSize({width:1500,height:900});
await pg.goto(`${url}?estado=ativo-sinal&tema=escuro&largura=1440`);
await pg.locator('.frame [data-abre="cfE"]').click();
const dc=await pg.evaluate(()=>{const r=document.querySelector('#dlg .etd').getBoundingClientRect();return {w:Math.round(r.width),cx:Math.round(r.left+r.width/2),cy:Math.round(r.top+r.height/2),vcx:innerWidth/2,vcy:innerHeight/2,fRev:getComputedStyle(document.querySelector('#dlg .etd-f')).flexDirection}});
if(dc.w!==440||Math.abs(dc.cx-dc.vcx)>1||Math.abs(dc.cy-dc.vcy)>1||dc.fRev!=='row-reverse')ng('diálogo 1440 '+JSON.stringify(dc));
await pg.keyboard.press('Escape');
// foco após Aplicar e Voltar vai a um alvo visível (.noar), não ao body
for(const [k,sel] of [['concluido-vencedor-provisorio','[data-aplica]'],['concluido-aplicado','[data-volta]']]){
  await pg.setViewportSize({width:390,height:900});
  await pg.goto(`${url}?estado=${k}&tema=claro&largura=390`);
  await pg.locator('.frame [data-abre]').first().click();
  await pg.locator(`#dlg ${sel}`).click();
  await pg.waitForFunction(()=>document.activeElement&&document.activeElement.className==='noar',null,{timeout:3000}).catch(()=>{});
  const f=await pg.evaluate(()=>{const a=document.activeElement;return {cls:a.className,vis:!!a.offsetParent,body:a===document.body,txt:a.textContent.trim().slice(0,60),aberto:!!document.querySelector('#dlg .etd')}});
  if(f.body||!f.vis||f.cls!=='noar'||f.aberto)ng(`${k} foco após ação: ${JSON.stringify(f)}`);
  await pg.setViewportSize({width:430,height:900});await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots',`${k}-claro-390-depois.png`)});await pg.setViewportSize({width:390,height:900});
}
// ⓘ (popover do produto): altura do documento igual aberto/fechado; caixa dentro da janela; fecha por Esc, fora, outro ⓘ, Tab
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
    const g=await pg.evaluate(([id,bi])=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),cs=getComputedStyle(e),br=document.querySelectorAll('.frame [data-info]')[bi].getBoundingClientRect(),h3=getComputedStyle(e.querySelector('h3')),p=getComputedStyle(e.querySelector('p'));return {pai:e.parentElement.id,cls:e.className,role:e.getAttribute('role'),lab:e.getAttribute('aria-labelledby'),l:r.left,rt:innerWidth-r.right,t:r.top,b:innerHeight-r.bottom,w:Math.round(r.width),pos:cs.position,bd:cs.borderTopColor,rad:cs.borderTopLeftRadius,pad:cs.padding,sh:cs.boxShadow,fs:cs.fontSize,h3:h3.fontSize+'/'+h3.fontWeight,p:p.fontSize+'/'+p.lineHeight,pm:p.marginTop,gap:Math.round(r.top>=br.bottom?r.top-br.bottom:br.top-r.bottom),dby:document.querySelectorAll('[aria-describedby]').length}},[tid,i]);
    if(g.pai!=='flut'||g.cls!=='obs-fl-pop canal-tip'||g.role!=='dialog'||g.lab!==tid+'t'||g.pos!=='fixed')ng(`ⓘ ${i} ${t} ${w} estrutura ${JSON.stringify(g)}`);
    if(g.rad!=='8px'||g.pad!=='12px 14px'||g.fs!=='13px'||g.h3!=='13.5px/600'||g.p!=='13px/19px'||g.pm!=='4px'||!/12px 32px/.test(g.sh))ng(`ⓘ ${i} ${t} ${w} medidas ${JSON.stringify(g)}`);
    if(g.w>380||(w==='1440'&&g.w!==380))ng(`ⓘ ${i} ${t} ${w} largura ${g.w}`);
    if(g.l<7.5||g.rt<7.5||g.t<7.5||g.b<7.5)ng(`ⓘ ${i} ${t} ${w} fora da janela (borda 8) ${JSON.stringify(g)}`);
    if(g.gap<5||g.gap>7)ng(`ⓘ ${i} ${t} ${w} distância ao ⓘ ${g.gap} (produto: 6)`);
    if(g.dby)ng('aria-describedby presente');
    if(i===0&&(t==='escuro')){await pg.screenshot({path:path.join(dir,'shots',`info-aberto-${t}-${w}.png`)}); /* sem resize: reposiciona */}
    // Esc fecha e devolve foco ao ⓘ
    await pg.keyboard.press('Escape');
    const e1=await pg.evaluate(()=>({exp:document.activeElement.getAttribute('aria-expanded'),inf:document.activeElement.hasAttribute('data-info'),nada:!document.querySelector('#flut .obs-fl-pop')}));
    if(e1.exp!=='false'||!e1.inf||!e1.nada)ng(`ⓘ ${i} Esc ${JSON.stringify(e1)}`);
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
  const cx=await pg.locator('#flut .obs-fl-pop').count();
  if(ab!==1||cx!==1)ng(`ⓘ abertos simultâneos: ${ab}/${cx}`);
}
// captura do Encerrar aberto (escuro 1440 e 390)
for(const w of ['1440','390']){
  await pg.setViewportSize({width:w==='390'?390:1500,height:900});
  await pg.goto(`${url}?estado=ativo-sinal&tema=escuro&largura=${w}`);
  await pg.locator('.frame [data-abre="cfE"]').click();
  await pg.screenshot({path:path.join(dir,'shots',`encerrar-aberto-escuro-${w}.png`)});
  await pg.keyboard.press('Escape');
}
// fluxo do selo: provisório -> Aplicar B -> Voltar -> desfeita -> Aplicar B de novo (janela) -> aplicado
for(const w of [390,1500]){
  await pg.setViewportSize({width:w,height:900});
  await pg.goto(`${url}?estado=concluido-vencedor-provisorio&tema=claro&largura=${w===390?'390':'1440'}`);
  const tx=()=>pg.evaluate(()=>document.querySelector('.frame .desf').innerText);
  await pg.locator('.frame [data-abre="cfA"]').click();await pg.locator('#dlg [data-aplica]').click();
  await pg.waitForFunction(()=>/está no ar/.test(document.querySelector('.frame .noar').innerText),null,{timeout:3000});
  let t=await tx();if(!/B está no ar/.test(t)||!/Voltar à original/.test(t))ng('fluxo: após aplicar '+t);
  await pg.locator('.frame [data-abre="cfV"]').click();await pg.locator('#dlg [data-volta]').click();
  await pg.waitForFunction(()=>/Aplicação de B desfeita/.test(document.querySelector('.frame .desf').innerText),null,{timeout:3000});
  t=await tx();const s=await pg.evaluate(()=>document.querySelector('.frame .sum').innerText);
  if(!/Aplicação de B desfeita/.test(t)||!/B venceu o teste · provisório/.test(t)||!/Aplicar B de novo/.test(t)||!/ainda parece melhor, mas a original está no ar/.test(s))ng('fluxo: desfeita '+t+'|'+s);
  if(w===390){const ov=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(ov>0)ng('fluxo 390 overflow');
   await pg.setViewportSize({width:430,height:900});await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots','fluxo-2-desfeita-claro-390.png')});await pg.setViewportSize({width:390,height:900});}
  await pg.locator('.frame [data-abre="cfA"]').click();
  const dl=await pg.locator('#dlg .etd').innerText();if(!/A janela de 7 dias para voltar recomeça hoje\./.test(dl))ng('fluxo: sem frase da janela');
  if(w===390){await pg.setViewportSize({width:430,height:900});await pg.screenshot({path:path.join(dir,'shots','fluxo-3-confirma-claro-390.png')});await pg.setViewportSize({width:390,height:900});}
  await pg.locator('#dlg [data-aplica]').click();
  await pg.waitForFunction(()=>/está no ar/.test(document.querySelector('.frame .noar').innerText),null,{timeout:3000});
  t=await tx();if(!/B está no ar/.test(t)||/desfeita/.test(t)||!/Voltar à original/.test(t))ng('fluxo: aplicado de novo '+t);
}
// estado desfeita-mudou: sem botão de aplicar
await pg.goto(`${url}?estado=concluido-desfeita-mudou&tema=claro&largura=390`);
if(await pg.locator('.frame [data-abre]').count())ng('desfeita-mudou tem botão');

// ---- r2 ----
// Logan 1: bloqueado = sem botão, motivo; frase de apoio sem "Pode aplicar"
for(const [k,mot] of [['concluido-desfeita-bloqueado','Há outro teste aberto neste vídeo.'],['concluido-desfeita-bloqueado-miniatura','Não consegui confirmar a miniatura no YouTube.']]){
  await pg.setViewportSize({width:390,height:900});
  await pg.goto(`${url}?estado=${k}&tema=claro&largura=390`);
  if(await pg.locator('.frame [data-abre]').count())ng(k+' tem botão');
  const tt=await pg.evaluate(()=>document.querySelector('.frame').innerText);
  if(!tt.includes(mot))ng(k+' sem o motivo');
  if(/Pode aplicar/.test(tt))ng(k+' promete reaplicar sem botão');
}
// com botão a frase promete; Logan 2: CTR logo abaixo da frase, antes dos selos
await pg.goto(`${url}?estado=concluido-desfeita-provisorio&tema=claro&largura=390`);
{const o=await pg.evaluate(()=>{const f=document.querySelector('.frame');const t=f.innerText;return {pode:/Pode aplicar B de novo/.test(t),i:[t.indexOf('ainda parece melhor'),t.indexOf('CTR ≈ 5,4% contra 4,6% de A'),t.indexOf('Você voltou à original'),t.indexOf('Aplicação de B desfeita'),t.indexOf('B venceu o teste')],live:f.querySelector('.selreg')?.getAttribute('aria-live'),status:f.querySelectorAll('.desf [role=status]').length}});
 if(!o.pode)ng('sem "Pode aplicar" com botão');
 if(o.i.some(x=>x<0)||o.i.some((x,j)=>j&&x<o.i[j-1]))ng('ordem frase/CTR/apoio/selos '+o.i);
 if(o.live!=='polite'||o.status)ng('aria-live '+JSON.stringify(o));}
// Naksu 1: selo da desfeita cheio, o do resultado vazado; Naksu 2: SVG, sem glifo Unicode
{const o=await pg.evaluate(()=>{const a=document.querySelector('.sel.desfeito'),b=document.querySelector('.sel.neu:not(.desfeito)');const ca=getComputedStyle(a),cb=getComputedStyle(b);return {ba:ca.backgroundColor,bb:cb.backgroundColor,sa:ca.borderTopStyle,svg:document.querySelectorAll('.sel .sy svg').length,uni:/[◆◇]/.test(document.querySelector('.desf').innerText)}});
 if(o.ba==='rgba(0, 0, 0, 0)'||o.bb!=='rgba(0, 0, 0, 0)'||o.sa!=='solid'||o.svg<2||o.uni)ng('selos cheio/vazado '+JSON.stringify(o));}
// Logan 4: cancelar chama-se Cancelar; Logan 5 (menor): final repete "já não muda"
await pg.goto(`${url}?estado=concluido-desfeita-final&tema=claro&largura=390`);
await pg.locator('.frame [data-abre="cfA"]').click();
{const dl=await pg.locator('#dlg .etd').innerText();
 if(!/Este desfecho já não muda\./.test(dl)||!/Cancelar/.test(dl)||/\nVoltar\n/.test(dl))ng('diálogo desfeita-final '+dl);}
await pg.keyboard.press('Escape');
// Logan 3: espera (desabilitado, foco mantido), erro com role=alert e nova tentativa; vale para Voltar à original
for(const [k,abre,confirma,esperaTxt,erroTxt,okTxt] of [['concluido-desfeita-provisorio','cfA','[data-aplica]',/Aplicando B/,/Não consegui aplicar B\. A original continua no ar\./,/B está no ar/],['concluido-aplicado','cfV','[data-volta]',/Voltando à original/,/Não consegui voltar à original\. B continua no ar\./,/Aplicação de B desfeita/]]){
  await pg.goto(`${url}?estado=${k}&tema=claro&largura=390`);
  await pg.evaluate(()=>{document.getElementById('simFalha').checked=true});
  await pg.locator(`.frame [data-abre="${abre}"]`).click();await pg.locator(`#dlg ${confirma}`).click();
  const e1=await pg.evaluate(()=>{const b=document.activeElement;return {dis:b.getAttribute('aria-disabled'),txt:b.textContent,cls:b.className,h:Math.round(b.getBoundingClientRect().height)}});
  if(e1.dis!=='true'||!esperaTxt.test(e1.txt)||e1.h<44)ng(k+' espera '+JSON.stringify(e1));
  await pg.waitForSelector('.frame .errb[role=alert]');
  const e2=await pg.evaluate(()=>({t:document.querySelector('.frame .errb').innerText,f:document.activeElement.dataset.retenta}));
  if(!erroTxt.test(e2.t)||!e2.f)ng(k+' erro '+JSON.stringify(e2));
  await pg.setViewportSize({width:430,height:900});await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots',`${k}-claro-390-erro.png`)});await pg.setViewportSize({width:390,height:900});
  await pg.evaluate(()=>{document.getElementById('simFalha').checked=false});
  await pg.locator('.frame [data-retenta]').click();
  await pg.waitForFunction(()=>!document.querySelector('.frame .errb')&&!document.querySelector('.frame [aria-disabled=true]'),null,{timeout:3000});
  const t2=await pg.evaluate(()=>document.querySelector('.frame .desf').innerText);
  if(!okTxt.test(t2))ng(k+' nova tentativa '+t2);
}
// Naksu 3: 320 px sem overflow nos estados tocados e com rótulo longo (EN) quebrando sem feiura
await pg.setViewportSize({width:320,height:900});
for(const k of ['concluido-desfeita-provisorio','concluido-desfeita-final','concluido-desfeita-mudou','concluido-desfeita-bloqueado','concluido-desfeita-bloqueado-miniatura','concluido-desfeita-aplicando','concluido-desfeita-erro','concluido-aplicado-voltando','concluido-aplicado-erro','concluido-aplicado']){
  await pg.goto(`${url}?estado=${k}&tema=claro&largura=320`);await pg.waitForSelector('.frame');
  const o=await pg.evaluate(()=>{const fr=document.querySelector('.frame');const f=fr.getBoundingClientRect();let m=0;fr.querySelectorAll('*').forEach(e=>{if(e.closest('[hidden]'))return;const r=e.getBoundingClientRect();if(r.width&&r.right-f.right>m)m=r.right-f.right});return {doc:document.documentElement.scrollWidth-innerWidth,m,peq:[...fr.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).filter(r=>r.height<44).length}});
  if(o.doc>0||o.m>0||o.peq)ng(`${k} 320 overflow/alvo ${JSON.stringify(o)}`);
}
await pg.goto(`${url}?estado=concluido-desfeita-provisorio&tema=claro&largura=320`);
{const o=await pg.evaluate(()=>{const sels=[...document.querySelectorAll('.frame .sel')];sels[1].lastChild.textContent='B won the test and is still ahead · provisional until 11/04';sels[0].lastChild.textContent='Application of B was undone by you just now';const fr=document.querySelector('.frame').getBoundingClientRect();return {h:sels.map(x=>Math.round(x.getBoundingClientRect().height)),over:sels.some(x=>x.getBoundingClientRect().right>fr.right),doc:document.documentElement.scrollWidth-innerWidth}});
 if(o.over||o.doc>0)ng('320 rótulo longo '+JSON.stringify(o));
 await pg.setViewportSize({width:360,height:900});await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots','concluido-desfeita-rotulo-longo-claro-320.png')});await pg.setViewportSize({width:320,height:900});}
for(const k of ['concluido-desfeita-provisorio','concluido-desfeita-bloqueado']){await pg.goto(`${url}?estado=${k}&tema=claro&largura=320`);await pg.setViewportSize({width:360,height:900});await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots',`${k}-claro-320.png`)});await pg.setViewportSize({width:320,height:900});}
await browser.close();
console.log(`${nshots} capturas; ${falhas} falha(s)`);
process.exit(falhas?1:0);
