/* chrome.js — moldura compartilhada do Observatório de Competidores.
   Depende de dados.js (window.OBS). API em CHROME.md.
   window.CHROME.mount({tab, title?, subtitle?, content?, drawer?, forjaVariant?, mockStates?, deps?,
                        onNiche?, onTheme?, onMock?, onForja?, onStatus?, onSync?, onBackdrop?, cowork?, menuItems?})
   Depois: update({tab, niche, persist, forja, newTab}), setNiche, setTheme, setForja, forjaFromScenario, drawer, toast,
   setDeps, setMockPressed, destroy. Versão em CHROME.version. */
(function(){
  'use strict';
  const OBS = window.OBS;
  if(!OBS){ throw new Error('chrome.js precisa de dados.js carregado antes'); }
  const D = OBS.date, F = OBS.fmt;

  const ICON = {
    plus:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    sync:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.6-4.5M4 13a8 8 0 0 0 14.6 4.5"/><path d="M4 4v4h4M20 20v-4h-4"/></svg>',
    anvil:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M3 7h13a5 5 0 0 1-5 5H9v3h6v3H6v-3h1v-3H7A4 4 0 0 1 3 8z"/></svg>',
    dots:'<svg class="ch-i-f" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    warn:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg>',
    chev:'<svg class="ch-chev ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    check:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    x:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    copy:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    pin:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>',
    sun:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>',
    info:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
    menu:'<svg class="ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  };
  const esc = s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const store = {get:k=>{try{return localStorage.getItem(k)}catch(e){return null}}, set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
  /** link entre telas: sempre OBS.link.*, sem "?" sobrando */
  const L = (name,params={})=>OBS.link[name](params).replace(/\?$/,'');
  const NICHES = ['todos','viagem','ia'];
  const nicheLabel = n=>n==='todos'?'Todos':OBS.NICHES[n].label;
  const TABS = ['canais','mudancas','outliers','insights'];
  const TABNAME = {canais:'Canais',mudancas:'Mudanças',outliers:'Outliers',insights:'Insights'};
  const TABKEY = {canais:'canais',mudancas:'mud',outliers:'out'};
  const SIDEBAR = [
    ['Hub',[['Painel','/cms'],['Próximos','/cms/up-next'],['Agenda','/cms/schedule'],['Notificações','/cms/notifications']]],
    ['Conteúdo',[['Blog','/cms/blog'],['Vídeos','/cms/videos'],['Cursos','/cms/courses'],['Newsletters','/cms/newsletters'],['Campanhas','/cms/campaigns'],['Listas de espera','/cms/waitlists'],['Playlists','/cms/playlists']]],
    ['Biblioteca',[['Pesquisa','/cms/research'],['Referência','/cms/reference'],['Mídia','/cms/media'],['Áudio','/cms/audio']]],
    ['YouTube',[['Canais','/cms/youtube/channels'],['Vídeos','/cms/youtube/videos'],['A/B Lab','/cms/youtube/ab-lab'],['Desempenho','/cms/youtube/performance'],['Competidores',null]]],
    ['Social',[['Posts','/cms/social/posts'],['Links','/cms/links']]],
  ];
  const SHELL_TABS = [['Painel','/cms/youtube'],['Vídeos','/cms/youtube/videos'],['A/B Lab','/cms/youtube/ab-lab'],['Categorias','/cms/youtube/categories'],['Comentários','/cms/youtube/comments'],['Conteúdo','/cms/youtube/content'],['Competidores',null],['Desempenho','/cms/youtube/performance']];
  const MOCK_LABEL = 'Estados do mockup: não faz parte do produto';
  const DEFAULT_SUB = 'O que os canais que você acompanha mudaram, o que está estourando agora e o que a forja leu disso, para decidir o próximo vídeo, título e thumbnail.';

  const st = {opts:null, niche:'todos', pop:null, forja:{active:false}, newTab:null, focusKey:null, mounted:false};
  const qs = ()=>new URLSearchParams(location.search);

  /* ---------------- nicho e tema (localStorage; ?niche= e ?theme= vencem e são persistidos) */
  function initPrefs(){
    const q = qs();
    const okT = t=>t==='light'||t==='dark';
    const th = okT(q.get('theme'))?q.get('theme'):store.get('obs-theme');
    if(okT(th)){ document.documentElement.dataset.theme=th; store.set('obs-theme',th); }
    const n = NICHES.includes(q.get('niche'))?q.get('niche'):store.get('obs-niche');
    st.niche = NICHES.includes(n)?n:'todos';
    store.set('obs-niche',st.niche);
    // parâmetro inválido na URL é ignorado e sai da URL (não fica para vencer no reload)
    if(q.has('theme')&&!okT(q.get('theme'))) syncUrl('theme',null);
    if(q.has('niche')&&!NICHES.includes(q.get('niche'))) syncUrl('niche',null);
  }
  function theme(){ return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'); }

  /* ---------------- dados do cabeçalho */
  const competitors = ()=>OBS.channels.filter(c=>!c.own);
  const problems = ()=>competitors().filter(c=>c.sync.state!=='ok');
  // CONVENCOES F7/F8: frase de problema = channel.sync.problemPhrase do motor; a montagem local é só reserva
  const syncText = c=>c.sync.state==='ok'?c.sync.label:c.sync.problemPhrase?c.sync.problemPhrase:c.sync.state==='backfill'?`ainda ${c.sync.label} (${c.sync.backfill.done} de ${c.sync.backfill.total})`:`${c.sync.label}: ${F.lcfirst(c.sync.msg)}`;
  const lastText = ts=>D.dm(ts)===D.dm(OBS.NOW)?'hoje '+D.hm(ts):D.dmhm(ts);
  const activeTab = ()=>{ const f=qs().get('from'); return st.opts.tab==='historico'?(TABS.includes(f)?f:'mudancas'):st.opts.tab; };

  /* ---------------- render das regiões */
  function sidebarHtml(){
    return `<a class="ch-side-logo" href="/cms">ByThiagoFigueiredo</a><button class="ch-btn ch-ghost ch-icon ch-side-close" type="button" data-ch-act="side-close" aria-label="Fechar menu do CMS">${ICON.x}</button>`+SIDEBAR.map(([g,items])=>`<p class="ch-side-g">${g}</p><ul>${items.map(([l,h])=>`<li><a href="${h||L(activeTab())}"${h?'':' aria-current="page"'}>${l}</a></li>`).join('')}</ul>`).join('');
  }
  function shellHtml(){
    return `<div class="ch-shell-l"><button class="ch-btn ch-ghost ch-icon ch-side-btn" type="button" id="ch-side-btn" aria-controls="ch-side" aria-expanded="false" aria-label="Abrir menu do CMS">${ICON.menu}</button><h1>YouTube</h1></div>
      <button class="ch-btn ch-ghost ch-icon" type="button" id="ch-theme" aria-label="Tema claro" aria-pressed="${theme()==='light'}" title="Tema claro">${ICON.sun}</button>`;
  }
  function shellTabsHtml(){
    return `<nav class="ch-shell-tabs" aria-label="Seções do YouTube">${SHELL_TABS.map(([l,h])=>`<a href="${h||L(activeTab())}"${h?'':' aria-current="page"'}>${l}</a>`).join('')}</nav>`;
  }
  function forjaHtml(){
    const f = st.forja;
    const none = forjaVariant()==='none';
    const pop = hasPopup()?' aria-haspopup="dialog"':'';
    // ativo + nicho livre (CONVENCOES F10): o botão segue habilitado para pedir o nicho livre; o ocupado fica como linha de status ATIVA
    const ask = f.canAsk&&f.askLabel&&!none ? `<button class="ch-btn ${forjaVariant()==='solid'?'ch-forja-solid':'ch-forja'}" type="button" data-ch-act="forja" data-ck="forja-ask"${pop} title="${esc(f.askLabel)}" aria-label="${esc(f.askLabel)}">${ICON.anvil}<span class="ch-lbl-t"><span class="ch-lf" aria-hidden="true">${esc(f.askLabel)}</span><span class="ch-ls" aria-hidden="true">${esc(f.askShort||f.askLabel)}</span></span></button>` : '';
    if(f.active) return `${ask||(none?'':`<button class="ch-btn ch-forja ch-busy" type="button" disabled title="Pedido em andamento">${ICON.anvil}<span class="ch-lbl-t">Pedido em andamento</span></button>`)}<button class="ch-btn ch-forja ${f.warn?'ch-warn':''}" type="button" id="ch-req-status" data-ch-act="status" data-ck="forja"${pop} aria-describedby="ch-req-desc" title="${esc(srJoin('Pedido em andamento: '+(f.status||''), f.statusText))}">${esc(f.status||'Ver andamento')}</button><span class="ch-sr" id="ch-req-desc">${esc(srJoin('Pedido em andamento', f.statusText))}</span>${(f.secondary||[]).map(x=>{ const t=typeof x==='string'?x:x.text, on=typeof x==='object'&&x.active; return `<span class="ch-pill ch-pill-2${on?' ch-on':''}" title="${esc(t)}"><span class="ch-sr">Outro pedido, </span>${esc(t)}</span>`; }).join('')}`;
    // nome acessível montado num texto só: o leitor de tela não insere espaço antes da pontuação (o .ch-sr fora do fluxo inseria)
    const pill = f.terminal&&f.status?`<span class="ch-pill ${f.warn?'ch-warn':''}" title="${esc(f.statusText||'')}"><span aria-hidden="true">${esc(f.status)}</span><span class="ch-sr">${esc(srJoin('Último pedido: '+f.status, f.statusText))}</span></span>`:'';
    if(none) return pill;
    if(f.disabled) return pill+`<button class="ch-btn ${forjaVariant()==='solid'?'ch-forja-solid':'ch-forja'}" type="button" disabled title="${esc(f.disabledText||'')}">${ICON.anvil}<span class="ch-lbl-t">${esc(f.label||'Pedir nova leitura à forja')}</span></button>`;
    // I7: com pílula terminal no modo compacto, o rótulo curto ("Pedir à forja") aparece; o nome acessível segue o rótulo inteiro
    return pill+`<button class="ch-btn ${forjaVariant()==='solid'?'ch-forja-solid':'ch-forja'}" type="button" data-ch-act="forja" data-ck="forja"${pop} title="${esc(f.label||'Pedir nova leitura à forja')}"${pill?` aria-label="${esc(f.label||'Pedir nova leitura à forja')}"`:''}>${ICON.anvil}<span class="ch-lbl-t">${pill?`<span class="ch-lf" aria-hidden="true">${esc(f.label||'Pedir nova leitura à forja')}</span><span class="ch-ls" aria-hidden="true">${esc(f.labelShort||'Pedir à forja')}</span>`:esc(f.label||'Pedir nova leitura à forja')}</span></button>`;
  }
  /** aria-haspopup só quando o painel que o botão abre é modal (drawer da tela abaixo de 1280 px) */
  function hasPopup(){ return !!st.opts.drawer && innerWidth<1280; }
  /** Hierarquia de ações: sólido onde a forja é a ação primária do contexto (insights, historico), contornado nas demais.
   *  Com o drawer aberto, o preenchido é o do drawer: o botão do cabeçalho fica contornado. */
  function forjaVariant(){
    if(st.drawerOpen && st.opts.forjaVariant!=='none') return 'outline';
    const v = st.opts.forjaVariant;
    if(v==='none') return 'none';
    if(v==='solid'||v==='outline') return v;
    return ['insights','historico'].includes(st.opts.tab)?'solid':'outline';
  }
  function machine(){ return st.forja.machine || {lastPollAt:OBS.forja.queue.lastPollAt, alive:true}; }
  function headHtml(){
    const o = st.opts, probs = problems(), m = machine();
    return `<div class="ch-obs-head">
      <div class="ch-obs-title"><h2>${esc(o.title||'Observatório de Competidores')}</h2><p>${esc(o.subtitle||DEFAULT_SUB)}</p></div>
      <div class="ch-actions">
        ${forjaHtml()}
        <button class="ch-btn" type="button" data-ch-act="sync" data-ck="sync" title="Sincronizar concorrentes">${ICON.sync}<span class="ch-lbl-t">Sincronizar concorrentes</span></button>
        <a class="ch-btn" href="${L('canais',{add:1})}" data-ck="add" title="Adicionar canal">${ICON.plus}<span class="ch-lbl-t">Adicionar canal</span></a>
        <div class="ch-menu-wrap"><button class="ch-btn ch-ghost ch-icon" type="button" aria-haspopup="menu" aria-expanded="${st.pop==='menu'}"${st.pop==='menu'?' aria-controls="ch-menu"':''} aria-label="Mais ações" data-ch-act="menu" data-ck="menu">${ICON.dots}</button>${st.pop==='menu'?menuHtml():''}</div>
      </div>
    </div>
    <div class="ch-fresh-row">
      <div class="ch-fresh">
        <button type="button" data-ch-act="fresh" data-ck="fresh" aria-expanded="${st.pop==='fresh'}"${st.pop==='fresh'?' aria-controls="ch-fresh-pop"':''}><span class="ch-sr">Frescor dos dados: </span>
          <span class="ch-seg"><span class="ch-dot ${probs.length?'ch-warn':''}" aria-hidden="true"></span><b>${st.niche==='todos'?F.plural(competitors().length,'canal','canais'):`${F.plural(competitors().filter(c=>c.niche===st.niche).length,'canal','canais')} em ${nicheLabel(st.niche)}`}</b>${st.niche==='todos'?'':`<span class="ch-long"> · ${competitors().length} no total</span>`}</span>
          <span class="ch-sep" aria-hidden="true"></span><span class="ch-sr">, </span>
          <span class="ch-seg" title="${esc(OBS.SYNC.title)}">${esc(OBS.SYNC.text)}</span>
          <span class="ch-sep" aria-hidden="true"></span><span class="ch-sr">, </span>
          ${probs.length?`<span class="ch-seg ch-err" data-fresh-probs="${probs.length}" title="${esc([...new Set(probs.map(c=>c.sync.label))].map(l=>`${probs.filter(c=>c.sync.label===l).length} ${l}`).join(', '))}">${ICON.warn}<span class="ch-long">${probsText(probs)}</span><span class="ch-short" aria-hidden="true">${st.niche==='todos'?probs.length:`${probs.filter(c=>c.niche===st.niche).length}/${probs.length}`}</span></span>`:'<span class="ch-seg" data-fresh-probs="0">todos em dia</span>'}
          ${ICON.chev}
        </button>
        <span class="ch-forja-seg ${m.alive?'':'ch-off'}" title="${esc(m.text||'')}"><span class="ch-dot ${m.alive?'ch-forja':'ch-warn'}" aria-hidden="true"></span>${m.alive?`<span>forja<span class="ch-long"> consultou às</span></span><b class="ch-num">${D.hm(m.lastPollAt)}</b>`:`forja <b>sem máquina · ${D.hm(m.lastPollAt)}</b>`}</span>
        ${st.pop==='fresh'?freshPopHtml():''}
      </div>
      <span class="ch-tz">${esc(OBS.TZ_LABEL)}</span>
    </div>`;
  }
  /** problemas de sincronização no nicho ativo e no total (o popover lista todos) */
  function probsText(probs){
    if(st.niche==='todos') return F.plural(probs.length,'canal com problema','canais com problema');
    const k=probs.filter(c=>c.niche===st.niche).length;
    return `${k} com problema em ${nicheLabel(st.niche)} · ${probs.length} no total`;
  }
  function freshPopHtml(){
    const probs = problems(), ok = competitors().filter(c=>c.sync.state==='ok');
    const row = (c,bad)=>`<tr class="${bad?'ch-bad':''}"><td>${esc(c.name)} <span class="ch-nic-${c.niche}">${nicheLabel(c.niche)}</span></td><td class="ch-m">${esc(syncText(c))}</td><td class="ch-num">${bad&&c.sync.state!=='backfill'?'<span aria-hidden="true">—</span><span class="ch-sr">data na coluna Situação</span>':lastText(c.sync.last)}</td></tr>`;   // M5: com problema, a frase do motor já traz a data
    const next = OBS.SYNC.nextText;
    return `<div class="ch-pop" id="ch-fresh-pop" role="dialog" aria-label="Frescor por canal">
      <h3>Frescor por canal</h3>
      <p class="ch-sub">Sincronização ${esc(OBS.SYNC.cadence)}. ${esc(next[0].toUpperCase()+next.slice(1))}. ${esc(OBS.TZ_LABEL)}.</p>
      <div style="max-height:300px;overflow:auto" tabindex="0" role="region" aria-label="Canais e última sincronização"><table><thead><tr><th scope="col">Canal</th><th scope="col">Situação</th><th scope="col">Última sincronização</th></tr></thead><tbody>
        ${probs.length?`<tr class="ch-grp"><td colspan="3">Com problema (${probs.length})</td></tr>`+probs.map(c=>row(c,true)).join('')+`<tr class="ch-grp"><td colspan="3">Em dia (${ok.length})</td></tr>`:''}
        ${ok.map(c=>row(c,false)).join('')}
      </tbody></table></div>
      <div class="ch-pop-acts"><button class="ch-btn" type="button" data-ch-act="sync" data-from-pop="1">${ICON.sync}Sincronizar concorrentes</button>${probs.length?`<a class="ch-btn ch-ghost" href="${L('canais',{filter:'problemas'})}">Ver os canais com problema</a>`:''}</div>
    </div>`;
  }
  function coworkText(){
    const o = st.opts, n = st.niche==='todos'?'todos os nichos':`nicho ${nicheLabel(st.niche)}`;
    const own = o.cowork?o.cowork({tab:o.tab, niche:st.niche}):null;
    if(own) return own;
    const base = {
      canais:`Compare os canais monitorados no Observatório (${n}) via youtube_observatory: crescimento de views, frequência de publicação e frescor da sincronização. Aponte quem acelerou.`,
      mudancas:`Liste as trocas de título, thumbnail e descrição dos concorrentes (${n}, últimos 30 dias) via youtube_observatory. Para as que já têm 7 dias depois da troca, compare a média de views/dia observada com a esperada pela idade. Não afirme causa.`,
      outliers:`Liste os outliers dos concorrentes (${n}, longos, até 90 dias, 2× ou mais ajustado pela idade) via youtube_observatory e sugira 3 ângulos de vídeo para o meu canal.`,
      insights:`Leia as leituras da forja (${n}) via youtube_observatory e proponha 3 títulos para o meu próximo vídeo que sigam só as fórmulas que passam a regra.`,
      historico:`Leia o histórico deste vídeo (títulos, thumbnails, descrições e a curva de views) via youtube_observatory e diga o que mudou e quando. Não afirme causa.`,
    };
    return base[o.tab]+' Use o MCP bythiagofigueiredo.';
  }
  function menuHtml(){
    const extra = (st.opts.menuItems||[]).map((it,i)=>it.href?`<a class="ch-mi" role="menuitem" tabindex="-1" href="${esc(it.href)}"><strong>${esc(it.label)}</strong>${it.ctx?`<span class="ch-ctx">${esc(it.ctx)}</span>`:''}</a>`:`<button class="ch-mi" role="menuitem" type="button" tabindex="-1" data-ch-act="mi" data-i="${i}"><strong>${esc(it.label)}</strong>${it.ctx?`<span class="ch-ctx">${esc(it.ctx)}</span>`:''}</button>`).join('');
    return `<div class="ch-pop ch-menu" id="ch-menu" role="menu" aria-label="Mais ações">
      <button class="ch-mi" role="menuitem" type="button" tabindex="-1" data-ch-act="cowork" aria-label="Copiar pedido para o Cowork" aria-describedby="ch-cowork-prev"><strong>${ICON.copy}Copiar pedido para o Cowork</strong><span class="ch-ctx">Copia este texto, montado a partir desta tela e do nicho atual. Depois, cole no Cowork com ⌘V.</span><span class="ch-preview" id="ch-cowork-prev">${esc(coworkText())}</span></button>
      <hr>
      <a class="ch-mi" role="menuitem" tabindex="-1" href="${L('canais')}"><strong>Definir nicho dos canais</strong><span class="ch-ctx">Abre a aba Canais.</span></a>
      ${extra}
    </div>`;
  }
  function navHtml(){
    // links das abas usam o nicho PERSISTIDO (CONVENCOES F4): uma exibição com persist:false não vaza para as outras telas
    const pn = store.get('obs-niche'), linkNiche = NICHES.includes(pn)?pn:'todos';
    const counts = OBS.tabCounts(linkNiche), cur = activeTab(), np = linkNiche==='todos'?{}:{niche:linkNiche};   // N da aba = N do destino
    const tabs = TABS.map(k=>{
      const key = TABKEY[k], c = key?counts[key]:null;
      const ttl = key?OBS.TAB_TITLES[key](c):'Leituras publicadas pela forja';
      return `<a class="ch-tab" href="${L(k,np)}" data-tab="${k}" data-ck="tab-${k}" ${k===cur?'aria-current="page"':''} title="${esc(ttl[0].toUpperCase()+ttl.slice(1))}">${TABNAME[k]}${key?`<span class="ch-ct" data-count="${k}">${c}</span>`:''}${st.newTab===k&&k!==cur?'<span class="ch-new">nova</span>':''}</a>`;
    }).join('');
    const th = theme();
    const niche = NICHES.map(n=>`<button type="button" aria-pressed="${st.niche===n}" data-ch-niche="${n}" data-ck="niche-${n}">${n==='todos'?'':`<span class="ch-sw" style="background:${OBS.NICHES[n].color[th]}" aria-hidden="true"></span>`}${nicheLabel(n)}<span class="ch-n" aria-hidden="true">${OBS.tabCounts(n).canais}</span><span class="ch-sr">, ${OBS.tabCounts(n).canais} canais</span></button>`).join('');
    return `<nav class="ch-tabs" aria-label="Seções do Observatório">${tabs}</nav>
      <div class="ch-niche"><span class="ch-lbl" id="ch-nl">Nicho</span><div class="ch-seg-ctl" role="group" aria-labelledby="ch-nl" aria-describedby="ch-pinhint">${niche}</div>
      <span class="ch-pin" title="Vale para todas as abas e fica salvo">${ICON.pin}<span class="ch-sr" id="ch-pinhint">Vale para todas as abas e fica salvo</span></span></div>`;
  }
  function mockHtml(){
    const o = st.opts;
    let groups = o.mockStates||[];
    if(groups.length && !groups[0].items) groups = [{label:'Estados', items:groups}];
    const deps = o.deps||[];
    return groups.map((g,gi)=>`<div class="ch-mock-row" role="group" aria-labelledby="ch-mock-l${gi}"><span class="ch-mock-lbl" id="ch-mock-l${gi}">${esc(g.label)}</span><span class="ch-mock-items">${g.items.map(it=>`<button type="button" aria-pressed="${!!it.pressed}" data-ch-mock="${esc(it.id)}" data-group="${gi}">${esc(it.label)}</button>`).join('')}${g.note?`<span class="ch-mock-note">${esc(g.note)}</span>`:''}</span></div>`).join('')
      + `<div class="ch-mock-slot" id="ch-mock-slot"></div>`
      + depsHtml(deps);
  }
  function depsHtml(deps){
    return (deps.length?`<details class="ch-deps"><summary>Dependências novas (${deps.length}): o que o mockup mostra e o backend ainda não tem</summary><ol>${deps.map(d=>Array.isArray(d)?`<li><b>${d[0]}</b>: ${d[1]}</li>`:`<li><b>${d.title}</b>: ${d.text}</li>`).join('')}</ol></details>`:'');
  }
  /** troca os itens do painel "Dependências novas" depois do mount (preserva aberto/fechado) */
  function setDeps(deps){
    st.opts.deps = deps||[];
    const box=document.getElementById('ch-mock-in'), old=box.querySelector('.ch-deps'), wasOpen=old&&old.open;
    if(old) old.remove();
    box.insertAdjacentHTML('beforeend', depsHtml(st.opts.deps));
    const nu=box.querySelector('.ch-deps'); if(nu&&wasOpen) nu.open=true;
  }

  /* ---------------- montagem */
  function $(s){ return typeof s==='string'?document.querySelector(s):s; }
  function mount(opts){
    if(!opts||!opts.tab) throw new Error('CHROME.mount: tab obrigatório');
    if(st.mounted) destroy();
    Object.assign(st,{pop:null, forja:{active:false}, newTab:null, focusKey:null, drawerOpen:false, sideOpen:false});
    st.opts = opts; initPrefs();
    const content = $(opts.content||'#screen');
    const drawer = opts.drawer?$(opts.drawer):null;
    const mock = document.createElement('details'); mock.className='ch-mock'; mock.id='ch-mock';
    mock.innerHTML = `<summary>${MOCK_LABEL}</summary><div class="ch-mock-in" id="ch-mock-in"></div>`;
    const app = document.createElement('div'); app.className='ch-app';
    app.id='ch-app';
    app.innerHTML = `<nav class="ch-side" id="ch-side" aria-label="CMS"></nav>
      <div class="ch-main"><header class="ch-shell" id="ch-shell"></header><div class="ch-shell-tabs-wrap" id="ch-shell-tabs"></div>
        <div class="ch-page" id="ch-page"><main class="ch-content" id="ch-content"><div id="ch-head"></div><div class="ch-nav" id="ch-nav"></div></main></div></div>`;
    const toasts = document.createElement('div'); toasts.className='ch-toasts'; toasts.id='ch-toasts'; toasts.setAttribute('role','region'); toasts.setAttribute('aria-label','Avisos'); toasts.setAttribute('aria-live','polite');
    const backdrop = document.createElement('div'); backdrop.className='ch-backdrop'; backdrop.id='ch-backdrop'; backdrop.hidden=true;
    const sideBackdrop = document.createElement('div'); sideBackdrop.id='ch-side-backdrop'; sideBackdrop.hidden=true;
    document.body.prepend(mock); mock.after(app); app.after(backdrop); backdrop.after(sideBackdrop); sideBackdrop.after(toasts);
    st.nodes = [mock, app, backdrop, sideBackdrop, toasts]; st.content = content; st.drawerEl = drawer;
    if(content){ content.classList.add('ch-screen'); document.getElementById('ch-content').appendChild(content); }   // D8: o chrome define o espaço acima da tela
    if(drawer){ drawer.classList.add('ch-drawer'); document.getElementById('ch-page').appendChild(drawer); }
    document.getElementById('ch-side').innerHTML = sidebarHtml();
    document.getElementById('ch-shell').innerHTML = shellHtml();
    document.getElementById('ch-shell-tabs').innerHTML = shellTabsHtml();
    document.getElementById('ch-mock-in').innerHTML = mockHtml();
    st.mounted = true;
    refresh();
    wire();
    return CHROME;
  }
  function refresh(){
    if(!st.mounted) return;
    st.inRefresh = true;   // o redesenho move o foco: o ouvinte de focusin não pode fechar popovers por isso
    try{
      const ae = document.activeElement, key = st.focusKey || (ae&&ae.dataset?ae.dataset.ck:null); st.focusKey=null;
      document.getElementById('ch-head').innerHTML = headHtml();
      document.getElementById('ch-nav').innerHTML = navHtml();
      const tb=document.querySelector('#ch-nav .ch-tabs');
      if(tb){ fitTabs(); tb.addEventListener('scroll',()=>tabFades(tb),{passive:true}); }
      if(key){ const el=document.querySelector(`[data-ck="${key}"]`); if(el&&!el.disabled) el.focus(); }
    } finally { st.inRefresh = false; }
  }

  /** degradê nas bordas do trilho de abas: à direita se há abas depois, à esquerda se rolou (scrollLeft>0) */
  /** aba atual sempre inteira à vista (rolagem do próprio trilho, sem mexer na página) + degradês; roda depois de cada mudança de largura */
  function fitTabs(){
    const tb=document.querySelector('#ch-nav .ch-tabs'); if(!tb) return;
    const cur=tb.querySelector('[aria-current]'); if(cur){ const l=cur.offsetLeft-tb.offsetLeft, r=l+cur.offsetWidth; if(l<tb.scrollLeft) tb.scrollLeft=l; else if(r>tb.scrollLeft+tb.clientWidth) tb.scrollLeft=r-tb.clientWidth+8; }
    tabFades(tb);
  }
  function tabFades(tb){
    tb.classList.toggle('ch-more', tb.scrollLeft+tb.clientWidth < tb.scrollWidth-2);
    tb.classList.toggle('ch-less', tb.scrollLeft > 2);
  }
  /* ---------------- eventos */
  const H = {};
  function wire(){
    H.click = e=>{
      if(e.target.id==='ch-backdrop'){ if(st.opts.onBackdrop) st.opts.onBackdrop(); return; }
      const el = e.target.closest('[data-ch-act],[data-ch-niche],[data-ch-mock]');
      if(!el){ if(st.pop && !e.target.closest('.ch-pop')){ st.pop=null; refresh(); } return; }
      if(el.disabled) return;
      const a = el.dataset;
      if(a.chMock){ const g=+a.group; if(st.opts.onMock) st.opts.onMock(a.chMock, g); return; }
      if(a.chNiche){ setNiche(a.chNiche); return; }
      switch(a.chAct){
        case 'menu': st.pop = st.pop==='menu'?null:'menu'; st.focusKey='menu'; refresh(); if(st.pop==='menu'){ const f=document.querySelector('#ch-menu [role=menuitem]'); f&&f.focus(); } break;
        case 'fresh': st.pop = st.pop==='fresh'?null:'fresh'; st.focusKey='fresh'; refresh(); break;
        case 'forja': st.pop=null; if(st.opts.onForja) st.opts.onForja(); else location.href = L('insights'); break;
        case 'status': st.pop=null; if(st.opts.onStatus) st.opts.onStatus(); else goToAnchor(); break;
        case 'sync': { if(a.fromPop) st.focusKey='fresh'; st.pop=null; refresh(); if(st.opts.onSync) st.opts.onSync(); else defaultSync(); break; }
        case 'cowork': { const text=coworkText(); st.pop=null; st.focusKey='menu'; refresh(); copyText(text); break; }
        case 'side-close': closeSide(true); break;
        case 'mi': { const it=(st.opts.menuItems||[])[+a.i]; st.pop=null; st.focusKey='menu'; refresh(); it&&it.onClick&&it.onClick(); break; }
      }
    };
    document.addEventListener('click',H.click);
    H.key = e=>{
      // M6: no botão ⋯, seta para baixo/para cima abre o menu no primeiro/último item (padrão de menu button)
      if(e.target.matches && e.target.matches('[data-ch-act="menu"]') && (e.key==='ArrowDown'||e.key==='ArrowUp')){
        e.preventDefault(); st.pop='menu'; st.focusKey='menu'; refresh();
        const items=[...document.querySelectorAll('#ch-menu [role=menuitem]')]; const it=e.key==='ArrowDown'?items[0]:items[items.length-1]; it&&it.focus(); return; }
      const menu = e.target.closest && e.target.closest('#ch-menu');
      if(menu){
        const items=[...document.querySelectorAll('#ch-menu [role=menuitem]')], i=items.indexOf(document.activeElement);
        if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus();return}
        if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus();return}
        if(e.key==='Home'){e.preventDefault();items[0].focus();return}
        if(e.key==='End'){e.preventDefault();items[items.length-1].focus();return}
        if(e.key==='Tab'){st.pop=null;st.focusKey='menu';refresh();return}
      }
      const side=document.getElementById('ch-side');
      // sidebar aberta como painel: Tab circula dentro dela (o resto da página está inerte)
      if(e.key==='Tab' && st.sideOpen){
        const f=[...side.querySelectorAll('a[href],button:not([disabled])')].filter(x=>x.offsetParent!==null);
        if(f.length){ const first=f[0], last=f[f.length-1];
          if(!side.contains(document.activeElement)){ e.preventDefault(); first.focus(); return; }
          if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); return; }
          if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); return; } }
      }
      if(e.key==='Escape'){
        if(st.pop){ const k=st.pop==='menu'?'menu':'fresh'; st.pop=null; st.focusKey=k; refresh(); e.stopImmediatePropagation(); return; }
        if(st.sideOpen){ closeSide(true); e.stopImmediatePropagation(); return; }
      }
    };
    document.addEventListener('keydown',H.key,true);
    H.focusin = e=>{ if(!st.pop||st.inRefresh) return; const box=document.querySelector(st.pop==='menu'?'#ch-app .ch-menu-wrap':'#ch-app .ch-fresh'); if(box&&!box.contains(e.target)){ st.pop=null; refresh(); } };
    document.addEventListener('focusin',H.focusin);
    let raf=0;
    H.resize = ()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; if(!st.mounted) return; if(innerWidth>1100) closeSide(false); if(st.drawerOpen) drawer(true); else refresh(); }); };
    window.addEventListener('resize',H.resize);
    document.getElementById('ch-theme').addEventListener('click',()=>{ setTheme(theme()==='light'?'dark':'light'); });
    document.getElementById('ch-side-btn').addEventListener('click',()=>openSide());
    document.getElementById('ch-side-backdrop').addEventListener('click',()=>closeSide(true));
  }

  /** sincronização padrão: nada de sucesso fabricado; o resultado diz quantos sincronizaram e quais ficaram com problema */
  let syncing=false;
  function defaultSync(){
    if(syncing) return; syncing=true;
    const order=['viagem','ia'];
    const list = ps=>ps.slice().sort((a,b)=>order.indexOf(a.niche)-order.indexOf(b.niche)).map(c=>`${c.name}: ${c.sync.problemPhrase||c.sync.label}`).join('; ');
    if(typeof OBS.runSync==='function'){
      // CONVENCOES F6: a sincronização do mockup passa sempre pelo motor; só canais ok viram "agora"
      // Canais F10 M3: na rodada só entram os concorrentes que não estão buscando vídeos (a coleta segue a própria fila)
      const inRound=competitors().filter(c=>c.sync.state!=='backfill').length;
      toast('','Sincronização iniciada',`${F.plural(inRound,'canal','canais')} na fila de sincronização.`);
      setTimeout(()=>{ syncing=false; if(!st.mounted) return;
        const res=OBS.runSync()||{}; refresh(); if(st.opts.onSynced) st.opts.onSynced(res);
        // F11 M3: o motor separa problemas (erro/atrasado) de "fora da rodada" (buscando vídeos)
        const probIds=(res.problems||[]).map(x=>typeof x==='string'?x:x.id);
        const probs=Array.isArray(res.problems)?competitors().filter(c=>probIds.includes(c.id)):problems();
        const out=(res.outOfRound||[]).map(x=>{ const c=competitors().find(y=>y.id===x.id); return `${c?c.name:x.id} (${x.label})`; });
        const ok=Array.isArray(res.ok)?res.ok.length:competitors().length-probs.length, total=ok+probs.length;
        const more=out.length?`Fora da rodada: ${out.join('; ')}.`:'';
        if(!probs.length) toast('ok','Concorrentes sincronizados',`${ok} de ${F.plural(total,'canal sincronizado','canais sincronizados')} agora.`,null,{more});
        else toast('warn',`${ok} de ${total} canais sincronizados agora; ${probs.length} com problema`, list(probs)+'.',null,{more});
      }, 1200);
      return;
    }
    // motor sem runSync: nada de sucesso inventado; mostra o resultado da última sincronização real
    syncing=false;
    const probs=problems(), ok=competitors().length-probs.length;
    toast(probs.length?'warn':'ok',`Resultado da sincronização das ${D.hm(OBS.SYNC.last)}`, `${F.plural(ok,'canal sincronizado','canais sincronizados')}${probs.length?`; ${probs.length} com problema: ${list(probs)}`:''}.`);
  }
  /** copia de verdade (await); se o navegador negar, avisa e mostra o texto selecionável no próprio aviso */
  async function copyText(text){
    try{
      if(!navigator.clipboard||!navigator.clipboard.writeText) throw new Error('sem clipboard');
      await navigator.clipboard.writeText(text);
      toast('ok','Pedido copiado para o Cowork','Cole no Cowork com ⌘V.');
    }catch(err){
      toast('warn','Não deu para copiar','O navegador bloqueou a área de transferência. Selecione o texto abaixo e copie com ⌘C.',null,{selectable:text});
    }
  }
  /** desmonta o chrome: devolve o conteúdo e o drawer ao <body>, remove os nós e os ouvintes; mount() pode ser chamado de novo */
  function destroy(){
    if(!st.mounted) return;
    document.removeEventListener('click',H.click); document.removeEventListener('keydown',H.key,true); document.removeEventListener('focusin',H.focusin); window.removeEventListener('resize',H.resize);
    if(st.content){ st.content.classList.remove('ch-screen'); document.body.appendChild(st.content); }
    if(st.drawerEl){ st.drawerEl.classList.remove('ch-drawer'); st.drawerEl.removeAttribute('role'); st.drawerEl.removeAttribute('aria-modal'); document.body.appendChild(st.drawerEl); }
    clearToasts();
    (st.nodes||[]).forEach(n=>n.remove());
    st.mounted=false; st.pop=null; st.drawerOpen=false;
  }
  /** padrão do clique no status do pedido: rola até a âncora de andamento da tela ([data-forja-anchor]); nunca cria pedido */
  function goToAnchor(){
    const a=document.querySelector('[data-forja-anchor]'); if(!a) return;
    if(!a.hasAttribute('tabindex')) a.setAttribute('tabindex','-1');
    a.scrollIntoView({block:'center', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); a.focus({preventScroll:true});
  }
  /* ---------------- sidebar como painel (< 1100 px) */
  /** st.sideOpen é a única fonte; classe, aria e inert são derivados em applySide() */
  function applySide(){
    const side=document.getElementById('ch-side'), btn=document.getElementById('ch-side-btn'), o=!!st.sideOpen;
    side.classList.toggle('ch-open',o); document.getElementById('ch-side-backdrop').hidden=!o;
    btn.setAttribute('aria-expanded',String(o)); btn.setAttribute('aria-label',o?'Fechar menu do CMS':'Abrir menu do CMS');
    document.querySelector('#ch-app .ch-main').inert=o; document.getElementById('ch-mock').inert=o||(st.drawerOpen&&innerWidth<1280);
  }
  function openSide(){ st.sideOpen=true; applySide(); document.getElementById('ch-side').querySelector('a[aria-current]').focus(); }
  function closeSide(focusBtn){ if(!st.sideOpen) return; st.sideOpen=false; applySide(); if(focusBtn) document.getElementById('ch-side-btn').focus(); }
  /** grava ?niche= / ?theme= na URL atual sem recarregar, para um parâmetro velho não vencer no reload */
  function syncUrl(key,val){
    try{ const u=new URL(location.href); if(val==null) u.searchParams.delete(key); else u.searchParams.set(key,val); history.replaceState(history.state,'',u.toString()); }catch(e){}
  }
  /** estado do pedido a partir de forja.requestScenario: botão "Pedido em andamento" + status "na fila · 14:58" */
  const ACTIVE_STATES = ['na fila','trabalhando','atrasado','sem máquina','nova tentativa','liberado pelo vigia'];
  const WARN_STATES = ['atrasado','sem máquina','nova tentativa','liberado pelo vigia'];
  const TERMINAL_STATES = ['publicado','falhou','recusado (dado velho)'];
  /** formato único (CONVENCOES, rodada F3): a hora é a do evento que o rótulo nomeia */
  /** texto do status: o do motor (sc.statusLabel) tal como vem; a montagem local é só reserva para cenários antigos */
  /** "a" + ". " + "b" sem espaço antes da pontuação e sem ponto duplo ("…14:21." + "Falhou…" → "…14:21. Falhou…") */
  function srJoin(a,b){
    a=String(a||'').trim(); b=String(b||'').trim(); if(!b) return a; if(!a) return b;
    return (/[.!?…:;]$/.test(a)?a:a+'.')+' '+b;
  }
  function statusLabel(sc){
    if(sc.statusLabel) return sc.statusLabel;
    const r=sc.request, m=sc.machine||{};
    const T = {
      'na fila':['na fila · pedido', r.createdAt], 'trabalhando':['trabalhando desde', r.startedAt||r.claimedAt],
      'atrasado':['atrasado · pedido', r.createdAt], 'sem máquina':['sem máquina desde', m.lastPollAt],
      'nova tentativa':['nova tentativa ·', m.nextPollAt], 'liberado pelo vigia':['liberado pelo vigia ·', m.nextPollAt],
      'falhou':['falhou às', r.failedAt], 'recusado (dado velho)':['recusado às', r.refusedAt], 'publicado':['publicado às', r.publishedAt],
    }[r.state];
    return T&&T[1]?`${T[0]} ${D.hm(T[1])}`:r.state;   // sem horário: só o estado, nunca uma hora inventada
  }
  function forjaFromScenario(sc){
    if(!sc||!sc.request) return {machine:sc&&sc.machine};
    // pedido dividido (Todos): o motor diz se ALGUM pedido ainda está ativo (anyActive), se todos terminaram (terminal)
    // e dá uma linha por nicho (statusLines, "Viagem: trabalhando desde 14:55"). O cabeçalho segue o pedido ativo.
    const reqs = sc.requests&&sc.requests.length?sc.requests:[sc.request];
    if(sc.statusLines && reqs.length>1){
      const ai = reqs.findIndex(x=>ACTIVE_STATES.includes(x.state));
      const anyActive = sc.anyActive!=null?!!sc.anyActive:ai>=0;
      if(anyActive && ai>=0){ const x=reqs[ai]; const secondary=sc.statusLines.filter((_,i)=>i!==ai&&!ACTIVE_STATES.includes(reqs[i].state)); return {active:true, terminal:false, status:sc.statusLines[ai], secondary, statusText:sc.statusText, warn:WARN_STATES.includes(x.state), machine:sc.machine}; }
      const bad = reqs.some(x=>x.state==='falhou'||x.state==='recusado (dado velho)');
      return {active:false, terminal:sc.terminal!=null?!!sc.terminal:true, status:sc.statusLines.join(' · '), statusText:sc.statusText, warn:bad, machine:sc.machine};
    }
    const r=sc.request, active=sc.anyActive!=null?!!sc.anyActive:ACTIVE_STATES.includes(r.state), terminal=sc.terminal!=null?!!sc.terminal:TERMINAL_STATES.includes(r.state);
    return {active, terminal, status:statusLabel(sc), statusText:sc.statusText, warn:WARN_STATES.includes(r.state)||r.state==='falhou'||r.state==='recusado (dado velho)', machine:sc.machine};
  }

  /* ---------------- API pública */
  /** {silent}: não chama onNiche; {persist:false}: só esta exibição (não grava obs-niche nem a URL) */
  function setNiche(n,{silent, persist=true}={}){
    if(!NICHES.includes(n)) return;
    st.niche = n; st.pop = null;
    if(persist){ store.set('obs-niche',n); syncUrl('niche', n); }
    refresh();
    if(!silent && st.opts.onNiche) st.opts.onNiche(n);
  }
  function setTheme(t){
    if(t!=='light'&&t!=='dark') return;
    document.documentElement.dataset.theme=t; store.set('obs-theme',t); syncUrl('theme', t);
    const tb=document.getElementById('ch-theme'); if(tb) tb.setAttribute('aria-pressed', String(t==='light'));
    refresh();
    if(st.opts.onTheme) st.opts.onTheme(t);
  }
  /** estado do botão da forja e do segmento de heartbeat:
   *  {active, status (curto: "na fila · 14:58"), statusText (frase do motor), warn, machine:{alive,lastPollAt,text}, label, disabled, disabledText}.
   *  Para pedidos do motor, use CHROME.forjaFromScenario(OBS.forja.requestScenario(...)). */
  function setForja(f){ st.forja = Object.assign({}, f||{}); refresh(); }
  /** marca botões da barra de estados: {groupIndex: id} ou um id */
  function setMockPressed(sel){
    document.querySelectorAll('#ch-mock-in [data-ch-mock]').forEach(b=>{
      const want = typeof sel==='object'&&sel!==null ? sel[b.dataset.group] : sel;
      b.setAttribute('aria-pressed', String(b.dataset.chMock===want));
    });
  }
  function setTabNew(tab){ st.newTab = tab||null; refresh(); }
  /** troca a aba ativa (só para a moldura, que mostra amostras de cada aba) */
  function setTab(tab){ st.opts.tab = tab; document.getElementById('ch-side').innerHTML=sidebarHtml(); document.getElementById('ch-shell-tabs').innerHTML=shellTabsHtml(); refresh(); }
  /** atualização em lote, um só redesenho: {tab?, niche?, forja?, newTab?} (niche aqui não dispara onNiche) */
  function update(u={}){
    if(u.tab && u.tab!==st.opts.tab){ st.opts.tab=u.tab; document.getElementById('ch-side').innerHTML=sidebarHtml(); document.getElementById('ch-shell-tabs').innerHTML=shellTabsHtml(); }
    if(u.niche && NICHES.includes(u.niche) && u.niche!==st.niche){ st.niche=u.niche; st.pop=null; if(u.persist!==false){ store.set('obs-niche',u.niche); syncUrl('niche',u.niche); } }
    if('forja' in u) st.forja = Object.assign({}, u.forja||{});
    if('newTab' in u) st.newTab = u.newTab||null;
    refresh();
  }
  /** drawer lateral: >= 1280 px ocupa coluna; abaixo vira modal (fundo inerte + backdrop). Devolve true se modal. */
  function drawer(open){
    const page=document.getElementById('ch-page'), modal=innerWidth<1280;
    st.drawerOpen=!!open; refresh();
    page.classList.toggle('ch-with-drawer',!!open);
    document.getElementById('ch-backdrop').hidden = !(open&&modal);
    ['ch-side','ch-shell','ch-shell-tabs','ch-content','ch-mock'].forEach(id=>{document.getElementById(id).inert=!!(open&&modal)});
    if(st.sideOpen) applySide();
    document.getElementById('ch-toasts').classList.toggle('ch-lift', !!(open&&modal));
    const d=page.querySelector('.ch-drawer');
    if(d){ if(open&&modal){d.setAttribute('role','dialog');d.setAttribute('aria-modal','true')}else{d.removeAttribute('role');d.removeAttribute('aria-modal')} }
    fitTabs();   // a coluna do drawer muda a largura do trilho de abas
    return modal;
  }
  /* toasts: região aria-live sem role aninhado; cada aviso entra e sai como nó próprio (sem redesenhar os outros);
     pausa com mouse ou foco em cima; ✕ de 32 px; com ação (ou texto para copiar), não some sozinho;
     ao fechar um aviso que tinha o foco, o foco volta para onde estava antes dele */
  const toastList=[]; const TOAST_MS=6500;
  function toast(kind,title,text,act,opt={}){
    const box=document.getElementById('ch-toasts'); if(!box) return;
    const t={id:Math.random().toString(36).slice(2),kind,title,text,act,sticky:!!(act||opt.selectable),left:TOAST_MS,timer:null,since:0,back:null};
    const el=document.createElement('div'); el.className='ch-toast'+(kind?' ch-'+kind:''); el.dataset.tid=t.id; t.el=el;
    el.innerHTML=`${kind==='bad'?ICON.x:kind==='warn'?ICON.warn:kind==='ok'?ICON.check:kind==='forja'?ICON.anvil:ICON.info}<div><b>${esc(title)}</b><span>${esc(text)}</span>${opt.more?`<span class="ch-tl">${esc(opt.more)}</span>`:''}${opt.selectable?`<textarea class="ch-copy" readonly rows="3" aria-label="Texto do pedido para copiar">${esc(opt.selectable)}</textarea>`:''}</div><div class="ch-toast-acts">${act?`<button class="ch-btn" type="button" data-toast-act>${esc(act.label)}</button>`:''}<button class="ch-btn ch-ghost ch-icon ch-toast-x" type="button" data-toast-x aria-label="Fechar aviso">${ICON.x}</button></div>`;
    const a=el.querySelector('[data-toast-act]'); if(a) a.addEventListener('click',()=>{ act.onClick&&act.onClick(); dismiss(t.id); });
    el.querySelector('[data-toast-x]').addEventListener('click',()=>dismiss(t.id));
    el.addEventListener('mouseenter',()=>pauseToast(t)); el.addEventListener('mouseleave',()=>startToast(t));
    el.addEventListener('focusin',e=>{ if(!t.back&&e.relatedTarget&&!el.contains(e.relatedTarget)) t.back=e.relatedTarget; pauseToast(t); });
    el.addEventListener('focusout',e=>{ if(!el.contains(e.relatedTarget)) startToast(t); });
    toastList.push(t); box.appendChild(el); startToast(t);
    if(opt.selectable){ const ta=el.querySelector('.ch-copy'); ta.focus({preventScroll:true}); ta.select(); }
  }
  function startToast(t){ if(t.sticky) return; t.since=Date.now(); clearTimeout(t.timer); t.timer=setTimeout(()=>dismiss(t.id),t.left); }
  function pauseToast(t){ if(!t.timer) return; clearTimeout(t.timer); t.timer=null; t.left=Math.max(1000,t.left-(Date.now()-t.since)); }
  function dismiss(id){
    const i=toastList.findIndex(t=>t.id===id); if(i<0) return;
    const t=toastList[i], had=t.el.contains(document.activeElement);
    clearTimeout(t.timer); toastList.splice(i,1); t.el.remove();
    if(had){ const to=(t.back&&t.back.isConnected&&!t.back.closest('[inert]'))?t.back:document.getElementById('ch-content'); if(to===document.getElementById('ch-content')) to.setAttribute('tabindex','-1'); to.focus({preventScroll:true}); }
  }
  function clearToasts(){ toastList.slice().forEach(t=>{ clearTimeout(t.timer); t.el.remove(); }); toastList.length=0; }

  const CHROME = {
    version:'2.2', mount, destroy, refresh, update, setTab, setDeps, forjaFromScenario, statusLabel, openSide, closeSide, setNiche, setTheme, setForja, setMockPressed, setTabNew, drawer, toast, clearToasts,
    niche:()=>st.niche, theme, link:L, nicheLabel, store,
    get el(){ return {content:document.getElementById('ch-content'), page:document.getElementById('ch-page'), mockSlot:document.getElementById('ch-mock-slot'), mock:document.getElementById('ch-mock')}; },
  };
  window.CHROME = CHROME;
})();
