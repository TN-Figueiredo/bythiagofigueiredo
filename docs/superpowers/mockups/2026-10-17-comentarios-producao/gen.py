import html,os
out='/Users/figueiredo/Workspace/bythiagofigueiredo/docs/superpowers/mockups/2026-10-17-comentarios-producao/'
E=html.escape
PHOTO="data:image/svg+xml;utf8,"+"%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23F4A261'/%3E%3Cstop offset='1' stop-color='%232A4D69'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='32' height='32' fill='url(%23g)'/%3E%3Ccircle cx='21' cy='11' r='4' fill='%23FFE8B0'/%3E%3Cpath d='M0 32 L10 16 L18 26 L24 19 L32 32Z' fill='%231B2A38'/%3E%3C/svg%3E"
THUMB="<svg viewBox='0 0 64 36' aria-hidden='true'><defs><linearGradient id='tg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1F3A4D'/><stop offset='1' stop-color='#0F1A24'/></linearGradient></defs><rect width='64' height='36' fill='url(#tg)'/><circle cx='46' cy='12' r='5' fill='#F4C27A'/><path d='M0 36 L14 18 L26 30 L38 20 L64 36Z' fill='#0A1218'/></svg>"
ANON="<svg viewBox='0 0 32 32' aria-hidden='true'><circle cx='16' cy='12.5' r='5' class='d'/><path d='M5.5 29c0-6 4.7-9.5 10.5-9.5S26.5 23 26.5 29z' class='d'/></svg>"
HEART="<svg class='ic' viewBox='0 0 16 16' aria-hidden='true'><path d='M8 13.6S2 10 2 6a3 3 0 0 1 6-.8A3 3 0 0 1 14 6c0 4-6 7.600-6 7.600z'/></svg>"
CHECK="<svg viewBox='0 0 10 10' aria-hidden='true'><path d='M1.800 5.200 4 7.400 8.200 2.800'/></svg>"
INFO="<button class='info' type='button' aria-label='Como ler esta seção'><i>i</i></button>"
CRI={'nome':'Matheus Fonseca','foto':True}
def av_cri(sm=False,foto=True,ini='M'):
    c='cf-av cri'+(' sm' if sm else '')
    inner=f"<img src=\"{PHOTO}\" alt=\"\">" if foto else f"<span class='ini'>{ini}</span>"
    return f"<span class='{c}' aria-hidden='true'>{inner}</span>"
def av_anon(): return f"<span class='cf-av anon'>{ANON}</span>"
n=[0]
def txt(t,long=False):
    n[0]+=1;i=f"t{n[0]}"
    b=f"<button class='cf-link' type='button' aria-expanded='false' aria-controls='{i}' data-ver>Ver tudo</button>" if long else ''
    return f"<p class='cf-txt' id='{i}'>{E(t)}</p>{b}"
def resp(t,foto=True,nome='Matheus Fonseca',long=False,extra=False):
    h='' if not extra else ''
    return (f"<div class='cf-resp'>{av_cri(True,foto)}<div style='min-width:0'><div class='cf-head'><span class='cf-nome'>{E(nome)}</span><span class='cf-selo'>Criador</span><span class='cf-meta'>16/10</span></div>{txt(t,long)}</div></div>")
def likes(txt_,pct=None):
    r=f"<span class='cf-reg' aria-hidden='true'><b style='width:{pct}%'></b></span>" if pct is not None else ''
    return f"<span class='cf-likes'>{HEART}<span>{txt_}</span>{r}</span>"
def fio(texto,resps,cls='',motivo=None,pos=None,lk='',data='15/10',long=False,foto=True,nome='Matheus Fonseca',mais=0):
    mt=f"<span class='cf-motivo'>{motivo}</span>" if motivo else ''
    ps=f"<span class='cf-meta'><span class='pos num'>{pos}</span></span>" if pos else ''
    rs=''.join(resp(r,foto,nome,False) for r in resps[:1])
    ex=''
    if len(resps)>1:
        n[0]+=1;i=f"x{n[0]}"
        ex=(f"<div class='cf-extra' id='{i}' hidden>"+''.join(resp(r,foto,nome) for r in resps[1:])+"</div>"
            f"<div class='cf-mais'><button class='cf-link cf-ver' type='button' aria-expanded='false' aria-controls='{i}' data-mais data-n='{len(resps)-1}'>Ver as outras {len(resps)-1} respostas do criador</button></div>")
    return (f"<li class='cf {cls}'>{av_anon()}<div class='cf-corpo'><div class='cf-head'><span class='cf-nome esp'>Espectador</span>{mt}"
            f"<span class='cf-meta'><span>{data}</span>{lk}</span>{ps.replace('cf-meta','cf-meta push') if ps else ''}</div>{txt(texto,long)}</div>{rs}{ex}</li>")

HOSTIL=("Eu moro na Tailândia há 4 anos e preciso dizer: o vídeo mostra uma noite de sorte. Andar sozinho funciona em Bangkok e em Chiang Mai, mas em ilhas como Koh Phangan depois da meia-noite a história muda, porque a luz some, os táxis somem e o celular fica sem sinal. "
"Eu mesmo já voltei a pé 6 km uma vez achando que seria rápido 😅. Então, para quem está planejando: leve dinheiro em espécie, baixe o mapa offline, avise alguém do hotel e nunca aceite carona de moto sem combinar o preço antes. "
"Também vale falar da chuva: de junho a outubro ela vem forte no fim da tarde e à noite, e as ruas alagam rápido. Eu gostei muito de ver você andando devagar e conversando com as pessoas, isso mostra um lado do país que quase ninguém filma. "
"Parabéns pelo vídeo, Matheus, e continue assim 🇹🇭❤️🙏 ")
RHOST=["Valeu pelo relato, é exatamente esse tipo de aviso que eu queria ter ouvido antes!","Boa dica do mapa offline, vou colocar no próximo vídeo.","Koh Phangan à noite é outra história mesmo 😅","Pode mandar mais dicas por aqui, vou ler todas.","Obrigado de coração 🙏🇹🇭"]

def video_sec(theme,w):
    f=lambda *a,**k:fio(*a,**k)
    items=[
     f("Tu tá no paraíso slk, q lugar maravilhoso, pessoal tudo simpático! 😊",["Simmm!! Todo mundo gente boa"],cls='m-k',pos='1 de 12',lk=likes('15 com 1 dia',100)),
     f("Oi Matheus, as pessoas na China são muito simpáticas, se vc falasse mandarim iam te adorar mas é difícil pacas, tentei mas desisti porém ainda vou falar. Já fui 3 vzs aí . Aproveite bastante. Um abraço.",["Pois é amigo, haja tempo e dedicação pra começar a falar o básico de mandarim. Quem sabe um dia, mas por agora a vida tá muito corrida. Eu tb ja estou organizando as minhas proximas viagens pra China! Vlw, tmj"],cls='m-k',pos='2 de 12',lk=likes('14 com 1 dia',93)),
     f("A Ásia é um paraíso, se compararmos com Brasil. Segurança, custo de vida, sem contar a cultura milenar... difícil deve ser sair daí... parabéns pelo conteúdo, Matheus! ❤",["Vlw Gilmar! China é diferenciada!!"],cls='m-k',pos='3 de 12',lk=likes('11 com 1 dia',73)),
     f("Esse vídeo me fez querer largar tudo e ir. Qual a época mais barata para ir?",[],cls='m-c',motivo='Mais curtido',pos='4 de 12',lk=likes('9 com 1 dia',60)),
     f(HOSTIL,RHOST,cls='m-k',pos='5 de 12',lk=likes('4 com 1 dia',27),long=True),
    ]
    items=''.join(items)
    n[0]+=1;xid=f"v{n[0]}"
    ex=[("Qual câmera você usou nessa viagem?",'10'),("A cena do mercado ficou linda, parabéns!",'8'),("Quanto custou a passagem, mais ou menos?",'7'),("Quero ver mais vídeos assim da Tailândia 🇹🇭",'6'),("Esse canal merece muito mais inscritos.",'5'),("Visitei esse lugar ano passado, voltaria hoje!",'4'),("Boa viagem e continue compartilhando 🙏",'3')]
    extras=''.join(fio(t,[],cls='m-c',motivo='Mais curtido',pos=f'{6+i} de 12',lk=likes(f'{k} com 1 dia',int(int(k)/15*100))) for i,(t,k) in enumerate(ex))
    return f"""<div class='sec'>
<div class='sec-h'><h3>Comentários de destaque</h3>{INFO}</div>
<p class='priv'>Nome e foto de quem comenta ficam ocultos. O criador aparece porque o canal é público.</p>
<div class='resumo-linha'><p class='resumo'><b>O criador respondeu a 4 dos 12 comentários guardados com 1 dia.</b> <span class='apagado'>O vídeo tinha 132.</span></p>
<div class='barra-fina'><span class='t num'>12 de 132</span><i aria-hidden='true'><b></b></i></div></div>
<div class='abas' role='tablist'>
<button class='aba' role='tab' aria-selected='true'><b>1 dia</b><small>12 guardados</small></button>
<button class='aba fut' role='tab' aria-selected='false'><b>7 dias</b><small>fecha em 22/10</small></button>
<button class='aba fut' role='tab' aria-selected='false'><b>30 dias</b><small>fecha em 14/11</small></button></div>
<p class='leg'><span><i style='background:var(--tier-high)'></i>8 mais curtidos</span><span><i style='background:var(--cf-criador)'></i>4 com o criador na conversa</span></p>
<p class='leg-zero'>Nenhum de canal que você acompanha nem de canal grande.</p>
<ol class='lista'>{items}</ol>
<div id='{xid}' hidden><ol class='lista' style='margin-top:10px'>{extras}</ol></div>
<button class='cf-link' type='button' aria-expanded='false' aria-controls='{xid}' data-mais data-n='7' data-grupo-v style='margin-top:6px'>Ver as outras 7</button>
<p class='rodape'>Este é o primeiro retrato. O dia 7 mostra quem entrou e quem saiu dos 12.</p>
</div>"""

def video_ext(theme):
    # estados extremos: criador sem foto, nome longo, resposta única + sem resposta
    a=fio("Comentário curto, sem resposta ainda.",[],cls='m-c',motivo='Mais curtido',lk=likes('3 com 1 dia',20),pos='9 de 12')
    b=fio("Gostei do corte da cena do mercado 😂😂😂",["Obrigado! 🙌"],cls='m-k',lk=likes('2 com 1 dia',13),pos='12 de 12',foto=False,nome='Matheus Fonseca Viagens e Experiências pelo Sudeste Asiático')
    return f"<div class='sec'><ol class='lista'>{a}{b}</ol></div>"

def canal_sec(theme):
    reais=[("Me falem aí se gostaram desse tipo de vídeo, e oq poderia melhorar ou mudar, aceito sugestões. Tô com uma câmera nova que é massa de gravar videos assim. É nois galera, Tmj. Logo logo vídeo novo em país diferente....(Até que enfim 😅).","@espectador pelo feedback amigo, Tmj",13),
     ("Vídeos hibridos são melhores q 100% POV","Obg pelo feedback! Vou tentar alternar",5),
     ("Matheus sempre trazendo bons vídeos ❤","Vlw Alisson! TMJ",5),
     ("e loucura falar que com 23 anos de idade meu sonho e ir pra tailandia sem previsao de voltar e gravar video so por diversao","Compra a câmera e cola tb pra ca",3),
     ("Tá muito Family Friend em Matheus 😂😂 Brincadeiras a parte, sempre com os melhores vídeos. Tailândia já está no radar","Hahahaha TMJ meu amigo, só vem",3),
     ("Que cenário! Vou aproveitar as dicas pra minha viagem em dezembro.","Bora! Me conta como foi 🇹🇭",3)]
    mk=lambda r:fio(r[0],[r[1]],lk=likes(f"{r[2]} no retrato de 30 dias"),data='15/10')
    vis=''.join(mk(r) for r in reais[:3]); rest=''.join(mk(r) for r in reais[3:])
    n[0]+=1;i=f"g{n[0]}"
    casas="".join("<span class='casa ant'></span>" for _ in range(7))+f"<span class='casa ok'>{CHECK}</span>"+"".join("<span class='casa sr'></span>" for _ in range(6))
    return f"""<div class='sec'>
<div class='sec-h'><h3>O que o criador respondeu</h3>{INFO}</div>
<p class='fr2'><b>Matheus Fonseca respondeu a 12 comentários guardados, em 1 vídeo.</b></p>
<p class='fr2 dois'><span>Só 1 dos 14 vídeos dos últimos 90 dias já tem o retrato de 30 dias; o primeiro dos outros fecha em 14/11. Quanto ele responde por vídeo ainda não é medido.</span><span class='pill-nm'>não medido</span></p>
<div class='regua' role='img' aria-label='14 vídeos dos últimos 90 dias: 7 já tinham mais de 37 dias quando a coleta começou, 1 com o retrato de 30 dias e resposta dele, 6 em coleta sem os 30 dias'>{casas}</div>
<p class='regua-leg'><span><i class='casa ant'></i>7 já tinham mais de 37 dias quando a coleta começou (15/10)</span><span><i class='casa ok'>{CHECK}</i>1 com o retrato de 30 dias e resposta dele</span><span><i class='casa sr'></i>6 em coleta, ainda sem os 30 dias</span></p>
<div class='grupo'>
<div class='grupo-h'><span class='thumb'>{THUMB}</span><a href='#'><span class='tt'>Andando sozinho à noite na chuva pela Tailândia… e aconteceu isso 🇹🇭</span><span class='sub num'>12 respostas dele</span></a></div>
<ol class='lista'>{vis}</ol>
<div id='{i}' hidden><ol class='lista' style='margin-top:10px'>{rest}</ol></div>
<button class='cf-link' type='button' aria-expanded='false' aria-controls='{i}' data-mais data-n='9' data-grupo style='margin-top:6px'>Ver as outras 9 deste vídeo</button>
</div></div>"""

def canal_ext(theme):
    a=fio(HOSTIL,RHOST,lk=likes('4 no retrato de 30 dias'),long=True)
    b=fio("Ótimo vídeo!",["Valeu! 🙏"],lk=likes('1 no retrato de 30 dias'),foto=False,nome='Matheus Fonseca Viagens e Experiências pelo Sudeste Asiático')
    return f"<div class='sec'><div class='grupo' style='margin:0'><div class='grupo-h'><span class='thumb'>{THUMB}</span><a href='#'><span class='tt'>Título de vídeo muito longo para testar o corte em duas linhas e o que acontece quando o criador não tem foto cadastrada no YouTube 🇹🇭🇹🇭🇹🇭</span><span class='sub num'>6 respostas dele</span></a></div><ol class='lista'>{a}{b}</ol></div></div>"

JS="""<script>
document.addEventListener('click',function(e){var b=e.target.closest('button[data-ver],button[data-mais]');if(!b)return;
var t=document.getElementById(b.getAttribute('aria-controls'));var o=b.getAttribute('aria-expanded')==='true';
if(b.hasAttribute('data-ver')){t.classList.toggle('open',!o);b.textContent=o?'Ver tudo':'Recolher';}
else{t.hidden=o;b.textContent=o?(b.hasAttribute('data-grupo-v')?'Ver as outras '+b.dataset.n:b.hasAttribute('data-grupo')?'Ver as outras '+b.dataset.n+' deste vídeo':'Ver as outras '+b.dataset.n+' respostas do criador'):'Recolher';}
b.setAttribute('aria-expanded',String(!o));});
</script>"""

def frame(theme,w,body,cls=''):
    return f"<div class='frame {w} {cls}' data-theme='{theme}'>{body}</div>"
def fig(cap,theme,w,body,cls=''):
    return f"<figure><figcaption>{cap}</figcaption>{frame(theme,w,body,cls)}</figure>"

def page(title,lede,blocks):
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="fio.css"></head>
<body><main class="page"><h1>{title}</h1><p class="lede">{lede}</p>{blocks}</main>{JS}</body></html>"""

def stage(name,theme,sec1240,sec390,ext,cap="Dado hostil, 1440: criador sem foto, nome com 60 caracteres e comentário sem resposta (o texto de 600 caracteres e as 5 respostas estão no fio 5 da lista principal)"):
    return (f"<h2>{name}</h2><div class='row'>"+fig("1440 (área de conteúdo de 1240 px)",theme,'w1240',sec1240)+fig("390",theme,'w390',sec390)+"</div>"
            +f"<div class='row'>"+fig(cap,theme,'w1240',ext)+"</div>")

# ---- video.html
b=''
for theme,name in (('dark','Escuro'),('light','Claro')):
    b+=stage(name,theme,video_sec(theme,'w1240')+"",video_sec(theme,'w390'),video_ext(theme))
# variantes
def var(theme,cls,cap):
    n[0]+=100
    x=fio("Tu tá no paraíso slk, q lugar maravilhoso, pessoal tudo simpático! 😊",["Simmm!! Todo mundo gente boa"],cls='m-k '+cls,pos='1 de 12',lk=likes('15 com 1 dia',100))
    y=fio("Esse vídeo me fez querer largar tudo e ir. Qual a época mais barata para ir?",[],cls='m-c '+cls,motivo='Mais curtido',pos='4 de 12',lk=likes('9 com 1 dia',60))
    return fig(cap,theme,'w560',f"<ol class='lista'>{x}{y}</ol>")
b+="<h2>Variante descartada (para registro)</h2><p class='nota'>Logan e Naksu escolheram a <b>B</b>: selo \"Criador\" cheio mais régua curta de curtidas (marco de 1 dia, relativa ao mais curtido da lista). Todas as listas acima usam a B. A <b>A</b> (selo vazado e minúsculo, curtidas só em texto) falha em contraste no claro (4,49:1) e não vai para produção.</p>"
for theme in ('dark','light'):
    b+="<div class='row'>"+var(theme,'v-a','A · Logan (descartada)')+var(theme,'v-b','B · escolhida')+"</div>"
b+="<p class='nota'>Dados: textos, curtidas e respostas dos comentários 1 a 3 vêm da captura do dono (17/10, 1440). Comentário 4 e o texto de 600 caracteres são sintéticos, para testar a pastilha de motivo e o corte.</p>"
open(out+'video.html','w').write(page('Comentários de destaque (vídeo)','Fio de comentário único: avatar à esquerda, selo \"Criador\" com foto e cor de papel, curtidas numa linha, método no ⓘ. Quadros escuro e claro, a 1440 e a 390.',b))

# ---- canal.html
b=''
for theme,name in (('dark','Escuro'),('light','Claro')):
    b+=stage(name,theme,canal_sec(theme),canal_sec(theme),canal_ext(theme),cap='Dado hostil, 1440: texto de 600 caracteres, 5 respostas do criador e, no segundo fio, criador sem foto com nome de 60 caracteres')
b+="<p class='nota'>Dados: os 6 fios vêm da captura do dono (17/10), do vídeo \"Andando sozinho à noite na chuva\"; o sexto é sintético. O botão \"Ver as outras 9\" abre os 3 restantes da amostra. \"@…\" virou \"@espectador\". A pastilha \"não medido\" está na frase da taxa, não no título. Legenda da régua sem caixas de seleção: marca cheia, hachura e círculo tracejado.</p>"
open(out+'canal.html','w').write(page('O que o criador respondeu (canal)','Os mesmos fios do vídeo, agrupados por vídeo: miniatura e título uma vez, até 3 fios, o resto sob demanda.',b))
