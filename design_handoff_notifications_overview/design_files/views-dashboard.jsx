/* ============================================================
   DASHBOARD (command center) + UP NEXT
   ============================================================ */
const A = window.DATA;

function priMeta(p) {
  return p >= 5 ? { c: "var(--danger)", l: "Crítico" } : p >= 4 ? { c: "var(--warn)", l: "Alta" } : { c: "var(--c-pipeline)", l: "Média" };
}

/* ---------------- DASHBOARD ---------------- */
function DashboardView({ notifs, go, onNotifAction, state }) {
  if (state === "loading") return <SkelDashboard />;
  if (state === "empty") return <EmptyDashboard go={go} />;
  const recent = notifs.filter(n => !n.read).slice(0, 4);
  const k = A.analytics.kpis;
  const quick = [
    { label: "Novo Post", sub: "Blog", icon: "blog", dom: "pipeline" },
    { label: "Novo Vídeo", sub: "YouTube", icon: "video", dom: "youtube" },
    { label: "Nova Edição", sub: "Newsletter", icon: "mail", dom: "newsletter" },
    { label: "Item Pipeline", sub: "Ideia", icon: "layers", dom: "pipeline" },
  ];
  const perf = [
    { l: "Views (30d)", v: k.views.v, d: k.views.delta, up: k.views.up, spark: k.views.spark, c: "var(--c-pipeline)" },
    { l: "Inscritos", v: k.subs.v, d: "+" + k.subs.delta, up: true, spark: k.subs.spark, c: "var(--c-links)" },
    { l: "Cliques em link", v: k.clicks.v, d: k.clicks.delta, up: k.clicks.up, spark: k.clicks.spark, c: "var(--accent)" },
    { l: "Receita (30d)", v: A.analytics.revenue.total, d: A.analytics.revenue.delta, up: true, spark: A.analytics.revenue.spark, c: "var(--c-youtube)" },
  ];

  return (
    <div className="fade-in">
      {/* quick actions */}
      <div className="qa-grid" style={{ marginBottom: 18 }}>
        {quick.map((q, i) => (
          <button key={i} className="qa" onClick={() => pushToast({ kind: "info", icon: q.icon, title: q.label, msg: "Abrindo editor de " + q.sub + "…" })}>
            <span className="qa-ico" style={{ background: DOMAINS[q.dom].soft, color: DOMAINS[q.dom].color }}><Icon name={q.icon} size={19} /></span>
            <span className="col" style={{ minWidth: 0 }}><span className="fw6 fs13 truncate">{q.label}</span><span className="dim fs11">{q.sub}</span></span>
            <span className="qa-key">{["P","V","N","I"][i]}</span>
          </button>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.55fr 1fr", alignItems: "start" }}>
        {/* LEFT */}
        <div className="col gap-16">
          {/* attention */}
          <Card>
            <CardHead icon="warn" title="Precisa de atenção" right={<span className="pill rose" style={{ marginLeft: 8 }}>{A.attention.length}</span>} link="Ver tudo" onLink={() => go("notifications")} />
            <div>
              {A.attention.map((a, i) => {
                const dm = DOMAINS[a.domain], pm = priMeta(a.priority);
                return (
                  <div key={i} className="attn-row" style={{ "--dc": dm.color }} onClick={() => go(a.route)}>
                    <span className="attn-ico" style={{ background: dm.soft, color: dm.color }}><Icon name={dm.icon} size={15} /></span>
                    <div className="grow">
                      <div className="row gap-8"><span className="fw5 fs13">{a.title}</span>
                        <span className="attn-pri" style={{ color: pm.c, background: "color-mix(in srgb,"+pm.c+" 14%, transparent)" }}>{pm.l}</span>
                      </div>
                      <div className="dim fs12 mt-4">{a.sub}</div>
                    </div>
                    <Icon name="chevronr" size={16} style={{ color: "var(--text-dim)" }} />
                  </div>
                );
              })}
            </div>
          </Card>

          {/* foco de hoje (from up next) */}
          <Card>
            <CardHead icon="target" title="Foco de hoje" right={<span className="dim fs12" style={{ marginLeft: 8 }}>0 de 2 feito · ~5h restantes</span>} link="Abrir Up Next" onLink={() => go("upnext")} />
            <div className="card-pad col gap-8">
              {[...A.queue.overdue.map(q => ({ ...q, overdue: true })), ...A.queue.today].map(q => (
                <div key={q.id} className="focus-slot filled" onClick={() => go("upnext")} style={{ minHeight: 0, cursor: "pointer" }}>
                  <span className="attn-ico" style={{ background: q.overdue ? "var(--danger-s)" : "var(--c-pipeline-s)", color: q.overdue ? "var(--danger)" : "var(--c-pipeline)" }}><Icon name={q.overdue ? "flame" : "clock"} size={15} /></span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="fw5 fs13 truncate">{q.title}</div>
                    <div className="dim fs12 mt-4">{q.task} · {q.est} {q.overdue && <span style={{ color: "var(--danger)", fontWeight: 600 }}>· Atrasado</span>}</div>
                  </div>
                  <Badge>{q.depth}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="col gap-16">
          {/* recent notifications */}
          <Card>
            <CardHead icon="bell" title="Notificações recentes" link="Caixa" onLink={() => go("notifications")} />
            <div>
              {recent.length === 0 ? <EmptyState icon="checkcheck" title="Em dia" sub="Sem notificações novas." /> :
                recent.map(n => {
                  const dm = DOMAINS[n.domain];
                  return (
                    <div key={n.id} className="attn-row" style={{ "--dc": dm.color, padding: "11px 16px" }} onClick={() => onNotifAction(n)}>
                      <span className="attn-ico" style={{ background: dm.soft, color: dm.color, width: 26, height: 26 }}><Icon name={n.icon || dm.icon} size={13} /></span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="fw5 fs12 truncate">{n.title}</div>
                        <div className="dim fs11 mt-4">{rel(n.mins)} atrás</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          {/* buffer health */}
          <Card className="card-pad">
            <div className="row between">
              <span className="card-title">Saúde do buffer</span>
              <Badge kind="warn" dot>2 semanas</Badge>
            </div>
            <div className="row gap-16 mt-16" style={{ alignItems: "center" }}>
              <Ring value={40} size={64} sw={7} color="var(--warn)" label="40%" sub="cobertura" />
              <div className="grow col gap-8">
                <div className="row between fs12"><span className="muted">Prontos para publicar</span><span className="fw6">1</span></div>
                <div className="row between fs12"><span className="muted">Em produção</span><span className="fw6">4</span></div>
                <div className="row between fs12"><span className="muted">No backlog</span><span className="fw6">159</span></div>
              </div>
            </div>
            <div className="divider mt-16" style={{ marginBottom: 12 }} />
            <div className="dim fs12" style={{ lineHeight: 1.45 }}><Icon name="info" size={13} style={{ verticalAlign: "-2px" }} /> Você tem ~2 semanas de conteúdo agendado. Avance itens da fila para chegar a 4+.</div>
          </Card>
        </div>
      </div>

      {/* performance */}
      <Card className="mt-16">
        <CardHead icon="trending" title="Resumo de performance" right={<span className="dim fs12" style={{ marginLeft: 8 }}>últimos 30 dias</span>} link="Ver Analytics" onLink={() => go("analytics")} />
        <div className="grid g-cols-4" style={{ padding: 18, gap: 18 }}>
          {perf.map((p, i) => (
            <div key={i} className="mini-metric" style={{ paddingRight: 16, borderRight: i < 3 ? "1px solid var(--border-soft)" : "none" }}>
              <div className="l">{p.l}</div>
              <div className="v">{p.v}</div>
              <div className="row gap-6">
                <span className={"delta " + (p.up ? "up" : "down")}><Icon name={p.up ? "arrowup" : "arrowdown"} size={12} />{typeof p.d === "number" ? p.d + "%" : p.d}</span>
                <span className="dim fs11">vs período anterior</span>
              </div>
              <Sparkline data={p.spark} color={p.c} h={30} w={200} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- UP NEXT ---------------- */
function UpNextView({ go }) {
  const [showBanner, setShowBanner] = useState(true);
  const allQueue = [...A.queue.overdue, ...A.queue.today];
  const [focus, setFocus] = useState([A.queue.overdue[0].id]);
  const pin = (q) => { setFocus(f => f.includes(q.id) ? f : f.length >= 3 ? f : [...f, q.id]); pushToast({ kind: "info", icon: "pin", title: "Fixado no foco", msg: q.title }); };
  const unpin = (id) => setFocus(f => f.filter(x => x !== id));
  const focusItems = focus.map(id => allQueue.find(q => q.id === id)).filter(Boolean);
  return (
    <div className="fade-in">
      <div className="row between" style={{ marginBottom: 6 }}>
        <div className="fs13"><span className="fw6" style={{ textTransform: "capitalize" }}>sexta-feira</span> <span className="dim">— 0 de 2 feito · ~5h restantes</span></div>
        <Badge kind="youtube" dot>Buffer · Vídeo 0/32</Badge>
      </div>
      <div className="bar" style={{ marginBottom: 22 }}><span style={{ width: "8%" }} /></div>

      <div className="section-label" style={{ marginBottom: 10 }}>Fila de produção</div>
      {[["Atrasado", A.queue.overdue, "var(--danger)", "flame"], ["Hoje", A.queue.today, "var(--c-pipeline)", "clock"]].map(([label, items, color, ic]) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <div className="row gap-8" style={{ marginBottom: 8 }}><Icon name={ic} size={13} style={{ color }} /><span className="fs12 fw6" style={{ color }}>{label.toUpperCase()}</span><span className="dim fs12">({items.length})</span></div>
          {items.map(q => (
            <div key={q.id} className="card card-pad" style={{ borderLeft: "3px solid " + color, marginBottom: 8 }}>
              <div className="row gap-8" style={{ marginBottom: 7 }}>
                <Badge>{q.depth} · {q.est}</Badge>
              </div>
              <div className="fw6" style={{ fontSize: 15, letterSpacing: "-0.2px" }}>{q.title}</div>
              <div className="dim fs12 mt-4">{q.task} · {label}</div>
              <div className="row gap-8 mt-8 dim fs12"><Icon name="user" size={13} />{q.author}<span style={{ margin: "0 4px" }}>·</span><span className="mono">{q.playlist} {q.code}</span></div>
              <div className="row gap-8 mt-16">
                <button className="btn sm primary" onClick={() => pushToast({ kind: "success", title: "Avançado", msg: q.title + " avançou de etapa.", icon: "checkcheck" })}><Icon name="arrowright" size={14} /> Avançar etapa</button>
                <button className="btn sm" onClick={() => pin(q)}><Icon name="pin" size={14} /> Fixar no foco</button>
                <button className="btn sm ghost"><Icon name="edit" size={14} /> Editar</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {showBanner && (
        <div className="card card-pad row gap-16" style={{ background: "var(--ok-s)", borderColor: "color-mix(in srgb,var(--ok) 30%, transparent)", marginTop: 6 }}>
          <Icon name="partypop" size={22} style={{ color: "var(--ok)" }} />
          <div className="grow"><span className="fs13">Esta semana: <span className="fw6" style={{ color: "var(--ok)" }}>3 itens publicados.</span> Continue assim 💪</span></div>
          <button className="icon-btn bare" onClick={() => setShowBanner(false)}><Icon name="x" size={16} /></button>
        </div>
      )}

      {/* foco de hoje */}
      <div className="row between mt-24" style={{ marginBottom: 10 }}>
        <div className="section-label row gap-8"><Icon name="target" size={13} /> Foco de hoje <span className="dim">({focus.length}/3)</span></div>
        <span className="dim fs12">Arraste itens da fila ou use “Fixar no foco”</span>
      </div>
      <div className="grid g-cols-3">
        {[0, 1, 2].map(i => {
          const q = focusItems[i];
          if (!q) return <div key={i} className="focus-slot"><Icon name="plus" size={15} /> Fixe um item da fila</div>;
          return (
            <div key={i} className="focus-slot filled" style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
              <div className="row gap-8" style={{ width: "100%" }}>
                <Icon name="grip" size={14} style={{ color: "var(--text-faint)" }} />
                <Badge>{q.depth}</Badge><div className="grow" />
                <button className="icon-btn bare" style={{ width: 22, height: 22 }} aria-label="Desafixar" onClick={() => unpin(q.id)}><Icon name="x" size={13} /></button>
              </div>
              <div className="fw6 fs13 truncate" style={{ width: "100%" }}>{q.title}</div>
              <div className="dim fs11">{q.task}</div>
            </div>
          );
        })}
      </div>

      {/* next 7 days */}
      <div className="section-label row gap-8 mt-24" style={{ marginBottom: 10 }}><Icon name="calendar" size={13} /> Próximos 7 dias</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
        {A.next7.map((d, i) => (
          <div key={i} className={"day-cell" + (d.today ? " today" : "")} style={{ minHeight: 92, textAlign: "left", padding: 11 }}>
            <div className="dn">{d.d} <span style={{ fontSize: 13 }}>{d.n}</span></div>
            <div style={{ marginTop: 28 }}>
              {d.type ? <Badge kind={d.type === "video" ? "youtube" : "pipeline"}>{d.flag} Vídeo</Badge> : <span className="dim fs12">—</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="row gap-16 mt-8 fs12 dim wrap">
        <span style={{ color: "var(--danger)" }}>● 162/6 escrever</span>
        <span style={{ color: "var(--warn)" }}>● 0/3 gravar</span>
        <span style={{ color: "var(--warn)" }}>● 1/4 pós-prod</span>
        <span style={{ color: "var(--ok)" }}>● 1/5 prontos</span>
        <div className="grow" />
        <span>2 vazios próx. semana · 159 no backlog</span>
      </div>

      {/* suggestions */}
      <div className="section-label row gap-8 mt-24" style={{ marginBottom: 10 }}><Icon name="sparkles" size={13} /> Sugestões por playlist</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {A.playlists.slice(0, 6).map((p, i) => (
          <Card key={i} className="card-pad">
            <div className="row gap-8" style={{ marginBottom: 4 }}><span className="legend-dot" style={{ background: p.color }} /><span className="fw6 fs13 truncate">{p.name}</span></div>
            <div className="dim fs12">{p.done}/{p.total} concluídos</div>
            <div className="bar mt-8"><span style={{ width: Math.max(3, (p.done / p.total) * 100) + "%", background: p.color }} /></div>
          </Card>
        ))}
      </div>

      {/* recent activity */}
      <div className="section-label row gap-8 mt-24" style={{ marginBottom: 10 }}><Icon name="refresh" size={13} /> Atividade recente</div>
      <Card>
        <div className="timeline">
          {[
            { ic: "checkcheck", c: "var(--ok)", t: "“Morei 4 Anos no Canadá” avançou para Revisão de edição", w: "2h" },
            { ic: "trophy", c: "var(--c-youtube)", t: "Teste A/B fechou — Variante B venceu com +18% CTR", w: "4h" },
            { ic: "arrowright", c: "var(--c-pipeline)", t: "“Aprendi Inglês” graduou para blog post", w: "5h" },
            { ic: "mail", c: "var(--c-newsletter)", t: "Edição #12 enviada a 1.284 inscritos", w: "3h" },
            { ic: "edit", c: "var(--text-dim)", t: "Você atualizou o roteiro de “O Momento Perfeito Não Existe”", w: "ontem" },
          ].map((a, i) => (
            <div key={i} className="tl-row">
              <div className="tl-ico" style={{ color: a.c }}><Icon name={a.ic} size={13} /></div>
              <span className="fs13 grow">{a.t}</span>
              <span className="dim fs12 mono">{a.w}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { DashboardView, UpNextView });
