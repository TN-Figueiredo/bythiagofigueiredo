/* ============================================================
   links/detail.jsx — página de um short link
   ============================================================ */

function LinkStatTile({ label, value, icon, tint }) {
  return (
    <Card pad={16}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: (tint || "var(--accent)") + "22", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={15} style={{ color: tint || "var(--accent)" }} /></span>
        <span className="eyebrow">{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{value}</div>
    </Card>
  );
}

function HealthBadge({ health }) {
  const map = { ok: { tone: "green", label: "saudável", icon: "check" }, warn: { tone: "amber", label: "a expirar", icon: "clock" }, broken: { tone: "red", label: "quebrado", icon: "warn" } };
  const h = map[health] || map.ok;
  return <Badge tone={h.tone} icon={h.icon}>{h.label}</Badge>;
}

function LinkDetail({ link, onBack, onOpenQR }) {
  const D = window.LINKS_DATA;
  const src = D.srcById(link.source) || { label: link.source, color: "var(--accent)" };
  const [showAnalytics, setShowAnalytics] = useState(false);
  const paused = link.status === "paused";
  const toast = (m) => window.__linksToast && window.__linksToast(m);
  return (
    <>
      <PageHeader
        crumb={[{ label: "Social", icon: "links" }, { label: "Links", onClick: onBack }, { label: link.title }]}
        title={link.title}
        actions={
          <>
            <Btn kind="ghost" size="sm" icon="copy" onClick={() => toast("URL copiada")}>Copiar URL</Btn>
            <Btn kind="ghost" size="sm" icon="qr" onClick={onOpenQR}>QR</Btn>
            <Btn kind="ghost" size="sm" icon={paused ? "play" : "clock"} onClick={() => toast(paused ? "Link reativado" : "Link pausado")}>{paused ? "Reativar" : "Pausar"}</Btn>
            <Btn kind="primary" size="sm" icon="type" onClick={() => toast("Abrindo edição…")}>Editar</Btn>
          </>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: paused ? "var(--amber)" : "var(--green)" }} />
          <span style={{ fontSize: 12.5, color: paused ? "var(--amber)" : "var(--green)", fontWeight: 600 }}>{paused ? "Pausado" : "Ativo"}</span>
          <Badge tone="neutral" style={{ background: src.color + "22", color: src.color }}>{link.badge}</Badge>
          <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{link.slug}</span>
          <HealthBadge health={link.health} />
        </div>
      </PageHeader>

      <div style={{ padding: "0 30px 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* destination */}
        <Card pad={16}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Destino</div>
          <a style={{ fontSize: 14, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 7, wordBreak: "break-all" }}>{link.dest} <Icon name="external" size={14} /></a>
        </Card>

        {/* stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 }}>
          <LinkStatTile label="Cliques totais" value={link.clicks.toLocaleString("pt-BR")} icon="links" />
          <LinkStatTile label="Últimos 30 dias" value={link.last30} icon="analytics" tint="#46B17E" />
          <LinkStatTile label="Visitantes únicos" value={link.unique.toLocaleString("pt-BR")} icon="subscribers" tint="#3FA9C0" />
          <LinkStatTile label="QR scans" value={link.scans.toLocaleString("pt-BR")} icon="qr" tint="#E0A23C" />
        </div>

        {/* details + qr promo */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, alignItems: "start" }}>
          <Card pad={18}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Detalhes</div>
            {[
              { k: "Redirect", icon: "external", v: <span className="mono" style={{ fontSize: 12.5 }}>{link.redirect}</span> },
              { k: "Click IDs", icon: "target", v: <Badge tone={link.clickIds ? "green" : "neutral"}>{link.clickIds ? "on" : "off"}</Badge> },
              { k: "Origem", icon: "filter", v: <Badge tone="neutral" style={{ background: src.color + "22", color: src.color }}>{src.label}</Badge> },
              { k: "Criado", icon: "schedule", v: <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{link.created}</span> },
              { k: "Saúde", icon: "bolt", v: <HealthBadge health={link.health} /> },
            ].map((r, i, arr) => (
              <div key={r.k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                <Icon name={r.icon} size={15} style={{ color: "var(--ink-faint)" }} />
                <span style={{ fontSize: 13, color: "var(--ink-dim)", flex: 1 }}>{r.k}</span>
                {r.v}
              </div>
            ))}
          </Card>
          {/* QR promo */}
          <Card pad={18} style={{ background: "var(--surface-2)" }} hover onClick={onOpenQR}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>QR Card</div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 78, height: 78, borderRadius: 10, background: "#fff", padding: 7, flexShrink: 0 }}>
                <div style={{ width: "100%", height: "100%", background: "repeating-conic-gradient(#111 0% 25%, #fff 0% 50%) 0 / 12px 12px" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.5 }}>Gere um cartão de QR no <b style={{ color: "var(--ink)" }}>canvas</b> — templates de impressão, story e adesivo.</div>
                <Btn kind="primary" size="sm" icon="qr" style={{ marginTop: 12 }} onClick={onOpenQR}>Abrir editor de QR</Btn>
              </div>
            </div>
          </Card>
        </div>

        {/* analytics */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <button onClick={() => setShowAnalytics(!showAnalytics)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", background: "transparent", border: "none", color: "var(--ink)" }}>
            <Icon name="analytics" size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, textAlign: "left" }}>Analytics completo</span>
            <Icon name="chevronDown" size={16} style={{ transform: showAnalytics ? "none" : "rotate(-90deg)", transition: "transform .2s", color: "var(--ink-dim)" }} />
          </button>
          {showAnalytics && <div className="fade-up" style={{ padding: "0 18px 20px", borderTop: "1px solid var(--line)" }}><div style={{ paddingTop: 18 }}><LinkAnalytics link={link} /></div></div>}
        </Card>
      </div>
    </>
  );
}

Object.assign(window, { LinkDetail });
