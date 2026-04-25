/*
 * Direction 4 — "Pinboard" v2
 * Blog + YouTube as co-equal pillars. Dual hero (top post + top video),
 * unified chronological feed with visual type markers, dedicated channel
 * strip with subscribe CTA, polaroid video wall, and newsletter+subscribe
 * pairing.
 */

const Pinboard = ({ t, dark, content, tweaks, adsConfig }) => {
  const C = content;
  const posts = C.posts;
  const vids = C.videos;
  const cats = C.categories;
  const channels = C.channels;
  const sites = C.sites;
  const L = window._lang;
  // Primary channel matches current locale; other channel shown alongside
  const primaryCh  = channels.find(c => c.locale === L) || channels[0];
  const secondaryCh = channels.find(c => c.locale !== L) || channels[1];
  const ch = primaryCh; // back-compat alias

  // Shared kit — PageHeader + HeaderCTAs + shared card components
  const theme = window.makePinboardTheme(dark);
  const kit = window.makePinboardKit(theme);
  const { PageHeader, HeaderCTAs } = kit;

  // Paper-and-tape palette
  const bg     = dark ? "#14110B" : "#E9E1CE";
  const paper  = dark ? "#2A241A" : "#FBF6E8";
  const paper2 = dark ? "#312A1E" : "#F5EDD6";
  const ink    = dark ? "#EFE6D2" : "#161208";
  const muted  = dark ? "#958A75" : "#6A5F48";
  const faint  = dark ? "#6B634F" : "#9C9178";
  const line   = dark ? "#2E2718" : "#CEBFA0";
  const accent = dark ? "#FF8240" : "#C14513";
  const yt     = "#FF3333";
  const marker = "#FFE37A";
  const tape   = dark ? "rgba(255, 226, 140, 0.42)" : "rgba(255, 226, 140, 0.75)";
  const tape2  = dark ? "rgba(209, 224, 255, 0.36)" : "rgba(200, 220, 255, 0.7)";
  const tapeR  = dark ? "rgba(255, 120, 120, 0.40)" : "rgba(255, 150, 150, 0.7)";

  const hand = { fontFamily: '"Caveat", cursive', color: accent };
  const rot = (i) => ((i * 37) % 7 - 3) * 0.5;
  const lift = (i) => ((i * 53) % 5 - 2) * 2;

  const Tape = ({ color = tape, style = {} }) => (
    <div style={{
      position: "absolute", width: 80, height: 18,
      background: color,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
      ...style,
    }}/>
  );

  const Paper = ({ children, tint = paper, pad = "20px", rotation = 0, y = 0, shadow = true, style = {} }) => (
    <div style={{
      background: tint, padding: pad, position: "relative",
      transform: `rotate(${rotation}deg) translateY(${y}px)`,
      boxShadow: shadow
        ? (dark
          ? "0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)"
          : "0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)")
        : "none",
      ...style,
    }}>
      {children}
    </div>
  );

  // Type badges for feed
  const TypeBadge = ({ kind }) => {
    const isVideo = kind === "video";
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 8px",
        background: isVideo ? yt : ink,
        color: "#FFF",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
      }}>
        {isVideo ? (
          <><svg width="9" height="9" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg> {L === "pt" ? "vídeo" : "video"}</>
        ) : (
          <>▤ {L === "pt" ? "texto" : "post"}</>
        )}
      </div>
    );
  };

  // Playable video thumbnail with description
  const VideoThumb = ({ v, aspect = "16/9", size = "md" }) => (
    <div style={{
      position: "relative", aspectRatio: aspect, overflow: "hidden",
      ...window.postImg({ h: v.thumb.h, h2: v.thumb.h2, pattern: "grid" }, { dark }),
    }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55))" }}/>
      {/* YT play button */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: size === "lg" ? 68 : 52, height: size === "lg" ? 48 : 36,
          background: yt, borderRadius: size === "lg" ? 14 : 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(255,51,51,0.4)",
        }}>
          <svg width={size === "lg" ? 22 : 16} height={size === "lg" ? 22 : 16} viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div style={{
        position: "absolute", top: 8, left: 8,
        background: yt, color: "#FFF",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
        padding: "3px 7px",
      }}>▶ YouTube</div>
      <div style={{
        position: "absolute", bottom: 8, right: 8,
        background: "rgba(0,0,0,0.85)", color: "#FFF",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: "2px 7px",
      }}>{v.duration}</div>
    </div>
  );

  // Unified feed: merge posts + videos, sort by iso
  const feed = [
    ...posts.slice(0, 10).map(p => ({ kind: "post", iso: p.iso, data: p })),
    ...vids.map(v => ({ kind: "video", iso: v.iso, data: v })),
  ].sort((a, b) => b.iso.localeCompare(a.iso));

  const featuredPost = posts[0];
  const featuredVideo = vids[0];
  const restFeed = feed.filter(x => x.data !== featuredPost && x.data !== featuredVideo).slice(0, 9);
  const mostRead = [posts[2], posts[5], posts[8], posts[0], posts[10]].slice(0, 5);
  const catKeys = ["code", "product", "essay", "diary"];
  const extraVids = vids.slice(1);

  // ---- Ad selection ----
  const adsCfg = adsConfig || { enabled: true, slots: { marginalia: true, anchor: true, bookmark: true, bowtie: true, doorman: false } };
  const adsEnabled = adsCfg.enabled && window.AdsContent;
  const adSlot = adsCfg.slots || {};
  const sponsorList = adsEnabled ? Object.values(window.AdsContent.sponsors) : [];
  const houseList = adsEnabled ? Object.values(window.AdsContent.houseAds) : [];
  // Rotate daily so home feels fresh on revisits
  const adH = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const pickSponsor = (i = 0) => sponsorList.length ? sponsorList[Math.abs(adH + i) % sponsorList.length] : null;
  const pickHouse = (i = 0) => houseList.length ? houseList[Math.abs(adH + i) % houseList.length] : null;
  const adDoorman   = adsEnabled && adSlot.doorman    ? pickHouse(0) : null;
  const adMarginalia = adsEnabled && adSlot.marginalia ? pickHouse(1) : null;
  const adAnchor    = adsEnabled && adSlot.anchor     ? pickSponsor(0) : null;
  const adBookmark  = adsEnabled && adSlot.bookmark   ? pickSponsor(1) : null;
  const adBowtie    = adsEnabled && adSlot.bowtie     ? (window.AdsContent && window.AdsContent.houseAds.newsletter) || pickHouse(2) : null;

  return (
    <div style={{
      background: bg, color: ink, fontFamily: '"Inter", system-ui, sans-serif',
      backgroundImage: dark
        ? "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.015), transparent 40%), radial-gradient(circle at 85% 70%, rgba(255,255,255,0.015), transparent 40%)"
        : "radial-gradient(circle at 15% 20%, rgba(166,130,80,0.06), transparent 40%), radial-gradient(circle at 85% 70%, rgba(166,130,80,0.06), transparent 40%)",
    }}>
      {/* Global header */}
      <PageHeader
        nav={window.buildGlobalNav(t, C)}
        current="home"
        ctas={<HeaderCTAs content={C}/>}
      />

      {/* Doorman ad — dismissable banner (off by default) */}
      {adDoorman && <window.Doorman ad={adDoorman} L={L} theme={theme}/>}

      {/* Channel stats strip (home-specific — just below header) */}
      <div style={{ borderBottom: `1px dashed ${line}`, background: bg }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "10px 28px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 18, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: faint }}>
          <span>▸ {primaryCh.subs} {L === "pt" ? "inscritos" : "subs"}</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{posts.length} {L === "pt" ? "textos" : "posts"}</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{vids.length} {L === "pt" ? "vídeos" : "videos"}</span>
        </div>
      </div>

      {/* DUAL HERO — post + video, equal visual weight */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 28px 24px" }}>
        {/* Section label */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div style={{ ...hand, fontSize: 30, color: accent, transform: "rotate(-1.5deg)", display: "inline-block" }}>
            ★ {L === "pt" ? "o destaque da semana" : "this week's picks"}
          </div>
          <div style={{ flex: 1, height: 1, background: line }}/>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: muted, letterSpacing: "0.14em" }}>
            {L === "pt" ? "SEM 16 · 2026" : "WK 16 · 2026"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          {/* FEATURED POST */}
          <div style={{ position: "relative", paddingTop: 20 }}>
            <Paper tint={paper} pad="0" rotation={-0.8}>
              <Tape color={tape} style={{ top: -10, left: "18%", transform: "rotate(-4deg)" }}/>
              <Tape color={tape2} style={{ top: -10, right: "18%", transform: "rotate(5deg)" }}/>
              <a href={`post.html?slug=${featuredPost.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div style={{ position: "relative" }}>
                  <PostImg post={featuredPost} dark={dark} style={{ aspectRatio: "16/9" }}/>
                  <div style={{ position: "absolute", top: 10, left: 10 }}>
                    <TypeBadge kind="post"/>
                  </div>
                </div>
                <div style={{ padding: "22px 26px 26px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <CatTag cat={featuredPost.cat} dark={dark} size="sm"/>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted, letterSpacing: "0.1em" }}>
                      {featuredPost["date_" + L]} · {featuredPost.read} {t.min_read}
                    </span>
                  </div>
                  <h1 style={{
                    fontFamily: '"Fraunces", serif',
                    fontSize: "clamp(24px, 2.8vw, 34px)",
                    lineHeight: 1.08, letterSpacing: "-0.02em",
                    margin: 0, fontWeight: 500, textWrap: "balance",
                  }}>
                    {featuredPost["title_" + L]}
                  </h1>
                  <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.55, marginTop: 12, marginBottom: 0,
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {featuredPost["excerpt_" + L]}
                  </p>
                </div>
              </a>
            </Paper>
            <div style={{ position: "absolute", bottom: -22, left: 32, ...hand, fontSize: 20, transform: "rotate(-2deg)" }}>
              ← {L === "pt" ? "leitura obrigatória" : "must-read"}
            </div>
          </div>

          {/* FEATURED VIDEO */}
          <div style={{ position: "relative", paddingTop: 20 }}>
            <Paper tint={paper} pad="0" rotation={0.8}>
              <Tape color={tapeR} style={{ top: -10, left: "22%", transform: "rotate(4deg)" }}/>
              <Tape color={tape} style={{ top: -10, right: "15%", transform: "rotate(-3deg)" }}/>
              <a href="#" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <VideoThumb v={featuredVideo} aspect="16/9" size="lg"/>
                <div style={{ padding: "22px 26px 26px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{
                      padding: "2px 8px", background: yt, color: "#FFF",
                      fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                      letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
                    }}>
                      {featuredVideo["series_" + L]}
                    </span>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted, letterSpacing: "0.1em" }}>
                      {featuredVideo["views_" + L]} · {featuredVideo["date_" + L]}
                    </span>
                  </div>
                  <h1 style={{
                    fontFamily: '"Fraunces", serif',
                    fontSize: "clamp(24px, 2.8vw, 34px)",
                    lineHeight: 1.08, letterSpacing: "-0.02em",
                    margin: 0, fontWeight: 500, textWrap: "balance",
                  }}>
                    {featuredVideo["title_" + L]}
                  </h1>
                  <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.55, marginTop: 12, marginBottom: 0 }}>
                    {featuredVideo["desc_" + L]}
                  </p>
                </div>
              </a>
            </Paper>
            <div style={{ position: "absolute", bottom: -22, right: 32, ...hand, fontSize: 20, transform: "rotate(2deg)" }}>
              {L === "pt" ? "novo no canal →" : "fresh on the channel →"}
            </div>
          </div>
        </div>
      </section>

      {/* CHANNEL STRIP — show BOTH channels (PT + EN) */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 28px 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 24 }}>
          <div style={{ ...hand, fontSize: 26, color: yt, transform: "rotate(-1.5deg)", display: "inline-block" }}>
            ▶ {L === "pt" ? "dois canais, dois idiomas" : "two channels, two languages"}
          </div>
          <div style={{ flex: 1, height: 1, background: line }}/>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: muted, letterSpacing: "0.14em" }}>
            {L === "pt" ? "INSCREVA-SE EM UM OU NOS DOIS" : "SUBSCRIBE TO ONE OR BOTH"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          {[primaryCh, secondaryCh].map((c, idx) => (
            <div key={c.locale} style={{ position: "relative", paddingTop: 14 }}>
              <Paper tint={dark ? "#1A1410" : "#FFF3EC"} pad="22px 26px" rotation={idx === 0 ? -0.4 : 0.5} style={{ border: `2px solid ${yt}` }}>
                <Tape color={tapeR} style={{ top: -9, left: idx === 0 ? "36%" : "44%", transform: `rotate(${idx === 0 ? -2 : 3}deg)` }}/>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 18, alignItems: "center" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: yt, display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(255,51,51,0.3)", position: "relative",
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
                    <div style={{
                      position: "absolute", bottom: -4, right: -4,
                      width: 24, height: 24, borderRadius: "50%",
                      background: dark ? "#1A1410" : "#FFF3EC",
                      border: `2px solid ${yt}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12,
                    }}>{c.flag}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: yt, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 1 }}>
                      ▶ {c["lang_label_" + L]}
                      {c.locale === L && (
                        <span style={{ marginLeft: 8, color: muted, fontWeight: 400, letterSpacing: "0.1em" }}>
                          · {L === "pt" ? "este idioma" : "this locale"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: '"Fraunces", serif', fontSize: 20, fontWeight: 500, letterSpacing: "-0.015em" }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                      {c["subs_" + L]} · {c["videos_" + L]}
                    </div>
                    <div style={{ fontSize: 12, color: faint, marginTop: 2, fontStyle: "italic" }}>
                      {c["schedule_" + L]}
                    </div>
                  </div>
                  <a href={c.url} target="_blank" rel="noopener" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: yt, color: "#FFF", padding: "10px 16px",
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                    boxShadow: "0 3px 0 rgba(0,0,0,0.12)", whiteSpace: "nowrap",
                  }}>
                    {L === "pt" ? "Inscrever" : "Subscribe"} →
                  </a>
                </div>
              </Paper>
            </div>
          ))}
        </div>
      </section>

      {/* WRITING — 6 latest (no filters on home) */}
      <section id="writing" style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 28px 40px", scrollMarginTop: 110 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>
              § 02 · {L === "pt" ? "escritos" : "writing"}
            </div>
            <h2 style={{
              fontFamily: '"Fraunces", serif', fontSize: 42, margin: 0, fontWeight: 500,
              letterSpacing: "-0.02em", position: "relative", display: "inline-block",
            }}>
              {L === "pt" ? "Últimos escritos" : "Latest writing"}
              <span style={{
                position: "absolute", bottom: 2, left: -4, right: -4, height: 14,
                background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
              }}/>
            </h2>
            <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>
              {L === "pt" ? "ensaios, código, diário — os 6 mais recentes" : "essays, code, journal — latest 6"}
            </div>
          </div>
          <a href="blog.html" style={{ ...hand, fontSize: 20, color: accent, transform: "rotate(-1deg)", display: "inline-block", textDecoration: "none" }}>
            {L === "pt" ? "ver arquivo completo →" : "see full archive →"}
          </a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 40, rowGap: 56 }}>
          {posts.slice(0, 6).map((d, i) => (
            <div key={"p-" + d.slug} style={{ position: "relative", paddingTop: 16 }}>
              <Paper tint={i % 3 === 1 ? paper2 : paper} pad="0" rotation={rot(i)} y={lift(i)}>
                <Tape
                  color={i % 2 ? tape2 : tape}
                  style={{ top: -9, [i % 2 ? "left" : "right"]: "28%", transform: `rotate(${(i * 11) % 12 - 6}deg)` }}
                />
                <a href={`post.html?slug=${d.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div style={{ position: "relative" }}>
                    <PostImg post={d} dark={dark} style={{ aspectRatio: "16/10" }}/>
                    <div style={{ position: "absolute", top: 8, left: 8 }}>
                      <TypeBadge kind="post"/>
                    </div>
                  </div>
                  <div style={{ padding: "16px 18px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <CatTag cat={d.cat} dark={dark} size="xs"/>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: "0.08em" }}>
                        {d["date_" + L]}
                      </span>
                    </div>
                    <h3 style={{
                      fontFamily: '"Fraunces", serif', fontSize: 19, lineHeight: 1.2,
                      margin: "6px 0 8px", fontWeight: 500, letterSpacing: "-0.01em",
                    }}>
                      {d["title_" + L]}
                    </h3>
                    <div style={{ fontSize: 12, color: muted, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.04em" }}>
                      {d.read} {t.min_read} · {L === "pt" ? "leitura" : "read"}
                    </div>
                  </div>
                </a>
              </Paper>
              {i === 0 && (
                <div style={{ position: "absolute", top: -4, right: -6, ...hand, fontSize: 18, transform: "rotate(12deg)", color: accent }}>
                  ⭐ {L === "pt" ? "top!" : "yess"}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 48 }}>
          <a href="blog.html" style={{
            display: "inline-block", padding: "12px 26px",
            background: "transparent", color: ink,
            border: `1.5px solid ${line}`,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
            letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600,
            textDecoration: "none",
          }}>
            {t.all_articles}
          </a>
        </div>
      </section>

      {/* Bookmark ad — inline sponsor scrap between Writing and Videos */}
      {adBookmark && (
        <div style={{ maxWidth: 760, margin: "-8px auto 0", padding: "0 28px" }}>
          <window.Bookmark ad={adBookmark} L={L} theme={theme}/>
        </div>
      )}

      {/* VIDEOS — 3 latest (no filters on home) */}
      <section id="videos" style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 28px 32px", borderTop: `1px dashed ${line}`, marginTop: 32, scrollMarginTop: 110 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: yt, marginBottom: 8 }}>
              § 03 · {L === "pt" ? "do canal" : "from the channel"}
            </div>
            <h2 style={{
              fontFamily: '"Fraunces", serif', fontSize: 42, margin: 0, fontWeight: 500,
              letterSpacing: "-0.02em",
            }}>
              {L === "pt" ? "Últimos vídeos" : "Latest videos"}
            </h2>
            <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>
              {L === "pt" ? "live-coding, setup, bugs — os 3 mais recentes" : "live-coding, setup, bugs — latest 3"}
            </div>
          </div>
          <a href="videos.html" style={{ ...hand, fontSize: 22, color: yt, textDecoration: "none", transform: "rotate(-1deg)", display: "inline-block" }}>
            {L === "pt" ? "ver todos os vídeos →" : "see all videos →"}
          </a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, rowGap: 48, paddingTop: 12 }}>
          {vids.slice(0, 3).map((v, i) => (
            <div key={v.id} style={{ position: "relative", paddingTop: 16 }}>
              <Paper tint={paper} pad="12px 12px 18px" rotation={rot(i + 11)} y={lift(i + 11)}>
                <Tape color={tapeR} style={{ top: -9, left: "40%", transform: `rotate(${(i * 7) % 10 - 5}deg)` }}/>
                <a href={`videos.html#${v.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <VideoThumb v={v} aspect="4/3"/>
                  <div style={{ paddingTop: 14, paddingLeft: 4, paddingRight: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{
                        padding: "2px 7px", background: yt, color: "#FFF",
                        fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                        letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
                      }}>{v["series_" + L]}</span>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: "0.08em" }}>
                        {v["date_" + L]}
                      </span>
                    </div>
                    <h3 style={{
                      fontFamily: '"Fraunces", serif', fontSize: 19, lineHeight: 1.2,
                      margin: "0 0 8px", fontWeight: 500, letterSpacing: "-0.01em",
                    }}>
                      {v["title_" + L]}
                    </h3>
                    <p style={{ fontSize: 13, color: muted, lineHeight: 1.5, margin: "0 0 10px",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {v["desc_" + L]}
                    </p>
                    <div style={{ fontSize: 11, color: faint, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.06em" }}>
                      {v.duration} · {v["views_" + L]}
                    </div>
                  </div>
                </a>
              </Paper>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 48 }}>
          <a href={primaryCh.url} target="_blank" rel="noopener" style={{
            display: "inline-block", padding: "12px 26px",
            background: yt, color: "#FFF",
            border: `1.5px solid ${yt}`,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
            letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600,
            textDecoration: "none",
          }}>
            ▶ {L === "pt" ? "inscreve no canal" : "subscribe on yt"}
          </a>
        </div>
      </section>

      {/* Anchor ad — full-width horizontal sponsor row between Videos and Most-Read */}
      {adAnchor && (
        <div style={{ maxWidth: 1280, margin: "48px auto 0", padding: "0 28px" }}>
          <window.HorizontalAnchor ad={adAnchor} L={L} theme={theme}/>
        </div>
      )}

      {/* MOST READ + CATEGORIES side-by-side */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 28px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 56 }}>
          {/* Most read */}
          <div style={{ position: "relative", paddingTop: 12 }}>
            <Paper tint={paper2} pad="24px 26px" rotation={0.5}>
              <Tape color={tape} style={{ top: -9, right: 18, transform: "rotate(4deg)" }}/>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                letterSpacing: "0.18em", textTransform: "uppercase", color: accent, marginBottom: 4,
              }}>
                ★ {t.most_read}
              </div>
              <div style={{ ...hand, fontSize: 24, marginBottom: 14, color: ink, transform: "rotate(-0.8deg)", display: "inline-block" }}>
                {L === "pt" ? "mais lidos do mês" : "top reads this month"}
              </div>
              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {mostRead.map((post, i) => (
                  <li key={post.slug + i} style={{
                    display: "grid", gridTemplateColumns: "auto 1fr", gap: 12,
                    padding: "11px 0",
                    borderTop: i === 0 ? "none" : `1px dashed ${line}`,
                  }}>
                    <span style={{ ...hand, fontSize: 30, color: accent, lineHeight: 0.9, minWidth: 24 }}>
                      {i + 1}.
                    </span>
                    <a href={`post.html?slug=${post.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <CatTag cat={post.cat} dark={dark} size="xs"/>
                      <div style={{
                        fontFamily: '"Fraunces", serif', fontSize: 15, lineHeight: 1.25,
                        marginTop: 3, fontWeight: 500, letterSpacing: "-0.005em",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {post["title_" + L]}
                      </div>
                    </a>
                  </li>
                ))}
              </ol>
            </Paper>

            {/* Marginalia ad — horizontal house note card (torn-paper feel) */}
            {adMarginalia && (
              <div style={{ marginTop: 26 }}>
                <window.Marginalia ad={adMarginalia} L={L} theme={theme} variant="paper"/>
              </div>
            )}
          </div>

          {/* Categories */}
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>
                § 04
              </div>
              <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 32, margin: 0, fontWeight: 500, letterSpacing: "-0.02em", fontStyle: "italic" }}>
                {t.by_category}
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 28 }}>
              {catKeys.map((key, ci) => {
                const cat = cats[key];
                const cPosts = posts.filter(p => p.cat === key).slice(0, 2);
                if (!cPosts.length) return null;
                return (
                  <div key={key} style={{ position: "relative", paddingTop: 12 }}>
                    <Paper tint={paper} pad="0" rotation={rot(ci + 8) * 0.4}>
                      <div style={{
                        position: "absolute", top: -14, left: 18,
                        background: cat.color, color: "#FFF",
                        padding: "5px 16px",
                        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                        letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                      }}>
                        {cat[L]}
                      </div>
                      <div style={{ padding: "26px 20px 18px" }}>
                        {cPosts.map((post, i) => (
                          <a key={post.slug} href={`post.html?slug=${post.slug}`} style={{
                            textDecoration: "none", color: "inherit",
                            display: "block",
                            paddingBottom: i < cPosts.length - 1 ? 12 : 0,
                            paddingTop: i > 0 ? 12 : 0,
                            borderBottom: i < cPosts.length - 1 ? `1px dashed ${line}` : "none",
                          }}>
                            <h4 style={{
                              fontFamily: '"Fraunces", serif', fontSize: 15, lineHeight: 1.2,
                              margin: 0, fontWeight: 500, letterSpacing: "-0.005em",
                            }}>
                              {post["title_" + L]}
                            </h4>
                            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, marginTop: 4, letterSpacing: "0.06em" }}>
                              {post["date_" + L]} · {post.read} {t.min_read}
                            </div>
                          </a>
                        ))}
                      </div>
                    </Paper>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Bowtie ad — house newsletter card above the pair */}
      {adBowtie && (
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "40px 28px 0" }}>
          <window.Bowtie ad={adBowtie} L={L} theme={theme}/>
        </section>
      )}

      {/* NEWSLETTER + SUBSCRIBE pair — two cards, equal weight */}
      <section id="newsletter" style={{ maxWidth: 1280, margin: "0 auto", padding: "88px 28px 64px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ ...hand, fontSize: 28, color: accent, transform: "rotate(-1deg)", display: "inline-block", marginBottom: 4 }}>
            {L === "pt" ? "duas formas de acompanhar" : "two ways to follow along"}
          </div>
          <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 44, margin: "6px 0 0", fontWeight: 500, letterSpacing: "-0.025em", fontStyle: "italic" }}>
            {L === "pt" ? "Escolhe o teu canal" : "Pick your channel"}
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          {/* Newsletter card */}
          <div style={{ position: "relative", paddingTop: 18 }}>
            <Paper tint={paper} pad="36px 36px 32px" rotation={-0.6}>
              <Tape color={tape} style={{ top: -9, left: "22%", transform: "rotate(-3deg)" }}/>
              <Tape color={tape2} style={{ top: -9, right: "22%", transform: "rotate(4deg)" }}/>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: 10,
              }}>
                ✉ {t.newsletter.kicker}
              </div>
              <h3 style={{
                fontFamily: '"Fraunces", serif', fontSize: 38, margin: 0, fontWeight: 500,
                letterSpacing: "-0.025em", fontStyle: "italic", lineHeight: 1,
              }}>
                {t.newsletter.title}
              </h3>
              <p style={{ fontSize: 15, color: muted, lineHeight: 1.55, marginTop: 14 }}>
                {t.newsletter.subtitle}
              </p>
              <form onSubmit={e => e.preventDefault()} style={{ marginTop: 18, display: "flex", gap: 8 }}>
                <input type="email" placeholder={t.newsletter.placeholder} style={{
                  flex: 1, padding: "12px 16px", border: `1.5px dashed ${line}`, borderRadius: 0,
                  background: bg, color: ink, fontSize: 14, outline: "none", minWidth: 0,
                }}/>
                <button style={{
                  padding: "12px 20px", background: ink, color: bg, border: "none", borderRadius: 0,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em",
                }}>
                  {t.newsletter.cta}
                </button>
              </form>
              <div style={{ ...hand, fontSize: 16, color: accent, marginTop: 12, transform: "rotate(-1deg)", display: "block" }}>
                {t.newsletter.footnote}
              </div>
            </Paper>
          </div>

          {/* YouTube subscribe card */}
          <div style={{ position: "relative", paddingTop: 18 }}>
            <Paper tint={dark ? "#1A1410" : "#FFF3EC"} pad="36px 36px 32px" rotation={0.6} style={{ border: `2px solid ${yt}` }}>
              <Tape color={tapeR} style={{ top: -9, left: "28%", transform: "rotate(3deg)" }}/>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.2em", textTransform: "uppercase", color: yt, marginBottom: 10, fontWeight: 600,
              }}>
                ▶ YouTube
              </div>
              <h3 style={{
                fontFamily: '"Fraunces", serif', fontSize: 38, margin: 0, fontWeight: 500,
                letterSpacing: "-0.025em", fontStyle: "italic", lineHeight: 1,
              }}>
                {L === "pt" ? "Canal ao vivo" : "On the channel"}
              </h3>
              <p style={{ fontSize: 15, color: muted, lineHeight: 1.55, marginTop: 14 }}>
                {L === "pt"
                  ? "Live-coding, tours de setup, retrospectivas de bug. Um vídeo novo toda quinta, às vezes dois."
                  : "Live-coding, setup tours, bug retrospectives. A new video every Thursday, sometimes two."}
              </p>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                {[primaryCh, secondaryCh].map((c) => (
                  <div key={c.locale} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", background: bg, border: `1px solid ${line}`,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: yt, display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative", flexShrink: 0,
                    }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
                      <div style={{
                        position: "absolute", bottom: -3, right: -3,
                        width: 18, height: 18, borderRadius: "50%",
                        background: bg, border: `1.5px solid ${yt}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10,
                      }}>{c.flag}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: '"Fraunces", serif', fontSize: 14, fontWeight: 600, lineHeight: 1.1 }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>
                        {c["subs_" + L]} · {c["lang_label_" + L]}
                      </div>
                    </div>
                    <a href={c.url} target="_blank" rel="noopener" style={{
                      padding: "7px 12px", background: yt, color: "#FFF", fontSize: 12, fontWeight: 600,
                      textDecoration: "none", whiteSpace: "nowrap",
                    }}>
                      {L === "pt" ? "Inscrever" : "Subscribe"}
                    </a>
                  </div>
                ))}
              </div>
              <div style={{ ...hand, fontSize: 16, color: yt, marginTop: 12, transform: "rotate(1deg)", display: "block" }}>
                {L === "pt" ? "quinta que vem: vídeos novos nos dois canais" : "next Thursday: new videos on both"}
              </div>
            </Paper>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: "32px 28px", textAlign: "center" }}>
        <div style={{ ...hand, fontSize: 22, color: muted }}>
          — {L === "pt" ? "feito à mão em BH, 2026" : "handmade in Brazil, 2026"} —
        </div>
      </footer>
    </div>
  );
};

window.Pinboard = Pinboard;
