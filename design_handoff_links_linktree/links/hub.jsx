/* ============================================================
   links/hub.jsx — hub "Links": Linktree · Short links · Analytics
   ============================================================ */

/* ---------- Linktree tab ---------- */
function TreeTab({ onEdit, onAnalytics }) {
  const D = window.LINKS_DATA.linktree;
  const bySection = {};
  D.blocks.forEach((b) => { (bySection[b.section] = bySection[b.section] || []).push(b); });
  const stats = [
    { k: "Pageviews", v: D.pageviews.toLocaleString("pt-BR"), icon: "eye" },
    { k: "Últimos 30d", v: D.last30.toLocaleString("pt-BR"), icon: "analytics", tint: "#46B17E" },
    { k: "Únicos", v: D.unique.toLocaleString("pt-BR"), icon: "subscribers", tint: "#3FA9C0" },
    { k: "Engajamento", v: D.engagement + "%", icon: "target", tint: "#E0A23C" },
  ];
  const maxCtr = Math.max(...D.blocks.map((b) => b.ctr), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* merge note */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", background: "var(--accent-soft)", border: "1px solid var(--line)", borderRadius: 11 }}>
        <Icon name="info" size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", flex: 1 }}><b style={{ color: "var(--ink)" }}>Link in Bio agora vive aqui.</b> Unificamos os dois itens de menu: a sua árvore é a <b style={{ color: "var(--ink)" }}>porta de entrada</b>, e os links rastreados ficam na aba ao lado.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18, alignItems: "start" }}>
        {/* preview */}
        <Card pad={20} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "stretch" }}>
            <Badge tone="amber" icon="linkbio">porta de entrada</Badge>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginLeft: "auto" }}>{D.url}</span>
          </div>
          <LinktreePreview width={280} shared={D.sharedLinks} />
          <div style={{ display: "flex", gap: 10, alignSelf: "stretch" }}>
            <Btn kind="primary" icon="type" onClick={onEdit} style={{ flex: 1 }}>Editar</Btn>
            <Btn kind="ghost" icon="external" onClick={() => window.__linksToast && window.__linksToast("Abrindo go.bythiagofigueiredo.com")}>Abrir</Btn>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12 }}>
            {stats.map((s) => (
              <Card key={s.k} pad={15}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Icon name={s.icon} size={14} style={{ color: s.tint || "var(--accent)" }} /><span className="eyebrow">{s.k}</span>
                </div>
                <div className="mono" style={{ fontSize: 23, fontWeight: 700 }}>{s.v}</div>
              </Card>
            ))}
          </div>
          {/* block performance */}
          <Panel title="Desempenho por bloco" icon="trophy" right={<Btn kind="quiet" size="sm" icon="analytics" onClick={onAnalytics}>Analytics</Btn>}>
            <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 14 }}>Qual link da árvore mais converte (CTR = cliques ÷ visualizações).</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {D.blocks.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 120, fontSize: 12.5, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{b.label}</span>
                  <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-faint)", width: 64, flexShrink: 0 }}>{b.section}</span>
                  <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${(b.ctr / maxCtr) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 99 }} />
                  </div>
                  <span className="mono" style={{ width: 64, textAlign: "right", fontSize: 11.5, color: "var(--ink-dim)" }}>{b.clicks} · {b.ctr}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------- Short links tab ---------- */
function StatusDot({ status }) {
  const c = status === "active" ? "var(--green)" : status === "paused" ? "var(--amber)" : "var(--red)";
  const l = status === "active" ? "Ativo" : status === "paused" ? "Pausado" : "Expirado";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: c }}><span style={{ width: 7, height: 7, borderRadius: 99, background: c }} />{l}</span>;
}

function ShortLinksTab({ onOpenLink, onNewLink, onOpenQR }) {
  const D = window.LINKS_DATA;
  const [src, setSrc] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const links = D.LINKS.filter((l) =>
    (src === "all" || l.source === src) &&
    (status === "all" || l.status === status) &&
    (!q || (l.title + l.slug + l.dest).toLowerCase().includes(q.toLowerCase()))
  );
  const totalClicks = D.LINKS.reduce((s, l) => s + l.clicks, 0);
  const active = D.LINKS.filter((l) => l.status === "active").length;
  const top = [...D.LINKS].sort((a, b) => b.clicks - a.clicks)[0];
  const tiles = [
    { k: "Total de links", v: D.LINKS.length, icon: "links" },
    { k: "Cliques totais", v: totalClicks.toLocaleString("pt-BR"), icon: "bolt", tint: "#46B17E", spark: D.analytics.byDay },
    { k: "Links ativos", v: active, icon: "target", tint: "#3FA9C0" },
    { k: "Top performer", v: top.clicks.toLocaleString("pt-BR"), icon: "trophy", tint: "#E0A23C", sub: top.slug, spark: top.spark },
  ];
  const unhealthy = D.LINKS.filter((l) => l.health !== "ok");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px,1fr))", gap: 14 }}>
        {tiles.map((t) => <StatTile key={t.k} label={t.k} value={t.v} icon={t.icon} iconTint={t.tint} sub={t.sub} spark={t.spark} sparkColor={t.tint} />)}
      </div>

      {/* health callout */}
      {unhealthy.length > 0 && (
        <Card pad={14} style={{ border: "1px solid rgba(217,97,74,0.3)", background: "rgba(217,97,74,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Icon name="warn" size={16} style={{ color: "var(--red)", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Saúde dos links</span>
            <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{unhealthy.length} link{unhealthy.length > 1 ? "s" : ""} precisam de atenção:</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
              {unhealthy.map((l) => (
                <button key={l.id} onClick={() => onOpenLink(l)} className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 10px", borderRadius: 99, whiteSpace: "nowrap", border: "1px solid " + (l.health === "broken" ? "rgba(217,97,74,0.4)" : "rgba(224,162,60,0.4)"), background: "transparent", color: l.health === "broken" ? "var(--red)" : "var(--amber)" }}>
                  <Icon name={l.health === "broken" ? "warn" : "clock"} size={12} />{l.slug} · {l.health === "broken" ? "destino quebrado" : "a expirar"}
                </button>
              ))}
            </div>
            <Btn kind="ghost" size="sm" icon="refresh" onClick={() => window.__linksToast && window.__linksToast("Verificando saúde de todos os links…")}>Revalidar</Btn>
          </div>
        </Card>
      )}

      {/* filters + search */}
      <Card pad={14}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, background: "var(--surface-2)", borderRadius: 9, padding: "9px 12px" }}>
          <Icon name="search" size={16} style={{ color: "var(--ink-faint)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar links…" style={{ flex: 1, background: "transparent", border: "none", color: "var(--ink)", fontSize: 13.5, outline: "none" }} />
          <Btn kind="primary" size="sm" icon="plus" onClick={onNewLink}>Novo link</Btn>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <FilterGroup label="Origem" value={src} onChange={setSrc} opts={[{ id: "all", label: "Tudo" }, ...D.SOURCES.map((s) => ({ id: s.id, label: s.label }))]} />
          <div style={{ width: 1, height: 18, background: "var(--line)" }} />
          <FilterGroup label="Status" value={status} onChange={setStatus} opts={[{ id: "all", label: "Tudo" }, { id: "active", label: "Ativos" }, { id: "paused", label: "Pausados" }]} />
        </div>
      </Card>

      {/* table */}
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 90px 90px 110px 70px", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
          {["Link", "Destino", "Tendência", "Cliques", "Status", ""].map((h) => <span key={h} className="eyebrow">{h}</span>)}
        </div>
        {links.map((l, i) => {
          const s = D.srcById(l.source) || { color: "var(--accent)", label: l.source };
          return (
            <div key={l.id} onClick={() => onOpenLink(l)} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 90px 90px 110px 70px", gap: 12, padding: "13px 18px", borderBottom: i < links.length - 1 ? "1px solid var(--line)" : "none", alignItems: "center", cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</span>
                  <span style={{ width: 7, height: 7, borderRadius: 3, background: s.color, flexShrink: 0 }} title={s.label} />
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>{l.slug}</span>
              </div>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.dest}</span>
              <Spark data={l.spark} color={s.color} w={70} h={24} />
              <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{l.clicks.toLocaleString("pt-BR")}</span>
              <StatusDot status={l.status} />
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button onClick={(e) => { e.stopPropagation(); onOpenQR(l); }} title="QR" style={{ background: "transparent", border: "none", color: "var(--ink-faint)", padding: 5, borderRadius: 6 }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--ink-faint)"}><Icon name="qr" size={16} /></button>
                <Icon name="chevronRight" size={16} style={{ color: "var(--ink-faint)", alignSelf: "center" }} />
              </div>
            </div>
          );
        })}
        {links.length === 0 && <div style={{ padding: "50px 20px", textAlign: "center", color: "var(--ink-faint)", fontSize: 13 }}>Nenhum link encontrado.</div>}
      </Card>
    </div>
  );
}

function FilterGroup({ label, value, onChange, opts }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
      <span className="eyebrow" style={{ marginRight: 2 }}>{label}</span>
      {opts.map((o) => {
        const on = value === o.id;
        return <button key={o.id} onClick={() => onChange(o.id)} style={{ padding: "4px 10px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, background: on ? "var(--accent)" : "var(--surface-2)", color: on ? "#1A120C" : "var(--ink-dim)" }}>{o.label}</button>;
      })}
    </div>
  );
}

/* ---------- Hub shell ---------- */
function LinksHub({ tab, setTab, onOpenLink, onEditTree, onTreeAnalytics, onOpenQR, onNewLink }) {
  const tabs = [{ id: "tree", label: "Linktree" }, { id: "links", label: "Short links" }, { id: "analytics", label: "Analytics" }];
  return (
    <>
      <PageHeader
        crumb={[{ label: "Social", icon: "links" }, { label: "Links" }]}
        title="Links"
        subtitle="Sua porta de entrada e os links rastreados — agora num lugar só."
        actions={<><Btn kind="ghost" size="sm" icon="qr" onClick={() => onOpenQR(window.LINKS_DATA.LINKS[0])}>QR Card</Btn><Btn kind="primary" icon="plus" onClick={onNewLink}>Novo link</Btn></>}
      >
        <div style={{ display: "flex", gap: 26, borderBottom: "1px solid var(--line)" }}>
          {tabs.map((t) => {
            const active = t.id === tab;
            return <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: "0 1px 13px", fontSize: 14, cursor: "pointer", position: "relative", color: active ? "var(--ink)" : "var(--ink-dim)", fontWeight: active ? 600 : 500 }}>{t.label}{active && <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: "var(--accent)", borderRadius: 2 }} />}</div>;
          })}
        </div>
      </PageHeader>
      <div style={{ padding: "24px 30px 60px", flex: 1 }}>
        {tab === "tree" && <TreeTab onEdit={onEditTree} onAnalytics={onTreeAnalytics} />}
        {tab === "links" && <ShortLinksTab onOpenLink={onOpenLink} onNewLink={onNewLink} onOpenQR={onOpenQR} />}
        {tab === "analytics" && <AnalyticsView onOpenLink={(l) => l && onOpenLink(l)} />}
      </div>
    </>
  );
}

Object.assign(window, { LinksHub, TreeTab, ShortLinksTab });
