/* ============================================================
   BLOG MODULE — Posts hub.
   Mirrors the Newsletter structure: category rail + tabs
   (Editorial Kanban / Agenda / Analytics) + category drawer.
   Clicking a card opens the redesigned Draft editor.
   ============================================================ */

const B = window.DATA.blog;
const PRI_LABEL = { media: "Média", normal: "Normal", baixa: "Baixa" };
const CAT_SWATCHES = ["#a855f7", "#fb7a52", "#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#22b8d6", "#ec4899", "#c14513"];

function catColor(cat, theme) {
  if (!cat) return "var(--accent)";
  return (theme === "dark" && cat.dark) ? cat.dark : cat.color;
}

/* ---------------- KANBAN CARD ---------------- */
function KCard({ post, cats, onOpen, onDragStart, onDragEnd, dragging }) {
  const cat = cats.find(c => c.id === post.cat);
  const cc = (cat && cat.dark) ? cat.dark : (cat ? cat.color : "var(--accent)");
  const pct = post.total ? Math.round((post.done / post.total) * 100) : 0;
  return (
    <button className={"kcard" + (post.featured ? " feat" : "") + (dragging ? " dragging" : "")} style={{ "--cc": cc }}
      draggable onDragStart={(e) => onDragStart(e, post)} onDragEnd={onDragEnd} onClick={() => onOpen(post)}>
      <div className="kcard-top">
        <span className="kgrip"><Icon name="grip" size={13} /></span>
        <span className="kcode">{post.code}</span>
        <span className="kflag">{post.lang === "pt" ? "🇧🇷" : "🇺🇸"}</span>
        <span className="kage">{post.age}</span>
        <span className={"kpri " + post.pri}>{PRI_LABEL[post.pri]}</span>
      </div>
      <div className="kcard-title">{post.title}</div>
      <div className="kcard-ex">{post.excerpt}</div>
      <div className="kcard-foot">
        {cat && <span className="ktag" style={{ "--tgc": cc }}>{cat.badge}</span>}
        <span className="kprog">
          <span className="ktrack"><span style={{ width: Math.max(pct, post.done ? 6 : 0) + "%" }} /></span>
          <span className="knum">{post.done}/{post.total}</span>
        </span>
      </div>
    </button>
  );
}

/* ---------------- EDITORIAL (Kanban) ---------------- */
function Editorial({ posts, cats, onOpen, theme, onMove }) {
  const byStage = (sid) => posts.filter(p => p.stage === sid);
  const [drag, setDrag] = useState(null);     // dragged post code
  const [over, setOver] = useState(null);      // stage being hovered
  const onDragStart = (e, post) => { setDrag(post.code); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", post.code); } catch {} };
  const onDragEnd = () => { setDrag(null); setOver(null); };
  const onDrop = (e, sid) => { let code = drag; try { code = e.dataTransfer.getData("text/plain") || drag; } catch {} if (code) onMove(code, sid); setDrag(null); setOver(null); };

  const stats = [
    { v: B.stats.total, l: "Total", c: "var(--text)" },
    { v: B.stats.pipeline, l: "No pipeline", c: "var(--c-pipeline)" },
    { v: B.stats.published, l: "Publicados", c: "var(--c-links)" },
    { v: B.stats.throughput, l: "Vazão", c: "var(--accent)" },
  ];
  return (
    <div className="fade-in">
      <div className="bstat-grid">
        {stats.map((s, i) => (
          <div key={i} className="bstat" style={{ "--bc": s.c }}>
            <div className="bv">{s.v}</div>
            <div className="bl">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="row between" style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div className="search-box" style={{ maxWidth: 320 }}>
          <Icon name="search" size={15} /><input placeholder="Buscar posts…" />
        </div>
        <span className="dim fs12 row gap-6"><Icon name="grip" size={13} /> Arraste os cards entre as etapas</span>
      </div>

      <div className="kanban">
        {B.stages.map(st => {
          const items = byStage(st.id);
          return (
            <div key={st.id} className={"kcol" + (over === st.id ? " drop-over" : "")}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(st.id); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(o => o === st.id ? null : o); }}
              onDrop={(e) => onDrop(e, st.id)}>
              <div className="kcol-head" style={{ "--kc": st.color }}>
                <span className="kdot" />
                <span className="kcol-name">{st.label}</span>
                <span className="kcol-count">{items.length}</span>
              </div>
              <div className="kcol-body">
                {items.length === 0
                  ? <div className="kcol-empty">{over === st.id ? "Solte aqui" : (st.id === "pronto" ? "Nenhum item pronto para promover" : st.id === "agendado" ? "Nenhum post agendado" : "Vazio")}</div>
                  : items.map(p => <KCard key={p.code} post={p} cats={cats} onOpen={onOpen} theme={theme} onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={drag === p.code} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- AGENDA (editorial planning — NO cadence; that's a newsletter concept) ---------------- */
function Agenda({ posts, cats, theme, onSchedule, onOpen }) {
  const dow = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  // June 2026 starts Monday. Sunday-first grid → lead with May 31.
  const cells = [{ n: 31, dimmed: true }];
  for (let d = 1; d <= 30; d++) cells.push({ n: d, today: d === 1 });
  [1, 2, 3, 4].forEach(n => cells.push({ n, dimmed: true }));

  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const onDrop = (e, day) => { let code = drag; try { code = e.dataTransfer.getData("text/plain") || drag; } catch {} if (code) onSchedule(code, day); setDrag(null); setOver(null); };

  const cc = (p) => { const c = cats.find(x => x.id === p.cat); return c ? ((c.dark && theme === "dark") ? c.dark : c.color) : "var(--accent)"; };
  const dated = posts.filter(p => p.date);
  const ready = posts.filter(p => (p.stage === "rascunho" || p.stage === "pronto") && !p.date);
  const published = posts.filter(p => p.stage === "publicado").length;
  const nextDay = dated.length ? Math.min(...dated.map(p => p.date)) : null;

  const kpis = [
    { v: String(dated.length), l: "Agendados", c: "var(--c-newsletter)" },
    { v: String(published), l: "Publicados (jun)", c: "var(--c-links)" },
    { v: String(ready.length), l: "Prontos p/ agendar", c: "var(--accent)" },
    { v: nextDay ? nextDay + "/jun" : "—", l: "Próxima publicação", c: "var(--c-pipeline)" },
  ];

  return (
    <div className="fade-in">
      <div className="bstat-grid">
        {kpis.map((s, i) => <div key={i} className="bstat" style={{ "--bc": s.c }}><div className="bv">{s.v}</div><div className="bl">{s.l}</div></div>)}
      </div>

      <Card style={{ overflow: "hidden" }}>
        <div className="row between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-soft)" }}>
          <button className="icon-btn bare"><Icon name="chevronl" size={16} /></button>
          <span className="fw6" style={{ fontSize: 15 }}>Junho 2026</span>
          <button className="icon-btn bare"><Icon name="chevronr" size={16} /></button>
        </div>
        <div className="cal" style={{ border: "none", borderRadius: 0 }}>
          {dow.map(d => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map((c, i) => {
            const dayPosts = !c.dimmed ? dated.filter(p => p.date === c.n) : [];
            const isOver = over === c.n && !c.dimmed;
            return (
              <div key={i} className={"cal-cell ag-cell" + (c.dimmed ? " dim" : "") + (c.today ? " today" : "") + (isOver ? " drop-over" : "")}
                onDragOver={(e) => { if (drag && !c.dimmed) { e.preventDefault(); setOver(c.n); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(o => o === c.n ? null : o); }}
                onDrop={(e) => !c.dimmed && onDrop(e, c.n)}
                style={{ minHeight: 96 }}>
                <div className="cal-num">{c.n}</div>
                {dayPosts.map(p => (
                  <button key={p.code} className="ag-ev" style={{ "--ec": cc(p) }} onClick={() => onOpen(p)} title={p.title}>
                    <span className="ag-ev-bar" /><span className="kflag">{p.lang === "pt" ? "🇧🇷" : "🇺🇸"}</span><span className="truncate">{p.title}</span>
                  </button>
                ))}
                {!c.dimmed && dayPosts.length === 0 && <span className="ag-add"><Icon name="plus" size={12} /></span>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ready-to-schedule strip — drag onto a day */}
      <div className="row between" style={{ margin: "22px 0 12px" }}>
        <span className="section-label row gap-8"><Icon name="layers" size={13} /> Prontos para agendar</span>
        <span className="dim fs12 row gap-6"><Icon name="grip" size={13} /> Arraste para um dia do calendário</span>
      </div>
      {ready.length === 0
        ? <Card className="card-pad"><div className="dim fs13 row gap-8" style={{ justifyContent: "center", padding: "8px 0" }}><Icon name="checkcircle" size={15} style={{ color: "var(--ok)" }} /> Tudo que está pronto já tem data. Sem ritmo fixo — você publica quando o post estiver bom.</div></Card>
        : <div className="ag-strip">
            {ready.map(p => (
              <button key={p.code} className="ag-chip" style={{ "--cc": cc(p) }} draggable
                onDragStart={(e) => { setDrag(p.code); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.code); } catch {} }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                onClick={() => onOpen(p)}>
                <span className="kgrip"><Icon name="grip" size={13} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ag-chip-title truncate">{p.title}</div>
                  <div className="dim fs11">{p.code} · {p.lang === "pt" ? "🇧🇷 PT" : "🇺🇸 EN"}</div>
                </div>
              </button>
            ))}
          </div>}
    </div>
  );
}

/* ---------------- CATEGORY DRAWER ---------------- */
function CatDrawer({ cat, theme, onClose }) {
  const isNew = !cat;
  const [namePt, setNamePt] = useState(cat ? cat.pt : "");
  const [nameEn, setNameEn] = useState(cat ? cat.en : "");
  const [slug, setSlug] = useState(cat ? cat.slug : "");
  const [badge, setBadge] = useState(cat ? cat.badge : "");
  const [color, setColor] = useState(cat ? cat.color : CAT_SWATCHES[0]);
  const save = () => { pushToast({ kind: "success", icon: "check", title: isNew ? "Categoria criada" : "Categoria salva", msg: (namePt || "Sem nome") }); onClose(); };
  return (
    <React.Fragment>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <Icon name={isNew ? "plus" : "edit"} size={17} style={{ color: "var(--accent-text)" }} />
          <span className="dt">{isNew ? "Nova categoria" : "Editar categoria"}</span>
          <div className="grow" />
          <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="drawer-body">
          <div className="fsection">Essenciais</div>
          <div className="fgroup">
            <span className="flabel">🇧🇷 Nome (PT-BR)</span>
            <input className="finput" value={namePt} onChange={e => setNamePt(e.target.value)} placeholder="Ex.: Bastidores" />
          </div>
          <div className="fgroup">
            <span className="flabel">🇺🇸 Nome (EN)</span>
            <input className="finput" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Translation (optional)" />
          </div>
          <div className="fgroup">
            <span className="flabel">Slug</span>
            <input className="finput mono" value={slug} onChange={e => setSlug(e.target.value)} placeholder="behind-the-scenes" />
            <span className="fhint">Preview: <span className="mono">/{slug || "slug"}</span></span>
          </div>
          <div className="fgroup">
            <span className="flabel">Badge</span>
            <input className="finput mono" value={badge} onChange={e => setBadge(e.target.value.toUpperCase().slice(0, 6))} placeholder="BTS" />
            <span className="fhint">Rótulo curto exibido nos chips e cards.</span>
          </div>

          <div className="fsection">Aparência</div>
          <div className="fgroup">
            <span className="flabel">Cor</span>
            <div className="swatches">
              {CAT_SWATCHES.map(c => (
                <button key={c} className={"swatch" + (color === c ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="fgroup">
            <span className="flabel">Pré-visualização</span>
            <div className="row gap-8 wrap">
              <span className="preview-chip" style={{ color: color, background: "color-mix(in srgb, " + color + " 14%, transparent)", borderColor: "transparent" }}>
                <span className="cdot" style={{ width: 9, height: 9, borderRadius: 3, background: color }} /> {namePt || "Categoria"}
              </span>
              <span className="ktag" style={{ "--tgc": color, fontSize: 11 }}>{badge || "TAG"}</span>
            </div>
          </div>

          <div className="fsection">Vincular a newsletter</div>
          <div className="fgroup">
            <select className="finput" style={{ appearance: "none" }}>
              <option>Nenhuma</option>
              <option>Diário do Thiago</option>
              <option>Thiago's Journal</option>
            </select>
            <span className="fhint">Posts nesta categoria podem alimentar a edição automaticamente.</span>
          </div>

          {!isNew && (
            <React.Fragment>
              <div className="fsection danger">Zona de perigo</div>
              <button className="btn" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)", background: "var(--danger-s)", width: "100%" }}
                onClick={() => pushToast({ kind: "warning", icon: "warn", title: "Excluir categoria", msg: "Ação desabilitada no protótipo." })}>
                <Icon name="archive" size={15} /> Excluir categoria
              </button>
            </React.Fragment>
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={save}><Icon name="check" size={15} /> {isNew ? "Criar categoria" : "Salvar alterações"}</button>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---------------- BLOG VIEW (shell) ---------------- */
const BLOG_TABS = [["editorial", "Editorial", "blog"], ["agenda", "Agenda", "calendar"], ["analytics", "Analytics", "trending"]];

function BlogView({ go, theme }) {
  const [tab, setTab] = useState("editorial");
  const [activeCat, setActiveCat] = useState("all");
  const [drawer, setDrawer] = useState(null); // { cat } | { cat: null } for new
  const [openPost, setOpenPost] = useState(null);
  const [allPosts, setAllPosts] = useState(B.posts);
  const cats = B.categories;
  const stageLabel = (id) => (B.stages.find(s => s.id === id) || {}).label || id;
  const onMove = (code, stage) => {
    const p = allPosts.find(x => x.code === code);
    if (!p || p.stage === stage) return;
    setAllPosts(ps => ps.map(x => x.code === code ? { ...x, stage } : x));
    pushToast({ kind: stage === "publicado" ? "success" : "info", icon: stage === "publicado" ? "checkcircle" : "arrowright", title: "Movido para " + stageLabel(stage), msg: p.title });
  };
  const onSchedule = (code, day) => {
    const p = allPosts.find(x => x.code === code);
    if (!p) return;
    setAllPosts(ps => ps.map(x => x.code === code ? { ...x, date: day } : x));
    pushToast({ kind: "success", icon: "calendar", title: "Agendado para " + day + "/jun", msg: p.title });
  };

  if (openPost) return <window.DraftEditor post={openPost} theme={theme} onBack={() => setOpenPost(null)} go={go} />;

  const posts = activeCat === "all" ? allPosts : allPosts.filter(p => p.cat === activeCat);

  return (
    <div>
      {/* module header */}
      <div className="mod-head">
        <span className="mod-title">Posts</span>
        <span className="mod-live"><i /> Atualizado agora</span>
        <div className="grow" style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => pushToast({ kind: "info", icon: "blog", title: "Novo Post", msg: "Abrindo editor de post…" })}>
          <Icon name="plus" size={15} /> Novo Post
        </button>
      </div>

      {/* tabs */}
      <div className="tabs">
        {BLOG_TABS.map(([id, l, ic]) => (
          <button key={id} className={"tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
            <span className="row gap-6"><Icon name={ic} size={14} /> {l}</span>
          </button>
        ))}
      </div>

      {/* category rail (hidden on analytics-empty? keep visible — mirrors newsletter) */}
      <div className="cat-rail">
        <button className={"cat-chip" + (activeCat === "all" ? " on" : "")} onClick={() => setActiveCat("all")}>
          Todas <span className="ccount">{B.posts.length}</span>
        </button>
        {cats.map(c => {
          const cc = catColor(c, theme);
          const count = B.posts.filter(p => p.cat === c.id).length;
          return (
            <button key={c.id} className={"cat-chip" + (activeCat === c.id ? " on" : "")} onClick={() => setActiveCat(c.id)}>
              <span className="cdot" style={{ background: cc }} />
              {c.pt}
              {count > 0 && <span className="ccount">{count}</span>}
              <span className="cedit" onClick={(e) => { e.stopPropagation(); setDrawer({ cat: c }); }} title="Editar categoria">
                <Icon name="edit" size={12} />
              </span>
            </button>
          );
        })}
        <button className="cat-add" title="Nova categoria" onClick={() => setDrawer({ cat: null })}><Icon name="plus" size={15} /></button>
        <select className="cat-sel" defaultValue="all">
          <option value="all">Todos os idiomas</option>
          <option value="pt">🇧🇷 PT-BR</option>
          <option value="en">🇺🇸 EN</option>
        </select>
      </div>

      {tab === "editorial" && <Editorial posts={posts} cats={cats} theme={theme} onOpen={setOpenPost} onMove={onMove} />}
      {tab === "agenda" && <Agenda posts={posts} cats={cats} theme={theme} onSchedule={onSchedule} onOpen={setOpenPost} />}
      {tab === "analytics" && (
        <div className="fade-in">
          <div className="row gap-8" style={{ marginBottom: 18 }}>
            {["7 dias", "30 dias", "90 dias", "Todo o período"].map((p, i) => (
              <button key={p} className={"chip sm" + (i === 1 ? " on" : "")}>{p}</button>
            ))}
          </div>
          <Card className="card-pad" style={{ minHeight: 200 }}>
            <EmptyState icon="trending" title="Sem dados de analytics para este período" sub="Publique posts e conecte a fonte de tráfego para ver desempenho aqui." />
          </Card>
        </div>
      )}

      {drawer && <CatDrawer cat={drawer.cat} theme={theme} onClose={() => setDrawer(null)} />}
    </div>
  );
}

Object.assign(window, { BlogView });
