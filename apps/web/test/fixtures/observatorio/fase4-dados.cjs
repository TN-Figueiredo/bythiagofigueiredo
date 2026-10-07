/* dados.js: o mundo do mockup da Fase 4 (histórico com muitas versões) e o motor que deriva TODOS os números da tela.
   Nada do que aparece na tela é digitado: versões, durações, médias, contagens, vereditos e sequências saem daqui.
   Regras do motor: as mesmas de apps/web/src/lib/youtube/observatorio (effect.ts com R115/R116, series.ts periodRate,
   changes.ts) mais as duas da Fase 4: resumo por imagem e trocas em sequência (R121).
   Simplificações declaradas no LEIAME: a base de pares é uma lista de razões por faixa de idade (o motor real mede os
   pares com o mesmo número de dias "antes"); não há curva "esperado pela idade".
   window.HM = motor desta entrega. window.OBS = só o que chrome.js precisa para desenhar a moldura. */
(function(){
'use strict';
const H=3600e3, DAY=24*H, MINUS='−';
const sp=(y,mo,d,h,mi)=>Date.UTC(y,mo-1,d,(h||0)+3,mi||0);            // São Paulo = UTC−3, sem horário de verão
const NOW=sp(2026,12,12,15,2);                                         // sábado, 12/12/2026 15:02
const LAST_SYNC=sp(2026,12,12,12,0), NEXT_SYNC=sp(2026,12,12,18,0);
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

/* ---------------- canais (fictícios) ----------------
   peers = razões depois/antes (7 dias contra 7 dias) dos outros vídeos longos do canal, sem troca, por faixa de idade.
   peerViews = views dos outros vídeos longos do canal na faixa (base do multiplicador). */
const okSync={state:'ok',label:'em dia',last:LAST_SYNC};
const CHANNELS=[
  {id:'rota-barata',name:'Rota Barata',niche:'viagem',ini:'RB',color:'#0E7490',video_limit:50,sync:okSync,
    peers:{'0–7 dias':[-.52,-.47,-.44,-.41,-.38,-.36,-.31],'8–30 dias':[-.34,-.31,-.29,-.27,-.26,-.24,-.22,-.19,-.15],'31–90 dias':[-.21,-.18,-.16,-.15,-.13,-.12,-.10,-.08,-.06,-.02,.03]},
    peerViews:{'8–30 dias':[61000,74500,88200,97400,112000,131500],'31–90 dias':[212000,268000,301500,344000,372500,418000,455000,497000,563000,640000,811000]}},
  {id:'mochila-mapa',name:'Mochila & Mapa',niche:'viagem',ini:'MM',color:'#7A4B12',video_limit:50,sync:okSync,
    peers:{'0–7 dias':[-.49,-.45,-.40,-.37,-.33,-.30],'8–30 dias':[-.36,-.30,-.28,-.25,-.23,-.21,-.17,-.12]},
    peerViews:{'8–30 dias':[38200,45100,52600,58900,66300,71800,90400]}},
  {id:'prompt-diario',name:'Prompt Diário',niche:'ia',ini:'PD',color:'#3B2F8F',video_limit:50,sync:okSync,
    peers:{'0–7 dias':[-.58,-.51,-.46,-.43,-.40,-.35,-.29],'8–30 dias':[-.33,-.28,-.26,-.22,-.19,-.14]},
    peerViews:{'8–30 dias':[84000,102500,119000,137200,151000,176400,203000,241500]}},
  {id:'lab-do-opus',name:'Lab do Opus',niche:'ia',ini:'LO',color:'#1F5F3A',video_limit:50,sync:okSync,
    peers:{'0–7 dias':[-.55,-.50,-.42,-.39,-.36,-.28],'8–30 dias':[-.37,-.32,-.27,-.24,-.20,-.18,-.11]},
    peerViews:{'8–30 dias':[29500,36800,41200,47700,55000,62300]}},
];
const NICHES={viagem:{id:'viagem',label:'Viagem',color:{dark:'#5BBF8A',light:'#11692F'}},ia:{id:'ia',label:'IA',color:{dark:'#6EA8FE',light:'#1D4ED8'}}};

/* ---------------- vídeos: só o que foi OBSERVADO (publicação, cada troca vista, parâmetros da série) ----------------
   thumbs: [letra, quando (minuto exato)]. titles/descs: [texto|linhas, 1ª sincronização que viu (janela de 6 h antes)]. */
const DESC_BASE=['Roteiro completo com preços de dezembro de 2026.','Planilha de custos: https://rotabarata.example/planilha','Seguro viagem que eu uso: https://rotabarata.example/seguro','Inscreva-se para os próximos roteiros.'];
const RAW=[
  { id:'mm-lisboa', ch:'mochila-mapa', pub:sp(2026,11,21,10,0), dur:'16:08',
    series:{seed:11,base:9400,tau:8,floor:.24,first:1250,bumps:[]},
    thumbs:[['A'],['B',sp(2026,11,28,9,40)]],
    titles:[['Lisboa em 3 dias gastando pouco: roteiro completo'],['3 dias em Lisboa por menos de 150 euros (roteiro completo)',sp(2026,12,8,12,0)]],
    descs:[[['Roteiro de 3 dias em Lisboa com preços de novembro de 2026.','Mapa do roteiro: https://mochilaemapa.example/lisboa','Inscreva-se para os próximos roteiros.']]],
    art:{A:{bg:'#12506B',fg:'#F2B544',ink:'#FFFFFF',text:'LISBOA 3 DIAS'},B:{bg:'#7A1F2B',fg:'#F5E6C8',ink:'#FFFFFF',text:'150 EUROS'}} },

  { id:'rb-passagem', ch:'rota-barata', pub:sp(2026,10,13,11,0), dur:'18:42',
    series:{seed:7,base:52000,tau:13,floor:.20,first:3900,bumps:[{from:sp(2026,11,12,12,0),k:.34,tau:9}]},
    thumbs:[['A'],
      ['B',sp(2026,10,15,9,14)],['A',sp(2026,10,16,18,40)],['C',sp(2026,10,18,10,5)],['A',sp(2026,10,18,21,30)],
      ['B',sp(2026,10,20,8,12)],['C',sp(2026,10,22,14,47)],['D',sp(2026,10,24,9,3)],['A',sp(2026,10,26,19,20)],
      ['D',sp(2026,10,28,11,36)],['B',sp(2026,10,30,16,8)],['D',sp(2026,11,2,9,51)],['A',sp(2026,11,4,13,22)],
      ['E',sp(2026,11,20,10,17)],['C',sp(2026,11,22,15,44)],['E',sp(2026,11,23,9,30)],['B',sp(2026,11,25,12,58)],
      ['E',sp(2026,11,27,8,26)],['D',sp(2026,11,29,17,11)],['E',sp(2026,12,1,10,42)],['C',sp(2026,12,3,14,9)],
      ['E',sp(2026,12,5,9,37)],['D',sp(2026,12,8,11,53)],['E',sp(2026,12,10,16,25)]],
    titles:[['Como achar passagem aérea barata em 2026'],
      ['Como achar passagem aérea barata em 2026 (o método que eu uso)',sp(2026,10,14,18,0)],
      ['Passagem aérea barata: o método que eu uso em 2026',sp(2026,10,17,12,0)],
      ['Passagem aérea barata: 7 erros que deixam o voo mais caro',sp(2026,10,21,6,0)],
      ['7 erros que deixam a sua passagem aérea mais cara',sp(2026,10,27,12,0)],
      ['Paguei R$ 890 para a Europa: 7 erros que deixam a passagem cara',sp(2026,11,12,12,0)],
      ['Paguei R$ 890 para a Europa (e os 7 erros que encarecem o voo)',sp(2026,11,28,18,0)],
      ['Europa por R$ 890: os 7 erros que encarecem a passagem',sp(2026,12,2,12,0)],
      ['Europa por R$ 890: pare de cometer estes 7 erros na passagem',sp(2026,12,7,18,0)]],
    descs:[[['Como eu procuro passagem aérea barata em 2026.','Buscador que eu uso: https://rotabarata.example/buscador','Seguro viagem que eu uso: https://rotabarata.example/seguro','Inscreva-se para os próximos roteiros.']],
      [['Como eu procuro passagem aérea barata em 2026.','00:00 O método','04:10 Os 7 erros','15:30 Quanto eu paguei','Buscador que eu uso: https://rotabarata.example/buscador','Seguro viagem que eu uso: https://rotabarata.example/seguro','Inscreva-se para os próximos roteiros.'],sp(2026,10,21,6,0)],
      [['Paguei R$ 890 para a Europa. Os 7 erros que encarecem a passagem.','00:00 O método','04:10 Os 7 erros','15:30 Quanto eu paguei','Buscador que eu uso: https://rotabarata.example/buscador?utm_source=youtube&utm_campaign=dez','Seguro viagem que eu uso: https://rotabarata.example/seguro','Inscreva-se para os próximos roteiros.'],sp(2026,12,2,18,0)]],
    art:{A:{bg:'#0E4C6A',fg:'#F2B544',ink:'#FFFFFF',text:'PASSAGEM BARATA'},B:{bg:'#7A1F2B',fg:'#F5E6C8',ink:'#FFFFFF',text:'R$ 890'},
      C:{bg:'#1F5F3A',fg:'#F29F3D',ink:'#FFFFFF',text:'7 ERROS'},D:{bg:'#2B2A6B',fg:'#7FD1E8',ink:'#FFFFFF',text:'EUROPA'},E:{bg:'#4A3A12',fg:'#F4D35E',ink:'#FFFFFF',text:'NÃO COMPRE'}} },

  { id:'pd-agentes', ch:'prompt-diario', pub:sp(2026,12,1,9,0), dur:'22:15',
    series:{seed:23,base:41000,tau:5,floor:.18,first:5200,bumps:[]},
    thumbs:[['A'],
      ['B',sp(2026,12,2,8,10)],['A',sp(2026,12,2,12,40)],['C',sp(2026,12,2,18,20)],['A',sp(2026,12,3,0,30)],
      ['B',sp(2026,12,3,10,30)],['C',sp(2026,12,4,9,15)],['B',sp(2026,12,4,13,40)],['D',sp(2026,12,4,18,22)],
      ['A',sp(2026,12,5,20,10)],['D',sp(2026,12,6,8,48)],['A',sp(2026,12,6,12,31)],['C',sp(2026,12,7,16,2)],
      ['D',sp(2026,12,8,9,27)],['B',sp(2026,12,9,11,14)],['D',sp(2026,12,9,14,50)],['A',sp(2026,12,11,10,6)]],
    titles:[['Montei um time de agentes de IA para trabalhar por mim'],
      ['Montei um time de agentes de IA (e deixei trabalhando a noite toda)',sp(2026,12,2,12,0)],
      ['Deixei agentes de IA trabalhando a noite toda. Olha o resultado',sp(2026,12,2,18,0)],
      ['Agentes de IA trabalharam a noite toda: o que deu certo e o que quebrou',sp(2026,12,3,12,0)],
      ['Agentes de IA a noite toda: o que deu certo e o que quebrou',sp(2026,12,4,12,0)],
      ['8 horas de agentes de IA sem supervisão: o que quebrou',sp(2026,12,5,0,0)],
      ['8 horas de agentes de IA sem supervisão (teste completo)',sp(2026,12,6,12,0)],
      ['Teste completo: 8 horas de agentes de IA sem supervisão',sp(2026,12,7,18,0)],
      ['Agentes de IA sem supervisão por 8 horas: vale a pena?',sp(2026,12,8,12,0)],
      ['Agentes de IA sozinhos por 8 horas: vale a pena?',sp(2026,12,9,18,0)],
      ['Deixei agentes de IA sozinhos por 8 horas. Vale a pena?',sp(2026,12,11,12,0)]],
    descs:[[['Teste de 8 horas com um time de agentes de IA.','Código do teste: https://promptdiario.example/agentes','Inscreva-se para os próximos testes.']],
      [['Teste de 8 horas com um time de agentes de IA.','00:00 A ideia','03:20 A configuração','Código do teste: https://promptdiario.example/agentes','Inscreva-se para os próximos testes.'],sp(2026,12,2,18,0)],
      [['Teste de 8 horas com um time de agentes de IA.','00:00 A ideia','03:20 A configuração','11:45 O que quebrou','Código do teste: https://promptdiario.example/agentes','Inscreva-se para os próximos testes.'],sp(2026,12,5,12,0)],
      [['Teste de 8 horas com um time de agentes de IA.','00:00 A ideia','03:20 A configuração','11:45 O que quebrou','19:10 Vale a pena?','Código do teste: https://promptdiario.example/agentes','Inscreva-se para os próximos testes.'],sp(2026,12,8,0,0)],
      [['Teste de 8 horas com um time de agentes de IA. Resultado no fim.','00:00 A ideia','03:20 A configuração','11:45 O que quebrou','19:10 Vale a pena?','Código do teste: https://promptdiario.example/agentes','Inscreva-se para os próximos testes.'],sp(2026,12,10,12,0)]],
    art:{A:{bg:'#3B2F8F',fg:'#F2C14E',ink:'#FFFFFF',text:'TIME DE IA'},B:{bg:'#0F5257',fg:'#F6E7CB',ink:'#FFFFFF',text:'8 HORAS'},
      C:{bg:'#6B1D3A',fg:'#8EE3C8',ink:'#FFFFFF',text:'QUEBROU'},D:{bg:'#263238',fg:'#FF8A5B',ink:'#FFFFFF',text:'VALE A PENA?'}} },

  { id:'lo-roteiro', ch:'lab-do-opus', pub:sp(2026,11,25,10,0), dur:'12:37',
    series:{seed:31,base:7800,tau:7,floor:.26,first:900,bumps:[]},
    thumbs:[['A'],['B',sp(2026,11,30,9,20)],['C',sp(2026,12,2,14,5)],['A',sp(2026,12,4,10,40)],['D',sp(2026,12,6,18,15)],['B',sp(2026,12,9,10,20)]],
    titles:[['Pedi um roteiro de vídeo ao Opus 5.5 e gravei sem mexer'],['Gravei um vídeo com roteiro 100% do Opus 5.5',sp(2026,12,3,12,0)]],
    descs:[[['Roteiro escrito pelo Opus 5.5, gravado sem edição.','O pedido que eu fiz: https://labdoopus.example/roteiro','Inscreva-se para os próximos testes.']]],
    art:{A:{bg:'#1F5F3A',fg:'#F2B544',ink:'#FFFFFF',text:'ROTEIRO DE IA'},B:{bg:'#5A1E6B',fg:'#F5E6C8',ink:'#FFFFFF',text:'SEM MEXER'},
      C:{bg:'#0E4C6A',fg:'#FF8A5B',ink:'#FFFFFF',text:'100% OPUS'},D:{bg:'#3A3A3A',fg:'#8EE3C8',ink:'#FFFFFF',text:'DEU CERTO?'}} },

  { id:'rb-mala', ch:'rota-barata', pub:sp(2026,10,28,9,0), dur:'14:20',
    series:{seed:43,base:21000,tau:10,floor:.22,first:2100,bumps:[]},
    thumbs:[['A'],['B',sp(2026,11,2,10,10)],['A',sp(2026,11,4,16,30)],['C',sp(2026,11,6,9,45)],['B',sp(2026,11,9,13,0)],['D',sp(2026,11,11,11,25)]],
    titles:[['Mala de mão para 15 dias na Europa: o que eu levo']],
    descs:[[DESC_BASE]],
    art:{A:{bg:'#2B2A6B',fg:'#F2B544',ink:'#FFFFFF',text:'MALA DE MÃO'},B:{bg:'#7A1F2B',fg:'#7FD1E8',ink:'#FFFFFF',text:'15 DIAS'},
      C:{bg:'#1F5F3A',fg:'#F5E6C8',ink:'#FFFFFF',text:'SÓ 8 KG'},D:{bg:'#4A3A12',fg:'#FF8A5B',ink:'#FFFFFF',text:'NÃO DESPACHE'}} },
];

/* ---------------- série diária: gerada uma vez, deterministicamente, a partir dos parâmetros do vídeo ---------------- */
function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296 } }
function makeSeries(v){
  const s=v.series, r=rng(s.seed), pts=[], first=D.gi(v.pub), last=D.gi(LAST_SYNC);
  let views=s.first;
  for(let i=first;i<=last;i++){
    if(i>first){
      const j=i-first-1, t=D.snap(i-1), dow=parts(t).dow, wk=(dow===0||dow===6)?1.10:1;
      let lvl=s.floor+(1-s.floor)*Math.exp(-j/s.tau);
      for(const b of s.bumps){ if(t>=b.from) lvl*=1+b.k*Math.exp(-((t-b.from)/DAY)/b.tau) }
      views+=Math.round(s.base*lvl*wk*(0.92+0.16*r()));
    }
    pts.push({i,t:D.snap(i),views});
  }
  return pts;
}

/* ---------------- montagem: versões, trocas, sequências ---------------- */
const V=new Map(), CH=new Map(CHANNELS.map(c=>[c.id,c]));
for(const raw of RAW){
  const v={id:raw.id,ch:raw.ch,pub:raw.pub,dur:raw.dur,fmt:'long',art:raw.art,niche:CH.get(raw.ch).niche,url:'https://www.youtube.com/watch?v=mockup-'+raw.id};
  const mk=(type,arr)=>arr.map((x,i)=>{
    const at=i===0?raw.pub:x[1];
    return {id:v.id+'/'+type+'/v'+i,type,i,first_seen:at,prec:i===0?'publicacao':type==='thumb'?'min':'6h',window:i>0&&type!=='thumb'?[at-6*H,at]:null,
      key:type==='thumb'?x[0]:null,text:type==='title'?x[0]:null,lines:type==='desc'?x[0]:null};
  });
  v.thumbs=mk('thumb',raw.thumbs); v.titles=mk('title',raw.titles); v.descs=mk('desc',raw.descs);
  const letters=new Map(); v.thumbs.forEach(t=>{ if(!letters.has(t.key)) letters.set(t.key,String.fromCharCode(65+letters.size)) });
  v.thumbs.forEach(t=>t.label=letters.get(t.key)); v.titles.forEach((t,i)=>t.label='T'+(i+1)); v.descs.forEach((t,i)=>t.label='D'+(i+1));
  for(const arr of [v.thumbs,v.titles,v.descs]) arr.forEach((x,i)=>{ const nx=arr[i+1]; x.current=!nx; x.endLo=nx?(nx.window?nx.window[0]:nx.first_seen):NOW; x.endHi=nx?nx.first_seen:NOW; x.last_seen=x.endLo });
  v.title=v.titles[v.titles.length-1].text;
  v.series=makeSeries(raw); v.firstIdx=v.series[0].i; v.lastIdx=v.series[v.series.length-1].i;
  v.views=v.series[v.series.length-1].views; v.ageDays=Math.floor((NOW-v.pub)/DAY);
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
for(const v of V.values()) deriveChanges(v);

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
  if(seriesBefore===0) return done({status:'sem-antes',label:'sem base',reason:'A versão anterior durou menos de 1 dia, antes do primeiro registro diário: sem dias antes para comparar.'});
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

/* ---------------- multiplicador do cabeçalho (multiplier.ts, aproximação por faixa) ---------------- */
function mult(videoId){
  const v=V.get(videoId), band=bandOf(v.ageDays), bb=CH.get(v.ch).peerViews[band.label]||[];
  if(!bb.length) return {text:'sem multiplicador: sem vídeos do canal nessa faixa'};
  return {value:v.views/median(bb),text:F.mult(v.views/median(bb))+' vs vídeos do canal com '+band.label+' (n = '+bb.length+')'+(bb.length<3?' — base fraca':'')+', método: aproximação por faixa'};
}

/* ---------------- thumbnails: SVG gerado aqui (duas cores sólidas, texto em caixa alta, silhueta, letra da imagem) ---------------- */
const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function thumbSrc(videoId,key){
  const a=V.get(videoId).art[key], words=a.text.split(' '), lines=[]; let cur='';
  words.forEach(w=>{ if((cur+' '+w).trim().length>9&&cur){ lines.push(cur); cur=w } else cur=(cur+' '+w).trim() }); if(cur) lines.push(cur);
  const fs=Math.min(40,Math.floor(170/Math.max(...lines.map(l=>l.length))*1.55));
  const label=V.get(videoId).thumbs.find(t=>t.key===key).label;
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="'+a.bg+'"/><rect x="198" width="122" height="180" fill="'+a.fg+'"/>'
    +'<circle cx="259" cy="88" r="27" fill="rgba(0,0,0,.55)"/><path d="M211 180c0-34 21-52 48-52s48 18 48 52z" fill="rgba(0,0,0,.55)"/>'
    +lines.map((l,i)=>'<text x="16" y="'+(58+i*(fs+3))+'" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="'+fs+'" fill="'+a.ink+'">'+xml(l)+'</text>').join('')
    +'<rect x="12" y="136" width="34" height="32" rx="5" fill="rgba(0,0,0,.72)"/><text x="29" y="160" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="700" font-size="22" fill="#fff">'+label+'</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

/* ---------------- conferência interna: se algum número não fechar, o console acusa ---------------- */
function selfCheck(){
  const bad=[];
  for(const v of V.values()){
    const th=versions(v.id,'thumb'), sum=imageSummary(v.id);
    const passes=sum.reduce((s,r)=>s+r.passes,0), ms=sum.reduce((s,r)=>s+r.ms,0);
    if(passes!==th.length) bad.push(v.id+': passagens '+passes+' ≠ períodos '+th.length);
    if(ms!==NOW-v.pub) bad.push(v.id+': tempo das imagens não soma o tempo no ar');
    if(v.changes.length!==v.thumbs.length+v.titles.length+v.descs.length-3) bad.push(v.id+': trocas ≠ versões − 3');
    for(const r of runs(v.id,'thumb').concat(runs(v.id,'title'))){ const m=v.changes.filter(c=>c.testRun&&c.testRun.id===r.id); if(m.length!==r.n) bad.push(r.id+': n da sequência') }
    // toda versão de thumbnail fechada precisa conter uma sincronização (00, 06, 12, 18): senão a produção nunca a veria
    v.thumbs.forEach(t=>{ if(t.current) return; const s0=Math.ceil((t.first_seen-SNAP0)/(6*H))*6*H+SNAP0; if(!(s0<t.endLo)) bad.push(t.id+': período invisível para a sincronização') });
    for(const c of v.changes) effect(c.id);
  }
  bad.forEach(b=>console.error('dados.js: '+b));
  return bad;
}

/* ---------------- contagens da moldura: derivadas dos vídeos deste arquivo ---------------- */
const allChanges=()=>[...V.values()].flatMap(v=>v.changes);
function tabCounts(n){
  const inN=x=>n==='todos'||!n||x.niche===n;
  return {canais:CHANNELS.filter(inN).length, mud:allChanges().filter(c=>c.at>NOW-30*DAY&&inN(V.get(c.video))).length, out:null};
}

window.HM={NOW,LAST_SYNC,H,DAY,RULES,date:D,fmt:F,du,TYPE_LABEL,TYPE_NAME,FEM,
  videos:[...V.values()],video:id=>V.get(id),channel:id=>CH.get(id),change:id=>CHG.get(id),
  versions,periodRate,imageSummary,runs,runText,runCore,runShort,runCardText,RUN_CAVEAT,runDays,SYNC_CADENCE:'a cada 6 h (00, 06, 12, 18)',effect,statusLine,KIND_SHORT,STATUS_WORD,mult,thumbSrc,selfCheck,
  /** estados do índice: cada um é um vídeo deste mundo */
  STATES:{'1':{video:'mm-lisboa'},'2':{video:'rb-passagem'},'3':{video:'rb-passagem',range:'7'},'4':{video:'pd-agentes'},'5':{video:'rb-passagem',focus:'compare'},
    '6a':{video:'lo-roteiro'},'6b':{video:'rb-mala'},'6c':{video:'lo-roteiro',unknownRuns:true},'7':{video:'rb-passagem'}}};

/* ---------------- só para chrome.js (a moldura copiada do mockup de 06/10) ---------------- */
const file=(name,p)=>{ const q=new URLSearchParams(); Object.entries(p||{}).forEach(([k,val])=>{ if(val!=null&&val!=='') q.set(k,val) }); const s=q.toString(); return name+(s?'?'+s:'') };
window.OBS={NOW,date:D,fmt:F,NICHES,channels:CHANNELS.map(c=>({...c,own:false})),TZ_LABEL:'Horários em São Paulo',
  SYNC:{last:LAST_SYNC,next:NEXT_SYNC,text:'sincronizado '+D.ago(LAST_SYNC),title:D.dmhm(LAST_SYNC)+' (SP)',nextText:'próxima sincronização às '+D.hm(NEXT_SYNC),cadence:window.HM.SYNC_CADENCE},
  forja:{queue:{lastPollAt:sp(2026,12,12,14,58)}},
  tabCounts,
  TAB_TITLES:{canais:c=>F.plural(c,'canal monitorado','canais monitorados'),mud:c=>F.plural(c,'troca','trocas')+' nos últimos 30 dias, nos vídeos deste mockup',out:()=>'Outliers não fazem parte deste mockup'},
  link:{canais:p=>file('../2026-10-06-historico-fixar-video/canais.html',p),mudancas:p=>file('mudancas.html',p),outliers:p=>file('../2026-10-02-observatorio/outliers.html',p),insights:p=>file('../2026-10-02-observatorio/insights.html',p),historico:p=>file('historico-video.html',p)},
};
selfCheck();
})();
