// timeline.jsx — DaVinci Resolve-style timeline component
const { useState, useRef, useCallback, useEffect, useMemo } = React;

// ── Utilities ──────────────────────────────────────
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function fmtDur(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s > 0 ? `${m}m${String(s).padStart(2,'0')}s` : `${m}m`;
}
function pRand(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function badgeTextColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.52 ? '#111' : '#fff';
}
function tickInterval(dur) {
  if (dur <= 15) return 1;
  if (dur <= 30) return 2;
  if (dur <= 60) return 5;
  if (dur <= 180) return 10;
  if (dur <= 600) return 30;
  return 60;
}

// ── Constants ──────────────────────────────────────
const PANEL_W = 190;
const DEF_H = 34;
const MIN_H = 16;
const MAX_H = 120;
const RULER_H = 26;
const HANDLE_H = 4;
const DIVIDER_H = 16;
const EMPTY_H = 18;

// ── Theme ──────────────────────────────────────────
const TH = {
  bg:       '#111114',
  surface:  '#19191d',
  surface2: '#222226',
  header:   '#1c1c20',
  border:   '#2a2a30',
  brdLight: '#38383f',
  text:     '#c8c4bc',
  muted:    '#78756e',
  dim:      '#4a4844',
  accent:   '#FF8240',
  ruler:    '#161619',
  playhead: '#e04040',
  divLine:  'rgba(255,130,64,0.18)',
};
const mono = { fontFamily: '"JetBrains Mono", monospace' };
const monoSm = { ...mono, fontSize: 10, letterSpacing: '0.05em' };
const monoXs = { ...mono, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' };

// ── Audio waveform decoration ──────────────────────
const WaveDecor = ({ width, height, color, seed = 0 }) => {
  const bw = 2, gap = 1, step = bw + gap;
  const n = Math.max(1, Math.floor(width / step));
  const bars = [];
  for (let i = 0; i < n; i++) {
    const r = pRand(i + seed * 7.3);
    const h = r * 0.55 + 0.25;
    bars.push(<rect key={i} x={i * step} y={height * (1 - h) / 2} width={bw} height={height * h} fill="#fff" />);
  }
  return (
    <svg width={width} height={height} style={{ position:'absolute', left:0, top:0, opacity:0.18, pointerEvents:'none' }}>
      {bars}
    </svg>
  );
};

// ── Clip tooltip ───────────────────────────────────
const ClipTooltip = ({ clip, trackName, style }) => (
  <div style={{
    position:'absolute', bottom:'calc(100% + 6px)', left: 0,
    background:'rgba(16,16,20,0.96)', border:`1px solid ${TH.brdLight}`,
    borderRadius: 5, padding:'8px 10px', zIndex:20, minWidth: 180,
    pointerEvents:'none', boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
    ...style,
  }}>
    <div style={{ ...monoXs, color: TH.muted, marginBottom: 4 }}>{trackName}</div>
    <div style={{ fontSize: 12, color: TH.text, fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>{clip.label}</div>
    <div style={{ ...monoSm, color: TH.muted }}>
      {fmtTime(clip.s)} → {fmtTime(clip.e)} · {fmtDur(clip.e - clip.s)}
    </div>
  </div>
);

// ── Single clip block ──────────────────────────────
const TimelineClip = ({ clip, track, pxPerSec, laneH, isAudio, idx }) => {
  const [hovered, setHovered] = useState(false);
  const left = clip.s * pxPerSec + 1;
  const w = Math.max((clip.e - clip.s) * pxPerSec - 2, 3);
  const c = track.color;
  const innerH = laneH - 4;

  return (
    <div
      style={{
        position:'absolute', left, width: w, top: 2, height: innerH,
        background: isAudio
          ? `linear-gradient(180deg, ${c}dd, ${c}aa)`
          : `linear-gradient(180deg, ${c}cc, ${c}99)`,
        borderRadius: 3,
        borderTop: `2px solid ${c}`,
        overflow:'hidden', cursor:'pointer',
        boxShadow: hovered ? `0 0 0 1px ${c}, 0 2px 8px rgba(0,0,0,0.4)` : 'none',
        transition: 'box-shadow 0.12s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Video frame markers */}
      {!isAudio && w > 40 && (
        <div style={{
          position:'absolute', inset:0, opacity: 0.12,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 32px, rgba(0,0,0,0.6) 32px, rgba(0,0,0,0.6) 33px)',
        }} />
      )}
      {/* Audio waveform */}
      {isAudio && w > 20 && <WaveDecor width={w} height={innerH} color={c} seed={idx + clip.s} />}
      {/* Label */}
      {w > 20 && (
        <div style={{
          position:'relative', zIndex:1, padding:'2px 5px',
          fontSize: innerH < 24 ? 9 : 10, fontWeight: 500,
          color:'#fff', whiteSpace:'nowrap', overflow:'hidden',
          textOverflow:'ellipsis', textShadow:'0 1px 2px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.4)',
          lineHeight: `${innerH - 4}px`,
        }}>
          {clip.label}
        </div>
      )}
      {/* Tooltip */}
      {hovered && <ClipTooltip clip={clip} trackName={`${track.id} · ${track.name}`} />}
    </div>
  );
};

// ── Ruler ──────────────────────────────────────────
const Ruler = ({ duration, pxPerSec, totalW }) => {
  const intv = tickInterval(duration);
  const ticks = [];
  for (let t = 0; t <= duration; t += intv) ticks.push(t);
  if (ticks[ticks.length - 1] < duration && duration - ticks[ticks.length - 1] > intv * 0.35) ticks.push(duration);
  // sub-ticks
  const subIntv = intv / 2;
  const subs = [];
  if (subIntv >= 1) {
    for (let t = subIntv; t < duration; t += intv) subs.push(t);
  }
  return (
    <div style={{
      position:'relative', height: RULER_H, background: TH.ruler,
      borderBottom:`1px solid ${TH.border}`, width: totalW, userSelect:'none',
    }}>
      {subs.map(t => (
        <div key={`s${t}`} style={{
          position:'absolute', left: t * pxPerSec, top: 0, width: 1,
          height: 6, background: TH.dim,
        }} />
      ))}
      {ticks.map(t => (
        <div key={t} style={{ position:'absolute', left: t * pxPerSec, top: 0 }}>
          <div style={{ width: 1, height: 10, background: TH.brdLight }} />
          <span style={{ ...monoSm, color: TH.muted, position:'absolute', left: 3, top: 10, fontSize: 9 }}>
            {fmtTime(t)}
          </span>
        </div>
      ))}
      {/* Playhead at 0 */}
      <div style={{
        position:'absolute', left: 0, top: 0, width: 2, height: '100%',
        background: TH.playhead, zIndex: 2,
      }} />
    </div>
  );
};

// ── Track header (left panel) ──────────────────────
const TrackHead = ({ track, height, clipCount, isAudio }) => {
  const hasClips = clipCount > 0;
  return (
    <div style={{
      height, display:'flex', alignItems:'center', gap: 8,
      padding:'0 8px 0 10px', borderBottom:`1px solid ${TH.border}`,
      background: TH.surface, opacity: hasClips ? 1 : 0.45,
      transition: 'opacity 0.15s',
    }}>
      {/* Track badge */}
      <div style={{
        ...mono, fontSize: 10, fontWeight: 600, letterSpacing:'0.04em',
        color: badgeTextColor(track.color), background: track.color, borderRadius: 3,
        padding:'2px 5px', minWidth: 24, textAlign:'center',
        flexShrink: 0,
      }}>
        {track.id}
      </div>
      {/* Name */}
      <div style={{
        fontSize: 11, color: TH.text, whiteSpace:'nowrap',
        overflow:'hidden', textOverflow:'ellipsis', flex: 1,
        fontWeight: hasClips ? 500 : 400,
      }}>
        {track.name}
      </div>
      {/* Clip count */}
      {hasClips && (
        <span style={{ ...monoSm, color: TH.dim, fontSize: 9, flexShrink: 0 }}>
          {clipCount}
        </span>
      )}
    </div>
  );
};

// ── Track lane (timeline area) ─────────────────────
const TrackLane = ({ track, clips, height, pxPerSec, duration, isAudio, zIdx = 0 }) => {
  const totalW = duration * pxPerSec;
  const hasClips = clips && clips.length > 0;
  const intv = tickInterval(duration);
  return (
    <div style={{
      position:'relative', height, width: totalW,
      borderBottom:`1px solid ${TH.border}`,
      background: hasClips
        ? (zIdx % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent')
        : 'rgba(255,255,255,0.006)',
    }}>
      {/* Vertical grid lines aligned with ruler ticks */}
      {Array.from({ length: Math.ceil(duration / intv) - 1 }, (_, i) => (i + 1) * intv).map(t => (
        <div key={`g${t}`} style={{
          position:'absolute', left: t * pxPerSec, top: 0, width: 1, height:'100%',
          background:'rgba(255,255,255,0.03)', pointerEvents:'none',
        }} />
      ))}
      {/* Playhead line */}
      <div style={{
        position:'absolute', left: 0, top: 0, width: 1, height:'100%',
        background: `${TH.playhead}18`, zIndex: 1,
      }} />
      {(clips || []).map((clip, i) => (
        <TimelineClip key={i} clip={clip} track={track} pxPerSec={pxPerSec}
          laneH={height} isAudio={isAudio} idx={i} />
      ))}
    </div>
  );
};

// ── Resize handle ──────────────────────────────────
const ResizeHandle = ({ onStart }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        height: HANDLE_H, cursor:'row-resize', position:'relative', zIndex: 2,
      }}
      onMouseDown={onStart}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        position:'absolute', left: 0, right: 0, top: 1,
        height: hov ? 2 : 1,
        background: hov ? TH.accent : TH.border,
        transition:'background 0.15s, height 0.1s',
        borderRadius: hov ? 1 : 0,
      }} />
    </div>
  );
};

// ── Video/Audio divider ────────────────────────────
const TrackDivider = ({ width, inPanel }) => (
  <div style={{
    height: DIVIDER_H, display:'flex', alignItems:'center', justifyContent:'center',
    background: `linear-gradient(180deg, ${TH.surface}, rgba(255,130,64,0.05), ${TH.surface})`,
    borderBottom:`1px solid ${TH.divLine}`,
    borderTop:`1px solid ${TH.divLine}`,
    width: inPanel ? '100%' : width,
    padding: inPanel ? '0 6px' : '0 8px',
    gap: 6,
  }}>
    {inPanel ? (
      <span style={{ ...monoXs, fontSize: 9, color: TH.accent, opacity: 0.85, letterSpacing:'0.12em' }}>
        ▲ VIDEO · AUDIO ▼
      </span>
    ) : (
      <React.Fragment>
        <div style={{ flex: 1, height: 1, background: TH.divLine }} />
        <span style={{ ...mono, fontSize: 7, color: TH.accent, opacity: 0.35 }}>◆</span>
        <div style={{ flex: 1, height: 1, background: TH.divLine }} />
      </React.Fragment>
    )}
  </div>
);

// ── Status / difficulty badges ─────────────────────
const Badge = ({ label, color, bg }) => (
  <span style={{
    ...monoXs, fontSize: 9, padding:'2px 7px', borderRadius: 3,
    color, background: bg,
  }}>{label}</span>
);

// ── Asset Resolver (accordion between timeline and script) ──
const AssetResolver = ({ beatIdx }) => {
  const [open, setOpen] = useState(false);
  const assets = window.TL_ASSETS && window.TL_ASSETS[beatIdx];
  if (!assets) return null;

  const [selections, setSelections] = useState(() => {
    const s = {};
    (assets.music || []).forEach(m => { if (m.selected) s[m.id] = true; });
    return s;
  });
  const [confirmed, setConfirmed] = useState(() => {
    const c = {};
    (assets.music || []).forEach(m => { if (m.confirmed) c[m.id] = true; });
    return c;
  });

  const musicCount = (assets.music || []).length;
  const sfxCount = (assets.sfx || []).length;
  const visualCount = (assets.visual || []).length;
  const pendingVisual = (assets.visual || []).filter(v => v.status === 'pending').length;
  const pendingSfx = (assets.sfx || []).filter(s => !s.file).length;
  const pendingMusic = (assets.music || []).filter(m => !m.local).length;
  const totalPending = pendingVisual + pendingSfx + pendingMusic;

  const selectMusic = (id) => setSelections(prev => {
    const next = {};
    (assets.music || []).forEach(m => { next[m.id] = m.id === id; });
    return next;
  });
  const confirmMusic = (id) => setConfirmed(prev => ({ ...prev, [id]: true }));

  return (
    <div style={{ borderTop:`1px solid ${TH.border}` }}>
      <div onClick={() => setOpen(v => !v)} style={{
        display:'flex', alignItems:'center', gap: 8, padding:'8px 14px',
        cursor:'pointer', userSelect:'none', background: TH.header,
      }}>
        <span style={{ fontSize: 10, color: TH.dim, transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        <span style={{ ...monoXs, color: TH.accent, fontSize: 9 }}>ASSETS</span>
        <span style={{ ...monoSm, color: TH.dim, fontSize: 9, whiteSpace:'nowrap', flexShrink: 1, overflow:'hidden', textOverflow:'ellipsis' }}>
          {musicCount > 0 && `${musicCount} mús`}{sfxCount > 0 && ` · ${sfxCount} sfx`}{visualCount > 0 && ` · ${visualCount} vis`}
        </span>
        <div style={{ flex: 1 }} />
        {totalPending > 0 && (
          <span style={{ ...monoXs, fontSize: 8, color:'#E67E22', background:'rgba(230,126,34,0.12)', padding:'1px 6px', borderRadius: 3 }}>
            {totalPending} pendente{totalPending > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {open && (
        <div style={{ padding:'12px 14px 14px', background: TH.bg }}>
          {/* MÚSICA */}
          {musicCount > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...monoXs, color: TH.muted, fontSize: 8, marginBottom: 6 }}>MÚSICA</div>
              <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
                {(assets.music || []).map(m => {
                  const isSel = selections[m.id];
                  const isConf = confirmed[m.id];
                  if (isConf && !isSel) return null;
                  return (
                    <div key={m.id} style={{
                      padding:'10px 12px', borderRadius: 5,
                      background: isSel ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                      border: isSel ? `1px solid ${TH.accent}40` : `1px solid ${TH.border}`,
                      opacity: isConf ? 0.6 : 1,
                      cursor: isConf ? 'default' : 'pointer',
                    }} onClick={() => !isConf && selectMusic(m.id)}>
                      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 4 }}>
                        {isSel && <span style={{ fontSize: 12, color: TH.accent }}>★</span>}
                        <span style={{ fontSize: 13, fontWeight: 600, color: TH.text }}>{m.name}</span>
                        <span style={{ fontSize: 11, color: TH.muted }}>— {m.artist}</span>
                        <div style={{ flex: 1 }} />
                        {m.local ? (
                          <span style={{ ...monoXs, fontSize: 8, color:'#27AE60', background:'rgba(39,174,96,0.12)', padding:'1px 5px', borderRadius: 2 }}>✓ Local</span>
                        ) : (
                          <span style={{ ...monoXs, fontSize: 8, color:'#E67E22', background:'rgba(230,126,34,0.12)', padding:'1px 5px', borderRadius: 2, cursor:'pointer' }}>⬇ Download</span>
                        )}
                        <span style={{ ...mono, fontSize: 16, fontWeight: 700, color: m.match >= 80 ? '#27AE60' : m.match >= 60 ? TH.text : TH.muted }}>
                          {m.match}<span style={{ fontSize: 10, opacity: 0.6 }}>%</span>
                        </span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: m.note ? 6 : 0 }}>
                        <span style={{ ...monoSm, color: TH.dim, fontSize: 9 }}>{m.genre}</span>
                        {m.bpm && <span style={{ ...monoSm, color: TH.dim, fontSize: 9 }}>{m.bpm} BPM</span>}
                        {m.dur && <span style={{ ...monoSm, color: TH.dim, fontSize: 9 }}>{m.dur}</span>}
                        <div style={{ flex: 1 }} />
                        <div style={{ display:'flex', gap: 4, flexWrap:'wrap' }}>
                          {(m.tags || []).slice(0,3).map(tag => (
                            <span key={tag} style={{ ...mono, fontSize: 8, color: TH.dim, padding:'1px 5px', background:'rgba(255,255,255,0.04)', borderRadius: 2 }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      {m.note && <div style={{ fontSize: 11, color: TH.muted, fontStyle:'italic', marginTop: 2 }}>{m.note}</div>}
                      {isSel && !isConf && (
                        <div style={{ marginTop: 8, display:'flex', justifyContent:'flex-end', gap: 6 }}>
                          <button onClick={(e) => { e.stopPropagation(); confirmMusic(m.id); }} style={{
                            ...mono, fontSize: 10, padding:'4px 12px', borderRadius: 3,
                            background: TH.accent, color:'#111', border:'none', cursor:'pointer', fontWeight: 600,
                          }}>✓ Confirmar Seleção</button>
                        </div>
                      )}
                      {isConf && <div style={{ ...monoXs, fontSize: 8, color:'#27AE60', marginTop: 4 }}>✓ CONFIRMADO</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* SFX */}
          {sfxCount > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...monoXs, color: TH.muted, fontSize: 8, marginBottom: 6 }}>SFX</div>
              <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
                {(assets.sfx || []).map((s, i) => (
                  <div key={i} style={{ padding:'8px 10px', borderRadius: 4, background:'rgba(255,255,255,0.02)', border:`1px solid ${TH.border}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ ...mono, fontSize: 10, color: TH.accent }}>{s.tc}</span>
                      <span style={{ ...monoXs, fontSize: 8, color: s.typeColor, border:`1px solid ${s.typeColor}`, padding:'0 4px', borderRadius: 2 }}>{s.type}</span>
                      <span style={{ fontSize: 11, color: TH.text }}>{s.desc}</span>
                    </div>
                    {s.file ? (
                      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: TH.muted }}>{s.file.name}</span>
                        <span style={{ ...monoXs, fontSize: 8, color:'#27AE60', background:'rgba(39,174,96,0.12)', padding:'1px 5px', borderRadius: 2 }}>✓ Local</span>
                        <span style={{ ...mono, fontSize: 11, color:'rgba(255,255,255,0.5)' }}>——</span>
                        <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: s.file.match >= 80 ? '#27AE60' : TH.text }}>{s.file.match}%</span>
                      </div>
                    ) : (
                      <div style={{ ...monoXs, fontSize: 9, color:'#E67E22', marginBottom: 4 }}>⚠ Nenhum arquivo selecionado — buscar</div>
                    )}
                    <div style={{ display:'flex', gap: 4, flexWrap:'wrap', alignItems:'center' }}>
                      {(s.tags || []).map(tag => (
                        <span key={tag} style={{ ...mono, fontSize: 8, color: TH.dim, padding:'1px 5px', background:'rgba(255,255,255,0.04)', borderRadius: 10, cursor:'pointer' }}>{tag} ↗</span>
                      ))}
                      {s.altCount && <span style={{ ...monoSm, fontSize: 9, color: TH.accent, cursor:'pointer', marginLeft: 4 }}>+{s.altCount} alt →</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* VISUAL */}
          {visualCount > 0 && (
            <div style={{ marginBottom: (assets.ambience || assets.soundDesign) ? 14 : 0 }}>
              <div style={{ ...monoXs, color: TH.muted, fontSize: 8, marginBottom: 6 }}>VISUAL</div>
              <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
                {(assets.visual || []).map((v, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap: 8, padding:'5px 10px', borderRadius: 3, background:'rgba(255,255,255,0.015)', border:`1px solid ${TH.border}` }}>
                    <span style={{ ...mono, fontSize: 10, color: TH.accent }}>{v.tc}</span>
                    <span style={{ fontSize: 11, color: TH.text, flex: 1 }}>{v.desc}</span>
                    {v.status === 'resolved' ? (
                      <span style={{ ...monoXs, fontSize: 8, color:'#27AE60' }}>✓ {v.file}</span>
                    ) : (
                      <React.Fragment>
                        <span style={{ ...monoXs, fontSize: 8, color:'#E67E22' }}>⚠ Pendente</span>
                        <span style={{ ...monoSm, fontSize: 9, color: TH.accent, cursor:'pointer' }}>🔍 Buscar</span>
                      </React.Fragment>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* AMBIENCE / SOUND DESIGN */}
          {(assets.ambience || assets.soundDesign) && (
            <div>
              {assets.ambience && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ ...monoXs, color: TH.muted, fontSize: 8, marginBottom: 4 }}>AMBIENCE</div>
                  {assets.ambience.map((a, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap: 8, padding:'5px 10px', borderRadius: 3, background:'rgba(255,255,255,0.015)', border:`1px solid ${TH.border}` }}>
                      <span style={{ fontSize: 11, color: TH.text }}>{a.name}</span>
                      {a.local && <span style={{ ...monoXs, fontSize: 8, color:'#27AE60' }}>✓ Local</span>}
                      <span style={{ ...mono, fontSize: 11, color: TH.muted }}>{a.match}%</span>
                    </div>
                  ))}
                </div>
              )}
              {assets.soundDesign && (
                <div>
                  <div style={{ ...monoXs, color: TH.muted, fontSize: 8, marginBottom: 4 }}>SOUND DESIGN</div>
                  {assets.soundDesign.map((sd, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap: 8, padding:'5px 10px', borderRadius: 3, background:'rgba(255,255,255,0.015)', border:`1px solid ${TH.border}` }}>
                      <span style={{ ...mono, fontSize: 10, color: TH.accent }}>{sd.tc}</span>
                      <span style={{ fontSize: 11, color: TH.text, flex: 1 }}>{sd.name}</span>
                      <span style={{ ...monoXs, fontSize: 8, color: sd.status === 'pending' ? '#E67E22' : '#27AE60' }}>
                        {sd.status === 'pending' ? '⚠ Pendente' : '✓ Pronto'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Script panel (accordion below timeline) ───────
const ScriptPanel = ({ script }) => {
  const [open, setOpen] = useState(false);
  if (!script || script.length === 0) return null;
  const lineCount = script.filter(s => s.type === 'line').length;
  return (
    <div style={{ borderTop:`1px solid ${TH.border}` }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display:'flex', alignItems:'center', gap: 8, padding:'8px 14px',
          cursor:'pointer', userSelect:'none', background: TH.header,
        }}
      >
        <span style={{ fontSize: 10, color: TH.dim, transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        <span style={{ ...monoXs, color: TH.muted, fontSize: 9 }}>ROTEIRO</span>
        <span style={{ ...monoSm, color: TH.dim, fontSize: 9 }}>{lineCount} falas</span>
        <div style={{ flex: 1 }} />
      </div>
      {open && (
        <div style={{ padding:'14px 18px 18px', background: TH.bg }}>
          {script.map((item, i) => {
            if (item.type === 'note') return (
              <div key={i} style={{ display:'flex', gap: 8, marginBottom: 8, alignItems:'flex-start' }}>
                <span style={{
                  ...monoXs, fontSize: 9, padding:'2px 7px', borderRadius: 3,
                  background: item.tagColor, color: badgeTextColor(item.tagColor),
                  flexShrink: 0, marginTop: 2,
                }}>{item.tag}</span>
                <span style={{ fontSize: 12, color: TH.muted, lineHeight: 1.55 }}>{item.text}</span>
              </div>
            );
            if (item.type === 'line') return (
              <div key={i} style={{
                borderLeft: `3px solid ${item.accent || TH.text}`,
                padding:'10px 16px', margin:'6px 0',
                background:'rgba(255,255,255,0.02)',
                borderRadius:'0 4px 4px 0',
              }}>
                <span style={{ fontSize: 13, color: TH.text, fontStyle:'italic', lineHeight: 1.65 }}>
                  {item.text}
                </span>
              </div>
            );
            if (item.type === 'pause') return (
              <div key={i} style={{ margin:'4px 0 4px 6px' }}>
                <span style={{ ...mono, fontSize: 10, padding:'2px 8px', borderRadius: 3, background:'rgba(39,174,96,0.12)', color:'#27AE60' }}>
                  ⏸ {item.duration}s
                </span>
              </div>
            );
            if (item.type === 'ref') return (
              <div key={i} style={{ marginTop: 12, padding:'8px 0 0', borderTop:`1px solid ${TH.border}` }}>
                <span style={{ ...monoXs, fontSize: 8, color:'#E67E22', marginRight: 6, padding:'1px 5px', borderRadius: 2, background:'rgba(230,126,34,0.12)' }}>REF</span>
                <span style={{ ...monoSm, color: TH.dim, fontSize: 10, lineHeight: 1.5 }}>{item.text}</span>
              </div>
            );
            return null;
          })}
        </div>
      )}
    </div>
  );
};

// ── Beat section ───────────────────────────────────
const BeatSection = ({ beat, trackHeights, onResize, zoom, containerW, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const scrollRef = useRef(null);
  const allTracks = useMemo(() => TL_TRACKS.video.concat(TL_TRACKS.audio), []);
  const effH = useCallback((tid) => (beat.clips[tid]?.length || 0) > 0 ? trackHeights[tid] : EMPTY_H, [beat.clips, trackHeights]);
  
  const availW = Math.max(containerW - PANEL_W - 2, 300);
  const basePPS = availW / beat.duration;
  const pps = basePPS * zoom;
  const totalW = beat.duration * pps;

  const startResize = (trackId) => (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = trackHeights[trackId];
    const move = (me) => {
      const delta = me.clientY - startY;
      onResize(trackId, Math.max(MIN_H, Math.min(MAX_H, startH + delta)));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const totalClips = allTracks.reduce((n, t) => n + (beat.clips[t.id]?.length || 0), 0);
  const usedTracks = allTracks.filter(t => (beat.clips[t.id]?.length || 0) > 0).length;
  const diffColor = beat.difficulty === 'EASY' ? '#27AE60' : beat.difficulty === 'HARD' ? '#E74C3C' : '#E67E22';

  return (
    <div style={{
      background: TH.surface, borderRadius: 6, overflow:'hidden',
      border:`1px solid ${TH.border}`, borderLeft:`3px solid ${TH.accent}`,
      marginBottom: 14,
    }}>
      {/* Beat header */}
      <div
        style={{
          display:'flex', alignItems:'center', gap: 8, padding:'10px 14px',
          background: TH.header, cursor:'pointer', userSelect:'none',
          borderBottom: open ? `1px solid ${TH.border}` : 'none',
        }}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ fontSize: 11, color: TH.dim, transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)', flexShrink: 0, width: 14, textAlign:'center' }}>▶</span>
        <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: TH.accent, flexShrink: 0 }}>{beat.idx + 1}</span>
        <span style={{ fontSize: 13, color: TH.text, flex: 1, minWidth: 0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          <span style={{ ...monoSm, color: TH.muted }}>{beat.label}</span>
          <span style={{ color: TH.dim, margin:'0 5px' }}>—</span>
          <span style={{ fontWeight: 600 }}>{beat.name}</span>
        </span>
        <span style={{ ...monoSm, color: TH.muted, flexShrink: 0 }}>
          {fmtTime(beat.absStart)}–{fmtTime(beat.absStart + beat.duration)}
        </span>
        <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: TH.text, flexShrink: 0 }}>{fmtDur(beat.duration)}</span>
        <Badge label={beat.status} color={TH.muted} bg="rgba(255,255,255,0.06)" />
        <Badge label={beat.difficulty} color={diffColor} bg={`${diffColor}18`} />
        <span style={{ ...monoSm, color: TH.dim, fontSize: 8, flexShrink: 0, whiteSpace:'nowrap' }}>{totalClips}c · {usedTracks}/13</span>
      </div>

      {/* Beat body */}
      {open && (
        <React.Fragment>
        <div style={{ display:'flex' }}>
          {/* Track panel (left) */}
          <div style={{ width: PANEL_W, flexShrink: 0, borderRight:`1px solid ${TH.border}` }}>
            <div style={{ height: RULER_H, background: TH.surface, borderBottom:`1px solid ${TH.border}` }} />
            {TL_TRACKS.video.map(t => (
              <React.Fragment key={t.id}>
                <TrackHead track={t} height={effH(t.id)} clipCount={beat.clips[t.id]?.length || 0} />
                <ResizeHandle onStart={startResize(t.id)} />
              </React.Fragment>
            ))}
            <TrackDivider inPanel />
            {TL_TRACKS.audio.map(t => (
              <React.Fragment key={t.id}>
                <TrackHead track={t} height={effH(t.id)} clipCount={beat.clips[t.id]?.length || 0} isAudio />
                <ResizeHandle onStart={startResize(t.id)} />
              </React.Fragment>
            ))}
          </div>
          {/* Timeline area (right, scrollable) */}
          <div ref={scrollRef} style={{ flex: 1, overflowX:'auto', overflowY:'hidden' }}>
            <div style={{ width: Math.max(totalW, availW) + 36, minWidth: availW }}>
              <Ruler duration={beat.duration} pxPerSec={pps} totalW={Math.max(totalW, availW) + 36} />
              {TL_TRACKS.video.map((t, vi) => (
                <React.Fragment key={t.id}>
                  <TrackLane track={t} clips={beat.clips[t.id]} height={effH(t.id)}
                    pxPerSec={pps} duration={beat.duration} zIdx={vi} />
                  <div style={{ height: HANDLE_H }} />
                </React.Fragment>
              ))}
              <TrackDivider width={Math.max(totalW, availW) + 36} />
              {TL_TRACKS.audio.map((t, ai) => (
                <React.Fragment key={t.id}>
                  <TrackLane track={t} clips={beat.clips[t.id]} height={effH(t.id)}
                    pxPerSec={pps} duration={beat.duration} isAudio zIdx={ai} />
                  <div style={{ height: HANDLE_H }} />
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <AssetResolver beatIdx={beat.idx} />
        <ScriptPanel script={beat.script} />
        </React.Fragment>
      )}
    </div>
  );
};

// ── Toolbar ────────────────────────────────────────
const Toolbar = ({ zoom, setZoom, collapseAll, expandAll }) => (
  <div style={{
    display:'flex', alignItems:'center', gap: 16, padding:'10px 16px',
    background: TH.surface, borderRadius: 6, marginBottom: 12,
    border:`1px solid ${TH.border}`, flexWrap:'wrap',
  }}>
    <div style={{ ...monoXs, color: TH.accent, fontSize: 10, letterSpacing:'0.14em', whiteSpace:'nowrap' }}>
      TIMELINE RESOLVER
    </div>
    <div style={{ width: 1, height: 20, background: TH.border }} />
    {/* Zoom */}
    <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
      <span style={{ ...monoSm, color: TH.muted, fontSize: 9 }}>ZOOM</span>
      <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} style={btnStyle}>−</button>
      <input type="range" min="0.3" max="4" step="0.05" value={zoom}
        onChange={e => setZoom(parseFloat(e.target.value))}
        style={{ width: 100, accentColor: TH.accent }} />
      <button onClick={() => setZoom(z => Math.min(4, z + 0.15))} style={btnStyle}>+</button>
      <span style={{ ...monoSm, color: TH.text, minWidth: 36, textAlign:'center' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button onClick={() => setZoom(1)} style={{ ...btnStyle, padding:'3px 8px', fontSize: 10 }}>Fit</button>
    </div>
    <div style={{ flex: 1 }} />
    {/* Collapse / Expand */}
    <button onClick={expandAll} style={{ ...btnStyle, padding:'3px 8px', fontSize: 10 }}>Expand All</button>
    <button onClick={collapseAll} style={{ ...btnStyle, padding:'3px 8px', fontSize: 10 }}>Collapse All</button>
    {/* Track info */}
    <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
      {TL_TRACKS.video.slice().reverse().concat(TL_TRACKS.audio).map(t => (
        <div key={t.id} title={`${t.id} · ${t.name}: ${t.fn}`}
          style={{
            width: 10, height: 10, borderRadius: 2, background: t.color,
            cursor:'help', opacity: 0.8,
          }} />
      ))}
    </div>
  </div>
);

const btnStyle = {
  background:'rgba(255,255,255,0.06)', border:`1px solid ${TH.border}`,
  color: TH.text, borderRadius: 4, padding:'3px 6px', cursor:'pointer',
  ...mono, fontSize: 12, lineHeight: 1,
};

// ── Progress overview ──────────────────────────────
const ProgressBar = ({ beats }) => {
  const totalDur = beats.reduce((s, b) => s + b.duration, 0);
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: 12, padding:'10px 16px',
      background: TH.surface, borderRadius: 6, marginBottom: 12,
      border:`1px solid ${TH.border}`, flexWrap:'wrap',
    }}>
      <span style={{ ...monoXs, color: TH.muted, fontSize: 9 }}>OVERVIEW</span>
      <div style={{ flex: 1, height: 26, background: TH.bg, borderRadius: 4, display:'flex', overflow:'hidden', gap: 1 }}>
        {beats.map((b, i) => (
          <div key={i} title={`Beat ${b.idx} — ${b.name} · ${fmtDur(b.duration)}`} style={{
            flex: b.duration, height:'100%', position:'relative',
            background: `linear-gradient(90deg, ${TH.accent}30, ${TH.accent}15)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'default', overflow:'hidden',
          }}>
            <span style={{ ...mono, fontSize: 9, color: TH.text, opacity: 0.8, whiteSpace:'nowrap', padding:'0 6px', overflow:'hidden', textOverflow:'ellipsis' }}>
              {b.idx + 1} {b.name}
            </span>
          </div>
        ))}
      </div>
      <span style={{ ...monoSm, color: TH.text }}>
        {beats.length} beats · {fmtDur(totalDur)} total
      </span>
    </div>
  );
};

// ── Track legend ───────────────────────────────────
const TrackLegend = ({ expanded, setExpanded }) => {
  const all = TL_TRACKS.video.slice().reverse().concat(TL_TRACKS.audio);
  return (
    <div style={{
      padding:'10px 16px', background: TH.surface, borderRadius: 6,
      marginBottom: 12, border:`1px solid ${TH.border}`,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: 10, cursor:'pointer' }} onClick={() => setExpanded(v => !v)}>
        <span style={{ ...monoXs, color: TH.muted, fontSize: 9 }}>TRACK MAP</span>
        <span style={{ fontSize: 10, color: TH.dim }}>{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, marginTop: 10 }}>
          {all.map(t => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap: 8, padding:'4px 0' }}>
              <span style={{
                ...mono, fontSize: 9, fontWeight: 600, color: badgeTextColor(t.color),
                background: t.color, borderRadius: 2, padding:'1px 4px', minWidth: 22, textAlign:'center',
              }}>{t.id}</span>
              <span style={{ fontSize: 11, color: TH.text }}>{t.name}</span>
              <span style={{ fontSize: 10, color: TH.dim, marginLeft:'auto' }}>{t.fn}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Cross-Reference Panel ──────────────────────────
const CrossRefPanel = () => {
  const [open, setOpen] = useState(false);
  const data = window.TL_CROSSREF;
  if (!data) return null;
  const tblStyle = { width:'100%', borderCollapse:'collapse', fontSize: 11, color: TH.text };
  const thStyle = { ...monoXs, fontSize: 8, color: TH.muted, textAlign:'left', padding:'4px 8px', borderBottom:`1px solid ${TH.border}` };
  const tdStyle = { padding:'6px 8px', borderBottom:`1px solid ${TH.border}` };
  return (
    <div style={{ background: TH.surface, borderRadius: 6, border:`1px solid ${TH.border}`, overflow:'hidden' }}>
      <div onClick={() => setOpen(v => !v)} style={{
        display:'flex', alignItems:'center', gap: 8, padding:'10px 14px',
        cursor:'pointer', userSelect:'none', background: TH.header,
      }}>
        <span style={{ fontSize: 10, color: TH.dim, transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        <span style={{ ...monoXs, color:'#3498DB', fontSize: 10, whiteSpace:'nowrap' }}>CROSS-REFERENCE</span>
        <span style={{ ...monoSm, color: TH.dim, fontSize: 9 }}>{data.beats.length} beats · SRT</span>
        <div style={{ flex: 1 }} />
        {data.divergences.length > 0 && (
          <span style={{ ...monoXs, fontSize: 8, color:'#E67E22', background:'rgba(230,126,34,0.12)', padding:'1px 6px', borderRadius: 3 }}>
            {data.divergences.length} divergência{data.divergences.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {open && (
        <div style={{ padding:'12px 14px 14px' }}>
          <div style={{ ...monoSm, color: TH.muted, fontSize: 9, marginBottom: 10, lineHeight: 1.5 }}>{data.summary}</div>
          <table style={tblStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Beat</th>
                <th style={thStyle}>SRT Timestamp</th>
                <th style={thStyle}>Duração</th>
                <th style={thStyle}>Est. Roteiro</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.beats.map((b, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontWeight: 500, color: TH.accent }}>{b.name}</td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 10, color: TH.muted }}>{b.srt}</td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 10 }}>{b.dur}</td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 10, color: TH.muted }}>{b.estRot}</td>
                  <td style={tdStyle}>
                    <span style={{ ...monoXs, fontSize: 8, color: b.statusColor, background:`${b.statusColor}18`, padding:'1px 5px', borderRadius: 2 }}>{b.status}</span>
                    {b.note && <span style={{ ...monoSm, fontSize: 8, color: TH.dim, marginLeft: 6 }}>{b.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.divergences.length > 0 && (
            <div style={{ marginTop: 12, padding:'10px 12px', background:'rgba(230,78,60,0.06)', borderRadius: 4, border:'1px solid rgba(230,78,60,0.15)' }}>
              <div style={{ ...monoXs, fontSize: 8, color:'#E74C3C', marginBottom: 6 }}>DIVERGÊNCIAS IDENTIFICADAS</div>
              {data.divergences.map((d, i) => (
                <div key={i} style={{ fontSize: 11, color:'#E67E22', lineHeight: 1.5, marginBottom: 3 }}>• {d}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Speed Ramps Panel ──────────────────────────────
const SpeedRampsPanel = () => {
  const [open, setOpen] = useState(false);
  const data = window.TL_SPEEDRAMPS;
  if (!data) return null;
  const tblStyle = { width:'100%', borderCollapse:'collapse', fontSize: 11, color: TH.text };
  const thStyle = { ...monoXs, fontSize: 8, color: TH.muted, textAlign:'left', padding:'4px 8px', borderBottom:`1px solid ${TH.border}` };
  const tdStyle = { padding:'6px 8px', borderBottom:`1px solid ${TH.border}` };
  return (
    <div style={{ background: TH.surface, borderRadius: 6, border:`1px solid ${TH.border}`, overflow:'hidden' }}>
      <div onClick={() => setOpen(v => !v)} style={{
        display:'flex', alignItems:'center', gap: 8, padding:'10px 14px',
        cursor:'pointer', userSelect:'none', background: TH.header,
      }}>
        <span style={{ fontSize: 10, color: TH.dim, transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        <span style={{ ...monoXs, color:'#9B59B6', fontSize: 10, whiteSpace:'nowrap' }}>SPEED RAMPS</span>
        <span style={{ ...monoSm, color: TH.dim, fontSize: 9 }}>{data.sections.length} seções</span>
        <div style={{ flex: 1 }} />
        <span style={{ ...monoSm, color: TH.dim, fontSize: 9 }}>~12-14 min final</span>
      </div>
      {open && (
        <div style={{ padding:'12px 14px 14px' }}>
          <div style={{ ...monoSm, color: TH.muted, fontSize: 9, marginBottom: 4, lineHeight: 1.5 }}>{data.summary}</div>
          <div style={{ ...monoSm, color: TH.dim, fontSize: 9, marginBottom: 10, lineHeight: 1.5 }}>{data.base}</div>
          <table style={tblStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Seção</th>
                <th style={thStyle}>SRT Range</th>
                <th style={thStyle}>Velocidade</th>
                <th style={thStyle}>Racional</th>
              </tr>
            </thead>
            <tbody>
              {data.sections.map((s, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{s.name}</td>
                  <td style={{ ...tdStyle, ...mono, fontSize: 10, color: TH.muted }}>{s.srt}</td>
                  <td style={tdStyle}>
                    <span style={{ ...mono, fontSize: 11, fontWeight: 600, color: s.velColor, background:`${s.velColor}18`, padding:'2px 7px', borderRadius: 3 }}>{s.vel}</span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: TH.muted }}>{s.racional}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, ...monoSm, fontSize: 8, color: TH.dim }}>
            Fonte: produzido por IA tool (Gemini AI transcribe + análise rítmica)
          </div>
        </div>
      )}
    </div>
  );
};

// ── Page ───────────────────────────────────────────
const TimelinePage = () => {
  const [zoom, setZoom] = useState(1);
  const [trackHeights, setTrackHeights] = useState(() => {
    const h = {};
    [...TL_TRACKS.video, ...TL_TRACKS.audio].forEach(t => { h[t.id] = (t.id === 'V1' || t.id === 'A1') ? 42 : DEF_H; });
    return h;
  });
  const [legendOpen, setLegendOpen] = useState(false);
  const [containerW, setContainerW] = useState(960);
  const containerRef = useRef(null);
  const beats = window.TL_BEATS;
  // simple collapse management — leave to BeatSection internal state
  const expandAllRef = useRef(null);
  const collapseAllRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleResize = useCallback((id, newH) => {
    setTrackHeights(prev => ({ ...prev, [id]: newH }));
  }, []);

  // Expand / Collapse All uses a key to force re-mount BeatSections
  const [allState, setAllState] = useState(0); // 0=normal, 1=collapse, 2=expand
  const [resetKey, setResetKey] = useState(0);

  return (
    <div ref={containerRef} style={{ maxWidth: 1440, margin:'0 auto', padding:'16px 20px 40px' }}>
      {/* Page header */}
      <div style={{ display:'flex', alignItems:'baseline', gap: 14, marginBottom: 16, flexWrap:'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: TH.text, margin: 0 }}>
          Pós-Produção
        </h1>
        <span style={{ fontSize: 13, color: TH.muted }}>Cena × Cena</span>
        <div style={{ flex: 1 }} />
        <span style={{ ...monoSm, color: TH.muted }}>
          {fmtDur(beats.reduce((s,b) => s + b.duration, 0))} · {beats.length} beats
        </span>
      </div>

      <ProgressBar beats={beats} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginBottom: 12 }}>
        <CrossRefPanel />
        <SpeedRampsPanel />
      </div>
      <Toolbar
        zoom={zoom} setZoom={setZoom}
        expandAll={() => { setAllState(2); setResetKey(k => k + 1); }}
        collapseAll={() => { setAllState(1); setResetKey(k => k + 1); }}
      />

      {/* Beat timelines */}
      {beats.map(beat => (
        <BeatSection
          key={`${beat.idx}-${resetKey}`}
          beat={beat}
          trackHeights={trackHeights}
          onResize={handleResize}
          zoom={zoom}
          containerW={containerW}
          defaultOpen={allState !== 1}
        />
      ))}
    </div>
  );
};

// Keep existing export
window.TimelinePage = TimelinePage;
// Note: AssetResolver is defined above and used in BeatSection
