/* hist.js: a tela "Histórico do vídeo" de produção, copiada de 2026-10-07-historico-muitas-versoes/tela.js. Só apresentação: todo número vem de window.HM (hist-dados.js).
   As mudanças da rodada 3 estão marcadas "rodada 3".
   Os trechos novos da Fase 4 estão marcados com "F4 item N" (os 7 itens do plano). */
(function(){
'use strict';
const HM=window.HM, D=HM.date, F=HM.fmt, DAY=HM.DAY, HR=HM.H, NOW=HM.NOW, R=HM.RULES;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cap=F.cap, endDot=t=>/[.!?]$/.test(t)?t:t+'.';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const svg=(d,sw,extra)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(sw||2)+'" '+(extra||'stroke-linecap="round"')+' aria-hidden="true">'+d+'</svg>';
const IC={
  title:svg('<path d="M5 6h14M12 6v13"/>',2.6), thumb:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',2.4,'stroke-linejoin="round"'),
  desc:svg('<path d="M4 7h16M4 12h16M4 17h10"/>',2.6), ext:svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',2,''),
  warn:svg('<path d="M12 3 2 20h20L12 3zM12 10v4M12 17h.01"/>',2,''), ab:svg('<path d="M4 9h13l-3-3M20 15H7l3 3"/>'),
  prev:svg('<path d="m15 18-6-6 6-6"/>',2,''), next:svg('<path d="m9 18 6-6-6-6"/>',2,''), chev:svg('<path d="m6 9 6 6 6-6"/>',2,''),
  pin:svg('<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',2,'stroke-linejoin="round"'),
  forja:svg('<path d="M4 15h11l3-5H7zM9 15v4M14 15v4M6 19h11"/>',2,'stroke-linejoin="round"'),
  neutro:svg('<path d="M5 9h14M5 15h14"/>',2.4), ganhou:svg('<path d="m5 15 7-7 7 7"/>',2.4), perdeu:svg('<path d="m5 9 7 7 7-7"/>',2.4),
  inconclusivo:svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01"/>',2.2),
  aguardando:svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',2.2), 'sem-antes':svg('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',2.2),
};
IC['sem-serie']=IC['sem-antes'];
const TYPE={title:{c:'var(--t-title)',a:'var(--t-title-a)',n:'Título',s:'Tít.',per:['título','títulos']},thumb:{c:'var(--t-thumb)',a:'transparent',n:'Thumbnail',s:'Thumb.',per:['período','períodos']},desc:{c:'var(--t-desc)',a:'var(--t-desc-a)',n:'Descrição',s:'Desc.',per:['descrição','descrições']}};
const TYPES=['title','thumb','desc'];

/* ===================== estado ===================== */
const q=new URLSearchParams(location.search.length>1?location.search:location.hash.replace(/^#/,'').replace(/^.*?(?=id=)/,''));
const FJ=window.FORJA;
const v=HM.video(q.get('id'));
/* rodada 3: vídeo não encontrado dentro da moldura */
if(!v){ document.getElementById('screen').querySelector('.page').innerHTML='<nav class="crumbs" aria-label="Caminho"><ol><li><a href="../2026-10-04-multi-canal/observatorio-n-nichos.html">Canais</a></li><li aria-current="page">Histórico do vídeo</li></ol></nav><div class="card" role="alert"><p style="margin:0">Vídeo não encontrado. Ele pode ter sido removido. <a href="canal.html" style="text-decoration:underline">Voltar para Leo Khev</a></p></div>'; document.getElementById('mock').hidden=true; return }
const ch=HM.channel(v.ch), base={video:v.id};
const VER={thumb:HM.versions(v.id,'thumb'),title:HM.versions(v.id,'title'),desc:HM.versions(v.id,'desc')};
const CH=v.changes.slice().sort((a,b)=>b.mid-a.mid);                    // mais recente primeiro, pelo meio da janela
const seriesDays=Math.max(0,v.series.length-1);
const showRange=true;     // rodada 3: o seletor de período aparece sempre (janela padrão de 30 dias, decisão do dono)
const listMode=CH.length>=R.compareListFrom;                              // decisão do autor: 7 trocas ou mais
const showSummary=HM.imageSummary(v.id).some(r=>r.passes>=2);             // decisão do autor (LEIAME)
const RANGES=['7','30','90','tudo'];
const S={ range:RANGES.includes(q.get('range'))?q.get('range'):'30', unknown:false,
  expanded:false, pin:null, hover:null, pair:null, fField:'all', fVerdict:'all', pinned:!!v.pinned };
let arrivedId=null;     // rodada 3: troca aberta pela aba Trocas do canal
const rangeT0=()=>S.range==='tudo'?v.pub:Math.max(v.pub,NOW-(+S.range)*DAY);
const cut=()=>rangeT0()>v.pub;
const visVer=t=>VER[t].filter(p=>p.endLo>rangeT0());
const visChanges=()=>CH.filter(c=>c.at>=rangeT0());
/** sequências do campo que tocam o período mostrado (F4 item 6); desconhecido = nenhuma */
const runsOf=t=>HM.runs(v.id,t,S.unknown).filter(r=>r.open||r.to>=rangeT0());
const miss=key=>HM.archived(v.id,key)?'':' missing';     // rodada 3: só a imagem atual existe; as anteriores nunca foram arquivadas
const imgOf=(key,w,h,alt,lazy)=>HM.archived(v.id,key)?'<img src="'+HM.thumbSrc(v.id,key)+'" width="'+w+'" height="'+h+'" alt="'+esc(alt)+'"'+(lazy?' loading="lazy"':'')+'>':'<span role="img" aria-label="'+esc((alt||'Imagem anterior')+': imagem anterior não arquivada')+'">imagem anterior não arquivada</span>';     // F4 item 7: width e height explícitos
const thumbBox=(p,dur)=>'<div class="th'+miss(p.key)+'">'+imgOf(p.key,320,180,'Thumbnail '+p.label+', '+p.span,true)+(dur?'<span class="dur">'+dur+'</span>':'')+'</div>';
const versionAt=(type,ms)=>{ let r=VER[type][0]; VER[type].forEach(x=>{ if(x.start<=ms) r=x }); return r };
/** hora como o dado permite: thumbnail tem minuto; título e descrição só têm a hora da sincronização */
const tm=(type,ms)=>type==='thumb'?D.dmhm(ms):D.dm(ms)+' '+D.hh(ms);
/** quando uma troca aconteceu, na precisão do dado: minuto exato ou janela entre duas sincronizações */
const whenOf=c=>c.window?c.whenText:D.dmhm(c.at);

/* ===================== cabeçalho ===================== */
/* rodada 3: pager e Voltar. A lista de origem (ids, i0, tot, back) vem do canal; o texto diz de onde ela vem, como na produção ("vídeo 1 de 20 de <canal> (longos acompanhados, do mais novo ao mais antigo)"). */
const ids=(q.get('ids')||'').split(',').filter(Boolean), i0=parseInt(q.get('i0'),10)||0, tot=parseInt(q.get('tot'),10)||ids.length;
let back=q.get('back')||''; if(back&&back.charAt(0)!=='?') back='';
const canalHref='canal.html'+(location.protocol==='file:'?back.replace(/^\?/,'#'):back);
let veio=false; try{ veio=sessionStorage.getItem('pc:veio')==='1' }catch(x){}
const bp=new URLSearchParams(back.replace(/^\?/,'')), bTab=bp.get('tab')||'videos';
const SORTS={recentes:['do mais novo ao mais antigo','do mais antigo ao mais novo'],vistos:['dos mais vistos aos menos vistos','dos menos vistos aos mais vistos'],multiplo:['do maior ao menor múltiplo','do menor ao maior múltiplo'],vpd:['das mais às menos views por dia','das menos às mais views por dia']};
const FMTS={todos:'todos os vídeos',longos:'longos',shorts:'Shorts',fixados:'fixados'};
const origemTxt=()=>{
  if(bTab==='trocas') return {pre:'com trocas',txt:'trocas dos últimos 30 dias, da mais recente à mais antiga'};
  const so=SORTS[bp.get('sort')||'recentes']||SORTS.recentes, dir=bp.get('dir')==='asc'?1:0, qq=(bp.get('q')||'').trim();
  return {pre:'',txt:(FMTS[bp.get('fmt')||'todos']||'todos os vídeos')+(qq?', busca “'+qq+'”':'')+', '+so[dir]};
};
const k0=ids.indexOf(v.id), pos=k0>=0?i0+k0+1:0, antId=k0>0?ids[k0-1]:null, proxId=k0>=0&&k0<ids.length-1?ids[k0+1]:null;
const urlDe=outro=>{ const u=new URLSearchParams(location.search); u.set('id',outro); u.delete('troca'); return 'video.html?'+u.toString() };
function ir(outro,qual){ if(!outro) return; try{ sessionStorage.setItem('pc:foco',qual) }catch(x){} location.replace(urlDe(outro)) }
function renderCrumbs(){
  const cc=$('#crumbCanal'); cc.textContent=HM.channel(v.ch).name; cc.href=canalHref;
  if(k0<0){ $('#pager').innerHTML=''; return }
  const o=origemTxt();
  $('#pager').innerHTML=(antId?'<a class="btn ghost" data-nav="ant" id="pAnt" href="'+esc(urlDe(antId))+'" aria-label="Vídeo anterior da lista">'+IC.prev+'Anterior</a>':'<a class="btn ghost" data-nav="ant" id="pAnt" role="link" aria-disabled="true" tabindex="0">'+IC.prev+'Anterior</a>')
    +'<span>vídeo '+pos+' de '+tot+(o.pre?' '+o.pre:'')+' de '+esc(HM.channel(v.ch).name)+' ('+esc(o.txt)+')</span>'
    +(proxId?'<a class="btn ghost" data-nav="prox" id="pProx" href="'+esc(urlDe(proxId))+'" aria-label="Próximo vídeo da lista">Próximo'+IC.next+'</a>':'<a class="btn ghost" data-nav="prox" id="pProx" role="link" aria-disabled="true" tabindex="0">Próximo'+IC.next+'</a>');
}
function renderHeader(){
  const cur=VER.thumb[VER.thumb.length-1], distinct=new Set(VER.thumb.map(t=>t.key)).size, raw=v.raw;
  const back=HM.imageSummary(v.id).filter(r=>r.passes>=2).length;
  const counts=!CH.length?[{type:null,text:'Nenhuma troca registrada'}]:[
    {type:'title',text:F.plural(VER.title.length,'título','títulos')},
    {type:'thumb',text:VER.thumb.length>1?distinct+' thumbnails em '+VER.thumb.length+' períodos'+(back===1?' (uma voltou)':back>1?' ('+back+' voltaram)':''):F.plural(VER.thumb.length,'thumbnail','thumbnails')},
    {type:'desc',text:v.descUnknown?'descrição: texto não exportado':F.plural(VER.desc.length,'descrição','descrições')}];
  const fmtTxt=v.fmt==='long'?'Vídeo longo':v.fmt==='short'?'Short':'formato não confirmado';
  const viewsHtml=raw.views==null?'<span><b>sem contagem</b>: '+esc(raw.viewsMotivo||'o YouTube não devolveu')+'</span>':'<span><b class="mono">'+F.num(raw.views)+'</b> views'+(raw.chk!=null&&HM.NOW-raw.chk>48*36e5?' <span class="mono" title="última conferência desta contagem">(contagem de '+D.dm(raw.chk)+')</span>':'')+'</span>';
  const pubHtml=v.pubMissing?'<span>sem data de publicação</span>':'<span>publicado <b title="'+D.dmhm(v.pub)+'">há '+F.plural(v.ageDays,'dia','dias')+'</b> <span class="mono">('+D.dmhm(v.pub)+')</span></span>';
  const avatar=ch.avatar?'<img src="'+esc(ch.avatar)+'" alt="" width="20" height="20" style="border-radius:50%;display:block" onerror="this.replaceWith(document.createTextNode(\''+ch.ini+'\'))">':ch.ini;
  $('#vhead').innerHTML=
    '<div class="cur">'+thumbBox(cur,v.dur)+'</div>'
   +'<div class="vt"><h2 tabindex="-1" id="h1">'+esc(v.title)+'</h2></div>'
   +'<div class="actions"><div class="fx-top"><div class="arow">'
     +'<button class="btn" type="button" id="pinBtn" aria-pressed="'+S.pinned+'">'+IC.pin+'<span>'+(S.pinned?'Desafixar':'Fixar vídeo')+'</span></button>'
     +'<a class="btn" href="'+v.url+'" target="_blank" rel="noopener noreferrer">'+IC.ext+'Abrir no YouTube<span class="sr"> (abre em nova aba)</span></a></div></div>'
     +'<div class="frow"><button class="btn forja-solid" type="button" id="forjaBtn">'+IC.forja+'Pedir leitura à forja</button></div></div>'
   +'<div class="vm"><div class="facts">'
     +'<span class="chan"><span class="av" style="background:'+ch.color+';overflow:hidden" aria-hidden="true">'+avatar+'</span>'+esc(ch.name)+'<span class="niche">Viagem</span></span>'
     +viewsHtml+pubHtml
     +'<span>'+fmtTxt+'</span><span title="'+D.dmhm(HM.LAST_SYNC)+' (SP)">sincronizado '+D.ago(HM.LAST_SYNC)+'</span>'
     +'<span>'+esc(HM.mult(v.id).text)+'</span></div>'
   +'<div class="counts">'+(S.pinned?'<span class="count">'+IC.pin+'<b>'+(v.pinAntigo?'Fixado antigo':'Fixado')+'</b><span class="how">conferido a cada 6 h</span></span>':'')
     +counts.map(c=>'<span class="count">'+(c.type?'<i style="background:'+TYPE[c.type].c+'" aria-hidden="true"></i>':'')+c.text+'</span>').join('')+'</div></div>';
}

/* ===================== F4 item 3: filtro de período ===================== */
function bins(){ const t0=rangeT0(), out=[]; for(let j=1;j<v.series.length;j++){ const a=v.series[j-1], b=v.series[j]; if(b.t>t0) out.push({a:Math.max(a.t,t0),b:b.t,vpd:b.views-a.views}) } return out }
function renderRange(){
  $('#rng').hidden=!showRange; $('#rngTxt').hidden=!showRange; if(!showRange) return;
  const LBL={'7':'7 d','30':'30 d','90':'90 d','tudo':'tudo'}, LONG={'7':'últimos 7 dias','30':'últimos 30 dias','90':'últimos 90 dias','tudo':'desde a publicação'};
  $('#rngSeg').innerHTML=RANGES.map(r=>'<button type="button" aria-pressed="'+(S.range===r)+'" data-range="'+r+'" aria-label="'+LBL[r]+': '+LONG[r]+'">'+LBL[r]+'</button>').join('');
  const one=(a,b,sing,plur)=>'<b>'+a+' de '+b+'</b> '+(b===1?sing:plur);
  // a mesma frase em todos os filtros (a altura não muda); o que o filtro não muda fica dito
  $('#rngTxt').innerHTML=(cut()?'De '+D.dmhm(rangeT0())+' até agora':'Vídeo inteiro, desde '+D.dmhm(v.pub)+(S.range!=='tudo'?' (menos que os '+S.range+' dias do filtro)':''))+': '
    +one(visVer('thumb').length,VER.thumb.length,'período de thumbnail','períodos de thumbnail')+', '+one(visVer('title').length,VER.title.length,'título','títulos')+', '
    +one(visVer('desc').length,VER.desc.length,'descrição','descrições')+', '+one(visChanges().length,CH.length,'troca','trocas')+' e '+one(bins().length,seriesDays,'dia de views','dias de views')
    +'. O cabeçalho e o resultado de cada troca continuam os do vídeo inteiro.';
}

/* ===================== linha do tempo ===================== */
let G=null;   // geometria atual
/* rodada 3: a contagem diária deste canal só começa em 03/10. Antes dela o eixo é comprimido numa faixa hachurada "antes de 03/10, sem registro"
   (o trecho de 03/10 até agora ocupa o resto da largura). Eventos antes de 03/10 continuam nas faixas, na escala comprimida. */
function geom(){
  const W=$('#tlwrap').clientWidth, small=W<620, padL=small?60:92, padR=14, t0=rangeT0(), t1=NOW;
  const minpx=matchMedia('(pointer:coarse),(max-width:900px)').matches?44:32;
  const tS=v.series.length?v.series[0].t:null, pw=W-padL-padR;
  if(tS==null||t0>=tS) return {W,small,padL,padR,t0,t1,minpx,tS:null,bandW:0,x:t=>padL+(Math.min(Math.max(t,t0),t1)-t0)/(t1-t0)*pw};
  const bandW=Math.round(pw*(small?.30:.34));
  return {W,small,padL,padR,t0,t1,minpx,tS,bandW,x:t=>{ t=Math.min(Math.max(t,t0),t1); return t<tS?padL+(t-t0)/(tS-t0)*bandW:padL+bandW+(t-tS)/(t1-tS)*(pw-bandW) }};
}
function niceStep(m){ const p=Math.pow(10,Math.floor(Math.log10(m/2))), n=m/2/p; return (n<1.5?1:n<3.5?2:n<7.5?5:10)*p }
/* O gráfico segue views-chart.tsx da produção: unidade "views/dia" acima do eixo, valor de cada degrau quando há
   56 px ou mais por dia (com o contorno de texto que a tela já usa, por cima das linhas de troca), marcas do eixo x a
   56 px ou mais. Não desenha a curva "esperado pela idade" (LEIAME). */
function renderChart(){
  const g=G, HH=200, TOP=22, BOT=26, PH=HH-TOP-BOT, B=bins();
  if(!v.series.length){ const c0=$('#chart'); c0.setAttribute('viewBox','0 0 '+g.W+' '+HH); c0.innerHTML='<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="var(--border-strong)"/></pattern></defs><rect x="'+g.padL+'" y="'+TOP+'" width="'+(g.W-g.padL-g.padR)+'" height="'+PH+'" fill="url(#hatch)" opacity=".6"/><text x="'+(g.padL+14)+'" y="'+(TOP+PH/2)+'" class="note">'+(v.raw.views==null?'sem contagem de views':v.pinAntigo?'fixado antigo: sem registro diário':'sem registro diário: fora dos '+ch.video_limit+' acompanhados')+'</text>'; c0.setAttribute('aria-label','Sem registros diários de views de '+v.title+'. As faixas de versões estão abaixo.'); return }
  const max=Math.max(1,...B.map(b=>b.vpd)), step=niceStep(max), ymax=Math.ceil(max/step)*step, y=val=>TOP+PH-(val/ymax)*PH;
  let s='<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="var(--border-strong)"/></pattern></defs>';
  for(let k=0;k<=ymax+1e-9;k+=step) s+='<line x1="'+g.padL+'" x2="'+(g.W-g.padR)+'" y1="'+y(k)+'" y2="'+y(k)+'" stroke="var(--grid)"/><text x="'+(g.padL-10)+'" y="'+(y(k)+4)+'" text-anchor="end">'+(k===0?'0':F.num(k))+'</text>';
  s+='<text x="'+g.padL+'" y="'+(TOP-10)+'">views/dia</text>';
  const P=S.pair?pairByKey(S.pair):null, e=P?P.e:null;
  if(e&&e.observed!=null){   // janelas antes e depois da troca selecionada
    [[D.snap(e.k-1-e.beforeDays),D.snap(e.k-1)],[D.snap(e.k),D.snap(e.k+e.afterDays)]].forEach(w=>{ if(w[1]>g.t0) s+='<rect x="'+g.x(w[0])+'" y="'+TOP+'" width="'+Math.max(0,g.x(w[1])-g.x(w[0]))+'" height="'+PH+'" fill="var(--text)" opacity=".05"/>' });
  }
  if(B.length){
    let area='M'+g.x(B[0].a)+','+y(0), line='';
    B.forEach((b,i)=>{ area+=' L'+g.x(b.a)+','+y(b.vpd)+' L'+g.x(b.b)+','+y(b.vpd); line+=(i?'L':'M')+g.x(b.a)+','+y(b.vpd)+' L'+g.x(b.b)+','+y(b.vpd)+' ' });
    s+='<path d="'+area+' L'+g.x(B[B.length-1].b)+','+y(0)+'Z" fill="var(--curve-fill)"/><path d="'+line+'" fill="none" stroke="var(--curve)" stroke-width="2" stroke-linejoin="round"/>';
    const lastT=B[B.length-1].b; if(NOW>lastT) s+='<rect x="'+g.x(lastT)+'" y="'+TOP+'" width="'+Math.max(3,g.x(NOW)-g.x(lastT))+'" height="'+PH+'" fill="url(#hatch)"/>';
    const per=(g.W-g.padL-g.padR-g.bandW)/(((g.t1-(g.tS||g.t0)))/DAY);
    if(per>=56){ let last=null; B.forEach(b=>{ const lab=F.num(b.vpd), cx=(g.x(b.a)+g.x(b.b))/2, wt=lab.length*6.7, yy=Math.max(TOP+10,y(b.vpd)-7);
      if(last&&cx-wt/2<last.r+6&&Math.abs(yy-last.y)<14) return; last={r:cx+wt/2,y:yy}; s+='<text class="vl" x="'+cx+'" y="'+yy+'" text-anchor="middle">'+lab+'</text>' }) }
  }
  if(g.tS) s+='<rect x="'+g.padL+'" y="'+TOP+'" width="'+g.bandW+'" height="'+PH+'" fill="url(#hatch)" opacity=".7"/><line x1="'+(g.padL+g.bandW)+'" x2="'+(g.padL+g.bandW)+'" y1="'+TOP+'" y2="'+(TOP+PH)+'" stroke="var(--border-strong)"/><text x="'+(g.padL+g.bandW/2)+'" y="'+(TOP+PH/2)+'" text-anchor="middle" class="note">antes de '+D.dm(g.tS)+', sem registro</text><text x="'+(g.padL+g.bandW/2)+'" y="'+(TOP+PH/2+16)+'" text-anchor="middle" class="note">(eixo comprimido)</text>';
  const tk=[]; const firstMid=Math.ceil(((g.tS||g.t0)+3*HR)/DAY)*DAY-3*HR;
  for(let t=firstMid;t<g.t1;t+=DAY){ if(tk.length&&g.x(t)-g.x(tk[tk.length-1])<56) continue; tk.push(t) }
  tk.forEach((t,i)=>{ s+='<line x1="'+g.x(t)+'" x2="'+g.x(t)+'" y1="'+(TOP+PH)+'" y2="'+(TOP+PH+5)+'" stroke="var(--border-strong)"/><text x="'+g.x(t)+'" y="'+(HH-6)+'" text-anchor="'+(i===tk.length-1&&g.x(t)>g.W-40?'end':'middle')+'">'+D.dm(t)+'</text>' });
  const c=$('#chart'); c.setAttribute('viewBox','0 0 '+g.W+' '+HH); c.innerHTML=s;
  c.setAttribute('aria-label','Views por dia de '+v.title+', '+F.plural(B.length+1,'registro diário','registros diários')+'. '+F.plural(visChanges().length,'troca marcada','trocas marcadas')+'. Valores na tabela abaixo.');
}

/* ---- F4 item 4: faixas densas ----
   Regra 1: nenhum período é desenhado maior que a sua duração. Períodos com menos de MINPX de largura que são vizinhos
   viram UM alvo, na extensão real do grupo, com um traço por período, as letras em ordem e "N períodos".
   Regra 2: nenhum marcador sai do horário da troca. Marcadores a menos de MINPX uns dos outros viram um contador
   ("N trocas") no meio do trecho; os traços ficam no horário de cada troca.
   O grupo abre a lista com Enter, espaço ou clique (não ao receber foco). Cada faixa é UMA parada de Tab; as setas andam. */
let gid=0, anyGroup=false;
/** letras de um grupo que cabem em `px`: todas, ou as primeiras e quantas faltam */
function fitLetters(labels,px){ const max=Math.floor((px-6)/6.4), all=labels.join(' '); if(all.length<=max) return all;
  for(let k=labels.length-1;k>=2;k--){ const t=labels.slice(0,k).join(' ')+' +'+(labels.length-k); if(t.length<=max) return t } return '' }
/** rótulo de contagem que cabe no grupo: o texto inteiro, só o número, ou nada (o nome acessível e a dica têm o texto completo) */
function fitCount(full,short,px){ return full.length*5.7+8<=px?full:short.length*6.2+6<=px?short:'' }
function laneHTML(type){
  const g=G, T=TYPE[type], vers=visVer(type), rs=runsOf(type), items=[], o=HM.FEM[type]?'a':'o';
  let fixed='<div class="lane-l" style="width:'+(g.padL-8)+'px"><i style="background:'+T.c+'" aria-hidden="true"></i>'+(g.small?'<abbr title="'+T.n+'">'+T.s+'</abbr>':T.n)+'</div>';
  vers.forEach(p=>{ if(p.window&&p.window[1]>g.t0) fixed+='<div class="win" title="janela entre duas sincronizações" style="left:'+g.x(p.window[0])+'px;width:'+Math.max(2,g.x(p.window[1])-g.x(p.window[0]))+'px;--c:'+T.c+';--wa:'+(type==='desc'?'var(--t-desc-a)':'var(--t-title-a)')+'"></div>' });
  const its=vers.map(p=>{ const L=g.x(p.start), Rr=g.x(p.endLo); return {p,L,R:Rr,W:Rr-L} });
  const fill=p=>type==='thumb'?'--fill:'+v.art[p.key].bg+';':'';
  const nameOf=p=>p.aria+(p.reverted?', voltou':'')+(p.cur?', no ar':'');           // o nome inclui o texto visível
  for(let i=0;i<its.length;i++){
    const it=its[i], p=it.p, key=type+':'+p.i, dimg=type==='thumb'?' data-img="'+p.label+'"':'';
    if(it.W>=g.minpx){
      const L=it.L+1, W=Math.max(8,it.W-2), common='type="button" data-k="'+key+'"'+dimg+' aria-label="'+esc(nameOf(p))+'" title="'+esc(p.aria)+'" style="left:'+L+'px;width:'+W+'px"';
      let h;
      if(type==='thumb'){ const narrow=W<70;
        h='<button class="clip ln-i'+(p.cur?' cur':'')+(narrow?' narrow':'')+'" '+common+'>'+(narrow?'<span class="vid">'+p.label+'</span>':'<div class="th'+miss(p.key)+'">'+imgOf(p.key,64,36,'',true)+'</div><span class="vid">'+p.label+'</span>'+(p.reverted&&W>150?'<span class="ret">voltou</span>':''))+'</button>';
      } else h='<button class="clip ln-i'+(p.cur?' cur':'')+'" '+common+'><span class="vid">'+p.label+'</span>'+(W>60&&type==='title'?'<span class="tt">'+esc(p.text)+'</span>':W>60&&p.cur?'<span class="tt">no ar</span>':'')+'</button>';
      items.push({x:it.L,o:1,h}); continue;
    }
    let j=i; while(j+1<its.length&&its[j+1].W<g.minpx) j++;
    if(j===i){   // um período estreito sozinho: largura real, preenchido, área de clique mínima por pseudo-elemento
      items.push({x:it.L,o:1,h:'<button class="clip sm ln-i'+(p.cur?' cur':'')+'" type="button" data-k="'+key+'"'+dimg+' aria-label="'+esc(nameOf(p))+'" title="'+esc(p.aria)+'" style="left:'+(it.L+.5)+'px;width:'+Math.max(3,it.W-1)+'px;'+fill(p)+'">'+(it.W>=14?'<span class="vid">'+p.label+'</span>':'')+'</button>'});
      continue;
    }
    anyGroup=true;
    const grp=its.slice(i,j+1), L0=grp[0].L, ext=grp[grp.length-1].R-L0, id='gp'+(++gid), n=grp.length, first=grp[0].p, last=grp[n-1].p;
    const from=first.i===0?D.dmhm(v.pub):tm(type,Math.max(first.winStart,g.t0)), to=last.cur?'agora':tm(type,last.endHi);
    const unit=n+' '+(type==='thumb'?'períodos':T.per[1]), labels=grp.map(x=>x.p.label);
    const lab=unit+(type==='thumb'?' de thumbnail':'')+', de '+from+' até '+to+': '+labels.join(', ');
    items.push({x:L0,o:1,h:'<div class="gwrap pg" style="left:'+L0+'px;width:'+ext+'px"><button class="cgrp gbtn ln-i" type="button" aria-expanded="false" aria-controls="'+id+'" aria-label="'+esc(lab)+'" data-n="'+n+'" data-unit="'+unit+'" data-ext="'+ext+'" data-tip="p" data-from="'+from+'" data-to="'+to+'" data-seq="'+labels.join(' → ')+'" data-type="'+type+'">'
      +grp.map(x=>'<span class="sl" data-sl="'+type+':'+x.p.i+'"'+(type==='thumb'?' data-img="'+x.p.label+'"':'')+' style="left:'+(x.L-L0)+'px;width:'+Math.max(3,x.W)+'px;'+fill(x.p)+'"></span>').join('')
      +(type==='thumb'?'<span class="gl" aria-hidden="true">'+fitLetters(labels,ext)+'</span>':'')
      +'<span class="gn" aria-hidden="true">'+fitCount(unit,String(n),ext)+'</span></button>'
      +'<div class="gpop" id="'+id+'"><h4>'+unit+(type==='thumb'?' de thumbnail':'')+' neste trecho</h4><ul>'
      +grp.map(x=>'<li><button type="button" data-go="'+type+':'+x.p.i+'"><span class="gk">'+x.p.label+'</span><span class="g1">'+esc(cap(x.p.span))+'</span><span class="g2">no ar por '+x.p.dur+(type==='title'?' · '+esc(x.p.text):'')+'</span></button></li>').join('')
      +'</ul></div></div>'});
    i=j;
  }
  // marcadores: agrupa os que ficam a menos de MINPX; depois junta contadores que ficariam em cima um do outro
  const ms=visChanges().filter(c=>c.type===type).sort((a,b)=>a.at-b.at).map(c=>({c,px:g.x(c.at)}));
  let cl=[]; ms.forEach(m=>{ const k=cl[cl.length-1]; if(k&&m.px-k[k.length-1].px<g.minpx) k.push(m); else cl.push([m]) });
  const cx=k=>(k[0].px+k[k.length-1].px)/2;
  for(let i=0;i<cl.length-1;i++){ if(cl[i].length>1&&cl[i+1].length>1&&cx(cl[i+1])-cx(cl[i])<60){ cl[i]=cl[i].concat(cl[i+1]); cl.splice(i+1,1); i-- } }
  let mkGroups=false;
  cl.forEach((k,ci)=>{
    if(k.length===1){ const c=k[0].c;
      items.push({x:k[0].px,o:0,h:'<button class="mk ln-i" type="button" style="left:'+k[0].px+'px;--c:'+T.c+'" data-ev="'+type+':'+c.idx+'" data-pair="'+c.id+'" aria-describedby="tip" aria-label="'+T.n+' trocad'+o+' '+(c.window?c.whenText:'em '+c.whenText)+'"><span>'+IC[type]+'</span></button>'});
      return;
    }
    anyGroup=true; mkGroups=true;
    const L0=k[0].px, ext=k[k.length-1].px-L0, id='gp'+(++gid), n=k.length;
    const nb=[cl[ci-1],cl[ci+1]].filter(x=>x&&x.length>1).map(x=>Math.abs(cx(x)-cx(k))), room=Math.min(1e9,...nb);
    const from=type==='thumb'?D.dmhm(k[0].c.at):tm(type,k[0].c.window[0]), to=type==='thumb'?D.dmhm(k[n-1].c.at):tm(type,k[n-1].c.window[1]);
    const lab=n+' trocas de '+HM.TYPE_NAME[type]+' entre '+from+' e '+to;
    items.push({x:L0,o:0,h:'<div class="gwrap mg" style="left:'+L0+'px;width:'+ext+'px;--c:'+T.c+'"><span class="mspan" style="left:0;width:'+ext+'px"></span>'
      +k.map(m=>'<span class="mtick" style="left:'+(m.px-L0)+'px"></span>').join('')
      +'<button class="mkg gbtn ln-i" type="button" aria-expanded="false" aria-controls="'+id+'" aria-label="'+esc(lab)+'" data-pairs="'+k.map(m=>m.c.id).join(' ')+'" data-tip="m" data-n="'+n+'" data-from="'+from+'" data-to="'+to+'" data-type="'+type+'"><span>'+IC[type]+(room>=96?n+' trocas':n+' <abbr title="trocas">tr.</abbr>')+'</span></button>'
      +'<div class="gpop" id="'+id+'"><h4>'+n+' trocas de '+HM.TYPE_NAME[type]+' neste trecho</h4><ul>'
      +k.map(m=>{ const e=HM.effect(m.c.id); return '<li><button type="button" data-pair="'+m.c.id+'"><span class="gk">'+IC[e.status]+'</span><span class="g1">'+m.c.from.label+' → '+m.c.to.label+', '+whenOf(m.c)+'</span><span class="g2">'+esc(HM.statusLine(e))+'</span></button></li>' }).join('')
      +'</ul></div></div>'});
  });
  // F4 item 6: trocas em sequência. Barra opaca numa linha própria, por cima das linhas verticais; o rótulo inteiro ou o curto, nunca um número solto
  let runRow='';
  if(rs.length){ runRow='<div class="runrow">'+rs.map(r=>{ const a=g.x(Math.max(r.from,g.t0)), b=r.open?g.x(NOW):g.x(Math.max(r.to,g.t0)), w=Math.max(8,b-a), txt=HM.runText(r), sh=HM.runShort(r);
    const lbl=w>=txt.length*5.9+18?'<b>trocas em sequência</b>: '+esc(txt.replace('trocas em sequência: ','')):w>=sh.length*5.9+18?sh:'';
    return '<div class="runb'+(r.open?' open':'')+(r.from<g.t0?' cutl':'')+'" role="img" aria-label="'+esc(cap(txt)+' ('+HM.TYPE_NAME[type]+'). '+HM.RUN_CAVEAT)+'" style="left:'+a+'px;width:'+w+'px;--c:'+T.c+'">'+(lbl?'<span class="rl" aria-hidden="true">'+lbl+'</span>':'')+'</div>' }).join('')+'</div>'; }
  items.sort((a,b)=>Math.abs(a.x-b.x)<1?a.o-b.o:a.x-b.x);     // ordem de tempo; no empate, a troca vem antes do período que ela cria
  const nV=vers.length, nC=ms.length;
  return '<div class="lane'+(type==='thumb'?' thumbs':'')+(rs.length?' has-run':'')+(mkGroups?' has-grp':'')+'" data-lane="'+type+'" role="group" aria-label="Faixa de '+HM.TYPE_NAME[type]+': '+F.plural(nV,T.per[0],T.per[1])+' e '+F.plural(nC,'troca','trocas')+', em ordem de tempo. As setas para a esquerda e para a direita andam pela faixa.">'
    +fixed+items.map(x=>x.h).join('')+runRow+'</div>';
}
function renderLanes(){
  gid=0; anyGroup=false;
  $('#lanes').innerHTML=TYPES.map(laneHTML).join('');
  $$('#lanes .lane').forEach(l=>{ const it=[...l.querySelectorAll('.ln-i')]; it.forEach((b,i)=>b.tabIndex=i?-1:0) });     // uma parada de Tab por faixa
  $('#vlines').innerHTML=visChanges().map(c=>{ const T=TYPE[c.type];
    return c.window&&c.window[0]>=G.t0?'<div class="vband" data-vl="'+c.id+'" style="left:'+G.x(c.window[0])+'px;width:'+Math.max(1,G.x(c.window[1])-G.x(c.window[0]))+'px;--c:'+T.c+';--wa:'+T.a+'"></div>'
      :'<div class="vline" data-vl="'+c.id+'" style="left:'+G.x(c.at)+'px;--c:'+T.c+'"></div>' }).join('');
  applyHl();
}
function renderLegend(){
  const vc=visChanges(), out=v.series.length?['<span><span class="sw"></span>views/dia (degrau = 1 dia entre registros)</span>']:[];
  const P=S.pair?pairByKey(S.pair):null;
  if(P&&P.e.observed!=null) out.push('<span><span class="sw shade"></span>janelas antes e depois de '+esc(P.label)+'</span>');
  if(v.series.length) out.push('<span><span class="sw hatch"></span>dia em coleta, fecha '+D.dm(D.snap(v.lastIdx+1))+' '+D.hh(D.snap(v.lastIdx+1))+'</span>');
  if(G.tS) out.push('<span><span class="sw hatch"></span>antes de '+D.dm(G.tS)+', sem registro diário: o eixo é comprimido até esse dia (a contagem diária deste canal começou nele)</span>');
  if(vc.some(c=>c.window)) out.push('<span><span class="sw swwin"></span>janela entre duas sincronizações: título e descrição não têm minuto; janela '+HM.SYNC_CADENCE+'</span>');
  if(vc.some(c=>c.type==='thumb')) out.push('<span><span style="color:var(--t-thumb);display:inline-flex;width:14px">'+IC.thumb+'</span>troca de thumbnail com horário exato (detectada pela mudança do arquivo da imagem)</span>');
  if(anyGroup) out.push('<span><span class="sw swgrp" aria-hidden="true">N trocas</span>trocas ou períodos próximos demais para caber lado a lado: o contador diz quantos são e abre a lista; os traços ficam no horário de cada um</span>');
  if(['title','thumb'].some(t=>runsOf(t).length)) out.push('<span><span class="sw swrun"></span>trocas em sequência: trocas do mesmo campo com até '+R.testRunGapDays+' dias entre uma e outra. '+HM.RUN_CAVEAT+'</span>');
  if(!vc.length) out.push('<span>'+(CH.length?'Nenhuma troca neste período.':'Nenhuma troca registrada.')+'</span>');
  $('#legend').innerHTML=out.join('');
}
function renderTable(){
  if(!v.series.length){ $('#datatable').innerHTML='<summary>Ver os registros diários em tabela</summary><p class="src" style="margin:8px 0 0">Sem registro diário: '+(v.raw.views==null?'o YouTube ainda não devolveu a contagem de views.':v.pinAntigo?'vídeo fixado antigo, fora dos acompanhados.':'o vídeo está fora dos '+ch.video_limit+' acompanhados do canal.')+'</p>'; return }
  const B=bins(), first=B.length?v.series.find(p=>p.t===B[0].b).i-1:v.firstIdx, pts=v.series.filter(p=>p.i>=first);
  $('#datatable').innerHTML='<summary>Ver os registros diários em tabela</summary><div class="tw" tabindex="0" role="region" aria-label="Registros diários de views"><table class="mono"><caption class="sr">Views em cada registro diário</caption><thead><tr><th scope="col">registro</th><th scope="col">views acumuladas</th><th scope="col">views/dia desde o anterior</th></tr></thead><tbody>'
    +pts.map((p,k)=>{ const prev=v.series[p.i-v.firstIdx-1]; return '<tr><td>'+D.dmhm(p.t)+'</td><td>'+F.num(p.views)+'</td><td>'+(k===0?(prev?'ponto de partida do período':'1º registro'):F.num(p.views-prev.views))+'</td></tr>' }).join('')+'</tbody></table></div>';
}
function renderTimeline(){
  G=geom();
  const lastP=v.series[v.series.length-1], B=bins();
  if(!lastP){ $('#tlsrc').innerHTML='<b>sem registro diário</b> deste vídeo'; renderChart(); renderLanes(); renderLegend(); renderTable(); return }
  $('#tlsrc').innerHTML='<b>'+F.plural(B.length+1,'registro diário','registros diários')+'</b> (às '+D.hh(lastP.t)+'); views ganhas entre um registro e outro; o primeiro é de '+D.dm(v.series[0].t)+', não da publicação; último '+D.dmhm(lastP.t);
  renderChart(); renderLanes(); renderLegend(); renderTable();
}

/* ===================== destaque (o que já existe por label, mais a linha do resumo) ===================== */
function hlNow(){ return S.hover||S.pin }
function applyHl(){
  const h=hlNow(), root=$('#screen');
  root.querySelectorAll('.is-hl').forEach(el=>el.classList.remove('is-hl'));
  root.querySelectorAll('.mk.on,.mkg.on').forEach(el=>el.classList.remove('on'));
  root.querySelectorAll('.cgrp .gn').forEach(el=>{ const d=el.parentNode.dataset; el.textContent=fitCount(d.unit,d.n,+d.ext) });
  if(h){
    const sel=h.label?'[data-img="'+h.label+'"]':'[data-k="'+h.type+':'+h.i+'"],[data-sl="'+h.type+':'+h.i+'"],[data-ver="'+h.type+':'+h.i+'"]';
    root.querySelectorAll(sel).forEach(el=>{ el.classList.add('is-hl'); const gb=el.closest('.cgrp'); if(gb) gb.classList.add('is-hl') });
    // dentro de um grupo, o contador diz quantos dos períodos são da imagem destacada
    if(h.label) root.querySelectorAll('.cgrp.is-hl').forEach(gb=>{ const k=gb.querySelectorAll('.sl.is-hl').length; gb.querySelector('.gn').textContent=fitCount(k+' de '+gb.dataset.n+': '+h.label,k+'/'+gb.dataset.n,+gb.dataset.ext) });
    if(h.ev!=null){ const m=root.querySelector('.mk[data-ev="'+h.type+':'+h.ev+'"]'); if(m) m.classList.add('on') }
  }
  markPair();
  const note=$('#hlNote'); if(note){ const hid=h&&h.label?$$('#film .fcard[hidden][data-img="'+h.label+'"]').length:0;
    note.textContent=hid?F.plural(hid,'cartão','cartões')+' da imagem '+h.label+' '+(hid===1?'está recolhido':'estão recolhidos')+'.':''; }
}
function markPair(){
  $$('#vlines .on').forEach(el=>el.classList.remove('on')); $$('#lanes .mk.sel,#lanes .mkg.sel').forEach(el=>el.classList.remove('sel','on'));
  const P=S.pair?pairByKey(S.pair):null; if(!P) return;
  P.group.forEach(c=>{ const l=document.querySelector('#vlines [data-vl="'+c.id+'"]'); if(l) l.classList.add('on');
    const m=document.querySelector('#lanes .mk[data-pair="'+c.id+'"]'); if(m) m.classList.add('on','sel');
    $$('#lanes .mkg').forEach(b=>{ if(b.dataset.pairs.split(' ').includes(c.id)) b.classList.add('on','sel') }) });
}
const hlOfKey=key=>{ const [type,i]=key.split(':'); const p=VER[type][+i]; return type==='thumb'?{type,i:+i,label:p.label,ev:+i>0?+i:null}:{type,i:+i,ev:+i>0?+i:null} };

/* ===================== F4 item 1: resumo por imagem ===================== */
function renderSummary(){
  const sec=$('#isumSec'); sec.hidden=!showSummary; if(!showSummary) return;
  sec.setAttribute('aria-labelledby','isumh');
  const t0=rangeT0(), sum=HM.imageSummary(v.id,t0,NOW), span=NOW-t0;
  sec.innerHTML='<div class="sec-h"><h3 id="isumh">Resumo por imagem</h3><span class="src">'+(cut()?'só o período mostrado, de '+D.dmhm(t0)+' até agora':'do vídeo inteiro')+'; passe o mouse, foque ou fixe uma imagem para destacá-la nas faixas e nos cartões</span></div>'
    +'<div class="isum-sc"><table class="isum" aria-labelledby="isumh"><thead><tr><th scope="col">Imagem</th><th scope="col" class="n">No ar</th><th scope="col" class="n">Passagens</th><th scope="col" class="n">Média de views/dia</th><th scope="col" class="wide">Quando esteve no ar</th></tr></thead><tbody>'
    +sum.map(r=>{ const on=!!S.pin&&S.pin.label===r.label; return '<tr data-img="'+r.label+'" data-row="'+r.label+'"><th scope="row" aria-label="Imagem '+r.label+(r.cur?', no ar':'')+'"><span class="isum-c"><button class="isum-b" type="button" aria-pressed="'+on+'" data-pinimg="'+r.label+'" aria-label="'+r.label+': fixar o destaque desta imagem">'+imgOf(r.key,48,27,'',true)+'<b>'+r.label+'</b><span class="pin"'+(on?'':' hidden')+'>fixada</span></button>'+(r.cur?'<span class="tag now">no ar</span>':'')+'</span></th>'
      +'<td class="n">'+r.durText+'</td><td class="n">'+r.passes+'</td><td class="n nm">'+r.rateText+'</td>'
      +'<td class="wide"><span class="strip" aria-hidden="true">'+r.segs.map(sg=>'<i style="left:'+((sg[0]-t0)/span*100)+'%;width:'+((sg[1]-sg[0])/span*100)+'%"></i>').join('')+'</span><span class="sr">'+r.segs.map(sg=>'de '+D.dmhm(sg[0])+' a '+(sg[1]===NOW?'agora':D.dmhm(sg[1]))).join('; ')+'</span></td></tr>' }).join('')
    +'</tbody><tfoot><tr><th scope="row">'+F.plural(sum.total.images,'imagem','imagens')+'</th><td class="n">'+sum.total.durText+'</td><td class="n">'+sum.total.passes+'</td><td class="n nm">'+sum.total.rateText+'</td><td class="wide"></td></tr></tfoot></table></div>'
    +'<p class="src isum-n">Passagem é cada período em que a imagem esteve no ar. O tempo é aproximado ao décimo de dia. A média usa só as passagens de 1 dia ou mais (as que têm média no cartão); imagem sem nenhuma não tem média. Ela junta passagens em idades diferentes do vídeo e inclui dias divididos com outra imagem: serve para localizar cada imagem, não para dizer qual rende mais.</p>';
}

/* ===================== comparação ===================== */
const VERD=[['ganhou','ganhou'],['perdeu','perdeu'],['neutro','neutro'],['inconclusivo','inconclusivo'],['aguardando','aguardando'],['sem-base','sem base']];
const vKey=e=>e.status==='sem-antes'||e.status==='sem-serie'?'sem-base':e.status;
const effLabel=e=>e.status==='aguardando'?'aguardando ('+e.collected+' de 7 dias)':e.label;
/* Pares: com 7 trocas ou mais, uma linha por troca (decisão do autor). Até 6, os botões de par da produção
   (view-model.ts:403-417): a troca e a reversão dela num botão, e as trocas da mesma janela juntas. */
const PAIRS=(function(){
  if(listMode) return CH.map(c=>({k:c.id,label:c.label,group:[c],e:HM.effect(c.id),e2:null,labs:null}));
  const used=new Set(), ord={title:0,thumb:1,desc:2}, out=[];
  for(const c of v.changes){ if(used.has(c.id)) continue;
    let group=[c];
    if(c.type==='thumb'&&c.revertedBy) group=[c,HM.change(c.revertedBy)]; else c.sameWindow.forEach(id=>{ if(!used.has(id)) group.push(HM.change(id)) });
    group.forEach(x=>used.add(x.id));
    const rev=group.length===2&&group.every(x=>x.type==='thumb'); if(!rev) group.sort((a,b)=>ord[a.type]-ord[b.type]);
    out.push({k:group[0].id,group,e:HM.effect(group[0].id),e2:rev?HM.effect(group[1].id):null,labs:rev?group.map(x=>x.from.label+' → '+x.to.label):null,
      label:rev?'Thumbnail '+group[0].from.label+' → '+group[0].to.label+' → '+group[1].to.label:group.map(x=>x.label).join(' + ')+(group.length>1?' (mesma janela)':'')});
  }
  return out;
})();
const pairByKey=k=>PAIRS.find(p=>p.k===k)||null, pairOfChange=id=>PAIRS.find(p=>p.group.some(c=>c.id===id))||null;
const visPairs=()=>PAIRS.filter(p=>p.group.some(c=>c.at>=rangeT0()));
const matches=(p,field,verd)=>(field==='all'||p.group[0].type===field)&&(verd==='all'||vKey(p.e)===verd);
const filteredPairs=()=>listMode?visPairs().filter(p=>matches(p,S.fField,S.fVerdict)):visPairs();
const defaultPair=()=>{ const vis=filteredPairs(); return (vis.find(p=>['neutro','ganhou','perdeu'].includes(p.e.status))||vis[0]||{}).k||null };
function labelReason(label,reason){ const r=reason.trim(), l=label.toLowerCase(); let out;
  if(r.toLowerCase().startsWith(l+':')) out=label+' — '+F.lcfirst(r.slice(l.length+1).trim());
  else if(r.toLowerCase().startsWith(l+' ')||r.toLowerCase().startsWith(l+',')) out=F.lcfirst(r);
  else if(/ — |: /.test(r)) out=label+'. '+cap(r); else out=label+' — '+F.lcfirst(r);
  return cap(out) }
function effText(e){ return e.status==='aguardando'?e.waitText:e.status==='sem-antes'||e.status==='sem-serie'?labelReason(e.label,e.reason):endDot(cap(e.label)+'. '+cap(e.reason)) }
function detailHTML(P){
  const c=P.group[0], last=P.group[P.group.length-1], e=P.e, o=HM.FEM[c.type]?'a':'o'; let h='';
  if(P.e2){
    const s3=(t,lbl)=>'<div class="side solo">'+thumbBox(t)+'<div class="lbl">'+lbl+'</div></div>';
    const va=VER.thumb[c.idx-1], vb=VER.thumb[c.idx], vc=VER.thumb[last.idx];
    h+='<div class="ba three">'+s3(va,va.label+' até '+c.whenText)+'<span class="arr" aria-hidden="true">→</span>'+s3(vb,vb.label+' por '+D.dur(c.nextLivedMs))+'<span class="arr" aria-hidden="true">→</span>'+s3(vc,vc.label+' de volta em '+D.dmhm(last.at))+'</div>';
  } else if(c.type!=='desc'){
    const pre=(c.window?c.window[0]:c.at)-60e3, post=Math.max(...P.group.map(x=>x.at))+60e3, tb=versionAt('thumb',pre), ta=versionAt('thumb',post), Tb=versionAt('title',pre), Ta=versionAt('title',post);
    const side=(t,T,word)=>'<div class="side">'+thumbBox(t)+'<div><div class="lbl">'+word+' ('+T.label+', thumbnail '+t.label+')</div><div class="ttl">'+esc(T.text)+'</div></div></div>';
    h+='<div class="ba">'+side(tb,Tb,'Antes')+'<span class="arr" aria-hidden="true">→</span>'+side(ta,Ta,'Depois')+'</div>';
  }
  if(e.observed==null) h+='<div class="nobase" data-nobase><strong>'+esc(effText(e))+'</strong></div>';
  else {
    const hasBase=e.expected!=null, q1=hasBase?Math.min(e.iqr[0],e.iqr[1]):null, q3=hasBase?Math.max(e.iqr[0],e.iqr[1]):null;
    const vals=[e.observed,0].concat(hasBase?[e.expected,q1,q3]:[]).map(x=>x*100), lo=Math.floor((Math.min(...vals)-6)/5)*5, hi=Math.ceil((Math.max(...vals)+6)/5)*5, pos=x=>((x*100-lo)/(hi-lo))*100;
    const cav=P.group.some(x=>x.testCompare&&(x.immediate||x.revertedImmediate))?['Alternância compatível com Testar e comparar (teste A/B do YouTube), não confirmada: o YouTube não informa o teste nem o vencedor.']:[];
    h+='<div class="cmp"><div>'
      +'<p class="what"><b>'+esc(P.e2?'Thumbnail '+P.labs[0]:P.label)+'</b>, '+c.whenText+' ('+(c.window?'vist'+o+' pela 1ª vez ':'trocad'+o+' ')+c.agoShort+')</p>'
      +'<div class="big"><span class="n">'+F.num(e.beforeAvg)+'</span><span class="arr" aria-hidden="true">→</span><span class="n">'+F.num(e.afterAvg)+'</span><span class="u">média de views/dia</span></div>'
      +'<div class="src" style="margin-top:6px">antes: '+F.plural(e.beforeDays,'dia','dias')+'; depois: '+F.plural(e.afterDays,'dia','dias')+'; o dia da troca fica de fora</div>'
      +'<div class="vd" data-verdict="'+e.status+'">'+(IC[e.status]||'')+e.label+'</div></div><div>'
      +'<p class="verdict"><strong>'+(hasBase?cap(e.numbersFlat):'Observado '+F.pct(e.observed)+'; '+e.noBaseText)+'.</strong> '+esc(effText(e))+(e.status==='neutro'?' Não dá para dizer que a troca ajudou ou atrapalhou.':'')+'</p>'
      +'<div class="scale" role="img" aria-label="'+(hasBase?'Observado '+F.pct(e.observed)+', esperado '+F.pct(e.expected)+', faixa normal de '+F.pct(q1)+' a '+F.pct(q3):'Observado '+F.pct(e.observed))+'"><div class="axis"></div>'
      +(hasBase?'<div class="iqr" style="left:'+pos(q1)+'%;width:'+Math.max(.6,pos(q3)-pos(q1))+'%"></div><div class="med" style="left:'+pos(e.expected)+'%"></div>':'')
      +'<div class="obs" style="left:'+pos(e.observed)+'%"></div>'
      +(hasBase?'<span class="lb" style="left:0;top:-2px">faixa normal '+F.pct(q1)+' a '+F.pct(q3)+', esperado '+F.pct(e.expected)+'</span>':'')
      +'<span class="lb" style="left:'+Math.min(85,Math.max(15,pos(e.observed)))+'%;top:42px;transform:translateX(-50%);color:var(--text)">observado '+F.pct(e.observed)+'</span>'
      +'<span class="lb lbr" style="right:0;top:-2px">escala '+F.pct(lo/100)+' a '+F.pct(hi/100)+'</span><span class="zero" style="left:'+pos(0)+'%" aria-hidden="true"></span></div>'
      +(hasBase?'<div class="src">Faixa normal: metade dos outros vídeos longos de '+esc(ch.name)+' ficou entre '+F.pct(q1)+' e '+F.pct(q3)+' na mesma idade ('+e.band+' em '+D.dm(c.at)+'; n = '+e.n+', sem contar este vídeo; método: '+e.method+').</div>':'')
      +(P.e2?'<p class="verdict"><strong>'+P.labs[1]+':</strong> '+(P.e2.observed!=null?P.e2.numbersFlat+'. ':'')+esc(P.e2.status==='aguardando'?P.e2.waitText:labelReason(P.e2.label,P.e2.reason))+'</p>':'')
      +(cav.length?'<ul class="caveats">'+cav.map(t=>'<li>'+IC.warn+'<span>'+t+'</span></li>').join('')+'</ul>':'')
      +'</div></div>';
  }
  const runs=[...new Map(P.group.filter(x=>x.testRun&&!S.unknown).map(x=>[x.testRun.id,x.testRun])).values()];
  runs.forEach(r=>{ h+='<p class="seqline">'+IC.ab+'<span>'+cap(HM.runCardText(r))+'. '+HM.RUN_CAVEAT+'</span></p>' });     // F4 item 6
  if(c.type==='desc') h+='<p class="src"><a class="inl" href="#descSec" id="descLink">Ver comparação linha a linha</a></p>';
  return h;
}
function renderCompare(){
  const all=visPairs(), headEl=$('#cmpHead'), body=$('#cmpBody'), count=$('#cmpCount');
  const head='<div class="sec-h"><h3 id="cmph">Antes e depois de cada troca</h3><span class="src">média de views/dia, '+R.effect.afterDays+' dias depois contra até '+R.effect.maxBeforeDays+' dias antes, ajustada pela idade</span></div>'
    +(arrivedId&&S.pair&&pairByKey(S.pair)&&pairByKey(S.pair).group.some(c=>c.id===arrivedId)?'<p class="arrive"><b>Aberta pela aba Trocas do canal:</b> '+esc(HM.change(arrivedId).label)+', '+whenOf(HM.change(arrivedId))+'.</p>':'');
  if(!CH.length){ headEl.innerHTML=head; count.textContent=''; body.innerHTML='<div class="nobase" style="margin-top:12px"><strong>Nada para comparar: nenhuma troca registrada.</strong>Se o canal trocar título, thumbnail ou descrição, a troca aparece na curva acima e entra em Mudanças.</div>'; return }
  if(!listMode){   // até 6 trocas: os botões de par da tela de hoje, sem nada novo
    headEl.innerHTML=head; count.textContent='';
    if(!all.length){ body.innerHTML='<div class="nobase" style="margin-top:12px"><strong>Nenhuma troca neste período.</strong></div>'; S.pair=null; return }
    if(!all.some(p=>p.k===S.pair)) S.pair=defaultPair();
    body.innerHTML='<div class="pairs" role="group" aria-label="Escolher troca">'+all.map(p=>'<button class="pair" type="button" aria-pressed="'+(p.k===S.pair)+'" data-k="'+p.k+'">'+(IC[p.e.status]||'')
      +esc(p.e2?'Thumbnail '+p.labs[0]+': '+effLabel(p.e)+' · '+p.labs[1]+': '+effLabel(p.e2):p.label+': '+effLabel(p.e))+'</button>').join('')+'</div>'+detailHTML(pairByKey(S.pair));
    return;
  }
  /* F4 item 5: os botões de par viram lista filtrável por campo e por situação */
  const vis=filteredPairs(), cnt={}, kinds={};
  all.forEach(p=>{ const k=vKey(p.e); cnt[k]=(cnt[k]||0)+1; if(p.e.status==='inconclusivo') kinds[p.e.kind]=(kinds[p.e.kind]||0)+1 });
  // cada situação pelo nome; "veredito" fica só para ganhou e perdeu
  const partsTxt=[cnt.ganhou?'<b>'+cnt.ganhou+'</b> '+(cnt.ganhou===1?'ganhou':'ganharam'):null, cnt.perdeu?'<b>'+cnt.perdeu+'</b> '+(cnt.perdeu===1?'perdeu':'perderam'):null,
    cnt.neutro?'<b>'+cnt.neutro+'</b> '+(cnt.neutro===1?'neutra':'neutras'):null,
    cnt.inconclusivo?'<b>'+cnt.inconclusivo+'</b> '+(cnt.inconclusivo===1?'inconclusiva':'inconclusivas')+' ('+Object.keys(HM.KIND_SHORT).filter(k=>kinds[k]).map(k=>kinds[k]+' por '+HM.KIND_SHORT[k]).join('; ')+')':null,
    cnt.aguardando?'<b>'+cnt.aguardando+'</b> aguardando os '+R.effect.afterDays+' dias':null, cnt['sem-base']?'<b>'+cnt['sem-base']+'</b> sem base':null].filter(Boolean);
  const verdicts=(cnt.ganhou||0)+(cnt.perdeu||0), scope=cut()?' no período':'';
  const fBtn=(grp,id,label,n,icon)=>'<button type="button" data-flt="'+grp+'" data-v="'+id+'" aria-pressed="'+((grp==='field'?S.fField:S.fVerdict)===id)+'">'+(icon||'')+label+'<span class="c" aria-hidden="true">'+n+'</span><span class="sr">, '+F.plural(n,'troca','trocas')+'</span></button>';
  const nField=f=>all.filter(p=>matches(p,f,S.fVerdict)).length, nVerd=k=>all.filter(p=>matches(p,S.fField,k)).length;
  const verdOpts=VERD.filter(([k])=>k!=='sem-base'||cnt['sem-base']);
  headEl.innerHTML=head
    +'<p class="cmp-sum">'+F.plural(all.length,'troca','trocas')+scope+': '+(partsTxt.join(', ')||'nenhuma')+'. '+(verdicts?'':'Nenhuma ganhou ou perdeu. ')
    +(all.length?'Uma troca só é medida com '+R.effect.afterDays+' dias sem outra troca do vídeo depois dela e pelo menos '+R.effect.minBeforeDays+' antes.':'')+'</p>'
    +'<div class="flt"><div class="flt-g" role="group" aria-labelledby="fl1"><span class="flt-l" id="fl1">Campo</span><div class="seg">'
      +fBtn('field','all','Todos',nField('all'))+TYPES.map(t=>fBtn('field',t,TYPE[t].n,nField(t),'<i style="width:7px;height:7px;border-radius:2px;background:'+TYPE[t].c+'" aria-hidden="true"></i>')).join('')+'</div></div>'
    +'<div class="flt-g" role="group" aria-labelledby="fl2"><span class="flt-l" id="fl2">Situação</span><div class="seg">'
      +fBtn('verdict','all','Todas',nVerd('all'))+verdOpts.map(([k,l])=>fBtn('verdict',k,l,nVerd(k),IC[k==='sem-base'?'sem-antes':k])).join('')+'</div></div></div>';
  let status;
  if(!vis.length){
    const fName=S.fField==='all'?'':' de '+HM.TYPE_NAME[S.fField], vName=S.fVerdict==='all'?'':' na situação “'+VERD.find(x=>x[0]===S.fVerdict)[1]+'”';
    const others=[], nF=all.filter(p=>p.group[0].type===S.fField).length, nV=all.filter(p=>vKey(p.e)===S.fVerdict).length;
    if(S.fField!=='all'&&S.fVerdict!=='all'){ if(nF) others.push(F.plural(nF,'troca','trocas')+fName+' em outras situações'); if(nV) others.push(F.plural(nV,'troca','trocas')+vName+' em outros campos') }
    status=(all.length?'Nenhuma troca'+fName+vName+scope+'.':'Nenhuma troca neste período.')+(others.length?' Há '+others.join(' e ')+'.':'');
    body.innerHTML='<div class="cmpx"><div class="nobase cmp-empty" id="cmpEmpty"><strong>'+esc(status)+'</strong><button class="btn" type="button" id="fltClear">'+(all.length?'Limpar filtros':'Mostrar o vídeo inteiro')+'</button></div></div>';
    S.pair=null;
  } else {
    if(!vis.some(p=>p.k===S.pair)) S.pair=defaultPair();
    const sel=pairByKey(S.pair);
    status='Mostrando '+vis.length+' de '+F.plural(all.length,'troca','trocas')+scope+(cut()?' ('+PAIRS.length+' no vídeo inteiro)':'')+'. A lista rola; as setas andam e Enter escolhe. Selecionada: '+sel.label+'.';
    body.innerHTML='<div class="cmpx"><ul class="clist" id="clist" role="listbox" aria-label="Trocas, da mais recente para a mais antiga" aria-controls="cdet">'
      +vis.map(p=>{ const c=p.group[0], e=p.e, on=p.k===S.pair; return '<li role="option" aria-selected="'+on+'" tabindex="'+(on?0:-1)+'" data-k="'+p.k+'" data-st="'+e.status+'">'+(IC[e.status]||'')
        +'<span class="l1">'+esc(p.label)+'<span class="sr">, </span></span><span class="dt">'+whenOf(c)+'<span class="sr">, </span></span><span class="l2">'+esc(HM.statusLine(e))+'</span></li>' }).join('')
      +'</ul><div class="cdet" id="cdet" role="region" aria-label="Troca selecionada">'+detailHTML(sel)+'</div></div>';
    // a troca selecionada fica à vista dentro da lista (rola só a lista, nunca a página)
    const l=$('#clist'), s=l.querySelector('[aria-selected="true"]'), d=s.getBoundingClientRect().top-l.getBoundingClientRect().top;
    if(d<0||d>l.clientHeight-s.offsetHeight) l.scrollTop+=d-Math.min(60,l.clientHeight/3);
  }
  count.textContent=status;     // o MESMO nó sempre: região viva anuncia a mudança
}
function selectPair(k,opts){
  opts=opts||{};
  if(listMode&&!filteredPairs().some(p=>p.k===k)){ S.fField='all'; S.fVerdict='all' }
  S.pair=k; renderCompare(); renderChart(); renderLegend(); markPair();
  if(opts.scroll){ $('#compare').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
    setTimeout(()=>{ const t=listMode?document.querySelector('#clist [aria-selected="true"]'):document.querySelector('#compare .pair[aria-pressed="true"]'); if(t){ t.focus({preventScroll:true}); if(listMode) t.scrollIntoView({block:'nearest'}) } },0) }
}

/* ===================== leitura da forja (sem mudança na Fase 4) ===================== */
function renderForja(){
  /* rodada 3: o cartão da forja com as situações da §7.2 (forja.js). A leitura de exemplo é escrita para o mockup. */
  FJ.montar($('#forjaMount'),()=>({escopo:'video',v:window.CANAL.porId(v.id),href:hrefEv,hrefTrocas:()=>'canal.html'+(location.protocol==='file:'?'#tab=trocas':'?tab=trocas')}));
}
function hrefEv(videoId,trocaMs){
  if(videoId===v.id) return '#'+(trocaMs?'troca-'+trocaMs:'leitura');
  const u=new URLSearchParams(); u.set('id',videoId); u.set('from','canais'); u.set('canal',window.CANAL.canal.id); u.set('back',back); if(trocaMs) u.set('troca',trocaMs);
  return 'video.html?'+u.toString();
}

/* ===================== versões ===================== */
function runNote(type){
  const rs=runsOf(type); if(!rs.length) return '';
  const when=r=>type==='thumb'?(r.open?'desde '+D.dmhm(r.from)+'; a mais recente em '+D.dmhm(r.to):'de '+D.dmhm(r.from)+' a '+D.dmhm(r.to))
    :(r.open?'vistas desde '+D.dm(r.from)+'; a mais recente em '+D.dm(r.to):'vistas de '+D.dm(r.from)+' a '+D.dm(r.to));
  return '<div class="note seq"><span style="color:'+TYPE[type].c+'">'+IC.ab+'</span><div><ul>'+rs.map(r=>'<li><b>'+cap(HM.runText(r))+'</b> ('+when(r)+').</li>').join('')
    +'</ul><span>Chamamos de trocas em sequência as trocas de '+HM.TYPE_NAME[type]+' com até '+R.testRunGapDays+' dias entre uma e outra. '+HM.RUN_CAVEAT+'</span></div></div>';
}
function renderThumbs(){
  const all=VER.thumb, vis=visVer('thumb'), distinct=new Set(all.map(t=>t.key)).size;
  const collapsed=vis.length>R.collapseAbove&&!S.expanded, hiddenN=collapsed?vis.length-R.collapseAbove:0;
  let h='<div class="sec-h"><h3 id="thh">Thumbnails</h3><span class="src">'+(all.length>1?distinct+' imagens em '+all.length+' períodos, em ordem'+(cut()?'; mostrando '+vis.length+' de '+all.length+'. Cada cartão traz o período inteiro da versão, mesmo a parte fora do filtro':''):'sem troca vista')+'</span></div>';
  // nota de produção (view-model.ts:574), só quando é verdade: a primeira alternância A → B → A com volta IMEDIATA em até 14 dias.
  // A fórmula de produção escreve "antes → depois → antes" mesmo quando a imagem que volta é outra (LEIAME, C16).
  const tc=v.changes.find(c=>c.type==='thumb'&&c.testCompare&&c.revertedBy&&c.revertedImmediate&&c.at>=rangeT0());
  if(tc) h+='<div class="note"><span style="color:var(--t-thumb)">'+IC.ab+'</span><span>'+tc.from.label+' → '+tc.to.label+' → '+tc.from.label+' em '+D.dur(tc.cycleMs)+': alternância típica do Testar e comparar (teste A/B do YouTube). Compatível, não confirmado — o YouTube não informa o teste nem o vencedor.</span></div>';
  h+=runNote('thumb');
  if(vis.length>R.collapseAbove)   /* F4 item 2 */
    h+='<div class="more-row"><button class="btn" type="button" id="moreBtn" aria-expanded="'+S.expanded+'" aria-controls="film">'+IC.chev+(S.expanded?'Mostrar só as '+R.collapseAbove+' mais recentes':'Ver todas ('+vis.length+')')+'</button>'
      +'<span class="src">'+(S.expanded?'mostrando os '+vis.length+' períodos'+(cut()?' do período':''):'mostrando os '+R.collapseAbove+' períodos mais recentes de '+vis.length+(cut()?' do período':''))+'</span><span class="src" id="hlNote" role="status"></span></div>';
  h+='<div class="film" id="film">'+vis.map((t,j)=>'<div class="fcard" role="group" aria-label="Thumbnail '+t.label+', '+esc(t.span)+'" data-ver="thumb:'+t.i+'" data-img="'+t.label+'" tabindex="-1"'+(collapsed&&j<hiddenN?' hidden':'')+'>'+thumbBox(t)
    +'<div class="meta"><div class="vt"><span>Versão '+t.label+'</span>'+(t.tag?'<span class="tag '+t.tag.kind+'">'+t.tag.text+'</span>':'')+'</div><span class="mono">'+esc(cap(t.span))+'</span><span>no ar por '+t.dur+'</span><span>média de views/dia: '+t.rate+'</span></div></div>').join('')+'</div>';
  if(!vis.length) h+='<p class="src" style="margin-top:10px">Nenhum período de thumbnail neste intervalo.</p>';
  $('#thumbsSec').innerHTML=h;
}
/* comparação de palavras do título: o que entrou fica marcado; o que saiu vai para a linha de baixo */
function lcs(a,b){ const m=a.length,n=b.length,t=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=m-1;i>=0;i--) for(let j=n-1;j>=0;j--) t[i][j]=a[i]===b[j]?t[i+1][j+1]+1:Math.max(t[i+1][j],t[i][j+1]);
  const out=[]; let i=0,j=0; while(i<m&&j<n){ if(a[i]===b[j]){ out.push(['k',a[i]]); i++; j++ } else if(t[i+1][j]>=t[i][j+1]){ out.push(['r',a[i]]); i++ } else { out.push(['a',b[j]]); j++ } }
  while(i<m) out.push(['r',a[i++]]); while(j<n) out.push(['a',b[j++]]); return out }
function titleDiff(a,b){ const d=lcs(a.split(' '),b.split(' ')); let h='', run=[]; const flush=()=>{ if(run.length){ h+='<ins>'+esc(run.join(' '))+'</ins> '; run=[] } };
  d.forEach(([op,w])=>{ if(op==='a') run.push(w); else if(op==='k'){ flush(); h+=esc(w)+' ' } }); flush();
  const gone=d.filter(x=>x[0]==='r').map(x=>x[1]);
  return h.trim()+(gone.length?'<span class="gone">saiu: '+gone.map(w=>'<del>'+esc(w)+'</del>').join(', ')+'</span>':'') }
function renderTitles(){
  const all=VER.title, vis=visVer('title');
  $('#titlesSec').innerHTML='<div class="sec-h"><h3 id="tih">Títulos</h3><span class="src">'+(all.length>1?'trechos alterados contra o anterior'+(cut()?'; mostrando '+vis.length+' de '+all.length:''):'sem troca vista')+'</span></div>'
    +(all.length>1?'':'<p class="src" style="margin:8px 0 0">Mesmo título desde a publicação.</p>')
    +runNote('title')
    +'<ol class="tlist">'+vis.map(t=>'<li data-ver="title:'+t.i+'" tabindex="-1"><span class="id">'+t.label+'</span><span class="txt">'+(t.i?titleDiff(all[t.i-1].text,t.text):esc(t.text))+'</span>'
      +'<span class="m"><span>'+esc(cap(t.span))+'</span><span>no ar por '+t.dur+'</span><span>média de views/dia: '+t.rate+'</span>'+(t.cur?'<span style="color:var(--success)">no ar</span>':'')+'</span></li>').join('')+'</ol>';
}
function lineDiff(a,b){ const d=lcs(a,b), rows=[]; for(let i=0;i<d.length;i++){ const [op,t]=d[i], nx=d[i+1];
    if(op==='r'&&nx&&nx[0]==='a'&&nx[1].startsWith(t)&&/^[?&]utm_/.test(nx[1].slice(t.length))){ rows.push({kind:'utm',from:t,extra:nx[1].slice(t.length)}); i++ }
    else rows.push({kind:op==='k'?'ctx':op==='a'?'add':'rem',text:t}) }
  return rows }
function renderDescs(){
  if(v.descUnknown){ $('#descSec').innerHTML='<div class="sec-h"><h3 id="deh" tabindex="-1">Descrições</h3><span class="src">texto não exportado</span></div><p class="src" style="margin-top:10px">O texto da descrição não foi exportado para este mockup, então não há como dizer se ela mudou. A raia D1 mostra só que existe uma versão no ar desde a publicação.</p>'; return }
  const all=VER.desc, vis=visVer('desc');
  let h='<div class="sec-h"><h3 id="deh" tabindex="-1">Descrições</h3><span class="src">'+(all.length<2?'sem troca vista':'comparação linha a linha'+(cut()?'; mostrando '+vis.length+' de '+all.length:''))+'</span></div>'
    +'<div class="dver">'+vis.map(d=>'<div data-ver="desc:'+d.i+'" tabindex="-1"><span><b>'+d.label+'</b>'+esc(cap(d.span))+'</span><span>no ar por '+d.dur+(d.cur?' <span style="color:var(--success)">no ar</span>':'')+'</span></div>').join('')+'</div>';
  if(all.length<2) h+='<p class="src" style="margin-top:10px">Mesma descrição desde a publicação.</p>';
  vis.filter(d=>d.i>0&&d.start>=rangeT0()).forEach(d=>{ const rows=lineDiff(all[d.i-1].lines,d.lines), add=rows.filter(r=>r.kind==='add').length, rem=rows.filter(r=>r.kind==='rem').length, utm=rows.filter(r=>r.kind==='utm').length, k=d.i;
    h+='<div><div class="dhead"><span class="dsum">'+all[d.i-1].label+' → '+d.label+': +'+add+' −'+rem+' '+(add+rem===1?'linha':'linhas')+(utm?', '+F.plural(utm,'mudança só de link/UTM','mudanças só de link/UTM'):'')+'</span>'
      +(utm?'<label class="toggle"><input type="checkbox" checked data-noise="'+k+'">Ocultar mudanças só de link/UTM</label>':'')+'</div>'
      +'<details class="expander" open><summary class="src">Ver a comparação linha a linha</summary><div class="diff" id="diff'+k+'">'
      +rows.map(r=>r.kind==='utm'?'<div class="ln rem noise"><span aria-hidden="true">−</span><span><span class="sr">removida: </span>'+esc(r.from)+'</span></div><div class="ln add noise"><span aria-hidden="true">+</span><span><span class="sr">adicionada: </span>'+esc(r.from)+'<span class="utm">'+esc(r.extra)+'</span></span></div>'
        :r.kind==='ctx'?'<div class="ln ctx"><span aria-hidden="true"></span><span>'+esc(r.text)+'</span></div>'
        :'<div class="ln '+r.kind+'"><span aria-hidden="true">'+(r.kind==='add'?'+':'−')+'</span><span><span class="sr">'+(r.kind==='add'?'adicionada':'removida')+': </span>'+esc(r.text)+'</span></div>').join('')
      +(utm?'<div class="fold" data-utmnote>'+F.plural(utm,'mudança só de link/UTM oculta','mudanças só de link/UTM ocultas')+'</div>':'')+'</div></details></div>' });
  $('#descSec').innerHTML=h;
}

/* ===================== navegação entre faixa e versões ===================== */
function goVersion(key){
  let t=document.querySelector('[data-ver="'+key+'"]');
  if(t&&t.hidden){ S.expanded=true; renderThumbs(); applyHl(); t=document.querySelector('[data-ver="'+key+'"]') }     // F4 item 2: expande antes de rolar
  if(!t) return;
  $$('.target').forEach(x=>x.classList.remove('target'));
  t.classList.add('target');                                              // anel próprio do destino, até o foco sair
  t.addEventListener('blur',()=>t.classList.remove('target'),{once:true});
  t.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'}); t.focus({preventScroll:true});
}

/* ===================== dica (não interativa; fecha com Esc de qualquer lugar; abre para cima, sobre o gráfico) ===================== */
function showTip(btn){
  const tip=$('#tip'); let html, color;
  if(btn.dataset.tip){   // grupo: resumo do que há dentro e como abrir
    const d=btn.dataset, T=TYPE[d.type]; color=T.c;
    html=d.tip==='p'?'<h4>'+d.unit+(d.type==='thumb'?' de thumbnail':'')+'</h4><p class="when">de '+d.from+' até '+d.to+'</p><div class="seq">'+esc(d.seq)+'</div>'
      :'<h4>'+d.n+' trocas de '+HM.TYPE_NAME[d.type]+'</h4><p class="when">entre '+d.from+' e '+d.to+'</p>';
    html+='<p class="hint">Enter, espaço ou clique abre a lista.</p>';
  } else {
    const c=HM.change(btn.dataset.pair), o=HM.FEM[c.type]?'a':'o'; color=TYPE[c.type].c;
    html='<h4>'+TYPE[c.type].n+': '+c.from.label+' → '+c.to.label+'</h4><p class="when">'+(c.window?c.whenText+' (janela de 6 h), vist'+o+' pela 1ª vez '+c.agoShort:c.whenText+', horário exato, trocad'+o+' '+c.agoShort)+'</p>'
      +(c.type==='title'?'<div class="bef">'+esc(c.from.text)+'</div><div class="aft">'+esc(c.to.text)+'</div>'
        :c.type==='thumb'?'<div class="thpair"><div class="th'+miss(c.from.key)+'">'+imgOf(c.from.key,140,79,'Thumbnail '+c.from.label)+'</div><span aria-hidden="true">→</span><div class="th'+miss(c.to.key)+'">'+imgOf(c.to.key,140,79,'Thumbnail '+c.to.label)+'</div></div>'+(c.revertTo?'<p class="when" style="margin:6px 0 0">Voltou para a versão '+c.revertTo+' (mesma imagem).</p>':'')
        :'<div class="aft">A descrição mudou. Comparação linha a linha em Descrições, abaixo.</div>');
  }
  tip.style.setProperty('--c',color); tip.innerHTML=html; tip.classList.add('show');
  const w=$('#tlwrap').getBoundingClientRect(), b=btn.getBoundingClientRect(), th=tip.offsetHeight, tw=tip.offsetWidth;
  tip.style.left=Math.max(4,Math.min(w.width-tw-4,b.left-w.left+b.width/2-tw/2))+'px';
  tip.style.top=Math.max(0,b.top-w.top-th-6)+'px';                        // acima do alvo: nunca cobre as faixas de baixo
}
const hideTip=()=>$('#tip').classList.remove('show');

/* ===================== grupos (faixas densas) ===================== */
function setGroup(w,on){
  w.classList.toggle('open',on); w.querySelector('.gbtn').setAttribute('aria-expanded',on);
  if(on){ hideTip(); const pop=w.querySelector('.gpop'); pop.style.left='0px'; if(w.classList.contains('mg')) pop.style.top='26px';
    const pr=pop.getBoundingClientRect(), tr=$('#tlwrap').getBoundingClientRect(), over=pr.right-tr.right+4;
    if(over>0) pop.style.left=(-over)+'px'; const under=tr.left+4-(pr.left-Math.max(0,over)); if(under>0) pop.style.left=(parseFloat(pop.style.left)+under)+'px'; }
}
const closeGroups=except=>$$('#lanes .gwrap.open').forEach(x=>{ if(x!==except) setGroup(x,false) });
function wireLanes(){
  const tl=$('#tlwrap');
  const hint=(e,on)=>{
    const b=e.target.closest('.mk,.gbtn'); if(b){ if(on&&!(b.classList.contains('gbtn')&&b.closest('.gwrap').classList.contains('open'))) showTip(b); else hideTip() }
    const mk=e.target.closest('.mk'); if(mk){ const c=HM.change(mk.dataset.pair); S.hover=on?{type:c.type,i:c.idx,label:c.type==='thumb'?c.to.label:null,ev:c.idx}:null; applyHl() }
    const cl=e.target.closest('.clip[data-k]'); if(cl){ S.hover=on?hlOfKey(cl.dataset.k):null; applyHl() }
  };
  tl.addEventListener('mouseover',e=>hint(e,true)); tl.addEventListener('mouseout',e=>hint(e,false));
  tl.addEventListener('focusin',e=>hint(e,true));
  tl.addEventListener('focusout',e=>{ hint(e,false); const w=e.target.closest('.gwrap'); if(w&&!w.contains(e.relatedTarget)) setGroup(w,false) });
  tl.addEventListener('click',e=>{
    const go=e.target.closest('[data-go]'); if(go){ closeGroups(); goVersion(go.dataset.go); return }
    const pr=e.target.closest('.gpop [data-pair],.mk[data-pair]'); if(pr){ hideTip(); closeGroups(); selectPair(pairOfChange(pr.dataset.pair).k,{scroll:true}); return }
    const gb=e.target.closest('.gbtn'); if(gb){ const w=gb.closest('.gwrap'), on=!w.classList.contains('open'); closeGroups(w); setGroup(w,on); return }   // Enter, espaço e clique: abre e fecha
    const cl=e.target.closest('.clip[data-k]'); if(cl) goVersion(cl.dataset.k);
  });
  // cada faixa é uma parada de Tab: setas, Home e End andam entre períodos e trocas, em ordem de tempo
  tl.addEventListener('keydown',e=>{
    const it=e.target.closest('.ln-i'); if(!it) return;
    const all=[...it.closest('.lane').querySelectorAll('.ln-i')], k=all.indexOf(it); let n=null;
    if(e.key==='ArrowRight') n=all[Math.min(all.length-1,k+1)]; else if(e.key==='ArrowLeft') n=all[Math.max(0,k-1)]; else if(e.key==='Home') n=all[0]; else if(e.key==='End') n=all[all.length-1];
    if(n){ e.preventDefault(); const w=it.closest('.gwrap'); if(w) setGroup(w,false); all.forEach(x=>x.tabIndex=-1); n.tabIndex=0; n.focus() }
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.gwrap')) closeGroups() });
}

/* ===================== ligações do resto da tela ===================== */
function refreshCompare(){ renderCompare(); renderChart(); renderLegend(); markPair() }
function wire(){
  wireLanes();
  const scr=$('#screen');
  // Esc, de qualquer lugar: fecha a dica, fecha a lista de um grupo (e devolve o foco ao contador), solta a imagem fixada
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    const tipOn=$('#tip').classList.contains('show'), open=$$('#lanes .gwrap.open');
    hideTip();
    open.forEach(w=>{ const had=w.contains(document.activeElement); setGroup(w,false); if(had) w.querySelector('.gbtn').focus() });
    if(!tipOn&&!open.length&&S.pin){ const l=S.pin.label, had=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#isumSec'); S.pin=null; renderSummary(); applyHl(); $('#live').textContent='Destaque solto.';
      if(had){ const nb=document.querySelector('[data-pinimg="'+l+'"]'); if(nb) nb.focus() } }     // o foco volta ao botão que fixou
  });
  scr.addEventListener('click',e=>{
    const rb=e.target.closest('[data-range]'); if(rb){ setRange(rb.dataset.range,true); return }
    if(e.target.closest('#pinBtn')){ S.pinned=!S.pinned; renderHeader(); $('#pinBtn').focus(); $('#live').textContent=S.pinned?'Vídeo fixado.':'Vídeo desafixado.'; aviso(S.pinned?'Vídeo fixado':'Vídeo desafixado'); return }
    if(e.target.closest('#forjaBtn')){ pedirDoCabecalho(); return }
    const pb=e.target.closest('#compare .pair'); if(pb){ selectPair(pb.dataset.k); document.querySelector('#compare .pair[aria-pressed="true"]').focus(); return }
    const fb=e.target.closest('[data-flt]'); if(fb){ const grp=fb.dataset.flt, val=fb.dataset.v; if(grp==='field') S.fField=val; else S.fVerdict=val; refreshCompare();
      const nb=document.querySelector('[data-flt="'+grp+'"][data-v="'+val+'"]'); if(nb) nb.focus(); return }
    if(e.target.closest('#fltClear')){ if(visPairs().length){ S.fField='all'; S.fVerdict='all'; refreshCompare(); const f=document.querySelector('[data-flt="field"][data-v="all"]'); if(f) f.focus() } else setRange('tudo',false); return }
    const li=e.target.closest('#clist li'); if(li){ selectPair(li.dataset.k); const n=document.querySelector('#clist li[data-k="'+li.dataset.k+'"]'); if(n) n.focus({preventScroll:true}); return }
    if(e.target.closest('#descLink')){ e.preventDefault(); $$('#descSec details').forEach(d=>d.open=true); const h=$('#deh'); h.focus(); h.scrollIntoView({block:'start'}); return }
    if(e.target.closest('#moreBtn')){ S.expanded=!S.expanded; renderThumbs(); applyHl(); $('#moreBtn').focus(); return }
    const pi=e.target.closest('[data-pinimg]'); if(pi){ const l=pi.dataset.pinimg; S.pin=S.pin&&S.pin.label===l?null:{type:'thumb',label:l}; renderSummary(); applyHl(); const nb=document.querySelector('[data-pinimg="'+l+'"]'); if(nb) nb.focus();
      $('#live').textContent=S.pin?'Imagem '+l+' fixada no destaque. Esc solta.':'Destaque solto.'; return }
  });
  scr.addEventListener('change',e=>{ const n=e.target.closest('[data-noise]'); if(n){ const d=$('#diff'+n.dataset.noise); d.classList.toggle('shownoise',!n.checked); const f=d.querySelector('[data-utmnote]'); if(f) f.hidden=!n.checked } });
  // lista de trocas: uma parada de Tab; setas, Home, End e PageUp/PageDown andam; Enter ou espaço escolhe
  scr.addEventListener('keydown',e=>{
    const li=e.target.closest('#clist li'); if(!li) return;
    const items=$$('#clist li'), k=items.indexOf(li), last=items.length-1; let n=null;
    if(e.key==='ArrowDown') n=items[Math.min(last,k+1)]; else if(e.key==='ArrowUp') n=items[Math.max(0,k-1)]; else if(e.key==='Home') n=items[0]; else if(e.key==='End') n=items[last];
    else if(e.key==='PageDown') n=items[Math.min(last,k+5)]; else if(e.key==='PageUp') n=items[Math.max(0,k-5)];
    else if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectPair(li.dataset.k); const x=document.querySelector('#clist li[data-k="'+li.dataset.k+'"]'); if(x) x.focus({preventScroll:true}); return }
    if(n){ e.preventDefault(); items.forEach(x=>x.tabIndex=-1); n.tabIndex=0; n.focus(); }
  });
  // destaque a partir das versões e da linha do resumo (mouse e foco)
  const hov=(e,on)=>{
    const row=e.target.closest('tr[data-row]'); if(row){ S.hover=on?{type:'thumb',label:row.dataset.row}:null; applyHl(); return }
    const ver=e.target.closest('[data-ver]'); if(ver){ S.hover=on?hlOfKey(ver.dataset.ver):null; applyHl() }
  };
  ['isumSec','thumbsSec','titlesSec','descSec'].forEach(id=>{ const el=$('#'+id);
    el.addEventListener('mouseover',e=>hov(e,true)); el.addEventListener('mouseout',e=>hov(e,false)); el.addEventListener('focusin',e=>hov(e,true)); el.addEventListener('focusout',e=>hov(e,false)) });
  let raf=0, lastW=0;
  new ResizeObserver(()=>{ const w=$('#tlwrap').clientWidth; if(w===lastW) return; lastW=w; cancelAnimationFrame(raf); raf=requestAnimationFrame(renderTimeline) }).observe($('#tlwrap'));
}
function setRange(r,keepFocus){
  S.range=r; S.expanded=false;
  const u=new URL(location.href); if(r==='tudo') u.searchParams.delete('range'); else u.searchParams.set('range',r); history.replaceState(null,'',u);
  renderRange(); renderTimeline(); renderSummary(); refreshCompare(); renderThumbs(); renderTitles(); renderDescs(); applyHl();
  if(keepFocus){ const b=document.querySelector('[data-range="'+r+'"]'); if(b) b.focus() }
}

/* ===================== rodada 3: o botão "Pedir leitura à forja" do cabeçalho, a chegada pela aba Trocas, a barra do mockup ===================== */
function pedirDoCabecalho(){
  const sec=$('#forja'); sec.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
  const est=FJ.estado(), pode=['nunca','falhou','travou','semevid'].includes(est);
  setTimeout(()=>{ if(pode) FJ.pedir(); else { const t=$('#fjSit')||sec.querySelector('button'); if(t) t.focus({preventScroll:true}); $('#live').textContent='A leitura da forja já tem uma situação; ela está logo abaixo.' } },reduced()?0:350);
}
let tToast=0;
function aviso(txt){
  let t=document.getElementById('toast'); if(t) t.remove(); clearTimeout(tToast);
  t=document.createElement('div'); t.className='toast'; t.id='toast'; t.setAttribute('role','status');
  t.innerHTML='<span>'+esc(txt)+'</span><button type="button" aria-label="Fechar aviso">'+svg('<path d="M6 6l12 12M18 6L6 18"/>')+'</button>';
  document.body.appendChild(t); t.querySelector('button').onclick=()=>t.remove(); tToast=setTimeout(()=>t.remove(),7000);
}
function faixaSync(){
  $('#faixa').innerHTML=q.get('sync')==='atrasada'?'<div class="band warn" style="margin-bottom:10px">'+IC.warn+'<p><b>Atenção:</b> dados de '+D.dmhm(HM.NOW-34*36e5)+'. A sincronização do canal está atrasada.</p><button type="button" class="btn" data-sync>Sincronizar só este canal</button></div>':'';
}
function mockBar(){
  const e=FJ.estado();
  const bt=x=>'<button type="button" data-leitura="'+x[0]+'" aria-pressed="'+(e===x[0])+'">'+x[1]+'</button>';
  $('#mkLeitura').innerHTML=FJ.ESTADOS.map(bt).join(''); $('#mkVar').innerHTML=FJ.VARIANTES.filter(x=>x[0]!=='hoje').map(bt).join('');
  const Cn=window.CANAL, semSerie=(Cn.videos.filter(x=>!x.serie&&x.views!=null&&!x.pinned&&x.pub)[0]||{}).id;
  const casos=[['Com 2 trocas (título e thumbnail)','7Cr3DLfUvW8'],['Troca de título, fixado','cGg6cVAyNPE'],['Só thumbnail trocada','YekRfvf4gz0'],['Troca antes da série (sem série)','Lr0p4pTWuVk'],['Sem troca nenhuma (versão única)','r9KVNPLMZ1c'],['Sem registro diário (fora dos 50)',semSerie],
    ['Fixado antigo','NSj9xiaoqFw'],['Views nulas','NfcuoEnPLig'],['Comentários nulos','vWZkllvlGgw'],['Duração nula','KentO6LP8cM'],['Formato não confirmado','qTOnqtCc7AM'],['Sem data de publicação','MFtD3-KPrP4'],['Short','J6LhvOH3MuQ']];
  $('#mkCasos').innerHTML=casos.filter(c=>c[1]&&Cn.porId(c[1])).map(c=>{ const u=new URLSearchParams(location.search); u.set('id',c[1]); ['troca','ids','i0','tot'].forEach(k=>u.delete(k)); return '<a class="mkb" href="video.html?'+esc(u.toString())+'" aria-current="'+(c[1]===v.id)+'">'+c[0]+'</a>' }).join('');
  const sy=new URLSearchParams(location.search), atr=q.get('sync')==='atrasada'; if(atr) sy.delete('sync'); else sy.set('sync','atrasada');
  $('#mkSync').innerHTML='<a class="mkb" href="video.html?'+esc(sy.toString())+'">'+(atr?'Voltar a em dia':'Sincronização atrasada')+'</a>';
}
$('#mock').addEventListener('click',e=>{ const b=e.target.closest('[data-leitura]'); if(b) FJ.set(b.dataset.leitura) });
document.addEventListener('click',e=>{
  const a=e.target.closest('a[data-nav]'); if(a){ e.preventDefault(); if(a.getAttribute('aria-disabled')!=='true') ir(a.dataset.nav==='ant'?antId:proxId,a.dataset.nav); return }
  if(e.target.closest('[data-sync]')){ aviso('Sincronização iniciada'); return }
  const fn=e.target.closest('.fn[data-video], .evid a[data-video]');
  if(fn&&fn.dataset.video===v.id){ e.preventDefault();
    if(fn.dataset.troca){ const c=v.changes.find(x=>x.at===+fn.dataset.troca); if(c) selectPair(pairOfChange(c.id).k,{scroll:true}) }
    else $('#forja').scrollIntoView({block:'start'}) }
  if(e.target.closest('#crumbCanal')&&veio&&history.length>1){ e.preventDefault(); history.back() }
});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.altKey||e.metaKey) return;
  const a=document.activeElement, ok=a&&(a.id==='h1'||a.closest('#pager')); if(!ok) return;
  if(e.key==='[') ir(antId,'ant'); if(e.key===']') ir(proxId,'prox');
});
FJ.init({say:t=>{ const s=$('#live'); s.textContent=''; setTimeout(()=>s.textContent=t,30) },toast:aviso,
  onChange:e=>{ try{ const u=new URLSearchParams(location.search); if(e==='nunca') u.delete('leitura'); else u.set('leitura',e); history.replaceState(null,'',location.pathname+(u.toString()?'?'+u.toString():'')) }catch(x){} mockBar() }});

/* ===================== montagem ===================== */
document.title='Histórico do vídeo: '+v.title+' — Observatório';
try{ sessionStorage.setItem('pc:ultimo',v.id); sessionStorage.setItem('pc:voltou','1');
  const tp=parseInt(q.get('troca'),10), ch0=v.changes.find(c=>c.at===tp)||null;
  arrivedId=ch0?ch0.id:null;
  const ult=v.changes.length?v.changes.slice().sort((a,b)=>b.at-a.at)[0]:null;
  const guarda=ch0||ult; if(guarda) sessionStorage.setItem('pc:troca',String(guarda.at)); else sessionStorage.removeItem('pc:troca') }catch(x){}
renderCrumbs(); renderHeader(); faixaSync(); renderRange();
S.pair=defaultPair();
if(arrivedId){ const pr=pairOfChange(arrivedId); if(pr) S.pair=pr.k }
FJ.set(FJ.VALIDOS.includes(q.get('leitura'))?q.get('leitura'):'nunca',{silencioso:true});
renderTimeline(); renderSummary(); renderCompare(); renderChart(); renderLegend(); renderForja(); renderThumbs(); renderTitles(); renderDescs(); applyHl();
mockBar();
wire();
/* chegada: com troca na URL, ela fica destacada no gráfico, nas faixas e em "Antes e depois", e o foco vai para a marca dela */
(function chegada(){
  let foco=null; try{ foco=sessionStorage.getItem('pc:foco'); sessionStorage.removeItem('pc:foco') }catch(x){}
  if(foco){ const b=document.querySelector('#pager [data-nav="'+foco+'"]'); if(b) b.focus({preventScroll:true}); setTimeout(()=>{ $('#live').textContent='Vídeo '+pos+' de '+tot+': '+v.title },60); return }
  if(arrivedId){ setTimeout(focoNaTroca,200); return }
  const hs=location.hash.replace('#',''); if(hs==='leitura'||hs==='forja') $('#forja').scrollIntoView({block:'start'});
  else $('#h1').focus({preventScroll:true});
  function focoNaTroca(){
    const c=HM.change(arrivedId), m=document.querySelector('#lanes .mk[data-pair="'+c.id+'"]')||document.querySelector('#lanes .mkg.sel');
    const alvo=m||document.querySelector('#compare .pair[aria-pressed="true"]'); if(!alvo) return;
    alvo.focus({preventScroll:true});
    const r=alvo.getBoundingClientRect(); if(r.top<80||r.bottom>innerHeight-60) alvo.scrollIntoView({block:'center'});
    setTimeout(()=>{ $('#live').textContent='Aberta a troca: '+c.label+', '+whenOf(c)+'. Ela está destacada no gráfico, na faixa e em Antes e depois.' },60);
  }
})();
window.__hv={S,v,HM};
})();
