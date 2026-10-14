import { useEffect, useRef, useState } from 'react'
import { createMatch, step, startSecondHalf, substitute, setTactics, clockLabel, possessionPct, playerRating, DT, MAX_SUBS } from '../game/engine/match.js'
import { renderPitch, drawMatch, SpriteCache, CANVAS_W, CANVAS_H, toCanvas, blitCamera } from '../pixel/pitchRenderer.js'
import { ROLES } from '../game/player.js'
import { Crest, Bar, Modal } from '../components/Pixel.jsx'
import { FormationPicker, TacticSliders } from '../components/TacticsBoard.jsx'

// Simulated seconds per real second. A full match is 600 simulated seconds.
const SPEEDS = [
  { label: '×1', v: 1.5 },
  { label: '×2', v: 3 },
  { label: '×4', v: 6 },
  { label: '×8', v: 12 },
]

const RESTART_LABEL = {
  kickoff: 'Saque inicial',
  throw: 'Saque de banda',
  corner: 'Tiro de esquina',
  goalkick: 'Saque de meta',
  freekick: 'Tiro libre',
  penalty: '¡Penal!',
}

function runToEnd(s) {
  let guard = 0
  while (s.phase !== 'fulltime' && guard < 40000) {
    if (s.phase === 'halftime') startSecondHalf(s)
    step(s)
    guard++
  }
}

export default function MatchScreen({ home, away, userSide = null, seed, title, onFinish }) {
  const sRef = useRef(null)
  if (!sRef.current) sRef.current = createMatch({ home, away, seed, userSide })
  const s = sRef.current
  const canvasRef = useRef(null)
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [numbers, setNumbers] = useState(false)
  const [tab, setTab] = useState('feed')
  const [, setTick] = useState(0)
  const [talk, setTalk] = useState(null)
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 700 ? 2 : 1))
  const live = useRef({ running: true, speed: SPEEDS[1].v, numbers: false, zoom: 1 })

  useEffect(() => {
    live.current = { running, speed: SPEEDS[speed].v, numbers, zoom }
  }, [running, speed, numbers, zoom])

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    // Everything is drawn to an off-screen frame; the camera then copies all of it or a zoomed window.
    const frame = document.createElement('canvas')
    frame.width = CANVAS_W
    frame.height = CANVAS_H
    const fctx = frame.getContext('2d')
    const pitch = renderPitch()
    const cache = new SpriteCache()
    const cam = toCanvas(s.ball.x, s.ball.y)
    let raf
    let last = performance.now()
    let acc = 0
    const loop = (now) => {
      const real = Math.min(0.1, (now - last) / 1000)
      last = now
      const r = live.current
      const paused = s.phase === 'halftime' || s.phase === 'fulltime'
      if (r.running && !paused) {
        acc += real * r.speed
        let n = 0
        while (acc >= DT && n < 500) {
          step(s)
          acc -= DT
          n++
          if (s.phase === 'halftime' || s.phase === 'fulltime') {
            acc = 0
            break
          }
        }
      }
      drawMatch(fctx, s, pitch, cache, paused ? 1 : Math.min(1, acc / DT), { numbers: r.numbers, highlightTeam: userSide })
      const target = toCanvas(s.ball.x, s.ball.y)
      const k = Math.min(1, real * 4)
      cam.x += (target.x - cam.x) * k
      cam.y += (target.y - cam.y) * k
      blitCamera(ctx, frame, cam, r.zoom)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const hud = setInterval(() => setTick((t) => t + 1), 200)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(hud)
    }
  }, [s, userSide])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        setRunning((r) => !r)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const [h, a] = s.teams
  const poss = possessionPct(s)
  const carrier = s.ball.owner
  const restartTxt = s.restart ? `${RESTART_LABEL[s.restart.type]} · ${s.teams[s.restart.team].def.short}` : ''

  const doTalk = (kind) => {
    const t = userSide
    const diff = s.score[t] - s.score[1 - t]
    let delta = 0
    let text = ''
    if (kind === 'calm') {
      for (const ag of s.teams[t].agents) ag.energy = Math.min(100, ag.energy + 3)
      text = 'Los jugadores escuchan tranquilos y recuperan aire.'
    } else if (kind === 'demand') {
      delta = diff > 0 ? -1 : 1
      text = diff > 0 ? 'El vestidor no entiende tanta exigencia yendo arriba…' : '¡El equipo sale con hambre de remontar!'
    } else {
      delta = diff >= 0 ? 1 : 0
      text = diff >= 0 ? '¡Los elogios motivan al equipo!' : 'Los elogios suenan vacíos con el marcador en contra.'
    }
    for (const ag of s.teams[t].agents) ag.morale = Math.max(-2, Math.min(2, ag.morale + delta))
    setTalk(text)
  }

  const events = s.events.slice(-90).reverse()

  return (
    <div className="app">
      <div className="panel scoreboard">
        <div className="side">
          <Crest team={h.def} size={40} />
          <div style={{ minWidth: 0 }}>
            <div className="tname">
              <span className="long-name">{h.def.name}</span>
              <span className="short-name">{h.def.short}</span>
            </div>
            <div className="small muted">{s.goals.filter((g) => g.team === 0).map((g) => `${g.name} ${g.minute}'${g.own ? ' (AG)' : g.penalty ? ' (P)' : ''}`).join(', ')}</div>
          </div>
        </div>
        <div>
          <div className="score">
            {s.score[0]} - {s.score[1]}
          </div>
          <div className="clock">{clockLabel(s)}</div>
        </div>
        <div className="side away">
          <div style={{ minWidth: 0 }}>
            <div className="tname">
              <span className="long-name">{a.def.name}</span>
              <span className="short-name">{a.def.short}</span>
            </div>
            <div className="small muted">{s.goals.filter((g) => g.team === 1).map((g) => `${g.name} ${g.minute}'${g.own ? ' (AG)' : g.penalty ? ' (P)' : ''}`).join(', ')}</div>
          </div>
          <Crest team={a.def} size={40} />
        </div>
      </div>
      {title && (
        <div className="small muted" style={{ textAlign: 'center', margin: '6px 0' }}>
          {title}
        </div>
      )}

      <div className="grid cols-main" style={{ marginTop: 10 }}>
        <div>
          <div className="pitch-wrap">
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="pixel" aria-label="Campo de juego" />
            {s.phase === 'goal' && <div className="pitch-flash">¡GOOOL!</div>}
          </div>
          <div className="carrier-line">
            {s.phase === 'restart' ? restartTxt : carrier ? `⚽ ${carrier.number} ${carrier.name} · ${s.teams[carrier.team].def.short}` : s.ball.shot ? '¡Disparo!' : ' '}
          </div>
          <div className="split" title={`Posesión ${poss[0]}% - ${poss[1]}%`}>
            <i style={{ width: `${poss[0]}%`, background: h.kit.shirt }} />
            <i style={{ width: `${poss[1]}%`, background: a.kit.shirt }} />
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            {s.phase === 'halftime' ? (
              <button className="btn primary" onClick={() => startSecondHalf(s)}>
                ▶ Comenzar 2º tiempo
              </button>
            ) : (
              <button className="btn" onClick={() => setRunning(!running)} disabled={s.phase === 'fulltime'}>
                {running ? '❚❚ Pausa' : '▶ Jugar'}
              </button>
            )}
            {SPEEDS.map((sp, i) => (
              <button key={sp.label} className={`btn sm ${speed === i ? 'active' : 'ghost'}`} onClick={() => setSpeed(i)}>
                {sp.label}
              </button>
            ))}
            <button className={`btn sm ${numbers ? 'active' : 'ghost'}`} onClick={() => setNumbers(!numbers)}>
              Dorsales
            </button>
            <button className={`btn sm ${zoom > 1 ? 'active' : 'ghost'}`} onClick={() => setZoom(zoom > 1 ? 1 : 2)} title="Cámara que sigue al balón">
              🔍 Zoom
            </button>
            <span className="spacer" />
            <button className="btn ghost sm" onClick={() => runToEnd(s)} disabled={s.phase === 'fulltime'}>
              ⏭ Simular resto
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="tabs">
            <button className={`btn sm ${tab === 'feed' ? 'active' : 'ghost'}`} onClick={() => setTab('feed')}>
              Relato
            </button>
            <button className={`btn sm ${tab === 'stats' ? 'active' : 'ghost'}`} onClick={() => setTab('stats')}>
              Stats
            </button>
            {userSide !== null && (
              <button className={`btn sm ${tab === 'team' ? 'active' : 'ghost'}`} onClick={() => setTab('team')}>
                Mi equipo
              </button>
            )}
            <button className={`btn sm ${tab === 'ratings' ? 'active' : 'ghost'}`} onClick={() => setTab('ratings')}>
              Notas
            </button>
          </div>
          {tab === 'feed' && <Feed events={events} s={s} />}
          {tab === 'stats' && <Stats s={s} />}
          {tab === 'team' && userSide !== null && <TeamControl s={s} side={userSide} />}
          {tab === 'ratings' && <Ratings s={s} />}
        </div>
      </div>

      {s.phase === 'halftime' && userSide !== null && !talk?.done && (
        <Modal onClose={() => setTalk({ done: true })}>
          <h2>Descanso · {s.score[0]} - {s.score[1]}</h2>
          <Stats s={s} />
          <h3 style={{ marginTop: 14 }}>Charla técnica</h3>
          {typeof talk === 'string' ? (
            <p>{talk}</p>
          ) : (
            <div className="row">
              <button className="btn ghost" onClick={() => doTalk('calm')}>
                Mantener la calma
              </button>
              <button className="btn ghost" onClick={() => doTalk('demand')}>
                Exigir más
              </button>
              <button className="btn ghost" onClick={() => doTalk('praise')}>
                Elogiar
              </button>
            </div>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <button
              className="btn ghost"
              onClick={() => {
                setTalk({ done: true })
                setTab('team')
              }}
            >
              Ajustar tácticas
            </button>
            <span className="spacer" />
            <button
              className="btn primary"
              onClick={() => {
                setTalk({ done: true })
                startSecondHalf(s)
              }}
            >
              Comenzar 2º tiempo
            </button>
          </div>
        </Modal>
      )}

      {s.phase === 'fulltime' && <FullTime s={s} userSide={userSide} onContinue={() => onFinish?.(s.result, s)} />}
    </div>
  )
}

function Feed({ events, s }) {
  return (
    <div className="feed">
      {events.map((e, i) => {
        const cls = e.goal ? 'goal' : e.type === 'yellow' ? 'card' : e.type === 'red' || e.type === 'secondYellow' ? 'red' : ''
        const team = e.team !== null && e.team !== undefined ? s.teams[e.team] : null
        return (
          <div key={s.events.length - i} className={`ev ${cls}`} style={e.minor ? { opacity: 0.6 } : undefined}>
            <span className="min">{e.minute}'</span>
            <span>
              {team && <span style={{ display: 'inline-block', width: 8, height: 8, background: team.kit.shirt, border: '1px solid #000', marginRight: 6 }} />}
              {e.type === 'yellow' && '🟨 '}
              {(e.type === 'red' || e.type === 'secondYellow') && '🟥 '}
              {e.type === 'sub' && '🔁 '}
              {e.type === 'injury' && '🚑 '}
              {e.goal && '⚽ '}
              {e.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Stats({ s }) {
  const [p0, p1] = possessionPct(s)
  const [a, b] = s.stats
  const pct = (st) => (st.passes ? Math.round((st.passesOk / st.passes) * 100) : 0)
  const rows = [
    ['Posesión', `${p0}%`, `${p1}%`],
    ['Tiros', a.shots, b.shots],
    ['A puerta', a.onTarget, b.onTarget],
    ['xG', a.xg.toFixed(2), b.xg.toFixed(2)],
    ['Pases', a.passes, b.passes],
    ['Precisión', `${pct(a)}%`, `${pct(b)}%`],
    ['Córners', a.corners, b.corners],
    ['Faltas', a.fouls, b.fouls],
    ['Amarillas', a.yellows, b.yellows],
    ['Rojas', a.reds, b.reds],
    ['Atajadas', a.saves, b.saves],
  ]
  return (
    <div>
      <div className="statrow">
        <span className="v">{s.teams[0].def.short}</span>
        <span />
        <span className="v r">{s.teams[1].def.short}</span>
      </div>
      {rows.map(([l, x, y]) => (
        <div className="statrow" key={l}>
          <span className="v">{x}</span>
          <span className="lbl">{l}</span>
          <span className="v r">{y}</span>
        </div>
      ))}
    </div>
  )
}

function Ratings({ s }) {
  return (
    <div className="grid cols-2" style={{ gap: 10 }}>
      {s.teams.map((T, t) => (
        <div key={t}>
          <h3>{T.def.short}</h3>
          <table className="data">
            <tbody>
              {[...T.agents, ...T.used].map((ag) => (
                <tr key={ag.id} style={ag.leftAt !== null ? { opacity: 0.55 } : undefined}>
                  <td className="num small">{ag.number}</td>
                  <td className="small">
                    {ag.short}
                    {ag.perf.goals > 0 && ` ⚽${ag.perf.goals > 1 ? '×' + ag.perf.goals : ''}`}
                    {ag.yellow > 0 && ' 🟨'}
                    {ag.sentOff && ' 🟥'}
                  </td>
                  <td className="num small">{playerRating(ag, s).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function TeamControl({ s, side }) {
  const T = s.teams[side]
  const [out, setOut] = useState(null)
  const [inn, setInn] = useState(null)
  const bench = T.bench.map((id) => T.def.players.find((p) => p.id === id)).filter(Boolean)
  const done = s.phase === 'fulltime'
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div>
        <h3>Formación</h3>
        <FormationPicker value={T.tactics.formation} onChange={(f) => setTactics(s, side, { formation: f })} />
      </div>
      <TacticSliders tactics={T.tactics} onChange={(t) => setTactics(s, side, t)} />
      <div className="row">
        <h3 style={{ margin: 0 }}>Cambios</h3>
        <span className="chip">
          {T.subsLeft}/{MAX_SUBS} disponibles
        </span>
      </div>
      <div className="grid cols-2" style={{ gap: 8 }}>
        <div>
          <div className="small muted">Sale</div>
          {T.agents.map((ag) => (
            <div
              key={ag.id}
              className="row small"
              onClick={() => setOut(ag.id)}
              style={{ cursor: 'pointer', gap: 6, padding: '3px 4px', background: out === ag.id ? 'var(--panel2)' : undefined, outline: out === ag.id ? '2px solid var(--accent)' : undefined }}
            >
              <span className={`pos ${ROLES[ag.role].line}`}>{ROLES[ag.role].label}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {ag.short}
                {ag.injured && ' 🚑'}
                {ag.yellow > 0 && ' 🟨'}
              </span>
              <div style={{ width: 44 }}>
                <Bar value={ag.energy} />
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="small muted">Entra</div>
          {bench.map((p) => (
            <div
              key={p.id}
              className="row small"
              onClick={() => setInn(p.id)}
              style={{ cursor: 'pointer', gap: 6, padding: '3px 4px', background: inn === p.id ? 'var(--panel2)' : undefined, outline: inn === p.id ? '2px solid var(--accent)' : undefined }}
            >
              <span className={`pos ${ROLES[p.roles[0]].line}`}>{ROLES[p.roles[0]].label}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{p.short}</span>
            </div>
          ))}
          {!bench.length && <div className="small muted">Sin suplentes</div>}
        </div>
      </div>
      <button
        className="btn primary"
        disabled={!out || !inn || T.subsLeft <= 0 || done}
        onClick={() => {
          if (substitute(s, side, out, inn)) {
            setOut(null)
            setInn(null)
          }
        }}
      >
        Hacer cambio
      </button>
    </div>
  )
}

function FullTime({ s, userSide, onContinue }) {
  const r = s.result
  const team = userSide !== null ? s.teams[userSide] : null
  const verdict =
    userSide === null ? '' : s.score[userSide] > s.score[1 - userSide] ? '¡Victoria!' : s.score[userSide] < s.score[1 - userSide] ? 'Derrota' : 'Empate'
  return (
    <Modal onClose={onContinue}>
      <div className="row">
        <h2 style={{ margin: 0 }}>
          Final: {s.teams[0].def.short} {s.score[0]} - {s.score[1]} {s.teams[1].def.short}
        </h2>
        <span className="spacer" />
        {verdict && <span className="chip px" style={{ fontSize: 10 }}>{verdict}</span>}
      </div>
      <p>
        ⭐ Jugador del partido: <b>{r.motm?.name}</b> ({s.teams[r.motm?.team]?.def.short}) · {r.motm?.rating.toFixed(1)}
      </p>
      <div className="grid cols-2">
        <Stats s={s} />
        {team && (
          <div>
            <h3>Notas de {team.def.short}</h3>
            <table className="data">
              <tbody>
                {[...team.agents, ...team.used].map((ag) => (
                  <tr key={ag.id}>
                    <td className="small">
                      {ag.number} {ag.short}
                    </td>
                    <td className="num small">{r.players[ag.id]?.rating.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <span className="spacer" />
        <button className="btn primary" onClick={onContinue}>
          Continuar
        </button>
      </div>
    </Modal>
  )
}
