/* hist-dados.js: o motor do mockup aprovado (2026-10-07-historico-muitas-versoes/dados.js: effect.ts, series.ts, changes.ts, R115/R116/R121), copiado e ligado aos dados do Leo Khev. Mudanças em relação ao original estão marcadas "rodada 3". */
(function(){
'use strict';
const H=3600e3, DAY=24*H, MINUS='−';
const sp=(y,mo,d,h,mi)=>Date.UTC(y,mo-1,d,(h||0)+3,mi||0);            // São Paulo = UTC−3, sem horário de verão
const NOW=window.CANAL.NOW;                                              // 07/10/2026 22:15 (São Paulo), o 'agora' do mockup
const LAST_SYNC=Date.parse(window.CANAL.canal.syncAt);
const SNAP0=sp(2026,9,1,12,0);                                          // âncora dos registros diários (12:00)
const RULES={effect:{afterDays:7,maxBeforeDays:7,minBeforeDays:3,minN:5,pp:10,simultHours:48}, testCompareMaxDays:14,
  testRunGapDays:14,           // R121: intervalo máximo entre duas trocas da mesma sequência
  collapseAbove:8,             // Fase 4, item 2: grade recolhida acima de 8 períodos
  compareListFrom:7,           // decisão do autor: até 6 trocas os botões de par ficam como hoje
  rangeFromDays:30};           // decisão do autor: o filtro de período aparece com mais de 30 dias de série ou grade recolhida

/* ---------------- datas e números (formatos da produção: time.ts e fmt.ts) ---------------- */
const p2=n=>String(n).padStart(2,'0');
const parts=ms=>{const x=new Date(ms-3*H);return{y:x.getUTCFullYear(),mo:x.getUTCMonth()+1,d:x.getUTCDate(),h:x.getUTCHours(),mi:x.getUTCMinutes(),dow:x.getUTCDay()}};
const WD=['domingo','segunda','terça','quarta','quinta','sexta','sábado'], WDS=['dom','seg','ter','qua','qui','sex','sáb'];
const D={
  dm:ms=>{const p=parts(ms);return p2(p.d)+'/'+p2(p.mo)},
  hm:ms=>{const p=parts(ms);return p2(p.h)+':'+p2(p.mi)},
  hh:ms=>p2(parts(ms).h)+'h',
  dmhm:ms=>D.dm(ms)+' '+D.hm(ms),
  weekday:ms=>WD[parts(ms).dow], weekdayShort:ms=>WDS[parts(ms).dow],
  ago:ms=>{const d=NOW-ms; if(d<6e4) return 'agora'; if(d<H) return 'há '+Math.max(1,Math.round(d/6e4))+' min'; if(d<48*H) return 'há '+Math.round(d/H)+' h'; const n=Math.round(d/DAY); return 'há '+n+(n===1?' dia':' dias')},
  windowText:(a,b)=>{const pa=parts(a),pb=parts(b),same=pa.d===pb.d&&pa.mo===pb.mo; return 'entre '+D.dm(a)+' '+p2(pa.h)+'h e '+(same?'':D.dm(b)+' ')+p2(pb.h)+'h'},
  dur:(ms,approx)=>{ if(approx){const d=Math.round(ms/DAY); return d>=1?'≈ '+d+' d':'≈ '+Math.round(ms/H)+' h'}
    const d=Math.floor(ms/DAY),h=Math.floor((ms%DAY)/H),mi=Math.round((ms%H)/6e4); return d?d+' d '+h+' h':h?h+' h '+mi+' min':mi+' min'},
  gi:ms=>Math.ceil((ms-SNAP0)/DAY),                                    // índice do 1º registro diário em ou depois de ms
  snap:i=>SNAP0+i*DAY,
};
const du=ms=>D.dur(ms).replace(/ 0 h$/,'').replace(/ 0 min$/,'');
const dec1t=x=>{const r=Math.round(x*10)/10; return (r%1===0?String(r):r.toFixed(1)).replace('.',',').replace('-',MINUS)};
const F={
  num:v=>{ if(v==null) return '—'; const a=Math.abs(v),s=v<0?MINUS:''; if(a<1000) return s+Math.round(a); if(a<1e6) return s+dec1t(a/1e3)+' mil'; return s+dec1t(a/1e6)+' mi'},
  mult:x=>x==null?'—':(Math.round(x*10)/10).toFixed(1).replace('.',',')+'×',
  pct:x=>{ if(x==null) return '—'; const r=Math.round(x*100); return (r>0?'+':r<0?MINUS:'')+Math.abs(r)+'%'},
  pp:x=>{ if(x==null) return '—'; const r=Math.round(x); return (r>0?'+':r<0?MINUS:'')+Math.abs(r)+' pp'},
  plural:(n,one,many)=>n+' '+(n===1?one:many),
  lcfirst:t=>t?t.charAt(0).toLowerCase()+t.slice(1):t,
  cap:t=>t?t.charAt(0).toUpperCase()+t.slice(1):t,
};
const median=a=>quant(a,.5);
function quant(a,q){ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y),p=(s.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p); return s[lo]+(s[hi]-s[lo])*(p-lo) }
const AGE_BANDS=[{lo:0,hi:7,label:'0–7 dias'},{lo:8,hi:30,label:'8–30 dias'},{lo:31,hi:90,label:'31–90 dias'},{lo:91,hi:365,label:'91–365 dias'},{lo:366,hi:1e9,label:'mais de 365 dias'}];
const bandOf=a=>AGE_BANDS.find(b=>a>=b.lo&&a<=b.hi)||AGE_BANDS[0];
const TYPE_LABEL={title:'Título',thumb:'Thumbnail',desc:'Descrição'}, TYPE_NAME={title:'título',thumb:'thumbnail',desc:'descrição'}, FEM={title:false,thumb:true,desc:true};

/* ---------------- o mundo desta rodada: o canal Leo Khev, de dados.js (window.CANAL / window.BRUTO), no formato que o motor do histórico espera ----------------
   Reais: vídeos, títulos atuais, views, datas, série diária de 03/10 a 07/10 (o registro de cada dia vale às 12:00).
   Fabricado (ver LEIAME): as 7 trocas e os títulos "antes". Sem dado no banco: descrição (uma única versão, texto desconhecido) e as imagens anteriores das thumbnails (nunca arquivadas). */
const C=window.CANAL, CHANNEL={id:'leo-khev',name:C.canal.nome,niche:'viagem',ini:C.canal.nome.split(' ').map(x=>x[0]).join('').slice(0,2),color:'#40382D',avatar:C.canal.avatar,video_limit:C.canal.limite,sync:{state:'ok',label:'em dia',last:LAST_SYNC},peers:{}};
const CHANNELS=[CHANNEL];
const NICHES={viagem:{id:'viagem',label:'Viagem'}};
const SP=(iso,h)=>{ const [y,m,d]=iso.split('-').map(Number); return sp(y,m,d,h,0) };
const CASO_PUB={}; (window.BRUTO.casos||[]).forEach(c=>{ if(c.real&&c.real.p) CASO_PUB[c.video]=Date.parse(c.real.p) });
const V=new Map(), CH=new Map([[CHANNEL.id,CHANNEL]]);
const letterOf=i=>String.fromCharCode(65+i);
for(const r of C.videos){
  const T=C.trocas.filter(t=>t.video===r.id).sort((a,b)=>a.ms-b.ms), TT=T.filter(t=>t.campo==='titulo'), TH=T.filter(t=>t.campo==='thumbnail');
  const pubMissing=r.pub==null, pub=pubMissing?(CASO_PUB[r.id]||r.chk||NOW-DAY):r.pub;
  const v={id:r.id,ch:CHANNEL.id,pub,pubMissing,dur:r.dur!=null?C.fmt.dur(r.dur):null,fmt:r.fmt,niche:'viagem',raw:r,url:r.url,pinned:r.pinned,pinAntigo:r.pinAntigo,
    art:{}, nArchived:1};
  const mk=(type,arr)=>arr.map((x,i)=>{
    const at=i===0?pub:x[1];
    return {id:v.id+'/'+type+'/v'+i,type,i,first_seen:at,prec:i===0?'publicacao':type==='thumb'?'min':'6h',window:i>0&&type!=='thumb'?[at-x[2],at]:null,
      key:type==='thumb'?x[0]:null,text:type==='title'?x[0]:null,lines:type==='desc'?x[0]:null};
  });
  const thumbs=[['A']].concat(TH.map((t,i)=>[letterOf(i+1),t.ms])), titles=[[TT.length?TT[0].de:r.t]].concat(TT.map(t=>[t.para,t.ms,window.FORJA.janelaMs(t)||6*H]));
  thumbs.forEach(t=>{ v.art[t[0]]={bg:'#2A251F'} });
  v.thumbs=mk('thumb',thumbs); v.titles=mk('title',titles); v.descs=mk('desc',[[['(texto da descrição não exportado para este mockup)']]]);
  v.descUnknown=true;
  const letters=new Map(); v.thumbs.forEach(t=>{ if(!letters.has(t.key)) letters.set(t.key,String.fromCharCode(65+letters.size)) });
  v.thumbs.forEach(t=>t.label=letters.get(t.key)); v.titles.forEach((t,i)=>t.label='T'+(i+1)); v.descs.forEach((t,i)=>t.label='D'+(i+1));
  for(const arr of [v.thumbs,v.titles,v.descs]) arr.forEach((x,i)=>{ const nx=arr[i+1]; x.current=!nx; x.endLo=nx?(nx.window?nx.window[0]:nx.first_seen):NOW; x.endHi=nx?nx.first_seen:NOW; x.last_seen=x.endLo });
  v.title=v.titles[v.titles.length-1].text;
  v.series=(r.serie||[]).map(p=>{ const t=SP(p[0],12); return {i:D.gi(t),t,views:p[1]} });
  v.firstIdx=v.series.length?v.series[0].i:null; v.lastIdx=v.series.length?v.series[v.series.length-1].i:null;
  v.views=r.views; v.ageDays=Math.floor((NOW-pub)/DAY);
  V.set(v.id,v);
}
const arrOf=(v,type)=>type==='title'?v.titles:type==='thumb'?v.thumbs:v.descs;
const viewsAt=(v,i)=>{ const p=v.series[i-v.firstIdx]; return p?p.views:null };

const CHG=new Map();
function deriveChanges(v){
  const out=[];
  for(const type of ['title','thumb','desc']){
    const arr=arrOf(v,type);
    arr.forEach((ver,i)=>{ if(!i) return; const prev=arr[i-1];
      const c={id:v.id+'/'+type+'/'+i,video:v.id,ch:v.ch,type,typeLabel:TYPE_LABEL[type],idx:i,at:ver.first_seen,window:ver.window,prec:ver.prec,
        mid:ver.window?(ver.window[0]+ver.window[1])/2:ver.first_seen,from:prev,to:ver,revertTo:null,sameWindow:[],within48h:[]};
      c.whenText=c.window?D.windowText(c.window[0],c.window[1]):D.dmhm(c.at);
      c.agoShort=D.ago(c.at);
      c.label=type==='thumb'?'Thumbnail '+prev.label+' → '+ver.label:TYPE_LABEL[type]+' '+prev.label+' → '+ver.label;
      c.prevLivedMs=prev.last_seen-prev.first_seen;                          // changes.ts:58 e :73: todos os campos
      if(type==='thumb'){
        c.nextLivedMs=ver.last_seen-ver.first_seen;
        const earlier=arr.slice(0,i-1).map(x=>x.key);
        if(earlier.includes(ver.key)){ c.revertTo=ver.label; const left=arr.slice(0,i).reverse().find(x=>x.key===ver.key); c.cycleMs=ver.first_seen-left.endLo; c.testCompare=c.cycleMs<=RULES.testCompareMaxDays*DAY;
          /* rodada 3: a volta é IMEDIATA só em A → B → A. Com outras imagens no meio, os textos de reversão da produção
             ("com a alternativa", "revertida", "B → C → B") deixam de ser verdade; between = quantas imagens distintas houve no intervalo. */
          c.immediate=arr[i-2].key===ver.key; c.between=new Set(arr.slice(left.i+1,i).map(x=>x.key)).size }
      }
      if(type==='title'&&arr.slice(0,i-1).some(x=>x.text===ver.text)) c.revertTo=ver.text;
      out.push(c);
    });
  }
  for(const c of out){   // changes.ts:77-82: a troca anterior a uma reversão herda as marcas dela
    if(c.type==='thumb'&&c.revertTo){ const leg=out.find(o=>o.type==='thumb'&&o.idx===c.idx-1); if(leg){ leg.revertedBy=c.id; leg.testCompare=c.testCompare; leg.cycleMs=c.cycleMs; leg.revertedImmediate=c.immediate } }
  }
  for(const c of out){
    const sib=out.filter(o=>o!==c&&o.type!==c.type);
    c.sameWindow=sib.filter(o=>{ const a=c.window||[c.at,c.at],b=o.window||[o.at,o.at];
      return (c.prec==='6h'&&o.prec==='min'&&o.at>a[0]&&o.at<=a[1])||(o.prec==='6h'&&c.prec==='min'&&c.at>b[0]&&c.at<=b[1])||!!(c.window&&o.window&&c.window[1]===o.window[1]) }).map(o=>o.id);
    c.within48h=sib.filter(o=>Math.abs(o.mid-c.mid)<RULES.effect.simultHours*H).map(o=>o.id);
  }
  /* R121: por vídeo e campo, corrida máxima de 2 ou mais trocas consecutivas com intervalo de até 14 dias cada.
     Decisão do controlador (rodada 2): n = TROCAS da corrida (não versões); pos = posição desta troca na corrida;
     só thumbnail e título formam sequência (descrição fica com testRun = null).
     from/to = primeira e última troca; open = a última troca tem até 14 dias (outra troca ainda entraria na corrida). */
  out.filter(c=>c.type==='desc').forEach(c=>c.testRun=null);
  for(const type of ['title','thumb']){
    const list=out.filter(c=>c.type===type).sort((a,b)=>a.at-b.at); let run=[], k=0;
    const close=()=>{ if(run.length>=2){ k++; const from=run[0].at,to=run[run.length-1].at; run.forEach((c,j)=>c.testRun={id:v.id+'/'+type+'/seq'+k,n:run.length,pos:j+1,from,to,open:NOW-to<=RULES.testRunGapDays*DAY}) } else run.forEach(c=>c.testRun=null); run=[] };
    for(const c of list){ if(run.length&&c.at-run[run.length-1].at>RULES.testRunGapDays*DAY) close(); run.push(c) }
    close();
  }
  out.sort((a,b)=>a.at-b.at);
  out.forEach((c,i)=>{ c.seq=i+1; CHG.set(c.id,c) });
  v.changes=out;
}

/* ---------------- média de views/dia de um período (series.ts periodRate) ---------------- */
const intervals=v=>v.series.slice(1).map((p,j)=>({a:v.series[j].t,b:p.t,vpd:p.views-v.series[j].views}));
function overlap(v,from,to){ let s=0,w=0,shared=false; for(const x of intervals(v)){ const o=Math.min(to,x.b)-Math.max(from,x.a); if(o>0){ s+=x.vpd*o; w+=o; if(o<x.b-x.a-1) shared=true } } return {s,w,shared} }
function periodRate(videoId,from,to){
  const v=V.get(videoId);
  if(to-from<DAY) return {vpd:null,text:'menos de 1 dia no ar, sem média'};
  const {s,w,shared}=overlap(v,from,to);
  if(w<DAY) return {vpd:null,text:'sem registro diário no período'};
  const first=v.series[0].t, onlySince=from<first?Math.round(w/DAY):null;                        // series.ts:106
  return {vpd:s/w,shared,text:'≈ '+F.num(s/w)+(onlySince?' (só desde '+D.dm(first)+', '+onlySince+' dias)':shared?' (inclui dia compartilhado)':'')};
}

/* ---------------- versões como a tela mostra (view-model.ts versionsOf) ---------------- */
function versions(videoId,type){
  const v=V.get(videoId), arr=arrOf(v,type), o=FEM[type]?'a':'o';
  const seen=new Set();
  return arr.map((x,i)=>{
    const nx=arr[i+1];
    const startLbl=i===0?D.dmhm(v.pub)+' (publicação)':x.prec==='min'?D.dmhm(x.first_seen):'vist'+o+' pela 1ª vez '+D.dm(x.first_seen)+' '+D.hh(x.first_seen);
    const sLo=x.window?x.window[0]:x.first_seen, sHi=x.first_seen, dMin=x.endLo-sHi, dMax=x.endHi-sLo;
    const end=nx?(nx.window?'trocad'+o+' '+D.windowText(nx.window[0],nx.window[1]):D.dmhm(nx.first_seen)):'agora';
    const span=/^trocad[ao] /.test(end)?startLbl+'; '+end:startLbl+' até '+end;
    const reverted=type==='thumb'&&seen.has(x.key); if(type==='thumb') seen.add(x.key);
    return {id:x.id,type,i,label:x.label,key:x.key,text:x.text,lines:x.lines,start:x.first_seen,winStart:sLo,endLo:x.endLo,endHi:x.endHi,window:x.window,cur:!nx,reverted,
      span,dur:dMax-dMin<H?du(dMax):du(Math.max(0,dMin))+' a '+du(dMax),durMs:x.endLo-x.first_seen,rate:periodRate(videoId,x.first_seen,x.endLo).text,
      aria:TYPE_LABEL[type]+' '+x.label+': '+span,tag:!nx?{kind:'now',text:'no ar'}:reverted?{kind:'ret',text:'voltou'}:null};
  });
}

/* ---------------- Fase 4, item 1: resumo por imagem ----------------
   Uma linha por imagem distinta. Dentro de [from, to] (o filtro de período): passagens = períodos da imagem que tocam
   o intervalo; tempo = soma do tempo no ar dentro do intervalo; média = views ganhas nesse tempo, ponderadas pelo
   tempo de cada registro diário (a mesma conta de periodRate, somando as passagens). */
function imageSummary(videoId,from,to){
  const v=V.get(videoId), f=from==null?v.pub:Math.max(from,v.pub), t=to==null?NOW:to, rows=new Map();
  versions(videoId,'thumb').forEach(p=>{
    const a=Math.max(p.start,f), b=Math.min(p.endLo,t); if(b<=a) return;
    if(!rows.has(p.label)) rows.set(p.label,{label:p.label,key:p.key,passes:0,ms:0,s:0,w:0,cur:false,segs:[],longest:0});
    const r=rows.get(p.label), o=p.endLo-p.start>=DAY?overlap(v,a,b):{s:0,w:0};   /* a média só soma passagens de 1 dia ou mais (as que têm média no cartão) */ r.passes++; r.ms+=b-a; r.s+=o.s; r.w+=o.w; r.cur=r.cur||p.cur; r.segs.push([a,b]); r.longest=Math.max(r.longest,p.endLo-p.start);
  });
  const list=[...rows.values()].sort((a,b)=>a.label<b.label?-1:1);
  /* tempo em décimos de dia. Os décimos são distribuídos pelo maior resto para a coluna somar exatamente o total
     mostrado (cada linha fica a menos de 0,1 d = 2 h 24 min do valor exato). */
  const totalMs=list.reduce((s,r)=>s+r.ms,0), totalT=Math.round(totalMs/DAY*10);
  list.forEach(r=>{ r.tenths=Math.floor(r.ms/DAY*10); r.rem=r.ms/DAY*10-r.tenths });
  let left=totalT-list.reduce((s,r)=>s+r.tenths,0);
  [...list].sort((a,b)=>b.rem-a.rem).forEach(r=>{ if(left>0){ r.tenths++; left-- } });
  const tText=t=>t===0?'menos de 0,1 d':'≈ '+(t/10).toFixed(1).replace('.',',')+' d';
  /* média: a regra de periodRate vale por passagem. Só entram na média as passagens de 1 dia ou mais; imagem sem
     nenhuma fica sem média (decisão do controlador): com um registro de views por dia, o número de uma passagem
     curta seria o dos dias dos vizinhos. */
  const out=list.map(r=>({...r, durText:tText(r.tenths), vpd:r.longest>=DAY&&r.w>=DAY?r.s/r.w:null,
    rateText:r.longest<DAY?(r.passes===1?'menos de 1 dia no ar, sem média':'menos de 1 dia em cada passagem, sem média'):r.w<DAY?'sem registro diário no período':'≈ '+F.num(r.s/r.w)}));
  const tot=overlap(v,f,t);
  out.total={passes:out.reduce((s,r)=>s+r.passes,0),ms:totalMs,tenths:totalT,durText:tText(totalT),images:out.length,rateText:tot.w>=DAY?'≈ '+F.num(tot.s/tot.w):'sem registro diário no período'};
  return out;
}

/* ---------------- sequências de teste por campo (R121) ---------------- */
function runs(videoId,type,unknown){
  if(unknown) return [];                                             // testRun ausente = desconhecido: nada é afirmado
  const seen=new Map();
  for(const c of V.get(videoId).changes){ if(c.type===type&&c.testRun&&!seen.has(c.testRun.id)) seen.set(c.testRun.id,c.testRun) }
  return [...seen.values()];
}
const runDays=r=>Math.max(1,Math.round((r.to-r.from)/DAY));
/** "5 trocas em 9 dias" */
const runCore=r=>F.plural(r.n,'troca','trocas')+' em '+F.plural(runDays(r),'dia','dias');
/** texto da nota e da faixa: "trocas em sequência: 5 trocas em 9 dias, ainda aberta" | "..., encerrada em DD/MM" */
const runText=r=>'trocas em sequência: '+runCore(r)+(r.open?', ainda aberta':', encerrada em '+D.dm(r.to));
/** texto curto da faixa quando o inteiro não cabe */
const runShort=r=>r.n+' trocas em sequência';
/** texto do cartão de Mudanças */
const runCardText=r=>'parte de '+r.n+' trocas em sequência em '+F.plural(runDays(r),'dia','dias');
/** a ressalva que acompanha o rótulo: o dado mostra ritmo, não intenção */
const RUN_CAVEAT='Pode ser um teste; o YouTube não informa.';

/* ---------------- efeito de uma troca (effect.ts, com R115 e R116) ---------------- */
const EFF=new Map();
function effect(id){
  if(EFF.has(id)) return EFF.get(id);
  const c=CHG.get(id), v=V.get(c.video), ch=CH.get(v.ch), res={id,type:c.type};
  const done=x=>{ Object.assign(res,x); EFF.set(id,res); return res };
  /* rodada 3: a contagem diária deste canal começa em 03/10 (e só existe para os 50 vídeos acompanhados). Troca sem série ou anterior ao primeiro registro: "sem série". */
  if(!v.series.length) return done({status:'sem-serie',label:'sem série',reason:'este vídeo está fora dos '+ch.video_limit+' acompanhados do canal: não há contagem diária para comparar.'});
  if(c.at<=v.series[0].t) return done({status:'sem-serie',label:'sem série',reason:'a contagem diária começa em '+D.dm(v.series[0].t)+', depois desta troca: não há dias antes para comparar.'});
  const k=D.gi(c.at), L=v.lastIdx, E=RULES.effect;
  const seriesBefore=Math.max(0,Math.min(E.maxBeforeDays,(k-1)-v.firstIdx)), afterDays=Math.max(0,Math.min(7,L-k));
  const wdR=D.weekday(D.snap(k+7)), readyIf='leitura '+(/^(segunda|terça|quarta|quinta|sexta)/.test(wdR)?'na ':'no ')+wdR+', '+D.dm(D.snap(k+7));
  const kOfNext=o=>D.gi(o.window?o.window[0]:o.at);
  const sibs=v.changes.filter(o=>o!==c);
  const nextCh=sibs.filter(o=>o.at>c.at).sort((a,b)=>kOfNext(a)-kOfNext(b))[0]||null;
  const nextTxt=nextCh&&kOfNext(nextCh)<=k+7?'O vídeo foi trocado de novo dentro dos 7 dias depois ('+nextCh.typeLabel+' mudou '+(nextCh.prec==='min'?'em ':'')+nextCh.whenText+'): a leitura mistura duas versões.':null;
  const nextShort=nextTxt?'o vídeo foi trocado de novo dentro dos 7 dias depois':null;
  const simul=c.sameWindow.length?'same':c.within48h.length?'48h':null;
  const verNow=c.to, /* effect.ts:135-136 */ shortNew=!verNow.current&&verNow.last_seen-verNow.first_seen<DAY, shortPrev=c.prevLivedMs!=null&&c.prevLivedMs<DAY;
  const prevCh=sibs.filter(o=>o.at<c.at).sort((a,b)=>b.at-a.at)[0]||null;
  const cleanBefore=prevCh?Math.max(0,(k-1)-D.gi(prevCh.at)):null;
  const cutByPrev=cleanBefore!=null&&cleanBefore<seriesBefore;
  const prevOnly=!!prevCh&&cutByPrev&&cleanBefore<E.minBeforeDays&&!simul&&!nextTxt&&!(shortNew||shortPrev);
  const beforeDays=cutByPrev&&(cleanBefore>=E.minBeforeDays||prevOnly)?cleanBefore:seriesBefore;
  const prevTxt=prevOnly?'Dias entre a troca anterior do vídeo ('+prevCh.typeLabel+') e esta: '+cleanBefore+'. Pouco para comparar.':null;
  const prevShort=prevTxt?'outra troca do vídeo poucos dias antes desta':null;
  Object.assign(res,{k,beforeDays,afterDays,readyOn:D.snap(k+7),nextChange:nextTxt?nextCh.id:null});
  const simulTxt=simul==='same'?'Dois campos do mesmo vídeo mudaram na mesma janela de sincronização: o efeito é dos dois e não dá para separar.':simul==='48h'?'Outro campo do mesmo vídeo mudou a menos de 48 h: não dá para separar o efeito de cada um.':null;
  if(seriesBefore===0) return done({status:'sem-antes',label:'sem base',reason:'Só há o primeiro registro diário ('+D.dm(v.series[0].t)+') antes desta troca: sem dias antes para comparar.'});
  if(afterDays<7){
    const shortWhy=simul==='same'?'dois campos do vídeo mudaram na mesma janela de sincronização':simul==='48h'?'outro campo do vídeo mudou a menos de 48 h':nextShort||prevShort||(beforeDays<=2?'só '+F.plural(beforeDays,'dia','dias')+' antes da troca':null);
    return done({status:'aguardando',label:'aguardando',collected:afterDays,willBeInconclusive:!!shortWhy,
      reason:'aguardando — '+afterDays+' de 7 dias coletados, leitura em '+D.dm(D.snap(k+7)),
      waitText:'Aguardando: '+afterDays+' de 7 dias coletados, '+readyIf+'.'+(shortWhy?' Vai sair inconclusivo: '+shortWhy+'.':'')});
  }
  if(prevTxt) return done({kind:'antes-curto',status:'inconclusivo',label:'inconclusivo',reason:prevTxt});
  const v0=viewsAt(v,k-1-beforeDays), v1=viewsAt(v,k-1), v2=viewsAt(v,k), v3=viewsAt(v,k+7);
  if(v0==null||v1==null||v2==null||v3==null) return done({status:'inconclusivo',kind:'outro',label:'inconclusivo',reason:'Faltam registros diários em volta da troca: não dá para medir.'});
  const rb=(v1-v0)/beforeDays, ra=(v3-v2)/7, r=ra/rb-1;
  const band=bandOf(Math.floor((D.snap(k)-v.pub)/DAY)), rs=ch.peers[band.label]||[], n=rs.length, exp=median(rs), q1=quant(rs,.25), q3=quant(rs,.75);
  const eff=exp==null?null:(r-exp)*100;
  Object.assign(res,{observed:r,beforeAvg:rb,afterAvg:ra,expected:exp,iqr:[q1,q3],n,effectPp:eff,band:band.label,method:'aproximação por faixa',
    noBaseText:n===0?'sem base de comparação: nenhum outro vídeo do canal na faixa '+band.label+' (n = 0)':null,
    numbers:'observado '+F.pct(r)+' · esperado '+F.pct(exp)+' (n = '+n+')',numbersFlat:'observado '+F.pct(r)+' · esperado '+F.pct(exp)+' · n = '+n});
  if(shortNew) return done({kind:'versao-curta',status:'inconclusivo',label:'inconclusivo',reason:'A nova versão ficou menos de 1 dia no ar ('+D.dur(verNow.last_seen-verNow.first_seen)+'): com um registro de views por dia não dá para isolar.'});
  if(shortPrev) return done({kind:'versao-curta',status:'inconclusivo',label:'inconclusivo',reason:'A versão anterior ficou menos de 1 dia no ar ('+D.dur(c.prevLivedMs)+'): pouco para comparar.'});
  if(simulTxt) return done({kind:'janela-dupla',status:'inconclusivo',label:'inconclusivo',reason:simulTxt});
  if(nextTxt) return done({kind:'troca-seguinte',status:'inconclusivo',label:'inconclusivo',reason:nextTxt});
  if(beforeDays<=2) return done({kind:'antes-curto',status:'inconclusivo',label:'inconclusivo',reason:'Antes: '+beforeDays+(beforeDays===1?' dia':' dias')+' — pouco para comparar.'});
  if(n<E.minN||eff==null) return done({kind:'outro',status:'inconclusivo',label:'inconclusivo',reason:'Poucos vídeos do canal para comparar (n = '+n+', mínimo '+E.minN+').'});
  const out=r<q1||r>q3, band_='('+F.pct(q1)+' a '+F.pct(q3)+')';
  if(eff>E.pp&&out) return done({status:'ganhou',label:'ganhou',reason:'Efeito '+F.pp(eff)+': acima de +10 pp e fora da faixa normal '+band_+'.'});
  if(eff<-E.pp&&out) return done({status:'perdeu',label:'perdeu',reason:'Efeito '+F.pp(eff)+': abaixo de −10 pp e fora da faixa normal '+band_+'.'});
  const small=Math.abs(eff)<E.pp;
  return done({status:'neutro',label:'neutro',reason:'Efeito '+F.pp(eff)+': '+(small&&!out?'abaixo de 10 pp e dentro da faixa normal '+band_:small?'fora da faixa normal '+band_+', mas abaixo de 10 pp':'acima de 10 pp, mas dentro da faixa normal '+band_)+'.'});
}
/** motivo curto de um inconclusivo, para a linha da lista (mesmos cinco tipos do balanço de Mudanças) */
const KIND_SHORT={'troca-seguinte':'outra troca nos 7 dias depois','janela-dupla':'dois campos em menos de 48 h','versao-curta':'versão com menos de 1 dia no ar','antes-curto':'antes curto demais','outro':'outro motivo'};
const STATUS_WORD={ganhou:'ganhou',perdeu:'perdeu',neutro:'neutro',inconclusivo:'inconclusivo',aguardando:'aguardando','sem-antes':'sem base','sem-serie':'sem série'};
function statusLine(e){ return e.status==='inconclusivo'?'inconclusivo: '+KIND_SHORT[e.kind]:e.status==='aguardando'?'aguardando ('+e.collected+' de 7 dias)':STATUS_WORD[e.status] }

/* ---------------- multiplicador do cabeçalho: views ÷ mediana de views dos OUTROS vídeos do canal, do mesmo formato e da mesma faixa de idade (aproximação por faixa) ---------------- */
function mult(videoId){
  const v=V.get(videoId), raw=v.raw;
  if(raw.views==null) return {text:'sem multiplicador: sem contagem de views'};
  if(v.pinAntigo) return {text:'sem multiplicador: fixado antigo, contagem de views antiga'};
  if(v.fmt==='nc') return {text:'sem multiplicador: formato não confirmado'};
  if(v.pubMissing) return {text:'sem multiplicador: sem data de publicação'};
  const band=bandOf(v.ageDays), peers=[...V.values()].filter(x=>x!==v&&x.fmt===v.fmt&&x.raw.views!=null&&!x.pinAntigo&&!x.pubMissing&&bandOf(x.ageDays)===band).map(x=>x.raw.views);
  if(!peers.length) return {text:'sem multiplicador: sem outros vídeos do canal na faixa '+band.label};
  const m=median(peers); if(!m) return {text:'sem multiplicador: mediana da faixa é zero'};
  return {value:raw.views/m,band:band.label,n:peers.length,med:m,text:F.mult(raw.views/m)+' vs vídeos '+(v.fmt==='short'?'Shorts ':'')+'do canal com '+band.label+' (n = '+peers.length+')'+(peers.length<3?' — base fraca':'')+', método: aproximação por faixa'};
}

/* thumbnails: só a imagem atual existe (a do YouTube). As anteriores nunca foram arquivadas: a tela mostra o quadro "imagem anterior não arquivada". */
const archived=(videoId,key)=>{ const v=V.get(videoId); return key===v.thumbs[v.thumbs.length-1].key };
const thumbSrc=(videoId,key)=>V.get(videoId).raw.thumb;

/* nenhuma conferência cruzada de números aqui: o motor é o mesmo do mockup aprovado; os dados vêm de dados.js. */
for(const v of V.values()) deriveChanges(v);
const allChanges=()=>[...V.values()].flatMap(v=>v.changes);

window.HM={NOW,LAST_SYNC,H,DAY,RULES,date:D,fmt:F,du,TYPE_LABEL,TYPE_NAME,FEM,
  videos:[...V.values()],video:id=>V.get(id),channel:id=>CH.get(id),change:id=>CHG.get(id),
  versions,periodRate,imageSummary,runs,runText,runCore,runShort,runCardText,RUN_CAVEAT,runDays,SYNC_CADENCE:'de 6 h a 24 h neste canal',effect,statusLine,KIND_SHORT,STATUS_WORD,mult,thumbSrc,archived,allChanges};
})();
