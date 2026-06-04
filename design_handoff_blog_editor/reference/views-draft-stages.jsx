/* ============================================================
   DRAFT EDITOR v4 — stage panels + shared helpers.
   Order: Ideia → Rascunho → Imagens → SEO → Publicação
   (a post is only "done" once its images exist, so images
   come before SEO). Free navigation — no gating on the tabs.
   The ONLY gate is on Agendar/Publicar. Panels are bare.
   ============================================================ */

const EDITOR_STAGES = [
  { id: "ideia",      label: "Ideia",      ic: "sparkles" },
  { id: "rascunho",   label: "Rascunho",   ic: "edit" },
  { id: "imagens",    label: "Imagens",    ic: "media" },
  { id: "seo",        label: "SEO",        ic: "search" },
  { id: "publicacao", label: "Publicação", ic: "rss" },
];

// kanban stage → editor stage the post is currently "in"
const STAGE_MAP = { ideia: "ideia", rascunho: "rascunho", pronto: "imagens", agendado: "publicacao", publicado: "publicacao" };

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
    { label: "Título",   ok: !!(cur.title || "").trim(),                stage: "rascunho" },
    { label: "Conteúdo", ok: !!(cur.body && cur.body.some(b => b.html)), stage: "rascunho" },
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

/* ---------------- IMAGENS — interactive, sourced from the draft ----------------
   Aggregates the cover/thumbnail AND every inline image the draft references
   (body blocks t:"img"). Each slot can be generated → choose a variant → done,
   alt text is editable, and state flows into the readiness/publish gate. */
const VAR_HUES = ["#2f6f8f", "#7a4fb0", "#b06a2f", "#2f8f5a"];
function ImageRow({ slotId, kind, label, alt, ready, big, gen, onGenerate, onPick, onTrocar, onAlt }) {
  const editAlt = (e) => onAlt && onAlt(e.currentTarget.textContent || "");
  return (
    <div className={"img-row" + (big ? " big" : "")}>
      <div className={"img-thumb" + (ready ? " ready" : "")}>
        {ready ? <div className="img-fill" /> : gen === "generating" ? <span className="img-spin" /> : <Icon name="media" size={big ? 26 : 18} />}
        {ready && <span className="img-badge ok"><Icon name="check" size={11} /></span>}
      </div>
      <div className="img-meta">
        <div className="img-row-head">
          <span className="img-kind">{kind}</span>
          <span className={"img-state " + (ready ? "ok" : gen === "generating" ? "gen" : gen === "choosing" ? "choose" : "wait")}>{ready ? "no ar" : gen === "generating" ? "gerando…" : gen === "choosing" ? "escolha 1" : "aguardando"}</span>
        </div>
        <div className="img-label">{label}</div>
        {alt !== undefined && (
          <div className="img-alt" contentEditable suppressContentEditableWarning spellCheck={false} onBlur={editAlt}
            data-empty={!alt} data-ph="Descreva a imagem (alt / prompt)…">{alt}</div>
        )}
        {gen === "choosing" && (
          <div className="img-cands">
            {VAR_HUES.slice(0, 3).map((h, i) => (
              <button key={i} className="img-cand" style={{ background: "linear-gradient(135deg," + h + ", #0c1320)" }} onClick={() => onPick(i + 1)} title={"Escolher variante " + (i + 1)}>
                <span className="cand-n">{i + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="img-actions">
        {ready
          ? <button className="btn sm" onClick={onTrocar}><Icon name="refresh" size={13} /> Trocar</button>
          : gen === "generating"
            ? <button className="btn sm" disabled style={{ opacity: .6 }}>…</button>
            : gen === "choosing"
              ? <button className="btn sm" onClick={onGenerate}><Icon name="refresh" size={13} /> Outras</button>
              : <button className="btn sm primary" onClick={onGenerate}><Icon name="sparkles" size={13} /> Gerar</button>}
      </div>
    </div>
  );
}
function ImagensStage({ post, cur, setImgStatus, setImgAlt, genAll }) {
  const coverReady = !!cur.coverReady;
  const inline = (cur.body || []).filter(b => b.t === "img");
  const total = 1 + inline.length;
  const done = (coverReady ? 1 : 0) + inline.filter(b => b.status === "done").length;
  const allReady = done === total;
  const [gen, setGen] = useState({});
  const start = (id) => {
    setGen(g => ({ ...g, [id]: "generating" }));
    setTimeout(() => setGen(g => (g[id] === "generating" ? { ...g, [id]: "choosing" } : g)), 700);
  };
  const pick = (id, n) => { setGen(g => { const x = { ...g }; delete x[id]; return x; }); setImgStatus(id, "done"); pushToast({ kind: "success", icon: "check", title: "Imagem escolhida", msg: id + " · variante " + n }); };

  return (
    <div className="col gap-18">
      <div className="img-summary">
        <div>
          <span className="img-sum-n">{done}/{total}</span> <span>imagens prontas</span>
          <div className="dim fs12" style={{ marginTop: 3 }}>1 capa · {inline.length} no conteúdo — definidas pelo rascunho</div>
        </div>
        {!allReady && <button className="btn sm primary" onClick={() => { setGen({}); genAll(); pushToast({ kind: "success", icon: "sparkles", title: "Imagens geradas", msg: (total - done) + " concluídas" }); }}><Icon name="sparkles" size={14} /> Gerar todas ({total - done})</button>}
        {allReady && <span className="img-alldone"><Icon name="checkcircle" size={15} /> Tudo pronto</span>}
      </div>

      <div>
        <div className="img-section-label">Capa &amp; thumbnail · 1200×675</div>
        <ImageRow slotId="cover" kind="Capa" label="Imagem de capa / social card"
          alt={undefined} ready={coverReady} big gen={gen.cover}
          onGenerate={() => start("cover")} onPick={(n) => pick("cover", n)} onTrocar={() => setImgStatus("cover", "pending")} />
      </div>

      {inline.length > 0 && (
        <div>
          <div className="img-section-label">No conteúdo · {inline.length}</div>
          <div className="col gap-10">
            {inline.map(b => (
              <ImageRow key={b.id} slotId={b.id} kind={b.id} label={"Imagem inline · " + b.id}
                alt={b.alt || ""} ready={b.status === "done"} gen={gen[b.id]}
                onGenerate={() => start(b.id)} onPick={(n) => pick(b.id, n)} onTrocar={() => setImgStatus(b.id, "pending")}
                onAlt={(v) => setImgAlt(b.id, v)} />
            ))}
          </div>
          <div className="img-hint"><Icon name="info" size={13} /> Essas imagens vêm dos blocos <span className="mono">{inline.map(b => b.id).join(", ")}</span> do rascunho. Adicione ou remova no editor de Rascunho.</div>
        </div>
      )}
    </div>
  );
}

/* ---------------- PUBLICAÇÃO ---------------- */
function PublicacaoStage({ post, cur, setActiveStage, onRepublish }) {
  const published = !!cur.published;
  const dirty = !!cur.dirty;
  const url = "bythiagofigueiredo.com/blog/" + cur.lang + "/" + (cur.slug || deriveSlug(cur.title) || "—");
  const gate = publishGate(post, cur);
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
              <button className="btn" style={{ color: "var(--c-links)", borderColor: "color-mix(in srgb,var(--c-links) 36%,transparent)", background: "var(--c-links-s)", width: "100%" }} onClick={() => pushToast({ kind: "success", icon: "globe", title: "Abrindo post", msg: url })}><Icon name="globe" size={15} /> Ver post no site</button>
              <button className="btn" style={{ width: "100%" }} onClick={() => pushToast({ kind: "success", icon: "posts", title: "Compartilhar nas redes", msg: "Instagram + Bluesky" })}><Icon name="posts" size={15} /> Compartilhar nas redes</button>
            </>
          : <div className="row gap-8">
              <button className="btn grow" disabled={!gate.ok} style={!gate.ok ? { opacity: .45, flex: 1 } : { flex: 1 }} onClick={() => pushToast({ kind: "info", icon: "calendar", title: "Agendar publicação" })}><Icon name="calendar" size={15} /> Agendar</button>
              <button className="btn primary grow" disabled={!gate.ok} style={!gate.ok ? { opacity: .45, flex: 1 } : { flex: 1 }} onClick={() => pushToast({ kind: "success", icon: "rss", title: "Publicar agora", msg: cur.title })}><Icon name="rss" size={15} /> Publicar</button>
            </div>}
      </div>
    </div>
  );
}

Object.assign(window, {
  EDITOR_STAGES, STAGE_MAP, deriveSlug, publishGate,
  CharCount, SeoStage, ImagensStage, PublicacaoStage,
});
