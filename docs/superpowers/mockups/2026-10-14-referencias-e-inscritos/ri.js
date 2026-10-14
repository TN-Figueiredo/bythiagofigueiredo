(function(){
'use strict';
var q=new URLSearchParams(location.search);
if(q.get('tema')==='claro')document.documentElement.setAttribute('data-theme','light');
var estado=q.get('estado')||'cheio';
var ordR=q.get('ordr')==='faixa'?'faixa':'mediana', ordI=q.get('ordi')==='abs'?'abs':'pct';
var aba=q.get('aba');
if(aba!=='ref'&&aba!=='ins'){try{aba=localStorage.getItem('ri-aba')}catch(e){aba=null}}
if(aba!=='ref'&&aba!=='ins')aba='ref';
var exp={ref:false,ins:false};
function setQ(k,v){q.set(k,v);try{history.replaceState(null,'','?'+q.toString())}catch(e){}}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function nf(n){return n.toLocaleString('pt-BR')}
function d1(x){return x.toFixed(1).replace('.',',')}
// prosa: 1,2 mi / 88 mil. lista: sempre em mil (mesma unidade na coluna)
function cmp(n){if(n>=1e6)return d1(n/1e6)+' mi';if(n>=1e3)return (n>=1e5?Math.round(n/1e3)+'':d1(n/1e3).replace(',0',''))+' mil';return String(n)}
function cmpL(n){if(n<1e3)return String(n);if(n>=1e6)return (Math.round(n/1e4)/100).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';var m=Math.round(n/100)/10;return m.toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil'}
// ---- dado 100% sintético. v = mediana de views por vídeo em 90 dias; lo/hi = p25/p75; k = vídeos nos 90 dias; f = falhou no estado "parcial"
var C=[
{n:'Rota Solta',v:1180000,lo:640000,hi:1900000,k:22},
{n:'Mochila Nômade ao Vivo',v:812000,lo:590000,hi:1010000,k:14},
{n:'Dois Passaportes',v:455000,lo:120000,hi:1400000,k:18},
{n:'Quilômetro Zero',v:301000,lo:248000,hi:360000,k:12},
{n:'Viajar Sem Pressa com Calma e Orçamento Curto em Países Pouco Visitados do Sudeste Asiático',v:270000,lo:201000,hi:333000,k:9},
{n:'Terra Firme',v:212000,lo:40000,hi:690000,k:11},
{n:'Canal Exemplo',v:88000,lo:61000,hi:120000,k:16,own:1},
{n:'Cabine Dupla',v:76000,lo:70000,hi:83000,k:13,f:1},
{n:'Mapa Amassado',v:64500,lo:22000,hi:150000,k:8},
{n:'Bagagem de Mão',v:51000,lo:38000,hi:72000,k:19,f:1},
{n:'Café em Trânsito',v:44000,lo:9000,hi:260000,k:7},
{n:'Janela do Fundo',v:38200,lo:30500,hi:47000,k:10},
{n:'Trilha e Tralha',v:29000,lo:17000,hi:41000,k:6},
{n:'Passagem Barata TV',v:21800,lo:15000,hi:33000,k:15},
{n:'Voo Rasante',v:17400,lo:2100,hi:98000,k:5},
{n:'Estrada de Terra',v:14900,lo:11800,hi:19000,k:9},
{n:'Meia Estação',v:11200,lo:7500,hi:15500,k:8},
{n:'Vaga na Janela',v:8700,lo:5200,hi:12400,k:7},
{n:'Diário de Escala',v:6100,lo:4300,hi:8800,k:6},
{n:'Fim de Linha',v:4400,lo:3100,hi:6300,k:6,f:1},
{n:'Baldeação',v:2900,lo:1200,hi:5400,k:5},
{n:'Pé na Estrada',v:2400,lo:1700,hi:3500,k:8},
{n:'Guia Nenhum',v:1800,k:4},
{n:'Primeira Viagem (canal novo)',v:9200,k:3},
{n:'Estreia Recente',k:2},
{n:'Sem Postar Desde Julho',k:0},
{n:'Canal Recém-Adicionado',k:0,nc:1}
];
// inscritos [nome, hoje, há 28 dias]: todos com 3 algarismos significativos a partir de 1.000 (regra da API); null = sem histórico
var S=[
{n:'Rota Solta',h:1420000,a:1390000},
{n:'Mochila Nômade ao Vivo',h:603000,a:602000},
{n:'Dois Passaportes',h:388000,a:371000},
{n:'Quilômetro Zero',h:212000,a:209000},
{n:'Viajar Sem Pressa com Calma e Orçamento Curto em Países Pouco Visitados do Sudeste Asiático',h:187000,a:181000},
{n:'Terra Firme',h:143000,a:143000},
{n:'Canal Exemplo',h:9840,a:9210,own:1},
{n:'Cabine Dupla',h:67400,a:68900,f:1},
{n:'Mapa Amassado',h:54200,a:53100},
{n:'Bagagem de Mão',h:41900,a:40800,f:1},
{n:'Café em Trânsito',h:33100,a:30200},
{n:'Janela do Fundo',h:28800,a:28700},
{n:'Trilha e Tralha',h:19300,a:19300},
{n:'Passagem Barata TV',h:16800,a:15900},
{n:'Voo Rasante',h:12300,a:10100},
{n:'Estrada de Terra',h:9800,a:9900},
{n:'Meia Estação',h:7600,a:7300},
{n:'Vaga na Janela',h:5400,a:5000},
{n:'Diário de Escala',h:3300,a:3100},
{n:'Fim de Linha',h:2100,a:2100,f:1},
{n:'Baldeação',h:980,a:820},
{n:'Pé na Estrada',h:640,a:640},
{n:'Guia Nenhum',h:410,a:405},
{n:'Mais um Canal Grande',h:2480000,a:2480000},
{n:'Primeira Viagem (canal novo)',h:6900,a:null,mot:'novo',nota:'Entrou há 11 dias; faltam 17 para ter 28 dias de histórico.'},
{n:'Sem Postar Desde Julho',h:null,a:null,mot:'oculto',nota:'O canal escondeu a contagem de inscritos.'}
];
if(estado==='magro'){C=C.filter(function(c,i){return i<6||c.own||c.k===3});S=S.filter(function(s,i){return i<4||s.own||s.mot})}
if(estado==='vazio'){C=[];S=[]}
var falha=estado==='parcial';
// passo de arredondamento da API: 3 algarismos significativos a partir de 1.000 inscritos
function passo(n){return n<1000?0:Math.pow(10,Math.floor(Math.log10(n))-2)}
function fpasso(p){return p>=1000?'±'+(p/1000)+' mil':'±'+p}
// ganho só é "medido" com |ganho| >= 2x o passo do maior valor; contagem exata (<1.000) mede qualquer ganho, inclusive zero
function classS(s){
 if(s.mot)return s;
 s.g=s.h-s.a;var p=passo(Math.max(s.h,s.a));
 if(p===0||Math.abs(s.g)>=2*p){s.mot='';s.pct=s.g/s.a*100;s.cl=s.g===0?'eq':s.g>0?'up':'dn'}
 else{s.mot='arred';s.p=p;s.nota=cmpL(s.h)+' no total'}
 return s;
}
function popo(id,titulo,itens){return '<div class="pop" id="'+id+'" popover="auto" role="dialog" aria-label="'+titulo+'"><h3>'+titulo+'</h3><ul>'+itens.map(function(i){return '<li>'+i+'</li>'}).join('')+'</ul></div>'}
function info(id,t){return '<button type="button" class="ibtn" popovertarget="'+id+'" aria-expanded="false" aria-label="Como é calculado: '+t+'"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 7.2v4M8 4.8v.1"/></svg></button>'}
var WARN='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3.2M8 11.6v.1"/></svg>';
var MIN=Math.log10(800),MAX=Math.log10(2000000);
function pos(v){return Math.max(0,Math.min(100,(Math.log10(v)-MIN)/(MAX-MIN)*100))}
var TICKS=[[1e3,'1 mil'],[1e4,'10 mil'],[1e5,'100 mil'],[1e6,'1 mi']];
function escala(){return '<div class="ri-esc" aria-hidden="true"><div>'+TICKS.map(function(t){return '<span style="left:'+pos(t[0]).toFixed(1)+'%">'+t[1]+'</span>'}).join('')+'</div></div>'}
// D1: faixa estreita / média / larga pela razão p75/p25; cortes PROVISÓRIOS 2 e 6 (calibrar por terços com os canais reais)
var CORTE_A=2,CORTE_B=6;
function faixa(c){var r=c.hi/c.lo;return{r:r,t:r<=CORTE_A?['＝','faixa estreita']:r<=CORTE_B?['～','faixa média']:['≋','faixa larga'],x:(r<10?d1(r):String(Math.round(r)))+'×'}}
// D4: >=5 vídeos = mediana + faixa; 3 a 4 = mediana provisória; 0 a 2 = sem mediana
function tipoC(c){return c.k>=5?'ok':c.k>=3?'prov':'nm'}
function rowsRef(){
 var ok=C.filter(function(c){return tipoC(c)==='ok'&&!(falha&&c.f)});
 var ord=ok.slice().sort(function(a,b){return ordR==='mediana'?b.v-a.v:faixa(a).r-faixa(b).r});
 var h='';
 function li(i,cls,body,c){return '<li class="'+(i>=10&&!c.own?'extra ':'')+(c.own&&i>=10?'extra pin ':'')+cls+'">'+body+'</li>'}
 function nome(c,rk){return '<div class="ri-nome"><span class="ri-rk">'+rk+'</span><span class="n" title="'+esc(c.n)+'">'+esc(c.n)+'</span>'+(c.own?'<span class="chip own">seu canal</span>':'')+'</div>'}
 var i=0;
 ord.forEach(function(c){
  var f=faixa(c);
  var lab=esc(c.n)+': mediana '+nf(c.v)+' views por vídeo, metade dos vídeos entre '+nf(c.lo)+' e '+nf(c.hi)+', '+f.t[1];
  h+=li(i,'',nome(c,i+1)+'<div class="reg" role="img" aria-label="'+lab+'"><span class="trilho"></span><span class="faixa" style="left:'+pos(c.lo)+'%;width:'+(pos(c.hi)-pos(c.lo))+'%"></span><span class="mk" style="left:'+pos(c.v)+'%"></span></div>'+
   '<div class="ri-val">'+cmpL(c.v)+'<small><span class="ri-g" aria-hidden="true">'+f.t[0]+'</span> '+f.t[1]+' · '+f.x+' · '+c.k+' vídeos</small></div>',c);i++;
 });
 C.filter(function(c){return ok.indexOf(c)<0}).forEach(function(c){
  var t=tipoC(c);
  if(falha&&c.f&&t==='ok'){h+=li(i,'',nome(c,'–')+'<div><span class="pill err">'+WARN+'falhou</span></div><div class="ri-val"><small>Não carregou. Tente de novo.</small></div>',c);i++;return}
  if(t==='prov'){
   h+=li(i,'',nome(c,'–')+'<div class="reg pt" role="img" aria-label="'+esc(c.n)+': mediana provisória '+nf(c.v)+' views com '+c.k+' vídeos, sem faixa"><span class="trilho"></span><span class="mk pv" style="left:'+pos(c.v)+'%"></span></div>'+
   '<div class="ri-val">'+cmpL(c.v)+'<small><span class="pill pont">provisória · '+c.k+' vídeos</span></small></div>',c);
  }else{
   var m=c.nc?'ainda não coletado':c.k===0?'sem vídeos em 90 dias':'poucos vídeos ('+c.k+')';
   h+=li(i,'',nome(c,'–')+'<div><span class="pill nm2">sem medida · '+m+'</span></div><div class="ri-val"></div>',c);
  }
  i++;
 });
 return {h:h,n:i,ord:ord};
}
function lstHtml(sec,r){return escala()+'<ol class="ri-lst'+(exp[sec]?' all':'')+'">'+r.h+'</ol>'}
function head(id,titulo){return '<h2 id="h-'+id+'">'+titulo+'</h2>'}
function skel(sec,txt){var r='';for(var i=0;i<8;i++)r+='<li><div class="ri-nome"><span class="ri-sk l" style="width:'+(60+(i*37%40))+'%"></span></div><span class="ri-sk r"></span><span class="ri-sk l" style="width:70%;justify-self:end"></span></li>';
 return '<div class="ri-head"><p class="lead" style="color:var(--muted)">'+txt+'</p></div>'+(estado==='lento'?'<p class="ri-aviso">Está demorando. A conexão pode estar lenta. <button class="btn" data-retry>Tentar de novo</button></p>':'')+'<ol class="ri-lst" aria-hidden="true">'+r+'</ol>'}
function erroSec(txt){return '<p class="ri-aviso err" role="alert">'+WARN+'<span>'+txt+' Seus dados não mudaram.</span> <button class="btn" data-retry>Tentar de novo</button> <span>Última leitura boa: 14/10, 06:40.</span></p>'}
function restrito(){return '<p class="ri-vazio"><span class="pill pont">restrito</span> Só quem administra o site vê estes dados.</p>'}
function aviso(){
 if(estado==='antigo')return '<p class="ri-aviso" role="status">'+(navigator.onLine===false?'Sem conexão. ':'')+'Mostrando os dados de 11/10, 06:40 (última coleta há 3 dias). Ordenar continua funcionando.</p>';
 if(falha)return '<p class="ri-aviso err" role="status">'+WARN+'<span>3 canais não carregaram.</span> <button class="btn" data-retry>Tentar de novo</button></p>';
 return '';
}
function ref(){
 var h='<section class="sec" id="s-ref" aria-labelledby="h-ref" '+(estado==='carregando'||estado==='lento'?'aria-busy="true"':'')+'>'+head('ref','Referências');
 if(estado==='carregando'||estado==='lento')return h+skel('ref','Calculando as referências…')+'</section>';
 if(estado==='erro')return h+erroSec('Não foi possível carregar as referências.')+'</section>';
 if(estado==='restrito')return h+restrito()+'</section>';
 if(!C.length)return h+'<div class="ri-vazio"><b>Nenhum canal acompanhado ainda.</b> Adicione canais em Canais para ver quem mantém as views em alta.</div></section>';
 var r=rowsRef(),ord=r.ord,top=ord[0];
 var larga=ord.filter(function(c){return faixa(c).t[1]==='faixa larga'}).length;
 var nm=C.filter(function(c){return tipoC(c)==='nm'}).length, pv=C.filter(function(c){return tipoC(c)==='prov'}).length;
 var ownI=ord.findIndex(function(c){return c.own});
 h+=aviso();
 h+='<div class="ri-head"><p class="lead">Nos últimos 90 dias, o vídeo típico de <b>'+esc(top.n)+' tem '+cmp(top.v)+' de views</b>, o mais alto entre os '+ord.length+(falha?' canais carregados (3 não carregaram). ':' canais medidos. ')+
  (ownI>=0?'<b>Seu canal está em '+(ownI+1)+'º ('+cmp(ord[ownI].v)+').</b> ':'')+larga+' têm faixa larga (as views variam muito de um vídeo para outro)'+(nm?'; '+nm+' sem medida':'')+(pv?(nm?', ':'; ')+pv+' com mediana provisória':'')+'. <span class="ex">exemplo</span></p>'+info('i-ref','Referências')+'</div>';
 h+=popo('i-ref','Como as referências de 90 dias são calculadas',[
  '<b>Vídeo típico (mediana):</b> o vídeo do meio. Metade dos vídeos publicados nos últimos 90 dias teve mais views, metade teve menos. Um vídeo que estourou não puxa o número.',
  '<b>Faixa:</b> onde ficam metade dos vídeos (do quarto mais baixo ao quarto mais alto). O número ao lado (3×) diz quantas vezes o fim da faixa é maior que o começo. Até 2× é faixa estreita, até 6× é média, acima é larga. Cortes provisórios, serão ajustados com os canais reais.',
  '<b>Poucos vídeos:</b> com 5 ou mais vídeos (de pelo menos 7 dias) em 90 dias aparece a mediana e a faixa; com 3 ou 4, só uma mediana provisória (marca vazada, sem faixa); com 0 a 2, sem medida.',
  '<b>Escala:</b> logarítmica, cada traço vale 10 vezes o anterior, para um canal de 2 mil e um de 1 milhão caberem na mesma régua.',
  '<b>Sem nota de corte:</b> nenhum canal é "bom" ou "ruim" aqui; a lista só ordena.',
  'Vídeos com menos de 7 dias ficam de fora, porque ainda estão ganhando views.',
  'Cálculo do Observatório sobre dados públicos do YouTube. Views de hoje de cada vídeo publicado nos últimos 90 dias.']);
 h+='<div class="ri-ctl"><span id="o-r">Ordenar por</span><button class="btn" data-ord-r="mediana" aria-pressed="'+(ordR==='mediana')+'">Views do vídeo típico</button><button class="btn" data-ord-r="faixa" aria-pressed="'+(ordR==='faixa')+'">Faixa mais estreita</button></div>';
 h+='<p class="ri-leg"><span><i class="sw-mk"></i>vídeo típico (mediana)</span><span><i class="sw-band"></i>faixa: onde ficam metade dos vídeos</span><span><i class="sw-pv"></i>mediana provisória, sem faixa</span><span><i class="nm-h"></i>sem medida</span></p>';
 h+='<p class="ri-leg">Fora da ordem, no fim da lista: mediana provisória e sem medida.</p>';
 h+='<div id="l-ref">'+lstHtml('ref',r)+'</div>';
 if(r.n>10)h+='<button class="btn ri-more" data-more="ref" aria-expanded="'+exp.ref+'">'+(exp.ref?'Ver só os 10 primeiros':'Ver todos os '+r.n)+'</button>';
 return h+'</section>';
}
function rowsIns(){
 var m=S.map(classS);
 var ok=m.filter(function(s){return s.mot===''&&!(falha&&s.f)});
 var ord=ok.slice().sort(function(a,b){return ordI==='pct'?b.pct-a.pct:b.g-a.g});
 var maxv=Math.max.apply(null,ord.map(function(s){return Math.abs(ordI==='pct'?s.pct:s.g)}).concat([1]));
 var h='',i=0;
 function li(i,body,s){return '<li class="'+(i>=10&&!s.own?'extra':s.own&&i>=10?'extra pin':'')+'">'+body+'</li>'}
 function nome(s,rk){return '<div class="ri-nome"><span class="ri-rk">'+rk+'</span><span class="n" title="'+esc(s.n)+'">'+esc(s.n)+'</span>'+(s.own?'<span class="chip own">seu canal</span>':'')+'</div>'}
 ord.forEach(function(s){
  var sy=s.cl==='eq'?'＝':s.cl==='up'?'▲':'▼', sg=s.g>0?'+':s.g<0?'−':'';
  var w=Math.max(1,Math.abs(ordI==='pct'?s.pct:s.g)/maxv*50);
  var pt=s.cl==='eq'?'sem variação':sy+' '+sg+d1(Math.abs(s.pct))+'%';
  var lab=esc(s.n)+': '+(s.cl==='eq'?'sem variação':(s.g>0?'subiu ':'caiu ')+nf(Math.abs(s.g))+' inscritos, '+d1(Math.abs(s.pct))+'%')+' em 28 dias';
  h+=li(i,nome(s,i+1)+'<div class="dv" role="img" aria-label="'+lab+'"><span class="eixo"></span>'+(s.cl==='eq'?'<span class="b eq"></span>':'<span class="b '+s.cl+'" style="width:'+w.toFixed(1)+'%"></span>')+'</div>'+
   '<div class="ri-val"><span class="dir '+s.cl+'">'+pt+'</span><small>'+(s.cl==='eq'?'':sg+nf(Math.abs(s.g))+' · ')+cmpL(s.h)+' no total</small></div>',s);i++;
 });
 m.filter(function(s){return ok.indexOf(s)<0}).forEach(function(s){
  if(falha&&s.f&&s.mot===''){h+=li(i,nome(s,'–')+'<div class="dv sm"><span class="pill err">'+WARN+'falhou</span></div><div class="ri-val"><small>Não carregou. Tente de novo.</small></div>',s);i++;return}
  var mo=s.mot==='novo'?'menos de 28 dias':s.mot==='oculto'?'contagem oculta':'dentro do arredondamento ('+fpasso(s.p)+')';
  h+=li(i,nome(s,'–')+'<div class="dv sm"><span class="pill nm2">sem medida · '+mo+'</span></div><div class="ri-val"><small>'+esc(s.nota)+'</small></div>',s);i++;
 });
 return {h:h,n:i,ord:ord,m:m};
}
function ins(){
 var h='<section class="sec" id="s-ins" aria-labelledby="h-ins" '+(estado==='carregando'||estado==='lento'?'aria-busy="true"':'')+'>'+head('ins','Inscritos');
 if(estado==='carregando'||estado==='lento')return h+skel('ins','Calculando o ganho de inscritos…')+'</section>';
 if(estado==='restrito')return h+restrito()+'</section>';
 if(!S.length)return h+'<div class="ri-vazio"><b>Sem inscritos para mostrar.</b> Os números aparecem depois da primeira coleta de cada canal.</div></section>';
 var r=rowsIns(),ord=r.ord;
 var bp=ord.slice().sort(function(a,b){return b.pct-a.pct})[0], ba=ord.slice().sort(function(a,b){return b.g-a.g})[0], own=ord.filter(function(s){return s.own})[0];
 var nm=r.m.filter(function(s){return s.mot!==''}).length;
 var txt;
 if(!ord.length)txt='Nenhum canal pôde ser medido nos últimos 28 dias.';
 else txt='Em 28 dias, <b>'+esc(bp.n)+'</b> cresceu mais em %: +'+d1(bp.pct)+'% (+'+nf(bp.g)+'). '+(ba===bp?'Também foi o que mais ganhou em número. ':'<b>'+esc(ba.n)+'</b> ganhou mais em número: +'+nf(ba.g)+'. ')+(own?'<b>Seu canal: '+(own.g<0?'−':'+')+d1(Math.abs(own.pct))+'% ('+(own.g<0?'−':'+')+nf(Math.abs(own.g))+').</b> ':'')+
  ord.filter(function(s){return s.cl==='up'}).length+' subiram, '+ord.filter(function(s){return s.cl==='dn'}).length+' caíram, '+ord.filter(function(s){return s.cl==='eq'}).length+' sem variação'+(nm?'; '+nm+' sem medida':'')+'.';
 h+=(estado==='erro'?'':aviso());
 h+='<div class="ri-head"><p class="lead">'+txt+' <span class="ex">exemplo</span></p>'+info('i-ins','Inscritos')+'</div>';
 h+=popo('i-ins','Como o ganho de inscritos em 28 dias é calculado',[
  '<b>Ganho:</b> inscritos de hoje menos os de 28 dias atrás, em número e em porcentagem sobre os de 28 dias atrás.',
  '<b>Arredondamento:</b> o YouTube mostra a contagem pública com 3 algarismos, a partir de mil inscritos (143 mil aparece como 143.000, 1,42 milhão como 1.420.000). Os dois números vêm arredondados, então o ganho só conta quando é de pelo menos 2 vezes esse arredondamento.',
  '<b>Sem medida</b> quando: o ganho é menor que 2 vezes o arredondamento ("dentro do arredondamento"); o canal tem menos de 28 dias no Observatório; ou o canal escondeu a contagem.',
  '<b>Sem variação (＝):</b> só quando a contagem é exata (menos de mil inscritos) e o ganho é zero.',
  'Cálculo do Observatório sobre dados públicos do YouTube. Contagem pública de inscritos, uma coleta por dia.']);
 h+='<div class="ri-ctl"><span>Ordenar por</span><button class="btn" data-ord-i="pct" aria-pressed="'+(ordI==='pct')+'">Ganho em %</button><button class="btn" data-ord-i="abs" aria-pressed="'+(ordI==='abs')+'">Ganho em inscritos</button></div>';
 h+='<p class="ri-leg"><span><span class="dir up">▲</span> subiu</span><span><span class="dir dn">▼</span> caiu</span><span><span class="dir eq">＝</span> sem variação</span><span><i class="nm-h"></i>sem medida</span><span id="ri-lg-barra">Barra: tamanho do ganho '+(ordI==='pct'?'em %':'em inscritos')+'.</span></p>';
 h+='<div id="l-ins"><ol class="ri-lst'+(exp.ins?' all':'')+'">'+r.h+'</ol></div>';
 if(r.n>10)h+='<button class="btn ri-more" data-more="ins" aria-expanded="'+exp.ins+'">'+(exp.ins?'Ver só os 10 primeiros':'Ver todos os '+r.n)+'</button>';
 return h+'</section>';
}
var ESTADOS=[['cheio','Cheio'],['magro','Poucos canais'],['vazio','Sem canais'],['carregando','Carregando'],['lento','Carregando lento'],['erro','Erro (Referências)'],['parcial','Parcial'],['antigo','Dado antigo'],['restrito','Restrito']];
function lk(e,t){var p=new URLSearchParams(q);p.set('estado',e);if(t)p.set('tema',t);return '?'+p.toString()}
function render(){
 var tema=q.get('tema')==='claro'?'claro':'escuro';
 document.getElementById('app').innerHTML='<main class="ri" data-aba="'+aba+'"><details class="ri-estados"><summary>Estados do mockup (não fazem parte da tela)</summary><div class="ri-estl">'+
  ESTADOS.map(function(x){return '<a class="btn" href="'+lk(x[0])+'"'+(estado===x[0]?' aria-current="true"':'')+'>'+x[1]+'</a>'}).join('')+'<a class="btn" href="'+lk(estado,tema==='claro'?'escuro':'claro')+'">Tema '+(tema==='claro'?'escuro':'claro')+'</a></div></details>'+
  '<div class="ch-shell"><h1>Canais</h1></div>'+
  '<div class="ri-abas" role="group" aria-label="Seção"><button class="btn" data-aba="ref" aria-pressed="'+(aba==='ref')+'">Referências</button><button class="btn" data-aba="ins" aria-pressed="'+(aba==='ins')+'">Inscritos</button></div>'+
  '<div style="height:12px"></div>'+ref()+ins()+'<div class="visually-hidden" aria-live="polite" id="live" style="position:absolute;left:-9999px"></div></main>';
}
render();
function posiciona(p,b){var r=b.getBoundingClientRect(),w=Math.min(380,innerWidth-24);p.style.left=Math.max(12,Math.min(r.left,innerWidth-12-w))+'px';p.style.top=(r.bottom+6)+'px'}
document.addEventListener('beforetoggle',function(ev){
 var p=ev.target;if(!p.classList||!p.classList.contains('pop'))return;
 var b=document.querySelector('[popovertarget="'+p.id+'"]');
 if(ev.newState==='open'&&b)posiciona(p,b);
},true);
document.addEventListener('toggle',function(ev){
 var p=ev.target;if(!p.classList||!p.classList.contains('pop'))return;
 var b=document.querySelector('[popovertarget="'+p.id+'"]');if(b)b.setAttribute('aria-expanded',String(ev.newState==='open'));
},true);
addEventListener('scroll',function(){document.querySelectorAll('.pop:popover-open').forEach(function(p){p.hidePopover()})},{passive:true});
function updList(sec){
 var r=sec==='ref'?rowsRef():rowsIns();
 document.getElementById('l-'+sec).innerHTML=sec==='ref'?lstHtml('ref',r):'<ol class="ri-lst'+(exp.ins?' all':'')+'">'+r.h+'</ol>';
 var more=document.querySelector('[data-more="'+sec+'"]');if(more){more.textContent=exp[sec]?'Ver só os 10 primeiros':'Ver todos os '+r.n;more.setAttribute('aria-expanded',String(exp[sec]))}
}
function anuncia(t){var l=document.getElementById('live');if(l)l.textContent=t}
document.addEventListener('click',function(ev){
 var t=ev.target;
 var r=t.closest('[data-ord-r]');if(r){ordR=r.dataset.ordR;setQ('ordr',ordR);document.querySelectorAll('[data-ord-r]').forEach(function(b){b.setAttribute('aria-pressed',String(b===r))});updList('ref');anuncia('Referências ordenadas por '+r.textContent);return}
 var i=t.closest('[data-ord-i]');if(i){ordI=i.dataset.ordI;setQ('ordi',ordI);document.querySelectorAll('[data-ord-i]').forEach(function(b){b.setAttribute('aria-pressed',String(b===i))});updList('ins');var lg=document.getElementById('ri-lg-barra');if(lg)lg.textContent='Barra: tamanho do ganho '+(ordI==='pct'?'em %':'em inscritos')+'.';anuncia('Inscritos ordenados por '+i.textContent);return}
 var a=t.closest('[data-aba]');if(a&&a.tagName==='BUTTON'){aba=a.dataset.aba;setQ('aba',aba);try{localStorage.setItem('ri-aba',aba)}catch(e){}document.querySelector('.ri').dataset.aba=aba;document.querySelectorAll('.ri-abas .btn').forEach(function(b){b.setAttribute('aria-pressed',String(b===a))});return}
 var m=t.closest('[data-more]');if(m){exp[m.dataset.more]=!exp[m.dataset.more];updList(m.dataset.more);return}
 if(t.closest('[data-retry]')){estado='cheio';falha=false;setQ('estado','cheio');render();var h=document.getElementById('h-ref');if(h){h.tabIndex=-1;h.focus()}}
});
})();
