/* ============================================================
   DRAFT EDITOR v4 — CLEAN CANVAS + real PT/EN versions.
   · The document (title + prose) is the hero.
   · A PT/EN toggle in the bar switches the version you edit —
     each language is its OWN draft (title, slug, body, resumo),
     never an auto-translation. Missing version → create it.
   · No readiness meter. Free stage navigation. The only lock
     is on Agendar/Publicar (shows exactly what's missing).
   ============================================================ */

const DEFAULT_BODY = [{ t: "p", html: "" }];
const EXAMPLE_IMG = "assets/cover-example.png";

function seedContent(post) {
  const here = post.lang;
  const c = {};
  c[here] = {
    lang: here,
    title: post.title,
    slug: post.slug || window.deriveSlug(post.title),
    slugTouched: !!post.slug,
    excerpt: post.excerpt || "",
    hook: post.hook || "",
    sinopse: post.sinopse || "",
    body: post.body || DEFAULT_BODY,
    published: !!post.sitePublished,
    coverReady: !!post.coverReady,
    coverImg: post.coverImg || (post.coverReady ? EXAMPLE_IMG : null),
    words: post.words || 0,
    readTime: post.readTime || "",
    publishedAt: post.publishedAt || null,
    updatedAt: null,
    dirty: false,
  };
  const sib = (post.versions || []).find(v => v.lang !== here);
  if (sib) {
    const sp = (window.DATA.blog.posts || []).find(p => p.code === sib.code) || {};
    c[sib.lang] = {
      lang: sib.lang,
      title: sib.title || sp.title || "",
      slug: sp.slug || window.deriveSlug(sib.title || sp.title || ""),
      slugTouched: true,
      excerpt: sp.excerpt || "",
      hook: sp.hook || "",
      sinopse: sp.sinopse || "",
      body: sp.body || DEFAULT_BODY,
      published: sib.status === "published",
      coverReady: !!sp.coverReady,
      coverImg: sp.coverImg || (sp.coverReady ? EXAMPLE_IMG : null),
      words: sp.words || 0,
      readTime: sp.readTime || "",
      publishedAt: sp.publishedAt || null,
      updatedAt: null,
      dirty: false,
    };
  }
  return c;
}

function isEmptyVersion(v) {
  if (!v) return true;
  if (v.published) return false;
  const hasTitle = !!(v.title || "").trim();
  const hasBody = !!(v.body || []).some(b => (b.html && b.html.trim()) || (b.t === "img" && b.status === "done"));
  const hasExcerpt = !!(v.excerpt || "").trim();
  return !hasTitle && !hasBody && !hasExcerpt;
}

function LangToggle({ content, activeLang, onSwitch, onRemove }) {
  const LABEL = { pt: "🇧🇷 PT-BR", en: "🇺🇸 EN" };
  const [confirm, setConfirm] = useState(null);
  const existing = ["pt", "en"].filter(l => content[l]);
  const missing = ["pt", "en"].find(l => !content[l]);

  // single version → label + discreet "add version"
  if (existing.length === 1) {
    return (
      <div className="lang-toggle single" role="group" aria-label="Versão de idioma">
        <span className="lang-current">{LABEL[existing[0]]}</span>
        {missing && (
          <button className="ver-add" onClick={() => onSwitch(missing)} title={"Adicionar versão " + LABEL[missing]}>
            <Icon name="plus" size={12} /> {missing === "en" ? "EN" : "PT-BR"}
          </button>
        )}
      </div>
    );
  }

  const tryRemove = (l) => {
    if (isEmptyVersion(content[l])) { onRemove(l); return; }
    setConfirm(l);
  };

  // two versions → real toggle, each with a remove affordance
  return (
    <div className="lang-wrap">
      <div className="lang-toggle" role="group" aria-label="Versão de idioma">
        {["pt", "en"].map(l => (
          <span key={l} className={"lang-seg" + (activeLang === l ? " on" : "")}>
            <button className={"lang-opt" + (activeLang === l ? " on" : "")} onClick={() => onSwitch(l)}>{LABEL[l]}</button>
            <button className="lang-x" title={"Remover versão " + LABEL[l]} onClick={(e) => { e.stopPropagation(); tryRemove(l); }}><Icon name="x" size={12} /></button>
          </span>
        ))}
      </div>
      {confirm && (
        <>
          <div className="lang-confirm-scrim" onClick={() => setConfirm(null)} />
          <div className="lang-confirm" role="dialog">
            <div className="lc-title"><Icon name="warn" size={14} /> Remover versão {LABEL[confirm]}?</div>
            <div className="lc-tx">
              {content[confirm].published
                ? "Esta versão está publicada no site. Removê-la aqui só apaga o rascunho — despublique no site antes, se preciso."
                : "Esta versão tem conteúdo. Essa ação não pode ser desfeita."}
            </div>
            <div className="lc-actions">
              <button className="btn sm" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn sm" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb,var(--danger) 36%,transparent)", background: "var(--danger-s)" }} onClick={() => { onRemove(confirm); setConfirm(null); }}><Icon name="archive" size={13} /> Remover</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WritingToolbar() {
  const t = (n) => pushToast({ kind: "info", icon: "edit", title: n });
  return (
    <div className="doc-tools">
      <button className="etool" title="Negrito" onClick={() => t("Negrito")}>B</button>
      <button className="etool it" title="Itálico" onClick={() => t("Itálico")}>i</button>
      <button className="etool" title="Título" style={{ fontSize: 12 }} onClick={() => t("Título H2")}>H2</button>
      <span className="esep" />
      <button className="etool" title="Citação" style={{ fontSize: 15 }} onClick={() => t("Citação")}>“</button>
      <button className="etool" title="Lista" style={{ fontWeight: 400 }} onClick={() => t("Lista")}><Icon name="upnext" size={15} /></button>
      <button className="etool" title="Link" style={{ fontWeight: 400 }} onClick={() => t("Link")}><Icon name="link" size={14} /></button>
      <span className="esep" />
      <button className="etool" title="Imagem" style={{ fontWeight: 400 }} onClick={() => t("Imagem")}><Icon name="media" size={14} /></button>
    </div>
  );
}

function DraftEditor({ post, theme, onBack, go }) {
  const cats = window.DATA.blog.categories;
  const cat = cats.find(c => c.id === post.cat);
  const cc = (cat && cat.dark && theme === "dark") ? cat.dark : (cat ? cat.color : "var(--accent)");

  const [content, setContent] = useState(() => seedContent(post));
  const [activeLang, setActiveLang] = useState(post.lang);
  const [activeStage, setActiveStage] = useState(window.STAGE_MAP[post.stage] || "conteudo");
  const [focus, setFocus] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") { setDetailsOpen(d => { if (d) return false; setFocus(false); return d; }); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const cur = content[activeLang];

  const switchLang = (l) => {
    if (content[l]) { setActiveLang(l); return; }
    setContent(c => ({ ...c, [l]: { lang: l, title: "", slug: "", slugTouched: false, excerpt: "", hook: "", sinopse: "", body: window.JSON ? JSON.parse(JSON.stringify(DEFAULT_BODY)) : DEFAULT_BODY, published: false, coverReady: false, coverImg: null, words: 0, readTime: "", publishedAt: null, updatedAt: null, dirty: false, fresh: true } }));
    setActiveLang(l);
    pushToast({ kind: "info", icon: "plus", title: "Versão " + (l === "pt" ? "PT-BR" : "EN") + " criada", msg: "Versão própria — escreva do zero, não é tradução." });
  };

  const removeLang = (l) => {
    const remaining = ["pt", "en"].find(x => x !== l && content[x]);
    if (!remaining) return; // never remove the last version
    setContent(c => { const n = { ...c }; delete n[l]; return n; });
    if (activeLang === l) setActiveLang(remaining);
    pushToast({ kind: "info", icon: "archive", title: "Versão " + (l === "pt" ? "PT-BR" : "EN") + " removida" });
  };

  const patch = (obj) => setContent(c => {
    const e = c[activeLang];
    const dirty = e.published ? true : e.dirty;
    return { ...c, [activeLang]: { ...e, ...obj, dirty } };
  });
  const republish = () => { setContent(c => ({ ...c, [activeLang]: { ...c[activeLang], dirty: false, updatedAt: "3 jun" } })); pushToast({ kind: "success", icon: "refresh", title: "Post atualizado no site", msg: "O frontend agora mostra ‘Atualizado em 3 jun’." }); };
  const onTitleInput = (e) => {
    const t = e.currentTarget.textContent || "";
    patch({ title: t, slug: cur.slugTouched ? cur.slug : window.deriveSlug(t) });
  };
  const setSlugManual = (v) => patch({ slug: window.deriveSlug(v) || v.toLowerCase(), slugTouched: true });
  const resyncSlug = () => { patch({ slug: window.deriveSlug(cur.title), slugTouched: false }); pushToast({ kind: "info", icon: "refresh", title: "Slug regenerado do título" }); };
  const setExcerpt = (v) => patch({ excerpt: v });
  const onDekInput = (e) => patch({ excerpt: e.currentTarget.textContent || "" });
  const onHookInput = (e) => patch({ hook: e.currentTarget.textContent || "" });
  const onSinopseInput = (e) => patch({ sinopse: e.currentTarget.textContent || "" });
  const setImgStatus = (id, status) => {
    if (id === "cover") { patch({ coverReady: status === "done", coverImg: status === "done" ? EXAMPLE_IMG : null }); return; }
    patch({ body: (cur.body || []).map(b => (b.t === "img" && b.id === id) ? { ...b, status, src: status === "done" ? EXAMPLE_IMG : null } : b) });
  };
  const setImgAlt = (id, alt) => patch({ body: (cur.body || []).map(b => (b.t === "img" && b.id === id) ? { ...b, alt } : b) });
  const genAll = () => patch({ coverReady: true, coverImg: EXAMPLE_IMG, body: (cur.body || []).map(b => b.t === "img" ? { ...b, status: "done", src: EXAMPLE_IMG } : b) });
  const save = () => pushToast({ kind: "success", icon: "check", title: "Salvo", msg: cur.title || "Sem título" });

  const stages = window.EDITOR_STAGES;
  const idx = stages.findIndex(s => s.id === activeStage);
  const isWritingStage = activeStage === "conteudo";
  const isIdeaStage = activeStage === "ideia";

  const renderTool = () => {
    if (activeStage === "imagens") return <window.ImagensStage post={post} cur={cur} setImgStatus={setImgStatus} setImgAlt={setImgAlt} genAll={genAll} />;
    if (activeStage === "seo") return <window.SeoStage post={post} cur={cur} />;
    if (activeStage === "publicacao") return <window.PublicacaoStage post={post} cur={cur} setActiveStage={setActiveStage} onRepublish={republish} />;
    return null;
  };

  return (
    <div className="fade-in">
      {/* slim action bar */}
      <div className="ed-bar">
        <div className="ed-bc">
          <a className="eb-back" onClick={onBack}><Icon name="chevronl" size={15} /> Voltar</a>
          <span className="msep">/</span>
          <a className="eb-back" onClick={onBack} style={{ gap: 0 }}>Blog</a>
          <span className="msep">/</span>
          <span className="eb-code">{post.code}</span>
        </div>
        <div className="grow" />
        <LangToggle content={content} activeLang={activeLang} onSwitch={switchLang} onRemove={removeLang} />
        <span className={"ed-status " + (cur.published ? (cur.dirty ? "pending" : "live") : "draft")}>
          <span className="es-dot" />{cur.published ? (cur.dirty ? "Alterações pendentes" : "Publicado") : "Rascunho"}
        </span>
        <button className={"ed-iconbtn" + (detailsOpen ? " on" : "")} title="Detalhes do post" onClick={() => setDetailsOpen(true)}><Icon name="sliders" size={16} /></button>
        <button className={"ed-iconbtn" + (focus ? " on" : "")} title="Modo foco (Esc)" onClick={() => setFocus(f => !f)}><Icon name="eye" size={16} /></button>
        <button className="btn sm primary" onClick={save}><Icon name="check" size={14} /> Salvar</button>
      </div>

      {/* stage segmented control — free navigation, no locks */}
      {!focus && (
        <div className="ed-stages">
          {stages.map((s) => (
            <button key={s.id} className={"ed-stage" + (s.id === activeStage ? " on" : "")} onClick={() => setActiveStage(s.id)}>
              <Icon name={s.ic} size={14} /><span className="esl">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ============ DOCUMENT CANVAS (full width) ============ */}
      <div className="ed-doc">
          {isIdeaStage ? (
            /* ── IDEIA — the concept brief (its own identity, NOT the writing canvas) ── */
            <div className="idea-canvas">
              <div className="idea-kicker"><Icon name="sparkles" size={13} /> Conceito · {activeLang === "pt" ? "PT-BR" : "EN"}</div>
              <h1 key={"it-" + activeLang} className="idea-title" contentEditable suppressContentEditableWarning spellCheck={false}
                data-empty={!(cur.title || "").trim()} data-ph="Título de trabalho do post…"
                onInput={onTitleInput} onBlur={onTitleInput}>{cur.title}</h1>

              <div className="idea-brief">
                <div className="brief-card hook">
                  <div className="bc-head"><span className="bc-ico"><Icon name="zap" size={13} /></span> Hook <span className="bc-sub">a promessa que prende o leitor</span></div>
                  <div key={"ih-" + activeLang} className="bc-text" contentEditable suppressContentEditableWarning spellCheck={false}
                    data-empty={!(cur.hook || "").trim()} data-ph="Em uma frase: por que alguém pararia pra ler isto?"
                    onInput={onHookInput} onBlur={onHookInput}>{cur.hook}</div>
                </div>
                <div className="brief-card">
                  <div className="bc-head"><span className="bc-ico alt"><Icon name="research" size={13} /></span> Sinopse <span className="bc-sub">o que o artigo cobre, em resumo</span></div>
                  <div key={"is-" + activeLang} className="bc-text" contentEditable suppressContentEditableWarning spellCheck={false}
                    data-empty={!(cur.sinopse || "").trim()} data-ph="Os pontos e a linha de raciocínio que o artigo desenvolve…"
                    onInput={onSinopseInput} onBlur={onSinopseInput}>{cur.sinopse}</div>
                </div>
              </div>

              <button className="idea-next" onClick={() => setActiveStage("conteudo")}>
                Conceito definido — escrever o conteúdo <Icon name="arrowright" size={15} />
              </button>
            </div>
          ) : isWritingStage ? (
            /* ── CONTEÚDO — the writing canvas ── */
            <>
              {cur.published && (
                <div className={"doc-pubnote" + (cur.dirty ? " dirty" : "")}>
                  <Icon name={cur.dirty ? "warn" : "checkcircle"} size={14} />
                  {cur.dirty
                    ? <span>Editando conteúdo <b>publicado</b> — as mudanças só vão ao ar quando você <b>Atualizar no site</b> (etapa Publicação).</span>
                    : <span>Este conteúdo está <b>no ar</b>. Qualquer edição vira uma atualização pendente.</span>}
                </div>
              )}
              <button key={"cov-" + activeLang} className={"doc-cover " + (cur.coverReady ? "done" : "pending")} onClick={() => setActiveStage("imagens")} title={cur.coverReady ? "Trocar capa em Imagens" : "Adicionar capa em Imagens"}>
                {cur.coverReady
                  ? <>{cur.coverImg ? <img className="dc-img" src={cur.coverImg} alt="" /> : <div className="dc-img" />}<span className="dc-tag"><Icon name="media" size={12} /> capa · 1200×675</span><span className="dc-edit"><Icon name="refresh" size={13} /> Trocar capa</span></>
                  : <><span className="dc-ph"><Icon name="media" size={22} /> Capa do post · 1200×675</span><span className="dc-add"><Icon name="plus" size={13} /> Adicionar capa</span></>}
              </button>
              <h1 key={"t-" + activeLang} className="doc-title" contentEditable suppressContentEditableWarning spellCheck={false}
                data-empty={!(cur.title || "").trim()} data-ph="Sem título" onInput={onTitleInput} onBlur={onTitleInput}>{cur.title}</h1>
              <div className="doc-dek-wrap">
                <div key={"d-" + activeLang} className="doc-dek" contentEditable suppressContentEditableWarning spellCheck={false}
                  data-empty={!(cur.excerpt || "").trim()} data-ph="Resumo da listagem & card social…" onInput={onDekInput} onBlur={onDekInput}>{cur.excerpt}</div>
                <div className="doc-dek-hint">{(cur.excerpt || "").length} caracteres · resumo da listagem &amp; card social · ideal 120–160</div>
              </div>
              <div className="doc-meta">
                <span className="dm-tag">{activeLang === "pt" ? "🇧🇷 PT-BR" : "🇺🇸 EN"}</span>
                {cat && <><span className="msep">·</span><span className="dm-tag"><span className="cdot" style={{ background: cc }} /> {cat.pt}</span></>}
                <span className="msep">·</span>
                <span>{cur.readTime ? cur.readTime + " de leitura" : "novo"}</span>
                <span className="msep">·</span>
                <span>{(cur.words || 0).toLocaleString("pt-BR")} palavras</span>
              </div>
              <WritingToolbar />
              <div key={"b-" + activeLang} className="doc-prose" contentEditable suppressContentEditableWarning spellCheck={false} data-empty={(cur.body || []).every(b => !b.html && b.t !== "img")}>
                {(cur.body && cur.body.length ? cur.body : DEFAULT_BODY).map((blk, i) => {
                  if (blk.t === "img") return (
                    <div key={i} className={"doc-img " + (blk.status === "done" ? "done" : "pending")} contentEditable={false}>
                      <div className="di-thumb">{blk.status === "done" ? (blk.src ? <img className="di-img" src={blk.src} alt="" /> : <div className="di-img" />) : <Icon name="media" size={20} />}</div>
                      <div className="di-info">
                        <span className="di-id">{blk.id}{blk.status === "done" ? <span className="di-ok">no ar</span> : <span className="di-wait">sem imagem</span>}</span>
                        <span className="di-alt">{blk.alt}</span>
                      </div>
                      <button className="di-go" onClick={() => setActiveStage("imagens")} title="Abrir em Imagens"><Icon name="arrowright" size={14} /></button>
                    </div>
                  );
                  if (blk.t === "quote") return <blockquote key={i} dangerouslySetInnerHTML={{ __html: blk.html }} />;
                  return <p key={i} dangerouslySetInnerHTML={{ __html: blk.html || "" }} />;
                })}
              </div>
            </>
          ) : (
            <>
              <div className="doc-kicker">{stages[idx].label} · {activeLang === "pt" ? "PT-BR" : "EN"}</div>
              <div className="doc-title-sm">{cur.title || "Sem título"}</div>
              <div style={{ marginTop: 18 }}>{renderTool()}</div>
            </>
          )}
      </div>

      {/* ============ DETALHES DRAWER (opened on demand) ============ */}
      {detailsOpen && (
        <React.Fragment>
          <div className="drawer-scrim" onClick={() => setDetailsOpen(false)} />
          <div className="drawer" style={{ display: "flex", flexDirection: "column" }}>
            <div className="drawer-head">
              <Icon name="sliders" size={17} style={{ color: "var(--accent-text)" }} />
              <span className="dt">Detalhes do post</span>
              <span className="dim fs11" style={{ marginLeft: 4 }}>{activeLang === "pt" ? "🇧🇷 PT-BR" : "🇺🇸 EN"}</span>
              <div className="grow" style={{ flex: 1 }} />
              <button className="icon-btn bare" onClick={() => setDetailsOpen(false)}><Icon name="x" size={16} /></button>
            </div>
            <div className="drawer-body">
              <window.DraftInspector
                post={post} cats={cats} cc={cc} cat={cat} lang={activeLang}
                slug={cur.slug} slugTouched={cur.slugTouched} setSlugManual={setSlugManual} resyncSlug={resyncSlug}
                sitePublished={cur.published} publishedAt={cur.publishedAt} updatedAt={cur.updatedAt} dirty={cur.dirty} onRepublish={republish} />
            </div>
          </div>
        </React.Fragment>
      )}

      {focus && (
        <button className="focus-exit" onClick={() => setFocus(false)}>
          <Icon name="eye" size={14} /> <b>Modo foco</b> — clique para sair · <span className="mono">esc</span>
        </button>
      )}
    </div>
  );
}

Object.assign(window, { DraftEditor, LangToggle });
