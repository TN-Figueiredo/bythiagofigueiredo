/* ============================================================
   DRAFT EDITOR v4 — stage panels + shared helpers.
   Order: Ideia → Rascunho → Imagens → SEO → Publicação
   (a post is only "done" once its images exist, so images
   come before SEO). Free navigation — no gating on the tabs.
   The ONLY gate is on Agendar/Publicar. Panels are bare.
   ============================================================ */

const EDITOR_STAGES = [
  { id: "ideia",      label: "Ideia",      ic: "sparkles" },
  { id: "conteudo",   label: "Conteúdo",   ic: "edit" },
  { id: "imagens",    label: "Imagens",    ic: "media" },
  { id: "seo",        label: "SEO",        ic: "search" },
  { id: "publicacao", label: "Publicação", ic: "rss" },
];

// kanban stage → editor stage the post is currently "in"
const STAGE_MAP = { ideia: "ideia", rascunho: "conteudo", pronto: "imagens", agendado: "publicacao", publicado: "publicacao" };

function deriveSlug(title) {
  return (title || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/["'“”‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* Publish gate — the single real lock. A version can only be
   scheduled/published once these are in place. Returns
   { ok, missing:[{label,stage}] }. */
function publishGate(post, cur) {
  const imgs = (cur.body || []).filter(b => b.t === "img");
  const coverOk = cur.coverReady !== undefined ? cur.coverReady : post.coverReady;
  const imagesOk = !!coverOk && imgs.every(b => b.status === "done");
  const reqs = [
    { label: "Título",   ok: !!(cur.title || "").trim(),                stage: "conteudo" },
    { label: "Conteúdo", ok: !!(cur.body && cur.body.some(b => b.html)), stage: "conteudo" },
    { label: "Imagens",  ok: imagesOk,                                  stage: "imagens" },
  ];
  const missing = reqs.filter(r => !r.ok);
  return { ok: missing.length === 0, missing };
}

/* ---------------- SEO ---------------- */
function CharCount({ n, lo, hi }) {
  const cls = n === 0 ? "" : n > hi ? "warn" : n >= lo ? "ok" : "";
  const note = n === 0 ? "vazio" : n > hi ? "pode truncar" : n >= lo ? "ideal" : "curto";
  return <span className={"charcount " + cls}>{n} chars · {note}</span>;
}
function SeoStage({ post, cur }) {
  const [metaTitle, setMetaTitle] = useState((post.seo && post.seo.metaTitle) || cur.title);
  const [metaDesc, setMetaDesc] = useState((post.seo && post.seo.metaDesc) || cur.excerpt || "");
  const url = "bythiagofigueiredo.com/blog/" + cur.lang + "/" + (cur.slug || deriveSlug(cur.title) || "—");
  return (
    <div className="col gap-16">
      <div className="fgroup">
        <div className="seo-field-head"><span className="flabel">Meta título</span><CharCount n={metaTitle.length} lo={40} hi={60} /></div>
        <input className="finput" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} />
      </div>
      <div className="fgroup">
        <div className="seo-field-head"><span className="flabel">Meta descrição</span><CharCount n={metaDesc.length} lo={120} hi={160} /></div>
        <textarea className="finput" style={{ height: 74, padding: "10px 12px", lineHeight: 1.5, resize: "vertical" }} value={metaDesc} onChange={e => setMetaDesc(e.target.value)} placeholder="Resumo otimizado que aparece no Google." />
      </div>
      <div className="fgroup">
        <span className="flabel">Preview no Google</span>
        <div className="serp">
          <div className="serp-url">{url}</div>
          <div className="serp-title">{metaTitle || "Sem meta título"}</div>
          <div className="serp-desc">{metaDesc || "Sem meta descrição — o Google vai inventar um trecho do corpo."}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- IMAGENS — visual manager (cover hero + content grid) ----------------
   Images are the star: a large 16:9 cover hero, content images as a card grid,
   and a variant picker that shows REAL framed thumbnails (not color blocks).
   Each slot: generate (AI) or upload → choose a variant → done. Alt editable.
   State flows into the publish gate. */
const STAGE_EXAMPLE_IMG = window.EXAMPLE_IMG || "assets/cover-example.png";
const IMG_VARIANTS = [
  { pos: "30% 22%", filter: "none" },
  { pos: "68% 44%", filter: "saturate(1.12) hue-rotate(-14deg)" },
  { pos: "50% 78%", filter: "brightness(1.08) contrast(1.04) hue-rotate(10deg)" },
];

function VariantPicker({ onPick, onCancel }) {
  return (
    <div className="imgvar">
      <div className="imgvar-head">
        <span><Icon name="sparkles" size={13} /> Escolha uma variação</span>
        <button className="imgvar-cancel" onClick={onCancel} title="Cancelar">Cancelar</button>
      </div>
      <div className="imgvar-grid">
        {IMG_VARIANTS.map((v, i) => (
          <button key={i} className="imgvar-opt" onClick={() => onPick(i + 1)}>
            <img src={STAGE_EXAMPLE_IMG} alt="" style={{ objectPosition: v.pos, filter: v.filter }} />
            <span className="imgvar-n">{i + 1}</span>
            <span className="imgvar-pick"><Icon name="check" size={14} /> Usar esta</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoverHero({ ready, src, gen, onGenerate, onUpload, onPick, onCancel, onTrocar }) {
  if (gen === "choosing") return <div className="cover-hero choosing"><VariantPicker onPick={onPick} onCancel={onCancel} /></div>;
  if (gen === "generating") return (
    <div className="cover-hero loading"><span className="hero-shimmer" /><span className="hero-loadlabel"><span className="img-spin sm" /> Gerando variações…</span></div>
  );
  if (ready) return (
    <div className="cover-hero done">
      <img src={src || STAGE_EXAMPLE_IMG} alt="" />
      <span className="hero-tag"><Icon name="media" size={13} /> capa · 1200×675</span>
      <div className="hero-overlay">
        <button className="hero-btn" onClick={onTrocar}><Icon name="refresh" size={14} /> Trocar</button>
        <button className="hero-btn" onClick={() => pushToast({ kind: "info", icon: "globe", title: "Pré-visualizar capa" })}><Icon name="eye" size={14} /> Ver</button>
      </div>
    </div>
  );
  return (
    <div className="cover-hero empty">
      <div className="hero-empty-in">
        <span className="hero-empty-ic"><Icon name="media" size={30} /></span>
        <div className="hero-empty-tx">Sem capa <span>· 1200×675 · social card &amp; topo do artigo</span></div>
        <div className="hero-empty-actions">
          <button className="btn primary" onClick={onGenerate}><Icon name="sparkles" size={15} /> Gerar com IA</button>
          <button className="btn" onClick={onUpload}><Icon name="upnext" size={15} /> Enviar imagem</button>
        </div>
      </div>
    </div>
  );
}

function ContentTile({ block, gen, onGenerate, onUpload, onPick, onCancel, onTrocar, onAlt }) {
  const ready = block.status === "done";
  const editAlt = (e) => onAlt(e.currentTarget.textContent || "");
  return (
    <article className={"img-tile " + (ready ? "done" : gen || "empty")}>
      <div className="tile-frame">
        {gen === "choosing" ? <VariantPicker onPick={onPick} onCancel={onCancel} />
          : gen === "generating" ? <><span className="hero-shimmer" /><span className="tile-loadlabel"><span className="img-spin sm" /> gerando…</span></>
          : ready ? <>
              <img src={block.src || STAGE_EXAMPLE_IMG} alt="" />
              <div className="tile-overlay">
                <button className="hero-btn sm" onClick={onTrocar}><Icon name="refresh" size={13} /> Trocar</button>
              </div>
            </>
          : <div className="tile-empty">
              <span className="tile-empty-ic"><Icon name="media" size={22} /></span>
              <div className="tile-empty-actions">
                <button className="btn sm primary" onClick={onGenerate}><Icon name="sparkles" size={13} /> Gerar</button>
                <button className="btn sm" onClick={onUpload}><Icon name="upnext" size={13} /> Enviar</button>
              </div>
            </div>}
      </div>
      <div className="tile-meta">
        <div className="tile-head">
          <span className="tile-id">{block.id}</span>
          <span className={"tile-state " + (ready ? "ok" : "wait")}>{ready ? "no ar" : "sem imagem"}</span>
        </div>
        <div className="tile-alt" contentEditable suppressContentEditableWarning spellCheck={false} onBlur={editAlt}
          data-empty={!block.alt} data-ph="Descreva (alt / prompt)…">{block.alt}</div>
      </div>
    </article>
  );
}

function ImagensStage({ post, cur, setImgStatus, setImgAlt, genAll }) {
  const coverReady = !!cur.coverReady;
  const inline = (cur.body || []).filter(b => b.t === "img");
  const total = 1 + inline.length;
  const done = (coverReady ? 1 : 0) + inline.filter(b => b.status === "done").length;
  const allReady = done === total;
  const pct = Math.round(done / total * 100);
  const [gen, setGen] = useState({});

  const start = (id) => {
    setGen(g => ({ ...g, [id]: "generating" }));
    setTimeout(() => setGen(g => (g[id] === "generating" ? { ...g, [id]: "choosing" } : g)), 900);
  };
  const upload = (id) => { setImgStatus(id, "done"); pushToast({ kind: "success", icon: "check", title: "Imagem enviada", msg: id === "cover" ? "Capa" : id }); };
  const pick = (id, n) => { setGen(g => { const x = { ...g }; delete x[id]; return x; }); setImgStatus(id, "done"); pushToast({ kind: "success", icon: "check", title: "Variação " + n + " escolhida", msg: id === "cover" ? "Capa" : id }); };
  const cancel = (id) => setGen(g => { const x = { ...g }; delete x[id]; return x; });

  return (
    <div className="imgmgr">
      {/* progress header */}
      <div className="imgmgr-head">
        <div className="imgmgr-prog">
          <div className="imgmgr-count"><b>{done}</b><span>/{total}</span></div>
          <div className="imgmgr-bar"><span style={{ width: pct + "%" }} className={allReady ? "full" : ""} /></div>
          <div className="imgmgr-sub">imagens prontas · 1 capa · {inline.length} no conteúdo</div>
        </div>
        {allReady
          ? <span className="img-alldone"><Icon name="checkcircle" size={16} /> Tudo pronto</span>
          : <button className="btn sm primary" onClick={() => { setGen({}); genAll(); pushToast({ kind: "success", icon: "sparkles", title: "Imagens geradas", msg: (total - done) + " concluídas" }); }}><Icon name="sparkles" size={14} /> Gerar todas ({total - done})</button>}
      </div>

      {/* cover hero */}
      <section className="imgmgr-section">
        <div className="imgmgr-label"><Icon name="media" size={13} /> Capa &amp; thumbnail</div>
        <CoverHero ready={coverReady} src={cur.coverImg} gen={gen.cover}
          onGenerate={() => start("cover")} onUpload={() => upload("cover")} onPick={(n) => pick("cover", n)} onCancel={() => cancel("cover")} onTrocar={() => setImgStatus("cover", "pending")} />
      </section>

      {/* content image grid */}
      {inline.length > 0 && (
        <section className="imgmgr-section">
          <div className="imgmgr-label"><Icon name="layers" size={13} /> No conteúdo · {inline.length}</div>
          <div className="img-grid">
            {inline.map(b => (
              <ContentTile key={b.id} block={b} gen={gen[b.id]}
                onGenerate={() => start(b.id)} onUpload={() => upload(b.id)} onPick={(n) => pick(b.id, n)} onCancel={() => cancel(b.id)}
                onTrocar={() => setImgStatus(b.id, "pending")} onAlt={(v) => setImgAlt(b.id, v)} />
            ))}
          </div>
          <div className="img-hint"><Icon name="info" size={13} /> Vêm dos blocos <span className="mono">{inline.map(b => b.id).join(", ")}</span> do rascunho — adicione ou remova no Conteúdo.</div>
        </section>
      )}
    </div>
  );
}

/* ---------------- PUBLICAÇÃO ---------------- */
const DIST_PLATFORMS = [
  { id: "instagram", label: "Instagram", fmt: "card template", icon: "posts", color: "#d6336c" },
  { id: "bluesky",   label: "Bluesky",   fmt: "link share",    icon: "globe", color: "#1185fe" },
  { id: "facebook",  label: "Facebook",  fmt: "link + capa",   icon: "globe", color: "#1877f2" },
  { id: "youtube",   label: "Comunidade YouTube", fmt: "post + thumb", icon: "media", color: "#ef4444" },
];
const DIST_WHEN = [
  { id: "with", label: "Com o post" },
  { id: "plus1", label: "+1 h" },
  { id: "plus1d", label: "+1 dia" },
];

function DistributionPlanner({ plan, setPlan, scheduledMode }) {
  const toggle = (id) => setPlan(p => p[id] ? (() => { const n = { ...p }; delete n[id]; return n; })() : { ...p, [id]: "with" });
  const setWhen = (id, w) => setPlan(p => ({ ...p, [id]: w }));
  const count = Object.keys(plan).length;
  return (
    <div className="dist-plan">
      <div className="dist-head">
        <span className="flabel" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="posts" size={13} /> Distribuição nas redes</span>
        <span className={"dist-count" + (count ? " on" : "")}>{count ? count + " selecionada" + (count > 1 ? "s" : "") : "nenhuma"}</span>
      </div>
      <div className="dist-grid">
        {DIST_PLATFORMS.map(p => {
          const on = !!plan[p.id];
          return (
            <div key={p.id} className={"dist-row" + (on ? " on" : "")}>
              <button className="dist-toggle" onClick={() => toggle(p.id)}>
                <span className="dist-check" style={on ? { "--pc": p.color } : null}>{on && <Icon name="check" size={12} />}</span>
                <span className="dist-ic" style={{ color: p.color }}><Icon name={p.icon} size={15} /></span>
                <span className="dist-tx"><b>{p.label}</b><span>{p.fmt}</span></span>
              </button>
              {on && (
                <div className="dist-when">
                  {DIST_WHEN.map(w => (
                    <button key={w.id} className={"dw-opt" + (plan[p.id] === w.id ? " on" : "")} onClick={() => setWhen(p.id, w.id)}>{w.label}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {count === 0
        ? <div className="dist-remind"><Icon name="info" size={14} /> <span>Nenhum canal selecionado. Um post sem distribuição costuma morrer no feed — escolha pelo menos um. O sistema agenda o link automaticamente.</span></div>
        : <div className="dist-summary"><Icon name="calendar" size={13} /> {count} {count > 1 ? "posts serão agendados" : "post será agendado"} {scheduledMode ? "junto com o agendamento" : "ao publicar"} · ajuste fino no Painel Social</div>}
    </div>
  );
}

function PublicacaoStage({ post, cur, setActiveStage, onRepublish }) {
  const published = !!cur.published;
  const dirty = !!cur.dirty;
  const url = "bythiagofigueiredo.com/blog/" + cur.lang + "/" + (cur.slug || deriveSlug(cur.title) || "—");
  const gate = publishGate(post, cur);
  const [plan, setPlan] = useState(post.sitePublished ? { instagram: "with", bluesky: "with" } : { instagram: "with", bluesky: "with" });
  const distCount = Object.keys(plan).length;
  return (
    <div className="col gap-16">
      <div className="fgroup">
        <div className="seo-field-head"><span className="flabel">Título</span><CharCount n={(cur.title || "").length} lo={30} hi={60} /></div>
        <input className="finput" value={cur.title} readOnly />
        {post.titleAlts && post.titleAlts.length > 0 && cur.lang === post.lang && (
          <div className="title-alts">
            <span className="dim fs11" style={{ padding: "2px 2px 4px" }}>Alternativas testáveis</span>
            {post.titleAlts.map((t, i) => (
              <button key={i} className="title-alt" onClick={() => pushToast({ kind: "info", icon: "edit", title: "Título trocado", msg: t })}>
                <span className="ta-n">{i + 1}</span><span className="ta-t">{t}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="fgroup">
        <span className="flabel">Descrição</span>
        <textarea className="finput" style={{ height: 60, padding: "10px 12px", lineHeight: 1.5, resize: "vertical" }} defaultValue={cur.excerpt} />
      </div>
      <div className="fgroup">
        <span className="flabel">Tags · {(post.tags || []).length}</span>
        <div className="tag-chips">{(post.tags || []).map(t => <span key={t} className="tag-chip">#{t}</span>)}</div>
      </div>

      {/* the ONE real lock lives here */}
      {!published && !gate.ok && (
        <div className="gate-box">
          <div className="gate-title"><Icon name="warn" size={14} /> Falta para publicar</div>
          <div className="gate-missing">
            {gate.missing.map(m => (
              <button key={m.label} className="gate-chip" onClick={() => setActiveStage(m.stage)}>
                <span className="gc-dot" /> {m.label} <Icon name="arrowright" size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* distribution is part of publishing now */}
      {!published && <DistributionPlanner plan={plan} setPlan={setPlan} />}

      <div className="pub-actions">
        {published
          ? <>
              {(cur.publishedAt || cur.updatedAt) && (
                <div className="pub-dates">
                  {cur.publishedAt && <span><Icon name="rss" size={12} /> Publicado em {cur.publishedAt}</span>}
                  {cur.updatedAt && <span className="pd-upd"><Icon name="refresh" size={12} /> Atualizado em {cur.updatedAt}</span>}
                </div>
              )}
              {dirty && (
                <div className="update-box">
                  <div className="gate-title" style={{ color: "var(--warn)" }}><Icon name="warn" size={14} /> Alterações não publicadas</div>
                  <div className="upd-tx">O que está no ar ainda é a versão anterior. Ao atualizar, o frontend passa a mostrar o selo <b>“Atualizado em 3 jun”</b>.</div>
                  <button className="btn primary" style={{ width: "100%", marginTop: 10 }} onClick={onRepublish}><Icon name="refresh" size={15} /> Atualizar no site</button>
                </div>
              )}
              {/* live distribution status */}
              <div className="dist-live">
                <div className="dl-head"><Icon name="posts" size={13} /> Distribuição</div>
                <div className="dl-rows">
                  {DIST_PLATFORMS.filter(p => plan[p.id]).map(p => (
                    <span key={p.id} className="dl-chip"><span className="dl-dot" style={{ background: p.color }} /> {p.label} <Icon name="checkcircle" size={12} style={{ color: "var(--c-links)" }} /></span>
                  ))}
                </div>
              </div>
              <button className="btn" style={{ color: "var(--c-links)", borderColor: "color-mix(in srgb,var(--c-links) 36%,transparent)", background: "var(--c-links-s)", width: "100%" }} onClick={() => pushToast({ kind: "success", icon: "globe", title: "Abrindo post", msg: url })}><Icon name="globe" size={15} /> Ver post no site</button>
              <button className="btn" style={{ width: "100%" }} onClick={() => pushToast({ kind: "info", icon: "posts", title: "Painel Social", msg: "Ajustar legendas e horários" })}><Icon name="posts" size={15} /> Abrir Painel Social</button>
            </>
          : <div className="row gap-8">
              <button className="btn grow" disabled={!gate.ok} style={!gate.ok ? { opacity: .45, flex: 1 } : { flex: 1 }} onClick={() => pushToast({ kind: "info", icon: "calendar", title: "Agendar publicação", msg: distCount ? "+ " + distCount + " posts nas redes" : "sem distribuição" })}><Icon name="calendar" size={15} /> Agendar</button>
              <button className="btn primary grow" disabled={!gate.ok} style={!gate.ok ? { opacity: .45, flex: 1 } : { flex: 1 }} onClick={() => pushToast({ kind: "success", icon: "rss", title: "Publicar agora", msg: distCount ? "+ agendando " + distCount + " posts nas redes" : "sem distribuição — considere adicionar" })}><Icon name="rss" size={15} /> {distCount ? "Publicar + " + distCount + " redes" : "Publicar"}</button>
            </div>}
      </div>
    </div>
  );
}

Object.assign(window, {
  EDITOR_STAGES, STAGE_MAP, deriveSlug, publishGate,
  CharCount, SeoStage, ImagensStage, PublicacaoStage,
});
