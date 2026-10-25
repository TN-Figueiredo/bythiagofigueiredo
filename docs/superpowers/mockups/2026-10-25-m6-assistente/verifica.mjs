// Uso: node verifica.mjs  (Playwright headless; gera shots/ e confere overflow 390, alvos de 44 px, fonte >= 12 px, contraste, dado inventado, esperas)
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require=createRequire('/Users/figueiredo/Workspace/bythiagofigueiredo/package.json');
const {chromium}=require('playwright');
const dir=path.dirname(fileURLToPath(import.meta.url));
const url=pathToFileURL(path.join(dir,'index.html')).href;
const FULL=['seletor','tipo-criando','variantes-titulo','revisar-titulo','revisar-ativando','teste-carregando'];
const browser=await chromium.launch();
const pg=await browser.newPage({viewport:{width:1500,height:900}});
await pg.goto(url);
const estados=await pg.$$eval('#sEstado button',b=>b.map(x=>x.dataset.v));
let falhas=0;const ng=m=>{falhas++;console.log('FALHA',m)};
let nshots=0;
const INVENTADO=/FILA DE|3 HORAS|12 mil|11 testes|Challenger|Failed|Untitled|Burn-in|Ciclos|Passo \d de 5|Carregando o placar<|RAMEN/;
// contraste: cor do texto sobre o fundo opaco mais próximo (compondo alfa)
const CONTRASTE=()=>{
  const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}};
  const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
  const bgOf=el=>{const ch=[];for(let e=el;e;e=e.parentElement)ch.push(e);let b={r:255,g:255,b:255,a:1};for(let i=ch.length-1;i>=0;i--){const c=parse(getComputedStyle(ch[i]).backgroundColor);if(c&&c.a>0)b=over(c,b)}return b};
  const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
  const out=[];
  document.querySelectorAll('.frame *').forEach(el=>{
    if(el.closest('[hidden]')||el.closest('svg')||el.disabled||el.closest('[aria-disabled="true"]'))return;
    const t=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');
    if(!t||el.tagName==='OPTION')return;
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||el.offsetParent===null&&cs.position!=='fixed')return;
    const fg=parse(cs.color);if(!fg)return;
    const bg=bgOf(el),f=over(fg,bg);
    const l1=L(f),l2=L(bg),r=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    const big=parseFloat(cs.fontSize)>=24||(parseFloat(cs.fontSize)>=18.66&&+cs.fontWeight>=700);
    if(r<(big?3:4.5)&&!el.closest('.ph'))out.push([t.slice(0,32),r.toFixed(2)]);
  });
  return out;
};
for(const k of estados){
  const combos=FULL.includes(k)?[['claro','1440'],['escuro','1440'],['claro','390'],['escuro','390']]:[['claro','390']];
  for(const [t,w] of combos){
    await pg.setViewportSize({width:w==='390'?390:1500,height:900});
    await pg.goto(`${url}?estado=${k}&tema=${t}&largura=${w}`);
    await pg.waitForSelector('.frame');
    const html=await pg.$eval('.frame',e=>e.innerHTML);
    if(INVENTADO.test(html))ng(`${k} ${t} ${w}: texto inventado/inglês ${html.match(INVENTADO)[0]}`);
    if(w==='390'){
      const ov=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      const ovf=await pg.evaluate(()=>{const fr=document.querySelector('.frame');const f=fr.getBoundingClientRect();let m=0;fr.querySelectorAll('*').forEach(e=>{if(e.closest('.ph'))return;const r=e.getBoundingClientRect();if(r.width&&r.right-f.right>.5)m=Math.max(m,r.right-f.right)});return Math.max(m,fr.scrollWidth-fr.clientWidth)});
      if(ov>0||ovf>0)ng(`${k} ${t} 390 overflow ${ov}/${ovf}`);
      const peq=await pg.evaluate(()=>[...document.querySelectorAll('.frame button, .frame input')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return [(b.className||b.textContent.trim()).slice(0,24),Math.round(r.width),Math.round(r.height)]}).filter(([,w,h])=>w<44||h<44));
      if(peq.length)ng(`${k} ${t} alvo<44: ${JSON.stringify(peq)}`);
    }
    // fonte >= 12 px em todo texto (exceto a moldura do celular de exemplo)
    const pf=await pg.evaluate(()=>{const o=[];document.querySelectorAll('.frame *').forEach(el=>{if(el.closest('svg'))return;const t=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!t)return;const fs=parseFloat(getComputedStyle(el).fontSize);if(fs<12)o.push([el.textContent.trim().slice(0,24),fs])});return o});
    if(pf.length)ng(`${k} ${t} ${w} fonte<12: ${JSON.stringify(pf)}`);
    const co=await pg.evaluate(CONTRASTE);
    if(co.length)ng(`${k} ${t} ${w} contraste<4,5: ${JSON.stringify(co.slice(0,6))}`);
    // no máximo um role=status por tela (sem leitura duplicada)
    const st=await pg.$$eval('.frame .etd-msg[role="status"]',e=>e.length);
    if(st>1)ng(`${k}: ${st} role=status`);
    await pg.setViewportSize({width:w==='390'?430:1500,height:900});
    await pg.locator('.frame').first().screenshot({path:path.join(dir,'shots',`${k}-${t}-${w}.png`)});nshots++;
  }
}
await pg.setViewportSize({width:1500,height:900});
const get=async(k,f)=>{await pg.goto(`${url}?estado=${k}&tema=claro&largura=1440`);return pg.evaluate(f)};
// 1. seletor: as duas linhas do mesmo título se distinguem por data
{const r=await get('seletor',()=>[...document.querySelectorAll('.vp')].map(b=>({t:b.querySelector('.t').textContent,m:b.querySelector('.m').textContent})));
 const iguais=r.filter(x=>x.t===r[0].t);if(iguais.length<2)ng('seletor: faltam duas linhas de mesmo título');
 if(new Set(iguais.map(x=>x.m)).size!==iguais.length)ng('seletor: linhas de mesmo título não se distinguem');
 if(!r.every((x,i)=>true))ng('x');}
// 1b. dado ausente: nada de 0, undefined ou null na tela
{const t=await get('seletor-dado-ruim',()=>document.querySelector('.frame').textContent);
 if(/undefined|null|NaN/.test(t))ng('seletor-dado-ruim: undefined/null na tela');
 if(!/Data de publicação não informada/.test(t))ng('seletor-dado-ruim: falta o texto de data ausente');
 if(/0 visualizações/.test(t)===false)ng('seletor-dado-ruim: 0 visualizações real deveria aparecer (zero é dado)');}
// 2. tipo-criando: sem véu; só o cartão clicado ocupado; os outros desabilitados; rodapé com .etd-msg.busy
{const r=await get('tipo-criando',()=>({veu:!!document.querySelector('.frame [class*="inset"],.frame .veu'),busy:document.querySelectorAll('.frame [aria-busy="true"].tp-c').length,dis:document.querySelectorAll('.frame .tp-c[aria-disabled="true"]').length,msg:document.querySelectorAll('.frame .etd-msg.busy').length,canc:document.querySelector('.frame .wz-f .b').disabled,dlg:document.querySelector('.frame .wz').getAttribute('aria-busy')}));
 if(r.veu||r.busy!==1||r.dis!==2||r.msg!==1||!r.canc||r.dlg!=='true')ng('tipo-criando '+JSON.stringify(r));}
// 3. revisar por tipo: título = mesma thumb e títulos diferentes; thumbnail = mesmo título e thumbs diferentes; combo = ambos diferem
for(const [k,th,ti] of [['revisar-titulo',true,false],['revisar-thumbnail',false,true],['revisar-combo',false,false]]){
  const r=await get(k,()=>[...document.querySelectorAll('.frame .cmg .cmc')].map(c=>({th:c.querySelector('.cmt').className.replace(/cmt|\s/g,''),t:c.querySelector('.tt').textContent})));
  if(r.length!==2){ng(k+' cartões '+r.length);continue}
  if((r[0].th===r[1].th)!==th)ng(`${k}: thumbs ${r[0].th}/${r[1].th}`);
  if((r[0].t===r[1].t)!==ti&&!(k==='revisar-titulo'&&r[0].t!==r[1].t))ng(`${k}: títulos iguais=${r[0].t===r[1].t}`);
  if(k==='revisar-titulo'&&r[0].t===r[1].t)ng('revisar-titulo: B mostra o título de A');
}
// 3b. sem imagem: cartão tracejado "Sem thumbnail", nunca arte
{const r=await get('revisar-combo-sem-imagem',()=>({sem:document.querySelectorAll('.frame .cmt.semimg').length,txt:document.querySelector('.frame .cmt.semimg')?.textContent}));
 if(r.sem!==1||r.txt!=='Sem thumbnailEscolher da Biblioteca')ng('sem-imagem '+JSON.stringify(r));}
// 4. aviso de volume: o esqueleto reserva a altura do maior cartão (sem salto) e a ativação não o remove
{const hs=async k=>get(k,()=>{const e=document.querySelector('.frame .avs')||document.querySelector('.frame .avs-sk');return e?Math.round(e.getBoundingClientRect().height):0});
 for(const w of [1500,390]){await pg.setViewportSize({width:w,height:900});
  const a=await hs('revisar-titulo-lendo');
  for(const k of ['revisar-titulo','revisar-thumbnail']){const b=await hs(k);if(!a||!b||b>a+0.5)ng(`aviso ${w}: esqueleto ${a}px menor que o cartão de ${k} ${b}px (salto de layout)`)}}
 await pg.setViewportSize({width:1500,height:900});
 const r=await get('revisar-ativando',()=>({avs:!!document.querySelector('.frame .avs'),ban:document.querySelector('.frame .ban strong').textContent}));
 if(!r.avs)ng('ativando: o aviso de volume sumiu');
 const b3=await get('revisar-titulo',()=>document.querySelector('.frame .ban strong').textContent);
 if(b3!=='Pronto para ativar, com um aviso abaixo.')ng('banner com aviso: '+b3);
 const b4=await get('revisar-titulo-sem-aviso',()=>document.querySelector('.frame .ban strong').textContent);
 if(b4!=='Tudo pronto.')ng('banner sem aviso: '+b4);}
// 5. ativando: só o botão clicado em gerúndio; salvando: idem; X e Voltar travados
for(const [k,esp] of [['revisar-ativando',['Salvar rascunho','Ativando…']],['revisar-salvando',['Salvando…','Ativar teste']]]){
  const r=await get(k,()=>[...document.querySelectorAll('.frame .wz-f .b')].map(b=>b.textContent.trim()+(b.disabled?'|d':'')));
  const t=r.map(x=>x.split('|')[0]);
  if(JSON.stringify(t.slice(1))!==JSON.stringify(esp))ng(`${k} rótulos ${JSON.stringify(r)}`);
  if(!r.every(x=>x.endsWith('|d')))ng(`${k}: todos os botões devem estar travados ${JSON.stringify(r)}`);
  const x=await pg.$eval('.frame .xb',e=>e.disabled);if(!x)ng(`${k}: X deveria estar travado`);
}
// 6. regra numa linha com ⓘ
{const r=await get('revisar-titulo',()=>({t:document.querySelector('.frame .regra span').textContent,i:document.querySelectorAll('.frame .regra [data-info]').length}));
 if(!/Roda até 15 dias \(mínimo 12\), em rotação ABBA\. Quem escolhe o vencedor é você\./.test(r.t)||r.i!==1)ng('regra '+JSON.stringify(r));}
// 7. carregamento: sem véu, sem bloco com texto dentro, status fora de bloco de esqueleto, contraste do esqueleto
for(const [t,esp] of [['claro',1.4],['escuro',1.4]]){
  await pg.goto(`${url}?estado=teste-carregando-frio&tema=${t}&largura=1440`);
  const r=await pg.evaluate(()=>{const p=s=>{const m=s.match(/rgba?\(([^)]+)\)/)[1].split(/[ ,\/]+/).map(Number);return m};const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};const rt=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
   const fr=document.querySelector('.frame');const bg=p(getComputedStyle(fr).backgroundColor);
   const v=getComputedStyle(fr);const sk=p('rgb('+[...v.getPropertyValue('--cn-skel').trim().replace('#','').match(/../g).map(h=>parseInt(h,16))]+')');const sk2=p('rgb('+[...v.getPropertyValue('--cn-skel2').trim().replace('#','').match(/../g).map(h=>parseInt(h,16))]+')');
   return {c1:rt(sk,bg),c2:rt(sk2,bg),skelComTexto:[...document.querySelectorAll('.frame .skl2')].some(e=>e.textContent.trim())}});
  if(r.c1<esp||r.c2<esp||r.skelComTexto)ng(`esqueleto ${t}: ${JSON.stringify(r)}`);
}
{const r=await get('teste-carregando',()=>({msg:document.querySelectorAll('.frame .etd-msg.busy[role="status"]').length,h2:document.querySelector('.frame h2')?.textContent,skl:document.querySelectorAll('.frame .skl2').length}));
 if(r.msg!==1||r.h2!=='Main AD Diamante 2 - Lolzin raiz!'||r.skl!==0)ng('teste-carregando '+JSON.stringify(r));}
if(/color-mix\(/.test(fs.readFileSync(path.join(dir,'index.html'),'utf8')))ng('color-mix presente');
// 8. ⓘ: altura do documento igual aberto/fechado; fecha com Esc; popover dentro da janela
for(const w of ['1440','390']){
  await pg.setViewportSize({width:w==='390'?390:1500,height:900});
  await pg.goto(`${url}?estado=revisar-titulo&tema=escuro&largura=${w}`);
  const b=pg.locator('.frame [data-info]').first();await b.scrollIntoViewIfNeeded();
  const h0=await pg.evaluate(()=>document.documentElement.scrollHeight);
  await b.click();
  const h1=await pg.evaluate(()=>document.documentElement.scrollHeight);
  const g=await pg.evaluate(()=>{const e=document.querySelector('#flut .obs-fl-pop'),r=e.getBoundingClientRect();return {l:r.left,rt:innerWidth-r.right,t:r.top,b:innerHeight-r.bottom,cls:e.className}});
  if(h0!==h1)ng(`ⓘ ${w} altera layout`);
  if(g.l<7.5||g.rt<7.5||g.t<7.5||g.b<7.5)ng(`ⓘ ${w} fora da janela ${JSON.stringify(g)}`);
  await pg.keyboard.press('Escape');
  if(await b.getAttribute('aria-expanded')!=='false')ng(`ⓘ ${w} Esc não fecha`);
}
// 9. seletores de contexto da prévia funcionam e mantêm 2 cartões
{await pg.setViewportSize({width:1500,height:900});
 for(const c of ['sea','sid','mob','home']){await pg.goto(`${url}?estado=revisar-combo&tema=claro&largura=1440`);await pg.locator(`.frame [data-ctx="${c}"]`).click();
  const n=await pg.$$eval('.frame .cmg .cmc',e=>e.length);if(n!==2)ng('contexto '+c+' cartões '+n);}}
// 10. r2: consertos da revisão
{ // linha de teste ativo: sem opacidade no texto que explica o bloqueio; razão do bloqueio >= 4,5:1 nos 2 temas
 for(const t of ['claro','escuro']){await pg.goto(`${url}?estado=seletor&tema=${t}&largura=1440`);
  const r=await pg.evaluate(()=>{const b=document.querySelector('.frame .vp:disabled');const op=e=>{let o=1;for(let x=e;x&&x!==document.body;x=x.parentElement)o*=+getComputedStyle(x).opacity;return o};
   const a=b.querySelector('.amb'),m=b.querySelector('.m');return {amb:op(a),m:op(m),txt:a.textContent}});
  if(r.amb!==1||r.m!==1)ng(`seletor ${t}: razão do bloqueio com opacidade ${JSON.stringify(r)}`);}}
{const r=await get('seletor-dado-ruim',()=>[...document.querySelectorAll('.frame .vp .th')].map(e=>e.textContent+'|'+e.classList.contains('semimg')));
 if(!r.includes('Sem thumbnail|true'))ng('seletor-dado-ruim: sem thumbnail tracejado '+JSON.stringify(r));
 const m=await pg.evaluate(()=>[...document.querySelectorAll('.frame .vp .m')].map(e=>e.textContent));
 const i21=m.findIndex(x=>x.includes('21:00')),i18=m.findIndex(x=>x.includes('18:32'));
 if(i21<0||i18<0||i21>i18||/não informada/.test(m[0]))ng('seletor-dado-ruim: ordem '+JSON.stringify(m));}
{const r=await get('revisar-combo-sem-imagem',()=>({ban:document.querySelector('.frame .ban strong').textContent,at:[...document.querySelectorAll('.frame .wz-f .b')].pop().disabled,bib:document.querySelectorAll('.frame .cmt.semimg .bib').length,nota:document.querySelector('.frame .nota')?.textContent}));
 if(r.ban!=='Falta a thumbnail da variante B.'||!r.at||r.bib!==1||!/desativado/.test(r.nota||''))ng('combo sem imagem '+JSON.stringify(r));}
{const r=await get('tipo-ja-existe',()=>[...document.querySelectorAll('.frame .wz-f .b')].map(b=>b.textContent.trim()+(b.disabled?'|d':'')));
 if(JSON.stringify(r)!==JSON.stringify(['Cancelar','Abrir rascunho']))ng('tipo-ja-existe '+JSON.stringify(r));}
{const r=await get('tipo-criando',()=>({n:(document.querySelector('.frame').textContent.match(/Criando (o )?rascunho/g)||[]).length}));
 if(r.n!==1)ng('tipo-criando: mensagem repetida '+r.n);}
for(const k of ['revisar-ativando','revisar-erro']){const r=await get(k,()=>({nota:!!document.querySelector('.frame .nota'),t:document.querySelector('.frame .etd-msg')?.textContent}));
 if(r.nota||/1 minuto/.test(r.t))ng(k+' nota/prazo '+JSON.stringify(r));}
{const r=await get('teste-carregando-demora',()=>document.querySelector('.frame .etd-msg').textContent);
 if(/conexão/.test(r)||!/Tentar de novo/.test(r))ng('demora: '+r);}
{const r=await get('variantes-titulo',()=>{const l=document.querySelector('.frame label.fl');return l&&l.textContent});
 if(r!=='Título da variante B')ng('variantes-titulo: falta rótulo visível '+r);}
// 12. FLUXO inteiro clicando (modo padrão): cada passo tem de avançar, para cada tipo
for(const tp of ['title','thumbnail','combo']){
 await pg.setViewportSize({width:1500,height:900});
 await pg.goto(`${url}?tema=claro`);
 const passo=()=>pg.evaluate(()=>document.querySelector('.frame')?.dataset.passo);
 const espera=async(p,ms=6000)=>{try{await pg.waitForFunction(x=>document.querySelector('.frame')?.dataset.passo===x,p,{timeout:ms})}catch(_){ng(`fluxo ${tp}: não chegou em "${p}" (está em "${await passo()}")`);throw new Error('stop')}};
 try{
  if(await passo()!=='lista')ng('fluxo: não abre na lista');
  if(!(await pg.$('.frame .fx-hd h2')))ng('fluxo: lista sem cabeçalho');
  await pg.click('.frame .fx-hd .fx-new');await espera('sel');
  await pg.fill('#bq','zzzz');if(await pg.locator('.frame .vp').count()!==0)ng('fluxo: busca não filtra');
  await pg.fill('#bq','Diamante 3');if(await pg.locator('.frame .vp').count()!==1)ng('fluxo: busca por "Diamante 3" deveria dar 1 linha');
  await pg.fill('#bq','');
  await pg.locator('.frame .vp').first().click();await espera('tipo');
  await pg.click(`.frame .tp-c[data-k="${tp}"]`);
  if(!/Criando o rascunho/.test(await pg.locator('.frame .wz-f').textContent()))ng(`fluxo ${tp}: sem "Criando rascunho…"`);
  await espera('var');
  if(await pg.locator('.frame .wz-f .pri').isEnabled()&&tp!=='thumbnail')ng(`fluxo ${tp}: Próximo habilitado sem título B`);
  await pg.click('.frame .ideia');if(!/não desenhado/i.test(await pg.locator('.frame .wz-b').textContent()))ng('fluxo: ideias sem aviso');
  await pg.click('.frame .wz-f .b:has-text("Voltar")');await espera('tipo');
  await pg.click('.frame .wz-f .pri');await espera('var');
  if(tp!=='thumbnail')await pg.fill('#tb','Título B de teste do fluxo');
  if(tp!=='title')await pg.click('.frame .slot-a button');
  if(!(await pg.locator('.frame .wz-f .pri').isEnabled()))ng(`fluxo ${tp}: Próximo segue desabilitado`);
  await pg.click('.frame .wz-f .pri');await espera('rev');
  if(await pg.locator('.frame .avs-sk').count()!==1)ng('fluxo: sem esqueleto ao abrir Revisar');
  await pg.waitForSelector('.frame .avs',{timeout:3000});
  const ct=await pg.$$eval('.frame [data-ctx]',b=>b.map(x=>x.textContent.trim()));
  if(ct.join()!=='Home,Busca,Sugeridos,Mobile')ng('fluxo: abas '+ct);
  for(const c of ['sea','sid','mob','home']){await pg.click(`.frame [data-ctx="${c}"]`);if(await pg.locator(`.frame [data-ctx="${c}"][aria-pressed="true"]`).count()!==1)ng('fluxo: aba '+c)}
  const tt=await pg.$$eval('.frame .cmc .tt',e=>e.map(x=>x.textContent));
  const th=await pg.$$eval('.frame .cmt',e=>e.map(x=>x.className));
  if(tp==='title'&&(tt[0]===tt[1]||th[0]!==th[1]))ng('fluxo título: prévia errada');
  if(tp==='thumbnail'&&(tt[0]!==tt[1]||th[0]===th[1]))ng('fluxo thumbnail: prévia errada');
  if(tp==='combo'&&(tt[0]===tt[1]||th[0]===th[1]))ng('fluxo combo: prévia errada');
  await pg.click('.frame .wz-f .pri');
  if(!/Ativando…/.test(await pg.locator('.frame .wz-f').textContent()))ng('fluxo: sem "Ativando…"');
  await espera('ld');await pg.waitForSelector('.frame [data-testid="detalhe-carregando"]');
  await espera('ativo');
  if(await pg.locator('.frame iframe').count()!==1)ng('fluxo: tela ativa sem o mockup M5');
  await pg.click('#rst');await espera('lista');
 }catch(e){if(e.message!=='stop')ng(`fluxo ${tp}: ${e.message.split('\n')[0]}`)}
}
await browser.close();
console.log(`${nshots} capturas; ${falhas} falha(s)`);
process.exit(falhas?1:0);
